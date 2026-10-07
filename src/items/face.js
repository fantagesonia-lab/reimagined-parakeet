// Pixie Closet wardrobe: face. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- FACE ----------------
// Face items draw over the face in the front and side views (side faces left).
// In the back view only an optional `back` painter runs (knots and straps that wrap round).
function face(id, name, dye, fn, extra = {}) {
  const { back, ...rest } = extra;
  return item('face', id, name, dye, (R, ph, r) => {
    if (ph !== 'front') return;
    if (R.view === 'back') { if (back) back(R, r, R.V.cx); return; }
    fn(R, r, R.V.eyes, R.view === 'side');
  }, rest);
}

const SKY = [196, 228, 255], WHITE_C = [255, 255, 255];
const onFace = R => (x, y) => R.isSkin(x, y, 'head');
// warm cast shadow on the skin under a piece
function faceShadow(R, m, dx = 1, dy = 1, strength = 1) {
  const t = [.93, .79, .78].map(v => 1 - strength + strength * v);
  shade(R, m, dx, dy, t, onFace(R));
}
// cast shadow straight on the buffer: darken what is under the mask shifted by (dx, dy), outside the mask
function shade(R, m, dx, dy, tint, only) {
  const a = m.a, buf = R.buf, steps = Math.max(Math.abs(dy), 1), sy = Math.sign(dy), hit = new Uint8Array(a.length), ox = R.V.ox, oy = R.V.oy;
  for (let i = 0; i < a.length; i++) if (a[i]) for (let k = 1; k <= steps; k++) {
    const j = i + sy * k * CW + Math.round(dx * k / steps);
    if (j >= 0 && j < a.length && !a[j]) hit[j] = 1;
  }
  for (let j = 0; j < hit.length; j++) {
    if (!hit[j] || !buf[j * 4 + 3] || (only && !only(j % CW - ox, (j / CW | 0) - oy))) continue;
    buf[j * 4] *= tint[0]; buf[j * 4 + 1] *= tint[1]; buf[j * 4 + 2] *= tint[2];
  }
}
function erode(m, n = 1) {
  let cur = m;
  for (let k = 0; k < n; k++) {
    const a = cur.a, e = cur.clone(), b = e.a;
    for (let i = CW; i < a.length - CW; i++) if (a[i] && !(a[i - 1] && a[i + 1] && a[i - CW] && a[i + CW])) b[i] = 0;
    cur = e;
  }
  return cur;
}
// tapered stroke along a bezier (same footprint as R.lock), stamped straight into the mask array
function lockF(R, p0, p1, p2, w0, w1 = 0, into) {
  const m = into || R.M(), a = m.a, ox = R.V.ox, oy = R.V.oy, pts = R.curve(p0, p1, p2), n = Math.max(1, pts.length - 1);
  pts.forEach(([x, y], k) => {
    const r = (w0 + (w1 - w0) * k / n) / 2;
    if (r < .6) { const X = x + ox, Y = y + oy; if (X >= 0 && Y >= 0 && X < CW && Y < CH) a[Y * CW + X] = 1; return; }
    const rr = (r + .35) * (r + .35), q = Math.ceil(r);
    for (let dy = -q; dy <= q; dy++) {
      const Y = y + dy + oy; if (Y < 0 || Y >= CH) continue;
      for (let dx = -q; dx <= q; dx++) { const X = x + dx + ox; if (dx * dx + dy * dy <= rr && X >= 0 && X < CW) a[Y * CW + X] = 1; }
    }
  });
  return m;
}
// how much a pixel faces the top-left light, seen from a centre: 1 lit .. -1 away
function litDir(x, y, cx, cy, sx = 1) {
  const dx = (x - cx) / sx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
  return (-.6 * dx - .8 * dy) / l;
}
const N4 = (x, y) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
// Hard rim (glasses frame): dark outer edge, bevelled inner edge, lit by direction from the lens centre.
function rim(R, frame, solid, cx, cy, r, sx = 1) {
  frame.each((x, y, i) => {
    const d = litDir(x, y, cx, cy, sx), nb = N4(x, y);
    let c;
    if (nb.some(([a, b]) => !solid.has(a, b))) c = d > .35 ? mix(r.line, r.dp, .5) : r.line;
    else if (nb.some(([a, b]) => !frame.has(a, b))) c = d > -.1 ? r.dp : r.lt;
    else c = d > .78 ? r.spec : d > .45 ? r.hi : d > .1 ? r.lt : d > -.4 ? r.base : r.sh;
    R.put(i, c);
  });
}
// Thin bar (temple arm, bridge, chain): lit top, dark underside.
function bar(R, m, r) {
  m.each((x, y, i) => {
    const up = !m.has(x, y - 1), dn = !m.has(x, y + 1), lf = !m.has(x - 1, y);
    R.put(i, dn ? r.line : up ? (lf ? r.hi : r.lt) : lf ? r.lt : r.base);
  });
}
// Clear glass: faint tint, a darker crescent on the far side, two glare streaks.
function glass(R, m, cx, cy, sx = 1, tint = SKY, a = 44) {
  const edge = m.clone().sub(erode(m)), far = R.M(), g1 = R.M(), g2 = R.M(), body = R.M();
  m.each((x, y) => {
    const s = (x - cx) / sx + (y - cy);
    if (s > -9.6 && s < -7.4 && y < cy) g1.set(x, y);
    else if (s > -4.6 && s < -3.4 && y < cy + 1) g2.set(x, y);
    else if (edge.has(x, y) && litDir(x, y, cx, cy, sx) < -.3) far.set(x, y);
    else body.set(x, y);
  });
  R.fill(body, tint, a); R.fill(far, mix(tint, [70, 90, 150], .5), 90);
  R.fill(g1, WHITE_C, 185); R.fill(g2, WHITE_C, 120);
}
// polygon in a rotated / squashed local frame
function frame(px, py, ang = 0, sx = 1, s = 1) {
  const c = Math.cos(ang), n = Math.sin(ang);
  return (u, v) => [px + (u * sx * c - v * n) * s, py + (u * sx * n + v * c) * s];
}
function starPts(cx, cy, ro, ri, rot = -Math.PI / 2, sx = 1) {
  const p = [];
  for (let k = 0; k < 10; k++) { const a = rot + k * Math.PI / 5, rr = k % 2 ? ri : ro; p.push([cx + Math.cos(a) * rr * sx, cy + Math.sin(a) * rr]); }
  return p;
}

