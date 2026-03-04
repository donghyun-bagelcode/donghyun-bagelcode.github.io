export class SceneManager {
  constructor(stage) {
    this.stage = stage;
    this.scenes = new Map();
    this.currentName = null;
  }

  register(name, scene) {
    if (!scene?.container) {
      throw new Error(`씬(${name})에 container가 필요합니다.`);
    }

    scene.container.visible = false;
    this.stage.addChild(scene.container);
    this.scenes.set(name, scene);
  }

  switchScene(name, payload = {}) {
    const next = this.scenes.get(name);
    if (!next) {
      throw new Error(`등록되지 않은 씬입니다: ${name}`);
    }

    const prevName = this.currentName;
    const prev = prevName ? this.scenes.get(prevName) : null;

    if (prev && prevName !== name) {
      prev.onExit?.({ to: name, payload });
    }

    for (const [, scene] of this.scenes) {
      scene.container.visible = false;
    }

    next.container.visible = true;
    this.currentName = name;
    next.onEnter?.({ from: prevName, payload });
  }

  resize() {
    if (!this.currentName) {
      return;
    }
    const scene = this.scenes.get(this.currentName);
    scene?.onResize?.();
  }
}
