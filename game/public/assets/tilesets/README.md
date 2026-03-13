# Institutional hall tileset

Los archivos PNG no se versionan en el repositorio para evitar binarios en el diff (incluye `institutional_hall_tileset.png` y `bank_counter_spritesheet.png`).

Generación local:

```bash
npm --prefix game run generate:institutional-tileset
```

Esto produce:

- `game/public/assets/tilesets/institutional_hall_tileset.png`

El mapa JSON (`institutional_hall_tileset_map.json`) y el ejemplo de Phaser usan ese nombre de archivo.

## Bank counter spritesheet

Sprites pixel art modulares de mostrador de atención bancaria (64x48 por módulo).

Generación local:

```bash
npm --prefix game run generate:bank-counter-spritesheet
```

Esto produce:

- `game/public/assets/tilesets/bank_counter_spritesheet.png`
- `game/public/assets/tilesets/bank_counter_spritesheet.svg` (fuente no binaria editable)
- `game/public/assets/tilesets/bank_counter_spritesheet_coords.json`

Coordenadas incluidas:

- `modulo_central`: `x=0, y=0, w=64, h=48`
- `modulo_extremo`: `x=64, y=0, w=64, h=48`
- `modulo_con_vidrio`: `x=128, y=0, w=64, h=48`
- `modulo_con_computadora`: `x=192, y=0, w=64, h=48`
- `modulo_con_silla_detras`: `x=256, y=0, w=64, h=48`

## Institutional dining tables spritesheet

Sprites pixel art de mesas de comedor institucional (64x32 por variante).

Variantes incluidas:

- `mesa_vacia`
- `mesa_con_bandeja`
- `mesa_volcada_zombie`
- `mesa_danada`

Generación local:

```bash
npm --prefix game run generate:dining-tables-spritesheet
```

Esto produce:

- `game/public/assets/tilesets/institutional_dining_tables_spritesheet.png`
- `game/public/assets/tilesets/institutional_dining_tables_spritesheet.svg` (fuente no binaria editable)
- `game/public/assets/tilesets/institutional_dining_tables_spritesheet_coords.json`

## Institutional stone columns spritesheet

Sprites pixel art de columnas de piedra institucional (32x96 por variante).

Variantes incluidas:

- `base_columna`
- `columna_completa`
- `columna_danada`
- `columna_sombra`

Generación local:

```bash
npm --prefix game run generate:stone-columns-spritesheet
```

Esto produce:

- `game/public/assets/tilesets/institutional_stone_columns_spritesheet.png`
- `game/public/assets/tilesets/institutional_stone_columns_spritesheet.svg` (fuente no binaria editable)
- `game/public/assets/tilesets/institutional_stone_columns_spritesheet_coords.json`

## Institutional decor spritesheet

Sprites pixel art de objetos decorativos para gran salón institucional con estética bancaria (32x32 por variante).

Variantes incluidas:

- `banco_limpio`
- `banco_roto`
- `banco_ensangrentado`
- `silla_oficina_limpia`
- `silla_oficina_rota`
- `silla_oficina_ensangrentada`
- `casillero_cerrado`
- `casillero_abierto`
- `casillero_roto`
- `casillero_sucio_sangre`
- `maceta_grande`
- `lampara_techo`
- `divisor_vidrio_intacto`
- `divisor_vidrio_roto`
- `divisor_vidrio_ensangrentado`

Generación local:

```bash
npm --prefix game run generate:institutional-decor-spritesheet
```

Esto produce únicamente archivos no binarios:

- `game/public/assets/tilesets/institutional_decor_spritesheet.svg` (fuente editable)
- `game/public/assets/tilesets/institutional_decor_spritesheet_coords.json`

## Institutional stairs spritesheet

Sprites pixel art de escaleras interiores de edificio institucional (32x32 por variante), pensadas para gameplay de plataformas.

Variantes incluidas:

- `escalera_ascendente_sucia_sangre`
- `escalera_descendente_sucia_sangre`
- `base_escalera_sucia_sangre`
- `borde_escalera_sucia_sangre`

Generación local:

```bash
npm --prefix game run generate:stairs-spritesheet
```

Esto produce únicamente archivos no binarios:

- `game/public/assets/tilesets/institutional_stairs_spritesheet.svg` (fuente editable)
- `game/public/assets/tilesets/institutional_stairs_spritesheet_coords.json`
