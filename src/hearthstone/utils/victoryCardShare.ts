import { HeroClass } from '../types';

export interface VictoryCardParams {
  isKo: boolean;
  playerName: string;
  heroClass: HeroClass;
  opponentName: string;
  turnCount: number;
  episode?: number;
  goldEarned: number;
}

/**
 * Generates a 1200x630 shareable dark-fantasy victory certificate PNG on canvas
 * and triggers a 1-click download + URL copy (MKT-049).
 */
export function downloadVictoryCertificatePng(params: VictoryCardParams): void {
  if (typeof document === 'undefined') return;
  const w = 1200;
  const h = 630;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Deep obsidian-mahogany backdrop
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.38, 60, w * 0.5, h * 0.5, 760);
  bg.addColorStop(0, '#3a1f0b');
  bg.addColorStop(0.55, '#190d06');
  bg.addColorStop(1, '#080402');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Outer brass gold frame
  ctx.strokeStyle = '#d4af63';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, w - 40, h - 40);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(34, 34, w - 68, h - 68);

  // Header badge
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    params.isKo ? '🏆 SNSHero.com — 눈히어로 공식 승리 인증서' : '🏆 SNSHero.com — Official Victory Certificate',
    w / 2,
    92,
  );

  // Main Victory headline
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px sans-serif';
  const stageText = params.episode
    ? params.isKo
      ? `제${params.episode}화 보스 토벌 완료!`
      : `Episode ${params.episode} Boss Cleared!`
    : params.isKo
      ? '엘윈 성소 결투 승리!'
      : 'Elwin Sanctuary Victory!';
  ctx.fillText(stageText, w / 2, 185);

  // Divider
  ctx.strokeStyle = 'rgba(212, 175, 99, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(140, 224);
  ctx.lineTo(w - 140, 224);
  ctx.stroke();

  // Stats Box
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(140, 260, w - 280, 200);
  ctx.strokeStyle = '#c8a158';
  ctx.lineWidth = 2;
  ctx.strokeRect(140, 260, w - 280, 200);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fcd34d';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(
    `${params.isKo ? '지휘관' : 'Commander'}: ${params.playerName} (${params.heroClass})`,
    190,
    322,
  );
  ctx.fillStyle = '#f8ebd2';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(`${params.isKo ? '격파 상대' : 'Defeated'}: ${params.opponentName}`, 190, 376);
  ctx.fillStyle = '#6ee7b7';
  ctx.fillText(
    `${params.isKo ? '클리어 턴' : 'Turns'}: ${params.turnCount}T   ·   +${params.goldEarned}G   ·   382 Cards / 3x Awakening`,
    190,
    430,
  );

  // CTA Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(
    params.isKo
      ? '나도 무료 3팩 + 250골드 받고 지금 도전하기 👉 https://snshero.com/game'
      : 'Claim 3 Free Packs + 250G & Challenge This Record 👉 https://snshero.com/game',
    w / 2,
    542,
  );

  const link = document.createElement('a');
  link.download = `snshero_victory_${params.episode || 'duel'}_${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();

  try {
    const shareUrl = `https://snshero.com/game.html?utm_source=victory_card${params.episode ? `&mode=story&ep=${params.episode}` : ''}`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(shareUrl);
    }
  } catch {
    // ignore clipboard block
  }
}
