// Pixie Closet — pixel-art map backgrounds for the stage (SW x SH logical pixels).
const SW = 256, SH = 208, GROUND = 184;

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function bands(g, cols, y0, y1) { // dithered vertical gradient
  const n = cols.length - 1;
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / (y1 - y0) * n, i = Math.min(n - 1, Math.floor(t)), f = t - i;
    for (let x = 0; x < SW; x += 2) {
      const dith = ((x >> 1) + y) % 2 === 0 ? 0.25 : -0.25;
      g.fillStyle = f + dith > 0.5 ? cols[i + 1] : cols[i];
      g.fillRect(x, y, 2, 1);
    }
  }
}
function cloud(g, x, y, s, c, sh) {
  g.fillStyle = sh; [[0, 4, 22, 6], [4, 0, 12, 6], [14, 2, 10, 6]].forEach(([a, b, w, h]) => g.fillRect(x + a * s, y + b * s + 2, w * s, h * s));
  g.fillStyle = c; [[0, 4, 22, 5], [4, 0, 12, 6], [14, 2, 10, 6]].forEach(([a, b, w, h]) => g.fillRect(x + a * s, y + b * s, w * s, h * s));
}
function hills(g, y, amp, per, c, phase = 0) {
  g.fillStyle = c;
  for (let x = 0; x < SW; x++) { const h = Math.round(y - amp * (Math.sin((x + phase) / per) * .6 + Math.sin((x + phase) / (per * .43)) * .4)); g.fillRect(x, h, 1, SH - h); }
}
function groundStrip(g, top, side, dark, pattern) {
  g.fillStyle = side; g.fillRect(0, GROUND, SW, SH - GROUND);
  g.fillStyle = dark; for (let x = 0; x < SW; x += 8) for (let y = GROUND + 8; y < SH; y += 8) if (pattern(x, y)) g.fillRect(x + ((y >> 3) % 2) * 4, y, 3, 2);
  g.fillStyle = top; g.fillRect(0, GROUND - 2, SW, 7);
  for (let x = 0; x < SW; x += 3) g.fillRect(x, GROUND - 3 - ((x * 7) % 3 === 0 ? 1 : 0), 2, 2);
  g.fillStyle = dark; g.fillRect(0, GROUND + 5, SW, 1);
}
function mushroomHouse(g, x, y, cap, s = 1) {
  g.fillStyle = '#f3e3c6'; g.fillRect(x - 7 * s, y - 14 * s, 14 * s, 14 * s);
  g.fillStyle = '#8a5a3c'; g.fillRect(x - 3 * s, y - 8 * s, 6 * s, 8 * s);
  g.fillStyle = '#6fb7e0'; g.fillRect(x + 3 * s, y - 12 * s, 3 * s, 3 * s);
  g.fillStyle = cap;
  for (let r = 0; r < 12 * s; r++) { const w = Math.round(Math.sqrt(1 - Math.pow(1 - r / (12 * s), 2)) * 15 * s); g.fillRect(x - w, y - 14 * s - 12 * s + r, w * 2, 1); }
  g.fillStyle = '#fff6ea'; g.fillRect(x - 8 * s, y - 22 * s, 3 * s, 3 * s); g.fillRect(x + 4 * s, y - 24 * s, 4 * s, 3 * s); g.fillRect(x + 10 * s, y - 18 * s, 2 * s, 2 * s);
}
function star(g, x, y, c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); }

const PARTICLES = [];
function particles(kind, t, g) {
  const r = rng(7);
  const n = kind === 'leaf' ? 14 : kind === 'snow' ? 46 : kind === 'firefly' ? 18 : kind === 'petal' ? 18 : 0;
  for (let i = 0; i < n; i++) {
    const sp = .4 + r() * .6, x0 = r() * SW, ph = r() * 1000;
    if (kind === 'firefly') {
      const x = (x0 + Math.sin((t / 1400 + ph) * sp) * 18 + SW) % SW, y = 60 + r() * 110 + Math.cos((t / 1100 + ph)) * 10;
      const on = Math.sin(t / 400 + ph) > -.2; if (!on) continue;
      g.fillStyle = '#f9f7a0'; g.fillRect(x | 0, y | 0, 2, 2); g.fillStyle = 'rgba(249,247,160,.25)'; g.fillRect((x | 0) - 1, (y | 0) - 1, 4, 4);
      continue;
    }
    const y = ((t / 40) * sp + ph) % (SH + 20) - 10, x = (x0 + Math.sin(y / 18 + ph) * 8 + (kind === 'snow' ? 0 : y * .3)) % SW;
    if (kind === 'snow') { g.fillStyle = '#ffffff'; g.fillRect(x | 0, y | 0, sp > .7 ? 2 : 1, sp > .7 ? 2 : 1); }
    else if (kind === 'leaf') { g.fillStyle = i % 3 ? '#f08a3c' : '#e0475a'; g.fillRect(x | 0, y | 0, 3, 2); g.fillRect((x | 0) + 1, (y | 0) - 1, 1, 4); }
    else { g.fillStyle = i % 2 ? '#f7c3d6' : '#fde4ef'; g.fillRect(x | 0, y | 0, 2, 2); g.fillRect((x | 0) + 1, (y | 0) + 1, 1, 1); }
  }
}

