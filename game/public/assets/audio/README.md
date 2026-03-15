# Audio placeholders (sin binarios en repo)

Este directorio define la estructura esperada para audio, pero **no almacena archivos binarios**.

Cuando se integren assets finales, usar estas rutas:

- `assets/audio/music/menu-loop.wav`
- `assets/audio/ambience/gameplay-ambience-loop.wav`
- `assets/audio/sfx/shot.wav`
- `assets/audio/sfx/player-damage.wav`
- `assets/audio/sfx/zombie-death.wav`
- `assets/audio/ui/ui-confirm.wav`
- `assets/audio/ui/ui-pause.wav`

El juego sigue funcionando sin estos archivos gracias al fallback del `AudioManager`.
