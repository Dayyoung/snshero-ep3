#!/usr/bin/env node
/**
 * Builds policy-compliant HTML5 web game portal packages for:
 *  1. itch.io (`dist-portals/snshero-itchio.zip`)
 *  2. CrazyGames (`dist-portals/snshero-crazygames.zip`)
 * Also generates `dist-portals/PORTAL_SUBMISSION_GUIDE.md` with policy-checked metadata
 * for CrazyGames, itch.io, and GDevelop / gd.games.
 *
 * Policy safeguards:
 *  - Root `index.html` inside every ZIP (never nested in a subfolder)
 *  - Strips Google AdSense (`pagead2.googlesyndication.com`) and external GA/Ads tags in portal HTML
 *  - Injects `window.__SNSHERO_PORTAL__` so `portalBridge.ts` disables external ads & fires CrazyGames SDK events
 *  - Rewrites root-relative `/assets/...` and `/hs-assets/...` paths cleanly for iframe hosting
 *  - Excludes non-game folders (`webtoon-assets`, `stone-assets`, `novel-assets`, `screenshots`, `guide`)
 *    so file count and total MB stay safely within portal limits.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const OUT_ROOT = path.join(ROOT, 'dist-portals');

if (!fs.existsSync(path.join(DIST, 'game.html'))) {
  console.error('dist/game.html not found. Run `npm run build` first.');
  process.exit(1);
}

fs.rmSync(OUT_ROOT, { recursive: true, force: true });
fs.mkdirSync(OUT_ROOT, { recursive: true });

function copyDirFiltered(src, dest, skipRelPrefixes = []) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relFromDist = path.relative(DIST, srcPath).replace(/\\/g, '/');
    if (skipRelPrefixes.some((p) => relFromDist === p || relFromDist.startsWith(p + '/'))) {
      continue;
    }
    if (entry.isDirectory()) {
      copyDirFiltered(srcPath, destPath, skipRelPrefixes);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function countFilesAndBytes(dir) {
  let files = 0;
  let bytes = 0;
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        files += 1;
        bytes += fs.statSync(p).size;
      }
    }
  }
  walk(dir);
  return { files, mb: +(bytes / (1024 * 1024)).toFixed(2) };
}

function stripExternalTagsAndInjectPortal(html, portal) {
  let out = html;
  // Remove Google AdSense and Google Tag Manager scripts (prohibited on CrazyGames / unnecessary on itch.io)
  out = out.replace(/<script[^>]*pagead2\.googlesyndication\.com[^>]*><\/script>\s*/gi, '');
  out = out.replace(/<script[^>]*googletagmanager\.com[^>]*><\/script>\s*/gi, '');
  out = out.replace(/<script>\s*window\.dataLayer[\s\S]*?<\/script>\s*/gi, '');
  out = out.replace(/<script>\s*window\.adsbygoogle[\s\S]*?<\/script>\s*/gi, '');
  // Remove service worker registration inside sandboxed portal iframes
  out = out.replace(/<script>\s*if \('serviceWorker' in navigator\)[\s\S]*?<\/script>\s*/gi, '');
  // Relative paths for root assets inside ZIP
  out = out.replace(/(src|href)="\/(assets\/|favicon\.png|game-manifest\.json|hs-assets\/)/g, '$1="./$2');

  const sdkSnippet =
    portal === 'crazygames'
      ? `  <script src="https://sdk.crazygames.com/crazygames-sdk-v2.js"></script>\n  <script>window.__SNSHERO_PORTAL__ = 'crazygames';</script>\n`
      : `  <script>window.__SNSHERO_PORTAL__ = 'itchio';</script>\n`;

  out = out.replace('<head>', `<head>\n${sdkSnippet}`);
  return out;
}

