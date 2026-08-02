#!/usr/bin/env python3
"""Text-only production gate. All game control uses the query-gated flat bridge."""
from __future__ import annotations
import json, os, pathlib, re, unittest, urllib.request
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL=os.getenv('E2E_BASE_URL','http://127.0.0.1:8000').rstrip('/')
RESULTS=pathlib.Path(__file__).resolve().parents[1]/'test-results'
def get(path):
 with urllib.request.urlopen(BASE_URL+path,timeout=30) as r:return r.status,r.headers,r.read()

class ProductionE2E(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  RESULTS.mkdir(exist_ok=True); o=Options(); o.add_argument('--headless=new'); o.add_argument('--no-sandbox'); o.add_argument('--disable-dev-shm-usage'); o.set_capability('goog:loggingPrefs',{'browser':'ALL'})
  cls.browser=webdriver.Chrome(options=o); cls.wait=WebDriverWait(cls.browser,30); cls.report=[]
 @classmethod
 def tearDownClass(cls):
  (RESULTS/'production-e2e.json').write_text(json.dumps(cls.report,indent=2)); cls.browser.quit()
 def setUp(self):
  self.browser.get(BASE_URL+'/?e2e=1'); self.wait.until(lambda _:self.js('return document.readyState')=='complete'); self.wait.until(lambda _:self.js('return Boolean(window.__NWD_E2E__)')); self.bridge('clearAllLocalData')
 def tearDown(self):
  severe=[x for x in self.browser.get_log('browser') if x['level']=='SEVERE']; self.report.append({'test':self.id(),'severe':severe}); self.assertFalse(severe)
 def js(self,source,*args):return self.browser.execute_script(source,*args)
 def bridge(self,method,*args):return self.js('return window.__NWD_E2E__[arguments[0]](...arguments[1])',method,list(args))
 def wait_runtime(self,predicate):return self.wait.until(lambda _:predicate(self.bridge('getRuntimeSnapshot')))
 def test_01_deploy_identity(self):
  status,headers,html=get('/'); self.assertEqual(status,200); api=json.loads(get('/api/build-info/')[2]); artifact=json.loads(get('/build-info.json')[2]); build=self.js('return {...window.__NWD_BUILD__}')
  expected=os.getenv('E2E_EXPECTED_SHA'); self.assertEqual(artifact,build); self.assertEqual(api['sourceSha'],artifact['sourceSha']); self.assertEqual(api['frontendSha'],artifact['frontendSha'])
  self.assertRegex(api['deployCommit'],r'^[0-9a-f]{40}$'); self.assertTrue(api['repositoryProvider']);
  if expected:self.assertEqual(expected,api['sourceSha'])
  header=headers.get('X-NWD-Source-SHA'); self.assertTrue(header is None or header==api['sourceSha'])
 def test_02_essential_assets(self):
  _,_,html=get('/'); urls=[u.decode() for u in re.findall(rb'(?:src|href)="(/[^"]+)"',html)]
  urls += ['/assets/campaign/canonical_campaign_manifest.json','/assets/levels/level1_comedor_resistencia.json','/assets/images/NWD-characters.png']
  for url in dict.fromkeys(urls):
   status,_,body=get(url); self.assertEqual(status,200,url); self.assertTrue(body,url)
 def test_03_menu_and_navigation(self):
  state=self.bridge('getMenuSnapshot'); self.assertTrue(state['ready']); self.assertEqual(state['selectedAction'],'newGame')
  body=self.browser.find_element('tag name','body'); body.send_keys(Keys.ARROW_RIGHT); self.wait.until(lambda _:self.bridge('getMenuSnapshot')['selectedAction']=='continue'); body.send_keys(Keys.ARROW_RIGHT,Keys.ENTER,Keys.ESCAPE)
  self.assertEqual(self.bridge('getMenuSnapshot')['selectedAction'],'options')
 def test_04_new_game_setup(self):
  setup={'protagonist':'giovanna','difficulty':'pesadilla','party':{'required':['Alan Nahuel','Giovanna','Damián','Nahir'],'optional':['Celestino']},'startedAt':'2026-01-01T00:00:00.000Z','version':1}
  result=self.bridge('startNewGame',setup); self.assertTrue(result['ok']); stored=self.js("return JSON.parse(localStorage.getItem('nwd.setup.initial'))"); self.assertEqual(stored,setup)
 def test_05_first_level_is_arcade(self):
  setup={'protagonist':'alan','difficulty':'complejo','party':{'required':['Alan Nahuel','Giovanna','Damián','Nahir'],'optional':[]},'startedAt':'2026-01-01T00:00:00.000Z','version':1}
  self.bridge('startNewGame',setup); self.wait_runtime(lambda x:x['nodeId']=='campaign-intro'); self.browser.find_element('tag name','body').send_keys(Keys.ENTER); diag=self.wait_runtime(lambda x:x['nodeId']=='lvl01-esc01-comedor-resistencia'); self.assertEqual(diag['physicsEngine'],'arcade'); self.assertFalse(diag['fatalError'])
 def test_06_continue_and_corrupt_save(self):
  self.js("localStorage.setItem('nwd.progress.local-player','{bad json')"); self.browser.refresh(); self.wait.until(lambda _:self.js('return Boolean(window.__NWD_E2E__)')); self.assertFalse(self.bridge('getMenuSnapshot')['canContinue'])
  self.js("localStorage.setItem('nwd.progress.local-player',JSON.stringify({schemaVersion:999,current_level:'LevelScene',checkpoint:'10,20'}))"); self.browser.refresh(); self.wait.until(lambda _:self.js('return Boolean(window.__NWD_E2E__)')); self.assertFalse(self.bridge('getMenuSnapshot')['canContinue'])
 def test_07_new_game_preserves_completion_history(self):
  completion={'schemaVersion':1,'campaignId':'no_way_down','completed':True,'completedAt':'2026-01-01T00:00:00Z','protagonistId':'alan','difficultyId':'complejo','finalNodeId':'campaign-end','canonicalNodeCount':35,'buildSha':'test'}
  self.js("localStorage.setItem('nwd.campaign.completion',JSON.stringify(arguments[0]));localStorage.setItem('nwd.progress.local-player','old')",completion); self.bridge('resetActiveRun'); self.assertEqual(self.js("return JSON.parse(localStorage.getItem('nwd.campaign.completion'))"),completion); self.assertIsNone(self.js("return localStorage.getItem('nwd.progress.local-player')"))
if __name__=='__main__':unittest.main(verbosity=2)
