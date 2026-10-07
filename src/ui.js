// Pixie Closet — UI: a 2000s MMO client shell (windows, HUD, chat, tooltips) around the stage loop.
(function () {
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.floor(n).toLocaleString('en-US');
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const mem = {}; // session mirror, so saving still works when storage is blocked
  const store = {
    get(k) { if (k in mem) return mem[k]; try { return JSON.parse(localStorage.getItem('pixie.' + k)); } catch (e) { return null; } },
    set(k, v) { mem[k] = v == null ? null : JSON.parse(JSON.stringify(v)); try { localStorage.setItem('pixie.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  // ---------- categories: built from ITEMS so new ones get a tab and a slot ----------
  const CAT_INFO = {
    hair: { tab: 'Hair', slot: 'Hair', label: 'Hair' },
    hat: { tab: 'Cap', slot: 'Cap', label: 'Cap' },
    face: { tab: 'Face', slot: 'Face Acc', label: 'Face Accessory' },
    top: { tab: 'Top', slot: 'Top', label: 'Top' },
    bottom: { tab: 'Bottom', slot: 'Bottom', label: 'Bottom' },
    dress: { tab: 'Overall', slot: 'Overall', label: 'Overall' },
    shoes: { tab: 'Shoes', slot: 'Shoes', label: 'Shoes' },
    back: { tab: 'Cape', slot: 'Cape', label: 'Cape' },
    hand: { tab: 'Weapon', slot: 'Weapon', label: 'Weapon' },
  };
  const ORDER = ['hair', 'hat', 'face', 'top', 'bottom', 'dress', 'shoes', 'back', 'hand'];
  const present = new Set(ITEMS.map(i => i.cat));
  const CATS = [...ORDER.filter(c => present.has(c)), ...[...present].filter(c => !ORDER.includes(c))];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const info = c => CAT_INFO[c] || { tab: cap(c), slot: cap(c), label: cap(c) };
  const itemsOf = c => ITEMS.filter(i => i.cat === c);
  const TABS = [{ id: 'body', label: 'Body' }, ...CATS.map(c => ({ id: c, label: info(c).tab }))];
  const DIRS = [{ v: 'front', flip: false, label: 'Front' }, { v: 'side', flip: true, label: 'Right' }, { v: 'back', flip: false, label: 'Back' }, { v: 'side', flip: false, label: 'Left' }];
  const WORLD = 'Lunaria';

  const PRESETS = [
    { name: 'Beginner', s: { hair: ['messy', '#7a4a2e'], top: ['maple'], bottom: ['shorts', '#4d74b8'], shoes: ['sneakers'] } },
    { name: 'Warrior', s: { hair: ['spiky', '#c8364a'], top: ['armor'], bottom: ['joggers', '#5a5566'], shoes: ['knight'], hat: ['viking'], back: ['cape'], hand: ['sword'] } },
    { name: 'Magician', s: { hair: ['long', '#cbb4f0'], dress: ['witch'], shoes: ['mary'], hat: ['witchhat'], hand: ['staff'], face: ['roundglass', '#f2c14e'] } },
    { name: 'Bowman', s: { hair: ['pony', '#a35d36'], top: ['tunic'], bottom: ['cargo', '#7a6a4a'], shoes: ['boots'], back: ['quiver'], hand: ['huntbow'], hat: ['flowers', '#f7f3f8'] } },
    { name: 'Thief', s: { hair: ['wolf', '#2b2633'], top: ['hoodie', '#34303d'], bottom: ['joggers', '#2c3a6b'], shoes: ['boots', '#34303d'], face: ['ninja'], hand: ['dagger'], hat: ['bandana', '#7a4bc4'] } },
    { name: 'Pirate', s: { hair: ['hime', '#c8364a'], dress: ['pirate'], shoes: ['boots', '#34303d'], hat: ['tricorn'], hand: ['cutlass'], face: ['patch'] } },
    { name: 'Princess', s: { hair: ['curls', '#f0cf6e'], dress: ['gown'], shoes: ['mary', '#f7f3f8'], hat: ['crown'], hand: ['bouquet'] } },
    { name: 'Magical Girl', s: { hair: ['twintail', '#f49ac1'], dress: ['magical'], shoes: ['stockings', '#f7a8c4'], hat: ['bow', '#f7a8c4'], back: ['fairywings'], hand: ['wand'] } },
    { name: 'Cozy Day', s: { hair: ['buns', '#4a2e24'], top: ['sweater', '#f6e3b8'], bottom: ['maxi', '#8a5a3c'], shoes: ['bunnyslip'], hat: ['phones'], hand: ['plush'] } },
    { name: 'Mushroom Kid', s: { hair: ['puff', '#d8743a'], top: ['tee', '#f7f3f8'], bottom: ['overalls', '#e0475a'], shoes: ['rain'], hat: ['mushroom'], hand: ['leafshield'] } },
  ];

  let state = defaultState();
  let prog = defaultProg();
  let ui = { open: { equip: true, stats: true, inv: true, ward: true }, ward: 'jobs', chat: 'all' };
  let dir = 0, tab = 'hair', sceneIdx = 0, bubbleUntil = 0, mpFrac = 1;
  function defaultState() { return fromPreset(PRESETS[0], { name: 'Pixie', skin: 0, eyes: 0 }); }
  function fromPreset(p, base) {
    const equip = {};
    for (const [cat, [id, color]] of Object.entries(p.s)) if (ITEM_BY_ID[id]) equip[cat] = { id, color: color || null };
    return { name: base.name, skin: base.skin, eyes: base.eyes, job: p.name, equip };
  }
  function sanitize(s) {
    const equip = {};
    for (const [c, v] of Object.entries((s && s.equip) || {})) if (v && ITEM_BY_ID[v.id] && ITEM_BY_ID[v.id].cat === c) equip[c] = { id: v.id, color: typeof v.color === 'string' ? v.color : null };
    return {
      name: String((s && s.name) || 'Pixie').slice(0, 14), job: String((s && s.job) || 'Beginner').slice(0, 20), equip,
      skin: clampN(Math.floor(+(s && s.skin)) || 0, 0, SKIN_TONES.length - 1), eyes: clampN(Math.floor(+(s && s.eyes)) || 0, 0, EYE_COLORS.length - 1),
    };
  }

  // ---------- progression: level, EXP, mesos, fame and the creation dice ----------
  const STATS = ['STR', 'DEX', 'INT', 'LUK'];
  const JOBS = ['Beginner', 'Warrior', 'Magician', 'Bowman', 'Thief', 'Pirate'];
  const need = lv => 15 + lv * 10 + lv * lv * 2;
  function roll() { // like the old creation dice: four stats from 4 to 13 that add up to 25
    const s = [4, 4, 4, 4]; let left = 9;
    while (left > 0) { const i = Math.floor(Math.random() * 4); if (s[i] < 13) { s[i]++; left--; } }
    return { STR: s[0], DEX: s[1], INT: s[2], LUK: s[3] };
  }
  function defaultProg() { return { lv: 1, exp: 0, mesos: 2500, fame: 0, ap: 0, base: roll(), add: { STR: 0, DEX: 0, INT: 0, LUK: 0 }, ch: 3 }; }
  function sanitizeProg(p) {
    const d = defaultProg(), n = (v, a, b, f) => Number.isFinite(+v) ? clampN(Math.floor(+v), a, b) : f;
    const stats = (o, f) => Object.fromEntries(STATS.map(k => [k, n(o && o[k], 0, 999, f[k])]));
    return { lv: n(p.lv, 1, 200, 1), exp: n(p.exp, 0, 1e9, 0), mesos: n(p.mesos, 0, 9e9, d.mesos), fame: n(p.fame, 0, 1e6, 0), ap: n(p.ap, 0, 1e4, 0),
      base: stats(p.base, d.base), add: stats(p.add, d.add), ch: n(p.ch, 1, 20, 3) };
  }

  // ---------- deterministic item stats (from a hash of the id) ----------
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return h >>> 0; }
  const RARITY = [{ name: '', color: '#ffffff' }, { name: 'Rare Item', color: '#6fdcff' }, { name: 'Epic Item', color: '#d39bff' }, { name: 'Unique Item', color: '#ffcf3f' }];
  const WEAPONS = [[/cutlass|scimitar|sabre|saber|sword|blade|katana/, 'One-Handed Sword'], [/axe/, 'One-Handed Axe'], [/staff|rod/, 'Staff'], [/wand/, 'Wand'],
    [/crossbow/, 'Crossbow'], [/bow/, 'Bow'], [/dagger|knife/, 'Dagger'], [/claw/, 'Claw'], [/gun|pistol/, 'Gun'], [/shield/, 'Shield'], [/spear|lance|polearm/, 'Spear'], [/knuckle|fist/, 'Knuckle']];
  const FLAVOR = {
    hair: ['Styled at the Bellflower Hair Salon.', 'Freshly trimmed by a very nervous apprentice.', 'Holds its shape even in a Snowy Peak blizzard.', 'Smells faintly of mushroom shampoo.'],
    hat: ['Keeps the sun out of your eyes. Mostly.', 'Rumoured to raise your drop rate. It does not.', 'Fits snugly over any hairstyle.', 'A favourite of Lantern Market shopkeepers.'],
    face: ['Looks cooler than it sees.', 'Popular with mysterious strangers.', 'Adds +10 to looking thoughtful.', 'Please do not wear while sleeping.'],
    top: ['Hand-stitched in Toy Town.', 'Soft, warm and surprisingly sturdy.', 'Machine washable. Not slime proof.', 'Tailored for long days of adventure.'],
    bottom: ['Pockets deep enough for three potions.', 'Built for jumping between platforms.', 'Tough knees for kneeling at campfires.', 'Never rips on a ladder. Probably.'],
    dress: ['One piece, endless compliments.', 'Twirls beautifully on any platform.', 'Dressed for the Lantern Market festival.', 'Sewn from a single bolt of cloud silk.'],
    shoes: ['Light steps, quick jumps.', 'Squeaks a little on wooden floors.', 'Broken in on the road to Snowy Peak.', 'Laced with a little pixie dust.'],
    back: ['Flutters dramatically in any breeze.', 'Carries more than it looks like it should.', 'Makes every exit a grand exit.', 'Found snagged on a Fairy Forest branch.'],
    hand: ['Perfectly balanced. For posing.', 'Swing with confidence!', 'Polished every night before bed.', 'Handle with style.'],
  };
  const statCache = {};
  function itemStats(it) {
    if (statCache[it.id]) return statCache[it.id];
    const h = hash(it.id), g = hash(it.id + ':' + it.cat), hair = it.cat === 'hair';
    const r = g % 40, rarity = r === 0 ? 3 : r < 4 ? 2 : r < 12 ? 1 : 0;
    const reqLv = hair ? 0 : [0, 0, 5, 8, 10, 12, 15, 18, 20, 25, 30, 35, 40][h % 13];
    const jn = (h >>> 4) % 9, job = jn < 4 ? 0 : jn - 3; // 0 = every job
    const stats = [];
    if (hair) stats.push(['CHARM', 1 + (g >>> 6) % 9]);
    else {
      const n = Math.min(4, 1 + (h >>> 8) % 2 + (rarity >= 2 ? 1 : 0) + (rarity === 3 ? 1 : 0));
      const first = [(h >>> 10) % 4, 0, 2, 1, 3, 1][job];
      for (let k = 0; k < n; k++) stats.push([STATS[(first + k) % 4], 1 + ((g >>> (8 + k * 3)) % (3 + rarity * 2))]);
      stats.push(it.cat === 'hand' ? ['ATT', 8 + (h >>> 14) % 40 + rarity * 6] : ['DEF', 2 + (h >>> 14) % 24 + rarity * 5]);
    }
    const key = (it.id + ' ' + it.name).toLowerCase(), wt = WEAPONS.find(([re]) => re.test(key));
    const fl = FLAVOR[it.cat] || ['A treasured find from the Pixie Closet.'];
    return statCache[it.id] = {
      rarity, reqLv, job, stats, slots: hair ? 0 : (g >>> 20) % 8,
      type: it.cat === 'hand' ? (wt ? wt[1] : 'Novelty Weapon') : info(it.cat).label,
      speed: it.cat === 'hand' ? ['Fast', 'Normal', 'Fast', 'Slow', 'Very Fast', 'Normal'][(g >>> 3) % 6] : '',
      reqStat: job && reqLv ? [STATS[[0, 0, 2, 1, 3, 1][job]], 20 + reqLv * 2] : null,
      exp: 10 + h % 21 + rarity * 5, mesos: (5 + g % 60) * 10, flavor: fl[(h >>> 7) % fl.length],
    };
  }
  function equipBonus() {
    const b = { STR: 0, DEX: 0, INT: 0, LUK: 0, ATT: 0, DEF: 0, CHARM: 0 };
    for (const v of Object.values(state.equip)) { const it = v && ITEM_BY_ID[v.id]; if (it) for (const [k, n] of itemStats(it).stats) b[k] = (b[k] || 0) + n; }
    return b;
  }
  const statTotal = (k, b = equipBonus()) => prog.base[k] + prog.add[k] + (b[k] || 0);
  const maxHP = () => 50 + (prog.lv - 1) * 24 + statTotal('STR') * 3;
  const maxMP = () => 20 + (prog.lv - 1) * 16 + statTotal('INT') * 4;

  // ---------- pixel icons, shaded like the sprites: lit from the top-left, outlined in their own hue ----------
  const ICONS = (() => {
    const B = (x0, y0, x1, y1) => (x, y) => x > x0 && x < x1 + 1 && y > y0 && y < y1 + 1;
    const RB = (x0, y0, x1, y1) => (x, y) => B(x0, y0, x1, y1)(x, y) && !((x < x0 + 1 || x > x1) && (y < y0 + 1 || y > y1));
    const C = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    const E = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    const P = pts => (x, y) => pointInPoly(x, y, pts);
    const L = (x0, y0, x1, y1, w) => (x, y) => { const dx = x1 - x0, dy = y1 - y0, t = clampN(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(x - x0 - t * dx, y - y0 - t * dy) <= w / 2; };
    const U = (...f) => (x, y) => f.some(q => q(x, y));
    const N = (a, b) => (x, y) => a(x, y) && !b(x, y);
    const STAR = (cx, cy, R, r) => P(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d]; }));
    const px = (c, pts) => ({ px: pts.map(([x, y]) => [x, y, c]) });
    const pip = (x, y) => [[x, y, '#f0778a'], [x + 1, y, '#c0233b'], [x, y + 1, '#c0233b'], [x + 1, y + 1, '#86112a']];
    return {
      dice: [[RB(2, 2, 13, 13), '#f4f1f8'], { px: [...pip(4, 4), ...pip(10, 4), ...pip(7, 7), ...pip(4, 10), ...pip(10, 10)] }],
      wand: [[L(2.5, 13.5, 8.5, 7.5, 3.3), '#9a6440', 'leather'], [STAR(10.5, 5.5, 5.6, 2.5), '#f7d34c', 'metal'],
        px('#fff6b0', [[3, 2], [2, 3], [3, 3], [4, 3], [3, 4], [14, 11], [13, 12], [14, 12], [15, 12], [14, 13]])],
      hanger: [px('#8d96ab', [[6, 2], [7, 1], [8, 1], [9, 2], [9, 3], [8, 4], [8, 5]]), px('#eef1f7', [[7, 1]]),
        [N(P([[8, 5.4], [15.6, 11.5], [15.6, 15], [0.4, 15], [0.4, 11.5]]), P([[8, 8.7], [12.6, 12.1], [3.4, 12.1]])), '#cf8f55', 'leather']],
      camera: [[U(RB(1, 4, 14, 13), B(4, 2, 8, 4)), '#5c6480'], [C(8.5, 9, 3.7), '#6fb2f0', 'gem'], px('#ffe27a', [[11, 5], [12, 5]]), px('#d9a030', [[11, 6], [12, 6]])],
      scroll: [[B(3, 2, 12, 13), '#f6e7c4'], [U(RB(1, 1, 14, 3), RB(1, 12, 14, 14)), '#cf9a5c'], px('#a37f56', [[5, 5], [6, 5], [7, 5], [9, 5], [10, 5], [5, 7], [6, 7], [8, 7], [9, 7], [5, 9], [6, 9], [7, 9], [8, 9], [10, 9]])],
      sword: [[L(13.5, 2.5, 6.5, 9.5, 3.3), '#dfe4ee', 'metal'], [L(5.5, 10.5, 2.5, 13.5, 2.9), '#7a4a2e', 'leather'], [L(3.5, 7.5, 8.5, 12.5, 2.9), '#f2c14e', 'metal'], [C(2, 14, 1.8), '#f2c14e', 'metal']],
      bag: [[U(C(8, 10.4, 5.4), P([[5, 4], [11, 4], [10.6, 7], [5.4, 7]])), '#c68b50', 'leather'], [P([[3.6, 1.4], [12.4, 1.4], [10.6, 4.6], [5.4, 4.6]]), '#d79a5c', 'leather'],
        [B(5, 5, 10, 6), '#d8424e'], px('#ffe27a', [[8, 10], [7, 11]]), px('#f2c14e', [[8, 11], [9, 10]]), px('#b88420', [[9, 11], [8, 12]])],
      star: [[STAR(8, 8.6, 7.6, 3.3), '#f7d34c', 'metal']],
      gift: [[B(2, 7, 13, 14), '#e0475a'], [B(1, 5, 14, 8), '#f0647a'], [B(7, 5, 8, 14), '#f7d34c'], [U(E(5.2, 3.2, 2.9, 2.2), E(10.8, 3.2, 2.9, 2.2)), '#f7d34c'], px('#fff3a0', [[7, 4]]), px('#d9a030', [[8, 4]])],
      book: [[RB(2, 1, 13, 14), '#4677d8'], [B(2, 1, 4, 14), '#2f58ad'], [STAR(9, 7.5, 3.4, 1.5), '#f7d34c', 'metal']],
      gear: [[N(U(C(8, 8, 5.3), (x, y) => Math.hypot(x - 8, y - 8) < 7.5 && Math.cos(Math.atan2(y - 8, x - 8) * 8) > .3), C(8, 8, 2.1)), '#aab3c7', 'metal']],
      coin: [[C(8, 8, 6.9), '#f2c14e', 'metal'], [C(8, 8, 4.1), '#e9b23c', 'metal']],
      chest: [[B(1, 8, 14, 14), '#a8693b', 'leather'], [U(B(1, 5, 14, 8), E(7.5, 5.5, 6.6, 2.6)), '#c07c46', 'leather'], [B(1, 8, 14, 9), '#f2c14e', 'metal'], [B(6, 7, 9, 11), '#f2c14e', 'metal'], px('#5a3a10', [[7, 9], [8, 9]])],
      chat: [[U(RB(1, 2, 14, 11), P([[4, 10], [9, 10], [3, 14.6]])), '#ffffff'], px('#5d6886', [[4, 6], [5, 6], [4, 7], [5, 7], [7, 6], [8, 6], [7, 7], [8, 7], [10, 6], [11, 6], [10, 7], [11, 7]])],
      map: [[P([[1, 3], [5.5, 1], [10.5, 3], [15, 1], [15, 13], [10.5, 15], [5.5, 13], [1, 15]]), '#efd9a6'], [E(6.5, 7.5, 2.6, 2.4), '#6cbf5a'],
        px('#c4a46e', [[5, 3], [5, 5], [5, 7], [5, 9], [5, 11], [10, 4], [10, 6], [10, 8], [10, 10], [10, 12]]), px('#e0475a', [[11, 9], [13, 9], [12, 10], [11, 11], [13, 11]])],
      mush: [[RB(5, 8, 10, 14), '#f6e3b8'], [N(E(8, 8.2, 7.5, 6.6), (x, y) => y > 9.4), '#f07a3c'],
        px('#ffffff', [[5, 4], [6, 4], [5, 5], [10, 3], [11, 3], [10, 4], [12, 7], [8, 7], [3, 7]]), px('#3a2418', [[6, 11], [9, 11]]), px('#f7a8c4', [[5, 12], [10, 12]])],
      win: [[RB(1, 2, 14, 13), '#eef2f8'], [B(2, 3, 13, 5), '#6b8cbe'], px('#ffffff', [[12, 4]])],
      warn: [[P([[8, .6], [15.7, 14.6], [.3, 14.6]]), '#f7d34c'], px('#3a2418', [[7, 5], [8, 5], [7, 6], [8, 6], [7, 7], [8, 7], [7, 8], [8, 8], [7, 11], [8, 11], [7, 12], [8, 12]])],
    };
  })();
  function paintIcon(ctx, name) {
    const def = ICONS[name]; if (!def) return;
    const img = ctx.createImageData(16, 16), d = img.data;
    const put = (x, y, c) => { if (x < 0 || y < 0 || x > 15 || y > 15) return; const i = (y * 16 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
    for (const layer of def) {
      if (layer.px) { for (const [x, y, c] of layer.px) put(x, y, hexRgb(c)); continue; }
      const [test, hex, kind] = layer, r = ramp(hex, kind || 'cloth'), m = new Uint8Array(256);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) m[y * 16 + x] = test(x + .5, y + .5) ? 1 : 0;
      const at = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && m[y * 16 + x] === 1;
      let glint = null;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!at(x, y)) continue;
        if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) { put(x, y, r.line); continue; }
        const tl = !at(x - 2, y) || !at(x, y - 2) || !at(x - 1, y - 1), br = !at(x + 2, y) || !at(x, y + 2) || !at(x + 1, y + 1);
        const tl2 = !at(x - 3, y) || !at(x, y - 3), br2 = !at(x + 3, y) || !at(x, y + 3);
        const c = tl && br ? r.base : tl ? r.hi : br ? r.sh : tl2 ? r.lt : br2 ? r.base : r.base;
        put(x, y, c);
        if (tl && !br && (!glint || x + y < glint[0] + glint[1])) glint = [x, y];
      }
      if (glint && (kind === 'metal' || kind === 'gem')) put(glint[0], glint[1], r.spec);
    }
    ctx.putImageData(img, 0, 0);
  }
  function icon(name, cls = 'ico px') { const c = el('canvas', cls); c.width = c.height = 16; c.setAttribute('aria-hidden', 'true'); paintIcon(c.getContext('2d'), name); return c; }

  // ---------- render caches + a small work queue so tab switches never block ----------
  const OY = FEET_Y - VIEWS.front.h, OX = 64 - VIEWS.front.cx;
  const HEAD_CROP = [OX - 22, OY - 40, OX + 102, OY + 84], FACE_CROP = [OX + 4, OY + 28, OX + 76, OY + 70], SKIN_CROP = [OX - 2, OY - 2, OX + 82, OY + 74];
  function bufCanvas(buf) { const c = el('canvas'); c.width = CW; c.height = CH; c.getContext('2d').putImageData(new ImageData(buf, CW, CH), 0, 0); return c; }
  function bbox(buf) {
    let x0 = CW, y0 = CH, x1 = 0, y1 = 0;
    for (let i = 3; i < buf.length; i += 4) if (buf[i]) { const p = (i - 3) / 4, x = p % CW, y = p / CW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x0 > x1 ? [0, 0, CW - 1, CH - 1] : [x0, y0, x1, y1];
  }
  function fit(src, crop, W, H, pad = 2) { // crop a render and scale it into W x H (whole-number zoom when it fits)
    const [x0, y0, x1, y1] = crop, w = x1 - x0 + 1, h = y1 - y0 + 1;
    let s = Math.min((W - pad * 2) / w, (H - pad * 2) / h); if (s >= 1) s = Math.floor(s);
    const c = el('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.imageSmoothingEnabled = s < 1; x.imageSmoothingQuality = 'high';
    const dw = Math.round(w * s), dh = Math.round(h * s);
    x.drawImage(src, x0, y0, w, h, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
    return c;
  }
  const cache = new Map();
  function cached(key, make) { let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); if (cache.size > 700) cache.delete(cache.keys().next().value); } return v; }
  const withBody = it => it.cat === 'hair' || it.cat === 'hat' || it.cat === 'face';
  const rawKey = (it, color) => `raw|${it.id}|${color || ''}|${withBody(it) ? state.skin + '/' + state.eyes : ''}`;
  function rawItem(it, color) {
    return cached(rawKey(it, color), () => {
      const buf = renderCharacter('front', { skin: state.skin, eyes: state.eyes, equip: {} }, { only: { id: it.id, color }, withBody: withBody(it) });
      return { src: bufCanvas(buf), crop: withBody(it) ? (it.cat === 'face' ? FACE_CROP : HEAD_CROP) : bbox(buf) };
    });
  }
  const iconKey = (it, color, W) => `${rawKey(it, color)}|${W}`;
  function itemIcon(it, color, W) { return cached(iconKey(it, color, W), () => { const r = rawItem(it, color); return fit(r.src, r.crop, W, W); }); }
  function iconColor(it) {
    const cur = state.equip[it.cat];
    if (cur && cur.id === it.id && cur.color) return cur.color;
    if (it.cat === 'hair') return (cur && cur.color) || '#7a4a2e';
    return it.dye;
  }
  const jobs = [], hiJobs = []; let pumping = false;
  function later(fn, hi) { (hi ? hiJobs : jobs).push(fn); if (!pumping) { pumping = true; setTimeout(pump, 0); } }
  function pump() {
    const t0 = performance.now();
    while ((hiJobs.length || jobs.length) && performance.now() - t0 < 12) { const f = hiJobs.length ? hiJobs.shift() : jobs.shift(); try { f(); } catch (e) { console.warn('render failed', e); } }
    if (hiJobs.length || jobs.length) setTimeout(pump, 0); else pumping = false;
  }
  // draw a (possibly not yet rendered) picture into a canvas: instantly when cached, otherwise queued
  function paintInto(canvas, key, make, hi = true) {
    const draw = src => { if (!canvas.isConnected && canvas._queued) return; const x = canvas.getContext('2d'); x.clearRect(0, 0, canvas.width, canvas.height); x.drawImage(src, 0, 0); };
    const hit = cache.get(key);
    if (hit) { draw(hit); return; }
    canvas._queued = true;
    later(() => { if (canvas.isConnected) draw(cached(key, make)); }, hi);
  }
  function paintItem(canvas, it, color) { const W = canvas.width; paintInto(canvas, iconKey(it, color, W), () => { const r = rawItem(it, color); return fit(r.src, r.crop, W, W); }); }

  // ---------- stage ----------
  const charCanvas = document.createElement('canvas'); charCanvas.width = CW; charCanvas.height = CH;
  const cctx = charCanvas.getContext('2d');
  let cacheKey = '';
  function drawChar(view, blink) {
    const key = JSON.stringify(state.equip) + state.skin + state.eyes + view + blink;
    if (key === cacheKey) return;
    cacheKey = key;
    cctx.putImageData(new ImageData(renderCharacter(view, state, { blink }), CW, CH), 0, 0);
  }
  const view = $('view'), g = view.getContext('2d'), mini = $('mini').getContext('2d');
  g.imageSmoothingEnabled = false;
  let blinkAt = performance.now() + 2500, blinkOn = false, miniAt = 0, mpAt = 0, fxAt = -1e9;
  function frame(now) {
    const still = RM.matches, t = still ? 0 : now;
    if (now > blinkAt) { blinkOn = true; if (now > blinkAt + 140) { blinkOn = false; blinkAt = now + 2200 + Math.random() * 2800; } }
    const d = DIRS[dir];
    SCENES[sceneIdx].draw(g, t);
    if (now - miniAt > 500) { miniAt = now; drawMini(); }
    g.fillStyle = 'rgba(30,16,30,.24)';
    for (let y = 0; y < 4; y++) { const w = 26 - Math.abs(y - 1.5) * 4; g.fillRect(128 - w, GROUND - 2 + y, w * 2, 1); }
    if (!still) drawBeam(now);
    drawChar(d.v, blinkOn && d.v !== 'back');
    const bob = still ? 0 : Math.floor(now / 520) % 2;
    g.save();
    if (d.flip) { g.translate(SW, 0); g.scale(-1, 1); }
    g.drawImage(charCanvas, 64, GROUND - FEET_Y + bob);
    g.restore();
    if (bubbleUntil && now > bubbleUntil) { $('bubble').hidden = true; bubbleUntil = 0; }
    if (now - mpAt > 250) { const dt = mpAt ? now - mpAt : 0; mpAt = now; if (mpFrac < 1) { mpFrac = Math.min(1, mpFrac + dt / 1000 * .05); setBar('mp', Math.round(maxMP() * mpFrac), maxMP()); } }
    requestAnimationFrame(frame);
  }
  function drawMini() {
    const W = mini.canvas.width, H = mini.canvas.height;
    mini.imageSmoothingEnabled = true; mini.drawImage(view, 0, 0, W, H);
    mini.fillStyle = 'rgba(0,0,20,.18)'; mini.fillRect(0, 0, W, H);
    const px = Math.round(W / 2), py = Math.round(GROUND / SH * H) - 4;
    mini.fillStyle = '#000'; mini.fillRect(px - 2, py - 2, 5, 5); mini.fillStyle = '#ffe23d'; mini.fillRect(px - 1, py - 1, 3, 3);
  }
  function drawBeam(now) { // level-up pillar of light behind the character
    const k = (now - fxAt) / 2400; if (k < 0 || k > 1) return;
    const a = k < .15 ? k / .15 : 1 - (k - .15) / .85, w = 16 + Math.round(10 * Math.sin(k * Math.PI));
    for (let i = -w; i <= w; i++) { const f = 1 - Math.abs(i) / (w + 1); g.fillStyle = `rgba(255,236,140,${(a * f * f * .6).toFixed(3)})`; g.fillRect(128 + i, 0, 1, GROUND); }
    g.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    for (let s = 0; s < 16; s++) {
      const y = GROUND - 10 - ((k * 1.3 + (s * 37 % 100) / 100) % 1) * 170 | 0, x = 128 + Math.round(Math.sin(s * 2.1 + k * 7) * (8 + (s % 3) * 9));
      g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1);
    }
  }
  function levelFx() {
    fxAt = performance.now();
    const f = $('levelfx'); f.hidden = true; void f.offsetWidth; f.hidden = false;
    clearTimeout(levelFx.t); levelFx.t = setTimeout(() => { f.hidden = true; }, 2500);
  }

  function turn(step) { dir = (dir + step + DIRS.length) % DIRS.length; $('viewlbl').textContent = DIRS[dir].label; }
  $('turnL').onclick = () => turn(-1);
  $('turnR').onclick = () => turn(1);
  let dragX = null;
  $('stage').addEventListener('pointerdown', e => { if (e.target.closest('button, select, label, .minimap')) return; dragX = e.clientX; });
  window.addEventListener('pointermove', e => { if (dragX === null) return; const dx = e.clientX - dragX; if (Math.abs(dx) > 36) { turn(dx > 0 ? -1 : 1); dragX = e.clientX; } });
  window.addEventListener('pointerup', () => { dragX = null; });
  window.addEventListener('pointercancel', () => { dragX = null; });
  function bubble(msg) { const b = $('bubble'); b.textContent = msg; b.hidden = false; bubbleUntil = performance.now() + 5000; }

  // ---------- chat ----------
  const CHANNELS = [{ id: 'all', label: 'All' }, { id: 'party', label: 'Party' }, { id: 'guild', label: 'Guild' }];
  const chatLines = [];
  const showsIn = (line, chTab) => chTab === 'all' || line.ch === chTab;
  function chatP(line) { return el('p', line.cls, line.text); }
  function renderChat() {
    const box = $('chatlog'); box.innerHTML = '';
    const lines = chatLines.filter(l => showsIn(l, ui.chat));
    if (!lines.length) box.append(el('p', 'empty', `No ${ui.chat} messages yet. Pick ${ui.chat === 'all' ? 'a tab' : 'this tab'} and type below to talk here.`));
    lines.forEach(l => box.append(chatP(l)));
    box.scrollTop = box.scrollHeight;
  }
  function log(text, cls = 'sys', ch = 'sys') {
    const line = { text, cls, ch }; chatLines.push(line); if (chatLines.length > 150) chatLines.shift();
    if (!showsIn(line, ui.chat)) return;
    const box = $('chatlog'), atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.querySelector('.empty')?.remove();
    box.append(chatP(line)); while (box.childNodes.length > 150) box.firstChild.remove();
    if (atEnd) box.scrollTop = box.scrollHeight;
  }
  function setChatTab(id) {
    ui.chat = id;
    document.querySelectorAll('#ctabs .ctab').forEach(b => { const on = b.dataset.ch === id; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    const c = $('chan'); c.textContent = CHANNELS.find(x => x.id === id).label; c.className = 'chan ' + id;
    renderChat(); saveUi();
  }
  CHANNELS.forEach(c => {
    const b = el('button', 'ctab ' + c.id, c.label); b.type = 'button'; b.id = 'ctab-' + c.id; b.dataset.ch = c.id;
    b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'chatlog'); b.onclick = () => setChatTab(c.id);
    $('ctabs').append(b);
  });
  $('ctabs').append(el('span', 'lbl', 'Chat'));
  $('chatform').addEventListener('submit', e => {
    e.preventDefault(); const msg = $('chat').value.trim(); if (!msg) return;
    const ch = ui.chat, pre = ch === 'party' ? '[Party] ' : ch === 'guild' ? '[Guild] ' : '';
    log(`${pre}${state.name} : ${msg}`, ch, ch);
    bubble(msg); $('chat').value = '';
  });

  // ---------- HUD: status bar + character window ----------
  function setBar(k, v, max, pct) {
    const p = max ? clampN(v / max * 100, 0, 100) : 0;
    $(k + 'bar').style.width = p + '%';
    $(k + 'txt').textContent = pct ? `${fmt(v)} / ${fmt(max)} [${p.toFixed(2)}%]` : `${fmt(v)} / ${fmt(max)}`;
    const m = $(k + 'm'); m.setAttribute('aria-valuemin', 0); m.setAttribute('aria-valuemax', max); m.setAttribute('aria-valuenow', Math.round(v));
  }
  function refreshHUD() {
    const name = state.name, job = state.job || 'Beginner', b = equipBonus();
    $('nm').textContent = name; $('sbname').textContent = name; $('sbjob').textContent = job; $('st-job').textContent = job;
    $('lv').textContent = prog.lv; $('st-fame').textContent = fmt(prog.fame); $('ap').textContent = prog.ap;
    const hp = maxHP(), mp = maxMP();
    setBar('hp', hp, hp); setBar('mp', Math.round(mp * mpFrac), mp); setBar('exp', prog.exp, need(prog.lv), true);
    $('st-hpmp').textContent = `${fmt(hp)} / ${fmt(mp)}`;
    $('mesos').textContent = fmt(prog.mesos);
    const box = $('stats'); box.innerHTML = '';
    for (const k of STATS) {
      const own = prog.base[k] + prog.add[k], row = el('div', 'srow');
      row.append(el('span', 'k', k));
      const v = el('span', 'v', String(own + b[k]));
      if (b[k] || prog.add[k]) { const i = el('i', prog.add[k] && !b[k] ? 'ap' : '', ` (${prog.base[k]}${prog.add[k] ? '+' + prog.add[k] : ''}${b[k] ? '+' + b[k] : ''})`); v.append(i); }
      const plus = el('button', 'plus', '+'); plus.type = 'button'; plus.id = 'ap-' + k.toLowerCase(); plus.disabled = !prog.ap;
      plus.setAttribute('aria-label', `Spend 1 AP on ${k}`); plus.dataset.tip = 'text:' + `Spend 1 AP on ${k}`;
      plus.onclick = () => { if (!prog.ap) return; prog.ap--; prog.add[k]++; refreshHUD(); save(); if (!prog.ap) $('rand').focus(); else $('ap-' + k.toLowerCase()).focus(); };
      row.append(v, plus); box.append(row);
    }
  }
  function gainExp(n) {
    prog.exp += n; log(`You have gained ${n} EXP`, 'sys');
    const from = prog.lv;
    while (prog.exp >= need(prog.lv) && prog.lv < 200) { prog.exp -= need(prog.lv); prog.lv++; prog.ap += 5; }
    if (prog.lv > from) {
      log(`[Notice] Congratulations! ${state.name} reached Lv. ${prog.lv}!`, 'lvl');
      log(`You have gained ${(prog.lv - from) * 5} AP. Spend them in the Character window.`, 'lvl');
      levelFx();
    }
    refreshHUD(); save();
  }
  function gainMesos(n) {
    prog.mesos += n; $('mesos').textContent = fmt(prog.mesos);
    if (RM.matches) return;
    const f = el('span', 'gain', '+' + fmt(n)); $('meso').append(f); setTimeout(() => f.remove(), 1300);
  }

  // ---------- tooltips ----------
  const tip = $('tip');
  let tipKey = null, tipBy = null, mx = 0, my = 0, ptype = 'mouse', tipTimer = 0;
  function tipHTML(key) {
    const [kind, ...rest] = key.split(':'), arg = rest.join(':');
    if (kind === 'text') return { simple: true, html: esc(arg) };
    if (kind === 'item') { const it = ITEM_BY_ID[arg]; return it ? { html: itemTip(it) } : null; }
    if (kind === 'skin') { const s = SKIN_TONES[+arg]; return s && { simple: true, html: `<div class="tn">${esc(s.name)}</div><div class="fl">Skin tone${state.skin === +arg ? ' · current' : ''}</div>` }; }
    if (kind === 'slot') return { simple: true, html: `<div class="tn">${esc(info(arg).slot)}</div><div class="fl">${arg === 'bottom' && state.equip.dress ? 'Covered by your overall.' : 'Empty slot.'} Click to browse ${esc(info(arg).tab)} items.</div>` };
    if (kind === 'body') return { simple: true, html: `<div class="tn">${esc(state.name)}</div><div class="fl">${esc(SKIN_TONES[state.skin].name)} skin · ${esc(EYE_COLORS[state.eyes].name)} eyes</div><div class="hn">Click to change skin and eyes</div>` };
    if (kind === 'preset') {
      const p = PRESETS[+arg]; if (!p) return null;
      const names = Object.values(p.s).map(([id]) => ITEM_BY_ID[id] && ITEM_BY_ID[id].name).filter(Boolean);
      return { html: `<div class="tn" style="color:#ffcf3f">${esc(p.name)} Package</div><div class="tr" style="color:#9fb0cf">(Job Outfit)</div><hr>${names.map(n => `<div class="st">${esc(n)}</div>`).join('')}<hr><div class="hn">Click to wear the whole set · +25 EXP</div>` };
    }
    return null;
  }
  function itemTip(it) {
    const s = itemStats(it), R = RARITY[s.rarity], cur = state.equip[it.cat], worn = cur && cur.id === it.id, hair = it.cat === 'hair';
    const lvOk = prog.lv >= s.reqLv, jobs = JOBS.map((j, i) => `<span class="${!s.job || s.job === i ? 'ok' : ''}">${j}</span>`).join('');
    const req = hair ? '<span>Hair Salon style</span><span>Any job · any level</span>'
      : `<span class="${lvOk ? '' : 'bad'}">REQ LEV : ${s.reqLv}</span>` + (s.reqStat ? `<span>REQ ${s.reqStat[0]} : ${s.reqStat[1]}</span>` : '<span>REQ STAT : none</span>');
    const lines = [`Category : ${esc(s.type)}`];
    if (s.speed) lines.push(`Attack Speed : ${s.speed}`);
    for (const [k, n] of s.stats) lines.push(`${k} : <b>+${n}</b>`);
    if (!hair) lines.push(`Number of upgrades available : ${s.slots}`);
    const dyed = worn && cur.color && !hair ? ` · dyed <span style="color:${esc(cur.color)}">■</span> ${esc(cur.color)}` : '';
    return `<div class="tn" style="color:${R.color}">${esc(it.name)}</div>` + (R.name ? `<div class="tr" style="color:${R.color}">(${R.name})</div>` : '') +
      `<div class="tt"><div class="ti"><canvas class="px" width="48" height="48" data-ico="${esc(it.id)}"></canvas></div><div class="rq">${req}</div></div>` +
      (hair ? '' : `<div class="jb">${jobs}</div>`) + `<hr>${lines.map(l => `<div class="st">${l}</div>`).join('')}<hr><div class="fl">${esc(s.flavor)}</div>` +
      `<div class="hn">${worn ? 'Equipped' + dyed : `Click to equip · +${s.exp} EXP`}</div>`;
  }
  function showTip(key) {
    const t = tipHTML(key); if (!t) { hideTip(); return; }
    tipKey = key; tip.className = 'tip' + (t.simple ? ' simple' : ''); tip.innerHTML = t.html; tip.hidden = false;
    const c = tip.querySelector('canvas[data-ico]');
    if (c) { const it = ITEM_BY_ID[c.dataset.ico]; c.getContext('2d').drawImage(itemIcon(it, iconColor(it), 48), 0, 0); }
  }
  function placeTip(x, y) {
    const w = tip.offsetWidth, h = tip.offsetHeight, W = document.documentElement.clientWidth, H = window.innerHeight;
    let left = x + 16, top = y + 18;
    if (left + w > W - 6) left = Math.max(6, x - w - 12);
    if (top + h > H - 6) top = Math.max(6, y - h - 12);
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
  function anchorTip(node) {
    const r = node.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, W = document.documentElement.clientWidth;
    const left = clampN(r.left + r.width / 2 - w / 2, 6, Math.max(6, W - w - 6)), top = r.top - h - 8 > 6 ? r.top - h - 8 : r.bottom + 8;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }
  function hideTip() { tip.hidden = true; tipKey = null; tipBy = null; clearTimeout(tipTimer); }
  document.addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY; ptype = e.pointerType || 'mouse';
    if (ptype !== 'mouse') return;
    const t = e.target.closest && e.target.closest('[data-tip]'), k = t ? t.dataset.tip : null;
    if (k !== tipKey || tipBy !== 'mouse') { if (k) { showTip(k); tipBy = 'mouse'; } else if (tipBy === 'mouse') hideTip(); }
    if (tipKey && tipBy === 'mouse') placeTip(mx, my);
  }, { passive: true });
  document.addEventListener('pointerdown', e => { ptype = e.pointerType || 'mouse'; if (ptype !== 'mouse') hideTip(); }, true);
  document.addEventListener('pointerleave', () => { if (tipBy === 'mouse') hideTip(); });
  document.addEventListener('focusin', e => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t && t.matches(':focus-visible')) { showTip(t.dataset.tip); tipBy = 'focus'; anchorTip(t); } else if (tipBy === 'focus') hideTip();
  });
  document.addEventListener('focusout', () => { if (tipBy === 'focus') hideTip(); });
  document.addEventListener('click', e => { // touch: show the item card briefly after a tap
    if (ptype === 'mouse') return;
    const t = e.target.closest && e.target.closest('[data-tip^="item:"], [data-tip^="preset:"]'); if (!t) return;
    const k = t.dataset.tip;
    requestAnimationFrame(() => {
      const n = [...document.querySelectorAll('[data-tip]')].find(x => x.dataset.tip === k); if (!n) return;
      showTip(k); tipBy = 'touch'; anchorTip(n); clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 2600);
    });
  });
  function refreshTip() { // a rebuilt grid replaces the hovered node: keep its card up to date
    if (!tipKey) return;
    if (tipBy === 'mouse') { const n = document.elementFromPoint(mx, my), t = n && n.closest('[data-tip]'); if (t) { showTip(t.dataset.tip); tipBy = 'mouse'; placeTip(mx, my); } else hideTip(); }
    else hideTip();
  }

  // ---------- windows: open/close, bring to front, drag on wide screens ----------
  const WIN = { equip: 'w-equip', stats: 'w-stats', inv: 'w-inv', ward: 'w-ward' };
  const WIDE = window.matchMedia ? window.matchMedia('(min-width: 900px)') : { matches: true };
  let winPos = {}; try { winPos = store.get('winpos') || {}; } catch (e) { winPos = {}; }
  let zTop = 5;
  const front = w => { w.style.zIndex = ++zTop; };
  function flash(w) { w.classList.remove('flash'); void w.offsetWidth; w.classList.add('flash'); setTimeout(() => w.classList.remove('flash'), 1500); }
  function setOpen(k, on, opts = {}) {
    const w = $(WIN[k]); if (!w) return;
    w.hidden = !on; ui.open[k] = on;
    if (on) {
      front(w); place(w, ...(winPos[w.id] || [0, 0]));
      if (opts.flash) flash(w);
      if (opts.scroll) { const r = w.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight) w.scrollIntoView({ block: 'nearest', behavior: RM.matches ? 'auto' : 'smooth' }); }
    } else if (w.contains(document.activeElement)) $('menubtn').focus();
    saveUi();
  }
  const toggle = k => setOpen(k, $(WIN[k]).hidden, { flash: true, scroll: true });
  function place(w, dx, dy) {
    w.style.transform = '';
    if (!WIDE.matches || w.hidden) return;
    const r = w.getBoundingClientRect(), d = $('desk').getBoundingClientRect();
    dx = Math.round(clampN(dx, d.left + 2 - r.left, d.right - 2 - r.right)); dy = Math.round(clampN(dy, d.top + 2 - r.top, d.bottom - 2 - r.bottom));
    if (dx || dy) { w.style.transform = `translate(${dx}px, ${dy}px)`; winPos[w.id] = [dx, dy]; } else delete winPos[w.id];
  }
  function layoutWins() { Object.values(WIN).forEach(id => { const w = $(id); w.classList.toggle('drag', WIDE.matches); place(w, ...(winPos[id] || [0, 0])); }); }
  Object.entries(WIN).forEach(([k, id]) => {
    const w = $(id), bar = w.querySelector('.wt');
    w.addEventListener('pointerdown', () => front(w));
    let drag = null;
    bar.addEventListener('pointerdown', e => {
      if (!WIDE.matches || e.button !== 0 || e.target.closest('button, input, select')) return;
      const [ox, oy] = winPos[id] || [0, 0]; drag = { sx: e.clientX, sy: e.clientY, ox, oy };
      bar.setPointerCapture(e.pointerId); e.preventDefault();
    });
    bar.addEventListener('pointermove', e => { if (drag) place(w, drag.ox + e.clientX - drag.sx, drag.oy + e.clientY - drag.sy); });
    const end = () => { if (drag) { drag = null; store.set('winpos', winPos); } };
    bar.addEventListener('pointerup', end); bar.addEventListener('pointercancel', end);
    bar.addEventListener('dblclick', e => { if (e.target.closest('button')) return; place(w, 0, 0); store.set('winpos', winPos); });
  });
  document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => setOpen(b.dataset.close, false); });
  let rsz = 0; window.addEventListener('resize', () => { cancelAnimationFrame(rsz); rsz = requestAnimationFrame(layoutWins); });
  function resetWindows() { winPos = {}; store.set('winpos', winPos); Object.keys(WIN).forEach(k => setOpen(k, true)); layoutWins(); toast('Window layout reset'); }

  // ---------- inventory ----------
  TABS.forEach(t => {
    const b = el('button', 'tab', t.label); b.type = 'button'; b.id = 'tab-' + t.id; b.dataset.tab = t.id;
    b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'grid'); b.onclick = () => openTab(t.id, false);
    $('tabs').append(b);
  });
  function tabKeys(box, sel) { // arrow keys move between tabs
    box.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const all = [...box.querySelectorAll(sel)], i = all.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); const n = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]; n.focus(); n.click();
    });
  }
  tabKeys($('tabs'), '.tab'); tabKeys($('ctabs'), '.ctab'); tabKeys($('wtabs'), '.tab');
  $('count').textContent = `${ITEMS.length} items`;
  function openTab(id, reveal = true) {
    if (!TABS.some(t => t.id === id)) return;
    tab = id; buildGrid();
    if (reveal) setOpen('inv', true, { flash: true, scroll: true });
    save();
  }
  function cell(label, pressed, onclick, tipKey) {
    const b = el('button', 'cell'); b.type = 'button'; b.setAttribute('aria-pressed', pressed); b.setAttribute('aria-label', label);
    if (tipKey) b.dataset.tip = tipKey; else b.title = label;
    b.onclick = onclick; $('grid').append(b); return b;
  }
  let gridTab = null;
  function buildGrid() {
    document.querySelectorAll('#tabs .tab').forEach(b => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    const grid = $('grid'), keep = gridTab === tab ? grid.scrollTop : 0; gridTab = tab;
    grid.setAttribute('aria-labelledby', 'tab-' + tab); grid.innerHTML = '';
    if (tab === 'body') {
      SKIN_TONES.forEach((s, i) => {
        const b = cell(s.name + ' skin', state.skin === i, () => { state.skin = i; changed(); }, 'skin:' + i);
        const c = el('canvas', 'px'); c.width = c.height = 48; b.append(c);
        paintInto(c, `skin|${i}|${state.eyes}`, () => fit(bufCanvas(renderCharacter('front', { skin: i, eyes: state.eyes, equip: {} })), SKIN_CROP, 48, 48));
      });
    } else {
      const cur = state.equip[tab];
      const none = cell('Unequip ' + info(tab).slot, !cur, () => unequip(tab), 'text:Take off your ' + info(tab).slot.toLowerCase());
      none.append(el('span', 'none', 'none'));
      itemsOf(tab).forEach(it => {
        const b = cell(it.name, !!(cur && cur.id === it.id), () => equip(it), 'item:' + it.id);
        const c = el('canvas', 'px'); c.width = c.height = 48; b.append(c);
        paintItem(c, it, iconColor(it));
      });
    }
    grid.scrollTop = keep;
    buildSwatches(); showName();
  }
  function showName() {
    const n = $('itemname');
    if (tab === 'body') { n.innerHTML = `${esc(SKIN_TONES[state.skin].name)} <span>skin · ${esc(EYE_COLORS[state.eyes].name)} eyes</span>`; return; }
    const cur = state.equip[tab];
    n.innerHTML = cur ? `<span>Wearing</span> ${esc(ITEM_BY_ID[cur.id].name)}` : `<span>Nothing in the ${esc(info(tab).slot)} slot</span>`;
  }
  function buildSwatches() {
    const box = $('swatches'); box.innerHTML = ''; const note = $('dyenote');
    if (tab === 'body') {
      $('dyelbl').textContent = 'Cosmetic Lens'; note.textContent = EYE_COLORS[state.eyes].name + ' eyes';
      EYE_COLORS.forEach((e, i) => {
        const b = el('button', 'sw named'); b.type = 'button'; b.setAttribute('aria-pressed', state.eyes === i);
        const dot = el('i'); dot.style.background = e.c[1]; b.append(dot, e.name); b.onclick = () => { state.eyes = i; changed(); }; box.append(b);
      });
      return;
    }
    const cur = state.equip[tab];
    $('dyelbl').textContent = tab === 'hair' ? 'Hair Salon · Color' : 'Dye';
    if (!cur) { note.textContent = ''; box.append(el('span', 'hint', `Equip ${tab === 'hair' ? 'a hairstyle' : 'an item'} to ${tab === 'hair' ? 'color' : 'dye'} it.`)); return; }
    const it = ITEM_BY_ID[cur.id], now = (cur.color || it.dye || '').toLowerCase();
    note.textContent = cur.color ? cur.color : 'Original color';
    (tab === 'hair' ? HAIR_COLORS : DYES).forEach(hex => {
      const b = el('button', 'sw'); b.type = 'button'; b.style.background = hex; b.dataset.tip = 'text:' + hex; b.setAttribute('aria-label', (tab === 'hair' ? 'Hair color ' : 'Dye ') + hex);
      b.setAttribute('aria-pressed', now === hex.toLowerCase()); b.onclick = () => { cur.color = hex; changed(); }; box.append(b);
    });
    const pick = el('input'); pick.type = 'color'; pick.id = 'custom-dye'; pick.value = /^#[0-9a-f]{6}$/i.test(now) ? now : '#999999';
    pick.setAttribute('aria-label', 'Custom color'); pick.dataset.tip = 'text:Custom color';
    pick.oninput = () => { cur.color = pick.value; cacheKey = ''; note.textContent = pick.value; save(); };
    pick.onchange = () => { cur.color = pick.value; changed(); };
    box.append(pick);
    if (it.dye && tab !== 'hair') {
      const r = el('button', 'btn sm', 'Original'); r.type = 'button'; r.id = 'dye-original'; r.disabled = !cur.color;
      r.onclick = () => { cur.color = null; changed(); }; box.append(r);
    }
  }
  function equip(it) {
    const prev = state.equip[it.cat];
    if (prev && prev.id === it.id) return;
    state.equip[it.cat] = { id: it.id, color: it.cat === 'hair' ? (prev && prev.color) || '#7a4a2e' : null };
    if (it.cat === 'dress') { delete state.equip.top; delete state.equip.bottom; }
    if (it.cat === 'top' || it.cat === 'bottom') delete state.equip.dress;
    changed();
    const s = itemStats(it);
    log(`[Notice] You equipped ${it.name}.`, 'notice');
    gainMesos(s.mesos); gainExp(s.exp);
  }
  function unequip(c) {
    const cur = state.equip[c]; if (!cur) return;
    delete state.equip[c]; changed();
    log(`[Notice] You took off ${ITEM_BY_ID[cur.id].name}.`, 'notice');
  }
  let lastLook = '';
  function changed() {
    cacheKey = '';
    const look = state.skin + '/' + state.eyes;
    refreshHUD(); buildGrid(); buildEquip();
    if (look !== lastLook) { lastLook = look; buildJobs(); } else markJobs();
    save(); refreshTip();
  }

  // ---------- equipment window ----------
  const EQ = [['hat', 'l'], ['hair', 'r'], ['face', 'l'], ['top', 'r'], ['back', 'l'], ['bottom', 'r'], ['hand', 'l'], ['shoes', 'r']];
  function buildEquip() {
    const box = $('equip'); box.innerHTML = '';
    const p = el('button', 'portrait'); p.type = 'button'; p.dataset.tip = 'body'; p.setAttribute('aria-label', 'Your character. Open skin and eyes');
    const pc = el('canvas', 'px'); pc.width = 96; pc.height = 176; p.append(pc); p.onclick = () => openTab('body');
    box.append(p);
    const pk = 'portrait|' + JSON.stringify(state.equip) + state.skin + state.eyes;
    paintInto(pc, pk, () => { const c = el('canvas'); c.width = 96; c.height = 176; c.getContext('2d').drawImage(bufCanvas(renderCharacter('front', state)), 16, 0, 96, 176, 0, 0, 96, 176); return c; });
    const rows = { l: 0, r: 0 };
    const slots = [...EQ.filter(([c]) => present.has(c) || (c === 'top' && present.has('dress'))), ...CATS.filter(c => !ORDER.includes(c)).map(c => [c, 'b'])];
    for (const [c, side] of slots) {
      let show = c, sel = state.equip[c];
      if (c === 'top' && state.equip.dress) { show = 'dress'; sel = state.equip.dress; }
      const blocked = c === 'bottom' && !!state.equip.dress, it = sel && ITEM_BY_ID[sel.id];
      const b = el('button', `eslot ${side}` + (it ? ' on' : '') + (blocked ? ' blocked' : '')); b.type = 'button';
      if (side !== 'b') b.style.gridRow = String(++rows[side]);
      const target = show === 'dress' ? 'dress' : (c === 'top' && !present.has('top') ? 'dress' : c);
      b.setAttribute('aria-label', it ? `${info(show).slot}: ${it.name}` : `${info(c).slot}: empty`);
      b.dataset.tip = it ? 'item:' + it.id : 'slot:' + c;
      if (it) { const cv = el('canvas', 'px'); cv.width = cv.height = 40; b.append(cv); paintItem(cv, it, iconColor(it)); }
      else b.append(el('span', 'sl', blocked ? 'Overall' : info(c).slot));
      b.onclick = () => openTab(target);
      box.append(b);
    }
  }
  $('bodybtn').onclick = () => openTab('body');
  $('undress').onclick = undress;
  function undress() { if (!Object.keys(state.equip).length) { toast('Nothing to take off'); return; } state.equip = {}; state.job = 'Beginner'; changed(); log('[Notice] You took off all your equipment.', 'notice'); }

  // ---------- presets / random ----------
  function buildJobs() {
    const box = $('jobs'); box.innerHTML = '';
    PRESETS.forEach((p, i) => {
      const b = el('button', 'job'); b.type = 'button'; b.dataset.tip = 'preset:' + i; b.dataset.name = p.name;
      b.setAttribute('aria-label', `Wear the ${p.name} outfit`);
      const c = el('canvas'); c.width = 54; c.height = 72; b.append(c, el('span', '', p.name));
      paintInto(c, `preset|${i}|${state.skin}|${state.eyes}`, () => fit(bufCanvas(renderCharacter('front', fromPreset(p, state))), [OX - 10, OY - 36, OX + 90, OY + 128], 54, 72, 1), false);
      b.onclick = () => wearPreset(p);
      box.append(b);
    });
    markJobs();
  }
  function markJobs() { document.querySelectorAll('#jobs .job').forEach(b => b.classList.toggle('cur', b.dataset.name === state.job)); }
  function wearPreset(p) {
    state = fromPreset(p, state); changed();
    log(`[Notice] You changed into the ${p.name} job outfit.`, 'notice'); gainExp(25);
    toast(`${p.name} outfit equipped`);
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function randomize() {
    const eq = {}, has = c => itemsOf(c).length > 0, one = c => pick(itemsOf(c));
    if (has('hair')) eq.hair = { id: one('hair').id, color: pick(HAIR_COLORS) };
    if (has('dress') && (Math.random() < .35 || !has('top'))) eq.dress = { id: one('dress').id, color: Math.random() < .5 ? pick(DYES) : null };
    else { if (has('top')) eq.top = { id: one('top').id, color: pick(DYES) }; if (has('bottom')) eq.bottom = { id: one('bottom').id, color: pick(DYES) }; }
    if (has('shoes')) eq.shoes = { id: one('shoes').id, color: Math.random() < .5 ? pick(DYES) : null };
    for (const [c, p] of [['hat', .55], ['face', .3], ['back', .3], ['hand', .5], ...CATS.filter(c => !ORDER.includes(c)).map(c => [c, .4])]) if (has(c) && Math.random() < p) eq[c] = { id: one(c).id, color: Math.random() < .4 ? pick(DYES) : null };
    state.equip = eq; state.skin = Math.floor(Math.random() * 6); state.eyes = Math.floor(Math.random() * EYE_COLORS.length);
    state.job = pick(['Adventurer', 'Wanderer', 'Fashionista', 'Explorer', 'Dreamer']);
    mpFrac = Math.max(0, mpFrac - .25);
    changed();
    log('[Notice] You cast Random Look!', 'notice'); gainExp(20);
  }
  $('rand').onclick = randomize;
  $('dice').onclick = () => {
    prog.base = roll(); const s = prog.base;
    const ic = $('dice').querySelector('canvas'); ic.classList.remove('dice-spin'); void ic.offsetWidth; ic.classList.add('dice-spin');
    log(`[Notice] The dice rolled STR ${s.STR} · DEX ${s.DEX} · INT ${s.INT} · LUK ${s.LUK}.`, 'notice');
    refreshHUD(); save();
  };
  $('name').addEventListener('input', () => { state.name = $('name').value.trim() || 'Pixie'; refreshHUD(); save(); });

  // ---------- closet slots ----------
  function buildSlots() {
    const box = $('slots'); box.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const raw = store.get('slot' + i), data = raw && raw.equip ? sanitize(raw) : null;
      const d = el('div', 'cslot');
      const c = el('canvas', 'pv'); c.width = 66; c.height = 88;
      d.append(el('span', 'lbl', data ? `${i + 1}. ${data.name}` : `Slot ${i + 1}`), c);
      if (data) paintInto(c, 'slot|' + JSON.stringify(data), () => fit(bufCanvas(renderCharacter('front', data)), [OX - 10, OY - 36, OX + 90, OY + 128], 66, 88, 1), false);
      else { const x = c.getContext('2d'); x.fillStyle = '#6d7c96'; x.font = '400 8px Silkscreen, monospace'; x.textAlign = 'center'; x.fillText('EMPTY', 33, 48); }
      const r = el('div', 'row');
      const sv = el('button', 'btn sm', 'Save'); sv.type = 'button'; sv.id = 'slot-save-' + i;
      sv.onclick = () => {
        if (data && sv.dataset.arm !== '1') { // overwrite needs a second click
          sv.dataset.arm = '1'; sv.textContent = 'Overwrite?'; sv.classList.add('warn');
          clearTimeout(sv._t); sv._t = setTimeout(() => { sv.dataset.arm = ''; sv.textContent = 'Save'; sv.classList.remove('warn'); }, 3000); return;
        }
        store.set('slot' + i, state); buildSlots(); toast(`Saved to Closet Slot ${i + 1}`);
      };
      const ld = el('button', 'btn sm go', 'Wear'); ld.type = 'button'; ld.id = 'slot-wear-' + i; ld.disabled = !data;
      ld.onclick = () => { state = sanitize(JSON.parse(JSON.stringify(data))); $('name').value = state.name; changed(); toast(`Wearing Closet Slot ${i + 1}`); };
      r.append(sv, ld); d.append(r); box.append(d);
    }
  }
  function setWardTab(id) {
    ui.ward = id;
    document.querySelectorAll('#wtabs .tab').forEach(b => { const on = b.dataset.wtab === id; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    $('jobs').hidden = id !== 'jobs'; $('slots').hidden = id !== 'slots';
    $('wardnote').textContent = id === 'jobs' ? 'Job outfits' : 'Your closet';
    saveUi();
  }
  document.querySelectorAll('#wtabs .tab').forEach(b => { b.onclick = () => setWardTab(b.dataset.wtab); });
  function openShop(id) { setWardTab(id); setOpen('ward', true, { flash: true, scroll: true }); }

  // ---------- snapshot, outfit code, help ----------
  let lastFocus = null;
  function dialog(title, nodes) {
    closePops(); hideTip();
    $('dlgtitle').textContent = title; const body = $('dlgbody'); body.innerHTML = ''; nodes.forEach(n => body.append(n));
    lastFocus = document.activeElement;
    const d = $('dlg'); if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  }
  function closeDlg() { const d = $('dlg'); if (d.close) { if (d.open) d.close(); } else d.removeAttribute('open'); }
  $('dlgclose').onclick = closeDlg;
  $('dlg').addEventListener('close', () => { if (lastFocus && lastFocus.focus && lastFocus.isConnected) lastFocus.focus(); });
  $('dlg').addEventListener('click', e => { if (e.target === $('dlg')) closeDlg(); });
  function snapshot() {
    const S = 3, c = document.createElement('canvas'); c.width = SW * S; c.height = SH * S;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(view, 0, 0, c.width, c.height);
    x.font = `700 ${11 * S}px "Nanum Gothic", Tahoma, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = x.measureText(state.name).width + 12 * S; x.fillStyle = 'rgba(0,0,0,.66)'; x.fillRect(SW * S / 2 - w / 2, 187 * S, w, 15 * S);
    x.fillStyle = '#fff'; x.fillText(state.name, SW * S / 2, 194.5 * S);
    const img = document.createElement('img'); img.alt = `${state.name} snapshot`; img.src = c.toDataURL('image/png');
    const p = el('p', 'hint', 'Right-click or long-press the picture to save it.');
    dialog('Snapshot', [img, p]);
    prog.fame++; refreshHUD(); save(); log('You have gained fame (+1) for your snapshot.', 'sys');
  }
  function encode(s) { return btoa(unescape(encodeURIComponent(JSON.stringify({ n: s.name, k: s.skin, e: s.eyes, j: s.job, q: Object.fromEntries(Object.entries(s.equip).map(([c, v]) => [c, [v.id, v.color]])) })))); }
  function decode(code) {
    const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    const equip = {}; for (const [c, [id, color]] of Object.entries(o.q || {})) if (ITEM_BY_ID[id] && ITEM_BY_ID[id].cat === c) equip[c] = { id, color: color || null };
    return { name: String(o.n || 'Pixie').slice(0, 14), skin: +o.k % SKIN_TONES.length || 0, eyes: +o.e % EYE_COLORS.length || 0, job: String(o.j || 'Adventurer').slice(0, 20), equip };
  }
  function share() {
    const ta = el('textarea'); ta.id = 'codebox'; ta.value = encode(state); ta.setAttribute('aria-label', 'Outfit code'); ta.spellcheck = false;
    const r = el('div', 'row');
    const cp = el('button', 'btn go', 'Copy code'); cp.type = 'button'; cp.id = 'code-copy';
    cp.onclick = () => { const ok = () => toast('Code copied'), no = () => { ta.focus(); ta.select(); toast('Press Ctrl+C to copy'); }; try { navigator.clipboard.writeText(ta.value).then(ok, no); } catch (e) { no(); } };
    const ld = el('button', 'btn', 'Wear pasted code'); ld.type = 'button'; ld.id = 'code-wear';
    const msg = el('p', 'hint', 'Share this code with a friend, or paste theirs here and press Wear.');
    ld.onclick = () => {
      try { state = sanitize(decode(ta.value)); $('name').value = state.name; changed(); closeDlg(); toast('Outfit loaded'); log('[Notice] You put on an outfit from a code.', 'notice'); }
      catch (e) { msg.textContent = 'That code could not be read. Paste the full code and try again.'; msg.style.color = '#b0281c'; }
    };
    r.append(cp, ld);
    dialog('Outfit Code', [ta, r, msg]);
  }
  function help() {
    const dl = el('dl', 'keys');
    [['← →', 'Turn the character (or drag on the map)'], ['Enter', 'Chat'], ['R', 'Random Look'], ['U', 'Unequip all'], ['E', 'Equipment window'], ['I', 'Item Inventory'],
      ['S', 'Character stats'], ['C', 'Cash Shop: job outfits'], ['L', 'Closet slots'], ['P', 'Snapshot'], ['O', 'Outfit code'], ['H', 'This help'], ['Esc', 'Close menus']]
      .forEach(([k, v]) => { const dt = el('dt'); k.split(' ').forEach(p => dt.append(el('kbd', '', p), ' ')); dl.append(dt, el('dd', '', v)); });
    const p = el('p', 'hint', 'Drag a window by its title bar to move it; double-click the title to put it back. Every item you equip earns EXP and mesos.');
    dialog('Help', [dl, p]);
  }

  // ---------- status bar: quick slots, Cash Shop / Menu / Settings ----------
  const QUICK = [
    { icon: 'wand', label: 'Random Look', key: 'R', run: randomize }, { icon: 'hanger', label: 'Unequip All', key: 'U', run: undress },
    { icon: 'camera', label: 'Snapshot', key: 'P', run: snapshot }, { icon: 'scroll', label: 'Outfit Code', key: 'O', run: share },
    { icon: 'sword', label: 'Equipment', key: 'E', run: () => toggle('equip') }, { icon: 'bag', label: 'Item Inventory', key: 'I', run: () => toggle('inv') },
    { icon: 'star', label: 'Character', key: 'S', run: () => toggle('stats') }, { icon: 'chest', label: 'Closet Slots', key: 'L', run: () => openShop('slots') },
  ];
  QUICK.forEach((q, i) => {
    const b = el('button', 'qs'); b.type = 'button'; b.id = 'qs-' + i; b.setAttribute('aria-label', `${q.label} (${q.key})`); b.dataset.tip = `text:${q.label} [${q.key}]`;
    b.append(icon(q.icon, 'px'), el('span', 'k', q.key)); b.onclick = q.run; $('quick').append(b);
  });
  const MENU = [
    { icon: 'sword', label: 'Equipment', key: 'E', run: () => toggle('equip') }, { icon: 'bag', label: 'Item Inventory', key: 'I', run: () => toggle('inv') },
    { icon: 'star', label: 'Character', key: 'S', run: () => toggle('stats') }, { icon: 'gift', label: 'Cash Shop', key: 'C', run: () => openShop('jobs') },
    { icon: 'chest', label: 'Closet Slots', key: 'L', run: () => openShop('slots') }, { icon: 'chat', label: 'Chat', key: 'Enter', run: () => $('chat').focus() },
    { icon: 'camera', label: 'Snapshot', key: 'P', run: snapshot }, { icon: 'scroll', label: 'Outfit Code', key: 'O', run: share },
    { icon: 'hanger', label: 'Unequip All', key: 'U', run: undress },
  ];
  const SYS = [
    { icon: 'map', label: 'Change Channel', run: changeChannel }, { icon: 'win', label: 'Reset Window Layout', run: resetWindows },
    { icon: 'chat', label: 'Clear Chat Log', run: () => { chatLines.length = 0; renderChat(); } }, { icon: 'book', label: 'Help & Controls', key: 'H', run: help },
    { icon: 'warn', label: 'Start Over at Lv. 1', danger: true, run: startOver },
  ];
  function buildPop(id, title, items) {
    const box = $(id); box.append(el('h3', '', title));
    items.forEach(it => {
      const b = el('button', it.danger ? 'danger' : ''); b.type = 'button'; b.setAttribute('role', 'menuitem');
      const lab = el('span', '', it.label); b.append(icon(it.icon), lab); if (it.key) b.append(el('kbd', '', it.key));
      b.onclick = () => {
        if (it.danger && !b.classList.contains('arm')) { b.classList.add('arm'); lab.textContent = 'Click again to confirm'; return; }
        closePops(); it.run();
      };
      box.append(b);
    });
    box.addEventListener('keydown', e => {
      const all = [...box.querySelectorAll('button')], i = all.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length].focus(); }
    });
  }
  buildPop('pop-menu', 'Menu', MENU); buildPop('pop-sys', 'Settings', SYS);
  const POPS = [['menubtn', 'pop-menu', MENU], ['sysbtn', 'pop-sys', SYS]];
  function closePops(refocus) {
    for (const [b, p, items] of POPS) {
      const pop = $(p), was = !pop.hidden; pop.hidden = true; $(b).setAttribute('aria-expanded', 'false');
      pop.querySelectorAll('button.arm').forEach(x => { x.classList.remove('arm'); const i = [...pop.querySelectorAll('button')].indexOf(x); x.querySelector('span').textContent = items[i].label; });
      if (was && refocus) $(b).focus();
    }
  }
  POPS.forEach(([b, p]) => { $(b).onclick = () => { const open = $(p).hidden; closePops(); if (open) { $(p).hidden = false; $(b).setAttribute('aria-expanded', 'true'); $(p).querySelector('button').focus(); } }; });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.pop, #menubtn, #sysbtn')) closePops(); });
  $('cashbtn').onclick = () => openShop('jobs');
  $('cashbtn').dataset.tip = 'text:Cash Shop: job outfits [C]'; $('menubtn').dataset.tip = 'text:Menu'; $('sysbtn').dataset.tip = 'text:Settings';
  $('helpbtn').onclick = help;
  function changeChannel() {
    prog.ch = prog.ch % 20 + 1; $('chlabel').textContent = 'Ch. ' + prog.ch; save();
    log(`[Notice] You moved to ${WORLD} Ch. ${prog.ch}.`, 'notice'); toast(`${WORLD} · Channel ${prog.ch}`);
  }
  $('world').onclick = changeChannel; $('world').dataset.tip = 'text:Change channel';
  function startOver() {
    const ch = prog.ch; prog = defaultProg(); prog.ch = ch; mpFrac = 1; refreshHUD(); save();
    log('[Notice] A fresh start! You are Lv. 1 again with new dice stats.', 'notice'); toast('Started over at Lv. 1');
  }

  // ---------- keyboard ----------
  const KEYS = { r: randomize, u: undress, e: () => toggle('equip'), i: () => toggle('inv'), s: () => toggle('stats'), c: () => openShop('jobs'),
    l: () => openShop('slots'), p: snapshot, o: share, h: help, ArrowLeft: () => turn(-1), ArrowRight: () => turn(1) };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { const open = POPS.some(([, p]) => !$(p).hidden); closePops(true); hideTip(); if (open) e.preventDefault(); return; }
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if ($('dlg').open) return;
    if (e.key === 'Enter') { if (e.target === document.body || e.target === document.documentElement) { e.preventDefault(); $('chat').focus(); } return; }
    if (e.target.closest && e.target.closest('.pop')) return;
    const f = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (f) { e.preventDefault(); f(); }
  });

  // ---------- map picker ----------
  SCENES.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = s.name; $('map').append(o); });
  function showMap() { const s = SCENES[sceneIdx]; $('mapname').textContent = s.name; $('mmworld').textContent = s.region || WORLD; }
  $('map').onchange = () => { sceneIdx = clampN(+$('map').value || 0, 0, SCENES.length - 1); showMap(); miniAt = 0; save(); log(`[Notice] You entered ${SCENES[sceneIdx].name}.`, 'notice'); };

  let toastT; function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 1900); }
  function saveUi() { store.set('ui', ui); }
  function save() { store.set('cur', { state, sceneIdx }); store.set('prog', prog); }

  // ---------- boot ----------
  function start(data) {
    data = data || {};
    const saved = data.state ? data : store.get('cur');
    if (saved && saved.state && saved.state.equip) { state = sanitize(saved.state); sceneIdx = clampN(Math.floor(+saved.sceneIdx) || 0, 0, SCENES.length - 1); }
    const p = data.prog || store.get('prog'); if (p && typeof p === 'object') prog = sanitizeProg(p);
    const u = data.ui || store.get('ui');
    if (u && typeof u === 'object') {
      if (u.open) for (const k of Object.keys(WIN)) ui.open[k] = u.open[k] !== false;
      if (u.ward === 'jobs' || u.ward === 'slots') ui.ward = u.ward;
      if (CHANNELS.some(c => c.id === u.chat)) ui.chat = u.chat;
    }
    if (data.tab && TABS.some(t => t.id === data.tab)) tab = data.tab;
    if (Number.isInteger(data.dir)) dir = clampN(data.dir, 0, DIRS.length - 1);
    if (!TABS.some(t => t.id === tab)) tab = TABS[1] ? TABS[1].id : 'body';
    document.querySelectorAll('canvas[data-icon]').forEach(c => paintIcon(c.getContext('2d'), c.dataset.icon));
    paintIcon($('logoicon').getContext('2d'), 'mush');
    $('name').value = state.name; $('map').value = sceneIdx; showMap(); $('viewlbl').textContent = DIRS[dir].label;
    $('worldname').textContent = WORLD; $('chlabel').textContent = 'Ch. ' + prog.ch;
    const news = `[Notice] Welcome to ${WORLD}! The Closet Festival is on: every outfit you equip earns EXP and mesos.  ·  Visit the Cash Shop for job outfits  ·  Save your favourite looks in Closet Slots  ·  Press Enter to chat`;
    $('ticker').textContent = (news + '\u00a0'.repeat(16)).repeat(2); // two copies scroll as a seamless loop
    lastLook = state.skin + '/' + state.eyes;
    refreshHUD(); buildGrid(); buildEquip(); buildJobs(); buildSlots(); setWardTab(ui.ward);
    for (const k of Object.keys(WIN)) $(WIN[k]).hidden = !ui.open[k];
    setChatTab(ui.chat);
    log(`[Notice] Welcome to Pixie Closet, ${state.name}! You are on ${WORLD} Ch. ${prog.ch}.`, 'notice');
    log('Drag the map or press ← → to turn around. R gives you a Random Look, Enter opens chat.', 'sys');
    log('[Guild Notice] Fashion show tonight at the Lantern Market. Wear your best!', 'gnotice', 'guild');
    layoutWins();
    requestAnimationFrame(frame);
  }
  window.claude?.hot?.snapshot?.(() => ({ state, sceneIdx, tab, dir, prog, ui }));
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
