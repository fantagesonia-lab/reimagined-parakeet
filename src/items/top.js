// Pixie Closet wardrobe: top. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- TOP TOOLKIT ----------------
// Garments are built from separately painted pieces (body, sleeves, collar, cuffs, hem,
// trims) so every piece gets its own coloured outline and casts a small shadow.
const T5 = t => Math.max(0, Math.min(5, t));
// (side view: the chin's bottom outline row is labelled torso by the part map; never paint it)
const torsoM = (R, y0, y1) => R.body((x, y, p) => p === 'torso' && y >= y0 && y <= y1 && !(R.view === 'side' && y < 70 && x < 30));
const armsM = (R, y0, y1) => R.body((x, y, p) => p === 'arm' && y >= y0 && y <= y1);
const sleeveEnd = (R, kind) => kind === 'long' ? R.V.handY - 1 : kind === 'none' ? -1 : kind === 'elbow' ? R.V.sleeveShort + 4 : R.V.sleeveShort;
const skinOnly = R => (x, y) => R.isSkin(x, y);
const SKIN_SH = [.88, .74, .76];

// closest ramp tone of an already drawn pixel -> [ramp, tone, dist]
function nearTone(c, ramps) {
  let best = 1e9, br = null, bt = 0;
  for (const r of ramps) for (let t = 0; t < 7; t++) {
    const q = r.t[t], d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2;
    if (d < best) { best = d; br = r; bt = t; }
  }
  return [br, bt, best];
}
// Shift already-painted pixels of the given ramps darker (+) or lighter (-) by n tones.
// Keeps the hue-shifted ramp instead of a flat multiply, so shadows stay on-palette.
//  ramps: a ramp, a list of ramps, or (x, y) => ramp when a pattern decides the material per pixel.
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
const shifted = (R, m, dx, dy) => { const s = R.M(); m.each((x, y) => s.set(x + dx, y + dy)); return s; };
// Cast shadow of `piece` onto `under` (already painted with `ramps`), offset down-right.
function cast(R, piece, under, ramps, dx = 1, dy = 1, n = 1) {
  const s = shifted(R, piece, dx, dy); if (dy > 1) s.add(shifted(R, piece, Math.round(dx / 2), dy - 1));
  s.sub(piece); if (under) s.and(under);
  deepen(R, s, ramps, n);
}
// Shadow of a sleeve / hem onto bare skin just below it.
const skinShadow = (R, m, dy = 1, dx = 0) => R.shadow(m, { dx, dy, tint: SKIN_SH, only: skinOnly(R) });
// band of a mask between rows y0..y1
const rows = (m, y0, y1) => m.clone().keep((x, y) => y >= y0 && y <= y1);
// vertical rib knit: every other column one tone darker
const rib = (P = 2) => (x, y, t) => (((x % P) + P) % P === 0 ? T5(t + 1) : t);
// ring of width w around a mask (outside it), clipped
const ring = (m, w, clip) => { const o = m.clone().dilate(w).sub(m); return clip ? o.and(clip) : o; };
// a lighter / darker sister material of the dye (trims, linings)
const lighter = r => ramp(mix(r.base, r.hi, .55), r.kind);
const darker = r => ramp(r.sh, r.kind);
// shiny button with outline
function button(R, x, y, rr, size = 2) {
  rr = rr.t ? rr : ramp(rr);
  if (size >= 3) { R.paint(R.M().ellipse(x, y, 1.2, 1.2), rr, { flat: true, round: 1.5, shiny: true }); R.fill(R.M().set(x - 1, y - 1), rr.spec); return; }
  R.fill(R.M().rect(x, y, x + 1, y + 1), rr.base); R.fill(R.M().set(x, y), rr.hi); R.fill(R.M().set(x + 1, y + 1), rr.line);
}
// cylinder form shading for the torso: shadow side on the right, lit strip on the left
function form(R, then) {
  const cx = R.V.cx, side = isSide(R);
  return (x, y, t) => {
    if (!side && R.part(x, y) === 'torso') { const u = (x - cx) / 12; t = Math.max(1, Math.min(5, t + (u > .45 ? 1 : 0) + (u < -.62 && y < 90 ? -1 : 0))); }
    else if (side && R.part(x, y) === 'torso' && x <= 23) t = Math.max(1, t - 1);
    return then ? then(x, y, t) : t;
  };
}
// A cloth fold: a tapering wedge one tone darker with a darker core and a lit lip on its upper-left.
// Works over patterns because it shifts whatever ramp tone is already there.
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
const view3 = (R, f, s, b) => R.view === 'front' ? f : R.view === 'side' ? s : b;

// The basic shirt body: torso + sleeves as separate pieces. Returns the masks for detailing.
//  cfg: { sleeve: 'none'|'short'|'elbow'|'long', hem, neck: Mask (cut), loose: px, sleeveLoose }
function garment(R, r, cfg) {
  const V = R.V, hem = cfg.hem ?? V.waistY + 4, se = cfg.sleeveEnd ?? sleeveEnd(R, cfg.sleeve || 'short');
  let hands = null; const H = () => hands || (hands = R.body((x, y, p) => p === 'hand'));
  let body = torsoM(R, 0, hem);
  if (cfg.loose) { const g = body.clone().dilate(cfg.loose).keep((x, y) => y > V.torsoTop + 3 && y <= hem); body.add(g.sub(H())); }
  if (cfg.cut) body.sub(cfg.cut);
  if (cfg.keep) body.keep(cfg.keep);
  let sl = se > 0 ? armsM(R, 0, se) : R.M();
  if (cfg.sleeveLoose && se > 0) {
    const g = sl.clone().dilate(cfg.sleeveLoose).keep((x, y) => y > V.torsoTop + 4 && y <= se && R.part(x, y) !== 'torso' && R.part(x, y) !== 'head');
    sl.add(g.sub(H()));
  }
  if (cfg.cut) sl.sub(cfg.cut);
  const all = body.clone().add(sl);
  const fm = form(R, cfg.toneMap);
  const po = { lines: true, pattern: cfg.pattern, alt: cfg.alt, bias: cfg.bias, shiny: cfg.shiny };
  R.paint(all, r, { ...po, round: cfg.round ?? 6, toneMap: fm });
  if (se > 0) R.paint(sl, r, { ...po, round: cfg.sleeveRound ?? 4, edge: cfg.sleeveEdge, toneMap: cfg.toneMap });
  return { body, sl, all, se, hem };
}
// cuff / hem band painted over the bottom rows of a piece, with a stitch line and skin shadow.
function band(R, piece, y0, y1, rr, opt = {}) {
  const m = rows(piece, y0, y1);
  if (opt.grow) { m.add(m.clone().dilate(opt.grow).keep((x, y) => y >= y0 && y <= y1 + (opt.drop || 0)).sub(R.body((x, y, p) => p === 'hand' && !opt.overHand))); }
  R.paint(m, rr, { lines: !opt.grow, flat: !!opt.flat, round: opt.round ?? 1.6, toneMap: opt.rib ? rib(opt.rib) : opt.toneMap, bias: opt.bias });
  if (opt.stitch) R.stitch(pointsOf(m, y0 + (opt.stitchRow ?? 1)), opt.stitch, m, 1, 1);
  if (opt.shadow !== false) skinShadow(R, m, 1);
  return m;
}
const pointsOf = (m, y) => { const p = []; m.each((x, yy) => { if (yy === y) p.push([x, yy]); }); return p.filter(([x]) => m.has(x - 1, y) && m.has(x + 1, y)); };
// shadow under the chin on the upper chest
function chinShadow(R, under, ramps) {
  const [nx, ny] = R.V.neck;
  const m = view3(R, R.M().ellipse(nx, ny + 2, 7, 2.2), R.M().ellipse(nx + 1, ny + 1, 6, 2), R.M());
  deepen(R, m.and(under), ramps, 1);
}
// neckline helpers ------------------------------------------------------------
function crewCut(R, rx = 6, ry = 3) {
  const [nx, ny] = R.V.neck, m = R.M();
  if (isSide(R)) return m.ellipse(nx - 1, ny, rx - 1, ry);
  if (isBack(R)) return m.ellipse(nx, ny, rx, ry - 1);
  return m.ellipse(nx, ny, rx, ry);
}
function vCut(R, depth = 10, half = 6) {
  const [nx, ny] = R.V.neck, m = R.M();
  if (isSide(R)) return m.poly([[nx - 6, ny - 3], [nx + 5, ny - 3], [nx + 2, ny + 3], [nx - 4, ny + Math.min(6, depth / 2)]]);
  if (isBack(R)) return m.ellipse(nx, ny, half, 2);
  return m.poly([[nx - half - 1, ny - 2], [nx + half + 2, ny - 2], [nx + 1.5, ny + depth], [nx - .5, ny + depth]]);
}
// rib neckband / binding following a cut: shaded band whose outline is drawn only against the
// neckline and the outside of the garment, so the band itself stays visible.
const outerEdge = (m, clip) => m.clone().keep((x, y) => !clip.has(x - 1, y) || !clip.has(x + 1, y) || !clip.has(x, y - 1) || !clip.has(x, y + 1));
function neckband(R, r, cut, clip, w = 2, opt = {}) {
  const rr = opt.ramp || r, m = ring(cut, w, clip);
  R.paint(m, rr, { round: 1.5, toneMap: opt.rib === false ? null : rib(2), bias: opt.bias ?? .08, flat: true, noOutline: true });
  R.fill(outerEdge(m, clip), rr.line);
  return m;
}
// keep a piece behind the head (it may still wrap the neck skin)
const NECKTOP = { front: 65, side: 68, back: 65 };
const behindHead = (R, m) => m.keep((x, y) => R.part(x, y) !== 'head' || (y >= NECKTOP[R.view] && R.isSkin(x, y)));
const GOLDM = ramp('#f2c14e', 'metal'), SILVM = ramp('#d5dae6', 'metal'), BRASS = ramp('#d0913a', 'metal');
const LEATH = ramp('#8a5a3c', 'leather'), DLEATH = ramp('#5c3b2c', 'leather'), CREAM = ramp('#f6ead0');
const NAVY = ramp('#2c3a6b'), ORANGE = ramp('#f08a3c'), REDC = ramp('#e0475a'), SNOW = ramp('#f7f3f8');
// tiny hand-placed pixel sprite: rows of tone letters (L line, D dp, S sh, B base, T lt, H hi, W spec), '.' = skip
const TONE_KEY = { W: 0, H: 1, T: 2, B: 3, S: 4, D: 5, L: 6 };
function sprite(R, x0, y0, rowsTxt, rr, clip) {
  const m = R.M();
  rowsTxt.forEach((row, j) => [...row].forEach((c, i) => {
    if (c === '.' || (clip && !clip.has(x0 + i, y0 + j))) return;
    R.fill(R.M().set(x0 + i, y0 + j), rr.t[TONE_KEY[c]]); m.set(x0 + i, y0 + j);
  }));
  return m;
}
const BOW = ['LL...LL', 'LHL.LBL', 'LTBHBSL', 'LSL.LDL', 'LL.L.LL', '..L.L..'];
// metal buckle / clasp: bright frame with an outline, a prong in the middle and a white glint
function buckle(R, x0, y0, x1, y1, rr = GOLDM) {
  const m = R.M().rect(x0, y0, x1, y1);
  R.fill(m, rr.line);
  const inner = R.M().rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1);
  inner.each((x, y) => R.fill(R.M().set(x, y), (x === x0 + 1 || y === y0 + 1) ? rr.hi : (x === x1 - 1 || y === y1 - 1) ? rr.sh : rr.base));
  if (x1 - x0 >= 4 && y1 - y0 >= 4) R.fill(R.M().rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2), rr.dp);
  R.fill(R.M().set(x0 + 1, y0 + 1), [255, 255, 255]);
  return m;
}
// leather belt across the torso rows y0..y1, with a buckle at bx
function belt(R, y0, y1, rr, bx, clip, opt = {}) {
  let m = R.body((x, y, p) => (p === 'torso') && y >= y0 && y <= y1);
  if (opt.grow) m.add(m.clone().dilate(1).keep((x, y) => y >= y0 && y <= y1).sub(R.body((x, y, p) => p === 'hand' || p === 'arm')));
  if (clip) m.and(clip);
  R.paint(m, rr, { flat: true, round: 1.8, shiny: true, lines: true });
  R.stitch(pointsOf(m, y0 + 1), rr.lt, m, 1, 2);
  if (bx != null) { buckle(R, bx - 2, y0 - 1, bx + 2, y1 + 1, opt.buckle || GOLDM); }
  return m;
}
// shirt collar points + stand. Returns mask.
function pointCollar(R, rr, opt = {}) {
  const [nx, ny] = R.V.neck, m = R.M();
  const sp = opt.spread ?? 0;
  if (isFront(R)) {
    m.poly([[nx - 7 - sp, ny - 1], [nx - 3, ny], [nx, ny + 2.5], [nx - 4 - sp, ny + 7.5 + (opt.long || 0)], [nx - 8 - sp, ny + 3]]).mirror();
    m.add(R.M().poly([[nx - 6, ny - 2], [nx + 6, ny - 2], [nx + 6, ny + 1], [nx - 6, ny + 1]]));
  } else if (isSide(R)) {
    m.poly([[nx - 2, ny - 3], [nx + 9, ny - 3], [nx + 9, ny + 1], [nx - 1, ny + 2]]);
    m.poly([[nx - 3, ny - 1], [nx + 3, ny], [nx, ny + 6 + (opt.long || 0)], [nx - 6, ny + 4]]);
  } else m.poly([[nx - 8, ny - 2], [nx + 8, ny - 2], [nx + 10, ny + 3], [nx - 10, ny + 3]]);
  behindHead(R, m);
  R.paint(m, rr, { flat: true, round: 2.2, bias: .05, edge: (x, y) => (!m.has(x, y + 1) ? TONE.LINE : null) });
  if (isFront(R)) R.stroke([[nx, ny + 1], [nx, ny + 2]], rr.line);
  if (isBack(R)) R.stroke(R.curve([nx - 9, ny + 1], [nx, ny + 1], [nx + 9, ny + 1]), rr.sh, m);
  return m;
}
// vertical button placket with buttons
function placket(R, x, y0, y1, rr, btn, clip, step = 4) {
  const m = R.M().rect(x, y0, x + 1, y1); if (clip) m.and(clip);
  deepen(R, R.M().rect(x + 2, y0, x + 2, y1).and(clip || m.clone().dilate(2)), rr, 1);
  R.stroke(R.curve([x - 1, y0], [x - 1, (y0 + y1) / 2], [x - 1, y1]), rr.sh, clip);
  for (let y = y0 + 2; y <= y1 - 1; y += step) button(R, x, y, btn);
  return m;
}

