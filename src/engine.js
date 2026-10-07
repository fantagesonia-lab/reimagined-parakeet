// Pixie Closet — pixel compositing engine.
// Everything is drawn into a CW x CH RGBA buffer. Garments are masks that are
// shaded from the reference body's own shading, so clothes hug its contours.

const CW = 128, CH = 176, FEET_Y = 166;
const INK = [45, 11, 6]; // outline brown from the reference

// Landmarks are in each sprite's local pixel coordinates.
const VIEWS = {
  front: {
    cx: 40, headCx: 40, headBottom: 66, torsoTop: 67, chestY: 78, waistY: 92, hipY: 96,
    crotchY: 101, kneeY: 109, footY: 116, handY: 89, sleeveShort: 80, sleeveLong: 90,
    torsoL: 25, torsoR: 55, neck: [40, 66], hand: [64, 97], eyes: [[23, 49], [57, 49]],
    arms: [
      [[20, 66], [30, 70], [29, 88], [25, 92], [25, 106], [5, 106], [5, 86], [14, 76]],
      [[60, 66], [50, 70], [51, 88], [55, 92], [55, 106], [75, 106], [75, 86], [66, 76]],
    ],
    eyeBoxes: [[14, 38, 32, 60], [48, 38, 66, 60]],
  },
  side: {
    cx: 35, headCx: 35, headBottom: 68, torsoTop: 70, chestY: 80, waistY: 92, hipY: 97,
    crotchY: 104, kneeY: 111, footY: 119, handY: 92, sleeveShort: 82, sleeveLong: 92,
    torsoL: 21, torsoR: 50, neck: [31, 69], hand: [43, 99], eyes: [[19, 51]],
    arms: [[[30, 72], [46, 72], [49, 88], [53, 93], [53, 106], [33, 106], [34, 92], [31, 80]]],
    eyeBoxes: [[11, 40, 29, 62]],
  },
  back: {
    cx: 40, headCx: 40, headBottom: 66, torsoTop: 67, chestY: 78, waistY: 92, hipY: 96,
    crotchY: 101, kneeY: 109, footY: 116, handY: 89, sleeveShort: 80, sleeveLong: 90,
    torsoL: 25, torsoR: 55, neck: [40, 65], hand: [16, 97], eyes: [],
    arms: [
      [[20, 66], [30, 70], [29, 88], [25, 92], [25, 106], [5, 106], [5, 86], [14, 76]],
      [[60, 66], [50, 70], [51, 88], [55, 92], [55, 106], [75, 106], [75, 86], [66, 76]],
    ],
    eyeBoxes: [],
  },
};

// ---------- colour helpers ----------
function hexRgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
// Ramp: [highlight, base, shade, deep]. Shadows drift toward purple, highlights toward warm white.
function ramp(hex) {
  const c = typeof hex === 'string' ? hexRgb(hex) : hex;
  const hi = mix(c, [255, 250, 240], 0.38);
  const sh = [c[0] * 0.8, c[1] * 0.74, c[2] * 0.82 + 12].map(clamp);
  const dp = [c[0] * 0.6, c[1] * 0.52, c[2] * 0.66 + 16].map(clamp);
  return [hi, c.slice(), sh, dp];
}
function lineColor(r) { return mix(r[3], INK, 0.62); }

// ---------- body ----------
const BODY = {};
const PAL = BODY_PALETTE.map(hexRgb);
const SKIN_BASE = hexRgb('#fde6d4');
for (const name of ['front', 'side', 'back']) {
  const s = BODY_SPRITES[name], V = VIEWS[name];
  const idx = new Int8Array(s.w * s.h);
  s.rows.forEach((row, y) => { for (let x = 0; x < s.w; x++) idx[y * s.w + x] = row[x] === '.' ? -1 : row.charCodeAt(x) - 97; });
  V.w = s.w; V.h = s.h; V.ox = 64 - V.cx; V.oy = FEET_Y - s.h;
  BODY[name] = idx;
}
function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Body part per local pixel, computed once.
const PARTS = {};
for (const name of ['front', 'side', 'back']) {
  const V = VIEWS[name], idx = BODY[name], p = new Array(V.w * V.h).fill(null);
  for (let y = 0; y < V.h; y++) for (let x = 0; x < V.w; x++) {
    if (idx[y * V.w + x] < 0) continue;
    let part;
    if (y <= V.headBottom) part = 'head';
    else if (V.arms.some(a => pointInPoly(x + .5, y + .5, a))) part = y >= V.handY ? 'hand' : 'arm';
    else if (y >= V.footY) part = 'foot';
    else if (y >= V.crotchY) part = 'leg';
    else part = 'torso';
    p[y * V.w + x] = part;
  }
  PARTS[name] = p;
}

