// Leonida Cover Lab — the editor.
//
// Wires the control panel to the render engine in ./cover.js: photo slots (bundled samples or the reader's own
// files, read locally and never uploaded), layouts, grades, lettering and PNG export. A `?shot=` query instead
// stages a fixed scene for the entry's screenshots: `?shot=cover` paints only the cover, exactly as exported,
// and `?shot=editor` opens the editor in a chosen state. Either way window.__shotReady is set once painted.

import { renderCover, panelAt, SIZES, LAYOUTS, GRADES } from './cover.js';

export const SAMPLES = [
  { name: 'highway', label: 'Coast Highway' },
  { name: 'boulevard', label: 'Boulevard' },
  { name: 'neon', label: 'Neon Rain' },
  { name: 'pier', label: 'The Pier' },
];

const emptySlot = () => ({ img: null, name: '', panX: 0, panY: 0, zoom: 1 });

export const state = {
  size: '1920x1080',
  layout: 'hero',
  grade: 'vice',
  intensity: 0.85,
  halftone: true,
  vignette: true,
  gutter: 'dark',
  mode: 'multi',
  active: 0,
  caption: 'LEONIDA NIGHTS',
  sub: 'WELCOME TO THE NEON COAST',
  sticker: 'LEONIDA',
  stickerAngle: -12,
  photos: [emptySlot(), emptySlot(), emptySlot(), emptySlot()],
};

const canvas = document.getElementById('cover');
const status = document.getElementById('status');

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function redraw() {
  const { w, h } = SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  renderCover(canvas, state);
  syncControls();
}

/** Marks the active choices in the panel so the editor always shows the state it is painting. */
function syncControls() {
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('on', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
  document.querySelectorAll('[data-panel]').forEach((b) => {
    const i = Number(b.dataset.panel);
    b.classList.toggle('on', i === state.active);
    b.disabled = state.mode === 'multi' && i >= LAYOUTS[state.layout].panels;
  });
  const slot = state.photos[state.active];
  document.getElementById('zoom').value = slot ? slot.zoom : 1;
  document.getElementById('activeName').textContent = slot && slot.name
    ? `Panel ${state.active + 1} · ${slot.name}`
    : `Panel ${state.active + 1} · empty`;
}

async function assignSample(index, name) {
  const img = await loadImage(`samples/${name}.jpg`);
  state.photos[index] = { img, name, panX: 0, panY: 0, zoom: 1 };
  redraw();
}

function buildPanel() {
  const samples = document.getElementById('samples');
  for (const s of SAMPLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sample';
    b.innerHTML = `<img src="samples/${s.name}.jpg" alt=""><span>${s.label}</span>`;
    b.addEventListener('click', () => assignSample(state.active, s.name));
    samples.appendChild(b);
  }
  document.querySelectorAll('[data-layout]').forEach((b) =>
    b.addEventListener('click', () => { state.layout = b.dataset.layout; redraw(); }));
  document.querySelectorAll('[data-grade]').forEach((b) =>
    b.addEventListener('click', () => { state.grade = b.dataset.grade; redraw(); }));
  document.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => { state.mode = b.dataset.mode; redraw(); }));
  document.querySelectorAll('[data-panel]').forEach((b) =>
    b.addEventListener('click', () => { state.active = Number(b.dataset.panel); redraw(); }));

  document.getElementById('upload').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    let at = state.active;
    for (const file of files) {
      if (at > 3) break;
      const img = await loadImage(URL.createObjectURL(file));
      state.photos[at] = { img, name: file.name, panX: 0, panY: 0, zoom: 1 };
      at += 1;
    }
    if (files.length) status.textContent = 'Photos stay on this device — nothing is uploaded.';
    redraw();
  });
  document.getElementById('zoom').addEventListener('input', (e) => {
    state.photos[state.active].zoom = Number(e.target.value);
    redraw();
  });
  document.getElementById('intensity').addEventListener('input', (e) => { state.intensity = Number(e.target.value); redraw(); });
  document.getElementById('gutter').addEventListener('change', (e) => { state.gutter = e.target.value; redraw(); });
  document.getElementById('halftone').addEventListener('change', (e) => { state.halftone = e.target.checked; redraw(); });
  document.getElementById('vignette').addEventListener('change', (e) => { state.vignette = e.target.checked; redraw(); });
  document.getElementById('caption').addEventListener('input', (e) => { state.caption = e.target.value; redraw(); });
  document.getElementById('sub').addEventListener('input', (e) => { state.sub = e.target.value; redraw(); });
  document.getElementById('sticker').addEventListener('input', (e) => { state.sticker = e.target.value; redraw(); });
  document.getElementById('angle').addEventListener('input', (e) => { state.stickerAngle = Number(e.target.value); redraw(); });
  document.getElementById('size').addEventListener('change', (e) => { state.size = e.target.value; redraw(); });
  document.getElementById('export').addEventListener('click', () => {
    redraw();
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `cover-${state.size}.png`;
      a.click();
      status.textContent = `Saved cover-${state.size}.png`;
    }, 'image/png');
  });

  // Dragging the preview pans the photo under the pointer; in multi mode it also selects that panel.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const y = ((e.clientY - r.top) / r.height) * canvas.height;
    if (state.mode === 'multi') {
      const p = panelAt(state.layout, canvas.width, canvas.height, x, y);
      if (p >= 0) state.active = p;
    }
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const slot = state.photos[state.active];
    if (!slot || !slot.img) return;
    const r = canvas.getBoundingClientRect();
    slot.panX = Math.min(1, Math.max(-1, slot.panX + ((e.clientX - drag.x) / r.width) * 2.2));
    slot.panY = Math.min(1, Math.max(-1, slot.panY + ((e.clientY - drag.y) / r.height) * 2.2));
    drag = { x: e.clientX, y: e.clientY };
    redraw();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
}

