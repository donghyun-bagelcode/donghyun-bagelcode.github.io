export const GRID_COLS = 7;
export const GRID_ROWS = 10;
export const TILE_SIZE = 64;
export const TILE_GAP = 0;
export const BOARD_PADDING = 0;
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
  bg: './image/ingame/BG_3.png',
  tile: './image/ingame/tile.png',
  wall: './image/ingame/block.png',
  characterSheet: './image/ingame/character-knight.png',
  charSheetKnight: './image/charactor/character-knight.png',
  charSheetArcher: './image/charactor/character-archer.png',
  charSheetMagician: './image/charactor/character-magician.png',
  charSheetThief: './image/charactor/character-thief.png',
  key: './image/ingame/key.png',
  portalOff: './image/ingame/portal_off.png',
  portalOn: './image/ingame/portal_on.png',
  moveBoard: './image/ingame/move board.png',
  moveLabel: './image/ingame/MOVE.png',
  key0Label: './image/ingame/Key_0.png',
  key1Label: './image/ingame/Key_1.png',
  key2Label: './image/ingame/Key_2.png',
  key3Label: './image/ingame/Key_3.png',
  keySlash: './image/ingame/key_slash.png',
  hudNum0: './image/common/num_0.png',
  hudNum1: './image/common/num_1.png',
  hudNum2: './image/common/num_2.png',
  hudNum3: './image/common/num_3.png',
  hudNum4: './image/common/num_4.png',
  hudNum5: './image/common/num_5.png',
  hudNum6: './image/common/num_6.png',
  hudNum7: './image/common/num_7.png',
  hudNum8: './image/common/num_8.png',
  hudNum9: './image/common/num_9.png',
  commonBack: './image/common/back.png',
};

export const OBJECT_SCALE = {
  character: 1.28,
  key: 1.18,
  portal: 1.36,
};

export const STAGES = [
  {
    id: 1,
    minMoves: 5,
    layout: [
      '#######',
      '##.P###',
      '##...##',
      '##.k.##',
      '##...##',
      '##.S.##',
      '##.k.##',
      '##k..##',
      '##...##',
      '#######',
    ],
  },
  {
    id: 2,
    minMoves: 5,
    layout: [
      '#######',
      '##..P##',
      '##.k.##',
      '##...##',
      '##.k###',
      '##.S.##',
      '##...##',
      '##k..##',
      '##...##',
      '#######',
    ],
  },
  {
    id: 3,
    minMoves: 5,
    layout: [
      '#######',
      '##..P##',
      '##k..##',
      '##...##',
      '##.#.##',
      '##.S.##',
      '##...##',
      '##..k##',
      '##k..##',
      '#######',
    ],
  },
  {
    id: 4,
    minMoves: 6,
    layout: [
      '#######',
      '##P..##',
      '##.#.##',
      '##k..##',
      '##...##',
      '##.S###',
      '##..k##',
      '##...##',
      '##k..##',
      '#######',
    ],
  },
  {
    id: 5,
    minMoves: 10,
    layout: [
      '#######',
      '#kPk..#',
      '#.....#',
      '##...##',
      '#....##',
      '#k.S..#',
      '##.#..#',
      '#.....#',
      '#..##.#',
      '#######',
    ],
  },
  {
    id: 6,
    minMoves: 10,
    layout: [
      '#######',
      '#..P.k#',
      '#...k##',
      '#.....#',
      '#....k#',
      '#..S###',
      '#....##',
      '#.....#',
      '#..####',
      '#######',
    ],
  },
  {
    id: 7,
    minMoves: 10,
    layout: [
      '#######',
      '##.#P.#',
      '##....#',
      '#....##',
      '#..#..#',
      '#.kS.k#',
      '#.k..##',
      '#.....#',
      '###...#',
      '#######',
    ],
  },
  {
    id: 8,
    minMoves: 17,
    layout: [
      '#######',
      '#.#..P#',
      '#...###',
      '#k....#',
      '#.....#',
      '##.S..#',
      '##...##',
      '#.....#',
      '#k##k.#',
      '#######',
    ],
  },
  {
    id: 9,
    minMoves: 16,
    layout: [
      '#######',
      '#P.##.#',
      '##...k#',
      '#..#..#',
      '#k....#',
      '##.S.##',
      '#..#.##',
      '#....k#',
      '##..#.#',
      '#######',
    ],
  },
  {
    id: 10,
    minMoves: 7,
    layout: [
      '#######',
      '##P..##',
      '##.#..#',
      '#k...k#',
      '##.k.##',
      '#..S..#',
      '#....##',
      '###...#',
      '#.#...#',
      '#######',
    ],
  },
];

const HARD_MIN_MOVES_BY_ID = {
  1: 16,
  2: 21,
  3: 16,
  4: 14,
  5: 7,
  6: 16,
  7: 12,
  8: 10,
  9: 11,
  10: 17,
};

export const STAGES_HARD = STAGES.map((stage) => ({
  id: stage.id,
  minMoves: HARD_MIN_MOVES_BY_ID[stage.id] ?? stage.minMoves,
  layout: [...stage.layout],
}));

const parseStageLayout = (rows) => {
  if (rows.length !== GRID_ROWS) {
    throw new Error(`스테이지 행 수가 GRID_ROWS(${GRID_ROWS})와 다릅니다.`);
  }

  const walls = [];
  const keys = [];
  let start = null;
  let portal = null;

  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    if (row.length !== GRID_COLS) {
      throw new Error(`스테이지 열 수가 GRID_COLS(${GRID_COLS})와 다릅니다. y=${y}`);
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

export const getStage = (stageId, mode = 'basic') => {
  const source = mode === 'hard' ? STAGES_HARD : STAGES;
  const stage = source.find((item) => item.id === stageId);
  if (!stage) {
    throw new Error(`스테이지 ${stageId}를 찾지 못했습니다. mode=${mode}`);
  }
  const parsed = parseStageLayout(stage.layout);
  return { ...parsed, minMoves: stage.minMoves };
};

export const STAGE_COUNT = STAGES.length;
export const STAGE_COUNT_HARD = STAGES_HARD.length;

export const SWIPE_MIN_DISTANCE = 28;
