import { COLORS, LOGICAL_W, LOGICAL_H } from '../config.js';
import { drawWallTile } from '../render/draw.js';
import { sfxDeath, unlockAudio } from '../audio/sfx.js';

export function createGameOverScene(api) {
  let reason = 'TIME UP';
  let tick = 0;
  return {
    enter(data) {
      reason = data?.reason ?? 'TIME UP';
      tick = 0;
      unlockAudio();
      sfxDeath();
    },
    update(dt, input) {
      tick++;
      if (input.justPressed('confirm') || input.justPressed('strike')) {
        api.showTitle();
      }
    },
    render(ctx) {
      ctx.fillStyle = '#100808';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      for (let tx = 0; tx < 10; tx++) {
        drawWallTile(ctx, tx, 0, 32);
        drawWallTile(ctx, tx, 5, 32);
      }
      ctx.fillStyle = COLORS.blood;
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(reason, LOGICAL_W / 2, 78);
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '8px monospace';
      ctx.fillText('The hourglass is empty.', LOGICAL_W / 2, 108);
      ctx.fillText('The princess remains captive.', LOGICAL_W / 2, 122);
      if (tick % 50 < 35) {
        ctx.fillStyle = COLORS.exit;
        ctx.fillText('PRESS ENTER', LOGICAL_W / 2, 155);
      }
      ctx.textAlign = 'left';
    },
  };
}