/** Applies a staging query (or the editor's defaults) to the state, then paints. */
async function applyQuery(q) {
  if (q.get('size') && SIZES[q.get('size')]) state.size = q.get('size');
  if (q.get('layout') && LAYOUTS[q.get('layout')]) state.layout = q.get('layout');
  if (q.get('grade') && GRADES[q.get('grade')]) state.grade = q.get('grade');
  if (q.get('caption') !== null) state.caption = q.get('caption');
  if (q.get('sub') !== null) state.sub = q.get('sub');
  if (q.get('sticker') !== null) state.sticker = q.get('sticker');
  if (q.get('angle') !== null) state.stickerAngle = Number(q.get('angle'));
  if (q.get('intensity') !== null) state.intensity = Number(q.get('intensity'));
  if (q.get('gutter')) state.gutter = q.get('gutter');
  if (q.get('halftone') !== null) state.halftone = q.get('halftone') !== '0';
  if (q.get('vignette') !== null) state.vignette = q.get('vignette') !== '0';
  const names = (q.get('photo') ?? 'highway,boulevard,neon,pier').split(',').map((s) => s.trim()).filter(Boolean);
  state.mode = q.get('mode') ?? (names.length > 1 ? 'multi' : 'spread');
  const panXs = (q.get('panx') ?? '').split(',').map((s) => Number(s) || 0);
  const panYs = (q.get('pany') ?? '').split(',').map((s) => Number(s) || 0);
  for (let i = 0; i < Math.min(4, names.length); i++) {
    try {
      const img = await loadImage(`samples/${names[i]}.jpg`);
      state.photos[i] = { img, name: names[i], panX: panXs[i] ?? 0, panY: panYs[i] ?? 0, zoom: 1 };
    } catch { /* an unknown sample name leaves the slot empty */ }
  }
  state.active = 0;
}

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
buildPanel();
if (shot === 'cover') document.body.classList.add('shot-cover');
await applyQuery(query);
// Reflect the staged state in the panel's fields, so an editor screenshot shows a coherent tool.
document.getElementById('caption').value = state.caption;
document.getElementById('sub').value = state.sub;
document.getElementById('sticker').value = state.sticker;
document.getElementById('size').value = state.size;
document.getElementById('gutter').value = state.gutter;
document.getElementById('intensity').value = state.intensity;
document.getElementById('angle').value = state.stickerAngle;
document.getElementById('halftone').checked = state.halftone;
document.getElementById('vignette').checked = state.vignette;
redraw();
if (shot) requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
