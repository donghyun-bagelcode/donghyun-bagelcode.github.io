import { ASSET_PATHS } from './config.js';
import { AudioManager } from './audio.js';
import { createGameScene } from './game.js';
import { createLobbyScene } from './lobby.js';
import * as saveData from './save-data.js';
import { createSplashScene } from './splash.js';
import { createWorldScene } from './world.js';
import { getPixi, waitForPixi } from './pixi.js';
import { SceneManager } from './scene-manager.js';

const loadProgress = saveData.loadProgress ?? (() => ({ basic: {}, hard: {} }));
const getUnlockedStageId = saveData.getUnlockedStageId ?? (() => 1);
const getTotalStars = saveData.getTotalStars ?? (() => 0);
const saveStageResult = saveData.saveStageResult ?? (() => ({}));
const loadSelectedCharacter = saveData.loadSelectedCharacter ?? (() => 'knight');
const saveSelectedCharacter =
  saveData.saveSelectedCharacter ?? ((characterId) => (typeof characterId === 'string' ? characterId : 'knight'));

const LOBBY_ASSET_PATHS = {
  lobbyBg: './image/lobby/bg.png',
  stageYellow: './image/lobby/stage_yellow.png',
  stageBlue: './image/lobby/stage_blue.png',
  stageRed: './image/lobby/stage_red.png',
  stageCurrent: './image/lobby/stage_1.png',
  worldText: './image/lobby/world-text.png',
  num0: './image/lobby/num_0.png',
  num1: './image/lobby/num_1.png',
  num2: './image/lobby/num_2.png',
  num3: './image/lobby/num_3.png',
  num4: './image/lobby/num_4.png',
  num5: './image/lobby/num_5.png',
  num6: './image/lobby/num_6.png',
  num7: './image/lobby/num_7.png',
  num8: './image/lobby/num_8.png',
  num9: './image/lobby/num_9.png',
  slash: './image/lobby/slash.png',
  starCollect: './image/lobby/star-collect.png',
  star: './image/lobby/star.png',
  back: './image/lobby/back.png',
  home: './image/lobby/home.png',
  pageButton: './image/lobby/page-button.png',
  lobbyComingSoon: './image/lobby/page-comming-soon.png',
  lobbyCharacter: './image/lobby/character.png',
  profileFrame1: './image/lobby/select_character_1.png',
  profileFrame2: './image/lobby/select_character_2.png',
};

const LOBBY_HARD_ASSET_PATHS = {
  lobbyHardBg: './image/lobby-hard/BG_hardmode.png',
  lobbyHardTitle: './image/lobby-hard/txt_world 1 hard.png',
};

const WORLD_ASSET_PATHS = {
  worldBg: './image/world/World-select_BG.png',
  worldTitle: './image/world/World select.png',
  world1: './image/world/1.png',
  world2dim: './image/world/2_dim.png',
  world3dim: './image/world/3_dim.png',
  world4dim: './image/world/4_dim.png',
  world5dim: './image/world/5_dim.png',
};

const SPLASH_ASSET_PATHS = {
  splashBg: './image/splash/Splash_BG.png',
  splashTitle: './image/splash/Splash_title.png',
  splashLight1: './image/splash/light_1_title.png',
  splashLight2: './image/splash/light_2_sword.png',
  splashBar: './image/splash/loading bar.png',
  splashGage: './image/splash/loading bar gauge.png',
  splashLoadingText: './image/splash/loading.png',
  splashDot: './image/splash/loading_dot.png',
  splashTouchToStart: './image/splash/touch_to_start.png',
};

const POPUP_ASSET_PATHS = {
  popupBg: './image/popup/bg.png',
  popupComplete: './image/popup/complete.png',
  popupStage: './image/popup/stage_.png',
  popupStar: './image/popup/star.png',
  popupStarEmpty: './image/popup/star_empty.png',
  popupReplay: './image/popup/btn replay.png',
  popupNext: './image/popup/btn next.png',
  popupExit: './image/popup/btn_exit.png',
  popupNum0: './image/popup/num_0.png',
  popupNum1: './image/popup/num_1.png',
  popupNum2: './image/popup/num_2.png',
  popupNum3: './image/popup/num_3.png',
  popupNum4: './image/popup/num_4.png',
  popupNum5: './image/popup/num_5.png',
  popupNum6: './image/popup/num_6.png',
  popupNum7: './image/popup/num_7.png',
  popupNum8: './image/popup/num_8.png',
  popupNum9: './image/popup/num_9.png',
};

const CHARACTER_POPUP_ASSET_PATHS = {
  charPopBg: './image/lobby-popup/BG_pop.png',
  charPopTitle: './image/lobby-popup/Choose your character.png',
  charPopClose: './image/lobby-popup/Btn-X.png',
  charPopOk: './image/lobby-popup/btn_ok.png',
  charPopSlotRed: './image/lobby-popup/character select_red.png',
  charPopSlotYellow: './image/lobby-popup/character select_yellow.png',
  charPopStar: './image/lobby-popup/character rank_star.png',
  charPopKnight: './image/lobby-popup/knight.png',
  charPopArcher: './image/lobby-popup/archer.png',
  charPopMagician: './image/lobby-popup/magician.png',
  charPopThief: './image/lobby-popup/thief.png',
  charPopLocked1: './image/lobby-popup/character select_1.png',
  charPopLocked2: './image/lobby-popup/character select_2.png',
  charPopLocked3: './image/lobby-popup/character select_3.png',
  charPopLocked4: './image/lobby-popup/character select_4.png',
  charPopLocked5: './image/lobby-popup/character select_5.png',
};

