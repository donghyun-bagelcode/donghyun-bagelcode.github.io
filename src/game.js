import { Board } from './board.js';
import { getStage, STAGE_COUNT, SWIPE_MIN_DISTANCE, TRAIL_TUNING } from './config.js';
import { AudioManager } from './audio.js';
import { DebugUI } from './debug-ui.js';
import { SwipeInput } from './input.js';
import { Player } from './player.js';
import { getPixi } from './pixi.js';
import { Easing, TweenManager } from './tween.js';

const DESIGN_W = 1080;
const DESIGN_H = 1920;
const BACK_ICON_W = 66;
const BACK_ICON_POS = { x: 65, y: 115 };
const STAGE_ICON_W = 136;
const RESET_ICON_W = 56;
const TRAIL_TRIGGER_PROGRESS = Math.max(0, Math.min(1, TRAIL_TUNING?.triggerProgress ?? 1));

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
  keyFrameW: 250,
  keyNumberH: 60,
  keySlashH: 42,
  moveBoardW: 340,
  moveLabelW: 126,
  moveDigitH: 46,
  moveDigitGap: 8,
  stageDigitH: 54,
  stageDigitGap: 6,
  stageGap: 10,
};

const HUD_TRANSFORM = {
  key: { offsetX: 180, offsetY: 110, scale: 1.7 },
  move: { offsetX: -181, offsetY: 117, scale: 1.25 },
  reset: { offsetX: 240, offsetY: -125, scale: 2 },
  stage: { offsetX: -180, offsetY: -135, scale: 1.3 },
};

const KEY_HUD_TEXT_TRANSFORM = {
  current: { offsetX: -26, offsetY: 6, scale: 0.6 },
  slash: { offsetX: 0, offsetY: 6, scale: 0.8 },
  goal: { offsetX: 25, offsetY: 6, scale: 0.6 },
};

const STAGE_HUD_NUMBER_TRANSFORM = {
  offsetX: 0,
  offsetY: 0,
  scale: 0.8,
};

const DEBUG_FORCE_CLEAR_POPUP_ON_ENTER = false;
const DEBUG_FORCE_CLEAR_POPUP_STARS = 3;
const DEBUG_FORCE_CLEAR_BLOCK_INPUT = true;

const POPUP_UI = {
  bgW: 560,
  bgY: 980,
  scale: 1.4,
  completeW: 310,
  completePosX: 0,
  completePosYRatio: -0.33,
  completePosYOffset: -50,
  stageW: 180,
  stagePosX: -50,
  stagePosYRatio: -0.13,
  stagePosYOffset: -20,
  stageNumH: 60,
  stageNumGap: 2,
  stageNumPosX: 86,
  stageNumPosYRatio: -0.13,
  stageNumPosYOffset: -20,
  starW: 120,
  starsGap: 142,
  starsYRatio: 0.03,
  starsYOffset: 0,
  replayW: 210,
  replayPosX: -114,
  replayPosYRatio: 0.29,
  replayPosYOffset: 15,
  nextW: 210,
  nextPosX: 114,
  nextPosYRatio: 0.29,
  nextPosYOffset: 15,
  exitW: 86,
  exitPosXRatio: 0.45,
  exitPosYRatio: -0.46,
  exitPosXOffset: 0,
  exitPosYOffset: 0,
};

