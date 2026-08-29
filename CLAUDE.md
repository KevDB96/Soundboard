# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, installable soundboard PWA. No build step, no backend, no
dependencies — plain HTML/CSS/JS served as-is. Each profile has its own
background image and a 3x3 grid of tappable buttons; tapping a button plays
the mp3 assigned to it. Distribution is via "Add to Home Screen" (Android
Chrome and iOS Safari), not app stores — see README.md for the install steps.

## Deployment

Hosted on GitHub Pages, served from the `master` branch root:
https://kevdb96.github.io/Soundboard/ (repo:
https://github.com/KevDB96/Soundboard). There is no CI/build step — pushing
to `master` is what publishes; GitHub rebuilds Pages automatically on push
and it's typically live within a minute or two. `.nojekyll` at the repo root
disables Jekyll processing since this is already plain static HTML/CSS/JS.
All asset paths in the app are relative (no leading `/`) specifically so
they resolve correctly under the `/Soundboard/` project-page subpath as well
as when served from the filesystem root locally.

## Running it

Must be served over HTTP, not opened as `file://` — the service worker and
IndexedDB won't behave correctly otherwise:

```
npx serve .
```

or

```
python -m http.server 8000
```

There is no test suite, linter, or build command — it's plain script tags
loaded directly by index.html.

On first load with no saved state, the app seeds one default profile,
`Poppy` (see `App.init` in [js/app.js](js/app.js)). A second profile, `GM`,
was seeded here too until it was removed for now — re-add it with
`newProfile('GM')` if it comes back.

## Visual/browser inspection

There's no browser automation set up as a project dependency (`playwright` is
not in a `package.json` here — there isn't one). To visually inspect the app,
Playwright's Chromium was installed globally via
`npx playwright install chromium --with-deps`, and a driver script installed
into a scratch npm project (outside this repo) can `require('playwright')`
against it. The pattern: serve the app (`npx serve .`), launch headless
Chromium with Playwright, `page.goto()` the served URL, interact with
selectors (`.profile-tab`, `.sound-btn`, `#edit-toggle-btn`, `#button-editor`,
`#profile-editor`), and screenshot. Watch `page.on('console')` /
`page.on('pageerror')` for errors — the app throws none under normal use.

## Architecture

Three scripts, loaded in this order by [index.html](index.html), each as a
plain IIFE attached to `window` (no bundler, no modules):

- [js/storage.js](js/storage.js) — the `Storage` object. Two persistence
  layers, split by size: small JSON (the profile/button structure) goes in
  `localStorage` under one key; binary blobs (mp3s, background images) go in
  IndexedDB keyed by string, since localStorage can't hold them efficiently.
  Blob keys (`soundKey`, `backgroundKey`) are stored in the localStorage JSON
  and dereferenced through `Storage.getBlob(key)`.
- [js/audio.js](js/audio.js) — the `AudioPlayer` object. Caches one `<audio>`
  element per object URL so re-tapping a button restarts the sound rather
  than layering overlapping playbacks.
- [js/app.js](js/app.js) — the `App` object and the whole data model. State
  shape:
  ```
  { activeProfileId, profiles: [{ id, name, backgroundKey, buttons: [{ label, color, soundKey, hidden }] }] }
  ```
  A `hidden` button is skipped entirely from the grid outside edit mode (its
  sound/label/color stay intact); inside edit mode it still renders, dimmed
  and suffixed "(hidden)", so it can be found and un-hidden.
  Blob object URLs are cached in-memory per session (`objectUrlCache`) since
  `URL.createObjectURL` is relatively expensive and blobs don't change often.

The folder icon triggers bulk import (`wireImportSounds`/`onImportSounds` in
[js/app.js](js/app.js)): the hidden `#import-sounds-input` has both
`webkitdirectory` and `multiple` set, so Chrome/Android opens a folder
picker (grabs every file in the folder, filtered client-side to audio by
MIME type or extension) while Safari/iOS — which ignores `webkitdirectory`
— falls back to its normal multi-file picker. Selected files are sorted
alphabetically, capped at `BUTTONS_PER_PROFILE`, and written one-per-button
into the *active* profile in order, with the label set to the filename
(extension stripped) and the color cycled from `BUTTON_PALETTE`. It prompts
for confirmation before overwriting a profile that already has sounds
assigned.

Edit mode is a single boolean toggled by the pencil icon in the header: when
on, tapping a sound button opens the button editor dialog (label, color,
sound file, and a "hide this button" checkbox) instead of playing its sound.
It does not gate anything profile-level anymore — that used to be true (a
delete badge only showed up on tabs in edit mode) but was hard to discover,
so profile deletion is now a permanent, always-visible 🗑 icon in the header
next to the import button, wired straight to `deleteProfile(activeProfile())`
— confirms, and refuses to drop the last remaining profile. Double-tapping
the active profile tab still opens the profile editor dialog (rename, change
background). Both editors are native `<dialog>` elements driven by
`showModal()`/`close()`.

[service-worker.js](service-worker.js) caches the app shell (HTML/CSS/JS) for
offline use with a **network-first** strategy: every fetch tries the network
and refreshes the cache on success, only falling back to the cache when
offline. This was deliberately changed from cache-first — cache-first meant
every edit to app.js/styles.css was invisible in an already-loaded browser
tab until `CACHE_NAME` was bumped, which is exactly wrong while iterating on
the app. It does **not** cache sound/image blobs — those already live in
IndexedDB via storage.js. If a change still doesn't show up in a browser
that had the app open before, the old service worker instance is the first
thing to suspect: hard-refresh, or unregister it in devtools
(Application → Service Workers).

## Known limitations worth knowing before changing platform behavior

- The PWA icon ([icons/icon.svg](icons/icon.svg)) is SVG-only. iOS Safari's
  `apple-touch-icon` support for SVG is inconsistent across versions — if
  home-screen icon fidelity on iOS becomes a priority, add PNG fallbacks.
- The button grid is a fixed 3x3 (`BUTTONS_PER_PROFILE` in
  [js/app.js](js/app.js)) — there's no UI for adding/removing individual
  buttons, only for editing the label/color/sound of the 9 fixed slots.
