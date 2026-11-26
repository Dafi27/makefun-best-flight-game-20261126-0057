// Kestrel Run — the world on screen: a chase camera behind the courier, a
// projected sea and island grid, the gold ring gates, the home runway and the
// plane herself, drawn with plain Canvas 2D and a small projection of our own.

import { COLOURS, RUNWAY } from './config.js';
import { FLIGHT_LANDED } from './flight.js';
import { groundColour, makeBuildings, makeClouds, makeTrees, terrainHeight } from './terrain.js';

const GRID_STEP = 90;
const GRID_HALF = 1170;
const FOV = 72 * (Math.PI / 180);

export function createWorld() {
  return {
    trees: makeTrees(),
    clouds: makeClouds(),
    buildings: makeBuildings(),
    time: 0,
  };
}

function cameraBasis(state) {
  // Chase camera: behind and above the plane, looking a little past her nose.
  // Parked on the strip, the camera climbs high and looks down, so the shot
  // shows the plane sitting on the runway instead of the hillside the strip
  // is cut into: from the ground the flattened strip is a valley, and its
  // sides fill the frame.
  const landed = state.phase === FLIGHT_LANDED;
  const forwardX = Math.sin(state.heading);
  const forwardZ = Math.cos(state.heading);
  const camX = state.x - forwardX * (landed ? 14 : 21);
  const camY = state.y + (landed ? 90 : 6.5);
  const camZ = state.z - forwardZ * (landed ? 14 : 21);
  const lookX = state.x + forwardX * (landed ? 40 : 55);
  const lookY = state.y + (landed ? 0 : Math.sin(state.pitch) * 30 - 2);
  const lookZ = state.z + forwardZ * (landed ? 40 : 55);
  let fx = lookX - camX;
  let fy = lookY - camY;
  let fz = lookZ - camZ;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl;
  fy /= fl;
  fz /= fl;
  // Right = forward x world-up, up = right x forward.
  let rx = fz;
  let rz = -fx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  // up = forward x right, so the sky stays up: the cross the other way round
  // points down, and the whole world renders upside down (the islands above
  // the horizon, the clouds and the sun in the sea).
  const ux = fy * rz;
  const uy = fz * rx - fx * rz;
  const uz = -fy * rx;
  return {
    pos: { x: camX, y: camY, z: camZ },
    fwd: { x: fx, y: fy, z: fz },
    right: { x: rx, y: 0, z: rz },
    up: { x: ux, y: uy, z: uz },
  };
}

// Project a world point to screen pixels; null when it is behind the camera.
export function project(point, camera, view) {
  const dx = point.x - camera.pos.x;
  const dy = point.y - camera.pos.y;
  const dz = point.z - camera.pos.z;
  const forward = dx * camera.fwd.x + dy * camera.fwd.y + dz * camera.fwd.z;
  if (forward < 2) return null;
  const right = dx * camera.right.x + dy * camera.right.y + dz * camera.right.z;
  const up = dx * camera.up.x + dy * camera.up.y + dz * camera.up.z;
  const scale = view.focal / forward;
  return {
    x: view.cx + right * scale,
    y: view.cy - up * scale,
    scale,
    depth: forward,
  };
}