// ---------------- TOPS ----------------
// Comfy Tee: crew neck rib, hemmed sleeves, drape folds, a sun patch on the chest.
function teeBase(R, r, cfg = {}) {
  const V = R.V, cut = cfg.cut || crewCut(R);
  const g = garment(R, r, { sleeve: cfg.sleeve || 'short', hem: cfg.hem ?? V.waistY + 4, cut, pattern: cfg.pattern, alt: cfg.alt, toneMap: cfg.toneMap, loose: cfg.loose, sleeveLoose: cfg.sleeveLoose });
  const ramps = cfg.pattern ? (x, y) => (cfg.pattern(x, y) ? cfg.alt : r) : [r];
  chinShadow(R, g.body, ramps);
  if (cfg.folds !== false) folds(R, g.body, ramps, view3(R,
    [[[30, 74], [31, 78], [35, 80], 2], [[50, 74], [49, 78], [45, 80], 2], [[30, 87], [31, 90], [33, 93], 2], [[50, 86], [49, 90], [47, 93], 2]],
    [[[23, 76], [24, 80], [27, 82], 2], [[22, 87], [24, 90], [27, 92], 2]],
    [[[31, 73], [33, 77], [37, 79], 2], [[49, 73], [47, 77], [43, 79], 2], [[32, 88], [34, 91], [37, 93], 2], [[48, 87], [47, 90], [45, 93], 2]]));
  folds(R, g.sl, ramps, view3(R, [[[28, 73], [26, 76], [25, 78], 2], [[52, 73], [55, 76], [56, 78], 2]], [[[33, 74], [36, 77], [36, 80], 2]], [[[28, 73], [26, 76], [25, 78], 2], [[52, 73], [55, 76], [56, 78], 2]]));
  const trim = cfg.trim || r;
  const neck = neckband(R, r, cut, g.all, 3, { ramp: trim });
  cast(R, neck, g.all, ramps, 1, 1);
  const se = g.se, cuff = band(R, g.sl, se - 3, se, trim, { round: 1.8, bias: .06 });
  R.stitch(pointsOf(cuff, se - 1), trim.sh, cuff, 1, 1);
  cast(R, cuff, g.sl, ramps, 0, -1);
  const hm = band(R, g.body, g.hem - 2, g.hem, r, { round: 1.4, bias: .04, shadow: false });
  return { ...g, cut, neck, cuff, hm, ramps };
}
item('top', 'tee', 'Comfy Tee', '#8cc8f2', (R, ph, r) => {
  if (ph !== 'front') return;
  const g = teeBase(R, r);
  if (isFront(R)) { // sun patch on the left chest
    const x = R.V.cx + 6, y = 80, sun = ramp('#ffd85a');
    const rays = R.M().line(x - 4, y, x + 4, y).line(x, y - 4, x, y + 4).line(x - 3, y - 3, x + 3, y + 3).line(x - 3, y + 3, x + 3, y - 3);
    R.fill(rays.and(g.body), sun.sh);
    R.paint(R.M().ellipse(x, y, 2, 2), sun, { flat: true, round: 2 });
    R.fill(R.M().set(x - 1, y - 1), sun.spec);
  } else if (isSide(R)) { // seam down the sleeve
    R.stitch(R.curve([38, 73], [38, 76], [38, 78]), r.sh, g.sl, 1, 1);
  }
});

// Tank Top: ribbed knit, bound scoop neck and armholes, little bow.
item('top', 'tank', 'Tank Top', '#f5d04a', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck;
  const cut = view3(R,
    R.M().ellipse(nx, ny, 5.5, 6).add(R.M().ellipse(28.5, 68, 3.5, 5).mirror()),
    R.M().ellipse(nx - 2, ny, 5, 3).add(R.M().rect(nx + 2, ny - 3, nx + 12, ny + 3)),
    R.M().ellipse(nx, ny, 6.5, 4).add(R.M().ellipse(28.5, 67, 3.5, 5).mirror()));
  const g = garment(R, r, { sleeve: 'none', hem: V.waistY + 4, cut, toneMap: rib(3) });
  if (isSide(R)) { const st = R.M().poly([[24.5, 78], [28, 78], [33.5, 70], [30.5, 69.5]]).and(torsoM(R, 0, 99)); R.paint(st, r, { lines: true, round: 2, toneMap: rib(3) }); g.body.add(st); }
  chinShadow(R, g.body, r);
  const bind = neckband(R, r, cut, isSide(R) ? g.body.clone().keep((x, y) => y >= 71) : g.body, 2, { ramp: lighter(r), rib: false });
  cast(R, bind, g.body, r, 1, 1);
  folds(R, g.body, r, view3(R,
    [[[33, 80], [35, 83], [38, 84], 2], [[48, 79], [46, 83], [43, 85], 2], [[31, 88], [32, 91], [34, 93], 2], [[50, 87], [49, 91], [47, 93], 2]],
    [[[22, 80], [24, 83], [27, 85], 2], [[22, 88], [24, 91], [27, 92], 2]],
    [[[33, 79], [36, 82], [39, 83], 2], [[48, 79], [46, 82], [43, 84], 2], [[32, 88], [34, 91], [37, 93], 2]]));
  band(R, g.body, g.hem - 2, g.hem, r, { round: 1.4, bias: .04, shadow: false });
  skinShadow(R, bind, 1, 1);
  if (isFront(R)) { // ribbon bow at the neckline
    const b = sprite(R, nx - 3, ny + 6, BOW, REDC);
    cast(R, b, g.body, r, 1, 1);
  } else if (isBack(R)) R.stitch(R.curve([nx - 3, ny + 6], [nx, ny + 7], [nx + 3, ny + 6]), r.sh, g.body, 1, 1);
});

// Marine Stripe: breton knit with a solid boat-neck yoke, elbow sleeves and an anchor badge.
item('top', 'stripe', 'Marine Stripe', '#3f6fd8', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, yoke = view3(R, 72, 74, 72);
  const cut = view3(R, R.M().ellipse(nx, ny - .5, 8.5, 2.6), R.M().ellipse(nx - 1, ny, 5, 3), R.M().ellipse(nx, ny, 9, 2));
  const pat = (x, y) => y < yoke || ((y - yoke) % 4 + 4) % 4 >= 2;
  const g = teeBase(R, r, { cut, sleeve: 'elbow', pattern: pat, alt: SNOW, trim: r, folds: false });
  if (isFront(R)) { // anchor badge
    const ax = 45, ay = 70, a = R.M();
    a.rect(ax, ay + 1, ax, ay + 6).rect(ax - 2, ay + 2, ax + 2, ay + 2).set(ax - 3, ay + 5).set(ax - 2, ay + 6).set(ax - 1, ay + 7).set(ax + 1, ay + 7).set(ax + 2, ay + 6).set(ax + 3, ay + 5).set(ax, ay);
    R.fill(a.and(g.body), REDC.sh); R.fill(R.M().set(ax, ay + 1).set(ax - 2, ay + 2), REDC.lt);
  }
});

// Crop Top: sweetheart neckline, shirred bodice, ruffle hem and ruffle cuffs, ribbon bow.
item('top', 'crop', 'Crop Top', '#f7a8c4', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, hem = view3(R, 82, 83, 82);
  const cut = view3(R, R.M().poly([[nx - 9, ny - 4], [nx + 9, ny - 4], [nx + 9, ny + 1], [nx + 5, ny + 1.5], [nx + 2, ny + 3], [nx + .5, ny + 5], [nx - .5, ny + 5], [nx - 2, ny + 3], [nx - 5, ny + 1.5], [nx - 9, ny + 1]]),
    R.M().ellipse(nx - 1, ny, 6, 3), R.M().ellipse(nx, ny, 9, 2.5));
  const g = garment(R, r, { sleeve: 'short', sleeveEnd: V.sleeveShort - 2, hem, cut });
  chinShadow(R, g.body, r);
  // shirring: wavy elastic rows
  const sh = R.M();
  for (const y0 of view3(R, [73, 77], [75, 79], [72, 76])) g.body.each((x, y) => { if (y === y0 + ((x % 4) < 2 ? 1 : 0)) sh.set(x, y); });
  deepen(R, sh, r, 1);
  const neck = neckband(R, r, cut, g.all, 2, { ramp: lighter(r), rib: false });
  cast(R, neck, g.body, r, 0, 1);
  // ruffle hem
  const rf = R.body((x, y, p) => p === 'torso' && y >= hem - 1 && y <= hem + 4);
  rf.add(rf.clone().dilate(1).keep((x, y) => y >= hem && y <= hem + 4)).sub(R.body((x, y, p) => p === 'arm' || p === 'hand'));
  rf.keep((x, y) => y <= hem + 4 - tri(x + 1, 4, 1.2));
  const pleat = (x, y, t) => T5(t + (x % 4 === 0 && y > hem ? 1 : 0));
  R.paint(rf, lighter(r), { flat: true, round: 2, toneMap: pleat });
  skinShadow(R, rf, 1);
  cast(R, rf, g.body, r, 0, -1);
  // ruffle cuffs
  const se = g.se, cf = rows(g.sl, se - 1, se);
  cf.add(cf.clone().dilate(1).keep((x, y) => y >= se - 1 && y <= se + 2 && R.part(x, y) !== 'torso')).keep((x, y) => y <= se + 2 - tri(x + 1, 4, 1.2));
  R.paint(cf, lighter(r), { flat: true, round: 1.5, toneMap: pleat });
  skinShadow(R, cf, 1);
  if (isFront(R)) { // bow at the sweetheart dip
    const b = sprite(R, nx - 3, ny + 3, BOW, REDC);
    cast(R, b, g.body, r, 1, 1);
  }
});

