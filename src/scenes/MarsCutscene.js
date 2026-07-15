import { COLORS, LOGICAL_W, LOGICAL_H, GAME_TITLE } from '../config.js';
import { drawFigure } from '../render/draw.js';
import { unlockAudio, sfxTransition, sfxStageClear, sfxTrap, sfxDeath } from '../audio/sfx.js';

/**
 * Cinematic: starship falls from deep space into Mars (stage 10 → 11).
 * Phases: alarm → freefall → re-entry fire → impact → wreck surface.
 */
export function createMarsCutscene(api) {
  let tick = 0;
  let session = null;
  let phase = 0;
  // ~7.5s at 60fps — longer, more dramatic than other warps
  const TOTAL = 450;

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
      if (tick < 70) phase = 0;       // bridge alarm
      else if (tick < 140) phase = 1;  // ship leaves / freefall
      else if (tick < 240) phase = 2;  // atmospheric re-entry
      else if (tick < 300) phase = 3;  // impact flash
      else if (tick < 390) phase = 4;  // wreck on Mars
      else phase = 5;                 // title card

      if (tick === 70) sfxTrap();
      if (tick === 140) sfxTransition();
      if (tick === 240) sfxDeath();
      if (tick === 300) sfxStageClear();

      if (tick > 90 && (input.justPressed('confirm') || input.justPressed('strike'))) {
        tick = TOTAL;
      }
      if (tick >= TOTAL && session) {
        api.finishTransition(session);
      }
    },
    render(ctx) {
      const t = tick;
      ctx.fillStyle = '#08040a';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      if (phase === 0) {
        drawBridgeAlarm(ctx, t);
      } else if (phase === 1) {
        drawFreefall(ctx, t - 70);
      } else if (phase === 2) {
        drawReentry(ctx, t - 140);
      } else if (phase === 3) {
        drawImpact(ctx, t - 240);
      } else {
        drawMarsWreck(ctx, t - 300, phase >= 5);
      }

      // CRT scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      for (let y = 0; y < LOGICAL_H; y += 2) ctx.fillRect(0, y, LOGICAL_W, 1);

      // Letterbox
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, LOGICAL_W, 18);
      ctx.fillRect(0, LOGICAL_H - 22, LOGICAL_W, 22);

      ctx.textAlign = 'center';
      ctx.font = '8px monospace';
      const captions = [
        ['BRIDGE ALERT — HULL BREACH', 'The hourglass cracks…'],
        ['ORBIT LOST', 'Ship is falling'],
        ['ATMOSPHERIC ENTRY', 'Mars reaches up'],
        ['IMPACT', '…'],
        ['CRASH SITE — RED PLANET', `${GAME_TITLE}  ·  STAGE 11`],
        ['THE PRINCESS WAITS AHEAD', `${GAME_TITLE}  ·  CRASH SITE`],
      ];
      const cap = captions[Math.min(phase, captions.length - 1)];
      ctx.fillStyle = phase === 3 ? '#ff6040' : phase >= 4 ? '#ffb060' : '#80e0ff';
      ctx.fillText(cap[0], LOGICAL_W / 2, 10);
      ctx.fillStyle = phase >= 4 ? '#c9a227' : '#708090';
      ctx.fillText(cap[1], LOGICAL_W / 2, LOGICAL_H - 12);

      if (t > 70) {
        ctx.fillStyle = `rgba(255,200,140,${0.35 + 0.35 * Math.sin(t / 8)})`;
        ctx.fillText('ENTER to skip', LOGICAL_W / 2, LOGICAL_H - 4);
      }
      ctx.textAlign = 'left';
    },
  };
}

function stars(ctx, t, count = 50, drift = 0) {
  let seed = 77 + (t >> 3);
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const x = (seed % 320 + drift * (1 + (i % 3))) % 320;
    seed = (seed * 1103515245 + 12345) >>> 0;
    const y = seed % 180;
    ctx.fillStyle = i % 5 === 0 ? '#ffd0a0' : '#e8f0ff';
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawShipHull(ctx, x, y, scale = 1, angleDeg = 0, flame = 0) {
  ctx.save();
  ctx.translate(x, y);
  // crude rotate via shear-ish offset (canvas rotate)
  ctx.rotate((angleDeg * Math.PI) / 180);
  const s = scale;
  // body
  ctx.fillStyle = '#1a2838';
  ctx.fillRect(-50 * s, -12 * s, 100 * s, 24 * s);
  ctx.fillStyle = '#243848';
  ctx.fillRect(-30 * s, -20 * s, 40 * s, 12 * s);
  // nose
  ctx.fillStyle = '#2a3848';
  ctx.fillRect(40 * s, -8 * s, 22 * s, 16 * s);
  // windows
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = flame > 0.3 ? '#ff8040' : '#40c0e0';
    ctx.fillRect((-20 + i * 12) * s, -4 * s, 6 * s, 5 * s);
  }
  // engine
  if (flame > 0) {
    const fl = 0.5 + 0.5 * Math.sin(flame * 20);
    ctx.fillStyle = `rgba(255,120,40,${0.5 + fl * 0.4})`;
    ctx.fillRect(-70 * s, -6 * s, 22 * s, 12 * s);
    ctx.fillStyle = `rgba(255,220,120,${0.4 + fl * 0.4})`;
    ctx.fillRect(-80 * s, -3 * s, 14 * s, 6 * s);
  }
  ctx.restore();
}