function skyGradient(ctx, view, horizonY) {
  // Every stop stays inside [0, 1]: a camera looking steeply down puts the
  // horizon above the frame, and an unclamped stop throws.
  const horizon = Math.max(0, Math.min(1, horizonY / view.height));
  const gradient = ctx.createLinearGradient(0, 0, 0, view.height);
  gradient.addColorStop(0, COLOURS.skyTop);
  gradient.addColorStop(horizon, COLOURS.skyMid);
  gradient.addColorStop(Math.min(1, horizon + 0.08), COLOURS.skyHorizon);
  gradient.addColorStop(1, '#1a4a6e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, view.width, view.height);
}

function drawSun(ctx, camera, view) {
  const sunPoint = {
    x: camera.pos.x + camera.fwd.x * 3000 - 1400,
    y: camera.pos.y + 620,
    z: camera.pos.z + camera.fwd.z * 3000,
  };
  const p = project(sunPoint, camera, view);
  if (!p) return;
  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 90);
  glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 230, 150, 0.55)');
  glow.addColorStop(1, 'rgba(255, 230, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - 100, p.y - 100, 200, 200);
  ctx.fillStyle = COLOURS.sun;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(ctx, cloud, camera, view, time) {
  const drifted = { ...cloud, x: cloud.x + time * cloud.drift };
  const p = project(drifted, camera, view);
  if (!p || p.depth > 2400) return;
  const size = cloud.size * p.scale * 0.9;
  if (size < 4) return;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, size, size * 0.36, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x - size * 0.45, p.y + size * 0.08, size * 0.6, size * 0.28, 0, 0, Math.PI * 2);
  ctx.ellipse(p.x + size * 0.5, p.y + size * 0.06, size * 0.55, size * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSea(ctx, view, horizonY) {
  if (horizonY >= view.height) return;
  const top = Math.max(0, horizonY);
  const gradient = ctx.createLinearGradient(0, top, 0, view.height);
  gradient.addColorStop(0, COLOURS.seaShallow);
  gradient.addColorStop(1, COLOURS.seaDeep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, top, view.width, view.height - top);
}

function drawTerrain(ctx, camera, view, trees) {
  const items = [];
  const camX = camera.pos.x;
  const camZ = camera.pos.z;
  const zNear = Math.max(-600, camZ - 260);
  const zFar = camZ + 1700;
  for (let z = zNear; z < zFar; z += GRID_STEP) {
    for (let x = -GRID_HALF; x < GRID_HALF; x += GRID_STEP) {
      const corners = [
        { x, z },
        { x: x + GRID_STEP, z },
        { x: x + GRID_STEP, z: z + GRID_STEP },
        { x, z: z + GRID_STEP },
      ];
      let sumH = 0;
      let maxH = -Infinity;
      let allBehind = true;
      const projected = [];
      for (const corner of corners) {
        const h = terrainHeight(corner.x, corner.z);
        sumH += h;
        if (h > maxH) maxH = h;
        const p = project({ x: corner.x, y: h, z: corner.z }, camera, view);
        projected.push(p);
        if (p) allBehind = false;
      }
      if (allBehind) continue;
      // A cell counts when any corner breaks the surface: the shoreline
      // cells run the beach down into the water, so no island floats.
      if (maxH < 0.5) continue;
      const avgH = sumH / 4;
      const depth = Math.hypot(x + GRID_STEP / 2 - camX, z + GRID_STEP / 2 - camZ);
      items.push({ kind: 'ground', projected, colour: groundColour(Math.max(0, avgH), x, z), depth });
    }
  }
  // The pines join the same far-to-near order, so a hill hides the trees
  // behind it instead of letting them hang in the sky past its edge.
  for (const tree of trees) {
    const base = project({ x: tree.x, y: tree.y, z: tree.z }, camera, view);
    const top = project({ x: tree.x, y: tree.y + tree.size, z: tree.z }, camera, view);
    if (!base || !top || base.depth > 1100) continue;
    items.push({ kind: 'tree', base, top, size: tree.size, depth: base.depth });
  }
  items.sort((a, b) => b.depth - a.depth);
  for (const item of items) {
    if (item.kind === 'ground') {
      const pts = item.projected;
      if (!pts[0] || !pts[1] || !pts[2] || !pts[3]) continue;
      ctx.fillStyle = item.colour;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.lineTo(pts[2].x, pts[2].y);
      ctx.lineTo(pts[3].x, pts[3].y);
      ctx.closePath();
      ctx.fill();
    } else {
      drawTreeAt(ctx, item);
    }
  }
}

function drawRunway(ctx, camera, view) {
  const y = RUNWAY.groundY + 0.4;
  // The strip is drawn in short segments, not one polygon: from a high
  // camera the far end can sit behind the lens, and one bad corner must not
  // hide the whole runway.
  const segments = 8;
  const step = (RUNWAY.zEnd - RUNWAY.zStart) / segments;
  ctx.fillStyle = COLOURS.runway;
  for (let i = 0; i < segments; i += 1) {
    const z0 = RUNWAY.zStart + i * step;
    const z1 = z0 + step;
    const corners = [
      { x: RUNWAY.centreX - RUNWAY.halfWidth, y, z: z0 },
      { x: RUNWAY.centreX + RUNWAY.halfWidth, y, z: z0 },
      { x: RUNWAY.centreX + RUNWAY.halfWidth, y, z: z1 },
      { x: RUNWAY.centreX - RUNWAY.halfWidth, y, z: z1 },
    ].map((p) => project(p, camera, view));
    if (corners.some((p) => !p)) continue;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
  }
  // Centreline dashes and the threshold bars.
  ctx.fillStyle = COLOURS.runwayLine;
  for (let z = RUNWAY.zStart + 30; z < RUNWAY.zEnd - 20; z += 60) {
    const a = project({ x: -2.5, y: y + 0.1, z }, camera, view);
    const b = project({ x: 2.5, y: y + 0.1, z }, camera, view);
    const c = project({ x: 2.5, y: y + 0.1, z: z + 26 }, camera, view);
    const d = project({ x: -2.5, y: y + 0.1, z: z + 26 }, camera, view);
    if (!a || !b || !c || !d) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }
  // Edge lights, warm dots along both sides.
  ctx.fillStyle = '#ffd98a';
  for (let z = RUNWAY.zStart + 10; z <= RUNWAY.zEnd; z += 80) {
    for (const side of [-1, 1]) {
      const p = project({ x: RUNWAY.centreX + side * (RUNWAY.halfWidth - 2), y: y + 0.6, z }, camera, view);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, 260 / p.depth), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBox(ctx, building, camera, view) {
  const { x, z, y, w, d, h, colour } = building;
  const top = y + h;
  const corners = [
    { x: x - w / 2, y, z: z - d / 2 },
    { x: x + w / 2, y, z: z - d / 2 },
    { x: x + w / 2, y, z: z + d / 2 },
    { x: x - w / 2, y, z: z + d / 2 },
    { x: x - w / 2, y: top, z: z - d / 2 },
    { x: x + w / 2, y: top, z: z - d / 2 },
    { x: x + w / 2, y: top, z: z + d / 2 },
    { x: x - w / 2, y: top, z: z + d / 2 },
  ].map((p) => project(p, camera, view));
  if (corners.some((p) => !p)) return;
  const face = (indices, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(corners[indices[0]].x, corners[indices[0]].y);
    indices.slice(1).forEach((i) => ctx.lineTo(corners[i].x, corners[i].y));
    ctx.closePath();
    ctx.fill();
  };
  face([4, 5, 6, 7], '#5a3b32'); // roof
  face([1, 2, 6, 5], colour); // front
  face([0, 1, 5, 4], '#00000022'); // side shade
}

function drawTreeAt(ctx, item) {
  const { base, top, size } = item;
  const width = Math.max(2, size * base.scale * 0.55);
  ctx.strokeStyle = '#5a3d24';
  ctx.lineWidth = Math.max(1, width * 0.18);
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(base.x, base.y - width * 0.5);
  ctx.stroke();
  ctx.fillStyle = '#2c5c26';
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(base.x - width, base.y - width * 0.4);
  ctx.lineTo(base.x + width, base.y - width * 0.4);
  ctx.closePath();
  ctx.fill();
}

function drawRing(ctx, ring, isNext, isPassed, camera, view, time) {
  const centre = project({ x: ring.x, y: ring.y, z: ring.z }, camera, view);
  if (!centre || centre.depth > 2600) return;
  // A ring the camera is inside or about to swallow reads as a glitch, not
  // a gate: leave it out once it is closer than this.
  if (centre.depth < 25) return;
  // The ring's on-screen radius from a point one radius to its side.
  const edge = project({ x: ring.x + ring.radius, y: ring.y, z: ring.z }, camera, view);
  if (!edge) return;
  const radius = Math.abs(edge.x - centre.x);
  if (radius < 3) return;
  const pulse = isNext ? 1 + 0.06 * Math.sin(time * 4) : 1;
  const r = radius * pulse;
  ctx.save();
  if (isNext) {
    ctx.shadowColor = COLOURS.ringGlow;
    ctx.shadowBlur = 26;
  }
  ctx.strokeStyle = isPassed ? COLOURS.ringPassed : isNext ? COLOURS.ringNext : 'rgba(230, 236, 242, 0.55)';
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = isPassed
    ? 'rgba(89, 216, 103, 0.10)'
    : isNext
      ? 'rgba(255, 210, 62, 0.08)'
      : 'rgba(255, 255, 255, 0.03)';
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// The Kestrel herself, seen from behind and above: wings, fuselage, tail and
// the spinning prop at the nose. She banks with the roll and sits a little
// below the centre of the screen.
export function drawPlane(ctx, state, view, time) {
  const cx = view.cx;
  const cy = view.cy + view.height * 0.10 + state.pitch * view.height * 0.06;
  const size = Math.min(view.width, view.height) * 0.16;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-state.roll * 0.85);
  ctx.scale(1, 1);

  // Propeller blur at the nose.
  const propSpin = (time * 40) % (Math.PI * 2);
  ctx.fillStyle = 'rgba(220, 230, 240, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.62, size * 0.10, size * 0.30, propSpin * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Wings.
  ctx.fillStyle = '#c8442c';
  ctx.beginPath();
  ctx.moveTo(-size * 1.05, size * 0.10);
  ctx.lineTo(-size * 0.12, -size * 0.06);
  ctx.lineTo(size * 0.12, -size * 0.06);
  ctx.lineTo(size * 1.05, size * 0.10);
  ctx.lineTo(size * 0.98, size * 0.22);
  ctx.lineTo(-size * 0.98, size * 0.22);
  ctx.closePath();
  ctx.fill();
  // Wingtip lights.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-size * 1.02, size * 0.15, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4dff88';
  ctx.beginPath();
  ctx.arc(size * 1.02, size * 0.15, size * 0.045, 0, Math.PI * 2);
  ctx.fill();

  // Fuselage, tail at the bottom, nose at the top.
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.72);
  ctx.quadraticCurveTo(size * 0.16, -size * 0.30, size * 0.13, size * 0.28);
  ctx.quadraticCurveTo(size * 0.10, size * 0.52, 0, size * 0.56);
  ctx.quadraticCurveTo(-size * 0.10, size * 0.52, -size * 0.13, size * 0.28);
  ctx.quadraticCurveTo(-size * 0.16, -size * 0.30, 0, -size * 0.72);
  ctx.fill();
  ctx.strokeStyle = '#b8452f';
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.stroke();

  // Canopy glass.
  ctx.fillStyle = '#7fc4e8';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.34, size * 0.075, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.02, -size * 0.40, size * 0.025, size * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tailplane.
  ctx.fillStyle = '#c8442c';
  ctx.beginPath();
  ctx.moveTo(-size * 0.42, size * 0.42);
  ctx.lineTo(size * 0.42, size * 0.42);
  ctx.lineTo(size * 0.36, size * 0.54);
  ctx.lineTo(-size * 0.36, size * 0.54);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function drawWorld(ctx, state, world, rings, time) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const view = {
    width,
    height,
    cx: width / 2,
    cy: height / 2,
    focal: (height / 2) / Math.tan(FOV / 2),
  };
  const camera = cameraBasis(state);
  const horizonPoint = project(
    {
      x: camera.pos.x + camera.fwd.x * 4000,
      y: 0,
      z: camera.pos.z + camera.fwd.z * 4000,
    },
    camera,
    view,
  );
  const horizonY = horizonPoint ? horizonPoint.y : height * 0.42;

  skyGradient(ctx, view, horizonY);
  drawSun(ctx, camera, view);
  for (const cloud of world.clouds) drawCloud(ctx, cloud, camera, view, time);
  drawSea(ctx, view, horizonY);
  drawTerrain(ctx, camera, view, world.trees);
  drawRunway(ctx, camera, view);
  for (const building of world.buildings) drawBox(ctx, building, camera, view);

  // Rings, far to near so the near ones win the overlap.
  const ordered = rings
    .map((ring, index) => ({ ring, index, depth: Math.hypot(ring.x - state.x, ring.z - state.z) }))
    .sort((a, b) => b.depth - a.depth);
  for (const { ring, index } of ordered) {
    const isPassed = state.ringDone[index];
    const isNext = !isPassed && rings.findIndex((_, i) => !state.ringDone[i]) === index;
    drawRing(ctx, ring, isNext, isPassed, camera, view, time);
  }

  drawPlane(ctx, state, view, time);
  return { view, camera, horizonY };
}
