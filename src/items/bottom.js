// Pixie Closet wardrobe: bottom. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- BOTTOMS ----------------
item('bottom', 'jeans', 'Classic Jeans', '#4d74b8', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(pantsMask(R, V.footY - 1), r, { lines: true });
  waistBand(R, V.waistY, 2, ramp(r[2]));
  if (isFront(R)) R.fill(R.M().rect(V.cx, V.waistY, V.cx, V.waistY + 1), '#f2c14e');
});
item('bottom', 'shorts', 'Play Shorts', '#f5d04a', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(pantsMask(R, V.crotchY + 6), r, { lines: true });
  waistBand(R, V.waistY, 2, ramp(r[2]));
});
item('bottom', 'joggers', 'Joggers', '#8b8fa3', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(pantsMask(R, V.footY - 1), r, { lines: true });
  R.paint(R.body((x, y, p) => (p === 'leg' || p === 'foot') && y >= V.footY - 3 && y < V.footY), ramp(r[2]), { lines: true });
  R.paint(R.body((x, y, p) => p === 'leg' && (x === V.torsoL + 1 || x === V.torsoR - 2) && y < V.footY - 3), WHITE, { noOutline: true });
});
item('bottom', 'cargo', 'Cargo Shorts', '#a8946a', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(pantsMask(R, V.kneeY), r, { lines: true });
  if (!isSide(R)) R.paint(R.M().rect(V.torsoL + 1, 101, V.torsoL + 6, 106).rect(V.torsoR - 7, 101, V.torsoR - 2, 106), ramp(r[2]));
  else R.paint(R.M().rect(30, 101, 37, 107), ramp(r[2]));
});
item('bottom', 'pleated', 'Pleated Skirt', '#e0475a', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(skirtMask(R, V.waistY, V.crotchY + 8, 6), r, { flat: true, pattern: (x) => (x - V.cx) % 4 === 0, alt: ramp(r[2]) });
  waistBand(R, V.waistY, 2, ramp(r[2]));
});
item('bottom', 'plaid', 'Plaid Skirt', '#2c6b4f', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(skirtMask(R, V.waistY, V.crotchY + 7, 5), r, { flat: true, pattern: plaid, alt: ramp(mix(r[1], [240, 200, 80], .55)) });
});
item('bottom', 'tutu', 'Ballet Tutu', '#f7a8c4', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(skirtMask(R, V.waistY, V.crotchY + 4, 12, 3, 5), r, { flat: true, pattern: dots, alt: WHITE });
  R.paint(R.body((x, y, p) => p === 'torso' && y >= V.waistY - 4 && y < V.waistY), r, { lines: true });
});
item('bottom', 'overalls', 'Overalls', '#6b8fd0', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V, c = V.cx;
  R.paint(pantsMask(R, V.footY - 2), r, { lines: true });
  if (isFront(R)) {
    R.paint(R.M().rect(c - 8, 79, c + 8, V.waistY + 1).and(R.body(() => true)), r, { lines: true });
    R.paint(R.M().line(c - 7, 79, c - 11, 68, 2).line(c + 7, 79, c + 11, 68, 2), ramp(r[2]));
    R.fill(R.M().rect(c - 7, 81, c - 6, 82).rect(c + 6, 81, c + 7, 82), '#f2c14e');
    R.paint(R.M().rect(c - 4, 84, c + 4, 89), ramp(r[2]));
  } else if (isBack(R)) {
    R.paint(R.M().line(c - 10, 68, c + 6, V.waistY, 2).line(c + 10, 68, c - 6, V.waistY, 2), ramp(r[2]));
  } else R.paint(R.M().line(26, 70, 24, V.waistY, 2), ramp(r[2]));
});
item('bottom', 'maxi', 'Long Skirt', '#b9a0ef', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(skirtMask(R, V.waistY, V.footY + 2, 9), r, { flat: true, pattern: (x, y) => y > V.footY - 4, alt: ramp(r[2]) });
  waistBand(R, V.waistY, 2, ramp(r[2]));
});
item('bottom', 'bloomer', 'Pumpkin Shorts', '#f08a3c', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  const m = pantsMask(R, V.crotchY + 5).add(skirtMask(R, V.waistY + 2, V.crotchY + 5, 4, 2, 6));
  R.paint(m, r, { flat: true, pattern: (x) => (x - V.cx) % 5 === 0, alt: ramp(r[2]) });
});
})();
