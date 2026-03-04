import { ASSET_PATHS } from './config.js';
import { createGameScene } from './game.js';
import { createLobbyScene } from './lobby.js';
import { getPixi, waitForPixi } from './pixi.js';
import { SceneManager } from './scene-manager.js';

const LOBBY_ASSET_PATHS = {
  lobbyBg: './image/lobby/bg.png',
  stageYellow: './image/lobby/stage_yellow.png',
  stageBlue: './image/lobby/stage_blue.png',
  stageRed: './image/lobby/stage_red.png',
  stageCurrent: './image/lobby/stage_1.png',
  num1: './image/lobby/num_1.png',
  num2: './image/lobby/num_2.png',
  num3: './image/lobby/num_3.png',
  num4: './image/lobby/num_4.png',
  num5: './image/lobby/num_5.png',
  num6: './image/lobby/num_6.png',
  num7: './image/lobby/num_7.png',
  num8: './image/lobby/num_8.png',
  num9: './image/lobby/num_9.png',
  starCollect: './image/lobby/star-collect.png',
  back: './image/lobby/back.png',
  home: './image/lobby/home.png',
  pageButton: './image/lobby/page-button.png',
  lobbyCharacter: './image/lobby/character.png',
};

const bootstrap = async () => {
  const root = document.getElementById('app');
  if (!root) {
    throw new Error('app container(#app)을 찾지 못했습니다.');
  }

  const app = await createPixiApp(root);
  root.appendChild(app.canvas ?? app.view);

  const textures = await loadTextures({ ...ASSET_PATHS, ...LOBBY_ASSET_PATHS });

  const sceneManager = new SceneManager(app.stage);

  const gameScene = createGameScene({
    app,
    root,
    textures,
    onGoLobby: () => sceneManager.switchScene('lobby'),
  });

  const lobbyScene = createLobbyScene({
    app,
    textures,
    onSelectStage: (stageId) => {
      sceneManager.switchScene('game', { stageId });
    },
  });

  sceneManager.register('lobby', lobbyScene);
  sceneManager.register('game', gameScene);

  window.addEventListener('resize', () => sceneManager.resize());

  sceneManager.switchScene('lobby');
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
