import { createGameLoop } from './core/gameLoop.js';
import { createInput } from './core/input.js';
import { createSceneManager } from './core/sceneManager.js';
import { createRenderer } from './render/Renderer.js';
import { createTitleScene } from './scenes/TitleScene.js';
import { createPlayScene } from './scenes/PlayScene.js';
import { createGameOverScene } from './scenes/GameOverScene.js';
import { createLevelClearScene } from './scenes/LevelClearScene.js';
import { createVictoryScene } from './scenes/VictoryScene.js';
import { createTransitionScene } from './scenes/TransitionScene.js';
import { createEraCutscene } from './scenes/EraCutscene.js';
import { createShipCutscene } from './scenes/ShipCutscene.js';
import { createMarsCutscene } from './scenes/MarsCutscene.js';
import { loadManifest, nextLevelId, firstLevelId } from './level/campaign.js';
import { refillHealthForNewStage, newGameSession, markCheated } from './systems/session.js';
import { GAME_TITLE, START_TIME_SEC, START_HEALTH } from './config.js';
import {
  unlockAudio, setBattleMusic, sfxDoor, startBackgroundMusic,
  toggleMusic, toggleSfx, isMusicEnabled, isSfxEnabled,
} from './audio/sfx.js';
import { installCheatListener } from './core/cheats.js';

document.title = GAME_TITLE;

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput();
const scenes = createSceneManager();