// ---------- Round Glasses ----------
face('roundglass', 'Round Glasses', '#8a5a3c', (R, r, eyes, side) => {
  const fr = ramp(r.base, 'metal'), sx = side ? .7 : 1, rad = 9.3;
  const C = side ? [[17, 50]] : eyes;
  const arms = R.M();
  if (side) arms.add(lockF(R, [22, 45], [33, 43], [46, 45], 2, 2)).add(lockF(R, [11, 46], [7, 45], [2, 46], 2, 2));
  else {
    arms.add(lockF(R, [C[0][0] + 8, 45], [40, 40], [C[1][0] - 8, 45], 2, 2));
    arms.add(lockF(R, [C[0][0] - 9, 45], [11, 43], [5, 43], 2, 2)).add(lockF(R, [C[1][0] + 9, 45], [69, 43], [75, 43], 2, 2));
  }
  bar(R, arms, fr);
  const all = arms.clone();
  for (const [x, y] of C) {
    const solid = R.M().ellipse(x, y, rad * sx + 1.3, rad + 1.3), inner = R.M().ellipse(x, y, rad * sx - 1.4, rad - 1.4);
    glass(R, inner, x, y, sx);
    const ring = solid.clone().sub(inner);
    rim(R, ring, solid, x, y, fr, sx);
    all.add(ring);
  }
  if (side) { // the far lens peeks out past the nose
    const far = R.M().ellipse(1, 50, 2.2, 8.5).keep(x => x <= 2);
    R.fill(far, fr.line); R.fill(R.M().ellipse(1, 50, 1, 7).keep(x => x <= 1), mix(SKY, fr.base, .3), 150);
  } else for (const [x, y] of C) R.stud(x + (x < 40 ? -10 : 9), y - 5, ramp(r.base, 'metal'), 2); // hinges
  faceShadow(R, all, 1, 2, .8);
});

