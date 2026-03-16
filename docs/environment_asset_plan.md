# Plan unificado de assets de entorno (inspiración arquitectónica BNA)

## 1) Análisis de referencias visuales (traducción jugable, no copia literal)

A partir de las imágenes adjuntas, se extraen **patrones arquitectónicos repetibles** en clave arcade:

- **Escala monumental + ritmo modular**: columnas muy altas, vanos repetidos, zócalos marcados y ejes claros para orientar movimiento.
- **Materialidad dominante**: piedra/travertino en muros y columnas, granito rojizo en pisos públicos, bronce en detalles (puertas/ascensores/pasamanos).
- **Accesos y control**: molinetes, filtros de seguridad y áreas de transición que naturalmente generan embudos jugables.
- **Verticalidad**: escaleras curvas y rellanos con visual diagonal (ideal para encuentros por capas de altura).
- **Grandes paños de ventana**: ventanales de doble altura y marcos oscuros que funcionan como hitos visuales.
- **Servicios internos**: cocina/comedor con lógica funcional, circulación técnica más estrecha y señalética operativa.
- **Subsuelo utilitario**: estacionamiento de hormigón, flechas de circulación, sectores numerados y luminaria degradada.

> Traducción aplicada: se priorizan **formas legibles**, módulos repetibles y paleta coherente en vez de detalle fotográfico realista.

---

## 2) Elementos arquitectónicos repetibles (por categoría solicitada)

- **Columnas**: exterior de granito + interior travertino + media columna mural.
- **Pisos**: adoquín exterior, granito hall, baldosa administrativa, hormigón de parking.
- **Mostradores**: lineales de atención, islas bajas y control de seguridad.
- **Ventanales**: doble altura exterior, marco oscuro de hall y ventana vertical de oficina.
- **Escaleras**: monumental curva, servicio recta y emergencia metálica.
- **Pasillos**: ancho institucional, técnico estrecho y galería con balastra.
- **Molinetes**: brazo con vidrio, barrera retráctil y lector LED.
- **Ascensores**: doble hoja en bronce, cabina de servicio y panel de llamada.
- **Señalética**: planta/piso, salida flechada, restringido y sector de estacionamiento.
- **Cocinas**: hornos, mesadas, campanas, racks.
- **Comedores**: mesas rectangulares, bancos corridos, menú y dispensadores.
- **Oficinas técnicas**: tableros, racks, puestos operativos, pizarras de turno.
- **Estacionamiento**: autos placeholder dañados, camioneta siniestrada, barreras, conos, gabinete incendio.

---

## 3) Set unificado reutilizable

Se creó un pack lógico único:

- `bna_tilesets_by_zone.json`: especificación de tilesets lógicos por zona.
- `bna_props_by_zone.json`: catálogo de props por categoría y set por zona.
- `bna_background_layers.json`: capas de fondo + presets por zona.
- `bna_interactive_objects.json`: objetos interactivos reutilizables y estados.
- `bna_level_variants.json`: variantes por nivel (1 a 10), mood y densidad.
- `bna_environment_manifest.json`: manifiesto central con reglas de coherencia visual.

Todas las definiciones son **texto plano JSON** y pensadas para pipeline sin binarios.

---

## 4) Tilesets lógicos, props, capas e interactivos

### Tilesets lógicos por zona
Zonas normalizadas:

1. `exterior_calle_lateral`
2. `hall_publico`
3. `circulacion_vertical`
4. `pisos_oficina`
5. `servicios_comedor_cocina`
6. `subsuelo_estacionamiento`

Cada zona define:
- `tileset_key`
- `logical_tiles`
- `repeatable_patterns`

### Props reutilizables
- Catálogo por categorías arquitectónicas solicitadas.
- Asignación compacta `zone_prop_sets` para poblar niveles con la misma gramática visual.

### Capas de fondo
- Capas con `id`, `parallax` y propósito visual.
- Presets por zona para acelerar implementación por nivel y conservar profundidad.

### Interactivos de escenario
- Objetos con `states`, `gameplay_tags` y `reusable_levels`.
- Permite conectar visual + gameplay (embudos, locks, escape gates, ruido señuelo).

---

## 5) Reutilización por nivel (10 niveles)

La matriz de reutilización quedó formalizada en `bna_level_variants.json`.
Resumen:

- **N1**: exterior.
- **N2**: transición subsuelo + servicios.
- **N3**: hall principal + verticalidad.
- **N4**: hall + escaleras + oficina.
- **N5**: oficina + servicios.
- **N6**: comedor/cocina + oficina.
- **N7**: oficina densa + elementos de hall.
- **N8**: oficina técnica + escalera.
- **N9**: descenso + parking.
- **N10**: parking + retorno a exterior.

Con esto se garantiza continuidad arquitectónica (misma familia de módulos) y variación de tensión (mood/densidad).

---

## 6) Ajustes en sistemas de nivel

Se agregó soporte runtime para que escenas/sistemas consuman el perfil ambiental:

- Nuevo módulo TS: `game/src/config/environmentProfiles.ts`
  - Carga manifiesto + JSONs de entorno.
  - Expone `getEnvironmentProfileForLevel(levelId)`.
  - Registra perfil activo en `scene.registry` con `registerEnvironmentProfile(scene, levelId)`.

Integración inicial en escenas:
- `GameScene` registra `level2_subsuelo`.
- `UpperFloorScene` registra `level4_segundo_piso`.

Esto deja listo el puente para que sistemas existentes (ambient events, spawn, layout visual) lean `environmentProfile` sin acoplarse a hardcodes visuales.

---

## 7) Coherencia visual transversal

Reglas activas (manifiesto):

1. Paleta pétrea cálida + bronce + azul institucional constante.
2. Lectura arcade primero: macroformas repetibles (columnas, mostradores, ventanales).
3. Degradación progresiva del estado del entorno a lo largo de campaña.
4. Interactivos en nodos de circulación para reforzar ritmo jugable.

---

## 8) Archivos entregables creados/modificados

### Nuevo documento
- `/docs/environment_asset_plan.md`

### Nuevos JSON de entorno
- `/game/public/assets/images/environment/bna_environment_manifest.json`
- `/game/public/assets/images/environment/bna_tilesets_by_zone.json`
- `/game/public/assets/images/environment/bna_props_by_zone.json`
- `/game/public/assets/images/environment/bna_background_layers.json`
- `/game/public/assets/images/environment/bna_interactive_objects.json`
- `/game/public/assets/images/environment/bna_level_variants.json`

### Ajustes de sistema/escena
- `/game/src/config/environmentProfiles.ts`
- `/game/src/scenes/GameScene.ts`
- `/game/src/scenes/UpperFloorScene.ts`
