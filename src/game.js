import { Board } from './board.js';
import { ASSET_PATHS, COLORS, KEY_CELLS, MAP_WALLS, PLAYER_START, PORTAL_CELL } from './config.js';
import { DebugUI } from './debug-ui.js';
import { DirectionClickInput } from './input.js';
import { Player } from './player.js';
import { getPixi, waitForPixi } from './pixi.js';

let debugUi = null;
let keyHudEl = null;
let clearEl = null;
let resetButtonEl = null;
let pendingSlideOutcome = null;

const TOP_UI = {
  height: 36,
  radius: 10,
  paddingX: 12,
  font: "600 14px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  background: 'rgba(17,24,39,0.88)',
  color: '#f9fafb',
};

const bootstrap = async () => {
  const root = document.getElementById('app');

  if (!root) {
    throw new Error('app container(#app)을 찾지 못했습니다.');
  }
  debugUi = new DebugUI(root);
  setupGlobalErrorCapture();

  const app = await createPixiApp(root);
  const textures = await loadTextures();
  const background = createBackgroundSprite(textures.bg);
  app.stage.addChild(background);
  root.appendChild(app.canvas ?? app.view);

  const board = new Board(app.stage, MAP_WALLS, KEY_CELLS, PORTAL_CELL, textures);
  const player = new Player(board, PLAYER_START, textures);
  const state = {
    keyCollected: 0,
    keyGoal: KEY_CELLS.length,
    clear: false,
    portalActive: false,
  };

  createHud(root);
  updateHud(state);

  const initial = player.getGridPosition();
  debugUi.setState({ grid: `(${initial.x}, ${initial.y})`, animating: player.isAnimating() });

  const layout = () => {
    layoutBackground(background, app);
    board.layout(app.renderer.width, app.renderer.height);
    layoutHudByBoard(root, board);
  };
  layout();

  window.addEventListener('resize', layout);

  new DirectionClickInput(
    app.canvas ?? app.view,
    () => getPlayerRendererPosition(player, board),
    (direction) => {
      if (state.clear) {
        return;
      }

      const before = player.getGridPosition();
      const wasAnimating = player.isAnimating();
      const slideResult = wasAnimating
        ? { moved: false, path: [] }
        : player.trySlide(direction, {
            stopAtCell: (x, y) =>
              state.portalActive && x === PORTAL_CELL.x && y === PORTAL_CELL.y,
          });
      const moved = slideResult.moved;

      if (moved) {
        pendingSlideOutcome = { path: slideResult.path, applied: false };
      }

      const after = player.getGridPosition();
      debugUi.logMove(
        `before=(${before.x},${before.y}) after=(${after.x},${after.y}) anim=${wasAnimating} moved=${moved}`
      );
      debugUi.setState({ grid: `(${after.x}, ${after.y})`, animating: player.isAnimating() });
    },
    {
      onClick: ({ x, y, originX, originY, dx, dy }) => {
        debugUi.logInput(
          `click at=(${Math.round(x)},${Math.round(y)}) origin=(${Math.round(originX)},${Math.round(
            originY
          )}) dx=${Math.round(dx)} dy=${Math.round(dy)}`
        );
      },
      onDecision: ({ accepted, directionName, reason, dx, dy }) => {
        const direction = directionName ?? `rejected:${reason}`;
        debugUi.logInput(
          `decision dx=${Math.round(dx)} dy=${Math.round(dy)} dir=${direction} accepted=${accepted}`
        );
      },
    }
  );

  resetButtonEl.addEventListener('click', () => {
    state.keyCollected = 0;
    state.clear = false;
    state.portalActive = false;
    pendingSlideOutcome = null;
    player.resetTo(PLAYER_START);
    board.resetObjects();
    hideClear();
    updateHud(state);
    const pos = player.getGridPosition();
    debugUi.logInput('reset');
    debugUi.setState({ grid: `(${pos.x}, ${pos.y})`, animating: player.isAnimating() });
  });

  app.ticker.add(() => {
    const deltaMs = app.ticker.deltaMS;
    player.update(deltaMs);

    if (pendingSlideOutcome && !pendingSlideOutcome.applied && player.getAnimationProgress() >= 0.9) {
      applySlideOutcome(board, state, pendingSlideOutcome.path);
      pendingSlideOutcome.applied = true;
    }

    if (pendingSlideOutcome && !player.isAnimating()) {
      if (!pendingSlideOutcome.applied) {
        applySlideOutcome(board, state, pendingSlideOutcome.path);
      }
      pendingSlideOutcome = null;
    }

    const pos = player.getGridPosition();
    debugUi.setState({ grid: `(${pos.x}, ${pos.y})`, animating: player.isAnimating() });
  });
};

const applySlideOutcome = (board, state, path) => {
  const gained = board.collectKeysOnPath(path);
  if (gained > 0) {
    state.keyCollected += gained;
    if (state.keyCollected >= state.keyGoal && !state.portalActive) {
      state.portalActive = true;
      board.setPortalActive(true);
    }
  }

  if (state.portalActive && board.isPortalOnPath(path)) {
    state.clear = true;
    showClear();
  }
  updateHud(state);
};

