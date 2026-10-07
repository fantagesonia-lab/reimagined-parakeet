// Pixie Closet wardrobe: hat. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
//
// Headwear is shaded as real volumes rather than flat shapes: every piece gets a light
// function (ellipsoid for domes and balls, cylinder for bands, a spine-relative tube for
// cones, horns and ears) that is lit from the top-left and quantised into the ramp, plus a
// one-pixel bevel from the shader's own height field. Pieces that sit on something cast a
// small shadow on it (warm on skin, cool on hair), metal gets specular glints and gems sit
// in bezels with sparkles.
(() => {
// global lookups are slow inside node's vm (tools/check.js), so bind the hot ones locally
const Math = globalThis.Math, Int8Array = globalThis.Int8Array, Uint8Array = globalThis.Uint8Array;
const W_ = CW, H_ = CH;
// ---------------- light & tone helpers ----------------
const LT = (() => { const v = [-.5, -.68, .54], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
const cl = (v, a = 0, b = 5) => v < a ? a : v > b ? b : v;
const toneOf = I => I > .93 ? 0 : I > .76 ? 1 : I > .56 ? 2 : I > .29 ? 3 : I > .03 ? 4 : 5;
const lum = c => .3 * c[0] + .59 * c[1] + .11 * c[2];
// intensity of a surface whose normal is (nx, ny, nz) (screen space, y down, z toward the viewer)
const dot = (nx, ny, nz) => { const l = Math.hypot(nx, ny, nz) || 1; return (nx * LT[0] + ny * LT[1] + nz * LT[2]) / l; };
// ellipsoid (dome, ball, cap): lit top-left, darkens toward the bottom-right limb
const sph = (cx, cy, rx, ry) => (x, y) => {
  let nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny;
  if (d > .985) { const s = Math.sqrt(.985 / d); nx *= s; ny *= s; d = .985; }
  return dot(nx, ny, Math.sqrt(1 - d));
};
// band wrapping round the head: curved across x only; `up` tilts the surface toward the sky
const cylX = (cx, rx, up = 0) => (x, y) => { const nx = cl((x - cx) / rx, -.97, .97); return dot(nx, -up, Math.sqrt(1 - nx * nx)); };
// tube lying across the view (rolled brim edge, rope): curved across y only
const cylY = (cy, ry, side = 0) => (x, y) => { const ny = cl((y - cy) / ry, -.97, .97); return dot(side, ny, Math.sqrt(1 - ny * ny)); };
const flatL = I => () => I;
// polished metal across a cylinder (u = -1 left edge .. 1 right edge): a bright streak a third
// in from the lit side, a dark core toward the shadow side and a thin reflected light at the rim
const METAL_U = [[-.86, 3], [-.62, 2], [-.42, 1], [-.3, 0], [-.18, 1], [.12, 3], [.45, 4], [.8, 5], [2, 4]];
const metalU = u => { for (const [lim, t] of METAL_U) if (u < lim) return t; return 4; };

// Paint a mask with a light function. The shader's own height field adds a 1px bevel:
// rim 2 = light top-left edge + dark bottom-right edge, 1 = only the extremes, 0 = none.
function isEmpty(m) { const a = m.a; for (let i = 0; i < a.length; i++) if (a[i]) return false; return true; }
// same pixels as Mask.ellipse, without the per-pixel method calls
function ell(m, cx, cy, rx, ry) {
  const a = m.a, ox = m.V.ox, oy = m.V.oy, kx = rx + .35, ky = ry + .35;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const Y = y + oy; if (Y < 0 || Y >= H_) continue;
    const dy = (y - cy) / ky, row = Y * W_;
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / kx, X = x + ox; if (X >= 0 && X < W_ && dx * dx + dy * dy <= 1) a[row + X] = 1;
    }
  }
  return m;
}
function form(R, m, r, light, o = {}) {
  if (isEmpty(m)) return;
  r = r.t ? r : ramp(r);
  const shiny = o.shiny ?? (r.kind === 'metal' || r.kind === 'gem');
  const rim = o.rim ?? 2, bias = o.bias || 0, adj = o.adj;
  R.paint(m, r, {
    flat: true, round: o.round ?? 2.5, shiny, edge: o.edge, pattern: o.pattern, alt: o.alt,
    outline: o.outline, noOutline: o.noOutline, alpha: o.alpha,
    toneMap: (x, y, t) => {
      let tone = o.tone ? o.tone(x, y) : toneOf(light(x, y) + bias);
      if (rim === 2) tone += t <= 2 ? -1 : t >= 4 ? 1 : 0;
      else if (rim === 1) tone += t <= 1 ? -1 : t >= 5 ? 1 : 0;
      if (adj) tone = adj(x, y, tone, t);
      tone = cl(tone);
      return tone === 0 && !shiny ? 1 : tone;
    },
  });
}

// ---------------- geometry helpers ----------------
// head centre per view (the side view's hair dome is centred a little behind headCx)
const hcx = R => R.view === 'side' ? 36.5 : R.V.headCx;
// Rotation of the head for the view. phi = angle round the head, 0 = the face, +90 = the
// character's left (viewer's right in front view). Returns screen x and facing (cos, >0 = visible).
const ROT = { front: 0, side: -90, back: 180 };
function around(R, phi, hw, cx = hcx(R)) {
  const th = (phi + ROT[R.view]) * Math.PI / 180;
  return { x: cx + hw * Math.sin(th), c: Math.cos(th), s: Math.sin(th) };
}
// band round the head between two "smile" curves (we look slightly down on the head, so the
// front of a horizontal ring sags in the middle): y = y0 + sag * (1 - u^2)
function bandM(R, cx, hw, y0, y1, sag) {
  const m = R.M();
  for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) {
    const u = (x - cx) / hw, s = sag * (1 - u * u);
    // round the band ends a little where it turns away from us
    const cut = Math.abs(u) > .93 ? (Math.abs(u) - .93) * 20 : 0;
    for (let y = Math.round(y0 + s + cut); y <= Math.round(y1 + s - cut * .5); y++) m.set(x, y);
  }
  return m;
}
const smile = (cx, hw, y0, sag) => x => { const u = cl((x - cx) / hw, -1, 1); return y0 + sag * (1 - u * u); };
// polygon from a sampled closed curve
function ring(cx, cy, rx, ry, n = 48, f) {
  const p = [];
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); p.push(f ? f(a, c, s) : [cx + rx * c, cy + ry * s]); }
  return p;
}
function starPts(x, y, ro, ri, n = 5, rot = -Math.PI / 2) {
  const p = [];
  for (let k = 0; k < n * 2; k++) { const a = rot + k * Math.PI / n, rr = k % 2 ? ri : ro; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  return p;
}
// Spine-based tube (cone, horn, ear, feather): returns the mask plus a light function that
// shades it like a round tube along a quadratic Bezier, width w(t) (half width in px).
function tube(R, p0, p1, p2, w, n = 36) {
  const S = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    let dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    S.push({ x, y, t, dx, dy, nx: -dy, ny: dx, w: Math.max(.01, w(t)) });
  }
  const L = S.map(s => [s.x - s.nx * s.w, s.y - s.ny * s.w]), Rr = S.map(s => [s.x + s.nx * s.w, s.y + s.ny * s.w]).reverse();
  const m = R.M().poly(L.concat(Rr));
  for (const s of S) if (s.w > .7) ell(m, s.x, s.y, s.w * .55, s.w * .55);
  // nearest spine sample -> across-coordinate a (-1 left .. 1 right of the spine) and t
  const near = (x, y) => {
    let best = 1e9, b = S[0];
    for (let k = 0; k < S.length; k++) { const s = S[k], ex = x - s.x, ey = y - s.y, d = ex * ex + ey * ey; if (d < best) { best = d; b = s; } }
    return b;
  };
  const coord = (x, y) => { const s = near(x, y); return { a: cl(((x - s.x) * s.nx + (y - s.y) * s.ny) / s.w, -1, 1), t: s.t, s }; };
  // light: normal = across * n + depth * z, tilted along the spine by `lean` (toward the tip)
  const light = (lean = 0) => (x, y) => {
    const s = near(x, y), a = cl(((x - s.x) * s.nx + (y - s.y) * s.ny) / s.w, -1, 1), z = Math.sqrt(Math.max(0, 1 - a * a));
    return dot(a * s.nx + lean * s.dx, a * s.ny + lean * s.dy, z);
  };
  return { m, S, coord, light };
}

// ---------------- cast shadows ----------------
// Is the pixel still showing the bare skin of the body (not hair or clothes drawn over it)?
function skinTest(R) {
  const V = R.V, cache = new Int8Array(W_ * H_).fill(-1);
  let pal = null, ratio = null;
  try { pal = PAL; const sk = hexRgb((SKIN_TONES[R.state.skin] || SKIN_TONES[0]).hex); ratio = sk.map((v, k) => v / SKIN_BASE[k]); } catch (e) { pal = null; }
  return (x, y) => {
    const X = x + V.ox, Y = y + V.oy; if (X < 0 || Y < 0 || X >= W_ || Y >= H_) return false;
    const i = Y * W_ + X; if (cache[i] >= 0) return cache[i] === 1;
    const yb = y - curLift;   // body coordinates while a lifted hat draws
    let ok = R.isSkin(x, yb);
    if (ok && pal) {
      const k = R.bodyIdx(x, yb), o = i * 4, b = R.buf;
      for (let j = 0; j < 3 && ok; j++) { const e = Math.min(255, Math.round(pal[k][j] * ratio[j])); if (Math.abs(b[o + j] - e) > 2) ok = false; }
    }
    cache[i] = ok ? 1 : 0; return ok;
  };
}
// Shadow cast by mask m onto whatever is drawn under it, offset by (dx,dy) and smeared over
// the steps in between: warm on bare skin, cool elsewhere. (Same idea as R.shadow, but works
// on the raw arrays, which keeps big brims cheap.)
const SH_SKIN = [.95, .77, .75], SH_COOL = [.74, .66, .83];
function drop(R, m, dx = 0, dy = 2, k = 1, only) {
  const a = m.a, buf = R.buf, n = a.length, steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const hit = new Uint8Array(n), offs = [];
  for (let s = 1; s <= steps; s++) offs.push(Math.round(dx * s / steps) + Math.round(dy * s / steps) * W_);
  for (let i = 0; i < n; i++) if (a[i]) for (const d of offs) { const j = i + d; if (j >= 0 && j < n && !a[j] && buf[j * 4 + 3]) hit[j] = 1; }
  const sk = skinTest(R), ox = R.V.ox, oy = R.V.oy;
  for (let j = 0; j < n; j++) if (hit[j]) {
    const x = j % W_ - ox, y = ((j / W_) | 0) - oy;
    if (only && !only(x, y)) continue;
    const t = sk(x, y) ? SH_SKIN : SH_COOL, o = j * 4;
    for (let c = 0; c < 3; c++) buf[o + c] = buf[o + c] * (1 - k + k * t[c]);
  }
}
// fast mask queries on integer coordinates
const fh = m => { const a = m.a, ox = m.V.ox, oy = m.V.oy; return (x, y) => { const X = x + ox, Y = y + oy; return X >= 0 && Y >= 0 && X < W_ && Y < H_ && a[Y * W_ + X] === 1; }; };
// pixels of m whose neighbour at (dx,dy) is outside m (an edge facing that way)
function edge(R, m, dx, dy) {
  const o = R.M(), a = m.a, b = o.a, d = dy * W_ + dx, n = a.length;
  for (let i = 0; i < n; i++) if (a[i]) { const j = i + d; if (j < 0 || j >= n || !a[j]) b[i] = 1; }
  return o;
}
// direct pixel writes for small details (no mask allocation)
function pset(R, x, y, c) {
  if (c.t) c = c.base; else if (typeof c === 'string') c = hexRgb(c);
  const X = Math.round(x) + R.V.ox, Y = Math.round(y) + R.V.oy; if (X < 0 || Y < 0 || X >= W_ || Y >= H_) return;
  const o = (Y * W_ + X) * 4, b = R.buf; b[o] = c[0]; b[o + 1] = c[1]; b[o + 2] = c[2]; b[o + 3] = 255;
}
function rectP(R, x0, y0, x1, y1, c) { for (let y = Math.round(y0); y <= y1; y++) for (let x = Math.round(x0); x <= x1; x++) pset(R, x, y, c); }
function pline(R, list, c, clip) { const h = clip ? fh(clip) : null; for (const [x, y] of list) if (!h || h(Math.round(x), Math.round(y))) pset(R, x, y, c); }
// pixels where nothing has been drawn yet (for parts that are behind the head)
function vacant(R) {
  const V = R.V, b = R.buf;
  return (x, y) => { const X = x + V.ox, Y = y + V.oy; return X < 0 || Y < 0 || X >= W_ || Y >= H_ || b[(Y * W_ + X) * 4 + 3] === 0; };
}
// soft glow: translucent rings around a mask
function glow(R, m, c, a1 = 110, a2 = 50) {
  const g1 = m.clone().dilate(1).sub(m), g2 = m.clone().dilate(2).sub(m).sub(g1);
  R.fill(g2, c, a2); R.fill(g1, c, a1);
}

// ---------------- fixed materials ----------------
const GOLDM = ramp('#f2c14e', 'metal'), SILVERM = ramp('#c9cfdc', 'metal');
const RUBY = ramp('#e8334f', 'gem'), SAPH = ramp('#3d7fe0', 'gem'), EMER = ramp('#2fbf74', 'gem'), AMETH = ramp('#9a5ae0', 'gem');
const ROSE = ramp('#f58fb4', 'gem');
const PEARL = handRamp(['#ffffff', '#ffffff', '#fbf6f0', '#efe6dc', '#d8c8bc', '#b8a49a', '#6e5a58'], 'gem');
const CREAM = ramp('#f6e8cc'), LEAF = ramp('#5bb36a');
// hand-tuned ramp (the generic one pushes pale pink shadows to hot magenta)
function handRamp(hexes, kind = 'cloth') {
  const t = hexes.map(hexRgb), r = [t[1], t[3], t[4], t[5]];
  r.t = t; r.spec = t[0]; r.hi = t[1]; r.lt = t[2]; r.base = t[3]; r.sh = t[4]; r.dp = t[5]; r.line = t[6]; r.kind = kind; r.hex = rgbHex(t[3]);
  return r;
}
// neutral white for small white details (the generic white ramp shades toward lilac)
const SNOW = handRamp(['#ffffff', '#ffffff', '#f7f6f8', '#e8e6ec', '#cac6d2', '#a7a2b4', '#5f5a70']);
const IVORY = handRamp(['#ffffff', '#fdf8ec', '#f4ead2', '#e6d3ac', '#c9ad7f', '#a3845a', '#5e4630']);
const INNER = handRamp(['#fff6f6', '#fde4ea', '#f9cdd9', '#f2afc3', '#df8eab', '#c46f93', '#8a3f62']);
// a gem in a metal bezel, with a sparkle
function setGem(R, x, y, rad, gem, metal = GOLDM, spark = true) {
  R.paint(R.M().ellipse(x, y, rad + 1.2, rad + 1.2), metal, { flat: true, round: 1.5, shiny: true });
  R.gem(x, y, rad, gem);
  if (spark) R.sparkle(x - rad - 1, y - rad - 1, [255, 255, 255], 1);
}
const isDark = r => lum(r.base) < 70;

