// Pixie Closet wardrobe: bottom. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- BOTTOM TOOLKIT ----------------
// Pants are painted as one skin-tight piece (the body's leg-gap contour stays as an inner outline,
// so each leg shades as its own cylinder), then detailed with separately painted waistbands,
// loops, pockets, cuffs and hems, each with its own outline and a small cast shadow.
const T5 = t => Math.max(0, Math.min(5, t));
const view3 = (R, f, s, b) => R.view === 'front' ? f : R.view === 'side' ? s : b;
const SKIN_SH = [.86, .72, .78];
const BRASS = ramp('#e3a94b', 'metal'), SILV = ramp('#d5dae6', 'metal'), GOLDM = ramp('#f2c14e', 'metal');
const LEATH = ramp('#8a5a3c', 'leather'), DLEATH = ramp('#5c3b2c', 'leather');
const REDC = ramp('#e0475a'), SNOW = ramp('#f7f3f8'), CREAM = ramp('#f6ead0'), THREAD = ramp('#e8b45a');

// closest ramp tone of an already drawn pixel -> [ramp, tone, dist]
function nearTone(c, ramps) {
  let best = 1e9, br = null, bt = 0;
  for (const r of ramps) for (let t = 0; t < 7; t++) {
    const q = r.t[t], d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2;
    if (d < best) { best = d; br = r; bt = t; }
  }
  return [br, bt, best];
}
// Shift already painted pixels of `ramps` darker (+n) or lighter (-n) along the ramp (stays on palette).
function shiftPx(R, i, ramps, n) {
  const b = R.buf, o = i * 4; if (!b[o + 3]) return;
  const [r, t, d] = nearTone([b[o], b[o + 1], b[o + 2]], ramps);
  if (d > 2600 || t >= 6) return;
  const c = r.t[Math.max(1, Math.min(5, t + n))];
  b[o] = c[0]; b[o + 1] = c[1]; b[o + 2] = c[2];
}
function deepen(R, mask, ramps, n = 1, only) {
  ramps = ramps.t ? [ramps] : ramps;
  mask.each((x, y, i) => { if (!only || only(x, y)) shiftPx(R, i, ramps, n); });
}
// repaint already drawn pixels of `from` ramps in the same tones of ramp `to` (stripes, piping)
function recolor(R, mask, from, to, only, tmap) {
  from = from.t ? [from] : from;
  const b = R.buf;
  mask.each((x, y, i) => {
    const o = i * 4; if (!b[o + 3] || (only && !only(x, y))) return;
    const [, t, d] = nearTone([b[o], b[o + 1], b[o + 2]], from);
    if (d > 2600) return;
    const c = to.t[tmap ? tmap(t) : t]; b[o] = c[0]; b[o + 1] = c[1]; b[o + 2] = c[2];
  });
}
// stripe tones: keep them clean (lit / plain / shaded / deep) instead of every fold glint
const stripeTone = t => (t <= 2 ? 2 : t);
const lum = c => .3 * c[0] + .59 * c[1] + .11 * c[2];
const NAVY = ramp('#2c3a6b');
// an accent that stands out against the dye: white on dark/saturated dyes, navy on pale ones
const contrast = r => (lum(r.base) > 175 ? NAVY : SNOW);
// draw sheer fabric (tulle) over `area` (e.g. the hands): whatever was there shows through
function sheer(R, area, keep, draw) {
  const saved = [], b = R.buf;
  area.each((x, y, i) => { const o = i * 4; if (b[o + 3]) saved.push(i, b[o], b[o + 1], b[o + 2]); });
  draw();
  for (let k = 0; k < saved.length; k += 4) {
    const o = saved[k] * 4;
    for (let c = 0; c < 3; c++) b[o + c] = b[o + c] * (1 - keep) + saved[k + 1 + c] * keep;
  }
}
const shifted = (R, m, dx, dy) => { const s = R.M(); m.each((x, y) => s.set(x + dx, y + dy)); return s; };
// cast shadow of `piece` onto `under` (painted with `ramps`) offset by (dx,dy)
function cast(R, piece, under, ramps, dx = 1, dy = 1, n = 1) {
  const s = shifted(R, piece, dx, dy).sub(piece); if (under) s.and(under);
  deepen(R, s, ramps, n);
}
const rows = (m, y0, y1) => m.clone().keep((x, y) => y >= y0 && y <= y1);
const isLegSkin = R => (x, y) => R.part(x, y) === 'leg' || R.part(x, y) === 'foot';
// The part map labels a few torso / thigh skin pixels next to the hands as 'hand' (no contour line
// separates them). Flood from the torso and legs through hand-labelled skin below handY to find them,
// once per view, so garments cover them and only the real hands stay on top.
const FAKE = {};
function fakeHand(R) {
  if (FAKE[R.view]) return FAKE[R.view];
  const V = R.V, w = V.w, f = new Uint8Array(w * V.h), q = [];
  const handSkin = (x, y) => { const p = R.part(x, y); return (p === 'hand' || p === 'arm') && R.bodyIdx(x, y) > 2 && y >= V.handY; };
  for (let y = V.handY; y < V.h; y++) for (let x = 0; x < w; x++) {
    const p = R.part(x, y); if ((p === 'torso' || p === 'leg') && R.bodyIdx(x, y) > 2) q.push(x, y);
  }
  while (q.length) {
    const y = q.pop(), x = q.pop();
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= V.h || f[ny * w + nx] || !handSkin(nx, ny)) continue;
      f[ny * w + nx] = 1; q.push(nx, ny);
    }
  }
  return (FAKE[R.view] = f);
}
const isFake = (R, x, y) => x >= 0 && y >= 0 && x < R.V.w && y < R.V.h && fakeHand(R)[y * R.V.w + x] === 1;
// per-render cache for body masks that several pieces of one item need (returned as copies)
const cached = (R, key, make) => { const c = R._btm || (R._btm = {}); return (c[key] || (c[key] = make())).clone(); };
const armHand = R => cached(R, 'arm', () => R.body((x, y, p) => (p === 'hand' || p === 'arm') && !isFake(R, x, y)));
// shadow on the legs / shoes below a hem: dark band right under it fading over `len` rows
function hemShadow(R, m, len = 3, dx = 0) {
  const only = isLegSkin(R);
  R.shadow(m, { dx, dy: 1, tint: SKIN_SH, only, strength: .9 });
  if (len > 1) R.shadow(m, { dx, dy: len, tint: SKIN_SH, only, strength: .45 });
}
// Per-row spans of a mask, split at the body's internal contour lines (the leg gap).
// u(x,y) = 0 at a span's left edge .. 1 at its right edge, w(x,y) = span width, -1 outside.
function spans(R, m, split = true) {
  const V = R.V, U = new Float32Array(CW * CH).fill(-1), W = new Float32Array(CW * CH), X0 = new Int16Array(CW * CH);
  const sep = (gx, gy) => { if (!split) return false; const k = R.bodyIdx(gx - V.ox, gy - V.oy); return k >= 0 && k <= 2 && m.a[gy * CW + gx - 1] && m.a[gy * CW + gx + 1]; };
  for (let gy = 1; gy < CH - 1; gy++) {
    let s = -1;
    for (let gx = 1; gx < CW; gx++) {
      const i = gy * CW + gx, inM = gx < CW - 1 && m.a[i] && !sep(gx, gy);
      if (inM && s < 0) s = gx;
      if (!inM && s >= 0) {
        const w = gx - 1 - s;
        for (let k = s; k < gx; k++) { U[gy * CW + k] = w ? (k - s) / w : .5; W[gy * CW + k] = w + 1; X0[gy * CW + k] = s - V.ox; }
        s = -1;
      }
    }
  }
  const at = (A, x, y) => { const gx = x + V.ox, gy = y + V.oy; return gx < 0 || gy < 0 || gx >= CW || gy >= CH ? -1 : A[gy * CW + gx]; };
  return { u: (x, y) => at(U, x, y), w: (x, y) => at(W, x, y), x0: (x, y) => at(X0, x, y) };
}
// cylinder shading per span: a lit stripe on the left third, shadow on the right fifth
function cylinder(S, then, lit = 1, dark = 1) {
  return (x, y, t) => {
    const u = S.u(x, y);
    if (u >= 0 && S.w(x, y) > 4) { if (u > .14 && u < .42) t -= lit; else if (u > .8) t += dark; }
    t = T5(t);
    return then ? then(x, y, t) : t;
  };
}
// A cloth fold: a tapering wedge one tone darker with a darker core and a lit lip on its upper-left.
// (works on pixel index sets instead of full-canvas masks: folds are many and small)
function fold(R, p0, p1, p2, clip, ramps, w = 2, lip = true, n = 1) {
  ramps = ramps.t ? [ramps] : ramps;
  const { ox, oy } = R.V, ca = clip.a, set = new Set(), pts = R.curve(p0, p1, p2), N = pts.length;
  const add = (x, y) => { const gx = x + ox, gy = y + oy; if (gx >= 0 && gy >= 0 && gx < CW && gy < CH && ca[gy * CW + gx]) set.add(gy * CW + gx); };
  pts.forEach(([x, y], k) => {
    const rad = w * (1 - k / Math.max(1, N - 1)) / 2;
    if (rad < .6) { add(x, y); return; }
    for (let yy = Math.floor(y - rad); yy <= Math.ceil(y + rad); yy++) for (let xx = Math.floor(x - rad); xx <= Math.ceil(x + rad); xx++) {
      const dx = (xx - x) / (rad + .35), dy = (yy - y) / (rad + .35); if (dx * dx + dy * dy <= 1) add(xx, yy);
    }
  });
  if (!set.size) return;
  if (lip) { const L = new Set(); for (const i of set) { const j = i - 1 - CW; if (j >= 0 && !set.has(j) && ca[j]) L.add(j); } for (const j of L) shiftPx(R, j, ramps, -1); }
  for (const i of set) shiftPx(R, i, ramps, n);
  pts.slice(0, Math.max(1, Math.round(N * .6))).forEach(([x, y]) => { const i = (y + oy) * CW + x + ox; if (set.has(i)) shiftPx(R, i, ramps, 1); });
}
const folds = (R, clip, ramps, list) => list.forEach(([a, b, c, w, nl]) => fold(R, a, b, c, clip, ramps, w ?? 2, !nl));
// a mask's horizontal row as a list of interior points (for stitches along a band)
const rowPts = (m, y) => { const p = []; m.each((x, yy) => { if (yy === y && m.has(x - 1, y) && m.has(x + 1, y)) p.push([x, y]); }); return p; };
const colPts = (m, x) => { const p = []; m.each((xx, y) => { if (xx === x && m.has(x, y - 1) && m.has(x, y + 1)) p.push([x, y]); }); return p; };
// tiny hand-placed pixel sprite: rows of tone letters (L line, D dp, S sh, B base, T lt, H hi, W spec), '.' = skip
const TK = { W: 0, H: 1, T: 2, B: 3, S: 4, D: 5, L: 6 };
function sprite(R, x0, y0, rowsTxt, rr, clip, flip) {
  const m = R.M();
  rowsTxt.forEach((row, j) => [...row].forEach((c, i) => {
    const x = flip ? x0 + row.length - 1 - i : x0 + i;
    if (c === '.' || (clip && !clip.has(x, y0 + j))) return;
    R.fill(R.M().set(x, y0 + j), rr.t[TK[c]]); m.set(x, y0 + j);
  }));
  return m;
}
// shiny round button (3px) or small 2px shank button
function button(R, x, y, rr, size = 3) {
  if (size >= 3) {
    sprite(R, x - 1, y - 1, ['LHL', 'HBS', 'LDL'], rr);
    R.fill(R.M().set(x, y - 1), rr.spec);
    return;
  }
  R.fill(R.M().rect(x, y, x + 1, y + 1), rr.base); R.fill(R.M().set(x, y), rr.spec); R.fill(R.M().set(x + 1, y + 1), rr.line);
}
// metal buckle frame with a prong and glint
function buckle(R, x0, y0, x1, y1, rr = GOLDM) {
  const m = R.M().rect(x0, y0, x1, y1);
  R.fill(m, rr.line);
  R.M().rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1).each((x, y) => R.fill(R.M().set(x, y), (x === x0 + 1 || y === y0 + 1) ? rr.hi : (x === x1 - 1 || y === y1 - 1) ? rr.sh : rr.base));
  if (x1 - x0 >= 4 && y1 - y0 >= 4) R.fill(R.M().rect(x0 + 2, y0 + 2, x1 - 2, y1 - 2), rr.dp);
  R.fill(R.M().set(x0 + 1, y0 + 1), [255, 255, 255]);
  return m;
}
// lighter / darker sister materials of the dye (cuff linings, trims)
const paler = (r, t = .5) => ramp(mix(r.base, r.hi, t), r.kind);
const darker = r => ramp(r.sh, r.kind);

