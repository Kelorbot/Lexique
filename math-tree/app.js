// Arbre Mathématique — logique de l'application.
// Tout vit côté client : IndexedDB pour les données/images, localStorage pour
// les réglages, et un appel direct à l'API Gemini (Google AI Studio, gratuite)
// pour transcrire chaque image en LaTeX et la classer dans l'arborescence.

const ROOT_ID = 'root';
const ROOT_NAME = 'Mathématiques';
const UNSORTED_NAME = 'Non classé';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const LS_API_KEY = 'mathtree_api_key';
const LS_MODEL = 'mathtree_model';
const LS_LAYOUT = 'mathtree_layout';

// Une couleur distincte par grand domaine (branche de premier niveau) :
// Algèbre, Analyse, Géométrie, etc. — propagée à tout son sous-arbre.
const FIELD_COLORS = [
  '#7c9eff', '#63e6be', '#ffb066', '#ff8fab', '#c792ea',
  '#8fd3ff', '#f4d35e', '#7ee081', '#ff9e64', '#5ed1d1',
  '#b0a3ff', '#f78fb3',
];

const MATH_DELIMS = [
  { left: '$$', right: '$$', display: true },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\(', right: '\\)', display: false },
  { left: '$', right: '$', display: false },
];

// Disciplines qui ne sont PAS des mathématiques et doivent être bloquées.
const NON_MATH_HINT = 'physique, chimie, biologie, langues (anglais…), philosophie, histoire, littérature, sciences économiques et sociales';

const state = {
  branches: [],
  entries: [],
  selectedId: null,          // branche actuellement sélectionnée (ou null)
  collapsed: new Set(),      // ids de branches repliées
  customPos: {},             // id -> {x, y} : bulles déplacées à la main
  apiKey: '',
  model: DEFAULT_MODEL,
  uploadQueue: [],
  processing: false,
};

const view = { x: 0, y: 0, scale: 1 };
const MIN_SCALE = 0.12;
const MAX_SCALE = 3;
const RING_GAP = 168;

const imageUrlCache = new Map();
let lastPositions = new Map();   // id -> {x, y, type}
let currentEntryId = null;
let toastTimer = null;
let branchModalMode = null;      // 'add' | 'rename'
let branchModalParent = ROOT_ID; // parent visé pour un ajout
let branchModalTarget = null;    // branche à renommer
let hasFitOnce = false;
let dragState = null;            // déplacement d'une bulle en cours
let justDragged = false;        // pour ne pas déclencher un clic après un drag

// ---------- Utilitaires ----------

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Remonte jusqu'à la branche de premier niveau (le « domaine »).
function topAncestorId(id) {
  let cur = id;
  for (let i = 0; i < 50; i++) {
    const b = findBranch(cur);
    if (!b) return null;
    if (b.parentId === ROOT_ID) return b.id;
    cur = b.parentId;
  }
  return null;
}

// Couleur du domaine auquel appartient un nœud (null pour la racine).
function colorForNode(type, id, data) {
  if (type === 'root') return null;
  let topId;
  if (type === 'leaf') topId = topAncestorId(data.branchId);
  else topId = topAncestorId(id);
  if (!topId) return null;
  const tops = childBranches(ROOT_ID);
  const idx = tops.findIndex(b => b.id === topId);
  return FIELD_COLORS[(idx >= 0 ? idx : 0) % FIELD_COLORS.length];
}

function loadLayout() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_LAYOUT) || '{}');
    state.customPos = d.customPos || {};
    state.collapsed = new Set(d.collapsed || []);
  } catch (e) {
    state.customPos = {};
    state.collapsed = new Set();
  }
}

function saveLayout() {
  localStorage.setItem(LS_LAYOUT, JSON.stringify({
    customPos: state.customPos,
    collapsed: [...state.collapsed],
  }));
}

function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function escapeHtml(s) {
  return String(s || '').replace(/[<>&"]/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]
  ));
}

function renderMathText(el, text) {
  el.textContent = text || '';
  try {
    renderMathInElement(el, { delimiters: MATH_DELIMS, throwOnError: false });
  } catch (e) {
    /* on garde le texte brut si le rendu échoue */
  }
}

