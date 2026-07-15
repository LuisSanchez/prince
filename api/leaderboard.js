/**
 * Vercel serverless: GET /api/leaderboard  |  POST /api/leaderboard
 * Body (POST): { name, elapsedSec, timeLeftSec, stages, eligible, cheated }
 */
import { getTop, submitEntry } from '../lib/leaderboardStore.js';

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  // Same-origin game; allow simple CORS for local tooling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const limit = Math.min(50, Math.max(1, Number(req.query?.limit) || 10));
      send(res, 200, getTop(limit));
      return;
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      if (!body || typeof body !== 'object') {
        // Vercel may not auto-parse; read stream if needed
        body = await readJson(req);
      }
      const result = submitEntry(body);
      if (!result.ok) {
        send(res, 400, { error: result.error });
        return;
      }
      send(res, 201, { entry: result.entry, board: result.board });
      return;
    }

    send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/leaderboard]', err);
    send(res, 500, { error: 'Server error' });
  }
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}