const createPixiApp = async (root) => {
  const PIXI = await waitForPixi(3000);
  if (!PIXI) {
    throw new Error('PixiJS 로딩 실패: 네트워크 또는 CDN 접근 상태를 확인하세요.');
  }

  const options = {
    backgroundColor: COLORS.bg,
    resizeTo: root,
    antialias: true,
  };

  const app = new PIXI.Application(options);
  if (typeof app.init === 'function') {
    await app.init({
      background: COLORS.bg,
      resizeTo: root,
      antialias: true,
    });
  }

  return app;
};

const loadTextures = async () => {
  const PIXI = getPixi();
  if (!PIXI) {
    throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
  }

  const aliases = Object.keys(ASSET_PATHS);
  try {
    for (const alias of aliases) {
      if (!PIXI.Assets.get(alias)) {
        PIXI.Assets.add({ alias, src: ASSET_PATHS[alias] });
      }
    }
    await PIXI.Assets.load(aliases);
  } catch {
    await Promise.all(
      aliases.map(async (alias) => {
        const texture = await loadTextureWithFallback(PIXI, ASSET_PATHS[alias]);
        if (!PIXI.Assets.get(alias)) {
          PIXI.Assets.add({ alias, src: ASSET_PATHS[alias] });
        }
        PIXI.Assets.cache.set(alias, texture);
      })
    );
  }

  return {
    bg: PIXI.Assets.get('bg'),
    tile: PIXI.Assets.get('tile'),
    wall: PIXI.Assets.get('wall'),
    characterSheet: PIXI.Assets.get('characterSheet'),
    key: PIXI.Assets.get('key'),
    portalOff: PIXI.Assets.get('portalOff'),
    portalOn: PIXI.Assets.get('portalOn'),
  };
};

const createBackgroundSprite = (texture) => {
  const PIXI = getPixi();
  if (!PIXI) {
    throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
  }
  const sprite = new PIXI.Sprite(texture);
  sprite.x = 0;
  sprite.y = 0;
  return sprite;
};

const layoutBackground = (sprite, app) => {
  const width = app.renderer.width;
  const height = app.renderer.height;
  const scale = Math.max(width / sprite.texture.width, height / sprite.texture.height);
  sprite.scale.set(scale);
  sprite.x = (width - sprite.texture.width * scale) * 0.5;
  sprite.y = (height - sprite.texture.height * scale) * 0.5;
};

const loadTextureWithFallback = (PIXI, src) =>
  new Promise((resolve, reject) => {
    const texture = PIXI.Texture.from(src);
    const base = texture.baseTexture;

    if (base.valid) {
      resolve(texture);
      return;
    }

    const onLoaded = () => {
      cleanup();
      resolve(texture);
    };
    const onError = () => {
      cleanup();
      reject(new Error(`텍스처 로딩 실패: ${src}`));
    };
    const cleanup = () => {
      base.off('loaded', onLoaded);
      base.off('error', onError);
    };

    base.on('loaded', onLoaded);
    base.on('error', onError);
  });

const createHud = (root) => {
  keyHudEl = document.createElement('div');
  keyHudEl.style.position = 'fixed';
  keyHudEl.style.top = '12px';
  keyHudEl.style.left = '50%';
  keyHudEl.style.transform = 'translateX(-50%)';
  keyHudEl.style.zIndex = '9000';
  keyHudEl.style.padding = `0 ${TOP_UI.paddingX}px`;
  keyHudEl.style.height = `${TOP_UI.height}px`;
  keyHudEl.style.display = 'flex';
  keyHudEl.style.alignItems = 'center';
  keyHudEl.style.borderRadius = `${TOP_UI.radius}px`;
  keyHudEl.style.background = TOP_UI.background;
  keyHudEl.style.color = TOP_UI.color;
  keyHudEl.style.font = TOP_UI.font;
  keyHudEl.style.whiteSpace = 'nowrap';
  keyHudEl.style.textTransform = 'uppercase';

  resetButtonEl = document.createElement('button');
  resetButtonEl.textContent = 'Reset';
  resetButtonEl.style.position = 'fixed';
  resetButtonEl.style.top = '16px';
  resetButtonEl.style.left = '50%';
  resetButtonEl.style.transform = 'translateX(-50%)';
  resetButtonEl.style.zIndex = '9000';
  resetButtonEl.style.border = '0';
  resetButtonEl.style.borderRadius = `${TOP_UI.radius}px`;
  resetButtonEl.style.padding = `0 ${TOP_UI.paddingX}px`;
  resetButtonEl.style.height = `${TOP_UI.height}px`;
  resetButtonEl.style.background = TOP_UI.background;
  resetButtonEl.style.color = TOP_UI.color;
  resetButtonEl.style.font = TOP_UI.font;
  resetButtonEl.style.whiteSpace = 'nowrap';
  resetButtonEl.style.cursor = 'pointer';
  resetButtonEl.style.textTransform = 'uppercase';

  const debugButton = debugUi?.button ?? null;
  if (debugButton) {
    debugButton.style.zIndex = '9000';
    debugButton.style.border = '0';
    debugButton.style.borderRadius = `${TOP_UI.radius}px`;
    debugButton.style.padding = `0 ${TOP_UI.paddingX}px`;
    debugButton.style.height = `${TOP_UI.height}px`;
    debugButton.style.background = TOP_UI.background;
    debugButton.style.color = TOP_UI.color;
    debugButton.style.font = TOP_UI.font;
    debugButton.style.lineHeight = '1.2';
    debugButton.style.whiteSpace = 'nowrap';
    debugButton.style.textTransform = 'uppercase';
  }

  clearEl = document.createElement('div');
  clearEl.textContent = 'CLEAR!';
  clearEl.style.position = 'fixed';
  clearEl.style.top = '50%';
  clearEl.style.left = '50%';
  clearEl.style.transform = 'translate(-50%, -50%)';
  clearEl.style.zIndex = '9001';
  clearEl.style.padding = '14px 24px';
  clearEl.style.borderRadius = '12px';
  clearEl.style.background = 'rgba(39,174,96,0.92)';
  clearEl.style.color = '#ffffff';
  clearEl.style.font = '700 28px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  clearEl.style.display = 'none';

  root.appendChild(keyHudEl);
  root.appendChild(resetButtonEl);
  root.appendChild(clearEl);
};

