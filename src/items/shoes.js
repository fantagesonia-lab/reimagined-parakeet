// Pixie Closet wardrobe: shoes. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- SHOE TOOLKIT ----------------
// Feet are small, so every shoe is built from separately painted pieces per foot
// (upper, sole, toe cap, tongue, laces, straps, cuffs) with hand-placed detail strokes.
// Front/back views have two feet, the side view one foot whose toe points LEFT.
const T5 = t => Math.max(0, Math.min(5, t));
const TREAD = ramp('#6a6272');        // grey tread
const SOLEB = ramp('#3a3442');        // dark rubber sole
const BRASS = ramp('#efbe55', 'metal');
const STEEL = ramp('#d3d8e4', 'metal');
const SOCK = ramp('#f7f3f8');
const RUB2 = ramp('#f1eff4');       // cool white rubber (sneaker soles, toe caps)
const lift = (r, t = .35) => ramp(mix(r.base, r.hi, t), r.kind);     // lighter sister material
const sink = (r, t = .5) => ramp(mix(r.base, r.sh, t), r.kind);      // darker sister material
const lum = c => (c[0] * .3 + c[1] * .59 + c[2] * .11) / 255;

// per-view foot descriptors: c = foot centre, lc = ankle (leg) centre, l/rt = foot extent
function feet(R) {
  if (isSide(R)) return [{ i: 0, c: 31, lc: 34, l: 17, rt: 46 }];
  return [{ i: 0, c: 29, lc: 31, l: 20, rt: 38, o: -1 }, { i: 1, c: 51, lc: 49, l: 42, rt: 60, o: 1 }];
}
// body foot/leg mask from row `from` down, grown by `grow`, restricted to one foot
function fm(R, f, from, grow = 1) {
  const m = feetMask(R, from, grow), cx = R.V.cx;
  if (!isSide(R)) m.keep(x => (f.i ? x >= cx + 1 : x <= cx - 1));
  return m;
}
const rowsOf = (m, y0, y1) => m.clone().keep((x, y) => y >= y0 && y <= y1);
// pixels of m that are not on its edge
function inner(m) {
  const o = m.clone();
  m.each((x, y, i) => { if (!m.has(x - 1, y) || !m.has(x + 1, y) || !m.has(x, y - 1) || !m.has(x, y + 1)) o.a[i] = 0; });
  return o;
}
// shift already-painted pixels of ramp(s) by n tones (keeps hue-shifted palette)
function nearTone(c, ramps) {
  let best = 1e9, br = null, bt = 0;
  for (const r of ramps) for (let t = 0; t < 7; t++) {
    const q = r.t[t], d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2;
    if (d < best) { best = d; br = r; bt = t; }
  }
  return [br, bt, best];
}
function deepen(R, mask, ramps, n = 1) {
  ramps = ramps.t ? [ramps] : ramps;
  const b = R.buf;
  mask.each((x, y, i) => {
    const o = i * 4; if (!b[o + 3]) return;
    const [r, t, d] = nearTone([b[o], b[o + 1], b[o + 2]], ramps);
    if (d > 3000 || t >= 6) return;
    const c = r.t[Math.max(1, Math.min(5, t + n))];
    b[o] = c[0]; b[o + 1] = c[1]; b[o + 2] = c[2];
  });
}
const shifted = (R, m, dx, dy) => { const s = R.M(); m.each((x, y) => s.set(x + dx, y + dy)); return s; };
// cast shadow of `piece` onto `under` (painted with `ramps`), down-right
function cast(R, piece, under, ramps, dx = 1, dy = 1, n = 1) {
  const s = shifted(R, piece, dx, dy).sub(piece); if (under) s.and(under); deepen(R, s, ramps, n);
}
const px = (R, pts, c) => { const m = R.M(); pts.forEach(([x, y]) => m.set(x, y)); R.fill(m, c); return m; };
const SKIN_SH = [.86, .72, .76];
const skinShadow = (R, m, dx = 0, dy = 1) => R.shadow(m, { dx, dy, tint: SKIN_SH, only: (x, y) => R.isSkin(x, y) });

// Deliberate band shading (MMO style): shafts are cylinders lit from the left,
// the foot is a dome whose top faces up and whose toe bulges toward the light.
function bootTone(R, f, opts = {}) {
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R);
  // cylinder bands across u in [-1, 1]: thin lit rim, highlight, broad base, shadow, dark edge
  const band = u => u < -.86 ? 2 : u < -.6 ? 1 : u < -.4 ? 2 : u < .3 ? 3 : u < .86 ? 4 : 5;
  return (x, y, t) => {
    let tone;
    if (side) {
      if (y < fy) tone = band((x - 33) / 12);
      else {
        tone = x > f.rt - 3 ? 4 : 3;
        if (y <= fy + 1) tone = x < 40 ? 2 : 3;               // top of the foot faces up
        if (x < 23 && y <= fy + 5) tone = 2;                   // toe bulge
        if (y >= h - 4) tone = Math.max(tone, 4);              // turned under
      }
    } else {
      const cx = y < fy + 1 || back ? f.lc : f.c, hw = y < fy + 1 || back ? 7.5 : 9.5;
      tone = band((x - cx) / hw);
      if (!back && y >= fy + 1 && y <= fy + 2 && tone >= 3 && tone < 5) tone -= 1; // instep plane
      if (y >= h - 4) tone = Math.max(tone, 4);
    }
    if (t >= 5 && !opts.soft) tone = Math.max(tone, 4);
    if (opts.then) tone = opts.then(x, y, tone);
    return T5(tone + (opts.shift || 0));
  };
}
// horizontal wrinkle: darkens a curve and lights the row above it (works on any painted ramp)
function wrinkle(R, p0, p1, p2, r, clip, n = 1) { // keep them short (3-5 px)
  const L = R.M(); R.curve(p0, p1, p2).forEach(([x, y]) => L.set(x, y)); if (clip) L.and(clip);
  const lip = shifted(R, L, 0, -1).sub(L); if (clip) lip.and(clip);
  deepen(R, lip, r, -1); deepen(R, L, r, n);
}

// polished / patent leather: mostly base, darker away from the light, crisp highlight added after
function patentTone(R, f) {
  const V = R.V, h = V.h, side = isSide(R), back = isBack(R);
  return (x, y, t) => {
    let tone = 3;
    if (side) { if (x > f.rt - 6) tone = 4; if (x > f.rt - 2) tone = 5; if (x < 22 && y < h - 4) tone = 2; }
    else {
      const u = (x - (back ? f.lc : f.c)) / 9.5;
      tone = u < -.75 ? 2 : u > .82 ? 5 : u > .45 ? 4 : 3;
    }
    if (y >= h - 3) tone = Math.max(tone, 4);
    return tone;
  };
}
// curved patent highlight on the toe
function patentShine(R, f, U, r) {
  const V = R.V, h = V.h, fy = V.footY, cl = inner(U);
  if (isSide(R)) {
    R.stroke(R.curve([18, h - 4], [18, h - 7], [23, h - 8]), r.hi, cl);
    R.stroke([[19, h - 7], [20, h - 8]], r.spec, cl);
    R.stroke(R.curve([28, h - 4], [35, h - 5], [41, h - 4]), r.lt, cl);
  } else if (isFront(R)) {
    R.stroke(R.curve([f.c - 6, h - 4], [f.c - 6, h - 7], [f.c - 2, h - 8]), r.hi, cl);
    R.stroke([[f.c - 5, h - 7], [f.c - 4, h - 8]], r.spec, cl);
    R.stroke([[f.c + 4, h - 7], [f.c + 5, h - 7]], r.lt, cl);
  } else {
    R.stroke(R.curve([f.lc - 6, h - 4], [f.lc - 6, h - 6], [f.lc - 4, h - 7]), r.hi, cl);
  }
}
const bowAt = (R, bx, by, rr, line) => {
  const bow = R.M().rect(bx - 3, by - 1, bx - 1, by + 1).rect(bx + 1, by - 1, bx + 3, by + 1).set(bx, by).set(bx, by - 1).set(bx, by + 1);
  bow.sub(R.M().set(bx - 3, by - 1).set(bx + 3, by + 1));
  R.paint(bow, rr, { flat: true, round: 1.2, shiny: true, outline: line });
  px(R, [[bx, by]], rr.lt); px(R, [[bx - 2, by - 1]], rr.hi); px(R, [[bx + 2, by]], rr.sh);
  return bow;
};

