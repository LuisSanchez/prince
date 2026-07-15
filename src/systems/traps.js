import {
  LOOSE_SHAKE_TICKS, CHOMPER_OPEN, CHOMPER_CLOSED,
} from '../config.js';
import { aabbOverlap } from './collision.js';
import { playerHurtbox } from '../entities/Player.js';
import { healLifePotion, poisonPotion } from './session.js';

/**
 * Build runtime state for entities from level JSON defs.
 */
export function initEntityRuntime(entities) {
  /** @type {Map<string, any>} */
  const map = new Map();
  for (const e of entities) {
    const st = { ...e, taken: false, collapsed: false, shake: 0, timer: 0, pressed: false };
    if (e.type === 'chomper') {
      st.phase = 'open';
      st.timer = CHOMPER_OPEN;
      st.closed = false;
    }
    if (e.type === 'spikes') {
      st.raised = e.raised !== false;
    }
    if (e.type === 'gate') {
      st.blocking = e.blocking !== false;
    }
    if (e.type === 'loose') {
      st.shake = 0;
      st.collapsed = false;
    }
    map.set(e.id, st);
  }
  return map;
}

export function getBlockingSolids(runtimeEntities) {
  const solids = [];
  for (const e of runtimeEntities.values()) {
    if (e.type === 'gate' && e.blocking) {
      solids.push({ x: e.x, y: e.y, w: e.w, h: e.h });
    }
    if (e.type === 'loose' && !e.collapsed) {
      solids.push({ x: e.x, y: e.y, w: e.w ?? 32, h: e.h ?? 8, looseId: e.id });
    }
  }
  return solids;
}

/**
 * Process plates/gates links + hazards + pickups.
 */
