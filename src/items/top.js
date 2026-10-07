// Pixie Closet wardrobe: top. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- TOPS ----------------
function simpleTop(id, name, dye, cfg, deco, extra = {}) {
  return item('top', id, name, dye, (R, ph, r, hex) => {
    if (cfg.behind && ph === 'back') return cfg.behind(R, r);
    if (ph !== 'front') return;
    const m = shirtMask(R, cfg);
    R.paint(m, r, { lines: true, pattern: cfg.pattern, alt: cfg.alt ? cfg.alt(r) : WHITE });
    deco && deco(R, r, m, hex);
  }, extra);
}
simpleTop('tee', 'Comfy Tee', '#8cc8f2', { sleeve: 'short' }, (R, r) => {
  if (!isFront(R)) return; const m = R.M().ellipse(R.V.cx + 6, 82, 3, 3); R.paint(m, ramp('#fff3a6'));
});
simpleTop('tank', 'Tank Top', '#f5d04a', { sleeve: 'none', neck: 'wide' });
simpleTop('stripe', 'Marine Stripe', '#3f6fd8', { sleeve: 'short', pattern: stripes(4, 2) });
simpleTop('crop', 'Crop Top', '#f7a8c4', { sleeve: 'short', hem: 84, neck: 'sweet' });
simpleTop('turtle', 'Turtleneck', '#b9a0ef', { sleeve: 'long', neck: 'high', hem: 95 });
simpleTop('sweater', 'Cozy Knit', '#f08a3c', { sleeve: 'long', hem: 98, pattern: (x, y) => x % 3 === 0 && y % 2 === 0, alt: r => [r[2], r[2], r[3], r[3]] }, (R, r) => {
  const V = R.V, m = R.body((x, y, p) => (p === 'torso' && y >= 95 && y <= 98) || (p === 'arm' && y >= V.handY - 3 && y < V.handY));
  R.paint(m, ramp(r[2]), { lines: true, pattern: x => x % 2 === 0, alt: ramp(r[3]) });
}, { layer: 'outer' });
simpleTop('hoodie', 'Hoodie', '#7a8fa8', {
  sleeve: 'long', hem: 99,
  behind: (R, r) => { if (isSide(R)) R.paint(R.M().ellipse(44, 70, 7, 6), r); },
}, (R, r) => {
  const V = R.V, [nx, ny] = V.neck;
  if (isBack(R)) R.paint(R.M().poly([[nx - 13, ny - 1], [nx + 13, ny - 1], [nx + 9, ny + 15], [nx - 9, ny + 15]]), r);
  else if (isFront(R)) {
    const hood = R.M().ellipse(nx, ny + 1, 14, 4).sub(R.M().ellipse(nx, ny + 1, 7, 2)); R.paint(hood, r);
    const s = R.M().rect(nx - 4, ny + 4, nx - 4, ny + 11).rect(nx + 4, ny + 4, nx + 4, ny + 11); R.fill(s, '#f7f3f8');
    R.paint(R.M().rect(nx - 9, 89, nx + 9, 96), ramp(r[2]));
  }
  const cuffs = R.body((x, y, p) => (p === 'torso' && y >= 97 && y <= 99) || (p === 'arm' && y >= V.handY - 3));
  R.paint(cuffs, ramp(r[2]), { lines: true });
}, { layer: 'outer' });
simpleTop('sailor', 'Sailor Blouse', '#f7f3f8', { sleeve: 'puff' }, (R) => {
  const V = R.V, [nx, ny] = V.neck, navy = ramp('#2c3a6b');
  if (isFront(R)) {
    R.paint(R.M().poly([[nx - 13, ny - 1], [nx + 13, ny - 1], [nx + 6, ny + 9], [nx, ny + 13], [nx - 6, ny + 9]]), navy);
    R.fill(R.M().line(nx - 10, ny + 1, nx - 1, ny + 10).line(nx + 10, ny + 1, nx + 1, ny + 10), '#f7f3f8');
    const bow = R.M().poly([[nx - 6, ny + 9], [nx, ny + 12], [nx - 6, ny + 15]]).poly([[nx + 6, ny + 9], [nx, ny + 12], [nx + 6, ny + 15]]).ellipse(nx, ny + 12, 1, 1);
    R.paint(bow, RED);
  } else if (isBack(R)) {
    R.paint(R.M().rect(nx - 13, ny, nx + 13, ny + 11), navy);
    R.fill(R.M().rect(nx - 10, ny + 8, nx + 10, ny + 8), '#f7f3f8');
  } else R.paint(R.M().rect(nx + 4, ny, nx + 14, ny + 9), navy);
});
simpleTop('shirt', 'Button-Up', '#f7f3f8', { sleeve: 'short', neck: 'v' }, (R, r) => {
  const [nx, ny] = R.V.neck;
  if (isFront(R)) {
    R.paint(R.M().poly([[nx - 8, ny - 2], [nx - 1, ny + 2], [nx - 7, ny + 6]]).poly([[nx + 9, ny - 2], [nx + 2, ny + 2], [nx + 8, ny + 6]]), r);
    const tie = R.M().poly([[nx - 1, ny + 2], [nx + 2, ny + 2], [nx + 3, ny + 16], [nx + .5, ny + 19], [nx - 2, ny + 16]]);
    R.paint(tie, ramp('#e0475a'));
  }
});
simpleTop('jacket', 'Denim Jacket', '#4d74b8', { sleeve: 'long', hem: 98 }, (R, r) => {
  const V = R.V, [nx, ny] = V.neck;
  if (isFront(R)) {
    const inner = R.M().poly([[nx - 6, ny - 1], [nx + 7, ny - 1], [nx + 5, 98], [nx - 4, 98]]).and(R.body(() => true));
    R.paint(inner, ramp('#f7f3f8'), { lines: true, pattern: stripes(4, 1), alt: ramp('#e0475a') });
    R.paint(R.M().poly([[nx - 9, ny - 1], [nx - 5, ny - 1], [nx - 3, ny + 12]]).poly([[nx + 10, ny - 1], [nx + 6, ny - 1], [nx + 4, ny + 12]]), ramp(r[2]));
    R.paint(R.M().rect(V.cx - 13, 80, V.cx - 9, 83).rect(V.cx + 9, 80, V.cx + 13, 83), ramp(r[2]));
  }
  const cuffs = R.body((x, y, p) => p === 'arm' && y >= V.handY - 3);
  R.paint(cuffs, ramp(r[2]), { lines: true });
}, { layer: 'outer' });
simpleTop('armor', 'Knight Plate', '#c9cfdc', { sleeve: 'short', hem: 97, neck: 'high', pattern: (x, y) => y % 7 === 0, alt: r => [r[2], r[2], r[3], r[3]] }, (R, r) => {
  const V = R.V;
  if (isSide(R)) R.paint(R.M().ellipse(40, 74, 9, 6), r);
  else R.paint(R.M().ellipse(V.cx - 19, 72, 9, 6).mirror(), r);
  if (isFront(R)) { R.paint(R.M().poly([[V.cx - 4, 76], [V.cx + 5, 76], [V.cx + 5, 84], [V.cx + .5, 88], [V.cx - 4, 84]]), ramp('#e0475a')); }
  waistBand(R, 93, 3, ramp('#8a5a3c'));
}, { layer: 'outer' });
simpleTop('maple', 'Maple Tee', '#f7f3f8', { sleeve: 'short' }, (R) => {
  if (!isFront(R)) return; const c = R.V.cx, y = 80;
  const leaf = R.M().poly([[c, y - 5], [c + 2, y - 1], [c + 6, y - 2], [c + 4, y + 2], [c + 6, y + 5], [c + 1, y + 4], [c, y + 7], [c - 1, y + 4], [c - 6, y + 5], [c - 4, y + 2], [c - 6, y - 2], [c - 2, y - 1]]);
  R.paint(leaf, ramp('#f08a3c'));
});
simpleTop('tunic', 'Ranger Tunic', '#4f8f52', { sleeve: 'long', hem: 100, neck: 'v' }, (R, r) => {
  waistBand(R, 91, 3, ramp('#8a5a3c'));
  if (isFront(R)) R.fill(R.M().rect(R.V.cx - 1, 91, R.V.cx + 1, 93), '#f2c14e');
}, { layer: 'outer' });
})();