// Turtleneck: rolled rib collar, rib cuffs and hem, elbow folds, a pendant on a chain.
item('top', 'turtle', 'Turtleneck', '#b9a0ef', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck;
  const g = garment(R, r, { sleeve: 'long', hem: 95 });
  chinShadow(R, g.body, r);
  elbowFolds(R, g.sl, r);
  folds(R, g.body, r, view3(R,
    [[[30, 75], [32, 79], [35, 81], 2], [[50, 75], [48, 79], [45, 81], 2], [[31, 87], [32, 90], [34, 92], 2], [[49, 87], [48, 90], [46, 92], 2]],
    [[[22, 85], [24, 88], [27, 90], 2]],
    [[[31, 74], [34, 78], [37, 79], 2], [[49, 74], [46, 78], [43, 79], 2], [[32, 87], [34, 90], [37, 92], 2]]));
  ribBands(R, g, r, 3);
  // rolled collar: lower stand + folded roll
  const col = view3(R, R.M().poly([[nx - 6, ny - 2], [nx + 6, ny - 2], [nx + 8.5, ny + 4], [nx - 8.5, ny + 4]]),
    R.M().poly([[nx - 3, ny - 3], [nx + 8, ny - 3], [nx + 9, ny + 3], [nx - 4, ny + 3]]),
    R.M().poly([[nx - 7, ny - 1], [nx + 7, ny - 1], [nx + 9, ny + 4], [nx - 9, ny + 4]]));
  behindHead(R, col);
  R.paint(col, r, { flat: true, round: 2.5, toneMap: rib(2), bias: .05 });
  const roll = col.clone().keep((x, y) => y >= ny + 1);
  R.paint(roll, r, { flat: true, round: 1.6, toneMap: rib(2), bias: .12 });
  cast(R, col, g.all, r, 0, 1);
  if (isFront(R)) { // pendant
    const chain = R.curve([nx - 5, ny + 4], [nx, ny + 15], [nx + 5, ny + 4]);
    R.stitch(chain, GOLDM.base, g.body, 1, 1);
    R.stitch(chain.slice(1), GOLDM.dp, g.body, 1, 3);
    R.gem(nx, ny + 12, 1.5, ramp('#5fd1c9', 'gem'));
  }
});
function elbowFolds(R, sl, ramps) {
  folds(R, sl, ramps, view3(R,
    [[[20, 82], [23, 81], [26, 83], 2], [[22, 85], [24, 84], [27, 86], 2], [[54, 81], [57, 80], [60, 82], 2], [[54, 85], [56, 84], [59, 86], 2]],
    [[[34, 82], [37, 81], [41, 83], 2], [[35, 86], [38, 85], [42, 87], 2]],
    [[[20, 81], [23, 80], [26, 82], 2], [[21, 85], [24, 84], [27, 86], 2], [[54, 82], [57, 81], [60, 83], 2]]));
}
// rib cuffs + rib hem band
function ribBands(R, g, rr, h = 3, opt = {}) {
  const c = band(R, g.sl, g.se - h, g.se, rr, { rib: 2, round: 1.8, bias: .05, grow: opt.grow });
  cast(R, c, g.sl, rr, 0, -1);
  const hm = band(R, g.body, g.hem - h, g.hem, rr, { rib: 2, round: 1.8, bias: .05, shadow: true, grow: opt.grow });
  cast(R, hm, g.body, rr, 0, -1);
  return [c, hm];
}

// Cozy Knit: oversized cable sweater with rib collar, cuffs and hem.
item('top', 'sweater', 'Cozy Knit', '#f08a3c', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cut = crewCut(R, 5, 2.5);
  const g = garment(R, r, { sleeve: 'long', hem: 98, loose: 1, sleeveLoose: 1, cut });
  chinShadow(R, g.body, r);
  // cables: chevron braids flanked by purl channels
  const cables = view3(R, [V.cx, V.cx - 7, V.cx + 7], [24], [V.cx, V.cx - 7, V.cx + 7]);
  const up = R.M(), dn = R.M(), ch = R.M();
  for (const c of cables) g.body.each((x, y) => {
    const d = x - c; if (y < V.torsoTop + 3 || y > g.hem - 4) return;
    if (Math.abs(d) === 3) ch.set(x, y);
    else if (Math.abs(d) <= 2) { const v = ((y + Math.abs(d) * (d < 0 ? 1 : -1) + (d < 0 ? 0 : 2)) % 4 + 4) % 4; if (v === 0) up.set(x, y); else if (v === 2) dn.set(x, y); }
  });
  deepen(R, ch, r, 1); deepen(R, up, r, -1); deepen(R, dn, r, 1);
  elbowFolds(R, g.sl, r);
  const neck = neckband(R, r, cut, g.all, 3, { bias: .1 });
  cast(R, neck, g.all, r, 1, 1);
  ribBands(R, g, r, 3);
}, { layer: 'outer' });

// Hoodie: hood resting on the shoulders, drawstrings with metal aglets, kangaroo pocket, rib bands.
item('top', 'hoodie', 'Hoodie', '#7a8fa8', (R, ph, r) => {
  const V = R.V, [nx, ny] = V.neck, lin = ramp(r.sh);
  if (ph === 'back') {
    if (isSide(R)) { const h = R.M().poly([[nx + 4, ny - 8], [nx + 15, ny - 6], [nx + 18, ny + 4], [nx + 13, ny + 12], [nx + 5, ny + 8]]); R.paint(h, r, { flat: true, round: 4 }); }
    return;
  }
  const g = garment(R, r, { sleeve: 'long', hem: 99, loose: 1, cut: crewCut(R, 5, 2.5) });
  chinShadow(R, g.body, r);
  elbowFolds(R, g.sl, r);
  let hood;
  if (isFront(R)) {
    hood = R.M().ellipse(nx, ny + 1, 13, 5).sub(R.M().ellipse(nx, ny, 6.5, 3));
    behindHead(R, hood);
    R.paint(hood, r, { flat: true, round: 3 });
    const inner = R.M().ellipse(nx, ny + .5, 9, 3.5).sub(R.M().ellipse(nx, ny, 6.5, 3)).and(hood).keep((x, y) => y <= ny + 2);
    R.paint(inner, lin, { flat: true, round: 1.5, bias: -.15 });
    cast(R, hood, g.all, r, 0, 1);
    // drawstrings
    for (const sx of [nx - 3, nx + 3]) {
      const s = R.curve([sx, ny + 4], [sx + (sx < nx ? -1 : 1), ny + 8], [sx + (sx < nx ? -1 : 0), ny + 12]);
      R.stroke(s, SNOW.base, g.body); R.stroke(s.slice(-4).map(([x, y]) => [x + 1, y]), SNOW.sh, g.body);
      const [ex, ey] = s[s.length - 1]; R.fill(R.M().rect(ex, ey + 1, ex, ey + 2), SILVM.sh); R.fill(R.M().set(ex, ey + 1), SILVM.spec);
      R.fill(R.M().set(sx, ny + 3), r.dp);
    }
    // kangaroo pocket
    const pk = R.M().poly([[nx - 9, 87], [nx + 9, 87], [nx + 11, 95], [nx - 11, 95]]).and(g.body);
    R.paint(pk, r, { lines: true, round: 3, bias: .04 });
    const open = R.M().poly([[nx - 10, 87], [nx - 8, 87], [nx - 10, 95], [nx - 12, 95]]).poly([[nx + 8, 87], [nx + 10, 87], [nx + 12, 95], [nx + 10, 95]]).and(pk);
    R.fill(open, r.dp);
    R.stitch(R.curve([nx - 7, 88], [nx, 88], [nx + 7, 88]), r.sh, pk, 1, 1);
    cast(R, pk, g.body, r, 1, 1);
  } else if (isBack(R)) {
    hood = R.M().poly([[nx - 12, ny], [nx + 12, ny], [nx + 10, ny + 10], [nx + 4, ny + 17], [nx, ny + 18], [nx - 4, ny + 17], [nx - 10, ny + 10]]);
    behindHead(R, hood);
    R.paint(hood, r, { flat: true, round: 5 });
    const rim = R.M().ellipse(nx, ny, 11, 3).and(hood);
    R.paint(rim, lin, { flat: true, round: 1.5, bias: -.1 });
    R.crease([nx, ny + 4], [nx, ny + 11], [nx, ny + 17], r, hood, { tone: 4 });
    cast(R, hood, g.all, r, 1, 1);
  } else {
    hood = R.M().poly([[nx + 3, ny - 2], [nx + 13, ny - 2], [nx + 16, ny + 4], [nx + 12, ny + 11], [nx + 6, ny + 8], [nx + 3, ny + 3]]);
    behindHead(R, hood);
    R.paint(hood, r, { flat: true, round: 3 });
    R.crease([nx + 6, ny + 1], [nx + 10, ny + 4], [nx + 12, ny + 9], r, hood, { tone: 5 });
    const s = R.curve([nx - 2, ny + 3], [nx - 4, ny + 8], [nx - 4, ny + 12]); R.stroke(s, SNOW.base, g.body);
    R.fill(R.M().rect(nx - 4, ny + 13, nx - 4, ny + 14), SILVM.sh);
    // pocket edge
    R.stroke(R.curve([22, 87], [24, 91], [26, 96]), r.dp, g.body);
  }
  ribBands(R, g, r, 3);
}, { layer: 'outer' });

// Sailor Blouse: navy sailor collar with white braid, red neckerchief, puff sleeves with banded cuffs.
item('top', 'sailor', 'Sailor Blouse', '#f7f3f8', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck;
  const g = garment(R, r, { sleeve: 'short', sleeveEnd: V.sleeveShort - 1, cut: vCut(R, 12, 6), hem: V.waistY + 4 });
  if (isSide(R)) { // the square collar flap on the back peeks out behind the puff sleeve
    const fl = R.M().poly([[nx + 4, ny - 2], [nx + 15, ny - 2], [nx + 17, ny + 12], [nx + 7, ny + 12]]); behindHead(R, fl);
    R.paint(fl, NAVY, { flat: true, round: 2.5 });
    R.stroke(R.curve([nx + 14, ny - 1], [nx + 15, ny + 5], [nx + 15, ny + 10]), SNOW.base, fl);
    R.stroke(R.curve([nx + 8, ny + 10], [nx + 12, ny + 10], [nx + 15, ny + 10]), SNOW.base, fl);
  }
  // puff sleeves
  const pf = view3(R, R.M().ellipse(23, 74, 6.5, 5.5).add(R.M().ellipse(57, 74, 6.5, 5.5)), R.M().ellipse(38, 76, 8, 5.5), R.M().ellipse(23, 74, 6.5, 5.5).add(R.M().ellipse(57, 74, 6.5, 5.5)));
  behindHead(R, pf); pf.sub(R.body((x, y, p) => p === 'torso' && !isSide(R)));
  R.paint(pf, r, { flat: true, round: 4, toneMap: (x, y, t) => T5(t + ((x % 3) === 0 && y > 73 ? 1 : 0)) });
  const pc = rows(g.sl, V.sleeveShort - 3, V.sleeveShort - 1);
  R.paint(pc, NAVY, { round: 1.4, lines: true });
  R.stroke(pointsOf(pc, V.sleeveShort - 2), SNOW.base, pc);
  skinShadow(R, pc, 1);
  folds(R, g.body, r, view3(R, [[[31, 84], [32, 88], [34, 91], 2], [[49, 84], [48, 88], [46, 91], 2]], [[[22, 86], [24, 89], [27, 91], 2]], [[[33, 86], [35, 89], [37, 91], 2], [[47, 86], [46, 89], [44, 91], 2]]));
  band(R, g.body, g.hem - 2, g.hem, r, { round: 1.4, bias: .04, shadow: false });
  let col;
  if (isFront(R)) {
    col = R.M().poly([[nx - 11, ny - 1], [nx - 6, ny - 1], [nx, ny + 11], [nx + 6, ny - 1], [nx + 11, ny - 1], [nx + 12, ny + 4], [nx + 3, ny + 15], [nx - 3, ny + 15], [nx - 12, ny + 4]]);
    behindHead(R, col);
    R.paint(col, NAVY, { flat: true, round: 2.5 });
    for (const k of [2, 4]) { // two white braid stripes along the collar edges
      const s = R.curve([nx - 12 + k, ny + 2], [nx - 6 + k * .2, ny + 9], [nx - 1, ny + 15 - k]).concat(R.curve([nx + 12 - k, ny + 2], [nx + 6 - k * .2, ny + 9], [nx + 1, ny + 15 - k]));
      R.stroke(s, SNOW.base, col);
    }
    cast(R, col, g.all, r, 1, 1);
    // neckerchief knot + bow + tails
    const bow = R.M().poly([[nx - 6, ny + 11], [nx, ny + 13], [nx - 6, ny + 16]]).poly([[nx + 6, ny + 11], [nx, ny + 13], [nx + 6, ny + 16]]);
    const tails = R.M().poly([[nx - 1, ny + 14], [nx - 4, ny + 21], [nx - 2, ny + 22], [nx, ny + 16]]).poly([[nx + 1, ny + 14], [nx + 4, ny + 21], [nx + 2, ny + 22], [nx, ny + 16]]);
    R.paint(tails, REDC, { flat: true, round: 1.5 });
    R.paint(bow, REDC, { flat: true, round: 2 });
    R.paint(R.M().rect(nx - 1, ny + 12, nx + 1, ny + 14), REDC, { flat: true, round: 1, bias: .2 });
    R.fill(R.M().set(nx - 4, ny + 13).set(nx + 3, ny + 13), REDC.dp);
    cast(R, bow.clone().add(tails), g.body, r, 1, 1);
  } else if (isBack(R)) {
    col = R.M().poly([[nx - 13, ny - 1], [nx + 13, ny - 1], [nx + 13, ny + 13], [nx - 13, ny + 13]]);
    behindHead(R, col);
    R.paint(col, NAVY, { flat: true, round: 3 });
    for (const k of [2, 4]) R.stroke(R.curve([nx - 13 + k, ny], [nx - 13 + k, ny + 13 - k], [nx - 13 + k, ny + 13 - k]).concat(R.curve([nx - 13 + k, ny + 13 - k], [nx, ny + 13 - k], [nx + 13 - k, ny + 13 - k])).concat(R.curve([nx + 13 - k, ny + 13 - k], [nx + 13 - k, ny + 5], [nx + 13 - k, ny])), SNOW.base, col);
    cast(R, col, g.all, r, 0, 1);
  } else {
    col = R.M().poly([[nx - 5, ny - 2], [nx + 3, ny - 2], [nx + 1, ny + 2], [nx - 5, ny + 10], [nx - 8, ny + 8]]);
    behindHead(R, col);
    R.paint(col, NAVY, { flat: true, round: 2 });
    R.stroke(R.curve([nx, ny], [nx - 3, ny + 5], [nx - 6, ny + 8]), SNOW.base, col);
    cast(R, col, g.all, r, 1, 1);
    const tail = R.M().poly([[nx - 9, ny + 7], [nx - 6, ny + 8], [nx - 7, ny + 17], [nx - 10, ny + 16]]).and(g.body.clone().dilate(1));
    R.paint(tail, REDC, { flat: true, round: 1.5 });
    R.paint(R.M().ellipse(nx - 8, ny + 8, 1.5, 1.5), REDC, { flat: true, round: 1, bias: .2 });
    cast(R, tail, g.body, r, 1, 1);
  }
});

