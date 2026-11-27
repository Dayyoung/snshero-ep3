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

const FAVICON_VERSION = '20261127';
const FAVICON_HEAD_SNIPPET = `  <link rel="icon" href="/favicon.ico?v=${FAVICON_VERSION}" sizes="48x48" />
  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png?v=${FAVICON_VERSION}" />
  <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png?v=${FAVICON_VERSION}" />
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png?v=${FAVICON_VERSION}" />
  <link rel="apple-touch-icon" sizes="192x192" href="/hs-assets/brand/pwa-icon-192.png?v=${FAVICON_VERSION}" />`;

const GLOBAL_SHOWCASE_LOCALES = [
  {
    langCode: 'ja',
    path: '/ja/',
    hreflang: 'ja',
    htmlLang: 'ja',
    ogLocale: 'ja_JP',
    label: '日本語',
    title: 'SNSHero : カダンの旅 (눈히어로) — インストール不要・382種本格ファンタジー戦略Web TCG | 公式サイト',
    description:
      'ダウンロード・登録不要で今すぐブラウザで遊べる382種カード戦略TCG！初回無料3パック+250G+160ダスト即時支給、最初の10パック以内レジェンド100%確定。9種族ヒーロー・フルボイス40話ストーリー・ランクアリーナ搭載。',
    h1: 'SNSHero : カダンの旅 — インストール不要・382種本格ファンタジー戦略Web TCG',
    lead: 'ダウンロードや会員登録なしで、ブラウザから3秒で遊べる無料戦略カードゲーム。初回訪問で無料カードパック3個 + 250ゴールド + 160ダストを即時支給し、最初の10パック以内にレジェンドカードが100%確定で出現します。',
    playCta: '⚡ 今すぐブラウザで無料プレイ (+3パック & 250G)',
    gameHref: '/game?lang=ja',
    guideHref: '/en/wiki/tip/',
    codexHref: '/en/wiki/cards/',
  },
  {
    langCode: 'zh-CN',
    path: '/zh-cn/',
    hreflang: 'zh-Hans',
    htmlLang: 'zh-CN',
    ogLocale: 'zh_CN',
    label: '简体中文',
    title: 'SNSHero : 卡丹的旅程 — 无需下载382张卡牌奇幻策略网页TCG | 官方网站',
    description:
      '无需安装和注册，浏览器3秒开玩382张卡牌策略TCG！首次进入即送3个免费卡包+250金币+160奥术尘，前10包必出传说卡牌。9大种族英雄、40章全语音剧情模式与实时天梯竞技场。',
    h1: 'SNSHero : 卡丹的旅程 — 无需下载382张卡牌奇幻策略网页TCG',
    lead: '无需下载客户端或注册账号，打开网页3秒即可畅玩382张卡牌策略对战！首次登录立即赠送3个免费卡包 + 250金币 + 160奥术之尘，前10个卡包100%保底获得传说卡牌。',
    playCta: '⚡ 立即免费开玩 (+3免费卡包 & 250金币)',
    gameHref: '/game?lang=zh-CN',
    guideHref: '/en/wiki/tip/',
    codexHref: '/en/wiki/cards/',
  },
  {
    langCode: 'zh-TW',
    path: '/zh-tw/',
    hreflang: 'zh-Hant',
    htmlLang: 'zh-TW',
    ogLocale: 'zh_TW',
    label: '繁體中文',
    title: 'SNSHero : 卡丹的旅程 — 免下載382張卡牌奇幻策略網頁TCG | 官方網站',
    description:
      '免安裝免註冊，瀏覽器3秒即玩382張卡牌策略TCG！首次進入即贈3個免費卡包+250金幣+160塵，前10包必出傳說卡牌。9大種族英雄、40章全語音劇情與即時天梯競技場。',
    h1: 'SNSHero : 卡丹的旅程 — 免下載382張卡牌奇幻策略網頁TCG',
    lead: '免下載用戶端、免註冊帳號，瀏覽器開啟3秒即可體驗382張卡牌策略對戰！首次造訪立即獲贈3個免費卡包 + 250金幣 + 160魔塵，前10包100%必出傳說卡牌。',
    playCta: '⚡ 立即免費暢玩 (+3免費卡包 & 250金幣)',
    gameHref: '/game?lang=zh-TW',
    guideHref: '/en/wiki/tip/',
    codexHref: '/en/wiki/cards/',
  },
  {
    langCode: 'es',
    path: '/es/',
    hreflang: 'es',
    htmlLang: 'es',
    ogLocale: 'es_ES',
    label: 'Español',
    title: 'SNSHero : El Viaje de Kadan — TCG Estratégico Web Gratis de 382 Cartas (Sin Descarga)',
    description:
      '¡Juega gratis en tu navegador sin descargar ni registrarte! Recibe 3 sobres gratis + 250 de Oro + 160 Polvo al instante, Legendaria garantizada en tus primeros 10 sobres, 9 facciones, 40 capítulos con voz y Arena Clasificatoria.',
    h1: 'SNSHero : El Viaje de Kadan — TCG Estratégico Gratis en Navegador (382 Cartas)',
    lead: 'Juega al instante en PC o móvil sin descargas ni registro. Al entrar recibes 3 sobres de cartas gratis + 250 de Oro + 160 Polvo Arcano, con una carta Legendaria 100% garantizada en tus primeros 10 sobres.',
    playCta: '⚡ Jugar Gratis Ahora (+3 Sobres & 250 Oro)',
    gameHref: '/game?lang=es',
    guideHref: '/en/wiki/tip/',
    codexHref: '/en/wiki/cards/',
  },
  {
    langCode: 'fr',
    path: '/fr/',
    hreflang: 'fr',
    htmlLang: 'fr',
    ogLocale: 'fr_FR',
    label: 'Français',
    title: 'SNSHero : Le Voyage de Kadan — TCG Stratégique Gratuit sur Navigateur (382 Cartes)',
    description:
      "Jouez gratuitement dans votre navigateur sans téléchargement ni inscription ! 3 boosters gratuits + 250 Or + 160 Poussière offerts dès l'arrivée, Légendaire garantie dans les 10 premiers boosters, 9 factions et 40 chapitres doublés.",
    h1: 'SNSHero : Le Voyage de Kadan — TCG Stratégique Gratuit sur Navigateur (382 Cartes)',
    lead: "Jouez immédiatement sur navigateur PC ou mobile sans téléchargement ni compte requis. Recevez 3 boosters gratuits + 250 Or + 160 Poussière Arcanique dès l'entrée, avec une Légendaire garantie dans vos 10 premiers boosters.",
    playCta: '⚡ Jouer Gratuitement (+3 Boosters & 250 Or)',
    gameHref: '/game?lang=fr',
    guideHref: '/en/wiki/tip/',
    codexHref: '/en/wiki/cards/',
  },
  {
    langCode: 'de',
    path: '/de/',
    hreflang: 'de',
    htmlLang: 'de',
    ogLocale: 'de_DE',
    label: 'Deutsch',
    title: 'SNSHero : Kadans Reise — Kostenloses 382-Karten Browser-Strategie-TCG (Ohne Download)',
    description:
      'Sofort kostenlos im Browser spielen ohne Download oder Anmeldung! 3 Gratis-Kartenpacks + 250 Gold + 160 Staub zum Start, garantierte Legendäre Karte in den ersten 10 Packs, 9 Fraktionen & 40 vertonte Story-Kapitel.',
    h1: 'SNSHero : Kadans Reise — Kostenloses 382-Karten Browser-Strategie-TCG',
    lead: 'Spiele sofort im Desktop- oder Mobilbrowser ohne Download und ohne Registrierung. Du erhältst direkt 3 Gratis-Kartenpacks + 250 Gold + 160 Arkanstaub sowie eine garantierte Legendäre Karte in deinen ersten 10 Packs.',
    playCta: '⚡ Jetzt Kostenlos Spielen (+3 Packs & 250 Gold)',
    gameHref: '/game?lang=de',
    guideHref: '/en/wiki/tip/',
    codexHref: '/en/wiki/cards/',
  },
  {
    langCode: 'pt',
    path: '/pt/',
    hreflang: 'pt',
    htmlLang: 'pt',
    ogLocale: 'pt_BR',
    label: 'Português',
    title: 'SNSHero : A Jornada de Kadan — TCG Estratégico Grátis no Navegador (382 Cartas)',
    description:
      'Jogue grátis direto no navegador sem download ou cadastro! Ganhe 3 pacotes grátis + 250 Ouro + 160 Pó na hora, Lendária garantida nos primeiros 10 pacotes, 9 facções, 40 episódios dublados e Arena Ranqueada.',
    h1: 'SNSHero : A Jornada de Kadan — TCG Estratégico Grátis no Navegador (382 Cartas)',
    lead: 'Entre e jogue direto no navegador em PC ou celular sem download e sem cadastro. Receba na hora 3 pacotes grátis + 250 de Ouro + 160 de Pó Arcano, com carta Lendária 100% garantida nos primeiros 10 pacotes.',
    playCta: '⚡ Jogar Grátis Agora (+3 Pacotes & 250 Ouro)',
    gameHref: '/game?lang=pt',
    guideHref: '/en/wiki/tip/',
    codexHref: '/en/wiki/cards/',
  },
  {
    langCode: 'ru',
    path: '/ru/',
    hreflang: 'ru',
    htmlLang: 'ru',
    ogLocale: 'ru_RU',
    label: 'Русский',
    title: 'SNSHero : Путь Кадана — Бесплатная браузерная ККИ на 382 карты (Без скачивания)',
    description:
      'Играйте бесплатно прямо в браузере без установки и регистрации! Сразу 3 бесплатных бустера + 250 золота + 160 пыли, гарантированная Легендарная карта в первых 10 бустерах, 9 фракций и 40 озвученных глав.',
    h1: 'SNSHero : Путь Кадана — Бесплатная браузерная ККИ (382 карты, без установки)',
    lead: 'Запускайте игру прямо в браузере на ПК или телефоне без скачивания и регистрации. При входе вы сразу получаете 3 бесплатных бустера + 250 золота + 160 пыли и гарантированную Легендарную карту в первых 10 бустерах.',
    playCta: '⚡ Играть Бесплатно (+3 Бустера и 250 Золота)',
    gameHref: '/game?lang=ru',
    guideHref: '/en/wiki/tip/',
    codexHref: '/en/wiki/cards/',
  },
];

