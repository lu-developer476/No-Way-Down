import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const tryGit = (...args) => {
  try { return git(...args); } catch { return null; }
};
const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

const resolveBase = () => {
  const candidates = [
    ['NWD_DIFF_BASE', process.env.NWD_DIFF_BASE],
    ['origin/main', 'origin/main'],
    ['main', 'main'],
    ['HEAD^', 'HEAD^'],
  ];
  for (const [label, candidate] of candidates) {
    if (!candidate) continue;
    const commit = tryGit('rev-parse', '--verify', `${candidate}^{commit}`);
    if (!commit) {
      if (label === 'NWD_DIFF_BASE') console.warn(`[no-binary-diff] Ignoring invalid NWD_DIFF_BASE: ${candidate}`);
      continue;
    }
    const base = tryGit('merge-base', commit, 'HEAD');
    if (base) {
      console.log(`[no-binary-diff] Selected base ${base} from ${label}.`);
      return base;
    }
  }
  console.warn(`[no-binary-diff] No commit base is available; comparing HEAD and the working tree against Git's empty tree (${emptyTree}).`);
  return emptyTree;
};

const forbiddenExtensions = /\.(?:png|jpe?g|webp|gif|bmp|ico|avif|tiff?|psd|ase|aseprite|ttf|otf|woff2?|mp3|ogg|wav|m4a|flac|mp4|webm|mov|zip|7z|rar|tar|gz|pdf)$/i;
const approvedConfigPath = resolve(root, 'game/config/approved-production-art.json');
const approvedConfig = existsSync(approvedConfigPath) ? JSON.parse(readFileSync(approvedConfigPath, 'utf8')) : { assets: [] };
const approvedPngs = new Set(approvedConfig.assets.map((asset) => asset.path));
const isApprovedPng = (path) => approvedPngs.has(path) && /^game\/public\/assets\/production-art\/(?:characters|zombies|weapons|ui)\/[^/]+\.png$/.test(path);
const inspectedTextExtensions = /\.(?:ts|tsx|js|mjs|json|md|ya?ml|css|html|svg|py|sh|bash|zsh|fish|txt|toml|ini|cfg|conf|xml|tmj|tsj)$/i;
const allowedApplicationMimeTypes = new Set([
  'application/json', 'application/ld+json', 'application/javascript',
  'application/ecmascript', 'application/xml', 'application/yaml',
  'application/x-yaml', 'application/toml',
]);
const forbiddenApplicationMimeTypes = new Set([
  'application/x-executable', 'application/x-pie-executable',
  'application/x-sharedlib', 'application/x-object', 'application/x-core',
  'application/x-dosexec', 'application/vnd.microsoft.portable-executable',
  'application/x-msdownload', 'application/wasm', 'application/octet-stream',
  'application/zip', 'application/x-7z-compressed', 'application/x-rar',
  'application/vnd.rar', 'application/x-tar', 'application/gzip',
  'application/x-gzip', 'application/x-bzip', 'application/x-bzip2',
  'application/x-xz', 'application/zstd', 'application/pdf',
]);

const normalizedMimeType = (mimeType) => mimeType.trim().toLowerCase().split(';', 1)[0];

export const isAllowedTextMimeType = (mimeType) => {
  const normalized = normalizedMimeType(mimeType);
  return normalized.startsWith('text/') || normalized === 'image/svg+xml' || allowedApplicationMimeTypes.has(normalized);
};

export const isForbiddenMimeType = (mimeType) => {
  const normalized = normalizedMimeType(mimeType);
  if (normalized === 'image/svg+xml') return false;
  return /^(?:image|audio|video|font)\//.test(normalized) || forbiddenApplicationMimeTypes.has(normalized);
};

