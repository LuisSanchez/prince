/**
 * Typed cheat codes for development / QA.
 *
 *   go1 … go12  — jump to that stage (sword + full hearts if stage 2+)
 *   goera       — castle→modern time-warp, then stage 5
 *   goship      — city→starship warp, then stage 9
 *   gomars      — ship crash to Mars cutscene, then stage 11
 *
 * Separate key (not typed buffer): during play, press + (or = / numpad +)
 * to gain 1 heart, up to 5 total.
 *
 * Codes are case-insensitive. Buffer resets after 1.5s idle or on match.
 * Prefix codes (go1 vs go10/go11/go12) wait briefly so longer codes can complete.
 */

/**
 * @param {(code: string) => void} onCode
 * @returns {{ dispose: () => void }}
 */
export function installCheatListener(onCode) {
  let buf = '';
  let idleTimer = null;
  let commitTimer = null;

  const CODES = [
    'goship', 'gomars', 'goera',
    'go10', 'go11', 'go12',
    'go1', 'go2', 'go3', 'go4', 'go5', 'go6', 'go7', 'go8', 'go9',
  ];

  function clearTimers() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (commitTimer) {
      clearTimeout(commitTimer);
      commitTimer = null;
    }
  }

  function reset() {
    buf = '';
    clearTimers();
  }

  function longestMatch() {
    let best = null;
    for (const code of CODES) {
      if (buf.endsWith(code) && (!best || code.length > best.length)) {
        best = code;
      }
    }
    return best;
  }

  /** True if some longer registered code has this match as a prefix (e.g. go1 ⊂ go10). */
  function isPrefixOfLonger(code) {
    return CODES.some((c) => c.length > code.length && c.startsWith(code));
  }

  function fire(code) {
    reset();
    onCode(code);
  }

  function scheduleCommit() {
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      commitTimer = null;
      const m = longestMatch();
      if (m) fire(m);
    }, 280);
  }

  function onKey(e) {
    if (e.metaKey || e.altKey) return;
    if (e.key.length !== 1) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    const ch = e.key.toLowerCase();
    if (!/[a-z0-9]/.test(ch)) return;

    buf += ch;
    if (buf.length > 12) buf = buf.slice(-12);

    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(reset, 1500);

    const best = longestMatch();
    if (!best) return;

    e.preventDefault();
    if (isPrefixOfLonger(best)) {
      scheduleCommit();
    } else {
      if (commitTimer) clearTimeout(commitTimer);
      fire(best);
    }
  }

  window.addEventListener('keydown', onKey);
  return {
    dispose() {
      window.removeEventListener('keydown', onKey);
      reset();
    },
  };
}
