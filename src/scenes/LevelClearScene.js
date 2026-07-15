import { COLORS, LOGICAL_W, LOGICAL_H, GAME_TITLE } from '../config.js';
import { drawWallTile, drawFigure } from '../render/draw.js';
import { createConfetti, updateConfetti, drawConfetti } from '../render/confetti.js';
import { sfxStageClear, unlockAudio } from '../audio/sfx.js';

export function createLevelClearScene(api) {
  let timeLeft = 0;
  let tick = 0;
  let levelName = '';
  let levelNum = 1;
  let total = 4;
  let hasNext = true;
  let session = null;
  let confetti = [];

  return {
    enter(data) {
      timeLeft = data?.timeLeftSec ?? 0;
      levelName = data?.levelName ?? 'Stage';
      levelNum = data?.levelNum ?? 1;
      total = data?.total ?? 4;
      hasNext = data?.hasNext !== false;
      session = data?.session ?? null;
      tick = 0;
      confetti = createConfetti(56);
      unlockAudio();
      sfxStageClear();
    },
    update(dt, input) {
      tick++;
      updateConfetti(confetti);
      if (input.justPressed('confirm') || input.justPressed('strike')) {
        unlockAudio();
        if (hasNext && session) {
          api.continueCampaign(session);
        } else if (!hasNext && session) {
          api.victory(session);
        } else {
          api.showTitle();
        }
      }
    },
    render(ctx) {
      ctx.fillStyle = COLORS.skyDeep;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      for (let tx = 0; tx < 10; tx++) {
        drawWallTile(ctx, tx, 5, 32);
      }
      drawFigure(ctx, { x: 160, y: 160, w: 18, h: 40, facing: 1 }, 'player', 'Idle', {
        tick, swordDrawn: true,
      });
      drawConfetti(ctx, confetti);

      ctx.fillStyle = COLORS.exit;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`STAGE ${levelNum} CLEAR`, LOGICAL_W / 2, 36);

      ctx.fillStyle = COLORS.hudText;
      ctx.font = '8px monospace';
      ctx.fillText(levelName, LOGICAL_W / 2, 54);
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText(GAME_TITLE, LOGICAL_W / 2, 68);

      const m = Math.floor(timeLeft / 60);
      const s = Math.ceil(timeLeft % 60);
      ctx.fillText(`Time remaining  ${m}:${s.toString().padStart(2, '0')}`, LOGICAL_W / 2, 92);
      ctx.fillText(`Progress  ${levelNum} / ${total}`, LOGICAL_W / 2, 106);

      if (hasNext) {
        ctx.fillStyle = COLORS.hudText;
        ctx.fillText('The castle rises higher…', LOGICAL_W / 2, 128);
        if (tick % 50 < 35) {
          ctx.fillStyle = COLORS.exit;
          ctx.fillText('PRESS ENTER — NEXT STAGE', LOGICAL_W / 2, 152);
        }
      } else if (tick % 50 < 35) {
        ctx.fillStyle = COLORS.exit;
        ctx.fillText('PRESS ENTER', LOGICAL_W / 2, 152);
      }
      ctx.textAlign = 'left';
    },
  };
}
