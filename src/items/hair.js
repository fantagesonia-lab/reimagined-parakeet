// Pixie Closet wardrobe: hair. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
//
// Hair is built the MapleStory way: a shaded base mass (so the skull reads round) under
// many overlapping tapered locks. Each lock is painted with its own light, its outline
// fades out toward the root so locks merge into the mass, and the outline gets darker
// toward the tip so tips and side edges read as strand separations. Then a broken shine
// band is laid along the locks, the whole silhouette is outlined, and the bangs cast a
// warm shadow on the face.
(() => {
// Local bindings: global lookups are slow inside node's vm (tools/check.js) and hair runs
// hot per-pixel loops, so bind the few globals they use once.
const Math = globalThis.Math, Float32Array = globalThis.Float32Array, Int8Array = globalThis.Int8Array;
const Int16Array = globalThis.Int16Array, Int32Array = globalThis.Int32Array, Uint8Array = globalThis.Uint8Array;
const FACE_TINT = [.95, .76, .74];
const hash = (a, b = 0) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
const LIGHT = [-.5, -.68];

// Very pale dyes (platinum, cream) get their shadow end calmed a little: the shared ramp
// pushes their shadows to saturated orange, while pale hair reads better with beige-rose
// shadows. Still derived from the player's ramp, so dyeing works the same.
const TUNED = new WeakMap();
function tuneRamp(r) {
  if (TUNED.has(r)) return TUNED.get(r);
  const lum = c => .3 * c[0] + .59 * c[1] + .11 * c[2];
  let out = r;
  if (lum(r.base) > 200) {
    const calm = (c, k) => { const g = lum(c); return c.map(v => Math.round(v + (g - v) * k)); };
    const t = r.t.map((c, i) => i < 4 ? c : calm(mix(c, [150, 110, 120], i === 4 ? .12 : .2), i === 4 ? .25 : .3));
    out = Object.assign([t[1], t[3], t[4], t[5]], { t, spec: t[0], hi: t[1], lt: t[2], base: t[3], sh: t[4], dp: t[5], line: t[6], kind: r.kind, hex: r.hex });
  }
  TUNED.set(r, out);
  return out;
}

// ---------- the painter context ----------
// H collects everything painted in one phase. Hair pixels also keep their ramp tone in
// H.T, so cast shadows between clumps step one tone darker inside the ramp (no muddy
// multiplies) and the silhouette, shine and face shadow are done once at the end.
const GMAPS = {};
function ctx(R, r, ph) {
  r = tuneRamp(r);
  const V = R.V, view = R.view, cx = V.headCx;
  const H = {
    R, r, V, ph, view, cx,
    all: R.M(), face: R.M(), body: R.M(),
    T: new Int8Array(CW * CH).fill(-1),
    owner: new Int16Array(CW * CH).fill(-1), locks: [],
    stamp: new Int32Array(CW * CH), stampN: 0,
    band: null, // (x,y) => true inside the shine band
    hy: 24,     // centre of the head sphere used for the overall form light
    gk: 1.25,   // strength of the overall form light
    tipDark: 1, // how much each clump darkens toward its tip
    cast: 1,    // tones of shadow each clump casts on the clump under it (0 = off)
    vary: .14,  // random light/dark variation between clumps
    k: .85,     // contrast of each clump's own rim light / shadow
    round: 2.5, // width of that rim shading
  };
  // Overall form light: the whole hairdo is one volume lit from the top-left. Returns a
  // tone offset (negative = lighter). It only depends on the view, so it is cached.
  const key = view + H.hy + '/' + H.gk;
  if (!GMAPS[key]) {
    const G = new Float32Array(CW * CH), hx = view === 'side' ? 36 : cx;
    for (let i = 0; i < G.length; i++) {
      const x = i % CW - V.ox, y = ((i / CW) | 0) - V.oy;
      // below the jaw the vertical term flattens out so long hair keeps its mid tones
      const yy = y < 50 ? y : 50 + (y - 50) * .25;
      G[i] = Math.max(-1.4, Math.min(1.1, ((x - hx) / 40 * .55 + (yy - H.hy) / 36 * .7) * H.gk));
    }
    GMAPS[key] = G;
  }
  const G = GMAPS[key], gox = V.ox, goy = V.oy;
  H.G = G;
  H.g = (x, y) => { const i = (y + goy) * CW + x + gox; return i >= 0 && i < G.length ? G[i] : 0; };
  return H;
}
const idx = (H, x, y) => (y + H.V.oy) * CW + x + H.V.ox;
const smooth = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
// ---------- fast pixel helpers ----------
// Hair is dozens of locks per view, so everything below works on canvas indices inside
// each piece's bounding box instead of scanning whole-canvas masks.
const LN = (() => { const L = [-.5, -.68, .54], l = Math.hypot(L[0], L[1], L[2]); return L.map(v => v / l); })();
function rectM(R, x0, y0, x1, y1) { // fast filled rectangle mask (view-local coords)
  const m = R.M(), ox = R.V.ox, oy = R.V.oy;
  const xa = Math.max(0, Math.round(x0) + ox), xb = Math.min(CW - 1, Math.round(x1) + ox);
  for (let y = Math.max(0, Math.round(y0) + oy); y <= Math.min(CH - 1, Math.round(y1) + oy); y++) if (xb >= xa) m.a.fill(1, y * CW + xa, y * CW + xb + 1);
  return m;
}
function boxOf(m) {
  const a = m.a; let x0 = CW, y0 = CH, x1 = -1, y1 = -1;
  for (let i = 0; i < a.length; i++) if (a[i]) { const x = i % CW, y = (i / CW) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
  return x1 < 0 ? null : [x0, y0, x1, y1];
}
// keep only pixels inside `keep` / outside `drop`, within box b
function clipBox(m, b, keep, drop) {
  const a = m.a, k = keep && keep.a, d = drop && drop.a;
  for (let y = b[1]; y <= b[3]; y++) for (let x = b[0], i = y * CW + x; x <= b[2]; x++, i++) if (a[i] && ((k && !k[i]) || (d && d[i]))) a[i] = 0;
}
// The same lit height-field as R.paint, but limited to the box: returns the listed
// pixels, their local tone (1 hi .. 5 deep) and whether each is on the piece's edge.
// Distances live in canvas-sized scratch arrays that are all zero between calls, so the
// chamfer passes only visit the piece's own pixels (in raster order).
const SD = new Float32Array(CW * CH), SHh = new Float32Array(CW * CH);
function shadeBox(a, b, R0) {
  const list = [], edge = [];
  for (let y = b[1]; y <= b[3]; y++) for (let x = b[0], i = y * CW + x; x <= b[2]; x++, i++) {
    if (!a[i]) continue;
    const e = x === 0 || x === CW - 1 || y === 0 || y === CH - 1 || !a[i - 1] || !a[i + 1] || !a[i - CW] || !a[i + CW];
    list.push(i); edge.push(e ? 1 : 0); SD[i] = e ? 0 : 1e9;
  }
  const N = list.length, D = SD;
  for (let n = 0; n < N; n++) {
    const i = list[n]; let m = D[i]; if (!m) continue;
    if (D[i - 1] + 1 < m) m = D[i - 1] + 1; if (D[i - CW] + 1 < m) m = D[i - CW] + 1;
    if (D[i - CW - 1] + 1.41 < m) m = D[i - CW - 1] + 1.41; if (D[i - CW + 1] + 1.41 < m) m = D[i - CW + 1] + 1.41; D[i] = m;
  }
  for (let n = N - 1; n >= 0; n--) {
    const i = list[n]; let m = D[i]; if (!m) continue;
    if (D[i + 1] + 1 < m) m = D[i + 1] + 1; if (D[i + CW] + 1 < m) m = D[i + CW] + 1;
    if (D[i + CW + 1] + 1.41 < m) m = D[i + CW + 1] + 1.41; if (D[i + CW - 1] + 1.41 < m) m = D[i + CW - 1] + 1.41; D[i] = m;
  }
  const Hh = SHh;
  for (let n = 0; n < N; n++) { const i = list[n], t = Math.min(D[i] + .5, R0) / R0; Hh[i] = R0 * Math.sqrt(1 - (1 - t) * (1 - t)); }
  const tone = new Int8Array(N), L0 = LN[0], L1 = LN[1], L2 = LN[2], top = CW * CH - CW;
  for (let n = 0; n < N; n++) {
    const i = list[n];
    if (i < CW || i >= top) { tone[n] = 3; continue; }
    const gx = (Hh[i + 1] - Hh[i - 1]) / 2, gy = (Hh[i + CW] - Hh[i - CW]) / 2;
    const I = (-gx * L0 - gy * L1 + L2) / Math.sqrt(gx * gx + gy * gy + 1);
    tone[n] = I > .8 ? 1 : I > .66 ? 2 : I > .38 ? 3 : I > .1 ? 4 : 5;
  }
  for (let n = 0; n < N; n++) { const i = list[n]; D[i] = 0; Hh[i] = 0; }
  return { list, tone, edge };
}
// recolour hair pixels to their tone + d (mask or index list)
function retone(H, m, d, only) {
  const { R, T, r, V } = H, c = [];
  const f = i => { if (T[i] >= 0 && (!only || only(i % CW - V.ox, ((i / CW) | 0) - V.oy))) { T[i] = Math.max(1, Math.min(5, T[i] + d)); c.push(i); } };
  if (Array.isArray(m)) m.forEach(f); else { const a = m.a; for (let i = 0; i < a.length; i++) if (a[i]) f(i); }
  for (const i of c) R.put(i, r.t[T[i]]);
}
function claim(H, list, o, k) {
  const A = H.all.a, F = H.face.a, B = H.body.a, O = H.owner;
  for (const i of list) { A[i] = 1; O[i] = k; if (o.face) F[i] = 1; if (o.body) B[i] = 1; }
}

// Base mass: big round shading under the locks.
function mass(H, m, o = {}) {
  const b = boxOf(m); if (!b) return m;
  const { R, T, r } = H, ox = H.V.ox, oy = H.V.oy, bias = o.bias || 0, k = o.k ?? .7;
  const S = shadeBox(m.a, b, o.round ?? 9), rr = o.ramp || r;
  const buf = R.buf, L = S.list, G = H.G;
  for (let n = 0; n < L.length; n++) {
    const i = L[n], v = Math.max(1, Math.min(5, Math.round(3 + (S.tone[n] - 3) * k + G[i] - bias * 3)));
    T[i] = o.ramp ? -1 : v; const col = rr.t[v], o4 = i * 4; buf[o4] = col[0]; buf[o4 + 1] = col[1]; buf[o4 + 2] = col[2]; buf[o4 + 3] = 255;
  }
  claim(H, S.list, o, -1);
  return m;
}

// Spine through a list of points: 3 points = one quadratic Bezier; more = a smooth
// quadratic B-spline that starts at the first point and ends at the last.
function pathPts(R, P) {
  if (P.length === 2) return R.curve(P[0], [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2], P[1]);
  if (P.length === 3) return R.curve(P[0], P[1], P[2]);
  const out = [], mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  for (let i = 1; i < P.length - 1; i++) {
    const s = i === 1 ? P[0] : mid(P[i - 1], P[i]), e = i === P.length - 2 ? P[P.length - 1] : mid(P[i], P[i + 1]);
    const seg = R.curve(s, P[i], e); if (out.length) seg.shift(); out.push(...seg);
  }
  return out;
}
// Tapered lock mask along the spine. Width goes w0 -> w1 with a profile exponent p
// (p > 1 keeps the clump full and tapers late into a point).
// With tz (px) the clump keeps most of its width and tapers only over its last tz px,
// so long clumps end in a shaped point instead of a long needle.
function lockMask(R, P, w0, w1 = 0, p = 1.6, tz = 0) {
  const m = R.M(), a = m.a, pts = pathPts(R, P), n = Math.max(1, pts.length - 1), ox = R.V.ox, oy = R.V.oy;
  const z = tz ? Math.min(1, tz / n) : 0;
  const wAt = t => {
    if (!z) return w1 + (w0 - w1) * (1 - Math.pow(t, p));
    if (t < 1 - z) return w0 + (w0 * .78 - w0) * t / (1 - z);
    const s = (t - (1 - z)) / z; return w1 + (w0 * .78 - w1) * (1 - Math.pow(s, p));
  };
  let x0 = CW, y0 = CH, x1 = -1, y1 = -1;
  const span = (y, xa, xb) => {
    if (y < 0 || y >= CH) return; if (xa < 0) xa = 0; if (xb > CW - 1) xb = CW - 1; if (xb < xa) return;
    a.fill(1, y * CW + xa, y * CW + xb + 1);
    if (xa < x0) x0 = xa; if (xb > x1) x1 = xb; if (y < y0) y0 = y; if (y > y1) y1 = y;
  };
  // consecutive discs overlap heavily, so only stamp every ~r/3 px along the spine
  let lx = 1e9, ly = 1e9, lr = -1;
  pts.forEach(([px, py], i) => {
    const r = wAt(i / n) / 2 - .2, cx = px + ox, cy = py + oy;
    if (i < n && (cx - lx) * (cx - lx) + (cy - ly) * (cy - ly) < Math.max(1, r * r * .1) && Math.abs(r - lr) < .5) return;
    lx = cx; ly = cy; lr = r;
    if (r < .5) { span(cy, cx, cx); return; }
    const R2 = r + .35, ry = Math.floor(R2);
    for (let dy = -ry; dy <= ry; dy++) {
      const hw = Math.floor(R2 * Math.sqrt(Math.max(0, 1 - (dy / R2) * (dy / R2))));
      span(cy + dy, cx - hw, cx + hw);
    }
  });
  return { m, pts, wAt, box: x1 < 0 ? null : [x0, y0, x1, y1] };
}
// A lock. Options:
//  fade   fraction of the length (from the root) that melts into the mass: no outline,
//         no rim shading, no cast shadow there
//  bias   lighter/darker; round  shading radius; p  taper profile; k  rim contrast
//  face   casts a warm shadow on the face; body  casts a shadow on body/clothes
//  cast   tones of shadow on the clump underneath (default H.cast)
//  shine  take part in the shine band (default on); strands  inner strand lines
//  clip/cut masks; free  ignore H.clip
function lock(H, a, b, c, w0, w1 = 0, o = {}) { return lockP(H, [a, b, c], w0, w1, o); }
function lockP(H, P, w0, w1 = 0, o = {}) {
  const { R, T } = H, rr = H.r, ox = H.V.ox, oy = H.V.oy, a = P[0], c = P[P.length - 1];
  let { m, pts, wAt, box } = lockMask(R, P, w0, w1, o.p ?? 1.6, o.tz || 0);
  if (o.add) { m.add(o.add); box = boxOf(m); }
  if (!box) return m;
  if (H.clip && !o.free) clipBox(m, box, H.clip);
  if (o.clip) clipBox(m, box, o.clip);
  if (o.cut) clipBox(m, box, null, o.cut);
  const S = shadeBox(m.a, box, o.round ?? H.round);
  if (!S.list.length) return m;
  const fade = o.fade ?? .25;
  // position along the clump (projection on its chord), 0 at the root, 1 at the tip
  const ax = c[0] - a[0], ay = c[1] - a[1], al = ax * ax + ay * ay || 1;
  const ia = 1 / al, a0x = a[0] + ox, a0y = a[1] + oy;
  const td = o.tipDark ?? H.tipDark, k = o.k ?? H.k;
  const bias = (o.bias || 0) + (o.vary ?? H.vary) * (hash(a[0] * 3.1 + c[0], a[1] + c[1] * 1.7) - .5) + (H.bias || 0);
  // the clump darkens over its last ~18 px as it turns away from the light
  const len = Math.sqrt(al), z = Math.min(.7, 18 / len);
  const N = S.list.length, U = new Float32Array(N), buf = R.buf, G = H.G;
  for (let n = 0; n < N; n++) {
    const i = S.list[n], X0 = i % CW, Y0 = (i / CW) | 0;
    let u = ((X0 - a0x) * ax + (Y0 - a0y) * ay) * ia; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const wgt = smooth((u - fade * .5) / (fade * .9 + .05));
    U[n] = u;
    const v = Math.max(1, Math.min(5, Math.round(3 + (S.tone[n] - 3) * k * wgt + G[i] - bias * 3 + td * (smooth((u - 1 + z) / z) - .3))));
    T[i] = v; const col = rr.t[v], o4 = i * 4; buf[o4] = col[0]; buf[o4 + 1] = col[1]; buf[o4 + 2] = col[2]; buf[o4 + 3] = 255;
  }
  // shadow on the clump underneath, just right of this one (only past the root)
  const cast = o.cast ?? H.cast;
  if (cast) {
    const dx = o.cdx ?? 2, dy = o.cdy ?? 0, A = H.all.a, M = m.a, st = ++H.stampN, ST = H.stamp, tg = [];
    const off = [dx + dy * CW]; if (Math.abs(dx) > 1) off.push(Math.sign(dx) + dy * CW);
    for (let n = 0; n < N; n++) if (U[n] > fade + .12) for (const d of off) { const j = S.list[n] + d; if (j >= 0 && j < A.length && !M[j] && A[j] && ST[j] !== st) { ST[j] = st; tg.push(j); } }
    retone(H, tg, cast);
  }
  // outline that fades in from the root: none -> sh -> dp -> darker toward the tip
  const eTip = mix(rr.dp, rr.line, .5);
  for (let n = 0; n < N; n++) {
    if (!S.edge[n]) continue;
    const i = S.list[n], t = U[n];
    if (t < fade) continue;
    const u = (t - fade) / (1 - fade);
    if (u < .25) { T[i] = 4; R.put(i, rr.sh); } else { T[i] = 5; R.put(i, u < .7 ? rr.dp : eTip); }
  }
  const kk = H.locks.length;
  const L = { pts, m, w0, w1, wAt, shine: o.shine !== false, sw: o.shineW, k: kk };
  claim(H, S.list, o, kk);
  const ns = o.strands ?? (w0 >= 16 ? 1 : 0);
  if (ns > 0) strands(H, L, ns, Math.max(fade, o.st0 ?? .3), o.st1 ?? .88);
  H.locks.push(L);
  return m;
}

// Fine strand lines inside a wide clump: a soft dark line with a lit lip on the side
// facing the light, running with the clump and converging toward its tip.
function strands(H, L, n, t0, t1) {
  const { R, T } = H, { pts } = L, M = L.m.a, rr = H.r, N = pts.length - 1, ox = H.V.ox, oy = H.V.oy;
  if (N < 6) return;
  const inside = i => M[i] && M[i - 1] && M[i + 1] && M[i - CW] && M[i + CW];
  const st = ++H.stampN, ST = H.stamp, dk = [], lip = [];
  for (let s = 1; s <= n; s++) {
    const f = (s / (n + 1) - .5) * .78 + (hash(s, L.k + 7) - .5) * .12;
    const tA = t0 + hash(s, L.k + 3) * .12, tB = t1 - hash(s, L.k + 5) * .25;
    for (let i = Math.max(1, Math.round(tA * N)); i <= Math.min(N - 1, Math.round(tB * N)); i++) {
      const t = i / N, w = L.wAt(t);
      const dx = pts[i + 1][0] - pts[i - 1][0], dy = pts[i + 1][1] - pts[i - 1][1], l = Math.hypot(dx, dy) || 1;
      let nx = -dy / l, ny = dx / l;
      const x = Math.round(pts[i][0] + nx * f * w), y = Math.round(pts[i][1] + ny * f * w);
      if (x + ox < 1 || y + oy < 1 || x + ox >= CW - 1 || y + oy >= CH - 1) continue;
      const j = (y + oy) * CW + x + ox;
      if (!inside(j) || ST[j] === st) continue;
      ST[j] = st; dk.push(j);
      if (nx * LIGHT[0] + ny * LIGHT[1] < 0) { nx = -nx; ny = -ny; }
      lip.push((Math.round(y + ny) + oy) * CW + Math.round(x + nx) + ox);
    }
  }
  // strand line one tone darker than the hair around it, lip one tone lighter
  for (const j of dk) if (T[j] >= 0) { T[j] = Math.min(5, T[j] + 1); R.put(j, rr.t[T[j]]); }
  for (const j of lip) if (ST[j] !== st && inside(j) && T[j] >= 0 && T[j] <= 3) { ST[j] = st; T[j] = Math.max(2, T[j] - 1); R.put(j, rr.t[T[j]]); }
}

// Short highlight strokes along each lock's spine (on its lit side) wherever the spine
// crosses the shine band, so the band reads broken into strands.
function shine(H) {
  const { R } = H, b1 = H.band, b2 = H.band2;
  const band = b1 && b2 ? (x, y) => b1(x, y) || b2(x, y) : b1 || b2; if (!band) return;
  const hiM = R.M(), spM = R.M(), ltM = R.M(), dkM = R.M();
  // front/back: walk the band's centre curve and give every visible clump a stroke on the
  // lit (left) third of the part of it that crosses the band
  if (b1 && b1.curve) {
    const O = H.owner, T = H.T, ox = H.V.ox, oy = H.V.oy, hh = Math.max(1, Math.round(b1.half));
    let x0 = null, cur = -2;
    const end = x1 => {
      const len = x1 - x0;
      if (cur >= 0 && len >= 3 && H.locks[cur].shine) {
        const sx0 = x0 + (len > 6 ? 1 : 0), sx1 = x0 + Math.max(1, Math.round(len * .4));
        for (let x = sx0; x <= sx1; x++) {
          const yc = Math.round(b1.curve(x)), mid = x === Math.round((sx0 + sx1) / 2);
          for (let y = yc - hh; y <= yc + hh; y++) {
            const i = (y + oy) * CW + x + ox;
            if (i < 0 || i >= O.length || O[i] !== cur || T[i] > 4) continue;
            (mid && Math.abs(y - yc) <= 1 ? spM : Math.abs(y - yc) < hh ? hiM : ltM).set(x, y);
          }
        }
      }
    };
    for (let x = H.cx - 50; x <= H.cx + 50; x++) {
      const yc = Math.round(b1.curve(x)), i = (yc + oy) * CW + x + ox;
      const o = i >= 0 && i < O.length && H.all.a[i] ? O[i] : -2;
      if (o !== cur) { if (x0 !== null) end(x); x0 = x; cur = o; }
    }
    if (x0 !== null) end(H.cx + 51);
  }
  // everything else (side views, the low band on long hair): strokes along each spine
  const spineBand = b1 && b1.curve ? b2 : band;
  H.locks.forEach((L, k) => {
    if (!L.shine || !spineBand) return;
    const pts = L.pts, n = pts.length;
    let run = [];
    const flush = () => {
      // the lower band (long hair) is softer: longer strokes only, no specular pixel
      const low = run.length && !(b1 && b1(run[0][0], run[0][1]));
      if (run.length >= (low ? 4 : 2)) {
        // a 2 px stroke: hi on the spine side toward the light, lt on the far side
        run.forEach((p, q) => { hiM.set(p[0], p[1]); if (!low && q > 0 && q < run.length - 1) hiM.set(p[0] - p[2], p[1] - p[3]); ltM.set(p[0] + p[2], p[1] + p[3]); });
        const mid = run[run.length >> 1]; if (!low) spM.set(mid[0], mid[1]);
        if (run.length >= 4 && !low) { const q = run[(run.length >> 1) - 1]; spM.set(q[0], q[1]); }
        // a darker pixel just past each end makes the stroke pop
        const e0 = run[0], e1 = run[run.length - 1];
        dkM.set(2 * e0[0] - run[1][0], 2 * e0[1] - run[1][1]); dkM.set(2 * e1[0] - run[run.length - 2][0], 2 * e1[1] - run[run.length - 2][1]);
      }
      run = [];
    };
    for (let i = 1; i < n - 1; i++) {
      const [x, y] = pts[i];
      const t = i / n, w = L.wAt(t);
      if (w < 4 || !spineBand(x, y)) { flush(); continue; }
      const dx = pts[i + 1][0] - pts[i - 1][0], dy = pts[i + 1][1] - pts[i - 1][1], l = Math.hypot(dx, dy) || 1;
      let nx = -dy / l, ny = dx / l; if (nx * LIGHT[0] + ny * LIGHT[1] < 0) { nx = -nx; ny = -ny; }
      const off = Math.min(w * .22, 2.5) * (L.sw ?? 1);
      const px = Math.round(x + nx * off), py = Math.round(y + ny * off);
      const j = idx(H, px, py), M = L.m.a;
      if (j < CW || j >= M.length - CW || H.owner[j] !== k || !M[j - 1] || !M[j + 1] || !M[j - CW] || !M[j + CW]) { flush(); continue; }
      run.push([px, py, -Math.round(nx), -Math.round(ny)]);
    }
    flush();
  });
  // the angel ring: a broad, softer glow along the band under the strokes (upper band only)
  if (b1) {
    const T = H.T, A = H.all.a, bx = boxOf(H.all), glow = [];
    if (bx) for (let y = bx[1]; y <= bx[3]; y++) for (let x = bx[0], i = y * CW + x; x <= bx[2]; x++, i++) {
      if (!A[i] || T[i] < 2 || T[i] > 3) continue;
      const lx = x - H.V.ox, ly = y - H.V.oy;
      if (b1(lx, ly) || b1(lx, ly - 1) || b1(lx, ly + 1) || b1(lx, ly - 2)) glow.push(i);
    }
    retone(H, glow, -1);
  }
  ltM.sub(hiM).keep((x, y) => H.owner[idx(H, x, y)] >= 0);
  dkM.sub(hiM).sub(ltM).keep((x, y) => H.owner[idx(H, x, y)] >= 0);
  retone(H, dkM, 1);
  R.fill(ltM, H.r.lt); R.fill(hiM, H.r.hi); R.fill(spM, H.r.spec);
}

// Finish a phase: shine band, silhouette outline (lighter on the lit top-left side),
// cast shadows on the face/skin and on clothes.
function finish(H) {
  const { R, r, all } = H, A = all.a, ox = H.V.ox, oy = H.V.oy;
  shine(H);
  const lineLit = mix(r.line, r.dp, .4);
  const b = boxOf(all); if (!b) return;
  for (let y = b[1]; y <= b[3]; y++) for (let x = b[0], i = y * CW + x; x <= b[2]; x++, i++) {
    if (!A[i]) continue;
    const l = x > 0 && A[i - 1], rt = x < CW - 1 && A[i + 1], u = y > 0 && A[i - CW], d = y < CH - 1 && A[i + CW];
    if (l && rt && u && d) continue;
    R.put(i, (!l || !u) && rt && d ? lineLit : r.line);
  }
  // warm shadow on the skin under the bangs / side locks, cool shadow on clothes
  const cast = (M, dx, dy, ok, tint) => {
    const st = ++H.stampN, ST = H.stamp, buf = R.buf, src = M.a;
    for (let y = b[1]; y <= b[3]; y++) for (let x = b[0], i = y * CW + x; x <= b[2]; x++, i++) {
      if (!src[i]) continue;
      for (let k = 1; k <= dy; k++) {
        const tx = x + Math.round(dx * k / dy), ty = y + k; if (tx < 0 || tx >= CW || ty >= CH) break;
        const j = ty * CW + tx; if (A[j] || ST[j] === st || !buf[j * 4 + 3]) continue;
        ST[j] = st; if (!ok(tx - ox, ty - oy)) continue;
        buf[j * 4] *= tint[0]; buf[j * 4 + 1] *= tint[1]; buf[j * 4 + 2] *= tint[2];
      }
    }
  };
  cast(H.face, H.view === 'side' ? -1 : 0, 2, (x, y) => R.isSkin(x, y), FACE_TINT);
  cast(H.body, 1, 2, (x, y) => R.part(x, y) !== 'head', [.86, .8, .9]);
}

// ---------- shape helpers ----------
// head silhouette (cached per view and growth: it only depends on the body sprite)
const HEADS = {};
const headMask = (R, grow = 0) => {
  const key = R.view + grow;
  if (!HEADS[key]) { const m = R.body((x, y, p) => p === 'head'); if (grow) m.dilate(grow); HEADS[key] = m.a.slice(); }
  const m = R.M(); m.a.set(HEADS[key]); return m;
};
// The skull dome: head silhouette grown a little, with a rounder top than the sprite's.
// body interior (eroded 2 px), cached per view: hair behind it is never seen
const INNER = {};
function bodyInner(R) {
  if (!INNER[R.view]) { const m = R.body(() => true); const o = m.clone().dilate(0); const e = R.M(); e.a.fill(1); e.sub(m); e.dilate(2); o.sub(e); INNER[R.view] = o.a.slice(); }
  const m = R.M(); m.a.set(INNER[R.view]); return m;
}
const DOMES = {};
function dome(H, grow = 3, top = -5) {
  const { R, view } = H, hx = view === 'side' ? 35.5 : H.cx + .5, key = view + grow + '/' + top;
  if (!DOMES[key]) DOMES[key] = headMask(R, Math.max(0, grow - 1)).add(R.M().ellipse(hx, 31, 36 + grow, 31 - top)).a.slice();
  const m = R.M(); m.a.set(DOMES[key]); return m;
}
// shine bands: an arc across the dome (front/back) or around the skull (side)
function domeBand(H, y0, k = 60, half = 2) {
  const cx = H.cx, f = (x, y) => Math.abs(y - (y0 + (x - cx) * (x - cx) / k)) <= half;
  f.curve = x => y0 + (x - cx) * (x - cx) / k; f.half = half;
  return f;
}
function ringBand(cx0, cy0, rad, half = 2, maxY = 99) {
  return (x, y) => y < maxY && Math.abs(Math.hypot(x - cx0, y - cy0) - rad) <= half;
}
// a second, fainter band across long hair at mid-length
function lowBand(H, y0, half = 1.5) { const cx = H.view === 'side' ? 56 : H.cx; return (x, y) => Math.abs(y - (y0 + Math.abs(x - cx) * .12)) <= half; }
const X = (H, s, d) => H.cx + s * d;
// mirrored lock for front/back views: points are [dx, y] with dx measured outward on side s
function lockS(H, s, P, w0, w1, o) { return lockP(H, P.map(([d, y]) => [X(H, s, d), y]), w0, w1, o); }

// ---------- per-view building blocks ----------
// FRONT: dome mass. Covers the top, and the sides outside |dx| >= inner down to `side`.
function frontCap(H, o = {}) {
  const { R, cx } = H, D = dome(H, o.vol ?? 3, o.top ?? -5);
  H.clip = D.clone().add(rectM(R, cx - 70, o.clipY ?? 12, cx + 70, 140));
  const side = o.side ?? 50, inner = o.inner ?? 27, capY = o.capY ?? 16;
  mass(H, D.clone().keep((x, y) => y < capY || (Math.abs(x - cx) >= inner && y < side)));
  return D;
}
// Front-view fringe. tips: [dx, tipY, width, hook] relative to the head centre; roots
// gather toward the part. Drawn outer clumps first so centre ones sit on top.
function fringe(H, tips, o = {}) {
  const { cx } = H, part = o.part ?? 0, rootY = o.rootY ?? -3, midY = o.midY ?? 18;
  const list = tips.map(t => t.slice()).sort((p, q) => Math.abs(q[0] - part) - Math.abs(p[0] - part));
  for (const [dx, ty, w, hook = 0, extra = {}] of list) {
    const rx = part + (dx - part) * (o.spread ?? .45), ry = rootY + Math.abs(dx - part) * .08;
    const mx = rx + (dx - rx) * .62 - hook;
    lock(H, [cx + rx, ry], [cx + mx, midY + Math.abs(dx) * .1], [cx + dx + hook * .3, ty], w, o.w1 ?? 0,
      { face: true, fade: o.fade ?? .45, p: o.p ?? 2.2, ...o.opts, ...extra });
  }
}
// FRONT, behind the body: the long curtain seen beside the head, neck and arms.
function frontCurtain(H, len, o = {}) {
  const { R, cx } = H, fl = o.flare ?? 4, n = o.n ?? 4;
  mass(H, R.M().poly([[cx - 35, 20], [cx + 35, 20], [cx + 38 + fl, len - 10], [cx - 38 - fl, len - 10]]).sub(bodyInner(R)), { bias: -.2, round: 6 });
  for (const s of [-1, 1]) for (let k = 0; k < n; k++) {
    const d = 34 - k * 6, j = hash(k + s, len), wv = o.wave ? (k % 2 ? 1 : -1) * o.wave : 0;
    const tip = len - k * 2 - Math.round(j * 6);
    const P = o.wave
      ? [[d - 6, 22], [d + 6 + fl * .5, 40], [d + 4 + fl * .4 + wv, 60], [d + 3 + fl * .7 - wv, 80], [d + fl + wv * .5, tip - 10], [d + fl - 2 - wv, tip]]
      : [[d - 6, 22], [d + 8 + fl * .5, 44], [d + 4 + fl, tip - 18], [d + fl - k, tip]];
    lockS(H, s, P, 15 - k, 0, { bias: -.1 - k * .03, fade: .3, p: 1.5, tz: 12, vary: .3, ...o.opts });
  }
}
// SIDE (faces left): skull mass with the face cut away.
function sideCap(H, o = {}) {
  const { R } = H, D = dome(H, o.vol ?? 3, o.top ?? -5);
  H.clip = D.clone().add(rectM(R, -30, o.clipY ?? 14, 110, 140));
  const ear = o.ear ?? 28, nape = o.nape ?? 60;
  // the hairline in front of the ear slants back so it ends in a sideburn, not a wall
  mass(H, D.clone().keep((x, y) => y < (o.capY ?? 16) || (x >= ear + Math.max(0, y - 30) * .35 && y < nape) || (x > 18 && y < 30)));
  return D;
}
// SIDE: clumps from the crown sweeping down the back of the head to the nape
function nape(H, ends, o = {}) {
  // early clumps arc round the back of the skull, later ones run down the side of the head
  ends.forEach(([ex, ey, w], k) => lock(H, [34 + k * 2, -3], [(34 + ex) / 2 + 16 - k * 2 + (o.bulge ?? 0), 10 + ey * .2 + k * 2], [ex, ey], w ?? 19 - k, o.w1 ?? 2, { fade: .45, p: 2, ...o.opts }));
}
// SIDE fringe over the forehead: [rootX, rootY, tipX, tipY, width, hook]
function sideFringe(H, list, o = {}) {
  list.forEach(([ax, ay, tx, ty, w, hook = 0, extra = {}]) =>
    lock(H, [ax, ay], [tx - 4 + hook, ty - 20], [tx, ty], w, 0, { face: true, fade: .45, p: 2.2, ...o.opts, ...extra }));
}
// SIDE, behind the body: long hair down the back
function sideCurtain(H, len, o = {}) {
  const { R } = H, n = o.n ?? 5;
  mass(H, R.M().poly([[34, 12], [64, 8], [72 + (o.flare ?? 2), len - 12], [46, len - 12]]).sub(bodyInner(R)), { bias: -.2, round: 6 });
  for (let k = 0; k < n; k++) {
    const x0 = 40 + k * 5, j = hash(k, len + 3), wv = o.wave ? (k % 2 ? 1 : -1) * o.wave : 0;
    const tip = len - Math.round(j * 6) - (k === 0 ? 4 : 0);
    const ex = 50 + k * 4.5 + (o.flare ?? 2);
    const P = o.wave
      ? [[x0, 12], [x0 + 22, 30], [ex + 4 + wv, 56], [ex - wv, 78], [ex + wv, tip - 10], [ex - 2, tip]]
      : [[x0, 12], [x0 + 24, 34], [ex + 4, tip - 24], [ex, tip]];
    lockP(H, P, 15, 0, { bias: -.08 - (n - k) * .03, fade: .3, p: 1.5, tz: 12, vary: .3, ...o.opts });
  }
}
// BACK: skull mass down to `bottom`
function backCap(H, bottom, o = {}) {
  const { R } = H, D = dome(H, o.vol ?? 3, o.top ?? -5), keep = o.keep || (() => true);
  H.clip = D.clone().add(rectM(R, -40, o.clipY ?? 14, 130, 140)).keep(keep);
  mass(H, D.clone().keep((x, y) => y < bottom && keep(x, y)));
  return D;
}
// BACK: clumps falling from the crown whorl to the hem, outermost first.
//  len hem y; n clumps; half half-width at the hem; wave amplitude; flare
function backFall(H, o = {}) {
  const { cx } = H, wx = cx + (o.wx ?? 3), wy = o.wy ?? 10, len = o.len ?? 62, n = o.n ?? 8, half = o.half ?? 36;
  if (len >= 80) H.band2 = lowBand(H, 62);
  const ts = []; for (let k = 0; k < n; k++) ts.push(n === 1 ? 0 : (k / (n - 1)) * 2 - 1);
  ts.sort((a, b) => Math.abs(b) - Math.abs(a));
  for (const t of ts) {
    const j = hash(t * 7 + len, 9), ex = cx + t * (half + (o.flare ?? 0)) + (j - .5) * 2;
    const ey = len - Math.abs(t) * (o.drop ?? 3) - Math.round(j * (o.jit ?? 4));
    const w = (o.w ?? 19) - Math.abs(t) * 3, wv = o.wave ? ((Math.round(t * 10) % 2) ? 1 : -1) * o.wave : 0;
    let P;
    if (len < 70) P = [[wx + t * 8, wy + 1], [ex + t * (o.bulge ?? 14), (wy + ey) * .45], [ex - t * 4, ey]];
    else if (o.wave) P = [[wx + t * 8, wy + 1], [cx + t * (half + 8), 30], [ex + t * 4 + wv, 54], [ex - wv, (54 + ey) / 2], [ex + wv * .6, ey - 8], [ex - wv * .4, ey]];
    else P = [[wx + t * 8, wy + 1], [cx + t * (half + 6), 30], [cx + t * (half + 3), 50], [ex, ey - 16], [ex - t * 2, ey]];
    lockP(H, P, w, o.w1 ?? 0, { fade: .28, p: o.p ?? (len < 70 ? 2.2 : 1.5), tz: len < 70 ? 0 : (o.tz ?? 12), bias: -Math.abs(t) * .04, vary: len < 70 ? H.vary : .3, strands: len < 70 ? undefined : 2, ...o.opts });
  }
}
// BACK: the crown whorl, two clumps arcing off it over the top of the head and a tiny swirl
function whorl(H, wx, wy) {
  const { R, cx } = H, x = cx + wx;
  lock(H, [x + 2, wy + 2], [x - 22, wy - 16], [x - 34, wy + 22], 14, 2, { fade: .2, p: 1.8 });
  lock(H, [x - 2, wy + 2], [x + 18, wy - 14], [x + 28, wy + 22], 13, 2, { fade: .2, p: 1.8 });
  lock(H, [x, wy - 1], [x - 8, wy - 9], [x - 14, wy + 4], 7, 1, { fade: .1, p: 1.5, shine: false });
  const sw = R.M(); [[x - 1, wy - 2], [x, wy - 2], [x + 1, wy - 1], [x + 1, wy], [x, wy + 1]].forEach(([a, b]) => sw.set(a, b));
  retone(H, sw, 1);
}
// A tail (pony / twin / side tail): several clumps fanning from the tie along a path.
//  P path from the tie to the tip, w overall width, n clumps
function tail(H, P, w, o = {}) {
  const n = o.n ?? 4, ord = [];
  for (let k = 0; k < n; k++) ord.push(n === 1 ? 0 : (k / (n - 1)) * 2 - 1);
  ord.sort((a, b) => Math.abs(b) - Math.abs(a));
  const last = P.length - 1;
  for (const t of ord) {
    // fan out sideways (perpendicular to the overall tail direction) toward the tip
    const dx = P[last][0] - P[0][0], dy = P[last][1] - P[0][1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    const j = hash(t * 5 + P[0][0], P[0][1]);
    const Q = P.map(([x, y], i) => {
      const f = i / last, spread = t * w * (.15 + .35 * Math.sin(Math.PI * Math.min(1, f * 1.2)));
      return [x + nx * spread, y + ny * spread + (i === last ? -Math.abs(t) * 6 - j * 5 : 0)];
    });
    lockP(H, Q, w * (.75 - Math.abs(t) * .2), 0, { fade: .12, p: o.p ?? 2, bias: (o.bias || 0) - Math.abs(t) * .06, free: true, body: o.body, ...o.opts });
  }
}
// A scrunchie / hair tie: a ring of puffs, each its own shaded piece.
function scrunchie(H, x, y, rad, rr, o = {}) {
  const { R } = H, n = o.n ?? 5, all = R.M();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (o.rot || 0), px = x + Math.cos(a) * rad * .55, py = y + Math.sin(a) * rad * .45;
    const m = R.M().ellipse(px, py, rad * .55, rad * .5);
    R.paint(m, rr, { flat: true, round: 2, shiny: false });
    all.add(m);
  }
  const sh = all.clone(); const s2 = R.M(); sh.each((a, b) => s2.set(a + 1, b + 1)); s2.sub(all);
  retone(H, s2, 1);
  R.fill(R.M().set(Math.round(x - rad * .5), Math.round(y - rad * .45)), rr.spec);
  return all;
}
// A ribbon bow: two loops and two tails with folds, separate shaded pieces.
function bow(H, x, y, sz, rr, o = {}) {
  const { R } = H, m = R.M(), f = o.flip ? -1 : 1;
  const tails = R.lock([x, y], [x - 2 * f, y + sz], [x - 4 * f, y + sz * 1.8], sz * .7, sz * .5).add(R.lock([x, y], [x + 3 * f, y + sz], [x + 5 * f, y + sz * 1.7], sz * .7, sz * .5));
  R.paint(tails, ramp(rr.sh), { flat: true, round: 1.5 });
  const L = R.M().poly([[x, y], [x - sz * 1.4, y - sz * .9], [x - sz * 1.6, y + sz * .5]]);
  const Rr = R.M().poly([[x, y], [x + sz * 1.4, y - sz * .9], [x + sz * 1.6, y + sz * .5]]);
  R.paint(L, rr, { flat: true, round: 2 }); R.paint(Rr, rr, { flat: true, round: 2, bias: -.08 });
  R.crease([x - sz * .3, y - 1], [x - sz * .8, y - sz * .3], [x - sz * 1.3, y - sz * .2], rr, L, { noLip: true, tone: 4 });
  R.crease([x + sz * .3, y - 1], [x + sz * .8, y - sz * .3], [x + sz * 1.3, y - sz * .2], rr, Rr, { noLip: true, tone: 4 });
  const knot = R.M().ellipse(x, y, sz * .45, sz * .45);
  R.paint(knot, rr, { flat: true, round: 1.5, bias: .05 });
  R.fill(R.M().set(Math.round(x - sz * 1.0), Math.round(y - sz * .45)), rr.hi);
  m.add(tails).add(L).add(Rr).add(knot);
  return m;
}

// ---------- styles ----------
// Styles are registered at the end in ORDER (the wardrobe's display order).
const STYLES = {};
function hair(id, name, fn, extra = {}) { STYLES[id] = { name, fn, extra }; }
function register(id) {
  const { name, fn, extra } = STYLES[id];
  return item('hair', id, name, null, (R, ph, r) => {
    const H = ctx(R, r, ph);
    // in the back view everything is drawn over the body
    if (R.view === 'back' && ph !== 'front') return;
    const post = fn(H, R.view, R.view === 'back' ? 'front' : ph);
    if (!H.all.empty()) finish(H);
    if (typeof post === 'function') post();
  }, { hair: true, ...extra });
}
const TIE_RED = ramp('#e0475a'), TIE_PINK = ramp('#f7a8c4'), TIE_GOLD = ramp('#f5d04a', 'metal'), TIE_NAVY = ramp('#3b4a8a');

// ---- BOB ----
hair('bob', 'Bob', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') { // inner side of the hair seen behind the neck
      mass(H, R.M().poly([[cx - 34, 30], [cx + 34, 30], [cx + 35, 66], [cx - 35, 66]]), { bias: -.35, round: 6 });
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) lockS(H, s, [[20 + k * 6, 40], [26 + k * 6, 56], [19 + k * 7, 69 - k]], 11, 1, { bias: -.3, fade: .4 });
      return;
    }
    frontCap(H, { side: 54 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [45, 22], [37, 61]], 18, 2, { fade: .4, p: 2.2 });
      lockS(H, s, [[22, 4], [41, 34], [32, 63]], 14, 0, { fade: .4, p: 2 });
      lockS(H, s, [[26, 12], [34, 40], [27, 60]], 10, 0, { fade: .35, p: 1.8, face: true });
    }
    fringe(H, [[-27, 39, 17, -3], [-15, 35, 19, 2], [-3, 38, 19, -2], [9, 34, 19, 3], [20, 37, 17, 2], [29, 40, 14, 4]], { part: -4 });
    fringe(H, [[-10, 40, 6, -1], [14, 39, 6, 1]], { part: -4, fade: .5 });
    H.band = domeBand(H, 11, 60);
  } else if (view === 'side') {
    if (ph === 'back') return;
    sideCap(H);
    nape(H, [[71, 52], [67, 61], [59, 65], [50, 64], [42, 61]]);
    lock(H, [30, 4], [42, 30], [32, 61], 14, 0, { fade: .4, p: 2, face: true });
    lock(H, [26, 8], [34, 34], [28, 57], 9, 0, { fade: .4, p: 1.8, face: true });
    sideFringe(H, [[24, -2, 2, 38, 15], [30, -3, 10, 37, 14, 1], [34, -2, 17, 35, 13, 2], [38, 0, 23, 31, 12, 3]]);
    H.band = ringBand(40, 34, 30, 2, 30);
  } else {
    backCap(H, 57);
    backFall(H, { len: 63, n: 8, w: 19, jit: 3, drop: 2 });
    whorl(H, 3, 10);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- LONG & STRAIGHT ----
hair('long', 'Long & Straight', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') { frontCurtain(H, 114, { flare: 4 }); return; }
    frontCap(H, { side: 60 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [45, 24], [40, 64]], 17, 3, { fade: .4, p: 2 });
      // front locks falling over the shoulders
      lockS(H, s, [[24, 6], [44, 44], [38, 100]], 14, 0, { fade: .3, p: 2.4, body: true });
      lockS(H, s, [[27, 12], [36, 50], [31, 94]], 10, 0, { fade: .3, p: 2.2, face: true, body: true });
    }
    fringe(H, [[-26, 38, 15, -1], [-17, 36, 15, 1], [-8, 38, 15, -1], [1, 36, 15, 1], [10, 38, 15, -1], [19, 36, 15, 1], [27, 38, 14, 1]], { part: 0, p: 2.4 });
    H.band = domeBand(H, 11, 60);
  } else if (view === 'side') {
    if (ph === 'back') { sideCurtain(H, 114); return; }
    sideCap(H);
    nape(H, [[72, 60], [68, 66], [60, 70], [52, 70], [45, 68, 13]]);
    lock(H, [30, 4], [44, 36], [36, 92], 14, 0, { fade: .35, p: 2.4, face: true, body: true });
    lock(H, [26, 8], [34, 36], [28, 62], 9, 0, { fade: .4, p: 1.8, face: true });
    sideFringe(H, [[24, -2, 3, 38, 15], [30, -3, 10, 38, 14], [34, -2, 17, 37, 13], [38, 0, 23, 33, 12]]);
    H.band = ringBand(40, 34, 30, 2, 30);
  } else {
    backCap(H, 52);
    backFall(H, { len: 114, n: 9, w: 20, jit: 5, drop: 4, flare: 4 });
    whorl(H, 3, 10);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- HIME ----
hair('hime', 'Hime Cut', (H, view, ph) => {
  const { R, cx } = H;
  const blunt = { p: 4, fade: .45 };
  if (view === 'front') {
    if (ph === 'back') { frontCurtain(H, 118, { flare: 2 }); return; }
    frontCap(H, { side: 62 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[18, -2], [44, 24], [41, 66]], 16, 9, { fade: .4, p: 3 });
      // the hime sidelocks: straight, cut bluntly at the jaw
      lockS(H, s, [[25, 8], [36, 36], [34, 66]], 11, 8, { ...blunt, face: true });
      lockS(H, s, [[28, 14], [31, 40], [29, 64]], 8, 6, { ...blunt, face: true });
    }
    const tips = []; for (let k = -3; k <= 3; k++) tips.push([k * 8.6, 35 + (k % 2 ? 1 : 0), 12, 0]);
    fringe(H, tips, { part: 0, w1: 7, p: 4, spread: .6 });
    H.band = domeBand(H, 11, 60);
  } else if (view === 'side') {
    if (ph === 'back') { sideCurtain(H, 118); return; }
    sideCap(H);
    nape(H, [[72, 60], [68, 66], [60, 70], [52, 70], [45, 68, 13]]);
    lock(H, [32, 4], [38, 30], [35, 66], 12, 9, { ...blunt, face: true });
    lock(H, [28, 8], [31, 34], [30, 64], 8, 6, { ...blunt, face: true });
    sideFringe(H, [[24, -2, 4, 36, 14], [30, -3, 11, 36, 13], [34, -2, 18, 35, 12], [38, 0, 24, 34, 11]], { opts: { p: 3.5 } });
    H.band = ringBand(40, 34, 30, 2, 30);
  } else {
    backCap(H, 52);
    backFall(H, { len: 118, n: 9, w: 19, w1: 9, jit: 1, drop: 0, flare: 2, p: 4 });
    whorl(H, 3, 10);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- CURTAIN BANGS ----
hair('curtain', 'Curtain Bangs', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') { frontCurtain(H, 90, { flare: 3, n: 3 }); return; }
    frontCap(H, { side: 60, capY: 18 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [45, 26], [40, 68]], 17, 1, { fade: .4, p: 2 });
      lockS(H, s, [[22, 6], [42, 44], [36, 80]], 13, 0, { fade: .35, p: 2.2, body: true });
      // the curtain: parted at the centre, sweeping out past the cheeks
      lockS(H, s, [[10, -2], [30, 16], [33, 50]], 14, 0, { fade: .4, p: 2, face: true });
      lockS(H, s, [[3, 0], [8, 22], [28, 44]], 16, 0, { fade: .35, p: 1.8, face: true });
      lockS(H, s, [[1, 2], [3, 20], [15, 33]], 11, 0, { fade: .4, p: 1.8, face: true });
    }
    H.band = domeBand(H, 11, 60);
  } else if (view === 'side') {
    if (ph === 'back') { sideCurtain(H, 90, { n: 4 }); return; }
    sideCap(H);
    nape(H, [[72, 58], [68, 66], [60, 70], [52, 68], [45, 66, 13]]);
    lock(H, [30, 4], [44, 36], [36, 78], 13, 0, { fade: .35, p: 2.2, face: true, body: true });
    sideFringe(H, [[28, -3, 4, 32, 15, -4], [33, -2, 12, 38, 13, -3], [38, 0, 26, 40, 11, -2]]);
    H.band = ringBand(40, 34, 30, 2, 30);
  } else {
    backCap(H, 52);
    backFall(H, { len: 90, n: 8, w: 20, jit: 5, drop: 4, flare: 3 });
    whorl(H, 3, 10);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- TWIN TAILS ----
function twinTail(H, s, y0) { // tail on side s hanging from a tie at dx 35
  tail(H, [[X(H, s, 35), y0], [X(H, s, 45), y0 + 14], [X(H, s, 48), y0 + 42], [X(H, s, 45), y0 + 64], [X(H, s, 39), y0 + 82]], 19, { n: 4 });
}
hair('twintail', 'Twin Tails', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') { for (const s of [-1, 1]) twinTail(H, s, 16); return; }
    frontCap(H, { side: 50 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [44, 20], [37, 50]], 16, 2, { fade: .4, p: 2 });
      lockS(H, s, [[26, 12], [34, 36], [28, 54]], 9, 0, { fade: .35, p: 1.8, face: true });
    }
    fringe(H, [[-27, 38, 15, -2], [-17, 35, 16, 1], [-7, 38, 16, -1], [3, 35, 16, 1], [13, 38, 16, -1], [23, 35, 15, 2], [29, 39, 11, 2]], { part: -2 });
    H.band = domeBand(H, 11, 60);
    return () => { for (const s of [-1, 1]) scrunchie(H, X(H, s, 35), 16, 7, TIE_PINK, { rot: s }); };
  } else if (view === 'side') {
    if (ph === 'back') return;
    sideCap(H, { nape: 58 });
    nape(H, [[70, 50], [66, 58], [58, 62], [50, 62], [42, 58]]);
    lock(H, [26, 8], [34, 34], [28, 55], 9, 0, { fade: .4, p: 1.8, face: true });
    sideFringe(H, [[24, -2, 3, 38, 15], [30, -3, 10, 37, 14, 1], [34, -2, 17, 36, 13, 2], [38, 0, 23, 32, 12, 3]]);
    tail(H, [[54, 14], [66, 26], [70, 54], [66, 78], [59, 96]], 19, { n: 4, body: true });
    H.band = ringBand(40, 34, 30, 2, 30);
    return () => scrunchie(H, 54, 14, 7, TIE_PINK);
  } else {
    backCap(H, 57);
    // centre part: hair combs out from the parting to each tie, the rest falls to the nape
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) lockS(H, s, [[1, 4 + k * 12], [12 + k * 4, 6 + k * 6], [33, 17]], 14, 6, { fade: .1, p: 1.6, cast: 0 });
      lockS(H, s, [[32, 20], [37, 40], [26, 60]], 16, 1, { fade: .2, p: 2 });
      lockS(H, s, [[22, 24], [24, 44], [12, 61]], 15, 1, { fade: .2, p: 2 });
      lockS(H, s, [[10, 30], [8, 48], [2, 61]], 13, 1, { fade: .2, p: 2 });
    }
    const pt = R.M(); for (let y = 2; y < 40; y++) pt.set(cx, y);
    retone(H, pt, 2);
    for (const s of [-1, 1]) twinTail(H, s, 17);
    H.band = domeBand(H, 12, 60);
    return () => { for (const s of [-1, 1]) scrunchie(H, X(H, s, 34), 17, 7, TIE_PINK, { rot: s }); };
  }
});

