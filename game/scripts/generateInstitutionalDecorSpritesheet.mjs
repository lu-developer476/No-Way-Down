import fs from 'node:fs';
import path from 'node:path';

const TILE_WIDTH = 32;
const TILE_HEIGHT = 32;

const variants = [
  'banco_limpio',
  'banco_roto',
  'banco_ensangrentado',
  'silla_oficina_limpia',
  'silla_oficina_rota',
  'silla_oficina_ensangrentada',
  'casillero_cerrado',
  'casillero_abierto',
  'casillero_roto',
  'casillero_sucio_sangre',
  'maceta_grande',
  'lampara_techo',
  'divisor_vidrio_intacto',
  'divisor_vidrio_roto',
  'divisor_vidrio_ensangrentado',
];

const width = TILE_WIDTH * variants.length;
const height = TILE_HEIGHT;

const palette = {
  transparent: [0, 0, 0, 0],
  outline: [43, 41, 39, 255],
  floorShadow: [41, 50, 56, 180],
  bankWoodA: [119, 90, 65, 255],
  bankWoodB: [146, 113, 81, 255],
  foam: [87, 95, 101, 255],
  cloth: [54, 87, 112, 255],
  steel: [109, 119, 126, 255],
  steelDark: [82, 91, 99, 255],
  rust: [143, 95, 57, 255],
  dirt: [127, 111, 91, 255],
  blood: [131, 25, 33, 255],
  bloodDark: [98, 17, 24, 255],
  leafA: [74, 112, 72, 255],
  leafB: [52, 91, 58, 255],
  pot: [94, 78, 64, 255],
  lampMetal: [128, 125, 118, 255],
  lampLight: [247, 226, 177, 220],
  glass: [157, 195, 217, 190],
  glassHighlight: [211, 236, 248, 220],
  tape: [215, 187, 94, 255],
};

const pixels = Array.from({ length: height }, () =>
  Array.from({ length: width }, () => palette.transparent),
);

const setPixel = (x, y, color) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  pixels[y][x] = color;
};

const fillRect = (x0, y0, x1, y1, color) => {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setPixel(x, y, typeof color === 'function' ? color(x, y) : color);
    }
  }
};

const hLine = (x0, x1, y, color) => fillRect(x0, y, x1, y, color);
const vLine = (x, y0, y1, color) => fillRect(x, y0, x, y1, color);

const splatter = (ox, points, color) => {
  for (const [x, y] of points) setPixel(ox + x, y, color);
};

const drawBench = (ox, state) => {
  fillRect(ox + 3, 24, ox + 28, 27, palette.floorShadow);
  fillRect(ox + 4, 12, ox + 27, 18, (x, y) => ((x + y) % 2 === 0 ? palette.bankWoodA : palette.bankWoodB));
  hLine(ox + 4, ox + 27, 12, palette.outline);
  hLine(ox + 4, ox + 27, 18, palette.outline);
  vLine(ox + 4, 12, 18, palette.outline);
  vLine(ox + 27, 12, 18, palette.outline);
  fillRect(ox + 6, 19, ox + 9, 25, palette.steelDark);
  fillRect(ox + 22, 19, ox + 25, 25, palette.steelDark);

  if (state === 'roto') {
    fillRect(ox + 14, 12, ox + 17, 18, palette.transparent);
    hLine(ox + 13, ox + 18, 14, palette.outline);
    splatter(ox, [[10, 25], [11, 25], [12, 26], [20, 26]], palette.rust);
  }

  if (state === 'ensangrentado') {
    splatter(
      ox,
      [
        [8, 14], [9, 14], [10, 15], [11, 15],
        [18, 16], [19, 16], [20, 17], [15, 19],
        [15, 20], [16, 21], [16, 22],
      ],
      palette.blood,
    );
    splatter(ox, [[8, 15], [19, 17], [16, 23]], palette.bloodDark);
  }
};

const drawOfficeChair = (ox, state) => {
  fillRect(ox + 13, 6, ox + 21, 13, palette.cloth);
  fillRect(ox + 12, 14, ox + 22, 18, palette.foam);
  hLine(ox + 13, ox + 21, 6, palette.outline);
  vLine(ox + 13, 6, 13, palette.outline);
  vLine(ox + 21, 6, 13, palette.outline);
  fillRect(ox + 16, 19, ox + 18, 24, palette.steel);
  hLine(ox + 11, ox + 23, 25, palette.steelDark);
  vLine(ox + 12, 25, 27, palette.steelDark);
  vLine(ox + 22, 25, 27, palette.steelDark);

  if (state === 'rota') {
    fillRect(ox + 20, 12, ox + 22, 16, palette.transparent);
    hLine(ox + 18, ox + 22, 12, palette.outline);
    vLine(ox + 14, 19, 26, palette.steelDark);
    setPixel(ox + 23, 27, palette.steelDark);
  }

  if (state === 'ensangrentada') {
    splatter(ox, [[15, 15], [16, 15], [17, 16], [18, 17], [14, 18], [14, 19]], palette.blood);
    splatter(ox, [[16, 16], [17, 17], [14, 20]], palette.bloodDark);
  }
};

