import { isKoreanLanguage } from '../i18n/heroLang';
import { getLocalizedHeroInfo } from './i18nData';
import { CLASSIC_HEROES, HeroClass } from './types';

const SETTINGS_KEY = 'hero_hs_settings';
const CALM_BGM_MIGRATION_KEY = 'hero_hs_calm_bgm_15_v1';
const CALM_SFX_MIGRATION_KEY = 'hero_hs_calm_sfx_38_v1';

export type LobbySkyTimePref = 'AUTO' | 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT';

export interface AudioSettings {
  bgmVolume: number;
  sfxVolume: number;
  voVolume: number;
  muted: boolean;
  vibrateEnabled: boolean;
  ttsEnabled: boolean;
  lobbySkyTime: LobbySkyTimePref;
  emoteBubblesEnabled: boolean;
  kadanClutchBreakEnabled: boolean;
  compactCleanCardView: boolean;
}

export type AttackVibrationKind =
  | 'LIGHT_HIT'
  | 'NORMAL_ATTACK'
  | 'HERO_HIT'
  | 'HEAVY_ATTACK'
  | 'HERO_FINISHER';

export interface VibrationSupportInfo {
  isAndroid: boolean;
  webVibrationApi: boolean;
  supportedOnDevice: boolean;
}

const DEFAULT_AUDIO: AudioSettings = {
  bgmVolume: 0.15,
  sfxVolume: 0.38,
  voVolume: 0.88,
  muted: false,
  vibrateEnabled: true,
  ttsEnabled: true,
  lobbySkyTime: 'AUTO',
  emoteBubblesEnabled: true,
  kadanClutchBreakEnabled: true,
  compactCleanCardView: false,
};

export interface DamageVibrationSpec {
  tier: 'MICRO' | 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'COLOSSAL' | 'FINISHER';
  strength: number;
  pattern: number | number[];
  durationMs: number;
}

/**
 * 카드가 주고받는 데미지(dealt + counterReceived 또는 주문 피해량)에 비례한 6단계 정밀 햅틱 진동 스펙 계산
 */
export function computeDamageVibrationSpec(
  rawDamage: number,
  isFinisher = false,
): DamageVibrationSpec {
  const dmg = Math.max(1, Math.round(rawDamage || 1));
  if (isFinisher) {
    return {
      tier: 'FINISHER',
      strength: 120,
      pattern: [85, 28, 120, 28, 165],
      durationMs: 435,
    };
  }
  if (dmg <= 2) {
    // 1~2 데미지: 짧고 가벼운 미세 톡 진동 (18ms ~ 24ms)
    const ms = 12 + dmg * 6;
    return {
      tier: 'MICRO',
      strength: dmg,
      pattern: ms,
      durationMs: ms + 10,
    };
  }
  if (dmg <= 4) {
    // 3~4 데미지: 선명한 단타 진동 (34ms ~ 42ms)
    const ms = 10 + dmg * 8;
    return {
      tier: 'LIGHT',
      strength: dmg,
      pattern: ms,
      durationMs: ms + 12,
    };
  }
  if (dmg <= 7) {
    // 5~7 데미지: 2단 중타 충돌 진동
    const p1 = Math.round(26 + dmg * 3.2);
    const p2 = Math.round(36 + dmg * 4.2);
    return {
      tier: 'MEDIUM',
      strength: dmg,
      pattern: [p1, 22, p2],
      durationMs: p1 + 22 + p2 + 12,
    };
  }
  if (dmg <= 11) {
    // 8~11 데미지: 묵직한 2단 강타 충돌 진동
    const p1 = Math.round(38 + dmg * 2.8);
    const p2 = Math.round(54 + dmg * 3.8);
    return {
      tier: 'HEAVY',
      strength: dmg,
      pattern: [p1, 24, p2],
      durationMs: p1 + 24 + p2 + 14,
    };
  }
  // 12+ 데미지 (거대 전설 하수인 또는 스토리모드 배수 격돌): 3단 대격돌 파열 진동
  const capped = Math.min(28, dmg);
  const p1 = Math.min(96, Math.round(52 + capped * 1.6));
  const p2 = Math.min(132, Math.round(70 + capped * 2.1));
  const p3 = Math.min(168, Math.round(90 + capped * 2.6));
  return {
    tier: 'COLOSSAL',
    strength: Math.min(110, dmg),
    pattern: [p1, 26, p2, 26, p3],
    durationMs: p1 + 26 + p2 + 26 + p3 + 16,
  };
}

const KIND_TO_DAMAGE: Record<AttackVibrationKind, { dmg: number; finisher?: boolean }> = {
  LIGHT_HIT: { dmg: 2 },
  NORMAL_ATTACK: { dmg: 4 },
  HERO_HIT: { dmg: 6 },
  HEAVY_ATTACK: { dmg: 9 },
  HERO_FINISHER: { dmg: 20, finisher: true },
};

class SnsHeroCardAudioEngine {
  private settings: AudioSettings = DEFAULT_AUDIO;
  private currentBgm: HTMLAudioElement | null = null;
  private currentBgmKey: string | null = null;
  private pendingBgmTrack: 'tavern_hub' | 'collection' | 'mulligan' | 'duel_1' | 'duel_2' | null = null;
  private currentVo: HTMLAudioElement | null = null;
  private currentVoResolve: (() => void) | null = null;
  private currentVoSequenceCancel: (() => void) | null = null;
  private voSequenceToken = 0;
  private decodedVoBufferCache = new Map<string, Promise<AudioBuffer | null>>();
  private currentStoryAudio: HTMLAudioElement | null = null;
  private currentStoryCleanup: (() => void) | null = null;
  private storyManuallyPaused = false;
  private heroNameVoMapPromise: Promise<Record<string, string>> | null = null;
  private activeSfx = new Set<HTMLAudioElement>();
  private ctx: AudioContext | null = null;
  private activeSynthNodes = 0;
  private lastAnimaleseAt = 0;
  private unlocked = false;
  private isWindowActive = true;
  private activeVibrateUntil = 0;
  private activeVibrateStrength = 0;