// ---- HIGH PONYTAIL ----
hair('pony', 'High Ponytail', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') { tail(H, [[cx + 8, -2], [cx + 32, -10], [cx + 47, 12], [cx + 49, 44], [cx + 44, 72], [cx + 39, 90]], 20, { n: 4 }); return; }
    frontCap(H, { side: 42, vol: 2 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [42, 16], [36, 42]], 15, 3, { fade: .4, p: 2 });
      lockS(H, s, [[26, 14], [32, 34], [29, 54]], 7, 0, { fade: .35, p: 1.6, face: true }); // loose wisp
    }
    fringe(H, [[-27, 36, 15, -4], [-16, 34, 17, -4], [-5, 37, 17, -3], [7, 32, 16, -3], [18, 29, 15, -2], [27, 33, 12, -1]], { part: 10 });
    H.band = domeBand(H, 11, 60);
  } else if (view === 'side') {
    if (ph === 'back') { tail(H, [[60, 6], [74, -2], [83, 16], [81, 46], [76, 74], [70, 92]], 20, { n: 4 }); return; }
    // pulled back: the hairline runs from the temple round behind the ear
    const ear = R.M().ellipse(46, 53, 9, 12);
    const D = dome(H, 2);
    H.clip = D.clone().add(rectM(R, -30, 14, 110, 140)).sub(ear);
    mass(H, D.clone().keep((x, y) => y < 16 || (x > 18 && y < 26) || (x > 30 && y < 34) || (x > 38 && y < 42) || (x >= 54 && y < 58)).sub(ear));
    [[62, 54, 14], [56, 58, 13], [48, 46, 11]].forEach(([x, y, w]) => lock(H, [x, y], [x + 10, 26], [60, 7], w, 6, { fade: .08, p: 1.4, cast: 0, shine: false }));
    [[40, 40, 11], [32, 32, 13], [24, 22, 14], [34, 4, 14]].forEach(([x, y, w]) => lock(H, [x, y], [x + 14, y - 10], [60, 7], w, 6, { fade: .08, p: 1.4 }));
    lock(H, [26, 10], [30, 32], [27, 52], 7, 0, { fade: .35, p: 1.6, face: true });
    sideFringe(H, [[26, -2, 3, 36, 15, -2], [30, -3, 9, 34, 14], [34, -2, 16, 33, 13, 1], [38, 0, 22, 28, 11, 2]]);
    H.band = ringBand(46, 36, 30, 2, 26);
    return () => scrunchie(H, 60, 6, 7, TIE_RED, { n: 5 });
  } else {
    // pulled up tight: the ears show below the hairline at the sides
    backCap(H, 56, { vol: 2, keep: (x, y) => y < 38 || Math.abs(x - cx) < 33 - Math.max(0, y - 38) * .3 });
    // hair swept up from the nape and sides to the tie
    for (const t of [-1, 1, -.66, .66, -.33, .33, 0]) lock(H, [cx + t * 30, 58 - Math.abs(t) * 12], [cx + t * 36, 30], [cx + t * 4, 15], 18 - Math.abs(t) * 4, 7, { fade: .05, p: 1.4, tipDark: -.6 });
    tail(H, [[cx, 14], [cx + 5, 30], [cx + 7, 58], [cx + 3, 80], [cx - 1, 96]], 21, { n: 5, body: true });
    H.band = domeBand(H, 30, 60);
    return () => scrunchie(H, cx, 13, 8, TIE_RED, { n: 6 });
  }
});

