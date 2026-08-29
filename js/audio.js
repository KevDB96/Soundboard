// Thin playback helper: caches one <audio> element per object URL so rapid
// re-taps restart the sound instead of queuing overlapping playbacks.
const AudioPlayer = (() => {
  const elements = new Map();

  function play(url, { start = 0, end = null } = {}) {
    if (!url) return;
    let audio = elements.get(url);
    if (!audio) {
      audio = new Audio(url);
      audio.addEventListener('timeupdate', () => {
        if (audio._trimEnd != null && audio.currentTime >= audio._trimEnd) {
          audio.pause();
        }
      });
      elements.set(url, audio);
    }
    audio._trimEnd = end;
    audio.currentTime = start;
    audio.play().catch(() => {
      // Autoplay/interaction restrictions - ignore, user tapped so this should work in practice.
    });
  }

  function releaseAllExcept(urlsToKeep) {
    for (const [url, audio] of elements) {
      if (!urlsToKeep.has(url)) {
        audio.pause();
        elements.delete(url);
      }
    }
  }

  // Blob-URL <audio> elements often report `duration === Infinity` until
  // something forces a seek (a well-known browser quirk for sources without
  // a Content-Length) - seeking to a huge time and back is the standard
  // workaround to get the real duration.
  function getDuration(url) {
    return new Promise((resolve) => {
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.src = url;
      probe.addEventListener(
        'loadedmetadata',
        () => {
          if (Number.isFinite(probe.duration)) {
            resolve(probe.duration);
            return;
          }
          probe.currentTime = 1e101;
          probe.addEventListener(
            'timeupdate',
            () => {
              probe.currentTime = 0;
              resolve(Number.isFinite(probe.duration) ? probe.duration : 0);
            },
            { once: true }
          );
        },
        { once: true }
      );
      probe.addEventListener('error', () => resolve(0), { once: true });
    });
  }

  // Independent one-off player for previewing a trim range in the editor,
  // so it doesn't disturb the cached per-button elements above.
  let previewAudio = null;
  function preview(url, start, end) {
    if (previewAudio) previewAudio.pause();
    previewAudio = new Audio(url);
    previewAudio.currentTime = start;
    previewAudio.addEventListener('timeupdate', () => {
      if (previewAudio.currentTime >= end) previewAudio.pause();
    });
    previewAudio.play().catch(() => {});
  }

  return { play, releaseAllExcept, getDuration, preview };
})();
