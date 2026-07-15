import { COLORS, LOGICAL_W, LOGICAL_H, GAME_TITLE } from '../config.js';
import { drawFigure } from '../render/draw.js';
import { unlockAudio, sfxTransition, sfxStageClear } from '../audio/sfx.js';

/**
 * 8-bit cutscene: modern city → future ship (stage 8 → 9).
 */
export function createShipCutscene(api) {
  let tick = 0;
  let session = null;
  let phase = 0; // 0 city, 1 flash, 2 warp, 3 ship, 4 end
  const TOTAL = 320;

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
      ctx.fillStyle = '#060812';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      if (phase <= 1) {
        drawCityScene(ctx, t);
      } else if (phase === 2) {
        drawWarp(ctx, t - 100);
        if (Math.floor(t / 4) % 2 === 0) drawCityScene(ctx, t, 0.35);
        else drawShipScene(ctx, t, 0.35);
      } else {
        drawShipScene(ctx, t);
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
        ctx.fillStyle = '#40e0a0';
        ctx.fillText('THE SPIRE OPENS THE SKY…', LOGICAL_W / 2, 10);
        ctx.fillStyle = '#6080a0';
        ctx.fillText('A second tear — further forward', LOGICAL_W / 2, LOGICAL_H - 12);
      } else if (phase === 2) {
        ctx.fillStyle = '#80e0ff';
        const dots = '.'.repeat(1 + Math.floor((t / 8) % 4));
        ctx.fillText(`DEEP TIME WARP${dots}`, LOGICAL_W / 2, 10);
        ctx.fillStyle = '#6080a0';
        ctx.fillText('CITY → STARSHIP', LOGICAL_W / 2, LOGICAL_H - 12);
      } else {
        ctx.fillStyle = '#40e0ff';
        ctx.fillText('BOARDING THE FUTURE', LOGICAL_W / 2, 10);
        ctx.fillStyle = '#c9a227';
        ctx.fillText(`${GAME_TITLE}  ·  STAGE 9  ·  HANGAR BAY`, LOGICAL_W / 2, LOGICAL_H - 12);
      }

      if (t > 60) {
        ctx.fillStyle = `rgba(180,240,255,${0.4 + 0.4 * Math.sin(t / 8)})`;
        ctx.fillText('ENTER to skip', LOGICAL_W / 2, LOGICAL_H - 4);
      }
      ctx.textAlign = 'left';
    },
  };
}

function drawCityScene(ctx, t, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 10; i++) {
    const u = i / 10;
    ctx.fillStyle = `rgb(${4 + u * 8},${8 + u * 16},${20 + u * 40})`;
    ctx.fillRect(0, i * 18, 320, 20);
  }
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
    for (let wy = 160 - b.h + 6; wy < 150; wy += 10) {
      for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 8) {
        const lit = ((wx + wy + (t >> 2)) * 17) % 5 !== 0;
        ctx.fillStyle = lit ? '#ffe060' : '#102030';
        ctx.fillRect(wx, wy, 4, 5);
      }
    }
  }
  ctx.fillStyle = `rgba(0,255,180,${0.5 + 0.3 * Math.sin(t / 8)})`;
  ctx.fillRect(90, 70, 20, 4);
  ctx.fillStyle = `rgba(255,40,120,${0.5 + 0.3 * Math.sin(t / 6)})`;
  ctx.fillRect(180, 55, 24, 4);
  // Spire peak glow
  ctx.fillStyle = `rgba(120,200,255,${0.3 + 0.3 * Math.sin(t / 5)})`;
  ctx.fillRect(148, 30, 8, 40);
  ctx.fillStyle = '#2a2a32';
  ctx.fillRect(0, 160, 320, 40);
  ctx.fillStyle = '#e8d040';
  for (let x = 8; x < 320; x += 24) ctx.fillRect(x, 176, 12, 2);
  const px = 50 + Math.min(180, t * 1.2);
  drawFigure(ctx, { x: px, y: 160, w: 18, h: 40, facing: 1 }, 'player', 'Run', {
    tick: t, swordDrawn: true,
  });
  ctx.restore();
}