// ---- SIDE TAIL ---- (on the character's left: viewer's right in front, left in back)
hair('sidetail', 'Side Tail', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') return;
    frontCap(H, { side: 50 });
    lockS(H, -1, [[16, -2], [44, 20], [37, 54]], 16, 2, { fade: .4, p: 2 });
    lockS(H, -1, [[26, 12], [34, 36], [28, 56]], 9, 0, { fade: .35, p: 1.8, face: true });
    // the other side is combed toward the tie
    lockS(H, 1, [[10, -4], [38, 0], [36, 24]], 16, 8, { fade: .2, p: 1.4 });
    lockS(H, 1, [[22, 10], [34, 18], [34, 25]], 10, 6, { fade: .2, p: 1.4 });
    fringe(H, [[-27, 38, 15, -4], [-16, 36, 17, -3], [-5, 38, 16, -3], [7, 34, 16, -2], [18, 31, 14, -2], [26, 34, 10, -1]], { part: 12 });
    tail(H, [[X(H, 1, 34), 25], [X(H, 1, 46), 38], [X(H, 1, 48), 62], [X(H, 1, 42), 84], [X(H, 1, 36), 100]], 19, { n: 4, body: true });
    H.band = domeBand(H, 11, 60);
    return () => scrunchie(H, X(H, 1, 34), 25, 7, TIE_GOLD);
  } else if (view === 'side') {
    if (ph === 'back') return;
    sideCap(H, { nape: 58 });
    nape(H, [[70, 48], [66, 56], [58, 60], [50, 58]]);
    [[30, 4, 15], [38, 0, 15]].forEach(([x, y, w]) => lock(H, [x, y], [x + 12, y + 12], [48, 30], w, 7, { fade: .15, p: 1.4 }));
    sideFringe(H, [[24, -2, 3, 37, 15, -2], [30, -3, 10, 35, 14], [34, -2, 17, 34, 13, 1], [38, 0, 23, 30, 12, 2]]);
    tail(H, [[48, 30], [58, 42], [60, 66], [54, 86], [47, 100]], 19, { n: 4, body: true });
    H.band = ringBand(40, 34, 30, 2, 28);
    return () => scrunchie(H, 48, 30, 7, TIE_GOLD);
  } else {
    backCap(H, 56);
    backFall(H, { len: 62, n: 6, w: 18, jit: 3, drop: 2, half: 30, wx: 8 });
    // hair on that side gathered into the tie
    for (const [a, b, w] of [[[4, 6], [20, 4], 15], [[10, 30], [24, 34], 14], [[16, 52], [28, 44], 13]]) lockS(H, -1, [a, b, [33, 25]], w, 7, { fade: .1, p: 1.4 });
    whorl(H, 6, 10);
    tail(H, [[X(H, -1, 34), 25], [X(H, -1, 46), 38], [X(H, -1, 48), 62], [X(H, -1, 42), 84], [X(H, -1, 36), 100]], 19, { n: 4 });
    H.band = domeBand(H, 12, 60);
    return () => scrunchie(H, X(H, -1, 34), 25, 7, TIE_GOLD);
  }
});

