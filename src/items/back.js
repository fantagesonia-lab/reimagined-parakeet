// Pixie Closet wardrobe: back. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- BACK ----------------
function backItem(id, name, dye, fn) {
  return item('back', id, name, dye, (R, ph, r) => {
    const over = R.view === 'back';
    if ((ph === 'front') === over) fn(R, r, R.V.cx, R.view, ph);
  });
}
function wingShape(R, cx, v, pts) {
  const m = R.M();
  if (v === 'side') return m.poly(pts.map(([x, y]) => [52 - (x - cx) * 0.75, y - 4]));
  return m.poly(pts).mirror();
}
backItem('angel', 'Angel Wings', '#f7f3f8', (R, r, cx, v) => {
  const pts = [[cx - 10, 76], [cx - 22, 62], [cx - 38, 54], [cx - 52, 56], [cx - 56, 66], [cx - 52, 74], [cx - 54, 82], [cx - 48, 88], [cx - 48, 96], [cx - 38, 98], [cx - 30, 102], [cx - 22, 94], [cx - 12, 88]];
  const m = wingShape(R, cx, v, pts);
  R.paint(m, r, { flat: true, pattern: (x, y) => (y - 60) % 9 === 0 && Math.abs(x - cx) > 26, alt: ramp(r[2]) });
});
backItem('bat', 'Bat Wings', '#4a2e5c', (R, r, cx, v) => {
  const pts = [[cx - 10, 78], [cx - 30, 56], [cx - 56, 50], [cx - 52, 66], [cx - 58, 78], [cx - 48, 80], [cx - 50, 92], [cx - 40, 88], [cx - 36, 98], [cx - 26, 90], [cx - 14, 92]];
  R.paint(wingShape(R, cx, v, pts), r, { flat: true });
});
backItem('fairywings', 'Fairy Wings', '#a8dcf5', (R, r, cx, v) => {
  const m = v === 'side' ? R.M().ellipse(60, 62, 10, 16).ellipse(58, 92, 7, 10) : R.M().ellipse(cx - 30, 64, 16, 11).ellipse(cx - 24, 90, 10, 8).mirror();
  R.paint(m, r, { flat: true, alpha: 225, pattern: (x, y) => (x + y) % 7 === 0, alt: WHITE });
});
backItem('cape', 'Hero Cape', '#c8364a', (R, r, cx, v) => {
  if (v === 'side') { R.paint(R.M().poly([[38, 68], [50, 68], [64, 120], [44, 122]]), r, { flat: true }); return; }
  if (v === 'back') { R.paint(R.M().poly([[cx - 18, 67], [cx + 18, 67], [cx + 30, 122], [cx - 30, 122]]).keep((x, y) => y < 122 - tri(x, 10, 3)), r, { flat: true, pattern: (x) => (x - cx) % 10 === 0, alt: ramp(r[2]) }); return; }
  R.paint(R.M().poly([[cx - 22, 68], [cx + 22, 68], [cx + 32, 122], [cx - 32, 122]]), ramp(r[2]), { flat: true });
});
backItem('backpack', 'Backpack', '#f08a3c', (R, r, cx, v) => {
  if (v === 'side') { R.paint(R.M().poly([[46, 74], [58, 74], [60, 100], [48, 100]]), r, { flat: true }); return; }
  if (v === 'back') {
    R.paint(R.M().rect(cx - 14, 72, cx + 14, 100), r, { flat: true });
    R.paint(R.M().rect(cx - 14, 72, cx + 14, 80), ramp(r[2]), { flat: true });
    R.paint(R.M().rect(cx - 8, 88, cx + 8, 97), ramp(r[2]), { flat: true });
    R.fill(R.M().rect(cx - 1, 80, cx + 1, 82), '#f2c14e');
  }
});
backItem('quiver', 'Ranger Quiver', '#8a5a3c', (R, r, cx, v) => {
  const m = v === 'side' ? R.M().poly([[50, 66], [56, 64], [62, 100], [56, 102]]) : R.M().poly([[cx + 6, 66], [cx + 14, 62], [cx + 4, 100], [cx - 4, 98]]);
  const f = v === 'side' ? R.M().poly([[50, 66], [56, 64], [56, 56], [48, 58]]) : R.M().poly([[cx + 6, 66], [cx + 14, 62], [cx + 16, 54], [cx + 6, 56]]);
  R.paint(f, WHITE, { flat: true }); R.paint(m, r, { flat: true });
});
backItem('foxtail', 'Fox Tail', '#f08a3c', (R, r, cx, v) => {
  const m = v === 'side' ? R.M().poly([[46, 98], [60, 86], [74, 70], [76, 84], [64, 104], [50, 106]]) : R.M().poly([[cx - 4, 98], [cx + 14, 92], [cx + 28, 76], [cx + 30, 92], [cx + 18, 108], [cx, 106]]);
  R.paint(m, r, { flat: true });
  const tip = m.clone().keep((x, y) => v === 'side' ? x > 68 : y < 86);
  R.paint(tip, WHITE, { flat: true });
});
})();
