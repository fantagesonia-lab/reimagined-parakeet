// Pixie Closet wardrobe: back. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- BACK ----------------
// main(R, r, cx, view): in front/side views it runs in the 'back' phase (behind the body),
// in the back view in the 'front' phase (over the body).
// extra.over(R, r, cx, view): front/side views only, 'front' phase: straps, clasps and cords worn over the body.
function backItem(id, name, dye, main, extra = {}) {
  const { over, ...rest } = extra;
  return item('back', id, name, dye, (R, ph, r) => {
    const v = R.view, cx = R.V.cx;
    if (v === 'back') { if (ph === 'front') main(R, r, cx, v); }
    else if (ph === 'back') main(R, r, cx, v);
    else if (over) over(R, r, cx, v);
  }, rest);
}

const N4 = (x, y) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
// Fast primitives that work straight on mask arrays (the engine's generic ones are slow on big masks).
function erode(m, n = 1) {
  let cur = m;
  for (let k = 0; k < n; k++) {
    const a = cur.a, e = cur.clone(), b = e.a;
    for (let i = CW; i < a.length - CW; i++) if (a[i] && !(a[i - 1] && a[i + 1] && a[i - CW] && a[i + CW])) b[i] = 0;
    cur = e;
  }
  return cur;
}
// tapered stroke along a bezier (same shape as R.lock), optionally stamped into an existing mask
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
// cast shadow: darken what is already drawn under the mask shifted by (dx, dy), outside the mask
function shade(R, m, dx = 1, dy = 2, tint = [.8, .7, .84], only) {
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
// a fold drawn straight into the buffer: dark crease with a lit lip on its left, clipped
function creaseF(R, p0, p1, p2, r, clip, tone = 5, lipTone = 2) {
  const pts = R.curve(p0, p1, p2), on = new Set(pts.map(([x, y]) => x + ',' + y));
  for (const [x, y] of pts) {
    if (clip.has(x, y)) R.put(clip.i(x, y), r.t[tone]);
    if (lipTone != null && !on.has((x - 1) + ',' + y) && clip.has(x - 1, y)) R.put(clip.i(x - 1, y), r.t[lipTone]);
  }
}
function discF(R, m, x, y, r) { // filled disc stamped into a mask (same footprint as ellipse(x, y, r, r))
  const a = m.a, ox = R.V.ox, oy = R.V.oy, rr = (r + .35) * (r + .35);
  for (let Y = Math.floor(y - r); Y <= Math.ceil(y + r); Y++) {
    const gy = Y + oy; if (gy < 0 || gy >= CH) continue;
    for (let X = Math.floor(x - r); X <= Math.ceil(x + r); X++) { const gx = X + ox; if (gx >= 0 && gx < CW && (X - x) ** 2 + (Y - y) ** 2 <= rr) a[gy * CW + gx] = 1; }
  }
  return m;
}
// put a list of points straight into the buffer where the clip mask is set
function dotsIn(R, pts, c, clip) { for (const [x, y] of pts) if (!clip || clip.has(x, y)) { const i = clip ? clip.i(x, y) : R.M().i(x, y); if (i >= 0) R.put(i, c); } }
const edgeOf = m => m.clone().sub(erode(m));
function rrect(R, x0, y0, x1, y1, rad) {
  const m = R.M().rect(x0 + rad, y0, x1 - rad, y1).rect(x0, y0 + rad, x1, y1 - rad);
  return m.ellipse(x0 + rad, y0 + rad, rad, rad).ellipse(x1 - rad, y0 + rad, rad, rad).ellipse(x0 + rad, y1 - rad, rad, rad).ellipse(x1 - rad, y1 - rad, rad, rad);
}
function starPts(cx, cy, ro, ri, rot = -Math.PI / 2) {
  const p = [];
  for (let k = 0; k < 10; k++) { const a = rot + k * Math.PI / 5, rr = k % 2 ? ri : ro; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return p;
}
const onBody = (R, not) => (x, y) => R.part(x, y) !== null && !(not && not.has(x, y));
// drop shadow of a piece onto the body (or anything already drawn)
function castOn(R, m, only, dx = 1, dy = 2, tint = [.78, .7, .84]) { shade(R, m, dx, dy, tint, only); }
// Straight axis a -> b: point at distance t along, offset o across (perpendicular, to the right of travel)
function axis(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  return {
    L, ux, uy,
    at: (t, o = 0) => [a[0] + ux * t - uy * o, a[1] + uy * t + ux * o],
    u: (x, y) => (x - a[0]) * ux + (y - a[1]) * uy,
    w: (x, y) => -(x - a[0]) * uy + (y - a[1]) * ux,
  };
}
// rotated rectangle along an axis between t0 and t1, half widths o0 (left) / o1 (right)
function band(R, A, t0, t1, hw0, hw1 = hw0) { return R.M().poly([A.at(t0, -hw0), A.at(t1, -hw1), A.at(t1, hw1), A.at(t0, hw0)]); }
// a strap drawn as a stroke of given width along a polyline of bezier segments
function strapPath(R, segs, w) { const m = R.M(); for (const [a, b, c] of segs) lockF(R, a, b, c, w, w, m); return m; }

const CREAM = ramp('#fbf4ea'), IVORY = ramp('#efe4c8'), CRIMSON = ramp('#d8404e');
const IRON = ramp('#3d3a48', 'metal'), GOLDM = ramp('#f2c14e', 'metal'), SILVERM = ramp('#c9cfdc', 'metal');

// ---------------- wings ----------------
// Wing space: u = outward from the spine, v = down from the shoulder line.
// Front/back views draw the viewer-left wing and mirror it; the side view draws a darker far wing, then the near one.
function wingPasses(R) {
  const cx = R.V.cx;
  if (R.view === 'side') return [
    { far: true, f: (u, v) => [44 + u * .62, 68 + v * .9] },
    { far: false, f: (u, v) => [48 + u * .86, 75 + v] },
  ];
  return [{ f: (u, v) => [cx - 7 - u, 74 + v] }, { f: (u, v) => [cx + 7 + u, 74 + v] }];
}
function drawWings(R, build) {
  const all = R.M();
  // behind the body (front/side views), skip what the body will cover: saves most of the shading work
  const hidden = R.view === 'back' ? null : erode(R.body(() => true), 2);
  for (const W of wingPasses(R)) {
    const { f, far } = W;
    const k = {
      far, f, R,
      poly: pts => R.M().poly(pts.map(p => f(...p))),
      lock: (a, b, c, w0, w1, into) => lockF(R, f(...a), f(...b), f(...c), w0, w1, into),
      line: (a, b, c) => { const m = R.M(); R.curve(f(...a), f(...b), f(...c)).forEach(([x, y]) => m.set(x, y)); return m; },
      pts: (a, b, c) => R.curve(f(...a), f(...b), f(...c)),
      ell: (u, v, rx, ry) => { const [x, y] = f(u, v); return R.M().ellipse(x, y, rx, ry); },
      dot: (u, v) => R.M().set(...f(u, v).map(Math.round)),
      paint: (m, rr, o = {}) => { if (hidden) m.sub(hidden); R.paint(m, rr, { flat: true, ...o, bias: (o.bias || 0) + (far ? -.3 : 0) }); all.add(m); },
      crease: (a, b, c, rr, clip, o) => R.crease(f(...a), f(...b), f(...c), rr, clip, o),
      // soft shadow of an upper layer on the feathers / membrane below it
      shade: (m, under, dy = 2) => shade(R, m, 0, dy, [.84, .8, .9], (x, y) => under.has(x, y)),
    };
    build(k);
  }
  if (R.view === 'back') castOn(R, all, onBody(R, all), 1, 2);
  return all;
}
// rotated ellipse outline points in wing space
function ellPts(cu, cv, rx, ry, ang, n = 22) {
  const p = [], c = Math.cos(ang), s = Math.sin(ang);
  for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2, x = Math.cos(t) * rx, y = Math.sin(t) * ry; p.push([cu + x * c - y * s, cv + x * s + y * c]); }
  return p;
}
// points along a scalloped trailing edge from a to b, bowing toward `pull`
function scallop(a, b, pull, depth = .32, n = 6) {
  const m = [(a[0] + b[0]) / 2 + (pull[0] - (a[0] + b[0]) / 2) * depth, (a[1] + b[1]) / 2 + (pull[1] - (a[1] + b[1]) / 2) * depth], p = [];
  for (let k = 1; k < n; k++) { const t = k / n, s = 1 - t; p.push([s * s * a[0] + 2 * s * t * m[0] + t * t * b[0], s * s * a[1] + 2 * s * t * m[1] + t * t * b[1]]); }
  return p;
}

// ---------- Angel Wings ----------
// Rows of shingled feathers fanned from the arm: long flight feathers, coverts, small marginals.
function featherRows(R, k, r, rows, armW = [7, 4]) {
  const arm = s => { const t = 1 - s; return [t * t * 2 + 2 * t * s * 11 + s * s * 35, t * t * -2 + 2 * t * s * -26 + s * s * -31]; };
  const done = R.M(); // feathers already laid down: outlines over them are soft strand separations
  const soft = (x, y) => (done.has(x, y) ? TONE.SH : null);
  const am = k.lock(arm(0), arm(.5), arm(1), armW[0], armW[1]);
  for (const row of rows) {
    const { n, s0, s1, len, w0, w1, bias = 0, round = 3, dTheta = 0, vane, withArm } = row;
    // neighbours go in different batches so every feather keeps its own outline
    const batches = [R.M(), R.M()], vanes = [];
    for (let j = n - 1; j >= 0; j--) {
      const s = s0 + (s1 - s0) * j / Math.max(1, n - 1), root = arm(s);
      const th = (102 - 64 * s + dTheta) * Math.PI / 180, L = len[0] + (len[1] - len[0]) * s;
      const mid = [root[0] + Math.cos(th - .2) * L * .55, root[1] + Math.sin(th - .2) * L * .55];
      const tip = [root[0] + Math.cos(th) * L, root[1] + Math.sin(th) * L];
      k.lock(root, mid, tip, w0, w1, withArm ? am : batches[j % 2]);
      if (vane) vanes.push(k.pts([root[0] + Math.cos(th) * 4, root[1] + Math.sin(th) * 4], mid, [root[0] + Math.cos(th) * L * .78, root[1] + Math.sin(th) * L * .78]));
    }
    if (withArm) continue;
    const rowM = R.M();
    batches.forEach((m, i) => { k.paint(m, r, { round, bias: bias - i * .05, edge: soft }); rowM.add(m); done.add(m); });
    const inner = erode(rowM);
    for (const p of vanes) dotsIn(R, p, r.sh, inner);
    k.shade(rowM, done, 2);
  }
  k.paint(am, r, { round: 3, bias: .14, edge: soft });
  k.shade(am, done, 2);
  return done.add(am);
}
backItem('angel', 'Angel Wings', '#f7f3f8', (R, r) => {
  drawWings(R, k => featherRows(R, k, r, [
    { n: 9, s0: .03, s1: 1, len: [22, 25], w0: 10, w1: 4, bias: -.06, vane: true },
    { n: 8, s0: .02, s1: .94, len: [12, 15], w0: 9, w1: 4.5, bias: .03, dTheta: 6 },
    { n: 7, s0: 0, s1: .9, len: [6, 8], w0: 6.5, w1: 3.5, dTheta: 12, withArm: true },
  ]));
});

// ---------- membrane wings (bat, dragon) ----------
// joints in wing space: wrist, finger tips (top to bottom), body attachment; panels alternate light/dark like a folded fan
function membraneWing(k, r, o) {
  const R = k.R;
  const { wrist: W, tips, body, elbow, mem, bone, claw, depth = .3, spikes, tipClaws, horn = 1 } = o;
  const panels = [];
  const chain = [...tips, body];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i], b = chain[i + 1], sc = scallop(a, b, W, depth);
    panels.push(i < chain.length - 2 ? [W, a, ...sc, b] : [W, a, ...sc, b, [0, 6], [0, -2], elbow]);
  }
  // leading edge membrane between arm and first finger
  panels.unshift([[0, -2], elbow, W, tips[0], [W[0] + 3, W[1] - 2]]);
  const masks = panels.map(p => k.poly(p)), last = masks[masks.length - 1];
  // thin membrane: darker by the bones, glowing lighter toward the trailing edge
  const [wx, wy] = k.f(...W);
  const glow = (x, y, t) => { if (last.has(x, y)) return t; const d = Math.hypot(x - wx, y - wy); return Math.max(0, Math.min(5, t + (d > 24 ? -1 : d < 9 ? 1 : 0))); };
  const even = R.M(), odd = R.M();
  masks.forEach((m, i) => (i % 2 ? odd : even).add(m));
  k.paint(even, mem, { round: 5, bias: .06, toneMap: glow });
  k.paint(odd, mem, { round: 5, bias: -.12, toneMap: glow });
  // veins running from the bones into each panel
  tips.forEach((t, i) => {
    const nx = chain[i + 1], mid = [(t[0] + nx[0]) / 2, (t[1] + nx[1]) / 2];
    const into = [mid[0] + (W[0] - mid[0]) * (depth * .5), mid[1] + (W[1] - mid[1]) * (depth * .5)];
    dotsIn(R, k.pts([W[0] + (t[0] - W[0]) * .45, W[1] + (t[1] - W[1]) * .45], [(W[0] + into[0]) / 2 + 2, (W[1] + into[1]) / 2], into), mem.sh);
  });
  // bones: arm, forearm, fingers and the wrist knuckle in one piece
  const bones = k.lock([0, 0], [7, -8], elbow, 5, 4);
  k.lock(elbow, [(elbow[0] + W[0]) / 2, (elbow[1] + W[1]) / 2 - 1], W, 4, 3.2, bones);
  tips.forEach(t => k.lock(W, [(W[0] + t[0]) / 2, (W[1] + t[1]) / 2 - 1.5], t, 3, 1.2, bones));
  discF(R, bones, wx, wy, 2.6);
  k.paint(bones, bone, { round: 1.6, bias: .08 });
  R.fill(bones.clone().keep((x, y) => !bones.has(x, y - 1) && bones.has(x, y + 1) && bones.has(x, y + 2)), bone.hi);
  const claws = R.M();
  if (spikes) spikes.forEach(([a, b, c]) => claws.add(k.poly([a, b, c])));
  k.lock([W[0] + 1, W[1] - 1], [W[0] + 2 * horn, W[1] - 6 * horn], [W[0] - 2 * horn, W[1] - 9 * horn], 2.6 * Math.sqrt(horn), .6, claws);
  if (tipClaws) tips.forEach(t => { const d = [t[0] - W[0], t[1] - W[1]], L = Math.hypot(...d); k.lock(t, [t[0] + d[0] / L * 2, t[1] + d[1] / L * 2], [t[0] + d[0] / L * 4, t[1] + d[1] / L * 4 + 1], 2, .5, claws); });
  k.paint(claws, claw, { round: 1.5, shiny: true });
}
function memKit(R, k) { k.paintLine = (m, c) => R.fill(m, c); k.R = R; return k; }