// Big hairdos lift the hat: the whole hat is drawn `lift` px higher by shifting the view's
// origin while it draws (hats are drawn last, so nothing else sees the shift). `top` is the
// highest y a hat reaches, so tall hats only rise as far as the canvas allows.
const HAIR_LIFT = { puff: 12 };
let curLift = 0;
function hat(id, name, dye, fn, extra = {}) {
  const { top = -20, ...rest } = extra;
  return item('hat', id, name, dye, (R, ph, r, hex) => {
    if (ph !== 'front') return;
    const hair = R.state && R.state.equip && R.state.equip.hair;
    const lift = Math.max(0, Math.min((hair && HAIR_LIFT[hair.id]) || 0, 37 + top));
    if (!lift) { curLift = 0; fn(R, r, R.view, hex); return; }
    const V0 = R.V, V1 = Object.create(V0);
    V1.oy = V0.oy - lift;
    R.V = V1; curLift = lift;
    try { fn(R, r, R.view, hex); } finally { R.V = V0; curLift = 0; }
  }, rest);
}

// ---------------- knit beanie ----------------
// rib coordinate on a dome: ribs follow the meridians and bunch up toward the sides
function ribs(cx, cy, rx, ry, n) {
  return (x, y) => {
    const dy = (y - cy) / ry, hw = rx * Math.sqrt(Math.max(.03, 1 - dy * dy));
    const u = Math.asin(cl((x - cx) / hw, -1, 1)), f = (u / Math.PI + .5) * n;
    const width = Math.PI * hw * Math.cos(u) / n;
    return { pos: (f - Math.floor(f)) * width, width, k: Math.floor(f) };
  };
}
hat('beanie', 'Knit Beanie', '#e0475a', (R, r, v) => {
  const cx = hcx(R), cy = 11, rx = 40.5, ry = 24;
  const top = smile(cx, 40.5, 7, 3);
  // crown: a soft dome with knit ribs running up to the gathered top
  const crown = R.M().ellipse(cx, cy, rx, ry).keep((x, y) => y <= top(x) + 2);
  const rb = ribs(cx, cy, rx, ry, 22);
  form(R, crown, r, sph(cx - 5, cy + 2, rx + 3, ry + 5), {
    bias: -.14,
    adj: (x, y, t) => {
      const q = rb(x, y); if (q.width < 2.6) return t;
      if (q.pos < 1) return t + 1;                       // groove between ribs
      if (q.pos < 2 && t <= 3) return t - 1;             // lit shoulder of the rib
      // knit "v" stitches: a darker tick every 3 rows on the shadow side of each rib
      if (q.pos > q.width - 1.2 && (y + q.k) % 3 === 0) return t + 1;
      return t;
    },
  });
  // a couple of soft folds where the crown slouches
  const clip = crown.clone();
  R.crease([cx - 30, 3], [cx - 22, -4], [cx - 11, -7], r, clip, { tone: 4, lipTone: 2 });
  R.crease([cx + 9, -6], [cx + 21, -4], [cx + 30, 2], r, clip, { tone: 5, noLip: true });
  // folded cuff: ribbed band, a bit wider than the crown, casting a shadow on the hair below
  const cuff = bandM(R, cx, 41, 7, 19, 3);
  const cu = cylX(cx, 44, .15);
  form(R, cuff, r, cu, {
    bias: -.1,
    adj: (x, y, t) => {
      const u = Math.asin(cl((x - cx) / 41.5, -1, 1)), f = (u / Math.PI + .5) * 34, w = Math.PI * 41.5 * Math.cos(u) / 34;
      const p = (f - Math.floor(f)) * w;
      if (y <= top(x) + 1) t -= 1;                       // rolled top edge catches the light
      if (w < 2.2) return t;
      if (p < 1) return t + 1;
      if (p < 2 && t <= 3) return t - 1;
      return t;
    },
  });
  drop(R, cuff, 0, 2);
  // stitched label on the cuff (character's right side)
  const lb = around(R, -40, 41);
  if (lb.c > .3) {
    const lx = Math.round(lb.x), ly = Math.round(top(lx)) + 3, w = Math.max(3, Math.round(5 * lb.c));
    const tag = R.M().rect(lx - w, ly, lx + w, ly + 7);
    form(R, tag, CREAM, cylX(lx + 2, 10), { rim: 1 });
    R.stitch(R.curve([lx - w + 1, ly + 1], [lx, ly + 1], [lx + w - 1, ly + 1]), CREAM.sh, tag, 1, 1);
    R.stitch(R.curve([lx - w + 1, ly + 6], [lx, ly + 6], [lx + w - 1, ly + 6]), CREAM.sh, tag, 1, 1);
    // tiny heart emblem
    const hm = R.M().set(lx - 2, ly + 3).set(lx - 1, ly + 3).set(lx + 1, ly + 3).set(lx + 2, ly + 3).rect(lx - 2, ly + 4, lx + 2, ly + 4).rect(lx - 1, ly + 5, lx + 1, ly + 5).set(lx, ly + 6);
    R.fill(hm, isDark(r) ? RED.base : r.base); pset(R, lx - 2, ly + 3, isDark(r) ? RED.hi : r.hi);
    drop(R, tag, 1, 1, .8);
  }
  // pom-pom: lumpy ball of yarn tufts
  const px = cx + (v === 'side' ? 3 : 0), py = -15;
  const pom = R.M().ellipse(px, py, 7, 6.5);
  for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2 + .3; pom.ellipse(px + Math.cos(a) * 6.6, py + Math.sin(a) * 6.1, 2.1, 2.1); }
  const PR = isDark(r) || lum(r.base) > 225 ? ramp(mix(r.base, [250, 246, 250], .45)) : SNOW;
  form(R, pom, PR, sph(px - 1, py - 1, 10, 10), { rim: 1 });
  // tufts: short dark strokes on the shadow side, light ones on the lit side
  const tufts = [[[px + 2, py + 6], [px + 3, py + 3], [px + 1, py + 1]], [[px + 6, py + 3], [px + 4, py + 2], [px + 3, py]], [[px - 3, py + 6], [px - 3, py + 4], [px - 2, py + 2]],
    [[px + 6, py - 2], [px + 4, py - 1], [px + 3, py - 2]]];
  for (const [a, b, c] of tufts) pline(R, R.curve(a, b, c), PR.sh, pom);
  for (const [a, b, c] of [[[px - 5, py - 2], [px - 4, py - 4], [px - 2, py - 5]], [[px - 2, py - 1], [px - 1, py - 3], [px + 1, py - 3]]]) pline(R, R.curve(a, b, c), PR.spec, pom);
  drop(R, pom, 1, 2, .9);
}, { top: -24 });

// ---------------- witch hat ----------------
hat('witchhat', 'Witch Hat', '#5b3d8f', (R, r, v) => {
  const cx = hcx(R), s = v === 'back' ? -1 : 1;
  // brim: wide disc seen from slightly above, drooping a little at the ends
  const bcy = 7, brx = 51, bry = 8.5;
  const brim = R.M().poly(ring(cx, bcy, brx, bry, 72, (a, c, sn) => [cx + brx * c, bcy + bry * sn + 2.8 * c ** 4 + (sn > 0 ? .8 * sn : 0)]));
  const lip = edge(R, brim, 0, 2).keep((x, y) => y > bcy), inLip = fh(lip);
  form(R, brim, r, (x, y) => {
    const u = (x - cx) / brx, w = (y - bcy) / bry;
    return dot(u * .5, -1, .35 + w * .3) - .05;
  }, {
    adj: (x, y, t) => inLip(x, y) ? Math.max(t, 4) : (y < bcy - 3 && Math.abs(x - cx) < 26 ? t + 1 : t),
  });
  // a soft fold in the brim on each side
  R.crease([cx - 38, bcy + 1], [cx - 33, bcy + 4], [cx - 30, bcy + 8], r, brim, { tone: 4 });
  R.crease([cx + 31, bcy + 2], [cx + 35, bcy + 5], [cx + 37, bcy + 8], r, brim, { tone: 5, noLip: true });
  // cone: rises from the brim and flops over to one side, creased at the bend
  const base = smile(cx, 23, 3, 2.5);
  const T = tube(R, [cx, 9], [cx + 3 * s, -27], [cx + 24 * s, -37], t => 23.5 * Math.pow(1 - t, 1.05) + .4);
  const cone = T.m.keep((x, y) => y <= base(x));
  form(R, cone, r, T.light(.35), { round: 3 });
  const creaseAt = (t0, len, bend, tone) => {
    const sp = T.S[Math.round(t0 * 36)];
    const a = [sp.x - sp.nx * sp.w * .95, sp.y - sp.ny * sp.w * .95], b = [sp.x + sp.nx * sp.w * len, sp.y + sp.ny * sp.w * len];
    R.crease(a, [(a[0] + b[0]) / 2 + sp.dx * bend, (a[1] + b[1]) / 2 + sp.dy * bend], b, r, cone, { tone, lipTone: 2 });
  };
  creaseAt(.58, .5, -3, 5);
  creaseAt(.66, .2, -2, 4);
  creaseAt(.47, -.1, -2, 4);
  R.crease([cx - 13, -3], [cx - 11, -10], [cx - 6, -16], r, cone, { tone: 4 });
  R.crease([cx + 10, -2], [cx + 10, -8], [cx + 7, -14], r, cone, { tone: 5, noLip: true });
  drop(R, cone, 2 * s, 1, .8);
  // band with gold piping and a square buckle
  const BAND = ramp(mix(r.base, [32, 20, 40], .55));
  const band = cone.clone().keep((x, y) => y >= base(x) - 6);
  form(R, band, BAND, cylX(cx, 26, .1));
  const bandTop = edge(R, band, 0, -1);
  R.fill(bandTop, GOLDM.lt);
  R.fill(edge(R, band, 0, 1), GOLDM.sh);
  drop(R, bandTop, 0, -1, .5);
  const bk = around(R, 0, 21);
  if (bk.c > .15) {
    const bx = Math.round(bk.x), by = Math.round(base(bx)) - 3, hw = Math.max(1.5, 5 * bk.c);
    const frame = R.M().rect(bx - hw, by - 5, bx + hw, by + 4);
    const hole = R.M().rect(bx - hw + 3, by - 2, bx + hw - 3, by + 1);
    const fr = frame.clone().sub(hole);
    form(R, fr, GOLDM, sph(bx - 2, by - 2, hw + 4, 7), { round: 1.5, rim: 1, bias: .05 });
    if (!hole.empty()) R.fill(R.M().rect(bx, by - 2, bx, by + 1).and(hole), GOLDM.sh);
    pset(R, bx - Math.floor(hw) + 1, by - 4, [255, 255, 255]);
    drop(R, frame, 1, 1, .7);
  }
  // star charm dangling from the tip
  const tip = T.S[T.S.length - 1], tx = Math.round(tip.x + 1 * s), ty = Math.round(tip.y + 1);
  const chain = R.M(); for (let k = 1; k <= 5; k += 2) chain.set(tx + (k > 2 ? s : 0), ty + k);
  R.fill(chain, GOLDM.sh);
  const sy = ty + 11, sx = tx + s;
  const star = R.M().poly(starPts(sx, sy, 5.4, 2.4));
  form(R, star, GOLDM, sph(sx - 1, sy - 1, 6, 6), { round: 1.5, rim: 1 });
  pset(R, sx - 1, sy - 1, [255, 255, 255]);
  R.sparkle(sx + 5, sy - 5, [255, 250, 220], 1);
  drop(R, brim.clone().keep((x, y) => y >= bcy - 1), 0, 3);
}, { top: -38 });

// ---------------- royal crown ----------------
hat('crown', 'Royal Crown', '#f2c14e', (R, r, v) => {
  const cx = hcx(R), hw = 21, top = smile(cx, hw, -6, 2.5);
  // velvet cap inside the crown
  const cap = R.M().ellipse(cx, -6, hw - 3, 14).keep((x, y) => y <= top(x) + 1);
  form(R, cap, RED, sph(cx - 4, -8, hw, 16), { rim: 1, bias: -.1 });
  for (const dx of [-11, -4, 4, 11]) R.crease([cx + dx * .6, -18], [cx + dx * 1.05, -13], [cx + dx * 1.2, -7], RED, cap, { tone: 4, noLip: dx > 0 });
  // orb and cross on top of the cap
  const oy = -21;
  form(R, R.M().ellipse(cx, oy, 2.6, 2.6), r, sph(cx - 1, oy - 1, 3.2, 3.2), { round: 1.5, rim: 0 });
  form(R, R.M().rect(cx - .4, oy - 9, cx + .4, oy - 3).rect(cx - 2, oy - 7, cx + 2, oy - 6), r, (x, y) => x <= cx ? .8 : .4, { rim: 0, round: 1 });
  // points: 8 round the crown, the ones turned toward us are drawn back to front
  const pts = [];
  for (let k = 0; k < 8; k++) { const p = around(R, k * 45, hw - .5); if (p.c > -.05) pts.push({ ...p, k }); }
  pts.sort((a, b) => a.c - b.c);
  for (const p of pts) {
    const x = p.x, h = (p.k === 0 ? 15 : 12) * (.75 + .25 * Math.max(0, p.c)), w = Math.max(2.6, 6.4 * p.c + .8), y0 = top(x) + 2;
    const pm = R.M().poly([[x - w, y0], [x - w * .55, y0 - h * .45], [x, y0 - h], [x + w * .55, y0 - h * .45], [x + w, y0]]);
    // faceted: the facet turned to the light is bright, the other in shade
    const lit = p.s < .3;
    form(R, pm, r, (xx) => (xx < x) === lit ? .84 : .4, { rim: 1, round: 1.5, bias: p.c < .4 ? -.15 : 0 });
    if (w > 3) {
      R.fill(R.M().line(x, y0 - h + 3, x, y0 - 3), r.sh);
      if (p.k === 0 && p.c > .6) setGem(R, Math.round(x), Math.round(y0 - h * .4), 1, RUBY, r, false);
    }
    // ball on the tip
    const bx = Math.round(x), by = Math.round(y0 - h - .6);
    form(R, R.M().ellipse(bx, by, 1.8, 1.8), p.k === 0 && p.c > .5 ? PEARL : r, sph(bx - 1, by - 1, 2.6, 2.6), { round: 1.2, rim: 0, shiny: true });
    pset(R, bx - 1, by - 1, [255, 255, 255]);
  }
  // band: polished metal cylinder with a beaded lower rim
  const band = bandM(R, cx, hw + .5, -6, 3, 2.5);
  form(R, band, r, null, { round: 2, rim: 1, tone: (x) => metalU((x - cx) / (hw + .5)) });
  const edgeT = edge(R, band, 0, -2).sub(edge(R, band, 0, -1));
  R.fill(edgeT.clone().keep(x => x < cx + hw * .45), r.hi); R.fill(edgeT.clone().keep(x => x >= cx + hw * .45), r.lt);
  const edgeB = edge(R, band, 0, 2).sub(edge(R, band, 0, 1)), ridge = edge(R, band, 0, 3).sub(edge(R, band, 0, 2));
  R.fill(ridge, r.dp);
  edgeB.each((x, y) => pset(R, x, y, (x & 1) ? r.sh : (x < cx + 6 ? r.hi : r.lt)));
  // jewels: ruby in front, sapphires at the sides, emerald at the back, pearls between
  const J = [[0, RUBY, 2.6], [90, SAPH, 1.9], [-90, SAPH, 1.9], [180, EMER, 2.2], [45, AMETH, 1], [-45, AMETH, 1], [135, AMETH, 1], [-135, AMETH, 1]];
  for (const [phi, g, rad] of J) {
    const p = around(R, phi, hw); if (p.c < .3) continue;
    const x = Math.round(p.x), y = Math.round(top(x)) + 4;
    if (rad < 1.5) { R.stud(x, y - 1, PEARL, 2); continue; }
    const rr = Math.max(1, Math.round(rad * Math.min(1, p.c + .25)));
    setGem(R, x, y, rr, g, r, rad > 2 && p.c > .7);
  }
  drop(R, band, 0, 2);
  R.sparkle(Math.round(cx - hw + 5), -14, [255, 252, 225], 2);
}, { kind: 'metal', top: -30 });

