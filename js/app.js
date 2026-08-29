// App state, rendering, and event wiring. Data model:
// state = {
//   activeProfileId: string,
//   profiles: [{ id, name, backgroundKey, buttons: [{ label, color, soundKey, hidden }] }]
// }
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
  const objectUrlCache = new Map(); // blobKey -> object URL, revoked on profile switch

  function emptyButton() {
    return { label: '', color: '#3a3a4a', soundKey: null, hidden: false };
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
      const profiles = [newProfile('GM'), newProfile('Poppy')];
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
  function deleteProfile(profile) {
    if (state.profiles.length <= 1) {
      alert('At least one profile must remain.');
      return false;
    }
    if (!confirm(`Delete "${profile.name}"? This removes its sounds and background too.`)) {
      return false;
    }
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
      el.style.setProperty('--btn-color', btn.color);
      el.textContent = btn.label || (editMode ? 'Tap to edit' : '');
      if (btn.hidden) el.textContent += ' (hidden)';
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
    AudioPlayer.play(url);
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
      deleteProfile(activeProfile());
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

    document.getElementById('btn-cancel').addEventListener('click', () => dialog.close());

    document.getElementById('btn-clear-sound').addEventListener('click', async () => {
      const btn = activeProfile().buttons[editingButtonIndex];
      if (btn.soundKey) await Storage.deleteBlob(btn.soundKey);
      btn.soundKey = null;
      currentHint.textContent = 'No sound assigned';
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
      }

      persist();
      renderBoard();
    });
  }

  function openButtonEditor(index) {
    editingButtonIndex = index;
    const btn = activeProfile().buttons[index];
    document.getElementById('btn-label-input').value = btn.label;
    document.getElementById('btn-color-input').value = btn.color;
    document.getElementById('btn-sound-input').value = '';
    document.getElementById('btn-sound-current').textContent = btn.soundKey
      ? 'Sound assigned (choose a file to replace it)'
      : 'No sound assigned';
    document.getElementById('btn-hidden-input').checked = !!btn.hidden;
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
