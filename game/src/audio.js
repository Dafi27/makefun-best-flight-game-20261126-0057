// Kestrel Run — every sound is synthesised in the browser with WebAudio:
// the prop engine's hum, the wind, the ring chime, the landing fanfare and
// the crash thud. No audio file is shipped, so the game stays offline.

export function createAudio() {
  return {
    context: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    muted: false,
    started: false,
  };
}

function ensureContext(audio) {
  if (audio.context) return audio.context;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = audio.muted ? 0 : 0.5;
  master.connect(context.destination);
  audio.context = context;
  audio.master = master;

  // The engine: two detuned sawtooths through a low-pass, pitched by the
  // throttle, plus a looped noise buffer for the wind.
  const engineOsc = context.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 55;
  const engineFilter = context.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 320;
  const engineGain = context.createGain();
  engineGain.gain.value = 0;
  engineOsc.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(master);
  engineOsc.start();
  audio.engineOsc = engineOsc;
  audio.engineGain = engineGain;

  const noiseLength = context.sampleRate * 2;
  const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseLength; i += 1) data[i] = Math.random() * 2 - 1;
  const windSource = context.createBufferSource();
  windSource.buffer = noiseBuffer;
  windSource.loop = true;
  const windFilter = context.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 500;
  windFilter.Q.value = 0.6;
  const windGain = context.createGain();
  windGain.gain.value = 0;
  windSource.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);
  windSource.start();
  audio.windGain = windGain;

  audio.started = true;
  return context;
}

export function startAudio(audio) {
  const context = ensureContext(audio);
  if (context && context.state === 'suspended') void context.resume();
}

export function setMuted(audio, muted) {
  audio.muted = muted;
  if (audio.master && audio.context) {
    audio.master.gain.setTargetAtTime(muted ? 0 : 0.5, audio.context.currentTime, 0.05);
  }
}

// Called every frame while flying: the engine follows the throttle, the wind
// follows the speed.
export function updateEngineSound(audio, throttle, speed, flying) {
  if (!audio.context || !audio.started) return;
  const now = audio.context.currentTime;
  const engineLevel = flying ? 0.05 + throttle * 0.11 : 0;
  audio.engineGain.gain.setTargetAtTime(engineLevel, now, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(48 + throttle * 70, now, 0.1);
  const windLevel = flying ? Math.min(0.16, speed * 0.0016) : 0;
  audio.windGain.gain.setTargetAtTime(windLevel, now, 0.15);
}

function tone(audio, frequency, startAt, duration, type, volume) {
  if (!audio.context) return;
  const osc = audio.context.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  const gain = audio.context.createGain();
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

export function playRingChime(audio) {
  if (!audio.context) return;
  const now = audio.context.currentTime;
  tone(audio, 880, now, 0.35, 'sine', 0.22);
  tone(audio, 1318.5, now + 0.09, 0.45, 'sine', 0.18);
}

export function playLandingFanfare(audio) {
  if (!audio.context) return;
  const now = audio.context.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((frequency, i) => tone(audio, frequency, now + i * 0.13, 0.5, 'triangle', 0.2));
}

export function playCrashThud(audio) {
  if (!audio.context) return;
  const now = audio.context.currentTime;
  tone(audio, 70, now, 0.5, 'sine', 0.5);
  tone(audio, 45, now + 0.05, 0.7, 'sine', 0.4);
}

export function playClick(audio) {
  if (!audio.context) return;
  tone(audio, 660, audio.context.currentTime, 0.08, 'square', 0.08);
}