// ---- SPACE BUNS ----
// a bun: a round mass wrapped by crescent clumps spiralling round it
function bun(H, x, y, rad, o = {}) {
  const { R } = H, m = R.M().ellipse(x, y, rad, rad * .94);
  // contact shadow on the hair under the bun
  const sh = R.M(); m.each((a, b) => { sh.set(a + 1, b + 2); sh.set(a, b + 2); }); retone(H, sh.sub(m).and(H.all), 1);
  mass(H, m, { round: rad * .7, bias: o.bias || 0 });
  for (let k = 0; k < 4; k++) {
    const a0 = k * Math.PI / 2 + (o.rot || 0) - 2.2, P = [];
    for (let i = 0; i <= 4; i++) { const a = a0 + i * .55, rr = rad * (.25 + i * .17); P.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * .94]); }
    lockP(H, P, rad * .75, 2, { fade: .05, p: 1.2, clip: m, free: true, tipDark: .4, strands: 0, bias: o.bias || 0 });
  }
  H.locks[H.locks.length - 1].shine = true;
  return m;
}
hair('buns', 'Space Buns', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') return;
    frontCap(H, { side: 52 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [44, 20], [37, 52]], 16, 2, { fade: .4, p: 2 });
      lockS(H, s, [[26, 12], [34, 36], [28, 56]], 9, 0, { fade: .35, p: 1.8, face: true });
    }
    for (const s of [-1, 1]) bun(H, X(H, s, 25), -3, 10, { rot: s > 0 ? .4 : 0 });
    fringe(H, [[-27, 37, 14, -4], [-17, 34, 16, -4], [-7, 36, 15, -3], [7, 36, 15, 3], [17, 34, 16, 4], [27, 37, 14, 4]], { part: 0, spread: .5 });
    fringe(H, [[0, 28, 9, 0]], { part: 0, fade: .5 });
    H.band = (x, y) => domeBand(H, 11, 60)(x, y) && y > 4;
  } else if (view === 'side') {
    if (ph === 'back') return;
    sideCap(H, { nape: 58 });
    bun(H, 32, -8, 9, { bias: -.25 }); // the far bun peeking out
    nape(H, [[70, 50], [66, 58], [58, 62], [50, 62], [42, 58]]);
    lock(H, [26, 8], [34, 34], [28, 56], 9, 0, { fade: .4, p: 1.8, face: true });
    sideFringe(H, [[24, -2, 3, 37, 15, -2], [30, -3, 10, 36, 14], [34, -2, 17, 35, 13, 1], [38, 0, 23, 31, 12, 2]]);
    bun(H, 46, -5, 10, { rot: .5 });
    H.band = (x, y) => ringBand(40, 34, 30, 2, 30)(x, y) && y > 3;
  } else {
    backCap(H, 57);
    backFall(H, { len: 62, n: 8, w: 18, jit: 3, drop: 2 });
    lock(H, [cx + 2, 2], [cx - 12, 10], [cx - 26, 40], 13, 2, { fade: .2 });
    lock(H, [cx - 2, 2], [cx + 12, 10], [cx + 26, 40], 13, 2, { fade: .2 });
    for (const s of [-1, 1]) bun(H, X(H, s, 25), -3, 10, { rot: s > 0 ? .4 : 0 });
    H.band = (x, y) => domeBand(H, 14, 60)(x, y) && y > 8;
  }
});

