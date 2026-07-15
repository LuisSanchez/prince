import { COLORS, LOGICAL_W, LOGICAL_H, GAME_TITLE } from '../config.js';
import { drawFigure } from '../render/draw.js';
import { unlockAudio, sfxTransition, sfxStageClear } from '../audio/sfx.js';

/**
 * 8-bit "video" cutscene: castle era → modern city (stage 4 → 5).
 */
export function createEraCutscene(api) {
  let tick = 0;
  let session = null;
  let phase = 0; // 0 intro, 1 flash, 2 warp, 3 modern, 4 end
  const TOTAL = 320; // ~5.3s

  return {
    enter(data) {
      session = data?.session ?? null;
      tick = 0;
      phase = 0;
      unlockAudio();
      sfxTransition();
    },
    update(dt, input) {
      tick++;
      if (tick < 70) phase = 0;
      else if (tick < 100) phase = 1;
      else if (tick < 200) phase = 2;
      else if (tick < 280) phase = 3;
      else phase = 4;

      if (tick === 100) sfxTransition();
      if (tick === 200) sfxStageClear();

      if (tick > 80 && (input.justPressed('confirm') || input.justPressed('strike'))) {
        tick = TOTAL;
      }
      if (tick >= TOTAL && session) {
        api.finishTransition(session);
      }
    },
    render(ctx) {
      const t = tick;
      // CRT-ish dark
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      if (phase <= 1) {
        drawCastleScene(ctx, t);
      } else if (phase === 2) {
        // Warp tunnel
        drawWarp(ctx, t - 100);
        // Flicker between eras
        if (Math.floor(t / 4) % 2 === 0) drawCastleScene(ctx, t, 0.35);
        else drawModernScene(ctx, t, 0.35);
      } else {
        drawModernScene(ctx, t);
      }

      // Scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < LOGICAL_H; y += 2) {
        ctx.fillRect(0, y, LOGICAL_W, 1);
      }

      // Letterbox
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, LOGICAL_W, 18);
      ctx.fillRect(0, LOGICAL_H - 22, LOGICAL_W, 22);

      ctx.textAlign = 'center';
      ctx.font = '8px monospace';
      if (phase <= 1) {
        ctx.fillStyle = '#c9a227';
        ctx.fillText('THE THRONE FALLS…', LOGICAL_W / 2, 10);
        ctx.fillStyle = '#a09070';
        ctx.fillText('A tear opens in time', LOGICAL_W / 2, LOGICAL_H - 12);
      } else if (phase === 2) {
        ctx.fillStyle = '#80e0ff';
        const dots = '.'.repeat(1 + Math.floor((t / 8) % 4));
        ctx.fillText(`TIME WARP${dots}`, LOGICAL_W / 2, 10);
        ctx.fillStyle = '#6080a0';
        ctx.fillText('8-BIT ERA SHIFT', LOGICAL_W / 2, LOGICAL_H - 12);
      } else {
        ctx.fillStyle = '#40e0a0';
        ctx.fillText('WELCOME TO THE MODERN ERA', LOGICAL_W / 2, 10);
        ctx.fillStyle = '#c9a227';
        ctx.fillText(`${GAME_TITLE}  ·  STAGE 5  ·  NEON STREETS`, LOGICAL_W / 2, LOGICAL_H - 12);
      }

      if (t > 60) {
        ctx.fillStyle = `rgba(255,240,180,${0.4 + 0.4 * Math.sin(t / 8)})`;
        ctx.fillText('ENTER to skip', LOGICAL_W / 2, LOGICAL_H - 4);
      }
      ctx.textAlign = 'left';
    },
  };
}

function drawCastleScene(ctx, t, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  // Night sky
  for (let i = 0; i < 10; i++) {
    const u = i / 10;
    ctx.fillStyle = `rgb(${8 + u * 10},${8 + u * 8},${20 + u * 20})`;
    ctx.fillRect(0, i * 18, 320, 20);
  }
  // Stars
  let seed = 42 + (t >> 3);
  for (let i = 0; i < 24; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(seed % 320, (seed >> 8) % 80, 1, 1);
  }
  // Castle silhouette
  ctx.fillStyle = '#1a1420';
  ctx.fillRect(40, 90, 240, 80);
  ctx.fillRect(60, 50, 40, 50);
  ctx.fillRect(220, 40, 36, 60);
  ctx.fillRect(140, 60, 50, 40);
  // Merlons
  for (let x = 40; x < 280; x += 16) {
    ctx.fillRect(x, 82, 10, 10);
  }
  // Moon
  ctx.fillStyle = '#e8d4a8';
  ctx.fillRect(260, 24, 16, 16);
  ctx.fillStyle = `rgb(${8},${8},${20})`;
  ctx.fillRect(266, 24, 12, 12);
  // Torch
  const fl = (t % 6) < 3;
  ctx.fillStyle = fl ? '#ffaa40' : '#ff6020';
  ctx.fillRect(90, 100, 4, 8);
  ctx.fillRect(230, 100, 4, 8);
  // Prince walking
  const px = 50 + Math.min(180, t * 1.2);
  drawFigure(ctx, { x: px, y: 160, w: 18, h: 40, facing: 1 }, 'player', 'Run', {
    tick: t, swordDrawn: true,
  });
  // Ground
  ctx.fillStyle = '#3a2c1c';
  ctx.fillRect(0, 160, 320, 40);
  ctx.fillStyle = '#5a4530';
  for (let x = 0; x < 320; x += 16) ctx.fillRect(x, 160, 14, 2);
  ctx.restore();
}

