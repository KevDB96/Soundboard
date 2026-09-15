# Poppy Soundboard Redesign — Implementation Cascade

## Goal
Transform the existing static Soundboard PWA into the approved **Poppy** faun/bard aesthetic while preserving its current interaction model: each visible sound button plays exactly one assigned short audio file. Keep the app dependency-free, build-free, offline-capable, and compatible with the current localStorage/IndexedDB persistence model.

## Current-state facts
- Static HTML/CSS/JS PWA hosted from `master` on GitHub Pages.
- Default profile is already `Poppy`.
- Fixed 3x3 board (`BUTTONS_PER_PROFILE = 9`).
- Each button stores label, color, one sound blob key, hidden flag, and optional trim start/end.
- Tapping a populated button restarts that one clip; it does not layer duplicate playback.
- Profile creation/deletion, bulk sound import, button editing, profile background images, hiding buttons, and trim preview already work.
- No build system, framework, package manager, or test suite.

## Design decisions
1. **Do not introduce a framework or build step.**
2. **Do not turn the app into a playlist/media-player product.** The generated player/favorites/search/collection artwork is optional future material, not required for this redesign.
3. Preserve the existing 3x3 interaction and persistence behavior.
4. Replace the dark neon visual language with a Poppy palette: cream, bright/soft pinks, pastel sage greens, muted floral browns, and subtle gold accents.
5. Use the generated Poppy/floral PNG assets as decorative/identity assets, but keep layout/interaction semantics in HTML/CSS rather than baking whole screens into images.
6. Keep controls recognizable and touch-friendly. Decorative flourishes must never reduce hit-target size or obscure text.
7. Preserve relative asset paths so GitHub Pages continues to work under `/Soundboard/`.
8. Any newly required shell assets must be added to the service-worker app-shell list and the cache version bumped.

---

# Plan 01 — Asset Foundation and Theme System

**Purpose:** Make the approved Poppy artwork and palette available in a maintainable way before touching layout.

**Outcome:** Assets are organized under a stable repo path, theme tokens exist in CSS, branding can be referenced by the UI, and offline caching knows about required shell artwork.

**Included work:**
- Import implementation-relevant PNGs from the prepared Poppy asset pack.
- Place them under a predictable path such as `assets/poppy/{branding,decor,ui,sounds,states}`.
- Do not import source sheets unless useful for archival purposes.
- Establish CSS custom properties for cream/pink/sage/leaf/text/shadow/border tones.
- Replace dark `color-scheme` assumptions.
- Add only the artwork actually used by the initial redesign to the service-worker shell.

**Dependencies:** None.

**Verification:** All referenced assets resolve under local HTTP and GitHub Pages-style relative paths; no 404s; service worker installs successfully.

### POPPY-P01-J01 — Import implementation assets
**Objective:** Add the approved Poppy PNG assets to a stable repo hierarchy.
**Scope:** Branding logo, floral/decor elements, play/control icons required by current UI, sound-card artwork used by the 3x3 board, and relevant button states.
**Do not change:** HTML/JS behavior.
**Acceptance criteria:**
- Assets live under `assets/poppy/` with clear filenames.
- No source-sheet dependency is required at runtime.
- Paths are relative and case-consistent.
- No duplicate or obviously unused runtime copies.
**Verification:** Inspect file tree and verify representative files open correctly.
**Dependencies:** None.
**Execution profile:** Luna / Medium / 10 minutes.

### POPPY-P01-J02 — Establish Poppy theme tokens and app-shell caching
**Objective:** Replace the dark-theme foundation with reusable Poppy visual tokens and cache required static art.
**Scope:** `css/styles.css`, `service-worker.js`, minimal metadata color updates if needed.
**Do not change:** Board behavior, persistence schema, audio code.
**Acceptance criteria:**
- Cream/pink/sage palette is centralized in CSS variables.
- Body/dialog/form defaults no longer assume dark mode.
- Required Poppy shell assets are cached.
- Service-worker cache name is bumped.
**Verification:** Load online then offline; shell still renders.
**Dependencies:** POPPY-P01-J01.
**Execution profile:** Luna / Medium / 10 minutes.

---

# Plan 02 — Poppy Board and Header

**Purpose:** Apply the approved mock-up language to the actual app while preserving the current simple soundboard workflow.

**Outcome:** The app visibly reads as Poppy/faun/bard, with a floral branded header and polished 3x3 sound cards that still act as one-tap/one-clip buttons.

**Included work:**
- Poppy logo/branding treatment.
- Restyled profile tabs and existing import/delete/add/edit actions.
- Floral/sage/pink board background and spacing.
- Sound-card visual treatment and press feedback.
- Responsive portrait-first layout with usable desktop scaling.
- Optional per-card icon selection only when it can be derived without changing the persisted data model.

**Dependencies:** Plan 01.

