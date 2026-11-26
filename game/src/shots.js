// Kestrel Run — the screenshot scenes behind ?shot=title|flight|rings|
// landing|landed. Each one plays the real rules forward from a fresh world
// for a fixed number of steps, steered by the same autopilot the guide arrow
// uses, so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { FLIGHT_CRASHED, FLIGHT_FLYING, FLIGHT_LANDED, FLIGHT_TITLE, nextRing, resetFlight, stepFlight, steerToward } from './flight.js';
import { RUNWAY, clamp, wrapAngle } from './config.js';

const STEP = 1 / 60;
const SHOT_TIME = 12; // fixed clock, so the clouds never move between shots

// Throttle that holds a target speed, the way a pilot trims it.
function throttleForSpeed(state, targetSpeed) {
  return clamp(0.45 + (targetSpeed - state.speed) * 0.02, 0, 1);
}

function autopilotInput(state, rings, landing) {
  if (landing) {
    // The final approach, flown as a line down the centreline, not as a
    // point to home onto: the aim sits 250 m ahead of the nose at the
    // height the glide slope wants there, so the pilot settles onto the
    // slope and stays on it to the touchdown point near the far end. A
    // fixed aim point ahead makes the pilot fly past the runway; a gate
    // that waits for the nose to be perfectly lined up never opens, because
    // the weave's own swing is wider than the gate.
    const touchdownZ = RUNWAY.zStart + 290;
    const aimZ = state.z + 250;
    // The slope keeps falling past the touchdown point, so the plane does
    // not level off at flare height and float past the far end of the strip:
    // it meets the ground where the slope meets it.
    const aimY = Math.min(
      70,
      RUNWAY.groundY + 3 + (touchdownZ - state.z) * 0.18,
    );
    const wantedHeading = Math.atan2(RUNWAY.centreX - state.x, aimZ - state.z);
    const headingError = wrapAngle(wantedHeading - state.heading);
    const roll = clamp(headingError * 1.2, -0.6, 0.6);
    // No flare and no early throttle cut: the slope itself brings the plane
    // down at about 5 m/s onto the strip, inside the landing's own limit.
    // Flaring here only made her float past the far end of the strip.
    const pitch = clamp((aimY - state.y) * 0.07, -0.35, 0.3);
    return {
      pitch,
      roll,
      yaw: 0,
      throttle: throttleForSpeed(state, 42),
      brake: false,
    };
  }
  const next = nextRing(state, rings);
  const target = next.ring ?? { x: RUNWAY.centreX, y: RUNWAY.groundY + 3, z: RUNWAY.zStart + 90 };
  // Pure pursuit along the leg from the previous gate to this one: the aim
  // point sits on that line, a lookahead ahead of where the plane projects
  // onto it, so the plane joins the line and flies straight through the
  // gate. Homing onto the gate itself makes the pilot overshoot and orbit
  // it, and the same orbit happens around any fixed point past it.
  const previous = next.index > 0 ? rings[next.index - 1] : { x: 0, y: target.y, z: -380 };
  const legX = target.x - previous.x;
  const legZ = target.z - previous.z;
  const legLength = Math.hypot(legX, legZ) || 1;
  const along = clamp(
    ((state.x - previous.x) * legX + (state.z - previous.z) * legZ) / (legLength * legLength),
    0,
    1,
  );
  const aim = {
    x: previous.x + legX * along + (legX / legLength) * 220,
    y: target.y,
    z: previous.z + legZ * along + (legZ / legLength) * 220,
  };
  const steering = steerToward(state, aim.x, aim.y, aim.z);
  return {
    pitch: clamp(steering.pitch, -0.6, 0.6),
    roll: steering.roll,
    yaw: 0,
    throttle: throttleForSpeed(state, 56),
    brake: false,
  };
}

function stepUntil(state, rings, landing, seconds, stopWhen) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (state.phase !== FLIGHT_FLYING) break;
    stepFlight(state, autopilotInput(state, rings, landing), STEP, rings);
    if (stopWhen && stopWhen(state)) break;
  }
}

// Set `sim` to the named scene and return the screen to draw over it.
export function stageShot(name, sim) {
  const { state, rings } = sim;
  sim.time = SHOT_TIME;
  if (name === 'title') {
    resetFlight(state, rings);
    state.phase = FLIGHT_TITLE;
    state.x = 0;
    state.y = 165;
    state.z = -260;
    state.heading = 0;
    state.speed = 56;
    state.throttle = 0.5;
    state.pitch = 0.02;
    state.roll = 0.12;
    return { screen: FLIGHT_TITLE };
  }

  resetFlight(state, rings);
  if (name === 'flight') {
    // Cruise toward the second ring: the cover frame, ring ahead, plane banked.
    stepUntil(state, rings, false, 40, (s) => {
      const next = nextRing(s, rings);
      return next.index >= 1 && Math.hypot(next.ring.x - s.x, next.ring.z - s.z) < 420;
    });
    return { screen: FLIGHT_FLYING };
  }
  if (name === 'rings') {
    // Fly through two rings so the second chime's message is on screen.
    stepUntil(state, rings, false, 120, (s) => s.ringsPassed >= 2);
    for (let i = 0; i < 30; i += 1) {
      if (state.phase !== FLIGHT_FLYING) break;
      stepFlight(state, autopilotInput(state, rings, false), STEP, rings);
    }
    return { screen: FLIGHT_FLYING };
  }
  if (name === 'landing') {
    // All rings, then the final approach: the strip fills the frame ahead.
    stepUntil(state, rings, false, 180, (s) => s.ringsPassed >= rings.length);
    stepUntil(state, rings, true, 90, (s) => s.z > RUNWAY.zStart - 60 && s.y < 80);
    return { screen: FLIGHT_FLYING };
  }
  if (name === 'landed') {
    // The whole mail run, flown to a touchdown on Sora Field.
    stepUntil(state, rings, false, 200, (s) => s.ringsPassed >= rings.length);
    stepUntil(state, rings, true, 120, (s) => s.phase === FLIGHT_LANDED || s.phase === FLIGHT_CRASHED);
    return { screen: state.phase === FLIGHT_LANDED ? FLIGHT_LANDED : state.phase };
  }
  return { screen: FLIGHT_TITLE };
}