export const createGameScene = ({ app, root, textures, onGoLobby, onStageClear, getCharacterSheet, getCharacterId }) => {
  const PIXI = getPixi();
  if (!PIXI) {
    throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
  }

  const container = new PIXI.Container();
  container.visible = false;
  const tweens = new TweenManager(app.ticker);

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
  let currentCharacterId = null;

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
  let keyFrameSprite = null;
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
  let stageHudContainer = null;
  let stageLabelSprite = null;
  let stageDigitsContainer = null;
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
        AudioManager.playSfx('sfx/sfx-game-swipe-start-01.mp3', { volume: 0.4 });
        pendingSlideOutcome = { path: slideResult.path, applied: false, trailPlayed: false };
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

    if (pendingSlideOutcome && !pendingSlideOutcome.trailPlayed && player.getAnimationProgress() >= TRAIL_TRIGGER_PROGRESS) {
      board?.playTrail(pendingSlideOutcome.path, tweens);
      pendingSlideOutcome.trailPlayed = true;
    }

    if (pendingSlideOutcome && !player.isAnimating()) {
      if (!pendingSlideOutcome.applied) {
        applySlideOutcome(pendingSlideOutcome.path);
      }
      if (!pendingSlideOutcome.trailPlayed) {
        board?.playTrail(pendingSlideOutcome.path, tweens);
      }
      AudioManager.playSfx('sfx/sfx-game-wall-hit-01.mp3', { volume: 0.5 });
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
    const nextCharacterId = getCharacterId?.() ?? 'knight';
    const shouldRebuild =
      !board ||
      nextStageId !== state.stageId ||
      currentCharacterSheet !== nextCharacterSheet ||
      currentCharacterId !== nextCharacterId ||
      modeChanged;
    if (shouldRebuild) {
      buildStage(nextStageId);
    }
    resetGameplay();
    AudioManager.playBgm(state.mode === 'hard' ? 'bgm/BGM-05_hard.mp3' : 'bgm/BGM-04_Ingame.mp3');

    onResize();
    setUiVisible(true);

    if (DEBUG_FORCE_CLEAR_POPUP_ON_ENTER) {
      state.stars = Math.max(0, Math.min(3, DEBUG_FORCE_CLEAR_POPUP_STARS));
      state.clear = DEBUG_FORCE_CLEAR_BLOCK_INPUT;
      showClear(state.stars);
    }

    const pos = player.getGridPosition();
    debugUi?.setState({ grid: `(${pos.x}, ${pos.y})`, animating: player.isAnimating() });
  };

  const onExit = () => {
    state.active = false;
    AudioManager.stopBgm();
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
    board?.clearTrailOverlays(tweens);
    tweens.destroy();
    app.ticker.remove(tickerUpdate);
    input.targetElement?.removeEventListener?.('pointerdown', input.handlePointerDown);
    input.targetElement?.removeEventListener?.('pointerup', input.handlePointerUp);
    input.targetElement?.removeEventListener?.('pointercancel', input.handlePointerCancel);
  };

  const playTapAlphaFeedback = (button) => {
    if (!button) {
      return;
    }
    AudioManager.playSfx('ui/sfx-ui-tap-01.mp3', { volume: 0.5 });
    tweens.cancelAll(button);
    button.alpha = 0.7;
    tweens.to(button, { alpha: 1 }, 100);
  };

  const applySlideOutcome = (path) => {
    if (!board || !currentStage) {
      return;
    }
    const gained = board.collectKeysOnPath(path);
    if (gained > 0) {
      AudioManager.playSfx('sfx/sfx-game-key-pickup-01.mp3', { volume: 0.7 });
      state.keyCollected += gained;
      if (state.keyCollected >= state.keyGoal && !state.portalActive) {
        state.portalActive = true;
        board.setPortalActive(true);
        AudioManager.playSfx('sfx/sfx-game-portal-activate-01.mp3', { volume: 0.8 });
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
    board.resetObjects(tweens);
    hideClear();
    updateHud();

    const pos = player.getGridPosition();
    debugUi?.setState({ grid: `(${pos.x}, ${pos.y})`, animating: player.isAnimating() });
  };

  const buildStage = (stageId) => {
    const nextStageId = resolveStageId(stageId);
    const stageData = getStage(nextStageId, state.mode);
    const characterSheet = getCharacterSheet?.() ?? textures.characterSheet;
    const characterId = getCharacterId?.() ?? 'knight';

    if (board) {
      board.clearTrailOverlays(tweens);
      frame.removeChild(board.container);
    }

    board = new Board(frame, stageData.walls, stageData.keys, stageData.portal, textures);
    player = new Player(board, stageData.start, textures, characterSheet, characterId);
    frame.addChild(hudOverlay);
    currentStage = stageData;
    currentCharacterSheet = characterSheet;
    currentCharacterId = characterId;
    state.stageId = nextStageId;
    state.keyGoal = stageData.keys.length;
    pendingSlideOutcome = null;
    if (stageDigitsContainer) {
      renderStageHudNumber(state.stageId);
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
    backIcon.on('pointertap', () => {
      playTapAlphaFeedback(backIcon);
      onGoLobby?.();
    });
    hudOverlay.addChild(backIcon);
  }

  function createPixiHud() {
    keyHudContainer = new PIXI.Container();
    keyFrameSprite = new PIXI.Sprite(textures.keyFrame ?? textures.moveBoard);
    keyFrameSprite.anchor.set(0.5, 0.5);
    fitSpriteByWidth(keyFrameSprite, PIXI_HUD.keyFrameW);

    keyCurrentSprite = new PIXI.Sprite(textures.key0Label);
    keyCurrentSprite.anchor.set(0.5, 0.5);
    fitSpriteByHeight(keyCurrentSprite, PIXI_HUD.keyNumberH * KEY_HUD_TEXT_TRANSFORM.current.scale);

    keySlashSprite = new PIXI.Sprite(textures.keySlash);
    keySlashSprite.anchor.set(0.5, 0.5);
    fitSpriteByHeight(keySlashSprite, PIXI_HUD.keySlashH * KEY_HUD_TEXT_TRANSFORM.slash.scale);

    keyGoalSprite = new PIXI.Sprite(textures.key3Label);
    keyGoalSprite.anchor.set(0.5, 0.5);
    fitSpriteByHeight(keyGoalSprite, PIXI_HUD.keyNumberH * KEY_HUD_TEXT_TRANSFORM.goal.scale);

    keyCurrentSprite.position.set(KEY_HUD_TEXT_TRANSFORM.current.offsetX, KEY_HUD_TEXT_TRANSFORM.current.offsetY);
    keySlashSprite.position.set(KEY_HUD_TEXT_TRANSFORM.slash.offsetX, KEY_HUD_TEXT_TRANSFORM.slash.offsetY);
    keyGoalSprite.position.set(KEY_HUD_TEXT_TRANSFORM.goal.offsetX, KEY_HUD_TEXT_TRANSFORM.goal.offsetY);
    keyHudContainer.addChild(keyFrameSprite);
    keyHudContainer.addChild(keyCurrentSprite);
    keyHudContainer.addChild(keySlashSprite);
    keyHudContainer.addChild(keyGoalSprite);
    keyHudContainer.scale.set(HUD_TRANSFORM.key.scale);

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
    moveHudContainer.scale.set(HUD_TRANSFORM.move.scale);

    hudOverlay.addChild(keyHudContainer);
    hudOverlay.addChild(moveHudContainer);

    const keyBounds = keyHudContainer.getLocalBounds();
    keyHudContainer.pivot.set(keyBounds.x, keyBounds.y + keyBounds.height * 0.5);

    const moveBounds = moveHudContainer.getLocalBounds();
    moveHudContainer.pivot.set(moveBounds.x + moveBounds.width, moveBounds.y + moveBounds.height * 0.5);

    resetIcon = new PIXI.Sprite(textures.resetButton ?? textures.popupReplay);
    resetIcon.anchor.set(0.5, 0.5);
    fitSpriteByWidth(resetIcon, RESET_ICON_W);
    resetIcon.scale.set(resetIcon.scale.x * HUD_TRANSFORM.reset.scale, resetIcon.scale.y * HUD_TRANSFORM.reset.scale);
    resetIcon.eventMode = 'static';
    resetIcon.cursor = 'pointer';
    resetIcon.on('pointertap', () => {
      playTapAlphaFeedback(resetIcon);
      if (!state.active || state.clear) {
        return;
      }
      AudioManager.playSfx('system/sfx-retry-01.mp3', { volume: 0.6 });
      resetGameplay();
    });
    hudOverlay.addChild(resetIcon);

    stageHudContainer = new PIXI.Container();
    stageLabelSprite = new PIXI.Sprite(textures.stageLabel ?? textures.popupStage);
    stageLabelSprite.anchor.set(0, 0.5);
    fitSpriteByWidth(stageLabelSprite, STAGE_ICON_W);
    stageLabelSprite.position.set(0, 0);
    stageHudContainer.addChild(stageLabelSprite);

    stageDigitsContainer = new PIXI.Container();
    stageDigitsContainer.position.set(stageLabelSprite.width + PIXI_HUD.stageGap, 0);
    stageHudContainer.addChild(stageDigitsContainer);
    stageHudContainer.scale.set(HUD_TRANSFORM.stage.scale);
    renderStageHudNumber(state.stageId);
    hudOverlay.addChild(stageHudContainer);
  }

  function createPopup() {
    popupContainer = new PIXI.Container();
    popupContainer.scale.set(POPUP_UI.scale);
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
    popupCompleteSprite.position.set(
      POPUP_UI.completePosX,
      popupBgSprite.height * POPUP_UI.completePosYRatio + POPUP_UI.completePosYOffset
    );
    popupContainer.addChild(popupCompleteSprite);

    popupStageSprite = new PIXI.Sprite(textures.popupStage);
    popupStageSprite.anchor.set(0.5, 0.5);
    fitSpriteByWidth(popupStageSprite, POPUP_UI.stageW);
    popupStageSprite.position.set(
      POPUP_UI.stagePosX,
      popupBgSprite.height * POPUP_UI.stagePosYRatio + POPUP_UI.stagePosYOffset
    );
    popupContainer.addChild(popupStageSprite);

    popupStageDigitsContainer = new PIXI.Container();
    popupStageDigitsContainer.position.set(
      POPUP_UI.stageNumPosX,
      popupBgSprite.height * POPUP_UI.stageNumPosYRatio + POPUP_UI.stageNumPosYOffset
    );
    popupContainer.addChild(popupStageDigitsContainer);

    const starY = popupBgSprite.height * POPUP_UI.starsYRatio + POPUP_UI.starsYOffset;
    popupStarSprites = [-1, 0, 1].map((offset) => {
      const star = new PIXI.Sprite(textures.popupStarEmpty);
      star.anchor.set(0.5, 0.5);
      fitSpriteByWidth(star, POPUP_UI.starW);
      star.fxBaseScaleX = star.scale.x;
      star.fxBaseScaleY = star.scale.y;
      star.position.set(offset * POPUP_UI.starsGap, starY);
      popupContainer.addChild(star);
      return star;
    });

    popupReplayBtn = new PIXI.Sprite(textures.popupReplay);
    popupReplayBtn.anchor.set(0.5, 0.5);
    fitSpriteByWidth(popupReplayBtn, POPUP_UI.replayW);
    popupReplayBtn.position.set(
      POPUP_UI.replayPosX,
      popupBgSprite.height * POPUP_UI.replayPosYRatio + POPUP_UI.replayPosYOffset
    );
    popupReplayBtn.eventMode = 'static';
    popupReplayBtn.cursor = 'pointer';
    popupReplayBtn.on('pointertap', () => {
      playTapAlphaFeedback(popupReplayBtn);
      AudioManager.playSfx('system/sfx-retry-01.mp3', { volume: 0.6 });
      hideClear();
      resetGameplay();
    });
    popupContainer.addChild(popupReplayBtn);

    popupNextBtn = new PIXI.Sprite(textures.popupNext);
    popupNextBtn.anchor.set(0.5, 0.5);
    fitSpriteByWidth(popupNextBtn, POPUP_UI.nextW);
    popupNextBtn.position.set(
      POPUP_UI.nextPosX,
      popupBgSprite.height * POPUP_UI.nextPosYRatio + POPUP_UI.nextPosYOffset
    );
    popupNextBtn.eventMode = 'static';
    popupNextBtn.cursor = 'pointer';
    popupNextBtn.on('pointertap', () => {
      playTapAlphaFeedback(popupNextBtn);
      AudioManager.playSfx('system/sfx-next-01.mp3', { volume: 0.6 });
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
    popupExitBtn.position.set(
      popupBgSprite.width * POPUP_UI.exitPosXRatio + POPUP_UI.exitPosXOffset,
      popupBgSprite.height * POPUP_UI.exitPosYRatio + POPUP_UI.exitPosYOffset
    );
    popupExitBtn.eventMode = 'static';
    popupExitBtn.cursor = 'pointer';
    popupExitBtn.on('pointertap', () => {
      playTapAlphaFeedback(popupExitBtn);
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

    keyHudContainer.position.set(boardLeft + HUD_TRANSFORM.key.offsetX, hudTopY + HUD_TRANSFORM.key.offsetY);

    moveHudContainer.position.set(boardRight + HUD_TRANSFORM.move.offsetX, hudTopY + HUD_TRANSFORM.move.offsetY);

    if (resetIcon) {
      resetIcon.position.set(boardLeft + HUD_TRANSFORM.reset.offsetX, hudBottomY + HUD_TRANSFORM.reset.offsetY);
    }

    if (stageHudContainer) {
      stageHudContainer.position.set(boardRight + HUD_TRANSFORM.stage.offsetX, hudBottomY + HUD_TRANSFORM.stage.offsetY);
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
    renderStageHudNumber(state.stageId);
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

  function renderStageHudNumber(stageId) {
    if (!stageHudContainer || !stageDigitsContainer || !stageLabelSprite) {
      return;
    }
    stageDigitsContainer.removeChildren();

    const digits = String(stageId).split('');
    const sprites = [];
    let totalW = 0;

    for (const ch of digits) {
      const tex = textures[`hudNum${ch}`] ?? textures.hudNum0;
      const spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5, 0.5);
      fitSpriteByHeight(spr, PIXI_HUD.stageDigitH * STAGE_HUD_NUMBER_TRANSFORM.scale);
      sprites.push(spr);
      totalW += spr.width;
    }

    if (sprites.length > 1) {
      totalW += PIXI_HUD.stageDigitGap * (sprites.length - 1);
    }

    let x = -totalW * 0.5;
    for (let i = 0; i < sprites.length; i += 1) {
      const spr = sprites[i];
      x += spr.width * 0.5;
      spr.position.set(x, 0);
      stageDigitsContainer.addChild(spr);
      x += spr.width * 0.5 + PIXI_HUD.stageDigitGap;
    }

    stageDigitsContainer.position.set(
      stageLabelSprite.width + PIXI_HUD.stageGap + totalW * 0.5 + STAGE_HUD_NUMBER_TRANSFORM.offsetX,
      STAGE_HUD_NUMBER_TRANSFORM.offsetY
    );
    const stageBounds = stageHudContainer.getLocalBounds();
    stageHudContainer.pivot.set(stageBounds.x + stageBounds.width, stageBounds.y + stageBounds.height * 0.5);
  }

  function showClear(stars = state.stars) {
    if (!popupContainer) {
      return;
    }
    const starCount = Math.max(0, Math.min(stars, popupStarSprites.length));
    if (starCount === 3) {
      AudioManager.playJingle('bgm/bgm7-perfect-jingle-01.mp3', { volume: 0.8 });
    } else {
      AudioManager.playJingle('bgm/bgm6-clear-jingle-01.mp3', { volume: 0.7 });
    }

    renderPopupStageNumber(state.stageId);
    for (const star of popupStarSprites) {
      tweens.cancelAll(star.scale);
      star.texture = textures.popupStarEmpty;
      star.scale.set(star.fxBaseScaleX ?? 1, star.fxBaseScaleY ?? 1);
    }
    popupContainer.visible = true;
    tweens.cancelAll(popupContainer.scale);
    popupContainer.scale.set(0.01, 0.01);
    tweens.to(popupContainer.scale, { x: POPUP_UI.scale, y: POPUP_UI.scale }, 180, { easing: Easing.backOut });

    for (let i = 0; i < starCount; i += 1) {
      const star = popupStarSprites[i];
      const delay = 300 + i * 180;
      tweens.to(star.scale, { x: 0.01, y: 0.01 }, 1, {
        delay: delay - 1,
        onComplete: () => {
          star.texture = textures.popupStar;
          AudioManager.playSfx(`system/sfx-result-star-pop-0${i + 1}.mp3`, { volume: 0.7 });
          const baseX = star.fxBaseScaleX ?? 1;
          const baseY = star.fxBaseScaleY ?? 1;
          star.scale.set(baseX * 1.4, baseY * 1.4);
          tweens.to(star.scale, { x: baseX, y: baseY }, 200, { easing: Easing.backOut });
        },
      });
    }
  }

  function hideClear() {
    if (popupContainer) {
      tweens.cancelAll(popupContainer.scale);
      for (const star of popupStarSprites) {
        tweens.cancelAll(star.scale);
      }
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
      totalW += POPUP_UI.stageNumGap * (sprites.length - 1);
    }

    let x = -totalW * 0.5;
    for (let i = 0; i < sprites.length; i += 1) {
      const spr = sprites[i];
      x += spr.width * 0.5;
      spr.position.set(x, 0);
      popupStageDigitsContainer.addChild(spr);
      x += spr.width * 0.5 + POPUP_UI.stageNumGap;
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
