import fs from 'fs';
import path from 'path';

const SITE_ORIGIN = 'https://snshero.com';
const GA_MEASUREMENT_ID = 'G-MT60DTV1KJ';
const GOOGLE_ADS_ID = 'AW-980426001';
const TODAY_ISO = new Date().toISOString().slice(0, 10);

// Root-level static HTML files served at 200 OK without trailing slash on GitHub Pages.
// All directory-based routes (written as <path>/index.html) MUST use trailing slashes
// so GitHub Pages returns 200 OK directly instead of a 301 redirect loop.
const EXTENSIONLESS_ROOT_PATHS = new Set(['/', '/game', '/book', '/webtoon', '/sns', '/license']);

function toCanonicalPath(urlPath) {
  if (!urlPath || urlPath === '/') return '/';
  const cleaned = `/${String(urlPath).replace(/^\/+|\/+$/g, '')}`;
  if (EXTENSIONLESS_ROOT_PATHS.has(cleaned)) return cleaned;
  return `${cleaned}/`;
}

const GA_HEAD_SNIPPET = `  <!-- Google tag (gtag.js) - GA4 + Google Ads snshero.com -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    if (!/^(localhost|127\\.0\\.0\\.1|.*\\.ts\\.net)$/i.test(location.hostname) || /[?&]ga_debug=1\\b/.test(location.search)) {
      gtag('config', '${GA_MEASUREMENT_ID}');
      gtag('config', '${GOOGLE_ADS_ID}');
    }
  </script>`;

