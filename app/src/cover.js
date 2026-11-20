// Leonida Cover Lab — the render engine.
//
// One function, renderCover(canvas, state), paints a complete poster-style cover at the canvas's own size. It
// backs the editor preview, the cover-only staging view and the full-resolution PNG export, so the cover you
// see is byte-for-byte the cover you export. Everything is drawn from the photos and words in `state` with the
// 2D canvas API: panel layouts, canvas-filter colour grades, gradient washes, a halftone dot screen, a vignette,
// stroked caption lettering and a starburst sticker. No image, font or script is ever fetched.

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape · 1920 × 1080' },
};

export const LAYOUTS = {
  hero: { label: 'Hero Grid', panels: 4 },
  quad: { label: 'Classic Quad', panels: 4 },
  diagonal: { label: 'Diagonal', panels: 3 },
  strips: { label: 'Strips', panels: 3 },
};

// Each grade is a canvas filter string plus a two-stop colour wash laid over the panels, an accent colour used
// by the subtitle and gutters, a scrim colour that keeps the lettering readable, the caption's lower fill stop
// and the sticker's burst colours.
export const GRADES = {
  vice: {
    label: 'Vice Sunset',
    filter: 'saturate(1.38) contrast(1.09) brightness(1.03) hue-rotate(-9deg)',
    wash: ['rgba(58, 0, 92, 0.30)', 'rgba(255, 64, 120, 0.34)'],
    accent: '#ff5ea8', scrim: 'rgba(24, 2, 26, 0.60)', fillTo: '#ffb3d1',
    burst: ['#ffe259', '#ff7518', '#1d0b16'],
  },
  neon: {
    label: 'Neon Night',
    filter: 'saturate(1.55) contrast(1.16) brightness(0.99) hue-rotate(7deg)',
    wash: ['rgba(0, 64, 86, 0.32)', 'rgba(214, 0, 160, 0.30)'],
    accent: '#2ee6da', scrim: 'rgba(2, 10, 24, 0.64)', fillTo: '#b8fff8',
    burst: ['#a8fff4', '#00b3a4', '#04202a'],
  },
  golden: {
    label: 'Golden Hour',
    filter: 'sepia(0.32) saturate(1.32) contrast(1.06) brightness(1.06)',
    wash: ['rgba(120, 52, 0, 0.22)', 'rgba(255, 150, 40, 0.30)'],
    accent: '#ffb52e', scrim: 'rgba(30, 12, 0, 0.52)', fillTo: '#ffe1a8',
    burst: ['#fff3b0', '#ff9e2c', '#2a1402'],
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(1) contrast(1.32) brightness(1.03)',
    wash: ['rgba(0, 0, 0, 0.16)', 'rgba(0, 0, 0, 0.44)'],
    accent: '#f2f2f2', scrim: 'rgba(0, 0, 0, 0.66)', fillTo: '#d9d9d9',
    burst: ['#f7f7f7', '#9a9a9a', '#101010'],
  },
};

const FONT = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** The panel polygons of a layout, in pixel space, bleeding to the canvas edges with gutters between panels. */
export function panelPolys(layout, W, H) {
  const g = Math.max(8, Math.round(W * 0.014));
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  switch (layout) {
    case 'quad': {
      const pw = (W - g) / 2, ph = (H - g) / 2;
      return [rect(0, 0, pw, ph), rect(pw + g, 0, pw, ph), rect(0, ph + g, pw, ph), rect(pw + g, ph + g, pw, ph)];
    }
    case 'strips': {
      const pw = (W - 2 * g) / 3;
      return [rect(0, 0, pw, H), rect(pw + g, 0, pw, H), rect(2 * (pw + g), 0, pw, H)];
    }
    case 'diagonal': {
      // Three panels split by two slanted dividers; the gutters are stroked over the shared edges afterwards.
      return [
        [[0, 0], [0.40 * W, 0], [0.22 * W, H], [0, H]],
        [[0.40 * W, 0], [0.74 * W, 0], [0.56 * W, H], [0.22 * W, H]],
        [[0.74 * W, 0], [W, 0], [W, H], [0.56 * W, H]],
      ];
    }
    case 'hero':
    default: {
      const bigW = Math.round(W * 0.64);
      const x0 = bigW + g, pw = W - x0, ph = (H - 2 * g) / 3;
      return [rect(0, 0, bigW, H), rect(x0, 0, pw, ph), rect(x0, ph + g, pw, ph), rect(x0, 2 * (ph + g), pw, ph)];
    }
  }
}

function bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function tracePath(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Index of the panel containing point (x, y), or -1: lets the editor pan the photo under the pointer. */
export function panelAt(layout, W, H, x, y) {
  const polys = panelPolys(layout, W, H);
  for (let i = 0; i < polys.length; i++) {
    const p = polys[i];
    let inside = false;
    for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
      const [ax, ay] = p[a], [bx, by] = p[b];
      if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    }
    if (inside) return i;
  }
  return -1;
}

/** Draws one photo cover-fitted into a box, honouring pan (-1..1) and zoom (>= 1), with the grade blended in. */
function drawPhotoInto(ctx, img, box, slot, grade, intensity) {
  const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) * (slot.zoom || 1);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  const dx = box.x + (box.w - dw) / 2 + (slot.panX || 0) * Math.max(0, (dw - box.w) / 2);
  const dy = box.y + (box.h - dh) / 2 + (slot.panY || 0) * Math.max(0, (dh - box.h) / 2);
  ctx.drawImage(img, dx, dy, dw, dh);
  if (intensity > 0.01) {
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.filter = grade.filter;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }
}

function fillPlaceholder(ctx, poly, W, H) {
  const b = bbox(poly);
  const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
  grad.addColorStop(0, '#2a1846');
  grad.addColorStop(1, '#120a20');
  ctx.fillStyle = grad;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = Math.max(6, W * 0.008);
  const step = Math.max(28, W * 0.035);
  ctx.beginPath();
  for (let x = b.x - b.h; x < b.x + b.w; x += step) { ctx.moveTo(x, b.y + b.h); ctx.lineTo(x + b.h, b.y); }
  ctx.stroke();
  ctx.restore();
}

