import { CLASSIC_HEROES, HeroClass, KadanTacticalStance, PlayerProfile, ScreenName } from '../types';
import type { LiveBattleHelpSnapshot } from '../components/KadanChatbotWidget';

export interface LocalLlmCapability {
  supported: boolean;
  hasPromptApi: boolean;
  hasWebGpu: boolean;
  hasSpeechRecognition: boolean;
  engineLabelKo: string;
  engineLabelEn: string;
}

export interface LocalLlmResponse {
  answer: string;
  source: 'ON_DEVICE_PROMPT_API' | 'LOCAL_KNOWLEDGE_ENGINE';
}

interface PromptApiLanguageModelGlobal {
  availability?: () => Promise<string>;
  create?: (options?: {
    initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    systemPrompt?: string;
    temperature?: number;
    topK?: number;
  }) => Promise<{
    prompt: (text: string) => Promise<string>;
    destroy?: () => void;
  }>;
}

function getPromptApiHandle(): PromptApiLanguageModelGlobal | null {
  const g = globalThis as unknown as {
    LanguageModel?: PromptApiLanguageModelGlobal;
    ai?: { languageModel?: PromptApiLanguageModelGlobal };
  };
  if (g.LanguageModel && typeof g.LanguageModel.create === 'function') {
    return g.LanguageModel;
  }
  if (g.ai?.languageModel && typeof g.ai.languageModel.create === 'function') {
    return g.ai.languageModel;
  }
  return null;
}

export function getSpeechRecognitionCtor(): (new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as ReturnType<
    typeof getSpeechRecognitionCtor
  >;
}

/**
 * Detects whether the current browser can drive an on-device / local LLM
 * (Chrome Built-in Prompt API `LanguageModel` / `window.ai.languageModel` OR WebGPU).
 */
export async function detectLocalLlmCapability(): Promise<LocalLlmCapability> {
  const speechCtor = getSpeechRecognitionCtor();
  const hasSpeechRecognition = Boolean(speechCtor);
  const hasWebGpu = typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean((navigator as { gpu?: unknown }).gpu);

  let hasPromptApi = false;
  const promptHandle = getPromptApiHandle();
  if (promptHandle) {
    try {
      if (typeof promptHandle.availability === 'function') {
        const avail = String(await promptHandle.availability()).toLowerCase();
        hasPromptApi = avail !== 'unavailable' && avail !== 'no';
      } else {
        hasPromptApi = true;
      }
    } catch {
      hasPromptApi = false;
    }
  }

  const supported = hasPromptApi || hasWebGpu;
  return {
    supported,
    hasPromptApi,
    hasWebGpu,
    hasSpeechRecognition,
    engineLabelKo: hasPromptApi
      ? '온디바이스 Gemini Nano'
      : hasWebGpu
        ? '로컬 WebGPU AI'
        : '전술 도우미',
    engineLabelEn: hasPromptApi
      ? 'On-Device Nano LLM'
      : hasWebGpu
        ? 'Local WebGPU AI'
        : 'Tactical Assistant',
  };
}

