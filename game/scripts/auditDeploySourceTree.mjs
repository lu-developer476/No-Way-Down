import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: args.includes('-z') ? 'buffer' : 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 100 * 1024 * 1024 });
const fail = (message) => { throw new Error(message); };
const trailer = (message, name) => message.split(/\r?\n/).map((line) => line.match(new RegExp(`^${name}:\\s*(.+)$`, 'i'))?.[1]).filter(Boolean).at(-1) || '';

export function runAudit() {
  let deployCommit = '';
  let currentTree = '';
  try {
    deployCommit = git('rev-parse', '--verify', 'HEAD^{commit}').trim();
    currentTree = git('rev-parse', '--verify', 'HEAD^{tree}').trim();
  } catch { fail('HEAD and its tree must exist'); }
  if (!/^[0-9a-f]{40}$/.test(currentTree)) fail('HEAD tree SHA is invalid');
  const message = git('log', '-1', '--format=%B', 'HEAD');
  const sourceShaTrailer = trailer(message, 'Source-GitHub-SHA');
  const sourceTreeTrailer = trailer(message, 'Source-GitHub-Tree');
  if (sourceShaTrailer || sourceTreeTrailer) {
    if (!/^[0-9a-f]{40}$/.test(sourceShaTrailer)) fail('snapshot commit requires a valid Source-GitHub-SHA trailer');
    if (!/^[0-9a-f]{40}$/.test(sourceTreeTrailer)) fail('snapshot commit requires a valid Source-GitHub-Tree trailer');
  }
  if (sourceTreeTrailer && sourceTreeTrailer !== currentTree) fail(`Source-GitHub-Tree ${sourceTreeTrailer} does not match current tree ${currentTree}`);
  const sourceSha = sourceShaTrailer || process.env.NWD_SOURCE_SHA || deployCommit;
  const entries = git('ls-files', '-s', '-z').toString('utf8').split('\0').filter(Boolean).map((entry) => {
    const match = entry.match(/^(\d{6}) ([0-9a-f]{40}) \d\t([\s\S]+)$/);
    if (!match) fail(`unparseable tracked entry: ${entry}`);
    return { mode: match[1], object: match[2], path: match[3] };
  });
  const forbiddenDirectory = /(^|\/)(?:\.venv|venv|env|node_modules|dist|test-results)(?:\/|$)/;
  const generatedPng = /^game\/public\/assets\/production-art\/.*\.png$/i;
  const forbidden = entries.filter(({ path }) => forbiddenDirectory.test(path));
  const generated = entries.filter(({ path }) => generatedPng.test(path));
  const gitlinks = entries.filter(({ mode }) => mode === '160000');
  const allowedSymlinks = new Map([['game/public/favicon.png', '../../public/favicon.png']]);
  const symlinks = entries.filter(({ mode, path }) => mode === '120000' && !allowedSymlinks.has(path));
  if (forbidden.length) fail(`forbidden tracked directories: ${forbidden.map((x) => x.path).join(', ')}`);
  if (generated.length) fail(`tracked generated production PNG files: ${generated.map((x) => x.path).join(', ')}`);
  if (gitlinks.length) fail(`unexpected gitlinks: ${gitlinks.map((x) => x.path).join(', ')}`);
  if (symlinks.length) fail(`unexpected tracked symlinks: ${symlinks.map((x) => x.path).join(', ')}`);
  const paths = new Set(entries.map(({ path }) => path));
  const required = ['game/public/favicon.png', 'game/public/assets/images/NWD-menu.png', 'game/public/assets/images/NWD-characters.png'];
  for (const path of required) if (!paths.has(path)) fail(`protected asset is missing: ${path}`);
  const manifestPath = 'game/public/assets/campaign/canonical_campaign_manifest.json';
  if (!paths.has(manifestPath)) fail(`canonical manifest is missing: ${manifestPath}`);
  let lfsPointers = 0;
  let attributes = '';
  let manifest;
  for (const { mode, path } of entries) {
    const bytes = Buffer.from(git('show', `HEAD:${path}`));
    if (mode === '120000') {
      if (allowedSymlinks.get(path) !== bytes.toString()) fail(`unexpected tracked symlink: ${path}`);
      continue;
    }
    if (mode !== '100644' && mode !== '100755') fail(`unsupported tracked mode ${mode}: ${path}`);
    if (bytes.subarray(0, 42).toString() === 'version https://git-lfs.github.com/spec/v1') lfsPointers += 1;
    if (path === '.gitattributes') attributes = bytes.toString();
    if (path === manifestPath) manifest = JSON.parse(bytes.toString());
  }
  if (lfsPointers) fail(`current tree contains ${lfsPointers} Git LFS pointer(s)`);
  if (/(?:^|\s)filter\s*=\s*lfs(?:\s|$)/im.test(attributes)) fail('.gitattributes activates filter=lfs');
  if (!manifest || manifest.canonicalNodeCount !== 35 || !Array.isArray(manifest.nodes) || manifest.nodes.length !== 35) fail('canonical campaign manifest must retain 35 nodes');
  console.log(`[deploy-source-tree] deploy commit: ${deployCommit}`);
  console.log(`[deploy-source-tree] source GitHub SHA: ${sourceSha}`);
  console.log(`[deploy-source-tree] source tree trailer: ${sourceTreeTrailer || '(ordinary GitHub commit; not a snapshot)'}`);
  console.log(`[deploy-source-tree] current tree SHA: ${currentTree}`);
  console.log(`[deploy-source-tree] tracked file count: ${entries.length}`);
  console.log(`[deploy-source-tree] LFS pointer count: ${lfsPointers}`);
  console.log(`[deploy-source-tree] tracked generated PNG count: ${generated.length}`);
  console.log(`[deploy-source-tree] forbidden tracked directory count: ${forbidden.length}`);
  console.log('[deploy-source-tree] result: passed');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { runAudit(); } catch (error) { console.error(`[deploy-source-tree] result: failed: ${error.message}`); process.exit(1); }
}
