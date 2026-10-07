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
function rgbHex(c) { return '#' + c.map(v => clamp(v).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
function rgbHsl(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslRgb(h, s, l) {
  s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l)); h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l, l, l].map(v => clamp(v * 255));
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => clamp(v * 255));
}
function hueToward(h, target, amt) { const d = ((target - h + 540) % 360) - 180; return (h + Math.sign(d) * Math.min(Math.abs(d), amt) + 360) % 360; }

// A ramp is 7 tones, lightest to darkest, with hue shifting: lights lean warm (yellow),
// shadows lean cool (blue-violet), the way hand-painted MMO sprites are shaded.
//   r.t = [spec, hi, lt, base, sh, dp, line]   (also r.spec, r.hi, r.lt, r.base, r.sh, r.dp, r.line)
// Legacy indexes r[0..3] = hi, base, sh, dp still work.
// kind: 'cloth' (default) | 'metal' (high contrast, white specular) | 'hair' | 'gem' | 'leather'
const TONE = { SPEC: 0, HI: 1, LT: 2, BASE: 3, SH: 4, DP: 5, LINE: 6 };
function ramp(input, kind = 'cloth') {
  if (input && input.t) return input;
  const c = typeof input === 'string' ? hexRgb(input) : [input[0], input[1], input[2]];
  const [h, s, l] = rgbHsl(c), grey = s < .07;
  const k = kind === 'metal' ? 1.3 : kind === 'gem' ? 1.2 : kind === 'leather' ? 1.1 : 1;
  const dark = Math.max(.45, Math.min(1, l / .45));
  const lit = (f, sm, hs) => grey ? hslRgb(48, .14 * f, l + (1 - l) * f) : hslRgb(hueToward(h, 52, hs), s * sm, l + (1 - l) * f);
  const shd = (L, sm, sa, hs) => grey ? hslRgb(245, .1 + sa, L) : hslRgb(hueToward(h, 250, hs), Math.min(.95, s * sm + sa), L);
  const lf = l < .3 ? 1.2 : 1;
  const spec = kind === 'metal' || kind === 'gem' ? mix(lit(.85, .3, 14), [255, 255, 255], .6) : lit(.78 * lf, .45, 14);
  const hi = lit(Math.min(.9, .5 * lf * (kind === 'metal' ? 1.2 : 1)), .8, 9);
  const lt = lit(.24 * lf, .93, 4);
  const sh = shd(l - (.13 + .05 * l) * k * dark, 1.06, .05, 10);
  const dp = shd(l - (.27 + .1 * l) * k * dark, 1.1, .09, 18);
  const lineL = Math.max(.05, Math.min(.34, l - (.38 + .2 * l) * dark));
  const line = shd(lineL, 1, .14, 24);
  const r = [hi, c.slice(), sh, dp];
  r.t = [spec, hi, lt, c.slice(), sh, dp, line];
  r.spec = spec; r.hi = hi; r.lt = lt; r.base = c.slice(); r.sh = sh; r.dp = dp; r.line = line;
  r.kind = kind; r.hex = rgbHex(c);
  return r;
}
function lineColor(r) { return r.line || mix(r[3], INK, 0.62); }

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
  poly(pts) { // even-odd scanline fill, sampling pixel centres
    const ys = pts.map(p => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const yc = y + .5, xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > yc) !== (yj > yc)) xs.push((xj - xi) * (yc - yi) / (yj - yi) + xi);
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - .5); x + .5 < xs[k + 1]; x++) this.set(x, y);
    }
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
  // true where the reference body shows skin (not outline/eye/brow pixels); part optional ('head','arm','hand','torso','leg','foot')
  isSkin(x, y, part) { const k = this.bodyIdx(x, y); return k >= 5 && k !== 6 && (!part || this.part(x, y) === part); }
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

  // ---------------------------------------------------------------------------
  // paint(mask, ramp, opts): the core shader.
  // Builds a height field from the distance to the mask's edge (and to any internal
  // contour lines), lights it from the top-left, and quantises into the ramp's tones.
  // Edges become a coloured outline (lighter on the lit side = "sel-out").
  //  opts.lines    keep the body's own contour lines inside the mask (arm/torso seams, leg gap)
  //  opts.flat     ignore the reference body's shading underneath (use for shapes that float off the body)
  //  opts.bodyMix  how much body shading to blend in (default .55)
  //  opts.round    height-field radius in px (default 5; bigger = softer, rounder shading)
  //  opts.bias     add to light intensity (+ lighter / - darker), e.g. a fold-in panel
  //  opts.shiny    allow specular tone (auto for metal/gem/hair ramps)
  //  opts.pattern(x,y) -> truthy: use opts.alt ramp for that pixel; may also return a ramp
  //  opts.toneMap(x,y,tone) -> tone   custom per-pixel tone override (0..5)
  //  opts.edge(x,y,isInternal) -> tone index 0..6 | rgb | null   per-pixel outline override
  //                             (e.g. fade a hair lock's outline near its root by returning TONE.DP)
  //  opts.noOutline, opts.outline (rgb), opts.alpha, opts.headOnly, opts.light [x,y,z]
  paint(mask, r, opts = {}) {
    if (mask.empty()) return;
    r = asRamp(r);
    const a = mask.a, N = a.length, LINE = new Uint8Array(N);
    let x0 = CW, x1 = -1, y0 = CH, y1 = -1;
    for (let i = 0; i < N; i++) if (a[i]) { const x = i % CW, y = i / CW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * CW + x; if (!a[i]) continue;
      if (x === 0 || x === CW - 1 || y === 0 || y === CH - 1 || !a[i - 1] || !a[i + 1] || !a[i - CW] || !a[i + CW]) LINE[i] = 1;
    }
    const { ox, oy } = this.V;
    if (opts.lines) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * CW + x; if (!a[i] || LINE[i]) continue;
      const k = this.bodyIdx(x - ox, y - oy); if (k >= 0 && k <= 2) LINE[i] = 2;
    }
    // chamfer distance to edge/lines, inside the bounding box only
    const D = new Float32Array(N);
    const bx0 = Math.max(1, x0), bx1 = Math.min(CW - 2, x1), by0 = Math.max(1, y0), by1 = Math.min(CH - 2, y1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * CW + x; D[i] = a[i] && !LINE[i] ? 1e9 : 0; }
    const relax = (i, j, w) => { if (D[j] + w < D[i]) D[i] = D[j] + w; };
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) { const i = y * CW + x; if (!D[i]) continue; relax(i, i - 1, 1); relax(i, i - CW, 1); relax(i, i - CW - 1, 1.41); relax(i, i - CW + 1, 1.41); }
    for (let y = by1; y >= by0; y--) for (let x = bx1; x >= bx0; x--) { const i = y * CW + x; if (!D[i]) continue; relax(i, i + 1, 1); relax(i, i + CW, 1); relax(i, i + CW + 1, 1.41); relax(i, i + CW - 1, 1.41); }
    const R0 = opts.round ?? 5, H = new Float32Array(N);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * CW + x; if (a[i]) { const t = Math.min(D[i] + .5, R0) / R0; H[i] = R0 * Math.sqrt(1 - (1 - t) * (1 - t)); } }
    let L = opts.light || [-.5, -.68, .54]; const ll = Math.hypot(...L); L = L.map(v => v / ll);
    const shiny = opts.shiny ?? (r.kind === 'metal' || r.kind === 'gem' || r.kind === 'hair');
    const bodyMix = opts.bodyMix ?? .55;
    const lineLit = mix(r.line, r.dp, .45), out = opts.outline;
    mask.each((x, y, i) => {
      let c;
      if (LINE[i] && !(opts.noOutline && LINE[i] === 1)) {
        const e = opts.edge ? opts.edge(x, y, LINE[i] === 2) : null;
        if (e != null) c = typeof e === 'number' ? r.t[e] : e;
        else if (out) c = out;
        else if (LINE[i] === 1) {
          const litSide = (!a[i - 1] || !a[i - CW]) && a[i + 1] && a[i + CW];
          c = litSide ? lineLit : r.line;
        } else c = r.line;
      } else {
        const gx = (H[i + 1] - H[i - 1]) / 2, gy = (H[i + CW] - H[i - CW]) / 2;
        const nl = Math.hypot(gx, gy, 1);
        let I = (-gx * L[0] - gy * L[1] + L[2]) / nl;
        const k = this.bodyIdx(x, y);
        if (k >= 5 && !opts.flat && (!opts.headOnly || this.part(x, y) === 'head')) I += BODY_TONE[k] * bodyMix;
        I += opts.bias || 0;
        let tone = I > .95 ? 0 : I > .8 ? 1 : I > .66 ? 2 : I > .38 ? 3 : I > .1 ? 4 : 5;
        if (tone === 0 && !shiny) tone = 1;
        if (opts.toneMap) tone = opts.toneMap(x, y, tone);
        let RR = r;
        if (opts.pattern) { const p = opts.pattern(x, y); if (p) RR = p.t ? p : asRamp(opts.alt || r); }
        c = RR.t[Math.max(0, Math.min(5, tone))];
      }
      this.put(i, c, opts.alpha ?? 255);
    });
  }
  // solid fill (details: buttons, gems, laces). c may be a hex, rgb array or ramp (uses base)
  fill(mask, c, alpha) { const col = typeof c === 'string' ? hexRgb(c) : c.t ? c.base : c; mask.each((x, y, i) => this.put(i, col, alpha)); }
  outline(mask, c = INK) { const o = mask.clone().dilate(1).sub(mask); this.fill(o, c); }
  // Cast shadow: darken whatever is already drawn under `mask` shifted by (dx,dy), outside the mask.
  //  opts.tint rgb multipliers (default cool shadow), opts.only(x,y) restrict, opts.strength 0..1
  shadow(mask, opts = {}) {
    const dx = opts.dx ?? 1, dy = opts.dy ?? 2, tint = opts.tint || [.8, .68, .82], st = opts.strength ?? 1;
    const sh = this.M();
    mask.each((x, y) => { for (let k = 1; k <= Math.max(Math.abs(dy), 1); k++) sh.set(x + Math.round(dx * k / Math.max(Math.abs(dy), 1)), y + Math.sign(dy) * k); });
    sh.sub(mask);
    sh.each((x, y, i) => {
      if (this.buf[i * 4 + 3] === 0 || (opts.only && !opts.only(x, y))) return;
      for (let k = 0; k < 3; k++) this.buf[i * 4 + k] = this.buf[i * 4 + k] * (1 - st + st * tint[k]);
    });
  }
  // Darken (or tint) already-drawn pixels inside a mask, e.g. ambient occlusion under a skirt.
  tint(mask, mul = [.8, .68, .82], only) {
    mask.each((x, y, i) => { if (this.buf[i * 4 + 3] && (!only || only(x, y))) for (let k = 0; k < 3; k++) this.buf[i * 4 + k] *= mul[k]; });
  }
  // ---- detail primitives (all coordinates are view-local) ----
  // Points along a quadratic Bezier p0 -> p2 bending toward p1.
  curve(p0, p1, p2) {
    const pts = [], n = Math.ceil((Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) * 1.5) + 2;
    let last = '';
    for (let s = 0; s <= n; s++) {
      const t = s / n, u = 1 - t;
      const x = Math.round(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]), y = Math.round(u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]);
      const key = x + ',' + y; if (key !== last) { pts.push([x, y]); last = key; }
    }
    return pts;
  }
  // Draw a list of points in a colour, optionally clipped to a mask. color: hex | rgb | ramp tone rgb
  stroke(pts, color, clip, w = 1) {
    const c = typeof color === 'string' ? hexRgb(color) : color;
    const m = this.M();
    for (const [x, y] of pts) { if (w <= 1) m.set(x, y); else m.ellipse(x, y, (w - 1) / 2, (w - 1) / 2); }
    if (clip) m.and(clip);
    this.fill(m, c);
    return m;
  }
  // A cloth fold: dark crease with a lit lip on its upper-left side, clipped to `clip`.
  crease(p0, p1, p2, r, clip, opts = {}) {
    r = asRamp(r);
    const pts = this.curve(p0, p1, p2), line = this.M();
    pts.forEach(([x, y]) => line.set(x, y));
    if (clip) line.and(clip);
    const lip = this.M(); line.each((x, y) => { lip.set(x - 1, y); if (opts.wide) lip.set(x - 1, y - 1); });
    lip.sub(line); if (clip) lip.and(clip);
    if (!opts.noLip) this.fill(lip, r.t[opts.lipTone ?? 2]);
    this.fill(line, r.t[opts.tone ?? 5]);
  }
  // Dashed stitch line.
  stitch(pts, color, clip, on = 2, off = 2) { this.stroke(pts.filter((p, i) => i % (on + off) < on), color, clip); }
  // Tapered lock (hair strand clump, feather, ribbon tail): Bezier spine p0->p2 via p1, width w0 at root -> w1 at tip.
  lock(p0, p1, p2, w0, w1 = 0) {
    const m = this.M(), pts = this.curve(p0, p1, p2);
    pts.forEach(([x, y], i) => { const t = i / Math.max(1, pts.length - 1), w = (w0 + (w1 - w0) * t) / 2; if (w < .6) m.set(x, y); else m.ellipse(x, y, w, w); });
    return m;
  }
  // Faceted gem with outline, highlight and sparkle.
  gem(x, y, rad, r) {
    r = asRamp(r, 'gem');
    const m = this.M().ellipse(x, y, rad, rad);
    this.paint(m, r, { flat: true, round: Math.max(1.5, rad), shiny: true });
    this.fill(this.M().set(x - Math.ceil(rad / 2), y - Math.ceil(rad / 2)), [255, 255, 255]);
    if (rad >= 2) this.fill(this.M().set(x - Math.ceil(rad / 2) + 1, y - Math.ceil(rad / 2)), r.spec);
  }
  // Small round button / rivet / stud.
  stud(x, y, r, size = 2) {
    r = asRamp(r, 'metal');
    const m = this.M().rect(x, y, x + size - 1, y + size - 1);
    this.fill(m, r.base); this.fill(this.M().set(x, y), r.spec);
    if (size > 1) this.fill(this.M().set(x + size - 1, y + size - 1), r.dp);
  }
  // Four-point sparkle (for gems, metal glints, magic).
  sparkle(x, y, c = [255, 255, 255], len = 2) {
    const m = this.M().set(x, y); for (let k = 1; k <= len; k++) m.set(x + k, y).set(x - k, y).set(x, y + k).set(x, y - k);
    this.fill(m, c);
  }
}
const BODY_TONE = { 5: -.32, 6: -.1, 7: -.22, 8: -.15, 9: -.08, 10: 0, 11: .04, 12: .05, 13: .05, 14: .05, 15: .3 };
function asRamp(r, kind) { return r && r.t ? r : Array.isArray(r) && Array.isArray(r[0]) ? ramp(r[1], kind) : ramp(r, kind); }

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
    const hex = sel.color || item.dye || '#999999';
    try { item.draw(R, phase, ramp(hex, item.kind || (cat === 'hair' ? 'hair' : 'cloth')), hex); }
    catch (e) { if (typeof console !== 'undefined') console.warn('item draw failed', item.id, e); }
  };
  if (!opts.only) {
    for (const slot of BEHIND_ORDER) call(slot, 'back');
    R.drawBody();
    for (const slot of FRONT_ORDER) call(slot, 'front');
  } else {
    const item = ITEM_BY_ID[opts.only.id], hex = opts.only.color || item.dye || '#999999';
    const rr = ramp(hex, item.kind || (item.cat === 'hair' ? 'hair' : 'cloth'));
    item.draw(R, 'back', rr, hex);
    if (opts.withBody) R.drawBody();
    item.draw(R, 'front', rr, hex);
  }
  return R.buf;
}
