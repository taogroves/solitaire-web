/**
 * Procedural sound effects via Web Audio API.
 */
(function (global) {
  'use strict';

  let ctx = null;
  let muted = false;
  let unlocked = false;

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    return ctx;
  }

  function primeContext(c) {
    if (!c || unlocked) return;
    unlocked = true;
    try {
      const buffer = c.createBuffer(1, 1, c.sampleRate);
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.connect(c.destination);
      src.start(0);
    } catch (_) {
      /* ignore */
    }
  }

  function unlock() {
    const c = getCtx();
    if (!c) return Promise.resolve();
    primeContext(c);
    if (c.state === 'running') return Promise.resolve();
    if (c.state === 'suspended') return c.resume();
    return Promise.resolve();
  }

  function resume() {
    return unlock();
  }

  if (typeof document !== 'undefined') {
    const onGesture = () => {
      unlock();
    };
    document.addEventListener('touchstart', onGesture, { capture: true, passive: true });
    document.addEventListener('touchend', onGesture, { capture: true, passive: true });
    document.addEventListener('click', onGesture, { capture: true });
  }

  function tone(freq, duration, type, gain, when) {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    if (c.state !== 'running') {
      void unlock().then(() => tone(freq, duration, type, gain, when));
      return;
    }
    const t0 = when ?? c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain ?? 0.15, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function noiseBurst(duration, gain) {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    if (c.state !== 'running') {
      void unlock().then(() => noiseBurst(duration, gain));
      return;
    }
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const g = c.createGain();
    g.gain.value = gain ?? 0.08;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start();
  }

  const AudioFX = {
    unlock,
    resume,
    setMuted(m) {
      muted = !!m;
    },
    isMuted() {
      return muted;
    },
    flip() {
      unlock();
      tone(420, 0.06, 'triangle', 0.12);
      noiseBurst(0.04, 0.05);
    },
    place() {
      unlock();
      tone(280, 0.08, 'sine', 0.14);
      tone(360, 0.06, 'sine', 0.08, getCtx()?.currentTime + 0.03);
    },
    draw() {
      unlock();
      for (let i = 0; i < 3; i++) {
        tone(200 + i * 40, 0.05, 'square', 0.06, (getCtx()?.currentTime ?? 0) + i * 0.04);
      }
    },
    recycle() {
      unlock();
      tone(150, 0.2, 'sawtooth', 0.1);
    },
    invalid() {
      unlock();
      tone(120, 0.15, 'sawtooth', 0.12);
      tone(90, 0.2, 'sawtooth', 0.1, (getCtx()?.currentTime ?? 0) + 0.08);
    },
    win() {
      unlock();
      const c = getCtx();
      if (!c) return;
      if (c.state !== 'running') {
        void unlock().then(() => AudioFX.win());
        return;
      }
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => tone(f, 0.35, 'sine', 0.12, c.currentTime + i * 0.12));
      setTimeout(() => noiseBurst(0.3, 0.06), 400);
    },
    uiClick() {
      unlock();
      tone(600, 0.04, 'sine', 0.08);
    },
    newDeal() {
      unlock();
      const c = getCtx();
      if (!c) return;
      if (c.state !== 'running') {
        void unlock().then(() => AudioFX.newDeal());
        return;
      }
      const t0 = c.currentTime;
      const notes = [392, 494, 587, 784];
      notes.forEach((f, i) => tone(f, 0.14, 'triangle', 0.1, t0 + i * 0.07));
      tone(988, 0.22, 'sine', 0.09, t0 + 0.32);
    },
    undo() {
      unlock();
      const c = getCtx();
      if (!c) return;
      if (c.state !== 'running') {
        void unlock().then(() => AudioFX.undo());
        return;
      }
      const t0 = c.currentTime;
      tone(480, 0.05, 'sine', 0.1, t0);
      tone(360, 0.07, 'triangle', 0.09, t0 + 0.04);
      tone(240, 0.1, 'sine', 0.08, t0 + 0.09);
      noiseBurst(0.03, 0.035);
    },
  };

  global.SolitaireAudio = AudioFX;
})(typeof window !== 'undefined' ? window : global);
