import { STAGE_COUNT } from './config.js';

const SAVE_KEY = 'keyroute-save';

const createDefaultProgress = () => ({ stages: {} });

const clampStars = (stars) => Math.max(0, Math.min(3, Math.floor(Number(stars) || 0)));

const normalizeStageId = (stageId) => Math.max(1, Math.min(STAGE_COUNT, Math.floor(Number(stageId) || 1)));

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

    const stages = parsed.stages;
    if (!stages || typeof stages !== 'object') {
      return createDefaultProgress();
    }

    const normalizedStages = {};
    for (let id = 1; id <= STAGE_COUNT; id += 1) {
      const key = String(id);
      if (stages[key] == null) {
        continue;
      }
      normalizedStages[key] = clampStars(stages[key]);
    }

    return { stages: normalizedStages };
  } catch {
    return createDefaultProgress();
  }
};

export const saveStageResult = (stageId, stars) => {
  const progress = loadProgress();
  const normalizedId = String(normalizeStageId(stageId));
  const nextStars = clampStars(stars);
  const prevStars = clampStars(progress.stages[normalizedId]);

  if (nextStars > prevStars) {
    progress.stages[normalizedId] = nextStars;
    saveProgress(progress);
  }

  return progress;
};

export const getUnlockedStageId = () => {
  const progress = loadProgress();
  for (let id = 1; id <= STAGE_COUNT; id += 1) {
    const stars = clampStars(progress.stages[String(id)]);
    if (stars <= 0) {
      return id;
    }
  }
  return STAGE_COUNT;
};

export const getTotalStars = () => {
  const progress = loadProgress();
  let total = 0;
  for (let id = 1; id <= STAGE_COUNT; id += 1) {
    total += clampStars(progress.stages[String(id)]);
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
