import {
  PLAYER_W, PLAYER_H, RUN_SPEED, GRAVITY, MAX_FALL_VY,
  CAREFUL_STEP_PX, CAREFUL_STEP_TICKS, JUMP_UP_FRAMES, JUMP_FORWARD_FRAMES,
  CLIMB_FRAMES, FALL_DMG_HARD, FALL_LETHAL, Combat, PLAYER_HURT_INSET,
} from '../config.js';
import {
  moveAndCollide, feetToBox, ledgeSensor, findLedge, aabbOverlap,
  hasGroundSupport, maxSafeCarefulStep,
} from '../systems/collision.js';

/**
 * Player action FSM with per-state motion.
 * Feet coords: (x, y) mid-bottom.
 */
export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    facing: spawn.facing ?? 1,
    w: PLAYER_W,
    h: PLAYER_H,
    vx: 0,
    vy: 0,
    state: 'Idle',
    stateTick: 0,
    frameIndex: 0,
    frameTick: 0,
    fallStartY: spawn.y,
    hasSword: false,
    swordDrawn: false,
    alive: true,
    // scripted motion
    carefulRemaining: 0,
    carefulDir: 0,
    motionFrames: null,
    motionFacing: 1,
    hangAnchor: null,
    climbFrames: null,
    // combat
    fightState: null, // null = not engaged
    fightTick: 0,
    engageEnemyId: null,
    invuln: 0,
    strikeHitDone: false, // one hit per swing
  };
}

export function playerHurtbox(p) {
  const box = feetToBox(p.x, p.y, p.w, p.h);
  return {
    x: box.x + PLAYER_HURT_INSET.x,
    y: box.y + PLAYER_HURT_INSET.y,
    w: PLAYER_HURT_INSET.w,
    h: PLAYER_HURT_INSET.h,
  };
}

export function playerStrikeHitbox(p) {
  const hb = playerHurtbox(p);
  // Long reach so fights at preferred AI range still connect
  const w = 36;
  const h = 22;
  const x = p.facing > 0 ? hb.x + hb.w - 4 : hb.x - w + 4;
  return { x, y: hb.y + 4, w, h };
}

function setState(p, state) {
  p.state = state;
  p.stateTick = 0;
  p.frameIndex = 0;
  p.frameTick = 0;
}

function startFrameTable(p, frames, facing = p.facing) {
  p.motionFrames = frames;
  p.motionFacing = facing;
  p.frameIndex = 0;
  p.frameTick = 0;
}

function advanceFrameTable(p, tiles, tileSize, solids) {
  const frames = p.motionFrames;
  if (!frames || p.frameIndex >= frames.length) return { done: true, hit: false };
  const f = frames[p.frameIndex];
  const dx = f.dx * p.motionFacing;
  const dy = f.dy;
  const box = feetToBox(p.x, p.y, p.w, p.h);
  const res = moveAndCollide(box, dx, dy, tiles, tileSize, solids);
  p.x = res.x + p.w / 2;
  p.y = res.y + p.h;
  p.frameTick++;
  if (p.frameTick >= f.durationTicks) {
    p.frameIndex++;
    p.frameTick = 0;
  }
  if (res.hitX || res.hitY) {
    // cancel scripted jump into fall if head/wall
    return { done: p.frameIndex >= frames.length, hit: true, grounded: res.grounded, hitY: res.hitY, hitX: res.hitX };
  }
  return { done: p.frameIndex >= frames.length, hit: false, grounded: res.grounded };
}

function isFighting(p) {
  return p.fightState != null;
}

function groundedOnlyStates(state) {
  return ['Idle', 'Run', 'Crouch', 'CarefulStep', 'Turn', 'Land'].includes(state);
}

/**
 * @param {object} p player
 * @param {object} input
 * @param {object} roomCtx { tiles, tileSize, solids, enemies }
 * @param {object} session
 */
