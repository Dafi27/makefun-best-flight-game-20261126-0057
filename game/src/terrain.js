// Kestrel Run — the Sora Archipelago: islands, sea, trees, clouds and the
// home runway. The height field is a pure function of x and z, so the ground
// the pilot sees is the ground the flight model lands on.

import { RUNWAY, WORLD, mulberry32 } from './config.js';

// Each island is a soft hill: centre, radius and peak height above the sea.
const ISLANDS = [
  { x: 0, z: 1560, radius: 470, peak: 58 }, // Sora Island, home of the airstrip
  { x: -560, z: 620, radius: 300, peak: 42 }, // Kappa Isle
  { x: 610, z: 320, radius: 270, peak: 36 }, // Tulo Isle
  { x: -820, z: 1180, radius: 180, peak: 26 }, // Little Sora
  { x: 760, z: 1060, radius: 200, peak: 30 }, // Heron Rock
  { x: -260, z: -260, radius: 240, peak: 30 }, // Start Isle, under the first ring
  { x: 420, z: -380, radius: 150, peak: 20 },
  { x: -700, z: -120, radius: 130, peak: 18 },
];

function bump(x, z, island) {
  const dx = (x - island.x) / island.radius;
  const dz = (z - island.z) / island.radius;
  const d2 = dx * dx + dz * dz;
  if (d2 >= 1) return 0;
  const fall = 1 - d2;
  return island.peak * fall * fall * (3 - 2 * fall);
}

// Gentle rolling so no island is a perfect cone.
function ripple(x, z) {
  return (
    2.2 * Math.sin(x * 0.011 + 1.7) * Math.cos(z * 0.013 - 0.6) +
    1.4 * Math.sin((x + z) * 0.021 + 0.4)
  );
}

function runwayBlend(x, z) {
  // 1 inside the flattened strip, fading to 0 at its edge.
  const dx = Math.max(0, Math.abs(x - RUNWAY.centreX) - (RUNWAY.halfWidth - 8)) / 8;
  const dz = Math.max(0, Math.max(RUNWAY.zStart - z, z - RUNWAY.zEnd)) / 40;
  const edge = Math.max(dx, dz);
  return edge >= 1 ? 0 : 1 - edge;
}

export function terrainHeight(x, z) {
  let height = -3; // the seabed, under the water
  for (let i = 0; i < ISLANDS.length; i += 1) height += bump(x, z, ISLANDS[i]);
  if (height > 1) height += ripple(x, z) * Math.min(1, height / 12);
  const blend = runwayBlend(x, z);
  if (blend > 0) height = height + (RUNWAY.groundY - height) * blend;
  return height;
}

// The surface the plane can touch: the land, or the sea itself where there
// is no land. A ditching is a crash, not a glide that never ends.
export function surfaceHeight(x, z) {
  return Math.max(terrainHeight(x, z), 0.5);
}

export function groundColour(height, x, z) {
  if (height < 2.5) return '#d9c08a'; // beach sand
  if (height < 10) return '#79b356'; // low meadow
  if (height < 24) return '#5f9e4a'; // grass
  if (height < 48) return '#3d7a35'; // forest slopes
  if (height < 56) return '#8a7f72'; // rock near the tops
  return '#e8eef2'; // the highest tops, dusted pale
}

export function isOnRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.centreX) <= RUNWAY.halfWidth &&
    z >= RUNWAY.zStart &&
    z <= RUNWAY.zEnd
  );
}

// A grove of pines, seeded so it never moves between runs.
export function makeTrees() {
  const random = mulberry32(20261126);
  const trees = [];
  for (let i = 0; i < 260; i += 1) {
    const x = WORLD.minX + random() * (WORLD.maxX - WORLD.minX);
    const z = WORLD.minZ + random() * (WORLD.maxZ - WORLD.minZ);
    const height = terrainHeight(x, z);
    if (height < 4 || height > 42) continue;
    if (isOnRunway(x, z)) continue;
    trees.push({ x, z, y: height, size: 7 + random() * 9 });
  }
  return trees;
}

// A few low clouds drifting over the sea, seeded like the trees.
export function makeClouds() {
  const random = mulberry32(777);
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: WORLD.minX + random() * (WORLD.maxX - WORLD.minX),
      z: WORLD.minZ + random() * (WORLD.maxZ - WORLD.minZ),
      y: 210 + random() * 90,
      size: 60 + random() * 130,
      drift: 1.5 + random() * 2.5,
    });
  }
  return clouds;
}

// The hangar and the little tower beside the strip, drawn as boxes.
export function makeBuildings() {
  return [
    { x: -58, z: 1500, y: RUNWAY.groundY, w: 26, d: 18, h: 12, colour: '#b8452f' },
    { x: 62, z: 1560, y: RUNWAY.groundY, w: 14, d: 12, h: 22, colour: '#e8e2d2' },
    { x: 60, z: 1440, y: RUNWAY.groundY, w: 18, d: 14, h: 9, colour: '#3f6d8e' },
  ];
}
