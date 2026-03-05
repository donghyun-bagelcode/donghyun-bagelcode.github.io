import { getPixi } from './pixi.js';
import { STAGE_COUNT } from './config.js';

const DESIGN_W = 1080;
const DESIGN_H = 1920;

const STAGE_META = Array.from({ length: STAGE_COUNT }, (_, i) => ({ id: i + 1 }));

const STAGE_POS = {
  1: { x: 429, y: 1568 },
  2: { x: 757, y: 1470 },
  3: { x: 525, y: 1364 },
  4: { x: 264, y: 1258 },
  5: { x: 514, y: 1166 },
  6: { x: 772, y: 1068 },
  7: { x: 586, y: 955 },
  8: { x: 429, y: 822 },
  9: { x: 669, y: 772 },
  10: { x: 644, y: 613 },
};

const UI_POS = {
  worldTitle: { x: 540, y: 173 },
  starBar: { x: 540, y: 307 },
  back: { x: 65, y: 115 },
  home: { x: 151, y: 115 },
  page: { x: 994, y: 1786 },
};

const STAGE_BUTTON_W = 184;
const STAGE_BUTTON_W_SMALL = 168;
const STAGE_NUMBER_W = 62;
const STAGE_NUMBER_H = 62;
const STAGE_NUMBER_Y_OFFSET = -18;
const TOP_BACK_ICON_W = 66;
const TOP_HOME_ICON_W = 80;
const PAGE_BUTTON_W = 108;
const SELECT_CHARACTER_H = 220;
const SELECT_CHARACTER_X_OFFSET = -10;
const SELECT_CHARACTER_STAND_OFFSET_Y = 0;

