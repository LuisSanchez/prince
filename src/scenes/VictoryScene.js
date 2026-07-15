import { COLORS, LOGICAL_W, LOGICAL_H, GAME_TITLE } from '../config.js';
import { drawWallTile, drawFigure } from '../render/draw.js';
import { createConfetti, updateConfetti, drawConfetti } from '../render/confetti.js';
import { sfxVictory, unlockAudio } from '../audio/sfx.js';
import {
  isLeaderboardEligible,
  elapsedSecFromSession,
  formatElapsed,
  submitLeaderboardScore,
  fetchLeaderboard,
} from '../systems/leaderboard.js';

export function createVictoryScene(api) {
  let timeLeft = 0;
  let tick = 0;
  let confetti = [];
  let session = null;
  let eligible = false;
  let elapsed = 0;
  let submitted = false;
  let submitError = '';
  let boardLines = [];
  let rankNote = '';

  async function refreshBoard() {
    const board = await fetchLeaderboard(8);
    boardLines = (board.entries || []).map((e, i) => {
      const t = formatElapsed(e.elapsedSec);
      return `${String(i + 1).padStart(2, ' ')}. ${(e.name || '?').slice(0, 10).padEnd(10, ' ')}  ${t}`;
    });
  }

  function showNameForm() {
    const panel = document.getElementById('lb-panel');
    const form = document.getElementById('lb-form');
    const status = document.getElementById('lb-status');
    const input = document.getElementById('lb-name');
    if (!panel) return;
    panel.hidden = false;
    if (form) form.hidden = !eligible || submitted;
    if (status) {
      if (!eligible) {
        status.textContent = session?.cheated
          ? 'Cheats used — this run is not ranked. Full clean runs only.'
          : 'Not eligible for the leaderboard.';
      } else if (submitted) {
        status.textContent = rankNote || 'Score submitted!';
      } else {
        status.textContent = `Clean run · clear time ${formatElapsed(elapsed)}. Name your prince:`;
      }
    }
    if (input && eligible && !submitted) {
      input.value = '';
      setTimeout(() => input.focus(), 50);
    }
  }

  function hideNameForm() {
    const panel = document.getElementById('lb-panel');
    if (panel) panel.hidden = true;
  }

  async function onSubmit(ev) {
    ev?.preventDefault?.();
    if (!eligible || submitted || !session) return;
    const input = document.getElementById('lb-name');
    const name = (input?.value || 'PRINCE').trim();
    const btn = document.getElementById('lb-submit');
    if (btn) btn.disabled = true;
    const result = await submitLeaderboardScore({ name, session, stages: 12 });
    if (result.ok) {
      submitted = true;
      rankNote = `Recorded as ${result.entry?.name} · ${formatElapsed(result.entry?.elapsedSec ?? elapsed)}`;
      await refreshBoard();
      showNameForm();
    } else {
      submitError = result.error || 'Submit failed';
      const status = document.getElementById('lb-status');
      if (status) status.textContent = submitError;
      if (btn) btn.disabled = false;
    }
  }

  function wireForm() {
    const form = document.getElementById('lb-form');
    if (!form || form.dataset.wired) return;
    form.dataset.wired = '1';
    form.addEventListener('submit', onSubmit);
  }

  return {
    enter(data) {
      session = data?.session ?? null;
      timeLeft = data?.timeLeftSec ?? session?.timeLeftSec ?? 0;
      tick = 0;
      confetti = createConfetti(72);
      eligible = isLeaderboardEligible(session);
      elapsed = elapsedSecFromSession(session || { timeLeftSec: timeLeft });
      submitted = false;
      submitError = '';
      rankNote = '';
      boardLines = [];
      unlockAudio();
      sfxVictory();
      wireForm();
      refreshBoard().then(showNameForm);
      showNameForm();
    },
    exit() {
      hideNameForm();
    },
    update(dt, input) {
      tick++;
      updateConfetti(confetti);
      // Don't steal Enter while typing a name
      const typing = document.activeElement?.id === 'lb-name';
      if (!typing && (input.justPressed('confirm') || input.justPressed('strike'))) {
        hideNameForm();
        api.showTitle();
      }
    },
    render(ctx) {
      for (let i = 0; i < 12; i++) {
        const u = i / 12;
        ctx.fillStyle = `rgb(${Math.floor(30 + u * 50)},${Math.floor(14 + u * 18)},${Math.floor(20 + u * 12)})`;
        ctx.fillRect(0, Math.floor(u * LOGICAL_H), LOGICAL_W, Math.ceil(LOGICAL_H / 12) + 1);
      }
      for (let tx = 0; tx < 10; tx++) {
        drawWallTile(ctx, tx, 0, 32, 'mars');
        drawWallTile(ctx, tx, 5, 32, 'mars');
      }

      drawFigure(ctx, { x: 110, y: 160, w: 18, h: 40, facing: 1 }, 'player', 'Idle', {
        tick, swordDrawn: true,
      });
      drawPrincess(ctx, 165, 160, tick);
      drawConfetti(ctx, confetti);

      ctx.fillStyle = COLORS.exit;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('THE PRINCESS IS FREE', LOGICAL_W / 2, 36);

      ctx.fillStyle = COLORS.hudText;
      ctx.font = '7px monospace';
      ctx.fillText(GAME_TITLE, LOGICAL_W / 2, 50);

      const m = Math.floor(timeLeft / 60);
      const s = Math.ceil(timeLeft % 60);
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText(
        `Clear ${formatElapsed(elapsed)} · sand left ${m}:${s.toString().padStart(2, '0')}`,
        LOGICAL_W / 2,
        64,
      );

      if (eligible) {
        ctx.fillStyle = '#50c878';
        ctx.fillText(submitted ? 'RANKED RUN' : 'LEADERBOARD ELIGIBLE', LOGICAL_W / 2, 76);
      } else {
        ctx.fillStyle = '#c06040';
        ctx.fillText('CHEATS USED — NOT RANKED', LOGICAL_W / 2, 76);
      }

      // Mini board on canvas
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(200, 84, 112, 70);
      ctx.fillStyle = '#c9a227';
      ctx.font = '6px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('TOP CLEARS', 206, 94);
      ctx.fillStyle = '#a89878';
      const lines = boardLines.slice(0, 5);
      if (!lines.length) {
        ctx.fillText('No scores yet', 206, 108);
      } else {
        lines.forEach((line, i) => {
          ctx.fillText(line.slice(0, 18), 206, 108 + i * 9);
        });
      }

      ctx.textAlign = 'center';
      if (tick % 50 < 35) {
        ctx.fillStyle = COLORS.exit;
        ctx.font = '8px monospace';
        ctx.fillText('ENTER — TITLE', LOGICAL_W / 2, 188);
      }
      ctx.textAlign = 'left';
    },
  };
}

