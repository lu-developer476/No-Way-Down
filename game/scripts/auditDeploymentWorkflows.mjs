import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const readOptional = (path) => existsSync(resolve(root, path)) ? read(path) : '';
const gate = read('.github/workflows/production-gate.yml');
const smoke = read('.github/workflows/production-smoke.yml');
const render = read('scripts/render-build.sh');
const ignore = read('.gitignore');
const executablePaths = execFileSync('git', ['ls-files', '.github/workflows', 'scripts', 'game/scripts'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const executableSources = executablePaths.filter((path) => path !== 'game/scripts/auditDeploymentWorkflows.mjs').map((path) => [path, read(path)]);
const failures = [];
const requireMatch = (condition, message) => { if (!condition) failures.push(message); };
requireMatch(gate.includes('npm run typecheck --prefix game'), 'production gate must use the game workspace typecheck');
requireMatch(!gate.includes('test:e2e:production') && !gate.includes('onrender.com'), 'production gate must not query Render');
requireMatch(smoke.includes("workflows: ['Mirror main snapshot to GitLab']"), 'production smoke must listen only to the mirror workflow');
requireMatch(smoke.includes("workflow_run.conclusion == 'success'") && smoke.includes("workflow_run.head_branch == 'main'"), 'automatic smoke must require a successful main mirror');
requireMatch(smoke.includes('github.event.workflow_run.head_sha'), 'automatic smoke must use workflow_run.head_sha');
requireMatch(smoke.includes('npm run wait:production-sha --prefix game'), 'production smoke must wait for the expected SHA');
requireMatch(!render.includes('audit:no-binary-diff'), 'Render must not run the commit diff audit');
requireMatch(render.includes('npm run audit:deploy-source-tree --prefix game'), 'Render must audit the deployed tree');
requireMatch(render.indexOf('audit:deploy-source-tree') < render.indexOf('npm ci --prefix game'), 'Render tree audit must run before npm ci');
requireMatch(ignore.split(/\r?\n/).includes('.venv/'), '.venv/ must be ignored');
for (const [path, source] of executableSources) {
  requireMatch(!/\bnpx\s+tsc\b/.test(source), `${path} must not use npx tsc`);
  requireMatch(!source.includes('continue-on-error'), `${path} must not use continue-on-error`);
}
requireMatch(!render.includes('|| true'), 'Render checks must not be hidden with || true');
const attributes = readOptional('.gitattributes');
requireMatch(!/(?:^|\s)filter\s*=\s*lfs(?:\s|$)/im.test(attributes), '.gitattributes must not enable LFS');
if (failures.length) { console.error(failures.map((failure) => `- ${failure}`).join('\n')); process.exit(1); }
console.log('Deployment workflow audit passed.');
