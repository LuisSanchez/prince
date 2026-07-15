import {
  START_TIME_SEC, START_HEALTH, MAX_HEALTH_CAP, FIXED_DT,
} from '../config.js';

/**
 * Classic session policy (K13).
 */
export function createSession() {
  return {
    timeLeftSec: START_TIME_SEC,
    health: START_HEALTH,
    maxHealth: START_HEALTH,
    hasSword: false,
    levelId: 'level01',
    roomId: 'r0',
    levelEntryHealth: START_HEALTH,
    levelEntryMax: START_HEALTH,
    levelEntryHasSword: false,
    message: '',
    messageTicks: 0,
    paused: false,
    won: false,
    timeUp: false,
    /** Clean full campaign from title (stage 1). False if stage-skip cheat used. */
    fullRun: true,
    /** Any cheat (+ life, goN, cutscene skip-cheats) voids leaderboard. */
    cheated: false,
    cheatReason: null,
  };
}

export function newGameSession() {
  const s = createSession();
  return s;
}

/** Call when entering a level (new game or after clear). */
export function snapshotLevelEntry(session) {
  session.levelEntryHealth = session.health;
  session.levelEntryMax = session.maxHealth;
  session.levelEntryHasSword = session.hasSword;
}

/**
 * Death / R restart → reinit stage from outside; restore FULL heart bar
 * (includes extra lives from potions / maxHealth growth — not capped at 3).
 */
export function onDeathRestart(session) {
  // Keep any capacity earned mid-run (bottles); never drop below START_HEALTH capacity
  session.maxHealth = Math.max(START_HEALTH, session.maxHealth, session.levelEntryMax ?? 0);
  session.health = session.maxHealth;
  session.hasSword = session.levelEntryHasSword;
  session.message = 'RESTART';
  session.messageTicks = 90;
  // timeLeft continues
}

export function tickTimer(session, dt) {
  if (session.paused || session.won || session.timeUp) return;
  session.timeLeftSec -= dt;
  if (session.timeLeftSec <= 0) {
    session.timeLeftSec = 0;
    session.timeUp = true;
  }
  if (session.messageTicks > 0) {
    session.messageTicks--;
    if (session.messageTicks <= 0) session.message = '';
  }
}

export function damage(session, amount) {
  session.health -= amount;
  if (session.health <= 0) {
    session.health = 0;
    return true; // dead
  }
  return false;
}

export function healLifePotion(session) {
  session.health += 1;
  if (session.health > session.maxHealth) {
    session.maxHealth = Math.min(MAX_HEALTH_CAP, session.health);
  }
}

/** Mark run as non-leaderboard (stage skip or +life). */
export function markCheated(session, reason = 'cheat') {
  if (!session) return;
  session.cheated = true;
  session.fullRun = false;
  session.cheatReason = reason;
}

/** Cheat: press + to gain one heart, capped at `cap` (default 5). Voids leaderboard. */
export function cheatAddHeart(session, cap = 5) {
  const limit = Math.min(cap, MAX_HEALTH_CAP);
  if (session.health >= limit) return false;
  session.health += 1;
  if (session.maxHealth < session.health) {
    session.maxHealth = session.health;
  }
  session.maxHealth = Math.min(session.maxHealth, limit);
  session.health = Math.min(session.health, session.maxHealth);
  markCheated(session, 'life');
  return true;
}

/**
 * Entering a new stage: keep earned heart capacity (potions), fill all hearts.
 * Example: 5 max from bottles → start next stage at 5/5, not 3/5.
 */
export function refillHealthForNewStage(session) {
  session.maxHealth = Math.max(START_HEALTH, session.maxHealth);
  session.health = session.maxHealth;
}

export function poisonPotion(session) {
  return damage(session, 1);
}

export { FIXED_DT };
