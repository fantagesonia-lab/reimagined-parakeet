// Pixie Closet — wardrobe. Every item draws itself for front / side / back views.
// draw(R, phase, ramp, hex): phase 'back' = behind the body, 'front' = over it.

const ITEMS = [];
const ITEM_BY_ID = {};
function item(cat, id, name, dye, draw, extra = {}) {
  const it = { cat, id, name, dye, draw, ...extra };
  ITEMS.push(it); ITEM_BY_ID[id] = it; return it;
}
const WHITE = ramp('#f7f3f8'), GOLD = ramp('#f2c14e'), SILVER = ramp('#c9cfdc'), BLACK = ramp('#34303d');
const WOOD = ramp('#9a6a43'), RED = ramp('#e0475a'), PINK = ramp('#f7a8c4'), GREEN = ramp('#5bb36a');
const tri = (x, P, A) => A * (1 - Math.abs((((x % P) + P) % P) - P / 2) / (P / 2)); // triangle wave 0..A
const isSide = R => R.view === 'side', isBack = R => R.view === 'back', isFront = R => R.view === 'front';
// mirror an x coordinate for the character's own left/right in the back view
const mx = (R, x) => isBack(R) ? R.V.cx * 2 - x : x;

// ---------------- clothing helpers ----------------
function neckCut(R, type) {
  const V = R.V, [nx, ny] = V.neck, m = R.M();
  if (type === 'high') return m;
  if (isBack(R)) return type === 'wide' ? m.ellipse(nx, ny, 11, 3) : m.ellipse(nx, ny, 6, 2);
  if (isSide(R)) return type === 'wide' ? m.ellipse(nx + 2, ny, 9, 4) : m.ellipse(nx - 1, ny, 5, 3);
  if (type === 'v') return m.poly([[nx - 7, ny - 1], [nx + 8, ny - 1], [nx + .5, ny + 10]]);
  if (type === 'wide') return m.ellipse(nx, ny, 12, 4);
  if (type === 'sweet') return m.ellipse(nx, ny, 9, 3);
  return m.ellipse(nx, ny, 6, 3);
}
function shirtMask(R, { sleeve = 'short', hem, neck = 'round' } = {}) {
  const V = R.V; hem = hem ?? V.waistY + 4;
  const sl = sleeve === 'long' ? V.handY - 1 : sleeve === 'short' || sleeve === 'puff' ? V.sleeveShort : -1;
  const m = R.body((x, y, p) => (p === 'torso' && y <= hem) || (p === 'arm' && y <= sl));
  m.sub(neckCut(R, neck));
  if (sleeve === 'puff') m.add(puffs(R));
  if (neck === 'high') m.add(collarHigh(R));
  return m;
}
function puffs(R) {
  const V = R.V, m = R.M();
  if (isSide(R)) return m.ellipse(39, 76, 8, 6);
  return m.ellipse(V.cx - 18, 73, 8, 6).mirror();
}
function collarHigh(R) {
  const [nx, ny] = R.V.neck, m = R.M();
  if (isSide(R)) return m.rect(nx - 6, ny - 4, nx + 8, ny + 2);
  return m.rect(nx - 9, ny - 3, nx + 9, ny + 2);
}
function pantsMask(R, endY, waist) {
  const V = R.V; waist = waist ?? V.waistY;
  return R.body((x, y, p) => (p === 'torso' && y >= waist) || (p === 'leg' && y <= endY) || (p === 'foot' && y <= endY));
}
function handMask(R) { return R.body((x, y, p) => p === 'hand' || p === 'arm'); }
function skirtMask(R, y0, y1, flare, jag = 0, jagP = 6) {
  const V = R.V, L = V.torsoL, Rr = V.torsoR, m = R.M();
  m.poly([[L, y0], [Rr, y0], [Rr + flare, y1], [L - flare, y1]]);
  if (jag) m.keep((x, y) => y < y1 - tri(x - V.cx, jagP, jag) + 1);
  return m.sub(handMask(R));
}
function waistBand(R, y, h, color) {
  const V = R.V, m = R.body((x, yy, p) => p === 'torso' && yy >= y && yy < y + h);
  R.paint(m, color, { lines: true, flat: true });
}
function buttons(R, ys, c = '#f2c14e', dx = 0) {
  if (!isFront(R)) return;
  const m = R.M(); ys.forEach(y => m.rect(R.V.cx + dx, y, R.V.cx + dx + 1, y + 1)); R.fill(m, c);
}
const stripes = (P = 4, on = 2) => (x, y) => ((y % P) + P) % P < on;
const dots = (x, y) => (x % 6 === 2 && y % 6 === 2) || (x % 6 === 5 && y % 6 === 5);
const plaid = (x, y) => (x % 6 < 2) !== (y % 6 < 2);
const checker = (x, y) => ((x >> 2) + (y >> 2)) % 2 === 0;

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

