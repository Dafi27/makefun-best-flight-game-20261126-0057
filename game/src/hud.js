// Kestrel Run — the cockpit: the HUD (altitude, speed, heading, fuel,
// throttle, score, rings, timer), the lit instrument panel, the guide arrow
// to the next gate, and the title, crash, landing and pause screens.

import {
  COLOURS,
  PLANE,
  formatAltitude,
  formatHeading,
  formatSpeed,
  formatTime,
} from './config.js';
import { FLIGHT_CRASHED, FLIGHT_LANDED, FLIGHT_PAUSED, FLIGHT_TITLE, nextRing } from './flight.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 18, 26, 0.72)';
  ctx.strokeStyle = 'rgba(127, 227, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function text(ctx, value, x, y, size, colour, align = 'left', weight = '600') {
  ctx.fillStyle = colour;
  ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function bar(ctx, x, y, w, h, fraction, colour, label) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x, y, w * Math.max(0, Math.min(1, fraction)), h, h / 2);
  ctx.fill();
  if (label) text(ctx, label, x + w / 2, y + h / 2 + 0.5, 11, '#0a121a', 'center', '700');
}

// The artificial horizon: a lit ball that rolls with the wings and slides
// with the pitch.
function drawArtificialHorizon(ctx, state, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-state.roll);
  const pitchOffset = state.pitch * radius * 1.4;
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-radius, -radius - pitchOffset, radius * 2, radius);
  ctx.fillStyle = '#8a6b42';
  ctx.fillRect(-radius, -pitchOffset, radius * 2, radius + pitchOffset + radius);
  ctx.strokeStyle = '#eaf6ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, -pitchOffset);
  ctx.lineTo(radius, -pitchOffset);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = COLOURS.gaugeGlow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings: the plane's own mark never moves.
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.55, y);
  ctx.lineTo(x - radius * 0.15, y);
  ctx.moveTo(x + radius * 0.15, y);
  ctx.lineTo(x + radius * 0.55, y);
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'ATT', x, y + radius + 12, 10, COLOURS.hudDim, 'center');
}

// A round dial with a needle: airspeed and altitude.
function drawDial(ctx, x, y, radius, value, max, label, unit, warnAt) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 18, 26, 0.8)';
  ctx.fill();
  ctx.strokeStyle = COLOURS.gaugeGlow;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (let i = 0; i <= 10; i += 1) {
    const angle = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const inner = radius - (i % 5 === 0 ? 9 : 5);
    ctx.strokeStyle = 'rgba(234, 246, 255, 0.6)';
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    ctx.stroke();
  }
  const needle = Math.PI * 0.75 + (Math.max(0, Math.min(1, value / max))) * Math.PI * 1.5;
  const warn = warnAt !== undefined && value < warnAt;
  ctx.strokeStyle = warn ? COLOURS.hudDanger : '#ffd23e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(needle) * (radius - 8), y + Math.sin(needle) * (radius - 8));
  ctx.stroke();
  ctx.fillStyle = COLOURS.hudInk;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, label, x, y + radius + 12, 10, COLOURS.hudDim, 'center');
  text(ctx, unit, x, y + radius * 0.45, 11, warn ? COLOURS.hudDanger : COLOURS.hudInk, 'center', '700');
  ctx.restore();
}

function drawCompass(ctx, state, width) {
  const cx = width / 2;
  // The heading number sits inside the panel, under the tape, so nothing is
  // clipped by the top edge of the screen.
  panel(ctx, cx - 190, 8, 380, 52);
  const y = 30;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - 190, 8, 380, 52, 8);
  ctx.clip();
  const degrees = ((state.heading / (Math.PI / 180)) % 360 + 360) % 360;
  for (let offset = -60; offset <= 60; offset += 5) {
    const tick = Math.round((degrees + offset) / 5) * 5;
    const wrapped = ((tick % 360) + 360) % 360;
    const dx = (offset - (degrees - Math.round(degrees / 5) * 5)) * 2.4;
    const x = cx + dx;
    const major = wrapped % 30 === 0;
    const isCentre = offset === 0;
    ctx.strokeStyle = isCentre ? '#ffd23e' : major ? COLOURS.hudInk : 'rgba(234, 246, 255, 0.4)';
    ctx.lineWidth = major || isCentre ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + (major || isCentre ? 8 : 2));
    ctx.stroke();
    if (major) {
      const label = wrapped === 0 ? 'N' : wrapped === 90 ? 'E' : wrapped === 180 ? 'S' : wrapped === 270 ? 'W' : String(wrapped);
      text(ctx, label, x, y + 14, 10, COLOURS.hudDim, 'center');
    }
  }
  ctx.restore();
  text(ctx, formatHeading(state.heading), cx, 51, 13, COLOURS.hudInk, 'center', '700');
}

