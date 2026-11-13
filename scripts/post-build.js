import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

console.log('[post-build] Running streamlined post-build enhancements...');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. Detect primary game entry script from dist/index.html or dist/game.html
let entryScript = '';
for (const name of ['index.html', 'game.html']) {
  const htmlPath = path.join(distDir, name);
  if (fs.existsSync(htmlPath)) {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const match = htmlContent.match(/\/assets\/((?:main|game)-[A-Za-z0-9_-]+\.js)/);
    if (match?.[1]) {
      entryScript = `/assets/${match[1]}`;
      break;
    }
  }
}

// 2. Generate version.json
const buildTimestamp = Date.now();
const versionData = {
  version: `2.1.0-${buildTimestamp}`,
  buildTime: new Date(buildTimestamp).toISOString(),
  buildTimestamp,
  service: 'snshero-revolution',
  minRequiredVersion: '2.0.0',
  entryScript: entryScript || '/assets/main.js',
};
fs.writeFileSync(path.join(distDir, 'version.json'), JSON.stringify(versionData, null, 2), 'utf8');
if (fs.existsSync(publicDir)) {
  fs.writeFileSync(path.join(publicDir, 'version.json'), JSON.stringify(versionData, null, 2), 'utf8');
}

// 3. Copy metadata.json if present
const metaSource = path.join(rootDir, 'metadata.json');
if (fs.existsSync(metaSource)) {
  fs.copyFileSync(metaSource, path.join(distDir, 'metadata.json'));
  if (fs.existsSync(publicDir)) {
    fs.copyFileSync(metaSource, path.join(publicDir, 'metadata.json'));
  }
}

// 4. Mirror clean URL directories (/game/, /stone/, /promo/, /book/, /novel/, /webtoon/) with absolute /assets/ paths
const ensureAbsoluteAssetPaths = (html) =>
  html
    .replace(/(src|href)=["']\.\/assets\//g, '$1="/assets/')
    .replace(/(src|href)=["']assets\//g, '$1="/assets/');

for (const page of ['game', 'stone', 'promo', 'book', 'novel', 'webtoon']) {
  const htmlPath = path.join(distDir, `${page}.html`);
  if (!fs.existsSync(htmlPath)) continue;
  const fixed = ensureAbsoluteAssetPaths(fs.readFileSync(htmlPath, 'utf8'));
  fs.writeFileSync(htmlPath, fixed, 'utf8');
  const dirPath = path.join(distDir, page);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, 'index.html'), fixed, 'utf8');
}

console.log('[post-build] Streamlined post-build completed (/, /game.html, /stone.html, /promo.html, /book.html, /novel.html, /webtoon.html).');
