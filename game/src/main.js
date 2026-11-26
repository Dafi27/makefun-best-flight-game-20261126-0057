// Kestrel Run — the entry point: the canvas, the game loop, the screens and
// the screenshot mode. The loop steps the flight model at a fixed rate and
// draws the world, the HUD and the overlay for the current screen.

import { RING_COURSE } from './config.js';
import {
  FLIGHT_CRASHED,
  FLIGHT_FLYING,
  FLIGHT_LANDED,
  FLIGHT_PAUSED,
  FLIGHT_TITLE,
  createFlight,
  resetFlight,
  stepFlight,
} from './flight.js';
import { createWorld, drawWorld } from './render.js';
import { drawHud, drawOverlay } from './hud.js';
import { createAudio, playClick, playCrashThud, playLandingFanfare, playRingChime, setMuted, startAudio, updateEngineSound } from './audio.js';
import { clearPressed, createInput, readControls, wasPressed } from './input.js';
import { stageShot } from './shots.js';
import { KEYS } from './config.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const ctx = canvas.getContext('2d');

const rings = RING_COURSE.map((ring) => ({ ...ring, radius: 30 }));
const state = createFlight();
const world = createWorld();
const audio = createAudio();
const input = createInput(canvas);
let bestScore = 0;
let time = 0;
let lastTimestamp = 0;
let shotScreen = null;

function resizeCanvas() {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.floor(canvas.clientWidth * ratio);
  const height = Math.floor(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function render() {
  resizeCanvas();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld(ctx, state, world, rings, time);
  if (state.phase === FLIGHT_FLYING || state.phase === FLIGHT_PAUSED) {
    drawHud(ctx, state, rings, time);
  }
  drawOverlay(ctx, state, rings, bestScore);
  statusLine.textContent =
    state.phase === FLIGHT_FLYING
      ? `Flying: score ${state.score}, rings ${state.ringsPassed} of ${rings.length}`
      : state.phase === FLIGHT_LANDED
        ? `Landed on Sora Field with ${state.score} points`
        : state.phase === FLIGHT_CRASHED
          ? `Crashed: ${state.crashReason}`
          : 'Kestrel Run: mail run over the Sora Archipelago';
}

function handleEvents(events) {
  for (const event of events) {
    if (event === 'ring') playRingChime(audio);
    if (event === 'landed') {
      playLandingFanfare(audio);
      bestScore = Math.max(bestScore, state.score);
    }
    if (event === 'crashed') {
      playCrashThud(audio);
      bestScore = Math.max(bestScore, state.score);
    }
  }
}

function frame(timestamp) {
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000 || 0.016);
  lastTimestamp = timestamp;
  time += dt;

  if (wasPressed(input, KEYS.mute)) setMuted(audio, !audio.muted);
  if (wasPressed(input, KEYS.start) || wasPressed(input, ['PointerDown'])) {
    startAudio(audio);
    if (state.phase === FLIGHT_TITLE) {
      playClick(audio);
      resetFlight(state, rings);
      input.throttle = 0.55;
    }
  }
  if (state.phase === FLIGHT_FLYING && wasPressed(input, KEYS.pause)) {
    state.phase = FLIGHT_PAUSED;
  } else if (state.phase === FLIGHT_PAUSED && wasPressed(input, KEYS.pause)) {
    state.phase = FLIGHT_FLYING;
  }
  if ((state.phase === FLIGHT_CRASHED || state.phase === FLIGHT_LANDED) && wasPressed(input, KEYS.restart)) {
    playClick(audio);
    resetFlight(state, rings);
    input.throttle = 0.55;
  }
  clearPressed(input);

  if (state.phase === FLIGHT_FLYING) {
    const controls = readControls(input, dt);
    const events = stepFlight(state, controls, dt, rings);
    handleEvents(events);
    updateEngineSound(audio, state.throttle, state.speed, true);
  } else {
    updateEngineSound(audio, 0, 0, false);
  }

  render();
  requestAnimationFrame(frame);
}

// Screenshot mode: ?shot=title|flight|rings|landing|landed stages one
// deterministic scene, draws it once, and says so for the camera.
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
if (shotName) {
  const sim = { state, rings, time: 0 };
  shotScreen = stageShot(shotName, sim).screen;
  time = sim.time;
  state.phase = shotScreen;
  render();
  window.__kestrelShot = { name: shotName, screen: shotScreen, ready: true };
} else {
  requestAnimationFrame(frame);
}

// A small handle for play-testing: the state the page is in, live.
window.__kestrel = {
  get state() {
    return state;
  },
  get rings() {
    return rings;
  },
  get bestScore() {
    return bestScore;
  },
  start() {
    startAudio(audio);
    resetFlight(state, rings);
    input.throttle = 0.55;
  },
  restart() {
    resetFlight(state, rings);
    input.throttle = 0.55;
  },
};
