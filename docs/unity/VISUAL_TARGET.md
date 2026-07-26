# No Way Down — objetivo visual HDRP

## 1. Propósito, alcance y estado

Este documento es la dirección visual obligatoria para una futura implementación 3D de **No Way Down** en Unity HDRP. No reemplaza la fuente de verdad narrativa ni agrega escenas a la campaña. Los **35 nodos**, su orden y sus consecuencias permanecen definidos exclusivamente por `game/public/assets/campaign/canonical_campaign_manifest.json`.

El repositorio contiene actualmente un juego funcional 2D en Phaser. Por lo tanto, este documento y `unity/Config/hdrp-quality-profiles.json` constituyen una **especificación verificable**, no una afirmación de que ya exista un build HDRP, una escena terminada o paridad gráfica con las referencias. La adopción de Unity debe hacerse en una rama/milestone de migración explícito y mantener una correspondencia uno a uno con el manifiesto canónico.

### Plataforma y objetivo base

- **Render pipeline:** High Definition Render Pipeline (HDRP); no URP.
- **Plataforma inicial:** Windows x64; no preparar ni publicar WebGL.
- **Objetivo de rendimiento:** 1920 × 1080, 60 FPS, perfil **High**, GPU moderna de gama media.
- **Cámara:** primera persona, escala humana realista.
- **Escalado futuro:** reservar integración para DLSS, FSR o equivalente; no asumir que está disponible en la primera entrega.

## 2. Lectura de las referencias adjuntas

Las dos referencias comunican una presentación de horror de supervivencia realista, oscura y cinematográfica. La imagen más panorámica enfatiza profundidad mediante capas de penumbra, fuentes prácticas aisladas, agua que captura reflejos estrechos, niebla baja y un haz de linterna que recorta el recorrido. La segunda enfatiza una composición de primera persona: arma y manos ocupan el primer plano inferior, mientras arquitectura, tuberías, mobiliario, desperdicios y daños construyen una lectura densa en los planos medio y lejano.

De ambas se toma como referencia:

- calidad gráfica y densidad de detalle;
- iluminación indirecta oscura, luces prácticas y acentos de emergencia;
- materiales envejecidos, húmedos, sucios y físicamente plausibles;
- profundidad atmosférica por niebla, partículas y haces visibles;
- reflejos controlados que describen el agua sin convertir todo el piso en un espejo;
- composición de primera persona y presentación detallada de manos, arma y linterna;
- decadencia ambiental legible: daño, óxido, polvo, basura, escombros y abandono;
- contraste cinematográfico, visibilidad limitada y tensión claustrofóbica.

Se ignora de forma absoluta todo texto, logo, título, nombre, fecha, URL, interfaz, objetivo escrito, cartel de proyecto o nombre de estudio presente en las referencias. También se ignora su ambientación concreta de estación o túnel de metro. No se copiarán distribución, señalética, arquitectura, utilería ni encuadres de un escenario específico.

## 3. Identidad canónica que debe conservarse

La dirección se aplica únicamente a los espacios canónicos de Buenos Aires: banco, comedor, pasillos, oficinas, escaleras, distintos pisos, garage, vía pública, Plaza de Mayo y San Telmo. La arquitectura, utilería y señalética deben partir de investigación del Banco de la Nación Argentina y de los barrios canónicos, nunca del transporte subterráneo sugerido por las referencias.

El benchmark visual descrito más adelante es una escena técnica aislada. **No es un nodo 36, no es un nivel y no puede enlazarse al flujo narrativo.** Sus objetos deberán llevar una etiqueta/capa de benchmark y quedar fuera del registro de campaña y de los builds narrativos de producción.

## 4. Lenguaje visual

### Paleta y color grading

| Función | Rango orientativo | Uso |
| --- | --- | --- |
| Base fría | azul petróleo, gris acero, verde grisáceo desaturado | ambiente, hormigón, sombras y luz indirecta |
| Neutros | carbón, grafito, cemento y blanco envejecido | arquitectura bancaria, polvo y lectura material |
| Cálidos | ámbar/tungsteno apagado | lámparas prácticas, refugio momentáneo y puntos de orientación |
| Alerta | rojo profundo y restringido | emergencia, peligro y ritmo visual; nunca bañar toda la escena |
| Orgánicos | marrones oscuros y tonos de piel naturales | manos, madera, cuero y suciedad |