function applyWash(ctx, W, H, grade, intensity) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, grade.wash[0]);
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, grade.wash[1]);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.9 * intensity;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function applyHalftone(ctx, W, H) {
  const s = Math.max(6, Math.round(W * 0.0075));
  const dot = document.createElement('canvas');
  dot.width = dot.height = s;
  const dctx = dot.getContext('2d');
  const r = s * 0.17;
  const grad = dctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, r);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  dctx.fillStyle = grad;
  dctx.beginPath();
  dctx.arc(s / 2, s / 2, r, 0, Math.PI * 2);
  dctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = ctx.createPattern(dot, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function applyVignette(ctx, W, H) {
  const rad = Math.hypot(W, H) / 2;
  const grad = ctx.createRadialGradient(W / 2, H / 2, rad * 0.45, W / 2, H / 2, rad * 1.02);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(4, 0, 10, 0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

/** Splits a caption into one or two balanced lines so it can stay big instead of shrinking to fit. */
function wrapCaption(ctx, text, maxWidth, baseSize) {
  const setFont = (s) => { ctx.font = `900 ${s}px ${FONT}`; };
  setFont(baseSize);
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(/\s+/);
  if (words.length < 2) return [text];
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const w = Math.max(ctx.measureText(lines[0]).width, ctx.measureText(lines[1]).width);
    if (!best || w < best.w) best = { lines, w };
  }
  return best.lines;
}

function drawLettering(ctx, W, H, state, grade) {
  const caption = (state.caption || '').trim().toUpperCase();
  const sub = (state.sub || '').trim().toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const minDim = Math.min(W, H);

  if (sub) {
    const size = minDim * 0.031;
    ctx.font = `700 ${size}px ${FONT}`;
    try { ctx.letterSpacing = `${size * 0.30}px`; } catch { /* older engines ignore it */ }
    const tw = ctx.measureText(sub).width;
    const y = H * 0.955;
    ctx.fillStyle = grade.accent;
    ctx.fillText(sub, W / 2, y);
    const lineLen = Math.min(W * 0.10, (W - tw) / 2 - size * 1.2);
    if (lineLen > size) {
      ctx.fillRect(W / 2 - tw / 2 - lineLen - size * 0.7, y - size * 0.32, lineLen, Math.max(2, size * 0.14));
      ctx.fillRect(W / 2 + tw / 2 + size * 0.7, y - size * 0.32, lineLen, Math.max(2, size * 0.14));
    }
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }
  if (!caption) return;

  const maxWidth = W * 0.92;
  let size = minDim * 0.128;
  const lines = wrapCaption(ctx, caption, maxWidth, size);
  ctx.font = `900 ${size}px ${FONT}`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  if (widest > maxWidth) {
    size *= maxWidth / widest;
    ctx.font = `900 ${size}px ${FONT}`;
  }
  const lineHeight = size * 1.04;
  const subFoot = sub ? minDim * 0.108 : minDim * 0.028;
  let baseline = H - subFoot - (lines.length - 1) * lineHeight;
  for (const line of lines) {
    ctx.save();
    ctx.translate(W / 2, baseline);
    ctx.transform(1, 0, -0.055, 1, 0, 0);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = size * 0.17;
    ctx.strokeStyle = '#150818';
    ctx.strokeText(line, 0, 0);
    const grad = ctx.createLinearGradient(0, -size, 0, size * 0.12);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, grade.fillTo);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = size * 0.10;
    ctx.shadowOffsetY = size * 0.035;
    ctx.fillText(line, 0, 0);
    ctx.restore();
    baseline += lineHeight;
  }
}

function drawSticker(ctx, W, H, state, grade) {
  const text = (state.sticker || '').trim().toUpperCase();
  if (!text) return;
  const R = Math.min(W, H) * 0.112;
  const cx = W - R * 1.22, cy = R * 1.22;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((state.stickerAngle ?? -12) * Math.PI) / 180);
  const spikes = 16;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? R : R * 0.83;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(-R * 0.2, -R * 0.2, R * 0.1, 0, 0, R);
  grad.addColorStop(0, grade.burst[0]);
  grad.addColorStop(1, grade.burst[1]);
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = R * 0.12;
  ctx.shadowOffsetY = R * 0.05;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = R * 0.045;
  ctx.strokeStyle = '#150818';
  ctx.stroke();
  ctx.beginPath();
  ctx.setLineDash([R * 0.07, R * 0.055]);
  ctx.arc(0, 0, R * 0.68, 0, Math.PI * 2);
  ctx.lineWidth = R * 0.028;
  ctx.strokeStyle = 'rgba(21, 8, 24, 0.35)';
  ctx.stroke();
  ctx.setLineDash([]);
  let size = R * 0.40;
  ctx.font = `900 ${size}px ${FONT}`;
  const tw = ctx.measureText(text).width;
  if (tw > R * 1.30) {
    size *= (R * 1.30) / tw;
    ctx.font = `900 ${size}px ${FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = grade.burst[2];
  ctx.fillText(text, 0, size * 0.04);
  ctx.restore();
}

/** Paints the whole cover described by `state` onto `canvas` at the canvas's own size. */
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.vice;
  const intensity = clamp(state.intensity ?? 0.85, 0, 1);
  const gutter = state.gutter === 'light' ? '#f5f2ee' : state.gutter === 'accent' ? grade.accent : '#0c0614';
  ctx.fillStyle = gutter;
  ctx.fillRect(0, 0, W, H);

  const polys = panelPolys(state.layout, W, H);
  const slots = state.photos ?? [];
  const usable = (s) => s && s.img && s.img.naturalWidth > 0;

  if (state.mode === 'spread') {
    const slot = slots[state.active ?? 0] ?? slots[0];
    if (usable(slot)) {
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      drawPhotoInto(off.getContext('2d'), slot.img, { x: 0, y: 0, w: W, h: H }, slot, grade, intensity);
      for (const poly of polys) {
        ctx.save();
        tracePath(ctx, poly);
        ctx.clip();
        ctx.drawImage(off, 0, 0);
        ctx.restore();
      }
    } else {
      for (const poly of polys) { ctx.save(); tracePath(ctx, poly); ctx.clip(); fillPlaceholder(ctx, poly, W, H); ctx.restore(); }
    }
  } else {
    polys.forEach((poly, i) => {
      const slot = slots[i];
      ctx.save();
      tracePath(ctx, poly);
      ctx.clip();
      if (usable(slot)) drawPhotoInto(ctx, slot.img, bbox(poly), slot, grade, intensity);
      else fillPlaceholder(ctx, poly, W, H);
      ctx.restore();
    });
  }

  if (state.layout === 'diagonal') {
    const g = Math.max(8, Math.round(W * 0.014));
    ctx.strokeStyle = gutter;
    ctx.lineWidth = g * 1.7;
    ctx.beginPath();
    ctx.moveTo(0.40 * W, 0); ctx.lineTo(0.22 * W, H);
    ctx.moveTo(0.74 * W, 0); ctx.lineTo(0.56 * W, H);
    ctx.stroke();
    ctx.lineWidth = g;
    ctx.strokeRect(0, 0, W, H);
  }

  applyWash(ctx, W, H, grade, intensity);
  if (state.halftone) applyHalftone(ctx, W, H);
  if (state.vignette) applyVignette(ctx, W, H);

  // A scrim rising from the foot keeps the lettering readable over any photo.
  const scrim = ctx.createLinearGradient(0, H * 0.55, 0, H);
  scrim.addColorStop(0, 'rgba(0, 0, 0, 0)');
  scrim.addColorStop(1, grade.scrim);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  drawLettering(ctx, W, H, state, grade);
  drawSticker(ctx, W, H, state, grade);
}
