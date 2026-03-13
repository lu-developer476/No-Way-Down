# Uso de `Level4AmbientEvents`

## 1) Crear sistema en la escena del Nivel 4

```ts
import level4AmbientEventsConfig from '../../public/assets/levels/level4_ambient_events.example.json';
import { Level4AmbientEvents } from '../systems/Level4AmbientEvents';

// Dentro de create():
this.level4AmbientEvents = new Level4AmbientEvents(this, this.players, level4AmbientEventsConfig);
this.level4AmbientEvents.register();
```

## 2) Limpieza al cerrar la escena

```ts
// Dentro de shutdown/destroy de la escena
this.level4AmbientEvents?.destroy();
```

## 3) Disparo manual opcional

```ts
// Ejemplo: forzar un evento puntual sin trigger
this.level4AmbientEvents?.trigger('alarma-lejana');
```

## Notas de diseño

- Los eventos se activan por zonas rectangulares definidas en `triggers`.
- `kind` permite distinguir intención de diseño (`segment` o `trigger`), aunque el runtime los trata como zonas físicas equivalentes.
- `once` controla si un trigger se consume al primer uso.
- `cooldownMs` evita spam de un mismo evento.
- Si no existe audio cargado para un evento, el sistema usa solo feedback visual/textual (sin depender de binarios).
