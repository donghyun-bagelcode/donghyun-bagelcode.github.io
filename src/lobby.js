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

const STAR_COUNTER_UI = {
  offsetX: 40,
  offsetY: 0,
  digitH: 48,
  itemGap: 8,
  slashFontSize: 40,
  slashColor: 0xffffff,
  slashStroke: 0x1f2937,
  slashStrokeThickness: 6,
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
const CHARACTER_POPUP_UI = {
  bgW: 900,
  centerX: 540,
  centerY: 960,
  titleW: 420,
  closeW: 52,
  okW: 220,
  slotW: 170,
  slotGapX: 28,
  slotGapY: 32,
  gridTopY: -130,
  starsW: 20,
  starsGap: 22,
  portraitScale: 0.82,
};
const CHARACTER_GRID_SLOT_TOTAL = 9;
const CHARACTER_LIST = [
  { id: 'knight', textureKey: 'charPopKnight' },
  { id: 'thief', textureKey: 'charPopThief' },
  { id: 'archer', textureKey: 'charPopArcher' },
  { id: 'magician', textureKey: 'charPopMagician' },
];
const CHARACTER_TEXTURE_BY_ID = {
  knight: 'charPopKnight',
  thief: 'charPopThief',
  archer: 'charPopArcher',
  magician: 'charPopMagician',
};

export const createLobbyScene = ({
  app,
  textures,
  onSelectStage,
  onGoWorld,
  getProgress,
  onCharacterSelect,
  getSelectedCharacter,
}) => {
  const PIXI = getPixi();
  if (!PIXI) {
    throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
  }

  const container = new PIXI.Container();
  container.visible = false;
  let currentMode = 'basic';

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
  title.eventMode = 'static';
  title.cursor = 'pointer';
  frame.addChild(title);

  const starBar = new PIXI.Sprite(textures.starCollect);
  starBar.anchor.set(0.5, 0.5);
  fitByWidth(starBar, 555);
  starBar.position.set(UI_POS.starBar.x, UI_POS.starBar.y);
  frame.addChild(starBar);

  const starCounterContainer = new PIXI.Container();
  starCounterContainer.position.set(UI_POS.starBar.x + STAR_COUNTER_UI.offsetX, UI_POS.starBar.y + STAR_COUNTER_UI.offsetY);
  frame.addChild(starCounterContainer);

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

  const stageNodes = STAGE_META.map((meta) =>
    createStageNode(PIXI, textures, meta.id, (stageId) => onSelectStage?.(stageId, currentMode))
  );
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
  characterBadge.eventMode = 'static';
  characterBadge.cursor = 'pointer';
  frame.addChild(characterBadge);

  let selectedCharacterId = normalizeCharacterId(getSelectedCharacter?.());
  let pendingCharacterId = selectedCharacterId;

  const charPopupContainer = new PIXI.Container();
  charPopupContainer.visible = false;
  charPopupContainer.eventMode = 'static';
  charPopupContainer.hitArea = new PIXI.Rectangle(0, 0, DESIGN_W, DESIGN_H);
  frame.addChild(charPopupContainer);

  const popupBlocker = new PIXI.Sprite(PIXI.Texture.WHITE);
  popupBlocker.position.set(0, 0);
  popupBlocker.width = DESIGN_W;
  popupBlocker.height = DESIGN_H;
  popupBlocker.alpha = 0.001;
  popupBlocker.eventMode = 'static';
  popupBlocker.cursor = 'default';
  popupBlocker.on('pointertap', () => {});
  charPopupContainer.addChild(popupBlocker);

  const charPopupRoot = new PIXI.Container();
  charPopupRoot.position.set(CHARACTER_POPUP_UI.centerX, CHARACTER_POPUP_UI.centerY);
  charPopupContainer.addChild(charPopupRoot);

  const charPopupBg = new PIXI.Sprite(textures.charPopBg);
  charPopupBg.anchor.set(0.5, 0.5);
  fitByWidth(charPopupBg, CHARACTER_POPUP_UI.bgW);
  charPopupRoot.addChild(charPopupBg);

  const charPopupTitle = new PIXI.Sprite(textures.charPopTitle);
  charPopupTitle.anchor.set(0.5, 0.5);
  fitByWidth(charPopupTitle, CHARACTER_POPUP_UI.titleW);
  charPopupTitle.position.set(0, -charPopupBg.height * 0.37);
  charPopupRoot.addChild(charPopupTitle);

  const charPopupClose = new PIXI.Sprite(textures.charPopClose);
  charPopupClose.anchor.set(0.5, 0.5);
  fitByWidth(charPopupClose, CHARACTER_POPUP_UI.closeW);
  charPopupClose.position.set(charPopupBg.width * 0.42, -charPopupBg.height * 0.41);
  charPopupClose.eventMode = 'static';
  charPopupClose.cursor = 'pointer';
  charPopupRoot.addChild(charPopupClose);

  const slotGridContainer = new PIXI.Container();
  charPopupRoot.addChild(slotGridContainer);

  const slotTotalW = CHARACTER_POPUP_UI.slotW * 3 + CHARACTER_POPUP_UI.slotGapX * 2;
  const slotNodes = [];
  for (let index = 0; index < CHARACTER_GRID_SLOT_TOTAL; index += 1) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = -slotTotalW * 0.5 + col * (CHARACTER_POPUP_UI.slotW + CHARACTER_POPUP_UI.slotGapX) + CHARACTER_POPUP_UI.slotW * 0.5;
    const y = CHARACTER_POPUP_UI.gridTopY + row * (CHARACTER_POPUP_UI.slotW + CHARACTER_POPUP_UI.slotGapY);
    const character = CHARACTER_LIST[index] ?? null;
    const slot = createCharacterSlot(PIXI, textures, character);
    slot.container.position.set(x, y);
    slotGridContainer.addChild(slot.container);
    slotNodes.push(slot);
  }

  const charPopupOk = new PIXI.Sprite(textures.charPopOk);
  charPopupOk.anchor.set(0.5, 0.5);
  fitByWidth(charPopupOk, CHARACTER_POPUP_UI.okW);
  charPopupOk.position.set(0, charPopupBg.height * 0.38);
  charPopupOk.eventMode = 'static';
  charPopupOk.cursor = 'pointer';
  charPopupRoot.addChild(charPopupOk);

  const refreshCharacterPopupSelection = () => {
    for (const slot of slotNodes) {
      if (!slot.characterId) {
        continue;
      }
      slot.frame.texture = slot.characterId === pendingCharacterId ? textures.charPopSlotRed : textures.charPopSlotYellow;
    }
  };

  const applyCharacterBadge = () => {
    const textureKey = CHARACTER_TEXTURE_BY_ID[selectedCharacterId];
    const texture = textures[textureKey] ?? textures.lobbyCharacter;
    characterBadge.texture = texture;
    fitByHeight(characterBadge, SELECT_CHARACTER_H);
  };

  const openCharacterPopup = () => {
    pendingCharacterId = selectedCharacterId;
    refreshCharacterPopupSelection();
    charPopupContainer.visible = true;
  };

  const closeCharacterPopup = () => {
    charPopupContainer.visible = false;
  };

  characterBadge.on('pointertap', () => {
    openCharacterPopup();
  });

  charPopupClose.on('pointertap', () => {
    pendingCharacterId = selectedCharacterId;
    closeCharacterPopup();
  });

  charPopupOk.on('pointertap', () => {
    selectedCharacterId = pendingCharacterId;
    onCharacterSelect?.(selectedCharacterId);
    applyCharacterBadge();
    closeCharacterPopup();
  });

  for (const slot of slotNodes) {
    if (!slot.characterId) {
      continue;
    }
    slot.container.eventMode = 'static';
    slot.container.cursor = 'pointer';
    slot.container.on('pointertap', () => {
      pendingCharacterId = slot.characterId;
      refreshCharacterPopupSelection();
    });
  }

  const applyProgress = () => {
    const data = getProgress?.(currentMode) ?? {};
    const progress = normalizeProgress(data.progress);
    const unlockedStageId = clampStageId(data.unlockedStageId ?? deriveUnlockedStageId(progress));
    const totalStars = clampStarsTotal(data.totalStars ?? deriveTotalStars(progress));
    selectedCharacterId = normalizeCharacterId(getSelectedCharacter?.() ?? selectedCharacterId);
    pendingCharacterId = selectedCharacterId;
    applyCharacterBadge();
    renderStarCounter(PIXI, starCounterContainer, textures, totalStars, STAGE_COUNT * 3);

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

  const applyMode = () => {
    bg.texture = currentMode === 'hard' ? textures.lobbyHardBg : textures.lobbyBg;
    title.texture = currentMode === 'hard' ? textures.lobbyHardTitle : textures.worldText;
    fitByWidth(title, 504);
    applyProgress();
  };

  title.on('pointertap', () => {
    currentMode = currentMode === 'basic' ? 'hard' : 'basic';
    applyMode();
  });

  const onResize = () => {
    layoutVirtualFrame(frame, app.renderer.width, app.renderer.height);
  };

  return {
    container,
    onEnter: () => {
      applyMode();
      onResize();
    },
    onExit: () => {
      closeCharacterPopup();
    },
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
  return textures.stageBlue;
};

const createCharacterSlot = (PIXI, textures, character) => {
  const container = new PIXI.Container();
  const frame = new PIXI.Sprite(textures.charPopSlotYellow);
  frame.anchor.set(0.5, 0.5);
  fitByWidth(frame, CHARACTER_POPUP_UI.slotW);
  container.addChild(frame);

  if (!character) {
    frame.alpha = 0.4;
    return { container, frame, characterId: null };
  }

  const portrait = new PIXI.Sprite(textures[character.textureKey]);
  portrait.anchor.set(0.5, 0.5);
  fitByHeight(portrait, CHARACTER_POPUP_UI.slotW * CHARACTER_POPUP_UI.portraitScale);
  portrait.position.set(0, -CHARACTER_POPUP_UI.slotW * 0.06);
  container.addChild(portrait);

  for (let i = 0; i < 3; i += 1) {
    const star = new PIXI.Sprite(textures.charPopStar);
    star.anchor.set(0.5, 0.5);
    fitByWidth(star, CHARACTER_POPUP_UI.starsW);
    star.position.set((i - 1) * CHARACTER_POPUP_UI.starsGap, CHARACTER_POPUP_UI.slotW * 0.33);
    container.addChild(star);
  }

  return { container, frame, characterId: character.id };
};

const renderStarCounter = (PIXI, container, textures, value, maxValue) => {
  container.removeChildren();

  const text = `${value}/${maxValue}`;
  const items = [];
  let totalWidth = 0;

  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      const tex = textures[`hudNum${ch}`] ?? textures[`num${ch}`];
      const digit = new PIXI.Sprite(tex);
      digit.anchor.set(0.5, 0.5);
      fitByHeight(digit, STAR_COUNTER_UI.digitH);
      items.push(digit);
      totalWidth += digit.width;
      continue;
    }

    const slash = new PIXI.Text(ch, {
      fontFamily: 'Avenir Next, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      fontWeight: '800',
      fontSize: STAR_COUNTER_UI.slashFontSize,
      fill: STAR_COUNTER_UI.slashColor,
      stroke: STAR_COUNTER_UI.slashStroke,
      strokeThickness: STAR_COUNTER_UI.slashStrokeThickness,
    });
    slash.anchor.set(0.5, 0.5);
    items.push(slash);
    totalWidth += slash.width;
  }

  if (items.length > 1) {
    totalWidth += STAR_COUNTER_UI.itemGap * (items.length - 1);
  }

  let x = -totalWidth * 0.5;
  for (const item of items) {
    x += item.width * 0.5;
    item.position.set(x, 0);
    container.addChild(item);
    x += item.width * 0.5 + STAR_COUNTER_UI.itemGap;
  }
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

const normalizeCharacterId = (characterId) => {
  if (typeof characterId !== 'string') {
    return 'knight';
  }
  return CHARACTER_TEXTURE_BY_ID[characterId] ? characterId : 'knight';
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
