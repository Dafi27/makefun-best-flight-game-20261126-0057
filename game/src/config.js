// Kestrel Run — shared constants and small math helpers.
// Everything the other modules need to agree on lives here: the world size, the
// flight envelope, the ring course, the scoring and the look of the sky.

export const DEG = Math.PI / 180;

export const WORLD = {
  // The Sora Archipelago stretches from the start strip (z = -400) to the
  // home airstrip on Sora Island (z = 1750).
  minX: -1200,
  maxX: 1200,
  minZ: -600,
  maxZ: 2100,
  seaLevel: 0,
};

export const PLANE = {
  cruiseSpeed: 58, // m/s the courier settles at on half throttle
  maxSpeed: 96,
  stallSpeed: 30, // below this the wings stop flying and she sinks
  minSpeed: 12,
  maxThrottle: 1,
  throttleRate: 0.55, // per second while a throttle key is held
  rollRate: 1.9, // rad/s the wings answer
  maxRoll: 1.1, // rad, about 63 degrees of bank
  pitchRate: 0.9, // rad/s
  maxPitch: 0.55, // rad, about 31 degrees up or down
  turnRate: 0.8, // rad/s of heading change at full bank and cruise speed
  climbFactor: 1.0,
  sinkAtStall: 9, // m/s of extra sink when stalled
  fuelCapacity: 160,
  fuelBurnIdle: 0.18, // per second
  fuelBurnFull: 0.85, // per second at full throttle
  takeoffSpeed: 34,
};

export const COURSE = {
  ringRadius: 30,
  ringScore: 250,
  landingScore: 500,
  parTimeSeconds: 300,
  timeBonusPerSecond: 2,
  fuelBonusPerUnit: 5,
};

// Ring gates along the mail run, from the start strip to Sora Field. The
// course zigzags gently — no turn between two legs is more than about 60° —
// so a pilot can hold the line from gate to gate without orbiting one.
export const RING_COURSE = [
  { x: 0, y: 150, z: -40 },
  { x: 180, y: 165, z: 260 },
  { x: 60, y: 185, z: 560 },
  { x: 260, y: 160, z: 860 },
  { x: 120, y: 150, z: 1140 },
  // The last gate lines up due north on the strip's centreline, so a pilot
  // comes off it already on the landing heading, with room to settle.
  { x: 0, y: 95, z: 1360 },
];

export const RUNWAY = {
  // A grass strip on Sora Island, heading due north, threshold at z = 1560 —
  // set back from the last ring so a pilot has room to line up and descend.
  centreX: 0,
  halfWidth: 34,
  zStart: 1560,
  zEnd: 1940,
  groundY: 12,
  heading: 0,
};

export const COLOURS = {
  skyTop: '#2f6fb4',
  skyMid: '#7db3dd',
  skyHorizon: '#f2d9a4',
  sun: '#fff3c4',
  seaDeep: '#1e6f92',
  seaShallow: '#3f9db8',
  sand: '#d9c08a',
  grass: '#5f9e4a',
  meadow: '#79b356',
  forest: '#3d7a35',
  rock: '#8a7f72',
  snow: '#e8eef2',
  runway: '#4a4a52',
  runwayLine: '#f5f2e6',
  ringNext: '#ffd23e',
  ringPassed: '#59d867',
  ringGlow: 'rgba(255, 210, 62, 0.35)',
  hudInk: '#eaf6ff',
  hudDim: '#9fc6dd',
  hudWarn: '#ffb02e',
  hudDanger: '#ff5a4e',
  panel: '#1c2733',
  panelEdge: '#31465a',
  gaugeGlow: '#7fe3ff',
};

export const KEYS = {
  throttleUp: ['KeyW', 'Equal'],
  throttleDown: ['KeyS', 'Minus'],
  pitchUp: ['ArrowDown'],
  pitchDown: ['ArrowUp'],
  rollLeft: ['ArrowLeft'],
  rollRight: ['ArrowRight'],
  yawLeft: ['KeyA'],
  yawRight: ['KeyD'],
  brake: ['Space'],
  start: ['Enter', 'NumpadEnter'],
  restart: ['KeyR'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  camera: ['KeyC'],
};

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

// A tiny deterministic generator so the same seed always grows the same trees
// and clouds, in the game and in the screenshots.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatAltitude(metres) {
  return `${Math.round(metres * 3.28084)} ft`;
}

export function formatSpeed(ms) {
  return `${Math.round(ms * 1.94384)} kt`;
}

export function formatHeading(radians) {
  const degrees = ((radians / DEG) % 360 + 360) % 360;
  return `${String(Math.round(degrees)).padStart(3, '0')}°`;
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