// ---------------- shared shoe parts ----------------
// sole under an upper U: bottom `hgt` rows spanning the foot's widest extent, `ext` px wider
// on the outer side (front/back) or at the toe (side).
function soleMask(R, f, U, hgt, ext = 1) {
  const V = R.V, h = V.h, y0 = h - hgt;
  let x0 = 1e9, x1 = -1e9;
  U.each((x, y) => { if (y >= V.footY + 2 && y <= h - 1) { if (x < x0) x0 = x; if (x > x1) x1 = x; } });
  if (isSide(R)) { x0 -= ext; x1 += ext > 0 ? 1 : 0; }
  else if (f.o < 0) x0 -= ext; else x1 += ext;
  const S = R.M().rect(x0, y0, x1, h);
  S.keep((x, y) => !(y === h && (x === x0 || x === x1)));
  if (!isSide(R)) { const cx = R.V.cx; S.keep(x => (f.i ? x >= cx + 1 : x <= cx - 1)); }
  return S;
}
// form shading for a shoe upper: lit toe top / outer-left, shadowed right side and lower edge
function shoeForm(R, f, then) {
  const V = R.V, h = V.h, side = isSide(R), w = (f.rt - f.l) / 2;
  return (x, y, t) => {
    if (side) {
      if (x < f.l + 7 && y < h - 4 && y > V.footY) t -= 1;
      if (x > f.rt - 2 && y > V.footY + 2) t += 1;
    } else {
      const u = (x - f.c) / w;
      if (u > .55) t += 1;
      if (u < -.45 && y > V.footY && y < h - 4) t -= 1;
    }
    if (y >= h - 4) t += 1;
    t = T5(t);
    return then ? then(x, y, t) : t;
  };
}
function cupSole(R, f, U, mat, { hgt = 3, stripe, out, notch = true, ext = 1 } = {}) {
  const h = R.V.h, S = soleMask(R, f, U, hgt, ext);
  R.paint(S, mat, { flat: true, round: 1.6 });
  const I = inner(S);
  if (stripe) R.fill(rowsOf(I, h - 1, h - 1), stripe);
  if (out) R.fill(rowsOf(S, h, h), out.dp);
  if (notch) { const T = R.M(); S.each((x, y) => { if (y === h && x % 3 === 0) T.set(x, y); }); R.fill(T, (out || mat).line); }
  return S;
}
// lace bars across a throat at x0..x1 for rows ys, eyelets at the ends
function laceBars(R, x0, x1, ys, lace, eye) {
  const L = R.M();
  for (const y of ys) for (let x = x0 + 1; x < x1; x++) L.set(x, y);
  R.fill(L, lace.hi);
  for (const y of ys) { px(R, [[x1 - 1, y]], lace.sh); px(R, [[x0, y], [x1, y]], eye); }
  return L;
}
// short glint strokes
const glint = (R, pts, r) => px(R, pts, r.spec);
// outline override for a piece painted on top of an upper: edges inside the upper are drawn softer
const softEdge = (U, tone = TONE.DP) => (x, y) => (U.has(x - 1, y) && U.has(x + 1, y) && U.has(x, y - 1) && U.has(x, y + 1) ? tone : null);

// ---------------- SNEAKERS / HIGH-TOPS ----------------
function sneaker(R, r, high) {
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R);
  const top = high ? V.kneeY : fy - 1;
  const tongueR = lift(r, .3), white = RUB2, stripe = lum(r.base) > .8 ? r.sh : r.base;
  for (const f of feet(R)) {
    const U = fm(R, f, top);
    R.paint(U, r, { flat: true, round: 4, toneMap: shoeForm(R, f) });
    if (side) {
      // heel counter panel with a stitched edge
      if (!high) {
        const HC = R.M().ellipse(50, h - 5, 10, 7).and(U).keep((x, y) => y >= fy + 1);
        R.paint(HC, r, { flat: true, round: 3, bias: -.1 });
        R.stitch(R.curve([41, h - 3], [38, fy + 2], [44, fy + 1]), r.lt, HC, 1, 1);
      } else {
        // canvas wrinkles around the ankle + back seam
        const cl = inner(U);
        R.crease([30, fy - 2], [34, fy], [38, fy - 1], r, cl);
        R.crease([31, fy - 5], [35, fy - 3], [40, fy - 4], r, cl);
        R.stitch(R.curve([43, top + 3], [44, fy], [44, h - 4]), r.sh, cl, 1, 1);
      }
      // padded collar along the opening
      const col = R.M().rect(27, top, 44, top + 1).and(U);
      R.paint(col, r, { flat: true, round: 1.2, bias: .12 });
      // tongue poking up at the front of the ankle
      const tg = R.M().poly([[19, top - 3], [24, top - 4], [27, fy + 3], [21, fy + 3]]);
      R.paint(tg, tongueR, { flat: true, round: 2 });
      // laces down the instep, eyelets behind them
      const ys = []; for (let y = top + 1; y <= fy + 3; y += 2) ys.push(y);
      const L = R.M(), E = R.M();
      ys.forEach(y => { const x = Math.round(25 - Math.max(0, y - fy) * .8); L.rect(x - 2, y, x + 1, y); E.set(x + 2, y); });
      R.fill(L, white.hi); R.fill(E, r.line);
      cast(R, L, tg, tongueR, 0, 1);
      if (high) {
        // ankle patch: round star badge
        R.paint(R.M().ellipse(38, fy - 3, 3, 3), white, { flat: true, round: 2, outline: r.line });
        px(R, [[38, fy - 5], [37, fy - 4], [38, fy - 4], [39, fy - 4], [36, fy - 3], [37, fy - 3], [38, fy - 3], [39, fy - 3], [40, fy - 3], [37, fy - 2], [39, fy - 2]], r.base);
      } else {
        // swoosh stripe sweeping back to the heel
        const sw = R.lock([27, fy + 6], [37, fy + 10], [46, fy + 2], 1.2, 3.2).and(U);
        R.paint(sw, white, { flat: true, round: 1.4, outline: r.line });
      }
      // toe cap
      const TC = R.M().ellipse(22, h - 2, 7, 5).and(U).keep((x, y) => y <= h - 3 && x <= 25);
      R.paint(TC, white, { flat: true, round: 2 });
      if (high) R.stroke(R.curve([17, h - 4], [20, h - 6], [24, h - 4]), white.sh, TC);
      cupSole(R, f, U, white, { stripe, out: TREAD });
      // heel tab
      const tab = R.M().rect(44, top - 3, 46, top + 1);
      R.paint(tab, r, { flat: true, round: 1.2, bias: -.15 });
      glint(R, [[19, fy + 3], [20, fy + 3]], r);
    } else if (back) {
      // heel strip: vertical reinforcement panel up the back with a reflective stripe
      const HC = R.M().rect(f.lc - 3, top + 2, f.lc + 3, h - 2).sub(R.M().set(f.lc - 3, top + 2).set(f.lc + 3, top + 2));
      R.paint(HC, r, { flat: true, round: 2, bias: -.15 });
      R.fill(R.M().rect(f.lc, top + 4, f.lc, h - 5), white.sh);
      R.fill(R.M().rect(f.lc - 1, top + 4, f.lc - 1, h - 5), white.hi);
      cast(R, HC, U, r, 1, 0);
      if (high) {
        // heel label just above the sole
        const lb = R.M().rect(f.lc - 3, h - 6, f.lc + 3, h - 3);
        R.paint(lb, white, { flat: true, round: 1.2, outline: r.line });
        R.fill(R.M().rect(f.lc - 2, h - 5, f.lc + 2, h - 5), stripe);
      }
      // padded collar
      const col = R.M().rect(f.lc - 7, top, f.lc + 7, top + 1).and(U);
      R.paint(col, r, { flat: true, round: 1.2, bias: .12 });
      cupSole(R, f, U, white, { stripe, out: TREAD });
      // pull loop
      const tab = R.M().rect(f.lc - 2, top - 4, f.lc + 2, top + 2).sub(R.M().set(f.lc - 2, top - 4).set(f.lc + 2, top - 4));
      R.paint(tab, white, { flat: true, round: 1.5, outline: r.line });
      px(R, [[f.lc, top - 3], [f.lc, top - 2]], r.line);
      glint(R, [[f.lc - 4, fy + 4]], r);
    } else {
      // padded collar ring
      const col = rowsOf(U, top, top + 1);
      R.paint(col, r, { flat: true, round: 1.2, bias: .12 });
      // tongue + lacing throat
      const tg = R.M().rect(f.lc - 2, top - 3, f.lc + 2, fy + 5).sub(R.M().set(f.lc - 2, top - 3).set(f.lc + 2, top - 3));
      R.paint(tg, tongueR, { flat: true, round: 2 });
      // vamp flex crease above the toe
      R.crease([f.c - 5, fy + 7], [f.c, fy + 5], [f.c + 5, fy + 7], r, inner(U).sub(tg), { tone: 4 });
      // toe cap: rubber crescent
      const TC = R.M().ellipse(f.c, h - 2, 7, 4.5).and(U).keep((x, y) => y <= h - 3);
      R.paint(TC, white, { flat: true, round: 2 });
      const ys = []; for (let y = top + 1; y <= fy + 4; y += 2) ys.push(y);
      const L = laceBars(R, f.lc - 3, f.lc + 3, ys, white, r.line);
      cast(R, L, tg, tongueR, 0, 1);
      cupSole(R, f, U, white, { stripe, out: TREAD });
      glint(R, [[f.c - 4, h - 5], [f.c - 3, h - 5]], white);
      glint(R, [[f.l + 2, fy + 3], [f.l + 2, fy + 4]], r);
    }
  }
}

