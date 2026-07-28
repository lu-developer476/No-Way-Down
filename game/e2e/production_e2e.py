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
  self.results.append({'test':label,'passed':not bad_logs and not bad_network}); self.assertFalse(bad_logs); self.assertFalse(bad_network); self.assert_no_fatal_state()
 def js(self,script,*args): return self.browser.execute_script(script,*args)
 def wait_for_document(self): self.wait.until(lambda _:self.js("return document.readyState")=='complete')
 def wait_for_build_info(self): self.wait.until(lambda _:isinstance(self.get_build_info(),dict))
 def wait_for_game(self): self.wait.until(lambda _:bool(self.js('return window.__NWD_GAME__')))
 def wait_for_scene(self,key,active=True): self.wait.until(lambda _:self.js("return window.__NWD_GAME__.scene.isActive(arguments[0])",key)==active)
 def wait_for_menu_ready(self): self.wait_for_scene('MainMenuScene'); self.wait.until(lambda _:self.get_menu_state().get('ready') is True)
 def wait_for_registry(self,key,value): self.wait.until(lambda _:self.js("return window.__NWD_GAME__.registry.get(arguments[0])",key)==value)
 def wait_for_node(self,node): self.wait.until(lambda _:self.js("return window.__NWD_GAME__.registry.get('activeCampaignNode')?.id??null")==node)
 def wait_for_runtime(self,runtime): self.wait.until(lambda _:self.js("return window.__NWD_RUNTIME_DIAGNOSTICS__?.runtimeLevelId??null")==runtime)
 def wait_for_gameplay_ready(self): self.wait.until(lambda _:self.js("return window.__NWD_RUNTIME_DIAGNOSTICS__?.gameplayReady===true"))
 def get_menu_state(self): return self.js("return window.__NWD_GAME__?.registry.get('mainMenuState')??null") or {}
 def get_build_info(self): return self.js('return window.__NWD_BUILD__??null')
 def get_api_build_info(self):
  status,ctype,body=http_get('/api/build-info/'); self.assertEqual(status,200); self.assertEqual(ctype.split(';')[0],'application/json'); return json.loads(body)
 def reset_browser_state(self):
  self.browser.get(BASE_URL+'/'); self.wait_for_document(); self.js("localStorage.clear();sessionStorage.clear();document.cookie.split(';').forEach(v=>document.cookie=v.split('=')[0]+'=;Max-Age=0;path=/');return indexedDB.databases?.().then(ds=>Promise.all(ds.map(d=>d.name&&indexedDB.deleteDatabase(d.name))))")
  self.browser.get(BASE_URL+'/?e2e=1'); self.wait_for_document(); self.wait_for_build_info(); self.wait_for_game(); self.wait_for_menu_ready()
 def assert_no_fatal_state(self): self.assertFalse(self.js("return window.__NWD_GAME__?.registry.get('fatalError')??window.__NWD_RUNTIME_DIAGNOSTICS__?.fatalError??null"))
 def body(self): return self.browser.find_element('tag name','body')
 def start_first_level(self):
  state=self.get_menu_state(); self.assertEqual(state['selectedIndex'],0); self.assertEqual(state['selectedAction'],'newGame'); self.body().send_keys(Keys.ENTER); self.wait_for_scene('CampaignIntroScene'); self.wait_for_node('campaign-intro'); self.body().send_keys(Keys.ENTER); self.wait_for_scene('LevelScene'); self.wait_for_node('lvl01-esc01-comedor-resistencia'); self.wait_for_gameplay_ready(); self.wait_for_runtime('level_1_comedor_resistencia')
 def advance_level(self,next_node,next_runtime=None):
  moved=self.js("const s=window.__NWD_GAME__.scene.getScene('LevelScene'),p=s.runtime?.player?.sprite,e=s.matter.world.localWorld.bodies.find(b=>b.label?.startsWith('sensor:Exits:'));if(!p||!e)return false;p.setPosition(e.position.x,e.position.y);p.setVelocity(0,0);return true")
  self.assertTrue(moved); self.wait.until(lambda _:self.js("return window.__NWD_GAME__.scene.getScene('LevelScene').runtime?.exitReady===true")); self.body().send_keys('e'); self.wait_for_node(next_node)
  if next_runtime: self.wait_for_scene('LevelScene'); self.wait_for_gameplay_ready(); self.wait_for_runtime(next_runtime)
 def test_01_routes_and_build_identity(self):
  status,ctype,_=http_get('/'); self.assertEqual(status,200); self.assertIn('text/html',ctype); build=self.get_build_info(); self.assertEqual(set(build),EXPECTED_KEYS); self.assertTrue(all(isinstance(build[key],str) for key in EXPECTED_KEYS)); self.assertEqual(datetime.fromisoformat(build['builtAt'].replace('Z','+00:00')).isoformat(),datetime.fromisoformat(build['builtAt'].replace('Z','+00:00')).isoformat()); api=self.get_api_build_info(); expected=os.getenv('E2E_EXPECTED_SHA')
  if expected: self.assertEqual(build['sha'],expected); self.assertEqual(api['backendSha'],expected)
  if build['sha']!='unknown' and api['backendSha']!='unknown': self.assertEqual(build['sha'],api['backendSha'])
  (RESULTS/'build-info.json').write_text(json.dumps({'frontend':build,'backend':api},indent=2))
 def test_02_canonical_transitions(self):
  self.start_first_level(); diag=self.js('return window.__NWD_RUNTIME_DIAGNOSTICS__'); self.assertEqual(diag['physicsEngine'],'matter'); self.assertGreater(diag['matterBodyCount'],0); self.assertTrue(diag['tiledMapPath']); self.assertTrue(diag['currentObjective']); self.advance_level('lvl01-esc02-pasillos-hacia-escaleras-pb','level_1_pasillos_escaleras_pb'); self.advance_level('lvl01-cin01-cierre-contextual'); self.wait_for_scene('CinematicScene'); self.wait_for_scene('LevelScene',False); self.assertEqual(self.js("return window.__NWD_GAME__.registry.get('campaignCursor')"),3)
 def test_03_continue_session_is_autonomous(self):
  self.start_first_level(); self.advance_level('lvl01-esc02-pasillos-hacia-escaleras-pb','level_1_pasillos_escaleras_pb'); before=self.js("const d=window.__NWD_RUNTIME_DIAGNOSTICS__;return {players:d.playerCount,objective:d.currentObjective,node:d.nodeId,ready:d.gameplayReady}"); self.assertEqual(before['players'],1); self.assertTrue(before['objective']); self.browser.refresh(); self.wait_for_document(); self.wait_for_build_info(); self.wait_for_game(); self.wait_for_menu_ready(); self.assertEqual(self.get_menu_state()['selectedIndex'],0); self.body().send_keys(Keys.ENTER); self.wait_for_scene('CampaignIntroScene'); self.assertEqual(self.js("return window.__NWD_GAME__.registry.get('campaignCursor')"),0)
if __name__=='__main__': unittest.main(verbosity=2)