// ---- pants ----
// hand pixels that loose garments must stay behind (skin, and the hands' own outline above the crotch)
const handBlock = R => cached(R, 'block', () => R.body((x, y, p) => (p === 'hand' || p === 'arm') && !isFake(R, x, y) && (R.bodyIdx(x, y) > 2 || y <= R.V.crotchY + 2)));
// body mask of the hips + legs from y0 down to endY; `loose` grows it outward (never into the leg gap or over hands)
function legsMask(R, endY, opt = {}) {
  const V = R.V, y0 = opt.waist ?? V.waistY;
  const m = R.body((x, y, p) => (p === 'torso' && y >= y0) || ((p === 'leg' || p === 'foot') && y <= endY) || (y >= y0 && y <= endY && isFake(R, x, y)));
  if (opt.loose) {
    const g = m.clone().dilate(opt.loose).keep((x, y) => y >= y0 + (opt.looseFrom ?? 3) && y <= endY && (isSide(R) || Math.abs(x - V.cx) > 6));
    m.add(g.sub(handBlock(R)));
  }
  return m;
}
// the leg gap (body contour between the legs, front/back views) inside a mask
function gapOf(R, m) {
  const V = R.V; if (isSide(R)) return R.M();
  return R.body((x, y) => y >= V.crotchY && Math.abs(x - V.cx) <= 4 && (R.bodyIdx(x, y) <= 2 || Math.abs(x - V.cx) <= 1)).and(m);
}
// Side view: the reference legs have ragged contour slivers at the front of the thigh; we paint the
// pants without body lines there and draw the far-leg edge ourselves.
function farLeg(R, m, rr, endY) {
  if (!isSide(R)) return;
  const V = R.V, far = R.M().poly([[20, V.crotchY + 1], [27, V.crotchY + 1], [27.5, endY + 1], [20, endY + 1]]).and(m);
  deepen(R, far, rr, 1);
  R.stroke(R.curve([27, V.crotchY + 1], [27, (V.crotchY + endY) / 2], [27, endY]), (rr.t ? rr : rr[0]).line, m);
}
// paint the pants body with per-leg cylinder shading
function pantsBody(R, r, endY, opt = {}) {
  const m = legsMask(R, endY, opt), S = spans(R, m), gap = gapOf(R, m);
  R.paint(m.clone().sub(gap), r, { flat: true, round: opt.round ?? 5, toneMap: cylinder(S, opt.toneMap, opt.lit ?? 1, opt.dark ?? 1), pattern: opt.pattern, alt: opt.alt, bias: opt.bias });
  R.fill(gap, r.line);
  farLeg(R, m, opt.pattern ? [r, asRamp(opt.alt)] : r, endY);
  return { m, S };
}
// waistband across the torso rows y0..y1 (a separate piece with its own outline), returns its mask
function waistband(R, rr, y0, y1, opt = {}) {
  let m = R.body((x, y, p) => p === 'torso' && y >= y0 && y <= y1);
  if (opt.grow) m.add(m.clone().dilate(opt.grow).keep((x, y) => y >= y0 && y <= y1 && !R.part(x, y)).sub(armHand(R)));
  R.paint(m, rr, { flat: true, round: opt.round ?? 1.6, bias: opt.bias ?? .1, toneMap: opt.toneMap });
  if (opt.stitch) R.stitch(rowPts(m, y1 - 1), opt.stitch, m, 1, 1);
  return m;
}
// belt loops: 3px-wide tabs crossing the band
function loops(R, rr, xs, y0, y1, under, ramps) {
  const m = R.M();
  xs.forEach(x => m.rect(x - 1, y0, x + 1, y1));
  m.and(R.body((x, y, p) => p === 'torso'));
  R.paint(m, rr, { flat: true, round: 1, bias: .2 });
  if (under) cast(R, m, under, ramps, 1, 0);
  return m;
}
// turned-up cuff / hem band over the bottom rows of a leg mask, a pixel wider than the leg
function cuff(R, legs, rr, y0, y1, opt = {}) {
  const V = R.V;
  let m = rows(legs, y0, y1);
  if (opt.grow) m.add(m.clone().dilate(opt.grow).keep((x, y) => y >= y0 && y <= y1 && R.part(x, y) !== 'torso' && (isSide(R) || Math.abs(x - V.cx) > 3)).sub(handBlock(R)));
  const gap = gapOf(R, m.clone().dilate(1));
  m.sub(gap);
  const S = spans(R, m);
  R.paint(m, rr, { flat: true, round: opt.round ?? 1.6, bias: opt.bias ?? .1, toneMap: cylinder(S, opt.toneMap, 1, 1) });
  if (opt.stitch) R.stitch(rowPts(m, y0 + 1), opt.stitch, m, 1, 1);
  if (opt.shadow !== false) hemShadow(R, m, 2);
  return m;
}
// leg info per view: [x0,x1] spans of the visible legs at knee height
const LEGS = { front: [[26, 37], [43, 54]], side: [[28, 44]], back: [[25, 36], [43, 55]] };
const legsOf = R => LEGS[R.view];
// knee creases (front: a soft fold across each knee; side: front and back of the knee; back: behind-knee folds)
function kneeFolds(R, legs, ramps, k) {
  const V = R.V; k = k ?? V.kneeY;
  if (isSide(R)) {
    folds(R, legs, ramps, [[[29, k - 1], [32, k], [35, k - 1], 2], [[45, k], [42, k + 1], [39, k + 2], 2, 1], [[45, k + 2], [43, k + 3], [41, k + 3], 1, 1]]);
    return;
  }
  for (const [a, b] of legsOf(R)) {
    if (isFront(R)) {
      fold(R, [a + 2, k - 1], [a + 4, k], [a + 7, k - 1], legs, ramps, 2);
      fold(R, [b, k + 1], [b - 2, k + 1], [b - 4, k + 2], legs, ramps, 2, false);
    } else {
      fold(R, [a + 2, k - 1], [a + 6, k + 1], [b - 2, k - 1], legs, ramps, 2);
      fold(R, [a + 3, k + 2], [a + 6, k + 3], [b - 3, k + 2], legs, ramps, 1);
    }
  }
}
// stacked bunching just above an ankle hem at row y
function ankleStack(R, legs, ramps, y) {
  if (isSide(R)) {
    folds(R, legs, ramps, [[[29, y - 1], [32, y], [36, y - 1], 2], [[44, y - 2], [41, y - 1], [38, y], 2, 1], [[31, y + 1], [35, y + 2], [40, y + 1], 1]]);
    return;
  }
  for (const [a, b] of legsOf(R)) {
    fold(R, [a + 1, y - 1], [a + 3, y], [a + 6, y - 1], legs, ramps, 2);
    fold(R, [b, y - 2], [b - 2, y - 1], [b - 5, y], legs, ramps, 2, false);
    fold(R, [a + 4, y + 1], [a + 7, y + 2], [b - 2, y + 1], legs, ramps, 1);
  }
}
const stitchC = (r, th = THREAD) => mix(th.base, r.base, .3);

