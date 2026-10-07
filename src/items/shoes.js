// Pixie Closet wardrobe: shoes. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- SHOES ----------------
item('shoes', 'sneakers', 'Sneakers', '#e0475a', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(feetMask(R), r, { lines: true });
  R.paint(feetMask(R).keep((x, y) => y >= V.h - 3), WHITE, { lines: true });
  if (isFront(R)) R.fill(R.M().rect(V.cx - 13, V.footY + 3, V.cx - 9, V.footY + 3).rect(V.cx + 9, V.footY + 3, V.cx + 13, V.footY + 3), '#f7f3f8');
});
item('shoes', 'boots', 'Adventure Boots', '#8a5a3c', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(feetMask(R, V.kneeY), r, { lines: true });
  R.paint(feetMask(R, V.kneeY).keep((x, y) => y <= V.kneeY + 3), ramp(r[2]), { lines: true });
  R.paint(feetMask(R).keep((x, y) => y >= V.h - 2), BLACK, { lines: true });
});
item('shoes', 'mary', 'Mary Janes', '#34303d', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(feetMask(R, V.footY + 3), r, { lines: true });
  R.fill(R.body((x, y, p) => p === 'foot' && y === V.footY + 1).sub(R.body((x, y) => R.bodyIdx(x, y) <= 1)), r[3]);
  R.paint(R.body(() => true).keep((x, y) => (R.part(x, y) === 'leg' || R.part(x, y) === 'foot') && y >= V.kneeY && y < V.footY + 2), WHITE, { lines: true });
});
item('shoes', 'sandals', 'Beach Sandals', '#f08a3c', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(feetMask(R).keep((x, y) => y >= V.h - 2), r, { lines: true });
  R.fill(R.body((x, y, p) => p === 'foot' && (y === V.footY + 3 || y === V.footY + 4)), r[2]);
});
item('shoes', 'bunnyslip', 'Bunny Slippers', '#f7f3f8', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(feetMask(R, V.footY, 2), r, { lines: true });
  if (isSide(R)) R.paint(R.M().ellipse(30, V.footY - 1, 2, 4), r);
  else R.paint(R.M().ellipse(V.cx - 13, V.footY - 1, 2, 4).ellipse(V.cx - 8, V.footY - 1, 2, 4).mirror(), r);
  if (isFront(R)) R.fill(R.M().rect(V.cx - 12, V.footY + 5, V.cx - 11, V.footY + 5).mirror(), '#34303d');
});
item('shoes', 'rain', 'Rain Boots', '#f5d04a', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(feetMask(R, V.kneeY + 2), r, { lines: true });
});
item('shoes', 'stockings', 'Striped Stockings', '#e0475a', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(R.body((x, y, p) => (p === 'leg' || p === 'foot') && y >= V.crotchY + 2), r, { lines: true, pattern: stripes(4, 2), alt: WHITE });
  R.paint(feetMask(R, V.footY + 2), BLACK, { lines: true });
});
item('shoes', 'knight', 'Iron Greaves', '#c9cfdc', (R, ph, r) => {
  if (ph !== 'front') return; const V = R.V;
  R.paint(feetMask(R, V.kneeY - 2), r, { lines: true, pattern: (x, y) => y % 5 === 0, alt: ramp(r[2]) });
});
})();
