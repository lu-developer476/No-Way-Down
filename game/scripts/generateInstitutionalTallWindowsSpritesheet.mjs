import fs from 'node:fs';
import path from 'node:path';

const SPRITE_WIDTH = 32;
const SPRITE_HEIGHT = 96;
const variants = 3;

const width = SPRITE_WIDTH * variants;
const height = SPRITE_HEIGHT;

const palette = {
  transparent: [0, 0, 0, 0],
  frameDark: [28, 31, 39, 255],
  frameMid: [44, 49, 60, 255],
  frameLight: [62, 69, 82, 255],
  glassDark: [26, 45, 66, 255],
  glassMid: [40, 63, 92, 255],
  glassLight: [58, 84, 120, 255],
  reflection: [98, 136, 176, 200],
  warmGlow: [213, 168, 101, 220],
  warmGlowSoft: [152, 120, 73, 170],
  crack: [149, 154, 168, 220],
  shardShadow: [17, 24, 33, 255],
  grime: [21, 30, 42, 150],
};

const pixels = Array.from({ length: height }, () =>
  Array.from({ length: width }, () => [...palette.transparent]),
);

const setPixel = (x, y, color) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  pixels[y][x] = color;
};

const lineH = (x0, x1, y, color) => {
  for (let x = x0; x <= x1; x++) setPixel(x, y, color);
};

const lineV = (x, y0, y1, color) => {
  for (let y = y0; y <= y1; y++) setPixel(x, y, color);
};

const fill = (x0, y0, x1, y1, colorFn) => {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setPixel(x, y, typeof colorFn === 'function' ? colorFn(x, y) : colorFn);
    }
  }
};

const drawFrameAndGlass = (ox, lighting = 'closed') => {
  const left = ox + 4;
  const right = ox + 27;
  const top = 2;
  const bottom = 95;

  fill(left, top, right, bottom, palette.frameDark);

  // Marcos exteriores
  lineV(left + 1, top + 1, bottom - 1, palette.frameLight);
  lineV(right - 1, top + 1, bottom - 1, palette.frameMid);
  lineH(left + 1, right - 1, top + 1, palette.frameLight);
  lineH(left + 1, right - 1, bottom - 1, palette.frameMid);

  // Travesaños
  for (const y of [24, 47, 70]) {
    fill(left + 2, y, right - 2, y + 1, (x) => ((x + y) % 2 === 0 ? palette.frameMid : palette.frameDark));
  }

  // Parteluz vertical
  fill(ox + 15, top + 2, ox + 16, bottom - 2, palette.frameMid);

  // Paneles de vidrio
  const glassAreas = [
    [left + 2, top + 2, ox + 14, 23],
    [ox + 17, top + 2, right - 2, 23],
    [left + 2, 26, ox + 14, 46],
    [ox + 17, 26, right - 2, 46],
    [left + 2, 49, ox + 14, 69],
    [ox + 17, 49, right - 2, 69],
    [left + 2, 72, ox + 14, bottom - 2],
    [ox + 17, 72, right - 2, bottom - 2],
  ];

  for (const [x0, y0, x1, y1] of glassAreas) {
    fill(x0, y0, x1, y1, (x, y) => {
      const band = (x + y) % 5;
      let base = band <= 1 ? palette.glassDark : band <= 3 ? palette.glassMid : palette.glassLight;

      if (lighting === 'lit' && y < 24) {
        base = (x + y) % 3 === 0 ? palette.warmGlow : palette.warmGlowSoft;
      }

      return base;
    });
  }

  // Reflejos sutiles
  for (let y = top + 5; y < bottom - 4; y += 11) {
    lineH(left + 4, left + 8, y, palette.reflection);
    lineH(ox + 18, ox + 22, y + 1, palette.reflection);
  }

  // Suciedad para coherencia ambiente
  for (let y = top + 8; y < bottom - 6; y += 14) {
    setPixel(left + 3, y, palette.grime);
    setPixel(right - 3, y + 2, palette.grime);
  }
};

const drawExteriorLight = (ox) => {
  // Halo frío del exterior en bordes superiores
  fill(ox + 6, 0, ox + 25, 5, (x, y) => ((x + y) % 2 === 0 ? [103, 123, 149, 110] : [80, 97, 118, 90]));
};

const drawBrokenGlass = (ox) => {
  const cracks = [
    [ox + 10, 12, ox + 11, 37],
    [ox + 21, 30, ox + 20, 54],
    [ox + 14, 51, ox + 18, 79],
  ];

  for (const [x0, y0, x1, y1] of cracks) {
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      setPixel(x0 + dx * i, y0 + dy * i, palette.crack);
      if (i % 4 === 0) setPixel(x0 + dx * i + 1, y0 + dy * i, palette.crack);
    }
  }

  // Huecos rotos
  fill(ox + 18, 56, ox + 22, 64, palette.shardShadow);
  fill(ox + 9, 33, ox + 12, 39, palette.shardShadow);

  // Dientes de vidrio roto
  for (const [x, y] of [
    [ox + 18, 55], [ox + 19, 55], [ox + 22, 55],
    [ox + 9, 32], [ox + 11, 32], [ox + 12, 32],
  ]) {
    setPixel(x, y, palette.crack);
  }
};

// Variante 1: ventana cerrada
const closedX = 0;
drawFrameAndGlass(closedX, 'closed');

// Variante 2: ventana con luz exterior
const litX = SPRITE_WIDTH;
drawFrameAndGlass(litX, 'lit');
drawExteriorLight(litX);

// Variante 3: ventana rota (ambientación zombie)
const brokenX = SPRITE_WIDTH * 2;
drawFrameAndGlass(brokenX, 'closed');
drawBrokenGlass(brokenX);

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const svgPath = path.resolve(scriptDir, '../public/assets/tilesets/institutional_tall_windows_spritesheet.svg');
const rows = [];
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const [r, g, b, a] = pixels[y][x];
    if (a === 0) continue;
    rows.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})" />`);
  }
}
const svg = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
  ...rows,
  '</svg>',
  '',
].join('\n');
fs.mkdirSync(path.dirname(svgPath), { recursive: true });
fs.writeFileSync(svgPath, svg);

const coordinatesPath = path.resolve(scriptDir, '../public/assets/tilesets/institutional_tall_windows_spritesheet_coords.json');
const coords = {
  image: null,
  source: 'institutional_tall_windows_spritesheet.svg',
  spriteSize: { width: SPRITE_WIDTH, height: SPRITE_HEIGHT },
  sprites: {
    ventana_cerrada: { x: 0, y: 0, width: 32, height: 96 },
    ventana_luz_exterior: { x: 32, y: 0, width: 32, height: 96 },
    ventana_rota_zombie: { x: 64, y: 0, width: 32, height: 96 },
  },
};
fs.writeFileSync(coordinatesPath, `${JSON.stringify(coords, null, 2)}\n`);

console.log(`Spritesheet SVG (no binario) generado en: ${svgPath}`);
console.log(`Coordenadas guardadas en: ${coordinatesPath}`);
