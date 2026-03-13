# Etapa 11 - Multijugador local (humanos)

## Alcance implementado
- Se habilita multijugador local para **2 jugadores humanos** en `GameScene` y `UpperFloorScene`.
- Arquitectura preparada para crecer a **3 y 4 jugadores** sin reescribir entidades base.
- Cámara compartida centrada en el promedio del grupo.
- Límite de separación física entre jugadores para evitar que se salgan del encuadre/juego cooperativo.
- **Sin online** (únicamente input local por teclado).

## Punto único de configuración
Archivo: `game/src/config/localMultiplayer.ts`

- `PLAYER_CONFIGS`: perfiles por slot (`Player 1` ... `Player 4`) con:
  - color/tinte visual
  - esquema de teclas
- `ACTIVE_LOCAL_PLAYER_COUNT`: cantidad de jugadores activos.

### Escalar a 3 o 4 jugadores
1. Cambiar `ACTIVE_LOCAL_PLAYER_COUNT` de `2` a `3` o `4`.
2. (Opcional) Ajustar spawn offsets y límite de separación si se quiere un comportamiento más estricto para 3/4.
3. Si se desea UX más avanzada para 3/4, evolucionar el algoritmo de separación de par a centroide (ya hay base en cámara compartida por promedio).

No hace falta tocar la entidad `Player` para agregar nuevos jugadores: cada instancia toma su `PlayerConfig` dinámicamente.

## Esquema de controles propuesto
- **Player 1**: `←` / `→` mover, `↑` saltar, `SPACE` disparar.
- **Player 2**: `A` / `D` mover, `W` saltar, `F` disparar.
- **Player 3** (preconfigurado, inactivo por defecto): `J` / `L` mover, `I` saltar, `H` disparar.
- **Player 4** (preconfigurado, inactivo por defecto): `NUMPAD 4` / `NUMPAD 6` mover, `NUMPAD 8` saltar, `NUMPAD 0` disparar.

## Notas de integración
- `Player` ahora recibe `PlayerConfig` para separar input/identidad visual por jugador.
- `StaircaseSystem` acepta arreglo de jugadores y habilita interacción si cualquiera está en la zona.
- UI actual mantiene una vida de equipo agregada (`playerHealth` total) para no romper HUD existente.
