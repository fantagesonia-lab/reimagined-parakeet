// Pixie Closet wardrobe: hand. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
//
// Held items are drawn in an axis frame: u runs along the handle from the grip (the fist
// centre) toward the tip, v runs across it. Each view has its own grip point and tilt; the
// back view mirrors the front. Items are drawn once per renderer into an offscreen buffer,
// then composited: pixels in the item's "near" region go in front of the body (front phase),
// the rest behind it (back phase), so long shafts can pass behind the head. In the back view
// everything is behind the body unless the item returns a nearBack region.
(() => {
// ---------------- materials ----------------
function mk(hs, kind = 'metal') {
  const t = hs.map(h => typeof h === 'string' ? hexRgb(h) : h);
  return Object.assign([t[1], t[3], t[4], t[5]], { t, spec: t[0], hi: t[1], lt: t[2], base: t[3], sh: t[4], dp: t[5], line: t[6], kind, hex: rgbHex(t[3]) });
}
const AU = mk(['#fffbe9', '#fff1a8', '#fbd560', '#eeaf38', '#c87726', '#8a4520', '#4a2014']);
const STEEL = mk(['#ffffff', '#eef2f8', '#cfd5e2', '#aab2c6', '#7f87a6', '#575d7e', '#2c2c48']);
const IRON = mk(['#e9e6f2', '#aeaac2', '#807b98', '#5e5976', '#45405a', '#2f2b40', '#18151f']);
const LEATH = mk(['#f6dcc0', '#cf9466', '#ad6c43', '#8a4c2e', '#683621', '#4a2416', '#26100a'], 'leather');
const WOODR = mk(['#ffeacb', '#e6b984', '#c99460', '#a87143', '#83532f', '#5e3720', '#331c12'], 'cloth');
const NAVY = mk(['#c9d4f2', '#7d8fc8', '#4f5f9c', '#36437a', '#262f5c', '#1a2042', '#0d1024'], 'cloth');
const CREAM = mk(['#ffffff', '#fffdf5', '#fdf5e2', '#f4e6c8', '#dcc19c', '#b48f72', '#6e4d3e'], 'cloth');
const RUBY = mk(['#ffffff', '#ffb3b8', '#ff6474', '#e8304c', '#b0153e', '#6e0a2e', '#3a0418'], 'gem');
const SAPH = mk(['#ffffff', '#b8e4ff', '#5cb2ff', '#2f78e6', '#1f48b0', '#162a72', '#0b1238'], 'gem');
const AQUA = mk(['#ffffff', '#d4fbff', '#8ff0ff', '#45cdf0', '#1c8fd0', '#145a9c', '#0a2a52'], 'gem');
const AMETH = mk(['#ffffff', '#f0c8ff', '#c98af5', '#9a52e0', '#6b2fb5', '#43207a', '#1f0d3e'], 'gem');
const LEAFG = mk(['#f4ffd8', '#b9ec8a', '#83d064', '#55ac4c', '#3a8540', '#245c34', '#10301c'], 'cloth');
const WHITE_ = [255, 255, 255];

// ---------------- frame ----------------
const GRIP = { front: [64, 96], side: [43, 98], back: [18, 96] };
const LX = -0.5, LY = -0.68;
function frame(R, o = {}) {
  const view = R.view;
  const g = (o.g && o.g[view]) || GRIP[view];
  const gx = g[0], gy = g[1];
  let d = view === 'side' ? (o.side || o.front || [1, -2]) : (o.front || [1, -2]);
  const L = Math.hypot(d[0], d[1]); d = [d[0] / L, d[1] / L];
  let n = [-d[1], d[0]];
  if (view === 'back') { d = [-d[0], d[1]]; n = [-n[0], n[1]]; }
  const ls = (-n[0] * LX - n[1] * LY) > 0 ? 1 : -1; // +1: the -v side faces the light
  const F = {
    R, view, gx, gy, d, n, ls,
    P: (u, v = 0) => [gx + u * d[0] + v * n[0], gy + u * d[1] + v * n[1]],
    uv: (x, y) => { const X = x - gx, Y = y - gy; return [X * d[0] + Y * d[1], X * n[0] + Y * n[1]]; },
    // polygon in (u,v); +.5 so pixel (x,y) is tested at its own position (like Mask.ellipse/set)
    poly: pts => R.M().poly(pts.map(([u, v]) => { const p = F.P(u, v); return [p[0] + .5, p[1] + .5]; })),
    disc: (u, v, rx, ry = rx) => { const p = F.P(u, v); return R.M().ellipse(p[0], p[1], rx, ry); },
    line: (u0, v0, u1, v1, w = 1) => { const a = F.P(u0, v0), b = F.P(u1, v1); return R.M().line(a[0], a[1], b[0], b[1], w); },
    curve: (a, b, c) => R.curve(F.P(a[0], a[1]), F.P(b[0], b[1]), F.P(c[0], c[1])).map(([x, y]) => [Math.round(x), Math.round(y)]),
    // tapered bar along the axis from u0 to u1, half widths w0 -> w1, centred on v = c
    seg: (u0, u1, w0, w1 = w0, c = 0) => F.poly([[u0, c - w0], [u1, c - w1], [u1, c + w1], [u0, c + w0]]),
    // band across the axis (a ring/collar) at u, thickness h, half width w
    ring: (u, h, w, c = 0) => F.poly([[u - h / 2, c - w], [u + h / 2, c - w], [u + h / 2, c + w], [u - h / 2, c + w]]),
  };
  return F;
}
const grip = (R, m) => m.sub(R.body((x, y, p) => p === 'hand'));

// per-pixel painter: fn(x,y) -> rgb for the interior; edge pixels get the outline
// (lighter on the lit top-left side, like the engine's sel-out)
function shade(R, m, r, fn, o = {}) {
  const lit = mix(r.line, r.dp, .45);
  m.each((x, y, i) => {
    const l = !m.has(x - 1, y), rt = !m.has(x + 1, y), t = !m.has(x, y - 1), b = !m.has(x, y + 1);
    let c;
    if ((l || rt || t || b) && !o.noOutline) {
      c = (o.edge && o.edge(x, y)) || ((l || t) && !(rt || b) ? lit : r.line);
    } else c = fn(x, y);
    if (c) R.put(i, c, o.alpha);
  });
}
const tone = (r, k) => r.t[Math.max(0, Math.min(6, k))];

// A blade: centre line c(u), half widths wl(u) (toward -v) and wr(u) (toward +v).
// Shaded as two bevelled planes meeting at a ridge, lit from the top-left, with a bright
// cutting-edge line, an optional fuller, a diagonal glint band and a brighter tip.
function blade(F, r, o) {
  const R = F.R, { u0, u1 } = o, c = o.c || (() => 0), wl = o.wl, wr = o.wr || o.wl;
  const left = [], right = [];
  for (let u = u0; u <= u1 + .001; u += 1) { left.push([u, c(u) - wl(u)]); right.push([u, c(u) + wr(u)]); }
  const m = F.poly(left.concat(right.reverse()));
  const mid = mix(r.base, r.sh, .5), lt2 = mix(r.lt, r.base, .5);
  shade(R, m, r, (x, y) => {
    const [u, v] = F.uv(x, y), vv = v - c(u), w = vv < 0 ? wl(u) : wr(u);
    const q = vv * F.ls, de = w - Math.abs(vv); // q < 0: lit plane; de: px from the edge
    const k = (u - u0) / (u1 - u0);
    const g = o.glint != null && Math.abs(u - o.glint - vv * .55 * F.ls) < 1.3;
    if (o.edgeLine !== false && de < 1.9) return q < 0 ? (g || k > .75 ? r.spec : r.hi) : (o.darkEdge ? r.sh : g ? r.hi : r.lt);
    if (q < 0) {
      if (g) return r.spec;
      if (o.ridge !== false && -q < .9) return k > .55 ? r.hi : r.lt;
      return k < .12 ? r.base : k > .7 ? lt2 : r.lt;
    }
    if (g) return r.hi;
    if (de < 2.9 && o.darkBevel !== false) return r.sh;
    return k < .12 ? r.sh : k > .7 ? r.base : mid;
  });
  if (o.fuller) {
    const [f0, f1] = o.fuller;
    R.crease(F.P(f0, c(f0)), F.P((f0 + f1) / 2, c((f0 + f1) / 2)), F.P(f1, c(f1)), r, m, { tone: 5, lipTone: 1 });
  }
  return m;
}

// wrapped grip: diagonal cord bands
function wrapGrip(F, r, u0, u1, w, o = {}) {
  const R = F.R, m = grip(R, F.seg(u0, u1, w));
  shade(R, m, r, (x, y) => {
    const [u, v] = F.uv(x, y), s = v * F.ls;
    const ph = ((u * 1.0 + s * .9) % 3 + 3) % 3;
    if (ph < .9) return s < 0 ? r.lt : r.base;
    if (ph < 2.1) return s < -w * .3 ? r.hi : s < w * .4 ? r.lt : r.base;
    return r.dp;
  });
  return m;
}

// ---------------- registration / compositing ----------------
const ALL = () => true;
function held(id, name, dye, draw, extra = {}) {
  return item('hand', id, name, dye, (R, ph, r) => {
    const key = id + '|' + r.hex;
    let fx = R._handFx;
    if (!fx || fx.key !== key) {
      const real = R.buf, off = new Uint8ClampedArray(real.length);
      R.buf = off;
      let res;
      try { res = draw(R, r, R.view) || {}; } finally { R.buf = real; }
      fx = R._handFx = { key, buf: off, res };
    }
    const front = ph === 'front', near = R.view === 'back' ? (fx.res.nearBack || null) : (fx.res.near || ALL);
    if (front && !near) return;
    const { ox, oy } = R.V, b = fx.buf, nm = front ? R.M() : null;
    const pix = [];
    for (let i = 0, N = CW * CH; i < N; i++) {
      const a = b[i * 4 + 3]; if (!a) continue;
      const x = i % CW - ox, y = (i / CW | 0) - oy;
      const isNear = !!near && near(x, y);
      if (isNear !== front) continue;
      pix.push(i);
      if (nm && a > 200) nm.a[i] = 1;
    }
    if (front && fx.res.cast !== false) R.shadow(nm, { dx: 1, dy: 1, tint: [.8, .7, .84], strength: .55 });
    for (const i of pix) R.put(i, [b[i * 4], b[i * 4 + 1], b[i * 4 + 2]], b[i * 4 + 3]);
    if (fx.res.post) fx.res.post(R, ph);
  }, extra);
}

// ---------------- SWORDS ----------------
// gold piece: shader paint plus a bright rim stroke along its lit edge
function gold(R, m, o = {}) {
  R.paint(m, o.r || AU, { flat: true, round: o.round ?? 2.5, shiny: true, bias: o.bias ?? .12 });
  return m;
}
const rp = p => [Math.round(p[0]), Math.round(p[1])];
function symPoly(F, half) { // mirror a list of (u,v>=0) points across the axis into one closed polygon
  return F.poly(half.concat(half.slice().reverse().map(([u, v]) => [u, -v])));
}

held('sword', 'Hero Sword', '#c9cfdc', (R, r) => {
  const F = frame(R, { front: [1, -2], side: [2, -3] });
  const bm = blade(F, r, {
    u0: 14, u1: 78, glint: 50, fuller: [22, 58],
    wl: u => u < 63 ? 5.4 - (u - 14) * .01 : 4.9 * Math.pow((78 - u) / 15, .78),
  });
  // second fuller line gives the groove some width
  R.crease(F.P(23, 1), F.P(40, 1), F.P(57, 1), r, bm, { tone: 4, noLip: true });
  R.sparkle(...rp(F.P(70, -1)), WHITE_, 2);
  // langet: gold V clasping the blade root, with a small sapphire
  const lg = F.poly([[12, -6.3], [17, -6.3], [24, 0], [17, 6.3], [12, 6.3]]);
  gold(R, lg, { round: 2 });
  R.gem(...rp(F.P(16.5, 0)), 1.5, SAPH);
  // crossguard: swept wings with curled tips, central rondel with a ruby
  const arm = [[9.5, 3.5], [8.8, 8], [9.2, 12.5], [10.6, 16.5], [14.5, 19.5], [18.2, 18.6], [15.6, 16.4], [14, 13.5], [13.6, 9], [14, 3.5]];
  const gd = symPoly(F, arm);
  gold(R, gd);
  for (const sg of [1, -1]) {
    R.stroke(F.curve([10.5, 6 * sg], [10.5, 11 * sg], [12.5, 15.5 * sg]), AU.hi, gd);
    R.stroke(F.curve([12.6, 6 * sg], [12.4, 10 * sg], [13.4, 13.5 * sg]), AU.sh, gd);
  }
  const ron = F.disc(11.5, 0, 4.6);
  gold(R, ron, { round: 3 });
  R.gem(...rp(F.P(11.5, 0)), 2.6, RUBY);
  // grip, ferrule ring, pommel
  wrapGrip(F, LEATH, -9.5, 8.6, 2.8);
  gold(R, F.ring(-9.8, 2.2, 3.5), { round: 1.5 });
  gold(R, F.poly([[-19.5, 0], [-16.5, -2], [-16.5, 2]]), { round: 1 });
  gold(R, F.disc(-13.6, 0, 3.7), { round: 3 });
  R.gem(...rp(F.P(-13.6, 0)), 1.6, SAPH);
}, { kind: 'metal' });

held('katana', 'Moon Katana', '#d6dbe6', (R, r) => {
  const F = frame(R, { front: [1, -2], side: [2, -3] });
  const sori = u => -Math.pow(Math.max(0, u - 12) / 68, 2) * 6.5; // curves toward -v (spine)
  const wl = u => u < 70 ? 3.3 - (u - 13) * .008 : 2.85 * Math.pow((81 - u) / 11, .55);
  const wr = u => u < 70 ? 4.3 - (u - 13) * .014 : 3.5 * Math.pow((81 - u) / 11, 1.25);
  const left = [], right = [];
  for (let u = 13; u <= 81; u++) { left.push([u, sori(u) - wl(u)]); right.push([u, sori(u) + wr(u)]); }
  const m = F.poly(left.concat(right.reverse()));
  // spine bevel | ridge (shinogi) | darker flat (ji) | misty temper line (hamon) | bright edge
  const ji = mix(r.base, r.sh, .78), jiD = mix(r.sh, r.dp, .25), ham = mix(r.hi, WHITE_, .55), hamE = mix(r.lt, r.hi, .5);
  shade(R, m, r, (x, y) => {
    const [u, v] = F.uv(x, y), vv = v - sori(u), w = vv < 0 ? wl(u) : wr(u), de = w - Math.abs(vv);
    const k = (u - 13) / 68, g = Math.abs(u - 55 - vv * .5 * F.ls) < 1.4;
    const wave = 1.5 + Math.sin(u * .75) * .6 + Math.sin(u * 1.9) * .25;
    if (u > 69.5 && u < 70.6) return r.dp; // yokote
    if (vv < -2.1) return g || k > .8 ? r.spec : F.ls > 0 ? r.lt : r.base; // mune-side bevel
    if (vv < -1.2) return F.ls > 0 ? r.hi : r.lt; // shinogi ridge
    if (de < 1.3) return g ? r.spec : hamE; // cutting edge
    if (vv > wave) return g ? r.spec : ham;
    if (vv > wave - .9) return mix(ji, ham, .5);
    return g ? r.hi : k < .1 ? jiD : ji;
  });
  // habaki and tsuba
  gold(R, F.seg(11.5, 16, 4.4, 4), { round: 1.8 });
  R.stroke([rp(F.P(13.7, -3)), rp(F.P(13.7, 3))], AU.sh);
  const ts = symPoly(F, [[7.5, 0], [7, 5], [8, 8], [10, 9], [12, 8], [12.6, 5], [12.6, 0]]);
  R.paint(ts, IRON, { flat: true, round: 2.5, shiny: true });
  R.stroke(F.curve([12, -7.5], [13.4, 0], [12, 7.5]), AU.lt, ts);
  R.stroke(F.curve([8, -7.5], [6.8, 0], [8, 7.5]), AU.sh, ts);
  for (const sg of [1, -1]) R.stroke([rp(F.P(10, 5.5 * sg))], AU.hi, ts);
  // tsuka: white ray-skin diamonds under a dark crossed cord
  const tk = grip(R, F.seg(-15, 7.5, 3.2));
  shade(R, tk, NAVY, (x, y) => {
    const [u, v] = F.uv(x, y), a = ((u + v * 1.3) % 4.6 + 4.6) % 4.6, b = ((u - v * 1.3) % 4.6 + 4.6) % 4.6, s = v * F.ls;
    if (a < 1.5 || b < 1.5) return s < -1 ? NAVY.hi : s < .8 ? NAVY.lt : NAVY.base;
    return s < 0 ? CREAM.hi : CREAM.base;
  });
  R.paint(F.seg(-18, -14.6, 3.4, 3.2), IRON, { flat: true, round: 1.5, shiny: true });
  R.stroke([rp(F.P(-16.4, -1))], AU.hi);
  // short tassel from the kashira, tinted by the dye
  const t0 = F.P(-18, 0), tr = ramp(mix(r.sh, [200, 40, 70], .6));
  const cord = R.M(); R.curve(t0, [t0[0] + 2, t0[1] + 2], [t0[0] + 4, t0[1] + 3]).forEach(([x, y]) => cord.set(x, y));
  R.fill(cord, tr.dp);
  R.paint(R.lock([t0[0] + 4, t0[1] + 3], [t0[0] + 5, t0[1] + 6], [t0[0] + 5, t0[1] + 10], 4.5, 2.5), tr, { flat: true, round: 2 });
  R.fill(R.M().rect(Math.round(t0[0] + 3), Math.round(t0[1] + 4), Math.round(t0[0] + 6), Math.round(t0[1] + 4)), AU.base);
}, { kind: 'metal' });

const shift = (R, m, dx, dy) => { const o = R.M(); m.each((x, y) => o.set(x + dx, y + dy)); return o; };
const cut = y0 => (x, y) => y >= y0;
const inner = (R, m) => m.clone().keep((x, y) => m.has(x - 1, y) && m.has(x + 1, y) && m.has(x, y - 1) && m.has(x, y + 1)); // near (in front of the body) only below y0
const glow = (R, m, c, a) => R.fill(m, c, a);

held('dagger', 'Shadow Dagger', '#8b8fa3', (R, r) => {
  const F = frame(R, { front: [1, -1.25], side: [1, -1.25] });
  const c = u => -Math.pow(Math.max(0, u - 10) / 36, 2) * 6;
  const wl = u => (u < 39 ? 4.2 : 4.2 * Math.pow((47 - u) / 8, .7)) - (u > 15 && u < 33 ? tri(u - 15, 4.5, 1.6) : 0);
  const wr = u => u < 35 ? 4.6 + (u - 10) * .035 : 5.5 * Math.pow((47 - u) / 12, .9);
  // shadow aura behind the blade
  const aura = R.M();
  for (let u = 12; u <= 47; u++) { const p0 = F.P(u, c(u)); aura.ellipse(p0[0], p0[1], (wl(u) + wr(u)) / 2 + 2, (wl(u) + wr(u)) / 2 + 2); }
  R.fill(aura, [140, 60, 230], 80);
  R.fill(aura.clone().keep((x, y) => (x * 3 + y * 5) % 11 === 0), [200, 150, 255], 150);
  // serrated spine (-v), fang-curved blade
  blade(F, r, { u0: 10, u1: 47, c, glint: 33, wl, wr });
  R.crease(F.P(14, c(14) - 1.2), F.P(24, c(24) - 1.2), F.P(34, c(34) - 1), r, null, { tone: 5, lipTone: 1 });
  R.sparkle(...rp(F.P(41, c(41))), WHITE_, 2);
  // iron guard with spikes curling toward the blade, amethyst in a gold diamond setting
  const gd = symPoly(F, [[6.5, 0], [6, 3.5], [7, 7], [10, 11], [14.5, 12.5], [12, 8.5], [11, 5.5], [11.5, 3], [13, 0]]);
  R.paint(gd, IRON, { flat: true, round: 2, shiny: true, bias: .12 });
  for (const sg of [1, -1]) R.stroke(F.curve([7.5, 4 * sg], [8, 7 * sg], [11, 10 * sg]), IRON.hi, gd);
  const st = F.poly([[5.5, 0], [9.5, -3.6], [13.5, 0], [9.5, 3.6]]);
  gold(R, st, { round: 1.8 });
  R.gem(...rp(F.P(9.5, 0)), 2, AMETH);
  // black leather grip with a pale cord wrap, claw pommel
  wrapGrip(F, mk(['#d9d2ea', '#8f86a8', '#5f5878', '#45405a', '#332f45', '#221f31', '#100e18'], 'leather'), -10, 6, 2.6);
  const pm = symPoly(F, [[-9.5, 0], [-10, 3.2], [-12.5, 4.4], [-15, 2.8], [-18.5, 0]]);
  R.paint(pm, IRON, { flat: true, round: 2, shiny: true, bias: .12 });
  R.gem(...rp(F.P(-13, 0)), 1.4, AMETH);
}, { kind: 'metal' });

held('cutlass', 'Cutlass', '#c9cfdc', (R, r) => {
  const F = frame(R, { front: [1, -2], side: [2, -3] });
  const c = u => -Math.pow(Math.max(0, u - 11) / 56, 2) * 7;
  blade(F, r, {
    u0: 11, u1: 68, c, glint: 46,
    wl: u => u < 55 ? 3.3 : 3.3 * Math.pow((68 - u) / 13, 1.25), // clipped back edge
    wr: u => u < 58 ? 3.5 + (u - 11) * .05 : 5.85 * Math.pow((68 - u) / 10, .55), // flared belly
  });
  // false edge bevel line along the clip
  R.stroke(F.curve([55, c(55) - 2.2], [61, c(61) - 1.2], [66, c(66) - .2]), r.hi);
  R.sparkle(...rp(F.P(60, c(60) + 1)), WHITE_, 2);
  // knuckle bow sweeping outside the fist down to the pommel
  const kb = R.M();
  F.curve([9, 6], [1, 13.5], [-9.5, 4]).forEach(([x, y]) => kb.ellipse(x, y, 1.2, 1.2));
  gold(R, kb, { round: 1.5 });
  R.stroke(F.curve([8.5, 6.5], [1.2, 12.6], [-8, 4.5]), AU.hi, kb);
  // scallop shell guard with flutes and a short curled quillon on the spine side
  const sh = F.poly([[6.5, -6], [8.5, -8], [11.5, -6.5], [12.8, -2], [12.5, 3], [11.5, 7], [9, 8.5], [6.5, 7], [5.6, 0]]);
  gold(R, sh, { round: 3 });
  for (const t of [-4.5, -1.5, 1.5, 4.5]) R.stroke(F.curve([6.4, t * .4], [9.5, t * .9], [12, t * 1.1]), AU.sh, sh);
  for (const t of [-3, 0, 3]) R.stroke(F.curve([6.6, t * .4 - .5], [9.5, t * .9 - .7], [11.8, t * 1.1 - .7]), AU.hi, sh);
  const q = R.M(); F.curve([8, -7], [7, -11], [10, -12]).forEach(([x, y]) => q.ellipse(x, y, 1, 1));
  gold(R, q, { round: 1.2 });
  // grip and pommel cap
  wrapGrip(F, LEATH, -9, 6, 2.5);
  gold(R, F.disc(-11, .8, 3.1), { round: 2.5 });
  R.stroke([rp(F.P(-11.6, -.5))], AU.spec);
}, { kind: 'metal' });

// ---------------- POLEARMS / STAFFS ----------------
held('hammer', 'Giant Hammer', '#c3cad8', (R, r, view) => {
  const F = frame(R, { front: [22, -96], side: [31, -96] });
  // shaft: dark wood, gold rings, leather grip
  const sf = grip(R, F.seg(-16, 88, 2.5));
  R.paint(sf, mk(['#f0d2b0', '#b07b50', '#8c5a38', '#6e4128', '#55301e', '#3c2014', '#1f0f0a'], 'cloth'), { flat: true, round: 2 });
  wrapGrip(F, LEATH, -12, 12, 2.9);
  for (const u of [14, 40, 66]) { gold(R, F.ring(u, 2.4, 3.3), { round: 1.3 }); }
  gold(R, F.disc(-17.5, 0, 3.4), { round: 2.5 });
  // head: 22 along the shaft, 30 across; core in the dye, gold bands, capped striking faces
  const u0 = 84, u1 = 110, um = (u0 + u1) / 2;
  const core = F.poly([[u0 + 1.5, -13.5], [u0, -11.5], [u0, 11.5], [u0 + 1.5, 13.5], [u1 - 1.5, 13.5], [u1, 11.5], [u1, -11.5], [u1 - 1.5, -13.5]]);
  shade(R, core, r, (x, y) => {
    const [u, v] = F.uv(x, y), s = v * F.ls, t = (u - u0) / (u1 - u0);
    if (t > .82) return s < 4 ? r.hi : r.lt; // top bevel
    if (t < .16) return s < -4 ? r.base : r.sh; // underside
    if (s < -9) return r.lt;
    if (s < 1 && t > .55) return mix(r.lt, r.base, .5);
    return s > 9 ? r.sh : s > 4 ? mix(r.base, r.sh, .35) : r.base;
  });
  R.crease(F.P(u1 - 4, -13), F.P(u1 - 4, 0), F.P(u1 - 4, 13), r, core, { tone: 4, lipTone: 1 });
  R.crease(F.P(u0 + 4, -13), F.P(u0 + 4, 0), F.P(u0 + 4, 13), r, core, { tone: 4, lipTone: 2 });
  for (const sg of [-1, 1]) {
    const cap = F.poly([[u0 - 1.5, 13 * sg], [u1 + 1.5, 13 * sg], [u1 + .5, 17.5 * sg], [u0 - .5, 17.5 * sg]]);
    R.paint(cap, r, { flat: true, round: 2.5, shiny: true, bias: sg * F.ls < 0 ? .15 : -.1 });
    R.crease(F.P(u0 + 1, 15.3 * sg), F.P(um, 15.3 * sg), F.P(u1 - 1, 15.3 * sg), r, cap, { tone: 4, lipTone: 1 });
    gold(R, F.poly([[u0 - 1, 10.4 * sg], [u1 + 1, 10.4 * sg], [u1 + 1, 13.2 * sg], [u0 - 1, 13.2 * sg]]), { round: 1.2 });
    for (const uu of [u0 + 4, um, u1 - 4]) R.stud(...rp(F.P(uu, 11.8 * sg)), AU, 1);
  }
  // emblem: gold four-point star with a sapphire
  const em = F.poly([[um - 9, 0], [um - 2.2, -2.2], [um, -8], [um + 2.2, -2.2], [um + 9, 0], [um + 2.2, 2.2], [um, 8], [um - 2.2, 2.2]]);
  gold(R, em, { round: 2 });
  R.gem(...rp(F.P(um, 0)), 2.6, SAPH);
  // collar where the shaft meets the head, and a crown spike
  gold(R, F.poly([[u0 - 6, -4], [u0 + .5, -6], [u0 + .5, 6], [u0 - 6, 4]]), { round: 2 });
  gold(R, F.poly([[u1 - .5, -3.5], [u1 + 3, -2.5], [u1 + 8, 0], [u1 + 3, 2.5], [u1 - .5, 3.5]]), { round: 1.5 });
  R.sparkle(...rp(F.P(u1 - 2, -9)), WHITE_, 2);
  return { near: cut(view === 'side' ? 68 : 64) };
}, { kind: 'metal' });

// distance (px) from (x,y) to the nearest point of a point list
const near2 = (pts, x, y) => { let b = 1e9; for (const p of pts) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < b) b = d; } return Math.sqrt(b); };

