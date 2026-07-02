import { PausableDelay } from './timers.js';

export const MAX_LAYERS = 6;
export const MODES = {
  SINGLE_LOOP: 'single-loop',
  SEQUENCE_LOOP: 'sequence-loop',
  SHUFFLE_LOOP: 'shuffle-loop',
  ONCE: 'once',
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Génère une note de cloche/bol/gong synthétisée hors-temps-réel, rendue comme
// un AudioBuffer classique : elle se manipule ensuite exactement comme une
// piste importée (bibliothèque, mixeur, cloche d'intervalle...).
async function renderTone(ctx, { freq = 432, partials = [1, 2.4, 4.1], decay = 6, gain = 0.9 }) {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * (decay + 0.5));
  const offline = new OfflineAudioContext(1, length, sampleRate);
  const master = offline.createGain();
  master.gain.value = gain;
  master.connect(offline.destination);
  partials.forEach((mult, i) => {
    const osc = offline.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    const g = offline.createGain();
    const partialGain = 1 / (i + 1.4);
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(partialGain, 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, decay);
    osc.connect(g).connect(master);
    osc.start(0);
    osc.stop(decay + 0.3);
  });
  return offline.startRendering();
}

export const BUILT_IN_SOUNDS = [
  { id: 'builtin-bol-tibetain', name: 'Bol tibétain', freq: 220, partials: [1, 2.01, 3.3, 4.2], decay: 9, gain: 0.85 },
  { id: 'builtin-cloche-claire', name: 'Cloche claire', freq: 880, partials: [1, 2.76, 4.5], decay: 4.5, gain: 0.8 },
  { id: 'builtin-gong', name: 'Gong grave', freq: 96, partials: [1, 1.5, 2.98, 3.6], decay: 12, gain: 0.9 },
];

