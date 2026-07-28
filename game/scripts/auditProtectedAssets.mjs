import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(gameRoot, '..');
const manifestPath = path.join(gameRoot, 'config/protected-assets.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const errors = [];

for (const asset of manifest.assets) {
  const absolutePath = path.resolve(repositoryRoot, asset.path);
  if (!absolutePath.startsWith(`${repositoryRoot}${path.sep}`)) {
    errors.push(`${asset.path}: path escapes repository root`);
    continue;
  }
  try {
    const digest = createHash('sha256').update(await readFile(absolutePath)).digest('hex');
    if (digest !== asset.sha256) errors.push(`${asset.path}: SHA-256 mismatch`);
  } catch (error) {
    errors.push(`${asset.path}: missing (${error.code ?? error.message})`);
  }
}

if (errors.length) {
  console.error(`Protected asset audit failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Protected asset audit passed (${manifest.assets.length} immutable files).`);
}
