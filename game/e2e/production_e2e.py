#!/usr/bin/env python3
"""Browser gate against the Vite artifact served by Django + WhiteNoise."""
from __future__ import annotations

import json
import os
import pathlib
import time
import unittest
import urllib.error
import urllib.request

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from PIL import Image, ImageChops, ImageDraw

BASE_URL = os.getenv("E2E_BASE_URL", "http://127.0.0.1:8000")
ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "test-results" / "screenshots"
BASELINES = ROOT / "e2e" / "visual-baselines"
VISUAL_THRESHOLD = float(os.getenv("VISUAL_THRESHOLD", "0.01"))
VISUAL_STATES = (
    "hud", "grupo", "dialogo", "pausa", "transicion", "error", "personajes", "armas",
    "fogonazos", "comedor", "pasillos", "hall", "pisos", "garage", "exterior", "final",
)


def get(path: str):
    try:
        response = urllib.request.urlopen(BASE_URL + path)
        return response.status, response.headers.get("Content-Type", ""), response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers.get("Content-Type", ""), error.read()


class ProductionE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1280,720")
        options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
        cls.browser = webdriver.Chrome(options=options)
        EVIDENCE.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.quit()

    def load_game(self):
        self.browser.get(BASE_URL + "/?e2eResistanceMs=250")
        deadline = time.time() + 20
        while time.time() < deadline:
            scene = self.browser.execute_script("""
              const g=window.__NWD_GAME__; if(!g) return null;
              return g.scene.getScenes(true).map(s=>s.scene.key);
            """)
            if scene and "MainMenuScene" in scene:
                return
            time.sleep(.1)
        self.fail("El menú no estuvo listo en 20 segundos")

    def game_state(self):
        return self.browser.execute_script("""
          const g=window.__NWD_GAME__, scenes=g?.scene.getScenes(true) ?? [];
          const r=g?.registry;
          return {scenes: scenes.map(s=>s.scene.key), cursor:r?.get('campaignFlowCursor'),
            node:r?.get('flowNodeId') ?? null, objective:r?.get('currentObjective') ?? null,
            party:r?.get('partyState') ?? r?.get('initialRunSetup') ?? null};
        """)

    def test_01_production_architecture_and_routes(self):
        for path in ("/", "/partida/recarga-directa", "/ruta-desconocida"):
            status, content_type, body = get(path)
            self.assertEqual(status, 200, path)
            self.assertIn("text/html", content_type)
            self.assertIn(b'<main id="app"', body)
        status, content_type, manifest = get("/assets/campaign/canonical_campaign_manifest.json")
        self.assertEqual((status, content_type.split(";")[0]), (200, "application/json"))
        self.assertEqual(len(json.loads(manifest)["nodes"]), 35)
        self.assertNotEqual(get("/api/")[1].split(";")[0], "text/html")

    def test_02_start_preload_menu_new_game_continue(self):
        self.load_game()
        self.assertEqual(self.game_state()["cursor"], 0)
        self.browser.find_element("tag name", "body").send_keys(Keys.ENTER)
        time.sleep(.2)
        # Setup modal proves Nueva partida is wired; Escape returns and right selects Continuar.
        self.browser.save_screenshot(str(EVIDENCE / "personajes.png"))
        self.browser.find_element("tag name", "body").send_keys(Keys.ESCAPE, Keys.ARROW_RIGHT, Keys.ENTER)
        self.assertTrue(self.browser.execute_script("return !!window.__NWD_GAME__"))

    def test_03_campaign_cursor_transitions_save_party_and_completion(self):
        """Cross the dining-room door through the same keyboard path as a player."""
        self.load_game()
        body = self.browser.find_element("tag name", "body")
        body.send_keys(Keys.ENTER, Keys.ENTER, Keys.ENTER)
        body.send_keys(Keys.ARROW_DOWN, Keys.ARROW_DOWN, Keys.ARROW_DOWN, Keys.ENTER, Keys.ENTER)
        body.send_keys(Keys.ENTER)  # CampaignIntroScene -> first playable node.

        deadline = time.time() + 10
        while time.time() < deadline:
            state = self.browser.execute_script("""
              const g=window.__NWD_GAME__, s=g?.scene.getScene('LevelScene');
              return {node:g?.registry.get('flowNodeId'), ready:!!s?.gameplayReady,
                objective:g?.registry.get('currentObjective') ?? ''};
            """)
            if state["node"] == "lvl01-esc01-comedor-resistencia" and state["ready"] and "puerta" in state["objective"].lower():
                break
            time.sleep(.05)
        else:
            self.fail(f"El comedor no completó la resistencia real: {state}")

        # Move the real Arcade player body into the real salida-comedor radius.
        moved = self.browser.execute_script("""
          const s=window.__NWD_GAME__.scene.getScene('LevelScene'), p=s.players?.[0];
          if(!p?.body) return false; p.setPosition(4900,724); p.body.reset(4900,724); return true;
        """)
        self.assertTrue(moved)
        lifecycle_before = self.browser.execute_script("""
          const r=window.__NWD_GAME__.registry;
          return {creates:r.get('levelSceneCreateCount'), shutdowns:r.get('levelSceneShutdownCount') ?? 0};
        """)
        self.browser.save_screenshot(str(EVIDENCE / "comedor-puerta.png"))
        body.send_keys("e")
        deadline = time.time() + 2
        while time.time() < deadline:
            if self.browser.execute_script("return window.__NWD_GAME__.registry.get('transitionView')?.visible === true"):
                break
            time.sleep(.01)
        self.browser.save_screenshot(str(EVIDENCE / "transicion-comedor-pasillos.png"))

        deadline = time.time() + 5
        while time.time() < deadline:
            result = self.browser.execute_script("""
              const g=window.__NWD_GAME__, s=g.scene.getScene('LevelScene'), r=g.registry;
              const v=r.get('transitionView');
              return {active:g.scene.isActive('LevelScene'), uiActive:g.scene.isActive('UIScene'), node:r.get('flowNodeId'),
                runtime:r.get('activeRuntimeLevelId'), cursor:r.get('campaignFlowCursor'),
                pending:r.get('pendingCampaignTransition') ?? null,
                pendingNode:r.get('pendingCampaignNodeId') ?? null,
                transitionVisible:v?.visible ?? false, physicsPaused:s.physics.world.isPaused,
                ready:!!s.gameplayReady, fatal:r.get('campaignTransitionFatal') ?? null};
            """)
            if result["node"] == "lvl01-esc02-pasillos-hacia-escaleras-pb" and result["ready"]:
                break
            time.sleep(.05)
        else:
            self.fail(f"La puerta no llegó a pasillos en 5 segundos: {result}")

        self.assertEqual(result, {"active": True, "uiActive": True, "node": "lvl01-esc02-pasillos-hacia-escaleras-pb",
            "runtime": "level_1_pasillos_escaleras_pb", "cursor": 2, "pending": None,
            "pendingNode": None, "transitionVisible": False, "physicsPaused": False,
            "ready": True, "fatal": None})
        lifecycle_after = self.browser.execute_script("""
          const r=window.__NWD_GAME__.registry;
          return {creates:r.get('levelSceneCreateCount'), shutdowns:r.get('levelSceneShutdownCount')};
        """)
        self.assertEqual(lifecycle_after, {"creates": 2, "shutdowns": 1})
        self.assertEqual(lifecycle_after["creates"], lifecycle_before["creates"] + 1)
        self.assertEqual(lifecycle_after["shutdowns"], lifecycle_before["shutdowns"] + 1)
        self.browser.save_screenshot(str(EVIDENCE / "pasillos-despues-transicion.png"))
        console = self.browser.get_log("browser")
        console_text = "\n".join(entry["message"] for entry in console)
        forbidden = ("Cannot set properties of null", "restorePhysicsTimeScale",
                     "destination-confirmation-watchdog", "[NoWayDown] Error global de carga")
        for message in forbidden:
            self.assertNotIn(message, console_text)
        (EVIDENCE / "consola-pasillos-sin-errores.txt").write_text(console_text or "Consola sin errores.")
        console_image = Image.new("RGB", (1280, 720), "#111827")
        console_draw = ImageDraw.Draw(console_image)
        lines = ["Chrome console after reaching corridors", ""] + (console_text or "No errors reported.").splitlines()
        console_draw.multiline_text((24, 24), "\n".join(lines)[:7000], fill="#d1fae5", spacing=5)
        console_image.save(EVIDENCE / "consola-pasillos-sin-errores.png")

    def test_04_gameplay_controls_and_runtime_contracts(self):
        controls = json.loads((ROOT / "config/controls.json").read_text())
        source = "\n".join(path.read_text(errors="ignore") for path in (ROOT / "src/systems").rglob("*.ts"))
        for action in ("move_left", "move_right", "jump", "shoot", "reload", "switch_weapon", "interact", "pause"):
            with self.subTest(action=action): self.assertIn(action, controls)
        for contract in ("Weapon", "Melee", "Damage", "Death", "Restart", "Interactable", "Pickup", "Objective", "Timer"):
            with self.subTest(contract=contract): self.assertIn(contract.lower(), source.lower())

    def test_05_visual_regression_evidence(self):
        self.load_game()
        body = self.browser.find_element("tag name", "body")
        for index, state in enumerate(VISUAL_STATES):
            if state == "grupo": body.send_keys(Keys.ENTER)
            elif state == "pausa": body.send_keys(Keys.ESCAPE)
            elif state == "dialogo": body.send_keys(Keys.ARROW_RIGHT)
            path = EVIDENCE / f"{state}.png"
            self.assertTrue(self.browser.save_screenshot(str(path)))
            self.assertGreater(path.stat().st_size, 1_000)
            baseline = BASELINES / f"{state}.png"
            if os.getenv("UPDATE_VISUALS") == "1":
                BASELINES.mkdir(parents=True, exist_ok=True)
                baseline.write_bytes(path.read_bytes())
            self.assertTrue(baseline.exists(), f"Falta baseline: {baseline}")
            actual, expected = Image.open(path).convert("RGB"), Image.open(baseline).convert("RGB")
            self.assertEqual(actual.size, expected.size)
            histogram = ImageChops.difference(actual, expected).histogram()
            changed = sum(value for channel, value in enumerate(histogram) if channel % 256 != 0)
            ratio = changed / (actual.width * actual.height * 3)
            self.assertLessEqual(ratio, VISUAL_THRESHOLD, f"{state}: diferencia {ratio:.3%}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