function showToast(msg, ms = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

function $(id) { return document.getElementById(id); }

// ---------- Arborescence : accès & modification ----------

function childBranches(parentId) {
  return state.branches.filter(b => b.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

function childEntries(branchId) {
  return state.entries.filter(e => e.branchId === branchId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

function countDescendantEntries(branchId) {
  let count = childEntries(branchId).length;
  for (const b of childBranches(branchId)) count += countDescendantEntries(b.id);
  return count;
}

function findBranch(id) {
  return state.branches.find(b => b.id === id) || null;
}

function isCollapsed(id) { return state.collapsed.has(id); }

function pathTo(nodeId) {
  const path = [];
  let current = nodeId;
  while (current && current !== ROOT_ID) {
    const b = findBranch(current);
    if (!b) break;
    path.unshift(b);
    current = b.parentId;
  }
  path.unshift({ id: ROOT_ID, name: ROOT_NAME });
  return path;
}

async function resolvePath(pathArr) {
  const names = (pathArr || []).map(n => String(n || '').trim()).filter(Boolean);
  if (names.length === 0) names.push(UNSORTED_NAME);
  let parent = ROOT_ID;
  for (const name of names) {
    const norm = normalize(name);
    let existing = state.branches.find(b => b.parentId === parent && normalize(b.name) === norm);
    if (!existing) {
      existing = { id: uuid(), name, parentId: parent };
      await MathTreeDB.put('branches', existing);
      state.branches.push(existing);
    }
    parent = existing.id;
  }
  return parent;
}

function buildTreeOutline() {
  const lines = [];
  function walk(parentId, depth) {
    for (const b of childBranches(parentId)) {
      lines.push('  '.repeat(depth) + '- ' + b.name);
      walk(b.id, depth + 1);
    }
  }
  walk(ROOT_ID, 0);
  return lines.length ? lines.join('\n') : '(vide pour le moment)';
}

// Rassemble une branche et tout son sous-arbre (branches + entrées).
function collectSubtree(branchId) {
  const branchIds = [];
  const entryIds = [];
  (function walk(id) {
    for (const b of childBranches(id)) { branchIds.push(b.id); walk(b.id); }
    for (const e of childEntries(id)) entryIds.push(e.id);
  })(branchId);
  return { branchIds, entryIds };
}

async function ensureSeed() {
  const existing = await MathTreeDB.getAll('branches');
  if (existing.length > 0) return;
  const seed = [
    { name: 'Algèbre', children: ['Espaces vectoriels euclidiens', 'Matrices'] },
    { name: 'Analyse', children: ['Suites', 'Séries numériques', 'Séries entières'] },
    { name: 'Géométrie', children: [] },
    { name: 'Probabilités & Statistiques', children: [] },
    { name: 'Logique & Ensembles', children: [] },
  ];
  for (const top of seed) {
    const topBranch = { id: uuid(), name: top.name, parentId: ROOT_ID };
    await MathTreeDB.put('branches', topBranch);
    for (const childName of top.children) {
      const child = { id: uuid(), name: childName, parentId: topBranch.id };
      await MathTreeDB.put('branches', child);
    }
  }
}

async function loadData() {
  state.branches = await MathTreeDB.getAll('branches');
  state.entries = await MathTreeDB.getAll('entries');
}

// ---------- Images ----------

async function getImageURL(entryId) {
  if (imageUrlCache.has(entryId)) return imageUrlCache.get(entryId);
  const rec = await MathTreeDB.get('images', entryId);
  if (!rec || !rec.blob) return null;
  const url = URL.createObjectURL(rec.blob);
  imageUrlCache.set(entryId, url);
  return url;
}

function releaseImageURL(entryId) {
  if (imageUrlCache.has(entryId)) {
    URL.revokeObjectURL(imageUrlCache.get(entryId));
    imageUrlCache.delete(entryId);
  }
}

function resizeImageFile(file, maxDim = 1500, quality = 0.86) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Fichier image invalide."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error("Échec de la compression.")); return; }
          const fr2 = new FileReader();
          fr2.onload = () => {
            const base64 = fr2.result.split(',')[1];
            resolve({ blob, base64, mediaType: 'image/jpeg' });
          };
          fr2.readAsDataURL(blob);
        }, 'image/jpeg', quality);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- Appel Gemini (OCR mathématique -> LaTeX + classement) ----------

function buildPrompt(treeOutline) {
  return [
    "Tu es un expert de la transcription (OCR) de documents de MATHÉMATIQUES : cours, exercices, corrigés, notes manuscrites.",
    "",
    "ÉTAPE 1 — Filtrage. Détermine si l'image relève réellement des mathématiques.",
    `Si la matière dominante est une AUTRE discipline (${NON_MATH_HINT}), alors renvoie \"isMath\": false, indique la matière dans \"subject\", et laisse \"title\", \"latex\" et \"path\" vides. Ne transcris rien dans ce cas.`,
    "Une image peut contenir un peu de calcul tout en n'étant pas des maths (ex. un exercice de physique avec des formules) : dans le doute, regarde le SUJET traité, pas la simple présence de symboles.",
    "",
    "ÉTAPE 2 — Si et seulement si c'est bien des mathématiques (\"isMath\": true), effectue :",
    "1. Transcription FIDÈLE et COMPLÈTE du contenu en LaTeX. Corrige les erreurs évidentes d'OCR mais n'invente jamais de contenu absent.",
    "   - Rédige tout le texte en langage naturel en FRANÇAIS correct (accents, orthographe et grammaire soignés), même si l'écriture source est brouillonne ou abrégée.",
    "   - Mets CHAQUE expression mathématique en LaTeX : $ ... $ en ligne, \\[ ... \\] pour les formules mises en évidence.",
    "   - Assure-toi que le LaTeX est VALIDE et compilable : accolades équilibrées, commandes correctes (\\frac, \\sum, \\int, \\sqrt, \\lim, \\mathbb, etc.), environnements adaptés (aligned, cases, pmatrix, array) si utile.",
    "2. Un titre court en français (max ~10 mots) résumant précisément le contenu, avec la notation clé en LaTeX si pertinent, ex. : \"Convergence de la série $\\sum 1/n^2$\".",
    "3. Un classement \"path\" dans l'arborescence mathématique ci-dessous. Réutilise EXACTEMENT le nom d'une branche existante quand le sujet lui correspond. Sinon crée 1 à 3 niveaux, du plus général au plus précis, avec des noms de branches courts et standards en français.",
    "",
    "Arborescence actuelle :",
    treeOutline,
    "",
    "Réponds UNIQUEMENT par un objet JSON strict, sans texte ni bloc de code autour, de la forme :",
    '{"isMath": true, "subject": "", "title": "...", "latex": "...", "path": ["Niveau 1", "Niveau 2"]}',
  ].join('\n');
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    isMath: { type: 'boolean' },
    subject: { type: 'string' },
    title: { type: 'string' },
    latex: { type: 'string' },
    path: { type: 'array', items: { type: 'string' } },
  },
  required: ['isMath', 'title', 'latex', 'path'],
};

function extractJson(raw) {
  let text = String(raw || '').trim();
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error("Réponse inattendue du modèle.");
  return JSON.parse(text.slice(start, end + 1));
}

async function classifyImage(base64, mediaType) {
  if (!state.apiKey) throw new Error('Clé API manquante — ouvre les réglages.');
  const model = state.model || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': state.apiKey,
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: buildPrompt(buildTreeOutline()) },
          { inline_data: { mime_type: mediaType, data: base64 } },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.15,
      },
    }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const errBody = await res.json(); msg = errBody.error?.message || msg; } catch (e) { /* ignore */ }
    throw new Error(`Erreur API (${res.status}) : ${msg}`);
  }
  const data = await res.json();
  if (!data.candidates || !data.candidates.length) {
    const reason = data.promptFeedback?.blockReason || 'raison inconnue';
    throw new Error(`Réponse vide ou bloquée (${reason}).`);
  }
  const raw = data.candidates[0].content?.parts?.[0]?.text || '';
  const parsed = extractJson(raw);
  return {
    isMath: parsed.isMath !== false,
    subject: String(parsed.subject || '').trim(),
    title: String(parsed.title || 'Sans titre'),
    latex: String(parsed.latex || ''),
    path: Array.isArray(parsed.path) ? parsed.path : [],
  };
}

