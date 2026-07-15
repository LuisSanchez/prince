import { COLORS, LOGICAL_W, TILE, HUD_H, PLAYFIELD_H } from '../config.js';
import { loadLevel } from '../level/LevelLoader.js';
import {
  createLevelRuntime, spawnPlayer, spawnEnemiesForRoom, reinitLevel, markEnemyDead, getRoom,
} from '../level/LevelRuntime.js';
import {
  loadManifest, firstLevelId, nextLevelId, levelFilePath,
  levelDisplayName, levelIndex, totalLevels,
} from '../level/campaign.js';
import { updatePlayer, playerHurtbox, playerStrikeHitbox } from '../entities/Player.js';
import { updateEnemy, enemyHurtbox, enemyStrikeHitbox } from '../entities/Enemy.js';
import { resolveCombat } from '../systems/combat.js';
import {
  updateTraps, getBlockingSolids, onRoomExitClearPlates,
} from '../systems/traps.js';
import {
  newGameSession, snapshotLevelEntry, onDeathRestart, tickTimer, damage,
  cheatAddHeart,
} from '../systems/session.js';
import { drawHud, drawActionToast } from '../render/Hud.js';
import { drawDebug } from '../render/DebugOverlay.js';
import {
  drawWallTile, drawRoomBackdrop, drawFigure, drawEntity,
  drawRoomDoor, drawDamageVignette,
} from '../render/draw.js';
import { aabbOverlap, unstickFromSolids, snapFeetToGround } from '../systems/collision.js';
import {
  sfxHitEnemy, sfxHitPlayer, sfxSword, sfxSpike, sfxTrap, sfxDeath, sfxDoor,
  sfxJump, sfxBattleWin, setBattleMusic, unlockAudio, startBackgroundMusic,
} from '../audio/sfx.js';

