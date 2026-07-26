# Dirección visual Phaser — visual-v2

## Propósito y alcance

`level_1_pasillos_escaleras_pb` es el benchmark visual de la campaña. `visualGeneration: "v2"` activa exclusivamente su presentación; el gameplay, el orden canónico comedor → pasillos → cierre y los otros niveles continúan usando `legacy`.

## Lenguaje visual

Pixel art moderno de alta densidad, lateral y de proporción humana semi-realista. La base fría y desaturada (azules petróleo, hormigón húmedo y metal) conserva información dentro de las sombras; amarillo de señalética/fogonazo y rojo de emergencia son acentos pequeños. La suciedad, grietas, sangre y humedad se agrupan en focos, nunca como ruido uniforme. Silueta, arma y amenaza dominan sobre decoración.

La escena se compone en diez bandas: fondo distante, estructura, arquitectura trasera, decoración trasera, plano jugable, props, actores, partículas, primer plano e iluminación. Ventanas profundas, marcos, cañerías, bancos, reflejos húmedos, oclusores y parallax aportan profundidad sin impedir leer enemigos.

## Escala y píxel perfecto

La resolución lógica permanece en **960×540**. Los actores se dibujan en marcos de **48×96 px** a escala 1; puertas, mobiliario y armas usan esta unidad humana. Phaser conserva `pixelArt`, antialias desactivado y `roundPixels`; assets SVG usan geometría alineada a enteros y rasterización nítida y la cámara evita coordenadas subpíxel. FIT conserva 16:9; se prefiere múltiplo entero cuando el viewport lo permite. No se usa blur ni escalas porcentuales arbitrarias.

## Actores, armas y feedback

Alan mantiene cabello gris/blanco, barba sugerida, ropa oscura y amarillo; Giovanna, cabello oscuro y magenta rojizo. Sus contratos incluyen idle, carrera, apuntado, disparo, recarga, daño, melee, derribo e interacción, además de offsets centralizados para manos, boca, casquillo, nombre, vida y sombra. Guardia/trabajador, civil e infectado avanzado comparten gameplay y difieren por postura, ropa, piel y heridas. El atlas original de FX separa núcleo blanco, llama amarilla/naranja, humo y tracer.

## Luz, accesibilidad y rendimiento

`InstitutionalLightingSystem` combina ambiente, volúmenes fríos, emergencia parpadeante y luces temporales; no depende de un velo negro uniforme. Sombras de contacto acompañan actores y se destruyen con el sistema. Las opciones `reduceShake`, `reduceFlashes` y `reduceParticles` son el contrato de integración con preferencias existentes; texto y símbolos redundan información cromática.

Presupuestos máximos: 18 casquillos, 24 impactos, 18 manchas, 48 partículas, 8 luces temporales, 8 cuerpos y 24 decals. Sistemas asignan objetos en `create`, actualizan sin recrear luces/sombras por frame y limpian timers, objetos y colecciones en `shutdown`.

## Diagnóstico y migración

En desarrollo/E2E, `?visualDebug=1` (con `e2eMode`) muestra escala, zoom, FPS, sprites, partículas, luces, decals, draw calls disponibles, generación, nodeId y runtimeLevelId. El manifiesto documenta cada SVG textual original generado por `scripts/generate_visual_v2.py`; `npm run audit:visual-v2` valida rutas, grillas, animaciones, aislamiento y presupuestos. Migrar otro nodo exige revisión visual y agregar explícitamente su configuración: nunca una query pública.
