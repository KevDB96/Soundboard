# App icons

The install/home-screen icon set is raster PNG, all four files derived from one
1254x1254 master illustration: a coral poppy whose stamen is a cream eighth-note,
inside a cream rounded tile sitting on a plum field. The master is kept outside
the repo (currently `C:\Users\kevin\Soundboard\app icon.png`) so a ~2 MB image
isn't published or cached for nothing.

| File | Size | Manifest purpose | Also used by |
| --- | ---: | --- | --- |
| `icon-192.png` | 192x192 | `any` | `<link rel="icon">`, i.e. the browser tab |
| `icon-512.png` | 512x512 | `any` | install prompt, desktop |
| `icon-maskable-512.png` | 512x512 | `maskable` | Android adaptive / launcher icon |
| `apple-touch-icon.png` | 180x180 | — | `<link rel="apple-touch-icon">` on iOS |

There is no SVG icon any more. The old hand-drawn pink-poppy SVGs are gone from
`master` (recover them from git history if ever needed).

## Why two different 512s

`icon-512.png` is the master scaled down untouched: the cream tile keeps its own
~25% corner radius and the plum field reaches all four edges. That is right for a
browser tab, a desktop install, and iOS.

Android launchers crop the icon to their own shape — circle, squircle, teardrop —
and only guarantee that the central circle of 80% diameter stays visible. Pointing
that at the as-is art slices the tile's corners off and cuts the gold arc frame,
so `icon-maskable-512.png` instead shrinks the master to 80% (410 px) and centres
it on a full-bleed plum square filled with `#4D2432`, the colour sampled from the
master's own corners. The master's ~2%-wide plum border blends invisibly into that
mat, so the whole illustration survives whatever mask the launcher applies.

The two are deliberately not interchangeable: the padded variant as `any` would
show a small picture in a big frame in a browser tab, and the as-is art as
`maskable` would get its corners cut. The as-is art is also what iOS wants, since
iOS's squircle radius (~22%) is *smaller* than the tile's own corner radius (~25%),
so the tile already fits inside it with plum showing at the corners.

The 192 and 512 `any` icons are byte-identical crops of the same master, which is
why they read as the same icon rather than two different designs.

## Regenerating

Nothing in `icons/` is built at deploy time — the four PNGs are committed. If the
master changes, or another size is needed, the derivation is:

- master must stay opaque (24bpp RGB, no alpha): iOS renders a transparent
  `apple-touch-icon` on white
- measured cream-tile bounds in the master: x 23..1230, y 18..1213 — i.e. a plum
  border of about 2%, and note the tile is 1208x1196, very slightly wider than tall
- plum fill: `#4D2432` (averaged from the master's four corners)
- resample with high-quality bicubic; the master downscales cleanly to all four
  sizes, nothing here is upscaled
- as-is art at 192, 512 and 180; the maskable at 80% of 512 = 410 px centred

## Cost

These four files total roughly 1 MB, and unlike the app's other artwork they do
not compress well — the illustration is painterly, with smooth gradients that PNG's
lossless filters cannot squeeze the way the flat UI art trims down. All four are in
the service worker's shell list, so that is the offline cost of the icon set.
WebP would be roughly 5x smaller and Chrome would accept it in the manifest, but
Safari's `apple-touch-icon` requires PNG, so the set stays PNG for consistency.