export function createPlayScene(api) {
  let manifest = null;
  let level = null;
  let runtime = null;
  let session = null;
  let roomId = 'r0';
  let enemies = [];
  let loading = false;
  let fpsFrames = 0;
  let fpsT = 0;
  let fps = 0;
  let tick = 0;
  let roomFlash = 0;
  let damageFlash = 0;
  let roomBannerTicks = 0;
  let roomBanner = '';
  /** Ignore side-exit edge detection briefly after a room/stage change (prevents ping-pong freeze). */
  let exitCooldown = 0;
  /** Block stage door until player leaves spawn and walks into the wall doorway. */
  let stageDoorArmed = false;
  let stageDoorCooldown = 0;
  const debug = new URLSearchParams(location.search).has('debug');

  async function ensureManifest() {
    if (!manifest) manifest = await loadManifest();
    return manifest;
  }

  async function boot(existingSession) {
    loading = true;
    runtime = null;
    try {
      const man = await ensureManifest();
      session = existingSession ?? newGameSession();
      if (!session.levelId) session.levelId = firstLevelId(man);

      const path = levelFilePath(man, session.levelId);
      level = await loadLevel(path);
      session.levelId = level.id;
      snapshotLevelEntry(session);

      runtime = createLevelRuntime(level);
      roomId = level.start.room;
      session.roomId = roomId;
      session.paused = false; // never carry pause into a new stage
      const start = level.start;
      spawnPlayer(runtime, { x: start.x, y: start.y, facing: start.facing });
      // Keep sword across levels once found
      runtime.player.hasSword = session.hasSword;
      if (session.hasSword) runtime.player.swordDrawn = false;
      placePlayerSafely(runtime.player, roomId);
      enemies = spawnEnemiesForRoom(runtime, roomId);
      showRoomBanner(roomId);
      roomFlash = 0.5;
      exitCooldown = 50; // room links
      stageDoorArmed = false;
      stageDoorCooldown = 90; // must wait ~1.5s before stage door can arm

      const n = levelIndex(man, session.levelId);
      const tot = totalLevels(man);
      session.message = `STAGE ${n}/${tot}`;
      session.messageTicks = 100;
    } catch (e) {
      api.showTitle(e.message || 'Failed to load level');
    } finally {
      loading = false;
    }
  }

  function showRoomBanner(id) {
    const room = getRoom(level, id);
    roomBanner = room?.label || id.toUpperCase();
    roomBannerTicks = 90;
  }

  function placePlayerSafely(p, rid) {
    const room = getRoom(level, rid);
    if (!room?.tiles) return;
    const tileSize = room.tileSize || TILE;
    const roomRuntime = new Map();
    for (const [id, e] of runtime.entityRuntime) {
      if (e.roomId === rid) roomRuntime.set(id, e);
    }
    const solids = getBlockingSolids(roomRuntime);
    // Hard reset ALL motion/combat so vertical room swaps never leave a stuck FSM
    p.vx = 0;
    p.vy = 0;
    p.state = 'Idle';
    p.stateTick = 0;
    p.frameIndex = 0;
    p.frameTick = 0;
    p.fightState = null;
    p.engageEnemyId = null;
    p.motionFrames = null;
    p.hangAnchor = null;
    p.carefulRemaining = 0;
    p.strikeHitDone = false;
    p.swordDrawn = false; // draw only when a guard is near
    p.alive = true;

    const pos = unstickFromSolids(p.x, p.y, p.w, p.h, room.tiles, tileSize, solids);
    p.x = pos.x;
    p.y = pos.y;
    // Second pass: snap firmly onto ground under the free pose
    const grounded = snapFeetToGround(p.x, p.y, p.w, p.h, room.tiles, tileSize, solids);
    p.x = grounded.x;
    p.y = grounded.y;
    p.fallStartY = p.y;
  }

  function restartLevel() {
    onDeathRestart(session);
    runtime = reinitLevel(runtime, level);
    roomId = level.start.room;
    session.roomId = roomId;
    session.paused = false;
    spawnPlayer(runtime, {
      x: level.start.x,
      y: level.start.y,
      facing: level.start.facing,
    });
    runtime.player.hasSword = session.hasSword;
    placePlayerSafely(runtime.player, roomId);
    enemies = spawnEnemiesForRoom(runtime, roomId);
    showRoomBanner(roomId);
    roomFlash = 0.65;
    damageFlash = 0.35;
  }

  function changeRoom(exit) {
    if (!level.rooms[exit.toRoom]) {
      console.warn('Invalid room exit', exit);
      return;
    }
    onRoomExitClearPlates(runtime.entityRuntime);
    for (const link of level.links ?? []) {
      if (link.mode !== 'hold') continue;
      const gate = runtime.entityRuntime.get(link.to);
      if (gate && link.action === 'open') gate.blocking = true;
    }
    roomId = exit.toRoom;
    session.roomId = roomId;
    const sp = exit.spawn ?? { x: 160, y: 160, facing: 1 };
    const p = runtime.player;
    // Prefer explicit floor spawns; vertical links must not land inside platforms
    const destRoom = level.rooms[roomId];
    let sx = sp.x ?? 160;
    let sy = sp.y ?? 160;
    // Default vertical arrivals to main floor unless spawn says otherwise and is safe
    if (exit.dir === 'up' || exit.dir === 'down') {
      sx = sp.x ?? 160;
      sy = sp.y ?? 160;
    }
    p.x = Math.min(256, Math.max(64, sx));
    p.y = sy;
    p.facing = sp.facing ?? p.facing;
    p.invuln = 45;
    placePlayerSafely(p, roomId);
    // If still not free (rare), force center floor of dest room
    const room = destRoom;
    if (room?.tiles) {
      const solids = getBlockingSolids(
        new Map([...runtime.entityRuntime].filter(([, e]) => e.roomId === roomId)),
      );
      // Emergency: if pose is insane after unstick, drop to room center floor
      if (p.y > 190 || p.y < 60 || p.x < 40 || p.x > 280) {
        const g = snapFeetToGround(160, 40, p.w, p.h, room.tiles, room.tileSize || TILE, solids);
        p.x = g.x;
        p.y = g.y;
      }
    }
    enemies = spawnEnemiesForRoom(runtime, roomId);
    showRoomBanner(roomId);
    // Soft brief dim only (no sliding wipe bars)
    roomFlash = 0.35;
    exitCooldown = 50;
  }

  function playerOnPad(player, zone) {
    if (!zone) return false;
    const body = { x: player.x - 10, y: player.y - 36, w: 20, h: 40 };
    const feet = { x: player.x - 10, y: player.y - 6, w: 20, h: 12 };
    return aabbOverlap(body, zone) || aabbOverlap(feet, zone);
  }

  function isOnAnyVerticalPad(player, room) {
    for (const exit of room.exits ?? []) {
      if ((exit.dir === 'up' || exit.dir === 'down') && exit.zone && playerOnPad(player, exit.zone)) {
        return true;
      }
    }
    return false;
  }

  /** Drop duel lock so room transitions never leave a stuck Fight FSM. */
  function clearFightForRoomChange(player) {
    if (player.fightState == null && player.state !== 'Fight') return;
    const foeId = player.engageEnemyId;
    player.fightState = null;
    player.engageEnemyId = null;
    player.swordDrawn = false;
    if (player.state === 'Fight') player.state = 'Idle';
    if (foeId != null) {
      const foe = enemies.find((e) => e.id === foeId);
      if (foe) {
        foe.engagePlayer = false;
        if (foe.fightState === 'FightIdle' || foe.fightState === 'Advance' || foe.fightState === 'Retreat') {
          foe.fightState = null;
        }
      }
    }
  }

  /**
   * ↑ / ↓ room pads — checked before player update so ↑ is not eaten by JumpUp
   * and ↓ is not eaten by crouch/sheathe.
   *
   * Important: do NOT cancel combat every frame while standing on a pad.
   * BONE HALL (and similar) places a guard near the ↓ hatch; wiping fightState
   * each tick made Space/Z strikes impossible in that zone.
   */
  function checkVerticalPads(player, input) {
    if (exitCooldown > 0) return false;
    const room = getRoom(level, roomId);
    if (!room) return false;

    // Treat Idle/Run/Land/Crouch/Careful/Fight as usable on pads (not mid-jump)
    const airborne = ['Fall', 'JumpUp', 'JumpForward', 'Hang', 'ClimbUp'].includes(player.state);
    if (airborne) return false;

    for (const exit of room.exits ?? []) {
      if (exit.dir !== 'up' && exit.dir !== 'down') continue;
      const zone = exit.zone;
      if (!zone || !playerOnPad(player, zone)) continue;

      if (exit.dir === 'up') {
        if (input.justPressed('up')) {
          clearFightForRoomChange(player);
          changeRoom(exit);
          return true;
        }
        session.message = '↑ PRESS';
        session.messageTicks = 2;
      } else {
        // justPressed only — holding ↓ still crouches / can fight; hatch needs a deliberate press
        if (input.justPressed('down')) {
          clearFightForRoomChange(player);
          changeRoom(exit);
          return true;
        }
        session.message = '↓ PRESS';
        session.messageTicks = 2;
      }
    }
    return false;
  }

  /** Left / right wall doorways only. */
  function checkSideDoors(player, input) {
    if (player.fightState != null) return false;
    if (exitCooldown > 0) return false;
    const room = getRoom(level, roomId);
    if (!room) return false;
    const airborne = ['Fall', 'JumpUp', 'JumpForward', 'Hang', 'ClimbUp'].includes(player.state);
    if (airborne) return false;

    const body = { x: player.x - 8, y: player.y - 28, w: 16, h: 30 };

    for (const exit of room.exits ?? []) {
      if (exit.dir !== 'left' && exit.dir !== 'right') continue;
      let zone = exit.zone ?? null;
      if (!zone) {
        if (exit.dir === 'right') zone = { x: 288, y: 88, w: 28, h: 72 };
        else zone = { x: 4, y: 88, w: 28, h: 72 };
      }
      if (!aabbOverlap(body, zone)) continue;
      if (exit.dir === 'right' && player.x >= 290) {
        changeRoom(exit);
        return true;
      }
      if (exit.dir === 'left' && player.x <= 30) {
        changeRoom(exit);
        return true;
      }
    }
    return false;
  }

  function onLevelExit() {
    const man = manifest;
    const next = nextLevelId(man, session.levelId);
    const name = levelDisplayName(man, session.levelId);
    const num = levelIndex(man, session.levelId);
    const tot = totalLevels(man);
    api.levelClear({
      session,
      timeLeftSec: session.timeLeftSec,
      levelName: name,
      levelNum: num,
      total: tot,
      hasNext: Boolean(next),
      nextLevelId: next,
    });
  }

  return {
    name: 'play',
    async enter(data) {
      unlockAudio();
      startBackgroundMusic();
      await boot(data?.session);
    },
    update(dt, input) {
      if (loading || !runtime?.player || !level) return;
      tick++;
      if (exitCooldown > 0) exitCooldown--;
      if (stageDoorCooldown > 0) {
        stageDoorCooldown--;
      } else if (!stageDoorArmed && runtime.player.x > 80 && runtime.player.x < 250) {
        // Arm only after the prince has moved into the open room (not standing in a door)
        stageDoorArmed = true;
      }
      if (roomFlash > 0) roomFlash = Math.max(0, roomFlash - 0.05);
      if (damageFlash > 0) damageFlash = Math.max(0, damageFlash - 0.03);
      if (roomBannerTicks > 0) roomBannerTicks--;

      if (session.timeUp) {
        api.gameOver('TIME UP');
        return;
      }
      if (input.justPressed('pause')) {
        unlockAudio();
        session.paused = !session.paused;
      }

      // Cheat: + / = / numpad+ → gain 1 heart, max 5 (works while paused too)
      if (input.justPressed('cheatLife') && session) {
        if (cheatAddHeart(session, 5)) {
          session.message = `+1 LIFE  ${session.health}/${session.maxHealth} · NO RANK`;
          session.messageTicks = 60;
        } else {
          session.message = 'MAX LIFE (5)';
          session.messageTicks = 40;
        }
      }

      if (session.paused) return;

      if (input.justPressed('restart')) {
        restartLevel();
        return;
      }

      tickTimer(session, dt);
      const player = runtime.player;
      const room = getRoom(level, roomId);
      if (!room?.tiles) {
        // Recover from bad room id (e.g. leftover r0 after stage swap)
        roomId = level.start?.room || Object.keys(level.rooms)[0];
        session.roomId = roomId;
        placePlayerSafely(player, roomId);
        enemies = spawnEnemiesForRoom(runtime, roomId);
        return;
      }

      const roomRuntime = new Map();
      for (const [id, e] of runtime.entityRuntime) {
        if (e.roomId === roomId) roomRuntime.set(id, e);
      }
      // Links need full runtime for cross-room oneshot plates
      const fullForTraps = runtime.entityRuntime;
      const roomSolids = getBlockingSolids(roomRuntime);

      const onVerticalPad = isOnAnyVerticalPad(player, room);

      const roomCtx = {
        tiles: room.tiles,
        tileSize: room.tileSize || TILE,
        solids: roomSolids,
        enemies,
        onVerticalPad,
      };

      const events = [];

      // Vertical pads FIRST so ↑/↓ on a pad warps instead of starting a jump that freezes mid-air
      if (checkVerticalPads(player, input)) {
        return;
      }

      const result = updatePlayer(player, input, roomCtx, session);
      events.push(...result.events);

      // Side doors (left/right wall) after movement
      if (checkSideDoors(player, input)) {
        return;
      }

      for (const e of enemies) {
        updateEnemy(e, player, roomCtx);
      }

      resolveCombat(player, enemies, session, events);
      updateTraps(player, session, level, fullForTraps, events, {
        stageDoorArmed: stageDoorArmed && stageDoorCooldown <= 0,
      });

      // Process ALL gameplay events after player/combat/traps (spikes were missed before)
      for (const ev of events) {
        if (ev.type === 'jump') {
          sfxJump();
        }
        if (ev.type === 'fallDamage' || ev.type === 'spikeDamage') {
          damageFlash = 0.45;
          if ((player.invuln ?? 0) <= 0) {
            player.invuln = 50;
            if (ev.type === 'spikeDamage') sfxSpike();
            else sfxTrap();
            const dead = damage(session, ev.amount ?? 1);
            session.message = ev.type === 'spikeDamage' ? '-1 SPIKE' : 'HARD FALL';
            session.messageTicks = 55;
            if (dead) {
              player.alive = false;
              sfxDeath();
            }
          }
        }
        if (ev.type === 'playerHit' || ev.type === 'playerDead') {
          damageFlash = 0.45;
          sfxHitPlayer();
        }
        if (ev.type === 'enemyHit') {
          sfxHitEnemy();
          if (ev.killed) {
            markEnemyDead(runtime, ev.id);
            sfxBattleWin();
            session.message = 'FELL';
            session.messageTicks = 50;
          } else {
            session.message = `HIT ${ev.hp}`;
            session.messageTicks = 40;
          }
        }
        if (ev.type === 'parried') {
          session.message = 'BLOCKED';
          session.messageTicks = 30;
        }
        if (ev.type === 'sword') {
          roomFlash = 0.25;
          sfxSword();
        }
        if (ev.type === 'chomper' || ev.type === 'unarmedDeath' || ev.type === 'poisonDeath') {
          sfxTrap();
          sfxDeath();
        }
        if (ev.type === 'levelExit') {
          setBattleMusic(false);
          sfxDoor();
          onLevelExit();
          return;
        }
      }

      // Battle bed while in a duel
      const inBattle = Boolean(player.fightState) && enemies.some((e) => e.alive);
      setBattleMusic(inBattle);

      if (player.y > PLAYFIELD_H + 40) {
        player.alive = false;
        sfxDeath();
      }

      if (!player.alive) {
        setBattleMusic(false);
        if (!events.some((e) => e.type === 'chomper' || e.type === 'unarmedDeath' || e.type === 'spikeDamage')) {
          sfxDeath();
        }
        restartLevel();
        return;
      }

      fpsFrames++;
      fpsT += dt;
      if (fpsT >= 1) {
        fps = fpsFrames;
        fpsFrames = 0;
        fpsT = 0;
      }
    },
    render(ctx, renderer) {
      if (!runtime?.player || !level) {
        renderer.clear();
        ctx.fillStyle = COLORS.hudDim;
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(loading ? 'LOADING…' : '…', LOGICAL_W / 2, 100);
        ctx.textAlign = 'left';
        return;
      }
      renderer.clear();
      const room = getRoom(level, roomId);
      const stageLabel = manifest && session
        ? `${levelIndex(manifest, session.levelId)}/${totalLevels(manifest)}`
        : '';
      // Room name + stage only in HUD (no overlapping playfield banner)
      drawHud(ctx, session, {
        roomName: room?.label || roomBanner || '',
        stageLabel: stageLabel ? `ST ${stageLabel}` : '',
      });

      const player = runtime.player;
      const tileSize = room.tileSize || TILE;

      renderer.withPlayfield((c) => {
        drawRoomBackdrop(c, roomId, tick, level?.theme || 'dungeon');

        for (let ty = 0; ty < room.h; ty++) {
          for (let tx = 0; tx < room.w; tx++) {
            if (room.tiles[ty][tx] === 1) {
              drawWallTile(c, tx, ty, tileSize, level?.theme || 'dungeon');
            }
          }
        }

        drawExitHints(c, room, tick);

        for (const e of runtime.entityRuntime.values()) {
          if (e.roomId !== roomId) continue;
          drawEntity(c, e, tick);
        }

        for (const e of enemies) {
          if (!e.alive) continue;
          drawFigure(c, e, 'enemy', e.fightState || 'Idle', {
            tick,
            outfit: e.outfit
              || (level?.theme === 'ship' ? 'ship' : undefined)
              || (level?.theme === 'mars' ? 'mars' : undefined),
            theme: level?.theme,
          });
          drawEnemyHealth(c, e);
        }

        const flash = player.invuln > 0 && (player.invuln % 4 < 2);
        const plabel = player.fightState || player.state;
        drawFigure(c, player, 'player', plabel, {
          tick,
          flash,
          swordDrawn: Boolean(player.swordDrawn || player.fightState),
          hasSwordSheathed: Boolean(session.hasSword && !player.swordDrawn && !player.fightState),
        });

        // Soft fade only — no sliding wipe lines
        if (roomFlash > 0.02) {
          c.fillStyle = `rgba(0,0,0,${roomFlash * 0.4})`;
          c.fillRect(0, 0, 320, 184);
        }
      });

      // Action toasts float in playfield, clear of the HUD
      drawActionToast(ctx, session, HUD_H);
      drawDamageVignette(ctx, damageFlash);

      if (session.paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, HUD_H, LOGICAL_W, PLAYFIELD_H);
        ctx.fillStyle = COLORS.hudText;
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', LOGICAL_W / 2, 96);
        ctx.font = '8px monospace';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText('P resume  ·  R restart stage', LOGICAL_W / 2, 118);
        ctx.textAlign = 'left';
      }

      if (debug) {
        const boxes = [playerHurtbox(player)];
        if (player.fightState === 'StrikeActive') boxes.push(playerStrikeHitbox(player));
        for (const e of enemies) {
          if (!e.alive) continue;
          boxes.push(enemyHurtbox(e));
          if (e.fightState === 'StrikeActive') boxes.push(enemyStrikeHitbox(e));
        }
        drawDebug(ctx, {
          enabled: true,
          fps,
          roomId,
          state: player.fightState || player.state,
          hasSword: session.hasSword,
          x: player.x,
          y: player.y,
          fight: player.fightState,
          health: session.health,
          maxHealth: session.maxHealth,
          timeLeftSec: session.timeLeftSec,
          boxes,
        });
      }
    },
  };
}