// ---------------- cat ears ----------------
// one ear: a curved triangle with a blunt tip; returns tube (mask + light)
function earShape(R, bx, by, tipX, tipY, half, lean = 0, n = 24) {
  const p0 = [bx, by], p2 = [tipX, tipY], p1 = [(bx + tipX) / 2 + lean, (by + tipY) / 2];
  return tube(R, p0, p1, p2, t => half * Math.pow(1 - t, .62) * (1 - .12 * t) + .4, n);
}
hat('catears', 'Cat Ears', '#34303d', (R, r, v) => {
  const cx = hcx(R);
  const TUFT = ramp(mix(r.base, [252, 248, 250], isDark(r) ? .7 : .78));
  // ear: inner = which way the opening faces (-1 left, 0 straight at us, null = back of the ear)
  const ear = (bx, by, tx, ty, half, lean, inner, far = false, slim = 1) => {
    const E = earShape(R, bx, by, tx, ty, half * slim, lean);
    form(R, E.m, r, E.light(.3), { round: 2.5, bias: far ? -.32 : -.08 });
    if (inner !== null) {
      // the opening: soft pink, in shadow toward the base, with pale fur tufts
      const ix = bx + inner * half * .35, I = earShape(R, ix, by + 1, tx + inner * 1.5 + (bx - tx) * .08, ty + 6, half * slim * (inner ? .42 : .6), lean * .8, 20);
      const im = I.m.and(E.m.clone().sub(edge(R, E.m, 0, -1)));
      form(R, im, INNER, (x, y) => I.light(-.3)(x, y) + (far ? -.35 : 0) + (y - ty) / (by - ty) * -.35 + .05, { round: 2, rim: 1, edge: () => TONE.SH });
      // pale fur tufts curling up out of the ear
      if (!far) for (const k of inner ? [0, 1] : [-1, 0, 1]) {
        const sx = ix + k * half * .28, sy = by, dx = (tx - bx) * .18 + k * 2 + inner * 2;
        const c = R.curve([sx, sy], [sx + dx * .3 - k, sy - 5], [sx + dx, sy - 9 + Math.abs(k) * 2]);
        pline(R, c, INNER.spec, E.m); pline(R, c.map(([x, y]) => [x + 1, y + 1]).slice(0, -2), INNER.lt, im);
      }
    } else {
      // back of the ear: a soft ridge and a pale fur edge
      R.crease([bx + 1, by - 3], [(bx + tx) / 2 + lean * .4, (by + ty) / 2 + 1], [tx, ty + 5], r, E.m, { tone: 4, lipTone: 1, wide: true });
      // pale fur fringe along the outer edge
      const fr = edge(R, E.m, Math.sign(tx - cx), 0).keep((x, y) => y > ty + 3 && y < by - 2);
      fr.each((x, y) => { if (y % 3) pset(R, x - Math.sign(tx - cx), y, r.lt); });
    }
    drop(R, E.m, 1, 2, .8);
    return E.m;
  };
  if (v === 'side') {
    // three-quarter turned ears: the far one peeks out behind the near one
    ear(cx - 2, 4, cx - 2, -15, 10, 2, -.6, true, .75);
    ear(cx - 14, 7, cx - 18, -13, 11, 1.5, -.6, false, .85);
  } else {
    const back = v === 'back';
    for (const s of [-1, 1]) ear(cx + s * 22, 7, cx + s * 30, -15, 12, s * 3, back ? null : 0);
  }
}, { top: -16 });

// ---------------- bunny ears ----------------
hat('bunny', 'Bunny Ears', '#f7f3f8', (R, r, v) => {
  const cx = hcx(R), back = v === 'back';
  // headband following the top of the hair
  const BAND = ramp(mix(r.base, [60, 50, 70], isDark(r) ? 0 : .25));
  // (it slips under the hair at the sides)
  const bandM2 = v === 'side'
    ? R.M().ellipse(cx - 1, 30, 11, 35).sub(R.M().ellipse(cx - 1, 30, 8, 32)).keep((x, y) => y < 10 && x >= cx - 3)
    : R.M().ellipse(cx, 30, 36.5, 33.5).sub(R.M().ellipse(cx, 30, 33.5, 30.5)).keep((x, y) => y < 12);
  const longEar = (p0, p1, p2, half, { inner, far, flop }) => {
    const E = tube(R, p0, p1, p2, t => (half * (.55 + .45 * Math.sin(Math.PI * Math.min(1, t * 1.25)))) * (t > .85 ? Math.sqrt((1 - t) / .15) : 1) + .3, 30);
    form(R, E.m, r, E.light(.15), { round: 3, bias: far ? -.3 : -.08 });
    if (inner) {
      const I = tube(R, [p0[0], p0[1] - 2], p1, [p2[0] + (p1[0] - p2[0]) * .12, p2[1] + (p1[1] - p2[1]) * .12], t => half * .5 * Math.sin(Math.PI * Math.min(1, t * 1.15 + .05)) + .2, 24);
      const im = I.m.and(E.m);
      form(R, im, INNER, (x, y) => I.light(-.2)(x, y) - .15 + (y - p2[1]) / (p0[1] - p2[1] + 1) * -.25, { round: 2, rim: 1, edge: () => TONE.DP });
      // a pale vein down the middle
      pline(R, R.curve([p0[0], p0[1] - 5], p1, [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + 3]), INNER.lt, im);
    } else R.crease([p0[0], p0[1] - 2], p1, [p2[0], p2[1] + 5], r, E.m, { tone: 4, lipTone: 2 });
    if (flop) {
      // the tip folds over toward us
      const F = tube(R, flop[0], flop[1], flop[2], t => half * (1 - t * .5) * (t > .8 ? Math.sqrt((1 - t) / .2) : 1) + .4, 20);
      form(R, F.m, r, F.light(-.2), { round: 2.5, bias: -.02 });
      drop(R, F.m, 1, 2, .9);
    }
    return E.m;
  };
  if (v === 'side') {
    form(R, bandM2, BAND, sph(cx - 6, 20, 40, 34), { round: 1.5, rim: 1 });
    longEar([cx + 6, 0], [cx + 12, -18], [cx + 22, -32], 5.2, { far: true });
    const m = longEar([cx - 1, -1], [cx + 3, -20], [cx + 12, -35], 6, { inner: true });
    drop(R, m, 1, 2, .8);
  } else {
    form(R, bandM2, BAND, sph(cx - 6, 20, 40, 34), { round: 1.5, rim: 1 });
    const s = back ? -1 : 1;
    // upright ear on the viewer's left (front view), floppy one on the right
    const a = longEar([cx - 12 * s, 1], [cx - 15 * s, -18], [cx - 13 * s, -36], 6.3, { inner: !back });
    const tipFold = [[cx + 19 * s, -22], [cx + 25 * s, -26], [cx + 29 * s, -17]];
    const b = longEar([cx + 12 * s, 1], [cx + 16 * s, -12], [cx + 19 * s, -22], 6.3, { inner: !back, flop: back ? null : tipFold });
    if (back) { const F = tube(R, tipFold[0].map((q, i) => i ? q : 2 * cx - (2 * cx - q)), tipFold[1], tipFold[2], t => 6.3 * (1 - t * .5) * (t > .8 ? Math.sqrt((1 - t) / .2) : 1) + .4, 20); form(R, F.m, r, F.light(-.2), { round: 2.5, bias: -.12 }); }
    drop(R, a, 1, 2, .8); drop(R, b, 1, 2, .8);
  }
  // little bow at the base of one ear
  const bp = around(R, 55, 26);
  if (bp.c > -.2) {
    const bx = Math.round(bp.x), by = v === 'side' ? 1 : 3;
    const bow = R.M().poly([[bx, by], [bx - 6, by - 5], [bx - 8, by - 1], [bx - 6, by + 4]]).poly([[bx, by], [bx + 6, by - 5], [bx + 8, by - 1], [bx + 6, by + 4]]);
    const BOW = isDark(r) || lum(r.base) > 200 ? INNER : ramp(mix(r.base, [255, 255, 255], .4));
    form(R, bow, BOW, sph(bx - 3, by - 3, 9, 6), { round: 1.8, rim: 1, bias: .1 });
    R.crease([bx - 6, by - 2], [bx - 3, by], [bx - 1, by], BOW, bow, { tone: 4, lipTone: 2 });
    R.crease([bx + 6, by - 2], [bx + 3, by], [bx + 1, by], BOW, bow, { tone: 4, noLip: true });
    form(R, R.M().ellipse(bx, by, 1.6, 2), BOW, flatL(.6), { round: 1, rim: 0 });
    drop(R, bow, 1, 1, .7);
  }
}, { top: -36 });

// ---------------- ball cap ----------------
hat('cap', 'Ball Cap', '#3f6fd8', (R, r, v) => {
  const cx = hcx(R), cy = 14, rx = 40, ry = 22, bot = smile(cx, rx, 11, 3);
  const crown = R.M().ellipse(cx, cy, rx, ry).keep((x, y) => y <= bot(x) + 2);
  // back opening above the adjustable strap shows the hair
  if (v === 'back') crown.sub(R.M().ellipse(cx, 14, 8, 7).keep((x, y) => y >= 9));
  form(R, crown, r, sph(cx - 6, cy, rx + 2, ry + 4), { bias: -.16, round: 3 });
  const hw = y => rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
  // six panels: seams follow the meridians up to the button, stitched on both sides
  for (let k = 0; k < 6; k++) {
    const p = around(R, k * 60, 1); if (p.c < .08) continue;
    const pts = [];
    for (let y = cy - ry + 2; y <= bot(cx + rx * p.s) + 2; y++) pts.push([Math.round(cx + hw(y) * p.s), y]);
    pline(R, pts, r.dp, crown);
    if (p.c > .3) {
      R.stitch(pts.map(([x, y]) => [x - 2, y]).filter(([x, y]) => y > cy - ry + 5), r.lt, crown, 1, 1);
      R.stitch(pts.map(([x, y]) => [x + 2, y]).filter(([x, y]) => y > cy - ry + 5), r.sh, crown, 1, 1);
    }
  }
  // vent eyelets
  for (const phi of [-30, 30, 150, 210]) {
    const p = around(R, phi, 1); if (p.c < .3) continue;
    const ex = Math.round(cx + hw(-1) * p.s * .9), ey = -1;
    rectP(R, ex, ey, ex + 1, ey + 1, r.line); (pset(R, ex - 1, ey, r.lt), pset(R, ex, ey - 1, r.lt));
  }
  // button on top
  form(R, R.M().ellipse(cx + (v === 'side' ? 1 : 0), cy - ry - .5, 3, 2), r, sph(cx - 1, cy - ry - 1, 3.5, 3), { round: 1.5, rim: 1 });
  if (v === 'back') {
    // back opening with an adjustable strap
    const strap = R.M().rect(cx - 10, 11, cx + 10, 13).and(R.M().ellipse(cx, 13, 11, 6));
    form(R, strap, ramp(r.sh), cylX(cx, 14), { round: 1.2, rim: 1 });
    for (let x = cx - 7; x <= cx + 5; x += 4) R.stud(x, 11, ramp(r.dp), 2);
    drop(R, strap, 0, 1, .7);
  }
  // emblem on the front panels: an embroidered star
  const em = around(R, 0, 1);
  if (em.c > .25) {
    const ex = cx + hw(1) * em.s * .92, sw = Math.max(.35, em.c);
    const patch = R.M().ellipse(ex, 1, 7.5 * sw, 7);
    const PAT = lum(r.base) > 190 ? ramp('#34303d') : WHITE;
    form(R, patch, PAT, sph(ex - 3, -2, 9, 9), { round: 1.5, rim: 1, bias: .1 });
    R.stitch(R.curve([ex - 6 * sw, 1], [ex, -12], [ex + 6 * sw, 1]), PAT.sh, patch.clone().sub(edge(R, patch, 0, -1)), 1, 1);
    const star = R.M().poly(starPts(ex, 1.5, 5.2, 2.2).map(([x, y]) => [ex + (x - ex) * sw, y]));
    form(R, star, r, sph(ex - 2, 0, 6, 6), { round: 1.2, rim: 1, bias: .05 });
    drop(R, patch, 1, 1, .6);
  }
  drop(R, edge(R, crown, 0, 1), 0, 1, .6);
  // brim
  let brim;
  if (v === 'side') {
    brim = R.M().poly([[cx - 30, 10], [cx - 42, 10], [cx - 52, 12.5], [cx - 55, 15], [cx - 53, 17], [cx - 42, 16], [cx - 30, 15.5]]).sub(crown.clone().keep((x, y) => x > cx - 33));
    form(R, brim, r, (x, y) => dot(0, -1, .6) - (y - 11) * .12, { round: 2, bias: -.02 });
    R.stitch(R.curve([cx - 33, 12], [cx - 44, 11], [cx - 52, 14]), r.lt, brim, 1, 1);
    R.fill(edge(R, brim, 0, 1), r.dp);
  } else if (v === 'front') {
    brim = R.M().ellipse(cx, 14, 36, 12).keep((x, y) => y >= bot(x) - .5);
    form(R, brim, r, (x, y) => dot((x - cx) / 40, -.85, .55), { round: 2, bias: -.05 });
    // rows of stitching parallel to the edge
    for (const k of [2.5, 5]) {
      const pts = []; for (let x = cx - 34 + k; x <= cx + 34 - k; x++) { const u = (x - cx) / (36 - k * .8); if (Math.abs(u) < 1) pts.push([x, Math.round(14 + (12 - k) * Math.sqrt(1 - u * u))]); }
      R.stitch(pts, k < 3 ? r.sh : r.lt, brim, 2, 1);
    }
    R.fill(edge(R, brim, 0, 1).keep((x, y) => y > 18), r.dp);
    R.crease([cx - 14, 16], [cx - 6, 20], [cx + 2, 21], r, brim, { tone: 4, lipTone: 2 });
    drop(R, brim, 0, 3);
  }
  if (brim && v === 'side') drop(R, brim, 1, 3);
}, { top: -10 });

