/**
 * timer.js
 * Small countdown-timer utility used by Exam Prep mode.
 */

let intervalId = null;
let remainingSeconds = 0;
let running = false;
let onTickCallback = null;
let onExpireCallback = null;

/**
 * @param {number} totalSeconds
 * @returns {{ minutes: number, seconds: number, totalSeconds: number, formatted: string, running: boolean }}
 */
function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return {
    minutes,
    seconds,
    totalSeconds: safeSeconds,
    formatted: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    running
  };
}

function emitTick() {
  if (typeof onTickCallback === 'function') {
    onTickCallback(getTimerState());
  }
}

function clearTimerInterval() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function tick() {
  if (!running) {
    return;
  }

  remainingSeconds -= 1;

  if (remainingSeconds <= 0) {
    remainingSeconds = 0;
    running = false;
    clearTimerInterval();
    emitTick();

    if (typeof onExpireCallback === 'function') {
      onExpireCallback(getTimerState());
    }
    return;
  }

  emitTick();
}

/**
 * Starts a timer from a minute value. Fractional minutes are allowed to
 * keep the test suite lightweight.
 *
 * @param {number} minutes
 * @param {(state: ReturnType<typeof getTimerState>) => void} onTick
 * @param {(state: ReturnType<typeof getTimerState>) => void} onExpire
 */
export function startTimer(minutes, onTick, onExpire) {
  const totalSeconds = Math.max(0, Math.round(Number(minutes || 0) * 60));
  return restoreTimer(totalSeconds, onTick, onExpire, false);
}

/**
 * Restores a timer from saved state.
 *
 * @param {number} totalSeconds
 * @param {(state: ReturnType<typeof getTimerState>) => void} onTick
 * @param {(state: ReturnType<typeof getTimerState>) => void} onExpire
 * @param {boolean} paused
 * @returns {ReturnType<typeof getTimerState>}
 */
export function restoreTimer(totalSeconds, onTick, onExpire, paused = false) {
  stopTimer();
  remainingSeconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  onTickCallback = onTick || null;
  onExpireCallback = onExpire || null;
  running = !paused && remainingSeconds > 0;

  emitTick();

  if (running) {
    intervalId = setInterval(tick, 1000);
  }

  return getTimerState();
}

export function pauseTimer() {
  if (!running) {
    return getTimerState();
  }

  running = false;
  clearTimerInterval();
  emitTick();
  return getTimerState();
}

export function resumeTimer() {
  if (running || remainingSeconds <= 0) {
    return getTimerState();
  }

  running = true;
  clearTimerInterval();
  intervalId = setInterval(tick, 1000);
  emitTick();
  return getTimerState();
}

/**
 * Adds additional time to the countdown.
 *
 * @param {number} minutes
 * @returns {ReturnType<typeof getTimerState>}
 */
export function extendTimer(minutes = 5) {
  remainingSeconds += Math.max(0, Math.round(Number(minutes || 0) * 60));
  emitTick();
  return getTimerState();
}

export function getTimerState() {
  const state = formatTime(remainingSeconds);
  state.running = running;
  state.paused = !running && remainingSeconds > 0;
  return state;
}

export function isTimerRunning() {
  return running;
}

export function stopTimer() {
  running = false;
  clearTimerInterval();
  remainingSeconds = 0;
  onTickCallback = null;
  onExpireCallback = null;
  return getTimerState();
}
