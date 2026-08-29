// Thin playback helper: caches one <audio> element per object URL so rapid
// re-taps restart the sound instead of queuing overlapping playbacks.
const AudioPlayer = (() => {
  const elements = new Map();

  function play(url) {
    if (!url) return;
    let audio = elements.get(url);
    if (!audio) {
      audio = new Audio(url);
      elements.set(url, audio);
    }
    audio.currentTime = 0;
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

  return { play, releaseAllExcept };
})();
