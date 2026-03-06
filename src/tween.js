import { getPixi } from './pixi.js';

export const Easing = {
  linear: (t) => t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeIn: (t) => t * t,
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  backOut: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};

export class TweenManager {
  constructor(ticker) {
    this.ticker = ticker;
    this.tweens = [];
    this.tickerFn = () => this.update(this.ticker.deltaMS);
    this.ticker.add(this.tickerFn);
  }

  to(target, props, duration, options = {}) {
    const easing = options.easing ?? Easing.easeOut;
    const delay = options.delay ?? 0;
    const onComplete = options.onComplete ?? null;

    const startValues = {};
    for (const key of Object.keys(props)) {
      startValues[key] = target[key];
    }

    const tween = {
      target,
      props,
      startValues,
      duration,
      easing,
      delay,
      elapsed: 0,
      onComplete,
      done: false,
    };
    this.tweens.push(tween);
    return tween;
  }

  update(deltaMs) {
    for (let i = this.tweens.length - 1; i >= 0; i -= 1) {
      const tw = this.tweens[i];
      tw.elapsed += deltaMs;

      if (tw.elapsed < tw.delay) {
        continue;
      }

      const t = Math.min(1, (tw.elapsed - tw.delay) / tw.duration);
      const eased = tw.easing(t);

      for (const key of Object.keys(tw.props)) {
        tw.target[key] = tw.startValues[key] + (tw.props[key] - tw.startValues[key]) * eased;
      }

      if (t >= 1) {
        tw.done = true;
        tw.onComplete?.();
        this.tweens.splice(i, 1);
      }
    }
  }

  cancelAll(target) {
    for (let i = this.tweens.length - 1; i >= 0; i -= 1) {
      if (!target || this.tweens[i].target === target) {
        this.tweens.splice(i, 1);
      }
    }
  }

  destroy() {
    this.tweens.length = 0;
    this.ticker.remove(this.tickerFn);
  }
}
