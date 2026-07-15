import { TILE } from '../config.js';

/**
 * @param {{ x: number, y: number, w: number, h: number }} a
 * @param {{ x: number, y: number, w: number, h: number }} b
 */
export function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Solid tiles: value === 1
 * @param {number[][]} tiles
 * @param {number} tileSize
 * @param {{ x: number, y: number, w: number, h: number }} box  top-left AABB in room space
 * @returns {{ x: number, y: number, w: number, h: number }[]}
 */
export function solidTilesOverlapping(tiles, tileSize, box) {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  const x0 = Math.floor(box.x / tileSize);
  const y0 = Math.floor(box.y / tileSize);
  const x1 = Math.floor((box.x + box.w - 0.001) / tileSize);
  const y1 = Math.floor((box.y + box.h - 0.001) / tileSize);
  const out = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
      if (tiles[ty][tx] === 1) {
        out.push({ x: tx * tileSize, y: ty * tileSize, w: tileSize, h: tileSize });
      }
    }
  }
  return out;
}

/**
 * Separate-axis resolve: move box by (dx, dy) against solids + extra solid AABBs.
 * @returns {{ x: number, y: number, hitX: boolean, hitY: boolean, grounded: boolean }}
 */
export function moveAndCollide(box, dx, dy, tiles, tileSize, extraSolids = []) {
  let x = box.x;
  let y = box.y;
  let hitX = false;
  let hitY = false;

  // X axis
  x += dx;
  let test = { x, y, w: box.w, h: box.h };
  let solids = [
    ...solidTilesOverlapping(tiles, tileSize, test),
    ...extraSolids.filter((s) => aabbOverlap(test, s)),
  ];
  for (const s of solids) {
    if (!aabbOverlap({ x, y, w: box.w, h: box.h }, s)) continue;
    if (dx > 0) {
      x = s.x - box.w;
      hitX = true;
    } else if (dx < 0) {
      x = s.x + s.w;
      hitX = true;
    }
  }

  // Y axis
  y += dy;
  test = { x, y, w: box.w, h: box.h };
  solids = [
    ...solidTilesOverlapping(tiles, tileSize, test),
    ...extraSolids.filter((s) => aabbOverlap(test, s)),
  ];
  for (const s of solids) {
    if (!aabbOverlap({ x, y, w: box.w, h: box.h }, s)) continue;
    if (dy > 0) {
      y = s.y - box.h;
      hitY = true;
    } else if (dy < 0) {
      y = s.y + s.h;
      hitY = true;
    }
  }

  // grounded probe: 1px below feet
  const foot = { x, y: y + box.h, w: box.w, h: 1 };
  const below = [
    ...solidTilesOverlapping(tiles, tileSize, foot),
    ...extraSolids.filter((s) => aabbOverlap(foot, s)),
  ];
  const grounded = below.some((s) => aabbOverlap(foot, s));

  return { x, y, hitX, hitY, grounded };
}

/**
 * Feet position helpers: actor stores feet mid-bottom.
 */
export function feetToBox(feetX, feetY, w, h) {
  return { x: feetX - w / 2, y: feetY - h, w, h };
}

export function boxToFeet(box) {
  return { x: box.x + box.w / 2, y: box.y + box.h };
}

/**
 * True if a thin foot probe under (feetX, feetY) finds solid support.
 * Used so careful steps stop at edges instead of walking into a pit.
 */
export function hasGroundSupport(feetX, feetY, w, tiles, tileSize, extraSolids = []) {
  // Leading/trailing foot pads — need at least one solid contact under the stance.
  const pads = [
    { x: feetX - w * 0.35, y: feetY, w: 4, h: 3 },
    { x: feetX - 2, y: feetY, w: 4, h: 3 },
    { x: feetX + w * 0.35 - 4, y: feetY, w: 4, h: 3 },
  ];
  for (const pad of pads) {
    const tilesHit = solidTilesOverlapping(tiles, tileSize, pad);
    if (tilesHit.length > 0) return true;
    for (const s of extraSolids) {
      if (aabbOverlap(pad, s)) return true;
    }
  }
  return false;
}

/**
 * Max horizontal careful step that keeps ground under the leading foot.
 * Returns 0 if already at the edge (or no safe step in that direction).
 */
export function maxSafeCarefulStep(feetX, feetY, w, h, dir, maxStep, tiles, tileSize, extraSolids = []) {
  if (maxStep <= 0 || dir === 0) return 0;
  // Already no ground? don't invent a step
  if (!hasGroundSupport(feetX, feetY, w, tiles, tileSize, extraSolids)) return 0;

  // Binary search largest dx in [0, maxStep] with support under leading edge after move
  let lo = 0;
  let hi = maxStep;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    const nx = feetX + dir * mid;
    // Leading foot near the edge we're walking toward
    const leadX = nx + dir * (w * 0.35);
    const leadPad = { x: leadX - 2, y: feetY, w: 4, h: 3 };
    const ok =
      solidTilesOverlapping(tiles, tileSize, leadPad).length > 0
      || extraSolids.some((s) => aabbOverlap(leadPad, s));
    // Also require center still supported (don't hang half-off)
    const centerOk = hasGroundSupport(nx, feetY, w, tiles, tileSize, extraSolids);
    if (ok && centerOk) lo = mid;
    else hi = mid;
  }
  // Small epsilon: if almost full step, take it; if tiny leftover, stop
  if (lo < 0.4) return 0;
  return lo;
}

