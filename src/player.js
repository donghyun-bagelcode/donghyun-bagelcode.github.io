import * as gameConfig from './config.js';
import { getPixi } from './pixi.js';

const PLAYER_MOVE_TUNING =
  gameConfig.PLAYER_MOVE_TUNING ?? {
    slideDurationMs: gameConfig.SLIDE_DURATION_MS ?? 260,
    characterScale: 1.28,
    characterBottomOffset: -0.04,
    characterXOffset: -0.05,
    characterZIndexBiasRatio: 0.5,
    walkFrameStartCol: 1,
    walkFrameCount: 3,
    walkCycleCount: 2,
  };
const SLIDE_DURATION_MS = PLAYER_MOVE_TUNING.slideDurationMs ?? gameConfig.SLIDE_DURATION_MS ?? 260;
const TILE_SIZE = gameConfig.TILE_SIZE ?? 64;
const CHARACTER_ANCHOR =
  gameConfig.CHARACTER_ANCHOR ?? {
    knight: { x: 0.5, y: 0.5 },
    thief: { x: 0.5, y: 0.5 },
    archer: { x: 0.5, y: 0.5 },
    magician: { x: 0.5, y: 0.5 },
  };

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const CHARACTER_SCALE = PLAYER_MOVE_TUNING.characterScale ?? 1.28;
const CHARACTER_BOTTOM_OFFSET = PLAYER_MOVE_TUNING.characterBottomOffset ?? -0.04;
const CHARACTER_X_OFFSET = PLAYER_MOVE_TUNING.characterXOffset ?? -0.05;
const CHARACTER_Z_INDEX_BIAS = TILE_SIZE * (PLAYER_MOVE_TUNING.characterZIndexBiasRatio ?? 0.5);
const SHEET_COLS = 4;
const SHEET_ROWS = 4;
const WALK_FRAME_START_COL = PLAYER_MOVE_TUNING.walkFrameStartCol ?? 1;
const WALK_FRAME_COUNT = PLAYER_MOVE_TUNING.walkFrameCount ?? 3;
const WALK_CYCLE_COUNT = PLAYER_MOVE_TUNING.walkCycleCount ?? 2;
const DIRECTION_ROWS = ['down', 'right', 'left', 'up'];

export class Player {
  constructor(board, startCell, textures, characterSheet, characterId = 'knight') {
    this.board = board;
    this.PIXI = getPixi();
    if (!this.PIXI) {
      throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
    }
    this.textures = textures;

    this.gridX = startCell.x;
    this.gridY = startCell.y;

    this.animating = false;
    this.fromPx = { x: 0, y: 0 };
    this.toPx = { x: 0, y: 0 };
    this.elapsedMs = 0;
    this.animationProgress = 0;
    this.facing = 'down';
    this.frames = this.buildAnimationFrames(characterSheet ?? this.textures.characterSheet);

    this.sprite = new this.PIXI.Sprite(this.frames.down[0]);
    const charAnchor = CHARACTER_ANCHOR[characterId] ?? { x: 0.5, y: 1 };
    this.sprite.anchor.set(charAnchor.x, charAnchor.y);
    this.applyObjectScale(this.sprite, CHARACTER_SCALE);
    this.board.objectLayer.addChild(this.sprite);

    this.setIdleFrame('down');
    this.syncSpriteToGrid();
  }

  syncSpriteToGrid() {
    const cell = this.board.toPixel(this.gridX, this.gridY);
    this.sprite.x = cell.x + TILE_SIZE * (0.5 + CHARACTER_X_OFFSET);
    this.sprite.y = cell.y + TILE_SIZE * (1 + CHARACTER_BOTTOM_OFFSET);
    this.sprite.zIndex = this.sprite.y + CHARACTER_Z_INDEX_BIAS;
  }

  isAnimating() {
    return this.animating;
  }

  getAnimationProgress() {
    return this.animationProgress;
  }

  getGridPosition() {
    return { x: this.gridX, y: this.gridY };
  }

  resetTo(startCell) {
    this.gridX = startCell.x;
    this.gridY = startCell.y;
    this.animating = false;
    this.elapsedMs = 0;
    this.animationProgress = 0;
    this.setIdleFrame('down');
    this.syncSpriteToGrid();
  }