// ---------------- boot parts ----------------
// side-view arch gap under the waist of the sole (between forefoot and heel)
const ARCH = [30, 38];
const noArch = (R, U) => isSide(R) ? U.keep((x, y) => !(y === R.V.h && x >= ARCH[0] && x <= ARCH[1])) : U;
// heeled sole: thin forefoot sole, lifted waist, heel block (side); flat sole + heel block (back)
function heelSole(R, f, U, mat, { hgt = 2, heel = 3, ext = 1, heelMat } = {}) {
  const V = R.V, h = V.h;
  const S = soleMask(R, f, U, hgt, ext);
  let H = R.M();
  if (isSide(R)) {
    S.keep((x, y) => !(y === h && x >= ARCH[0] && x <= ARCH[1]));
    H.rect(ARCH[1] + 1, h - heel, f.rt + 1, h).keep((x, y) => !(y === h && x === f.rt + 1));
  } else if (isBack(R)) H.rect(f.lc - 4, h - heel, f.lc + 4, h);
  S.add(H);
  R.paint(S, mat, { flat: true, round: 1.5 });
  if (!H.empty() && heelMat) R.paint(H, heelMat, { flat: true, round: 1.5 });
  else if (!H.empty()) R.stroke(R.curve([ARCH[1] + 2, h - heel + 1], [ARCH[1] + 6, h - heel + 1], [f.rt, h - heel + 1]).filter(() => isSide(R)), mat.lt, inner(H));
  return S;
}
// strap with a buckle around the shaft at rows y..y+3
function strap(R, f, U, y, mat, buckle = BRASS, hgt = 4, under) {
  const side = isSide(R), back = isBack(R);
  const B = rowsOf(U, y, y + hgt - 1).dilate(1).keep((x, yy) => yy >= y && yy <= y + hgt - 1);
  if (!side) { const cx = R.V.cx; B.keep(x => (f.i ? x >= cx + 1 : x <= cx - 1)); }
  R.paint(B, mat, { flat: true, round: 1.5 });
  if (under) cast(R, B, U, under, 0, 1);
  const bx = side ? 37 : back ? f.lc - f.o * 5 : f.lc + f.o * 5;
  if (back) return B;
  // buckle: frame with a dark slot, strap tip beyond it
  const x0 = bx - (f.o > 0 && !side ? 2 : 1), y1 = y + hgt - 1;
  const fr = R.M().rect(x0, y, x0 + 3, y1);
  R.fill(fr, buckle.base);
  px(R, [[x0, y], [x0 + 1, y], [x0, y + 1]], buckle.hi);
  px(R, [[x0 + 3, y1], [x0 + 2, y1], [x0 + 3, y1 - 1]], buckle.dp);
  const slot = R.M().rect(x0 + 1, y + 1, x0 + 2, y1 - 1); R.fill(slot, mat.line);
  if (hgt >= 3) px(R, [[x0 + 1, y + 1]], buckle.sh);
  return B;
}
// fold-over cuff at the top of a shaft
function cuff(R, f, U, top, mat, rows = 4, flare = 1) {
  const side = isSide(R);
  const C = rowsOf(U, top, top + rows - 1).dilate(flare).keep((x, y) => y >= top - 1 && y <= top + rows - 1);
  if (!side) { const cx = R.V.cx; C.keep(x => (f.i ? x >= cx + 1 : x <= cx - 1)); }
  R.paint(C, mat, { flat: true, round: 2 });
  return C;
}
// small spec glints on a toe
function toeGlint(R, f, r, dy = 0) {
  const V = R.V, h = V.h, fy = V.footY;
  if (isSide(R)) glint(R, [[19, fy + 4 + dy], [20, fy + 4 + dy], [21, fy + 3 + dy]], r);
  else if (isFront(R)) glint(R, [[f.c - 4, fy + 5 + dy], [f.c - 3, fy + 5 + dy], [f.c - 4, fy + 6 + dy]], r);
}
// sock / stocking on the leg from y0 to y1 (body masks keep the leg contour lines)
function legWear(R, y0, y1, mat, opts = {}) {
  const m = R.body((x, y, p) => (p === 'leg' || p === 'foot') && y >= y0 && y <= y1);
  R.paint(m, mat, { lines: true, round: 3, ...opts });
  return m;
}
// ribbed band at the top of a sock
function ribTop(R, y0, rows, mat) {
  const m = R.body((x, y, p) => (p === 'leg') && y >= y0 && y < y0 + rows).dilate(1).keep((x, y) => y >= y0 && y < y0 + rows && R.part(x, y) && R.part(x, y) !== 'hand' && R.part(x, y) !== 'torso');
  if (!isSide(R)) m.keep(x => x !== R.V.cx);
  R.paint(m, mat, { lines: true, round: 1.5, toneMap: (x, y, t) => (x % 2 ? T5(t + 1) : t) });
  return m;
}

// ---------------- SHOES ----------------
item('shoes', 'sneakers', 'Sneakers', '#e0475a', (R, ph, r) => {
  if (ph !== 'front') return;
  sneaker(R, r, false);
});
item('shoes', 'hightops', 'High-Top Sneakers', '#4a5fc1', (R, ph, r) => {
  if (ph !== 'front') return;
  sneaker(R, r, true);
});

