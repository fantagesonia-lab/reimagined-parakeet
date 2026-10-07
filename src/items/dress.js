// Pixie Closet wardrobe: dress. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
// Full outfits (dresses replace top + bottom). Every outfit is assembled from separately painted
// pieces (bodice, sleeves, skirt tiers, trims, collars, bows, sashes) so each one carries its own
// coloured outline and casts a small shadow on what lies under it, MapleStory style.
(() => {
// ================= DRESS TOOLKIT =================
const T5 = t => Math.max(0, Math.min(5, t));
const view3 = (R, f, s, b) => R.view === 'front' ? f : R.view === 'side' ? s : b;
const SKIN_SH = [.88, .74, .78];
const GOLDM = ramp('#f2c14e', 'metal'), SILVM = ramp('#d5dae6', 'metal');
const SNOW = ramp('#f7f3f8'), REDC = ramp('#e0475a'), INKC = ramp('#34303d');
const LEATH = ramp('#8a5a3c', 'leather');
const ORANGE_C = ramp('#f08a3c'), LEAF = ramp('#5bb36a'), SKY_GEM = ramp('#8cc8f2', 'gem'), JADE_GEM = ramp('#5bd18a', 'gem');
const lighter = (r, t = .55) => ramp(mix(r.base, r.hi, t), r.kind);
const darker = (r, t = 1) => ramp(mix(r.base, r.sh, t), r.kind);

// ---- body regions (view-local) ----
const torsoM = (R, y0, y1) => R.body((x, y, p) => p === 'torso' && y >= y0 && y <= y1 && !(isSide(R) && y < 70 && x < 30));
const armsM = (R, y0, y1) => R.body((x, y, p) => p === 'arm' && y >= y0 && y <= y1);
const handsM = R => R.body((x, y, p) => p === 'hand');
const armHand = R => R.body((x, y, p) => p === 'hand' || p === 'arm');
const isLeg = R => (x, y) => { const p = R.part(x, y); return p === 'leg' || p === 'foot'; };
const skinOnly = R => (x, y) => R.isSkin(x, y);
// ---- mask utils ----
// write one pixel (view-local) straight into the buffer, optionally only where `clip` has it
const px = (R, x, y, c, clip) => { x = Math.round(x); y = Math.round(y); if (clip && !clip.has(x, y)) return; const gx = x + R.V.ox, gy = y + R.V.oy; if (gx >= 0 && gy >= 0 && gx < CW && gy < CH) R.put(gy * CW + gx, c); };
const rows = (m, y0, y1) => m.clone().keep((x, y) => y >= y0 && y <= y1);
const shifted = (R, m, dx, dy) => { const s = R.M(); m.each((x, y) => s.set(x + dx, y + dy)); return s; };
const mirrorAt = (R, m, x0) => { const s = R.M(); m.each((x, y) => s.set(2 * x0 - x, y)); return s; };
const ring = (m, w, clip) => { const o = m.clone().dilate(w).sub(m); return clip ? o.and(clip) : o; };
const rowPts = (m, y) => { const p = []; m.each((x, yy) => { if (yy === y && m.has(x - 1, y) && m.has(x + 1, y)) p.push([x, y]); }); return p; };
const topEdge = m => m.clone().keep((x, y) => !m.has(x, y - 1));
const bottomEdge = m => m.clone().keep((x, y) => !m.has(x, y + 1));
function erode(m) { const o = m.clone(), a = m.a, b = o.a, n = a.length; for (let i = 0; i < n; i++) if (a[i] && (i < CW || i >= n - CW || !a[i - 1] || !a[i + 1] || !a[i - CW] || !a[i + CW])) b[i] = 0; return o; }
// lowest painted row of a mask per column -> {x: y}
function bottoms(m) { const b = {}; m.each((x, y) => { if (b[x] == null || y > b[x]) b[x] = y; }); return b; }
// keep the parts of a piece that lie behind the head (it may still wrap the neck skin)
const NECKTOP = { front: 65, side: 68, back: 65 };
const behindHead = (R, m) => m.keep((x, y) => R.part(x, y) !== 'head' || (y >= NECKTOP[R.view] && R.isSkin(x, y)));

// Dresses only get the 'front' phase; pieces that hang behind the body (tails, back bows seen from
// the front) are drawn first and clipped to pixels nothing has been painted on yet.
const behindAll = (R, m) => { const { ox, oy } = R.V; return m.keep((x, y) => { const gx = x + ox, gy = y + oy; return gx >= 0 && gy >= 0 && gx < CW && gy < CH && R.buf[(gy * CW + gx) * 4 + 3] === 0; }); };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) % 1000 / 1000; };
// ---- tone utilities ----
// closest ramp tone of an already drawn pixel -> [ramp, tone, dist]
function nearTone(c, ramps) {
  let best = 1e9, br = null, bt = 0;
  for (const r of ramps) for (let t = 0; t < 7; t++) {
    const q = r.t[t], d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2;
    if (d < best) { best = d; br = r; bt = t; }
  }
  return [br, bt, best];
}
// Shift already painted pixels of the given ramps darker (+n) or lighter (-n), staying on the ramp.
function deepen(R, mask, ramps, n = 1, only) {
  const fn = typeof ramps === 'function' ? ramps : null;
  if (!fn) ramps = ramps.t ? [ramps] : ramps;
  const b = R.buf;
  mask.each((x, y, i) => {
    const o = i * 4; if (!b[o + 3] || (only && !only(x, y))) return;
    const [r, t, d] = nearTone([b[o], b[o + 1], b[o + 2]], fn ? [fn(x, y)] : ramps);
    if (d > 2600 || t >= 6) return;
    const c = r.t[Math.max(1, Math.min(5, t + n))];
    b[o] = c[0]; b[o + 1] = c[1]; b[o + 2] = c[2];
  });
}
// cast shadow of `piece` onto `under` (painted with `ramps`), offset down-right
function cast(R, piece, under, ramps, dx = 1, dy = 1, n = 1) {
  const s = shifted(R, piece, dx, dy); if (Math.abs(dy) > 1) s.add(shifted(R, piece, Math.round(dx / 2), dy - Math.sign(dy)));
  s.sub(piece); if (under) s.and(under);
  deepen(R, s, ramps, n);
}
const skinShadow = (R, m, dy = 1, dx = 0) => R.shadow(m, { dx, dy, tint: SKIN_SH, only: skinOnly(R) });
// shadow of a hem on the legs / shoes below it: dark row right under the edge, fading over `len`
// rows (column scan: only the pixels just under each column's lowest point are touched)
function hemShadow(R, m, len = 3) {
  const b = bottoms(m), only = isLeg(R), buf = R.buf, { ox, oy } = R.V;
  for (const xs in b) {
    const x = +xs;
    for (let k = 1; k <= len; k++) {
      const y = b[x] + k; if (m.has(x, y) || !only(x, y)) continue;
      const i = ((y + oy) * CW + x + ox) * 4; if (!buf[i + 3]) continue;
      for (let c = 0; c < 3; c++) {
        let v = buf[i + c];
        if (k === 1) v *= (.1 + .9 * SKIN_SH[c]);
        if (len > 1) v *= (.55 + .45 * SKIN_SH[c]);
        buf[i + c] = v;
      }
    }
  }
}
// A cloth fold: a tapering wedge one tone darker with a darker core and a lit lip on its upper-left.
function fold(R, p0, p1, p2, clip, ramps, w = 2, lip = true) {
  const m = R.lock(p0, p1, p2, w, 0).and(clip);
  if (m.empty()) return;
  const pts = R.curve(p0, p1, p2), core = R.M();
  pts.slice(0, Math.max(1, Math.round(pts.length * .6))).forEach(([x, y]) => core.set(x, y));
  if (lip) deepen(R, shifted(R, m, -1, -1).sub(m).and(clip), ramps, -1);
  deepen(R, m, ramps, 1);
  deepen(R, core.and(clip), ramps, 1);
}
const folds = (R, clip, ramps, list) => list.forEach(([a, b, c, w, nl]) => fold(R, a, b, c, clip, ramps, w ?? 2, !nl));
// cylinder form for a torso: shadow strip on the right, lit strip on the left
function form(R, then) {
  const cx = R.V.cx, side = isSide(R);
  return (x, y, t) => {
    if (!side && R.part(x, y) === 'torso') { const u = (x - cx) / 12; t = T5(t + (u > .45 ? 1 : 0) + (u < -.62 && y < 90 ? -1 : 0)); }
    else if (side && R.part(x, y) === 'torso' && x <= 23) t = T5(t - 1);
    return then ? then(x, y, t) : t;
  };
}
// Per-row spans of a mask, split at the body's internal contour lines (arm seams, leg gap).
// u(x,y) = 0 at a span's left edge .. 1 at its right edge, w(x,y) = span width, -1 outside.
function spans(R, m, split = true) {
  const V = R.V, U = new Float32Array(CW * CH).fill(-1), W = new Float32Array(CW * CH);
  const sep = (gx, gy) => { if (!split) return false; const k = R.bodyIdx(gx - V.ox, gy - V.oy); return k >= 0 && k <= 2 && m.a[gy * CW + gx - 1] && m.a[gy * CW + gx + 1]; };
  for (let gy = 1; gy < CH - 1; gy++) {
    let s = -1;
    for (let gx = 1; gx < CW; gx++) {
      const i = gy * CW + gx, inM = gx < CW - 1 && m.a[i] && !sep(gx, gy);
      if (inM && s < 0) s = gx;
      if (!inM && s >= 0) { const w = gx - 1 - s; for (let k = s; k < gx; k++) { U[gy * CW + k] = w ? (k - s) / w : .5; W[gy * CW + k] = w + 1; } s = -1; }
    }
  }
  const at = (A, x, y) => { const gx = x + V.ox, gy = y + V.oy; return gx < 0 || gy < 0 || gx >= CW || gy >= CH ? -1 : A[gy * CW + gx]; };
  return { u: (x, y) => at(U, x, y), w: (x, y) => at(W, x, y) };
}
// Cel shading across a piece (MapleStory style): a lit band on the left, flat base, a shadow band
// on the right; the height field only adds a lit top-left rim and a dark bottom-right rim.
//  S: anything with u(x,y) (spans() or a skirt geometry). opt.lit [u0,u1], opt.dark u, opt.hi [u0,u1]
function cel(S, opt = {}) {
  const lit = opt.lit ?? [.08, .36], dark = opt.dark ?? .72, hi = opt.hi, minW = opt.minW ?? 4;
  return (x, y, t) => {
    const u = S.u(x, y); let k = 3;
    if (u >= 0 && (!S.w || S.w(x, y) >= minW)) {
      if (u >= lit[0] && u < lit[1]) k = 2; else if (u >= dark) k = 4;
      if (hi && u >= hi[0] && u < hi[1]) k = 1;
      if (opt.deep && u >= opt.deep) k = 5;
    }
    if (t >= 5) k += 1; else if (t <= 1 && opt.rim !== false && k > 2) k = 2;
    k = T5(Math.max(1, k));
    return opt.then ? opt.then(x, y, k) : k;
  };
}
// gold / metal band: lit top row, base middle, dark outline bottom row, glints
function metalBand(R, m, rr = GOLDM, every = 5) {
  m.each((x, y) => px(R, x, y, !m.has(x, y - 1) ? rr.hi : !m.has(x, y + 1) ? rr.line : rr.base));
  m.each((x, y) => { if (!m.has(x, y - 1) && ((x * 7 + y) % every) === 0) px(R, x, y, rr.spec); });
}
// tiny hand-placed pixel sprite: rows of tone letters (L line, D dp, S sh, B base, T lt, H hi, W spec), '.' skip
const TK = { W: 0, H: 1, T: 2, B: 3, S: 4, D: 5, L: 6 };
function sprite(R, x0, y0, rowsTxt, rr, clip, flip) {
  const m = R.M(), w = rowsTxt[0].length;
  rowsTxt.forEach((row, j) => [...row].forEach((c, i) => {
    const x = flip ? x0 + w - 1 - i : x0 + i, y = y0 + j;
    if (c === '.' || (clip && !clip.has(x, y))) return;
    px(R, x, y, rr.t[TK[c]]); m.set(x, y);
  }));
  return m;
}
// shiny round button with outline
function button(R, x, y, rr, size = 2) {
  rr = rr.t ? rr : ramp(rr);
  if (size >= 3) { R.paint(R.M().ellipse(x, y, 1.2, 1.2), rr, { flat: true, round: 1.5, shiny: true }); R.fill(R.M().set(x - 1, y - 1), rr.spec); return; }
  R.fill(R.M().rect(x, y, x + 1, y + 1), rr.base); px(R, x, y, rr.hi); px(R, x + 1, y + 1, rr.line);
}
// metal buckle: bright frame, dark hole, white glint
function buckle(R, x0, y0, x1, y1, rr = GOLDM) {
  const m = R.M().rect(x0, y0, x1, y1);
  R.fill(m, rr.line);
  R.M().rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1).each((x, y) => px(R, x, y, (x === x0 + 1 || y === y0 + 1) ? rr.hi : (x === x1 - 1 || y === y1 - 1) ? rr.sh : rr.base));
  if (x1 - x0 >= 4 && y1 - y0 >= 4) R.fill(R.M().rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2), rr.dp);
  R.fill(R.M().set(x0 + 1, y0 + 1), [255, 255, 255]);
  return m;
}
// Trim band hugging the inside of a piece's outline (gold piping, contrast binding):
// w px wide, lit on its outer row, shaded on its inner row, with specular glints for metal.
//  sel(x,y) picks which part of the outline gets the trim.
function edgeTrim(R, piece, rr, w = 2, sel, opt = {}) {
  let cur = erode(piece); const layers = [];
  for (let k = 0; k < w; k++) { const nx = erode(cur); layers.push(cur.clone().sub(nx)); cur = nx; }
  const all = R.M();
  layers.forEach((L, k) => {
    if (sel) L.keep(sel);
    const tone = w === 1 ? TONE.LT : k === 0 ? TONE.HI : k === w - 1 ? TONE.SH : TONE.BASE;
    L.each((x, y) => px(R, x, y, rr.t[tone]));
    all.add(L);
  });
  if (rr.kind === 'metal' || opt.glint) layers[0].each((x, y) => { if (((x * 3 + y * 2) % (opt.every ?? 7)) === 0) px(R, x, y, rr.spec); });
  if (opt.line) { const inn = ring(all, 1, piece).sub(all).keep(sel || (() => true)); R.fill(inn, opt.line === true ? rr.line : opt.line); }
  return all;
}

// ---- garment pieces ----
const sleeveEnd = (R, kind) => kind === 'long' ? R.V.handY - 1 : kind === 'none' || !kind ? -1 : kind === 'elbow' ? R.V.sleeveShort + 5 : R.V.sleeveShort;
// Bodice: torso (+ sleeves) shaded as a cylinder, the sleeves repainted as their own pieces.
//  cfg: { sleeve, hem, keep(x,y), cut: Mask, pattern, alt, round, toneMap, bias }
function bodice(R, r, cfg = {}) {
  const V = R.V, hem = cfg.hem ?? V.waistY + 1;
  const body = torsoM(R, 0, hem);
  if (cfg.keep) body.keep(cfg.keep);
  if (cfg.cut) body.sub(cfg.cut);
  const se = cfg.sleeveEnd ?? sleeveEnd(R, cfg.sleeve);
  const sl = se > 0 ? armsM(R, 0, se) : R.M();
  if (cfg.cut) sl.sub(cfg.cut);
  if (cfg.slKeep) sl.keep(cfg.slKeep);
  // one-piece garments: the skirt joins the bodice in a single paint so no seam or rim shows
  const mg = cfg.merge;
  if (mg) body.add(mg.m);
  const all = body.clone().add(sl);
  const po = { lines: !mg, flat: true, pattern: cfg.pattern, alt: cfg.alt, bias: cfg.bias };
  const side = isSide(R);
  // torso: lit on the left, shadow on the right (side view: the chest front catches the light)
  const S = spans(R, all);
  const tm0 = cel(S, { lit: side ? [0, .45] : [.06, .34], dark: side ? .8 : .74, then: cfg.toneMap });
  const tm = mg ? (x, y, t) => (y > mg.y0 + 1 && mg.m.has(x, y) ? mg.tm(x, y, t) : tm0(x, y, t)) : tm0;
  R.paint(all, r, { ...po, round: cfg.round ?? 4, toneMap: tm });
  if (!sl.empty()) R.paint(sl, r, { ...po, round: 3, toneMap: cel(spans(R, sl), { lit: [.05, .4], dark: .7, then: cfg.toneMap }) });
  const ramps = cfg.pattern ? (x, y) => { const p = cfg.pattern(x, y); return p ? (p.t ? p : asRamp(cfg.alt)) : r; } : [r];
  return { body, sl, all, se, hem, ramps };
}
// shadow under the chin on the upper chest
function chinShadow(R, under, ramps) {
  const [nx, ny] = R.V.neck;
  const m = view3(R, R.M().ellipse(nx, ny + 2, 7, 2.2), R.M().ellipse(nx + 1, ny + 1, 6, 2), R.M());
  deepen(R, m.and(under), ramps, 1);
}
// creases at the elbows of long sleeves
function elbowFolds(R, sl, ramps) {
  folds(R, sl, ramps, view3(R,
    [[[20, 82], [23, 81], [26, 83], 2], [[22, 85], [24, 84], [27, 86], 2], [[54, 81], [57, 80], [60, 82], 2], [[54, 85], [56, 84], [59, 86], 2]],
    [[[34, 82], [37, 81], [41, 83], 2], [[35, 86], [38, 85], [42, 87], 2]],
    [[[20, 81], [23, 80], [26, 82], 2], [[21, 85], [24, 84], [27, 86], 2], [[54, 82], [57, 81], [60, 83], 2]]));
}
// Puffed sleeve head: a gathered ball over the shoulder with creases fanning up from a cuff band.
//  returns { puff, cuff }
function puffSleeves(R, r, opt = {}) {
  const s = opt.size ?? 1, cy = opt.cy ?? 74, side = isSide(R);
  const pf = side ? R.M().ellipse(38.5, cy + 2, 8 * s, 5.8 * s) : R.M().ellipse(22.5, cy, 6.5 * s, 5.6 * s).add(R.M().ellipse(57.5, cy, 6.5 * s, 5.6 * s));
  behindHead(R, pf);
  if (!side) pf.sub(torsoM(R, 0, 127));
  if (opt.clipTop != null) pf.keep((x, y) => y >= opt.clipTop);
  R.paint(pf, r, { flat: true, round: 4, toneMap: opt.toneMap });
  const ramps = [r];
  // gathers: creases running from the cuff up into the puff
  const by = Math.round(cy + 5.6 * s) - (side ? -1 : 0);
  const fx = side ? [[33, -2], [37, 0], [41, 1], [44, 2]] : [[18, -2], [21, -1], [24, 0], [56, 0], [59, 1], [62, 2]];
  for (const [x, lean] of fx) fold(R, [x, by], [x + lean * .5, by - 3], [x + lean, by - 6 * s], pf, ramps, 2, true);
  // shine on the crown of each puff
  const hl = side ? [[35, cy - 1], [36, cy - 2], [37, cy - 2]] : [[19, cy - 3], [20, cy - 4], [21, cy - 4], [55, cy - 3], [56, cy - 4], [57, cy - 4]];
  R.stroke(hl, r.hi, pf);
  return { puff: pf, bottom: by };
}
// cuff band around the arm at rows y0..y1 (grown sideways a little so it sits on top)
function armBand(R, y0, y1, rr, opt = {}) {
  const m = armsM(R, y0, y1);
  if (opt.handRows) m.add(R.body((x, y, p) => p === 'hand' && y >= y0 && y <= y1));
  if (opt.grow) m.add(m.clone().dilate(opt.grow).keep((x, y) => y >= y0 && y <= y1 && R.part(x, y) !== 'torso' && (!R.part(x, y) || R.part(x, y) === 'arm' || R.part(x, y) === 'hand')));
  R.paint(m, rr, { flat: true, round: 1.4, bias: opt.bias ?? .06, toneMap: opt.toneMap });
  if (opt.shadow !== false) skinShadow(R, m, 1);
  return m;
}