held('scythe', 'Reaper Scythe', '#a69cc8', (R, r, view) => {
  const F = frame(R, { front: [22, -96], side: [24, -96] });
  // long dark shaft with silver fittings and a wine-red grip
  const shaftR = mk(['#d6d0e8', '#8e86a8', '#635c7e', '#4a4462', '#38324c', '#262236', '#110f1a'], 'cloth');
  R.paint(grip(R, F.seg(-22, 116, 2.3)), shaftR, { flat: true, round: 2 });
  wrapGrip(F, mk(['#ffd6dc', '#e07a8c', '#b8485e', '#8e2c44', '#6c1e34', '#4a1224', '#260812'], 'cloth'), -12, 12, 2.8);
  for (const u of [16, 60, 98]) R.paint(F.ring(u, 2.2, 3.2), STEEL, { flat: true, round: 1.3, shiny: true });
  R.paint(F.poly([[-21, -2.7], [-21, 2.7], [-28, 0]]), STEEL, { flat: true, round: 1.3 });
  // big crescent blade sweeping forward over the head (toward -v)
  const S0 = [[119, 3], [133, -22], [104, -54]], E0 = [[106, -1], [113, -26], [104, -54]];
  const spine = F.curve(...S0), edge = F.curve(...E0);
  const bm = R.M().poly(spine.concat(edge.slice().reverse()).map(([x, y]) => [x + .5, y + .5]));
  const ed = mix(r.hi, WHITE_, .5);
  shade(R, bm, r, (x, y) => {
    const de = near2(edge, x, y), ds = near2(spine, x, y), t = de / (de + ds + .001);
    if (de < 1.6) return ed;
    if (t < .3) return r.lt;
    if (ds < 1.7) return r.lt; // spine bevel catches the light
    if (t < .62) return r.base;
    return r.sh;
  });
  const mid = S0.map((p, k) => [p[0] * .55 + E0[k][0] * .45, p[1] * .55 + E0[k][1] * .45]);
  R.crease(F.P(...mid[0]), F.P(...mid[1]), F.P(mid[2][0] + 4, mid[2][1] + 10), r, bm, { tone: 5, lipTone: 1 });
  // three crescent cut-outs along the spine like bat-wing notches
  for (const k of [.32, .52, .7]) {
    const i = Math.round(k * (spine.length - 1)), [x, y] = spine[i];
    R.paint(R.M().ellipse(x, y, 1.6, 1.6).and(bm), r, { flat: true, round: 1, bias: -.6 });
  }
  const tip = F.P(104, -54);
  R.sparkle(Math.round(tip[0]) + 3, Math.round(tip[1]) - 1, WHITE_, 2);
  R.sparkle(...rp(F.P(111, -14)), WHITE_, 1);
  // socket: steel collar with a ruby eye and a back spike
  R.paint(R.lock(F.P(114, 3), F.P(114, 11), F.P(107, 15), 4, 0), IRON, { flat: true, round: 1.5, shiny: true, bias: .1 });
  const so = F.poly([[101, -3], [106, -4], [116, -6.2], [120.5, -3.5], [121.5, 2], [117.5, 6], [106, 4], [101, 3]]);
  R.paint(so, IRON, { flat: true, round: 2.5, shiny: true, bias: .15 });
  R.stroke(F.curve([107, -3], [113, -4.6], [119, -4]), IRON.hi, so);
  R.paint(F.poly([[120.5, -2], [127, 0], [120.5, 2]]), IRON, { flat: true, round: 1.2, bias: .1 });
  gold(R, F.ring(103.5, 2, 3.8), { round: 1.2 });
  gold(R, F.disc(112.5, 0, 3.2), { round: 2.5 });
  R.gem(...rp(F.P(112.5, 0)), 2.1, RUBY);
  // ribbon bow on the shaft with tails hanging straight down
  const rb = ramp(mix(r.base, [190, 40, 80], .55));
  const [kx, ky] = rp(F.P(100, 0));
  R.paint(R.M().ellipse(kx - 3, ky - 1, 2.6, 1.8).ellipse(kx + 3, ky + 1, 2.6, 1.8), rb, { flat: true, round: 1.6 });
  R.paint(R.lock([kx, ky], [kx - 1, ky + 7], [kx - 3, ky + 13], 3, 2), rb, { flat: true, round: 1.5 });
  R.paint(R.lock([kx, ky], [kx + 2, ky + 6], [kx + 2, ky + 10], 3, 2), rb, { flat: true, round: 1.5, bias: -.15 });
  R.paint(R.M().ellipse(kx, ky, 1.2, 1.2), rb, { flat: true, round: 1, bias: .2 });
  return { near: cut(view === 'side' ? 68 : 64) };
}, { kind: 'metal' });