backItem('bat', 'Bat Wings', '#4a2e5c', (R, r) => {
  const sat = (Math.max(...r.base) - Math.min(...r.base)) / 255; // keep greys grey
  const mem = ramp(mix(r.base, [255, 170, 200], Math.min(.12, sat * .4))), bone = ramp(mix(r.base, [16, 10, 24], .42));
  drawWings(R, k => membraneWing(memKit(R, k), r, {
    wrist: [28, -24], elbow: [13, -15], tips: [[54, -29], [57, -9], [48, 10], [32, 17]], body: [5, 14],
    mem, bone, claw: IVORY, depth: .34,
  }));
});

backItem('dragonwings', 'Dragon Wings', '#b8323c', (R, r) => {
  const mem = ramp(mix(r.base, [255, 190, 110], .1)), bone = ramp(mix(r.base, [30, 16, 34], .55), 'leather');
  drawWings(R, k => membraneWing(memKit(R, k), r, {
    wrist: [27, -37], elbow: [11, -22], tips: [[52, -45], [57, -18], [51, 7], [35, 20]], body: [5, 17],
    mem, bone, claw: IVORY, depth: .14, tipClaws: true, horn: 1.5,
    spikes: [[[5, -8], [2, -15], [9, -11]], [[11, -18], [9, -26], [15, -21]], [[18, -26], [18, -34], [22, -29]]],
  }));
});

