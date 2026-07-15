import { COLORS, LOGICAL_W, HUD_H, START_TIME_SEC } from '../config.js';

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * Status strip: life | room name | sword | timer
 * Action toasts (HIT, SPIKE) are drawn in the playfield — not here.
 */
export function drawHud(ctx, session, opts = {}) {
  const roomName = opts.roomName || '';
  const stageLabel = opts.stageLabel || '';

  // Bar background
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, 0, LOGICAL_W, HUD_H);
  // Gold bottom edge
  ctx.fillStyle = '#3a2f18';
  ctx.fillRect(0, HUD_H - 2, LOGICAL_W, 1);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(0, HUD_H - 1, LOGICAL_W, 1);

  // Life pips (left)
  const pipW = 7;
  const pipH = 6;
  for (let i = 0; i < session.maxHealth; i++) {
    const x = 4 + i * (pipW + 2);
    const y = 5;
    const filled = i < session.health;
    ctx.fillStyle = filled ? COLORS.blood : '#2a1515';
    ctx.beginPath();
    ctx.moveTo(x + pipW / 2, y);
    ctx.lineTo(x + pipW, y + pipH);
    ctx.lineTo(x, y + pipH);
    ctx.closePath();
    ctx.fill();
    if (filled) {
      ctx.fillStyle = '#e85858';
      ctx.fillRect(x + pipW / 2 - 1, y + 1, 2, 2);
    }
  }

  // Room name centered in HUD (single line, truncated)
  ctx.font = '8px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if (roomName) {
    ctx.fillStyle = COLORS.hudText;
    const label = roomName.length > 18 ? roomName.slice(0, 16) + '…' : roomName;
    ctx.fillText(label, LOGICAL_W / 2, HUD_H / 2 - 1);
  }
  if (stageLabel) {
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '7px monospace';
    ctx.fillText(stageLabel, LOGICAL_W / 2, HUD_H / 2 + 5);
  }

  // Sword badge (right of center, clear of name)
  if (session.hasSword) {
    const sx = LOGICAL_W - 62;
    ctx.fillStyle = COLORS.playerSword;
    ctx.fillRect(sx, 6, 12, 2);
    ctx.fillStyle = COLORS.exit;
    ctx.fillRect(sx + 3, 4, 5, 5);
    ctx.fillStyle = COLORS.playerSash;
    ctx.fillRect(sx + 9, 5, 3, 3);
  }

  // Timer (far right)
  const t = session.timeLeftSec ?? START_TIME_SEC;
  ctx.font = '8px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillStyle = t < 60 ? COLORS.blood : COLORS.hudText;
  ctx.fillText(formatTime(t), LOGICAL_W - 4, HUD_H / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

/** Floating action toast in playfield (HIT, SPIKE, etc.) — not in the HUD strip */
export function drawActionToast(ctx, session, playfieldY0) {
  if (!session.message || session.messageTicks <= 0) return;
  // Skip pure room names (shown in HUD)
  const msg = session.message;
  if (/^THE |^STAGE |^CRYPT |^TOWER |^UPPER |^BONE |^PORTC |^LOWER |^SPIKE |^LOCKED |^FINAL |^SANCT |^APPROACH|^CHOMPER|^GAUNTLET|^CATACOMB|^DUNGEON|^ARMORY|^GUARD|^GATE|^EXIT|^ALCOVE/i.test(msg)
      && !msg.includes('HIT') && !msg.includes('SPIKE') && !msg.includes('SWORD') && !msg.includes('LIFE')
      && !msg.includes('FELL') && !msg.includes('BLOCK') && !msg.includes('PRESS') && !msg.includes('DESCEND')
      && !msg.includes('CLIMB') && !msg.includes('HARD') && !msg.includes('POISON') && !msg.includes('OUT')) {
    // still show combat/action keywords; room titles only in HUD
    if (/^[A-Z][A-Z \-']+$/.test(msg) && !/HIT|SPIKE|SWORD|FELL|BLOCK|PRESS|LIFE|OUT|HARD|POISON/.test(msg)) {
      return;
    }
  }
  const a = Math.min(1, session.messageTicks / 12);
  const y = playfieldY0 + 20;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const w = Math.min(160, 12 + msg.length * 6);
  ctx.fillRect((LOGICAL_W - w) / 2, y - 2, w, 12);
  ctx.fillStyle = COLORS.exit;
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(msg, LOGICAL_W / 2, y);
  ctx.restore();
}
