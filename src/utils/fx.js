// src/lib/fx.js
// Replaces: §15 FEEDBACK SYSTEM + AUDIO FX (_playTone, FX) in index.html
// No React dependency — plain JS singleton.

const _ac =
  typeof AudioContext !== 'undefined'
    ? new AudioContext()
    : typeof webkitAudioContext !== 'undefined'
    ? new webkitAudioContext()
    : null;

function _playTone(freq, dur, type = 'sine', vol = 0.18) {
  if (!_ac) return;
  try {
    const o = _ac.createOscillator();
    const g = _ac.createGain();
    o.connect(g);
    g.connect(_ac.destination);
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, _ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + dur);
    o.start(_ac.currentTime);
    o.stop(_ac.currentTime + dur);
  } catch (e) {}
}

export const FX = {
  save: () => {
    _playTone(520, 0.08, 'sine', 0.15);
    setTimeout(() => _playTone(780, 0.12, 'sine', 0.12), 80);
    if (navigator.vibrate) navigator.vibrate([30, 10, 20]);
  },
  approve: () => {
    _playTone(440, 0.07, 'sine', 0.14);
    setTimeout(() => _playTone(554, 0.07, 'sine', 0.14), 80);
    setTimeout(() => _playTone(659, 0.18, 'sine', 0.18), 160);
    if (navigator.vibrate) navigator.vibrate([20, 10, 20, 10, 40]);
  },
  message: () => {
    _playTone(880, 0.05, 'sine', 0.1);
    setTimeout(() => _playTone(1100, 0.1, 'sine', 0.1), 60);
    if (navigator.vibrate) navigator.vibrate([15, 10, 15]);
  },
  error: () => {
    _playTone(200, 0.15, 'sawtooth', 0.12);
    if (navigator.vibrate) navigator.vibrate([50, 20, 50]);
  },
};
