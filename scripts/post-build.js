import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

console.log('[post-build] Running streamlined post-build enhancements...');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 1. Detect primary game entry script from dist/game.html or dist/index.html
let entryScript = '';
for (const name of ['game.html', 'index.html']) {
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

// 4. Mirror clean URL directories (/game/, /stone/, /promo/, /book/, /novel/, /webtoon/, /sns/) with absolute root paths
const ensureAbsoluteAssetPaths = (html) =>
  html
    .replace(/(src|href)=["']\.\/assets\//g, '$1="/assets/')
    .replace(/(src|href)=["']assets\//g, '$1="/assets/')
    .replace(/(src|href)=["']\.\/favicon\.png/g, '$1="/favicon.png')
    .replace(/(src|href)=["']\.\/hs-assets\//g, '$1="/hs-assets/')
    .replace(/(src|href)=["']\.\/novel-assets\//g, '$1="/novel-assets/')
    .replace(/(src|href)=["']\.\/webtoon-assets\//g, '$1="/webtoon-assets/');

for (const page of ['game', 'stone', 'promo', 'book', 'novel', 'webtoon', 'sns']) {
  const htmlPath = path.join(distDir, `${page}.html`);
  if (!fs.existsSync(htmlPath)) continue;
  const fixed = ensureAbsoluteAssetPaths(fs.readFileSync(htmlPath, 'utf8'));
  fs.writeFileSync(htmlPath, fixed, 'utf8');
  const dirPath = path.join(distDir, page);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, 'index.html'), fixed, 'utf8');

  // Mirror /promo.html -> /promotion/index.html & /promotion.html for canonical /promotion URL
  if (page === 'promo') {
    const promotionDir = path.join(distDir, 'promotion');
    fs.mkdirSync(promotionDir, { recursive: true });
    fs.writeFileSync(path.join(promotionDir, 'index.html'), fixed, 'utf8');
    fs.writeFileSync(path.join(distDir, 'promotion.html'), fixed, 'utf8');
  }
}

// 5. Static /mcp discovery fallback for GitHub Pages (on Vite/Node servers, mcp-arena-server-plugin handles live JSON-RPC)
const mcpDir = path.join(distDir, 'mcp');
fs.mkdirSync(mcpDir, { recursive: true });
const mcpGuideSrc = path.join(publicDir, 'mcp-guide.md');
if (fs.existsSync(mcpGuideSrc)) {
  fs.copyFileSync(mcpGuideSrc, path.join(mcpDir, 'guide.md'));
}
fs.writeFileSync(
  path.join(mcpDir, 'index.html'),
  `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SNSHero /mcp Protocol Discovery</title>
</head>
<body style="background:#090d16;color:#fdfcfc;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:24px;line-height:1.6;">
  <h1 style="font-size:18px;margin:0 0 12px;color:#fcd34d;">SNSHero /mcp Arena Server Discovery</h1>
  <p style="font-size:13px;color:#d6d3d1;margin:0 0 16px;">정적 호스팅(GitHub Pages) 경로입니다. 실시간 JSON-RPC 2.0 <code>POST /mcp</code> 대결은 로컬/노드 MCP 서버(<code>npm run mcp:http</code> 또는 <code>http://localhost:3000/mcp</code>) 및 <a href="/sns" style="color:#38bdf8;">/sns 벤치마크 &amp; 시뮬레이터 허브</a>에서 지원됩니다.</p>
  <ul style="font-size:13px;">
    <li><a href="/sns" style="color:#34d399;">/sns — AI 지능 1,000판 벤치마크 &amp; 100점 평가 리포트 열기</a></li>
    <li><a href="/mcp-guide.md" style="color:#fcd34d;">/mcp-guide.md — AI 전달용 MCP 플레이 &amp; 채점 지침서 (Markdown)</a></li>
    <li><a href="/data/mcp-benchmark-store.json" style="color:#a78bfa;">/data/mcp-benchmark-store.json — 벤치마크 리더보드 원본 JSON</a></li>
  </ul>
</body>
</html>`,
  'utf8',
);

// 6. Smart 404.html clean-URL & case-insensitive route normalizer for GitHub Pages
fs.writeFileSync(
  path.join(distDir, '404.html'),
  `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>Redirecting... | SNSHero</title>
  <script>
    (function () {
      var p = (window.location.pathname || '/').replace(/\\/+$/, '').toLowerCase();
      var q = window.location.search || '';
      var h = window.location.hash || '';
      var routes = {
        '/sns': '/sns',
        '/benchmark': '/sns',
        '/arena': '/sns',
        '/mcp/guide': '/mcp-guide.md',
        '/mcp/guide.md': '/mcp-guide.md',
        '/promo': '/',
        '/promo.html': '/',
        '/promotion': '/',
        '/promotion.html': '/',
        '/book': '/book',
        '/novel': '/book',
        '/webtoon': '/webtoon',
        '/game': '/game'
      };
      if (routes[p] && routes[p] !== window.location.pathname) {
        window.location.replace(routes[p] + q + h);
        return;
      }
      if (p.indexOf('/sns/') === 0) {
        window.location.replace('/sns' + q + h);
        return;
      }
    })();
  </script>
</head>
<body style="background:#090d16;color:#fdfcfc;font-family:ui-monospace,monospace;padding:32px;">
  <p>요청하신 경로를 찾을 수 없습니다. 주요 페이지로 이동하세요:</p>
  <ul>
    <li><a href="/" style="color:#fcd34d;">/ — 눈히어로 공식 게임 소개</a></li>
    <li><a href="/game" style="color:#38bdf8;">/game — 눈히어로 메인 카드 배틀 게임</a></li>
    <li><a href="/sns" style="color:#34d399;">/sns — AI 1,000판 벤치마크 &amp; 100점 평가 허브</a></li>
    <li><a href="/book" style="color:#a78bfa;">/book — 카단의 여정 웹소설</a></li>
    <li><a href="/webtoon" style="color:#fb7185;">/webtoon — 공식 웹툰</a></li>
  </ul>
</body>
</html>`,
  'utf8',
);

console.log('[post-build] Streamlined post-build completed (/, /game, /sns, /book, /webtoon, /mcp + 404 router).');
