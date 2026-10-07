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


function feetMask(R, from, grow = 1) {
  const V = R.V; from = from ?? V.footY;
  const m = R.body((x, y, p) => (p === 'foot' || p === 'leg') && y >= from);
  if (grow) { const g = m.clone().dilate(grow).keep((x, y) => y >= from + 1 && y <= V.h); m.add(g); }
  return m;
}
