/**
 * SNSHero Ocarina & Rhythm Cue Synthesis Engine
 *
 * Lightweight WebAudio synthesizer & rhythm helpers powering:
 * - 9-Faction signature instrument chords (Ocarina, Harp, Forge Bell, Marimba, Lute, Brass)
 * - 4-Keyword rhythmic percussion (Divine Shield, Taunt, Charge, Deathrattle)
 * - Mulligan 4-beat Count-In, Cadence beats, 3x Awakening Trill, Lethal Finale,
 *   Rope Metronome, Fatigue Heartbeat, Board Aura Xylophone, AoE Wave, Leeroy Horn,
 *   Pack 5-Beat Flip, and Bogart Wager Coin Pitch.
 * - 30-card Deck Mana Curve Groove Classifier & Battle Resonance Grade (S / A / B).
 */

export type RhythmCueKind =
  | 'mulligan_count_1'
  | 'mulligan_count_2'
  | 'mulligan_count_3'
  | 'mulligan_start'
  | 'enemy_guard_parry'
  | 'hero_power_cadence'
  | 'turn_end_cadence'
  | 'combo_arpeggio'
  | 'lethal_finale'
  | 'awakening_3x_trill'
  | 'pack_flip_beat'
  | 'fairy_relief_3beat'
  | 'spell_power_lute'
  | 'draw_weapon_ping'
  | 'ultimate_choir_drop'
  | 'hand_full_heartbeat'
  | 'fatigue_heartbeat'
  | 'aura_xylophone'
  | 'board_full_brass'
  | 'rope_metronome'
  | 'aoe_panorama_wave'
  | 'leeroy_horn_finish'
  | 'emote_beat'
  | 'wager_coin_pitch';

export type RhythmKeywordType = 'DIVINE_SHIELD' | 'TAUNT' | 'CHARGE' | 'DEATHRATTLE';

export interface DeckGrooveProfile {
  id: 'AGGRO_RUSH' | 'TEMPO_SWING' | 'CONTROL_SYMPHONY';
  bpm: number;
  labelKo: string;
  labelEn: string;
  avgMana: number;
}

export interface RhythmBattleGrade {
  grade: 'S' | 'A' | 'B';
  accuracyPct: number;
  summaryKo: string;
  summaryEn: string;
}

let sharedCtx: AudioContext | null = null;

function getSafeAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedCtx) {
      sharedCtx = new AudioCtx();
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

function playTone(
  freq: number,
  durationSec: number,
  opts: {
    type?: OscillatorType;
    gain?: number;
    delaySec?: number;
    endFreq?: number;
  } = {},
): void {
  const ctx = getSafeAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime + (opts.delaySec ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    if (opts.endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), now + durationSec);
    }
    const peak = Math.min(0.18, Math.max(0.01, opts.gain ?? 0.06));
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.014);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  } catch {
    // ignore audio decode/autoplay errors
  }
}

const FACTION_CHORDS: Record<string, { freqs: number[]; type: OscillatorType }> = {
  PRIEST: { freqs: [523.25, 659.25, 783.99], type: 'sine' }, // Human Kadan — Ocarina C Major
  MAGE: { freqs: [587.33, 739.99, 880.0], type: 'triangle' }, // Elf Silia — Harp D Major
  WARRIOR: { freqs: [220.0, 329.63, 440.0], type: 'sawtooth' }, // Dwarf — Forge Bell A5
  HUNTER: { freqs: [392.0, 493.88, 587.33], type: 'triangle' }, // Fairy — Marimba G Major
  WARLOCK: { freqs: [246.94, 293.66, 369.99], type: 'sawtooth' }, // Abyss — Dark Chord Bm
  PALADIN: { freqs: [440.0, 554.37, 659.25], type: 'sine' }, // Dragon — Radiant A Major
  ROGUE: { freqs: [329.63, 392.0, 493.88], type: 'triangle' }, // Vampire — Em Pluck
  SHAMAN: { freqs: [293.66, 349.23, 440.0], type: 'square' }, // Orc — Tribal Dm
  DRUID: { freqs: [349.23, 440.0, 523.25], type: 'sine' }, // Goblin/Nature — F Major
};

export function playFactionChord(heroClass: string, muted = false): void {
  if (muted) return;
  const spec = FACTION_CHORDS[heroClass.toUpperCase()] || FACTION_CHORDS.PRIEST;
  spec.freqs.forEach((f, idx) => {
    playTone(f, 0.24, { type: spec.type, gain: 0.042, delaySec: idx * 0.045 });
  });
}

