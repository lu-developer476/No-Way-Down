import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SPRITE_WIDTH = 32;
const SPRITE_HEIGHT = 96;
const variants = 4;

const width = SPRITE_WIDTH * variants;
const height = SPRITE_HEIGHT;

const palette = {
  transparent: [0, 0, 0, 0],
  outline: [66, 69, 74, 255],
  stoneShadow: [141, 147, 156, 255],
  stoneMid: [179, 185, 193, 255],
  stoneLight: [210, 216, 224, 255],
  stoneHighlight: [229, 234, 240, 255],
  crack: [96, 95, 101, 255],
  deepShadow: [91, 97, 106, 255],
  castShadow: [23, 24, 28, 125],
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

const drawRectOutline = (x0, y0, x1, y1, color) => {
  lineH(x0, x1, y0, color);
  lineH(x0, x1, y1, color);
  lineV(x0, y0, y1, color);
  lineV(x1, y0, y1, color);
};

const drawColumnBody = (ox, shadowed = false) => {
  const left = ox + 8;
  const right = ox + 23;
  const top = 17;
  const bottom = 77;

  fill(left, top, right, bottom, (x, y) => {
    const local = x - left;
    if (shadowed) {
      if (local <= 2) return palette.deepShadow;
      if (local <= 7) return palette.stoneShadow;
      if ((x + y) % 3 === 0) return palette.stoneMid;
      return palette.stoneShadow;
    }
    if (local <= 2) return palette.stoneShadow;
    if (local <= 6) return palette.stoneMid;
    if (local <= 11) return (x + y) % 4 === 0 ? palette.stoneHighlight : palette.stoneLight;
    return palette.stoneMid;
  });

  drawRectOutline(left, top, right, bottom, palette.outline);
  lineV(left + 3, top + 1, bottom - 1, shadowed ? palette.stoneShadow : palette.stoneLight);
  lineV(right - 3, top + 1, bottom - 1, shadowed ? palette.deepShadow : palette.stoneMid);
};

const drawCapital = (ox, shadowed = false) => {
  const left = ox + 6;
  const right = ox + 25;
  const top = 6;
  const bottom = 16;

  fill(left, top, right, bottom, (x, y) => {
    if (shadowed) return (x + y) % 2 === 0 ? palette.stoneShadow : palette.deepShadow;
    if (y <= 8) return palette.stoneLight;
    if ((x + y) % 3 === 0) return palette.stoneHighlight;
    return palette.stoneMid;
  });
  drawRectOutline(left, top, right, bottom, palette.outline);
  lineH(left + 2, right - 2, top + 2, shadowed ? palette.stoneShadow : palette.stoneHighlight);
  lineH(left + 1, right - 1, bottom - 2, shadowed ? palette.deepShadow : palette.stoneShadow);
};

const drawBase = (ox, shadowed = false) => {
  const left = ox + 4;
  const right = ox + 27;
  const top = 78;
  const bottom = 95;

  fill(left, top, right, bottom, (x, y) => {
    if (shadowed) {
      if (y > 90) return palette.deepShadow;
      return (x + y) % 2 === 0 ? palette.stoneShadow : palette.deepShadow;
    }
    if (y > 90) return palette.stoneShadow;
    if ((x + y) % 5 === 0) return palette.stoneHighlight;
    return y < 84 ? palette.stoneLight : palette.stoneMid;
  });

  drawRectOutline(left, top, right, bottom, palette.outline);
  lineH(left + 2, right - 2, top + 2, shadowed ? palette.stoneShadow : palette.stoneHighlight);
  lineH(left + 1, right - 1, bottom - 3, shadowed ? palette.deepShadow : palette.stoneShadow);
};

const drawGroundShadow = (ox) => {
  fill(ox + 2, 92, ox + 29, 95, (x, y) => ((x + y) % 4 === 0 ? palette.transparent : palette.castShadow));
};

const drawDamage = (ox) => {
  lineV(ox + 16, 28, 45, palette.crack);
  lineH(ox + 14, ox + 17, 33, palette.crack);
  lineH(ox + 16, ox + 19, 40, palette.crack);
  lineV(ox + 11, 55, 67, palette.crack);
  lineH(ox + 9, ox + 12, 62, palette.crack);

  fill(ox + 20, 50, ox + 22, 55, palette.deepShadow);
  lineV(ox + 19, 50, 55, palette.outline);
  lineV(ox + 23, 50, 55, palette.outline);
  lineH(ox + 19, ox + 23, 50, palette.outline);
  lineH(ox + 19, ox + 23, 55, palette.outline);
};

// 1) base de columna
const baseOnlyX = 0;
drawBase(baseOnlyX, false);
drawGroundShadow(baseOnlyX);

// 2) columna completa
const completeX = SPRITE_WIDTH;
drawCapital(completeX, false);
drawColumnBody(completeX, false);
drawBase(completeX, false);
drawGroundShadow(completeX);

// 3) columna dañada
const damagedX = SPRITE_WIDTH * 2;
drawCapital(damagedX, false);
drawColumnBody(damagedX, false);
drawBase(damagedX, false);
drawDamage(damagedX);
drawGroundShadow(damagedX);

// 4) columna en sombra
const shadowX = SPRITE_WIDTH * 3;
drawCapital(shadowX, true);
drawColumnBody(shadowX, true);
drawBase(shadowX, true);
drawGroundShadow(shadowX);

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
const outputPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_stone_columns_spritesheet.png');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, png);

const svgPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_stone_columns_spritesheet.svg');
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

const coordinatesPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_stone_columns_spritesheet_coords.json');
const coords = {
  image: 'institutional_stone_columns_spritesheet.png',
  source: 'institutional_stone_columns_spritesheet.svg',
  spriteSize: { width: SPRITE_WIDTH, height: SPRITE_HEIGHT },
  sprites: {
    base_columna: { x: 0, y: 0, width: 32, height: 96 },
    columna_completa: { x: 32, y: 0, width: 32, height: 96 },
    columna_danada: { x: 64, y: 0, width: 32, height: 96 },
    columna_sombra: { x: 96, y: 0, width: 32, height: 96 },
  },
};
fs.writeFileSync(coordinatesPath, `${JSON.stringify(coords, null, 2)}\n`);

console.log(`Spritesheet PNG generado en: ${outputPath}`);
console.log(`Spritesheet SVG (no binario) generado en: ${svgPath}`);
console.log(`Coordenadas guardadas en: ${coordinatesPath}`);
