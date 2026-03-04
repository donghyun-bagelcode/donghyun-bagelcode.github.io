export const GRID_SIZE = 9;
export const TILE_SIZE = 64;
export const TILE_GAP = 8;
export const BOARD_PADDING = 20;
export const SLIDE_DURATION_MS = 260;

export const COLORS = {
  bg: 0xf0f2f5,
  floor: 0xdadfe5,
  wall: 0x3d4652,
  player: 0x2f80ed,
  key: 0xf2c94c,
  portalInactive: 0x9ca3af,
  portalActive: 0x27ae60,
};

export const ASSET_PATHS = {
  bg: './image/BG_3.png',
  tile: './image/tile.png',
  wall: './image/block.png',
  character: './image/character.png',
  key: './image/key.png',
  portalOff: './image/portal_off.png',
  portalOn: './image/portal_on.png',
};

export const STAGE_LAYOUT_W1_S1 = [
  '#########',
  '#..P....#',
  '#.###...#',
  '#..k.k..#',
  '#...S...#',
  '#.....#.#',
  '#...###.#',
  '#.......#',
  '#########',
];

const parseStageLayout = (rows) => {
  if (rows.length !== GRID_SIZE) {
    throw new Error(`스테이지 행 수가 GRID_SIZE(${GRID_SIZE})와 다릅니다.`);
  }

  const walls = [];
  const keys = [];
  let start = null;
  let portal = null;

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    if (row.length !== GRID_SIZE) {
      throw new Error(`스테이지 열 수가 GRID_SIZE(${GRID_SIZE})와 다릅니다. y=${y}`);
    }

    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x];
      if (ch === '#') {
        walls.push({ x, y });
      } else if (ch === 'k') {
        keys.push({ x, y });
      } else if (ch === 'S') {
        if (start) {
          throw new Error('시작 위치(S)는 1개여야 합니다.');
        }
        start = { x, y };
      } else if (ch === 'P') {
        if (portal) {
          throw new Error('포탈(P)은 1개여야 합니다.');
        }
        portal = { x, y };
      } else if (ch !== '.') {
        throw new Error(`알 수 없는 스테이지 문자: ${ch}`);
      }
    }
  }

  if (!start) {
    throw new Error('시작 위치(S)가 없습니다.');
  }
  if (!portal) {
    throw new Error('포탈(P)이 없습니다.');
  }
  if (keys.length < 1) {
    throw new Error(`키(k)는 최소 1개 이상이어야 합니다. 현재=${keys.length}`);
  }

  return { walls, keys, start, portal };
};

const stage = parseStageLayout(STAGE_LAYOUT_W1_S1);
export const MAP_WALLS = stage.walls;
export const KEY_CELLS = stage.keys;
export const PLAYER_START = stage.start;
export const PORTAL_CELL = stage.portal;

export const SWIPE_MIN_DISTANCE = 28;
