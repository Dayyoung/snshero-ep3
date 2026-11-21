import React, { useEffect, useRef } from 'react';
import { isKoreanLanguage, tr } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { elementCenterInStage, getStageSize } from '../stageCoords';
import { VfxEvent } from '../types';

interface BoardVfxCanvasProps {
  events: VfxEvent[];
  onDamageImpact?: (damage: number, opts?: { isFinisher?: boolean }) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity?: number;
  shape?: 'CIRCLE' | 'SHARD' | 'RING' | 'STAR';
}

interface Projectile {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  speed: number;
  colorCore: string;
  colorGlow: string;
  radius: number;
  kind: VfxEvent['kind'];
  onImpactDone?: boolean;
}

interface FloatingBadge {
  x: number;
  y: number;
  vy: number;
  text: string;
  subKind: 'DAMAGE' | 'HEAL' | 'ARMOR' | 'BUFF' | 'BANNER' | 'SKULL';
  life: number;
  maxLife: number;
}

interface ElementalImpact {
  kind: 'FROST_PRISON' | 'AERO_SLASH' | 'WIND_DOME' | 'VITAL_UPDRAFT';
  x: number;
  y: number;
  life: number;
  maxLife: number;
  scale: number;
}

interface BlizzardFlake {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vRot: number;
  depth: 0 | 1 | 2; // 0=far flurry, 1=mid snow, 2=foreground ornate 6-branch ice crystal
  swayPhase: number;
}

interface BlizzardSleet {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

interface IceSpear {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  delay: number;
  dur: number;
  scale: number;
  impacted: boolean;
}

interface WindBlade {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  tilt: number;
  thickness: number;
  hue: 'WHITE' | 'MINT' | 'JADE';
}

interface WindLeaf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vRot: number;
  spin: number;
  vSpin: number;
  color: string;
}

interface WindTornado {
  x0: number;
  x1: number;
  baseY: number;
  height: number;
  footRadius: number;
  mouthRadius: number;
  phase: number;
}

interface UltimateStorm {
  kind: 'KADAN_BLIZZARD' | 'SILIA_WINDSTORM';
  subVariant?: 'ATTACK' | 'DEFENSE' | 'HEAL';
  life: number;
  maxLife: number;
  tier: number;
  flakes: BlizzardFlake[];
  sleets: BlizzardSleet[];
  spears: IceSpear[];
  blades: WindBlade[];
  leaves: WindLeaf[];
  tornadoes: WindTornado[];
}

const lastKnownEntityCenters = new Map<string, { x: number; y: number }>();

export function recordEntityStagePosition(entityId: string, pos: { x: number; y: number }): void {
  lastKnownEntityCenters.set(entityId, pos);
}

function getEntityCenter(entityId?: string): { x: number; y: number } {
  const { width: w, height: h } = getStageSize();
  if (!entityId) return { x: w * 0.5, y: h * 0.46 };

  const el = document.querySelector(`[data-hs-entity="${entityId}"]`);
  if (el) {
    const pos = elementCenterInStage(el);
    lastKnownEntityCenters.set(entityId, pos);
    return pos;
  }

  const cached = lastKnownEntityCenters.get(entityId);
  if (cached) return cached;

  if (entityId === 'PLAYER_HERO') return { x: w * 0.5, y: h * 0.77 };
  if (entityId === 'OPPONENT_HERO') return { x: w * 0.5, y: h * 0.17 };
  if (entityId === 'SILIA_WIDGET') return { x: w * 0.14, y: h * 0.86 };
  if (entityId === 'KADAN_WIDGET') return { x: w * 0.08, y: h * 0.86 };
  if (entityId === 'PLAYER_DECK') return { x: w * 0.94, y: h * 0.62 };
  if (entityId === 'OPPONENT_DECK') return { x: w * 0.94, y: h * 0.31 };
  if (entityId === 'TOY_TL') return { x: w * 0.08, y: h * 0.12 };
  if (entityId === 'TOY_TR') return { x: w * 0.92, y: h * 0.12 };
  if (entityId === 'TOY_BL') return { x: w * 0.08, y: h * 0.82 };
  if (entityId === 'TOY_BR') return { x: w * 0.92, y: h * 0.82 };
  return { x: w * 0.5, y: h * 0.46 };
}

function detectLowPowerDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 8;
  return cores <= 4 || mem <= 4 || window.innerWidth < 640;
}

const LOW_POWER_DEVICE = detectLowPowerDevice();
const MAX_ACTIVE_PARTICLES = LOW_POWER_DEVICE ? 34 : 60;
// Pre-calculated 8-point blood splat polygon vertices for zero-trig damage pop render
const DAMAGE_SPLAT_OCTAGON = [
  { x: 26, y: 0 },
  { x: 12, y: 12 },
  { x: 0, y: 26 },
  { x: -12, y: 12 },
  { x: -26, y: 0 },
  { x: -12, y: -12 },
  { x: 0, y: -26 },
  { x: 12, y: -12 },
];

