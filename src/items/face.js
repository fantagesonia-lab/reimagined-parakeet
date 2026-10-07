// Pixie Closet wardrobe: face. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- FACE ----------------
function face(id, name, dye, fn) { return item('face', id, name, dye, (R, ph, r) => { if (ph === 'front' && R.view !== 'back') fn(R, r, R.V.eyes, R.view); }); }
face('roundglass', 'Round Glasses', '#8a5a3c', (R, r, eyes, v) => {
  const m = R.M();
  for (const [x, y] of eyes) m.ellipse(x, y, 9, 9).sub(R.M().ellipse(x, y, 7, 7));
  if (v === 'front') m.rect(eyes[0][0] + 9, eyes[0][1] - 2, eyes[1][0] - 9, eyes[0][1] - 1);
  else m.line(eyes[0][0] + 9, eyes[0][1] - 2, 44, 50, 1);
  R.fill(m, r[3]);
  for (const [x, y] of eyes) R.fill(R.M().ellipse(x, y, 7, 7), [220, 240, 255], 50);
});
face('shades', 'Cool Shades', '#2b2633', (R, r, eyes, v) => {
  const m = R.M();
  for (const [x, y] of eyes) m.poly([[x - 10, y - 6], [x + 10, y - 6], [x + 8, y + 5], [x - 8, y + 5]]);
  if (v === 'front') m.rect(eyes[0][0] + 9, eyes[0][1] - 6, eyes[1][0] - 9, eyes[0][1] - 4);
  else m.line(eyes[0][0] + 9, eyes[0][1] - 5, 44, 50, 1);
  R.paint(m, r, { flat: true });
  const s = R.M(); for (const [x, y] of eyes) s.line(x - 6, y - 3, x - 3, y - 3).line(x - 7, y - 1, x - 6, y - 1);
  R.fill(s, [255, 255, 255], 170);
});
face('hearts', 'Heart Shades', '#f05a8e', (R, r, eyes, v) => {
  const m = R.M();
  for (const [x, y] of eyes) m.ellipse(x - 4, y - 3, 5, 4).ellipse(x + 4, y - 3, 5, 4).poly([[x - 9, y - 2], [x + 9, y - 2], [x, y + 8]]);
  if (v === 'front') m.rect(eyes[0][0] + 9, eyes[0][1] - 4, eyes[1][0] - 9, eyes[0][1] - 3);
  else m.line(eyes[0][0] + 9, eyes[0][1] - 3, 44, 50, 1);
  R.paint(m, r, { flat: true });
});
face('patch', 'Eye Patch', '#2b2633', (R, r, eyes, v) => {
  const [x, y] = v === 'front' ? eyes[1] : eyes[0];
  const strap = v === 'front' ? R.M().line(x - 26, 22, x + 16, 58, 2) : R.M().line(4, 34, 46, 46, 2);
  R.fill(strap, r[2]);
  R.paint(R.M().ellipse(x, y, 7, 7), r, { flat: true });
});
face('ninja', 'Ninja Mask', '#34303d', (R, r, eyes, v) => {
  const m = R.body((x, y, p) => p === 'head' && y >= 56 && (v === 'front' ? x > 10 && x < 70 : x < 34));
  R.paint(m, r, { flat: true });
});
face('stickers', 'Star Stickers', '#f5d04a', (R, r, eyes, v) => {
  const m = R.M();
  for (const [x, y] of eyes) { const sx = x + (v === 'front' ? (x < 40 ? -4 : 4) : 2), sy = y + 11; m.poly([[sx, sy - 4], [sx + 1, sy - 1], [sx + 4, sy - 1], [sx + 2, sy + 1], [sx + 3, sy + 4], [sx, sy + 2], [sx - 3, sy + 4], [sx - 2, sy + 1], [sx - 4, sy - 1], [sx - 1, sy - 1]]); }
  R.paint(m, r, { flat: true });
});
face('bandaid', 'Bandage', '#f6d7b8', (R, r, eyes, v) => {
  const [x, y] = eyes[0]; const bx = v === 'front' ? x + 4 : x + 4, by = y + 11;
  R.paint(R.M().rect(bx - 5, by - 2, bx + 5, by + 2), r, { flat: true });
  R.fill(R.M().rect(bx - 1, by - 1, bx + 1, by + 1), r[2]);
});
face('whiskers', 'Kitty Whiskers', '#5c3228', (R, r, eyes, v) => {
  const m = R.M();
  for (const [x, y] of eyes) { const d = v === 'front' ? (x < 40 ? -1 : 1) : -1; m.line(x + d * 2, y + 9, x + d * 9, y + 8).line(x + d * 2, y + 11, x + d * 9, y + 12); }
  R.fill(m, r[1]);
});
})();
