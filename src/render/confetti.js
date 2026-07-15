/**
 * Simple pixel confetti for stage clear / victory.
 */

const COLORS = ['#c9a227', '#e8d4a8', '#c02828', '#40a060', '#80c0ff', '#fff0c0', '#d08040'];

export function createConfetti(count = 48) {
  const bits = [];
  for (let i = 0; i < count; i++) {
    bits.push({
      x: Math.random() * 320,
      y: -8 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 1.8,
      vy: 0.6 + Math.random() * 1.4,
      w: 2 + Math.floor(Math.random() * 3),
      h: 2 + Math.floor(Math.random() * 3),
      color: COLORS[i % COLORS.length],
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.2,
    });
  }
  return bits;
}

export function updateConfetti(bits) {
  for (const b of bits) {
    b.x += b.vx;
    b.y += b.vy;
    b.vy += 0.04;
    b.rot += b.spin;
    if (b.y > 210) {
      b.y = -6;
      b.x = Math.random() * 320;
      b.vy = 0.6 + Math.random() * 1.2;
    }
  }
}

export function drawConfetti(ctx, bits) {
  for (const b of bits) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.fillStyle = b.color;
    ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
  }
}
