import mqtt, { MqttClient } from 'mqtt';
import { isKoreanLanguage, tr } from '../../i18n/heroLang';
import { createBattleMatch } from '../engine/GameEngine';
import { PvpGuestAction, mirrorMatchStateForGuest } from '../engine/pvpSync';
import { getEquippedPrestigeSummary, hsStorage } from '../storage';
import { BattleMatchState, CustomDeck, HeroClass, LivePvpMeta } from '../types';

export type LiveChatScope = 'GLOBAL' | 'GUILD';

export interface GuildInfo {
  id: string;
  name: string;
  tag: string;
  icon: string;
  descriptionKo: string;
  descriptionEn: string;
  createdBy?: string;
  createdAt: number;
}

export interface LivePeerPresence {
  peerId: string;
  nickname: string;
  badgeIcon: string;
  titleText: string;
  rank: number;
  guildId?: string;
  guildTag?: string;
  guildName?: string;
  inBattle?: boolean;
  lastSeenAt: number;
}

export interface LiveChatMessage {
  id: string;
  scope: LiveChatScope;
  guildId?: string;
  kind: 'TEXT' | 'GOLD_GIFT' | 'DUEL_ROOM' | 'SYSTEM';
  senderId: string;
  senderName: string;
  senderBadge: string;
  senderRank: number;
  guildTag?: string;
  text: string;
  timestamp: number;
  goldGift?: {
    transferId: string;
    toPeerId: string;
    toName: string;
    amount: number;
    note?: string;
  };
  duelRoom?: {
    roomId: string;
    title: string;
    hostPeerId: string;
    hostName: string;
    hostHeroClass: HeroClass;
    hostDeckName: string;
    stakeGold: number;
    targetPeerId?: string;
    targetPeerName?: string;
  };
}

export interface LiveDuelRoom {
  roomId: string;
  title: string;
  hostPeerId: string;
  hostName: string;
  hostBadge: string;
  hostRank: number;
  hostDeckId: string;
  hostDeckName: string;
  hostHeroClass: HeroClass;
  stakeGold: number;
  scope: LiveChatScope;
  guildId?: string;
  guildTag?: string;
  targetPeerId?: string;
  targetPeerName?: string;
  isRankedMatchmaking?: boolean;
  status: 'WAITING' | 'IN_PROGRESS' | 'CLOSED';
  guestPeerId?: string;
  guestName?: string;
  createdAt: number;
  updatedAt: number;
}

export type LiveEmoteKey = 'greetings' | 'well_played' | 'thanks' | 'wow' | 'oops' | 'threaten';

type WirePacket =
  | {
      pktId: string;
      type: 'PRESENCE_PING';
      senderId: string;
      presence: LivePeerPresence;
      requestReply?: boolean;
    }
  | {
      pktId: string;
      type: 'PRESENCE_LEAVE';
      senderId: string;
    }
  | {
      pktId: string;
      type: 'CHAT_MESSAGE';
      senderId: string;
      message: LiveChatMessage;
    }
  | {
      pktId: string;
      type: 'HISTORY_SYNC';
      senderId: string;
      targetPeerId?: string;
      globalMessages: LiveChatMessage[];
      guilds: GuildInfo[];
      openRooms: LiveDuelRoom[];
    }
  | {
      pktId: string;
      type: 'GUILD_ANNOUNCE';
      senderId: string;
      guild: GuildInfo;
    }
  | {
      pktId: string;
      type: 'GOLD_TRANSFER';
      senderId: string;
      transferId: string;
      fromId: string;
      fromName: string;
      fromBadge: string;
      toId: string;
      toName: string;
      amount: number;
      note?: string;
      scope: LiveChatScope;
      guildId?: string;
      timestamp: number;
    }
  | {
      pktId: string;
      type: 'GOLD_TRANSFER_ACK';
      senderId: string;
      transferId: string;
      toId: string;
      toName: string;
      fromId: string;
      amount: number;
    }
  | {
      pktId: string;
      type: 'DUEL_ROOM_UPSERT';
      senderId: string;
      room: LiveDuelRoom;
    }
  | {
      pktId: string;
      type: 'DUEL_JOIN_REQUEST';
      senderId: string;
      roomId: string;
      hostPeerId: string;
      guestPeerId: string;
      guestName: string;
      guestBadge: string;
      guestRank: number;
      guestDeckName: string;
      guestHeroClass: HeroClass;
      guestCards: string[];
    }
  | {
      pktId: string;
      type: 'PVP_MATCH_START';
      senderId: string;
      roomId: string;
      hostPeerId: string;
      guestPeerId: string;
      stakeGold: number;
      guestInitialState: BattleMatchState;
    }
  | {
      pktId: string;
      type: 'PVP_STATE_SYNC';
      senderId: string;
      roomId: string;
      targetGuestId: string;
      seq: number;
      guestState: BattleMatchState;
    }
  | {
      pktId: string;
      type: 'PVP_GUEST_ACTION';
      senderId: string;
      roomId: string;
      targetHostId: string;
      seq: number;
      action: PvpGuestAction;
    }
  | {
      pktId: string;
      type: 'PVP_EMOTE';
      senderId: string;
      roomId: string;
      targetPeerId: string;
      emoteKey: LiveEmoteKey;
    }
  | {
      pktId: string;
      type: 'PVP_FORFEIT';
      senderId: string;
      roomId: string;
      targetPeerId: string;
      reason: 'LEAVE' | 'CONCEDE' | 'DISCONNECT';
    }
  | {
      pktId: string;
      type: 'PVP_PING';
      senderId: string;
      roomId: string;
      targetPeerId: string;
    };

export const PRESET_GUILDS: GuildInfo[] = [
  {
    id: 'guild_elwin_vanguard',
    name: '엘윈마을 수호단',
    tag: 'ELWIN',
    icon: '🛡️',
    descriptionKo: '초보·복귀 모험가 환영! 골드 지원 & 친선 덱 대결 활발 길드',
    descriptionEn: 'All adventurers welcome! Friendly deck duels & Gold support',
    createdAt: 1700000000000,
  },
  {
    id: 'guild_kadan_frost',
    name: '카단 눈보라 기사단',
    tag: 'FROST',
    icon: '❄️',
    descriptionKo: '스토리 40화·환생 공략 및 3배 각성 연구 길드',
    descriptionEn: 'Story 40-EP & 3x Awakening strategy knights',
    createdAt: 1700000001000,
  },
  {
    id: 'guild_silia_gale',
    name: '실리아 녹풍 결사대',
    tag: 'WIND',
    icon: '🌪️',
    descriptionKo: '속공·주문 시너지 연구 및 실시간 내전 즐기는 길드',
    descriptionEn: 'Tempo & spell combo specialists · Live scrims',
    createdAt: 1700000002000,
  },
  {
    id: 'guild_deepforge',
    name: '딥포지 황금공방',
    tag: 'FORGE',
    icon: '🔥',
    descriptionKo: '382장 올컬렉션 수집 & 랭킹·도박장 장인 길드',
    descriptionEn: '382-card collectors & high-stakes duelists',
    createdAt: 1700000003000,
  },
];

const STORAGE_KEYS = {
  NICKNAME: 'hero_hs_live_nickname',
  BASE_PEER_ID: 'hero_hs_live_peer_id',
  SESSION_PEER_ID: 'hero_hs_session_peer_id',
  GUILD: 'hero_hs_guild_state',
  CUSTOM_GUILDS: 'hero_hs_custom_guilds',
  GLOBAL_CHAT: 'hero_hs_global_chat_v2',
  GUILD_CHAT_PREFIX: 'hero_hs_guild_chat_v2_',
};

const MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