export function updateTraps(player, session, level, runtime, events, opts = {}) {
  const ph = playerHurtbox(player);
  const roomEntities = [];
  for (const e of runtime.values()) {
    if (e.roomId && e.roomId !== session.roomId) continue;
    roomEntities.push(e);
  }

  // plates pressed
  for (const e of roomEntities) {
    if (e.type !== 'plate') continue;
    const box = { x: e.x, y: e.y, w: e.w ?? 24, h: e.h ?? 8 };
    const was = e.pressed;
    e.pressed = aabbOverlap(
      { x: player.x - player.w / 2, y: player.y - 4, w: player.w, h: 6 },
      box,
    );
    e.pressEdge = e.pressed && !was;
  }

  // apply links (gates may be in another room — oneshot/toggle persist on entity)
  for (const link of level.links ?? []) {
    const plate = runtime.get(link.from);
    const gate = runtime.get(link.to);
    if (!plate || !gate || gate.type !== 'gate') continue;

    if (link.mode === 'hold') {
      // MVP: hold only reliable same-room; pressed cleared on room exit
      if (plate.pressed) {
        applyGateAction(gate, link.action === 'toggle' ? 'open' : link.action);
      } else if (!plate.oneshotDone) {
        if (link.action === 'open') gate.blocking = true;
        else if (link.action === 'close') gate.blocking = false;
      }
    } else if (link.mode === 'toggle' && plate.pressEdge) {
      applyGateAction(gate, link.action);
    } else if (link.mode === 'oneshot') {
      if (plate.pressEdge && !plate.oneshotDone) {
        applyGateAction(gate, link.action);
        plate.oneshotDone = true;
        gate.oneshotOpen = true;
        session.message = 'GATE OPEN';
        session.messageTicks = 80;
      } else if (plate.oneshotDone || gate.oneshotOpen) {
        // keep open after trigger
        if (link.action === 'open' || link.action === 'toggle') gate.blocking = false;
      }
    }
  }

  // spikes — damage (1 life), not instant death:
  //  • hitbox inset on left/right so edge graze is kinder
  //  • feet contact only; jumping clear of tops is safe
  //  • invuln gate prevents multi-tick shredding
  for (const e of roomEntities) {
    if (e.type === 'spikes' && e.raised) {
      const fullW = e.w ?? 32;
      const fullH = e.h ?? 16;
      const inset = Math.max(5, fullW * 0.15);
      const box = {
        x: e.x + inset,
        y: e.y + 2,
        w: Math.max(8, fullW - inset * 2),
        h: Math.max(6, fullH - 2),
      };
      const feet = {
        x: player.x - player.w / 2 + 3,
        y: player.y - 5,
        w: player.w - 6,
        h: 6,
      };
      const airStates = new Set(['JumpUp', 'JumpForward', 'Fall', 'Hang', 'ClimbUp']);
      if (airStates.has(player.state) && player.y < e.y + 2) continue;
      if (aabbOverlap(feet, box)) {
        // One heart per touch; invuln stops repeated hits every frame
        if ((player.invuln ?? 0) <= 0) {
          events.push({ type: 'spikeDamage', amount: 1 });
        }
      }
    }
  }

  // loose floors
  for (const e of roomEntities) {
    if (e.type !== 'loose' || e.collapsed) continue;
    const box = { x: e.x, y: e.y, w: e.w ?? 32, h: e.h ?? 8 };
    const standing = aabbOverlap(
      { x: player.x - player.w / 2, y: player.y - 2, w: player.w, h: 4 },
      { x: box.x, y: box.y - 2, w: box.w, h: box.h + 4 },
    );
    if (standing || e.shake > 0) {
      e.shake++;
      if (e.shake >= LOOSE_SHAKE_TICKS) {
        e.collapsed = true;
        events.push({ type: 'looseCollapse', id: e.id });
      }
    }
  }

  // chomper
  for (const e of roomEntities) {
    if (e.type !== 'chomper') continue;
    e.timer--;
    if (e.timer <= 0) {
      if (e.phase === 'open') {
        e.phase = 'closed';
        e.closed = true;
        e.timer = CHOMPER_CLOSED;
      } else {
        e.phase = 'open';
        e.closed = false;
        e.timer = CHOMPER_OPEN;
      }
    }
    if (e.closed) {
      const box = { x: e.x, y: e.y, w: e.w ?? 32, h: e.h ?? 32 };
      if (aabbOverlap(ph, box)) {
        player.alive = false;
        events.push({ type: 'chomper' });
      }
    }
  }

  // sword
  for (const e of roomEntities) {
    if (e.type !== 'sword' || e.taken) continue;
    const box = { x: e.x, y: e.y, w: e.w ?? 16, h: e.h ?? 32 };
    if (aabbOverlap(ph, box)) {
      e.taken = true;
      session.hasSword = true;
      player.hasSword = true;
      // Sheathed until a guard is nearby
      player.swordDrawn = false;
      session.message = 'SWORD';
      session.messageTicks = 90;
      events.push({ type: 'sword' });
    }
  }

  // potions
  for (const e of roomEntities) {
    if (e.type !== 'potion' || e.taken) continue;
    const box = { x: e.x, y: e.y, w: e.w ?? 12, h: e.h ?? 16 };
    if (aabbOverlap(ph, box)) {
      e.taken = true;
      if (e.variant === 'life') {
        healLifePotion(session);
        session.message = 'LIFE';
        session.messageTicks = 60;
      } else if (e.variant === 'poison') {
        const dead = poisonPotion(session);
        session.message = 'POISON';
        session.messageTicks = 60;
        if (dead) {
          player.alive = false;
          events.push({ type: 'poisonDeath' });
        }
      }
      events.push({ type: 'potion', variant: e.variant });
    }
  }

  // Stage door — walk deep into the wall doorway only (opts.stageDoorArmed from PlayScene)
  for (const e of roomEntities) {
    if (e.type !== 'exit') continue;
    if (opts && opts.stageDoorArmed === false) continue;
    const box = {
      x: e.x,
      y: e.y,
      w: e.w ?? 28,
      h: e.h ?? 64,
    };
    const body = {
      x: player.x - player.w / 2,
      y: player.y - player.h,
      w: player.w,
      h: player.h,
    };
    // Must be clearly inside the doorway (x deep into door), not the same floor tile mid-room
    if (aabbOverlap(body, box) && player.x >= e.x + 6) {
      events.push({ type: 'levelExit' });
    }
  }
}

function applyGateAction(gate, action) {
  if (action === 'open') gate.blocking = false;
  else if (action === 'close') gate.blocking = true;
  else if (action === 'toggle') gate.blocking = !gate.blocking;
}

/** Clear hold pressed when leaving room (MVP) */
export function onRoomExitClearPlates(runtime) {
  for (const e of runtime.values()) {
    if (e.type === 'plate') {
      e.pressed = false;
    }
  }
}