// ---------------- top hat ----------------
hat('tophat', 'Top Hat', '#34303d', (R, r, v) => {
  const cx = hcx(R), yb = 3, yt = -31, w0 = 16.5, w1 = 18.5;
  // brim: curls up at the sides
  const brim = R.M().poly(ring(cx, 4, 33, 6, 64, (a, c, s) => [cx + 33 * c, 4 + 6 * s - 5 * c ** 6 + (s < 0 ? 1.5 * c * c * s : 0)]));
  const lip = edge(R, brim, 0, 2).keep((x, y) => y > 4), inLip = fh(lip);
  form(R, brim, r, (x, y) => dot((x - cx) / 36 * .9, -1, .3 + (y - 4) / 6 * .3), { bias: -.28, adj: (x, y, t) => inLip(x, y) ? Math.max(t, 4) : t });
  // crown: a silk cylinder flaring slightly toward the top
  const crownM = R.M().poly([[cx - w0, yb], [cx - w1, yt], [cx + w1, yt], [cx + w0, yb]]).keep((x, y) => y <= smile(cx, w0, yb - 1, 2)(x));
  const halfAt = y => w0 + (w1 - w0) * (yb - y) / (yb - yt);
  const silk = (x, y) => { const t = metalU((x - cx) / halfAt(y)); return t === 0 ? 1 : t; };
  form(R, crownM, r, null, { tone: silk, round: 2, rim: 1 });
  // a faint vertical sheen line in the silk
  pline(R, R.curve([cx - 9, yt + 4], [cx - 9.5, (yt + yb) / 2], [cx - 9, yb - 8]), r.spec, crownM);
  // top: an ellipse seen from slightly above
  const lid = R.M().ellipse(cx, yt, w1, 3.2);
  form(R, lid, r, (x, y) => dot((x - cx) / 30, -1, .2), { round: 2, bias: .05 });
  // a playing card tucked into the band on the other side
  const cd = around(R, -48, w0);
  if (cd.c > .3) {
    const kx = Math.round(cd.x), ky = -16;
    const card = R.M().poly([[kx - 4, ky + 1], [kx + 3.5, ky - 1], [kx + 5, ky + 13], [kx - 2.5, ky + 14]]);
    form(R, card, WHITE, (x, y) => .72 - (x - kx) * .03, { round: 1.5, rim: 1 });
    const hx = kx + 1, hy = ky + 5;
    (rectP(R, hx - 2, hy, hx - 1, hy, RED.base), rectP(R, hx + 1, hy, hx + 2, hy, RED.base), rectP(R, hx - 2, hy + 1, hx + 2, hy + 1, RED.base), rectP(R, hx - 1, hy + 2, hx + 1, hy + 2, RED.base), pset(R, hx, hy + 3, RED.base));
    pset(R, hx - 2, hy, RED.hi);
    pset(R, kx - 2, ky + 2, RED.sh);
    drop(R, card, 1, 1, .8);
  }
  // band
  const BAND = lum(r.base) < 90 || (r.base[0] > r.base[1] * 1.6 && r.base[0] > 150) ? ramp(isDark(r) ? '#b8314a' : '#34303d') : ramp(mix(r.base, [30, 20, 35], .6));
  const band = bandM(R, cx, w0 + .5, -6, 1, 2);
  form(R, band, BAND, cylX(cx - 4, w0 + 4, .05), { round: 1.5 });
  R.fill(edge(R, band, 0, -1).keep(x => x < cx + 6), BAND.lt);
  drop(R, edge(R, band, 0, 1), 0, 1, .6);
  // gold buckle on the band
  const bw = around(R, 40, w0);
  if (bw.c > .1) {
    const bx = Math.round(bw.x), by = Math.round(-2.5 + 2 * (1 - bw.s ** 2)), hw = Math.max(1.5, 5 * bw.c);
    const frame = R.M().rect(bx - hw, by - 5, bx + hw, by + 4), hole = R.M().rect(bx - hw + 2.5, by - 2, bx + hw - 2.5, by + 1);
    form(R, frame.clone().sub(hole), GOLDM, sph(bx - 2, by - 3, hw + 4, 7), { round: 1.5, rim: 1, bias: .2, edge: () => GOLDM.dp });
    if (!hole.empty()) R.fill(R.M().rect(bx, by - 2, bx, by + 2).and(hole), GOLDM.sh);
    pset(R, Math.round(bx - hw) + 1, by - 3, [255, 255, 255]);
    drop(R, frame, 1, 1, .7);
  }
  drop(R, crownM, 2, 1, .6);
  drop(R, brim.clone().keep((x, y) => y >= 3), 0, 3);
}, { top: -34 });

// ---------------- flower crown ----------------
const SUN = ramp('#f5d04a'), BLUEF = ramp('#8cc8f2');
// a leaf: tapered lock with a midrib
function leafShape(R, x, y, ang, len, w = 4.5) {
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len, mx2 = (x + ex) / 2 - Math.sin(ang) * 1.2, my2 = (y + ey) / 2 + Math.cos(ang) * 1.2;
  const L = tube(R, [x, y], [mx2, my2], [ex, ey], t => w / 2 * Math.sin(Math.PI * Math.min(1, .15 + t * .95)) + .2, 12);
  L.rib = R.curve([x, y], [mx2, my2], [ex - Math.cos(ang) * 2, ey - Math.sin(ang) * 2]);
  return L;
}
function leaf(R, x, y, ang, len, w = 4.5) {
  const L = leafShape(R, x, y, ang, len, w);
  form(R, L.m, LEAF, L.light(.1), { round: 1.5, rim: 1 });
  pline(R, L.rib, LEAF.sh, L.m);
  return L.m;
}
// several leaves in one paint: each pixel is lit by the leaf it belongs to
function leaves(R, list) {
  const own = new Int8Array(W_ * H_).fill(-1), all = R.M(), Ls = [];
  list.forEach(([x, y, ang, len, w], k) => { const L = leafShape(R, x, y, ang, len, w); Ls.push(L); const a = L.m.a; for (let i = 0; i < a.length; i++) if (a[i]) own[i] = k; all.add(L.m); });
  const lights = Ls.map(L => L.light(.1)), ox = R.V.ox, oy = R.V.oy;
  form(R, all, LEAF, (x, y) => { const k = own[(y + oy) * W_ + x + ox]; return k >= 0 ? lights[k](x, y) : .5; }, { round: 1.5, rim: 1 });
  for (const L of Ls) pline(R, L.rib, LEAF.sh, L.m);
  return all;
}
// a blossom: rounded petals round a dotted centre (one paint; petal gaps drawn as lines)
function blossom(R, x, y, rad, P, { n = 5, rot = 0, squash = 1, center = SUN } = {}) {
  const all = R.M(), C = [];
  for (let k = 0; k < n; k++) {
    const a = rot + k * Math.PI * 2 / n, px2 = x + Math.cos(a) * rad * .62, py2 = y + Math.sin(a) * rad * .62 * squash;
    ell(all, px2, py2, rad * .55, rad * .55 * (squash < 1 ? .85 : 1)); C.push([px2, py2]);
  }
  const pr = rad * .8;
  form(R, all, P, (xx, yy) => {
    let b = 0, d = 1e9; for (let k = 0; k < C.length; k++) { const e = (xx - C[k][0]) ** 2 + (yy - C[k][1]) ** 2; if (e < d) { d = e; b = k; } }
    return sph(C[b][0] - 1, C[b][1] - 1.2, pr, pr)(xx, yy);
  }, { round: 1.5, rim: 1, bias: P === SNOW ? .2 : .16 });
  // gaps between petals
  if (rad >= 3) for (let k = 0; k < n; k++) {
    const a = rot + (k + .5) * Math.PI * 2 / n;
    pline(R, [[x + Math.cos(a) * rad * .45, y + Math.sin(a) * rad * .45 * squash], [x + Math.cos(a) * rad * .8, y + Math.sin(a) * rad * .8 * squash]], P.sh, all);
  }
  const c = R.M().ellipse(x, y, Math.max(.8, rad * .3), Math.max(.8, rad * .3 * squash));
  form(R, c, center, sph(x - .5, y - .5, rad * .4 + .6, rad * .4 + .6), { round: 1, rim: 0 });
  pset(R, x - rad * .15, y - rad * .15, center.hi);
  return all.add(c);
}
hat('flowers', 'Flower Crown', '#f7a8c4', (R, r, v) => {
  const cx = hcx(R), back = v === 'back';
  // the wreath follows the crown of the head, ends lower at the sides
  const path = a => [cx + 36.5 * Math.cos(a), 26 + 27 * Math.sin(a)];
  const A0 = Math.PI * 1.08, A1 = Math.PI * 1.92;
  // twisted vine
  const vine = R.M(), vp = [];
  for (let k = 0; k <= 60; k++) { const [x, y] = path(A0 + (A1 - A0) * k / 60); vp.push([x, y]); ell(vine, x, y, 1.3, 1.3); }
  form(R, vine, ramp('#4f8f4a'), flatL(.45), { round: 1, rim: 1 });
  for (let k = 0; k < 60; k += 4) { const [x, y] = vp[k]; pset(R, x, y - 1, LEAF.lt); }
  drop(R, vine, 0, 2, .7);
  // leaves sticking out on both sides
  const seed = back ? 1 : 0;
  const LL = [];
  for (let k = 0; k < 13; k++) {
    const a = A0 + (A1 - A0) * (k + .5) / 13, [x, y] = path(a), out = k % 2 ? -1 : 1;
    const tang = a + Math.PI / 2, ang = tang + out * (1.0 + ((k + seed) % 3) * .2) + (k < 6 ? 0 : Math.PI);
    LL.push([x, y, ang, 6.5 + ((k + seed) % 2) * 1.5, 4.6]);
  }
  leaves(R, LL);
  // flowers: big blooms in the dye colour, daisies and small buds between
  const P = r, W = SNOW, Y = SUN;
  const blooms = back
    ? [[.1, 4, W], [.27, 5.4, P], [.42, 3.6, Y], [.58, 3.6, BLUEF], [.73, 5.4, P], [.9, 4, W]]
    : [[.07, 3.6, Y], [.2, 5.2, P], [.34, 4.2, W], [.5, 6.2, P], [.66, 4.2, W], [.8, 5.2, P], [.93, 3.6, BLUEF]];
  const fl = R.M();
  for (const [t, rad, col] of blooms) {
    const [x, y] = path(A0 + (A1 - A0) * t);
    const daisy = col === W;
    fl.add(blossom(R, Math.round(x), Math.round(y), rad, col, { n: daisy ? 7 : 5, rot: t * 7, squash: daisy ? .9 : 1, center: col === Y ? ramp('#f08a3c') : SUN }));
  }
  // baby's breath dots
  for (let k = 0; k < 9; k++) {
    const [x, y] = path(A0 + (A1 - A0) * (k + .25) / 9);
    const dx = Math.round(x + (k % 2 ? 2 : -1)), dy = Math.round(y - 3 - (k % 3));
    pset(R, dx + 1, dy, SNOW.lt); pset(R, dx, dy + 1, SNOW.lt); pset(R, dx, dy, [255, 255, 255]); pset(R, dx + 1, dy + 1, SNOW.sh);
  }
  drop(R, fl, 1, 2, .6);
  if (back) {
    // ribbon tied at the back with two trailing tails
    const by = 2, rb = ramp(mix(r.base, [255, 255, 255], .55));
    const tails = R.M();
    for (const s of [-1, 1]) {
      const T = tube(R, [cx + s * 2, by + 2], [cx + s * 7, by + 16], [cx + s * 5, by + 30], t => 3 - t * .6, 22);
      const tm = T.m.keep((x, y) => y < by + 25 - Math.abs(x - cx - s * 4) * (s < 0 ? 1 : -1) * 0);
      form(R, tm, rb, T.light(0), { round: 1.5, rim: 1 });
      R.crease([cx + s * 3, by + 6], [cx + s * 7, by + 17], [cx + s * 5, by + 28], rb, tm, { tone: 4, noLip: s > 0 });
      tails.add(tm);
    }
    const bow = R.M().poly([[cx, by], [cx - 7, by - 5], [cx - 8, by + 2], [cx - 5, by + 4]]).poly([[cx, by], [cx + 7, by - 5], [cx + 8, by + 2], [cx + 5, by + 4]]);
    form(R, bow, rb, sph(cx - 3, by - 3, 9, 6), { round: 1.8, rim: 1 });
    R.crease([cx - 6, by - 2], [cx - 3, by], [cx - 1, by], rb, bow, { tone: 4, lipTone: 2 });
    R.crease([cx + 6, by - 2], [cx + 3, by], [cx + 1, by], rb, bow, { tone: 5, noLip: true });
    form(R, R.M().ellipse(cx, by, 1.6, 2), rb, flatL(.55), { round: 1, rim: 0 });
    drop(R, tails.add(bow), 1, 2, .8);
  }
}, { top: -8 });

// ---------------- angel halo ----------------
hat('halo', 'Angel Halo', '#f2c14e', (R, r, v) => {
  const cx = hcx(R), cy = -15, rx = 22, ry = 5.6, w = 3.2;
  const outer = R.M().ellipse(cx, cy, rx, ry), inner = R.M().ellipse(cx, cy, rx - w * 2, ry - w * .9);
  const ringM = outer.clone().sub(inner);
  // soft glow, fading outward
  const G1 = ringM.clone().dilate(1).sub(ringM), G2 = ringM.clone().dilate(2).sub(ringM).sub(G1), G3 = ringM.clone().dilate(4).sub(ringM).sub(G1).sub(G2);
  const GL = mix(r.base, [255, 252, 225], .7);
  R.fill(G3, GL, 40); R.fill(G2, GL, 90); R.fill(G1, GL, 160);
  // the ring is a tube: shade across it, brighter on the upper-left of the loop
  form(R, ringM, r, (x, y) => {
    const ang = Math.atan2((y - cy) / ry, (x - cx) / rx);
    const d = Math.hypot((x - cx) / (rx - w), (y - cy) / (ry - w * .45));
    const across = cl((d - 1) * 3.2, -1, 1);
    const ny = Math.sin(ang) * across, nx = Math.cos(ang) * across;
    return dot(nx, ny, Math.sqrt(Math.max(0, 1 - across * across))) + .08;
  }, { round: 1.5, rim: 1, shiny: true, bias: .15, edge: (x, y) => mix(r.sh, r.lt, .25) });
  // bright core along the loop
  const core = []; for (let k = 0; k < 72; k++) { const a = k / 72 * Math.PI * 2; core.push([Math.round(cx + (rx - w) * Math.cos(a)), Math.round(cy + (ry - w * .45) * Math.sin(a) - .4)]); }
  pline(R, core.filter(([x, y]) => x < cx - 4 && y < cy + 2 || (y < cy - 2 && x < cx + 10)), r.spec, ringM);
  // sparkles
  R.sparkle(cx - rx + 3, cy - 4, [255, 255, 240], 2);
  R.sparkle(cx + rx - 5, cy + 5, [255, 250, 220], 1);
  R.sparkle(cx + 6, cy - ry - 3, [255, 255, 255], 1);
  // faint light falling on the hair below
  const lightM = R.M().ellipse(cx, 0, 18, 4);
  R.fill(lightM.keep((x, y) => !vacant(R)(x, y)), GL, 35);
}, { top: -24 });

