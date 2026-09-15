// App state, rendering, and event wiring. Data model:
// state = {
//   activeProfileId: string,
//   profiles: [{ id, name, backgroundKey, buttons: [{ label, color, soundKey, hidden, start, end }] }]
// }
// start/end are seconds into the sound to play (end: null means play to the
// natural end) - set via the trim sliders in the button editor. The
// underlying mp3 is never modified, only played back partially.
// backgroundKey/soundKey are IndexedDB keys (see storage.js); null when unset.
const BUTTONS_PER_PROFILE = 9;
const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|oga|flac|wma|opus)$/i;
const BUTTON_PALETTE = [
  '#ff5c5c', '#ff9f5c', '#ffd85c', '#8cff5c', '#5cffb0',
  '#5cd6ff', '#5c8cff', '#a05cff', '#ff5cd6',
];

const App = (() => {
  let state = null;
  let editMode = false;
  let editingButtonIndex = null;
  let currentTrimDuration = 0;
  let currentTrimUrl = null;
  let trimRequestId = 0; // invalidates a duration probe superseded by a newer setupTrimUI call
  let pendingSoundObjectUrl = null; // object URL for a newly-picked, not-yet-saved sound file
  let pendingSoundClear = false;
  const objectUrlCache = new Map(); // blobKey -> object URL, revoked on profile switch

  function emptyButton() {
    return { label: '', color: '#3a3a4a', soundKey: null, hidden: false, start: 0, end: null };
  }

  function newProfile(name) {
    return {
      id: crypto.randomUUID(),
      name,
      backgroundKey: null,
      buttons: Array.from({ length: BUTTONS_PER_PROFILE }, emptyButton),
    };
  }

  function init() {
    state = Storage.loadState();
    if (!state || !state.profiles.length) {
      const profiles = [newProfile('Poppy')];
      state = { activeProfileId: profiles[0].id, profiles };
      Storage.saveState(state);
    }
    registerServiceWorker();
    wireGlobalControls();
    renderTabs();
    renderBoard();
  }

  function activeProfile() {
    return state.profiles.find((p) => p.id === state.activeProfileId);
  }

  function persist() {
    Storage.saveState(state);
  }

  // Returns true if the profile was deleted (false if the user cancelled or
  // it was the last remaining profile).
  async function deleteProfile(profile) {
    if (state.profiles.length <= 1) {
      alert('At least one profile must remain.');
      return false;
    }
    if (!confirm(`Delete "${profile.name}"? This removes its sounds and background too.`)) {
      return false;
    }
    const blobKeys = profile.buttons.map((btn) => btn.soundKey).filter(Boolean);
    if (profile.backgroundKey) blobKeys.push(profile.backgroundKey);
    await Promise.all(blobKeys.map((key) => Storage.deleteBlob(key)));
    state.profiles = state.profiles.filter((p) => p.id !== profile.id);
    if (state.activeProfileId === profile.id) {
      state.activeProfileId = state.profiles[0].id;
    }
    persist();
    renderTabs();
    renderBoard();
    return true;
  }

  // --- Rendering ---

  function renderTabs() {
    const nav = document.getElementById('profile-tabs');
    nav.innerHTML = '';
    for (const profile of state.profiles) {
      const tab = document.createElement('button');
      tab.className = 'profile-tab' + (profile.id === state.activeProfileId ? ' active' : '');
      tab.textContent = profile.name;
      tab.addEventListener('click', () => {
        state.activeProfileId = profile.id;
        persist();
        renderTabs();
        renderBoard();
      });
      nav.appendChild(tab);
    }
  }

  async function renderBoard() {
    document.body.classList.toggle('edit-mode', editMode);
    await renderBackground();

    const grid = document.getElementById('board-grid');
    grid.innerHTML = '';
    const profile = activeProfile();

    profile.buttons.forEach((btn, index) => {
      if (btn.hidden && !editMode) return;

      const el = document.createElement('button');
      el.className = 'sound-btn' + (btn.soundKey ? '' : ' empty') + (btn.hidden ? ' hidden-btn' : '');
      el.dataset.slot = String(index);
      el.style.setProperty('--btn-color', btn.color);
      const label = document.createElement('span');
      label.className = 'sound-label';
      label.textContent = btn.label || (editMode ? 'Tap to edit' : '');
      el.appendChild(label);
      if (btn.hidden) {
        const hiddenNote = document.createElement('span');
        hiddenNote.className = 'hidden-note';
        hiddenNote.textContent = 'Hidden';
        el.appendChild(hiddenNote);
      }
      el.addEventListener('click', () => onButtonTap(btn, el, index));
      grid.appendChild(el);
    });
  }

  async function renderBackground() {
    const layer = document.getElementById('background-layer');
    const profile = activeProfile();
    if (!profile.backgroundKey) {
      layer.style.backgroundImage = 'none';
      return;
    }
    const url = await resolveObjectUrl(profile.backgroundKey);
    layer.style.backgroundImage = url ? `url(${url})` : 'none';
  }

  async function resolveObjectUrl(blobKey) {
    if (objectUrlCache.has(blobKey)) return objectUrlCache.get(blobKey);
    const blob = await Storage.getBlob(blobKey);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    objectUrlCache.set(blobKey, url);
    return url;
  }

  // --- Interaction ---

  async function onButtonTap(btn, el, index) {
    if (editMode) {
      openButtonEditor(index);
      return;
    }
    if (!btn.soundKey) return;
    el.classList.remove('pressed');
    void el.offsetWidth; // restart animation
    el.classList.add('pressed');
    const url = await resolveObjectUrl(btn.soundKey);
    AudioPlayer.play(url, { start: btn.start || 0, end: btn.end });
  }

  function wireGlobalControls() {
    document.getElementById('edit-toggle-btn').addEventListener('click', () => {
      editMode = !editMode;
      document.getElementById('edit-toggle-btn').classList.toggle('active', editMode);
      renderTabs();
      renderBoard();
    });

    document.getElementById('add-profile-btn').addEventListener('click', () => {
      const profile = newProfile(`Profile ${state.profiles.length + 1}`);
      state.profiles.push(profile);
      state.activeProfileId = profile.id;
      persist();
      renderTabs();
      renderBoard();
    });

    document.getElementById('delete-profile-btn').addEventListener('click', () => {
      void deleteProfile(activeProfile());
    });

    document.getElementById('edit-toggle-btn').addEventListener('dblclick', openProfileEditor);
    wireButtonEditorDialog();
    wireProfileEditorDialog();
    wireImportSounds();

    // Double-click/double-tap the active tab to rename it or change its background.
    document.getElementById('profile-tabs').addEventListener('dblclick', (e) => {
      if (e.target.classList.contains('profile-tab')) openProfileEditor();
    });
  }

  // --- Bulk import: pick a folder (Android) or several files (iOS) and fill the
  // active profile's buttons with them in one go, one sound per button, labeled
  // by filename. `webkitdirectory` on the input opens a folder picker where
  // supported (Chrome/Android); Safari ignores it and falls back to its normal
  // multi-file picker, which is why `multiple` stays set too.

  function wireImportSounds() {
    const input = document.getElementById('import-sounds-input');
    document.getElementById('import-sounds-btn').addEventListener('click', () => input.click());
    input.addEventListener('change', onImportSounds);
  }

  function stripExtension(filename) {
    return filename.replace(/\.[^/.]+$/, '');
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function onImportSounds(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = ''; // allow re-picking the same folder/files later

    const audioFiles = files
      .filter((f) => f.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (!audioFiles.length) {
      alert('No audio files found in that selection.');
      return;
    }

    const profile = activeProfile();
    const hasExisting = profile.buttons.some((b) => b.soundKey);
    const toImport = audioFiles.slice(0, BUTTONS_PER_PROFILE);
    if (
      hasExisting &&
      !confirm(`Replace this profile's buttons with the ${toImport.length} sound(s) you picked?`)
    ) {
      return;
    }

    for (let i = 0; i < toImport.length; i++) {
      const file = toImport[i];
      const btn = profile.buttons[i];
      if (btn.soundKey) await Storage.deleteBlob(btn.soundKey);
      const key = `sound-${profile.id}-${i}-${Date.now()}`;
      await Storage.putBlob(key, file);
      objectUrlCache.delete(key);
      btn.soundKey = key;
      btn.label = stripExtension(file.name).slice(0, 24);
      btn.color = BUTTON_PALETTE[i % BUTTON_PALETTE.length];
      btn.hidden = false;
      btn.start = 0;
      btn.end = null;
    }

    persist();
    renderBoard();

    if (audioFiles.length > BUTTONS_PER_PROFILE) {
      alert(
        `This profile only has ${BUTTONS_PER_PROFILE} buttons, so only the first ` +
          `${BUTTONS_PER_PROFILE} sounds (alphabetically) were used.`
      );
    }
  }

  // --- Button editor dialog ---

  function wireButtonEditorDialog() {
    const dialog = document.getElementById('button-editor');
    const labelInput = document.getElementById('btn-label-input');
    const colorInput = document.getElementById('btn-color-input');
    const soundInput = document.getElementById('btn-sound-input');
    const currentHint = document.getElementById('btn-sound-current');
    const startInput = document.getElementById('btn-start-input');
    const endInput = document.getElementById('btn-end-input');

    document.getElementById('btn-cancel').addEventListener('click', () => dialog.close());

    document.getElementById('btn-clear-sound').addEventListener('click', async () => {
      pendingSoundClear = true;
      currentHint.textContent = 'No sound assigned';
      setupTrimUI(null, 0, null);
    });

    soundInput.addEventListener('change', () => {
      const file = soundInput.files[0];
      if (!file) return;
      if (pendingSoundObjectUrl) URL.revokeObjectURL(pendingSoundObjectUrl);
      pendingSoundObjectUrl = URL.createObjectURL(file);
      pendingSoundClear = false;
      currentHint.textContent = 'New sound selected — choose the part to play below';
      setupTrimUI(pendingSoundObjectUrl, 0, null);
    });

    startInput.addEventListener('input', () => {
      if (parseFloat(startInput.value) > parseFloat(endInput.value)) {
        endInput.value = startInput.value;
      }
      updateTrimLabels();
    });

    endInput.addEventListener('input', () => {
      if (parseFloat(endInput.value) < parseFloat(startInput.value)) {
        startInput.value = endInput.value;
      }
      updateTrimLabels();
    });

    document.getElementById('btn-preview-trim').addEventListener('click', () => {
      if (!currentTrimUrl) return;
      AudioPlayer.preview(currentTrimUrl, parseFloat(startInput.value), parseFloat(endInput.value));
    });

    document.getElementById('button-editor-form').addEventListener('submit', async () => {
      const btn = activeProfile().buttons[editingButtonIndex];
      btn.label = labelInput.value.trim();
      btn.color = colorInput.value;
      btn.hidden = document.getElementById('btn-hidden-input').checked;

      const file = soundInput.files[0];
      if (file) {
        const key = `sound-${activeProfile().id}-${editingButtonIndex}-${Date.now()}`;
        await Storage.putBlob(key, file);
        if (btn.soundKey) await Storage.deleteBlob(btn.soundKey);
        btn.soundKey = key;
        objectUrlCache.delete(key);
        pendingSoundClear = false;
      } else if (pendingSoundClear) {
        if (btn.soundKey) await Storage.deleteBlob(btn.soundKey);
        btn.soundKey = null;
        btn.start = 0;
        btn.end = null;
      }

      if (btn.soundKey) {
        const start = parseFloat(startInput.value) || 0;
        const end = parseFloat(endInput.value);
        btn.start = start;
        // Treat "slider left at (near) the full duration" as untrimmed, so a
        // button no one has ever trimmed keeps playing to the real end even
        // if the file gets replaced later with a different-length one.
        btn.end = Number.isFinite(end) && end < currentTrimDuration - 0.05 ? end : null;
      } else {
        btn.start = 0;
        btn.end = null;
      }

      if (pendingSoundObjectUrl) {
        URL.revokeObjectURL(pendingSoundObjectUrl);
        pendingSoundObjectUrl = null;
      }

      persist();
      renderBoard();
    });
  }

  function updateTrimLabels() {
    const startInput = document.getElementById('btn-start-input');
    const endInput = document.getElementById('btn-end-input');
    document.getElementById('trim-start-label').textContent = formatTime(parseFloat(startInput.value));
    document.getElementById('trim-end-label').textContent = formatTime(parseFloat(endInput.value));
  }

  async function setupTrimUI(url, start, end) {
    const requestId = ++trimRequestId;
    const section = document.getElementById('btn-trim-section');
    if (!url) {
      section.hidden = true;
      currentTrimUrl = null;
      currentTrimDuration = 0;
      return;
    }

    const duration = await AudioPlayer.getDuration(url);
    // A newer call (clear sound, pick a different file, reopen the dialog)
    // may have started and finished while this probe was in flight.
    if (requestId !== trimRequestId) return;

    currentTrimUrl = url;
    currentTrimDuration = duration;
    section.hidden = false;

    const startInput = document.getElementById('btn-start-input');
    const endInput = document.getElementById('btn-end-input');
    startInput.max = duration;
    endInput.max = duration;
    startInput.value = Math.min(Math.max(start || 0, 0), duration);
    endInput.value = Math.min(end != null ? end : duration, duration);
    document.getElementById('trim-duration').textContent = formatTime(duration);
    updateTrimLabels();
  }

  function openButtonEditor(index) {
    editingButtonIndex = index;
    const btn = activeProfile().buttons[index];
    document.getElementById('btn-label-input').value = btn.label;
    document.getElementById('btn-color-input').value = btn.color;
    document.getElementById('btn-sound-input').value = '';
    pendingSoundClear = false;
    document.getElementById('btn-sound-current').textContent = btn.soundKey
      ? 'Sound assigned (choose a file to replace it)'
      : 'No sound assigned';
    document.getElementById('btn-hidden-input').checked = !!btn.hidden;

    if (pendingSoundObjectUrl) {
      URL.revokeObjectURL(pendingSoundObjectUrl);
      pendingSoundObjectUrl = null;
    }

    if (btn.soundKey) {
      resolveObjectUrl(btn.soundKey).then((url) => setupTrimUI(url, btn.start, btn.end));
    } else {
      setupTrimUI(null, 0, null);
    }

    document.getElementById('button-editor').showModal();
  }

  // --- Profile editor dialog ---

  function wireProfileEditorDialog() {
    const dialog = document.getElementById('profile-editor');

    document.getElementById('profile-cancel').addEventListener('click', () => dialog.close());

    document.getElementById('profile-editor-form').addEventListener('submit', async () => {
      const profile = activeProfile();
      const name = document.getElementById('profile-name-input').value.trim();
      if (name) profile.name = name;

      const file = document.getElementById('profile-bg-input').files[0];
      if (file) {
        const key = `bg-${profile.id}-${Date.now()}`;
        await Storage.putBlob(key, file);
        if (profile.backgroundKey) await Storage.deleteBlob(profile.backgroundKey);
        profile.backgroundKey = key;
        objectUrlCache.delete(key);
      }

      persist();
      renderTabs();
      renderBoard();
    });
  }

  function openProfileEditor() {
    const profile = activeProfile();
    document.getElementById('profile-name-input').value = profile.name;
    document.getElementById('profile-bg-input').value = '';
    document.getElementById('profile-editor').showModal();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
