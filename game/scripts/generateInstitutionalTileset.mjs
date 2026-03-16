import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TILE_SIZE = 32;
const columns = 4;
const rows = 2;
const width = columns * TILE_SIZE;
const height = rows * TILE_SIZE;

const palette = {
  bgStone: [205, 198, 182, 255],
  stoneLight: [223, 216, 197, 255],
  stoneMid: [186, 177, 158, 255],
  stoneDark: [149, 140, 125, 255],
  floorRed: [124, 72, 64, 255],
  floorRed2: [138, 83, 74, 255],
  floorHigh: [167, 111, 96, 255],
  granite: [108, 99, 93, 255],
  window: [109, 144, 170, 255],
  windowHi: [168, 206, 230, 255],
  ceiling: [79, 82, 89, 255],
  light: [251, 244, 202, 255],
  edgeDark: [74, 67, 58, 255],
  gold: [178, 148, 85, 255],
};

const pixels = Array.from({ length: height }, () =>
  Array.from({ length: width }, () => [0, 0, 0, 0]),
);

const setPixel = (x, y, color) => {
  pixels[y][x] = color;
};

const drawTile = (index, painter) => {
  const tx = (index % columns) * TILE_SIZE;
  const ty = Math.floor(index / columns) * TILE_SIZE;
  painter(tx, ty);
};

const paintFloor = (tx, ty) => {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let color = (x + y) % 2 === 0 ? palette.floorRed : palette.floorRed2;
      if ((x * 3 + y * 5) % 23 === 0) color = palette.granite;
      if ((x + y) % 17 === 0) color = palette.floorHigh;
      setPixel(tx + x, ty + y, color);
    }
  }
};

const paintFloorEdge = (tx, ty) => {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      if (y < 6) {
        setPixel(tx + x, ty + y, (x + y) % 3 === 0 ? palette.stoneMid : palette.stoneLight);
      } else {
        setPixel(tx + x, ty + y, (x + y) % 2 === 0 ? palette.floorRed2 : palette.floorRed);
      }
    }
  }
  for (let x = 0; x < TILE_SIZE; x++) {
    setPixel(tx + x, ty + 5, palette.edgeDark);
    if (x % 6 === 0) setPixel(tx + x, ty + 4, palette.gold);
  }
};

const paintWall = (tx, ty) => {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      let color = palette.bgStone;
      if ((x + y) % 5 === 0) color = palette.stoneLight;
      if ((x * 2 + y) % 7 === 0) color = palette.stoneMid;
      setPixel(tx + x, ty + y, color);
    }
  }
};

const paintColumnBase = (tx, ty) => {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      setPixel(tx + x, ty + y, palette.bgStone);
    }
  }
  for (let y = 18; y < 32; y++) {
    for (let x = 4; x < 28; x++) {
      setPixel(tx + x, ty + y, (x + y) % 2 === 0 ? palette.stoneLight : palette.stoneMid);
    }
  }
};

const paintColumnVertical = (tx, ty) => {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      setPixel(tx + x, ty + y, palette.bgStone);
    }
  }
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 10; x < 22; x++) {
      let color = [205, 196, 178, 255];
      if (x === 10 || x === 21) color = palette.stoneDark;
      if (x === 11 || x === 20) color = palette.stoneMid;
      setPixel(tx + x, ty + y, color);
    }
  }
};

const paintTallWindow = (tx, ty) => {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      setPixel(tx + x, ty + y, palette.bgStone);
    }
  }
  for (let y = 4; y < 30; y++) {
    for (let x = 6; x < 26; x++) {
      const color = y < 10 || (x + y) % 5 === 0 ? palette.windowHi : palette.window;
      setPixel(tx + x, ty + y, color);
    }
  }
};

const paintCeilingPanel = (tx, ty) => {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      setPixel(tx + x, ty + y, palette.ceiling);
    }
  }
  for (let y = 6; y < 26; y++) {
    for (let x = 6; x < 26; x++) {
      setPixel(tx + x, ty + y, (x + y) % 3 === 0 ? [235, 227, 186, 255] : palette.light);
    }
  }
};

const paintPlatformEdge = (tx, ty) => {
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      setPixel(tx + x, ty + y, y < 8 ? palette.stoneLight : palette.stoneMid);
    }
  }
  for (let x = 0; x < TILE_SIZE; x++) {
    setPixel(tx + x, ty + 7, palette.edgeDark);
    if (x % 8 === 0) setPixel(tx + x, ty + 8, palette.gold);
  }
};

const painters = [
  paintFloor,
  paintFloorEdge,
  paintWall,
  paintColumnBase,
  paintColumnVertical,
  paintTallWindow,
  paintCeilingPanel,
  paintPlatformEdge,
];

painters.forEach((paint, index) => drawTile(index, paint));

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
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
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
const outputPath = path.resolve(scriptDir, '../public/assets/images/tilesets/institutional_hall_tileset.png');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, png);

console.log(`Generated ${outputPath} (${width}x${height})`);
