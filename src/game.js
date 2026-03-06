import { Board } from './board.js';
import { getStage, STAGE_COUNT, SWIPE_MIN_DISTANCE } from './config.js';
import { DebugUI } from './debug-ui.js';
import { SwipeInput } from './input.js';
import { Player } from './player.js';
import { getPixi } from './pixi.js';

const DESIGN_W = 1080;
const DESIGN_H = 1920;
const BACK_ICON_W = 66;
const BACK_ICON_POS = { x: 65, y: 115 };
const STAGE_LABEL_FONT_SIZE = 52;
const RESET_ICON_W = 56;

let debugUi = null;

const TOP_UI = {
  height: 36,
  radius: 10,
  paddingX: 12,
  font: "600 14px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  background: 'rgba(17,24,39,0.88)',
  color: '#f9fafb',
};

const PIXI_HUD = {
  keyNumberH: 60,
  keySlashH: 42,
  moveBoardW: 340,
  moveLabelW: 126,
  moveDigitH: 46,
  moveDigitGap: 8,
};

const POPUP_UI = {
  bgW: 560,
  bgY: 980,
  completeW: 360,
  stageW: 150,
  stageNumH: 48,
  starW: 88,
  starsGap: 104,
  replayW: 184,
  nextW: 184,
  exitW: 86,
};

