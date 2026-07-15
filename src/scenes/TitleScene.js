import { COLORS, LOGICAL_W, LOGICAL_H, GAME_TITLE } from '../config.js';
import { drawWallTile, drawFigure } from '../render/draw.js';
import { fetchLeaderboard, formatElapsed } from '../systems/leaderboard.js';

export function createTitleScene(api) {
  let error = '';
  let tick = 0;
  let boardLines = [];

  async function loadBoard() {
    const board = await fetchLeaderboard(5);
    boardLines = (board.entries || []).slice(0, 5).map((e, i) => {
      const name = (e.name || '?').slice(0, 8).padEnd(8, ' ');
      return `${i + 1}. ${name} ${formatElapsed(e.elapsedSec)}`;
    });
  }

  return {
    name: 'title',
    enter(data) {
      error = data?.error ?? '';
      tick = 0;
      loadBoard();
    },
    update(dt, input) {
      tick++;
      if (input.justPressed('confirm') || input.justPressed('strike')) {
        api.startGame();
      }
    },
    render(ctx) {
      ctx.fillStyle = COLORS.skyDeep;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      for (let ty = 0; ty < 6; ty++) {
        for (let tx = 0; tx < 10; tx++) {
          if (ty === 0 || ty === 5 || tx === 0 || tx === 9) {
            drawWallTile(ctx, tx, ty, 32);
          }
        }
      }
      ctx.fillStyle = 'rgba(8,10,14,0.55)';
      ctx.fillRect(32, 28, 256, 140);

      drawFigure(ctx, { x: 90, y: 160, w: 18, h: 40, facing: 1 }, 'player', 'Idle', {
        tick, swordDrawn: true,
      });
      drawFigure(ctx, { x: 200, y: 160, w: 20, h: 40, facing: -1 }, 'enemy', 'FightIdle', {
        tick,
      });

      ctx.fillStyle = COLORS.exit;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(GAME_TITLE.toUpperCase(), LOGICAL_W / 2, 44);

      ctx.fillStyle = COLORS.hudText;
      ctx.font = '8px monospace';
      ctx.fillText('12 STAGES  ·  7 MINUTES  ·  ORIGINAL', LOGICAL_W / 2, 58);

      ctx.fillStyle = COLORS.hudDim;
      ctx.font = '6px monospace';
      ctx.fillText('Castle → Neon → Ship → Mars  ·  free the princess', LOGICAL_W / 2, 70);
      ctx.fillText('Castlevania · Metroidvania · Prince of Persia · classics', LOGICAL_W / 2, 80);

      if (tick % 60 < 40) {
        ctx.fillStyle = '#f0e0b0';
        ctx.font = '9px monospace';
        ctx.fillText('PRESS ENTER TO BEGIN', LOGICAL_W / 2, 96);
      }

      // Leaderboard box
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(48, 104, 224, 54);
      ctx.fillStyle = '#c9a227';
      ctx.font = '7px monospace';
      ctx.fillText('LEADERBOARD — fastest full clears', LOGICAL_W / 2, 116);
      ctx.fillStyle = '#8a7a60';
      ctx.font = '6px monospace';
      if (!boardLines.length) {
        ctx.fillText('No ranked runs yet — finish without cheats', LOGICAL_W / 2, 130);
      } else {
        boardLines.forEach((line, i) => {
          ctx.fillText(line, LOGICAL_W / 2, 128 + i * 8);
        });
      }

      ctx.fillStyle = '#5a5040';
      ctx.font = '6px monospace';
      ctx.fillText('Cheats (+ life / goN) void ranking  ·  full run only', LOGICAL_W / 2, 166);
      ctx.fillText('cheat: go1–go12 · goera / goship / gomars · + life', LOGICAL_W / 2, 176);
      ctx.fillStyle = '#6a6048';
      ctx.fillText('github.com/LuisSanchez/grok-prince', LOGICAL_W / 2, 186);

      if (error) {
        ctx.fillStyle = COLORS.blood;
        ctx.fillText(error.slice(0, 46), LOGICAL_W / 2, 196);
      }
      ctx.textAlign = 'left';
    },
  };
}