El grading debe mantener negros densos sin aplastar toda la información. Se limita la saturación general y se preserva saturación selectiva en piel, fuego, tungsteno y emergencia. La imagen no debe adoptar un tinte azul uniforme.

### Exposición y contraste

- Usar exposición física y unidades fotométricas consistentes; documentar cámara, EV objetivo y luminancia de cada familia de luminarias.
- Calibrar primero en **High** a 1080p. Las zonas transitables deben conservar siluetas y obstáculos esenciales aun cuando el fondo desaparezca en sombra.
- Permitir adaptación gradual al entrar o salir de zonas oscuras, con límites estrechos para evitar bombeo de exposición.
- Reservar blancos intensos para linterna, ventanas o prácticas puntuales. Evitar clipping extenso y negros sin detalle funcional.
- Las cinemáticas pueden usar ajustes de exposición dedicados; gameplay debe privilegiar lectura y consistencia.

### Niebla, partículas y aire

- Activar Volumetric Fog global con densidad baja/moderada y distancia acotada al espacio jugable.
- Usar Local Volumetric Fog para bolsillos de humedad, polvo o humo, no como relleno uniforme.
- Los haces deben aparecer solo cuando una fuente y la concentración de partículas lo justifican.
- Partículas: polvo suspendido lento en interiores secos, microgotas cerca de filtraciones, vapor junto a tuberías y residuos ligeros en exterior.
- Reducir resolución, distancia y cantidad de volúmenes por perfil antes de eliminar por completo la atmósfera.

### Humedad, agua y reflejos

- Separar material de piso base, zonas húmedas, charcos con profundidad aparente, bordes de evaporación y marcas de escurrimiento.
- Modular roughness y normal; humedad no equivale a `smoothness = 1` en toda superficie.
- SSR debe resolver reflejos próximos y dinámicos. Reflection Probes cubren información estable fuera de pantalla; ubicar probes por recinto, con blending y box projection cuando corresponda.
- Evitar solapamientos innecesarios y fugas de probes entre pisos. Los charcos importantes se validan desde la altura real de cámara.
- La lluvia o filtración requiere origen, recorrido y acumulación creíbles.

### Materiales PBR y deterioro

Cada material final debe tener escala texel consistente y mapas adecuados (base color, normal, mask/metallic, AO y height cuando aporte). La suciedad se construye por capas y por causa:

- paredes: pintura descascarada, yeso expuesto, humedad ascendente, hongos localizados y golpes;
- metales: metal base correcto, óxido en uniones y bordes, grasa cerca de mecanismos;
- vidrio: polvo, huellas, manchas y roturas con espesor/fragmentación creíbles;
- madera y cuero: desgaste en zonas de contacto, variación de roughness y bordes dañados;
- pisos: tránsito, polvo desplazado, agua acumulada y residuos en encuentros;
- decals: impactos, grietas, goteos, rozaduras y suciedad, con atlas y límites de superposición.

No hornear iluminación o reflejos falsos en el base color. No usar ruido procedural indiscriminado para simular detalle.

### Iluminación HDRP

- Combinar baked lighting para arquitectura estable, mixed lighting para prácticas relevantes y luces dinámicas solo donde gameplay o destrucción lo exijan.
- Usar HDRP Global Settings y HDRP Quality Settings explícitos por perfil.
- Emplear Light Probes para objetos dinámicos; usar Adaptive Probe Volumes en interiores complejos y transiciones entre recintos cuando la versión de HDRP elegida y el presupuesto lo permitan.
- Añadir Reflection Probes por espacios lógicos, no una sonda global que atraviese pisos.
- Linterna dinámica con cookie suave, temperatura coherente, alcance jugable limitado y sombras; debe revelar material y niebla sin blanquear la escena.
- Luces de emergencia rojas o ámbar funcionan como acento, orientación y contraste. Su parpadeo debe ser deliberado, accesible y de baja frecuencia.
- Ambient occlusion refuerza contactos, no sustituye iluminación. Bloom, film grain y vignette serán moderados. Motion blur es opcional y desactivable. Depth of field se prohíbe durante gameplay y se reserva a cinemáticas.