// ---------------- devil horns ----------------
function horn(R, r, p0, p1, p2, w0, { bias = 0, ridges = 4 } = {}) {
  const T = tube(R, p0, p1, p2, t => w0 * Math.pow(1 - t, .9) + .3, 30);
  form(R, T.m, r, T.light(.25), { round: 2.5, bias, shiny: true });
  // growth rings: dark creases across the horn with a lit lip
  for (let k = 1; k <= ridges; k++) {
    const s = T.S[Math.round(k / (ridges + 1.5) * 30)];
    R.crease([s.x - s.nx * s.w, s.y - s.ny * s.w], [s.x - s.dx * 1.2, s.y - s.dy * 1.2], [s.x + s.nx * s.w, s.y + s.ny * s.w], r, T.m, { tone: 5, lipTone: 2 });
  }
  // glossy highlight along the lit flank
  const hl = [];
  for (let k = 3; k < 26; k++) { const s = T.S[k], side = (s.nx * LT[0] + s.ny * LT[1]) > 0 ? 1 : -1; hl.push([Math.round(s.x + s.nx * s.w * .5 * side), Math.round(s.y + s.ny * s.w * .5 * side)]); }
  pline(R, hl.filter((p, i) => i % 5 !== 4), r.spec, T.m.clone().sub(edge(R, T.m, 1, 0)).sub(edge(R, T.m, -1, 0)));
  return T.m;
}
hat('horns', 'Devil Horns', '#c8364a', (R, r, v) => {
  const cx = hcx(R);
  if (v === 'side') {
    horn(R, r, [cx - 2, 5], [cx + 1, -6], [cx + 9, -13], 5, { bias: -.3, ridges: 3 });
    const m = horn(R, r, [cx - 11, 7], [cx - 9, -6], [cx - 1, -15], 6, { bias: -.1 });
    drop(R, m, 1, 2, .8);
  } else {
    for (const s of [-1, 1]) {
      const m = horn(R, r, [cx + s * 16, 6], [cx + s * 30, 0], [cx + s * 26, -16], 6.5, { bias: s > 0 ? -.18 : -.1 });
      drop(R, m, 1, 2, .8);
    }
  }
}, { kind: 'leather', top: -17 });

// ---------------- big bow ----------------
function bigBow(R, r, bx, by, sx = 1, { backSide = false, clip = null } = {}) {
  // sx: horizontal scale (-1 mirrors), backSide: seen from behind (no knot folds), clip: keep(x,y)
  const X = dx => bx + dx * sx, k = (m) => clip ? m.keep(clip) : m;
  const all = R.M();
  const loop = (s) => {
    const pts = [[0, 0], [5, -8], [11, -11], [16, -9], [18, -3], [17, 3], [12, 6], [5, 5]].map(([dx, dy]) => [X(dx * s), by + dy]);
    const m = k(R.M().poly(pts));
    form(R, m, r, sph(X(8 * s) - 3, by - 5, 12, 10), { round: 3, bias: backSide ? -.12 : .06 });
    if (!backSide) {
      // inner fold of the loop near the knot, in shadow
      const inn = k(R.M().poly([[0, 0], [6, -4], [9, -2], [6, 2]].map(([dx, dy]) => [X(dx * s), by + dy]))).and(m);
      form(R, inn, ramp(r.sh), flatL(.3), { round: 1, rim: 0, edge: () => TONE.DP });
    }
    R.crease([X(4 * s), by - 1], [X(10 * s), by - 4], [X(15 * s), by - 7], r, m, { tone: 5, lipTone: 2 });
    R.crease([X(5 * s), by + 2], [X(10 * s), by + 2], [X(15 * s), by + 1], r, m, { tone: 4, lipTone: 2 });
    all.add(m);
  };
  const tail = (s) => {
    const tip = [X(8 * s), by + 19];
    const m = k(R.M().poly([[X(1 * s), by + 2], [X(5 * s), by + 4], [X(11 * s), by + 18], [X(8.5 * s), by + 16], tip, [X(4 * s), by + 20], [X(1 * s), by + 6]]));
    form(R, m, r, (x, y) => dot((x - X(5 * s)) / 6 * sx, -.2, 1) - .12, { round: 2 });
    R.crease([X(2 * s), by + 6], [X(4 * s), by + 11], [X(5 * s), by + 17], r, m, { tone: 4, noLip: s * sx > 0 });
    all.add(m);
  };
  tail(-1); tail(1);
  loop(-1); loop(1);
  const knot = k(R.M().ellipse(bx, by + .5, 3.2, 4));
  form(R, knot, r, sph(bx - 1.5, by - 1, 4, 5), { round: 2, bias: backSide ? -.15 : .05 });
  if (!backSide) { R.crease([bx - 2, by - 2], [bx - 1, by + 1], [bx - 2, by + 3], r, knot, { tone: 4, noLip: true }); pset(R, bx - 1, by - 2, r.hi); }
  all.add(knot);
  drop(R, all, 1, 2, .85);
  return all;
}
hat('bow', 'Big Bow', '#e0475a', (R, r, v) => {
  const cx = hcx(R);
  if (v === 'front') bigBow(R, r, cx + 22, 1);
  else if (v === 'side') bigBow(R, r, cx - 6, -1, .8);
  else bigBow(R, r, cx - 22, 1, -1, { backSide: true, clip: (() => { const vac = vacant(R); return (x, y) => vac(x, y) || y < 4; })() });
}, { top: -12 });

// ---------------- viking helm ----------------
const BRONZE = ramp('#d9a24a', 'metal');
function rivets(R, pts, rr = BRONZE) { for (const [x, y] of pts) { rectP(R, x, y, x + 1, y + 1, rr.dp); pset(R, x, y, rr.spec); } }
hat('viking', 'Viking Helm', '#c9cfdc', (R, r, v) => {
  const cx = hcx(R), cy = 14, rx = 40, ry = 25, bot = smile(cx, rx, 9, 3);
  const hornAt = (s, far) => {
    // ivory horns: sweep out and up, ringed, with a bronze collar at the root
    const p0 = [cx + s * 32, 5], p1 = [cx + s * 52, 1], p2 = [cx + s * 46, -22];
    const m = horn(R, IVORY, p0, p1, p2, 7.5, { bias: far ? -.3 : -.05, ridges: 4 });
    const col = R.M().ellipse(cx + s * 35, 5, 3.5, 6);
    form(R, col, BRONZE, cylX(cx + s * 35 - 1, 4.5), { round: 1.2, rim: 1 });
    return m;
  };
  if (v === 'side') {
    // the far horn shows above the helmet behind the near one
    horn(R, IVORY, [cx + 4, 0], [cx + 2, -12], [cx + 12, -22], 5, { bias: -.35, ridges: 3 });
  }
  const dome = R.M().ellipse(cx, cy, rx, ry).keep((x, y) => y <= bot(x) + 1);
  // polished steel: a sharp highlight spot top-left, dark core, reflected light at the rim
  form(R, dome, r, (x, y) => {
    const I = sph(cx - 4, cy, rx + 2, ry + 3)(x, y);
    return I < .15 && (x - cx) / rx > .55 ? I + .25 : I;
  }, { round: 3, bias: -.3 });
  const spot = R.M().ellipse(cx - 18, -2, 5, 2.5).and(dome);
  R.fill(spot, r.hi); R.fill(R.M().ellipse(cx - 19, -3, 2.5, 1).and(dome), r.spec);
  // riveted straps along the meridians
  const hw = y => rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
  for (const phi of [0, 60, -60, 120, -120, 180]) {
    const p = around(R, phi, 1); if (p.c < .2) continue;
    const strap = R.M();
    for (let y = cy - ry + 1; y <= bot(cx) + 1; y++) { const x = cx + hw(y) * p.s * .97; strap.ellipse(x, y, Math.max(.5, 2.2 * p.c), .5); }
    strap.and(dome);
    form(R, strap, BRONZE, (x, y) => sph(cx - 4, cy, rx + 2, ry + 3)(x, y) + .1, { round: 1.2, rim: 1 });
    const rv = []; for (let y = cy - ry + 5; y <= 7; y += 4) rv.push([Math.round(cx + hw(y) * p.s * .97), y]);
    rivets(R, rv);
  }
  // brow band with rivets and an engraved zig-zag
  const band = bandM(R, cx, rx + 1.5, 8, 16, 3);
  form(R, band, BRONZE, null, { round: 1.5, rim: 1, tone: (x) => metalU((x - cx) / (rx + 1.5)) });
  const zz = []; for (let x = Math.round(cx - rx + 4); x <= cx + rx - 4; x++) zz.push([x, Math.round(smile(cx, rx, 11.5, 3)(x) + tri(x, 6, 3) - 1)]);
  pline(R, zz, BRONZE.dp, band);
  const rv = []; for (let k = -6; k <= 6; k++) { const p = around(R, k * 15 + (v === 'side' ? 0 : 0), rx); if (p.c > .2) rv.push([Math.round(p.x), Math.round(smile(cx, rx, 9, 3)(p.x)) + 1], [Math.round(p.x), Math.round(smile(cx, rx, 14, 3)(p.x))]); }
  rivets(R, rv, BRONZE);
  drop(R, band, 0, 2);
  // nose guard
  const ng = around(R, 0, rx);
  if (ng.c > .2) {
    const nx = Math.round(ng.x), w = Math.max(1, Math.round(2.5 * ng.c));
    const g = R.M().poly([[nx - w - 1, 15], [nx + w + 1, 15], [nx + w, 27], [nx, 29], [nx - w, 27]]);
    form(R, g, r, cylX(nx - 1, w + 3), { round: 1.2, rim: 1, bias: .05 });
    rivets(R, [[nx - 1, 18]], BRONZE);
    drop(R, g, 1, 2);
  }
  if (v === 'side') {
    const m = horn(R, IVORY, [cx + 1, 6], [cx - 4, -6], [cx + 3, -21], 6.5, { ridges: 4 });
    const col = R.M().ellipse(cx + 1, 7, 5.5, 3.5);
    form(R, col, BRONZE, sph(cx - 1, 6, 6, 4), { round: 1.2, rim: 1 });
    drop(R, m, 1, 2, .7);
  } else for (const s of [-1, 1]) drop(R, hornAt(s, false), 1, 2, .6);
}, { kind: 'metal', top: -29 });

// ---------------- rogue bandana ----------------
// knot with two flaring tails; dir = +1 tails to the right (side view: behind the head)
function knotTails(R, r, kx, ky, mode, clip) {
  const all = R.M(), k = m => clip ? m.keep(clip) : m;
  const tails = mode === 'side'
    ? [[[kx + 1, ky + 1], [kx + 10, ky + 6], [kx + 13, ky + 16], 4.2], [[kx, ky + 2], [kx + 5, ky + 11], [kx + 4, ky + 22], 4.6]]
    : [[[kx - 1, ky + 2], [kx - 6, ky + 11], [kx - 5, ky + 21], 4.4], [[kx + 1, ky + 2], [kx + 7, ky + 10], [kx + 8, ky + 19], 4.2]];
  for (const [p0, p1, p2, w] of tails) {
    const T = tube(R, p0, p1, p2, t => w * (.55 + .45 * t) / 1 + .2, 20);
    // forked (notched) end
    const tip = T.S[T.S.length - 1], notch = R.M().poly([[tip.x - tip.nx * 2, tip.y - tip.ny * 2], [tip.x - tip.dx * 3.5, tip.y - tip.dy * 3.5], [tip.x + tip.nx * 2, tip.y + tip.ny * 2], [tip.x + tip.dx * 2, tip.y + tip.dy * 2]]);
    const m = k(T.m.sub(notch));
    form(R, m, r, T.light(-.1), { round: 2, bias: -.06 });
    R.crease([p0[0], p0[1] + 2], [p1[0] - 1, p1[1]], [p2[0] - 1, p2[1] - 3], r, m, { tone: 4, lipTone: 2 });
    all.add(m);
  }
  // the knot and its two little flaps
  const flaps = k(R.M().ellipse(kx - 4, ky - 1, 3.5, 2.5).ellipse(kx + 4, ky - 1, 3.5, 2.5));
  form(R, flaps, r, sph(kx - 3, ky - 3, 6, 4), { round: 1.5, bias: -.05 });
  const knot = k(R.M().ellipse(kx, ky, 3, 3));
  form(R, knot, r, sph(kx - 1, ky - 1, 3.5, 3.5), { round: 1.5, bias: .05 });
  R.crease([kx - 2, ky - 1], [kx, ky + 1], [kx + 2, ky], r, knot, { tone: 5, noLip: true });
  all.add(flaps).add(knot);
  drop(R, all, 1, 2, .9);
  return all;
}
hat('bandana', 'Rogue Bandana', '#34303d', (R, r, v) => {
  const cx = hcx(R), cy = 14, rx = 40, ry = 22, hem = smile(cx, rx, 12, 3.5);
  const PAT = ramp(mix(r.base, [250, 246, 240], lum(r.base) > 170 ? .1 : .82));
  const PR = lum(r.base) > 170 ? ramp(mix(r.base, [40, 30, 50], .55)) : PAT;
  // tails behind the head first (front view: they peek out on one side)
  if (v === 'front') knotTails(R, r, cx + 33, 16, 'front', vacant(R));
  const cloth = R.M().ellipse(cx, cy, rx, ry).keep((x, y) => y <= hem(x) + 1);
  // paisley-ish print: small teardrops and dots on a diagonal grid, plus a border row near the hem
  const motif = (x, y) => {
    const dy = hem(x) - y;
    if (dy >= 3 && dy <= 4) return ((x >> 1) & 1) ? PR : false;   // dotted border above the hem
    if (dy < 7) return false;
    // staggered flower-dots: a 2x2 dot with four petals every 8px
    const row = Math.floor((y + 40) / 7), gx = ((x + (row & 1) * 4) % 8 + 8) % 8, gy = ((y + 40) % 7 + 7) % 7;
    if ((gx === 3 || gx === 4) && (gy === 2 || gy === 3)) return PR;
    if ((gx === 2 || gx === 5) && (gy === 1 || gy === 4) && ((gx + gy) & 1)) return PR;
    return false;
  };
  form(R, cloth, r, sph(cx - 6, cy + 2, rx + 3, ry + 6), { round: 3, bias: -.12, pattern: motif });
  // folds pulling back toward the knot
  const pull = v === 'side' ? 1 : 0;
  if (v !== 'back') {
    R.crease([cx - 30 + pull * 40, 6], [cx - 20 + pull * 30, -2], [cx - 6 + pull * 26, -6], r, cloth, { tone: 5, lipTone: 2 });
    R.crease([cx + 32 - pull * 6, 8], [cx + 26 - pull * 2, 0], [cx + 14 + pull * 6, -5], r, cloth, { tone: 5, noLip: true });
    R.crease([cx - 18 + pull * 32, 10], [cx - 8 + pull * 30, 4], [cx + 2 + pull * 30, 2], r, cloth, { tone: 4, lipTone: 2 });
  } else {
    for (const s of [-1, 1]) R.crease([cx + s * 30, 2], [cx + s * 14, 6], [cx + s * 4, 12], r, cloth, { tone: 5, noLip: s > 0 });
  }
  // rolled hem
  const hemM = cloth.clone().keep((x, y) => y >= hem(x) - 2);
  form(R, hemM, r, cylY(hem(cx) - 1, 2.5), { round: 1.2, rim: 1, bias: -.05 });
  R.stitch(Array.from({ length: Math.round(rx * 2 - 8) }, (_, k) => { const x = Math.round(cx - rx + 4 + k); return [x, Math.round(hem(x) - 1)]; }), r.lt, hemM, 1, 2);
  drop(R, cloth, 0, 2);
  if (v === 'side') knotTails(R, r, cx + 36, 11, 'side');
  if (v === 'back') knotTails(R, r, cx, 13, 'back');
}, { top: -9 });

