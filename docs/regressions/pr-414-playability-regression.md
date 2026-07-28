# Regresión de jugabilidad del PR #414

## Causa y alcance

`GameScene` daba prioridad a `LevelWorldDefinition.worldWidth/worldHeight` sobre la geometría del runtime. El comedor pasó de **5200 × 864** a un mundo visual de **2240 × 900**, aunque conservó spawn `(240, 724)`, áreas de resistencia hasta `x=4150` y salida `(4900, 724)`. Pasillos pasó de **5600 × 864** a **2240 × 900**, conservando la salida `(5300, 724)`. Física y cámara quedaban recortadas antes de ambas salidas.

Los archivos involucrados son `GameScene.ts`, `campaignWorldDefinitions.ts`, `WorldConnectorSystem.ts`, `WorldDiagnostics.ts`, `UIScene.ts` y `auditCampaignWorld.mjs`. La composición visual generada (`Array.from({ length: 24 })`) es presentación repetitiva, no geometría autoral ni fuente válida de gameplay.

## Sistemas declarados pero no integrados

* `WorldConnectorSystem` sólo buscaba el conector visual más cercano; sus IDs no resolvían los interactables/exits reales y `WorldDiagnostics` publicaba siempre `activeConnectorId: null`.
* `StairTraversalSystem` era actualizado sin que ninguna zona/input invocara un inicio de recorrido. Se desactivó su instanciación: las escaleras que representan una salida siguen usando la interacción canónica y el descenso interno queda pendiente de una integración posterior verificable.
* `LevelTopologySystem` describe superficies, pero no crea cuerpos de física. No se usa como autoridad de colisiones.
* Visual V2 agregaba un segundo chrome por encima del HUD normal.

## Corrección

La geometría resuelta ahora procede siempre de `levelConfig.layout`: ancho, alto, piso, bounds de física, bounds de cámara, spawn, objetivos e interacciones permanecen en coordenadas runtime. Una discrepancia visual se registra y la presentación recibe los bounds runtime; nunca mueve silenciosamente una salida. El diagnóstico distingue la discrepancia declarada y publica dimensiones visuales ya adaptadas (`worldWidthMismatch/worldHeightMismatch` son falsos).

Los conectores de salida se construyen desde la interacción y el exit existentes, conservando el único camino de input **E -> InteractableSystem -> ObjectiveSystem -> CampaignTransitionCoordinator**. El conector se habilita al completar la resistencia, y el cursor sólo se confirma cuando la escena destino carga. La resistencia mantiene 45 segundos y la fixture explícita de E2E puede reducirla a 250 ms; la finalización es idempotente y habilita la segunda zona/objetivo una vez.

`UIScene` conserva solamente el HUD normal compacto. Se agregó un estado de progresión de sólo lectura, disponible exclusivamente en DEV/E2E, y auditorías que parsean el manifiesto, wrappers y runtimes JSON reales.

## Pruebas y limitaciones

Se añadieron pruebas ejecutables de geometría runtime, reloj de resistencia, interacción y mapping de conectores, además de un smoke textual sin captura. Las auditorías validan bounds, asociaciones de salida y reachability horizontal por la superficie de piso compartida. La composición visual genérica se conserva como capa no física; no se afirma que sea arte autoral. El traversal interno de escaleras y el descenso temporizado no se validan en este hotfix y requieren una tarea posterior.