// ---------- Fairy Wings ----------
backItem('fairywings', 'Fairy Wings', '#a8dcf5', (R, r) => {
  const rim2 = ramp(mix(r.base, [255, 236, 250], .55));
  drawWings(R, k => {
    const wings = [
      { pts: ellPts(25, -12, 23, 9.5, -.48), root: [2, -2], tip: [45, -22], veins: [[38, -22], [44, -14], [30, -25], [36, -8]] },
      { pts: ellPts(17, 11, 16, 7.5, .5), root: [2, 2], tip: [30, 19], veins: [[26, 19], [30, 11], [17, 18]] },
    ];
    for (const w of wings.reverse()) {
      const m = k.poly(w.pts), inner = erode(m, 2);
      const [rx, ry] = k.f(...w.root), [tx, ty] = k.f(...w.tip), span = Math.hypot(tx - rx, ty - ry);
      const dist = (x, y) => Math.min(Math.hypot(Math.abs(x - R.V.cx) - Math.abs(rx - R.V.cx), y - ry), span * 1.4) / span;
      k.paint(m, r, {
        round: 6, alpha: 200, noOutline: true,
        toneMap: (x, y, t) => { const d = dist(x, y); return Math.max(0, Math.min(5, t + (d < .3 ? 1 : d > .75 ? -1 : 0))); },
        pattern: (x, y) => !inner.has(x, y) ? rim2 : null,
      });
      // veins from the root, a glassy gleam near the leading edge, then the crisp outline
      for (const v of w.veins) R.fill(k.line(w.root, [(w.root[0] + v[0]) / 2 + 1, (w.root[1] + v[1]) / 2], v).and(inner), r.dp, 150);
      R.fill(edgeOf(m), r.line);
    }
    const gleam = k.line([14, -14], [26, -23], [40, -24]).and(erode(k.poly(wings[1].pts), 2));
    R.fill(gleam, [255, 255, 255], 200);
    const [sx, sy] = k.f(47, -25); R.sparkle(Math.round(sx), Math.round(sy), [255, 255, 255], 1);
    if (!k.far) { const [px, py] = k.f(30, 18); R.sparkle(Math.round(px), Math.round(py), mix(r.hi, [255, 255, 255], .6), 1); }
  });
});

