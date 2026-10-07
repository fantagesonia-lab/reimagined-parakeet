"""Turn tools/sprites_raw.json (extracted from reference.jpg) into src/sprites.js."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((root / 'tools/sprites_raw.json').read_text())
lines = ['// Base body sprites traced 1:1 from tools/reference.jpg (front / side / back).',
         '// Each char is a palette index (a..p), "." is transparent.',
         'const BODY_PALETTE = ' + json.dumps(d['palette']) + ';',
         'const BODY_SPRITES = {']
for name, v in d['views'].items():
    lines.append(f'  {name}: {{ w: {v["w"]}, h: {v["h"]}, rows: [')
    lines += [f'    "{r}",' for r in v['rows']]
    lines.append('  ] },')
lines.append('};')
(root / 'src/sprites.js').write_text('\n'.join(lines) + '\n')