// ---------- File d'upload ----------

function setTrayVisible(visible) {
  $('upload-tray').classList.toggle('hidden', !visible);
}

function renderTrayItem(item) {
  let el = $('upload-' + item.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'upload-item';
    el.id = 'upload-' + item.id;
    el.innerHTML = `
      <img src="${item.previewUrl}" alt="" />
      <div class="upload-info">
        <div class="upload-name">${escapeHtml(item.name)}</div>
        <div class="upload-status"></div>
      </div>
      <button class="cancel-btn" title="Retirer">✕</button>
    `;
    el.querySelector('.cancel-btn').addEventListener('click', () => removeUploadItem(item.id));
    $('upload-list').prepend(el);
  }
  const statusEl = el.querySelector('.upload-status');
  statusEl.className = 'upload-status';
  statusEl.style.display = '';
  const oldRetry = el.querySelector('.retry-btn');
  if (oldRetry) oldRetry.remove();

  if (item.status === 'queued') {
    statusEl.textContent = 'En attente…';
  } else if (item.status === 'analyzing') {
    statusEl.innerHTML = '<span class="spinner"></span> Analyse en cours…';
    statusEl.style.display = 'flex';
    statusEl.style.alignItems = 'center';
    statusEl.style.gap = '6px';
  } else if (item.status === 'done') {
    statusEl.classList.add('done');
    statusEl.textContent = '✓ Ajouté';
  } else if (item.status === 'rejected') {
    statusEl.classList.add('rejected');
    statusEl.textContent = item.error || 'Ignoré : hors mathématiques';
  } else if (item.status === 'error') {
    statusEl.classList.add('error');
    statusEl.textContent = item.error || 'Échec';
    const retry = document.createElement('button');
    retry.className = 'retry-btn';
    retry.textContent = 'Réessayer';
    retry.onclick = () => retryUpload(item.id);
    el.querySelector('.upload-info').appendChild(retry);
  }
}

function updateTrayTitle() {
  const active = state.uploadQueue.filter(i => i.status === 'queued' || i.status === 'analyzing').length;
  $('upload-tray-title').textContent = active > 0
    ? `Analyse — ${active} en cours`
    : "File d'analyse";
}

function enqueueUpload(file) {
  if (!file.type.startsWith('image/')) return;
  const item = {
    id: uuid(),
    file,
    name: file.name || 'image',
    previewUrl: URL.createObjectURL(file),
    status: 'queued',
    error: null,
    cancelled: false,
  };
  state.uploadQueue.push(item);
  setTrayVisible(true);
  renderTrayItem(item);
  updateTrayTitle();
  processQueue();
}

// Retire une image de la file (l'empêche de partir à l'API si en attente,
// ou ignore son résultat si l'analyse est déjà lancée).
function removeUploadItem(itemId) {
  const item = state.uploadQueue.find(i => i.id === itemId);
  if (!item) return;
  item.cancelled = true;
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  state.uploadQueue = state.uploadQueue.filter(i => i.id !== itemId);
  $('upload-' + itemId)?.remove();
  updateTrayTitle();
  if (state.uploadQueue.length === 0) setTrayVisible(false);
}

function clearFinishedUploads() {
  state.uploadQueue
    .filter(i => i.status === 'done' || i.status === 'error' || i.status === 'rejected')
    .forEach(i => {
      if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
      $('upload-' + i.id)?.remove();
    });
  state.uploadQueue = state.uploadQueue.filter(
    i => i.status === 'queued' || i.status === 'analyzing'
  );
  updateTrayTitle();
  if (state.uploadQueue.length === 0) setTrayVisible(false);
}

function retryUpload(itemId) {
  const item = state.uploadQueue.find(i => i.id === itemId);
  if (!item) return;
  item.status = 'queued';
  item.error = null;
  item.cancelled = false;
  renderTrayItem(item);
  updateTrayTitle();
  processQueue();
}

async function processQueue() {
  if (state.processing) return;
  state.processing = true;
  try {
    let next;
    while ((next = state.uploadQueue.find(i => i.status === 'queued' && !i.cancelled))) {
      next.status = 'analyzing';
      renderTrayItem(next);
      updateTrayTitle();
      try {
        const resized = await resizeImageFile(next.file);
        if (next.cancelled) continue;
        const result = await classifyImage(resized.base64, resized.mediaType);
        if (next.cancelled) continue;

        if (!result.isMath) {
          const subj = result.subject ? ` (${result.subject})` : '';
          next.status = 'rejected';
          next.error = `Ignoré : hors mathématiques${subj}`;
          renderTrayItem(next);
          updateTrayTitle();
          continue;
        }

        const branchId = await resolvePath(result.path);
        const entryId = uuid();
        await MathTreeDB.put('images', { id: entryId, blob: resized.blob });
        const entry = { id: entryId, branchId, title: result.title, latex: result.latex, createdAt: Date.now() };
        await MathTreeDB.put('entries', entry);
        state.entries.push(entry);
        next.status = 'done';
        renderTrayItem(next);
        updateTrayTitle();
        render();
      } catch (err) {
        if (next.cancelled) continue;
        next.status = 'error';
        next.error = err.message || "Échec de l'analyse";
        renderTrayItem(next);
        updateTrayTitle();
      }
    }
  } finally {
    state.processing = false;
  }
}