function syncAudioButtons() {
  const musicBtn = document.getElementById('btn-music');
  const sfxBtn = document.getElementById('btn-sfx');
  if (musicBtn) {
    const on = isMusicEnabled();
    musicBtn.textContent = on ? 'Music: On' : 'Music: Off';
    musicBtn.classList.toggle('on', on);
    musicBtn.classList.toggle('off', !on);
    musicBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  if (sfxBtn) {
    const on = isSfxEnabled();
    sfxBtn.textContent = on ? 'FX: On' : 'FX: Off';
    sfxBtn.classList.toggle('on', on);
    sfxBtn.classList.toggle('off', !on);
    sfxBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
}

document.getElementById('btn-music')?.addEventListener('click', (e) => {
  unlockAudio();
  toggleMusic();
  syncAudioButtons();
  e.currentTarget.blur(); // keep Space free for sword strikes
});
document.getElementById('btn-sfx')?.addEventListener('click', (e) => {
  unlockAudio();
  toggleSfx();
  syncAudioButtons();
  e.currentTarget.blur();
});
syncAudioButtons();

const api = {
  showTitle(error) {
    scenes.set('title', titleScene, error ? { error } : undefined);
  },
  startGame() {
    unlockAudio();
    startBackgroundMusic();
    // Clean full run from title — leaderboard eligible until any cheat
    const session = newGameSession();
    session.fullRun = true;
    session.cheated = false;
    scenes.set('play', playScene, { session });
  },
  gameOver(reason) {
    setBattleMusic(false);
    scenes.set('gameover', gameOverScene, { reason });
  },
  levelClear(data) {
    setBattleMusic(false);
    scenes.set('clear', levelClearScene, data);
  },
  async continueCampaign(session) {
    try {
      const man = await loadManifest();
      // session.levelId is still the completed stage
      const completedId = session.levelId;
      const next = nextLevelId(man, completedId);
      if (!next) {
        api.victory(session);
        return;
      }
      setBattleMusic(false);
      const fromEntry = man.levels.find((l) => l.id === completedId);
      const toEntry = man.levels.find((l) => l.id === next);
      session._pendingNext = next;
      // Plot twist: 8-bit time warp into the modern era before stage 5
      if (completedId === 'level04' && next === 'level05') {
        scenes.set('era', eraCutscene, { session });
      } else if (completedId === 'level08' && next === 'level09') {
        // Second warp: neon city → future starship
        scenes.set('shipera', shipCutscene, { session });
      } else if (completedId === 'level10' && next === 'level11') {
        // Ship falls to Mars
        scenes.set('marsera', marsCutscene, { session });
      } else {
        scenes.set('transition', transitionScene, {
          session,
          fromName: fromEntry?.name ?? completedId,
          toName: toEntry?.name ?? next,
          toNum: toEntry?.index ?? 2,
          total: man.levels.length,
        });
      }
    } catch (e) {
      api.showTitle(e.message);
    }
  },
  finishTransition(session) {
    const next = session._pendingNext;
    if (!next) {
      api.showTitle('Transition failed');
      return;
    }
    session.levelId = next;
    delete session._pendingNext;
    refillHealthForNewStage(session);
    unlockAudio();
    startBackgroundMusic();
    sfxDoor();
    scenes.set('play', playScene, { session });
  },
  victory(session) {
    session.won = true;
    setBattleMusic(false);
    scenes.set('victory', victoryScene, {
      timeLeftSec: session.timeLeftSec,
      session,
    });
  },
};

const titleScene = createTitleScene(api);
const playScene = createPlayScene(api);
const gameOverScene = createGameOverScene(api);
const levelClearScene = createLevelClearScene(api);
const victoryScene = createVictoryScene(api);
const transitionScene = createTransitionScene(api);
const eraCutscene = createEraCutscene(api);
const shipCutscene = createShipCutscene(api);
const marsCutscene = createMarsCutscene(api);


/** Debug: jump to stage 1–12. Stage 2+ starts with sword. */
async function startAtStage(stageNum, { playEra = false, playShip = false, playMars = false } = {}) {
  try {
    unlockAudio();
    setBattleMusic(false);
    startBackgroundMusic();
    const man = await loadManifest();
    const entry = man.levels.find((l) => l.index === stageNum);
    if (!entry && !playEra && !playShip && !playMars) {
      console.warn('No stage', stageNum);
      return;
    }
    const session = newGameSession();
    session.timeLeftSec = START_TIME_SEC;
    session.health = START_HEALTH;
    session.maxHealth = START_HEALTH;
    session.hasSword = stageNum >= 2 || playEra || playShip || playMars;
    // Stage-skip / cutscene cheats void leaderboard
    markCheated(session, playEra ? 'goera' : playShip ? 'goship' : playMars ? 'gomars' : `go${stageNum}`);
    session.message = `CHEAT → STAGE ${stageNum} · NO RANK`;
    session.messageTicks = 90;
    const tag = playEra ? ' (era warp)' : playShip ? ' (ship warp)' : playMars ? ' (mars crash)' : '';
    console.info(`[cheat] jump to stage ${stageNum}${tag} (${entry?.name ?? '?'}) — not leaderboard eligible`);

    if (playEra) {
      session.levelId = 'level04';
      session._pendingNext = 'level05';
      session.hasSword = true;
      scenes.set('era', eraCutscene, { session });
      return;
    }
    if (playShip) {
      session.levelId = 'level08';
      session._pendingNext = 'level09';
      session.hasSword = true;
      scenes.set('shipera', shipCutscene, { session });
      return;
    }
    if (playMars) {
      session.levelId = 'level10';
      session._pendingNext = 'level11';
      session.hasSword = true;
      scenes.set('marsera', marsCutscene, { session });
      return;
    }

    session.levelId = entry.id;
    scenes.set('play', playScene, { session });
  } catch (e) {
    console.error(e);
    api.showTitle(String(e.message || e));
  }
}

installCheatListener((code) => {
  if (code === 'goera') {
    startAtStage(5, { playEra: true });
    return;
  }
  if (code === 'goship') {
    startAtStage(9, { playShip: true });
    return;
  }
  if (code === 'gomars') {
    startAtStage(11, { playMars: true });
    return;
  }
  const n = Number(code.replace('go', ''));
  if (n >= 1 && n <= 12) startAtStage(n);
});

scenes.set('title', titleScene);

const loop = createGameLoop({
  update(dt) {
    input.beginFrame();
    scenes.update(dt, input);
    input.endFrame();
  },
  render() {
    scenes.render(renderer.ctx, renderer);
  },
  isPaused: () => false,
});

loop.start();

console.info(`${GAME_TITLE} — 12-stage campaign. Cheats: go1…go12, goera, goship, gomars. ?debug=1`);