export const getDetectedMimeType = (path, fileCommand = 'file') => execFileSync(
  fileCommand,
  ['--brief', '--mime-type', path],
  { encoding: 'utf8' },
).trim();
const forbiddenSource = [
  /data:image/i, /;base64,/i, /Buffer\.from\s*\([^)]*['"]base64['"]/s,
  /\b(?:Pillow|from\s+PIL|import\s+PIL|ImageMagick|magick\s|convert\s|ffmpeg\s)/i,
  /writeFile(?:Sync)?\s*\([^)]*\.(?:png|jpe?g|webp|gif|mp3|ogg|wav)/is,
  /(?:generate|render|export)[^\n]*(?:png|jpe?g|webp|gif|audio)/i,
  /\b(?:save_screenshot|page\.screenshot|takeScreenshot|canvas\.toDataURL|toBlob|Image\.write|Image\.save|new\s+PNG)\b/i,
  /(?:writeFile|writeFileSync)\s*\([^\n]*(?:\.png|\.jpe?g|\.webp|\.gif|\.bmp|\.ico|\.avif|\.tiff?|\.mp3|\.ogg|\.wav|\.mp4|\.webm|\.pdf|\.zip)/i,
  /(?:update[-_ ]?visual[-_ ]?baselines|baseline candidates)/i,
];
const runAudit = () => {
const base = resolveBase();
const failures = [];
// A task audit must include both committed and working-tree changes from the real merge base.
const trackedChanges = git('diff', '--name-status', '-M', '-C', base).split('\n').filter(Boolean);
const untrackedChanges = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean).map((path) => `A\t${path}`);
const changes = [...trackedChanges, ...untrackedChanges];
let warnedMissingFileCommand = false;
for (const row of changes) {
  const [status, ...paths] = row.split('\t');
  if (/^[RC]/.test(status)) failures.push(`rename/copy is forbidden: ${paths.join(' -> ')}`);
  for (const path of paths) if (forbiddenExtensions.test(path) && !isApprovedPng(path)) failures.push(`binary extension changed (${status}): ${path}`);
}
for (const row of git('diff', '--numstat', base).split('\n').filter(Boolean)) {
  const [added, removed, path] = row.split('\t');
  if ((added === '-' || removed === '-') && !isApprovedPng(path)) failures.push(`binary numstat entry: ${path}`);
}
for (const row of changes) {
  const [status, ...paths] = row.split('\t');
  if (status.startsWith('D')) continue;
  const path = paths.at(-1);
  if (isApprovedPng(path)) continue;
  if (/^game\/scripts\/audit[A-Z].*\.mjs$/.test(path)
    || path === 'game/tests/auditNoBinaryDiff.test.ts'
    // This pre-existing, explicitly reviewed workflow names visual baseline
    // candidates but does not embed or generate production binary assets.
    || path === '.github/workflows/update-visual-baselines.yml') continue;
  const bytes = readFileSync(resolve(root, path));
  if (bytes.includes(0)) failures.push(`NUL content detected: ${path}`);
  try {
    const mimeType = getDetectedMimeType(resolve(root, path));
    if (isForbiddenMimeType(mimeType)) failures.push(`forbidden MIME type (${mimeType}): ${path}`);
  } catch (error) {
    if (error?.code === 'ENOENT' && !warnedMissingFileCommand) {
      console.warn('[no-binary-diff] file(1) is unavailable; extension, numstat, NUL, and source checks remain blocking.');
      warnedMissingFileCommand = true;
    }
    // file(1) is optional; all independent fallback checks remain blocking.
  }
  if (!inspectedTextExtensions.test(path)) continue;
  const source = bytes.toString('utf8');
  for (const pattern of forbiddenSource) if (pattern.test(source)) failures.push(`forbidden binary-generation pattern ${pattern}: ${path}`);
}
if (!failures.length && changes.some((row) => row.split('\t').slice(1).some(isApprovedPng))) {
  try { execFileSync('node', ['scripts/auditApprovedProductionArt.mjs'], { cwd: resolve(root, 'game'), stdio: 'inherit' }); }
  catch { failures.push('approved production art audit failed'); }
}
if (failures.length) {
  console.error(`No-binary-diff audit failed:\n${failures.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(`No-binary-diff audit passed (${changes.length} text file changes against ${base.slice(0, 12)}).`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runAudit();