held('staff', 'Sage Staff', '#9a6a43', (R, r, view) => {
  const F = frame(R, { front: [1, -3.2], side: [1.2, -3] });
  // shaft: carved spiral bands in the dye, gold rings, leather grip, gold ferrule
  const sf = grip(R, F.seg(-31, 92, 2.4));
  shade(R, sf, r, (x, y) => {
    const [u, v] = F.uv(x, y), s = v * F.ls, ph = ((u + s * 1.4) % 7 + 7) % 7;
    if (ph < 1) return r.dp;
    if (ph < 2) return s < 0 ? r.hi : r.lt;
    return s < -1 ? r.lt : s < 1 ? r.base : r.sh;
  });
  wrapGrip(F, LEATH, -10, 10, 2.8);
  for (const u of [12, 58, 84]) gold(R, F.ring(u, 2.4, 3.3), { round: 1.3 });
  gold(R, F.poly([[-34, 0], [-31, -2.8], [-27, -2.8], [-27, 2.8], [-31, 2.8]]), { round: 1.5 });
  // ornament: gold crescent cradle with leaf wings holding a glowing orb
  const oc = F.P(103, 0), [ox, oy] = rp(oc);
  glow(R, R.M().ellipse(ox, oy, 13, 13), [140, 236, 255], 46);
  glow(R, R.M().ellipse(ox, oy, 10, 10), [170, 244, 255], 60);
  for (const sg of [1, -1]) {
    const wing = R.lock(F.P(92, 0), F.P(93, 9 * sg), F.P(99, 12 * sg), 5, 1);
    R.paint(wing, LEAFG, { flat: true, round: 2 });
    R.stroke(F.curve([93, 1.5 * sg], [94, 7 * sg], [98.5, 10.5 * sg]), LEAFG.dp, wing);
  }
  const cr = R.M(); F.curve([92, 2], [98, 11], [108, 6.5]).forEach(([x, y]) => cr.ellipse(x, y, 1.4, 1.4));
  F.curve([92, -2], [98, -11], [108, -6.5]).forEach(([x, y]) => cr.ellipse(x, y, 1.4, 1.4));
  gold(R, F.seg(88, 94, 3.4, 4.4).add(cr), { round: 1.6 });
  R.paint(R.M().ellipse(ox, oy, 7, 7), AQUA, { flat: true, round: 6, shiny: true, bias: .05 });
  R.fill(R.M().ellipse(ox - 1, oy - 1, 3.5, 3.5), AQUA.hi);
  R.fill(R.M().ellipse(ox - 1.5, oy - 1.5, 1.6, 1.6), [255, 255, 255]);
  R.fill(R.M().ellipse(ox, oy, 7, 7).sub(R.M().ellipse(ox - 1, oy - 1, 7, 7)).sub(R.M().ellipse(ox, oy, 7, 7).sub(R.M().ellipse(ox, oy, 6, 6))), AQUA.lt);
  R.fill(R.M().set(ox - 4, oy - 3).set(ox - 3, oy - 4), [255, 255, 255]);
  gold(R, F.disc(96, 0, 2.2), { round: 1.5 });
  R.sparkle(ox + 9, oy - 7, [230, 252, 255], 2);
  R.sparkle(ox - 9, oy + 5, [200, 246, 255], 1);
  R.fill(R.M().set(ox + 7, oy + 8).set(ox - 6, oy - 10), [220, 250, 255]);
  return { near: cut(view === 'side' ? 68 : 64) };
});

