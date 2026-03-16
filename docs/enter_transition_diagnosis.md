# Diagnóstico: ENTER en “Confirmar y comenzar” no inicia la campaña

## Resumen ejecutivo
El flujo sí ejecuta `confirmSetupAndStart()`, pero **no cambia de escena** porque `SceneFlowManager.startFromBeginning()` devuelve `undefined` cuando no hay definición de campaña cargada en el `registry`.

La definición se intenta cargar en `AssetPreloadScene` desde `assets/campaign/campaign_flow.json`, pero en producción (y también local con esta configuración de Vite) ese archivo no está dentro del `publicDir` efectivo, por lo que no se sirve y no llega al cache JSON.

## Hallazgos clave

1. `AssetPreloadScene` precarga `campaign_flow` desde `assets/campaign/campaign_flow.json` y en `create()` hace:
   - `const definition = this.cache.json.get('campaign_flow')`
   - `manager.loadDefinition(definition)`
   - `this.scene.start('MainMenuScene')`

   Si el JSON no cargó, `definition` es `undefined`.

2. `SceneFlowManager.loadDefinition` guarda lo que recibe en el registro sin validar.
   - Si recibe `undefined`, deja `campaignFlowDefinition` en estado inválido.

3. Al confirmar en menú (`MainMenuScene.confirmSetupAndStart`):
   - crea `SceneFlowManager`
   - llama `startFromBeginning()`
   - este método devuelve `undefined` si no hay definición o no hay nodos.
   - la transición sólo ocurre dentro de `if (firstNode) { transitionToNode(firstNode); }`

   Resultado: no hay transición y parece que ENTER “no hace nada”.

4. `vite.config.ts` está configurado con `publicDir: '../public'`.
   - Eso apunta al directorio `public/` de la raíz del repo.
   - Allí sólo hay imágenes y favicon.
   - Los JSON de campaña están realmente en `game/public/assets/...`.

5. Ubicación física de JSON de campaña:
   - `assets/campaign/campaign_flow.json`
   - `assets/dialogues/campaign_intro_dialogue.json`
   - `assets/cinematics/drive_to_santelmo.json`

## Causa raíz
**Desalineación entre rutas de assets y `publicDir` de Vite**:
- El código carga `assets/...` esperando que esos archivos estén en el directorio público servido por Vite.
- Pero Vite está sirviendo `../public` (raíz), mientras los JSON están en `game/public`.
- Por eso los JSON de campaña no se cargan, la definición del flujo queda ausente y el menú no puede avanzar a ninguna escena al confirmar.

## Nota adicional
Las imágenes de menú sí funcionan porque existen en `public/images` (raíz), que coincide con el `publicDir` actual. Esto puede ocultar el problema hasta el momento de iniciar campaña.
