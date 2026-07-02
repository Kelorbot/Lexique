import { db, uid } from './db.js';
import { MeditationEngine, MAX_LAYERS, MODES, BUILT_IN_SOUNDS } from './audio-engine.js';
import { CountdownClock, RepeatingClock, formatClock } from './timers.js';

const PALETTE = ['#f2c879', '#7fd8a6', '#7fa8d8', '#d87fbb', '#d8a37f', '#9d7fd8', '#d87f7f', '#7fd8cf'];
const MIME_EXT = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a',
  'audio/flac': 'flac', 'audio/aac': 'aac',
};
const MODE_LABELS = [
  [MODES.SINGLE_LOOP, 'Boucle simple (1 piste)'],
  [MODES.SEQUENCE_LOOP, 'Séquence en boucle (ordre)'],
  [MODES.SHUFFLE_LOOP, 'Lecture aléatoire en boucle'],
  [MODES.ONCE, 'Une seule fois (ordre, sans boucle)'],
];
const BREATH_PATTERNS = { box: [4, 4, 4, 4], '478': [4, 7, 8, 0], coherence: [5, 0, 5, 0] };
const BREATH_PHASE_CLASSES = ['phase-in', 'phase-hold', 'phase-out', 'phase-hold2'];
const BREATH_PHASE_LABELS = ['Inspire', 'Retiens', 'Expire', 'Retiens'];
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

// ---------------------------------------------------------------- DOM refs
const $ = (id) => document.getElementById(id);
const tabButtons = document.querySelectorAll('.tab-btn[data-view]');
const views = { library: $('view-library'), mixer: $('view-mixer'), timers: $('view-timers'), breathing: $('view-breathing'), presets: $('view-presets') };

const dropzone = $('dropzone'), fileInput = $('file-input'), browseBtn = $('btn-browse');
const urlForm = $('url-import-form'), urlInput = $('url-input');
const micToggleBtn = $('btn-mic-toggle'), micTimerEl = $('mic-timer');
const storageInfoEl = $('storage-info');
const searchInput = $('library-search'), tagFiltersEl = $('tag-filters'), restoreDefaultsBtn = $('btn-restore-defaults');
const trackListEl = $('track-list'), libraryEmptyEl = $('library-empty');

const addLayerBtn = $('btn-add-layer'), layersContainerEl = $('layers-container');

const sessionMinutesInput = $('session-minutes'), prepSecondsInput = $('prep-seconds');
const fadeoutSecondsInput = $('fadeout-seconds'), sessionEndlessInput = $('session-endless');
const intervalEnabledInput = $('interval-enabled'), intervalMinutesInput = $('interval-minutes');
const intervalTrackSelect = $('interval-track'), intervalVolumeInput = $('interval-volume');
const ringFg = $('ring-fg'), sessionClockEl = $('session-clock'), sessionStatusEl = $('session-status');

const breathingPatternSelect = $('breathing-pattern'), customBreathingWrap = $('custom-breathing');
const cb1 = $('cb-1'), cb2 = $('cb-2'), cb3 = $('cb-3'), cb4 = $('cb-4');
const btnStartBreathing = $('btn-start-breathing');
const breathingOverlay = $('breathing-overlay'), btnCloseBreathing = $('btn-close-breathing');
const breathCircle = $('breath-circle'), breathLabel = $('breath-label'), breathCycleCountEl = $('breath-cycle-count');

const btnSavePreset = $('btn-save-preset'), btnExportPresets = $('btn-export-presets');
const btnImportPresets = $('btn-import-presets'), presetImportInput = $('preset-import-input');
const presetListEl = $('preset-list');

const vizCanvas = $('visualizer');
const transportPlayBtn = $('btn-transport-play'), transportStopBtn = $('btn-transport-stop');
const masterVolumeInput = $('master-volume'), transportClockEl = $('transport-clock');

const btnHelp = $('btn-help'), helpModal = $('help-modal'), btnCloseHelp = $('btn-close-help');
const toastContainer = $('toast-container');

// ---------------------------------------------------------------- State
let tracks = [];
let tracksById = new Map();
let activeTagFilters = new Set();
const engine = new MeditationEngine();
let layerOrder = [];
const layerCardEls = new Map();
let currentPopup = null;
let currentPreview = { source: null, trackId: null, btn: null };

let sessionState = 'idle'; // idle | prep | running | paused
let sessionClock = null, intervalClock = null, prepClock = null;

let breathingActive = false;
let breathingTimeouts = [];
let breathCycleCount = 0;

// ---------------------------------------------------------------- Helpers
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

function toast(message, type = 'info', ms = 4000) {
  const t = el('div', { class: 'toast' + (type === 'error' ? ' error' : ''), text: message });
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function fmtDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return '--:--';
  const s = Math.round(sec);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function extFromMime(mime) { return MIME_EXT[mime] || 'audio'; }

function readDuration(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const cleanup = (val) => { URL.revokeObjectURL(url); resolve(val); };
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => cleanup(audio.duration || 0));
    audio.addEventListener('error', () => cleanup(0));
    audio.src = url;
  });
}

function setClockText(text) {
  sessionClockEl.textContent = text;
  transportClockEl.textContent = text;
}

function setRing(fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  ringFg.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - f));
}