// ---- HERO SPIKES ----
const SPIKE = { p: 1.05, fade: .3, k: .95, strands: 1 };
hair('spiky', 'Hero Spikes', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') return;
    const D = dome(H, 3);
    H.clip = null;
    // big spikes fanning out of the crown, behind the front hair
    for (const [dx, tx, ty, w] of [[-20, -46, 8, 24], [20, 47, 6, 24], [-14, -35, -13, 25], [14, 35, -15, 25], [-5, -14, -22, 25], [6, 11, -23, 25]])
      lock(H, [cx + dx * .5, 20], [cx + (dx + tx) * .5, (20 + ty) / 2], [cx + tx, ty], w, 0, SPIKE);
    H.clip = D.clone().add(rectM(R, cx - 70, 12, cx + 70, 140)).add(H.all);
    mass(H, D.clone().keep((x, y) => y < 16 || (Math.abs(x - cx) >= 27 && y < 46)));
    for (const s of [-1, 1]) {
      lockS(H, s, [[18, 4], [44, 22], [47, 38]], 14, 0, { ...SPIKE, free: true });
      lockS(H, s, [[22, 12], [40, 34], [42, 50]], 12, 0, { ...SPIKE, free: true });
      lockS(H, s, [[26, 16], [33, 34], [29, 51]], 9, 0, { ...SPIKE, face: true });
    }
    fringe(H, [[-26, 38, 15, -5], [-15, 33, 17, -3], [-3, 40, 17, 2], [9, 33, 16, 4], [20, 38, 15, 5], [28, 31, 11, 4]], { part: 2, p: 1.3 });
    H.band = domeBand(H, 10, 60);
  } else if (view === 'side') {
    if (ph === 'back') return;
    for (const [tx, ty, w] of [[8, -10, 22], [26, -20, 24], [46, -18, 24], [64, -6, 24], [78, 12, 22], [80, 32, 20], [72, 52, 16]])
      lock(H, [40 + (tx - 40) * .3, 24 + (ty - 24) * .25], [40 + (tx - 40) * .65, 24 + (ty - 24) * .6], [tx, ty], w, 0, SPIKE);
    const D = dome(H, 3);
    H.clip = D.clone().add(rectM(R, -30, 14, 110, 140)).add(H.all);
    mass(H, D.clone().keep((x, y) => y < 16 || (x >= 28 && y < 58) || (x > 18 && y < 30)));
    nape(H, [[76, 44], [72, 56], [62, 63], [52, 62], [43, 58]], { opts: SPIKE });
    lock(H, [26, 8], [34, 34], [27, 52], 10, 0, { ...SPIKE, face: true });
    sideFringe(H, [[24, -2, 0, 36, 15, -3], [30, -3, 9, 39, 14, -1], [34, -2, 17, 34, 13, 1], [38, 0, 24, 30, 12, 2]], { opts: { p: 1.3 } });
    H.band = ringBand(40, 34, 30, 2, 30);
  } else {
    for (const [dx, tx, ty, w] of [[-24, -46, 34, 20], [24, 48, 36, 20], [-20, -47, 10, 24], [20, 48, 12, 24], [-14, -36, -11, 25], [14, 36, -11, 25], [-5, -14, -21, 25], [6, 12, -22, 25]])
      lock(H, [cx + dx * .5, 24], [cx + (dx + tx) * .5, (24 + ty) / 2], [cx + tx, ty], w, 0, SPIKE);
    const D = dome(H, 3);
    H.clip = D.clone().add(rectM(R, -40, 14, 130, 140)).add(H.all);
    mass(H, D.clone().keep((x, y) => y < 50));
    backFall(H, { len: 64, n: 8, w: 18, jit: 7, drop: 5, p: 1.2 });
    whorl(H, 3, 10);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- MESSY SHORT ----
function ahoge(H, x, y, s = 1) { lock(H, [x, y + 6], [x + 3 * s, y - 12], [x + 12 * s, y - 8], 5, 0, { fade: .2, p: 1.2, free: true, shine: false }); }
hair('messy', 'Messy Short', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') return;
    frontCap(H, { side: 44 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [42, 18], [48, 32]], 15, 0, { fade: .35, p: 1.5, free: true }); // flick out
      lockS(H, s, [[20, 8], [42, 34], [44, 48]], 13, 0, { fade: .35, p: 1.5, free: true });
      lockS(H, s, [[26, 14], [34, 34], [29, 52]], 9, 0, { fade: .35, p: 1.6, face: true });
    }
    fringe(H, [[-27, 35, 15, -6], [-17, 38, 16, -4], [-5, 33, 17, -5], [6, 37, 16, -3], [17, 32, 16, -4], [27, 35, 13, 3]], { part: 8, p: 1.7 });
    fringe(H, [[-11, 39, 7, -2], [12, 38, 6, 2]], { part: 8, fade: .5, p: 1.5 });
    ahoge(H, cx + 4, -2, 1);
    H.band = domeBand(H, 10, 60);
  } else if (view === 'side') {
    if (ph === 'back') return;
    sideCap(H, { nape: 56 });
    nape(H, [[74, 44, 17], [72, 56, 16], [62, 62, 15], [50, 60, 14], [43, 56, 12]], { opts: { p: 1.5 } });
    lock(H, [26, 8], [34, 34], [27, 52], 10, 0, { fade: .4, p: 1.6, face: true });
    sideFringe(H, [[24, -2, 0, 34, 15, -4], [30, -3, 9, 38, 14, -2], [34, -2, 17, 34, 13, 1], [38, 0, 24, 30, 12, 2]], { opts: { p: 1.7 } });
    ahoge(H, 38, -4, 1);
    H.band = ringBand(40, 34, 30, 2, 30);
  } else {
    backCap(H, 52);
    backFall(H, { len: 58, n: 8, w: 18, jit: 5, drop: 2, p: 1.6 });
    for (const s of [-1, 1]) lockS(H, s, [[26, 38], [36, 50], [41, 58]], 12, 0, { fade: .3, p: 1.3, free: true });
    whorl(H, 3, 10);
    ahoge(H, cx + 2, -3, -1);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- PIXIE ----
hair('pixie', 'Pixie', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') return;
    frontCap(H, { side: 38, vol: 1, top: -3, capY: 14 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[18, -1], [38, 14], [36, 36]], 15, 2, { fade: .4, p: 1.8 });
      lockS(H, s, [[27, 10], [35, 30], [31, 48]], 9, 0, { fade: .4, p: 1.6, face: true }); // sideburn
    }
    fringe(H, [[-26, 26, 15, -5], [-15, 24, 16, -5], [-4, 27, 16, -4], [8, 22, 15, -4], [19, 23, 14, -3], [27, 27, 11, -1]], { part: 12, midY: 12, rootY: -2 });
    H.band = domeBand(H, 9, 70);
  } else if (view === 'side') {
    if (ph === 'back') return;
    sideCap(H, { nape: 56, vol: 1, top: -3 });
    nape(H, [[70, 46, 16], [66, 54, 15], [58, 58, 14], [50, 56, 13], [42, 52, 12]], { bulge: -2 });
    lock(H, [28, 8], [34, 30], [30, 48], 9, 0, { fade: .4, p: 1.6, face: true });
    sideFringe(H, [[26, -1, 6, 26, 14, -3], [31, -2, 13, 25, 13, -1], [36, -1, 21, 22, 12, 1]]);
    H.band = ringBand(40, 34, 30, 2, 28);
  } else {
    backCap(H, 50, { vol: 1, top: -3 });
    backFall(H, { len: 56, n: 8, w: 17, jit: 3, drop: 2, half: 32 });
    whorl(H, 3, 10);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- WOLF CUT ----
hair('wolf', 'Wolf Cut', (H, view, ph) => {
  const { R, cx } = H;
  const SH = { p: 1.3, fade: .3 };
  if (view === 'front') {
    if (ph === 'back') {
      mass(H, R.M().poly([[cx - 34, 30], [cx + 34, 30], [cx + 40, 74], [cx - 40, 74]]), { bias: -.2, round: 6 });
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) lockS(H, s, [[22 + k * 5, 34], [34 + k * 5, 58], [30 + k * 7, 84 - k * 5]], 13, 0, { ...SH, bias: -.15 });
      return;
    }
    frontCap(H, { side: 60 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [44, 18], [50, 36]], 15, 0, { ...SH });    // upper layer flicks out
      lockS(H, s, [[20, 10], [44, 40], [47, 60]], 14, 0, { ...SH, free: true });
      lockS(H, s, [[26, 14], [36, 42], [30, 64]], 10, 0, { ...SH, face: true });
    }
    fringe(H, [[-27, 39, 14, -3], [-17, 34, 16, -2], [-6, 40, 16, -2], [5, 33, 16, 2], [16, 39, 16, 3], [26, 34, 13, 3]], { part: 0, p: 1.4 });
    H.band = domeBand(H, 10, 60);
  } else if (view === 'side') {
    if (ph === 'back') { for (let k = 0; k < 4; k++) lock(H, [44 + k * 5, 30], [64 + k * 3, 52], [56 + k * 6, 86 - k * 4], 14, 0, { ...SH, bias: -.12 }); return; }
    sideCap(H);
    nape(H, [[76, 40, 17], [74, 54, 16], [70, 68, 15], [60, 70, 14], [50, 66, 13]], { opts: SH, bulge: 2 });
    lock(H, [28, 6], [42, 36], [34, 62], 12, 0, { ...SH, face: true });
    sideFringe(H, [[24, -2, 2, 38, 15, -2], [30, -3, 10, 34, 14], [34, -2, 17, 39, 13, 1], [38, 0, 24, 32, 12, 2]], { opts: { p: 1.4 } });
    H.band = ringBand(40, 34, 30, 2, 30);
  } else {
    backCap(H, 52);
    backFall(H, { len: 84, n: 8, w: 18, jit: 10, drop: 8, p: 1.3, tz: 14 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[22, 30], [40, 46], [48, 58]], 13, 0, { ...SH, free: true });
      lockS(H, s, [[16, 40], [34, 62], [40, 74]], 12, 0, { ...SH, free: true });
    }
    whorl(H, 3, 10);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- PRINCESS CURLS ----
// a long clump that ends in a ringlet: falls along P, then turns into two or three coils
function ringlet(H, P, w, s, o = {}) {
  const [x, y] = P[P.length - 1], cl = o.coil ?? 20;
  const Q = P.slice(0, -1).concat([[x, y - cl + 2]]);
  lockP(H, Q, w, w * .7, { fade: .25, p: 2, ...o });
  drill(H, x, y - cl, cl, w * .78, s, { body: o.body, bias: (o.bias || 0) + .1 });
}
hair('curls', 'Princess Curls', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') {
      mass(H, R.M().poly([[cx - 35, 20], [cx + 35, 20], [cx + 46, 104], [cx - 46, 104]]), { bias: -.2, round: 6 });
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
        const d = 34 - k * 6;
        ringlet(H, [[X(H, s, d - 6), 22], [X(H, s, d + 10), 50], [X(H, s, d + 8 - k), 80], [X(H, s, d + 10 - k * 2), 112 - k * 4]], 15 - k, -s, { bias: -.12 - k * .03 });
      }
      return;
    }
    frontCap(H, { side: 60 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [45, 24], [40, 64]], 17, 3, { fade: .4, p: 2 });
      ringlet(H, [[X(H, s, 24), 6], [X(H, s, 44), 40], [X(H, s, 40), 70], [X(H, s, 38), 96]], 14, -s, { body: true });
      ringlet(H, [[X(H, s, 28), 12], [X(H, s, 36), 44], [X(H, s, 34), 72]], 9, s, { face: true, body: true, coil: 18 });
    }
    fringe(H, [[-26, 36, 15, -4], [-15, 34, 17, -4], [-5, 31, 15, -3], [5, 31, 15, 3], [15, 34, 17, 4], [26, 36, 15, 4]], { part: 0, spread: .5 });
    H.band = domeBand(H, 11, 60);
  } else if (view === 'side') {
    if (ph === 'back') {
      mass(H, R.M().poly([[34, 12], [64, 8], [78, 104], [46, 104]]), { bias: -.2, round: 6 });
      for (let k = 0; k < 5; k++) ringlet(H, [[40 + k * 5, 12], [64 + k * 3, 34], [56 + k * 5, 70], [52 + k * 6, 112 - (k % 2) * 6]], 15, k % 2 ? 1 : -1, { bias: -.08 - (5 - k) * .03 });
      return;
    }
    sideCap(H);
    nape(H, [[72, 60], [68, 66], [60, 70], [52, 70], [45, 68, 13]]);
    ringlet(H, [[30, 4], [44, 36], [40, 64], [36, 92]], 14, 1, { face: true, body: true });
    sideFringe(H, [[24, -2, 3, 36, 15, -3], [30, -3, 10, 34, 14, -2], [34, -2, 17, 33, 13], [38, 0, 23, 30, 12, 2]]);
    H.band = ringBand(40, 34, 30, 2, 30);
  } else {
    backCap(H, 52);
    const ts = [-1, 1, -.66, .66, -.33, .33, 0];
    for (const t of ts) {
      const ex = cx + t * 40, len = 116 - Math.abs(t) * 8 - (Math.round(t * 3) % 2 ? 7 : 0);
      ringlet(H, [[cx + 3 + t * 8, 11], [cx + t * 46, 30], [cx + t * 44, 56], [ex + t * 3, 84], [ex, len]], 22 - Math.abs(t) * 3, t < 0 ? 1 : -1, { fade: .28, coil: 24 });
    }
    whorl(H, 3, 10);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- LONG WAVY ----
hair('wavy', 'Long Wavy', (H, view, ph) => {
  const { R, cx } = H;
  const W = { fade: .3, p: 1.5, tz: 14 };
  if (view === 'front') {
    if (ph === 'back') { frontCurtain(H, 110, { flare: 6, wave: 4 }); return; }
    frontCap(H, { side: 60 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [45, 24], [40, 64]], 17, 3, { fade: .4, p: 2 });
      lockS(H, s, [[22, 4], [44, 36], [37, 56], [44, 74], [38, 92], [42, 102]], 14, 0, { ...W, body: true });
      lockS(H, s, [[27, 12], [36, 40], [29, 58], [35, 76], [31, 92]], 10, 0, { ...W, face: true, body: true });
    }
    fringe(H, [[-27, 38, 15, -5], [-16, 36, 17, -5], [-5, 37, 16, -4], [7, 33, 16, -4], [18, 29, 15, -3], [27, 33, 12, -2]], { part: 12 });
    H.band = domeBand(H, 11, 60);
  } else if (view === 'side') {
    if (ph === 'back') { sideCurtain(H, 110, { wave: 4, flare: 4 }); return; }
    sideCap(H);
    nape(H, [[72, 60], [68, 66], [60, 70], [52, 70], [45, 68, 13]]);
    lockP(H, [[30, 4], [44, 36], [37, 56], [43, 74], [36, 94]], 14, 0, { ...W, face: true, body: true });
    sideFringe(H, [[24, -2, 2, 37, 15, -3], [30, -3, 10, 37, 14, -2], [34, -2, 17, 35, 13], [38, 0, 23, 31, 12, 2]]);
    H.band = ringBand(40, 34, 30, 2, 30);
  } else {
    backCap(H, 52);
    backFall(H, { len: 110, n: 9, w: 20, jit: 6, drop: 6, flare: 6, wave: 4 });
    whorl(H, 3, 10);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- CLOUD PUFF ----
// tone a list of view-local points by d (only on hair already painted)
function toneAt(H, pts, d) {
  const ox = H.V.ox, oy = H.V.oy, out = [];
  for (const [x, y] of pts) { const X0 = Math.round(x) + ox, Y0 = Math.round(y) + oy; if (X0 >= 0 && Y0 >= 0 && X0 < CW && Y0 < CH) out.push(Y0 * CW + X0); }
  retone(H, out, d);
}
const arcPts = (x, y, r, a0, a1) => { const out = []; for (let a = a0; a <= a1; a += .5 / r) out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); return out; };
// one curl in the cloud: the lower rim of a little puff, dark, with a lit lip inside it
function curlMark(H, x, y, r) {
  toneAt(H, arcPts(x, y, r, .15, 2.9), 1);
  toneAt(H, arcPts(x - .5, y - .8, r - 1.3, .5, 2.4), -1);
}
hair('puff', 'Cloud Puff', (H, view, ph) => {
  const { R, cx } = H;
  if (ph === 'back') return;
  const side = view === 'side', hx = side ? 39 : cx, cy = 14, rx = side ? 41 : 44, ry = 29;
  // silhouette: a core ellipse plus a ring of round puffs along its edge
  const cloud = R.M().ellipse(hx, cy + 2, rx - 7, ry - 5), bumps = [];
  const nb = side ? 12 : 13;
  for (let k = 0; k < nb; k++) {
    const a = Math.PI * (.9 + k / (nb - 1) * 1.2);
    const r = 9 + (k % 3 === 1 ? 2 : k % 3 === 2 ? 1 : 0);
    bumps.push([hx + Math.cos(a) * (rx - 8), cy + Math.sin(a) * (ry - 7), r]);
  }
  // lower side puffs hanging past the ears
  for (const s of side ? [1] : [-1, 1]) for (let k = 0; k < 3; k++) bumps.push([hx + s * (rx - 10 - k * 3), cy + 19 + k * 9, 9 - k]);
  if (view === 'back') for (let k = -2; k <= 2; k++) bumps.push([cx + k * 13, 44 - Math.abs(k) * 2, 9]);
  for (const [x, y, r] of bumps) cloud.ellipse(x, y, r, r);
  // the face opening, edged with a row of small curls (the fringe)
  const fringeC = [];
  if (view !== 'back') {
    const [hx0, hy0, hrx, hry, a0, a1, n] = side ? [1, 46, 22, 27, 4.72, 5.85, 4] : [cx, 47, 27, 29, 3.75, 5.67, 7];
    cloud.sub(R.M().ellipse(hx0, hy0, hrx, hry));
    for (let k = 0; k < n; k++) {
      const a = a0 + (a1 - a0) * k / (n - 1), x = hx0 + Math.cos(a) * (hrx + 1), y = hy0 + Math.sin(a) * (hry + 1) - 1;
      fringeC.push([x, y, 6]); cloud.ellipse(x, y, 6, 5.5);
    }
  }
  H.clip = null;
  mass(H, cloud, { round: 11, k: .8 });
  // each edge puff gets its rim, so the cloud reads as a heap of curls
  bumps.sort((a, b) => a[1] - b[1]);
  for (const [x, y, r] of bumps) curlMark(H, x, y + 1, r - 1);
  // smaller curls over the cloud's face, in a staggered grid
  const deep = cloud.clone(); deep.keep((x, y) => cloud.has(x - 6, y) && cloud.has(x + 6, y) && cloud.has(x, y - 6) && cloud.has(x, y + 7));
  for (let y = cy - ry + 6, row = 0; y < 50; y += 8, row++) for (let x = hx - rx + (row % 2 ? 5 : 10); x < hx + rx; x += 10) {
    const jx = x + (hash(x, y) - .5) * 3, jy = y + (hash(y, x) - .5) * 2;
    if (deep.has(Math.round(jx), Math.round(jy))) curlMark(H, jx, jy, 4 + (hash(x + y, 3) > .6 ? 1 : 0));
  }
  for (const [x, y, r] of fringeC) curlMark(H, x, y + 1, r - 2);
  H.face.add(cloud);
  // shine: lit curl tops on the upper-left of the cloud
  const sp = side ? [[18, -2], [28, -9], [40, -12]] : view === 'back' ? [[-24, -4], [-12, -11], [2, -13]] : [[-26, -4], [-14, -11], [0, -13]];
  for (const [dx, y] of sp) { const x = (side ? 0 : hx) + dx; toneAt(H, arcPts(x, y + 3, 4, 3.6, 5.4), -2); toneAt(H, [[x - 1, y], [x, y]], -3); }
});

// ---- SIDE BRAID ---- (over the character's left shoulder)
// a three-strand braid along P: short diagonal strands from alternate edges toward the
// centre, each overlapping half of the one above (the classic chevron plait)
function braid(H, P, w, o = {}) {
  const { R } = H, pts = pathPts(R, P), n = pts.length - 1, h = o.step ?? Math.max(4, Math.round(w * .32));
  const steps = Math.floor((n - h) / h);
  for (let k = 0; k <= steps; k++) {
    const i0 = Math.min(n, k * h), i1 = Math.min(n, i0 + h), [x0, y0] = pts[i0], [x1, y1] = pts[i1];
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const sd = k % 2 ? 1 : -1, ww = w * (1 - k / (steps + 1) * .3);
    const a = [x0 + nx * sd * ww * .38 - ux * h * .3, y0 + ny * sd * ww * .38 - uy * h * .3];
    const c = [x0 - nx * sd * ww * .1 + ux * h * 1.35, y0 - ny * sd * ww * .1 + uy * h * 1.35];
    const b = [(a[0] + c[0]) / 2 + ux * 1, (a[1] + c[1]) / 2 + uy * 1];
    lockP(H, [a, b, c], h * 1.7, h * 1.05, { fade: 0, p: 1, free: true, tipDark: 1, strands: 0, cast: 1, body: o.body, cdx: 0, cdy: 1, bias: .1, k: .9, round: 2, shine: false });
  }
  return pts[Math.min(n, (steps + 1) * h)];
}
function braidEnd(H, x, y, o = {}) {
  tail(H, [[x, y], [x + 1, y + 6], [x - 1, y + 14]], 10, { n: 3, body: o.body });
  scrunchie(H, x, y, 5, TIE_NAVY, { n: 4 });
}
hair('braid', 'Side Braid', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') { mass(H, R.M().poly([[cx - 34, 30], [cx + 34, 30], [cx + 36, 62], [cx - 36, 62]]), { bias: -.35, round: 6 }); return; }
    frontCap(H, { side: 54 });
    lockS(H, -1, [[16, -2], [44, 22], [37, 58]], 16, 2, { fade: .4, p: 2 });
    lockS(H, -1, [[26, 12], [34, 38], [28, 58]], 9, 0, { fade: .35, p: 1.8, face: true });
    // swept over to the braid side
    lockS(H, 1, [[8, -4], [42, 4], [34, 50]], 18, 10, { fade: .2, p: 1.4 });
    lockS(H, 1, [[22, 10], [38, 24], [33, 50]], 12, 8, { fade: .2, p: 1.4, face: true });
    fringe(H, [[-27, 38, 15, -4], [-16, 36, 17, -3], [-5, 38, 16, -3], [7, 34, 16, -2], [18, 31, 14, -2], [26, 35, 10, -1]], { part: 12 });
    const end = braid(H, [[X(H, 1, 32), 48], [X(H, 1, 36), 72], [X(H, 1, 33), 100]], 17, { body: true });
    H.band = domeBand(H, 11, 60);
    return () => braidEnd(H, end[0], end[1] + 2, { body: true });
  } else if (view === 'side') {
    if (ph === 'back') return;
    sideCap(H, { nape: 58 });
    nape(H, [[70, 50], [66, 58], [58, 62], [50, 60], [43, 56, 12]]);
    [[34, 0, 15], [40, 4, 15], [30, 8, 13]].forEach(([x, y, w]) => lock(H, [x, y], [x + 18, y + 20], [46, 50], w, 9, { fade: .15, p: 1.4 }));
    sideFringe(H, [[24, -2, 3, 37, 15, -2], [30, -3, 10, 35, 14], [34, -2, 17, 34, 13, 1], [38, 0, 23, 30, 12, 2]]);
    const end = braid(H, [[47, 48], [47, 74], [42, 100]], 17, { body: true });
    H.band = ringBand(40, 34, 30, 2, 28);
    return () => braidEnd(H, end[0], end[1] + 2, { body: true });
  } else {
    backCap(H, 56);
    backFall(H, { len: 62, n: 6, w: 18, jit: 3, drop: 2, half: 30, wx: 8 });
    for (const [a, b, w] of [[[4, 6], [26, 14], 15], [[12, 30], [30, 40], 14], [[14, 52], [27, 50], 10]]) lockS(H, -1, [a, b, [32, 49]], w, 8, { fade: .1, p: 1.4 });
    whorl(H, 6, 10);
    braid(H, [[X(H, -1, 31), 48], [X(H, -1, 33), 64], [X(H, -1, 31), 78]], 16);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- OJOU DRILLS ----
// a ringlet drill: stacked coils, each a diagonal clump wrapping round, narrowing down
function drill(H, x, y0, len, w, s, o = {}) {
  const n = Math.round(len / 9), seg = len / n;
  for (let k = 0; k < n; k++) {
    const y = y0 + k * seg, ww = w * (1 - k / n * .55), f = k / n;
    lockP(H, [[x - s * ww * .5, y], [x + s * ww * .05, y + seg * .35], [x + s * ww * .5, y + seg * 1.05]], seg * 1.45 * (1 - f * .3), seg * .9 * (1 - f * .4),
      { fade: 0, p: 1, free: true, tipDark: .7, strands: 0, cast: 1, cdx: -s, cdy: 1, body: o.body, bias: o.bias || 0 });
  }
  lockP(H, [[x, y0 + len - 2], [x + s * 2, y0 + len + 5], [x - s * 1, y0 + len + 10]], 6, 0, { fade: 0, p: 1, free: true, body: o.body, bias: o.bias || 0 });
}
hair('drills', 'Ojou Drills', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') { frontCurtain(H, 84, { flare: 2, n: 3 }); return; }
    frontCap(H, { side: 50 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [44, 18], [38, 34]], 16, 6, { fade: .4, p: 2 });
      lockS(H, s, [[26, 12], [34, 36], [28, 54]], 9, 0, { fade: .35, p: 1.8, face: true });
    }
    fringe(H, [[-27, 36, 15, -4], [-16, 33, 17, -4], [-5, 36, 16, -3], [7, 31, 16, -3], [18, 34, 14, -2], [27, 37, 12, -1]], { part: 10 });
    for (const s of [-1, 1]) drill(H, X(H, s, 40), 32, 62, 18, s, { body: true });
    H.band = domeBand(H, 11, 60);
  } else if (view === 'side') {
    if (ph === 'back') { sideCurtain(H, 84, { n: 4 }); return; }
    sideCap(H);
    nape(H, [[72, 56], [68, 64], [60, 68], [52, 68], [45, 66, 13]]);
    sideFringe(H, [[24, -2, 3, 36, 15, -2], [30, -3, 10, 34, 14], [34, -2, 17, 33, 13, 1], [38, 0, 23, 29, 12, 2]]);
    drill(H, 52, 32, 64, 20, 1, { body: true });
    H.band = ringBand(40, 34, 30, 2, 30);
  } else {
    backCap(H, 52);
    backFall(H, { len: 84, n: 8, w: 19, jit: 4, drop: 4, half: 30 });
    whorl(H, 3, 10);
    for (const s of [-1, 1]) drill(H, X(H, s, 36), 30, 64, 20, -s);
    H.band = domeBand(H, 12, 60);
  }
});

