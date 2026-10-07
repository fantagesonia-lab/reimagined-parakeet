// Dev helper: render items in every view into a PNG contact sheet.
//   node tools/sheet.js out.png <filter> [--color=#hex] [--views=front,side,back] [--base=hair:bob,top:tee,...]
//   <filter>: comma list of categories and/or item ids (e.g. "hair" or "tee,armor,hat")
//   env S=scale (default 2), N=items per row (default 4), BG=#hex background
// Files are loaded one at a time; a file with a syntax error is skipped with a warning,
// and a failing item draw is caught, so one broken file never blocks another category.
const fs = require('fs'), zlib = require('zlib'), vm = require('vm'), path = require('path');
const args = process.argv.slice(2), flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const [outFile, filter] = args.filter(a => !a.startsWith('--'));
const ctx = { console }; vm.createContext(ctx);
const files = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/manifest.json'), 'utf8')).filter(f => !/ui\.js|scenes\.js/.test(f));
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
  try { vm.runInContext(code, ctx, { filename: f }); } catch (e) { console.warn(`! skipped ${f}: ${e.message}`); }
}
vm.runInContext('this.API={renderCharacter,ITEMS,CW,CH};', ctx);
const { renderCharacter, ITEMS, CW, CH } = ctx.API;
const want = (filter || '').split(',').filter(Boolean);
const list = ITEMS.filter(i => !want.length || want.includes(i.cat) || want.includes(i.id));
const views = (flags.views || 'front,side,back').split(',');
const baseEquip = {};
(flags.base || 'hair:bob,top:tee,bottom:jeans,shoes:sneakers').split(',').filter(Boolean).forEach(p => { const [c, id] = p.split(':'); baseEquip[c] = { id }; });
const S = +(process.env.S || 2), PER = Math.min(+(process.env.N || 4), list.length || 1);
const W = PER * views.length * CW * S, H = Math.max(1, Math.ceil(list.length / PER)) * CH * S, img = Buffer.alloc(W * H * 4);
const bg = (process.env.BG || '#74c4a8').replace('#', '').match(/../g).map(h => parseInt(h, 16));
for (let i = 0; i < img.length; i += 4) { img[i] = bg[0]; img[i + 1] = bg[1]; img[i + 2] = bg[2]; img[i + 3] = 255; }
const t0 = Date.now();
list.forEach((it, n) => {
  const eq = JSON.parse(JSON.stringify(baseEquip));
  if (it.cat === 'dress') { delete eq.top; delete eq.bottom; }
  if (it.cat === 'top' || it.cat === 'bottom') delete eq.dress;
  eq[it.cat] = { id: it.id, color: flags.color || (it.cat === 'hair' ? '#d8743a' : undefined) };
  if (baseEquip.hair && it.cat !== 'hair') eq.hair.color = '#7a4a2e';
  views.forEach((v, k) => {
    const buf = renderCharacter(v, { skin: +(flags.skin ?? 0), eyes: +(flags.eyes ?? 0), equip: eq }, { blink: false });
    const X0 = ((n % PER) * views.length + k) * CW * S, Y0 = Math.floor(n / PER) * CH * S;
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
fs.writeFileSync(outFile, png(W, H, img));
console.log(`${list.length} items: ${list.map(i => i.id).join(', ')} (${Date.now() - t0}ms)`);