// ---------- Butterfly Wings (new) ----------
backItem('butterfly', 'Butterfly Wings', '#f08a3c', (R, r) => {
  const dark = ramp(mix(r.base, [26, 20, 36], .8)), pale = ramp(mix(r.base, [255, 250, 230], .6));
  drawWings(R, k => {
    const fore = [[2, -1], [8, -12], [20, -24], [34, -31], [44, -30], [49, -24], [48, -14], [42, -6], [30, -2], [16, 1], [6, 2]];
    const hind = [[3, 2], [16, 0], [29, 2], [37, 8], [40, 16], [36, 24], [28, 29], [23, 37], [19, 31], [10, 24], [4, 13]];
    const scale = (pts, s, c) => pts.map(([u, v]) => [c[0] + (u - c[0]) * s, c[1] + (v - c[1]) * s]);
    for (const [pts, root, s, spotN] of [[hind, [3, 4], .74, 5], [fore, [4, -1], .76, 7]]) {
      const m = k.poly(pts), core = k.poly(scale(pts, s, root));
      const bandM = m.clone().sub(core);
      k.paint(m, r, { round: 7, pattern: (x, y) => bandM.has(x, y) ? dark : null });
      // veins radiating from the root through the coloured core
      const vein = R.M();
      pts.forEach((p, i) => { if (i % 2 === 0 && i > 0 && i < pts.length - 1) vein.add(k.line(root, [(root[0] + p[0]) / 2, (root[1] + p[1]) / 2 + 1], scale([p], s + .04, root)[0])); });
      R.fill(vein.and(erode(core)), dark.base);
      // white spots in the dark margin
      const outer = scale(pts, (1 + s) / 2, root);
      outer.forEach((p, i) => { if (i > 0 && i <= spotN) R.fill(k.dot(...p), [250, 246, 236]); });
    }
    // eyespot on the hind wing and a pale window near the fore wing tip
    const eye = k.ell(26, 17, 3.4, 3.4), pupil = k.ell(26, 17, 1.8, 1.8);
    R.fill(eye, dark.base); R.fill(pupil, pale.lt); R.fill(edgeOf(eye), dark.line);
    R.fill(k.dot(25, 16), [255, 255, 255]);
    const win = k.poly([[34, -26], [40, -27], [42, -22], [37, -21]]);
    k.paint(win, pale, { round: 2, noOutline: true });
  });
});

