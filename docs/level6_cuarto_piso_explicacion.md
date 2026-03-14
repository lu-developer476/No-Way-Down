# Nivel 6 - Cuarto Piso (Comedor y Cocina Central)

## Resumen estructural
El nivel está definido para un flujo lineal de **6 secciones**, manteniendo un avance de izquierda a derecha:

1. Acceso por escaleras
2. Pasillo de servicio
3. Cocina industrial
4. Área de preparación de viandas
5. Comedor de empleados
6. Salida

Archivo de datos del nivel:
- `game/public/assets/levels/level6_cuarto_piso_comedor.json`

## Explicación de cada sección

### S1 - Acceso por escaleras
- **Rol jugable**: zona de adaptación inicial y primer bloqueo táctico.
- **Diseño**: rellano compacto con puerta cortafuego para introducir al jugador en un embudo controlado.
- **Combate**: activa el primer evento al cruzar una línea (`cross_line`) y fuerza una limpieza rápida.
- **Interacción**: panel de control para desbloquear el paso al corredor.

### S2 - Pasillo de servicio
- **Rol jugable**: transición de presión constante con visibilidad media.
- **Diseño**: carros y estanterías generan cobertura y micro-obstáculos en el desplazamiento.
- **Combate**: emboscada por entrada de área (`enter_area`) con oleadas en dos puntos.
- **Interacción**: interruptor de alarma que representa objetivo contextual no lineal.

### S3 - Cocina industrial
- **Rol jugable**: pico de intensidad intermedio.
- **Diseño**: hornos, mesadas y líneas de calor crean rutas de riesgo y cobertura dura.
- **Combate**: se activa por progreso (`objective_progress`) al limpiar la sección previa.
- **Interacción**: válvula de gas y puerta de cámara fría para variaciones tácticas.

### S4 - Área de preparación de viandas
- **Rol jugable**: control de carriles y manejo de flancos.
- **Diseño**: cintas de bandejas y cajas apiladas forman carriles con cuellos de botella.
- **Combate**: evento por proximidad con contraataque orientado a flanco.
- **Interacción**: caja eléctrica para habilitar energía de salida.

### S5 - Comedor de empleados
- **Rol jugable**: arena amplia de fuego cruzado antes del cierre.
- **Diseño**: mesas y máquinas expendedoras como coberturas mixtas (media y completa).
- **Combate**: última defensa con dos oleadas de mayor volumen.
- **Interacción**: consola de megafonía para distracción sonora.

### S6 - Salida
- **Rol jugable**: cierre y transición al siguiente nivel.
- **Diseño**: vestíbulo compacto con portón de seguridad y panel de montacargas.
- **Combate**: presión final por spawn cercano a extracción.
- **Interacción**: panel de elevador para activar la extracción.

## Compatibilidad técnica
- La configuración usa únicamente campos de texto/numéricos en JSON.
- Los recursos visuales están referenciados por `asset_placeholder`.
- Se mantiene el esquema conocido (`sections`, `spawn_points`, `combat_zones`, `cover_objects`, `exit_point`) para no afectar niveles anteriores.
- Se agregó tipado TypeScript para Nivel 6 en `game/src/systems/Level6FourthFloorTypes.ts`.