const TOPIC_PREFIX = 'snshero/live/v2';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveSessionPeerId(): string {
  if (typeof window === 'undefined') return 'u_ssr';
  try {
    const params = new URLSearchParams(window.location.search);
    const forcedPeer = params.get('peer');
    if (forcedPeer && /^[a-zA-Z0-9_-]{2,24}$/.test(forcedPeer)) {
      const id = `u_${forcedPeer}`;
      sessionStorage.setItem(STORAGE_KEYS.SESSION_PEER_ID, id);
      return id;
    }
    const existingSession = sessionStorage.getItem(STORAGE_KEYS.SESSION_PEER_ID);
    if (existingSession) return existingSession;

    let baseId = localStorage.getItem(STORAGE_KEYS.BASE_PEER_ID);
    if (!baseId) {
      baseId = `u_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(STORAGE_KEYS.BASE_PEER_ID, baseId);
    }

    // Track active tabs in localStorage heartbeat map so opening a 2nd tab on the same browser gets a unique tab peerId!
    const tabLockKey = 'hero_hs_active_tab_peers';
    let useId = baseId;
    try {
      const rawLocks = localStorage.getItem(tabLockKey);
      const locks: Record<string, number> = rawLocks ? JSON.parse(rawLocks) : {};
      const now = Date.now();
      for (const k of Object.keys(locks)) {
        if (now - locks[k] > 25_000) delete locks[k];
      }
      if (locks[baseId] && now - locks[baseId] < 25_000) {
        useId = `${baseId}_${Math.random().toString(36).slice(2, 5)}`;
      }
      locks[useId] = now;
      localStorage.setItem(tabLockKey, JSON.stringify(locks));
    } catch {
      // ignore
    }

    sessionStorage.setItem(STORAGE_KEYS.SESSION_PEER_ID, useId);
    return useId;
  } catch {
    return `u_${Math.random().toString(36).slice(2, 8)}`;
  }
}

function loadOrCreateNickname(peerId: string): string {
  if (typeof window === 'undefined') return 'Adventurer';
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.NICKNAME);
    if (saved && saved.trim()) {
      const baseId = localStorage.getItem(STORAGE_KEYS.BASE_PEER_ID);
      if (baseId && peerId !== baseId) {
        const suffix = peerId.slice(-3).toUpperCase();
        return `${saved.trim()}#${suffix}`;
      }
      return saved.trim();
    }
    const code = peerId.replace(/^u_/, '').slice(0, 4).toUpperCase();
    const generated = isKoreanLanguage() ? `모험가#${code}` : `Hero#${code}`;
    localStorage.setItem(STORAGE_KEYS.NICKNAME, generated);
    return generated;
  } catch {
    return 'Hero';
  }
}

export interface LiveNetworkSnapshot {
  peerId: string;
  nickname: string;
  transportState: 'CONNECTING' | 'LIVE_GLOBAL' | 'LIVE_LOCAL';
  onlinePeers: LivePeerPresence[];
  onlineCount: number;
  unreadCount: number;
  liveConversationCount: number;
  drawerOpen: boolean;
  currentGuild: GuildInfo | null;
  availableGuilds: GuildInfo[];
  globalMessages: LiveChatMessage[];
  guildMessages: LiveChatMessage[];
  openRooms: LiveDuelRoom[];
}

type MatchStartHandler = (params: {
  initialMatchState: BattleMatchState;
  livePvpMeta: LivePvpMeta;
}) => void;

type PvpStateSyncHandler = (roomId: string, guestState: BattleMatchState, seq: number) => void;
type PvpGuestActionHandler = (roomId: string, action: PvpGuestAction, seq: number) => void;
type PvpEmoteHandler = (roomId: string, emoteKey: LiveEmoteKey) => void;
type PvpOpponentLeftHandler = (
  roomId: string,
  peerId: string,
  reason: 'LEAVE' | 'CONCEDE' | 'DISCONNECT',
) => void;
type PvpPingHandler = (roomId: string, peerId: string) => void;
type GoldReceivedToastHandler = (info: {
  fromName: string;
  amount: number;
  note?: string;
  newGold: number;
}) => void;

class SnsheroLiveNetworkService {
  private initialized = false;
  private peerId = '';
  private nickname = '';
  private inBattle = false;
  private drawerOpen = false;
  private unreadCount = 0;
  private transportState: 'CONNECTING' | 'LIVE_GLOBAL' | 'LIVE_LOCAL' = 'CONNECTING';

  private seenPktIds = new Set<string>();
  private seenPktQueue: string[] = [];

  private peers = new Map<string, LivePeerPresence>();
  private globalMessages: LiveChatMessage[] = [];
  private guildMessagesMap = new Map<string, LiveChatMessage[]>();
  private currentGuild: GuildInfo | null = null;
  private customGuilds = new Map<string, GuildInfo>();
  private rooms = new Map<string, LiveDuelRoom>();
  private hostedRoomDecks = new Map<string, { deck: CustomDeck; stakeEscrowed: boolean }>();
  private activeRoomTopic: string | null = null;
  private pvpSeq = 1;

  private bc: BroadcastChannel | null = null;
  private mqttClient: MqttClient | null = null;
  private mqttBrokerIdx = 0;
  private trysteroSendFn: ((pkt: WirePacket) => void) | null = null;

  private listeners = new Set<() => void>();
  private matchStartHandlers = new Set<MatchStartHandler>();
  private pvpStateHandlers = new Set<PvpStateSyncHandler>();
  private pvpActionHandlers = new Set<PvpGuestActionHandler>();
  private pvpEmoteHandlers = new Set<PvpEmoteHandler>();
  private pvpOpponentLeftHandlers = new Set<PvpOpponentLeftHandler>();
  private pvpPingHandlers = new Set<PvpPingHandler>();
  private goldToastHandlers = new Set<GoldReceivedToastHandler>();
  private activeBattleInfo: { roomId: string; opponentPeerId: string } | null = null;

  private cachedSnapshot: LiveNetworkSnapshot | null = null;
  private heartbeatTimer: number | null = null;

  init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;
    hsStorage.ensureInitialized();

    this.peerId = resolveSessionPeerId();
    this.nickname = loadOrCreateNickname(this.peerId);
    this.loadLocalPersistedState();
    this.updateSelfPresence();

