// Dev helper: render every item in every view into a PNG contact sheet.
// usage: node tools/sheet.js out.png [category]
const fs = require('fs'), zlib = require('zlib'), vm = require('vm'), path = require('path');
const src = ['sprites.js', 'engine.js', 'items.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + '\nthis.API={renderCharacter,ITEMS,CW,CH};', ctx);
const { renderCharacter, ITEMS, CW, CH } = ctx.API;
const cat = process.argv[3];
const base = { skin: 0, eyes: 0, equip: { hair: { id: 'bob', color: '#7a4a2e' }, top: { id: 'tee' }, bottom: { id: 'jeans' }, shoes: { id: 'sneakers' } } };
const list = ITEMS.filter(i => !cat || cat.split(',').includes(i.cat) || cat.split(',').includes(i.id));
const views = ['front', 'side', 'back'];
const S = +(process.env.S || 2), cols = views.length * Math.min(+(process.env.N||4), list.length), rows = Math.ceil(list.length / +(process.env.N||4));
const W = cols * CW * S, H = rows * CH * S, img = Buffer.alloc(W * H * 4, 0);
for (let i = 0; i < img.length; i += 4) { img[i] = 120; img[i + 1] = 196; img[i + 2] = 168; img[i + 3] = 255; }
list.forEach((it, n) => {
  const eq = JSON.parse(JSON.stringify(base.equip));
  if (it.cat === 'dress') { delete eq.top; delete eq.bottom; }
  eq[it.cat] = { id: it.id, color: it.hair ? '#d8743a' : undefined };
  views.forEach((v, k) => {
    const buf = renderCharacter(v, { skin: n % 8, eyes: n % 8, equip: eq }, { blink: false });
    const X0 = ((n % +(process.env.N||4)) * 3 + k) * CW * S, Y0 = Math.floor(n / +(process.env.N||4)) * CH * S;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const o = (y * CW + x) * 4; if (!buf[o + 3]) continue;
      const a = buf[o + 3] / 255;
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) {
        const p = ((Y0 + y * S + dy) * W + X0 + x * S + dx) * 4;
        for (let c = 0; c < 3; c++) img[p + c] = buf[o + c] * a + img[p + c] * (1 - a);
      }
    }
  });
});
function png(w, h, data) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(process.argv[2], png(W, H, img));
console.log('items', list.length);