// ---- skirts ----
// Skirt geometry: hugs the waist at y0, rounds over the hips, flares out to the hem at y1.
// Front/back hems dip at the centre (top-down perspective). u(x,y) runs 0..1 across the skirt.
function skirtGeo(R, y0, y1, flare, opt = {}) {
  const V = R.V, side = isSide(R);
  const L = side ? 20 : V.torsoL, Rr = side ? 50 : V.torsoR, mid = (L + Rr) / 2;
  const hip = Math.min(opt.hip ?? 2, flare), dip = opt.dip ?? (side ? 0 : 1.6);
  const k = y => Math.max(0, Math.min(1, (y - y0) / Math.max(1, y1 - y0)));
  const out = y => { const t = k(y); return hip * Math.min(1, t * (opt.hipRate ?? 3)) + (flare - hip) * Math.pow(t, opt.bell ?? 1); };
  const fL = side ? opt.front ?? .8 : 1, fR = side ? opt.back ?? 1.15 : 1, OUT = new Float32Array(200);
  for (let y = 0; y < 200; y++) OUT[y] = out(y - 40);
  const o = y => { const j = Math.round(y) + 40; return j >= 0 && j < 200 ? OUT[j] : out(y); };
  const xl = y => L - o(y) * fL, xr = y => Rr + o(y) * fR;
  const half = (Rr - L) / 2 + flare;
  const hemY = x => y1 - (side ? (opt.sideTilt ?? 0) * (x - mid) / half : dip * ((x - mid) / half) ** 2);
  const u = (x, y) => (x - xl(y)) / Math.max(1, xr(y) - xl(y));
  const m = R.M();
  for (let y = y0; y <= y1 + 1; y++) for (let x = Math.ceil(xl(y) - .3); x <= Math.floor(xr(y) + .3); x++) if (y <= hemY(x) + .3) m.set(x, y);
  if (opt.keep) m.keep(opt.keep);
  if (opt.hands !== false) m.sub(armHand(R));
  return { m, xl, xr, u, hemY, y0, y1, L, Rr, mid };
}
// soft gathers: tubes running down the skirt (lit ridge, shaded valley), fading in below the waist
function gathers(G, n, then, opt = {}) {
  const ph = opt.phase ?? .25, sewn = opt.sewn ?? 3;
  const s = (x, y) => Math.sin((G.u(x, y) * n + ph) * Math.PI * 2);
  const tm = (x, y, t) => {
    if (y > G.y0 + sewn) { const v = s(x, y); if (v > .55) t -= 1; else if (v < -.5) t += 1; if (v < -.9 && y > G.y0 + sewn + 5) t += 1; }
    t = T5(t); return then ? then(x, y, t) : t;
  };
  // wavy hem: lift the valleys by a pixel
  const wave = () => G.m.keep((x, y) => !(y >= G.hemY(x) - .2 && s(x, y) < -.45 && G.m.has(x, y - 1)));
  return { tm, s, wave };
}
// Knife pleats: lit face, plain face and a 1px dark crease where each pleat folds under.
function pleatMap(G, n, then, opt = {}) {
  const ph = opt.phase ?? 0, lit = opt.lit ?? .5;
  const v = (x, y) => G.u(x, y) * n + ph;
  const crease = (x, y) => Math.floor(v(x, y)) !== Math.floor(v(x - 1, y));
  const tm = (x, y, t) => {
    const top = y < G.y0 + (opt.sewn ?? 0), p = v(x, y) - Math.floor(v(x, y));
    if (crease(x, y)) t = top ? t + 1 : Math.max(t + 1, opt.deep ?? 4);
    else if (!top && p < lit) t -= 1;
    t = T5(t); return then ? then(x, y, t) : t;
  };
  return { tm, crease };
}
const notchHem = (G, crease) => G.m.keep((x, y) => !(y >= Math.floor(G.hemY(x)) && crease(x, y) && G.m.has(x, y - 1)));
// shadow of a skirt over the legs below it + occlusion right under the hem
function skirtShadow(R, m, len = 3) {
  hemShadow(R, m, len);
  const occ = R.M(); m.each((x, y) => { if (!m.has(x, y + 1)) occ.set(x, y + 1); });
  R.tint(occ, [.9, .84, .9], isLeg(R));
}
// Lace edging hanging below the bottom edge of a piece: scalloped, with eyelet holes and a seam.
//  h rows deep, scallops of period P. Returns the lace mask.
function laceHem(R, piece, rr, h = 3, opt = {}) {
  const P = opt.P ?? 4, ph = opt.ph ?? 0, b = bottoms(piece), m = R.M();
  for (const xs in b) {
    const x = +xs, p = (((x + ph) % P) + P) % P;
    const yb = b[x] + h - (p === 0 ? 1 : 0) - (opt.pointed && (p === 1 || p === P - 1) ? 0 : 0);
    for (let y = b[x] - (opt.over ?? 1); y <= yb; y++) m.set(x, y);
  }
  if (opt.clip) m.and(opt.clip);
  m.sub(opt.hands === false ? R.M() : armHand(R));
  R.paint(m, rr, { flat: true, round: 1.6, bias: opt.bias ?? .12 });
  // eyelets + seam
  const ey = R.M(), seam = R.M();
  for (const xs in b) { const x = +xs, p = (((x + ph) % P) + P) % P; if (p === Math.floor(P / 2)) ey.set(x, b[x] + Math.ceil(h / 2)); seam.set(x, b[x] - (opt.over ?? 1) + 1); }
  R.fill(ey.and(erode(m)), rr.sh);
  if (opt.seam !== false) deepen(R, seam.and(erode(m)), rr, 1);
  return m;
}
// A gathered frill band (ruffle): dense pleats with a wavy bottom edge. `m` is the band shape.
function frill(R, m, rr, opt = {}) {
  const P = opt.P ?? 3, ph = opt.ph ?? 0;
  const b = bottoms(m);
  m.keep((x, y) => !(y === b[x] && (((x + ph) % P) + P) % P === 0 && m.has(x, y - 1)));
  const tm = (x, y, t) => { const p = (((x + ph) % P) + P) % P; return T5(p === 0 ? Math.max(t + 1, 4) : p === 1 ? t - 1 : t); };
  R.paint(m, rr, { flat: true, round: opt.round ?? 2, bias: opt.bias ?? .05, toneMap: opt.toneMap ? (x, y, t) => opt.toneMap(x, y, tm(x, y, t)) : tm });
  return m;
}
// Ribbon bow: two shaded loops with inner folds, a knot and two V-cut tails. s = scale.
function bow(R, x, y, rr, s = 1, opt = {}) {
  const w = (opt.w ?? 6) * s, h = (opt.h ?? 3.6) * s, tl = (opt.tail ?? 7) * s;
  const all = R.M();
  if (tl > 0) {
    const tails = R.M();
    for (const d of [-1, 1]) {
      const t = R.lock([x + d, y + 1], [x + d * (1.5 + s), y + tl * .55], [x + d * (2.5 * s + (opt.spread ?? 0)), y + tl], 2.6 * s + .4, 2.2 * s);
      // V notch at the tail end
      const ex = x + d * (2.5 * s + (opt.spread ?? 0)), ey = y + tl;
      t.sub(R.M().poly([[ex - 1.2 * s, ey + 1.5], [ex + 1.2 * s, ey + 1.5], [ex, ey - .8 * s]]));
      tails.add(t);
    }
    if (opt.clip) tails.and(opt.clip);
    R.paint(tails, rr, { flat: true, round: 2, bias: -.1 });
    all.add(tails);
  }
  const loops = [];
  for (const d of [-1, 1]) {
    const lp = R.M().poly([[x, y - 1], [x + d * w * .45, y - h], [x + d * w * .85, y - h + .5], [x + d * (w + .5), y], [x + d * w * .85, y + h - .3], [x + d * w * .45, y + h - .8], [x, y + 1]]);
    if (opt.clip) lp.and(opt.clip);
    R.paint(lp, rr, { flat: true, round: 2.2 * s, bias: d < 0 ? .06 : -.04 });
    // inner folds: from the knot out toward the loop's far corners
    R.crease([x + d * 2, y], [x + d * w * .5, y - h * .3], [x + d * w * .8, y - h * .6], rr, lp, { lipTone: 2 });
    R.crease([x + d * 2, y + 1], [x + d * w * .55, y + h * .4], [x + d * w * .75, y + h * .65], rr, lp, { noLip: true, tone: 4 });
    loops.push(lp); all.add(lp);
  }
  const knot = R.M().ellipse(x, y, 1.3 * s, 1.5 * s);
  if (opt.clip) knot.and(opt.clip);
  R.paint(knot, rr, { flat: true, round: 1.5, bias: .18 });
  for (const lp of loops) cast(R, knot, lp, rr, 1, 0);
  all.add(knot);
  return all;
}
// A bow seen in profile (side view): knot on the body surface at (x,y), an upper and a lower loop
// sticking out in direction dir (+1 = behind the back, -1 = in front of the chest), tails hanging.
function sideBow(R, x, y, rr, s = 1, dir = 1, opt = {}) {
  const all = R.M(), clip = opt.clip;
  const tl = (opt.tail ?? 8) * s;
  if (tl > 0) {
    const t = R.lock([x + dir, y + 1], [x + dir * (2 + s), y + tl * .5], [x + dir * (1.5 + 2 * s), y + tl], 2.4 * s + .4, 2 * s)
      .add(R.lock([x + dir, y + 1], [x + dir * (3 + 2 * s), y + tl * .4], [x + dir * (4 + 3 * s), y + tl * .8], 2 * s + .4, 1.6 * s));
    if (clip) t.and(clip);
    R.paint(t, rr, { flat: true, round: 1.8, bias: -.12 });
    all.add(t);
  }
  const up = R.M().poly([[x, y - 1], [x + dir * 2 * s, y - 4.5 * s], [x + dir * 4.5 * s, y - 4.5 * s], [x + dir * 5.5 * s, y - 2 * s], [x + dir * 1.5, y + .5]]);
  const lo = R.M().poly([[x, y + 1], [x + dir * 4.5 * s, y + 2 * s], [x + dir * 4.5 * s, y + 4 * s], [x + dir * 2 * s, y + 3.5 * s], [x, y + 2]]);
  for (const [m, b] of [[lo, -.08], [up, .06]]) {
    if (clip) m.and(clip);
    R.paint(m, rr, { flat: true, round: 2 * s, bias: b });
    all.add(m);
  }
  R.crease([x + dir, y - 1], [x + dir * 3 * s, y - 3 * s], [x + dir * 4 * s, y - 3.5 * s], rr, up, { noLip: true, tone: 4 });
  const knot = R.M().ellipse(x + dir * .5, y, 1.2 * s, 1.6 * s);
  if (clip) knot.and(clip);
  R.paint(knot, rr, { flat: true, round: 1.4, bias: .18 });
  all.add(knot);
  return all;
}
// five-petal flower: rounded petals around a golden heart
function flower(R, x, y, rr, rad = 2.3, opt = {}) {
  const m = R.M();
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; m.ellipse(x + Math.cos(a) * rad, y + Math.sin(a) * rad, rad * .72, rad * .72); }
  R.paint(m, rr, { flat: true, round: 2, bias: .05 });
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5 + Math.PI / 5; R.fill(R.M().set(Math.round(x + Math.cos(a) * rad * .9), Math.round(y + Math.sin(a) * rad * .9)).and(erode(m)), rr.sh); }
  px(R, x, y, GOLDM.hi); px(R, x - 1, y, GOLDM.hi); px(R, x, y + 1, GOLDM.sh); px(R, x - 1, y + 1, GOLDM.sh);
  return m;
}
// fluffy fur trim: tufted silhouette, soft round shading, irregular parting strokes with lit tips
function fur(R, m, rr, opt = {}) {
  const edge = m.clone().sub(erode(m));
  edge.each((x, y, i) => { if (hash(x, y) < (opt.notch ?? .3)) m.a[i] = 0; });
  R.paint(m, rr, { flat: true, round: opt.round ?? 2.5, bias: opt.bias ?? .1 });
  const core = erode(m), dk = R.M(), lt = R.M();
  core.each((x, y) => { const h = hash(x + 7, y * 3); if (h < .12) { dk.set(x, y); dk.set(x + (h < .06 ? 1 : -1), y + 1); lt.set(x - 1, y - 1); } });
  R.fill(lt.and(core).sub(dk), rr.hi); R.fill(dk.and(core), rr.sh);
  return m;
}
// sparkles / glints
function glints(R, pts, clip, c = [255, 255, 255]) { for (const [x, y, n] of pts) if (!clip || clip.has(x, y)) { if (n) R.sparkle(x, y, c, n); else px(R, x, y, c); } }

// ================= DRESSES =================
// skirt cel shading: lit band left, shadow right, a darker band right under the waist seam
const skirtCel = (G, opt = {}) => cel(G, { lit: opt.lit ?? [.1, .36], dark: opt.dark ?? .74, hi: opt.hi, rim: opt.rim, then: (x, y, k) => { k = y < G.y0 + (opt.waist ?? 2) ? T5(k + 1) : k; return opt.then ? opt.then(x, y, k) : k; } });
// lift the hem by a pixel where a fold reaches it, so folds read as real gathers
const foldHem = (G, xs) => G.m.keep((x, y) => !(y >= G.hemY(x) - .2 && xs.some(fx => Math.abs(fx - x) < .6) && G.m.has(x, y - 1)));
// small embroidered daisy (white petals, orange heart, soft shadow)
function daisy(R, x, y, clip, shadeR) {
  const pet = R.M().set(x - 1, y).set(x + 1, y).set(x, y - 1).set(x, y + 1);
  if (clip) pet.and(clip);
  if (shadeR) deepen(R, R.M().set(x + 1, y + 1).set(x + 2, y).set(x, y + 2).and(clip || pet.clone().dilate(2)), shadeR, 1);
  R.fill(pet, SNOW.lt); R.fill(R.M().set(x - 1, y).set(x, y - 1).and(pet), SNOW.hi);
  if (!clip || clip.has(x, y)) px(R, x, y, ORANGE_C.base);
}

// ---- Sundress: shirred bodice on thin straps with little bows, ribbon sash with a side bow,
// gathered A-line skirt with a daisy-embroidered hem band and white eyelet lace.
item('dress', 'sundress', 'Sundress', '#f5d04a', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, side = isSide(R), back = isBack(R), front = isFront(R);
  const topY = x => { if (side) return 75; if (back) return 74; const d = Math.abs(x - cx); return d <= 5.5 ? 74 + Math.round(((5.5 - d) * (5.5 - d)) / 10) - (d > 2 && d < 5 ? 1 : 0) : 73 + Math.round((d - 5.5) * .2); };
  const G = skirtGeo(R, V.waistY, V.kneeY + 1, 8, { hip: 2.5, bell: 1.15 });
  const fl = view3(R,
    [[[31, 96], [29, 102], [26, 110], 2], [[48, 96], [50, 102], [53, 110], 2], [[38, 98], [38, 104], [37, 111], 2]],
    [[[26, 96], [23, 103], [19, 110], 2], [[38, 97], [40, 103], [43, 110], 2], [[46, 96], [50, 102], [55, 109], 2]],
    [[[32, 96], [30, 102], [27, 110], 2], [[47, 96], [49, 102], [52, 110], 2], [[41, 98], [41, 104], [42, 111], 2]]);
  foldHem(G, fl.map(f => f[2][0]));
  R.paint(G.m, r, { flat: true, round: 6, toneMap: skirtCel(G) });
  folds(R, G.m, r, fl);
  // daisy print: a scalloped border of daisies above the hem and a few scattered on the skirt
  const inner = erode(G.m);
  let k = 0;
  for (let x = Math.ceil(G.xl(G.y1)) + 3; x <= G.xr(G.y1) - 2; x += 5, k++) daisy(R, x, Math.round(G.hemY(x) - 4 - (k % 2) * 2), inner, r);
  for (const [x, y] of view3(R, [[31, 99], [44, 97], [37, 103], [50, 102], [27, 104]], [[25, 99], [34, 98], [42, 101], [29, 104], [47, 104]], [[33, 99], [46, 98], [40, 103], [29, 104], [52, 103]])) daisy(R, x, y, inner, r);
  const lace = laceHem(R, G.m, SNOW, 3, { P: 4 });
  skirtShadow(R, G.m.clone().add(lace), 3);
  // bodice with soft shirring rows
  const B = bodice(R, r, { sleeve: 'none', hem: V.waistY + 1, keep: (x, y) => y >= topY(x), round: 4 });
  const sh = R.M();
  for (let y0 = 79; y0 <= 88; y0 += 3) B.body.each((x, y) => { if (y === y0 + ((x >> 1) % 2)) sh.set(x, y); });
  deepen(R, sh.and(erode(B.body)), r, 1);
  // neckline binding
  const bind = B.body.clone().keep((x, y) => y <= topY(x) + 1);
  R.paint(bind, r, { flat: true, round: 1.2, bias: .15, noOutline: true });
  R.fill(topEdge(bind), r.line);
  R.fill(bottomEdge(bind).and(erode(B.body)), r.sh);
  if (front) for (const y of [80, 84, 88]) button(R, cx, y, ramp(mix(r.base, [255, 252, 246], .85)), 2);
  // straps
  const st = R.M();
  if (front) st.line(31.5, 74, 32.5, 67, 2).line(48.5, 74, 47.5, 67, 2);
  else if (back) st.line(32, 74, 33.5, 67, 2).line(48, 74, 46.5, 67, 2);
  else st.line(25, 76, 30, 71, 2).line(30, 71, 37, 70, 2);
  behindHead(R, st);
  R.paint(st, r, { flat: true, round: 1, bias: .1 });
  skinShadow(R, st, 1, 1);
  const rib = ramp(mix(r.base, [255, 252, 246], .78));
  if (front) for (const x of [32, 48]) sprite(R, x - 3, 72, ['LL.LL', 'LHLBL', 'LTBSL', 'LL.LL'], rib);
  // ribbon sash with a side bow
  const sash = torsoM(R, V.waistY - 2, V.waistY + 1);
  sash.add(sash.clone().dilate(1).keep((x, y) => y >= V.waistY - 2 && y <= V.waistY + 1)).sub(armHand(R));
  R.paint(sash, rib, { flat: true, round: 1.6, bias: .05 });
  R.stroke(rowPts(sash, V.waistY - 1), rib.hi, sash);
  cast(R, sash, G.m, r, 0, 1);
  if (!side) {
    const b = bow(R, front ? 29 : 51, V.waistY - 1, rib, 1, { tail: 9 });
    cast(R, b, G.m.clone().add(B.body), r, 1, 1);
  } else { // the bow sits on the far hip: only a tail peeks out behind
    const t = R.lock([46, V.waistY], [50, V.waistY + 5], [51, V.waistY + 9], 2.6, 2).sub(armHand(R));
    R.paint(t, rib, { flat: true, round: 1.5, bias: -.15 });
  }
  chinShadow(R, B.body, r);
});