function drawPrincess(ctx, feetX, feetY, tick) {
  const x = Math.round(feetX - 8);
  const y = Math.round(feetY - 38);
  const bob = Math.floor(tick / 20) % 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x + 1, feetY - 2, 14, 3);
  ctx.fillStyle = '#c06090';
  ctx.fillRect(x + 2, y + 16 + bob, 12, 20);
  ctx.fillStyle = '#e080b0';
  ctx.fillRect(x + 3, y + 18 + bob, 10, 3);
  ctx.fillStyle = '#a04070';
  ctx.fillRect(x + 3, y + 12 + bob, 10, 6);
  ctx.fillStyle = COLORS.skin;
  ctx.fillRect(x, y + 14 + bob, 3, 8);
  ctx.fillRect(x + 13, y + 14 + bob, 3, 8);
  ctx.fillStyle = COLORS.skin;
  ctx.fillRect(x + 3, y + 4 + bob, 10, 9);
  ctx.fillStyle = '#e8d060';
  ctx.fillRect(x + 2, y + 2 + bob, 12, 4);
  ctx.fillRect(x + 1, y + 5 + bob, 3, 8);
  ctx.fillRect(x + 12, y + 5 + bob, 3, 8);
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(x + 4, y + bob, 8, 3);
  ctx.fillStyle = '#fff0a0';
  ctx.fillRect(x + 7, y - 1 + bob, 2, 2);
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(x + 9, y + 7 + bob, 2, 2);
}