### POPPY-P02-J01 — Rebuild the header presentation
**Objective:** Restyle the existing profile/header controls into the Poppy visual system.
**Scope:** `index.html` header markup where needed and matching CSS.
**Do not change:** Control IDs, event wiring, profile semantics.
**Acceptance criteria:**
- Poppy branding is visible without consuming excessive mobile height.
- Profile tabs remain horizontally scrollable.
- Import/delete/add/edit actions remain obvious and reachable.
- All existing selectors used by JS remain valid.
- Minimum practical touch targets are preserved.
**Verification:** Test profile switch, add, delete, import trigger, edit toggle.
**Dependencies:** POPPY-P01-J02.
**Execution profile:** Luna / Medium / 10 minutes.

### POPPY-P02-J02 — Restyle the 3x3 sound grid
**Objective:** Turn the existing nine buttons into cream/pink/sage floral sound cards while preserving one-button/one-sound playback.
**Scope:** Board markup generated by `renderBoard()`, sound-button CSS, pressed/empty/hidden/edit states.
**Do not change:** Audio assignment, trim semantics, IndexedDB storage, button count.
**Acceptance criteria:**
- Exactly the same button objects drive the board.
- Tapping a populated card plays only its assigned clip.
- Empty cards remain visually distinct.
- Pressed feedback is quick and does not delay playback.
- Hidden/edit-mode states remain understandable.
- Labels remain readable on narrow screens.
**Verification:** Test populated, empty, hidden, edit, and repeated-tap states.
**Dependencies:** POPPY-P02-J01.
**Execution profile:** Luna / Medium / 10 minutes.

### POPPY-P02-J03 — Responsive and decorative polish
**Objective:** Add floral motifs/background composition without compromising usability.
**Scope:** CSS-only layout/pseudo-elements where possible plus approved decor PNGs.
**Do not change:** App behavior.
**Acceptance criteria:**
- Mobile portrait remains the primary layout.
- No artwork intercepts pointer events.
- Safe-area insets still work.
- 3x3 board fits common phone heights without unusable clipping.
- Desktop view scales cleanly rather than stretching cards excessively.
**Verification:** Inspect narrow mobile, tall mobile, tablet-ish, and desktop widths.
**Dependencies:** POPPY-P02-J02.
**Execution profile:** Luna / Medium / 10 minutes.

---

# Plan 03 — Editors, Profiles, and PWA Identity

**Purpose:** Make secondary/admin interactions match the redesign and remove remaining dark-theme/PWA identity inconsistencies.

**Outcome:** Editing/import/profile management feels like the same Poppy app, and install metadata uses matching colors/assets.

### POPPY-P03-J01 — Restyle editing and profile dialogs
**Objective:** Apply the Poppy design system to existing dialogs and form controls.
**Scope:** Button editor, trim area, profile editor, action buttons, native dialog backdrop.
**Do not change:** Form IDs, save/cancel logic, trim calculations, file handling.
**Acceptance criteria:**
- Dialogs use cream surfaces, floral/pink/sage accents, readable labels.
- Range/color/file/text controls remain usable on mobile.
- Destructive actions are visually distinct without clashing with theme.
- No editor capability is removed.
**Verification:** Edit label/color/sound/trim/hidden state and profile name/background.
**Dependencies:** POPPY-P02-J03.
**Execution profile:** Luna / Medium / 10 minutes.

### POPPY-P03-J02 — Update install identity and offline shell
**Objective:** Align document/manifest/theme metadata and install icon strategy with Poppy.
**Scope:** `index.html`, `manifest.json`, `icons/`, service-worker list/cache bump.
**Do not change:** Deployment topology.
**Acceptance criteria:**
- Page title/manifest name identify Poppy Soundboard.
- Theme/background colors match the light Poppy design.
- Install icon has a dependable raster fallback if practical.
- Offline install/load still succeeds.
**Verification:** Manifest inspection, service-worker reinstall, standalone launch smoke test.
**Dependencies:** POPPY-P03-J01.
**Execution profile:** Luna / Medium / 10 minutes.

---

# Plan 04 — Regression and Release Hardening

**Purpose:** Ensure the visual redesign did not break the deceptively important simple behaviors already in the app.

**Outcome:** A deployable static PWA with no known regression in sound playback, storage, profiles, editing, or offline behavior.

### POPPY-P04-J01 — Functional regression pass and targeted fixes
**Objective:** Verify every existing workflow against the redesigned UI and fix only regressions found.
**Scope:** Playback, repeated taps, bulk import, edit mode, trim preview/save, hide/unhide, profile switching/add/delete/rename/background, persistence after reload, offline shell.
**Do not change:** Feature scope; do not add favorites/search/player queues/collections.
**Acceptance criteria:**
- All existing workflows remain functional.
- No console/page errors during normal use.
- No missing runtime Poppy assets.
- Reload preserves saved state.
- Offline shell loads after first successful online load.
- GitHub Pages relative paths remain valid.
**Verification:** Manual browser smoke suite; if browser automation is available externally, use it for the same selector paths documented in `CLAUDE.md`.
**Dependencies:** POPPY-P03-J02.
**Execution profile:** Luna / Medium / 10 minutes.

## Completion definition
The redesign is complete when the deployed app clearly matches the approved Poppy faun/bard floral aesthetic, remains a simple 3x3 one-button/one-short-sound board, preserves all existing editing/profile/storage functionality, and works both online and from its installed/offline PWA shell.
