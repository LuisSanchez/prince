import { allEntityDefs } from './LevelLoader.js';
import { initEntityRuntime } from '../systems/traps.js';
import { createEnemy } from '../entities/Enemy.js';
import { createPlayer } from '../entities/Player.js';

export function createLevelRuntime(level) {
  const defs = allEntityDefs(level);
  const entityRuntime = initEntityRuntime(defs);
  for (const d of defs) {
    const st = entityRuntime.get(d.id);
    if (st) {
      st.roomId = d.roomId;
      st.dead = false;
    }
  }

  return {
    level,
    entityRuntime,
    enemies: new Map(),
    player: null,
  };
}

export function spawnPlayer(runtime, spawn) {
  runtime.player = createPlayer(spawn);
  return runtime.player;
}

/** Enemies alive in this room (respects level-wide dead flags). */
export function spawnEnemiesForRoom(runtime, roomId) {
  const list = [];
  for (const e of runtime.entityRuntime.values()) {
    if (e.type !== 'enemy' || e.roomId !== roomId || e.dead) continue;
    let inst = runtime.enemies.get(e.id);
    if (!inst || !inst.alive) {
      inst = createEnemy(e);
      runtime.enemies.set(e.id, inst);
    }
    if (inst.alive) list.push(inst);
  }
  return list;
}

export function markEnemyDead(runtime, id) {
  const e = runtime.entityRuntime.get(id);
  if (e) e.dead = true;
  const inst = runtime.enemies.get(id);
  if (inst) {
    inst.alive = false;
    inst.hp = 0;
  }
}

/** Full level reinit from JSON (death restart) */
export function reinitLevel(_runtime, level) {
  return createLevelRuntime(level);
}

export function getRoom(level, roomId) {
  return level.rooms[roomId];
}
