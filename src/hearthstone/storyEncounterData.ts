import { getJourneyEpisodeDef } from './kadanJourneyData';

export interface StoryDialogueTurn {
  side: 'LEFT' | 'RIGHT';
  speakerKo: string;
  speakerEn: string;
  textKo: string;
  textEn: string;
}

export interface StoryRelicItem {
  code: string; // e.g. 'PROP-001'
  nameKo: string;
  nameEn: string;
  imageUrl: string;
  descKo: string;
  descEn: string;
  leadInKo: string;
  leadInEn: string;
}

export interface StoryEpisodeEncounterSpec {
  episode: number;
  leftNameKo: string;
  leftNameEn: string;
  leftSpriteUrl: string;
  rightNameKo: string;
  rightNameEn: string;
  rightSpriteUrl: string;
  /** Strictly <= 6 alternating lines summarizing the episode confrontation */
  lines: StoryDialogueTurn[];
  /** Obtainable relic on victory (null if this episode has no item) */
  rewardItem: StoryRelicItem | null;
  /** Spoken when rewardItem is null (character victory ment before ending episode) */
  victoryMentKo: string;
  victoryMentEn: string;
}

const STORY_ITEMS_STORAGE_KEY = 'hero_hs_story_items';

export function getObtainedStoryItems(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORY_ITEMS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function recordStoryItemObtained(code: string, episode: number): void {
  try {
    const cur = getObtainedStoryItems();
    if (!cur[code]) {
      cur[code] = episode;
      localStorage.setItem(STORY_ITEMS_STORAGE_KEY, JSON.stringify(cur));
      window.dispatchEvent(new Event('snshero:state-changed'));
    }
  } catch {
    // ignore storage quota errors
  }
}

const HD_UPPER_PORTRAIT_FILES = new Set<string>([
  '005_Aqualord.webp',
  '006_Leviathan.webp',
  '010_Poseidon.webp',
  '011_Ignis.webp',
  '013_Belphegor.webp',
  '025_Aeolus.webp',
  '030_Wind_God_Toram.webp',
  '040_Colossus.webp',
  '041_Kadan.webp',
  '045_Gawain.webp',
  '049_Hercul.webp',
  '050_Aleksandar.webp',
  '054_Arachne.webp',
  '060_Death_Knight_Artus.webp',
  '061_Lucian.webp',
  '062_Celia.webp',
  '066_Malfuon.webp',
  '069_Gandar.webp',
  '070_Aila.webp',
  '074_Grimli.webp',
  '080_Ironforge.webp',
  '081_Fenrir.webp',
  '086_Leonar.webp',
  '089_Medusa_Gorgo.webp',
]);

/**
 * Resolves any hero/boss portrait URL to its dedicated 1024px HD transparent RGBA waist-up (`상반신`)
 * cutout so characters render razor-sharp on Retina/desktop screens without leg-crop upscaling.
 */
export function resolveDialogueSpriteUrl(rawUrl: string): string {
  if (!rawUrl) return '/hs-assets/upper-hd/041_Kadan.webp?v=hd20';
  const cleanPath = rawUrl.split('?')[0];
  const fn = cleanPath.split('/').pop() || '';
  if (cleanPath.includes('/hs-assets/characters/cutouts/') && HD_UPPER_PORTRAIT_FILES.has(fn)) {
    return `/hs-assets/upper-hd/${fn}?v=hd20`;
  }
  if (cleanPath.includes('/hs-assets/bosses/')) {
    if (fn === 'kadan_upper.webp') {
      return '/hs-assets/bosses/kadan_upper.webp?v=hd20';
    }
    if (fn) {
      return `/hs-assets/bosses/cutouts/${fn}?v=hd20`;
    }
  }
  return rawUrl;
}

/**
 * 20 Canonical Story Relics (`PROP-001` ~ `PROP-020`) mapped to their exact story episodes.
 * Episodes not in this map have `rewardItem = null` and play the character's Victory Ment instead.
 */
export const STORY_RELICS_BY_EPISODE: Record<number, StoryRelicItem> = {
  1: {
    code: 'PROP-001',
    nameKo: '은빛 단검',
    nameEn: 'Silver Dagger',
    imageUrl: '/hs-assets/items/prop_001.webp',
    descKo:
      '서리 룬이 음각된 순은 검신과 푸른 사파이어가 박힌 맹세의 단검. 달빛과 마나에 반응해 봉인된 기억과 혈통의 진실을 일깨운다.',
    descEn:
      'An heirloom silver blade etched with frost runes and a sapphire crossguard. Its azure glow awakens sealed memories and true lineage.',
    leadInKo: '루시안의 선봉을 막아냈군… 엘윈, 그리고 우리 아이에게 이 맹세의 단검을 남긴다.',
    leadInEn: 'Lucian’s vanguard is held back… Elwin, I leave this oath-bound dagger for our child.',
  },
  2: {
    code: 'PROP-019',
    nameKo: '취선루의 청동 종표',
    nameEn: 'Bronze Bell Medallion',
    imageUrl: '/hs-assets/items/prop_019.webp',
    descKo:
      '일곱 추적자와 순례 성기사 헤르쿨이 오해를 풀고 18년 뒤 별취한 종탑에서의 재회를 맹세하며 나눈 청동 대종의 증표.',
    descEn:
      'A weathered green-patina bronze bell token shared between Hercul and the Seven Pursuers as a vow to reunite eighteen years hence.',
    leadInKo: '불꽃 같은 망치질이었소, 그림리 공! 그리고… 우리 맹세의 증표를 받아 주시오.',
    leadInEn: 'A fiery hammer blow, Master Grimli! Take this bronze token of our solemn oath.',
  },
  3: {
    code: 'PROP-004',
    nameKo: '나인섀도우 코덱스',
    nameEn: 'Nine Shadows Codex',
    imageUrl: '/hs-assets/items/prop_004.webp',
    descKo:
      '안개 절벽의 혈투 끝에 벨페고르의 손아귀에서 지켜낸 고대 비전 고서. 아홉 그림자 술법의 약점과 파훼법이 기록되어 있다.',
    descEn:
      'An iron-clasped arcane grimoire wrested from Belphegor on Mist Cliff, revealing the secret weaknesses of the Nine Shadows.',
    leadInKo: '로비냐드의 희생은 결코 헛되지 않았다… 벨페고르가 남긴 이 비전서를 회수한다!',
    leadInEn: 'Robinyard’s sacrifice was not in vain… We claim the grimoire Belphegor dropped!',
  },
  6: {
    code: 'PROP-016',
    nameKo: '별빛 호흡의 두루마리',
    nameEn: 'Star-Breathing Scroll',
    imageUrl: '/hs-assets/items/prop_016.webp',
    descKo:
      '대현자 말퓨온이 전수한 천문 비전 두루마리. 여섯 스승의 흩어진 무예를 하나의 성진호흡법으로 연결해 마력을 증폭시킨다.',
    descEn:
      'An astral scroll bestowed by Archsage Malfuon, harmonizing six martial disciplines into a single Star-Breathing flow.',
    leadInKo: '여섯 갈래의 기운이 가슴속에서 하나로 이어졌어… 스승님, 이 비전서 감사히 받겠습니다!',
    leadInEn: 'All six techniques now flow as one breath… Thank you for this astral scroll, Master!',
  },
  7: {
    code: 'PROP-003',
    nameKo: '북방 전사의 무쇠 방패',
    nameEn: 'Northern Iron Shield',
    imageUrl: '/hs-assets/items/prop_003.webp',
    descKo:
      '수많은 설원 전장을 견뎌낸 강철 리벳 원형 방패. 묵직한 참나무 결 위에 북방 전사들의 불굴의 신의가 새겨져 있다.',
    descEn:
      'A battle-scarred iron-and-oak round shield forged in the northern tundra, symbolizing unyielding loyalty under siege.',
    leadInKo: '막사를 덮친 배신자들을 모두 제압했어! 전사들이 건네준 이 무쇠 방패, 든든하군.',
    leadInEn: 'The traitors are routed! This iron shield from the northern warriors feels rock-solid.',
  },
  8: {
    code: 'PROP-018',
    nameKo: '적갈기 명마의 은장식 안장',
    nameEn: 'Crimson Mane Saddle',
    imageUrl: '/hs-assets/items/prop_018.webp',
    descKo:
      '폭풍처럼 달리는 적갈기 명마를 위해 은세공과 붉은 가죽으로 제작된 명품 안장과 고삐. 기수와 명마의 호흡을 하나로 묶어준다.',
    descEn:
      'A silver-trimmed crimson leather saddle and braided reins crafted for the legendary storm-swift Crimson Mane steed.',
    leadInKo: '볼튼 일당을 쫓아냈다! 자, 내 친구 적갈기야—이 은장식 안장을 얹고 함께 달리자!',
    leadInEn: 'Bolton’s raiders are gone! Come, Crimson Mane—let’s ride together with this silver saddle!',
  },
  9: {
    code: 'PROP-008',
    nameKo: '달빛 약초 (월광초)',
    nameEn: 'Moonlit Herb',
    imageUrl: '/hs-assets/items/prop_008.webp',
    descKo:
      '한밤의 달빛 이슬을 머금고 자라나는 은청색 영초. 깊은 내상과 마독을 정화하는 신비한 치유력을 품고 있다.',
    descEn:
      'A luminous silver-blue medicinal herb bathed in midnight dew, prized for purging dark toxins and mending deep wounds.',
    leadInKo: '오만한 귀공자의 검을 꺾었군… 다행히 품속의 달빛 약초도 무사히 지켜냈어!',
    leadInEn: 'That arrogant noble’s blade is bested… and the Moonlit Herb is still safe in my hands!',
  },
  10: {
    code: 'PROP-020',
    nameKo: '소금 결정 창과 봉인 사슬',
    nameEn: 'Salt-Crystal Spear',
    imageUrl: '/hs-assets/items/prop_020.webp',
    descKo:
      '푸른 마력 스파크가 감도는 소금 결정 창날과 아다만티움 사슬. 불꽃 궁정의 결계를 꿰뚫는 옛 아케 창술사의 유산이다.',
    descEn:
      'A cyan salt-crystal spearhead wrapped in adamantium chains—an ancient Arcane Lancer relic capable of shattering royal wards.',
    leadInKo: '친위 기사단의 포위를 뚫었다! 지하 감옥 입구에 봉인되어 있던 이 푸른 창은…!',
    leadInEn: 'We broke through the Royal Guard! Wait—this glowing cyan spear sealed by the dungeon gate…!',
  },
  12: {
    code: 'PROP-007',
    nameKo: '설강화',
    nameEn: 'Snowdrop Flower',
    imageUrl: '/hs-assets/items/prop_007.webp',
    descKo:
      '혹독한 눈보라와 얼어붙은 대지 위에서도 가장 먼저 봄을 알리며 피어나는 순백의 영초. 스러진 영웅들의 넋을 위로한다.',
    descEn:
      'A pure white blossom that pierces frozen snowfields with gentle ice-blue sparkles, heralding spring between two graves.',
    leadInKo: '거신 아이언포지가 멈췄어… 보아라, 두 무덤 사이 눈밭에 하얀 꽃이 피어났어.',
    leadInEn: 'The siege colossus has fallen… Look, a white snowdrop has bloomed between the two graves.',
  },
  13: {
    code: 'PROP-005',
    nameKo: '녹옥 지팡이',
    nameEn: 'Jade Staff',
    imageUrl: '/hs-assets/items/prop_005.webp',
    descKo:
      '푸른 연꽃 모양의 비취 보석이 빛나는 유랑민 연맹 수장의 성물 지팡이. 흩어진 민초들의 신뢰와 대지의 수호를 상징한다.',
    descEn:
      'The sacred emerald-lotus staff of the Nomad Coalition’s leader, channeling protective earth mana and the people’s trust.',
    leadInKo: '노장 레오나르 님의 대련 시험을 통과했어! 이제 이 녹옥 지팡이의 무게를 이어받겠습니다.',
    leadInEn: 'I passed Master Leonar’s trial! I will carry the weight of this Jade Staff with honor.',
  },
  15: {
    code: 'PROP-015',
    nameKo: '네 수문의 자수정 독병',
    nameEn: 'Amethyst Venom Vial',
    imageUrl: '/hs-assets/items/prop_015.webp',
    descKo:
      '암살단장 아라크네가 지니고 있던 고농축 보랏빛 사독 병. 역으로 정제하면 치명적인 맹독을 중화하는 만병 해독제의 재료가 된다.',
    descEn:
      'A faceted amethyst vial of concentrated serpent venom dropped by Arachne—essential for distilling the ultimate antidote.',
    leadInKo: '독거미 아라크네를 물리쳤다! 장원의 아이들을 해독할 자수정 약병도 확보했어!',
    leadInEn: 'Spider-assassin Arachne is defeated—and I’ve secured her amethyst vial to cure the children!',
  },
  17: {
    code: 'PROP-017',
    nameKo: '바람섬 초대장과 비취 옥피리',
    nameEn: 'Wind Isle Invitation & Flute',
    imageUrl: '/hs-assets/items/prop_017.webp',
    descKo:
      '복사꽃 인장이 찍힌 서신과 맑은 음색의 비취 옥피리. 안개 해협의 미로를 가르고 바람 속삭임 섬의 결계를 여는 열쇠다.',
    descEn:
      'A peach-blossom sealed letter paired with a clear-toned jade flute that parts the sea fog around Whispering Wind Isle.',
    leadInKo: '매복 함대를 돌파했군! 갑판 위에 남은 이 복사꽃 서신과 옥피리로 바람섬에 들어간다!',
    leadInEn: 'We broke the ambush fleet! With this blossom letter and jade flute, Wind Isle awaits!',
  },
  23: {
    code: 'PROP-013',
    nameKo: '삼중 봉인패와 비취 열쇠',
    nameEn: 'Tripartite Seal & Jade Key',
    imageUrl: '/hs-assets/items/prop_013.webp',
    descKo:
      '세 조각의 고대 문양이 맞물린 비취 부적과 열쇠. 용의 석굴 깊은 곳, 잠든 성물의 석실 문을 여는 유일한 성물이다.',
    descEn:
      'An interlocking three-part jade talisman and ancient key that unlocks the deepest sealed chamber of Dragon Grotto.',
    leadInKo: '사령술사 간다르의 어둠이 걷혔어… 석굴 제단에서 비취 열쇠가 빛나고 있다!',
    leadInEn: 'Gandar’s necromancy has faded… Look, the jade key is glowing upon the grotto altar!',
  },
  24: {
    code: 'PROP-002',
    nameKo: '드래곤 브레이커 방패',
    nameEn: 'Dragon Breaker Shield',
    imageUrl: '/hs-assets/items/prop_002.webp',
    descKo:
      '눈꽃 성기사단의 전설이 깃든 백은 카이트 실드. 어떠한 용의 브레스와 심연의 마법도 튕겨내는 불멸의 수호 결계를 펼친다.',
    descEn:
      'A legendary silver-and-azure paladin shield bearing the Snowflake Crest, capable of deflecting dragonfire and abyssal curses.',
    leadInKo: '수호거신이 무릎을 꿇었다! 드디어 전설의 성물, 드래곤 브레이커 방패가 내 손에 응답했어!',
    leadInEn: 'The guardian colossus kneels! At last, the legendary Dragon Breaker Shield answers my call!',
  },
  27: {
    code: 'PROP-006',
    nameKo: '백유리 불씨 등불',
    nameEn: 'White Glass Ember',
    imageUrl: '/hs-assets/items/prop_006.webp',
    descKo:
      '어떠한 비바람과 흑마술 속에서도 꺼지지 않는 순백의 정화 불꽃. 내궁의 어둠을 밝히고 환술과 저주를 태워 없앤다.',
    descEn:
      'An undying white-gold purifying flame housed in brass and crystal, burning away illusions and shadow curses.',
    leadInKo: '새벽의 깃발을 지켜냈다! 이 순백의 백유리 불씨가 우리의 진격로를 밝혀 줄 거야!',
    leadInEn: 'The dawn banner stands! This pure White Glass Ember will light our march forward!',
  },
  28: {
    code: 'PROP-012',
    nameKo: '왕좌의 혈옥 인장',
    nameEn: 'Imperial Throne Seal',
    imageUrl: '/hs-assets/items/prop_012.webp',
    descKo:
      '황금 용 조각과 붉은 혈옥으로 빚어진 정통 왕실의 옥새. 찬탈자 루시안의 거짓 칙령을 무효로 돌리는 결정적 증거다.',
    descEn:
      'The legitimate gold-and-ruby imperial dragon seal, overturning usurper Lucian’s forged royal decrees.',
    leadInKo: '아르투스를 물리치고 평의회 대전각을 탈환했다! 여기, 빼앗겼던 왕좌의 인장이 있어!',
    leadInEn: 'Artus is pushed back and the Council Hall is ours! Here lies the stolen Throne Seal!',
  },
  33: {
    code: 'PROP-011',
    nameKo: '정화된 심연의 핵',
    nameEn: 'Abyssal Core Orb',
    imageUrl: '/hs-assets/items/prop_011.webp',
    descKo:
      '거신마인의 심장부에서 회수한 암흑 마도 구체. 강철 발톱 봉인구 안에 거대한 심연 마력이 소용돌이치고 있다.',
    descEn:
      'A swirling violet mana core extracted from the swamp colossus, contained within dark-iron sealing claws.',
    leadInKo: '여섯 스승님과 함께 거신마인을 쓰러뜨렸어! 폭주하던 심연의 핵을 봉인한다!',
    leadInEn: 'Together with my six masters, the colossus fell! Sealing this unstable Abyssal Core now!',
  },
  35: {
    code: 'PROP-014',
    nameKo: '흑요석 마검 파편',
    nameEn: 'Obsidian Greatsword',
    imageUrl: '/hs-assets/items/prop_014.webp',
    descKo:
      '숙적 데스나이트 아르투스가 휘두르던 칠흑의 대검. 붉은 룬 혈맥이 새겨진 검신에 굴복하지 않는 무인의 집념이 서려 있다.',
    descEn:
      'A jagged black-obsidian greatsword veined with crimson runes, bearing the fierce resolve of rival Death Knight Artus.',
    leadInKo: '안개 속 진검승부는 내 승리다, 아르투스… 땅에 꽂힌 이 흑요석 대검이 오늘을 기억할 것이다.',
    leadInEn: 'This duel in the mist is mine, Artus… Your fallen Obsidian Greatsword marks our clash.',
  },
  36: {
    code: 'PROP-010',
    nameKo: '십자 성흔의 지도',
    nameEn: 'Cross-Scar Star Map',
    imageUrl: '/hs-assets/items/prop_010.webp',
    descKo:
      '별빛 기록실 깊숙이 숨겨져 있던 고대 양피지 성도. 대륙의 지맥과 최후의 결전지 파멸의 제단으로 향하는 길을 가리킨다.',
    descEn:
      'An ancient parchment star-chart from the Starlight Archive, revealing the ley-line path to the Altar of Ruin.',
    leadInKo: '고위흑술사 간다르를 격파했다! 제단 위에 펼쳐진 이것이 바로… 십자 성흔의 지도!',
    leadInEn: 'High Warlock Gandar is defeated! Spread across the altar—it’s the Cross-Scar Star Map!',
  },
  38: {
    code: 'PROP-009',
    nameKo: '세 개의 명주 봉인서',
    nameEn: 'Three Silk Seals',
    imageUrl: '/hs-assets/items/prop_009.webp',
    descKo:
      '적·청·금 삼색 매듭으로 봉인된 세 두루마리 성서. 심연화신 루시안의 불멸 주술을 영원히 잠재우는 선대 영웅들의 유산이다.',
    descEn:
      'Three sacred silk scrolls bound in crimson, azure, and gold cords—sealing away Abyss-Avatar Lucian’s dark immortality forever.',
    leadInKo: '끝났다, 루시안! 부모님과 이그니스, 모든 전우의 염원이 담긴 세 개의 명주 봉인을 완성한다!',
    leadInEn: 'It is over, Lucian! With everyone’s wishes united, the Three Silk Seals are complete!',
  },
};

type CompactDialogueSeed = {
  leftNameEn: string;
  rightNameEn: string;
  lines: [side: 'L' | 'R', ko: string, en: string][];
  victoryKo: string;
  victoryEn: string;
};

const EPISODE_DIALOGUE_SEEDS: Record<number, CompactDialogueSeed> = {
  0: {
    leftNameEn: 'Paladin Kadan',
    rightNameEn: 'Scarecrow Bot',
    lines: [
      ['L', '좋아, 엘윈 수련장의 훈련용 허수아비 로봇이군! 오늘 기초 실전을 확실히 익혀 볼까?', 'All right, the Elwin Training Grounds Scarecrow Bot! Let’s master the basics of card combat!'],
      ['R', '삐빅— 훈련 모드 가동! 체력 10 베이직 덱으로 도발과 공격의 기본기를 시험합니다!', 'BEEP— Training mode online! Testing your Taunt and attack fundamentals with 10 Health!'],
      ['L', '초록 테두리가 켜진 카드를 내고, 다음 턴에 적 영웅 체력을 0으로 만들면 승리야!', 'Play green-glowing cards, then strike next turn to drop the enemy Hero’s Health to zero!'],
      ['R', '준비 완료! 망설이지 말고 카드를 소환해 정면으로 부딪쳐 보십시오, 모험가님!', 'Ready for combat! Summon your minions and strike head-on, Adventurer!'],
    ],
    victoryKo: '훌륭해! 허수아비 로봇 훈련을 완벽히 마쳤어. 이제 제1화 진짜 모험으로 출발하자!',
    victoryEn: 'Well done! Scarecrow Bot training is complete. Now let’s head into Episode 1!',
  },
  1: {
    leftNameEn: 'Paladin Aleksandar',
    rightNameEn: 'Ambitious Lucian',
    lines: [
      ['R', '알렉산다르! 칼을 버리고 무릎 꿇어라. 항복하면 엘윈의 목숨만은 살려 두지!', 'Aleksandar! Drop your blade and kneel. Surrender, and I may spare Elwin’s life!'],
      ['L', '닥쳐라, 루시안! 거짓 반역 누명까지 씌워 설원 마을을 불태우다니!', 'Silence, Lucian! Framing an innocent frontier village just to burn it down!'],
      ['R', '붉은 유리 궁정의 뜻을 거스른 대가다. 저 다리 너머로 단 한 명도 못 간다!', 'Such is the price of defying the Red Glass Court. None shall cross that bridge alive!'],
      ['L', '내 아내 엘윈과 뱃속의 아이는 이미 북방 설원으로 떠났다!', 'My wife Elwin and our unborn child are already bound for the northern snows!'],
      ['R', '뭐라?! 네놈 혼자서 내 친위 토벌대를 막겠다는 거냐?!', 'What?! You think one man can hold back my entire punitive force?!'],
      ['L', '이 불타는 외나무다리 위에서, 아케 성기사의 검으로 네 야망을 꺾어 주마!', 'Upon this burning bridge, a paladin’s blade shall shatter your ambition!'],
    ],
    victoryKo: '엘윈… 부디 설원 너머에서 아이와 함께 굳세게 살아남아 다오!',
    victoryEn: 'Elwin… live on strong beyond the snowfields with our child!',
  },
  2: {
    leftNameEn: 'Pilgrim Hercul',
    rightNameEn: 'Blacksmith Grimli',
    lines: [
      ['R', '거기 서라, 망토 쓴 기사놈! 항구 고아들을 노리는 궁정의 앞잡이냐?!', 'Halt, cloaked knight! Are you another court hound hunting the harbor orphans?!'],
      ['L', '진정하시오! 나는 옛 아케 성기사 헤르쿨, 아이들을 구하러 온 사람이오!', 'Stay your hammer! I am Hercul of the old Paladin Order—here to save those children!'],
      ['R', '흥, 말뿐인 신의는 안 믿는다! 내 룬 망치를 받아 내며 증명해 봐라!', 'Hmph, words are cheap! Prove your honor against my runic warhammer!'],
      ['L', '좋소! 정정당당히 겨루어 내 진심을 똑똑히 보여 드리겠소!', 'Very well! Let an honest clash of arms prove where my heart stands!'],
    ],
    victoryKo: '이제 오해가 풀렸군! 18년 뒤 별취한 종탑에서 반드시 다시 만납시다!',
    victoryEn: 'Our misunderstanding is cleared! Let us reunite at Drunken Bell Tower in eighteen years!',
  },
  3: {
    leftNameEn: 'Leader Gawain',
    rightNameEn: 'Crystalmancer Belphegor',
    lines: [
      ['R', '크하하! 절벽 아래로 떨어진 궁수 놈처럼 너희도 흑요석 결정에 묻어 주마!', 'Hahaha! Like that archer who fell into the gorge, I’ll entomb you all in obsidian!'],
      ['L', '벨페고르…! 로비냐드의 마지막 화살이 지켜낸 길을 네놈이 더럽히게 두지 않는다!', 'Belphegor…! You will not defile the path Robinyard gave his life to protect!'],
      ['R', '앞도 못 보는 맹인 검사가 내 마법 결정을 어떻게 베겠다는 거냐!', 'How can a blind swordsman hope to cleave my arcane crystals?!'],
      ['L', '눈이 아닌 바람의 울림으로 벤다! 일곱 추적자의 이름으로 널 처단한다!', 'I strike by the resonance of the wind! In the name of the Seven Pursuers, fall!'],
    ],
    victoryKo: '잘 가라, 로비냐드… 네가 지킨 아이는 우리가 끝까지 길러 내겠다.',
    victoryEn: 'Rest well, Robinyard… We will raise the child you saved to the very end.',
  },
  4: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Captain Karg',
    lines: [
      ['R', '크르르… 다친 유목민 꼬마를 업고 어디까지 도망칠 수 있을 것 같으냐!', 'Grrr… How far do you think you can run carrying that wounded nomad boy?!'],
      ['L', '길가메시는 내 소중한 친구야! 손끝 하나 건드리지 못하게 하겠어!', 'Gilgamesh is my friend! You won’t lay a single claw on him!'],
      ['R', '건방진 애송이! 살얼음 협곡을 네놈들의 무덤으로 만들어 주마!', 'Cocky brat! This frozen ravine will become your grave!'],
      ['L', '스승님들께 배운 엘윈의 방패술, 지금 여기서 똑똑히 보여 주지!', 'I’ll show you the shield art of Elwin my masters taught me right here!'],
    ],
    victoryKo: '카르그의 추격대를 물리쳤어! 조금만 버텨, 길가메시—안전한 막사가 코앞이야!',
    victoryEn: 'Karg’s pack is beaten back! Hang in there, Gilgamesh—camp is just ahead!',
  },
  5: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Medusa Gorgo',
    lines: [
      ['R', '호호호, 한 치 앞도 안 보이는 독안개 속에서 내 그림자를 찾을 수 있겠니?', 'Hohoho! Can you find my shadow inside this blinding venom fog, boy?'],
      ['L', '가웨인 스승님이 말씀하셨지… 어둠 속일수록 눈을 감고 바람의 결을 읽으라고!', 'Master Gawain taught me… when darkness falls, close your eyes and read the wind!'],
      ['R', '입만 살았구나! 사방에서 날아드는 내 독화살을 피해 보시지!', 'Brave words! Let’s see you dodge my poison arrows from every side!'],
      ['L', '빗소리와 공기의 흔들림이 선명해… 네 위치는 이미 파악했다, 고르고!', 'Every raindrop and ripple of air is clear… I already have your position, Gorgo!'],
    ],
    victoryKo: '폭우 속 연막이 걷혔어! 아무리 교묘한 암살술도 흔들리지 않는 마음은 뚫지 못해!',
    victoryEn: 'The storm-shroud clears! No assassin’s trick can pierce an unshaken mind!',
  },
  6: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Archsage Malfuon',
    lines: [
      ['R', '카단아, 여섯 스승의 무예가 네 안에서 서로 충돌하고 있구나.', 'Kadan, the six martial arts within you are still clashing against one another.'],
      ['L', '맞아요, 말퓨온 어르신… 힘을 모으려 할수록 호흡이 거칠어져요.', 'It’s true, Master Malfuon… The harder I push, the more my breath scatters.'],
      ['R', '밤하늘의 별자리를 보듯 숨을 비워라. 내 영기 환영을 상대로 증명해 보거라!', 'Empty your breath like the night stars. Prove it now against my astral projection!'],
      ['L', '별을 들이마시고 빛을 내쉰다… 전력으로 갑니다, 대현자님!', 'Breathe in the stars, exhale the light… Here I come with everything I have!'],
    ],
    victoryKo: '성진호흡의 흐름을 깨우쳤어! 이제 어떤 강적 앞에서도 마력이 흔들리지 않아!',
    victoryEn: 'I’ve grasped the flow of Star-Breathing! My mana won’t waver before any foe!',
  },
  7: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Death Knight Artus',
    lines: [
      ['R', '북방 유목 연맹도 오늘 밤으로 끝이다. 반란의 불길이 이미 막사를 삼켰다!', 'The Northern Coalition ends tonight. Flames of mutiny already engulf your tents!'],
      ['L', '비겁한 기습으로 의리를 배반하게 만들다니! 네가 배후의 죽음기사 아르투스냐!', 'Inciting treason through a cowardly night raid! So you’re Death Knight Artus!'],
      ['R', '약육강식이 전장의 법칙이다. 살아서 날 막을 수 있다면 막아 봐라!', 'Only the strong rule the battlefield. Stop my vanguard if you value your life!'],
      ['L', '북방 초원의 은혜는 내 방패로 갚는다! 한 발짝도 못 지나간다!', 'I repay the northern plains with my shield! You go no further!'],
    ],
    victoryKo: '아르투스의 기습 부대를 몰아냈다! 북방 형제들의 천막은 무사해!',
    victoryEn: 'Artus’s raiders are driven off! Our northern brothers’ camp is safe!',
  },
  8: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Captain Bolton',
    lines: [
      ['R', '이봐 시골뜨기! 그 붉은 갈기 명마는 관문 통과세로 내가 접수하겠다!', 'Hey, country boy! I’m confiscating that Crimson Mane warhorse as border toll!'],
      ['L', '이 아이는 물건이 아니라 생명을 나눈 내 동료야! 당장 비켜!', 'He isn’t property—he’s my trusted partner! Step aside right now!'],
      ['R', '하! 내 약탈 기병대 앞에서 감히 방패를 들어? 말과 함께 짓밟아 주마!', 'Hah! Raising a shield against my border riders? Trample them both!'],
      ['L', '약자를 등치는 가짜 군인들에게 내 동료를 내줄 것 같으냐!', 'As if I’d ever hand my companion over to crooked highwaymen like you!'],
    ],
    victoryKo: '잘했어, 적갈기야! 이제 국경 관문을 넘어 남쪽 왕도로 달려가자!',
    victoryEn: 'Good boy, Crimson Mane! Now let’s ride past the border gate toward the capital!',
  },
  9: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Noble Ignis',
    lines: [
      ['R', '길가의 천한 거지 놈이 감히 불꽃 궁정 귀공자의 행차를 가로막느냐!', 'How dare a ragged street drifter block a scion of the Flame Court?!'],
      ['L', '네 말발굽 아래 쓰러진 저 어린아이가 보이지도 않는 거냐, 귀공자!', 'Are you too blind to see the child your horse nearly trampled, noble?!'],
      ['R', '건방진 눈빛이로군… 내 화염검으로 예의범절을 뼛속까지 새겨 주지!', 'Insolent glare… My flame-blade will carve manners straight into your bones!'],
      ['L', '화려한 비단옷 뒤에 숨은 오만한 검 따위, 정면에서 꺾어 주마!', 'I’ll shatter that arrogant blade hiding behind royal silk!'],
    ],
    victoryKo: '이상하군… 저 귀공자의 품에서도 내 것과 닮은 은빛 단검의 기운이 느껴졌어.',
    victoryEn: 'Strange… I sensed the same silver dagger resonance coming from that young noble.',
  },
  10: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Chancellor Lucian',
    lines: [
      ['R', '제 발로 호랑이 굴에 들어왔구나, 알렉산다르의 핏줄이여!', 'So Aleksandar’s whelp walks right into the lion’s den!'],
      ['L', '재상 루시안…! 네가 지하 감옥에 가둔 무고한 사람들을 구하러 왔다!', 'Chancellor Lucian…! I’m here to free everyone you locked in the dungeons!'],
      ['R', '친위 기사단이 사방을 에워쌌다. 네 아버지처럼 잿더미로 만들어 주마!', 'My Royal Knights surround every exit. You’ll burn to ash just like your father!'],
      ['L', '아버지의 의지는 결코 죽지 않았어! 네 포위망을 정면으로 뚫는다!', 'My father’s will never died! I’m smashing straight through your cordon!'],
    ],
    victoryKo: '친위대의 포위가 뚫렸다! 지금이야, 지하 용암 감옥으로 내려가자!',
    victoryEn: 'The Royal Guard line is broken! Now—straight down to the lava dungeons!',
  },
  11: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Warden Gorgo',
    lines: [
      ['R', '또 만났네, 꼬마 성기사! 이 용암 감옥 다리는 아무도 건너갈 수 없단다!', 'We meet again, little paladin! Nobody leaves across this lava prison bridge!'],
      ['L', '메두사 고르고! 발리안 아저씨와 이셀라 님을 반드시 모시고 나가겠어!', 'Medusa Gorgo! I’m taking Uncle Balian and Lady Ysela out of here safely!'],
      ['R', '두 자루의 은빛 단검이 만났다고 기적이 일어날 줄 아니? 독니에 잠들어라!', 'Think reuniting twin silver daggers will work a miracle? Sleep in my fangs!'],
      ['L', '기적은 스스로 만드는 거야! 엘윈의 방패여, 모두의 뒤를 지켜라!', 'We forge our own miracle! Shield of Elwin, guard everyone behind me!'],
    ],
    victoryKo: '감옥장 고르고를 제압했어! 발리안 아저씨, 이셀라 님—어서 지상으로 탈출해요!',
    victoryEn: 'Warden Gorgo is down! Uncle Balian, Lady Ysela—let’s escape to the surface!',
  },
  12: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Siege Colossus Ironforge',
    lines: [
      ['R', '침입자 감지… 엘윈 폐허의 옛 성소와 무덤을 완전히 평탄화한다…!', 'INTRUDER DETECTED… LEVELING OLD ELWIN SANCTUARY AND GRAVESITES…!'],
      ['L', '멈춰라, 강철 거신! 이곳은 내 부모님과 마을 사람들의 넋이 잠든 땅이야!', 'Halt, iron colossus! My parents and the villagers rest beneath this snow!'],
      ['R', '궁정 명령 최우선… 저항 개체 섬멸 개시!', 'IMPERIAL ORDER ABSOLUTE… INITIATING ANNIHILATION PROTOCOL!'],
      ['L', '두 무덤 앞은 내가 목숨 걸고 지킨다! 성진호흡, 전개!', 'I guard these two graves with my life! Star-Breathing, full release!'],
    ],
    victoryKo: '어머니, 아버지… 마침내 고향 언덕을 지켜냈어요.',
    victoryEn: 'Mother, Father… I protected our homeland ridge at last.',
  },
  13: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Veteran Leonar',
    lines: [
      ['R', '젊은이여, 유랑민 연맹의 녹옥 지팡이는 힘만으로 들 수 있는 물건이 아니다.', 'Young man, the Nomad Coalition’s Jade Staff cannot be lifted by strength alone.'],
      ['L', '알고 있습니다, 레오나르 어르신. 약한 이들을 지키는 각오를 시험해 주십시오!', 'I know, Elder Leonar. Test my resolve to shield the powerless!'],
      ['R', '기특한 대답이다! 노장의 창끝이 아직 무디지 않음을 몸으로 버텨 보거라!', 'A worthy answer! Now weather the edge of an old veteran’s spear!'],
      ['L', '한 수 배웁니다, 레오나르 님!', 'I humbly accept your challenge, Master Leonar!'],
    ],
    victoryKo: '고맙습니다, 레오나르 어르신! 유랑민 연맹의 뜻, 결코 저버리지 않겠습니다!',
    victoryEn: 'Thank you, Elder Leonar! I will never betray the trust of the Nomad Coalition!',
  },
  14: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Pirate Boss Aqualord',
    lines: [
      ['R', '으하하! 안개 낀 날엔 이 호수 장원이 통째로 우리 수적단 차지다!', 'Bwahaha! When mist rolls in, this entire lake manor belongs to my river pirates!'],
      ['L', '피난민 아이들의 식량까지 약탈하려 들다니, 용서 못 해 아쿠아로드!', 'Stealing food from refugee children?! Unforgivable, Aqualord!'],
      ['R', '녹옥 지팡이 하나 믿고 나서는 거냐? 물귀신으로 만들어 주마!', 'Picking a fight with one Jade Staff? I’ll drag you straight to the lakebed!'],
      ['L', '호수 물길로 도망칠 생각 마라! 오늘 여기서 수적단을 일소한다!', 'Don’t count on escaping by water! Your pirate crew ends right here!'],
    ],
    victoryKo: '수적두목 아쿠아로드를 호수 밖으로 쫓아냈어! 아이들 모두 안심해도 돼!',
    victoryEn: 'Pirate Boss Aqualord is washed away! All the children in the manor are safe!',
  },
  15: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Spider Arachne',
    lines: [
      ['R', '수적 놈들은 미끼였을 뿐이지… 진짜 사냥은 지금부터란다, 카단!', 'Those river pirates were mere bait… The real hunt begins now, Kadan!'],
      ['L', '황실 직속 암살단장 아라크네…! 레오나르 어르신께 독을 쓴 게 너였구나!', 'Imperial Assassin Chief Arachne…! You’re the one who poisoned Elder Leonar!'],
      ['R', '노인네가 아이들을 감싸다 대신 맞았을 뿐이야. 너도 그 곁으로 보내 줄게!', 'The old fool shielded the brats himself. I’ll send you right after him!'],
      ['L', '분노로 타오르는 사자의 일격이 네 거미줄을 갈기갈기 찢어 놓을 것이다!', 'A lion’s righteous fury will tear every strand of your web apart!'],
    ],
    victoryKo: '레오나르 어르신, 편히 쉬십시오… 어르신이 지킨 새싹들은 제가 끝까지 돌보겠습니다.',
    victoryEn: 'Rest in peace, Elder Leonar… I will guard every young life you saved.',
  },
  16: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Commander Lucian',
    lines: [
      ['R', '이그니스! 내가 키워 준 은혜를 잊고 저 변방 놈과 손을 잡다니!', 'Ignis! After I raised you, you dare join hands with that frontier rat?!'],
      ['L', '루시안! 이그니스는 이미 모든 진실을 알았다. 우린 피로 맺어진 형제야!', 'Lucian! Ignis knows the whole truth now—we stand together as sworn brothers!'],
      ['R', '가소로운 것들! 부두의 포위망 속에서 둘 다 수장시켜 주마!', 'Pathetic fools! My dockside blockade will drown you both together!'],
      ['L', '이그니스의 화염과 내 서리 방패가 합쳐진 지금, 네 적수는 되지 못해!', 'With Ignis’s flame beside my frost shield, your army stands no chance!'],
    ],
    victoryKo: '해냈어, 이그니스! 우리의 첫 형제 협공으로 루시안의 추격군을 완전히 무너뜨렸다!',
    victoryEn: 'We did it, Ignis! Our first strike as brothers shattered Lucian’s pursuit force!',
  },
  17: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Grand Elder Zephyr',
    lines: [
      ['R', '외부인은 바람 속삭임 섬에 발을 들일 수 없다! 배를 돌려라!', 'Outsiders are forbidden on Whispering Wind Isle! Turn your prow back!'],
      ['L', '대장로 제피르! 루시안과 내통해 해협을 봉쇄한 속셈을 모를 줄 아느냐!', 'Grand Elder Zephyr! We know you’re colluding with Lucian to blockade this strait!'],
      ['R', '비밀을 눈치챘다면 살려 둘 수 없지! 폭풍 해류 속에 침몰해라!', 'If you know that much, sink beneath my tempest currents!'],
      ['L', '선상 결투로 네 매복 함대를 뚫고 반드시 바람섬에 닿겠다!', 'I’ll cleave right through your ambush fleet and reach Wind Isle!'],
    ],
    victoryKo: '제피르의 봉쇄선을 돌파했다! 안개 너머로 바람 속삭임 섬이 보인다!',
    victoryEn: 'Zephyr’s blockade is broken! Whispering Wind Isle rises beyond the mist!',
  },
  18: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Obsidian Colossus Ironforge',
    lines: [
      ['R', '검은 성전 보안 가동… 실피드 여왕의 비밀에 접근하는 자, 제거한다!', 'BLACK SANCTUM SECURITY ACTIVE… PURGING ALL WHO SEEK QUEEN SYLPHID’S SECRET!'],
      ['L', '역시 여왕님의 병환은 독살 음모였어! 거신으로 입을 막으려 하다니!', 'So Queen Sylphid’s illness really was poison! Using a colossus to bury the truth?!'],
      ['R', '흑요석 마력포 충전 완료… 목표물 카단, 소각!', 'OBSIDIAN CANNON CHARGED… TARGET KADAN, INCINERATE!'],
      ['L', '검은 성전의 어두운 진실, 이 방패로 부수고 세상에 드러내겠어!', 'My shield will smash through and expose this sanctum’s dark secret!'],
    ],
    victoryKo: '흑요석 거신을 파괴하고 해독 단서를 찾았어! 어서 실피드 여왕님을 구하자!',
    victoryEn: 'The Obsidian Colossus is down and we have the antidote clue! Let’s save Queen Sylphid!',
  },
  19: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'King Aeolus',
    lines: [
      ['R', '대륙 본토를 구할 동맹을 원한다면, 하늘 제단의 세 가지 시험을 넘어 보아라!', 'If you seek Wind Isle’s alliance, overcome the Three Trials of the Sky Altar!'],
      ['L', '에올루스 국왕 폐하, 어떤 시련이든 정면으로 받아 내겠습니다!', 'King Aeolus, I will face every trial head-on without hesitation!'],
      ['R', '패기만으로는 천공의 폭풍을 견딜 수 없다. 내 전력을 다해 시험하마!', 'Spirit alone cannot weather sky-tempests. Face my royal judgment!'],
      ['L', '모두의 생명이 걸린 동맹입니다—제 모든 무예로 증명하겠습니다!', 'Countless lives depend on this alliance—I’ll prove our worth with all my strength!'],
    ],
    victoryKo: '하늘 제단의 세 가지 시험을 모두 통과했어! 바람섬 함대가 우리와 함께한다!',
    victoryEn: 'All Three Trials of the Sky Altar are cleared! Wind Isle’s fleet sails with us!',
  },
  20: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Abyss Dragon Leviathan',
    lines: [
      ['R', '크아아아—!! 심연의 파도여, 저 꽃배 선단을 남김없이 집어삼켜라!!', 'ROOOAAR—!! Rise, abyssal tide, and swallow their flower-ship armada whole!!'],
      ['L', '저주에 눈이 먼 바다의 수호룡 리바이어던이 해일을 일으키고 있어!', 'Cursed sea-dragon Leviathan is raising a black tidal wave against our ships!'],
      ['R', '바다 위 모든 인간을 심해의 어둠 속으로 끌어내리겠다!!', 'Every mortal upon these waters shall sink into the lightless deep!!'],
      ['L', '수백 척 동맹 선단은 내가 지킨다! 선수 위에서 정면으로 맞서겠어!', 'I’ll shield our entire armada right from the bowsprit! Come, Leviathan!'],
    ],
    victoryKo: '리바이어던의 저주가 풀리며 바다가 잠잠해졌어! 전 선단, 본토 해안으로 전진!',
    victoryEn: 'Leviathan’s curse broke and the seas calmed! All ships, onward to the mainland!',
  },
  21: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Iron Regent Artus',
    lines: [
      ['R', '상륙 지점의 구호소는 이미 불태웠다. 바다 위에서 수장되거라, 카단!', 'Your coastal relief camp is already ash. Drown in the surf, Kadan!'],
      ['L', '철갑섭정 아르투스…! 다친 백성들의 구호소까지 불태우다니, 그게 기사의 짓이냐!', 'Iron Regent Artus…! Burning a shelter for the wounded—you call yourself a knight?!'],
      ['R', '승리만이 정의다! 내 중장갑 해안 방어선을 뚫을 수 있을 것 같으냐!', 'Victory is the only justice! Try breaching my ironclad seawall!'],
      ['L', '참된 기사의 정의가 무엇인지 오늘 똑똑히 새겨 주마!', 'I’ll carve the meaning of true knighthood into your armor today!'],
    ],
    victoryKo: '해안 방어선을 돌파했다! 생존자들을 구출하고 내륙 거점을 확보하자!',
    victoryEn: 'The coastal barricade is breached! Rescue the survivors and secure the beachhead!',
  },
  22: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Commander Volkan',
    lines: [
      ['R', '하하하! 배도 잃고 무인도에 갇힌 네놈들이 내 해협 요새를 어찌 뚫겠느냐!', 'Hahaha! Shipwrecked on a barren island—how could you ever breach my cliff fortress?!'],
      ['L', '볼칸, 네 오만이 패인이다! 동료들과 밤새 완성한 공성 투석기를 보아라!', 'Your arrogance blinds you, Volkan! Behold the siege catapults we built together!'],
      ['R', '뭐, 뭣이?! 바위 절벽 위로 투석기가 날아오다니?! 전군 요격하라!', 'W-What?! Boulders flying straight over my sea-cliff ramparts?! Intercept them!'],
      ['L', '사이렌 해협의 철옹성은 오늘 무너진다! 전군 돌격!', 'Your Siren Strait stronghold falls today! Charge!'],
    ],
    victoryKo: '요새사령관 볼칸을 격파하고 해협 수로를 완전히 열었어!',
    victoryEn: 'Commander Volkan is defeated and the Siren Strait sea-lane is wide open!',
  },
  23: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Necromancer Gandar',
    lines: [
      ['R', '크흐흐… 선대 성기사들의 유해만큼 훌륭한 언데드 병사 재료도 없지!', 'Hehehe… Fallen paladin bones make the finest undead puppets!'],
      ['L', '사령술사 간다르! 영웅들의 안식처를 모독하는 더러운 주술, 당장 멈춰라!', 'Necromancer Gandar! Stop defiling the resting place of fallen heroes!'],
      ['R', '죽은 자들의 칼날에 네놈도 기꺼이 동참하게 해 주마!', 'Join the ranks of the dead beneath their own blades!'],
      ['L', '선배 성기사님들의 명예를 걸고, 네 사령술을 빛으로 정화하겠다!', 'Upon the honor of the paladins before me, I’ll purge your dark magic!'],
    ],
    victoryKo: '선대 성기사님들의 넋이 평안을 되찾았어… 이제 석굴 안쪽 봉인실로 향하자.',
    victoryEn: 'The fallen paladins rest in peace once more… Onward to the sealed chamber.',
  },
  24: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Adamantium Guardian',
    lines: [
      ['R', '성물 방패에 손대려는 자여… 고대 수호거신의 심판을 먼저 견뎌 내라!', 'SEEKER OF THE SACRED SHIELD… ENDURE THE ADAMANTIUM GUARDIAN’S TRIAL FIRST!'],
      ['L', '선대 영웅들이 남긴 최후의 시험이군… 물러서지 않겠어!', 'The final trial left by the ancient heroes… I won’t take a single step back!'],
      ['R', '일곱 밤의 봉인이 열린다. 자격 없는 자는 가루가 될 뿐이다!', 'THE SEVEN-NIGHT SEAL OPENS. THE UNWORTHY SHALL CRUMBLE TO DUST!'],
      ['L', '지키고자 하는 마음이야말로 가장 강한 방패다! 간다!', 'A heart sworn to protect is the strongest shield of all! Here I come!'],
    ],
    victoryKo: '고대 수호거신의 인정을 받았어! 눈꽃 문양이 찬란하게 빛나고 있다!',
    victoryEn: 'The ancient guardian acknowledges me—the Snowflake Crest blazes with light!',
  },
  25: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'High Inquisitor Malakai',
    lines: [
      ['R', '신성한 국혼식장에 감히 난입하다니! 이단자 카단을 즉결 처형하라!', 'Crashing a sacred royal wedding?! Execute the heretic Kadan on the spot!'],
      ['L', '거짓된 혼례로 민중을 속이는 건 바로 너희다, 대심판관 말라카이!', 'You’re the ones deceiving the realm with a sham wedding, Inquisitor Malakai!'],
      ['R', '입 닥쳐라! 내 심판의 성화가 네놈의 입을 영원히 봉하리라!', 'Silence! My inquisitorial flames will seal your lips forever!'],
      ['L', '진실의 종소리는 누구도 막지 못해! 위선의 가면을 벗겨 주마!', 'No flame can silence the bell of truth! Let’s tear off your mask of hypocrisy!'],
    ],
    victoryKo: '거짓 혼례식의 진실이 온 광장에 밝혀졌어! 백성들이 깨어나고 있다!',
    victoryEn: 'The sham wedding is exposed before the entire square! The citizens are awakening!',
  },
  26: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Gatekeeper Balthazar',
    lines: [
      ['R', '크으윽… 머릿속에서 뱀의 목소리가 울린다… 태양의 철문은 못 연다!', 'Ghhhk… The serpent’s voice rings in my skull… None shall pass the Sun Gate!'],
      ['L', '수문장 발타자르 장군님! 루시안의 세뇌 저주에 조종당하고 계십니다!', 'General Balthazar! Lucian’s serpent curse is controlling your mind!'],
      ['R', '나를 쓰러뜨리지 못하면 이 문은 절대 열리지 않는다… 전력으로 덤벼라!', 'Unless you strike me down, these iron gates stay shut… Come at me with everything!'],
      ['L', '반드시 저주의 사슬만 끊어 장군님의 본심을 되찾아 드리겠습니다!', 'I’ll shatter only the curse’s chains and bring your true heart back!'],
    ],
    victoryKo: '뱀 문신의 세뇌가 풀렸어! 발타자르 장군님, 이제 함께 황궁의 새벽을 열어요!',
    victoryEn: 'The serpent curse is broken! General Balthazar, let’s open the dawn together!',
  },
  27: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Shadow Chief Arachne',
    lines: [
      ['R', '결전 전야에 달콤한 꿈이라도 꾸었니? 네 깃발은 새벽이 오기 전에 꺾일 거야!', 'Dreaming sweetly on the eve of battle? Your banner falls before daybreak!'],
      ['L', '내궁 정원까지 스며들었군, 아라크네! 하지만 네 살기는 이미 읽었다!', 'Slipping into the inner garden, Arachne? I already sensed your killing intent!'],
      ['R', '그림자 자객단 전원 기습! 내일 아침 해를 보지 못하게 만들어라!', 'Shadow assassins, strike! Make sure he never sees tomorrow’s sun!'],
      ['L', '동료들과 나눈 두 개의 약속을 걸고, 새벽의 깃발을 끝까지 지킨다!', 'Upon the two promises I swore to my comrades, this dawn banner will not fall!'],
    ],
    victoryKo: '밤의 암살자들을 모두 물리쳤다! 동쪽 하늘이 밝아 오고 있어!',
    victoryEn: 'Every night assassin is repelled! Dawn is breaking across the eastern sky!',
  },
  28: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Death Knight Artus',
    lines: [
      ['R', '비취 평의회는 이미 우리 수중에 떨어졌다. 네 형제의 희생도 부질없었군!', 'The Jade Council Hall is ours. Even your brother’s fiery stand was in vain!'],
      ['L', '입 다물어, 아르투스! 이그니스가 열어 준 길을 네가 막을 수 있을 것 같으냐!', 'Shut your mouth, Artus! You think you can block the path Ignis blazed for us?!'],
      ['R', '그 분노가 네 검을 무디게 할 뿐이다. 덤벼라, 카단!', 'Rage only dulls your edge. Come and test me, Kadan!'],
      ['L', '분노가 아니라 뜨거운 맹세다! 비취 평의회를 오늘 되찾는다!', 'Not rage—an unbreakable vow! Today we reclaim the Jade Council!'],
    ],
    victoryKo: '비취 평의회 대전각을 완전히 탈환했어! 이그니스, 네 뜻은 우리가 이어간다!',
    victoryEn: 'The Jade Council Hall is reclaimed! Ignis, we carry your torch forward!',
  },
  29: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Venom Queen Arachne',
    lines: [
      ['R', '해방 선언식이라니 웃기는군! 지하 독구름으로 광장을 피바다로 물들여 주마!', 'A Liberation Ceremony? Laughable! My underground venom mist will paint this plaza red!'],
      ['L', '맹독여왕 아라크네! 끝까지 백성들의 희망을 짓밟으려 들다니!', 'Venom Queen Arachne! Trying to poison the citizens’ hope to the bitter end!'],
      ['R', '내 모든 생명을 불사른 맹독 폭주다! 막을 수 있으면 막아 봐라!', 'I’ve staked my very life on this venom frenzy! Stop me if you dare!'],
      ['L', '바람의 여왕과 성소의 이름으로, 네 악연을 여기서 완전히 끊는다!', 'In the name of the Wind Queen and Elwin, your wicked web ends here forever!'],
    ],
    victoryKo: '아라크네를 완전히 처단하고 독구름을 정화했어! 수도 해방의 함성이 울려 퍼진다!',
    victoryEn: 'Arachne is vanquished and the poison mist is purged! Cheers of liberation ring out!',
  },
  30: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Corrupted Aqualord',
    lines: [
      ['R', '크하하! 네 개의 수문을 열면 하류 마을 수만 명이 단숨에 끝장이다!', 'Hahaha! Once I open all Four Gates, poisoned waters will flood every downstream town!'],
      ['L', '타락수문장 아쿠아로드! 심연의 힘에 영혼까지 팔아넘긴 거냐!', 'Corrupted Warden Aqualord! You even sold your soul to the Abyss?!'],
      ['R', '힘이 곧 법이다! 독류와 함께 수문 아래로 쓸려 내려가라!', 'Power is law! Wash away beneath my toxic torrent!'],
      ['L', '단 하나의 수문도 열게 두지 않는다! 지금 즉시 널 제압한다!', 'Not a single floodgate will open! I’m shutting you down right now!'],
    ],
    victoryKo: '네 수문 모두 안전하게 봉쇄 완료! 하류 강물과 백성들을 무사히 지켜냈어!',
    victoryEn: 'All Four Gates locked down tight! The downstream river and townspeople are safe!',
  },
  31: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Gambler Gandar',
    lines: [
      ['R', '인질을 걸고 하는 사기 도박만큼 짜릿한 판도 없지! 패를 내려놓으시지, 영웅님!', 'Nothing beats a rigged wager with hostages on the line! Fold your hand, hero!'],
      ['L', '인질들은 이미 카제와 동료들이 구출했다! 네 사기극은 끝났어, 간다르!', 'Kaze and my allies already freed the hostages! Your rigged game is over, Gandar!'],
      ['R', '크윽, 약삭빠른 놈들! 그렇다면 흑마술 군단으로 판을 통째로 엎어 주마!', 'Tch, meddling rats! Then my dark-magic legion will flip the whole table!'],
      ['L', '남의 목숨을 판돈으로 삼은 대가, 정면 승부로 치르게 해 주지!', 'Time to pay the price for gambling with innocent lives!'],
    ],
    victoryKo: '비열한 도박사 간다르의 판을 완전히 깨뜨렸어! 이제 다음 관문으로 진격하자!',
    victoryEn: 'Gambler Gandar’s crooked table is smashed! Let’s march to the next gate!',
  },
  32: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Illusion Witch Morgana',
    lines: [
      ['R', '왜 그렇게 슬픈 눈을 하니, 카단? 이 버드나무 숲에선 그리운 사람들과 영원히 살 수 있어…', 'Why such sad eyes, Kadan? In this willow forest, you can stay with lost loved ones forever…'],
      ['L', '환각마녀 모르가나…! 달콤한 거짓 환영으로 내 발걸음을 멈추려 하지 마!', 'Illusion Witch Morgana…! Sweet mirages won’t halt my steps!'],
      ['R', '고통스러운 현실로 돌아가 봤자 피와 이별뿐이야. 꿈속에 잠들어라!', 'Reality holds only blood and farewells. Surrender to the dream!'],
      ['L', '그리운 기억은 가슴에 품고 앞으로 나아가는 거야! 환영을 깨뜨린다!', 'Cherished memories live in my heart to push me forward! Shatter, illusion!'],
    ],
    victoryKo: '안개 숲의 환각이 걷혔어… 과거의 아픔을 넘어 내일을 향해 걸어가자!',
    victoryEn: 'The willow forest mirage fades… Beyond yesterday’s sorrow, we walk toward tomorrow!',
  },
  33: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Colossus Fiend Belphegor',
    lines: [
      ['R', '심연의 핵을 삼켜 불사신이 된 나를 보고도 감히 칼을 뽑느냐, 애송이들!', 'Having swallowed the Abyssal Core, I am immortal! Still dare draw steel?!'],
      ['L', '벨페고르! 오늘 이곳엔 나 혼자가 아니라 날 길러 주신 여섯 스승님이 함께 계신다!', 'Belphegor! Today I don’t stand alone—my six masters fight beside me!'],
      ['R', '스승이든 제자든 검은 늪의 진흙탕 속에 한꺼번에 파묻어 주마!', 'Masters and disciple alike—I’ll bury you all in the Black Marsh!'],
      ['L', '일곱 추적자의 모든 비기를 하나로 모아 네 불사의 핵을 꿰뚫는다!', 'Uniting every art of the Seven Pursuers, I’ll pierce straight through your core!'],
    ],
    victoryKo: '검은 늪 성채 정문이 열렸다! 스승님들과 함께 거두어 낸 값진 승리야!',
    victoryEn: 'The Black Marsh Citadel gates are open—a victory won side by side with my masters!',
  },
  34: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Ruin Fiend Belphegor',
    lines: [
      ['R', '크아아악! 내가 쓰러진다면 이 용암 회랑을 통째로 무너뜨려 동귀어진하겠다!', 'GRAAAH! If I fall, I’ll collapse this entire magma corridor upon you all!'],
      ['L', '끝까지 추악하군, 벨페고르! 스승님들이 열어 주신 퇴로는 절대 막히지 않아!', 'Vile to the very end, Belphegor! You won’t block the path my masters opened!'],
      ['R', '화염과 파멸의 파편 속에서 내 원한과 함께 불타올라라!!', 'Burn to cinders alongside my fury amidst the falling ruin!!'],
      ['L', '드래곤 브레이커 방패여, 모두의 생명을 수호하고 적의 숨통을 끊어라!', 'Dragon Breaker Shield—guard every ally and end his rampage once and for all!'],
    ],
    victoryKo: '파멸마인 벨페고르를 완전히 소멸시키고 무너지는 회랑을 무사히 빠져나왔어!',
    victoryEn: 'Ruin Fiend Belphegor is vanquished for good, and everyone cleared the collapsing hall!',
  },
  35: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Rival Death Knight Artus',
    lines: [
      ['R', '잔재주도 군대도 없다, 카단. 안개 속 다섯 환영 가운데 진짜 내 검을 찾아 봐라!', 'No armies, no tricks, Kadan. Find my true blade among five phantoms in the fog!'],
      ['L', '아르투스… 오랜 악연을 끝낼 정면 진검승부로군!', 'Artus… A true one-on-one duel to settle our long rivalry!'],
      ['R', '망설이는 순간 심장이 꿰뚫릴 것이다. 네 모든 것을 걸고 부딪쳐 와라!', 'Hesitate a heartbeat and your chest is pierced. Come at me with everything!'],
      ['L', '좋다! 성진호흡과 엘윈의 검으로 네 진검을 정면에서 받아 내마!', 'Gladly! With Star-Breathing and Elwin’s blade, I’ll meet your strike head-on!'],
    ],
    victoryKo: '훌륭한 승부였다, 아르투스… 어긋난 길이었을지라도 네 무인의 긍지는 기억하마.',
    victoryEn: 'A fierce duel, Artus… Though our paths clashed, I’ll remember your warrior’s pride.',
  },
  36: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'High Warlock Gandar',
    lines: [
      ['R', '별빛 기록실까지 기어오다니… 허나 루시안 님이 계신 제단 지도는 절대 못 가져간다!', 'You crawled all the way to the Starlight Archive… Yet you’ll never claim the altar map!'],
      ['L', '간다르, 네 어둠의 장막도 이제 마지막이다! 비켜서라!', 'Gandar, your curtain of shadow ends right here! Step aside!'],
      ['R', '나인섀도우 마도사단 전원 영창! 별빛 기록실을 암흑 공간으로 봉쇄하라!', 'Nine Shadows Cabal, chant! Seal this archive in eternal void!'],
      ['L', '어둠이 짙을수록 별빛은 더 선명하게 빛나는 법이다! 돌파한다!', 'The deeper the dark, the brighter the stars blaze! Breaking through!'],
    ],
    victoryKo: '별빛 기록실의 어둠이 걷혔다! 이제 최후의 결전지까지 단 한 걸음이야!',
    victoryEn: 'Darkness clears from the Starlight Archive! Only the final battlefield remains!',
  },
  37: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Commander Artus',
    lines: [
      ['R', '옥좌 홀 문 앞을 지키는 마지막 방패로서, 내 남은 모든 마력을 불사르겠다!', 'As the final shield before the throne hall, I burn every drop of power left in me!'],
      ['L', '루시안의 사령 주술에 묶인 채로도 그토록 강인한 투지를 보이다니…!', 'Even bound by Lucian’s necromancy, your fighting spirit burns this fiercely…!'],
      ['R', '동정은 필요 없다, 카단! 나를 넘지 못하면 루시안에게 닿을 자격조차 없다!', 'Save your pity, Kadan! If you cannot surpass me, you cannot reach Lucian!'],
      ['L', '전력으로 널 넘어서고, 반드시 루시안의 야망에 종지부를 찍겠다!', 'I’ll surpass you with full strength and end Lucian’s tyranny!'],
    ],
    victoryKo: '옥좌 홀의 거대한 문이 열렸다… 기다려라, 루시안! 지금 모든 빚을 갚으러 간다!',
    victoryEn: 'The grand doors to the Throne Hall swing open… Wait for me, Lucian!',
  },
  38: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Abyss Avatar Lucian',
    lines: [
      ['R', '크하하하!! 심연의 신격을 삼킨 내 앞에서 인간 따위가 무엇을 할 수 있느냐!!', 'BWAHAHA!! Before one who devoured the Abyss itself, what can mere mortals do?!'],
      ['L', '루시안! 엘윈 마을의 눈보라부터 오늘까지, 네가 짓밟은 모든 생명의 이름으로 왔다!', 'Lucian! From Elwin’s blizzard to this day, I stand here for every life you trampled!'],
      ['R', '네 아비 알렉산다르처럼 부질없는 정의를 외치다 먼지로 사라져라!!', 'Preach futile justice like your father Aleksandar, and vanish into dust!!'],
      ['L', '사람들의 이어진 마음은 절대 사라지지 않아! 이 일격으로 심연을 봉인한다!', 'Hearts bound together never vanish! With this strike, I seal your Abyss away!'],
    ],
    victoryKo: '길고 긴 어둠의 시대가 끝났어… 대륙 위로 마침내 진짜 태양이 떠오른다!',
    victoryEn: 'The long age of shadow is over… True sunlight rises across the continent at last!',
  },
  39: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Phantom Knight Artus',
    lines: [
      ['R', '전쟁은 끝났는데… 왜 내 검의 망령은 아직도 전장을 떠도는 것이냐…', 'The war is over… Why does my blade’s phantom still wander this battlefield…?'],
      ['L', '아르투스… 루시안의 잔류 사념이 네 마지막 자긍심마저 붙잡고 있구나.', 'Artus… Lucian’s lingering malice still chains your knightly soul.'],
      ['R', '카단… 네 빛의 검으로 이 끝없는 전장의 악몽을 끊어 다오!', 'Kadan… Sever this endless nightmare of war with your blade of light!'],
      ['L', '약속하마, 아르투스! 지킬 만한 가치가 있는 새 세상을 보여주며 네게 안식을 주겠다!', 'I swear it, Artus! I’ll grant you true knightly rest beneath a world worth protecting!'],
    ],
    victoryKo: '편히 잠들어라, 숙적이자 진정한 무인이여… 이제 세상에 평화의 바람이 분다.',
    victoryEn: 'Rest in peace, fierce rival and true knight… A wind of peace now blows across the land.',
  },
  40: {
    leftNameEn: 'Kadan of Elwin',
    rightNameEn: 'Paladin Hercul',
    lines: [
      ['R', '하하하! 18년 전 눈보라 속 갓난아이가 대륙을 구한 성기사가 되었구나, 카단!', 'Hahaha! The infant from eighteen winters ago now stands as savior of the realm, Kadan!'],
      ['L', '헤르쿨 스승님, 그리고 모든 동료들이 함께해 준 덕분입니다!', 'Only because you and all our companions walked beside me, Master Hercul!'],
      ['R', '영웅이라 불리지 않아도 좋다—새로운 시대를 여는 기념 수련전, 한 판 겨루어 볼까!', 'No need for grand titles—shall we celebrate the new dawn with one friendly spar?!'],
      ['L', '기꺼이 받아들이겠습니다! 엘윈마을과 우리의 새로운 여정을 위하여!', 'Gladly, Master Hercul! For Elwin Village and the new journey ahead!'],
    ],
    victoryKo: '고마워요, 모두들! 영웅이라 불리지 않아도, 우리가 지킨 이 따뜻한 세상을 영원히 사랑할 거야!',
    victoryEn: 'Thank you, everyone! Even uncalled a hero, I’ll cherish this warm world we protected forever!',
  },
};

