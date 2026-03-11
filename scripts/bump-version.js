const fs = require('fs');
const path = require('path');

const level = process.argv[2] || 'patch';
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const [major, minor, patch] = pkg.version.split('.').map(Number);

switch (level) {
  case 'major':
    pkg.version = `${major + 1}.0.0`;
    break;
  case 'minor':
    pkg.version = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
    pkg.version = `${major}.${minor}.${patch + 1}`;
    break;
  default:
    console.error('Usage: node bump-version.js [major|minor|patch]');
    process.exit(1);
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Bumped version: ${major}.${minor}.${patch} → ${pkg.version}`);