held('wand', 'Star Wand', '#f7a8c4', (R, r) => {
  const F = frame(R, { front: [1, -1.1], side: [1, -1.1] });
  // candy-stripe shaft in the dye
  const sf = grip(R, F.seg(-11, 27, 2, 1.7));
  shade(R, sf, r, (x, y) => {
    const [u, v] = F.uv(x, y), s = v * F.ls, ph = ((u - s * 1.2) % 5 + 5) % 5;
    if (ph < 2) return s < 0 ? WHITE.hi : s < 1 ? WHITE.lt : WHITE.sh;
    return s < 0 ? r.lt : s < 1 ? r.base : r.sh;
  });
  gold(R, F.ring(-11, 2.4, 2.6), { round: 1.2 });
  R.paint(F.disc(-14, 0, 2.6), WHITE, { flat: true, round: 2.5 });
  R.fill(R.M().set(...rp(F.P(-14.6, -.8))), [255, 255, 255]);
  gold(R, F.seg(25.5, 29, 2.4, 3.4), { round: 1.3 });
  // ribbon bow under the star: two loops across the shaft, tails hanging down
  const [bx, by] = rp(F.P(26.5, 0));
  for (const sg of [1, -1]) {
    const [lx, ly] = F.P(26.5, 4.2 * sg);
    R.paint(R.M().ellipse(lx, ly, 3.2, 2.4), r, { flat: true, round: 1.8 });
    R.fill(R.M().set(Math.round(lx + (sg > 0 ? -.5 : .5)), Math.round(ly)), r.dp);
  }
  R.paint(R.lock([bx, by], [bx - 2, by + 5], [bx - 1, by + 10], 3, 2), r, { flat: true, round: 1.5 });
  R.paint(R.lock([bx, by], [bx + 2, by + 5], [bx + 4, by + 9], 3, 2), r, { flat: true, round: 1.5, bias: -.12 });
  R.paint(R.M().ellipse(bx, by, 1.5, 1.5), r, { flat: true, round: 1.2, bias: .2 });
  // bevelled five-point star: each arm split into a lit and a shaded facet
  const [sx, sy] = rp(F.P(40, 0)), rot = Math.atan2(F.d[1], F.d[0]);
  const pts = [];
  for (let k = 0; k < 10; k++) { const a = rot + k * Math.PI / 5, rr = k % 2 ? 5.4 : 12.5; pts.push([sx + Math.cos(a) * rr + .5, sy + Math.sin(a) * rr + .5]); }
  const star = R.M().poly(pts);
  glow(R, star.clone().dilate(2), [255, 240, 170], 70);
  shade(R, star, AU, (x, y) => {
    const ang = Math.atan2(y - sy, x - sx) - rot, k = ((ang / (Math.PI / 5)) % 10 + 10) % 10;
    const arm = Math.round(k / 2) % 5, left = (k - Math.round(k / 2) * 2) < 0;
    const lit = Math.cos(rot + arm * 2 * Math.PI / 5 + (left ? -.5 : .5) - Math.atan2(LY, LX));
    const dd = Math.hypot(x - sx, y - sy);
    if (dd < 2.2) return AU.hi;
    return lit > .55 ? AU.hi : lit > 0 ? AU.lt : lit > -.5 ? AU.base : AU.sh;
  });
  R.paint(R.M().ellipse(sx, sy, 3, 3), r, { flat: true, round: 2.5, shiny: true, bias: .1 });
  R.fill(R.M().set(sx - 1, sy - 1), [255, 255, 255]);
  R.sparkle(sx + 12, sy - 6, [255, 250, 220], 2);
  R.sparkle(sx - 8, sy - 11, [255, 240, 250], 1);
  R.fill(R.M().set(sx + 8, sy + 9).set(sx - 12, sy + 2), [255, 246, 200]);
});

