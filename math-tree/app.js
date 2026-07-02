// Arbre Mathématique — logique de l'application.
// Tout vit côté client : IndexedDB pour les données/images, localStorage pour
// les réglages, et un appel direct à l'API Anthropic (Claude, vision) pour
// transcrire chaque image en LaTeX et la classer dans l'arborescence.

const ROOT_ID = 'root';
const ROOT_NAME = 'Mathématiques';
const UNSORTED_NAME = 'Non classé';
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const LS_API_KEY = 'mathtree_api_key';
const LS_MODEL = 'mathtree_model';

const MATH_DELIMS = [
  { left: '$$', right: '$$', display: true },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\(', right: '\\)', display: false },
  { left: '$', right: '$', display: false },
];

const state = {
  branches: [],
  entries: [],
  focusId: ROOT_ID,
  apiKey: '',
  model: DEFAULT_MODEL,
  uploadQueue: [],
  processing: false,
};

const imageUrlCache = new Map();
let currentEntryId = null;
let toastTimer = null;

// ---------- Utilitaires ----------

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
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
  const el = document.getElementById('toast');
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

function pathTo(nodeId) {
  const path = [];
  let current = nodeId;
  while (current !== ROOT_ID) {
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
            const dataUrl = fr2.result;
            const base64 = dataUrl.split(',')[1];
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

// ---------- Appel Claude (OCR mathématique -> LaTeX + classement) ----------

function buildPrompt(treeOutline) {
  return [
    "Tu es un assistant d'OCR mathématique.",
    "Analyse cette image (cours, exercice ou notes manuscrites de mathématiques) et effectue trois tâches :",
    "1. Transcris fidèlement tout le contenu mathématique en LaTeX, y compris le texte d'énoncé éventuel. Utilise \\[ ... \\] pour les blocs et des environnements (align, aligned, cases, array) si utile.",
    "2. Rédige un titre court (5 à 10 mots) en français qui résume précisément le contenu, avec la notation clé en LaTeX si pertinent, par exemple : \"Convergence de la série $\\sum 1/n^2$\".",
    "3. Classe ce contenu dans l'arborescence de branches mathématiques ci-dessous. Réutilise EXACTEMENT l'orthographe d'une branche existante quand le sujet correspond conceptuellement. Sinon, crée les niveaux nécessaires avec des noms de branches courts et standards en français. Le chemin peut avoir 1 à 3 niveaux, du plus général au plus précis.",
    "",
    "Arborescence actuelle :",
    treeOutline,
    "",
    "Réponds UNIQUEMENT avec un objet JSON strict, sans texte autour ni bloc de code, sous la forme :",
    '{"title": "...", "latex": "...", "path": ["Niveau 1", "Niveau 2"]}',
  ].join('\n');
}

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
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': state.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: state.model || DEFAULT_MODEL,
      max_tokens: 1800,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(buildTreeOutline()) },
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        ],
      }],
    }),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const errBody = await res.json(); msg = errBody.error?.message || msg; } catch (e) { /* ignore */ }
    throw new Error(`Erreur API (${res.status}) : ${msg}`);
  }
  const data = await res.json();
  const raw = data.content?.[0]?.text || '';
  const parsed = extractJson(raw);
  return {
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
  let el = document.getElementById('upload-' + item.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'upload-item';
    el.id = 'upload-' + item.id;
    el.innerHTML = `
      <img src="${item.previewUrl}" alt="" />
      <div class="upload-info">
        <div class="upload-name">${item.name.replace(/[<>&]/g, '')}</div>
        <div class="upload-status"></div>
      </div>
    `;
    $('upload-list').prepend(el);
  }
  const statusEl = el.querySelector('.upload-status');
  statusEl.className = 'upload-status';
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
  } else if (item.status === 'error') {
    statusEl.classList.add('error');
    statusEl.textContent = item.error || 'Échec';
    if (!el.querySelector('.retry-btn')) {
      const retry = document.createElement('button');
      retry.className = 'retry-btn';
      retry.textContent = 'Réessayer';
      retry.onclick = () => retryUpload(item.id);
      el.appendChild(retry);
    }
  }
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
  };
  state.uploadQueue.push(item);
  setTrayVisible(true);
  renderTrayItem(item);
  processQueue();
}

