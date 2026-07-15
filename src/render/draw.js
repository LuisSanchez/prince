/**
 * Original-inspired pixel drawing helpers (not commercial art).
 * All coordinates are playfield space unless noted.
 */
import { COLORS, TILE } from '../config.js';

/** Brick / stone wall tile with richer mortar + grit texture */
export function drawWallTile(c, tx, ty, tileSize = TILE, theme = 'dungeon') {
  if (theme === 'modern') {
    drawModernTile(c, tx, ty, tileSize);
    return;
  }
  if (theme === 'ship') {
    drawShipTile(c, tx, ty, tileSize);
    return;
  }
  if (theme === 'mars') {
    drawMarsTile(c, tx, ty, tileSize);
    return;
  }
  const x = tx * tileSize;
  const y = ty * tileSize;
  const isFloor = ty >= 5;
  const base = isFloor ? COLORS.floor : COLORS.wall;
  const hi = isFloor ? COLORS.floorHi : COLORS.wallHi;
  const lo = isFloor ? COLORS.floorLo : COLORS.wallLo;

  c.fillStyle = base;
  c.fillRect(x, y, tileSize, tileSize);

  // Per-tile noise seed for irregular stone
  let seed = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;

  if (isFloor) {
    // Stone slab floor: irregular cracks + polish
    c.fillStyle = hi;
    c.fillRect(x + 1, y + 1, tileSize - 2, 2);
    c.fillStyle = lo;
    c.fillRect(x + 1, y + tileSize - 3, tileSize - 2, 2);
    // Slab grid
    c.fillStyle = 'rgba(20,12,8,0.35)';
    c.fillRect(x + 15, y, 1, tileSize);
    c.fillRect(x, y + 15, tileSize, 1);
    // Speckles
    for (let i = 0; i < 6; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const px = x + 2 + (seed % (tileSize - 4));
      seed = (seed * 1103515245 + 12345) >>> 0;
      const py = y + 2 + (seed % (tileSize - 4));
      c.fillStyle = (seed & 1) ? hi : lo;
      c.fillRect(px, py, 1, 1);
    }
  } else {
    // Brick courses (offset rows)
    for (let by = 0; by < tileSize; by += 8) {
      const odd = ((by / 8) + tx) % 2 === 0;
      c.fillStyle = lo;
      c.fillRect(x, y + by, tileSize, 1);
      // vertical mortar
      const off = odd ? 0 : 16;
      c.fillRect(x + off, y + by, 1, 8);
      c.fillRect(x + off + 16, y + by, 1, 8);
      // brick face variation
      seed = (seed * 1103515245 + 12345) >>> 0;
      if ((seed % 5) === 0) {
        c.fillStyle = hi;
        c.fillRect(x + off + 2, y + by + 2, 10, 4);
      }
      seed = (seed * 1103515245 + 12345) >>> 0;
      if ((seed % 7) === 0) {
        c.fillStyle = 'rgba(0,0,0,0.15)';
        c.fillRect(x + off + 3, y + by + 3, 8, 3);
      }
    }
    // Edge bevel
    c.fillStyle = hi;
    c.fillRect(x, y, tileSize, 1);
    c.fillRect(x, y, 1, tileSize);
    c.fillStyle = lo;
    c.fillRect(x, y + tileSize - 1, tileSize, 1);
    c.fillRect(x + tileSize - 1, y, 1, tileSize);
  }
}