export function updatePlayer(p, input, roomCtx, session) {
  if (!p.alive) return { died: false, events: [] };
  const events = [];
  const { tiles, tileSize, solids } = roomCtx;
  p.stateTick++;
  if (p.invuln > 0) p.invuln--;

  // Sync sword from session
  p.hasSword = session.hasSword;

  // Combat sub-FSM takes over movement when engaged
  if (isFighting(p)) {
    updateFight(p, input, roomCtx, session, events);
    return { died: !p.alive, events };
  }

  const ax = input.axisX();
  const up = input.justPressed('up') || (input.isDown('up') && p.state === 'Hang');
  const down = input.isDown('down');
  const shift = input.isDown('shift');

  switch (p.state) {
    case 'Idle': {
      p.vx = 0;
      p.vy = 0;
      if (ax !== 0 && ax !== p.facing) {
        p.facing = ax;
        setState(p, 'Turn');
        break;
      }
      if (down) {
        setState(p, 'Crouch');
        break;
      }
      if (shift && ax !== 0) {
        p.carefulDir = ax;
        p.facing = ax;
        p.carefulRemaining = CAREFUL_STEP_PX;
        setState(p, 'CarefulStep');
        break;
      }
      if (ax !== 0) {
        p.facing = ax;
        setState(p, 'Run');
        break;
      }
      if (input.justPressed('up')) {
        if (ax !== 0) {
          p.facing = ax;
          setState(p, 'JumpForward');
          startFrameTable(p, JUMP_FORWARD_FRAMES, p.facing);
        } else {
          setState(p, 'JumpUp');
          startFrameTable(p, JUMP_UP_FRAMES, p.facing);
        }
        events.push({ type: 'jump' });
        break;
      }
      // Slash (Space/Z) — engage + swing
      if (session.hasSword && input.justPressed('strike')) {
        beginStrike(p, roomCtx, session);
      }
      break;
    }
    case 'Turn': {
      if (p.stateTick > 8) setState(p, 'Idle');
      break;
    }
    case 'Crouch': {
      p.vx = 0;
      p.vy = 0;
      // Crouching never walks off edges. Careful creep while crouched + dir.
      if (shift && ax !== 0) {
        p.carefulDir = ax;
        p.facing = ax;
        p.carefulRemaining = CAREFUL_STEP_PX * 0.5;
        setState(p, 'CarefulStep');
        break;
      }
      // Allow sword while crouched (e.g. standing on a ↓ hatch after tapping ↓)
      if (session.hasSword && input.justPressed('strike')) {
        beginStrike(p, roomCtx, session);
        break;
      }
      if (!down) setState(p, 'Idle');
      break;
    }
    case 'CarefulStep': {
      // Classic feel: toes stop at the precipice — never walk off while careful.
      const want = Math.min(1.6, p.carefulRemaining);
      const safe = maxSafeCarefulStep(
        p.x, p.y, p.w, p.h, p.carefulDir, want, tiles, tileSize, solids,
      );
      if (safe <= 0) {
        // At edge (or wall). Stay put — do not fall.
        setState(p, 'Idle');
        break;
      }
      const box = feetToBox(p.x, p.y, p.w, p.h);
      const res = moveAndCollide(box, p.carefulDir * safe, 0, tiles, tileSize, solids);
      p.x = res.x + p.w / 2;
      p.y = res.y + p.h;
      p.carefulRemaining -= safe;
      // If movement was clipped by wall or remaining step budget is done
      if (res.hitX || p.carefulRemaining <= 0.5 || safe < want - 0.05) {
        setState(p, 'Idle');
      }
      // Safety net: if support vanished (e.g. loose floor mid-step), fall
      if (!hasGroundSupport(p.x, p.y, p.w, tiles, tileSize, solids) && !res.grounded) {
        beginFall(p);
      }
      break;
    }
    case 'Run': {
      if (ax === 0) {
        setState(p, 'Idle');
        break;
      }
      p.facing = ax;
      if (input.justPressed('up')) {
        setState(p, 'JumpForward');
        startFrameTable(p, JUMP_FORWARD_FRAMES, p.facing);
        events.push({ type: 'jump' });
        break;
      }
      // Shift while running → careful step (edge-aware)
      if (shift) {
        p.carefulDir = ax;
        p.carefulRemaining = CAREFUL_STEP_PX;
        setState(p, 'CarefulStep');
        break;
      }
      const box = feetToBox(p.x, p.y, p.w, p.h);
      const res = moveAndCollide(box, ax * RUN_SPEED, 0, tiles, tileSize, solids);
      p.x = res.x + p.w / 2;
      p.y = res.y + p.h;
      if (res.hitX) setState(p, 'Idle');
      // Running off a ledge still falls (classic — use careful step near edges)
      if (!res.grounded) beginFall(p);
      if (session.hasSword && input.justPressed('strike')) {
        beginStrike(p, roomCtx, session);
      }
      break;
    }
    case 'JumpUp':
    case 'JumpForward': {
      const r = advanceFrameTable(p, tiles, tileSize, solids);
      // ledge grab near apex / while moving
      const sensor = ledgeSensor(p.x, p.y, p.w, p.h, p.facing);
      const ledge = findLedge(tiles, tileSize, sensor, p.facing);
      if (ledge && (p.state === 'JumpUp' || p.state === 'JumpForward')) {
        // Hang just under the ledge lip (not inside the solid)
        p.hangAnchor = ledge;
        p.x = ledge.x - p.facing * 6;
        p.y = ledge.y + 2; // feet slightly below surface while hanging
        p.vx = 0;
        p.vy = 0;
        setState(p, 'Hang');
        p.motionFrames = null;
        break;
      }
      if (r.hit && r.hitY && r.grounded) {
        land(p, 0, session, events);
        break;
      }
      if (r.hit || r.done) {
        // transition to fall with residual
        p.vx = p.facing * (p.state === 'JumpForward' ? 1.2 : 0);
        beginFall(p);
      }
      break;
    }
    case 'Fall': {
      p.vy = Math.min(MAX_FALL_VY, p.vy + GRAVITY);
      const box = feetToBox(p.x, p.y, p.w, p.h);
      const res = moveAndCollide(box, p.vx, p.vy, tiles, tileSize, solids);
      p.x = res.x + p.w / 2;
      p.y = res.y + p.h;
      if (res.hitX) p.vx = 0;
      // ledge grab while falling
      if (p.vy > 0) {
        const sensor = ledgeSensor(p.x, p.y, p.w, p.h, p.facing);
        const ledge = findLedge(tiles, tileSize, sensor, p.facing);
        if (ledge && input.isDown('shift')) {
          p.hangAnchor = ledge;
          p.x = ledge.x - p.facing * 6;
          p.y = ledge.y + 2;
          p.vx = 0;
          p.vy = 0;
          setState(p, 'Hang');
          break;
        }
      }
      if (res.grounded && res.hitY) {
        const dist = p.y - p.fallStartY;
        land(p, dist, session, events);
      }
      break;
    }
    case 'Land': {
      if (p.stateTick > 10) setState(p, 'Idle');
      break;
    }
    case 'Hang': {
      p.vx = 0;
      p.vy = 0;
      if (input.isDown('up') || input.justPressed('up')) {
        setState(p, 'ClimbUp');
        startFrameTable(p, CLIMB_FRAMES, p.facing);
        break;
      }
      // Drop only on deliberate press (not hold spam while climbing UI)
      if (input.justPressed('down')) {
        // Deliberate drop from ledge (short falls usually safe; pits still kill)
        p.y += 4;
        beginFall(p);
      }
      break;
    }
    case 'ClimbUp': {
      // Scripted climb is visual only — final pose is snapped onto the ledge top.
      // Applying frame dy into solids was pushing the prince *through* the floor.
      p.frameTick++;
      const frames = p.motionFrames;
      const f = frames?.[p.frameIndex];
      if (f && p.frameTick >= f.durationTicks) {
        p.frameIndex++;
        p.frameTick = 0;
      }
      const done = !frames || p.frameIndex >= frames.length;
      if (done) {
        finishClimbOntoLedge(p, tiles, tileSize, solids);
      }
      break;
    }
    case 'Sheathe': {
      if (p.stateTick >= Combat.SHEATHE_TICKS) {
        p.swordDrawn = false;
        setState(p, 'Idle');
      }
      break;
    }
    case 'Hurt': {
      if (p.stateTick >= Combat.HURT_TICKS) {
        if (p.fightState) p.fightState = 'FightIdle';
        else setState(p, 'Idle');
      }
      break;
    }
    default:
      setState(p, 'Idle');
  }

  // Auto-draw only when a living guard is on the SAME floor.
  // Also works on vertical pads (↓ hatch / ↑ doorway) so rooms like BONE HALL
  // stay fightable; pad exits are handled earlier in PlayScene via justPressed.
  if (session.hasSword && p.alive) {
    const near = nearestEngageable(p, roomCtx.enemies ?? []);
    const midSwing = p.fightState && (
      p.fightState === 'StrikeWindup'
      || p.fightState === 'StrikeActive'
      || p.fightState === 'StrikeRecovery'
      || p.fightState === 'Hurt'
      || p.fightState === 'Sheathe'
    );

    if (near && !isFighting(p) && ['Idle', 'Run', 'Land', 'Turn', 'CarefulStep', 'Crouch'].includes(p.state)) {
      if (tryEngage(p, roomCtx, session)) {
        if (session.messageTicks <= 0) {
          session.message = 'SWORD OUT';
          session.messageTicks = 40;
        }
      }
    } else if (!near && isFighting(p) && !midSwing) {
      // Leave combat stance — put the sword away
      const foe = (roomCtx.enemies ?? []).find((e) => e.id === p.engageEnemyId);
      if (foe) {
        foe.engagePlayer = false;
        if (foe.fightState === 'FightIdle' || foe.fightState === 'Advance' || foe.fightState === 'Retreat') {
          foe.fightState = null;
        }
      }
      p.fightState = null;
      p.engageEnemyId = null;
      p.swordDrawn = false;
      if (p.state === 'Fight') setState(p, 'Idle');
    } else if (!near && !isFighting(p)) {
      p.swordDrawn = false;
    }
  } else if (!session.hasSword) {
    p.swordDrawn = false;
  }

  return { died: !p.alive, events };
}