// ---------- Disposition radiale de l'arbre ----------

function childrenOf(id) {
  return [
    ...childBranches(id).map(b => ({ type: 'branch', id: b.id, data: b })),
    ...childEntries(id).map(e => ({ type: 'leaf', id: e.id, data: e })),
  ];
}

const weightCache = new Map();
function subtreeWeight(id, type) {
  if (type === 'leaf') return 1;
  if (isCollapsed(id)) return 1;
  if (weightCache.has(id)) return weightCache.get(id);
  const kids = childrenOf(id);
  if (kids.length === 0) { weightCache.set(id, 1); return 1; }
  let w = 0;
  for (const k of kids) w += subtreeWeight(k.id, k.type);
  w = Math.max(1, w);
  weightCache.set(id, w);
  return w;
}

// Calcule la position (x, y) de chaque nœud autour de la racine (0, 0).
function computeLayout() {
  weightCache.clear();
  const positions = new Map();
  positions.set(ROOT_ID, { x: 0, y: 0, type: 'root', color: null });

  function place(parentId, a0, a1, depth) {
    if (isCollapsed(parentId)) return;
    const kids = childrenOf(parentId);
    if (kids.length === 0) return;
    const total = kids.reduce((s, k) => s + subtreeWeight(k.id, k.type), 0) || 1;
    let a = a0;
    for (const k of kids) {
      const w = subtreeWeight(k.id, k.type);
      const span = (a1 - a0) * (w / total);
      const mid = a + span / 2;
      const r = depth * RING_GAP;
      positions.set(k.id, {
        x: r * Math.cos(mid),
        y: r * Math.sin(mid),
        type: k.type,
        data: k.data,
        color: colorForNode(k.type, k.id, k.data),
      });
      if (k.type === 'branch') place(k.id, a, a + span, depth + 1);
      a += span;
    }
  }

  place(ROOT_ID, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI, 1);

  // Applique les positions personnalisées (bulles déplacées à la main).
  for (const id in state.customPos) {
    const p = positions.get(id);
    if (p) { p.x = state.customPos[id].x; p.y = state.customPos[id].y; }
  }
  return positions;
}

// ---------- Rendu de l'arbre ----------

function applyView(animate = false) {
  const stage = $('tree-stage');
  const rect = stage.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const world = $('tree-world');
  world.style.transition = animate
    ? 'transform .4s cubic-bezier(.22,1,.36,1)'
    : 'none';
  world.style.transform =
    `translate(${cx + view.x}px, ${cy + view.y}px) scale(${view.scale})`;
}

function zoomAt(clientX, clientY, factor, animate = false) {
  const rect = $('tree-stage').getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const ns = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  const f = ns / view.scale;
  view.x = (1 - f) * (sx - cx) + f * view.x;
  view.y = (1 - f) * (sy - cy) + f * view.y;
  view.scale = ns;
  applyView(animate);
}

function centerOnPoint(px, py, animate = true) {
  view.x = -view.scale * px;
  view.y = -view.scale * py;
  applyView(animate);
}

function centerOnId(id) {
  const p = lastPositions.get(id);
  if (p) centerOnPoint(p.x, p.y, true);
}

function fitView(animate = true) {
  const rect = $('tree-stage').getBoundingClientRect();
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const p of lastPositions.values()) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const margin = 110;               // rayon des bulles + labels
  minX -= margin; minY -= margin; maxX += margin; maxY += margin;
  const w = Math.max(maxX - minX, 1);
  const h = Math.max(maxY - minY, 1);
  const pad = 70;
  const scale = clamp(
    Math.min((rect.width - pad) / w, (rect.height - pad) / h),
    MIN_SCALE, 1.15
  );
  view.scale = scale;
  const cxWorld = (minX + maxX) / 2;
  const cyWorld = (minY + maxY) / 2;
  view.x = -scale * cxWorld;
  view.y = -scale * cyWorld;
  applyView(animate);
}

function applyNodeColor(node, color) {
  if (!color) return;
  node.style.setProperty('--field', color);
  node.style.setProperty('--field-soft', hexToRgba(color, 0.16));
  node.style.setProperty('--field-strong', hexToRgba(color, 0.5));
}