// ---------- Cool Shades ----------
face('shades', 'Cool Shades', '#2b2633', (R, r, eyes, side) => {
  const fr = ramp(r.base, 'metal');
  const lr = ramp(mix(r.base, [22, 18, 34], .55), 'metal');
  const all = R.M(), C = side ? [[17, 50]] : eyes;
  const lensPts = (x, y) => side
    ? [[x - 7, y - 5], [x + 6, y - 5], [x + 6, y], [x + 4, y + 5], [x, y + 6], [x - 4, y + 5], [x - 7, y + 1]]
    : [[x - 10, y - 5], [x + 10, y - 5], [x + 10, y], [x + 8, y + 5], [x + 4, y + 7], [x - 4, y + 7], [x - 8, y + 5], [x - 10, y]];
  // temples and bridge
  const arms = R.M();
  if (side) arms.add(lockF(R, [22, 45], [33, 43], [46, 45], 3, 2)).add(lockF(R, [10, 46], [6, 45], [2, 46], 2, 2));
  else {
    arms.add(R.M().rect(C[0][0] + 10, 44, C[1][0] - 10, 45));
    arms.add(lockF(R, [C[0][0] - 11, 45], [10, 43], [5, 43], 3, 2)).add(lockF(R, [C[1][0] + 11, 45], [70, 43], [75, 43], 3, 2));
  }
  bar(R, arms, fr); all.add(arms);
  for (const [x, y] of C) {
    const lens = R.M().poly(lensPts(x, y));
    const solid = lens.clone().dilate(1).add(R.M().rect(x - (side ? 8 : 11), y - 8, x + (side ? 7 : 11), y - 5));
    const fm = solid.clone().sub(lens);
    rim(R, fm, solid, x, y + 3, fr, side ? .7 : 1.4);
    // gradient lens: dark at the top, picking up a cool reflection at the bottom, two glare bars
    const top = y - 5, h = 12;
    lens.each((px, py, i) => {
      const t = (py - top) / h, s = (px - x) / (side ? .7 : 1) + (py - y);
      let k = t < .25 ? 5 : t < .55 ? 4 : t < .82 ? 3 : 2;
      if (s > -8.6 && s < -6.4) k = 1; else if (s > -4.5 && s < -3.5) k = 2;
      if (py === top && k > 4) k = 6;
      R.put(i, lr.t[k]);
    });
    R.fill(R.M().set(x + (side ? 3 : 6), y + 3), mix(lr.hi, WHITE_C, .5));
    all.add(solid);
    if (!side) R.stud(x + (x < 40 ? -10 : 9), y - 7, SILVER, 2);
  }
  if (side) R.fill(R.M().rect(0, 45, 1, 54).keep((x, y) => y < 53 || x > 0), lr.dp);
  faceShadow(R, all, 1, 2);
});

// ---------- Heart Shades ----------
function heart(R, cx, cy, s, sx = 1) {
  const m = R.M(), lr = s * .53;
  m.ellipse(cx - s * .47 * sx, cy - s * .3, lr * sx, lr).ellipse(cx + s * .47 * sx, cy - s * .3, lr * sx, lr);
  m.poly([[cx - s * sx, cy - s * .2], [cx + s * sx, cy - s * .2], [cx + .5, cy + s * .98]]);
  return m;
}
face('hearts', 'Heart Shades', '#f05a8e', (R, r, eyes, side) => {
  const fr = ramp(r.base, 'metal'), lr = ramp(mix(r.base, [255, 236, 244], .3));
  const sx = side ? .72 : 1, C = side ? [[17, 49]] : eyes.map(([x, y]) => [x, y - 1]);
  const arms = R.M();
  if (side) arms.add(lockF(R, [22, 44], [33, 43], [46, 45], 2, 2)).add(lockF(R, [10, 45], [6, 44], [2, 45], 2, 2));
  else {
    arms.add(lockF(R, [C[0][0] + 9, 44], [40, 41], [C[1][0] - 9, 44], 2, 2));
    arms.add(lockF(R, [C[0][0] - 10, 44], [11, 43], [5, 43], 2, 2)).add(lockF(R, [C[1][0] + 10, 44], [69, 43], [75, 43], 2, 2));
  }
  bar(R, arms, fr);
  const all = arms.clone();
  for (const [x, y] of C) {
    const solid = heart(R, x, y, 11, sx), lens = erode(solid, 2);
    // tinted lens with a soft top-left sheen
    lens.each((px, py, i) => {
      const d = litDir(px, py, x, y - 3, sx), t = (py - (y - 8)) / 18;
      R.put(i, d > .5 && t < .5 ? lr.hi : t < .45 ? lr.lt : t < .8 ? lr.base : lr.sh, 170);
    });
    const ring = solid.clone().sub(lens);
    rim(R, ring, solid, x, y - 1, fr, sx);
    // glints: a curved shine in the left lobe and a sparkle on the right
    const g = R.M(); R.curve([x - 7 * sx, y - 2], [x - 7 * sx, y - 6], [x - 4 * sx, y - 7]).forEach(([a, b]) => g.set(a, b));
    R.fill(g, WHITE_C, 220);
    R.fill(R.M().set(x - 3 * sx, y + 3), WHITE_C, 150);
    all.add(solid);
  }
  if (!side) R.sparkle(C[1][0] + 6, C[1][1] - 7, WHITE_C, 1);
  else R.fill(R.M().ellipse(1, 49, 1.5, 6).keep(x => x <= 1), fr.line);
  faceShadow(R, all, 1, 2);
});

