// Pixie Closet wardrobe: hair. Loaded after _shared.js.
// Everything stays inside this IIFE so helper names never collide with other files.
(() => {
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
})();