// ---------------- BOTTOMS ----------------
// Classic Jeans: denim with a waistband, belt loops, copper shank button, J-stitched fly,
// curved front pockets with rivets, whiskers, knee creases, stacked ankles and turned-up cuffs.
// Back: yoke seam, patch pockets with arc stitching and a leather label.
function jeansBase(R, r, opt = {}) {
  const V = R.V, cx = V.cx, end = opt.end ?? V.footY - 1, wy = V.waistY;
  const P = pantsBody(R, r, end, { toneMap: opt.toneMap, loose: opt.loose });
  const legs = P.m;
  // crotch shadow (inner thighs right under the crotch)
  if (!isSide(R)) deepen(R, R.M().ellipse(cx, V.crotchY + 1, 4, 2).and(legs), r, 1);
  if (opt.knees !== false && end > V.kneeY + 2) kneeFolds(R, legs, r);
  const band = waistband(R, r, wy, wy + 3, { stitch: opt.thread ?? stitchC(r) });
  cast(R, band, legs, r, 0, 1);
  return { legs, band, S: P.S, cx, end, wy };
}
// front pockets, fly, back yoke + patch pockets, side seam
function jeansDetail(R, r, J, opt = {}) {
  const V = R.V, cx = J.cx, wy = J.wy, legs = J.legs, th = opt.thread ?? stitchC(r);
  if (isFront(R)) {
    if (opt.fly !== false) {
      R.stroke(R.curve([cx + 1, wy + 4], [cx + 1, wy + 7], [cx, V.crotchY]), r.line, legs);
      R.stroke(R.curve([cx, wy + 4], [cx, wy + 7], [cx - 1, V.crotchY - 1]), r.lt, legs);
      R.stitch(R.curve([cx + 3, wy + 4], [cx + 3, V.crotchY - 1], [cx + 1, V.crotchY]), th, legs, 1, 1);
    }
    for (const s of [-1, 1]) {
      // pocket opening: the facing behind it sits in shadow, rivet at the outer end
      const p0 = [cx + s * 7, wy + 4], p1 = [cx + s * 8.5, wy + 7.5], p2 = [cx + s * 14, wy + 7.5];
      const facing = R.M().poly([[cx + s * 7, wy + 4], [cx + s * 8.5, wy + 7], [cx + s * 15, wy + 7], [cx + s * 15, wy + 4]]);
      deepen(R, facing.and(legs), r, 1);
      R.stroke(R.curve(p0, p1, p2), r.line, legs);
      R.stroke(R.curve([p0[0] - s, p0[1] + 1], [p1[0] - s, p1[1] + 1], [p2[0], p2[1] + 1]), r.lt, legs);
      if (opt.rivets !== false) { R.fill(R.M().set(cx + s * 13, wy + 6), BRASS.hi); R.fill(R.M().set(cx + s * 13, wy + 7), BRASS.sh); }
      if (opt.whiskers !== false) {
        R.stroke(R.curve([cx + s * 3, V.crotchY], [cx + s * 5, V.crotchY - 1], [cx + s * 7, V.crotchY - 1]), r.hi, legs);
        R.stroke(R.curve([cx + s * 3, V.crotchY + 1], [cx + s * 5, V.crotchY], [cx + s * 7, V.crotchY]), r.sh, legs);
      }
    }
    if (opt.button !== false) button(R, cx, wy + 1, BRASS);
  } else if (isBack(R)) {
    // yoke: a V seam with a stitch above, centre seam down to the crotch
    const yk = x => wy + 4 + Math.round(Math.max(0, 2 - Math.abs(x - cx) / 6));
    const ykm = R.M(); for (let x = 22; x <= 58; x++) ykm.set(x, yk(x));
    ykm.and(legs);
    R.fill(ykm, r.dp);
    deepen(R, shifted(R, ykm, 0, 1).and(legs), r, -1);
    R.stroke(R.curve([cx, yk(cx) + 1], [cx, V.crotchY - 1], [cx, V.crotchY]), r.dp, legs);
    if (opt.backPockets !== false) for (const s of [-1, 1]) {
      const x0 = s < 0 ? cx - 12 : cx + 4, x1 = x0 + 8, y0 = wy + 6, y1 = V.crotchY + 1;
      const pk = R.M().poly([[x0, y0], [x1 + 1, y0], [x1 + 1, y1], [(x0 + x1 + 1) / 2, y1 + 1.5], [x0, y1]]).and(legs);
      R.paint(pk, r, { flat: true, round: 2.4, bias: .12 });
      R.stitch(R.curve([x0 + 1, y0 + 1], [(x0 + x1) / 2, y0 + 1], [x1, y0 + 1]), th, pk, 1, 1);
      R.stroke(R.curve([x0 + 2, y0 + 4], [(x0 + x1 + 1) / 2, y0 + 2], [x1 - 1, y0 + 4]), th, pk);
      cast(R, pk, legs, r, 1, 1);
    }
    if (opt.label !== false) { // leather label on the waistband
      const lb = R.M().rect(cx + 6, wy, cx + 10, wy + 3);
      R.paint(lb, LEATH, { flat: true, round: 1.2 });
      R.fill(R.M().rect(cx + 7, wy + 1, cx + 8, wy + 1), LEATH.hi);
      cast(R, lb, J.band, r, 1, 0);
    }
  } else {
    // side: front pocket scoop, outseam with a stitch running down the leg
    deepen(R, R.M().poly([[22.5, wy + 4], [25, wy + 7], [30, wy + 8], [30, wy + 4]]).and(legs), r, 1);
    R.stroke(R.curve([22, wy + 4], [24, wy + 7], [29, wy + 8]), r.line, legs);
    R.stroke(R.curve([22, wy + 5], [23, wy + 8], [29, wy + 9]), r.lt, legs);
    R.stroke(R.curve([31, wy + 4], [32, V.crotchY - 2], [32, V.crotchY]), r.dp, legs);
    R.stroke(R.curve([36, V.crotchY + 2], [36, V.kneeY], [37, J.end]), r.dp, legs);
    R.stitch(R.curve([37, V.crotchY + 2], [37, V.kneeY], [38, J.end]), th, legs, 1, 1);
  }
  if (opt.loops !== false) loops(R, r, view3(R, [cx - 11, cx + 11], [24], [cx - 12, cx, cx + 12]), wy - 1, wy + 4, legs, r);
}
item('bottom', 'jeans', 'Classic Jeans', '#4d74b8', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, J = jeansBase(R, r);
  jeansDetail(R, r, J);
  ankleStack(R, J.legs, r, J.end - 4);
  // turned-up cuffs show the paler reverse of the denim
  const c = cuff(R, J.legs, paler(r, .3), J.end - 2, J.end + 1, { grow: 1, stitch: stitchC(r) });
  cast(R, c, J.legs, r, 0, -1);
});
// vertical rib knit / elastic gathers: every P-th column one tone darker
const ribMap = (P = 2, then) => (x, y, t) => { t = ((x % P) + P) % P === 0 ? T5(t + 1) : t; return then ? then(x, y, t) : t; };
// drawstring: knot on the band at (x,y) and two cords with metal aglets (front view only)
function drawstring(R, x, y, len, rr, under, ramps) {
  if (!isFront(R)) return;
  const m = R.M();
  R.curve([x - 1, y], [x - 1.5, y + len / 2], [x - 2, y + len]).forEach(([a, b]) => m.set(a, b));
  R.curve([x + 1, y], [x + 1.5, y + len / 2], [x + 2, y + len - 1]).forEach(([a, b]) => m.set(a, b));
  cast(R, m, under, ramps, 1, 0);
  R.fill(m, rr.lt);
  R.fill(R.M().set(x - 1, y).set(x + 1, y), rr.base);
  R.fill(R.M().set(x, y), rr.sh);
  for (const [ax, ay] of [[x - 2, y + len], [x + 2, y + len - 1]]) { R.fill(R.M().set(ax, ay + 1), SILV.sh); R.fill(R.M().set(ax, ay), SILV.hi); }
}
// side stripe columns per view (outer side of each leg; the side seam in profile)
const STRIPE = { front: [27, 53], side: [35], back: [26, 54] };
function sideStripe(R, w = 1) {
  const V = R.V, xs = STRIPE[R.view];
  return (x, y) => y >= V.waistY + 4 && (!isSide(R) || y >= V.crotchY) && xs.some(c => x >= c - (c > V.cx || isSide(R) ? 0 : w - 1) && x <= c + (c > V.cx || isSide(R) ? w - 1 : 0));
}
// Bellows cargo pocket with a buttoned flap: own pieces, own outlines, cast shadows
function cargoPocket(R, r, legs, x0, y0, w, h, flip) {
  const clip = legs.clone().dilate(1).sub(handBlock(R)).keep((x, y) => isSide(R) || Math.abs(x - R.V.cx) > 4);
  const pk = R.M().rect(x0, y0 + 1, x0 + w - 1, y0 + h).and(clip);
  R.paint(pk, r, { flat: true, round: 2, bias: .04 });
  R.stroke(R.curve([x0 + 1, y0 + h - 1], [x0 + w / 2, y0 + h - 1], [x0 + w - 2, y0 + h - 1]), r.sh, pk); // bellows gusset
  R.stitch(R.curve([x0 + 1, y0 + 4], [x0 + 1, y0 + h - 2], [x0 + 1, y0 + h - 2]), r.lt, pk, 1, 1);
  cast(R, pk, legs, r, flip ? -1 : 1, 1);
  const fl = R.M().poly([[x0 - .5, y0 - .5], [x0 + w - .5, y0 - .5], [x0 + w - .5, y0 + 3.5], [x0 + w / 2, y0 + 4.5], [x0 - .5, y0 + 3.5]]).and(clip);
  R.paint(fl, r, { flat: true, round: 1.5, bias: .2 });
  cast(R, fl, pk, r, 0, 1);
  button(R, Math.round(x0 + w / 2 - .5), y0 + 2, BRASS, 2);
  return pk.add(fl);
}
// Play Shorts: soft cotton shorts with a gathered elastic waist, drawstring, white side piping,
// rolled hems, crotch folds and a stitched back pocket.
item('bottom', 'shorts', 'Play Shorts', '#f5d04a', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, end = V.crotchY + 5;
  const legs = legsMask(R, end, { loose: 1, looseFrom: V.crotchY - V.waistY });
  const S = spans(R, legs), pipe = sideStripe(R, 1), AC = contrast(r);
  const gap = gapOf(R, legs);
  R.paint(legs.clone().sub(gap), r, { flat: true, round: 5, toneMap: cylinder(S) });
  R.fill(gap, r.line);
  farLeg(R, legs, r, end);
  if (!isSide(R)) {
    deepen(R, R.M().ellipse(cx, V.crotchY + 1, 4, 2).and(legs), r, 1);
    folds(R, legs, r, [[[cx - 3, V.crotchY + 1], [cx - 5, V.crotchY + 2], [cx - 8, end - 2], 2], [[cx + 3, V.crotchY + 1], [cx + 5, V.crotchY + 2], [cx + 8, end - 2], 2, 1],
      [[cx - 13, V.waistY + 5], [cx - 10, V.waistY + 7], [cx - 6, V.waistY + 8], 1], [[cx + 13, V.waistY + 5], [cx + 10, V.waistY + 7], [cx + 6, V.waistY + 8], 1, 1]]);
  } else folds(R, legs, r, [[[23, V.waistY + 6], [26, V.waistY + 9], [29, V.crotchY + 1], 2], [[44, V.crotchY + 1], [41, V.crotchY + 3], [38, end - 1], 2, 1]]);
  if (isBack(R)) { // patch pocket with a little tab
    const pk = R.M().rect(cx + 4, V.waistY + 5, cx + 11, V.crotchY);
    R.paint(pk, r, { flat: true, round: 2, bias: .1 });
    R.stitch(rowPts(pk, V.waistY + 6), r.sh, pk, 1, 1);
    R.fill(R.M().rect(cx + 10, V.waistY + 7, cx + 11, V.waistY + 8), REDC.base);
    cast(R, pk, legs, r, 1, 1);
  }
  recolor(R, legs.clone().keep(pipe), r, AC, null, stripeTone);
  const band = waistband(R, r, V.waistY, V.waistY + 3, { toneMap: ribMap(2), bias: .16 });
  cast(R, band, legs, [r, AC], 0, 1);
  drawstring(R, cx, V.waistY + 2, 5, AC, legs, [r, AC]);
  const CF = paler(r, .2), c = cuff(R, legs, CF, end - 3, end, { grow: 1 });
  R.stroke(rowPts(c, end - 2), CF.hi, c);
  recolor(R, c.clone().keep((x, y) => y === end - 1), CF, AC);
  cast(R, c, legs, [r, AC], 0, -1);
});