export function playKeywordPercussion(keyword: RhythmKeywordType, muted = false): void {
  if (muted) return;
  switch (keyword) {
    case 'DIVINE_SHIELD':
      playTone(1046.5, 0.22, { type: 'sine', gain: 0.06, endFreq: 1318.5 });
      break;
    case 'TAUNT':
      playTone(146.83, 0.2, { type: 'triangle', gain: 0.08, endFreq: 98.0 });
      break;
    case 'CHARGE':
      playTone(392.0, 0.14, { type: 'sawtooth', gain: 0.05, endFreq: 784.0 });
      break;
    case 'DEATHRATTLE':
      playTone(261.63, 0.26, { type: 'triangle', gain: 0.055, endFreq: 130.81 });
      break;
  }
}

export function playRhythmCue(
  kind: RhythmCueKind,
  opts: { muted?: boolean; pitchFactor?: number; comboStep?: number } = {},
): void {
  if (opts.muted) return;
  const pf = Math.max(0.5, Math.min(2.2, opts.pitchFactor ?? 1));
  switch (kind) {
    case 'mulligan_count_1':
      playTone(523.25, 0.14, { type: 'sine', gain: 0.06 });
      break;
    case 'mulligan_count_2':
      playTone(587.33, 0.14, { type: 'sine', gain: 0.065 });
      break;
    case 'mulligan_count_3':
      playTone(659.25, 0.14, { type: 'sine', gain: 0.07 });
      break;
    case 'mulligan_start':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        playTone(f, 0.22, { type: 'sine', gain: 0.06, delaySec: i * 0.04 }),
      );
      break;
    case 'enemy_guard_parry':
      playTone(659.25, 0.14, { type: 'triangle', gain: 0.06, endFreq: 880 });
      break;
    case 'hero_power_cadence':
      playTone(440, 0.12, { type: 'sine', gain: 0.05 });
      playTone(659.25, 0.18, { type: 'sine', gain: 0.055, delaySec: 0.06 });
      break;
    case 'turn_end_cadence':
      playTone(587.33, 0.1, { type: 'triangle', gain: 0.05 });
      playTone(440, 0.16, { type: 'triangle', gain: 0.05, delaySec: 0.07 });
      break;
    case 'combo_arpeggio': {
      const step = Math.min(8, Math.max(0, opts.comboStep ?? 1));
      const base = 392 * Math.pow(1.059463, step * 2);
      playTone(base, 0.14, { type: 'sine', gain: 0.055, endFreq: base * 1.12 });
      break;
    }
    case 'lethal_finale':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        playTone(f, 0.34, { type: 'triangle', gain: 0.075, delaySec: i * 0.07 }),
      );
      break;
    case 'awakening_3x_trill':
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        playTone(f, 0.2, { type: 'sine', gain: 0.07, delaySec: i * 0.055 }),
      );
      break;
    case 'pack_flip_beat': {
      const idx = Math.min(5, Math.max(0, opts.comboStep ?? 0));
      const notes = [523.25, 587.33, 659.25, 783.99, 1046.5];
      playTone(notes[idx % notes.length] * pf, 0.18, { type: 'sine', gain: 0.065 });
      break;
    }
    case 'fairy_relief_3beat':
      [587.33, 739.99, 880].forEach((f, i) =>
        playTone(f, 0.18, { type: 'sine', gain: 0.06, delaySec: i * 0.09 }),
      );
      break;
    case 'spell_power_lute':
      [329.63, 493.88, 659.25].forEach((f, i) =>
        playTone(f, 0.22, { type: 'triangle', gain: 0.055, delaySec: i * 0.035 }),
      );
      break;
    case 'draw_weapon_ping':
      playTone(740, 0.12, { type: 'sine', gain: 0.05, endFreq: 987.77 });
      break;
    case 'ultimate_choir_drop':
      [261.63, 392.0, 523.25, 659.25].forEach((f) =>
        playTone(f, 0.45, { type: 'sine', gain: 0.045 }),
      );
      break;
    case 'hand_full_heartbeat':
    case 'fatigue_heartbeat':
      playTone(92, 0.12, { type: 'sine', gain: 0.09, endFreq: 60 });
      playTone(84, 0.14, { type: 'sine', gain: 0.07, delaySec: 0.16, endFreq: 55 });
      break;
    case 'aura_xylophone':
      [523.25, 659.25, 783.99, 987.77].forEach((f, i) =>
        playTone(f, 0.12, { type: 'sine', gain: 0.045, delaySec: i * 0.045 }),
      );
      break;
    case 'board_full_brass':
      [293.66, 440, 587.33].forEach((f) => playTone(f, 0.3, { type: 'sawtooth', gain: 0.035 }));
      break;
    case 'rope_metronome':
      playTone(880, 0.05, { type: 'square', gain: 0.035 });
      break;
    case 'aoe_panorama_wave':
      playTone(220, 0.35, { type: 'triangle', gain: 0.06, endFreq: 660 });
      break;
    case 'leeroy_horn_finish':
      [392, 523.25, 659.25].forEach((f, i) =>
        playTone(f, 0.22, { type: 'sawtooth', gain: 0.055, delaySec: i * 0.08 }),
      );
      break;
    case 'emote_beat':
      playTone(523.25 * pf, 0.1, { type: 'sine', gain: 0.04 });
      break;
    case 'wager_coin_pitch':
      playTone(620 * pf, 0.09, { type: 'sine', gain: 0.05, endFreq: 860 * pf });
      break;
  }
}

