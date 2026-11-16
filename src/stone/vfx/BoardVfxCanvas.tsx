import React, { useEffect, useRef } from 'react';
import { tr } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { VfxEvent } from '../types';

interface BoardVfxCanvasProps {
  events: VfxEvent[];
  onDamageImpact?: (damage: number, opts?: { isFinisher?: boolean }) => void;
  onScreenShake?: (intensity: 'LIGHT' | 'HEAVY') => void;
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

const lastKnownEntityCenters = new Map<string, { x: number; y: number }>();

export function recordEntityStagePosition(entityId: string, pos: { x: number; y: number }): void {
  lastKnownEntityCenters.set(entityId, pos);
}

function getViewportSize(): { width: number; height: number } {
  return {
    width: window.innerWidth || 1280,
    height: window.innerHeight || 720,
  };
}

function getEntityCenter(entityId?: string): { x: number; y: number } {
  const { width: w, height: h } = getViewportSize();
  if (!entityId) return { x: w * 0.5, y: h * 0.46 };

  const el = document.querySelector(`[data-hs-entity="${entityId}"]`);
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const pos = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      lastKnownEntityCenters.set(entityId, pos);
      return pos;
    }
  }
  const cached = lastKnownEntityCenters.get(entityId);
  if (cached) return cached;

  if (entityId === 'PLAYER_HERO') return { x: w * 0.5, y: h * 0.77 };
  if (entityId === 'OPPONENT_HERO') return { x: w * 0.5, y: h * 0.17 };
  if (entityId === 'TOY_TL') return { x: w * 0.14, y: h * 0.16 };
  if (entityId === 'TOY_TR') return { x: w * 0.86, y: h * 0.16 };
  if (entityId === 'TOY_BL') return { x: w * 0.14, y: h * 0.7 };
  if (entityId === 'TOY_BR') return { x: w * 0.86, y: h * 0.7 };
  if (entityId === 'PLAYER_DECK') return { x: w * 0.88, y: h * 0.62 };
  if (entityId === 'OPPONENT_DECK') return { x: w * 0.88, y: h * 0.28 };
  return { x: w * 0.5, y: h * 0.46 };
}

const MAX_ACTIVE_PARTICLES = 96;
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

