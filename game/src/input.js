// Kestrel Run — keyboard and mouse input. The keyboard flies the plane with
// the arrows and WASD; the mouse steers by where the pointer sits on the
// screen, and the wheel works the throttle. Every frame the game reads one
// plain object: { pitch, roll, yaw, throttle, brake }.

import { KEYS, clamp } from './config.js';

function matches(code, list) {
  return list.includes(code);
}

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    // The mouse steers while it is held down, or always when the pointer is
    // over the canvas and the game has started; the pilot chooses by moving.
    mouseX: 0.5,
    mouseY: 0.5,
    mouseDown: false,
    mouseSeen: false,
    wheelDelta: 0,
    throttle: 0,
    brake: false,
    pressed: new Set(), // codes pressed since the last frame was read
    canvas,
  };

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    input.mouseY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    input.mouseSeen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    input.mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    input.mouseX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    input.mouseY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    input.mouseSeen = true;
    input.pressed.add('PointerDown');
  });
  window.addEventListener('pointerup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    input.wheelDelta += event.deltaY;
  }, { passive: false });

  return input;
}

// Read the current control state for one frame. The throttle is a lever: the
// keys and the wheel move it, and it stays where it was left.
export function readControls(input, dt) {
  const keys = input.keys;
  const down = (list) => list.some((code) => keys.has(code));

  if (down(KEYS.throttleUp)) input.throttle = clamp(input.throttle + 0.55 * dt, 0, 1);
  if (down(KEYS.throttleDown)) input.throttle = clamp(input.throttle - 0.55 * dt, 0, 1);
  if (input.wheelDelta !== 0) {
    input.throttle = clamp(input.throttle - input.wheelDelta * 0.0006, 0, 1);
    input.wheelDelta = 0;
  }

  let pitch = 0;
  let roll = 0;
  let yaw = 0;
  // Arrow Up is push-forward (nose down), Arrow Down pulls up, as in a yoke.
  if (down(KEYS.pitchUp)) pitch += 1;
  if (down(KEYS.pitchDown)) pitch -= 1;
  if (down(KEYS.rollLeft)) roll -= 1;
  if (down(KEYS.rollRight)) roll += 1;
  if (down(KEYS.yawLeft)) yaw -= 1;
  if (down(KEYS.yawRight)) yaw += 1;

  // The mouse steers too: pointer left/right banks, up/down pitches, but
  // only while the button is held, so a resting pointer never fights the keys.
  if (input.mouseSeen && input.mouseDown) {
    roll += clamp((input.mouseX - 0.5) * 2.4, -1, 1);
    pitch += clamp((input.mouseY - 0.5) * 2.4, -1, 1);
  }

  return {
    pitch: clamp(pitch, -1, 1),
    roll: clamp(roll, -1, 1),
    yaw: clamp(yaw, -1, 1),
    throttle: input.throttle,
    brake: down(KEYS.brake) || keys.has('Space'),
  };
}

// True once when a key (or the pointer) was pressed since the last read.
export function wasPressed(input, list) {
  for (const code of list) {
    if (input.pressed.has(code)) return true;
  }
  return false;
}

export function clearPressed(input) {
  input.pressed.clear();
}
