# Pixie Closet art guide

How wardrobe items are drawn, and the quality bar they must meet.

## Target look

MapleStory-era (2005-2012) MMO avatar sprites. See `tools/reference-maple.png` for the shading level wanted, and `tools/reference.jpg` for the body that every item is worn on. The base body is fixed: never redraw or recolor it except through the skin/eye options.

What that style means in practice:

- **Hue-shifted ramps.** Lights lean warm/yellow, shadows lean cool/violet. `ramp()` does this for you; use its tones instead of inventing flat colors.
- **Clear light direction.** Light comes from the top-left. Lit edges get `lt`/`hi`, the bottom-right side and the area under overlapping parts get `sh`/`dp`.
- **Coloured outlines.** Every shape has a 1px outline in a dark version of its own hue (`r.line`), never pure black. Internal lines (folds, seams, panel edges) use `r.dp` or `r.sh`, so they read softer than the silhouette.
- **Volume from overlap.** Collars, cuffs, belts, straps, trims, lapels, pockets, hems, ruffles and laces are separate painted pieces with their own outline and shading, each casting a small shadow on what is under it.
- **Folds.** Cloth has 2-5 creases where it bunches: elbows, waist, under the chest, behind knees, skirt pleats. Use `R.crease()`.
- **Specular on hard materials.** Metal, leather, gems, glass and patent shoes get a bright `spec` glint and high contrast.
- **Hair is clumps, never a helmet.** Hair is built from many tapered locks (`R.lock()`), each with its own outline and shading, overlapping so the outlines read as strand separations. Bangs end in pointed tips. Add highlight strokes along the strands (shine band) and cast a warm shadow on the face under the bangs.
- **Detail density.** Our character is about twice the pixel size of a MapleStory avatar, so it can and should carry more detail: trims, stitches, buttons with highlights, emblems, patterns, layered pieces. A plain filled shape is not finished.
- **No pillow shading, no noise.** Shade by form and light direction, not uniformly darker toward every edge. No random speckle dithering.

## Files and how they load

All files in `src/manifest.json` are concatenated into one classic `<script>` in this order:
`sprites.js, engine.js, items/_shared.js, items/top.js … items/hand.js, items/_end.js, scenes.js, ui.js`.

Each `src/items/<category>.js` is wrapped in an IIFE `(() => { ... })();`. Keep every helper inside it so names never collide with other files. Shared helpers (`item`, `shirtMask`, `pantsMask`, `skirtMask`, `feetMask`, `handMask`, `waistBand`, `buttons`, `neckCut`, `puffs`, `collarHigh`, `tri`, `mx`, `isFront/isSide/isBack`, patterns `stripes/dots/plaid/checker`, base ramps `WHITE, GOLD, SILVER, BLACK, WOOD, RED, PINK, GREEN`) live in `items/_shared.js`.

## Registering an item

```js
item(cat, id, name, defaultDyeHex, (R, phase, r, hex) => { ... }, { kind, layer })
```

- `cat`: `hair | top | bottom | dress | shoes | hat | face | back | hand`.
- `id` must be unique across all files (`node tools/check.js` fails on duplicates). Never rename existing ids: presets and saved outfits use them.
- `r` is the ramp of the player's chosen dye (or the default). The item's main material must use `r` so dyeing works. Fixed accent materials (gold trim, white lace, metal buckle) may use their own ramps.
- `kind` sets the ramp kind used for `r`: `'cloth'` (default), `'metal'`, `'leather'`, `'gem'`, `'hair'` (hair items get `'hair'` automatically).
- `layer: 'outer'` on tops draws them after bottoms (untucked).
- `phase` is `'back'` (drawn before the body, i.e. behind it) or `'front'` (after the body). Draw order per phase:
  - back: `back, hair, hand`
  - body
  - front: `shoes, top(inner), bottom, top(outer), dress, back, face, hair, hat, hand`