/** Engage nearest guard (if any) and start a slash. */
function beginStrike(p, roomCtx, session) {
  tryEngage(p, roomCtx, session);
  if (!p.fightState) {
    // No enemy nearby — do not draw for nothing
    return;
  }
  if (p.fightState === 'FightIdle' || p.fightState === 'Advance' || p.fightState === 'Retreat' || p.fightState === 'Parry') {
    p.fightState = 'StrikeWindup';
    p.fightTick = 0;
    p.strikeHitDone = false;
    p.swordDrawn = true;
  }
}

function beginFall(p) {
  p.fallStartY = p.y;
  p.vy = Math.max(p.vy, 0.5);
  setState(p, 'Fall');
}

/** Snap feet onto the top of the grabbed ledge, clear of solids. */
function finishClimbOntoLedge(p, tiles, tileSize, solids) {
  const ledge = p.hangAnchor;
  p.hangAnchor = null;
  p.motionFrames = null;
  p.vx = 0;
  p.vy = 0;
  if (ledge) {
    // Stand on the ledge surface (feet = top of solid)
    const surfaceY = ledge.y;
    // Step onto the platform in the facing direction (away from the free edge)
    const onto = (ledge.solid?.w ?? tileSize) * 0.35;
    p.x = ledge.x + p.facing * Math.max(onto, p.w * 0.6 + 4);
    p.y = surfaceY;
    // Resolve any residual overlap: push up out of solid, then settle down onto top
    let box = feetToBox(p.x, p.y, p.w, p.h);
    let res = moveAndCollide(box, 0, -2, tiles, tileSize, solids);
    p.x = res.x + p.w / 2;
    p.y = res.y + p.h;
    box = feetToBox(p.x, p.y, p.w, p.h);
    res = moveAndCollide(box, 0, 8, tiles, tileSize, solids);
    p.x = res.x + p.w / 2;
    p.y = res.y + p.h;
    // If still not grounded, place explicitly on ledge top
    if (!res.grounded && ledge.y != null) {
      p.y = ledge.y;
    }
  }
  setState(p, 'Idle');
}

