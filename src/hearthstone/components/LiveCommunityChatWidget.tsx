import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUp,
  Coins,
  Edit3,
  Eye,
  MessageCircleMore,
  Plus,
  Swords,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { useIsNarrationActive } from '../services/narrationVisibility';
import { getLocalizedHeroInfo } from '../i18nData';
import {
  LiveChatMessage,
  LiveChatScope,
  LiveDuelMatchResult,
  LiveDuelRoom,
  snsheroLiveNetwork,
} from '../services/snsheroLiveNetwork';
import { hsStorage } from '../storage';
import { CLASSIC_HEROES, CustomDeck, PlayerProfile, ScreenName } from '../types';
import { HsGoldCoinIcon } from './CardVisual';
import { LiveSpectatorModal, SpectatorRoomTarget } from './LiveSpectatorModal';

export interface LiveCommunityChatWidgetProps {
  screen: ScreenName;
  profile: PlayerProfile;
  onProfileChanged?: () => void;
  onOpenCollection?: () => void;
}

type ChatFilterTab = 'GLOBAL' | 'GUILD' | 'DUEL';

interface SelectedChatUser {
  peerId: string;
  nickname: string;
  badgeIcon?: string;
  guildTag?: string;
  scope?: LiveChatScope;
}

const GUILD_ICONS = ['🛡️', '❄️', '🌪️', '🔥', '⚔️', '🐉', '👑', '🌟'];
const STAKE_OPTIONS = [0, 10, 50, 100, 300, 500];
const GOLD_GIFT_PRESETS = [10, 50, 100, 300, 500];

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", sans-serif';