// ---------- Hero Cape ----------
backItem('cape', 'Hero Cape', '#c8364a', (R, r, cx, v) => {
  const lining = ramp(mix(r.base, [28, 14, 40], .42)), hem = 121;
  const trim = (x, y, hy) => y > hy - 3;
  if (v === 'side') {
    // folds radiate from the shoulder as the cape flares back
    const C = [34, 60], ang = (x, y) => Math.atan2(x - C[0], y - C[1]), ph = (x, y) => Math.cos(ang(x, y) * 22);
    const hy = (x, y) => hem + 1.5 * ph(x, y);
    const m = R.M().poly([[29, 67], [44, 67], [54, 84], [64, 104], [72, hem + 2], [38, hem + 2], [35, 100], [32, 82]]);
    m.keep((x, y) => y <= hy(x, y)).sub(erode(R.body(() => true), 2));
    R.paint(m, r, {
      flat: true, round: 7,
      toneMap: (x, y, t) => { if (y > hy(x, y) - 3) return t; const f = ph(x, y); return y < 76 ? t : Math.max(0, Math.min(5, t + (f > .5 ? -1 : f < -.5 ? 1 : 0))); },
      pattern: (x, y) => trim(x, y, hy(x, y)) ? GOLDM : null,
    });
    const inner = erode(m);
    for (const a0 of [Math.PI / 22, 3 * Math.PI / 22, 5 * Math.PI / 22]) {
      const at = d => [C[0] + Math.sin(a0) * d, C[1] + Math.cos(a0) * d];
      creaseF(R, at(22), at(40), at(58), r, inner, 5, 2);
    }
    return;
  }
  const back = v === 'back', top = back ? 66 : 67;
  const hw = y => (back ? 19 : 19) + (y - top) * ((back ? 12 : 15) / (hem - top));
  const s = (x, y) => (x - cx) / hw(y);
  // fold phase per pixel, cached: the shading callbacks run several times per pixel
  const cache = new Float32Array(CW * CH).fill(9), ox = R.V.ox, oy = R.V.oy;
  const ph = (x, y) => { const i = (y + oy) * CW + x + ox; let c = cache[i]; if (c === 9) c = cache[i] = Math.cos(s(x, y) * 3.4 * Math.PI); return c; };
  const hy = (x, y) => hem + 1.6 * ph(x, y);
  const m = R.M().poly([[cx - hw(top) + 1, top - 1], [cx + hw(top) - 1, top - 1], [cx + hw(hem + 2), hem + 2], [cx - hw(hem + 2), hem + 2]]);
  m.keep((x, y) => y <= hy(x, y));
  // back view: the arms hang in front of the cape. Shade the whole cape, then put the arm pixels back.
  const arms = back ? R.body((x, y, p) => (p === 'arm' && y > R.V.sleeveShort) || p === 'hand') : null, saved = [];
  if (back) arms.each((x, y, i) => saved.push(i, R.buf[i * 4], R.buf[i * 4 + 1], R.buf[i * 4 + 2], R.buf[i * 4 + 3]));
  else m.sub(erode(R.body(() => true), 2)); // hidden behind the body anyway
  R.paint(m, back ? r : lining, {
    flat: true, round: 8,
    toneMap: (x, y, t) => {
      const hb = hy(x, y);
      if (y > hb - 3) return t; if (Math.round(y) === Math.round(hb - 3)) return 5;
      const f = ph(x, y), k = Math.min(1, Math.max(0, (y - 74) / 14));
      return Math.max(0, Math.min(5, t + Math.round((f > .45 ? -1 : f < -.45 ? 1 : 0) * k)));
    },
    pattern: (x, y) => trim(x, y, hy(x, y)) && Math.round(y) !== Math.round(hy(x, y) - 3) ? GOLDM : !back && Math.abs(s(x, y)) > .9 ? r : null,
  });
  const inner = erode(m);
  // creases in the fold valleys
  for (const sv of [-.88, -.29, .29, .88]) {
    const at = y => [cx + sv * hw(y), y];
    R.crease(at(back ? 80 : 88), at(102), at(hem - 4), back ? r : lining, inner, { tone: 5 });
  }
  if (!back) return;
  for (let k = 0; k < saved.length; k += 5) { const o = saved[k] * 4; R.buf[o] = saved[k + 1]; R.buf[o + 1] = saved[k + 2]; R.buf[o + 2] = saved[k + 3]; R.buf[o + 3] = saved[k + 4]; }
  castOn(R, arms, (x, y) => m.has(x, y) && !arms.has(x, y), 1, 1, [.8, .72, .84]);
  // mantle collar with gold trim, and a gold star crest
  const mantle = R.M().poly([[cx - 15, 63], [cx + 15, 63], [cx + 22, 69], [cx + 14, 75], [cx + 6, 72], [cx, 75], [cx - 6, 72], [cx - 14, 75], [cx - 22, 69]]);
  castOn(R, mantle, (x, y) => m.has(x, y), 0, 2);
  R.paint(mantle, r, { flat: true, round: 3.5, bias: .1, pattern: (x, y) => (!mantle.has(x, y + 1) || !mantle.has(x, y + 2)) ? GOLDM : null });
  const mIn = erode(mantle);
  R.crease([cx - 9, 66], [cx - 11, 70], [cx - 14, 73], r, mIn, { tone: 4 });
  R.crease([cx + 9, 66], [cx + 11, 70], [cx + 14, 73], r, mIn, { tone: 4 });
  const star = R.M().poly(starPts(cx, 87, 4.6, 2));
  castOn(R, star, (x, y) => m.has(x, y), 1, 1);
  R.paint(star, GOLDM, { flat: true, round: 2 });
  R.fill(R.M().set(cx - 1, 85), [255, 255, 255]);
}, {
  over: (R, r, cx, v) => { // fabric over the shoulders and a gold clasp at the collarbone
    const drape = v === 'side'
      ? R.M().poly([[29, 67], [44, 67], [47, 71], [39, 73], [31, 71]])
      : R.M().poly([[cx - 8, 66], [cx - 17, 66], [cx - 23, 70], [cx - 21, 73], [cx - 14, 72], [cx - 8, 69]]).mirror();
    castOn(R, drape, onBody(R, drape), 0, 2);
    R.paint(drape, r, { flat: true, round: 2.5, bias: .05 });
    if (v === 'side') { R.gem(28, 70, 2, GOLDM); return; }
    const chain = R.curve([cx - 6, 70], [cx, 75], [cx + 6, 70]);
    chain.forEach(([x, y], i) => R.fill(R.M().set(x, y), i % 2 ? GOLDM.hi : GOLDM.sh));
    R.gem(cx - 8, 69, 2.2, GOLDM); R.gem(cx + 8, 69, 2.2, GOLDM);
  },
});

