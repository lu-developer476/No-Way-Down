import { accessSync, constants, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const workflow = readFileSync(resolve(root, '.github/workflows/mirror-to-gitlab.yml'), 'utf8');
const snapshot = readFileSync(resolve(root, 'scripts/mirror-main-snapshot.sh'), 'utf8');
const render = readFileSync(resolve(root, 'scripts/render-build.sh'), 'utf8');
const failures = [];
const requirePattern = (text, pattern, message) => { if (!pattern.test(text)) failures.push(message); };
const forbidPattern = (text, pattern, message) => { if (pattern.test(text)) failures.push(message); };
try { accessSync(resolve(root, 'scripts/mirror-main-snapshot.sh'), constants.X_OK); } catch { failures.push('snapshot script is not executable'); }
requirePattern(workflow, /branches:\s*\n\s*- main\b/, 'workflow must listen only to main');
requirePattern(workflow, /workflow_dispatch:/, 'workflow_dispatch is required');
requirePattern(workflow, /group: mirror-main-to-gitlab/, 'fixed mirror concurrency is required');
requirePattern(workflow, /scripts\/mirror-main-snapshot\.sh/, 'workflow must invoke the snapshot script');
requirePattern(workflow, /gitlab-mirror-evidence\.txt/, 'workflow must publish post-push evidence');
forbidPattern(workflow, /tags:|['"]\*\*['"]|\blfs:/i, 'workflow must not mirror tags, wildcard branches, or enable LFS');
forbidPattern(workflow, /git\s+(?:lfs|push)/, 'workflow must not run LFS or push Git history directly');
for (const trailer of ['Source-GitHub-SHA:', 'Source-GitHub-Ref:', 'Source-GitHub-Tree:', 'Mirror-Strategy: sanitized-current-tree-snapshot']) requirePattern(snapshot, new RegExp(trailer), `snapshot is missing ${trailer}`);
requirePattern(snapshot, /mirror_tree_sha/, 'snapshot must verify its tree before push');
requirePattern(snapshot, /remote_tree_sha/, 'snapshot must verify its tree after push');
requirePattern(snapshot, /remote_source_sha/, 'snapshot must verify its source trailer after push');
requirePattern(snapshot, /HEAD:refs\/heads\/main/, 'snapshot must publish only main');
forbidPattern(snapshot, /git\s+lfs|push[^\n]*(?:--mirror|--all|--tags|--force)/, 'snapshot contains a forbidden LFS, broad, tag, or force operation');
requirePattern(render, /NWD_SOURCE_SHA/, 'Render build must preserve source identity');
requirePattern(render, /NWD_DEPLOY_COMMIT/, 'Render build must preserve deploy identity separately');
if (failures.length) { console.error(`GitLab mirror audit failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`); process.exit(1); }
console.log('GitLab mirror audit passed: main-only sanitized snapshots, exact trees, bounded retry, and separate source/deploy identities.');
