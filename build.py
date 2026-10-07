"""Inline src/ into one self-contained page.
  index.html            full HTML document (open it directly or host on GitHub Pages)
  dist/pixie-closet.html  body-only fragment (for hosts that add their own <html> skeleton)
"""
import pathlib
root = pathlib.Path(__file__).resolve().parent
src = root / 'src'
js = '\n'.join((src / f).read_text() for f in ['sprites.js', 'engine.js', 'items.js', 'scenes.js', 'ui.js'])
frag = (src / 'app.html').read_text().replace('/*__SCRIPTS__*/', js)
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/pixie-closet.html').write_text(frag)
head, _, body = frag.partition('</style>')
(root / 'index.html').write_text('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + head + '</style>\n</head>\n<body>\n' + body + '</body>\n</html>\n')
print('built', len(frag), 'bytes')