// Button-Up: pointed collar, button placket, breast pocket, rolled cuffs, striped school tie.
item('top', 'shirt', 'Button-Up', '#f7f3f8', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, btn = ramp(mix(r.base, [255, 255, 255], .5));
  const g = garment(R, r, { sleeve: 'short', cut: vCut(R, 6, 5) });
  chinShadow(R, g.body, r);
  folds(R, g.body, r, view3(R,
    [[[30, 75], [32, 79], [35, 81], 2], [[50, 75], [48, 79], [46, 81], 2], [[31, 87], [32, 90], [34, 93], 2], [[49, 86], [48, 90], [46, 93], 2]],
    [[[23, 77], [24, 81], [27, 83], 2], [[22, 87], [24, 90], [27, 92], 2]],
    [[[32, 86], [34, 89], [36, 92], 2], [[48, 86], [46, 89], [44, 92], 2]]));
  folds(R, g.sl, r, view3(R, [[[28, 73], [26, 76], [25, 78], 2], [[52, 73], [55, 76], [56, 78], 2]], [[[33, 74], [36, 77], [36, 79], 2]], [[[28, 73], [26, 76], [25, 78], 2], [[52, 73], [55, 76], [56, 78], 2]]));
  // rolled cuffs
  const cf = band(R, g.sl, g.se - 3, g.se, r, { round: 1.6, bias: .08 });
  R.stroke(pointsOf(cf, g.se - 2), r.sh, cf);
  cast(R, cf, g.sl, r, 0, -1);
  if (isFront(R)) {
    placket(R, nx, ny + 6, 96, r, btn, g.body);
    // breast pocket (wearer's left)
    const pk = R.M().poly([[44, 76], [49, 76], [49, 81], [46.5, 82], [44, 81]]);
    R.paint(pk.and(g.body), r, { lines: true, round: 2, bias: .03 });
    R.stroke(R.curve([45, 77], [46.5, 77], [48, 77]), r.sh, pk);
    cast(R, pk, g.body, r, 1, 1);
  } else if (isBack(R)) {
    R.stroke(R.curve([28, 74], [40, 75], [52, 74]), r.dp, g.body); // yoke seam
    R.stroke(R.curve([28, 73], [40, 74], [52, 73]), r.hi, g.body);
    R.stitch(R.curve([28, 75], [40, 76], [52, 75]), r.sh, g.body, 1, 1);
    deepen(R, R.M().rect(38, 76, 38, 84).rect(42, 76, 42, 84), r, 2); // box pleat
    deepen(R, R.M().rect(39, 76, 41, 79), r, 1);
  } else {
    R.stroke(R.curve([22, 74], [22, 85], [21, 96]), r.sh, g.body);
    for (let y = 77; y < 96; y += 5) button(R, 21, y, btn);
  }
  // necktie
  const tie = ramp('#e0475a');
  let t;
  if (isFront(R)) {
    t = R.M().poly([[nx - 2, ny + 4], [nx + 2, ny + 4], [nx + 3.5, ny + 18], [nx, ny + 21], [nx - 3.5, ny + 18]]);
    R.paint(t, tie, { round: 2 });
    const st = R.M(); t.each((x, y) => { if ((x + y) % 4 === 0 && y > ny + 6 && t.has(x - 1, y) && t.has(x + 1, y) && t.has(x, y + 1)) st.set(x, y); });
    R.fill(st, NAVY.lt);
    R.paint(R.M().poly([[nx - 2, ny + 1], [nx + 2, ny + 1], [nx + 1.5, ny + 4], [nx - 1.5, ny + 4]]), tie, { flat: true, round: 1.5, bias: .1 });
    cast(R, t, g.body, r, 1, 1);
  } else if (isSide(R)) {
    t = R.M().poly([[nx - 9, ny + 4], [nx - 7, ny + 4], [nx - 9, ny + 18], [nx - 11, ny + 17]]).and(R.body(() => true).dilate(1));
    R.paint(t, tie, { round: 1.5 });
  }
  const col = pointCollar(R, r);
  cast(R, col, g.all, r, 1, 1, 2);
});

// rows of a mask -> stitch line `off` px inside its left (dir -1) or right (dir 1) edge
// per-row horizontal extent of a mask in one pass: { y: [minX, maxX] }
function spans(m) { const s = {}; m.each((x, y) => { const v = s[y]; if (!v) s[y] = [x, x]; else { if (x < v[0]) v[0] = x; if (x > v[1]) v[1] = x; } }); return s; }
function edgePts(m, y0, y1, dir, off) {
  const sp = spans(m), pts = [];
  for (let y = y0; y <= y1; y++) if (sp[y]) pts.push([(dir > 0 ? sp[y][1] : sp[y][0]) - dir * off, y]);
  return pts;
}

// Denim Jacket: open over a striped tee, turned-down collar, flap pockets with copper buttons,
// gold topstitching on every seam, waistband and buttoned cuffs.
item('top', 'jacket', 'Denim Jacket', '#4d74b8', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, top = ramp('#e9a23b'), TS = top.base;
  const tor = torsoM(R, 0, 98);
  const gap = view3(R, R.M().poly([[nx - 5, ny - 2], [nx + 5, ny - 2], [nx + 3.5, 99], [nx - 3.5, 99]]), R.M().poly([[17, ny - 2], [26.5, ny - 2], [24.5, 99], [17, 99]]), R.M()).and(tor);
  const g = garment(R, r, { sleeve: 'long', hem: 98, loose: 1, sleeveLoose: 0, cut: gap.clone().add(crewCut(R, 6, 3)) });
  const ins = gap.clone().sub(crewCut(R, 5, 2.5));
  if (!ins.empty()) {
    R.paint(ins, SNOW, { lines: true, round: 3, pattern: (x, y) => y % 3 === 0, alt: REDC, flat: isSide(R) });
    if (isFront(R)) cast(R, g.body, ins, (x, y) => (y % 3 === 0 ? REDC : SNOW), 1, 0);
    neckband(R, SNOW, crewCut(R, 5, 2.5), ins, 2, { rib: false });
  }
  elbowFolds(R, g.sl, r);
  // waistband + cuffs
  const wb = band(R, g.body, 95, 98, r, { round: 1.6, bias: .06, shadow: false });
  R.stitch(pointsOf(wb, 96), TS, wb, 1, 1);
  cast(R, wb, g.body, r, 0, -1);
  const cf = band(R, g.sl, g.se - 3, g.se, r, { round: 1.6, bias: .06 });
  R.stitch(pointsOf(cf, g.se - 2), TS, cf, 1, 1);
  cast(R, cf, g.sl, r, 0, -1);
  if (isFront(R)) {
    // yoke + front edge topstitching
    R.stitch(R.curve([29, 74], [33, 75], [35, 75]).concat(R.curve([45, 75], [47, 75], [51, 74])), TS, g.body, 1, 1);
    R.stitch(edgePts(R.M().add(g.body).keep((x) => x < nx), 68, 94, 1, 1), TS, g.body, 1, 1);
    R.stitch(edgePts(R.M().add(g.body).keep((x) => x > nx), 68, 94, -1, 1), TS, g.body, 1, 1);
    // pleat seams
    for (const x of [32, 48]) R.stitch(R.curve([x, 82], [x, 88], [x, 94]), TS, g.body, 1, 1);
    // flap pockets
    const fl = R.M().poly([[29.5, 77], [35.5, 77], [35.5, 79.5], [32.5, 81.5], [29.5, 79.5]]).mirror();
    R.paint(fl.and(g.body), r, { lines: true, round: 1.8, bias: .08 });
    cast(R, fl, g.body, r, 1, 1);
    R.stitch(R.curve([30, 79], [32.5, 80.5], [35, 79]).concat(R.curve([45, 79], [47.5, 80.5], [50, 79])), TS, fl, 1, 1);
    for (const x of [32, 47]) button(R, x, 79, BRASS);
    for (const x of [33, 46]) button(R, x, 96, BRASS);
    const col = R.M().poly([[nx - 11, ny + 1], [nx - 6, ny - 2], [nx - 5, ny + 2], [nx - 4, ny + 9], [nx - 8, ny + 6]]).mirror().add(R.M().rect(nx - 6, ny - 2, nx + 6, ny));
    behindHead(R, col);
    R.paint(col, r, { flat: true, round: 2, bias: .1 });
    R.stitch(R.curve([nx - 10, ny + 2], [nx - 7, ny + 4], [nx - 5, ny + 7]).concat(R.curve([nx + 10, ny + 2], [nx + 7, ny + 4], [nx + 5, ny + 7])), TS, col, 1, 1);
    cast(R, col, g.all, [r, SNOW, REDC], 1, 1);
  } else if (isBack(R)) {
    R.stitch(R.curve([28, 75], [40, 76], [52, 75]), TS, g.body, 1, 1);
    R.stroke(R.curve([28, 74], [40, 75], [52, 74]), r.dp, g.body);
    for (const x of [33, 47]) { R.stroke(R.curve([x, 76], [x, 85], [x, 94]), r.dp, g.body); R.stitch(R.curve([x + 1, 76], [x + 1, 85], [x + 1, 94]), TS, g.body, 1, 1); }
    for (const x of [30, 49]) { R.paint(R.M().rect(x, 95, x + 2, 97), r, { flat: true, round: 1 }); button(R, x + 1, 96, BRASS); }
    const col = R.M().poly([[nx - 10, ny - 1], [nx + 10, ny - 1], [nx + 11, ny + 3], [nx - 11, ny + 3]]);
    behindHead(R, col); R.paint(col, r, { flat: true, round: 1.6, bias: .1 });
    R.stitch(pointsOf(col, ny + 2), TS, col, 1, 1);
    cast(R, col, g.all, r, 0, 1);
  } else {
    R.stitch(R.curve([24, 74], [27, 75], [29, 75]), TS, g.body, 1, 1);
    R.stitch(edgePts(g.body.clone().keep((x) => x < 30), 70, 94, -1, 1), TS, g.body, 1, 1);
    const fl = R.M().poly([[23, 77], [28, 77], [28, 79], [25.5, 81], [23, 79]]);
    R.paint(fl.and(g.body), r, { lines: true, round: 1.8, bias: .08 }); button(R, 25, 79, BRASS);
    R.stroke(R.curve([31, 73], [37, 72], [43, 73]), r.dp, g.sl);
    R.stitch(R.curve([31, 74], [37, 73], [43, 74]), TS, g.sl, 1, 1);
    const col = R.M().poly([[nx - 6, ny - 2], [nx + 10, ny - 3], [nx + 11, ny + 2], [nx + 3, ny + 3], [nx - 2, ny + 7], [nx - 7, ny + 5]]);
    behindHead(R, col); R.paint(col, r, { flat: true, round: 2, bias: .1 });
    cast(R, col, g.all, r, 1, 1);
  }
}, { layer: 'outer' });