function retryUpload(itemId) {
  const item = state.uploadQueue.find(i => i.id === itemId);
  if (!item) return;
  item.status = 'queued';
  item.error = null;
  const el = document.getElementById('upload-' + itemId);
  const retryBtn = el?.querySelector('.retry-btn');
  if (retryBtn) retryBtn.remove();
  renderTrayItem(item);
  processQueue();
}

async function processQueue() {
  if (state.processing) return;
  state.processing = true;
  try {
    let next;
    while ((next = state.uploadQueue.find(i => i.status === 'queued'))) {
      next.status = 'analyzing';
      renderTrayItem(next);
      try {
        const resized = await resizeImageFile(next.file);
        const result = await classifyImage(resized.base64, resized.mediaType);
        const branchId = await resolvePath(result.path);
        const entryId = uuid();
        await MathTreeDB.put('images', { id: entryId, blob: resized.blob });
        const entry = { id: entryId, branchId, title: result.title, latex: result.latex, createdAt: Date.now() };
        await MathTreeDB.put('entries', entry);
        state.entries.push(entry);
        next.status = 'done';
        renderTrayItem(next);
        render();
      } catch (err) {
        next.status = 'error';
        next.error = err.message || 'Échec de l\'analyse';
        renderTrayItem(next);
      }
    }
  } finally {
    state.processing = false;
  }
}

// ---------- Rendu : fil d'Ariane ----------

function renderBreadcrumb() {
  const path = pathTo(state.focusId);
  const container = $('breadcrumb');
  container.innerHTML = '';
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
    if (i !== path.length - 1) {
      btn.addEventListener('click', () => setFocus(node.id));
    }
    container.appendChild(btn);
  });
}

// ---------- Rendu : scène de l'arbre ----------

