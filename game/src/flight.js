// Kestrel Run — the flight model and the mail run itself: throttle, pitch,
// roll and yaw, lift and stall, the ring gates, fuel, and what counts as a
// landing instead of a crash. Pure numbers in, pure numbers out; nothing here
// draws anything, so the screenshots can step it without a screen.

import { COURSE, PLANE, WORLD, clamp, lerp, wrapAngle } from './config.js';
import { isOnRunway, surfaceHeight, terrainHeight } from './terrain.js';

export const FLIGHT_TITLE = 'title';
export const FLIGHT_FLYING = 'flying';
export const FLIGHT_LANDED = 'landed';
export const FLIGHT_CRASHED = 'crashed';
export const FLIGHT_PAUSED = 'paused';

export function createFlight() {
  return {
    phase: FLIGHT_TITLE,
    // The courier starts on the start strip, nose to the north, engine idling.
    x: 0,
    y: 118,
    z: -380,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    verticalSpeed: 0,
    fuel: PLANE.fuelCapacity,
    score: 0,
    ringsPassed: 0,
    time: 0,
    message: '',
    messageUntil: 0,
    // Per-ring bookkeeping: whether each gate has been flown, and the signed
    // distance to its plane on the previous step, for crossing detection.
    ringDone: [],
    ringSide: [],
    landedBonus: 0,
    crashReason: '',
    bestScore: 0,
  };
}

export function resetFlight(state, rings) {
  const fresh = createFlight();
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
  state.ringDone = rings.map(() => false);
  state.ringSide = rings.map(() => null);
  state.phase = FLIGHT_FLYING;
  state.message = 'Mail run started — fly through the gold rings, then land on Sora Field';
  state.messageUntil = 4;
}

export function nextRing(state, rings) {
  for (let i = 0; i < rings.length; i += 1) {
    if (!state.ringDone[i]) return { index: i, ring: rings[i] };
  }
  return { index: -1, ring: null };
}

export function allRingsDone(state) {
  return state.ringsPassed >= state.ringDone.length;
}

// Steer the nose toward a point: returns the roll and pitch the autopilot
// (and the on-screen guide arrow) want, in the same -1..1 input range the
// keyboard uses.
export function steerToward(state, targetX, targetY, targetZ) {
  const dx = targetX - state.x;
  const dz = targetZ - state.z;
  const wantedHeading = Math.atan2(dx, dz);
  const headingError = wrapAngle(wantedHeading - state.heading);
  const roll = clamp(headingError * 1.6, -1, 1);
  const distance = Math.hypot(dx, dz);
  const wantedAltitude = targetY + Math.max(0, distance - 120) * 0.02;
  const altitudeError = wantedAltitude - state.y;
  const pitch = clamp(altitudeError * 0.02, -1, 1);
  return { roll, pitch };
}

function ringPlaneSide(state, ring) {
  // Rings face north along the course; the plane crosses when z passes the
  // ring's z while flying north, or the reverse when it comes back.
  return state.z - ring.z;
}

function checkRings(state, rings, dt) {
  const events = [];
  for (let i = 0; i < rings.length; i += 1) {
    if (state.ringDone[i]) continue;
    const ring = rings[i];
    const side = ringPlaneSide(state, ring);
    const previous = state.ringSide[i];
    state.ringSide[i] = side;
    // A crossing is a change of SIGN of the distance to the ring's plane, not
    // a change of its value: the plane's z moves every step.
    if (previous === null || side === 0 || Math.sign(previous) === Math.sign(side)) continue;
    // Crossed the ring's plane this step: how close to its centre?
    const lateral = Math.hypot(state.x - ring.x, state.y - ring.y);
    if (lateral <= ring.radius) {
      state.ringDone[i] = true;
      state.ringsPassed += 1;
      state.score += COURSE.ringScore;
      state.message = `Ring ${state.ringsPassed} of ${rings.length} — +${COURSE.ringScore} pts`;
      state.messageUntil = state.time + 2.5;
      events.push('ring');
    } else if (lateral <= ring.radius + 25) {
      state.message = 'Just missed that ring — turn back for it';
      state.messageUntil = state.time + 2;
    }
  }
  return events;
}

