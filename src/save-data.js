import { STAGE_COUNT, STAGE_COUNT_HARD } from './config.js';

const SAVE_KEY = 'keyroute-save';
const DEFAULT_CHARACTER_ID = 'knight';
const VALID_CHARACTER_IDS = new Set(['knight', 'thief', 'archer', 'magician']);

const createDefaultProgress = () => ({ basic: {}, hard: {}, selectedCharacterId: DEFAULT_CHARACTER_ID });

const clampStars = (stars) => Math.max(0, Math.min(3, Math.floor(Number(stars) || 0)));
const normalizeCharacterId = (characterId) =>
  typeof characterId === 'string' && VALID_CHARACTER_IDS.has(characterId) ? characterId : DEFAULT_CHARACTER_ID;

const getStageCountByMode = (mode) => (mode === 'hard' ? STAGE_COUNT_HARD : STAGE_COUNT);
const normalizeMode = (mode) => (mode === 'hard' ? 'hard' : 'basic');
const normalizeStageId = (stageId, mode = 'basic') =>
  Math.max(1, Math.min(getStageCountByMode(mode), Math.floor(Number(stageId) || 1)));

const saveProgress = (progress) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {
    // 저장 실패(프라이빗 모드/스토리지 제한 등) 시 무시하고 호출자 흐름을 유지한다.
  }
};

export const loadProgress = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return createDefaultProgress();
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultProgress();
    }

    const migrated = { ...parsed };
    if (migrated.stages && typeof migrated.stages === 'object' && (!migrated.basic || typeof migrated.basic !== 'object')) {
      migrated.basic = migrated.stages;
    }

    const basicSource = migrated.basic && typeof migrated.basic === 'object' ? migrated.basic : {};
    const hardSource = migrated.hard && typeof migrated.hard === 'object' ? migrated.hard : {};

    const normalizedBasic = {};
    for (let id = 1; id <= STAGE_COUNT; id += 1) {
      const key = String(id);
      if (basicSource[key] == null) continue;
      normalizedBasic[key] = clampStars(basicSource[key]);
    }

    const normalizedHard = {};
    for (let id = 1; id <= STAGE_COUNT_HARD; id += 1) {
      const key = String(id);
      if (hardSource[key] == null) continue;
      normalizedHard[key] = clampStars(hardSource[key]);
    }

    return {
      basic: normalizedBasic,
      hard: normalizedHard,
      selectedCharacterId: normalizeCharacterId(migrated.selectedCharacterId),
    };
  } catch {
    return createDefaultProgress();
  }
};

export const saveStageResult = (stageId, stars, mode = 'basic') => {
  const progress = loadProgress();
  const targetMode = normalizeMode(mode);
  const normalizedId = String(normalizeStageId(stageId, targetMode));
  const nextStars = clampStars(stars);
  const prevStars = clampStars(progress[targetMode][normalizedId]);

  if (nextStars > prevStars) {
    progress[targetMode][normalizedId] = nextStars;
    saveProgress(progress);
  }

  return progress;
};

export const getUnlockedStageId = (mode = 'basic') => {
  const targetMode = normalizeMode(mode);
  const maxStage = getStageCountByMode(targetMode);
  const progress = loadProgress();
  for (let id = 1; id <= maxStage; id += 1) {
    const stars = clampStars(progress[targetMode][String(id)]);
    if (stars <= 0) {
      return id;
    }
  }
  return maxStage;
};

export const getTotalStars = (mode = 'basic') => {
  const targetMode = normalizeMode(mode);
  const maxStage = getStageCountByMode(targetMode);
  const progress = loadProgress();
  let total = 0;
  for (let id = 1; id <= maxStage; id += 1) {
    total += clampStars(progress[targetMode][String(id)]);
  }
  return total;
};

export const clearProgress = () => {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // 스토리지 접근 실패 시에도 흐름을 유지한다.
  }
};

export const loadSelectedCharacter = () => {
  const progress = loadProgress();
  return normalizeCharacterId(progress.selectedCharacterId);
};

export const saveSelectedCharacter = (characterId) => {
  const progress = loadProgress();
  const normalized = normalizeCharacterId(characterId);
  progress.selectedCharacterId = normalized;
  saveProgress(progress);
  return normalized;
};