export class MeditationEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.bufferCache = new Map(); // trackId -> AudioBuffer
    this.layers = new Map(); // layerId -> layer state
    this._masterVolume = 0.8;
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._masterVolume;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.masterGain.connect(this.analyser).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  get isSuspended() { return this.ctx && this.ctx.state === 'suspended'; }

  async decodeTrack(track) {
    if (this.bufferCache.has(track.id)) return this.bufferCache.get(track.id);
    this.ensureContext();
    let buffer;
    if (track.synth) {
      buffer = await renderTone(this.ctx, track.synth);
    } else {
      const arrayBuf = await track.blob.arrayBuffer();
      buffer = await this.ctx.decodeAudioData(arrayBuf.slice(0));
    }
    this.bufferCache.set(track.id, buffer);
    return buffer;
  }

  setMasterVolume(v) {
    this._masterVolume = clamp(v, 0, 1);
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(this._masterVolume, this.ctx.currentTime, 0.05);
  }

  getMasterVolume() { return this._masterVolume; }

  getAnalyser() { return this.analyser; }

  // --- Couches (layers) -----------------------------------------------
  createLayer(id) {
    this.ensureContext();
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0.8;
    gainNode.connect(this.masterGain);
    const layer = {
      id,
      gainNode,
      volume: 0.8,
      muted: false,
      trackIds: [],
      mode: MODES.SINGLE_LOOP,
      crossfade: 2.5,
      randomStart: false,
      playing: false,
      currentTrackId: null,
      lastTrackId: null,
      activeNodes: [], // {source, gain}
      scheduleDelay: null,
      sequenceIndex: 0,
      onTrackChange: null,
    };
    this.layers.set(id, layer);
    return layer;
  }

  removeLayer(id) {
    const layer = this.layers.get(id);
    if (!layer) return;
    this.stopLayer(id, true);
    layer.gainNode.disconnect();
    this.layers.delete(id);
  }

  configureLayer(id, patch) {
    const layer = this.layers.get(id);
    if (!layer) return;
    Object.assign(layer, patch);
    if ('volume' in patch || 'muted' in patch) {
      const target = layer.muted ? 0 : layer.volume;
      layer.gainNode.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
  }

  _pickNextTrackId(layer) {
    const { trackIds, mode, lastTrackId } = layer;
    if (trackIds.length === 0) return null;
    if (mode === MODES.SHUFFLE_LOOP) {
      if (trackIds.length === 1) return trackIds[0];
      let pick;
      do { pick = trackIds[Math.floor(Math.random() * trackIds.length)]; } while (pick === lastTrackId);
      return pick;
    }
    if (mode === MODES.SEQUENCE_LOOP || mode === MODES.ONCE) {
      const idx = layer.sequenceIndex % trackIds.length;
      layer.sequenceIndex += 1;
      return trackIds[idx];
    }
    // SINGLE_LOOP
    return trackIds[0];
  }

  async playLayer(id, tracksById) {
    const layer = this.layers.get(id);
    if (!layer || layer.trackIds.length === 0) return;
    this.ensureContext();
    layer.playing = true;
    layer.sequenceIndex = 0;
    layer.lastTrackId = null;
    await this._scheduleNext(layer, tracksById, true);
  }

  async _scheduleNext(layer, tracksById, isFirst) {
    if (!layer.playing) return;
    const trackId = this._pickNextTrackId(layer);
    if (!trackId) { layer.playing = false; return; }
    const track = tracksById.get(trackId);
    if (!track) { layer.playing = false; return; }

    let buffer;
    try {
      buffer = await this.decodeTrack(track);
    } catch (err) {
      console.error('Décodage impossible pour', track.name, err);
      layer.playing = false;
      if (layer.onError) layer.onError(track);
      return;
    }
    if (!layer.playing) return; // arrêté pendant le décodage

    const ctx = this.ctx;
    const crossfade = Math.max(0, layer.crossfade || 0);
    const startOffset = layer.randomStart && buffer.duration > 1
      ? Math.random() * buffer.duration * 0.7
      : 0;
    const playDuration = Math.max(0.05, buffer.duration - startOffset);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const nodeGain = ctx.createGain();
    src.connect(nodeGain).connect(layer.gainNode);

    const now = ctx.currentTime;
    if (crossfade > 0 && !isFirst) {
      nodeGain.gain.setValueAtTime(0, now);
      nodeGain.gain.linearRampToValueAtTime(1, now + crossfade);
    } else {
      nodeGain.gain.setValueAtTime(1, now);
    }
    src.start(now, startOffset);

    const entry = { source: src, gain: nodeGain };
    layer.activeNodes.push(entry);
    layer.currentTrackId = trackId;
    layer.lastTrackId = trackId;
    if (layer.onTrackChange) layer.onTrackChange(track);

    // Fondu de sortie de l'ancien noeud (le cas échéant)
    const prevEntries = layer.activeNodes.slice(0, -1);
    prevEntries.forEach((prev) => {
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
      prev.gain.gain.linearRampToValueAtTime(0, now + crossfade);
      const src2 = prev.source;
      try { src2.stop(now + crossfade + 0.05); } catch { /* déjà arrêté */ }
    });
    // Nettoyage de la liste après leur arrêt réel
    src.onended = () => {
      layer.activeNodes = layer.activeNodes.filter((n) => n !== entry);
    };

    if (layer.mode === MODES.ONCE && layer.sequenceIndex >= layer.trackIds.length) {
      // Dernière piste de la liste : on laisse se terminer, pas de reprogrammation.
      const msToEnd = (playDuration) * 1000;
      layer.scheduleDelay = new PausableDelay(Math.max(0, msToEnd), () => {
        layer.playing = false;
        if (layer.onFinished) layer.onFinished();
      });
      return;
    }

    const msUntilNext = Math.max(0, (playDuration - crossfade)) * 1000;
    layer.scheduleDelay = new PausableDelay(msUntilNext, () => {
      this._scheduleNext(layer, tracksById, false);
    });
  }

  stopLayer(id, immediate = false) {
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.playing = false;
    if (layer.scheduleDelay) { layer.scheduleDelay.clear(); layer.scheduleDelay = null; }
    const now = this.ctx ? this.ctx.currentTime : 0;
    layer.activeNodes.forEach(({ source, gain }) => {
      try {
        if (immediate || !this.ctx) {
          source.stop();
        } else {
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + 0.15);
          source.stop(now + 0.2);
        }
      } catch { /* déjà arrêté */ }
    });
    layer.activeNodes = [];
    layer.currentTrackId = null;
  }

  pauseAll() {
    this.layers.forEach((layer) => { if (layer.scheduleDelay) layer.scheduleDelay.pause(); });
    if (this.ctx) this.ctx.suspend();
  }

  resumeAll() {
    if (this.ctx) this.ctx.resume();
    this.layers.forEach((layer) => { if (layer.scheduleDelay) layer.scheduleDelay.resume(); });
  }

  stopAllLayers() {
    this.layers.forEach((_, id) => this.stopLayer(id));
  }

  async fadeOutAll(seconds) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.layers.forEach((layer) => {
      layer.activeNodes.forEach(({ gain }) => {
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + seconds);
      });
    });
    await new Promise((res) => setTimeout(res, seconds * 1000 + 60));
    this.stopAllLayers();
  }

  async playOneShot(track, volume = 0.9, maxDuration = null) {
    this.ensureContext();
    const buffer = await this.decodeTrack(track);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.masterGain);
    const now = this.ctx.currentTime;
    src.start(now);
    if (maxDuration && buffer.duration > maxDuration) {
      g.gain.setValueAtTime(volume, now + maxDuration - 0.3);
      g.gain.linearRampToValueAtTime(0, now + maxDuration);
      src.stop(now + maxDuration + 0.05);
    }
    return src;
  }

  anyLayerPlaying() {
    for (const layer of this.layers.values()) if (layer.playing) return true;
    return false;
  }
}