// Knight Plate: steel breastplate with a ridge and gold trims, layered pauldrons with rivets,
// gorget, chainmail sleeves, leather belt and a skirt of overlapping tassets.
item('top', 'armor', 'Knight Plate', '#c9cfdc', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, mail = ramp(mix(r.base, [120, 126, 140], .55), 'metal');
  const mailMap = (x, y, t) => T5(t + ((((x + ((y >> 1) & 1) * 2) & 3) < 2) === ((y & 1) === 0) ? 0 : 1));
  // mail shirt (under everything)
  const mm = torsoM(R, 0, 97).add(armsM(R, 0, V.sleeveShort + 4));
  R.paint(mm, mail, { lines: true, round: 4, toneMap: mailMap });
  const ma = armsM(R, 0, V.sleeveShort + 4);
  R.paint(ma, mail, { lines: true, round: 3, toneMap: mailMap });
  skinShadow(R, ma, 1);
  // breast / back plate
  const plate = torsoM(R, 0, 89).sub(crewCut(R, 6, 3)).add(R.M());
  if (isSide(R)) plate.keep((x, y) => y >= 72);
  R.paint(plate, r, { lines: !isSide(R), round: isSide(R) ? 5 : 6, toneMap: form(R), flat: isSide(R) });
  if (!isSide(R)) { // central ridge
    deepen(R, R.M().rect(nx - 1, ny + 5, nx - 1, 87), r, -2);
    deepen(R, R.M().rect(nx + 1, ny + 5, nx + 1, 87), r, 1);
    R.stroke([[nx, ny + 5]].concat(R.curve([nx, ny + 6], [nx, 80], [nx, 87])), r.sh, plate);
    R.fill(R.M().set(nx - 1, ny + 8).set(nx - 1, ny + 9), r.spec);
  } else {
    deepen(R, R.M().rect(22, 73, 22, 86), r, -2);
  }
  // gold trim along plate bottom
  const trim = rows(plate, 87, 89);
  R.paint(trim, GOLDM, { lines: true, round: 1.4 });
  // emblem
  if (isFront(R)) {
    const sh = R.M().poly([[nx - 4, 74], [nx + 4, 74], [nx + 4, 79], [nx + .5, 83], [nx - .5, 83], [nx - 4, 79]]);
    R.paint(sh, REDC, { flat: true, round: 2 });
    R.fill(R.M().rect(nx, 75, nx, 81).rect(nx - 2, 77, nx + 2, 77), GOLDM.lt);
    R.fill(R.M().set(nx, 75).set(nx - 2, 77), GOLDM.spec);
    cast(R, sh, plate, r, 1, 1);
  } else if (isBack(R)) {
    for (const [x, y] of [[33, 72], [46, 72], [33, 84], [46, 84]]) R.stud(x, y, GOLDM);
  }
  // belt + buckle
  belt(R, 89, 91, LEATH, isSide(R) ? 24 : isFront(R) ? nx : null, null, { grow: true });
  // tassets: a pair of hinged plates over each hip (lower lame first, upper one overlaps it)
  const tz = view3(R, [[27, 39], [41, 53]], [[19, 31]], [[27, 39], [41, 53]]);
  const hands = R.body((x, y, p) => p === 'hand');
  for (const [xa, xb] of tz) for (const [y0, y1, d] of [[95, 99, 1], [91, 96, 0]]) {
    const t = R.M().poly([[xa - d, y0], [xb + 1 + d, y0], [xb + 1 + d, y1 - 1], [xb + d, y1 + 1], [xa + 1 - d, y1 + 1], [xa - d, y1 - 1]]).sub(hands);
    R.paint(t, r, { flat: true, round: 2.4 });
    if (d) { const e = R.M(); t.each((x, y) => { if (!t.has(x, y + 1) && t.has(x - 1, y) && t.has(x + 1, y)) e.set(x, y - 1); }); R.fill(e.and(t), GOLDM.base); }
    R.stud(xa + 1, y0 + 1, GOLDM, 1); R.stud(xb - 1, y0 + 1, GOLDM, 1);
    R.shadow(t, { dx: 0, dy: 1, tint: [.75, .74, .84], only: (x, y) => !t.has(x, y) });
  }
  // gorget
  const gor = view3(R, R.M().poly([[nx - 7, ny - 2], [nx + 7, ny - 2], [nx + 10, ny + 4], [nx - 10, ny + 4]]),
    R.M().poly([[nx - 4, ny - 3], [nx + 9, ny - 3], [nx + 10, ny + 3], [nx - 5, ny + 3]]),
    R.M().poly([[nx - 8, ny - 1], [nx + 8, ny - 1], [nx + 10, ny + 4], [nx - 10, ny + 4]]));
  behindHead(R, gor);
  R.paint(gor, r, { flat: true, round: 2.5 });
  R.fill(pointsOf(gor, ny + 3).reduce((m, [x, y]) => m.set(x, y), R.M()), GOLDM.base);
  R.fill(pointsOf(gor, ny + 3).filter(([x]) => x % 4 === 0).reduce((m, [x, y]) => m.set(x, y), R.M()), GOLDM.spec);
  cast(R, gor, plate, r, 1, 1);
  // pauldrons: a lower lame under a big domed cap with a gold rim, rivets and a specular glint
  const pads = isSide(R) ? [[38, 1]] : [[22, -1], [58, 1]];
  for (const [px, s] of pads) {
    const low = R.M().ellipse(px + s, 79.5, 6, 2.6); behindHead(R, low);
    R.paint(low, r, { flat: true, round: 2 });
    const le = R.M(); low.each((x, y) => { if (!low.has(x, y + 1) && low.has(x - 1, y) && low.has(x + 1, y)) le.set(x, y - 1); }); R.fill(le.and(low), GOLDM.sh);
    const dome = R.M().ellipse(px, 73, 7.5, 5.8).keep((x, y) => y <= 77); behindHead(R, dome);
    R.paint(dome, r, { flat: true, round: 4.5 });
    const rim = dome.clone().keep((x, y) => !dome.has(x, y + 2) || !dome.has(x - 2 * s, y + 1) && y > 74);
    R.paint(rim, GOLDM, { flat: true, round: 1.2, shiny: true, noOutline: true });
    R.fill(outerEdge(rim, dome), GOLDM.line);
    R.shadow(dome, { dx: 0, dy: 1, tint: [.7, .7, .82], only: (x, y) => !dome.has(x, y) });
    for (const x of [px - 4, px, px + 4]) if (rim.has(x, 76)) R.fill(R.M().set(x, 76), GOLDM.spec);
    R.stud(px - 1, 71, GOLDM);
    R.stroke(R.curve([px - 5, 72], [px - 4, 69], [px - 1, 68.5]), r.spec, dome);
  }
}, { layer: 'outer', kind: 'metal' });

// Maple Tee: white ringer tee with orange trims and a big veined maple leaf print.
function mapleLeaf(R, cx, cy, k, clip) {
  const half = [[0, -6.5], [1.6, -3.2], [4.2, -4.8], [3.6, -1.4], [6.8, -.6], [4.6, 1.4], [5.8, 3.8], [2.2, 2.8], [.9, 4.4]];
  const pts = half.map(([x, y]) => [cx + x * k, cy + y * k]).concat(half.slice().reverse().map(([x, y]) => [cx - x * k, cy + y * k]));
  const m = R.M().poly(pts).add(R.M().rect(cx, cy + 3 * k, cx, cy + 6.5 * k));
  if (clip) m.and(clip);
  if (k >= .8) {
    R.paint(m, ORANGE, { flat: true, round: 3 });
    for (const [x, y] of [[0, -5], [4, -3.5], [-4, -3.5], [5, 2.5], [-5, 2.5]]) R.stroke(R.curve([cx, cy + 2], [cx + x * k * .5, cy + y * k * .6], [cx + x * k * .9, cy + y * k * .9]), ORANGE.sh, m);
    R.fill(R.M().set(cx - 2, cy - 2).set(cx - 1, cy - 4).set(cx - 4, cy), ORANGE.hi);
  } else {
    m.a.fill(0);
    const rowsL = ['..#..', '#.#.#', '#####', '.###.', '..#..'];
    rowsL.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') m.set(cx - 2 + i, cy - 2 + j); }));
    if (clip) m.and(clip);
    R.fill(m, ORANGE.base); R.fill(R.M().set(cx, cy - 2).set(cx - 2, cy - 1).set(cx - 1, cy), ORANGE.hi);
    R.fill(R.M().set(cx + 1, cy + 1).set(cx, cy + 2).set(cx + 2, cy), ORANGE.dp);
  }
  return m;
}
item('top', 'maple', 'Maple Tee', '#f7f3f8', (R, ph, r) => {
  if (ph !== 'front') return;
  const g = teeBase(R, r, { trim: ORANGE });
  if (isFront(R)) { const m = mapleLeaf(R, R.V.cx, 80, 1, g.body); cast(R, m, g.body, r, 1, 1); }
  else if (isBack(R)) mapleLeaf(R, R.V.cx, 73, .5, g.body);
  else mapleLeaf(R, 38, 76, .5, g.sl);
});

// Ranger Tunic: dagged leaf hem, laced V-neck over a linen undershirt, belt with pouch, leather bracers.
item('top', 'tunic', 'Ranger Tunic', '#4f8f52', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, hem = 100;
  const cut = vCut(R, 11, 5);
  const g = garment(R, r, { sleeve: 'long', hem, loose: 1, cut, keep: (x, y) => y <= hem - tri(x + 2, 7, 3.5) });
  chinShadow(R, g.body, r);
  elbowFolds(R, g.sl, r);
  // linen undershirt in the V with criss-cross lacing
  if (isFront(R)) {
    const ins = cut.clone().and(torsoM(R, 0, 99)).sub(crewCut(R, 4, 2));
    R.paint(ins, CREAM, { lines: true, round: 2 });
    cast(R, g.body, ins, CREAM, 1, 0);
    for (let y = ny + 3; y < ny + 10; y += 3) {
      const w = (ny + 11 - y) * .45 + 1;
      R.stroke(R.curve([nx - w, y], [nx, y + 1], [nx + w + 1, y + 2]), LEATH.sh);
      R.stroke(R.curve([nx + w + 1, y], [nx, y + 1], [nx - w, y + 2]), LEATH.base);
      R.fill(R.M().set(Math.round(nx - w - 1), y).set(Math.round(nx + w + 2), y), GOLDM.base);
    }
  }
  neckband(R, darker(r), cut, g.all, 2, { rib: false });
  // hem trim stitch
  R.stitch(pointsOf(g.body, 94), GOLDM.base, g.body, 2, 1);
  R.stroke(pointsOf(g.body, 95), r.dp, g.body);
  folds(R, g.body, r, view3(R, [[[30, 76], [32, 79], [35, 81], 2], [[50, 76], [48, 79], [45, 81], 2], [[33, 94], [33, 96], [34, 99], 2], [[47, 94], [47, 96], [46, 99], 2]],
    [[[22, 94], [23, 96], [24, 99], 2]], [[[31, 75], [34, 78], [37, 79], 2], [[49, 75], [46, 78], [43, 79], 2], [[35, 94], [35, 96], [36, 99], 2], [[45, 94], [45, 96], [44, 99], 2]]));
  // leather bracers with lacing
  const by0 = V.handY - 7, br = rows(g.sl, by0, V.handY - 1);
  R.paint(br, LEATH, { round: 2.5, shiny: true, lines: true });
  const rim = rows(br, by0, by0 + 1); R.paint(rim, DLEATH, { round: 1, lines: true });
  // criss-cross lacing down the middle of each forearm
  const lace = R.M(), arms = isSide(R) ? [br] : [br.clone().keep(x => x < V.cx), br.clone().keep(x => x > V.cx)];
  for (const a of arms) { const sp = spans(a); for (let y = by0 + 3; y <= V.handY - 2; y++) {
    if (!sp[y]) continue; const [lo, hi] = sp[y], c = Math.round((lo + hi) / 2) + (isSide(R) ? 2 : 0), k = (y - by0) % 2;
    if (k) lace.set(c - 1, y).set(c + 1, y); else lace.set(c, y);
  } }
  R.fill(lace.and(br), CREAM.lt);
  skinShadow(R, br, 1);
  cast(R, br, g.sl, r, 0, -1);
  // belt + pouch
  belt(R, 88, 90, LEATH, isBack(R) ? null : isSide(R) ? 23 : nx, null, { grow: true });
  const px = view3(R, 49, 28, 31);
  const pouch = R.M().poly([[px - 3, 90], [px + 3, 90], [px + 3, 95], [px + 2, 96], [px - 2, 96], [px - 3, 95]]);
  R.paint(pouch, LEATH, { flat: true, round: 2, shiny: true });
  R.paint(R.M().poly([[px - 3, 90], [px + 3, 90], [px + 3, 92], [px, 93.5], [px - 3, 92]]), DLEATH, { flat: true, round: 1.4 });
  R.stud(px, 92, GOLDM, 1);
  cast(R, pouch, g.body, r, 1, 1);
}, { layer: 'outer' });