// Joggers: fleece sweatpants with a wide ribbed waist, drawstring, twin side stripes, baggy legs
// that blouse over ribbed ankle cuffs, and knee creases.
item('bottom', 'joggers', 'Joggers', '#8b8fa3', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, end = V.footY - 1;
  const legs = legsMask(R, end - 4, { loose: 1, looseFrom: 6 }).add(legsMask(R, end));
  const S = spans(R, legs), gap = gapOf(R, legs);
  const st = sideStripe(R, 2), AC = contrast(r);
  R.paint(legs.clone().sub(gap), r, { flat: true, round: 5, toneMap: cylinder(S) });
  R.fill(gap, r.line);
  farLeg(R, legs, r, end);
  const rr = r;
  if (!isSide(R)) deepen(R, R.M().ellipse(cx, V.crotchY + 1, 4, 2).and(legs), r, 1);
  kneeFolds(R, legs, rr);
  // blousing: folds converging into the ankle cuff
  if (isSide(R)) folds(R, legs, rr, [[[30, end - 6], [33, end - 4], [36, end - 4], 2], [[45, end - 6], [42, end - 5], [39, end - 4], 2, 1], [[31, end - 9], [35, end - 8], [40, end - 9], 1]]);
  else for (const [a, b] of legsOf(R)) folds(R, legs, rr, [[[a, end - 7], [a + 2, end - 5], [a + 5, end - 4], 2], [[b + 1, end - 7], [b - 1, end - 5], [b - 4, end - 4], 2, 1], [[a + 3, end - 9], [a + 6, end - 8], [b - 3, end - 9], 1]]);
  recolor(R, legs.clone().keep((x, y) => st(x, y) && y < end - 3), r, AC, null, stripeTone);
  // ribbed ankle cuffs, snug on the ankle
  const cf = rows(legsMask(R, end), end - 3, end).sub(gap);
  R.paint(cf, r, { flat: true, round: 1.4, bias: .02, toneMap: ribMap(2) });
  cast(R, cf, legs, rr, 0, -1);
  hemShadow(R, cf, 2);
  // back patch pocket
  if (isBack(R)) {
    const pk = R.M().rect(cx + 4, V.waistY + 6, cx + 10, V.crotchY);
    R.paint(pk, r, { flat: true, round: 2, bias: .08 });
    cast(R, pk, legs, r, 1, 1);
  } else if (isFront(R)) for (const s of [-1, 1]) { // slanted side pockets
    R.stroke(R.curve([cx + s * 9, V.waistY + 5], [cx + s * 11, V.waistY + 7], [cx + s * 13, V.waistY + 10]), r.line, legs);
    R.stroke(R.curve([cx + s * 9 - s, V.waistY + 5], [cx + s * 11 - s, V.waistY + 7], [cx + s * 13 - s, V.waistY + 10]), r.lt, legs);
  }
  const band = waistband(R, r, V.waistY, V.waistY + 4, { toneMap: ribMap(2), bias: .1 });
  R.stroke(rowPts(band, V.waistY + 2), r.sh, band);
  cast(R, band, legs, [r, AC], 0, 1);
  drawstring(R, cx, V.waistY + 2, 6, AC, legs, [r, AC]);
});

// Cargo Shorts / Cargo Pants: rugged twill with a webbing belt and buckle, bellows thigh pockets with
// buttoned flaps, slant pockets, a stitched fly and turned-up cuffs (or bunched ankles).
function cargoBase(R, r, end, long) {
  const V = R.V, cx = V.cx;
  const legs = legsMask(R, end, { loose: 1, looseFrom: V.crotchY - V.waistY - 2 });
  const S = spans(R, legs), gap = gapOf(R, legs);
  R.paint(legs.clone().sub(gap), r, { flat: true, round: 5, toneMap: cylinder(S) });
  R.fill(gap, r.line);
  farLeg(R, legs, r, end);
  if (!isSide(R)) deepen(R, R.M().ellipse(cx, V.crotchY + 1, 4, 2).and(legs), r, 1);
  if (long) kneeFolds(R, legs, r, V.kneeY + 1);
  // pockets
  const py = long ? V.crotchY + 2 : V.crotchY;
  if (isFront(R)) {
    cargoPocket(R, r, legs, 23, py, 6, 6);
    cargoPocket(R, r, legs, 52, py, 6, 6, true);
    for (const s of [-1, 1]) {
      R.stroke(R.curve([cx + s * 8, V.waistY + 4], [cx + s * 11, V.waistY + 6], [cx + s * 13, V.waistY + 9]), r.line, legs);
      R.stroke(R.curve([cx + s * 7, V.waistY + 4], [cx + s * 10, V.waistY + 6], [cx + s * 12, V.waistY + 9]), r.lt, legs);
    }
    R.stroke(R.curve([cx + 1, V.waistY + 4], [cx + 1, V.waistY + 7], [cx, V.crotchY]), r.line, legs);
    R.stitch(R.curve([cx + 3, V.waistY + 4], [cx + 3, V.crotchY - 1], [cx + 1, V.crotchY]), r.dp, legs, 1, 1);
  } else if (isSide(R)) {
    cargoPocket(R, r, legs, 31, V.crotchY + (long ? 2 : 0), 9, 7);
    R.stroke(R.curve([22, V.waistY + 4], [24, V.waistY + 7], [29, V.waistY + 9]), r.line, legs);
  } else {
    cargoPocket(R, r, legs, 22, py, 6, 6);
    cargoPocket(R, r, legs, 53, py, 6, 6, true);
    for (const s of [-1, 1]) { // back welt pockets with flaps
      const x0 = s < 0 ? cx - 11 : cx + 4, fl = R.M().rect(x0, V.waistY + 5, x0 + 7, V.waistY + 7);
      R.paint(fl, r, { flat: true, round: 1.2, bias: .12 });
      cast(R, fl, legs, r, 0, 1);
      button(R, x0 + 3, V.waistY + 6, darker(r), 2);
    }
    R.stroke(R.curve([cx, V.waistY + 4], [cx, V.crotchY - 2], [cx, V.crotchY]), r.dp, legs);
  }
  // webbing belt with a metal buckle
  const web = ramp(mix(r.dp, [60, 56, 48], .4));
  const belt = waistband(R, web, V.waistY, V.waistY + 3, { bias: .12 });
  R.stitch(rowPts(belt, V.waistY + 1), web.lt, belt, 1, 1);
  cast(R, belt, legs, r, 0, 1);
  if (isFront(R)) { buckle(R, cx - 3, V.waistY - 1, cx + 2, V.waistY + 4, SILV); R.fill(R.M().rect(cx + 3, V.waistY + 1, cx + 6, V.waistY + 2), web.lt); }
  else if (isSide(R)) R.fill(R.M().rect(21, V.waistY + 1, 23, V.waistY + 2), SILV.hi);
  loops(R, r, view3(R, [cx - 12, cx + 12], [26], [cx - 12, cx, cx + 12]), V.waistY - 1, V.waistY + 4, legs, r);
  return { legs, S, gap };
}
item('bottom', 'cargo', 'Cargo Shorts', '#a8946a', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, end = V.kneeY + 1, C = cargoBase(R, r, end, false);
  const c = cuff(R, C.legs, paler(r, .2), end - 3, end, { grow: 1, stitch: r.sh });
  cast(R, c, C.legs, r, 0, -1);
});
item('bottom', 'cargopants', 'Cargo Pants', '#6f7d4e', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, end = V.footY - 1, C = cargoBase(R, r, end, true);
  // ankles: drawcord hem cinched over the shoe with bunching above
  ankleStack(R, C.legs, r, end - 3);
  const cf = rows(legsMask(R, end), end - 1, end).sub(C.gap);
  R.paint(cf, r, { flat: true, round: 1.2, bias: .04, toneMap: ribMap(3) });
  hemShadow(R, cf, 2);
  if (!isBack(R)) for (const [a, b] of legsOf(R)) { // cord toggles
    const tx = isSide(R) ? 29 : a + 1;
    R.fill(R.M().set(tx, end + 1), SNOW.sh); R.fill(R.M().set(tx, end), SILV.hi);
  }
});