// ---------- Backpack ----------
backItem('backpack', 'Backpack', '#f08a3c', (R, r, cx, v) => {
  const web = ramp(mix(r.base, [36, 32, 48], .55)), base = ramp(mix(r.base, [70, 46, 36], .5), 'leather');
  if (v === 'side') {
    const body = rrect(R, 46, 71, 60, 101, 5);
    R.paint(body, r, { flat: true, round: 6 });
    R.paint(body.clone().keep((x, y) => y >= 97), base, { flat: true, round: 2 });
    const lid = rrect(R, 45, 69, 61, 81, 4).keep((x, y) => y <= 79 + (x - 45) * .15);
    castOn(R, lid, (x, y) => body.has(x, y), 0, 2);
    R.paint(lid, r, { flat: true, round: 3.5, bias: .1 });
    R.stitch(R.curve([47, 77], [53, 78.5], [59, 79]), r.lt, lid, 1, 1);
    // side pocket with an elastic top, front pocket bulge, zip seam round the side panel
    const sp = rrect(R, 48, 87, 56, 100, 2);
    castOn(R, sp, (x, y) => body.has(x, y), 1, 1);
    R.paint(sp, r, { flat: true, round: 3, bias: -.08, pattern: (x, y) => y <= 88 ? web : null });
    const fp = rrect(R, 56, 85, 62, 100, 3);
    R.paint(fp, r, { flat: true, round: 3, bias: -.04 });
    R.stitch(R.curve([50, 83], [50, 84], [57, 84]), SILVERM.hi, body, 1, 1);
    R.fill(R.M().rect(59, 92, 60, 95), SILVERM.base); R.fill(R.M().set(59, 92), SILVERM.spec);
    return;
  }
  if (v !== 'back') return; // front view: only the straps show (drawn over the body)
  const bx0 = cx - 13, bx1 = cx + 13, by0 = 70, by1 = 101;
  const straps = lockF(R, [cx - 9, 72], [cx - 10, 68], [cx - 11, 65], 5, 5).mirror();
  R.paint(straps, web, { flat: true, round: 2 });
  const side = rrect(R, cx - 16, 84, cx - 11, 100, 2).mirror();
  R.paint(side, r, { flat: true, round: 2, bias: -.15 });
  const body = rrect(R, bx0, by0, bx1, by1, 6);
  castOn(R, body, onBody(R, body.clone().add(side)), 1, 2);
  R.paint(body, r, { flat: true, round: 7 });
  R.paint(body.clone().keep((x, y) => y >= 97), base, { flat: true, round: 2 });
  R.stitch(R.curve([bx0 + 2, 96], [cx, 96], [bx1 - 2, 96]), base.lt, body, 1, 1);
  // carry loop
  R.paint(lockF(R, [cx - 3, 71], [cx, 66], [cx + 3, 71], 2, 2), web, { flat: true, round: 1 });
  // lid flap with a curved lip, stitching, and a strap with buckle
  const lid = rrect(R, bx0 - 1, by0 - 1, bx1 + 1, 84, 5).keep((x, y) => y <= 80 + 3 * Math.cos((x - cx) / 14 * Math.PI / 2));
  castOn(R, lid, (x, y) => body.has(x, y), 0, 2);
  R.paint(lid, r, { flat: true, round: 4, bias: .1 });
  const lidIn = erode(lid, 2), lidSt = edgeOf(lidIn).keep((x, y) => y > by0 + 2);
  lidSt.each((x, y, i) => { if ((x + y) % 3 !== 0) R.put(i, r.lt); });
  const ls = R.M().rect(cx - 2, 77, cx + 2, 91);
  castOn(R, ls, (x, y) => body.has(x, y), 1, 1);
  R.paint(ls, web, { flat: true, round: 1.5 });
  const buckle = R.M().rect(cx - 3, 84, cx + 3, 88);
  R.paint(buckle, SILVERM, { flat: true, round: 1.5 });
  R.fill(R.M().rect(cx - 1, 85, cx + 1, 87), web.dp); R.fill(R.M().rect(cx, 85, cx, 87), SILVERM.sh);
  // front pocket with zip, pull tab and a little star charm
  const pk = rrect(R, cx - 10, 89, cx + 10, 100, 3).sub(ls.clone().keep((x, y) => y < 92));
  castOn(R, pk, (x, y) => body.has(x, y), 1, 1);
  R.paint(pk, r, { flat: true, round: 4, bias: -.02 });
  for (let x = cx - 8; x <= cx + 8; x++) R.fill(R.M().set(x, 92), x % 2 ? SILVERM.hi : web.dp);
  R.stitch(R.curve([cx - 9, 98], [cx, 99], [cx + 9, 98]), r.lt, pk, 1, 1);
  R.paint(R.M().rect(cx + 5, 92, cx + 6, 95), SILVERM, { flat: true, round: 1 });
  const charm = R.M().poly(starPts(cx + 6, 98, 2.6, 1.2));
  R.paint(charm, GOLDM, { flat: true, round: 1.5 });
}, {
  over: (R, r, cx, v) => {
    const web = ramp(mix(r.base, [36, 32, 48], .55));
    let st;
    if (v === 'side') st = strapPath(R, [[[47, 72], [40, 65], [31, 69]], [[31, 69], [24, 74], [23, 90]]], 4);
    else st = lockF(R, [cx - 9, 66], [cx - 13, 76], [cx - 12, 91], 5, 5).mirror();
    castOn(R, st, onBody(R, st), 1, 1);
    R.paint(st, web, { flat: true, round: 2 });
    if (v === 'side') { R.paint(R.M().rect(22, 84, 25, 86), SILVERM, { flat: true, round: 1 }); return; }
    R.stitch(R.curve([cx - 10, 69], [cx - 12, 78], [cx - 12, 89]), web.lt, st, 1, 1);
    R.stitch(R.curve([cx + 10, 69], [cx + 12, 78], [cx + 12, 89]), web.lt, st, 1, 1);
    // sternum strap with a clip, ladder-lock adjusters
    const ss = R.M().rect(cx - 11, 79, cx + 11, 80);
    castOn(R, ss, onBody(R, ss), 0, 1);
    R.paint(ss, web, { flat: true, round: 1 });
    R.paint(R.M().rect(cx - 3, 77, cx + 3, 82), r, { flat: true, round: 1.5, bias: .1 });
    R.fill(R.M().rect(cx - 1, 79, cx + 1, 80), r.dp);
    for (const x of [cx - 14, cx + 12]) R.paint(R.M().rect(x, 85, x + 2, 87), SILVERM, { flat: true, round: 1 });
  },
});

// ---------- quiver & katana geometry: [top end, bottom end] per view ----------
function slung(R, front, side) {
  const v = R.view, cx = R.V.cx;
  if (v === 'side') return side;
  return v === 'back' ? front.map(([x, y]) => [2 * cx - x, y]) : front;
}

