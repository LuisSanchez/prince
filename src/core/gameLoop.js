import { FIXED_DT, MAX_STEPS } from '../config.js';

/**
 * Fixed-timestep game loop. Snap render (no interpolation in MVP).
 * @param {{
 *   update: (dt: number) => void,
 *   render: () => void,
 *   isPaused?: () => boolean
 * }} hooks
 */
export function createGameLoop(hooks) {
  let acc = 0;
  let last = performance.now() / 1000;
  let raf = 0;
  let running = false;

  function frame(nowMs) {
    if (!running) return;
    const now = nowMs / 1000;
    let frameDt = now - last;
    last = now;
    if (frameDt > 0.25) frameDt = 0.25;

    if (!hooks.isPaused?.()) {
      acc += frameDt;
      let steps = 0;
      while (acc >= FIXED_DT && steps < MAX_STEPS) {
        hooks.update(FIXED_DT);
        acc -= FIXED_DT;
        steps++;
      }
      if (steps === MAX_STEPS) acc = 0;
    }

    hooks.render();
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now() / 1000;
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