function makeNode(id, pos) {
  const node = document.createElement('div');
  node.style.left = pos.x + 'px';
  node.style.top = pos.y + 'px';
  applyNodeColor(node, pos.color);

  if (pos.type === 'root') {
    node.className = 'node root';
    node.innerHTML = `<div class="bubble">🌳</div><div class="label"></div>`;
    renderMathText(node.querySelector('.label'), ROOT_NAME);
    node.addEventListener('click', () => { if (!consumeDrag()) selectRoot(); });
  } else if (pos.type === 'branch') {
    const b = pos.data;
    const collapsed = isCollapsed(b.id);
    node.className = 'node branch' + (collapsed ? ' collapsed' : '') +
      (state.selectedId === b.id ? ' selected' : '');
    const count = countDescendantEntries(b.id);
    node.innerHTML = `
      <div class="bubble">
        <svg viewBox="0 0 24 24"><path d="M17 5a3 3 0 0 0-2.83 2H12a1 1 0 0 0-1 1v3H8.83A3 3 0 1 0 8 13.83V17a3 3 0 1 0 2 0v-5h2v2.17A3 3 0 1 0 14 14a3 3 0 0 0-1-2.24V9h2.17A3 3 0 1 0 17 5z"/></svg>
        ${count > 0 ? `<span class="count-badge">${count}</span>` : ''}
      </div>
      <div class="label"></div>`;
    renderMathText(node.querySelector('.label'), b.name);
    node.addEventListener('click', () => { if (!consumeDrag()) selectBranch(b.id); });
  } else {
    const e = pos.data;
    node.className = 'node leaf';
    node.innerHTML = `<div class="bubble"><span class="leaf-fallback">📄</span></div><div class="label"></div>`;
    renderMathText(node.querySelector('.label'), e.title);
    node.addEventListener('click', () => { if (!consumeDrag()) openEntryModal(e.id); });
    getImageURL(e.id).then(url => {
      if (url) node.querySelector('.bubble').innerHTML = `<img src="${url}" alt="" />`;
    });
  }
  attachDrag(node, id);
  return node;
}

// Trace (ou re-trace) les traits parent -> enfant à partir des positions.
function drawEdges(positions) {
  const svg = $('branch-svg');
  svg.innerHTML = '';
  for (const [id, pos] of positions) {
    if (id === ROOT_ID) continue;
    const parentId = pos.type === 'leaf' ? pos.data.branchId : pos.data.parentId;
    const parent = positions.get(parentId);
    if (!parent) continue;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const mx = (parent.x + pos.x) / 2;
    const my = (parent.y + pos.y) / 2;
    path.setAttribute('d', `M ${parent.x} ${parent.y} Q ${mx} ${my} ${pos.x} ${pos.y}`);
    path.setAttribute('class', pos.type === 'leaf' ? 'to-leaf' : 'to-branch');
    if (pos.color) {
      path.setAttribute('stroke', hexToRgba(pos.color, pos.type === 'leaf' ? 0.32 : 0.6));
    }
    svg.appendChild(path);
  }
}

function render() {
  const positions = computeLayout();
  lastPositions = positions;

  const nodesContainer = $('tree-nodes');
  nodesContainer.innerHTML = '';
  drawEdges(positions);
  for (const [id, pos] of positions) {
    nodesContainer.appendChild(makeNode(id, pos));
  }

  $('empty-hint').classList.toggle('hidden', positions.size > 1);
  renderBreadcrumb();
  renderBranchActions();

  if (!hasFitOnce) { hasFitOnce = true; fitView(false); }
  else applyView(false);
}

// ---------- Déplacement des bulles (personnalisation) ----------

function consumeDrag() {
  if (justDragged) { justDragged = false; return true; }
  return false;
}

