import { BOARD_PADDING, GRID_COLS, GRID_ROWS, TILE_GAP, TILE_SIZE, TRAIL_TUNING } from './config.js';
import { getPixi } from './pixi.js';

const BOARD_SCALE_RATIO = 1.15;
const BOARD_Y_RATIO = 0.05;

const wallKey = (x, y) => `${x},${y}`;
const KEY_OBJECT_SCALE = 1;
const BLOCK_OBJECT_SCALE = {
  x: 1,
  y: 1.1,
};
const OBJECT_SCALE = {
  portal: 1.66,
};
const OBJECT_OFFSET = {
  keyBottom: -0.08,
};
const OBJECT_Z_ORDER_BIAS = {
  portal: 2,
};
const TRAIL_ALPHA = TRAIL_TUNING?.alpha ?? 0.5;
const TRAIL_FADE_DURATION = TRAIL_TUNING?.fadeDurationMs ?? 400;
const TRAIL_STAGGER_MS = TRAIL_TUNING?.staggerMs ?? 60;

export class Board {
  constructor(stage, walls, keyCells, portalCell, textures) {
    this.stage = stage;
    this.PIXI = getPixi();
    if (!this.PIXI) {
      throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
    }
    this.textures = textures;
    this.walls = new Set(walls.map((cell) => wallKey(cell.x, cell.y)));
    this.keyCellsInitial = keyCells.map((cell) => ({ ...cell }));
    this.keyCells = new Set(keyCells.map((cell) => wallKey(cell.x, cell.y)));
    this.portalCell = { ...portalCell };
    this.portalActive = false;

    this.container = new this.PIXI.Container();
    this.stage.addChild(this.container);
    this.trailLayer = new this.PIXI.Container();
    this.objectLayer = new this.PIXI.Container();
    this.objectLayer.sortableChildren = true;
    this.portalSprite = null;
    this.trailOverlays = new Set();

    this.gridPixelWidth = GRID_COLS * TILE_SIZE + (GRID_COLS - 1) * TILE_GAP;
    this.gridPixelHeight = GRID_ROWS * TILE_SIZE + (GRID_ROWS - 1) * TILE_GAP;
    this.boardPixelWidth = this.gridPixelWidth + BOARD_PADDING * 2;
    this.boardPixelHeight = this.gridPixelHeight + BOARD_PADDING * 2;

    this.draw();
  }

  layout(viewWidth, viewHeight) {
    const scaleX = (viewWidth * BOARD_SCALE_RATIO) / this.boardPixelWidth;
    const scaleY = (viewHeight * BOARD_SCALE_RATIO) / this.boardPixelHeight;
    const boardScale = Math.min(scaleX, scaleY);

    this.container.scale.set(boardScale);
    this.container.x = Math.floor((viewWidth - this.boardPixelWidth * boardScale) * 0.5);
    this.container.y = Math.floor(viewHeight * BOARD_Y_RATIO);
  }

  layoutInRect(rect) {
    const scaleX = (rect.width * BOARD_SCALE_RATIO) / this.boardPixelWidth;
    const scaleY = (rect.height * BOARD_SCALE_RATIO) / this.boardPixelHeight;
    const boardScale = Math.min(scaleX, scaleY);

    this.container.scale.set(boardScale);
    this.container.x = Math.floor(rect.x + (rect.width - this.boardPixelWidth * boardScale) * 0.5);
    this.container.y = Math.floor(rect.y + rect.height * BOARD_Y_RATIO);
  }

  draw() {
    for (let y = 0; y < GRID_ROWS; y += 1) {
      for (let x = 0; x < GRID_COLS; x += 1) {
        const isOuter =
          y === 0 || y === GRID_ROWS - 1 || x === 0 || x === GRID_COLS - 1;
        if (isOuter) {
          continue;
        }

        const tile = new this.PIXI.Sprite(this.textures.tile);
        tile.width = TILE_SIZE;
        tile.height = TILE_SIZE;

        const world = this.toPixel(x, y);
        tile.x = world.x;
        tile.y = world.y;

        this.container.addChild(tile);

        if (this.isWall(x, y)) {
          const wall = new this.PIXI.Sprite(this.textures.wall);
          wall.anchor.set(0.5, 0.5);
          wall.width = TILE_SIZE * BLOCK_OBJECT_SCALE.x;
          wall.height = TILE_SIZE * BLOCK_OBJECT_SCALE.y;
          wall.x = world.x + TILE_SIZE * 0.5;
          wall.y = world.y + TILE_SIZE * 0.5;
          wall.zIndex = wall.y + wall.height * 0.5;
          this.objectLayer.addChild(wall);
        }
      }
    }

    this.container.addChild(this.trailLayer);
    this.container.addChild(this.objectLayer);
    this.renderObjects();
  }

  renderObjects() {
    this.clearBoardObjects();
    this.renderPortal();
    this.renderKeys();
  }