item('shoes', 'boots', 'Adventure Boots', '#8a5a3c', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R), top = V.kneeY - 3;
  const suede = lift(r, .4), band = sink(r, .55);
  for (const f of feet(R)) {
    const U = noArch(R, fm(R, f, top));
    R.paint(U, r, { flat: true, round: 3, toneMap: bootTone(R, f) });
    const cl = inner(U);
    if (side) {
      // ankle wrinkles, toe-cap seam, back seam
      wrinkle(R, [23, fy - 2], [25, fy - 1], [27, fy - 2], r, cl);
      wrinkle(R, [40, fy - 5], [41, fy - 4], [43, fy - 4], r, cl);
      R.stroke(R.curve([25, h - 4], [26, fy + 2], [19, fy + 2]), r.sh, cl);
      R.stroke(R.curve([26, h - 4], [27, fy + 2], [20, fy + 1]).filter(([x, y]) => y > fy + 1), r.lt, cl);
    } else if (back) {
      R.stroke(R.curve([f.lc, top + 4], [f.lc, fy], [f.lc, h - 5]), r.sh, cl);
      R.stitch(R.curve([f.lc + 1, top + 4], [f.lc + 1, fy], [f.lc + 1, h - 5]), r.lt, cl, 1, 1);
      wrinkle(R, [f.lc - 5, fy - 5], [f.lc - 3, fy - 4], [f.lc - 1, fy - 5], r, cl);
    } else {
      wrinkle(R, [f.lc - 4, fy - 5], [f.lc - 3, fy - 4], [f.lc - 1, fy - 5], r, cl);
      wrinkle(R, [f.lc + 2, fy - 5], [f.lc + 3, fy - 4], [f.lc + 4, fy - 5], r, cl);
      // toe-cap seam: dark line with a lit edge under it
      R.stroke(R.curve([f.c - 7, h - 5], [f.c, fy + 1], [f.c + 7, h - 5]), r.sh, cl);
      R.stroke(R.curve([f.c - 6, h - 4], [f.c, fy + 2], [f.c + 6, h - 4]).filter(([x]) => x < f.c + 2), r.lt, cl);
    }
    toeGlint(R, f, r, 0);
    strap(R, f, U, fy - 3, band, BRASS, 3, r);
    const C = cuff(R, f, U, top, suede, 4, 1);
    cast(R, C, U, r, 0, 1);
    // stitched hem on the cuff + front notch
    R.stitch(R.curve(...(side ? [[20, top + 2], [33, top + 2], [46, top + 2]] : [[f.lc - 7, top + 2], [f.lc, top + 2], [f.lc + 7, top + 2]])), suede.sh, inner(C), 1, 1);
    if (!back && !side) { px(R, [[f.lc, top + 1], [f.lc, top + 2], [f.lc, top + 3]], suede.line); px(R, [[f.lc - 1, top + 1]], suede.spec); }
    if (side) { px(R, [[21, top + 1], [21, top + 2], [21, top + 3]], suede.line); }
    const S = heelSole(R, f, U, SOLEB, { hgt: 3, heel: 4 });
    const W = R.M(); inner(S).each((x, y) => { if (y === h - 2 && x % 2 === 0) W.set(x, y); }); R.fill(W, SOLEB.lt);
  }
});

// lace frill: a band slightly wider than the leg with a scalloped lower edge and eyelet holes
function laceFrill(R, y0, mat) {
  const V = R.V, side = isSide(R);
  const leg = R.body((x, y, p) => p === 'leg' && y >= y0 && y <= y0 + 2);
  const m = leg.clone().dilate(1).keep((x, y) => y >= y0 - 1 && y <= y0 + 2 && R.part(x, y) !== 'hand' && R.part(x, y) !== 'torso');
  if (!side) m.keep(x => x !== V.cx);
  m.keep((x, y) => !(y === y0 + 2 && x % 2 === 0));
  R.paint(m, mat, { flat: true, round: 1.4, toneMap: (x, y, t) => (y === y0 - 1 ? Math.min(t, 2) : t) });
  const holes = R.M(); inner(m).each((x, y) => { if (y === y0 + 1 && x % 3 === 0) holes.set(x, y); });
  R.fill(holes, mat.sh);
  return m;
}
item('shoes', 'mary', 'Mary Janes', '#34303d', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R);
  const sock = lum(r.base) > .82 ? ramp('#f4dbe7') : SOCK;
  // knee socks with a lace frill and a little sag at the ankle
  const top = V.kneeY - 4;
  const SK = legWear(R, top, h, sock);
  for (const f of feet(R)) {
    if (side) wrinkle(R, [24, fy - 2], [26, fy - 1], [28, fy - 2], sock, inner(SK));
    else wrinkle(R, [f.lc - 3, fy - 3], [f.lc - 1, fy - 2], [f.lc + 1, fy - 3], sock, inner(SK));
  }
  laceFrill(R, top, sock);
  for (const f of feet(R)) {
    const st0 = fy + 2;
    // vamp opening dips at the instep
    const U = noArch(R, fm(R, f, st0).keep((x, y) => {
      if (side) return y >= st0 + (x > 26 && x < 41 ? 2 : 0);
      if (back) return y >= st0 + 1;
      return y >= st0 + (Math.abs(x - f.c) <= 3 ? 1 : 0);
    }));
    R.paint(U, r, { flat: true, round: 3.5, shiny: true, toneMap: patentTone(R, f) });
    cast(R, U, SK, sock, 0, -1);
    patentShine(R, f, U, r);
    // instep strap with a round buckle on the outer side
    const st = R.M();
    if (side) st.poly([[24, fy - 2], [28, fy - 2], [31, st0 + 3], [27, st0 + 3]]);
    else if (back) st.rect(f.lc - 7, st0, f.lc + 7, st0 + 2).and(fm(R, f, st0, 2));
    else st.rect(f.lc - 7, fy - 2, f.lc + 7, fy).and(fm(R, f, fy - 3, 2));
    R.paint(st, r, { flat: true, round: 1.4, shiny: true, toneMap: (x, y, t) => (y === fy - 1 || (side && x < 27) ? 2 : t) });
    cast(R, st, SK, sock, 0, 1);
    if (!back) {
      const bx = side ? 29 : f.lc + f.o * 5 - (f.o > 0 ? 1 : 0), by = side ? st0 + 1 : fy - 2;
      const bk = R.M().rect(bx, by, bx + 1, by + 2);
      R.fill(bk, STEEL.base); px(R, [[bx, by]], STEEL.spec); px(R, [[bx + 1, by + 2]], STEEL.dp); px(R, [[bx + 1, by + 1]], r.line);
    }
    heelSole(R, f, U, sink(r, .6), { hgt: 2, heel: 3, ext: 0 });
  }
});

item('shoes', 'sandals', 'Beach Sandals', '#f08a3c', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R);
  const skinOnly = (x, y) => R.isSkin(x, y);
  const toeSh = [.82, .66, .7];
  for (const f of feet(R)) {
    const F = fm(R, f, fy - 4, 1);
    // bare toes: soft creases between them
    if (isFront(R)) {
      const T = R.M(); [-4, -1, 2].forEach(d => T.rect(f.c + d + (f.o < 0 ? 1 : 0), h - 5, f.c + d + (f.o < 0 ? 1 : 0), h - 4));
      R.tint(T, toeSh, skinOnly);
    } else if (side) R.tint(R.M().rect(19, h - 5, 19, h - 4), toeSh, skinOnly);
    // footbed sole: lit top surface, darker side wall
    const U = fm(R, f, fy);
    const S = soleMask(R, f, U, 3, 1);
    R.paint(S, r, { flat: true, round: 1.5, toneMap: (x, y, t) => (y === h - 2 ? 1 : y === h - 1 ? 3 : t) });
    // straps: ankle strap, T-strap / heel strap, wide toe strap
    const ank = rowsOf(F, fy - 4, fy - 2);
    const ts = side ? R.M().poly([[17, fy + 4], [29, fy + 1], [30, fy + 4], [17, fy + 7]]).and(F) : back ? R.M() : rowsOf(F, fy + 3, fy + 6);
    const tee = side ? R.M().poly([[22, fy - 2], [25, fy - 2], [27, fy + 3], [24, fy + 3]]).and(F)
      : back ? R.M().rect(f.lc - 1, fy - 2, f.lc + 1, h - 3) : R.M();
    const heel = side ? R.M().poly([[41, fy - 2], [44, fy - 2], [46, h - 3], [43, h - 3]]).and(F) : R.M();
    const all = R.M().add(ank).add(ts).add(tee).add(heel);
    [heel, tee, ts, ank].forEach(m => R.paint(m, r, { flat: true, round: 1.4, toneMap: bootTone(R, f, { soft: true }) }));
    skinShadow(R, all, 0, 1);
    // stitched edges on the toe strap
    if (!back) R.stitch(R.curve(...(side ? [[17, fy + 4], [23, fy + 3], [29, fy + 4]] : [[f.c - 8, fy + 4], [f.c, fy + 4], [f.c + 8, fy + 4]])), r.lt, inner(ts), 1, 1);
    // buckle on the ankle strap
    if (!back) {
      const bx = side ? 37 : f.lc + f.o * 5 - (f.o > 0 ? 1 : 0);
      R.fill(R.M().rect(bx, fy - 4, bx + 1, fy - 2), BRASS.base); px(R, [[bx, fy - 4]], BRASS.spec); px(R, [[bx + 1, fy - 2]], BRASS.dp); px(R, [[bx + 1, fy - 3]], r.line);
    }
    // hibiscus on the toe strap
    if (!back) {
      const hx = side ? 23 : f.c + f.o * 4, hy = side ? fy + 4 : fy + 4;
      const pet = R.M().ellipse(hx - 1.2, hy, 1.3, 1.3).ellipse(hx + 1.2, hy, 1.3, 1.3).ellipse(hx, hy - 1.2, 1.3, 1.3).ellipse(hx, hy + 1.2, 1.3, 1.3);
      R.paint(pet, PINK, { flat: true, round: 1.5, outline: PINK.line });
      px(R, [[hx, hy]], GOLD.base); px(R, [[hx + 1, hy + 1]], GOLD.sh); px(R, [[hx - 2, hy - 1], [hx - 1, hy - 2]], PINK.hi);
    }
  }
});