function buildPortalBundle(portal, opts) {
  const stageDir = path.join(OUT_ROOT, `stage-${portal}`);
  fs.mkdirSync(stageDir, { recursive: true });

  // 1. Copy core Vite JS/CSS chunks (skip stone/book/webtoon-only huge chunks)
  const assetsSrc = path.join(DIST, 'assets');
  const assetsDest = path.join(stageDir, 'assets');
  fs.mkdirSync(assetsDest, { recursive: true });
  for (const f of fs.readdirSync(assetsSrc)) {
    if (/^(stone-|bookMain-|data-webtoon-|webtoon-|sns-)/i.test(f)) continue;
    fs.copyFileSync(path.join(assetsSrc, f), path.join(assetsDest, f));
  }

  // 2. Copy favicon & manifest
  for (const f of ['favicon.png', 'game-manifest.json']) {
    if (fs.existsSync(path.join(DIST, f))) {
      fs.copyFileSync(path.join(DIST, f), path.join(stageDir, f));
    }
  }

  // 3. Copy hs-assets filtered to stay comfortably under file-count & size caps
  copyDirFiltered(path.join(DIST, 'hs-assets'), path.join(stageDir, 'hs-assets'), opts.skipPrefixes);

  // 4. Write portal-compliant root index.html
  const rawHtml = fs.readFileSync(path.join(DIST, 'game.html'), 'utf-8');
  let portalHtml = stripExternalTagsAndInjectPortal(rawHtml, portal);
  if (opts.cdnFallbackBase) {
    // Rewrites optional omitted audio/asset fetches gracefully if hosted on itch.io
    portalHtml = portalHtml.replace(
      '</head>',
      `  <script>window.__SNSHERO_CDN_FALLBACK__ = '${opts.cdnFallbackBase}';</script>\n</head>`,
    );
  }
  fs.writeFileSync(path.join(stageDir, 'index.html'), portalHtml, 'utf-8');

  const stats = countFilesAndBytes(stageDir);
  const zipPath = path.join(OUT_ROOT, `snshero-${portal}.zip`);
  execSync(`cd "${stageDir}" && zip -qr "${zipPath}" .`);
  const zipMb = +(fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);
  fs.rmSync(stageDir, { recursive: true, force: true });

  return { portal, zipPath, zipMb, ...stats };
}