// Overalls: denim bib-and-brace with a stitched bib pocket and a heart patch, brass clasps on the
// straps, side buttons, back cross straps and rolled cuffs.
item('bottom', 'overalls', 'Overalls', '#6b8fd0', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, end = V.footY - 1, th = stitchC(r);
  const J = jeansBase(R, r, { knees: true });
  ankleStack(R, J.legs, r, end - 4);
  const c = cuff(R, J.legs, paler(r, .3), end - 2, end + 1, { grow: 1, stitch: th });
  cast(R, c, J.legs, r, 0, -1);
  const torso = R.body((x, y, p) => p === 'torso');
  if (isFront(R)) {
    // bib
    const bib = R.M().poly([[cx - 8.5, 77.5], [cx + 8.5, 77.5], [cx + 9.5, V.waistY + 1.5], [cx - 9.5, V.waistY + 1.5]]).and(torso);
    R.paint(bib, r, { flat: true, round: 3, bias: .06 });
    R.stitch(R.curve([cx - 7, 79], [cx, 79], [cx + 7, 79]), th, bib, 1, 1);
    const pk = R.M().rect(cx - 4, 82, cx + 4, 89);
    R.paint(pk, r, { flat: true, round: 2, bias: .12 });
    R.stitch(rowPts(pk, 83), th, pk, 1, 1);
    R.fill(R.M().rect(cx - 1, 85, cx - 1, 86).rect(cx + 1, 85, cx + 1, 86).set(cx, 86).set(cx, 87), REDC.base);
    R.fill(R.M().set(cx - 1, 85), REDC.hi);
    cast(R, pk, bib, r, 1, 1);
    cast(R, bib, R.body(() => true), [], 0, 1);
    // straps over the shoulders with brass clasps
    for (const s of [-1, 1]) {
      const st = R.M().line(cx + s * 7, 79, cx + s * 11, 67, 3).and(R.body((x, y, p) => p === 'torso' || p === 'arm'));
      R.paint(st, r, { flat: true, round: 1.2, bias: .1 });
      R.shadow(st, { dx: 1, dy: 1, tint: [.85, .8, .9] });
      const bx = cx + s * 7 - 1;
      sprite(R, bx - 1, 77, ['LLLL', 'LHBL', 'LBSL', 'LLLL'], BRASS);
      R.fill(R.M().set(bx, 78), BRASS.spec);
    }
    for (const s of [-1, 1]) button(R, cx + s * 12, V.waistY + 2, BRASS);
  } else if (isBack(R)) {
    const st = R.M().line(cx - 10, 67, cx + 6, V.waistY + 1, 3).line(cx + 10, 67, cx - 6, V.waistY + 1, 3).and(torso);
    R.paint(st, r, { flat: true, round: 1.2, bias: .1 });
    R.shadow(st, { dx: 1, dy: 1, tint: [.85, .8, .9] });
    const pt = R.M().ellipse(cx, 80, 3, 2.5);
    R.paint(pt, r, { flat: true, round: 2, bias: .14 });
    R.fill(R.M().set(cx, 80), BRASS.hi);
    jeansDetail(R, r, J, { loops: false, label: false });
  } else {
    const bib = R.M().poly([[20.5, 77.5], [26.5, 77.5], [27.5, V.waistY + 1.5], [20.5, V.waistY + 1.5]]).and(torso);
    R.paint(bib, r, { flat: true, round: 2.5, bias: .06 });
    R.stitch(colPts(bib, 25), th, bib, 1, 1);
    const st = R.M().line(24, 78, 29, 70, 3).and(torso);
    R.paint(st, r, { flat: true, round: 1.2, bias: .1 });
    sprite(R, 22, 77, ['LLLL', 'LHBL', 'LBSL', 'LLLL'], BRASS);
    button(R, 30, V.waistY + 2, BRASS);
  }
  if (isFront(R)) jeansDetail(R, r, J, { loops: false, button: false, whiskers: false });
});

// Suspender Shorts: tailored shorts with pressed cuffs and buttoned braces (X-back) with silver clips.
item('bottom', 'suspenders', 'Suspender Shorts', '#3f5a8f', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, end = V.crotchY + 6;
  const legs = legsMask(R, end, { loose: 1, looseFrom: V.crotchY - V.waistY });
  const S = spans(R, legs), gap = gapOf(R, legs);
  R.paint(legs.clone().sub(gap), r, { flat: true, round: 5, toneMap: cylinder(S) });
  R.fill(gap, r.line);
  farLeg(R, legs, r, end);
  // pressed front creases
  if (!isSide(R)) {
    deepen(R, R.M().ellipse(cx, V.crotchY + 1, 4, 2).and(legs), r, 1);
    for (const [a, b] of legsOf(R)) R.stroke(R.curve([Math.round((a + b) / 2), V.waistY + 4], [Math.round((a + b) / 2), V.crotchY + 2], [Math.round((a + b) / 2), end - 3]), r.hi, legs);
    if (isFront(R)) {
      R.stroke(R.curve([cx, V.waistY + 4], [cx, V.waistY + 7], [cx, V.crotchY]), r.line, legs);
      for (const s of [-1, 1]) R.stroke(R.curve([cx + s * 9, V.waistY + 4], [cx + s * 11, V.waistY + 7], [cx + s * 13, V.waistY + 8]), r.line, legs);
    }
  } else {
    R.stroke(R.curve([31, V.crotchY + 1], [30, V.crotchY + 4], [30, end - 3]), r.hi, legs);
    R.stroke(R.curve([22, V.waistY + 4], [24, V.waistY + 7], [29, V.waistY + 9]), r.line, legs);
  }
  const band = waistband(R, r, V.waistY, V.waistY + 3, { bias: .12 });
  cast(R, band, legs, r, 0, 1);
  const c = cuff(R, legs, r, end - 3, end, { grow: 1, bias: .14 });
  R.stroke(rowPts(c, end - 1), r.sh, c);
  cast(R, c, legs, r, 0, -1);
  // braces
  const hue = rgbHsl(r.base)[0], reddish = rgbHsl(r.base)[1] > .25 && (hue < 25 || hue > 300);
  const BR = reddish ? NAVY : REDC, torso = R.body((x, y, p) => p === 'torso' || p === 'arm');
  const st = R.M();
  if (isFront(R)) for (const s of [-1, 1]) st.line(cx + s * 8, V.waistY + 2, cx + s * 11, 67, 4);
  else if (isBack(R)) st.line(cx - 10, 67, cx + 7, V.waistY + 2, 4).line(cx + 10, 67, cx - 7, V.waistY + 2, 4);
  else st.line(23, V.waistY + 2, 28, 70, 4);
  st.and(torso).keep((x, y) => R.part(x, y) !== 'arm' || y < 72);
  R.paint(st, BR, { flat: true, round: 1.6, bias: .12 });
  R.shadow(st, { dx: 1, dy: 1, tint: [.86, .8, .9] });
  if (isFront(R)) for (const s of [-1, 1]) { // clips
    const x = cx + s * 8 - 1, y = V.waistY - 2;
    sprite(R, x - 1, y, ['LLLL', 'LHBL', 'LBSL', 'LLLL'], SILV);
    R.fill(R.M().set(x, y + 1), SILV.spec);
  } else if (isBack(R)) { // leather crossing patch
    const pt = R.M().poly([[cx - 3, 77], [cx + 3, 77], [cx + 2, 83], [cx - 2, 83]]);
    R.paint(pt, LEATH, { flat: true, round: 1.5 });
    R.fill(R.M().set(cx - 1, 78), LEATH.hi);
    for (const s of [-1, 1]) button(R, cx + s * 7, V.waistY + 1, GOLDM);
  } else button(R, 23, V.waistY + 1, GOLDM);
});
// ---- skirts ----
// Skirt geometry: hugs the waist at y0, rounds over the hips, flares out to the hem at y1.
// Front/back hems dip at the centre for a little top-down perspective.
//  u(x,y): 0 at the skirt's left edge .. 1 at its right edge (pleats and patterns follow the flare)
function skirtGeo(R, y0, y1, flare, opt = {}) {
  const V = R.V, side = isSide(R);
  const L = side ? 20 : V.torsoL, Rr = side ? 51 : V.torsoR, mid = (L + Rr) / 2;
  const hip = Math.min(opt.hip ?? 2, flare), dip = opt.dip ?? (side ? 0 : 1.6);
  const k = y => Math.max(0, Math.min(1, (y - y0) / Math.max(1, y1 - y0)));
  const out = y => { const t = k(y); return hip * Math.min(1, t * (opt.hipRate ?? 3)) + (flare - hip) * Math.pow(t, opt.bell ?? 1); };
  // edges cached per row (u() is evaluated several times per pixel by pleats and patterns)
  const XL = new Map(), XR = new Map();
  const xl = y => { let v = XL.get(y); if (v === undefined) XL.set(y, v = L - out(y) * (side ? opt.front ?? .8 : 1)); return v; };
  const xr = y => { let v = XR.get(y); if (v === undefined) XR.set(y, v = Rr + out(y) * (side ? opt.back ?? 1.1 : 1)); return v; };
  const half = (Rr - L) / 2 + flare;
  const hemY = x => y1 - (side ? (opt.sideTilt ?? 0) * (x - mid) / half : dip * ((x - mid) / half) ** 2);
  const u = (x, y) => (x - xl(y)) / Math.max(1, xr(y) - xl(y));
  const m = R.M();
  for (let y = y0; y <= y1 + 1; y++) for (let x = Math.ceil(xl(y) - .3); x <= Math.floor(xr(y) + .3); x++) if (y <= hemY(x) + .3) m.set(x, y);
  if (opt.keep) m.keep(opt.keep);
  const full = m.clone();
  if (opt.hands !== false) m.sub(armHand(R));
  return { m, full, xl, xr, u, hemY, y0, y1, L, Rr, mid, keep(fn) { m.keep(fn); full.keep(fn); return this; } };
}
// Knife pleats: every pleat is a lit face, a plain face and a 1px dark crease where it folds under.
//  n pleats across the visible width; returns a toneMap and the crease test (for hem notches)
function pleatMap(G, n, then, opt = {}) {
  const ph = opt.phase ?? 0, lit = opt.lit ?? .5;
  const v = (x, y) => G.u(x, y) * n + ph;
  const crease = (x, y) => Math.floor(v(x, y)) !== Math.floor(v(x - 1, y));
  const tm = (x, y, t) => {
    const top = y < G.y0 + (opt.sewn ?? 0), p = v(x, y) - Math.floor(v(x, y));
    if (crease(x, y)) t = top ? t + 1 : Math.max(t + 1, opt.deep ?? 4);
    else if (!top && p < lit) t -= 1;
    else if (!top && p > .9 && opt.under) t += 1;
    t = T5(t);
    return then ? then(x, y, t) : t;
  };
  return { tm, crease };
}
// notch the hem at every pleat crease so the bottom edge zig-zags
function notchHem(G, crease) {
  G.keep((x, y) => !(y >= Math.floor(G.hemY(x)) && crease(x, y) && G.full.has(x, y - 1)));
}
// Paint a skirt as if it continued behind the hands (so its shading and outline ignore them),
// then put the hands back and let them shade the cloth right behind them.
function skirtPaint(R, G, rr, opts, mask) {
  behindHands(R, G, rr, () => R.paint(mask || G.full, rr, opts));
}
function behindHands(R, G, rr, draw) {
  const hands = armHand(R);
  sheer(R, hands, 1, draw);
  R.shadow(hands, { dx: 1, dy: 1, tint: [.84, .76, .88], only: (x, y) => G.m.has(x, y) });
  // where bare hand skin meets the cloth (no body contour there), outline the cloth
  const skin = (x, y) => hands.has(x, y) && R.bodyIdx(x, y) > 2;
  const e = R.M(); G.m.each((x, y) => { if (skin(x - 1, y) || skin(x + 1, y) || skin(x, y - 1) || skin(x, y + 1)) e.set(x, y); });
  R.fill(e, rr.line);
}
// a skirt's waistband: the top rows of the skirt mask, own outline, with a stitch row
function skirtBand(R, G, rr, h = 3, opt = {}) {
  const m = rows(G.m, G.y0, G.y0 + h);
  R.paint(m, rr, { flat: true, round: 1.6, bias: opt.bias ?? .1, toneMap: opt.toneMap });
  if (opt.stitch) R.stitch(rowPts(m, G.y0 + h - 1), opt.stitch, m, 1, 1);
  return m;
}
// soft shadow of a skirt over the thighs below it (and the skin-tight things on them)
function skirtShadow(R, G, len = 3) {
  hemShadow(R, G.m, len);
  // ambient occlusion right under the hem, between the legs
  const occ = R.M(); G.m.each((x, y) => { if (!G.m.has(x, y + 1)) occ.set(x, y + 1); });
  R.tint(occ, [.92, .86, .9], isLegSkin(R));
}

