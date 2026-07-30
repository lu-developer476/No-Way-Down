import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const sourceAudit = resolve(import.meta.dirname, '../scripts/auditNoBinaryDiff.mjs');
const {
  auditTextSource, containsBinaryWriteCall, containsEmbeddedBinaryPayload,
  containsForbiddenGeneratorImport, containsImageEncodingCall, containsScreenshotCall,
  getDetectedMimeType, isAllowedTextMimeType, isForbiddenMimeType,
  resolveDiffBase,
} = await import('../scripts/auditNoBinaryDiff.mjs');
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
    env: cleanAuditEnvironment(env),
  });
}

const AUDIT_EVENT_ENVIRONMENT_KEYS = [
  'GITHUB_EVENT_NAME', 'GITHUB_EVENT_BEFORE', 'GITHUB_BASE_SHA', 'GITHUB_SHA',
  'GITHUB_REF', 'GITHUB_REF_NAME', 'GITHUB_REF_TYPE', 'GITHUB_HEAD_REF',
  'GITHUB_BASE_REF', 'GITHUB_ACTIONS', 'NWD_DIFF_BASE', 'NWD_DIFF_EVENT',
];

function cleanAuditEnvironment(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of AUDIT_EVENT_ENVIRONMENT_KEYS) delete environment[key];
  return { ...environment, NWD_DIFF_EVENT: 'local', ...overrides };
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
  assert.match(result.stdout, new RegExp(`base=${base}`));
}));

test('uses HEAD^ in a detached checkout without main', () => withRepository((root) => {
  writeFileSync(join(root, 'allowed.txt'), 'second commit\n');
  git(root, 'add', 'allowed.txt');
  git(root, 'commit', '-m', 'second');
  git(root, 'checkout', '--detach');
  const base = git(root, 'rev-parse', 'HEAD^');
  const result = audit(root, { NWD_DIFF_EVENT: 'local' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /event=local/);
  assert.match(result.stdout, new RegExp(`base=${base}`));
  assert.match(result.stdout, new RegExp(`merge-base=${base}`));
  assert.match(result.stdout, /modified files \(1\): allowed\.txt/);
}));

test('uses GITHUB_EVENT_BEFORE for a push event', () => withRepository((root) => {
  const base = git(root, 'rev-parse', 'HEAD');
  writeFileSync(join(root, 'allowed.txt'), 'push change\n');
  git(root, 'add', '.'); git(root, 'commit', '-m', 'push');
  const result = audit(root, { GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_BEFORE: base, NWD_DIFF_EVENT: '' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /event=push/);
  assert.match(result.stdout, new RegExp(`base=${base} merge-base=${base}`));
}));

test('uses GITHUB_BASE_SHA for a pull_request event', () => withRepository((root) => {
  const base = git(root, 'rev-parse', 'HEAD');
  writeFileSync(join(root, 'allowed.txt'), 'pull request change\n');
  git(root, 'add', '.'); git(root, 'commit', '-m', 'pull request');
  const result = audit(root, { GITHUB_EVENT_NAME: 'pull_request', GITHUB_BASE_SHA: base, NWD_DIFF_EVENT: '' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /event=pull_request/);
  assert.match(result.stdout, new RegExp(`base=${base} merge-base=${base}`));
}));

test('uses the empty tree for a single-commit history and a clean working tree', () => withRepository((root) => {
  const result = audit(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /base=4b825dc/);
}));

test('rejects a modified file with a binary extension', () => withRepository((root) => {
  const fixture = ['fixture', 'png'].join('.');
  writeFileSync(join(root, fixture), 'text fixture, not real binary data\n');
  git(root, 'add', fixture);
  git(root, 'commit', '-m', 'fixture');
  writeFileSync(join(root, fixture), 'modified textual fixture\n');
  const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ruleId=binary-extension/);
}));

test('rejects an untracked file with a binary extension', () => withRepository((root) => {
  writeFileSync(join(root, ['added', 'webp'].join('.')), 'text fixture, not real binary data\n');
  const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ruleId=binary-extension/);
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
    assert.match(result.stderr, /ruleId=(?:pillow-import|ffmpeg)/);
  });
});

test('rejects NUL content', () => withRepository((root) => {
  writeFileSync(join(root, 'nul.txt'), Buffer.from([0x74, 0x65, 0x78, 0x74, 0]));
  const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ruleId=nul-byte/);
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
  assert.match(result.stderr, /ruleId=binary-numstat/);
}));

