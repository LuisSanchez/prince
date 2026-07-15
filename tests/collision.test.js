import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aabbOverlap, moveAndCollide, feetToBox } from '../src/systems/collision.js';

describe('aabbOverlap', () => {
  it('detects overlap', () => {
    assert.equal(aabbOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  });
  it('detects separation', () => {
    assert.equal(aabbOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }), false);
  });
});

describe('moveAndCollide', () => {
  const tiles = [
    [0, 0, 0],
    [0, 0, 0],
    [1, 1, 1],
  ];
  const tileSize = 32;

  it('lands on floor', () => {
    const box = { x: 10, y: 20, w: 16, h: 32 };
    const res = moveAndCollide(box, 0, 40, tiles, tileSize, []);
    assert.equal(res.grounded, true);
    assert.equal(res.y + box.h, 64); // top of floor row
  });

  it('blocks horizontal into wall column', () => {
    const wallTiles = [
      [1, 0, 0],
      [1, 0, 0],
      [1, 1, 1],
    ];
    const box = { x: 40, y: 20, w: 16, h: 32 };
    const res = moveAndCollide(box, -20, 0, wallTiles, tileSize, []);
    assert.equal(res.hitX, true);
    assert.ok(res.x >= 32);
  });
});

describe('feetToBox', () => {
  it('centers box on feet', () => {
    const b = feetToBox(100, 160, 18, 40);
    assert.equal(b.x, 91);
    assert.equal(b.y, 120);
    assert.equal(b.w, 18);
    assert.equal(b.h, 40);
  });
});