// ---- SLICKED-BACK UNDERCUT ----
// shaved sides: a short buzz, so the scalp tints it toward the skin; smoothly shaded with a
// darker clipper-fade line just under the long top hair
function buzz(H, m) {
  const { R } = H, skin = hexRgb((SKIN_TONES[R.state.skin] || SKIN_TONES[0]).hex);
  const br = ramp(mix(mix(H.r.base, H.r.sh, .35), skin, .28));
  mass(H, m, { round: 6, k: .6, ramp: br, bias: .05 });
  const f = R.M(); m.each((x, y) => { if (!m.has(x, y - 2) && m.has(x, y + 1)) f.set(x, y).set(x, y + 1); });
  f.and(m); R.fill(f, br.sh);
}
hair('slick', 'Slicked Undercut', (H, view, ph) => {
  const { R, cx } = H;
  if (ph === 'back') return;
  H.cast = 1;
  if (view === 'front') {
    const hl = d => 12 + d * d / 60; // the front hairline
    const D = dome(H, 3, -6);
    H.clip = D.clone().keep((x, y) => y < hl(x - cx) + 1 || (Math.abs(x - cx) > 26 && y < 30));
    buzz(H, headMask(R, 1).keep((x, y) => Math.abs(x - cx) >= 26 && y > 8 && y < 46 - Math.max(0, Math.abs(x - cx) - 33) * 3));
    mass(H, D.clone().keep((x, y) => y < hl(x - cx) && Math.abs(x - cx) < 35));
    // combed up from the hairline and back over the crown, sweeping a little to the right
    for (const d of [-30, 30, -21, 21, -12, 12, -3, 6]) {
      const y0 = hl(d) + 1;
      lockP(H, [[cx + d, y0], [cx + d * 1.08 + 3, y0 - 10], [cx + d * .9 + 6, -10]], 14, 10, { fade: 0, p: 1.4, tipDark: -1.1, k: .7, strands: 1, st0: .1, st1: .7 });
    }
    // the hairline: the roots tuck under (dark), the roll just above catches the light
    const under = [], roll = [];
    for (let x = cx - 33; x <= cx + 33; x++) { const y = Math.round(hl(x - cx)); under.push([x, y - 1], [x, y - 2]); roll.push([x, y - 5]); if ((x & 3) !== 0) roll.push([x, y - 6]); }
    toneAt(H, under, 1); toneAt(H, roll, -1);
    H.band = domeBand(H, 0, 70, 1.5);
  } else if (view === 'side') {
    const D = dome(H, 3, -6);
    H.clip = D.clone().keep((x, y) => y < 24 - Math.max(0, x - 30) * .05 || x > 64);
    const ear = R.M().ellipse(46, 53, 8, 11);
    buzz(H, headMask(R, 1).keep((x, y) => y > 14 && y < 62 && x > 30 + Math.max(0, y - 24) * .3 && !(x < 40 && y > 50)).sub(ear));
    mass(H, D.clone().keep((x, y) => y < 24 - Math.max(0, x - 30) * .05 && x > 10));
    // swept from the forehead back over the crown; front clumps last so they sit on top
    for (const [y0, w] of [[22, 12], [16, 14], [10, 15], [3, 15], [-4, 13]])
      lockP(H, [[12 - y0 * .15, y0], [36, y0 - 10], [74, y0 + 6]], w, 9, { fade: 0, p: 1.3, tipDark: .5, k: .7, strands: 1, st0: .1, cdx: 0, cdy: 2 });
    // the front roll
    lockP(H, [[8, 12], [14, -6], [44, -10]], 13, 9, { fade: 0, p: 1.3, tipDark: .4, k: .8 });
    H.band = ringBand(44, 34, 36, 1.5, 14);
  } else {
    const D = dome(H, 3, -6);
    H.clip = D.clone().keep((x, y) => y < 42);
    buzz(H, headMask(R, 1).keep((x, y) => y > 30 && y < 60 && Math.abs(x - cx) < 35 - Math.max(0, y - 40) * .25));
    mass(H, D.clone().keep((x, y) => y < 36 - Math.abs(x - cx) * .1));
    // everything flows back over the crown and ends in a combed edge over the buzz
    for (const t of [-1, 1, -.6, .6, -.2, .2]) lockP(H, [[cx + t * 24, -6], [cx + t * 36, 14], [cx + t * 30, 39 - Math.abs(t) * 4]], 18, 10, { fade: .2, p: 2.5, tipDark: .6, strands: 1 });
    H.band = domeBand(H, 6, 60);
  }
});