// ---------- Eye Patch ----------
function skull(R, x, y, c, hole) {
  const m = R.M().rect(x - 1, y - 2, x + 1, y - 2).rect(x - 2, y - 1, x + 2, y + 1).rect(x - 1, y + 2, x + 1, y + 2);
  R.fill(m, c);
  R.fill(R.M().set(x - 1, y).set(x + 1, y).set(x, y + 2), hole);
}
face('patch', 'Eye Patch', '#2b2633', (R, r, eyes, side) => {
  const lr = ramp(r.base, 'leather'), sr = ramp(mix(r.base, [18, 14, 26], .3), 'leather');
  const [x, y] = side ? [18, 50] : eyes[1];
  const sx = side ? .74 : 1;
  const strap = R.M();
  if (side) strap.add(lockF(R, [x + 3, y - 6], [32, 40], [47, 38], 3, 3)).add(lockF(R, [x - 2, y - 8], [x - 3, 32], [x + 2, 16], 3, 3));
  else strap.add(lockF(R, [x - 5, y - 7], [36, 30], [12, 22], 3, 3)).add(lockF(R, [x + 7, y - 4], [70, 44], [77, 44], 3, 3));
  R.paint(strap, sr, { flat: true, round: 1.5 });
  faceShadow(R, strap, 1, 2);
  const pm = R.M().ellipse(x, y, 7.6 * sx, 8.4).add(R.M().poly([[x - 5 * sx, y + 4], [x + 5 * sx, y + 4], [x, y + 10]]));
  R.paint(pm, lr, { flat: true, round: 4.5, shiny: true });
  // stitched border and rivets where the strap joins
  const ring = R.M(); ring.add(erode(pm, 2)); const st = ring.clone().sub(erode(ring));
  const pts = []; st.each((px, py) => pts.push([px, py]));
  st.each((px, py, i) => { if ((px + py) % 3 === 0) R.put(i, lr.hi); });
  if (side) skull(R, x, y - 1, [232, 226, 214], lr.dp);
  else skull(R, x, y, [232, 226, 214], lr.dp);
  R.fill(R.M().set(x - 2 * sx, y - 5).set(x - 3 * sx, y - 4), lr.spec);
  if (!side) { R.stud(x - 6, y - 6, GOLD, 2); R.stud(x + 6, y - 3, GOLD, 2); }
  else R.stud(x + 3, y - 6, GOLD, 2);
  faceShadow(R, pm, 1, 2);
}, {
  back: (R, r, cx) => { // the strap and its buckle across the back of the head
    const sr = ramp(mix(r.base, [18, 14, 26], .3), 'leather');
    const m = lockF(R, [6, 44], [cx, 38], [74, 44], 3, 3);
    R.paint(m, sr, { flat: true, round: 1.5 });
    const b = R.M().rect(cx - 3, 38, cx + 2, 42); R.paint(b, ramp(GOLD.base, 'metal'), { flat: true, round: 1.5 });
    R.fill(R.M().rect(cx - 1, 39, cx, 41), sr.dp);
  },
});

