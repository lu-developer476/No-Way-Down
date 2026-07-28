#!/usr/bin/env python3
"""Text-only browser smoke for the canonical intro -> hall route."""
import json
import os
import shutil
import sys
import time

chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
driver = shutil.which("chromedriver")
if not chrome or not driver:
    print(json.dumps({"status":"LIMITATION","reason":"Chrome and ChromeDriver must already be installed; nothing was downloaded.","chrome":bool(chrome),"driver":bool(driver)}))
    sys.exit(2)

try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.keys import Keys
except ImportError:
    print(json.dumps({"status":"LIMITATION","reason":"Selenium is not installed; nothing was downloaded."}))
    sys.exit(2)

url=os.environ.get("NWD_E2E_URL","http://127.0.0.1:4173/?e2eMode=1&e2eResistanceMs=250")
options=Options();options.binary_location=chrome;options.add_argument("--headless=new");options.add_argument("--no-sandbox")
browser=webdriver.Chrome(options=options)
report=[]
def state(): return browser.execute_script("return window.__NWD_PROGRESSION_STATE__ || null")
def wait_for(predicate,label,timeout=12):
    end=time.time()+timeout
    while time.time()<end:
        value=state()
        if value and predicate(value): report.append({"check":label,"state":value});return value
        time.sleep(.05)
    raise AssertionError(f"timeout: {label}; last={state()}")
def press(key,times=1):
    body=browser.find_element("tag name","body")
    for _ in range(times): body.send_keys(key);time.sleep(.08)
try:
    browser.get(url); press(Keys.ENTER); time.sleep(.3); press(Keys.ENTER); press(Keys.SPACE,8)
    dining_state=wait_for(lambda s:s["nodeId"]=="lvl01-esc01-comedor-resistencia" and s["gameplayReady"],"dining ready")
    assert dining_state["playerCanMove"] and dining_state["currentObjective"] and dining_state["exitInsideBounds"]
    before=dining_state["resistanceRemainingMs"];time.sleep(.12);after=state()["resistanceRemainingMs"];assert after<before
    wait_for(lambda s:s["resistanceCompleted"] and s["exitEnabled"],"resistance completed")
    browser.execute_script("const s=window.__NWD_GAME__.scene.getScene('LevelScene');s.children.getAll().find(o=>o.body&&o.texture)?.setPosition(arguments[0],arguments[1])",dining_state["exitX"],dining_state["exitY"])
    press("e");press(Keys.ENTER)
    corridor=wait_for(lambda s:s["nodeId"]=="lvl01-esc02-pasillos-hacia-escaleras-pb","corridors ready")
    assert corridor["runtimeWidth"]==5600 and corridor["playerCanMove"] and corridor["exitInsideBounds"] and corridor["fatalTransition"] is None
    browser.execute_script("const s=window.__NWD_GAME__.scene.getScene('LevelScene');s.children.getAll().find(o=>o.body&&o.texture)?.setPosition(arguments[0],arguments[1])",corridor["exitX"],corridor["exitY"])
    press("e");press(Keys.ENTER);time.sleep(.4)
    assert browser.execute_script("return window.__NWD_GAME__.scene.isActive('CinematicScene') && !window.__NWD_GAME__.scene.isActive('LevelScene')")
    press(Keys.SPACE,20)
    hall_state=wait_for(lambda s:s["nodeId"]=="lvl02-esc01-hall-planta-baja" and s["gameplayReady"],"hall ready")
    assert hall_state["playerExists"] and hall_state["playerCanMove"] and hall_state["currentObjective"] and hall_state["fatalTransition"] is None
    print(json.dumps({"status":"PASS","checks":report},ensure_ascii=False))
finally:
    browser.quit()
