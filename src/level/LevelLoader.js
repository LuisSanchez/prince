/**
 * Load and validate level JSON (entity-first schema).
 */

export async function loadLevel(url) {
  let raw;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    throw new Error(`Failed to load level: ${err.message}`);
  }
  validateLevel(raw);
  return raw;
}

export function validateLevel(level) {
  if (!level.id || !level.rooms || !level.startRoom) {
    throw new Error('Failed to load level: missing id/rooms/startRoom');
  }
  if (!level.rooms[level.startRoom]) {
    throw new Error('Failed to load level: startRoom missing');
  }
  const ids = new Set();
  for (const [roomId, room] of Object.entries(level.rooms)) {
    if (!room.tiles || !room.w || !room.h) {
      throw new Error(`Failed to load level: room ${roomId} incomplete`);
    }
    for (const e of room.entities ?? []) {
      if (!e.id || !e.type) throw new Error(`Failed to load level: entity missing id/type in ${roomId}`);
      if (ids.has(e.id)) throw new Error(`Failed to load level: duplicate entity id ${e.id}`);
      ids.add(e.id);
      if (e.type === 'plate' && (e.mode != null || e.links != null)) {
        throw new Error(`Failed to load level: plate ${e.id} must not have mode/links`);
      }
    }
  }
  for (const link of level.links ?? []) {
    if (!link.from || !link.to || !link.mode || !link.action) {
      throw new Error('Failed to load level: link missing from/to/mode/action');
    }
    if (!ids.has(link.from) || !ids.has(link.to)) {
      throw new Error(`Failed to load level: link unresolved ${link.from}->${link.to}`);
    }
    if (link.mode === 'hold') {
      // same-room MVP check
      const fromRoom = findEntityRoom(level, link.from);
      const toRoom = findEntityRoom(level, link.to);
      if (fromRoom !== toRoom) {
        throw new Error(`Failed to load level: hold link must be same room (${link.from}->${link.to})`);
      }
    }
  }
}

function findEntityRoom(level, id) {
  for (const [roomId, room] of Object.entries(level.rooms)) {
    if ((room.entities ?? []).some((e) => e.id === id)) return roomId;
  }
  return null;
}

/**
 * Flatten all entities with roomId into list of defs.
 */
export function allEntityDefs(level) {
  const list = [];
  for (const [roomId, room] of Object.entries(level.rooms)) {
    for (const e of room.entities ?? []) {
      list.push({ ...e, roomId });
    }
  }
  return list;
}