// ---------- Ninja Mask ----------
// top edge: just under the eyes, rising to a peak over the bridge of the nose
const ninjaTop = x => 57 - 6 * Math.max(0, 1 - Math.abs(x - 40) / 10);
face('ninja', 'Ninja Mask', '#34303d', (R, r, eyes, side) => {
  const top = side ? (x => (x < 8 ? 53 + x * .45 : 56.6 + x / 30)) : ninjaTop;
  const m = R.body((x, y, p) => (p === 'head' && y >= top(x) && (side ? x < 42 : x > 9 && x < 71 && (y > 58 || (x > 12 && x < 68))))
    || (p === 'torso' && y <= 69 && (side ? x < 38 : Math.abs(x - 40) <= 9)));
  // a lit fold-over hem along the top edge, deep seam under it
  R.paint(m, r, {
    flat: true, round: 6, bias: .06,
    toneMap: (x, y, t) => { const d = y - Math.round(top(x)); return d <= 1 ? Math.max(0, Math.min(t, 2) - (d === 0 && t < 3 ? 1 : 0)) : d === 2 ? 5 : t; },
  });
  const inner = erode(m);
  if (side) {
    R.crease([3, 58], [9, 61], [18, 62], r, inner);
    R.crease([12, 57], [22, 60], [32, 61], r, inner);
    R.crease([6, 63], [14, 65], [26, 65], r, inner, { tone: 4 });
    R.crease([30, 66], [34, 67], [37, 68], r, inner, { tone: 4, noLip: true });
  } else {
    // tent folds falling from the nose ridge, a sag under the chin, the ridge itself lit
    R.crease([38, 54], [31, 58], [20, 59], r, inner);
    R.crease([36, 58], [30, 62], [21, 64], r, inner, { tone: 4 });
    R.crease([42, 54], [49, 58], [60, 59], r, inner, { noLip: true });
    R.crease([44, 58], [50, 62], [59, 64], r, inner, { tone: 4, noLip: true });
    R.crease([33, 64], [40, 66], [47, 64], r, inner, { tone: 4 });
    R.stroke(R.curve([40, 53], [40, 55], [40, 58]), r.lt, inner);
    R.crease([33, 68], [40, 69], [47, 68], r, inner, { tone: 4 });
  }
  // the mask presses on the cheeks: a little warm shade on the skin just above it
  shade(R, m, 0, -1, [.95, .86, .86], onFace(R));
  if (side) { // knot behind the ear and two tails streaming back
    const tails = lockF(R, [58, 59], [72, 62], [86, 70], 6, 1.5).add(lockF(R, [58, 61], [69, 69], [80, 80], 5, 1));
    R.paint(tails, r, { flat: true, round: 2.5 });
    R.crease([62, 60], [72, 63], [82, 68], r, tails, { tone: 4 });
    R.paint(R.M().ellipse(56, 59, 4, 3.5), r, { flat: true, round: 2.5, bias: .05 });
  }
}, {
  back: (R, r, cx) => {
    const tails = lockF(R, [cx - 2, 58], [cx - 7, 70], [cx - 11, 84], 6, 1.5).add(lockF(R, [cx + 2, 58], [cx + 7, 68], [cx + 13, 79], 5, 1));
    R.paint(tails, r, { flat: true, round: 2.5 });
    R.crease([cx - 3, 62], [cx - 7, 72], [cx - 10, 80], r, tails, { tone: 4 });
    R.paint(R.M().rect(6, 54, 74, 58), r, { flat: true, round: 2 });
    R.paint(R.M().ellipse(cx, 57, 5, 4), r, { flat: true, round: 3, bias: .08 });
    R.crease([cx - 3, 55], [cx, 58], [cx + 3, 56], r, R.M().ellipse(cx, 57, 5, 4), { tone: 4 });
  },
});

