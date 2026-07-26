#!/usr/bin/env python3
"""Truthful browser gate for the first four canonical campaign nodes."""
from __future__ import annotations
import json, os, pathlib, time, unittest, urllib.error, urllib.request
from datetime import datetime, timezone
from PIL import Image, ImageChops
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL=os.getenv('E2E_BASE_URL','http://127.0.0.1:8000').rstrip('/')
ROOT=pathlib.Path(__file__).resolve().parents[1]
RESULTS=ROOT/'test-results'; SHOTS=RESULTS/'screenshots'; BASELINES=ROOT/'e2e'/'visual-baselines'
MANIFEST=BASELINES/'manifest.json'; THRESHOLD=float(os.getenv('VISUAL_THRESHOLD','0.01'))
COMPARE=os.getenv('E2E_VISUAL_COMPARISON','1')=='1'; CANDIDATES=os.getenv('E2E_CAPTURE_CANDIDATES','0')=='1'
FORBIDDEN=('cannot set properties of null','restorephysicstimescale','destination-confirmation-watchdog',
 '[nowaydown] error global de carga','error fatal de transición','missing animation','uncaught','unhandled',
 '404 (not found)','500 (internal server error)','failed to load resource','missing texture')
STATES={
 '01-main-menu.png':('campaign-intro','MainMenuScene','Menú principal listo'),
 '02-new-game-setup.png':('campaign-intro','MainMenuScene','Configuración de nueva partida'),
 '03-campaign-intro.png':('campaign-intro','CampaignIntroScene','Introducción canónica'),
 '04-comedor-resistance.png':('lvl01-esc01-comedor-resistencia','LevelScene','Resistencia activa'),
 '05-comedor-exit-ready.png':('lvl01-esc01-comedor-resistencia','LevelScene','Puerta habilitada'),
 '06-transition-comedor-pasillos.png':('lvl01-esc01-comedor-resistencia','LevelScene','Overlay de transición'),
 '07-pasillos-loaded.png':('lvl01-esc02-pasillos-hacia-escaleras-pb','LevelScene','Pasillos cargados'),
 '08-pasillos-exit-ready.png':('lvl01-esc02-pasillos-hacia-escaleras-pb','LevelScene','Salida de pasillos lista'),
 '09-transition-pasillos-cinematic.png':('lvl01-esc02-pasillos-hacia-escaleras-pb','LevelScene','Overlay hacia cinemática'),
 '10-cierre-contextual-alan.png':('lvl01-cin01-cierre-contextual','CinematicScene','Beat de Alan Nahuel verificado'),
 '11-cierre-contextual-giovanna.png':('lvl01-cin01-cierre-contextual','CinematicScene','Beat de Giovanna verificado')}

def get(path):
 try:
  with urllib.request.urlopen(BASE_URL+path,timeout=20) as r:return r.status,r.headers.get('Content-Type',''),r.read()
 except urllib.error.HTTPError as e:return e.code,e.headers.get('Content-Type',''),e.read()

