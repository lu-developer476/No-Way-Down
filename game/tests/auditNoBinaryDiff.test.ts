import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const sourceAudit = resolve(import.meta.dirname, '../scripts/auditNoBinaryDiff.mjs');
const git = (repo: string, ...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();

function repository() {
  const root = mkdtempSync(join(tmpdir(), 'nwd-binary-audit-'));
  mkdirSync(join(root, 'game/scripts'), { recursive: true });
  cpSync(sourceAudit, join(root, 'game/scripts/auditNoBinaryDiff.mjs'));
  writeFileSync(join(root, 'allowed.txt'), 'baseline\n');
  git(root, 'init', '-b', 'topic');
  git(root, 'config', 'user.email', 'audit@example.invalid');
  git(root, 'config', 'user.name', 'Audit Test');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'baseline');
  return root;
}

function audit(root: string, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['game/scripts/auditNoBinaryDiff.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function withRepository(run: (root: string) => void) {
  const root = repository();
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('uses a valid NWD_DIFF_BASE and permits a textual change', () => withRepository((root) => {
  const base = git(root, 'rev-parse', 'HEAD');
  writeFileSync(join(root, 'allowed.txt'), 'text change\n');
  const result = audit(root, { NWD_DIFF_BASE: base });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /from NWD_DIFF_BASE/);
}));

test('uses origin/main when no local main branch exists', () => withRepository((root) => {
  const base = git(root, 'rev-parse', 'HEAD');
  git(root, 'update-ref', 'refs/remotes/origin/main', base);
  const result = audit(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /from origin\/main/);
}));

test('uses HEAD^ in a detached checkout without main', () => withRepository((root) => {
  writeFileSync(join(root, 'allowed.txt'), 'second commit\n');
  git(root, 'add', 'allowed.txt');
  git(root, 'commit', '-m', 'second');
  git(root, 'checkout', '--detach');
  const result = audit(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /from HEAD\^/);
}));

test('uses the empty tree for a single-commit history and a clean working tree', () => withRepository((root) => {
  const result = audit(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /empty tree/);
}));

test('rejects a modified file with a binary extension', () => withRepository((root) => {
  const fixture = ['fixture', 'png'].join('.');
  writeFileSync(join(root, fixture), 'text fixture, not real binary data\n');
  git(root, 'add', fixture);
  git(root, 'commit', '-m', 'fixture');
  writeFileSync(join(root, fixture), 'modified textual fixture\n');
  const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /binary extension changed/);
}));

test('rejects an untracked file with a binary extension', () => withRepository((root) => {
  writeFileSync(join(root, ['added', 'webp'].join('.')), 'text fixture, not real binary data\n');
  const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /binary extension changed \(A\)/);
}));