const SKIN_TONES = [
  { name: 'Porcelain', hex: '#fde6d4' }, { name: 'Peach', hex: '#f8d2b4' },
  { name: 'Honey', hex: '#e8b48f' }, { name: 'Caramel', hex: '#c98d65' },
  { name: 'Cocoa', hex: '#9a6446' }, { name: 'Ebony', hex: '#6e432e' },
  { name: 'Lilac Elf', hex: '#e6d6f6' }, { name: 'Mint Sprite', hex: '#cfeedd' },
];
const EYE_COLORS = [
  { name: 'Cocoa', c: ['#5c3228', '#7c5246', '#a47364'] },
  { name: 'Sky', c: ['#1f3f7a', '#3d74c9', '#86b6ee'] },
  { name: 'Leaf', c: ['#1f5132', '#3a8a55', '#86cf8f'] },
  { name: 'Violet', c: ['#3e2470', '#6a46b8', '#a98be6'] },
  { name: 'Ruby', c: ['#6b1626', '#b53246', '#ec7e8c'] },
  { name: 'Amber', c: ['#6a3c0e', '#b9761c', '#efbd5b'] },
  { name: 'Rose', c: ['#7a2856', '#cc5a92', '#f6a3c8'] },
  { name: 'Ash', c: ['#2c3038', '#5d6574', '#a5acb8'] },
];

// ---------- masks ----------
class Mask {
  constructor(V) { this.V = V; this.a = new Uint8Array(CW * CH); }
  i(x, y) { x = Math.round(x) + this.V.ox; y = Math.round(y) + this.V.oy; return (x < 0 || y < 0 || x >= CW || y >= CH) ? -1 : y * CW + x; }
  set(x, y) { const i = this.i(x, y); if (i >= 0) this.a[i] = 1; return this; }
  has(x, y) { const i = this.i(x, y); return i >= 0 && this.a[i] === 1; }
  each(fn) { const { ox, oy } = this.V; for (let i = 0; i < this.a.length; i++) if (this.a[i]) fn(i % CW - ox, (i / CW | 0) - oy, i); }
  rect(x0, y0, x1, y1) { for (let y = Math.round(y0); y <= y1; y++) for (let x = Math.round(x0); x <= x1; x++) this.set(x, y); return this; }
  ellipse(cx, cy, rx, ry) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx + .35), dy = (y - cy) / (ry + .35); if (dx * dx + dy * dy <= 1) this.set(x, y);
    }
    return this;
  }
  poly(pts) {
    const ys = pts.map(p => p[1]), xs = pts.map(p => p[0]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++)
        if (pointInPoly(x + .5, y + .5, pts)) this.set(x, y);
    return this;
  }
  line(x0, y0, x1, y1, w = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let s = 0; s <= n; s++) {
      const x = x0 + (x1 - x0) * s / n, y = y0 + (y1 - y0) * s / n;
      if (w <= 1) this.set(x, y); else this.ellipse(x, y, (w - 1) / 2, (w - 1) / 2);
    }
    return this;
  }
  add(m) { for (let i = 0; i < this.a.length; i++) if (m.a[i]) this.a[i] = 1; return this; }
  sub(m) { for (let i = 0; i < this.a.length; i++) if (m.a[i]) this.a[i] = 0; return this; }
  and(m) { for (let i = 0; i < this.a.length; i++) if (!m.a[i]) this.a[i] = 0; return this; }
  keep(fn) { this.each((x, y, i) => { if (!fn(x, y)) this.a[i] = 0; }); return this; }
  clone() { const m = new Mask(this.V); m.a.set(this.a); return m; }
  dilate(n = 1) {
    for (let k = 0; k < n; k++) {
      const b = this.a.slice();
      for (let i = 0; i < b.length; i++) if (b[i]) {
        const x = i % CW; if (x > 0) this.a[i - 1] = 1; if (x < CW - 1) this.a[i + 1] = 1;
        if (i >= CW) this.a[i - CW] = 1; if (i < b.length - CW) this.a[i + CW] = 1;
      }
    }
    return this;
  }
  mirror() { // mirror around the view centre line (cx), used by symmetric front/back shapes
    const m = new Mask(this.V), c2 = this.V.cx * 2; this.each((x, y) => m.set(c2 - x, y)); return this.add(m);
  }
  empty() { return !this.a.some(v => v); }
}