// ---------- Ranger Quiver ----------
function arrow(R, A, t0, len, off, spread, vane) {
  const a = A.at(t0, off), dir = [A.ux * Math.cos(spread) - A.uy * Math.sin(spread), A.uy * Math.cos(spread) + A.ux * Math.sin(spread)];
  const b = [a[0] - dir[0] * len, a[1] - dir[1] * len];
  const S = axis(b, a); // from the nock end toward the quiver
  R.stroke(R.curve(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b), WOOD.base);
  R.stroke(R.curve(S.at(1, -.6), S.at(len / 2, -.6), S.at(len - 1, -.6)).filter((p, i) => i % 2 === 0), WOOD.hi);
  const vm = R.M().poly([S.at(1, 0), S.at(1.5, -2.6), S.at(7, -2.2), S.at(8.5, 0)]).add(R.M().poly([S.at(1, 0), S.at(1.5, 2.6), S.at(7, 2.2), S.at(8.5, 0)]));
  R.paint(vm, vane, { flat: true, round: 1.5 });
  R.stroke(R.curve(S.at(0, 0), S.at(4, 0), S.at(8, 0)), WOOD.sh);
  R.fill(R.M().set(...S.at(0, 0).map(Math.round)), WOOD.line);
}
backItem('quiver', 'Ranger Quiver', '#8a5a3c', (R, r, cx, v) => {
  const [P, Q] = slung(R, [[66, 70], [31, 101]], [[62, 72], [39, 101]]);
  const A = axis(P, Q), lr = ramp(r.base, 'leather'), hw = v === 'side' ? 4.5 : 5.5;
  // arrows standing out of the mouth, fanned a little
  const red = ramp('#e0475a');
  arrow(R, A, 1, 24, -2.6, -.16, WHITE); arrow(R, A, 1, 27, .2, .02, red); arrow(R, A, 1, 23, 2.8, .18, WHITE);
  // leather body with a rounded base cap
  const body = band(R, A, 2, A.L - 2, hw).add(R.M().ellipse(...A.at(A.L - 3), hw, hw));
  R.paint(body, lr, { flat: true, round: 4.5 });
  R.stitch(R.curve(A.at(5, -hw + 2), A.at(A.L / 2, -hw + 2), A.at(A.L - 6, -hw + 2)), lr.hi, body, 1, 1);
  R.stitch(R.curve(A.at(5, hw - 2), A.at(A.L / 2, hw - 2), A.at(A.L - 6, hw - 2)), lr.dp, body, 1, 1);
  // gold bands at the mouth and near the base, a darker base cap
  const cap = body.clone().keep((x, y) => A.u(x, y) > A.L - 6);
  R.paint(cap, ramp(lr.sh, 'leather'), { flat: true, round: 2 });
  for (const [t0, t1] of [[0, 3.5], [A.L - 9, A.L - 6.5]]) {
    const b = band(R, A, t0, t1, hw + .8);
    castOn(R, b, (x, y) => body.has(x, y), A.ux > 0 ? 1 : -1, 1);
    R.paint(b, GOLDM, { flat: true, round: 1.5 });
  }
  // tooled diamond emblem with a gem
  const mid = A.at(A.L * .45, 0).map(Math.round);
  const dia = R.M().poly([[mid[0], mid[1] - 4], [mid[0] + 3, mid[1]], [mid[0], mid[1] + 4], [mid[0] - 3, mid[1]]]);
  R.paint(dia, GOLDM, { flat: true, round: 1.5 });
  R.gem(mid[0], mid[1], 1.5, ramp('#4fb7d8', 'gem'));
  if (v === 'back') castOn(R, body, onBody(R, body), 1, 2);
}, {
  over: (R, r, cx, v) => {
    const lr = ramp(mix(r.base, [30, 20, 26], .3), 'leather');
    const st = v === 'side'
      ? strapPath(R, [[[46, 71], [36, 64], [27, 71]], [[27, 71], [22, 82], [25, 95]]], 4)
      : lockF(R, [cx + 13, 66], [cx, 80], [cx - 15, 96], 4.5, 4.5);
    castOn(R, st, onBody(R, st), 1, 1);
    R.paint(st, lr, { flat: true, round: 2 });
    const [bx, by] = v === 'side' ? [22, 80] : [cx - 1, 80];
    const bk = R.M().rect(bx - 2, by - 2, bx + 2, by + 2);
    R.paint(bk, GOLDM, { flat: true, round: 1.5 });
    R.fill(R.M().rect(bx - 1, by - 1, bx + 1, by + 1), lr.dp); R.fill(R.M().rect(bx, by - 1, bx, by + 1), GOLDM.sh);
    if (v !== 'side') R.stitch(R.curve([cx + 11, 69], [cx - 1, 81], [cx - 13, 93]), lr.lt, st, 1, 1);
  },
});

