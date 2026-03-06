import { getPixi } from './pixi.js';
import { AudioManager } from './audio.js';

const DESIGN_W = 1080;
const DESIGN_H = 1920;

const TITLE_POS = { x: 540, y: 120 };
const TITLE_W = 680;
const BAR_POS = { x: 540, y: 1780 };
const BAR_W = 700;

const DOT_INTERVAL_MS = 400;
const LOADING_SLOT_COUNT = 5;
const LOADING_FILL_INTERVAL_MS = 100;
const LOADING_POST_FILL_DELAY_MS = 100;
const TITLE_FLOAT_AMPLITUDE = 8;
const TITLE_FLOAT_PERIOD_MS = 1800;

const BAR_INNER_PADDING_RATIO = 0.08;
const BAR_GAGE_HEIGHT_RATIO = 0.78;
const GAGE_GAP = 6;
const GAGE_OFFSET_Y = 12;
const GAGE_WIDTH_SCALE = 1.1;
const LOADING_CENTER_OFFSET_Y = 15;
const TOUCH_TO_START_W = 400;
const TOUCH_BLINK_PERIOD_MS = 1000;
const TOUCH_BLINK_MIN_ALPHA = 0.5;
const TOUCH_BLINK_MAX_ALPHA = 1.0;

export const createSplashScene = ({ app, textures, onComplete }) => {
  const PIXI = getPixi();
  if (!PIXI) {
    throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
  }

  const container = new PIXI.Container();
  container.visible = false;

  const frame = new PIXI.Container();
  frame.eventMode = 'static';
  frame.hitArea = new PIXI.Rectangle(0, 0, DESIGN_W, DESIGN_H);
  container.addChild(frame);

  const bg = new PIXI.Sprite(textures.splashBg);
  bg.position.set(0, 0);
  bg.width = DESIGN_W;
  bg.height = DESIGN_H;
  frame.addChild(bg);

  const title = new PIXI.Sprite(textures.splashTitle);
  title.anchor.set(0.5, 0);
  fitByWidth(title, TITLE_W);
  title.position.set(TITLE_POS.x, TITLE_POS.y);
  frame.addChild(title);

  const loadingBar = new PIXI.Sprite(textures.splashBar);
  loadingBar.anchor.set(0.5, 0.5);
  fitByWidth(loadingBar, BAR_W);
  loadingBar.position.set(BAR_POS.x, BAR_POS.y);
  frame.addChild(loadingBar);

  const gageContainer = new PIXI.Container();
  gageContainer.position.set(BAR_POS.x, BAR_POS.y + GAGE_OFFSET_Y);
  frame.addChild(gageContainer);

  const innerWidth = loadingBar.width * (1 - BAR_INNER_PADDING_RATIO * 2);
  const slotCount = LOADING_SLOT_COUNT;
  const gageGap = GAGE_GAP;
  const gageWBase = (innerWidth - gageGap * (slotCount - 1)) / slotCount;
  const gageW = gageWBase * GAGE_WIDTH_SCALE;
  const maxGageH = loadingBar.height * BAR_GAGE_HEIGHT_RATIO;
  const totalW = gageW * slotCount + gageGap * (slotCount - 1);
  const startX = -totalW * 0.5 + gageW * 0.5;

  const gageSprites = Array.from({ length: slotCount }, (_, index) => {
    const gage = new PIXI.Sprite(textures.splashGage);
    fitByWidth(gage, gageW);
    if (gage.height > maxGageH) {
      fitByHeight(gage, maxGageH);
    }
    gage.anchor.set(0.5, 0.5);
    gage.position.set(startX + index * (gageW + gageGap), 0);
    gage.visible = false;
    gageContainer.addChild(gage);
    return gage;
  });

  const loadingText = new PIXI.Sprite(textures.splashLoadingText);
  loadingText.anchor.set(0.5, 0.5);
  fitByHeight(loadingText, 42);
  loadingText.position.set(BAR_POS.x, BAR_POS.y + LOADING_CENTER_OFFSET_Y);
  frame.addChild(loadingText);

  const dotSprites = Array.from({ length: 3 }, (_, index) => {
    const dot = new PIXI.Sprite(textures.splashDot);
    dot.anchor.set(0, 0.5);
    fitByHeight(dot, 24);
    dot.position.set(
      loadingText.x + loadingText.width * 0.5 + 8 + index * (dot.width + 6),
      BAR_POS.y + LOADING_CENTER_OFFSET_Y
    );
    dot.visible = false;
    frame.addChild(dot);
    return dot;
  });

  const touchToStart = new PIXI.Sprite(textures.splashTouchToStart);
  touchToStart.anchor.set(0.5, 0.5);
  fitByWidth(touchToStart, TOUCH_TO_START_W);
  touchToStart.position.set(BAR_POS.x, BAR_POS.y);
  touchToStart.visible = false;
  frame.addChild(touchToStart);

  const state = {
    dotElapsedMs: 0,
    gageElapsedMs: 0,
    completeElapsedMs: 0,
    titleFloatElapsedMs: 0,
    dotCount: 0,
    filledCount: 0,
    active: false,
    waitingComplete: false,
    waitingTouch: false,
    completed: false,
    touchBlinkElapsedMs: 0,
    tickerAttached: false,
  };

  const setLoadingVisualVisible = (visible) => {
    loadingBar.visible = visible;
    gageContainer.visible = visible;
    loadingText.visible = visible;
    for (let i = 0; i < dotSprites.length; i += 1) {
      dotSprites[i].visible = visible && i < state.dotCount;
    }
  };

  const resetVisuals = () => {
    state.dotElapsedMs = 0;
    state.gageElapsedMs = 0;
    state.completeElapsedMs = 0;
    state.titleFloatElapsedMs = 0;
    state.dotCount = 0;
    state.filledCount = 0;
    state.waitingComplete = false;
    state.waitingTouch = false;
    state.completed = false;
    state.touchBlinkElapsedMs = 0;
    title.y = TITLE_POS.y;
    touchToStart.visible = false;
    touchToStart.alpha = TOUCH_BLINK_MAX_ALPHA;
    setLoadingVisualVisible(true);

    for (const dot of dotSprites) {
      dot.visible = false;
    }
    for (const gage of gageSprites) {
      gage.visible = false;
    }
  };

  const updateDots = () => {
    state.dotCount = (state.dotCount + 1) % 4;
    for (let i = 0; i < dotSprites.length; i += 1) {
      dotSprites[i].visible = i < state.dotCount;
    }
  };

  const fillNextGage = () => {
    if (state.filledCount < gageSprites.length) {
      gageSprites[state.filledCount].visible = true;
      state.filledCount += 1;
    }
    if (state.filledCount >= gageSprites.length && !state.waitingComplete && !state.completed) {
      state.waitingComplete = true;
      state.completeElapsedMs = 0;
    }
  };

  const tickerUpdate = () => {
    if (!state.active) {
      return;
    }

    state.titleFloatElapsedMs += app.ticker.deltaMS;
    const phase = (state.titleFloatElapsedMs / TITLE_FLOAT_PERIOD_MS) * Math.PI * 2;
    title.y = TITLE_POS.y + Math.sin(phase) * TITLE_FLOAT_AMPLITUDE;

    if (state.waitingTouch) {
      state.touchBlinkElapsedMs += app.ticker.deltaMS;
      const pulse =
        (Math.sin((state.touchBlinkElapsedMs / TOUCH_BLINK_PERIOD_MS) * Math.PI * 2) + 1) * 0.5;
      touchToStart.alpha =
        TOUCH_BLINK_MIN_ALPHA + (TOUCH_BLINK_MAX_ALPHA - TOUCH_BLINK_MIN_ALPHA) * pulse;
      return;
    }

    if (state.completed) {
      return;
    }

    state.dotElapsedMs += app.ticker.deltaMS;
    state.gageElapsedMs += app.ticker.deltaMS;

    while (state.dotElapsedMs >= DOT_INTERVAL_MS) {
      state.dotElapsedMs -= DOT_INTERVAL_MS;
      updateDots();
    }

    while (state.gageElapsedMs >= LOADING_FILL_INTERVAL_MS && !state.completed) {
      state.gageElapsedMs -= LOADING_FILL_INTERVAL_MS;
      fillNextGage();
    }

    if (state.waitingComplete && !state.completed) {
      state.completeElapsedMs += app.ticker.deltaMS;
      if (state.completeElapsedMs >= LOADING_POST_FILL_DELAY_MS) {
        state.completed = true;
        state.waitingComplete = false;
        state.waitingTouch = true;
        setLoadingVisualVisible(false);
        touchToStart.visible = true;
        touchToStart.alpha = TOUCH_BLINK_MAX_ALPHA;
      }
    }
  };

  frame.on('pointertap', () => {
    if (!state.active || !state.waitingTouch) {
      return;
    }
    state.waitingTouch = false;
    touchToStart.visible = false;
    onComplete?.();
  });

  const onEnter = () => {
    resetVisuals();
    state.active = true;
    AudioManager.playBgm('bgm/BGM-01_splash.mp3');
    if (!state.tickerAttached) {
      app.ticker.add(tickerUpdate);
      state.tickerAttached = true;
    }
    onResize();
  };

  const onExit = () => {
    state.active = false;
    AudioManager.stopBgm();
    title.y = TITLE_POS.y;
    if (state.tickerAttached) {
      app.ticker.remove(tickerUpdate);
      state.tickerAttached = false;
    }
  };

  const onResize = () => {
    layoutVirtualFrame(frame, app.renderer.width, app.renderer.height);
  };

  return {
    container,
    onEnter,
    onExit,
    onResize,
  };
};

const fitByWidth = (sprite, width) => {
  const ratio = sprite.texture.height / sprite.texture.width;
  sprite.width = width;
  sprite.height = width * ratio;
};

const fitByHeight = (sprite, height) => {
  const ratio = sprite.texture.width / sprite.texture.height;
  sprite.height = height;
  sprite.width = height * ratio;
};

const layoutVirtualFrame = (frame, screenW, screenH) => {
  const scale = Math.min(screenW / DESIGN_W, screenH / DESIGN_H);
  frame.scale.set(scale);
  frame.x = (screenW - DESIGN_W * scale) * 0.5;
  frame.y = 0;
};