const layoutHudByBoard = (root, board) => {
  if (!keyHudEl || !resetButtonEl) {
    return;
  }

  const boardTop = board.container.y;
  const boardWidth = board.boardPixelWidth * board.container.scale.x;
  const boardCenterX = board.container.x + boardWidth * 0.5;
  const margin = 12;
  const gap = 12;
  const itemGap = 10;

  const keyHeight = keyHudEl.offsetHeight || 32;
  const keyWidth = keyHudEl.offsetWidth || 90;
  const resetHeight = resetButtonEl.offsetHeight || 40;
  const resetWidth = resetButtonEl.offsetWidth || 84;
  const debugButton = debugUi?.button ?? null;
  const debugHeight = debugButton?.offsetHeight || 30;
  const debugWidth = debugButton?.offsetWidth || 70;

  const rowHeight = Math.max(keyHeight, resetHeight, debugHeight);
  const rowTop = Math.max(margin, boardTop - rowHeight - gap);
  const rowWidth = keyWidth + itemGap + resetWidth + itemGap + debugWidth;
  const rowLeft = boardCenterX - rowWidth * 0.5;

  keyHudEl.style.transform = 'none';
  keyHudEl.style.left = `${Math.round(rowLeft)}px`;
  keyHudEl.style.top = `${Math.round(rowTop)}px`;

  const resetLeft = rowLeft + keyWidth + itemGap;
  resetButtonEl.style.transform = 'none';
  resetButtonEl.style.left = `${Math.round(resetLeft)}px`;
  resetButtonEl.style.top = `${Math.round(rowTop)}px`;

  if (debugButton) {
    const debugLeft = resetLeft + resetWidth + itemGap;
    debugButton.style.right = 'auto';
    debugButton.style.transform = 'none';
    debugButton.style.left = `${Math.round(debugLeft)}px`;
    debugButton.style.top = `${Math.round(rowTop)}px`;

    if (debugUi?.panel) {
      debugUi.panel.style.right = 'auto';
      debugUi.panel.style.left = `${Math.round(debugLeft)}px`;
      debugUi.panel.style.top = `${Math.round(rowTop + (debugHeight || TOP_UI.height) + 8)}px`;
    }
  }
};

const updateHud = (state) => {
  if (!keyHudEl) {
    return;
  }
  keyHudEl.textContent = `KEY ${state.keyCollected}/${state.keyGoal}`;
};

const showClear = () => {
  if (clearEl) {
    clearEl.style.display = 'block';
  }
};

const hideClear = () => {
  if (clearEl) {
    clearEl.style.display = 'none';
  }
};

const getPlayerRendererPosition = (player, board) => ({
  x: board.container.x + player.sprite.x * board.container.scale.x,
  y: board.container.y + player.sprite.y * board.container.scale.y,
});

const setupGlobalErrorCapture = () => {
  window.addEventListener('error', (event) => {
    const message = event.error?.stack || event.message || 'unknown error';
    debugUi?.logError(message);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.stack || String(event.reason);
    debugUi?.logError(`promise: ${message}`);
  });

  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    const message = args
      .map((item) => {
        if (item instanceof Error) {
          return item.stack || item.message;
        }
        if (typeof item === 'string') {
          return item;
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join(' ');
    debugUi?.logError(message);
    originalConsoleError(...args);
  };
};

bootstrap().catch((error) => {
  console.error(error);
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = '<pre style="padding:16px;color:#b00020;">초기화 실패: 콘솔 오류를 확인하세요.</pre>';
  }
});