// ---------------- BOW ----------------
held('huntbow', 'Hunter Bow', '#8a5a3c', (R, r) => {
  const F = frame(R, { front: [1, -5], side: [1, -4] });
  const LU = 44, LD = 32, NU = 39, ND = 28, B = 15; // upper/lower limb lengths and nock positions
  // limb centre line: grip at v=0, limbs bend toward the string (+v), tips recurve away
  const cv = u => { const a = Math.abs(u), nk = u > 0 ? NU : ND; return a <= nk ? B * Math.pow(a / nk, 1.45) : B - (a - nk) * 1.3; };
  const hw = u => { const a = Math.abs(u), L = u > 0 ? LU : LD; return a < 10 ? 4.4 : a < 14 ? 4.4 - (a - 10) * .2 : 3.6 - (a - 14) / (L - 14) * 1.7; };
  const left = [], right = [];
  for (let u = -LD; u <= LU; u += 1) { left.push([u, cv(u) - hw(u)]); right.push([u, cv(u) + hw(u)]); }
  // string (behind the limbs at the nocks)
  const st = R.M().line(...F.P(NU, B), ...F.P(-ND, B));
  R.fill(st, [248, 244, 232]);
  R.fill(shift(R, st, 1, 0).sub(st), [184, 168, 160]);
  const bm = grip(R, F.poly(left.concat(right.reverse())));
  shade(R, bm, r, (x, y) => {
    const [u, v] = F.uv(x, y), s = (v - cv(u)) * F.ls, w = hw(u);
    const g = ((Math.abs(u) + 1) % 6) < 1.2 && Math.abs(u) > 14; // grain flecks
    if (s < -w + 1.7) return r.hi;
    if (s < -.3) return g ? r.base : r.lt;
    if (s < w - 1.7) return g ? r.sh : r.base;
    return r.sh;
  });
  // ivory inlay along the back of each limb
  const iv = R.M();
  for (const [a, b] of [[16, 37], [-16, -26]]) for (let u = a; Math.abs(u) <= Math.abs(b); u += Math.sign(a) * .5) iv.set(...rp(F.P(u, cv(u) - .6 * F.ls)));
  R.fill(iv.and(inner(R, bm)), CREAM.hi);
  R.fill(shift(R, iv, 1, 1).and(inner(R, bm)).sub(iv), r.dp);
  // riser: gold leaf plates above and below the hand, emerald inlays
  for (const sg of [1, -1]) {
    const pl = F.poly([[8.5 * sg, -2.4], [12.5 * sg, -3], [17 * sg, 0], [12.5 * sg, 3], [8.5 * sg, 2.4]].map(([u, v]) => [u, v + cv(u)]));
    gold(R, pl, { round: 1.8 });
    R.gem(...rp(F.P(12 * sg, cv(12))), 1.3, LEAFG);
    gold(R, F.ring(18.5 * sg, 1.8, 3.2, cv(18.5)), { round: 1 });
  }
  // gold tip caps curling at both ends
  for (const [u0, u1] of [[NU - 1, LU], [-ND + 1, -LD]]) {
    const tm = R.M(); F.curve([u0, cv(u0)], [(u0 + u1) / 2, cv(u0) - .5], [u1 + Math.sign(u1) * 1.5, cv(u1) - 2.5]).forEach(([x, y]) => tm.ellipse(x, y, 1.4, 1.4));
    gold(R, tm, { round: 1.3 });
  }
  wrapGrip(F, LEATH, -8.5, 8.5, 3.9);
  // tassel charm hanging from the lower limb ring
  const [cx, cy] = rp(F.P(-18.5, cv(18.5) + 3.5));
  R.fill(R.M().line(cx, cy, cx + 1, cy + 4), LEATH.dp);
  R.gem(cx + 1, cy + 5, 1.4, LEAFG);
  R.paint(R.lock([cx + 1, cy + 7], [cx + 2, cy + 10], [cx + 2, cy + 13], 3.6, 2.2), RED, { flat: true, round: 1.5 });
  R.fill(R.M().rect(cx, cy + 8, cx + 3, cy + 8), AU.base);
});

// ---------------- TOYS / CUTE ----------------

held('balloon', 'Heart Balloon', '#e0475a', (R, r, view) => {
  const [gx, gy] = GRIP[view], sg = view === 'back' ? -1 : 1;
  const bx = view === 'front' ? 86 : view === 'side' ? 75 : -6, by = 10;
  const knot = [bx, by + 16];
  // string with a little wave, then a curly ribbon at the knot
  const sp = R.curve([gx + 2 * sg, gy - 6], [Math.round((gx + bx) / 2) + 6 * sg, Math.round((gy + by) / 2) + 4], knot);
  const smask = R.M(); sp.forEach(([x, y]) => smask.set(x, y));
  R.fill(smask, [236, 232, 244]);
  R.fill(shift(R, smask, 1, 0).sub(smask), [170, 160, 186]);
  for (const k of [-1, 1]) {
    const c = R.M(); R.curve([bx, by + 16], [bx + 4 * k, by + 18], [bx + 2 * k, by + 21]).forEach(([x, y]) => c.set(x, y));
    R.curve([bx + 2 * k, by + 21], [bx - 1 * k, by + 23], [bx + 3 * k, by + 25]).forEach(([x, y]) => c.set(x, y));
    R.fill(c, k > 0 ? r.sh : r.base);
  }
  // heart: two lobes and a point
  const m = R.M().ellipse(bx - 7, by - 3, 8.2, 8).ellipse(bx + 7, by - 3, 8.2, 8)
    .poly([[bx - 15, by], [bx + 16, by], [bx + .5, by + 15.5]]);
  R.paint(m, r, { flat: true, round: 8, shiny: true });
  // reflected light along the lower-right rim, glossy glints upper-left
  const rim = inner(R, m).sub(shift(R, inner(R, m), -2, -2)).sub(shift(R, inner(R, m), 0, -3));
  R.fill(rim.keep((x, y) => x > bx - 4 && y > by - 4), mix(r.base, r.lt, .55));
  R.fill(R.M().ellipse(bx - 10, by - 6, 1.8, 3), mix(r.hi, WHITE_, .6));
  R.fill(R.M().set(bx - 7, by - 10).set(bx - 6, by - 10).set(bx - 8, by - 10), mix(r.hi, WHITE_, .4));
  R.fill(R.M().ellipse(bx + 4, by - 8, 1.2, 1.2), mix(r.hi, WHITE_, .5));
  // knot
  R.paint(R.M().poly([[bx - 2, by + 17.5], [bx + 3, by + 17.5], [bx + .5, by + 14]]), r, { flat: true, round: 1, bias: -.25 });
  return { near: cut(view === 'side' ? 68 : 64), cast: false };
});

const ROSE_C = [[0, 0]];
function rose(R, x, y, rad, rr) {
  R.paint(R.M().ellipse(x, y, rad, rad * .9), rr, { flat: true, round: rad * .8, bias: .05 });
  // spiral petal edges
  const pts = [];
  for (let t = 0; t < 9.5; t += .35) { const q = .35 + t * (rad - 1.2) / 9.5; pts.push([Math.round(x + Math.cos(t) * q), Math.round(y + Math.sin(t) * q * .9)]); }
  const m = R.M().ellipse(x, y, rad - 1, rad * .9 - 1);
  R.stroke(pts, rr.dp, m);
  R.stroke(pts.map(([a, b]) => [a - 1, b - 1]).filter(([a, b]) => !pts.some(p => p[0] === a && p[1] === b)), rr.hi, m);
}
function daisy(R, x, y) {
  const pm = R.M();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; pm.ellipse(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 1.6, 1.6); }
  R.paint(pm, WHITE, { flat: true, round: 2 });
  R.paint(R.M().ellipse(x, y, 1.8, 1.8), AU, { flat: true, round: 1.5 });
  R.fill(R.M().set(x - 1, y - 1), [255, 250, 220]);
}
function leaf(R, a, b, c, w) {
  const m = R.lock(a, b, c, w, 0);
  R.paint(m, LEAFG, { flat: true, round: 2 });
  R.stroke(R.curve(a, b, c).slice(1, -1), LEAFG.dp, m);
  return m;
}

