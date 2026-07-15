/**
 * Web Audio SFX + music for Grok Prince.
 * Procedural chiptune — no external assets.
 *
 * Separate toggles:
 *   setMusicEnabled / isMusicEnabled  — BGM + battle bed
 *   setSfxEnabled   / isSfxEnabled    — one-shots (jump, hits, doors…)
 */

let ctx = null;
let musicEnabled = true;
let sfxEnabled = true;

let battleNodes = null;
let battleOn = false;
let bgmNodes = null;
let bgmOn = false;
/** When true, battle is active so BGM stays ducked/stopped. */
let wantBattle = false;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
}

/** @deprecated use setMusicEnabled / setSfxEnabled */
export function setMuted(m) {
  const off = Boolean(m);
  setMusicEnabled(!off);
  setSfxEnabled(!off);
}

export function setMusicEnabled(on) {
  musicEnabled = Boolean(on);
  if (!musicEnabled) {
    stopBattleMusic();
    stopBackgroundMusic();
  } else {
    // Resume ambient bed unless a fight is active
    if (wantBattle) startBattleMusic();
    else startBackgroundMusic();
  }
}

export function setSfxEnabled(on) {
  sfxEnabled = Boolean(on);
}

export function isMusicEnabled() {
  return musicEnabled;
}

export function isSfxEnabled() {
  return sfxEnabled;
}

export function toggleMusic() {
  setMusicEnabled(!musicEnabled);
  return musicEnabled;
}

export function toggleSfx() {
  setSfxEnabled(!sfxEnabled);
  return sfxEnabled;
}