function buildSystemPrompt(opts: {
  isKo: boolean;
  screen: ScreenName;
  profile: PlayerProfile;
  tacticalStance: KadanTacticalStance | string;
  battleSnapshot: LiveBattleHelpSnapshot | null;
}): string {
  const { isKo, screen, profile, tacticalStance, battleSnapshot } = opts;
  const battleSummary = battleSnapshot
    ? `Turn ${battleSnapshot.turnNumber}, Your Turn=${battleSnapshot.isPlayerTurn}, Mana ${battleSnapshot.playerMana}/${battleSnapshot.playerMaxMana}, Player HP=${battleSnapshot.playerHealth}, Enemy(${battleSnapshot.opponentName}) HP=${battleSnapshot.opponentHealth}, Playable Cards=[${battleSnapshot.handCards
        .filter((c) => c.playable)
        .map((c) => `${c.name}(${c.cost})`)
        .join(', ')}], Enemy Taunts=[${battleSnapshot.enemyTauntNames.join(', ')}]`
    : 'Not currently in a battle.';

  if (isKo) {
    return [
      '당신은 웹 전략 카드게임 [눈히어로(SNSHero)]의 주인공 성기사 "카단" AI 도우미입니다.',
      '규칙 요약: 총 382장 카드(9종족 × 25장 + 중립 157장), 40화 풀보이스 스토리모드, 1배수 공정 랭킹전, 9종족 AI대전.',
      '핵심 성장: 스토리모드 전용 [3장=3배 각성] 법칙 (동일 카드 3장 보유 시 공격력/생명력 3배, N환생 시 추가 비례 상승). 팩 천장: 10팩마다 24K 전설 100% 확정.',
      '동료 스킬: 좌측 하단 요정 실리아 3등신 필살기(바람 결계 보호막/스탯 버프, 녹풍 참격 광역 피해, 생명의 미풍 회복/방어도 — 환생할수록 강화).',
      '스토리 전용 [카단의 기세]: 스토리 모드 자동플레이 ON 시 실리아와 카단 사이 하단 중앙에 BGM 맥박과 동기화된 [카단의 기세] 수축 링이 표시됨(랭킹/연습/도박장 모드에서는 비활성). 마구 연타하면 +1씩 쌓이고, 초록색(TAP+10) 타이밍에 맞춰 터치(또는 Space 키)하면 한 번에 +10이 쌓임. 10배수(X10, X20, X30…) 돌파 시마다 카단의 눈보라 광역 필살기가 발동하고 직후 실리아의 무작위 바람풍 필살기가 연속 발동함.',
      '유저의 질문에 친절하고 간결하게 2~4문장 이내의 한국어로 답하세요.',
      `현재 상태: 화면=${screen}, 골드=${profile.gold}G, 가루=${profile.arcaneDust}, 보유팩=${profile.packs}, 여정=${profile.journeyEpisode}화(환생 ${profile.journeyReincarnation}회), 카단전술=${tacticalStance}. ${battleSummary}`,
    ].join('\n');
  }

  return [
    'You are Paladin Kadan, the helpful on-device AI guide inside the web card battle game SNSHero.',
    'Game facts: 382 collectible cards (9 factions x 25 + 157 neutral), 40-episode full-voice Story Mode, fair 1x Ranked Mode, 9-Faction AI Practice.',
    'Core systems: Story Mode [3 Copies = 3x Power] awakening rule (NG+ Reincarnation scales stats further), Guaranteed Legendary within 10 card packs, bottom-left Chibi Silia Ultimate Skills (Wind Barrier, Gale Slash, Vital Breeze scaling with Reincarnation), and Story-exclusive Auto-Play [Kadan\'s Spirit] beat ring at bottom-center (mash anytime for +1 stack per tap, or tap on GREEN / Spacebar for +10 stacks at once; crossing every 10-multiple X10/X20 triggers Kadan\'s Blizzard Ultimate followed immediately by Silia\'s random Windstorm Ultimate).',
    'Answer concisely in 2-4 friendly English sentences.',
    `Live context: Screen=${screen}, Gold=${profile.gold}G, Dust=${profile.arcaneDust}, Packs=${profile.packs}, Story=EP.${profile.journeyEpisode}(NG+${profile.journeyReincarnation}), Stance=${tacticalStance}. ${battleSummary}`,
  ].join('\n');
}

