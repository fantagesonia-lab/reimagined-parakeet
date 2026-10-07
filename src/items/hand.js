// Pixie Closet wardrobe: hand. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- HAND ----------------
function held(id, name, dye, fn) {
  return item('hand', id, name, dye, (R, ph, r) => {
    const behind = R.view === 'back';
    if ((ph === 'back') !== behind) return;
    const [hx, hy] = R.V.hand;
    fn(R, r, hx, hy, R.view);
  });
}
const grip = (R, m) => m.sub(R.body((x, y, p) => p === 'hand'));
held('wand', 'Star Wand', '#f7a8c4', (R, r, hx, hy) => {
  R.paint(grip(R, R.M().line(hx, hy + 6, hx + 8, hy - 22, 2)), r, { flat: true });
  const sx = hx + 9, sy = hy - 28;
  R.paint(R.M().poly([[sx, sy - 7], [sx + 2, sy - 2], [sx + 7, sy - 2], [sx + 3, sy + 1], [sx + 5, sy + 6], [sx, sy + 3], [sx - 5, sy + 6], [sx - 3, sy + 1], [sx - 7, sy - 2], [sx - 2, sy - 2]]), GOLD, { flat: true });
});
held('sword', 'Hero Sword', '#c9cfdc', (R, r, hx, hy) => {
  R.paint(R.M().poly([[hx - 2, hy - 6], [hx + 2, hy - 6], [hx + 2, hy - 36], [hx, hy - 40], [hx - 2, hy - 36]]), r, { flat: true });
  R.paint(R.M().rect(hx - 7, hy - 7, hx + 7, hy - 5), GOLD, { flat: true });
  R.paint(grip(R, R.M().rect(hx - 1, hy - 4, hx + 1, hy + 6)), WOOD, { flat: true });
  R.paint(R.M().ellipse(hx, hy + 7, 2, 2), GOLD, { flat: true });
});
held('huntbow', 'Hunter Bow', '#8a5a3c', (R, r, hx, hy) => {
  const m = R.M().ellipse(hx + 2, hy, 12, 26).sub(R.M().ellipse(hx + 2, hy, 10, 24)).keep((x) => x >= hx + 2);
  R.paint(grip(R, m), r, { flat: true });
  R.fill(R.M().line(hx + 3, hy - 25, hx + 3, hy + 25), [240, 236, 230]);
});
held('staff', 'Sage Staff', '#9a6a43', (R, r, hx, hy, v) => {
  R.paint(grip(R, R.M().rect(hx - 1, hy - 40, hx + 1, hy + 24)), r, { flat: true });
  R.paint(R.M().ellipse(hx, hy - 44, 5, 5), ramp('#7fd8f0'), { flat: true });
  R.paint(R.M().poly([[hx - 6, hy - 40], [hx - 3, hy - 50], [hx - 2, hy - 40]]).poly([[hx + 6, hy - 40], [hx + 3, hy - 50], [hx + 2, hy - 40]]), GOLD, { flat: true });
});
held('dagger', 'Shadow Dagger', '#8b8fa3', (R, r, hx, hy) => {
  R.paint(R.M().poly([[hx + 1, hy - 4], [hx + 4, hy - 4], [hx + 14, hy - 16], [hx + 10, hy - 14]]), r, { flat: true });
  R.paint(grip(R, R.M().line(hx - 2, hy + 3, hx + 3, hy - 3, 2)), BLACK, { flat: true });
});
held('cutlass', 'Cutlass', '#c9cfdc', (R, r, hx, hy) => {
  R.paint(R.M().poly([[hx - 1, hy - 6], [hx + 3, hy - 6], [hx + 8, hy - 22], [hx + 6, hy - 34], [hx + 2, hy - 24]]), r, { flat: true });
  R.paint(R.M().ellipse(hx + 1, hy - 4, 6, 3).sub(R.M().ellipse(hx + 1, hy - 4, 4, 1)), GOLD, { flat: true });
});
held('balloon', 'Heart Balloon', '#e0475a', (R, r, hx, hy) => {
  R.fill(R.M().line(hx + 1, hy - 4, hx + 6, hy - 36), [90, 70, 70]);
  const bx = hx + 6, by = hy - 48;
  R.paint(R.M().ellipse(bx - 5, by - 3, 6, 6).ellipse(bx + 5, by - 3, 6, 6).poly([[bx - 11, by - 1], [bx + 11, by - 1], [bx, by + 12]]), r, { flat: true });
});
held('bouquet', 'Bouquet', '#f7a8c4', (R, r, hx, hy) => {
  R.paint(grip(R, R.M().poly([[hx - 2, hy - 6], [hx + 4, hy - 6], [hx + 2, hy + 10], [hx, hy + 10]])), GREEN, { flat: true });
  const cols = [r, ramp('#fff3a6'), WHITE, r, ramp('#b9a0ef')];
  [[-5, -12], [3, -14], [-1, -18], [6, -9], [-7, -6]].forEach(([dx, dy], k) => R.paint(R.M().ellipse(hx + dx, hy + dy, 3, 3), cols[k], { flat: true }));
});
held('icecream', 'Ice Cream', '#f7a8c4', (R, r, hx, hy) => {
  R.paint(grip(R, R.M().poly([[hx - 4, hy - 8], [hx + 5, hy - 8], [hx + .5, hy + 6]])), ramp('#e3a35b'), { flat: true, pattern: (x, y) => (x + y) % 3 === 0, alt: ramp('#c47f3a') });
  R.paint(R.M().ellipse(hx, hy - 11, 5, 4), r, { flat: true });
  R.paint(R.M().ellipse(hx, hy - 17, 4, 3), ramp('#fff3d6'), { flat: true });
  R.fill(R.M().ellipse(hx, hy - 21, 1, 1), '#e0475a');
});
held('plush', 'Teddy Plush', '#c98d65', (R, r, hx, hy) => {
  const bx = hx + 4, by = hy - 2;
  R.paint(R.M().ellipse(bx - 5, by - 12, 3, 3).ellipse(bx + 5, by - 12, 3, 3), r, { flat: true });
  R.paint(R.M().ellipse(bx, by - 7, 7, 6), r, { flat: true });
  R.paint(R.M().ellipse(bx, by + 4, 6, 6), r, { flat: true });
  R.fill(R.M().set(bx - 3, by - 8).set(bx + 3, by - 8).set(bx, by - 5), '#2b2633');
  R.paint(R.M().ellipse(bx, by + 5, 3, 3), ramp(r[0]), { flat: true, noOutline: true });
});
held('leafshield', 'Maple Shield', '#f08a3c', (R, r, hx, hy) => {
  const c = hx + 2, y = hy - 4, s = 2.2;
  const pts = [[0, -5], [2, -1], [6, -2], [4, 2], [6, 5], [1, 4], [0, 7], [-1, 4], [-6, 5], [-4, 2], [-6, -2], [-2, -1]].map(([x, yy]) => [c + x * s, y + yy * s]);
  R.paint(R.M().poly(pts), r, { flat: true });
  R.fill(R.M().line(c, y - 6, c, y + 14), r[3]);
});
})();
