// Pixie Closet — pixel-art maps for the stage (SW x SH logical pixels).
// Each map is a stack of layers. Static layers are painted once into an offscreen canvas;
// animated layers (drifting clouds, particles, portals, lanterns) are drawn every frame on top.
const SW = 256, SH = 208, GROUND = 184;
const SCENES = (() => {
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const T = (h, kind) => ramp(h, kind).t.map(rgbHex); // [spec, hi, lt, base, sh, dp, line]
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const P = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)] / 16 - .47;

  // ---------- painting helpers ----------
  function sky(g, cols, y0, y1) { // ordered-dither vertical gradient
    const n = cols.length - 1;
    for (let y = y0; y < y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0 - 1) * n, i = Math.min(n - 1, Math.floor(t)), f = t - i;
      let run = 0, cur = null;
      for (let x = 0; x <= SW; x++) {
        const c = x < SW ? (f + bay(x, y) * .9 > .5 ? cols[i + 1] : cols[i]) : null;
        if (c !== cur) { if (cur) P(g, cur, x - run, y, run, 1); cur = c; run = 0; }
        run++;
      }
    }
  }
  function disc(g, cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      const w = Math.sqrt(Math.max(0, r * r - (y + .5 - cy) ** 2)), a = Math.round(cx - w), b = Math.round(cx + w);
      if (b > a) P(g, c, a, y, b - a, 1);
    }
  }
  // A union of circles, shaded as a lit volume (light from the top-left) with a coloured outline.
  function blob(g, circles, tn, o = {}) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [cx, cy, r] of circles) { x0 = Math.min(x0, cx - r); y0 = Math.min(y0, cy - r); x1 = Math.max(x1, cx + r); y1 = Math.max(y1, cy + r); }
    x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1; x1 = Math.ceil(x1) + 1; y1 = Math.ceil(y1) + 1;
    const W = x1 - x0 + 1, H = y1 - y0 + 1, IN = new Uint8Array(W * H), NX = new Float32Array(W * H), NY = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const px = x0 + x + .5, py = y0 + y + .5; let best = -1, nx = 0, ny = 0;
      for (const [cx, cy, r] of circles) { const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy); if (d <= r && r - d > best) { best = r - d; nx = dx / r; ny = dy / r; } }
      if (best < 0 || (o.cut && o.cut(x0 + x, y0 + y))) continue;
      const i = y * W + x; IN[i] = 1; NX[i] = nx; NY[i] = ny;
    }
    const at = (x, y) => x >= 0 && y >= 0 && x < W && y < H && IN[y * W + x];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!at(x, y)) continue;
      const X = x0 + x, Y = y0 + y, i = y * W + x;
      if (o.line !== false && (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1))) { P(g, o.line || tn[6], X, Y); continue; }
      const nx = NX[i], ny = NY[i], nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const l = -nx * .55 - ny * .66 + nz * .55 + bay(X, Y) * (o.dither ?? .14) + (o.bias || 0);
      P(g, tn[l > .82 ? 1 : l > .6 ? 2 : l > .24 ? 3 : l > -.14 ? 4 : 5], X, Y);
    }
  }
  function box(g, x0, y0, x1, y1, tn, o = {}) { // a lit block with outline: light top-left, shade bottom-right
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      let c = tn[3];
      if (edge) c = o.line || tn[6];
      else if (y === y0 + 1 || x === x0 + 1) c = tn[1];
      else if (y === y1 - 1 || x === x1 - 1) c = tn[4];
      else if (o.grain && (x * 7 + y * 3) % 11 === 0) c = tn[2];
      P(g, c, x, y);
    }
  }
  function hillTop(y, amp, per, phase) { return x => Math.round(y - amp * (Math.sin((x + phase) / per) * .6 + Math.sin((x + phase) / (per * .43)) * .4)); }
  function hill(g, top, tn, o = {}) {
    for (let x = 0; x < SW; x++) {
      const t = top(x); P(g, tn[3], x, t, 1, SH - t);
      P(g, o.line || tn[5], x, t - 1); P(g, tn[1], x, t, 1, 1); P(g, tn[2], x, t + 1, 1, 1);
    }
    const r = rng(o.seed || 7);
    for (let i = 0; i < (o.specks ?? 70); i++) { const x = r() * SW | 0, y = top(x) + 4 + (r() * (o.depth || 30) | 0); P(g, tn[4], x, y, 2, 1); P(g, tn[2], x, y - 1, 1, 1); }
  }
  function trunk(g, x, y0, y1, w, tn) {
    for (let y = y0; y <= y1; y++) for (let k = 0; k < w; k++) P(g, k === 0 || k === w - 1 ? tn[6] : k === 1 ? tn[2] : k >= w - 2 ? tn[4] : tn[3], x + k, y);
    for (let y = y0 + 3; y < y1; y += 5) P(g, tn[5], x + 2 + (y % 3), y, 1, 2);
  }
  function tree(g, x, y, r, leaf, bark = '#8a5a3c') { // round tree standing at (x, y)
    trunk(g, x - 2, y - r - 2, y, 5, T(bark));
    blob(g, [[x, y - r * 1.75, r], [x - r * .7, y - r * 1.25, r * .72], [x + r * .7, y - r * 1.3, r * .72], [x + r * .15, y - r * 2.3, r * .65]], T(leaf));
  }
  function bush(g, x, y, r, leaf) { blob(g, [[x - r * .7, y - r * .5, r * .7], [x + r * .6, y - r * .45, r * .75], [x, y - r * .8, r * .85]], T(leaf), { cut: (X, Y) => Y >= y }); }
  // floating island platform: grass cap, dirt body with stones, rounded underside
  function platform(g, x0, x1, y, o = {}) {
    const gr = T(o.grass || '#6cc35a'), di = T(o.dirt || '#b47a48'), st = T(o.stone || '#cdb99a'), depth = o.depth || 13, r = rng(x0 * 31 + y);
    for (let x = x0; x <= x1; x++) {
      const e = Math.min(x - x0, x1 - x), d = Math.min(depth, 5 + Math.round(e * 1.4)) + ((x * 13) % 7 === 0 ? 1 : 0);
      for (let k = 0; k < d; k++) {
        const last = k === d - 1 || e === 0;
        P(g, last ? di[6] : k >= d - 3 ? di[5] : k > d * .5 ? di[4] : k < 2 ? di[2] : di[3], x, y + 3 + k);
      }
    }
    for (let x = x0 + 5; x < x1 - 6; x += 6 + (r() * 5 | 0)) {
      const yy = y + 6 + (r() * 4 | 0); if (yy > y + depth - 3) continue;
      P(g, st[6], x, yy, 4, 3); P(g, st[2], x + 1, yy, 2, 1); P(g, st[3], x + 1, yy + 1, 2, 1); P(g, st[4], x + 3, yy + 1, 1, 1);
    }
    for (let x = x0 - 2; x <= x1 + 2; x++) {
      const end = x < x0 || x > x1;
      P(g, gr[6], x, y - 1); P(g, end ? gr[4] : gr[1], x, y); P(g, gr[3], x, y + 1, 1, 2); P(g, gr[5], x, y + 3);
      if (!end && (x * 5) % 3 === 0) P(g, gr[4], x, y + 4);
      if (!end && (x * 7) % 5 === 0) { P(g, gr[6], x, y - 2); P(g, gr[2], x, y - 1); }
    }
    P(g, gr[6], x0 - 3, y, 1, 3); P(g, gr[6], x1 + 3, y, 1, 3); P(g, gr[6], x0 - 2, y + 3, 2, 1); P(g, gr[6], x1 + 1, y + 3, 2, 1);
  }
  function rope(g, x, y0, y1) {
    for (let y = y0; y < y1; y++) { const s = (y >> 1) % 2; P(g, '#6b4a24', x - 1, y); P(g, s ? '#f0cc92' : '#c99a5b', x, y); P(g, s ? '#c99a5b' : '#9a6d38', x + 1, y); P(g, '#6b4a24', x + 2, y); }
    P(g, '#5a3a1c', x - 2, y0 - 1, 6, 4); P(g, '#e8c48a', x - 1, y0, 3, 1); P(g, '#a87a40', x - 1, y0 + 1, 4, 1);
    P(g, '#5a3a1c', x - 1, y1, 4, 2); P(g, '#c99a5b', x, y1, 2, 1);
  }
  function ladder(g, x, y0, y1) {
    for (let y = y0; y < y1; y++) for (const rx of [x, x + 9]) { P(g, '#4a2e14', rx, y); P(g, '#d39a5c', rx + 1, y); P(g, '#93602f', rx + 2, y); P(g, '#4a2e14', rx + 3, y); }
    for (let y = y0 + 4; y < y1 - 1; y += 6) { P(g, '#4a2e14', x + 4, y - 1, 5, 1); P(g, '#e7b274', x + 4, y, 5, 1); P(g, '#8a5a2c', x + 4, y + 1, 5, 1); }
  }
  function fence(g, x0, x1, y) {
    const w = T('#c8925a');
    for (let x = x0; x <= x1; x += 9) box(g, x, y - 12, x + 3, y, w);
    for (const yy of [y - 9, y - 4]) { P(g, w[6], x0, yy - 1, x1 - x0 + 4, 1); P(g, w[2], x0, yy, x1 - x0 + 4, 1); P(g, w[4], x0, yy + 1, x1 - x0 + 4, 1); P(g, w[6], x0, yy + 2, x1 - x0 + 4, 1); }
  }
  function flowers(g, x0, x1, y, cols, seed) {
    const r = rng(seed);
    for (let x = x0; x < x1; x += 3 + (r() * 9 | 0)) {
      const c = cols[r() * cols.length | 0], h = 2 + (r() * 3 | 0);
      P(g, '#3e8a3a', x, y - h, 1, h); P(g, c, x - 1, y - h - 1, 3, 1); P(g, c, x, y - h - 2, 1, 3); P(g, '#fff6b0', x, y - h - 1);
    }
  }
  function mushHouse(g, x, y, cap) { // a mushroom cottage standing on y
    const st = T('#f3e3c6'), wd = T('#8a5a3c');
    box(g, x - 9, y - 18, x + 9, y, st);
    for (let yy = y - 9; yy <= y; yy++) for (let xx = x - 4; xx <= x + 3; xx++) {
      if (yy === y - 9 && (xx === x - 4 || xx === x + 3)) continue;
      P(g, xx === x - 4 || xx === x + 3 || yy === y - 9 || (yy === y - 8 && (xx === x - 4 || xx === x + 3)) ? wd[6] : xx === x - 3 ? wd[2] : wd[3], xx, yy);
    }
    P(g, '#f7d34c', x + 1, y - 5); P(g, wd[5], x - 1, y - 8, 1, 8);
    disc(g, x + 5.5, y - 13.5, 3, '#3d5a8a'); disc(g, x + 5.5, y - 13.5, 2, '#8fd0ff'); P(g, '#ffffff', x + 4, y - 15);
    P(g, st[5], x - 8, y - 17, 17, 2);
    const t = T(cap);
    blob(g, [[x, y - 20, 15], [x - 10, y - 17, 9], [x + 10, y - 17, 9]], t, { cut: (X, Y) => Y > y - 16 });
    for (const [sx, sy, sr] of [[x - 7, y - 27, 2.6], [x + 5, y - 30, 2.2], [x + 10, y - 22, 1.8], [x - 1, y - 23, 1.6], [x - 12, y - 20, 1.5]]) { disc(g, sx, sy, sr, '#fff8ee'); P(g, '#e6d6c6', Math.round(sx), Math.round(sy + sr - 1)); }
  }
  function sign(g, x, y, text) {
    const w = T('#c8925a');
    box(g, x - 1, y - 18, x + 1, y, w);
    box(g, x - 11, y - 22, x + 10, y - 13, w, { grain: true });
    P(g, w[5], x - 8, y - 18, 14, 1);
    g.fillStyle = w[6]; g.font = '7px monospace';
    if (text) { P(g, w[6], x + 7, y - 19, 1, 3); P(g, w[6], x + 6, y - 20, 1, 1); P(g, w[6], x + 6, y - 16, 1, 1); }
  }
  function mountain(g, cx, top, w, base, lit, shd, snow, line) {
    for (let y = top; y < base; y++) {
      const hw = (y - top) / (base - top) * w, a = Math.round(cx - hw), b = Math.round(cx + hw), m = Math.round(cx + Math.sin(y * .3) * 1.5);
      const capY = top + (base - top) * .28 + Math.sin(y * 1.7) * 2;
      for (let x = a; x <= b; x++) {
        let c = x < m ? lit : shd;
        if (y < capY + ((x * 7) % 5 === 0 ? 2 : 0)) c = x < m ? snow[0] : snow[1];
        if (x === a || x === b) c = line;
        P(g, c, x, y);
      }
    }
  }
  function pine(g, x, y, h, leaf = '#2f6a5c') {
    const t = T(leaf), tiers = 4;
    trunk(g, x - 2, y - 6, y, 5, T('#6b4a3a'));
    for (let k = 0; k < tiers; k++) {
      const ty = y - h + k * h / (tiers + .6), hh = h / tiers + 4, ww = 5 + k * 3.2;
      for (let yy = 0; yy < hh; yy++) {
        const hw = Math.round(yy / hh * ww), Y = Math.round(ty + yy);
        for (let xx = -hw; xx <= hw; xx++) {
          let c = xx < -hw / 3 ? t[2] : xx > hw / 3 ? t[4] : t[3];
          if (xx === -hw || xx === hw || yy === Math.ceil(hh) - 1) c = t[6];
          if (yy < 3 + (xx & 1) && Math.abs(xx) < hw) c = '#ffffff';
          else if (yy === Math.ceil(hh) - 1 && (xx + k) % 3 === 0) c = '#e6f0fb';
          P(g, c, x + xx, Y);
        }
      }
    }
  }
  function ground(g, o) { // grass/snow cap over a brick or stone cliff face
    const top = T(o.top), face = T(o.face), r = rng(o.seed || 11), y = GROUND;
    P(g, face[3], 0, y + 3, SW, SH - y - 3);
    if (o.bricks) {
      for (let row = 0, yy = y + 5; yy < SH; row++, yy += 6) {
        for (let x = -(row % 2) * 7; x < SW; x += 14) {
          const v = r();
          box(g, x, yy, x + 13, yy + 5, v < .3 ? T(o.face2 || o.face) : face, { line: face[5] });
        }
      }
    } else {
      for (let i = 0; i < 90; i++) { const x = r() * SW | 0, yy = y + 6 + (r() * (SH - y - 7) | 0); P(g, face[5], x, yy, 3, 2); P(g, face[2], x, yy - 1, 2, 1); }
    }
    P(g, top[6], 0, y - 2, SW, 1); P(g, top[1], 0, y - 1, SW, 1); P(g, top[3], 0, y, SW, 3); P(g, top[4], 0, y + 3, SW, 1); P(g, top[5], 0, y + 4, SW, 1);
    for (let x = 0; x < SW; x++) {
      if ((x * 7) % 5 === 0) { P(g, top[6], x, y - 3); P(g, top[2], x, y - 2); }
      if ((x * 3) % 4 === 0) P(g, top[4], x, y + 5);
      if ((x * 11) % 7 === 0) P(g, top[5], x, y + 6);
    }
  }
  function shadowBand(g, y0, y1, a) { for (let y = y0; y < y1; y++) { g.fillStyle = `rgba(20,10,40,${(a * (y - y0) / (y1 - y0)).toFixed(3)})`; g.fillRect(0, y, SW, 1); } }

  // ---------- animated bits ----------
  const sprites = {};
  function cloudSprite(key, w, seed, tn) {
    if (sprites[key]) return sprites[key];
    const r = rng(seed), h = Math.round(w * .55), c = mk(w + 4, h + 4), circles = [];
    const n = 3 + (r() * 2 | 0);
    for (let i = 0; i < n; i++) { const rr = h * (.32 + r() * .14); circles.push([2 + rr + (w - rr * 2) * i / (n - 1), h + 2 - rr, rr]); }
    circles.push([2 + w * .42, 2 + h * .48, h * .46], [2 + w * .66, 2 + h * .56, h * .36]);
    blob(c.getContext('2d'), circles, tn, { line: tn[6], cut: (X, Y) => Y > h, dither: .2 });
    return sprites[key] = c;
  }
  const CLOUD = ['#ffffff', '#ffffff', '#ffffff', '#f2f8ff', '#dcebf8', '#c6dcef', '#b4cde4'];
  const PINKCLOUD = ['#ffffff', '#ffffff', '#fff7fb', '#fbeaf6', '#efd6ef', '#dcc2e8', '#c8afe0'];
  function clouds(g, t, list, tn, tag) { // [x, y, width, speed]; wraps around
    list.forEach(([x, y, w, sp], i) => {
      const s = cloudSprite(tag + i, w, 17 + i * 11, tn), span = SW + s.width;
      g.drawImage(s, Math.round(((x + t * sp / 1000) % span + span) % span - s.width), y);
    });
  }
  let portalFrames = null;
  function portal(g, x, y, t) { // swirling portal standing at (x, y)
    if (!portalFrames) portalFrames = Array.from({ length: 10 }, (_, f) => {
      const c = mk(22, 36), q = c.getContext('2d');
      for (let yy = 0; yy < 36; yy++) for (let xx = 0; xx < 22; xx++) {
        const dx = (xx + .5 - 11) / 10, dy = (yy + .5 - 19) / 16, d = dx * dx + dy * dy; if (d > 1) continue;
        const a = Math.atan2(dy, dx), r = Math.sqrt(d), v = Math.sin(a * 2 - r * 8 + f / 10 * Math.PI * 2);
        const c2 = d > .86 ? '#2a5fbf' : v > .6 ? '#ffffff' : v > .1 ? '#a8ecff' : v > -.4 ? '#58b8f4' : '#3586dc';
        q.globalAlpha = d > .86 ? .9 : .55 + .45 * (1 - r); q.fillStyle = c2; q.fillRect(xx, yy, 1, 1);
      }
      return c;
    });
    g.fillStyle = 'rgba(120,200,255,.35)'; g.fillRect(x - 12, y - 1, 24, 2); g.fillRect(x - 9, y - 2, 18, 1);
    g.drawImage(portalFrames[Math.floor(t / 80) % 10], x - 11, y - 36);
  }
  function particles(kind, t, g) {
    const r = rng(7);
    const n = kind === 'leaf' ? 14 : kind === 'snow' ? 52 : kind === 'firefly' ? 20 : kind === 'petal' ? 18 : 0;
    for (let i = 0; i < n; i++) {
      const sp = .4 + r() * .6, x0 = r() * SW, ph = r() * 1000;
      if (kind === 'firefly') {
        const x = (x0 + Math.sin((t / 1400 + ph) * sp) * 18 + SW) % SW, y = 50 + r() * 120 + Math.cos(t / 1100 + ph) * 10;
        if (Math.sin(t / 400 + ph) <= -.2) continue;
        g.fillStyle = 'rgba(249,247,160,.22)'; g.fillRect((x | 0) - 2, (y | 0) - 1, 6, 4); g.fillRect((x | 0) - 1, (y | 0) - 2, 4, 6);
        g.fillStyle = '#fbf9b8'; g.fillRect(x | 0, y | 0, 2, 2);
        continue;
      }
      const y = ((t / 40) * sp + ph) % (SH + 20) - 10, x = ((x0 + Math.sin(y / 18 + ph) * 8 + (kind === 'snow' ? 0 : y * .3)) % SW + SW) % SW;
      if (kind === 'snow') { g.fillStyle = sp > .75 ? '#ffffff' : 'rgba(255,255,255,.75)'; g.fillRect(x | 0, y | 0, sp > .75 ? 2 : 1, sp > .75 ? 2 : 1); }
      else if (kind === 'leaf') { const c = i % 3 ? ['#f08a3c', '#c8562a'] : ['#e0475a', '#9e2438']; g.fillStyle = c[0]; g.fillRect(x | 0, y | 0, 3, 2); g.fillRect((x | 0) + 1, (y | 0) - 1, 1, 4); g.fillStyle = c[1]; g.fillRect((x | 0) + 2, (y | 0) + 1, 1, 1); }
      else { g.fillStyle = i % 2 ? '#f7b3cf' : '#fde4ef'; g.fillRect(x | 0, y | 0, 2, 2); g.fillStyle = '#e88fb4'; g.fillRect((x | 0) + 1, (y | 0) + 1, 1, 1); }
    }
  }
  function twinkle(g, t, n, seed, y1) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * SW | 0, y = r() * y1 | 0, ph = r() * 6.28, b = Math.sin(t / 500 + ph);
      if (b < -.5) continue;
      g.fillStyle = i % 5 ? '#e8e2ff' : '#fff3a6'; g.fillRect(x, y, 1, 1);
      if (b > .75) { g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
    }
  }

  // ---------- scenes ----------
  function scene(def) {
    const cache = [];
    def.draw = (g, t) => def.layers.forEach((L, i) => {
      if (typeof L === 'function') { L(g, t); return; }
      if (!cache[i]) { const c = mk(SW, SH); L.paint(c.getContext('2d')); cache[i] = c; }
      g.drawImage(cache[i], 0, 0);
    });
    return def;
  }
  const still = paint => ({ paint });

  return [
    scene({
      id: 'meadow', name: 'Mushroom Meadow', region: 'Bellflower', layers: [
        still(g => {
          sky(g, ['#56b0ee', '#7fc8f4', '#aedef6', '#ddf2f2'], 0, 160);
          g.fillStyle = 'rgba(255,248,200,.25)'; disc(g, 222, 34, 17, 'rgba(255,248,200,.18)'); disc(g, 222, 34, 13, 'rgba(255,248,200,.3)');
          disc(g, 222, 34, 9, '#ffe680'); disc(g, 221, 33, 7.5, '#fff6c8'); disc(g, 219, 31, 3, '#ffffff');
        }),
        (g, t) => clouds(g, t, [[10, 28, 30, 2.2], [150, 18, 22, 1.6], [90, 52, 18, 1.2]], CLOUD, 'mf'),
        still(g => {
          const far = hillTop(136, 9, 26, 10);
          hill(g, far, T('#9fd2c8'), { specks: 0, line: '#86bdb4' });
          for (let x = 6; x < SW; x += 15) { const y = far(x); blob(g, [[x, y - 3, 4.5]], T('#8cc6b4'), { line: '#78b2a2', dither: .05 }); }
          const mid = hillTop(156, 8, 21, 40);
          hill(g, mid, T('#86cc6e'), { seed: 3, depth: 20 });
          tree(g, 104, mid(104) + 4, 9, '#5fb85a'); tree(g, 160, mid(160) + 5, 7, '#6cc35a');
          tree(g, 84, mid(84) + 6, 6, '#72c45e');
        }),
        still(g => {
          bush(g, 40, GROUND - 1, 10, '#5fb85a'); bush(g, 196, GROUND - 1, 9, '#5fb85a');
          fence(g, 64, 100, GROUND - 2); fence(g, 160, 188, GROUND - 2);
          mushHouse(g, 22, GROUND - 1, '#e0475a');
          platform(g, 2, 66, 118); ladder(g, 46, 124, GROUND - 1);
          platform(g, 186, 254, 96, { depth: 14 }); mushHouse(g, 232, 95, '#f08a3c'); rope(g, 200, 104, GROUND - 3);
          flowers(g, 0, SW, GROUND - 2, ['#ffffff', '#f7d34c', '#f7a8c4'], 4);
          flowers(g, 6, 64, 117, ['#ffffff', '#f7d34c'], 9); flowers(g, 188, 220, 95, ['#f7a8c4', '#ffffff'], 12);
          sign(g, 172, GROUND - 1, true);
          ground(g, { top: '#5cbd4c', face: '#b9804e', face2: '#a8703f', bricks: true, seed: 5 });
        }),
        (g, t) => { portal(g, 240, GROUND - 1, t); particles('leaf', t, g); },
      ],
    }),
    scene({
      id: 'forest', name: 'Fairy Forest', region: 'Elderwood', layers: [
        still(g => {
          sky(g, ['#0e2730', '#143a40', '#1d5049', '#2a6550'], 0, GROUND);
          for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(210,255,190,.05)'; for (let y = 0; y < GROUND; y++) g.fillRect(40 + i * 38 + y * .35 | 0, y, 9 + (i % 3) * 4, 1); }
          const r = rng(3);
          for (let i = 0; i < 10; i++) { const x = r() * SW | 0, w = 7 + r() * 8 | 0; trunk(g, x, 0, GROUND, w, T(i % 2 ? '#2a4b47' : '#30544d')); }
        }),
        still(g => {
          for (const [x, w] of [[2, 16], [58, 12], [192, 14], [236, 18]]) {
            trunk(g, x, 0, GROUND, w, T('#5a4334'));
            for (let k = 0; k < 4; k++) { P(g, '#3a2a20', x - 2 - k, GROUND - 4 + k, 3, 1); P(g, '#3a2a20', x + w - 1 + k, GROUND - 4 + k, 3, 1); }
          }
          for (let x = -10; x < SW + 10; x += 22) blob(g, [[x, 6, 16], [x + 11, 14, 12]], T(x % 44 ? '#2f7d4a' : '#2a6f45'), { dither: .2 });
          for (const x of [30, 94, 150, 226]) { const r = rng(x); let xx = x; for (let y = 16; y < 60 + (x % 30); y++) { xx += Math.sin(y / 5 + x) * .5; P(g, '#3f8f4a', xx | 0, y); if (y % 6 === 0) { P(g, '#6cc35a', (xx | 0) - 2, y, 2, 2); P(g, '#2f6a3a', (xx | 0) - 1, y + 1); } } }
          for (let y = 22; y < GROUND - 1; y++) { const x = 214 + Math.round(Math.sin(y / 9) * 1.5); P(g, '#2f6a3a', x - 1, y); P(g, '#5fb85a', x, y); P(g, '#3f8f4a', x + 1, y); if (y % 7 === 0) { P(g, '#7fd06a', x + 2, y, 2, 2); P(g, '#7fd06a', x - 3, y + 3, 2, 2); } }
          blob(g, [[34, 122, 7], [4, 122, 7]], T('#7a5238'), { dither: .05 });
          for (let x = 2; x <= 64; x++) for (let k = 0; k < 12; k++) { const d = Math.abs(k - 6) / 6, c = k === 0 || k === 11 ? '#3a2416' : d > .7 ? '#5d3c26' : d > .35 ? '#7a5238' : '#94673f'; P(g, c, x, 116 + k); }
          for (let x = 66; x < 72; x++) for (let k = 0; k < 12; k++) { const d = Math.hypot(x - 66, k - 5.5); if (d < 6) P(g, d > 5 ? '#3a2416' : d > 3.5 ? '#c99a5b' : d > 2 ? '#a87a40' : '#c99a5b', x, 116 + k); }
          for (let x = 2; x <= 64; x++) { P(g, '#4f9c5a', x, 115); if (x % 3) P(g, '#6cc35a', x, 114); if (x % 5 === 0) P(g, '#3f8a4a', x, 128); }
          ladder(g, 42, 128, GROUND - 1);
          for (const [x, c, s] of [[24, '#7fe8ff', 4], [86, '#ff9ad6', 3], [176, '#b9a0ef', 4], [248, '#7fe8ff', 3]]) {
            g.fillStyle = 'rgba(200,255,255,.12)'; disc(g, x, GROUND - s - 3, s + 6, 'rgba(200,255,255,.1)');
            trunk(g, x - 1, GROUND - s - 1, GROUND - 1, 3, T('#e6ddc8'));
            blob(g, [[x, GROUND - s - 2, s + 1.5]], T(c), { cut: (X, Y) => Y > GROUND - s - 1 });
          }
          ground(g, { top: '#4f9c5a', face: '#4b3b33', seed: 8 });
        }),
        (g, t) => particles('firefly', t, g),
      ],
    }),
    scene({
      id: 'sky', name: 'Cloud Garden', region: 'Sky Isles', layers: [
        still(g => {
          sky(g, ['#a68ce6', '#c4abf0', '#efbedc', '#fde0cf'], 0, SH);
          const bands = ['#ff9eb5', '#ffc48a', '#fff09a', '#a8ecb0', '#9fd2ff', '#c6a8ff'];
          for (let y = 30; y < 170; y++) for (let x = 0; x < SW; x++) {
            const d = Math.hypot(x - 128, y - 200), k = Math.floor((d - 120) / 4);
            if (k >= 0 && k < 6 && ((x + y) & 1)) P(g, bands[5 - k], x, y);
          }
          blob(g, [[10, 162, 22], [44, 158, 18], [80, 166, 20], [128, 170, 22], [172, 164, 20], [214, 160, 22], [250, 166, 20]], PINKCLOUD, { line: false, dither: .25 });
        }),
        (g, t) => { twinkle(g, t, 30, 5, 90); clouds(g, t, [[10, 40, 34, 2.4], [140, 26, 26, 1.5], [70, 96, 20, 3], [200, 76, 24, 2]], PINKCLOUD, 'sc'); },
        still(g => {
          blob(g, [[198, 104, 10], [214, 98, 12], [232, 102, 11], [248, 106, 9]], PINKCLOUD, { cut: (X, Y) => Y > 108, dither: .2 });
          box(g, 236, 70, 238, 98, T('#f2c14e', 'metal')); disc(g, 237, 66, 4, '#fff6c2'); disc(g, 237, 66, 2.5, '#ffffff');
          for (let y = 110; y < GROUND - 2; y++) { P(g, '#f7d34c', 210, y); P(g, '#fff6b0', 211, y); P(g, '#d9a030', 212, y); if (y % 6 === 0) P(g, '#f7a8c4', 209, y, 5, 2); }
          for (const x of [22, 236]) { box(g, x - 1, GROUND - 46, x + 1, GROUND, T('#f2c14e', 'metal')); disc(g, x, GROUND - 48, 3, '#f7d34c'); P(g, '#fff6c2', x - 1, GROUND - 50); }
          for (let x = 22; x < 236; x++) { const y = GROUND - 44 + Math.round(Math.cosh((x - 129) / 60) * 3) - 3; if (x > 64 && x < 192) continue; P(g, '#f7a8c4', x, y, 1, 2); }
          blob(g, Array.from({ length: 18 }, (_, i) => [i * 15 - 4, GROUND + 6 + (i % 2) * 3, 12 + (i % 3) * 2]), PINKCLOUD, { line: '#d9c4ea', dither: .2 });
          P(g, '#f3e6fa', 0, GROUND + 14, SW, SH - GROUND - 14);
        }),
        (g, t) => particles('petal', t, g),
      ],
    }),
    scene({
      id: 'snow', name: 'Snowy Peak', region: 'Frostvale', layers: [
        still(g => {
          sky(g, ['#4a77c2', '#729cd8', '#a3c3ea', '#d9e8f7'], 0, GROUND);
          for (const [cx, top, w] of [[40, 70, 70], [150, 50, 92], [236, 78, 60]]) mountain(g, cx, top, w, GROUND - 14, '#dbe6f5', '#a9bddb', ['#ffffff', '#e2ecf8'], '#8aa2c8');
          for (const [cx, top, w] of [[96, 104, 60], [206, 112, 56]]) mountain(g, cx, top, w, GROUND - 6, '#b6c9e6', '#8ea7cf', ['#f4f8fd', '#d3e1f2'], '#6f8ab6');
        }),
        (g, t) => { particles('snow', t * .55, g); },
        still(g => {
          for (const [x, h] of [[12, 44], [34, 34], [222, 30], [246, 46]]) pine(g, x, GROUND - 1, h);
          platform(g, 184, 252, 104, { grass: '#f4f8fd', dirt: '#9fbbe0', stone: '#d9e8f7' });
          for (let x = 188; x < 250; x += 5) { const h = 3 + (x * 7) % 6; for (let k = 0; k < h; k++) P(g, k > h - 2 ? '#ffffff' : '#bfe0ff', x + (k > h / 2 ? 1 : 0), 118 + k, k < h / 2 ? 2 : 1, 1); }
          rope(g, 198, 112, GROUND - 3);
          blob(g, [[70, GROUND - 7, 8]], T('#ffffff'), { line: '#9fb8da' }); blob(g, [[70, GROUND - 20, 6]], T('#ffffff'), { line: '#9fb8da' });
          P(g, '#2b2633', 68, GROUND - 22, 1, 1); P(g, '#2b2633', 72, GROUND - 22, 1, 1); P(g, '#f08a3c', 70, GROUND - 20, 3, 1);
          P(g, '#e0475a', 64, GROUND - 15, 13, 2); P(g, '#e0475a', 74, GROUND - 13, 2, 5);
          P(g, '#6b4a3a', 59, GROUND - 14, 4, 1); P(g, '#6b4a3a', 78, GROUND - 15, 4, 1);
          ground(g, { top: '#f4f8fd', face: '#c6dbf2', face2: '#b5cdea', bricks: true, seed: 9 });
        }),
        (g, t) => particles('snow', t, g),
      ],
    }),
    scene({
      id: 'toy', name: 'Toy Town', region: 'Toybox Bay', layers: [
        still(g => {
          sky(g, ['#fcdcec', '#fbe9d9', '#f6f0c6'], 0, GROUND);
          const cols = ['#8cc8f2', '#f7a8c4', '#f5d04a', '#8fe0b8', '#b9a0ef'];
          [[0, 98, 3, 9], [202, 84, 3, 10], [232, 116, 2, 7]].forEach(([x, y, cw, rows], i) => {
            for (let r = 0; r < rows; r++) for (let c = 0; c < cw; c++) {
              const bx = x + c * 10, by = y + r * 10, col = cols[(i + r * 2 + c) % 5];
              box(g, bx, by, bx + 9, by + 9, T(col));
              P(g, T(col)[5], bx + 4, by + 3, 2, 4);
            }
          });
          const tw = T('#e0475a');
          box(g, 178, 46, 196, 140, tw); P(g, tw[5], 194, 48, 1, 90);
          disc(g, 187, 64, 7, '#3a2a48'); disc(g, 187, 64, 6, '#fffaf0');
          for (let y = 0; y < 14; y++) P(g, y < 2 ? '#24357a' : '#3f6fd8', 187 - y, 32 + y, y * 2 + 1, 1);
          P(g, '#f7d34c', 186, 28, 3, 4);
        }),
        (g, t) => {
          const a = t / 1000, b = t / 12000;
          P(g, '#34303d', 186, 63, 2, 2);
          for (let k = 1; k < 5; k++) P(g, '#34303d', 187 + Math.round(Math.cos(a) * k), 64 + Math.round(Math.sin(a) * k));
          for (let k = 1; k < 4; k++) P(g, '#e0475a', 187 + Math.round(Math.cos(b) * k), 64 + Math.round(Math.sin(b) * k));
          const r = rng(4);
          for (let i = 0; i < 5; i++) {
            const x0 = r() * SW, sp = .5 + r() * .5, c = ['#e0475a', '#3f6fd8', '#f5d04a', '#8fe0b8', '#f7a8c4'][i];
            const y = SH - ((t / 50 * sp + i * 60) % (SH + 40)), x = (x0 + Math.sin(y / 20 + i) * 6) | 0;
            disc(g, x, y, 4, c); P(g, '#ffffff', x - 2, (y | 0) - 2, 1, 2); P(g, 'rgba(60,40,60,.5)', x, (y | 0) + 4, 1, 10);
          }
        },
        still(g => {
          const cols = ['#f5d04a', '#8cc8f2', '#f7a8c4', '#8fe0b8'];
          for (let c = 0; c < 6; c++) box(g, 2 + c * 10, 120, 11 + c * 10, 129, T(cols[c % 4]));
          ladder(g, 40, 130, GROUND - 1);
          for (let x = 0; x < SW; x += 16) { const t = T((x / 16) % 2 ? '#f7f3f8' : '#e0475a'); box(g, x, GROUND - 2, x + 15, GROUND + 9, t); box(g, x + 8 - ((x / 16) % 2) * 16, GROUND + 10, x + 23 - ((x / 16) % 2) * 16, SH, T((x / 16) % 2 ? '#e0475a' : '#f7f3f8')); }
          shadowBand(g, GROUND + 10, SH, .25);
        }),
      ],
    }),
    scene({
      id: 'night', name: 'Lantern Market', region: 'Moonlit Harbor', layers: [
        still(g => {
          sky(g, ['#120f34', '#221d56', '#3a2c74', '#664185'], 0, GROUND);
          disc(g, 198, 30, 14, 'rgba(253,241,196,.12)'); disc(g, 198, 30, 10, '#fdf1c4'); disc(g, 198, 30, 10, '#fdf1c4');
          for (const [x, y, r] of [[194, 27, 2], [202, 33, 1.5], [196, 35, 1]]) disc(g, x, y, r, '#e6d6a0');
          const r = rng(9);
          for (let x = 0; x < SW;) { const w = 14 + r() * 22 | 0, h = 26 + r() * 44 | 0; P(g, '#1e1844', x, GROUND - 30 - h, w, h + 30); for (let k = 0; k < 4; k++) if (r() < .6) P(g, '#f5d04a', x + 3 + (r() * (w - 6) | 0), GROUND - 26 - (r() * h | 0), 2, 2); x += w; }
        }),
        (g, t) => twinkle(g, t, 40, 3, 110),
        still(g => {
          const wall = T('#3b2c55'), roof = T('#b8424a'), wood = T('#8a5a3c');
          for (const [x0, x1, top] of [[0, 52, 120], [200, 256, 104]]) {
            box(g, x0, top, x1, GROUND, wall);
            for (let x = x0 - 4, k = 0; x < x1 + 4; x += 6, k++) box(g, x, top - 8 + (k % 2), x + 6, top + 1, roof);
            for (let wx = x0 + 6; wx < x1 - 8; wx += 16) { box(g, wx, top + 14, wx + 9, top + 26, T('#f5c84a')); P(g, '#c98a2a', wx + 4, top + 15, 1, 11); P(g, '#c98a2a', wx + 1, top + 20, 8, 1); }
          }
          platform(g, 196, 254, 100, { grass: '#9a6a43', dirt: '#5d3c26', stone: '#7a5238', depth: 6 });
          for (let x = 198; x < 254; x += 6) box(g, x, 90, x + 1, 99, wood);
          P(g, wood[6], 196, 89, 58, 1); P(g, wood[2], 196, 90, 58, 1);
          ladder(g, 204, 106, GROUND - 1);
          for (const [x0, cols] of [[56, ['#e0475a', '#fff6e8']], [150, ['#3f6fd8', '#fff6e8']]]) {
            box(g, x0, GROUND - 22, x0 + 40, GROUND, wood, { grain: true });
            for (let x = x0 - 3; x < x0 + 43; x++) { const c = cols[Math.floor((x - x0 + 3) / 5) % 2]; P(g, c, x, GROUND - 34, 1, 8); P(g, ((x - x0) % 5) < 2 ? c : 'rgba(0,0,0,0)', x, GROUND - 26, 1, 2); }
            P(g, '#2a1838', x0 - 3, GROUND - 35, 47, 1);
            for (const [k, c] of [[6, '#f08a3c'], [14, '#e0475a'], [24, '#f5d04a'], [32, '#8fe0b8']]) { disc(g, x0 + k, GROUND - 25, 3, c); P(g, '#ffffff', x0 + k - 1, GROUND - 27); }
          }
          ground(g, { top: '#6b5a8f', face: '#3b2c55', face2: '#33264a', bricks: true, seed: 6 });
        }),
        (g, t) => {
          for (let x = 0; x < SW; x++) {
            const y = 44 + Math.round(Math.cosh((x - 128) / 90) * 6) - 6;
            P(g, '#140f2e', x, y);
            if (x % 24 === 12) {
              const sw = Math.round(Math.sin(t / 700 + x) * 1);
              g.fillStyle = 'rgba(255,200,120,.16)'; g.fillRect(x - 6 + sw, y, 13, 16);
              P(g, '#5a1420', x - 3 + sw, y + 1, 7, 1); P(g, '#e0475a', x - 3 + sw, y + 2, 7, 8); P(g, '#ff8a8a', x - 2 + sw, y + 3, 1, 6);
              P(g, '#f5d04a', x - 1 + sw, y + 4, 3, 4); P(g, '#5a1420', x - 3 + sw, y + 10, 7, 1); P(g, '#f5d04a', x + sw, y + 11, 1, 2);
            }
          }
        },
      ],
    }),
    scene({
      id: 'studio', name: 'Sprite Studio', region: 'Lunaria', layers: [
        still(g => {
          P(g, '#ffffff', 0, 0, SW, SH);
          P(g, '#e7e5ee', 0, 0, 1, 1);
          for (let x = 0; x < SW; x += 12) P(g, '#e4e2ea', x, 0, 1, SH);
          for (let y = 4; y < SH; y += 12) P(g, '#e4e2ea', 0, y, SW, 1);
          P(g, '#efedf3', 0, GROUND, SW, SH - GROUND); P(g, '#d4d1dc', 0, GROUND, SW, 1);
        }),
      ],
    }),
  ];
})();
