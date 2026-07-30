import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { inflateSync } from 'node:zlib';

const repo = resolve(import.meta.dirname, '../..');
const game = resolve(repo, 'game');
const config = JSON.parse(readFileSync(resolve(game, 'config/generated-production-art.json'), 'utf8'));
const allowedRoots = ['characters', 'zombies', 'weapons', 'ui', 'environments', 'vehicles', 'cinematics'].map((part) => `game/public/assets/production-art/${part}/`);
const failures = [];
const discovered = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.png')) discovered.push(relative(repo, path).replaceAll('\\', '/'));
  }
};
walk(resolve(game, 'public/assets/production-art'));

const parsePng = (bytes) => {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('invalid PNG signature');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), colorType = bytes[25];
  let offset = 8; const idat = [];
  while (offset < bytes.length) { const n=bytes.readUInt32BE(offset); const type=bytes.toString('ascii',offset+4,offset+8); if(type==='IDAT')idat.push(bytes.subarray(offset+8,offset+8+n)); offset += n+12; }
  const raw = inflateSync(Buffer.concat(idat));
  return { width, height, colorType, nonEmpty: raw.some((value,index) => index % (width * 4 + 1) !== 0 && value !== 0) };
};

const approved = new Map(config.assets.map((asset) => [asset.path, asset]));
for (const path of discovered) if (!approved.has(path)) failures.push(`undeclared PNG: ${path}`);
for (const asset of config.assets) {
  const path = resolve(repo, asset.path);
  if (!allowedRoots.some((root) => asset.path.startsWith(root))) failures.push(`path outside production-art roots: ${asset.path}`);
  if (asset.generator !== config.generator) failures.push(`unapproved generator: ${asset.path}`);
  if (!existsSync(path)) { failures.push(`missing PNG: ${asset.path}`); continue; }
  const bytes = readFileSync(path); const sha = createHash('sha256').update(bytes).digest('hex');
  if (bytes.subarray(0, 42).toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1')) failures.push(`LFS pointer found: ${asset.path}`);
  if (sha !== asset.sha256) failures.push(`hash mismatch: ${asset.path}`);
  if (bytes.length !== asset.fileSize || bytes.length > config.maxFileSize) failures.push(`invalid file size: ${asset.path}`);
  try { const png=parsePng(bytes); if(png.width!==asset.width||png.height!==asset.height) failures.push(`dimension mismatch: ${asset.path}`); if(asset.alphaRequired&&png.colorType!==6)failures.push(`RGBA required: ${asset.path}`); if(!png.nonEmpty)failures.push(`empty image: ${asset.path}`); } catch(error) { failures.push(`${error.message}: ${asset.path}`); }
  const publicPath = asset.path.replace(/^game\/public\//, '');
  const manifestReference = readFileSync(resolve(game,'public/assets/production-art/characters/character_art_manifest.json'),'utf8').includes(publicPath);
  const runtime = readdirSync(resolve(game,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()&&/\.(ts|json)$/.test(e.name)).some(e=>readFileSync(resolve(e.parentPath,e.name),'utf8').includes(publicPath));
  if (!runtime && !manifestReference) failures.push(`approved PNG has no runtime reference: ${asset.path}`);
}
try { execFileSync('python3',['scripts/art/generateProductionCharacters.py','--verify'],{cwd:game,stdio:'pipe'}); } catch { failures.push('deterministic regeneration or frame uniqueness verification failed'); }
if (failures.length) { console.error(failures.map(f=>`- ${f}`).join('\n')); process.exit(1); }
console.log(`Generated production art audit passed (${config.assets.length} PNG files).`);
