import React, { Suspense, useCallback, useEffect, useState } from 'react';
import LZString from 'lz-string';
import { tr, useHeroLanguage } from '../i18n/heroLang';
import { hsAudio } from './audio';
import { cardDb, decodeDeckShareCode } from './cardDb';
import { GameAdSenseLayout } from './components/GameAdSenseLayout';
import type { ArchetypePresetId } from './components/PreBattleDeckModal';
import {
  KadanChatbotWidget,
  LiveBattleHelpSnapshot,
} from './components/KadanChatbotWidget';
import {
  GameOptionsModal,
  PaymentSuccessModal,
  QuestLogModal,
  TavernShopModal,
} from './components/Modals';
import { SNS_LOGO_URL } from './components/SnsHeroArtKit';
import { initSnsHeroConsoleApi } from './consoleApi';
import {
  GamePaymentReturnResult,
  POPUP_PAYMENT_EVENT_KEY,
  buildPayPalCheckoutUrl,
  checkAndProcessGamePaymentReturn,
  getPaymentPopupBridgeParams,
  launchPayAppCheckoutInCurrentWindow,
} from './paymentGateway';
import { BoxHubScreen } from './screens/BoxHubScreen';
import type { BattleScreenProps } from './screens/BattleScreen';
import type { HeroDeckSelectScreenProps } from './screens/HeroDeckSelectScreen';

const hsScreenModules = import.meta.glob<Record<string, React.ComponentType<any>>>(
  './screens/{BattleScreen,CollectionScreen,HeroDeckSelectScreen,PackOpeningScreen}.tsx',
);

function loadHsScreenSafely<P>(fileName: string, exportName: string): React.LazyExoticComponent<React.ComponentType<P>> {
  return React.lazy(async () => {
    const loader = hsScreenModules[`./screens/${fileName}.tsx`];
    if (!loader) {
      return { default: (() => null) as React.ComponentType<P> };
    }
    const mod = await loader();
    return { default: (mod[exportName] || mod.default || (() => null)) as React.ComponentType<P> };
  });
}

const BattleScreen = loadHsScreenSafely<BattleScreenProps>('BattleScreen', 'BattleScreen');
const CollectionScreen = loadHsScreenSafely<{
  onBack: () => void;
  onProfileChanged: () => void;
  onOpenShop?: () => void;
  onReturnToJourney?: () => void;
}>('CollectionScreen', 'CollectionScreen');
const HeroDeckSelectScreen = loadHsScreenSafely<HeroDeckSelectScreenProps>(
  'HeroDeckSelectScreen',
  'HeroDeckSelectScreen',
);
const PackOpeningScreen = loadHsScreenSafely<{
  onBack: () => void;
  onOpenShop: () => void;
  onProfileChanged: () => void;
  onOpenCollection?: () => void;
  onReturnToJourney?: () => void;
}>('PackOpeningScreen', 'PackOpeningScreen');
import { initGamePwaFullscreen, isStandalonePwa } from './pwaFullscreen';
import { hsStorage } from './storage';
import {
  BattleMatchState,
  BoardThemeId,
  ChallengerMeta,
  CustomDeck,
  GameMode,
  HeroClass,
  KadanTacticalStance,
  PlayerProfile,
  ScreenName,
} from './types';