// ---- Royal Gown: off-shoulder sweetheart bodice with a pointed, gold-piped basque and a ladder
// of bows on the stomacher, lace frill, puffed sleeves with gold bands, pearl necklace; a
// floor-length bell skirt whose satin overskirt opens over a three-tier ruffled underskirt held by
// rosettes; laced back with a big bow and long tails.
const ROSE7 = ['..LLL..', '.LTHTL.', 'LTBSBTL', 'LBSDSBL', '.LBSBL.', '..LLL..'];
item('dress', 'gown', 'Royal Gown', '#f49ac1', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, side = isSide(R), back = isBack(R), front = isFront(R);
  const pale = lighter(r, .55), lining = darker(r, .5), rose = ramp(mix(r.base, [214, 58, 90], .55));
  const topY = x => { if (side) return 73; if (back) return 72; const d = Math.abs(x - cx); return d <= 5.5 ? 73 + Math.round(((5.5 - d) * (5.5 - d)) / 9) : 72 + Math.round((d - 5.5) * .1); };
  const pointY = x => V.waistY + (side ? 0 : Math.max(0, 4.5 - Math.abs(x - cx) * .5));
  // skirt
  const G = skirtGeo(R, V.waistY, V.footY + 4, 17, { hip: 3, bell: 1.45, dip: 2.2, back: 1.25 });
  const fl = view3(R,
    [[[30, 97], [26, 107], [21, 120], 2], [[50, 97], [54, 107], [59, 120], 2], [[25, 104], [21, 111], [16, 118], 2], [[55, 104], [59, 111], [63, 118], 2]],
    [[[26, 97], [21, 107], [15, 118], 2], [[35, 98], [35, 108], [34, 120], 2], [[44, 97], [48, 107], [53, 120], 2], [[50, 100], [56, 108], [62, 119], 2]],
    [[[32, 97], [28, 107], [23, 120], 2], [[48, 97], [52, 107], [57, 120], 2], [[40, 98], [40, 108], [40, 121], 2], [[24, 104], [20, 111], [16, 118], 2], [[56, 104], [60, 111], [64, 118], 2]]);
  foldHem(G, fl.map(f => f[2][0]));
  R.paint(G.m, r, { flat: true, round: 8, toneMap: skirtCel(G, { hi: [.18, .24] }) });
  folds(R, G.m, r, fl);
  edgeTrim(R, G.m, GOLDM, 2, (x, y) => y > G.hemY(x) - 4);
  const lace = laceHem(R, G.m, SNOW, 3, { P: 4, over: 0 });
  skirtShadow(R, G.m.clone().add(lace), 3);
  if (front) {
    // open front: an underskirt with three ruffle tiers
    const op = R.M().poly([[cx, V.waistY + 4], [cx + 2, V.waistY + 6], [cx + 12, G.y1 + 3], [cx - 12, G.y1 + 3], [cx - 2, V.waistY + 6]]).and(G.m.clone().add(lace));
    const OS = spans(R, op, false);
    R.paint(op, pale, { flat: true, round: 4, toneMap: cel(OS, { lit: [0, .3], dark: .75 }) });
    const tiers = [];
    for (const ty of [102, 108, 114]) tiers.push(frill(R, op.clone().keep((x, y) => y >= ty && y <= ty + 3), pale, { P: 4, ph: 1, round: 2 }));
    for (const t of tiers) cast(R, t, op, pale, 0, 1);
    // gold piping on the overskirt edges, shadow cast into the opening
    const ep = op.clone().dilate(1).sub(op).and(G.m);
    ep.each((x, y) => px(R, x, y, x < cx ? ((y % 4) ? GOLDM.hi : GOLDM.spec) : ((y % 4) ? GOLDM.base : GOLDM.hi)));
    R.fill(op.clone().dilate(2).sub(op).sub(ep).and(G.m), GOLDM.line);
    cast(R, ep, op, [pale], 1, 1, 1);
    // rosettes with leaves where the overskirt is caught up
    for (const [x, y] of [[cx - 10, 105], [cx + 4, 105], [cx - 13, 113], [cx + 7, 113]]) {
      R.fill(R.M().set(x - 1, y + 3).set(x - 1, y + 4).set(x + 7, y + 3).set(x + 7, y + 2), LEAF.sh);
      sprite(R, x, y, ROSE7, rose);
    }
  } else if (side) {
    // the open front of the overskirt shows as a sliver of ruffled underskirt along the front edge
    const op = R.M().poly([[21, V.waistY + 5], [24, V.waistY + 6], [22, G.y1 + 3], [8, G.y1 + 3]]).and(G.m.clone().add(lace));
    R.paint(op, pale, { flat: true, round: 3, toneMap: cel(spans(R, op, false), { lit: [0, .4], dark: .8 }) });
    for (const ty of [103, 109, 115]) { const t = frill(R, op.clone().keep((x, y) => y >= ty && y <= ty + 3), pale, { P: 3, ph: 1, round: 1.6 }); cast(R, t, op, pale, 0, 1); }
    const ep = op.clone().dilate(1).sub(op).and(G.m).keep((x, y) => x > 12);
    ep.each((x, y) => px(R, x, y, (y % 4) ? GOLDM.base : GOLDM.hi));
    cast(R, ep, op, [pale], 1, 0, 1);
    for (const [x, y] of [[16, 106], [12, 114]]) sprite(R, x, y, ROSE7, rose);
  }
  // bodice with pointed basque
  const B = bodice(R, r, { sleeve: 'none', hem: V.waistY + 5, keep: (x, y) => y >= topY(x) && y <= pointY(x) });
  cast(R, B.body, G.m, r, 0, 1);
  edgeTrim(R, B.body, GOLDM, 2, (x, y) => y >= pointY(x) - 2);
  folds(R, B.body, r, view3(R,
    [[[31, 80], [32, 85], [34, 90], 2], [[49, 80], [48, 85], [46, 90], 2]],
    [[[23, 81], [24, 85], [26, 90], 2]],
    [[[32, 80], [33, 85], [35, 90], 2], [[48, 80], [47, 85], [45, 90], 2]]));
  if (front) {
    // stomacher: a pale panel piped in gold with a ladder of three bows
    const st = R.M().poly([[cx - 4.5, topY(cx - 4) + 1], [cx + 5.5, topY(cx + 4) + 1], [cx + 3, pointY(cx) - 2], [cx + .5, pointY(cx)], [cx - 2, pointY(cx) - 2]]).and(B.body);
    R.paint(st, pale, { flat: true, round: 2, toneMap: cel(spans(R, st, false), { lit: [0, .4], dark: .8 }) });
    edgeTrim(R, st, GOLDM, 1);
    for (const [y, sc] of [[78, .55], [83, .5], [88, .45]]) { const b = bow(R, cx, y, rose, sc, { tail: 0, w: 6 }); cast(R, b, st, pale, 1, 1); }
  } else if (back) {
    // laced back panel
    const st = R.M().poly([[cx - 3, 74], [cx + 4, 74], [cx + 2.5, 93], [cx - 1.5, 93]]).and(B.body);
    R.paint(st, lining, { flat: true, round: 2, bias: -.05 });
    const cord = R.M();
    for (let y = 76; y <= 88; y += 3) cord.line(cx - 2, y, cx + 2, y + 2).line(cx + 2, y, cx - 2, y + 2);
    R.fill(cord.and(st), SNOW.lt);
    const stD = st.clone().dilate(1); for (let y = 76; y <= 90; y += 3) { px(R, cx - 3, y, GOLDM.hi, stD); px(R, cx + 3, y, GOLDM.hi, stD); }
  }
  // lace frill along the neckline
  const fr = R.M();
  for (let x = side ? 20 : 17; x <= (side ? 44 : 63); x++) { const ty = topY(x); for (let y = ty - 2; y <= ty; y++) fr.set(x, y); }
  fr.and(R.body((x, y, p) => p === 'torso' || p === 'arm').dilate(1)).keep((x, y) => R.part(x, y) !== 'head' && y >= 69);
  frill(R, fr, SNOW, { P: 2, round: 1.2, bias: .15 });
  skinShadow(R, fr, 1, 0);
  // puffed sleeves sitting off the shoulder, gold bands
  const P = puffSleeves(R, r, { cy: 76, size: 1.02, clipTop: 72 });
  const pb = armsM(R, P.bottom - 1, P.bottom + 1).dilate(1).keep((x, y) => y >= P.bottom - 1 && y <= P.bottom + 1 && R.part(x, y) !== 'torso' && R.part(x, y) !== 'hand');
  metalBand(R, pb, GOLDM);
  skinShadow(R, pb, 1);
  cast(R, P.puff, B.body, r, 1, 1);
  if (front) {
    // pearl necklace on bare collarbones + a pendant gem at the sweetheart dip
    R.curve([cx - 8, 68], [cx, 73], [cx + 8, 68]).forEach(([x, y], i) => { if (i % 2 === 0) { px(R, x, y, SNOW.lt); px(R, x + 1, y + 1, SNOW.sh); } });
    R.gem(cx, 74, 1.5, SKY_GEM);
  } else if (back) {
    const b = bow(R, cx, V.waistY - 2, r, 1.5, { tail: 15, spread: 2 });
    cast(R, b, G.m.clone().add(B.body), r, 1, 2);
    R.gem(cx, V.waistY - 2, 1, SKY_GEM);
  } else {
    const b = sideBow(R, 50, V.waistY - 2, r, 1.3, 1, { tail: 13, clip: R.M().rect(-20, 0, 100, 140).sub(armHand(R)) });
    cast(R, b, G.m, r, 1, 1);
  }
  chinShadow(R, B.body, r);
});

// ---- Café Maid: dark dress with puffed sleeves and frilled white cuffs, peter-pan collar with a
// red ribbon, frilled white apron (bib with ruffled straps, lace hem, pocket), petticoat lace,
// crossed straps and a big apron bow at the back.
item('dress', 'maid', 'Café Maid', '#34303d', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const W = SNOW;
  const G = skirtGeo(R, V.waistY, V.kneeY, 9, { hip: 2.5, bell: 1.2 });
  const fl = view3(R,
    [[[30, 97], [28, 103], [25, 109], 2], [[50, 97], [52, 103], [55, 109], 2]],
    [[[26, 97], [23, 103], [19, 108], 2], [[42, 97], [45, 103], [49, 108], 2]],
    [[[32, 97], [30, 103], [27, 109], 2], [[48, 97], [50, 103], [53, 109], 2], [[40, 98], [40, 104], [40, 110], 2]]);
  foldHem(G, fl.map(f => f[2][0]));
  const pet = laceHem(R, G.m, W, 3, { P: 3, over: 0 });
  R.paint(G.m, r, { flat: true, round: 6, toneMap: skirtCel(G, { hi: [.2, .25] }) });
  folds(R, G.m, r, fl);
  cast(R, G.m, pet, W, 0, 1);
  skirtShadow(R, G.m.clone().add(pet), 3);
  const B = bodice(R, r, { sleeve: 'short', sleeveEnd: V.sleeveShort - 1, hem: V.waistY + 1, cut: neckCut(R, 'round') });
  chinShadow(R, B.body, r);
  folds(R, B.body, r, view3(R, [[[31, 84], [32, 88], [34, 91], 2], [[49, 84], [48, 88], [46, 91], 2]], [[[22, 86], [24, 89], [27, 91], 2]], [[[33, 86], [35, 89], [37, 91], 2], [[47, 86], [46, 89], [44, 91], 2]]));
  const P = puffSleeves(R, r, { cy: 74 });
  // white cuffs with a tiny frill
  const cf = armBand(R, V.sleeveShort - 2, V.sleeveShort, W, { grow: 1 });
  const cfr = armsM(R, V.sleeveShort + 1, V.sleeveShort + 2).dilate(1).keep((x, y) => y >= V.sleeveShort + 1 && y <= V.sleeveShort + 2 && R.part(x, y) !== 'torso');
  frill(R, cfr, W, { P: 2, round: 1 });
  skinShadow(R, cfr, 1);
  cast(R, cf, P.puff, r, 0, -1);
  // apron skirt
  let apron = front ? R.M().poly([[cx - 10, V.waistY], [cx + 10, V.waistY], [cx + 14, 105], [cx - 14, 105]]) : side ? R.M().poly([[18, V.waistY], [27, V.waistY], [27, 106], [14, 106]]) : R.M();
  apron.and(G.m.clone().dilate(1)).sub(armHand(R));
  if (!apron.empty()) {
    const AS = spans(R, apron, false);
    R.paint(apron, W, { flat: true, round: 4, toneMap: cel(AS, { lit: [.05, .35], dark: .75 }) });
    folds(R, apron, W, front ? [[[34, 95], [33, 100], [31, 105], 2], [[45, 95], [46, 100], [48, 105], 2]] : [[[22, 95], [20, 100], [18, 105], 2]]);
    const al = laceHem(R, apron, W, 3, { P: 4, over: 0 });
    cast(R, apron.clone().add(al), G.m, r, 1, 1);
    if (front) { // pocket with a frilled top
      const pk = R.M().rect(cx + 3, 97, cx + 8, 101);
      R.paint(pk, W, { flat: true, round: 1.5, bias: -.02 });
      frill(R, R.M().rect(cx + 3, 96, cx + 8, 97), W, { P: 2, round: 1 });
      cast(R, pk, apron, W, 1, 1);
    }
  }
  // bib with ruffled straps (front) / crossed straps (back)
  if (front) {
    const bib = R.M().poly([[cx - 6, 77], [cx + 6, 77], [cx + 7, V.waistY], [cx - 7, V.waistY]]).and(B.body);
    R.paint(bib, W, { flat: true, round: 3, toneMap: cel(spans(R, bib, false), { lit: [0, .35], dark: .78 }) });
    cast(R, bib, B.body, r, 1, 1);
    const straps = R.M();
    for (const d of [-1, 1]) R.curve([cx + d * 7, V.waistY - 1], [cx + d * 9, 78], [cx + d * 9, 68]).forEach(([x, y]) => { straps.set(x, y); straps.set(x + d, y); straps.set(x + 2 * d, y); });
    behindHead(R, straps);
    straps.and(B.all.clone().dilate(1)).keep((x, y) => R.part(x, y) !== 'head');
    frill(R, straps, W, { P: 2, round: 1.2, toneMap: (x, y, t) => T5(t + ((y % 2) ? 1 : 0)) });
    cast(R, straps, B.all, r, 1, 1);
  } else if (back) {
    const straps = R.M().line(cx - 9, 69, cx + 8, V.waistY - 1, 3).line(cx + 9, 69, cx - 8, V.waistY - 1, 3);
    behindHead(R, straps); straps.and(B.body);
    R.paint(straps, W, { flat: true, round: 1.4, bias: .05 });
    cast(R, straps, B.body, r, 1, 1);
  } else {
    const bib = R.M().poly([[20, 77], [24, 77], [24, V.waistY], [20, V.waistY]]).and(B.body);
    R.paint(bib, W, { flat: true, round: 2, bias: .05 });
    const st = R.M().line(23, 77, 31, 70, 2).line(31, 70, 39, 71, 2); behindHead(R, st);
    R.paint(st.sub(P.puff), W, { flat: true, round: 1, bias: .1 });
  }
  // waist tie band + bow
  const wb = torsoM(R, V.waistY - 1, V.waistY + 1).sub(armHand(R));
  R.paint(wb, W, { flat: true, round: 1.4, bias: .1 });
  cast(R, wb, G.m, r, 0, 1);
  if (back) { const b = bow(R, cx, V.waistY, W, 1.4, { tail: 13, spread: 2 }); cast(R, b, G.m.clone().add(B.body), r, 1, 2); }
  else if (side) { const b = sideBow(R, 50, V.waistY, W, 1.2, 1, { tail: 11, clip: R.M().rect(-20, 0, 100, 140).sub(armHand(R)) }); cast(R, b, G.m, r, 1, 1); }
  // peter-pan collar with a red ribbon
  let col;
  if (front) col = R.M().ellipse(nx - 4.5, ny + 2, 5, 3).add(R.M().ellipse(nx + 4.5, ny + 2, 5, 3));
  else if (back) col = R.M().ellipse(nx, ny + 1, 10, 3.2);
  else col = R.M().ellipse(nx - 1, ny + 2, 6, 3);
  behindHead(R, col);
  R.paint(col, W, { flat: true, round: 2, bias: .08 });
  cast(R, col, B.all, r, 1, 1);
  if (front) { R.fill(R.M().set(nx, ny + 1).set(nx, ny + 2).set(nx, ny + 3).and(col), W.sh); const b = bow(R, nx, ny + 4, REDC, .6, { tail: 4 }); cast(R, b, B.body, r, 1, 1); }
  else if (side) bow(R, nx - 4, ny + 4, REDC, .5, { tail: 3 });
});