function renderTreeStage() {
  const stage = $('tree-stage');
  const nodesContainer = $('tree-nodes');
  const svg = $('branch-svg');
  nodesContainer.innerHTML = '';
  svg.innerHTML = '';

  const isRoot = state.focusId === ROOT_ID;
  const focusName = isRoot ? ROOT_NAME : (findBranch(state.focusId)?.name || ROOT_NAME);
  const branches = childBranches(state.focusId);
  const entries = childEntries(state.focusId);
  const total = branches.length + entries.length;

  $('empty-hint').classList.toggle('hidden', total !== 0);

  // Tronc (nœud courant), toujours ancré en bas au centre.
  let trunk = document.querySelector('.trunk-node');
  if (!trunk) {
    trunk = document.createElement('div');
    trunk.className = 'trunk-node';
    trunk.innerHTML = `
      <div class="trunk-bubble">${isRoot ? '🌳' : '🌿'}</div>
      <div class="trunk-label"></div>
      <div class="trunk-count"></div>
    `;
    nodesContainer.appendChild(trunk);
  } else {
    trunk.querySelector('.trunk-bubble').textContent = isRoot ? '🌳' : '🌿';
  }
  renderMathText(trunk.querySelector('.trunk-label'), focusName);
  const descendantCount = isRoot
    ? state.entries.length
    : countDescendantEntries(state.focusId);
  trunk.querySelector('.trunk-count').textContent =
    descendantCount === 0 ? 'Aucune feuille' : descendantCount + (descendantCount > 1 ? ' feuilles' : ' feuille');

  if (total === 0) return;

  const rect = stage.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const anchor = { x: width / 2, y: height - 88 };
  const radius = Math.max(140, Math.min(width * 0.4, height - 190, 320));
  const spreadDeg = Math.min(156, 30 + total * 16);
  const startDeg = total === 1 ? 0 : -spreadDeg / 2;
  const stepDeg = total === 1 ? 0 : spreadDeg / (total - 1);

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const items = [
    ...branches.map(b => ({ type: 'branch', data: b })),
    ...entries.map(e => ({ type: 'leaf', data: e })),
  ];

  items.forEach((item, i) => {
    const angleDeg = startDeg + stepDeg * i;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = anchor.x + radius * Math.sin(angleRad);
    const y = anchor.y - radius * Math.cos(angleRad);

    const bend = (i % 2 === 0 ? 1 : -1) * radius * 0.12;
    const midX = (anchor.x + x) / 2 + bend * Math.cos(angleRad);
    const midY = (anchor.y + y) / 2 + bend * Math.sin(angleRad);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${anchor.x} ${anchor.y} Q ${midX} ${midY} ${x} ${y}`);
    path.setAttribute('class', item.type === 'branch' ? 'to-branch' : 'to-leaf');
    svg.appendChild(path);

    const node = document.createElement('div');
    node.className = 'node ' + item.type;
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    node.style.animationDelay = (i * 0.03) + 's';

    if (item.type === 'branch') {
      const b = item.data;
      const count = countDescendantEntries(b.id);
      node.innerHTML = `
        <div class="bubble">
          <svg viewBox="0 0 24 24"><path d="M17 5a3 3 0 0 0-2.83 2H12a1 1 0 0 0-1 1v3H8.83A3 3 0 1 0 8 13.83V17a3 3 0 1 0 2 0v-5h2v2.17A3 3 0 1 0 14 14a3 3 0 0 0-1-2.24V9h2.17A3 3 0 1 0 17 5z"/></svg>
          <span class="count-badge">${count}</span>
        </div>
        <div class="label"></div>
      `;
      renderMathText(node.querySelector('.label'), b.name);
      node.addEventListener('click', () => setFocus(b.id));
    } else {
      const e = item.data;
      node.innerHTML = `
        <div class="bubble"><span class="leaf-fallback">📄</span></div>
        <div class="label"></div>
      `;
      renderMathText(node.querySelector('.label'), e.title);
      node.addEventListener('click', () => openEntryModal(e.id));
      getImageURL(e.id).then(url => {
        if (!url) return;
        const bubble = node.querySelector('.bubble');
        bubble.innerHTML = `<img src="${url}" alt="" />`;
      });
    }
    nodesContainer.appendChild(node);
  });
}

function render() {
  renderBreadcrumb();
  renderTreeStage();
}

function setFocus(id) {
  state.focusId = id;
  hideSearchResults();
  render();
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
      <div><div class="result-title"></div><div class="result-path">${path}</div></div>`;
    renderMathText(item.querySelector('.result-title'), b.name);
    item.addEventListener('click', () => {
      setFocus(b.id);
      $('search-input').value = '';
      hideSearchResults();
    });
    resultsEl.appendChild(item);
  });

  entryMatches.forEach(e => {
    const item = document.createElement('div');
    item.className = 'result-item';
    const path = pathTo(e.branchId).slice(1).map(n => n.name).join(' › ') || 'Racine';
    item.innerHTML = `<img alt="" /><div><div class="result-title"></div><div class="result-path">${path}</div></div>`;
    renderMathText(item.querySelector('.result-title'), e.title);
    getImageURL(e.id).then(url => { if (url) item.querySelector('img').src = url; });
    item.addEventListener('click', () => {
      setFocus(e.branchId);
      $('search-input').value = '';
      hideSearchResults();
      setTimeout(() => openEntryModal(e.id), 250);
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

  const idMap = new Map();
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
  state.focusId = ROOT_ID;
  await ensureSeed();
  await loadData();
  render();
  closeModals();
  showToast('Tout a été effacé.');
}

// ---------- Liaison des événements ----------

function bindEvents() {
  $('btn-home').addEventListener('click', () => setFocus(ROOT_ID));
  $('btn-add').addEventListener('click', () => $('file-input').click());

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

  $('btn-settings').addEventListener('click', openSettings);
  $('btn-save-settings').addEventListener('click', saveSettings);

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

  $('btn-export').addEventListener('click', exportData);
  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) importData(file);
    e.target.value = '';
  });
  $('btn-reset-all').addEventListener('click', resetAll);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderTreeStage, 120);
  });

  const stage = $('tree-stage');
  stage.addEventListener('dragover', e => { e.preventDefault(); });
  stage.addEventListener('drop', e => {
    e.preventDefault();
    Array.from(e.dataTransfer.files || []).forEach(enqueueUpload);
  });
  document.addEventListener('paste', e => {
    const items = Array.from(e.clipboardData?.items || []);
    items.forEach(it => {
      if (it.kind === 'file' && it.type.startsWith('image/')) enqueueUpload(it.getAsFile());
    });
  });
}

// ---------- Démarrage ----------

async function init() {
  loadSettings();
  await ensureSeed();
  await loadData();
  bindEvents();
  render();
  if (!state.apiKey) {
    showToast('Ajoute ta clé API Anthropic dans les réglages pour commencer.', 4000);
  }
}

init();
