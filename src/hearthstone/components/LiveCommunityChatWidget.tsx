import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Coins,
  Copy,
  Edit3,
  MessageCircleMore,
  Plus,
  Send,
  Shield,
  Swords,
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
  LiveDuelRoom,
  LivePeerPresence,
  snsheroLiveNetwork,
} from '../services/snsheroLiveNetwork';
import { hsStorage } from '../storage';
import { CLASSIC_HEROES, CustomDeck, PlayerProfile, ScreenName } from '../types';
import { HsGoldCoinIcon } from './CardVisual';

export interface LiveCommunityChatWidgetProps {
  screen: ScreenName;
  profile: PlayerProfile;
  onProfileChanged?: () => void;
  onOpenCollection?: () => void;
}

type HubTab = 'GLOBAL' | 'GUILD' | 'DUEL' | 'GOLD';

const GUILD_ICONS = ['🛡️', '❄️', '🌪️', '🔥', '⚔️', '🐉', '👑', '🌟'];
const STAKE_OPTIONS = [0, 10, 50, 100, 300, 500];
const GOLD_GIFT_PRESETS = [10, 50, 100, 300, 500];

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

  const [activeTab, setActiveTab] = useState<HubTab>('GLOBAL');
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

  // Guild creation / code join state
  const [showCreateGuild, setShowCreateGuild] = useState(false);
  const [guildNameDraft, setGuildNameDraft] = useState('');
  const [guildTagDraft, setGuildTagDraft] = useState('');
  const [guildIconDraft, setGuildIconDraft] = useState('🛡️');
  const [guildDescDraft, setGuildDescDraft] = useState('');
  const [guildJoinCode, setGuildJoinCode] = useState('');

  // Gold gifting state
  const [goldTargetPeerId, setGoldTargetPeerId] = useState('');
  const [goldTargetName, setGoldTargetName] = useState('');
  const [goldAmount, setGoldAmount] = useState<number>(50);
  const [goldNote, setGoldNote] = useState('');

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

  const rootRef = useRef<HTMLDivElement | null>(null);
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

  // Auto-scroll chat feed on new messages
  useEffect(() => {
    if (!snap.drawerOpen) return;
    if (activeTab === 'GLOBAL' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    } else if (activeTab === 'GUILD' && guildScrollRef.current) {
      guildScrollRef.current.scrollTop = guildScrollRef.current.scrollHeight;
    }
  }, [snap.drawerOpen, activeTab, snap.globalMessages.length, snap.guildMessages.length]);

  // Close drawer on Escape or outside click
  useEffect(() => {
    if (!snap.drawerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        snsheroLiveNetwork.setDrawerOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        snsheroLiveNetwork.setDrawerOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [snap.drawerOpen]);

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

  const openGoldGiftForPeer = (peer: { peerId: string; nickname: string }) => {
    if (peer.peerId === snap.peerId) return;
    hsAudio.playSfx('ui_click', 0.7);
    setGoldTargetPeerId(peer.peerId);
    setGoldTargetName(peer.nickname);
    setActiveTab('GOLD');
  };

  const openDuelInviteForPeer = (
    peer: { peerId: string; nickname: string },
    scope: LiveChatScope = 'GLOBAL',
  ) => {
    if (peer.peerId === snap.peerId) return;
    hsAudio.playSfx('ui_click', 0.7);
    setDuelTargetPeer(peer);
    setDuelScope(scope);
    setActiveTab('DUEL');
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

  const handleSendGold = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = goldTargetPeerId.trim();
    if (!targetId) {
      flashStatus(
        'err',
        tr('골드를 받을 모험가를 선택하거나 ID를 입력해 주세요.', 'Select a recipient or enter their Player ID.'),
      );
      return;
    }
    const resolvedPeer = snap.onlinePeers.find((p) => p.peerId === targetId);
    const recipientName =
      goldTargetName.trim() || resolvedPeer?.nickname || targetId;

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
    flashStatus(
      'ok',
      tr(
        `🪙 ${recipientName}님에게 ${goldAmount.toLocaleString()}G를 선물했습니다!`,
        `🪙 Sent ${goldAmount.toLocaleString()}G to ${recipientName}!`,
      ),
    );
  };

  const handleCreateDuelRoom = () => {
    if (!selectedDeck) {
      flashStatus('err', tr('출전할 30장 카드덱을 선택해 주세요.', 'Select a 30-card deck first.'));
      return;
    }
    hsAudio.playSfx('box_press', 0.85);
    const res = snsheroLiveNetwork.createDuelRoom({
      title: duelTitleDraft,
      deck: selectedDeck,
      stakeGold: duelStakeGold,
      scope: duelScope === 'GUILD' && snap.currentGuild ? 'GUILD' : 'GLOBAL',
      targetPeerId: duelTargetPeer?.peerId,
      targetPeerName: duelTargetPeer?.nickname,
    });
    if (!res.ok) {
      flashStatus('err', res.error || tr('대전방 개설 실패', 'Could not create Duel Room.'));
      return;
    }
    onProfileChanged?.();
    setDuelTitleDraft('');
    setDuelTargetPeer(null);
    flashStatus(
      'ok',
      tr(
        '⚔️ 대전방이 개설되어 실시간 채팅에 공유되었습니다! 상대가 입장하면 즉시 시작됩니다.',
        '⚔️ Duel Room is live! Battle begins automatically as soon as an opponent joins.',
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
      tr('⚔️ 대전방에 연결 중입니다... 곧 전장으로 이동합니다!', '⚔️ Connecting to Duel Room... Entering battlefield!'),
    );
  };

  const renderChatMessageItem = (msg: LiveChatMessage) => {
    const isMine = msg.senderId === snap.peerId;
    if (msg.kind === 'SYSTEM') {
      return (
        <div
          key={msg.id}
          className="my-1 rounded-lg border border-sky-400/25 bg-sky-950/35 px-2.5 py-1.5 text-center text-[11px] font-bold text-sky-200"
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
          className="my-1 rounded-xl border border-amber-300/60 bg-gradient-to-r from-amber-950/80 via-yellow-950/60 to-stone-950/90 p-2.5 text-amber-100 shadow-md"
        >
          <div className="flex items-center justify-between text-[10.5px] font-extrabold text-yellow-300">
            <span className="flex items-center gap-1">
              <HsGoldCoinIcon size={14} />
              <span>{tr('실시간 골드 선물', 'Live Gold Gift')}</span>
            </span>
            <span className="text-amber-200/70">{formatShortTime(msg.timestamp)}</span>
          </div>
          <p className="mt-1 text-xs font-extrabold leading-snug text-white">{msg.text}</p>
        </div>
      );
    }

    if (msg.kind === 'DUEL_ROOM' && msg.duelRoom) {
      const liveRoom = snap.openRooms.find((r) => r.roomId === msg.duelRoom?.roomId);
      const isJoinable =
        Boolean(liveRoom && liveRoom.status === 'WAITING') &&
        msg.duelRoom.hostPeerId !== snap.peerId;
      const heroInfo = getLocalizedHeroInfo(msg.duelRoom.hostHeroClass, lang);
      const heroMeta = CLASSIC_HEROES[msg.duelRoom.hostHeroClass];

      return (
        <div
          key={msg.id}
          data-testid={`chat-duel-room-card-${msg.duelRoom.roomId}`}
          className="my-1 rounded-xl border-2 border-rose-400/65 bg-gradient-to-b from-rose-950/85 via-stone-950/95 to-black p-2.5 text-amber-50 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <img
              src={heroMeta.heroPortraitUrl}
              alt={heroInfo.name}
              className="h-9 w-9 shrink-0 rounded-lg border border-amber-300/60 object-cover object-top"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10.5px] font-black text-rose-300">
                <span>⚔️ {tr('1:1 카드덱 대전방', '1v1 Deck Duel Room')}</span>
                <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-yellow-200">
                  {msg.duelRoom.stakeGold > 0
                    ? tr(`내기 ${msg.duelRoom.stakeGold}G`, `${msg.duelRoom.stakeGold}G Wager`)
                    : tr('친선 0G', 'Friendly')}
                </span>
              </div>
              <div className="truncate text-xs font-extrabold text-white">
                {msg.duelRoom.title}
              </div>
              <div className="truncate text-[10.5px] font-bold text-amber-200/80">
                {msg.duelRoom.hostName} · {heroInfo.className}
              </div>
            </div>
          </div>

          {isJoinable && liveRoom ? (
            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                data-testid={`chat-join-duel-btn-${liveRoom.roomId}`}
                onClick={() => handleJoinDuelRoom(liveRoom)}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-300/80 bg-emerald-700 px-3 py-1.5 text-xs font-extrabold text-white shadow hover:bg-emerald-600"
              >
                <Swords className="h-3.5 w-3.5" />
                <span>{tr('내 카드덱으로 즉시 대결!', 'Battle with My Deck!')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('DUEL')}
                className="min-h-[44px] rounded-lg border border-amber-300/40 bg-stone-900 px-2.5 text-[11px] font-extrabold text-amber-200 hover:bg-stone-800"
              >
                {tr('덱 변경', 'Deck')}
              </button>
            </div>
          ) : (
            <div className="mt-1.5 text-[10.5px] font-bold text-stone-400">
              {msg.duelRoom.hostPeerId === snap.peerId
                ? tr('내가 개설한 대전방 · 도전자 대기 중', 'Your room · Waiting for challenger')
                : tr('대결 진행 중 또는 종료된 방', 'Match in progress or closed')}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={msg.id}
        data-testid="live-chat-message-item"
        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
      >
        <div className="mb-0.5 flex flex-wrap items-center gap-1 text-[10px] font-bold text-stone-400">
          <span>{msg.senderBadge}</span>
          {msg.guildTag && (
            <span className="rounded bg-emerald-900/80 px-1 py-0.2 text-[9.5px] font-black text-emerald-200">
              [{msg.guildTag}]
            </span>
          )}
          <span className={isMine ? 'text-sky-300 font-extrabold' : 'text-amber-200 font-extrabold'}>
            {msg.senderName}
          </span>
          <span>· {formatShortTime(msg.timestamp)}</span>
          {!isMine && (
            <>
              <button
                type="button"
                onClick={() =>
                  openGoldGiftForPeer({
                    peerId: msg.senderId,
                    nickname: msg.senderName,
                  })
                }
                className="ml-1 rounded border border-amber-400/45 bg-amber-950/75 px-1.5 py-0.5 text-[9.5px] font-extrabold text-yellow-200 hover:bg-amber-900"
              >
                🪙 {tr('골드선물', 'Gift')}
              </button>
              <button
                type="button"
                onClick={() =>
                  openDuelInviteForPeer(
                    { peerId: msg.senderId, nickname: msg.senderName },
                    msg.scope,
                  )
                }
                className="rounded border border-rose-400/45 bg-rose-950/75 px-1.5 py-0.5 text-[9.5px] font-extrabold text-rose-200 hover:bg-rose-900"
              >
                ⚔️ {tr('대결', 'Duel')}
              </button>
            </>
          )}
        </div>
        <div
          className={`max-w-[88%] break-words rounded-2xl px-3 py-1.5 text-xs font-bold leading-relaxed shadow ${
            isMine
              ? 'rounded-br-sm border border-sky-400/50 bg-sky-900/85 text-sky-50'
              : 'rounded-bl-sm border border-stone-700 bg-stone-900/95 text-amber-50'
          }`}
        >
          {msg.text}
        </div>
      </div>
    );
  };

  const liveBadgeNumber = Math.max(1, snap.onlineCount);
  const openRoomsCount = snap.openRooms.filter((r) => r.status === 'WAITING').length;

  if (isNarrationActive) return null;

  // Flush to bottom-right corner identically with bottom-left Kadan Chatbot so cards stay unobstructed
  const positionClasses = 'fixed bottom-0.5 right-1 z-[126] sm:bottom-1 sm:right-2';

  return (
    <div
      ref={rootRef}
      data-testid="live-community-chat-root"
      className={`pointer-events-none ${positionClasses} flex flex-col items-end select-none`}
    >
      {/* Celebratory Incoming Gold Gift Toast */}
      {incomingGoldToast && (
        <div
          data-testid="live-gold-received-toast"
          className="pointer-events-auto mb-2 flex max-w-[300px] items-center gap-2.5 rounded-2xl border-2 border-yellow-300 bg-gradient-to-r from-amber-950 via-yellow-900/95 to-stone-950 px-3.5 py-2.5 text-amber-50 shadow-[0_14px_34px_rgba(0,0,0,0.9)]"
        >
          <HsGoldCoinIcon size={26} />
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-black text-yellow-300">
              +{incomingGoldToast.amount.toLocaleString()}G {tr('골드 선물 도착!', 'Gold Gift Received!')}
            </div>
            <div className="truncate text-[11px] font-bold text-amber-100">
              {tr(
                `${incomingGoldToast.fromName}님 선물 · 보유 ${incomingGoldToast.newGold.toLocaleString()}G`,
                `From ${incomingGoldToast.fromName} · Now ${incomingGoldToast.newGold.toLocaleString()}G`,
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Live Chat, Guild, Gold & Duel Room Drawer */}
      {snap.drawerOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          data-testid="live-chat-drawer"
          className="pointer-events-auto mb-2 flex h-[510px] max-h-[calc(100dvh-116px)] w-[346px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border-2 border-sky-400/70 bg-[#0b111c]/98 text-slate-100 shadow-[0_22px_52px_rgba(0,0,0,0.94),0_0_24px_rgba(56,189,248,0.22)] sm:h-[560px] sm:w-[400px]"
        >
          {/* Top Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700/80 bg-gradient-to-r from-slate-900 via-[#0f1b2e] to-slate-950 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="truncate text-xs font-black tracking-tight text-white sm:text-[13px]">
                  {tr('실시간 라이브 채팅 · 결투장', 'Live Chat · Guild & Duel Hub')}
                </span>
                <span
                  data-testid="drawer-online-count-pill"
                  className="shrink-0 rounded-full border border-emerald-400/50 bg-emerald-950/90 px-2 py-0.5 text-[10px] font-black text-emerald-300"
                >
                  {tr(`실시간 ${liveBadgeNumber}명`, `${liveBadgeNumber} Live`)}
                </span>
              </div>

              {/* Nickname & Owned Gold Row */}
              <div className="mt-1 flex items-center gap-1.5 text-[10.5px]">
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
                      maxLength={18}
                      className="h-8 w-32 rounded border border-sky-400 bg-slate-950 px-1.5 text-[16px] font-bold text-white focus:outline-none sm:h-6 sm:w-28 sm:text-[11px]"
                    />
                    <button
                      type="submit"
                      className="rounded bg-sky-600 px-2 py-0.5 text-[10px] font-extrabold text-white"
                    >
                      {tr('저장', 'Save')}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    data-testid="live-edit-nickname-btn"
                    onClick={() => {
                      setNickDraft(snap.nickname);
                      setEditingNick(true);
                    }}
                    className="inline-flex items-center gap-1 rounded bg-slate-800/90 px-1.5 py-0.5 font-bold text-sky-200 hover:bg-slate-700"
                  >
                    <span>{snap.nickname}</span>
                    <Edit3 className="h-2.5 w-2.5 opacity-80" />
                  </button>
                )}

                <span className="text-slate-500">|</span>
                <span
                  data-testid="live-drawer-my-gold"
                  className="inline-flex items-center gap-1 font-extrabold text-yellow-300"
                >
                  <HsGoldCoinIcon size={13} />
                  <span>{profile.gold.toLocaleString()}G</span>
                </span>
                <button
                  type="button"
                  title={tr('내 플레이어 ID 복사 (골드 선물 받기용)', 'Copy My Player ID')}
                  onClick={() => {
                    navigator.clipboard?.writeText(snap.peerId).catch(() => {});
                    flashStatus('ok', tr(`내 ID(${snap.peerId}) 복사 완료!`, `Copied ID (${snap.peerId})!`));
                  }}
                  className="ml-auto inline-flex items-center gap-0.5 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-300 hover:text-white"
                >
                  <span>ID:{snap.peerId.slice(0, 7)}</span>
                  <Copy className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>

            <button
              type="button"
              data-testid="live-chat-close-btn"
              onClick={() => {
                hsAudio.playSfx('ui_click', 0.5);
                snsheroLiveNetwork.setDrawerOpen(false);
              }}
              aria-label={tr('실시간 채팅 닫기', 'Close Live Chat')}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-600/80 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Primary 4-Feature Navigation Tabs */}
          <div className="grid shrink-0 grid-cols-4 gap-1 border-b border-slate-800 bg-slate-950/95 p-1.5">
            <button
              type="button"
              data-testid="live-tab-GLOBAL"
              onClick={() => setActiveTab('GLOBAL')}
              className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl border text-[10.5px] font-extrabold transition ${
                activeTab === 'GLOBAL'
                  ? 'border-sky-400 bg-sky-900/75 text-white shadow'
                  : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <MessageCircleMore className="mb-0.5 h-3.5 w-3.5 text-sky-300" />
              <span>{tr('전체채팅', 'Global')}</span>
            </button>

            <button
              type="button"
              data-testid="live-tab-GUILD"
              onClick={() => setActiveTab('GUILD')}
              className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl border text-[10.5px] font-extrabold transition ${
                activeTab === 'GUILD'
                  ? 'border-emerald-400 bg-emerald-900/75 text-white shadow'
                  : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Shield className="mb-0.5 h-3.5 w-3.5 text-emerald-300" />
              <span>
                {snap.currentGuild
                  ? `[${snap.currentGuild.tag}]`
                  : tr('길드채팅', 'Guild')}
              </span>
            </button>

            <button
              type="button"
              data-testid="live-tab-DUEL"
              onClick={() => setActiveTab('DUEL')}
              className={`relative flex min-h-[44px] flex-col items-center justify-center rounded-xl border text-[10.5px] font-extrabold transition ${
                activeTab === 'DUEL'
                  ? 'border-rose-400 bg-rose-900/75 text-white shadow'
                  : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Swords className="mb-0.5 h-3.5 w-3.5 text-rose-300" />
              <span>{tr('대전방', 'Duel Room')}</span>
              {openRoomsCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                  {openRoomsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              data-testid="live-tab-GOLD"
              onClick={() => setActiveTab('GOLD')}
              className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl border text-[10.5px] font-extrabold transition ${
                activeTab === 'GOLD'
                  ? 'border-amber-400 bg-amber-900/75 text-white shadow'
                  : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Coins className="mb-0.5 h-3.5 w-3.5 text-yellow-300" />
              <span>{tr('골드선물', 'Send Gold')}</span>
            </button>
          </div>

          {/* Transient Feedback Banner */}
          {statusBanner && (
            <div
              data-testid="live-status-banner"
              className={`shrink-0 px-3 py-1.5 text-xs font-extrabold ${
                statusBanner.kind === 'ok'
                  ? 'bg-emerald-900/90 text-emerald-100'
                  : 'bg-rose-900/90 text-rose-100'
              }`}
            >
              {statusBanner.text}
            </div>
          )}

          {/* ==================== TAB 1: GLOBAL LIVE CHAT ==================== */}
          {activeTab === 'GLOBAL' && (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Online Peers Strip */}
              <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-slate-800/90 bg-slate-900/75 px-2.5 py-1.5">
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-extrabold text-emerald-300">
                  <Users className="h-3 w-3" />
                  <span>{tr(`접속 ${liveBadgeNumber}`, `${liveBadgeNumber} Online`)}:</span>
                </span>
                {snap.onlinePeers.map((peer: LivePeerPresence) => {
                  const isSelf = peer.peerId === snap.peerId;
                  return (
                    <button
                      key={peer.peerId}
                      type="button"
                      data-testid={`online-peer-chip-${peer.peerId}`}
                      disabled={isSelf}
                      onClick={() => openGoldGiftForPeer(peer)}
                      title={
                        isSelf
                          ? tr('내 프로필', 'You')
                          : tr('클릭하여 골드 선물하기', 'Click to gift Gold')
                      }
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${
                        isSelf
                          ? 'border-sky-400/50 bg-sky-950/70 text-sky-200'
                          : 'cursor-pointer border-amber-400/45 bg-slate-800 text-amber-100 hover:border-yellow-300'
                      }`}
                    >
                      <span>{peer.badgeIcon}</span>
                      {peer.guildTag && (
                        <span className="text-emerald-300">[{peer.guildTag}]</span>
                      )}
                      <span>{peer.nickname}</span>
                      {!isSelf && <span className="text-yellow-300">🪙</span>}
                    </button>
                  );
                })}
              </div>

              {/* Global Messages List */}
              <div
                ref={chatScrollRef}
                data-testid="global-chat-feed"
                className="flex-1 space-y-2 overflow-y-auto p-3"
              >
                {snap.globalMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-400">
                    <MessageCircleMore className="mb-2 h-8 w-8 text-sky-400/60" />
                    <p className="font-extrabold text-slate-200">
                      {tr(
                        '실시간 전체 대화방에 오신 것을 환영합니다!',
                        'Welcome to SNSHero Real-Time Global Chat!',
                      )}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed">
                      {tr(
                        '접속 중인 유저들과 실시간 대화, 골드 선물, 길드 모집, 1:1 카드덱 대전을 바로 시작해 보세요!',
                        'Chat live with players, send Gold gifts, join Guilds, or host a 1v1 Deck Duel!',
                      )}
                    </p>
                  </div>
                ) : (
                  snap.globalMessages.map(renderChatMessageItem)
                )}
              </div>

              {/* Global Input Bar */}
              <form
                onSubmit={handleGlobalSubmit}
                className="flex shrink-0 items-center gap-1.5 border-t border-slate-800 bg-slate-950 p-2"
              >
                <button
                  type="button"
                  title={tr('대전방 만들기', 'Create Duel Room')}
                  onClick={() => setActiveTab('DUEL')}
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-rose-400/50 bg-rose-950/75 text-rose-200 hover:bg-rose-900"
                >
                  <Swords className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  data-testid="global-chat-input"
                  value={globalInput}
                  onChange={(e) => setGlobalInput(e.target.value)}
                  maxLength={240}
                  placeholder={tr('실시간 메시지 입력...', 'Type a live message...')}
                  className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-[16px] font-bold text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none sm:text-xs"
                />
                <button
                  type="submit"
                  data-testid="global-chat-send-btn"
                  className="flex min-h-[44px] min-w-[52px] shrink-0 items-center justify-center gap-1 rounded-xl border border-sky-300/70 bg-sky-600 px-3 text-xs font-extrabold text-white hover:bg-sky-500"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{tr('전송', 'Send')}</span>
                </button>
              </form>
            </div>
          )}

          {/* ==================== TAB 2: GUILD & GUILD CHAT ==================== */}
          {activeTab === 'GUILD' && (
            <div className="flex min-h-0 flex-1 flex-col">
              {!snap.currentGuild ? (
                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-emerald-300">
                        🛡️ {tr('길드 가입 또는 새 길드 창설', 'Join or Create a Guild')}
                      </h4>
                      <p className="text-[10.5px] font-bold text-slate-400">
                        {tr(
                          '길드 전용 실시간 채팅창, 길드원 골드 지원, 길드 내전을 즐기세요!',
                          'Unlock private Guild Chat, member Gold support & Guild scrims!',
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-testid="toggle-create-guild-btn"
                      onClick={() => setShowCreateGuild((v) => !v)}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl border border-emerald-400/70 bg-emerald-800 px-2.5 text-[11px] font-extrabold text-white hover:bg-emerald-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{tr('길드 창설', 'New Guild')}</span>
                    </button>
                  </div>

                  {showCreateGuild && (
                    <form
                      onSubmit={handleCreateGuild}
                      data-testid="create-guild-form"
                      className="space-y-2 rounded-xl border border-emerald-400/50 bg-emerald-950/40 p-2.5"
                    >
                      <div className="flex flex-wrap gap-1">
                        {GUILD_ICONS.map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setGuildIconDraft(ic)}
                            className={`h-8 w-8 rounded-lg border text-sm ${
                              guildIconDraft === ic
                                ? 'border-emerald-300 bg-emerald-800'
                                : 'border-slate-700 bg-slate-900'
                            }`}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          data-testid="guild-tag-input"
                          value={guildTagDraft}
                          onChange={(e) => setGuildTagDraft(e.target.value.toUpperCase())}
                          maxLength={5}
                          placeholder={tr('태그 (예: HERO)', 'Tag (HERO)')}
                          className="min-h-[44px] w-28 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-[16px] font-extrabold text-emerald-200 placeholder:text-slate-500 sm:text-xs"
                        />
                        <input
                          type="text"
                          data-testid="guild-name-input"
                          value={guildNameDraft}
                          onChange={(e) => setGuildNameDraft(e.target.value)}
                          maxLength={22}
                          placeholder={tr('길드 이름 (2자 이상)', 'Guild Name')}
                          className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-[16px] font-bold text-white placeholder:text-slate-500 sm:text-xs"
                        />
                      </div>
                      <input
                        type="text"
                        value={guildDescDraft}
                        onChange={(e) => setGuildDescDraft(e.target.value)}
                        maxLength={50}
                        placeholder={tr('길드 한줄 소개 (선택)', 'Guild motto (optional)')}
                        className="min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-[16px] text-slate-200 placeholder:text-slate-500 sm:min-h-[40px] sm:text-xs"
                      />
                      <button
                        type="submit"
                        data-testid="guild-create-submit-btn"
                        className="min-h-[44px] w-full rounded-xl border border-emerald-300 bg-emerald-600 text-xs font-black text-white hover:bg-emerald-500"
                      >
                        🛡️ {tr('길드 창설 및 길드채팅 입장', 'Create Guild & Enter Chat')}
                      </button>
                    </form>
                  )}

                  {/* Join by Guild Code / Tag */}
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      data-testid="guild-code-join-input"
                      value={guildJoinCode}
                      onChange={(e) => setGuildJoinCode(e.target.value)}
                      placeholder={tr('초대코드 또는 길드태그로 가입', 'Join by Guild Tag or Code')}
                      className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-2.5 text-[16px] font-bold text-white placeholder:text-slate-500 sm:text-xs"
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
                      className="min-h-[44px] shrink-0 rounded-xl border border-sky-400/60 bg-sky-800 px-3 text-xs font-extrabold text-white hover:bg-sky-700"
                    >
                      {tr('코드 가입', 'Join')}
                    </button>
                  </div>

                  {/* Public Guild Directory */}
                  <div className="space-y-2">
                    {snap.availableGuilds.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-700/90 bg-slate-900/90 p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-black text-white">
                            <span>{g.icon}</span>
                            <span className="rounded bg-emerald-900/90 px-1.5 py-0.5 text-[10px] text-emerald-300">
                              [{g.tag}]
                            </span>
                            <span className="truncate">{g.name}</span>
                          </div>
                          <p className="mt-0.5 truncate text-[10.5px] font-bold text-slate-400">
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
                          className="min-h-[44px] shrink-0 rounded-xl border border-emerald-400/70 bg-emerald-700 px-3 text-xs font-extrabold text-white hover:bg-emerald-600"
                        >
                          {tr('가입', 'Join')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {/* Active Guild Top Bar */}
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-b border-emerald-500/30 bg-emerald-950/45 px-2.5 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-200">
                        <span>{snap.currentGuild.icon}</span>
                        <span>[{snap.currentGuild.tag}]</span>
                        <span className="truncate text-white">{snap.currentGuild.name}</span>
                        <span className="rounded-full bg-emerald-900 px-1.5 py-0.5 text-[9.5px] text-emerald-200">
                          {tr(`접속 ${Math.max(1, guildOnlinePeers.length)}명`, `${Math.max(1, guildOnlinePeers.length)} Online`)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDuelScope('GUILD');
                          setActiveTab('DUEL');
                        }}
                        className="rounded-lg border border-rose-400/50 bg-rose-950/80 px-2 py-1 text-[10px] font-extrabold text-rose-200 hover:bg-rose-900"
                      >
                        ⚔️ {tr('길드내전', 'Guild Duel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(snap.currentGuild?.tag || '').catch(() => {});
                          flashStatus(
                            'ok',
                            tr(
                              `길드 태그 [${snap.currentGuild?.tag}] 복사 완료!`,
                              `Copied Guild Tag [${snap.currentGuild?.tag}]!`,
                            ),
                          );
                        }}
                        className="rounded-lg border border-emerald-400/40 bg-emerald-950 px-2 py-1 text-[10px] font-extrabold text-emerald-200"
                      >
                        {tr('코드복사', 'Code')}
                      </button>
                      <button
                        type="button"
                        data-testid="guild-leave-btn"
                        onClick={() => snsheroLiveNetwork.leaveGuild()}
                        className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-slate-800"
                      >
                        {tr('탈퇴', 'Leave')}
                      </button>
                    </div>
                  </div>

                  {/* Guild Chat Feed */}
                  <div
                    ref={guildScrollRef}
                    data-testid="guild-chat-feed"
                    className="flex-1 space-y-2 overflow-y-auto p-3"
                  >
                    {snap.guildMessages.length === 0 ? (
                      <div className="py-10 text-center text-xs font-bold text-slate-400">
                        {tr(
                          '길드원들과 첫 인사를 나누고 골드 지원·길드 내전을 즐겨보세요!',
                          'Say hello to your Guildmates, gift Gold, or start a Guild Duel!',
                        )}
                      </div>
                    ) : (
                      snap.guildMessages.map(renderChatMessageItem)
                    )}
                  </div>

                  {/* Guild Chat Input */}
                  <form
                    onSubmit={handleGuildSubmit}
                    className="flex shrink-0 items-center gap-1.5 border-t border-slate-800 bg-slate-950 p-2"
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
                      className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-emerald-500/40 bg-slate-900 px-3 text-[16px] font-bold text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none sm:text-xs"
                    />
                    <button
                      type="submit"
                      data-testid="guild-chat-send-btn"
                      className="flex min-h-[44px] min-w-[52px] shrink-0 items-center justify-center gap-1 rounded-xl border border-emerald-300/70 bg-emerald-600 px-3 text-xs font-extrabold text-white hover:bg-emerald-500"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{tr('전송', 'Send')}</span>
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* ==================== TAB 3: LIVE 1v1 DECK DUEL ROOMS ==================== */}
          {activeTab === 'DUEL' && (
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {/* My 30-Card Deck Selector (applies to BOTH creating a room & joining a room!) */}
              <div className="rounded-xl border border-amber-400/50 bg-slate-900/95 p-2.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="live-pvp-deck-select"
                    className="text-[11px] font-black text-amber-200"
                  >
                    🃏 {tr('출전할 내 30장 카드덱 선택', 'Choose Your 30-Card Deck')}
                  </label>
                  {onOpenCollection && (
                    <button
                      type="button"
                      onClick={() => {
                        snsheroLiveNetwork.setDrawerOpen(false);
                        onOpenCollection();
                      }}
                      className="text-[10.5px] font-extrabold text-sky-300 underline hover:text-sky-200"
                    >
                      {tr('내 덱 편집 ›', 'Edit Decks ›')}
                    </button>
                  )}
                </div>

                <select
                  id="live-pvp-deck-select"
                  data-testid="live-pvp-deck-select"
                  value={selectedDeck?.id || ''}
                  onChange={(e) => setSelectedDeckId(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-amber-400/45 bg-slate-950 px-2.5 text-[16px] font-extrabold text-white focus:border-amber-300 focus:outline-none sm:text-xs"
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {getDeckDisplayLabel(d)} ({d.cards.length}/30)
                    </option>
                  ))}
                </select>
              </div>

              {/* Host New Duel Room Box */}
              <div className="space-y-2 rounded-xl border border-rose-400/50 bg-rose-950/25 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-200">
                    ⚔️ {tr('실시간 1:1 대전방 만들기', 'Host a Live 1v1 Duel Room')}
                  </span>
                  {duelTargetPeer && (
                    <span className="inline-flex items-center gap-1 rounded bg-rose-900 px-1.5 py-0.5 text-[10px] font-extrabold text-rose-100">
                      <span>vs {duelTargetPeer.nickname}</span>
                      <button
                        type="button"
                        onClick={() => setDuelTargetPeer(null)}
                        className="ml-0.5 text-rose-200 hover:text-white"
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
                  placeholder={tr(
                    '방 제목 (비워두면 자동 생성)',
                    'Room title (optional)',
                  )}
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 text-[16px] font-bold text-white placeholder:text-slate-500 sm:min-h-[42px] sm:text-xs"
                />

                {/* Stake Gold Pills */}
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-slate-300">
                    {tr('승부 방식 (친선 0G 또는 골드 내기)', 'Match Stake (Friendly 0G or Gold Wager)')}
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {STAKE_OPTIONS.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setDuelStakeGold(st)}
                        className={`min-h-[38px] rounded-lg border text-[10.5px] font-extrabold transition ${
                          duelStakeGold === st
                            ? 'border-yellow-300 bg-amber-600 text-stone-950'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {st === 0 ? tr('친선', 'Free') : `${st}G`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scope Toggle if in Guild */}
                {snap.currentGuild && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDuelScope('GLOBAL')}
                      className={`min-h-[38px] rounded-lg border text-[11px] font-extrabold ${
                        duelScope === 'GLOBAL'
                          ? 'border-sky-400 bg-sky-900/80 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      🌐 {tr('전체 공개 대전방', 'Public Room')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuelScope('GUILD')}
                      className={`min-h-[38px] rounded-lg border text-[11px] font-extrabold ${
                        duelScope === 'GUILD'
                          ? 'border-emerald-400 bg-emerald-900/80 text-white'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      🛡️ [{snap.currentGuild.tag}] {tr('길드 내전방', 'Guild Room')}
                    </button>
                  </div>
                )}

                {myHostedWaitingRoom ? (
                  <div
                    data-testid="hosted-waiting-room-banner"
                    className="space-y-2 rounded-xl border border-emerald-400/70 bg-emerald-950/60 p-2.5"
                  >
                    <div className="text-xs font-black text-emerald-200">
                      🟢 {tr('내 대전방 대기 중 — 상대 입장 시 자동 시작!', 'Your Duel Room is Open — Auto-starts on join!')}
                    </div>
                    <div className="text-[11px] font-bold text-white">
                      {myHostedWaitingRoom.title}
                    </div>
                    <button
                      type="button"
                      data-testid="cancel-duel-room-btn"
                      onClick={() => {
                        snsheroLiveNetwork.cancelDuelRoom(myHostedWaitingRoom.roomId);
                        onProfileChanged?.();
                      }}
                      className="min-h-[44px] w-full rounded-xl border border-rose-400/60 bg-rose-900/80 text-xs font-extrabold text-rose-100 hover:bg-rose-800"
                    >
                      ✕ {tr('대전방 닫기', 'Cancel Duel Room')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="create-duel-room-btn"
                    onClick={handleCreateDuelRoom}
                    className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-gradient-to-r from-rose-600 to-amber-600 text-xs font-black text-white shadow-lg hover:brightness-110"
                  >
                    <Swords className="h-4 w-4" />
                    <span>
                      {tr(
                        '내 카드덱으로 대전방 개설 & 채팅 공유',
                        'Create Duel Room with My Deck',
                      )}
                    </span>
                  </button>
                )}
              </div>

              {/* Active Open Rooms List */}
              <div className="space-y-2">
                <div className="text-xs font-black text-slate-200">
                  🔥 {tr(`실시간 열린 대전방 (${openRoomsCount})`, `Open Duel Rooms (${openRoomsCount})`)}
                </div>

                {openRoomsCount === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 py-6 text-center text-xs font-bold text-slate-400">
                    {tr(
                      '현재 대기 중인 대전방이 없습니다. 위 버튼으로 첫 대전방을 만들어 보세요!',
                      'No waiting Duel Rooms right now. Host one above to invite challengers!',
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
                          className="flex items-center justify-between gap-2 rounded-xl border border-rose-400/45 bg-slate-900/95 p-2.5"
                        >
                          <img
                            src={heroMeta.heroPortraitUrl}
                            alt={heroInfo.name}
                            className="h-10 w-10 shrink-0 rounded-lg border border-amber-300/60 object-cover object-top"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-extrabold text-white">
                              {room.title}
                            </div>
                            <div className="truncate text-[10.5px] font-bold text-amber-200/85">
                              {room.hostName} · {heroInfo.className} ·{' '}
                              {room.stakeGold > 0
                                ? tr(`내기 ${room.stakeGold}G`, `${room.stakeGold}G`)
                                : tr('친선 0G', 'Free')}
                            </div>
                          </div>
                          {isMyRoom ? (
                            <span className="shrink-0 rounded-lg bg-emerald-950 px-2.5 py-1.5 text-[10.5px] font-extrabold text-emerald-300">
                              {tr('대기 중...', 'Waiting...')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              data-testid={`join-duel-room-btn-${room.roomId}`}
                              onClick={() => handleJoinDuelRoom(room)}
                              className="min-h-[44px] shrink-0 rounded-xl border border-emerald-300 bg-emerald-600 px-3 text-xs font-black text-white shadow hover:bg-emerald-500"
                            >
                              ⚔️ {tr('참전!', 'Battle!')}
                            </button>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 4: PEER-TO-PEER GOLD GIFTING ==================== */}
          {activeTab === 'GOLD' && (
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              <form
                onSubmit={handleSendGold}
                data-testid="send-gold-form"
                className="space-y-2.5 rounded-xl border border-amber-400/55 bg-amber-950/20 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-yellow-300">
                    🪙 {tr('다른 유저에게 골드 선물하기', 'Gift Gold to Another Player')}
                  </span>
                  <span className="text-[11px] font-extrabold text-amber-200">
                    {tr(`보유: ${profile.gold.toLocaleString()}G`, `Owned: ${profile.gold.toLocaleString()}G`)}
                  </span>
                </div>

                {/* Select Online Recipient */}
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-slate-300">
                    {tr('실시간 접속 유저 선택', 'Pick an Online Player')}
                  </div>
                  {otherOnlinePeers.length === 0 ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-2 text-[11px] font-bold text-slate-400">
                      {tr(
                        '다른 브라우저/기기로 접속한 유저가 나타나면 클릭해 바로 선택하거나 아래에 상대 ID를 입력하세요.',
                        'Online players appear here automatically, or enter a Player ID below.',
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {otherOnlinePeers.map((peer) => {
                        const selected = goldTargetPeerId === peer.peerId;
                        return (
                          <button
                            key={peer.peerId}
                            type="button"
                            data-testid={`gold-recipient-chip-${peer.peerId}`}
                            onClick={() => {
                              setGoldTargetPeerId(peer.peerId);
                              setGoldTargetName(peer.nickname);
                            }}
                            className={`min-h-[38px] rounded-xl border px-2.5 py-1 text-[11px] font-extrabold transition ${
                              selected
                                ? 'border-yellow-300 bg-amber-600 text-stone-950 shadow'
                                : 'border-slate-700 bg-slate-900 text-amber-100 hover:border-amber-400'
                            }`}
                          >
                            {peer.badgeIcon} {peer.nickname}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Direct ID Input */}
                <input
                  type="text"
                  data-testid="gold-target-id-input"
                  value={goldTargetPeerId}
                  onChange={(e) => setGoldTargetPeerId(e.target.value)}
                  placeholder={tr('받는 유저 ID (예: u_abcd12)', 'Recipient Player ID (e.g. u_abcd12)')}
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 text-[16px] font-bold text-white placeholder:text-slate-500 sm:text-xs"
                />

                {/* Amount Presets & Input */}
                <div>
                  <div className="mb-1 grid grid-cols-5 gap-1">
                    {GOLD_GIFT_PRESETS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        data-testid={`gold-preset-${amt}`}
                        onClick={() => setGoldAmount(amt)}
                        className={`min-h-[38px] rounded-lg border text-[11px] font-extrabold ${
                          goldAmount === amt
                            ? 'border-yellow-300 bg-amber-600 text-stone-950'
                            : 'border-slate-700 bg-slate-900 text-amber-200 hover:bg-slate-800'
                        }`}
                      >
                        {amt}G
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, profile.gold)}
                    data-testid="gold-amount-input"
                    value={goldAmount}
                    onChange={(e) => setGoldAmount(Math.max(1, Number(e.target.value) || 1))}
                    className="min-h-[44px] w-full rounded-xl border border-amber-400/50 bg-slate-950 px-3 text-[16px] font-black text-yellow-300 sm:text-xs"
                  />
                </div>

                <input
                  type="text"
                  data-testid="gold-note-input"
                  value={goldNote}
                  onChange={(e) => setGoldNote(e.target.value)}
                  maxLength={60}
                  placeholder={tr('응원 메시지 (선택, 예: 전설 뽑으세요!)', 'Optional note (e.g. Good luck on packs!)')}
                  className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 text-[16px] font-bold text-white placeholder:text-slate-500 sm:min-h-[42px] sm:text-xs"
                />

                <button
                  type="submit"
                  data-testid="send-gold-submit-btn"
                  className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-xl border border-yellow-200 bg-gradient-to-r from-amber-500 to-yellow-600 text-xs font-black text-stone-950 shadow-lg hover:brightness-110"
                >
                  <HsGoldCoinIcon size={16} />
                  <span>
                    {tr(
                      `${goldAmount.toLocaleString()}G 즉시 선물하기`,
                      `Send ${goldAmount.toLocaleString()}G Now`,
                    )}
                  </span>
                </button>
              </form>

              {/* Recent Gold Transfer Log */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-black text-slate-300">
                  📜 {tr('최근 골드 선물 내역', 'Recent Gold Transfers')}
                </div>
                {hsStorage.getGoldGiftHistory().length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 py-4 text-center text-[11px] font-bold text-slate-500">
                    {tr('아직 주고받은 골드 선물 내역이 없습니다.', 'No Gold transfers yet.')}
                  </div>
                ) : (
                  hsStorage
                    .getGoldGiftHistory()
                    .slice(0, 10)
                    .map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-bold"
                      >
                        <span className="truncate text-slate-200">
                          {entry.direction === 'SENT'
                            ? `↗ ${entry.counterpartyName}`
                            : `↙ ${entry.counterpartyName}`}
                        </span>
                        <span
                          className={
                            entry.direction === 'SENT'
                              ? 'font-black text-rose-300'
                              : 'font-black text-emerald-300'
                          }
                        >
                          {entry.direction === 'SENT' ? '-' : '+'}
                          {entry.amount.toLocaleString()}G
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom-Right Compact Real Live Chat Floating Icon Button + Real-Time Count Badge */}
      <button
        type="button"
        data-testid="live-chat-trigger-btn"
        onClick={(e) => {
          e.stopPropagation();
          hsAudio.playSfx('ui_click', 0.75);
          snsheroLiveNetwork.setDrawerOpen(!snap.drawerOpen);
        }}
        aria-label={tr(
          `실시간 라이브 채팅 열기 (현재 ${liveBadgeNumber}명 대화 중)`,
          `Open Real-Time Live Chat (${liveBadgeNumber} active)`,
        )}
        className="pointer-events-auto group relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-end focus:outline-none"
      >
        {/* Compact Modern Real Chat Icon Orb */}
        <div
          className={`relative flex h-[40px] w-[40px] items-center justify-center rounded-full border-2 shadow-[0_6px_16px_rgba(0,0,0,0.9),0_0_12px_rgba(14,165,233,0.4)] transition-transform duration-150 group-hover:scale-108 group-active:scale-95 sm:h-[48px] sm:w-[48px] ${
            snap.drawerOpen
              ? 'border-sky-200 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-900 text-white'
              : 'border-sky-300/90 bg-gradient-to-br from-sky-600 via-[#0e3460] to-[#081529] text-white'
          }`}
        >
          <MessageCircleMore className="h-5 w-5 stroke-[2.3] drop-shadow sm:h-6 sm:w-6" />

          {/* Top-Left Pulsing Green Live Dot */}
          <span className="pointer-events-none absolute left-0 top-0 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-slate-950 bg-emerald-400 shadow-[0_0_6px_#34d399]">
            <span className="h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
          </span>

          {/* Top-Right Real-Time Live Conversation / Unread Count Badge */}
          <span
            data-testid="live-chat-count-badge"
            className={`pointer-events-none absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border px-1 text-[9.5px] font-black leading-none shadow-md ${
              snap.unreadCount > 0
                ? 'animate-bounce border-white bg-rose-600 text-white'
                : 'border-emerald-100 bg-emerald-600 text-white'
            }`}
          >
            {snap.unreadCount > 0 ? `+${snap.unreadCount}` : liveBadgeNumber}
          </span>
        </div>

        {/* Compact Live Conversation Pill Under the Real Chat Icon */}
        <div
          data-testid="live-chat-pill-label"
          className="mt-0.5 flex items-center gap-0.5 rounded-full border border-sky-300/80 bg-[#081322]/95 px-1.5 py-0.5 text-[8.5px] font-extrabold leading-none text-sky-100 shadow-[0_3px_8px_rgba(0,0,0,0.92)] transition group-hover:border-white sm:px-2 sm:text-[9.5px]"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>
            {tr(`실시간 ${liveBadgeNumber}`, `Live ${liveBadgeNumber}`)}
          </span>
        </div>
      </button>
    </div>
  );
};