export const createLobbyScene = ({ app, textures, onSelectStage, onGoWorld, getProgress }) => {
  const PIXI = getPixi();
  if (!PIXI) {
    throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
  }

  const container = new PIXI.Container();
  container.visible = false;

  const frame = new PIXI.Container();
  container.addChild(frame);

  const bg = new PIXI.Sprite(textures.lobbyBg);
  bg.position.set(0, 0);
  bg.width = DESIGN_W;
  bg.height = DESIGN_H;
  frame.addChild(bg);

  const title = new PIXI.Sprite(textures.worldText);
  title.anchor.set(0.5, 0.5);
  fitByWidth(title, 504);
  title.position.set(UI_POS.worldTitle.x, UI_POS.worldTitle.y);
  frame.addChild(title);

  const starBar = new PIXI.Sprite(textures.starCollect);
  starBar.anchor.set(0.5, 0.5);
  fitByWidth(starBar, 555);
  starBar.position.set(UI_POS.starBar.x, UI_POS.starBar.y);
  frame.addChild(starBar);
  const starBarText = new PIXI.Text('0/30', {
    fontFamily: 'Avenir Next, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontWeight: '800',
    fontSize: 54,
    fill: 0xffffff,
    stroke: 0x1f2937,
    strokeThickness: 8,
  });
  starBarText.anchor.set(0.5, 0.5);
  starBarText.position.set(UI_POS.starBar.x + 60, UI_POS.starBar.y);
  frame.addChild(starBarText);

  const topBack = new PIXI.Sprite(textures.back);
  topBack.anchor.set(0.5, 0.5);
  fitByWidth(topBack, TOP_BACK_ICON_W);
  topBack.position.set(UI_POS.back.x, UI_POS.back.y);
  topBack.eventMode = 'static';
  topBack.hitArea = new PIXI.Rectangle(-56, -56, 112, 112);
  topBack.cursor = 'pointer';
  topBack.on('pointertap', () => onGoWorld?.());
  frame.addChild(topBack);

  const topHome = new PIXI.Sprite(textures.home);
  topHome.anchor.set(0.5, 0.5);
  fitByWidth(topHome, TOP_HOME_ICON_W);
  topHome.position.set(UI_POS.home.x, UI_POS.home.y);
  topHome.eventMode = 'static';
  topHome.cursor = 'pointer';
  frame.addChild(topHome);

  const pageButton = new PIXI.Sprite(textures.pageButton);
  pageButton.anchor.set(0.5, 0.5);
  fitByWidth(pageButton, PAGE_BUTTON_W);
  pageButton.position.set(UI_POS.page.x, UI_POS.page.y);
  pageButton.eventMode = 'static';
  pageButton.cursor = 'pointer';
  frame.addChild(pageButton);

  const stageNodes = STAGE_META.map((meta) => createStageNode(PIXI, textures, meta.id, onSelectStage));
  for (const node of stageNodes) {
    const p = STAGE_POS[node.id];

    node.button.position.set(p.x, p.y);
    frame.addChild(node.button);
    frame.addChild(node.starContainer);

    if (node.numberSprite) {
      if (node.numberSprite.texture) {
        fitByWidth(node.numberSprite, STAGE_NUMBER_W);
      }
      node.numberSprite.position.set(p.x, p.y + STAGE_NUMBER_Y_OFFSET);
      frame.addChild(node.numberSprite);
    }

    if (node.numberText) {
      node.numberText.position.set(p.x, p.y + STAGE_NUMBER_Y_OFFSET);
      frame.addChild(node.numberText);
    }
  }

  const characterBadge = createPlayableCharacterBadge(PIXI, textures);
  frame.addChild(characterBadge);

  const applyProgress = () => {
    const data = getProgress?.() ?? {};
    const progress = normalizeProgress(data.progress);
    const unlockedStageId = clampStageId(data.unlockedStageId ?? deriveUnlockedStageId(progress));
    const totalStars = clampStarsTotal(data.totalStars ?? deriveTotalStars(progress));
    starBarText.text = `${totalStars}/30`;

    let currentNode = null;
    for (const node of stageNodes) {
      const stars = clampStars(progress.stages[String(node.id)]);
      let status = 'locked';
      let playable = false;

      if (stars > 0) {
        status = 'clear';
        playable = true;
      } else if (node.id === unlockedStageId) {
        status = 'current';
        playable = true;
      } else if (node.id < unlockedStageId) {
        status = 'unlocked';
        playable = true;
      }

      applyStageNodeState(node, textures, status, playable, stars);
      if (status === 'current') {
        currentNode = node;
      }
    }

    if (!currentNode) {
      currentNode = stageNodes.find((node) => node.id === unlockedStageId) ?? stageNodes[stageNodes.length - 1];
    }

    const p = STAGE_POS[currentNode.id];
    characterBadge.position.set(p.x + SELECT_CHARACTER_X_OFFSET, p.y + SELECT_CHARACTER_STAND_OFFSET_Y);
  };

  const onResize = () => {
    layoutVirtualFrame(frame, app.renderer.width, app.renderer.height);
  };

  return {
    container,
    onEnter: () => {
      applyProgress();
      onResize();
    },
    onExit: () => {},
    onResize,
  };
};

const createStageNode = (PIXI, textures, stageId, onSelectStage) => {
  const buttonTexture = pickStageTexture(textures, 'locked');
  const button = new PIXI.Sprite(buttonTexture);
  button.anchor.set(0.5, 0.5);
  fitByWidth(button, STAGE_BUTTON_W_SMALL);

  button.eventMode = 'static';
  button.cursor = 'default';
  button.alpha = 0.94;

  let numberSprite = null;
  let numberText = null;

  if (stageId >= 1 && stageId <= 9) {
    numberSprite = new PIXI.Sprite(textures[`num${stageId}`]);
    numberSprite.anchor.set(0.5, 0.5);
  } else if (stageId === 10 && textures.num1 && textures.num0) {
    const one = new PIXI.Sprite(textures.num1);
    one.anchor.set(0.5, 0.5);
    fitByHeight(one, STAGE_NUMBER_H);

    const zero = new PIXI.Sprite(textures.num0);
    zero.anchor.set(0.5, 0.5);
    fitByHeight(zero, STAGE_NUMBER_H);

    const pair = new PIXI.Container();
    const gap = Math.round(STAGE_NUMBER_H * 0.52);
    one.position.set(-gap * 0.5, 0);
    zero.position.set(gap * 0.5, 0);
    pair.addChild(one);
    pair.addChild(zero);
    numberSprite = pair;
  } else {
    numberText = new PIXI.Text(String(stageId), {
      fontFamily: 'Avenir Next, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      fontWeight: '800',
      fontSize: 42,
      fill: 0xffffff,
      stroke: 0x111827,
      strokeThickness: 6,
    });
    numberText.anchor.set(0.5, 0.5);
  }

  const starContainer = new PIXI.Container();

  const node = { id: stageId, status: 'locked', playable: false, button, numberSprite, numberText, starContainer };
  button.on('pointertap', () => {
    if (node.playable) {
      onSelectStage?.(node.id);
    }
  });
  return node;
};

