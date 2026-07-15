import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { maxSafeCarefulStep, hasGroundSupport } from '../src/systems/collision.js';

describe('careful edge stop', () => {
  // Floor with a pit in the middle: solid cols 0-3 and 6-9 at row 5
  const tiles = [
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,0,0,1,1,1,1],
  ];
  const tileSize = 32;
  const w = 18;
  const h = 40;
  const feetY = 160; // top of floor row

  it('has support on solid floor', () => {
    assert.equal(hasGroundSupport(48, feetY, w, tiles, tileSize, []), true);
  });

  it('no support over the pit', () => {
    assert.equal(hasGroundSupport(144, feetY, w, tiles, tileSize, []), false);
  });

  it('careful step toward pit stops before falling', () => {
    // Standing near edge of solid (col 3 is last solid: x 96-128)
    // feet near right edge of solid ~ 120
    const feetX = 118;
    const safe = maxSafeCarefulStep(feetX, feetY, w, h, 1, 32, tiles, tileSize, []);
    // Should not allow a full 32px into the pit
    assert.ok(safe < 32, `expected limited step, got ${safe}`);
    // After max safe step, still supported
    const nx = feetX + safe;
    assert.equal(hasGroundSupport(nx, feetY, w, tiles, tileSize, []), true);
  });

  it('careful step away from pit is allowed', () => {
    const feetX = 118;
    const safe = maxSafeCarefulStep(feetX, feetY, w, h, -1, 16, tiles, tileSize, []);
    assert.ok(safe > 8, `expected room to step back, got ${safe}`);
  });
});