export function getStoryEpisodeEncounter(episode: number): StoryEpisodeEncounterSpec {
  const safeEp = Math.max(0, Math.min(40, Math.round(episode || 0)));
  const epKo = getJourneyEpisodeDef(safeEp, true);
  const seed = EPISODE_DIALOGUE_SEEDS[safeEp] || EPISODE_DIALOGUE_SEEDS[1];

  const leftNameKo = epKo.playerHeroSpec.heroNameKo;
  const rightNameKo = epKo.bossHeroSpec.heroNameKo || epKo.bossNameKo;
  const leftNameEn = seed.leftNameEn;
  const rightNameEn = seed.rightNameEn;

  const leftSpriteUrl = resolveDialogueSpriteUrl(epKo.playerHeroSpec.portraitUrl);
  const rightSpriteUrl = resolveDialogueSpriteUrl(
    epKo.bossHeroSpec.portraitUrl || epKo.bossCutoutUrl,
  );

  const lines: StoryDialogueTurn[] = seed.lines.slice(0, 6).map(([side, textKo, textEn]) => ({
    side: side === 'L' ? 'LEFT' : 'RIGHT',
    speakerKo: side === 'L' ? leftNameKo : rightNameKo,
    speakerEn: side === 'L' ? leftNameEn : rightNameEn,
    textKo,
    textEn,
  }));

  return {
    episode: safeEp,
    leftNameKo,
    leftNameEn,
    leftSpriteUrl,
    rightNameKo,
    rightNameEn,
    rightSpriteUrl,
    lines,
    rewardItem: STORY_RELICS_BY_EPISODE[safeEp] || null,
    victoryMentKo: seed.victoryKo,
    victoryMentEn: seed.victoryEn,
  };
}