function land(p, dist, session, events) {
  p.vx = 0;
  p.vy = 0;
  p.motionFrames = null;
  if (dist >= FALL_LETHAL) {
    p.alive = false;
    events.push({ type: 'lethalFall' });
    setState(p, 'Dead');
    return;
  }
  if (dist >= FALL_DMG_HARD) {
    events.push({ type: 'fallDamage', amount: 1 });
    setState(p, 'Crouch');
    return;
  }
  setState(p, 'Land');
}

function tryEngage(p, roomCtx, session) {
  if (!session.hasSword) return false;
  if (p.fightState) {
    p.swordDrawn = true;
    return true;
  }
  const enemy = nearestEngageable(p, roomCtx.enemies ?? []);
  if (!enemy) return false;
  p.swordDrawn = true;
  p.hasSword = true;
  p.fightState = 'FightIdle';
  p.fightTick = 0;
  p.engageEnemyId = enemy.id;
  // Pull enemy into duel mode (keep their swing if mid-attack)
  enemy.engagePlayer = true;
  if (!enemy.fightState) enemy.fightState = 'FightIdle';
  setState(p, 'Fight');
  return true;
}

function nearestEngageable(p, enemies) {
  let best = null;
  let bestD = Infinity;
  // SAME floor only — do not duel a guard on the ground while standing on a mid platform
  // (that froze the tower ↑ pad: fightState blocked vertical exits)
  const band = Combat.FLOOR_BAND_PX; // ~16px feet band
  const range = Combat.ENGAGE_RANGE_PX + 16;
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = Math.abs(e.x - p.x);
    const dy = Math.abs(e.y - p.y);
    if (dx <= range && dy <= band && dx < bestD) {
      best = e;
      bestD = dx;
    }
  }
  return best;
}

