# QA manual: midgame y fondos

Abrir `/?qaCampaign=1`. El banner confirma el namespace no persistente. Usar selectores, PageUp/PageDown, Home/End, R y Escape. No se generaron capturas; la revisión visual final debe hacerse en el deploy.

Para **comedor, pasillos, hall, segundo, tercero, cuarto, quinto, oficina 422, descenso y subsuelo 3**, verificar: fondo concreto y ubicación reconocible; objetivo; grupo separado; zombis según matriz; movimiento y cámara; exit e interacción; transición canónica; HUD dentro de límites; ausencia de círculo gigante, fondos repetidos y errores de consola.

## Descenso
1. Seleccionar `lvl08-esc01-descenso-con-temporizador`: debe iniciar 3:00 y pausarse con pausa/diálogo.
2. Llegar a `accion-escalera-subsuelo-3` antes de cero y usar E: estado `won`, objetivo una vez, exit listo y transición a `lvl08-cin01-damian-infectado-y-suicidio`.
3. Dejar vencer: estado `lost`, salida bloqueada y cursor intacto; reiniciar restaura 3:00.
4. Consultar `window.__NWD_LEVEL_DIAGNOSTICS__`; sólo debe contener JSON plano.

Limitación: fondos root `/public` dependen del montaje estático del deploy; `visualFallbackUsed` hace visible cualquier deuda de resolución, sin afirmar renovación cuando falla.