## 5. Densidad y composición ambiental

La densidad se construye en tres escalas:

1. **Macro:** silueta del recinto, rutas, columnas, puertas, desniveles y masa de mobiliario.
2. **Meso:** tuberías, bandejas, cables, armarios, mesas, luminarias, escombros y acumulaciones.
3. **Micro:** decals, tornillos, bordes gastados, polvo, papeles, gotas y fragmentos.

Debe existir una jerarquía clara: ruta primaria, amenaza o interacción, y detalle secundario. No cubrir entradas, pickups o siluetas enemigas con clutter. Reutilizar kits modulares con variaciones de material y daño, aplicar instancing y combinar elementos estáticos compatibles. Toda acumulación debe contar algo del banco y sus ocupantes sin introducir texto narrativo no aprobado.

## 6. Cámara, manos, armas y HUD

### Cámara

- Altura de ojos y velocidad basadas en escala humana; colisiones y puertas deben respetar esa métrica.
- FOV configurable y separado del FOV del arma para evitar deformación extrema.
- Head bob y sway mínimos, parametrizables y desactivables. Evitar sacudida constante.
- Motion blur desactivado por defecto en Low/Medium y configurable en High/Ultra.
- DOF únicamente en cinemáticas y nunca para ocultar problemas de LOD o iluminación.

### Manos, arma y linterna

- Modelo provisional permitido en greybox/benchmark, claramente etiquetado como temporal.
- Calidad final: anatomía y proporción realistas, rig dedicado, animaciones de respiración, locomoción, recarga e interacción; materiales de piel, tela, cuero, metal y polímero diferenciados.
- El arma debe ocupar el primer plano inferior sin bloquear el punto de interés ni parecer flotante. Validar clipping contra paredes, sombras, muzzle flash, casquillos y respuesta a la linterna.
- No copiar diseños identificables de las referencias; usar diseños licenciados o propios.

### HUD

HUD minimalista y diegético cuando sea viable. Mostrar solo información necesaria (estado, munición, interacción y objetivo contextual), con safe area, escalado a resoluciones comunes y opciones de accesibilidad. No reproducir tipografía, iconos, composición ni textos de las referencias.

## 7. Benchmark visual 10 × 10 m

Crear una escena técnica independiente, aproximadamente **10 × 10 metros**, que demuestre en un único recorrido corto:

- paredes deterioradas y decals de daño/desgaste;
- piso mojado, charcos y reflejos controlados;
- tuberías, cables y mobiliario bancario abandonado;
- basura y escombros con densidad jerarquizada;
- niebla volumétrica global/local y partículas ambientales;
- una luz práctica de emergencia y contraste frío/cálido;
- linterna dinámica;
- arma provisional en primera persona;
- volumen de posprocesado HDRP.

La escena debe incluir una cámara de medición reproducible, marcadores de inicio/fin, superposición de métricas solo en Development Build y capturas comparables. No debe contener arquitectura de metro ni texto procedente de las referencias.

## 8. Etapas y criterios de salida

### 1. Greybox funcional

Primero construir comedor y pasillos con métricas, colisiones, rutas, puertas, encuentros, interacción y luz funcional. Se permiten primitivas y materiales simples. **No** se evalúa fidelidad final ni se publicitan capturas como calidad objetivo.

Criterio de salida: recorrido completo, escala aprobada, navegación/gameplay válido y correspondencia con los nodos canónicos aplicables.

### 2. Visual benchmark

Construir la zona técnica 10 × 10 m. Puede usar un arma temporal, pero requiere al menos un kit material representativo, iluminación HDRP, agua, decals, volúmenes y medición.

Criterio de salida: funciona en los cuatro perfiles, produce capturas desde cámaras fijadas y entrega frame timing/GPU timing de un build Windows x64.

### 3. Vertical slice con assets

Aplicar el lenguaje aprobado a una porción canónica del comedor/pasillos con modelos, UVs, materiales, animación, audio y VFX de calidad de producción. Sustituir las primitivas visibles y temporales críticas.