  constructor() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        this.settings = { ...DEFAULT_AUDIO, ...JSON.parse(raw) };
      }
      if (!localStorage.getItem(CALM_BGM_MIGRATION_KEY)) {
        this.settings.bgmVolume = 0.15;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
        localStorage.setItem(CALM_BGM_MIGRATION_KEY, '1');
      }
      if (!localStorage.getItem(CALM_SFX_MIGRATION_KEY)) {
        this.settings.sfxVolume = 0.38;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
        localStorage.setItem(CALM_SFX_MIGRATION_KEY, '1');
      }
    } catch {
      // ignore storage errors
    }

    if (typeof window !== 'undefined') {
      if (typeof document !== 'undefined') {
        this.isWindowActive =
          !document.hidden &&
          (typeof document.hasFocus !== 'function' || document.hasFocus());
      }

      const handleBlur = () => {
        this.suspendForFocusLoss();
      };

      const handleFocus = () => {
        this.resumeForFocusGain();
      };

      const handleVisibilityChange = () => {
        if (typeof document === 'undefined') return;
        if (document.hidden) {
          this.suspendForFocusLoss();
        } else if (typeof document.hasFocus !== 'function' || document.hasFocus()) {
          this.resumeForFocusGain();
        }
      };

      const unlock = () => {
        const wasUnlocked = this.unlocked;
        this.unlocked = true;
        if (typeof document === 'undefined' || !document.hidden) {
          this.resumeForFocusGain();
          if (!wasUnlocked && this.pendingBgmTrack && !this.currentBgm) {
            const trackToStart = this.pendingBgmTrack;
            this.currentBgmKey = null;
            this.playBgm(trackToStart);
          }
        }
      };

      window.addEventListener('blur', handleBlur);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('pagehide', handleBlur);
      window.addEventListener('pageshow', handleFocus);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }

      window.addEventListener('pointerdown', unlock, { passive: true, capture: true });
      window.addEventListener('touchstart', unlock, { passive: true, capture: true });
      window.addEventListener('keydown', unlock, { passive: true, capture: true });
    }
  }

  private checkWindowActive(): boolean {
    if (typeof document !== 'undefined') {
      if (document.hidden) {
        this.isWindowActive = false;
        return false;
      }
      if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
        this.isWindowActive = false;
        return false;
      }
    }
    return this.isWindowActive;
  }

  private suspendForFocusLoss() {
    this.isWindowActive = false;

    if (this.currentBgm && !this.currentBgm.paused) {
      this.currentBgm.pause();
    }

    if (this.activeSfx.size > 0) {
      for (const sfx of this.activeSfx) {
        try {
          sfx.pause();
          sfx.src = '';
        } catch {
          // ignore
        }
      }
      this.activeSfx.clear();
    }

    this.cancelActiveVo();

    if (this.currentStoryAudio) {
      try {
        this.currentStoryAudio.muted = true;
        this.currentStoryAudio.volume = 0;
        if (typeof document !== 'undefined' && document.hidden && !this.currentStoryAudio.paused) {
          this.currentStoryAudio.pause();
        }
      } catch {
        // ignore
      }
    }

    this.cancelTts();

    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }

    this.activeVibrateUntil = 0;
    this.activeVibrateStrength = 0;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
    } catch {
      // ignore
    }
  }

  private resumeForFocusGain() {
    if (typeof document !== 'undefined') {
      if (document.hidden) return;
      if (typeof document.hasFocus === 'function' && !document.hasFocus()) return;
    }
    this.isWindowActive = true;
    if (this.settings.muted) return;

    if (this.unlocked && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (
      this.currentBgm &&
      this.settings.bgmVolume > 0 &&
      this.currentBgm.paused &&
      (this.currentBgm.loop || !this.currentBgm.ended)
    ) {
      this.currentBgm.volume = this.currentStoryAudio
        ? this.settings.bgmVolume * 0.42
        : this.settings.bgmVolume;
      this.currentBgm.play().catch(() => {});
    }

    if (this.currentStoryAudio) {
      const canPlayStory = !this.settings.muted && this.settings.voVolume > 0;
      this.currentStoryAudio.muted = !canPlayStory;
      this.currentStoryAudio.volume = canPlayStory ? Math.min(1, this.settings.voVolume) : 0;
      if (
        canPlayStory &&
        !this.storyManuallyPaused &&
        this.currentStoryAudio.paused &&
        !this.currentStoryAudio.ended
      ) {
        this.currentStoryAudio.play().catch(() => {});
      }
    }
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  getVibrationSupportInfo(): VibrationSupportInfo {
    if (typeof navigator === 'undefined') {
      return { isAndroid: false, webVibrationApi: false, supportedOnDevice: false };
    }
    const ua = navigator.userAgent || '';
    const uaPlatform =
      (
        navigator as Navigator & {
          userAgentData?: { platform?: string };
        }
      ).userAgentData?.platform?.toLowerCase() || '';
    // Covers Android Chrome/Samsung Internet/WebView + Android Chrome "Request Desktop Site" (Linux + multi-touch)
    const isAndroid =
      /Android/i.test(ua) ||
      uaPlatform === 'android' ||
      (/Linux/i.test(ua) && (navigator.maxTouchPoints || 0) > 0);
    const webVibrationApi = typeof navigator.vibrate === 'function';
    return {
      isAndroid,
      webVibrationApi,
      supportedOnDevice: isAndroid && webVibrationApi,
    };
  }

  updateSettings(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('snshero:settings-changed', { detail: this.settings }));
        window.dispatchEvent(new Event('snshero:state-changed'));
      }
    } catch {
      // ignore
    }
    if (patch.ttsEnabled === false) {
      this.stopStoryNarration();
      this.cancelTts();
    }
    if (patch.vibrateEnabled === false) {
      this.activeVibrateUntil = 0;
      this.activeVibrateStrength = 0;
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(0);
        }
      } catch {
        // ignore
      }
    }
    if (this.currentBgm) {
      this.currentBgm.volume = this.settings.muted ? 0 : this.settings.bgmVolume;
      if (this.settings.muted || !this.isWindowActive) {
        this.currentBgm.pause();
      } else if (
        this.unlocked &&
        this.settings.bgmVolume > 0 &&
        this.currentBgm.paused &&
        (this.currentBgm.loop || !this.currentBgm.ended)
      ) {
        this.currentBgm.play().catch(() => {});
      }
    }
    if (this.currentStoryAudio) {
      const canHear = this.checkWindowActive() && !this.settings.muted && this.settings.voVolume > 0;
      this.currentStoryAudio.muted = !canHear;
      this.currentStoryAudio.volume = canHear ? Math.min(1, this.settings.voVolume) : 0;
      if (!canHear) {
        this.currentStoryAudio.pause();
      } else if (!this.storyManuallyPaused && this.currentStoryAudio.paused && !this.currentStoryAudio.ended) {
        this.currentStoryAudio.play().catch(() => {});
      }
    }
    if (this.settings.muted) {
      this.cancelActiveVo();
      if (this.activeSfx.size > 0) {
        for (const sfx of this.activeSfx) {
          sfx.pause();
        }
        this.activeSfx.clear();
      }
    }
  }

  private hasStickyUserActivation(): boolean {
    if (typeof navigator === 'undefined') return false;
    const navWithActivation = navigator as Navigator & {
      userActivation?: { hasBeenActive: boolean };
    };
    if (navWithActivation.userActivation) {
      return Boolean(navWithActivation.userActivation.hasBeenActive);
    }
    return this.unlocked;
  }

  /**
   * 카드가 주고받는 실제 데미지(공격 피해 + 반격 피해, 또는 주문 피해량)에 비례한 안드로이드 웹 진동 실행
   * - 환경설정 `vibrateEnabled`가 켜져 있고 안드로이드 Web Vibration 지원 기기일 때 작동
   * - 우선순위 중재기(Priority Arbiter): 더 강한 충돌 진동 도중 약한 보조 틱이 진동을 덮어쓰지 않도록 보호
   */
  vibrateByDamage(damage: number, opts?: { isFinisher?: boolean }): boolean {
    if (!this.isWindowActive || !this.settings.vibrateEnabled) return false;
    const support = this.getVibrationSupportInfo();
    if (!support.supportedOnDevice) return false;
    if (!this.hasStickyUserActivation()) return false;

    const spec = computeDamageVibrationSpec(damage, Boolean(opts?.isFinisher));
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now < this.activeVibrateUntil && spec.strength <= this.activeVibrateStrength) {
      return false;
    }

    try {
      const ok = navigator.vibrate(spec.pattern);
      if (ok) {
        this.activeVibrateStrength = spec.strength;
        this.activeVibrateUntil = now + spec.durationMs;
      }
      return ok;
    } catch {
      return false;
    }
  }

  vibrateAttack(kind: AttackVibrationKind): boolean {
    const mapped = KIND_TO_DAMAGE[kind];
    return this.vibrateByDamage(mapped.dmg, { isFinisher: mapped.finisher });
  }

  previewVibration(): boolean {
    if (!this.isWindowActive || !this.settings.vibrateEnabled) return false;
    const support = this.getVibrationSupportInfo();
    if (!support.supportedOnDevice || !this.hasStickyUserActivation()) return false;
    try {
      return navigator.vibrate(28);
    } catch {
      return false;
    }
  }

  private getAudioCtx(): AudioContext | null {
    if (
      typeof window === 'undefined' ||
      (!this.unlocked && !this.hasStickyUserActivation()) ||
      !this.checkWindowActive()
    ) {
      return null;
    }
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playBgm(track: 'tavern_hub' | 'collection' | 'mulligan' | 'duel_1' | 'duel_2') {
    this.pendingBgmTrack = track;
    if (!this.unlocked && !this.hasStickyUserActivation()) {
      if (this.currentBgm) {
        this.currentBgm.pause();
        this.currentBgm.src = '';
        this.currentBgm = null;
      }
      this.currentBgmKey = track;
      return;
    }
    const active = this.checkWindowActive();
    if (this.currentBgmKey === track && this.currentBgm) {
      if (
        active &&
        !this.settings.muted &&
        this.settings.bgmVolume > 0 &&
        this.currentBgm.paused &&
        (this.currentBgm.loop || !this.currentBgm.ended)
      ) {
        this.currentBgm.play().catch(() => {});
      }
      return;
    }
    if (this.currentBgm) {
      this.currentBgm.pause();
      this.currentBgm.src = '';
      this.currentBgm = null;
    }
    this.currentBgmKey = track;
    const audio = new Audio(`/hs-assets/snshero-audio/bgm/${track}.mp3?v=fantasy_orch2`);
    audio.loop = track !== 'mulligan';
    audio.volume = this.settings.muted ? 0 : this.settings.bgmVolume;
    this.currentBgm = audio;
    if (active && !this.settings.muted && this.settings.bgmVolume > 0) {
      audio.play().catch(() => {});
    }
  }

  stopBgm() {
    this.pendingBgmTrack = null;
    if (this.currentBgm) {
      this.currentBgm.pause();
      this.currentBgm.src = '';
      this.currentBgm = null;
      this.currentBgmKey = null;
    }
  }

  playSfx(
    name:
      | 'box_open'
      | 'box_close'
      | 'box_disk_flip'
      | 'box_hover'
      | 'box_press'
      | 'box_tray_in'
      | 'box_tray_out'
      | 'ui_hover'
      | 'ui_click'
      | 'cm_select_hero'
      | 'cm_remove_card'
      | 'attack'
      | 'big_attack'
      | 'card_hover'
      | 'card_place'
      | 'card_flip'
      | 'crowd'
      | 'end_turn'
      | 'hero_power'
      | 'menu_press'
      | 'menu_select'
      | 'open_menu'
      | 'pack_open'
      | 'pack_rare'
      | 'pack_epic'
      | 'pack_legendary'
      | 'player_turn'
      | 'purchase'
      | 'victory'
      | 'whoosh'
      | 'mario_coin'
      | 'zelda_secret'
      | 'zelda_chest_open'
      | 'ocarina_chime'
      | 'gem_a_confirm'
      | 'gem_b_back'
      | 'gem_c_select'
      | 'mario_spring'
      | 'bogart_wager'
      | 'rank_radar_lock'
      | 'taunt_bubble_pop',
    volumeScale = 1,
  ) {
    if (
      (!this.unlocked && !this.hasStickyUserActivation()) ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.sfxVolume <= 0
    ) {
      return;
    }
    if (
      name === 'mario_coin' ||
      name === 'zelda_secret' ||
      name === 'zelda_chest_open' ||
      name === 'ocarina_chime' ||
      name === 'gem_a_confirm' ||
      name === 'gem_b_back' ||
      name === 'gem_c_select' ||
      name === 'mario_spring' ||
      name === 'bogart_wager' ||
      name === 'rank_radar_lock' ||
      name === 'taunt_bubble_pop'
    ) {
      this.playNintendoProceduralSfx(name, volumeScale);
      return;
    }
    if (name === 'purchase') {
      this.playNintendoProceduralSfx('mario_coin', 0.85 * volumeScale);
    } else if (name === 'pack_open') {
      this.playNintendoProceduralSfx('zelda_chest_open', 0.7 * volumeScale);
    } else if (name === 'box_open') {
      this.playNintendoProceduralSfx('ocarina_chime', 0.65 * volumeScale);
    }
    try {
      // iOS Safari WebKit caps concurrent HTMLAudioElement/AVPlayer pipelines; evict oldest if >= 10
      if (this.activeSfx.size >= 10) {
        const oldest = this.activeSfx.values().next().value;
        if (oldest) {
          this.activeSfx.delete(oldest);
          try {
            oldest.onended = null;
            oldest.onerror = null;
            oldest.pause();
            oldest.src = '';
          } catch {
            // ignore
          }
        }
      }
      const a = new Audio(`/hs-assets/snshero-audio/sfx/${name}.mp3?v=melody2`);
      a.volume = Math.min(1, this.settings.sfxVolume * volumeScale * 0.72);
      this.activeSfx.add(a);
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        this.activeSfx.delete(a);
        a.onended = null;
        a.onerror = null;
        try {
          a.pause();
          a.src = '';
        } catch {
          // ignore
        }
      };
      a.onended = cleanup;
      a.onerror = cleanup;
      a.play().catch(cleanup);
    } catch {
      // ignore
    }
  }

  /**
   * DEV-030: Nintendo (Zelda: Ocarina of Time & Super Mario) Procedural 10-SFX Synthesizer.
   * Zero network payload; disconnects every Oscillator/Gain node on ended to protect iOS WebKit.
   */
  playNintendoProceduralSfx(
    kind:
      | 'mario_coin'
      | 'zelda_secret'
      | 'zelda_chest_open'
      | 'ocarina_chime'
      | 'gem_a_confirm'
      | 'gem_b_back'
      | 'gem_c_select'
      | 'mario_spring'
      | 'bogart_wager'
      | 'rank_radar_lock'
      | 'taunt_bubble_pop',
    volumeScale = 1,
  ) {
    if (
      (!this.unlocked && !this.hasStickyUserActivation()) ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.sfxVolume <= 0
    ) {
      return;
    }
    const ctx = this.getAudioCtx();
    if (!ctx || ctx.state !== 'running' || this.activeSynthNodes >= 24) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = Math.min(0.45, this.settings.sfxVolume * 0.42 * volumeScale);
    master.connect(ctx.destination);

    let maxEnd = 0.35;
    const note = (
      freq: number,
      startOffset: number,
      dur: number,
      type: OscillatorType = 'triangle',
      peak = 0.65,
      freqEnd?: number,
    ) => {
      if (this.activeSynthNodes >= 28) return;
      this.activeSynthNodes += 1;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this.activeSynthNodes = Math.max(0, this.activeSynthNodes - 1);
      };
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + startOffset + dur);
      }
      g.gain.setValueAtTime(0.0001, now + startOffset);
      g.gain.linearRampToValueAtTime(peak, now + startOffset + Math.min(0.014, dur * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + dur);
      osc.connect(g);
      g.connect(master);
      osc.onended = () => {
        release();
        try {
          osc.disconnect();
          g.disconnect();
        } catch {
          // ignore
        }
      };
      window.setTimeout(release, Math.ceil((startOffset + dur) * 1000) + 180);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + dur + 0.01);
      maxEnd = Math.max(maxEnd, startOffset + dur + 0.05);
    };

    switch (kind) {
      case 'mario_coin':
        // Classic Mario 2-note Gold Coin: B5 (987.77Hz) -> E6 (1318.51Hz)
        note(987.77, 0, 0.075, 'square', 0.38);
        note(987.77 * 2, 0, 0.07, 'sine', 0.22);
        note(1318.51, 0.075, 0.28, 'square', 0.42);
        note(1318.51 * 2, 0.075, 0.25, 'sine', 0.24);
        break;
      case 'zelda_secret': {
        // Ocarina Sanctuary Discovery 8-note arpeggio: G5 F#5 D#5 A4 G#4 E5 G#5 C6
        const seq = [783.99, 739.99, 622.25, 440.0, 415.3, 659.25, 830.61, 1046.5];
        seq.forEach((f, idx) => note(f, idx * 0.072, idx === 7 ? 0.26 : 0.085, 'triangle', 0.58));
        break;
      }
      case 'zelda_chest_open': {
        // Rising anticipation + triumphant 4-voice sanctuary fanfare (C5-E5-G5-C6)
        const rise = [523.25, 587.33, 659.25, 698.46];
        rise.forEach((f, i) => note(f, i * 0.065, 0.075, 'triangle', 0.48));
        [523.25, 659.25, 783.99, 1046.5].forEach((f) => note(f, 0.27, 0.42, 'triangle', 0.36));
        break;
      }
      case 'ocarina_chime': {
        // Ocarina of Time 5-note warm woodwind motif (D5 -> F5 -> D6 -> A5 -> G5)
        const motif: [number, number, number][] = [
          [587.33, 0, 0.12],
          [698.46, 0.11, 0.12],
          [1174.66, 0.22, 0.22],
          [880.0, 0.44, 0.14],
          [783.99, 0.57, 0.24],
        ];
        motif.forEach(([f, t, d]) => note(f, t, d, 'triangle', 0.55));
        break;
      }
      case 'gem_a_confirm':
        note(659.25, 0, 0.07, 'triangle', 0.52);
        note(987.77, 0.055, 0.16, 'triangle', 0.58);
        break;
      case 'gem_b_back':
        note(523.25, 0, 0.07, 'triangle', 0.45);
        note(392.0, 0.055, 0.14, 'triangle', 0.42);
        break;
      case 'gem_c_select':
        note(880.0, 0, 0.09, 'triangle', 0.46);
        note(1320.0, 0.02, 0.07, 'sine', 0.22);
        break;
      case 'mario_spring':
        note(185, 0, 0.19, 'triangle', 0.58, 640);
        break;
      case 'bogart_wager':
        note(1174.66, 0, 0.055, 'triangle', 0.45);
        note(1567.98, 0.045, 0.065, 'triangle', 0.48);
        note(987.77, 0.1, 0.07, 'square', 0.34);
        note(1318.51, 0.165, 0.22, 'square', 0.38);
        break;
      case 'rank_radar_lock':
        note(523.25, 0, 0.075, 'triangle', 0.5);
        note(783.99, 0.08, 0.075, 'triangle', 0.52);
        note(1046.5, 0.16, 0.24, 'triangle', 0.6);
        break;
      case 'taunt_bubble_pop':
        note(310, 0, 0.09, 'sine', 0.52, 560);
        note(660, 0.07, 0.08, 'triangle', 0.35);
        break;
    }

    window.setTimeout(() => {
      try {
        master.disconnect();
      } catch {
        // ignore
      }
    }, Math.ceil(maxEnd * 1000) + 80);
  }

  /**
   * Animal Crossing (`동물의 숲` Animalese)-style per-character voice blip synthesizer
   * - Modulates pitch & formant filter by speaker personality + Hangul/Latin vowel contour
   */
  playAnimaleseBlip(
    char: string,
    speakerName = '',
    speakerSide: 'LEFT' | 'RIGHT' = 'LEFT',
    isQuestionTail = false,
  ) {
    if (
      (!this.unlocked && !this.hasStickyUserActivation()) ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.sfxVolume <= 0
    ) {
      return;
    }
    if (!char || /[\s.,…!?"'“”‘’—\-~:;()[\]{}·/\\<>]/.test(char)) return;

    const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (perfNow - this.lastAnimaleseAt < 38) return;
    this.lastAnimaleseAt = perfNow;

    const ctx = this.getAudioCtx();
    if (!ctx || ctx.state !== 'running' || this.activeSynthNodes >= 20) return;

    const lowerSpeaker = speakerName.toLowerCase();
    let baseFreq = speakerSide === 'LEFT' ? 355 : 280;
    let waveType: OscillatorType = 'triangle';

    if (
      /실리아|엘윈|엘리아나|에일라|이셀라|세이렌|아라크네|아리엘|루나|프레이야|요정|성녀|여왕|silia|elwin|eliana|ayla|ysera|siren|arachne|ariel|luna|freyja/i.test(
        lowerSpeaker,
      )
    ) {
      baseFreq = 445;
      waveType = 'triangle';
    } else if (/카단|로비냐드|이그니스|제피로스|테라|kadan|robinyard|ignis|zephyros|terra/i.test(lowerSpeaker)) {
      baseFreq = 358;
      waveType = 'triangle';
    } else if (/허수아비|로봇|골렘|콜로서스|기계|태엽|scarecrow|bot|golem|colossus|mech/i.test(lowerSpeaker)) {
      baseFreq = 315;
      waveType = 'square';
    } else if (
      /벨페고르|아르투스|헤르쿨|그림리|펜릴|마왕|군주|리치|드래곤|괴수|belphegor|arthas|hercul|grimli|fenrir|lord|lich|dragon/i.test(
        lowerSpeaker,
      )
    ) {
      baseFreq = 232;
      waveType = 'sawtooth';
    } else if (speakerName) {
      let hash = 0;
      for (let i = 0; i < speakerName.length; i += 1) {
        hash = (hash * 31 + speakerName.charCodeAt(i)) | 0;
      }
      baseFreq = 265 + (Math.abs(hash) % 145);
    }

    // Extract Hangul vowel (중성 0..20) or Latin character code for authentic vowel melody!
    const code = char.charCodeAt(0);
    let pitchRatio = 1.0;
    let formantCutoff = 1750;

    if (code >= 0xac00 && code <= 0xd7a3) {
      const jung = Math.floor((code - 0xac00) / 28) % 21;
      // Bright front vowels (ㅏ,ㅐ,ㅑ,ㅒ,ㅔ,ㅖ,ㅣ) vs warm rounded vowels (ㅗ,ㅜ,ㅡ,ㅓ)
      const vowelPitchTable = [
        1.05, 1.1, 1.08, 1.12, 0.96, 1.06, 0.99, 1.09, 0.92, 0.98, 1.03, 1.06, 0.95, 0.89, 0.94,
        0.99, 1.04, 0.92, 0.91, 1.02, 1.14,
      ];
      pitchRatio = vowelPitchTable[jung] ?? 1.0;
      formantCutoff = pitchRatio >= 1.04 ? 2250 : 1450;
    } else {
      const lowerChar = char.toLowerCase();
      if ('iey'.includes(lowerChar)) {
        pitchRatio = 1.12;
        formantCutoff = 2300;
      } else if ('ae'.includes(lowerChar)) {
        pitchRatio = 1.05;
        formantCutoff = 2050;
      } else if ('ou'.includes(lowerChar)) {
        pitchRatio = 0.91;
        formantCutoff = 1380;
      } else {
        pitchRatio = 0.95 + ((code % 7) * 0.025);
        formantCutoff = 1700;
      }
    }

    if (isQuestionTail) {
      pitchRatio *= 1.14;
    }

    const targetFreq = Math.max(140, Math.min(820, baseFreq * pitchRatio));
    const now = ctx.currentTime;
    const dur = 0.054;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(formantCutoff, now);
    filter.Q.setValueAtTime(2.2, now);

    const master = ctx.createGain();
    const vol = Math.min(0.26, this.settings.sfxVolume * (waveType === 'triangle' ? 0.28 : 0.16));
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(vol, now + 0.007);
    master.gain.exponentialRampToValueAtTime(vol * 0.62, now + 0.026);
    master.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const osc = ctx.createOscillator();
    osc.type = waveType;
    osc.frequency.setValueAtTime(targetFreq * 0.92, now);
    osc.frequency.exponentialRampToValueAtTime(targetFreq * 1.08, now + 0.018);
    osc.frequency.exponentialRampToValueAtTime(
      isQuestionTail ? targetFreq * 1.16 : targetFreq * 0.96,
      now + dur,
    );

    // Subtle 2nd formant harmonic for cute vocal warmth
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(targetFreq * 2.0, now);
    subGain.gain.setValueAtTime(0.28, now);

    osc.connect(filter);
    subOsc.connect(subGain);
    subGain.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);

    osc.onended = () => {
      try {
        osc.disconnect();
        subOsc.disconnect();
        subGain.disconnect();
        filter.disconnect();
        master.disconnect();
      } catch {
        // ignore
      }
    };

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + dur + 0.01);
    subOsc.stop(now + dur + 0.01);
  }

  /** Procedural WebAudio elemental & mechanical accents layered with foley SFX */
  playProceduralVfxSound(
    kind:
      | 'MANA_GAIN'
      | 'FIRE'
      | 'FROST'
      | 'LIGHTNING'
      | 'HOLY'
      | 'SHADOW'
      | 'DIVINE_BREAK'
      | 'SECRET_TRIGGER'
      | 'SILENCE'
      | 'ROPE_TICK'
      | 'ARMOR'
      | 'FATIGUE'
      | 'LEGENDARY_FANFARE'
      | 'DEATH_CRACK'
      | 'CARD_BURN'
      | 'POISON'
      | 'TOY_BELL'
      | 'TOY_CATAPULT'
      | 'TOY_RADISH'
      | 'TOY_DRUM'
      | 'TOY_SPLASH',
  ) {
    if (
      (!this.unlocked && !this.hasStickyUserActivation()) ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.sfxVolume <= 0
    ) {
      return;
    }
    const ctx = this.getAudioCtx();
    if (!ctx || ctx.state !== 'running' || this.activeSynthNodes >= 20) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = this.settings.sfxVolume * 0.18;
    master.connect(ctx.destination);

    const tone = (
      freqStart: number,
      freqEnd: number,
      dur: number,
      type: OscillatorType = 'sine',
      delay = 0,
    ) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + delay + dur);
      g.gain.setValueAtTime(0.001, now + delay);
      g.gain.linearRampToValueAtTime(0.6, now + delay + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      osc.connect(g);
      g.connect(master);
      osc.onended = () => {
        try {
          osc.disconnect();
          g.disconnect();
        } catch {
          // ignore
        }
      };
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.02);
    };
    window.setTimeout(() => {
      try {
        master.disconnect();
      } catch {
        // ignore
      }
    }, 1200);

    switch (kind) {
      case 'MANA_GAIN':
        tone(587.33, 587.33, 0.35, 'sine', 0);
        tone(880, 880, 0.4, 'sine', 0.09);
        break;
      case 'FIRE':
        tone(240, 55, 0.45, 'sawtooth');
        tone(420, 90, 0.32, 'triangle', 0.04);
        break;
      case 'FROST':
        tone(1400, 2400, 0.18, 'sine');
        tone(1900, 920, 0.28, 'triangle', 0.07);
        break;
      case 'LIGHTNING':
        tone(950, 110, 0.24, 'sawtooth');
        tone(1600, 220, 0.18, 'square', 0.05);
        break;
      case 'HOLY':
        tone(523.25, 783.99, 0.45, 'sine');
        tone(659.25, 1046.5, 0.5, 'triangle', 0.06);
        break;
      case 'SHADOW':
        tone(180, 65, 0.5, 'sawtooth');
        tone(270, 95, 0.45, 'sine', 0.04);
        break;
      case 'DIVINE_BREAK':
        tone(1800, 620, 0.24, 'triangle');
        tone(2400, 880, 0.2, 'sine', 0.04);
        break;
      case 'SECRET_TRIGGER':
        tone(440, 880, 0.25, 'triangle');
        tone(660, 1320, 0.35, 'sine', 0.12);
        break;
      case 'SILENCE':
        tone(720, 210, 0.34, 'sine');
        break;
      case 'ROPE_TICK':
        tone(310, 180, 0.08, 'triangle');
        break;
      case 'ARMOR':
        tone(320, 480, 0.16, 'triangle');
        break;
      case 'FATIGUE':
        tone(150, 52, 0.55, 'sawtooth');
        break;
      case 'LEGENDARY_FANFARE':
        // Majestic Heroic Brass + Celestial Triad Stinger for Legendary Entrance
        tone(293.66, 293.66, 0.68, 'sawtooth', 0);
        tone(440.0, 440.0, 0.72, 'triangle', 0.04);
        tone(587.33, 587.33, 0.78, 'triangle', 0.09);
        tone(739.99, 739.99, 0.82, 'sine', 0.14);
        tone(880.0, 1174.66, 0.85, 'sine', 0.18);
        break;
      case 'DEATH_CRACK':
        tone(190, 48, 0.28, 'sawtooth', 0);
        tone(620, 140, 0.16, 'triangle', 0.03);
        break;
      case 'CARD_BURN':
        tone(340, 85, 0.36, 'sawtooth', 0);
        tone(920, 210, 0.26, 'triangle', 0.05);
        break;
      case 'POISON':
        tone(460, 720, 0.16, 'sine', 0);
        tone(680, 290, 0.24, 'triangle', 0.08);
        break;
      case 'TOY_BELL':
        tone(1046.5, 1046.5, 0.52, 'sine', 0);
        tone(1567.98, 1567.98, 0.44, 'triangle', 0.06);
        break;
      case 'TOY_CATAPULT':
        tone(140, 420, 0.22, 'sawtooth', 0);
        tone(160, 45, 0.38, 'triangle', 0.24);
        break;
      case 'TOY_RADISH':
        tone(320, 780, 0.16, 'sine', 0);
        break;
      case 'TOY_DRUM':
        tone(115, 42, 0.28, 'triangle', 0);
        tone(145, 52, 0.24, 'sine', 0.12);
        break;
      case 'TOY_SPLASH':
        tone(680, 240, 0.22, 'sine', 0);
        tone(980, 420, 0.18, 'triangle', 0.06);
        break;
    }
  }

  private cancelActiveVo() {
    this.voSequenceToken += 1;
    const seqCancel = this.currentVoSequenceCancel;
    this.currentVoSequenceCancel = null;
    if (seqCancel) {
      try {
        seqCancel();
      } catch {
        // ignore
      }
    }
    if (this.currentVo) {
      try {
        this.currentVo.pause();
        this.currentVo.src = '';
      } catch {
        // ignore
      }
      this.currentVo = null;
      const prevResolve = this.currentVoResolve;
      this.currentVoResolve = null;
      prevResolve?.();
    }
  }

  private withVoVersion(url: string): string {
    if (url.includes('?')) return url;
    if (url.includes('/short_') || url.includes('/announcer_versus.mp3')) {
      return `${url}?v=tight1`;
    }
    return url;
  }

  playVoFile(voKey: string): Promise<void> {
    if (
      !isKoreanLanguage() ||
      (!this.unlocked && !this.hasStickyUserActivation()) ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.voVolume <= 0
    ) {
      return Promise.resolve();
    }
    const url = this.withVoVersion(`/hs-assets/snshero-audio/vo/${voKey}.mp3`);
    return this.playCustomVoUrl(url);
  }

  playInnkeeper(
    line:
      | 'welcome'
      | 'mulligan'
      | 'coin'
      | 'collection'
      | 'rare'
      | 'epic'
      | 'legendary'
      | 'golden_common'
      | 'golden_rare'
      | 'golden_epic'
      | 'golden_legendary',
  ) {
    if (
      line === 'rare' ||
      line === 'epic' ||
      line === 'legendary' ||
      line === 'golden_common' ||
      line === 'golden_rare' ||
      line === 'golden_epic' ||
      line === 'golden_legendary'
    ) {
      this.playVoFile(`announcer_${line}`);
    } else {
      this.playVoFile(`innkeeper_${line}`);
    }
  }

  playHeroVo(
    heroClass: HeroClass,
    kind:
      | 'greetings'
      | 'well_played'
      | 'thanks'
      | 'wow'
      | 'oops'
      | 'threaten'
      | 'start'
      | 'concede'
      | 'attack'
      | 'error_mana'
      | 'error_attacked'
      | 'error_taunt'
      | 'time',
  ) {
    const heroVo = CLASSIC_HEROES[heroClass].voKey;
    this.playVoFile(`hero_${heroVo}_${kind}`);
  }

  /**
   * 스토리모드 5컷 남성 성우(Neural Male Narrator) 전용 오디오 재생기
   * - 브라우저 기본 기계음 여성 TTS(speechSynthesis)를 완전히 배제하고 스튜디오 마스터링된 남성 성우 MP3를 재생합니다.
   * - 문장을 읽는 도중 절대 끊고 넘어가지 않도록 실제 오디오 `ended` 이벤트 도달 시에만 `onEnded`를 호출합니다.
   */
  playStoryNarration(
    audioUrl: string,
    callbacks?: {
      fallbackText?: string;
      onProgress?: (progress01: number, remainingSec: number, durationSec: number) => void;
      onEnded?: () => void;
      onFallbackTimer?: () => void;
    },
  ): () => void {
    this.stopStoryNarration();
    this.cancelTts();
    this.storyManuallyPaused = false;

    if (
      !this.settings.ttsEnabled ||
      typeof window === 'undefined' ||
      (!this.unlocked && !this.hasStickyUserActivation()) ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.voVolume <= 0
    ) {
      callbacks?.onFallbackTimer?.();
      return () => {};
    }

    if (!isKoreanLanguage()) {
      if (callbacks?.fallbackText) {
        void this.speakTts(callbacks.fallbackText, 1.0, 0.88);
      }
      callbacks?.onFallbackTimer?.();
      return () => {
        this.cancelTts();
      };
    }

    let disposed = false;
    let settled = false;
    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    const initialCanHear =
      this.checkWindowActive() && !this.settings.muted && this.settings.voVolume > 0;
    audio.muted = !initialCanHear;
    audio.volume = initialCanHear ? Math.min(1, this.settings.voVolume) : 0;
    this.currentStoryAudio = audio;

    if (this.currentBgm && !this.settings.muted) {
      this.currentBgm.volume = this.settings.bgmVolume * 0.42;
    }

    const restoreBgm = () => {
      if (this.currentBgm && !this.settings.muted) {
        this.currentBgm.volume = this.settings.bgmVolume;
      }
    };

    const emitProgress = () => {
      if (disposed) return;
      const canHearNow =
        this.checkWindowActive() && !this.settings.muted && this.settings.voVolume > 0;
      audio.muted = !canHearNow;
      audio.volume = canHearNow ? Math.min(1, this.settings.voVolume) : 0;
      if (typeof document !== 'undefined' && document.hidden && !audio.paused) {
        try {
          audio.pause();
        } catch {
          // ignore
        }
      }
      if (!callbacks?.onProgress) return;
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      if (dur > 0) {
        const cur = Math.min(dur, Math.max(0, audio.currentTime || 0));
        callbacks.onProgress(cur / dur, Math.max(0, dur - cur), dur);
      }
    };

    const pollId = window.setInterval(emitProgress, 45);

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      window.clearInterval(pollId);
      audio.onloadedmetadata = null;
      audio.ontimeupdate = null;
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
        audio.src = '';
      } catch {
        // ignore
      }
      if (this.currentStoryAudio === audio) {
        this.currentStoryAudio = null;
        this.currentStoryCleanup = null;
        restoreBgm();
      }
    };

    this.currentStoryCleanup = cleanup;

    audio.onloadedmetadata = emitProgress;
    audio.ontimeupdate = emitProgress;
    audio.onended = () => {
      if (disposed || settled) return;
      settled = true;
      const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 5;
      callbacks?.onProgress?.(1, 0, dur);
      cleanup();
      callbacks?.onEnded?.();
    };
    audio.onerror = () => {
      if (disposed || settled) return;
      settled = true;
      cleanup();
      callbacks?.onFallbackTimer?.();
    };

    audio.play().catch(() => {
      if (disposed || settled) return;
      settled = true;
      cleanup();
      callbacks?.onFallbackTimer?.();
    });

    return cleanup;
  }

  pauseStoryNarration() {
    this.storyManuallyPaused = true;
    if (this.currentStoryAudio && !this.currentStoryAudio.paused) {
      try {
        this.currentStoryAudio.pause();
      } catch {
        // ignore
      }
    }
  }

  resumeStoryNarration() {
    this.storyManuallyPaused = false;
    if (
      this.currentStoryAudio &&
      this.checkWindowActive() &&
      !this.settings.muted &&
      this.settings.voVolume > 0 &&
      this.currentStoryAudio.paused &&
      !this.currentStoryAudio.ended
    ) {
      this.currentStoryAudio.muted = false;
      this.currentStoryAudio.volume = Math.min(1, this.settings.voVolume);
      this.currentStoryAudio.play().catch(() => {});
    }
  }

  stopStoryNarration() {
    this.storyManuallyPaused = false;
    const fn = this.currentStoryCleanup;
    this.currentStoryCleanup = null;
    if (fn) {
      fn();
    } else if (this.currentStoryAudio) {
      try {
        this.currentStoryAudio.pause();
        this.currentStoryAudio.src = '';
      } catch {
        // ignore
      }
      this.currentStoryAudio = null;
    }
  }

  private loadHeroNameVoMap(): Promise<Record<string, string>> {
    if (!this.heroNameVoMapPromise) {
      this.heroNameVoMapPromise = fetch('/hs-assets/snshero-audio/story/hero_name_vo_map.json')
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}));
    }
    return this.heroNameVoMapPromise;
  }

  private playCustomVoUrl(url: string, preloaded?: HTMLAudioElement): Promise<void> {
    if (
      (!this.unlocked && !this.hasStickyUserActivation()) ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.voVolume <= 0
    ) {
      return Promise.resolve();
    }
    this.cancelActiveVo();
    const versionedUrl = this.withVoVersion(url);
    return new Promise((resolve) => {
      try {
        const a = preloaded || new Audio(versionedUrl);
        a.volume = Math.min(1, this.settings.voVolume);
        this.currentVo = a;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          a.onended = null;
          a.onerror = null;
          try {
            a.pause();
            a.src = '';
          } catch {
            // ignore
          }
          if (this.currentVo === a) {
            this.currentVo = null;
            this.currentVoResolve = null;
          }
          resolve();
        };
        this.currentVoResolve = finish;
        a.onended = finish;
        a.onerror = finish;
        a.play().catch(finish);
      } catch {
        resolve();
      }
    });
  }

  playCustomVoFile(url: string): Promise<void> {
    if (!isKoreanLanguage()) return Promise.resolve();
    return this.playCustomVoUrl(url);
  }

  private trimAudioBufferSilence(ctx: AudioContext, buf: AudioBuffer): AudioBuffer {
    const sr = buf.sampleRate;
    const len = buf.length;
    if (len <= Math.floor(sr * 0.06)) return buf;

    const threshold = 0.0022;
    let first = len;
    let last = -1;

    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < first; i++) {
        if (Math.abs(data[i]) > threshold) {
          first = i;
          break;
        }
      }
      for (let i = len - 1; i > last; i--) {
        if (Math.abs(data[i]) > threshold) {
          last = i;
          break;
        }
      }
    }

    if (first >= last || last < 0) return buf;

    const leadPad = Math.floor(sr * 0.008);
    const tailPad = Math.floor(sr * 0.012);
    const start = Math.max(0, first - leadPad);
    const end = Math.min(len, last + 1 + tailPad);
    const trimmedLen = end - start;
    if (trimmedLen <= 0 || trimmedLen >= len - Math.floor(sr * 0.008)) return buf;

    const out = ctx.createBuffer(buf.numberOfChannels, trimmedLen, sr);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      out.copyToChannel(buf.getChannelData(ch).subarray(start, end), ch);
    }
    return out;
  }

  private loadDecodedVoBuffer(url: string, ctx: AudioContext): Promise<AudioBuffer | null> {
    const versionedUrl = this.withVoVersion(url);
    const cached = this.decodedVoBufferCache.get(versionedUrl);
    if (cached) return cached;

    const pending = fetch(versionedUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((raw) => ctx.decodeAudioData(raw))
      .then((decoded) => this.trimAudioBufferSilence(ctx, decoded))
      .catch(() => {
        this.decodedVoBufferCache.delete(versionedUrl);
        return null;
      });

    // Bound uncompressed PCM cache to <= 16 entries so mobile Safari RAM stays flat across episodes
    if (this.decodedVoBufferCache.size >= 16) {
      const oldestKey = this.decodedVoBufferCache.keys().next().value;
      if (oldestKey) this.decodedVoBufferCache.delete(oldestKey);
    }
    this.decodedVoBufferCache.set(versionedUrl, pending);
    return pending;
  }

  private async playGaplessVoSequence(
    urls: string[],
  ): Promise<'played' | 'cancelled' | 'fallback'> {
    if (
      urls.length === 0 ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.voVolume <= 0
    ) {
      return 'cancelled';
    }

    const ctx = this.getAudioCtx();
    if (!ctx) return 'fallback';

    this.cancelActiveVo();
    const token = this.voSequenceToken;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const buffers = await Promise.all(urls.map((u) => this.loadDecodedVoBuffer(u, ctx)));
    if (
      this.voSequenceToken !== token ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.voVolume <= 0
    ) {
      return 'cancelled';
    }
    if (ctx.state !== 'running' || buffers.some((b) => !b)) {
      return 'fallback';
    }

    const validBuffers = buffers as AudioBuffer[];

    return new Promise<'played' | 'cancelled' | 'fallback'>((resolve) => {
      let settled = false;
      let timerId: number | null = null;
      const sources: AudioBufferSourceNode[] = [];
      const gain = ctx.createGain();
      gain.gain.value = Math.min(1, this.settings.voVolume);
      gain.connect(ctx.destination);

      const cleanup = (outcome: 'played' | 'cancelled' | 'fallback') => {
        if (settled) return;
        settled = true;
        if (timerId !== null) {
          window.clearTimeout(timerId);
          timerId = null;
        }
        if (this.currentVoSequenceCancel === cancelHandler) {
          this.currentVoSequenceCancel = null;
        }
        for (const s of sources) {
          s.onended = null;
          try {
            s.stop();
          } catch {
            // ignore
          }
          try {
            s.disconnect();
          } catch {
            // ignore
          }
        }
        try {
          gain.disconnect();
        } catch {
          // ignore
        }
        resolve(outcome);
      };

      const cancelHandler = () => cleanup('cancelled');
      this.currentVoSequenceCancel = cancelHandler;

      let cursor = ctx.currentTime + 0.012;
      for (const buf of validBuffers) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(gain);
        src.start(cursor);
        cursor += buf.duration;
        sources.push(src);
      }

      const lastSrc = sources[sources.length - 1];
      if (!lastSrc) {
        cleanup('fallback');
        return;
      }

      lastSrc.onended = () => cleanup('played');
      const totalWaitMs = Math.max(150, Math.ceil((cursor - ctx.currentTime) * 1000) + 240);
      timerId = window.setTimeout(() => cleanup('played'), totalWaitMs);
    });
  }

  private async playSequentialPreloadedUrls(urls: string[]): Promise<void> {
    const preloaded = urls.map((rawUrl) => {
      const a = new Audio(this.withVoVersion(rawUrl));
      a.preload = 'auto';
      try {
        a.load();
      } catch {
        // ignore
      }
      return { url: rawUrl, audio: a };
    });

    for (const item of preloaded) {
      if (!this.checkWindowActive() || this.settings.muted) return;
      await this.playCustomVoUrl(item.url, item.audio);
    }
  }

  /**
   * Web Speech API 폴백 (스튜디오 MP3가 없는 동적 텍스트 전용 — 남성 음색 우선 선택)
   */
  speakTts(text: string, rate = 1.0, pitch = 0.82): Promise<void> {
    if (
      !this.settings.ttsEnabled ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.voVolume <= 0
    ) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      try {
        const isKo = isKoreanLanguage();
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = isKo ? 'ko-KR' : 'en-US';
        u.rate = rate;
        u.pitch = pitch;
        u.volume = Math.min(1, this.settings.voVolume);

        if (isKo) {
          const koVoices = voices.filter(
            (v) => v.lang.startsWith('ko') || v.lang.includes('KR') || v.lang.includes('Korean'),
          );
          const maleKoVoice =
            koVoices.find((v) =>
              /InJoon|Hyunsu|BongJin|GookMin|Male|Eddy|Reed|Rocko|Grandpa|Minsu|Jinho/i.test(
                v.name,
              ),
            ) ||
            koVoices.find((v) => !/Yuna|Sora|SunHi|Heami|Female/i.test(v.name)) ||
            koVoices[0];
          if (maleKoVoice) {
            u.voice = maleKoVoice;
          }
        } else {
          const enVoices = voices.filter((v) => v.lang.startsWith('en'));
          const maleEnVoice =
            enVoices.find((v) =>
              /Daniel|David|Alex|Aaron|Fred|Guy|Christopher|Eric|Arthur|Ryan|Male|Eddy|Reed|Rocko/i.test(
                v.name,
              ),
            ) ||
            enVoices.find((v) => !/Samantha|Victoria|Karen|Moira|Tessa|Zira|Female/i.test(v.name)) ||
            enVoices[0];
          if (maleEnVoice) {
            u.voice = maleEnVoice;
          }
        }

        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          resolve();
        };

        u.onend = done;
        u.onerror = done;
        window.setTimeout(done, Math.max(9000, text.length * 280));
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });
  }

  cancelTts() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  async playMatchupAnnouncement(
    playerClass: HeroClass,
    opponentClass: HeroClass,
    playerName?: string,
    opponentName?: string,
    _isPlayerCustom = false,
    _isOpponentCustom = false,
  ) {
    if (
      (!this.unlocked && !this.hasStickyUserActivation()) ||
      !this.checkWindowActive() ||
      this.settings.muted ||
      this.settings.voVolume <= 0
    ) {
      return;
    }
    const isKo = isKoreanLanguage();
    const pShort = extractShortHeroCalloutName(playerName, playerClass, isKo);
    const oShort = extractShortHeroCalloutName(opponentName, opponentClass, isKo);

    if (!isKo) {
      await this.speakTts(`${pShort} versus ${oShort}`, 1.0, 0.86);
      return;
    }

    const map = await this.loadHeroNameVoMap();
    if (!this.checkWindowActive() || this.settings.muted) return;

    const pUrl = this.settings.ttsEnabled && map[pShort] ? this.withVoVersion(map[pShort]) : null;
    const oUrl = this.settings.ttsEnabled && map[oShort] ? this.withVoVersion(map[oShort]) : null;
    const versusUrl = this.withVoVersion('/hs-assets/snshero-audio/vo/announcer_versus.mp3');

    // 모든 표준/스토리 캐릭터는 3클립(플레이어 → 대! → 상대방)을 공백 없이 Web Audio로 연속 스케줄링 재생
    if (pUrl && oUrl) {
      const outcome = await this.playGaplessVoSequence([pUrl, versusUrl, oUrl]);
      if (outcome === 'fallback' && this.checkWindowActive() && !this.settings.muted) {
        await this.playSequentialPreloadedUrls([pUrl, versusUrl, oUrl]);
      }
      return;
    }

    // 일부 커스텀 이름 등 맵에 없는 이름이 섞인 경우에도 스튜디오 클립 구간은 공백 없이 연결
    if (pUrl) {
      const outcome = await this.playGaplessVoSequence([pUrl, versusUrl]);
      if (outcome === 'cancelled') return;
      if (outcome === 'fallback' && this.checkWindowActive() && !this.settings.muted) {
        await this.playSequentialPreloadedUrls([pUrl, versusUrl]);
      }
    } else {
      if (this.settings.ttsEnabled) {
        await this.speakTts(pShort, 1.0, 0.82);
      }
      if (!this.checkWindowActive() || this.settings.muted) return;
      await this.playCustomVoUrl(versusUrl);
    }

    if (!this.checkWindowActive() || this.settings.muted) return;

    if (oUrl) {
      await this.playCustomVoUrl(oUrl);
    } else if (this.settings.ttsEnabled) {
      await this.speakTts(oShort, 1.0, 0.82);
    }
  }
}

