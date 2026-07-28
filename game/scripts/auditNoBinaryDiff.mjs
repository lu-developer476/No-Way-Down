import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const base = git('merge-base', 'main', 'HEAD');
const forbiddenExtensions = /\.(?:png|jpe?g|webp|gif|bmp|ico|avif|tiff?|psd|ase|aseprite|ttf|otf|woff2?|mp3|ogg|wav|m4a|flac|mp4|webm|mov|zip|7z|rar|tar|gz|pdf)$/i;
const forbiddenSource = [
  /data:image/i, /;base64,/i, /Buffer\.from\s*\([^)]*['"]base64['"]/s,
  /\b(?:Pillow|from\s+PIL|import\s+PIL|ImageMagick|magick\s|convert\s|ffmpeg\s)/i,
  /writeFile(?:Sync)?\s*\([^)]*\.(?:png|jpe?g|webp|gif|mp3|ogg|wav)/is,
  /(?:generate|render|export)[^\n]*(?:png|jpe?g|webp|gif|audio)/i,
];
const failures = [];
const changes = git('diff', '--name-status', '-M', '-C', `${base}...HEAD`).split('\n').filter(Boolean);
for (const row of changes) {
  const [status, ...paths] = row.split('\t');
  if (/^[RC]/.test(status)) failures.push(`rename/copy is forbidden: ${paths.join(' -> ')}`);
  for (const path of paths) if (forbiddenExtensions.test(path)) failures.push(`binary extension changed (${status}): ${path}`);
}
for (const row of git('diff', '--numstat', `${base}...HEAD`).split('\n').filter(Boolean)) {
  const [added, removed, path] = row.split('\t');
  if (added === '-' || removed === '-') failures.push(`binary numstat entry: ${path}`);
}
for (const row of changes) {
  const [status, ...paths] = row.split('\t');
  if (status.startsWith('D')) continue;
  const path = paths.at(-1);
  if (path === 'game/scripts/auditNoBinaryDiff.mjs') continue;
  if (!/\.(?:ts|tsx|js|mjs|json|md|ya?ml|css|html|svg)$/i.test(path)) continue;
  const source = readFileSync(resolve(root, path), 'utf8');
  for (const pattern of forbiddenSource) if (pattern.test(source)) failures.push(`forbidden binary-generation pattern ${pattern}: ${path}`);
}
if (failures.length) {
  console.error(`No-binary-diff audit failed:\n${failures.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`No-binary-diff audit passed (${changes.length} text file changes against ${base.slice(0, 12)}).`);