/** Richer dungeon backdrop with torch glow and depth */
export function drawRoomBackdrop(c, roomId, tick = 0, theme = 'dungeon') {
  if (theme === 'modern') {
    drawModernBackdrop(c, roomId, tick);
    return;
  }
  if (theme === 'ship') {
    drawShipBackdrop(c, roomId, tick);
    return;
  }
  if (theme === 'mars') {
    drawMarsBackdrop(c, roomId, tick);
    return;
  }
  // Multi-stop vertical gradient (cooler sky → warm dark)
  for (let i = 0; i < 16; i++) {
    const t = i / 16;
    const r = Math.floor(10 + t * 18);
    const g = Math.floor(12 + t * 10);
    const b = Math.floor(22 + t * 8);
    c.fillStyle = `rgb(${r},${g},${b})`;
    c.fillRect(0, Math.floor(t * 192), 320, 14);
  }

  // Distant wall columns
  c.fillStyle = 'rgba(14,16,22,0.85)';
  c.fillRect(36, 28, 14, 140);
  c.fillRect(270, 28, 14, 140);
  c.fillStyle = 'rgba(30,28,40,0.5)';
  c.fillRect(38, 30, 4, 130);
  c.fillRect(278, 30, 4, 130);

  // Far arch
  c.fillStyle = 'rgba(8,10,16,0.7)';
  c.fillRect(120, 20, 80, 10);
  c.fillRect(130, 16, 60, 6);
  c.fillRect(140, 12, 40, 6);

  // Torch glow orbs (ambient)
  const flicker = 0.5 + 0.5 * Math.sin(tick / 9);
  c.fillStyle = `rgba(255, 140, 40, ${0.04 + flicker * 0.05})`;
  c.beginPath();
  c.arc(48, 70, 28 + flicker * 4, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(272, 70, 28 + flicker * 4, 0, Math.PI * 2);
  c.fill();
  // Torch flames
  c.fillStyle = `rgba(255, 180, 60, ${0.35 + flicker * 0.35})`;
  c.fillRect(44, 52, 4, 8 + (tick % 3));
  c.fillRect(272, 52, 4, 8 + ((tick + 1) % 3));
  c.fillStyle = `rgba(255, 240, 120, ${0.5 + flicker * 0.3})`;
  c.fillRect(45, 50, 2, 4);

  // Dust motes
  let seed = hash(String(roomId)) + (tick >> 3);
  for (let i = 0; i < 28; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const gx = seed % 320;
    seed = (seed * 1103515245 + 12345) >>> 0;
    const gy = (seed % 160) + 8;
    seed = (seed * 1103515245 + 12345) >>> 0;
    const a = 0.04 + (seed % 5) * 0.02;
    c.fillStyle = `rgba(255,220,170,${a})`;
    c.fillRect(gx, gy, 1, 1);
  }
}


function drawModernTile(c, tx, ty, tileSize = TILE) {
  const x = tx * tileSize;
  const y = ty * tileSize;
  const isFloor = ty >= 5;
  let seed = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
  if (isFloor) {
    c.fillStyle = '#2a2a32';
    c.fillRect(x, y, tileSize, tileSize);
    c.fillStyle = '#3a3a44';
    c.fillRect(x, y, tileSize, 2);
    if (tx % 2 === 0) {
      c.fillStyle = '#c9a227';
      c.fillRect(x + 6, y + 14, 12, 2);
    }
    c.fillStyle = '#1a1a22';
    c.fillRect(x, y + tileSize - 2, tileSize, 2);
  } else {
    c.fillStyle = '#1a2840';
    c.fillRect(x, y, tileSize, tileSize);
    for (let wy = 4; wy < tileSize - 4; wy += 10) {
      for (let wx = 4; wx < tileSize - 4; wx += 10) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        c.fillStyle = (seed % 4) !== 0 ? '#ffe060' : '#0c1828';
        c.fillRect(x + wx, y + wy, 6, 6);
      }
    }
    c.fillStyle = '#2a4060';
    c.fillRect(x, y, tileSize, 2);
  }
}