    // 1. Built-in W3C BroadcastChannel (0ms local multi-tab transport)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.bc = new BroadcastChannel('snshero_live_hub_v2');
        this.bc.onmessage = (ev) => {
          if (ev?.data && typeof ev.data === 'object') {
            this.handleIncomingPacket(ev.data as WirePacket);
          }
        };
        this.transportState = 'LIVE_LOCAL';
      } catch {
        // ignore
      }
    }

    // 2. Widely-used MQTT over WSS transport (Global NAT-proof real-time pub/sub)
    this.connectMqtt();

    // 3. Widely-used Trystero Serverless WebRTC P2P DataChannel transport
    this.connectTrysteroWebRtc();

    // Presence heartbeat + stale peer/room pruning
    this.broadcastPresence(true);
    this.heartbeatTimer = window.setInterval(() => {
      this.refreshTabLock();
      this.broadcastPresence(false);
      this.pruneStaleEntities();
    }, 10_000);

    const handleUnloadOrHide = () => {
      if (this.activeBattleInfo) {
        this.sendPvpForfeit(
          this.activeBattleInfo.roomId,
          this.activeBattleInfo.opponentPeerId,
          'LEAVE',
        );
      }
      this.sendPacket(
        {
          pktId: makeId('pkt'),
          type: 'PRESENCE_LEAVE',
          senderId: this.peerId,
        },
        `${TOPIC_PREFIX}/global`,
      );
    };
    window.addEventListener('beforeunload', handleUnloadOrHide);
    window.addEventListener('pagehide', handleUnloadOrHide);

    window.addEventListener('snshero:state-changed', () => {
      this.updateSelfPresence();
      this.emitChange();
    });

    this.emitChange();
  }

  private refreshTabLock() {
    try {
      const tabLockKey = 'hero_hs_active_tab_peers';
      const rawLocks = localStorage.getItem(tabLockKey);
      const locks: Record<string, number> = rawLocks ? JSON.parse(rawLocks) : {};
      const now = Date.now();
      for (const k of Object.keys(locks)) {
        if (now - locks[k] > 25_000) delete locks[k];
      }
      locks[this.peerId] = now;
      localStorage.setItem(tabLockKey, JSON.stringify(locks));
    } catch {
      // ignore
    }
  }

  private loadLocalPersistedState() {
    try {
      const rawGuild = localStorage.getItem(STORAGE_KEYS.GUILD);
      if (rawGuild) {
        const parsed = JSON.parse(rawGuild) as GuildInfo;
        if (parsed && parsed.id && parsed.name && parsed.tag) {
          this.currentGuild = parsed;
        }
      }
      const rawCustomGuilds = localStorage.getItem(STORAGE_KEYS.CUSTOM_GUILDS);
      if (rawCustomGuilds) {
        const list = JSON.parse(rawCustomGuilds) as GuildInfo[];
        if (Array.isArray(list)) {
          for (const g of list) {
            if (g && g.id) this.customGuilds.set(g.id, g);
          }
        }
      }
      const rawGlobal = localStorage.getItem(STORAGE_KEYS.GLOBAL_CHAT);
      if (rawGlobal) {
        const msgs = JSON.parse(rawGlobal) as LiveChatMessage[];
        if (Array.isArray(msgs)) {
          this.globalMessages = msgs.slice(-80);
        }
      }
      if (this.currentGuild) {
        this.loadGuildMessagesFromStorage(this.currentGuild.id);
      }
    } catch {
      // ignore
    }
  }

  private loadGuildMessagesFromStorage(guildId: string) {
    if (this.guildMessagesMap.has(guildId)) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GUILD_CHAT_PREFIX + guildId);
      if (raw) {
        const msgs = JSON.parse(raw) as LiveChatMessage[];
        if (Array.isArray(msgs)) {
          this.guildMessagesMap.set(guildId, msgs.slice(-80));
          return;
        }
      }
    } catch {
      // ignore
    }
    this.guildMessagesMap.set(guildId, []);
  }

  private saveGlobalMessages() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.GLOBAL_CHAT,
        JSON.stringify(this.globalMessages.slice(-80)),
      );
    } catch {
      // ignore
    }
  }

  private saveGuildMessages(guildId: string) {
    try {
      const list = this.guildMessagesMap.get(guildId) || [];
      localStorage.setItem(
        STORAGE_KEYS.GUILD_CHAT_PREFIX + guildId,
        JSON.stringify(list.slice(-80)),
      );
    } catch {
      // ignore
    }
  }

  private saveCustomGuilds() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.CUSTOM_GUILDS,
        JSON.stringify(Array.from(this.customGuilds.values()).slice(-30)),
      );
    } catch {
      // ignore
    }
  }

  private connectMqtt() {
    if (typeof WebSocket === 'undefined') return;
    const brokerUrl = MQTT_BROKERS[this.mqttBrokerIdx % MQTT_BROKERS.length];
    try {
      const client = mqtt.connect(brokerUrl, {
        clientId: `snshero_${this.peerId}_${Math.random().toString(36).slice(2, 6)}`,
        clean: true,
        connectTimeout: 6500,
        reconnectPeriod: 4500,
        keepalive: 30,
      });
      this.mqttClient = client;

      client.on('connect', () => {
        this.transportState = 'LIVE_GLOBAL';
        const topics = [
          `${TOPIC_PREFIX}/global`,
          `${TOPIC_PREFIX}/direct/${this.peerId}`,
        ];
        if (this.currentGuild) {
          topics.push(`${TOPIC_PREFIX}/guild/${this.currentGuild.id}`);
        }
        if (this.activeRoomTopic) {
          topics.push(this.activeRoomTopic);
        }
        client.subscribe(topics, { qos: 0 }, () => {
          this.broadcastPresence(true);
        });
        this.emitChange();
      });

      client.on('message', (_topic, payload) => {
        try {
          const text = payload.toString('utf8');
          const pkt = JSON.parse(text) as WirePacket;
          if (pkt && pkt.pktId) {
            this.handleIncomingPacket(pkt);
          }
        } catch {
          // ignore malformed packet
        }
      });

      client.on('error', () => {
        // Fail over to secondary public WSS MQTT broker if initial connect fails
        if (this.transportState !== 'LIVE_GLOBAL' && this.mqttBrokerIdx === 0) {
          this.mqttBrokerIdx = 1;
          try {
            client.end(true);
          } catch {
            // ignore
          }
          this.connectMqtt();
        }
      });
    } catch {
      // Fallback to BroadcastChannel + Trystero WebRTC
    }
  }

  private connectTrysteroWebRtc() {
    if (typeof RTCPeerConnection === 'undefined') return;
    import('trystero')
      .then(({ joinRoom }) => {
        const room = joinRoom(
          {
            appId: 'snshero.com/live-hub-v2',
            identity: 'none',
          },
          'elwin-global',
        );
        const wire = room.makeAction<any>('pkt');
        this.trysteroSendFn = (pkt: WirePacket) => {
          wire.send(pkt as any).catch(() => {});
        };
        wire.onMessage((data) => {
          if (data && typeof data === 'object' && 'pktId' in data) {
            if (this.transportState === 'CONNECTING') {
              this.transportState = 'LIVE_GLOBAL';
            }
            this.handleIncomingPacket(data as WirePacket);
          }
        });
        room.onUserJoin(() => {
          this.transportState = 'LIVE_GLOBAL';
          this.broadcastPresence(true);
          this.sendHistorySnapshot();
        });
      })
      .catch(() => {
        // WebRTC relay unavailable in restricted env; MQTT + BroadcastChannel continue seamlessly
      });
  }

  private markSeen(pktId: string): boolean {
    if (this.seenPktIds.has(pktId)) return false;
    this.seenPktIds.add(pktId);
    this.seenPktQueue.push(pktId);
    if (this.seenPktQueue.length > 2500) {
      const oldest = this.seenPktQueue.shift();
      if (oldest) this.seenPktIds.delete(oldest);
    }
    return true;
  }

  private sendPacket(pkt: WirePacket, mqttTopic: string) {
    this.markSeen(pkt.pktId);
    // 1. BroadcastChannel
    try {
      this.bc?.postMessage(pkt);
    } catch {
      // ignore
    }
    // 2. MQTT WSS
    try {
      if (this.mqttClient && this.mqttClient.connected) {
        this.mqttClient.publish(mqttTopic, JSON.stringify(pkt), { qos: 0 });
      }
    } catch {
      // ignore
    }
    // 3. Trystero WebRTC P2P
    try {
      this.trysteroSendFn?.(pkt);
    } catch {
      // ignore
    }
  }

  private buildSelfPresence(): LivePeerPresence {
    const prof = hsStorage.getProfile();
    const prest = getEquippedPrestigeSummary(prof, isKoreanLanguage());
    return {
      peerId: this.peerId,
      nickname: this.nickname,
      badgeIcon: prest.badgeIcon || '🧭',
      titleText: prest.titleText || '모험가',
      rank: prof.rank ?? 25,
      guildId: this.currentGuild?.id,
      guildTag: this.currentGuild?.tag,
      guildName: this.currentGuild?.name,
      inBattle: this.inBattle,
      lastSeenAt: Date.now(),
    };
  }

  private updateSelfPresence() {
    if (!this.peerId) return;
    this.peers.set(this.peerId, this.buildSelfPresence());
  }

  private broadcastPresence(requestReply = false) {
    if (!this.peerId) return;
    const presence = this.buildSelfPresence();
    this.peers.set(this.peerId, presence);
    this.sendPacket(
      {
        pktId: makeId('pres'),
        type: 'PRESENCE_PING',
        senderId: this.peerId,
        presence,
        requestReply,
      },
      `${TOPIC_PREFIX}/global`,
    );
    this.emitChange();
  }

  private sendHistorySnapshot(targetPeerId?: string) {
    const openRooms = Array.from(this.rooms.values()).filter((r) => r.status === 'WAITING');
    const guilds = Array.from(this.customGuilds.values());
    if (this.globalMessages.length === 0 && openRooms.length === 0 && guilds.length === 0) {
      return;
    }
    this.sendPacket(
      {
        pktId: makeId('sync'),
        type: 'HISTORY_SYNC',
        senderId: this.peerId,
        targetPeerId,
        globalMessages: this.globalMessages.slice(-25),
        guilds: guilds.slice(-15),
        openRooms,
      },
      targetPeerId ? `${TOPIC_PREFIX}/direct/${targetPeerId}` : `${TOPIC_PREFIX}/global`,
    );
  }

  private pruneStaleEntities() {
    const now = Date.now();
    let changed = false;
    for (const [id, p] of this.peers.entries()) {
      if (id === this.peerId) {
        p.lastSeenAt = now;
        continue;
      }
      if (now - p.lastSeenAt > 32_000) {
        this.peers.delete(id);
        changed = true;
      }
    }
    for (const [roomId, r] of this.rooms.entries()) {
      if (r.status === 'CLOSED' || now - r.updatedAt > 15 * 60_000) {
        if (r.hostPeerId === this.peerId && r.status === 'WAITING') {
          r.updatedAt = now;
          continue;
        }
        this.rooms.delete(roomId);
        changed = true;
      }
    }
    if (changed) this.emitChange();
  }

  private appendChatMessage(msg: LiveChatMessage, isIncomingRemote: boolean) {
    if (msg.scope === 'GLOBAL') {
      if (this.globalMessages.some((m) => m.id === msg.id)) return;
      this.globalMessages = [...this.globalMessages, msg]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-80);
      this.saveGlobalMessages();
      if (isIncomingRemote && !this.drawerOpen) {
        this.unreadCount += 1;
      }
      this.emitChange();
      return;
    }

    if (msg.scope === 'GUILD' && msg.guildId) {
      this.loadGuildMessagesFromStorage(msg.guildId);
      const list = this.guildMessagesMap.get(msg.guildId) || [];
      if (list.some((m) => m.id === msg.id)) return;
      const next = [...list, msg]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-80);
      this.guildMessagesMap.set(msg.guildId, next);
      this.saveGuildMessages(msg.guildId);
      if (isIncomingRemote && !this.drawerOpen && this.currentGuild?.id === msg.guildId) {
        this.unreadCount += 1;
      }
      this.emitChange();
    }
  }

  private handleIncomingPacket(pkt: WirePacket) {
    if (!pkt || !pkt.pktId) return;
    if (!this.markSeen(pkt.pktId)) return;
    if (pkt.senderId === this.peerId) return;

    switch (pkt.type) {
      case 'PRESENCE_PING': {
        this.peers.set(pkt.presence.peerId, {
          ...pkt.presence,
          lastSeenAt: Date.now(),
        });
        if (pkt.requestReply) {
          this.broadcastPresence(false);
          this.sendHistorySnapshot(pkt.presence.peerId);
        } else {
          this.emitChange();
        }
        break;
      }

      case 'PRESENCE_LEAVE': {
        this.peers.delete(pkt.senderId);
        for (const [roomId, room] of this.rooms.entries()) {
          if (room.hostPeerId === pkt.senderId && room.status === 'WAITING') {
            this.rooms.delete(roomId);
          }
        }
        if (
          this.activeBattleInfo &&
          this.activeBattleInfo.opponentPeerId === pkt.senderId
        ) {
          const { roomId } = this.activeBattleInfo;
          for (const cb of this.pvpOpponentLeftHandlers) {
            cb(roomId, pkt.senderId, 'LEAVE');
          }
        }
        this.emitChange();
        break;
      }

      case 'CHAT_MESSAGE': {
        if (
          pkt.message.scope === 'GUILD' &&
          pkt.message.guildId &&
          pkt.message.guildId !== this.currentGuild?.id
        ) {
          return;
        }
        this.appendChatMessage(pkt.message, true);
        break;
      }

      case 'HISTORY_SYNC': {
        if (pkt.targetPeerId && pkt.targetPeerId !== this.peerId) return;
        let dirty = false;
        for (const g of pkt.guilds || []) {
          if (g && g.id && !PRESET_GUILDS.some((pg) => pg.id === g.id) && !this.customGuilds.has(g.id)) {
            this.customGuilds.set(g.id, g);
            dirty = true;
          }
        }
        if (dirty) this.saveCustomGuilds();

        for (const r of pkt.openRooms || []) {
          if (r && r.roomId && r.status === 'WAITING' && !this.rooms.has(r.roomId)) {
            this.rooms.set(r.roomId, r);
            dirty = true;
          }
        }

        let msgAdded = false;
        for (const m of pkt.globalMessages || []) {
          if (m && m.id && !this.globalMessages.some((ex) => ex.id === m.id)) {
            this.globalMessages.push(m);
            msgAdded = true;
          }
        }
        if (msgAdded) {
          this.globalMessages = this.globalMessages
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-80);
          this.saveGlobalMessages();
          dirty = true;
        }
        if (dirty) this.emitChange();
        break;
      }

      case 'GUILD_ANNOUNCE': {
        if (pkt.guild && pkt.guild.id) {
          this.customGuilds.set(pkt.guild.id, pkt.guild);
          this.saveCustomGuilds();
          this.emitChange();
        }
        break;
      }

      case 'GOLD_TRANSFER': {
        if (pkt.toId === this.peerId) {
          const res = hsStorage.claimReceivedGoldGift(
            pkt.transferId,
            pkt.amount,
            pkt.fromId,
            pkt.fromName,
            pkt.note,
          );
          if (res.claimed) {
            for (const cb of this.goldToastHandlers) {
              cb({
                fromName: pkt.fromName,
                amount: res.amount,
                note: pkt.note,
                newGold: res.newGold,
              });
            }
            if (!this.drawerOpen) {
              this.unreadCount += 1;
            }
            this.sendPacket(
              {
                pktId: makeId('gack'),
                type: 'GOLD_TRANSFER_ACK',
                senderId: this.peerId,
                transferId: pkt.transferId,
                toId: this.peerId,
                toName: this.nickname,
                fromId: pkt.fromId,
                amount: res.amount,
              },
              `${TOPIC_PREFIX}/direct/${pkt.fromId}`,
            );
            this.emitChange();
          }
        }
        break;
      }

      case 'GOLD_TRANSFER_ACK': {
        // Recipient confirmed claim
        break;
      }

      case 'DUEL_ROOM_UPSERT': {
        if (pkt.room.scope === 'GUILD' && pkt.room.guildId !== this.currentGuild?.id) {
          return;
        }
        if (pkt.room.status === 'CLOSED') {
          this.rooms.delete(pkt.room.roomId);
        } else {
          this.rooms.set(pkt.room.roomId, pkt.room);
        }
        this.emitChange();
        break;
      }

      case 'DUEL_JOIN_REQUEST': {
        if (pkt.hostPeerId !== this.peerId) return;
        this.handleGuestJoinDuelRoom(pkt);
        break;
      }

      case 'PVP_MATCH_START': {
        if (pkt.guestPeerId !== this.peerId) return;
        const escrowed = hsStorage.escrowPvpStake(pkt.roomId, pkt.stakeGold);
        if (!escrowed) return;
        this.subscribeRoomTopic(pkt.roomId);
        const liveMeta = pkt.guestInitialState.livePvpMeta!;
        for (const cb of this.matchStartHandlers) {
          cb({
            initialMatchState: pkt.guestInitialState,
            livePvpMeta: liveMeta,
          });
        }
        break;
      }

      case 'PVP_STATE_SYNC': {
        if (pkt.targetGuestId !== this.peerId) return;
        for (const cb of this.pvpPingHandlers) {
          cb(pkt.roomId, pkt.senderId);
        }
        for (const cb of this.pvpStateHandlers) {
          cb(pkt.roomId, pkt.guestState, pkt.seq);
        }
        break;
      }

      case 'PVP_GUEST_ACTION': {
        if (pkt.targetHostId !== this.peerId) return;
        for (const cb of this.pvpPingHandlers) {
          cb(pkt.roomId, pkt.senderId);
        }
        for (const cb of this.pvpActionHandlers) {
          cb(pkt.roomId, pkt.action, pkt.seq);
        }
        break;
      }

      case 'PVP_EMOTE': {
        if (pkt.targetPeerId !== this.peerId) return;
        for (const cb of this.pvpPingHandlers) {
          cb(pkt.roomId, pkt.senderId);
        }
        for (const cb of this.pvpEmoteHandlers) {
          cb(pkt.roomId, pkt.emoteKey);
        }
        break;
      }

      case 'PVP_FORFEIT': {
        if (
          pkt.targetPeerId !== this.peerId &&
          this.activeBattleInfo?.roomId !== pkt.roomId
        ) {
          return;
        }
        if (pkt.senderId === this.peerId) return;
        for (const cb of this.pvpOpponentLeftHandlers) {
          cb(pkt.roomId, pkt.senderId, pkt.reason);
        }
        break;
      }

      case 'PVP_PING': {
        if (pkt.targetPeerId !== this.peerId || pkt.senderId === this.peerId) return;
        for (const cb of this.pvpPingHandlers) {
          cb(pkt.roomId, pkt.senderId);
        }
        break;
      }
    }
  }

  private subscribeRoomTopic(roomId: string) {
    const topic = `${TOPIC_PREFIX}/room/${roomId}`;
    if (this.activeRoomTopic === topic) return;
    if (this.activeRoomTopic && this.mqttClient?.connected) {
      this.mqttClient.unsubscribe(this.activeRoomTopic);
    }
    this.activeRoomTopic = topic;
    if (this.mqttClient?.connected) {
      this.mqttClient.subscribe(topic, { qos: 0 });
    }
  }

  // ==================== PUBLIC API ====================

  subscribe = (listener: () => void): (() => void) => {
    this.init();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  onMatchStart(cb: MatchStartHandler): () => void {
    this.init();
    this.matchStartHandlers.add(cb);
    return () => {
      this.matchStartHandlers.delete(cb);
    };
  }

  onPvpStateSync(cb: PvpStateSyncHandler): () => void {
    this.init();
    this.pvpStateHandlers.add(cb);
    return () => {
      this.pvpStateHandlers.delete(cb);
    };
  }

  onPvpGuestAction(cb: PvpGuestActionHandler): () => void {
    this.init();
    this.pvpActionHandlers.add(cb);
    return () => {
      this.pvpActionHandlers.delete(cb);
    };
  }

  onPvpEmote(cb: PvpEmoteHandler): () => void {
    this.init();
    this.pvpEmoteHandlers.add(cb);
    return () => {
      this.pvpEmoteHandlers.delete(cb);
    };
  }

  onPvpOpponentLeft(cb: PvpOpponentLeftHandler): () => void {
    this.init();
    this.pvpOpponentLeftHandlers.add(cb);
    return () => {
      this.pvpOpponentLeftHandlers.delete(cb);
    };
  }

  onPvpPing(cb: PvpPingHandler): () => void {
    this.init();
    this.pvpPingHandlers.add(cb);
    return () => {
      this.pvpPingHandlers.delete(cb);
    };
  }

  setActiveBattleRoom(roomId: string | null, opponentPeerId: string | null) {
    this.init();
    if (roomId && opponentPeerId) {
      this.activeBattleInfo = { roomId, opponentPeerId };
      this.setInBattle(true);
    } else {
      this.activeBattleInfo = null;
      this.setInBattle(false);
    }
  }

  onGoldReceived(cb: GoldReceivedToastHandler): () => void {
    this.init();
    this.goldToastHandlers.add(cb);
    return () => {
      this.goldToastHandlers.delete(cb);
    };
  }

  private emitChange() {
    this.cachedSnapshot = null;
    for (const fn of this.listeners) {
      fn();
    }
  }

  getSnapshot = (): LiveNetworkSnapshot => {
    this.init();
    if (this.cachedSnapshot) return this.cachedSnapshot;

    const onlinePeers = Array.from(this.peers.values()).sort((a, b) => {
      if (a.peerId === this.peerId) return -1;
      if (b.peerId === this.peerId) return 1;
      return b.lastSeenAt - a.lastSeenAt;
    });
    const availableGuilds = [
      ...PRESET_GUILDS,
      ...Array.from(this.customGuilds.values()).filter(
        (cg) => !PRESET_GUILDS.some((pg) => pg.id === cg.id),
      ),
    ];
    const guildMessages = this.currentGuild
      ? this.guildMessagesMap.get(this.currentGuild.id) || []
      : [];
    const openRooms = Array.from(this.rooms.values())
      .filter(
        (r) =>
          r.status !== 'CLOSED' &&
          (r.scope === 'GLOBAL' || r.guildId === this.currentGuild?.id),
      )
      .sort((a, b) => b.createdAt - a.createdAt);

    // Live active conversation metric: active online peers + recent live conversation activity
    const recentCutoff = Date.now() - 30 * 60_000;
    const recentMsgs = this.globalMessages.filter((m) => m.timestamp >= recentCutoff).length;
    const liveConversationCount = Math.max(onlinePeers.length, recentMsgs > 0 ? recentMsgs : onlinePeers.length);

    this.cachedSnapshot = {
      peerId: this.peerId,
      nickname: this.nickname,
      transportState: this.transportState,
      onlinePeers,
      onlineCount: Math.max(1, onlinePeers.length),
      unreadCount: this.unreadCount,
      liveConversationCount,
      drawerOpen: this.drawerOpen,
      currentGuild: this.currentGuild,
      availableGuilds,
      globalMessages: this.globalMessages,
      guildMessages,
      openRooms,
    };
    return this.cachedSnapshot;
  };

  setDrawerOpen(open: boolean) {
    this.init();
    this.drawerOpen = open;
    if (open) {
      this.unreadCount = 0;
    }
    this.emitChange();
  }

  setInBattle(inBattle: boolean) {
    this.init();
    if (this.inBattle === inBattle) return;
    this.inBattle = inBattle;
    this.broadcastPresence(false);
  }

  updateNickname(newName: string) {
    this.init();
    const cleaned = newName.trim().slice(0, 18);
    if (!cleaned) return;
    this.nickname = cleaned;
    try {
      localStorage.setItem(STORAGE_KEYS.NICKNAME, cleaned);
    } catch {
      // ignore
    }
    this.broadcastPresence(false);
  }

  // ==================== CHAT ====================

  sendChatMessage(text: string, scope: LiveChatScope = 'GLOBAL'): boolean {
    this.init();
    const cleaned = text.trim().slice(0, 280);
    if (!cleaned) return false;
    if (scope === 'GUILD' && !this.currentGuild) return false;

    const self = this.buildSelfPresence();
    const msg: LiveChatMessage = {
      id: makeId('msg'),
      scope,
      guildId: scope === 'GUILD' ? this.currentGuild?.id : undefined,
      kind: 'TEXT',
      senderId: this.peerId,
      senderName: this.nickname,
      senderBadge: self.badgeIcon,
      senderRank: self.rank,
      guildTag: this.currentGuild?.tag,
      text: cleaned,
      timestamp: Date.now(),
    };

    this.appendChatMessage(msg, false);
    const topic =
      scope === 'GUILD' && this.currentGuild
        ? `${TOPIC_PREFIX}/guild/${this.currentGuild.id}`
        : `${TOPIC_PREFIX}/global`;

    this.sendPacket(
      {
        pktId: makeId('chat'),
        type: 'CHAT_MESSAGE',
        senderId: this.peerId,
        message: msg,
      },
      topic,
    );
    return true;
  }

  // ==================== GUILDS ====================

  joinGuild(guild: GuildInfo) {
    this.init();
    if (this.currentGuild && this.mqttClient?.connected) {
      this.mqttClient.unsubscribe(`${TOPIC_PREFIX}/guild/${this.currentGuild.id}`);
    }
    this.currentGuild = guild;
    try {
      localStorage.setItem(STORAGE_KEYS.GUILD, JSON.stringify(guild));
    } catch {
      // ignore
    }
    if (!PRESET_GUILDS.some((pg) => pg.id === guild.id)) {
      this.customGuilds.set(guild.id, guild);
      this.saveCustomGuilds();
    }
    this.loadGuildMessagesFromStorage(guild.id);
    if (this.mqttClient?.connected) {
      this.mqttClient.subscribe(`${TOPIC_PREFIX}/guild/${guild.id}`, { qos: 0 });
    }
    this.broadcastPresence(false);

    // Announce join to guild chat
    const joinMsg: LiveChatMessage = {
      id: makeId('gjoin'),
      scope: 'GUILD',
      guildId: guild.id,
      kind: 'SYSTEM',
      senderId: this.peerId,
      senderName: this.nickname,
      senderBadge: '🛡️',
      senderRank: hsStorage.getProfile().rank ?? 25,
      guildTag: guild.tag,
      text: tr(
        `🎉 ${this.nickname}님이 [${guild.tag}] ${guild.name} 길드에 합류했습니다!`,
        `🎉 ${this.nickname} joined [${guild.tag}] ${guild.name}!`,
      ),
      timestamp: Date.now(),
    };
    this.appendChatMessage(joinMsg, false);
    this.sendPacket(
      {
        pktId: makeId('gmsg'),
        type: 'CHAT_MESSAGE',
        senderId: this.peerId,
        message: joinMsg,
      },
      `${TOPIC_PREFIX}/guild/${guild.id}`,
    );
  }

  createGuild(opts: {
    name: string;
    tag: string;
    icon: string;
    description: string;
  }): { ok: boolean; guild?: GuildInfo; error?: string } {
    this.init();
    const cleanName = opts.name.trim().slice(0, 22);
    const cleanTag = opts.tag
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9가-힣]/g, '')
      .slice(0, 5);
    if (cleanName.length < 2) {
      return {
        ok: false,
        error: tr('길드 이름을 2자 이상 입력해 주세요.', 'Enter a guild name (2+ chars).'),
      };
    }
    if (cleanTag.length < 2) {
      return {
        ok: false,
        error: tr('길드 태그를 2~5자로 입력해 주세요.', 'Enter a 2–5 char guild tag.'),
      };
    }
    const desc =
      opts.description.trim().slice(0, 60) ||
      tr(`${cleanName} 길드원 모집 중!`, `Welcome to ${cleanName}!`);
    const guild: GuildInfo = {
      id: `guild_custom_${cleanTag.toLowerCase()}_${Date.now().toString(36).slice(-4)}`,
      name: cleanName,
      tag: cleanTag,
      icon: opts.icon || '🛡️',
      descriptionKo: desc,
      descriptionEn: desc,
      createdBy: this.nickname,
      createdAt: Date.now(),
    };

    this.customGuilds.set(guild.id, guild);
    this.saveCustomGuilds();
    this.sendPacket(
      {
        pktId: makeId('gnew'),
        type: 'GUILD_ANNOUNCE',
        senderId: this.peerId,
        guild,
      },
      `${TOPIC_PREFIX}/global`,
    );
    this.joinGuild(guild);
    return { ok: true, guild };
  }

  joinGuildByCodeOrTag(codeOrTag: string): { ok: boolean; guild?: GuildInfo; error?: string } {
    this.init();
    const q = codeOrTag.trim().toLowerCase();
    if (!q) {
      return {
        ok: false,
        error: tr('길드 코드 또는 태그를 입력해 주세요.', 'Enter a guild code or tag.'),
      };
    }
    const all = [
      ...PRESET_GUILDS,
      ...Array.from(this.customGuilds.values()),
    ];
    const matched = all.find(
      (g) =>
        g.id.toLowerCase() === q ||
        g.tag.toLowerCase() === q ||
        g.name.toLowerCase() === q,
    );
    if (matched) {
      this.joinGuild(matched);
      return { ok: true, guild: matched };
    }
    // Allow joining a shared room-code guild directly by tag/code so two friends typing the same code always land in the exact same guild room!
    const cleanCode = codeOrTag
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9가-힣_-]/g, '')
      .slice(0, 12);
    if (cleanCode.length < 2) {
      return {
        ok: false,
        error: tr('유효한 길드 코드가 아닙니다.', 'Invalid guild code.'),
      };
    }
    const sharedGuild: GuildInfo = {
      id: `guild_code_${cleanCode.toLowerCase()}`,
      name: `${cleanCode} 길드`,
      tag: cleanCode.slice(0, 5),
      icon: '⚔️',
      descriptionKo: `초대코드 [${cleanCode}] 전용 길드 채널`,
      descriptionEn: `Invite Code [${cleanCode}] Guild Channel`,
      createdAt: Date.now(),
    };
    this.joinGuild(sharedGuild);
    return { ok: true, guild: sharedGuild };
  }

  leaveGuild() {
    this.init();
    if (!this.currentGuild) return;
    if (this.mqttClient?.connected) {
      this.mqttClient.unsubscribe(`${TOPIC_PREFIX}/guild/${this.currentGuild.id}`);
    }
    this.currentGuild = null;
    try {
      localStorage.removeItem(STORAGE_KEYS.GUILD);
    } catch {
      // ignore
    }
    this.broadcastPresence(false);
  }

  // ==================== PEER-TO-PEER GOLD GIFTING ====================

  sendGoldGift(opts: {
    toPeerId: string;
    toName: string;
    amount: number;
    note?: string;
    scope?: LiveChatScope;
  }): { ok: boolean; error?: string; remainingGold?: number } {
    this.init();
    if (!opts.toPeerId || opts.toPeerId === this.peerId) {
      return {
        ok: false,
        error: tr('본인에게는 골드를 선물할 수 없습니다.', 'You cannot send Gold to yourself.'),
      };
    }

    const res = hsStorage.sendGoldGiftToPlayer(
      opts.amount,
      opts.toPeerId,
      opts.toName,
      opts.note,
    );
    if (!res.ok) {
      return {
        ok: false,
        error: isKoreanLanguage() ? res.errorKo : res.errorEn,
      };
    }

    const self = this.buildSelfPresence();
    const scope: LiveChatScope =
      opts.scope === 'GUILD' && this.currentGuild ? 'GUILD' : 'GLOBAL';

    this.sendPacket(
      {
        pktId: makeId('gold'),
        type: 'GOLD_TRANSFER',
        senderId: this.peerId,
        transferId: res.transferId,
        fromId: this.peerId,
        fromName: this.nickname,
        fromBadge: self.badgeIcon,
        toId: opts.toPeerId,
        toName: opts.toName,
        amount: res.amount,
        note: opts.note?.trim().slice(0, 80),
        scope,
        guildId: scope === 'GUILD' ? this.currentGuild?.id : undefined,
        timestamp: Date.now(),
      },
      `${TOPIC_PREFIX}/direct/${opts.toPeerId}`,
    );

    const giftNotice: LiveChatMessage = {
      id: makeId('gnotice'),
      scope,
      guildId: scope === 'GUILD' ? this.currentGuild?.id : undefined,
      kind: 'GOLD_GIFT',
      senderId: this.peerId,
      senderName: this.nickname,
      senderBadge: self.badgeIcon,
      senderRank: self.rank,
      guildTag: this.currentGuild?.tag,
      text: opts.note?.trim()
        ? tr(
            `🪙 ${this.nickname}님이 ${opts.toName}님에게 ${res.amount.toLocaleString()}G를 선물했습니다! (“${opts.note.trim()}”)`,
            `🪙 ${this.nickname} sent ${res.amount.toLocaleString()}G to ${opts.toName}! (“${opts.note.trim()}”)`,
          )
        : tr(
            `🪙 ${this.nickname}님이 ${opts.toName}님에게 ${res.amount.toLocaleString()}G를 선물했습니다!`,
            `🪙 ${this.nickname} sent ${res.amount.toLocaleString()}G to ${opts.toName}!`,
          ),
      timestamp: Date.now(),
      goldGift: {
        transferId: res.transferId,
        toPeerId: opts.toPeerId,
        toName: opts.toName,
        amount: res.amount,
        note: opts.note?.trim(),
      },
    };
    this.appendChatMessage(giftNotice, false);
    this.sendPacket(
      {
        pktId: makeId('gchat'),
        type: 'CHAT_MESSAGE',
        senderId: this.peerId,
        message: giftNotice,
      },
      scope === 'GUILD' && this.currentGuild
        ? `${TOPIC_PREFIX}/guild/${this.currentGuild.id}`
        : `${TOPIC_PREFIX}/global`,
    );

    return { ok: true, remainingGold: res.remainingGold };
  }

  // ==================== LIVE 1v1 CARD DECK DUEL ROOMS ====================

  findMatchingRankedRoom(stakeGold: number): LiveDuelRoom | null {
    this.init();
    const stake = Math.max(0, Math.min(1000, Math.floor(Number(stakeGold) || 0)));
    const candidates = Array.from(this.rooms.values())
      .filter(
        (r) =>
          r.status === 'WAITING' &&
          r.isRankedMatchmaking === true &&
          r.hostPeerId !== this.peerId &&
          r.stakeGold === stake,
      )
      .sort((a, b) => a.createdAt - b.createdAt);
    return candidates[0] || null;
  }

  createDuelRoom(opts: {
    title?: string;
    deck: CustomDeck;
    stakeGold?: number;
    scope?: LiveChatScope;
    targetPeerId?: string;
    targetPeerName?: string;
    isRankedMatchmaking?: boolean;
  }): { ok: boolean; room?: LiveDuelRoom; error?: string } {
    this.init();
    if (!opts.deck || opts.deck.cards.length < 30) {
      return {
        ok: false,
        error: tr('30장이 완성된 카드덱을 선택해 주세요.', 'Please choose a complete 30-card deck.'),
      };
    }
    const stake = Math.max(0, Math.min(1000, Math.floor(Number(opts.stakeGold) || 0)));
    const prof = hsStorage.getProfile();
    if (prof.gold < stake) {
      return {
        ok: false,
        error: tr(`판돈 골드가 부족합니다 (보유 ${prof.gold}G).`, `Not enough Gold for wager (${prof.gold}G).`),
      };
    }

    // Cancel any previous waiting room hosted by this player
    for (const [oldId, oldRoom] of this.rooms.entries()) {
      if (oldRoom.hostPeerId === this.peerId && oldRoom.status === 'WAITING') {
        this.cancelDuelRoom(oldId);
      }
    }

    const roomId = makeId('room');
    if (stake > 0) {
      const ok = hsStorage.escrowPvpStake(roomId, stake);
      if (!ok) {
        return {
          ok: false,
          error: tr('골드 예치에 실패했습니다.', 'Failed to escrow Gold wager.'),
        };
      }
    }

    const self = this.buildSelfPresence();
    const scope: LiveChatScope =
      opts.scope === 'GUILD' && this.currentGuild ? 'GUILD' : 'GLOBAL';
    const defaultTitle = opts.isRankedMatchmaking
      ? tr(
          `🏆 [실시간 랭킹] ${this.nickname} 대전 매칭`,
          `🏆 [Live Ranked] ${this.nickname} Matchmaking`,
        )
      : opts.targetPeerName
        ? tr(`${opts.targetPeerName}님 1:1 덱 결투장!`, `1v1 Deck Duel vs ${opts.targetPeerName}!`)
        : tr(`${this.nickname}의 30장 카드덱 진검승부!`, `${this.nickname}'s 30-Card Deck Duel!`);

    const room: LiveDuelRoom = {
      roomId,
      title: opts.title?.trim().slice(0, 36) || defaultTitle,
      hostPeerId: this.peerId,
      hostName: this.nickname,
      hostBadge: self.badgeIcon,
      hostRank: self.rank,
      hostDeckId: opts.deck.id,
      hostDeckName: opts.deck.name,
      hostHeroClass: opts.deck.heroClass,
      stakeGold: stake,
      scope,
      guildId: scope === 'GUILD' ? this.currentGuild?.id : undefined,
      guildTag: this.currentGuild?.tag,
      targetPeerId: opts.targetPeerId,
      targetPeerName: opts.targetPeerName,
      isRankedMatchmaking: Boolean(opts.isRankedMatchmaking),
      status: 'WAITING',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.rooms.set(roomId, room);
    this.hostedRoomDecks.set(roomId, {
      deck: { ...opts.deck, cards: [...opts.deck.cards.slice(0, 30)] },
      stakeEscrowed: stake > 0,
    });
    this.subscribeRoomTopic(roomId);

    const topic =
      scope === 'GUILD' && this.currentGuild
        ? `${TOPIC_PREFIX}/guild/${this.currentGuild.id}`
        : `${TOPIC_PREFIX}/global`;

    this.sendPacket(
      {
        pktId: makeId('rmup'),
        type: 'DUEL_ROOM_UPSERT',
        senderId: this.peerId,
        room,
      },
      topic,
    );

    const inviteMsg: LiveChatMessage = {
      id: makeId('rminv'),
      scope,
      guildId: scope === 'GUILD' ? this.currentGuild?.id : undefined,
      kind: 'DUEL_ROOM',
      senderId: this.peerId,
      senderName: this.nickname,
      senderBadge: self.badgeIcon,
      senderRank: self.rank,
      guildTag: this.currentGuild?.tag,
      text:
        stake > 0
          ? tr(
              `⚔ [${room.title}] 대전방 개설! (판돈 ${stake}G · 내 30장 카드덱으로 참전하세요!)`,
              `⚔ Duel Room [${room.title}] Open! (${stake}G Wager · Join with your 30-card deck!)`,
            )
          : tr(
              `⚔ [${room.title}] 친선 대전방 개설! (내 30장 카드덱으로 대결하세요!)`,
              `⚔ Friendly Duel Room [${room.title}] Open! (Battle with your 30-card deck!)`,
            ),
      timestamp: Date.now(),
      duelRoom: {
        roomId,
        title: room.title,
        hostPeerId: this.peerId,
        hostName: this.nickname,
        hostHeroClass: room.hostHeroClass,
        hostDeckName: room.hostDeckName,
        stakeGold: stake,
        targetPeerId: opts.targetPeerId,
        targetPeerName: opts.targetPeerName,
      },
    };
    this.appendChatMessage(inviteMsg, false);
    this.sendPacket(
      {
        pktId: makeId('rmchat'),
        type: 'CHAT_MESSAGE',
        senderId: this.peerId,
        message: inviteMsg,
      },
      topic,
    );

    this.emitChange();
    return { ok: true, room };
  }

  cancelDuelRoom(roomId: string) {
    this.init();
    const room = this.rooms.get(roomId);
    if (!room || room.hostPeerId !== this.peerId) return;
    if (room.status === 'WAITING' && room.stakeGold > 0) {
      hsStorage.refundPvpStake(roomId);
    }
    this.hostedRoomDecks.delete(roomId);
    const closedRoom: LiveDuelRoom = {
      ...room,
      status: 'CLOSED',
      updatedAt: Date.now(),
    };
    this.rooms.delete(roomId);
    const topic =
      room.scope === 'GUILD' && room.guildId
        ? `${TOPIC_PREFIX}/guild/${room.guildId}`
        : `${TOPIC_PREFIX}/global`;
    this.sendPacket(
      {
        pktId: makeId('rmclose'),
        type: 'DUEL_ROOM_UPSERT',
        senderId: this.peerId,
        room: closedRoom,
      },
      topic,
    );
    this.emitChange();
  }

  joinDuelRoom(room: LiveDuelRoom, guestDeck: CustomDeck): { ok: boolean; error?: string } {
    this.init();
    if (!room || room.status !== 'WAITING') {
      return {
        ok: false,
        error: tr('이미 시작되었거나 종료된 대전방입니다.', 'This Duel Room is already full or closed.'),
      };
    }
    if (room.hostPeerId === this.peerId) {
      return {
        ok: false,
        error: tr('내가 만든 대전방입니다. 상대방 입장을 기다려 주세요!', 'You are hosting this room. Waiting for challenger!'),
      };
    }
    if (!guestDeck || guestDeck.cards.length < 30) {
      return {
        ok: false,
        error: tr('30장 카드덱을 선택해 주세요.', 'Select a complete 30-card deck.'),
      };
    }
    const prof = hsStorage.getProfile();
    if (prof.gold < room.stakeGold) {
      return {
        ok: false,
        error: tr(
          `대전방 판돈(${room.stakeGold}G)보다 보유 골드(${prof.gold}G)가 적습니다.`,
          `Need ${room.stakeGold}G to join this wager duel (Owned: ${prof.gold}G).`,
        ),
      };
    }

    const self = this.buildSelfPresence();
    this.subscribeRoomTopic(room.roomId);
    this.sendPacket(
      {
        pktId: makeId('rmjoin'),
        type: 'DUEL_JOIN_REQUEST',
        senderId: this.peerId,
        roomId: room.roomId,
        hostPeerId: room.hostPeerId,
        guestPeerId: this.peerId,
        guestName: this.nickname,
        guestBadge: self.badgeIcon,
        guestRank: self.rank,
        guestDeckName: guestDeck.name,
        guestHeroClass: guestDeck.heroClass,
        guestCards: guestDeck.cards.slice(0, 30),
      },
      `${TOPIC_PREFIX}/direct/${room.hostPeerId}`,
    );
    return { ok: true };
  }

  private handleGuestJoinDuelRoom(
    req: Extract<WirePacket, { type: 'DUEL_JOIN_REQUEST' }>,
  ) {
    const room = this.rooms.get(req.roomId);
    const hosted = this.hostedRoomDecks.get(req.roomId);
    if (!room || !hosted || room.status !== 'WAITING') return;

    const updatedRoom: LiveDuelRoom = {
      ...room,
      status: 'IN_PROGRESS',
      guestPeerId: req.guestPeerId,
      guestName: req.guestName,
      updatedAt: Date.now(),
    };
    this.rooms.set(room.roomId, updatedRoom);
    this.subscribeRoomTopic(room.roomId);

    const topic =
      room.scope === 'GUILD' && room.guildId
        ? `${TOPIC_PREFIX}/guild/${room.guildId}`
        : `${TOPIC_PREFIX}/global`;
    this.sendPacket(
      {
        pktId: makeId('rmstart'),
        type: 'DUEL_ROOM_UPSERT',
        senderId: this.peerId,
        room: updatedRoom,
      },
      topic,
    );

    const hostMeta: LivePvpMeta = {
      roomId: room.roomId,
      role: 'HOST',
      hostPeerId: this.peerId,
      hostName: this.nickname,
      guestPeerId: req.guestPeerId,
      guestName: req.guestName,
      stakeGold: room.stakeGold,
      guildId: room.guildId,
      guildTag: room.guildTag,
      isRanked: Boolean(room.isRankedMatchmaking),
    };

    const hostInitialState = createBattleMatch({
      mode: room.isRankedMatchmaking ? 'RANKED' : 'CASUAL',
      playerName: `${room.hostBadge} ${this.nickname}`,
      playerClass: hosted.deck.heroClass,
      playerDeck: hosted.deck.cards.slice(0, 30),
      opponentName: `${req.guestBadge} ${req.guestName}`,
      opponentClass: req.guestHeroClass,
      opponentDeck: req.guestCards.slice(0, 30),
      livePvpMeta: hostMeta,
    });

    const guestInitialState = mirrorMatchStateForGuest(hostInitialState);

    this.sendPacket(
      {
        pktId: makeId('pvpstart'),
        type: 'PVP_MATCH_START',
        senderId: this.peerId,
        roomId: room.roomId,
        hostPeerId: this.peerId,
        guestPeerId: req.guestPeerId,
        stakeGold: room.stakeGold,
        guestInitialState,
      },
      `${TOPIC_PREFIX}/direct/${req.guestPeerId}`,
    );

    this.emitChange();
    for (const cb of this.matchStartHandlers) {
      cb({
        initialMatchState: hostInitialState,
        livePvpMeta: hostMeta,
      });
    }
  }

  sendPvpStateSync(roomId: string, targetGuestId: string, guestState: BattleMatchState) {
    this.init();
    this.subscribeRoomTopic(roomId);
    const seq = ++this.pvpSeq;
    this.sendPacket(
      {
        pktId: makeId('pvpsync'),
        type: 'PVP_STATE_SYNC',
        senderId: this.peerId,
        roomId,
        targetGuestId,
        seq,
        guestState,
      },
      `${TOPIC_PREFIX}/room/${roomId}`,
    );
  }

  sendPvpGuestAction(roomId: string, targetHostId: string, action: PvpGuestAction) {
    this.init();
    this.subscribeRoomTopic(roomId);
    const seq = ++this.pvpSeq;
    this.sendPacket(
      {
        pktId: makeId('pvpact'),
        type: 'PVP_GUEST_ACTION',
        senderId: this.peerId,
        roomId,
        targetHostId,
        seq,
        action,
      },
      `${TOPIC_PREFIX}/room/${roomId}`,
    );
  }

  sendPvpEmote(roomId: string, targetPeerId: string, emoteKey: LiveEmoteKey) {
    this.init();
    this.subscribeRoomTopic(roomId);
    this.sendPacket(
      {
        pktId: makeId('pvpem'),
        type: 'PVP_EMOTE',
        senderId: this.peerId,
        roomId,
        targetPeerId,
        emoteKey,
      },
      `${TOPIC_PREFIX}/room/${roomId}`,
    );
  }

  sendPvpForfeit(
    roomId: string,
    targetPeerId: string,
    reason: 'LEAVE' | 'CONCEDE' | 'DISCONNECT' = 'LEAVE',
  ) {
    this.init();
    this.subscribeRoomTopic(roomId);
    const pkt: WirePacket = {
      pktId: makeId('pvpforf'),
      type: 'PVP_FORFEIT',
      senderId: this.peerId,
      roomId,
      targetPeerId,
      reason,
    };
    this.sendPacket(pkt, `${TOPIC_PREFIX}/room/${roomId}`);
    this.sendPacket(
      { ...pkt, pktId: makeId('pvpforfd') },
      `${TOPIC_PREFIX}/direct/${targetPeerId}`,
    );
  }

  sendPvpPing(roomId: string, targetPeerId: string) {
    this.init();
    this.subscribeRoomTopic(roomId);
    this.sendPacket(
      {
        pktId: makeId('pvpping'),
        type: 'PVP_PING',
        senderId: this.peerId,
        roomId,
        targetPeerId,
      },
      `${TOPIC_PREFIX}/room/${roomId}`,
    );
  }
}

export const snsheroLiveNetwork = new SnsheroLiveNetworkService();