function drawGuideArrow(ctx, state, rings, view) {
  const target = nextRing(state, rings);
  const aim = target.ring
    ? { x: target.ring.x, y: target.ring.y, z: target.ring.z, label: `RING ${target.index + 1}` }
    : { x: 0, y: 12, z: 1750, label: 'SORA FIELD' };
  const dx = aim.x - state.x;
  const dz = aim.z - state.z;
  const distance = Math.hypot(dx, state.y - aim.y, dz);
  const bearing = Math.atan2(dx, dz);
  let relative = bearing - state.heading;
  while (relative > Math.PI) relative -= Math.PI * 2;
  while (relative < -Math.PI) relative += Math.PI * 2;
  const cx = view.width / 2;
  const cy = view.height * 0.30;
  const radius = 46;
  const ax = cx + Math.sin(relative) * radius;
  const ay = cy - Math.cos(relative) * radius;
  const onScreen = Math.abs(relative) < 0.5;
  ctx.save();
  ctx.globalAlpha = onScreen ? 0.95 : 0.6;
  ctx.strokeStyle = '#ffd23e';
  ctx.fillStyle = '#ffd23e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  const angle = Math.atan2(ay - cy, ax - cx);
  ctx.lineTo(ax - Math.cos(angle - 0.5) * 14, ay - Math.sin(angle - 0.5) * 14);
  ctx.lineTo(ax - Math.cos(angle + 0.5) * 14, ay - Math.sin(angle + 0.5) * 14);
  ctx.closePath();
  ctx.fill();
  text(ctx, `${aim.label}  ${Math.round(distance)} m`, cx, cy + 26, 13, COLOURS.hudInk, 'center', '700');
  ctx.restore();
}

export function drawHud(ctx, state, rings, time) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const stalled = state.speed < PLANE.stallSpeed && state.phase === 'flying';
  const lowFuel = state.fuel < 20;

  drawCompass(ctx, state, width);

  // Left: altitude, speed, vertical speed.
  panel(ctx, 14, 10, 172, 96);
  text(ctx, 'ALT', 26, 26, 11, COLOURS.hudDim);
  text(ctx, formatAltitude(state.y), 26, 48, 22, COLOURS.hudInk, 'left', '700');
  text(ctx, 'SPD', 26, 74, 11, COLOURS.hudDim);
  text(ctx, formatSpeed(state.speed), 26, 94, 20, stalled ? COLOURS.hudDanger : COLOURS.hudInk, 'left', '700');

  // Right: score, rings, time, fuel, throttle.
  panel(ctx, width - 196, 10, 182, 118);
  text(ctx, 'SCORE', width - 184, 26, 11, COLOURS.hudDim);
  text(ctx, String(state.score), width - 184, 48, 22, COLOURS.hudInk, 'left', '700');
  text(ctx, `RINGS ${state.ringsPassed}/${rings.length}`, width - 184, 74, 12, COLOURS.hudInk);
  text(ctx, formatTime(state.time), width - 24, 74, 12, COLOURS.hudInk, 'right');
  text(ctx, 'FUEL', width - 184, 94, 10, lowFuel ? COLOURS.hudDanger : COLOURS.hudDim);
  bar(ctx, width - 184, 100, 158, 10, state.fuel / PLANE.fuelCapacity, lowFuel ? COLOURS.hudDanger : '#59d867');
  text(ctx, 'THR', width - 184, 118, 10, COLOURS.hudDim);
  bar(ctx, width - 150, 114, 124, 8, state.throttle, '#7fe3ff');

  // The lit instrument panel along the bottom.
  const panelY = height - 108;
  ctx.fillStyle = 'rgba(16, 24, 34, 0.88)';
  ctx.fillRect(0, panelY, width, 108);
  ctx.fillStyle = COLOURS.panelEdge;
  ctx.fillRect(0, panelY, width, 2);
  const centreX = width / 2;
  drawArtificialHorizon(ctx, state, centreX - 190, panelY + 48, 34);
  drawDial(ctx, centreX, panelY + 48, 34, state.speed * 1.94384, 200, 'AIRSPEED', `${Math.round(state.speed * 1.94384)}`, PLANE.stallSpeed * 1.94384);
  drawDial(ctx, centreX + 190, panelY + 48, 34, state.y * 3.28084, 3000, 'ALTITUDE', `${Math.round(state.y * 3.28084)}`);
  text(ctx, 'W/S throttle · ←→ bank · ↑↓ pitch · A/D rudder · mouse steers · Space brake', 16, panelY + 96, 11, COLOURS.hudDim);

  drawGuideArrow(ctx, state, rings, { width, height });

  // Warnings and messages.
  if (stalled) {
    const blink = Math.floor(time * 4) % 2 === 0;
    if (blink) text(ctx, 'STALL — NOSE DOWN, FULL THROTTLE', width / 2, 84, 16, COLOURS.hudDanger, 'center', '700');
  } else if (lowFuel) {
    text(ctx, 'LOW FUEL — HEAD FOR SORA FIELD', width / 2, 84, 15, COLOURS.hudWarn, 'center', '700');
  }
  if (state.message && state.time < state.messageUntil) {
    text(ctx, state.message, width / 2, 116, 15, COLOURS.hudInk, 'center', '600');
  }
}