const SHORT_KO_NAME_ALIASES: Record<string, string> = {
  '바람신 토람': '토람',
  '훈련용 허수아비 로봇': '허수아비 로봇',
  '감옥장 메두사 고르고': '고르고',
  '메두사 고르고': '고르고',
  '아다만티움 수호거신': '수호거신',
  이그니시우스: '이그니스',
};

const SHORT_EN_NAME_ALIASES: Record<string, string> = {
  'Training Scarecrow Bot': 'Scarecrow Bot',
  'Kadan, Shield of Elwin': 'Kadan',
  'Warden Medusa Gorgo': 'Gorgo',
  'Medusa Gorgo': 'Gorgo',
  'Adamantium Guardian': 'Guardian',
};

/**
 * 대전 시작 전 아나운서 호명이 길어지지 않도록 수식어·직함을 제거한 짧은 캐릭터 이름만 추출합니다.
 */
export function extractShortHeroCalloutName(
  rawName: string | undefined,
  heroClass: HeroClass,
  isKo: boolean,
): string {
  const trimmed = (rawName || '').trim();
  if (!trimmed) {
    const fallback = isKo
      ? CLASSIC_HEROES[heroClass]?.nameKo
      : getLocalizedHeroInfo(heroClass, 'en').name;
    return isKo
      ? SHORT_KO_NAME_ALIASES[fallback] || fallback || heroClass
      : SHORT_EN_NAME_ALIASES[fallback] || fallback || heroClass;
  }

  if (isKo) {
    if (SHORT_KO_NAME_ALIASES[trimmed]) return SHORT_KO_NAME_ALIASES[trimmed];
    if (/AI대전 상대|연습/i.test(trimmed)) {
      const clsName = CLASSIC_HEROES[heroClass]?.nameKo || '';
      return SHORT_KO_NAME_ALIASES[clsName] || clsName || trimmed;
    }
    const parts = trimmed.split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : trimmed;
  }

  if (SHORT_EN_NAME_ALIASES[trimmed]) return SHORT_EN_NAME_ALIASES[trimmed];
  if (/AI Challenger/i.test(trimmed)) {
    return getLocalizedHeroInfo(heroClass, 'en').name || heroClass;
  }
  const beforeComma = trimmed.split(',')[0].trim();
  const enParts = beforeComma.split(/\s+/);
  return enParts.length > 1 ? enParts[enParts.length - 1] : beforeComma;
}

export const hsAudio = new SnsHeroCardAudioEngine();