const INGAME_FX_ASSET_PATHS = {
  trailTile: './image/ingame/character-move-color-tile.png',
};

const bootstrap = async () => {
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('app container(#app)을 찾지 못했습니다.');
  }

  AudioManager.installUnlockOnFirstGesture();
  AudioManager.installDebugHotkey('F8');
  AudioManager.setDebugVisible(false);

  const app = await createPixiApp(root);
  root.appendChild(app.canvas ?? app.view);

  const textures = await loadTextures({
    ...ASSET_PATHS,
    ...INGAME_FX_ASSET_PATHS,
    ...LOBBY_ASSET_PATHS,
    ...LOBBY_HARD_ASSET_PATHS,
    ...WORLD_ASSET_PATHS,
    ...SPLASH_ASSET_PATHS,
    ...POPUP_ASSET_PATHS,
    ...CHARACTER_POPUP_ASSET_PATHS,
  });

  const sceneManager = new SceneManager(app.stage);
  let selectedCharacterId = loadSelectedCharacter();

  const splashScene = createSplashScene({
    app,
    textures,
    onComplete: () => sceneManager.switchScene('world'),
  });

  const worldScene = createWorldScene({
    app,
    textures,
    onSelectWorld: () => sceneManager.switchScene('lobby'),
  });

  const gameScene = createGameScene({
    app,
    root,
    textures,
    getCharacterId: () => selectedCharacterId,
    getCharacterSheet: () => {
      const sheetMap = {
        knight: textures.charSheetKnight,
        archer: textures.charSheetArcher,
        magician: textures.charSheetMagician,
        thief: textures.charSheetThief,
      };
      return sheetMap[selectedCharacterId] ?? textures.charSheetKnight;
    },
    onGoLobby: () => sceneManager.switchScene('lobby'),
    onStageClear: (stageId, stars, mode) => {
      saveStageResult(stageId, stars, mode ?? 'basic');
    },
  });

  const lobbyScene = createLobbyScene({
    app,
    textures,
    getProgress: (mode) => {
      const targetMode = mode ?? 'basic';
      const progressByMode = loadProgress();
      return {
        progress: { stages: progressByMode[targetMode] ?? {} },
        unlockedStageId: getUnlockedStageId(targetMode),
        totalStars: getTotalStars(targetMode),
      };
    },
    onCharacterSelect: (id) => {
      selectedCharacterId = saveSelectedCharacter(id);
    },
    getSelectedCharacter: () => selectedCharacterId,
    onGoWorld: () => sceneManager.switchScene('world'),
    onSelectStage: (stageId, mode) => {
      sceneManager.switchScene('game', { stageId, mode: mode ?? 'basic' });
    },
  });

  sceneManager.register('splash', splashScene);
  sceneManager.register('world', worldScene);
  sceneManager.register('lobby', lobbyScene);
  sceneManager.register('game', gameScene);

  window.addEventListener('resize', () => sceneManager.resize());

  sceneManager.switchScene('splash');
};

const createPixiApp = async (root) => {
  const PIXI = await waitForPixi(3000);
  if (!PIXI) {
    throw new Error('PixiJS 로딩 실패: 네트워크 또는 CDN 접근 상태를 확인하세요.');
  }

  const options = {
    backgroundColor: 0x1a0a2e,
    resizeTo: root,
    antialias: true,
  };

  const app = new PIXI.Application(options);
  if (typeof app.init === 'function') {
    await app.init({
      background: 0x1a0a2e,
      resizeTo: root,
      antialias: true,
    });
  }

  return app;
};

const loadTextures = async (assetPaths) => {
  const PIXI = getPixi();
  if (!PIXI) {
    throw new Error('PixiJS 인스턴스를 찾지 못했습니다.');
  }

  const aliases = Object.keys(assetPaths);
  try {
    for (const alias of aliases) {
      if (!PIXI.Assets.get(alias)) {
        PIXI.Assets.add({ alias, src: assetPaths[alias] });
      }
    }
    await PIXI.Assets.load(aliases);
  } catch {
    await Promise.all(
      aliases.map(async (alias) => {
        const texture = await loadTextureWithFallback(PIXI, assetPaths[alias]);
        if (!PIXI.Assets.get(alias)) {
          PIXI.Assets.add({ alias, src: assetPaths[alias] });
        }
        PIXI.Assets.cache.set(alias, texture);
      })
    );
  }

  const textures = {};
  for (const alias of aliases) {
    textures[alias] = PIXI.Assets.get(alias);
  }
  return textures;
};

const loadTextureWithFallback = (PIXI, src) =>
  new Promise((resolve, reject) => {
    const texture = PIXI.Texture.from(src);
    const base = texture.baseTexture;

    if (base.valid) {
      resolve(texture);
      return;
    }

    const onLoaded = () => {
      cleanup();
      resolve(texture);
    };
    const onError = () => {
      cleanup();
      reject(new Error(`텍스처 로딩 실패: ${src}`));
    };
    const cleanup = () => {
      base.off('loaded', onLoaded);
      base.off('error', onError);
    };

    base.on('loaded', onLoaded);
    base.on('error', onError);
  });

bootstrap().catch((error) => {
  console.error(error);
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML = '<pre style="padding:16px;color:#b00020;">초기화 실패: 콘솔 오류를 확인하세요.</pre>';
  }
});