item('shoes', 'bunnyslip', 'Bunny Slippers', '#f7f3f8', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R);
  const pink = ramp('#f6a6c0'), eye = lum(r.base) < .32 ? ramp('#c9bfd6') : ramp('#3a2a3e');
  const fuzz = m => m.keep((x, y) => !(!m.has(x, y - 1) && ((x * 7 + y * 3) % 5 === 0)));
  for (const f of feet(R)) {
    const U = fuzz(fm(R, f, fy - 2, 2));
    const ex = side ? 23 : f.c + (f.o < 0 ? 1 : -1);
    // ears: long lops standing up from the toe, roots hidden under the slipper
    const ears = side
      ? [[[29, fy + 2], [30, fy - 5], [37, fy - 10], 4.6, 2.8], [[24, fy + 2], [24, fy - 6], [29, fy - 12], 5, 3]]
      : [[[ex - 3, fy + 2], [ex - 5, fy - 5], [ex - 7, fy - 12], 5, 3], [[ex + 3, fy + 2], [ex + 5, fy - 5], [ex + 7, fy - 12], 5, 3]];
    for (const [a, b, c, w0, w1] of back ? [] : ears) {
      let E = R.lock(a, b, c, w0, w1);
      R.paint(E, r, { flat: true, round: 2.4 });
      if (!back) {
        const I = R.lock([a[0] + (b[0] - a[0]) * .3, a[1] - 3], b, [c[0] + (c[0] < a[0] ? .6 : -.6), c[1] + 1.8], 2, .8).and(inner(E));
        R.fill(I, pink.base); R.fill(I.clone().keep((x, y) => y < b[1]), pink.lt);
      }
    }
    // fluffy body
    R.paint(U, r, { flat: true, round: 5, toneMap: bootTone(R, f, { soft: true }) });
    // fuzzy rim around the opening
    const rim = rowsOf(fm(R, f, fy - 3, 3), fy - 3, fy - 1);
    R.paint(rim, r, { flat: true, round: 2, toneMap: (x, y, t) => ((x + y) % 3 === 0 ? T5(t + 1) : Math.min(t, 2)) });
    R.shadow(rim, { dx: 0, dy: 1, tint: [.88, .84, .92] });
    // fur tufts
    const cl = inner(U);
    const tufts = side ? [[34, fy + 4], [40, fy + 6], [30, h - 4]] : back ? [] : [[f.c + f.o * 5, fy + 6], [f.c - f.o * 6, h - 4]];
    tufts.forEach(([x, y]) => { px(R, [[x - 1, y], [x, y - 1], [x + 1, y]], r.sh); px(R, [[x, y - 2]], r.hi); });
    if (side) {
      // face on the toe: eye, nose, blush
      px(R, [[20, fy + 3], [20, fy + 4], [21, fy + 3], [21, fy + 4]], eye.base); px(R, [[20, fy + 3]], eye.hi);
      px(R, [[16, fy + 6], [17, fy + 6]], pink.sh);
      px(R, [[22, fy + 6], [23, fy + 6]], pink.lt);
      // cotton tail
      const T = fuzz(R.M().ellipse(47, fy + 3, 2.6, 2.6));
      R.paint(T, r, { flat: true, round: 2.4, outline: r.sh, toneMap: (x, y, t) => ((x - 47) + (y - fy - 3) > 1 ? 4 : 2) }); px(R, [[46, fy + 2]], r.spec);
    } else if (back) {
      // cotton tail: a fluffy cluster of puffs
      const tx = f.lc, ty = fy + 5;
      const T = R.M().ellipse(tx, ty, 3.4, 3.1).ellipse(tx - 2, ty - 2, 1.6, 1.6).ellipse(tx + 2, ty - 2, 1.6, 1.6).ellipse(tx + 3, ty + 1, 1.5, 1.5).ellipse(tx - 3, ty + 1, 1.5, 1.5);
      R.shadow(T, { dx: 1, dy: 1, tint: [.82, .74, .88] });
      R.paint(T, r, { flat: true, round: 3, toneMap: (x, y, t) => { const d = (x - tx) + (y - ty); return d > 2 ? 4 : d < -2 ? 1 : 2; } });
      px(R, [[tx - 1, ty - 2], [tx - 2, ty - 1]], r.spec);
      px(R, [[tx + 1, ty + 1], [tx, ty + 2]], r.sh);
    } else {
      // face: two shiny eyes, pink nose, w-mouth, blush
      [ex - 3, ex + 3].forEach(x => { px(R, [[x, fy + 4], [x, fy + 5], [x + 1, fy + 4], [x + 1, fy + 5]], eye.base); px(R, [[x, fy + 4]], eye.hi); });
      px(R, [[ex, fy + 6], [ex + 1, fy + 6]], pink.sh);
      px(R, [[ex - 1, fy + 7], [ex + 2, fy + 7]], eye.lt);
      px(R, [[ex - 5, fy + 6], [ex - 4, fy + 6], [ex + 5, fy + 6], [ex + 6, fy + 6]], pink.lt);
    }
    // soft pink sole
    const S = soleMask(R, f, U, 2, 0);
    R.paint(S, pink, { flat: true, round: 1.2 });
  }
});

item('shoes', 'rain', 'Rain Boots', '#f5d04a', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R), top = V.kneeY - 2;
  for (const f of feet(R)) {
    const U = fm(R, f, top);
    // glossy rubber: band shading with broken specular streaks down the lit column
    const streak = (x, y, t) => {
      if (t !== 1) return t;
      const seg = (y - top) % 7;
      return y < fy && seg > 0 && seg < 5 ? 0 : t;
    };
    R.paint(U, r, { flat: true, round: 3, shiny: true, toneMap: bootTone(R, f, { then: streak }) });
    const cl = inner(U);
    if (side) {
      wrinkle(R, [23, fy - 1], [25, fy], [27, fy - 1], r, cl);
      // embossed oval label
      const lb = R.M().ellipse(37, fy - 3, 3, 1.6);
      R.paint(lb, lift(r, .25), { flat: true, round: 1.4, shiny: true, outline: r.sh });
      px(R, [[36, fy - 4], [37, fy - 4]], r.spec);
      // toe glints
      glint(R, [[19, fy + 3], [20, fy + 3], [18, fy + 4]], r);
    } else if (back) {
      R.fill(R.M().rect(f.lc, top + 3, f.lc, h - 6), r.sh);
      px(R, [[f.lc + 1, top + 3]], r.dp);
    } else {
      wrinkle(R, [f.lc - 2, fy - 1], [f.lc, fy], [f.lc + 2, fy - 1], r, cl);
      glint(R, [[f.c - 4, fy + 3], [f.c - 3, fy + 3], [f.c - 4, fy + 4]], r);
    }
    // toe bumper band around the forefoot
    // foxing band all round the foot
    const TB = rowsOf(U, h - 5, h - 3);
    R.paint(TB, sink(r, .4), { flat: true, round: 1.5, shiny: true, toneMap: (x, y, t) => (y === h - 4 ? Math.min(t, 2) : t) });
    cast(R, TB, U, r, 0, -1);
    px(R, isSide(R) ? [[17, h - 4], [18, h - 4]] : back ? [] : [[f.c - 5, h - 4], [f.c - 4, h - 4]], r.spec);
    // thick rolled rim with pull tab
    const C = cuff(R, f, U, top, r, 3, 1);
    R.paint(C, r, { flat: true, round: 1.6, shiny: true, bias: .06 });
    cast(R, C, U, r, 0, 1, 1);
    if (side) { R.paint(R.M().rect(43, top - 4, 46, top + 1), r, { flat: true, round: 1.2, shiny: true, bias: -.1 }); px(R, [[44, top - 3], [45, top - 3]], r.line); }
    else if (back) { R.paint(R.M().rect(f.lc - 2, top - 4, f.lc + 2, top + 1), r, { flat: true, round: 1.2, shiny: true, bias: -.1 }); px(R, [[f.lc - 1, top - 3], [f.lc, top - 3], [f.lc + 1, top - 3]], r.line); }
    px(R, side ? [[22, top], [23, top]] : [[f.lc - 5, top], [f.lc - 4, top]], r.spec);
    // chunky tread sole
    const S = cupSole(R, f, U, SOLEB, { hgt: 3, notch: true });
    R.fill(rowsOf(inner(S), h - 2, h - 2).keep(x => x % 2 === 0), SOLEB.lt);
  }
});