// School Blazer: notched lapels over a white shirt and ribbon, gold buttons, crest on the
// breast pocket, flap hip pockets, piped cuffs with buttons, centre-back vent.
item('top', 'blazer', 'School Blazer', '#2c3a6b', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, tor = torsoM(R, 0, 99);
  const gap = view3(R, R.M().poly([[nx - 6, ny - 2], [nx + 6, ny - 2], [nx + 1, ny + 17], [nx - 1, ny + 17]]),
    R.M().poly([[17, ny - 2], [27, ny - 2], [24, ny + 11], [17, ny + 13]]), R.M()).and(tor);
  const g = garment(R, r, { sleeve: 'long', hem: 99, loose: 1, cut: gap.clone().add(crewCut(R, 6, 3)) });
  if (!gap.empty()) { // shirt + ribbon
    const sh = gap.clone().sub(crewCut(R, 4, 2));
    R.paint(sh, SNOW, { lines: true, round: 2 });
    cast(R, g.body, sh, SNOW, 1, 0);
  }
  elbowFolds(R, g.sl, r);
  folds(R, g.body, r, view3(R, [[[31, 86], [32, 90], [34, 94], 2], [[49, 86], [48, 90], [46, 94], 2]], [[[27, 86], [26, 90], [27, 94], 2]], [[[33, 86], [35, 90], [36, 94], 2], [[47, 86], [46, 90], [45, 94], 2]]));
  // cuffs with piping and buttons
  const cf = band(R, g.sl, g.se - 3, g.se, r, { round: 1.6, bias: .04 });
  R.stroke(pointsOf(cf, g.se - 3), lighter(r).base, cf);
  const cb = view3(R, [[21, g.se - 1], [58, g.se - 1]], [[44, g.se - 1]], [[21, g.se - 1], [58, g.se - 1]]);
  for (const [x, y] of cb) if (cf.has(x, y)) R.stud(x, y, GOLDM, 1);
  let lap;
  if (isFront(R)) {
    // closure line and cutaway
    R.stroke(R.curve([nx, ny + 17], [nx, ny + 27], [nx, 95]).concat(R.curve([nx, 95], [nx - 1, 97], [nx - 3, 99])), r.line, g.body);
    R.stroke(R.curve([nx + 1, ny + 18], [nx + 1, ny + 26], [nx + 1, 94]), r.lt, g.body);
    for (const y of [86, 91]) { R.paint(R.M().ellipse(nx - 1.5, y, 1.2, 1.2), GOLDM, { flat: true, round: 1.4, shiny: true }); R.fill(R.M().set(nx - 2, y - 1), [255, 255, 255]); }
    // hip pocket flaps
    const hp = R.M().poly([[28.5, 91], [35.5, 91], [35.5, 93], [28.5, 93]]).mirror();
    R.paint(hp.and(g.body), r, { lines: true, round: 1.4, bias: .1 });
    cast(R, hp, g.body, r, 0, 1);
    // breast pocket welt + crest
    R.stroke(R.curve([44, 76], [46.5, 76], [49, 76]), r.dp, g.body); R.stroke(R.curve([44, 75], [46.5, 75], [49, 75]), r.lt, g.body);
    const cr = R.M().poly([[44.5, 77], [49.5, 77], [49.5, 80], [47, 82.5], [44.5, 80]]);
    R.paint(cr, GOLDM, { flat: true, round: 1.8 });
    R.fill(R.M().rect(46, 78, 47, 79), REDC.base); R.fill(R.M().set(46, 78), REDC.hi);
    // lapels
    lap = R.M().poly([[nx - 6, ny - 2], [nx - .5, ny + 17], [nx - 4.5, ny + 11], [nx - 9.5, ny + 6], [nx - 7.5, ny + 4.5], [nx - 10.5, ny + 3], [nx - 9, ny - 1]]).mirror();
    behindHead(R, lap);
    R.paint(lap, r, { flat: true, round: 2.5, bias: .2 });
    R.fill(R.M().set(nx - 8, ny + 5).set(nx + 8, ny + 5), r.line);
    // lapel roll highlight and buttonhole
    R.stroke(R.curve([nx - 8, ny + 1], [nx - 6, ny + 7], [nx - 2, ny + 14]), r.hi, lap);
    R.stroke(R.curve([nx + 8, ny + 1], [nx + 6, ny + 7], [nx + 2, ny + 14]), r.lt, lap);
    R.fill(R.M().rect(nx + 5, ny + 7, nx + 6, ny + 7), r.dp);
    cast(R, lap, g.body, r, 1, 1, 2);
    // shirt collar wings + ribbon bow
    const sc = R.M().poly([[nx - 5, ny - 1], [nx, ny + 2], [nx - 2, ny + 5], [nx - 5, ny + 2]]).mirror();
    behindHead(R, sc); R.paint(sc.sub(lap), SNOW, { flat: true, round: 1.6, bias: .05 });
    const bw = R.M().poly([[nx - 5, ny + 3], [nx, ny + 5], [nx - 5, ny + 7]]).poly([[nx + 5, ny + 3], [nx, ny + 5], [nx + 5, ny + 7]]);
    const tl = R.M().poly([[nx - 1, ny + 5], [nx - 3, ny + 11], [nx - 1, ny + 11], [nx, ny + 7]]).poly([[nx + 1, ny + 5], [nx + 3, ny + 11], [nx + 1, ny + 11], [nx, ny + 7]]);
    R.paint(tl.and(gap), REDC, { flat: true, round: 1.4 });
    R.paint(bw, REDC, { flat: true, round: 1.6 });
    R.paint(R.M().rect(nx - 1, ny + 4, nx + 1, ny + 6), REDC, { flat: true, round: 1, bias: .25 });
    cast(R, bw, gap, SNOW, 1, 1);
  } else if (isBack(R)) {
    R.stroke(R.curve([nx, ny + 6], [nx, 85], [nx, 99]), r.dp, g.body);
    R.stroke(R.curve([nx - 1, 92], [nx - 1, 95], [nx - 1, 99]), r.line, g.body);
    R.stroke(R.curve([nx + 1, ny + 6], [nx + 1, 80], [nx + 1, 91]), r.lt, g.body);
    lap = R.M().poly([[nx - 10, ny - 1], [nx + 10, ny - 1], [nx + 11, ny + 3], [nx - 11, ny + 3]]);
    behindHead(R, lap); R.paint(lap, r, { flat: true, round: 1.6, bias: .1 });
    cast(R, lap, g.all, r, 0, 1);
  } else {
    lap = R.M().poly([[24, ny - 2], [30, ny - 2], [31, ny + 2], [26.5, ny + 12], [23, ny + 12]]);
    behindHead(R, lap); R.paint(lap, r, { flat: true, round: 2, bias: .1 });
    cast(R, lap, g.body, r, 1, 1);
    for (const y of [86, 91]) button(R, 21, y, GOLDM);
    R.paint(R.M().rect(22, 91, 28, 92).and(g.body), r, { lines: true, round: 1.2, bias: .1 });
    const bw = R.M().poly([[21, ny + 2], [25, ny + 4], [21, ny + 6]]).and(gap);
    R.paint(bw, REDC, { flat: true, round: 1.4 });
  }
}, { layer: 'outer' });

// Frilly Blouse: ruffled stand collar with a cameo brooch, tiered jabot, pin tucks,
// puffed bishop sleeves gathered into ruffled cuffs.
item('top', 'blouse', 'Frilly Blouse', '#f6eef8', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, frill = lighter(r);
  const g = garment(R, r, { sleeve: 'long', hem: 96, sleeveLoose: 1, cut: crewCut(R, 4, 2) });
  // puffed sleeve heads
  const pf = view3(R, R.M().ellipse(24, 73.5, 5.5, 4.5).add(R.M().ellipse(56, 73.5, 5.5, 4.5)), R.M().ellipse(38, 75, 7, 4.5), R.M().ellipse(24, 73.5, 5.5, 4.5).add(R.M().ellipse(56, 73.5, 5.5, 4.5)));
  behindHead(R, pf); if (!isSide(R)) pf.sub(torsoM(R, 0, 99));
  R.paint(pf, r, { flat: true, round: 3.5, toneMap: (x, y, t) => T5(t + (x % 3 === 0 && y > 74 ? 1 : 0)) });
  R.shadow(pf, { dx: 0, dy: 1, tint: [.86, .8, .9], only: (x, y) => g.sl.has(x, y) && !pf.has(x, y) });
  elbowFolds(R, g.sl, r);
  // pin tucks
  if (!isSide(R)) for (const x of [nx - 7, nx - 5, nx + 5, nx + 7]) { deepen(R, R.M().rect(x, ny + 7, x, 93).and(g.body), r, 1); deepen(R, R.M().rect(x - 1, ny + 7, x - 1, 93).and(g.body), r, -1); }
  else deepen(R, R.M().rect(24, ny + 8, 24, 93).and(g.body), r, 1);
  folds(R, g.body, r, view3(R, [[[31, 87], [32, 90], [34, 93], 2], [[49, 87], [48, 90], [46, 93], 2]], [[[22, 87], [24, 90], [27, 92], 2]], [[[33, 86], [35, 89], [37, 92], 2], [[47, 86], [46, 89], [44, 92], 2]]));
  // gathered ruffle cuffs
  const se = g.se, cf = rows(g.sl, se - 2, se);
  const fr = cf.clone().add(cf.clone().dilate(1).keep((x, y) => y >= se - 2 && y <= se + 1 && R.part(x, y) !== 'torso')).keep((x, y) => y <= se + 1 - tri(x + 1, 3, 1));
  R.paint(fr, frill, { flat: true, round: 1.5, toneMap: (x, y, t) => T5(t + (x % 3 === 0 ? 1 : 0)) });
  R.paint(rows(g.sl, se - 4, se - 3), r, { lines: true, round: 1.2, bias: -.05 });
  skinShadow(R, fr, 1);
  band(R, g.body, g.hem - 1, g.hem, r, { round: 1.2, shadow: false });
  // jabot tiers (front) / profile (side)
  if (isFront(R)) {
    for (let k = 2; k >= 0; k--) {
      const y0 = ny + 3 + k * 5, w0 = 1 + k * .5, w1 = 4.5 + k * .7;
      const t = R.M().poly([[nx - w0, y0], [nx + w0 + 1, y0], [nx + w1 + 1, y0 + 6.5], [nx - w1, y0 + 6.5]]).keep((x, y) => y <= y0 + 6 - ((x - nx + 20) % 2));
      R.paint(t, frill, { flat: true, round: 2.5, toneMap: (x, y, tt) => T5(tt + ((x - nx + 20) % 2 === 0 && y > y0 + 2 ? 1 : 0)) });
      cast(R, t, g.body, r, 1, 1);
    }
    R.fill(R.M().rect(nx, ny + 4, nx, ny + 5), r.sh);
  } else if (isSide(R)) {
    for (let k = 2; k >= 0; k--) {
      const t = R.M().ellipse(20.5 - k * .3, ny + 5 + k * 5, 2.2 + k * .2, 3).keep((x, y) => x <= 23);
      R.paint(t, frill, { flat: true, round: 2, toneMap: (x, y, tt) => T5(tt + (y % 2 === 0 ? 1 : 0)) });
    }
  } else {
    for (let y = ny + 5; y < 94; y += 3) { R.fill(R.M().set(nx, y), SNOW.hi); R.fill(R.M().set(nx, y + 1), SNOW.sh); }
  }
  // ruffled stand collar
  const col = view3(R, R.M().poly([[nx - 6, ny - 2], [nx + 6, ny - 2], [nx + 7, ny + 3], [nx - 7, ny + 3]]),
    R.M().poly([[nx - 4, ny - 3], [nx + 8, ny - 3], [nx + 9, ny + 2], [nx - 5, ny + 3]]),
    R.M().poly([[nx - 8, ny - 1], [nx + 8, ny - 1], [nx + 9, ny + 3], [nx - 9, ny + 3]]));
  const top = col.clone().keep((x, y) => y <= ny - 0).add(R.M().rect(isSide(R) ? nx - 5 : nx - 8, ny - 3, isSide(R) ? nx + 9 : nx + 8, ny - 1)).keep((x, y) => y >= ny - 3 + tri(x, 3, 1));
  behindHead(R, col); behindHead(R, top);
  R.paint(col, r, { flat: true, round: 2, bias: .05 });
  R.paint(top, frill, { flat: true, round: 1.4, toneMap: (x, y, t) => T5(t + (x % 3 === 0 ? 1 : 0)) });
  cast(R, col, g.all, r, 0, 1);
  if (isFront(R)) { // cameo brooch
    R.paint(R.M().ellipse(nx, ny + 2, 2, 2.3), GOLDM, { flat: true, round: 1.6 });
    R.fill(R.M().rect(nx - 1, ny + 1, nx, ny + 3).set(nx + 1, ny + 2), ramp('#e57a9a').base);
    R.fill(R.M().set(nx, ny + 1).set(nx, ny + 2), [255, 238, 240]);
    R.fill(R.M().set(nx - 2, ny + 1), [255, 255, 255]);
  }
});