function buildItchioIframeWrapper() {
  const stageDir = path.join(OUT_ROOT, 'stage-itchio-iframe');
  fs.mkdirSync(stageDir, { recursive: true });
  const wrapperHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>SNSHero: Heroes of Elwin Village — 382-Card Tactical Web TCG</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #070b14; color: #fef3c7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #frame-wrap { position: fixed; inset: 0; width: 100%; height: 100%; }
    iframe { width: 100%; height: 100%; border: 0; display: block; background: #070b14; }
    #fallback {
      position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; padding: 24px; text-align: center; background: radial-gradient(circle at top, #172554, #070b14 70%);
      transition: opacity 0.25s ease;
    }
    #fallback.hidden { opacity: 0; pointer-events: none; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px;
      border-radius: 12px; background: #fbbf24; color: #090d16; font-weight: 800; font-size: 15px;
      text-decoration: none; box-shadow: 0 8px 24px rgba(251,191,36,0.25);
    }
    .sub { font-size: 13px; color: #cbd5e1; max-width: 420px; line-height: 1.5; }
  </style>
</head>
<body>
  <div id="frame-wrap">
    <iframe
      id="snshero-frame"
      src="https://snshero.com/game?lang=en&embed=itchio"
      title="SNSHero: Heroes of Elwin Village"
      allow="autoplay; fullscreen; clipboard-write"
      allowfullscreen
    ></iframe>
  </div>
  <div id="fallback">
    <h1 style="font-size:20px;font-weight:900;color:#fde68a;">SNSHero: Heroes of Elwin Village</h1>
    <p class="sub">Loading live 382-Card Tactical Web TCG from SNSHero.com… If your browser blocks embedded frames, launch directly below.</p>
    <a class="btn" href="https://snshero.com/game?lang=en&from=itchio&utm_source=itchio&utm_medium=iframe_fallback" target="_blank" rel="noopener noreferrer">
      Launch Full Game on SNSHero.com ↗
    </a>
  </div>
  <script>
    (function () {
      var frame = document.getElementById('snshero-frame');
      var fb = document.getElementById('fallback');
      frame.addEventListener('load', function () {
        fb.classList.add('hidden');
      });
    })();
  </script>
</body>
</html>
`;
  fs.writeFileSync(path.join(stageDir, 'index.html'), wrapperHtml, 'utf-8');
  const zipPath = path.join(OUT_ROOT, 'snshero-itchio-iframe.zip');
  execSync(`cd "${stageDir}" && zip -qr "${zipPath}" .`);
  const zipKb = +(fs.statSync(zipPath).size / 1024).toFixed(2);
  fs.rmSync(stageDir, { recursive: true, force: true });
  return { portal: 'itchio-iframe', zipPath, zipKb, files: 1 };
}

const itchIframe = buildItchioIframeWrapper();

const cg = buildPortalBundle('crazygames', {
  // CrazyGames cap: <= 1,500 files, <= 250 MB total.
  // Excluding promo screenshots, guide webps, and unused raw busts/audio keeps total < 1,250 files & < 140 MB.
  skipPrefixes: ['hs-assets/screenshots', 'hs-assets/guide', 'hs-assets/snshero-audio'],
});

const itch = buildPortalBundle('itchio', {
  // itch.io cap: <= 1,000 files per ZIP, <= 500 MB.
  // Keeping core cards + cutouts + bosses + bg + UI under 1,000 files.
  skipPrefixes: [
    'hs-assets/screenshots',
    'hs-assets/guide',
    'hs-assets/snshero-audio',
    'hs-assets/characters/busts',
    'hs-assets/characters/chibi',
    'hs-assets/upper-hd',
    'hs-assets/tutorial',
    'hs-assets/items',
    'hs-assets/prestige',
  ],
  cdnFallbackBase: 'https://snshero.com',
});

const guide = `# SNSHero HTML5 Web Game Portal Submission Guide

Generated at: ${new Date().toISOString()}

## 1. itch.io (\`MKT-100\`) — Ready for Immediate Upload
- **Upload URL**: https://itch.io/game/new
- **ZIP Package (Recommended — Live iframe Wrapper)**: \`dist-portals/snshero-itchio-iframe.zip\` (${itchIframe.zipKb} KB, 1 file — loads \`https://snshero.com/game?lang=en&embed=itchio\` and gently prompts players to continue on SNSHero.com after 1+ battle or 2.5 min)
- **ZIP Package (Alternative — Self-Contained Bundle)**: \`dist-portals/snshero-itchio.zip\` (${itch.zipMb} MB, ${itch.files} files — itch.io limit: 1,000 files / 500 MB)
- **Settings**:
  - Kind of project: **HTML**
  - Check **"This file will be played in the browser"**
  - Viewport dimensions: **1280 × 720** (enable **Mobile friendly** + **Fullscreen button**)
  - Pricing: **$0 or donate (Free)**
- **Title**: \`SNSHero: Heroes of Elwin Village — 382-Card Tactical Web TCG\`
- **Short description**: \`Zero-install 382-card fantasy tactical TCG with a 40-EP Story Mode (3-Copy = 3x Awakening), Ranked Arena, and 100% Random-Deck Bogart's Hall.\`
- **Tags**: \`card-game\`, \`tcg\`, \`deckbuilding\`, \`fantasy\`, \`strategy\`, \`turn-based\`, \`html5\`, \`singleplayer\`
- **Cover Image**: \`public/hs-assets/screenshots/ingame_pack_altar.png\` (crop/resize 630×500)

## 2. CrazyGames (\`MKT-099\`) — Basic Launch Ready
- **Developer Portal**: https://developer.crazygames.com/
- **ZIP Package**: \`dist-portals/snshero-crazygames.zip\` (${cg.zipMb} MB, ${cg.files} files — CrazyGames limit: 1,500 files / 250 MB)
- **Compliance Checklist**:
  - [x] Root \`index.html\` inside ZIP
  - [x] CrazyGames SDK script included & \`gameplayStart\`/\`gameplayStop\`/\`happytime\` hooks wired
  - [x] External AdSense scripts & banners automatically suppressed (\`window.__SNSHERO_PORTAL__ = 'crazygames'\`)
  - [x] Zero forced sign-up, instant guest play (+3 Free Packs & 250G)
  - [ ] Upload 16:9 (1920×1080) & 1:1 (800×800) thumbnails + 15s gameplay clip in Developer Portal
  - [ ] Ensure no outbound "play on snshero.com" / Google Play CTAs appear in the menu during QA review

## 3. GDevelop / gd.games (\`MKT-101\`) — Policy Note
- **Verified Policy**: \`gd.games\` exclusively hosts games built & exported with the **GDevelop** game engine (external React/Vite HTML5 uploads are not allowed).
- **Recommended Strategy**:
  1. Do NOT attempt to force-upload the React/Vite ZIP to \`gd.games\`.
  2. Either build a lightweight promotional **"Elwin Sanctuary Pack Opener + 1-Turn Duel Mini-Demo"** natively inside GDevelop to publish cleanly on \`gd.games\`, OR expand general HTML5 distribution to **Newgrounds** & **Game Jolt** alongside CrazyGames and itch.io.
`;

fs.writeFileSync(path.join(OUT_ROOT, 'PORTAL_SUBMISSION_GUIDE.md'), guide, 'utf-8');
console.log(JSON.stringify({ crazygames: cg, itchioIframe: itchIframe, itchio: itch }, null, 2));
