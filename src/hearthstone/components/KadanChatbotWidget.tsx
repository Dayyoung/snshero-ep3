import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Check, Copy, Mic, MicOff, SquarePen, X } from 'lucide-react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { useIsNarrationActive } from '../services/narrationVisibility';
import {
  LocalLlmCapability,
  askLocalLlmAssistant,
  detectLocalLlmCapability,
  getSpeechRecognitionCtor,
} from '../services/localLlmAssistant';
import {
  CLASSIC_HEROES,
  GameMode,
  HeroClass,
  KadanTacticalStance,
  PlayerProfile,
  ScreenName,
} from '../types';

export interface LiveBattleHelpSnapshot {
  mode: GameMode;
  turnNumber: number;
  isPlayerTurn: boolean;
  phase: string;
  playerMana: number;
  playerMaxMana: number;
  playerHealth: number;
  opponentHealth: number;
  opponentName: string;
  handCards: {
    name: string;
    cost: number;
    type: 'MINION' | 'SPELL' | 'WEAPON' | 'HERO' | 'HERO_POWER';
    playable: boolean;
    text: string;
  }[];
  readyAttackersCount: number;
  enemyTauntNames: string[];
  canUseHeroPower: boolean;
  journeyEpisode?: number;
}

export interface KadanChatbotWidgetProps {
  screen: ScreenName;
  profile: PlayerProfile;
  selectedMode: GameMode;
  autoPlay: boolean;
  battleSnapshot: LiveBattleHelpSnapshot | null;
  onEnableAutoPlay: () => void;
  onDisableAutoPlay: () => void;
  onNavigateScreen: (target: ScreenName, modeOverride?: GameMode) => void;
  onStartJourney: () => void;
  onOpenShop: () => void;
  onOpenQuestLog: () => void;
  tacticalStance?: KadanTacticalStance;
  onChangeTacticalStance?: (stance: KadanTacticalStance) => void;
}

interface HelpOptionItem {
  id: string;
  icon: string;
  label: string;
  subLabel?: string;
  highlight?: 'autoplay' | 'nav' | 'tip';
  onSelect: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: 'ON_DEVICE_PROMPT_API' | 'LOCAL_KNOWLEDGE_ENGINE';
  createdAt: number;
}

const IDLE_FRAMES = [
  '/hs-assets/kadan-bot/idle_01.webp',
  '/hs-assets/kadan-bot/idle_02.webp',
  '/hs-assets/kadan-bot/idle_03.webp',
  '/hs-assets/kadan-bot/idle_04.webp',
];

const RUN_FRAMES = [
  '/hs-assets/kadan-bot/run_01.webp',
  '/hs-assets/kadan-bot/run_02.webp',
  '/hs-assets/kadan-bot/run_03.webp',
  '/hs-assets/kadan-bot/run_04.webp',
];

const SILIA_CO_CAST_FRAMES: Record<'ATTACK' | 'DEFENSE' | 'HEAL', string[]> = {
  ATTACK: [
    '/hs-assets/silia-bot/cast_attack_01.webp',
    '/hs-assets/silia-bot/cast_attack_02.webp',
  ],
  DEFENSE: [
    '/hs-assets/silia-bot/cast_defense_01.webp',
    '/hs-assets/silia-bot/cast_defense_02.webp',
  ],
  HEAL: [
    '/hs-assets/silia-bot/cast_heal_01.webp',
    '/hs-assets/silia-bot/cast_heal_02.webp',
  ],
};