// Leather Biker Jacket: asymmetric zip, wide snap lapels, epaulettes, zip pockets, belted hem.
item('top', 'leather', 'Biker Jacket', '#34303d', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, Z = SILVM;
  const gap = view3(R, R.M().poly([[nx - 5, ny - 2], [nx + 5, ny - 2], [nx + 1, ny + 7], [nx - 1, ny + 7]]),
    R.M().poly([[17, ny - 2], [26, ny - 2], [23, ny + 6], [17, ny + 7]]), R.M()).and(torsoM(R, 0, 99));
  const g = garment(R, r, { sleeve: 'long', hem: 97, loose: 1, cut: gap.clone().add(crewCut(R, 6, 3)), shiny: true });
  if (!gap.empty()) { const t = gap.clone().sub(crewCut(R, 4, 2)); R.paint(t, SNOW, { lines: true, round: 2, flat: true }); }
  elbowFolds(R, g.sl, r);
  // shine streaks along the lit side of the sleeves and chest
  const shine = view3(R, [[[21, 74], [19, 79], [19, 84]], [[52, 73], [52, 76], [53, 79]], [[31, 76], [31, 80], [31, 84]]], [[[32, 75], [31, 80], [32, 86]], [[22, 78], [21, 83], [21, 88]]], [[[21, 74], [19, 79], [19, 84]], [[52, 73], [52, 76], [53, 79]]]);
  for (const [a, b, c] of shine) { const pts = R.curve(a, b, c); R.stroke(pts, r.lt, g.all); R.stroke(pts.slice(1, 3), r.hi, g.all); }
  // zip cuffs
  for (const [x, y0] of view3(R, [[21, 84], [59, 84]], [[45, 85]], [[21, 84], [59, 84]])) { R.fill(R.M().rect(x, y0, x, g.se), Z.dp); R.fill(R.M().rect(x, y0, x, y0), Z.spec); }
  const cf = rows(g.sl, g.se - 1, g.se); R.paint(cf, r, { lines: true, round: 1, bias: -.1 });
  // belt
  const bt = belt(R, 93, 95, r, null, g.body);
  let lap;
  if (isFront(R)) {
    // asymmetric zip from the right lapel down to the left hip
    const zp = R.curve([nx + 2, ny + 8], [nx - 1, ny + 18], [nx - 4, 97]);
    zp.forEach(([x, y], i) => { R.fill(R.M().set(x, y), i % 2 ? Z.hi : Z.base); R.fill(R.M().set(x + 1, y), r.line); });
    R.stroke(zp.map(([x, y]) => [x - 1, y]), r.lt, g.body);
    R.paint(R.M().rect(nx + 2, ny + 8, nx + 3, ny + 11), Z, { flat: true, round: 1, shiny: true });
    // zip pockets
    for (const [a, b] of [[[44, 80], [49, 76]], [[29, 90], [32, 87]], [[48, 87], [51, 90]]]) {
      const pts = R.curve(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b);
      R.stroke(pts, r.line, g.body); R.stroke(pts.map(([x, y]) => [x, y - 1]), Z.sh, g.body); R.fill(R.M().set(...pts[0]), Z.spec);
    }
    lap = R.M().poly([[nx - 5, ny - 2], [nx - 1, ny + 7], [nx - 3, ny + 13], [nx - 9.5, ny + 8], [nx - 11, ny + 2], [nx - 9, ny - 1]]).mirror();
    behindHead(R, lap);
    R.paint(lap, r, { flat: true, round: 2.5, bias: .1, shiny: true });
    R.stroke(R.curve([nx - 9, ny + 1], [nx - 8, ny + 5], [nx - 4, ny + 10]), r.hi, lap);
    cast(R, lap, g.body, r, 1, 1);
    for (const [x, y] of [[nx - 9, ny + 6], [nx + 8, ny + 6]]) R.stud(x, y, Z);
    // epaulettes
    const ep = R.M().poly([[nx - 8, ny + 1], [nx - 6, ny + 2], [nx - 13, ny + 7], [nx - 15, ny + 6]]).mirror().and(g.all);
    R.paint(ep, r, { round: 1.2, bias: .15, shiny: true });
    R.stud(nx - 14, ny + 5, Z, 1); R.stud(nx + 14, ny + 5, Z, 1);
    buckle(R, 29, 92, 33, 96, Z);
  } else if (isBack(R)) {
    R.stroke(R.curve([28, 75], [40, 77], [52, 75]), r.line, g.body);
    R.stroke(R.curve([28, 76], [40, 78], [52, 76]), r.hi, g.body);
    for (const x of [34, 46]) R.stroke(R.curve([x, 78], [x, 85], [x, 92]), r.line, g.body);
    lap = R.M().poly([[nx - 10, ny - 1], [nx + 10, ny - 1], [nx + 11, ny + 3], [nx - 11, ny + 3]]);
    behindHead(R, lap); R.paint(lap, r, { flat: true, round: 1.6, bias: .1, shiny: true });
    cast(R, lap, g.all, r, 0, 1);
    buckle(R, 47, 92, 49, 96, Z);
  } else {
    lap = R.M().poly([[24, ny - 2], [30, ny - 2], [31, ny + 2], [27, ny + 11], [22, ny + 9]]);
    behindHead(R, lap); R.paint(lap, r, { flat: true, round: 2, bias: .1, shiny: true });
    cast(R, lap, g.body, r, 1, 1);
    R.stud(23, ny + 7, Z, 1);
    const zp = R.curve([22, ny + 10], [22, 86], [21, 97]); zp.forEach(([x, y], i) => R.fill(R.M().set(x, y), i % 2 ? Z.lt : Z.sh));
    const ep = R.M().poly([[30, ny], [40, ny + 1], [40, ny + 3], [30, ny + 2]]).and(g.all);
    R.paint(ep, r, { round: 1.2, bias: .15, shiny: true }); R.stud(38, ny + 1, Z, 1);
    buckle(R, 22, 92, 25, 96, Z);
  }
}, { layer: 'outer', kind: 'leather' });

// Knit Vest: argyle sweater vest with rib V-neck, armholes and hem over a white shirt and tie.
item('top', 'vest', 'Argyle Vest', '#3f5a8f', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, sh = SNOW;
  // shirt
  const gs = garment(R, sh, { sleeve: 'long', hem: 96, cut: crewCut(R, 4, 2) });
  elbowFolds(R, gs.sl, sh);
  const cf = band(R, gs.sl, gs.se - 3, gs.se, sh, { round: 1.6, bias: .06 });
  cast(R, cf, gs.sl, sh, 0, -1);
  if (isFront(R)) { // tie
    const t = R.M().poly([[nx - 1.5, ny + 3], [nx + 2.5, ny + 3], [nx + 3, ny + 16], [nx - 2, ny + 16]]);
    R.paint(t, REDC, { round: 1.5 });
    R.paint(R.M().rect(nx - 1, ny + 1, nx + 1, ny + 3), REDC, { flat: true, round: 1, bias: .15 });
    R.fill(R.M().set(nx, ny + 7).set(nx + 1, ny + 8).set(nx, ny + 11).set(nx + 1, ny + 12), REDC.sh);
  }
  // vest
  const cut = view3(R, R.M().poly([[nx - 7, ny - 2], [nx + 8, ny - 2], [nx + 1.5, ny + 15], [nx - .5, ny + 15]]), R.M().poly([[17, ny - 3], [31, ny - 3], [27, ny + 4], [21, ny + 11], [17, ny + 11]]), R.M().ellipse(nx, ny, 7, 3));
  const arm = view3(R, R.M().ellipse(29.5, 70, 3, 5).mirror(), R.M(), R.M().ellipse(29.5, 70, 3, 5).mirror());
  const body = torsoM(R, 0, 96).sub(cut).sub(arm);
  const dk = ramp(mix(r.base, r.sh, .75)), ov = ramp(mix(r.base, r.hi, .8));
  const argyle = (x, y) => {
    const a = (x - V.cx) / 4.5 + (y - 70) / 5.5, b = (x - V.cx) / 4.5 - (y - 70) / 5.5;
    const fa = a - Math.floor(a), fb = b - Math.floor(b);
    if (Math.abs(fa - .5) < .09 || Math.abs(fb - .5) < .09) return ov;
    return (Math.floor(a) + Math.floor(b)) % 2 ? dk : null;
  };
  R.paint(body, r, { lines: true, round: 6, pattern: argyle, toneMap: form(R) });
  const ramps = (x, y) => argyle(x, y) || r;
  folds(R, body, ramps, view3(R, [[[31, 87], [32, 90], [34, 93], 2], [[49, 86], [48, 90], [46, 93], 2]], [[[22, 86], [24, 89], [27, 92], 2]], [[[33, 87], [35, 90], [37, 93], 2], [[47, 87], [46, 90], [44, 93], 2]]));
  // rib trims
  const nb = ring(cut, 2, body); R.paint(nb, r, { flat: true, round: 1.4, toneMap: rib(2), bias: .05 });
  const ab = ring(arm, 1, body).add(isSide(R) ? R.M() : body.clone().keep((x, y) => R.part(x - 1, y) === 'arm' || R.part(x + 1, y) === 'arm'));
  R.paint(ab.sub(nb), r, { round: 1, toneMap: rib(2), bias: .05, lines: true });
  const hb = band(R, body, 93, 96, r, { rib: 2, round: 1.6, bias: .05, shadow: false });
  cast(R, hb, body, ramps, 0, -1);
  cast(R, nb, body, ramps, 1, 1);
  R.shadow(body, { dx: 0, dy: 1, tint: [.82, .8, .9], only: (x, y) => gs.all.has(x, y) && !body.has(x, y) });
  // shirt collar over the vest
  const col = pointCollar(R, sh, { long: 1 });
  cast(R, col, body, ramps, 1, 1);
}, { layer: 'outer' });