function formatShortTime(ts: number): string {
  try {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export const LiveCommunityChatWidget: React.FC<LiveCommunityChatWidgetProps> = ({
  screen,
  profile,
  onProfileChanged,
  onOpenCollection,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const isNarrationActive = useIsNarrationActive();

  const snap = useSyncExternalStore(
    snsheroLiveNetwork.subscribe,
    snsheroLiveNetwork.getSnapshot,
    snsheroLiveNetwork.getSnapshot,
  );

  const [activeFilter, setActiveFilter] = useState<ChatFilterTab>('GLOBAL');
  const [onlinePanelOpen, setOnlinePanelOpen] = useState(false);
  const [globalInput, setGlobalInput] = useState('');
  const [guildInput, setGuildInput] = useState('');
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState(snap.nickname);
  const [statusBanner, setStatusBanner] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [incomingGoldToast, setIncomingGoldToast] = useState<{
    fromName: string;
    amount: number;
    note?: string;
    newGold: number;
  } | null>(null);

  // User Click Action Sheet (Gold Gift or Direct Real-Time 1v1 Duel)
  const [selectedUser, setSelectedUser] = useState<SelectedChatUser | null>(null);
  const [userActionMode, setUserActionMode] = useState<'DUEL' | 'GOLD'>('DUEL');
  const [goldAmount, setGoldAmount] = useState<number>(50);
  const [goldNote, setGoldNote] = useState('');

  // Guild creation / code join state
  const [showCreateGuild, setShowCreateGuild] = useState(false);
  const [guildNameDraft, setGuildNameDraft] = useState('');
  const [guildTagDraft, setGuildTagDraft] = useState('');
  const [guildIconDraft, setGuildIconDraft] = useState('🛡️');
  const [guildDescDraft, setGuildDescDraft] = useState('');
  const [guildJoinCode, setGuildJoinCode] = useState('');

  // Duel room state
  const [decks, setDecks] = useState<CustomDeck[]>(() => hsStorage.getDecks());
  const [selectedDeckId, setSelectedDeckId] = useState<string>(() => {
    const list = hsStorage.getDecks();
    return list[0]?.id || '';
  });
  const [duelTitleDraft, setDuelTitleDraft] = useState('');
  const [duelStakeGold, setDuelStakeGold] = useState<number>(0);
  const [duelScope, setDuelScope] = useState<LiveChatScope>('GLOBAL');
  const [duelTargetPeer, setDuelTargetPeer] = useState<{
    peerId: string;
    nickname: string;
  } | null>(null);
  const [spectatorTarget, setSpectatorTarget] = useState<SpectatorRoomTarget | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const guildScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    snsheroLiveNetwork.setInBattle(screen === 'BATTLE');
  }, [screen]);

  useEffect(() => {
    const refreshDecks = () => {
      const latest = hsStorage.getDecks().filter((d) => d.cards.length >= 30);
      setDecks(latest);
      setSelectedDeckId((prev) =>
        latest.some((d) => d.id === prev) ? prev : latest[0]?.id || '',
      );
    };
    refreshDecks();
    window.addEventListener('snshero:state-changed', refreshDecks);
    return () => window.removeEventListener('snshero:state-changed', refreshDecks);
  }, [snap.drawerOpen]);

  useEffect(() => {
    const unsubGold = snsheroLiveNetwork.onGoldReceived((info) => {
      hsAudio.playSfx('mario_coin', 0.9);
      onProfileChanged?.();
      setIncomingGoldToast(info);
      window.setTimeout(() => {
        setIncomingGoldToast((cur) => (cur === info ? null : cur));
      }, 5200);
    });
    return unsubGold;
  }, [onProfileChanged]);

  // Always default to Global Chat + clear unread count whenever drawer opens
  useEffect(() => {
    if (snap.drawerOpen) {
      snsheroLiveNetwork.clearUnreadCount();
    }
  }, [snap.drawerOpen, snap.unreadCount]);

  // Auto-scroll chat feed on new messages
  useEffect(() => {
    if (!snap.drawerOpen) return;
    if (activeFilter === 'GLOBAL' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    } else if (activeFilter === 'GUILD' && guildScrollRef.current) {
      guildScrollRef.current.scrollTop = guildScrollRef.current.scrollHeight;
    }
  }, [snap.drawerOpen, activeFilter, snap.globalMessages.length, snap.guildMessages.length]);

  // Close drawer on Escape or outside click (desktop)
  useEffect(() => {
    if (!snap.drawerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (spectatorTarget) return;
      const target = e.target as Node;
      const inTrigger = rootRef.current?.contains(target);
      const inDrawer = drawerRef.current?.contains(target);
      if (!inTrigger && !inDrawer) {
        snsheroLiveNetwork.setDrawerOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedUser) {
          setSelectedUser(null);
        } else {
          snsheroLiveNetwork.setDrawerOpen(false);
        }
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [snap.drawerOpen, selectedUser, spectatorTarget]);

  const flashStatus = (kind: 'ok' | 'err', text: string) => {
    setStatusBanner({ kind, text });
    window.setTimeout(() => {
      setStatusBanner((cur) => (cur?.text === text ? null : cur));
    }, 3800);
  };

  const otherOnlinePeers = useMemo(
    () => snap.onlinePeers.filter((p) => p.peerId !== snap.peerId),
    [snap.onlinePeers, snap.peerId],
  );

  const guildOnlinePeers = useMemo(() => {
    if (!snap.currentGuild) return [];
    return snap.onlinePeers.filter((p) => p.guildId === snap.currentGuild?.id);
  }, [snap.onlinePeers, snap.currentGuild]);

  const selectedDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId) || decks[0] || null,
    [decks, selectedDeckId],
  );

  const myHostedWaitingRoom = useMemo(
    () =>
      snap.openRooms.find(
        (r) => r.hostPeerId === snap.peerId && r.status === 'WAITING',
      ) || null,
    [snap.openRooms, snap.peerId],
  );

  const getDeckDisplayLabel = (deck: CustomDeck): string => {
    const heroInfo = getLocalizedHeroInfo(deck.heroClass, lang);
    if (!isKo && deck.isPreset) {
      return `${heroInfo.className} · ${heroInfo.name} Deck`;
    }
    return `${deck.name} (${heroInfo.className})`;
  };

  const openUserActionSheet = (
    user: SelectedChatUser,
    initialMode: 'DUEL' | 'GOLD' = 'DUEL',
  ) => {
    if (!user.peerId || user.peerId === snap.peerId) return;
    hsAudio.playSfx('ui_click', 0.7);
    setSelectedUser(user);
    setUserActionMode(initialMode);
    setOnlinePanelOpen(false);
    if (user.scope) setDuelScope(user.scope);
  };

  const handleGlobalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalInput.trim()) return;
    hsAudio.playSfx('ui_click', 0.65);
    const sent = snsheroLiveNetwork.sendChatMessage(globalInput, 'GLOBAL');
    if (sent) setGlobalInput('');
  };

  const handleGuildSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guildInput.trim()) return;
    hsAudio.playSfx('ui_click', 0.65);
    const sent = snsheroLiveNetwork.sendChatMessage(guildInput, 'GUILD');
    if (sent) setGuildInput('');
  };

  const handleCreateGuild = (e: React.FormEvent) => {
    e.preventDefault();
    hsAudio.playSfx('ui_click', 0.8);
    const res = snsheroLiveNetwork.createGuild({
      name: guildNameDraft,
      tag: guildTagDraft,
      icon: guildIconDraft,
      description: guildDescDraft,
    });
    if (!res.ok) {
      flashStatus('err', res.error || tr('길드 생성에 실패했습니다.', 'Failed to create guild.'));
      return;
    }
    setGuildNameDraft('');
    setGuildTagDraft('');
    setGuildDescDraft('');
    setShowCreateGuild(false);
    flashStatus(
      'ok',
      tr(
        `🛡️ [${res.guild?.tag}] ${res.guild?.name} 길드가 창설되었습니다!`,
        `🛡️ Guild [${res.guild?.tag}] ${res.guild?.name} created!`,
      ),
    );
  };

  const handleSendGoldToUser = (targetId: string, targetName: string) => {
    if (!targetId.trim()) {
      flashStatus('err', tr('선물할 상대를 선택해 주세요.', 'Select a player first.'));
      return;
    }
    const resolvedPeer = snap.onlinePeers.find((p) => p.peerId === targetId);
    const recipientName = targetName.trim() || resolvedPeer?.nickname || targetId;
    const res = snsheroLiveNetwork.sendGoldGift({
      toPeerId: targetId,
      toName: recipientName,
      amount: goldAmount,
      note: goldNote,
      scope:
        snap.currentGuild && resolvedPeer?.guildId === snap.currentGuild.id
          ? 'GUILD'
          : 'GLOBAL',
    });

    if (!res.ok) {
      flashStatus('err', res.error || tr('골드 전송에 실패했습니다.', 'Gold transfer failed.'));
      return;
    }

    hsAudio.playSfx('mario_coin', 0.85);
    onProfileChanged?.();
    setGoldNote('');
    setSelectedUser(null);
    flashStatus(
      'ok',
      tr(
        `🪙 ${recipientName}님에게 ${goldAmount.toLocaleString()}G를 선물했습니다!`,
        `🪙 Sent ${goldAmount.toLocaleString()}G to ${recipientName}!`,
      ),
    );
  };

  const handleCreateDuelRoom = (overrideTarget?: { peerId: string; nickname: string } | null) => {
    if (!selectedDeck) {
      flashStatus('err', tr('출전할 30장 카드덱을 선택해 주세요.', 'Select a 30-card deck first.'));
      return;
    }
    const target = overrideTarget !== undefined ? overrideTarget : duelTargetPeer;
    hsAudio.playSfx('box_press', 0.85);
    const res = snsheroLiveNetwork.createDuelRoom({
      title: duelTitleDraft,
      deck: selectedDeck,
      stakeGold: duelStakeGold,
      scope: duelScope === 'GUILD' && snap.currentGuild ? 'GUILD' : 'GLOBAL',
      targetPeerId: target?.peerId,
      targetPeerName: target?.nickname,
    });
    if (!res.ok) {
      flashStatus('err', res.error || tr('대전방 개설 실패', 'Could not create Duel Room.'));
      return;
    }
    onProfileChanged?.();
    setDuelTitleDraft('');
    setDuelTargetPeer(null);
    setSelectedUser(null);
    flashStatus(
      'ok',
      target
        ? tr(
            `⚔️ ${target.nickname}님에게 실시간 1:1 대전 신청을 보냈습니다!`,
            `⚔️ Sent a live 1v1 Duel invite to ${target.nickname}!`,
          )
        : tr(
            '⚔️ 대전방이 개설되어 전체채팅에 공유되었습니다! 상대가 입장하면 즉시 시작됩니다.',
            '⚔️ Duel Room is live! Battle begins as soon as an opponent joins.',
          ),
    );
  };

  const handleJoinDuelRoom = (room: LiveDuelRoom) => {
    if (!selectedDeck) {
      flashStatus('err', tr('참전할 내 30장 카드덱을 먼저 선택해 주세요.', 'Pick your 30-card deck first.'));
      return;
    }
    hsAudio.playSfx('gem_a_confirm', 0.9);
    const res = snsheroLiveNetwork.joinDuelRoom(room, selectedDeck);
    if (!res.ok) {
      flashStatus('err', res.error || tr('대전방 입장에 실패했습니다.', 'Could not join Duel Room.'));
      return;
    }
    snsheroLiveNetwork.setDrawerOpen(false);
    flashStatus(
      'ok',
      tr('⚔️ 대전방에 연결 중입니다... 곧 전장으로 이동합니다!', '⚔️ Connecting to Duel Room...'),
    );
  };

  const renderChatMessageItem = (msg: LiveChatMessage) => {
    const isMine = msg.senderId === snap.peerId;
    if (msg.kind === 'SYSTEM') {
      return (
        <div
          key={msg.id}
          className="mx-auto my-1 max-w-[90%] rounded-full bg-[#2a2a2a] px-3.5 py-1 text-center text-[12px] text-[#b4b4b4]"
        >
          {msg.text}
        </div>
      );
    }

    if (msg.kind === 'GOLD_GIFT' && msg.goldGift) {
      return (
        <div
          key={msg.id}
          data-testid="chat-gold-gift-card"
          className="rounded-2xl border border-amber-400/25 bg-[#2a251a] p-3 text-[#ececec]"
        >
          <div className="flex items-center justify-between text-xs font-medium text-amber-300">
            <span className="flex items-center gap-1.5">
              <HsGoldCoinIcon size={15} />
              <span>{tr('실시간 골드 선물', 'Live Gold Gift')}</span>
            </span>
            <span className="text-[11px] text-[#9b9b9b]">{formatShortTime(msg.timestamp)}</span>
          </div>
          <p className="mt-1.5 text-[14px] leading-snug text-white">{msg.text}</p>
        </div>
      );
    }

    if (msg.kind === 'DUEL_ROOM' && msg.duelRoom) {
      const duelMeta = msg.duelRoom;
      const liveRoom = snap.openRooms.find((r) => r.roomId === duelMeta.roomId);
      const matchResult = snap.matchResults[duelMeta.roomId];
      const isWaiting = Boolean(liveRoom && liveRoom.status === 'WAITING');
      const isInProgress = Boolean(liveRoom && liveRoom.status === 'IN_PROGRESS') && !matchResult;
      const isJoinable = isWaiting && duelMeta.hostPeerId !== snap.peerId;
      const isMyWaitingRoom = isWaiting && duelMeta.hostPeerId === snap.peerId;
      const heroInfo = getLocalizedHeroInfo(duelMeta.hostHeroClass, lang);
      const heroMeta = CLASSIC_HEROES[duelMeta.hostHeroClass];

      const openSpectateOrResult = (mode: 'SPECTATE' | 'RESULT') => {
        hsAudio.playSfx('ui_click', 0.65);
        setSpectatorTarget({
          roomId: duelMeta.roomId,
          title: duelMeta.title,
          hostPeerId: duelMeta.hostPeerId,
          hostName: duelMeta.hostName,
          hostHeroClass: duelMeta.hostHeroClass,
          guestName: liveRoom?.guestName || matchResult?.guestName,
          guestHeroClass: liveRoom?.guestHeroClass || matchResult?.guestHeroClass,
          stakeGold: duelMeta.stakeGold,
          initialMode: mode,
          liveRoom,
          matchResult,
        });
      };

      return (
        <div
          key={msg.id}
          data-testid={`chat-duel-room-card-${duelMeta.roomId}`}
          onClick={() => {
            if (isInProgress) openSpectateOrResult('SPECTATE');
            else if (!isWaiting) openSpectateOrResult('RESULT');
          }}
          className={`rounded-2xl border p-3 transition ${
            isInProgress
              ? 'cursor-pointer border-rose-500/50 bg-[#2c1b1e] hover:border-rose-400'
              : !isWaiting
                ? 'cursor-pointer border-white/10 bg-[#262626] hover:border-white/25'
                : 'border-white/15 bg-[#2a2a2a]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <img
              src={heroMeta.heroPortraitUrl}
              alt={heroInfo.name}
              className="h-10 w-10 shrink-0 rounded-full border border-white/20 object-cover object-top"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                {isInProgress ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-white" />
                    LIVE
                  </span>
                ) : !isWaiting ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[#d4d4d4]">
                    🏆 {tr('경기 종료', 'Finished')}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                    ⚔️ {tr('대전 대기 중', 'Open Duel')}
                  </span>
                )}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-amber-300">
                  {duelMeta.stakeGold > 0
                    ? `${duelMeta.stakeGold.toLocaleString()}G`
                    : tr('친선 0G', 'Friendly')}
                </span>
              </div>
              <div className="mt-0.5 truncate text-[14px] font-semibold text-white">
                {duelMeta.title}
              </div>
              <div className="truncate text-xs text-[#9b9b9b]">
                {isInProgress && liveRoom?.guestName
                  ? `${duelMeta.hostName} vs ${liveRoom.guestName}`
                  : matchResult
                    ? `${matchResult.hostName} vs ${matchResult.guestName || tr('도전자', 'Challenger')}`
                    : `${duelMeta.hostName} · ${heroInfo.className}`}
              </div>
            </div>
          </div>

          {isJoinable && liveRoom ? (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                data-testid={`chat-join-duel-btn-${liveRoom.roomId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleJoinDuelRoom(liveRoom);
                }}
                className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-xs font-semibold text-[#171717] transition hover:bg-[#e5e5e5]"
              >
                <Swords className="h-3.5 w-3.5" />
                <span>{tr('내 카드덱으로 즉시 입장', 'Join & Battle')}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFilter('DUEL');
                }}
                className="min-h-[42px] rounded-full border border-white/15 bg-[#212121] px-3 text-xs font-medium text-[#ececec] hover:bg-[#333333]"
              >
                {tr('덱 변경', 'Deck')}
              </button>
            </div>
          ) : isMyWaitingRoom ? (
            <div className="mt-2 flex items-center justify-between text-xs text-emerald-300">
              <span>{tr('내 대전방 대기 중 — 상대 입장 시 시작', 'Waiting for opponent to join')}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  snsheroLiveNetwork.cancelDuelRoom(duelMeta.roomId);
                  onProfileChanged?.();
                }}
                className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-[#d4d4d4] hover:bg-white/10"
              >
                {tr('닫기', 'Cancel')}
              </button>
            </div>
          ) : isInProgress ? (
            <button
              type="button"
              data-testid={`chat-spectate-duel-btn-${duelMeta.roomId}`}
              onClick={(e) => {
                e.stopPropagation();
                openSpectateOrResult('SPECTATE');
              }}
              className="mt-2.5 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-500"
            >
              <Eye className="h-4 w-4" />
              <span>{tr('실시간 관전하기', 'Watch Live Match')}</span>
            </button>
          ) : (
            <button
              type="button"
              data-testid={`chat-result-duel-btn-${duelMeta.roomId}`}
              onClick={(e) => {
                e.stopPropagation();
                openSpectateOrResult('RESULT');
              }}
              className="mt-2.5 flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-full border border-white/10 bg-[#212121] px-3 text-xs font-medium text-[#d4d4d4] hover:bg-[#303030]"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-300" />
              <span>
                {matchResult
                  ? matchResult.winnerSide === 'DRAW'
                    ? tr('무승부 · 결과 보기', 'Draw · View Result')
                    : tr(`${matchResult.winnerName} 승리 · 결과 보기`, `${matchResult.winnerName} Won · View Result`)
                  : tr('경기 결과 보기', 'View Match Result')}
              </span>
            </button>
          )}
        </div>
      );
    }

    // Standard TEXT message: My messages right-aligned (#2f2f2f pill); Other users clickable to open Gold Gift / Live Duel sheet!
    if (isMine) {
      return (
        <div
          key={msg.id}
          data-testid="live-chat-message-item"
          className="flex flex-col items-end"
        >
          <div className="max-w-[82%] break-words rounded-3xl bg-[#2f2f2f] px-4 py-2.5 text-[15px] leading-relaxed text-[#ececec]">
            {msg.text}
          </div>
          <span className="mt-0.5 pr-1 text-[10.5px] text-[#7a7a7a]">
            {formatShortTime(msg.timestamp)}
          </span>
        </div>
      );
    }

    return (
      <div
        key={msg.id}
        data-testid="live-chat-message-item"
        className="flex items-start gap-2.5"
      >
        <button
          type="button"
          data-testid="chat-user-btn"
          onClick={() =>
            openUserActionSheet({
              peerId: msg.senderId,
              nickname: msg.senderName,
              badgeIcon: msg.senderBadge,
              guildTag: msg.guildTag,
              scope: msg.scope,
            })
          }
          title={tr(`${msg.senderName} 클릭: 골드선물 / 실시간 대전`, `Tap ${msg.senderName}: Gift Gold / Live Duel`)}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#2f2f2f] text-sm transition hover:border-white/40 hover:bg-[#3a3a3a]"
        >
          {msg.senderBadge}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="chat-user-btn"
              onClick={() =>
                openUserActionSheet({
                  peerId: msg.senderId,
                  nickname: msg.senderName,
                  badgeIcon: msg.senderBadge,
                  guildTag: msg.guildTag,
                  scope: msg.scope,
                })
              }
              className="text-[13px] font-semibold text-white underline-offset-2 hover:text-sky-300 hover:underline"
            >
              {msg.senderName}
            </button>
            {msg.guildTag && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                [{msg.guildTag}]
              </span>
            )}
            <span className="text-[11px] text-[#7a7a7a]">{formatShortTime(msg.timestamp)}</span>
          </div>
          <div className="mt-0.5 break-words text-[15px] leading-relaxed text-[#ececec]">
            {msg.text}
          </div>
        </div>
      </div>
    );
  };

  const openRoomsCount = snap.openRooms.filter((r) => r.status === 'WAITING').length;

  if (isNarrationActive) return null;

  // Render ChatGPT-unified Fullscreen Mobile / Floating Desktop Live Chat via Portal
  const liveDrawerNode =
    snap.drawerOpen &&
    (() => {
      const content = (
        <div
          ref={drawerRef}
          onClick={(e) => e.stopPropagation()}
          data-testid="live-chat-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={tr('실시간 라이브 채팅', 'Live Community Chat')}
          style={{ fontFamily: FONT_STACK }}
          className="fixed inset-0 z-[140] flex h-[100dvh] w-full flex-col overflow-hidden rounded-none bg-[#212121] text-[#ececec] sm:inset-auto sm:bottom-20 sm:right-4 sm:h-[640px] sm:max-h-[82dvh] sm:w-[440px] sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-[0_24px_64px_rgba(0,0,0,0.75)]"
        >
          {/* Top Header */}
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#2f2f2f] text-sky-300">
                <MessageCircleMore className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold text-white">
                    {tr('라이브 채팅', 'Live Chat')}
                  </span>
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      snap.transportState === 'LIVE_GLOBAL' ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  {editingNick ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        snsheroLiveNetwork.updateNickname(nickDraft);
                        setEditingNick(false);
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="text"
                        value={nickDraft}
                        onChange={(e) => setNickDraft(e.target.value)}
                        maxLength={16}
                        autoFocus
                        className="w-24 rounded-lg border border-white/20 bg-[#2f2f2f] px-2 py-0.5 text-[16px] text-white focus:outline-none sm:text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-semibold text-[#171717]"
                      >
                        OK
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setNickDraft(snap.nickname);
                        setEditingNick(true);
                      }}
                      className="inline-flex items-center gap-1 truncate rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-[#d4d4d4] hover:bg-white/15"
                    >
                      <span className="max-w-[84px] truncate">{snap.nickname}</span>
                      <Edit3 className="h-2.5 w-2.5 shrink-0" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <span className="hidden items-center gap-1 rounded-full bg-[#2f2f2f] px-2.5 py-1 text-xs font-medium text-amber-300 sm:inline-flex">
                <HsGoldCoinIcon size={13} />
                <span>{profile.gold.toLocaleString()}G</span>
              </span>
              <button
                type="button"
                data-testid="live-online-peers-toggle"
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.6);
                  setOnlinePanelOpen((v) => !v);
                }}
                className={`inline-flex min-h-[38px] items-center gap-1 rounded-full px-2.5 text-xs font-medium transition ${
                  onlinePanelOpen
                    ? 'bg-white text-[#171717]'
                    : 'bg-[#2f2f2f] text-[#ececec] hover:bg-[#3a3a3a]'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>{snap.onlineCount}</span>
              </button>
              <button
                type="button"
                data-testid="live-chat-close-btn"
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.55);
                  setOnlinePanelOpen(false);
                  setSelectedUser(null);
                  snsheroLiveNetwork.setDrawerOpen(false);
                }}
                aria-label={tr('라이브 채팅 닫기', 'Close Live Chat')}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#b4b4b4] transition hover:bg-[#2f2f2f] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          {/* 3 Filter Tabs: 전체채팅 (Default) / 길드채팅 / 대전방 */}
          <div
            data-testid="live-chat-filter-bar"
            className="flex shrink-0 items-center gap-1.5 border-b border-white/10 bg-[#1b1b1b] px-3.5 py-2"
          >
            {(
              [
                {
                  id: 'GLOBAL',
                  icon: '💬',
                  label: tr('전체채팅', 'Global Chat'),
                  testId: 'live-filter-global',
                },
                {
                  id: 'GUILD',
                  icon: '🛡️',
                  label: snap.currentGuild
                    ? `[${snap.currentGuild.tag}] ${tr('길드', 'Guild')}`
                    : tr('길드채팅', 'Guild Chat'),
                  testId: 'live-filter-guild',
                },
                {
                  id: 'DUEL',
                  icon: '⚔️',
                  label:
                    openRoomsCount > 0
                      ? `${tr('대전방', 'Duel')} (${openRoomsCount})`
                      : tr('대전방', 'Duel Rooms'),
                  testId: 'live-filter-duel',
                },
              ] as const
            ).map((f) => {
              const active = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  data-testid={f.testId}
                  onClick={() => {
                    hsAudio.playSfx('ui_click', 0.6);
                    setOnlinePanelOpen(false);
                    setActiveFilter(f.id);
                    if (f.id === 'GLOBAL') {
                      snsheroLiveNetwork.clearUnreadCount();
                    }
                  }}
                  className={`flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-medium transition ${
                    active
                      ? 'bg-white text-[#171717]'
                      : 'bg-[#2a2a2a] text-[#b4b4b4] hover:bg-[#333333] hover:text-white'
                  }`}
                >
                  <span>{f.icon}</span>
                  <span className="truncate">{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Status Feedback Banner */}
          {statusBanner && (
            <div
              data-testid="live-chat-status-banner"
              className={`shrink-0 px-4 py-2 text-xs font-medium ${
                statusBanner.kind === 'ok'
                  ? 'bg-emerald-950/90 text-emerald-200'
                  : 'bg-rose-950/90 text-rose-200'
              }`}
            >
              {statusBanner.text}
            </div>
          )}

          {/* Collapsible Online Users Roster (Click Any User -> Gold Gift / Direct Duel!) */}
          {onlinePanelOpen && (
            <div
              data-testid="live-online-peers-drawer"
              className="max-h-56 shrink-0 space-y-1.5 overflow-y-auto border-b border-white/10 bg-[#1a1a1a] px-3.5 py-2.5"
            >
              <div className="flex items-center justify-between text-xs text-[#9b9b9b]">
                <span>
                  {tr(
                    `현재 접속자 (${snap.onlinePeers.length}명) — 클릭하여 골드선물·대전신청`,
                    `Online (${snap.onlinePeers.length}) — Tap player to Gift or Duel`,
                  )}
                </span>
                <span className="text-amber-300">🪙 {profile.gold.toLocaleString()}G</span>
              </div>
              {otherOnlinePeers.length === 0 ? (
                <div className="rounded-2xl bg-[#2a2a2a] py-3 text-center text-xs text-[#9b9b9b]">
                  {tr(
                    '다른 모험가의 접속을 기다리고 있습니다.',
                    'Waiting for other adventurers to come online.',
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {otherOnlinePeers.map((peer) => (
                    <button
                      key={peer.peerId}
                      type="button"
                      data-testid={`online-peer-btn-${peer.peerId}`}
                      onClick={() =>
                        openUserActionSheet({
                          peerId: peer.peerId,
                          nickname: peer.nickname,
                          badgeIcon: peer.badgeIcon,
                          guildTag: peer.guildTag,
                          scope: activeFilter === 'GUILD' ? 'GUILD' : 'GLOBAL',
                        })
                      }
                      className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/10 bg-[#2a2a2a] px-3 py-2 text-left transition hover:border-white/30 hover:bg-[#333333]"
                    >
                      <span className="text-base">{peer.badgeIcon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-white">
                          {peer.nickname}
                        </div>
                        <div className="text-[10.5px] text-[#9b9b9b]">
                          {peer.guildTag ? `[${peer.guildTag}] · ` : ''}
                          {peer.rank === 0 ? 'Legend' : `Rank ${peer.rank}`}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-amber-200">
                        ⚔ · 🪙
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== FILTER 1: GLOBAL CHAT (DEFAULT) ==================== */}
          {activeFilter === 'GLOBAL' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div
                ref={chatScrollRef}
                data-testid="global-chat-feed"
                className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4"
              >
                {snap.globalMessages.length === 0 ? (
                  <div className="flex min-h-full flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#2f2f2f] text-sky-300">
                      <MessageCircleMore className="h-6 w-6" />
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      {tr('전체 실시간 채팅에 오신 것을 환영합니다', 'Welcome to Live Global Chat')}
                    </h3>
                    <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-[#9b9b9b]">
                      {tr(
                        '메시지를 보내거나 상대방 닉네임을 클릭해 골드 선물·실시간 1:1 대전을 신청해 보세요.',
                        'Chat live or tap any player name to send Gold or challenge them to a 1v1 Duel.',
                      )}
                    </p>
                  </div>
                ) : (
                  snap.globalMessages.map(renderChatMessageItem)
                )}
              </div>

              {/* ChatGPT-Style Pill Input Bar */}
              <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1.5 sm:px-4 sm:pb-3.5">
                <form
                  onSubmit={handleGlobalSubmit}
                  className="flex items-center gap-1.5 rounded-[26px] border border-white/12 bg-[#2f2f2f] py-1.5 pl-4 pr-1.5 focus-within:border-white/25"
                >
                  <input
                    type="text"
                    data-testid="global-chat-input"
                    value={globalInput}
                    onChange={(e) => setGlobalInput(e.target.value)}
                    maxLength={240}
                    placeholder={tr(
                      '전체채팅 메시지 입력... (닉네임 클릭으로 대전/선물)',
                      'Message Global Chat... (Tap name to Duel/Gift)',
                    )}
                    className="min-h-[40px] min-w-0 flex-1 bg-transparent text-[16px] text-[#ececec] placeholder:text-[#8e8e8e] focus:outline-none sm:text-[15px]"
                  />
                  <button
                    type="submit"
                    data-testid="global-chat-send-btn"
                    disabled={!globalInput.trim()}
                    aria-label={tr('전송', 'Send')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#171717] transition hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:bg-[#4f4f4f] disabled:text-[#212121]"
                  >
                    <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ==================== FILTER 2: GUILD CHAT & GUILDS ==================== */}
          {activeFilter === 'GUILD' && (
            <div className="flex min-h-0 flex-1 flex-col">
              {!snap.currentGuild ? (
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        🛡️ {tr('길드 가입 또는 새 길드 창설', 'Join or Create a Guild')}
                      </h4>
                      <p className="text-xs text-[#9b9b9b]">
                        {tr(
                          '길드 전용 채팅방, 골드 지원, 길드 내전을 즐길 수 있습니다.',
                          'Unlock private Guild chat, Gold gifts & Guild scrims.',
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="toggle-create-guild-btn"
                      onClick={() => setShowCreateGuild((v) => !v)}
                      className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-full bg-white px-3.5 text-xs font-semibold text-[#171717] hover:bg-[#e5e5e5]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{tr('길드 창설', 'New Guild')}</span>
                    </button>
                  </div>

                  {showCreateGuild && (
                    <form
                      onSubmit={handleCreateGuild}
                      data-testid="create-guild-form"
                      className="space-y-2.5 rounded-2xl border border-white/10 bg-[#2a2a2a] p-3"
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {GUILD_ICONS.map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setGuildIconDraft(ic)}
                            className={`h-8 w-8 rounded-full border text-sm ${
                              guildIconDraft === ic
                                ? 'border-white bg-white/20'
                                : 'border-white/10 bg-[#212121]'
                            }`}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          data-testid="guild-tag-input"
                          value={guildTagDraft}
                          onChange={(e) => setGuildTagDraft(e.target.value.toUpperCase())}
                          maxLength={5}
                          placeholder={tr('태그 (HERO)', 'Tag')}
                          className="min-h-[42px] w-28 rounded-xl border border-white/10 bg-[#212121] px-3 text-[16px] font-semibold text-white placeholder:text-[#7a7a7a] focus:outline-none sm:text-xs"
                        />
                        <input
                          type="text"
                          data-testid="guild-name-input"
                          value={guildNameDraft}
                          onChange={(e) => setGuildNameDraft(e.target.value)}
                          maxLength={22}
                          placeholder={tr('길드 이름', 'Guild Name')}
                          className="min-h-[42px] min-w-0 flex-1 rounded-xl border border-white/10 bg-[#212121] px-3 text-[16px] text-white placeholder:text-[#7a7a7a] focus:outline-none sm:text-xs"
                        />
                      </div>
                      <input
                        type="text"
                        value={guildDescDraft}
                        onChange={(e) => setGuildDescDraft(e.target.value)}
                        maxLength={50}
                        placeholder={tr('길드 한줄 소개 (선택)', 'Guild motto (optional)')}
                        className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#212121] px-3 text-[16px] text-white placeholder:text-[#7a7a7a] focus:outline-none sm:text-xs"
                      />
                      <button
                        type="submit"
                        data-testid="guild-create-submit-btn"
                        className="min-h-[44px] w-full rounded-full bg-white text-xs font-semibold text-[#171717] hover:bg-[#e5e5e5]"
                      >
                        {tr('길드 창설 및 입장', 'Create & Enter Guild')}
                      </button>
                    </form>
                  )}

                  {/* Join by Code / Tag */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      data-testid="guild-code-join-input"
                      value={guildJoinCode}
                      onChange={(e) => setGuildJoinCode(e.target.value)}
                      placeholder={tr('초대코드 또는 길드태그 입력', 'Enter Guild Tag or Code')}
                      className="min-h-[42px] min-w-0 flex-1 rounded-full border border-white/10 bg-[#2f2f2f] px-4 text-[16px] text-white placeholder:text-[#8e8e8e] focus:outline-none sm:text-xs"
                    />
                    <button
                      type="button"
                      data-testid="guild-code-join-btn"
                      onClick={() => {
                        const res = snsheroLiveNetwork.joinGuildByCodeOrTag(guildJoinCode);
                        if (!res.ok) {
                          flashStatus('err', res.error || tr('가입 실패', 'Join failed'));
                        } else {
                          setGuildJoinCode('');
                        }
                      }}
                      className="min-h-[42px] shrink-0 rounded-full bg-[#2f2f2f] px-4 text-xs font-semibold text-white hover:bg-[#3a3a3a]"
                    >
                      {tr('가입', 'Join')}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {snap.availableGuilds.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-2.5 rounded-2xl border border-white/10 bg-[#2a2a2a] p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                            <span>{g.icon}</span>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-emerald-300">
                              [{g.tag}]
                            </span>
                            <span className="truncate">{g.name}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-[#9b9b9b]">
                            {isKo ? g.descriptionKo : g.descriptionEn}
                          </p>
                        </div>
                        <button
                          type="button"
                          data-testid={`guild-join-btn-${g.tag}`}
                          onClick={() => {
                            hsAudio.playSfx('ui_click', 0.75);
                            snsheroLiveNetwork.joinGuild(g);
                          }}
                          className="min-h-[40px] shrink-0 rounded-full bg-white px-3.5 text-xs font-semibold text-[#171717] hover:bg-[#e5e5e5]"
                        >
                          {tr('입장', 'Join')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Active Guild Header Bar */}
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#1a1a1a] px-3.5 py-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-white">
                      <span>{snap.currentGuild.icon}</span>
                      <span className="text-emerald-300">[{snap.currentGuild.tag}]</span>
                      <span className="truncate">{snap.currentGuild.name}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[#b4b4b4]">
                        {Math.max(1, guildOnlinePeers.length)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDuelScope('GUILD');
                          setActiveFilter('DUEL');
                        }}
                        className="rounded-full bg-[#2f2f2f] px-2.5 py-1 text-[11px] text-[#ececec] hover:bg-[#3a3a3a]"
                      >
                        ⚔️ {tr('길드내전', 'Duel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(snap.currentGuild?.tag || '').catch(() => {});
                          flashStatus(
                            'ok',
                            tr(
                              `길드 태그 [${snap.currentGuild?.tag}] 복사 완료`,
                              `Copied [${snap.currentGuild?.tag}]`,
                            ),
                          );
                        }}
                        className="rounded-full bg-[#2f2f2f] px-2.5 py-1 text-[11px] text-[#ececec] hover:bg-[#3a3a3a]"
                      >
                        {tr('코드', 'Code')}
                      </button>
                      <button
                        type="button"
                        data-testid="guild-leave-btn"
                        onClick={() => snsheroLiveNetwork.leaveGuild()}
                        className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#9b9b9b] hover:bg-white/10 hover:text-white"
                      >
                        {tr('탈퇴', 'Leave')}
                      </button>
                    </div>
                  </div>

                  {/* Guild Feed */}
                  <div
                    ref={guildScrollRef}
                    data-testid="guild-chat-feed"
                    className="flex-1 space-y-3.5 overflow-y-auto px-4 py-4"
                  >
                    {snap.guildMessages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-[#9b9b9b]">
                        {tr(
                          '길드원들과 인사를 나누고 골드 선물·길드 내전을 즐겨보세요.',
                          'Say hello to Guildmates or start a Guild Duel.',
                        )}
                      </div>
                    ) : (
                      snap.guildMessages.map(renderChatMessageItem)
                    )}
                  </div>

                  {/* Guild Composer */}
                  <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1.5 sm:px-4 sm:pb-3.5">
                    <form
                      onSubmit={handleGuildSubmit}
                      className="flex items-center gap-1.5 rounded-[26px] border border-white/12 bg-[#2f2f2f] py-1.5 pl-4 pr-1.5 focus-within:border-white/25"
                    >
                      <input
                        type="text"
                        data-testid="guild-chat-input"
                        value={guildInput}
                        onChange={(e) => setGuildInput(e.target.value)}
                        maxLength={240}
                        placeholder={tr(
                          `[${snap.currentGuild.tag}] 길드 채팅 입력...`,
                          `Message [${snap.currentGuild.tag}] Guild...`,
                        )}
                        className="min-h-[40px] min-w-0 flex-1 bg-transparent text-[16px] text-[#ececec] placeholder:text-[#8e8e8e] focus:outline-none sm:text-[15px]"
                      />
                      <button
                        type="submit"
                        data-testid="guild-chat-send-btn"
                        disabled={!guildInput.trim()}
                        aria-label={tr('전송', 'Send')}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#171717] transition hover:bg-[#e5e5e5] disabled:cursor-not-allowed disabled:bg-[#4f4f4f] disabled:text-[#212121]"
                      >
                        <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==================== FILTER 3: DUEL ROOMS ==================== */}
          {activeFilter === 'DUEL' && (
            <div className="flex-1 space-y-3 overflow-y-auto p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              {/* Deck Picker */}
              <div className="rounded-2xl border border-white/10 bg-[#2a2a2a] p-3">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="live-pvp-deck-select"
                    className="text-xs font-semibold text-white"
                  >
                    🃏 {tr('출전할 내 30장 카드덱', 'Your 30-Card Deck')}
                  </label>
                  {onOpenCollection && (
                    <button
                      type="button"
                      onClick={() => {
                        snsheroLiveNetwork.setDrawerOpen(false);
                        onOpenCollection();
                      }}
                      className="text-xs font-medium text-sky-300 hover:underline"
                    >
                      {tr('덱 편집 ›', 'Edit Decks ›')}
                    </button>
                  )}
                </div>
                <select
                  id="live-pvp-deck-select"
                  data-testid="live-pvp-deck-select"
                  value={selectedDeck?.id || ''}
                  onChange={(e) => setSelectedDeckId(e.target.value)}
                  className="mt-2 min-h-[42px] w-full rounded-xl border border-white/10 bg-[#212121] px-3 text-[16px] text-white focus:outline-none sm:text-xs"
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {getDeckDisplayLabel(d)} ({d.cards.length}/30)
                    </option>
                  ))}
                </select>
              </div>

              {/* Host Duel Room */}
              <div className="space-y-2.5 rounded-2xl border border-white/10 bg-[#2a2a2a] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    ⚔️ {tr('실시간 1:1 대전방 개설', 'Host Live 1v1 Duel Room')}
                  </span>
                  {duelTargetPeer && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-white">
                      <span>vs {duelTargetPeer.nickname}</span>
                      <button
                        type="button"
                        onClick={() => setDuelTargetPeer(null)}
                        className="ml-1 text-[#b4b4b4] hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  data-testid="duel-room-title-input"
                  value={duelTitleDraft}
                  onChange={(e) => setDuelTitleDraft(e.target.value)}
                  maxLength={36}
                  placeholder={tr('방 제목 (비워두면 자동 생성)', 'Room title (optional)')}
                  className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#212121] px-3 text-[16px] text-white placeholder:text-[#7a7a7a] focus:outline-none sm:text-xs"
                />

                <div className="grid grid-cols-6 gap-1.5">
                  {STAKE_OPTIONS.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setDuelStakeGold(st)}
                      className={`min-h-[38px] rounded-full text-xs font-medium transition ${
                        duelStakeGold === st
                          ? 'bg-white text-[#171717]'
                          : 'bg-[#212121] text-[#b4b4b4] hover:bg-[#333333]'
                      }`}
                    >
                      {st === 0 ? tr('친선', 'Free') : `${st}G`}
                    </button>
                  ))}
                </div>

                {snap.currentGuild && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDuelScope('GLOBAL')}
                      className={`min-h-[38px] rounded-full text-xs font-medium ${
                        duelScope === 'GLOBAL'
                          ? 'bg-white text-[#171717]'
                          : 'bg-[#212121] text-[#b4b4b4]'
                      }`}
                    >
                      🌐 {tr('전체 공개방', 'Public Room')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuelScope('GUILD')}
                      className={`min-h-[38px] rounded-full text-xs font-medium ${
                        duelScope === 'GUILD'
                          ? 'bg-emerald-500 text-[#171717]'
                          : 'bg-[#212121] text-[#b4b4b4]'
                      }`}
                    >
                      🛡️ [{snap.currentGuild.tag}] {tr('길드방', 'Guild Room')}
                    </button>
                  </div>
                )}

                {myHostedWaitingRoom ? (
                  <div
                    data-testid="hosted-waiting-room-banner"
                    className="space-y-2 rounded-xl border border-emerald-400/35 bg-emerald-950/40 p-2.5"
                  >
                    <div className="text-xs font-semibold text-emerald-300">
                      🟢 {tr('내 대전방 대기 중 — 상대 입장 시 즉시 시작', 'Room Open — Auto-starts on join')}
                    </div>
                    <div className="text-xs text-white">{myHostedWaitingRoom.title}</div>
                    <button
                      type="button"
                      data-testid="cancel-duel-room-btn"
                      onClick={() => {
                        snsheroLiveNetwork.cancelDuelRoom(myHostedWaitingRoom.roomId);
                        onProfileChanged?.();
                      }}
                      className="min-h-[40px] w-full rounded-full border border-white/15 bg-[#212121] text-xs font-medium text-rose-300 hover:bg-rose-950/60"
                    >
                      {tr('대전방 닫기', 'Cancel Duel Room')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="create-duel-room-btn"
                    onClick={() => handleCreateDuelRoom()}
                    className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-white text-xs font-semibold text-[#171717] transition hover:bg-[#e5e5e5]"
                  >
                    <Swords className="h-4 w-4" />
                    <span>{tr('내 덱으로 대전방 개설', 'Create Duel Room')}</span>
                  </button>
                )}
              </div>

              {/* Open Waiting Rooms */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#d4d4d4]">
                  🔥 {tr(`열린 대전방 (${openRoomsCount})`, `Open Duel Rooms (${openRoomsCount})`)}
                </div>

                {openRoomsCount === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-[#2a2a2a]/60 py-6 text-center text-xs text-[#9b9b9b]">
                    {tr(
                      '현재 대기 중인 대전방이 없습니다. 위에서 방을 만들거나 채팅에서 상대를 클릭해 대결하세요.',
                      'No open rooms right now. Host above or tap any player in chat to duel.',
                    )}
                  </div>
                ) : (
                  snap.openRooms
                    .filter((r) => r.status === 'WAITING')
                    .map((room) => {
                      const isMyRoom = room.hostPeerId === snap.peerId;
                      const heroInfo = getLocalizedHeroInfo(room.hostHeroClass, lang);
                      const heroMeta = CLASSIC_HEROES[room.hostHeroClass];
                      return (
                        <div
                          key={room.roomId}
                          data-testid={`open-duel-room-${room.roomId}`}
                          className="flex items-center justify-between gap-2.5 rounded-2xl border border-white/10 bg-[#2a2a2a] p-3"
                        >
                          <img
                            src={heroMeta.heroPortraitUrl}
                            alt={heroInfo.name}
                            className="h-10 w-10 shrink-0 rounded-full border border-white/20 object-cover object-top"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold text-white">
                              {room.title}
                            </div>
                            <div className="truncate text-[11px] text-[#9b9b9b]">
                              {room.hostName} · {heroInfo.className} ·{' '}
                              {room.stakeGold > 0
                                ? `${room.stakeGold.toLocaleString()}G`
                                : tr('친선 0G', 'Free')}
                            </div>
                          </div>
                          {isMyRoom ? (
                            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-[11px] text-emerald-300">
                              {tr('대기 중', 'Waiting')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              data-testid={`join-duel-room-btn-${room.roomId}`}
                              onClick={() => handleJoinDuelRoom(room)}
                              className="min-h-[40px] shrink-0 rounded-full bg-white px-3.5 text-xs font-semibold text-[#171717] hover:bg-[#e5e5e5]"
                            >
                              {tr('입장', 'Join')}
                            </button>
                          )}
                        </div>
                      );
                    })
                )}
              </div>

              {/* Live In-Progress Rooms */}
              {snap.openRooms.some((r) => r.status === 'IN_PROGRESS') && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                    <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      LIVE
                    </span>
                    <span>{tr('진행 중인 대전 (관전)', 'Live Matches (Spectate)')}</span>
                  </div>
                  {snap.openRooms
                    .filter((r) => r.status === 'IN_PROGRESS')
                    .map((room) => {
                      const heroMeta = CLASSIC_HEROES[room.hostHeroClass];
                      const heroInfo = getLocalizedHeroInfo(room.hostHeroClass, lang);
                      return (
                        <div
                          key={room.roomId}
                          data-testid={`live-duel-room-${room.roomId}`}
                          className="flex items-center justify-between gap-2.5 rounded-2xl border border-rose-500/40 bg-[#2c1b1e] p-3"
                        >
                          <img
                            src={heroMeta.heroPortraitUrl}
                            alt={heroInfo.name}
                            className="h-10 w-10 shrink-0 rounded-full border border-rose-300/40 object-cover object-top"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold text-white">
                              {room.title}
                            </div>
                            <div className="truncate text-[11px] text-[#b4b4b4]">
                              {room.hostName} vs {room.guestName || tr('도전자', 'Challenger')}
                            </div>
                          </div>
                          <button
                            type="button"
                            data-testid={`spectate-duel-room-btn-${room.roomId}`}
                            onClick={() => {
                              hsAudio.playSfx('ui_click', 0.65);
                              setSpectatorTarget({
                                roomId: room.roomId,
                                title: room.title,
                                hostPeerId: room.hostPeerId,
                                hostName: room.hostName,
                                hostHeroClass: room.hostHeroClass,
                                guestName: room.guestName,
                                guestHeroClass: room.guestHeroClass,
                                stakeGold: room.stakeGold,
                                initialMode: 'SPECTATE',
                                liveRoom: room,
                              });
                            }}
                            className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-full bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-500"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>{tr('관전', 'Watch')}</span>
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Finished Match Results */}
              {Object.values(snap.matchResults).length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#d4d4d4]">
                    <Trophy className="h-3.5 w-3.5 text-amber-300" />
                    <span>{tr('최근 종료된 대전 결과', 'Recent Match Results')}</span>
                  </div>
                  {(Object.values(snap.matchResults) as LiveDuelMatchResult[])
                    .sort((a, b) => b.finishedAt - a.finishedAt)
                    .slice(0, 6)
                    .map((res) => (
                      <button
                        key={res.roomId}
                        type="button"
                        onClick={() => {
                          hsAudio.playSfx('ui_click', 0.65);
                          setSpectatorTarget({
                            roomId: res.roomId,
                            title: res.title,
                            hostPeerId: res.hostPeerId,
                            hostName: res.hostName,
                            hostHeroClass: res.hostHeroClass,
                            guestName: res.guestName,
                            guestHeroClass: res.guestHeroClass,
                            stakeGold: res.stakeGold,
                            initialMode: 'RESULT',
                            matchResult: res,
                          });
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#2a2a2a] px-3.5 py-2.5 text-left hover:border-white/25"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-white">
                            {res.winnerSide === 'DRAW'
                              ? tr(`🤝 무승부 (${res.hostName} vs ${res.guestName})`, `🤝 Draw (${res.hostName} vs ${res.guestName})`)
                              : tr(`🏆 ${res.winnerName} 승리!`, `🏆 ${res.winnerName} Won!`)}
                          </div>
                          <div className="truncate text-[11px] text-[#9b9b9b]">
                            {res.title} · {res.turnCount}
                            {tr('턴', 'T')}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-amber-300">
                          {tr('결과 ›', 'View ›')}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== CLICK-USER ACTION SHEET (GOLD GIFT / REALTIME DUEL) ==================== */}
          {selectedUser && (
            <div
              data-testid="live-user-action-sheet"
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 z-30 flex items-end justify-center bg-black/65 p-3 backdrop-blur-xs sm:items-center"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#262626] p-4 shadow-2xl"
              >
                {/* Target User Profile Header */}
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[#2f2f2f] text-lg">
                      {selectedUser.badgeIcon || '🛡️'}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-white">
                        {selectedUser.nickname}
                      </div>
                      <div className="text-xs text-[#9b9b9b]">
                        {selectedUser.guildTag ? `[${selectedUser.guildTag}] · ` : ''}
                        {tr('상호작용 선택', 'Player Interaction')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    aria-label={tr('닫기', 'Close')}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#b4b4b4] hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Action Mode Tabs: Realtime Duel vs Gold Gift */}
                <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-full bg-[#1b1b1b] p-1">
                  <button
                    type="button"
                    data-testid="user-action-duel-tab"
                    onClick={() => setUserActionMode('DUEL')}
                    className={`min-h-[38px] rounded-full text-xs font-semibold transition ${
                      userActionMode === 'DUEL'
                        ? 'bg-white text-[#171717]'
                        : 'text-[#b4b4b4] hover:text-white'
                    }`}
                  >
                    ⚔️ {tr('실시간 대전', 'Live Duel')}
                  </button>
                  <button
                    type="button"
                    data-testid="user-action-gold-tab"
                    onClick={() => setUserActionMode('GOLD')}
                    className={`min-h-[38px] rounded-full text-xs font-semibold transition ${
                      userActionMode === 'GOLD'
                        ? 'bg-white text-[#171717]'
                        : 'text-[#b4b4b4] hover:text-white'
                    }`}
                  >
                    🪙 {tr('골드 선물', 'Gift Gold')}
                  </button>
                </div>

                {userActionMode === 'DUEL' ? (
                  <div className="mt-3 space-y-2.5">
                    <div>
                      <label className="mb-1 block text-xs text-[#b4b4b4]">
                        {tr('내 30장 카드덱', 'Your 30-Card Deck')}
                      </label>
                      <select
                        value={selectedDeck?.id || ''}
                        onChange={(e) => setSelectedDeckId(e.target.value)}
                        className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-3 text-[16px] text-white focus:outline-none sm:text-xs"
                      >
                        {decks.map((d) => (
                          <option key={d.id} value={d.id}>
                            {getDeckDisplayLabel(d)} ({d.cards.length}/30)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-[#b4b4b4]">
                        {tr('판돈 선택 (친선 / 골드)', 'Wager (Friendly / Gold)')}
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {STAKE_OPTIONS.map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setDuelStakeGold(st)}
                            className={`min-h-[36px] rounded-full text-[11px] font-medium ${
                              duelStakeGold === st
                                ? 'bg-white text-[#171717]'
                                : 'bg-[#1b1b1b] text-[#b4b4b4] hover:bg-[#333333]'
                            }`}
                          >
                            {st === 0 ? tr('친선', 'Free') : `${st}G`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="user-action-duel-submit"
                      onClick={() =>
                        handleCreateDuelRoom({
                          peerId: selectedUser.peerId,
                          nickname: selectedUser.nickname,
                        })
                      }
                      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-white text-xs font-semibold text-[#171717] transition hover:bg-[#e5e5e5]"
                    >
                      <Swords className="h-4 w-4" />
                      <span>
                        {tr(
                          `${selectedUser.nickname}님에게 대전 신청`,
                          `Challenge ${selectedUser.nickname}`,
                        )}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-[#b4b4b4]">
                      <span>{tr('보낼 골드 선택', 'Select Gold Amount')}</span>
                      <span className="font-semibold text-amber-300">
                        {tr(`보유 ${profile.gold.toLocaleString()}G`, `${profile.gold.toLocaleString()}G Owned`)}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {GOLD_GIFT_PRESETS.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setGoldAmount(amt)}
                          className={`min-h-[38px] rounded-full text-xs font-medium ${
                            goldAmount === amt
                              ? 'bg-white text-[#171717]'
                              : 'bg-[#1b1b1b] text-[#b4b4b4] hover:bg-[#333333]'
                          }`}
                        >
                          {amt}G
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={goldNote}
                      onChange={(e) => setGoldNote(e.target.value)}
                      maxLength={60}
                      placeholder={tr('응원 한마디 (선택)', 'Gift note (optional)')}
                      className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#1b1b1b] px-3 text-[16px] text-white placeholder:text-[#7a7a7a] focus:outline-none sm:text-xs"
                    />
                    <button
                      type="button"
                      data-testid="send-gold-submit-btn"
                      onClick={() =>
                        handleSendGoldToUser(selectedUser.peerId, selectedUser.nickname)
                      }
                      className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-amber-400 text-xs font-semibold text-[#171717] transition hover:bg-amber-300"
                    >
                      <Coins className="h-4 w-4" />
                      <span>
                        {tr(
                          `${goldAmount.toLocaleString()}G 선물하기`,
                          `Send ${goldAmount.toLocaleString()}G`,
                        )}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );

      if (typeof document !== 'undefined') {
        return createPortal(content, document.body);
      }
      return content;
    })();

  // Flush to bottom-right corner identically with bottom-left Kadan Chatbot so cards stay unobstructed
  const positionClasses = 'fixed bottom-0.5 right-1 z-[126] sm:bottom-1 sm:right-2';

  return (
    <div
      ref={rootRef}
      data-testid="live-chat-root"
      className={`pointer-events-none ${positionClasses} flex flex-col items-end`}
    >
      {/* Incoming Gold Toast Banner */}
      {incomingGoldToast && (
        <div
          data-testid="incoming-gold-toast"
          className="pointer-events-auto mb-1.5 max-w-[270px] rounded-2xl border border-amber-300/60 bg-[#212121]/95 px-3 py-2 text-xs font-semibold text-amber-100 shadow-2xl"
        >
          🪙{' '}
          {tr(
            `${incomingGoldToast.fromName}님이 ${incomingGoldToast.amount.toLocaleString()}G를 선물했습니다!`,
            `${incomingGoldToast.fromName} sent you ${incomingGoldToast.amount.toLocaleString()}G!`,
          )}
        </div>
      )}

      {liveDrawerNode}

      {/* Bottom-Right Compact Live Chat Trigger Button (Shows ONLY Global Unread Count; Removed when 0) */}
      <button
        type="button"
        data-testid="live-chat-trigger-btn"
        onClick={(e) => {
          e.stopPropagation();
          hsAudio.playSfx('ui_click', 0.75);
          if (!snap.drawerOpen) {
            setActiveFilter('GLOBAL');
            setSelectedUser(null);
            snsheroLiveNetwork.setDrawerOpen(true);
          } else {
            snsheroLiveNetwork.setDrawerOpen(false);
          }
        }}
        aria-label={
          snap.unreadCount > 0
            ? tr(`라이브 채팅 열기 (읽지 않은 전체채팅 ${snap.unreadCount}건)`, `Open Live Chat (${snap.unreadCount} unread)`)
            : tr('라이브 채팅 열기', 'Open Live Chat')
        }
        className="pointer-events-auto group relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-end focus:outline-none"
      >
        <div
          className={`relative flex h-[40px] w-[40px] items-center justify-center rounded-full border-2 shadow-[0_6px_16px_rgba(0,0,0,0.9)] transition-transform duration-150 group-hover:scale-108 group-active:scale-95 sm:h-[48px] sm:w-[48px] ${
            snap.drawerOpen
              ? 'border-white bg-white text-[#171717]'
              : 'border-white/25 bg-[#212121] text-white'
          }`}
        >
          <MessageCircleMore className="h-5 w-5 stroke-[2.2] sm:h-6 sm:w-6" />

          {/* Strict Global Chat Unread Badge: COMPLETELY REMOVED when unreadCount === 0 */}
          {snap.unreadCount > 0 && (
            <span
              data-testid="live-chat-count-badge"
              className="pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-[#212121] bg-rose-600 px-1 text-[10px] font-black leading-none text-white shadow-md"
            >
              {snap.unreadCount > 99 ? '99+' : snap.unreadCount}
            </span>
          )}
        </div>

        <div
          data-testid="live-chat-pill-label"
          className="mt-0.5 flex items-center gap-1 rounded-full border border-white/20 bg-[#212121]/95 px-1.5 py-0.5 text-[8.5px] font-bold leading-none text-[#ececec] shadow-[0_3px_8px_rgba(0,0,0,0.92)] transition group-hover:border-white/50 sm:px-2 sm:text-[9.5px]"
        >
          <span>{tr('라이브 채팅', 'Live Chat')}</span>
        </div>
      </button>

      {spectatorTarget &&
        (typeof document !== 'undefined' ? (
          createPortal(
            <LiveSpectatorModal
              target={spectatorTarget}
              liveResult={snap.matchResults[spectatorTarget.roomId]}
              onClose={() => setSpectatorTarget(null)}
            />,
            document.body,
          )
        ) : (
          <LiveSpectatorModal
            target={spectatorTarget}
            liveResult={snap.matchResults[spectatorTarget.roomId]}
            onClose={() => setSpectatorTarget(null)}
          />
        ))}
    </div>
  );
};