export const HearthstoneApp: React.FC = () => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.lang = isKo ? 'ko' : 'en';
    document.title = isKo
      ? '눈히어로 — 엘윈마을 카드 배틀'
      : 'SNSHero — Elwin Village Card Battle';
  }, [isKo]);

  const [screen, setScreen] = useState<ScreenName>('BOX_HUB');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);

  useEffect(() => {
    if (!ready) return;
    const isLocalHost = /^(localhost|127\.0\.0\.1|.*\.ts\.net)$/i.test(window.location.hostname);
    const debugEnabled = /[?&]ga_debug=1\b/.test(window.location.search);
    if (isLocalHost && !debugEnabled) return;
    const w = window as Window & { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') {
      w.gtag('event', 'screen_view', {
        app_name: 'SNSHero',
        screen_name: screen,
      });
    }
  }, [ready, screen]);

  const [selectedMode, setSelectedMode] = useState<GameMode>('RANKED');
  const [battleSessionKey, setBattleSessionKey] = useState(1);
  const [returnToJourneyActive, setReturnToJourneyActive] = useState(false);
  const [globalAutoPlay, setGlobalAutoPlay] = useState(false);
  const [tacticalStance, setTacticalStance] = useState<KadanTacticalStance>('BALANCED');
  const [battleSnapshot, setBattleSnapshot] = useState<LiveBattleHelpSnapshot | null>(null);
  const [activeBattleParams, setActiveBattleParams] = useState<{
    mode: GameMode;
    deck: CustomDeck;
    preferredOpponentClass?: HeroClass;
    boardTheme?: BoardThemeId;
    journeyEpisodeOverride?: number;
    skipStoryIntro?: boolean;
    initialPresetId?: ArchetypePresetId;
    openPresetModalOnStart?: boolean;
    bogartStakeGold?: number;
    challengerMeta?: ChallengerMeta;
    restoredMatchState?: BattleMatchState;
  } | null>(null);
  const [pendingGambleEscrow, setPendingGambleEscrow] = useState<{
    matchState: BattleMatchState;
    deck: CustomDeck;
    bogartStakeGold: number;
    challengerMeta?: ChallengerMeta;
  } | null>(null);

  // Popup checkout bridge state (only active inside window.open popup)
  const [popupBridge] = useState(() => getPaymentPopupBridgeParams());
  const [popupReturnDone, setPopupReturnDone] = useState<GamePaymentReturnResult | null>(null);
  const [popupBridgeStatus, setPopupBridgeStatus] = useState<'launching' | 'ready' | 'error'>(
    'launching',
  );

  // Global Modals & Deep-link Notice
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [launchNotice, setLaunchNotice] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<GamePaymentReturnResult | null>(null);
  const [optionsState, setOptionsState] = useState<{
    open: boolean;
    inBattle: boolean;
    concedeFn?: () => void;
  }>({ open: false, inBattle: false });

  const refreshProfile = useCallback(() => {
    setProfile(hsStorage.getProfile());
  }, []);

  useEffect(() => {
    let mounted = true;
    initSnsHeroConsoleApi();
    initGamePwaFullscreen();

    const syncFromStorage = () => {
      if (mounted) {
        setProfile(hsStorage.getProfile());
      }
    };

    const handlePopupPaymentMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as {
        type?: string;
        result?: GamePaymentReturnResult;
      } | null;
      if (data?.type === 'SNSHERO_GAME_PAYMENT_COMPLETE' && data.result?.handled) {
        if (!mounted) return;
        setProfile(hsStorage.getProfile());
        setShopOpen(false);
        setPaymentResult(data.result);
      }
    };

    const handleStorageEvent = (ev: StorageEvent) => {
      if (ev.key === POPUP_PAYMENT_EVENT_KEY && ev.newValue) {
        try {
          const parsed = JSON.parse(ev.newValue) as GamePaymentReturnResult;
          if (parsed?.handled && mounted) {
            setProfile(hsStorage.getProfile());
            setShopOpen(false);
            setPaymentResult(parsed);
          }
        } catch {
          // ignore malformed storage event
        }
      }
    };

    window.addEventListener('snshero:state-changed', syncFromStorage);
    window.addEventListener('message', handlePopupPaymentMessage);
    window.addEventListener('storage', handleStorageEvent);

    cardDb
      .init()
      .then(() => {
        if (!mounted) return;
        hsStorage.ensureInitialized();
        try {
          localStorage.setItem('snshero_has_played', '1');
        } catch {
          // ignore storage quota errors
        }
        // DEV-049(1): Auto-claim showcase pre-opened pack cards into permanent collection on any /game entry
        const autoShowcaseClaim = hsStorage.claimPromoPrePack();
        if (autoShowcaseClaim.claimed) {
          setProfile(hsStorage.getProfile());
          setLaunchNotice(
            tr(
              `🎉 쇼케이스에서 뽑은 카드 ${autoShowcaseClaim.cards.length}장이 내 카드첩에 영구 장착되었습니다!`,
              `🎉 ${autoShowcaseClaim.cards.length} card(s) drawn on the Showcase are now permanently equipped in your Collection!`,
            ),
          );
        }
        const payRes = checkAndProcessGamePaymentReturn();
        if (payRes.handled) {
          if (payRes.closedPopup) {
            setPopupReturnDone(payRes);
          } else {
            setPaymentResult(payRes);
            setScreen('BOX_HUB');
          }
        } else {
          // Preserve marketing / novel / webtoon deep-link intent in sessionStorage across gates (DEV-018)
          const params = new URLSearchParams(window.location.search);
          if (window.location.search && typeof sessionStorage !== 'undefined') {
            try {
              sessionStorage.setItem(
                'snshero_deeplink_intent',
                JSON.stringify({
                  mode: params.get('mode') || '',
                  ep: params.get('ep') || '',
                  faction: params.get('faction') || '',
                  open: params.get('open') || '',
                }),
              );
            } catch {
              // ignore sessionStorage error
            }
          }
          const launchMode = params.get('mode')?.toLowerCase();
          const openParam = params.get('open')?.toLowerCase();
          const ftueParam = params.get('ftue')?.toLowerCase();
          const coachParam = params.get('coach')?.toLowerCase();
          const claimPromo = params.get('claim_promo') === '1';
          if (ftueParam === 'veteran') {
            hsStorage.setVeteranUnlockAll(true);
            hsStorage.markJourneyGuideDone();
          }
          if (coachParam === 'on' && typeof sessionStorage !== 'undefined') {
            try {
              sessionStorage.setItem('hero_hs_coach_mode', '1');
            } catch {
              // ignore
            }
          }
          const factionParam = params.get('faction')?.toUpperCase() as HeroClass | undefined;
          const starterParam = params.get('starter')?.toLowerCase();
          const presetParamRaw = (params.get('preset') || params.get('style'))?.toLowerCase();
          const tacticParamRaw = (params.get('tactic') || params.get('style'))?.toLowerCase();
          const rhythmParam = params.get('rhythm')?.toLowerCase();
          const stakeParamRaw = params.get('stake') || params.get('bet');
          if (stakeParamRaw !== null && !Number.isNaN(Number(stakeParamRaw))) {
            const parsedStake = Math.max(1, Math.min(1000, Math.floor(Number(stakeParamRaw))));
            try {
              sessionStorage.setItem('snshero_bogart_stake', String(parsedStake));
            } catch {
              // ignore sessionStorage error
            }
          }
          if (rhythmParam === 'on' || rhythmParam === '1' || rhythmParam === 'true') {
            hsAudio.updateSettings({ rhythmAutoEnabled: true });
          } else if (rhythmParam === 'off' || rhythmParam === '0' || rhythmParam === 'false') {
            hsAudio.updateSettings({ rhythmAutoEnabled: false });
          }
          const deckParam = params.get('deck') || params.get('challenge');
          const isChallengeLaunch = Boolean(params.get('challenge'));
          const restoreParam = params.get('restore');
          const epParamRaw = params.get('ep');
          const epNum =
            epParamRaw !== null && !Number.isNaN(Number(epParamRaw))
              ? Math.max(0, Math.min(40, Math.floor(Number(epParamRaw))))
              : undefined;

          const resolvedPresetId: ArchetypePresetId | undefined =
            presetParamRaw === 'aggro' || presetParamRaw === 'ignis_aggro'
              ? 'AGGRO'
              : presetParamRaw === 'control' || presetParamRaw === 'defense' || presetParamRaw === 'paladin_aggro'
                ? 'CONTROL'
                : presetParamRaw === 'awakening'
                  ? 'AWAKENING'
                  : undefined;

          const resolvedTacticStance: KadanTacticalStance | undefined =
            tacticParamRaw === 'aggressive' || tacticParamRaw === 'aggro'
              ? 'AGGRO'
              : tacticParamRaw === 'defensive' || tacticParamRaw === 'control' || tacticParamRaw === 'defense'
                ? 'CONTROL'
                : tacticParamRaw === 'awakening'
                  ? 'AWAKENING'
                  : resolvedPresetId;

          if (resolvedTacticStance) {
            setTacticalStance(resolvedTacticStance);
          }

          const starterHeroClass: HeroClass | undefined =
            starterParam === 'human' || presetParamRaw === 'defense'
              ? 'PRIEST'
              : starterParam === 'fire' || presetParamRaw === 'aggro'
                ? 'WARRIOR'
                : starterParam === 'undead' || presetParamRaw === 'awakening'
                  ? 'ROGUE'
                  : undefined;
          const effectiveFaction = factionParam || starterHeroClass;

          const wantAutoPlay =
            params.get('autoplay') === '1' ||
            params.get('autoplay') === 'true' ||
            rhythmParam === 'on' ||
            rhythmParam === '1' ||
            rhythmParam === 'true';
          setGlobalAutoPlay(wantAutoPlay);
          const decks = hsStorage.getDecks();
          const chosenDeck =
            (effectiveFaction && decks.find((d) => d.heroClass === effectiveFaction)) ||
            decks.find((d) => d.heroClass === 'PRIEST') ||
            decks[0];

          if (restoreParam) {
            try {
              const jsonText = LZString.decompressFromEncodedURIComponent(restoreParam);
              if (jsonText) {
                const restoreRes = hsStorage.restoreGameBackupJson(jsonText);
                setLaunchNotice(restoreRes.message);
                try {
                  const cleanUrl = new URL(window.location.href);
                  cleanUrl.searchParams.delete('restore');
                  window.history.replaceState(window.history.state, '', cleanUrl.toString());
                } catch {
                  // ignore url clean error
                }
              }
            } catch {
              // ignore restore error
            }
            setScreen('BOX_HUB');
          } else if (claimPromo) {
            hsStorage.markJourneyGuideDone();
            const claimRes = hsStorage.claimPromoPrePack();
            if (claimRes.claimed) {
              setLaunchNotice(
                tr(
                  `🎉 프로모션 무료 1호 팩 5장이 내 카드첩에 영구 보관되었습니다! 남은 무료 팩을 지금 개봉하세요.`,
                  `🎉 Your 5 promo pack cards are now saved in your Collection! Open your remaining free packs below.`,
                ),
              );
            }
            setScreen('PACK_OPENING');
          } else if (deckParam) {
            hsStorage.markJourneyGuideDone();
            const parsedDeck = decodeDeckShareCode(deckParam);
            if (parsedDeck) {
              const col = hsStorage.getCollection();
              const validCards: string[] = [];
              for (const cid of parsedDeck.cards) {
                const def = cardDb.getCard(cid);
                if (
                  def &&
                  (def.cardClass === parsedDeck.heroClass || def.cardClass === 'NEUTRAL') &&
                  validCards.length < 30
                ) {
                  const owned = col[def.id] || 0;
                  const cap = Math.min(owned, def.rarity === 'LEGENDARY' ? 1 : 2);
                  if (validCards.filter((x) => x === def.id).length < cap) {
                    validCards.push(def.id);
                  }
                }
              }
              const newDeck: CustomDeck = {
                id: `deck_${Date.now()}`,
                name: parsedDeck.name || `${parsedDeck.heroClass} Shared Deck`,
                heroClass: parsedDeck.heroClass,
                cards: validCards,
              };
              hsStorage.saveDecks([newDeck, ...decks]);
              if (isChallengeLaunch && validCards.length >= 10) {
                while (newDeck.cards.length < 30) {
                  newDeck.cards.push(chosenDeck.cards[newDeck.cards.length % chosenDeck.cards.length]);
                }
                setLaunchNotice(
                  tr(
                    `⚔ 챌린지 공유 덱 [${newDeck.name}] & 카단 전술이 장착되었습니다!`,
                    `⚔ Challenge Deck [${newDeck.name}] & Kadan Stance equipped!`,
                  ),
                );
                setActiveBattleParams({
                  mode: 'RANKED',
                  deck: newDeck,
                  skipStoryIntro: true,
                });
                setScreen('BATTLE');
              } else {
                setLaunchNotice(
                  tr(
                    `🔗 공유된 덱 [${newDeck.name}] (${validCards.length}/30장)을 내 덱 목록에 불러왔습니다!`,
                    `🔗 Imported shared deck [${newDeck.name}] (${validCards.length}/30 cards)!`,
                  ),
                );
                setScreen('COLLECTION');
              }
            } else {
              setScreen('COLLECTION');
            }
          } else if (openParam === 'pack3' || openParam === 'pack') {
            hsStorage.markJourneyGuideDone();
            if (factionParam) {
              setLaunchNotice(
                tr(
                  `🔥 [${factionParam}] 종족 선택 완료! 무료 3팩을 먼저 개봉한 뒤 스토리모드·랭킹전에 출정하세요!`,
                  `🔥 Faction [${factionParam}] selected! Open your 3 Free Packs and jump into battle!`,
                ),
              );
            }
            setScreen('PACK_OPENING');
          } else if (openParam === 'shop' || params.get('tab')?.toLowerCase() === 'shop') {
            hsStorage.markJourneyGuideDone();
            const catRaw = params.get('category')?.toLowerCase();
            if (catRaw) {
              try {
                sessionStorage.setItem(
                  'snshero_shop_category',
                  catRaw === 'cardback' || catRaw === 'card_back' ? 'CARDBACK' : catRaw.toUpperCase(),
                );
              } catch {
                // ignore
              }
            }
            setScreen('BOX_HUB');
            setShopOpen(true);
          } else if (launchMode === 'story') {
            hsStorage.markJourneyGuideDone();
            const curProg = hsStorage.getProfile();
            const maxCleared = curProg.journeyMaxStageCleared || 0;
            if (epNum !== undefined) {
              if (epNum > maxCleared + 1 && curProg.journeyReincarnation === 0) {
                setLaunchNotice(
                  tr(
                    `⚔ 제${epNum}화 스토리 체험 모드로 바로 출격합니다! (현재 해금 진행도: ${maxCleared}화)`,
                    `⚔ Launching Story Preview for EP.${epNum}! (Unlocked up to EP.${maxCleared})`,
                  ),
                );
              }
              hsStorage.setJourneyProgress(epNum, curProg.journeyReincarnation);
            }
            setActiveBattleParams({
              mode: 'TUTORIAL',
              deck: chosenDeck,
              preferredOpponentClass: 'ROGUE',
              boardTheme: 'ELWIN_SNOW',
              journeyEpisodeOverride: epNum,
              skipStoryIntro: params.get('skipIntro') === '1' || params.get('skipIntro') === 'true',
              initialPresetId: resolvedPresetId,
              openPresetModalOnStart: openParam === 'preset',
            });
            setScreen('BATTLE');
          } else if (launchMode === 'story_battle') {
            hsStorage.markJourneyGuideDone();
            setActiveBattleParams({
              mode: 'TUTORIAL',
              deck: chosenDeck,
              preferredOpponentClass: 'ROGUE',
              boardTheme: 'ELWIN_SNOW',
              journeyEpisodeOverride: epNum,
              skipStoryIntro: true,
              initialPresetId: resolvedPresetId,
              openPresetModalOnStart: openParam === 'preset',
            });
            setScreen('BATTLE');
          } else if (launchMode === 'ranked_battle') {
            hsStorage.markJourneyGuideDone();
            setActiveBattleParams({
              mode: 'RANKED',
              deck: chosenDeck,
              preferredOpponentClass: 'WARRIOR',
              boardTheme: 'CRIMSON_FORGE',
              skipStoryIntro: true,
              initialPresetId: resolvedPresetId,
              openPresetModalOnStart: openParam === 'preset',
            });
            setScreen('BATTLE');
          } else if (launchMode === 'ai_battle' || starterHeroClass || resolvedPresetId) {
            hsStorage.markJourneyGuideDone();
            setActiveBattleParams({
              mode: 'PRACTICE_NORMAL',
              deck: chosenDeck,
              preferredOpponentClass: starterHeroClass === 'WARRIOR' ? 'MAGE' : 'HUNTER',
              boardTheme:
                starterHeroClass === 'WARRIOR'
                  ? 'ORGRIMMAR'
                  : starterHeroClass === 'ROGUE'
                    ? 'PANDARIA'
                    : 'STORMWIND',
              skipStoryIntro: true,
              initialPresetId: resolvedPresetId,
              openPresetModalOnStart: openParam === 'preset',
            });
            setScreen('BATTLE');
          } else if (launchMode === 'pack') {
            setScreen('PACK_OPENING');
          } else if (launchMode === 'collection') {
            setScreen('COLLECTION');
          } else if (launchMode === 'gamble' || launchMode === 'bogart') {
            hsStorage.markJourneyGuideDone();
            setSelectedMode('BOGART_GAMBLE');
            setScreen('HERO_SELECT');
          } else if (launchMode === 'ranked') {
            hsStorage.markJourneyGuideDone();
            setSelectedMode('RANKED');
            setScreen('HERO_SELECT');
          } else if (launchMode === 'ai') {
            hsStorage.markJourneyGuideDone();
            setSelectedMode('PRACTICE_NORMAL');
            setScreen('HERO_SELECT');
          } else if (isStandalonePwa()) {
            setScreen('BOX_HUB');
          }

          if (
            !launchMode &&
            !openParam &&
            !claimPromo &&
            !deckParam &&
            !restoreParam &&
            !starterHeroClass &&
            !resolvedPresetId
          ) {
            try {
              const lastNovelEpRaw = localStorage.getItem('hero_hs_last_novel_ep');
              const lastNovelEp = lastNovelEpRaw ? parseInt(lastNovelEpRaw, 10) : 0;
              if (lastNovelEp >= 1 && lastNovelEp <= 40) {
                setLaunchNotice(
                  tr(
                    `📖 방금 웹소설 제${lastNovelEp}화를 읽으셨군요! 상단 스토리모드에서 제${lastNovelEp}화 성우 풀보이스 보스전으로 바로 이어서 플레이하세요!`,
                    `📖 Just read Web Novel EP.${lastNovelEp}? Jump straight into Story Mode EP.${lastNovelEp} Boss Battle!`,
                  ),
                );
              }
            } catch {
              // ignore storage error
            }
          }
        }
        // DEV-031: Check for active Bogart Gambling Hall escrow snapshot on refresh (F5)
        if (typeof sessionStorage !== 'undefined') {
          try {
            const escrowRaw = sessionStorage.getItem('snshero_gamble_active_match');
            if (escrowRaw) {
              const parsedEscrow = JSON.parse(escrowRaw);
              if (parsedEscrow?.matchState && parsedEscrow?.deck && parsedEscrow.matchState.phase !== 'GAME_OVER') {
                setPendingGambleEscrow({
                  matchState: parsedEscrow.matchState,
                  deck: parsedEscrow.deck,
                  bogartStakeGold: parsedEscrow.bogartStakeGold ?? 100,
                  challengerMeta: parsedEscrow.challengerMeta,
                });
              }
            }
          } catch {
            // ignore malformed escrow
          }
        }
        setProfile(hsStorage.getProfile());
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setLoadError(err instanceof Error ? err.message : tr('데이터 로드 오류', 'Data loading error'));
      });

    return () => {
      mounted = false;
      window.removeEventListener('snshero:state-changed', syncFromStorage);
      window.removeEventListener('message', handlePopupPaymentMessage);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // Automatically launch payment module inside popup bridge window (`?pay_popup_bridge=1`)
  useEffect(() => {
    if (!ready || !popupBridge.isBridge || popupReturnDone) return;
    if (popupBridge.method === 'paypal') {
      window.location.href = buildPayPalCheckoutUrl(popupBridge.pkg, true);
      return;
    }
    let active = true;
    launchPayAppCheckoutInCurrentWindow(popupBridge.pkg, popupBridge.method).then((ok) => {
      if (!active) return;
      setPopupBridgeStatus(ok ? 'ready' : 'error');
    });
    return () => {
      active = false;
    };
  }, [ready, popupBridge, popupReturnDone]);

  const launchJourneyBattle = useCallback(
    (episodeOverride?: number, skipStoryIntro = false, startWithAutoPlay = false) => {
      hsStorage.markJourneyGuideDone();
      const decks = hsStorage.getDecks();
      const kadanDeck = decks.find((d) => d.heroClass === 'PRIEST') || decks[0];
      setReturnToJourneyActive(false);
      setGlobalAutoPlay(startWithAutoPlay);
      setBattleSnapshot(null);
      setBattleSessionKey((k) => k + 1);
      setActiveBattleParams({
        mode: 'TUTORIAL',
        deck: kadanDeck,
        preferredOpponentClass: 'ROGUE',
        boardTheme: 'STORMWIND',
        journeyEpisodeOverride: episodeOverride,
        skipStoryIntro,
      });
      refreshProfile();
      setScreen('BATTLE');
    },
    [refreshProfile],
  );

  const handleEnableAutoPlayFromKadan = useCallback(() => {
    if (screen === 'BATTLE' && activeBattleParams) {
      setGlobalAutoPlay(true);
      return;
    }
    const decks = hsStorage.getDecks();
    const kadanDeck = decks.find((d) => d.heroClass === 'PRIEST') || decks[0];
    if (screen === 'HERO_SELECT') {
      setReturnToJourneyActive(false);
      setBattleSnapshot(null);
      setGlobalAutoPlay(true);
      setBattleSessionKey((k) => k + 1);
      setActiveBattleParams({
        mode: selectedMode,
        deck: kadanDeck,
        skipStoryIntro: true,
      });
      setScreen('BATTLE');
      return;
    }
    launchJourneyBattle(undefined, false, true);
  }, [screen, activeBattleParams, selectedMode, launchJourneyBattle]);

  if (loadError) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-stone-950 p-6 text-center text-amber-100">
        <h1 className="text-2xl font-extrabold text-red-400">
          {tr('눈히어로 데이터를 불러오지 못했습니다', 'Failed to load SNSHero game data')}
        </h1>
        <p className="mt-2 text-sm text-amber-200/80">{loadError}</p>
      </div>
    );
  }

  // Dedicated popup return view (closes automatically and returns to main game window)
  if (popupReturnDone) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-[#0c0805] p-6 text-center text-amber-100">
        <img src={SNS_LOGO_URL} alt={tr('눈히어로', 'SNSHero')} className="w-48 drop-shadow" />
        <div className="mt-5 max-w-md rounded-2xl border-2 border-emerald-400/70 bg-emerald-950/50 p-6 shadow-2xl">
          <div className="text-xl font-extrabold text-emerald-200">
            {tr('결제 및 보급품 지급 완료!', 'Payment & Supplies Delivered!')}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/90">
            <strong className="text-amber-200">{popupReturnDone.label}</strong>{' '}
            {tr(
              '결제가 완료되어 열려 있는 눈히어로 본 게임 화면에 즉시 반영되었습니다.',
              'payment completed and applied to your active SNSHero game window.',
            )}
          </p>
          <button
            type="button"
            onClick={() => window.close()}
            className="hs-gold-btn mt-5 w-full rounded-xl px-5 py-3 text-sm font-extrabold"
          >
            {tr('창 닫고 게임으로 돌아가기', 'Close Window & Return to Game')}
          </button>
        </div>
      </div>
    );
  }

  // Dedicated popup checkout bridge view (`?pay_popup_bridge=1`)
  if (popupBridge.isBridge) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-[#0c0805] p-6 text-center text-amber-100">
        <img src={SNS_LOGO_URL} alt={tr('눈히어로', 'SNSHero')} className="w-48 drop-shadow" />
        <div className="mt-5 w-full max-w-md rounded-2xl border-2 border-amber-500/60 bg-stone-950/90 p-6 shadow-2xl">
          <div className="text-xs font-extrabold tracking-widest text-amber-300">
            {tr('눈히어로 공식 팝업 결제창', 'SNSHero Official Checkout Window')}
          </div>
          <h2 className="mt-1 text-xl font-extrabold text-white">{popupBridge.pkg.name}</h2>
          <div className="mt-1 text-lg font-black text-amber-300">
            {popupBridge.pkg.priceUsdLabel}{' '}
            <span className="text-xs font-bold text-amber-200/75">
              ({popupBridge.pkg.priceKrwLabel})
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-amber-100/80">
            {popupBridgeStatus === 'error'
              ? tr(
                  '결제 모듈 호출이 지연되었습니다. 아래 버튼을 눌러 다시 시도하거나 본 화면에서 다른 수단을 선택해 주세요.',
                  'Checkout module timed out. Tap below to retry or choose another payment method in the main window.',
                )
              : tr(
                  '안전한 외부 결제 모듈을 연결하고 있습니다. 결제 성공 시 이 창이 자동으로 닫히고 본 게임 화면으로 즉시 돌아갑니다.',
                  'Connecting to secure checkout. This window closes automatically once payment succeeds.',
                )}
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            {popupBridge.method !== 'paypal' && (
              <button
                type="button"
                onClick={() => {
                  setPopupBridgeStatus('launching');
                  launchPayAppCheckoutInCurrentWindow(
                    popupBridge.pkg,
                    popupBridge.method as 'card' | 'kakaopay' | 'naverpay' | 'applepay',
                  ).then((ok) => setPopupBridgeStatus(ok ? 'ready' : 'error'));
                }}
                className="hs-gold-btn w-full rounded-xl px-4 py-3 text-sm font-extrabold"
              >
                {tr('결제창 다시 열기', 'Reopen Checkout')}
              </button>
            )}
            <button
              type="button"
              onClick={() => window.close()}
              className="hs-brass-btn w-full rounded-xl px-4 py-2.5 text-xs font-extrabold text-amber-100"
            >
              {tr('결제 취소 및 창 닫기', 'Cancel & Close Window')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!ready || !profile) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-stone-950 text-amber-100">
        <img
          src={SNS_LOGO_URL}
          alt={tr('눈히어로', 'SNSHero')}
          className="w-64 animate-pulse drop-shadow-[0_12px_28px_rgba(56,189,248,0.45)]"
        />
        <div className="mt-4 text-sm font-extrabold tracking-wider text-sky-200">
          {tr('엘윈마을 대결 광장을 준비하고 있습니다...', 'Preparing Elwin Village Arena...')}
        </div>
      </div>
    );
  }

  const hideAdsForFtue =
    !profile.journeyGuideDone && profile.totalGames === 0;

  return (
    <>
      <GameAdSenseLayout
        screenKey={screen}
        hideAdsForFtue={hideAdsForFtue}
        onOpenAdRemovalShop={() => setShopOpen(true)}
      >
        {launchNotice && (
          <div className="pointer-events-auto fixed left-1/2 top-14 z-[140] flex w-[92%] max-w-xl -translate-x-1/2 items-center justify-between gap-2 rounded-2xl border-2 border-amber-300 bg-[#1a0f08]/95 px-4 py-2.5 text-xs font-extrabold text-amber-100 shadow-2xl">
            <span>{launchNotice}</span>
            <button
              type="button"
              onClick={() => setLaunchNotice(null)}
              className="shrink-0 rounded-lg border border-amber-400/50 bg-black/50 px-2 py-1 text-[11px] text-amber-200 hover:bg-black"
            >
              ✕
            </button>
          </div>
        )}
        {screen === 'BOX_HUB' && (
          <BoxHubScreen
            profile={profile}
            onSelectPlayMode={(m) => {
              setGlobalAutoPlay(false);
              if (m === 'TUTORIAL') {
                launchJourneyBattle(undefined, false, false);
                return;
              }
              setReturnToJourneyActive(false);
              setSelectedMode(m);
              setScreen('HERO_SELECT');
            }}
            onOpenCollection={() => {
              setGlobalAutoPlay(false);
              setReturnToJourneyActive(false);
              setScreen('COLLECTION');
            }}
            onOpenPacks={() => {
              setGlobalAutoPlay(false);
              setReturnToJourneyActive(false);
              setScreen('PACK_OPENING');
            }}
            onOpenQuestLog={() => setQuestLogOpen(true)}
            onOpenShop={() => setShopOpen(true)}
            onOpenOptions={() => setOptionsState({ open: true, inBattle: false })}
          />
        )}

        <Suspense
          fallback={
            <div className="flex h-full w-full flex-col items-center justify-center bg-[#090604] text-amber-100">
              <div className="text-sm font-extrabold tracking-wider text-sky-200">
                {tr('화면을 불러오고 있습니다...', 'Loading screen...')}
              </div>
            </div>
          }
        >
        {screen === 'HERO_SELECT' && (
          <HeroDeckSelectScreen
            initialMode={selectedMode}
            onBack={() => {
              setGlobalAutoPlay(false);
              refreshProfile();
              setScreen('BOX_HUB');
            }}
            onEditDecks={() => {
              setGlobalAutoPlay(false);
              setScreen('COLLECTION');
            }}
            onLaunchBattle={(params) => {
              setGlobalAutoPlay(false);
              setBattleSnapshot(null);
              setReturnToJourneyActive(false);
              setBattleSessionKey((k) => k + 1);
              setActiveBattleParams(params);
              setScreen('BATTLE');
            }}
          />
        )}

        {screen === 'COLLECTION' && (
          <CollectionScreen
            onBack={() => {
              setGlobalAutoPlay(false);
              setReturnToJourneyActive(false);
              refreshProfile();
              setScreen('BOX_HUB');
            }}
            onOpenShop={() => setShopOpen(true)}
            onProfileChanged={refreshProfile}
            onReturnToJourney={
              returnToJourneyActive
                ? () => launchJourneyBattle(undefined, false, false)
                : undefined
            }
          />
        )}

        {screen === 'PACK_OPENING' && (
          <PackOpeningScreen
            onBack={() => {
              setGlobalAutoPlay(false);
              setReturnToJourneyActive(false);
              refreshProfile();
              setScreen('BOX_HUB');
            }}
            onOpenShop={() => setShopOpen(true)}
            onProfileChanged={refreshProfile}
            onOpenCollection={() => {
              setGlobalAutoPlay(false);
              refreshProfile();
              setScreen('COLLECTION');
            }}
            onReturnToJourney={
              returnToJourneyActive
                ? () => launchJourneyBattle(undefined, false, false)
                : undefined
            }
          />
        )}

        {screen === 'BATTLE' && activeBattleParams && (
          <BattleScreen
            key={battleSessionKey}
            mode={activeBattleParams.mode}
            playerDeck={activeBattleParams.deck}
            preferredOpponentClass={activeBattleParams.preferredOpponentClass}
            preferredBoardTheme={activeBattleParams.boardTheme}
            journeyEpisodeOverride={activeBattleParams.journeyEpisodeOverride}
            skipStoryIntro={activeBattleParams.skipStoryIntro}
            initialPresetId={activeBattleParams.initialPresetId}
            openPresetModalOnStart={activeBattleParams.openPresetModalOnStart}
            bogartStakeGold={activeBattleParams.bogartStakeGold}
            challengerMeta={activeBattleParams.challengerMeta}
            restoredMatchState={activeBattleParams.restoredMatchState}
            externalAutoPlay={globalAutoPlay}
            onAutoPlayChange={setGlobalAutoPlay}
            tacticalStance={tacticalStance}
            onTacticalStanceChange={setTacticalStance}
            onBattleHelpSnapshot={setBattleSnapshot}
            onOpenOptions={(concedeFn) =>
              setOptionsState({ open: true, inBattle: true, concedeFn })
            }
            onOpenShopFromBattle={() => setShopOpen(true)}
            onGoOpenPacksFromBattle={() => {
              setGlobalAutoPlay(false);
              setBattleSnapshot(null);
              refreshProfile();
              setReturnToJourneyActive(true);
              setActiveBattleParams(null);
              setScreen('PACK_OPENING');
            }}
            onGoCollectionFromBattle={() => {
              setGlobalAutoPlay(false);
              setBattleSnapshot(null);
              refreshProfile();
              setReturnToJourneyActive(true);
              setActiveBattleParams(null);
              setScreen('COLLECTION');
            }}
            onStartJourneyEpisode={(ep, skipStory, keepAutoPlay) => {
              hsStorage.setJourneyProgress(ep, hsStorage.getProfile().journeyReincarnation);
              launchJourneyBattle(ep, Boolean(skipStory), Boolean(keepAutoPlay));
            }}
            onRematchSameMode={() => {
              setGlobalAutoPlay(false);
              setBattleSnapshot(null);
              if (activeBattleParams.mode === 'BOGART_GAMBLE') {
                const stake = activeBattleParams.bogartStakeGold ?? 100;
                const wager = hsStorage.placeBogartWager(stake);
                if (!wager.ok) {
                  refreshProfile();
                  setSelectedMode('BOGART_GAMBLE');
                  setActiveBattleParams(null);
                  setScreen('HERO_SELECT');
                  return;
                }
              }
              refreshProfile();
              setBattleSessionKey((k) => k + 1);
            }}
            onRematchWithPreset={(presetId, nextStance) => {
              setGlobalAutoPlay(false);
              setBattleSnapshot(null);
              setTacticalStance(nextStance);
              if (activeBattleParams.mode === 'BOGART_GAMBLE') {
                const stake = activeBattleParams.bogartStakeGold ?? 100;
                const wager = hsStorage.placeBogartWager(stake);
                if (!wager.ok) {
                  refreshProfile();
                  setSelectedMode('BOGART_GAMBLE');
                  setActiveBattleParams(null);
                  setScreen('HERO_SELECT');
                  return;
                }
              }
              refreshProfile();
              setActiveBattleParams((prev) =>
                prev
                  ? {
                      ...prev,
                      initialPresetId: presetId,
                      skipStoryIntro: true,
                      openPresetModalOnStart: false,
                    }
                  : null,
              );
              setBattleSessionKey((k) => k + 1);
            }}
            onExitBattle={() => {
              setGlobalAutoPlay(false);
              setBattleSnapshot(null);
              setReturnToJourneyActive(false);
              refreshProfile();
              setActiveBattleParams(null);
              setScreen('BOX_HUB');
            }}
          />
        )}
        </Suspense>

        {/* DEV-031: Bogart Gambling Hall Escrow Resume / Forfeit Modal */}
        {pendingGambleEscrow && (
          <div
            data-testid="gamble-escrow-resume-modal"
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          >
            <div className="hs-ocarina-dialog w-full max-w-md rounded-3xl p-6 text-center text-amber-100">
              <div className="text-3xl">🎲</div>
              <h2 className="hs-title mt-1.5 text-lg font-extrabold text-yellow-300 sm:text-xl">
                {tr('진행 중인 보가트 판돈 승부가 있습니다!', 'Active Bogart Wager Match Found!')}
              </h2>
              <p className="mt-2 text-xs font-bold leading-relaxed text-sky-100/90 sm:text-sm">
                {tr(
                  `에스크로에 보관된 판돈 ${pendingGambleEscrow.bogartStakeGold.toLocaleString()}G 랜덤덱 대결(${pendingGambleEscrow.matchState.turnNumber}턴)을 이어서 진행할까요? (포기 시 에스크로 판돈이 몰수됩니다)`,
                  `Resume your escrowed ${pendingGambleEscrow.bogartStakeGold.toLocaleString()}G Random-Deck match (Turn ${pendingGambleEscrow.matchState.turnNumber})? Forfeiting surrenders the staked Gold.`,
                )}
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  data-testid="gamble-escrow-resume-btn"
                  onClick={() => {
                    const snap = pendingGambleEscrow;
                    setPendingGambleEscrow(null);
                    setActiveBattleParams({
                      mode: 'BOGART_GAMBLE',
                      deck: snap.deck,
                      bogartStakeGold: snap.bogartStakeGold,
                      challengerMeta: snap.challengerMeta,
                      restoredMatchState: snap.matchState,
                      skipStoryIntro: true,
                    });
                    setBattleSessionKey((k) => k + 1);
                    setScreen('BATTLE');
                  }}
                  className="hs-zelda-a-btn min-h-[46px] w-full rounded-2xl py-2.5 text-sm font-extrabold"
                >
                  ▶ {tr(`판돈 ${pendingGambleEscrow.bogartStakeGold.toLocaleString()}G 승부 이어하기`, `Resume ${pendingGambleEscrow.bogartStakeGold.toLocaleString()}G Match`)}
                </button>
                <button
                  type="button"
                  data-testid="gamble-escrow-forfeit-btn"
                  onClick={() => {
                    const snap = pendingGambleEscrow;
                    setPendingGambleEscrow(null);
                    try {
                      sessionStorage.removeItem('snshero_gamble_active_match');
                    } catch {
                      // ignore
                    }
                    hsStorage.recordMatchOutcome(
                      snap.deck.heroClass,
                      false,
                      'BOGART_GAMBLE',
                      snap.deck.heroClass,
                      snap.bogartStakeGold,
                    );
                    refreshProfile();
                  }}
                  className="hs-brass-btn min-h-[44px] w-full rounded-2xl py-2 text-xs font-extrabold text-rose-200"
                >
                  ✕ {tr('승부 포기 (에스크로 판돈 몰수)', 'Forfeit Match (Surrender Wager)')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Overlays */}
        {questLogOpen && (
          <QuestLogModal
            onClose={() => setQuestLogOpen(false)}
            onProfileChanged={refreshProfile}
          />
        )}

        {shopOpen && (
          <TavernShopModal
            onClose={() => setShopOpen(false)}
            onProfileChanged={refreshProfile}
            onGoOpenPacks={() => {
              setGlobalAutoPlay(false);
              if (screen === 'BATTLE' && activeBattleParams?.mode === 'TUTORIAL') {
                setReturnToJourneyActive(true);
                setActiveBattleParams(null);
              }
              setScreen('PACK_OPENING');
            }}
          />
        )}

        {paymentResult && (
          <PaymentSuccessModal
            info={paymentResult}
            onOpenPacks={() => {
              setGlobalAutoPlay(false);
              setPaymentResult(null);
              if (screen === 'BATTLE' && activeBattleParams?.mode === 'TUTORIAL') {
                setReturnToJourneyActive(true);
                setActiveBattleParams(null);
              }
              setScreen('PACK_OPENING');
            }}
            onClose={() => setPaymentResult(null)}
          />
        )}

        {optionsState.open && (
          <GameOptionsModal
            inBattle={optionsState.inBattle}
            onConcede={optionsState.concedeFn}
            onGoHome={
              optionsState.inBattle
                ? () => {
                    setOptionsState({ open: false, inBattle: false });
                    setGlobalAutoPlay(false);
                    setBattleSnapshot(null);
                    setReturnToJourneyActive(false);
                    refreshProfile();
                    setActiveBattleParams(null);
                    setScreen('BOX_HUB');
                  }
                : undefined
            }
            onClose={() => setOptionsState({ open: false, inBattle: false })}
          />
        )}
      </GameAdSenseLayout>

      {/* Fullscreen Bottom-Right 2-Head-Tall Chibi Kadan Chatbot */}
      <KadanChatbotWidget
        screen={screen}
        profile={profile}
        selectedMode={selectedMode}
        autoPlay={globalAutoPlay}
        battleSnapshot={screen === 'BATTLE' ? battleSnapshot : null}
        onEnableAutoPlay={handleEnableAutoPlayFromKadan}
        onDisableAutoPlay={() => setGlobalAutoPlay(false)}
        onNavigateScreen={(target, modeOverride) => {
          setGlobalAutoPlay(false);
          setBattleSnapshot(null);
          if (screen === 'BATTLE') {
            setActiveBattleParams(null);
          }
          if (modeOverride) {
            setSelectedMode(modeOverride);
          }
          refreshProfile();
          setScreen(target);
        }}
        onStartJourney={() => launchJourneyBattle(undefined, false, false)}
        onOpenShop={() => setShopOpen(true)}
        onOpenQuestLog={() => setQuestLogOpen(true)}
        tacticalStance={tacticalStance}
        onChangeTacticalStance={setTacticalStance}
      />
    </>
  );
};