const FACTIONS = [
  {
    slug: 'faction-human',
    cardClass: 'PRIEST',
    heroKo: '카단',
    heroEn: 'Kadan',
    titleKo: '인간종족 · 성기사 카단 25종 카드 도감 & 수호 회복 덱 공략',
    titleEn: 'Human Faction · Paladin Kadan 25-Card Codex & Control Deck Guide',
    nameKo: '인간종족 (라이트헤븐)',
    nameEn: 'Human Faction (Lighthaven)',
    powerKo: '설원의 치유 (2마나: 생명력 +2 회복)',
    powerEn: 'Snowfield Heal (2 Mana: Restore +2 Health)',
    portrait: '/hs-assets/characters/cutouts/041_Kadan.webp',
    strategyKo:
      '성기사 카단이 이끄는 인간종족은 생명력 회복·최대 체력 증폭·적 하수인 제압 주문으로 중후반 전장을 지배하는 정통 컨트롤 & 버프 진영입니다. 스토리모드에서 핵심 수호병 3장을 모으면 3배 각성 체력으로 난공불락의 성벽을 구축할 수 있습니다.',
    strategyEn:
      'Led by Paladin Kadan of Elwin Village, the Human Faction dominates mid-to-late board states through healing synergies, max-Health buffs, and high-value removal spells. Collecting 3 copies in Story Mode unlocks 3x Awakened stats for an unbreakable frontline.',
  },
  {
    slug: 'faction-water',
    cardClass: 'MAGE',
    heroKo: '포세이돈',
    heroEn: 'Poseidon',
    titleKo: '물종족 · 바다신 포세이돈 25종 카드 도감 & 빙결 주문 덱 공략',
    titleEn: 'Water Faction · Sea God Poseidon 25-Card Codex & Freeze Spell Deck Guide',
    nameKo: '물종족 (심연 해역)',
    nameEn: 'Water Faction (Abyssal Sea)',
    powerKo: '심해 수압탄 (2마나: 피해 1)',
    powerEn: 'Abyssal Waterbolt (2 Mana: Deal 1 damage)',
    portrait: '/hs-assets/characters/cutouts/010_Poseidon.webp',
    strategyKo:
      '바다신 포세이돈의 물종족은 광역 빙결(Freeze)과 강력한 직격 수압·해일 주문으로 적의 공격 템포를 완전히 묶고 일격에 마무리하는 주문 컨트롤 & 번(Burn) 진영입니다.',
    strategyEn:
      'Commanded by Sea God Poseidon, the Water Faction locks down enemy boards with AoE Freeze mechanics while unleashing high-damage tidal spells and precision burst finishers.',
  },
  {
    slug: 'faction-fire',
    cardClass: 'WARRIOR',
    heroKo: '이그니스',
    heroEn: 'Ignis',
    titleKo: '불종족 · 태양황제 이그니스 25종 카드 도감 & 무기 격노 덱 공략',
    titleEn: 'Fire Faction · Sun Emperor Ignis 25-Card Codex & Weapon Enrage Guide',
    nameKo: '불종족 (불꽃 궁정)',
    nameEn: 'Fire Faction (Flame Court)',
    powerKo: '태양 갑주 (2마나: 방어도 +2)',
    powerEn: 'Solar Aegis (2 Mana: Gain +2 Armor)',
    portrait: '/hs-assets/characters/cutouts/011_Ignis.webp',
    strategyKo:
      '태양황제 이그니스의 불종족은 두터운 방어도 누적과 강력한 화염 대검 무기, 피해를 입을수록 공격력이 폭발하는 격노(Enrage)·돌진 시너지로 적 영웅을 압살하는 공방 일체형 진영입니다.',
    strategyEn:
      'Ruled by Sun Emperor Ignis, the Fire Faction stacks resilient Armor while wielding heavy flame weapons, Charge finishers, and Enrage minions whose Attack skyrockets upon taking damage.',
  },
  {
    slug: 'faction-wind',
    cardClass: 'HUNTER',
    heroKo: '바람신 토람',
    heroEn: 'Wind God Toram',
    titleKo: '바람종족 · 바람신 토람 25종 카드 도감 & 초고속 어그로 덱 공략',
    titleEn: 'Wind Faction · Wind God Toram 25-Card Codex & Tempo Aggro Deck Guide',
    nameKo: '바람종족 (폭풍 바람섬)',
    nameEn: 'Wind Faction (Storm Wind Isle)',
    powerKo: '폭풍 저격 (2마나: 적 영웅에게 피해 2)',
    powerEn: 'Tempest Snipe (2 Mana: Deal 2 damage to enemy Hero)',
    portrait: '/hs-assets/characters/cutouts/030_Wind_God_Toram.webp',
    strategyKo:
      '바람신 토람의 바람종족은 매 턴 적 본체를 꿰뚫는 폭풍 저격과 속공·비밀 함정·야수 연계로 상대가 후반 플랜을 완성하기 전에 승부를 결정짓는 초고속 템포 어그로 진영입니다.',
    strategyEn:
      'Guided by Wind God Toram, the Wind Faction pressures the enemy Hero relentlessly every turn with Tempest Snipe, Charge strikers, tactical Secrets, and beast tribe synergies.',
  },
  {
    slug: 'faction-earth',
    cardClass: 'PALADIN',
    heroKo: '콜로서스',
    heroEn: 'Colossus',
    titleKo: '땅종족 · 태고거신 콜로서스 25종 카드 도감 & 천상의 보호막 덱 공략',
    titleEn: 'Earth Faction · Ancient Colossus 25-Card Codex & Divine Shield Midrange Guide',
    nameKo: '땅종족 (대지 성채)',
    nameEn: 'Earth Faction (Earth Bastion)',
    powerKo: '성채 수호병 소집 (2마나: 1/1 수호병 소환)',
    powerEn: 'Bastion Call (2 Mana: Summon a 1/1 Guardian)',
    portrait: '/hs-assets/characters/cutouts/040_Colossus.webp',
    strategyKo:
      '태고거신 콜로서스의 땅종족은 매 턴 토큰 수호병을 전개하고 천상의 보호막(Divine Shield)과 전체 공격력/체력 축복 버프를 씌워 필드 교환비를 압도하는 정석 미드레인지 진영입니다.',
    strategyEn:
      'Anchored by Ancient Colossus, the Earth Faction floods the board with Bastion tokens and fortifies allies with Divine Shields and potent stat-buff blessings for unbeatable trades.',
  },
  {
    slug: 'faction-undead',
    cardClass: 'ROGUE',
    heroKo: '아르투스',
    heroEn: 'Artus',
    titleKo: '언데드종족 · 데스나이트 아르투스 25종 카드 도감 & 연계 암살 덱 공략',
    titleEn: 'Undead Faction · Death Knight Artus 25-Card Codex & Combo Miracle Guide',
    nameKo: '언데드종족 (섀도우렐름)',
    nameEn: 'Undead Faction (Shadow Realm)',
    powerKo: '섀도우 단검술 (2마나: 1/2 단검 장착)',
    powerEn: 'Shadow Blades (2 Mana: Equip a 1/2 Dagger)',
    portrait: '/hs-assets/characters/cutouts/060_Death_Knight_Artus.webp',
    strategyKo:
      '데스나이트 섭정 아르투스의 언데드종족은 0~2코스트 저비용 주문과 연계(Combo) 키워드, 무기 강화 및 은신 암살자를 폭발적으로 연결해 단 한 턴에 전세를 뒤집는 하이엔드 템포·미라클 진영입니다.',
    strategyEn:
      'Commanded by Regent Death Knight Artus, the Undead Faction chains low-cost spells, Combo burst triggers, poisoned blades, and Stealth assassins for explosive one-turn swings.',
  },
  {
    slug: 'faction-elf',
    cardClass: 'SHAMAN',
    heroKo: '에일라',
    heroEn: 'Aila',
    titleKo: '엘프종족 · 대마도사 에일라 25종 카드 도감 & 정령석 질풍 덱 공략',
    titleEn: 'Elf Faction · Archmage Aila 25-Card Codex & Spirit Stone Windfury Guide',
    nameKo: '엘프종족 (달빛 실반)',
    nameEn: 'Elf Faction (Moonlit Sylvan)',
    powerKo: '정령석 소환 (2마나: 무작위 기본 정령석 소환)',
    powerEn: 'Summon Spirit Stone (2 Mana: Summon a random Spirit Totem)',
    portrait: '/hs-assets/characters/cutouts/070_Aila.webp',
    strategyKo:
      '초승달 대마도사 에일라의 엘프종족은 정령석 토템 전개, 마나 과부하(Overload)를 활용한 오버스탯 정령 소환, 그리고 질풍(Windfury)·전체 공격력 증폭 피니시로 순식간에 킬각을 잡는 하이브리드 진영입니다.',
    strategyEn:
      'Led by Crescent Archmage Aila, the Elf Faction summons Spirit Stones, cheats out over-statted elementals via Overload, and closes games instantly with Windfury and board-wide Attack surges.',
  },
  {
    slug: 'faction-dwarf',
    cardClass: 'WARLOCK',
    heroKo: '아이언포지',
    heroEn: 'Ironforge',
    titleKo: '드워프종족 · 황금거신 아이언포지 25종 카드 도감 & 드로우 위니/핸드락 공략',
    titleEn: 'Dwarf Faction · Golden Titan Ironforge 25-Card Codex & Card-Draw Deck Guide',
    nameKo: '드워프종족 (딥포지 공방)',
    nameEn: 'Dwarf Faction (Deepforge Foundry)',
    powerKo: '용광로 마력 전환 (2마나: 피해 2 입고 카드 1장 드로우)',
    powerEn: 'Foundry Tap (2 Mana: Take 2 damage and draw a card)',
    portrait: '/hs-assets/characters/cutouts/080_Ironforge.webp',
    strategyKo:
      '황금 거신병 아이언포지의 드워프종족은 영웅 능력으로 매 턴 패를 보충하여 저코스트 물량 공세(위니 덱) 또는 거대 거신병 전개(핸드 덱) 두 가지 극단적 메타를 모두 구사하는 최상위 티어 진영입니다.',
    strategyEn:
      'Powered by Golden Titan Ironforge, the Dwarf Faction converts Health into relentless card draw—enabling both hyper-fast swarming Zoo decks and massive Giant-fueled Hand control decks.',
  },
  {
    slug: 'faction-beast',
    cardClass: 'DRUID',
    heroKo: '펜릴',
    heroEn: 'Fenrir',
    titleKo: '동물종족 · 빙결늑대왕 펜릴 25종 카드 도감 & 마나 가속 램프 덱 공략',
    titleEn: 'Beastkin Faction · Frostwolf King Fenrir 25-Card Codex & Mana Ramp Guide',
    nameKo: '동물종족 (야성의 대지)',
    nameEn: 'Beastkin Faction (Wildlands)',
    powerKo: '영수 각성 (2마나: 이번 턴 공격력 +1, 방어도 +1)',
    powerEn: 'Primal Awakening (2 Mana: +1 Attack this turn and +1 Armor)',
    portrait: '/hs-assets/characters/cutouts/081_Fenrir.webp',
    strategyKo:
      '빙결늑대왕 펜릴의 동물종족은 마나 수정 가속(Ramp)으로 남들보다 빠르게 고코스트 고대 영수를 소환하고, 상황에 따라 두 가지 효과 중 하나를 고르는 선택(Choose One) 유연성으로 모든 상성에 대응하는 올라운더 진영입니다.',
    strategyEn:
      'Commanded by Frostwolf King Fenrir, the Beastkin Faction accelerates Mana crystals early to drop towering ancients ahead of curve while adapting on the fly with versatile Choose One cards.',
  },
];

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanCardText(txt) {
  return String(txt || '')
    .replace(/<\/?b>/gi, '')
    .replace(/\$/g, '')
    .replace(/\[x\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function writeHtmlFile(distDir, urlPath, html) {
  const clean = urlPath.replace(/^\/+|\/+$/g, '');
  if (!clean) {
    fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');
    return;
  }
  const dir = path.join(distDir, clean);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function injectHreflangIntoExistingHtml(htmlPath, koUrl, enUrl) {
  if (!fs.existsSync(htmlPath)) return;
  let html = fs.readFileSync(htmlPath, 'utf8');
  const normKo = toCanonicalPath(koUrl);
  const normEn = toCanonicalPath(enUrl);
  html = html.replace(/\s*<link rel="alternate" hreflang="(?:ko|en|x-default)"[^>]*>\s*/gi, '\n  ');
  const tags = [
    `<link rel="alternate" hreflang="ko" href="${SITE_ORIGIN}${normKo}" />`,
    `<link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${normEn}" />`,
    `<link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${normKo}" />`,
  ].join('\n  ');
  html = html.replace(/(<link rel="canonical"[^>]*>)/i, `$1\n  ${tags}`);
  fs.writeFileSync(htmlPath, html, 'utf8');
}

function extractAssetTags(distHtml) {
  const links = distHtml.match(/<link[^>]+href=["']\/assets\/[^"']+["'][^>]*>/g) || [];
  const scripts = distHtml.match(/<script[^>]+src=["']\/assets\/[^"']+["'][^>]*><\/script>/g) || [];
  return { links: links.join('\n  '), scripts: scripts.join('\n  ') };
}

function parseEnglishEpisodesMap(rootDir) {
  const filePath = path.join(rootDir, 'src/content/novelRawEpisodesEn.ts');
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const startIdx = raw.indexOf('{');
  const endIdx = raw.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1) return {};
  try {
    return JSON.parse(raw.slice(startIdx, endIdx + 1));
  } catch {
    return {};
  }
}

function extractMarkdownParagraphs(md, maxParagraphs = 3) {
  const lines = String(md || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith('#') &&
        !l.startsWith('===') &&
        !l.startsWith('---') &&
        !/^https?:\/\/snshero\.com/i.test(l) &&
        !/want to play the card game/i.test(l) &&
        !/play now at the official site/i.test(l),
    );
  return lines.slice(0, maxParagraphs);
}

function buildRedirectHtml({ targetPath, canonicalPath, title }) {
  const canonicalUrl = `${SITE_ORIGIN}${canonicalPath}`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
${GA_HEAD_SNIPPET}
  <meta http-equiv="refresh" content="0; url=${targetPath}" />
  <meta name="robots" content="noindex, follow" />
  <link rel="canonical" href="${canonicalUrl}" />
  <title>${escHtml(title)}</title>
  <script>
    (function () {
      var target = ${JSON.stringify(targetPath)};
      var incomingQ = window.location.search || '';
      var h = window.location.hash || '';
      if (incomingQ) {
        target += (target.indexOf('?') >= 0 ? '&' : '?') + incomingQ.slice(1);
      }
      window.location.replace(target + h);
    })();
  </script>
</head>
<body style="background:#120b06;color:#f8ebd2;font-family:sans-serif;padding:32px;text-align:center;">
  <p><a href="${targetPath}" style="color:#fcd34d;">${escHtml(canonicalUrl)}</a> 페이지로 이동합니다.</p>
</body>
</html>`;
}

function renderWikiShell({ lang, title, description, koPath, enPath, ogImage, jsonLdObj, bodyHtml }) {
  const isKo = lang === 'ko';
  const normKo = toCanonicalPath(koPath);
  const normEn = toCanonicalPath(enPath);
  const selfPath = isKo ? normKo : normEn;
  const canonicalUrl = `${SITE_ORIGIN}${selfPath}`;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
${GA_HEAD_SNIPPET}
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#120b06" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${canonicalUrl}" />
  <link rel="alternate" hreflang="ko" href="${SITE_ORIGIN}${normKo}" />
  <link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${normEn}" />
  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${normKo}" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${isKo ? '눈히어로 (SNSHero.com)' : 'SNSHero.com'}" />
  <meta property="og:locale" content="${isKo ? 'ko_KR' : 'en_US'}" />
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(description)}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${SITE_ORIGIN}${ogImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escHtml(title)}" />
  <meta name="twitter:description" content="${escHtml(description)}" />
  <meta name="twitter:image" content="${SITE_ORIGIN}${ogImage}" />
  <script type="application/ld+json">${JSON.stringify(jsonLdObj)}</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; background: #090d16; color: #fdfcfc; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Nanum Gothic', monospace; line-height: 1.65; overflow-x: hidden; }
    .wrap { max-width: 960px; margin: 0 auto; padding: 24px 16px 72px; }
    .topbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 16px; margin-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.14); }
    .nav-links { display: flex; flex-wrap: wrap; gap: 8px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 46px; padding: 10px 16px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: #201d1d; color: #fdfcfc; text-decoration: none; font-weight: 700; font-size: 13px; }
    .btn-cta { background: #f59e0b; color: #120b06; border-color: #fbbf24; font-size: 14px; }
    .eyebrow { color: #fcd34d; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    h1 { font-size: clamp(22px, 5vw, 30px); line-height: 1.3; margin: 8px 0 12px; color: #ffffff; }
    h2 { font-size: 19px; color: #fde68a; margin: 32px 0 12px; padding-left: 10px; border-left: 3px solid #f59e0b; }
    .panel { background: #131824; border: 1px solid rgba(255,255,255,0.12); padding: 18px; margin: 16px 0; }
    .hero-banner { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; }
    .hero-banner img { width: 96px; height: 96px; object-fit: contain; background: #090d16; border: 1px solid rgba(252,211,77,0.35); padding: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin-top: 14px; }
    .card-box { background: #0d121d; border: 1px solid rgba(255,255,255,0.12); padding: 12px; display: flex; gap: 12px; align-items: flex-start; }
    .card-box img { width: 56px; height: 56px; object-fit: cover; border: 1px solid rgba(252,211,77,0.3); flex-shrink: 0; }
    .badge { display: inline-block; padding: 2px 6px; font-size: 11px; border-radius: 3px; background: #1e293b; color: #fcd34d; border: 1px solid rgba(252,211,77,0.3); margin-right: 4px; }
    .faction-nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
    footer { margin-top: 44px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.12); font-size: 12px; color: #a8a29e; }
  </style>
</head>
<body>
  <div class="wrap">
    <nav class="topbar" aria-label="SNSHero Navigation">
      <div class="nav-links">
        <a class="btn" href="${isKo ? '/' : '/en/'}">${isKo ? '공식 소개' : 'Showcase'}</a>
        <a class="btn btn-cta" href="${isKo ? '/game' : '/en/game/'}">${isKo ? '⚡ 무료 3팩 + 250G 즉시 게임 시작' : '⚡ Play Free Now (+3 Packs & 250G)'}</a>
        <a class="btn" href="${isKo ? '/wiki/cards/' : '/en/wiki/cards/'}">${isKo ? '382종 카드 도감' : '382-Card Codex'}</a>
        <a class="btn" href="${isKo ? '/book' : '/en/book/'}">${isKo ? '웹소설 40화' : 'Web Novel'}</a>
        <a class="btn" href="${isKo ? '/webtoon' : '/en/webtoon/'}">${isKo ? '보이스 웹툰' : 'Webtoon'}</a>
      </div>
      <a class="btn" href="${isKo ? normEn : normKo}">${isKo ? '🌐 English' : '🌐 한국어'}</a>
    </nav>
    ${bodyHtml}
    <footer>
      <p>${isKo ? '눈히어로 : 카단의 여정 (SNSHero.com) — 무설치 382종 판타지 전략 웹 TCG 공식 아카이브' : "SNSHero : Kadan's Journey (SNSHero.com) — Free 382-Card Browser Strategy TCG Archive"}</p>
      <p>${isKo ? '본 게임·웹소설·웹툰은 저작권 및 라이선스가 적용된 눈히어로 독자 저작물입니다.' : 'This game, web novel, and webtoon are original works protected by SNSHero copyright & license.'} <a href="${isKo ? '/license' : '/en/license/'}" style="color:#fcd34d;">${isKo ? '자세히 보기' : 'Learn More'}</a></p>
    </footer>
  </div>
</body>
</html>`;
}

export function generateAllSeoPages({ rootDir, distDir, publicDir }) {
  const sitemapEntries = [];
  const addSitemapPair = (koPath, enPath, priority = '0.8', changefreq = 'weekly') => {
    const normKo = toCanonicalPath(koPath);
    const normEn = toCanonicalPath(enPath);
    sitemapEntries.push({ loc: normKo, koPath: normKo, enPath: normEn, priority, changefreq });
    sitemapEntries.push({ loc: normEn, koPath: normKo, enPath: normEn, priority, changefreq });
  };

  // ── STEP 1: Recover 100% of Legacy Indexed Google URLs (Zero 404 Leaks) ──
  const legacyRedirects = [
    { from: '/home', to: '/', canonical: '/', title: 'Redirecting to SNSHero.com (/)...' },
    { from: '/main', to: '/', canonical: '/', title: 'Redirecting to SNSHero.com (/)...' },
    { from: '/play', to: '/game', canonical: '/game', title: 'Redirecting to SNSHero Game (/game)...' },
    { from: '/card-play', to: '/game', canonical: '/game', title: 'Redirecting to SNSHero Game (/game)...' },
    { from: '/deck', to: '/game?open=collection', canonical: '/game', title: 'Redirecting to SNSHero Deck Builder (/game)...' },
    { from: '/ranking', to: '/game', canonical: '/game', title: 'Redirecting to SNSHero Ranked Arena (/game)...' },
    { from: '/setting', to: '/game', canonical: '/game', title: 'Redirecting to SNSHero Game (/game)...' },
    { from: '/animation', to: '/webtoon', canonical: '/webtoon', title: 'Redirecting to SNSHero Voice Webtoon (/webtoon)...' },
    { from: '/cinema', to: '/webtoon', canonical: '/webtoon', title: 'Redirecting to SNSHero Voice Webtoon (/webtoon)...' },
    { from: '/movie', to: '/webtoon', canonical: '/webtoon', title: 'Redirecting to SNSHero Voice Webtoon (/webtoon)...' },
  ];
  for (const item of legacyRedirects) {
    writeHtmlFile(
      distDir,
      item.from,
      buildRedirectHtml({ targetPath: item.to, canonicalPath: item.canonical, title: item.title }),
    );
  }

  // ── STEP 2A: Add hreflang to Core KO Pages & Generate Dedicated English Core Hubs (/en/*) ──
  const corePairs = [
    { file: 'index.html', koPath: '/', enPath: '/en', priority: '1.0', changefreq: 'daily' },
    { file: 'game/index.html', koPath: '/game', enPath: '/en/game', priority: '0.95', changefreq: 'daily' },
    { file: 'book/index.html', koPath: '/book', enPath: '/en/book', priority: '0.9', changefreq: 'weekly' },
    { file: 'webtoon/index.html', koPath: '/webtoon', enPath: '/en/webtoon', priority: '0.9', changefreq: 'weekly' },
    { file: 'sns/index.html', koPath: '/sns', enPath: '/en/sns', priority: '0.9', changefreq: 'daily' },
    { file: 'license/index.html', koPath: '/license', enPath: '/en/license', priority: '0.6', changefreq: 'monthly' },
    { file: 'wiki/tip/index.html', koPath: '/wiki/tip', enPath: '/en/wiki/tip', priority: '0.85', changefreq: 'weekly' },
  ];
  for (const p of corePairs) {
    injectHreflangIntoExistingHtml(path.join(distDir, p.file), p.koPath, p.enPath);
    if (p.koPath === '/game') injectHreflangIntoExistingHtml(path.join(distDir, 'game.html'), p.koPath, p.enPath);
    if (p.koPath === '/book') injectHreflangIntoExistingHtml(path.join(distDir, 'book.html'), p.koPath, p.enPath);
    if (p.koPath === '/webtoon') injectHreflangIntoExistingHtml(path.join(distDir, 'webtoon.html'), p.koPath, p.enPath);
    if (p.koPath === '/sns') injectHreflangIntoExistingHtml(path.join(distDir, 'sns.html'), p.koPath, p.enPath);
    if (p.koPath === '/license') injectHreflangIntoExistingHtml(path.join(distDir, 'license.html'), p.koPath, p.enPath);
    addSitemapPair(p.koPath, p.enPath, p.priority, p.changefreq);
  }

  // Build /en (English Official Showcase) from dist/index.html assets
  const indexDistHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const indexAssets = extractAssetTags(indexDistHtml);
  writeHtmlFile(
    distDir,
    '/en',
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
${GA_HEAD_SNIPPET}
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#1b120b" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" sizes="192x192" href="/hs-assets/brand/pwa-icon-192.png" />
  <title>SNSHero : Kadan's Journey — Free 382-Card Browser Strategy TCG (No Download) | Official Site</title>
  <meta name="description" content="Play SNSHero (Heroes of Elwin Village) instantly in your browser with zero download or sign-up! Claim 3 Free Card Packs + 250 Gold + 160 Dust on arrival, guaranteed Legendary in first 10 packs, 40-episode voiced Story Mode (3 copies = 3x Awakened stats), Ranked Arena, and Bogart's Den." />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${SITE_ORIGIN}/en/" />
  <link rel="alternate" hreflang="ko" href="${SITE_ORIGIN}/" />
  <link rel="alternate" hreflang="en" href="${SITE_ORIGIN}/en/" />
  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SNSHero.com" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:url" content="${SITE_ORIGIN}/en/" />
  <meta property="og:title" content="SNSHero : Kadan's Journey — Free 382-Card Browser TCG (+3 Free Packs)" />
  <meta property="og:description" content="9 Factions, 382 Collectible Cards, 40 Fully Voiced Story Chapters, and Instant Browser Play on Desktop & Mobile." />
  <meta property="og:image" content="${SITE_ORIGIN}/hs-assets/screenshots/ingame_pack_altar.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="SNSHero — Free 382-Card Browser Strategy TCG (No Install)" />
  <meta name="twitter:description" content="Open 3 Free Card Packs immediately! 9 Factions, 382 Cards, 40-Episode Voiced Story Mode & Global Ranked Arena." />
  <meta name="twitter:image" content="${SITE_ORIGIN}/hs-assets/screenshots/ingame_pack_altar.png" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: "SNSHero : Kadan's Journey (Heroes of Elwin Village)",
    url: `${SITE_ORIGIN}/en/`,
    genre: ['Collectible Card Game', 'Strategy', 'Browser Game'],
    gamePlatform: ['Web Browser', 'Mobile Web', 'Desktop Web'],
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    inLanguage: 'en',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  })}</script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6937094123258335" crossorigin="anonymous"></script>
  ${indexAssets.links}
</head>
<body style="margin:0;background:#090604;color:#f8ebd2;">
  <div id="promo-root">
    <main style="max-width:960px;margin:0 auto;padding:32px 20px;font-family:sans-serif;">
      <h1>SNSHero : Kadan's Journey — Free 382-Card Browser Strategy Card Game</h1>
      <p>Play directly in your desktop or mobile browser with zero installation and zero sign-up. New players receive 3 Free Card Packs, 250 Gold, and 160 Arcane Dust immediately, with a 100% guaranteed Legendary card within your first 10 packs.</p>
      <nav aria-label="English Quick Links">
        <a href="/en/game/">Play Game Now</a> · <a href="/en/wiki/tip/">Strategy Guide</a> · <a href="/en/wiki/cards/">382-Card Codex</a> · <a href="/en/book/">40-Episode Web Novel</a> · <a href="/en/webtoon/">Full-Color Voice Webtoon</a> · <a href="/en/sns/">AI 1,000-Match Benchmark (/sns)</a>
      </nav>
    </main>
  </div>
  ${indexAssets.scripts}
</body>
</html>`,
  );

  // Build /en/game from dist/game/index.html
  const gameDistHtml = fs.readFileSync(path.join(distDir, 'game/index.html'), 'utf8');
  const enGameHtml = gameDistHtml
    .replace(/<title>[\s\S]*?<\/title>/i, "<title>Play SNSHero Free — 382-Card Browser Strategy TCG (+3 Free Packs) | SNSHero.com</title>")
    .replace(/<meta name="description" content="[^"]*"\s*\/>/i, '<meta name="description" content="Launch SNSHero directly in your browser! Build 30-card decks across 9 fantasy factions (382 cards), conquer 40 voiced Story Bosses (3 copies = 3x stats), or battle in Ranked Arena." />')
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${SITE_ORIGIN}/en/game/" />`);
  writeHtmlFile(distDir, '/en/game', enGameHtml);

  // Build /en/sns from dist/sns/index.html
  const snsDistHtml = fs.readFileSync(path.join(distDir, 'sns/index.html'), 'utf8');
  const enSnsHtml = snsDistHtml
    .replace('<html lang="ko">', '<html lang="en">')
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>SNSHero AI TCG Benchmark — Claude vs ChatGPT vs Gemini 1,000-Match Arena (/en/sns)</title>')
    .replace(/<meta name="description" content="[^"]*"\s*\/>/i, '<meta name="description" content="Live 1,000-match tactical card battle benchmark comparing SNSHero Native AI against Claude, ChatGPT, and Gemini via the open /mcp JSON-RPC Arena protocol." />')
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${SITE_ORIGIN}/en/sns/" />`);
  writeHtmlFile(distDir, '/en/sns', enSnsHtml);

  // Build /en/license from dist/license/index.html
  const licenseDistHtml = fs.readFileSync(path.join(distDir, 'license/index.html'), 'utf8');
  const enLicenseHtml = licenseDistHtml
    .replace('<html lang="ko">', '<html lang="en">')
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>SNSHero License, Copyright, IP Transfer &amp; Privacy Policy (/en/license)</title>')
    .replace(/<meta name="description" content="[^"]*"\s*\/>/i, '<meta name="description" content="Official copyright notice, paid license reuse terms, full IP transfer inquiry (dryudryu@gmail.com), and Privacy Policy for SNSHero." />')
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${SITE_ORIGIN}/en/license/" />`);
  writeHtmlFile(distDir, '/en/license', enLicenseHtml);

  // Build /en/wiki/tip English Strategy Guide
  writeHtmlFile(
    distDir,
    '/en/wiki/tip',
    renderWikiShell({
      lang: 'en',
      title: "SNSHero Official Strategy Guide — Deck Building, 3x Awakening & Boss Tips | SNSHero.com",
      description:
        "Complete beginner-to-master strategy guide for SNSHero: 9 Factions, 382 Collectible Cards, 3-Copy = 3x Story Awakening rule, Kadan Spirit X10 Ultimate combos, and Bogart's Den.",
      koPath: '/wiki/tip/',
      enPath: '/en/wiki/tip/',
      ogImage: '/hs-assets/screenshots/ingame_pack_altar.png',
      jsonLdObj: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'SNSHero Official Strategy & Mechanics Guide (382 Cards · 9 Factions)',
        inLanguage: 'en',
        url: `${SITE_ORIGIN}/en/wiki/tip/`,
      },
      bodyHtml: `
      <span class="eyebrow">Official Tactical Manual · 382 Collectible Cards</span>
      <h1>SNSHero : Kadan's Journey — Complete Browser TCG Strategy Guide</h1>
      <div class="panel">
        <p><strong>Instant Free Start:</strong> Every new adventurer receives <strong>3 Free Card Packs + 250 Gold + 160 Dust</strong> with zero sign-up, plus a <strong>100% guaranteed Legendary card within your first 10 packs</strong>.</p>
        <p><a class="btn btn-cta" href="/en/game/">⚡ Launch Game &amp; Open 3 Free Packs</a></p>
      </div>
      <h2>1. Core Combat &amp; 30-Card Deck Building</h2>
      <p>Choose 1 of the 9 Faction Guardians and construct a 30-card deck (up to 2 copies per card, 1 copy per Legendary). Maximum Mana grows by +1 each turn up to 10 Mana—curve out cleanly with 6–8 early 1–2 Mana minions, mid-game Taunt/Removal tools, and high-impact late-game finishers.</p>
      <h2>2. Story Mode Exclusive: 3 Copies = 3x Awakened Stats</h2>
      <p>Across the 40 fully voiced chapters of <em>Kadan's Journey</em>, owning <strong>3 or more copies</strong> of any card in your collection triples its Attack and Health (<strong>3x Awakening</strong>) during Story Boss battles! Clearing every 5th boss awards bonus Card Packs and Gold.</p>
      <h2>3. Auto-Play &amp; Kadan Spirit (X10 Joint Ultimate)</h2>
      <p>Toggle Kadan Tactical Auto-Play anytime during battle and tap the bottom-center rhythm ring while it turns <strong>Green (TAP!)</strong>. Every 10 stacks (<code>X10</code>, <code>X20</code>, <code>X30</code>...) unleashes Kadan's <em>Blizzard Ultimate</em> chained immediately with Silia's <em>Windstorm Ultimate</em>!</p>
      <h2>4. Ranked Arena &amp; Bogart's Den (100% Random 30-Card Wager)</h2>
      <p>Compete on fair 1x stats in Ranked Arena, or wager 1–1,000 Gold in Bogart's Den where both duelists battle with completely randomized 30-card decks for pure tactical mastery.</p>
      <h2>5. Explore All 9 Faction Deck Guides</h2>
      <div class="faction-nav">
        ${FACTIONS.map((f) => `<a class="btn" href="/en/wiki/${f.slug}/">${escHtml(f.nameEn)}</a>`).join('')}
      </div>`,
    }),
  );

  // ── STEP 2B: Generate 80 Web Novel + 80 Webtoon Episode Pages (KO & EN) ──
  const episodes = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/content/episodes.json'), 'utf8'));
  const enEpisodesRaw = parseEnglishEpisodesMap(rootDir);
  const webtoonManifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'src/content/webtoonEpisodeManifest.json'), 'utf8'),
  );
  const bookDistHtml = fs.readFileSync(path.join(distDir, 'book/index.html'), 'utf8');
  const webtoonDistHtml = fs.readFileSync(path.join(distDir, 'webtoon/index.html'), 'utf8');
  const bookAssets = extractAssetTags(bookDistHtml);
  const webtoonAssets = extractAssetTags(webtoonDistHtml);

  // Also generate /en/book/ and /en/webtoon/ hubs
  const buildReaderHubEn = (kind) => {
    const isBook = kind === 'book';
    const assets = isBook ? bookAssets : webtoonAssets;
    const koPath = isBook ? '/book' : '/webtoon';
    const enPath = isBook ? '/en/book/' : '/en/webtoon/';
    const enEpBase = isBook ? '/en/book' : '/en/webtoon';
    const title = isBook
      ? "Kadan's Journey — Free 40-Episode Dark Fantasy Web Novel | SNSHero.com"
      : "Kadan's Journey — Free 40-Episode Full-Color Voice Webtoon (840+ Panels) | SNSHero.com";
    const desc = isBook
      ? "Read all 40 chapters of SNSHero's dark fantasy web novel Kadan's Journey free with no sign-up, then command the novel's 382 cards in the browser TCG!"
      : "Read all 40 episodes (840+ full-color panels & 200 voiced scenes) of SNSHero's official fantasy webtoon free online, and battle every chapter boss in-game!";
    const ogImg = isBook ? '/novel-assets/kadan_novel_cover.webp' : '/webtoon-assets/episode_01/scene_00.webp';
    const epLinks = episodes
      .map(
        (e) =>
          `<li><a href="${enEpBase}/ep-${e.ep}/" style="color:#fcd34d;">Episode ${e.ep}: ${escHtml(e.titleEn)}</a></li>`,
      )
      .join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
${GA_HEAD_SNIPPET}
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#1b120b" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(desc)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${SITE_ORIGIN}${enPath}" />
  <link rel="alternate" hreflang="ko" href="${SITE_ORIGIN}${koPath}" />
  <link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${enPath}" />
  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${koPath}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(desc)}" />
  <meta property="og:url" content="${SITE_ORIGIN}${enPath}" />
  <meta property="og:image" content="${SITE_ORIGIN}${ogImg}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6937094123258335" crossorigin="anonymous"></script>
  ${assets.links}