const drawLocker = (ox, state) => {
  fillRect(ox + 9, 4, ox + 22, 27, (x, y) => ((x + y) % 2 === 0 ? palette.steel : palette.steelDark));
  hLine(ox + 9, ox + 22, 4, palette.outline);
  hLine(ox + 9, ox + 22, 27, palette.outline);
  vLine(ox + 9, 4, 27, palette.outline);
  vLine(ox + 22, 4, 27, palette.outline);
  hLine(ox + 10, ox + 21, 11, palette.outline);
  hLine(ox + 10, ox + 21, 18, palette.outline);

  if (state === 'abierto') {
    fillRect(ox + 10, 5, ox + 17, 26, [36, 43, 48, 255]);
    vLine(ox + 18, 5, 26, palette.outline);
    fillRect(ox + 19, 5, ox + 22, 26, palette.steelDark);
  }

  if (state === 'roto') {
    fillRect(ox + 12, 14, ox + 19, 20, palette.transparent);
    hLine(ox + 11, ox + 20, 14, palette.outline);
    hLine(ox + 11, ox + 20, 20, palette.outline);
    splatter(ox, [[11, 22], [12, 22], [20, 23], [19, 24]], palette.rust);
  }

  if (state === 'sucio_sangre') {
    splatter(ox, [[10, 8], [11, 8], [12, 9], [18, 7], [19, 8]], palette.dirt);
    splatter(ox, [[14, 17], [15, 17], [15, 18], [16, 19], [17, 20], [17, 21]], palette.blood);
    splatter(ox, [[16, 18], [17, 19]], palette.bloodDark);
  }
};

const drawLargePlant = (ox) => {
  fillRect(ox + 11, 18, ox + 21, 27, palette.pot);
  hLine(ox + 10, ox + 22, 18, palette.outline);
  fillRect(ox + 12, 11, ox + 20, 19, (x, y) => ((x + y) % 2 === 0 ? palette.leafA : palette.leafB));
  fillRect(ox + 9, 13, ox + 12, 18, palette.leafB);
  fillRect(ox + 20, 12, ox + 23, 17, palette.leafA);
};

const drawCeilingLamp = (ox) => {
  vLine(ox + 16, 1, 8, palette.lampMetal);
  fillRect(ox + 11, 8, ox + 21, 13, palette.lampMetal);
  hLine(ox + 11, ox + 21, 8, palette.outline);
  fillRect(ox + 9, 14, ox + 23, 22, palette.lampLight);
  hLine(ox + 9, ox + 23, 14, palette.outline);
  hLine(ox + 10, ox + 22, 22, palette.outline);
};

const drawGlassDivider = (ox, state) => {
  fillRect(ox + 5, 6, ox + 26, 26, (x, y) => ((x + y) % 5 === 0 ? palette.glassHighlight : palette.glass));
  hLine(ox + 5, ox + 26, 6, palette.outline);
  hLine(ox + 5, ox + 26, 26, palette.outline);
  vLine(ox + 5, 6, 26, palette.outline);
  vLine(ox + 26, 6, 26, palette.outline);
  vLine(ox + 15, 7, 25, palette.tape);
  vLine(ox + 16, 7, 25, palette.tape);

  if (state === 'roto') {
    fillRect(ox + 13, 14, ox + 18, 19, palette.transparent);
    hLine(ox + 12, ox + 19, 14, palette.outline);
    hLine(ox + 12, ox + 19, 19, palette.outline);
    splatter(ox, [[11, 22], [12, 23], [19, 22], [20, 23]], palette.glassHighlight);
  }

  if (state === 'ensangrentado') {
    splatter(ox, [[8, 10], [9, 11], [10, 12], [11, 12], [20, 16], [21, 17], [22, 18]], palette.blood);
    splatter(ox, [[10, 13], [21, 18]], palette.bloodDark);
  }
};

variants.forEach((name, index) => {
  const ox = index * TILE_WIDTH;
  if (name.startsWith('banco_')) {
    drawBench(ox, name.replace('banco_', ''));
  } else if (name.startsWith('silla_oficina_')) {
    const state = name.replace('silla_oficina_', '');
    drawOfficeChair(ox, state === 'limpia' ? 'limpia' : state);
  } else if (name.startsWith('casillero_')) {
    drawLocker(ox, name.replace('casillero_', ''));
  } else if (name === 'maceta_grande') {
    drawLargePlant(ox);
  } else if (name === 'lampara_techo') {
    drawCeilingLamp(ox);
  } else if (name.startsWith('divisor_vidrio_')) {
    drawGlassDivider(ox, name.replace('divisor_vidrio_', ''));
  }
});

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const outputSvgPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_decor_spritesheet.svg');
const outputJsonPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_decor_spritesheet_coords.json');

const rects = [];
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const [r, g, b, a] = pixels[y][x];
    if (a === 0) continue;
    rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})" />`);
  }
}

const svg = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
  ...rects,
  '</svg>',
  '',
].join('\n');

const coords = Object.fromEntries(
  variants.map((name, index) => [
    name,
    { x: index * TILE_WIDTH, y: 0, w: TILE_WIDTH, h: TILE_HEIGHT },
  ]),
);

fs.writeFileSync(outputSvgPath, svg, 'utf8');
fs.writeFileSync(outputJsonPath, `${JSON.stringify(coords, null, 2)}\n`, 'utf8');

console.log(`Spritesheet SVG generado en: ${outputSvgPath}`);
console.log(`Coordenadas JSON generadas en: ${outputJsonPath}`);
