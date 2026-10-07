// Pixie Closet — UI, stage loop, presets, saving.
(function () {
  const $ = id => document.getElementById(id);
  const CATS = ['hair', 'top', 'bottom', 'dress', 'shoes', 'hat', 'face', 'back', 'hand'];
  const TABS = [
    { id: 'body', label: 'Body' }, { id: 'hair', label: 'Hair' }, { id: 'top', label: 'Tops' }, { id: 'bottom', label: 'Bottoms' },
    { id: 'dress', label: 'Outfits' }, { id: 'shoes', label: 'Shoes' }, { id: 'hat', label: 'Hats' }, { id: 'face', label: 'Face' },
    { id: 'back', label: 'Back' }, { id: 'hand', label: 'Weapons' },
  ];
  const DIRS = [{ v: 'front', flip: false, label: 'Front' }, { v: 'side', flip: true, label: 'Right' }, { v: 'back', flip: false, label: 'Back' }, { v: 'side', flip: false, label: 'Left' }];
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('pixie.' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('pixie.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

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
  let dir = 0, tab = 'hair', sceneIdx = 0, bubbleUntil = 0;
  function defaultState() { return fromPreset(PRESETS[0], { name: 'Pixie', skin: 0, eyes: 0, job: 'Beginner' }); }
  function fromPreset(p, base) {
    const equip = {};
    for (const [cat, [id, color]] of Object.entries(p.s)) equip[cat] = { id, color: color || null };
    return { name: base.name, skin: base.skin, eyes: base.eyes, job: p.name, equip };
  }

  // ---------- character rendering with cache ----------
  const charCanvas = document.createElement('canvas'); charCanvas.width = CW; charCanvas.height = CH;
  const cctx = charCanvas.getContext('2d');
  let cacheKey = '';
  function drawChar(view, blink) {
    const key = JSON.stringify(state.equip) + state.skin + state.eyes + view + blink;
    if (key === cacheKey) return;
    cacheKey = key;
    const buf = renderCharacter(view, state, { blink });
    cctx.putImageData(new ImageData(buf, CW, CH), 0, 0);
  }

  // ---------- stage ----------
  const view = $('view'), g = view.getContext('2d');
  g.imageSmoothingEnabled = false;
  let blinkAt = performance.now() + 2500, blinkOn = false;
  function frame(t) {
    if (t > blinkAt) { blinkOn = true; if (t > blinkAt + 140) { blinkOn = false; blinkAt = t + 2200 + Math.random() * 2800; } }
    const d = DIRS[dir];
    SCENES[sceneIdx].draw(g, t);
    // shadow
    g.fillStyle = 'rgba(40,20,30,.22)';
    for (let y = 0; y < 4; y++) { const w = 26 - Math.abs(y - 1.5) * 4; g.fillRect(128 - w, GROUND - 2 + y, w * 2, 1); }
    drawChar(d.v, blinkOn && d.v !== 'back');
    const bob = Math.floor(t / 520) % 2;
    g.save();
    if (d.flip) { g.translate(SW, 0); g.scale(-1, 1); }
    g.drawImage(charCanvas, 64, GROUND - FEET_Y + bob);
    g.restore();
    if (bubbleUntil && t > bubbleUntil) { $('bubble').hidden = true; bubbleUntil = 0; }
    requestAnimationFrame(frame);
  }

  function turn(step) { dir = (dir + step + DIRS.length) % DIRS.length; $('viewlbl').textContent = DIRS[dir].label; }
  $('turnL').onclick = () => turn(-1);
  $('turnR').onclick = () => turn(1);
  let dragX = null;
  $('stage').addEventListener('pointerdown', e => { if (e.target.closest('button')) return; dragX = e.clientX; });
  window.addEventListener('pointermove', e => { if (dragX === null) return; const dx = e.clientX - dragX; if (Math.abs(dx) > 36) { turn(dx > 0 ? -1 : 1); dragX = e.clientX; } });
  window.addEventListener('pointerup', () => { dragX = null; });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowLeft') turn(-1); else if (e.key === 'ArrowRight') turn(1);
    else if (e.key === 'r' || e.key === 'R') randomize();
  });

  // ---------- header fields ----------
  SCENES.forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = s.name; $('map').appendChild(o); });
  $('map').onchange = () => { sceneIdx = +$('map').value; $('mapname').textContent = SCENES[sceneIdx].name; save(); };
  $('name').oninput = () => { state.name = $('name').value.trim() || 'Pixie'; refreshTags(); save(); };
  $('chatform').addEventListener('submit', e => {
    e.preventDefault(); const msg = $('chat').value.trim(); if (!msg) return;
    const b = $('bubble'); b.textContent = msg; b.hidden = false; bubbleUntil = performance.now() + 5000; $('chat').value = '';
  });
  function refreshTags() {
    $('nm').textContent = state.name;
    const n = Object.values(state.equip).filter(Boolean).length;
    $('statline').textContent = `Lv. ${8 + n * 9} · ${state.job || 'Adventurer'}`;
  }

  // ---------- thumbnails ----------
  function thumb(canvas, buf, crop) {
    let [x0, y0, x1, y1] = crop || bbox(buf);
    const w = x1 - x0 + 1, h = y1 - y0 + 1, S = canvas.width - 6;
    let s = Math.min(S / w, S / h); if (s >= 1) s = Math.floor(s);
    const t = document.createElement('canvas'); t.width = CW; t.height = CH; t.getContext('2d').putImageData(new ImageData(buf, CW, CH), 0, 0);
    const c = canvas.getContext('2d'); c.clearRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = s < 1;
    c.drawImage(t, x0, y0, w, h, Math.round((canvas.width - w * s) / 2), Math.round((canvas.height - h * s) / 2), w * s, h * s);
  }
  function bbox(buf) {
    let x0 = CW, y0 = CH, x1 = 0, y1 = 0;
    for (let i = 3; i < buf.length; i += 4) if (buf[i]) { const p = (i - 3) / 4, x = p % CW, y = p / CW | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x0 > x1 ? [0, 0, CW - 1, CH - 1] : [x0, y0, x1, y1];
  }
  const OY = FEET_Y - VIEWS.front.h, OX = 64 - VIEWS.front.cx;
  const HEAD_CROP = [OX - 22, OY - 40, OX + 102, OY + 84];

  // ---------- inventory ----------
  TABS.forEach(t => {
    const b = document.createElement('button'); b.className = 'tab'; b.setAttribute('role', 'tab'); b.textContent = t.label; b.dataset.tab = t.id;
    b.onclick = () => { tab = t.id; buildGrid(); }; $('tabs').appendChild(b);
  });
  $('count').textContent = `${ITEMS.length} items · ${TABS.length - 1} slots`;
  function cell(label, pressed, onclick) {
    const b = document.createElement('button'); b.className = 'cell'; b.setAttribute('aria-pressed', pressed); b.title = label; b.setAttribute('aria-label', label);
    b.onclick = onclick; $('grid').appendChild(b); return b;
  }
  function buildGrid() {
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    const grid = $('grid'); grid.innerHTML = '';
    if (tab === 'body') {
      SKIN_TONES.forEach((s, i) => {
        const b = cell(s.name, state.skin === i, () => { state.skin = i; changed(); });
        const c = document.createElement('canvas'); c.width = c.height = 64; b.appendChild(c);
        thumb(c, renderCharacter('front', { skin: i, eyes: state.eyes, equip: {} }), [OX, OY, OX + 80, OY + 127]);
      });
      buildSwatches(); showName(); return;
    }
    const cur = state.equip[tab];
    const none = cell('None', !cur, () => { delete state.equip[tab]; changed(); });
    none.innerHTML = '<span class="x">none</span>';
    ITEMS.filter(i => i.cat === tab).forEach(it => {
      const sel = cur && cur.id === it.id;
      const b = cell(it.name, !!sel, () => equip(it));
      const c = document.createElement('canvas'); c.width = c.height = 64; b.appendChild(c);
      const color = sel && cur.color ? cur.color : (tab === 'hair' ? (cur && cur.color) || '#7a4a2e' : it.dye);
      const withBody = tab === 'hair' || tab === 'hat' || tab === 'face';
      const buf = renderCharacter('front', { skin: state.skin, eyes: state.eyes, equip: {} }, { only: { id: it.id, color }, withBody });
      thumb(c, buf, withBody ? (tab === 'face' ? [OX + 4, OY + 28, OX + 76, OY + 70] : HEAD_CROP) : null);
    });
    buildSwatches(); showName();
  }
  function showName() {
    const n = $('itemname');
    if (tab === 'body') { n.innerHTML = `${SKIN_TONES[state.skin].name} <span>skin · ${EYE_COLORS[state.eyes].name} eyes</span>`; return; }
    const cur = state.equip[tab];
    n.innerHTML = cur ? `${ITEM_BY_ID[cur.id].name} <span>equipped</span>` : `<span>Nothing equipped in this slot</span>`;
  }
  function buildSwatches() {
    const box = $('swatches'); box.innerHTML = '';
    if (tab === 'body') {
      $('dyelbl').textContent = 'Eye color';
      EYE_COLORS.forEach((e, i) => {
        const b = document.createElement('button'); b.className = 'sw big'; b.setAttribute('aria-pressed', state.eyes === i);
        b.innerHTML = `<i style="background:${e.c[1]}"></i>${e.name}`; b.onclick = () => { state.eyes = i; changed(); }; box.appendChild(b);
      });
      return;
    }
    const cur = state.equip[tab];
    $('dyelbl').textContent = tab === 'hair' ? 'Hair color' : 'Dye';
    if (!cur) { box.innerHTML = '<span class="hint">Equip an item to dye it.</span>'; return; }
    const it = ITEM_BY_ID[cur.id], now = (cur.color || it.dye || '').toLowerCase();
    (tab === 'hair' ? HAIR_COLORS : DYES).forEach(hex => {
      const b = document.createElement('button'); b.className = 'sw'; b.style.background = hex; b.title = hex; b.setAttribute('aria-label', 'Dye ' + hex);
      b.setAttribute('aria-pressed', now === hex.toLowerCase()); b.onclick = () => { cur.color = hex; changed(); }; box.appendChild(b);
    });
    const pick = document.createElement('input'); pick.type = 'color'; pick.id = 'custom-dye'; pick.value = /^#[0-9a-f]{6}$/i.test(now) ? now : '#999999'; pick.title = 'Custom color';
    pick.oninput = () => { cur.color = pick.value; cacheKey = ''; save(); };
    pick.onchange = () => { cur.color = pick.value; changed(); };
    box.appendChild(pick);
    if (it.dye && tab !== 'hair') {
      const r = document.createElement('button'); r.className = 'btn'; r.textContent = 'Original'; r.style.padding = '2px 8px'; r.style.fontSize = '12px';
      r.onclick = () => { cur.color = null; changed(); }; box.appendChild(r);
    }
  }
  function equip(it) {
    const prev = state.equip[it.cat];
    state.equip[it.cat] = { id: it.id, color: it.cat === 'hair' ? (prev && prev.color) || '#7a4a2e' : null };
    if (it.cat === 'dress') { delete state.equip.top; delete state.equip.bottom; }
    if (it.cat === 'top' || it.cat === 'bottom') delete state.equip.dress;
    changed();
  }
  function changed() { cacheKey = ''; refreshTags(); buildGrid(); save(); }

  // ---------- presets / random ----------
  PRESETS.forEach(p => {
    const b = document.createElement('button'); b.className = 'chip'; b.textContent = p.name;
    b.onclick = () => { state = fromPreset(p, state); changed(); toast(`${p.name} outfit equipped`); };
    $('jobs').appendChild(b);
  });
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function randomize() {
    const eq = {}, by = c => ITEMS.filter(i => i.cat === c);
    eq.hair = { id: pick(by('hair')).id, color: pick(HAIR_COLORS) };
    if (Math.random() < .35) eq.dress = { id: pick(by('dress')).id, color: Math.random() < .5 ? pick(DYES) : null };
    else { eq.top = { id: pick(by('top')).id, color: pick(DYES) }; eq.bottom = { id: pick(by('bottom')).id, color: pick(DYES) }; }
    eq.shoes = { id: pick(by('shoes')).id, color: Math.random() < .5 ? pick(DYES) : null };
    for (const [c, p] of [['hat', .55], ['face', .3], ['back', .3], ['hand', .5]]) if (Math.random() < p) eq[c] = { id: pick(by(c)).id, color: Math.random() < .4 ? pick(DYES) : null };
    state.equip = eq; state.skin = Math.floor(Math.random() * 6); state.eyes = Math.floor(Math.random() * EYE_COLORS.length);
    state.job = pick(['Adventurer', 'Wanderer', 'Fashionista', 'Explorer', 'Dreamer']);
    changed();
  }
  $('rand').onclick = randomize;
  $('undress').onclick = () => { state.equip = {}; state.job = 'Beginner'; changed(); };

  // ---------- closet slots ----------
  function buildSlots() {
    const box = $('slots'); box.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const data = store.get('slot' + i);
      const d = document.createElement('div'); d.className = 'slot';
      const c = document.createElement('canvas'); c.width = 96; c.height = 132; d.appendChild(c);
      if (data) thumb(c, renderCharacter('front', data), [OX - 6, OY - 30, OX + 86, OY + 128]);
      else { const x = c.getContext('2d'); x.fillStyle = '#c9a985'; x.font = '600 14px "Pixelify Sans", sans-serif'; x.textAlign = 'center'; x.fillText('empty', 48, 70); }
      const r = document.createElement('div'); r.className = 'row';
      const sv = document.createElement('button'); sv.className = 'btn'; sv.textContent = 'Save';
      sv.onclick = () => { store.set('slot' + i, state); buildSlots(); toast(`Saved to slot ${i + 1}`); };
      const ld = document.createElement('button'); ld.className = 'btn'; ld.textContent = 'Wear'; ld.disabled = !data;
      ld.onclick = () => { state = JSON.parse(JSON.stringify(data)); $('name').value = state.name; changed(); toast(`Wearing slot ${i + 1}`); };
      r.append(sv, ld); d.appendChild(r); box.appendChild(d);
    }
  }

  // ---------- snapshot + share ----------
  function dialog(title, nodes) {
    $('dlgtitle').textContent = title; const body = $('dlgbody'); body.innerHTML = ''; nodes.forEach(n => body.appendChild(n));
    const d = $('dlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  $('dlgclose').onclick = () => { const d = $('dlg'); d.close ? d.close() : d.removeAttribute('open'); };
  $('snap').onclick = () => {
    const S = 3, c = document.createElement('canvas'); c.width = SW * S; c.height = SH * S;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(view, 0, 0, c.width, c.height);
    x.font = `600 ${11 * S}px "Pixelify Sans", sans-serif`; x.textAlign = 'center';
    const w = x.measureText(state.name).width + 14 * S; x.fillStyle = 'rgba(20,16,30,.8)'; x.fillRect(SW * S / 2 - w / 2, 187 * S, w, 14 * S);
    x.fillStyle = '#fff'; x.fillText(state.name, SW * S / 2, 198 * S);
    const img = document.createElement('img'); img.alt = `${state.name} snapshot`;
    img.src = c.toDataURL('image/png');
    const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'Right-click or long-press the picture to save it.';
    dialog('Snapshot', [img, p]);
  };
  function encode(s) { return btoa(unescape(encodeURIComponent(JSON.stringify({ n: s.name, k: s.skin, e: s.eyes, j: s.job, q: Object.fromEntries(Object.entries(s.equip).map(([c, v]) => [c, [v.id, v.color]])) })))); }
  function decode(code) {
    const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    const equip = {}; for (const [c, [id, color]] of Object.entries(o.q || {})) if (ITEM_BY_ID[id] && CATS.includes(c)) equip[c] = { id, color: color || null };
    return { name: String(o.n || 'Pixie').slice(0, 14), skin: +o.k % SKIN_TONES.length || 0, eyes: +o.e % EYE_COLORS.length || 0, job: String(o.j || 'Adventurer').slice(0, 20), equip };
  }
  $('share').onclick = () => {
    const ta = document.createElement('textarea'); ta.id = 'codebox'; ta.value = encode(state); ta.setAttribute('aria-label', 'Outfit code');
    const r = document.createElement('div'); r.className = 'row';
    const cp = document.createElement('button'); cp.className = 'btn go'; cp.textContent = 'Copy code';
    cp.onclick = () => { navigator.clipboard.writeText(ta.value).then(() => toast('Code copied'), () => { ta.select(); toast('Press Ctrl+C to copy'); }); };
    const ld = document.createElement('button'); ld.className = 'btn'; ld.textContent = 'Wear pasted code';
    ld.onclick = () => { try { state = decode(ta.value); $('name').value = state.name; changed(); $('dlgclose').click(); toast('Outfit loaded'); } catch (e) { toast('That code could not be read. Paste the full code and try again.'); } };
    r.append(cp, ld);
    const p = document.createElement('p'); p.className = 'hint'; p.textContent = 'Share this code with a friend, or paste theirs here and press Wear.';
    dialog('Outfit code', [ta, r, p]);
  };
  let toastT; function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 1800); }

  function save() { store.set('cur', { state, sceneIdx }); }

  // ---------- boot ----------
  function start(data) {
    const saved = (data && data.state) ? data : store.get('cur');
    if (saved && saved.state && saved.state.equip) { state = saved.state; sceneIdx = saved.sceneIdx || 0; }
    for (const c of Object.keys(state.equip)) if (!ITEM_BY_ID[state.equip[c]?.id]) delete state.equip[c];
    if (data && data.tab) tab = data.tab; if (data && data.dir) dir = data.dir;
    $('name').value = state.name; $('map').value = sceneIdx; $('mapname').textContent = SCENES[sceneIdx].name; $('viewlbl').textContent = DIRS[dir].label;
    refreshTags(); buildGrid(); buildSlots();
    requestAnimationFrame(frame);
  }
  window.claude?.hot?.snapshot?.(() => ({ state, sceneIdx, tab, dir }));
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
