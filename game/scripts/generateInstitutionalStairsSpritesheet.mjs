import fs from 'node:fs';
import path from 'node:path';

const TILE_WIDTH = 32;
const TILE_HEIGHT = 32;

const variants = [
  'escalera_ascendente_sucia_sangre',
  'escalera_descendente_sucia_sangre',
  'base_escalera_sucia_sangre',
  'borde_escalera_sucia_sangre',
];

const width = TILE_WIDTH * variants.length;
const height = TILE_HEIGHT;

const palette = {
  transparent: [0, 0, 0, 0],
  outline: [36, 36, 38, 255],
  concreteLight: [146, 151, 156, 255],
  concreteMid: [120, 126, 132, 255],
  concreteDark: [86, 92, 98, 255],
  edgeLight: [173, 179, 184, 255],
  shadow: [52, 58, 64, 220],
  dirt: [114, 101, 82, 255],
  grime: [95, 83, 67, 255],
  blood: [138, 24, 34, 255],
  bloodDark: [102, 16, 24, 255],
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

const applyStains = (ox, phase = 0) => {
  const dirtPoints = [];
  const grimePoints = [];

  for (let y = 9; y <= 29; y++) {
    for (let x = 3; x <= 28; x++) {
      if (((x + y + phase) % 9) === 0) dirtPoints.push([x, y]);
      if (((x * 3 + y + phase) % 17) === 0) grimePoints.push([x, y]);
    }
  }

  splatter(ox, dirtPoints, palette.dirt);
  splatter(ox, grimePoints, palette.grime);

  splatter(
    ox,
    [
      [6, 12], [7, 12], [8, 13], [9, 14],
      [17, 18], [18, 18], [19, 19],
      [24, 23], [25, 24], [26, 25],
      [11, 27], [12, 28], [13, 29],
    ],
    palette.blood,
  );
  splatter(ox, [[8, 14], [19, 20], [25, 25], [13, 30]], palette.bloodDark);
};

const drawStepBand = (ox, y0, y1, inset = 0) => {
  fillRect(ox + 2 + inset, y0, ox + 29 - inset, y1, (x, y) => (
    (x + y) % 2 === 0 ? palette.concreteLight : palette.concreteMid
  ));
  hLine(ox + 2 + inset, ox + 29 - inset, y0, palette.edgeLight);
  hLine(ox + 2 + inset, ox + 29 - inset, y1, palette.outline);
  vLine(ox + 2 + inset, y0, y1, palette.outline);
  vLine(ox + 29 - inset, y0, y1, palette.outline);
};

const drawAscendingStairs = (ox) => {
  fillRect(ox + 2, 8, ox + 29, 30, palette.shadow);
  drawStepBand(ox, 24, 30, 0);
  drawStepBand(ox, 18, 23, 2);
  drawStepBand(ox, 12, 17, 4);
  drawStepBand(ox, 8, 11, 6);
  applyStains(ox, 0);
};

const drawDescendingStairs = (ox) => {
  fillRect(ox + 2, 8, ox + 29, 30, palette.shadow);
  drawStepBand(ox, 8, 13, 0);
  drawStepBand(ox, 14, 19, 2);
  drawStepBand(ox, 20, 25, 4);
  drawStepBand(ox, 26, 30, 6);
  applyStains(ox, 4);
};

const drawStairBase = (ox) => {
  fillRect(ox + 2, 8, ox + 29, 30, palette.shadow);
  drawStepBand(ox, 20, 30, 0);
  fillRect(ox + 6, 8, ox + 25, 19, (x, y) => (
    (x + y) % 2 === 0 ? palette.concreteMid : palette.concreteDark
  ));
  hLine(ox + 6, ox + 25, 8, palette.edgeLight);
  vLine(ox + 6, 8, 19, palette.outline);
  vLine(ox + 25, 8, 19, palette.outline);
  applyStains(ox, 8);
};

const drawStairEdge = (ox) => {
  fillRect(ox + 2, 8, ox + 29, 30, palette.shadow);
  fillRect(ox + 3, 9, ox + 14, 30, (x, y) => (
    (x + y) % 2 === 0 ? palette.concreteLight : palette.concreteMid
  ));
  fillRect(ox + 15, 9, ox + 28, 30, (x, y) => (
    (x + y) % 2 === 0 ? palette.concreteMid : palette.concreteDark
  ));
  vLine(ox + 14, 9, 30, palette.edgeLight);
  vLine(ox + 15, 9, 30, palette.outline);
  hLine(ox + 3, ox + 28, 9, palette.edgeLight);
  hLine(ox + 3, ox + 28, 30, palette.outline);
  vLine(ox + 3, 9, 30, palette.outline);
  vLine(ox + 28, 9, 30, palette.outline);
  applyStains(ox, 12);
};

variants.forEach((name, index) => {
  const ox = index * TILE_WIDTH;
  if (name.includes('ascendente')) drawAscendingStairs(ox);
  else if (name.includes('descendente')) drawDescendingStairs(ox);
  else if (name.startsWith('base_')) drawStairBase(ox);
  else if (name.startsWith('borde_')) drawStairEdge(ox);
});

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const outputSvgPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_stairs_spritesheet.svg');
const outputJsonPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_stairs_spritesheet_coords.json');

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
  variants.map((name, index) => [name, { x: index * TILE_WIDTH, y: 0, w: TILE_WIDTH, h: TILE_HEIGHT }]),
);

fs.writeFileSync(outputSvgPath, svg, 'utf8');
fs.writeFileSync(outputJsonPath, `${JSON.stringify(coords, null, 2)}\n`, 'utf8');

console.log(`Spritesheet SVG generado en: ${outputSvgPath}`);
console.log(`Coordenadas JSON generadas en: ${outputJsonPath}`);
