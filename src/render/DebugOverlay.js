import { COLORS, HUD_H } from '../config.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} info
 */
export function drawDebug(ctx, info) {
  if (!info.enabled) return;
  ctx.save();
  ctx.translate(0, HUD_H);
  ctx.strokeStyle = COLORS.debug;
  ctx.fillStyle = COLORS.debug;
  ctx.font = '8px monospace';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.85;

  for (const box of info.boxes ?? []) {
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w, box.h);
  }

  const lines = [
    `fps~ ${info.fps ?? '?'}  room ${info.roomId ?? '?'}`,
    `state ${info.state ?? '?'}  sword ${info.hasSword ? 'Y' : 'N'}`,
    `pos ${info.x?.toFixed?.(1)} ${info.y?.toFixed?.(1)}  fight ${info.fight ?? '-'}`,
    `hp ${info.health}/${info.maxHealth}  t ${info.timeLeftSec?.toFixed?.(0)}`,
  ];
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(2, 2, 160, 36);
  ctx.fillStyle = COLORS.debug;
  lines.forEach((l, i) => ctx.fillText(l, 4, 4 + i * 9));
  ctx.restore();
}