function beep({ freq = 440, dur = 0.08, type = 'square', gain = 0.08, slideTo = null, delay = 0 }) {
  if (!sfxEnabled) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function sfxHitEnemy() {
  beep({ freq: 520, dur: 0.05, type: 'square', gain: 0.09 });
  beep({ freq: 280, dur: 0.09, type: 'triangle', gain: 0.06, delay: 0.03 });
  beep({ freq: 180, dur: 0.06, type: 'sawtooth', gain: 0.03, delay: 0.02 });
}

/** Short fanfare when a guard falls (battle won). */
export function sfxBattleWin() {
  const notes = [392, 494, 587, 784]; // G4 B4 D5 G5
  notes.forEach((f, i) => {
    beep({ freq: f, dur: 0.1, type: 'square', gain: 0.055, delay: i * 0.07 });
    beep({ freq: f * 2, dur: 0.08, type: 'triangle', gain: 0.025, delay: i * 0.07 + 0.02 });
  });
  beep({ freq: 784, dur: 0.22, type: 'triangle', gain: 0.05, delay: 0.3 });
  beep({ freq: 988, dur: 0.18, type: 'square', gain: 0.035, delay: 0.38 });
}

export function sfxHitPlayer() {
  beep({ freq: 160, dur: 0.12, type: 'sawtooth', gain: 0.07, slideTo: 80 });
  beep({ freq: 90, dur: 0.15, type: 'square', gain: 0.05, delay: 0.02 });
}

export function sfxStageClear() {
  [523, 659, 784, 1047].forEach((f, i) => {
    beep({ freq: f, dur: 0.14, type: 'triangle', gain: 0.07, delay: i * 0.09 });
  });
  beep({ freq: 784, dur: 0.25, type: 'square', gain: 0.04, delay: 0.38 });
}

export function sfxVictory() {
  sfxStageClear();
  beep({ freq: 1047, dur: 0.3, type: 'triangle', gain: 0.06, delay: 0.5 });
  beep({ freq: 1319, dur: 0.35, type: 'triangle', gain: 0.05, delay: 0.65 });
}

export function sfxSword() {
  beep({ freq: 660, dur: 0.07, type: 'square', gain: 0.06 });
  beep({ freq: 990, dur: 0.1, type: 'triangle', gain: 0.05, delay: 0.05 });
}

/** Classic short hop blip */
export function sfxJump() {
  beep({ freq: 280, dur: 0.06, type: 'square', gain: 0.055, slideTo: 520 });
  beep({ freq: 360, dur: 0.08, type: 'triangle', gain: 0.035, delay: 0.02, slideTo: 640 });
}

/** Spike jab */
export function sfxSpike() {
  beep({ freq: 900, dur: 0.04, type: 'square', gain: 0.06, slideTo: 200 });
  beep({ freq: 140, dur: 0.1, type: 'sawtooth', gain: 0.05, delay: 0.02 });
}

/** Chomper / loose floor / general trap */
export function sfxTrap() {
  beep({ freq: 120, dur: 0.08, type: 'square', gain: 0.08 });
  beep({ freq: 60, dur: 0.18, type: 'sawtooth', gain: 0.06, delay: 0.04, slideTo: 40 });
  beep({ freq: 200, dur: 0.06, type: 'triangle', gain: 0.04, delay: 0.08 });
}

/** Death / stage restart sting */
export function sfxDeath() {
  beep({ freq: 220, dur: 0.15, type: 'sawtooth', gain: 0.07, slideTo: 55 });
  beep({ freq: 110, dur: 0.28, type: 'square', gain: 0.05, delay: 0.08, slideTo: 40 });
  beep({ freq: 80, dur: 0.35, type: 'triangle', gain: 0.04, delay: 0.15 });
}

/** Door open / walk through */
export function sfxDoor() {
  beep({ freq: 180, dur: 0.12, type: 'triangle', gain: 0.05 });
  beep({ freq: 240, dur: 0.1, type: 'square', gain: 0.04, delay: 0.08 });
  beep({ freq: 360, dur: 0.14, type: 'triangle', gain: 0.04, delay: 0.14 });
}

/** Ambient whoosh for stage transition */
export function sfxTransition() {
  beep({ freq: 200, dur: 0.35, type: 'sine', gain: 0.04, slideTo: 480 });
  beep({ freq: 140, dur: 0.4, type: 'triangle', gain: 0.035, delay: 0.05, slideTo: 320 });
  beep({ freq: 90, dur: 0.5, type: 'sine', gain: 0.025, delay: 0.1, slideTo: 60 });
}

/* ─── shared synth helpers ───────────────────────────────────────── */

function mtof(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function scheduleTone(c, dest, { freq, type, t0, dur, gain, slideTo = null }) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) {
    osc.frequency.linearRampToValueAtTime(slideTo, t0 + dur * 0.9);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function scheduleKick(c, dest, t0, gain = 0.12) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t0);
  osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.11);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  osc.stop(t0 + 0.17);
}

