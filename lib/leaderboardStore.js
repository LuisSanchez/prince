/**
 * Leaderboard JSON store (server-side).
 * File: data/leaderboard.json (override with LEADERBOARD_PATH).
 *
 * Note for Vercel: the serverless filesystem is ephemeral. Writes work
 * within a warm instance but are not durable across deploys/cold starts.
 * This module is ready for a later swap to Vercel Blob / KV / Neon without
 * changing the API contract. Local `npm start` persists to disk reliably.
 */
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const MAX_ENTRIES = 50;
const MAX_NAME_LEN = 12;

function dataPath() {
  if (process.env.LEADERBOARD_PATH) return process.env.LEADERBOARD_PATH;
  return path.join(process.cwd(), 'data', 'leaderboard.json');
}

function emptyBoard() {
  return { version: 1, updatedAt: null, entries: [] };
}

export function loadBoard() {
  const p = dataPath();
  try {
    if (!fs.existsSync(p)) {
      const board = emptyBoard();
      saveBoard(board);
      return board;
    }
    const raw = fs.readFileSync(p, 'utf8');
    const board = JSON.parse(raw);
    if (!board || !Array.isArray(board.entries)) return emptyBoard();
    board.entries = board.entries
      .filter((e) => e && typeof e.elapsedSec === 'number' && e.name)
      .sort((a, b) => a.elapsedSec - b.elapsedSec)
      .slice(0, MAX_ENTRIES);
    return board;
  } catch (err) {
    console.warn('[leaderboard] load failed:', err.message);
    return emptyBoard();
  }
}

export function saveBoard(board) {
  const p = dataPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  board.updatedAt = new Date().toISOString();
  fs.writeFileSync(p, `${JSON.stringify(board, null, 2)}\n`, 'utf8');
}

/**
 * Sanitize prince name for the board.
 */
export function sanitizeName(name) {
  const s = String(name ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9 _\-'.]/g, '')
    .trim()
    .slice(0, MAX_NAME_LEN);
  return s || 'PRINCE';
}

/**
 * @param {{ name: string, elapsedSec: number, timeLeftSec: number, stages?: number }} payload
 * @returns {{ ok: true, entry: object, board: object } | { ok: false, error: string }}
 */
export function submitEntry(payload) {
  const elapsedSec = Number(payload?.elapsedSec);
  const timeLeftSec = Number(payload?.timeLeftSec);
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0 || elapsedSec > 7 * 60 + 5) {
    return { ok: false, error: 'Invalid time' };
  }
  if (!Number.isFinite(timeLeftSec) || timeLeftSec < 0) {
    return { ok: false, error: 'Invalid remaining time' };
  }
  // Must be a full-run claim — server trusts client flag only as soft gate;
  // hard reject if client says cheated
  if (payload?.cheated === true || payload?.eligible === false) {
    return { ok: false, error: 'Cheats used — not eligible' };
  }

  const entry = {
    id: randomBytes(8).toString('hex'),
    name: sanitizeName(payload.name),
    elapsedSec: Math.round(elapsedSec * 10) / 10,
    timeLeftSec: Math.round(timeLeftSec * 10) / 10,
    stages: Number(payload.stages) || 12,
    date: new Date().toISOString(),
  };

  const board = loadBoard();
  board.entries.push(entry);
  board.entries.sort((a, b) => a.elapsedSec - b.elapsedSec);
  board.entries = board.entries.slice(0, MAX_ENTRIES);
  try {
    saveBoard(board);
  } catch (err) {
    console.warn('[leaderboard] save failed (ephemeral FS?):', err.message);
    // Still return success with in-memory merge for this response
  }
  return { ok: true, entry, board };
}

export function getTop(limit = 10) {
  const board = loadBoard();
  return {
    ...board,
    entries: board.entries.slice(0, limit),
  };
}