export function computeDeckGrooveProfile(costs: number[]): DeckGrooveProfile {
  if (!costs.length) {
    return {
      id: 'TEMPO_SWING',
      bpm: 128,
      labelKo: '밸런스 템포 · 128 BPM',
      labelEn: 'Balanced Tempo · 128 BPM',
      avgMana: 3.2,
    };
  }
  const avg = Math.round((costs.reduce((a, b) => a + b, 0) / costs.length) * 10) / 10;
  if (avg <= 2.9) {
    return {
      id: 'AGGRO_RUSH',
      bpm: 140,
      labelKo: '속공 러시 그루브 · 140 BPM',
      labelEn: 'Aggro Rush Groove · 140 BPM',
      avgMana: avg,
    };
  }
  if (avg >= 4.0) {
    return {
      id: 'CONTROL_SYMPHONY',
      bpm: 116,
      labelKo: '묵직한 컨트롤 교향곡 · 116 BPM',
      labelEn: 'Control Symphony · 116 BPM',
      avgMana: avg,
    };
  }
  return {
    id: 'TEMPO_SWING',
    bpm: 128,
    labelKo: '미드레인지 스윙 · 128 BPM',
    labelEn: 'Midrange Swing · 128 BPM',
    avgMana: avg,
  };
}

export function gradeRhythmPerformance(greenHits: number, totalTaps: number): RhythmBattleGrade {
  const safeTotal = Math.max(1, totalTaps);
  const accuracyPct = totalTaps === 0 ? 100 : Math.min(100, Math.round((greenHits / safeTotal) * 100));
  if (greenHits >= 6 || (totalTaps >= 3 && accuracyPct >= 80)) {
    return {
      grade: 'S',
      accuracyPct,
      summaryKo: `오카리나 공명 S등급 · 정박 ${greenHits}회 (${accuracyPct}%)`,
      summaryEn: `Ocarina Resonance Rank S · ${greenHits} On-Beat (${accuracyPct}%)`,
    };
  }
  if (greenHits >= 2 || accuracyPct >= 50) {
    return {
      grade: 'A',
      accuracyPct,
      summaryKo: `오카리나 공명 A등급 · 정박 ${greenHits}회 (${accuracyPct}%)`,
      summaryEn: `Ocarina Resonance Rank A · ${greenHits} On-Beat (${accuracyPct}%)`,
    };
  }
  return {
    grade: 'B',
    accuracyPct,
    summaryKo: `오카리나 공명 B등급 · 다음 판에서 초록 링 정박에 도전하세요!`,
    summaryEn: `Ocarina Resonance Rank B · Tap on the green ring next duel!`,
  };
}

/**
 * Compute Bluetooth audio sync offset in ms (clamped to -200..+200ms) from 3 user taps
 * against a 128 BPM (468.75ms) reference click.
 */
export function computeBluetoothSyncOffsetMs(tapIntervalsMs: number[], targetBeatMs = 468.75): number {
  if (tapIntervalsMs.length === 0) return 0;
  const diffs = tapIntervalsMs.map((t) => {
    const mod = ((t % targetBeatMs) + targetBeatMs) % targetBeatMs;
    return mod > targetBeatMs / 2 ? mod - targetBeatMs : mod;
  });
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return Math.max(-200, Math.min(200, Math.round(avg)));
}