const SHOWCASE_HREFLANGS = [
  { hreflang: 'ko', path: '/' },
  { hreflang: 'en', path: '/en/' },
  ...GLOBAL_SHOWCASE_LOCALES.map((l) => ({ hreflang: l.hreflang, path: l.path })),
  { hreflang: 'x-default', path: '/en/' },
];

function renderHreflangLinks(alternates) {
  return alternates
    .map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${SITE_ORIGIN}${a.path}" />`)
    .join('\n  ');
}

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

function injectHreflangIntoExistingHtml(htmlPath, koUrl, enUrl, customAlternates = null) {
  if (!fs.existsSync(htmlPath)) return;
  let html = fs.readFileSync(htmlPath, 'utf8');
  const normKo = toCanonicalPath(koUrl);
  const normEn = toCanonicalPath(enUrl);
  html = html.replace(/\s*<link rel="alternate" hreflang="[^"]*"[^>]*>\s*/gi, '\n  ');
  const alternates =
    customAlternates || [
      { hreflang: 'ko', path: normKo },
      { hreflang: 'en', path: normEn },
      { hreflang: 'x-default', path: normEn },
    ];
  const tags = renderHreflangLinks(alternates);
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
  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${normEn}" />
${FAVICON_HEAD_SNIPPET}
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
    .table-wrap { width: 100%; overflow-x: auto; margin: 14px 0; border: 1px solid rgba(255,255,255,0.12); background: #0d121d; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th, td { padding: 11px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); vertical-align: top; }
    th { background: #131824; color: #fcd34d; font-weight: 700; white-space: nowrap; }
    .shot-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 16px 0; }
    .shot-box { background: #0d121d; border: 1px solid rgba(255,255,255,0.12); padding: 10px; }
    .shot-box img { width: 100%; height: auto; display: block; border: 1px solid rgba(255,255,255,0.1); }
    .faq-item { background: #131824; border: 1px solid rgba(255,255,255,0.12); padding: 14px 16px; margin: 10px 0; }
    .faq-item h3 { margin: 0 0 6px; font-size: 15px; color: #fde68a; }
    .faq-item p { margin: 0; font-size: 13px; color: #e2e8f0; }
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
      <p>${isKo ? '추천 검색 가이드: ' : 'Popular Non-Install Guides: '}<a href="${isKo ? '/free-browser-card-game/' : '/en/free-browser-card-game/'}" style="color:#fcd34d;">${isKo ? '무설치 웹 카드게임' : 'Free Browser Card Game'}</a> · <a href="${isKo ? '/games-like-hearthstone-browser/' : '/en/games-like-hearthstone-browser/'}" style="color:#fcd34d;">${isKo ? '하스스톤 같은 웹게임' : 'Games Like Hearthstone'}</a> · <a href="${isKo ? '/free-deckbuilder-game/' : '/en/free-deckbuilder-game/'}" style="color:#fcd34d;">${isKo ? '무료 덱빌딩 게임' : 'Free Deckbuilder Game'}</a></p>
      <p>${isKo ? '눈히어로 : 카단의 여정 (SNSHero.com) — 무설치 382종 판타지 전략 웹 TCG 공식 아카이브' : "SNSHero : Kadan's Journey (SNSHero.com) — Free 382-Card Browser Strategy TCG Archive"}</p>
      <p>${isKo ? '본 게임·웹소설·웹툰은 저작권 및 라이선스가 적용된 눈히어로 독자 저작물입니다.' : 'This game, web novel, and webtoon are original works protected by SNSHero copyright & license.'} <a href="${isKo ? '/license' : '/en/license/'}" style="color:#fcd34d;">${isKo ? '자세히 보기' : 'Learn More'}</a></p>
    </footer>
  </div>
</body>
</html>`;
}

export function generateAllSeoPages({ rootDir, distDir, publicDir }) {
  const sitemapEntries = [];
  const addSitemapPair = (koPath, enPath, priority = '0.8', changefreq = 'weekly', customAlternates = null) => {
    const normKo = toCanonicalPath(koPath);
    const normEn = toCanonicalPath(enPath);
    sitemapEntries.push({ loc: normKo, koPath: normKo, enPath: normEn, priority, changefreq, alternates: customAlternates });
    sitemapEntries.push({ loc: normEn, koPath: normKo, enPath: normEn, priority, changefreq, alternates: customAlternates });
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
    const customAlts = p.koPath === '/' ? SHOWCASE_HREFLANGS : null;
    injectHreflangIntoExistingHtml(path.join(distDir, p.file), p.koPath, p.enPath, customAlts);
    if (p.koPath === '/game') injectHreflangIntoExistingHtml(path.join(distDir, 'game.html'), p.koPath, p.enPath);
    if (p.koPath === '/book') injectHreflangIntoExistingHtml(path.join(distDir, 'book.html'), p.koPath, p.enPath);
    if (p.koPath === '/webtoon') injectHreflangIntoExistingHtml(path.join(distDir, 'webtoon.html'), p.koPath, p.enPath);
    if (p.koPath === '/sns') injectHreflangIntoExistingHtml(path.join(distDir, 'sns.html'), p.koPath, p.enPath);
    if (p.koPath === '/license') injectHreflangIntoExistingHtml(path.join(distDir, 'license.html'), p.koPath, p.enPath);
    addSitemapPair(p.koPath, p.enPath, p.priority, p.changefreq, customAlts);
  }

  // Build /en/ (English Official Showcase, x-default) & 8 Country/Language Showcase Hubs
  const indexDistHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const indexAssets = extractAssetTags(indexDistHtml);
  const showcaseLocaleNavLinks = [
    '<a href="/">한국어 (/)</a>',
    '<a href="/en/">English (/en/)</a>',
    ...GLOBAL_SHOWCASE_LOCALES.map((l) => `<a href="${l.path}">${escHtml(l.label)} (${l.path})</a>`),
  ].join(' · ');

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
${FAVICON_HEAD_SNIPPET}
  <title>SNSHero : Kadan's Journey — Free 382-Card Browser Strategy TCG (No Download) | Official Site</title>
  <meta name="description" content="Play SNSHero (Heroes of Elwin Village) instantly in your browser with zero download or sign-up! Claim 3 Free Card Packs + 250 Gold + 160 Dust on arrival, guaranteed Legendary in first 10 packs, 40-episode voiced Story Mode (3 copies = 3x Awakened stats), Ranked Arena, and Bogart's Den." />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${SITE_ORIGIN}/en/" />
  ${renderHreflangLinks(SHOWCASE_HREFLANGS)}
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
      <nav aria-label="Languages" style="margin-top:12px;">
        ${showcaseLocaleNavLinks}
      </nav>
    </main>
  </div>
  ${indexAssets.scripts}
</body>
</html>`,
  );

  for (const loc of GLOBAL_SHOWCASE_LOCALES) {
    sitemapEntries.push({
      loc: loc.path,
      koPath: '/',
      enPath: '/en/',
      priority: '0.95',
      changefreq: 'daily',
      alternates: SHOWCASE_HREFLANGS,
    });
    writeHtmlFile(
      distDir,
      loc.path,
      `<!DOCTYPE html>
<html lang="${loc.htmlLang}">
<head>
  <meta charset="UTF-8" />
${GA_HEAD_SNIPPET}
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#1b120b" />
${FAVICON_HEAD_SNIPPET}
  <title>${escHtml(loc.title)}</title>
  <meta name="description" content="${escHtml(loc.description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${SITE_ORIGIN}${loc.path}" />
  ${renderHreflangLinks(SHOWCASE_HREFLANGS)}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SNSHero.com" />
  <meta property="og:locale" content="${loc.ogLocale}" />
  <meta property="og:url" content="${SITE_ORIGIN}${loc.path}" />
  <meta property="og:title" content="${escHtml(loc.title)}" />
  <meta property="og:description" content="${escHtml(loc.description)}" />
  <meta property="og:image" content="${SITE_ORIGIN}/hs-assets/screenshots/ingame_pack_altar.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escHtml(loc.title)}" />
  <meta name="twitter:description" content="${escHtml(loc.description)}" />
  <meta name="twitter:image" content="${SITE_ORIGIN}/hs-assets/screenshots/ingame_pack_altar.png" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: "SNSHero : Kadan's Journey",
    url: `${SITE_ORIGIN}${loc.path}`,
    genre: ['Collectible Card Game', 'Strategy', 'Browser Game'],
    gamePlatform: ['Web Browser', 'Mobile Web', 'Desktop Web'],
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    inLanguage: loc.htmlLang,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  })}</script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6937094123258335" crossorigin="anonymous"></script>
  ${indexAssets.links}
</head>
<body style="margin:0;background:#090604;color:#f8ebd2;">
  <div id="promo-root">
    <main style="max-width:960px;margin:0 auto;padding:32px 20px;font-family:sans-serif;">
      <h1>${escHtml(loc.h1)}</h1>
      <p>${escHtml(loc.lead)}</p>
      <p><a href="${loc.gameHref}" style="color:#fcd34d;font-weight:bold;">${escHtml(loc.playCta)}</a></p>
      <nav aria-label="Quick Links">
        <a href="${loc.guideHref}">Strategy Guide</a> · <a href="${loc.codexHref}">382-Card Codex</a> · <a href="/en/book/">40-Episode Web Novel</a> · <a href="/en/webtoon/">Full-Color Webtoon</a> · <a href="/en/sns/">AI Benchmark</a>
      </nav>
      <nav aria-label="Languages" style="margin-top:12px;">
        ${showcaseLocaleNavLinks}
      </nav>
    </main>
  </div>
  ${indexAssets.scripts}
</body>
</html>`,
    );
  }

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
      </div>
      <h2>6. Browser TCG &amp; Deckbuilder Comparisons</h2>
      <div class="faction-nav">
        <a class="btn" href="/en/free-browser-card-game/">Free Browser Card Game (No Download)</a>
        <a class="btn" href="/en/games-like-hearthstone-browser/">Free Games Like Hearthstone in Browser</a>
        <a class="btn" href="/en/free-deckbuilder-game/">Free Online Deckbuilder Card Game</a>
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
${FAVICON_HEAD_SNIPPET}
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(desc)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${SITE_ORIGIN}${enPath}" />
  <link rel="alternate" hreflang="ko" href="${SITE_ORIGIN}${koPath}" />
  <link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${enPath}" />
  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${enPath}" />
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
${FAVICON_HEAD_SNIPPET}
  <title>${escHtml(fullTitle)}</title>
  <meta name="description" content="${escHtml(desc)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${SITE_ORIGIN}${selfPath}" />
  <link rel="alternate" hreflang="ko" href="${SITE_ORIGIN}${koBookPath}" />
  <link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${enBookPath}" />
  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${enBookPath}" />
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
${FAVICON_HEAD_SNIPPET}
  <title>${escHtml(fullTitle)}</title>
  <meta name="description" content="${escHtml(desc)}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${SITE_ORIGIN}${selfPath}" />
  <link rel="alternate" hreflang="ko" href="${SITE_ORIGIN}${koToonPath}" />
  <link rel="alternate" hreflang="en" href="${SITE_ORIGIN}${enToonPath}" />
  <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${enToonPath}" />
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

  // ── STEP 2C-2: Non-Brand Search Intent SEO Landing Pages (KO & EN = 6 URLs) ──
  const NON_BRAND_LANDINGS = [
    {
      koPath: '/free-browser-card-game/',
      enPath: '/en/free-browser-card-game/',
      eyebrowKo: '무설치 · 무가입 웹 카드게임 가이드',
      eyebrowEn: 'Zero-Install Browser Card Game Guide',
      titleKo: '무설치 웹 카드게임 무료 추천 — 가입·다운로드 0초 382종 정통 TCG',
      titleEn: 'Free Browser Card Game (No Download, No Signup) — 382-Card Web TCG',
      descKo:
        '다운로드·회원가입 없이 PC와 모바일 브라우저에서 3초 만에 시작하는 무료 웹 카드게임 눈히어로(SNSHero). 382종 카드, 첫 방문 무료 3팩+250G, 10팩 내 전설 확정.',
      descEn:
        'Play a full 382-card tactical trading card game right in your desktop or mobile browser with zero download and zero sign-up. Claim 3 Free Packs + 250 Gold on first visit.',
      leadKo:
        '10GB 클라이언트 설치나 복잡한 이메일 회원가입 없이, 웹 브라우저 탭을 열자마자 3초 만에 무료 카드팩 3개(10팩 내 전설 확정)를 뜯고 30장 전략 덱 대결을 시작할 수 있습니다.',
      leadEn:
        'Skip 10GB installers and forced account registration. Launch SNSHero directly in Chrome, Safari, or mobile browsers to open 3 Free Card Packs immediately (Guaranteed Legendary within 10 packs) and duel with custom 30-card decks.',
      h2CompareKo: '기존 설치형 카드게임 vs SNSHero 무설치 웹 TCG 비교',
      h2CompareEn: 'Traditional Client Card Games vs SNSHero Zero-Install Web TCG',
      rowsKo: [
        ['설치 · 용량', '10GB 이상 클라이언트 설치 필요', '0MB — 클릭 즉시 브라우저 실행 (PWA 지원)'],
        ['회원가입', '계정 생성 · 이메일 · 본인인증 필수', '가입 0초 — LocalStorage 자동 저장 및 백업 코드'],
        ['카드 풀 규모', '초반 스타터 덱 제한', '9대 종족 225장 + 중립 157장 = 총 382종 카드'],
        ['초기 무료 보상', '튜토리얼 완료 후 소량 지급', '첫 방문 무료 3팩 + 250골드 + 160가루 즉시 지급'],
        ['모바일 최적화', '앱 별도 다운로드 필요', 'iOS / Android 모바일 웹 세로·원핸드 터치 최적화'],
      ],
      rowsEn: [
        ['Install & Storage', '10GB+ desktop or mobile client', '0 MB — Instant play in any modern browser'],
        ['Account & Login', 'Mandatory account & email verification', 'Zero signup — Instant local browser save & export code'],
        ['Card Collection', 'Limited starter card pool', '382 Cards (225 across 9 Factions + 157 Neutral)'],
        ['Day-1 Free Rewards', 'Gradual drip unlock', '3 Free Packs + 250 Gold + 160 Dust on entry (Legendary in 10)'],
        ['Mobile Browser', 'Separate app store download', 'Responsive touch controls for mobile & desktop browsers'],
      ],
      faqsKo: [
        [
          '정말 회원가입이나 다운로드 없이 바로 카드게임이 실행되나요?',
          '네. https://snshero.com/game 으로 접속하면 별도 앱 설치나 로그인 없이 바로 튜토리얼·카드팩 개봉·30장 덱 배틀을 플레이할 수 있으며 진행도는 브라우저 LocalStorage에 안전하게 저장됩니다.',
        ],
        [
          '회사·학교 저사양 PC나 아이폰/안드로이드 사파리·크롬에서도 돌아가나요?',
          '네. React + 경량 WebP 에셋 기반으로 제작되어 일반 노트북·태블릿·스마트폰 웹 브라우저에서 설치 없이 쾌적하게 실행됩니다.',
        ],
        [
          '무과금으로도 전설 카드와 30장 덱을 맞출 수 있나요?',
          '첫 방문 시 무료 3팩과 250골드(추가 2팩 상당)가 지급되며, 첫 10팩 이내 전설 카드가 100% 확정 등장합니다. 또한 9대 종족 숙련 AI 격파 및 스토리 보스 클리어로 추가 팩과 골드를 계속 얻을 수 있습니다.',
        ],
      ],
      faqsEn: [
        [
          'Can I really play without downloading a launcher or creating an account?',
          'Yes. Visiting /en/game/ drops you straight into the browser game with zero download and zero sign-up. Your cards, decks, and gold are saved locally in your browser with optional one-click backup codes.',
        ],
        [
          'Does this browser card game work on mobile phones and Chromebooks?',
          'Yes. SNSHero runs natively in desktop and mobile browsers (Chrome, Safari, Firefox, Edge) with 44px+ touch-friendly controls and lightweight WebP assets.',
        ],
        [
          'How generous is the free-to-play progression?',
          'New players receive 3 Free Packs + 250 Gold + 160 Arcane Dust immediately, a 100% guaranteed Legendary card within the first 10 packs, and bonus packs for defeating Expert AI across all 9 factions.',
        ],
      ],
    },
    {
      koPath: '/games-like-hearthstone-browser/',
      enPath: '/en/games-like-hearthstone-browser/',
      eyebrowKo: '하스스톤 스타일 무설치 웹 TCG 비교 가이드',
      eyebrowEn: 'Hearthstone-Like Browser TCG Guide',
      titleKo: '하스스톤 같은 무설치 웹게임 — 10마나·30장 덱빌딩 무료 브라우저 TCG',
      titleEn: 'Free Games Like Hearthstone in Browser (Zero Install, 382 Cards)',
      descKo:
        '하스스톤 같은 10마나 커브와 30장 덱빌딩, 영웅 능력의 전략성을 설치 없이 브라우저에서 무료로 즐기세요. 9대 종족 382장 카드와 스토리 3장=3배 각성 규칙 지원.',
      descEn:
        'Love the 10-Mana curve, 30-card decks, and Hero Powers of Hearthstone, but want a zero-install browser alternative? Discover SNSHero with 382 cards, 9 factions, and 3x Story Awakening.',
      leadKo:
        '익숙한 1~10마나 크리스탈 성장, 30장 덱 구축, 도발·속공·전투의 함성·비밀 메커니즘을 웹 브라우저에 그대로 구현하고, 여기에 스토리 전용 [3장=3배 각성]과 100% 랜덤 미러덱을 더했습니다.',
      leadEn:
        'Experience classic 1-to-10 Mana crystal progression, Hero Powers, Taunt, Charge, Secrets, and 30-card deckbuilding directly in your browser—enhanced by Story Mode 3x Awakening and 100% Fair Random-Deck duels.',
      h2CompareKo: '하스스톤형 핵심 규칙 + SNSHero만의 독창적 차별점',
      h2CompareEn: 'Familiar Tactical Rules + Unique SNSHero Innovations',
      rowsKo: [
        ['기본 마나 · 덱 규칙', '매 턴 +1 최대 마나(최대 10), 30장 덱', '동일한 1~10마나 곡선 & 영웅 30체력 정통 규칙'],
        ['종족 · 영웅 능력', '9대 진영 수호자(2마나 고유 영웅 능력)', '인간(치유)·물(수압탄)·불(방어도)·바람(직격 2) 등 9대 종족'],
        ['스토리 3장=3배 각성', '일반 카드 2장 제한', '스토리모드에서 3장 보유 시 공/체 3배~N배 폭발 각성'],
        ['공정 랜덤 대결', '사전 제작 덱 위주', '보가트의 도박장: 양측 100% 랜덤 30장 미러/드래프트 대전'],
        ['접근성 · 용량', '배틀넷 + 대용량 패치 필요', 'URL 클릭 즉시 실행(0MB), 40부작 성우 풀보이스 캠페인'],
      ],
      rowsEn: [
        ['Core Mana & Deck', '+1 Max Mana per turn (up to 10), 30-card deck', 'Classic 1–10 Mana tempo curve & 30 Hero HP'],
        ['Factions & Hero Powers', '9 distinct Guardians with 2-Mana Hero Powers', 'Human, Water, Fire, Wind, Earth, Undead, Elf, Dwarf, Beast'],
        ['3x Awakening Twist', 'Standard 1x card stats', 'Collecting 3+ copies in Story Mode triples card stats (3x, 4x...)'],
        ['Fair Random Arena', 'Constructed collection advantage', "Bogart's Den: wager 1–1,000 Gold with 100% random 30-card decks"],
        ['Client Size', 'Heavy desktop/mobile launcher', '0 MB Instant Web Play + 40-Episode Voiced Campaign'],
      ],
      faqsKo: [
        [
          '하스스톤을 해봤다면 바로 적응할 수 있나요?',
          '네. 1마나부터 시작해 매 턴 1씩 증가하는 마나, 도발·천상의 보호막·돌진·전투의 함성·죽음의 메아리 키워드 등 정통 규칙을 따르므로 첫 판부터 바로 전략을 펼칠 수 있습니다.',
        ],
        [
          '무과금 유저가 과금 유저에게 무조건 밀리지 않나요?',
          '보가트의 도박장 모드에서는 보유 카드와 무관하게 양측이 무작위 30장 덱으로 공정하게 승부하며, 랭킹전은 1배수 밸런스 기반으로 실력 중심 대결이 진행됩니다.',
        ],
        [
          'AI 대전 연습 모드도 있나요?',
          '네. 9대 종족 숙련 AI 대전과 카단 AI 자동전투·코치 모드를 통해 언제든 덱을 테스트하고 9종족 올클리어(+2팩) 보상을 획득할 수 있습니다.',
        ],
      ],
      faqsEn: [
        [
          'If I already know Hearthstone, how fast can I learn SNSHero?',
          'Immediately. Mana crystals, Hero Powers, 7-slot boards, Taunt, Divine Shield, Charge, Battlecry, and Deathrattle follow intuitive tactical TCG conventions—you can win your first match within 3 minutes.',
        ],
        [
          'Is there a fair mode where new players are not out-geared by big collections?',
          "Yes. Bogart's Den generates fresh, 100% randomized 30-card decks for both players on every match, testing pure drafting adaptation and tactical play.",
        ],
        [
          'Can I test decks solo against AI before entering Ranked Arena?',
          'Yes! Challenge Expert AI across all 9 factions (clearing all 9 grants +2 bonus packs) or battle through the 40-chapter voiced Story Boss Campaign.',
        ],
      ],
    },
    {
      koPath: '/free-deckbuilder-game/',
      enPath: '/en/free-deckbuilder-game/',
      eyebrowKo: '무료 온라인 덱빌딩 · 스토리 보스 RPG 가이드',
      eyebrowEn: 'Free Online Deckbuilder & Story Campaign Guide',
      titleKo: '무료 덱빌딩 전략 카드게임 — 40화 풀보이스 스토리 & AI 대전 웹 TCG',
      titleEn: 'Free Online Deckbuilder Card Game — 40-EP Voiced Story & AI Arena',
      descKo:
        '382종 카드로 나만의 30장 덱을 짜고 40화 성우 풀보이스 판타지 스토리 보스를 공략하세요. 같은 카드 3장 수집 시 3배 각성, 9대 종족 시너지 지원.',
      descEn:
        'Craft 30-card strategies from 382 collectible cards, trigger 3x Awakening synergies, and conquer a 40-episode fully voiced dark-fantasy boss campaign free in your browser.',
      leadKo:
        '단순한 1회성 카드 배틀을 넘어, 40부작 판타지 웹소설·840컷 보이스 웹툰과 직접 연결되는 덱빌딩 캠페인! 카드팩에서 같은 카드를 3장 모을수록 스토리 보스전에서 능력이 3배·4배로 각성합니다.',
      leadEn:
        'More than quick skirmishes: build 30-card synergy decks connected directly to a 40-chapter voiced web novel and 840+ panel webtoon. Duplicate pulls power up your Story Mode cards into 3x Awakened bosses-slayers.',
      h2CompareKo: '덱빌더 핵심 재미 요소 & 모드별 공략 포인트',
      h2CompareEn: 'Core Deckbuilding Depth & Game Modes',
      rowsKo: [
        ['카드 컬렉션 & 제작', '중복 카드 자동 각성 + 신비한 가루 제작', '382종 카드 중 원하는 전설/영웅 카드를 가루로 직접 제작 가능'],
        ['40화 스토리 보스전', '카단의 여정 40개 에피소드 보스 기믹', '5화 단위 보스 격파 시 대량 골드 + 무료 카드팩 연속 보상'],
        ['카단 스피릿 X10 필살기', '리듬 탭 연계 카단·실리아 합동 오의', '전투 중 타이밍 탭으로 10스택 도달 시 광역 폭풍 합동기 발동'],
        ['다채로운 9대 종족 아키타입', '어그로 · 컨트롤 · 무기격노 · 비밀함정', '바람(토람) 어그로, 물(포세이돈) 빙결, 언데드(아르투스) 흑마법 등'],
        ['유튜브·구글 AI 벤치마크 연동', '동일 엔진 기반 /sns 1,000판 AI 아레나', '종족별 승률 데이터를 참고해 최적 30장 마나 커브 설계'],
      ],
      rowsEn: [
        ['Crafting & Upgrades', 'Arcane Dust crafting + duplicate power', 'Craft any missing Epic or Legendary card with Arcane Dust'],
        ['40-EP Story Campaign', "40 voiced chapters of Kadan's Journey", 'Boss mechanics every chapter + bonus packs every 5th clear'],
        ['Kadan Spirit X10 Combo', 'Interactive rhythm-ring ultimate chain', 'Tap on Green beats to stack X10 and unleash dual Ultimates'],
        ['9 Distinct Archetypes', 'Aggro, Freeze Control, Weapon Enrage, Tokens', 'Swap freely between 9 Faction Guardians and 157 Neutral cards'],
        ['Live Meta Telemetry', 'Backed by /en/sns/ 1,000-match AI data', 'Inspect live faction win rates to optimize your 30-card curve'],
      ],
      faqsKo: [
        [
          '덱빌딩 초보자도 쉽게 30장 덱을 짤 수 있나요?',
          '네. 내 카드첩의 1클릭 추천 덱 자동 완성 기능과 카단 AI 코치 힌트 기능을 켜면 마나 커브에 맞춘 30장 덱을 즉시 완성할 수 있습니다.',
        ],
        [
          '스토리 모드 [3장=3배 각성]은 정확히 어떻게 동작하나요?',
          '인벤토리에 같은 카드를 3장 보유하면 스토리 보스전에서 해당 카드의 공격력과 체력이 3배로 강화됩니다(4장·5장은 N배 확장, 전설은 2장부터 2배 각성).',
        ],
        [
          '40화 스토리 보스를 모두 깨면 그 다음엔 무엇을 할 수 있나요?',
          '40화 클리어 후 무한 환생 모드(+300G & 3팩 보상), 보가트의 도박장, 랭킹 아레나, 24K 황금 호일 컬렉션 완성을 계속 즐길 수 있습니다.',
        ],
      ],
      faqsEn: [
        [
          'I am new to deckbuilders—does the game help me build a 30-card deck?',
          'Yes! Use the 1-click Auto-Fill Deck Builder inside your Collection or enable Kadan AI Coach during matches for mana-curve and trade recommendations.',
        ],
        [
          'How does the 3-Card = 3x Awakening rule work in Story Mode?',
          'Owning 3 copies of a regular minion or weapon triples its Attack and Health inside Story Mode boss encounters (scaling up with extra copies, and Legendaries awaken starting at 2 copies).',
        ],
        [
          'What happens after clearing Episode 40?',
          'Unlock Infinite Rebirth bonuses (+300 Gold & 3 Packs), climb the Ranked Arena ladder, chase 24K Golden Foils, or test your drafting in Bogart’s Den.',
        ],
      ],
    },
  ];

  for (const item of NON_BRAND_LANDINGS) {
    addSitemapPair(item.koPath, item.enPath, '0.92', 'weekly');
    for (const lang of ['ko', 'en']) {
      const isKo = lang === 'ko';
      const pageTitle = `${isKo ? item.titleKo : item.titleEn} | SNSHero.com`;
      const pageDesc = isKo ? item.descKo : item.descEn;
      const selfPath = isKo ? item.koPath : item.enPath;
      const gameCtaHref = isKo ? '/game?open=pack3&lang=ko' : '/en/game/?open=pack3&lang=en';
      const shots = isKo
        ? [
            { src: '/hs-assets/guide/guide_01_hub.webp', alt: '눈히어로 무설치 웹 카드게임 메인 로비 화면' },
            { src: '/hs-assets/guide/guide_03_battle_mana.webp', alt: '눈히어로 10마나 전술 카드 배틀 화면' },
            { src: '/hs-assets/guide/guide_05_packs.webp', alt: '눈히어로 무료 3팩 카드 개봉 제단 화면' },
          ]
        : [
            { src: '/hs-assets/guide/guide_en_01_hub.webp', alt: 'SNSHero free browser card game main sanctuary hub' },
            { src: '/hs-assets/guide/guide_en_03_battle_mana.webp', alt: 'SNSHero 10-mana tactical card battle screen' },
            { src: '/hs-assets/guide/guide_en_05_packs.webp', alt: 'SNSHero 3 free starter card packs opening altar' },
          ];
      const rows = isKo ? item.rowsKo : item.rowsEn;
      const faqs = isKo ? item.faqsKo : item.faqsEn;

      writeHtmlFile(
        distDir,
        selfPath,
        renderWikiShell({
          lang,
          title: pageTitle,
          description: pageDesc,
          koPath: item.koPath,
          enPath: item.enPath,
          ogImage: shots[0].src,
          jsonLdObj: {
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'VideoGame',
                name: isKo ? '눈히어로 : 카단의 여정 (SNSHero)' : "SNSHero: Heroes of Elwin Village",
                url: `${SITE_ORIGIN}${selfPath}`,
                applicationCategory: 'Game',
                operatingSystem: 'Web Browser (Desktop, iOS, Android)',
                genre: ['Trading Card Game', 'Strategy', 'Deckbuilder'],
                inLanguage: isKo ? 'ko' : 'en',
                offers: {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'USD',
                  availability: 'https://schema.org/InStock',
                },
              },
              {
                '@type': 'FAQPage',
                mainEntity: faqs.map(([q, a]) => ({
                  '@type': 'Question',
                  name: q,
                  acceptedAnswer: { '@type': 'Answer', text: a },
                })),
              },
            ],
          },
          bodyHtml: `
          <span class="eyebrow">${escHtml(isKo ? item.eyebrowKo : item.eyebrowEn)}</span>
          <h1>${escHtml(isKo ? item.titleKo : item.titleEn)}</h1>
          <div class="panel">
            <p style="margin-top:0;font-size:15px;color:#f1f5f9;">${escHtml(isKo ? item.leadKo : item.leadEn)}</p>
            <div class="nav-links" style="margin-top:14px;">
              <a class="btn btn-cta" href="${gameCtaHref}">${isKo ? '⚡ 설치 없이 바로 플레이 (무료 3팩 + 250G)' : '⚡ Play Free in Browser Now (+3 Packs & 250G)'}</a>
              <a class="btn" href="${isKo ? '/wiki/cards/' : '/en/wiki/cards/'}">${isKo ? '🃏 382종 카드 도감 보기' : '🃏 Browse All 382 Cards'}</a>
            </div>
          </div>

          <h2>${escHtml(isKo ? item.h2CompareKo : item.h2CompareEn)}</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>${isKo ? '항목' : 'Feature'}</th>
                  <th>${isKo ? '일반 클라이언트 게임' : 'Typical Client TCG'}</th>
                  <th>SNSHero.com</th>
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    ([k, col1, col2]) => `<tr>
                  <td><strong>${escHtml(k)}</strong></td>
                  <td style="color:#cbd5e1;">${escHtml(col1)}</td>
                  <td style="color:#fde68a;">${escHtml(col2)}</td>
                </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>

          <h2>${isKo ? '실제 인게임 플레이 화면 (무설치 웹 실행)' : 'Real In-Game Browser Screenshots (Zero Install)'}</h2>
          <div class="shot-grid">
            ${shots
              .map(
                (s) => `<div class="shot-box">
              <img src="${s.src}" alt="${escHtml(s.alt)}" loading="lazy" />
              <div style="font-size:12px;color:#cbd5e1;margin-top:6px;">${escHtml(s.alt)}</div>
            </div>`,
              )
              .join('')}
          </div>

          <h2>${isKo ? '9대 종족 공략 및 관련 아카이브' : '9 Faction Guides & Official Portals'}</h2>
          <div class="faction-nav">
            ${FACTIONS.map((f) => `<a class="btn" href="${isKo ? `/wiki/${f.slug}/` : `/en/wiki/${f.slug}/`}">${escHtml(isKo ? f.nameKo : f.nameEn)}</a>`).join('')}
          </div>
          <div class="panel" style="font-size:13px;color:#cbd5e1;">
            <strong>${isKo ? '공식 배포 포털 & 백링크:' : 'Official Web Portals & Community Pages:'}</strong>
            <div class="nav-links" style="margin-top:10px;">
              <a class="btn" href="https://snshero.itch.io/heroes-of-elwin" target="_blank" rel="noopener noreferrer">itch.io (Web Build)</a>
              <a class="btn" href="https://www.indiedb.com/games/snshero-heroes-of-elwin-village/" target="_blank" rel="noopener noreferrer">IndieDB Official Page</a>
              <a class="btn" href="https://github.com/Dayyoung/snshero" target="_blank" rel="noopener noreferrer">GitHub Showcase</a>
            </div>
          </div>

          <h2>${isKo ? '자주 묻는 질문 (FAQ)' : 'Frequently Asked Questions (FAQ)'}</h2>
          ${faqs
            .map(
              ([q, a]) => `<div class="faq-item">
            <h3>${escHtml(q)}</h3>
            <p>${escHtml(a)}</p>
          </div>`,
            )
            .join('')}
          <div class="panel" style="text-align:center;">
            <p style="margin-top:0;">${isKo ? '지금 브라우저에서 바로 무료 3팩 + 250골드를 받고 첫 대전을 시작하세요.' : 'Ready to build your first 30-card deck? Jump straight in with 3 Free Packs & 250 Gold.'}</p>
            <a class="btn btn-cta" href="${gameCtaHref}">${isKo ? '🎮 지금 바로 SNSHero 무료 시작하기' : '🎮 Launch SNSHero Free in Browser'}</a>
          </div>`,
        }),
      );
    }
  }

  // ── STEP 2D: Generate Complete Multilingual sitemap.xml (10-Locale & Bilingual xhtml:link hreflang, English x-default) ──
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries
  .map((u) => {
    const alts =
      u.alternates || [
        { hreflang: 'ko', path: u.koPath },
        { hreflang: 'en', path: u.enPath },
        { hreflang: 'x-default', path: u.enPath },
      ];
    const xhtmlLinks = alts
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${SITE_ORIGIN}${a.path}" />`)
      .join('\n');
    return `  <url>
    <loc>${SITE_ORIGIN}${u.loc}</loc>
${xhtmlLinks}
    <lastmod>${TODAY_ISO}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
  if (fs.existsSync(publicDir)) {
    fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
  }

  console.log(
    `[seo-generator] Generated ${legacyRedirects.length} legacy 200-redirect routes + ${sitemapEntries.length} canonical multilingual SEO pages in sitemap.xml.`,
  );
}