function checkLanding(state, events) {
  const ground = surfaceHeight(state.x, state.z);
  if (state.y > ground + 1.2) return;
  state.y = ground + 1.2;
  const onStrip = isOnRunway(state.x, state.z);
  const gentle = Math.abs(state.verticalSpeed) < 8 && Math.abs(state.roll) < 0.5;
  const slow = state.speed < 85;
  if (onStrip && gentle && slow) {
    state.phase = FLIGHT_LANDED;
    const timeBonus = Math.max(0, Math.round((COURSE.parTimeSeconds - state.time) * COURSE.timeBonusPerSecond));
    const fuelBonus = Math.round(state.fuel * COURSE.fuelBonusPerUnit);
    state.landedBonus = COURSE.landingScore + timeBonus + fuelBonus;
    state.score += state.landedBonus;
    state.message = `Landed on Sora Field! +${state.landedBonus} pts`;
    state.messageUntil = state.time + 6;
    events.push('landed');
    return;
  }
  state.phase = FLIGHT_CRASHED;
  state.crashReason = onStrip
    ? 'Too hard on the strip — the undercarriage gave way'
    : state.y <= 1.5 && terrainHeight(state.x, state.z) <= 1
      ? 'Ditched in the sea'
      : 'Flew into the ground';
  state.message = state.crashReason;
  state.messageUntil = state.time + 6;
  events.push('crashed');
}

// One fixed step of the simulation. `input` is { pitch, roll, yaw, throttle,
// brake } in the -1..1 range (throttle 0..1). Returns the events of this step.
export function stepFlight(state, input, dt, rings) {
  if (state.phase !== FLIGHT_FLYING) return [];
  const events = [];
  state.time += dt;

  // Throttle: the lever stays where the pilot left it; fuel feeds the engine.
  const outOfFuel = state.fuel <= 0;
  const throttle = outOfFuel ? 0 : clamp(input.throttle ?? state.throttle, 0, 1);
  state.throttle = throttle;
  if (!outOfFuel) {
    state.fuel = Math.max(
      0,
      state.fuel - (PLANE.fuelBurnIdle + throttle * PLANE.fuelBurnFull) * dt,
    );
    if (state.fuel <= 0) {
      state.message = 'Fuel empty — glide her in, engine out';
      state.messageUntil = state.time + 4;
      events.push('fuel-empty');
    }
  }

  // Speed: thrust against drag, the brake scrubbing speed for the landing.
  const drag = 0.0035 * state.speed * state.speed + 1.2;
  const thrust = throttle * 15;
  const brake = input.brake ? 22 : 0;
  state.speed = clamp(state.speed + (thrust - drag - brake) * dt, 0, PLANE.maxSpeed);

  // Attitude: the wings follow the stick with a little lag, so the plane
  // feels flown rather than snapped.
  const wantedRoll = clamp(input.roll ?? 0, -1, 1) * PLANE.maxRoll;
  const wantedPitch = clamp(input.pitch ?? 0, -1, 1) * PLANE.maxPitch;
  state.roll = lerp(state.roll, wantedRoll, Math.min(1, dt * 3.2));
  state.pitch = lerp(state.pitch, wantedPitch, Math.min(1, dt * 2.6));

  // Heading follows the bank; the rudder trims it a little either way.
  const turnAuthority = clamp(state.speed / PLANE.cruiseSpeed, 0.25, 1.4);
  state.heading = wrapAngle(
    state.heading +
      (Math.sin(state.roll) * PLANE.turnRate * turnAuthority +
        (input.yaw ?? 0) * 0.25) *
        dt,
  );

  // Lift: climb with pitch and speed, sink when slow. At cruise the wings
  // nearly hold her level, so a resting stick only settles her gently.
  const stalled = state.speed < PLANE.stallSpeed;
  const climb = Math.sin(state.pitch) * state.speed * PLANE.climbFactor;
  const sink = stalled ? PLANE.sinkAtStall * (1 - state.speed / PLANE.stallSpeed) : 0.5;
  state.verticalSpeed = climb - sink;
  state.y += state.verticalSpeed * dt;

  // Move forward along the nose.
  const forwardX = Math.sin(state.heading) * Math.cos(state.pitch);
  const forwardZ = Math.cos(state.heading) * Math.cos(state.pitch);
  state.x += forwardX * state.speed * dt;
  state.z += forwardZ * state.speed * dt;

  // The archipelago ends; turn the pilot back with a nudge, not a wall.
  state.x = clamp(state.x, WORLD.minX, WORLD.maxX);
  state.z = clamp(state.z, WORLD.minZ, WORLD.maxZ);

  events.push(...checkRings(state, rings, dt));

  // A gentle descent onto the strip is a landing; anything else is a crash.
  const ground = surfaceHeight(state.x, state.z);
  if (state.y <= ground + 1.2) checkLanding(state, events);
  if (state.y < 0.5) state.y = 0.5;
  return events;
}
