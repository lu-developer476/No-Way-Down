"""Canvas-only playability check. It creates no media."""
import os, time
from selenium import webdriver
from selenium.webdriver.common.keys import Keys

URL=os.environ.get('NWD_BASE_URL','http://127.0.0.1:8000')
driver=webdriver.Chrome()
try:
    driver.set_window_size(1280,800); driver.get(URL)
    def snapshot():
        return driver.execute_script("""const g=window.__NWD_GAME__; if(!g)return null; const active=g.scene.getScenes(true).map(s=>s.scene.key); return {active,fatal:g.registry.get('fatalError')??null,setup:g.registry.get('initialRunSetup')??null,party:g.registry.get('partyHud')??[],zombies:g.registry.get('zombiesRemaining'),objective:g.registry.get('currentObjective'),ready:g.registry.get('gameplayReady')};""")
    end=time.time()+15
    while time.time()<end and (not snapshot() or 'MainMenuScene' not in snapshot()['active']): time.sleep(.2)
    assert 'MainMenuScene' in snapshot()['active']
    body=driver.find_element('tag name','body'); body.send_keys(Keys.ENTER)
    # Alan, Complejo, toggle Celestino, finish party, confirm.
    for key in [Keys.ENTER,Keys.ENTER,Keys.ENTER,Keys.END,Keys.ENTER,Keys.ENTER]: body.send_keys(key); time.sleep(.15)
    end=time.time()+30
    while time.time()<end and 'LevelScene' not in snapshot()['active']: body.send_keys(Keys.SPACE); time.sleep(.3)
    state=snapshot(); assert state['fatal'] is None; assert state['setup']['protagonist']=='alan'; assert state['setup']['difficulty']=='complejo'
    assert 'LevelScene' in state['active']; assert state['ready']; assert state['party']; assert state['zombies'] is not None; assert state['objective']
finally:
    driver.quit()