  renderKeys() {
    for (const key of this.keyCells) {
      const [x, y] = key.split(',').map(Number);
      const keyGraphic = this.createObjectSprite(this.textures.key, KEY_OBJECT_SCALE);
      keyGraphic.anchor.set(0.5, 1);
      const pos = this.toPixel(x, y);
      keyGraphic.x = pos.x + TILE_SIZE * 0.5;
      keyGraphic.y = pos.y + TILE_SIZE * (1 + OBJECT_OFFSET.keyBottom);
      keyGraphic.zIndex = keyGraphic.y;
      keyGraphic.boardObject = true;
      this.objectLayer.addChild(keyGraphic);
    }
  }

  renderPortal() {
    const portal = this.createObjectSprite(
      this.portalActive ? this.textures.portalOn : this.textures.portalOff,
      OBJECT_SCALE.portal
    );
    const pos = this.toPixel(this.portalCell.x, this.portalCell.y);
    portal.x = pos.x + TILE_SIZE * 0.5;
    portal.y = pos.y + TILE_SIZE * 0.5;
    // 포탈은 중심이 아닌 하단 기준으로 정렬하고, 동률일 때 다른 오브젝트보다 위에 오르게 한다.
    portal.zIndex = portal.y + portal.height * 0.5 + OBJECT_Z_ORDER_BIAS.portal;
    portal.boardObject = true;
    this.objectLayer.addChild(portal);
    this.portalSprite = portal;
  }

  isWall(x, y) {
    return this.walls.has(wallKey(x, y));
  }

  isInside(x, y) {
    return x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS;
  }

  canStand(x, y) {
    if (!this.isInside(x, y) || this.isWall(x, y)) {
      return false;
    }
    if (!this.portalActive && x === this.portalCell.x && y === this.portalCell.y) {
      return false;
    }
    return true;
  }

  collectKeysOnPath(pathCells) {
    let collected = 0;
    for (const cell of pathCells) {
      const key = wallKey(cell.x, cell.y);
      if (this.keyCells.has(key)) {
        this.keyCells.delete(key);
        collected += 1;
      }
    }
    if (collected > 0) {
      this.renderObjects();
    }
    return collected;
  }

  getKeyCellSet() {
    return new Set(this.keyCells);
  }

  setPortalActive(active) {
    this.portalActive = active;
    if (this.portalSprite) {
      this.portalSprite.texture = this.portalActive ? this.textures.portalOn : this.textures.portalOff;
      return;
    }
    this.renderObjects();
  }

  isPortalOnPath(pathCells) {
    return pathCells.some((cell) => cell.x === this.portalCell.x && cell.y === this.portalCell.y);
  }

  playTrail(pathCells, tweenManager) {
    if (!pathCells || pathCells.length === 0 || !this.textures.trailTile || !tweenManager) {
      return;
    }

    for (let i = 0; i < pathCells.length; i += 1) {
      const cell = pathCells[i];
      const pos = this.toPixel(cell.x, cell.y);
      const overlay = new this.PIXI.Sprite(this.textures.trailTile);
      overlay.width = TILE_SIZE;
      overlay.height = TILE_SIZE;
      overlay.x = pos.x;
      overlay.y = pos.y;
      overlay.alpha = TRAIL_ALPHA;
      this.trailLayer.addChild(overlay);
      this.trailOverlays.add(overlay);

      const fadeDelay = i * TRAIL_STAGGER_MS;
      tweenManager.to(overlay, { alpha: 0 }, TRAIL_FADE_DURATION, {
        delay: fadeDelay,
        onComplete: () => {
          if (overlay.parent) {
            overlay.parent.removeChild(overlay);
          }
          overlay.destroy();
          this.trailOverlays.delete(overlay);
        },
      });
    }
  }

  clearTrailOverlays(tweenManager = null) {
    for (const overlay of this.trailOverlays) {
      if (tweenManager) {
        tweenManager.cancelAll(overlay);
      }
      if (overlay.parent) {
        overlay.parent.removeChild(overlay);
      }
      overlay.destroy();
    }
    this.trailOverlays.clear();
  }

  resetObjects(tweenManager = null) {
    this.clearTrailOverlays(tweenManager);
    this.keyCells = new Set(this.keyCellsInitial.map((cell) => wallKey(cell.x, cell.y)));
    this.portalActive = false;
    this.renderObjects();
  }

  clearBoardObjects() {
    for (let i = this.objectLayer.children.length - 1; i >= 0; i -= 1) {
      const child = this.objectLayer.children[i];
      if (child.boardObject) {
        this.objectLayer.removeChildAt(i);
      }
    }
  }

  toPixel(gridX, gridY) {
    return {
      x: BOARD_PADDING + gridX * (TILE_SIZE + TILE_GAP),
      y: BOARD_PADDING + gridY * (TILE_SIZE + TILE_GAP),
    };
  }

  createObjectSprite(texture, scaleFactor) {
    const sprite = new this.PIXI.Sprite(texture);
    sprite.anchor.set(0.5);

    const base = TILE_SIZE * scaleFactor;
    const texW = texture.width || 1;
    const texH = texture.height || 1;
    const fitScale = base / Math.max(texW, texH);
    sprite.width = texW * fitScale;
    sprite.height = texH * fitScale;

    return sprite;
  }
}