</head>
<body class="bg-[#120b06] text-[#f8ebd2]">
  <div id="reader-root">
    <main style="max-width:760px;margin:0 auto;padding:24px;font-family:sans-serif;">
      <h1>${escHtml(title)}</h1>
      <p>${escHtml(desc)}</p>
      <ul>${epLinks}</ul>
    </main>
  </div>
  ${assets.scripts}
</body>
</html>`;
  };
  writeHtmlFile(distDir, '/en/book', buildReaderHubEn('book'));
  writeHtmlFile(distDir, '/en/webtoon', buildReaderHubEn('webtoon'));

  for (const epObj of episodes) {
    const ep = epObj.ep;
    const pad = String(ep).padStart(2, '0');
    const koMdPath = path.join(publicDir, `novel-assets/episode_${pad}.md`);
    const koMd = fs.existsSync(koMdPath) ? fs.readFileSync(koMdPath, 'utf8') : '';
    const enMd = enEpisodesRaw[String(ep)] || '';
    const koParas = extractMarkdownParagraphs(koMd, 3);
    const enParas = extractMarkdownParagraphs(enMd, 3);

    const prevEp = ep > 1 ? ep - 1 : null;
    const nextEp = ep < 40 ? ep + 1 : null;

    // 1) Web Novel KO & EN Episode Pages (/book/ep-N/ & /en/book/ep-N/)
    const koBookPath = `/book/ep-${ep}/`;
    const enBookPath = `/en/book/ep-${ep}/`;
    addSitemapPair(koBookPath, enBookPath, '0.8', 'monthly');

    for (const lang of ['ko', 'en']) {
      const isKo = lang === 'ko';
      const selfPath = isKo ? koBookPath : enBookPath;
      const epTitle = isKo ? epObj.titleKo : epObj.titleEn;
      const fullTitle = isKo
        ? `제${ep}화 ${epTitle} — 눈히어로 공식 웹소설 카단의 여정 (무료 완결) | SNSHero.com`
        : `Episode ${ep}: ${epTitle} — Kadan's Journey Dark Fantasy Web Novel | SNSHero.com`;
      const paras = isKo ? koParas : enParas;
      const snippetDesc = (paras[0] || '').slice(0, 150);
      const desc = isKo
        ? `《카단의 여정》 제${ep}화 「${epTitle}」 무료 감상: ${snippetDesc}... 소설 속 영웅과 보스를 382종 무설치 웹 TCG에서 무료 3팩 받고 직접 플레이하세요!`
        : `Read Kadan's Journey Episode ${ep} "${epTitle}" free online: ${snippetDesc}... Battle this chapter's boss in the free 382-card browser TCG!`;
      const prevHref = prevEp ? (isKo ? `/book/ep-${prevEp}/` : `/en/book/ep-${prevEp}/`) : null;
      const nextHref = nextEp ? (isKo ? `/book/ep-${nextEp}/` : `/en/book/ep-${nextEp}/`) : null;
      const gameBossHref = isKo ? `/game?mode=story&ep=${ep}` : `/en/game/?mode=story&ep=${ep}`;

      writeHtmlFile(
        distDir,
        selfPath,
        `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
${GA_HEAD_SNIPPET}
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#1b120b" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <title>${escHtml(fullTitle)}</title>
  <meta name="description" content="${escHtml(desc)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${SITE_ORIGIN}${selfPath}" />
  <link rel="alternate" hreflang="ko" href="${SITE_ORIGIN}${koBookPath}" />
  <link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${enBookPath}" />
  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${koBookPath}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escHtml(fullTitle)}" />
  <meta property="og:description" content="${escHtml(desc)}" />
  <meta property="og:url" content="${SITE_ORIGIN}${selfPath}" />
  <meta property="og:image" content="${SITE_ORIGIN}/webtoon-assets/episode_${pad}/scene_00.webp" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Chapter',
    name: isKo ? `제${ep}화: ${epTitle}` : `Episode ${ep}: ${epTitle}`,
    position: ep,
    inLanguage: lang,
    isAccessibleForFree: true,
    url: `${SITE_ORIGIN}${selfPath}`,
    isPartOf: {
      '@type': 'Book',
      name: isKo ? '눈히어로: 카단의 여정 (전 40화)' : "SNSHero: Kadan's Journey (40 Episodes)",
      url: `${SITE_ORIGIN}${isKo ? '/book' : '/en/book/'}`,
    },
  })}</script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6937094123258335" crossorigin="anonymous"></script>
  ${bookAssets.links}
</head>
<body class="bg-[#120b06] text-[#f8ebd2]">
  <div id="reader-root">
    <article style="max-width:760px;margin:0 auto;padding:24px;font-family:sans-serif;line-height:1.75;">
      <h1>${escHtml(isKo ? `제${ep}화: ${epTitle} — 눈히어로 공식 웹소설 카단의 여정` : `Episode ${ep}: ${epTitle} — Kadan's Journey Web Novel`)}</h1>
      ${paras.map((p) => `<p>${escHtml(p)}</p>`).join('\n      ')}
      <p><a href="${gameBossHref}" style="color:#fcd34d;font-weight:bold;">${isKo ? `⚔️ 제${ep}화 스토리 보스전 무설치 플레이 (무료 3팩 + 250G 지급)` : `⚔️ Battle Episode ${ep} Boss Now in Browser (+3 Free Card Packs)`}</a></p>
      <nav aria-label="Episode Navigation">
        ${prevHref ? `<a href="${prevHref}" style="color:#93c5fd;">← ${isKo ? `제${prevEp}화` : `Episode ${prevEp}`}</a> · ` : ''}
        <a href="${isKo ? '/book' : '/en/book/'}" style="color:#fcd34d;">${isKo ? '전 40화 목록' : 'All 40 Episodes'}</a>
        ${nextHref ? ` · <a href="${nextHref}" style="color:#93c5fd;">${isKo ? `제${nextEp}화` : `Episode ${nextEp}`} →</a>` : ''}
      </nav>
    </article>
  </div>
  ${bookAssets.scripts}
</body>
</html>`,
      );
    }

    // 2) Webtoon KO & EN Episode Pages (/webtoon/ep-N/ & /en/webtoon/ep-N/)
    const koToonPath = `/webtoon/ep-${ep}/`;
    const enToonPath = `/en/webtoon/ep-${ep}/`;
    addSitemapPair(koToonPath, enToonPath, '0.8', 'monthly');

    const manifestEp = webtoonManifest[String(ep)] || { totalImages: 21, images: [] };
    const sampleLinesKo = [];
    const sampleLinesEn = [];
    for (const img of (manifestEp.images || []).slice(0, 4)) {
      if (img.narrationKo) sampleLinesKo.push(img.narrationKo);
      if (img.narrationEn) sampleLinesEn.push(img.narrationEn);
      for (const d of (img.dialogues || []).slice(0, 2)) {
        if (d.textKo) sampleLinesKo.push(`${d.speakerKo || ''}: ${d.textKo}`);
        if (d.textEn) sampleLinesEn.push(`${d.speakerEn || ''}: ${d.textEn}`);
      }
    }

    for (const lang of ['ko', 'en']) {
      const isKo = lang === 'ko';
      const selfPath = isKo ? koToonPath : enToonPath;
      const epTitle = isKo ? epObj.titleKo : epObj.titleEn;
      const panelCount = manifestEp.totalImages || 21;
      const fullTitle = isKo
        ? `제${ep}화 ${epTitle} — 눈히어로 풀컬러 보이스 웹툰 (${panelCount}컷 무료) | SNSHero.com`
        : `Episode ${ep}: ${epTitle} — SNSHero Full-Color Voice Webtoon (${panelCount} Panels) | SNSHero.com`;
      const lines = (isKo ? sampleLinesKo : sampleLinesEn).slice(0, 4);
      const previewStr = (lines[0] || (isKo ? koParas[0] : enParas[0]) || '').slice(0, 140);
      const desc = isKo
        ? `눈히어로 공식 풀컬러 보이스 웹툰 《카단의 여정》 제${ep}화 「${epTitle}」 (${panelCount}컷 무로그인 무료 공개). ${previewStr}... 웹툰 속 보스를 웹 TCG에서 직접 격파하세요!`
        : `Read SNSHero's full-color voiced fantasy webtoon Episode ${ep} "${epTitle}" (${panelCount} panels, free no sign-up). ${previewStr}... Fight the chapter boss in-game!`;
      const prevHref = prevEp ? (isKo ? `/webtoon/ep-${prevEp}/` : `/en/webtoon/ep-${prevEp}/`) : null;
      const nextHref = nextEp ? (isKo ? `/webtoon/ep-${nextEp}/` : `/en/webtoon/ep-${nextEp}/`) : null;
      const gameBossHref = isKo ? `/game?mode=story&ep=${ep}` : `/en/game/?mode=story&ep=${ep}`;
      const coverImg = `/webtoon-assets/episode_${pad}/scene_00.webp`;

      writeHtmlFile(
        distDir,
        selfPath,
        `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
${GA_HEAD_SNIPPET}
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#1b120b" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <title>${escHtml(fullTitle)}</title>
  <meta name="description" content="${escHtml(desc)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${SITE_ORIGIN}${selfPath}" />
  <link rel="alternate" hreflang="ko" href="${SITE_ORIGIN}${koToonPath}" />
  <link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${enToonPath}" />
  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${koToonPath}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escHtml(fullTitle)}" />
  <meta property="og:description" content="${escHtml(desc)}" />
  <meta property="og:url" content="${SITE_ORIGIN}${selfPath}" />
  <meta property="og:image" content="${SITE_ORIGIN}${coverImg}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="${SITE_ORIGIN}${coverImg}" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ComicIssue',
    name: isKo ? `제${ep}화: ${epTitle}` : `Episode ${ep}: ${epTitle}`,
    issueNumber: String(ep),
    inLanguage: lang,
    isAccessibleForFree: true,
    image: `${SITE_ORIGIN}${coverImg}`,
    url: `${SITE_ORIGIN}${selfPath}`,
    isPartOf: {
      '@type': 'ComicSeries',
      name: isKo ? '눈히어로 공식 웹툰 — 카단의 여정' : "SNSHero Official Webtoon — Kadan's Journey",
      url: `${SITE_ORIGIN}${isKo ? '/webtoon' : '/en/webtoon/'}`,
    },
  })}</script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6937094123258335" crossorigin="anonymous"></script>
  ${webtoonAssets.links}
</head>
<body class="bg-[#120b06] text-[#f8ebd2]">
  <div id="reader-root">
    <article style="max-width:760px;margin:0 auto;padding:24px;font-family:sans-serif;line-height:1.7;">
      <h1>${escHtml(isKo ? `제${ep}화: ${epTitle} — 눈히어로 공식 보이스 웹툰` : `Episode ${ep}: ${epTitle} — SNSHero Official Voice Webtoon`)}</h1>
      <img src="${coverImg}" alt="${escHtml(epTitle)}" style="max-width:100%;height:auto;border-radius:4px;" loading="eager" />
      ${lines.map((l) => `<p>${escHtml(l)}</p>`).join('\n      ')}
      <p><a href="${gameBossHref}" style="color:#fcd34d;font-weight:bold;">${isKo ? `⚔️ 제${ep}화 보스 직접 격파하러 가기 (무설치 · 무료 3팩 지급)` : `⚔️ Fight Episode ${ep} Boss in Browser TCG (+3 Free Packs)`}</a></p>
      <nav aria-label="Webtoon Episode Navigation">
        ${prevHref ? `<a href="${prevHref}" style="color:#93c5fd;">← ${isKo ? `제${prevEp}화` : `Episode ${prevEp}`}</a> · ` : ''}
        <a href="${isKo ? '/webtoon' : '/en/webtoon/'}" style="color:#fcd34d;">${isKo ? '전 40화 웹툰 목록' : 'All 40 Webtoon Episodes'}</a> ·
        <a href="${isKo ? koBookPath : enBookPath}" style="color:#a7f3d0;">${isKo ? `제${ep}화 원작 웹소설 읽기` : `Read Episode ${ep} Novel`}</a>
        ${nextHref ? ` · <a href="${nextHref}" style="color:#93c5fd;">${isKo ? `제${nextEp}화` : `Episode ${nextEp}`} →</a>` : ''}
      </nav>
    </article>
  </div>
  ${webtoonAssets.scripts}
</body>
</html>`,
      );
    }
  }

  // ── STEP 2C: Generate 382-Card Encyclopedia Hub + 9 Faction Deck Guides (KO & EN = 20 URLs) ──
  const cardsData = JSON.parse(
    fs.readFileSync(path.join(publicDir, 'hs-assets/data/classic-cards.json'), 'utf8'),
  );
  const allCards = (cardsData.cards || []).slice().sort((a, b) => (a.cost || 0) - (b.cost || 0));
  const neutralCards = allCards.filter((c) => c.cardClass === 'NEUTRAL');

  // 1) /wiki/cards/ & /en/wiki/cards/ (382-Card Master Codex + 157 Neutral Cards)
  addSitemapPair('/wiki/cards/', '/en/wiki/cards/', '0.88', 'weekly');
  for (const lang of ['ko', 'en']) {
    const isKo = lang === 'ko';
    const factionCardsHtml = FACTIONS.map(
      (f) => `
      <div class="card-box">
        <img src="${f.portrait}" alt="${escHtml(isKo ? f.heroKo : f.heroEn)}" loading="lazy" />
        <div>
          <div><strong><a href="${isKo ? `/wiki/${f.slug}/` : `/en/wiki/${f.slug}/`}" style="color:#fcd34d;">${escHtml(isKo ? f.nameKo : f.nameEn)}</a></strong></div>
          <div style="font-size:12px;color:#d6d3d1;">${escHtml(isKo ? `수호자: ${f.heroKo} · 고유 25장` : `Guardian: ${f.heroEn} · 25 Class Cards`)}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${escHtml(isKo ? f.powerKo : f.powerEn)}</div>
        </div>
      </div>`,
    ).join('');

    const neutralGridHtml = neutralCards
      .map((c) => {
        const cName = isKo ? c.name : c.nameEn || c.name;
        const cText = cleanCardText(isKo ? c.text : c.textEn || c.text);
        const stats = c.type === 'MINION' ? `${c.attack ?? 0}/${c.health ?? 0}` : c.type;
        return `<div class="card-box">
          <img src="${c.artUrl || '/favicon.png'}" alt="${escHtml(cName)}" loading="lazy" />
          <div>
            <div><span class="badge">${c.cost}M</span><span class="badge">${escHtml(stats)}</span><strong>${escHtml(cName)}</strong></div>
            <div style="font-size:12px;color:#cbd5e1;margin-top:4px;">${escHtml(cText || (isKo ? '일반 전투 하수인' : 'Standard combat minion'))}</div>
          </div>
        </div>`;
      })
      .join('');

    writeHtmlFile(
      distDir,
      isKo ? '/wiki/cards' : '/en/wiki/cards',
      renderWikiShell({
        lang,
        title: isKo
          ? '눈히어로 382종 전체 카드 도감 & 9대 종족 덱 공략 (무설치 웹 TCG) | SNSHero.com'
          : 'SNSHero Complete 382-Card Codex & 9-Faction Deck Encyclopedia | SNSHero.com',
        description: isKo
          ? '눈히어로(SNSHero.com) 9대 종족 고유 카드 225종(종족별 25장) + 중립 카드 157종 총 382종 전체 카드 능력치·효과·일러스트 도감. 접속 즉시 무료 3팩 + 250G 지급!'
          : 'Browse all 382 collectible cards in SNSHero (225 Class Cards across 9 Factions + 157 Neutral Cards) with Mana costs, stats, effects, and deck building tips.',
        koPath: '/wiki/cards/',
        enPath: '/en/wiki/cards/',
        ogImage: '/hs-assets/screenshots/ingame_pack_altar.png',
        jsonLdObj: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: isKo ? '눈히어로 382종 공식 카드 도감' : 'SNSHero 382-Card Official Encyclopedia',
          url: `${SITE_ORIGIN}${isKo ? '/wiki/cards/' : '/en/wiki/cards/'}`,
        },
        bodyHtml: `
        <span class="eyebrow">${isKo ? '공식 아카이브 · 9대 종족 225장 + 중립 157장 = 382장' : 'Official Codex · 225 Faction Cards + 157 Neutral = 382 Cards'}</span>
        <h1>${isKo ? '눈히어로 (SNSHero) 382종 전체 카드 도감 & 종족별 덱 가이드' : 'SNSHero Complete 382-Card Encyclopedia & Faction Guides'}</h1>
        <div class="panel">
          <p>${isKo ? '설치·가입 없이 브라우저에서 바로 382종의 카드로 30장 전략 덱을 구성해 보세요. 첫 방문 시 무료 카드팩 3개 + 250골드 + 160가루가 즉시 지급되며 첫 10팩 내 전설 카드가 100% 확정 등장합니다!' : 'Build custom 30-card decks with 382 collectible cards right in your browser—no download or sign-up required. Claim 3 Free Packs + 250 Gold + 160 Dust immediately and get a guaranteed Legendary within your first 10 packs!'}</p>
          <p><a class="btn btn-cta" href="${isKo ? '/game?open=collection' : '/en/game/?open=collection'}">${isKo ? '🃏 인게임 도감 열기 & 무료 3팩 개봉하기' : '🃏 Open In-Game Collection & Claim 3 Free Packs'}</a></p>
        </div>
        <h2>${isKo ? '9대 종족 수호자 도감 (종족별 25장 · 합계 225장)' : '9 Faction Guardians (25 Class Cards Each · 225 Total)'}</h2>
        <div class="grid">${factionCardsHtml}</div>
        <h2>${isKo ? `중립 공용 카드 전수 목록 (${neutralCards.length}장)` : `All Neutral Collectible Cards (${neutralCards.length} Cards)`}</h2>
        <div class="grid">${neutralGridHtml}</div>`,
      }),
    );
  }

  // 2) 9 Individual Faction Strategy & 25-Card Codex Pages
  for (const faction of FACTIONS) {
    const koPath = `/wiki/${faction.slug}/`;
    const enPath = `/en/wiki/${faction.slug}/`;
    addSitemapPair(koPath, enPath, '0.84', 'weekly');
    const fCards = allCards.filter((c) => c.cardClass === faction.cardClass);

    for (const lang of ['ko', 'en']) {
      const isKo = lang === 'ko';
      const cardsGrid = fCards
        .map((c) => {
          const cName = isKo ? c.name : c.nameEn || c.name;
          const cText = cleanCardText(isKo ? c.text : c.textEn || c.text);
          const stats =
            c.type === 'MINION'
              ? `${c.attack ?? 0}/${c.health ?? 0}`
              : c.type === 'WEAPON'
                ? `${c.attack ?? 0}/${c.durability ?? 0} WPN`
                : 'SPELL';
          return `<div class="card-box">
            <img src="${c.artUrl || faction.portrait}" alt="${escHtml(cName)}" loading="lazy" />
            <div>
              <div><span class="badge">${c.cost}M</span><span class="badge">${escHtml(stats)}</span><span class="badge">${escHtml(c.rarity)}</span></div>
              <div style="margin-top:3px;"><strong>${escHtml(cName)}</strong></div>
              <div style="font-size:12px;color:#cbd5e1;margin-top:3px;">${escHtml(cText)}</div>
            </div>
          </div>`;
        })
        .join('');

      writeHtmlFile(
        distDir,
        isKo ? koPath : enPath,
        renderWikiShell({
          lang,
          title: `${isKo ? faction.titleKo : faction.titleEn} | SNSHero.com`,
          description: isKo
            ? `${faction.nameKo} 수호자 ${faction.heroKo}(${faction.powerKo})의 전용 카드 ${fCards.length}장 전체 목록과 30장 추천 덱 운용법·스토리 3장=3배 각성 공략.`
            : `${faction.nameEn} Guardian ${faction.heroEn} (${faction.powerEn}): full ${fCards.length}-card list, mana curve tips, and 3x Story Awakening deck strategy in SNSHero.`,
          koPath,
          enPath,
          ogImage: faction.portrait,
          jsonLdObj: {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: isKo ? faction.titleKo : faction.titleEn,
            inLanguage: lang,
            image: `${SITE_ORIGIN}${faction.portrait}`,
            url: `${SITE_ORIGIN}${isKo ? koPath : enPath}`,
          },
          bodyHtml: `
          <span class="eyebrow">${escHtml(isKo ? `눈히어로 9대 종족 공략 · ${faction.nameKo}` : `SNSHero Faction Codex · ${faction.nameEn}`)}</span>
          <h1>${escHtml(isKo ? faction.titleKo : faction.titleEn)}</h1>
          <div class="panel hero-banner">
            <img src="${faction.portrait}" alt="${escHtml(isKo ? faction.heroKo : faction.heroEn)}" />
            <div style="flex:1;min-width:220px;">
              <div><strong>${escHtml(isKo ? `수호자 영웅: ${faction.heroKo}` : `Guardian Hero: ${faction.heroEn}`)}</strong> · <span style="color:#fcd34d;">${escHtml(isKo ? faction.powerKo : faction.powerEn)}</span></div>
              <p style="margin:8px 0 12px;color:#e2e8f0;font-size:14px;">${escHtml(isKo ? faction.strategyKo : faction.strategyEn)}</p>
              <a class="btn btn-cta" href="${isKo ? '/game' : '/en/game/'}">${isKo ? `⚔️ ${faction.heroKo} 덱으로 무료 3팩 받고 바로 플레이` : `⚔️ Play ${faction.heroEn} Free Now (+3 Packs)`}</a>
            </div>
          </div>
          <h2>${escHtml(isKo ? `${faction.nameKo} 전용 수집 카드 (${fCards.length}종 전수 목록)` : `${faction.nameEn} Collectible Class Cards (${fCards.length} Cards)`)}</h2>
          <div class="grid">${cardsGrid}</div>
          <h2>${isKo ? '다른 종족 도감 바로가기' : 'Explore Other Factions'}</h2>
          <div class="faction-nav">
            ${FACTIONS.map((f) => `<a class="btn" href="${isKo ? `/wiki/${f.slug}/` : `/en/wiki/${f.slug}/`}">${escHtml(isKo ? f.nameKo : f.nameEn)}</a>`).join('')}
          </div>`,
        }),
      );
    }
  }

  // ── STEP 2D: Generate Complete Bilingual sitemap.xml (192 URLs with xhtml:link hreflang) ──
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries
  .map(
    (u) => `  <url>
    <loc>${SITE_ORIGIN}${u.loc}</loc>
    <xhtml:link rel="alternate" hreflang="ko" href="${SITE_ORIGIN}${u.koPath}" />
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${u.enPath}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${u.koPath}" />
    <lastmod>${TODAY_ISO}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
  }

  console.log(
    `[seo-generator] Generated ${legacyRedirects.length} legacy 200-redirect routes + ${sitemapEntries.length} canonical KO/EN SEO pages in sitemap.xml.`,
  );
}
