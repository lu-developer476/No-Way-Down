#!/usr/bin/env python3
"""Sharded, manifest-derived canonical campaign browser certification."""
from __future__ import annotations
import json, os, pathlib, unittest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
ROOT=pathlib.Path(__file__).resolve().parents[1]
MANIFEST=json.loads((ROOT/'public/assets/campaign/canonical_campaign_manifest.json').read_text())
SHARDS=((0,9),(9,18),(18,27),(27,35)); SHARD=int(os.getenv('E2E_CAMPAIGN_SHARD','0')); BASE=os.getenv('E2E_BASE_URL','http://127.0.0.1:8000').rstrip('/')
class FullCampaignE2E(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  o=Options(); o.add_argument('--headless=new'); o.add_argument('--no-sandbox'); o.add_argument('--disable-dev-shm-usage'); cls.browser=webdriver.Chrome(options=o); cls.wait=WebDriverWait(cls.browser,30); cls.browser.get(BASE+'/?e2e=1'); cls.wait.until(lambda _:cls.browser.execute_script('return Boolean(window.__NWD_E2E__)'))
 @classmethod
 def tearDownClass(cls):cls.browser.quit()
 def bridge(self,name,*args):return self.browser.execute_script('return window.__NWD_E2E__[arguments[0]](...arguments[1])',name,list(args))
 def test_manifest_shard(self):
  self.assertEqual(MANIFEST['flowId'],'main_campaign'); self.assertEqual(len(MANIFEST['nodes']),35); start,end=SHARDS[SHARD]
  for index,node in enumerate(MANIFEST['nodes'][start:end],start):
   with self.subTest(canonicalIndex=index,nodeId=node['id']):
    result=self.bridge('loadCanonicalNodeForQa',node['id']); self.assertTrue(result.get('ok'),result)
    snap=self.wait.until(lambda _: (lambda s:s if s['nodeId']==node['id'] and not s['transitionInProgress'] else None)(self.bridge('getRuntimeSnapshot')))
    self.assertEqual(snap['canonicalIndex'],index); self.assertEqual(snap['nodeType'],node['type']); self.assertEqual(snap['sceneKey'],node['sceneKey']); self.assertEqual(snap['physicsEngine'],'arcade'); self.assertFalse(snap['fatalError'])
    if node['type']=='level': self.assertTrue(snap['runtimeConfigPath'])
    if node['type']=='cinematic': self.assertTrue(node.get('cinematicPath')); self.assertTrue(self.bridge('advanceCinematic').get('ok'))
if __name__=='__main__':unittest.main(verbosity=2)