class ProductionE2E(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  RESULTS.mkdir(exist_ok=True); SHOTS.mkdir(exist_ok=True)
  opts=Options(); opts.add_argument('--headless=new'); opts.add_argument('--no-sandbox'); opts.add_argument('--disable-dev-shm-usage'); opts.add_argument('--window-size=1280,720')
  opts.set_capability('goog:loggingPrefs',{'browser':'ALL','performance':'ALL'})
  cls.browser=webdriver.Chrome(options=opts); cls.wait=WebDriverWait(cls.browser,25); cls.all_logs=[]; cls.network=[]
 @classmethod
 def tearDownClass(cls):
  cls.collect_browser_logs('final'); cls.browser.quit()
  (RESULTS/'browser-console.json').write_text(json.dumps(cls.all_logs,indent=2,ensure_ascii=False))
  (RESULTS/'browser-console.txt').write_text('\n'.join(f"{x['timestamp']} {x['level']} {x['message']}" for x in cls.all_logs) or 'No browser messages.\n')
  (RESULTS/'network.json').write_text(json.dumps(cls.network,indent=2,ensure_ascii=False))
 @classmethod
 def collect_browser_logs(cls,label):
  for e in cls.browser.get_log('browser'):
   item={'test':label,'level':e['level'],'message':e['message'],'timestamp':datetime.fromtimestamp(e['timestamp']/1000,timezone.utc).isoformat(),'url':BASE_URL}
   cls.all_logs.append(item)
  for e in cls.browser.get_log('performance'):
   try:
    m=json.loads(e['message'])['message']
    if m['method']=='Network.responseReceived':
     r=m['params']['response']; cls.network.append({'test':label,'url':r['url'],'status':r['status'],'mimeType':r['mimeType'],'timestamp':m['params'].get('timestamp')})
   except (KeyError,ValueError,TypeError): pass
 def setUp(self): self.reset_browser_state()
 def tearDown(self):
  self.collect_browser_logs(self.id()); bad=[x for x in self.all_logs if x['test']==self.id() and (x['level']=='SEVERE' or any(v in x['message'].lower() for v in FORBIDDEN))]
  self.assertFalse(bad,f'Errores de navegador: {bad}')
  failed=[x for x in self.network if x['test']==self.id() and x['status']>=400]
  self.assertFalse(failed,f'Respuestas de red fallidas: {failed}')
 def js(self,script,*args): return self.browser.execute_script(script,*args)
 def reset_browser_state(self):
  self.browser.get(BASE_URL+'/?e2eResistanceMs=250')
  self.js("localStorage.clear();sessionStorage.clear();indexedDB.databases?.().then(ds=>ds.forEach(d=>indexedDB.deleteDatabase(d.name)))")
  self.browser.get(BASE_URL+'/?e2eResistanceMs=250'); self.wait_for_game(); self.wait_for_scene('MainMenuScene'); self.assert_no_fatal_state()
 def wait_for_game(self): self.wait.until(lambda _:self.js('return !!window.__NWD_GAME__'))
 def wait_for_scene(self,key,active=True): self.wait.until(lambda _:self.js("return window.__NWD_GAME__.scene.isActive(arguments[0])",key)==active)
 def wait_for_node(self,node): self.wait.until(lambda _:self.js("return window.__NWD_GAME__.registry.get('flowNodeId')",)==node)
 def wait_for_registry_value(self,key,value): self.wait.until(lambda _:self.js("return window.__NWD_GAME__.registry.get(arguments[0])",key)==value)
 def assert_no_fatal_state(self): self.assertIsNone(self.js("return window.__NWD_GAME__.registry.get('campaignTransitionFatal')??null"))
 def menu_state(self):
  return self.js("const s=window.__NWD_GAME__.scene.getScene('MainMenuScene');return {active:s.scene.isActive(),selected:s.selectedIndex,setupVisible:s.setupPanel?.visible??false,step:s.setupStep,setupSelected:s.setupSelectedIndex}")
 def capture_state(self,name):
  node,scene,_=STATES[name]; self.assertTrue(self.js("const g=window.__NWD_GAME__;return g.scene.isActive(arguments[1])&&(g.registry.get('flowNodeId')??'campaign-intro')===arguments[0]",node,scene),f'{name} no corresponde a {node}/{scene}')
  # The short SHA is intentionally visible to players but is not a visual regression.
  # Normalize that single technical label; gameplay, HUD, dialogue and overlays remain untouched.
  self.js("const s=window.__NWD_GAME__.scene.getScene('MainMenuScene');for(const x of s?.children?.list??[]){if(typeof x.text==='string'&&/^v[^ ]+ · /.test(x.text))x.setText('vBUILD · BUILD')} ")
  time.sleep(.08); path=SHOTS/name; self.assertTrue(self.browser.save_screenshot(str(path))); self.assertGreater(path.stat().st_size,1000)
  if COMPARE and not CANDIDATES:self.compare_visual(path,name)
 def compare_visual(self,path,name):
  manifest=self.validate_manifest(); entry=next(x for x in manifest if x['filename']==name); baseline=BASELINES/name
  actual,expected=Image.open(path).convert('RGB'),Image.open(baseline).convert('RGB'); self.assertEqual(actual.size,tuple(entry['resolution'])); self.assertEqual(actual.size,expected.size)
  histogram=ImageChops.difference(actual,expected).histogram(); changed=sum(v for i,v in enumerate(histogram) if i%256); ratio=changed/(actual.width*actual.height*3)
  self.assertLessEqual(ratio,float(entry['tolerance']),f'{name}: diferencia {ratio:.3%}')
 def validate_manifest(self):
  self.assertTrue(MANIFEST.exists(),'Falta manifest visual'); data=json.loads(MANIFEST.read_text()); entries=data['baselines']; names=[x['filename'] for x in entries]
  self.assertEqual(len(names),len(set(names))); self.assertEqual(set(names),set(STATES)); self.assertEqual({p.name for p in BASELINES.glob('*.png')},set(names))
  for x in entries:self.assertEqual((x['nodeId'],x['scene']),STATES[x['filename']][:2]); self.assertEqual(x['resolution'],[1280,720])
  return entries
 def body(self): return self.browser.find_element('tag name','body')
 def start_to_comedor(self,capture=False):
  if capture:self.capture_state('01-main-menu.png')
  self.assertEqual(self.menu_state()['selected'],0); self.body().send_keys(Keys.ENTER); self.wait.until(lambda _:self.menu_state()['setupVisible']); self.assertEqual(self.menu_state()['step'],'protagonist')
  if capture:self.capture_state('02-new-game-setup.png')
  self.body().send_keys(Keys.ENTER); self.wait.until(lambda _:self.menu_state()['step']=='difficulty'); self.body().send_keys(Keys.ENTER); self.wait.until(lambda _:self.menu_state()['step']=='party')
  self.body().send_keys(Keys.ARROW_DOWN,Keys.ARROW_DOWN,Keys.ARROW_DOWN); self.assertEqual(self.menu_state()['setupSelected'],3); self.body().send_keys(Keys.ENTER); self.wait.until(lambda _:self.menu_state()['step']=='confirm'); self.body().send_keys(Keys.ENTER)
  self.wait_for_scene('CampaignIntroScene'); self.wait_for_node('campaign-intro');
  if capture:self.capture_state('03-campaign-intro.png')
  self.body().send_keys(Keys.ENTER); self.wait_for_node('lvl01-esc01-comedor-resistencia'); self.wait_for_scene('LevelScene'); self.wait_for_scene('UIScene')
  self.wait.until(lambda _:self.js("const s=window.__NWD_GAME__.scene.getScene('LevelScene');return !!s.gameplayReady&&!!s.players?.[0]&&!!s.resistancePhaseConfig"))
  if capture:self.capture_state('04-comedor-resistance.png')
  self.wait.until(lambda _: 'puerta' in (self.js("return window.__NWD_GAME__.registry.get('currentObjective')??''")).lower())
 def move_player(self,x,y): self.assertTrue(self.js("const s=window.__NWD_GAME__.scene.getScene('LevelScene'),p=s.players?.[0];if(!p?.body)return false;p.setPosition(arguments[0],arguments[1]);p.body.reset(arguments[0],arguments[1]);return true",x,y))
 def reach_pasillos(self,capture=False):
  self.start_to_comedor(capture); r=self.js("const g=window.__NWD_GAME__,r=g.registry;return {create:r.get('levelSceneCreateCount'),shutdown:r.get('levelSceneShutdownCount')??0,cursor:r.get('campaignFlowCursor')} ")
  self.move_player(4900,724)
  if capture:self.capture_state('05-comedor-exit-ready.png')
  self.body().send_keys('e'); self.wait.until(lambda _:self.js("return window.__NWD_GAME__.registry.get('transitionView')?.visible===true"))
  if capture:self.capture_state('06-transition-comedor-pasillos.png')
  self.wait_for_node('lvl01-esc02-pasillos-hacia-escaleras-pb'); self.wait.until(lambda _:self.js("return !!window.__NWD_GAME__.scene.getScene('LevelScene').gameplayReady"))
  state=self.js("const g=window.__NWD_GAME__,s=g.scene.getScene('LevelScene'),r=g.registry,v=r.get('transitionView');return {active:g.scene.isActive('LevelScene'),ui:g.scene.isActive('UIScene'),runtime:r.get('activeRuntimeLevelId'),cursor:r.get('campaignFlowCursor'),pending:r.get('pendingCampaignTransition')??null,pendingNode:r.get('pendingCampaignNodeId')??null,visible:v?.visible??false,paused:s.physics.world.isPaused,ready:s.gameplayReady,fatal:r.get('campaignTransitionFatal')??null,create:r.get('levelSceneCreateCount'),shutdown:r.get('levelSceneShutdownCount')}}")
  self.assertEqual(state,{'active':True,'ui':True,'runtime':'level_1_pasillos_escaleras_pb','cursor':2,'pending':None,'pendingNode':None,'visible':False,'paused':False,'ready':True,'fatal':None,'create':r['create']+1,'shutdown':r['shutdown']+1})
  if capture:self.capture_state('07-pasillos-loaded.png')
 def test_01_routes_and_build_identity(self):
  status,ctype,body=get('/api/build-info/'); self.assertEqual(status,200); self.assertEqual(ctype.split(';')[0],'application/json'); api=json.loads(body); self.assertEqual(api['status'],'ok')
  build=self.js('return window.__NWD_BUILD__'); self.assertEqual(set(build),{'sha','shortSha','builtAt','mode','version'}); expected=os.getenv('E2E_EXPECTED_SHA');
  if expected:self.assertEqual(build['sha'],expected); self.assertEqual(api['backendSha'],expected)
  status,ctype,manifest=get('/assets/campaign/canonical_campaign_manifest.json'); self.assertEqual((status,ctype.split(';')[0]),(200,'application/json')); self.assertEqual(len(json.loads(manifest)['nodes']),35)
 def test_02_canonical_transitions_and_visuals(self):
  self.reach_pasillos(True); self.move_player(5300,724); self.capture_state('08-pasillos-exit-ready.png'); self.body().send_keys('e'); self.wait.until(lambda _:self.js("return window.__NWD_GAME__.registry.get('transitionView')?.visible===true")); self.capture_state('09-transition-pasillos-cinematic.png')
  self.wait_for_node('lvl01-cin01-cierre-contextual'); self.wait_for_scene('CinematicScene'); self.wait_for_scene('LevelScene',False)
  state=self.js("const g=window.__NWD_GAME__,r=g.registry;return {cursor:r.get('campaignFlowCursor'),pending:r.get('pendingCampaignTransition')??null,pendingNode:r.get('pendingCampaignNodeId')??null,visible:r.get('transitionView')?.visible??false,fatal:r.get('campaignTransitionFatal')??null}")
  self.assertEqual(state,{'cursor':3,'pending':None,'pendingNode':None,'visible':False,'fatal':None})
  text=self.js("return window.__NWD_GAME__.scene.getScene('CinematicScene').children.list.filter(x=>x.text).map(x=>x.text).join('\\n')")
  alan='La resistencia ganó el tiempo necesario. El comedor queda atrás.'; gio='Los pasillos están despejados; el grupo toma la escalera hacia Planta Baja.'
  self.assertIn(alan,text); self.assertIn(gio,text); self.assertLess(text.index(alan),text.index(gio)); self.capture_state('10-cierre-contextual-alan.png'); self.capture_state('11-cierre-contextual-giovanna.png')
 def test_03_continue_restores_pasillos_without_duplication(self):
  self.reach_pasillos(False); before=self.js("const r=window.__NWD_GAME__.registry;return {party:(r.get('partyState')??[]).length,hud:(r.get('partyHud')??[]).length,objective:r.get('currentObjective'),save:localStorage.length}"); self.assertGreater(before['save'],0)
  self.browser.refresh(); self.wait_for_game(); self.wait_for_scene('MainMenuScene'); self.body().send_keys(Keys.ARROW_RIGHT,Keys.ENTER); self.wait_for_node('lvl01-esc02-pasillos-hacia-escaleras-pb'); self.wait_for_scene('LevelScene')
  after=self.js("const r=window.__NWD_GAME__.registry;return {node:r.get('flowNodeId'),party:(r.get('partyState')??[]).length,hud:(r.get('partyHud')??[]).length,objective:r.get('currentObjective')}"); self.assertEqual(after['node'],'lvl01-esc02-pasillos-hacia-escaleras-pb'); self.assertEqual(after['party'],before['party']); self.assertLessEqual(after['hud'],before['party'])
if __name__=='__main__': unittest.main(verbosity=2)
