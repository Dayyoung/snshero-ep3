import React, { useEffect, useRef } from 'react';
import { isKoreanLanguage } from '../../i18n/heroLang';
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

interface WindGust {
  kind: 'SWEEP' | 'STREAM' | 'TARGET_RING';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  curveOffset: number;
  color: string;
  accentColor: string;
  life: number;
  maxLife: number;
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
  if (entityId === 'SILIA_WIDGET') return { x: w * 0.08, y: h * 0.86 };
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
  const windGustsRef = useRef<WindGust[]>([]);
  const impactCbRef = useRef(onDamageImpact);
  impactCbRef.current = onDamageImpact;

  const rafIdRef = useRef<number>(0);
  const ensureLoopRef = useRef<() => void>(() => {});

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
            hsAudio.playProceduralVfxSound('HOLY');
            const yBand = stageH * 0.58;
            for (let i = 0; i < 6; i++) {
              windGustsRef.current.push({
                kind: 'SWEEP',
                x0: stageW * 0.06,
                y0: stageH * 0.86,
                x1: stageW * 0.92,
                y1: yBand + (i - 2.5) * 26,
                curveOffset: (i % 2 === 0 ? -1 : 1) * (35 + i * 10),
                color: '#34d399',
                accentColor: '#bbf7d0',
                life: 0,
                maxLife: 46 + i * 3,
              });
            }
            for (let i = 0; i < 5; i++) {
              const px = stageW * (0.22 + i * 0.14);
              spawnBurst(px, yBand, 8, ['#22c55e', '#4ade80', '#bbf7d0', '#fef08a'], 7.2, 6, 'STAR', -0.04);
              spawnRing(px, yBand, '#4ade80', 110);
            }
            badgesRef.current.push({
              x: stageW * 0.5,
              y: yBand - 42,
              vy: -0.65,
              text: ev.label || (isKoreanLanguage() ? '🛡 바람 결계!' : '🛡 Wind Barrier!'),
              subKind: 'BANNER',
              life: 0,
              maxLife: 68,
            });
          } else {
            // Targeted minion highlight: wind stream from Silia -> minion + spotlight ring + tag
            windGustsRef.current.push(
              {
                kind: 'STREAM',
                x0: sourcePos.x,
                y0: sourcePos.y,
                x1: targetPos.x,
                y1: targetPos.y,
                curveOffset: -58,
                color: '#34d399',
                accentColor: '#fde047',
                life: 0,
                maxLife: 34,
              },
              {
                kind: 'TARGET_RING',
                x0: targetPos.x,
                y0: targetPos.y,
                x1: targetPos.x,
                y1: targetPos.y,
                curveOffset: 0,
                color: '#22c55e',
                accentColor: '#fef08a',
                life: 0,
                maxLife: 58,
              },
            );
            spawnBurst(targetPos.x, targetPos.y, 12, ['#4ade80', '#fef08a', '#bbf7d0', '#ffffff'], 5.8, 6, 'STAR', -0.04);
            spawnRing(targetPos.x, targetPos.y, '#34d399', 96);
            badgesRef.current.push({
              x: targetPos.x,
              y: targetPos.y - 24,
              vy: -0.75,
              text: ev.label || (isKoreanLanguage() ? '🛡 보호막!' : '🛡 Shield!'),
              subKind: 'BUFF',
              life: 0,
              maxLife: 58,
            });
          }
          ensureLoopRef.current();
          break;
        }

        case 'SILIA_WIND_ATTACK': {
          const isStageSummary = ev.targetId === 'OPPONENT_HERO';
          if (isStageSummary) {
            hsAudio.playSfx('whoosh', 1.0);
            hsAudio.playSfx('big_attack', 0.8);
            hsAudio.vibrateByDamage(3);
            impactCbRef.current?.(3);
            const yBand = stageH * 0.34;
            for (let i = 0; i < 6; i++) {
              windGustsRef.current.push({
                kind: 'SWEEP',
                x0: stageW * 0.06,
                y0: stageH * 0.86,
                x1: stageW * 0.92,
                y1: yBand + (i - 2.5) * 26,
                curveOffset: (i % 2 === 0 ? -1 : 1) * (42 + i * 11),
                color: '#10b981',
                accentColor: '#6ee7b7',
                life: 0,
                maxLife: 46 + i * 3,
              });
            }
            for (let i = 0; i < 5; i++) {
              const px = stageW * (0.22 + i * 0.14);
              spawnBurst(px, yBand, 9, ['#10b981', '#34d399', '#6ee7b7', '#ffffff'], 8.8, 6, 'SHARD', 0);
              spawnRing(px, yBand, '#10b981', 120);
            }
            badgesRef.current.push({
              x: stageW * 0.5,
              y: yBand - 42,
              vy: -0.65,
              text: ev.label || (isKoreanLanguage() ? '🌪 녹풍 바람폭풍!' : '🌪 Emerald Windstorm!'),
              subKind: 'BANNER',
              life: 0,
              maxLife: 68,
            });
          } else {
            // Targeted enemy minion windstorm slash + spotlight ring
            windGustsRef.current.push(
              {
                kind: 'STREAM',
                x0: sourcePos.x,
                y0: sourcePos.y,
                x1: targetPos.x,
                y1: targetPos.y,
                curveOffset: -64,
                color: '#10b981',
                accentColor: '#ffffff',
                life: 0,
                maxLife: 32,
              },
              {
                kind: 'TARGET_RING',
                x0: targetPos.x,
                y0: targetPos.y,
                x1: targetPos.x,
                y1: targetPos.y,
                curveOffset: 0,
                color: '#34d399',
                accentColor: '#f87171',
                life: 0,
                maxLife: 56,
              },
            );
            spawnBurst(targetPos.x, targetPos.y, 12, ['#34d399', '#6ee7b7', '#ffffff'], 7.2, 6, 'SHARD', 0);
            spawnRing(targetPos.x, targetPos.y, '#10b981', 98);
          }
          ensureLoopRef.current();
          break;
        }

        case 'SILIA_WIND_HEAL': {
          hsAudio.playSfx('whoosh', 0.92);
          hsAudio.playProceduralVfxSound('HOLY');
          const heroPt = getEntityCenter('PLAYER_HERO');
          for (let i = 0; i < 4; i++) {
            windGustsRef.current.push({
              kind: 'STREAM',
              x0: sourcePos.x,
              y0: sourcePos.y,
              x1: heroPt.x,
              y1: heroPt.y,
              curveOffset: (i - 1.5) * 32,
              color: '#84cc16',
              accentColor: '#bbf7d0',
              life: 0,
              maxLife: 38 + i * 3,
            });
          }
          windGustsRef.current.push({
            kind: 'TARGET_RING',
            x0: heroPt.x,
            y0: heroPt.y,
            x1: heroPt.x,
            y1: heroPt.y,
            curveOffset: 0,
            color: '#4ade80',
            accentColor: '#fef08a',
            life: 0,
            maxLife: 62,
          });
          spawnBurst(heroPt.x, heroPt.y, 20, ['#4ade80', '#86efac', '#fef08a', '#ffffff'], 7.5, 6, 'STAR', -0.05);
          spawnRing(heroPt.x, heroPt.y, '#4ade80', 180);
          spawnRing(heroPt.x, heroPt.y, '#86efac', 240);
          badgesRef.current.push({
            x: heroPt.x,
            y: heroPt.y - 44,
            vy: -0.7,
            text: ev.label || '💚 +2 HP',
            subKind: 'BANNER',
            life: 0,
            maxLife: 66,
          });
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
          if (hitDmg >= 5) {
            hsAudio.playSfx('big_attack', 0.8);
          } else {
            hsAudio.playSfx('attack', 0.68);
          }
          hsAudio.vibrateByDamage(hitDmg);
          impactCbRef.current?.(hitDmg);
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
        windGustsRef.current.length === 0
      ) {
        ctx.clearRect(0, 0, width, height);
        rafIdRef.current = 0;
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // 0. Update & Draw Swirling Windstorm (`바람폭풍`) Ribbons, Target Streams & Spotlight Rings
      const nextGusts: WindGust[] = [];
      for (const wg of windGustsRef.current) {
        wg.life += 1;
        if (wg.life >= wg.maxLife) continue;
        const prog = wg.life / wg.maxLife;
        const alpha = prog < 0.2 ? prog / 0.2 : prog > 0.72 ? (1 - prog) / 0.28 : 1;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        if (wg.kind === 'TARGET_RING') {
          const pulse = 1 + Math.sin(prog * Math.PI * 5) * 0.14;
          const rOuter = (44 + prog * 28) * pulse;
          const rInner = Math.max(22, 34 * pulse);
          // Soft emerald spotlight halo over the affected minion / hero
          ctx.fillStyle = wg.color;
          ctx.globalAlpha = Math.max(0, alpha * 0.22);
          ctx.beginPath();
          ctx.arc(wg.x0, wg.y0, rOuter, 0, Math.PI * 2);
          ctx.fill();

          ctx.globalAlpha = Math.max(0, alpha * 0.92);
          ctx.strokeStyle = wg.accentColor;
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.arc(wg.x0, wg.y0, rInner, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = wg.color;
          ctx.lineWidth = 4;
          ctx.setLineDash([12, 8]);
          ctx.lineDashOffset = -wg.life * 2.8;
          ctx.beginPath();
          ctx.arc(wg.x0, wg.y0, rOuter, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Curved windstream or sinusoidal sweeping windstorm arc
          const mx = (wg.x0 + wg.x1) * 0.5;
          const my = (wg.y0 + wg.y1) * 0.5 + wg.curveOffset * Math.sin(prog * Math.PI + 0.5);
          const headT = Math.min(1, prog * 1.45);
          const tailT = Math.max(0, prog * 1.25 - 0.35);

          const bezierPt = (t: number) => {
            const u = 1 - t;
            const waveY =
              wg.kind === 'SWEEP'
                ? Math.sin(t * Math.PI * 3.0 - prog * 6.0) * (18 + Math.abs(wg.curveOffset) * 0.25)
                : Math.sin(t * Math.PI * 2.0) * 10;
            return {
              x: u * u * wg.x0 + 2 * u * t * mx + t * t * wg.x1,
              y: u * u * wg.y0 + 2 * u * t * my + t * t * wg.y1 + waveY,
            };
          };

          const steps = 14;
          ctx.lineCap = 'round';
          ctx.strokeStyle = wg.color;
          ctx.lineWidth = wg.kind === 'SWEEP' ? 7 : 5;
          ctx.beginPath();
          for (let s = 0; s <= steps; s++) {
            const t = tailT + ((headT - tailT) * s) / steps;
            const pt = bezierPt(t);
            if (s === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();

          ctx.strokeStyle = wg.accentColor;
          ctx.lineWidth = wg.kind === 'SWEEP' ? 2.5 : 2;
          ctx.beginPath();
          for (let s = 0; s <= steps; s++) {
            const t = tailT + ((headT - tailT) * s) / steps;
            const pt = bezierPt(t);
            if (s === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }
        ctx.restore();
        nextGusts.push(wg);
      }
      windGustsRef.current = nextGusts;

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
      className="pointer-events-none absolute inset-0 z-[70] h-full w-full"
    />
  );
});