// ---------------------------------------------------------------- Views
function switchView(name) {
  tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  Object.entries(views).forEach(([key, node]) => node.classList.toggle('active', key === name));
}
tabButtons.forEach((btn) => btn.addEventListener('click', () => switchView(btn.dataset.view)));

// ---------------------------------------------------------------- Library
async function loadLibrary() {
  tracks = await db.getAllTracks();
  rebuildTracksById();
  renderTagFilters();
  renderTrackList();
  refreshIntervalTrackSelect();
  refreshAllLayerPickers();
  updateStorageInfo();
}

function rebuildTracksById() { tracksById = new Map(tracks.map((t) => [t.id, t])); }

async function importFiles(files) {
  let count = 0;
  for (const file of files) {
    if (!file || file.size === 0) continue;
    let duration = 0;
    try { duration = await readDuration(file); } catch { /* ignore */ }
    const track = {
      id: uid(),
      name: file.name.replace(/\.[^/.]+$/, '') || 'Piste',
      blob: file,
      mime: file.type || 'audio/*',
      tags: [],
      color: PALETTE[tracks.length % PALETTE.length],
      favorite: false,
      addedAt: Date.now(),
      duration,
    };
    try {
      await db.addTrack(track);
      tracks.push(track);
      count += 1;
    } catch (err) {
      console.error(err);
      toast(`Import impossible pour ${file.name}`, 'error');
    }
  }
  if (count > 0) {
    rebuildTracksById();
    renderTagFilters();
    renderTrackList();
    refreshIntervalTrackSelect();
    refreshAllLayerPickers();
    updateStorageInfo();
    toast(`${count} piste(s) importée(s).`);
  }
}

function getAllTagsUsed() {
  const s = new Set();
  tracks.forEach((t) => t.tags.forEach((tag) => s.add(tag)));
  return Array.from(s).sort();
}

function renderTagFilters() {
  tagFiltersEl.replaceChildren();
  getAllTagsUsed().forEach((tag) => {
    const chip = el('button', { class: 'tag-chip' + (activeTagFilters.has(tag) ? ' active' : ''), type: 'button', text: tag });
    chip.addEventListener('click', () => {
      if (activeTagFilters.has(tag)) activeTagFilters.delete(tag); else activeTagFilters.add(tag);
      renderTagFilters();
      renderTrackList();
    });
    tagFiltersEl.appendChild(chip);
  });
}

function renderTrackList() {
  const q = searchInput.value.trim().toLowerCase();
  const activeTags = Array.from(activeTagFilters);
  const filtered = tracks.filter((t) => {
    if (q && !t.name.toLowerCase().includes(q)) return false;
    if (activeTags.length && !activeTags.every((tag) => t.tags.includes(tag))) return false;
    return true;
  });
  trackListEl.replaceChildren();
  filtered.slice().reverse().forEach((t) => trackListEl.appendChild(renderTrackItem(t)));

  if (tracks.length === 0) {
    libraryEmptyEl.hidden = false;
    libraryEmptyEl.textContent = "Aucune piste pour l'instant — importe ton premier son ci-dessus.";
  } else if (filtered.length === 0) {
    libraryEmptyEl.hidden = false;
    libraryEmptyEl.textContent = 'Aucun résultat pour ce filtre.';
  } else {
    libraryEmptyEl.hidden = true;
  }
}