const applyStageNodeState = (node, textures, status, playable, stars) => {
  node.status = status;
  node.playable = playable;
  node.button.texture = pickStageTexture(textures, status);
  fitByWidth(node.button, status === 'clear' ? STAGE_BUTTON_W : STAGE_BUTTON_W_SMALL);
  node.button.alpha = playable ? 1 : 0.94;
  node.button.cursor = playable ? 'pointer' : 'default';

  renderStageStars(node, textures, stars);
};

const renderStageStars = (node, textures, stars) => {
  node.starContainer.removeChildren();
  if (stars <= 0 || !textures.star) {
    return;
  }

  const starW = 36;
  const gap = 34;
  const p = STAGE_POS[node.id];
  node.starContainer.position.set(p.x, p.y - node.button.height * 0.58);

  for (let i = 0; i < stars; i += 1) {
    const star = new node.button.constructor(textures.star);
    star.anchor.set(0.5, 0.5);
    fitByWidth(star, starW);
    star.position.set((i - (stars - 1) * 0.5) * gap, 0);
    node.starContainer.addChild(star);
  }
};

const pickStageTexture = (textures, status) => {
  if (status === 'clear') {
    return textures.stageYellow;
  }
  if (status === 'unlocked') {
    return textures.stageBlue;
  }
  if (status === 'current') {
    return textures.stageCurrent;
  }
  return textures.stageRed;
};

const fitByWidth = (sprite, targetWidth) => {
  const ratio = sprite.texture.height / sprite.texture.width;
  sprite.width = targetWidth;
  sprite.height = targetWidth * ratio;
};

const fitByHeight = (sprite, targetHeight) => {
  const ratio = sprite.texture.width / sprite.texture.height;
  sprite.height = targetHeight;
  sprite.width = targetHeight * ratio;
};

const createPlayableCharacterBadge = (PIXI, textures) => {
  const knight = new PIXI.Sprite(textures.lobbyCharacter);
  knight.anchor.set(0.5, 1);
  fitByHeight(knight, SELECT_CHARACTER_H);
  const p = STAGE_POS[1];
  knight.position.set(p.x + SELECT_CHARACTER_X_OFFSET, p.y + SELECT_CHARACTER_STAND_OFFSET_Y);
  return knight;
};

const clampStageId = (stageId) => {
  const numeric = Number(stageId);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.max(1, Math.min(STAGE_COUNT, Math.floor(numeric)));
};

const clampStars = (stars) => {
  const numeric = Number(stars);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(3, Math.floor(numeric)));
};

const clampStarsTotal = (totalStars) => {
  const numeric = Number(totalStars);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(STAGE_COUNT * 3, Math.floor(numeric)));
};

const normalizeProgress = (progress) => {
  if (!progress || typeof progress !== 'object' || !progress.stages || typeof progress.stages !== 'object') {
    return { stages: {} };
  }
  return progress;
};

const deriveUnlockedStageId = (progress) => {
  for (let id = 1; id <= STAGE_COUNT; id += 1) {
    if (clampStars(progress.stages[String(id)]) <= 0) {
      return id;
    }
  }
  return STAGE_COUNT;
};

const deriveTotalStars = (progress) => {
  let total = 0;
  for (let id = 1; id <= STAGE_COUNT; id += 1) {
    total += clampStars(progress.stages[String(id)]);
  }
  return total;
};

const layoutVirtualFrame = (frame, screenW, screenH) => {
  const scale = Math.min(screenW / DESIGN_W, screenH / DESIGN_H);
  frame.scale.set(scale);
  frame.x = (screenW - DESIGN_W * scale) * 0.5;
  frame.y = 0;
};