const SCENES = [
  {
    id: 'meadow', name: 'Mushroom Meadow', draw(g, t) {
      bands(g, ['#7cc6f2', '#9fd7f5', '#c9ecf7', '#eaf7f1'], 0, GROUND);
      g.fillStyle = '#fff4b8'; g.fillRect(206, 18, 16, 16); g.fillStyle = '#ffe680'; g.fillRect(208, 20, 12, 12);
      [[20, 24, 1], [120, 40, 1], [190, 62, 1]].forEach(([x, y, s], i) => cloud(g, ((x + t / (90 + i * 30)) % (SW + 60)) - 40, y, s, '#ffffff', '#d7ecf7'));
      hills(g, 140, 10, 30, '#a7dc8f', 0); hills(g, 160, 8, 22, '#7ec46d', 40);
      mushroomHouse(g, 40, 170, '#f08a3c'); mushroomHouse(g, 214, 172, '#e0475a', 1);
      groundStrip(g, '#6cc35a', '#b0794a', '#94603a', (x, y) => (x * 3 + y) % 5 === 0);
      particles('leaf', t, g);
    },
  },
  {
    id: 'forest', name: 'Fairy Forest', draw(g, t) {
      bands(g, ['#173a3f', '#1f5450', '#2c6b5a', '#3c7f5e'], 0, GROUND);
      const r = rng(3);
      for (let i = 0; i < 9; i++) { const x = r() * SW | 0, w = 8 + r() * 10 | 0; g.fillStyle = i % 2 ? '#22433d' : '#2a4f45'; g.fillRect(x, 0, w, GROUND); g.fillStyle = '#1b3934'; g.fillRect(x + w - 2, 0, 2, GROUND); }
      g.fillStyle = '#3f8a5b'; for (let x = 0; x < SW; x += 6) { const h = 16 + Math.sin(x / 9) * 6; g.fillRect(x, 0, 6, h); }
      for (const [x, c] of [[30, '#f7a8c4'], [90, '#b9a0ef'], [180, '#8fe0b8'], [232, '#f5d04a']]) { g.fillStyle = '#2e6b45'; g.fillRect(x, GROUND - 10, 1, 8); g.fillStyle = c; g.fillRect(x - 2, GROUND - 13, 5, 4); }
      groundStrip(g, '#4f9c5a', '#4b3b33', '#3b2e29', (x, y) => (x + y * 2) % 7 === 0);
      particles('firefly', t, g);
    },
  },
  {
    id: 'sky', name: 'Cloud Garden', draw(g, t) {
      bands(g, ['#b9a0ef', '#d3b8f2', '#f7c3d6', '#fde4d2'], 0, SH);
      for (let i = 0; i < 26; i++) star(g, (i * 53) % SW, (i * 29) % 90, '#fff');
      [[10, 30, 1], [140, 20, 2], [60, 90, 1], [200, 110, 1]].forEach(([x, y, s], i) => cloud(g, ((x + t / (120 + i * 40)) % (SW + 60)) - 40, y, s, '#fff7fb', '#e6d2f2'));
      g.fillStyle = '#f2c14e'; g.fillRect(24, 120, 2, 40); g.fillRect(230, 110, 2, 50);
      g.fillStyle = '#e6d2f2'; g.fillRect(0, GROUND + 2, SW, SH);
      g.fillStyle = '#ffffff'; for (let x = -8; x < SW; x += 16) { g.fillRect(x, GROUND - 4, 20, 10); g.fillRect(x + 4, GROUND - 8, 12, 6); }
      g.fillStyle = '#f3e6fa'; g.fillRect(0, GROUND + 6, SW, 3);
      particles('petal', t, g);
    },
  },
  {
    id: 'snow', name: 'Snowy Peak', draw(g, t) {
      bands(g, ['#5d86c9', '#7fa7dd', '#a9c8ec', '#dce9f7'], 0, GROUND);
      g.fillStyle = '#c3d3ea';
      for (const [cx, h, w] of [[50, 90, 70], [150, 110, 90], [230, 80, 60]]) for (let y = 0; y < h; y++) { const hw = y * w / h; g.fillRect(cx - hw, GROUND - 20 - h + y, hw * 2, 1); }
      g.fillStyle = '#ffffff';
      for (const [cx, h, w] of [[50, 90, 70], [150, 110, 90], [230, 80, 60]]) for (let y = 0; y < h * .3; y++) { const hw = y * w / h; g.fillRect(cx - hw, GROUND - 20 - h + y, hw * 2, 1); }
      for (const x of [20, 210]) { g.fillStyle = '#2f6a5c'; for (let y = 0; y < 34; y++) { const hw = (y % 12) * .8 + y * .25; g.fillRect(x - hw, GROUND - 40 + y, hw * 2, 1); } g.fillStyle = '#6b4a3a'; g.fillRect(x - 2, GROUND - 6, 4, 6); }
      groundStrip(g, '#ffffff', '#cfe0f3', '#b3c9e6', (x, y) => (x + y) % 6 === 0);
      particles('snow', t, g);
    },
  },
  {
    id: 'toy', name: 'Toy Town', draw(g, t) {
      bands(g, ['#fde4ef', '#fbefd9', '#f6f2c9'], 0, GROUND);
      const cols = ['#8cc8f2', '#f7a8c4', '#f5d04a', '#8fe0b8', '#b9a0ef'];
      [[8, 120, 30, 64], [44, 140, 24, 44], [190, 100, 26, 84], [222, 132, 30, 52]].forEach(([x, y, w, h], i) => {
        for (let yy = y; yy < y + h; yy += 10) for (let xx = x; xx < x + w; xx += 10) { g.fillStyle = cols[(i + (xx >> 3) + (yy >> 3)) % 5]; g.fillRect(xx, yy, 9, 9); }
      });
      g.fillStyle = '#e0475a'; g.fillRect(120, 60, 18, 70); g.fillStyle = '#fff'; g.fillRect(122, 66, 14, 14);
      g.fillStyle = '#34303d'; const a = t / 1000; g.fillRect(128, 72, 2, 2); g.fillRect(129 + Math.round(Math.cos(a) * 4), 73 + Math.round(Math.sin(a) * 4), 1, 1);
      g.fillStyle = '#3f6fd8'; for (let y = 0; y < 12; y++) g.fillRect(129 - y, 48 + y, y * 2 + 1, 1);
      for (let x = 0; x < SW; x += 16) { g.fillStyle = (x / 16) % 2 ? '#f7f3f8' : '#e0475a'; g.fillRect(x, GROUND - 2, 16, 26); }
      g.fillStyle = '#c03a4b'; g.fillRect(0, GROUND + 5, SW, 1);
    },
  },
  {
    id: 'night', name: 'Lantern Market', draw(g, t) {
      bands(g, ['#1b1840', '#2c2463', '#4a3480', '#7a4a8f'], 0, GROUND);
      for (let i = 0; i < 40; i++) if (Math.sin(t / 600 + i * 3) > -.6) star(g, (i * 67) % SW, (i * 37) % 120, i % 5 ? '#e8e2ff' : '#fff3a6');
      g.fillStyle = '#fdf1c4'; g.fillRect(30, 20, 14, 14); g.fillStyle = '#1b1840'; g.fillRect(36, 18, 12, 12);
      g.fillStyle = '#2a2050'; for (const [x, w, h] of [[0, 40, 50], [36, 30, 70], [170, 40, 60], [206, 50, 44]]) g.fillRect(x, GROUND - h, w, h);
      g.fillStyle = '#f5d04a'; for (const [x, y] of [[8, 150], [20, 150], [44, 130], [56, 140], [180, 140], [192, 140], [216, 154], [236, 154]]) g.fillRect(x, y, 4, 5);
      g.strokeStyle = '#140f2e';
      for (let x = 0; x < SW; x++) { const y = 46 + Math.round(Math.cosh((x - 128) / 90) * 6); g.fillStyle = '#140f2e'; g.fillRect(x, y, 1, 1); if (x % 24 === 12) { const sw = Math.round(Math.sin(t / 700 + x) * 1); g.fillStyle = '#e0475a'; g.fillRect(x - 3 + sw, y + 2, 7, 8); g.fillStyle = '#f5d04a'; g.fillRect(x - 1 + sw, y + 4, 3, 4); } }
      groundStrip(g, '#6b4a8f', '#3b2c55', '#2c2142', (x, y) => (x + y) % 4 === 0);
    },
  },
  {
    id: 'studio', name: 'Sprite Studio', draw(g) {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, SW, SH);
      g.fillStyle = '#e4e2ea'; for (let x = 0; x < SW; x += 12) g.fillRect(x, 0, 1, SH); for (let y = 4; y < SH; y += 12) g.fillRect(0, y, SW, 1);
      g.fillStyle = '#efedf3'; g.fillRect(0, GROUND, SW, SH - GROUND); g.fillStyle = '#d4d1dc'; g.fillRect(0, GROUND, SW, 1);
    },
  },
];