/** Red triangle pips above enemy (same language as player HUD). */
function drawEnemyHealth(c, e) {
  const max = e.maxHp || e.hp || 3;
  const hp = Math.max(0, e.hp ?? 0);
  const pipW = 5;
  const gap = 2;
  const totalW = max * (pipW + gap) - gap;
  const baseX = Math.round(e.x - totalW / 2);
  const baseY = Math.round(e.y - e.h - 10);
  // backdrop
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.fillRect(baseX - 2, baseY - 1, totalW + 4, 8);
  for (let i = 0; i < max; i++) {
    const x = baseX + i * (pipW + gap);
    c.fillStyle = i < hp ? '#c02828' : '#2a1515';
    c.beginPath();
    c.moveTo(x + pipW / 2, baseY);
    c.lineTo(x + pipW, baseY + 6);
    c.lineTo(x, baseY + 6);
    c.closePath();
    c.fill();
  }
}

function drawExitHints(c, room, tick = 0) {
  for (const exit of room.exits ?? []) {
    if (exit.dir === 'right') {
      drawRoomDoor(c, 'right', tick);
    } else if (exit.dir === 'left') {
      drawRoomDoor(c, 'left', tick);
    } else if (exit.zone && exit.dir === 'up') {
      const z = exit.zone;
      c.fillStyle = 'rgba(201,162,39,0.22)';
      c.fillRect(z.x, z.y, z.w, z.h);
      c.fillStyle = '#fff0c0';
      c.font = '8px monospace';
      c.textAlign = 'center';
      c.fillText('↑ PRESS', z.x + z.w / 2, z.y + Math.min(14, z.h - 2));
      c.textAlign = 'left';
    } else if (exit.zone && exit.dir === 'down') {
      const z = exit.zone;
      c.fillStyle = 'rgba(201,162,39,0.4)';
      c.fillRect(z.x, z.y, z.w, z.h);
      c.fillStyle = '#1a1008';
      for (let i = 4; i < z.w - 4; i += 8) {
        c.fillRect(z.x + i, z.y + 2, 2, Math.max(4, z.h - 4));
      }
      c.fillStyle = '#fff0c0';
      c.font = '8px monospace';
      c.textAlign = 'center';
      c.fillText('↓ PRESS', z.x + z.w / 2, z.y - 2);
      c.textAlign = 'left';
    }
  }
}