// ---------------- captain tricorn ----------------
function feather(R, base, ctrl, tip, w, F, { barbs = true } = {}) {
  // vane with a ragged edge, a shaft, and barb lines raking toward the tip
  const T = tube(R, base, ctrl, tip, t => (w * Math.sin(Math.PI * Math.min(1, .12 + t * .95)) + .3) * (t > .1 ? 1 - .3 * ((t * 15) % 1) : 1), 40);
  form(R, T.m, F, T.light(.1), { round: 2, rim: 1, bias: .05 });
  pline(R, R.curve(base, ctrl, tip), F.dp, T.m);
  pline(R, R.curve(base, ctrl, tip).map(([x, y]) => [x - 1, y]), F.hi, T.m);
  if (barbs) for (let k = 4; k < 38; k += 3) {
    const s = T.S[k];
    for (const side of [-1, 1]) {
      const e = [s.x + s.nx * s.w * .95 * side + s.dx * 3, s.y + s.ny * s.w * .95 * side + s.dy * 3];
      pline(R, R.curve([s.x + s.nx * side, s.y + s.ny * side], [s.x + s.nx * s.w * .5 * side + s.dx * 1.2, s.y + s.ny * s.w * .5 * side + s.dy * 1.2], e), side > 0 ? F.dp : F.sh, T.m);
    }
  }
  return T.m;
}
hat('tricorn', 'Captain Tricorn', '#34303d', (R, r, v) => {
  const cx = hcx(R), front = v === 'front', back = v === 'back';
  // crown rising behind the upturned brim
  const crown = R.M().ellipse(cx, 4, 25, 20).keep((x, y) => y <= 4);
  form(R, crown, r, sph(cx - 6, 2, 28, 24), { round: 3, bias: -.2 });
  R.crease([cx - 12, -9], [cx - 4, -11], [cx + 2, -15], r, crown, { tone: 5, lipTone: 2 });
  // plume tucked in on one side, curling back over the crown
  const fs = back ? 1 : -1;
  // (an ostrich plume: it arcs up and droops back down past the brim tip)
  const plume = feather(R, [cx + fs * 12, -2], [cx + fs * 30, -34], [cx + fs * 50, -10], 6.5, SNOW);
  drop(R, plume, 1, 2, .7);
  // two upturned brim panels meeting at the corner in the middle, tips swept up at the sides
  const panel = (s) => {
    const pts = [[cx, 11], [cx, -4], [cx + s * 12, -6], [cx + s * 24, -9], [cx + s * 36, -13], [cx + s * 46, -19], [cx + s * 46, -13], [cx + s * 40, -4], [cx + s * 28, 4], [cx + s * 14, 9]];
    const m = R.M().poly(pts);
    form(R, m, r, (x, y) => dot(-s * .5, -.2 + (y + 6) / 22 * .35, 1) + (s < 0 ? .12 : -.12), { round: 2.5, bias: -.14 });
    // the brim rolls up: a soft fold along it and a lit ridge
    R.crease([cx + s * 4, 8], [cx + s * 22, 2], [cx + s * 40, -8], r, m, { tone: s < 0 ? 4 : 5, lipTone: 2, noLip: s > 0 });
    return m;
  };
  const L = panel(-1), Rm = panel(1), both = L.clone().add(Rm);
  // gold braid along the top edge
  const top = edge(R, both, 0, -1);
  const braid = edge(R, both, 0, -3).sub(top).sub(edge(R, both, 1, 0)).sub(edge(R, both, -1, 0));
  braid.each((x, y) => pset(R, x, y, (x + y) % 3 === 0 ? GOLDM.sh : (x + y) % 3 === 1 ? GOLDM.hi : GOLDM.base));
  R.fill(top, GOLDM.line);
  // the corner seam where the panels meet
  pline(R, R.curve([cx, -3], [cx + 1, 3], [cx, 10]), r.line, both);
  pline(R, R.curve([cx - 1, -2], [cx, 3], [cx - 1, 9]), r.lt, L);
  drop(R, both, 0, 3);
  if (front) {
    // skull and crossbones on the front corner
    const bones = R.M().line(cx - 7, 8, cx + 7, -2, 2).line(cx + 7, 8, cx - 7, -2, 2);
    for (const [x, y] of [[cx - 8, 9], [cx + 8, 9], [cx - 8, -3], [cx + 8, -3]]) bones.ellipse(x, y, 1.4, 1.4);
    form(R, bones, IVORY, flatL(.66), { round: 1, rim: 1 });
    const skull = R.M().ellipse(cx, 1, 5.2, 4.6).rect(cx - 3, 3, cx + 3, 7);
    form(R, skull, IVORY, sph(cx - 2, -1, 7, 7), { round: 1.5, rim: 1, bias: .1 });
    (rectP(R, cx - 3, 1, cx - 2, 3, BLACK.dp), rectP(R, cx + 2, 1, cx + 3, 3, BLACK.dp));
    (pset(R, cx - 3, 1, BLACK.sh), pset(R, cx + 2, 1, BLACK.sh));
    pset(R, cx, 4, BLACK.sh);
    (pset(R, cx - 2, 7, IVORY.dp), pset(R, cx, 7, IVORY.dp), pset(R, cx + 2, 7, IVORY.dp));
    drop(R, skull, 1, 1, .6);
  } else {
    // a gold cockade button on the corner
    R.paint(R.M().ellipse(cx, 1, 3, 3), GOLDM, { flat: true, round: 1.5, shiny: true });
    pset(R, cx - 1, 0, [255, 255, 255]);
  }
}, { top: -36 });

// ---------------- mushroom cap ----------------
hat('mushroom', 'Mushroom Cap', '#f08a3c', (R, r, v) => {
  const cx = hcx(R), cy = 10, rx = 48, ry = 27, rim = smile(cx, rx, 9, 4);
  const cap = R.M().ellipse(cx, cy, rx, ry).keep((x, y) => y <= rim(x) + 1);
  form(R, cap, r, sph(cx - 10, cy + 4, rx + 4, ry + 8), { round: 4, bias: -.22, shiny: true });
  // glossy highlight
  const gl = R.M().ellipse(cx - 22, -6, 8, 3.5).and(cap);
  R.fill(gl, r.hi); R.fill(R.M().ellipse(cx - 24, -7, 4, 1.4).and(cap), r.spec);
  // rolled rim: the cap edge curls under
  form(R, cap.clone().keep((x, y) => y >= rim(x) - 2), r, cylY(rim(cx) - 1, 2.5), { round: 1, rim: 1, bias: -.15 });
  // spots, laid out round the cap so every view shows a consistent set
  const SP = lum(r.base) > 215 ? ramp('#e0475a') : SNOW;
  // pale underside with gills peeking out below the rim
  const under = R.M().ellipse(cx, rim(cx) - 1, 42, 4.5).keep((x, y) => y > rim(x));
  form(R, under, CREAM, cylX(cx - 4, 44, -.5), { round: 1.2, rim: 0, bias: -.1 });
  for (let x = Math.round(cx - 38); x <= cx + 38; x += 3) pline(R, R.curve([x, Math.round(rim(x)) + 1], [x + (x - cx) * .03, Math.round(rim(x)) + 2], [x + (x - cx) * .06, Math.round(rim(x)) + 4]), CREAM.sh, under);
  drop(R, under, 0, 2, .8);
  const spots = [[-8, .55, 8.5], [42, .5, 7.5], [-58, .3, 6.5], [95, .28, 6.5], [160, .42, 7.5], [-118, .38, 7], [15, .12, 5], [-34, .06, 4.5], [68, .1, 4.8], [-88, .72, 5], [128, .74, 5.5], [205, .12, 4.5]];
  const all = R.M();
  for (const [phi, el, sz] of spots) {
    const p = around(R, phi, 1); if (p.c < .15) continue;
    const ce = Math.cos(el * Math.PI / 2), x = cx + rx * .92 * ce * p.s, y = cy - ry * Math.sin(el * Math.PI / 2) * .95 - 2;
    const sw = sz * Math.max(.35, p.c), sh = sz * (.45 + .5 * Math.sin(el * Math.PI / 2));
    const m = R.M().ellipse(x, y, sw, sh).and(cap.clone().sub(edge(R, cap, 0, -1)));
    for (let k = 0; k < 5; k++) { const a = k * 1.3 + phi; m.ellipse(x + Math.cos(a) * sw * .6, y + Math.sin(a) * sh * .6, sw * .45, sh * .45); }
    m.and(cap);
    form(R, m, SP, (xx, yy) => sph(x - sw * .4, y - sh * .5, sw * 1.6, sh * 1.6)(xx, yy) * .6 + sph(cx - 10, cy + 4, rx + 4, ry + 8)(xx, yy) * .4 + .1, { round: 1.5, rim: 1, edge: () => mix(r.dp, SP.dp, .4) });
    all.add(m);
  }
  drop(R, all, 1, 1, .35);
  drop(R, cap, 0, 3);
}, { top: -18 });

// ---------------- froggy hat ----------------
hat('frog', 'Froggy Hat', '#5bb36a', (R, r, v) => {
  const cx = hcx(R), cy = 13, rx = 40, ry = 23, hem = smile(cx, rx, 11, 3.5);
  const BELLY = ramp(mix(r.base, [252, 246, 210], .78));
  const eye = (x, y, { look = true, far = false, sx = 1 } = {}) => {
    const mound = R.M().ellipse(x, y, 8.5 * sx, 8);
    form(R, mound, r, sph(x - 3, y - 3, 10, 10), { round: 3, bias: far ? -.3 : -.05 });
    if (!look) return mound;
    const ball = R.M().ellipse(x - .5 * sx, y - .5, 5.6 * sx, 5.4);
    form(R, ball, SNOW, sph(x - 2, y - 2, 7, 7), { round: 2, rim: 1, bias: .1 });
    const pup = R.M().ellipse(x + (v === 'side' ? -1.5 : 0), y + .5, 2.2 * sx, 2.8);
    R.fill(pup, BLACK.dp); rectP(R, Math.round(x - 1 * sx) - (v === 'side' ? 2 : 0), Math.round(y - 1), Math.round(x - 1 * sx) - (v === 'side' ? 2 : 0), Math.round(y), [255, 255, 255]);
    // sleepy lid line across the top of the eyeball
    pline(R, R.curve([x - 5.5 * sx, y - 2], [x, y - 6.5], [x + 5.5 * sx, y - 2]), r.dp, ball);
    pline(R, R.curve([x - 5.5 * sx, y - 3], [x, y - 7.5], [x + 5.5 * sx, y - 3]), r.base, ball);
    return mound;
  };
  const back = v === 'back', side = v === 'side';
  // eyes sit up on top of the dome
  if (side) eye(cx - 8, -9, { far: true, look: false, sx: .8 });
  const dome = R.M().ellipse(cx, cy, rx, ry).keep((x, y) => y <= hem(x) + 1);
  form(R, dome, r, sph(cx - 6, cy + 2, rx + 3, ry + 6), { round: 3, bias: -.2 });
  // plush seams down the dome
  for (const phi of [-60, 60, 180]) {
    const p = around(R, phi, 1); if (p.c < .25) continue;
    const pts = []; for (let y = cy - ry + 3; y <= hem(cx) - 2; y++) pts.push([Math.round(cx + rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)) * p.s * .96), y]);
    R.stitch(pts, r.sh, dome, 1, 1);
  }
  // belly-coloured turned-up brim
  const brim = dome.clone().keep((x, y) => y >= hem(x) - 4);
  form(R, brim, BELLY, cylX(cx - 6, rx + 4, .2), { round: 1.5, rim: 1 });
  R.stitch(Array.from({ length: Math.round(rx * 2 - 6) }, (_, k) => { const x = Math.round(cx - rx + 3 + k); return [x, Math.round(hem(x) - 2)]; }), BELLY.sh, brim, 1, 1);
  drop(R, dome, 0, 2);
  if (side) {
    eye(cx - 18, -7, { sx: .85 });
  } else {
    for (const s of [-1, 1]) eye(cx + s * 17, -8, { look: !back });
  }
  if (!back) {
    // wide smile, nostrils and blush
    const m0 = side ? [cx - 39, 4] : [cx - 22, 3], m1 = side ? [cx - 30, 9] : [cx, 9], m2 = side ? [cx - 18, 6] : [cx + 22, 3];
    pline(R, R.curve(m0, m1, m2), r.line, dome);
    pline(R, R.curve([m0[0] + 1, m0[1] + 1], [m1[0], m1[1] + 1], [m2[0] - 1, m2[1] + 1]), r.lt, dome);
    const blush = side ? [[cx - 22, 7]] : [[cx - 28, 6], [cx + 28, 6]];
    for (const [bx, by] of blush) { R.fill(R.M().ellipse(bx, by, 3.2, 1.5).and(dome), mix(r.base, [246, 128, 160], .78)); R.fill(R.M().set(bx - 1, by - 1).set(bx, by - 1).and(dome), mix(r.base, [255, 214, 226], .85)); }
    const nos = side ? [[cx - 36, -2]] : [[cx - 4, -1], [cx + 4, -1]];
    for (const [nx, ny] of nos) rectP(R, nx, ny, nx + 1, ny, r.dp);
  }
}, { top: -17 });

