import React, { useEffect, useRef, useState } from 'react';
import { Eye, RefreshCw, Shield, Swords, Trophy, X } from 'lucide-react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { cardDb, getCardArtUrl } from '../cardDb';
import { getCardName, getLocalizedHeroInfo } from '../i18nData';
import {
  LiveDuelMatchResult,
  LiveDuelRoom,
  snsheroLiveNetwork,
} from '../services/snsheroLiveNetwork';
import { BattleMatchState, MinionInstance, CLASSIC_HEROES, HeroClass } from '../types';
import { useModalDismiss } from '../useModalDismiss';

export interface SpectatorRoomTarget {
  roomId: string;
  title: string;
  hostPeerId: string;
  hostName: string;
  hostHeroClass: HeroClass;
  guestName?: string;
  guestHeroClass?: HeroClass;
  stakeGold: number;
  initialMode: 'SPECTATE' | 'RESULT';
  liveRoom?: LiveDuelRoom;
  matchResult?: LiveDuelMatchResult;
}

interface LiveSpectatorModalProps {
  target: SpectatorRoomTarget;
  liveResult?: LiveDuelMatchResult;
  onClose: () => void;
}

function formatFinishTime(ts: number, isKo: boolean): string {
  try {
    return new Date(ts).toLocaleTimeString(isKo ? 'ko-KR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const LiveSpectatorModal: React.FC<LiveSpectatorModalProps> = ({
  target,
  liveResult,
  onClose,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';

  useModalDismiss(true, () => {
    hsAudio.playSfx('ui_click', 0.45);
    onClose();
  });

  const [liveState, setLiveState] = useState<BattleMatchState | null>(null);
  const [selectedMinion, setSelectedMinion] = useState<MinionInstance | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const lastSeqRef = useRef<number>(0);

  const resolvedResult = liveResult || target.matchResult;
  const isResultView =
    Boolean(resolvedResult) ||
    target.initialMode === 'RESULT' ||
    liveState?.phase === 'GAME_OVER';

  useEffect(() => {
    if (isResultView) return;
    lastSeqRef.current = 0;
    const unsubState = snsheroLiveNetwork.onSpectateState((roomId, state, seq) => {
      if (roomId !== target.roomId) return;
      if (seq > 0 && seq < lastSeqRef.current) return;
      lastSeqRef.current = seq;
      setLiveState(state);
    });
    const stopSpec = snsheroLiveNetwork.startSpectating(target.roomId);
    return () => {
      unsubState();
      stopSpec();
    };
  }, [target.roomId, isResultView, refreshTick]);

  // Note: PVP_STATE_SYNC carries `guestState` (mirrored from Host's perspective),
  // so `liveState.opponent` is Host and `liveState.player` is Guest!
  const hostSide = liveState?.opponent;
  const guestSide = liveState?.player;
  const hostHeroClass: HeroClass =
    resolvedResult?.hostHeroClass || hostSide?.heroClass || target.hostHeroClass;
  const guestHeroClass: HeroClass =
    resolvedResult?.guestHeroClass ||
    guestSide?.heroClass ||
    target.guestHeroClass ||
    'WARRIOR';
  const hostHeroMeta = CLASSIC_HEROES[hostHeroClass] || CLASSIC_HEROES.PRIEST;
  const guestHeroMeta = CLASSIC_HEROES[guestHeroClass] || CLASSIC_HEROES.WARRIOR;
  const hostHeroInfo = getLocalizedHeroInfo(hostHeroClass, lang);
  const guestHeroInfo = getLocalizedHeroInfo(guestHeroClass, lang);

  const hostName = resolvedResult?.hostName || target.hostName;
  const guestName =
    resolvedResult?.guestName ||
    target.guestName ||
    target.liveRoom?.guestName ||
    tr('도전자', 'Challenger');

  // Derive fallback match result directly from liveState if GAME_OVER arrived before PVP_MATCH_RESULT
  const effectiveResult: LiveDuelMatchResult | null =
    resolvedResult ||
    (liveState && liveState.phase === 'GAME_OVER'
      ? {
          roomId: target.roomId,
          title: target.title,
          hostPeerId: target.hostPeerId,
          hostName,
          hostHeroClass,
          guestName,
          guestHeroClass,
          winnerSide:
            liveState.winner === 'DRAW'
              ? 'DRAW'
              : liveState.winner === 'OPPONENT'
                ? 'HOST'
                : 'GUEST',
          winnerName:
            liveState.winner === 'DRAW'
              ? tr('무승부', 'Draw')
              : liveState.winner === 'OPPONENT'
                ? hostName
                : guestName,
          loserName:
            liveState.winner === 'OPPONENT'
              ? guestName
              : liveState.winner === 'PLAYER'
                ? hostName
                : '',
          hostHp: Math.max(0, liveState.opponent.health),
          guestHp: Math.max(0, liveState.player.health),
          turnCount: liveState.turnNumber,
          stakeGold: target.stakeGold,
          reason: 'NORMAL',
          finishedAt: Date.now(),
        }
      : null);

  const reasonLabel = (reason: LiveDuelMatchResult['reason']) => {
    switch (reason) {
      case 'CONCEDE':
        return tr('항복 승리', 'Victory by Concede');
      case 'LEAVE':
        return tr('상대 퇴장 승리', 'Victory (Opponent Left)');
      case 'DISCONNECT':
        return tr('연결 끊김 승리', 'Victory (Disconnect)');
      default:
        return tr('정규 대전 승리', 'Standard Victory');
    }
  };

  const renderMinionRow = (minions: MinionInstance[], sideLabel: string) => {
    if (minions.length === 0) {
      return (
        <div className="flex min-h-[76px] w-full items-center justify-center rounded-xl border border-dashed border-amber-400/20 bg-black/25 px-2 text-[11px] font-bold text-stone-400">
          {tr(`${sideLabel} 전장 비어 있음`, `${sideLabel} board empty`)}
        </div>
      );
    }
    return (
      <div className="flex min-h-[76px] w-full flex-wrap items-center justify-center gap-1.5 rounded-xl border border-amber-400/25 bg-black/35 p-1.5">
        {minions.map((m) => {
          const def = cardDb.getCard(m.cardId);
          const art = def ? getCardArtUrl(def) : '/hs-assets/characters/cutouts/041_Kadan.webp';
          const dispName = def ? getCardName(def, lang) : m.cardId;
          const isSelected = selectedMinion?.uid === m.uid;
          const mAtk = Math.max(0, m.permAttack + m.tempAttack + m.auraAttack);
          const mHp = m.health + m.auraHealth;
          const mMaxHp = m.maxHealth + m.auraHealth;
          const hasTaunt = m.taunt || m.auraTaunt;
          return (
            <button
              key={m.uid}
              type="button"
              onClick={() => setSelectedMinion(isSelected ? null : m)}
              className={`relative flex h-[68px] w-[54px] flex-col items-center justify-end overflow-hidden rounded-xl border-2 bg-stone-900 shadow transition ${
                hasTaunt
                  ? 'border-amber-300 ring-1 ring-amber-400/60'
                  : m.divineShield
                    ? 'border-yellow-200'
                    : isSelected
                      ? 'border-sky-300'
                      : 'border-stone-600'
              }`}
              title={dispName}
            >
              <img
                src={art}
                alt={dispName}
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
              {/* Status mini icons */}
              <div className="absolute right-0.5 top-0.5 flex gap-0.5 text-[9px] leading-none">
                {hasTaunt && <span title={tr('도발', 'Taunt')}>🛡️</span>}
                {m.divineShield && <span title={tr('천상의 보호막', 'Divine Shield')}>✨</span>}
                {m.frozen && <span title={tr('빙결', 'Frozen')}>❄️</span>}
                {m.stealth && <span title={tr('은신', 'Stealth')}>👻</span>}
              </div>
              <div className="relative z-10 w-full truncate px-0.5 text-center text-[8.5px] font-extrabold text-amber-50">
                {dispName}
              </div>
              <div className="relative z-10 flex w-full items-center justify-between px-1 pb-0.5 text-[10px] font-black">
                <span className="rounded bg-amber-600 px-1 text-white">{mAtk}</span>
                <span
                  className={`rounded px-1 text-white ${
                    mHp < mMaxHp ? 'bg-red-700' : 'bg-emerald-700'
                  }`}
                >
                  {mHp}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="live-spectator-modal"
      onClick={(e) => {
        e.stopPropagation();
        hsAudio.playSfx('ui_click', 0.45);
        onClose();
      }}
      className="pointer-events-auto fixed inset-0 z-[150] flex items-center justify-center bg-black/82 px-2.5 py-2.5 backdrop-blur-sm sm:px-6 sm:py-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel relative flex max-h-[92dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-3xl border-2 border-amber-400/70 bg-slate-950 text-amber-50 shadow-[0_24px_70px_rgba(0,0,0,0.95)] sm:max-w-[520px]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-400/30 bg-gradient-to-r from-[#1a0b0e] via-[#131826] to-[#0b1322] px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {isResultView ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-yellow-200/80 bg-amber-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-stone-950">
                <Trophy className="h-3 w-3" />
                {tr('경기 결과', 'RESULT')}
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border border-white/85 bg-[#cc0000] px-2 py-0.5 text-[10px] font-black uppercase leading-none tracking-[0.14em] text-white shadow-[0_0_12px_rgba(220,38,38,0.9)]">
                <span className="relative flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-90" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                LIVE
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-white sm:text-sm">
                {target.title}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-200/80">
                <span>
                  {target.stakeGold > 0
                    ? tr(`내기 ${target.stakeGold.toLocaleString()}G`, `${target.stakeGold.toLocaleString()}G Wager`)
                    : tr('친선 0G', 'Friendly 0G')}
                </span>
                {liveState && !isResultView && (
                  <span>· {tr(`${liveState.turnNumber}턴 진행 중`, `Turn ${liveState.turnNumber}`)}</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="live-spectator-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              hsAudio.playSfx('ui_click', 0.45);
              onClose();
            }}
            aria-label={tr('관전 창 닫기', 'Close spectator view')}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-300/40 bg-black/50 text-amber-100 hover:bg-stone-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {isResultView ? (
            effectiveResult ? (
              <div data-testid="spectator-match-result-view" className="space-y-3">
                {/* Winner Banner */}
                <div className="rounded-2xl border-2 border-yellow-300/80 bg-gradient-to-b from-amber-900/70 via-stone-950 to-black p-3.5 text-center shadow-lg">
                  <div className="text-[11px] font-black uppercase tracking-widest text-yellow-300">
                    🏆 {reasonLabel(effectiveResult.reason)}
                  </div>
                  <div className="mt-1 text-lg font-black text-white sm:text-xl">
                    {effectiveResult.winnerSide === 'DRAW'
                      ? tr('무승부!', 'Draw!')
                      : tr(`${effectiveResult.winnerName} 승리!`, `${effectiveResult.winnerName} Wins!`)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-amber-200/90">
                    <span>{tr(`총 ${effectiveResult.turnCount}턴`, `${effectiveResult.turnCount} Turns`)}</span>
                    <span>·</span>
                    <span>
                      {effectiveResult.stakeGold > 0
                        ? tr(
                            `상금 ${(effectiveResult.stakeGold * 2).toLocaleString()}G`,
                            `Pot ${(effectiveResult.stakeGold * 2).toLocaleString()}G`,
                          )
                        : tr('친선 대전', 'Friendly Match')}
                    </span>
                    {effectiveResult.finishedAt > 0 && (
                      <>
                        <span>·</span>
                        <span>{formatFinishTime(effectiveResult.finishedAt, isKo)}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Host vs Guest Scoreboard */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Host Card */}
                  <div
                    className={`rounded-2xl border p-2.5 text-center ${
                      effectiveResult.winnerSide === 'HOST'
                        ? 'border-emerald-400 bg-emerald-950/50'
                        : 'border-stone-700 bg-stone-900/75'
                    }`}
                  >
                    <div className="mb-1 flex justify-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          effectiveResult.winnerSide === 'HOST'
                            ? 'bg-emerald-500 text-stone-950'
                            : effectiveResult.winnerSide === 'DRAW'
                              ? 'bg-amber-500 text-stone-950'
                              : 'bg-stone-700 text-stone-200'
                        }`}
                      >
                        {effectiveResult.winnerSide === 'HOST'
                          ? tr('🏆 승리', '🏆 WIN')
                          : effectiveResult.winnerSide === 'DRAW'
                            ? tr('무승부', 'DRAW')
                            : tr('패배', 'LOSE')}
                      </span>
                    </div>
                    <img
                      src={hostHeroMeta.heroPortraitUrl}
                      alt={hostHeroInfo.name}
                      className="mx-auto h-14 w-14 rounded-xl border-2 border-amber-300/70 object-cover object-top"
                    />
                    <div className="mt-1.5 truncate text-xs font-black text-white">
                      {effectiveResult.hostName}
                    </div>
                    <div className="text-[10.5px] font-bold text-amber-200/80">
                      {hostHeroInfo.className}
                    </div>
                    <div className="mt-1 text-xs font-extrabold text-rose-300">
                      ♥ {effectiveResult.hostHp} HP
                    </div>
                  </div>

                  {/* Guest Card */}
                  <div
                    className={`rounded-2xl border p-2.5 text-center ${
                      effectiveResult.winnerSide === 'GUEST'
                        ? 'border-emerald-400 bg-emerald-950/50'
                        : 'border-stone-700 bg-stone-900/75'
                    }`}
                  >
                    <div className="mb-1 flex justify-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          effectiveResult.winnerSide === 'GUEST'
                            ? 'bg-emerald-500 text-stone-950'
                            : effectiveResult.winnerSide === 'DRAW'
                              ? 'bg-amber-500 text-stone-950'
                              : 'bg-stone-700 text-stone-200'
                        }`}
                      >
                        {effectiveResult.winnerSide === 'GUEST'
                          ? tr('🏆 승리', '🏆 WIN')
                          : effectiveResult.winnerSide === 'DRAW'
                            ? tr('무승부', 'DRAW')
                            : tr('패배', 'LOSE')}
                      </span>
                    </div>
                    <img
                      src={guestHeroMeta.heroPortraitUrl}
                      alt={guestHeroInfo.name}
                      className="mx-auto h-14 w-14 rounded-xl border-2 border-amber-300/70 object-cover object-top"
                    />
                    <div className="mt-1.5 truncate text-xs font-black text-white">
                      {effectiveResult.guestName || tr('도전자', 'Challenger')}
                    </div>
                    <div className="text-[10.5px] font-bold text-amber-200/80">
                      {guestHeroInfo.className}
                    </div>
                    <div className="mt-1 text-xs font-extrabold text-rose-300">
                      ♥ {effectiveResult.guestHp} HP
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Closed room without recorded result (cancelled before start or expired) */
              <div
                data-testid="spectator-no-result-view"
                className="space-y-3 rounded-2xl border border-stone-700 bg-stone-900/80 p-4 text-center"
              >
                <img
                  src={hostHeroMeta.heroPortraitUrl}
                  alt={hostHeroInfo.name}
                  className="mx-auto h-14 w-14 rounded-xl border border-amber-300/50 object-cover object-top opacity-85"
                />
                <div className="text-sm font-black text-amber-100">
                  {tr('종료된 대전방입니다', 'This Duel Room Has Closed')}
                </div>
                <p className="text-xs font-semibold leading-relaxed text-stone-300">
                  {tr(
                    '대전이 시작되기 전 취소되었거나 경기 결과 기록 기간이 지난 방입니다.',
                    'This match was cancelled before starting or its result record has expired.',
                  )}
                </p>
                <div className="rounded-xl border border-stone-700 bg-black/40 px-3 py-2 text-[11px] font-bold text-amber-200/90">
                  {hostName} ({hostHeroInfo.className}) ·{' '}
                  {target.stakeGold > 0
                    ? tr(`내기 ${target.stakeGold}G`, `${target.stakeGold}G Wager`)
                    : tr('친선 0G', 'Friendly')}
                </div>
              </div>
            )
          ) : (
            /* LIVE SPECTATOR VIEW */
            <div data-testid="spectator-live-board-view" className="space-y-2.5">
              {!liveState ? (
                <div className="flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-amber-400/35 bg-stone-900/80 px-4 py-8 text-center">
                  <Eye className="h-8 w-8 animate-pulse text-rose-400" />
                  <div className="text-sm font-black text-white">
                    {tr('실시간 전장 중계 연결 중...', 'Connecting to Live Battlefield...')}
                  </div>
                  <div className="text-xs font-bold text-amber-200/80">
                    {hostName} vs {guestName}
                  </div>
                  <p className="text-[11px] font-semibold text-stone-400">
                    {tr(
                      '호스트로부터 최신 전장 상태를 수신하는 중입니다.',
                      'Requesting the latest live board state from the match host.',
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRefreshTick((t) => t + 1)}
                    className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-300/60 bg-stone-800 px-3.5 text-xs font-extrabold text-amber-100 hover:bg-stone-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {tr('중계 다시 요청', 'Retry Sync')}
                  </button>
                </div>
              ) : (
                <>
                  {/* Top Player (Host) Status Bar */}
                  <div
                    className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 ${
                      liveState.activeSide === 'OPPONENT'
                        ? 'border-amber-300 bg-amber-950/45 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                        : 'border-stone-700 bg-stone-900/80'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <img
                        src={hostHeroMeta.heroPortraitUrl}
                        alt={hostHeroInfo.name}
                        className="h-10 w-10 shrink-0 rounded-xl border border-amber-300/70 object-cover object-top"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-black text-white">{hostName}</span>
                          {liveState.activeSide === 'OPPONENT' && (
                            <span className="shrink-0 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-stone-950">
                              {tr('공격 턴', 'TURN')}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-stone-300">
                          {hostHeroInfo.className} · {tr(`손패 ${hostSide?.hand.length ?? 0}`, `Hand ${hostSide?.hand.length ?? 0}`)} ·{' '}
                          {tr(`덱 ${hostSide?.deck.length ?? 0}`, `Deck ${hostSide?.deck.length ?? 0}`)}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-xs font-black">
                      <span className="rounded-lg bg-rose-900/90 px-2 py-1 text-rose-100">
                        ♥ {hostSide?.health ?? 30}
                      </span>
                      {(hostSide?.armor ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-lg bg-slate-700 px-1.5 py-1 text-slate-100">
                          <Shield className="h-3 w-3" />
                          {hostSide?.armor}
                        </span>
                      )}
                      <span className="rounded-lg bg-sky-900/90 px-2 py-1 text-sky-100">
                        💎 {hostSide?.mana ?? 0}/{hostSide?.maxMana ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Host Board */}
                  {renderMinionRow(hostSide?.board || [], hostName)}

                  {/* VS Divider */}
                  <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-300/80">
                    <span className="h-px flex-1 bg-amber-400/25" />
                    <Swords className="h-3.5 w-3.5 text-rose-400" />
                    <span>{tr(`실시간 전장 · ${liveState.turnNumber}턴`, `Live Board · Turn ${liveState.turnNumber}`)}</span>
                    <span className="h-px flex-1 bg-amber-400/25" />
                  </div>

                  {/* Guest Board */}
                  {renderMinionRow(guestSide?.board || [], guestName)}

                  {/* Bottom Player (Guest) Status Bar */}
                  <div
                    className={`flex items-center justify-between gap-2 rounded-2xl border px-3 py-2 ${
                      liveState.activeSide === 'PLAYER'
                        ? 'border-emerald-300 bg-emerald-950/45 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'border-stone-700 bg-stone-900/80'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <img
                        src={guestHeroMeta.heroPortraitUrl}
                        alt={guestHeroInfo.name}
                        className="h-10 w-10 shrink-0 rounded-xl border border-emerald-300/70 object-cover object-top"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-black text-white">{guestName}</span>
                          {liveState.activeSide === 'PLAYER' && (
                            <span className="shrink-0 rounded bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black text-stone-950">
                              {tr('공격 턴', 'TURN')}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-stone-300">
                          {guestHeroInfo.className} · {tr(`손패 ${guestSide?.hand.length ?? 0}`, `Hand ${guestSide?.hand.length ?? 0}`)} ·{' '}
                          {tr(`덱 ${guestSide?.deck.length ?? 0}`, `Deck ${guestSide?.deck.length ?? 0}`)}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-xs font-black">
                      <span className="rounded-lg bg-rose-900/90 px-2 py-1 text-rose-100">
                        ♥ {guestSide?.health ?? 30}
                      </span>
                      {(guestSide?.armor ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-lg bg-slate-700 px-1.5 py-1 text-slate-100">
                          <Shield className="h-3 w-3" />
                          {guestSide?.armor}
                        </span>
                      )}
                      <span className="rounded-lg bg-sky-900/90 px-2 py-1 text-sky-100">
                        💎 {guestSide?.mana ?? 0}/{guestSide?.maxMana ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Selected Minion Quick Info */}
                  {selectedMinion && (() => {
                    const def = cardDb.getCard(selectedMinion.cardId);
                    if (!def) return null;
                    const sAtk = Math.max(
                      0,
                      selectedMinion.permAttack +
                        selectedMinion.tempAttack +
                        selectedMinion.auraAttack,
                    );
                    const sHp = selectedMinion.health + selectedMinion.auraHealth;
                    return (
                      <div className="rounded-xl border border-sky-400/50 bg-sky-950/60 px-3 py-2 text-[11px] font-bold text-sky-100">
                        <span className="font-black text-white">{getCardName(def, lang)}</span>{' '}
                        ({sAtk}/{sHp})
                        {(selectedMinion.taunt || selectedMinion.auraTaunt) && ` · ${tr('도발', 'Taunt')}`}
                        {selectedMinion.divineShield && ` · ${tr('천상의 보호막', 'Divine Shield')}`}
                        {selectedMinion.frozen && ` · ${tr('빙결', 'Frozen')}`}
                      </div>
                    );
                  })()}

                  {/* Recent Live Action Feed */}
                  {liveState.history.length > 0 && (
                    <div className="rounded-xl border border-stone-800 bg-black/50 p-2.5">
                      <div className="mb-1 text-[10px] font-black text-amber-300">
                        📡 {tr('실시간 전투 중계 로그', 'Live Play-by-Play')}
                      </div>
                      <div className="space-y-0.5 text-[10.5px] font-semibold text-stone-300">
                        {liveState.history.slice(-4).reverse().map((h) => (
                          <div key={h.id} className="truncate">
                            <span className="text-amber-200/80">T{h.turn}</span> · {h.detail}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-amber-400/25 bg-black/45 px-3.5 py-2.5">
          <button
            type="button"
            data-testid="live-spectator-footer-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              hsAudio.playSfx('ui_click', 0.45);
              onClose();
            }}
            className="hs-brass-btn flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-xl text-xs font-black text-amber-100"
          >
            {isResultView ? tr('확인 (닫기)', 'OK (Close)') : tr('관전 종료', 'Leave Spectator Mode')}
          </button>
        </div>
      </div>
    </div>
  );
};