// ---------------- SHOES ----------------
function feetMask(R, from, grow = 1) {
  const V = R.V; from = from ?? V.footY;
  const m = R.body((x, y, p) => (p === 'foot' || p === 'leg') && y >= from);
  if (grow) { const g = m.clone().dilate(grow).keep((x, y) => y >= from + 1 && y <= V.h); m.add(g); }
  return m;
}
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

// ---------------- HAIR ----------------
function hair(id, name, cfg) {
  return item('hair', id, name, null, (R, ph, r) => drawHair(R, ph, r, cfg), { hair: true });
}
function bangLimit(cfg, dx, x) {
  const b = cfg.bangs;
  if (b === 'straight') return 31 + tri(x, 6, 3);
  if (b === 'swept') return Math.min(36, 20 + (dx + 24) * 0.32) + tri(x, 7, 3);
  if (b === 'parted') return Math.min(36, 14 + Math.abs(dx) * 0.8) + tri(x, 6, 2);
  if (b === 'spiky') return 28 + tri(x, 8, 7);
  if (b === 'short') return 18 + Math.abs(dx) * 0.3 + tri(x, 6, 3);
  return 0;
}
function capMask(R, cfg) {
  const V = R.V, view = R.view, vol = cfg.volume ?? 2;
  let m;
  if (cfg.puff) m = R.M().ellipse(V.headCx, view === 'side' ? 26 : 24, 44, 34);
  else m = R.body((x, y, p) => p === 'head').dilate(vol);
  const cx = V.headCx;
  m.keep((x, y) => {
    if (y < 8) return true;
    if (view === 'back') return y < (cfg.side <= 44 ? 63 : 67);
    if (view === 'side') {
      if (x < 20) return y < bangLimit(cfg, -10, x);
      if (x < 40) { const t = (x - 20) / 20, sl = Math.min(cfg.side, 48); return y < bangLimit(cfg, -10, x) * (1 - t) + sl * t; }
      if (x < 54 && cfg.side <= 52) return y < 44;
      return y < 66;
    }
    const dx = x - cx;
    if (Math.abs(dx) >= 25) return y < cfg.side + (cfg.side > 50 ? tri(x, 6, 3) : 0);
    return y < bangLimit(cfg, dx, x);
  });
  if (cfg.side >= 56 && view === 'front') { // face-framing locks
    const L = R.M().poly([[cx - 38, 26], [cx - 27, 26], [cx - 27, cfg.side + 2], [cx - 38, cfg.side + 2]]).mirror();
    L.keep((x, y) => y < cfg.side + 2 - tri(x, 5, 4));
    m.add(L);
  }
  if (cfg.spikes) {
    if (view === 'side') for (const [x, y] of [[20, 2], [34, -2], [48, 2], [60, 10]]) m.poly([[x - 7, y + 8], [x + 7, y + 8], [x + 9, y - 10]]);
    else for (const dx of [-24, -12, 0, 12, 24]) m.poly([[cx + dx - 7, 8 - Math.abs(dx) / 4], [cx + dx + 7, 8 - Math.abs(dx) / 4], [cx + dx + dx / 5, -10 + Math.abs(dx) / 3]]);
  }
  return m;
}
function backHairMask(R, cfg) {
  const V = R.V, cx = V.headCx, len = cfg.back, m = R.M();
  if (!len) return m;
  if (R.view === 'side') m.poly([[30, 14], [64, 10], [70 + (len > 90 ? 4 : 0), len], [38, len]]);
  else m.poly([[cx - 36, 24], [cx + 36, 24], [cx + 38 + (cfg.flare || 0), len], [cx - 38 - (cfg.flare || 0), len]]);
  const j = cfg.curls ? 6 : cfg.jag || 5;
  m.keep((x, y) => y < len - tri(x, cfg.curls ? 10 : 7, j) + 1);
  return m;
}
function tailMasks(R, cfg) {
  const V = R.V, cx = V.headCx, m = R.M(), ties = R.M();
  if (cfg.tails) {
    if (R.view === 'side') { m.poly([[54, 12], [64, 18], [68, 50], [64, 84], [56, 94], [54, 70], [56, 40]]); ties.ellipse(58, 15, 3, 3); }
    else {
      m.poly([[cx - 34, 12], [cx - 28, 20], [cx - 34, 42], [cx - 38, 66], [cx - 36, 88], [cx - 44, 96], [cx - 50, 80], [cx - 50, 52], [cx - 46, 26]]).mirror();
      ties.ellipse(cx - 36, 16, 3, 3).mirror();
    }
  }
  if (cfg.pony || cfg.sidetail) {
    const side = cfg.sidetail ? 1 : 0;
    if (R.view === 'side') { m.poly([[58, 16 + side * 20], [70, 22 + side * 20], [74, 52 + side * 10], [68, 86 + side * 4], [62, 74], [62, 40]]); ties.ellipse(62, 20 + side * 20, 3, 3); }
    else if (R.view === 'back' && !side) { m.poly([[cx - 6, 18], [cx + 6, 18], [cx + 11, 50], [cx + 6, 86], [cx, 94], [cx - 6, 86], [cx - 11, 50]]); ties.ellipse(cx, 20, 4, 3); }
    else {
      const s = (R.view === 'back') ? -1 : 1, b = cx + s * 30;
      m.poly([[b, 20], [b + s * 12, 24], [b + s * 18, 54], [b + s * 14, 88], [b + s * 6, 96], [b + s * 4, 60]]);
      ties.ellipse(b + s * 6, 24, 3, 3);
    }
  }
  return { m, ties };
}
function bunMask(R, cfg) {
  const V = R.V, m = R.M();
  if (!cfg.buns) return m;
  if (R.view === 'side') return m.ellipse(V.headCx + 12, -2, 9, 9);
  return m.ellipse(V.headCx - 27, 2, 9, 9).mirror();
}
function hairShade(R, mask, r, cfg, cap) {
  R.paint(mask, r, { flat: !cap });
}
function hairShine(R, cap, r) {
  const V = R.V, cx = V.headCx - (R.view === 'side' ? 4 : 0), m = R.M();
  for (let x = cx - 24; x <= cx + 24; x++) {
    const dx = x - cx, y = Math.round(11 + dx * dx / 80);
    if (((x - cx + 50) % 6) < 4 && cap.has(x, y) && cap.has(x, y + 3) && cap.has(x, y - 2)) m.set(x, y).set(x, y + 1);
  }
  R.fill(m, r[0]);
}
function hairStrands(R, mask, r, from, to, xs) {
  const m = R.M();
  for (const x of xs) for (let y = from; y < to; y++) if (mask.has(x, y) && mask.has(x - 1, y) && mask.has(x + 1, y) && mask.has(x, y + 2)) m.set(x, y);
  R.fill(m, r[2]);
}
function drawHair(R, ph, r, cfg) {
  const view = R.view, V = R.V, cx = V.headCx;
  const back = backHairMask(R, cfg), { m: tails, ties } = tailMasks(R, cfg);
  const tieR = ramp(cfg.tie || '#e0475a');
  if (view !== 'back' && ph === 'back') {
    if (!back.empty()) { R.paint(back, r, { flat: true }); hairStrands(R, back, r, 40, cfg.back - 4, view === 'side' ? [44, 52, 60] : [cx - 30, cx - 20, cx + 20, cx + 30]); }
    if (!tails.empty()) { R.paint(tails, r, { flat: true }); hairStrands(R, tails, r, 30, 90, view === 'side' ? [60, 64] : [cx - 42, cx + 42, cx + 38, cx - 38]); R.paint(ties, tieR); }
    return;
  }
  if (ph !== 'front') return;
  if (view === 'back') {
    if (!tails.empty()) { R.paint(tails, r, { flat: true }); hairStrands(R, tails, r, 30, 92, [cx - 42, cx + 42, cx, cx - 4, cx + 4]); }
    if (!back.empty()) { R.paint(back, r, { flat: true }); }
  }
  const buns = bunMask(R, cfg);
  if (!buns.empty()) { R.paint(buns, r, { flat: true }); }
  const cap = capMask(R, cfg);
  if (view === 'back' && !back.empty()) cap.add(back);
  R.paint(cap, r, { headOnly: true });
  if (view === 'back') hairStrands(R, cap, r, 24, (cfg.back || 66) - 4, [cx - 24, cx - 14, cx - 5, cx + 5, cx + 14, cx + 24]);
  else {
    // separations between bang clumps
    const sep = R.M();
    cap.each((x, y) => { if (y > 18 && y < 40 && !cap.has(x, y + 1 + (cfg.bangs === 'spiky' ? 3 : 2)) && ((x - cx) % 6 === 0)) sep.set(x, y); });
    R.fill(sep, r[2]);
  }
  hairShine(R, cap, r);
  if (view === 'back' && !ties.empty()) R.paint(ties, tieR);
  if (view === 'back' && !buns.empty()) R.paint(buns, r, { flat: true });
}
hair('bob', 'Bob', { bangs: 'straight', side: 58, back: 72, volume: 3 });
hair('long', 'Long & Straight', { bangs: 'straight', side: 62, back: 112 });
hair('twintail', 'Twin Tails', { bangs: 'straight', side: 50, tails: true, tie: '#f7a8c4' });
hair('pony', 'High Ponytail', { bangs: 'swept', side: 48, pony: true });
hair('buns', 'Space Buns', { bangs: 'parted', side: 52, buns: true });
hair('spiky', 'Hero Spikes', { bangs: 'spiky', side: 44, spikes: true, volume: 3 });
hair('messy', 'Messy Short', { bangs: 'swept', side: 42, volume: 3 });
hair('curtain', 'Curtain Bangs', { bangs: 'parted', side: 60, back: 88 });
hair('curls', 'Princess Curls', { bangs: 'parted', side: 64, back: 118, curls: true, flare: 6 });
hair('pixie', 'Pixie', { bangs: 'short', side: 40, volume: 1 });
hair('sidetail', 'Side Tail', { bangs: 'swept', side: 50, sidetail: true, tie: '#f5d04a' });
hair('puff', 'Cloud Puff', { bangs: 'short', side: 58, puff: true });
hair('hime', 'Hime Cut', { bangs: 'straight', side: 66, back: 116 });
hair('wolf', 'Wolf Cut', { bangs: 'spiky', side: 60, back: 80, jag: 8 });

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

// Defaults for the dye palette and presets
const DYES = ['#f7f3f8', '#f6e3b8', '#f7a8c4', '#e0475a', '#f08a3c', '#f5d04a', '#8fe0b8', '#5bb36a', '#8cc8f2', '#3f6fd8', '#2c3a6b', '#b9a0ef', '#7a4bc4', '#8a5a3c', '#8b8fa3', '#34303d'];
const HAIR_COLORS = ['#2b2633', '#4a2e24', '#7a4a2e', '#a35d36', '#d8743a', '#f0cf6e', '#f3ead2', '#c9ccd8', '#f49ac1', '#c8364a', '#4a7fe0', '#7fd8c0', '#8a5ad0', '#cbb4f0'];