// ---------- Star Stickers ----------
// bevelled star: each half-point is a facet, lit by how much its outward direction faces the light
function starShade(R, m, cx, cy, rot, r, sx = 1) {
  const La = Math.atan2(-.8, -.6), seg = Math.PI / 5;
  m.each((x, y, i) => {
    const edge = N4(x, y).some(([a, b]) => !m.has(a, b));
    let th = Math.atan2(y - cy, (x - cx) / sx) - rot; th = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const j = Math.floor(th / seg), tipSide = j % 2 === 0;
    const d = Math.cos(rot + (j + (tipSide ? .8 : .2)) * seg - La);
    let c = d > .55 ? r.hi : d > .05 ? r.lt : d > -.45 ? r.base : r.sh;
    if (Math.hypot((x - cx) / sx, y - cy) < 1) c = r.hi;
    if (edge) c = d > .3 ? r.base : d > -.3 ? r.sh : r.dp;
    R.put(i, c);
  });
}
function sticker(R, cx, cy, ro, r, rot = -Math.PI / 2, sx = 1, glint = true) {
  const m = R.M().poly(starPts(cx, cy, ro, ro * .46, rot, sx)), back = m.clone().dilate(1);
  R.paint(back, WHITE, { flat: true, round: 1.5, outline: mix(WHITE.line, r.sh, .35) });
  starShade(R, m, cx, cy, rot, r, sx);
  if (glint) R.fill(R.M().set(Math.round(cx - 1 * sx), Math.round(cy - 2)), WHITE_C);
  shade(R, back, 1, 1, [.9, .76, .76], onFace(R));
}
function heartSticker(R, x, y, r) { // 5x4 pixel heart on a white die-cut backing
  const h = R.M().rect(x, y, x + 1, y).rect(x + 3, y, x + 4, y).rect(x, y + 1, x + 4, y + 1).rect(x + 1, y + 2, x + 3, y + 2).set(x + 2, y + 3);
  const hb = h.clone().dilate(1); R.paint(hb, WHITE, { flat: true, round: 1, outline: mix(WHITE.line, r.sh, .35) });
  R.fill(h, r.base); R.fill(R.M().set(x, y).set(x + 1, y + 1), r.hi); R.fill(R.M().set(x + 2, y + 3).set(x + 3, y + 2).set(x + 4, y + 1), r.sh);
  shade(R, hb, 1, 1, [.9, .76, .76], onFace(R));
}
face('stickers', 'Star Stickers', '#f5d04a', (R, r, eyes, side) => {
  const pink = ramp(mix(r.base, [255, 110, 165], .55));
  if (side) {
    sticker(R, 21, 61, 4.6, r, -Math.PI / 2 - .25, .85);
    heartSticker(R, 8, 57, pink);
    return;
  }
  sticker(R, 20, 60, 4.8, r, -Math.PI / 2 - .25);
  sticker(R, 60, 60, 4.8, r, -Math.PI / 2 + .25);
  sticker(R, 27, 64, 2.4, pink, -Math.PI / 2 + .3, 1, false);
  heartSticker(R, 49, 61, pink);
  R.sparkle(14, 55, mix(r.hi, WHITE_C, .6), 1);
});

// ---------- Bandage (across the bridge of the nose) ----------
face('bandaid', 'Bandage', '#f6d7b8', (R, r, eyes, side) => {
  const [x0, x1] = side ? [3, 12] : [31, 49], y0 = 52, y1 = 57;
  const [p0, p1] = side ? [5, 8] : [37, 43];
  const strip = R.M().rect(x0, y0, x1, y1).sub(R.M().set(x0, y0).set(x1, y0).set(x0, y1).set(x1, y1));
  if (side) strip.keep((x, y) => R.part(x, y) === 'head');
  const ink = mix(r.dp, [128, 108, 112], .45), pr = ramp(mix(r.base, [255, 252, 246], .62));
  faceShadow(R, strip, 1, 1);
  strip.each((x, y, i) => {
    const edge = N4(x, y).some(([a, b]) => !strip.has(a, b)) && !(side && x === x0);
    const pad = x >= p0 && x <= p1;
    let c;
    if (edge) c = ink;
    else if (pad) c = x === p0 || x === p1 ? r.sh : y === y0 + 1 ? pr.hi : y === y1 - 1 ? pr.base : pr.lt;
    else c = y === y0 + 1 ? r.hi : y === y1 - 1 ? r.sh : r.lt;
    R.put(i, c);
  });
  // quilted line across the pad and breathing holes on the tabs
  for (let x = p0 + 1; x < p1; x++) if (x % 2) R.put(strip.i(x, 55), pr.sh);
  const holes = side ? [[10, 54], [11, 56]] : [[33, 54], [35, 55], [33, 56], [45, 54], [47, 55], [45, 56]];
  for (const [x, y] of holes) if (strip.has(x, y)) R.put(strip.i(x, y), r.sh);
  // a lifted corner on the right end
  if (!side) { R.put(strip.i(48, 53), r.spec); R.put(strip.i(49, 54), mix(ink, r.sh, .5)); }
});