function drawShipScene(ctx, t, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  // Space gradient
  for (let i = 0; i < 10; i++) {
    const u = i / 10;
    ctx.fillStyle = `rgb(${2 + u * 6},${4 + u * 10},${18 + u * 30})`;
    ctx.fillRect(0, i * 18, 320, 20);
  }
  // Stars
  let seed = 99 + (t >> 2);
  for (let i = 0; i < 40; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    ctx.fillStyle = i % 4 === 0 ? '#80e0ff' : '#e8f0ff';
    ctx.fillRect(seed % 320, (seed >> 8) % 120, 1, 1);
  }
  // Nebula
  ctx.fillStyle = `rgba(100,40,160,${0.15 + 0.05 * Math.sin(t / 12)})`;
  ctx.fillRect(20, 20, 80, 40);
  ctx.fillStyle = `rgba(20,100,160,${0.12 + 0.05 * Math.sin(t / 10)})`;
  ctx.fillRect(200, 30, 90, 35);

  // Ship hull silhouette
  ctx.fillStyle = '#1a2838';
  ctx.fillRect(40, 70, 240, 70);
  ctx.fillRect(60, 55, 80, 20);
  ctx.fillRect(180, 50, 70, 25);
  // Nose
  ctx.fillStyle = '#243848';
  ctx.fillRect(260, 80, 40, 40);
  ctx.fillRect(290, 90, 20, 25);
  // Engine glow
  const eg = 0.4 + 0.4 * Math.sin(t / 6);
  ctx.fillStyle = `rgba(40,200,255,${eg})`;
  ctx.fillRect(30, 90, 12, 20);
  ctx.fillStyle = `rgba(180,240,255,${eg * 0.7})`;
  ctx.fillRect(28, 95, 8, 10);
  // Windows / portholes
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = ((t + i * 7) % 20 < 12) ? '#80e0ff' : '#204060';
    ctx.fillRect(70 + i * 28, 95, 10, 8);
  }
  // Docking bay open
  ctx.fillStyle = '#0a1018';
  ctx.fillRect(140, 100, 50, 40);
  ctx.fillStyle = `rgba(40,220,255,${0.2 + 0.15 * Math.sin(t / 8)})`;
  ctx.fillRect(145, 105, 40, 30);

  // Hangar deck floor
  ctx.fillStyle = '#1a2430';
  ctx.fillRect(0, 160, 320, 40);
  ctx.fillStyle = '#40c0e0';
  for (let x = 0; x < 320; x += 32) ctx.fillRect(x + 4, 168, 20, 1);
  ctx.fillStyle = '#2a3848';
  ctx.fillRect(0, 160, 320, 3);

  // Ship crew silhouette (new outfit)
  drawFigure(ctx, { x: 250, y: 160, w: 20, h: 40, facing: -1 }, 'enemy', 'FightIdle', {
    tick: t, outfit: 'ship',
  });

  // Prince entering hangar
  const px = 40 + Math.min(180, Math.max(0, (t - 200) * 1.8));
  drawFigure(ctx, { x: px, y: 160, w: 18, h: 40, facing: 1 }, 'player', 'Run', {
    tick: t, swordDrawn: true,
  });
  ctx.restore();
}

function drawWarp(ctx, tw) {
  const cx = 160;
  const cy = 100;
  for (let i = 12; i >= 0; i--) {
    const r = 8 + i * 10 + (tw % 10);
    const hue = (200 + tw * 6 + i * 20) % 360;
    ctx.strokeStyle = `hsla(${hue},85%,55%,0.35)`;
    ctx.strokeRect(cx - r, cy - r * 0.55, r * 2, r * 1.1);
  }
  for (let i = 0; i < 90; i++) {
    const x = (i * 47 + tw * 5) % 320;
    const y = (i * 31 + tw * 7) % 200;
    ctx.fillStyle = i % 2 ? '#40e0ff' : '#c080ff';
    ctx.fillRect(x, y, 2, 2);
  }
}
