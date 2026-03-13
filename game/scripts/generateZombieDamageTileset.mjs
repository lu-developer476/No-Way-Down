import fs from 'node:fs';
import path from 'node:path';

const TILE_WIDTH = 32;
const TILE_HEIGHT = 32;

const variants = [
  'piso_roto',
  'mesa_rota',
  'vidrio_roto',
  'pared_agrietada',
];

const width = TILE_WIDTH * variants.length;
const height = TILE_HEIGHT;

const palette = {
  transparent: [0, 0, 0, 0],
  outline: [43, 41, 39, 255],
  floorLight: [128, 125, 118, 255],
  floorMid: [112, 108, 101, 255],
  floorDark: [90, 86, 80, 255],
  dust: [101, 95, 86, 255],
  concreteLight: [146, 151, 156, 255],
  concreteMid: [120, 126, 132, 255],
  concreteDark: [86, 92, 98, 255],
  woodLight: [155, 121, 85, 255],
  woodMid: [124, 94, 64, 255],
  woodDark: [89, 65, 44, 255],
  glassLight: [178, 215, 224, 220],
  glassMid: [123, 170, 182, 195],
  glassDark: [82, 119, 126, 255],
  grime: [71, 68, 62, 255],
  shadow: [36, 34, 33, 225],
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

const scatter = (ox, points, color) => {
  for (const [x, y] of points) setPixel(ox + x, y, color);
};

const frameTile = (ox, inset = 1) => {
  hLine(ox + inset, ox + TILE_WIDTH - 1 - inset, inset, palette.outline);
  hLine(ox + inset, ox + TILE_WIDTH - 1 - inset, TILE_HEIGHT - 1 - inset, palette.outline);
  vLine(ox + inset, inset, TILE_HEIGHT - 1 - inset, palette.outline);
  vLine(ox + TILE_WIDTH - 1 - inset, inset, TILE_HEIGHT - 1 - inset, palette.outline);
};

const drawBrokenFloor = (ox) => {
  fillRect(ox + 2, 2, ox + 29, 29, (x, y) => {
    const localX = x - ox;
    if ((localX + y) % 5 === 0) return palette.floorLight;
    if ((localX + y) % 3 === 0) return palette.floorMid;
    return palette.floorDark;
  });

  scatter(
    ox,
    [
      [5, 5], [9, 8], [11, 12], [19, 10], [23, 7], [26, 13],
      [7, 18], [10, 21], [18, 24], [24, 20], [13, 27], [20, 27],
    ],
    palette.dust,
  );

  const crack = [
    [4, 6], [5, 7], [6, 8], [7, 9], [8, 10], [9, 11],
    [10, 12], [11, 13], [12, 14], [13, 15], [14, 16],
    [15, 17], [16, 18], [17, 19], [18, 20], [19, 21],
    [20, 22], [21, 23], [22, 24], [23, 25], [24, 26],
  ];
  scatter(ox, crack, palette.grime);
  scatter(ox, [[8, 12], [12, 11], [15, 13], [18, 17], [20, 20], [22, 22]], palette.shadow);

  fillRect(ox + 11, 16, ox + 17, 22, palette.shadow);
  scatter(ox, [[11, 16], [17, 16], [11, 22], [17, 22], [14, 15], [14, 23]], palette.floorLight);

  frameTile(ox);
};

const drawBrokenTable = (ox) => {
  fillRect(ox + 4, 9, ox + 27, 14, (x, y) => ((x + y) % 2 === 0 ? palette.woodLight : palette.woodMid));
  fillRect(ox + 6, 15, ox + 25, 18, palette.woodMid);

  fillRect(ox + 6, 19, ox + 8, 27, palette.woodDark);
  fillRect(ox + 23, 19, ox + 25, 27, palette.woodDark);
  fillRect(ox + 13, 19, ox + 15, 24, palette.woodDark);

  fillRect(ox + 17, 16, ox + 21, 21, palette.shadow);
  scatter(
    ox,
    [
      [4, 8], [8, 8], [13, 8], [19, 8], [24, 8], [27, 9],
      [9, 12], [12, 10], [17, 11], [22, 13], [26, 15],
      [6, 23], [7, 24], [8, 25], [23, 24], [24, 25], [25, 26],
      [12, 22], [13, 23], [14, 24],
    ],
    palette.woodLight,
  );

  scatter(ox, [[16, 11], [18, 12], [20, 13], [15, 17], [19, 19], [21, 20]], palette.grime);

  frameTile(ox);
};

const drawBrokenGlass = (ox) => {
  fillRect(ox + 3, 4, ox + 28, 27, (x, y) => ((x + y) % 2 === 0 ? palette.glassLight : palette.glassMid));
  fillRect(ox + 3, 4, ox + 28, 5, palette.glassDark);
  fillRect(ox + 3, 26, ox + 28, 27, palette.glassDark);
  fillRect(ox + 3, 4, ox + 4, 27, palette.glassDark);
  fillRect(ox + 27, 4, ox + 28, 27, palette.glassDark);

  const breaks = [
    [8, 8], [9, 9], [10, 10], [11, 11], [12, 12], [13, 13], [14, 14], [15, 15],
    [16, 16], [17, 17], [18, 18], [19, 19], [20, 20], [21, 21], [22, 22],
    [23, 11], [22, 12], [21, 13], [20, 14], [19, 15], [18, 16], [17, 17],
    [12, 21], [13, 20], [14, 19], [15, 18], [16, 17],
  ];
  scatter(ox, breaks, palette.outline);
  fillRect(ox + 13, 12, ox + 18, 18, palette.transparent);

  scatter(
    ox,
    [
      [7, 20], [8, 21], [9, 22], [20, 8], [21, 9], [22, 10],
      [24, 18], [25, 19], [10, 7], [11, 8], [18, 24], [19, 23],
    ],
    palette.glassLight,
  );

  frameTile(ox);
};

const drawCrackedWall = (ox) => {
  fillRect(ox + 2, 2, ox + 29, 29, (x, y) => {
    const localX = x - ox;
    if ((localX + y) % 7 === 0) return palette.concreteLight;
    if ((localX * 3 + y) % 5 === 0) return palette.concreteDark;
    return palette.concreteMid;
  });

  const crackMain = [
    [6, 4], [7, 5], [8, 6], [9, 7], [10, 8], [11, 9], [12, 10], [13, 11],
    [14, 12], [15, 13], [16, 14], [17, 15], [18, 16], [19, 17], [20, 18],
    [21, 19], [22, 20], [23, 21], [24, 22], [25, 23],
  ];
  const crackBranchA = [[13, 11], [12, 12], [11, 13], [10, 14], [9, 15], [8, 16]];
  const crackBranchB = [[18, 16], [19, 15], [20, 14], [21, 13], [22, 12]];
  const crackBranchC = [[16, 14], [16, 15], [16, 16], [16, 17], [16, 18], [16, 19]];

  scatter(ox, crackMain, palette.outline);
  scatter(ox, crackBranchA, palette.grime);
  scatter(ox, crackBranchB, palette.grime);
  scatter(ox, crackBranchC, palette.shadow);

  scatter(
    ox,
    [
      [5, 10], [7, 12], [9, 18], [11, 23], [14, 25], [19, 24],
      [22, 8], [24, 10], [26, 14], [27, 20], [20, 27],
    ],
    palette.dust,
  );

  frameTile(ox);
};

variants.forEach((name, index) => {
  const ox = index * TILE_WIDTH;
  if (name === 'piso_roto') drawBrokenFloor(ox);
  if (name === 'mesa_rota') drawBrokenTable(ox);
  if (name === 'vidrio_roto') drawBrokenGlass(ox);
  if (name === 'pared_agrietada') drawCrackedWall(ox);
});

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const outputSvgPath = path.resolve(scriptDir, '../public/assets/tilesets/institutional_zombie_damage_tilesheet.svg');
const outputJsonPath = path.resolve(scriptDir, '../public/assets/tilesets/institutional_zombie_damage_tilesheet_coords.json');

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