function attachDrag(node, id) {
  node.addEventListener('pointerdown', e => {
    if (e.button != null && e.button !== 0) return;
    e.stopPropagation();               // n'entraîne pas le pan du fond
    const pos = lastPositions.get(id);
    if (!pos) return;
    dragState = {
      id, node,
      startX: e.clientX, startY: e.clientY,
      baseX: pos.x, baseY: pos.y,
      moved: false, pointerId: e.pointerId,
    };
    try { node.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });

  node.addEventListener('pointermove', e => {
    if (!dragState || dragState.id !== id) return;
    const totalDx = e.clientX - dragState.startX;
    const totalDy = e.clientY - dragState.startY;
    if (Math.abs(totalDx) + Math.abs(totalDy) > 4) dragState.moved = true;
    const nx = dragState.baseX + totalDx / view.scale;
    const ny = dragState.baseY + totalDy / view.scale;
    node.style.left = nx + 'px';
    node.style.top = ny + 'px';
    const p = lastPositions.get(id);
    if (p) { p.x = nx; p.y = ny; drawEdges(lastPositions); }
  });

  function endDrag(e) {
    if (!dragState || dragState.id !== id) return;
    try { node.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (dragState.moved) {
      const p = lastPositions.get(id);
      if (p) { state.customPos[id] = { x: p.x, y: p.y }; saveLayout(); }
      justDragged = true;              // avale le clic qui suit
    }
    dragState = null;
  }
  node.addEventListener('pointerup', endDrag);
  node.addEventListener('pointercancel', endDrag);
}

// Réorganise proprement : efface les déplacements manuels et recadre.
function autoArrange() {
  state.customPos = {};
  saveLayout();
  render();
  fitView(true);
  showToast('Arbre réorganisé.');
}

// ---------- Fil d'Ariane ----------

function renderBreadcrumb() {
  const container = $('breadcrumb');
  container.innerHTML = '';
  const targetId = state.selectedId || ROOT_ID;
  const path = pathTo(targetId);
  path.forEach((node, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '›';
      container.appendChild(sep);
    }
    const btn = document.createElement('button');
    btn.className = 'crumb' + (i === path.length - 1 ? ' current' : '');
    renderMathText(btn, node.name);
    btn.addEventListener('click', () => {
      if (node.id === ROOT_ID) selectRoot();
      else selectBranch(node.id);
    });
    container.appendChild(btn);
  });
}

// ---------- Sélection & barre d'actions ----------

function selectRoot() {
  state.selectedId = null;
  hideSearchResults();
  render();
  centerOnPoint(0, 0, true);
}

function selectBranch(id) {
  state.selectedId = id;
  hideSearchResults();
  render();
  centerOnId(id);
}

function renderBranchActions() {
  const bar = $('branch-actions');
  const id = state.selectedId;
  if (!id) {
    bar.classList.add('hidden');
    return;
  }
  const branch = findBranch(id);
  if (!branch) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  renderMathText($('ba-name'), branch.name);
  $('ba-collapse').textContent = isCollapsed(id) ? 'Déployer' : 'Réduire';
  const hasChildren = childrenOf(id).length > 0;
  $('ba-collapse').style.display = hasChildren ? '' : 'none';
}

function toggleCollapseSelected() {
  const id = state.selectedId;
  if (!id) return;
  if (isCollapsed(id)) state.collapsed.delete(id);
  else state.collapsed.add(id);
  saveLayout();
  render();
  centerOnId(id);
}

// ---------- Ajout / renommage de branche ----------

function openBranchModal(mode, opts = {}) {
  branchModalMode = mode;
  const input = $('branch-name-input');
  if (mode === 'add') {
    branchModalParent = opts.parentId || ROOT_ID;
    branchModalTarget = null;
    $('branch-modal-title').textContent = 'Nouvelle branche';
    input.value = '';
    const parentName = branchModalParent === ROOT_ID
      ? ROOT_NAME
      : (findBranch(branchModalParent)?.name || ROOT_NAME);
    $('branch-modal-parent').textContent = `Sera créée sous : ${parentName}`;
  } else {
    branchModalTarget = opts.branchId;
    const b = findBranch(branchModalTarget);
    $('branch-modal-title').textContent = 'Renommer la branche';
    input.value = b ? b.name : '';
    $('branch-modal-parent').textContent = '';
  }
  $('modal-branch').classList.remove('hidden');
  setTimeout(() => input.focus(), 30);
}

async function saveBranchModal() {
  const name = $('branch-name-input').value.trim();
  if (!name) { showToast('Donne un nom à la branche.'); return; }

  if (branchModalMode === 'add') {
    const norm = normalize(name);
    const dupe = state.branches.find(b => b.parentId === branchModalParent && normalize(b.name) === norm);
    if (dupe) {
      showToast('Cette branche existe déjà.');
      closeModals();
      selectBranch(dupe.id);
      return;
    }
    const branch = { id: uuid(), name, parentId: branchModalParent };
    await MathTreeDB.put('branches', branch);
    state.branches.push(branch);
    if (branchModalParent !== ROOT_ID) state.collapsed.delete(branchModalParent);
    closeModals();
    selectBranch(branch.id);
    showToast('Branche ajoutée.');
  } else {
    const b = findBranch(branchModalTarget);
    if (b) {
      b.name = name;
      await MathTreeDB.put('branches', b);
    }
    closeModals();
    render();
    showToast('Branche renommée.');
  }
}

async function deleteSelectedBranch() {
  const id = state.selectedId;
  if (!id) return;
  const branch = findBranch(id);
  if (!branch) return;
  const { branchIds, entryIds } = collectSubtree(id);
  const nSub = branchIds.length;
  const nImg = entryIds.length;
  let msg = `Supprimer la branche « ${branch.name} »`;
  if (nSub || nImg) {
    const parts = [];
    if (nSub) parts.push(`${nSub} sous-branche${nSub > 1 ? 's' : ''}`);
    if (nImg) parts.push(`${nImg} image${nImg > 1 ? 's' : ''}`);
    msg += ` et tout ce qu'elle contient (${parts.join(', ')})`;
  }
  msg += ' ? Cette action est irréversible.';
  if (!confirm(msg)) return;

  const allBranchIds = [id, ...branchIds];
  for (const eid of entryIds) {
    await MathTreeDB.delete('entries', eid);
    await MathTreeDB.delete('images', eid);
    releaseImageURL(eid);
  }
  for (const bid of allBranchIds) {
    await MathTreeDB.delete('branches', bid);
    state.collapsed.delete(bid);
    delete state.customPos[bid];
  }
  for (const eid of entryIds) delete state.customPos[eid];
  state.entries = state.entries.filter(e => !entryIds.includes(e.id));
  state.branches = state.branches.filter(b => !allBranchIds.includes(b.id));
  state.selectedId = null;
  saveLayout();
  render();
  showToast('Branche supprimée.');
}

// ---------- Recherche ----------

function hideSearchResults() {
  $('search-results').classList.add('hidden');
}

function runSearch(query) {
  const q = normalize(query);
  const resultsEl = $('search-results');
  if (!q) { hideSearchResults(); return; }

  const entryMatches = state.entries
    .filter(e => normalize(e.title).includes(q) || normalize(e.latex).includes(q))
    .slice(0, 20);
  const branchMatches = state.branches
    .filter(b => normalize(b.name).includes(q))
    .slice(0, 10);

  resultsEl.innerHTML = '';
  if (entryMatches.length === 0 && branchMatches.length === 0) {
    resultsEl.innerHTML = '<div class="no-results">Aucun résultat.</div>';
    resultsEl.classList.remove('hidden');
    return;
  }

  branchMatches.forEach(b => {
    const item = document.createElement('div');
    item.className = 'result-item';
    const path = pathTo(b.parentId).slice(1).map(n => n.name).concat(b.name).join(' › ') || b.name;
    item.innerHTML = `<div class="bubble" style="width:40px;height:40px;border-radius:8px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;flex:0 0 auto;">🌿</div>
      <div><div class="result-title"></div><div class="result-path">${escapeHtml(path)}</div></div>`;
    renderMathText(item.querySelector('.result-title'), b.name);
    item.addEventListener('click', () => {
      $('search-input').value = '';
      hideSearchResults();
      selectBranch(b.id);
    });
    resultsEl.appendChild(item);
  });

  entryMatches.forEach(e => {
    const item = document.createElement('div');
    item.className = 'result-item';
    const path = pathTo(e.branchId).slice(1).map(n => n.name).join(' › ') || 'Racine';
    item.innerHTML = `<img alt="" /><div><div class="result-title"></div><div class="result-path">${escapeHtml(path)}</div></div>`;
    renderMathText(item.querySelector('.result-title'), e.title);
    getImageURL(e.id).then(url => { if (url) item.querySelector('img').src = url; });
    item.addEventListener('click', () => {
      $('search-input').value = '';
      hideSearchResults();
      openEntryModal(e.id);
    });
    resultsEl.appendChild(item);
  });

  resultsEl.classList.remove('hidden');
}

// ---------- Modal d'entrée ----------

async function openEntryModal(entryId) {
  const entry = state.entries.find(e => e.id === entryId);
  if (!entry) return;
  currentEntryId = entryId;

  const url = await getImageURL(entryId);
  $('entry-image').src = url || '';
  const path = pathTo(entry.branchId).slice(1).map(n => n.name).join(' › ') || 'Racine';
  $('entry-path').textContent = path;

  renderMathText($('entry-title'), entry.title);
  const latexEl = $('entry-latex-render');
  latexEl.innerHTML = '';
  renderMathText(latexEl, entry.latex);
  $('entry-latex-source').textContent = entry.latex;
  $('entry-latex-source').classList.add('hidden');
  $('btn-toggle-source').textContent = 'Voir la source';
  $('entry-edit-form').classList.add('hidden');

  $('modal-entry').classList.remove('hidden');
}

function closeModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

function openEditForm() {
  const entry = state.entries.find(e => e.id === currentEntryId);
  if (!entry) return;
  $('edit-title').value = entry.title;
  $('edit-latex').value = entry.latex;
  $('edit-path').value = pathTo(entry.branchId).slice(1).map(n => n.name).join(' > ');
  $('entry-edit-form').classList.remove('hidden');
}

async function saveEditForm() {
  const entry = state.entries.find(e => e.id === currentEntryId);
  if (!entry) return;
  const title = $('edit-title').value.trim() || entry.title;
  const latex = $('edit-latex').value;
  const pathStr = $('edit-path').value;
  const pathArr = pathStr.split('>').map(s => s.trim()).filter(Boolean);
  const branchId = await resolvePath(pathArr);

  entry.title = title;
  entry.latex = latex;
  entry.branchId = branchId;
  await MathTreeDB.put('entries', entry);
  showToast('Entrée mise à jour.');
  render();
  openEntryModal(currentEntryId);
}

async function deleteCurrentEntry() {
  if (!currentEntryId) return;
  if (!confirm('Supprimer définitivement cette image et sa transcription ?')) return;
  await MathTreeDB.delete('entries', currentEntryId);
  await MathTreeDB.delete('images', currentEntryId);
  releaseImageURL(currentEntryId);
  state.entries = state.entries.filter(e => e.id !== currentEntryId);
  closeModals();
  render();
  showToast('Entrée supprimée.');
}

// ---------- Réglages ----------

function loadSettings() {
  state.apiKey = localStorage.getItem(LS_API_KEY) || '';
  state.model = localStorage.getItem(LS_MODEL) || DEFAULT_MODEL;
}

function openSettings() {
  $('settings-api-key').value = state.apiKey;
  $('settings-model').value = state.model;
  $('modal-settings').classList.remove('hidden');
}

function saveSettings() {
  state.apiKey = $('settings-api-key').value.trim();
  state.model = $('settings-model').value.trim() || DEFAULT_MODEL;
  localStorage.setItem(LS_API_KEY, state.apiKey);
  localStorage.setItem(LS_MODEL, state.model);
  showToast('Réglages enregistrés.');
  closeModals();
}

// ---------- Export / import ----------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mediaType) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: mediaType });
}

