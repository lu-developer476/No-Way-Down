import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SPRITE_WIDTH = 64;
const SPRITE_HEIGHT = 32;
const variants = 4;

const width = SPRITE_WIDTH * variants;
const height = SPRITE_HEIGHT;

const palette = {
  transparent: [0, 0, 0, 0],
  outline: [43, 39, 35, 255],
  shadow: [23, 22, 24, 130],
  metalDark: [85, 93, 100, 255],
  metalMid: [114, 123, 132, 255],
  metalLight: [148, 160, 171, 255],
  woodDark: [71, 45, 31, 255],
  woodMid: [95, 61, 40, 255],
  woodLight: [122, 79, 52, 255],
  trayBody: [164, 169, 172, 255],
  trayLip: [195, 200, 205, 255],
  trayFood: [186, 109, 58, 255],
  damage: [66, 29, 23, 255],
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

const drawSimpleShadow = (ox, skew = 0) => {
  fill(ox + 12 + skew, 25, ox + 51 + skew, 28, (x, y) => ((x + y) % 7 === 0 ? palette.transparent : palette.shadow));
  lineH(ox + 14 + skew, ox + 49 + skew, 29, palette.shadow);
};

const drawBaseTable = (ox, topVariant = 0) => {
  // tablero
  fill(ox + 10, 7, ox + 53, 14, (x, y) => {
    if (topVariant === 1 && x % 3 === 0) return palette.woodLight;
    if ((x * 2 + y + topVariant) % 5 === 0) return palette.woodLight;
    if ((x + y + topVariant) % 2 === 0) return palette.woodMid;
    return palette.woodDark;
  });
  lineH(ox + 10, ox + 53, 7, palette.outline);
  lineH(ox + 10, ox + 53, 14, palette.outline);
  lineV(ox + 10, 7, 14, palette.outline);
  lineV(ox + 53, 7, 14, palette.outline);

  // patas metálicas
  fill(ox + 14, 15, ox + 18, 24, (x, y) => ((x + y) % 2 === 0 ? palette.metalMid : palette.metalDark));
  fill(ox + 45, 15, ox + 49, 24, (x, y) => ((x + y) % 2 === 0 ? palette.metalMid : palette.metalDark));
  lineV(ox + 14, 15, 24, palette.outline);
  lineV(ox + 18, 15, 24, palette.outline);
  lineV(ox + 45, 15, 24, palette.outline);
  lineV(ox + 49, 15, 24, palette.outline);
  lineH(ox + 14, ox + 18, 24, palette.metalLight);
  lineH(ox + 45, ox + 49, 24, palette.metalLight);
};

const drawTray = (ox) => {
  fill(ox + 25, 9, ox + 38, 13, palette.trayBody);
  lineH(ox + 25, ox + 38, 9, palette.outline);
  lineH(ox + 25, ox + 38, 13, palette.outline);
  lineV(ox + 25, 9, 13, palette.outline);
  lineV(ox + 38, 9, 13, palette.outline);
  lineH(ox + 26, ox + 37, 10, palette.trayLip);
  fill(ox + 28, 11, ox + 34, 12, palette.trayFood);
};

const drawFlipped = (ox) => {
  // mesa volcada: tablero inclinado y patas visibles hacia arriba
  fill(ox + 16, 11, ox + 47, 18, (x, y) => ((x + y) % 2 === 0 ? palette.woodMid : palette.woodDark));
  for (let i = 0; i < 6; i++) {
    lineH(ox + 16 + i, ox + 47 + i, 11 + i, palette.outline);
  }
  fill(ox + 20, 6, ox + 24, 14, palette.metalMid);
  fill(ox + 40, 8, ox + 44, 16, palette.metalMid);
  lineV(ox + 20, 6, 14, palette.outline);
  lineV(ox + 24, 6, 14, palette.outline);
  lineV(ox + 40, 8, 16, palette.outline);
  lineV(ox + 44, 8, 16, palette.outline);
  drawSimpleShadow(ox, 5);
};

const drawDamagedMarks = (ox) => {
  fill(ox + 18, 10, ox + 24, 12, palette.damage);
  fill(ox + 36, 8, ox + 42, 9, palette.damage);
  lineH(ox + 30, ox + 37, 13, palette.damage);
  lineV(ox + 29, 12, 14, palette.damage);
};

// 1. mesa vacía
const emptyX = 0;
drawBaseTable(emptyX);
drawSimpleShadow(emptyX);

// 2. mesa con bandeja
const trayX = SPRITE_WIDTH;
drawBaseTable(trayX, 1);
drawTray(trayX);
drawSimpleShadow(trayX);

// 3. mesa volcada (escenario zombie)
const flippedX = SPRITE_WIDTH * 2;
drawFlipped(flippedX);

// 4. mesa dañada
const damagedX = SPRITE_WIDTH * 3;
drawBaseTable(damagedX, 2);
drawDamagedMarks(damagedX);
drawSimpleShadow(damagedX);

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
};

const raw = Buffer.alloc((width * 4 + 1) * height);
for (let y = 0; y < height; y++) {
  const rowStart = y * (width * 4 + 1);
  raw[rowStart] = 0;
  for (let x = 0; x < width; x++) {
    const offset = rowStart + 1 + x * 4;
    const [r, g, b, a] = pixels[y][x];
    raw[offset] = r;
    raw[offset + 1] = g;
    raw[offset + 2] = b;
    raw[offset + 3] = a;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const outputPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_dining_tables_spritesheet.png');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, png);

const svgPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_dining_tables_spritesheet.svg');
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
fs.writeFileSync(svgPath, svg);

const coordinatesPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_dining_tables_spritesheet_coords.json');
const coords = {
  image: 'institutional_dining_tables_spritesheet.png',
  source: 'institutional_dining_tables_spritesheet.svg',
  spriteSize: { width: SPRITE_WIDTH, height: SPRITE_HEIGHT },
  sprites: {
    mesa_vacia: { x: 0, y: 0, width: 64, height: 32 },
    mesa_con_bandeja: { x: 64, y: 0, width: 64, height: 32 },
    mesa_volcada_zombie: { x: 128, y: 0, width: 64, height: 32 },
    mesa_danada: { x: 192, y: 0, width: 64, height: 32 },
  },
};
fs.writeFileSync(coordinatesPath, `${JSON.stringify(coords, null, 2)}\n`);

console.log(`Spritesheet PNG generado en: ${outputPath}`);
console.log(`Spritesheet SVG (no binario) generado en: ${svgPath}`);
console.log(`Coordenadas guardadas en: ${coordinatesPath}`);
