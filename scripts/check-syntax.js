const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const roots = ['src', 'scripts'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

const files = roots.flatMap((root) => walk(path.join(process.cwd(), root)));

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Checked syntax for ${files.length} JavaScript files.`);