function drawModernScene(ctx, t, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  // City night sky
  for (let i = 0; i < 10; i++) {
    const u = i / 10;
    ctx.fillStyle = `rgb(${4 + u * 8},${8 + u * 16},${20 + u * 40})`;
    ctx.fillRect(0, i * 18, 320, 20);
  }
  // Buildings
  const buildings = [
    { x: 10, w: 36, h: 90, c: '#1a2840' },
    { x: 50, w: 28, h: 70, c: '#243050' },
    { x: 82, w: 44, h: 110, c: '#1e3048' },
    { x: 130, w: 32, h: 85, c: '#283858' },
    { x: 168, w: 50, h: 100, c: '#1a3050' },
    { x: 222, w: 30, h: 75, c: '#243848' },
    { x: 256, w: 50, h: 95, c: '#1c2840' },
  ];
  for (const b of buildings) {
    ctx.fillStyle = b.c;
    ctx.fillRect(b.x, 160 - b.h, b.w, b.h);
    // Windows
    for (let wy = 160 - b.h + 6; wy < 150; wy += 10) {
      for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 8) {
        const lit = ((wx + wy + (t >> 2)) * 17) % 5 !== 0;
        ctx.fillStyle = lit ? '#ffe060' : '#102030';
        ctx.fillRect(wx, wy, 4, 5);
      }
    }
  }
  // Neon signs
  ctx.fillStyle = `rgba(0,255,180,${0.5 + 0.3 * Math.sin(t / 8)})`;
  ctx.fillRect(90, 70, 20, 4);
  ctx.fillStyle = `rgba(255,40,120,${0.5 + 0.3 * Math.sin(t / 6)})`;
  ctx.fillRect(180, 55, 24, 4);
  // Trees
  drawTree(ctx, 30, 160);
  drawTree(ctx, 300, 160);
  // Street
  ctx.fillStyle = '#2a2a32';
  ctx.fillRect(0, 160, 320, 40);
  ctx.fillStyle = '#e8d040';
  for (let x = 8; x < 320; x += 24) {
    ctx.fillRect(x, 176, 12, 2);
  }
  // Sidewalk
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(0, 156, 320, 6);
  // Prince
  const px = 40 + Math.min(200, Math.max(0, (t - 200) * 1.8));
  drawFigure(ctx, { x: px, y: 160, w: 18, h: 40, facing: 1 }, 'player', 'Run', {
    tick: t, swordDrawn: true,
  });
  ctx.restore();
}

function drawTree(ctx, baseX, baseY) {
  ctx.fillStyle = '#3a2818';
  ctx.fillRect(baseX - 2, baseY - 28, 4, 28);
  ctx.fillStyle = '#1a5030';
  ctx.fillRect(baseX - 10, baseY - 40, 20, 16);
  ctx.fillStyle = '#288050';
  ctx.fillRect(baseX - 8, baseY - 44, 16, 12);
  ctx.fillStyle = '#40a060';
  ctx.fillRect(baseX - 5, baseY - 48, 10, 8);
}

function drawWarp(ctx, tw) {
  const cx = 160;
  const cy = 100;
  for (let i = 12; i >= 0; i--) {
    const r = 8 + i * 10 + (tw % 10);
    const hue = (tw * 8 + i * 25) % 360;
    ctx.strokeStyle = `hsla(${hue},80%,60%,0.35)`;
    ctx.strokeRect(cx - r, cy - r * 0.6, r * 2, r * 1.2);
  }
  // Pixel noise
  for (let i = 0; i < 80; i++) {
    const x = (i * 47 + tw * 3) % 320;
    const y = (i * 31 + tw * 5) % 200;
    ctx.fillStyle = i % 2 ? '#80ffff' : '#ff80ff';
    ctx.fillRect(x, y, 2, 2);
  }
}
