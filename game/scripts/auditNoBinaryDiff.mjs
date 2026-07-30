import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const binaryExtension = '(?:png|jpe?g|webp|gif|bmp|ico|avif|tiff?|psd|ase|aseprite|ttf|otf|woff2?|mp3|ogg|wav|m4a|flac|mp4|webm|mov|zip|7z|rar|tar|gz|pdf)';
const forbiddenExtensions = new RegExp(`\\.${binaryExtension}$`, 'i');
const inspectedTextExtensions = /\.(?:ts|tsx|js|mjs|json|md|ya?ml|css|html|svg|py|sh|bash|zsh|fish|txt|toml|ini|cfg|conf|xml|tmj|tsj)$/i;
const approvedGenerator = /^game\/scripts\/art\//;
const approvedOutput = /^game\/public\/assets\/production-art\/.*\.png$/i;
const allowedApplicationMimeTypes = new Set(['application/json', 'application/ld+json', 'application/javascript', 'application/ecmascript', 'application/xml', 'application/yaml', 'application/x-yaml', 'application/toml']);
const forbiddenApplicationMimeTypes = new Set(['application/x-executable', 'application/x-pie-executable', 'application/x-sharedlib', 'application/x-object', 'application/x-core', 'application/x-dosexec', 'application/vnd.microsoft.portable-executable', 'application/x-msdownload', 'application/wasm', 'application/octet-stream', 'application/zip', 'application/x-7z-compressed', 'application/x-rar', 'application/vnd.rar', 'application/x-tar', 'application/gzip', 'application/x-gzip', 'application/x-bzip', 'application/x-bzip2', 'application/x-xz', 'application/zstd', 'application/pdf']);

const firstMatch = (source, rules) => {
  for (const [ruleId, pattern] of rules) {
    const match = pattern.exec(source);
    if (match) return { ruleId, index: match.index, fragment: match[0] };
  }
  return null;
};