// ---------- renderer ----------
class Renderer {
  constructor(view, state, opts = {}) {
    this.view = view; this.V = VIEWS[view]; this.state = state;
    this.buf = new Uint8ClampedArray(CW * CH * 4);
    this.blink = !!opts.blink;
  }
  M() { return new Mask(this.V); }
  bodyIdx(x, y) { const V = this.V; return (x < 0 || y < 0 || x >= V.w || y >= V.h) ? -1 : BODY[this.view][y * V.w + x]; }
  part(x, y) { const V = this.V; return (x < 0 || y < 0 || x >= V.w || y >= V.h) ? null : PARTS[this.view][y * V.w + x]; }
  body(pred) { // mask of body pixels whose part/pos satisfies pred
    const m = this.M(), V = this.V;
    for (let y = 0; y < V.h; y++) for (let x = 0; x < V.w; x++) { const p = this.part(x, y); if (p && pred(x, y, p)) m.set(x, y); }
    return m;
  }
  put(i, c, a = 255) {
    const o = i * 4;
    if (a >= 255) { this.buf[o] = c[0]; this.buf[o + 1] = c[1]; this.buf[o + 2] = c[2]; this.buf[o + 3] = 255; return; }
    const t = a / 255, ba = this.buf[o + 3] / 255, na = t + ba * (1 - t);
    for (let k = 0; k < 3; k++) this.buf[o + k] = (c[k] * t + this.buf[o + k] * ba * (1 - t)) / (na || 1);
    this.buf[o + 3] = na * 255;
  }

