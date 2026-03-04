const MAX_LOGS = 16;

const now = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

export class DebugUI {
  constructor(rootElement) {
    this.rootElement = rootElement;
    this.visible = false;
    this.logs = [];

    this.state = {
      grid: '(?, ?)',
      animating: false,
      lastInput: '-',
      lastMove: '-',
      lastError: '-',
    };

    this.build();
    this.render();
  }

  build() {
    this.button = document.createElement('button');
    this.button.textContent = 'Debug';
    this.button.style.position = 'fixed';
    this.button.style.top = '12px';
    this.button.style.right = '12px';
    this.button.style.zIndex = '9999';
    this.button.style.border = '0';
    this.button.style.borderRadius = '10px';
    this.button.style.padding = '8px 10px';
    this.button.style.background = '#111827';
    this.button.style.color = '#f9fafb';
    this.button.style.fontSize = '12px';
    this.button.style.cursor = 'pointer';
    this.button.style.userSelect = 'none';
    this.button.style.webkitUserSelect = 'none';
    this.button.style.touchAction = 'manipulation';

    this.panel = document.createElement('section');
    this.panel.style.position = 'fixed';
    this.panel.style.top = '48px';
    this.panel.style.right = '12px';
    this.panel.style.zIndex = '9998';
    this.panel.style.width = 'min(90vw, 360px)';
    this.panel.style.maxHeight = '70vh';
    this.panel.style.overflow = 'auto';
    this.panel.style.padding = '10px';
    this.panel.style.borderRadius = '12px';
    this.panel.style.background = 'rgba(17,24,39,0.92)';
    this.panel.style.color = '#e5e7eb';
    this.panel.style.font = '12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    this.panel.style.display = 'none';
    this.panel.style.pointerEvents = 'none';

    this.panel.innerHTML = `
      <div style="margin-bottom:8px;font-weight:700;">Debug Overlay</div>
      <div id="debug-state" style="white-space:pre-wrap;margin-bottom:8px;"></div>
      <div style="margin-bottom:6px;font-weight:700;">Logs</div>
      <div id="debug-logs" style="white-space:pre-wrap;"></div>
    `;

    this.button.addEventListener('click', () => {
      this.visible = !this.visible;
      this.render();
    });

    this.rootElement.appendChild(this.button);
    this.rootElement.appendChild(this.panel);
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.render();
  }

  logInput(message) {
    this.pushLog(`INPUT ${message}`);
    this.setState({ lastInput: message });
  }

  logMove(message) {
    this.pushLog(`MOVE  ${message}`);
    this.setState({ lastMove: message });
  }

  logError(message) {
    this.pushLog(`ERROR ${message}`);
    this.setState({ lastError: message });
  }

  pushLog(message) {
    this.logs.unshift(`[${now()}] ${message}`);
    if (this.logs.length > MAX_LOGS) {
      this.logs.length = MAX_LOGS;
    }
    this.render();
  }

  render() {
    this.panel.style.display = this.visible ? 'block' : 'none';
    this.button.textContent = this.visible ? 'Debug On' : 'Debug';

    const stateEl = this.panel.querySelector('#debug-state');
    if (stateEl) {
      stateEl.textContent = [
        `grid: ${this.state.grid}`,
        `animating: ${this.state.animating}`,
        `lastInput: ${this.state.lastInput}`,
        `lastMove: ${this.state.lastMove}`,
        `lastError: ${this.state.lastError}`,
      ].join('\n');
    }

    const logsEl = this.panel.querySelector('#debug-logs');
    if (logsEl) {
      logsEl.textContent = this.logs.join('\n') || '-';
    }
  }
}