// Pleated Skirt: a school skirt with knife pleats (alternating lit and shaded faces), a notched hem,
// a buttoned waistband with a side tab, and a soft shadow on the legs.
item('bottom', 'pleated', 'Pleated Skirt', '#e0475a', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, G = skirtGeo(R, V.waistY, V.crotchY + 8, 7, { hip: 2.5, dip: .7 });
  const P = pleatMap(G, isSide(R) ? 6 : 7, null, { sewn: 6, phase: .5 });
  notchHem(G, P.crease);
  skirtPaint(R, G, r, { flat: true, round: 7, toneMap: P.tm });
  // stitched-down pleat tops: short seams under the band
  const band = skirtBand(R, G, r, 3, { stitch: r.sh });
  cast(R, band, G.m, r, 0, 1);
  if (isFront(R)) { button(R, V.cx + 9, G.y0 + 1, GOLDM); R.stroke([[V.cx + 11, G.y0 + 1], [V.cx + 11, G.y0 + 2]], r.dp, band); }
  if (isSide(R)) { // zip placket on the hip
    R.stroke(R.curve([22, G.y0 + 4], [22, G.y0 + 7], [22, G.y0 + 9]), r.dp, G.m);
    R.fill(R.M().set(22, G.y0 + 4), SILV.hi);
  }
  skirtShadow(R, G);
});

// Plaid Skirt: tartan kilt with pleats, an overlapping fringed apron edge and a gold kilt pin.
item('bottom', 'plaid', 'Plaid Skirt', '#2c6b4f', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, G = skirtGeo(R, V.waistY, V.crotchY + 7, 6, { hip: 2.5, dip: .7 });
  const P = pleatMap(G, isSide(R) ? 6 : 7, null, { sewn: 5, deep: 3 });
  notchHem(G, P.crease);
  const dk = ramp(mix(mix(r.base, r.dp, .38), [46, 52, 120], .18)), dd = ramp(mix(mix(r.base, r.dp, .68), [30, 30, 80], .18));
  const acc = ramp(mix(r.base, [250, 220, 110], .75)), red = ramp(mix(r.base, [214, 58, 74], .7));
  const W0 = G.Rr - G.L;
  const tartan = (x, y) => {
    const cu = Math.round(G.u(x, y) * W0), a = ((cu % 9) + 9) % 9, b = (((y - G.y0 - 2) % 9) + 9) % 9;
    const va = a < 3, hb = b < 2;
    const inner = G.u(x, y) > .06 && G.u(x, y) < .94;
    if (a === 6 && !hb && inner) return acc;
    if (b === 5 && !va && inner) return red;
    if (va && hb) return dd;
    if (va || hb) return dk;
    return null;
  };
  skirtPaint(R, G, r, { flat: true, round: 7, toneMap: P.tm, pattern: tartan, bias: .14 });
  const band = skirtBand(R, G, dk, 3, { stitch: dk.lt });
  cast(R, band, G.m, [r, dk, dd, acc, red], 0, 1);
  if (isFront(R)) { // apron edge with fringe and a kilt pin
    const ex = V.cx + 8, edge = R.curve([ex, G.y0 + 4], [ex + .5, (G.y0 + G.y1) / 2], [ex + 3, G.y1 + 1]);
    deepen(R, R.M().poly([[ex + 1, G.y0 + 4], [ex + 5, G.y0 + 4], [ex + 8, G.y1 + 1], [ex + 3, G.y1 + 1]]).and(G.m), [r, dk, dd, acc, red], 1);
    R.stroke(edge, r.line, G.m);
    R.stroke(edge.map(([x, y]) => [x - 1, y]), r.lt, G.m);
    const fr = R.M(); edge.forEach(([x, y]) => { if (y > G.y0 + 5 && y % 2 === 0) fr.set(x - 2, y); });
    R.fill(fr.and(G.m), acc.hi);
    // kilt pin: gold bar with a ball head and a little red charm
    const px = ex - 3, py = G.y1 - 8;
    const pin = R.M().rect(px - 1, py + 1, px + 1, py + 5);
    R.fill(pin, GOLDM.line);
    R.stroke([[px, py + 2], [px, py + 3], [px, py + 4]], GOLDM.base);
    R.fill(R.M().set(px, py + 2), GOLDM.hi); R.fill(R.M().set(px, py + 4), GOLDM.sh);
    sprite(R, px - 1, py - 1, ['LHL', 'HWB', 'LBL'], GOLDM);
    R.gem(px + 2, py + 5, 1, RED);
    cast(R, pin, G.m, [r, dk, dd, acc, red], 1, 1);
  }
  skirtShadow(R, G);
});
// scalloped bottom edge: keep pixels above a row of half-circles of period P hanging from yb
const scallop = (yb, P = 4, d = 1.5, ph = 0) => (x, y) => {
  const t = ((((x + ph) % P) + P) % P + .5) / P - .5;
  return y <= yb - d + Math.round(d * Math.sqrt(Math.max(0, 1 - 4 * t * t)) - .2);
};
// Ballet Tutu: a satin basque with a pointed front and bow, three tiers of gathered tulle with
// scalloped edges (palest on top), sequin glints and a soft shadow on the legs.
item('bottom', 'tutu', 'Ballet Tutu', '#f7a8c4', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = isSide(R) ? 36 : V.cx, wy = V.waistY, side = isSide(R);
  // three flat tulle discs stacked at hip level; their wide edges flare out under the hands
  const tiers = [
    { cy: wy + 10, rx: 27, ry: 3.5, ramp: r, ph: 2 },
    { cy: wy + 8, rx: 23, ry: 3.5, ramp: paler(r, .3), ph: 0 },
    { cy: wy + 5.5, rx: 19, ry: 3.5, ramp: paler(r, .55), ph: 1 },
  ];
  const all = R.M(), hands = R.body((x, y, p) => p === 'hand' && y > wy && !isFake(R, x, y));
  sheer(R, hands, .5, () => {
    for (const T of tiers) {
      const sx = side ? T.rx * .9 : T.rx, ox = cx + (side ? 2 : 0), m = R.M().ellipse(ox, T.cy, sx, T.ry);
      const hw = side ? 15 : 15.5;
      m.add(R.M().poly([[ox - hw, wy + 1], [ox + hw, wy + 1], [ox + sx, T.cy], [ox - sx, T.cy]]));
      m.keep((x, y) => y >= wy + 1).keep(scallop(Math.round(T.cy + T.ry), 4, 1.6, T.ph));
      const G = { u: (x) => (x - (ox - sx)) / (2 * sx), y0: wy };
      const P = pleatMap(G, side ? 12 : 15, null, { lit: .45, deep: 2 });
      R.paint(m, T.ramp, { flat: true, round: 3.5, toneMap: P.tm, bias: .06 });
      if (all.empty()) hemShadow(R, m, 3); else cast(R, m, all, tiers.map(t => t.ramp), 0, 1);
      all.add(m);
    }
  });
  // sequin glints on the top tier
  const top = tiers[2];
  for (const [dx, dy] of [[-12, -3], [-5, -1], [3, -2], [10, -3], [15, -1], [-17, -1]]) {
    const x = cx + (side ? Math.round(dx * .85) : dx), y = Math.round(top.cy + 2 + dy);
    if (all.has(x, y)) { R.fill(R.M().set(x, y), [255, 255, 255]); R.fill(R.M().set(x + 1, y + 1), top.ramp.lt); }
  }
  // satin basque, pointed at the front
  const SAT = paler(r, .3);
  const bq = R.body((x, y, p) => p === 'torso' && y >= wy - 4 && y <= wy + (isFront(R) ? 3 - Math.min(3, Math.abs(x - cx) / 3) : 1));
  R.paint(bq, SAT, { flat: true, round: 2.5, bias: .04 });
  cast(R, bq, all, tiers.map(t => t.ramp), 0, 1);
  R.stroke(rowPts(bq, wy - 3), SAT.hi, bq);
  if (isFront(R)) { // little satin bow + pearl
    sprite(R, cx - 3, wy - 5, ['LL...LL', 'LHL.LBL', 'LTBHBSL', 'LSL.LDL', 'LL.L.LL'], r);
    R.gem(cx, wy - 3, 1, SNOW);
  } else if (isBack(R)) { // lacing at the back
    for (let y = wy - 3; y <= wy; y += 2) R.stroke([[cx - 1, y], [cx + 1, y + 1]], SAT.line, bq);
  }
});

