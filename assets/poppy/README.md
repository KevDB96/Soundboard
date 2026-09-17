# Poppy Soundboard Asset Foundation

This directory contains the approved, implementation-ready PNG artwork imported from:

`C:\Users\kevin\Documents\ChatGPT\Soundboard\Poppy-Soundboard-Assets.zip`

The pack provenance describes these as extracted from the approved pastel/faun/bard mock-up asset generations. The pack manifest records the original source artwork and extraction boxes where applicable. Source sheets are intentionally excluded from this runtime asset directory.

## Imported categories

- `branding/` — 3 files: `poppy-bard-emblem-lute.png`, `poppy-soundboard-logo.png`, `small-sounds-brighter-days-plaque.png`
- `decor/` — 14 files: `cluster-bottom-left.png`, `cluster-bottom-right.png`, `corner-bottom-left.png`, `corner-bottom-right.png`, `divider-bottom-center.png`, `divider-small.png`, `flower-vine-small.png`, `leaf-single.png`, `music-sparkles.png`, `pink-flower-cluster.png`, `vine-corner-left.png`, `vine-footer-left.png`, `vine-footer-moon.png`, `vine-horizontal.png`
- `sounds/` — 12 files: `applause.png`, `birdsong.png`, `chime.png`, `drum.png`, `faun-call.png`, `flower-chime.png`, `forest-ambience.png`, `gentle-wind.png`, `laugh.png`, `lute-strum.png`, `pan-flute.png`, `water-trickling.png`
- `ui/` — 27 files: `action-add.png`, `action-delete.png`, `action-edit.png`, `action-folder.png`, `action-profile.png`, `action-upload.png`, `filter-all.png`, `filter-custom.png`, `filter-favorites.png`, `header-favorites.png`, `header-help.png`, `header-settings.png`, `header-sound.png`, `nav-collections.png`, `nav-favorites.png`, `nav-next.png`, `nav-previous.png`, `nav-settings.png`, `nav-soundboard.png`, `now-playing-bar.png`, `play-green.png`, `play-pink.png`, `progress-slider.png`, `search-bar.png`, `search-icon.png`, `sound-list-row.png`, `volume-slider.png`
- `states/` — 17 files: `delete-sound-dialog.png`, `empty-state-deer.png`, `help-deer.png`, `loading-flower.png`, `settings-panel.png`, `sound-added-toast.png`, `sound-button-default-1.png`, `sound-button-default-2.png`, `sound-button-default-3.png`, `sound-button-default-4.png`, `sound-button-disabled.png`, `sound-button-hover.png`, `sound-button-normal.png`, `sound-button-pressed.png`, `sound-button-selected.png`, `toggle-off.png`, `toggle-on.png`

Total imported: 72 PNG files. All imported PNGs were verified non-empty after extraction.

## Derived assets

`ui/action-profile.png` is the one asset here that did not come from the pack. It was
built from `ui/header-settings.png`, which is a crop fragment: a neighbouring badge bleeds
in at its right edge, and it carries roughly 10 px of stray artwork below the circle, so its
naive alpha bbox (126x138) is not square. The gear circle was instead located by its widest
chord (127 px) plus a vertical scan at that centre for the top edge, then scaled by 0.921
onto a 125x125 transparent canvas so its circle framing matches `ui/action-edit.png`
exactly (circle 117 px at offset 4,4). It exists because the header's profile-settings
button and the sound-slot edit toggle previously shared `action-edit.png` and sat side by
side on phones, where two identical pencils read as the same control.

## Runtime trim

Runtime-referenced PNGs were inspected with Pillow. Trimmed files use the substantial-alpha (alpha >= 8) artwork bounds plus a 5% per-side transparent margin (minimum 4 px); the original nonzero-alpha fringe was retained when it fell within that margin. Files already within those conservative bounds were skipped. No source sheets were modified.

| Asset | Before | Before alpha bbox | After | After alpha bbox | Result |
| --- | ---: | --- | ---: | --- | --- |
| `branding/poppy-soundboard-logo.png` | 628x315 | (4,4)-(624,311) | 628x315 | (4,4)-(624,311) | Skipped, tight |
| `ui/action-upload.png` | 153x154 | (4,4)-(149,150) | 144x154 | (0,4)-(140,150) | Trimmed |
| `ui/action-delete.png` | 143x162 | (4,4)-(139,158) | 143x155 | (4,4)-(139,155) | Trimmed |
| `ui/action-add.png` | 105x156 | (4,4)-(101,152) | 105x156 | (4,4)-(101,152) | Skipped, tight |
| `ui/action-edit.png` | 148x156 | (4,4)-(144,152) | 148x156 | (4,4)-(144,152) | Skipped, tight |
| `decor/divider-small.png` | 560x250 | (6,6)-(554,244) | 533x132 | (7,1)-(512,129) | Trimmed |
| `decor/vine-horizontal.png` | 997x442 | (6,6)-(991,436) | 997x205 | (6,0)-(991,205) | Trimmed |
| `sounds/pan-flute.png` | 1219x1213 | (18,18)-(1201,1195) | 1198x613 | (3,25)-(1180,613) | Trimmed |
| `sounds/birdsong.png` | 1266x1271 | (18,18)-(1248,1253) | 1196x592 | (1,0)-(1170,592) | Trimmed |
| `sounds/laugh.png` | 1006x908 | (18,18)-(988,890) | 1006x586 | (18,25)-(988,575) | Trimmed |
| `sounds/applause.png` | 1233x1195 | (18,18)-(1215,1177) | 1133x768 | (0,0)-(1133,765) | Trimmed |
| `sounds/drum.png` | 1173x1213 | (18,18)-(1155,1195) | 1111x673 | (48,14)-(1098,648) | Trimmed |
| `sounds/chime.png` | 1276x1227 | (18,18)-(1258,1209) | 1040x718 | (3,0)-(1040,714) | Trimmed |
| `sounds/forest-ambience.png` | 458x507 | (8,8)-(450,499) | 458x330 | (8,0)-(450,322) | Trimmed |
| `sounds/faun-call.png` | 499x535 | (8,8)-(491,527) | 431x288 | (0,10)-(425,280) | Trimmed |
| `sounds/lute-strum.png` | 472x448 | (8,8)-(464,440) | 461x319 | (6,12)-(460,311) | Trimmed |