// ---------- Sheathed Katana (new) ----------
const SAGEO = ramp('#5a4a8a');
backItem('katanaback', 'Sheathed Katana', '#8c2a3a', (R, r, cx, v) => {
  const [P, K] = slung(R, [[85, 54], [12, 113]], [[80, 50], [37, 116]]);
  const A = axis(P, K), T = 17, lac = ramp(r.base, 'metal');
  // scabbard: lacquered, gently curved, with a gold end cap
  const bow = A.at(A.L * .6, A.ux > 0 ? -2 : 2);
  const sc = lockF(R, A.at(T + 2), bow, A.at(A.L), 6, 5.4);
  R.paint(sc, lac, { flat: true, round: 3, shiny: true });
  const sheen = R.M(); R.curve(A.at(T + 6, -1.6), [bow[0] - A.uy * -1.6, bow[1] + A.ux * -1.6], A.at(A.L - 6, -1.4)).forEach(([x, y]) => sheen.set(x, y));
  R.fill(sheen.and(erode(sc)), lac.hi);
  const kj = sc.clone().keep((x, y) => A.u(x, y) > A.L - 5);
  R.paint(kj, GOLDM, { flat: true, round: 2 });
  // sageo cord wrapped round the scabbard near the mouth, kurikata knob
  for (const t of [T + 7, T + 10]) R.paint(band(R, A, t, t + 1.6, 3.6), SAGEO, { flat: true, round: 1 });
  R.paint(R.M().ellipse(...A.at(T + 8.6, -3.4), 1.6, 1.6), lac, { flat: true, round: 1 });
  R.paint(band(R, A, T + 2, T + 4, 3.4), GOLDM, { flat: true, round: 1.5 }); // koiguchi
  // tsuba: a gold-rimmed iron guard across the blade
  const tsuba = R.M().poly([A.at(T - 1.2, -5), A.at(T + 1.4, -5), A.at(T + 1.4, 5), A.at(T - 1.2, 5)]);
  R.paint(tsuba, GOLDM, { flat: true, round: 1.5 });
  // hilt: diamond ito wrap over white same, gold fuchi and kashira, a menuki ornament
  const hilt = band(R, A, 1, T - 1, 2.6);
  R.paint(hilt, BLACK, {
    flat: true, round: 2,
    pattern: (x, y) => { const u = A.u(x, y), w = A.w(x, y); return Math.abs(((u % 3.6) + 3.6) % 3.6 - 1.8) + Math.abs(w) * .85 < 1.15 ? CREAM : null; },
  });
  R.paint(band(R, A, T - 3, T - 1, 2.8), GOLDM, { flat: true, round: 1 });
  R.paint(band(R, A, -.6, 2, 2.9), GOLDM, { flat: true, round: 1.5 });
  R.gem(...A.at(T * .5, 0).map(Math.round), 1, GOLDM);
  if (v === 'back') castOn(R, sc.clone().add(hilt), onBody(R, sc), 1, 2);
}, {
  over: (R, r, cx, v) => { // the sageo cord slung across the chest
    const st = v === 'side'
      ? strapPath(R, [[[46, 70], [36, 64], [27, 71]], [[27, 71], [22, 82], [25, 95]]], 3)
      : lockF(R, [cx + 13, 66], [cx, 80], [cx - 15, 96], 3.4, 3.4);
    castOn(R, st, onBody(R, st), 1, 1);
    R.paint(st, SAGEO, { flat: true, round: 1.5, pattern: (x, y) => (x + y) % 4 === 0 ? ramp(SAGEO.lt) : null });
  },
});

// ---------- Fox Tail ----------
backItem('foxtail', 'Fox Tail', '#f08a3c', (R, r, cx, v) => {
  const sp = v === 'side' ? [[48, 97], [70, 126], [90, 88]] : [[cx + 2, 96], [cx + 28, 130], [cx + 46, 92]];
  const S = v === 'front' ? sp.map(([x, y]) => [2 * cx - x, y]) : sp;
  const at = t => { const s = 1 - t; return [s * s * S[0][0] + 2 * s * t * S[1][0] + t * t * S[2][0], s * s * S[0][1] + 2 * s * t * S[1][1] + t * t * S[2][1]]; };
  const tan = t => { const a = at(Math.max(0, t - .02)), b = at(Math.min(1, t + .02)), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const hw = t => 3 + 10.5 * Math.sin(Math.PI * Math.min(.94, Math.pow(t, 1.15)));
  const off = (t, o, along = 0) => { const p = at(t), d = tan(t); return [p[0] + d[0] * along - d[1] * o, p[1] + d[1] * along + d[0] * o]; };
  const samples = []; for (let t = 0; t <= 1.0001; t += .025) samples.push([t, ...at(t)]);
  const mass = R.M();
  for (const [t, x, y] of samples) discF(R, mass, x, y, hw(t));
  // spine parameter of the nearest sample, and signed offset, for the cream tip boundary
  const tipS = samples.filter(([t]) => t >= .55), [mx0, my0] = at(.87);
  const tOf = (x, y) => { let best = 1e9, bt = 0; for (const [t, sx, sy] of tipS) { const d = (x - sx) ** 2 + (y - sy) ** 2; if (d < best) { best = d; bt = t; } } return bt; };
  const tipAt = (x, y) => (x - mx0) ** 2 + (y - my0) ** 2 < 700 && tOf(x, y) > .74 + .035 * Math.sin((x + y) * .9);
  const cream = (x, y) => (tipAt(x, y) ? CREAM : null);
  // swept tufts (sawtooth teeth) and notches along both edges, one clean silhouette
  const teeth = R.M(), notch = R.M(), strokes = [];
  let n = 0;
  for (let t = .2; t < .92; t += .12, n++) for (const sd of [-1, 1]) {
    const tt = t + (sd > 0 ? .055 : 0), h0 = hw(tt), h1 = hw(tt + .09);
    const apex = off(tt + .09, sd * (h1 + 2.2), 1);
    teeth.add(R.M().poly([off(tt - .02, sd * (h0 - 3)), off(tt + .04, sd * (h0 + .5)), apex, off(tt + .07, sd * (h1 - 3))]));
    notch.add(R.M().poly([apex, off(tt + .1, sd * (h1 - 1.6)), off(tt + .13, sd * (hw(tt + .13) + .8))]));
    strokes.push([off(tt + .1, sd * (h1 - 1.5)), off(tt + .06, sd * (h1 - 3)), off(tt + .01, sd * (h0 - 4.5))]);
  }
  const shape = mass.clone().add(teeth).add(R.M().poly([off(.86, -hw(.86) * .8), off(1, 0, 8), off(.86, hw(.86) * .8)])).sub(notch);
  R.paint(shape, r, { flat: true, round: 9, pattern: cream });
  const inner = erode(shape, 1);
  for (const [p0, p1, p2] of strokes) {
    const cr = tipAt(...p0.map(Math.round)) ? CREAM : r;
    creaseF(R, p0, p1, p2, cr, inner, 4, 2);
  }
  creaseF(R, off(.08, -.2 * hw(.08)), off(.3, -.15 * hw(.3)), off(.5, -.25 * hw(.5)), r, inner, 4, 2);
  if (v === 'back') castOn(R, shape, onBody(R, shape), 1, 2);
});
})();
