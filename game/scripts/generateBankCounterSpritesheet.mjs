import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 48;
const variants = 5;

const width = TILE_WIDTH * variants;
const height = TILE_HEIGHT;

const palette = {
  outline: [56, 55, 52, 255],
  marbleA: [225, 222, 213, 255],
  marbleB: [212, 208, 198, 255],
  marbleVein: [194, 188, 176, 255],
  stoneTop: [168, 161, 148, 255],
  stoneMid: [143, 135, 121, 255],
  stoneDark: [114, 106, 93, 255],
  trim: [123, 115, 104, 255],
  glass: [148, 188, 212, 210],
  glassHi: [202, 231, 246, 220],
  screen: [64, 97, 109, 255],
  screenHi: [116, 154, 167, 255],
  keyboard: [93, 87, 80, 255],
  chairBack: [98, 49, 44, 255],
  chairSeat: [131, 66, 59, 255],
  chairLeg: [70, 64, 60, 255],
};

const pixels = Array.from({ length: height }, () =>
  Array.from({ length: width }, () => [0, 0, 0, 0]),
);

const setPixel = (x, y, color) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  pixels[y][x] = color;
};

const hLine = (x0, x1, y, color) => {
  for (let x = x0; x <= x1; x++) setPixel(x, y, color);
};

const vLine = (x, y0, y1, color) => {
  for (let y = y0; y <= y1; y++) setPixel(x, y, color);
};

const fill = (x0, y0, x1, y1, colorFn) => {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      setPixel(x, y, typeof colorFn === 'function' ? colorFn(x, y) : colorFn);
    }
  }
};

const drawBaseCounter = (ox) => {
  // cubierta de mármol
  fill(ox + 1, 8, ox + 62, 18, (x, y) => {
    if ((x * 5 + y * 3) % 19 === 0) return palette.marbleVein;
    return (x + y) % 2 === 0 ? palette.marbleA : palette.marbleB;
  });

  // borde superior / separaciones modulares
  hLine(ox + 1, ox + 62, 8, palette.outline);
  hLine(ox + 1, ox + 62, 18, palette.trim);
  vLine(ox + 1, 8, 18, palette.outline);
  vLine(ox + 62, 8, 18, palette.outline);

  // base de piedra
  fill(ox + 2, 19, ox + 61, 45, (x, y) => {
    if ((x + y) % 9 === 0) return palette.stoneTop;
    if ((x * 2 + y * 3) % 11 === 0) return palette.stoneDark;
    return palette.stoneMid;
  });
  hLine(ox + 2, ox + 61, 19, palette.trim);
  hLine(ox + 2, ox + 61, 45, palette.outline);
  vLine(ox + 2, 19, 45, palette.outline);
  vLine(ox + 61, 19, 45, palette.outline);

  // junta modular pensada para repetir horizontalmente
  vLine(ox, 10, 44, [0, 0, 0, 0]);
  vLine(ox + 63, 10, 44, [0, 0, 0, 0]);
};

const drawEndCap = (ox) => {
  // remate lateral más sólido
  fill(ox + 56, 19, ox + 61, 45, palette.stoneDark);
  hLine(ox + 56, ox + 61, 19, palette.outline);
  vLine(ox + 56, 19, 45, palette.outline);
};

const drawGlassDivider = (ox) => {
  fill(ox + 28, 1, ox + 35, 17, (x, y) => ((x + y) % 5 === 0 ? palette.glassHi : palette.glass));
  hLine(ox + 28, ox + 35, 1, palette.outline);
  vLine(ox + 28, 1, 17, palette.outline);
  vLine(ox + 35, 1, 17, palette.outline);
  hLine(ox + 28, ox + 35, 17, palette.trim);
};

const drawComputer = (ox) => {
  // monitor
  fill(ox + 34, 3, ox + 49, 11, palette.screen);
  fill(ox + 35, 4, ox + 48, 10, (x, y) => ((x + y) % 7 === 0 ? palette.screenHi : palette.screen));
  hLine(ox + 34, ox + 49, 3, palette.outline);
  vLine(ox + 34, 3, 11, palette.outline);
  vLine(ox + 49, 3, 11, palette.outline);
  hLine(ox + 40, ox + 43, 12, palette.keyboard);
  // teclado
  fill(ox + 35, 14, ox + 46, 16, (x, y) => ((x + y) % 2 === 0 ? palette.keyboard : palette.trim));
};

const drawChairBehind = (ox) => {
  fill(ox + 10, 2, ox + 21, 12, palette.chairBack);
  fill(ox + 11, 13, ox + 20, 16, palette.chairSeat);
  hLine(ox + 10, ox + 21, 2, palette.outline);
  vLine(ox + 10, 2, 16, palette.outline);
  vLine(ox + 21, 2, 16, palette.outline);
  vLine(ox + 12, 17, ox + 19, palette.chairLeg);
};

// 1) módulo central
const moduleCentralX = 0;
drawBaseCounter(moduleCentralX);

// 2) módulo extremo
const moduleEndX = TILE_WIDTH;
drawBaseCounter(moduleEndX);
drawEndCap(moduleEndX);

// 3) módulo con vidrio
const moduleGlassX = TILE_WIDTH * 2;
drawBaseCounter(moduleGlassX);
drawGlassDivider(moduleGlassX);

// 4) módulo con computadora
const moduleComputerX = TILE_WIDTH * 3;
drawBaseCounter(moduleComputerX);
drawComputer(moduleComputerX);

// 5) módulo con silla detrás
const moduleChairX = TILE_WIDTH * 4;
drawBaseCounter(moduleChairX);
drawChairBehind(moduleChairX);

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
const outputPath = path.resolve(scriptDir, '../public/assets/images/tilesets/bank_counter_spritesheet.png');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, png);

const svgPath = path.resolve(scriptDir, '../public/assets/images/tilesets/bank_counter_spritesheet.svg');
const rows = [];
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const [r, g, b, a] = pixels[y][x];
    if (a === 0) continue;
    rows.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})" />`);
  }
}
const svg = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">`,
  ...rows,
  '</svg>',
  '',
].join('\n');
fs.writeFileSync(svgPath, svg);

const coordinatesPath = path.resolve(scriptDir, '../public/assets/images/tilesets/bank_counter_spritesheet_coords.json');
const coords = {
  image: 'bank_counter_spritesheet.png',
  source: 'bank_counter_spritesheet.svg',
  spriteSize: { width: TILE_WIDTH, height: TILE_HEIGHT },
  sprites: {
    modulo_central: { x: 0, y: 0, width: 64, height: 48 },
    modulo_extremo: { x: 64, y: 0, width: 64, height: 48 },
    modulo_con_vidrio: { x: 128, y: 0, width: 64, height: 48 },
    modulo_con_computadora: { x: 192, y: 0, width: 64, height: 48 },
    modulo_con_silla_detras: { x: 256, y: 0, width: 64, height: 48 },
  },
};
fs.writeFileSync(coordinatesPath, `${JSON.stringify(coords, null, 2)}\n`);

console.log(`Spritesheet PNG generado en: ${outputPath}`);
console.log(`Spritesheet SVG (no binario) generado en: ${svgPath}`);
console.log(`Coordenadas guardadas en: ${coordinatesPath}`);