// tiny gold embroidery motifs
const STAR5 = ['..H..', '.HTB.', 'HTBBS', '.BSS.', '.S.S.'];
const MOON5 = ['.HT.', 'H...', 'T...', 'B...', '.BS.'];
function motif(R, x, y, rowsTxt, rr, clip) { return sprite(R, x, y, rowsTxt, rr, clip); }

// ---- Witch Robe: long robe with a tattered, gold-embroidered hem (stars and a crescent moon),
// dagger bell sleeves lined in a deeper shade, a laced black corset with gold eyelets and piping,
// a pointed capelet with a gem clasp.
item('dress', 'witch', 'Witch Robe', '#5b3d8f', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const lining = darker(r, .85), cape = ramp(mix(mix(r.base, r.dp, .3), INKC.base, .5));
  // robe skirt with a tattered hem
  const G = skirtGeo(R, V.waistY, V.footY + 2, 10, { hip: 2.5, bell: 1.3, dip: 1.4 });
  G.m.keep((x, y) => y <= G.hemY(x) - tri(x + 2, 7, 3.5) + 1.5);
  const fl = view3(R,
    [[[31, 97], [28, 106], [24, 116], 2], [[49, 97], [52, 106], [56, 116], 2], [[38, 99], [37, 108], [36, 117], 2]],
    [[[25, 97], [22, 106], [17, 116], 2], [[37, 98], [38, 107], [40, 117], 2], [[46, 98], [50, 107], [55, 116], 2]],
    [[[33, 97], [30, 106], [26, 116], 2], [[47, 97], [50, 106], [54, 116], 2], [[42, 99], [43, 108], [44, 117], 2]]);
  R.paint(G.m, r, { flat: true, round: 6, toneMap: skirtCel(G) });
  folds(R, G.m, r, fl);
  edgeTrim(R, G.m, GOLDM, 1, (x, y) => y > G.hemY(x) - 6);
  // embroidered zig-zag above the hem + stars and a moon
  const zz = R.M(), zy = x => Math.round(G.hemY(x) - 6 - tri(x + 2, 7, 3.5) * .6);
  for (let x = Math.ceil(G.xl(G.y1)); x < G.xr(G.y1); x++) zz.line(x, zy(x), x + 1, zy(x + 1));
  R.fill(zz.and(erode(G.m)), GOLDM.sh);
  const inner = erode(G.m);
  for (const [x, y] of view3(R, [[29, 101], [47, 99], [43, 107]], [[24, 101], [38, 103]], [[31, 100], [46, 103], [36, 108]])) motif(R, x, y, STAR5, GOLDM, inner);
  motif(R, view3(R, 33, 30, 49), 106, MOON5, GOLDM, inner);
  skirtShadow(R, G.m, 3);
  // bodice + long sleeves
  const B = bodice(R, r, { sleeve: 'long', hem: V.waistY + 1, cut: neckCut(R, 'v') });
  chinShadow(R, B.body, r);
  elbowFolds(R, B.sl, r);
  // dagger bell sleeves: the cuff flares out and hangs into a point
  const bellL = side ? R.M().poly([[31, 84], [48, 84], [50, 88], [54, 95], [57, 102], [51, 97], [46, 93.5], [33, 93.5], [30.5, 89]])
    : R.M().poly([[13.5, 84], [28, 84], [28.5, 89], [25, 92.5], [17, 93.5], [12, 96], [7, 103], [8, 95], [11, 88]]);
  const bell = side ? bellL : bellL.clone().add(mirrorAt(R, bellL, cx));
  bell.sub(R.body((x, y, p) => p === 'hand' && y > 91)).sub(torsoM(R, 0, 127));
  R.paint(bell, r, { flat: true, round: 3, toneMap: cel(spans(R, bell, false), { lit: [.05, .35], dark: .75 }) });
  const lin = bell.clone().keep((x, y) => !bell.has(x, y + 2) && y >= 90 && (side ? x <= 50 : (x >= 12 && x <= 68)));
  R.paint(lin, lining, { flat: true, round: 1, bias: -.15, noOutline: true });
  edgeTrim(R, bell, GOLDM, 1, (x, y) => y >= 89);
  cast(R, bell, R.body((x, y, p) => p === 'hand'), [], 0, 1);
  skinShadow(R, bell, 1);
  // corset
  let cor = view3(R, R.M().poly([[28, 83], [cx - 3, 85], [cx + 3, 85], [52, 83], [53, 96], [cx + 2, 98.5], [cx - 2, 98.5], [27, 96]]),
    R.M().poly([[18, 83], [32, 84], [32, 96], [18, 98]]),
    R.M().poly([[28, 83], [52, 83], [53, 96], [27, 96]]));
  cor.and(torsoM(R, 0, 127).dilate(1)).sub(armHand(R));
  R.paint(cor, INKC, { flat: true, round: 2, shiny: true, toneMap: cel(spans(R, cor, false), { lit: [.04, .3], dark: .78, hi: [.1, .16] }) });
  edgeTrim(R, cor, GOLDM, 1, (x, y) => !cor.has(x, y - 2) || !cor.has(x, y + 2));
  cast(R, cor, G.m.clone().add(B.body), [r], 1, 1);
  if (!side) { // lacing down the centre (front) / back
    const cord = R.M();
    for (let y = 87; y <= 95; y += 2) cord.line(cx - 2, y, cx + 1, y + 1).line(cx + 2, y, cx - 1, y + 1);
    R.fill(cord.and(cor), lighter(r, .6).base);
    for (let y = 86; y <= 96; y += 2) { px(R, cx - 3, y, GOLDM.hi, cor); px(R, cx + 3, y, GOLDM.hi, cor); }
    R.fill(R.M().set(cx - 1, 97).set(cx - 2, 98).set(cx + 1, 97).set(cx + 2, 98).set(cx - 2, 99).set(cx + 3, 99), lighter(r, .6).base);
  }
  // potion vial hanging from the corset
  if (!back) {
    const vx = front ? 49 : 24, vy = 99;
    R.stroke([[vx, 96], [vx, 97]], LEATH.sh);
    R.fill(R.M().set(vx, vy - 2), LEATH.base);
    R.fill(R.M().set(vx, vy - 1), SNOW.sh);
    const vial = R.M().ellipse(vx, vy + 1.5, 1.8, 2);
    R.paint(vial, JADE_GEM, { flat: true, round: 1.6, shiny: true });
    R.fill(R.M().set(vx - 1, vy + 1), [255, 255, 255]);
    cast(R, vial, G.m, [r], 1, 1);
  }
  // pointed capelet
  const capeM = view3(R, R.M().poly([[nx - 10, ny - 1], [nx + 10, ny - 1], [nx + 18, ny + 6], [nx + 18, ny + 12], [nx - 18, ny + 12], [nx - 18, ny + 6]]),
    R.M().poly([[nx - 7, ny - 1], [nx + 10, ny - 2], [nx + 18, ny + 5], [nx + 19, ny + 12], [nx - 9, ny + 12], [nx - 9, ny + 5]]),
    R.M().poly([[nx - 11, ny - 1], [nx + 11, ny - 1], [nx + 18, ny + 6], [nx + 18, ny + 13], [nx - 18, ny + 13], [nx - 18, ny + 6]]));
  const cb = side ? ny + 12 : ny + 12;
  capeM.keep((x, y) => y <= cb - tri(x + (side ? 1 : 3), 6, 4)).sub(neckCut(R, 'round'));
  behindHead(R, capeM);
  if (front) capeM.sub(R.M().poly([[nx - .5, ny + 2], [nx + 1.5, ny + 2], [nx + 3, cb + 1], [nx - 2, cb + 1]]));
  R.paint(capeM, cape, { flat: true, round: 3, toneMap: cel(spans(R, capeM, false), { lit: [.04, .3], dark: .76 }) });
  edgeTrim(R, capeM, GOLDM, 1, (x, y) => !capeM.has(x, y + 2));
  cast(R, capeM, B.all.clone().add(cor), [r, INKC], 1, 2);
  if (front) { R.gem(nx + .5, ny + 4, 1.5, JADE_GEM); R.fill(R.M().set(nx - 2, ny + 4).set(nx + 3, ny + 4), GOLDM.base); }
  else if (back) motif(R, nx - 2, ny + 4, STAR5, GOLDM, capeM);
});

// ---- Summer Yukata: morning-glory print, crossed collar over a white under-collar, wide
// hanging sleeves, overlap seam, a patterned obi with an obi-age band, a cord with a jewelled
// clasp, and a big butterfly bow at the back.
const GLORY = ['.PPP.', 'PPSPP', 'PSDSP', 'PPSPP', '.PPP.'];
const gloryPat = r => {
  const pet = ramp(mix(r.base, [255, 255, 255], .75)), mid = ramp(mix(mix(r.base, [190, 140, 230], .5), [255, 255, 255], .3)), deep = ramp(mix(r.dp, [90, 50, 170], .35));
  return (x, y) => {
    const j = Math.floor((y + 88) / 11), xx = (x + (j % 2) * 7 + 140) % 14, yy = (y + 88) % 11;
    if (xx > 4 || yy > 4) return null;
    const c = GLORY[yy][xx];
    return c === 'P' ? pet : c === 'S' ? mid : c === 'D' ? deep : null;
  };
};
item('dress', 'yukata', 'Summer Yukata', '#8cc8f2', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const pat = gloryPat(r), ramps = (x, y) => pat(x, y) || r;
  const OBI = ramp('#e0475a'), obiAge = ramp('#f7c6d8'), collarR = ramp(mix(r.dp, [40, 50, 110], .35));
  // column skirt, slightly tapered toward the ankles
  const G = skirtGeo(R, V.waistY, V.footY + 4, 3, { hip: 2.5, bell: 1, dip: 1, front: .5, back: .8 });
  G.m.keep((x, y) => side || (x >= G.xl(y) + Math.max(0, (y - 108) * .12) && x <= G.xr(y) - Math.max(0, (y - 108) * .12)));
  R.paint(G.m, r, { flat: true, round: 6, toneMap: skirtCel(G), pattern: pat });
  folds(R, G.m, ramps, view3(R, [[[33, 99], [32, 108], [31, 119], 2], [[47, 99], [48, 108], [49, 119], 2]], [[[26, 99], [24, 108], [22, 119], 2], [[42, 99], [44, 108], [46, 119], 2]], [[[34, 99], [33, 108], [32, 119], 2], [[46, 99], [47, 108], [48, 119], 2]]));
  if (front) { // overlap seam of the outer panel (left over right: the edge runs down the viewer's left)
    const seam = R.curve([35, 96], [33, 108], [32, G.y1 + 2]);
    R.stroke(seam, r.line, G.m); R.stroke(seam.map(([x, y]) => [x + 1, y]), r.lt, G.m);
    deepen(R, R.M().poly([[29, 96], [35, 96], [32, G.y1 + 2], [26, G.y1 + 2]]).and(G.m), ramps, 1);
  }
  edgeTrim(R, G.m, r, 1, (x, y) => y > G.hemY(x) - 2, { line: false });
  skirtShadow(R, G.m, 3);
  // bodice + long sleeves
  const B = bodice(R, r, { sleeve: 'long', hem: V.waistY + 1, cut: neckCut(R, 'v'), pattern: pat });
  chinShadow(R, B.body, ramps);
  // hanging furisode-style sleeves (the hands stay in front of them)
  let sl = view3(R, R.M().poly([[14, 79], [21, 72], [28, 80], [27.5, 89], [26, 99], [23, 101.5], [11, 101.5], [8, 98.5], [9, 88]]),
    R.M().poly([[31, 76], [46, 74], [50, 84], [52, 98], [49, 101.5], [36, 101.5], [33, 97]]),
    R.M().poly([[14, 79], [21, 72], [28, 80], [27.5, 89], [26, 99], [23, 101.5], [11, 101.5], [8, 98.5], [9, 88]]));
  if (!side) sl.add(mirrorAt(R, sl, cx));
  sl.sub(handsM(R)).sub(torsoM(R, 0, 127));
  R.paint(sl, r, { flat: true, round: 4, pattern: pat, toneMap: cel(spans(R, sl), { lit: [.04, .38], dark: .72, minW: 3 }) });
  folds(R, sl, ramps, view3(R, [[[16, 82], [13, 90], [12, 99], 2], [[64, 82], [67, 90], [68, 99], 2]], [[[40, 80], [41, 90], [42, 100], 2]], [[[16, 82], [13, 90], [12, 99], 2], [[64, 82], [67, 90], [68, 99], 2]]));
  const cuff = R.body((x, y, p) => p === 'arm' && y >= V.handY - 3).and(sl);
  R.fill(cuff.keep((x, y) => !sl.has(x, y + 1) || R.part(x, y + 1) === 'hand'), r.line);
  skinShadow(R, sl, 1);
  // crossed collar: white under-collar, then the dark collar band on top
  let col, under;
  if (front) {
    under = R.M().poly([[nx - 6, ny], [nx + 6, ny], [nx + 1, ny + 12], [nx - 1, ny + 12]]);
    col = R.M().poly([[nx + 3, ny - 1], [nx + 7, ny], [nx - 7, ny + 21], [nx - 11, ny + 21]]).add(R.M().poly([[nx - 7, ny], [nx - 3, ny - 1], [nx + 1.5, ny + 8], [nx - .5, ny + 10]]));
  } else if (side) {
    under = R.M().ellipse(nx - 1, ny + 1, 5, 2.5);
    col = R.M().poly([[nx - 5, ny - 1], [nx + 6, ny - 2], [nx + 7, ny + 1], [nx - 3, ny + 2], [nx - 9, ny + 18], [nx - 11, ny + 16]]);
  } else {
    under = R.M().ellipse(nx, ny, 7, 2);
    col = R.M().poly([[nx - 9, ny - 2], [nx + 9, ny - 2], [nx + 8, ny + 2], [nx - 8, ny + 2]]);
  }
  behindHead(R, under); behindHead(R, col);
  under.and(B.all.clone().add(neckCut(R, 'v'))).keep((x, y) => R.part(x, y) !== 'head' || R.isSkin(x, y));
  R.paint(under, SNOW, { flat: true, round: 1.5, bias: .1 });
  if (front) { // the outer panel overlaps the inner collar: fill the V below the under-collar with fabric
    const vfill = neckCut(R, 'v').and(R.body((x, y, p) => p === 'torso')).sub(under).keep((x, y) => y > ny + 3);
    R.paint(vfill, r, { lines: true, flat: true, round: 2, pattern: pat });
  }
  R.paint(col, collarR, { flat: true, round: 1.6, bias: .05 });
  cast(R, col, B.all.clone().add(under), [r, SNOW, collarR], 1, 1);
  // obi
  const obi = torsoM(R, V.waistY - 9, V.waistY + 2).sub(armHand(R));
  obi.add(obi.clone().dilate(1).keep((x, y) => y >= V.waistY - 9 && y <= V.waistY + 2).sub(armHand(R)).sub(sl));
  R.paint(obi, OBI, { flat: true, round: 2.5, toneMap: cel(spans(R, obi, false), { lit: [.05, .35], dark: .74 }), pattern: (x, y) => ((y - V.waistY) % 4 === 0 ? ramp(mix(OBI.base, GOLDM.base, .6)) : null) });
  const age = rows(obi, V.waistY - 9, V.waistY - 8);
  R.paint(age, obiAge, { flat: true, round: 1, bias: .1, noOutline: true });
  R.fill(topEdge(age), obiAge.line);
  const cord = rows(obi, V.waistY - 4, V.waistY - 4);
  R.fill(cord, SNOW.lt); R.fill(shifted(R, cord, 0, 1).and(obi), OBI.dp);
  cast(R, obi, G.m.clone().add(B.body), ramps, 0, 1);
  if (front) { R.gem(cx + 1, V.waistY - 4, 1.5, ramp('#5fd1c9', 'gem')); R.fill(R.M().set(cx - 2, V.waistY - 4).set(cx + 4, V.waistY - 4), GOLDM.base); }
  if (back || side) {
    // butterfly bow: two big wings and hanging folds
    const bx = side ? 51 : cx, by = V.waistY - 5;
    const tails = R.M().poly([[bx - 4, by + 2], [bx + 4, by + 2], [bx + 6, by + 15], [bx - 6, by + 15]]);
    if (side) tails.sub(armHand(R));
    R.paint(tails, OBI, { flat: true, round: 2.5, toneMap: (x, y, t) => T5(t + ((x - bx + 20) % 4 === 0 ? 1 : 0)) });
    const b = side ? sideBow(R, 49, by, OBI, 1.7, 1, { tail: 0, clip: R.M().rect(-20, 0, 100, 140).sub(armHand(R)) }) : bow(R, bx, by, OBI, 2.2, { tail: 0 });
    R.fill(R.M().rect(bx - 1, by - 2, bx + 1, by + 2).and(b), obiAge.base);
    cast(R, b.clone().add(tails), G.m.clone().add(B.body).add(obi), [r, OBI, ...[pat(0, 0) || r]], 1, 2);
  }
});