item('shoes', 'stockings', 'Striped Stockings', '#e0475a', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R);
  const top = V.crotchY + 2;
  const SK = R.body((x, y, p) => (p === 'leg' || p === 'foot') && y >= top + 2);
  // knee shine: lighter vertical strip on the lit side of each shin
  const shine = (x, y, t) => {
    const lc = side ? 26 : x < V.cx ? 28 : 46;
    return Math.abs(x - lc) <= 0 && y > top + 3 && y < fy - 1 ? T5(t - 1) : t;
  };
  const alt = lum(r.base) > .78 ? ramp('#3a3448') : WHITE;
  R.paint(SK, r, { lines: true, round: 3, pattern: stripes(4, 2), alt, toneMap: shine });
  // ribbed band at the top with a tiny bow on the outer side
  const band = R.body((x, y, p) => (p === 'leg') && y >= top && y <= top + 3);
  band.add(band.clone().dilate(1).keep((x, y) => y >= top && y <= top + 3 && (R.part(x, y) === 'leg')));
  R.paint(band, sink(r, .45), { lines: true, round: 1.5, toneMap: (x, y, t) => (x % 2 ? T5(t + 1) : t) });
  skinShadow(R, R.M().add(band), 0, -1);
  const bowR = WHITE;
  const bows = side ? [[24, top + 1]] : back ? [] : [[26, top + 1], [54, top + 1]];
  bows.forEach(([bx, by]) => {
    R.paint(R.M().rect(bx - 2, by - 1, bx - 1, by + 1).rect(bx + 1, by - 1, bx + 2, by + 1).set(bx, by), bowR, { flat: true, round: 1, outline: r.line });
    px(R, [[bx, by]], bowR.sh); px(R, [[bx - 2, by - 1]], bowR.spec);
  });
  // black ballet flats with a bow
  for (const f of feet(R)) {
    const ft = fy + 5;
    const U = noArch(R, fm(R, f, ft).keep((x, y) => side ? y >= ft + (x > 23 && x < 40 ? 1 : 0) : y >= ft + (Math.abs(x - f.c) <= 3 ? 1 : 0)));
    R.paint(U, BLACK, { flat: true, round: 3, toneMap: patentTone(R, f) });
    // topline binding: lighter piping along the opening
    const tl = R.M(); U.each((x, y) => { if (!U.has(x, y - 1) && U.has(x, y + 1) && U.has(x - 1, y) && U.has(x + 1, y)) tl.set(x, y + 1); });
    R.fill(tl.and(inner(U)), BLACK.lt);
    cast(R, U, SK, [r, alt], 0, -1);
    patentShine(R, f, U, BLACK);
    if (!back) bowAt(R, side ? 22 : f.c, ft, WHITE, BLACK.line);
    heelSole(R, f, U, sink(BLACK, .3), { hgt: 2, heel: 2, ext: 0 });
  }
});

// polished plate: chrome-like bands (highlight, mid, dark reflection, reflected rim light)
function plateTone(R, f, cxOverride) {
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R);
  return (x, y, t) => {
    const cx = cxOverride ?? (side ? 33 : y < fy + 1 || isBack(R) ? f.lc : f.c), hw = side ? 12 : y < fy + 1 ? 7.5 : 9.5;
    const u = (x - cx) / hw;
    let tone = u < -.8 ? 2 : u < -.5 ? 1 : u < -.25 ? 2 : u < .2 ? 3 : u < .5 ? 4 : u < .75 ? 3 : side ? 4 : 5;
    if (t >= 5) tone = Math.max(tone, 4);
    return tone;
  };
}
const rivet = (R, x, y, rr = GOLD) => { px(R, [[x, y]], rr.hi); px(R, [[x + 1, y], [x, y + 1]], rr.sh); };
item('shoes', 'knight', 'Iron Greaves', '#c9cfdc', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R), top = V.kneeY;
  const leather = ramp('#7a4a32', 'leather'), gold = GOLD;
  const metal = { flat: true, round: 3, shiny: true };
  for (const f of feet(R)) {
    const U = noArch(R, fm(R, f, top));
    // greave: polished shin plate with broken specular down the lit column
    R.paint(U, r, { ...metal, toneMap: (x, y, t) => { const k = plateTone(R, f)(x, y, t); return k === 1 && y < fy && (y - top) % 4 === 2 ? 0 : k; } });
    const cl = inner(U);
    if (side) {
      // hinge seam where front and back plates meet, with rivets
      R.stroke(R.curve([36, top + 1], [37, fy - 3], [36, fy - 1]), r.dp, cl);
      R.stroke(R.curve([35, top + 1], [36, fy - 3], [35, fy - 1]), r.hi, cl);
    } else if (back) {
      // open back: leather lining laced shut with two straps
      const LB = R.M().rect(f.lc - 3, top + 1, f.lc + 3, fy - 1).and(cl);
      R.paint(LB, leather, { flat: true, round: 1.5 });
      [top + 2, fy - 3].forEach(y => { R.paint(R.M().rect(f.lc - 5, y, f.lc + 5, y + 2).and(U), leather, { flat: true, round: 1.2, bias: -.1 }); R.fill(R.M().rect(f.lc - 1, y + 1, f.lc, y + 1), gold.base); px(R, [[f.lc - 1, y + 1]], gold.hi); });
    } else {
      // raised centre ridge
      R.stroke(R.curve([f.lc + 1, top + 1], [f.lc + 1, fy - 3], [f.lc + 1, fy - 1]), r.dp, cl);
      R.stroke(R.curve([f.lc, top + 1], [f.lc, fy - 3], [f.lc, fy - 1]), r.spec, cl);
    }
    // sabatons: lames that arch over the foot, toe cap first so each lame above overlaps the next
    const F = fm(R, f, fy - 1, 1).and(U);
    const bend = x => side ? 0 : Math.round(1.2 * (1 - ((x - f.c) / 9) ** 2));
    const lames = [[fy - 1, fy + 2], [fy + 2, fy + 5], [fy + 5, h - 2]];
    if (!back && side) {
      // side: lobster-tail lames whose edges slant from the instep down to the toe
      const sl = y => (y - fy) * 4 / (h - 3 - fy);
      [44, 37, 31, 25].forEach((bx, k) => {
        const L = F.clone().keep((x, y) => x + sl(y) <= bx);
        R.paint(L, r, { ...metal, round: 2, toneMap: (x, y, t) => { const kk = plateTone(R, f)(x, y, t); return x + sl(y) >= bx - 1 ? Math.min(5, kk + 1) : x + sl(y) <= bx - 4 && y < h - 4 ? Math.max(1, kk - 1) : kk; } });
        if (k) cast(R, L, F, r, 1, 0);
      });
    } else if (!back) {
      for (let k = lames.length - 1; k >= 0; k--) {
        const [y0, y1] = lames[k];
        const L = F.clone().keep((x, y) => y >= y0 + bend(x) && y <= y1 + bend(x) + (k === 2 ? 2 : 0));
        R.paint(L, r, { ...metal, round: 2, toneMap: (x, y, t) => { const kk = plateTone(R, f)(x, y, t); return y === y0 + bend(x) + 1 ? Math.max(1, kk - 1) : kk; } });
        if (k < lames.length - 1) cast(R, L, F, r, 0, 1);
      }
    }
    if (!back) {
      // rivets on the outer end of each lame + toe glint
      const rv = side ? [[39, fy + 1], [33, fy + 3], [27, fy + 6]] : lames.map(([y0]) => [f.c + f.o * 6 - (f.o > 0 ? 1 : 0), y0 + 1]);
      rv.forEach(([x, y]) => rivet(R, x, y));
      glint(R, side ? [[18, h - 6], [19, h - 6], [19, h - 7]] : [[f.c - 4, h - 5], [f.c - 3, h - 5], [f.c - 4, h - 4]], r);
    } else {
      // heel: two lames wrapping the back of the foot
      [[fy + 4, h - 2], [fy - 1, fy + 4]].forEach(([y0, y1], k) => {
        const L = rowsOf(F, y0, y1);
        R.paint(L, r, { ...metal, round: 2, toneMap: (x, y, t) => { const kk = plateTone(R, f)(x, y, t); return y === y0 + 1 ? Math.max(1, kk - 1) : kk; } });
        if (k) cast(R, L, F, r, 0, 1);
      });
      R.stroke(R.curve([f.lc, fy], [f.lc, fy + 5], [f.lc, h - 3]), r.dp, inner(F));
    }
    // knee: domed poleyn with a winged side plate, gold rim and rivet
    if (!back) {
      const kx = side ? 24 : f.lc, ky = top - 2;
      const fx = side ? kx + 5 : kx + f.o * 5;
      const fan = R.M().poly(side ? [[fx - 2, ky - 3], [fx + 5, ky - 5], [fx + 4, ky + 3], [fx - 2, ky + 2]] : [[fx - f.o * 2, ky - 3], [fx + f.o * 4, ky - 5], [fx + f.o * 4, ky + 3], [fx - f.o * 2, ky + 2]]);
      R.paint(fan, r, { ...metal, round: 1.5, bias: -.08 });
      R.stroke(side ? R.curve([fx, ky - 3], [fx + 2, ky - 1], [fx + 2, ky + 2]) : R.curve([fx, ky - 3], [fx + f.o * 2, ky - 1], [fx + f.o * 2, ky + 2]), r.dp, inner(fan));
      const K = R.M().ellipse(kx, ky, side ? 4.6 : 5.6, 4.2);
      R.paint(K, r, { ...metal, round: 3.5, bias: .1, toneMap: plateTone(R, f, kx) });
      cast(R, K, U, r, 0, 1);
      const KI = inner(K);
      R.stroke(R.curve([kx - 5, ky + 2], [kx, ky + 5], [kx + 5, ky + 2]), gold.base, KI);
      R.stroke(R.curve([kx - 5, ky + 1], [kx - 3, ky + 3], [kx - 1, ky + 4]), gold.hi, KI);
      rivet(R, kx, ky - 1);
      glint(R, [[kx - 3, ky - 2], [kx - 2, ky - 3]], r);
    } else {
      // back of the knee: padded leather band
      const K = R.M().rect(f.lc - 7, top - 3, f.lc + 7, top).and(R.body((x, y, p) => p === 'leg').dilate(1));
      if (!side) K.keep(x => (f.i ? x >= V.cx + 1 : x <= V.cx - 1));
      R.paint(K, leather, { flat: true, round: 1.5 });
      R.stitch(R.curve([f.lc - 6, top - 2], [f.lc, top - 2], [f.lc + 6, top - 2]), leather.lt, inner(K), 1, 1);
    }
    heelSole(R, f, U, SOLEB, { hgt: 2, heel: 3, ext: 0 });
    // rowel spur at the heel
    if (side) { R.fill(R.M().rect(47, h - 5, 48, h - 5), gold.sh); R.sparkle(50, h - 5, gold.hi, 1); px(R, [[50, h - 5]], gold.sh); }
    else if (back) { R.fill(R.M().rect(f.lc, h - 7, f.lc, h - 5), gold.sh); R.sparkle(f.lc, h - 8, gold.hi, 1); px(R, [[f.lc, h - 8]], gold.sh); }
  }
});