held('bouquet', 'Bouquet', '#f7a8c4', (R, r, view) => {
  const F = frame(R, { front: [1, -2.2], side: [1, -2] });
  const [hx, hy] = rp(F.P(19, 0)), sg = view === 'back' ? -1 : 1;
  // leaves fanning out behind the flowers
  leaf(R, [hx - 2, hy + 3], [hx - 12 * sg, hy - 2], [hx - 15 * sg, hy - 9], 4.5);
  leaf(R, [hx + 2, hy + 2], [hx + 12 * sg, hy + 1], [hx + 15 * sg, hy - 6], 4.5);
  leaf(R, [hx, hy], [hx + 2 * sg, hy - 12], [hx - 1 * sg, hy - 17], 4);
  // baby's breath sprigs
  const bb = R.M();
  [[-9, -8], [-6, -12], [9, -10], [11, -4], [4, -14], [-11, -2], [12, 2]].forEach(([dx, dy]) => bb.ellipse(hx + dx * sg, hy + dy, .8, .8));
  R.paint(bb, WHITE, { flat: true, round: 1 });
  // flowers: three roses in the dye, two daisies
  daisy(R, hx - 8 * sg, hy - 2);
  daisy(R, hx + 8 * sg, hy - 6);
  rose(R, hx + 4 * sg, hy + 1, 4.6, r);
  rose(R, hx - 3 * sg, hy - 7, 4.6, r);
  rose(R, hx - 4 * sg, hy + 3, 4, ramp(mix(r.base, [255, 255, 255], .35)));
  // wrapping cone with a lace frill at the top
  const cone = F.poly([[-9, -2], [-9, 2.2], [11, 8.5], [14, 0], [11, -8.5]]);
  shade(R, cone, CREAM, (x, y) => {
    const [u, v] = F.uv(x, y), s = v * F.ls;
    const fold = Math.abs(v - u * .25) < .6 || Math.abs(v + u * .35) < .6;
    if (fold) return CREAM.sh;
    return s < -3 ? CREAM.hi : s < 2 ? CREAM.lt : CREAM.base;
  });
  grip(R, cone);
  const fr = R.M();
  F.curve([10, -10], [14, 0], [10, 10]).forEach(([x, y]) => fr.ellipse(x, y, 1.3, 1.3));
  R.paint(fr, WHITE, { flat: true, round: 1.4 });
  R.fill(fr.clone().keep((x, y) => (x + y) % 3 === 0), WHITE.sh);
  // satin bow at the neck in the dye's deep tone
  const br = ramp(r.sh), [kx, ky] = rp(F.P(1, 0));
  R.paint(R.M().ellipse(kx - 3 * sg, ky - 1, 2.8, 2).ellipse(kx + 3 * sg, ky + 1, 2.8, 2), br, { flat: true, round: 1.6 });
  R.paint(R.lock([kx, ky], [kx + 2 * sg, ky + 5], [kx + 1 * sg, ky + 9], 2.6, 1.6), br, { flat: true, round: 1.4 });
  R.paint(R.lock([kx, ky], [kx + 4 * sg, ky + 4], [kx + 6 * sg, ky + 7], 2.6, 1.6), br, { flat: true, round: 1.4, bias: -.1 });
  R.paint(R.M().ellipse(kx, ky, 1.3, 1.3), br, { flat: true, round: 1, bias: .2 });
});

held('icecream', 'Ice Cream', '#f7a8c4', (R, r, view) => {
  const F = frame(R, { front: [1, -2.4], side: [1, -2.4] });
  const WAF = mk(['#fff2d0', '#f6d08a', '#e8b066', '#d18f45', '#ad6c2e', '#80481e', '#4a250e'], 'cloth');
  // waffle cone
  const cone = grip(R, F.poly([[-7, -.8], [-7, .8], [16, 6.6], [16, -6.6]]));
  shade(R, cone, WAF, (x, y) => {
    const [u, v] = F.uv(x, y), s = v * F.ls;
    const a = ((u + v * 1.1) % 4 + 4) % 4, b = ((u - v * 1.1) % 4 + 4) % 4;
    if (a < .9 || b < .9) return s < 0 ? WAF.sh : WAF.dp;
    return s < -2 ? WAF.hi : s < 1.5 ? WAF.lt : WAF.base;
  });
  R.paint(F.seg(14.5, 17.5, 7.2, 7.4), WAF, { flat: true, round: 1.5, bias: .12 });
  R.stroke([rp(F.P(16, -5)), rp(F.P(16, -2)), rp(F.P(16, 1))], WAF.hi);
  // bottom scoop in the dye with two short drips over the rim
  const s1 = F.disc(22, 0, 7.6, 6.8);
  [[-3.5, 3], [3, 4.5]].forEach(([v, len]) => s1.add(F.seg(16, 16 - len, 1.4, 1.2, v)).add(F.disc(16 - len, v, 1.3)));
  R.paint(s1, r, { flat: true, round: 5 });
  R.fill(R.M().set(...rp(F.P(25, -4))).set(...rp(F.P(24, -5))), mix(r.hi, WHITE_, .5));
  // top scoop: vanilla with sprinkles
  const VAN = mk(['#ffffff', '#fffcf2', '#fff6dc', '#fbe7bd', '#e7c793', '#c49a6e', '#7e5a42'], 'cloth');
  const s2 = F.disc(30, -.5, 6.4, 5.8);
  R.paint(s2, VAN, { flat: true, round: 4.5 });
  R.shadow(s2, { dx: 0, dy: 1, tint: [.85, .75, .85], strength: .7 });
  const cols = [[232, 72, 96], [80, 150, 240], [250, 210, 70], [110, 200, 120], [200, 120, 230]];
  [[27, -4, 0], [31, 2, 1], [33, -3, 2], [28, 2.5, 3], [30, -1.5, 4], [26, -1, 1]].forEach(([u, v, k]) => {
    const [x, y] = rp(F.P(u, v)); R.fill(R.M().set(x, y).set(x + (k % 2 ? 1 : 0), y + (k % 2 ? 0 : 1)), cols[k]);
  });
  // wafer stick and cherry
  const wf = F.poly([[31, 3], [39, 7], [40, 5], [32, 1]]);
  shade(R, wf, WAF, (x, y) => { const [u] = F.uv(x, y); return (Math.round(u) % 3 === 0) ? WAF.sh : WAF.lt; });
  const [cx, cy] = rp(F.P(36.5, -1));
  R.fill(R.M().line(cx, cy - 2, cx + 2, cy - 6), LEAFG.dp);
  R.paint(R.M().ellipse(cx, cy, 2.6, 2.4), RUBY, { flat: true, round: 2, shiny: true });
  R.fill(R.M().set(cx - 1, cy - 1), [255, 255, 255]);
});

held('plush', 'Teddy Plush', '#c98d65', (R, r, view) => {
  const back = view === 'back', sg = back ? -1 : 1;
  const [gx, gy] = GRIP[view];
  const X = dx => gx + dx * sg, hx = X(11), hy = gy + 1;
  const muz = ramp(mix(r.base, [255, 240, 220], .55));
  // raised arm into the fist, body, legs, free arm
  const arm = grip(R, R.lock([X(5), gy + 10], [X(3), gy + 4], [X(0), gy - 1], 6, 5));
  const body = R.M().ellipse(X(12), gy + 15, 7.5, 8);
  const legs = R.M().ellipse(X(8), gy + 22, 3.6, 3.2).ellipse(X(16), gy + 22, 3.6, 3.2);
  const arm2 = R.lock([X(18), gy + 10], [X(20), gy + 14], [X(20), gy + 18], 5.5, 4.5);
  R.paint(legs, r, { flat: true, round: 3 });
  R.paint(body, r, { flat: true, round: 5 });
  if (!back) R.paint(R.M().ellipse(X(12), gy + 16, 4.4, 5), muz, { flat: true, round: 3, noOutline: true });
  R.stitch(R.curve([X(12), gy + 9], [X(12), gy + 15], [X(12), gy + 22]), r.dp, body, 1, 1);
  if (!back) { // stitched heart patch on the tummy
    const hp = R.M().ellipse(X(10.5), gy + 14, 1.8, 1.8).ellipse(X(13.5), gy + 14, 1.8, 1.8).poly([[X(8.5) - .5 * sg, gy + 14.5], [X(15.5) + .5 * sg, gy + 14.5], [X(12) + .5, gy + 19]]);
    R.paint(hp, PINK, { flat: true, round: 2 });
    R.fill(hp.clone().keep((x, y) => (x + y) % 2 === 0 && !(hp.has(x - 1, y) && hp.has(x + 1, y) && hp.has(x, y - 1) && hp.has(x, y + 1))), PINK.dp);
  }
  R.paint(arm2, r, { flat: true, round: 2.5 });
  R.paint(arm, r, { flat: true, round: 2.5 });
  if (!back) for (const k of [8, 16]) R.fill(R.M().ellipse(X(k), gy + 23, 1.6, 1.2), muz.base);
  else R.paint(R.M().ellipse(X(12), gy + 21, 2, 1.8), muz, { flat: true, round: 1.5 }); // tail
  // head with ears
  const ears = R.M().ellipse(X(5), hy - 6, 3.4, 3.4).ellipse(X(17), hy - 6, 3.4, 3.4);
  R.paint(ears, r, { flat: true, round: 2.5 });
  R.fill(R.M().ellipse(X(5), hy - 5.5, 1.5, 1.5).ellipse(X(17), hy - 5.5, 1.5, 1.5), back ? r.sh : muz.sh);
  const head = R.M().ellipse(hx, hy, 8, 7);
  R.paint(head, r, { flat: true, round: 6 });
  if (!back) {
    R.paint(R.M().ellipse(hx, hy + 3, 3.6, 2.6), muz, { flat: true, round: 2 });
    R.fill(R.M().rect(hx - 1, hy + 1, hx + 1, hy + 2), [58, 34, 40]);
    R.fill(R.M().set(hx - 1, hy + 1), [150, 120, 130]);
    R.fill(R.M().set(hx, hy + 4).set(hx - 1, hy + 5).set(hx + 1, hy + 5), r.dp);
    for (const k of [-4, 3]) { R.fill(R.M().rect(hx + k, hy - 2, hx + k + 1, hy - 1), [40, 26, 32]); R.fill(R.M().set(hx + k, hy - 2), [255, 255, 255]); }
    R.fill(R.M().ellipse(hx - 6, hy + 2, 1.2, .8).ellipse(hx + 6, hy + 2, 1.2, .8), [240, 140, 150], 140);
  } else R.crease([hx, hy - 6], [hx + 1, hy], [hx, hy + 6], r, head, { tone: 4 });
  // ribbon bow at the neck
  const [kx, ky] = [hx, hy + 7];
  R.paint(R.M().ellipse(kx - 3, ky, 2.6, 2).ellipse(kx + 3, ky, 2.6, 2), RED, { flat: true, round: 1.6 });
  R.paint(R.lock([kx, ky], [kx - 1, ky + 3], [kx - 2, ky + 5], 2.4, 1.4).add(R.lock([kx, ky], [kx + 1, ky + 3], [kx + 2, ky + 5], 2.4, 1.4)), RED, { flat: true, round: 1.2, bias: -.1 });
  R.paint(R.M().ellipse(kx, ky, 1.2, 1.2), RED, { flat: true, round: 1, bias: .2 });
});

