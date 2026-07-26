# Gate E2E de producción

## Ejecución

```bash
pip install -r backend/requirements.txt -r game/e2e/requirements.txt
npm ci --prefix game
UPDATE_VISUALS=1 npm run test:e2e:production --prefix game
npm run test:e2e:production --prefix game
```

El comando compila Vite en `game/dist`, migra la base de prueba, levanta Django con
WhiteNoise y navega el artefacto con Chrome headless. No usa `vite preview`. El segundo
pase compara cada captura RGB con el baseline del primer pase y falla por encima de 1%.
Los logs, el reporte `unittest` y las 16 capturas quedan en `game/test-results`; CI los
publica siempre como el artefacto `production-e2e-evidence`.

## Cobertura y criterios de bloqueo

El audit previo al build valida JSON, 35 IDs únicos y ordenados, assets declarados como
implementados, vínculo `nodeId`/`nextNodeId`, ausencia de una segunda
`campaign_flow.json` y ausencia de IDs legacy. La suite de navegador prueba arranque,
precarga, menú, nueva partida/continuar, cursor, avance, reinicio, transiciones en ambas
direcciones, confirmación manual/automática, lock de transición, persistencia, grupo,
final de campaña, controles y contratos de gameplay. También comprueba `/assets/...`,
JSON, API relativa, recarga profunda, ruta desconocida y que `/api/` no caiga al SPA.

Estados visuales: HUD, grupo, diálogo, pausa, transición, error, personajes, armas,
fogonazos, comedor, pasillos, hall, pisos, garage, exterior y final.

## Los 35 nodos canónicos

| # | ID | tipo |
|---:|---|---|
| 1 | `campaign-intro` | campaignIntro |
| 2 | `lvl01-esc01-comedor-resistencia` | level |
| 3 | `lvl01-esc02-pasillos-hacia-escaleras-pb` | level |
| 4 | `lvl01-cin01-cierre-contextual` | cinematic |
| 5 | `lvl02-esc01-hall-planta-baja` | level |
| 6 | `lvl02-cin01-ascenso-al-segundo-piso` | cinematic |
| 7 | `lvl03-esc01-segundo-piso` | level |
| 8 | `lvl03-cin01-llamado-lorena-rescate` | cinematic |
| 9 | `lvl04-esc01-tercer-piso` | level |
| 10 | `lvl04-cin01-rescate-lorena-en-oficina-422` | cinematic |
| 11 | `lvl04-cin02-llamada-selene-y-descenso` | cinematic |
| 12 | `lvl05-esc01-cuarto-piso-comedor` | level |
| 13 | `lvl05-cin01-descenso-al-quinto-piso` | cinematic |
| 14 | `lvl06-esc01-quinto-piso-pertenencias` | level |
| 15 | `lvl06-cin01-reencuentro-y-salida-e` | cinematic |
| 16 | `lvl06-cin02-muerte-lorena-y-guardia-en-salida-e` | cinematic |
| 17 | `lvl07-esc01-oficina-422-rescate` | level |
| 18 | `lvl07-cin01-inicio-del-descenso` | cinematic |
| 19 | `lvl08-esc01-descenso-con-temporizador` | level |
| 20 | `lvl08-cin01-damian-infectado-y-suicidio` | cinematic |
| 21 | `lvl08-cin02-sacrificio-hernan-yamil` | cinematic |
| 22 | `lvl08-cin03-caida-final-del-duo` | cinematic |
| 23 | `lvl09-esc01-verificacion-salidas` | level |
| 24 | `lvl09-cin01-hallazgo-salida-y-mordida-selene` | cinematic |
| 25 | `lvl09-cin02-traicion-de-selene-y-huida` | cinematic |
| 26 | `lvl10-esc01-garage-busqueda-vehiculo` | level |
| 27 | `lvl10-cin01-hallazgo-del-vehiculo` | cinematic |
| 28 | `lvl10-esc02-resistencia-en-garage` | level |
| 29 | `lvl10-cin02-salida-del-garage` | cinematic |
| 30 | `lvl10-cin01-traslado-silencioso-plaza-de-mayo` | cinematic |
| 31 | `lvl10-esc01-combate-50-bajas-en-via-publica` | level |
| 32 | `lvl10-cin02-cierre-duo-final-en-san-telmo` | cinematic |
| 33 | `lvl10-esc03-llegada-a-san-telmo` | level |
| 34 | `lvl10-cin03-desenlace-abierto` | cinematic |
| 35 | `campaign-end` | cinematic |

La tabla se verifica contra `canonical_campaign_manifest.json`; el manifiesto es la única
fuente ejecutable. Los cuatro tests canónicos existentes recorren 1–9, 10–18, 19–27 y
28–35 y cubren los detalles de objetivos, temporizadores, grupo y final.

## Errores encontrados y corregidos

* No existía un gate de navegador contra Django/WhiteNoise: se agregó el job bloqueante.
* No había evidencia capturada ni umbral de píxeles: se generan 16 PNG y se exige ≤1%.
* El juego no ofrecía una superficie observable al runner: se expone únicamente la
  instancia Phaser, sin comandos privilegiados ni bypass de gameplay.

## Limitación reproducible

La imagen de desarrollo usada para preparar este cambio no incluye Chrome/ChromeDriver
y su proxy devuelve HTTP 403 al intentar instalar paquetes. Por eso aquí se ejecutaron
los audits, tests unitarios y build, pero el comando Selenium queda marcado como limitado;
el workflow instala Chrome de forma explícita y es quien produce las capturas y el reporte
requeridos antes de permitir merge/deploy.