test('uses fallback checks and warns when file(1) is unavailable', () => withRepository((root) => {
  const bin = mkdtempSync(join(tmpdir(), 'nwd-path-without-file-'));
  try {
    symlinkSync(execFileSync('which', ['git'], { encoding: 'utf8' }).trim(), join(bin, 'git'));
    writeFileSync(join(root, 'allowed.txt'), 'text change\n');
    const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD'), PATH: bin });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /file\(1\) unavailable/);
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

test('allows legitimate export, audio, rendering, metadata, and documentation text', () => {
  const allowed = [
    ['profile.ts', 'export interface AudioProfile { audioLoops: string[] }'],
    ['profile.ts', "export const profile = { audioLoops: ['wind'] }"],
    ['camera.ts', 'const renderDistance = 800'],
    ['sprite.ts', 'sprite.renderOrder = 3'],
    ['metadata.ts', 'export type PngMetadata = { path: string }'],
    ['README.md', '<!-- render audio profile and export png documentation -->'],
    ['settings.json', '{"audio": true, "render": "webgl", "export": false}'],
    ['minified.ts', "export const profile={audioLoops:['wind']};export const renderOrder=1"],
    ['level.tmj', '{"type":"map","properties":[{"name":"audio","value":"wind"}]}'],
    ['icon.svg', '<svg xmlns="http://www.w3.org/2000/svg"><text>render audio png</text></svg>'],
  ];
  for (const [path, source] of allowed) assert.equal(auditTextSource(path, source), null, `${path}: ${source}`);
});

test('allows the LowerBasementLightingProfiles textual source fixture', () => {
  const fixture = readFileSync(resolve(import.meta.dirname, '../src/config/LowerBasementLightingProfiles.ts'), 'utf8');
  assert.equal(auditTextSource('game/src/config/LowerBasementLightingProfiles.ts', fixture), null);
});

test('rejects concrete binary writes, encoders, and screenshots with actionable locations', () => {
  const rejected = [
    ['write.ts', 'writeFileSync("output.png", data)', 'binary-write'],
    ['write.ts', 'writeFile("output.jpg", data)', 'binary-write'],
    ['write.ts', 'fs.promises.writeFile("output.webp", data)', 'binary-write'],
    ['canvas.ts', 'canvas.toDataURL()', 'canvas-encoding'],
    ['canvas.ts', 'canvas.toBlob()', 'canvas-encoding'],
    ['browser.ts', 'page.screenshot()', 'screenshot'],
    ['browser.py', 'save_screenshot()', 'screenshot'],
    ['image.ts', 'new PNG()', 'png-constructor'],
    ['image.ts', 'Image.save("x")', 'image-object-write'],
    ['image.ts', 'Image.write("x")', 'image-object-write'],
  ];
  for (const [path, source, ruleId] of rejected) {
    const issue = auditTextSource(path, source);
    assert.equal(issue?.ruleId, ruleId, source);
    assert.equal(issue?.path, path);
    assert.equal(issue?.line, 1);
    assert.ok((issue?.column ?? 0) > 0);
    assert.ok(issue?.fragment);
  }
  assert.equal(containsBinaryWriteCall('writeFileSync("output.png", data)'), true);
  assert.equal(containsImageEncodingCall('canvas.toBlob()'), true);
  assert.equal(containsScreenshotCall('page.screenshot()'), true);
});

test('rejects embedded image payloads and forbidden generator tools', () => {
  for (const source of ['data:image/png;base64,AAAA', 'iVBORw0KGgoAAAANSUhEUgAAAAE']) {
    assert.equal(containsEmbeddedBinaryPayload(source), true);
    assert.ok(auditTextSource('game/src/payload.ts', source));
  }
  for (const source of ['from PIL import Image', 'import PIL', 'ImageMagick', 'ffmpeg -i input output.mp4']) {
    assert.equal(containsForbiddenGeneratorImport('game/src/tool.py', source), true);
    assert.ok(auditTextSource('game/src/tool.py', source));
  }
  assert.equal(containsForbiddenGeneratorImport('game/scripts/art/generator.py', 'from PIL import Image'), false);
  assert.equal(auditTextSource('game/scripts/art/generator.py', 'from PIL import Image'), null);
});

function fakeResolver(refs: Record<string, string | null>, mergeBases: Record<string, string> = {}) {
  return (...rawArgs: unknown[]) => {
    const args = [...rawArgs];
    const options = typeof args.at(-1) === 'object' ? args.pop() as { optional?: boolean } : {};
    const [command, ...values] = args as string[];
    if (command === 'rev-parse' && values[0] === 'HEAD') return refs.HEAD;
    if (command === 'rev-parse' && values[0] === '--verify') {
      const ref = values[1].replace(/\^\{commit\}$/, '');
      const value = refs[ref];
      if (value) return value;
      if (options.optional) return null;
      throw new Error(`missing ${ref}`);
    }
    if (command === 'merge-base') return mergeBases[`${values[0]}:${values[1]}`] ?? values[0];
    throw new Error(`unexpected git call: ${args.join(' ')}`);
  };
}

test('resolves the real pull request base and merge-base', () => {
  const git = fakeResolver({ HEAD: 'head', prbase: 'base' }, { 'base:head': 'common' });
  assert.deepEqual(resolveDiffBase({ env: { GITHUB_EVENT_NAME: 'pull_request', GITHUB_BASE_SHA: 'prbase' }, git }),
    { event: 'pull_request', head: 'head', base: 'base', mergeBase: 'common', firstCommit: false });
});

test('resolves push, merge commit, and squash merge from the event before SHA', () => {
  for (const label of ['push', 'merge commit', 'squash merge']) {
    const git = fakeResolver({ HEAD: `head-${label}`, before: `before-${label}` });
    const result = resolveDiffBase({ env: { GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_BEFORE: 'before' }, git });
    assert.equal(result.base, `before-${label}`);
    assert.equal(result.mergeBase, `before-${label}`);
  }
});

test('uses an explicit fetched base in a shallow checkout', () => {
  const git = fakeResolver({ HEAD: 'shallow-head', fetched: 'fetched-base', 'HEAD^': null });
  const result = resolveDiffBase({ env: { GITHUB_EVENT_NAME: 'pull_request', NWD_DIFF_BASE: 'fetched' }, git });
  assert.equal(result.base, 'fetched-base');
});

test('explicit base takes precedence over pull-request and push event bases', () => {
  const git = fakeResolver({ HEAD: 'head', explicit: 'chosen', pr: 'pr-base', before: 'push-base' });
  for (const env of [
    { GITHUB_EVENT_NAME: 'pull_request', GITHUB_BASE_SHA: 'pr' },
    { GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_BEFORE: 'before' },
  ]) assert.equal(resolveDiffBase({ env: { ...env, NWD_DIFF_BASE: 'explicit' }, git }).base, 'chosen');
});

test('falls back from an invalid event base to the real previous commit', () => {
  const git = fakeResolver({ HEAD: 'head', invalid: null, 'HEAD^': 'parent' });
  const result = resolveDiffBase({ env: { GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_BEFORE: 'invalid' }, git });
  assert.equal(result.base, 'parent');
});

test('uses the empty tree only for an actual first commit', () => {
  const git = fakeResolver({ HEAD: 'only-commit', 'HEAD^': null });
  const result = resolveDiffBase({ env: { GITHUB_EVENT_NAME: 'push', GITHUB_EVENT_BEFORE: '0000000000000000' }, git });
  assert.equal(result.firstCommit, true);
  assert.equal(result.base, '4b825dc642cb6eb9a060e54bf8d69288fbee4904');
});

test('ignores untracked directories and ignored virtual environments', () => withRepository((root) => {
  writeFileSync(join(root, '.gitignore'), '.venv/\ncache/\n');
  git(root, 'add', '.gitignore'); git(root, 'commit', '-m', 'ignore environments');
  mkdirSync(join(root, '.venv/lib'), { recursive: true });
  mkdirSync(join(root, 'cache'), { recursive: true });
  writeFileSync(join(root, '.venv/lib/local.txt'), 'local');
  writeFileSync(join(root, 'cache/local.txt'), 'local');
  const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
  assert.equal(result.status, 0, result.stderr);
}));

test('rejects a changed symlink without following its target directory', () => withRepository((root) => {
  mkdirSync(join(root, 'target'));
  symlinkSync('target', join(root, 'link'));
  const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ruleId=changed-symlink/);
  assert.doesNotMatch(result.stderr, /EISDIR|ELOOP/);
}));

test('handles a deleted file without reading the missing path', () => withRepository((root) => {
  const base = git(root, 'rev-parse', 'HEAD');
  rmSync(join(root, 'allowed.txt'));
  const result = audit(root, { NWD_DIFF_BASE: base });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /ENOENT/);
}));

test('rejects a changed gitlink', () => withRepository((root) => {
  const child = mkdtempSync(join(tmpdir(), 'nwd-gitlink-'));
  try {
    git(child, 'init'); git(child, 'config', 'user.email', 'audit@example.invalid'); git(child, 'config', 'user.name', 'Audit Test');
    writeFileSync(join(child, 'file.txt'), 'child'); git(child, 'add', '.'); git(child, 'commit', '-m', 'child');
    execFileSync('git', ['-c', 'protocol.file.allow=always', 'submodule', 'add', child, 'module'], { cwd: root });
    const result = audit(root, { NWD_DIFF_BASE: git(root, 'rev-parse', 'HEAD') });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ruleId=changed-gitlink/);
  } finally { rmSync(child, { recursive: true, force: true }); }
}));
