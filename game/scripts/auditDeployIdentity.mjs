import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const game = resolve(import.meta.dirname, '..');
const root = resolve(game, '..');
const failures = [];
const indexPath = resolve(game, 'dist/index.html');
const infoPath = resolve(game, 'dist/build-info.json');
if (!existsSync(indexPath)) failures.push('dist/index.html does not exist');
if (!existsSync(infoPath)) failures.push('dist/build-info.json does not exist');
let info;
if (existsSync(infoPath)) {
  try { info = JSON.parse(readFileSync(infoPath, 'utf8')); } catch { failures.push('dist/build-info.json is invalid JSON'); }
}
if (info) {
  if (!/^[0-9a-f]{40}$/i.test(info.sourceSha)) failures.push('sourceSha must be a 40-character hexadecimal SHA');
  if (info.frontendSha !== info.sourceSha) failures.push('frontendSha must equal sourceSha');
  if (!/^[0-9a-f]{40}$/i.test(info.deployCommit)) failures.push('deployCommit must be a 40-character hexadecimal SHA');
  if (!['github', 'gitlab', 'unknown'].includes(info.repositoryProvider)) failures.push('repositoryProvider is invalid');
  if (process.env.NWD_BUILD_SHA && info.frontendSha !== process.env.NWD_BUILD_SHA) failures.push(`frontendSha ${info.frontendSha} does not match NWD_BUILD_SHA ${process.env.NWD_BUILD_SHA}`);
  if (info.canonicalNodeCount !== 35) failures.push(`canonicalNodeCount must be 35, received ${info.canonicalNodeCount}`);
  if (!info.buildId || !info.builtAt) failures.push('buildId and builtAt must identify the current build');
}
if (existsSync(indexPath)) {
  const index = readFileSync(indexPath, 'utf8');
  for (const match of index.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    if (url.startsWith('/') && !url.startsWith('//') && !existsSync(resolve(game, `dist/${url.slice(1)}`))) failures.push(`referenced chunk is missing: ${url}`);
  }
}
const trackedDist = execFileSync('git', ['ls-files', 'game/dist', 'dist'], { cwd: root, encoding: 'utf8' }).trim();
if (trackedDist) failures.push(`dist output is tracked by Git: ${trackedDist}`);
for (const name of existsSync(resolve(game, 'dist')) ? readdirSync(resolve(game, 'dist'), { recursive: true }).map(String) : []) {
  if (/(?:service-worker|sw\.js|precache-manifest)/i.test(name)) failures.push(`obsolete service worker artifact: ${name}`);
}
for (const path of ['build/buildInfoConfig.ts', 'src/buildInfo.ts']) {
  const source = readFileSync(resolve(game, path), 'utf8');
  if (/["'`]([0-9a-f]{40})["'`]/i.test(source)) failures.push(`hardcoded SHA in ${path}`);
}
if (failures.length) { console.error(`Deploy identity audit failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`); process.exit(1); }
console.log(`Deploy identity audit passed for ${info.frontendSha} (${info.canonicalNodeCount} canonical nodes).`);