function renderTrackItem(t) {
  const li = el('li', { class: 'track-item' });

  const colorDot = el('span', { class: 'track-color-dot', title: 'Changer la couleur', style: `background:${t.color}` });
  const colorInput = el('input', { type: 'color', value: t.color, style: 'position:absolute;opacity:0;pointer-events:none;width:0;height:0;' });
  colorDot.addEventListener('click', () => colorInput.click());
  colorInput.addEventListener('input', async () => {
    t.color = colorInput.value;
    colorDot.style.background = t.color;
    await db.updateTrack(t.id, { color: t.color });
  });
  li.append(colorDot, colorInput);

  const main = el('div', { class: 'track-main' });
  const nameInput = el('input', { class: 'track-name-input', value: t.name });
  nameInput.addEventListener('change', async () => {
    t.name = nameInput.value.trim() || t.name;
    nameInput.value = t.name;
    await db.updateTrack(t.id, { name: t.name });
    refreshIntervalTrackSelect();
    refreshAllLayerPickers();
  });
  const meta = el('div', { class: 'track-meta' });
  meta.append(
    el('span', { class: 'track-duration', text: fmtDuration(t.duration) }),
    (() => {
      const wrap = el('div', { class: 'track-tags' });
      t.tags.forEach((tag) => wrap.appendChild(el('span', { class: 'track-tag', text: tag })));
      return wrap;
    })(),
  );
  main.append(nameInput, meta);
  li.appendChild(main);

  const favBtn = el('button', { class: 'icon-btn fav' + (t.favorite ? ' active' : ''), title: 'Favori', text: t.favorite ? '★' : '☆' });
  favBtn.addEventListener('click', async () => {
    t.favorite = !t.favorite;
    await db.updateTrack(t.id, { favorite: t.favorite });
    favBtn.classList.toggle('active', t.favorite);
    favBtn.textContent = t.favorite ? '★' : '☆';
  });
  li.appendChild(favBtn);

  const previewBtn = el('button', { class: 'icon-btn', title: 'Écouter un extrait (20s)', text: '▶' });
  previewBtn.addEventListener('click', () => togglePreview(t, previewBtn));
  li.appendChild(previewBtn);

  const actions = el('div', { class: 'track-actions' });
  const tagBtn = el('button', { class: 'icon-btn', title: 'Modifier les tags', text: '🏷' });
  tagBtn.addEventListener('click', async () => {
    const input = prompt('Tags (séparés par des virgules)', t.tags.join(', '));
    if (input == null) return;
    t.tags = input.split(',').map((s) => s.trim()).filter(Boolean);
    await db.updateTrack(t.id, { tags: t.tags });
    renderTagFilters();
    renderTrackList();
  });
  actions.appendChild(tagBtn);

  if (!t.synth) {
    const dlBtn = el('button', { class: 'icon-btn', title: 'Télécharger', text: '⭳' });
    dlBtn.addEventListener('click', () => {
      const url = URL.createObjectURL(t.blob);
      const a = el('a', { href: url, download: `${t.name}.${extFromMime(t.mime)}` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
    actions.appendChild(dlBtn);
  }

  const delBtn = el('button', { class: 'icon-btn danger', title: 'Supprimer', text: '🗑' });
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Supprimer « ${t.name} » de la bibliothèque ?`)) return;
    await db.deleteTrack(t.id);
    tracks = tracks.filter((x) => x.id !== t.id);
    rebuildTracksById();
    removeTrackFromAllLayers(t.id);
    renderTagFilters();
    renderTrackList();
    refreshIntervalTrackSelect();
    refreshAllLayerPickers();
    updateStorageInfo();
  });
  actions.appendChild(delBtn);
  li.appendChild(actions);

  return li;
}

async function togglePreview(t, btn) {
  if (currentPreview.trackId === t.id && currentPreview.source) {
    try { currentPreview.source.stop(); } catch { /* déjà arrêté */ }
    resetPreviewBtn();
    return;
  }
  if (currentPreview.source) {
    try { currentPreview.source.stop(); } catch { /* déjà arrêté */ }
    resetPreviewBtn();
  }
  try {
    const src = await engine.playOneShot(t, 0.9, 20);
    currentPreview = { source: src, trackId: t.id, btn };
    btn.textContent = '■';
    src.onended = () => { if (currentPreview.trackId === t.id) resetPreviewBtn(); };
  } catch (err) {
    console.error(err);
    toast(`Lecture impossible pour ${t.name}`, 'error');
  }
}
function resetPreviewBtn() {
  if (currentPreview.btn) currentPreview.btn.textContent = '▶';
  currentPreview = { source: null, trackId: null, btn: null };
}

async function updateStorageInfo() {
  const est = await db.storageEstimate();
  if (est && est.quota) {
    storageInfoEl.textContent = `${(est.usage / 1e6).toFixed(1)} Mo utilisés sur ~${(est.quota / 1e6).toFixed(0)} Mo (navigateur)`;
  } else {
    storageInfoEl.textContent = '';
  }
}

// ---------------------------------------------------------------- Mixer / layers
function addLayer() {
  if (layerOrder.length >= MAX_LAYERS) { toast(`Maximum ${MAX_LAYERS} couches.`, 'error'); return; }
  const id = uid();
  const layer = engine.createLayer(id);
  layer.name = `Couche ${layerOrder.length + 1}`;
  layer.color = PALETTE[layerOrder.length % PALETTE.length];
  layer.onTrackChange = (track) => updateLayerNowPlaying(id, track);
  layer.onFinished = () => updateLayerNowPlaying(id, null, 'Terminé');
  layer.onError = (track) => toast(`Erreur de lecture : ${track.name}`, 'error');
  layerOrder.push(id);
  renderLayers();
}

function removeLayerUI(id) {
  engine.removeLayer(id);
  layerOrder = layerOrder.filter((x) => x !== id);
  renderLayers();
}

function removeTrackFromAllLayers(trackId) {
  let changed = false;
  engine.layers.forEach((layer) => {
    if (layer.trackIds.includes(trackId)) {
      layer.trackIds = layer.trackIds.filter((id) => id !== trackId);
      changed = true;
    }
  });
  if (changed) refreshAllLayerPickers();
}

function renderLayers() {
  layersContainerEl.replaceChildren();
  layerCardEls.clear();
  layerOrder.forEach((id) => layersContainerEl.appendChild(buildLayerCard(engine.layers.get(id))));
}

function refreshAllLayerPickers() {
  layerOrder.forEach((id) => {
    const layer = engine.layers.get(id);
    const card = layerCardEls.get(id);
    if (!card) return;
    const chipsWrap = card.querySelector('[data-role="chips"]');
    if (chipsWrap) renderPickedChips(layer, chipsWrap);
  });
}

function updateLayerNowPlaying(id, track, overrideText) {
  const card = layerCardEls.get(id);
  if (!card) return;
  const label = card.querySelector('[data-role="now-playing"]');
  if (!label) return;
  label.textContent = overrideText || (track ? `▶ ${track.name}` : 'Aucune piste sélectionnée');
}

function buildLayerCard(layer) {
  const card = el('div', { class: 'layer-card' });
  layerCardEls.set(layer.id, card);

  const header = el('div', { class: 'layer-header' });
  const colorDot = el('span', { class: 'layer-color-dot', style: `background:${layer.color}` });
  const colorInput = el('input', { type: 'color', value: layer.color, style: 'position:absolute;opacity:0;pointer-events:none;width:0;height:0;' });
  colorDot.addEventListener('click', () => colorInput.click());
  colorInput.addEventListener('input', () => { layer.color = colorInput.value; colorDot.style.background = layer.color; });

  const nameInput = el('input', { class: 'layer-name-input', value: layer.name });
  nameInput.addEventListener('change', () => { layer.name = nameInput.value.trim() || layer.name; nameInput.value = layer.name; });

  const muteBtn = el('button', { class: 'icon-btn', title: 'Muet', text: layer.muted ? '🔇' : '🔊' });
  muteBtn.addEventListener('click', () => {
    layer.muted = !layer.muted;
    engine.configureLayer(layer.id, { muted: layer.muted });
    muteBtn.textContent = layer.muted ? '🔇' : '🔊';
  });

  const removeBtn = el('button', { class: 'icon-btn danger', title: 'Retirer la couche', text: '✕' });
  removeBtn.addEventListener('click', () => {
    if (layerOrder.length <= 1) { toast('Il faut au moins une couche.', 'error'); return; }
    removeLayerUI(layer.id);
  });

  const nowPlaying = el('div', { class: 'layer-now-playing', text: 'Aucune piste sélectionnée' });
  nowPlaying.dataset.role = 'now-playing';

  header.append(colorDot, colorInput, nameInput, muteBtn, removeBtn, nowPlaying);
  card.appendChild(header);

  const body = el('div', { class: 'layer-body' });

  // Pistes de la couche
  const chipsWrap = el('div', { class: 'layer-tracks-picker' });
  chipsWrap.dataset.role = 'chips';
  const pickBtn = el('button', { class: 'btn small', type: 'button', text: '+ Choisir des pistes' });
  pickBtn.addEventListener('click', () => openTrackPicker(layer, pickBtn));
  const pickLabel = el('label', {}, [chipsWrap, pickBtn]);
  pickLabel.prepend(document.createTextNode('Pistes de cette couche'));
  body.appendChild(el('div', { class: 'layer-field' }, [pickLabel]));
  renderPickedChips(layer, chipsWrap);

  // Mode
  const modeSelect = el('select', {});
  MODE_LABELS.forEach(([val, label]) => modeSelect.appendChild(el('option', { value: val, text: label })));
  modeSelect.value = layer.mode;
  modeSelect.addEventListener('change', () => { layer.mode = modeSelect.value; });
  const modeLabel = el('label', {}, [document.createTextNode('Mode de lecture'), modeSelect]);
  body.appendChild(el('div', { class: 'layer-field wide' }, [modeLabel]));

  // Départ aléatoire
  const randCheck = el('input', { type: 'checkbox' });
  randCheck.checked = layer.randomStart;
  randCheck.addEventListener('change', () => { layer.randomStart = randCheck.checked; });
  const randLabel = el('label', { class: 'checkbox-line' }, [randCheck, document.createTextNode(' Départ aléatoire à chaque tour')]);
  body.appendChild(el('div', { class: 'layer-field' }, [randLabel]));

  // Fondu enchaîné
  const cfRange = el('input', { type: 'range', min: '0', max: '10', step: '0.5', value: String(layer.crossfade) });
  const cfValue = el('span', { class: 'hint', text: `${layer.crossfade} s` });
  cfRange.addEventListener('input', () => { layer.crossfade = parseFloat(cfRange.value); cfValue.textContent = `${layer.crossfade} s`; });
  const cfLabel = el('label', {}, [document.createTextNode('Fondu enchaîné'), cfRange, cfValue]);
  body.appendChild(el('div', { class: 'layer-field' }, [cfLabel]));

  // Volume
  const volRange = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(layer.volume * 100)) });
  volRange.addEventListener('input', () => {
    layer.volume = parseInt(volRange.value, 10) / 100;
    engine.configureLayer(layer.id, { volume: layer.volume });
  });
  const volLabel = el('label', {}, [document.createTextNode('Volume de la couche'), volRange]);
  body.appendChild(el('div', { class: 'layer-field' }, [volLabel]));

  card.appendChild(body);

  const transport = el('div', { class: 'layer-transport' });
  const playBtn = el('button', { class: 'btn small', type: 'button', text: '▶ Lire cette couche' });
  playBtn.addEventListener('click', async () => {
    if (layer.trackIds.length === 0) { toast('Choisis au moins une piste pour cette couche.', 'error'); return; }
    engine.ensureContext();
    await engine.playLayer(layer.id, tracksById);
  });
  const stopBtnL = el('button', { class: 'btn small', type: 'button', text: '■ Stop' });
  stopBtnL.addEventListener('click', () => engine.stopLayer(layer.id));
  transport.append(playBtn, stopBtnL);
  card.appendChild(transport);

  return card;
}

function renderPickedChips(layer, wrap) {
  wrap.replaceChildren();
  if (layer.trackIds.length === 0) {
    wrap.appendChild(el('span', { class: 'hint', text: 'Aucune piste' }));
    return;
  }
  layer.trackIds.forEach((tid) => {
    const t = tracksById.get(tid);
    const chip = el('span', { class: 'picked-track-chip' }, [t ? t.name : '(piste introuvable)']);
    const rm = el('button', { type: 'button', text: '✕' });
    rm.addEventListener('click', () => {
      layer.trackIds = layer.trackIds.filter((x) => x !== tid);
      renderPickedChips(layer, wrap);
    });
    chip.appendChild(rm);
    wrap.appendChild(chip);
  });
}

function openTrackPicker(layer, anchor) {
  closeAnyPopup();
  const popup = el('div', { class: 'track-picker-popup' });
  if (tracks.length === 0) {
    popup.appendChild(el('div', { class: 'hint', text: "Bibliothèque vide — importe des pistes d'abord." }));
  }
  tracks.forEach((t) => {
    const cb = el('input', { type: 'checkbox' });
    cb.checked = layer.trackIds.includes(t.id);
    cb.addEventListener('change', () => {
      if (cb.checked) { if (!layer.trackIds.includes(t.id)) layer.trackIds.push(t.id); }
      else { layer.trackIds = layer.trackIds.filter((x) => x !== t.id); }
      const card = layerCardEls.get(layer.id);
      const chipsWrap = card && card.querySelector('[data-role="chips"]');
      if (chipsWrap) renderPickedChips(layer, chipsWrap);
    });
    popup.appendChild(el('label', {}, [cb, ` ${t.name}`]));
  });
  document.body.appendChild(popup);
  const rect = anchor.getBoundingClientRect();
  popup.style.top = `${window.scrollY + rect.bottom + 4}px`;
  popup.style.left = `${window.scrollX + rect.left}px`;
  currentPopup = popup;
  setTimeout(() => document.addEventListener('click', onDocClickClosePopup), 0);
}
function onDocClickClosePopup(e) { if (currentPopup && !currentPopup.contains(e.target)) closeAnyPopup(); }
function closeAnyPopup() {
  if (currentPopup) {
    currentPopup.remove();
    currentPopup = null;
    document.removeEventListener('click', onDocClickClosePopup);
  }
}

// ---------------------------------------------------------------- Session / timers
function getSessionSettings() {
  return {
    minutes: parseFloat(sessionMinutesInput.value) || 0,
    endless: sessionEndlessInput.checked,
    prepSeconds: parseInt(prepSecondsInput.value, 10) || 0,
    fadeoutSeconds: parseInt(fadeoutSecondsInput.value, 10) || 0,
    intervalEnabled: intervalEnabledInput.checked,
    intervalMinutes: parseFloat(intervalMinutesInput.value) || 5,
    intervalTrackId: intervalTrackSelect.value,
    intervalVolume: (parseInt(intervalVolumeInput.value, 10) || 0) / 100,
  };
}

function updateTransportUI() {
  if (sessionState === 'idle') transportPlayBtn.textContent = '▶ Démarrer la session';
  else if (sessionState === 'prep') transportPlayBtn.textContent = '⏳ Préparation… (clic pour passer)';
  else if (sessionState === 'running') transportPlayBtn.textContent = '⏸ Pause';
  else if (sessionState === 'paused') transportPlayBtn.textContent = '▶ Reprendre';
}

async function startSession() {
  if (layerOrder.every((id) => engine.layers.get(id).trackIds.length === 0)) {
    toast('Ajoute au moins une piste à une couche du mixeur avant de démarrer.', 'error');
    return;
  }
  engine.ensureContext();
  const s = getSessionSettings();
  sessionState = 'prep';
  updateTransportUI();
  if (s.prepSeconds > 0) {
    sessionStatusEl.textContent = 'Préparation…';
    prepClock = new CountdownClock(s.prepSeconds, (rem) => setClockText(formatClock(rem)), () => actuallyBeginPlayback(s));
    prepClock.start();
  } else {
    actuallyBeginPlayback(s);
  }
}

async function actuallyBeginPlayback(s) {
  prepClock = null;
  sessionState = 'running';
  updateTransportUI();
  sessionStatusEl.textContent = 'En cours';
  for (const id of layerOrder) {
    const layer = engine.layers.get(id);
    if (layer.trackIds.length > 0) await engine.playLayer(id, tracksById);
  }
  if (s.intervalEnabled && s.intervalTrackId) {
    intervalClock = new RepeatingClock(s.intervalMinutes * 60000, () => {
      const t = tracksById.get(s.intervalTrackId);
      if (t) engine.playOneShot(t, s.intervalVolume).catch(() => {});
    });
    intervalClock.start();
  }
  if (!s.endless && s.minutes > 0) {
    const totalSeconds = s.minutes * 60;
    setRing(1);
    sessionClock = new CountdownClock(totalSeconds, (rem) => {
      setClockText(formatClock(rem));
      setRing(rem / totalSeconds);
    }, async () => {
      sessionStatusEl.textContent = 'Fondu de fin…';
      await engine.fadeOutAll(s.fadeoutSeconds);
      finishSession();
    });
    sessionClock.start();
  } else {
    setClockText('∞');
    setRing(1);
  }
}

function finishSession() {
  sessionState = 'idle';
  sessionStatusEl.textContent = 'Terminé';
  clearAllClocks();
  updateTransportUI();
}

function pauseSession() {
  if (sessionState !== 'running') return;
  engine.pauseAll();
  if (sessionClock) sessionClock.pause();
  if (intervalClock) intervalClock.pause();
  sessionState = 'paused';
  sessionStatusEl.textContent = 'Pause';
  updateTransportUI();
}
function resumeSession() {
  if (sessionState !== 'paused') return;
  engine.resumeAll();
  if (sessionClock) sessionClock.resume();
  if (intervalClock) intervalClock.resume();
  sessionState = 'running';
  sessionStatusEl.textContent = 'En cours';
  updateTransportUI();
}
function stopSession() {
  engine.stopAllLayers();
  clearAllClocks();
  sessionState = 'idle';
  sessionStatusEl.textContent = 'Prêt';
  setClockText(sessionEndlessInput.checked ? '∞' : formatClock((parseFloat(sessionMinutesInput.value) || 0) * 60));
  setRing(1);
  updateTransportUI();
}
function clearAllClocks() {
  if (sessionClock) { sessionClock.stop(); sessionClock = null; }
  if (intervalClock) { intervalClock.stop(); intervalClock = null; }
  if (prepClock) { prepClock.stop(); prepClock = null; }
}

function refreshIntervalTrackSelect() {
  const prev = intervalTrackSelect.value;
  intervalTrackSelect.replaceChildren();
  if (tracks.length === 0) {
    intervalTrackSelect.appendChild(el('option', { value: '', text: '(bibliothèque vide)' }));
    return;
  }
  tracks.forEach((t) => intervalTrackSelect.appendChild(el('option', { value: t.id, text: t.name })));
  if (tracksById.has(prev)) intervalTrackSelect.value = prev;
  else {
    const bell = tracks.find((t) => t.tags.includes('Cloche'));
    if (bell) intervalTrackSelect.value = bell.id;
  }
}

// ---------------------------------------------------------------- Visualizer
function drawViz() {
  requestAnimationFrame(drawViz);
  const ctx2d = vizCanvas.getContext('2d');
  ctx2d.clearRect(0, 0, vizCanvas.width, vizCanvas.height);
  const analyser = engine.getAnalyser();
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const barCount = 24;
  const step = Math.max(1, Math.floor(data.length / barCount));
  const barWidth = vizCanvas.width / barCount;
  ctx2d.fillStyle = '#f2c879';
  for (let i = 0; i < barCount; i += 1) {
    const v = data[i * step] / 255;
    const h = v * vizCanvas.height;
    ctx2d.fillRect(i * barWidth + 1, vizCanvas.height - h, barWidth - 2, h);
  }
}

// ---------------------------------------------------------------- Breathing guide
function getBreathingDurations() {
  const val = breathingPatternSelect.value;
  if (val === 'custom') return [cb1, cb2, cb3, cb4].map((inp) => parseFloat(inp.value) || 0);
  return BREATH_PATTERNS[val];
}

function startBreathing() {
  if (getBreathingDurations().every((d) => d <= 0)) { toast('Configure au moins une phase de respiration.', 'error'); return; }
  breathingOverlay.hidden = false;
  breathingActive = true;
  breathCycleCount = 0;
  breathCycleCountEl.textContent = '';
  runBreathCycle();
}
function stopBreathing() {
  breathingActive = false;
  breathingTimeouts.forEach(clearTimeout);
  breathingTimeouts = [];
  breathingOverlay.hidden = true;
  breathCircle.className = 'breath-circle';
}
function runBreathCycle() {
  if (!breathingActive) return;
  let phaseIdx = 0;
  const step = () => {
    if (!breathingActive) return;
    const durations = getBreathingDurations();
    while (phaseIdx < 4 && durations[phaseIdx] <= 0) phaseIdx += 1;
    if (phaseIdx >= 4) {
      breathCycleCount += 1;
      breathCycleCountEl.textContent = `${breathCycleCount} cycle${breathCycleCount > 1 ? 's' : ''}`;
      phaseIdx = 0;
      breathingTimeouts.push(setTimeout(step, 10));
      return;
    }
    breathCircle.className = `breath-circle ${BREATH_PHASE_CLASSES[phaseIdx]}`;
    breathCircle.style.transitionDuration = `${durations[phaseIdx]}s`;
    breathLabel.textContent = BREATH_PHASE_LABELS[phaseIdx];
    const dur = durations[phaseIdx];
    phaseIdx += 1;
    breathingTimeouts.push(setTimeout(step, dur * 1000));
  };
  step();
}

// ---------------------------------------------------------------- Presets
function collectCurrentConfig() {
  return {
    layers: layerOrder.map((id) => {
      const l = engine.layers.get(id);
      return {
        name: l.name, color: l.color, trackIds: [...l.trackIds],
        trackNames: l.trackIds.map((tid) => (tracksById.get(tid) ? tracksById.get(tid).name : '?')),
        mode: l.mode, crossfade: l.crossfade, randomStart: l.randomStart, volume: l.volume, muted: l.muted,
      };
    }),
    session: getSessionSettings(),
    breathing: { pattern: breathingPatternSelect.value, custom: [cb1, cb2, cb3, cb4].map((i) => Number(i.value)) },
    masterVolume: parseInt(masterVolumeInput.value, 10),
  };
}

async function loadPresets() {
  const presets = await db.getAllPresets();
  presetListEl.replaceChildren();
  if (presets.length === 0) {
    presetListEl.appendChild(el('li', { class: 'empty-state', text: 'Aucun preset enregistré.' }));
    return;
  }
  presets.forEach((p) => presetListEl.appendChild(renderPresetItem(p)));
}

function renderPresetItem(p) {
  const li = el('li', { class: 'preset-item' });
  const left = el('div', {}, [
    el('div', { class: 'preset-name', text: p.name }),
    el('div', { class: 'preset-meta', text: `${new Date(p.createdAt).toLocaleString('fr-FR')} · ${p.config.layers.length} couche(s)` }),
  ]);
  li.appendChild(left);
  const applyBtn = el('button', { class: 'btn small', text: 'Charger' });
  applyBtn.addEventListener('click', () => applyPreset(p));
  const delBtn = el('button', { class: 'btn small danger', text: 'Supprimer' });
  delBtn.addEventListener('click', async () => {
    if (!confirm('Supprimer ce preset ?')) return;
    await db.deletePreset(p.id);
    loadPresets();
  });
  li.appendChild(el('div', { class: 'preset-actions-inline' }, [applyBtn, delBtn]));
  return li;
}

function applyPreset(p) {
  const cfg = p.config;
  [...layerOrder].forEach((id) => engine.removeLayer(id));
  layerOrder = [];
  const missing = [];
  cfg.layers.forEach((lc) => {
    const id = uid();
    const layer = engine.createLayer(id);
    layer.name = lc.name; layer.color = lc.color; layer.mode = lc.mode; layer.crossfade = lc.crossfade;
    layer.randomStart = lc.randomStart; layer.volume = lc.volume; layer.muted = lc.muted;
    layer.trackIds = lc.trackIds.filter((tid) => tracksById.has(tid));
    if (layer.trackIds.length < lc.trackIds.length) {
      (lc.trackNames || []).forEach((n, i) => { if (!tracksById.has(lc.trackIds[i])) missing.push(n); });
    }
    layer.onTrackChange = (track) => updateLayerNowPlaying(id, track);
    layer.onFinished = () => updateLayerNowPlaying(id, null, 'Terminé');
    layer.onError = (track) => toast(`Erreur de lecture : ${track.name}`, 'error');
    layerOrder.push(id);
  });
  renderLayers();

  if (cfg.session) {
    sessionMinutesInput.value = cfg.session.minutes;
    sessionEndlessInput.checked = cfg.session.endless;
    sessionMinutesInput.disabled = cfg.session.endless;
    prepSecondsInput.value = cfg.session.prepSeconds;
    fadeoutSecondsInput.value = cfg.session.fadeoutSeconds;
    intervalEnabledInput.checked = cfg.session.intervalEnabled;
    intervalMinutesInput.value = cfg.session.intervalMinutes;
    intervalVolumeInput.value = Math.round(cfg.session.intervalVolume * 100);
    if (cfg.session.intervalTrackId) intervalTrackSelect.value = cfg.session.intervalTrackId;
  }
  if (cfg.breathing) {
    breathingPatternSelect.value = cfg.breathing.pattern;
    customBreathingWrap.hidden = cfg.breathing.pattern !== 'custom';
    if (cfg.breathing.custom) [cb1, cb2, cb3, cb4].forEach((inp, i) => { inp.value = cfg.breathing.custom[i]; });
  }
  if (typeof cfg.masterVolume === 'number') {
    masterVolumeInput.value = cfg.masterVolume;
    engine.setMasterVolume(cfg.masterVolume / 100);
  }
  switchView('mixer');
  toast(missing.length ? `Preset chargé — pistes manquantes : ${missing.join(', ')}` : 'Preset chargé.', missing.length ? 'error' : 'info');
}

// ---------------------------------------------------------------- Wiring
function wireStaticListeners() {
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    if (files.length) importFiles(files);
  });
  dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);
    fileInput.value = '';
    if (files.length) importFiles(files);
  });

  urlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;
    try {
      toast('Téléchargement en cours…');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const name = decodeURIComponent(url.split('/').pop().split('?')[0] || 'audio-importe');
      await importFiles([new File([blob], name, { type: blob.type || 'audio/mpeg' })]);
      urlInput.value = '';
    } catch (err) {
      console.error(err);
      toast(`Import URL impossible (CORS ou réseau) : ${err.message}`, 'error');
    }
  });

  let mediaRecorder = null, mediaChunks = [], micStream = null, micStartTime = null, micTimerInterval = null;
  micToggleBtn.addEventListener('click', async () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        toast(`Micro inaccessible : ${err.message}`, 'error');
        return;
      }
      mediaChunks = [];
      mediaRecorder = new MediaRecorder(micStream);
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) mediaChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(mediaChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        micStream.getTracks().forEach((tr) => tr.stop());
        clearInterval(micTimerInterval);
        micTimerEl.textContent = '0:00';
        const name = `Enregistrement ${new Date().toLocaleString('fr-FR')}`;
        await importFiles([new File([blob], `${name}.webm`, { type: blob.type })]);
      };
      mediaRecorder.start();
      micStartTime = Date.now();
      micTimerInterval = setInterval(() => { micTimerEl.textContent = formatClock((Date.now() - micStartTime) / 1000); }, 500);
      micToggleBtn.textContent = '■ Arrêter';
      micToggleBtn.classList.add('recording');
    } else {
      mediaRecorder.stop();
      micToggleBtn.textContent = '● Enregistrer';
      micToggleBtn.classList.remove('recording');
    }
  });

  searchInput.addEventListener('input', renderTrackList);
  restoreDefaultsBtn.addEventListener('click', async () => {
    let added = 0;
    for (const def of BUILT_IN_SOUNDS) {
      if (tracksById.has(def.id)) continue;
      const track = {
        id: def.id, name: def.name, synth: { freq: def.freq, partials: def.partials, decay: def.decay, gain: def.gain },
        tags: ['Cloche'], color: PALETTE[(tracks.length + added) % PALETTE.length], favorite: false,
        addedAt: Date.now(), duration: def.decay + 0.5,
      };
      await db.addTrack(track);
      tracks.push(track);
      added += 1;
    }
    rebuildTracksById();
    if (added > 0) {
      renderTagFilters(); renderTrackList(); refreshIntervalTrackSelect(); refreshAllLayerPickers();
      toast(`${added} son(s) par défaut ajouté(s).`);
    } else {
      toast('Les sons par défaut sont déjà présents.');
    }
  });

  addLayerBtn.addEventListener('click', addLayer);

  sessionEndlessInput.addEventListener('change', () => {
    sessionMinutesInput.disabled = sessionEndlessInput.checked;
    if (sessionState === 'idle') setClockText(sessionEndlessInput.checked ? '∞' : formatClock((parseFloat(sessionMinutesInput.value) || 0) * 60));
  });
  sessionMinutesInput.addEventListener('input', () => {
    if (sessionState === 'idle' && !sessionEndlessInput.checked) setClockText(formatClock((parseFloat(sessionMinutesInput.value) || 0) * 60));
  });

  transportPlayBtn.addEventListener('click', () => {
    if (sessionState === 'idle') startSession();
    else if (sessionState === 'running') pauseSession();
    else if (sessionState === 'paused') resumeSession();
    else if (sessionState === 'prep') { if (prepClock) { prepClock.stop(); prepClock = null; } actuallyBeginPlayback(getSessionSettings()); }
  });
  transportStopBtn.addEventListener('click', stopSession);
  masterVolumeInput.addEventListener('input', () => engine.setMasterVolume(parseInt(masterVolumeInput.value, 10) / 100));

  breathingPatternSelect.addEventListener('change', () => { customBreathingWrap.hidden = breathingPatternSelect.value !== 'custom'; });
  btnStartBreathing.addEventListener('click', startBreathing);
  btnCloseBreathing.addEventListener('click', stopBreathing);

  btnSavePreset.addEventListener('click', async () => {
    const name = prompt('Nom du preset :', `Session ${new Date().toLocaleDateString('fr-FR')}`);
    if (!name) return;
    await db.addPreset({ id: uid(), name, createdAt: Date.now(), config: collectCurrentConfig() });
    await loadPresets();
    toast('Preset enregistré.');
  });
  btnExportPresets.addEventListener('click', async () => {
    const presets = await db.getAllPresets();
    if (presets.length === 0) { toast('Aucun preset à exporter.', 'error'); return; }
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'meditation-presets.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  btnImportPresets.addEventListener('click', () => presetImportInput.click());
  presetImportInput.addEventListener('change', async () => {
    const file = presetImportInput.files[0];
    presetImportInput.value = '';
    if (!file) return;
    try {
      const arr = JSON.parse(await file.text());
      if (!Array.isArray(arr)) throw new Error('format invalide');
      let count = 0;
      for (const p of arr) {
        if (!p || typeof p !== 'object' || !p.config) continue;
        await db.addPreset({ id: uid(), name: p.name || 'Preset importé', createdAt: Date.now(), config: p.config });
        count += 1;
      }
      await loadPresets();
      toast(`${count} preset(s) importé(s).`);
    } catch (err) {
      console.error(err);
      toast('Fichier de presets invalide.', 'error');
    }
  });

  btnHelp.addEventListener('click', () => { helpModal.hidden = false; });
  btnCloseHelp.addEventListener('click', () => { helpModal.hidden = true; });
  helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.hidden = true; });

  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === ' ') { e.preventDefault(); transportPlayBtn.click(); }
    else if (e.key === 's' || e.key === 'S') stopSession();
    else if (e.key === 'ArrowUp') { e.preventDefault(); masterVolumeInput.value = Math.min(100, parseInt(masterVolumeInput.value, 10) + 5); masterVolumeInput.dispatchEvent(new Event('input')); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); masterVolumeInput.value = Math.max(0, parseInt(masterVolumeInput.value, 10) - 5); masterVolumeInput.dispatchEvent(new Event('input')); }
    else if (e.key === 'b' || e.key === 'B') { if (breathingOverlay.hidden) startBreathing(); else stopBreathing(); }
    else if (e.key === '?') helpModal.hidden = false;
    else if (['1', '2', '3', '4', '5'].includes(e.key)) {
      const order = ['library', 'mixer', 'timers', 'breathing', 'presets'];
      switchView(order[parseInt(e.key, 10) - 1]);
    } else if (e.key === 'Escape') {
      if (!helpModal.hidden) helpModal.hidden = true;
      if (!breathingOverlay.hidden) stopBreathing();
    }
  });
}

// ---------------------------------------------------------------- Init
async function init() {
  wireStaticListeners();
  await loadLibrary();
  await loadPresets();
  if (layerOrder.length === 0) addLayer();
  setClockText(formatClock((parseFloat(sessionMinutesInput.value) || 0) * 60));
  setRing(1);
  requestAnimationFrame(drawViz);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
init();