  trySlide(direction, options = {}) {
    if (this.animating) {
      return { moved: false, reason: 'animating', path: [] };
    }

    const { dest, path } = this.findStopCell(direction.dx, direction.dy, options.stopAtCell, {
      keyCells: options.keyCells,
      keyGoal: options.keyGoal,
      collectedCount: options.collectedCount,
    });
    if (dest.x === this.gridX && dest.y === this.gridY) {
      return { moved: false, reason: 'blocked', path: [] };
    }
    this.facing = this.directionToFacing(direction.dx, direction.dy);
    this.setWalkFrame(0);

    this.fromPx = { x: this.sprite.x, y: this.sprite.y };
    const targetCellPx = this.board.toPixel(dest.x, dest.y);
    this.toPx = {
      x: targetCellPx.x + TILE_SIZE * (0.5 + CHARACTER_X_OFFSET),
      y: targetCellPx.y + TILE_SIZE * (1 + CHARACTER_BOTTOM_OFFSET),
    };

    this.gridX = dest.x;
    this.gridY = dest.y;

    this.elapsedMs = 0;
    this.animationProgress = 0;
    this.animating = true;
    return { moved: true, path, dest };
  }

  update(deltaMs) {
    if (!this.animating) {
      return;
    }

    this.elapsedMs += deltaMs;
    const normalized = Math.min(this.elapsedMs / SLIDE_DURATION_MS, 1);
    this.animationProgress = normalized;
    const eased = easeInOutCubic(normalized);

    this.sprite.x = this.fromPx.x + (this.toPx.x - this.fromPx.x) * eased;
    this.sprite.y = this.fromPx.y + (this.toPx.y - this.fromPx.y) * eased;
    this.sprite.zIndex = this.sprite.y + CHARACTER_Z_INDEX_BIAS;

    if (normalized >= 1) {
      this.animating = false;
      this.animationProgress = 1;
      this.setIdleFrame(this.facing);
      this.syncSpriteToGrid();
      return;
    }

    const walkStep = Math.floor(normalized * WALK_FRAME_COUNT * WALK_CYCLE_COUNT) % WALK_FRAME_COUNT;
    this.setWalkFrame(walkStep);
  }

  findStopCell(dx, dy, stopAtCell, options = {}) {
    let nextX = this.gridX;
    let nextY = this.gridY;
    const path = [];
    let simulatedCollected = options.collectedCount ?? 0;
    const keyGoal = options.keyGoal ?? 0;
    const keyCellSet = options.keyCells ?? null;

    while (true) {
      const candidateX = nextX + dx;
      const candidateY = nextY + dy;

      if (!this.board.isInside(candidateX, candidateY) || this.board.isWall(candidateX, candidateY)) {
        break;
      }

      const portalCell = this.board.portalCell;
      const isPortal = portalCell && candidateX === portalCell.x && candidateY === portalCell.y;
      if (isPortal && simulatedCollected < keyGoal) {
        break;
      }

      nextX = candidateX;
      nextY = candidateY;
      path.push({ x: nextX, y: nextY });

      if (keyCellSet) {
        const cellKey = `${nextX},${nextY}`;
        if (keyCellSet.has(cellKey)) {
          simulatedCollected += 1;
        }
      }

      if (stopAtCell && stopAtCell(nextX, nextY)) {
        break;
      }
    }

    return { dest: { x: nextX, y: nextY }, path };
  }

  applyObjectScale(sprite, scaleFactor) {
    const texW = sprite.texture.width || 1;
    const texH = sprite.texture.height || 1;
    const base = TILE_SIZE * scaleFactor;
    const fitScale = base / Math.max(texW, texH);
    sprite.width = texW * fitScale;
    sprite.height = texH * fitScale;
  }

  buildAnimationFrames(sheetTexture) {
    if (!sheetTexture) {
      throw new Error('characterSheet 텍스처를 찾지 못했습니다.');
    }

    const frameWidth = Math.floor(sheetTexture.width / SHEET_COLS);
    const frameHeight = Math.floor(sheetTexture.height / SHEET_ROWS);
    const frames = {};

    for (let row = 0; row < SHEET_ROWS; row += 1) {
      const direction = DIRECTION_ROWS[row];
      frames[direction] = [];
      for (let col = 0; col < SHEET_COLS; col += 1) {
        const rect = new this.PIXI.Rectangle(col * frameWidth, row * frameHeight, frameWidth, frameHeight);
        frames[direction].push(new this.PIXI.Texture(sheetTexture.baseTexture, rect));
      }
    }

    return frames;
  }

  directionToFacing(dx, dy) {
    if (dx > 0) {
      return 'right';
    }
    if (dx < 0) {
      return 'left';
    }
    if (dy < 0) {
      return 'up';
    }
    return 'down';
  }

  setIdleFrame(direction) {
    this.facing = direction;
    this.sprite.texture = this.frames[direction][0];
  }

  setWalkFrame(stepIndex) {
    const col = WALK_FRAME_START_COL + (stepIndex % WALK_FRAME_COUNT);
    this.sprite.texture = this.frames[this.facing][col];
  }
}
