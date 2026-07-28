# Inventario de fondos existentes

Dimensiones leídas de headers/metadatos existentes, sin reescritura. Todos son binarios preexistentes, aprobados para runtime, no `editorOnly`, con blur deshabilitado.

| path | formato / dimensiones | ubicación / nivel compatible | referencia | crop / parallax / tint | uso |
|---|---|---|---|---|---|
| public/subsoil.jpg | JPEG · 760×480 | subsuelo / comedor | foto | ancho, .04 / cálido | activo |
| public/stairs.jpg | JPEG · 960×1280 | escaleras / pasillos y descenso | foto | vertical diferenciado, .08–.10 / ámbar | activo reutilizado por el mismo núcleo espacial |
| public/ground-floor.jpg | JPEG · 1600×739 | hall PB | foto | central, .05 / neutro | activo |
| public/ground-floor-reconquista-sector.jpg | JPEG · 750×422 | sector Reconquista / segundo y oficina 422 | foto | crops .12 y .34; .07–.09 / cálido | activo reutilizado con encuadre y midground distintos |
| public/ground-floor-25may-sector.jpg | JPEG · 750×422 | sector 25 de Mayo / tercero y salidas | foto | crops .03 y .20; .06 / cálido | activo reutilizado con foreground distinto |
| public/ground-floor-rivadavia-sector.jpg | JPEG · 750×422 | sector Rivadavia / comedor cuarto | foto | .10,.14,.82,.76 / .05 / cálido | activo |
| public/entrance.jpg | JPEG · 1152×1152 | acceso / pertenencias quinto | foto | .16,.05,.76,.90 / .08 / ámbar | activo |
| public/outside.jpg | JPEG · 1280×960 | exterior urbano | foto | cover / .05 / neutro | reservado |
| public/outside-scene.jpg | JPEG · 1280×960 | exterior narrativo | foto | contain / .03 / neutro | reservado |

`EnvironmentSystem` carga únicamente el asset principal del nivel actual. La arquitectura SVG repetida se retiró de los diez perfiles; `AuthoredLevelEnvironmentRenderer` queda conservado como fallback estable, no como composición principal. `TiledVisualRenderer`, mapas TMJ y catálogo se conservan; visual-v2 se simplifica al actor/UI y la iluminación elimina elipses.