// ---------------- headphones ----------------
hat('phones', 'Headphones', '#f7a8c4', (R, r, v) => {
  const cx = hcx(R), side = v === 'side';
  const MET = SILVERM, PAD = ramp('#4a4452');
  // big hair: the band stretches over it while the cups stay on the ears
  const hair = R.state && R.state.equip && R.state.equip.hair, L = (hair && HAIR_LIFT[hair.id]) || 0;
  const cup = (x, y, faceOn, s) => {
    if (faceOn) {
      // seen face-on: round shell, metal ring, emblem
      const shell = R.M().ellipse(x, y, 10.5, 11.5);
      form(R, shell, r, sph(x - 3, y - 4, 13, 14), { round: 3, bias: -.05 });
      const ringM = R.M().ellipse(x, y, 7.5, 8.5).sub(R.M().ellipse(x, y, 5.5, 6.5));
      form(R, ringM, MET, (xx, yy) => sph(x - 3, y - 3, 9, 10)(xx, yy) + ((xx - x) + (yy - y) > 0 ? -.3 : .2), { round: 1.2, rim: 0, shiny: true });
      const face = R.M().ellipse(x, y, 5, 6);
      form(R, face, ramp(r.sh), sph(x + 2, y + 2, 7, 8), { round: 2, rim: 1, bias: -.05 });
      // little heart emblem
      const hx = Math.round(x), hy = Math.round(y) - 1;
      const heart = R.M().rect(hx - 2, hy, hx - 1, hy).rect(hx + 1, hy, hx + 2, hy).rect(hx - 2, hy + 1, hx + 2, hy + 1).rect(hx - 1, hy + 2, hx + 1, hy + 2).set(hx, hy + 3);
      R.fill(heart, r.hi); pset(R, hx - 2, hy, [255, 255, 255]); (pset(R, hx + 1, hy + 2, r.lt), pset(R, hx, hy + 3, r.lt));
      drop(R, shell, 1, 2, .8);
      return shell;
    }
    // edge-on: cushion toward the head, shell outward
    const pad = R.M().ellipse(x - s * 3, y, 4, 10.5);
    form(R, pad, PAD, cylX(x - s * 3 - 1, 5), { round: 2, rim: 1 });
    const shell = R.M().ellipse(x + s * 2, y, 5.5, 11.5);
    form(R, shell, r, (xx, yy) => cylX(x + s * 2 - 2, 7)(xx, yy) - (yy - y) / 30, { round: 2.5, bias: -.02 });
    const ringM = R.M().rect(x + s * 2 - 1, y - 10, x + s * 2 + 1, y + 10).and(shell);
    form(R, ringM, MET, cylX(x + s * 2 - 1, 3), { round: 1, rim: 0, shiny: true });
    drop(R, pad.clone().add(shell), 1, 2, .8);
    return shell;
  };
  if (side) {
    // seen from the side the band is a ring running ear to ear, i.e. a straight bar over the ear
    const bx = cx + 7;
    const bandM2 = R.M().rect(bx - 1, -4 - L, bx + 2, 40);
    form(R, bandM2, MET, cylX(bx, 3), { round: 1.2, shiny: true });
    const pad = R.M().rect(bx - 3, -5 - L, bx + 4, 12 - L).add(R.M().rect(bx - 2, -7 - L, bx + 3, -5 - L)).add(R.M().rect(bx - 1, -8 - L, bx + 2, -7 - L));
    form(R, pad, r, (x, y) => cylX(bx - 1, 6)(x, y) + (y < -4 - L ? .25 : 0) - (y - 2 + L) / 50, { round: 2, bias: -.05 });
    R.stitch(R.curve([bx - 1, -5 - L], [bx - 1, 3 - L], [bx - 1, 10 - L]), r.lt, pad, 1, 1);
    R.stitch(R.curve([bx + 2, -5 - L], [bx + 2, 3 - L], [bx + 2, 10 - L]), r.sh, pad, 1, 1);
    drop(R, bandM2.clone().add(pad), 1, 2, .8);
    const yoke = R.M().rect(bx - 2, 33, bx + 3, 41);
    form(R, yoke, MET, cylX(bx, 4), { round: 1, rim: 1, shiny: true });
    cup(bx + 3, 51, true, 1);
    return;
  }
  // front / back: band over the top, padded in the middle
  const bandM2 = R.M().ellipse(cx, 30, 42.5 + L * .35, 37.5 + L).sub(R.M().ellipse(cx, 30, 39 + L * .35, 34 + L)).keep((x, y) => y < 34);
  form(R, bandM2, MET, (x, y) => sph(cx - 6, 24, 44, 40)(x, y) + .1, { round: 1.5, shiny: true });
  const pad = R.M().ellipse(cx, 30, 41.5 + L * .35, 40 + L).sub(R.M().ellipse(cx, 30, 37 + L * .35, 34.5 + L)).keep((x, y) => y < 8 - L * .6);
  form(R, pad, r, sph(cx - 8, 6 - L, 30, 16), { round: 2.5, bias: -.05 });
  const st = []; for (let a = Math.PI * 1.22; a <= Math.PI * 1.78; a += .02) st.push([Math.round(cx + (39.4 + L * .35) * Math.cos(a)), Math.round(30 + (37.4 + L) * Math.sin(a))]);
  R.stitch(st, r.lt, pad, 1, 2);
  drop(R, bandM2.clone().add(pad), 0, 2, .8);
  for (const s of [-1, 1]) {
    const yx = cx + s * (41 + L * .3);
    const yoke = R.M().rect(yx - 2, 30, yx + 2, 39);
    form(R, yoke, MET, cylX(yx - 1, 4), { round: 1, rim: 1, shiny: true });
    cup(yx, 48, false, s);
  }
}, { top: -60 });

// ================= new headwear =================

// ---------------- tiara ----------------
// thin metal wire: lit top edge, shaded underside, dark outline drawn outside the wire
function wire(R, m, r, cx, clip) {
  const o = m.clone().dilate(1).sub(m);
  if (clip) o.keep(clip);
  R.fill(o, mix(r.line, r.dp, .35));
  const has = fh(m);
  m.each((x, y) => {
    const up = !has(x, y - 1), dn = !has(x, y + 1), lft = x < cx;
    pset(R, x, y, up ? (lft ? r.spec : r.hi) : dn ? r.sh : (lft ? r.lt : r.base));
  });
}
hat('tiara', 'Jewel Tiara', '#c9cfdc', (R, r, v) => {
  const cx = hcx(R), side = v === 'side', back = v === 'back';
  const GEM = lum(r.base) > 150 && r.base[2] >= r.base[0] ? ROSE : SAPH;
  const vac = back ? vacant(R) : null;
  const clip = m => vac ? m.keep((x, y) => vac(x, y)) : m;
  // band: a metal arc over the top of the head, beaded along its top edge
  const band = side
    ? R.M().ellipse(cx + 2, 30, 26, 34).sub(R.M().ellipse(cx + 2, 30, 23, 31)).keep((x, y) => y < 12 && x < cx + 8)
    : R.M().ellipse(cx, 30, 35.5, 30.5).sub(R.M().ellipse(cx, 30, 32.5, 27.5)).keep((x, y) => y < 14);
  if (!back) {
    form(R, band, r, (x, y) => sph(cx - 6, 20, 38, 34)(x, y) + .1, { round: 1.2, rim: 1, shiny: true, edge: () => mix(r.line, r.dp, .35) });
    const top = edge(R, band, 0, -1);
    top.each((x, y) => { if ((x & 1) === 0) pset(R, x, y + 1, x < cx ? r.spec : r.hi); });
    drop(R, band, 0, 2, .7);
  }
  // filigree peak at the front: scrolls rising to a big teardrop jewel
  const ox = side ? cx - 23 : cx, py = side ? 1 : 2, sx = side ? .45 : 1.15;
  const X = dx => ox + dx * sx;
  const fil = R.M();
  const scroll = (list) => { for (const [a, b, c] of list) for (const [x, y] of R.curve(a, b, c)) { fil.set(x, y); fil.set(x + 1, y); } };
  for (const s of [-1, 1]) {
    scroll([
      [[X(s * 2), py], [X(s * 9), py - 1], [X(s * 13), py - 6]],
      [[X(s * 13), py - 6], [X(s * 15), py - 12], [X(s * 10), py - 13]],
      [[X(s * 10), py - 13], [X(s * 6), py - 11], [X(s * 9), py - 8]],
      [[X(s * 3), py - 2], [X(s * 7), py - 10], [X(s * 3), py - 17]],
      [[X(s * 16), py + 1], [X(s * 22), py - 2], [X(s * 21), py - 8]],
      [[X(s * 21), py - 8], [X(s * 20), py - 11], [X(s * 17), py - 9]],
    ]);
  }
  scroll([[[X(-3), py - 17], [X(0), py - 23], [X(3), py - 17]]]);
  fil.rect(X(-19), py - 1, X(19), py + 1);
  const F = clip(fil);
  wire(R, F, r, ox, vac);
  drop(R, F, 1, 2, .6);
  if (!back) {
    // jewels: teardrop centre in a setting, round side stones, pearls on the scroll tips
    const tx = Math.round(ox), ty = py - 9;
    R.paint(R.M().ellipse(tx, ty + 1, 4 * sx + .6, 4.6).poly([[tx - 3.6 * sx, ty], [tx + 3.6 * sx, ty], [tx, ty - 8.5]]), r, { flat: true, round: 1.2, shiny: true });
    const drp = R.M().ellipse(tx, ty + 1, 3 * sx + .3, 3.4).poly([[tx - 2.6 * sx, ty], [tx + 2.6 * sx, ty], [tx, ty - 6.5]]);
    form(R, drp, GEM, sph(tx - 1, ty - 1, 4, 5), { round: 1.5, rim: 1, shiny: true });
    pset(R, tx - 1, ty - 1, [255, 255, 255]); pset(R, tx - 1, ty, [255, 255, 255]); pset(R, tx - 1, ty - 3, GEM.hi);
    pset(R, tx + 1, ty + 3, GEM.hi);
    for (const s of [-1, 1]) {
      if (side && s > 0) continue;
      setGem(R, Math.round(X(s * 11)), py - 2, 1, GEM === ROSE ? SAPH : ROSE, r, false);
      const pr = [[X(s * 10), py - 14], [X(s * 22), py - 10], [X(s * 4), py - 18]];
      for (const [x, y] of pr) { R.paint(R.M().ellipse(Math.round(x), Math.round(y), 1.4, 1.4), PEARL, { flat: true, round: 1, shiny: true }); pset(R, Math.round(x) - 1, Math.round(y) - 1, [255, 255, 255]); }
    }
    R.sparkle(tx + 6, ty - 8, [255, 255, 255], 2);
    R.sparkle(Math.round(X(-21)), py - 14, [255, 250, 235], 1);
  }
}, { kind: 'metal', top: -24 });

// ---------------- beret ----------------
hat('beret', 'Artist Beret', '#a33a4f', (R, r, v) => {
  const cx = hcx(R), side = v === 'side';
  // tilt: the soft crown droops toward one side (behind the head in side view)
  const s = v === 'back' ? -1 : 1, ang = (side ? 9 : 7) * s * Math.PI / 180, ox = cx + (side ? 7 : 6 * s), oy = -2;
  const rx = side ? 39 : 41, ry = 13;
  const body = R.M().poly(ring(ox, oy, rx, ry, 64, (a, c, sn) => {
    const x = rx * c, y = ry * sn + (sn > 0 ? 2.5 * sn : 0);   // a little fuller underneath
    return [ox + x * Math.cos(ang) - y * Math.sin(ang), oy + x * Math.sin(ang) + y * Math.cos(ang)];
  }));
  // head band under the crown
  const BAND = ramp(mix(r.base, [30, 20, 35], .35));
  const band = bandM(R, cx + 2 * s, 34.5, 6, 11, 2.5);
  form(R, band, BAND, cylX(cx - 4, 40, .1), { round: 1.5, rim: 1 });
  R.stitch(Array.from({ length: 66 }, (_, k) => { const x = Math.round(cx + 2 * s - 33 + k); return [x, Math.round(smile(cx + 2 * s, 34.5, 8.5, 2.5)(x))]; }), BAND.lt, band, 1, 2);
  // felt crown: soft, puffy, lit from the top-left
  form(R, body, r, (x, y) => sph(ox - 8, oy + 3, rx + 4, ry + 9)(x, y), { round: 4, bias: -.14 });
  // soft drape folds where it hangs over the low side
  const lowX = ox + rx * .78 * s;
  R.crease([lowX - 12 * s, oy - 6 + ang * 30], [lowX - 6 * s, oy - 1 + ang * 40], [lowX - 2 * s, oy + 8 + ang * 40], r, body, { tone: 4, lipTone: 2, noLip: s < 0 });
  R.crease([lowX - 2 * s, oy - 8 + ang * 40], [lowX + 3 * s, oy - 2 + ang * 40], [lowX + 4 * s, oy + 6 + ang * 40], r, body, { tone: 5, noLip: true });
  R.crease([ox - rx * .6 * s, oy + 2 - ang * 25], [ox - rx * .3 * s, oy + 7], [ox, oy + 9], r, body, { tone: 4, lipTone: 2 });
  drop(R, body, 0, 2);
  // little stalk on top
  const tp = [ox + Math.sin(ang) * ry * .9, oy - ry * .95];
  const stalk = R.lock([tp[0], tp[1] + 1], [tp[0] + 1, tp[1] - 2], [tp[0] + 3 * s, tp[1] - 3], 2.6, 1.6);
  form(R, stalk, r, flatL(.45), { round: 1, rim: 1 });
  // pin with a jewel on the front
  const pn = around(R, -35, 34);
  if (pn.c > .2) {
    const bx = Math.round(pn.x), by = Math.round(oy + 7 + (bx - ox) * Math.tan(ang));
    setGem(R, bx, by, 1.4, lum(r.base) < 120 || r.base[0] > r.base[2] ? SAPH : RUBY, GOLDM, true);
    // two little ribbon tails under the pin
    const tl = R.M().poly([[bx - 1, by + 2], [bx - 4, by + 9], [bx - 2, by + 8], [bx - 1, by + 10], [bx + 1, by + 3]]);
    form(R, tl, GOLDM, flatL(.6), { round: 1, rim: 1 });
  }
}, { top: -20 });

