import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const sourceAudit = resolve(import.meta.dirname, '../scripts/auditNoBinaryDiff.mjs');
const { getDetectedMimeType, isAllowedTextMimeType, isForbiddenMimeType } = await import('../scripts/auditNoBinaryDiff.mjs');
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

test('allows the documented textual MIME types', () => {
  for (const mimeType of [
    'text/x-python', 'text/x-script.python', 'text/x-shellscript', 'text/plain',
    'text/x-perl', 'text/x-ruby', 'text/x-php', 'text/x-c', 'text/x-c++',
    'text/x-java', 'text/x-typescript', 'application/json', 'application/ld+json',
    'application/javascript', 'application/ecmascript', 'application/xml',
    'application/yaml', 'application/x-yaml', 'application/toml', 'image/svg+xml',
  ]) {
    assert.equal(isAllowedTextMimeType(mimeType), true, mimeType);
    assert.equal(isForbiddenMimeType(mimeType), false, mimeType);
  }
});

test('rejects binary, media, archive, and container MIME types', () => {
  for (const mimeType of [
    'image/png', 'audio/ogg', 'video/mp4', 'font/woff2', 'application/pdf',
    'application/zip', 'application/octet-stream', 'application/x-executable',
    'application/x-pie-executable', 'application/x-sharedlib', 'application/x-object',
    'application/x-core', 'application/x-dosexec',
    'application/vnd.microsoft.portable-executable', 'application/x-msdownload',
    'application/wasm', 'application/x-7z-compressed', 'application/x-rar',
    'application/vnd.rar', 'application/x-tar', 'application/gzip',
    'application/x-gzip', 'application/x-bzip', 'application/x-bzip2',
    'application/x-xz', 'application/zstd',
  ]) assert.equal(isForbiddenMimeType(mimeType), true, mimeType);
});

test('permits ASCII, UTF-8, shebang, and executable textual scripts', () => withRepository((root) => {
  const fixtures = new Map([
    ['ascii.py', 'print("hello")\n'],
    ['utf8.py', 'print("olá")\n'],
    ['shebang.py', '#!/usr/bin/env python3\nprint("hello")\n'],
    ['run.sh', '#!/usr/bin/env bash\necho hello\n'],
    ['tool.mjs', '#!/usr/bin/env node\nconsole.log("hello");\n'],
  ]);
  for (const [path, contents] of fixtures) writeFileSync(join(root, path), contents);
  chmodSync(join(root, 'run.sh'), 0o755);
  chmodSync(join(root, 'tool.mjs'), 0o755);
  const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
  assert.equal(result.status, 0, result.stderr);
}));

test('inspects Python and shell source for forbidden patterns', () => {
  for (const [path, contents] of [
    ['unsafe.py', 'from PIL import Image\n'],
    ['unsafe.sh', 'ffmpeg input output.mp4\n'],
  ]) withRepository((root) => {
    writeFileSync(join(root, path), contents);
    const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /forbidden binary-generation pattern/);
  });
});

test('rejects NUL content', () => withRepository((root) => {
  writeFileSync(join(root, 'nul.txt'), Buffer.from([0x74, 0x65, 0x78, 0x74, 0]));
  const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NUL content detected/);
}));

test('rejects a binary numstat entry without a binary fixture', () => withRepository((root) => {
  writeFileSync(join(root, '.gitattributes'), 'binary-marked.txt binary\n');
  writeFileSync(join(root, 'binary-marked.txt'), 'entirely textual baseline\n');
  git(root, 'add', '.gitattributes', 'binary-marked.txt');
  git(root, 'commit', '-m', 'text marked binary');
  const base = git(root, 'rev-parse', 'HEAD');
  writeFileSync(join(root, 'binary-marked.txt'), 'entirely textual change\n');
  const result = audit(root, { NWD_DIFF_BASE: base });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /binary numstat entry/);
}));

test('uses fallback checks and warns when file(1) is unavailable', () => withRepository((root) => {
  const bin = mkdtempSync(join(tmpdir(), 'nwd-path-without-file-'));
  try {
    symlinkSync(execFileSync('which', ['git'], { encoding: 'utf8' }).trim(), join(bin, 'git'));
    writeFileSync(join(root, 'allowed.txt'), 'text change\n');
    const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD'), PATH: bin });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /file\(1\) is unavailable/);
  } finally { rmSync(bin, { recursive: true, force: true }); }
}));

test('requests MIME output and never classifies human text-executable descriptions', () => {
  const root = mkdtempSync(join(tmpdir(), 'nwd-file-mock-'));
  try {
    const mockFile = join(root, 'file');
    const calls = join(root, 'calls');
    writeFileSync(mockFile, `#!/bin/sh\nprintf '%s\\n' "$*" >> "${calls}"\ncase "$3" in\n  *.py) echo text/x-script.python ;;\n  *) echo text/x-shellscript ;;\nesac\n`);
    chmodSync(mockFile, 0o755);
    for (const [name, description] of [
      ['plain.py', 'Python script, ASCII text executable'],
      ['long.py', 'Python script, ASCII text executable, with very long lines'],
      ['run.sh', 'Bourne-Again shell script, ASCII text executable'],
    ]) {
      const path = join(root, name);
      writeFileSync(path, `${description}\n`);
      const mimeType = getDetectedMimeType(path, mockFile);
      assert.equal(isAllowedTextMimeType(mimeType), true);
      assert.equal(isForbiddenMimeType(mimeType), false);
    }
    assert.equal(execFileSync('wc', ['-l', calls], { encoding: 'utf8' }).trim().split(/\s+/)[0], '3');
    assert.match(execFileSync('cat', [calls], { encoding: 'utf8' }), /--brief --mime-type/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
