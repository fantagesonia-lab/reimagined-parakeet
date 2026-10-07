// Pixie Closet wardrobe: dress. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
// ---------------- DRESSES (replace top + bottom) ----------------
function dress(id, name, dye, cfg, deco) {
  return item('dress', id, name, dye, (R, ph, r, hex) => {
    if (ph === 'back') return cfg.behind && cfg.behind(R, r);
    const V = R.V;
    const body = shirtMask(R, { sleeve: cfg.sleeve, hem: V.crotchY - 1, neck: cfg.neck });
    if (cfg.legs) body.add(pantsMask(R, V.footY - 1));
    R.paint(body, r, { lines: true, pattern: cfg.pattern, alt: cfg.alt || WHITE });
    if (cfg.skirt) {
      const [y1, flare, jag] = cfg.skirt;
      R.paint(skirtMask(R, V.waistY - 1, y1 === 'feet' ? V.footY + 3 : y1, flare, jag || 0), r, { flat: true, pattern: cfg.pattern, alt: cfg.alt || WHITE });
    }
    deco && deco(R, r, hex);
  });
}
dress('sundress', 'Sundress', '#f5d04a', { sleeve: 'none', neck: 'wide', skirt: [108, 7], pattern: dots }, (R) => {
  const V = R.V;
  if (!isSide(R)) R.paint(R.M().line(V.cx - 9, 72, V.cx - 12, 66, 2).line(V.cx + 9, 72, V.cx + 12, 66, 2), ramp('#f5d04a'));
});
dress('gown', 'Royal Gown', '#f49ac1', { sleeve: 'puff', neck: 'sweet', skirt: ['feet', 16] }, (R, r) => {
  const V = R.V;
  R.paint(skirtMask(R, V.footY - 4, V.footY + 3, 16, 3, 6), ramp(r[0]), { flat: true });
  R.paint(skirtMask(R, 104, 107, 9, 2, 6).keep((x, y) => y >= 104), ramp(r[0]), { flat: true });
  waistBand(R, V.waistY - 2, 3, GOLD);
  if (isFront(R)) R.paint(R.M().ellipse(V.cx, 75, 2, 2), ramp('#8cc8f2'));
});
dress('maid', 'Café Maid', '#34303d', { sleeve: 'puff', neck: 'round', skirt: [108, 8, 2] }, (R) => {
  const V = R.V, [nx, ny] = V.neck;
  if (isFront(R)) {
    R.paint(R.M().poly([[V.cx - 9, V.waistY], [V.cx + 9, V.waistY], [V.cx + 12, 106], [V.cx - 12, 106]]).keep((x, y) => y < 106 - tri(x, 4, 2)), WHITE, { flat: true });
    R.paint(R.M().ellipse(nx, ny + 1, 8, 3), WHITE);
    R.paint(R.M().poly([[nx - 5, ny + 2], [nx, ny + 5], [nx - 5, ny + 8]]).poly([[nx + 5, ny + 2], [nx, ny + 5], [nx + 5, ny + 8]]), RED);
  } else if (isBack(R)) {
    R.paint(R.M().poly([[V.cx - 2, V.waistY], [V.cx - 10, V.waistY + 8], [V.cx - 6, V.waistY + 10]]).poly([[V.cx + 2, V.waistY], [V.cx + 10, V.waistY + 8], [V.cx + 6, V.waistY + 10]]).rect(V.cx - 13, V.waistY - 1, V.cx + 13, V.waistY + 1), WHITE);
  }
});
dress('witch', 'Witch Robe', '#5b3d8f', { sleeve: 'long', neck: 'v', skirt: ['feet', 8, 3], pattern: (x, y) => (x * 7 + y * 13) % 41 === 0, alt: GOLD }, (R) => {
  waistBand(R, R.V.waistY - 1, 3, GOLD);
});
dress('yukata', 'Summer Yukata', '#8cc8f2', { sleeve: 'long', neck: 'v', skirt: [124, 3], pattern: (x, y) => (x + y * 3) % 11 === 0 || (x * 3 - y) % 13 === 0, alt: WHITE }, (R, r) => {
  const V = R.V;
  waistBand(R, V.waistY - 4, 6, ramp('#e0475a'));
  if (isBack(R)) R.paint(R.M().poly([[V.cx - 10, V.waistY - 6], [V.cx + 10, V.waistY - 6], [V.cx + 6, V.waistY + 4], [V.cx - 6, V.waistY + 4]]), ramp('#e0475a'));
  if (!isSide(R)) R.paint(R.M().poly([[V.cx - 30, 80], [V.cx - 22, 78], [V.cx - 20, 92], [V.cx - 30, 94]]).mirror().sub(R.body((x, y, p) => p === 'hand')), r, { flat: true });
});
dress('magical', 'Magical Girl', '#f7f3f8', { sleeve: 'puff', neck: 'sweet', skirt: [104, 13, 3] }, (R) => {
  const V = R.V, pk = ramp('#f7a8c4');
  R.paint(skirtMask(R, 101, 104, 13, 3).keep((x, y) => y >= 100), pk, { flat: true });
  waistBand(R, V.waistY - 1, 3, pk);
  if (isFront(R)) {
    const bow = R.M().poly([[V.cx, 76], [V.cx - 9, 71], [V.cx - 9, 81]]).poly([[V.cx, 76], [V.cx + 9, 71], [V.cx + 9, 81]]);
    R.paint(bow, RED); R.paint(R.M().ellipse(V.cx, 76, 2, 2), GOLD);
  } else if (isBack(R)) {
    R.paint(R.M().poly([[V.cx, V.waistY], [V.cx - 11, V.waistY - 6], [V.cx - 11, V.waistY + 6]]).poly([[V.cx, V.waistY], [V.cx + 11, V.waistY - 6], [V.cx + 11, V.waistY + 6]]), pk);
  }
});
dress('onesie', 'Kitty Onesie', '#b8b0c8', {
  sleeve: 'long', neck: 'round', legs: true, pattern: dots, alt: WHITE,
  behind: (R, r) => {
    const V = R.V;
    if (isSide(R)) R.paint(R.M().line(48, 98, 60, 92, 3).line(60, 92, 64, 80, 3), r);
    else if (isFront(R)) R.paint(R.M().line(V.cx + 20, 98, V.cx + 30, 92, 3).line(V.cx + 30, 92, V.cx + 32, 80, 3), r);
  },
}, (R, r) => {
  const V = R.V;
  if (isBack(R)) R.paint(R.M().line(V.cx, 98, V.cx + 8, 92, 3).line(V.cx + 8, 92, V.cx + 10, 80, 3), r);
  if (isFront(R)) R.paint(R.M().ellipse(V.cx, 88, 6, 5), WHITE);
});
dress('pirate', 'Captain Coat', '#8a2335', { sleeve: 'long', neck: 'v', skirt: [112, 5] }, (R, r) => {
  const V = R.V;
  if (isFront(R)) {
    R.paint(R.M().poly([[V.cx - 5, 68], [V.cx + 6, 68], [V.cx + 4, 112], [V.cx - 3, 112]]).and(R.M().rect(0, 0, 80, 112)), WHITE, { flat: true });
    R.paint(R.M().poly([[V.cx - 4, 112], [V.cx + 5, 112], [V.cx + 4, 104], [V.cx - 3, 104]]).and(R.body(() => true)), ramp('#3a3440'), { lines: true });
    [74, 80, 86].forEach(y => R.fill(R.M().rect(V.cx - 8, y, V.cx - 7, y + 1).rect(V.cx + 8, y, V.cx + 9, y + 1), '#f2c14e'));
  }
  waistBand(R, V.waistY - 1, 3, ramp('#3a3440'));
  const cuffs = R.body((x, y, p) => p === 'arm' && y >= V.handY - 4);
  R.paint(cuffs, GOLD, { lines: true });
});
dress('winter', 'Snow Parka', '#e0475a', { sleeve: 'long', neck: 'high', skirt: [106, 5] }, (R) => {
  const V = R.V, fur = ramp('#fbf6ee');
  R.paint(skirtMask(R, 102, 108, 6, 2, 4).keep((x, y) => y >= 102), fur, { flat: true });
  R.paint(collarHigh(R), fur);
  const cuffs = R.body((x, y, p) => p === 'arm' && y >= V.handY - 3);
  R.paint(cuffs, fur, { lines: true });
  if (isFront(R)) R.fill(R.M().rect(V.cx, 72, V.cx, 101), '#34303d');
});
dress('fairy', 'Petal Dress', '#8fe0b8', { sleeve: 'none', neck: 'sweet', skirt: [110, 10, 5] }, (R, r) => {
  const V = R.V;
  R.paint(skirtMask(R, V.waistY - 1, 102, 6, 4, 8), ramp(r[0]), { flat: true });
});
})();
