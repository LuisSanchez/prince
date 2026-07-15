/**
 * Keyboard input with edge latching for the entire sim frame.
 * Call beginFrame() once per rAF before sim steps; endFrame() after.
 */
const KEY_TO_ACTION = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
  ' ': 'strike',
  Space: 'strike',
  Spacebar: 'strike',
  // Alternates — Space can be swallowed by browser focus quirks
  z: 'strike',
  Z: 'strike',
  x: 'strike',
  X: 'strike',
  Control: 'strike',
  ControlLeft: 'strike',
  ControlRight: 'strike',
  Enter: 'confirm',
  p: 'pause',
  P: 'pause',
  r: 'restart',
  R: 'restart',
  Escape: 'pause',
  // Cheat: + heart (also = / numpad +)
  '+': 'cheatLife',
  '=': 'cheatLife',
  NumpadAdd: 'cheatLife',
};

export function createInput() {
  const down = new Set();
  const pressed = new Set();
  const released = new Set();
  /** Edges latched for current sim frame batch */
  let framePressed = new Set();
  let frameReleased = new Set();

  function resolveAction(e) {
    let action = KEY_TO_ACTION[e.key] ?? KEY_TO_ACTION[e.code];
    if (!action && (e.code === 'Space' || e.key === ' ')) action = 'strike';
    // Numpad + sometimes reports key differently
    if (!action && (e.code === 'NumpadAdd' || e.key === 'Add')) action = 'cheatLife';
    return action;
  }

  function onKeyDown(e) {
    const action = resolveAction(e);
    if (!action) return;
    if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Space', '+', '='].includes(e.key)
      || e.key === ' '
      || e.code === 'NumpadAdd'
    ) {
      e.preventDefault();
    }
    if (!down.has(action)) {
      pressed.add(action);
    }
    down.add(action);
  }

  function onKeyUp(e) {
    const action = resolveAction(e);
    if (!action) return;
    down.delete(action);
    released.add(action);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    beginFrame() {
      framePressed = new Set(pressed);
      frameReleased = new Set(released);
      pressed.clear();
      released.clear();
    },
    endFrame() {
      // edges already consumed for this frame's sim iterations
    },
    isDown(action) {
      return down.has(action);
    },
    justPressed(action) {
      return framePressed.has(action);
    },
    justReleased(action) {
      return frameReleased.has(action);
    },
    /** Horizontal intent: -1, 0, 1 */
    axisX() {
      const l = down.has('left');
      const r = down.has('right');
      if (l && !r) return -1;
      if (r && !l) return 1;
      return 0;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
