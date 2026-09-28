// Time is supplied by the caller so these functions can be tested without waiting.
export function initialTimer() {
  return { elapsedMs: 0, stretchMs: 0, runningSince: null };
}

export function timerAt(timer, now) {
  if (timer.runningSince === null) return { ...timer };
  // A backwards clock change must not subtract time or count it twice.
  const anchor = Math.max(timer.runningSince, now);
  const delta = anchor - timer.runningSince;
  return {
    elapsedMs: timer.elapsedMs + delta,
    stretchMs: timer.stretchMs + delta,
    runningSince: anchor,
  };
}

export function resumeTimer(timer, now) {
  if (timer.runningSince !== null) return timer;
  return { ...timer, stretchMs: 0, runningSince: now };
}

export function pauseTimer(timer) {
  // transition() has already accounted for elapsed time before calling this.
  return { ...timer, runningSince: null };
}

export function validTimer(timer) {
  const duration = value => Number.isSafeInteger(value) && value >= 0;
  return timer && duration(timer.elapsedMs) && duration(timer.stretchMs) &&
    timer.stretchMs <= timer.elapsedMs &&
    (timer.runningSince === null || duration(timer.runningSince));
}

export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = seconds % 60;
  const pad = value => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(remainder)}` : `${pad(minutes)}:${pad(remainder)}`;
}