- Views: `R.view` is `'front' | 'side' | 'back'`. The side view faces **left** (the UI mirrors it for the right-facing direction). In the back view the character's right hand is on the viewer's left (`R.V.hand`). Every item must look right in all three views.
- Selecting a dress removes top and bottom, and the other way round.

## Coordinates and landmarks

All drawing uses view-local pixel coordinates of the body sprite (`R.V`). Negative y is above the head (hats can go to about y = -38). The canvas has room for about 22 px left/right of the body for wings, weapons and big hair.

| landmark | front | side | back |
| --- | --- | --- | --- |
| sprite size w × h | 81 × 128 | 71 × 131 | 82 × 129 |
| `cx` (centre line) | 40 | 35 | 40 |
| head bottom / torso top | 66 / 67 | 68 / 70 | 66 / 67 |
| chest / waist / hip | 78 / 92 / 96 | 80 / 92 / 97 | 78 / 92 / 96 |
| crotch / knee / foot top | 101 / 109 / 116 | 104 / 111 / 119 | 101 / 109 / 116 |
| hand top (`handY`) | 89 | 92 | 89 |
| torso left/right edge at waist | 25 / 55 | 21 / 50 | 25 / 55 |
| `neck` [x,y] | [40,66] | [31,69] | [40,65] |
| `hand` (holding point) | [64,97] | [43,99] | [16,97] |
| `eyes` centres | [23,49], [57,49] | [19,51] | — |
| head | x 6..74, y 0..66, ears x 0..12 / 68..80, y 42..58 | x 0..70 (face on the left, ear near x 42..52, y 44..64) | x 4..77 |

Body parts: `R.part(x,y)` returns `'head' | 'arm' | 'hand' | 'torso' | 'leg' | 'foot' | null`. `R.body((x,y,part) => bool)` returns a mask of body pixels. `R.isSkin(x,y,part?)` is true on skin pixels. `R.bodyIdx(x,y)` returns the reference palette index (0-2 are contour lines, 5+ are skin tones).

To check exact positions, render a sheet at a large scale (see Tools) and count pixels; each item cell is `128 × 176` canvas px, and the body sits at offset `ox = 64 - cx`, `oy = 166 - h`.

## Masks

`R.M()` creates an empty mask. Methods all take view-local coordinates and are chainable:
`set, has, rect(x0,y0,x1,y1), ellipse(cx,cy,rx,ry), poly([[x,y],…]), line(x0,y0,x1,y1,w), add(m), sub(m), and(m), keep((x,y)=>bool), clone(), dilate(n), mirror()` (mirror around `cx`, adds the mirrored copy), `each((x,y,i)=>…)`, `empty()`.

## Painting

`R.paint(mask, ramp, opts)` is the shader. It builds a height field from each pixel's distance to the mask edge (and to internal contour lines), lights it from the top-left and maps it onto the ramp, then outlines the edge. Options:

| option | effect |
| --- | --- |
| `lines: true` | keep the body's own contour lines inside the mask (arm/torso seam, leg gap). Use for anything skin-tight drawn with `R.body(...)` masks. |
| `flat: true` | ignore the body's shading underneath. Use for shapes that float off the body (skirts, capes, hats, hair, weapons). |
| `round: n` | height-field radius in px (default 5). Bigger = softer, rounder shading; 2-3 for thin straps and locks, 8-12 for big hair masses and skirts. |
| `bias: ±n` | push the whole piece lighter/darker (e.g. `-0.25` for an inner lining or a part in shadow). |
| `shiny: bool` | allow the specular tone (on by default for metal/gem/hair ramps). |
| `pattern: (x,y)=>bool or ramp`, `alt: ramp` | per-pixel second material (stripes, plaid, polka dots, embroidery). Patterns are shaded with the same tones. |
| `toneMap: (x,y,tone)=>tone` | override the tone per pixel (0 spec … 5 deep). |
| `edge: (x,y,isInternal)=>tone or rgb or null` | override the outline per pixel, e.g. return `TONE.DP` near a hair lock's root so locks merge into the mass. |
| `noOutline`, `outline: rgb`, `alpha`, `headOnly`, `light: [x,y,z]` | as named |