function overlay(ctx, lines) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  ctx.fillStyle = 'rgba(6, 12, 20, 0.55)';
  ctx.fillRect(0, 0, width, height);
  let y = height / 2 - (lines.length - 1) * 26;
  for (const line of lines) {
    text(ctx, line.value, width / 2, y, line.size, line.colour, 'center', line.weight || '600');
    y += line.size + 16;
  }
}

export function drawOverlay(ctx, state, rings, bestScore) {
  if (state.phase === FLIGHT_TITLE) {
    overlay(ctx, [
      { value: 'KESTREL RUN', size: 56, colour: '#ffd23e', weight: '800' },
      { value: 'Mail run over the Sora Archipelago', size: 20, colour: COLOURS.hudInk },
      { value: 'Fly through all 6 gold rings, then land on Sora Field', size: 16, colour: COLOURS.hudDim },
      { value: 'W/S throttle · Arrow keys pitch and bank · A/D rudder · mouse steers · Space brake', size: 14, colour: COLOURS.hudDim },
      { value: 'Press ENTER or click to fly', size: 18, colour: '#7fe3ff', weight: '700' },
      ...(bestScore > 0 ? [{ value: `Best score: ${bestScore}`, size: 14, colour: COLOURS.hudDim }] : []),
    ]);
  } else if (state.phase === FLIGHT_CRASHED) {
    overlay(ctx, [
      { value: 'DOWN', size: 48, colour: COLOURS.hudDanger, weight: '800' },
      { value: state.crashReason, size: 18, colour: COLOURS.hudInk },
      { value: `Score ${state.score} · Rings ${state.ringsPassed}/${rings.length}`, size: 16, colour: COLOURS.hudDim },
      { value: 'Press R to fly again', size: 18, colour: '#7fe3ff', weight: '700' },
    ]);
  } else if (state.phase === FLIGHT_LANDED) {
    overlay(ctx, [
      { value: 'DELIVERED', size: 48, colour: '#59d867', weight: '800' },
      { value: `Landed on Sora Field — landing bonus +${state.landedBonus} pts`, size: 18, colour: COLOURS.hudInk },
      { value: `Score ${state.score} · Rings ${state.ringsPassed}/${rings.length} · Time ${formatTime(state.time)}`, size: 16, colour: COLOURS.hudDim },
      { value: 'Press R to fly the mail run again', size: 18, colour: '#7fe3ff', weight: '700' },
    ]);
  } else if (state.phase === FLIGHT_PAUSED) {
    overlay(ctx, [
      { value: 'PAUSED', size: 44, colour: COLOURS.hudInk, weight: '800' },
      { value: 'Press P to keep flying', size: 18, colour: COLOURS.hudDim },
    ]);
  }
}
