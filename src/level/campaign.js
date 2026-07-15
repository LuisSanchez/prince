/** Campaign manifest helpers */

let cached = null;

export async function loadManifest() {
  if (cached) return cached;
  const res = await fetch('./levels/manifest.json');
  if (!res.ok) throw new Error(`Failed to load manifest: HTTP ${res.status}`);
  cached = await res.json();
  return cached;
}

export function levelEntryById(manifest, id) {
  return (manifest.levels ?? []).find((l) => l.id === id) ?? null;
}

export function firstLevelId(manifest) {
  return manifest.levels?.[0]?.id ?? 'level01';
}

export function nextLevelId(manifest, currentId) {
  const list = manifest.levels ?? [];
  const i = list.findIndex((l) => l.id === currentId);
  if (i < 0 || i >= list.length - 1) return null;
  return list[i + 1].id;
}

export function levelFilePath(manifest, id) {
  const e = levelEntryById(manifest, id);
  return e?.file ? `./${e.file.replace(/^\.\//, '')}` : `./levels/${id}.json`;
}

export function levelDisplayName(manifest, id) {
  return levelEntryById(manifest, id)?.name ?? id;
}

export function levelIndex(manifest, id) {
  const e = levelEntryById(manifest, id);
  return e?.index ?? 1;
}

export function totalLevels(manifest) {
  return (manifest.levels ?? []).length;
}