async function exportData() {
  const entriesOut = [];
  for (const e of state.entries) {
    const rec = await MathTreeDB.get('images', e.id);
    const imageBase64 = rec?.blob ? await blobToBase64(rec.blob) : null;
    entriesOut.push({ ...e, imageBase64, imageType: 'image/jpeg' });
  }
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    branches: state.branches,
    entries: entriesOut,
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `arbre-mathematique-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Export téléchargé.');
}

async function importData(file) {
  const text = await file.text();
  let payload;
  try { payload = JSON.parse(text); } catch (e) { showToast('Fichier JSON invalide.'); return; }
  if (!payload || !Array.isArray(payload.branches) || !Array.isArray(payload.entries)) {
    showToast('Format de sauvegarde inconnu.');
    return;
  }

  for (const b of payload.branches) {
    if (state.branches.some(existing => existing.id === b.id)) continue;
    await MathTreeDB.put('branches', b);
    state.branches.push(b);
  }
  for (const e of payload.entries) {
    let newId = e.id;
    if (state.entries.some(existing => existing.id === e.id)) newId = uuid();
    const entry = { id: newId, branchId: e.branchId, title: e.title, latex: e.latex, createdAt: e.createdAt || Date.now() };
    if (e.imageBase64) {
      const blob = base64ToBlob(e.imageBase64, e.imageType || 'image/jpeg');
      await MathTreeDB.put('images', { id: newId, blob });
    }
    await MathTreeDB.put('entries', entry);
    state.entries.push(entry);
  }
  render();
  showToast('Import terminé.');
}

async function resetAll() {
  if (!confirm('Tout effacer (images, transcriptions, arborescence) ? Cette action est irréversible.')) return;
  await MathTreeDB.clearAll();
  imageUrlCache.forEach(url => URL.revokeObjectURL(url));
  imageUrlCache.clear();
  state.branches = [];
  state.entries = [];
  state.selectedId = null;
  state.collapsed.clear();
  state.customPos = {};
  saveLayout();
  await ensureSeed();
  await loadData();
  hasFitOnce = false;
  render();
  closeModals();
  showToast('Tout a été effacé.');
}

// ---------- Pan & zoom (souris, molette, tactile) ----------

function bindPanZoom() {
  const stage = $('tree-stage');
  const pointers = new Map();
  let panning = false;
  let lastPan = null;
  let lastPinchDist = 0;

  function isInteractive(target) {
    return target.closest('.node, .zoom-controls, .branch-actions, .search-results');
  }

  stage.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && !isInteractive(e.target)) {
      panning = true;
      lastPan = { x: e.clientX, y: e.clientY };
      stage.classList.add('panning');
      stage.setPointerCapture(e.pointerId);
    }
    if (pointers.size === 2) {
      panning = false;
      const pts = [...pointers.values()];
      lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  });

  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (lastPinchDist > 0 && dist > 0) {
        zoomAt(midX, midY, dist / lastPinchDist, false);
      }
      lastPinchDist = dist;
      return;
    }

    if (panning && lastPan) {
      view.x += e.clientX - lastPan.x;
      view.y += e.clientY - lastPan.y;
      lastPan = { x: e.clientX, y: e.clientY };
      applyView(false);
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) lastPinchDist = 0;
    if (pointers.size === 0) {
      panning = false;
      lastPan = null;
      stage.classList.remove('panning');
    }
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    zoomAt(e.clientX, e.clientY, factor, false);
  }, { passive: false });
}

// ---------- Liaison des événements ----------

function bindEvents() {
  $('btn-home').addEventListener('click', () => { state.selectedId = null; render(); fitView(true); });
  $('btn-add').addEventListener('click', () => $('file-input').click());
  $('btn-add-branch').addEventListener('click', () =>
    openBranchModal('add', { parentId: state.selectedId || ROOT_ID })
  );

  $('file-input').addEventListener('change', e => {
    Array.from(e.target.files || []).forEach(enqueueUpload);
    e.target.value = '';
  });

  $('btn-collapse-tray').addEventListener('click', () => {
    const list = $('upload-list');
    const collapsed = list.classList.toggle('hidden');
    $('btn-collapse-tray').querySelector('svg path').setAttribute(
      'd', collapsed ? 'M7 10l5 5 5-5z' : 'M7 14l5-5 5 5z'
    );
  });
  $('btn-clear-tray').addEventListener('click', clearFinishedUploads);

  let searchTimer;
  $('search-input').addEventListener('input', e => {
    clearTimeout(searchTimer);
    const value = e.target.value;
    searchTimer = setTimeout(() => runSearch(value), 150);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap') && !e.target.closest('.search-results')) hideSearchResults();
  });

  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModals));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); });

  // Zoom
  $('btn-zoom-in').addEventListener('click', () => {
    const r = $('tree-stage').getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25, true);
  });
  $('btn-zoom-out').addEventListener('click', () => {
    const r = $('tree-stage').getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8, true);
  });
  $('btn-zoom-fit').addEventListener('click', () => fitView(true));
  $('btn-auto-arrange').addEventListener('click', autoArrange);

  // Barre d'actions branche
  $('ba-add').addEventListener('click', () =>
    openBranchModal('add', { parentId: state.selectedId || ROOT_ID })
  );
  $('ba-rename').addEventListener('click', () => {
    if (state.selectedId) openBranchModal('rename', { branchId: state.selectedId });
  });
  $('ba-collapse').addEventListener('click', toggleCollapseSelected);
  $('ba-delete').addEventListener('click', deleteSelectedBranch);

  // Modal branche
  $('btn-save-branch').addEventListener('click', saveBranchModal);
  $('branch-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveBranchModal();
  });

  // Réglages
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-save-settings').addEventListener('click', saveSettings);

  // Entrée
  $('btn-copy-latex').addEventListener('click', () => {
    const entry = state.entries.find(e => e.id === currentEntryId);
    if (!entry) return;
    navigator.clipboard.writeText(entry.latex).then(() => showToast('LaTeX copié.'));
  });
  $('btn-toggle-source').addEventListener('click', () => {
    const src = $('entry-latex-source');
    const nowHidden = src.classList.toggle('hidden');
    $('btn-toggle-source').textContent = nowHidden ? 'Voir la source' : 'Masquer la source';
  });
  $('btn-edit-entry').addEventListener('click', openEditForm);
  $('btn-cancel-edit').addEventListener('click', () => $('entry-edit-form').classList.add('hidden'));
  $('btn-save-entry').addEventListener('click', saveEditForm);
  $('btn-delete-entry').addEventListener('click', deleteCurrentEntry);

  // Sauvegarde
  $('btn-export').addEventListener('click', exportData);
  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) importData(file);
    e.target.value = '';
  });
  $('btn-reset-all').addEventListener('click', resetAll);

  // Redimensionnement fenêtre
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => applyView(false), 120);
  });

  // Glisser-déposer & coller
  const stage = $('tree-stage');
  stage.addEventListener('dragover', e => e.preventDefault());
  stage.addEventListener('drop', e => {
    e.preventDefault();
    Array.from(e.dataTransfer.files || []).forEach(enqueueUpload);
  });
  document.addEventListener('paste', e => {
    Array.from(e.clipboardData?.items || []).forEach(it => {
      if (it.kind === 'file' && it.type.startsWith('image/')) enqueueUpload(it.getAsFile());
    });
  });

  bindPanZoom();
}

// ---------- Démarrage ----------

async function init() {
  loadSettings();
  loadLayout();
  await ensureSeed();
  await loadData();
  bindEvents();
  render();
  if (!state.apiKey) {
    showToast('Ajoute ta clé API Gemini (gratuite) dans les réglages pour commencer.', 4000);
  }
}

init();