function makeMsgId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const KadanChatbotWidget: React.FC<KadanChatbotWidgetProps> = ({
  screen,
  profile,
  selectedMode,
  autoPlay,
  battleSnapshot,
  onEnableAutoPlay,
  onDisableAutoPlay,
  onNavigateScreen,
  onStartJourney,
  onOpenShop,
  onOpenQuestLog,
  tacticalStance = 'BALANCED',
  onChangeTacticalStance,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const isNarrationActive = useIsNarrationActive();

  const [frameIdx, setFrameIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [transientToast, setTransientToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tacticInput, setTacticInput] = useState('');
  const [llmCap, setLlmCap] = useState<LocalLlmCapability>({
    supported: false,
    hasPromptApi: false,
    hasWebGpu: false,
    hasSpeechRecognition: false,
    engineLabelKo: '',
    engineLabelEn: '',
  });
  const [llmLoading, setLlmLoading] = useState(false);
  const [micListening, setMicListening] = useState(false);
  const [siliaCoCastSkill, setSiliaCoCastSkill] = useState<'ATTACK' | 'DEFENSE' | 'HEAL' | null>(
    null,
  );

  const kadanRootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const onDualCast = (ev: Event) => {
      const detail = (ev as CustomEvent<{ skillKind?: 'ATTACK' | 'DEFENSE' | 'HEAL' }>).detail;
      setSiliaCoCastSkill(detail?.skillKind || 'ATTACK');
    };
    window.addEventListener('snshero:dual-ultimate-cast', onDualCast as EventListener);
    return () => {
      window.removeEventListener('snshero:dual-ultimate-cast', onDualCast as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!siliaCoCastSkill) return;
    const t = window.setTimeout(() => setSiliaCoCastSkill(null), 1950);
    return () => window.clearTimeout(t);
  }, [siliaCoCastSkill]);

  useEffect(() => {
    let active = true;
    detectLocalLlmCapability().then((cap) => {
      if (active) setLlmCap(cap);
    });
    return () => {
      active = false;
      recognitionRef.current?.stop();
    };
  }, []);

  // Scroll smoothly to bottom whenever a new message arrives or loading state toggles
  useEffect(() => {
    if (!menuOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, llmLoading, menuOpen]);

  // Close ChatGPT window on outside click (desktop) or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsidePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      const inAvatar = kadanRootRef.current?.contains(target);
      const inPopover = popoverRef.current?.contains(target);
      if (!inAvatar && !inPopover) {
        recognitionRef.current?.stop();
        setMicListening(false);
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        recognitionRef.current?.stop();
        setMicListening(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const appendExchange = useCallback(
    (
      userPrompt: string | null,
      assistantText: string,
      source?: 'ON_DEVICE_PROMPT_API' | 'LOCAL_KNOWLEDGE_ENGINE',
    ) => {
      const now = Date.now();
      setMessages((prev) => {
        const next = [...prev];
        if (userPrompt) {
          next.push({
            id: makeMsgId('usr'),
            role: 'user',
            text: userPrompt,
            createdAt: now,
          });
        }
        next.push({
          id: makeMsgId('bot'),
          role: 'assistant',
          text: assistantText,
          source,
          createdAt: now + 1,
        });
        return next;
      });
    },
    [],
  );

  const applyTacticalCommand = (
    stance: KadanTacticalStance,
    customReplyKo?: string,
    customReplyEn?: string,
    userPromptText?: string,
  ) => {
    hsAudio.playSfx('ui_click', 0.8);
    onChangeTacticalStance?.(stance);
    const defaultKo =
      stance === 'AGGRO'
        ? '맹공(공격적) 전술로 전환했습니다! 적 영웅 본체 타격과 돌진 주문을 최우선으로 전개할게요.'
        : stance === 'CONTROL'
          ? '수비·통제 전술로 전환했습니다! 위험한 적 하수인 제압과 도발·생명력 회복을 최우선으로 지휘합니다.'
          : stance === 'AWAKENING'
            ? '각성연계 전술로 전환했습니다! 3배 각성 에이스와 피니셔 콤보 타이밍에 화력을 집중할게요.'
            : '균형 전술로 전환했습니다! 현재 전황에 맞춰 가장 유리한 수를 두겠습니다.';
    const defaultEn =
      stance === 'AGGRO'
        ? 'Switched to Aggro Mode! Prioritizing enemy Hero face damage and rush bursts.'
        : stance === 'CONTROL'
          ? 'Switched to Control Mode! Clearing high-threat minions, Taunts, and healing first.'
          : stance === 'AWAKENING'
            ? 'Switched to Awakening Combo! Holding key buffs for ×3 power turns.'
            : 'Switched to Balanced Mode! Adapting optimally to the board.';
    const finalText = isKo ? customReplyKo || defaultKo : customReplyEn || defaultEn;
    if (menuOpen) {
      appendExchange(userPromptText ?? null, finalText);
    } else {
      setTransientToast(finalText);
    }
  };

  const processUserQueryOrCommand = useCallback(
    async (rawText: string) => {
      const cleaned = rawText.trim();
      if (!cleaned) return;
      const q = cleaned.toLowerCase();
      setTacticInput('');

      const looksLikeQuestion =
        /[?？]|뭐야|무엇|알려|설명|어떻게|몇|추천|방법|규칙|차이|왜|언제|누구|스토리|실리아|3배|각성|전설|팩|퀘스트|의뢰|종족|what|how|why|when|who|which|explain|tell|recommend/i.test(
          q,
        );

      if (screen === 'BATTLE' && !looksLikeQuestion) {
        if (/공격|맹공|명치|돌진|빨리|aggro|face|rush|attack/i.test(q)) {
          applyTacticalCommand('AGGRO', undefined, undefined, cleaned);
          if (!autoPlay) onEnableAutoPlay();
          return;
        }
        if (/수비|방어|막아|살려|도발|회복|통제|control|defen|taunt|heal/i.test(q)) {
          applyTacticalCommand('CONTROL', undefined, undefined, cleaned);
          if (!autoPlay) onEnableAutoPlay();
          return;
        }
        if (/아껴|콤보|연계|존버|combo|save|awakening\s*mode/i.test(q)) {
          applyTacticalCommand('AWAKENING', undefined, undefined, cleaned);
          if (!autoPlay) onEnableAutoPlay();
          return;
        }
        if (/정지|멈춰|수동|stop|manual|off/i.test(q)) {
          onDisableAutoPlay();
          appendExchange(
            cleaned,
            tr(
              '자동플레이를 중지했습니다. 이제 직접 카드를 선택해 지휘해 주세요.',
              'Auto-Play paused. Manual control is now active.',
            ),
          );
          return;
        }
        if (/자동|오토|auto/i.test(q)) {
          onEnableAutoPlay();
          appendExchange(
            cleaned,
            tr(
              '자동플레이를 시작합니다! 제가 턴을 이어서 지휘할게요.',
              'Auto-Play started! I will command the turns for you.',
            ),
          );
          return;
        }
      }

      // Append user bubble immediately & show thinking indicator (ChatGPT style)
      const userMsg: ChatMessage = {
        id: makeMsgId('usr'),
        role: 'user',
        text: cleaned,
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      hsAudio.playSfx('ui_click', 0.65);
      setLlmLoading(true);
      try {
        const res = await askLocalLlmAssistant(cleaned, {
          isKo,
          screen,
          profile,
          tacticalStance,
          battleSnapshot,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: makeMsgId('bot'),
            role: 'assistant',
            text: res.answer,
            source: res.source,
            createdAt: Date.now(),
          },
        ]);
      } finally {
        setLlmLoading(false);
      }
    },
    [
      screen,
      autoPlay,
      isKo,
      profile,
      tacticalStance,
      battleSnapshot,
      onEnableAutoPlay,
      onDisableAutoPlay,
      appendExchange,
    ],
  );

  const handleTacticInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void processUserQueryOrCommand(tacticInput);
  };

  const handleToggleMic = () => {
    hsAudio.playSfx('ui_click', 0.8);
    if (micListening) {
      recognitionRef.current?.stop();
      setMicListening(false);
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      inputRef.current?.focus();
      appendExchange(
        null,
        tr(
          '이 환경에서는 브라우저 마이크 음성 인식이 비활성화되어 있습니다. 아래 입력창에 질문을 입력해 주세요.',
          'Voice input is unavailable in this browser. Please type your question below.',
        ),
      );
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = isKo ? 'ko-KR' : 'en-US';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      let latestTranscript = '';
      rec.onresult = (ev) => {
        const res = ev.results?.[0];
        const transcript = res?.[0]?.transcript || '';
        latestTranscript = transcript;
        setTacticInput(transcript);
        if ((res as { isFinal?: boolean })?.isFinal && transcript.trim()) {
          rec.stop();
          setMicListening(false);
          void processUserQueryOrCommand(transcript);
        }
      };
      rec.onerror = () => {
        setMicListening(false);
        appendExchange(
          null,
          tr(
            '음성을 인식하지 못했습니다. 마이크 권한을 확인하거나 직접 입력해 주세요.',
            'Could not capture voice. Check mic permissions or type directly.',
          ),
        );
      };
      rec.onend = () => {
        setMicListening(false);
        if (latestTranscript.trim()) {
          void processUserQueryOrCommand(latestTranscript);
        }
      };
      recognitionRef.current = rec;
      setMicListening(true);
      rec.start();
    } catch {
      setMicListening(false);
      inputRef.current?.focus();
    }
  };

  // Preload sprite frames
  useEffect(() => {
    [
      ...IDLE_FRAMES,
      ...RUN_FRAMES,
      ...SILIA_CO_CAST_FRAMES.ATTACK,
      ...SILIA_CO_CAST_FRAMES.DEFENSE,
      ...SILIA_CO_CAST_FRAMES.HEAL,
    ].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    setFrameIdx(0);
    const intervalMs = autoPlay ? 150 : 760;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setFrameIdx((prev) => (prev + 1) % 4);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoPlay]);

  useEffect(() => {
    if (autoPlay) {
      setMenuOpen(false);
    }
  }, [autoPlay]);

  useEffect(() => {
    if (!transientToast) return;
    const t = window.setTimeout(() => setTransientToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [transientToast]);

  const replyInChat = useCallback(
    (promptLabel: string, msgKo: string, msgEn: string) => {
      hsAudio.playSfx('ui_click', 0.7);
      appendExchange(promptLabel, isKo ? msgKo : msgEn);
    },
    [appendExchange, isKo],
  );

  const handleKadanClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hsAudio.playSfx('ui_click', 0.8);

    if (autoPlay) {
      onDisableAutoPlay();
      setMenuOpen(false);
      setTransientToast(
        tr(
          '자동플레이를 멈추고 제자리에 섰어요. 다시 누르면 카단 AI 챗봇이 열립니다.',
          'Auto-Play stopped. Tap again to open Kadan AI chat.',
        ),
      );
      return;
    }

    setTransientToast(null);
    setMenuOpen((prev) => !prev);
  };

  const helpOptions = useMemo<HelpOptionItem[]>(() => {
    const autoPlayOption: HelpOptionItem = {
      id: 'autoplay_start',
      icon: '⚡',
      label: tr('자동플레이 실행하기', 'Start Auto-Play'),
      subLabel: tr('카단이 대신 전장을 지휘합니다', 'Let Kadan command turns'),
      highlight: 'autoplay',
      onSelect: () => {
        hsAudio.playSfx('box_press', 0.85);
        setMenuOpen(false);
        setTransientToast(
          screen === 'BATTLE'
            ? tr(
                '자동플레이를 시작합니다! 멈추려면 달리는 카단을 클릭하세요.',
                'Auto-Play started! Tap running Kadan to pause.',
              )
            : tr(
                '전장으로 이동해 자동플레이로 대결을 시작합니다!',
                'Heading to battle with Auto-Play enabled!',
              ),
        );
        onEnableAutoPlay();
      },
    };

    if (screen === 'BATTLE') {
      const snap = battleSnapshot;
      const isStoryBattle = (snap?.mode ?? selectedMode) === 'TUTORIAL';
      return [
        autoPlayOption,
        ...(isStoryBattle
          ? [
              {
                id: 'battle_kadan_spirit_guide',
                icon: '🟢',
                label: tr('스토리 [카단의 기세] 활용법', "How to use [Kadan's Spirit]"),
                subLabel: tr('눈보라 + 실리아 합동 필살기', 'Blizzard + Silia Dual Ult'),
                highlight: 'tip' as const,
                onSelect: () =>
                  replyInChat(
                    tr('스토리 [카단의 기세] 활용법 알려줘', "How do I use [Kadan's Spirit]?"),
                    '스토리 자동플레이 중 하단 중앙 [카단의 기세] 링을 연타(+1)하거나 초록 정박(+10)에 맞춰 100을 채워보세요!\n100이 되면 버튼이 불타오르며 1초 점화 후 [🔥필살기!]로 변하고, 그때 누르면 제 눈보라 필살기와 실리아의 바람풍 필살기가 연속 발동합니다.',
                    "In Story Auto-Play, charge [Kadan's Spirit] to 100 via mash (+1) or GREEN beat (+10).\nAfter 1s ignition, tap the blazing orb to trigger my Blizzard + Silia's Windstorm Dual Ultimates!",
                  ),
              },
            ]
          : []),
        {
          id: 'battle_recommend_play',
          icon: '🃏',
          label: tr('지금 낼 수 있는 추천 카드', 'Best card to play now'),
          subLabel: tr('현재 마나·손패 기준 분석', 'Analyzes current mana & hand'),
          highlight: 'tip',
          onSelect: () => {
            const promptLbl = tr('지금 낼 수 있는 추천 카드 알려줘', 'Which card should I play right now?');
            if (!snap) {
              replyInChat(
                promptLbl,
                '전장 상태를 살피는 중이에요! 내 턴에 초록빛 테두리가 켜진 카드를 내면 마나에 맞춰 활약할 수 있습니다.',
                'Scanning the board! Play green-highlighted cards on your turn.',
              );
              return;
            }
            if (!snap.isPlayerTurn) {
              replyInChat(
                promptLbl,
                `지금은 ${snap.opponentName}의 턴입니다. 상대의 턴이 끝나고 내 턴이 오면 다시 물어봐 주세요.`,
                `It is ${snap.opponentName}'s turn right now. Ask me again when your turn starts!`,
              );
              return;
            }
            const playable = [...snap.handCards]
              .filter((c) => c.playable)
              .sort((a, b) => b.cost - a.cost);
            if (playable.length > 0) {
              const top = playable[0];
              const others =
                playable.length > 1
                  ? `\n(그 외 ${playable
                      .slice(1, 3)
                      .map((c) => `'${c.name}'`)
                      .join(', ')}도 사용 가능)`
                  : '';
              const cleanDesc = top.text.replace(/<[^>]+>/g, '').trim();
              replyInChat(
                promptLbl,
                `현재 마나(${snap.playerMana}/${snap.playerMaxMana}) 기준으로 '${top.name}'(${top.cost}마나) 카드를 먼저 내는 것을 추천합니다.\n${
                  cleanDesc ? `• 효과: ${cleanDesc}` : '• 전장 주도권을 잡기에 가장 좋은 선택입니다.'
                }${others}`,
                `With ${snap.playerMana}/${snap.playerMaxMana} Mana, I recommend playing '${top.name}' (${top.cost} Mana).\n${cleanDesc}`,
              );
            } else if (snap.canUseHeroPower) {
              replyInChat(
                promptLbl,
                `현재 마나(${snap.playerMana})로 낼 수 있는 손패가 없습니다. 영웅 능력(2마나)을 사용해 보세요!`,
                `No playable cards for ${snap.playerMana} Mana—use your Hero Power (2 Mana) instead!`,
              );
            } else if (snap.readyAttackersCount > 0) {
              replyInChat(
                promptLbl,
                `낼 수 있는 카드는 모두 사용했습니다. 전장의 초록빛 아군(${snap.readyAttackersCount}기)으로 공격한 뒤 [턴 종료]를 누르세요.`,
                `All cards played! Attack with your ${snap.readyAttackersCount} ready unit(s), then end your turn.`,
              );
            } else {
              replyInChat(
                promptLbl,
                `이번 턴(${snap.playerMana}마나)에 가능한 행동을 모두 마쳤습니다. [턴 종료] 버튼을 눌러 다음 턴으로 넘어가세요.`,
                `All actions complete for this turn. Press [End Turn] to proceed.`,
              );
            }
          },
        },
        {
          id: 'battle_attack_guide',
          icon: '⚔️',
          label: tr('이번 턴 공격 판단', 'How should I attack?'),
          subLabel: tr('도발 · 킬각 · 정리 가이드', 'Taunts & lethal guidance'),
          highlight: 'tip',
          onSelect: () => {
            const promptLbl = tr('지금 어떻게 공격하면 좋을까?', 'How should I attack this turn?');
            if (!snap) {
              replyInChat(
                promptLbl,
                '초록색 테두리가 빛나는 아군 하수인을 선택한 뒤, 적 하수인 또는 적 영웅을 클릭하면 공격합니다.',
                'Tap a green-glowing friendly minion, then tap an enemy minion or Hero to attack.',
              );
              return;
            }
            if (snap.enemyTauntNames.length > 0) {
              replyInChat(
                promptLbl,
                `적 전장에 도발 하수인(${snap.enemyTauntNames.join(', ')})이 있어 다른 대상을 먼저 공격할 수 없습니다. 주문이나 하수인으로 도발 하수인부터 제압하세요!`,
                `Enemy Taunt (${snap.enemyTauntNames.join(', ')}) is blocking! Clear Taunt minions first.`,
              );
            } else if (snap.readyAttackersCount > 0) {
              replyInChat(
                promptLbl,
                `도발 방해물이 없습니다! 공격 가능한 아군 ${snap.readyAttackersCount}기로 위험한 적 하수인을 정리하거나, 적 영웅(체력 ${snap.opponentHealth}) 본체를 노려보세요.`,
                `No Taunts! Strike threats or hit the enemy Hero (${snap.opponentHealth} HP) with your ${snap.readyAttackersCount} ready attacker(s).`,
              );
            } else {
              replyInChat(
                promptLbl,
                '방금 소환한 하수인은 한 턴 동안 대기(Zzz)합니다. [돌진] 능력이 있는 카드나 무기는 소환 즉시 공격할 수 있습니다.',
                'Newly summoned minions rest for 1 turn (Zzz) unless they have Charge—weapons can attack immediately.',
              );
            }
          },
        },
        {
          id: 'nav_packs_from_battle',
          icon: '🎁',
          label: tr('카드팩 개봉소로 이동', 'Go to Pack Opening'),
          subLabel: tr('3장=3배 각성 전력 보강', 'Collect 3 copies for 3x stats'),
          highlight: 'nav',
          onSelect: () => {
            setMenuOpen(false);
            onNavigateScreen('PACK_OPENING');
          },
        },
        {
          id: 'nav_hub_from_battle',
          icon: '🏠',
          label: tr('엘윈마을 로비로 나가기', 'Return to Elwin Hub'),
          subLabel: tr('메인 허브 화면으로 이동', 'Go back to the main hub'),
          highlight: 'nav',
          onSelect: () => {
            setMenuOpen(false);
            onNavigateScreen('BOX_HUB');
          },
        },
      ];
    }

    if (screen === 'COLLECTION') {
      return [
        autoPlayOption,
        {
          id: 'collection_deck_tip',
          icon: '✨',
          label: tr('강력한 30장 덱 짜는 비결', 'Build a strong 30-card deck'),
          subLabel: tr('마나 커브 · [자동 완성] 팁', 'Mana curve & Auto-Complete tips'),
          highlight: 'tip',
          onSelect: () =>
            replyInChat(
              tr('강력한 30장 덱 짜는 비결 알려줘', 'How do I build a strong 30-card deck?'),
              '1~3코스트 초반 하수인을 10장 이상 넣어야 초반 주도권을 뺏기지 않습니다.\n여기에 종족 전용 주문(마법 물보라·물의 창 등)과 무기, 고코스트 전설 카드를 균형 있게 채워보세요. [자동 완성] 기능도 추천합니다!',
              'Include 10+ low-cost (1–3 Mana) minions for early board control, mix in class spells/weapons and finishers, or use [Auto Complete].',
            ),
        },
        {
          id: 'collection_craft_tip',
          icon: '💎',
          label: tr('신비한 가루 제작·분해 도움말', 'Crafting & Dust guide'),
          subLabel: tr(`보유 가루 ${profile.dust}개`, `${profile.dust} Dust owned`),
          highlight: 'tip',
          onSelect: () =>
            replyInChat(
              tr('신비한 가루 제작·분해 도움말', 'How does Crafting & Dust work?'),
              `현재 보유 가루는 ${profile.dust}개입니다.\n상단 [제작 모드]를 켜면 보유하지 않은 카드도 가루로 즉시 제작할 수 있고, 남는 중복 카드는 분해해 가루를 확보할 수 있습니다.`,
              `You have ${profile.dust} Arcane Dust. Toggle [Crafting] to craft missing cards or disenchant duplicates.`,
            ),
        },
        {
          id: 'collection_go_packs',
          icon: '🎁',
          label: tr(`카드팩 개봉 이동 (${profile.packs}팩)`, `Open Packs (${profile.packs})`),
          subLabel: tr('새 카드 획득하러 이동', 'Open packs for new cards'),
          highlight: 'nav',
          onSelect: () => {
            setMenuOpen(false);
            onNavigateScreen('PACK_OPENING');
          },
        },
        {
          id: 'collection_go_play',
          icon: '⚔️',
          label: tr('영웅 선택 & 대전 이동', 'Hero Select & Battle'),
          subLabel: tr('완성한 덱으로 실전 출정', 'Take your deck into battle'),
          highlight: 'nav',
          onSelect: () => {
            setMenuOpen(false);
            onNavigateScreen('HERO_SELECT');
          },
        },
      ];
    }

    if (screen === 'PACK_OPENING') {
      return [
        autoPlayOption,
        {
          id: 'pack_3x_tip',
          icon: '🌟',
          label: tr('등급 · 3장=3배 각성 규칙', 'Rarities & 3x Awakening'),
          subLabel: tr('스토리모드 3배 스탯 법칙', '3+ copies = 3x stats in Story'),
          highlight: 'tip',
          onSelect: () =>
            replyInChat(
              tr('카드 등급과 3장=3배 각성 규칙 알려줘', 'Explain Card Rarities & 3x Awakening'),
              '카드 보석 색상은 하양(일반) → 파랑(희귀) → 보라(특급) → 주황(전설) 순서로 강력합니다.\n스토리모드 『카단의 여정』에서는 같은 카드를 3장 이상 모으면 공격력·생명력이 3배로 각성합니다!',
              'Gem rarities go Common (White) → Rare (Blue) → Epic (Purple) → Legendary (Orange). Owning 3+ copies grants 3x stats in Story Mode!',
            ),
        },
        {
          id: 'pack_gold_tip',
          icon: '🪙',
          label: tr('골드·카드팩 빠르게 모으기', 'Earn Gold & Packs fast'),
          subLabel: tr(`현재 ${profile.gold}G · ${profile.packs}팩`, `${profile.gold}G · ${profile.packs} packs`),
          highlight: 'tip',
          onSelect: () =>
            replyInChat(
              tr('골드와 팩은 어디서 모으나요?', 'How do I earn Gold & Packs fast?'),
              `현재 ${profile.gold}G와 ${profile.packs}팩을 보유 중입니다.\n스토리모드 5화마다 보스 팩을 받을 수 있고, 일일 의뢰와 보가트 도박장 9종족 제압 보너스로도 골드를 빠르게 모을 수 있습니다!`,
              `You have ${profile.gold}G and ${profile.packs} packs. Clear Story bosses every 5 episodes, Daily Quests, and Bogart 9-Faction challenges!`,
            ),
        },
        {
          id: 'pack_open_shop',
          icon: '🛒',
          label: tr('보급소(팩 구매) 열기', 'Open Supply Shop'),
          subLabel: tr('100G 팩 교환 및 상점', 'Buy packs with Gold'),
          highlight: 'nav',
          onSelect: () => {
            setMenuOpen(false);
            onOpenShop();
          },
        },
        {
          id: 'pack_go_collection',
          icon: '📚',
          label: tr('카드첩으로 이동', 'Open Collection'),
          subLabel: tr('뽑은 카드로 30장 덱 편집', 'Build decks with new cards'),
          highlight: 'nav',
          onSelect: () => {
            setMenuOpen(false);
            onNavigateScreen('COLLECTION');
          },
        },
      ];
    }

    if (screen === 'HERO_SELECT') {
      const racesKo = (Object.keys(CLASSIC_HEROES) as HeroClass[])
        .map((k) => `${CLASSIC_HEROES[k].classNameKo}(${CLASSIC_HEROES[k].nameKo})`)
        .slice(0, 5)
        .join(', ');
      return [
        autoPlayOption,
        {
          id: 'hero_race_guide',
          icon: '🛡️',
          label: tr('9대 종족별 카드 특징', '9 Hero Faction traits'),
          subLabel: tr('종족별 시너지와 강점 비교', 'Compare faction playstyles'),
          highlight: 'tip',
          onSelect: () =>
            replyInChat(
              tr('9대 종족별 카드 특징 알려줘', 'Tell me about the 9 Hero Factions'),
              `물(빙결·물보라), 불(화염 무기·돌파), 바람(속공·덫), 땅(수정 보호막), 인간(치유·성광), 언데드(맹독·기습), 엘프(정령석·번개), 드워프(용광로), 동물(마나 성장·대형 야수)까지 9대 종족의 개성이 뚜렷합니다.\n(${racesKo} 등)`,
              'Each of the 9 factions has unique mechanics: Water (freeze), Fire (burst), Wind (traps), Earth (shields), Human (heals), Undead (combos), Elf (overload), Dwarf (armor/forge), and Beast (ramp)!',
            ),
        },
        {
          id: 'hero_mode_guide',
          icon: '🏆',
          label: tr('현재 대전 모드 규칙', 'Current Battle Mode rules'),
          subLabel: tr('랭킹대전 · 보가트 도박장 안내', 'Ranked & Bogart Hall guide'),
          highlight: 'tip',
          onSelect: () =>
            replyInChat(
              tr('현재 대전 모드 특징 알려줘', 'Explain the battle modes'),
              selectedMode === 'RANKED'
                ? '랭킹대전은 다른 유저와의 실시간 1:1 매칭(친선 0G / 골드 내기)으로 별(★)을 모아 전설 등급까지 도전하는 공식 모드입니다.'
                : '보가트 도박장은 주사위 2개(1~12)로 자동 배팅액이 정해지며, 랜덤 9종족 대표와 겨뤄 승리 시 판돈 2배와 제압 보상을 획득하는 모드입니다!',
              selectedMode === 'RANKED'
                ? 'Ranked Arena matches you live against real opponents (Friendly or Gold wager) to climb the ladder!'
                : "Bogart's Hall rolls 2 dice (1–12) for an auto-bet against a random 9-Faction champion for 2x Gold!",
            ),
        },
        {
          id: 'hero_go_collection',
          icon: '📚',
          label: tr('카드첩에서 덱 편집', 'Edit Decks in Collection'),
          subLabel: tr('30장 덱 커스터마이징', 'Customize 30-card decks'),
          highlight: 'nav',
          onSelect: () => {
            setMenuOpen(false);
            onNavigateScreen('COLLECTION');
          },
        },
        {
          id: 'hero_go_hub',
          icon: '🏠',
          label: tr('엘윈마을 로비 이동', 'Back to Elwin Hub'),
          subLabel: tr('메인 허브로 돌아가기', 'Return to hub'),
          highlight: 'nav',
          onSelect: () => {
            setMenuOpen(false);
            onNavigateScreen('BOX_HUB');
          },
        },
      ];
    }

    // Default: BOX_HUB
    return [
      autoPlayOption,
      {
        id: 'hub_story_start',
        icon: '📖',
        label: tr(`카단의 여정 스토리 (제${profile.journeyEpisode}화)`, `Story Mode (EP.${profile.journeyEpisode})`),
        subLabel: tr('40화 대서사시 · 환생 도전', '40-episode saga & reincarnation'),
        highlight: 'nav',
        onSelect: () => {
          setMenuOpen(false);
          onStartJourney();
        },
      },
      {
        id: 'hub_ranked_go',
        icon: '⚔️',
        label: tr('실시간 랭킹대전 이동', 'Live Ranked Arena'),
        subLabel: tr('유저 1:1 실시간 매칭', 'Real-time PvP matchmaking'),
        highlight: 'nav',
        onSelect: () => {
          setMenuOpen(false);
          onNavigateScreen('HERO_SELECT', 'RANKED');
        },
      },
      {
        id: 'hub_card_basics',
        icon: '💡',
        label: tr('전투 규칙 & [카단의 기세] 팁', "Battle & [Kadan's Spirit] Tips"),
        subLabel: tr('초록 정박 · 실리아 합동 필살기', 'Green beat & Silia Dual Ult'),
        highlight: 'tip',
        onSelect: () =>
          replyInChat(
            tr('초보자 필수 카드 & [카단의 기세] 도움말', "Beginner Battle & [Kadan's Spirit] Tips"),
            '매 턴 마나로 하수인·주문·무기를 내어 적 영웅 체력을 0으로 만들면 승리합니다.\n스토리 자동플레이 중 [카단의 기세]를 연타(+1) · 초록 정박(+10)으로 100까지 채우고 1초 점화 후 누르면 제 눈보라와 실리아의 바람풍 필살기가 연속 발동합니다!',
            "Spend Mana on Minions, Spells & Weapons to drop the enemy Hero to 0 HP.\nIn Story Auto-Play, charge [Kadan's Spirit] to 100 and tap after 1s ignition to unleash Kadan + Silia Dual Ultimates!",
          ),
      },
      {
        id: 'hub_packs_go',
        icon: '🎁',
        label: tr(`카드팩 개봉 (${profile.packs}팩)`, `Open Packs (${profile.packs})`),
        subLabel: tr(`보유 ${profile.gold}G · 3장 모으면 3배 각성`, `${profile.gold}G · 3 copies = 3x stats`),
        highlight: 'nav',
        onSelect: () => {
          setMenuOpen(false);
          onNavigateScreen('PACK_OPENING');
        },
      },
      {
        id: 'hub_collection_go',
        icon: '📚',
        label: tr('382장 카드첩 & 덱 편성', '382-Card Collection'),
        subLabel: tr('9대 종족 카드 도감 및 덱 빌더', 'Browse all 382 cards & build'),
        highlight: 'nav',
        onSelect: () => {
          setMenuOpen(false);
          onNavigateScreen('COLLECTION');
        },
      },
      {
        id: 'hub_quests',
        icon: '📜',
        label: tr('일일 의뢰 & 전적 확인', 'Quests & Stats'),
        subLabel: tr('일일 골드 보상 미션 확인', 'Check daily gold rewards'),
        highlight: 'nav',
        onSelect: () => {
          setMenuOpen(false);
          onOpenQuestLog();
        },
      },
    ];
  }, [
    screen,
    battleSnapshot,
    profile.dust,
    profile.gold,
    profile.journeyEpisode,
    profile.packs,
    selectedMode,
    isKo,
    onEnableAutoPlay,
    onNavigateScreen,
    onStartJourney,
    onOpenShop,
    onOpenQuestLog,
    replyInChat,
  ]);

  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopiedId(msg.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === msg.id ? null : cur)), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCloseChat = () => {
    hsAudio.playSfx('ui_click', 0.45);
    recognitionRef.current?.stop();
    setMicListening(false);
    setMenuOpen(false);
  };

  const activeFrames = autoPlay ? RUN_FRAMES : IDLE_FRAMES;

  if (isNarrationActive) return null;

  // Render ChatGPT-style Modal via Portal so mobile fullscreen covers the entire 100dvh viewport cleanly
  const chatModalNode =
    menuOpen &&
    (() => {
      const modalContent = (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          data-testid="kadan-chatbot-popover"
          role="dialog"
          aria-modal="true"
          aria-label={tr('카단 AI 어시스턴트', 'Kadan AI Assistant')}
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", sans-serif',
          }}
          className="fixed inset-0 z-[140] flex h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-[#212121] text-[#ececec] sm:inset-auto sm:bottom-20 sm:left-4 sm:h-[620px] sm:max-h-[82dvh] sm:w-[420px] sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-[0_24px_64px_rgba(0,0,0,0.75)]"
        >
          {/* ChatGPT Clean Top Header */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-3.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#2f2f2f]">
                <img
                  src="/hs-assets/kadan-bot/idle_01.webp"
                  alt=""
                  draggable={false}
                  className="h-7 w-7 object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold tracking-tight text-white">
                    {tr('카단 AI', 'Kadan AI')}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-[#b4b4b4]">
                    {llmCap.hasPromptApi
                      ? 'Gemini Nano'
                      : screen === 'BATTLE'
                        ? tr('전술 코치', 'Coach')
                        : 'SNSHero'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  data-testid="kadan-new-chat-btn"
                  onClick={() => {
                    hsAudio.playSfx('ui_click', 0.5);
                    setMessages([]);
                  }}
                  title={tr('새 대화 시작', 'New chat')}
                  aria-label={tr('새 대화 시작', 'New chat')}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#b4b4b4] transition hover:bg-[#2f2f2f] hover:text-white"
                >
                  <SquarePen className="h-[18px] w-[18px]" />
                </button>
              )}
              <button
                type="button"
                data-testid="kadan-close-btn"
                onClick={handleCloseChat}
                aria-label={tr('대화창 닫기', 'Close chat')}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#b4b4b4] transition hover:bg-[#2f2f2f] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          {/* Compact Battle Tactical Mode Bar (Only inside Battle Screen) */}
          {screen === 'BATTLE' && onChangeTacticalStance && (
            <div
              data-testid="kadan-tactical-command-box"
              className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#1a1a1a] px-3.5 py-2"
            >
              <span className="shrink-0 text-xs font-medium text-[#b4b4b4]">
                {tr('전투 지휘', 'Tactic')}
              </span>
              <div className="flex flex-1 items-center justify-end gap-1.5">
                <button
                  type="button"
                  data-testid="kadan-tactic-AGGRO"
                  onClick={() => applyTacticalCommand('AGGRO', undefined, undefined, tr('공격적 맹공 모드로 바꿔줘', 'Switch to Aggro mode'))}
                  className={`min-h-[34px] rounded-full px-3 text-xs font-medium transition ${
                    tacticalStance === 'AGGRO'
                      ? 'bg-white text-[#171717]'
                      : 'bg-[#2f2f2f] text-[#d4d4d4] hover:bg-[#3a3a3a]'
                  }`}
                >
                  ⚔ {tr('맹공', 'Aggro')}
                </button>
                <button
                  type="button"
                  data-testid="kadan-tactic-CONTROL"
                  onClick={() => applyTacticalCommand('CONTROL', undefined, undefined, tr('방어·수비 모드로 바꿔줘', 'Switch to Control mode'))}
                  className={`min-h-[34px] rounded-full px-3 text-xs font-medium transition ${
                    tacticalStance === 'CONTROL'
                      ? 'bg-white text-[#171717]'
                      : 'bg-[#2f2f2f] text-[#d4d4d4] hover:bg-[#3a3a3a]'
                  }`}
                >
                  🛡 {tr('수비', 'Control')}
                </button>
                <button
                  type="button"
                  data-testid="kadan-tactic-AWAKENING"
                  onClick={() => applyTacticalCommand('AWAKENING', undefined, undefined, tr('각성연계 모드로 바꿔줘', 'Switch to Awakening mode'))}
                  className={`min-h-[34px] rounded-full px-3 text-xs font-medium transition ${
                    tacticalStance === 'AWAKENING'
                      ? 'bg-white text-[#171717]'
                      : 'bg-[#2f2f2f] text-[#d4d4d4] hover:bg-[#3a3a3a]'
                  }`}
                >
                  ✨ {tr('각성', 'Awaken')}
                </button>
              </div>
            </div>
          )}

          {/* Main Scrollable Chat Thread OR ChatGPT Centered Empty Welcome */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.length === 0 ? (
              <div className="flex min-h-full flex-col items-center justify-center py-4">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-[#2f2f2f] shadow-inner">
                  <img
                    src="/hs-assets/kadan-bot/idle_01.webp"
                    alt=""
                    draggable={false}
                    className="h-11 w-11 object-contain"
                  />
                </div>
                <h2 className="text-center text-xl font-semibold tracking-tight text-white sm:text-[22px]">
                  {tr('무엇을 도와드릴까요?', 'What can I help with?')}
                </h2>
                <p className="mt-1 text-center text-[13px] text-[#9b9b9b]">
                  {tr(
                    '카드 공략, 덱 편성, 3배 각성 규칙 무엇이든 물어보세요.',
                    'Ask about card strategy, decks, or 3x Awakening.',
                  )}
                </p>

                {/* ChatGPT 2-Column Suggested Prompt Cards */}
                <div
                  data-testid="kadan-chatbot-menu"
                  className="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {helpOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`kadan-help-${opt.id}`}
                      onClick={opt.onSelect}
                      className={`group flex min-h-[52px] items-start gap-2.5 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                        opt.highlight === 'autoplay'
                          ? 'border-emerald-400/35 bg-emerald-500/10 hover:bg-emerald-500/20 sm:col-span-2'
                          : 'border-white/10 bg-[#2a2a2a]/85 hover:bg-[#323232]'
                      }`}
                    >
                      <span className="mt-0.5 shrink-0 text-base">{opt.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-medium leading-snug text-[#ececec]">
                          {opt.label}
                        </div>
                        {opt.subLabel && (
                          <div className="mt-0.5 truncate text-[11.5px] text-[#9b9b9b]">
                            {opt.subLabel}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex max-w-2xl flex-col gap-5 pb-2">
                {messages.map((msg) =>
                  msg.role === 'user' ? (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[82%] rounded-3xl bg-[#2f2f2f] px-4 py-2.5 text-[15px] leading-relaxed text-[#ececec]">
                        {msg.text}
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#2f2f2f]">
                        <img
                          src="/hs-assets/kadan-bot/idle_01.webp"
                          alt=""
                          draggable={false}
                          className="h-6 w-6 object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          data-testid="kadan-chatbot-speech"
                          className="whitespace-pre-wrap text-[15px] leading-7 text-[#ececec]"
                        >
                          {msg.text}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-[#8e8e8e]">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg)}
                            aria-label={tr('답변 복사', 'Copy response')}
                            className="inline-flex min-h-[28px] items-center gap-1 rounded-lg px-1.5 py-0.5 transition hover:bg-[#2f2f2f] hover:text-[#ececec]"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-emerald-400">{tr('복사됨', 'Copied')}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>{tr('복사', 'Copy')}</span>
                              </>
                            )}
                          </button>
                          {msg.source && (
                            <span>
                              ·{' '}
                              {msg.source === 'ON_DEVICE_PROMPT_API'
                                ? tr('Gemini Nano', 'Gemini Nano')
                                : tr('SNSHero AI', 'SNSHero AI')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ),
                )}

                {llmLoading && (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#2f2f2f]">
                      <img
                        src="/hs-assets/kadan-bot/idle_01.webp"
                        alt=""
                        draggable={false}
                        className="h-6 w-6 object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 pt-2.5">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#b4b4b4]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#b4b4b4] [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-[#b4b4b4] [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Quick Action Chip Strip During Active Chat */}
          {messages.length > 0 && (
            <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-white/5 px-3.5 py-2">
              {helpOptions.slice(0, 4).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`kadan-quick-${opt.id}`}
                  onClick={opt.onSelect}
                  className="shrink-0 rounded-full border border-white/10 bg-[#2a2a2a] px-3 py-1.5 text-xs font-medium text-[#d4d4d4] transition hover:bg-[#363636] hover:text-white"
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* ChatGPT Signature Pill Composer */}
          <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1.5 sm:px-4 sm:pb-3.5">
            {micListening && (
              <div className="mb-1.5 flex items-center justify-center gap-1.5 text-xs font-medium text-rose-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
                <span>{tr('음성을 듣고 있습니다...', 'Listening...')}</span>
              </div>
            )}
            <form
              onSubmit={handleTacticInputSubmit}
              data-testid="kadan-command-form"
              className="flex items-center gap-1.5 rounded-[26px] border border-white/12 bg-[#2f2f2f] py-1.5 pl-4 pr-1.5 shadow-sm focus-within:border-white/25"
            >
              <input
                ref={inputRef}
                type="text"
                data-testid="kadan-tactic-chat-input"
                value={tacticInput}
                disabled={llmLoading}
                onChange={(e) => setTacticInput(e.target.value)}
                placeholder={
                  screen === 'BATTLE'
                    ? tr('카단에게 질문하거나 명령을 입력하세요', 'Ask or command Kadan...')
                    : tr('메시지 카단 AI', 'Message Kadan AI')
                }
                className="min-h-[40px] min-w-0 flex-1 bg-transparent text-[16px] text-[#ececec] placeholder:text-[#8e8e8e] focus:outline-none disabled:opacity-60 sm:text-[15px]"
              />
              {llmCap.supported && (
                <button
                  type="button"
                  data-testid="kadan-mic-btn"
                  onClick={handleToggleMic}
                  aria-label={
                    micListening
                      ? tr('음성 입력 중지', 'Stop voice input')
                      : tr('마이크로 질문하기', 'Ask via microphone')
                  }
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
                    micListening
                      ? 'animate-pulse bg-rose-500 text-white'
                      : 'text-[#b4b4b4] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {micListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
              <button
                type="submit"
                data-testid="kadan-command-submit-btn"
                disabled={llmLoading || !tacticInput.trim()}
                aria-label={tr('전송', 'Send')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#171717] transition hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:bg-[#4f4f4f] disabled:text-[#212121]"
              >
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              </button>
            </form>
            <p className="mt-1.5 text-center text-[11px] text-[#8e8e8e]">
              {tr(
                '카단 AI는 382종 카드와 실시간 전장을 바탕으로 답변합니다.',
                'Kadan AI answers from 382 cards & live battlefield state.',
              )}
            </p>
          </div>
        </div>
      );

      if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
      }
      return modalContent;
    })();

  // Flush to bottom-left corner identically with bottom-right Live Chat Icon so cards stay unobstructed
  const positionClasses = 'fixed bottom-0.5 left-1 z-[125] sm:bottom-1 sm:left-2';

  return (
    <div
      ref={kadanRootRef}
      data-testid="kadan-chatbot-root"
      className={`pointer-events-none ${positionClasses} flex flex-col items-start`}
    >
      {chatModalNode}

      {/* Compact Floating Notice Toast when Menu is Closed (e.g., Auto-Play stopped) */}
      {!menuOpen && transientToast && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setTransientToast(null);
          }}
          style={{
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", sans-serif',
          }}
          className="pointer-events-auto mb-1.5 max-w-[260px] cursor-pointer rounded-2xl border border-white/15 bg-[#212121]/95 px-3 py-2 text-xs font-medium leading-snug text-[#ececec] shadow-xl sm:max-w-[300px]"
        >
          {transientToast}
        </div>
      )}

      {/* Live 1-Tap Tactical Switcher Strip While Auto-Playing in Battle */}
      {screen === 'BATTLE' && autoPlay && !menuOpen && onChangeTacticalStance && (
        <div
          onClick={(e) => e.stopPropagation()}
          data-testid="kadan-live-tactic-strip"
          className="pointer-events-auto mb-1 flex items-center gap-1 rounded-full border border-white/15 bg-[#212121]/95 p-1 shadow-xl"
        >
          <button
            type="button"
            onClick={() => applyTacticalCommand('AGGRO')}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
              tacticalStance === 'AGGRO'
                ? 'bg-white text-[#171717]'
                : 'text-[#d4d4d4] hover:bg-white/10'
            }`}
          >
            ⚔ {tr('맹공', 'Aggro')}
          </button>
          <button
            type="button"
            onClick={() => applyTacticalCommand('CONTROL')}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
              tacticalStance === 'CONTROL'
                ? 'bg-white text-[#171717]'
                : 'text-[#d4d4d4] hover:bg-white/10'
            }`}
          >
            🛡 {tr('수비', 'Ctrl')}
          </button>
          <button
            type="button"
            onClick={() => applyTacticalCommand('AWAKENING')}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
              tacticalStance === 'AWAKENING'
                ? 'bg-white text-[#171717]'
                : 'text-[#d4d4d4] hover:bg-white/10'
            }`}
          >
            ✨ {tr('각성', 'Awkn')}
          </button>
        </div>
      )}

      {/* Bottom-Left 2-Head-Tall Chibi Kadan Character Button (+ Silia Co-Cast Cameo on Dual Ultimate!) */}
      <div className="flex items-end gap-1">
        <button
          type="button"
          data-testid="kadan-chatbot-avatar-btn"
          data-kadan-mode={autoPlay ? 'running' : 'idle'}
          onClick={handleKadanClick}
          aria-label={
            autoPlay
              ? tr('달리는 카단 (클릭 시 자동플레이 중지)', 'Running Kadan (Click to stop Auto-Play)')
              : tr('카단 AI 챗봇 열기', 'Open Kadan AI Chat')
          }
          className="pointer-events-auto group relative flex flex-col items-center focus:outline-none"
        >
          {(autoPlay || siliaCoCastSkill) && (
            <div
              className={`pointer-events-none absolute inset-x-1 bottom-4 top-2 rounded-full blur-md animate-pulse ${
                siliaCoCastSkill
                  ? 'bg-gradient-to-r from-cyan-400/35 to-emerald-400/35'
                  : 'bg-emerald-400/20'
              }`}
            />
          )}

          <div
            className={`relative flex h-[46px] w-[46px] items-center justify-center transition-transform duration-150 group-hover:scale-108 group-active:scale-95 sm:h-[58px] sm:w-[58px] ${
              siliaCoCastSkill
                ? 'scale-108 drop-shadow-[0_0_12px_rgba(56,189,248,0.95)]'
                : autoPlay
                  ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : 'drop-shadow-[0_3px_6px_rgba(0,0,0,0.85)]'
            }`}
          >
            {activeFrames.map((src, idx) => (
              <img
                key={src}
                src={src}
                decoding="async"
                alt=""
                aria-hidden="true"
                draggable={false}
                className={`absolute inset-0 h-full w-full select-none object-contain ${
                  idx === frameIdx ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}

            <span
              className={`pointer-events-none absolute -right-0.5 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full border px-0.5 text-[8.5px] font-black shadow-md sm:h-[18px] sm:min-w-[18px] sm:text-[9.5px] ${
                siliaCoCastSkill
                  ? 'border-cyan-100 bg-gradient-to-r from-sky-500 to-emerald-600 text-white animate-bounce'
                  : autoPlay
                    ? 'border-emerald-200 bg-emerald-600 text-white animate-bounce'
                    : menuOpen
                      ? 'border-white/50 bg-white text-[#171717]'
                      : 'border-white/25 bg-[#212121] text-[#ececec]'
              }`}
            >
              {siliaCoCastSkill ? '❄️🌪' : autoPlay ? '⚡' : 'AI'}
            </span>
          </div>

          <div
            className={`-mt-1 flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[8.5px] font-extrabold leading-none shadow-[0_3px_8px_rgba(0,0,0,0.9)] transition sm:px-2 sm:text-[9.5px] ${
              siliaCoCastSkill
                ? 'border-cyan-200 bg-gradient-to-r from-sky-700 via-teal-700 to-emerald-800 text-white'
                : autoPlay
                  ? 'border-emerald-300 bg-gradient-to-r from-emerald-700 to-teal-900 text-emerald-50'
                  : 'border-white/20 bg-[#212121]/95 text-[#ececec] group-hover:border-white/50'
            }`}
          >
            <span>
              {siliaCoCastSkill
                ? tr('❄️🌪 합동!', '❄️🌪 Dual!')
                : autoPlay
                  ? tr('자동(정지)', 'Auto(Off)')
                  : tr('카단 AI', 'Kadan AI')}
            </span>
          </div>
        </button>

        {siliaCoCastSkill && (
          <div
            data-testid="kadan-silia-dual-cameo"
            className="pointer-events-none flex flex-col items-center animate-[hsCardPop_0.22s_ease-out]"
          >
            <div className="relative flex h-[46px] w-[46px] items-center justify-center drop-shadow-[0_0_12px_rgba(16,185,129,0.95)] sm:h-[58px] sm:w-[58px]">
              <img
                src={
                  SILIA_CO_CAST_FRAMES[siliaCoCastSkill][
                    frameIdx % SILIA_CO_CAST_FRAMES[siliaCoCastSkill].length
                  ]
                }
                alt={tr('실리아 합동 필살기', 'Silia Dual Ultimate')}
                decoding="async"
                draggable={false}
                className="h-full w-full select-none object-contain"
              />
            </div>
            <div className="-mt-1 rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-700 to-teal-900 px-1.5 py-0.5 text-[8.5px] font-black leading-none text-emerald-50 shadow-lg">
              🌪 {tr('실리아!', 'Silia!')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
