// Minuteries "pausables" basées sur l'horloge murale (setTimeout), indépendantes
// de l'AudioContext (qui, lui, se met en pause/reprise nativement et gère déjà
// la position exacte de lecture des sources en cours).

export class PausableDelay {
  constructor(ms, onFire) {
    this.remaining = ms;
    this.onFire = onFire;
    this.handle = null;
    this.startedAt = null;
    this._resume();
  }
  _resume() {
    this.startedAt = Date.now();
    this.handle = setTimeout(() => {
      this.handle = null;
      this.onFire();
    }, Math.max(0, this.remaining));
  }
  pause() {
    if (this.handle == null) return;
    clearTimeout(this.handle);
    this.handle = null;
    this.remaining -= Date.now() - this.startedAt;
  }
  resume() {
    if (this.handle != null || this.remaining <= 0) return;
    this._resume();
  }
  clear() {
    if (this.handle != null) clearTimeout(this.handle);
    this.handle = null;
    this.remaining = 0;
  }
}

// Minuterie répétitive à la seconde (utilisée pour le décompte de session et la
// minuterie de préparation). Appelle onTick(remainingSeconds) chaque seconde et
// onDone() quand le compte atteint 0.
export class CountdownClock {
  constructor(totalSeconds, onTick, onDone) {
    this.remainingSeconds = totalSeconds;
    this.onTick = onTick;
    this.onDone = onDone;
    this.delay = null;
    this.running = false;
  }
  start() {
    this.running = true;
    this._scheduleTick();
  }
  _scheduleTick() {
    this.delay = new PausableDelay(1000, () => {
      if (!this.running) return;
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
      this.onTick(this.remainingSeconds);
      if (this.remainingSeconds <= 0) {
        this.running = false;
        this.onDone();
      } else {
        this._scheduleTick();
      }
    });
  }
  pause() { if (this.delay) this.delay.pause(); }
  resume() { if (this.delay) this.delay.resume(); }
  stop() {
    this.running = false;
    if (this.delay) this.delay.clear();
  }
}

// Minuterie répétitive à intervalle fixe (cloche d'intervalle). Appelle
// onFire() à chaque échéance, indéfiniment, jusqu'à stop().
export class RepeatingClock {
  constructor(intervalMs, onFire) {
    this.intervalMs = intervalMs;
    this.onFire = onFire;
    this.delay = null;
    this.running = false;
  }
  start() {
    this.running = true;
    this._schedule();
  }
  _schedule() {
    this.delay = new PausableDelay(this.intervalMs, () => {
      if (!this.running) return;
      this.onFire();
      this._schedule();
    });
  }
  pause() { if (this.delay) this.delay.pause(); }
  resume() { if (this.delay) this.delay.resume(); }
  stop() {
    this.running = false;
    if (this.delay) this.delay.clear();
  }
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