Ramps: `ramp(hexOrRgb, kind)` gives `r.t = [spec, hi, lt, base, sh, dp, line]` (also `r.spec, r.hi, r.lt, r.base, r.sh, r.dp, r.line`). `TONE.SPEC … TONE.LINE` are the indexes. To derive a related material: `ramp(r.sh)` (darker lining), `ramp(mix(r.base, [255,255,255], .5))` (pale trim). `mix`, `hexRgb`, `rgbHex` are global.

Detail primitives (view-local coordinates):

| call | draws |
| --- | --- |
| `R.crease(p0, p1, p2, r, clip, {tone, lipTone, wide, noLip})` | a fold along a Bezier curve: dark crease plus a lit lip on its upper-left side, clipped to `clip` |
| `R.curve(p0, p1, p2)` | points along a Bezier (for your own strokes) |
| `R.stroke(points, rgb, clip, w)` | draw points in a colour, optional clip mask |
| `R.stitch(points, rgb, clip, on, off)` | dashed stitch line |
| `R.lock(p0, p1, p2, w0, w1)` | tapered curved mask (hair lock, feather, ribbon tail, flame) |
| `R.gem(x, y, rad, ramp)` | faceted gem with glint |
| `R.stud(x, y, ramp, size)` | button/rivet with highlight |
| `R.sparkle(x, y, rgb, len)` | four-point glint |
| `R.shadow(mask, {dx, dy, tint, only, strength})` | cast shadow: darkens what is already drawn under the mask shifted by (dx,dy). Use after painting a piece that sits on top of another (bangs on the face: `tint: [.95,.76,.74]`, `only: (x,y) => R.isSkin(x,y,'head')`; collar on shirt; skirt on legs; hat brim on hair). |
| `R.tint(mask, mul, only)` | multiply already-drawn pixels (ambient occlusion) |
| `R.fill(mask, color)` | flat fill, color may be hex/rgb/ramp |

Example: a lock-based fringe (front view).

```js
const order = [-4, 4, -3, 3, -2, 2, -1, 1, 0];          // outer locks first, centre on top
for (const i of order) {
  const tip = 32 + (Math.abs(i) % 2) * 3;
  const m = R.lock([cx + i * 4, 2], [cx + i * 5.2, 16], [cx + i * 6, tip], 10, 0);
  R.paint(m, r, { round: 3.5, flat: true, edge: (x, y) => y < 12 ? TONE.DP : null });
  all.add(m);
}
R.shadow(all, { dx: 0, dy: 2, tint: [.95, .76, .74], only: (x, y) => R.isSkin(x, y, 'head') });
```

## Tools

- `node tools/sheet.js out.png <filter> [--color=#hex] [--views=front,side,back] [--base=hair:bob,top:tee,…] [--skin=0..7]`
  Renders a contact sheet. `<filter>` is a comma list of categories and/or ids. `S=4 N=1` env vars set scale and items per row; use `S=4` or `S=5` with 1-2 items to inspect detail. Then look at the PNG with the Read tool.
- `node tools/check.js [category]`: loads everything, fails on duplicate ids or any item that throws in any view with light, dark and saturated dyes, and reports render time. Keep a full outfit under about 120 ms.
- `python3 build.py --out <dir> --head-items` builds a preview page using the committed item files (useful while others are mid-edit).

## Definition of done for an item

1. Reads clearly in front, side and back views at 1x (each view is checked, not just front).
2. Has at least: correct silhouette and layering, ramp shading with a visible light direction, coloured outline, and 2+ pieces of secondary detail (folds, trims, seams, buttons, highlights, pattern, emblem, cast shadow).
3. Dyes well: check with `--color=#f7f3f8` (white), `--color=#2b2633` (near black) and a saturated color. Nothing turns to mud, nothing loses its outline.
4. Never covers the face (eyes y 40-58 in front) unless that is the point (masks, glasses), never paints over hands that should hold things, and does not leave gaps between pieces.
5. `node tools/check.js` passes.
