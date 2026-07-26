# Diagnóstico del bloqueo comedor → pasillos

## Punto de corte observado antes del cambio

La puerta recorría `InteractableSystem.tryInteract` → `GameScene.applyInteractionEffect` →
`beginExitTransition` y dejaba `hasTriggeredTransition=true`, `pendingExitTarget` y el overlay
visibles. A continuación `triggerLevelExitTransition` pausaba las físicas y la única ruta
automática quedaba registrada en `this.time.delayedCall(900, ...)`. El commit canónico
(`LevelScene.completeExitTransition` → `advanceFromNodeId` → `transitionToNode`) sólo se
invocaba desde ese callback o desde el sondeo de ENTER en `LevelScene.update`. Por tanto, al
no despacharse el callback del reloj de la escena desplegada, la cadena terminaba antes de
`completeExitTransition`; no existían `pendingCampaignTransition` ni resultado booleano de
`transitionToNode`. La condición concreta era `hasTriggeredTransition === true` junto con
un `exitTransitionTimer` pendiente perteneciente a la misma `LevelScene` cuyo gameplay ya
había sido bloqueado.

## Arquitectura corregida

`CampaignTransitionCoordinator.requestCanonicalTransition(currentNodeId, reason,
spawnPoint)` resuelve exclusivamente con `SceneFlowManager.advanceFromNodeId`, valida y
realiza el commit en el mismo evento de interacción. `LevelExitSystem` ya no posee un timer
ni inicia escenas. Los cambios LevelScene → LevelScene usan `restart`, y el destino sólo
confirma el pending después de cargar config/runtime, crear sistemas y marcar gameplay
ready. Un `window.setTimeout` independiente de Phaser emite un fatal con snapshot a los 5
segundos si falta la confirmación.

## Trazas esperadas después del cambio

Los logs `[CampaignTransitionCoordinator]` registran `resolve-next:after`, `commit:before`,
`commit:after`, `destination-confirm:before` y `destination-confirm:after`, incluyendo
scene key, nodo, cursor, active/pending, estado de LevelScene, físicas, overlay y el booleano
de `transitionToNode`. El E2E de producción conserva capturas de la puerta del comedor, la
presentación de transición y los pasillos, y comprueba además un SHUTDOWN/create adicional.
El manifiesto no fue editado: conserva sus 35 nodos y su orden.
