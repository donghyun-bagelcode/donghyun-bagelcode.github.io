import { Board } from './board.js';
import { KEY_CELLS, MAP_WALLS, PLAYER_START, PORTAL_CELL } from './config.js';
import { DebugUI } from './debug-ui.js';
import { DirectionClickInput } from './input.js';
import { Player } from './player.js';
import { getPixi } from './pixi.js';

const DESIGN_W = 1080;
const DESIGN_H = 1920;

let debugUi = null;

const TOP_UI = {
  height: 36,
  radius: 10,
  paddingX: 12,
  font: "600 14px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  background: 'rgba(17,24,39,0.88)',
  color: '#f9fafb',
};

export const createGameScene = ({ app, root, textures, onGoLobby }) => {
  const PIXI = getPixi();
  if (!PIXI) {
    throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
  }

  const container = new PIXI.Container();
  container.visible = false;

  const frame = new PIXI.Container();
  container.addChild(frame);

  const background = new PIXI.Sprite(textures.bg);
  background.x = 0;
  background.y = 0;
  background.width = DESIGN_W;
  background.height = DESIGN_H;
  frame.addChild(background);

  const board = new Board(frame, MAP_WALLS, KEY_CELLS, PORTAL_CELL, textures);
  const player = new Player(board, PLAYER_START, textures);

  const state = {
    keyCollected: 0,
    keyGoal: KEY_CELLS.length,
    clear: false,
    portalActive: false,
    active: false,
    stageId: 1,
  };

  let keyHudEl = null;
  let clearEl = null;
  let resetButtonEl = null;
  let homeButtonEl = null;
  let backButtonEl = null;
  let pendingSlideOutcome = null;

  if (!debugUi) {
    debugUi = new DebugUI(root);
    setupGlobalErrorCapture();
  }

  createHud();
  updateHud();
  setUiVisible(false);

  const input = new DirectionClickInput(
    app.canvas ?? app.view,
    () => getPlayerRendererPosition(player, board, frame),
    (direction) => {
      if (!state.active || state.clear) {
        return;
      }

      const before = player.getGridPosition();
      const wasAnimating = player.isAnimating();
      const slideResult = wasAnimating
        ? { moved: false, path: [] }
        : player.trySlide(direction, {
            stopAtCell: (x, y) => state.portalActive && x === PORTAL_CELL.x && y === PORTAL_CELL.y,
          });

      if (slideResult.moved) {
        pendingSlideOutcome = { path: slideResult.path, applied: false };
      }

      const after = player.getGridPosition();
      debugUi?.logMove(
        `before=(${before.x},${before.y}) after=(${after.x},${after.y}) anim=${wasAnimating} moved=${slideResult.moved}`
      );
      debugUi?.setState({ grid: `(${after.x}, ${after.y})`, animating: player.isAnimating() });
    },
    {
      onClick: ({ x, y, originX, originY, dx, dy }) => {
        if (!state.active) {
          return;
        }
        debugUi?.logInput(
          `click at=(${Math.round(x)},${Math.round(y)}) origin=(${Math.round(originX)},${Math.round(
            originY
          )}) dx=${Math.round(dx)} dy=${Math.round(dy)}`
        );
      },
      onDecision: ({ accepted, directionName, reason, dx, dy }) => {
        if (!state.active) {
          return;
        }
        const direction = directionName ?? `rejected:${reason}`;
        debugUi?.logInput(
          `decision dx=${Math.round(dx)} dy=${Math.round(dy)} dir=${direction} accepted=${accepted}`
        );
      },
    }
  );

  resetButtonEl.addEventListener('click', () => {
    if (!state.active) {
      return;
    }
    resetGameplay();
    debugUi?.logInput('reset');
  });

  homeButtonEl.addEventListener('click', () => {
    onGoLobby?.();
  });

  backButtonEl.addEventListener('click', () => {
    onGoLobby?.();
  });

  const tickerUpdate = () => {
    if (!state.active) {
      return;
    }

    const deltaMs = app.ticker.deltaMS;
    player.update(deltaMs);

    if (pendingSlideOutcome && !pendingSlideOutcome.applied && player.getAnimationProgress() >= 0.9) {
      applySlideOutcome(pendingSlideOutcome.path);
      pendingSlideOutcome.applied = true;
    }

    if (pendingSlideOutcome && !player.isAnimating()) {
      if (!pendingSlideOutcome.applied) {
        applySlideOutcome(pendingSlideOutcome.path);
      }
      pendingSlideOutcome = null;
    }

    const pos = player.getGridPosition();
    debugUi?.setState({ grid: `(${pos.x}, ${pos.y})`, animating: player.isAnimating() });
  };
  app.ticker.add(tickerUpdate);

  const onResize = () => {
    layoutVirtualFrame(frame, app.renderer.width, app.renderer.height);
    board.layout(DESIGN_W, DESIGN_H);
    layoutHudByBoard(board, frame);
  };

  const onEnter = (ctx = {}) => {
    const payload = ctx.payload ?? ctx;
    state.active = true;

    if (payload.stageId) {
      state.stageId = payload.stageId;
      if (state.stageId !== 1) {
        state.stageId = 1;
      }
      resetGameplay();
    }

    onResize();
    setUiVisible(true);
    const pos = player.getGridPosition();
    debugUi?.setState({ grid: `(${pos.x}, ${pos.y})`, animating: player.isAnimating() });
  };

  const onExit = () => {
    state.active = false;
    setUiVisible(false);
  };

  const onSceneResize = () => {
    onResize();
  };

  const loadStage = (stageId) => {
    state.stageId = stageId;
    resetGameplay();
  };

  const destroy = () => {
    setUiVisible(false);
    app.ticker.remove(tickerUpdate);
    input.targetElement?.removeEventListener?.('pointerdown', input.handlePointerDown);
  };

  const applySlideOutcome = (path) => {
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

    updateHud();
  };

  const resetGameplay = () => {
    state.keyCollected = 0;
    state.clear = false;
    state.portalActive = false;
    pendingSlideOutcome = null;

    player.resetTo(PLAYER_START);
    board.resetObjects();
    hideClear();
    updateHud();

    const pos = player.getGridPosition();
    debugUi?.setState({ grid: `(${pos.x}, ${pos.y})`, animating: player.isAnimating() });
  };

  function createHud() {
    keyHudEl = document.createElement('div');
    keyHudEl.style.position = 'fixed';
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
    applyTopButtonStyle(resetButtonEl);

    homeButtonEl = document.createElement('button');
    homeButtonEl.textContent = 'Home';
    applyTopButtonStyle(homeButtonEl);

    backButtonEl = document.createElement('button');
    backButtonEl.textContent = 'Back';
    applyTopButtonStyle(backButtonEl);

    clearEl = document.createElement('div');
    clearEl.textContent = 'CLEAR!';
    clearEl.style.position = 'fixed';
    clearEl.style.zIndex = '9001';
    clearEl.style.padding = '14px 24px';
    clearEl.style.borderRadius = '12px';
    clearEl.style.background = 'rgba(39,174,96,0.92)';
    clearEl.style.color = '#ffffff';
    clearEl.style.font = '700 28px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    clearEl.style.display = 'none';

    root.appendChild(keyHudEl);
    root.appendChild(resetButtonEl);
    root.appendChild(homeButtonEl);
    root.appendChild(backButtonEl);
    root.appendChild(clearEl);

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
  }

  function applyTopButtonStyle(button) {
    button.style.position = 'fixed';
    button.style.zIndex = '9000';
    button.style.border = '0';
    button.style.borderRadius = `${TOP_UI.radius}px`;
    button.style.padding = `0 ${TOP_UI.paddingX}px`;
    button.style.height = `${TOP_UI.height}px`;
    button.style.background = TOP_UI.background;
    button.style.color = TOP_UI.color;
    button.style.font = TOP_UI.font;
    button.style.whiteSpace = 'nowrap';
    button.style.textTransform = 'uppercase';
    button.style.cursor = 'pointer';
  }

  function layoutHudByBoard(currentBoard, currentFrame) {
    if (!keyHudEl || !resetButtonEl || !homeButtonEl || !backButtonEl) {
      return;
    }

    const frameScale = currentFrame.scale.x;
    const frameX = currentFrame.x;
    const frameY = currentFrame.y;

    const boardTop = frameY + currentBoard.container.y * frameScale;
    const boardWidth = currentBoard.boardPixelWidth * currentBoard.container.scale.x * frameScale;
    const boardCenterX = frameX + (currentBoard.container.x * frameScale) + boardWidth * 0.5;

    const margin = 12;
    const gap = 12;
    const itemGap = 8;

    const backW = backButtonEl.offsetWidth || 78;
    const homeW = homeButtonEl.offsetWidth || 82;
    const keyW = keyHudEl.offsetWidth || 100;
    const resetW = resetButtonEl.offsetWidth || 84;
    const debugButton = debugUi?.button ?? null;
    const debugW = debugButton?.offsetWidth || 80;

    const rowH = Math.max(
      backButtonEl.offsetHeight || TOP_UI.height,
      homeButtonEl.offsetHeight || TOP_UI.height,
      keyHudEl.offsetHeight || TOP_UI.height,
      resetButtonEl.offsetHeight || TOP_UI.height,
      debugButton?.offsetHeight || TOP_UI.height
    );

    const rowTop = Math.max(margin, boardTop - rowH - gap);
    const rowWidth = backW + itemGap + homeW + itemGap + keyW + itemGap + resetW + itemGap + debugW;
    let cursorX = boardCenterX - rowWidth * 0.5;

    placeElement(backButtonEl, cursorX, rowTop);
    cursorX += backW + itemGap;
    placeElement(homeButtonEl, cursorX, rowTop);
    cursorX += homeW + itemGap;
    placeElement(keyHudEl, cursorX, rowTop);
    cursorX += keyW + itemGap;
    placeElement(resetButtonEl, cursorX, rowTop);
    cursorX += resetW + itemGap;

    if (debugButton) {
      placeElement(debugButton, cursorX, rowTop);
      if (debugUi?.panel) {
        debugUi.panel.style.right = 'auto';
        debugUi.panel.style.left = `${Math.round(cursorX)}px`;
        debugUi.panel.style.top = `${Math.round(rowTop + rowH + 8)}px`;
      }
    }

    if (clearEl) {
      const clearX = frameX + DESIGN_W * frameScale * 0.5;
      const clearY = frameY + DESIGN_H * frameScale * 0.5;
      clearEl.style.left = `${Math.round(clearX)}px`;
      clearEl.style.top = `${Math.round(clearY)}px`;
      clearEl.style.transform = 'translate(-50%, -50%)';
    }
  }

  function placeElement(el, x, y) {
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.transform = 'none';
    el.style.right = 'auto';
  }

  function updateHud() {
    if (!keyHudEl) {
      return;
    }
    keyHudEl.textContent = `KEY ${state.keyCollected}/${state.keyGoal}`;
  }

  function showClear() {
    if (clearEl) {
      clearEl.style.display = 'block';
    }
  }

  function hideClear() {
    if (clearEl) {
      clearEl.style.display = 'none';
    }
  }

  function setUiVisible(visible) {
    const display = visible ? '' : 'none';
    if (keyHudEl) keyHudEl.style.display = visible ? 'flex' : 'none';
    if (resetButtonEl) resetButtonEl.style.display = display;
    if (homeButtonEl) homeButtonEl.style.display = display;
    if (backButtonEl) backButtonEl.style.display = display;
    if (clearEl && !visible) clearEl.style.display = 'none';
    if (debugUi?.button) debugUi.button.style.display = display;
    if (debugUi?.panel && !visible) debugUi.panel.style.display = 'none';
  }

  return {
    container,
    onEnter,
    onExit,
    onResize: onSceneResize,
    loadStage,
    destroy,
  };
};

const layoutVirtualFrame = (frame, screenW, screenH) => {
  const scale = Math.min(screenW / DESIGN_W, screenH / DESIGN_H);
  frame.scale.set(scale);
  frame.x = (screenW - DESIGN_W * scale) * 0.5;
  frame.y = 0;
};

const getPlayerRendererPosition = (player, board, frame) => {
  const localX = board.container.x + player.sprite.x * board.container.scale.x;
  const localY = board.container.y + player.sprite.y * board.container.scale.y;
  return {
    x: frame.x + localX * frame.scale.x,
    y: frame.y + localY * frame.scale.y,
  };
};

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