export const BoardVfxCanvas: React.FC<BoardVfxCanvasProps> = React.memo(({ events, onDamageImpact }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const particlesRef = useRef<Particle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const badgesRef = useRef<FloatingBadge[]>([]);
  const elementalImpactsRef = useRef<ElementalImpact[]>([]);
  const ultimateStormsRef = useRef<UltimateStorm[]>([]);
  const impactCbRef = useRef(onDamageImpact);
  impactCbRef.current = onDamageImpact;

  const rafIdRef = useRef<number>(0);
  const ensureLoopRef = useRef<() => void>(() => {});

  const spawnSiliaWindstormUltimate = (
    stageW: number,
    stageH: number,
    tier = 1,
    subVariant: 'ATTACK' | 'DEFENSE' | 'HEAL' = 'ATTACK',
  ) => {
    const blades: WindBlade[] = [];
    const bladeCount = Math.min(24, 15 + tier * 3);
    const hues: WindBlade['hue'][] = ['WHITE', 'MINT', 'JADE'];
    for (let i = 0; i < bladeCount; i++) {
      blades.push({
        x: -stageW * 0.2 - Math.random() * stageW * 0.9,
        y: stageH * (0.08 + ((i * 0.067 + Math.random() * 0.08) % 0.72)),
        vx: 22 + Math.random() * 14,
        vy: -2.2 + (Math.random() - 0.5) * 3.4,
        radius: 34 + Math.random() * 38,
        tilt: -0.22 + (Math.random() - 0.5) * 0.28,
        thickness: 6 + Math.random() * 6,
        hue: hues[i % 3],
      });
    }

    const leafPalette = ['#ecfdf5', '#a7f3d0', '#34d399', '#10b981', '#86efac'];
    const leaves: WindLeaf[] = [];
    const leafCount = Math.min(72, 48 + tier * 6);
    for (let i = 0; i < leafCount; i++) {
      leaves.push({
        x: Math.random() * stageW * 1.3 - stageW * 0.2,
        y: stageH * (0.04 + Math.random() * 0.84),
        vx: 13 + Math.random() * 12,
        vy: -2.6 + (Math.random() - 0.5) * 4.5,
        size: 6 + Math.random() * 8.5,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.22,
        spin: Math.random() * Math.PI * 2,
        vSpin: 0.16 + Math.random() * 0.18,
        color: leafPalette[i % leafPalette.length],
      });
    }

    const tornadoes: WindTornado[] = [
      {
        x0: stageW * 0.12,
        x1: stageW * 0.86,
        baseY: stageH * 0.68,
        height: stageH * 0.62,
        footRadius: Math.max(18, stageW * 0.028),
        mouthRadius: Math.max(76, stageW * 0.13),
        phase: 0,
      },
      {
        x0: stageW * 0.34,
        x1: stageW * 0.96,
        baseY: stageH * 0.54,
        height: stageH * 0.5,
        footRadius: Math.max(14, stageW * 0.022),
        mouthRadius: Math.max(62, stageW * 0.105),
        phase: 2.15,
      },
      {
        x0: -stageW * 0.02,
        x1: stageW * 0.66,
        baseY: stageH * 0.58,
        height: stageH * 0.52,
        footRadius: Math.max(15, stageW * 0.024),
        mouthRadius: Math.max(66, stageW * 0.11),
        phase: 4.3,
      },
    ];

    ultimateStormsRef.current.push({
      kind: 'SILIA_WINDSTORM',
      subVariant,
      life: 0,
      maxLife: 88,
      tier,
      flakes: [],
      sleets: [],
      spears: [],
      blades,
      leaves,
      tornadoes,
    });
    ensureLoopRef.current();
  };

  const spawnKadanBlizzardUltimate = (stageW: number, stageH: number, tier = 1) => {
    const flakes: BlizzardFlake[] = [];
    const flakeCount = Math.min(135, 96 + tier * 10);
    for (let i = 0; i < flakeCount; i++) {
      const depth: 0 | 1 | 2 = i % 7 === 0 ? 2 : i % 2 === 0 ? 1 : 0;
      const spdMult = depth === 2 ? 1.25 : depth === 1 ? 1.0 : 0.78;
      flakes.push({
        x: Math.random() * stageW * 1.45 - stageW * 0.1,
        y: Math.random() * stageH * 1.15 - stageH * 0.25,
        vx: -(13 + Math.random() * 11) * spdMult,
        vy: (7.5 + Math.random() * 6.5) * spdMult,
        size:
          depth === 2
            ? 11 + Math.random() * 9
            : depth === 1
              ? 6 + Math.random() * 7
              : 2.5 + Math.random() * 3.5,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.1,
        depth,
        swayPhase: Math.random() * Math.PI * 2,
      });
    }

    const sleets: BlizzardSleet[] = [];
    const sleetCount = Math.min(78, 56 + tier * 6);
    for (let i = 0; i < sleetCount; i++) {
      sleets.push({
        x: Math.random() * stageW * 1.5,
        y: Math.random() * stageH,
        len: 85 + Math.random() * 125,
        speed: 28 + Math.random() * 18,
        alpha: 0.4 + Math.random() * 0.55,
      });
    }

    const spears: IceSpear[] = [];
    const spearCount = Math.min(6, 4 + Math.min(2, tier));
    for (let i = 0; i < spearCount; i++) {
      const tx = stageW * (0.16 + ((i * 0.68) / Math.max(1, spearCount - 1)));
      const ty = stageH * (0.24 + (i % 2) * 0.08);
      spears.push({
        x0: tx + stageW * 0.34 + 120,
        y0: -130 - (i % 3) * 45,
        x1: tx,
        y1: ty,
        delay: i * 3.5,
        dur: 14,
        scale: 0.85 + (i % 2) * 0.18,
        impacted: false,
      });
    }

    ultimateStormsRef.current.push({
      kind: 'KADAN_BLIZZARD',
      life: 0,
      maxLife: 92,
      tier,
      flakes,
      sleets,
      spears,
      blades: [],
      leaves: [],
      tornadoes: [],
    });
    ensureLoopRef.current();
  };

  const spawnBurst = (
    x: number,
    y: number,
    count: number,
    colors: string[],
    speedMax = 7,
    sizeMax = 9,
    shape: Particle['shape'] = 'CIRCLE',
    gravity = 0.08,
  ) => {
    const curLen = particlesRef.current.length;
    if (curLen >= MAX_ACTIVE_PARTICLES) return;
    const scaled = LOW_POWER_DEVICE ? Math.max(4, Math.round(count * 0.6)) : count;
    const allowed = Math.min(scaled, MAX_ACTIVE_PARTICLES - curLen);

    for (let i = 0; i < allowed; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * speedMax;
      const maxLife = 20 + Math.random() * 20;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 3 + Math.random() * sizeMax,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0,
        maxLife,
        gravity,
        shape,
      });
    }
    ensureLoopRef.current();
  };

  const spawnRing = (x: number, y: number, color: string, maxSize = 110) => {
    particlesRef.current.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: maxSize,
      color,
      alpha: 1,
      life: 0,
      maxLife: 22,
      shape: 'RING',
    });
    ensureLoopRef.current();
  };

  useEffect(() => {
    for (const ev of events) {
      if (seenIdsRef.current.has(ev.id)) continue;
      seenIdsRef.current.add(ev.id);
      if (seenIdsRef.current.size > 400) {
        const arr = Array.from(seenIdsRef.current).slice(-200);
        seenIdsRef.current = new Set(arr);
      }

      const { width: stageW, height: stageH } = getStageSize();
      const targetPos = getEntityCenter(ev.targetId);
      const sourcePos = ev.sourceId
        ? getEntityCenter(ev.sourceId)
        : { x: stageW * 0.5, y: stageH * 0.5 };

      switch (ev.kind) {
        case 'FIREBALL':
          hsAudio.playProceduralVfxSound('FIRE');
          projectilesRef.current.push({
            x0: sourcePos.x,
            y0: sourcePos.y,
            x1: targetPos.x,
            y1: targetPos.y,
            t: 0,
            speed: 0.065,
            colorCore: '#fef08a',
            colorGlow: '#f97316',
            radius: 17,
            kind: 'FIREBALL',
          });
          break;

        case 'FROSTBOLT':
          hsAudio.playProceduralVfxSound('FROST');
          projectilesRef.current.push({
            x0: sourcePos.x,
            y0: sourcePos.y,
            x1: targetPos.x,
            y1: targetPos.y,
            t: 0,
            speed: 0.072,
            colorCore: '#e0f2fe',
            colorGlow: '#38bdf8',
            radius: 14,
            kind: 'FROSTBOLT',
          });
          break;

        case 'ARCANE_BOLT':
          projectilesRef.current.push({
            x0: sourcePos.x,
            y0: sourcePos.y,
            x1: targetPos.x,
            y1: targetPos.y,
            t: 0,
            speed: 0.085,
            colorCore: '#f5d0fe',
            colorGlow: '#c084fc',
            radius: 11,
            kind: 'ARCANE_BOLT',
          });
          break;

        case 'LIGHTNING': {
          const lDmg = Math.max(2, ev.value || 3);
          hsAudio.playProceduralVfxSound('LIGHTNING');
          hsAudio.vibrateByDamage(lDmg);
          impactCbRef.current?.(lDmg);
          spawnBurst(targetPos.x, targetPos.y, 26, ['#e0f2fe', '#60a5fa', '#facc15'], 9, 8, 'SHARD', 0.05);
          spawnRing(targetPos.x, targetPos.y, '#60a5fa', 95);
          break;
        }

        case 'SHADOW_BOLT':
          hsAudio.playProceduralVfxSound('SHADOW');
          projectilesRef.current.push({
            x0: sourcePos.x,
            y0: sourcePos.y,
            x1: targetPos.x,
            y1: targetPos.y,
            t: 0,
            speed: 0.068,
            colorCore: '#e9d5ff',
            colorGlow: '#7e22ce',
            radius: 15,
            kind: 'SHADOW_BOLT',
          });
          break;

        case 'NATURE_WRATH':
          projectilesRef.current.push({
            x0: sourcePos.x,
            y0: sourcePos.y,
            x1: targetPos.x,
            y1: targetPos.y,
            t: 0,
            speed: 0.075,
            colorCore: '#dcfce7',
            colorGlow: '#22c55e',
            radius: 14,
            kind: 'NATURE_WRATH',
          });
          break;

        case 'HOLY_LIGHT':
          hsAudio.playProceduralVfxSound('HOLY');
          spawnBurst(targetPos.x, targetPos.y, 28, ['#fef9c3', '#fde047', '#ffffff'], 5.5, 9, 'STAR', -0.05);
          spawnRing(targetPos.x, targetPos.y, '#fde047', 110);
          break;

        case 'HOLY_NOVA':
          hsAudio.playProceduralVfxSound('HOLY');
          spawnRing(stageW * 0.5, stageH * 0.45, '#fde047', 360);
          spawnBurst(
            stageW * 0.5,
            stageH * 0.45,
            18,
            ['#fef08a', '#facc15', '#ffffff'],
            8.5,
            8,
            'STAR',
            0,
          );
          break;

        case 'FLAMESTRIKE': {
          const fsDmg = Math.max(8, ev.value || 10);
          hsAudio.playProceduralVfxSound('FIRE');
          hsAudio.playSfx('big_attack', 0.85);
          hsAudio.vibrateByDamage(fsDmg);
          impactCbRef.current?.(fsDmg);
          const yBand = ev.targetId === 'PLAYER_HERO' ? stageH * 0.56 : stageH * 0.34;
          for (let i = 0; i < 5; i++) {
            const px = stageW * (0.26 + i * 0.12);
            spawnBurst(px, yBand, 8, ['#fef08a', '#fb923c', '#ef4444'], 7.5, 9, 'CIRCLE', -0.08);
            spawnRing(px, yBand, '#f97316', 80);
          }
          break;
        }

        case 'BLIZZARD': {
          const bzDmg = Math.max(4, ev.value || 5);
          hsAudio.playProceduralVfxSound('FROST');
          hsAudio.vibrateByDamage(bzDmg);
          impactCbRef.current?.(bzDmg);
          const yBand = ev.targetId === 'PLAYER_HERO' ? stageH * 0.56 : stageH * 0.34;
          const allowed = Math.min(22, MAX_ACTIVE_PARTICLES - particlesRef.current.length);
          for (let i = 0; i < allowed; i++) {
            particlesRef.current.push({
              x: stageW * (0.18 + Math.random() * 0.64),
              y: yBand - 100 + Math.random() * 50,
              vx: -2.8 + Math.random() * 1.2,
              vy: 3.5 + Math.random() * 3,
              size: 4 + Math.random() * 5,
              color: i % 2 === 0 ? '#bae6fd' : '#ffffff',
              alpha: 1,
              life: 0,
              maxLife: 26,
              shape: 'SHARD',
            });
          }
          ensureLoopRef.current();
          break;
        }

        case 'CONSECRATION': {
          const csDmg = Math.max(4, ev.value || 4);
          hsAudio.playProceduralVfxSound('HOLY');
          hsAudio.vibrateByDamage(csDmg);
          impactCbRef.current?.(csDmg);
          const yBand = ev.targetId === 'PLAYER_HERO' ? stageH * 0.58 : stageH * 0.34;
          for (let i = 0; i < 5; i++) {
            const px = stageW * (0.26 + i * 0.12);
            spawnBurst(px, yBand, 5, ['#fef08a', '#f59e0b', '#ffffff'], 5.5, 7, 'STAR', -0.06);
          }
          spawnRing(stageW * 0.5, yBand, '#fbbf24', 300);
          break;
        }

        case 'WHIRLWIND':
          hsAudio.playSfx('whoosh', 0.9);
          hsAudio.vibrateByDamage(Math.max(2, ev.value || 3));
          impactCbRef.current?.(Math.max(2, ev.value || 3));
          spawnRing(stageW * 0.5, stageH * 0.45, '#cbd5e1', 280);
          spawnBurst(stageW * 0.5, stageH * 0.45, 16, ['#f8fafc', '#94a3b8'], 9, 5, 'SHARD', 0);
          break;

        case 'SILIA_WIND_DEFENSE': {
          const isStageSummary = ev.targetId === 'PLAYER_HERO';
          if (isStageSummary) {
            hsAudio.playSfx('whoosh', 0.98);
            hsAudio.playSfx('big_attack', 0.85);
            hsAudio.playProceduralVfxSound('HOLY');
            hsAudio.vibrateByDamage(10);
            impactCbRef.current?.(12);
            spawnSiliaWindstormUltimate(stageW, stageH, Math.max(1, ev.value || 1), 'DEFENSE');
          } else {
            elementalImpactsRef.current.push({
              kind: 'WIND_DOME',
              x: targetPos.x,
              y: targetPos.y,
              life: 0,
              maxLife: 48,
              scale: 1,
            });
            badgesRef.current.push({
              x: targetPos.x,
              y: targetPos.y - 24,
              vy: -0.75,
              text: ev.label || (tr('🛡 바람 보호막!', '🛡 Wind Shield!')),
              subKind: 'BUFF',
              life: 0,
              maxLife: 54,
            });
          }
          ensureLoopRef.current();
          break;
        }

        case 'SILIA_WIND_ATTACK': {
          const isStageSummary = ev.targetId === 'OPPONENT_HERO';
          if (isStageSummary) {
            hsAudio.playSfx('whoosh', 1.0);
            hsAudio.playSfx('big_attack', 0.95);
            hsAudio.vibrateByDamage(12);
            impactCbRef.current?.(14);
            spawnSiliaWindstormUltimate(stageW, stageH, Math.max(2, ev.value || 2), 'ATTACK');
            const enemyHeroPt = getEntityCenter('OPPONENT_HERO');
            elementalImpactsRef.current.push({
              kind: 'AERO_SLASH',
              x: enemyHeroPt.x,
              y: enemyHeroPt.y,
              life: 0,
              maxLife: 42,
              scale: 1.45,
            });
          } else {
            elementalImpactsRef.current.push({
              kind: 'AERO_SLASH',
              x: targetPos.x,
              y: targetPos.y,
              life: 0,
              maxLife: 38,
              scale: 1.05,
            });
          }
          ensureLoopRef.current();
          break;
        }

        case 'SILIA_WIND_HEAL': {
          hsAudio.playSfx('whoosh', 0.95);
          hsAudio.playSfx('big_attack', 0.82);
          hsAudio.playProceduralVfxSound('HOLY');
          hsAudio.vibrateByDamage(10);
          impactCbRef.current?.(11);
          const hasActiveWindstorm = ultimateStormsRef.current.some(
            (s) => s.kind === 'SILIA_WINDSTORM' && s.life < 12,
          );
          if (!hasActiveWindstorm) {
            spawnSiliaWindstormUltimate(stageW, stageH, 1, 'HEAL');
          }
          const heroPt = getEntityCenter('PLAYER_HERO');
          elementalImpactsRef.current.push({
            kind: 'VITAL_UPDRAFT',
            x: heroPt.x,
            y: heroPt.y,
            life: 0,
            maxLife: 54,
            scale: 1.3,
          });
          ensureLoopRef.current();
          break;
        }

        case 'KADAN_SNS_ULTIMATE': {
          const isStageSummary = ev.targetId === 'OPPONENT_HERO';
          const tier = Math.max(1, ev.value || 1);
          if (isStageSummary) {
            hsAudio.playSfx('whoosh', 1.0);
            hsAudio.playSfx('big_attack', 1.0);
            hsAudio.playProceduralVfxSound('FROST');
            hsAudio.vibrateByDamage(14 + tier * 3, { isFinisher: true });
            impactCbRef.current?.(14 + Math.min(12, tier * 3));
            spawnKadanBlizzardUltimate(stageW, stageH, tier);

            const enemyHeroPt = getEntityCenter('OPPONENT_HERO');
            elementalImpactsRef.current.push({
              kind: 'FROST_PRISON',
              x: enemyHeroPt.x,
              y: enemyHeroPt.y,
              life: 0,
              maxLife: 56,
              scale: 1.5,
            });
          } else {
            elementalImpactsRef.current.push({
              kind: 'FROST_PRISON',
              x: targetPos.x,
              y: targetPos.y,
              life: 0,
              maxLife: 48,
              scale: 1.0,
            });
          }
          ensureLoopRef.current();
          break;
        }

        case 'EXPLOSION': {
          const exDmg = Math.max(7, ev.value || 8);
          hsAudio.playSfx('big_attack', 0.9);
          hsAudio.vibrateByDamage(exDmg);
          impactCbRef.current?.(exDmg);
          spawnBurst(targetPos.x, targetPos.y, 16, ['#fde047', '#f97316', '#dc2626'], 7.5, 9, 'CIRCLE', 0.06);
          spawnRing(targetPos.x, targetPos.y, '#ef4444', 110);
          if (ev.label) {
            badgesRef.current.push({
              x: targetPos.x,
              y: targetPos.y - 28,
              vy: -1.1,
              text: ev.label,
              subKind: 'BANNER',
              life: 0,
              maxLife: 62,
            });
            ensureLoopRef.current();
          }
          break;
        }

        case 'DIVINE_BREAK':
          hsAudio.playProceduralVfxSound('DIVINE_BREAK');
          hsAudio.vibrateByDamage(2);
          impactCbRef.current?.(2);
          spawnBurst(targetPos.x, targetPos.y, 24, ['#fef08a', '#facc15', '#ffffff'], 7.5, 9, 'SHARD', 0.14);
          spawnRing(targetPos.x, targetPos.y, '#facc15', 85);
          break;

        case 'SILENCE_RING':
          hsAudio.playProceduralVfxSound('SILENCE');
          spawnRing(targetPos.x, targetPos.y, '#c084fc', 90);
          spawnBurst(targetPos.x, targetPos.y, 16, ['#e9d5ff', '#a855f7'], 4, 6, 'CIRCLE', 0);
          break;

        case 'SECRET_REVEAL':
          hsAudio.playProceduralVfxSound('SECRET_TRIGGER');
          spawnRing(targetPos.x, targetPos.y, '#f472b6', 130);
          spawnBurst(targetPos.x, targetPos.y, 14, ['#fbcfe8', '#f472b6', '#fde047'], 6, 7, 'STAR', 0);
          if (ev.label) {
            const isKo = isKoreanLanguage();
            badgesRef.current.push({
              x: stageW * 0.5,
              y: stageH * 0.3,
              vy: -0.6,
              text: isKo ? `비밀 발동! [${ev.label}]` : `Secret! [${ev.label}]`,
              subKind: 'BANNER',
              life: 0,
              maxLife: 75,
            });
            ensureLoopRef.current();
          }
          break;

        case 'LEGENDARY_SLAM':
          hsAudio.playSfx('pack_legendary', 0.92);
          hsAudio.playSfx('big_attack', 0.95);
          hsAudio.playProceduralVfxSound('LEGENDARY_FANFARE');
          hsAudio.vibrateByDamage(11);
          impactCbRef.current?.(11);
          spawnRing(targetPos.x, targetPos.y, '#fbbf24', Math.max(200, Math.min(stageW, stageH) * 0.48));
          spawnRing(targetPos.x, targetPos.y, '#fef08a', 140);
          spawnBurst(
            targetPos.x,
            targetPos.y,
            24,
            ['#fef08a', '#f59e0b', '#fbbf24', '#fb923c', '#ffffff'],
            9.5,
            9,
            'STAR',
            0.04,
          );
          if (ev.label) {
            const isKo = isKoreanLanguage();
            badgesRef.current.push({
              x: stageW * 0.5,
              y: stageH * 0.24,
              vy: -0.45,
              text: isKo ? `★ 전설 강림 · ${ev.label}` : `★ Legendary · ${ev.label}`,
              subKind: 'BANNER',
              life: 0,
              maxLife: 88,
            });
            ensureLoopRef.current();
          }
          break;

        case 'HERO_EXPLODE':
          hsAudio.playSfx('big_attack', 1.0);
          hsAudio.playSfx('victory', 0.95);
          hsAudio.vibrateByDamage(22, { isFinisher: true });
          impactCbRef.current?.(22, { isFinisher: true });
          spawnRing(targetPos.x, targetPos.y, '#f97316', 240);
          spawnBurst(
            targetPos.x,
            targetPos.y,
            28,
            ['#fef08a', '#f97316', '#ef4444', '#ffffff', '#fbbf24'],
            10.5,
            11,
            'SHARD',
            0.1,
          );
          break;

        case 'DAMAGE_POP': {
          const hitDmg = Math.max(1, ev.value || 1);
          const isUltimateSource = ev.sourceId === 'KADAN_WIDGET' || ev.sourceId === 'SILIA';
          if (!isUltimateSource) {
            if (hitDmg >= 5) {
              hsAudio.playSfx('big_attack', 0.8);
            } else {
              hsAudio.playSfx('attack', 0.68);
            }
            hsAudio.vibrateByDamage(hitDmg);
            impactCbRef.current?.(hitDmg);
            spawnBurst(targetPos.x, targetPos.y, 8, ['#ef4444', '#fca5a5', '#fde047'], 4.5, 5, 'SHARD', 0.1);
          }
          badgesRef.current.push({
            x: targetPos.x + (Math.random() * 10 - 5),
            y: targetPos.y - 6,
            vy: -1.05,
            text: ev.label || `-${hitDmg}`,
            subKind: 'DAMAGE',
            life: 0,
            maxLife: 46,
          });
          ensureLoopRef.current();
          break;
        }

        case 'HEAL_POP':
          hsAudio.playProceduralVfxSound('HOLY');
          spawnBurst(targetPos.x, targetPos.y, 8, ['#86efac', '#4ade80', '#fef08a'], 3.8, 5, 'STAR', -0.05);
          badgesRef.current.push({
            x: targetPos.x,
            y: targetPos.y - 10,
            vy: -1.0,
            text: `+${ev.value || 1}`,
            subKind: 'HEAL',
            life: 0,
            maxLife: 45,
          });
          ensureLoopRef.current();
          break;

        case 'ARMOR_POP':
          hsAudio.playProceduralVfxSound('ARMOR');
          badgesRef.current.push({
            x: targetPos.x + 22,
            y: targetPos.y - 12,
            vy: -0.9,
            text: isKoreanLanguage() ? `+${ev.value || 1} 방어도` : `+${ev.value || 1} Armor`,
            subKind: 'ARMOR',
            life: 0,
            maxLife: 44,
          });
          ensureLoopRef.current();
          break;

        case 'BUFF_POP':
          spawnBurst(targetPos.x, targetPos.y, 8, ['#fde047', '#fef9c3'], 3.8, 5, 'STAR', -0.04);
          if (ev.label) {
            badgesRef.current.push({
              x: targetPos.x,
              y: targetPos.y - 18,
              vy: -1.0,
              text: ev.label,
              subKind: 'BUFF',
              life: 0,
              maxLife: 44,
            });
            ensureLoopRef.current();
          }
          break;

        case 'MINION_SUMMON':
          spawnRing(targetPos.x, targetPos.y + 8, '#fde68a', 76);
          spawnBurst(
            targetPos.x,
            targetPos.y + 10,
            12,
            ['#fef3c7', '#d6d3d1', '#a8a29e', '#fbbf24'],
            4.8,
            6,
            'CIRCLE',
            0.04,
          );
          break;

        case 'MINION_DEATH':
          hsAudio.playProceduralVfxSound('DEATH_CRACK');
          spawnRing(targetPos.x, targetPos.y, '#94a3b8', 88);
          spawnBurst(
            targetPos.x,
            targetPos.y,
            16,
            ['#cbd5e1', '#64748b', '#475569', '#f87171'],
            6.2,
            7,
            'SHARD',
            0.12,
          );
          badgesRef.current.push({
            x: targetPos.x,
            y: targetPos.y - 4,
            vy: -0.95,
            text: '☠',
            subKind: 'SKULL',
            life: 0,
            maxLife: 42,
          });
          ensureLoopRef.current();
          break;

        case 'FATIGUE_HIT': {
          const fatVal = Math.max(1, ev.value || 1);
          hsAudio.playProceduralVfxSound('DEATH_CRACK');
          hsAudio.playSfx('big_attack', 0.85);
          hsAudio.vibrateByDamage(Math.max(4, fatVal * 2));
          impactCbRef.current?.(Math.max(4, fatVal * 2));
          spawnRing(targetPos.x, targetPos.y, '#a855f7', 135);
          spawnBurst(
            targetPos.x,
            targetPos.y,
            20,
            ['#c084fc', '#ef4444', '#7e22ce', '#fca5a5'],
            7.2,
            8,
            'SHARD',
            0.08,
          );
          badgesRef.current.push({
            x: targetPos.x,
            y: targetPos.y - 34,
            vy: -0.8,
            text: ev.label || (isKoreanLanguage() ? `☠ 탈진 -${fatVal}` : `☠ Fatigue -${fatVal}`),
            subKind: 'BANNER',
            life: 0,
            maxLife: 68,
          });
          ensureLoopRef.current();
          break;
        }

        case 'MILL_BURN':
          hsAudio.playProceduralVfxSound('CARD_BURN');
          spawnRing(targetPos.x, targetPos.y, '#f97316', 96);
          spawnBurst(
            targetPos.x,
            targetPos.y,
            22,
            ['#fef08a', '#fb923c', '#ef4444', '#292524'],
            6.5,
            7,
            'SHARD',
            -0.09,
          );
          if (ev.label) {
            badgesRef.current.push({
              x: targetPos.x - 36,
              y: targetPos.y - 18,
              vy: -0.9,
              text: isKoreanLanguage() ? `🔥 [${ev.label}] 소멸` : `🔥 [${ev.label}] Burned`,
              subKind: 'BANNER',
              life: 0,
              maxLife: 64,
            });
            ensureLoopRef.current();
          }
          break;

        case 'FREEZE_SHARD':
          hsAudio.playProceduralVfxSound('FROST');
          spawnRing(targetPos.x, targetPos.y, '#38bdf8', 82);
          spawnBurst(
            targetPos.x,
            targetPos.y,
            16,
            ['#e0f2fe', '#7dd3fc', '#38bdf8', '#ffffff'],
            5.8,
            7,
            'SHARD',
            0.04,
          );
          break;

        case 'POISON_VENOM':
          hsAudio.playProceduralVfxSound('POISON');
          spawnRing(targetPos.x, targetPos.y, '#22c55e', 88);
          spawnBurst(
            targetPos.x,
            targetPos.y,
            18,
            ['#bbf7d0', '#4ade80', '#16a34a', '#a3e635'],
            5.6,
            7,
            'CIRCLE',
            -0.05,
          );
          if (ev.label) {
            badgesRef.current.push({
              x: targetPos.x,
              y: targetPos.y - 24,
              vy: -0.9,
              text: `☠ ${ev.label}`,
              subKind: 'BUFF',
              life: 0,
              maxLife: 52,
            });
            ensureLoopRef.current();
          }
          break;

        case 'TOY_BELL':
          hsAudio.playProceduralVfxSound('TOY_BELL');
          spawnRing(targetPos.x, targetPos.y, '#fde047', 86);
          spawnBurst(targetPos.x, targetPos.y, 12, ['#fef9c3', '#facc15', '#fbbf24'], 4.2, 6, 'STAR', -0.04);
          if (ev.label) {
            badgesRef.current.push({
              x: targetPos.x,
              y: targetPos.y - 16,
              vy: -0.85,
              text: ev.label,
              subKind: 'BUFF',
              life: 0,
              maxLife: 46,
            });
            ensureLoopRef.current();
          }
          break;

        case 'TOY_CATAPULT':
          hsAudio.playProceduralVfxSound('TOY_CATAPULT');
          spawnBurst(sourcePos.x, sourcePos.y, 10, ['#d6d3d1', '#a8a29e', '#fbbf24'], 4.5, 6, 'CIRCLE', 0.08);
          projectilesRef.current.push({
            x0: sourcePos.x,
            y0: sourcePos.y,
            x1: targetPos.x,
            y1: targetPos.y,
            t: 0,
            speed: 0.048,
            colorCore: '#e7e5e4',
            colorGlow: '#f97316',
            radius: 13,
            kind: 'TOY_CATAPULT',
          });
          ensureLoopRef.current();
          break;

        case 'TOY_SPARKS':
          hsAudio.playProceduralVfxSound('FIRE');
          spawnBurst(
            targetPos.x,
            targetPos.y,
            18,
            ['#fef08a', '#fb923c', '#ef4444', '#ffffff'],
            6.8,
            6,
            'STAR',
            0.12,
          );
          spawnRing(targetPos.x, targetPos.y, '#fb923c', 72);
          break;

        case 'TOY_RADISH':
          hsAudio.playProceduralVfxSound('TOY_RADISH');
          spawnBurst(
            targetPos.x,
            targetPos.y,
            16,
            ev.value === 777
              ? ['#fef08a', '#facc15', '#f59e0b', '#ffffff']
              : ['#86efac', '#4ade80', '#a16207', '#fef08a'],
            5.5,
            7,
            ev.value === 777 ? 'STAR' : 'CIRCLE',
            0.09,
          );
          if (ev.label) {
            badgesRef.current.push({
              x: targetPos.x,
              y: targetPos.y - 18,
              vy: -1.0,
              text: ev.label,
              subKind: 'BANNER',
              life: 0,
              maxLife: 56,
            });
            ensureLoopRef.current();
          }
          break;

        case 'TOY_SPLASH':
          hsAudio.playProceduralVfxSound('TOY_SPLASH');
          spawnRing(targetPos.x, targetPos.y, '#38bdf8', 84);
          spawnBurst(
            targetPos.x,
            targetPos.y,
            16,
            ['#e0f2fe', '#7dd3fc', '#38bdf8', '#ffffff'],
            5.2,
            6,
            'CIRCLE',
            0.11,
          );
          break;

        case 'TOY_DRUM':
          hsAudio.playProceduralVfxSound('TOY_DRUM');
          impactCbRef.current?.(2);
          spawnRing(targetPos.x, targetPos.y, '#f59e0b', 96);
          spawnBurst(targetPos.x, targetPos.y, 12, ['#fde68a', '#f97316', '#ef4444'], 4.8, 6, 'STAR', 0);
          break;
      }
    }
  }, [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stageSizeRef = { width: 1280, height: 720 };
    const syncSize = () => {
      const lowPower = detectLowPowerDevice();
      const maxDpr = lowPower ? 1.25 : 1.75;
      const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
      const { width, height } = getStageSize();
      stageSizeRef.width = width;
      stageSizeRef.height = height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    syncSize();
    window.addEventListener('resize', syncSize);
    window.addEventListener('orientationchange', syncSize);

    let frameTick = 0;
    const render = () => {
      frameTick += 1;
      const { width, height } = stageSizeRef;

      // Check if all queues are empty => clear & go to IDLE (0% CPU/GPU)
      if (
        projectilesRef.current.length === 0 &&
        particlesRef.current.length === 0 &&
        badgesRef.current.length === 0 &&
        elementalImpactsRef.current.length === 0 &&
        ultimateStormsRef.current.length === 0
      ) {
        ctx.clearRect(0, 0, width, height);
        rafIdRef.current = 0;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // -1. Full-Screen AAA Elemental Ultimate Storms (`카단 눈보라 대폭풍` & `실리아 바람풍 대폭풍`)
      const nextStorms: UltimateStorm[] = [];
      for (const st of ultimateStormsRef.current) {
        st.life += 1;
        if (st.life >= st.maxLife) continue;
        const prog = st.life / st.maxLife;
        const envAlpha = prog < 0.1 ? prog / 0.1 : prog > 0.74 ? (1 - prog) / 0.26 : 1;

        ctx.save();
        if (st.kind === 'KADAN_BLIZZARD') {
          // 1) Arctic Sub-Zero Storm Sky Contrast Veil + Snap-Freeze Flash
          const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
          skyGrad.addColorStop(0, `rgba(4, 19, 38, ${(0.52 * envAlpha).toFixed(3)})`);
          skyGrad.addColorStop(0.48, `rgba(12, 74, 110, ${(0.32 * envAlpha).toFixed(3)})`);
          skyGrad.addColorStop(1, `rgba(8, 47, 73, ${(0.28 * envAlpha).toFixed(3)})`);
          ctx.fillStyle = skyGrad;
          ctx.fillRect(0, 0, width, height);

          if (st.life <= 8) {
            ctx.fillStyle = `rgba(224, 242, 254, ${((1 - st.life / 8) * 0.42).toFixed(3)})`;
            ctx.fillRect(0, 0, width, height);
          }

          // 2) Frozen Screen Rim Vignette & 4-Corner Creeping Frost Rime Spikes (`화면 사방 성에 결빙`)
          const rimH = Math.min(110, height * 0.14);
          const topFrost = ctx.createLinearGradient(0, 0, 0, rimH);
          topFrost.addColorStop(0, `rgba(186, 230, 253, ${(0.52 * envAlpha).toFixed(3)})`);
          topFrost.addColorStop(1, 'rgba(186, 230, 253, 0)');
          ctx.fillStyle = topFrost;
          ctx.fillRect(0, 0, width, rimH);

          const botFrost = ctx.createLinearGradient(0, height, 0, height - rimH);
          botFrost.addColorStop(0, `rgba(125, 211, 252, ${(0.44 * envAlpha).toFixed(3)})`);
          botFrost.addColorStop(1, 'rgba(125, 211, 252, 0)');
          ctx.fillStyle = botFrost;
          ctx.fillRect(0, height - rimH, width, rimH);

          const rimeGrow = Math.min(1, st.life / 12) * envAlpha;
          const cornerAnchors: Array<[number, number, number]> = [
            [0, 0, 0.78],
            [width, 0, 2.36],
            [0, height, -0.78],
            [width, height, -2.36],
          ];
          for (const [cx, cy, baseAng] of cornerAnchors) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.globalAlpha = rimeGrow * 0.86;
            for (let k = -2; k <= 2; k++) {
              const ang = baseAng + k * 0.28;
              const spikeLen = (54 + (2 - Math.abs(k)) * 28) * rimeGrow;
              ctx.save();
              ctx.rotate(ang);
              ctx.fillStyle = k % 2 === 0 ? '#e0f2fe' : '#7dd3fc';
              ctx.beginPath();
              ctx.moveTo(0, -10);
              ctx.lineTo(spikeLen, 0);
              ctx.lineTo(0, 10);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
            ctx.restore();
          }

          // 3) Volumetric Howling Whiteout Snow-Fog Squall Bands (`-25° 대설원 눈보라 구름 파동`)
          ctx.save();
          ctx.translate(width * 0.5, height * 0.5);
          ctx.rotate(-0.44);
          const diagSpan = Math.hypot(width, height) * 1.25;
          for (let b = 0; b < 6; b++) {
            const bandW = 90 + (b % 3) * 38;
            const travel = ((st.life * (24 + b * 4) + b * 190) % (diagSpan * 1.3)) - diagSpan * 0.65;
            const bandX = -travel;
            const bandY = (b - 2.5) * (height * 0.2);
            const fogGrad = ctx.createLinearGradient(bandX - bandW, bandY, bandX + bandW, bandY + bandW * 0.85);
            fogGrad.addColorStop(0, 'rgba(186, 230, 253, 0)');
            fogGrad.addColorStop(0.45, `rgba(186, 230, 253, ${(0.24 * envAlpha).toFixed(3)})`);
            fogGrad.addColorStop(0.6, `rgba(255, 255, 255, ${(0.34 * envAlpha).toFixed(3)})`);
            fogGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
            ctx.fillStyle = fogGrad;
            ctx.fillRect(-diagSpan * 0.6, bandY - bandW * 0.5, diagSpan * 1.2, bandW);
          }
          ctx.restore();

          // 4) High-Velocity Razor Ice-Sleet Wind Needles (`칼바람 진눈깨비 궤적`)
          const sleetDx = -0.89;
          const sleetDy = 0.45;
          ctx.lineCap = 'round';
          for (const sl of st.sleets) {
            sl.x += sleetDx * sl.speed;
            sl.y += sleetDy * sl.speed;
            if (sl.x < -140) sl.x += width * 1.45;
            if (sl.y > height + 90) sl.y -= height * 1.2;

            const tx = sl.x - sleetDx * sl.len;
            const ty = sl.y - sleetDy * sl.len;
            const slGrad = ctx.createLinearGradient(tx, ty, sl.x, sl.y);
            slGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
            slGrad.addColorStop(0.65, `rgba(186, 230, 253, ${(sl.alpha * 0.55 * envAlpha).toFixed(3)})`);
            slGrad.addColorStop(1, `rgba(255, 255, 255, ${(sl.alpha * envAlpha).toFixed(3)})`);
            ctx.strokeStyle = slGrad;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(sl.x, sl.y);
            ctx.stroke();
          }

          // 5) Colossal 3D-Shaded Glacial Meteors & Towering Ground Iceberg Wall Eruption (`천공 빙하 낙하 & 대빙벽 융기`)
          for (const sp of st.spears) {
            const localT = (st.life - sp.delay) / sp.dur;
            if (localT < 0) continue;
            if (localT <= 1) {
              const cx = sp.x0 + (sp.x1 - sp.x0) * localT;
              const cy = sp.y0 + (sp.y1 - sp.y0) * localT;
              const ang = Math.atan2(sp.y1 - sp.y0, sp.x1 - sp.x0);
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(ang);
              ctx.scale(sp.scale, sp.scale);
              ctx.globalAlpha = Math.min(1, envAlpha * 0.98);

              // Freezing Comet Vapor Wake
              const wakeGrad = ctx.createLinearGradient(-155, 0, 20, 0);
              wakeGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
              wakeGrad.addColorStop(0.65, 'rgba(125, 211, 252, 0.48)');
              wakeGrad.addColorStop(1, 'rgba(240, 249, 255, 0.9)');
              ctx.fillStyle = wakeGrad;
              ctx.beginPath();
              ctx.moveTo(30, 0);
              ctx.lineTo(-150, -24);
              ctx.lineTo(-125, 0);
              ctx.lineTo(-150, 24);
              ctx.closePath();
              ctx.fill();

              // 3D Glacial Spear — Upper Lit Facet
              ctx.fillStyle = '#e0f2fe';
              ctx.beginPath();
              ctx.moveTo(64, 0);
              ctx.lineTo(-22, -19);
              ctx.lineTo(-54, 0);
              ctx.closePath();
              ctx.fill();

              // 3D Glacial Spear — Lower Sapphire Shadow Facet
              ctx.fillStyle = '#0284c7';
              ctx.beginPath();
              ctx.moveTo(64, 0);
              ctx.lineTo(-54, 0);
              ctx.lineTo(-22, 19);
              ctx.closePath();
              ctx.fill();

              // Specular Diamond Spine
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2.6;
              ctx.beginPath();
              ctx.moveTo(64, 0);
              ctx.lineTo(-48, 0);
              ctx.stroke();
              ctx.restore();
            } else {
              if (!sp.impacted) {
                sp.impacted = true;
                // Pure Ice Crystal Splinters (no yellow confetti)
                spawnBurst(
                  sp.x1,
                  sp.y1,
                  8,
                  ['#ffffff', '#e0f2fe', '#7dd3fc', '#38bdf8'],
                  7.5,
                  7,
                  'SHARD',
                  0.06,
                );
              }
              const afterT = (localT - 1) / 3.2;
              if (afterT < 1) {
                const popGrow = afterT < 0.14 ? afterT / 0.14 : 1;
                const fadeOut = afterT > 0.65 ? (1 - afterT) / 0.35 : 1;
                const spireAlpha = Math.max(0, fadeOut * envAlpha);

                ctx.save();
                ctx.translate(sp.x1, sp.y1 + 14);
                ctx.scale(sp.scale, sp.scale * popGrow);
                ctx.globalAlpha = spireAlpha;

                // Horizontal Perspective Frost Shockwave Ring at Glacier Foot
                if (afterT < 0.55) {
                  const shockProg = afterT / 0.55;
                  ctx.save();
                  ctx.globalAlpha = spireAlpha * (1 - shockProg) * 0.9;
                  ctx.strokeStyle = '#bae6fd';
                  ctx.lineWidth = 3.2 * (1 - shockProg * 0.5);
                  ctx.beginPath();
                  ctx.ellipse(0, 0, 24 + shockProg * 78, 8 + shockProg * 24, 0, 0, Math.PI * 2);
                  ctx.stroke();
                  ctx.restore();
                }

                // Soft Freezing Snow-Mist Bloom Around Glacier Base
                const mistGrad = ctx.createRadialGradient(0, -10, 4, 0, -10, 74);
                mistGrad.addColorStop(0, 'rgba(224, 242, 254, 0.52)');
                mistGrad.addColorStop(0.55, 'rgba(125, 211, 252, 0.22)');
                mistGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
                ctx.fillStyle = mistGrad;
                ctx.beginPath();
                ctx.arc(0, -10, 74, 0, Math.PI * 2);
                ctx.fill();

                // Sculpted Translucent 3-Crystal Glacial Formation
                const spires: Array<[number, number, number, number]> = [
                  [-18, 54, 13, -0.22],
                  [0, 86, 18, 0.02],
                  [18, 58, 14, 0.22],
                ];
                for (const [dx, hgt, halfW, tilt] of spires) {
                  ctx.save();
                  ctx.translate(dx, 0);
                  ctx.rotate(tilt);

                  const leftGrad = ctx.createLinearGradient(0, -hgt, 0, 0);
                  leftGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
                  leftGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.72)');
                  leftGrad.addColorStop(1, 'rgba(14, 116, 144, 0.35)');
                  ctx.fillStyle = leftGrad;
                  ctx.beginPath();
                  ctx.moveTo(0, -hgt);
                  ctx.lineTo(-halfW, -8);
                  ctx.lineTo(0, 4);
                  ctx.closePath();
                  ctx.fill();

                  const rightGrad = ctx.createLinearGradient(0, -hgt, 0, 0);
                  rightGrad.addColorStop(0, 'rgba(224, 242, 254, 0.85)');
                  rightGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.62)');
                  rightGrad.addColorStop(1, 'rgba(12, 74, 110, 0.32)');
                  ctx.fillStyle = rightGrad;
                  ctx.beginPath();
                  ctx.moveTo(0, -hgt);
                  ctx.lineTo(0, 4);
                  ctx.lineTo(halfW, -8);
                  ctx.closePath();
                  ctx.fill();

                  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
                  ctx.lineWidth = 1.4;
                  ctx.beginPath();
                  ctx.moveTo(0, -hgt);
                  ctx.lineTo(0, 4);
                  ctx.stroke();
                  ctx.restore();
                }
                ctx.restore();
              }
            }
          }

          // 6) 3-Depth Parallax Snowstorm (`진짜 겨울 눈꽃 결정 & 폭설 눈송이 보케` — 거미줄 링 없음!)
          for (const fl of st.flakes) {
            const gustX = Math.sin(st.life * 0.16 + fl.swayPhase) * 2.8;
            const gustY = Math.cos(st.life * 0.14 + fl.swayPhase) * 1.5;
            fl.x += fl.vx + gustX;
            fl.y += fl.vy + gustY;
            fl.rot += fl.vRot;
            if (fl.x < -45) fl.x += width * 1.32;
            if (fl.y > height + 45) fl.y -= height * 1.22;

            ctx.save();
            ctx.translate(fl.x, fl.y);
            if (fl.depth === 2) {
              // Authentic 6-Arm Fern Ice Snowflake (outward V-chevrons ONLY, zero inner web!)
              ctx.rotate(fl.rot);
              ctx.globalAlpha = envAlpha * 0.94;
              const r = fl.size;

              const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.25);
              glow.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
              glow.addColorStop(0.5, 'rgba(125, 211, 252, 0.22)');
              glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
              ctx.fillStyle = glow;
              ctx.beginPath();
              ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
              ctx.fill();

              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.8;
              ctx.lineCap = 'round';
              for (let arm = 0; arm < 6; arm++) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(r, 0);
                // Delicate outward V-fern twigs at 55% and 80%
                ctx.moveTo(r * 0.48, 0);
                ctx.lineTo(r * 0.72, -r * 0.22);
                ctx.moveTo(r * 0.48, 0);
                ctx.lineTo(r * 0.72, r * 0.22);
                ctx.moveTo(r * 0.74, 0);
                ctx.lineTo(r * 0.9, -r * 0.14);
                ctx.moveTo(r * 0.74, 0);
                ctx.lineTo(r * 0.9, r * 0.14);
                ctx.stroke();
                ctx.rotate(Math.PI / 3);
              }
            } else if (fl.depth === 1) {
              // Fluffy Radial-Bokeh Snow Puff (`폭설 눈송이`)
              ctx.globalAlpha = envAlpha * 0.9;
              const r = fl.size;
              const puff = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
              puff.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
              puff.addColorStop(0.55, 'rgba(224, 242, 254, 0.65)');
              puff.addColorStop(1, 'rgba(186, 230, 253, 0)');
              ctx.fillStyle = puff;
              ctx.beginPath();
              ctx.arc(0, 0, r, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.globalAlpha = envAlpha * 0.68;
              ctx.fillStyle = '#f0f9ff';
              ctx.beginPath();
              ctx.ellipse(0, 0, fl.size * 0.9, fl.size * 0.55, -0.45, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        } else {
          // ==================== SILIA_WINDSTORM (`실리아 3종 속성별 전용 필살기 연출`) ====================
          const siliaVariant = st.subVariant || 'ATTACK';
          const palette =
            siliaVariant === 'ATTACK'
              ? {
                  sky0: [69, 10, 10],
                  sky1: [153, 27, 27],
                  sky2: [67, 20, 7],
                  flash: [254, 215, 170],
                  jetOuter: [239, 68, 68],
                  jetMid: [251, 146, 60],
                  jetCore: [254, 249, 195],
                  mistCore: [254, 202, 202],
                  mistOuter: [220, 38, 38],
                  ringMain: '#fca5a5',
                  ringSub: '#f97316',
                  bladeLight: '#fed7aa',
                  bladeMid: '#fb7185',
                  bladeDark: '#dc2626',
                }
              : siliaVariant === 'DEFENSE'
                ? {
                    sky0: [12, 34, 68],
                    sky1: [7, 89, 133],
                    sky2: [30, 58, 138],
                    flash: [254, 240, 138],
                    jetOuter: [56, 189, 248],
                    jetMid: [250, 204, 21],
                    jetCore: [224, 242, 254],
                    mistCore: [254, 240, 138],
                    mistOuter: [56, 189, 248],
                    ringMain: '#fde047',
                    ringSub: '#38bdf8',
                    bladeLight: '#fef08a',
                    bladeMid: '#38bdf8',
                    bladeDark: '#0284c7',
                  }
                : {
                    sky0: [2, 44, 34],
                    sky1: [6, 95, 70],
                    sky2: [6, 78, 59],
                    flash: [209, 250, 229],
                    jetOuter: [16, 185, 129],
                    jetMid: [74, 222, 128],
                    jetCore: [236, 253, 245],
                    mistCore: [251, 207, 232],
                    mistOuter: [16, 185, 129],
                    ringMain: '#86efac',
                    ringSub: '#34d399',
                    bladeLight: '#bbf7d0',
                    bladeMid: '#4ade80',
                    bladeDark: '#10b981',
                  };

          // 1) Variant-Specific Atmospheric Contrast Veil
          const windSky = ctx.createLinearGradient(0, 0, 0, height);
          windSky.addColorStop(0, `rgba(${palette.sky0.join(',')}, ${(0.42 * envAlpha).toFixed(3)})`);
          windSky.addColorStop(0.5, `rgba(${palette.sky1.join(',')}, ${(0.24 * envAlpha).toFixed(3)})`);
          windSky.addColorStop(1, `rgba(${palette.sky2.join(',')}, ${(0.34 * envAlpha).toFixed(3)})`);
          ctx.fillStyle = windSky;
          ctx.fillRect(0, 0, width, height);

          if (st.life <= 7) {
            ctx.fillStyle = `rgba(${palette.flash.join(',')}, ${((1 - st.life / 7) * 0.34).toFixed(3)})`;
            ctx.fillRect(0, 0, width, height);
          }

          // 2) Flowing S-Curve Aerodynamic Jetstream Ribbons (Color-Coded by Skill)
          ctx.lineCap = 'round';
          for (let j = 0; j < 7; j++) {
            const baseY = height * (0.14 + j * 0.105);
            const phaseShift = st.life * 0.28 + j * 1.15;
            const amp = 18 + (j % 3) * 12;
            const streamOffset = ((st.life * (32 + j * 5) + j * 180) % (width * 1.6)) - width * 0.45;
            const xStart = streamOffset - width * 0.42;
            const xEnd = streamOffset + width * 0.42;

            const jetGrad = ctx.createLinearGradient(xStart, baseY, xEnd, baseY);
            jetGrad.addColorStop(0, `rgba(${palette.jetOuter.join(',')}, 0)`);
            jetGrad.addColorStop(0.35, `rgba(${palette.jetMid.join(',')}, ${(0.45 * envAlpha).toFixed(3)})`);
            jetGrad.addColorStop(0.65, `rgba(${palette.jetCore.join(',')}, ${(0.85 * envAlpha).toFixed(3)})`);
            jetGrad.addColorStop(1, `rgba(${palette.jetOuter.join(',')}, 0)`);

            ctx.strokeStyle = `rgba(${palette.jetOuter.join(',')}, ${(0.18 * envAlpha).toFixed(3)})`;
            ctx.lineWidth = 11 - (j % 3) * 2;
            ctx.beginPath();
            for (let s = 0; s <= 16; s++) {
              const u = s / 16;
              const px = xStart + (xEnd - xStart) * u;
              const py = baseY + Math.sin(u * Math.PI * 2.2 - phaseShift) * amp;
              if (s === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.stroke();

            ctx.strokeStyle = jetGrad;
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let s = 0; s <= 16; s++) {
              const u = s / 16;
              const px = xStart + (xEnd - xStart) * u;
              const py = baseY + Math.sin(u * Math.PI * 2.2 - phaseShift) * amp;
              if (s === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.stroke();
          }

          // 3) Variant-Specific Core Signature Effect:
          // - ATTACK: Crimson-Orange Swirling Vortexes + Razor Wind Scythe Blades
          // - DEFENSE: Expanding Golden-Azure Aegis Barrier Domes around Friendly Field
          // - HEAL: Rising Emerald-Blossom Vital Orbs & Gentle Healing Halo
          if (siliaVariant === 'DEFENSE') {
            ctx.save();
            const shieldCx = width * 0.5;
            const shieldCy = height * 0.68;
            for (let rIdx = 0; rIdx < 3; rIdx++) {
              const rProg = Math.min(1, Math.max(0, prog * 1.25 - rIdx * 0.14));
              const radX = width * (0.18 + rProg * 0.34);
              const radY = height * (0.09 + rProg * 0.16);
              ctx.globalAlpha = envAlpha * (1 - rProg * 0.45) * 0.85;
              ctx.strokeStyle = rIdx % 2 === 0 ? '#fde047' : '#38bdf8';
              ctx.lineWidth = 4 - rIdx * 0.8;
              ctx.beginPath();
              ctx.ellipse(shieldCx, shieldCy, radX, radY, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
          } else if (siliaVariant === 'HEAL') {
            ctx.save();
            for (let orb = 0; orb < 18; orb++) {
              const ox = width * (0.12 + ((orb * 19) % 76) / 100) + Math.sin(st.life * 0.14 + orb) * 18;
              const oy = height * 0.92 - ((st.life * (4.2 + (orb % 4) * 1.1) + orb * 32) % (height * 0.78));
              const rad = 5 + (orb % 3) * 3.5;
              const orbGrad = ctx.createRadialGradient(ox, oy, 0, ox, oy, rad * 2.2);
              orbGrad.addColorStop(0, `rgba(255, 255, 255, ${(0.9 * envAlpha).toFixed(3)})`);
              orbGrad.addColorStop(0.45, orb % 3 === 0 ? `rgba(249, 168, 212, ${(0.65 * envAlpha).toFixed(3)})` : `rgba(74, 222, 128, ${(0.75 * envAlpha).toFixed(3)})`);
              orbGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
              ctx.fillStyle = orbGrad;
              ctx.beginPath();
              ctx.arc(ox, oy, rad * 2.2, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          } else {
            // ATTACK: Crimson-Orange Tornado Vortexes
            for (const td of st.tornadoes) {
              const tx = td.x0 + (td.x1 - td.x0) * prog;
              const ringCount = 22;
              ctx.save();
              for (let c = 0; c < ringCount; c++) {
                const frac = c / (ringCount - 1);
                const cy = td.baseY - frac * td.height;
                const sway = Math.sin(st.life * 0.28 + frac * 4.6 + td.phase) * (10 + frac * 22);
                const cx = tx + sway;
                const rx = td.footRadius + Math.pow(frac, 1.35) * (td.mouthRadius - td.footRadius);
                const ry = rx * 0.28;

                if (c % 3 === 0) {
                  const mist = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx * 1.15);
                  mist.addColorStop(0, `rgba(${palette.mistCore.join(',')}, ${(0.24 * envAlpha).toFixed(3)})`);
                  mist.addColorStop(0.6, `rgba(${palette.mistOuter.join(',')}, ${(0.14 * envAlpha).toFixed(3)})`);
                  mist.addColorStop(1, `rgba(${palette.mistOuter.join(',')}, 0)`);
                  ctx.fillStyle = mist;
                  ctx.beginPath();
                  ctx.ellipse(cx, cy, rx * 1.15, ry * 1.6, -0.08, 0, Math.PI * 2);
                  ctx.fill();
                }

                const spinBase = -st.life * (0.42 - frac * 0.1) + c * 0.72 + td.phase;
                for (let arcIdx = 0; arcIdx < 2; arcIdx++) {
                  const a0 = spinBase + arcIdx * Math.PI;
                  const a1 = a0 + Math.PI * 0.72;
                  ctx.globalAlpha = envAlpha * (arcIdx === 0 ? 0.86 : 0.48) * (1 - frac * 0.18);
                  ctx.strokeStyle =
                    c % 3 === 0 ? '#ffffff' : arcIdx === 0 ? palette.ringMain : palette.ringSub;
                  ctx.lineWidth = (arcIdx === 0 ? 3.4 : 2.1) * (1 - frac * 0.2);
                  ctx.beginPath();
                  ctx.ellipse(cx, cy, rx, ry, -0.08, a0, a1);
                  ctx.stroke();
                }
              }
              ctx.restore();
            }

            // 4) Razor-Thin Hollow Crescent Sonic Wind Scythes (ATTACK only!)
            for (const bl of st.blades) {
              bl.x += bl.vx;
              bl.y += bl.vy;
              if (bl.x > width + 110) bl.x -= width * 1.5;

              ctx.save();
              ctx.translate(bl.x, bl.y);
              ctx.rotate(bl.tilt);
              ctx.globalAlpha = envAlpha * 0.96;

              const r = bl.radius;
              const span = Math.PI * 0.44;
              const outerColor =
                bl.hue === 'WHITE'
                  ? palette.bladeLight
                  : bl.hue === 'MINT'
                    ? palette.bladeMid
                    : palette.bladeDark;

              const tipX = Math.cos(span) * r;
              const tipY = Math.sin(span) * r;
              const trailGrad = ctx.createLinearGradient(tipX - 95, 0, tipX, 0);
              trailGrad.addColorStop(0, `rgba(${palette.jetOuter.join(',')}, 0)`);
              trailGrad.addColorStop(1, `rgba(${palette.mistCore.join(',')}, ${(0.65 * envAlpha).toFixed(3)})`);
              ctx.strokeStyle = trailGrad;
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.moveTo(tipX, -tipY);
              ctx.lineTo(tipX - 90, -tipY - 5);
              ctx.moveTo(tipX, tipY);
              ctx.lineTo(tipX - 90, tipY + 5);
              ctx.stroke();

              ctx.fillStyle = outerColor;
              ctx.beginPath();
              ctx.arc(0, 0, r, -span, span, false);
              ctx.arc(-r * 0.24, 0, r * 0.98, span * 0.88, -span * 0.88, true);
              ctx.closePath();
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(1.5, 0, r * 0.98, -span * 0.86, span * 0.86, false);
              ctx.arc(-r * 0.13, 0, r * 0.95, span * 0.78, -span * 0.78, true);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }
          }

          // 5) 3D-Tumbling Botanical Emerald Wind-Leaves (`폭풍 기류를 타고 휘날리는 신록의 나뭇잎`)
          for (const lf of st.leaves) {
            lf.x += lf.vx;
            lf.y += lf.vy + Math.sin(st.life * 0.22 + lf.spin) * 2.2;
            lf.rot += lf.vRot;
            lf.spin += lf.vSpin;
            if (lf.x > width + 40) lf.x -= width * 1.3;
            if (lf.y < -30) lf.y += height * 0.95;
            if (lf.y > height + 30) lf.y -= height * 0.95;

            ctx.save();
            ctx.translate(lf.x, lf.y);
            ctx.rotate(lf.rot);
            ctx.scale(1, Math.max(0.24, Math.abs(Math.cos(lf.spin))));
            ctx.globalAlpha = envAlpha * 0.9;
            ctx.fillStyle = lf.color;
            const s = lf.size;
            ctx.beginPath();
            ctx.moveTo(-s, 0);
            ctx.quadraticCurveTo(0, -s * 0.68, s, 0);
            ctx.quadraticCurveTo(0, s * 0.68, -s, 0);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = 'rgba(6, 78, 59, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-s * 0.8, 0);
            ctx.lineTo(s * 0.8, 0);
            ctx.stroke();
            ctx.restore();
          }
        }
        ctx.restore();
        nextStorms.push(st);
      }
      ultimateStormsRef.current = nextStorms;

      // 0. Per-Target Elemental Ultimate Impacts (`빙결 수정 감옥` / `진공 3중 풍참` / `회오리 방어막` / `치유 상승기류`)
      const nextImpacts: ElementalImpact[] = [];
      for (const imp of elementalImpactsRef.current) {
        imp.life += 1;
        if (imp.life >= imp.maxLife) continue;
        const prog = imp.life / imp.maxLife;
        const alpha = prog < 0.15 ? prog / 0.15 : prog > 0.68 ? (1 - prog) / 0.32 : 1;

        ctx.save();
        ctx.translate(imp.x, imp.y);
        ctx.scale(imp.scale, imp.scale);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

        if (imp.kind === 'FROST_PRISON') {
          const grow = prog < 0.18 ? prog / 0.18 : 1;
          ctx.scale(grow, grow);

          // Sub-zero ground frost ring
          ctx.strokeStyle = '#bae6fd';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.ellipse(0, 22, 42 + prog * 18, 13 + prog * 6, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Translucent Hexagonal Ice Glacier Encasing the Target
          const iceGrad = ctx.createLinearGradient(0, -48, 0, 28);
          iceGrad.addColorStop(0, 'rgba(255, 255, 255, 0.88)');
          iceGrad.addColorStop(0.45, 'rgba(125, 211, 252, 0.62)');
          iceGrad.addColorStop(1, 'rgba(2, 132, 199, 0.45)');
          ctx.fillStyle = iceGrad;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(0, -52);
          ctx.lineTo(28, -18);
          ctx.lineTo(22, 24);
          ctx.lineTo(-22, 24);
          ctx.lineTo(-28, -18);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Internal Facet Fracture Lines
          ctx.beginPath();
          ctx.moveTo(0, -52);
          ctx.lineTo(-4, 24);
          ctx.moveTo(-28, -18);
          ctx.lineTo(22, 6);
          ctx.stroke();
        } else if (imp.kind === 'AERO_SLASH') {
          // 3 Intersecting Hollow Crescent Razor Wind Slashes Slicing Through Enemy Target
          const slashSpecs: Array<[number, number, number]> = [
            [-0.58, 0, 56],
            [0.52, 0.12, 52],
            [-0.12, 0.24, 62],
          ];
          for (const [ang, delayFrac, rad] of slashSpecs) {
            const localP = (prog - delayFrac) / (1 - delayFrac);
            if (localP <= 0 || localP >= 1) continue;
            const sAlpha = localP < 0.25 ? localP / 0.25 : 1 - (localP - 0.25) / 0.75;
            const sp = Math.PI * 0.42;
            ctx.save();
            ctx.rotate(ang);
            ctx.globalAlpha = alpha * sAlpha;
            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.arc(0, 0, rad, -sp, sp, false);
            ctx.arc(-rad * 0.22, 0, rad * 0.98, sp * 0.88, -sp * 0.88, true);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(1.5, 0, rad * 0.95, -sp * 0.76, sp * 0.76, false);
            ctx.stroke();
            ctx.restore();
          }
        } else if (imp.kind === 'WIND_DOME') {
          // Swirling Spherical Emerald Wind Barrier Vortex Around Protected Ally
          ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
          ctx.beginPath();
          ctx.arc(0, 0, 44, 0, Math.PI * 2);
          ctx.fill();

          for (let rIdx = 0; rIdx < 3; rIdx++) {
            const spinA = imp.life * 0.26 + (rIdx * Math.PI * 2) / 3;
            ctx.save();
            ctx.rotate(rIdx * 0.55 - 0.55);
            ctx.strokeStyle = rIdx === 0 ? '#ecfdf5' : '#34d399';
            ctx.lineWidth = rIdx === 0 ? 3.2 : 2.4;
            ctx.beginPath();
            ctx.ellipse(0, 0, 48, 20, 0, spinA, spinA + Math.PI * 1.35);
            ctx.stroke();
            ctx.restore();
          }
        } else {
          // VITAL_UPDRAFT: Ascending Double-Helix Healing Breeze Around Hero
          for (let h = 0; h < 2; h++) {
            ctx.strokeStyle = h === 0 ? '#bbf7d0' : '#4ade80';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            for (let s = 0; s <= 18; s++) {
              const frac = s / 18;
              const y = 42 - frac * 92 - prog * 18;
              const theta = frac * Math.PI * 4 - imp.life * 0.34 + h * Math.PI;
              const x = Math.sin(theta) * (38 - frac * 10);
              if (s === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }

        ctx.restore();
        nextImpacts.push(imp);
      }
      elementalImpactsRef.current = nextImpacts;

      // 1. Update & Draw Projectiles (zero-allocation layered discs instead of per-frame RadialGradient)
      const nextProj: Projectile[] = [];
      for (const pr of projectilesRef.current) {
        pr.t = Math.min(1, pr.t + pr.speed);
        // Parabolic arc
        const arc = Math.sin(pr.t * Math.PI) * -48;
        const cx = pr.x0 + (pr.x1 - pr.x0) * pr.t;
        const cy = pr.y0 + (pr.y1 - pr.y0) * pr.t + arc;

        // Spawn trail particle (throttled every 2-3 frames to slash draw calls on low-end GPUs)
        const trailStep = LOW_POWER_DEVICE ? 3 : 2;
        if (frameTick % trailStep === 0 && particlesRef.current.length < MAX_ACTIVE_PARTICLES) {
          particlesRef.current.push({
            x: cx + (Math.random() * 6 - 3),
            y: cy + (Math.random() * 6 - 3),
            vx: (Math.random() - 0.5) * 1.4,
            vy: (Math.random() - 0.5) * 1.4,
            size: pr.radius * 0.6,
            color: pr.colorGlow,
            alpha: 0.8,
            life: 0,
            maxLife: 12,
            shape: 'CIRCLE',
          });
        }

        ctx.globalAlpha = 0.36;
        ctx.fillStyle = pr.colorGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, pr.radius * 1.85, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.95;
        ctx.fillStyle = pr.colorCore;
        ctx.beginPath();
        ctx.arc(cx, cy, pr.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        if (pr.t >= 1) {
          if (pr.kind === 'TOY_CATAPULT') {
            hsAudio.playSfx('attack', 0.58);
            impactCbRef.current?.(2);
            spawnBurst(pr.x1, pr.y1, 14, ['#e7e5e4', '#fb923c', '#fde047'], 6.2, 7, 'SHARD', 0.12);
            spawnRing(pr.x1, pr.y1, '#fb923c', 72);
          } else {
            const pDmg = pr.kind === 'FIREBALL' ? 6 : pr.kind === 'SHADOW_BOLT' ? 4 : 3;
            hsAudio.vibrateByDamage(pDmg);
            impactCbRef.current?.(pDmg);
            spawnBurst(pr.x1, pr.y1, 16, [pr.colorCore, pr.colorGlow, '#ffffff'], 7, 8, 'SHARD', 0.08);
            spawnRing(pr.x1, pr.y1, pr.colorGlow, 80);
          }
        } else {
          nextProj.push(pr);
        }
      }
      projectilesRef.current = nextProj;

      // 2. Update & Draw Particles
      const nextParts: Particle[] = [];
      for (const p of particlesRef.current) {
        p.life += 1;
        if (p.life >= p.maxLife) continue;
        p.x += p.vx;
        p.y += p.vy;
        if (p.gravity) p.vy += p.gravity;
        const prog = p.life / p.maxLife;
        p.alpha = 1 - prog;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        if (p.shape === 'RING') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1.5, (1 - prog) * 5);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(4, p.size * prog), 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.shape === 'SHARD') {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.life * 0.22);
          ctx.fillStyle = p.color;
          const s = p.size * (1 - prog * 0.4);
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.65, 0);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.65, 0);
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'STAR') {
          ctx.translate(p.x, p.y);
          ctx.fillStyle = p.color;
          const s = p.size * (1 - prog * 0.35);
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.3, -s * 0.3);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.3, s * 0.3);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.3, s * 0.3);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.3, -s * 0.3);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, p.size * (1 - prog * 0.5)), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        nextParts.push(p);
      }
      particlesRef.current = nextParts;

      // 3. Update & Draw Hearthstone Damage Splat / Heal / Buff Badges
      const nextBadges: FloatingBadge[] = [];
      for (const b of badgesRef.current) {
        b.life += 1;
        if (b.life >= b.maxLife) continue;
        b.y += b.vy;
        b.vy *= 0.96;
        const prog = b.life / b.maxLife;
        const scale = b.life < 8 ? 0.6 + (b.life / 8) * 0.65 : 1.25 - prog * 0.2;
        const alpha = prog > 0.72 ? (1 - prog) / 0.28 : 1;

        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(b.x, b.y);
        ctx.scale(scale, scale);

        if (b.subKind === 'DAMAGE') {
          // Pre-calculated Octagon Starburst (fast, crisp, authentic Hearthstone splat!)
          ctx.fillStyle = '#b91c1c';
          ctx.strokeStyle = '#450a0a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(DAMAGE_SPLAT_OCTAGON[0].x, DAMAGE_SPLAT_OCTAGON[0].y);
          for (let i = 1; i < DAMAGE_SPLAT_OCTAGON.length; i++) {
            ctx.lineTo(DAMAGE_SPLAT_OCTAGON[i].x, DAMAGE_SPLAT_OCTAGON[i].y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.font = '800 24px "Nanum Gothic", "나눔고딕", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#09090b';
          ctx.strokeText(b.text, 0, 1);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(b.text, 0, 1);
        } else if (b.subKind === 'HEAL') {
          ctx.font = '800 25px "Nanum Gothic", "나눔고딕", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#052e16';
          ctx.strokeText(b.text, 0, 0);
          ctx.fillStyle = '#4ade80';
          ctx.fillText(b.text, 0, 0);
        } else if (b.subKind === 'ARMOR') {
          ctx.font = '800 20px "Nanum Gothic", "나눔고딕", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#0f172a';
          ctx.strokeText(b.text, 0, 0);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(b.text, 0, 0);
        } else if (b.subKind === 'SKULL') {
          ctx.font = '900 30px "Nanum Gothic", "나눔고딕", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#09090b';
          ctx.strokeText(b.text, 0, 0);
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(b.text, 0, 0);
        } else if (b.subKind === 'BANNER') {
          ctx.font = '800 18px "Nanum Gothic", "나눔고딕", sans-serif';
          const tw = ctx.measureText(b.text).width;
          const pw = tw + 26;
          const ph = 32;
          ctx.fillStyle = 'rgba(5, 46, 22, 0.9)';
          ctx.strokeStyle = '#6ee7b7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-pw / 2, -ph / 2, pw, ph, 16);
          ctx.fill();
          ctx.stroke();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#ecfdf5';
          ctx.fillText(b.text, 0, 1);
        } else {
          ctx.font = '800 22px "Nanum Gothic", "나눔고딕", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#1c1917';
          ctx.strokeText(b.text, 0, 0);
          ctx.fillStyle = '#fde047';
          ctx.fillText(b.text, 0, 0);
        }

        ctx.restore();
        nextBadges.push(b);
      }
      badgesRef.current = nextBadges;

      rafIdRef.current = requestAnimationFrame(render);
    };

    const ensureLoop = () => {
      if (rafIdRef.current === 0) {
        rafIdRef.current = requestAnimationFrame(render);
      }
    };
    ensureLoopRef.current = ensureLoop;
    ensureLoop();

    return () => {
      if (rafIdRef.current !== 0) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
      window.removeEventListener('resize', syncSize);
      window.removeEventListener('orientationchange', syncSize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="board-vfx-canvas"
      className="pointer-events-none absolute inset-0 z-[83] h-full w-full"
    />
  );
});
