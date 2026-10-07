// Pixie Closet wardrobe: hat. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- HATS ----------------
function hat(id, name, dye, fn) { return item('hat', id, name, dye, (R, ph, r, hex) => ph === 'front' ? fn(R, r, R.V.headCx, R.view) : (fn.behind && fn.behind(R, r, R.V.headCx, R.view))); }
const dome = (R, cx, top, rx, ry, cut) => R.M().ellipse(cx, top + ry, rx, ry).keep((x, y) => y <= cut);
hat('beanie', 'Knit Beanie', '#e0475a', (R, r, cx) => {
  R.paint(dome(R, cx, -4, 37, 24, 16), r, { flat: true, pattern: (x) => x % 4 === 0, alt: ramp(r[2]) });
  R.paint(R.M().rect(cx - 37, 12, cx + 37, 18).and(R.M().ellipse(cx, 24, 38, 30)), ramp(r[2]), { flat: true, pattern: x => x % 2 === 0, alt: ramp(r[3]) });
  R.paint(R.M().ellipse(cx, -6, 6, 5), WHITE, { flat: true });
});
hat('witchhat', 'Witch Hat', '#5b3d8f', (R, r, cx, v) => {
  const s = v === 'back' ? -1 : 1;
  R.paint(R.M().poly([[cx - 22, 4], [cx + 22, 4], [cx + 6 * s, -26], [cx + 22 * s, -38], [cx - 2 * s, -30]]), r, { flat: true });
  R.paint(R.M().rect(cx - 21, -2, cx + 21, 3).and(R.M().poly([[cx - 22, 4], [cx + 22, 4], [cx + 15, -14], [cx - 15, -14]])), GOLD, { flat: true });
  R.paint(R.M().ellipse(cx, 5, 46, 5), r, { flat: true });
});
hat('crown', 'Royal Crown', '#f2c14e', (R, r, cx) => {
  const m = R.M().rect(cx - 15, -6, cx + 15, 3);
  for (const dx of [-15, -5, 5, 15]) m.poly([[cx + dx - 5, -5], [cx + dx + 5, -5], [cx + dx, -16]]);
  m.keep((x) => x >= cx - 15 && x <= cx + 15);
  R.paint(m, r, { flat: true });
  R.paint(R.M().ellipse(cx, -1, 2, 2), RED, { flat: true });
  R.paint(R.M().ellipse(cx - 9, -1, 1, 1).ellipse(cx + 9, -1, 1, 1), ramp('#8cc8f2'), { flat: true });
});
hat('catears', 'Cat Ears', '#34303d', (R, r, cx, v) => {
  const m = R.M(), inn = R.M();
  if (v === 'side') { m.poly([[cx - 6, 8], [cx + 10, 6], [cx, -10]]); m.poly([[cx + 10, 8], [cx + 24, 8], [cx + 18, -8]]); inn.poly([[cx - 2, 6], [cx + 6, 5], [cx, -4]]); }
  else { m.poly([[cx - 32, 12], [cx - 14, 2], [cx - 30, -12]]).mirror(); inn.poly([[cx - 28, 8], [cx - 18, 3], [cx - 28, -6]]).mirror(); }
  R.paint(m, r, { flat: true });
  if (v !== 'back') R.paint(inn, PINK, { flat: true, noOutline: true });
});
hat('bunny', 'Bunny Ears', '#f7f3f8', (R, r, cx, v) => {
  const m = R.M(), inn = R.M();
  if (v === 'side') { m.ellipse(cx + 4, -14, 5, 17).ellipse(cx + 14, -10, 5, 16); inn.ellipse(cx + 4, -14, 2, 12); }
  else { m.ellipse(cx - 12, -16, 6, 18).mirror(); inn.ellipse(cx - 12, -16, 3, 13).mirror(); }
  R.paint(m, r, { flat: true });
  if (v !== 'back') R.paint(inn, PINK, { flat: true, noOutline: true });
});
hat('cap', 'Ball Cap', '#3f6fd8', (R, r, cx, v) => {
  R.paint(dome(R, cx, -4, 36, 22, 14), r, { flat: true });
  if (v === 'side') R.paint(R.M().poly([[cx - 20, 10], [cx - 44, 12], [cx - 46, 16], [cx - 20, 16]]), ramp(r[2]), { flat: true });
  else if (v === 'front') R.paint(R.M().ellipse(cx, 15, 30, 4).keep((x, y) => y >= 13), ramp(r[2]), { flat: true });
  else R.fill(R.M().ellipse(cx, 12, 5, 2), r[3]);
  R.paint(R.M().ellipse(cx, -4, 3, 2), ramp(r[2]), { flat: true });
});
hat('tophat', 'Top Hat', '#34303d', (R, r, cx) => {
  R.paint(R.M().rect(cx - 17, -28, cx + 17, 2), r, { flat: true });
  R.paint(R.M().rect(cx - 17, -6, cx + 17, -1), RED, { flat: true });
  R.paint(R.M().ellipse(cx, 3, 30, 4), r, { flat: true });
});
hat('flowers', 'Flower Crown', '#f7a8c4', (R, r, cx, v) => {
  const span = v === 'side' ? [cx - 22, cx + 30] : [cx - 32, cx + 32];
  const leaves = R.M(), cols = [r, ramp('#fff3a6'), WHITE];
  for (let x = span[0]; x <= span[1]; x += 5) leaves.ellipse(x, 6 + Math.pow((x - cx) / 32, 2) * 8, 2, 1);
  R.paint(leaves, GREEN, { flat: true });
  let k = 0;
  for (let x = span[0] + 2; x <= span[1]; x += 9, k++) {
    const y = 4 + Math.pow((x - cx) / 32, 2) * 8;
    R.paint(R.M().ellipse(x, y, 3, 3), cols[k % 3], { flat: true });
    R.fill(R.M().set(x, y), '#f2a33a');
  }
});
hat('halo', 'Angel Halo', '#f2c14e', (R, r, cx) => {
  R.paint(R.M().ellipse(cx, -12, 22, 5).sub(R.M().ellipse(cx, -12, 17, 2)), r, { flat: true });
});
hat('horns', 'Devil Horns', '#c8364a', (R, r, cx, v) => {
  const m = R.M();
  if (v === 'side') m.poly([[cx - 6, 6], [cx + 4, 6], [cx - 8, -10]]);
  else m.poly([[cx - 24, 8], [cx - 14, 4], [cx - 30, -10]]).mirror();
  R.paint(m, r, { flat: true });
});
hat('bow', 'Big Bow', '#e0475a', (R, r, cx, v) => {
  const bx = v === 'side' ? cx + 8 : v === 'back' ? cx - 20 : cx + 20, by = 2;
  R.paint(R.M().poly([[bx, by], [bx - 13, by - 9], [bx - 13, by + 7]]).poly([[bx, by], [bx + 13, by - 9], [bx + 13, by + 7]]), r, { flat: true });
  R.paint(R.M().poly([[bx - 2, by + 2], [bx - 6, by + 14], [bx - 2, by + 12]]).poly([[bx + 2, by + 2], [bx + 6, by + 14], [bx + 2, by + 12]]), ramp(r[2]), { flat: true });
  R.paint(R.M().ellipse(bx, by, 3, 3), ramp(r[2]), { flat: true });
});
hat('viking', 'Viking Helm', '#c9cfdc', (R, r, cx, v) => {
  const horns = R.M();
  if (v === 'side') horns.poly([[cx - 4, 6], [cx + 6, 6], [cx - 10, -16], [cx - 6, -4]]);
  else horns.poly([[cx - 30, 10], [cx - 26, 2], [cx - 40, -12], [cx - 44, -6]]).mirror();
  R.paint(horns, ramp('#f6ead2'), { flat: true });
  R.paint(dome(R, cx, -5, 37, 22, 14), r, { flat: true, pattern: (x) => (x - cx) % 12 === 0, alt: ramp(r[2]) });
  R.paint(R.M().rect(cx - 37, 11, cx + 37, 15).and(R.M().ellipse(cx, 20, 38, 26)), GOLD, { flat: true });
});
hat('bandana', 'Rogue Bandana', '#34303d', (R, r, cx, v) => {
  R.paint(dome(R, cx, -3, 37, 22, 16), r, { flat: true, pattern: (x, y) => (x + y) % 9 === 0, alt: ramp('#8b8fa3') });
  const kx = v === 'side' ? cx + 34 : v === 'back' ? cx : cx + 34;
  if (v !== 'front' || true) R.paint(R.M().poly([[kx, 12], [kx + 10, 22], [kx + 4, 26]]).poly([[kx, 12], [kx + 4, 30], [kx - 2, 30]]), r, { flat: true });
});
hat('tricorn', 'Captain Tricorn', '#34303d', (R, r, cx) => {
  R.paint(R.M().poly([[cx - 44, 8], [cx - 28, -10], [cx, -14], [cx + 28, -10], [cx + 44, 8], [cx, 2]]), r, { flat: true });
  R.paint(R.M().poly([[cx - 44, 8], [cx, 2], [cx + 44, 8], [cx, 5]]), GOLD, { flat: true, noOutline: true });
  R.paint(R.M().ellipse(cx, -6, 3, 3), WHITE, { flat: true });
});
hat('mushroom', 'Mushroom Cap', '#f08a3c', (R, r, cx) => {
  R.paint(R.M().ellipse(cx, 8, 46, 24).keep((x, y) => y <= 12), r, { flat: true });
  R.paint(R.M().ellipse(cx - 18, -4, 5, 4).ellipse(cx + 14, -8, 6, 4).ellipse(cx + 34, 4, 4, 3).ellipse(cx - 36, 6, 3, 3), WHITE, { flat: true, noOutline: true });
});
hat('frog', 'Froggy Hat', '#5bb36a', (R, r, cx, v) => {
  const eyes = v === 'side' ? R.M().ellipse(cx - 4, -8, 8, 7) : R.M().ellipse(cx - 18, -8, 8, 7).mirror();
  R.paint(eyes, r, { flat: true });
  R.paint(dome(R, cx, -4, 37, 22, 15), r, { flat: true });
  if (v !== 'back') {
    const w = v === 'side' ? R.M().ellipse(cx - 4, -8, 4, 4) : R.M().ellipse(cx - 18, -8, 4, 4).mirror();
    R.paint(w, WHITE, { flat: true });
    R.fill(v === 'side' ? R.M().rect(cx - 6, -9, cx - 5, -7) : R.M().rect(cx - 19, -9, cx - 18, -7).mirror(), '#2b2633');
  }
});
hat('phones', 'Headphones', '#f7a8c4', (R, r, cx, v) => {
  if (v === 'side') { R.paint(R.M().line(cx - 2, -2, cx + 12, 46, 3), ramp('#8b8fa3')); R.paint(R.M().ellipse(cx + 12, 52, 7, 9), r, { flat: true }); return; }
  const band = R.M().ellipse(cx, 32, 38, 36).sub(R.M().ellipse(cx, 32, 35, 33)).keep((x, y) => y < 40);
  R.paint(band, ramp('#8b8fa3'), { flat: true });
  R.paint(R.M().ellipse(cx - 37, 48, 5, 9).mirror(), r, { flat: true });
});
})();