// ---- HALF-UP BUN ----
hair('halfup', 'Half-Up Bun', (H, view, ph) => {
  const { R, cx } = H;
  if (view === 'front') {
    if (ph === 'back') { frontCurtain(H, 106, { flare: 4 }); bun(H, cx + 3, -8, 10); return; }
    frontCap(H, { side: 60 });
    for (const s of [-1, 1]) {
      lockS(H, s, [[16, -2], [45, 24], [40, 64]], 17, 3, { fade: .4, p: 2 });
      lockS(H, s, [[24, 6], [44, 44], [38, 96]], 13, 0, { fade: .3, p: 1.5, tz: 12, body: true });
      lockS(H, s, [[27, 12], [35, 40], [30, 60]], 9, 0, { fade: .3, p: 1.8, face: true });
    }
    fringe(H, [[-27, 37, 15, -5], [-16, 35, 17, -4], [-5, 37, 16, -4], [7, 33, 16, -3], [18, 30, 15, -2], [27, 34, 12, -1]], { part: 12 });
    H.band = domeBand(H, 11, 60);
  } else if (view === 'side') {
    if (ph === 'back') { sideCurtain(H, 106); return; }
    sideCap(H);
    nape(H, [[72, 60], [68, 66], [60, 70], [52, 70], [45, 68, 13]]);
    // the top layer gathered back into the bun
    [[30, 4, 15], [26, 16, 13], [36, -2, 14]].forEach(([x, y, w]) => lock(H, [x, y], [x + 16, y - 8], [60, 8], w, 7, { fade: .1, p: 1.4 }));
    lock(H, [30, 4], [44, 36], [36, 92], 13, 0, { fade: .35, p: 1.5, tz: 12, face: true, body: true });
    sideFringe(H, [[24, -2, 3, 37, 15, -2], [30, -3, 10, 35, 14], [34, -2, 17, 34, 13, 1], [38, 0, 23, 30, 12, 2]]);
    const b = bun(H, 62, 4, 10, { rot: .6 });
    H.band = ringBand(40, 34, 30, 2, 26);
    return () => bow(H, 66, 15, 4, TIE_RED);
  } else {
    backCap(H, 52);
    backFall(H, { len: 106, n: 9, w: 20, jit: 5, drop: 4, flare: 4, wy: 26 });
    for (const t of [-1, 1, -.5, .5]) lock(H, [cx + t * 36, 34], [cx + t * 34, 14], [cx + t * 4, 15], 15, 7, { fade: .05, p: 1.4, tipDark: -.5 });
    bun(H, cx, 13, 10, { rot: .3 });
    H.band = domeBand(H, 30, 60);
    return () => bow(H, cx, 25, 5, TIE_RED);
  }
});

const ORDER = ['bob', 'long', 'twintail', 'pony', 'buns', 'spiky', 'messy', 'curtain', 'curls', 'pixie', 'sidetail', 'puff', 'hime', 'wolf',
  'braid', 'drills', 'slick', 'wavy', 'halfup'];
for (const id of ORDER) register(id);
for (const id of Object.keys(STYLES)) if (!ORDER.includes(id)) register(id);
})();
