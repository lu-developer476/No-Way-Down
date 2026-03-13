# Institutional hall tileset

El archivo PNG no se versiona en el repositorio para evitar binarios en el diff.

Generación local:

```bash
npm --prefix game run generate:institutional-tileset
```

Esto produce:

- `game/public/assets/tilesets/institutional_hall_tileset.png`

El mapa JSON (`institutional_hall_tileset_map.json`) y el ejemplo de Phaser usan ese nombre de archivo.
