import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = path.resolve(process.cwd(), 'public/hs-assets/screenshots');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const TARGETS = [
  {
    name: 'ingame_ranked_battle.png',
    url: 'http://localhost:3000/game.html?mode=ranked_battle',
    delay: 3500,
  },
  {
    name: 'ingame_ai_battle.png',
    url: 'http://localhost:3000/game.html?mode=ai_battle',
    delay: 3500,
  },
  {
    name: 'ingame_story_battle.png',
    url: 'http://localhost:3000/game.html?mode=story_battle',
    delay: 3500,
  },
  {
    name: 'ingame_story_theater.png',
    url: 'http://localhost:3000/game.html?mode=story',
    delay: 3000,
  },
  {
    name: 'ingame_collection_awake.png',
    url: 'http://localhost:3000/game.html?mode=collection',
    delay: 2500,
  },
  {
    name: 'ingame_pack_altar.png',
    url: 'http://localhost:3000/game.html?mode=pack',
    delay: 2500,
  },
];

console.log('📸 [capture] Starting in-game screenshots capture via Chrome headless...');

for (const t of TARGETS) {
  const outPath = path.join(OUT_DIR, t.name);
  console.log(`📸 [capture] Capturing ${t.name} from ${t.url}...`);
  try {
    execSync(
      `"${CHROME_PATH}" --headless=new --screenshot="${outPath}" --window-size=1920,1080 --virtual-time-budget=${t.delay} "${t.url}"`,
      { stdio: 'inherit' }
    );
    console.log(`✅ [capture] Saved ${t.name} (${fs.statSync(outPath).size} bytes)`);
  } catch (err) {
    console.error(`❌ [capture] Failed to capture ${t.name}:`, err.message);
  }
}

console.log('🎉 [capture] All screenshots captured successfully!');
