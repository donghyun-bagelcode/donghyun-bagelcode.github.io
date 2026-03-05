import { getPixi } from './pixi.js';
import { clearProgress } from './save-data.js';

const DESIGN_W = 1080;
const DESIGN_H = 1920;

const TITLE_Y = 126;
const TITLE_W = 500;
const BANNER_W = 840;
const BANNER_FIRST_BOTTOM_Y = 520;
const BANNER_STACK_GAP = 28;

const SCROLL_VIEWPORT_TOP = 300;
const SCROLL_VIEWPORT_BOTTOM = 1830;
const DRAG_MIN_DISTANCE = 8;

const WORLD_META = [
  { id: 1, textureKey: 'world1', playable: true },
  { id: 2, textureKey: 'world2dim', playable: false },
  { id: 3, textureKey: 'world3dim', playable: false },
  { id: 4, textureKey: 'world4dim', playable: false },
  { id: 5, textureKey: 'world5dim', playable: false },
];

export const createWorldScene = ({ app, textures, onSelectWorld }) => {
  const PIXI = getPixi();
  if (!PIXI) {
    throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
  }

  const container = new PIXI.Container();
  container.visible = false;

  const frame = new PIXI.Container();
  container.addChild(frame);
  frame.eventMode = 'static';
  frame.hitArea = new PIXI.Rectangle(0, 0, DESIGN_W, DESIGN_H);

  const dragState = {
    active: false,
    moved: false,
    startY: 0,
    lastY: 0,
  };

  const bg = new PIXI.Sprite(textures.worldBg);
  bg.position.set(0, 0);
  bg.width = DESIGN_W;
  bg.height = DESIGN_H;
  frame.addChild(bg);

  const title = new PIXI.Sprite(textures.worldTitle);
  title.anchor.set(0.5, 0);
  fitByWidth(title, TITLE_W);
  title.position.set(DESIGN_W * 0.5, TITLE_Y);
  title.eventMode = 'static';
  title.cursor = 'pointer';
  title.on('pointertap', () => {
    if (dragState.moved) {
      return;
    }
    clearProgress();
    location.reload();
  });
  frame.addChild(title);

  const list = new PIXI.Container();
  frame.addChild(list);

  let prevBottomY = null;
  const banners = WORLD_META.map((meta, index) => {
    const sprite = new PIXI.Sprite(textures[meta.textureKey]);
    sprite.anchor.set(0.5, 1);
    fitByWidth(sprite, BANNER_W);
    const bottomY = index === 0 ? BANNER_FIRST_BOTTOM_Y : prevBottomY + BANNER_STACK_GAP + sprite.height;
    sprite.position.set(DESIGN_W * 0.5, bottomY);
    prevBottomY = sprite.y;
    sprite.eventMode = 'static';
    sprite.cursor = meta.playable ? 'pointer' : 'default';
    if (meta.playable) {
      sprite.on('pointertap', () => {
        if (!dragState.moved) {
          onSelectWorld?.(meta.id);
        }
      });
    }
    list.addChild(sprite);
    return sprite;
  });

  const bounds = {
    minY: 0,
    maxY: 0,
  };

  const recalcScrollBounds = () => {
    if (banners.length === 0) {
      bounds.minY = 0;
      bounds.maxY = 0;
      list.y = 0;
      return;
    }

    const first = banners[0];
    const last = banners[banners.length - 1];
    const firstTop = first.y - first.height;
    const lastBottom = last.y;
    const contentHeight = lastBottom - firstTop;
    const viewportHeight = SCROLL_VIEWPORT_BOTTOM - SCROLL_VIEWPORT_TOP;

    if (contentHeight <= viewportHeight) {
      bounds.minY = 0;
      bounds.maxY = 0;
      list.y = 0;
      return;
    }

    bounds.maxY = SCROLL_VIEWPORT_TOP - firstTop;
    bounds.minY = SCROLL_VIEWPORT_BOTTOM - lastBottom;
    list.y = clamp(list.y, bounds.minY, bounds.maxY);
  };

  const onPointerDown = (event) => {
    const point = event.global;
    const local = frame.toLocal(point);
    dragState.active = true;
    dragState.moved = false;
    dragState.startY = local.y;
    dragState.lastY = local.y;
  };

  const onPointerMove = (event) => {
    if (!dragState.active) {
      return;
    }
    const point = event.global;
    const local = frame.toLocal(point);
    const dy = local.y - dragState.lastY;
    dragState.lastY = local.y;

    if (Math.abs(local.y - dragState.startY) > DRAG_MIN_DISTANCE) {
      dragState.moved = true;
    }

    if (bounds.minY !== bounds.maxY) {
      list.y = clamp(list.y + dy, bounds.minY, bounds.maxY);
    }
  };

  const onPointerUp = () => {
    dragState.active = false;
  };

  frame.on('pointerdown', onPointerDown);
  frame.on('pointermove', onPointerMove);
  frame.on('pointerup', onPointerUp);
  frame.on('pointerupoutside', onPointerUp);
  frame.on('pointercancel', onPointerUp);

  const onResize = () => {
    layoutVirtualFrame(frame, app.renderer.width, app.renderer.height);
  };

  return {
    container,
    onEnter: () => {
      recalcScrollBounds();
      onResize();
    },
    onExit: () => {
      dragState.active = false;
      dragState.moved = false;
    },
    onResize: () => {
      recalcScrollBounds();
      onResize();
    },
  };
};

const fitByWidth = (sprite, targetWidth) => {
  const ratio = sprite.texture.height / sprite.texture.width;
  sprite.width = targetWidth;
  sprite.height = targetWidth * ratio;
};

const layoutVirtualFrame = (frame, screenW, screenH) => {
  const scale = Math.min(screenW / DESIGN_W, screenH / DESIGN_H);
  frame.scale.set(scale);
  frame.x = (screenW - DESIGN_W * scale) * 0.5;
  frame.y = 0;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
