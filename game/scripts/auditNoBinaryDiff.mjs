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
  /\b(?:save_screenshot|page\.screenshot|takeScreenshot|canvas\.toDataURL|toBlob|Image\.write|Image\.save|new\s+PNG)\b/i,
  /(?:writeFile|writeFileSync)\s*\([^\n]*(?:\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.ico|\.avif|\.tiff?|\.mp3|\.ogg|\.wav|\.mp4|\.webm|\.pdf|\.zip)/i,
  /(?:update[-_ ]?visual[-_ ]?baselines|baseline candidates)/i,
];
const failures = [];
// A task audit must include both committed and working-tree changes from the real merge base.
const trackedChanges = git('diff', '--name-status', '-M', '-C', base).split('\n').filter(Boolean);
const untrackedChanges = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean).map((path) => `A\t${path}`);
const changes = [...trackedChanges, ...untrackedChanges];
for (const row of changes) {
  const [status, ...paths] = row.split('\t');
  if (/^[RC]/.test(status)) failures.push(`rename/copy is forbidden: ${paths.join(' -> ')}`);
  for (const path of paths) if (forbiddenExtensions.test(path)) failures.push(`binary extension changed (${status}): ${path}`);
}
for (const row of git('diff', '--numstat', base).split('\n').filter(Boolean)) {
  const [added, removed, path] = row.split('\t');
  if (added === '-' || removed === '-') failures.push(`binary numstat entry: ${path}`);
}
for (const row of changes) {
  const [status, ...paths] = row.split('\t');
  if (status.startsWith('D')) continue;
  const path = paths.at(-1);
  if (path === 'game/scripts/auditNoBinaryDiff.mjs') continue;
  const bytes = readFileSync(resolve(root, path));
  if (bytes.includes(0)) failures.push(`NUL content detected: ${path}`);
  try {
    const detected = execFileSync('file', ['--brief', resolve(root, path)], { encoding: 'utf8' });
    if (/image|audio|video|font|archive|executable|binary data/i.test(detected)) failures.push(`forbidden file type (${detected.trim()}): ${path}`);
  } catch { /* file(1) is optional; extension, numstat and NUL checks remain blocking. */ }
  if (!/\.(?:ts|tsx|js|mjs|json|md|ya?ml|css|html|svg)$/i.test(path)) continue;
  const source = bytes.toString('utf8');
  for (const pattern of forbiddenSource) if (pattern.test(source)) failures.push(`forbidden binary-generation pattern ${pattern}: ${path}`);
}
if (failures.length) {
  console.error(`No-binary-diff audit failed:\n${failures.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`No-binary-diff audit passed (${changes.length} text file changes against ${base.slice(0, 12)}).`);