// Cozy Cardigan: open-front knit with rib button band, patch pockets and rib cuffs over a lace-trimmed cami.
item('top', 'cardigan', 'Cozy Cardigan', '#e9b872', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, tor = torsoM(R, 0, 98), band2 = lighter(r);
  const gap = view3(R, R.M().poly([[nx - 6, ny - 2], [nx + 6, ny - 2], [nx + 1.5, 84], [nx - .5, 84]]),
    R.M().poly([[17, ny - 2], [27, ny - 2], [24, 80], [17, 82]]), R.M()).and(tor);
  const g = garment(R, r, { sleeve: 'long', hem: 97, loose: 1, cut: gap.clone().add(crewCut(R, 6, 3)), toneMap: rib(3) });
  if (!gap.empty()) { // camisole with a scalloped lace edge
    const cm = gap.clone().sub(R.M().ellipse(nx, ny, 7, 3.5));
    R.paint(cm, SNOW, { lines: true, round: 2 });
    const lace = cm.clone().keep((x, y) => !cm.has(x, y - 2) && y <= ny + 4);
    R.fill(lace, SNOW.hi); R.fill(lace.clone().keep((x, y) => x % 2 === 0 && !cm.has(x, y - 1)), SNOW.sh);
    if (isFront(R)) cast(R, g.body, cm, SNOW, 1, 0);
  }
  elbowFolds(R, g.sl, r);
  ribBands(R, g, r, 3);
  // rib front bands along the opening + buttons
  const edge = ring(gap.clone().add(crewCut(R, 6, 3)), 2, g.body);
  if (isBack(R)) { const nb = neckband(R, r, crewCut(R, 6, 3), g.all, 3, { bias: .1 }); cast(R, nb, g.all, r, 0, 1); }
  else {
    R.paint(edge, band2, { flat: true, round: 1.2, toneMap: (x, y, t) => T5(t + (y % 2 ? 1 : 0)), noOutline: true });
    R.fill(outerEdge(edge, g.body), band2.line);
    cast(R, edge, g.body, r, 1, 1);
    const bx = view3(R, [[nx - 2, 86], [nx - 2, 90], [nx - 2, 94]], [[21, 84], [21, 89], [21, 94]], []);
    if (isFront(R)) { R.stroke(R.curve([nx, 84], [nx, 90], [nx, 96]), band2.line, g.body); R.stroke(R.curve([nx - 1, 84], [nx - 1, 90], [nx - 1, 96]), band2.base, g.body); R.stroke(R.curve([nx - 2, 84], [nx - 2, 90], [nx - 2, 96]), band2.sh, g.body); }
    for (const [x, y] of bx) { R.paint(R.M().ellipse(x, y, 1.1, 1.1), WOOD, { flat: true, round: 1.2 }); R.fill(R.M().set(x - 1, y - 1), WOOD.hi); }
    // patch pockets with rib tops
    const pk = view3(R, R.M().rect(28.5, 88, 34.5, 94).add(R.M().rect(45.5, 88, 51.5, 94)), R.M().rect(23, 88, 29, 94), R.M()).and(g.body);
    R.paint(pk, r, { lines: true, round: 2, bias: .05, toneMap: rib(3) });
    R.paint(rows(pk, 88, 89), band2, { lines: true, round: 1, toneMap: rib(2) });
    cast(R, pk, g.body, r, 1, 1);
  }
}, { layer: 'outer' });

// Puffer Jacket: quilted baffles (each a lit tube with stitched seams), stand collar, zip, elastic cuffs.
item('top', 'puffer', 'Puffer Jacket', '#e86a5a', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, Z = SILVM, P = 5, o = view3(R, 1, 3, 1);
  const tube = (x, y, t) => { const k = ((y + o) % P + P) % P; return T5(t + (k === 0 ? -1 : k === P - 1 ? 1 : 0)); };
  const puff = (x, y) => { const k = ((y + o) % P + P) % P; return k >= 1 && k <= 2; };
  const g = garment(R, r, { sleeve: 'long', hem: 97, loose: 1, sleeveLoose: 1, cut: crewCut(R, 5, 2.5), toneMap: tube, shiny: true, round: 7,
    keep: (x, y) => puff(x, y) || y < V.torsoTop + 4 || R.part(x, y) || R.part(x - 1, y) === 'torso' && R.part(x + 1, y) === 'torso' });
  // quilting seams + highlights on each baffle
  const seam = R.M(), shine = R.M();
  g.all.each((x, y) => { const k = ((y + o) % P + P) % P; if (k === P - 1 && y < g.hem - 2) seam.set(x, y); if (k === 1 && x % 7 < 3 && R.part(x, y) && ((x < V.cx - 3) || isSide(R))) shine.set(x, y); });
  R.fill(seam.and(g.all).keep((x, y) => g.all.has(x - 1, y) && g.all.has(x + 1, y)), r.dp);
  R.fill(shine.and(g.all).keep((x, y) => g.all.has(x - 1, y) && g.all.has(x + 1, y) && g.all.has(x, y - 2)), r.hi);
  // elastic cuffs + hem
  const cf = band(R, g.sl, g.se - 2, g.se, darker(r), { round: 1.2, rib: 2 });
  const hm = band(R, g.body, g.hem - 2, g.hem, darker(r), { round: 1.2, rib: 2, shadow: false });
  cast(R, cf, g.sl, r, 0, -1); cast(R, hm, g.body, r, 0, -1);
  // stand collar
  const col = view3(R, R.M().poly([[nx - 7, ny - 2], [nx + 7, ny - 2], [nx + 9, ny + 4], [nx - 9, ny + 4]]),
    R.M().poly([[nx - 4, ny - 3], [nx + 9, ny - 3], [nx + 10, ny + 3], [nx - 5, ny + 3]]),
    R.M().poly([[nx - 8, ny - 1], [nx + 8, ny - 1], [nx + 10, ny + 4], [nx - 10, ny + 4]]));
  behindHead(R, col);
  R.paint(col, r, { flat: true, round: 2.5, shiny: true, bias: .08 });
  R.stroke(pointsOf(col, ny + 1), r.sh, col);
  cast(R, col, g.all, r, 0, 1, 2);
  if (isFront(R)) { // zip
    const z = R.M().rect(nx, ny + 1, nx, g.hem);
    R.fill(z.clone().and(g.all.clone().add(col)).keep((x, y) => y % 2 === 0), Z.lt);
    R.fill(z.clone().and(g.all.clone().add(col)).keep((x, y) => y % 2 === 1), Z.sh);
    R.fill(R.M().rect(nx + 1, ny + 2, nx + 1, g.hem - 3).and(g.all), r.line);
    R.paint(R.M().rect(nx - 1, ny + 2, nx, ny + 5), Z, { flat: true, round: 1, shiny: true });
    R.fill(R.M().set(nx - 1, ny + 2), [255, 255, 255]);
  } else if (isSide(R)) {
    R.fill(R.M().rect(21, ny + 4, 21, g.hem - 3).and(g.body).keep((x, y) => y % 2 === 0), Z.lt);
  } else R.fill(R.M().rect(nx - 3, ny + 5, nx + 3, ny + 6).and(g.body), r.sh); // hanger loop shadow
}, { layer: 'outer' });

// Mage Coat: purple coat with gold-trimmed front, mandarin collar with a sapphire clasp,
// a short capelet, belled sleeves with gold cuffs and a knotted sash.
item('top', 'mage', 'Mage Coat', '#5b3d8f', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, [nx, ny] = V.neck, sash = ramp('#d8434e'), gem = ramp('#4aa8ff', 'gem');
  const g = garment(R, r, { sleeve: 'long', hem: 100, loose: 1, sleeveLoose: 1, cut: crewCut(R, 5, 2.5), keep: (x, y) => y <= 100 - (Math.abs(x - V.cx) < 2 && isFront(R) ? 1 : 0) });
  elbowFolds(R, g.sl, r);
  // belled sleeve ends with gold cuff
  const bell = rows(g.sl, g.se - 3, g.se);
  bell.add(bell.clone().dilate(1).keep((x, y) => y >= g.se - 2 && y <= g.se + 1 && R.part(x, y) !== 'torso' && R.part(x, y) !== 'hand'));
  R.paint(bell, r, { flat: true, round: 2 });
  const gc = rows(bell, g.se - 1, g.se + 1); R.paint(gc, GOLDM, { flat: true, round: 1.2, shiny: true });
  skinShadow(R, gc, 1);
  // gold front trim + hem trim
  if (isFront(R)) {
    const tr = R.M().rect(nx - 2, ny + 3, nx + 1, 100).and(g.body);
    R.paint(tr, GOLDM, { round: 1.5, shiny: true, lines: true });
    R.fill(R.M().rect(nx - 1, ny + 3, nx - 1, 100).and(tr).keep((x, y) => y % 4 === 0), GOLDM.spec);
    cast(R, tr, g.body, r, 1, 0);
  } else if (isSide(R)) R.paint(R.M().rect(20, ny + 3, 22, 100).and(g.body), GOLDM, { round: 1.2, shiny: true, lines: true });
  const ht = g.body.clone().keep((x, y) => !g.body.has(x, y + 2)); R.paint(ht, GOLDM, { round: 1, shiny: true, noOutline: true }); R.fill(outerEdge(ht, g.body), GOLDM.line);
  // sash with a knot and hanging tails on the wearer's left hip
  const sh = R.body((x, y, p) => p === 'torso' && y >= 89 && y <= 91); sh.add(sh.clone().dilate(1).keep((x, y) => y >= 89 && y <= 91).sub(R.body((x, y, p) => p === 'hand' || p === 'arm')));
  R.paint(sh, sash, { flat: true, round: 1.4 });
  const kx = view3(R, 47, 26, 33);
  const tails = R.M().poly([[kx - 1, 91], [kx + 1, 91], [kx + 2, 99], [kx, 98], [kx - 1, 99]]).poly([[kx + 1, 91], [kx + 3, 91], [kx + 4, 97], [kx + 2, 96]]);
  R.paint(tails, sash, { flat: true, round: 1.2 });
  R.paint(R.M().ellipse(kx + 1, 90, 1.6, 1.6), sash, { flat: true, round: 1.4, bias: .15 });
  cast(R, sh.clone().add(tails), g.body, r, 1, 1);
  // capelet
  let cap;
  if (isSide(R)) cap = R.M().poly([[nx - 6, ny - 1], [nx + 13, ny - 2], [nx + 17, ny + 8], [nx + 4, ny + 11], [nx - 7, ny + 7]]);
  else cap = R.M().ellipse(nx, ny + 1, 17, 10).keep((x, y) => y >= ny - 1);
  cap.keep((x, y) => y <= (isSide(R) ? 99 : ny + 10 - (Math.abs(x - V.cx) > 6 ? 1 : 0)));
  behindHead(R, cap);
  if (!isBack(R)) cap.sub(crewCut(R, 5, 2.5));
  R.paint(cap, r, { flat: true, round: 4, bias: .05 });
  const ce = cap.clone().keep((x, y) => !cap.has(x, y + 1) || !cap.has(x, y + 2)).keep((x, y) => !crewCut(R, 6, 3).has(x, y));
  R.paint(ce, GOLDM, { flat: true, round: 1, shiny: true, noOutline: true }); R.fill(outerEdge(ce, cap), GOLDM.line);
  R.shadow(cap, { dx: 0, dy: 1, tint: [.72, .68, .82], only: (x, y) => !cap.has(x, y) });
  // mandarin collar + clasp
  const col = view3(R, R.M().poly([[nx - 6, ny - 2], [nx + 6, ny - 2], [nx + 7, ny + 3], [nx - 7, ny + 3]]),
    R.M().poly([[nx - 4, ny - 3], [nx + 7, ny - 3], [nx + 8, ny + 2], [nx - 5, ny + 3]]),
    R.M().poly([[nx - 8, ny - 1], [nx + 8, ny - 1], [nx + 9, ny + 3], [nx - 9, ny + 3]]));
  behindHead(R, col);
  R.paint(col, r, { flat: true, round: 1.8, bias: .1 });
  R.fill(rows(col, ny + 2, ny + 3).keep((x, y) => col.has(x - 1, y) && col.has(x + 1, y) && !col.has(x, y + 1)), GOLDM.base);
  cast(R, col, cap, r, 0, 1);
  if (isFront(R)) R.gem(nx, ny + 3, 2, gem);
  else if (isSide(R)) R.gem(nx - 4, ny + 3, 1.5, gem);
  else { // rune star on the back
    const st = R.M(); for (const [x, y] of [[0, -3], [0, -2], [0, -1], [0, 0], [0, 1], [0, 2], [0, 3], [-3, 0], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) st.set(nx + x, 84 + y);
    R.fill(st.and(g.body), GOLDM.base); R.fill(R.M().set(nx, 84).set(nx - 1, 83), GOLDM.spec);
  }
}, { layer: 'outer' });
})();