/** Ledge grab sensor at top-front of hurtbox while falling */
export function ledgeSensor(feetX, feetY, w, h, facing) {
  const box = feetToBox(feetX, feetY, w, h);
  const handY = box.y + 4;
  const handX = facing > 0 ? box.x + box.w : box.x - 8;
  return { x: handX, y: handY, w: 8, h: 8 };
}

/**
 * Find ledge: solid tile top edge near sensor while falling past it.
 */
export function findLedge(tiles, tileSize, sensor, facing) {
  const solids = solidTilesOverlapping(tiles, tileSize, {
    x: sensor.x - 4,
    y: sensor.y - 4,
    w: sensor.w + 8,
    h: sensor.h + 12,
  });
  for (const s of solids) {
    // ledge is top of solid; empty above
    const aboveY = s.y - 1;
    const aboveTileY = Math.floor(aboveY / tileSize);
    const tileX = Math.floor((s.x + s.w / 2) / tileSize);
    const row = tiles[aboveTileY];
    if (row && row[tileX] === 1) continue;
    // sensor near top of solid
    if (sensor.y + sensor.h >= s.y && sensor.y <= s.y + 6) {
      const grabX = facing > 0 ? s.x : s.x + s.w;
      return { x: grabX, y: s.y, solid: s };
    }
  }
  return null;
}

export { TILE };


/**
 * If the actor AABB is embedded in solids, nudge to a free stand pose.
 * Prevents "frozen" spawns inside wall tiles (x=24 / x=296).
 */
export function unstickFromSolids(feetX, feetY, w, h, tiles, tileSize, extraSolids = []) {
  let x = feetX;
  let y = feetY;
  const embedded = (bx) => {
    const hits = [
      ...solidTilesOverlapping(tiles, tileSize, bx),
      ...extraSolids.filter((s) => aabbOverlap(bx, s)),
    ];
    return hits.length > 0;
  };

  // Always try to rest on the nearest floor below (fixes mid-platform / climb freezes)
  const snapped = snapFeetToGround(x, y, w, h, tiles, tileSize, extraSolids);
  x = snapped.x;
  y = snapped.y;
  if (!embedded(feetToBox(x, y, w, h))) return { x, y };

  // Prefer sliding into open playfield on the main floor
  const candidates = [
    [64, 160], [256, 160], [160, 160],
    [96, 160], [224, 160], [128, 128], [160, 128], [192, 128],
    [x, 160], [80, 160], [240, 160],
  ];
  for (const [cx, cy] of candidates) {
    const b = feetToBox(cx, cy, w, h);
    if (!embedded(b)) return { x: cx, y: cy };
  }
  // Last resort: push left/right in 4px steps
  for (let dx = 4; dx <= 120; dx += 4) {
    for (const sign of [1, -1]) {
      const nx = x + sign * dx;
      const b = feetToBox(nx, 160, w, h);
      if (!embedded(b)) return { x: nx, y: 160 };
    }
  }
  return { x: 160, y: 160 };
}

/**
 * Drop feet onto solid surface at/below current X.
 * Keeps X stable (does not teleport sideways).
 */
export function snapFeetToGround(feetX, feetY, w, h, tiles, tileSize, extraSolids = []) {
  // Start from current pose (or slightly above) — never from the ceiling
  let startFeetY = Number.isFinite(feetY) ? feetY : 160;
  if (startFeetY < h + 2) startFeetY = h + 2;
  if (startFeetY > 190) startFeetY = 160;

  let box = feetToBox(feetX, startFeetY - 2, w, h);

  // If embedded in a solid, push UP until free (max ~3 tiles)
  for (let i = 0; i < 32; i++) {
    const hits = [
      ...solidTilesOverlapping(tiles, tileSize, box),
      ...extraSolids.filter((s) => aabbOverlap(box, s)),
    ];
    if (hits.length === 0) break;
    box = { ...box, y: box.y - 2 };
  }

  // Short drop to rest on the surface under us (platform or floor)
  const res = moveAndCollide(box, 0, 48, tiles, tileSize, extraSolids);
  let x = res.x + w / 2;
  let y = res.y + h;

  // If still not grounded, try a longer cast from a bit higher at same X
  if (!res.grounded) {
    box = feetToBox(feetX, Math.max(h + 4, startFeetY - 40), w, h);
    const res2 = moveAndCollide(box, 0, 200, tiles, tileSize, extraSolids);
    x = res2.x + w / 2;
    y = res2.y + h;
  }

  // Preserve horizontal intent — collision should not slide us across the room
  x = feetX;
  return { x, y };
}