// ---------------- straw hat ----------------
hat('strawhat', 'Straw Sun Hat', '#f2d38a', (R, r, v) => {
  const cx = hcx(R), side = v === 'side', back = v === 'back';
  const hueR = r.base[0] > r.base[1] * 1.5 && r.base[0] > r.base[2] * 1.5;
  const RIB = hueR ? ramp('#3f6fd8') : ramp('#e0475a');
  // brim: wide disc with woven rings and radial strands
  const bcx = cx, bcy = 8, brx = 50, bry = 10;
  const brim = R.M().poly(ring(bcx, bcy, brx, bry, 72, (a, c, s) => [bcx + brx * c, bcy + bry * s + 1.5 * c * c + (s > 0 ? .8 * s : 0)]));
  const lip = edge(R, brim, 0, 2).keep((x, y) => y > bcy), inLip = fh(lip);
  form(R, brim, r, (x, y) => dot((x - bcx) / brx * .55, -1, .4 + (y - bcy) / bry * .3), {
    bias: -.18,
    adj: (x, y, t) => {
      if (inLip(x, y)) return Math.max(t, 4);
      // woven rows: concentric rings with alternating plaited segments
      const u = (x - bcx) / brx, w = (y - bcy) / bry, rr = Math.hypot(u, w), a = Math.atan2(w, u);
      const rows = 7, ringI = Math.floor(rr * rows), f = rr * rows - ringI;
      if (f < .2) return t + 1;
      const seg = Math.floor((a + Math.PI) * (10 + ringI * 5) / Math.PI);
      return (seg + ringI) % 2 ? t : (f > .5 && t > 1 ? t - 1 : t);
    },
  });
  // frayed straw ends along the front edge
  for (let k = -5; k <= 5; k++) {
    const x = Math.round(bcx + k * 8 + (k % 2) * 2), y0 = Math.round(bcy + bry * Math.sqrt(Math.max(0, 1 - ((x - bcx) / brx) ** 2)) + 1);
    if (k % 2 === 0) pset(R, x, y0 + 1, r.sh); else pset(R, x, y0, r.dp);
  }
  // crown: woven dome
  const crown = R.M().ellipse(cx, 4, 24, 17).keep((x, y) => y <= smile(cx, 24, 3, 2.5)(x) + 1);
  form(R, crown, r, sph(cx - 5, 2, 26, 20), {
    bias: -.12,
    adj: (x, y, t) => { const row = Math.floor((y + 40) / 2.5); if (((y + 40) % 2.5) < .9) return t + 1; return ((Math.floor((x + row * 2) / 3)) & 1) ? t : t - 1; },
  });
  drop(R, crown, 1, 1, .6);
  // ribbon band round the crown
  const band = bandM(R, cx, 24.5, -3, 3, 2.5);
  form(R, band, RIB, cylX(cx - 4, 28, .05), { round: 1.5, rim: 1 });
  R.fill(edge(R, band, 0, -1).keep(x => x < cx + 8), RIB.lt);
  drop(R, edge(R, band, 0, 1), 0, 1, .7);
  // bow with tails on the side, and a little daisy
  const bp = around(R, 70, 24);
  if (bp.c > -.4) {
    const bx = Math.round(bp.x), by = Math.round(smile(cx, 24.5, 0, 2.5)(bp.x));
    const vac = bp.c < 0 ? vacant(R) : null;
    const clipM = m => vac ? m.keep((x, y) => vac(x, y) || y < bcy - 2) : m;
    const dir = bp.s >= 0 ? 1 : -1;
    for (const k of [0, 1]) {
      const T = tube(R, [bx + dir * (1 + k), by + 2], [bx + dir * (4 + k * 3), by + 9], [bx + dir * (3 + k * 5), by + 17 - k * 2], t => 2.2 - t * .5, 16);
      const tm = clipM(T.m);
      form(R, tm, RIB, T.light(0), { round: 1.2, rim: 1, bias: -.05 });
      drop(R, tm, 1, 2, .7);
    }
    const bow = clipM(R.M().poly([[bx, by], [bx - 6, by - 5], [bx - 7, by + 1], [bx - 5, by + 3]]).poly([[bx, by], [bx + 6, by - 5], [bx + 7, by + 1], [bx + 5, by + 3]]));
    form(R, bow, RIB, sph(bx - 3, by - 3, 9, 6), { round: 1.8, rim: 1 });
    R.crease([bx - 5, by - 2], [bx - 3, by], [bx - 1, by], RIB, bow, { tone: 4, lipTone: 2 });
    form(R, clipM(R.M().ellipse(bx, by, 1.6, 2)), RIB, flatL(.55), { round: 1, rim: 0 });
    drop(R, bow, 1, 1, .7);
    if (bp.c > .1) blossom(R, bx - 9 * dir, by + 1, 3.6, SNOW, { n: 7, center: SUN });
  }
  drop(R, brim.clone().keep((x, y) => y >= bcy - 1), 0, 3);
}, { top: -14 });

// ---------------- pumpkin hat ----------------
hat('pumpkin', 'Pumpkin Head', '#f08a3c', (R, r, v) => {
  const cx = hcx(R), cy = 7, rx = 42, ry = 23;
  const cut = x => smile(cx, rx, 12, 3)(x) + (tri(x - cx + 2, 8, 3) - 1.5);
  const body = R.M().ellipse(cx, cy, rx, ry).keep((x, y) => y <= cut(x));
  // lobes: each rib is its own swelling, with dark grooves between them
  const hw = y => rx * Math.sqrt(Math.max(.02, 1 - ((y - cy) / ry) ** 2));
  const lobeK = 10;
  const lobe = (x, y) => {
    const u = Math.asin(cl((x - cx) / hw(y), -1, 1)) + ROT[R.view] * Math.PI / 180;
    const f = (u / Math.PI) * lobeK + 100.5, k = f - Math.floor(f);
    return { k, width: Math.PI * hw(y) * Math.cos(Math.asin(cl((x - cx) / hw(y), -1, 1))) / lobeK };
  };
  const G = sph(cx - 8, cy + 2, rx + 4, ry + 6);
  form(R, body, r, (x, y) => {
    const q = lobe(x, y);
    return G(x, y) + (q.width > 2 ? -Math.abs(q.k - .42) * .55 + .12 : 0);
  }, {
    round: 3, bias: -.1,
    adj: (x, y, t) => { const q = lobe(x, y); return q.width > 2.2 && (q.k < .5 / q.width || q.k > 1 - .5 / q.width) ? t + 1 : t; },
  });
  // carved rim: a lighter cut edge showing the pumpkin flesh
  const FLESH = ramp(mix(r.base, [255, 214, 120], .55));
  const rimM = body.clone().keep((x, y) => y >= cut(x) - 1.5);
  form(R, rimM, FLESH, flatL(.5), { round: 1, rim: 0 });
  drop(R, body, 0, 2);
  // stem, leaf and a curly tendril on top
  const top = cy - ry;
  const STEM = ramp('#7a6a3a');
  const st = tube(R, [cx + 1, top + 3], [cx + 1, top - 4], [cx + 6, top - 9], t => 3.4 - t * 1.4, 16);
  form(R, st.m, STEM, st.light(.2), { round: 1.5, rim: 1 });
  pline(R, R.curve([cx, top + 2], [cx, top - 3], [cx + 4, top - 7]), STEM.sh, st.m);
  R.fill(edge(R, st.m, 0, -1).keep((x, y) => y < top - 6), STEM.lt);
  const lf = leaf(R, cx - 3, top + 1, Math.PI * 1.08, 12, 7);
  drop(R, lf, 1, 1, .6);
  const tend = []; for (let k = 0; k < 40; k++) { const a = k * .32, rr = 1 + k * .09; tend.push([Math.round(cx + 9 + Math.cos(a) * rr + k * .12), Math.round(top - 1 + Math.sin(a) * rr)]); }
  pline(R, tend, LEAF.sh); pline(R, tend.filter((p, i) => i % 3 === 0), LEAF.lt);
  drop(R, st.m, 1, 1, .7);
  // jack-o'-lantern face, glowing from inside
  const GLOW = handRamp(['#fffbe0', '#fff2a8', '#ffe066', '#ffc23a', '#f59a22', '#d4701a', '#6b2a10']);
  const holes = R.M();
  const place = (phi, dy, pts) => {
    const p = around(R, phi, 1); if (p.c < .3) return;
    const x0 = cx + hw(cy + dy - 6) * .93 * p.s;
    holes.poly(pts.map(([dx, yy]) => [x0 + dx * p.c, cy + dy + yy - 7]));
  };
  for (const s of [-1, 1]) place(s * 21, -1, [[-5.5, 4], [5.5, 4], [s * 2, -5]]);
  place(0, 3, [[-2.5, 2], [2.5, 2], [0, -2]]);
  place(0, 9, [[-17, -3], [-12, 1], [-8, -1], [-4, 2], [0, 0], [4, 2], [8, -1], [12, 1], [17, -3], [13, 4], [8, 3], [4, 6], [0, 4], [-4, 6], [-8, 3], [-13, 4]]);
  if (!holes.empty()) {
    holes.and(body);
    form(R, holes, GLOW, (x, y) => .95 - Math.abs(x - cx) / 40, { round: 1.5, rim: 0, shiny: true, edge: () => GLOW.dp });
    // inner wall shadow along the top edge of each cut
    R.fill(edge(R, holes, 0, -2).sub(edge(R, holes, 0, -1)), GLOW.sh);
    glow(R, holes, [255, 214, 90], 60, 0);
  }
}, { top: -27 });

// ---------------- knight helm ----------------
hat('helm', 'Knight Helm', '#c9cfdc', (R, r, v) => {
  const cx = hcx(R), side = v === 'side', back = v === 'back';
  const PL = r.base[0] > r.base[2] * 1.5 && r.base[0] > 150 ? ramp('#3f6fd8') : RED;
  // steel shell over the head, down over the cheeks; the face stays open
  const shell = R.M().ellipse(cx, 26, 42, 35).keep((x, y) => y <= (back ? 47 : 50));
  if (side) shell.sub(R.M().poly([[-6, 18], [cx - 13, 18], [cx - 9, 27], [cx - 10, 60], [-6, 60]]));
  else if (!back) shell.sub(R.M().poly([[cx - 26, 20], [cx + 26, 20], [cx + 29, 27], [cx + 28, 60], [cx - 28, 60], [cx - 29, 27]]));
  const G = sph(cx - 8, 18, 46, 40);
  form(R, shell, r, (x, y) => { const I = G(x, y); return I < .1 && (x - cx) / 42 > .6 ? I + .3 : I; }, { round: 3, bias: -.22 });
  // keel ridge over the top and a specular streak
  if (side) R.crease([cx - 34, 2], [cx - 10, -14], [cx + 24, -8], r, shell, { tone: 4, lipTone: 1 });
  else { pline(R, R.curve([cx, -8], [cx, 4], [cx, 19]), r.sh, shell); pline(R, R.curve([cx - 1, -8], [cx - 1, 4], [cx - 1, 19]), r.hi, shell); }
  R.fill(R.M().ellipse(cx - 20, 6, 2, 7).and(shell), r.hi);
  R.fill(R.M().ellipse(cx - 21, 5, .8, 5).and(shell), r.spec);
  // riveted reinforcing band round the skull (behind the visor in front view)
  if (!(v === 'front')) {
    const rb = bandM(R, cx, 42.5, 17, 22, 3).and(shell);
    form(R, rb, r, cylX(cx - 8, 46, .1), { round: 1.5, rim: 1, bias: -.1 });
    const hasRb = fh(rb);
    for (let k = -6; k <= 6; k++) { const p = around(R, k * 15 + (back ? 180 : 0), 41); if (p.c < .3) continue; const x = Math.round(p.x), y = Math.round(smile(cx, 42.5, 19.5, 3)(p.x)); if (hasRb(x, y)) { rectP(R, x, y, x + 1, y + 1, r.dp); pset(R, x, y, r.spec); } }
    drop(R, rb, 0, 1, .5);
  }
  // gold trim round the face opening and the lower edge, with rivets
  const TR = R.M();
  for (const [dx, dy] of [[0, 1], [0, 2], [0, 3], [1, 0], [2, 0], [3, 0], [-1, 0], [-2, 0], [-3, 0]]) TR.add(edge(R, shell, dx, dy));
  TR.keep((x, y) => y > 16);
  form(R, TR, GOLDM, (x, y) => G(x, y) + .15, { round: 1, rim: 1, shiny: true });
  const has = fh(shell), hasT = fh(TR);
  for (let k = -4; k <= 4; k++) {
    const p = around(R, k * 22 + (back ? 180 : 0), 39); if (p.c < .25) continue;
    const x = Math.round(p.x), y = 41 - Math.round(Math.abs(p.s) * 3);
    if (has(x, y) && !hasT(x, y)) { rectP(R, x, y, x + 1, y + 1, r.dp); pset(R, x, y, r.spec); }
  }
  drop(R, shell, 0, 2);
  // the visor, raised up on the forehead
  if (!back) {
    let visor;
    if (side) {
      visor = R.M().poly([[cx - 4, 9], [cx - 26, 3], [cx - 43, 8], [cx - 47, 13], [cx - 40, 16], [cx - 26, 16], [cx - 4, 17]]);
      form(R, visor, r, (x, y) => dot((x - cx) / 60, -.6, .8) + (y < 8 ? .2 : y > 14 ? -.3 : 0), { round: 2, bias: -.18 });
      pline(R, R.curve([cx - 42, 12], [cx - 28, 10], [cx - 8, 12]), r.line, visor);
      pline(R, R.curve([cx - 42, 13], [cx - 28, 11], [cx - 8, 13]), r.hi, visor);
      for (let k = 0; k < 4; k++) pset(R, cx - 24 + k * 4, 15, r.dp);
      setGem(R, cx - 3, 13, 1.5, GOLDM, GOLDM, false);
    } else {
      visor = R.M().poly([[cx - 31, 9], [cx - 18, 4], [cx, 2], [cx + 18, 4], [cx + 31, 9], [cx + 28, 17], [cx + 10, 20], [cx, 25], [cx - 10, 20], [cx - 28, 17]]);
      // two facets meeting at a ridge down the middle
      form(R, visor, r, (x, y) => dot((x - cx) / 36 + (x < cx ? -.25 : .25), -.35 + (y - 6) / 24, 1) + (x < cx ? .08 : -.1), { round: 2, bias: -.06 });
      pline(R, R.curve([cx, 3], [cx, 14], [cx, 24]), r.sh, visor); pline(R, R.curve([cx - 1, 3], [cx - 1, 14], [cx - 1, 23]), r.hi, visor);
      // eye slit with a lit lower lip
      pline(R, R.curve([cx - 25, 13], [cx, 9], [cx + 25, 13]), r.line, visor);
      pline(R, R.curve([cx - 25, 14], [cx, 10], [cx + 25, 14]), r.hi, visor);
      // breathing holes
      for (let k = 0; k < 3; k++) for (const s of [-1, 1]) { const hx = cx + s * (7 + k * 4), hy = 17 - k; rectP(R, Math.min(hx, hx + s), hy, Math.max(hx, hx + s), hy, r.line); }
      // pivot rivets at the temples
      for (const s of [-1, 1]) setGem(R, cx + s * 30, 12, 1.5, GOLDM, GOLDM, false);
    }
    R.fill(edge(R, visor, 0, -1).keep(x => x < cx + 10), r.spec);
    drop(R, visor, 0, 2);
  }
  // plume: a crest of feathers in a gold holder, flowing back
  const locks = side
    ? [[[cx + 2, -8], [cx + 22, -24], [cx + 40, -12], 8], [[cx - 2, -9], [cx + 10, -28], [cx + 30, -26], 7], [[cx + 4, -8], [cx + 26, -14], [cx + 42, 0], 6.5]]
    : back ? [[[cx + 1, -9], [cx - 1, -26], [cx - 10, -32], 8.5], [[cx - 1, -9], [cx - 8, -22], [cx - 15, -24], 6.5], [[cx + 2, -9], [cx + 6, -22], [cx + 4, -30], 6]]
      : [[[cx - 1, -9], [cx + 1, -26], [cx + 10, -32], 8.5], [[cx + 1, -9], [cx + 8, -22], [cx + 15, -24], 6.5], [[cx - 2, -9], [cx - 6, -22], [cx - 4, -30], 6]];
  const plume = R.M();
  for (const [p0, p1, p2, w] of locks.slice().reverse()) {
    const T = tube(R, p0, p1, p2, t => w / 2 * Math.sin(Math.PI * Math.min(1, .3 + t * .75)) + .4, 22);
    form(R, T.m, PL, T.light(.15), { round: 2, bias: -.02 });
    for (let k = 5; k < 21; k += 3) { const q = T.S[k]; pline(R, R.curve([q.x - q.nx * q.w * .2, q.y - q.ny * q.w * .2], [q.x + q.dx * 2 + q.nx * 1.5, q.y + q.dy * 2 + q.ny * 1.5], [q.x + q.dx * 4 + q.nx * q.w * .7, q.y + q.dy * 4 + q.ny * q.w * .7]), PL.sh, T.m); }
    plume.add(T.m);
  }
  drop(R, plume, 1, 2, .7);
  const hold = side ? R.M().rect(cx - 4, -11, cx + 5, -6) : R.M().rect(cx - 3, -11, cx + 3, -6);
  form(R, hold, GOLDM, cylX(cx - 1, 6), { round: 1, rim: 1, shiny: true });
  drop(R, hold, 0, 1, .6);
}, { kind: 'metal', top: -30 });
})();
