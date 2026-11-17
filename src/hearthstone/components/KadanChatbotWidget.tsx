import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import {
  LocalLlmCapability,
  askLocalLlmAssistant,
  detectLocalLlmCapability,
  getSpeechRecognitionCtor,
} from '../services/localLlmAssistant';
import { CLASSIC_HEROES, GameMode, HeroClass, KadanTacticalStance, PlayerProfile, ScreenName } from '../types';

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
  highlight?: 'autoplay' | 'nav' | 'tip';
  onSelect: () => void;
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

  const [frameIdx, setFrameIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [speechText, setSpeechText] = useState<string | null>(null);
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
  const [llmSource, setLlmSource] = useState<'ON_DEVICE_PROMPT_API' | 'LOCAL_KNOWLEDGE_ENGINE' | null>(null);
  const [micListening, setMicListening] = useState(false);

  const kadanRootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<{
    stop: () => void;
  } | null>(null);

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

  // Close Kadan chat popover / speech bubble immediately when user clicks outside or presses Escape
  useEffect(() => {
    if (!menuOpen && !speechText) return;
    const handleOutsidePointerDown = (e: PointerEvent) => {
      if (kadanRootRef.current && !kadanRootRef.current.contains(e.target as Node)) {
        recognitionRef.current?.stop();
        setMicListening(false);
        setMenuOpen(false);
        setSpeechText(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        recognitionRef.current?.stop();
        setMicListening(false);
        setMenuOpen(false);
        setSpeechText(null);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, speechText]);

  const applyTacticalCommand = (stance: KadanTacticalStance, customReplyKo?: string, customReplyEn?: string) => {
    hsAudio.playSfx('ui_click', 0.8);
    setLlmSource(null);
    onChangeTacticalStance?.(stance);
    const defaultKo =
      stance === 'AGGRO'
        ? '맹공(공격적) 전환! 적 영웅 본체 타격과 돌진 주문을 최우선으로 퍼붓겠습니다!'
        : stance === 'CONTROL'
          ? '수비·통제 전환! 위험한 적 하수인 제압과 도발·생명력 회복을 최우선으로 지휘할게요!'
          : stance === 'AWAKENING'
            ? '각성연계 전환! 3배 각성 에이스와 피니셔 콤보 타이밍까지 주문을 아껴서 한방에 몰아칠게요!'
            : '균형 전술로 전환했습니다! 전황에 맞춰 최적의 수를 두겠습니다.';
    const defaultEn =
      stance === 'AGGRO'
        ? 'Aggro Mode! Prioritizing enemy Hero face damage & rush bursts!'
        : stance === 'CONTROL'
          ? 'Control Mode! Clearing high-threat minions, Taunts & healing first!'
          : stance === 'AWAKENING'
            ? 'Awakening Combo! Saving key buffs & spells for ×3 power turns!'
            : 'Balanced Mode! Adapting optimally to the board.';
    setSpeechText(isKo ? customReplyKo || defaultKo : customReplyEn || defaultEn);
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
          applyTacticalCommand('AGGRO');
          if (!autoPlay) onEnableAutoPlay();
          return;
        }
        if (/수비|방어|막아|살려|도발|회복|통제|control|defen|taunt|heal/i.test(q)) {
          applyTacticalCommand('CONTROL');
          if (!autoPlay) onEnableAutoPlay();
          return;
        }
        if (/아껴|콤보|연계|존버|combo|save|awakening\s*mode/i.test(q)) {
          applyTacticalCommand('AWAKENING');
          if (!autoPlay) onEnableAutoPlay();
          return;
        }
        if (/정지|멈춰|수동|stop|manual|off/i.test(q)) {
          setLlmSource(null);
          onDisableAutoPlay();
          setSpeechText(tr('자동플레이를 멈췄습니다! 직접 지휘해 주세요.', 'Auto-Play paused! Manual control active.'));
          return;
        }
        if (/자동|오토|auto/i.test(q)) {
          setLlmSource(null);
          onEnableAutoPlay();
          setSpeechText(tr('자동플레이를 시작합니다! 제가 턴을 이어서 지휘할게요.', 'Enabling Auto-Play now!'));
          return;
        }
      }

      // General SNSHero Question -> Route through On-Device Local LLM Assistant
      hsAudio.playSfx('ui_click', 0.7);
      setLlmLoading(true);
      setLlmSource(null);
      setSpeechText(
        isKo
          ? `“${cleaned}” — 로컬 AI가 답변을 생각 중이에요...`
          : `“${cleaned}” — Local AI is thinking...`,
      );
      try {
        const res = await askLocalLlmAssistant(cleaned, {
          isKo,
          screen,
          profile,
          tacticalStance,
          battleSnapshot,
        });
        setLlmSource(res.source);
        setSpeechText(res.answer);
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
      setSpeechText(
        isKo
          ? '이 환경에서는 브라우저 마이크 음성 인식이 비활성화되어 있습니다. 왼쪽 입력창에 질문을 입력해 주세요!'
          : 'Speech recognition is unavailable in this environment. Please type your question on the left!',
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
        setSpeechText(
          isKo
            ? '음성을 인식하지 못했습니다. 마이크 권한을 확인하거나 직접 입력해 주세요!'
            : 'Could not capture voice. Check mic permission or type your question!',
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
      setSpeechText(
        isKo
          ? '🎤 말씀하세요! (예: "3배 각성이 뭐야?", "실리아 필살기 설명해줘", "맹공으로 바꿔")'
          : '🎤 Listening! Ask anything about SNSHero or give a battle command!',
      );
      rec.start();
    } catch {
      setMicListening(false);
      inputRef.current?.focus();
    }
  };

  // Preload all 8 sprite frames once so frame transitions never flicker
  useEffect(() => {
    [...IDLE_FRAMES, ...RUN_FRAMES].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Animate 2-head-tall Kadan: slow left/right look when idle, brisk sprint when running
  useEffect(() => {
    setFrameIdx(0);
    const intervalMs = autoPlay ? 150 : 760;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setFrameIdx((prev) => (prev + 1) % 4);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [autoPlay]);

  // Close help menu automatically if autoplay starts externally
  useEffect(() => {
    if (autoPlay) {
      setMenuOpen(false);
    }
  }, [autoPlay]);

  // Auto-hide transient speech bubble after 8.5s when menu is closed
  useEffect(() => {
    if (!speechText || menuOpen) return;
    const t = window.setTimeout(() => {
      setSpeechText(null);
    }, 8500);
    return () => window.clearTimeout(t);
  }, [speechText, menuOpen]);

  const speak = (msgKo: string, msgEn: string, keepMenu = false) => {
    hsAudio.playSfx('ui_click', 0.7);
    setSpeechText(isKo ? msgKo : msgEn);
    if (!keepMenu) {
      setMenuOpen(false);
    }
  };

  const handleKadanClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    hsAudio.playSfx('ui_click', 0.8);

    // 1. 달리는 카단을 누르면 -> 자동플레이 즉시 중지 + 가만히 서있는 카단으로 전환 (도움말은 다시 눌렀을 때 표시)
    if (autoPlay) {
      onDisableAutoPlay();
      setMenuOpen(false);
      setSpeechText(
        tr(
          '후우! 자동플레이를 멈추고 제자리에 섰어요. 도움이 필요하시면 저를 다시 눌러주세요!',
          'Phew! Auto-Play stopped. Tap me again anytime you need card tips or navigation!',
        ),
      );
      return;
    }

    // 2. 가만히 서있는 카단을 누르면 -> 현재 화면 맞춤 카드 도움말 표시 토글
    setMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setSpeechText(
          tr(
            '무엇을 도와드릴까요? 아래 도움말을 고르시면 대사로 알려드리거나 바로 안내해 드릴게요!',
            'How can I help? Pick any topic below for tactical tips or quick navigation!',
          ),
        );
      } else {
        setSpeechText(null);
      }
      return next;
    });
  };

  const helpOptions = useMemo<HelpOptionItem[]>(() => {
    const autoPlayOption: HelpOptionItem = {
      id: 'autoplay_start',
      icon: '⚡',
      label: tr('자동플레이 해줘.', 'Run Auto-Play for me.'),
      highlight: 'autoplay',
      onSelect: () => {
        hsAudio.playSfx('box_press', 0.85);
        setMenuOpen(false);
        setSpeechText(
          screen === 'BATTLE'
            ? tr(
                '맡겨만 주세요! 제가 열심히 달리면서 이번 대결을 자동으로 지휘할게요! (멈추려면 달리는 저를 클릭!)',
                "Leave it to me! I'll sprint ahead and command this battle automatically! (Tap me while running to stop!)",
              )
            : tr(
                '좋아요! 지금 바로 전장으로 달려가 자동플레이로 대결을 시작할게요! (멈추려면 달리는 저를 클릭!)',
                "Let's go! Sprinting into battle with Auto-Play enabled! (Tap me while running to stop!)",
              ),
        );
        onEnableAutoPlay();
      },
    };

    if (screen === 'BATTLE') {
      const snap = battleSnapshot;
      return [
        autoPlayOption,
        {
          id: 'battle_recommend_play',
          icon: '🃏',
          label: tr('지금 낼 수 있는 추천 카드 알려줘', 'Which card should I play right now?'),
          highlight: 'tip',
          onSelect: () => {
            if (!snap) {
              speak(
                '전장 상태를 살피는 중이에요! 내 턴에 초록빛 테두리가 켜진 카드를 내면 마나에 맞춰 활약할 수 있어요.',
                'Scanning the battlefield! On your turn, play cards with a glowing green border.',
              );
              return;
            }
            if (!snap.isPlayerTurn) {
              speak(
                `지금은 ${snap.opponentName}의 턴이에요! 상대의 공격을 지켜본 뒤 내 턴이 오면 다시 물어봐 주세요.`,
                `It's ${snap.opponentName}'s turn right now! Wait for your turn, then ask me again.`,
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
                  ? ` (그 외 ${playable
                      .slice(1, 3)
                      .map((c) => `'${c.name}'`)
                      .join(', ')}도 사용 가능!)`
                  : '';
              const cleanDesc = top.text.replace(/<[^>]+>/g, '').trim();
              speak(
                `현재 마나(${snap.playerMana}/${snap.playerMaxMana})로 '${top.name}'(${top.cost}마나) 카드를 먼저 내는 걸 추천해요! ${
                  cleanDesc ? `효과: ${cleanDesc}` : '전장 주도권을 잡기에 딱 좋아요!'
                }${others}`,
                `With ${snap.playerMana}/${snap.playerMaxMana} Mana, I recommend playing '${top.name}' (${top.cost} Mana)! ${cleanDesc}`,
              );
            } else if (snap.canUseHeroPower) {
              speak(
                `지금 손패에는 남은 마나(${snap.playerMana})로 낼 카드가 없네요! 대신 영웅 능력(2마나)을 눌러 활용해보세요!`,
                `No playable hand cards for ${snap.playerMana} Mana—use your Hero Power (2 Mana) instead!`,
              );
            } else if (snap.readyAttackersCount > 0) {
              speak(
                `낼 수 있는 카드는 모두 썼어요! 이제 전장의 초록빛 아군(${snap.readyAttackersCount}기)으로 공격한 뒤 [턴 종료]를 누르세요!`,
                `No more cards to play! Attack with your ${snap.readyAttackersCount} ready unit(s), then press [End Turn]!`,
              );
            } else {
              speak(
                `이번 턴(${snap.playerMana}마나)에 할 수 있는 행동을 모두 마쳤어요! 오른쪽 [턴 종료] 레버를 눌러 다음 턴 마나를 늘려보세요.`,
                `All actions done for this turn! Press [End Turn] on the right to gain more Mana next turn.`,
              );
            }
          },
        },
        {
          id: 'battle_attack_guide',
          icon: '⚔️',
          label: tr('지금 어떻게 공격하면 좋을까?', 'How should I attack this turn?'),
          highlight: 'tip',
          onSelect: () => {
            if (!snap) {
              speak(
                '초록색 테두리가 빛나는 아군 하수인을 누른 뒤 적 하수인이나 적 영웅을 누르면 공격해요!',
                'Tap a green-glowing friendly minion, then tap an enemy minion or hero to attack!',
              );
              return;
            }
            if (snap.enemyTauntNames.length > 0) {
              speak(
                `적 전장에 도발 방패 하수인(${snap.enemyTauntNames.join(', ')})이 길을 막고 있어요! 주문이나 공격으로 도발 하수인부터 먼저 쓰러뜨려야 적 영웅을 공격할 수 있습니다!`,
                `Enemy Taunt minion (${snap.enemyTauntNames.join(', ')}) blocks the way! Defeat Taunt minions first before striking the enemy hero.`,
              );
            } else if (snap.readyAttackersCount > 0) {
              speak(
                `도발 방해물이 없어요! 공격 가능한 아군 ${snap.readyAttackersCount}기로 위험한 적 하수인을 정리하거나, 적 영웅(체력 ${snap.opponentHealth})의 본체를 직접 노려보세요!`,
                `No Taunt blockers! Use your ${snap.readyAttackersCount} ready attacker(s) to clear threats or strike the enemy hero (${snap.opponentHealth} HP)!`,
              );
            } else {
              speak(
                '방금 소환한 하수인은 한 턴 동안 준비 시간(Zzz)이 필요해요! 단, [돌진] 능력이 있는 카드나 장착 무기는 낸 턴에 바로 공격할 수 있답니다.',
                'Newly summoned minions rest for 1 turn (Zzz) unless they have Charge—weapons can swing immediately!',
              );
            }
          },
        },
        {
          id: 'battle_hand_summary',
          icon: '📖',
          label: tr('내 손패 카드 종류·역할 설명해줘', 'Explain the cards in my hand'),
          highlight: 'tip',
          onSelect: () => {
            if (!snap || snap.handCards.length === 0) {
              speak(
                '현재 손패가 비어 있어요! 매 턴 시작마다 덱에서 새 카드를 1장씩 뽑고, 드로우 주문으로 보충할 수 있어요.',
                'Your hand is empty right now! You draw 1 card at the start of every turn.',
              );
              return;
            }
            const mCnt = snap.handCards.filter((c) => c.type === 'MINION').length;
            const sCnt = snap.handCards.filter((c) => c.type === 'SPELL').length;
            const wCnt = snap.handCards.filter((c) => c.type === 'WEAPON').length;
            speak(
              `지금 손패(${snap.handCards.length}장)에는 하수인 ${mCnt}장, 주문 ${sCnt}장, 무기 ${wCnt}장이 있어요! 하수인은 전장에 남아 매 턴 싸우고, 주문은 즉시 마법 효과를 발동하며, 무기는 영웅이 직접 장착해 공격합니다.`,
              `Your hand (${snap.handCards.length}) holds ${mCnt} Minion(s), ${sCnt} Spell(s), and ${wCnt} Weapon(s)! Minions stay on board, Spells trigger immediately, and Weapons equip to your hero.`,
            );
          },
        },
        {
          id: 'nav_packs_from_battle',
          icon: '🎁',
          label: tr('카드팩 개봉 화면으로 이동', 'Go to Open Card Packs'),
          highlight: 'nav',
          onSelect: () => {
            speak(
              '전력을 보강하러 카드팩 개봉소로 안내할게요! 같은 카드 3장을 모으면 스토리모드에서 3배로 각성해요!',
              'Heading to Pack Opening! Collecting 3 copies awakens 3x stats in Story Mode!',
            );
            onNavigateScreen('PACK_OPENING');
          },
        },
        {
          id: 'nav_hub_from_battle',
          icon: '🏠',
          label: tr('엘윈마을 로비로 나가기', 'Return to Elwin Hub'),
          highlight: 'nav',
          onSelect: () => {
            speak(
              '엘윈마을 중앙 로비로 돌아갑니다! 덱을 정비하고 언제든 다시 출정해요!',
              'Returning to Elwin Village Hub! Adjust your deck anytime.',
            );
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
          label: tr('강력한 30장 덱 짜는 비결 알려줘', 'How do I build a strong 30-card deck?'),
          highlight: 'tip',
          onSelect: () =>
            speak(
              '1~3코스트 초반 하수인을 10장 이상 넣어야 초반에 밀리지 않아요! 여기에 종족 전용 주문(마법 물보라·물의 창 등)과 무기, 후반 고코스트 전설 카드를 섞어 30장을 채워보세요. 어렵다면 [자동 완성] 버튼도 최고예요!',
              'Include 10+ low-cost (1–3 Mana) minions for early board control, mix in class spells/weapons, and top off with late-game finishers—or use [Auto Complete]!',
            ),
        },
        {
          id: 'collection_craft_tip',
          icon: '💎',
          label: tr('신비한 가루 제작·분해 도움말', 'How does Crafting & Dust work?'),
          highlight: 'tip',
          onSelect: () =>
            speak(
              `현재 보유 가루는 ${profile.dust}개예요! 상단 [제작 모드]를 켜면 아직 없는 카드도 가루로 즉시 제작할 수 있고, 남는 중복 카드는 분해해 가루를 모을 수 있어요.`,
              `You have ${profile.dust} Arcane Dust! Toggle [Crafting] to craft unowned cards or disenchant extras.`,
            ),
        },
        {
          id: 'collection_go_packs',
          icon: '🎁',
          label: tr(`카드팩 개봉하러 이동 (보유 ${profile.packs}팩)`, `Go to Pack Opening (${profile.packs} packs)`),
          highlight: 'nav',
          onSelect: () => {
            speak('새로운 카드를 뽑으러 카드팩 개봉 화면으로 이동할게요!', 'Moving to Pack Opening!');
            onNavigateScreen('PACK_OPENING');
          },
        },
        {
          id: 'collection_go_play',
          icon: '⚔️',
          label: tr('영웅 선택 & 대전 화면으로 이동', 'Go to Hero Select & Battle'),
          highlight: 'nav',
          onSelect: () => {
            speak('완성한 덱으로 실전을 치르러 영웅 선택 화면으로 가요!', "Let's take your deck into battle!");
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
          label: tr('카드 등급과 3장=3배 각성 규칙 알려줘', 'Explain Card Rarities & 3x Awakening'),
          highlight: 'tip',
          onSelect: () =>
            speak(
              '보석 색상이 하양(일반) → 파랑(희귀) → 보라(특급) → 주황 용문양(전설) 순서로 강력해요! 특히 스토리모드 『카단의 여정』에서는 같은 카드를 3장 이상 모으면 공격력·생명력이 3배로 각성합니다!',
              'Gem colors go Common (White) → Rare (Blue) → Epic (Purple) → Legendary (Orange)! Owning 3+ copies grants 3x stats in Story Mode!',
            ),
        },
        {
          id: 'pack_gold_tip',
          icon: '🪙',
          label: tr('골드와 팩은 어디서 모으나요?', 'How do I earn Gold & Packs fast?'),
          highlight: 'tip',
          onSelect: () =>
            speak(
              `현재 ${profile.gold}G와 ${profile.packs}팩을 보유 중이시네요! 스토리모드 5화마다 보스 팩을 드리고, 일일 퀘스트와 9종족 AI 첫 제압 보너스로도 골드를 듬뿍 모을 수 있어요!`,
              `You have ${profile.gold}G and ${profile.packs} packs! Clear Story bosses every 5 episodes, Daily Quests, and AI challenges for big rewards!`,
            ),
        },
        {
          id: 'pack_open_shop',
          icon: '🛒',
          label: tr('보급소(팩 구매) 열기', 'Open Supply Shop'),
          highlight: 'nav',
          onSelect: () => {
            speak('100골드로 카드팩을 바로 교환할 수 있는 엘윈 보급소를 열어드릴게요!', 'Opening the Elwin Supply Shop!');
            onOpenShop();
          },
        },
        {
          id: 'pack_go_collection',
          icon: '📚',
          label: tr('뽑은 카드 보러 카드첩 이동', 'Check Cards in Collection'),
          highlight: 'nav',
          onSelect: () => {
            speak('방금 획득한 멋진 카드들을 확인하러 카드첩으로 이동합니다!', 'Opening your Card Collection!');
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
          label: tr('9대 종족별 카드 특징 알려줘', 'Tell me about the 9 Hero Races'),
          highlight: 'tip',
          onSelect: () =>
            speak(
              `물종족(마법 물보라·빙결), 불종족(화염 무기와 돌파), 바람종족(속공과 덫), 땅종족(수정 보호막과 성검), 인간종족(치유와 성광), 언데드(맹독·기습 괴수), 엘프(정령석·번개), 드워프(용광로 화력), 동물종족(마나 성장·거대 영수)까지 9가지 개성이 뚜렷해요! (${racesKo} 등)`,
              'Each of the 9 races has signature skills: Water (hydro/freeze), Fire (weapons/burst), Wind (traps/speed), Earth (shields), Human (heals), Undead (venom/combos), Elf (spirit stones), Dwarf (forge power), and Beast (mana ramp)!',
            ),
        },
        {
          id: 'hero_mode_guide',
          icon: '🏆',
          label: tr('현재 대전 모드 특징 알려줘', 'Explain the battle modes'),
          highlight: 'tip',
          onSelect: () =>
            speak(
              selectedMode === 'RANKED'
                ? '등급전에서는 승리할 때마다 별(★)을 획득해 25등급 수습생부터 전설 등급까지 승급할 수 있어요!'
                : selectedMode === 'CASUAL'
                  ? '일반전은 등급 하락 부담 없이 새로운 종족 덱을 마음껏 시험하고 골드를 모으기 좋은 모드예요!'
                  : 'AI 연습 대전에서는 9대 종족 영웅들을 차례로 제압하며 종족별 첫 승리 보너스 골드를 챙길 수 있어요!',
              'Win stars in Ranked to climb to Legend, test decks risk-free in Casual, or earn first-clear bonuses against all 9 AI races!',
            ),
        },
        {
          id: 'hero_go_collection',
          icon: '📚',
          label: tr('내 덱 편집하러 카드첩 이동', 'Edit Decks in Collection'),
          highlight: 'nav',
          onSelect: () => {
            speak('카드첩에서 나만의 30장 종족 덱을 편성해보세요!', 'Heading to Collection to customize your deck!');
            onNavigateScreen('COLLECTION');
          },
        },
        {
          id: 'hero_go_hub',
          icon: '🏠',
          label: tr('엘윈마을 로비로 돌아가기', 'Back to Elwin Hub'),
          highlight: 'nav',
          onSelect: () => {
            speak('엘윈마을 중앙 로비로 이동할게요!', 'Returning to Elwin Hub!');
            onNavigateScreen('BOX_HUB');
          },
        },
      ];
    }

    // Default: TAVERN_INTRO or BOX_HUB
    return [
      autoPlayOption,
      {
        id: 'hub_story_start',
        icon: '📖',
        label: tr(
          `카단의 여정 스토리모드 이동 (제${profile.journeyEpisode}화)`,
          `Play Kadan's Journey Story (EP.${profile.journeyEpisode})`,
        ),
        highlight: 'nav',
        onSelect: () => {
          speak(
            `제${profile.journeyEpisode}화 전장으로 출정합니다! 참고로 이제 시작 시 자동플레이는 꺼져 있으니 직접 손맛을 즐기시거나 저에게 자동플레이를 맡겨주세요!`,
            `Launching Episode ${profile.journeyEpisode}! Auto-Play starts OFF so you're in full control—ask me anytime if you want Auto-Play!`,
          );
          onStartJourney();
        },
      },
      {
        id: 'hub_ranked_go',
        icon: '⚔️',
        label: tr('랭킹대전 영웅 선택으로 이동', 'Go to Ranked Battle'),
        highlight: 'nav',
        onSelect: () => {
          speak(
            '9대 종족 영웅들과 정통 382장 카드 실력을 겨루는 랭킹대전 화면으로 안내할게요!',
            'Moving to Ranked Hero & Deck Selection!',
          );
          onNavigateScreen('HERO_SELECT', 'RANKED');
        },
      },
      {
        id: 'hub_card_basics',
        icon: '💡',
        label: tr('초보자 필수 카드 도움말 듣기', 'Beginner Card Battle Tips'),
        highlight: 'tip',
        onSelect: () =>
          speak(
            '눈히어로의 382장 카드는 [하수인·주문·무기]로 나뉘어요! 매 턴 늘어나는 파란 마나 수정 범위 안에서 카드를 내어 적 영웅의 생명력을 0으로 만들면 승리합니다!',
            'All 382 cards are Minions, Spells, or Weapons! Spend Mana crystals each turn to reduce the enemy Hero to 0 Health!',
          ),
      },
      {
        id: 'hub_packs_go',
        icon: '🎁',
        label: tr(
          `카드팩 개봉소로 이동 (보유 ${profile.packs}팩 · ${profile.gold}G)`,
          `Open Card Packs (${profile.packs} packs · ${profile.gold}G)`,
        ),
        highlight: 'nav',
        onSelect: () => {
          speak('설레는 카드팩 개봉소로 바로 안내해 드릴게요!', 'Heading to Pack Opening!');
          onNavigateScreen('PACK_OPENING');
        },
      },
      {
        id: 'hub_collection_go',
        icon: '📚',
        label: tr('382장 카드첩 & 덱 편성으로 이동', 'Open 382-Card Collection'),
        highlight: 'nav',
        onSelect: () => {
          speak('새롭게 단장된 9대 종족과 연합군 382장 카드를 한눈에 볼 수 있는 카드첩으로 이동해요!', 'Opening the 382-Card Collection!');
          onNavigateScreen('COLLECTION');
        },
      },
      {
        id: 'hub_quests',
        icon: '📜',
        label: tr('일일 의뢰 & 전적 확인하기', 'Check Quest Log & Stats'),
        highlight: 'nav',
        onSelect: () => {
          speak('오늘 달성할 수 있는 의뢰와 보상을 확인해 보세요!', 'Opening your Quest Log!');
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
  ]);

  const activeFrames = autoPlay ? RUN_FRAMES : IDLE_FRAMES;

  return (
    <div
      ref={kadanRootRef}
      data-testid="kadan-chatbot-root"
      className="pointer-events-none fixed bottom-2 right-2 z-[125] flex flex-col items-end sm:bottom-3.5 sm:right-4"
    >
      {/* Speech Dialogue Bubble & Context Help Menu */}
      {(menuOpen || speechText) && (
        <div
          onClick={(e) => e.stopPropagation()}
          data-testid="kadan-chatbot-popover"
          className="pointer-events-auto mb-1.5 w-[300px] max-w-[calc(100vw-20px)] overflow-hidden rounded-2xl border-2 border-[#e3be73] bg-gradient-to-b from-[#1d140c]/98 via-[#130d08]/98 to-[#0a0704]/98 text-amber-50 shadow-[0_18px_44px_rgba(0,0,0,0.92),0_0_20px_rgba(56,189,248,0.22)] sm:w-[348px]"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-amber-400/25 bg-gradient-to-r from-sky-950/90 via-stone-900/90 to-stone-950/90 px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
              <span className="text-xs font-extrabold tracking-tight text-sky-200">
                {tr('길잡이 카단 챗봇', 'Guide Kadan Bot')}
              </span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9.5px] font-extrabold text-amber-200">
                {screen === 'BATTLE'
                  ? tr('실전 도우미', 'Battle Coach')
                  : screen === 'COLLECTION'
                    ? tr('덱 도우미', 'Deck Guide')
                    : screen === 'PACK_OPENING'
                      ? tr('개봉 도우미', 'Pack Guide')
                      : tr('길 안내', 'Navigator')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                hsAudio.playSfx('ui_click', 0.45);
                recognitionRef.current?.stop();
                setMicListening(false);
                setMenuOpen(false);
                setSpeechText(null);
              }}
              aria-label={tr('대화창 닫기', 'Close Kadan chat')}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/35 bg-stone-900 text-[11px] font-black text-amber-200 hover:bg-stone-800"
            >
              ✕
            </button>
          </div>

          {/* Kadan Speech Text */}
          {speechText && (
            <div
              data-testid="kadan-chatbot-speech"
              className="max-h-[145px] overflow-y-auto border-b border-amber-400/15 bg-[#24190f]/90 px-3 py-2.5 text-[12px] font-bold leading-relaxed text-amber-100 sm:text-[12.5px]"
            >
              {llmSource && (
                <div className="mb-1 flex items-center gap-1 text-[10px] font-extrabold text-sky-300">
                  <span>{llmSource === 'ON_DEVICE_PROMPT_API' ? '🤖' : '⚡'}</span>
                  <span>
                    {llmSource === 'ON_DEVICE_PROMPT_API'
                      ? tr('온디바이스 Gemini Nano 답변', 'On-Device Nano LLM')
                      : tr('SNSHero 로컬 AI 답변', 'SNSHero Local AI')}
                  </span>
                </div>
              )}
              <span>“{speechText}”</span>
            </div>
          )}

          {/* DEV-021: Kadan Tactical Stance Chips (Battle Mode Only) */}
          {menuOpen && screen === 'BATTLE' && onChangeTacticalStance && (
            <div
              data-testid="kadan-tactical-command-box"
              className="space-y-1.5 border-b border-amber-400/20 bg-black/55 p-2"
            >
              <div className="flex items-center justify-between text-[10px] font-extrabold text-amber-200/90">
                <span>⚔ {tr('카단 실시간 전술 지휘', 'Kadan Live Tactic')}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9.5px]">
                  {tacticalStance === 'AGGRO'
                    ? tr('현재: 맹공(적색)', 'Mode: AGGRO')
                    : tacticalStance === 'CONTROL'
                      ? tr('현재: 수비(청색)', 'Mode: CONTROL')
                      : tacticalStance === 'AWAKENING'
                        ? tr('현재: 각성(금색)', 'Mode: AWAKENING')
                        : tr('현재: 균형', 'Mode: BALANCED')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  data-testid="kadan-tactic-AGGRO"
                  onClick={() => applyTacticalCommand('AGGRO')}
                  className={`min-h-[36px] rounded-lg border px-1.5 text-[10.5px] font-extrabold transition ${
                    tacticalStance === 'AGGRO'
                      ? 'border-rose-300 bg-rose-700 text-white shadow'
                      : 'border-rose-400/40 bg-rose-950/50 text-rose-200 hover:bg-rose-900/60'
                  }`}
                >
                  ⚔ {tr('공격적·맹공', 'Aggro')}
                </button>
                <button
                  type="button"
                  data-testid="kadan-tactic-CONTROL"
                  onClick={() => applyTacticalCommand('CONTROL')}
                  className={`min-h-[36px] rounded-lg border px-1.5 text-[10.5px] font-extrabold transition ${
                    tacticalStance === 'CONTROL'
                      ? 'border-sky-300 bg-sky-700 text-white shadow'
                      : 'border-sky-400/40 bg-sky-950/50 text-sky-200 hover:bg-sky-900/60'
                  }`}
                >
                  🛡 {tr('방어·수비', 'Control')}
                </button>
                <button
                  type="button"
                  data-testid="kadan-tactic-AWAKENING"
                  onClick={() => applyTacticalCommand('AWAKENING')}
                  className={`min-h-[36px] rounded-lg border px-1.5 text-[10.5px] font-extrabold transition ${
                    tacticalStance === 'AWAKENING'
                      ? 'border-amber-200 bg-amber-600 text-stone-950 shadow'
                      : 'border-amber-400/40 bg-amber-950/50 text-amber-200 hover:bg-amber-900/60'
                  }`}
                >
                  ✨ {tr('각성연계', 'Awaken')}
                </button>
              </div>
            </div>
          )}

          {/* Always-Available SNSHero Local LLM Question + Command Bar (with Mic when Local LLM supported) */}
          {menuOpen && (
            <div className="border-b border-amber-400/20 bg-black/45 px-2 py-2">
              {llmCap.supported && (
                <div className="mb-1 flex items-center justify-between text-[9.5px] font-extrabold text-sky-300/90">
                  <span>
                    🤖 {isKo ? `${llmCap.engineLabelKo} 질문·명령 대기` : `${llmCap.engineLabelEn} Ready`}
                  </span>
                  {micListening && (
                    <span className="animate-pulse text-rose-300">
                      ● {tr('음성 인식 중...', 'Listening...')}
                    </span>
                  )}
                </div>
              )}
              <form onSubmit={handleTacticInputSubmit} data-testid="kadan-command-form" className="flex items-center gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  data-testid="kadan-tactic-chat-input"
                  value={tacticInput}
                  disabled={llmLoading}
                  onChange={(e) => setTacticInput(e.target.value)}
                  placeholder={
                    screen === 'BATTLE'
                      ? tr("질문/명령 (예: '명치 쳐', '실리아 필살기?')", "Ask/Command (e.g. 'aggro', 'Silia skill?')")
                      : tr("SNSHero 질문 (예: '3배 각성이 뭐야?')", "Ask SNSHero (e.g. 'How does 3x work?')")
                  }
                  className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-amber-400/35 bg-stone-950 px-2.5 py-1.5 text-[11px] font-bold text-amber-100 placeholder:text-stone-500 focus:border-amber-300 focus:outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  data-testid="kadan-command-submit-btn"
                  disabled={llmLoading}
                  className="min-h-[44px] shrink-0 rounded-lg border border-amber-300/60 bg-amber-700 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-amber-600 disabled:opacity-60"
                >
                  {llmLoading ? '...' : tr('명령', 'Go')}
                </button>
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
                    title={tr('마이크 음성 질문 (로컬 AI)', 'Voice Ask (Local AI)')}
                    className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border transition ${
                      micListening
                        ? 'animate-pulse border-rose-300 bg-rose-600 text-white shadow-[0_0_12px_rgba(244,63,94,0.85)]'
                        : 'border-sky-400/65 bg-sky-950/90 text-sky-200 hover:border-sky-300 hover:bg-sky-900'
                    }`}
                  >
                    {micListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}
              </form>
            </div>
          )}

          {/* Context-Sensitive Help Action List */}
          {menuOpen && (
            <div
              data-testid="kadan-chatbot-menu"
              className="flex max-h-[250px] flex-col gap-1 overflow-y-auto p-2 sm:max-h-[290px]"
            >
              {helpOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`kadan-help-${opt.id}`}
                  onClick={opt.onSelect}
                  className={`flex min-h-[38px] w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-[11.5px] font-extrabold transition active:scale-[0.98] sm:text-xs ${
                    opt.highlight === 'autoplay'
                      ? 'border-emerald-300/90 bg-gradient-to-r from-emerald-700 via-teal-700 to-sky-800 text-white shadow-[0_4px_14px_rgba(16,185,129,0.45)] hover:brightness-110'
                      : opt.highlight === 'nav'
                        ? 'border-sky-400/40 bg-sky-950/45 text-sky-100 hover:border-sky-300 hover:bg-sky-900/60'
                        : 'border-amber-400/30 bg-stone-900/90 text-amber-100 hover:border-amber-300/75 hover:bg-stone-800'
                  }`}
                >
                  <span className="shrink-0 text-sm">{opt.icon}</span>
                  <span className="flex-1 leading-snug">{opt.label}</span>
                  <span className="shrink-0 text-[10px] opacity-75">
                    {opt.highlight === 'autoplay'
                      ? tr('달리기 ▶', 'Run ▶')
                      : opt.highlight === 'nav'
                        ? tr('이동 ›', 'Go ›')
                        : tr('대사 ›', 'Ask ›')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Reopen Help Button when only Speech Bubble is shown */}
          {!menuOpen && speechText && !autoPlay && (
            <div className="flex justify-end bg-stone-950/80 px-2.5 py-1.5">
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.6);
                  setMenuOpen(true);
                }}
                className="rounded-lg border border-sky-400/50 bg-sky-950/80 px-2.5 py-1 text-[11px] font-extrabold text-sky-200 hover:bg-sky-900"
              >
                {tr('💬 다른 도움말 보기', '💬 More Help Topics')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live 1-Tap Tactical Switcher Strip While Auto-Playing in Battle */}
      {screen === 'BATTLE' && autoPlay && !menuOpen && onChangeTacticalStance && (
        <div
          onClick={(e) => e.stopPropagation()}
          data-testid="kadan-live-tactic-strip"
          className="pointer-events-auto mb-1 flex items-center gap-1 rounded-full border border-amber-300/45 bg-stone-950/92 p-1 shadow-xl"
        >
          <button
            type="button"
            onClick={() => applyTacticalCommand('AGGRO')}
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold transition ${
              tacticalStance === 'AGGRO'
                ? 'bg-rose-600 text-white shadow-[0_0_10px_rgba(244,63,94,0.85)]'
                : 'text-rose-200/80 hover:bg-rose-950/60'
            }`}
          >
            ⚔ {tr('맹공', 'Aggro')}
          </button>
          <button
            type="button"
            onClick={() => applyTacticalCommand('CONTROL')}
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold transition ${
              tacticalStance === 'CONTROL'
                ? 'bg-sky-600 text-white shadow-[0_0_10px_rgba(56,189,248,0.85)]'
                : 'text-sky-200/80 hover:bg-sky-950/60'
            }`}
          >
            🛡 {tr('수비', 'Ctrl')}
          </button>
          <button
            type="button"
            onClick={() => applyTacticalCommand('AWAKENING')}
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold transition ${
              tacticalStance === 'AWAKENING'
                ? 'bg-amber-400 text-stone-950 shadow-[0_0_10px_rgba(251,191,36,0.85)]'
                : 'text-amber-200/80 hover:bg-amber-950/60'
            }`}
          >
            ✨ {tr('각성', 'Awkn')}
          </button>
        </div>
      )}

      {/* Bottom-Right 2-Head-Tall Chibi Kadan Character Button */}
      <button
        type="button"
        data-testid="kadan-chatbot-avatar-btn"
        data-kadan-mode={autoPlay ? 'running' : 'idle'}
        onClick={handleKadanClick}
        aria-label={
          autoPlay
            ? tr('달리는 카단 (클릭 시 자동플레이 중지)', 'Running Kadan (Click to stop Auto-Play)')
            : tr('카단 챗봇 (클릭 시 카드 도움말 열기)', 'Kadan Chatbot (Click for card help)')
        }
        className="pointer-events-auto group relative flex flex-col items-center focus:outline-none"
      >
        {/* Running Aura / Speed Lines Effect when Auto-Play is Active */}
        {autoPlay && (
          <div className="pointer-events-none absolute inset-x-1 bottom-4 top-2 rounded-full bg-emerald-400/20 blur-md animate-pulse" />
        )}

        {/* Chibi Kadan Sprite (Pre-mounted 4-frame opacity swap — zero WebKit image re-decode per tick!) */}
        <div
          className={`relative flex h-[74px] w-[74px] items-center justify-center transition-transform duration-150 group-hover:scale-108 group-active:scale-95 sm:h-[92px] sm:w-[92px] ${
            autoPlay ? 'drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]' : 'drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]'
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

          {/* Cute Floating "?" / "⚡" Status Pin */}
          <span
            className={`pointer-events-none absolute -left-0.5 top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border px-1 text-[10px] font-black shadow-md sm:h-6 sm:min-w-[24px] sm:text-xs ${
              autoPlay
                ? 'border-emerald-200 bg-emerald-600 text-white animate-bounce'
                : menuOpen
                  ? 'border-sky-200 bg-sky-600 text-white'
                  : 'border-amber-200 bg-stone-900/95 text-amber-200'
            }`}
          >
            {autoPlay ? '⚡' : '?'}
          </span>
        </div>

        {/* Nameplate Pill Below Kadan's Boots */}
        <div
          className={`-mt-1.5 flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold shadow-[0_4px_10px_rgba(0,0,0,0.9)] transition sm:px-3 sm:text-[11px] ${
            autoPlay
              ? 'border-emerald-300 bg-gradient-to-r from-emerald-700 to-teal-900 text-emerald-50'
              : 'border-[#deb96e] bg-stone-950/95 text-amber-100 group-hover:border-sky-300 group-hover:text-sky-100'
          }`}
        >
          <span>
            {autoPlay
              ? tr('자동플레이 중 (정지)', 'Auto-Playing (Stop)')
              : tr('카단 도움말', 'Ask Kadan')}
          </span>
        </div>
      </button>
    </div>
  );
};