// ---- Magical Girl: white bodice with a big ribbon bow and a heart brooch, puffed sleeves with
// ribbon bands, frilled wrist cuffs, a jewelled waist band, a pleated skirt with gold trim over a
// pink petticoat ruffle and lace, and a huge back bow with flowing ribbon tails.
const HEART = ['.HT.TB.', 'HWTBBBS', 'TTBBBSD', '.BBBSD.', '..BSD..', '...D...'];
item('dress', 'magical', 'Magical Girl', '#f7f3f8', (R, ph, r) => {
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const pk = ramp('#f7a8c4'), rib = ramp('#ef6f9f'), pale = ramp(mix(pk.base, [255, 255, 255], .45));
  if (ph !== 'front') return;
  // the big back bow's ribbon tails flutter out beside the legs
  if (front) for (const d of [-1, 1]) { const t = behindAll(R, R.lock([cx + d * 10, V.waistY + 4], [cx + d * 19, V.waistY + 12], [cx + d * 17, V.waistY + 24], 4, 3)); R.paint(t, rib, { flat: true, round: 2, bias: -.2 }); }
  // petticoat ruffle + lace under the skirt
  const G = skirtGeo(R, V.waistY, V.crotchY + 2, 12, { hip: 3, bell: .8 });
  const P = pleatMap(G, side ? 7 : 8, null, { sewn: 3, lit: .45, phase: .5 });
  notchHem(G, P.crease);
  const PG = skirtGeo(R, V.waistY + 4, V.crotchY + 5, 13.5, { hip: 3, bell: .8 });
  const pet = PG.m.clone().keep((x, y) => y > G.hemY(x) - 2);
  frill(R, pet, pale, { P: 3, round: 2 });
  const lace = laceHem(R, pet, SNOW, 2, { P: 3, over: 0 });
  skirtShadow(R, pet.clone().add(lace), 3);
  R.paint(G.m, r, { flat: true, round: 6, toneMap: skirtCel(G, { then: P.tm }) });
  edgeTrim(R, G.m, GOLDM, 1, (x, y) => y > G.hemY(x) - 3);
  cast(R, G.m, pet, [pale], 0, 1);
  // stars on the skirt
  glints(R, view3(R, [[30, 99, 1], [49, 101, 1], [41, 104]], [[25, 100, 1], [42, 103]], [[31, 101, 1], [48, 99, 1]]), erode(G.m), GOLDM.hi);
  // bodice
  const topY = x => { if (!front) return side ? 72 : 71; const d = Math.abs(x - cx); return d <= 5 ? 72 + Math.round(((5 - d) * (5 - d)) / 8) : 71; };
  const B = bodice(R, r, { sleeve: 'none', hem: V.waistY + 1, keep: (x, y) => y >= topY(x) });
  chinShadow(R, B.body, r);
  folds(R, B.body, r, view3(R, [[[31, 84], [32, 88], [34, 91], 2], [[49, 84], [48, 88], [46, 91], 2]], [[[22, 86], [24, 89], [27, 91], 2]], [[[33, 86], [35, 89], [37, 91], 2], [[47, 86], [46, 89], [44, 91], 2]]));
  edgeTrim(R, B.body, pk, 1, (x, y) => y <= topY(x) + 1);
  if (back) { // laced back
    const cord = R.M();
    for (let y = 74; y <= 88; y += 2) cord.line(cx - 2, y, cx + 1, y + 1).line(cx + 2, y, cx - 1, y + 1);
    R.fill(cord.and(B.body), rib.base);
    for (let y = 73; y <= 89; y += 2) { px(R, cx - 3, y, GOLDM.hi, B.body); px(R, cx + 3, y, GOLDM.hi, B.body); }
    R.stroke([[cx - 4, 73], [cx - 4, 90]], r.sh, B.body); R.stroke([[cx + 4, 73], [cx + 4, 90]], r.sh, B.body);
  }
  // puffed sleeves with ribbon bands
  const PS = puffSleeves(R, r, { cy: 74 });
  const pb = armsM(R, PS.bottom - 1, PS.bottom + 1).dilate(1).keep((x, y) => y >= PS.bottom - 1 && y <= PS.bottom + 1 && R.part(x, y) !== 'torso' && R.part(x, y) !== 'hand');
  R.paint(pb, rib, { flat: true, round: 1.2, bias: .1 });
  skinShadow(R, pb, 1);
  cast(R, PS.puff, B.body, r, 1, 1);
  // frilled wrist cuffs
  const wc = armsM(R, V.handY - 3, V.handY - 1).dilate(1).keep((x, y) => y >= V.handY - 3 && y <= V.handY - 1 && R.part(x, y) !== 'torso');
  frill(R, wc, SNOW, { P: 2, round: 1 });
  R.fill(rows(wc, V.handY - 2, V.handY - 2).and(erode(wc.clone().dilate(1))), rib.base);
  skinShadow(R, wc, 1);
  // jewelled waist band
  const wb = torsoM(R, V.waistY - 2, V.waistY + 1).sub(armHand(R));
  R.paint(wb, pk, { flat: true, round: 1.5, bias: .05 });
  metalBand(R, rows(wb, V.waistY + 1, V.waistY + 1), GOLDM);
  cast(R, wb, G.m, r, 0, 1);
  if (front) R.gem(cx, V.waistY - 1, 1.2, ramp('#f7a8c4', 'gem'));
  // chest bow with a heart brooch
  if (front) {
    const b = bow(R, cx, 77, rib, 1.25, { tail: 8, spread: 1 });
    cast(R, b, B.body, r, 1, 1);
    const hg = ramp('#ff5c9a', 'gem');
    const hm = sprite(R, cx - 3, 74, HEART, hg);
    R.fill(ring(hm, 1).keep((x, y) => y >= 74), GOLDM.base);
    R.fill(ring(hm, 1).keep((x, y) => y < 74 || x < cx - 3), GOLDM.hi);
    R.fill(R.M().set(cx - 2, 75), [255, 255, 255]);
  } else if (side) {
    const b = sideBow(R, 21, 77, rib, 1, -1, { tail: 7 }); cast(R, b, B.body, r, 1, 1);
    const bb = sideBow(R, 50, V.waistY - 1, rib, 1.5, 1, { tail: 15, clip: R.M().rect(-20, 0, 100, 140).sub(armHand(R)) });
    cast(R, bb, G.m, r, 1, 1);
  } else {
    const b = bow(R, cx, V.waistY - 2, rib, 2, { tail: 16, spread: 3 });
    cast(R, b, G.m.clone().add(B.body), r, 1, 2);
    R.gem(cx, V.waistY - 2, 1.2, ramp('#f7a8c4', 'gem'));
  }
});

// ---- Kitty Onesie: fleece suit with tabby stripes on the limbs, a cream tummy patch with a paw
// print, a silver zip with a pull tab, fluffy rib cuffs, a bell collar, a buttoned seat flap and a
// striped tail with a white tip and a ribbon.
function kittyTail(R, r, pts, behind) {
  const [a, b, c] = pts, m = R.lock(a, b, c, 5, 3.4);
  if (behind) behindAll(R, m);
  const along = R.curve(a, b, c), tip = R.M();
  along.slice(-4).forEach(([x, y]) => tip.ellipse(x, y, 1.8, 1.8));
  const bands = R.M(); along.forEach(([x, y], i) => { if (i % 5 < 2 && i < along.length - 5) bands.ellipse(x, y, 2.2, 2.2); });
  R.paint(m, r, { flat: true, round: 2.2, pattern: (x, y) => tip.has(x, y) ? SNOW : bands.has(x, y) ? darker(r, .9) : null });
  return m;
}
item('dress', 'onesie', 'Kitty Onesie', '#b8b0c8', (R, ph, r) => {
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const tabby = darker(r, 1.05), cream = ramp(mix(r.base, [255, 248, 236], .78));
  if (ph !== 'front') return;
  if (front) kittyTail(R, r, [[cx + 12, 100], [cx + 37, 101], [cx + 33, 79]], true);
  else if (side) kittyTail(R, r, [[46, 100], [62, 100], [63, 82]], true);
  const suit = R.body((x, y, p) => (p === 'torso' || p === 'arm' || ((p === 'leg' || p === 'foot') && y <= V.footY - 1)) && !(side && y < 70 && x < 30)).sub(neckCut(R, 'round'));
  const limb = (x, y) => { const p = R.part(x, y); return p === 'arm' || p === 'leg' || (back && p === 'torso' && y > 72); };
  const stripe = (x, y) => limb(x, y) && ((y + Math.round(x * (side ? .3 : 0))) % 6 + 6) % 6 < 2 ? tabby : null;
  const S = spans(R, suit);
  R.paint(suit, r, { lines: true, flat: true, round: 4, pattern: stripe, toneMap: cel(S, { lit: [.05, .36], dark: .72, minW: 3 }) });
  const ramps = [r, tabby];
  elbowFolds(R, R.body((x, y, p) => p === 'arm'), ramps);
  // knee + crotch folds
  folds(R, suit, ramps, view3(R,
    [[[28, 109], [31, 108], [35, 109], 2], [[45, 109], [48, 108], [52, 109], 2], [[33, 98], [36, 100], [39, 101], 2], [[47, 98], [44, 100], [41, 101], 2]],
    [[[26, 111], [30, 110], [34, 111], 2], [[22, 94], [24, 97], [27, 99], 2]],
    [[[28, 109], [31, 108], [35, 109], 2], [[45, 109], [48, 108], [52, 109], 2]]));
  chinShadow(R, suit, ramps);
  // fluffy rib cuffs at wrists and ankles
  const cuffs = R.body((x, y, p) => (p === 'arm' && y >= V.handY - 3) || ((p === 'leg' || p === 'foot') && y >= V.footY - 3 && y <= V.footY - 1));
  cuffs.add(cuffs.clone().dilate(1).keep((x, y) => (y >= V.handY - 3 && y <= V.handY - 1 && R.part(x, y) !== 'torso' && R.part(x, y) !== 'hand') || (y >= V.footY - 3 && y <= V.footY - 1)));
  fur(R, cuffs, cream, { P: 3, round: 1.6 });
  cast(R, cuffs, suit, ramps, 0, -1);
  skinShadow(R, cuffs, 1);
  if (front) {
    // tummy patch with a paw print
    const tum = R.M().ellipse(cx, 90, 7, 8.5).and(suit);
    R.paint(tum, cream, { flat: true, round: 4, toneMap: cel(spans(R, tum, false), { lit: [.05, .4], dark: .75 }) });
    cast(R, tum, suit, ramps, 1, 1);
    const pad = ramp('#f49ab8');
    R.paint(R.M().ellipse(cx, 93, 2.2, 1.6), pad, { flat: true, round: 1.4, bias: .05 });
    for (const [x, y] of [[cx - 3, 90], [cx - 1, 88], [cx + 1, 88], [cx + 3, 90]]) { px(R, x, y, pad.base); px(R, x, y + 1, pad.sh); }
    // zip
    const zip = R.M().rect(cx, ny + 3, cx, 101);
    R.fill(zip.clone().and(suit), SILVM.sh);
    zip.each((x, y) => { if (y % 2 === 0) px(R, x, y, SILVM.hi, suit); });
    R.fill(R.M().rect(cx - 1, ny + 3, cx + 1, ny + 6), SILVM.line); R.fill(R.M().rect(cx, ny + 4, cx, ny + 5), SILVM.hi);
  } else if (back) {
    // buttoned seat flap
    const flap = R.M().poly([[cx - 8, 93], [cx + 8, 93], [cx + 7, 100], [cx - 7, 100]]).and(suit);
    R.paint(flap, r, { flat: true, round: 2, bias: .08, pattern: stripe });
    cast(R, flap, suit, ramps, 1, 1);
    button(R, cx - 6, 94, cream, 2); button(R, cx + 5, 94, cream, 2);
    kittyTail(R, r, [[cx, 98], [cx - 15, 96], [cx - 17, 79]]);
  } else {
    const zp = R.M().rect(20, 72, 20, 101).and(suit); R.fill(zp, SILVM.sh);
  }
  // hood lying on the back
  if (!front) {
    const hood = back ? R.M().ellipse(cx, 72, 11, 6.5).keep((x, y) => y >= ny) : R.M().ellipse(43, 74, 5.5, 6.5).keep((x, y) => y >= ny - 1);
    behindHead(R, hood);
    R.paint(hood, r, { flat: true, round: 3.5, toneMap: cel(spans(R, hood, false), { lit: [.05, .35], dark: .74 }) });
    const inner = hood.clone().and(back ? R.M().ellipse(cx, 69.5, 8, 3.5) : R.M().ellipse(42, 72, 2.5, 4.5));
    R.paint(inner, cream, { flat: true, round: 2, toneMap: (x, y, t) => (y < (back ? 70 : 71) ? 4 : 3) });
    cast(R, hood, suit, ramps, 1, 2);
  }
  // bell collar
  const col = view3(R, R.M().ellipse(nx, ny + 1, 7, 2.2), R.M().ellipse(nx, ny + 1, 6, 2), R.M().ellipse(nx, ny, 8, 2)).and(suit.clone().dilate(1));
  behindHead(R, col);
  R.paint(col, REDC, { flat: true, round: 1.2, bias: .1 });
  if (front) { R.paint(R.M().ellipse(nx, ny + 4, 2, 2), GOLDM, { flat: true, round: 1.8, shiny: true }); R.fill(R.M().set(nx, ny + 5), GOLDM.line); R.fill(R.M().set(nx - 1, ny + 3), GOLDM.spec); }
  else if (side) { R.paint(R.M().ellipse(nx - 6, ny + 3, 1.6, 1.8), GOLDM, { flat: true, round: 1.5, shiny: true }); }
});

// ---- Captain Coat: long coat with gold-trimmed edges, navy revers lapels and turned-back cuffs
// with gold buttons, fringed epaulettes, an open front over a ruffled shirt with a cascading jabot,
// a black belt with a big buckle, a knotted sash with fringed ends, breeches, a back vent.
const NAVYC = ramp('#2c2f5a');
item('dress', 'pirate', 'Captain Coat', '#8a2335', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const pants = ramp('#4a3a42');
  // breeches (seen in the coat opening / under the coat tails)
  const legs = R.body((x, y, p) => (p === 'torso' && y >= V.waistY) || (p === 'leg' && y <= V.kneeY + 1));
  R.paint(legs, pants, { lines: true, flat: true, round: 3, toneMap: cel(spans(R, legs), { lit: [.05, .35], dark: .7, minW: 3 }) });
  const knee = R.body((x, y, p) => p === 'leg' && y >= V.kneeY - 1 && y <= V.kneeY + 1);
  R.paint(knee, pants, { lines: true, flat: true, round: 1, bias: .1 });
  button(R, view3(R, 33, 27, 33), V.kneeY, GOLDM); if (!side) button(R, view3(R, 51, 0, 51), V.kneeY, GOLDM);
  hemShadow(R, knee, 2);
  // coat skirt
  const G = skirtGeo(R, V.waistY, V.kneeY + 3, 6, { hip: 2, bell: 1, dip: .8, back: 1.6 });
  const open = front ? R.M().poly([[nx - 4, ny], [nx + 4, ny], [nx + 3, V.waistY - 1], [nx + 9, G.y1 + 3], [nx - 9, G.y1 + 3], [nx - 3, V.waistY - 1]]) : R.M();
  G.m.sub(open);
  R.paint(G.m, r, { flat: true, round: 4, toneMap: skirtCel(G, { hi: [.2, .25] }) });
  folds(R, G.m, r, view3(R, [[[29, 97], [27, 104], [24, 112], 2], [[51, 97], [53, 104], [56, 112], 2]], [[[27, 97], [24, 104], [21, 112], 2], [[44, 97], [48, 104], [53, 111], 2]], [[[31, 97], [29, 104], [27, 112], 2], [[49, 97], [51, 104], [53, 112], 2]]));
  const openD = open.clone().dilate(2);
  edgeTrim(R, G.m, GOLDM, 2, (x, y) => y > G.hemY(x) - 3 || openD.has(x, y));
  skirtShadow(R, G.m, 3);
  if (back) { // centre vent with buttons
    const vent = R.curve([cx, 99], [cx, 105], [cx, G.y1]);
    R.stroke(vent, r.line, G.m); R.stroke(vent.map(([x, y]) => [x - 1, y]), r.lt, G.m);
    deepen(R, R.M().rect(cx + 1, 99, cx + 2, G.y1).and(G.m), r, 1);
    button(R, cx - 4, V.waistY + 1, GOLDM); button(R, cx + 3, V.waistY + 1, GOLDM);
  }
  // shirt + jabot in the opening
  const B0 = torsoM(R, 0, V.waistY);
  if (front) {
    const shirt = open.clone().and(B0).sub(neckCut(R, 'round'));
    R.paint(shirt, SNOW, { flat: true, lines: true, round: 2 });
    // cascading jabot: stacked rounded ruffle lobes painted as one piece, with a fold under each lobe
    const lobes = [[ny + 1, 3.2], [ny + 4, 3.8], [ny + 7, 4.2], [ny + 10, 4]].map(([y, w]) => behindHead(R, R.M().ellipse(cx + .5, y + 1.5, w, 2).keep((x, yy) => yy >= y)));
    const J = R.M(); lobes.forEach(l => J.add(l));
    R.paint(J, SNOW, { flat: true, round: 2.5, bias: .12, toneMap: (x, y, t) => T5(x > cx + 1 ? Math.max(t, 3) : t) });
    lobes.forEach((l, i) => { if (i < lobes.length - 1) bottoms(l) && Object.entries(bottoms(l)).forEach(([x, y]) => { if (J.has(+x, y + 1)) px(R, +x, y, +x > cx ? SNOW.sh : SNOW.base); }); });
    R.fill(ring(J, 1, shirt), SNOW.dp);
    cast(R, J, shirt, SNOW, 1, 1);
    R.gem(cx, ny + 3, 1, REDC);
  }
  // coat body + sleeves
  const B = bodice(R, r, { sleeve: 'long', hem: V.waistY + 1, cut: front ? open.clone().add(neckCut(R, 'round')) : neckCut(R, 'round') });
  chinShadow(R, B.body, r);
  elbowFolds(R, B.sl, r);
  if (front) edgeTrim(R, B.body, GOLDM, 2, (x, y) => openD.has(x, y) && y > ny + 13);
  // belt across the shirt + sash knotted on the hip
  const belt = front ? open.clone().and(torsoM(R, V.waistY - 2, V.waistY + 1)) : R.M();
  if (front) { R.paint(belt, INKC, { flat: true, round: 1.2, shiny: true }); buckle(R, cx - 2, V.waistY - 3, cx + 2, V.waistY + 2, GOLDM); }
  // turned-back cuffs
  const cuff = armBand(R, V.handY - 7, V.handY - 1, NAVYC, { grow: 1, shadow: true });
  edgeTrim(R, cuff, GOLDM, 1, (x, y) => !cuff.has(x, y - 2));
  for (const [x, y] of view3(R, [[22, 85], [57, 85]], [[42, 86]], [[22, 85], [57, 85]])) if (cuff.has(x, y)) button(R, x, y, GOLDM);
  cast(R, cuff, B.sl, r, 0, -1);
  // revers lapels
  let lap;
  if (front) lap = R.M().poly([[nx - 4, ny], [nx - 9, ny + 1], [nx - 11, ny + 6], [nx - 8, ny + 10], [nx - 4, ny + 15], [nx - 3, ny + 2]]).add(R.M().poly([[nx + 4, ny], [nx + 9, ny + 1], [nx + 11, ny + 6], [nx + 8, ny + 10], [nx + 4, ny + 15], [nx + 3, ny + 2]]));
  else if (side) lap = R.M().poly([[nx - 6, ny], [nx + 1, ny], [nx - 1, ny + 5], [nx - 7, ny + 14], [nx - 11, ny + 12], [nx - 10, ny + 4]]);
  else lap = R.M().poly([[nx - 10, ny - 1], [nx + 10, ny - 1], [nx + 12, ny + 4], [nx - 12, ny + 4]]);
  behindHead(R, lap);
  R.paint(lap, NAVYC, { flat: true, round: 2, bias: .08 });
  edgeTrim(R, lap, GOLDM, 1);
  cast(R, lap, B.all, r, 1, 1);
  if (front) for (const y of [ny + 5, ny + 9]) for (const x of [nx - 8, nx + 7]) button(R, x, y, GOLDM);
  // fringed epaulettes
  const ep = view3(R, R.M().ellipse(22, 71, 5, 2.2).add(R.M().ellipse(58, 71, 5, 2.2)), R.M().ellipse(37, 72, 5.5, 2.2), R.M().ellipse(22, 71, 5, 2.2).add(R.M().ellipse(58, 71, 5, 2.2)));
  behindHead(R, ep);
  const fr = R.M(); ep.each((x, y) => { if (!ep.has(x, y + 1) && x % 2 === 0) for (let k = 1; k <= 4; k++) fr.set(x, y + k); });
  R.fill(fr, GOLDM.sh); fr.each((x, y) => { if (!fr.has(x, y + 1)) px(R, x, y, GOLDM.line); else if (!fr.has(x, y - 1)) px(R, x, y, GOLDM.hi); });
  R.paint(ep, GOLDM, { flat: true, round: 2, shiny: true });
  cast(R, ep.clone().add(fr), B.all, r, 1, 1);
  // flap pockets with buttons on the coat skirt
  const pk = view3(R, R.M().rect(25, 99, 31, 101).add(R.M().rect(49, 99, 55, 101)), R.M().rect(21, 99, 27, 101), R.M()).and(G.m);
  if (!pk.empty()) {
    R.paint(pk, r, { flat: true, round: 1.2, bias: .12 });
    edgeTrim(R, pk, GOLDM, 1, (x, y) => !pk.has(x, y + 1));
    cast(R, pk, G.m, r, 0, 1);
    for (const x of view3(R, [27, 52], [23], [])) button(R, x, 99, GOLDM);
  }
});

