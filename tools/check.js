// Sanity check for the wardrobe: syntax, unique ids, every item draws in every view with
// light / dark / saturated dyes without throwing, and render time stays reasonable.
//   node tools/check.js [category]
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console: { log() {}, warn: (...a) => errors.push(a.join(' ')) } }, errors = [];
vm.createContext(ctx);
const files = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/manifest.json'), 'utf8')).filter(f => !/ui\.js|scenes\.js/.test(f));
let ok = true;
for (const f of files) {
  try { vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8'), ctx, { filename: f }); }
  catch (e) { console.log(`FAIL load ${f}: ${e.message}`); ok = false; }
}
vm.runInContext('this.API={renderCharacter,ITEMS,ITEM_BY_ID};', ctx);
const { renderCharacter, ITEMS } = ctx.API, only = process.argv[2];
const seen = {};
for (const it of ITEMS) { if (seen[it.id]) { console.log(`FAIL duplicate id "${it.id}" (${seen[it.id]} and ${it.cat})`); ok = false; } seen[it.id] = it.cat; }
const views = ['front', 'side', 'back'], colors = [undefined, '#f7f3f8', '#2b2633', '#e0475a', '#5bb36a'];
let worst = { ms: 0 };
for (const it of ITEMS.filter(i => !only || i.cat === only)) {
  for (const v of views) for (const color of colors) {
    errors.length = 0;
    const t = Date.now();
    const buf = renderCharacter(v, { skin: 0, eyes: 0, equip: { [it.cat]: { id: it.id, color } } }, {});
    const ms = Date.now() - t; if (ms > worst.ms) worst = { ms, id: it.id, v };
    if (errors.length) { console.log(`FAIL ${it.cat}/${it.id} ${v} ${color || 'default'}: ${errors[0]}`); ok = false; break; }
  }
}
// full outfit timing
const full = { hair: { id: 'long' }, top: { id: 'tee' }, bottom: { id: 'jeans' }, shoes: { id: 'boots' }, hat: { id: 'crown' }, face: { id: 'roundglass' }, back: { id: 'cape' }, hand: { id: 'sword' } };
let t = Date.now(); for (let k = 0; k < 5; k++) renderCharacter('front', { skin: 0, eyes: 0, equip: full }, {});
const fullMs = (Date.now() - t) / 5;
const counts = {}; ITEMS.forEach(i => counts[i.cat] = (counts[i.cat] || 0) + 1);
console.log(`items: ${ITEMS.length} ${JSON.stringify(counts)}`);
console.log(`slowest single-item render: ${worst.ms}ms (${worst.id}, ${worst.v}); full outfit: ${fullMs.toFixed(1)}ms`);
if (fullMs > 120) { console.log('WARN full outfit render is slow (>120ms)'); }
console.log(ok ? 'OK' : 'FAILED'); process.exit(ok ? 0 : 1);