function updateFight(p, input, roomCtx, session, events) {
  const enemy = (roomCtx.enemies ?? []).find((e) => e.id === p.engageEnemyId);
  if (!enemy || !enemy.alive) {
    // remain drawn
    p.fightState = null;
    p.engageEnemyId = null;
    setState(p, 'Idle');
    p.swordDrawn = true;
    return;
  }

  // break if Y diverges
  if (Math.abs(enemy.y - p.y) > Combat.FLOOR_BAND_PX + 4) {
    p.fightState = null;
    enemy.fightState = null;
    enemy.engagePlayer = false;
    setState(p, 'Idle');
    return;
  }

  // face enemy
  p.facing = enemy.x >= p.x ? 1 : -1;
  p.fightTick++;
  const { tiles, tileSize, solids } = roomCtx;

  switch (p.fightState) {
    case 'FightIdle': {
      if (input.justPressed('down')) {
        p.fightState = 'Sheathe';
        p.fightTick = 0;
        break;
      }
      if (input.justPressed('strike') || input.justPressed('up')) {
        p.fightState = 'StrikeWindup';
        p.fightTick = 0;
        p.strikeHitDone = false;
        break;
      }
      if (input.isDown('shift')) {
        p.fightState = 'Parry';
        p.fightTick = 0;
        break;
      }
      const ax = input.axisX();
      if (ax !== 0) {
        // toward enemy = advance
        const toward = Math.sign(enemy.x - p.x);
        if (ax === toward) {
          p.fightState = 'Advance';
          p.fightTick = 0;
        } else {
          p.fightState = 'Retreat';
          p.fightTick = 0;
        }
      }
      break;
    }
    case 'Advance': {
      // Same pace as normal run (RUN_SPEED) — was 10px/tick and felt like 2×+ speed with sword out
      stepFight(p, p.facing * Combat.ADVANCE_STEP_PX, tiles, tileSize, solids);
      if (p.fightTick >= 8 || input.axisX() === 0) p.fightState = 'FightIdle';
      break;
    }
    case 'Retreat': {
      stepFight(p, -p.facing * Combat.RETREAT_STEP_PX, tiles, tileSize, solids);
      if (p.fightTick >= 8 || input.axisX() === 0) p.fightState = 'FightIdle';
      break;
    }
    case 'StrikeWindup': {
      if (p.fightTick >= Combat.STRIKE_WINDUP) {
        p.fightState = 'StrikeActive';
        p.fightTick = 0;
        p.strikeHitDone = false;
      }
      break;
    }
    case 'StrikeActive': {
      // hit resolved in combat system
      if (p.fightTick >= Combat.STRIKE_ACTIVE) {
        p.fightState = 'StrikeRecovery';
        p.fightTick = 0;
      }
      break;
    }
    case 'StrikeRecovery': {
      if (p.fightTick >= Combat.STRIKE_RECOVERY) p.fightState = 'FightIdle';
      break;
    }
    case 'Parry': {
      if (p.fightTick >= Combat.PARRY_ACTIVE || !input.isDown('shift')) {
        p.fightState = 'FightIdle';
      }
      break;
    }
    case 'Sheathe': {
      if (p.fightTick >= Combat.SHEATHE_TICKS) {
        p.fightState = null;
        p.engageEnemyId = null;
        enemy.fightState = null;
        enemy.engagePlayer = false;
        p.swordDrawn = false;
        setState(p, 'Idle');
      }
      break;
    }
    case 'Hurt': {
      if (p.fightTick >= Combat.HURT_TICKS) p.fightState = 'FightIdle';
      break;
    }
    default:
      p.fightState = 'FightIdle';
  }
}

function stepFight(p, dx, tiles, tileSize, solids) {
  const box = feetToBox(p.x, p.y, p.w, p.h);
  const res = moveAndCollide(box, dx, 0, tiles, tileSize, solids);
  p.x = res.x + p.w / 2;
  p.y = res.y + p.h;
}

export function playerIsStrikeActive(p) {
  return p.fightState === 'StrikeActive';
}

export function playerIsParrying(p) {
  return p.fightState === 'Parry' && p.fightTick < Combat.PARRY_ACTIVE;
}

export function applyPlayerHit(p, session, events) {
  if (p.invuln > 0) return false;
  p.invuln = 20;
  events.push({ type: 'playerHit' });
  if (p.fightState) {
    p.fightState = 'Hurt';
    p.fightTick = 0;
  } else {
    setState(p, 'Hurt');
  }
  return true;
}
