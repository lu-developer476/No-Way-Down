import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const gameRoot = path.join(repoRoot, 'game');
const assetRoot = path.join(gameRoot, 'public', 'assets');
const targetDirs = ['campaign', 'dialogues', 'cinematics', 'levels'];

const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.txt', '.yml', '.yaml', '.html', '.css',
]);
const ignoreDirs = new Set(['.git', 'node_modules', 'dist', 'build', '.vite']);

const args = new Set(process.argv.slice(2));
const applyFixes = args.has('--fix');

const validAssetPaths = new Set();
for (const dir of targetDirs) {
  const dirPath = path.join(assetRoot, dir);
  if (!fs.existsSync(dirPath)) continue;
  walkFiles(dirPath, (filePath) => {
    const rel = path.relative(assetRoot, filePath).replace(/\\/g, '/');
    validAssetPaths.add(`assets/${rel}`);
  });
}

const literalRouteRegex = /(["'`])((?:(?:game\/)?public\/)?assets\/(?:campaign|dialogues|cinematics|levels)\/[A-Za-z0-9_./-]+)\1/g;
const unresolvedRoutes = [];
const changedFiles = [];

walkFiles(repoRoot, (filePath) => {
  if (!textExtensions.has(path.extname(filePath))) return;

  const source = fs.readFileSync(filePath, 'utf8');
  let updated = source;

  updated = updated.replace(literalRouteRegex, (full, quote, routeWithPrefix) => {
    const normalized = routeWithPrefix.replace(/^(?:game\/)?public\//, '');
    if (validAssetPaths.has(normalized)) {
      return `${quote}${normalized}${quote}`;
    }

    unresolvedRoutes.push({
      filePath: path.relative(repoRoot, filePath),
      route: normalized,
    });
    return full;
  });

  if (applyFixes && updated !== source) {
    fs.writeFileSync(filePath, updated, 'utf8');
    changedFiles.push(path.relative(repoRoot, filePath));
  }
});

if (unresolvedRoutes.length > 0) {
  console.error('Se detectaron rutas no resueltas:');
  for (const issue of unresolvedRoutes) {
    console.error(`- ${issue.filePath} -> ${issue.route}`);
  }
  process.exitCode = 1;
} else {
  console.log('Todas las rutas de assets objetivo coinciden con la estructura real del proyecto.');
}

if (applyFixes) {
  if (changedFiles.length > 0) {
    console.log('Archivos corregidos automáticamente:');
    for (const file of changedFiles) console.log(`- ${file}`);
  } else {
    console.log('No se requirieron correcciones automáticas.');
  }
}

function walkFiles(startPath, callback) {
  if (!fs.existsSync(startPath)) return;
  const stat = fs.statSync(startPath);
  if (!stat.isDirectory()) {
    callback(startPath);
    return;
  }

  for (const entry of fs.readdirSync(startPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      walkFiles(path.join(startPath, entry.name), callback);
      continue;
    }
    if (entry.isFile()) callback(path.join(startPath, entry.name));
  }
}
