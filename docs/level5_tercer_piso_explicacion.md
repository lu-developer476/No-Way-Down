# Nivel 5 - Tercer Piso Institucional (explicación de secciones)

Archivo base: `game/public/assets/levels/level5_tercer_piso.json`.

## S1. acceso por escaleras
- Funciona como transición inmediata desde el nivel anterior.
- Introduce el lenguaje visual del piso: piedra, barandas institucionales e iluminación interior sobria.
- Se activa `CZ1` al cruzar una línea de avance para evitar retroceso fácil y fijar ritmo de entrada.

## S2. corredor inicial
- Primer tramo largo del corredor perimetral.
- Se colocan accesos de oficina bloqueados/cerrados para lectura espacial y control de rutas.
- `CZ2` usa trigger por entrada de área para forzar resolución de combate en espacio lineal.

## S3. galería con vista al hall
- Es el punto de identidad del nivel: balcón con visual al hall central.
- Las barandas y columnas se usan como cobertura parcial para duelos de fuego cruzado.
- `CZ3` se activa al internarse en la galería, simulando emboscada desde ambos extremos.

## S4. sector de oficinas
- Cambia la dinámica del corredor a combate por nodos cortos entre puertas y mobiliario.
- Incluye múltiples accesos de oficina para reforzar fantasía institucional.
- `CZ4` se habilita por progreso del combate anterior (`CZ3`) para encadenar avance narrativo.

## S5. corredor final
- Tramo más angosto y de alta presión antes de la extracción.
- Consolida el uso de barandas y coberturas bajas para reposicionamiento rápido.
- `CZ5` combina zona final y pre-salida para crear un último pico de tensión.

## S6. salida del nivel
- Vestíbulo de cierre con `exit_point` centrado en un pad de extracción.
- Mantiene estética institucional (señalética y barrera final de seguridad).
- Queda bloqueado hasta cumplir `all_combat_zones_cleared`.