// Long Skirt: flowing A-line skirt with a tied sash and ribbon tails, long soft drape folds, a gathered
// flounce, a white lace edge and a shadow over the shoes.
item('bottom', 'maxi', 'Long Skirt', '#b9a0ef', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, y1 = V.footY + 1;
  const G = skirtGeo(R, V.waistY, y1, 10, { hip: 2.5, bell: 1.25, dip: 1.2 });
  const fy = y1 - 5; // flounce seam
  const body = G.m.clone().keep((x, y) => y <= fy + 1);
  const W = (y) => G.xr(y) - G.xl(y);
  // long folds that open toward the hem: dark trough on the right of each ridge
  const fu = isSide(R) ? [.25, .55, .8] : [.17, .38, .6, .82];
  const drape = (x, y, t) => {
    const k = (y - G.y0) / (fy - G.y0); if (k < .2) return t;
    const u = G.u(x, y);
    for (const f of fu) {
      const d = (u - f) * W(y), wide = 1 + 2.2 * k;
      if (d > 0 && d < wide) return T5(t + (d < wide * .55 ? 2 : 1));
      if (d <= 0 && d > -1.6 * k) return T5(t - 1);
    }
    return t;
  };
  skirtPaint(R, G, r, { flat: true, round: 8, toneMap: drape }, G.full.clone().keep((x, y) => y <= fy + 1));
  // flounce: gathered tier, a pixel wider, scalloped by its gathers
  const fl = G.m.clone().keep((x, y) => y >= fy - 1);
  fl.add(fl.clone().dilate(1).keep((x, y) => y >= fy && y <= y1 + 1)).sub(handBlock(R));
  const P = pleatMap({ u: (x, y) => G.u(x, Math.min(y, y1)), y0: fy }, isSide(R) ? 9 : 12, null, { lit: .5, deep: 3 });
  fl.keep((x, y) => !(y >= y1 && P.crease(x, y)));
  R.paint(fl, r, { flat: true, round: 2.5, toneMap: P.tm, bias: .06 });
  cast(R, fl, body, r, 0, -1);
  // lace edge
  const lace = R.M(); fl.each((x, y) => { if (!fl.has(x, y + 1)) lace.set(x, y + 1); });
  lace.keep(scallop(y1 + 2, 3, 1)).sub(handBlock(R));
  R.fill(lace, SNOW.lt);
  R.fill(lace.clone().keep((x, y) => x % 3 === 1), SNOW.sh);
  hemShadow(R, fl.clone().add(lace), 2);
  // sash with a side bow and ribbon tails
  const SA = darker(r);
  const sash = skirtBand(R, G, SA, 3, { bias: .12 });
  R.stroke(rowPts(sash, G.y0 + 1), SA.lt, sash);
  cast(R, sash, body, r, 0, 1);
  // bow with ribbon tails: front centre, at the hip in profile, centre back
  const bx = view3(R, cx, 23, cx), by = G.y0 + 1;
  const tails = R.lock([bx - 1, by + 2], [bx - 2, by + 6], [bx - 4, by + 10], 3, 2).add(R.lock([bx + 1, by + 2], [bx + 2, by + 6], [bx + 3, by + 9], 3, 2));
  R.paint(tails, SA, { flat: true, round: 1.4, bias: .28 });
  cast(R, tails, body, r, 1, 1);
  const bow = sprite(R, bx - 4, by - 2, ['LLL...LLL', 'LHTL.LBSL', 'LTBBLBBSL', 'LTBLHLBDL', 'LLL.L.LLL'], SA);
  R.fill(R.M().set(bx, by), SA.spec);
  cast(R, bow, sash, SA, 1, 1);
});

// Pumpkin Shorts: puffed bloomers gathered into lobes, an elastic waist with a bow,
// elastic leg bands and a white lace frill on each leg.
item('bottom', 'bloomer', 'Pumpkin Shorts', '#f08a3c', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, end = V.crotchY + 6, wy = V.waistY;
  // puffed profile: bulges out between the waist and the elastic leg band
  const m = legsMask(R, end), hb = handBlock(R);
  const L0 = isSide(R) ? 21 : V.torsoL, R0 = isSide(R) ? 50 : V.torsoR;
  for (let y = wy + 1; y <= end - 2; y++) {
    const t = (y - wy) / (end - 1 - wy), b = Math.round(3.3 * Math.sin(Math.PI * Math.pow(Math.min(1, t * .97 + .03), 2.2)));
    m.rect(L0 - b, y, L0, y); if (!isSide(R)) m.rect(R0, y, R0 + b, y);
    if (!isSide(R) && y > V.crotchY) { const bi = Math.min(1, b - 2); if (bi > 0) m.rect(V.cx - 3 - bi, y, V.cx - 3, y).rect(V.cx + 3, y, V.cx + 3 + bi, y); }
  }
  m.keep((x, y) => y >= wy && y <= end && (isSide(R) || y < V.crotchY + 1 || Math.abs(x - cx) > 2)).sub(hb);
  const S = spans(R, m, false), gap = gapOf(R, m);
  const G = { u: S.u, y0: wy + 3 };
  const P = pleatMap(G, isSide(R) ? 5 : 4, cylinder(S), { lit: .5, deep: 4 });
  R.paint(m.clone().sub(gap), r, { flat: true, round: 6, toneMap: P.tm });
  R.fill(gap, r.line);
  if (!isSide(R)) deepen(R, R.M().ellipse(cx, V.crotchY + 1, 4, 2.5).and(m), r, 1);
  // elastic leg bands + lace frill
  const lb = rows(m, end - 1, end).sub(gap);
  R.paint(lb, r, { flat: true, round: 1, bias: .02, toneMap: ribMap(2) });
  const fr = R.M(); lb.each((x, y) => { if (y === end) for (let k = 1; k <= 3; k++) fr.set(x, y + k); });
  fr.add(fr.clone().dilate(1).keep((x, y) => y > end && y <= end + 3)).sub(gap).sub(hb);
  if (!isSide(R)) fr.keep((x, y) => Math.abs(x - cx) > 2);
  fr.keep(scallop(end + 3, 4, 1, 1));
  const top = (x, y) => y === end + 1 && fr.has(x - 1, y) && fr.has(x + 1, y);
  R.paint(fr, SNOW, { flat: true, round: 1.6, bias: .18, edge: (x, y) => (top(x, y) ? TONE.LT : null) });
  fr.each((x, y) => { if (y === end + 2 && x % 3 === 0 && fr.has(x, y + 1) && fr.has(x - 1, y) && fr.has(x + 1, y)) R.fill(R.M().set(x, y), SNOW.sh); });
  hemShadow(R, fr, 2);
  // gathered waistband with a bow
  const band = waistband(R, r, wy, wy + 2, { toneMap: ribMap(2), bias: .16 });
  cast(R, band, m, r, 0, 1);
  if (isFront(R)) sprite(R, cx - 3, wy - 1, ['LL...LL', 'LHL.LBL', 'LTBHBSL', 'LSL.LDL', 'LL.L.LL'], darker(r));
  else if (isSide(R)) sprite(R, 20, wy - 1, ['LL.', 'LHL', 'LBL', 'LL.'], darker(r));
});

// Hakama: wide pleated trousers (deep pressed pleats, a hint of the split between the legs),
// crossed himo ties with a cross knot, a stiff koshi-ita board at the back and side slits.
item('bottom', 'hakama', 'Hakama', '#a8323e', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, y1 = V.footY + 1, side = isSide(R);
  const G = skirtGeo(R, V.waistY - 1, y1, 7, { hip: 3, hipRate: 2.2, dip: .8, bell: .9 });
  if (!side) G.keep((x, y) => !(y >= y1 - 2 && Math.abs(x - cx) <= (y - (y1 - 2))));
  const P = pleatMap(G, side ? 5 : 6, null, { sewn: 8, deep: 4, under: true, phase: .35 });
  skirtPaint(R, G, r, { flat: true, round: 8, toneMap: P.tm, bias: .1 });
  if (!side) { // the split between the legs
    R.stroke(R.curve([cx, y1 - 6], [cx, y1 - 3], [cx, y1 - 2]), r.line, G.m);
    deepen(R, R.M().rect(cx + 1, y1 - 6, cx + 2, y1).and(G.m), r, 1);
  } else { // side slit (hip opening) showing the kimono underneath
    const sl = R.M().poly([[29, G.y0 + 2], [32, G.y0 + 2], [31, G.y0 + 10]]).and(G.m);
    R.fill(sl, SNOW.sh); R.fill(R.M().set(30, G.y0 + 3), SNOW.lt);
    R.stroke(R.curve([28, G.y0 + 2], [29, G.y0 + 6], [31, G.y0 + 11]), r.line, G.m);
    R.stroke(R.curve([33, G.y0 + 2], [32, G.y0 + 6], [31, G.y0 + 11]), r.line, G.m);
  }
  // himo: two wraps of tie around the waist, crossing at the front
  const HI = paler(r, .18), tor = R.body((x, y, p) => p === 'torso');
  const hi = R.M();
  if (isFront(R)) {
    hi.add(rows(tor, V.waistY - 2, V.waistY));
    hi.add(R.M().line(V.torsoL, V.waistY + 3, cx + 2, V.waistY + 1, 2).line(V.torsoR, V.waistY + 3, cx - 2, V.waistY + 1, 2).and(G.m));
  } else hi.add(rows(tor, V.waistY - 2, V.waistY)).add(rows(tor, V.waistY + 2, V.waistY + 3));
  R.paint(hi, HI, { flat: true, round: 1.4, bias: .1 });
  cast(R, hi, G.m, r, 0, 1);
  if (isFront(R)) { // jumonji cross knot
    const kn = R.M().rect(cx - 4, V.waistY + 1, cx + 4, V.waistY + 3).add(R.M().rect(cx - 1, V.waistY - 2, cx + 1, V.waistY + 8));
    R.paint(kn, HI, { flat: true, round: 1.5, bias: .14 });
    R.stroke([[cx, V.waistY + 4], [cx, V.waistY + 6]], HI.sh, kn);
    cast(R, kn, G.m, r, 1, 1);
  } else if (isBack(R)) { // koshi-ita board
    const kb = R.M().poly([[cx - 8, V.waistY - 5], [cx + 8, V.waistY - 5], [cx + 9, V.waistY + 3], [cx - 9, V.waistY + 3]]);
    R.paint(kb, r, { flat: true, round: 2.5, bias: .12 });
    R.stroke(R.curve([cx - 6, V.waistY - 3], [cx, V.waistY - 4], [cx + 6, V.waistY - 3]), r.hi, kb);
    R.stroke(R.curve([cx - 3, V.waistY], [cx, V.waistY + 1], [cx + 3, V.waistY]), r.dp, kb);
    cast(R, kb, G.m, r, 1, 1);
  }
  hemShadow(R, G.m, 2);
});

