import { COLORS, LOGICAL_W, LOGICAL_H, GAME_TITLE } from '../config.js';
import { drawWallTile, drawFigure } from '../render/draw.js';
import { createConfetti, updateConfetti, drawConfetti } from '../render/confetti.js';
import { sfxTransition, unlockAudio } from '../audio/sfx.js';

/**
 * Colorful intermission between stages.
 */
export function createTransitionScene(api) {
  let tick = 0;
  let session = null;
  let fromName = '';
  let toName = '';
  let toNum = 2;
  let total = 4;
  let veil = 1;
  let confetti = [];
  const DURATION = 160;

  // Palette shifts per stage for variety
  const STAGE_PALETTES = [
    { top: [18, 22, 40], mid: [40, 28, 48], bot: [60, 36, 28], accent: '#c9a227' },
    { top: [12, 28, 36], mid: [24, 48, 52], bot: [40, 32, 24], accent: '#40a0a0' },
    { top: [28, 16, 36], mid: [52, 28, 40], bot: [48, 28, 20], accent: '#c06080' },
    { top: [20, 20, 48], mid: [36, 32, 64], bot: [56, 40, 24], accent: '#8080e0' },
    { top: [8, 20, 40], mid: [16, 40, 64], bot: [24, 28, 36], accent: '#40e0a0' },
    { top: [10, 14, 28], mid: [20, 24, 40], bot: [30, 28, 24], accent: '#60a0ff' },
    { top: [12, 28, 20], mid: [20, 48, 32], bot: [32, 36, 20], accent: '#50c878' },
    { top: [16, 12, 32], mid: [32, 20, 48], bot: [28, 24, 36], accent: '#ff60a0' },
    // Ship era
    { top: [4, 12, 28], mid: [12, 36, 56], bot: [20, 28, 40], accent: '#40e0ff' },
    { top: [8, 8, 24], mid: [16, 28, 48], bot: [24, 32, 44], accent: '#80f0ff' },
    // Mars era
    { top: [40, 16, 10], mid: [80, 36, 16], bot: [50, 24, 12], accent: '#ff9040' },
    { top: [50, 20, 12], mid: [100, 48, 20], bot: [60, 28, 14], accent: '#ffb060' },
  ];

  return {
    enter(data) {
      session = data?.session ?? null;
      fromName = data?.fromName ?? 'Stage';
      toName = data?.toName ?? 'Next';
      toNum = data?.toNum ?? 2;
      total = data?.total ?? 4;
      tick = 0;
      veil = 1;
      confetti = createConfetti(36);
      unlockAudio();
      sfxTransition();
    },
    update(dt, input) {
      tick++;
      updateConfetti(confetti);
      if (tick < 28) veil = 1 - tick / 28;
      else if (tick > DURATION - 28) veil = (tick - (DURATION - 28)) / 28;
      else veil = 0;

      if (tick > 36 && (input.justPressed('confirm') || input.justPressed('strike'))) {
        tick = DURATION;
      }
      if (tick >= DURATION && session) {
        api.finishTransition(session);
      }
    },
    render(ctx) {
      const pal = STAGE_PALETTES[(toNum - 1) % STAGE_PALETTES.length];

      // Rich multi-band gradient
      for (let i = 0; i < 20; i++) {
        const t = i / 20;
        let col;
        if (t < 0.45) {
          const u = t / 0.45;
          col = lerpRgb(pal.top, pal.mid, u);
        } else {
          const u = (t - 0.45) / 0.55;
          col = lerpRgb(pal.mid, pal.bot, u);
        }
        ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx.fillRect(0, Math.floor(t * LOGICAL_H), LOGICAL_W, Math.ceil(LOGICAL_H / 20) + 1);
      }

      // Star / mote field
      let seed = toNum * 99991 + (tick >> 2);
      for (let i = 0; i < 40; i++) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        const sx = seed % 320;
        seed = (seed * 1103515245 + 12345) >>> 0;
        const sy = seed % 120;
        const tw = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(tick / 10 + i));
        ctx.fillStyle = `rgba(255,240,200,${tw * 0.35})`;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Carpet path
      ctx.fillStyle = '#4a2030';
      ctx.fillRect(48, 152, 224, 16);
      ctx.fillStyle = '#6a3040';
      ctx.fillRect(48, 154, 224, 4);
      ctx.fillStyle = pal.accent;
      for (let x = 56; x < 260; x += 16) {
        ctx.fillRect(x, 158, 8, 2);
      }

      // Side columns
      for (let ty = 0; ty < 6; ty++) {
        drawWallTile(ctx, 0, ty, 32);
        drawWallTile(ctx, 9, ty, 32);
      }
      for (let tx = 1; tx < 9; tx++) {
        drawWallTile(ctx, tx, 5, 32);
      }

      // Glowing gateway at the end
      const glow = 0.25 + 0.2 * Math.sin(tick / 10);
      ctx.fillStyle = `rgba(255, 200, 80, ${glow})`;
      ctx.fillRect(276, 56, 32, 104);
      ctx.fillStyle = `rgba(255, 240, 160, ${glow * 0.6})`;
      ctx.fillRect(284, 72, 16, 72);
      // Arch frame
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(278, 56, 28, 4);
      ctx.fillRect(278, 56, 4, 100);
      ctx.fillRect(302, 56, 4, 100);

      // Walking prince
      const walkX = 50 + Math.min(220, tick * 1.55);
      const bob = Math.sin(tick / 4) * 1;
      drawFigure(ctx, { x: walkX, y: 160 + bob, w: 18, h: 40, facing: 1 }, 'player', 'Run', {
        tick, swordDrawn: false,
      });

      // Soft confetti trickle
      drawConfetti(ctx, confetti);

      // Title card panel
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(48, 18, 224, 100);
      ctx.fillStyle = pal.accent;
      ctx.fillRect(48, 18, 224, 2);
      ctx.fillRect(48, 116, 224, 2);

      ctx.textAlign = 'center';
      ctx.fillStyle = pal.accent;
      ctx.font = '10px monospace';
      ctx.fillText(GAME_TITLE.toUpperCase(), LOGICAL_W / 2, 34);

      ctx.fillStyle = 'rgba(200,180,150,0.8)';
      ctx.font = '8px monospace';
      ctx.fillText(fromName, LOGICAL_W / 2, 52);

      const a = 0.55 + 0.45 * Math.sin(tick / 7);
      ctx.fillStyle = `rgba(255,230,180,${a})`;
      ctx.fillText('✦  deeper into the castle  ✦', LOGICAL_W / 2, 70);

      ctx.fillStyle = '#fff8e0';
      ctx.font = '10px monospace';
      ctx.fillText(`STAGE ${toNum}`, LOGICAL_W / 2, 90);
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '8px monospace';
      ctx.fillText(toName, LOGICAL_W / 2, 104);

      if (tick > 45) {
        ctx.fillStyle = `rgba(255,220,120,${0.5 + 0.5 * Math.sin(tick / 9)})`;
        ctx.fillText('PRESS ENTER', LOGICAL_W / 2, 140);
      }

      if (veil > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${veil})`;
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      }
      ctx.textAlign = 'left';
    },
  };
}

function lerpRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
