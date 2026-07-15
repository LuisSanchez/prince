/**
 * Client leaderboard API + helpers.
 * Ranked by elapsed clear time (lower is better). Only full non-cheat runs submit.
 */

import { START_TIME_SEC } from '../config.js';

const API = '/api/leaderboard';

export function isLeaderboardEligible(session) {
  if (!session) return false;
  if (session.cheated) return false;
  if (session.fullRun === false) return false;
  // Must have started from stage 1 path (fullRun true set only on clean start)
  return session.fullRun === true && !session.cheated;
}

/** Elapsed game time (pause freezes the hourglass). */
export function elapsedSecFromSession(session) {
  const left = Math.max(0, Number(session?.timeLeftSec) || 0);
  return Math.max(0, START_TIME_SEC - left);
}

export function formatElapsed(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export async function fetchLeaderboard(limit = 10) {
  try {
    const res = await fetch(`${API}?limit=${limit}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[leaderboard] fetch failed:', err.message);
    return { version: 1, entries: [], error: err.message };
  }
}

/**
 * @param {{ name: string, session: object, stages?: number }} opts
 */
export async function submitLeaderboardScore({ name, session, stages = 12 }) {
  if (!isLeaderboardEligible(session)) {
    return { ok: false, error: 'Not eligible (cheats or incomplete run)' };
  }
  const elapsedSec = elapsedSecFromSession(session);
  const body = {
    name,
    elapsedSec,
    timeLeftSec: session.timeLeftSec,
    stages,
    eligible: true,
    cheated: false,
  };
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, entry: data.entry, board: data.board };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error' };
  }
}