function answerWithBuiltInSnsHeroKnowledge(
  question: string,
  opts: {
    isKo: boolean;
    screen: ScreenName;
    profile: PlayerProfile;
    battleSnapshot: LiveBattleHelpSnapshot | null;
  },
): string {
  const { isKo, profile, battleSnapshot } = opts;
  const q = question.toLowerCase();

  if (/기세|정박|링|스택|x10|x20|초록|빨강|눈보라|리듬|박자|연타|spirit|rhythm|ring|stack|blizzard|green|mash/i.test(q)) {
    return isKo
      ? `[카단의 기세]는 스토리 모드 자동플레이 전용 각성 시스템입니다! 실리아와 저 사이 하단 중앙 링을 마구 눌러도 +1씩 쌓이고, 🟢 초록색(TAP+10) 정박 타이밍에 맞춰 누르면 한 번에 +10이 쌓여 10배수(X10·X20·X30…)마다 제 눈보라 광역 필살기와 실리아의 바람풍 필살기가 연속으로 작렬합니다!`
      : `[Kadan's Spirit] is exclusive to Story Mode Auto-Play! Mash the bottom-center ring anytime for +1 stack per tap, or hit right on GREEN (TAP+10) for +10 stacks at once—crossing every 10-multiple (X10·X20·X30…) unleashes my Blizzard Ultimate + Silia's Windstorm Ultimate back-to-back!`;
  }

  if (/실리아|필살기|바람|녹풍|결계|미풍|silia|ult|barrier|gale|breeze/i.test(q)) {
    return isKo
      ? `요정 실리아는 스토리모드 좌측 하단에서 매 턴 1회 필살기(바람 결계 아군 방어막 · 녹풍 참격 적 전체 피해 · 생명의 미풍 영웅 회복)를 시전합니다! 현재 ${profile.journeyReincarnation}환생 기준이며 환생 횟수가 오를수록 스탯 버프·광역 피해·회복량이 함께 강화됩니다.`
      : `Silia (bottom-left in Story Mode) casts 1 Ultimate per turn: Wind Barrier (shields allies), Gale Slash (damages all enemy minions), or Vital Breeze (heals hero). You are currently NG+${profile.journeyReincarnation}—each Reincarnation further amplifies her Ultimates!`;
  }

  if (/3배|각성|중복|3장|배수|환생|awaken|3x|copy|reincarnat/i.test(q)) {
    return isKo
      ? `스토리모드에서는 같은 카드를 3장 모으면 [3장=3배 각성]이 발동해 공격력과 생명력이 3배 이상 폭증합니다! 40화를 모두 클리어하고 환생(NG+)하면 6배·9배로 계속 강해지며, 랭킹대전은 공정성을 위해 항상 1배수로 진행됩니다.`
      : `In Story Mode, owning 3+ copies of a card activates [3 Copies = 3x Power], multiplying its Attack & Health 3x+ (and even higher after NG+ Reincarnation at EP.40). Ranked battles stay strictly 1x for fair competition!`;
  }

  if (/팩|전설|천장|뽑기|골드|가루|제작|pack|legendary|pity|gold|dust|craft/i.test(q)) {
    return isKo
      ? `현재 ${profile.gold}G · ${profile.arcaneDust} 가루 · ${profile.packs}팩을 보유 중이세요! 카드팩은 10팩마다 24K 전설 카드가 100% 확정 등장하며, 남는 가루로 [내 카드첩]에서 원하는 카드를 직접 제작(일반40/희귀100/특급400/전설1600)할 수 있습니다.`
      : `You currently have ${profile.gold}G, ${profile.arcaneDust} Dust, and ${profile.packs} Pack(s). A Legendary card is 100% guaranteed within every 10 packs, and you can craft missing cards anytime in Collection!`;
  }

  if (/종족|영웅|추천|덱|이그니스|아르투스|포세이돈|펜릴|에일라|콜로서스|아이언포지|토람|faction|race|hero|deck|class/i.test(q)) {
    const sampleHeroes = (Object.keys(CLASSIC_HEROES) as HeroClass[])
      .slice(0, 4)
      .map((c) => (isKo ? `${CLASSIC_HEROES[c].classNameKo}(${CLASSIC_HEROES[c].nameKo})` : CLASSIC_HEROES[c].nameKo))
      .join(', ');
    return isKo
      ? `눈히어로에는 9대 종족 영웅(${sampleHeroes} 등)과 총 382장의 카드가 있습니다! 안정적인 역전극은 인간 카단·땅 콜로서스, 빠른 명치 압박은 불 이그니스·바람 토람, 주문/콤보는 물 포세이돈·언데드 아르투스를 추천해요.`
      : `SNSHero features 9 unique factions and 382 cards! Try Human Kadan or Earth Colossus for iron defense, Fire Ignis or Wind Toram for fast aggro, or Water Poseidon / Undead Artus for spell combos.`;
  }

  if (/소설|웹툰|스토리|몇화|챕터|알렉산|루시안|말라카이|novel|webtoon|story|lore|episode/i.test(q)) {
    return isKo
      ? `현재 카단의 여정 제${profile.journeyEpisode}화 진행 중이시네요! 원작 웹소설(1~40화 완결)과 40부작 웹툰은 /book.html · /webtoon.html 에서 무료로 감상할 수 있고, [내 카드첩] 카드를 확대하면 해당 영웅의 소설 명장면 회차로 바로 이어집니다!`
      : `You're on Story EP.${profile.journeyEpisode}! Read the full 40-chapter official novel at /book.html or the Webtoon at /webtoon.html, or zoom any card in your Collection to jump straight to its story chapter!`;
  }

  if (/퀘스트|의뢰|보상|수령|일일|quest|reward|claim|daily/i.test(q)) {
    return isKo
      ? `로비 상단 [의뢰 일지]를 열어 [의뢰] 탭에서 완료된 의뢰 카드를 직접 클릭하면 +20G 추가 보너스를 즉시 받을 수 있고, AI대전 9종족 숙련 AI를 모두 제압하면 보너스 2팩도 지급됩니다!`
      : `Open [Quest Log] from the Hub and click any completed quest card directly to claim +20G bonus Gold! Defeating all 9 Expert AI races also awards +2 bonus Card Packs.`;
  }

  if (battleSnapshot && /지금|어떻게|뭐내|공략|이기|힌트|도움|도와|상황|turn|play|hint|help|win/i.test(q)) {
    const playable = battleSnapshot.handCards.filter((c) => c.playable);
    if (battleSnapshot.enemyTauntNames.length > 0) {
      return isKo
        ? `적 도발 하수인(${battleSnapshot.enemyTauntNames[0]})이 가로막고 있어요! 내 마나 ${battleSnapshot.playerMana} 내에서 도발부터 제거한 뒤 본체를 공략해 보세요.`
        : `Enemy Taunt (${battleSnapshot.enemyTauntNames[0]}) is blocking the way! Clear it first with your ${battleSnapshot.playerMana} Mana before pushing Hero damage.`;
    }
    if (playable.length > 0) {
      const top = [...playable].sort((a, b) => b.cost - a.cost)[0];
      return isKo
        ? `현재 마나 ${battleSnapshot.playerMana}로 [${top.name}(${top.cost}마나)] 카드를 낼 수 있어요! 초록 테두리가 뜬 카드를 먼저 전개하거나 [자동플레이]를 켜면 제가 이어서 지휘하겠습니다.`
        : `With ${battleSnapshot.playerMana} Mana available, [${top.name} (${top.cost})] is a strong play right now—or toggle Auto-Play and I will pilot the turn!`;
    }
  }

  return isKo
    ? `눈히어로(382종 카드 · 9종족 · 40화 스토리모드)에 대해 궁금한 점—예: '3배 각성 규칙 알려줘', '실리아 필살기 뭐야?', '전설 몇 팩 확정?', '종족 덱 추천해줘'—을 자유롭게 물어보세요!`
    : `Ask me anything about SNSHero (382 cards, 9 factions, 40-EP Story Mode)—for example: 'How does 3x Awakening work?', 'Explain Silia Ultimates', or 'Best starter faction?'!`;
}

