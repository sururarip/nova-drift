// Keyboard + mouse state, translated into one plain input object the world
// steps with. No game logic lives here — only reading the devices.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.dashQueued = false;
    this.novaQueued = false;
    this.pressed = new Set();
    this.onKey = null;
    this.onClick = null;
    if (canvas && typeof canvas.addEventListener === 'function') this.attach(canvas);
  }

  attach(canvas) {
    const toLocal = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / Math.max(1, rect.width);
      const scaleY = canvas.height / Math.max(1, rect.height);
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };
    window.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
      if (!event.repeat) {
        this.pressed.add(key);
        if (this.onKey) this.onKey(key, event);
        if (key === 'shift' || key === ' ') this.dashQueued = true;
        if (key === 'e') this.novaQueued = true;
      }
      this.keys.add(key);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (event) => {
      const p = toLocal(event.clientX, event.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
    });
    canvas.addEventListener('mousedown', (event) => {
      const p = toLocal(event.clientX, event.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
      if (event.button === 2) {
        this.novaQueued = true;
        return;
      }
      this.mouseDown = true;
      if (this.onClick) this.onClick(p.x, p.y, event.button);
    });
    canvas.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** True while the key is held. */
  held(...names) {
    return names.some((n) => this.keys.has(n));
  }

  /** True once for the frame the key was pressed; consumed by the caller. */
  wasPressed(name) {
    if (this.pressed.has(name)) {
      this.pressed.delete(name);
      return true;
    }
    return false;
  }

  /** Build the frame's input for the world. */
  frame() {
    let mx = 0;
    let my = 0;
    if (this.held('a', 'arrowleft')) mx -= 1;
    if (this.held('d', 'arrowright')) mx += 1;
    if (this.held('w', 'arrowup')) my -= 1;
    if (this.held('s', 'arrowdown')) my += 1;
    const len = Math.hypot(mx, my) || 1;
    const out = {
      moveX: mx / len,
      moveY: my / len,
      aimX: this.mouseX,
      aimY: this.mouseY,
      firing: this.mouseDown,
      dash: this.dashQueued,
      nova: this.novaQueued,
    };
    this.dashQueued = false;
    this.novaQueued = false;
    return out;
  }

  /** Clear edge-triggered presses at the end of a frame. */
  endFrame() {
    this.pressed.clear();
  }
}