function drawBridgeAlarm(ctx, t) {
  // Dim ship interior
  for (let i = 0; i < 12; i++) {
    const u = i / 12;
    ctx.fillStyle = `rgb(${Math.floor(8 + u * 12)},${Math.floor(10 + u * 14)},${Math.floor(18 + u * 20)})`;
    ctx.fillRect(0, i * 16, 320, 18);
  }
  // Consoles
  ctx.fillStyle = '#141c28';
  ctx.fillRect(20, 100, 80, 50);
  ctx.fillRect(220, 100, 80, 50);
  const flash = (t % 16) < 8;
  ctx.fillStyle = flash ? '#ff3040' : '#401018';
  ctx.fillRect(30, 110, 60, 8);
  ctx.fillRect(230, 110, 60, 8);
  ctx.fillStyle = flash ? '#ff8060' : '#40a0c0';
  ctx.fillRect(40, 125, 20, 12);
  ctx.fillRect(250, 125, 20, 12);
  // Viewport — Mars growing
  ctx.fillStyle = '#060810';
  ctx.fillRect(110, 40, 100, 70);
  stars(ctx, t, 20);
  const marsR = 10 + t * 0.15;
  ctx.fillStyle = '#a04020';
  ctx.beginPath();
  ctx.arc(160, 100, marsR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#602010';
  ctx.fillRect(150, 95, 20, 8);
  // Floor
  ctx.fillStyle = '#1a2430';
  ctx.fillRect(0, 155, 320, 45);
  ctx.fillStyle = '#40c0e0';
  ctx.fillRect(40, 162, 240, 1);
  // Prince staggering
  const px = 140 + Math.sin(t / 10) * 4;
  drawFigure(ctx, { x: px, y: 160, w: 18, h: 40, facing: 1 }, 'player', 'Idle', {
    tick: t, swordDrawn: true,
  });
  // Red alarm wash
  if (flash) {
    ctx.fillStyle = 'rgba(255,20,20,0.12)';
    ctx.fillRect(0, 18, 320, 160);
  }
}

function drawFreefall(ctx, tw) {
  // Space gradient
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = `rgb(${2 + i},${4 + i * 2},${16 + i * 4})`;
    ctx.fillRect(0, i * 16, 320, 18);
  }
  stars(ctx, tw, 60, tw * 2);
  // Mars disk rising from bottom
  const marsY = 220 - tw * 0.9;
  const marsR = 50 + tw * 0.4;
  ctx.fillStyle = '#8a3018';
  ctx.beginPath();
  ctx.arc(160, marsY, marsR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a2010';
  ctx.beginPath();
  ctx.arc(140, marsY - 10, marsR * 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Tumbling ship
  const sx = 80 + tw * 1.5;
  const sy = 50 + Math.sin(tw / 8) * 20 + tw * 0.4;
  const ang = -20 + tw * 2.5;
  drawShipHull(ctx, sx, sy, 0.9, ang, 0.5 + tw / 80);
  // Debris
  for (let i = 0; i < 12; i++) {
    const dx = (sx + i * 17 + tw * 3) % 320;
    const dy = (sy + i * 11 + tw * 2) % 180;
    ctx.fillStyle = '#4a6070';
    ctx.fillRect(dx, dy, 2 + (i % 3), 2);
  }
}

function drawReentry(ctx, tw) {
  // Scorched atmosphere
  for (let i = 0; i < 14; i++) {
    const u = i / 14;
    const r = Math.floor(30 + u * 80 + Math.sin(tw / 5 + i) * 20);
    const g = Math.floor(10 + u * 30);
    const b = Math.floor(8 + u * 10);
    ctx.fillStyle = `rgb(${Math.min(255, r)},${g},${b})`;
    ctx.fillRect(0, i * 14, 320, 16);
  }
  // Heat streaks
  for (let i = 0; i < 40; i++) {
    const x = (i * 23 + tw * 8) % 340 - 10;
    const y = (i * 17 + tw * 5) % 200;
    ctx.fillStyle = `rgba(255,${120 + (i % 5) * 20},40,0.35)`;
    ctx.fillRect(x, y, 1, 8 + (i % 6));
  }
  // Mars filling frame
  ctx.fillStyle = '#6a2810';
  ctx.fillRect(0, 120 + Math.sin(tw / 6) * 4, 320, 80);
  ctx.fillStyle = '#4a1808';
  // Canyon jagged
  for (let x = 0; x < 320; x += 20) {
    const h = 20 + ((x * 7 + tw) % 40);
    ctx.fillRect(x, 200 - h, 20, h);
  }
  // Ship in fireball
  const sx = 100 + tw * 0.8;
  const sy = 40 + tw * 0.5;
  const fire = 1 + Math.sin(tw / 3) * 0.3;
  ctx.fillStyle = `rgba(255,80,20,${0.35 + fire * 0.2})`;
  ctx.beginPath();
  ctx.arc(sx, sy, 40 * fire, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,200,80,${0.4})`;
  ctx.beginPath();
  ctx.arc(sx - 10, sy, 22, 0, Math.PI * 2);
  ctx.fill();
  drawShipHull(ctx, sx, sy, 0.85, 35 + tw * 1.2, 1.5);
  // Screen shake overlay
  if (tw % 4 < 2) {
    ctx.fillStyle = 'rgba(255,100,40,0.08)';
    ctx.fillRect(0, 18, 320, 160);
  }
}

function drawImpact(ctx, tw) {
  // White → orange flash
  const flash = Math.max(0, 1 - tw / 40);
  ctx.fillStyle = `rgb(${Math.floor(255 * flash + 40)},${Math.floor(180 * flash + 20)},${Math.floor(80 * flash)})`;
  ctx.fillRect(0, 0, 320, 200);
  // Expanding dust ring
  const r = 20 + tw * 3;
  ctx.strokeStyle = `rgba(180,100,50,${Math.max(0, 0.6 - tw / 80)})`;
  ctx.strokeRect(160 - r, 110 - r * 0.5, r * 2, r);
  // Ground silhouette
  ctx.fillStyle = '#2a1008';
  ctx.fillRect(0, 150, 320, 50);
  // Debris spray
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI - Math.PI / 2;
    const dist = tw * (2 + (i % 5));
    const x = 160 + Math.cos(a) * dist;
    const y = 150 + Math.sin(a) * dist * 0.5;
    ctx.fillStyle = '#8a5030';
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawMarsWreck(ctx, tw, showTitle) {
  // Peach sky
  for (let i = 0; i < 12; i++) {
    const u = i / 12;
    ctx.fillStyle = `rgb(${Math.floor(50 + u * 40)},${Math.floor(22 + u * 16)},${Math.floor(14 + u * 8)})`;
    ctx.fillRect(0, i * 14, 320, 16);
  }
  // Sun
  ctx.fillStyle = 'rgba(255,200,100,0.25)';
  ctx.beginPath(); ctx.arc(260, 40, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c070';
  ctx.fillRect(254, 34, 12, 12);
  // Distant mesas
  ctx.fillStyle = '#3a180c';
  ctx.fillRect(0, 90, 60, 70);
  ctx.fillRect(40, 70, 50, 90);
  ctx.fillRect(220, 80, 40, 80);
  ctx.fillRect(270, 60, 50, 100);
  // Dust wind
  for (let i = 0; i < 25; i++) {
    const x = (i * 19 + tw * 2) % 320;
    const y = 50 + (i * 7) % 90;
    ctx.fillStyle = 'rgba(200,130,70,0.15)';
    ctx.fillRect(x, y, 3, 1);
  }
  // Crashed ship half-buried
  ctx.fillStyle = '#1a2430';
  ctx.fillRect(40, 120, 120, 30);
  ctx.fillRect(30, 130, 40, 20);
  ctx.fillStyle = '#243848';
  ctx.fillRect(80, 110, 50, 20);
  // Scorch
  ctx.fillStyle = 'rgba(20,8,4,0.5)';
  ctx.fillRect(20, 145, 160, 12);
  // Smoke plumes
  for (let i = 0; i < 5; i++) {
    const sy = 100 - ((tw + i * 10) % 40);
    ctx.fillStyle = `rgba(80,60,50,${0.25 - i * 0.04})`;
    ctx.fillRect(60 + i * 8, sy, 10 + i * 2, 8);
  }
  // Amber fire remnants
  if ((tw % 8) < 5) {
    ctx.fillStyle = '#ff6020';
    ctx.fillRect(90, 118, 4, 6);
    ctx.fillStyle = '#ffc040';
    ctx.fillRect(92, 116, 2, 3);
  }
  // Ground
  ctx.fillStyle = '#5a3020';
  ctx.fillRect(0, 155, 320, 45);
  ctx.fillStyle = '#7a4830';
  for (let x = 0; x < 320; x += 16) ctx.fillRect(x, 155, 12, 2);

  // Mars enforcer watching
  drawFigure(ctx, { x: 250, y: 160, w: 20, h: 40, facing: -1 }, 'enemy', 'FightIdle', {
    tick: tw, outfit: 'mars',
  });

  // Prince climbs from wreck
  const px = 50 + Math.min(120, Math.max(0, tw * 1.2));
  const label = tw < 40 ? 'Crouch' : 'Run';
  drawFigure(ctx, { x: px, y: 160, w: 18, h: 40, facing: 1 }, 'player', label, {
    tick: tw, swordDrawn: true,
  });

  if (showTitle) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(40, 70, 240, 36);
  }
}
