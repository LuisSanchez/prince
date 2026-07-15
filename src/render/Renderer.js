import {
  LOGICAL_W, LOGICAL_H, HUD_H, PLAYFIELD_H, COLORS,
} from '../config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  function resize() {
    const scale = Math.max(1, Math.floor(Math.min(
      (window.innerWidth - 32) / LOGICAL_W,
      (window.innerHeight - 120) / LOGICAL_H,
    )));
    canvas.style.width = `${LOGICAL_W * scale}px`;
    canvas.style.height = `${LOGICAL_H * scale}px`;
  }

  window.addEventListener('resize', resize);
  resize();

  return {
    ctx,
    resize,
    clear() {
      ctx.fillStyle = COLORS.hudBg;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.fillStyle = COLORS.sky;
      ctx.fillRect(0, HUD_H, LOGICAL_W, PLAYFIELD_H);
    },
    /** Playfield drawing: y=0 is top of playfield (below HUD) */
    withPlayfield(fn) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, HUD_H, LOGICAL_W, PLAYFIELD_H);
      ctx.clip();
      ctx.translate(0, HUD_H);
      fn(ctx);
      ctx.restore();
    },
    fillText(text, x, y, color = COLORS.hudText, size = 8) {
      ctx.fillStyle = color;
      ctx.font = `${size}px monospace`;
      ctx.textBaseline = 'top';
      ctx.fillText(text, x, y);
    },
  };
}