export const createGameScene = ({ app, root, textures, onGoLobby, onStageClear, getCharacterSheet }) => {
  const PIXI = getPixi();
  if (!PIXI) {
    throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
  }

  const container = new PIXI.Container();
  container.visible = false;

  const frame = new PIXI.Container();
  container.addChild(frame);
  const hudOverlay = new PIXI.Container();

  const background = new PIXI.Sprite(textures.bg);
  background.x = 0;
  background.y = 0;
  background.width = DESIGN_W;
  background.height = DESIGN_H;
  frame.addChild(background);

  let board = null;
  let player = null;
  let currentStage = null;
  let currentCharacterSheet = null;

  const state = {
    keyCollected: 0,
    keyGoal: 0,
    moveCount: 0,
    stars: 0,
    clear: false,
    portalActive: false,
    active: false,
    stageId: 1,
    mode: 'basic',
  };

  let keyHudContainer = null;
  let keyCurrentSprite = null;
  let keySlashSprite = null;
  let keyGoalSprite = null;
  let moveHudContainer = null;
  let moveBoardSprite = null;
  let moveLabelSprite = null;
  let moveDigitsContainer = null;
  let popupContainer = null;
  let popupBgSprite = null;
  let popupCompleteSprite = null;
  let popupStageSprite = null;
  let popupStageDigitsContainer = null;
  let popupStarSprites = [];
  let popupReplayBtn = null;
  let popupNextBtn = null;
  let popupExitBtn = null;
  let backIcon = null;
  let resetIcon = null;
  let stageLabelText = null;
  let resetButtonEl = null;
  let pendingSlideOutcome = null;

  if (!debugUi) {
    debugUi = new DebugUI(root);
    setupGlobalErrorCapture();
  }

  createHud();
  updateHud();
  setUiVisible(false);

  const input = new SwipeInput(
    app.canvas ?? app.view,
    (direction) => {
      if (!state.active || state.clear || !board || !player || !currentStage) {
        return;
      }

      const before = player.getGridPosition();
      const wasAnimating = player.isAnimating();
      const slideResult = wasAnimating
        ? { moved: false, path: [] }
        : player.trySlide(direction, {
            stopAtCell: (x, y) => x === currentStage.portal.x && y === currentStage.portal.y,
            keyCells: board.getKeyCellSet(),
            keyGoal: state.keyGoal,
            collectedCount: state.keyCollected,
          });

      if (slideResult.moved) {
        state.moveCount += 1;
        pendingSlideOutcome = { path: slideResult.path, applied: false };
      }

      const after = player.getGridPosition();
      debugUi?.logMove(
        `before=(${before.x},${before.y}) after=(${after.x},${after.y}) anim=${wasAnimating} moved=${slideResult.moved}`
      );
      debugUi?.setState({ grid: `(${after.x}, ${after.y})`, animating: player.isAnimating() });
    },
    { minDistance: SWIPE_MIN_DISTANCE }
  );

  resetButtonEl.addEventListener('click', () => {
    if (!state.active) {
      return;
    }
    resetGameplay();
    debugUi?.logInput('reset');
  });

  const tickerUpdate = () => {
    if (!state.active || !board || !player) {
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
    if (!board) {
      return;
    }
    board.layout(DESIGN_W, DESIGN_H);
    layoutHudByBoard(board);
  };

  const onEnter = (ctx = {}) => {
    const payload = ctx.payload ?? ctx;
    state.active = true;
    const nextMode = payload.mode ?? 'basic';
    const nextStageId = resolveStageId(payload.stageId ?? state.stageId);
    const modeChanged = state.mode !== nextMode;
    state.mode = nextMode;
    const nextCharacterSheet = getCharacterSheet?.() ?? textures.characterSheet;
    const shouldRebuild =
      !board || nextStageId !== state.stageId || currentCharacterSheet !== nextCharacterSheet || modeChanged;
    if (shouldRebuild) {
      buildStage(nextStageId);
    }
    resetGameplay();

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
    buildStage(stageId);
    resetGameplay();
  };

  const destroy = () => {
    setUiVisible(false);
    app.ticker.remove(tickerUpdate);
    input.targetElement?.removeEventListener?.('pointerdown', input.handlePointerDown);
    input.targetElement?.removeEventListener?.('pointerup', input.handlePointerUp);
    input.targetElement?.removeEventListener?.('pointercancel', input.handlePointerCancel);
  };

  const applySlideOutcome = (path) => {
    if (!board || !currentStage) {
      return;
    }
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
      state.stars = calculateStars(currentStage.minMoves, state.moveCount, state.mode);
      onStageClear?.(state.stageId, state.stars, state.mode);
      showClear(state.stars);
    }

    updateHud();
  };

  const resetGameplay = () => {
    if (!board || !player || !currentStage) {
      return;
    }
    state.keyCollected = 0;
    state.moveCount = 0;
    state.stars = 0;
    state.clear = false;
    state.portalActive = false;
    pendingSlideOutcome = null;
    state.keyGoal = currentStage.keys.length;

    player.resetTo(currentStage.start);
    board.resetObjects();
    hideClear();
    updateHud();

    const pos = player.getGridPosition();
    debugUi?.setState({ grid: `(${pos.x}, ${pos.y})`, animating: player.isAnimating() });
  };

  const buildStage = (stageId) => {
    const nextStageId = resolveStageId(stageId);
    const stageData = getStage(nextStageId, state.mode);
    const characterSheet = getCharacterSheet?.() ?? textures.characterSheet;

    if (board) {
      frame.removeChild(board.container);
    }

    board = new Board(frame, stageData.walls, stageData.keys, stageData.portal, textures);
    player = new Player(board, stageData.start, textures, characterSheet);
    frame.addChild(hudOverlay);
    currentStage = stageData;
    currentCharacterSheet = characterSheet;
    state.stageId = nextStageId;
    state.keyGoal = stageData.keys.length;
    pendingSlideOutcome = null;
    if (stageLabelText) {
      stageLabelText.text = `STAGE ${state.stageId}`;
    }
  };

  function createHud() {
    createPixiHud();
    createPopup();
    createBackIcon();

    resetButtonEl = document.createElement('button');
    resetButtonEl.textContent = 'Reset';
    applyTopButtonStyle(resetButtonEl);

    root.appendChild(resetButtonEl);

    resetButtonEl.style.display = 'none';

    const debugButton = debugUi?.button ?? null;
    if (debugButton) {
      debugButton.style.display = 'none';
    }
  }

  function createBackIcon() {
    backIcon = new PIXI.Sprite(textures.commonBack);
    backIcon.anchor.set(0.5, 0.5);
    fitSpriteByWidth(backIcon, BACK_ICON_W);
    backIcon.position.set(BACK_ICON_POS.x, BACK_ICON_POS.y);
    backIcon.eventMode = 'static';
    backIcon.hitArea = new PIXI.Rectangle(-56, -56, 112, 112);
    backIcon.cursor = 'pointer';
    backIcon.on('pointertap', () => onGoLobby?.());
    hudOverlay.addChild(backIcon);
  }

  function createPixiHud() {
    keyHudContainer = new PIXI.Container();
    keyCurrentSprite = new PIXI.Sprite(textures.key0Label);
    keyCurrentSprite.anchor.set(0.5, 0.5);
    fitSpriteByHeight(keyCurrentSprite, PIXI_HUD.keyNumberH);

    keySlashSprite = new PIXI.Sprite(textures.keySlash);
    keySlashSprite.anchor.set(0.5, 0.5);
    fitSpriteByHeight(keySlashSprite, PIXI_HUD.keySlashH);

    keyGoalSprite = new PIXI.Sprite(textures.key3Label);
    keyGoalSprite.anchor.set(0.5, 0.5);
    fitSpriteByHeight(keyGoalSprite, PIXI_HUD.keyNumberH);

    keyCurrentSprite.position.set(-56, 0);
    keySlashSprite.position.set(0, 0);
    keyGoalSprite.position.set(52, 0);
    keyHudContainer.addChild(keyCurrentSprite);
    keyHudContainer.addChild(keySlashSprite);
    keyHudContainer.addChild(keyGoalSprite);

    moveHudContainer = new PIXI.Container();
    moveBoardSprite = new PIXI.Sprite(textures.moveBoard);
    moveBoardSprite.anchor.set(0.5, 0.5);
    fitSpriteByWidth(moveBoardSprite, PIXI_HUD.moveBoardW);

    moveLabelSprite = new PIXI.Sprite(textures.moveLabel);
    moveLabelSprite.anchor.set(0.5, 0.5);
    fitSpriteByWidth(moveLabelSprite, PIXI_HUD.moveLabelW);
    moveLabelSprite.position.set(-66, 0);

    moveDigitsContainer = new PIXI.Container();
    moveDigitsContainer.position.set(76, 0);

    moveHudContainer.addChild(moveBoardSprite);
    moveHudContainer.addChild(moveLabelSprite);
    moveHudContainer.addChild(moveDigitsContainer);

    hudOverlay.addChild(keyHudContainer);
    hudOverlay.addChild(moveHudContainer);

    const keyBounds = keyHudContainer.getLocalBounds();
    keyHudContainer.pivot.set(keyBounds.x, keyBounds.y + keyBounds.height * 0.5);

    const moveBounds = moveHudContainer.getLocalBounds();
    moveHudContainer.pivot.set(moveBounds.x + moveBounds.width, moveBounds.y + moveBounds.height * 0.5);

    resetIcon = new PIXI.Sprite(textures.popupReplay);
    resetIcon.anchor.set(0.5, 0.5);
    fitSpriteByWidth(resetIcon, RESET_ICON_W);
    resetIcon.eventMode = 'static';
    resetIcon.cursor = 'pointer';
    resetIcon.on('pointertap', () => {
      if (!state.active || state.clear) {
        return;
      }
      resetGameplay();
    });
    hudOverlay.addChild(resetIcon);

    stageLabelText = new PIXI.Text(`STAGE ${state.stageId}`, {
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      fontWeight: '800',
      fontSize: STAGE_LABEL_FONT_SIZE,
      fill: 0xffffff,
      stroke: 0x111827,
      strokeThickness: 6,
    });
    stageLabelText.anchor.set(1, 0.5);
    hudOverlay.addChild(stageLabelText);
  }

  function createPopup() {
    popupContainer = new PIXI.Container();
    popupContainer.scale.set(0.9);
    popupContainer.visible = false;
    popupContainer.eventMode = 'static';
    popupContainer.cursor = 'default';

    popupBgSprite = new PIXI.Sprite(textures.popupBg);
    popupBgSprite.anchor.set(0.5, 0.5);
    fitSpriteByWidth(popupBgSprite, POPUP_UI.bgW);
    popupContainer.addChild(popupBgSprite);

    popupCompleteSprite = new PIXI.Sprite(textures.popupComplete);
    popupCompleteSprite.anchor.set(0.5, 0.5);
    fitSpriteByWidth(popupCompleteSprite, POPUP_UI.completeW);
    popupCompleteSprite.position.set(0, -popupBgSprite.height * 0.33);
    popupContainer.addChild(popupCompleteSprite);

    popupStageSprite = new PIXI.Sprite(textures.popupStage);
    popupStageSprite.anchor.set(0.5, 0.5);
    fitSpriteByWidth(popupStageSprite, POPUP_UI.stageW);
    popupStageSprite.position.set(-50, -popupBgSprite.height * 0.13);
    popupContainer.addChild(popupStageSprite);

    popupStageDigitsContainer = new PIXI.Container();
    popupStageDigitsContainer.position.set(86, -popupBgSprite.height * 0.13);
    popupContainer.addChild(popupStageDigitsContainer);

    const starY = popupBgSprite.height * 0.03;
    popupStarSprites = [-1, 0, 1].map((offset) => {
      const star = new PIXI.Sprite(textures.popupStarEmpty);
      star.anchor.set(0.5, 0.5);
      fitSpriteByWidth(star, POPUP_UI.starW);
      star.position.set(offset * POPUP_UI.starsGap, starY);
      popupContainer.addChild(star);
      return star;
    });

    popupReplayBtn = new PIXI.Sprite(textures.popupReplay);
    popupReplayBtn.anchor.set(0.5, 0.5);
    fitSpriteByWidth(popupReplayBtn, POPUP_UI.replayW);
    popupReplayBtn.position.set(-104, popupBgSprite.height * 0.29);
    popupReplayBtn.eventMode = 'static';
    popupReplayBtn.cursor = 'pointer';
    popupReplayBtn.on('pointertap', () => {
      hideClear();
      resetGameplay();
    });
    popupContainer.addChild(popupReplayBtn);

    popupNextBtn = new PIXI.Sprite(textures.popupNext);
    popupNextBtn.anchor.set(0.5, 0.5);
    fitSpriteByWidth(popupNextBtn, POPUP_UI.nextW);
    popupNextBtn.position.set(104, popupBgSprite.height * 0.29);
    popupNextBtn.eventMode = 'static';
    popupNextBtn.cursor = 'pointer';
    popupNextBtn.on('pointertap', () => {
      const nextStageId = state.stageId + 1;
      hideClear();
      if (nextStageId > STAGE_COUNT) {
        onGoLobby?.();
        return;
      }
      buildStage(nextStageId);
      resetGameplay();
      onResize();
    });
    popupContainer.addChild(popupNextBtn);

    popupExitBtn = new PIXI.Sprite(textures.popupExit);
    popupExitBtn.anchor.set(0.5, 0.5);
    fitSpriteByWidth(popupExitBtn, POPUP_UI.exitW);
    popupExitBtn.position.set(popupBgSprite.width * 0.45, -popupBgSprite.height * 0.46);
    popupExitBtn.eventMode = 'static';
    popupExitBtn.cursor = 'pointer';
    popupExitBtn.on('pointertap', () => {
      hideClear();
      onGoLobby?.();
    });
    popupContainer.addChild(popupExitBtn);

    hudOverlay.addChild(popupContainer);
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

  function layoutHudByBoard(currentBoard) {
    if (!keyHudContainer || !moveHudContainer) {
      return;
    }

    const boardTop = currentBoard.container.y;
    const boardWidth = currentBoard.boardPixelWidth * currentBoard.container.scale.x;
    const boardHeight = currentBoard.boardPixelHeight * currentBoard.container.scale.x;
    const boardLeft = currentBoard.container.x;
    const boardRight = boardLeft + boardWidth;
    const boardBottom = boardTop + boardHeight;
    const hudTopY = boardTop;
    const hudBottomY = boardBottom;

    keyHudContainer.position.set(boardLeft, hudTopY);

    moveHudContainer.position.set(boardRight, hudTopY);

    if (resetIcon) {
      resetIcon.position.set(boardLeft, hudBottomY);
    }

    if (stageLabelText) {
      stageLabelText.position.set(boardRight, hudBottomY);
    }

    if (popupContainer) {
      const boardCenterX = boardLeft + boardWidth * 0.5;
      popupContainer.position.set(boardCenterX, POPUP_UI.bgY);
    }
  }

  function updateHud() {
    if (!keyCurrentSprite || !keyGoalSprite || !moveDigitsContainer) {
      return;
    }
    const collected = Math.max(0, Math.min(3, state.keyCollected));
    keyCurrentSprite.texture = textures[`key${collected}Label`] ?? textures.key0Label;
    keyCurrentSprite.alpha = 1;
    keyGoalSprite.texture = textures[`key${Math.max(1, Math.min(3, state.keyGoal))}Label`] ?? textures.key3Label;
    renderMoveDigits(String(state.moveCount));
  }

  function renderMoveDigits(valueText) {
    if (!moveDigitsContainer) {
      return;
    }
    moveDigitsContainer.removeChildren();

    const digits = valueText.split('');
    const sprites = [];
    let totalW = 0;

    for (const ch of digits) {
      const key = `hudNum${ch}`;
      const tex = textures[key] ?? textures.hudNum0;
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5, 0.5);
      fitSpriteByHeight(spr, PIXI_HUD.moveDigitH);
      sprites.push(spr);
      totalW += spr.width;
    }

    if (sprites.length > 1) {
      totalW += PIXI_HUD.moveDigitGap * (sprites.length - 1);
    }

    let x = -totalW * 0.5;
    for (let i = 0; i < sprites.length; i += 1) {
      const spr = sprites[i];
      x += spr.width * 0.5;
      spr.position.set(x, 0);
      moveDigitsContainer.addChild(spr);
      x += spr.width * 0.5 + PIXI_HUD.moveDigitGap;
    }
  }

  function showClear(stars = state.stars) {
    if (!popupContainer) {
      return;
    }
    renderPopupStageNumber(state.stageId);
    for (let i = 0; i < popupStarSprites.length; i += 1) {
      popupStarSprites[i].texture = i < stars ? textures.popupStar : textures.popupStarEmpty;
    }
    popupContainer.visible = true;
  }

  function hideClear() {
    if (popupContainer) {
      popupContainer.visible = false;
    }
  }

  function setUiVisible(visible) {
    if (hudOverlay) hudOverlay.visible = visible;
    if (backIcon) backIcon.visible = visible;
    if (resetButtonEl) resetButtonEl.style.display = 'none';
    if (!visible) {
      hideClear();
    }
    if (debugUi?.button) debugUi.button.style.display = 'none';
    if (debugUi?.panel && !visible) debugUi.panel.style.display = 'none';
  }

  function renderPopupStageNumber(stageId) {
    if (!popupStageDigitsContainer) {
      return;
    }
    popupStageDigitsContainer.removeChildren();

    const chars = String(stageId).split('');
    const sprites = [];
    let totalW = 0;

    for (const ch of chars) {
      const tex = textures[`popupNum${ch}`] ?? textures.popupNum0;
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5, 0.5);
      fitSpriteByHeight(spr, POPUP_UI.stageNumH);
      sprites.push(spr);
      totalW += spr.width;
    }

    if (sprites.length > 1) {
      totalW += 8 * (sprites.length - 1);
    }

    let x = -totalW * 0.5;
    for (let i = 0; i < sprites.length; i += 1) {
      const spr = sprites[i];
      x += spr.width * 0.5;
      spr.position.set(x, 0);
      popupStageDigitsContainer.addChild(spr);
      x += spr.width * 0.5 + 8;
    }
  }

  buildStage(state.stageId);
  resetGameplay();

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