const binaryWriteRules = [
  ['binary-write', new RegExp(`\\b(?:fs\\.promises\\.)?writeFile(?:Sync)?\\s*\\(\\s*['\"\\"][^'\"\\n]*\\.${binaryExtension}(?:[?'\"\\\\])`, 'i')],
  ['sharp-image-write', /\bsharp\s*\([^)]*\)[\s\S]{0,500}?\.(?:toFile|png|jpeg|webp|gif)\s*\(/i],
  ['image-object-write', /\bImage\.(?:save|write)\s*\(/i],
];
const imageEncodingRules = [
  ['canvas-encoding', /\b(?:canvas\.)?toDataURL\s*\(/i],
  ['canvas-encoding', /\b(?:canvas\.)?toBlob\s*\(/i],
  ['png-constructor', /\bnew\s+PNG\s*\(/i],
];
const screenshotRules = [['screenshot', /\b(?:page\.)?screenshot\s*\(/i], ['screenshot', /\bsave_screenshot\s*\(/i]];
const embeddedPayloadRules = [
  ['embedded-image-data-url', /data:image\/[a-z0-9.+-]+(?:;[a-z0-9=.+-]+)*;base64,/i],
  ['embedded-image-base64', /(?:iVBORw0KGgo|\/9j\/|R0lGOD(?:lh|dh)|UklGR)[A-Za-z0-9+/=]{8,}/],
  ['base64-binary-buffer', /Buffer\.from\s*\([^)]*['"]base64['"]/is],
];
const generatorImportRules = [
  ['pillow-import', /\b(?:from\s+PIL\s+import|import\s+PIL\b|import\s+Pillow\b)/i],
  ['imagemagick', /\b(?:ImageMagick|magick\s+(?:convert|mogrify)|convert\s+[^\n]*(?:png|jpe?g|webp|gif))\b/i],
  ['ffmpeg', /\bffmpeg\b/i],
];

export const containsBinaryWriteCall = (source) => Boolean(firstMatch(source, binaryWriteRules));
export const containsImageEncodingCall = (source) => Boolean(firstMatch(source, imageEncodingRules));
export const containsScreenshotCall = (source) => Boolean(firstMatch(source, screenshotRules));
export const containsEmbeddedBinaryPayload = (source) => Boolean(firstMatch(source, embeddedPayloadRules));
export const containsForbiddenGeneratorImport = (path, source) => !approvedGenerator.test(path) && Boolean(firstMatch(source, generatorImportRules));

export function auditTextSource(path, source) {
  const rules = [...binaryWriteRules, ...imageEncodingRules, ...screenshotRules, ...embeddedPayloadRules];
  if (!approvedGenerator.test(path)) rules.push(...generatorImportRules);
  const match = firstMatch(source, rules);
  if (!match) return null;
  const before = source.slice(0, match.index);
  const line = before.split('\n').length;
  const column = match.index - before.lastIndexOf('\n');
  return { ruleId: match.ruleId, path, line, column, fragment: match.fragment.replace(/\s+/g, ' ').slice(0, 160) };
}

const normalizedMimeType = (mimeType) => mimeType.trim().toLowerCase().split(';', 1)[0];
export const isAllowedTextMimeType = (mimeType) => { const value = normalizedMimeType(mimeType); return value.startsWith('text/') || value === 'image/svg+xml' || allowedApplicationMimeTypes.has(value); };
export const isForbiddenMimeType = (mimeType) => { const value = normalizedMimeType(mimeType); return value !== 'image/svg+xml' && (/^(?:image|audio|video|font)\//.test(value) || forbiddenApplicationMimeTypes.has(value)); };
export const getDetectedMimeType = (path, fileCommand = 'file') => execFileSync(fileCommand, ['--brief', '--mime-type', path], { encoding: 'utf8' }).trim();

export function resolveDiffBase({ env = process.env, git }) {
  const head = git('rev-parse', 'HEAD');
  const event = env.GITHUB_EVENT_NAME || env.NWD_DIFF_EVENT || 'local';
  const explicit = env.NWD_DIFF_BASE?.trim();
  let base = null;
  if (explicit && !/^0+$/.test(explicit)) base = git('rev-parse', '--verify', `${explicit}^{commit}`, { optional: true });
  if (!base && event === 'pull_request') base = git('rev-parse', '--verify', `${env.GITHUB_BASE_SHA || ''}^{commit}`, { optional: true });
  if (!base && event === 'push') base = git('rev-parse', '--verify', `${env.GITHUB_EVENT_BEFORE || ''}^{commit}`, { optional: true });
  if (!base) base = git('rev-parse', '--verify', 'HEAD^', { optional: true });
  if (!base) return { event, head, base: emptyTree, mergeBase: emptyTree, firstCommit: true };
  const mergeBase = git('merge-base', base, head, { optional: true });
  if (!mergeBase) throw new Error(`Invalid diff base ${base}: it has no merge-base with ${head}`);
  return { event, head, base, mergeBase, firstCommit: false };
}

function runAudit() {
  const rawGit = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const git = (...args) => {
    const options = typeof args.at(-1) === 'object' ? args.pop() : {};
    try { return rawGit(...args); } catch (error) { if (options.optional) return null; throw error; }
  };
  let range;
  try { range = resolveDiffBase({ git }); } catch (error) { console.error(`[no-binary-diff] ${error.message}`); process.exit(1); }
  const base = range.mergeBase;
  const approvedConfigPath = resolve(root, 'game/config/approved-production-art.json');
  const approvedConfig = existsSync(approvedConfigPath) ? JSON.parse(readFileSync(approvedConfigPath, 'utf8')) : { assets: [] };
  const approvedPngs = new Set(approvedConfig.assets.map((asset) => asset.path));
  const isApprovedPng = (path) => approvedOutput.test(path) && approvedPngs.has(path);
  const tracked = git('diff', '--name-status', '-M', '-C', base).split('\n').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean).map((path) => `A\t${path}`);
  const changes = [...tracked, ...untracked];
  const failures = [];
  let inspected = 0;
  let warnedFile = false;
  console.log(`[no-binary-diff] event=${range.event} head=${range.head} base=${range.base} merge-base=${range.mergeBase}`);
  console.log(`[no-binary-diff] modified files (${changes.length}): ${changes.map((row) => row.split('\t').at(-1)).join(', ') || '(none)'}`);
  for (const row of changes) {
    const [status, ...paths] = row.split('\t');
    if (/^[RC]/.test(status)) failures.push(`ruleId=rename-copy file=${paths.at(-1)} line=1 column=1 fragment=${paths.join(' -> ')}`);
    for (const path of paths) if (forbiddenExtensions.test(path) && !isApprovedPng(path)) failures.push(`ruleId=binary-extension file=${path} line=1 column=1 fragment=${path}`);
  }
  for (const row of git('diff', '--numstat', base).split('\n').filter(Boolean)) {
    const [added, removed, path] = row.split('\t');
    if ((added === '-' || removed === '-') && !isApprovedPng(path)) failures.push(`ruleId=binary-numstat file=${path} line=1 column=1 fragment=${added}\t${removed}`);
  }
  const classifyPath = (path) => {
    const indexEntry = git('ls-files', '-s', '--', path, { optional: true });
    if (indexEntry?.startsWith('160000 ')) return { kind: 'gitlink' };
    try {
      const stat = lstatSync(resolve(root, path));
      if (stat.isSymbolicLink()) return { kind: 'symlink', target: readlinkSync(resolve(root, path)) };
      if (stat.isDirectory()) return { kind: 'directory' };
      if (stat.isFile()) return { kind: 'file' };
      return { kind: 'unsupported' };
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ELOOP') return { kind: 'missing', error: error.code };
      return { kind: 'unsupported', error: error?.code || error?.message };
    }
  };
  for (const row of changes) {
    const [status, ...paths] = row.split('\t');
    if (status.startsWith('D')) continue;
    const path = paths.at(-1);
    if (isApprovedPng(path)) continue;
    const pathType = classifyPath(path);
    if (pathType.kind === 'gitlink') { failures.push(`ruleId=changed-gitlink file=${path} line=1 column=1 fragment=gitlink`); continue; }
    if (pathType.kind === 'symlink') { failures.push(`ruleId=changed-symlink file=${path} line=1 column=1 fragment=${JSON.stringify(pathType.target)}`); continue; }
    if (pathType.kind === 'directory') { failures.push(`ruleId=unexpected-directory-path file=${path} line=1 column=1 fragment=directory`); continue; }
    if (pathType.kind === 'missing') { failures.push(`ruleId=missing-changed-path file=${path} line=1 column=1 fragment=${pathType.error}`); continue; }
    if (pathType.kind !== 'file') { failures.push(`ruleId=unsupported-path-type file=${path} line=1 column=1 fragment=${pathType.error || pathType.kind}`); continue; }
    let bytes;
    try { bytes = readFileSync(resolve(root, path)); }
    catch (error) { failures.push(`ruleId=unreadable-changed-path file=${path} line=1 column=1 fragment=${error?.code || error?.message}`); continue; }
    inspected += 1;
    if (bytes.includes(0)) failures.push(`ruleId=nul-byte file=${path} line=1 column=1 fragment=NUL byte`);
    try { const mime = getDetectedMimeType(resolve(root, path)); if (isForbiddenMimeType(mime)) failures.push(`ruleId=binary-mime file=${path} line=1 column=1 fragment=${mime}`); }
    catch (error) { if (error?.code === 'ENOENT' && !warnedFile) { console.warn('[no-binary-diff] file(1) unavailable; fallback checks remain blocking.'); warnedFile = true; } }
    const isAuditImplementation = /^game\/scripts\/audit[A-Z].*\.mjs$/.test(path) || path === 'game/tests/auditNoBinaryDiff.test.ts';
    if (inspectedTextExtensions.test(path) && !isAuditImplementation) { const issue = auditTextSource(path, bytes.toString('utf8')); if (issue) failures.push(`ruleId=${issue.ruleId} file=${issue.path} line=${issue.line} column=${issue.column} fragment=${JSON.stringify(issue.fragment)}`); }
  }
  console.log(`[no-binary-diff] inspected files=${inspected}`);
  if (failures.length) { console.error(`No-binary-diff audit failed:\n${failures.map((item) => `- ${item}`).join('\n')}`); process.exit(1); }
  console.log('No-binary-diff audit passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runAudit();