  drawBody() {
    const V = this.V, st = this.state;
    const skin = hexRgb(SKIN_TONES[st.skin]?.hex || SKIN_TONES[0].hex);
    const ratio = skin.map((v, k) => v / SKIN_BASE[k]);
    const eye = EYE_COLORS[st.eyes] || EYE_COLORS[0];
    const eyeC = eye.c.map(hexRgb);
    const inEye = (x, y) => V.eyeBoxes.some(b => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
    for (let y = 0; y < V.h; y++) for (let x = 0; x < V.w; x++) {
      let k = this.bodyIdx(x, y); if (k < 0) continue;
      const i = (y + V.oy) * CW + x + V.ox;
      let c;
      if (inEye(x, y) && k >= 2 && k <= 4) c = eyeC[k - 2];
      else if (k <= 1) c = PAL[k];
      else if (k <= 4) c = PAL[k];
      else c = PAL[k].map((v, j) => clamp(v * ratio[j]));
      this.put(i, c);
    }
    if (this.blink && V.eyeBoxes.length) this.drawBlink(skin, ratio);
  }
  drawBlink(skin, ratio) {
    const V = this.V, lid = PAL[13].map((v, j) => clamp(v * ratio[j]));
    const lidSh = PAL[9].map((v, j) => clamp(v * ratio[j]));
    for (const b of V.eyeBoxes) {
      const m = this.M();
      for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) {
        const k = this.bodyIdx(x, y); if (k < 0) continue;
        if (k <= 4 || k === 15 || k === 6) m.set(x, y);
      }
      // keep the face outline (head silhouette) intact in side view
      m.keep((x, y) => this.bodyIdx(x - 1, y) >= 0 && this.bodyIdx(x + 1, y) >= 0);
      m.each((x, y, i) => this.put(i, y > (b[1] + b[3]) / 2 + 3 ? lidSh : lid));
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2 + 3, hw = (b[2] - b[0]) / 2 - 2;
      const L = this.M();
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const t = (x - cx) / hw; L.set(x, Math.round(cy + 1 - 2 * t * t)); L.set(x, Math.round(cy - 2 * t * t));
      }
      L.each((x, y, i) => this.put(i, PAL[0]));
    }
  }

  // Paint a mask with a colour ramp.
  //  opts.lines  — keep the body's own dark contour lines inside the mask (arm/torso seams, leg gap)
  //  opts.pattern(x,y) -> truthy: use opts.alt ramp for that pixel
  //  opts.flat   — skip body-based shading
  //  opts.noOutline, opts.alpha
  paint(mask, r, opts = {}) {
    if (mask.empty()) return;
    const D = new Uint8Array(CW * CH), a = mask.a;
    for (let i = 0; i < a.length; i++) if (a[i]) {
      const x = i % CW;
      if (x === 0 || x === CW - 1 || !a[i - 1] || !a[i + 1] || !a[i - CW] || !a[i + CW]) D[i] = 1;
    }
    for (let d = 2; d <= 3; d++) for (let i = 0; i < a.length; i++) if (a[i] && !D[i]) {
      if (D[i - 1] === d - 1 || D[i + 1] === d - 1 || D[i - CW] === d - 1 || D[i + CW] === d - 1) D[i] = d;
    }
    const out = opts.outline || lineColor(r);
    const has = (x, y) => mask.has(x, y);
    mask.each((x, y, i) => {
      const d = D[i] || 4;
      let c;
      if (d === 1 && !opts.noOutline) c = out;
      else {
        const k = this.bodyIdx(x, y);
        const R = opts.pattern && opts.pattern(x, y) ? (opts.alt || r) : r;
        if (opts.lines && k >= 0 && k <= 2) c = out;
        else {
          let tone;
          if (k >= 5 && !opts.flat && (!opts.headOnly || this.part(x, y) === 'head')) tone = k === 15 ? 0 : k === 5 ? 3 : k <= 8 ? 2 : 1;
          else {
            tone = 1;
            if (!has(x + 2, y) || !has(x, y + 2)) tone = 2;
            if (d === 2 && (!has(x + 1, y) || !has(x, y + 1) || !has(x + 2, y) || !has(x, y + 2))) tone = 3;
            else if (d >= 3 && !has(x - 3, y) && has(x + 3, y) && !has(x, y - 3)) tone = 0;
          }
          c = R[tone];
        }
      }
      this.put(i, c, opts.alpha ?? 255);
    });
  }
  // solid fill (details: buttons, gems, laces)
  fill(mask, c, alpha) { mask.each((x, y, i) => this.put(i, typeof c === 'string' ? hexRgb(c) : c, alpha)); }
  outline(mask, c = INK) { // 1px outline around the outside of a mask
    const o = mask.clone().dilate(1).sub(mask); this.fill(o, c);
  }
}

// Render the full character for a view. Items come from ITEMS (items.js).
const BEHIND_ORDER = ['back', 'hair', 'hand'];
const FRONT_ORDER = ['shoes', 'top:inner', 'bottom', 'top:outer', 'dress', 'back', 'face', 'hair', 'hat', 'hand'];
function renderCharacter(view, state, opts = {}) {
  const R = new Renderer(view, state, opts);
  const call = (slot, phase) => {
    const [cat, sub] = slot.split(':');
    const sel = state.equip[cat]; if (!sel || !sel.id) return;
    const item = ITEM_BY_ID[sel.id]; if (!item) return;
    if (sub && (item.layer || 'inner') !== sub) return;
    item.draw(R, phase, ramp(sel.color || item.dye || '#999999'), sel.color || item.dye);
  };
  if (!opts.only) {
    for (const slot of BEHIND_ORDER) call(slot, 'back');
    R.drawBody();
    for (const slot of FRONT_ORDER) call(slot, 'front');
  } else {
    const item = ITEM_BY_ID[opts.only.id];
    item.draw(R, 'back', ramp(opts.only.color || item.dye || '#999'), opts.only.color || item.dye);
    if (opts.withBody) R.drawBody();
    item.draw(R, 'front', ramp(opts.only.color || item.dye || '#999'), opts.only.color || item.dye);
  }
  return R.buf;
}
