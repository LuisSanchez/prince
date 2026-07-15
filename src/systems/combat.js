import { Combat } from '../config.js';
import { aabbOverlap } from './collision.js';
import {
  playerHurtbox, playerStrikeHitbox, playerIsStrikeActive, playerIsParrying, applyPlayerHit,
} from '../entities/Player.js';
import {
  enemyHurtbox, enemyStrikeHitbox, enemyIsStrikeActive, enemyIsParrying, applyEnemyHit,
} from '../entities/Enemy.js';
import { damage } from './session.js';

/**
 * Resolve sword combat + unarmed enemy strikes for current room.
 */
export function resolveCombat(player, enemies, session, events) {
  for (const e of enemies) {
    if (!e.alive) continue;

    // Unarmed: enemy active strike kills. With sword, take normal damage instead.
    if (!session.hasSword && enemyIsStrikeActive(e)) {
      if (aabbOverlap(playerHurtbox(player), enemyStrikeHitbox(e))) {
        player.alive = false;
        events.push({ type: 'unarmedDeath' });
        return;
      }
    }

    // Idle body push (not during strikes)
    if (!enemyIsStrikeActive(e) && !playerIsStrikeActive(player)) {
      const ph = playerHurtbox(player);
      const eh = enemyHurtbox(e);
      if (aabbOverlap(ph, eh)) {
        const push = player.x < e.x ? -1.5 : 1.5;
        player.x += push;
        e.x -= push * 0.5;
      }
    }

    if (!session.hasSword) continue;

    // Player strike vs enemy — one successful hit per swing (strikeHitDone)
    if (playerIsStrikeActive(player) && !player.strikeHitDone) {
      const hit = playerStrikeHitbox(player);
      const eh = enemyHurtbox(e);
      // Generous: also accept horizontal proximity during active frames
      const closeEnough =
        aabbOverlap(hit, eh)
        || (
          Math.abs(e.y - player.y) <= Combat.FLOOR_BAND_PX + 8
          && Math.abs(e.x - player.x) <= Combat.STRIKE_RANGE_PX + 12
          && Math.sign(e.x - player.x) === player.facing
        );
      if (closeEnough) {
        if (enemyIsParrying(e)) {
          player.x -= player.facing * Combat.BLOCK_PUSH_PX;
          player.strikeHitDone = true;
          events.push({ type: 'parried' });
        } else {
          const killed = applyEnemyHit(e);
          e.x += player.facing * Combat.HIT_KNOCKBACK_PX;
          player.strikeHitDone = true;
          events.push({ type: 'enemyHit', id: e.id, killed, hp: e.hp });
          if (killed && player.engageEnemyId === e.id) {
            player.fightState = null;
            player.engageEnemyId = null;
            player.swordDrawn = true;
            player.state = 'Idle';
          }
        }
      }
    }

    // Enemy strike vs player
    if (enemyIsStrikeActive(e)) {
      const hit = enemyStrikeHitbox(e);
      if (aabbOverlap(hit, playerHurtbox(player)) || (
        Math.abs(e.y - player.y) <= Combat.FLOOR_BAND_PX + 8
        && Math.abs(e.x - player.x) <= Combat.STRIKE_RANGE_PX + 8
      )) {
        if (playerIsParrying(player)) {
          e.x -= e.facing * Combat.BLOCK_PUSH_PX;
          events.push({ type: 'playerParry' });
        } else if (player.invuln <= 0) {
          if (applyPlayerHit(player, session, events)) {
            const dead = damage(session, 1);
            if (dead) {
              player.alive = false;
              events.push({ type: 'playerDead' });
            }
          }
        }
      }
    }
  }
}
