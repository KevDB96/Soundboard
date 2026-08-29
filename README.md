# Soundboard

**Live**: https://kevdb96.github.io/Soundboard/

A lightweight, installable soundboard PWA. Create multiple profiles, each with
its own background image and a 3x3 grid of tappable sound buttons. No build
step, no backend — everything runs from static files and persists in the
browser (localStorage for profile/button metadata, IndexedDB for the mp3 and
background image blobs).

## Running locally

Serve the folder over HTTP (required for the service worker and IndexedDB to
behave correctly — `file://` won't work for the service worker):

```
npx serve .
```

or

```
python -m http.server 8000
```

Then open the printed URL in a browser.

## Using it

- Tap a button to play its sound.
- Tap the folder icon to import sounds in bulk: on Android this opens a
  folder picker and fills the buttons with every audio file inside it; on
  iPhone (where folder picking isn't supported) it opens a multi-file picker
  instead. Either way, each button gets the file's name (minus extension) as
  its label and a color from a preset palette, in alphabetical order. Only
  the first 9 files are used, since there are 9 buttons per profile.
- Tap the pencil icon to enter edit mode, then tap any button to assign a
  label, color, and mp3 file individually, or check "Hide this button" to
  remove it from the board without deleting its sound (it stays visible,
  dimmed, in edit mode so you can bring it back later).
- In that same editor, once a sound is assigned, drag the Start/End sliders
  to pick just the part of the file you want the button to play (e.g. only
  the punchline of a longer clip) and tap "Preview selection" to check it.
  This doesn't cut or modify the file — it just remembers which part to jump
  to and stop at during playback.
- Tap **+** to add a new profile, or the 🗑 icon to delete the current one
  (asks for confirmation; at least one profile always stays).
- Double-tap a profile tab's name to rename it or change its background
  image.

## Installing on a phone

This is a PWA, not an app-store app:

- **Android (Chrome)**: open the site, then use "Add to Home screen" from the
  browser menu.
- **iPhone (Safari)**: open the site, tap Share, then "Add to Home Screen".

Once added, it launches full-screen like a native app and works offline after
the first load.