// ---------- Kitty Whiskers ----------
face('whiskers', 'Kitty Whiskers', '#5c3228', (R, r, eyes, side) => {
  const m = R.M();
  const ws = side
    ? [[[25, 57], [17, 56.2], [9, 55.5]], [[25, 60.5], [17, 60.5], [8, 60.5]], [[24, 64], [17, 64.2], [10, 65]]]
    : [[[29, 57], [18, 55], [6, 54]], [[29, 60.5], [17, 60], [5, 60.5]], [[29, 63.5], [18, 65], [8, 68]]];
  for (const [a, b, c] of ws) {
    m.add(lockF(R, a, b, c, side ? 1.2 : 1.6, .4));
    if (!side) m.add(lockF(R, [80 - a[0], a[1]], [80 - b[0], b[1]], [80 - c[0], c[1]], 1.6, .4));
  }
  m.each((x, y, i) => R.put(i, m.has(x, y + 1) || m.has(x, y - 1) ? (m.has(x, y + 1) ? r.base : r.dp) : r.sh, 240));
  // a little cat nose with a shine, and a soft blush on each cheek
  const nose = side ? R.M().rect(1, 54, 3, 54).rect(2, 55, 3, 55) : R.M().rect(38, 54, 42, 54).rect(39, 55, 41, 55).set(40, 56);
  const nr = ramp(mix(r.base, [240, 120, 140], .4));
  R.paint(nose, nr, { flat: true, round: 1 });
  R.fill(R.M().set(side ? 2 : 39, 54), nr.hi);
  for (const x of side ? [16] : [18, 62]) R.fill(R.M().ellipse(x, 58.5, 3.2, 1.3), [255, 130, 145], 64);
});

// ---------- Monocle (new) ----------
face('monocle', 'Gentleman Monocle', '#e0b04a', (R, r, eyes, side) => {
  const fr = ramp(r.base, 'metal'), sx = side ? .7 : 1, rad = 8.8;
  const [x, y] = side ? [17, 50] : eyes[0];
  const solid = R.M().ellipse(x, y, rad * sx + 1.4, rad + 1.4), inner = R.M().ellipse(x, y, rad * sx - 1.4, rad - 1.4);
  glass(R, inner, x, y, sx, [230, 240, 255], 50);
  const ring = solid.clone().sub(inner);
  rim(R, ring, solid, x, y, fr, sx);
  // fine engraved ticks on the rim
  ring.each((px, py, i) => { const a = Math.atan2(py - y, (px - x) / sx); if (Math.abs(Math.sin(a * 6)) < .12 && litDir(px, py, x, y, sx) > -.2 && !N4(px, py).some(([a2, b2]) => !ring.has(a2, b2))) R.put(i, fr.sh); });
  // eyelet and a chain swinging down to a clip on the collar
  const ex = x + (side ? 5 : 7), ey = y + 7;
  const path = side ? R.curve([ex, ey + 1], [24, 70], [27, 78]) : R.curve([ex, ey + 1], [36, 70], [33, 80]);
  const ch = R.M(); path.forEach(([a, b]) => ch.set(a, b));
  shade(R, ch, 1, 1, [.82, .74, .8]);
  path.forEach(([a, b], k) => R.fill(R.M().set(a, b), k % 3 === 0 ? fr.line : k % 3 === 1 ? fr.hi : fr.base));
  R.stud(ex - 1, ey - 1, fr, 2);
  const [qx, qy] = path[path.length - 1];
  R.paint(R.M().rect(qx - 1, qy, qx + 1, qy + 3), fr, { flat: true, round: 1, shiny: true });
  R.fill(R.M().set(qx - 1, qy), fr.spec);
  faceShadow(R, ring, 1, 2);
});