// ---------------- new footwear ----------------
item('shoes', 'loafers', 'Coin Loafers', '#93492e', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R);
  // crew socks with a ribbed top (navy under very pale shoes so they stay apart)
  const sock = lum(r.base) > .8 ? ramp('#46507a') : SOCK;
  const SK = legWear(R, V.kneeY + 1, h, sock);
  ribTop(R, V.kneeY + 1, 2, sock);
  for (const f of feet(R)) {
    const top = fy + 1;
    const U = noArch(R, fm(R, f, top).keep((x, y) => side ? y >= top + (x > 27 && x < 40 ? 1 : 0) : true));
    R.paint(U, r, { flat: true, round: 3.5, toneMap: patentTone(R, f) });
    cast(R, U, SK, sock, 0, -1);
    const cl = inner(U);
    if (side) {
      // moc-toe seam wrapping the toe, hand stitches above it
      R.stroke(R.curve([17, fy + 6], [19, fy + 3], [26, fy + 3]), r.dp, cl);
      R.stroke(R.curve([18, fy + 7], [20, fy + 4], [26, fy + 4]), r.lt, cl);
      R.stitch(R.curve([18, fy + 4], [20, fy + 2], [25, fy + 2]), r.hi, cl, 1, 1);
      // saddle strap with the coin slit
      const st = R.M().poly([[26, top], [38, top + 1], [38, top + 4], [26, top + 4]]).and(U.clone().dilate(1));
      R.paint(st, r, { flat: true, round: 1.4, bias: .06 });
      cast(R, st, U, r, 0, 1);
      R.fill(R.M().rect(30, top + 2, 33, top + 2), r.line);
      px(R, [[31, top + 2]], BRASS.hi); px(R, [[32, top + 2]], BRASS.base);
      // welt stitching along the sole edge
      R.stitch(R.curve([18, h - 3], [30, h - 3], [44, h - 3]), r.lt, cl, 1, 1);
      patentShine(R, f, U, r);
    } else if (back) {
      R.stroke(R.curve([f.lc, top + 2], [f.lc, fy + 5], [f.lc, h - 4]), r.dp, cl);
      R.stitch(R.curve([f.lc - 4, top + 2], [f.lc - 4, fy + 5], [f.lc - 4, h - 4]), r.lt, cl, 1, 1);
      R.stitch(R.curve([f.lc + 4, top + 2], [f.lc + 4, fy + 5], [f.lc + 4, h - 4]), r.lt, cl, 1, 1);
      patentShine(R, f, U, r);
    } else {
      // saddle strap across the instep, coin in its slit
      const st = rowsOf(U, top + 1, top + 4);
      R.paint(st, r, { flat: true, round: 1.4, toneMap: (x, y, t) => (y === top + 2 ? 2 : patentTone(R, f)(x, y, t)), edge: softEdge(U) });
      cast(R, st, U, r, 0, 1);
      const cx = f.lc - f.o;
      R.fill(R.M().rect(cx - 2, top + 2, cx + 2, top + 3), r.line);
      px(R, [[cx - 1, top + 2], [cx, top + 2]], BRASS.hi); px(R, [[cx - 1, top + 3]], BRASS.base); px(R, [[cx, top + 3], [cx + 1, top + 2]], BRASS.sh);
      // moc-toe seam: a raised stitched ridge round the toe, polish glint above it
      R.stroke(R.curve([f.c - 6, h - 3], [f.c, top + 4], [f.c + 6, h - 3]).filter(([x, y]) => y > top + 5), r.sh, cl);
      R.stitch(R.curve([f.c - 5, h - 3], [f.c, top + 5], [f.c + 5, h - 3]).filter(([x, y]) => y > top + 5), r.hi, cl, 1, 1);
      glint(R, [[f.c - 5, top + 6], [f.c - 4, top + 6]], r);
      px(R, [[f.c - 6, top + 6]], r.hi);
    }
    heelSole(R, f, U, sink(r, .7), { hgt: 2, heel: 3, ext: 0, heelMat: ramp(mix(r.dp, [60, 40, 30], .5)) });
  }
});