function scheduleNoise(c, dest, t0, dur, gain, hp = 1800) {
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = hp;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/**
 * Generic look-ahead sequencer for pattern loops.
 * patterns: { bass, lead, harm, arp, drums } arrays / string length `len`
 */
function startSequencer({
  bpm, len, patterns, masterGain = 0.05, padMidi = null, padGain = 0.1,
  onNodes, isActive, gains = {},
}) {
  const c = ac();
  if (!c) return null;

  const master = c.createGain();
  master.gain.value = 0.0001;
  master.connect(c.destination);
  master.gain.linearRampToValueAtTime(masterGain, c.currentTime + 0.3);

  let pad = null;
  if (padMidi != null) {
    pad = c.createOscillator();
    pad.type = 'triangle';
    pad.frequency.value = mtof(padMidi);
    const padG = c.createGain();
    padG.gain.value = padGain;
    pad.connect(padG);
    padG.connect(master);
    pad.start();
  }

  const stepSec = 60 / bpm / 4;
  let step = 0;
  let nextTime = c.currentTime + 0.05;
  let cancelled = false;
  let timer = null;
  const LOOKAHEAD = 0.14;
  const TICK_MS = 35;

  const gBass = gains.bass ?? 0.07;
  const gLead = gains.lead ?? 0.055;
  const gHarm = gains.harm ?? 0.032;
  const gArp = gains.arp ?? 0.02;
  const gKick = gains.kick ?? 0.11;
  const gSnare = gains.snare ?? 0.04;
  const gHat = gains.hat ?? 0.016;
  const gLeadOct = gains.leadOct ?? 0.016;

  const schedule = () => {
    if (cancelled || !isActive()) return;
    const now = c.currentTime;
    while (nextTime < now + LOOKAHEAD) {
      const i = step % len;
      const t0 = nextTime;
      const noteDur = stepSec * 0.9;
      const { bass, lead, harm, arp, drums } = patterns;

      if (bass && bass[i]) {
        scheduleTone(c, master, {
          freq: mtof(bass[i]),
          type: 'square',
          t0,
          dur: noteDur * 1.1,
          gain: gBass,
        });
      }
      if (lead && lead[i]) {
        scheduleTone(c, master, {
          freq: mtof(lead[i]),
          type: 'square',
          t0,
          dur: noteDur * 1.05,
          gain: gLead,
        });
        if (gLeadOct > 0) {
          scheduleTone(c, master, {
            freq: mtof(lead[i] + 12),
            type: 'triangle',
            t0,
            dur: noteDur * 0.55,
            gain: gLeadOct,
          });
        }
      }
      if (harm && harm[i]) {
        scheduleTone(c, master, {
          freq: mtof(harm[i]),
          type: 'triangle',
          t0,
          dur: noteDur * 1.25,
          gain: gHarm,
        });
      }
      if (arp && arp[i]) {
        scheduleTone(c, master, {
          freq: mtof(arp[i]),
          type: 'triangle',
          t0,
          dur: stepSec * 0.72,
          gain: gArp,
        });
      }
      if (drums) {
        const d = drums[i];
        if (d === 'K') scheduleKick(c, master, t0, gKick);
        else if (d === 'S') {
          scheduleNoise(c, master, t0, 0.08, gSnare, 1200);
          scheduleTone(c, master, {
            freq: 200, type: 'triangle', t0, dur: 0.05, gain: gSnare * 0.7,
          });
        } else if (d === 'H') {
          scheduleNoise(c, master, t0, 0.022, gHat, 2400);
        }
      }

      nextTime += stepSec;
      step += 1;
    }
    timer = setTimeout(schedule, TICK_MS);
    if (onNodes) onNodes({ timer });
  };

  const nodes = {
    master,
    pad,
    cancelled: () => { cancelled = true; },
    timer: null,
  };
  if (onNodes) onNodes(nodes);
  schedule();
  return nodes;
}

function fadeStop(nodes, fadeSec = 0.28) {
  if (!nodes) return;
  nodes.cancelled?.();
  if (nodes.timer) clearTimeout(nodes.timer);
  const c = ac();
  try {
    const t = c ? c.currentTime : 0;
    if (nodes.master) {
      nodes.master.gain.cancelScheduledValues(t);
      nodes.master.gain.linearRampToValueAtTime(0.0001, t + fadeSec);
    }
    setTimeout(() => {
      try { nodes.pad?.stop(); } catch (_) { /* */ }
      try { nodes.pad?.disconnect(); } catch (_) { /* */ }
      try { nodes.master?.disconnect(); } catch (_) { /* */ }
    }, fadeSec * 1000 + 50);
  } catch (_) { /* */ }
}

/* ─── Castlevania-inspired battle theme (original) ─────────────────
 * D harmonic minor, driving 16ths, sweeping lead, dark arps.
 * Feel: Vampire Killer / Bloody Tears energy — not a note-for-note copy.
 */
const BATTLE_BPM = 168;
const BATTLE_LEN = 64; // 4 bars

// Bass: galloping root motion D–C–Bb–A with chromatic stabs
const BATTLE_BASS = [
  // bar 1 — D
  38, 0, 38, 38, 38, 0, 41, 0, 38, 0, 38, 0, 36, 36, 34, 0,
  // bar 2 — Bb → A
  34, 0, 34, 34, 34, 0, 36, 0, 33, 0, 33, 0, 31, 31, 33, 0,
  // bar 3 — D rising
  38, 0, 38, 38, 41, 0, 43, 0, 38, 0, 36, 0, 34, 0, 33, 0,
  // bar 4 — A pedal resolve
  33, 0, 33, 33, 36, 0, 38, 0, 33, 33, 31, 0, 33, 0, 38, 0,
];

// Lead: dramatic minor phrases + harmonic-minor leaps (A→Bb→C#→D)
const BATTLE_LEAD = [
  // bar 1
  62, 0, 65, 69, 0, 70, 69, 0, 65, 0, 62, 0, 58, 60, 62, 0,
  // bar 2
  70, 0, 69, 65, 0, 62, 65, 0, 69, 0, 70, 73, 0, 70, 69, 0,
  // bar 3 — heroic climb
  62, 0, 65, 69, 0, 74, 0, 73, 70, 0, 69, 65, 0, 67, 69, 0,
  // bar 4 — cadence with raised 7th
  70, 0, 69, 65, 0, 61, 62, 0, 65, 0, 61, 0, 58, 0, 62, 0,
];

// Harmony (fifths / dark thirds)
const BATTLE_HARM = [
  50, 0, 0, 53, 0, 0, 50, 0, 50, 0, 0, 48, 0, 0, 46, 0,
  46, 0, 0, 48, 0, 0, 45, 0, 45, 0, 0, 43, 0, 0, 45, 0,
  50, 0, 0, 53, 0, 0, 55, 0, 50, 0, 0, 48, 0, 0, 46, 0,
  45, 0, 0, 48, 0, 0, 50, 0, 45, 0, 0, 43, 0, 0, 50, 0,
];

// Fast rolling arps (D F A C# / Bb D F A / D F A C / A C# E G)
const BATTLE_ARP = [
  62, 65, 69, 73, 62, 65, 69, 74, 62, 65, 69, 73, 62, 65, 70, 69,
  58, 62, 65, 69, 58, 62, 65, 70, 57, 61, 64, 69, 57, 61, 64, 67,
  62, 65, 69, 74, 62, 65, 69, 73, 62, 65, 70, 69, 60, 64, 67, 70,
  57, 61, 64, 69, 57, 61, 65, 67, 57, 61, 64, 62, 57, 58, 61, 62,
];

const BATTLE_DRUMS =
  'K.H.S.H.K.H.S.HH' +
  'K.H.S.H.K.HS.S.H' +
  'K.H.S.H.K.H.S.HH' +
  'K.HS.H.K.HSS.S.H';

/**
 * Battle bed while in a duel. Call setBattleMusic(true/false).
 * When on, ambient BGM ducks out; when off, BGM returns.
 */
export function setBattleMusic(on) {
  wantBattle = Boolean(on);
  if (!musicEnabled) {
    stopBattleMusic();
    stopBackgroundMusic();
    return;
  }
  if (wantBattle) {
    stopBackgroundMusic();
    startBattleMusic();
  } else {
    stopBattleMusic();
    startBackgroundMusic();
  }
}

function startBattleMusic() {
  if (battleOn || !musicEnabled) return;
  battleOn = true;
  battleNodes = startSequencer({
    bpm: BATTLE_BPM,
    len: BATTLE_LEN,
    patterns: {
      bass: BATTLE_BASS,
      lead: BATTLE_LEAD,
      harm: BATTLE_HARM,
      arp: BATTLE_ARP,
      drums: BATTLE_DRUMS,
    },
    masterGain: 0.052,
    padMidi: 26, // D1
    padGain: 0.09,
    isActive: () => battleOn && musicEnabled,
    onNodes: (partial) => {
      if (battleNodes) Object.assign(battleNodes, partial);
      else battleNodes = partial;
    },
    gains: {
      bass: 0.068,
      lead: 0.058,
      leadOct: 0.02,
      harm: 0.03,
      arp: 0.024,
      kick: 0.12,
      snare: 0.042,
      hat: 0.015,
    },
  });
}

function stopBattleMusic() {
  if (!battleOn && !battleNodes) return;
  battleOn = false;
  const nodes = battleNodes;
  battleNodes = null;
  fadeStop(nodes, 0.25);
}

export function isBattleMusicOn() {
  return battleOn;
}

/* ─── Ambient background theme (dungeon / night stroll) ────────────
 * Slower D minor nocturne — constant bed outside of combat.
 */
const BGM_BPM = 96;
const BGM_LEN = 64;

const BGM_BASS = [
  38, 0, 0, 38, 0, 0, 38, 0, 36, 0, 0, 36, 0, 0, 34, 0,
  33, 0, 0, 33, 0, 0, 31, 0, 33, 0, 0, 36, 0, 0, 38, 0,
  38, 0, 0, 38, 0, 0, 41, 0, 38, 0, 0, 36, 0, 0, 34, 0,
  33, 0, 0, 31, 0, 0, 33, 0, 38, 0, 0, 38, 0, 0, 38, 0,
];

const BGM_LEAD = [
  62, 0, 0, 65, 0, 0, 69, 0, 0, 67, 0, 65, 0, 0, 62, 0,
  0, 0, 60, 0, 0, 62, 0, 0, 58, 0, 0, 57, 0, 0, 58, 0,
  62, 0, 0, 65, 0, 69, 0, 0, 70, 0, 0, 69, 0, 65, 0, 0,
  67, 0, 0, 65, 0, 0, 62, 0, 0, 0, 58, 0, 0, 62, 0, 0,
];

const BGM_HARM = [
  50, 0, 0, 0, 53, 0, 0, 0, 48, 0, 0, 0, 46, 0, 0, 0,
  45, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0, 48, 0, 0, 0,
  50, 0, 0, 0, 53, 0, 0, 0, 50, 0, 0, 0, 48, 0, 0, 0,
  45, 0, 0, 0, 43, 0, 0, 0, 50, 0, 0, 0, 50, 0, 0, 0,
];

const BGM_ARP = [
  50, 53, 57, 53, 50, 53, 57, 60, 48, 53, 57, 53, 46, 50, 53, 50,
  45, 48, 52, 48, 43, 48, 52, 55, 45, 48, 52, 48, 48, 52, 55, 57,
  50, 53, 57, 60, 50, 53, 57, 62, 50, 53, 57, 53, 48, 53, 57, 53,
  45, 48, 52, 55, 43, 48, 52, 55, 50, 53, 57, 53, 50, 53, 57, 62,
];

// Soft pulse — sparse kick/hat only
const BGM_DRUMS =
  'K...H...K...H...' +
  'K...H...K.H.H...' +
  'K...H...K...H...' +
  'K...H...K...H.H.';

/** Start looping ambient BGM (no-op if battle wants the speakers). */
export function startBackgroundMusic() {
  if (!musicEnabled || wantBattle || bgmOn) return;
  bgmOn = true;
  bgmNodes = startSequencer({
    bpm: BGM_BPM,
    len: BGM_LEN,
    patterns: {
      bass: BGM_BASS,
      lead: BGM_LEAD,
      harm: BGM_HARM,
      arp: BGM_ARP,
      drums: BGM_DRUMS,
    },
    masterGain: 0.1, // original 0.032
    padMidi: 26,
    padGain: 0.077, // pad tracks master (+10%)
    isActive: () => bgmOn && musicEnabled && !wantBattle,
    onNodes: (partial) => {
      if (bgmNodes) Object.assign(bgmNodes, partial);
      else bgmNodes = partial;
    },
    gains: {
      bass: 0.045,
      lead: 0.038,
      leadOct: 0.01,
      harm: 0.022,
      arp: 0.014,
      kick: 0.06,
      snare: 0.0,
      hat: 0.01,
    },
  });
}

export function stopBackgroundMusic() {
  if (!bgmOn && !bgmNodes) return;
  bgmOn = false;
  const nodes = bgmNodes;
  bgmNodes = null;
  fadeStop(nodes, 0.35);
}

export function isBackgroundMusicOn() {
  return bgmOn;
}