// ---- Snow Parka: quilted coat dress with a big fur collar, fur cuffs and hem, wooden toggles on
// rope loops, flap pockets, pom-pom ties, and a fur-rimmed hood lying on the back.
item('dress', 'winter', 'Snow Parka', '#e0475a', (R, ph, r) => {
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const FUR = ramp('#f6efe2'), wood = ramp('#9a6a43', 'leather'), rope = ramp('#e9dcc0');
  if (ph === 'back') return;
  const quilt = (m, ramps, y0, y1, step = 5) => {
    const seam = R.M(), lit = R.M(), dk = R.M();
    m.each((x, y) => { const k = ((y - y0) % step + step) % step; if (y < y0 || y > y1) return; if (k === 0) seam.set(x, y); else if (k === 1 || (k === 2 && step > 5)) lit.set(x, y); else if (k === step - 1) dk.set(x, y); });
    const core = erode(m);
    deepen(R, dk.and(core), ramps, 1); deepen(R, lit.and(core), ramps, -1); deepen(R, seam.and(core), ramps, 1); deepen(R, seam.clone().keep((x, y) => hash(x, y) < .5 || x % 3 === 0).and(core), ramps, 1);
  };
  const G = skirtGeo(R, V.waistY, V.kneeY - 2, 6, { hip: 2, bell: 1 });
  const B = bodice(R, r, { sleeve: 'long', hem: V.waistY + 1, merge: { m: G.m, y0: G.y0, tm: skirtCel(G, { waist: 0 }) } });
  quilt(B.all, r, 73, V.kneeY - 6, 6);
  folds(R, G.m, r, view3(R, [[[31, 96], [29, 101], [27, 106], 2], [[49, 96], [51, 101], [53, 106], 2]], [[[27, 96], [24, 101], [21, 106], 2]], [[[32, 96], [30, 101], [28, 106], 2], [[48, 96], [50, 101], [52, 106], 2]]));
  // flap pockets
  const pk = view3(R, R.M().rect(28, 96, 34, 98).add(R.M().rect(46, 96, 52, 98)), R.M().rect(22, 96, 28, 98), R.M());
  if (!pk.empty()) { pk.and(G.m); R.paint(pk, r, { flat: true, round: 1.2, bias: .12 }); cast(R, pk, G.m, r, 0, 1); for (const x of view3(R, [31, 49], [25], [])) button(R, x, 97, wood, 2); }
  // fur hem
  const fh = G.m.clone().keep((x, y) => y > G.hemY(x) - 3);
  fh.add(fh.clone().dilate(1).keep((x, y) => y > G.hemY(x) - 3 && y <= G.hemY(x) + 1)).sub(armHand(R));
  fur(R, fh, FUR, { P: 3 });
  cast(R, fh, G.m, r, 0, -1);
  skirtShadow(R, G.m.clone().add(fh), 3);
  elbowFolds(R, B.sl, r);
  const cf = armsM(R, V.handY - 4, V.handY - 1);
  cf.add(cf.clone().dilate(1).keep((x, y) => y >= V.handY - 4 && y <= V.handY && R.part(x, y) !== 'torso' && (R.part(x, y) !== 'hand' || y <= V.handY)));
  fur(R, cf, FUR, { P: 3, round: 1.8 });
  skinShadow(R, cf, 1);
  cast(R, cf, B.sl, r, 0, -1);
  // centre front placket with toggles on rope loops
  if (front) {
    R.stroke(R.curve([cx, ny + 4], [cx, 90], [cx, G.y1 - 3]), r.line, B.body.clone().add(G.m));
    R.stroke(R.curve([cx + 1, ny + 4], [cx + 1, 90], [cx + 1, G.y1 - 3]), r.lt, B.body.clone().add(G.m));
    for (const y of [76, 83, 90, 99]) {
      const loop = R.M().line(cx + 1, y, cx + 4, y - 1).line(cx + 4, y - 1, cx + 5, y).line(cx + 5, y, cx + 4, y + 1).line(cx + 4, y + 1, cx + 1, y);
      R.fill(loop, rope.base); R.fill(R.M().set(cx + 4, y + 1).set(cx + 5, y), rope.sh);
      const t = R.M().rect(cx - 3, y - 1, cx + 1, y);
      R.fill(t, wood.base); R.fill(R.M().rect(cx - 3, y - 1, cx + 1, y - 1), wood.hi); R.fill(R.M().set(cx - 2, y - 1), wood.spec);
      R.fill(ring(t, 1).keep((x, yy) => yy >= y - 1), wood.line);
      cast(R, t.clone().add(loop), B.body.clone().add(G.m), r, 1, 1);
    }
  } else if (side) {
    for (const y of [76, 83, 90, 99]) { const t = R.M().rect(19, y - 1, 21, y); R.paint(t, wood, { flat: true, round: 1, shiny: true }); }
  }
  // hood lying on the back (back + side), behind the collar
  if (!front) {
    const hood = back ? R.M().ellipse(cx, 72, 13, 8).keep((x, y) => y >= ny) : R.M().ellipse(43, 74, 7, 8).keep((x, y) => y >= ny - 1);
    behindHead(R, hood);
    R.paint(hood, r, { flat: true, round: 4, toneMap: cel(spans(R, hood, false), { lit: [.05, .35], dark: .74 }) });
    const rim = hood.clone().sub(back ? R.M().ellipse(cx, 70, 10, 6) : R.M().ellipse(42, 72, 4.5, 6));
    fur(R, rim, FUR, { P: 3, round: 1.6 });
    R.paint(hood.clone().and(back ? R.M().ellipse(cx, 70, 10, 6) : R.M().ellipse(42, 72, 4.5, 6)), darker(r, .9), { flat: true, round: 3, bias: -.25 });
    cast(R, hood, B.all, r, 1, 2);
  }
  // big fur collar
  const col = view3(R, R.M().ellipse(nx, ny + 2, 13, 4.5), R.M().ellipse(nx + 1, ny + 2, 9, 4.5), R.M().ellipse(nx, ny + 2, 13, 4));
  behindHead(R, col);
  fur(R, col, FUR, { P: 3, round: 2.5 });
  cast(R, col, B.all, r, 1, 2);
  skinShadow(R, col, 1);
  if (front) { // pom-pom ties
    for (const [x, d] of [[cx - 3, -1], [cx + 3, 1]]) {
      R.stroke(R.curve([x, ny + 5], [x + d, ny + 9], [x + d * 2, ny + 13]), rope.sh, null);
      const pp = R.M().ellipse(x + d * 2, ny + 14, 1.6, 1.6);
      R.paint(pp, FUR, { flat: true, round: 1.5, bias: .1 });
      cast(R, pp, B.body, r, 1, 1);
    }
  }
});

// ---- Petal Dress: leaf-cup bodice with veins on a twining vine halter, three tiers of pointed
// petals (darkest at the back, lightest on top) with midribs and lit tips, a blossom with a
// pearl heart at the hip, dewdrop gems and sparkles.
// a leaf / petal: widest a little above the middle, tapering to a point at (x1,y1)
function petal(R, x0, y0, x1, y1, w) {
  const m = R.M(), n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    const hw = (w / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * .85 + .12)), .75);
    if (hw < .6) m.set(x, y); else m.ellipse(x, y, hw, hw);
  }
  return m;
}
function paintPetal(R, m, rr, x0, y0, x1, y1, opt = {}) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  // left of the spine is lit, right is in shadow, the tip catches the light
  const tm = (x, y, t) => {
    const s = ((x - x0) * dy - (y - y0) * dx) / L, along = ((x - x0) * dx + (y - y0) * dy) / (L * L);
    let k = s < -1 ? 2 : s > 1.2 ? 4 : 3;
    if (along > .78 && s < 0) k = 1;
    if (t >= 5) k += 1;
    return T5(k);
  };
  R.paint(m, rr, { flat: true, round: 2.5, toneMap: tm, bias: opt.bias });
  // midrib
  const rib = R.curve([x0, y0 + 1], [(x0 + x1) / 2 + (opt.bend || 0), (y0 + y1) / 2], [x0 + dx * .8, y0 + dy * .8]);
  R.stroke(rib, rr.sh, erode(m)); R.stroke(rib.map(([x, y]) => [x - 1, y]), rr.lt, erode(m));
}
item('dress', 'fairy', 'Petal Dress', '#8fe0b8', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const vine = ramp(mix(r.base, [60, 130, 70], .55)), pinkF = ramp('#f7a8c4'), dew = ramp('#bfe8ff', 'gem');
  const tiers = [
    { y1: V.kneeY + 2, ramp: darker(r, .45), xs: side ? [16, 22, 28, 34, 40, 46, 52] : [20, 26, 32, 38, 44, 50, 56, 61], w: 8, lean: .3 },
    { y1: V.kneeY - 3, ramp: r, xs: side ? [19, 25, 31, 37, 43, 49] : [23, 29, 35, 41, 47, 53, 58], w: 8, lean: .25 },
    { y1: V.kneeY - 8, ramp: lighter(r, .35), xs: side ? [22, 28, 34, 40, 46] : [26, 32, 38, 44, 50, 55], w: 7.5, lean: .2 },
  ];
  const hands = armHand(R), all = R.M();
  const mid = side ? 35 : cx, { ox, oy } = V;
  for (const T of tiers) {
    // neighbouring petals go into different paint groups so their outlines stay separate
    const ps = T.xs.map(x => ({ x0: x, y0: V.waistY + 1, x1: x + (x - mid) * T.lean, y1: T.y1 - Math.abs(x - mid) * .12, bend: (x - mid) * .05 }));
    const tierM = R.M();
    for (const grp of [0, 1]) {
      const gm = R.M(), own = new Int8Array(CW * CH).fill(-1);
      ps.forEach((P, i) => { if (i % 2 !== grp) return; const m = petal(R, P.x0, P.y0, P.x1, P.y1, T.w).sub(hands); m.each((x, y, idx) => { own[idx] = i; }); gm.add(m); });
      if (gm.empty()) continue;
      const tm = (x, y, t) => {
        const P = ps[own[(y + oy) * CW + x + ox]]; if (!P) return t;
        const dx = P.x1 - P.x0, dy = P.y1 - P.y0, L = Math.hypot(dx, dy) || 1;
        const sd = ((x - P.x0) * dy - (y - P.y0) * dx) / L, along = ((x - P.x0) * dx + (y - P.y0) * dy) / (L * L);
        let k = sd < -1 ? 2 : sd > 1.2 ? 4 : 3;
        if (along > .78 && sd < 0) k = 1;
        if (t >= 5) k += 1;
        return T5(k);
      };
      R.paint(gm, T.ramp, { flat: true, round: 2.5, toneMap: tm });
      const core = erode(gm);
      ps.forEach((P, i) => {
        if (i % 2 !== grp) return;
        const rib = R.curve([P.x0, P.y0 + 1], [(P.x0 + P.x1) / 2 + P.bend, (P.y0 + P.y1) / 2], [P.x0 + (P.x1 - P.x0) * .8, P.y0 + (P.y1 - P.y0) * .8]);
        for (const [x, y] of rib) { px(R, x, y, T.ramp.sh, core); px(R, x - 1, y, T.ramp.lt, core); }
      });
      tierM.add(gm);
    }
    if (!all.empty()) cast(R, tierM, all.clone().sub(tierM), tiers.map(t => t.ramp), 0, 1);
    all.add(tierM);
  }
  skirtShadow(R, all, 3);
  // dewdrops and sparkles on the petal tips
  for (const [x, y] of view3(R, [[24, 108], [52, 106], [37, 101]], [[22, 107], [42, 104]], [[27, 106], [55, 108], [44, 101]])) if (all.has(x, y)) R.gem(x, y, 1, dew);
  glints(R, view3(R, [[17, 100, 1], [64, 103, 1], [30, 113]], [[13, 104, 1], [58, 100, 1]], [[18, 103, 1], [62, 99, 1]]), null, [255, 255, 240]);
  // bodice: two leaf cups wrapping the chest (front), leaf panels elsewhere
  const B = bodice(R, r, { sleeve: 'none', hem: V.waistY + 1, keep: (x, y) => y >= (front ? 74 + Math.max(0, 2 - Math.abs(x - cx)) : 73) });
  if (front) {
    for (const d of [1, -1]) {
      const m = petal(R, cx - d * 9, V.waistY, cx + d * 4, 73, 13).and(B.body);
      paintPetal(R, m, lighter(r, .15), cx - d * 9, V.waistY, cx + d * 4, 73, { bend: d * 2 });
      cast(R, m, B.body, r, 1, 1);
    }
  } else {
    const m = B.body.clone();
    for (let y = 77; y <= 90; y += 4) R.stroke(R.curve([side ? 21 : cx - 9, y + 2], [side ? 27 : cx, y], [side ? 33 : cx + 9, y + 2]), r.sh, erode(m));
  }
  // twining vine: halter around the neck and a belt at the waist with tiny leaves
  const vinePts = front ? R.curve([cx - 6, 74], [cx - 9, 67], [cx - 4, 64]).concat(R.curve([cx + 6, 74], [cx + 9, 67], [cx + 4, 64]))
    : side ? R.curve([24, 75], [28, 68], [35, 67]) : R.curve([cx - 6, 74], [cx - 7, 68], [cx - 3, 65]).concat(R.curve([cx + 6, 74], [cx + 7, 68], [cx + 3, 65]));
  const vm = R.M(); vinePts.forEach(([x, y]) => vm.set(x, y)); behindHead(R, vm);
  R.fill(vm, vine.sh); R.fill(shifted(R, vm, 1, 0).sub(vm).and(R.body(() => true)).keep((x, y) => R.isSkin(x, y)), vine.line);
  const belt = R.M(); for (let x = side ? 18 : 24; x <= (side ? 50 : 56); x++) belt.set(x, V.waistY + Math.round(Math.sin(x * .9)));
  belt.sub(hands);
  R.fill(belt, vine.base); R.fill(shifted(R, belt, 0, 1).sub(belt).and(all.clone().add(B.body)), vine.line);
  for (const [x, y, d] of view3(R, [[30, 91, -1], [46, 92, 1], [cx - 7, 70, -1]], [[25, 91, -1], [40, 92, 1]], [[32, 91, -1], [48, 92, 1]])) {
    const lf = R.M().set(x, y).set(x + d, y - 1).set(x + 2 * d, y - 1).set(x + d, y); R.fill(lf, vine.lt); R.fill(R.M().set(x + 2 * d, y - 1), vine.hi);
  }
  // blossom with a pearl heart at the hip
  const fx = view3(R, 27, 21, 53);
  const fl = flower(R, fx, V.waistY - 1, pinkF, 2.4);
  cast(R, fl, all.clone().add(B.body), [r, ...tiers.map(t => t.ramp), lighter(r, .15)], 1, 1);
  chinShadow(R, B.body, r);
});

