const SOUND_BASE_PATH = './sound/';

const audioCache = new Map();
let bgmElement = null;
let bgmVolume = 0.5;
let sfxVolume = 0.8;
let muted = false;
let currentBgmPath = null;
let bgmState = 'stopped';
let pendingBgm = null;
let gestureUnlockInstalled = false;
let debugVisible = false;
let debugHotkeyInstalled = false;
let debugElement = null;

const loadAudio = (path) => {
  if (audioCache.has(path)) {
    return audioCache.get(path);
  }
  const audio = new Audio(SOUND_BASE_PATH + path);
  audio.preload = 'auto';
  audioCache.set(path, audio);
  return audio;
};

const ensureDebugElement = () => {
  if (debugElement) {
    return debugElement;
  }
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '12px';
  el.style.bottom = '12px';
  el.style.zIndex = '99999';
  el.style.padding = '8px 10px';
  el.style.borderRadius = '8px';
  el.style.background = 'rgba(0,0,0,0.72)';
  el.style.color = '#e5e7eb';
  el.style.fontFamily = 'monospace';
  el.style.fontSize = '12px';
  el.style.lineHeight = '1.35';
  el.style.whiteSpace = 'pre';
  el.style.pointerEvents = 'none';
  el.style.display = 'none';
  document.body.appendChild(el);
  debugElement = el;
  return el;
};

const renderDebug = () => {
  if (!debugElement && !debugVisible) {
    return;
  }
  const el = ensureDebugElement();
  el.style.display = debugVisible ? 'block' : 'none';
  if (!debugVisible) {
    return;
  }
  const pathLabel = currentBgmPath ?? '-';
  const muteLabel = muted ? 'muted' : 'unmuted';
  const pendingLabel = pendingBgm ? 'yes' : 'no';
  el.textContent =
    `[AUDIO DEBUG - F8]\n` +
    `BGM: ${pathLabel}\n` +
    `State: ${bgmState}\n` +
    `Muted: ${muteLabel}\n` +
    `Pending: ${pendingLabel}\n` +
    `Vol(BGM/SFX): ${bgmVolume.toFixed(2)} / ${sfxVolume.toFixed(2)}`;
};

const startBgmPlayback = ({ path, loop = true, volume } = {}) => {
  if (!path) {
    return;
  }

  const audio = loadAudio(path);
  audio.loop = loop;
  audio.volume = muted ? 0 : (volume ?? bgmVolume);

  bgmElement = audio;
  currentBgmPath = path;
  bgmState = 'starting';
  renderDebug();

  audio
    .play()
    .then(() => {
      pendingBgm = null;
      bgmState = 'playing';
      renderDebug();
    })
    .catch(() => {
      pendingBgm = { path, loop, volume };
      bgmState = 'blocked';
      renderDebug();
    });
};

const flushPendingBgm = () => {
  if (!pendingBgm) {
    return;
  }
  const queued = pendingBgm;
  pendingBgm = null;
  startBgmPlayback(queued);
};

const installGestureUnlock = () => {
  if (gestureUnlockInstalled) {
    return;
  }
  gestureUnlockInstalled = true;

  const unlock = () => {
    flushPendingBgm();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };

  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('touchstart', unlock, true);
  window.addEventListener('keydown', unlock, true);
};

export const AudioManager = {
  preload(paths) {
    for (const path of paths) {
      loadAudio(path);
    }
  },

  playBgm(path, { loop = true, volume } = {}) {
    if (bgmElement) {
      bgmElement.pause();
      bgmElement.currentTime = 0;
    }
    startBgmPlayback({ path, loop, volume });
  },

  stopBgm() {
    if (bgmElement) {
      bgmElement.pause();
      bgmElement.currentTime = 0;
      bgmElement = null;
    }
    pendingBgm = null;
    currentBgmPath = null;
    bgmState = 'stopped';
    renderDebug();
  },

  playSfx(path, { volume } = {}) {
    if (muted) {
      return;
    }
    const audio = loadAudio(path);
    const clone = audio.cloneNode();
    clone.volume = volume ?? sfxVolume;
    clone.play().catch(() => {});
  },

  playJingle(path, { volume, pauseBgm = true } = {}) {
    if (pauseBgm && bgmElement) {
      bgmElement.pause();
      bgmState = 'paused_by_jingle';
      renderDebug();
    }
    const audio = loadAudio(path);
    audio.currentTime = 0;
    audio.volume = muted ? 0 : (volume ?? sfxVolume);
    audio.loop = false;
    audio.play().catch(() => {});
    audio.onended = () => {
      if (pauseBgm && bgmElement) {
        bgmElement
          .play()
          .then(() => {
            bgmState = 'playing';
            renderDebug();
          })
          .catch(() => {
            bgmState = 'blocked';
            renderDebug();
          });
      }
    };
  },

  setBgmVolume(v) {
    bgmVolume = v;
    if (bgmElement) {
      bgmElement.volume = muted ? 0 : v;
    }
    renderDebug();
  },

  setSfxVolume(v) {
    sfxVolume = v;
    renderDebug();
  },

  setMuted(v) {
    muted = v;
    if (bgmElement) {
      bgmElement.volume = muted ? 0 : bgmVolume;
    }
    renderDebug();
  },

  isMuted() {
    return muted;
  },

  getCurrentBgmPath() {
    return currentBgmPath;
  },

  getBgmState() {
    return bgmState;
  },

  installUnlockOnFirstGesture() {
    installGestureUnlock();
  },

  setDebugVisible(v) {
    debugVisible = Boolean(v);
    renderDebug();
  },

  toggleDebugVisible() {
    debugVisible = !debugVisible;
    renderDebug();
    return debugVisible;
  },

  installDebugHotkey(key = 'F8') {
    if (debugHotkeyInstalled) {
      return;
    }
    debugHotkeyInstalled = true;
    window.addEventListener('keydown', (event) => {
      if (event.key === key) {
        event.preventDefault();
        AudioManager.toggleDebugVisible();
      }
    });
  },
};