Criterio de salida: revisión artística, revisión de canon, recorrido sin assets provisionales visibles en el encuadre aprobado y 60 FPS objetivo en High.

### 4. Producción final

Expandir el kit validado al banco, pisos, garage y exteriores canónicos; crear LODs, lightmaps, probes, streaming/occlusion y presupuestos por escena.

Criterio de salida: validación integral de los 35 nodos, builds Windows repetibles, capturas reales, perfiles auditados y rendimiento medido en hardware objetivo.

## 9. Perfiles de calidad y presupuesto

Los valores iniciales versionados están en `unity/Config/hdrp-quality-profiles.json`. Son presupuestos de partida que deben trasladarse a HDRP Render Pipeline Assets, Volume Profiles y Quality Settings durante la creación del proyecto Unity; los cambios se justifican con captura y medición.

| Perfil | Intención | Volumetría | SSR / probes | Sombras | Post |
| --- | --- | --- | --- | --- | --- |
| Low | GPU por debajo del objetivo | baja resolución y 32 m | SSR apagado, probes horneadas | 1 cascada, 40 m | AO bajo; bloom/grain/vignette off |
| Medium | compromiso estable | media, 48 m | SSR medio + probes | 2 cascadas, 60 m | AO y bloom moderados |
| High | objetivo 1080p60 | alta, 64 m | SSR alto + probes | 3 cascadas, 80 m | AO, bloom, grain y vignette moderados |
| Ultra | hardware superior/captura | alta, 80 m | SSR ultra + probes | 4 cascadas, 100 m | incrementos controlados, no máximos ciegos |

Presupuestos de referencia para **High**: 16,67 ms totales; procurar ≤ 13,5 ms GPU en escena benchmark para dejar margen de CPU/variabilidad, luces dinámicas solapadas limitadas, decals agrupados y volumetría contenida. Medir percentiles y frametime, no solo FPS promedio.

## 10. Configuración y validación HDRP

Al materializar el proyecto Unity:

1. Fijar una versión Unity LTS compatible y la versión HDRP correspondiente en `Packages/manifest.json`; no mezclar versiones mayores.
2. Crear HDRP Global Settings y un HDRP Render Pipeline Asset por perfil Low/Medium/High/Ultra.
3. Asociarlos en Project Settings > Quality y establecer High como objetivo de desarrollo, sin eliminar los restantes.
4. Configurar Windows x86_64, Direct3D 12 preferente con fallback validado si el proyecto lo requiere, color space Linear y builds Development/Release separados.
5. Crear Volume Profiles compartidos por perfil y overrides locales por escena. Mantener DOF fuera del volumen de gameplay.
6. Hornear lightmaps/probes de la escena de prueba, validar mixed lights, Reflection Probes, Light Probes/APV y escenarios de linterna.
7. Capturar Render Graph/Profiler, CPU/GPU frame timings, memoria, draw calls, triángulos, luces y decals visibles.

### Evidencia obligatoria antes de declarar paridad

Está prohibido afirmar que se alcanzó la calidad de las referencias basándose solo en primitivas, mockups o vistas del editor. La declaración requiere simultáneamente:

- modelos y materiales apropiados (sin placeholders visibles);
- iluminación final y bake validado;
- capturas reales de Game View y del build, identificadas con commit y perfil;
- medición de FPS y frame time en hardware documentado;
- validación en un build Windows x64 reproducible.

Una revisión visual también debe comprobar que no se incorporaron textos, logos, interfaces, nombres ni escenarios específicos de las imágenes de referencia.


## Estado de activación HDRP (2026-07-26)

El repositorio ahora contiene la solicitud de paquete HDRP y herramientas deterministas para generar perfiles, volúmenes, materiales provisionales y benchmark. Como no hubo Unity Editor en el entorno, los assets no fueron generados ni inspeccionados y no existe evidencia de paridad visual, pipeline activo, materiales sin errores o rendimiento. Consultar `HDRP_MIGRATION.md` y `UNITY_VALIDATION_REPORT.md` antes de interpretar esta dirección como implementación validada.
