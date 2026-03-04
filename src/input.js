const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const CLICK_MIN_DISTANCE = 10;

export class DirectionClickInput {
  constructor(targetElement, getOrigin, onDirection, hooks = {}) {
    this.targetElement = targetElement;
    this.getOrigin = getOrigin;
    this.onDirection = onDirection;
    this.hooks = hooks;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.targetElement.addEventListener('pointerdown', this.handlePointerDown);
  }

  handlePointerDown(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    const click = this.toRendererPoint(event.clientX, event.clientY);
    const origin = this.getOrigin();
    const dx = click.x - origin.x;
    const dy = click.y - origin.y;

    this.hooks.onClick?.({
      clientX: event.clientX,
      clientY: event.clientY,
      x: click.x,
      y: click.y,
      originX: origin.x,
      originY: origin.y,
      dx,
      dy,
    });

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) < CLICK_MIN_DISTANCE) {
      this.hooks.onDecision?.({ accepted: false, reason: 'too_close', dx, dy });
      return;
    }

    const directionName = absX > absY ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.onDirection(DIRECTIONS[directionName]);
    this.hooks.onDecision?.({ accepted: true, directionName, dx, dy });
  }

  toRendererPoint(clientX, clientY) {
    const rect = this.targetElement.getBoundingClientRect();
    const rendererWidth = this.targetElement.width || rect.width;
    const rendererHeight = this.targetElement.height || rect.height;
    const scaleX = rendererWidth / rect.width;
    const scaleY = rendererHeight / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }
}