// ---- Tailcoat Tuxedo: satin peak lapels with a rose boutonniere and a pocket square, a white
// piqué waistcoat with a pointed hem, pleated shirt bib with studs and wing collar, a satin bow
// tie, shirt cuffs with gold cufflinks, long split tails with buttons, trousers with a satin
// side stripe and pressed creases.
item('dress', 'tuxedo', 'Tailcoat Tuxedo', '#2e2b3a', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const satin = ramp(mix(r.base, [176, 170, 200], .38)), tie = ramp(mix(r.base, INKC.base, .5));
  // tails (front view: they peek out behind the legs)
  if (front) {
    const tl = behindAll(R, R.M().poly([[24, 94], [33, 94], [31, 113], [26, 113]]).add(R.M().poly([[47, 94], [56, 94], [54, 113], [49, 113]])));
    R.paint(tl, r, { flat: true, round: 2, bias: -.2 });
  }
  // trousers
  const legs = R.body((x, y, p) => (p === 'torso' && y >= V.waistY - 1) || ((p === 'leg' || p === 'foot') && y <= V.footY + 1));
  const LS = spans(R, legs);
  R.paint(legs, r, { lines: true, flat: true, round: 3, toneMap: cel(LS, { lit: [.08, .36], dark: .74, minW: 3 }) });
  const stripe = legs.clone().keep((x, y) => { if (y < V.crotchY - 2) return false; const u = LS.u(x, y); if (side) return u > .42 && u < .56; return x < cx ? u > .02 && u < .16 : u > .84 && u < .98; });
  stripe.each((x, y) => px(R, x, y, stripe.has(x - 1, y) ? satin.sh : satin.lt));
  const crease = legs.clone().keep((x, y) => y > V.crotchY && (side ? Math.abs(LS.u(x, y) - .2) < .04 : Math.abs(LS.u(x, y) - .5) < .05));
  deepen(R, crease, r, 1); deepen(R, shifted(R, crease, -1, 0).sub(crease).and(legs), r, -1);
  folds(R, legs, r, view3(R, [[[28, 113], [31, 112], [35, 113], 2], [[45, 113], [48, 112], [52, 113], 2]], [[[25, 115], [29, 114], [33, 115], 2]], [[[28, 113], [31, 112], [35, 113], 2], [[45, 113], [48, 112], [52, 113], 2]]));
  hemShadow(R, R.body((x, y, p) => (p === 'leg' || p === 'foot') && y === V.footY + 1), 1);
  // tails (back / side): long split coat-tails
  let tails = R.M();
  if (back) { const t = R.M().poly([[24.5, V.waistY - 1], [40, V.waistY - 1], [39.5, 96], [37, 104], [34, 113.5], [29, 113.5], [25, 104], [23.5, 97]]); tails = t.add(mirrorAt(R, t, cx)); }
  else if (side) tails = R.M().poly([[36, V.waistY - 1], [50, V.waistY - 1], [54, 113], [44, 114]]);
  tails.sub(armHand(R));
  if (!tails.empty()) {
    R.paint(tails, r, { flat: true, round: 3, bias: .12, toneMap: cel(spans(R, tails, false), { lit: [.05, .4], dark: .78, hi: [.12, .2] }) });
    cast(R, tails, legs, r, 1, 1, 2);
    folds(R, tails, r, back ? [[[34, 96], [32, 104], [31, 112], 2], [[46, 96], [48, 104], [49, 112], 2]] : [[[45, 96], [47, 104], [49, 112], 2]]);
    edgeTrim(R, tails, satin, 1, (x, y) => !tails.has(x - 1, y) || !tails.has(x, y + 2));
    if (back) {
      R.stroke(rowPts(tails, V.waistY + 2), r.line, tails); R.stroke(rowPts(tails, V.waistY + 3), r.hi, tails);
      button(R, cx - 5, V.waistY + 3, SILVM); button(R, cx + 4, V.waistY + 3, SILVM);
    }
    hemShadow(R, tails, 2);
  }
  // shirt + waistcoat
  const B0 = torsoM(R, 0, V.waistY + 4);
  const opening = front ? R.M().poly([[nx - 6, ny], [nx + 6, ny], [nx + 7, 92], [nx + 6, 97], [nx, 99], [nx - 6, 97], [nx - 7, 92]]) : R.M();
  if (front) {
    const shirt = opening.clone().and(B0).sub(neckCut(R, 'round'));
    R.paint(shirt, SNOW, { flat: true, round: 2 });
    for (const x of [cx - 2, cx + 2]) R.stroke(R.curve([x, ny + 4], [x, ny + 8], [x, ny + 12]), SNOW.sh, shirt);
    for (const y of [ny + 5, ny + 9]) R.stud(cx, y, GOLDM, 1);
    const vest = R.M().poly([[nx - 6, ny + 12], [nx - 2, ny + 15], [nx + 2, ny + 15], [nx + 6, ny + 12], [nx + 7, 92], [nx + 6, 97], [nx, 99], [nx - 6, 97], [nx - 7, 92]]).and(B0);
    R.paint(vest, SNOW, { flat: true, round: 2.5, toneMap: cel(spans(R, vest, false), { lit: [.05, .3], dark: .72 }) });
    R.stroke(R.curve([cx, ny + 15], [cx, 90], [cx, 98]), SNOW.sh, vest);
    for (const y of [86, 90, 94]) button(R, cx + 1, y, SILVM);
    cast(R, vest, shirt, SNOW, 0, 1);
  }
  // jacket (short in front: cut away at the waist)
  const jkt = bodice(R, r, { sleeve: 'long', hem: V.waistY + 2, cut: front ? opening.clone().add(neckCut(R, 'round')) : neckCut(R, 'round'),
    keep: (x, y) => !front || y <= V.waistY - Math.max(0, 6 - Math.abs(x - cx) * .45) + 2 });
  chinShadow(R, jkt.body, r);
  elbowFolds(R, jkt.sl, r);
  folds(R, jkt.body, r, view3(R, [[[29, 82], [30, 87], [31, 92], 2], [[51, 82], [50, 87], [49, 92], 2]], [[[22, 84], [23, 88], [25, 92], 2]], [[[33, 82], [34, 87], [35, 92], 2], [[47, 82], [46, 87], [45, 92], 2]]));
  cast(R, jkt.body, B0.clone().sub(jkt.body), [SNOW], 1, 0);
  // shirt cuffs with cufflinks
  const sc = R.body((x, y, p) => p === 'arm' && y >= V.handY - 2).add(R.body((x, y, p) => p === 'arm' && y >= V.handY - 2).dilate(1).keep((x, y) => y >= V.handY - 2 && y <= V.handY - 1 && R.part(x, y) !== 'torso' && R.part(x, y) !== 'hand'));
  R.paint(sc, SNOW, { flat: true, round: 1.2, bias: .05 });
  for (const [x, y] of view3(R, [[20, V.handY - 2], [59, V.handY - 2]], [[40, V.handY - 2]], [[20, V.handY - 2], [59, V.handY - 2]])) if (sc.has(x, y)) R.stud(x, y, GOLDM, 1);
  skinShadow(R, sc, 1);
  // satin peak lapels
  let lap;
  if (front) lap = R.M().poly([[nx - 6, ny], [nx - 10, ny + 2], [nx - 12, ny + 4], [nx - 9, ny + 6], [nx - 7, 92], [nx - 6, ny + 2]]).add(R.M().poly([[nx + 6, ny], [nx + 10, ny + 2], [nx + 12, ny + 4], [nx + 9, ny + 6], [nx + 7, 92], [nx + 6, ny + 2]]));
  else if (side) lap = R.M().poly([[nx - 6, ny], [nx + 1, ny], [nx - 2, ny + 6], [nx - 9, ny + 22], [nx - 11, ny + 20], [nx - 11, ny + 4]]);
  else lap = R.M().poly([[nx - 10, ny - 1], [nx + 10, ny - 1], [nx + 11, ny + 3], [nx - 11, ny + 3]]);
  behindHead(R, lap);
  R.paint(lap, satin, { flat: true, round: 2, shiny: true, toneMap: cel(spans(R, lap, false), { lit: [0, .4], dark: .8, hi: [.15, .3] }) });
  cast(R, lap, jkt.all, r, 1, 1);
  if (front) {
    // wing collar + bow tie
    const wing = R.M().poly([[nx - 4, ny], [nx - 1, ny + 1], [nx - 3, ny + 3]]).add(R.M().poly([[nx + 4, ny], [nx + 1, ny + 1], [nx + 3, ny + 3]]));
    behindHead(R, wing); R.fill(wing, SNOW.lt);
    const bt = bow(R, nx, ny + 2, tie, .55, { tail: 0, w: 7 });
    cast(R, bt, R.M().rect(0, 0, 80, 100), [SNOW], 1, 1);
    // boutonniere + pocket square
    sprite(R, nx - 10, ny + 7, ['.LL.', 'LHBL', 'LBSL', '.LL.'], REDC);
    R.fill(R.M().set(nx - 10, ny + 10).set(nx - 11, ny + 11), LEAF.sh);
    R.stroke([[nx + 6, ny + 12], [nx + 10, ny + 12]], r.dp, jkt.body);
    sprite(R, nx + 6, ny + 10, ['L.L.L', 'HTBTS'], SNOW);
  }
});

// ---- Sailor Uniform: white middy blouse with a navy sailor collar banded in white braid, a red
// scarf knotted at the V, banded cuffs, a breast pocket, and a navy knife-pleated skirt with a
// notched hem. The collar's big square flap covers the back.
item('dress', 'school', 'Sailor Uniform', '#2c3a6b', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const W = SNOW, scarf = REDC, braid = ramp(mix(W.base, r.base, .08));
  // pleated skirt
  const G = skirtGeo(R, V.waistY, V.kneeY, 8, { hip: 2.5 });
  const P = pleatMap(G, side ? 6 : 8, null, { sewn: 5, phase: .5 });
  notchHem(G, P.crease);
  R.paint(G.m, r, { flat: true, round: 6, toneMap: skirtCel(G, { then: P.tm, waist: 0 }) });
  const hem = R.M(); G.m.each((x, y) => { if (!G.m.has(x, y + 2) && G.m.has(x, y + 1) && x % 3) hem.set(x, y); });
  deepen(R, hem, r, 1);
  skirtShadow(R, G.m, 3);
  // blouse, loose over the skirt waist
  const B = bodice(R, W, { sleeve: 'long', hem: V.waistY + 3, cut: front ? R.M().poly([[nx - 7, ny - 2], [nx + 7, ny - 2], [nx + 1, ny + 14], [nx - 1, ny + 14]]).add(neckCut(R, 'round')) : neckCut(R, 'round') });
  const hb = B.body.clone().add(B.body.clone().dilate(1).keep((x, y) => y >= V.waistY && y <= V.waistY + 3).sub(armHand(R)));
  const hemB = rows(hb, V.waistY + 1, V.waistY + 3);
  R.paint(hemB, W, { flat: true, round: 1.4, bias: .02 });
  cast(R, hemB, G.m, r, 0, 1);
  elbowFolds(R, B.sl, W);
  folds(R, B.body, W, view3(R, [[[31, 84], [32, 88], [34, 92], 2], [[49, 84], [48, 88], [46, 92], 2]], [[[22, 86], [24, 89], [27, 92], 2]], [[[33, 86], [35, 89], [37, 92], 2], [[47, 86], [46, 89], [44, 92], 2]]));
  if (front) { // dickie in the V + breast pocket
    const dk = R.M().poly([[nx - 6, ny - 1], [nx + 6, ny - 1], [nx + 1, ny + 12], [nx - 1, ny + 12]]).and(torsoM(R, 0, 99)).sub(neckCut(R, 'round'));
    R.paint(dk, r, { flat: true, lines: true, round: 1.5, bias: .05 });
    R.stroke([[nx - 2, ny + 4], [nx + 2, ny + 4]], braid.base, dk);
    const pk = R.M().rect(44, 82, 48, 86); R.stroke(R.curve([44, 82], [46, 82], [48, 82]), W.dp, B.body); R.stroke([[44, 83], [44, 86], [48, 83], [48, 86]], W.sh, B.body);
    R.stroke(R.curve([44, 87], [46, 87], [48, 87]), W.sh, B.body);
  }
  // banded cuffs
  const cf = armBand(R, V.handY - 4, V.handY - 1, r, { grow: 1 });
  for (const yy of [V.handY - 3, V.handY - 2]) if (yy === V.handY - 3) R.fill(rows(cf, yy, yy).and(erode(cf.clone().dilate(1))), braid.base);
  cast(R, cf, B.sl, W, 0, -1);
  // sailor collar
  let col;
  if (front) col = R.M().poly([[nx - 11, ny - 1], [nx - 6, ny - 1], [nx, ny + 12], [nx + 6, ny - 1], [nx + 11, ny - 1], [nx + 12, ny + 4], [nx + 3, ny + 15], [nx - 3, ny + 15], [nx - 12, ny + 4]]);
  else if (back) col = R.M().poly([[nx - 13, ny - 1], [nx + 13, ny - 1], [nx + 13, ny + 14], [nx - 13, ny + 14]]);
  else col = R.M().poly([[nx - 5, ny - 2], [nx + 3, ny - 2], [nx + 1, ny + 2], [nx - 5, ny + 10], [nx - 8, ny + 8]]).add(R.M().poly([[nx + 4, ny - 2], [nx + 15, ny - 2], [nx + 17, ny + 12], [nx + 7, ny + 12]]));
  behindHead(R, col);
  R.paint(col, r, { flat: true, round: 2.5, toneMap: cel(spans(R, col, false), { lit: [0, .3], dark: .8 }) });
  // two white braid stripes following the collar edge
  const e1 = erode(erode(col)), e2 = erode(e1), e3 = erode(e2);
  const sel = (x, y) => front ? y > ny : back ? true : x > nx + 3 || y > ny + 2;
  R.fill(e1.clone().sub(e2).keep(sel).keep((x, y) => !(front && y < ny + 2)), braid.base);
  R.fill(e3.clone().sub(erode(e3)).keep(sel).keep((x, y) => !(front && y < ny + 3)), braid.lt);
  cast(R, col, B.all, W, 1, 1);
  // red scarf knot + tails
  if (front) {
    const b = bow(R, nx, ny + 13, scarf, 1.05, { tail: 8, spread: .5 });
    cast(R, b, B.body, W, 1, 1);
  } else if (side) {
    const t = R.M().poly([[nx - 9, ny + 8], [nx - 6, ny + 9], [nx - 7, ny + 18], [nx - 10, ny + 17]]).and(B.body.clone().dilate(1));
    R.paint(t, scarf, { flat: true, round: 1.5 });
    R.paint(R.M().ellipse(nx - 7, ny + 9, 1.6, 1.6), scarf, { flat: true, round: 1, bias: .2 });
  }
});

// ---- Silk Qipao: mandarin collar and a curved diagonal opening piped in gold, knotted frog
// closures, cap sleeves, gold plum-blossom embroidery (a medallion on the back), a fitted
// column skirt with a gold-piped side slit and a double-line border above the hem.
const FROG = ['.LL.LL.', 'LHBLBSL', '.LL.LL.'];
function blossomBranch(R, pts, flowers, clip, rr = GOLDM) {
  for (let i = 0; i + 2 < pts.length; i += 2) R.stroke(R.curve(pts[i], pts[i + 1], pts[i + 2]), rr.dp, clip);
  for (const [x, y, big] of flowers) {
    const m = R.M().set(x - 1, y).set(x + 1, y).set(x, y - 1).set(x, y + 1);
    if (big) m.set(x - 1, y - 1).set(x + 1, y - 1).set(x - 1, y + 1).set(x + 1, y + 1);
    if (clip) m.and(clip);
    m.each((xx, yy) => px(R, xx, yy, xx < x || yy < y ? rr.hi : rr.base));
    if (big) R.fill(R.M().set(x + 1, y + 1).and(clip || m), rr.sh);
    if (!clip || clip.has(x, y)) px(R, x, y, REDC.base);
  }
}
item('dress', 'qipao', 'Silk Qipao', '#c8283c', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const G = skirtGeo(R, V.waistY, V.kneeY + 5, 3, { hip: 3, bell: .6, dip: 1, front: .4, back: .9 });
  // side slit: a narrow wedge open from above the knee
  const slit = view3(R, R.M().poly([[24.5, 103], [27.5, G.y1 + 2], [21, G.y1 + 2]]), R.M().poly([[31, 103], [34, G.y1 + 2], [28, G.y1 + 2]]), R.M().poly([[55.5, 103], [59, G.y1 + 2], [52.5, G.y1 + 2]]));
  G.m.sub(slit);
  const B = bodice(R, r, { sleeve: 'short', sleeveEnd: V.sleeveShort - 3, hem: V.waistY + 1, merge: { m: G.m, y0: G.y0, tm: skirtCel(G, { hi: [.18, .22], waist: 0 }) } });
  folds(R, G.m, r, view3(R, [[[33, 97], [32, 105], [31, 113], 2], [[47, 97], [48, 105], [49, 113], 2]], [[[25, 97], [24, 105], [24, 113], 2], [[42, 97], [44, 105], [46, 113], 2]], [[[34, 97], [33, 105], [32, 113], 2], [[46, 97], [47, 105], [48, 113], 2]]));
  const slitD = slit.clone().dilate(2);
  edgeTrim(R, G.m, GOLDM, 1, (x, y) => y > G.hemY(x) - 2 || slitD.has(x, y));
  // double-line border above the hem
  const bl = R.M(); G.m.each((x, y) => { const d = G.hemY(x) - y; if (Math.abs(d - 4) < .5 || Math.abs(d - 6) < .5) bl.set(x, y); });
  R.fill(bl.and(erode(G.m)).sub(slitD), GOLDM.sh);
  skirtShadow(R, G.m, 3);
  // satin sheen: a highlight streak down the lit side of the chest
  const sheen = B.body.clone().keep((x, y) => front ? Math.abs(x - (cx - 6 + (y - 76) * .1)) < .6 && y > 75 && y < 90 : side ? x === 23 && y > 78 && y < 90 : false);
  R.fill(sheen.and(erode(B.body)), r.hi);
  folds(R, B.body, r, view3(R, [[[31, 85], [33, 89], [35, 92], 2], [[49, 85], [47, 89], [45, 92], 2]], [[[22, 86], [24, 89], [27, 92], 2]], [[[33, 86], [35, 89], [37, 92], 2], [[47, 86], [45, 89], [43, 92], 2]]));
  edgeTrim(R, B.sl, GOLDM, 1, (x, y) => !B.sl.has(x, y + 1) || y >= B.se - 1);
  skinShadow(R, B.sl, 1);
  // mandarin collar
  const col = view3(R, R.M().rect(nx - 6, ny - 2, nx + 6, ny + 1), R.M().rect(nx - 5, ny - 2, nx + 6, ny + 1), R.M().rect(nx - 7, ny - 2, nx + 7, ny + 1));
  behindHead(R, col);
  R.paint(col, r, { flat: true, round: 1.4, bias: .08 });
  edgeTrim(R, col, GOLDM, 1, (x, y) => !col.has(x, y - 1) || !col.has(x, y + 1));
  cast(R, col, B.body, r, 0, 1);
  if (front) {
    // curved diagonal opening to the armpit, piped in gold, frog closures along it
    const op = R.curve([nx, ny + 2], [nx - 6, ny + 3], [29, 77]).concat(R.curve([29, 77], [29, 84], [29, 90]));
    R.stroke(op, GOLDM.base, B.body); R.stroke(op.map(([x, y]) => [x, y + 1]), r.line, B.body);
    R.stroke(op.map(([x, y]) => [x + 1, y + 2]), r.sh, B.body);
    sprite(R, nx - 1, ny - 1, FROG.map(row => row.slice(0, 5)), GOLDM);
    for (const [x, y] of [[nx - 7, ny + 3], [27, 79], [27, 85]]) sprite(R, x, y, FROG, GOLDM);
    blossomBranch(R, [[52, 88], [49, 83], [47, 78], [45, 75], [43, 73]], [[49, 81, 1], [45, 77, 0], [51, 86, 0], [44, 74, 1]], B.body);
    blossomBranch(R, [[25, 112], [29, 106], [33, 101], [36, 99], [38, 97]], [[29, 105, 1], [34, 100, 0], [26, 110, 0], [37, 98, 1]], erode(G.m));
  } else if (back) {
    const med = R.M().ellipse(cx, 81, 6, 6).sub(R.M().ellipse(cx, 81, 4.5, 4.5));
    R.fill(med.and(B.body), GOLDM.sh); R.fill(med.clone().keep((x, y) => x < cx && y < 81).and(B.body), GOLDM.base);
    blossomBranch(R, [[cx - 3, 84], [cx - 1, 81], [cx + 2, 78]], [[cx, 81, 1], [cx + 2, 78, 0], [cx - 3, 84, 0]], B.body);
    blossomBranch(R, [[55, 112], [51, 106], [47, 101]], [[51, 105, 1], [47, 101, 0], [54, 110, 0]], erode(G.m));
  } else {
    for (const y of [79, 85, 91]) sprite(R, 19, y, FROG.map(row => row.slice(2)), GOLDM);
    blossomBranch(R, [[22, 112], [26, 106], [29, 101]], [[26, 105, 1], [29, 101, 0], [23, 110, 0]], erode(G.m));
  }
  chinShadow(R, B.body, r);
});

