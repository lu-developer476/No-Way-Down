# Gate de producción Phaser

## Alcance real

El gate abre el artefacto Vite servido por Django/WhiteNoise y recorre por teclado **solamente** menú, configuración, `campaign-intro`, comedor, resistencia, `salida-comedor`, pasillos, `salida-pasillos` y `lvl01-cin01-cierre-contextual`. Comprueba una transición `LevelScene → LevelScene`, una `LevelScene → CinematicScene`, sus contadores/cursor/pending, y los dos textos canónicos en orden. Un caso aislado recarga y usa **Continuar** desde pasillos.

No cubre mediante navegador hall, otros pisos, garage, exterior, final ni la campaña completa. `auditCanonicalCampaign.mjs` sigue auditando estáticamente los 35 nodos; eso no equivale a navegarlos.

## Identidad y evidencia

Vite publica `window.__NWD_BUILD__` (SHA completo, corto, UTC de build, modo y versión). El menú sólo muestra versión y SHA corto. `/api/build-info/` publica la identidad no sensible del backend; Render usa `RENDER_GIT_COMMIT`, con fallback a Git y finalmente `unknown`. En un deploy único ambos SHA deben coincidir.

Cada ejecución guarda en `game/test-results`: las once capturas verificadas, consola JSON/TXT, respuestas de red, reporte E2E, log Django, build info y diferencias visuales. Actions publica `production-e2e-evidence-<sha>` incluso ante fallo.

## Ejecución local y Render

```bash
npm ci --prefix game
pip install -r backend/requirements.txt -r game/e2e/requirements.txt
npm run test:e2e:production --prefix game
```

El workflow manual **Render production smoke** acepta `baseUrl`, `expectedSha` y `runVisualComparison`. También puede ejecutarse sin servidor, migraciones ni escrituras backend:

```bash
E2E_BASE_URL=https://no-way-down.onrender.com E2E_EXPECTED_SHA=<sha> \
  bash game/scripts/runProductionSmoke.sh
```

El perfil se limpia antes de cada caso. El smoke externo sólo usa el guardado local del navegador.

## Baselines revisadas

El gate normal jamás genera ni modifica referencias y no reconoce `UPDATE_VISUALS`. Valida correspondencia exacta entre PNG y `manifest.json` (nombre, nodo, escena y 1280×720) antes de comparar.

Para proponer cambios se ejecuta manualmente **Generate visual baseline candidates**. Este genera capturas y reporte diff únicamente como artifact; no escribe las referencias, no commitea, no abre PR y no vuelve verde una diferencia. Se descargan, revisan y versionan mediante un PR explícito.

Sólo se estabiliza lógicamente el estado y se oculta variabilidad inherente del cursor headless; HUD, objetivos, personajes, escenario, overlays, diálogos y errores no se enmascaran. La comparación puede diferir por rasterización/fuentes entre plataformas; por eso el gate fija Chrome y resolución, y declara tolerancia por captura.