item('shoes', 'wingboots', 'Winged Boots', '#6b8be0', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R), top = V.kneeY - 1;
  const feather = WHITE;
  const wing = (rx, ry, dir) => {
    // four feathers fanning out-and-up from the ankle: longest on top, drawn back to front
    const fs = [[-62, 11, 3.8], [-38, 10, 3.6], [-14, 8, 3.4], [8, 6, 3]];
    const all = R.M();
    fs.forEach(([ang, len, w], k) => {
      const a = ang * Math.PI / 180, tx = rx + dir * Math.cos(a) * len, ty = ry + Math.sin(a) * len;
      const mx2 = rx + dir * Math.cos(a) * len * .55, my = ry + Math.sin(a) * len * .55 - 1.2;
      const m = R.lock([rx, ry + k * .6], [mx2, my], [tx, ty], w, 1.2);
      R.paint(m, feather, { flat: true, round: 1.6, outline: feather.line });
      // rachis (quill line) and a shaded trailing edge
      R.stroke(R.curve([rx + dir, ry + k * .6], [mx2, my + .6], [tx - dir * 1.5, ty + .8]), feather.sh, inner(m));
      all.add(m);
    });
    // gold mount at the root
    R.paint(R.M().ellipse(rx, ry + 1, 1.8, 2.2), GOLD, { flat: true, round: 1.5, shiny: true });
    px(R, [[rx - 1, ry]], GOLD.spec);
    return all;
  };
  for (const f of feet(R)) {
    const U = noArch(R, fm(R, f, top));
    R.paint(U, r, { flat: true, round: 3, toneMap: bootTone(R, f) });
    const cl = inner(U);
    if (side) {
      wrinkle(R, [23, fy - 2], [25, fy - 1], [27, fy - 2], r, cl);
      R.stroke(R.curve([24, top + 4], [23, fy - 2], [21, fy + 2]), r.dp, cl);
      R.stitch(R.curve([25, top + 4], [24, fy - 2], [22, fy + 2]), r.hi, cl, 1, 1);
    } else if (!back) {
      wrinkle(R, [f.lc - 3, fy - 1], [f.lc - 1, fy], [f.lc + 1, fy - 1], r, cl);
      // front seam with gold piping
      R.stroke(R.curve([f.lc, top + 3], [f.lc, fy - 2], [f.lc, fy + 2]), GOLD.base, cl);
      R.stroke(R.curve([f.lc + 1, top + 3], [f.lc + 1, fy - 2], [f.lc + 1, fy + 2]), r.dp, cl);
    } else R.stitch(R.curve([f.lc, top + 3], [f.lc, fy], [f.lc, h - 4]), r.lt, cl, 1, 1);
    // gold toe guard
    if (!back) {
      const TG = side ? R.M().ellipse(17, h - 3, 4.5, 4.5).and(U).keep((x, y) => y <= h - 3) : R.M().ellipse(f.c, h - 2, 6.5, 4).and(U).keep((x, y) => y <= h - 3);
      R.paint(TG, GOLD, { flat: true, round: 2, shiny: true });
      cast(R, TG, U, r, 0, -1);
      glint(R, side ? [[16, h - 6]] : [[f.c - 4, h - 5], [f.c - 3, h - 5]], GOLD);
    }
    toeGlint(R, f, r, -1);
    // gold cuff band with a gem
    const C = cuff(R, f, U, top, GOLD, 3, 1);
    R.paint(C, GOLD, { flat: true, round: 1.5, shiny: true });
    cast(R, C, U, r, 0, 1);
    R.fill(rowsOf(inner(C), top, top).keep(x => side ? x < 30 : x < f.lc - 1), GOLD.hi);
    if (!back) R.gem(side ? 24 : f.lc, top + 1, 1.2, ramp('#e04a6a', 'gem'));
    heelSole(R, f, U, SOLEB, { hgt: 2, heel: 3, ext: 0 });
    // wings at the ankle
    if (side) wing(43, fy - 3, 1);
    else wing(f.o < 0 ? f.l + 2 : f.rt - 2, fy - 3, f.o);
  }
});

item('shoes', 'geta', 'Geta & Tabi', '#b07d4c', (R, ph, r) => {
  if (ph !== 'front') return;
  const V = R.V, h = V.h, fy = V.footY, side = isSide(R), back = isBack(R);
  const [hh, ss] = rgbHsl(r.base);
  const cord = ss > .25 && (hh < 25 || hh > 330) ? ramp('#2f3f78') : ramp('#c8323e');
  // tabi socks up the shin with a folded top band
  const SK = legWear(R, V.kneeY + 1, h - 3, SOCK);
  const band = R.body((x, y, p) => p === 'leg' && y >= V.kneeY + 1 && y <= V.kneeY + 2).dilate(1).keep((x, y) => y >= V.kneeY + 1 && y <= V.kneeY + 2 && R.part(x, y) === 'leg');
  R.paint(band, SOCK, { lines: true, round: 1.2, bias: .05 });
  for (const f of feet(R)) {
    const cl = inner(SK);
    if (isFront(R)) {
      // split toe
      const sx = f.c - f.o * 3;
      R.stroke([[sx, fy + 5], [sx, fy + 6], [sx, fy + 7], [sx, fy + 8]], SOCK.sh, cl);
      px(R, [[sx - 1, fy + 5], [sx - 1, fy + 6]], SOCK.hi);
      wrinkle(R, [f.lc - 3, fy - 1], [f.lc - 1, fy], [f.lc + 1, fy - 1], SOCK, cl);
    } else if (side) {
      // kohaze clasps up the back of the ankle
      [fy - 6, fy - 4, fy - 2].forEach(y => { R.fill(R.M().rect(43, y, 44, y), BRASS.base); px(R, [[43, y]], BRASS.hi); px(R, [[44, y]], BRASS.dp); });
      R.stroke([[45, fy - 7], [45, fy - 6], [45, fy - 5], [45, fy - 4], [45, fy - 3], [45, fy - 2], [45, fy - 1]], SOCK.sh, cl);
      wrinkle(R, [23, fy - 1], [25, fy], [27, fy - 1], SOCK, cl);
    } else {
      R.stroke(R.curve([f.lc + 1, V.kneeY + 3], [f.lc + 1, fy - 3], [f.lc + 1, fy]), SOCK.sh, cl);
      [fy - 6, fy - 4, fy - 2].forEach(y => { R.fill(R.M().rect(f.lc - 1, y, f.lc, y), BRASS.base); px(R, [[f.lc - 1, y]], BRASS.hi); });
    }
    // geta: board (dai) on two teeth (ha)
    const U = fm(R, f, fy);
    let x0 = 1e9, x1 = -1e9; U.each((x, y) => { if (y > fy + 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; } });
    if (side) { x0 -= 1; x1 += 1; } else if (f.o < 0) x0 -= 1; else x1 += 1;
    const board = R.M().rect(x0, h - 5, x1, h - 2);
    const teeth = R.M();
    if (side) teeth.rect(x0 + 3, h - 2, x0 + 8, h).rect(x1 - 8, h - 2, x1 - 3, h);
    else teeth.rect(x0 + 2, h - 2, x1 - 2, h);
    R.paint(teeth, sink(r, .5), { flat: true, round: 1.5 });
    R.paint(board, r, { flat: true, round: 1.8, toneMap: (x, y, t) => (y === h - 4 ? 2 : y === h - 3 ? 3 : t) });
    // wood grain on the board's face
    const gr = R.M(); inner(board).each((x, y) => { if (y === h - 3 && ((x * 5) % 9 < 3)) gr.set(x, y); });
    R.fill(gr, r.sh);
    px(R, [[x0 + 1, h - 4], [x0 + 2, h - 4]], r.hi);
    // hanao thong: V from between the toes down to both sides of the board
    const S = R.M();
    if (side) S.add(R.lock([18, h - 5], [23, fy - 1], [33, h - 5], 2.6, 2.4));
    else if (!back) {
      // the thong rises from between the toes and splits over the instep to both sides
      const sx = f.c - f.o * 3;
      S.add(R.lock([sx, h - 5], [sx, fy + 5], [sx, fy + 3], 2.4, 2.4));
      S.add(R.lock([sx, fy + 3], [x0 + 2, fy + 2], [x0 + 1, h - 5], 2.4, 2.2)).add(R.lock([sx, fy + 3], [x1 - 2, fy + 2], [x1 - 1, h - 5], 2.4, 2.2));
    } else S.add(R.lock([x0 + 1, h - 5], [f.lc, h - 6], [x1 - 1, h - 5], 1.6, 1.6)).keep((x, y) => x < x0 + 4 || x > x1 - 4);
    R.paint(S, cord, { flat: true, round: 1.3, toneMap: (x, y, t) => ((x + y) % 4 === 0 ? T5(t + 1) : t) });
    cast(R, S, SK, SOCK, 0, 1);
    if (!back && !side) { const sx = f.c - f.o * 3; R.paint(R.M().ellipse(sx, fy + 3, 1.4, 1.4), cord, { flat: true, round: 1, bias: .2 }); }
  }
});
})();
