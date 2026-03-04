import { getPixi } from './pixi.js';

const DESIGN_W = 1080;
const DESIGN_H = 1920;
const STAGE_COUNT = 10;

const STAGE_META = Array.from({ length: STAGE_COUNT }, (_, i) => ({
  id: i + 1,
  status: i === 0 ? 'current' : 'locked',
  playable: i === 0,
}));

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
const STAGE_NUMBER_Y_OFFSET = -18;
const TOP_BACK_ICON_W = 66;
const TOP_HOME_ICON_W = 80;
const PAGE_BUTTON_W = 108;
const SELECT_CHARACTER_H = 220;
const SELECT_CHARACTER_X_OFFSET = -10;
const SELECT_CHARACTER_STAND_OFFSET_Y = 0;

export const createLobbyScene = ({ app, textures, onSelectStage }) => {
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

  const title = new PIXI.Text('WORLD 1', {
    fontFamily: 'Avenir Next, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontWeight: '700',
    fontSize: 84,
    fill: 0xffffff,
    stroke: 0x1f2937,
    strokeThickness: 8,
  });
  title.anchor.set(0.5, 0.5);
  title.position.set(UI_POS.worldTitle.x, UI_POS.worldTitle.y);
  frame.addChild(title);

  const starBar = new PIXI.Sprite(textures.starCollect);
  starBar.anchor.set(0.5, 0.5);
  fitByWidth(starBar, 370);
  starBar.position.set(UI_POS.starBar.x, UI_POS.starBar.y);
  frame.addChild(starBar);

  const topBack = new PIXI.Sprite(textures.back);
  topBack.anchor.set(0.5, 0.5);
  fitByWidth(topBack, TOP_BACK_ICON_W);
  topBack.position.set(UI_POS.back.x, UI_POS.back.y);
  topBack.eventMode = 'static';
  topBack.cursor = 'pointer';
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

  const stageNodes = STAGE_META.map((meta) => createStageNode(PIXI, textures, meta, onSelectStage));
  let playableStageRef = null;
  for (const node of stageNodes) {
    const p = STAGE_POS[node.id];

    const targetButtonWidth = node.status === 'clear' ? STAGE_BUTTON_W : STAGE_BUTTON_W_SMALL;
    fitByWidth(node.button, targetButtonWidth);
    node.button.position.set(p.x, p.y);
    frame.addChild(node.button);
    if (node.playable) {
      playableStageRef = { x: p.x, y: p.y, buttonHeight: node.button.height };
    }

    if (node.numberSprite) {
      fitByWidth(node.numberSprite, STAGE_NUMBER_W);
      node.numberSprite.position.set(p.x, p.y + STAGE_NUMBER_Y_OFFSET);
      frame.addChild(node.numberSprite);
    }

    if (node.numberText) {
      node.numberText.position.set(p.x, p.y + STAGE_NUMBER_Y_OFFSET);
      frame.addChild(node.numberText);
    }
  }

  if (playableStageRef) {
    const characterBadge = createPlayableCharacterBadge(PIXI, textures, playableStageRef);
    frame.addChild(characterBadge);
  }

  const onResize = () => {
    layoutVirtualFrame(frame, app.renderer.width, app.renderer.height);
  };

  return {
    container,
    onEnter: () => onResize(),
    onExit: () => {},
    onResize,
  };
};

const createStageNode = (PIXI, textures, meta, onSelectStage) => {
  const buttonTexture = pickStageTexture(textures, meta.status);
  const button = new PIXI.Sprite(buttonTexture);
  button.anchor.set(0.5, 0.5);

  button.eventMode = 'static';
  button.cursor = meta.playable ? 'pointer' : 'default';
  button.alpha = meta.playable ? 1 : 0.94;

  if (meta.playable) {
    button.on('pointertap', () => onSelectStage?.(meta.id));
  }

  let numberSprite = null;
  let numberText = null;

  if (meta.id >= 1 && meta.id <= 9) {
    numberSprite = new PIXI.Sprite(textures[`num${meta.id}`]);
    numberSprite.anchor.set(0.5, 0.5);
  } else {
    numberText = new PIXI.Text(String(meta.id), {
      fontFamily: 'Avenir Next, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      fontWeight: '800',
      fontSize: 42,
      fill: 0xffffff,
      stroke: 0x111827,
      strokeThickness: 6,
    });
    numberText.anchor.set(0.5, 0.5);
  }

  return { id: meta.id, status: meta.status, playable: meta.playable, button, numberSprite, numberText };
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

const createPlayableCharacterBadge = (PIXI, textures, stageRef) => {
  const knight = new PIXI.Sprite(textures.lobbyCharacter);
  knight.anchor.set(0.5, 1);
  fitByHeight(knight, SELECT_CHARACTER_H);
  knight.position.set(
    stageRef.x + SELECT_CHARACTER_X_OFFSET,
    stageRef.y + SELECT_CHARACTER_STAND_OFFSET_Y
  );
  return knight;
};

const layoutVirtualFrame = (frame, screenW, screenH) => {
  const scale = Math.min(screenW / DESIGN_W, screenH / DESIGN_H);
  frame.scale.set(scale);
  frame.x = (screenW - DESIGN_W * scale) * 0.5;
  frame.y = 0;
};
