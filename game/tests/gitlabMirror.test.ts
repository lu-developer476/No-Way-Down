import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const script = resolve(import.meta.dirname, '../../scripts/mirror-main-snapshot.sh');
const git = (repo: string, ...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
function commit(repo: string, message: string) { git(repo, 'add', '-A'); git(repo, 'commit', '-m', message); return git(repo, 'rev-parse', 'HEAD'); }
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'nwd-gitlab-mirror-'));
  const source = join(root, 'source'); const remote = join(root, 'gitlab.git');
  mkdirSync(source); git(source, 'init', '-b', 'main'); git(source, 'config', 'user.name', 'Test'); git(source, 'config', 'user.email', 'test@example.invalid');
  writeFileSync(join(source, '.gitignore'), 'game/public/assets/production-art/**/*.png\n');
  writeFileSync(join(source, 'app.txt'), 'base\n'); const base = commit(source, 'base');
  git(root, 'init', '--bare', remote); git(source, 'remote', 'add', 'seed', remote); git(source, 'push', 'seed', 'main');
  writeFileSync(join(source, 'old-lfs.txt'), 'version https://git-lfs.github.com/spec/v1\noid sha256:fake\nsize 1\n'); const lfs = commit(source, 'historical pointer');
  rmSync(join(source, 'old-lfs.txt')); commit(source, 'remove historical pointer');
  writeFileSync(join(source, 'app.txt'), 'final source code\n'); const final = commit(source, 'final code');
  return { root, source, remote, base, lfs, final };
}
function run(source: string, remote: string, sha: string, extra: Record<string, string> = {}) {
  return spawnSync('bash', [script], { cwd: source, encoding: 'utf8', env: { ...process.env, GITHUB_SOURCE_SHA: sha, GITHUB_SOURCE_REF: 'refs/heads/main', GITLAB_MIRROR_URL: remote, GITLAB_MIRROR_USERNAME: 'mirror-test', GITLAB_MIRROR_TOKEN: 'never-print-this-token', ...extra } });
}

test('publishes linear exact-tree snapshots without importing historical LFS, tags, or branches', () => {
  const f = fixture();
  try {
    git(f.source, 'tag', 'historical-tag', f.lfs); git(f.source, 'branch', 'temporary-branch', f.lfs);
    const first = run(f.source, f.remote, f.final); assert.equal(first.status, 0, first.stderr); assert.doesNotMatch(first.stdout + first.stderr, /never-print-this-token/);
    const snapshot1 = git(f.remote, 'rev-parse', 'refs/heads/main');
    assert.equal(git(f.remote, 'rev-parse', `${snapshot1}^{tree}`), git(f.source, 'rev-parse', `${f.final}^{tree}`));
    assert.notEqual(snapshot1, f.final); assert.throws(() => git(f.remote, 'merge-base', '--is-ancestor', f.lfs, snapshot1));
    assert.doesNotMatch(git(f.remote, 'show', `${snapshot1}:app.txt`), /git-lfs/);
    assert.match(git(f.remote, 'log', '-1', '--format=%B', snapshot1), new RegExp(`Source-GitHub-SHA: ${f.final}`));
    assert.throws(() => git(f.remote, 'show-ref', '--verify', 'refs/tags/historical-tag'));
    assert.throws(() => git(f.remote, 'show-ref', '--verify', 'refs/heads/temporary-branch'));
    const second = run(f.source, f.remote, f.final); assert.equal(second.status, 0, second.stderr);
    const snapshot2 = git(f.remote, 'rev-parse', 'refs/heads/main'); assert.notEqual(snapshot2, snapshot1);
    assert.equal(git(f.remote, 'rev-parse', `${snapshot2}^`), snapshot1);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('rejects a current LFS pointer before contacting the destination', () => {
  const f = fixture();
  try { writeFileSync(join(f.source, 'current.txt'), 'version https://git-lfs.github.com/spec/v1\noid sha256:bad\n'); const sha = commit(f.source, 'bad current pointer'); const result = run(f.source, '/does/not/exist.git', sha); assert.notEqual(result.status, 0); assert.match(result.stderr, /current\.txt/); }
  finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('rejects missing credentials and invalid URLs without leaking tokens', () => {
  const f = fixture();
  try {
    const missing = run(f.source, f.remote, f.final, { GITLAB_MIRROR_TOKEN: '' }); assert.notEqual(missing.status, 0);
    const invalid = run(f.source, 'ssh://example.invalid/repo.git', f.final); assert.notEqual(invalid.status, 0); assert.doesNotMatch(invalid.stdout + invalid.stderr, /never-print-this-token/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('a concurrent rejection causes exactly one retry', () => {
  const f = fixture();
  try {
    const hook = join(f.remote, 'hooks/pre-receive');
    writeFileSync(hook, `#!/bin/sh\nmarker="$PWD/rejected-once"\nif [ ! -e "$marker" ]; then touch "$marker"; exit 1; fi\nexit 0\n`);
    chmodSync(hook, 0o755);
    const result = run(f.source, f.remote, f.final);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /rebuilding once/);
    assert.match(result.stdout, /Push attempts: 2/);
    assert.equal((result.stderr.match(/rebuilding once/g) ?? []).length, 1);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('contains bounded race handling and blocking tree and trailer verification', () => {
  const source = readFileSync(script, 'utf8');
  assert.match(source, /push_attempt=2/); assert.doesNotMatch(source, /while\s|until\s/);
  assert.match(source, /mirror_tree_sha.*source_tree_sha/s); assert.match(source, /remote_tree_sha.*source_tree_sha/s);
  assert.match(source, /remote_source_sha.*source_commit_sha/s); assert.match(source, /--allow-empty/);
  assert.doesNotMatch(source, /push[^\n]*(?:--force|--mirror|--all|--tags)/);
});