// ---------------- SHIELD ----------------
// maple leaf outline in polar form: five lobes with serrated edges, star-convex around the centre
const LEAF_LOBES = [[-90, 1.02, 46], [-18, 1, 44], [-162, 1, 44], [44, .78, 36], [136, .78, 36]];
function leafPts(cx, cy, S, flip) {
  const pts = [];
  for (let k = 0; k < 360; k += 2) {
    const th = k - 180;
    let rr = .3;
    for (const [c, R0, w] of LEAF_LOBES) {
      const d = Math.abs(((th - c + 540) % 360) - 180); if (d >= w) continue;
      const t = 1 - d / w, tooth = .13 * (1 - Math.abs(((d % 12) / 12) * 2 - 1)) * (d > 5 ? 1 : 0) * t;
      rr = Math.max(rr, R0 * (.34 + .66 * Math.pow(t, 1.25)) + tooth);
    }
    const a = th * Math.PI / 180;
    pts.push([cx + Math.cos(a) * rr * S * (flip ? -1 : 1) + .5, cy + Math.sin(a) * rr * S + .5]);
  }
  return pts;
}
const LEAF_VEINS = LEAF_LOBES.map(([c, R0]) => [Math.cos(c * Math.PI / 180) * R0, Math.sin(c * Math.PI / 180) * R0]);
held('leafshield', 'Maple Shield', '#f08a3c', (R, r, view) => {
  const back = view === 'back', [gx, gy] = GRIP[view];
  const cx = gx + (back ? -3 : view === 'side' ? 0 : 4), cy = gy - 3, S = 21;
  const m = R.M().poly(leafPts(cx, cy, S, back));
  m.add(R.M().line(cx, cy + 5, cx + (back ? -1 : 1), cy + S * .78, 3));
  if (back) {
    // inside of the shield: darker leaf, wooden brace and a leather arm strap
    R.paint(m, r, { flat: true, round: 5, bias: -.35 });
    R.paint(R.M().line(cx - 9, cy - 9, cx + 9, cy + 9, 3).and(m), WOODR, { flat: true, round: 1.5 });
    R.paint(R.M().rect(cx - 9, cy - 2, cx + 9, cy + 1).and(m), LEATH, { flat: true, round: 1.5 });
    R.stud(cx - 7, cy - 1, AU, 2); R.stud(cx + 6, cy - 1, AU, 2);
    return {};
  }
  // faceted leaf: each lobe folds along its vein, lit on the side facing the top-left
  const ang = LEAF_VEINS.map(([x, y]) => Math.atan2(y, x));
  shade(R, m, r, (x, y) => {
    const a = Math.atan2(y - cy, x - cx), d = Math.hypot(x - cx, y - cy) / S;
    let best = 0, bd = 9;
    ang.forEach((va, k) => { const dd = Math.abs(((a - va + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (dd < bd) { bd = dd; best = k; } });
    const va = ang[best], side = ((a - va + Math.PI * 3) % (Math.PI * 2)) - Math.PI; // >0: clockwise of the vein
    const nrm = va + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    const lit = Math.cos(nrm) * LX + Math.sin(nrm) * LY;
    const t = lit > .45 ? 2 : lit > 0 ? 3 : lit > -.45 ? 4 : 5;
    return tone(r, d < .22 ? Math.min(5, t + 1) : d > .8 && t < 4 ? t - 1 : t);
  });
  // veins: light ridges with a dark lip, side veinlets
  for (const [vx, vy] of LEAF_VEINS) {
    const tip = [cx + vx * S * .9, cy + vy * S * .9];
    R.crease([cx, cy], [(cx + tip[0]) / 2, (cy + tip[1]) / 2], tip, r, m, { tone: 1, lipTone: 4 });
  }
  R.crease([cx, cy], [cx, cy + 6], [cx + 1, cy + S * .74], r, m, { tone: 4, lipTone: 1 });
  // gold boss with a gem, rivets at the lobe roots
  gold(R, R.M().ellipse(cx, cy - 1, 4.2, 4.2), { round: 3 });
  R.gem(cx, cy - 1, 2.2, LEAFG);
  for (const [vx, vy] of LEAF_VEINS) R.stud(Math.round(cx + vx * S * .5), Math.round(cy + vy * S * .5), AU, 2);
  R.sparkle(Math.round(cx - S * .45), Math.round(cy - S * .45), WHITE_, 1);
});

// ---------------- UMBRELLA ----------------
held('umbrella', 'Frill Umbrella', '#f7a8c4', (R, r, view) => {
  const F = frame(R, { front: [-14, -100], side: [-4, -100] });
  // shaft and crook handle
  R.paint(grip(R, F.seg(-12, 110, 1.4)), IRON, { flat: true, round: 1.5 });
  const hk = R.M(); F.curve([-11, 0], [-21, .5], [-18, 7]).forEach(([x, y]) => hk.ellipse(x, y, 1.6, 1.6));
  R.paint(grip(R, hk), WOODR, { flat: true, round: 1.6 });
  gold(R, F.ring(-10, 2, 2.4), { round: 1 });
  // canopy: dome of 6 visible gores with scalloped hem and lace trim
  const U = 109, H = 21, W = 34, G = 6;
  const lam = (a, b) => Math.atan2(a / W, Math.sqrt(Math.max(0, 1 - (a / W) ** 2 - (b / H) ** 2)));
  const hem = a => { const f = ((lam(a, 0) + Math.PI / 2) / Math.PI * G) % 1; return -4 * Math.sqrt(Math.max(0, 1 - (a / W) ** 2)) + 2.6 * Math.sin(Math.PI * f); };
  const dome = R.M(), lace = R.M(), cs = [F.P(U - 8, -W - 2), F.P(U - 8, W + 2), F.P(U + H + 1, -W - 2), F.P(U + H + 1, W + 2)];
  const bx0 = Math.floor(Math.min(...cs.map(p => p[0]))), bx1 = Math.ceil(Math.max(...cs.map(p => p[0])));
  const by0 = Math.floor(Math.min(...cs.map(p => p[1]))), by1 = Math.ceil(Math.max(...cs.map(p => p[1])));
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const [u, a] = F.uv(x, y), b = u - U, e = (a / W) ** 2 + (b / H) ** 2;
    if (e > 1.12 || b < -8) continue;
    const hm = hem(a);
    if (e <= 1 && b >= hm) dome.set(x, y);
    else if (b >= hm - 2.2 && b < hm) lace.set(x, y);
  }
  R.paint(lace, WHITE, { flat: true, round: 1.2, bias: .2 });
  R.fill(lace.clone().keep((x, y) => (x + y) % 3 === 0 && !lace.has(x, y + 1)), WHITE.lt);
  shade(R, dome, r, (x, y) => {
    const [u, v] = F.uv(x, y), b = u - U, a = v;
    const nx = a / W, ny = Math.max(0, b) / H, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const l = lam(a, Math.max(0, b)), f = ((l + Math.PI / 2) / Math.PI * G) % 1;
    if (f < .07 || f > .93) return r.dp; // ribs
    const bulge = Math.sin(Math.PI * f);
    const lit = (-nx * F.ls * .5 + ny * .68 + nz * .54) + bulge * .35 - .35 + (f < .3 ? -.1 : 0);
    return lit > .78 ? r.hi : lit > .5 ? r.lt : lit > .22 ? r.base : lit > 0 ? r.sh : r.dp;
  });
  // stripes of the lighter tint along every other gore centre
  // rib tips and finial
  for (let k = 0; k <= G; k++) {
    const l = -Math.PI / 2 + k * Math.PI / G, a = Math.sin(l) * W * .99;
    const [x, y] = rp(F.P(U + hem(a) - .5, a)); R.fill(R.M().set(x, y), AU.lt);
  }
  gold(R, F.seg(U + H - 1, U + H + 3, 1.6, 1), { round: 1 });
  gold(R, F.disc(U + H + 4, 0, 1.6), { round: 1.5 });
  // bow at the top in the dye's deep tone
  const br = ramp(r.sh), [kx, ky] = rp(F.P(U + H - 4, 4));
  R.paint(R.M().ellipse(kx - 3, ky, 2.6, 1.8).ellipse(kx + 3, ky, 2.6, 1.8), br, { flat: true, round: 1.5 });
  R.paint(R.M().ellipse(kx, ky, 1.2, 1.2), br, { flat: true, round: 1, bias: .2 });
  // the canopy sits over the head (in front of hats and hair tops); the shaft passes behind the head
  const yc = view === 'side' ? 68 : 64;
  const canopy = (x, y) => F.uv(x, y)[0] >= U - 8;
  return { near: (x, y) => y >= yc || canopy(x, y), nearBack: canopy, cast: false };
});

// ---------------- LANTERN ----------------
held('lantern', 'Glow Lantern', '#c9a04a', (R, r, view) => {
  const [gx, gy] = GRIP[view], x = gx, top = gy + 8;
  const fy = top + 15; // flame centre
  // warm halo
  R.fill(R.M().ellipse(x, fy, 17, 15), [255, 214, 120], 30);
  R.fill(R.M().ellipse(x, fy, 12, 11), [255, 224, 140], 44);
  // bail handle through the fist
  const bail = R.M(); R.curve([x - 7, top + 4], [x, top - 15], [x + 7, top + 4]).forEach(([a, b]) => bail.ellipse(a, b, .7, .7));
  R.paint(grip(R, bail), r, { flat: true, round: 1 });
  // glass cage: amber panes with a flame
  const cage = R.M().rect(x - 7, top + 7, x + 7, top + 22);
  const AMB = mk(['#ffffff', '#fff8d8', '#ffe9a0', '#ffd36a', '#f2a640', '#c8762a', '#7a4418'], 'gem');
  shade(R, cage, AMB, (a, b) => {
    const d = Math.hypot((a - x) / 1.2, b - fy);
    return d < 2.5 ? AMB.spec : d < 4.8 ? AMB.hi : d < 7 ? AMB.lt : AMB.base;
  });
  R.fill(R.M().line(x - 5, top + 9, x - 5, top + 13), [255, 255, 255]);
  const fl = R.lock([x, fy + 3], [x - 1, fy - 1], [x + 1, fy - 6], 5, 0);
  R.fill(fl, [255, 150, 60]);
  R.fill(R.lock([x, fy + 2], [x, fy - 1], [x, fy - 4], 2.4, 0), [255, 255, 235]);
  // frame posts, rails and an ornate base in the dye (metal)
  const posts = R.M().rect(x - 8, top + 7, x - 7, top + 22).rect(x + 7, top + 7, x + 8, top + 22)
    .rect(x - 1, top + 7, x, top + 9).rect(x - 1, top + 20, x, top + 22);
  R.paint(posts, r, { flat: true, round: 1, shiny: true });
  R.paint(R.M().rect(x - 9, top + 22, x + 9, top + 24), r, { flat: true, round: 1.2, shiny: true });
  R.paint(R.M().poly([[x - 7, top + 25], [x + 8, top + 25], [x + 5, top + 27.5], [x - 4, top + 27.5]]), r, { flat: true, round: 1.2, bias: -.1 });
  for (const k of [-6, -2, 2, 6]) R.fill(R.M().set(x + k, top + 23), r.hi);
  // pagoda roof with upturned eaves and a finial
  const roof = R.M().poly([[x - 3.5, top], [x + 4.5, top], [x + 10, top + 4.5], [x + 12.5, top + 3.5], [x + 11, top + 7.5], [x - 10, top + 7.5], [x - 11.5, top + 3.5], [x - 9, top + 4.5]]);
  R.paint(roof, r, { flat: true, round: 2.5, shiny: true });
  R.stroke(R.curve([x - 8, top + 5], [x, top + 3], [x + 8, top + 5]), r.hi, roof);
  R.stroke(R.curve([x - 9, top + 6.5], [x, top + 6], [x + 9, top + 6.5]), r.sh, roof);
  R.paint(R.M().ellipse(x, top - 1, 1.8, 1.8), r, { flat: true, round: 1.5, shiny: true });
  R.stud(x - 8, top + 14, r, 1); R.stud(x + 7, top + 14, r, 1);
  R.gem(x, top + 25, 1.2, RUBY);
  R.sparkle(x + 11, fy - 7, [255, 244, 200], 1);
  R.fill(R.M().set(x - 12, fy + 4), [255, 240, 190]);
  return {
    cast: false,
    post: (R2, ph) => { // warm light spilling on the body
      if (ph !== (view === 'back' ? 'back' : 'front')) return;
      const { ox, oy } = R2.V;
      for (let b = fy - 17; b <= fy + 17; b++) for (let a = x - 17; a <= x + 17; a++) {
        const d = Math.hypot(a - x, b - fy); if (d > 17) continue;
        const i = (b + oy) * CW + a + ox; if (a + ox < 0 || a + ox >= CW || b + oy < 0 || b + oy >= CH || !R2.buf[i * 4 + 3]) continue;
        const k = .17 * (1 - d / 17);
        R2.buf[i * 4] += (255 - R2.buf[i * 4]) * k; R2.buf[i * 4 + 1] += (230 - R2.buf[i * 4 + 1]) * k * .8;
      }
    },
  };
}, { kind: 'metal' });
// ---------------- EXTRA ----------------
held('lollipop', 'Swirl Lollipop', '#e0475a', (R, r) => {
  const F = frame(R, { front: [1, -1.6], side: [1, -1.6] });
  // stick
  R.paint(grip(R, F.seg(-12, 27, 1.6)), WHITE, { flat: true, round: 1.5 });
  // swirl candy disc: spiral bands of the dye and white, domed shading, gloss arc
  const [cx, cy] = rp(F.P(37, 0)), rad = 10.5;
  const m = R.M().ellipse(cx, cy, rad, rad);
  const alt = r.base[0] + r.base[1] + r.base[2] > 640 ? ramp(mix(r.sh, [255, 255, 255], .3)) : WHITE; // keep the swirl on pale dyes
  const swirl = (x, y) => { const a = Math.atan2(y - cy, x - cx) / (Math.PI * 2), d = Math.hypot(x - cx, y - cy); return ((a + d / 5.2) % 1 + 1) % 1 < .5; };
  shade(R, m, r, (x, y) => {
    const dx = (x - cx) / rad, dy = (y - cy) / rad, lit = -(dx * LX + dy * LY) * .9 + .35 - (dx * dx + dy * dy) * .25;
    const t = lit > .75 ? 1 : lit > .45 ? 2 : lit > .1 ? 3 : 4;
    return swirl(x, y) ? tone(r, t) : tone(alt, Math.min(4, t));
  });
  const gl = R.M(); R.curve([cx - 7, cy + 1], [cx - 7, cy - 7], [cx + 1, cy - 7]).forEach(([x, y]) => gl.set(x, y));
  R.fill(gl.and(m), [255, 255, 255]);
  R.fill(R.M().set(cx - 4, cy - 4).set(cx + 6, cy + 5), [255, 255, 255]);
  // ribbon bow tied under the candy
  const [kx, ky] = rp(F.P(25.5, 0)), br = ramp(mix(r.base, [255, 255, 255], .3));
  R.paint(R.M().ellipse(kx - 3, ky - 1, 2.8, 2).ellipse(kx + 3, ky + 1, 2.8, 2), br, { flat: true, round: 1.6 });
  R.paint(R.lock([kx, ky], [kx - 1, ky + 4], [kx - 3, ky + 8], 2.6, 1.6).add(R.lock([kx, ky], [kx + 2, ky + 4], [kx + 2, ky + 8], 2.6, 1.6)), br, { flat: true, round: 1.3, bias: -.1 });
  R.paint(R.M().ellipse(kx, ky, 1.3, 1.3), br, { flat: true, round: 1, bias: .2 });
  R.sparkle(cx + 11, cy - 9, [255, 250, 230], 2);
});

held('tome', 'Arcane Tome', '#7a4bc4', (R, r, view) => {
  const back = view === 'back', [gx, gy] = GRIP[view], sg = back ? -1 : 1;
  const x0 = gx - 4 * sg, y0 = gy - 2, w = 19, h = 25; // hangs from the fist, spine toward the body
  const X = dx => x0 + dx * sg;
  const xa = Math.min(X(0), X(w)), xb = Math.max(X(0), X(w));
  // page block peeking out on the open side and bottom
  const pages = grip(R, R.M().rect(Math.min(X(3), X(w + 1)), y0 + 2, Math.max(X(3), X(w + 1)), y0 + h + 1));
  shade(R, pages, CREAM, (x, y) => (y % 2 === 0 ? CREAM.lt : CREAM.base));
  // cover: leather in the dye with a rounded spine
  const cov = grip(R, R.M().rect(xa, y0, xb - 2, y0 + h - 1).add(R.M().rect(Math.min(X(-1), X(3)), y0 + 1, Math.max(X(-1), X(3)), y0 + h - 2)));
  R.paint(cov, r, { flat: true, round: 4, kind: 'leather' });
  R.stroke([[X(3), y0 + 1], [X(3), y0 + h - 2]].map(p => p.map(Math.round)), r.dp, cov);
  R.stroke([[X(4), y0 + 1], [X(4), y0 + h - 2]].map(p => p.map(Math.round)), r.lt, cov);
  for (const yy of [y0 + 4, y0 + h - 6]) R.paint(R.M().rect(Math.min(X(-1), X(3)), yy, Math.max(X(-1), X(3)), yy + 1).and(cov), AU, { flat: true, round: 1, noOutline: true, bias: .2 });
  // gold corner guards
  for (const [cxx, cyy, dx, dy] of [[w - 2, 0, -1, 1], [w - 2, h - 1, -1, -1]]) {
    const cm = R.M().poly([[X(cxx) + .5, cyy + y0 + .5], [X(cxx + dx * 5) + .5, cyy + y0 + .5], [X(cxx) + .5, cyy + y0 + dy * 5 + .5]]);
    gold(R, cm.and(cov), { round: 1.2 });
  }
  // emblem: gold ring with a glowing gem eye, rune ticks around it
  const ex = Math.round(X(w / 2 + 1)), ey = y0 + Math.round(h / 2) - 1;
  const ring = R.M().ellipse(ex, ey, 5, 5).sub(R.M().ellipse(ex, ey, 3, 3));
  gold(R, ring, { round: 1.2 });
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; R.fill(R.M().set(Math.round(ex + Math.cos(a) * 6.6), Math.round(ey + Math.sin(a) * 6.6)), AU.lt); }
  R.fill(R.M().ellipse(ex, ey, 4, 4), [190, 240, 255], 90);
  R.gem(ex, ey, 2.2, AQUA);
  // clasp strap across the open edge
  const cl = R.M().rect(Math.min(X(w - 4), X(w + 2)), ey - 1, Math.max(X(w - 4), X(w + 2)), ey + 2);
  R.paint(cl, LEATH, { flat: true, round: 1.2 });
  R.stud(Math.round(X(w)) - (back ? 1 : 0), ey, AU, 2);
  // floating rune sparkles
  R.sparkle(X(w + 5), y0 + 2, [210, 250, 255], 2);
  R.sparkle(X(w + 2), y0 + h + 3, [200, 240, 255], 1);
  R.fill(R.M().set(X(w + 7), y0 + 10).set(X(-3), y0 + h + 2), [220, 250, 255]);
}, { kind: 'leather' });
})();