const fitSpriteByWidth = (sprite, width) => {
  const ratio = sprite.texture.height / sprite.texture.width;
  sprite.width = width;
  sprite.height = width * ratio;
};

const fitSpriteByHeight = (sprite, height) => {
  const ratio = sprite.texture.width / sprite.texture.height;
  sprite.height = height;
  sprite.width = height * ratio;
};

const getPlayerRendererPosition = (player, board, frame) => {
  if (!player || !board) {
    return {
      x: frame.x + (DESIGN_W * frame.scale.x) * 0.5,
      y: frame.y + (DESIGN_H * frame.scale.y) * 0.5,
    };
  }
  const localX = board.container.x + player.sprite.x * board.container.scale.x;
  const localY = board.container.y + player.sprite.y * board.container.scale.y;
  return {
    x: frame.x + localX * frame.scale.x,
    y: frame.y + localY * frame.scale.y,
  };
};

const resolveStageId = (stageId) => {
  const numeric = Number(stageId);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  const normalized = Math.floor(numeric);
  return Math.max(1, Math.min(STAGE_COUNT, normalized));
};

const calculateStars = (minMoves, moveCount, mode = 'basic') => {
  if (moveCount === minMoves) {
    return 3;
  }
  const threshold = mode === 'hard' ? 2 : 4;
  if (moveCount <= minMoves + threshold) {
    return 2;
  }
  return 1;
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