// ---- Shinobi Garb: wrapped kimono top over a chain-mesh undershirt, a red obi with a side knot
// and hanging tails, forearm bandage wraps with steel guards, loose trousers bound into shin
// wraps, a scarf trailing behind, and a shuriken crest on the back.
item('dress', 'ninjagarb', 'Shinobi Garb', '#3a3f5c', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const SASH = ramp('#b8323e'), WRAP = ramp('#d8d2c4'), MESH = ramp('#8b8fa3', 'metal'), scarfR = ramp(mix(r.base, SASH.base, .55));
  // scarf tails streaming behind the body
  const st = view3(R, R.lock([cx + 6, 70], [cx + 22, 72], [cx + 34, 80], 5, 3).add(R.lock([cx + 6, 71], [cx + 20, 77], [cx + 28, 88], 4, 2.5)),
    R.lock([40, 70], [52, 72], [64, 78], 5, 3).add(R.lock([40, 71], [50, 77], [58, 86], 4, 2.5)), R.M());
  behindAll(R, st);
  R.paint(st, scarfR, { flat: true, round: 2, bias: -.1, toneMap: (x, y, t) => T5(t + (hash(x >> 1, y) < .2 ? 1 : 0)) });
  // trousers with shin wraps
  const legs = R.body((x, y, p) => (p === 'torso' && y >= V.waistY) || ((p === 'leg' || p === 'foot') && y <= V.footY));
  legs.add(legs.clone().dilate(1).keep((x, y) => y > V.crotchY && y < V.kneeY - 1).sub(armHand(R)));
  R.paint(legs, r, { lines: true, flat: true, round: 3, toneMap: cel(spans(R, legs), { lit: [.08, .36], dark: .72, minW: 3 }) });
  folds(R, legs, r, view3(R, [[[27, 104], [30, 103], [34, 104], 2], [[46, 104], [49, 103], [53, 104], 2]], [[[24, 106], [29, 105], [34, 106], 2]], [[[27, 104], [30, 103], [34, 104], 2], [[46, 104], [49, 103], [53, 104], 2]]));
  const wrap = R.body((x, y, p) => (p === 'leg' || p === 'foot') && y >= V.kneeY - 1 && y <= V.footY);
  R.paint(wrap, WRAP, { lines: true, flat: true, round: 2, toneMap: cel(spans(R, wrap), { lit: [.05, .35], dark: .74, minW: 3 }) });
  const cross = R.M(); wrap.each((x, y) => { if (((x + y) % 4 + 4) % 4 === 0 || ((x - y) % 6 + 6) % 6 === 0 && y % 2 === 0) cross.set(x, y); });
  deepen(R, cross.and(erode(wrap)), WRAP, 1);
  hemShadow(R, rows(legs, V.kneeY - 3, V.kneeY - 2), 1);
  cast(R, legs.clone().keep((x, y) => y < V.kneeY - 1), wrap, WRAP, 0, 1);
  // wrapped top (hip length) with a short wrap skirt
  const G = skirtGeo(R, V.waistY, V.crotchY + 1, 3, { hip: 2, dip: .5 });
  const B = bodice(R, r, { sleeve: 'long', hem: V.waistY + 1, cut: neckCut(R, 'v') });
  R.paint(G.m, r, { flat: true, round: 4, toneMap: skirtCel(G) });
  cast(R, G.m, legs, r, 0, 1);
  if (front) { // wrap overlap line on the skirt
    R.stroke(R.curve([36, V.waistY + 1], [33, 97], [30, G.y1]), r.line, G.m);
    R.stroke(R.curve([37, V.waistY + 1], [34, 97], [31, G.y1]), r.lt, G.m);
  }
  hemShadow(R, G.m, 2);
  // thigh holster: leather strap, a pouch and a kunai ring handle
  const hx = view3(R, [45, 56], [26, 40], [24, 35]);
  const strap = R.body((x, y, p) => p === 'leg' && y >= 104 && y <= 105 && x >= hx[0] && x <= hx[1]);
  R.paint(strap, LEATH, { flat: true, round: 1, shiny: true });
  if (!back) {
    const hp = view3(R, 50, 31, 0);
    const pouch = R.M().rect(hp - 2, 104, hp + 2, 108);
    R.paint(pouch, LEATH, { flat: true, round: 1.5, bias: .05 });
    R.fill(R.M().rect(hp - 2, 104, hp + 2, 105), LEATH.lt); R.fill(R.M().set(hp, 106), GOLDM.hi);
    cast(R, pouch, legs, [r], 1, 1);
    R.stroke([[hp + 3, 101], [hp + 3, 103]], SILVM.sh); R.fill(R.M().set(hp + 3, 101), SILVM.hi);
    R.fill(R.M().set(hp + 2, 100).set(hp + 4, 100).set(hp + 3, 99), SILVM.line);
  }
  elbowFolds(R, B.sl, r);
  chinShadow(R, B.body, r);
  if (front) { // chain-mesh undershirt in the V
    const vv = neckCut(R, 'v').and(R.body((x, y, p) => p === 'torso')).keep((x, y) => y >= ny + 1);
    R.paint(vv, MESH, { flat: true, lines: true, round: 1.5, pattern: (x, y) => ((x + y) % 3 === 0 || (x - y) % 3 === 0) ? ramp(MESH.sh, 'metal') : null });
  }
  // crossed collar band
  let col;
  if (front) col = R.M().poly([[nx + 4, ny - 1], [nx + 8, ny], [nx - 6, V.waistY - 2], [nx - 10, V.waistY - 3]]).add(R.M().poly([[nx - 8, ny], [nx - 4, ny - 1], [nx + 1.5, ny + 9], [nx - .5, ny + 10]]));
  else if (side) col = R.M().poly([[nx - 5, ny - 1], [nx + 6, ny - 2], [nx + 7, ny + 1], [nx - 3, ny + 2], [nx - 9, ny + 18], [nx - 11, ny + 16]]);
  else col = R.M().poly([[nx - 9, ny - 2], [nx + 9, ny - 2], [nx + 8, ny + 2], [nx - 8, ny + 2]]);
  behindHead(R, col); col.and(B.all.clone().dilate(1));
  R.paint(col, darker(r, .6), { flat: true, round: 1.4, bias: .05 });
  cast(R, col, B.all, r, 1, 1);
  // forearm wraps with a steel guard plate
  const fw = armBand(R, V.handY - 8, V.handY - 1, WRAP, { grow: 0, shadow: true });
  const fx = R.M(); fw.each((x, y) => { if (((x + y) % 3 + 3) % 3 === 0) fx.set(x, y); });
  deepen(R, fx.and(erode(fw)), WRAP, 1);
  cast(R, fw, B.sl, r, 0, -1);
  for (const [x0, x1] of view3(R, [[18, 22], [58, 62]], [[40, 45]], [[18, 22], [58, 62]])) {
    const pl = R.M().rect(x0, V.handY - 7, x1, V.handY - 4).and(fw.clone().dilate(1));
    R.paint(pl, SILVM, { flat: true, round: 1.4, shiny: true });
    R.stud(Math.round((x0 + x1) / 2), V.handY - 6, SILVM, 1);
  }
  // obi sash with a knot on the hip and hanging tails
  const obi = torsoM(R, V.waistY - 3, V.waistY + 2).sub(armHand(R));
  obi.add(obi.clone().dilate(1).keep((x, y) => y >= V.waistY - 3 && y <= V.waistY + 2).sub(armHand(R)));
  R.paint(obi, SASH, { flat: true, round: 1.8, toneMap: cel(spans(R, obi, false), { lit: [.05, .35], dark: .74 }) });
  R.stroke(rowPts(obi, V.waistY - 1), SASH.dp, obi);
  cast(R, obi, G.m.clone().add(B.body), [r], 0, 1);
  const kx = view3(R, 30, 22, 50);
  const tails = R.lock([kx, V.waistY + 1], [kx - 2, V.waistY + 7], [kx - 2, V.waistY + 14], 3.4, 2.6).add(R.lock([kx + 1, V.waistY + 1], [kx + 3, V.waistY + 6], [kx + 3, V.waistY + 12], 3, 2.2)).sub(armHand(R));
  R.paint(tails, SASH, { flat: true, round: 1.6, bias: -.05 });
  const kn = R.M().ellipse(kx, V.waistY, 2.4, 2.2);
  R.paint(kn, SASH, { flat: true, round: 1.6, bias: .15 });
  cast(R, tails.clone().add(kn), G.m.clone().add(legs), [r], 1, 1);
  // neck scarf
  const sc = view3(R, R.M().ellipse(nx, ny + 1, 8, 2.6), R.M().ellipse(nx + 1, ny + 1, 7, 2.6), R.M().ellipse(nx, ny, 9, 2.6));
  behindHead(R, sc);
  R.paint(sc, scarfR, { flat: true, round: 1.6, bias: .05 });
  skinShadow(R, sc, 1);
  if (back) { // shuriken crest
    const c = R.M().ellipse(cx, 79, 4, 4);
    R.paint(c, SNOW, { flat: true, round: 2, bias: -.05 });
    const sh = R.M().line(cx - 3, 79, cx + 3, 79).line(cx, 76, cx, 82).set(cx - 1, 78).set(cx + 1, 80).set(cx + 1, 78).set(cx - 1, 80);
    R.fill(sh, r.dp); R.fill(R.M().set(cx, 79), SNOW.base);
  }
});

// ---- Idol Stage Outfit: cropped bolero with puffed sleeves and white frills over a laced white
// corset, a big chest bow with a star brooch, a jewelled belt, a three-tier skirt (polka-dot top,
// white ruffle, pale petticoat with lace), frilly wrist cuffs, sequin glints and a big back bow.
const STAR7 = ['...L...', '..LHL..', 'LLLHTLL', 'LHTBBSL', '.LTBSL.', '.LBLSL.', 'LLL.LLL'];
item('dress', 'idol', 'Idol Stage Outfit', '#ff6fae', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, [nx, ny] = V.neck, side = isSide(R), back = isBack(R), front = isFront(R);
  const pale = ramp(mix(r.base, [255, 255, 255], .6)), W = SNOW;
  // tiers, bottom first
  const T3 = skirtGeo(R, V.waistY + 4, V.crotchY + 6, 15, { hip: 3, bell: .8 });
  frill(R, T3.m.keep((x, y) => y > T3.hemY(x) - 4), pale, { P: 3, round: 2 });
  const lace = laceHem(R, T3.m, W, 2, { P: 3, over: 0 });
  skirtShadow(R, T3.m.clone().add(lace), 3);
  const T2 = skirtGeo(R, V.waistY + 2, V.crotchY + 3, 14, { hip: 3, bell: .8 });
  const t2 = T2.m.clone().keep((x, y) => y > T2.hemY(x) - 4);
  frill(R, t2, W, { P: 3, round: 2, ph: 1 });
  cast(R, t2, T3.m, [pale], 0, 1);
  const G = skirtGeo(R, V.waistY, V.crotchY, 12, { hip: 3, bell: .8 });
  const gt = gathers(G, side ? 4 : 5, null);
  gt.wave();
  const dotP = (x, y) => { const j = Math.floor((y + 60) / 5), xx = (x + (j % 2) * 3 + 60) % 6, yy = (y + 60) % 5; return xx < 2 && yy < 2 && y > G.y0 + 2 ? W : null; };
  R.paint(G.m, r, { flat: true, round: 5, pattern: dotP, toneMap: skirtCel(G, { then: gt.tm }) });
  edgeTrim(R, G.m, GOLDM, 1, (x, y) => y > G.hemY(x) - 3);
  cast(R, G.m, t2, [W], 0, 1);
  glints(R, view3(R, [[22, 103, 1], [57, 104, 1], [44, 100]], [[17, 104, 1], [52, 103, 1]], [[23, 104, 1], [58, 103, 1], [36, 99]]), null, [255, 250, 220]);
  // white corset bodice with lacing
  const B = bodice(R, W, { sleeve: 'none', hem: V.waistY + 1, keep: (x, y) => y >= 72 });
  folds(R, B.body, W, view3(R, [[[31, 85], [32, 88], [34, 91], 2], [[49, 85], [48, 88], [46, 91], 2]], [[[22, 86], [24, 89], [27, 91], 2]], [[[33, 86], [35, 89], [37, 91], 2]]));
  if (front || back) {
    const cord = R.M();
    for (let y = 82; y <= 90; y += 2) cord.line(cx - 2, y, cx + 1, y + 1).line(cx + 2, y, cx - 1, y + 1);
    R.fill(cord.and(B.body), r.sh);
    for (let y = 81; y <= 91; y += 2) { px(R, cx - 3, y, GOLDM.hi, B.body); px(R, cx + 3, y, GOLDM.hi, B.body); }
  }
  // bolero with puffed sleeves and frill trim
  let bol = R.body((x, y, p) => (p === 'arm' && y <= V.sleeveShort) || (p === 'torso' && y <= 82));
  if (front) bol.sub(R.M().poly([[cx - 9, 66], [cx + 9, 66], [cx + 7, 83], [cx - 7, 83]]));
  else if (side) bol.keep((x, y) => R.part(x, y) === 'arm' || x > 27 || y < 74);
  else bol.keep((x, y) => y <= 78 || R.part(x, y) === 'arm');
  bol.sub(neckCut(R, 'round'));
  R.paint(bol, r, { lines: true, flat: true, round: 3, toneMap: cel(spans(R, bol), { lit: [.05, .36], dark: .74, minW: 3 }) });
  const PS = puffSleeves(R, r, { cy: 74 });
  cast(R, bol.clone().add(PS.puff), B.body, W, 1, 1);
  const fr = ring(bol, 1).and(B.body).keep((x, y) => y > 70);
  if (!side) frill(R, fr.add(fr.clone().dilate(1).and(B.body)), W, { P: 2, round: 1 });
  const cuff = armsM(R, PS.bottom, PS.bottom + 2).dilate(1).keep((x, y) => y >= PS.bottom && y <= PS.bottom + 2 && R.part(x, y) !== 'torso' && R.part(x, y) !== 'hand');
  frill(R, cuff, W, { P: 2, round: 1 });
  skinShadow(R, cuff, 1);
  // frilly wrist cuffs
  const wc = armsM(R, V.handY - 3, V.handY - 1).dilate(1).keep((x, y) => y >= V.handY - 3 && y <= V.handY - 1 && R.part(x, y) !== 'torso');
  frill(R, wc, W, { P: 2, round: 1 });
  R.fill(rows(wc, V.handY - 2, V.handY - 2).and(erode(wc.clone().dilate(1))), r.base);
  skinShadow(R, wc, 1);
  // jewelled belt with a star buckle
  const belt = torsoM(R, V.waistY - 1, V.waistY + 1).sub(armHand(R));
  metalBand(R, belt, GOLDM, 3);
  cast(R, belt, G.m, [r, W], 0, 1);
  if (front) sprite(R, cx - 3, V.waistY - 3, STAR7, GOLDM);
  // chest bow + star brooch
  if (front) {
    const b = bow(R, cx, 76, r, 1.3, { tail: 8, spread: 1 });
    cast(R, b, B.body, W, 1, 1);
    sprite(R, cx - 3, 73, STAR7, GOLDM);
    R.fill(R.M().set(cx, 76), SKY_GEM.base); R.fill(R.M().set(cx - 1, 75), [255, 255, 255]);
  } else if (back) {
    const b = bow(R, cx, V.waistY - 2, r, 2, { tail: 15, spread: 3 });
    cast(R, b, G.m.clone().add(B.body), [r, W], 1, 2);
    sprite(R, cx - 3, V.waistY - 5, STAR7, GOLDM);
  } else {
    const b = sideBow(R, 21, 77, r, 1, -1, { tail: 7 }); cast(R, b, B.body, W, 1, 1);
    const bb = sideBow(R, 50, V.waistY - 1, r, 1.5, 1, { tail: 14, clip: R.M().rect(-20, 0, 100, 140).sub(armHand(R)) });
    cast(R, bb, G.m, r, 1, 1);
  }
});
})();