/**
 * Queries the browser's on-device LLM (`LanguageModel` / `window.ai.languageModel`) when available,
 * seamlessly falling back to the built-in SNSHero context-aware responder if Prompt API isn't ready.
 */
export async function askLocalLlmAssistant(
  question: string,
  opts: {
    isKo: boolean;
    screen: ScreenName;
    profile: PlayerProfile;
    tacticalStance: KadanTacticalStance | string;
    battleSnapshot: LiveBattleHelpSnapshot | null;
  },
): Promise<LocalLlmResponse> {
  const cleanQ = question.trim();
  const promptHandle = getPromptApiHandle();

  if (promptHandle?.create) {
    try {
      const avail =
        typeof promptHandle.availability === 'function'
          ? String(await promptHandle.availability()).toLowerCase()
          : 'available';
      if (avail === 'available' || avail === 'readily') {
        const systemPrompt = buildSystemPrompt(opts);
        const session = await promptHandle.create({
          initialPrompts: [{ role: 'system', content: systemPrompt }],
          systemPrompt,
          temperature: 0.5,
          topK: 3,
        });
        try {
          const reply = (await session.prompt(cleanQ))?.trim();
          if (reply) {
            return {
              answer: reply.slice(0, 340),
              source: 'ON_DEVICE_PROMPT_API',
            };
          }
        } finally {
          session.destroy?.();
        }
      }
    } catch {
      // Fall back safely to local knowledge engine
    }
  }

  return {
    answer: answerWithBuiltInSnsHeroKnowledge(cleanQ, opts),
    source: 'LOCAL_KNOWLEDGE_ENGINE',
  };
}