// ---------- Kitsune Mask (new): pushed aside over one eye ----------
const FOX_FACE = [[-11, -5], [-9.5, -10], [-4, -12], [4, -12], [9.5, -10], [11, -5], [11, 1], [8, 6], [4, 10], [1.5, 13], [-1.5, 13], [-4, 10], [-8, 6], [-11, 1]];
face('foxmask', 'Kitsune Mask', '#f7f3f8', (R, r, eyes, side) => {
  const red = ramp('#d8333f'), ink = ramp('#2a2030');
  const P = side ? frame(20, 50, -.12, .88, 1) : frame(60, 50, .26, 1, 1.05);
  const poly = pts => R.M().poly(pts.map(([u, v]) => P(u, v)));
  const both = pts => poly(pts).add(poly(pts.map(([u, v]) => [-u, v])));
  // cord tied round the head
  const cord = side ? lockF(R, P(9, -7), [38, 40], [48, 42], 2, 2) : lockF(R, P(-10, -7), [38, 33], [14, 28], 2, 2);
  R.paint(cord, red, { flat: true, round: 1 });
  const ears = both([[-11, -6], [-12.5, -21], [-3, -11]]);
  R.paint(ears, r, { flat: true, round: 3, shiny: true });
  R.paint(both([[-10, -8], [-11, -17.5], [-5.5, -11]]), red, { flat: true, round: 1.5, noOutline: true });
  const fm = poly(FOX_FACE), inside = erode(fm);
  R.paint(fm, r, { flat: true, round: 7, shiny: true });
  // muzzle ridges running down to the nose
  R.crease(P(-3, -1), P(-3.5, 4), P(-1.5, 9), r, inside, { tone: 4, lipTone: 1 });
  R.crease(P(3, -1), P(3.5, 4), P(1.5, 9), r, inside, { tone: 4, noLip: true });
  // red paint: eyeliner flicks, forehead flame, cheek stripes, inner ears
  const red1 = both([[-10.5, -7.5], [-2.5, -3.6], [-2.5, -2.2], [-9.5, -5.2]])
    .add(poly([[0, -11.6], [1.8, -8], [0, -5.2], [-1.8, -8]]))
    .add(both([[-10.6, 1.4], [-6, 2.2], [-6, 3.4], [-10.6, 2.8]])).add(both([[-9.6, 4.4], [-5.5, 5], [-5.5, 6.2], [-9, 5.8]]));
  red1.and(inside);
  red1.each((x, y, i) => R.put(i, red1.has(x, y - 1) ? (red1.has(x, y + 1) ? red.base : red.sh) : red.lt));
  // eye slits and nose
  const slit = both([[-8.5, -3.2], [-3, -1.4], [-3.4, .2], [-8, -1.2]]);
  R.fill(slit, ink.dp); R.fill(slit.clone().keep((x, y) => !slit.has(x, y - 1)), ink.line);
  R.paint(poly([[-2.6, 8.4], [2.6, 8.4], [0, 11.4]]), ink, { flat: true, round: 1 });
  // lacquer gloss on the brow
  const gl = R.M(); R.curve(P(-6, -10), P(-9.4, -8), P(-9.6, -3)).forEach(([a, b]) => gl.set(a, b));
  R.fill(gl.and(inside), WHITE_C, 235);
  R.fill(R.M().set(...P(-3, -10).map(Math.round)), WHITE_C, 200);
  faceShadow(R, fm.clone().add(ears), 1, 2);
  // tassel with a gold bead
  const [tx, ty] = P(side ? -7 : 9, 7).map(Math.round);
  const tc = lockF(R, [tx, ty], [tx + 1, ty + 4], [tx + 1, ty + 8], 1.5, 1.5);
  R.paint(tc, red, { flat: true, round: 1 });
  R.gem(tx + 1, ty + 10, 1.5, GOLD);
  const tas = lockF(R, [tx + 1, ty + 12], [tx + 1, ty + 15], [tx + 1, ty + 19], 3.6, 2.2);
  R.paint(tas, red, { flat: true, round: 1.5 });
  R.stroke(R.curve([tx + 1, ty + 13], [tx + 1, ty + 16], [tx + 1, ty + 18]), red.dp, tas);
});

// ---------- War Paint (new) ----------
face('facepaint', 'War Paint', '#d23a48', (R, r, eyes, side) => {
  const m = R.M();
  if (side) {
    m.add(lockF(R, [14, 59], [21, 58.8], [31, 59.6], 2.6, .5)).add(lockF(R, [14, 62.6], [20, 62.8], [28, 63.4], 2.4, .5));
  } else {
    for (const s of [-1, 1]) {
      const X = x => 40 + s * x;
      m.add(lockF(R, [X(9), 58.2], [X(16), 58], [X(26), 59.4], 2.8, .5)).add(lockF(R, [X(10), 62.4], [X(16), 62.6], [X(24), 64], 2.6, .5));
    }
    m.add(lockF(R, [40, 61.5], [40, 63.5], [40, 66], 2.4, 1));
  }
  m.keep((x, y) => R.isSkin(x, y, 'head'));
  // wet paint: lit top edge, deeper underside, glossy flecks
  m.each((x, y, i) => {
    const up = !m.has(x, y - 1), dn = !m.has(x, y + 1);
    R.put(i, up && !dn ? r.lt : dn && !up ? r.sh : r.base, 245);
  });
  const fleck = R.M(); m.each((x, y) => { if (!m.has(x, y - 1) && m.has(x, y + 1) && m.has(x - 2, y) && m.has(x + 2, y) && (x + y) % 4 === 0) fleck.set(x, y); });
  R.fill(fleck, r.hi);
  shade(R, m, 0, 1, [.95, .9, .92], onFace(R));
});
})();