export const BoardVfxCanvas: React.FC<BoardVfxCanvasProps> = ({
  events,
  onDamageImpact,
  onScreenShake,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const particlesRef = useRef<Particle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const badgesRef = useRef<FloatingBadge[]>([]);
  const impactCbRef = useRef(onDamageImpact);
  impactCbRef.current = onDamageImpact;
  const shakeCbRef = useRef(onScreenShake);
  shakeCbRef.current = onScreenShake;

  const rafIdRef = useRef<number>(0);
  const ensureLoopRef = useRef<() => void>(() => {});

  const emitImpact = (damage: number, opts?: { isFinisher?: boolean }) => {
    if (impactCbRef.current) {
      impactCbRef.current(damage, opts);
    } else if (shakeCbRef.current) {
      shakeCbRef.current(damage >= 6 || opts?.isFinisher ? 'HEAVY' : 'LIGHT');
    }
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
    const allowed = Math.min(count, MAX_ACTIVE_PARTICLES - curLen);

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

      const { width: stageW, height: stageH } = getViewportSize();
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
          ensureLoopRef.current();
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
          ensureLoopRef.current();
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
          ensureLoopRef.current();
          break;

        case 'LIGHTNING': {
          const lDmg = Math.max(2, ev.value || 3);
          hsAudio.playProceduralVfxSound('LIGHTNING');
          hsAudio.vibrateByDamage(lDmg);
          emitImpact(lDmg);
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
          ensureLoopRef.current();
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
          ensureLoopRef.current();
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
          emitImpact(fsDmg);
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
          emitImpact(bzDmg);
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
          emitImpact(csDmg);
          const yBand = ev.targetId === 'PLAYER_HERO' ? stageH * 0.58 : stageH * 0.34;
          for (let i = 0; i < 5; i++) {
            const px = stageW * (0.26 + i * 0.12);
            spawnBurst(px, yBand, 5, ['#fef08a', '#f59e0b', '#ffffff'], 5.5, 7, 'STAR', -0.06);
          }
          spawnRing(stageW * 0.5, yBand, '#fbbf24', 300);
          break;
        }

        case 'WHIRLWIND':
          hsAudio.playSfx('attack', 0.72);
          hsAudio.vibrateByDamage(Math.max(2, ev.value || 3));
          emitImpact(Math.max(2, ev.value || 3));
          spawnRing(stageW * 0.5, stageH * 0.45, '#cbd5e1', 280);
          spawnBurst(stageW * 0.5, stageH * 0.45, 16, ['#f8fafc', '#94a3b8'], 9, 5, 'SHARD', 0);
          break;

        case 'EXPLOSION': {
          const exDmg = Math.max(7, ev.value || 8);
          hsAudio.playSfx('big_attack', 0.9);
          hsAudio.vibrateByDamage(exDmg);
          emitImpact(exDmg);
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
          emitImpact(2);
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
            badgesRef.current.push({
              x: stageW * 0.5,
              y: stageH * 0.3,
              vy: -0.6,
              text: tr(`비밀 발동! [${ev.label}]`, `Secret Triggered! [${ev.label}]`),
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
          emitImpact(11);
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
            badgesRef.current.push({
              x: stageW * 0.5,
              y: stageH * 0.24,
              vy: -0.45,
              text: tr(`★ 전설 강림 · ${ev.label}`, `★ Legendary · ${ev.label}`),
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
          emitImpact(22, { isFinisher: true });
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
          if (hitDmg >= 5) {
            hsAudio.playSfx('big_attack', 0.8);
          } else {
            hsAudio.playSfx('attack', 0.68);
          }
          hsAudio.vibrateByDamage(hitDmg);
          emitImpact(hitDmg);
          spawnBurst(targetPos.x, targetPos.y, 8, ['#ef4444', '#fca5a5', '#fde047'], 4.5, 5, 'SHARD', 0.1);
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
            text: tr(`+${ev.value || 1} 방어도`, `+${ev.value || 1} Armor`),
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
          spawnRing(targetPos.x, targetPos.y, '#fcd34d', 74);
          spawnBurst(targetPos.x, targetPos.y, 12, ['#fef3c7', '#fbbf24', '#d6d3d1'], 4.2, 5.5, 'CIRCLE', 0.04);
          break;

        case 'MINION_DEATH':
          hsAudio.playProceduralVfxSound('DEATH_CRACK');
          spawnRing(targetPos.x, targetPos.y, '#94a3b8', 78);
          spawnBurst(targetPos.x, targetPos.y, 15, ['#e2e8f0', '#94a3b8', '#475569'], 5.6, 6.5, 'SHARD', 0.12);
          spawnBurst(targetPos.x, targetPos.y - 6, 6, ['#bae6fd', '#e0f2fe', '#c084fc'], 2.4, 5, 'CIRCLE', -0.08);
          badgesRef.current.push({
            x: targetPos.x,
            y: targetPos.y - 8,
            vy: -0.9,
            text: '☠',
            subKind: 'SKULL',
            life: 0,
            maxLife: 40,
          });
          ensureLoopRef.current();
          break;

        case 'FATIGUE_HIT': {
          const fatVal = Math.max(1, ev.value || 1);
          hsAudio.playProceduralVfxSound('FATIGUE');
          hsAudio.vibrateByDamage(Math.min(16, fatVal * 3));
          emitImpact(Math.max(5, fatVal * 2));
          spawnRing(targetPos.x, targetPos.y, '#a855f7', 148);
          spawnRing(targetPos.x, targetPos.y, '#ef4444', 96);
          spawnBurst(targetPos.x, targetPos.y, 20, ['#f43f5e', '#a855f7', '#fde047', '#312e81'], 7.2, 7.5, 'SHARD', 0.06);
          badgesRef.current.push({
            x: targetPos.x,
            y: targetPos.y - 28,
            vy: -0.95,
            text: ev.label || tr(`☠ 탈진 -${fatVal}`, `☠ Fatigue -${fatVal}`),
            subKind: 'SKULL',
            life: 0,
            maxLife: 62,
          });
          ensureLoopRef.current();
          break;
        }

        case 'MILL_BURN': {
          hsAudio.playProceduralVfxSound('CARD_BURN');
          const millPos = ev.targetId ? targetPos : { x: stageW * 0.82, y: stageH * 0.48 };
          spawnRing(millPos.x, millPos.y, '#f97316', 94);
          spawnBurst(millPos.x, millPos.y, 22, ['#fef08a', '#fb923c', '#ef4444', '#57534e'], 5.8, 7, 'SHARD', -0.09);
          badgesRef.current.push({
            x: millPos.x,
            y: millPos.y - 20,
            vy: -0.9,
            text: ev.label ? `🔥 ${ev.label}` : tr('🔥 카드 소각!', '🔥 Card Burned!'),
            subKind: 'BANNER',
            life: 0,
            maxLife: 58,
          });
          ensureLoopRef.current();
          break;
        }

        case 'FREEZE_SHARD':
          hsAudio.playProceduralVfxSound('FROST');
          spawnRing(targetPos.x, targetPos.y, '#38bdf8', 84);
          spawnBurst(targetPos.x, targetPos.y, 16, ['#e0f2fe', '#7dd3fc', '#38bdf8', '#ffffff'], 5.2, 7, 'SHARD', 0.04);
          break;

        case 'POISON_VENOM':
          hsAudio.playProceduralVfxSound('POISON');
          spawnRing(targetPos.x, targetPos.y, '#22c55e', 88);
          spawnBurst(targetPos.x, targetPos.y, 18, ['#bbf7d0', '#4ade80', '#16a34a', '#a3e635'], 5.5, 6.5, 'CIRCLE', -0.04);
          badgesRef.current.push({
            x: targetPos.x,
            y: targetPos.y - 22,
            vy: -1.0,
            text: ev.label || tr('☠ 독성!', '☠ Poisonous!'),
            subKind: 'BUFF',
            life: 0,
            maxLife: 48,
          });
          ensureLoopRef.current();
          break;

        case 'TOY_BELL':
          hsAudio.playProceduralVfxSound('TOY_BELL');
          spawnRing(targetPos.x, targetPos.y, '#fde047', 86);
          spawnBurst(targetPos.x, targetPos.y, 12, ['#fef08a', '#facc15', '#ffffff'], 4.2, 6, 'STAR', -0.05);
          if (ev.label) {
            badgesRef.current.push({
              x: targetPos.x,
              y: targetPos.y - 16,
              vy: -0.85,
              text: ev.label,
              subKind: 'BANNER',
              life: 0,
              maxLife: 42,
            });
            ensureLoopRef.current();
          }
          break;

        case 'TOY_CATAPULT':
          hsAudio.playProceduralVfxSound('TOY_CATAPULT');
          projectilesRef.current.push({
            x0: sourcePos.x,
            y0: sourcePos.y,
            x1: targetPos.x,
            y1: targetPos.y,
            t: 0,
            speed: 0.048,
            colorCore: '#d6d3d1',
            colorGlow: '#f97316',
            radius: 13,
            kind: 'TOY_CATAPULT',
          });
          ensureLoopRef.current();
          break;

        case 'TOY_SPARKS':
          hsAudio.playProceduralVfxSound('LIGHTNING');
          spawnRing(targetPos.x, targetPos.y, '#fb923c', 74);
          spawnBurst(targetPos.x, targetPos.y, 16, ['#fef08a', '#fb923c', '#38bdf8', '#ffffff'], 6.2, 6, 'SHARD', 0.08);
          break;

        case 'TOY_RADISH':
          hsAudio.playProceduralVfxSound('TOY_RADISH');
          if (ev.value === 777) {
            hsAudio.playProceduralVfxSound('LEGENDARY_FANFARE');
            spawnRing(targetPos.x, targetPos.y, '#facc15', 120);
            spawnBurst(targetPos.x, targetPos.y, 22, ['#fef08a', '#facc15', '#f59e0b', '#ffffff'], 6.8, 8, 'STAR', -0.03);
          } else {
            spawnBurst(targetPos.x, targetPos.y, 14, ['#bbf7d0', '#4ade80', '#f8fafc', '#a16207'], 5.2, 6, 'CIRCLE', 0.09);
          }
          if (ev.label) {
            badgesRef.current.push({
              x: targetPos.x,
              y: targetPos.y - 18,
              vy: -0.9,
              text: ev.label,
              subKind: 'BANNER',
              life: 0,
              maxLife: 50,
            });
            ensureLoopRef.current();
          }
          break;

        case 'TOY_SPLASH':
          hsAudio.playProceduralVfxSound('TOY_SPLASH');
          spawnRing(targetPos.x, targetPos.y, '#38bdf8', 92);
          spawnBurst(targetPos.x, targetPos.y, 16, ['#e0f2fe', '#7dd3fc', '#0284c7'], 5.2, 5.5, 'CIRCLE', 0.1);
          break;

        case 'TOY_DRUM':
          hsAudio.playProceduralVfxSound('TOY_DRUM');
          emitImpact(2);
          spawnRing(targetPos.x, targetPos.y, '#ef4444', 96);
          spawnBurst(targetPos.x, targetPos.y, 12, ['#fca5a5', '#fb923c', '#fde047'], 4.8, 5.5, 'STAR', -0.02);
          break;
      }
    }
  }, [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const syncSize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { width, height } = getViewportSize();
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
      const { width, height } = getViewportSize();

      // Check if all queues are empty => clear & go to IDLE (0% CPU/GPU)
      if (
        projectilesRef.current.length === 0 &&
        particlesRef.current.length === 0 &&
        badgesRef.current.length === 0
      ) {
        ctx.clearRect(0, 0, width, height);
        rafIdRef.current = 0;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Update & Draw Projectiles
      const nextProj: Projectile[] = [];
      for (const pr of projectilesRef.current) {
        pr.t = Math.min(1, pr.t + pr.speed);
        const arc = Math.sin(pr.t * Math.PI) * -48;
        const cx = pr.x0 + (pr.x1 - pr.x0) * pr.t;
        const cy = pr.y0 + (pr.y1 - pr.y0) * pr.t + arc;

        if (frameTick % 2 === 0 && particlesRef.current.length < MAX_ACTIVE_PARTICLES) {
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

        ctx.save();
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, pr.radius * 1.9);
        grad.addColorStop(0, pr.colorCore);
        grad.addColorStop(0.45, pr.colorGlow);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, pr.radius * 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (pr.t >= 1) {
          if (pr.kind === 'TOY_CATAPULT') {
            hsAudio.playSfx('attack', 0.62);
            emitImpact(3);
            spawnBurst(pr.x1, pr.y1, 16, ['#d6d3d1', '#a8a29e', '#fb923c', '#fde047'], 6.5, 7, 'SHARD', 0.12);
            spawnRing(pr.x1, pr.y1, '#f97316', 78);
            badgesRef.current.push({
              x: pr.x1,
              y: pr.y1 - 14,
              vy: -0.9,
              text: tr('💥 투석 명중!', '💥 Direct Hit!'),
              subKind: 'BANNER',
              life: 0,
              maxLife: 42,
            });
          } else {
            const pDmg = pr.kind === 'FIREBALL' ? 6 : pr.kind === 'SHADOW_BOLT' ? 4 : 3;
            hsAudio.vibrateByDamage(pDmg);
            emitImpact(pDmg);
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
          ctx.font = '800 24px "Nanum Gothic", "나눔고딕", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 5;
          ctx.strokeStyle = '#1e1b4b';
          ctx.strokeText(b.text, 0, 0);
          ctx.fillStyle = '#f43f5e';
          ctx.fillText(b.text, 0, 0);
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
      className="pointer-events-none fixed inset-0 z-[70] h-full w-full"
    />
  );
};
