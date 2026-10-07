"""Inline src/ into one self-contained page.
  python3 build.py                      -> index.html (full document) + dist/pixie-closet.html (body fragment)
  python3 build.py --out DIR            -> write both files into DIR instead (for previews)
  python3 build.py --out DIR --head-items  -> use src/items/*.js as committed at git HEAD (stable art while it is being edited)
"""
import json, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parent
src = root / 'src'
args = sys.argv[1:]
out = pathlib.Path(args[args.index('--out') + 1]).resolve() if '--out' in args else root
head_items = '--head-items' in args
def read(f):
    if head_items and f.startswith('items/'):
        return subprocess.run(['git', 'show', f'HEAD:src/{f}'], cwd=root, capture_output=True, text=True, check=True).stdout
    return (src / f).read_text()
js = '\n'.join(read(f) for f in json.loads((src / 'manifest.json').read_text()))
frag = (src / 'app.html').read_text().replace('/*__SCRIPTS__*/', js)
(out / 'dist').mkdir(parents=True, exist_ok=True)
(out / 'dist/pixie-closet.html').write_text(frag)
head, _, body = frag.partition('</style>')
(out / 'index.html').write_text('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + head + '</style>\n</head>\n<body>\n' + body + '</body>\n</html>\n')
print('built', len(frag), 'bytes ->', out)
