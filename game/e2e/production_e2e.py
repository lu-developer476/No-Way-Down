#!/usr/bin/env python3
"""Text-only production browser gate for the canonical runtime."""
from __future__ import annotations
import json, os, pathlib, unittest, urllib.error, urllib.request
from datetime import datetime, timezone
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL=os.getenv('E2E_BASE_URL','http://127.0.0.1:8000').rstrip('/')
RESULTS=pathlib.Path(__file__).resolve().parents[1]/'test-results'
EXPECTED_KEYS={'sha','shortSha','builtAt','mode','version'}
FORBIDDEN=('uncaught','unhandled','failed to load resource','fataltransition','campaign load error','json.parse')

def http_get(path):
 try:
  with urllib.request.urlopen(BASE_URL+path,timeout=20) as response:return response.status,response.headers.get('Content-Type',''),response.read()
 except urllib.error.HTTPError as error:return error.code,error.headers.get('Content-Type',''),error.read()

class ProductionE2E(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  RESULTS.mkdir(exist_ok=True); options=Options(); options.add_argument('--headless=new'); options.add_argument('--no-sandbox'); options.add_argument('--disable-dev-shm-usage')
  options.set_capability('goog:loggingPrefs',{'browser':'ALL','performance':'ALL'})
  cls.browser=webdriver.Chrome(options=options); cls.wait=WebDriverWait(cls.browser,30); cls.console=[]; cls.network=[]; cls.results=[]
 @classmethod
 def tearDownClass(cls):
  cls.collect_console_logs('final'); cls.collect_network_failures('final'); cls.browser.quit()
  (RESULTS/'browser-console.json').write_text(json.dumps(cls.console,indent=2,ensure_ascii=False))
  (RESULTS/'network-errors.json').write_text(json.dumps(cls.network,indent=2,ensure_ascii=False))
  (RESULTS/'e2e-report.json').write_text(json.dumps(cls.results,indent=2,ensure_ascii=False))
 @classmethod
 def collect_console_logs(cls,label):
  for entry in cls.browser.get_log('browser'):
   cls.console.append({'test':label,'level':entry['level'],'message':entry['message'],'timestamp':datetime.fromtimestamp(entry['timestamp']/1000,timezone.utc).isoformat()})
 @classmethod
 def collect_network_failures(cls,label):
  for entry in cls.browser.get_log('performance'):
   try:
    message=json.loads(entry['message'])['message']
    if message['method']=='Network.responseReceived':
     response=message['params']['response']; status=int(response['status'])
     if status>=400: cls.network.append({'test':label,'url':response['url'],'status':status})
   except (KeyError,ValueError,TypeError): pass
 def setUp(self): self.reset_browser_state()
 def tearDown(self):
  label=self.id(); self.collect_console_logs(label); self.collect_network_failures(label)
  bad_logs=[entry for entry in self.console if entry['test']==label and (entry['level']=='SEVERE' or any(term in entry['message'].lower() for term in FORBIDDEN))]
  bad_network=[entry for entry in self.network if entry['test']==label and (entry['status']>=500 or entry['status']==404)]
  result={'test':label,'passed':not bad_logs and not bad_network}
  if label.endswith('test_03_reload_returns_to_clean_main_menu'): result.update({'continueFeatureCovered':False,'reason':'MainMenuScene currently exposes only newGame'})
  self.results.append(result); self.assertFalse(bad_logs); self.assertFalse(bad_network); self.assert_no_fatal_state()
 def js(self,script,*args): return self.browser.execute_script(script,*args)
 def js_boolean(self,script,*args):
  result=self.js(script,*args)
  if not isinstance(result,bool): raise TypeError(f'JavaScript did not return a boolean: {type(result).__name__}')
  return result
 def wait_for_document(self): self.wait.until(lambda _:self.js("return document.readyState")=='complete')
 def wait_for_build_info(self): self.wait.until(lambda _:isinstance(self.get_build_info(),dict))
 def wait_for_game(self): self.wait.until(lambda _:self.js_boolean('return Boolean(window.__NWD_GAME__)') is True)
 def wait_for_scene(self,key,active=True): self.wait.until(lambda _:self.js_boolean("return Boolean(window.__NWD_GAME__?.scene?.isActive(arguments[0]))",key) is active)
 def wait_for_menu_ready(self): self.wait_for_scene('MainMenuScene'); self.wait.until(lambda _:self.get_menu_state().get('ready') is True)
 def get_registry_string(self,key): return self.js("const value=window.__NWD_GAME__?.registry?.get(arguments[0]);return typeof value==='string'?value:null",key)
 def get_registry_number(self,key): return self.js("const value=window.__NWD_GAME__?.registry?.get(arguments[0]);return Number.isFinite(value)?value:null",key)
 def get_registry_boolean(self,key): return self.js("const value=window.__NWD_GAME__?.registry?.get(arguments[0]);return typeof value==='boolean'?value:null",key)
 def get_active_node_id(self): return self.js("const node=window.__NWD_GAME__?.registry?.get('activeCampaignNode');return typeof node?.id==='string'?node.id:null")
 def wait_for_node(self,node): self.wait.until(lambda _:self.get_active_node_id()==node)
 def wait_for_runtime(self,runtime): self.wait.until(lambda _:((self.get_runtime_diagnostics() or {}).get('runtimeLevelId'))==runtime)
 def wait_for_gameplay_ready(self): self.wait.until(lambda _:((self.get_runtime_diagnostics() or {}).get('gameplayReady')) is True)
 def get_menu_state(self):
  return self.js("""const state=window.__NWD_GAME__?.registry?.get('mainMenuState');if(!state||typeof state!=='object')return null;return {ready:state.ready===true,selectedIndex:Number.isInteger(state.selectedIndex)?state.selectedIndex:null,selectedAction:typeof state.selectedAction==='string'?state.selectedAction:null,setupVisible:state.setupVisible===true,setupStep:typeof state.setupStep==='string'?state.setupStep:null,canContinue:state.canContinue===true}""") or {}
 def get_build_info(self):
  return self.js("""const build=window.__NWD_BUILD__;if(!build||typeof build!=='object')return null;return {sha:typeof build.sha==='string'?build.sha:null,shortSha:typeof build.shortSha==='string'?build.shortSha:null,builtAt:typeof build.builtAt==='string'?build.builtAt:null,mode:typeof build.mode==='string'?build.mode:null,version:typeof build.version==='string'?build.version:null}""")
 def get_runtime_diagnostics(self):
  return self.js("""const diagnostics=window.__NWD_RUNTIME_DIAGNOSTICS__;if(!diagnostics)return null;return {nodeId:typeof diagnostics.nodeId==='string'?diagnostics.nodeId:null,runtimeLevelId:typeof diagnostics.runtimeLevelId==='string'?diagnostics.runtimeLevelId:null,physicsEngine:typeof diagnostics.physicsEngine==='string'?diagnostics.physicsEngine:null,matterBodyCount:Number.isFinite(diagnostics.matterBodyCount)?diagnostics.matterBodyCount:0,tiledMapPath:typeof diagnostics.tiledMapPath==='string'?diagnostics.tiledMapPath:null,currentObjective:typeof diagnostics.currentObjective==='string'?diagnostics.currentObjective:null,playerCount:Number.isFinite(diagnostics.playerCount)?diagnostics.playerCount:0,gameplayReady:diagnostics.gameplayReady===true,fatalError:diagnostics.fatalError?String(diagnostics.fatalError):null}""")
 def get_api_build_info(self):
  status,ctype,body=http_get('/api/build-info/'); self.assertEqual(status,200); self.assertEqual(ctype.split(';')[0],'application/json'); return json.loads(body)
 def clear_indexed_db(self):
  result=self.browser.execute_async_script("""const done=arguments[arguments.length-1];if(typeof indexedDB.databases!=='function'){done(true);return}indexedDB.databases().then(databases=>Promise.all(databases.filter(database=>typeof database.name==='string').map(database=>new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(database.name);request.onsuccess=()=>resolve(true);request.onerror=()=>reject(new Error(`Could not delete ${database.name}`));request.onblocked=()=>reject(new Error(`Deletion blocked for ${database.name}`))})))).then(()=>done(true)).catch(error=>done({ok:false,message:String(error)}))""")
  if result is not True: self.fail(f'IndexedDB cleanup failed: {result}')
 def reset_browser_state(self):
  self.browser.get(BASE_URL+'/'); self.wait_for_document(); self.js("localStorage.clear();sessionStorage.clear();return true"); self.browser.delete_all_cookies(); self.clear_indexed_db()
  self.browser.get(BASE_URL+'/?e2e=1'); self.wait_for_document(); self.wait_for_build_info(); self.wait_for_game(); self.wait_for_menu_ready()
 def assert_no_fatal_state(self): self.assertFalse(self.js_boolean("return Boolean(window.__NWD_GAME__?.registry?.get('fatalError')??window.__NWD_RUNTIME_DIAGNOSTICS__?.fatalError)"))
 def body(self): return self.browser.find_element('tag name','body')
 def start_first_level(self):
  state=self.get_menu_state(); self.assertEqual(state['selectedIndex'],0); self.assertEqual(state['selectedAction'],'newGame'); self.body().send_keys(Keys.ENTER); self.wait_for_scene('CampaignIntroScene'); self.wait_for_node('campaign-intro'); self.body().send_keys(Keys.ENTER); self.wait_for_scene('LevelScene'); self.wait_for_node('lvl01-esc01-comedor-resistencia'); self.wait_for_gameplay_ready(); self.wait_for_runtime('level_1_comedor_resistencia')
 def advance_level(self,next_node,next_runtime=None):
  moved=self.js("const s=window.__NWD_GAME__.scene.getScene('LevelScene'),p=s.runtime?.player?.sprite,e=s.matter.world.localWorld.bodies.find(b=>b.label?.startsWith('sensor:Exits:'));if(!p||!e)return false;p.setPosition(e.position.x,e.position.y);p.setVelocity(0,0);return true")
  self.assertTrue(moved); self.wait.until(lambda _:self.js_boolean("const scene=window.__NWD_GAME__?.scene?.getScene('LevelScene');return scene?.runtime?.exitReady===true")); self.body().send_keys('e'); self.wait_for_node(next_node)
  if next_runtime: self.wait_for_scene('LevelScene'); self.wait_for_gameplay_ready(); self.wait_for_runtime(next_runtime)
 def test_01_routes_and_build_identity(self):
  status,ctype,_=http_get('/'); self.assertEqual(status,200); self.assertIn('text/html',ctype); build=self.get_build_info(); self.assertEqual(set(build),EXPECTED_KEYS); self.assertTrue(all(isinstance(build[key],str) for key in EXPECTED_KEYS)); self.assertEqual(datetime.fromisoformat(build['builtAt'].replace('Z','+00:00')).isoformat(),datetime.fromisoformat(build['builtAt'].replace('Z','+00:00')).isoformat()); api=self.get_api_build_info(); expected=os.getenv('E2E_EXPECTED_SHA')
  if expected: self.assertEqual(build['sha'],expected); self.assertEqual(api['backendSha'],expected)
  if build['sha']!='unknown' and api['backendSha']!='unknown': self.assertEqual(build['sha'],api['backendSha'])
  (RESULTS/'build-info.json').write_text(json.dumps({'frontend':build,'backend':api},indent=2))
 def test_02_canonical_transitions(self):
  self.start_first_level(); diag=self.get_runtime_diagnostics(); self.assertEqual(diag['physicsEngine'],'matter'); self.assertGreater(diag['matterBodyCount'],0); self.assertTrue(diag['tiledMapPath']); self.assertTrue(diag['currentObjective']); self.advance_level('lvl01-esc02-pasillos-hacia-escaleras-pb','level_1_pasillos_escaleras_pb'); self.advance_level('lvl01-cin01-cierre-contextual'); self.wait_for_scene('CinematicScene'); self.wait_for_scene('LevelScene',False); self.assertEqual(self.get_registry_number('campaignCursor'),3)
 def test_03_reload_returns_to_clean_main_menu(self):
  self.start_first_level(); self.advance_level('lvl01-esc02-pasillos-hacia-escaleras-pb','level_1_pasillos_escaleras_pb'); before=self.get_runtime_diagnostics(); self.assertEqual(before['playerCount'],1); self.assertTrue(before['currentObjective']); self.assertTrue(before['gameplayReady']); self.browser.refresh(); self.wait_for_document(); self.wait_for_build_info(); self.wait_for_game(); self.wait_for_menu_ready(); state=self.get_menu_state(); self.assertEqual(state['selectedIndex'],0); self.assertEqual(state['selectedAction'],'newGame'); self.assertFalse(state['setupVisible']); self.assertFalse(state['canContinue']); self.wait_for_scene('LevelScene',False); self.assert_no_fatal_state(); self.body().send_keys(Keys.ENTER); self.wait_for_scene('CampaignIntroScene'); self.assertEqual(self.get_registry_number('campaignCursor'),0)
if __name__=='__main__': unittest.main(verbosity=2)