// Denim Mini: A-line denim skirt with a waistband, belt loops, copper button, stitched front seam,
// riveted pockets, a frayed white fringe hem; back yoke, patch pockets and a leather label.
item('bottom', 'denimskirt', 'Denim Mini', '#4d74b8', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, G = skirtGeo(R, V.waistY, V.crotchY + 5, 4, { hip: 2, dip: 1 });
  const th = stitchC(r);
  skirtPaint(R, G, r, { flat: true, round: 6, toneMap: cylinder({ u: G.u, w: () => 30 }) });
  const band = waistband(R, r, V.waistY, V.waistY + 3, { stitch: th });
  cast(R, band, G.m, r, 0, 1);
  const J = { legs: G.m, band, cx, wy: V.waistY, end: G.y1 };
  if (isFront(R)) { // front seam with a double stitch
    R.stroke(R.curve([cx, V.waistY + 4], [cx, G.y1 - 2], [cx, G.y1 + 1]), r.line, G.m);
    R.stitch(R.curve([cx + 2, V.waistY + 4], [cx + 2, V.crotchY - 1], [cx + 1, V.crotchY]), th, G.m, 1, 1);
    R.stitch(R.curve([cx - 1, V.crotchY], [cx - 1, G.y1 - 1], [cx - 1, G.y1]), th, G.m, 1, 1);
  } else if (isSide(R)) R.stitch(R.curve([30, V.crotchY - 2], [31, V.crotchY + 1], [32, G.y1 - 1]), th, G.m, 1, 1);
  jeansDetail(R, r, J, { whiskers: false, fly: false });
  // frayed hem: threads hanging below the edge
  const fr = R.M(); G.m.each((x, y) => { if (!G.m.has(x, y + 1) && x % 2 === 0) { fr.set(x, y + 1); if (x % 4 === 0) fr.set(x, y + 2); } });
  fr.sub(handBlock(R));
  R.fill(fr, paler(r, .7).lt);
  const hem = R.M(); G.m.each((x, y) => { if (!G.m.has(x, y + 1)) hem.set(x, y); });
  R.fill(hem.keep((x) => x % 2 === 1), paler(r, .5).base);
  skirtShadow(R, G);
});
// Ruffle Skirt: three gathered tiers that widen toward the hem, each overlapping and shading the one
// below, scalloped edges, a white lace trim, and a ribbon waistband with a bow.
item('bottom', 'ruffle', 'Ruffle Skirt', '#f4a3a8', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, wy = V.waistY, y1 = V.crotchY + 9;
  const G = skirtGeo(R, wy, y1, 8, { hip: 2, dip: .8, bell: 1.1 });
  const cuts = [wy, wy + 6, wy + 12, y1 + 1], all = R.M(), tiers = [];
  for (let k = 2; k >= 0; k--) {
    const ya = cuts[k] + (k ? -1 : 0), yb = cuts[k + 1] + (k < 2 ? 1 : 0);
    const m = G.full.clone().keep((x, y) => y >= ya && y <= yb);
    if (k > 0) m.add(m.clone().dilate(k).keep((x, y) => y > ya + 1 && y <= yb));
    m.keep(scallop(yb, 4, 2, k));
    tiers[k] = { m, ya, yb };
  }
  const RR = [r, paler(r, .25)];
  behindHands(R, G, r, () => {
    for (let k = 2; k >= 0; k--) {
      const { m, ya } = tiers[k], rr = k === 1 ? RR[1] : r;
      const P = pleatMap({ u: (x, y) => G.u(x, Math.min(y, y1)), y0: ya + 1 }, isSide(R) ? 9 : 11 + k * 2, null, { lit: .45, deep: 3, phase: k * .37 });
      R.paint(m, rr, { flat: true, round: 3, toneMap: P.tm, bias: .05 });
      if (!all.empty()) cast(R, m, all, RR, 0, 1);
      all.add(m);
    }
  });
  G.m.add(all.clone().sub(armHand(R)));
  // lace trim on the bottom tier
  const lace = R.M(); tiers[2].m.each((x, y) => { if (!tiers[2].m.has(x, y + 1)) lace.set(x, y + 1); });
  lace.sub(handBlock(R));
  R.fill(lace, SNOW.lt); R.fill(lace.clone().keep((x) => x % 2 === 0), SNOW.sh);
  // ribbon waistband + bow
  const RB = darker(r), band = skirtBand(R, G, RB, 2, { bias: .16 });
  cast(R, band, all, RR, 0, 1);
  const bx = view3(R, cx + 8, 22, cx - 8);
  const bow = sprite(R, bx - 3, wy - 1, ['LL...LL', 'LHL.LBL', 'LTBHBSL', 'LSL.LDL', 'LL.L.LL'], RB);
  cast(R, bow, all, RR, 1, 1);
  hemShadow(R, all.clone().add(lace), 3);
});

// Plate Tassets: knight's armoured skirt. Two big overlapping steel lames per side (dyeable metal)
// with gold-trimmed hems, a raised centre ridge and rivets, hung from a buckled sword belt over a
// red cloth fauld, a mail fringe and padded breeches.
item('bottom', 'tassets', 'Plate Tassets', '#c9cfdc', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, cx = V.cx, wy = V.waistY, side = isSide(R);
  // padded breeches
  const PAD = ramp('#5d5378'), end = V.kneeY + 1;
  const legs = legsMask(R, end, { loose: 1, looseFrom: V.crotchY - wy });
  const S = spans(R, legs), gap = gapOf(R, legs);
  R.paint(legs.clone().sub(gap), PAD, { flat: true, round: 5, toneMap: cylinder(S) });
  R.fill(gap, PAD.line);
  farLeg(R, legs, PAD, end);
  const c = cuff(R, legs, paler(PAD, .2), end - 2, end, { grow: 1, bias: .16 });
  cast(R, c, legs, PAD, 0, -1);
  const hb = handBlock(R), pe = V.crotchY + 3; // plates end
  // mail fringe peeking under the plates
  const mail = R.M();
  if (side) mail.rect(19, pe - 2, 34, pe + 3); else mail.rect(cx - 16, pe - 2, cx + 16, pe + 3);
  mail.and(legs.clone().dilate(1)).sub(gap).sub(hb).keep(scallop(pe + 3, 3, 1));
  R.paint(mail, SILV, { flat: true, round: 1.5, toneMap: (x, y, t) => T5(t + ((x + y) % 2 ? 1 : 0)) });
  // plates: shield-shaped polished steel, lit top-left with a sharp glint, a gold border inset
  // from the outline and a rounded, flared hem
  const plates = R.M(), MR = [r, GOLDM];
  const erode = m => { const e = R.M(); m.each((x, y) => { if (m.has(x - 1, y) && m.has(x + 1, y) && m.has(x, y - 1) && m.has(x, y + 1)) e.set(x, y); }); return e; };
  const plate = (pts, x0, x1, y0, y1) => {
    const m = R.M().poly(pts).sub(hb);
    const W = x1 - x0 + 1, H = y1 - y0 + 1;
    const tm = (x, y) => {
      const u = (x - x0) / W, v = (y - y0) / H;
      if (Math.abs(u * .8 + v - .45) < .08 && v > .12 && v < .5) return 0;
      return Math.max(1, Math.min(5, 2 + Math.floor(v * 3 + (u > .72 ? 1 : 0) - (u < .22 && v < .5 ? 1 : 0))));
    };
    R.paint(m, r, { flat: true, round: 2, shiny: true, toneMap: tm });
    const e1 = erode(m), ring = e1.clone().sub(erode(e1)).keep((x, y) => y > y0 + 1);
    R.fill(ring, GOLDM.base); R.fill(ring.clone().keep((x, y) => !ring.has(x - 1, y - 1) && !ring.has(x, y - 1)), GOLDM.hi);
    R.fill(ring.clone().keep((x, y) => y >= y1), GOLDM.sh);
    if (!plates.empty()) cast(R, m, plates, MR, 0, 1);
    plates.add(m);
    return m;
  };
  const shield = (xa, xb, y0, y1, flare) => [[xa, y0], [xb, y0], [xb, y1 - 1], [xb - 3, y1 + 1.5], [xa - flare + 3, y1 + 1.5], [xa - flare, y1 - 1]];
  const mirX = pts => pts.map(([x, y]) => [2 * cx + 1 - x, y]);
  const studs = [];
  if (isFront(R)) {
    const L = shield(cx - 14.5, cx - 1.5, wy + 2, pe, 2.5);
    plate(L, cx - 17, cx - 2, wy + 2, pe + 1); plate(mirX(L), cx + 2, cx + 17, wy + 2, pe + 1);
    studs.push([cx - 12, wy + 4], [cx - 5, wy + 4], [cx + 4, wy + 4], [cx + 11, wy + 4]);
    const fd = R.M().poly([[cx - 1.5, wy + 2], [cx + 2.5, wy + 2], [cx + 2.5, pe + 3], [cx + .5, pe + 5], [cx - 1.5, pe + 3]]);
    R.paint(fd, RED, { flat: true, round: 1.5, bias: .1 });
    R.fill(R.M().set(cx, pe + 3), GOLDM.hi);
    cast(R, fd, R.M().add(mail).add(legs), [SILV, PAD], 1, 1);
  } else if (isBack(R)) {
    const L = shield(cx - 15.5, cx + .5, wy + 2, pe, 1.5);
    plate(L, cx - 17, cx, wy + 2, pe + 1); plate(mirX(L), cx + 1, cx + 17, wy + 2, pe + 1);
    studs.push([cx - 13, wy + 4], [cx + 12, wy + 4]);
  } else {
    plate(shield(20.5, 35, wy + 2, pe + 1, 3), 17, 35, wy + 2, pe + 2);
    studs.push([20, wy + 4], [28, wy + 4]);
  }
  for (const [x, y] of studs) if (plates.has(x, y)) R.stud(x, y, GOLDM, 2);
  // sword belt with a big buckle
  const belt = waistband(R, LEATH, wy - 2, wy + 2, { bias: .1, grow: 1 });
  R.stitch(rowPts(belt, wy - 1), LEATH.lt, belt, 1, 1);
  cast(R, belt, plates, MR, 0, 1);
  if (isFront(R)) { buckle(R, cx - 3, wy - 2, cx + 3, wy + 3, GOLDM); R.sparkle(cx - 2, wy - 1, [255, 255, 255], 1); }
  else if (side) buckle(R, 19, wy - 2, 23, wy + 3, GOLDM);
  hemShadow(R, mail.clone().add(plates), 2);
}, { kind: 'metal' });
})();
