import {
  PLAYER_W, PLAYER_H, Combat, RUN_SPEED,
} from '../config.js';
import { moveAndCollide, feetToBox, aabbOverlap } from '../systems/collision.js';

export function createEnemy(def) {
  return {
    id: def.id,
    type: 'enemy',
    x: def.x,
    y: def.y,
    w: PLAYER_W + 2,
    h: PLAYER_H,
    facing: def.facing ?? -1,
    tier: def.tier ?? 1,
    hp: def.hp ?? 3,
    maxHp: def.hp ?? 3,
    alive: true,
    fightState: null,
    fightTick: 0,
    engagePlayer: false,
    cooldown: 0,
    blockSkill: def.tier === 1 ? 0.12 : (def.tier >= 2 ? 0.32 : 0.2),
    aiTimer: 0,
    /** Visual kit: 'ship' for future crew, default castle guard */
    outfit: def.outfit ?? null,
  };
}

export function enemyHurtbox(e) {
  const box = feetToBox(e.x, e.y, e.w, e.h);
  // Slightly generous so player swings connect
  return { x: box.x, y: box.y + 2, w: e.w, h: e.h - 4 };
}

export function enemyStrikeHitbox(e) {
  const hb = enemyHurtbox(e);
  const w = 20;
  const x = e.facing > 0 ? hb.x + hb.w : hb.x - w;
  return { x, y: hb.y + 8, w, h: 16 };
}

export function enemyIsStrikeActive(e) {
  return e.alive && e.fightState === 'StrikeActive';
}

/**
 * @param {object} e
 * @param {object} player
 * @param {object} roomCtx
 */
export function updateEnemy(e, player, roomCtx) {
  if (!e.alive) return;
  const { tiles, tileSize, solids } = roomCtx;
  e.fightTick++;
  if (e.cooldown > 0) e.cooldown--;

  // Unarmed pressure: walk slowly toward player if close and not fighting
  if (!e.engagePlayer) {
    const dx = player.x - e.x;
    const dy = Math.abs(player.y - e.y);
    if (dy <= Combat.FLOOR_BAND_PX && Math.abs(dx) < 120) {
      e.facing = Math.sign(dx) || e.facing;
      // slow patrol step
      if (Math.abs(dx) > 28) {
        const box = feetToBox(e.x, e.y, e.w, e.h);
        const res = moveAndCollide(box, e.facing * 0.6, 0, tiles, tileSize, solids);
        e.x = res.x + e.w / 2;
        e.y = res.y + e.h;
      }
      // try strike if close (even if player unarmed - free hits)
      if (Math.abs(dx) < Combat.STRIKE_RANGE_PX + 10 && e.cooldown <= 0 && !e.fightState) {
        e.fightState = 'StrikeWindup';
        e.fightTick = 0;
      }
    }
  }

  if (!e.fightState) return;

  e.facing = player.x >= e.x ? 1 : -1;

  switch (e.fightState) {
    case 'FightIdle': {
      e.aiTimer++;
      const dist = Math.abs(player.x - e.x);
      // Light parry chance (tier-1 rarely blocks so player can land hits)
      if (player.fightState === 'StrikeActive' && Math.random() < e.blockSkill * 0.35) {
        e.fightState = 'Parry';
        e.fightTick = 0;
        break;
      }
      if (dist > Combat.PREFERRED_AI_RANGE_PX + 8) {
        e.fightState = 'Advance';
        e.fightTick = 0;
      } else if (dist < Combat.PREFERRED_AI_RANGE_PX - 10) {
        e.fightState = 'Retreat';
        e.fightTick = 0;
      } else if (e.cooldown <= 0 && e.aiTimer > 20) {
        e.fightState = 'StrikeWindup';
        e.fightTick = 0;
        e.aiTimer = 0;
      }
      break;
    }
    case 'Advance': {
      step(e, e.facing * 0.9, tiles, tileSize, solids);
      if (e.fightTick >= 8) e.fightState = 'FightIdle';
      break;
    }
    case 'Retreat': {
      step(e, -e.facing * 0.9, tiles, tileSize, solids);
      if (e.fightTick >= 8) e.fightState = 'FightIdle';
      break;
    }
    case 'StrikeWindup': {
      // weak guard: slightly longer windup
      const wind = Combat.STRIKE_WINDUP + (e.tier === 1 ? 2 : 0);
      if (e.fightTick >= wind) {
        e.fightState = 'StrikeActive';
        e.fightTick = 0;
      }
      break;
    }
    case 'StrikeActive': {
      if (e.fightTick >= Combat.STRIKE_ACTIVE) {
        e.fightState = 'StrikeRecovery';
        e.fightTick = 0;
      }
      break;
    }
    case 'StrikeRecovery': {
      if (e.fightTick >= Combat.STRIKE_RECOVERY) {
        e.fightState = e.engagePlayer ? 'FightIdle' : null;
        e.cooldown = 40;
      }
      break;
    }
    case 'Parry': {
      if (e.fightTick >= Combat.PARRY_ACTIVE) e.fightState = 'FightIdle';
      break;
    }
    case 'Hurt': {
      if (e.fightTick >= Combat.HURT_TICKS) {
        e.fightState = e.engagePlayer ? 'FightIdle' : null;
      }
      break;
    }
    default:
      e.fightState = e.engagePlayer ? 'FightIdle' : null;
  }
}

function step(e, dx, tiles, tileSize, solids) {
  const box = feetToBox(e.x, e.y, e.w, e.h);
  const res = moveAndCollide(box, dx, 0, tiles, tileSize, solids);
  e.x = res.x + e.w / 2;
  e.y = res.y + e.h;
}

export function applyEnemyHit(e) {
  e.hp -= 1;
  e.fightState = 'Hurt';
  e.fightTick = 0;
  if (e.hp <= 0) {
    e.alive = false;
    e.fightState = null;
    e.engagePlayer = false;
    return true;
  }
  return false;
}

export function enemyIsParrying(e) {
  return e.fightState === 'Parry' && e.fightTick < Combat.PARRY_ACTIVE;
}