function drawModernBackdrop(c, roomId, tick = 0) {
  for (let i = 0; i < 16; i++) {
    const u = i / 16;
    c.fillStyle = `rgb(${Math.floor(4 + u * 12)},${Math.floor(8 + u * 18)},${Math.floor(24 + u * 40)})`;
    c.fillRect(0, Math.floor(u * 184), 320, 14);
  }
  const skyline = [40, 70, 55, 90, 60, 80, 50, 75, 65, 85, 45, 70];
  let x = 0;
  for (let i = 0; i < skyline.length; i++) {
    const h = skyline[i];
    const w = 28 + (i % 3) * 4;
    c.fillStyle = i % 2 ? '#121c30' : '#182438';
    c.fillRect(x, 160 - h, w, h);
    for (let wy = 160 - h + 6; wy < 150; wy += 10) {
      for (let wx = x + 4; wx < x + w - 4; wx += 8) {
        if (((wx + wy) * 13) % 5 !== 0) {
          c.fillStyle = '#c8a040';
          c.fillRect(wx, wy, 3, 4);
        }
      }
    }
    x += w - 2;
  }
  const fl = 0.4 + 0.3 * Math.sin(tick / 10);
  c.fillStyle = `rgba(0,255,180,${fl * 0.15})`;
  c.fillRect(40, 40, 40, 6);
  c.fillStyle = `rgba(255,40,120,${fl * 0.15})`;
  c.fillRect(200, 50, 50, 6);
  // trees
  for (const bx of [24, 296]) {
    c.fillStyle = '#2a1c10';
    c.fillRect(bx - 2, 156 - 32, 4, 32);
    c.fillStyle = '#0e4028';
    c.fillRect(bx - 12, 156 - 44, 24, 18);
    c.fillStyle = '#186038';
    c.fillRect(bx - 9, 156 - 50, 18, 14);
  }
  c.fillStyle = '#3a3a40';
  c.fillRect(60, 100, 2, 56);
  c.fillRect(258, 100, 2, 56);
  c.fillStyle = `rgba(255,240,180,${0.15 + fl * 0.1})`;
  c.beginPath(); c.arc(61, 100, 14, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(259, 100, 14, 0, Math.PI * 2); c.fill();
}

/** Futuristic starship hull plating */
function drawShipTile(c, tx, ty, tileSize = TILE) {
  const x = tx * tileSize;
  const y = ty * tileSize;
  const isFloor = ty >= 5;
  let seed = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
  if (isFloor) {
    c.fillStyle = '#1a2430';
    c.fillRect(x, y, tileSize, tileSize);
    c.fillStyle = '#2a3848';
    c.fillRect(x, y, tileSize, 2);
    // grated walkway
    c.fillStyle = '#0e1820';
    for (let gx = 3; gx < tileSize - 2; gx += 4) {
      c.fillRect(x + gx, y + 6, 2, tileSize - 10);
    }
    // cyan edge light
    c.fillStyle = '#40c0e0';
    c.fillRect(x + 4, y + 12, tileSize - 8, 1);
    c.fillStyle = '#101820';
    c.fillRect(x, y + tileSize - 2, tileSize, 2);
  } else {
    c.fillStyle = '#141c28';
    c.fillRect(x, y, tileSize, tileSize);
    // panel seams
    c.fillStyle = '#0a1018';
    c.fillRect(x + 15, y, 2, tileSize);
    c.fillRect(x, y + 15, tileSize, 2);
    // rivets
    c.fillStyle = '#3a4858';
    c.fillRect(x + 3, y + 3, 2, 2);
    c.fillRect(x + tileSize - 5, y + 3, 2, 2);
    c.fillRect(x + 3, y + tileSize - 5, 2, 2);
    c.fillRect(x + tileSize - 5, y + tileSize - 5, 2, 2);
    // occasional status LED
    seed = (seed * 1103515245 + 12345) >>> 0;
    if ((seed % 6) === 0) {
      c.fillStyle = (seed & 1) ? '#40e0a0' : '#40a0e0';
      c.fillRect(x + 12, y + 8, 6, 3);
    }
    // porthole on some tiles
    seed = (seed * 1103515245 + 12345) >>> 0;
    if ((seed % 5) === 0) {
      c.fillStyle = '#080c14';
      c.fillRect(x + 8, y + 8, 16, 14);
      c.fillStyle = '#102030';
      c.fillRect(x + 10, y + 10, 12, 10);
      c.fillStyle = '#80c0ff';
      c.fillRect(x + 12, y + 12, 3, 2);
      c.fillRect(x + 18, y + 16, 2, 2);
    }
    c.fillStyle = '#2a3848';
    c.fillRect(x, y, tileSize, 1);
    c.fillStyle = '#0a1018';
    c.fillRect(x, y + tileSize - 1, tileSize, 1);
  }
}

function drawShipBackdrop(c, roomId, tick = 0) {
  // Deep space
  for (let i = 0; i < 16; i++) {
    const u = i / 16;
    c.fillStyle = `rgb(${Math.floor(2 + u * 6)},${Math.floor(4 + u * 10)},${Math.floor(16 + u * 28)})`;
    c.fillRect(0, Math.floor(u * 184), 320, 14);
  }
  // Stars
  let seed = hash(String(roomId)) + (tick >> 4);
  for (let i = 0; i < 36; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const sx = seed % 320;
    seed = (seed * 1103515245 + 12345) >>> 0;
    const sy = seed % 140;
    c.fillStyle = i % 5 === 0 ? '#a0e0ff' : '#e8f0ff';
    c.fillRect(sx, sy, 1, 1);
  }
  // Distant nebula wash
  const pulse = 0.08 + 0.04 * Math.sin(tick / 18);
  c.fillStyle = `rgba(80,40,160,${pulse})`;
  c.fillRect(40, 20, 100, 50);
  c.fillStyle = `rgba(20,80,140,${pulse})`;
  c.fillRect(180, 30, 90, 40);
  // Hull bulkheads / conduit
  c.fillStyle = 'rgba(20,28,40,0.9)';
  c.fillRect(0, 40, 28, 120);
  c.fillRect(292, 40, 28, 120);
  c.fillStyle = 'rgba(40,60,80,0.5)';
  c.fillRect(24, 48, 4, 100);
  c.fillRect(292, 48, 4, 100);
  // Ceiling conduits
  c.fillStyle = '#1a2838';
  c.fillRect(40, 12, 240, 8);
  c.fillStyle = '#40c0e0';
  c.fillRect(50, 14, 60, 2);
  c.fillRect(140, 16, 40, 2);
  c.fillRect(220, 14, 50, 2);
  // Soft cyan console glow
  const fl = 0.35 + 0.25 * Math.sin(tick / 9);
  c.fillStyle = `rgba(40,200,255,${fl * 0.12})`;
  c.beginPath(); c.arc(48, 90, 22, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(272, 90, 22, 0, Math.PI * 2); c.fill();
  // Floor stripe perspective
  c.fillStyle = 'rgba(40,180,220,0.08)';
  c.fillRect(80, 150, 160, 4);
}

/** Rust-red Mars rock / colony plating */
function drawMarsTile(c, tx, ty, tileSize = TILE) {
  const x = tx * tileSize;
  const y = ty * tileSize;
  const isFloor = ty >= 5;
  let seed = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
  if (isFloor) {
    c.fillStyle = '#5a3420';
    c.fillRect(x, y, tileSize, tileSize);
    c.fillStyle = '#7a4a28';
    c.fillRect(x, y, tileSize, 2);
    // Dust cracks
    c.fillStyle = '#3a2010';
    seed = (seed * 1103515245 + 12345) >>> 0;
    c.fillRect(x + 4 + (seed % 8), y + 10, 12, 1);
    seed = (seed * 1103515245 + 12345) >>> 0;
    c.fillRect(x + 6 + (seed % 6), y + 18, 10, 1);
    // Iron oxide flecks
    for (let i = 0; i < 5; i++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      c.fillStyle = (seed & 1) ? '#a06030' : '#402010';
      c.fillRect(x + 2 + (seed % (tileSize - 4)), y + 4 + ((seed >> 4) % (tileSize - 6)), 1, 1);
    }
    c.fillStyle = '#2a1810';
    c.fillRect(x, y + tileSize - 2, tileSize, 2);
  } else {
    c.fillStyle = '#4a2818';
    c.fillRect(x, y, tileSize, tileSize);
    // Stratified rock layers
    for (let by = 0; by < tileSize; by += 6) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      c.fillStyle = (seed & 1) ? '#3a1c10' : '#5a3020';
      c.fillRect(x, y + by, tileSize, 1);
      seed = (seed * 1103515245 + 12345) >>> 0;
      if ((seed % 4) === 0) {
        c.fillStyle = '#8a5030';
        c.fillRect(x + 4 + (seed % 10), y + by + 2, 8, 3);
      }
    }
    // Occasional colony panel inset
    seed = (seed * 1103515245 + 12345) >>> 0;
    if ((seed % 7) === 0) {
      c.fillStyle = '#2a2018';
      c.fillRect(x + 6, y + 8, 20, 14);
      c.fillStyle = '#c06020';
      c.fillRect(x + 8, y + 10, 16, 2);
      c.fillStyle = '#ff9040';
      c.fillRect(x + 10, y + 14, 4, 4);
    }
    c.fillStyle = '#6a4030';
    c.fillRect(x, y, tileSize, 1);
    c.fillStyle = '#2a140c';
    c.fillRect(x, y + tileSize - 1, tileSize, 1);
  }
}

function drawMarsBackdrop(c, roomId, tick = 0) {
  // Thin atmosphere gradient — peach sky → dusty horizon
  for (let i = 0; i < 16; i++) {
    const u = i / 16;
    const r = Math.floor(40 + u * 50);
    const g = Math.floor(18 + u * 20);
    const b = Math.floor(14 + u * 10);
    c.fillStyle = `rgb(${r},${g},${b})`;
    c.fillRect(0, Math.floor(u * 184), 320, 14);
  }
  // Pale sun
  const pulse = 0.5 + 0.2 * Math.sin(tick / 20);
  c.fillStyle = `rgba(255,200,120,${0.12 + pulse * 0.08})`;
  c.beginPath(); c.arc(260, 36, 22, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f0c070';
  c.fillRect(254, 30, 12, 12);
  // Distant canyon silhouettes
  c.fillStyle = '#2a140c';
  c.fillRect(0, 100, 70, 60);
  c.fillRect(50, 80, 40, 80);
  c.fillRect(200, 90, 50, 70);
  c.fillRect(260, 70, 60, 90);
  c.fillStyle = '#3a1c10';
  c.fillRect(90, 110, 90, 50);
  // Dust motes / wind
  let seed = hash(String(roomId)) + (tick >> 2);
  for (let i = 0; i < 30; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const mx = (seed % 320 + (tick * (1 + (i % 3))) % 320) % 320;
    seed = (seed * 1103515245 + 12345) >>> 0;
    const my = 40 + (seed % 100);
    c.fillStyle = `rgba(200,140,80,${0.08 + (i % 4) * 0.03})`;
    c.fillRect(mx, my, 2, 1);
  }
  // Far colony dome silhouette
  c.fillStyle = 'rgba(40,24,16,0.7)';
  c.fillRect(140, 95, 50, 30);
  c.fillStyle = 'rgba(80,40,24,0.5)';
  c.beginPath(); c.arc(165, 95, 28, Math.PI, 0); c.fill();
  // Horizon dust band
  c.fillStyle = 'rgba(180,100,50,0.15)';
  c.fillRect(0, 140, 320, 20);
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function lerpColor(a, b, t) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Cinematic-platformer silhouette figure.
 * @param {'player'|'enemy'} kind
 */
export function drawFigure(c, a, kind, label, opts = {}) {
  const x = Math.round(a.x - a.w / 2);
  const y = Math.round(a.y - a.h);
  const f = a.facing >= 0 ? 1 : -1;
  const crouch = label === 'Crouch' || label === 'Land';
  const run = label === 'Run' || label === 'Advance' || label === 'Retreat';
  const hang = label === 'Hang' || label === 'ClimbUp';
  const fight = Boolean(
    label
    && (
      String(label).startsWith('Fight')
      || label === 'StrikeWindup'
      || label === 'StrikeActive'
      || label === 'StrikeRecovery'
      || label === 'Parry'
      || label === 'Sheathe'
      || label === 'Hurt'
      || label === 'Advance'
      || label === 'Retreat'
    ),
  );

  const invuln = opts.flash;
  const shipCrew = kind === 'enemy' && (opts.outfit === 'ship' || opts.theme === 'ship');
  const marsCrew = kind === 'enemy' && (opts.outfit === 'mars' || opts.theme === 'mars');
  let body;
  let sash;
  let boot;
  let pants;
  let helm;
  let sashHi;
  let torsoHi;
  if (kind === 'player') {
    body = invuln ? COLORS.playerFlash : COLORS.player;
    sash = COLORS.playerSash;
    boot = COLORS.playerBoot;
    pants = '#5a4030';
    helm = COLORS.playerHair;
    sashHi = '#c04040';
    torsoHi = 'rgba(255,230,180,0.18)';
  } else if (marsCrew) {
    // Mars colony enforcers — rust armor, dust cloak, amber visor
    body = '#8a4020';
    sash = '#e08030';
    boot = '#3a2010';
    pants = '#4a2818';
    helm = '#6a4830';
    sashHi = '#ffb060';
    torsoHi = 'rgba(255,160,60,0.2)';
  } else if (shipCrew) {
    // Future ship security — teal armor, visor helm (not castle red guards)
    body = '#2a6888';
    sash = '#40e8ff';
    boot = '#142430';
    pants = '#1a3040';
    helm = '#c8d8e8';
    sashHi = '#a0f8ff';
    torsoHi = 'rgba(80,220,255,0.22)';
  } else {
    body = COLORS.enemy;
    sash = COLORS.enemySash;
    boot = COLORS.enemyBoot;
    pants = '#3a2020';
    helm = COLORS.enemyHelm;
    sashHi = '#1a0808';
    torsoHi = 'rgba(0,0,0,0.2)';
  }
  const skin = COLORS.skin;

  const h = crouch ? a.h - 10 : a.h;
  const top = crouch ? y + 10 : y;
  const legPhase = run ? Math.floor((opts.tick ?? 0) / 6) % 2 : 0;

  // shadow
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(x + 2, a.y - 2, a.w - 4, 3);

  if (hang) {
    // hanging pose
    c.fillStyle = body;
    c.fillRect(x + 4, top + 8, a.w - 8, 22);
    c.fillStyle = skin;
    c.fillRect(x + 5, top, a.w - 10, 9);
    c.fillStyle = boot;
    c.fillRect(x + 3, top + 28, 5, 8);
    c.fillRect(x + a.w - 8, top + 28, 5, 8);
    // hands up
    c.fillStyle = skin;
    c.fillRect(f > 0 ? x + a.w - 2 : x - 4, top - 2, 6, 6);
    return;
  }

  // legs + pants detail
  c.fillStyle = boot;
  if (legPhase === 0) {
    c.fillRect(x + 3, top + h - 12, 5, 12);
    c.fillRect(x + a.w - 8, top + h - 10, 5, 10);
  } else {
    c.fillRect(x + 3, top + h - 10, 5, 10);
    c.fillRect(x + a.w - 8, top + h - 12, 5, 12);
  }
  // pants
  c.fillStyle = pants;
  c.fillRect(x + 4, top + h - 16, a.w - 8, 5);

  // torso with fold highlight
  c.fillStyle = body;
  c.fillRect(x + 3, top + 10, a.w - 6, h - 22);
  c.fillStyle = torsoHi;
  c.fillRect(x + 4, top + 11, 3, h - 26);
  // sash / tunic band (ship: neon harness stripe)
  c.fillStyle = sash;
  c.fillRect(x + 3, top + 22, a.w - 6, 3);
  c.fillStyle = sashHi;
  c.fillRect(x + 4, top + 22, a.w - 8, 1);
  if (shipCrew) {
    // chest plate plate lines
    c.fillStyle = 'rgba(200,240,255,0.25)';
    c.fillRect(x + 6, top + 14, a.w - 12, 1);
    c.fillRect(x + a.w / 2 - 1, top + 12, 2, 10);
  }
  if (marsCrew) {
    // dust cloak shoulder
    c.fillStyle = 'rgba(120,60,30,0.55)';
    c.fillRect(x + 2, top + 10, a.w - 4, 4);
    c.fillStyle = 'rgba(255,140,40,0.3)';
    c.fillRect(x + 5, top + 16, a.w - 10, 1);
  }

  // arms
  c.fillStyle = marsCrew ? '#7a4830' : shipCrew ? '#3a7088' : skin;
  if (f > 0) {
    c.fillRect(x + a.w - 5, top + 12, 3, 10);
  } else {
    c.fillRect(x + 2, top + 12, 3, 10);
  }

  // head + face detail
  c.fillStyle = marsCrew ? '#c0a080' : shipCrew ? '#a0b0c0' : skin;
  c.fillRect(x + 4, top + 1, a.w - 8, 10);
  c.fillStyle = 'rgba(0,0,0,0.08)';
  c.fillRect(x + 5, top + 7, a.w - 10, 3);
  // hair / helm
  c.fillStyle = kind === 'player' ? COLORS.playerHair : helm;
  c.fillRect(x + 4, top, a.w - 8, 3);
  c.fillRect(x + 3, top + 2, 2, 4);
  c.fillRect(x + a.w - 5, top + 2, 2, 4);
  if (kind === 'enemy') {
    if (marsCrew) {
      // rebreather helm + amber slit visor
      c.fillStyle = helm;
      c.fillRect(x + 3, top, a.w - 6, 6);
      c.fillRect(x + 2, top + 2, 4, 7);
      c.fillRect(x + a.w - 6, top + 2, 4, 7);
      c.fillStyle = '#1a1008';
      c.fillRect(x + 5, top + 4, a.w - 10, 3);
      c.fillStyle = '#ff9040';
      c.fillRect(x + 6, top + 5, a.w - 12, 1);
      // side filter canister
      c.fillStyle = '#5a3020';
      c.fillRect(f > 0 ? x + a.w - 3 : x, top + 6, 3, 6);
    } else if (shipCrew) {
      // sealed helmet + cyan visor strip
      c.fillStyle = helm;
      c.fillRect(x + 3, top, a.w - 6, 5);
      c.fillRect(x + 3, top + 2, 3, 7);
      c.fillRect(x + a.w - 6, top + 2, 3, 7);
      c.fillStyle = '#102028';
      c.fillRect(x + 5, top + 4, a.w - 10, 4);
      c.fillStyle = '#40e8ff';
      c.fillRect(x + 6, top + 5, a.w - 12, 2);
      // antenna
      c.fillStyle = '#80d0f0';
      c.fillRect(x + a.w / 2 - 1, top - 3, 2, 3);
    } else {
      // helmet crest
      c.fillStyle = '#5a3030';
      c.fillRect(x + a.w / 2 - 1, top - 2, 2, 3);
      c.fillStyle = COLORS.enemyHelm;
      c.fillRect(x + 3, top + 2, 3, 6);
      c.fillRect(x + a.w - 6, top + 2, 3, 6);
    }
  }

  // eye + brow (visor already covers ship/mars crew)
  if (!shipCrew && !marsCrew) {
    c.fillStyle = '#1a1008';
    const eyeX = f > 0 ? x + a.w - 7 : x + 4;
    c.fillRect(eyeX, top + 5, 2, 2);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(eyeX, top + 5, 1, 1);
  }

  // arms / sword — era-themed blades
  const swordDrawn = opts.swordDrawn || fight;
  const blade = marsCrew ? '#e8c080' : shipCrew ? '#c0f0ff' : COLORS.playerSword;
  const bladeAccent = marsCrew ? '#ff8040' : shipCrew ? '#40e8ff' : COLORS.exit;
  if (swordDrawn) {
    c.fillStyle = blade;
    if (label === 'StrikeActive') {
      const sx = f > 0 ? x + a.w - 2 : x - 18;
      c.fillRect(sx, top + 14, 20, 3);
      c.fillStyle = COLORS.swordTip;
      c.fillRect(f > 0 ? sx + 16 : sx, top + 13, 4, 5);
      c.fillStyle = bladeAccent;
      c.fillRect(f > 0 ? sx : sx + 16, top + 13, 3, 5);
    } else if (label === 'StrikeWindup') {
      const sx = f > 0 ? x + a.w - 4 : x - 6;
      c.fillRect(sx, top + 6, 3, 14);
      c.fillStyle = bladeAccent;
      c.fillRect(sx - 1, top + 16, 5, 2);
    } else if (label === 'Parry') {
      const sx = f > 0 ? x + a.w - 2 : x - 4;
      c.fillRect(sx, top + 10, 4, 16);
      c.fillStyle = shipCrew ? '#80f0ff' : COLORS.parryGlow;
      c.fillRect(sx - 1, top + 10, 6, 2);
    } else {
      const sx = f > 0 ? x + a.w - 3 : x;
      c.fillRect(sx, top + 12, 3, 16);
      c.fillStyle = bladeAccent;
      c.fillRect(sx - 2, top + 14, 7, 2);
    }
  } else if (kind === 'enemy') {
    c.fillStyle = blade;
    const sx = f > 0 ? x + a.w - 3 : x;
    c.fillRect(sx, top + 12, 3, 16);
    c.fillStyle = marsCrew ? '#a05020' : shipCrew ? '#2080a0' : '#8a7040';
    c.fillRect(sx - 1, top + 14, 5, 2);
  } else if (kind === 'player' && opts.hasSwordSheathed) {
    // Sheathed at hip (has sword but not in combat)
    c.fillStyle = COLORS.playerSword;
    c.fillRect(x + (f > 0 ? 2 : a.w - 5), top + 20, 2, 10);
    c.fillStyle = COLORS.exit;
    c.fillRect(x + (f > 0 ? 1 : a.w - 6), top + 20, 4, 2);
  }

  // hurt flash ring
  if (label === 'Hurt') {
    c.strokeStyle = COLORS.blood;
    c.strokeRect(x - 1, top - 1, a.w + 2, h + 2);
  }
}

export function drawEntity(c, e, tick = 0) {
  switch (e.type) {
    case 'sword':
      if (e.taken) return;
      drawPickupSword(c, e.x, e.y, tick);
      break;
    case 'gate':
      drawGate(c, e);
      break;
    case 'plate':
      drawPlate(c, e);
      break;
    case 'spikes':
      if (!e.raised) return;
      drawSpikes(c, e);
      break;
    case 'loose':
      if (e.collapsed) return;
      drawLoose(c, e, tick);
      break;
    case 'chomper':
      drawChomper(c, e, tick);
      break;
    case 'potion':
      if (e.taken) return;
      drawPotion(c, e, tick);
      break;
    case 'exit':
      drawExit(c, e, tick);
      break;
    default:
      break;
  }
}

function drawPickupSword(c, x, y, tick) {
  const bob = Math.sin(tick / 20) * 2;
  const yy = y + bob;
  // glow
  c.fillStyle = 'rgba(200,210,230,0.15)';
  c.fillRect(x, yy - 2, 16, 36);
  // blade
  c.fillStyle = COLORS.sword;
  c.fillRect(x + 6, yy, 4, 26);
  c.fillStyle = COLORS.swordTip;
  c.fillRect(x + 6, yy, 4, 4);
  // guard
  c.fillStyle = COLORS.exit;
  c.fillRect(x + 2, yy + 24, 12, 3);
  // grip
  c.fillStyle = COLORS.playerSash;
  c.fillRect(x + 6, yy + 27, 4, 6);
}

function drawGate(c, e) {
  const w = e.w ?? 16;
  const h = e.h ?? 96;
  if (e.blocking) {
    // portcullis bars
    c.fillStyle = COLORS.gate;
    c.fillRect(e.x, e.y, w, h);
    c.fillStyle = COLORS.gateBar;
    for (let i = 2; i < w; i += 4) {
      c.fillRect(e.x + i, e.y, 2, h);
    }
    c.fillStyle = COLORS.wallHi;
    c.fillRect(e.x, e.y, w, 4);
    c.fillRect(e.x, e.y + h - 4, w, 4);
  } else {
    // raised
    c.fillStyle = COLORS.gateOpen;
    c.fillRect(e.x, e.y, w, 10);
    c.fillStyle = COLORS.gateBar;
    for (let i = 2; i < w; i += 4) {
      c.fillRect(e.x + i, e.y, 2, 10);
    }
  }
}

function drawPlate(c, e) {
  const w = e.w ?? 24;
  const h = e.h ?? 8;
  c.fillStyle = e.pressed ? COLORS.plateOn : COLORS.plate;
  c.fillRect(e.x, e.y + (e.pressed ? 2 : 0), w, h - (e.pressed ? 2 : 0));
  c.fillStyle = e.pressed ? COLORS.plateOnHi : COLORS.plateHi;
  c.fillRect(e.x + 2, e.y + (e.pressed ? 2 : 0), w - 4, 2);
}

function drawSpikes(c, e) {
  const w = e.w ?? 32;
  const h = e.h ?? 16;
  for (let i = 0; i < w; i += 8) {
    c.fillStyle = COLORS.spikes;
    c.beginPath();
    c.moveTo(e.x + i, e.y + h);
    c.lineTo(e.x + i + 4, e.y);
    c.lineTo(e.x + i + 8, e.y + h);
    c.closePath();
    c.fill();
    c.fillStyle = COLORS.spikesHi;
    c.fillRect(e.x + i + 3, e.y + 2, 1, h - 4);
  }
}

function drawLoose(c, e, tick) {
  const w = e.w ?? 32;
  const h = e.h ?? 8;
  const shake = e.shake > 0 ? Math.sin(tick) * 1.5 : 0;
  c.fillStyle = e.shake > 0 ? COLORS.looseShake : COLORS.loose;
  c.fillRect(e.x + shake, e.y, w, h);
  c.fillStyle = COLORS.looseCrack;
  c.fillRect(e.x + 4 + shake, e.y + 2, w - 8, 1);
  c.fillRect(e.x + 8 + shake, e.y + 5, w - 12, 1);
  if (e.shake > 0) {
    c.fillStyle = COLORS.dust;
    c.fillRect(e.x + 2, e.y + h, 2, 2);
    c.fillRect(e.x + w - 6, e.y + h + 1, 2, 2);
  }
}

function drawChomper(c, e, tick) {
  const w = e.w ?? 32;
  const h = e.h ?? 32;
  c.fillStyle = COLORS.chomper;
  c.fillRect(e.x, e.y, w, h);
  c.fillStyle = COLORS.chomperDark;
  c.fillRect(e.x + 2, e.y + 2, w - 4, h - 4);

  if (e.closed) {
    // jaws closed
    c.fillStyle = COLORS.chomperTooth;
    c.fillRect(e.x + 4, e.y + h / 2 - 3, w - 8, 6);
    for (let i = 6; i < w - 6; i += 5) {
      c.fillStyle = COLORS.spikes;
      c.fillRect(e.x + i, e.y + h / 2 - 6, 3, 4);
      c.fillRect(e.x + i, e.y + h / 2 + 2, 3, 4);
    }
  } else {
    // open — warning pulse near close
    const warn = e.timer < 12;
    c.fillStyle = warn ? COLORS.chomperWarn : COLORS.chomperDark;
    c.fillRect(e.x + 4, e.y + 4, w - 8, 8);
    c.fillRect(e.x + 4, e.y + h - 12, w - 8, 8);
    c.fillStyle = COLORS.chomperTooth;
    for (let i = 6; i < w - 6; i += 5) {
      c.fillRect(e.x + i, e.y + 10, 3, 4);
      c.fillRect(e.x + i, e.y + h - 14, 3, 4);
    }
  }
}

function drawPotion(c, e, tick) {
  const bob = Math.sin(tick / 16) * 1.5;
  const col = e.variant === 'poison' ? COLORS.potionPoison : COLORS.potionLife;
  const x = e.x;
  const y = e.y + bob;
  c.fillStyle = col;
  c.fillRect(x + 2, y + 4, 8, 12);
  c.fillStyle = COLORS.potionGlass;
  c.fillRect(x + 3, y + 5, 2, 6);
  c.fillStyle = COLORS.plateHi;
  c.fillRect(x + 3, y + 2, 6, 3);
  c.fillRect(x + 4, y, 4, 3);
}

/**
 * Stage-clear exit door (entity in last room of a stage).
 */
function drawExit(c, e, tick) {
  drawArchDoor(c, {
    x: e.x,
    y: e.y,
    w: e.w ?? 28,
    h: e.h ?? 64,
    tick,
    label: 'EXIT',
    glow: true,
  });
}

/**
 * Room-to-room wall doorway (e.g. Guard ↔ Gate).
 * @param {'left'|'right'} side
 */
export function drawRoomDoor(c, side, tick = 0) {
  const h = 72;
  const w = 22;
  const y = 88;
  const x = side === 'right' ? 298 : 0;
  drawArchDoor(c, {
    x,
    y,
    w,
    h,
    tick,
    label: side === 'right' ? '→' : '←',
    glow: true,
    compact: true,
  });
}

/**
 * Shared stone arch passage used for stage exits and room doors.
 */
function drawArchDoor(c, {
  x, y, w, h, tick = 0, label = '', glow = true, compact = false,
}) {
  const pulse = 0.5 + 0.5 * Math.sin(tick / 16);
  const flicker = 0.5 + 0.5 * Math.sin(tick / 11);

  if (glow) {
    c.fillStyle = `rgba(201, 162, 39, ${0.07 + flicker * 0.1})`;
    c.fillRect(x - 3, y - 4, w + 6, h + 8);
  }

  // Outer stone jambs
  c.fillStyle = '#2a2014';
  c.fillRect(x, y, w, h);

  // Carved frame
  c.fillStyle = '#5a4530';
  c.fillRect(x + 1, y + 2, w - 2, h - 4);
  c.fillStyle = '#3a2c1c';
  c.fillRect(x + 2, y + 8, w - 4, h - 12);

  // Dark passage void
  c.fillStyle = '#06040a';
  c.fillRect(x + 4, y + 12, w - 8, h - 18);

  // Warm light inside (next room)
  c.fillStyle = `rgba(255, 190, 90, ${0.1 + pulse * 0.18})`;
  c.fillRect(x + 5, y + 16, Math.max(2, w - 10), h - 26);
  c.fillStyle = `rgba(255, 230, 150, ${0.06 + pulse * 0.12})`;
  c.fillRect(x + 6, y + 22, Math.max(1, w - 12), h - 34);

  // Arch cap (stepped)
  c.fillStyle = '#6a5538';
  c.fillRect(x + 1, y + 2, w - 2, 5);
  c.fillStyle = '#8a7040';
  c.fillRect(x + 3, y, w - 6, 4);
  c.fillStyle = '#c9a227';
  c.fillRect(x + 5, y + 1, w - 10, 2);

  // Pillar brick lines
  c.fillStyle = '#2a1810';
  for (let by = y + 14; by < y + h - 8; by += 7) {
    c.fillRect(x + 1, by, 3, 1);
    c.fillRect(x + w - 4, by, 3, 1);
  }

  // Gold hinge dots / studs
  c.fillStyle = '#c9a227';
  c.fillRect(x + 2, y + 20, 2, 2);
  c.fillRect(x + 2, y + h - 22, 2, 2);
  c.fillRect(x + w - 4, y + 20, 2, 2);
  c.fillRect(x + w - 4, y + h - 22, 2, 2);

  // Threshold
  c.fillStyle = '#a08040';
  c.fillRect(x + 2, y + h - 6, w - 4, 3);
  c.fillStyle = '#e8d4a8';
  c.fillRect(x + 3, y + h - 5, w - 6, 1);

  if (label) {
    c.fillStyle = `rgba(255, 240, 192, ${0.7 + pulse * 0.3})`;
    c.font = compact ? '9px monospace' : '8px monospace';
    c.textAlign = 'center';
    c.fillText(label, x + w / 2, compact ? y + h / 2 + 3 : y - 4);
    c.textAlign = 'left';
  }
}

/** @deprecated use drawRoomWipe */
export function drawRoomFlash(c, alpha) {
  drawRoomWipe(c, alpha, 'right');
}

/**
 * Colorful directional wipe between rooms (same stage).
 * alpha: 1 = fully covered, 0 = clear
 */
export function drawRoomWipe(c, alpha, dir = 'right') {
  if (alpha <= 0.01) return;
  const w = 320;
  const h = 184; // playfield height (LOGICAL_H - HUD_H)
  const t = Math.max(0, Math.min(1, alpha));

  // Soft full-screen wash
  c.fillStyle = `rgba(8,6,12,${t * 0.55})`;
  c.fillRect(0, 0, w, h);

  // Moving color bands
  const bandW = Math.floor(40 + t * 100);
  let bx = 0;
  if (dir === 'right') bx = Math.floor((1 - t) * (w + bandW) - bandW);
  else if (dir === 'left') bx = Math.floor(t * (w + bandW) - bandW);
  else if (dir === 'up') bx = 0;
  else bx = 0;

  if (dir === 'up' || dir === 'down') {
    const bandH = Math.floor(30 + t * 80);
    const by = dir === 'down'
      ? Math.floor((1 - t) * (h + bandH) - bandH)
      : Math.floor(t * (h + bandH) - bandH);
    const grad = c.createLinearGradient(0, by, 0, by + bandH);
    grad.addColorStop(0, 'rgba(201,162,39,0)');
    grad.addColorStop(0.4, `rgba(201,162,39,${0.35 * t})`);
    grad.addColorStop(0.6, `rgba(180,80,100,${0.3 * t})`);
    grad.addColorStop(1, 'rgba(40,60,90,0)');
    c.fillStyle = grad;
    c.fillRect(0, by, w, bandH);
  } else {
    const grad = c.createLinearGradient(bx, 0, bx + bandW, 0);
    grad.addColorStop(0, 'rgba(40,60,90,0)');
    grad.addColorStop(0.35, `rgba(201,162,39,${0.4 * t})`);
    grad.addColorStop(0.55, `rgba(200,100,80,${0.35 * t})`);
    grad.addColorStop(0.75, `rgba(80,40,100,${0.25 * t})`);
    grad.addColorStop(1, 'rgba(20,30,50,0)');
    c.fillStyle = grad;
    c.fillRect(bx, 0, bandW, h);
  }

  // Sparkle edge
  c.fillStyle = `rgba(255,240,180,${0.35 * t})`;
  if (dir === 'right' || dir === 'left') {
    const edge = dir === 'right' ? bx + bandW - 4 : bx;
    c.fillRect(edge, 0, 3, h);
  }
}

/** Brief damage red overlay on full framebuffer */
export function drawDamageVignette(ctx, alpha) {
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(120, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, 320, 200);
}
