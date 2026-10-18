// GhostFour — Four-bar ghost note desk
// WorkinWithAI Audio Engine Rules compliant
// Samples pinned to soundfont-for-samplers@0.0.3 (not @main)

const SAMPLE_BASE = "https://cdn.jsdelivr.net/npm/soundfont-for-samplers@0.0.3/FluidR3_GM/";

const state = {
  bpm: 98,
  key: "A minor",
  bars: 4,
  recipe: "nylon",
  playing: false
};

const activeSources = [];
let audioCtx = null;
let masterGain = null;
let compressor = null;
let chairGains = {};
let nextStepTime = 0;
let step = 0;
let timerId = null;
let sampleBuffers = {};
let rawBuffers = {};
let playheadRaf = null;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

const instruments = {
  piano: "acoustic_grand_piano-mp3",
  upright: "acoustic_bass-mp3",
  nylon: "acoustic_guitar_nylon-mp3",
  trumpet: "trumpet-mp3",
  violin: "violin-mp3",
  kitKick: "synth_drum-mp3",
  kitSnare: "side_stick-mp3"
};

const noteMap = {
  "A minor": { roots: ["A2", "A3", "A4"], thirds: ["C3", "C4", "C5"], fifths: ["E3", "E4", "E5"] },
  "C major": { roots: ["C3", "C4", "C5"], thirds: ["E3", "E4", "E5"], fifths: ["G3", "G4", "G5"] },
  "G major": { roots: ["G2", "G3", "G4"], thirds: ["B2", "B3", "B4"], fifths: ["D3", "D4", "D5"] },
  "D minor": { roots: ["D3", "D4", "D5"], thirds: ["F3", "F4", "F5"], fifths: ["A3", "A4", "A5"] },
  "E minor": { roots: ["E3", "E4", "E5"], thirds: ["G3", "G4", "G5"], fifths: ["B3", "B4", "B5"] }
};

const neededNotes = ["C3", "E3", "G3", "A3", "C4", "E4", "G4", "A4", "C5", "B3", "D4", "F4", "A2"];

function noteToFile(note) {
  return note + ".mp3";
}

async function preloadSamples() {
  const status = document.getElementById("status");
  let loaded = 0;
  const total = Object.keys(instruments).length * neededNotes.length;
  for (const [name, folder] of Object.entries(instruments)) {
    for (const note of neededNotes) {
      const url = SAMPLE_BASE + folder + "/" + noteToFile(note);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("missing " + name + " " + note);
        const ab = await res.arrayBuffer();
        rawBuffers[name + "-" + note] = ab;
        if (audioCtx) {
          const audioBuf = await audioCtx.decodeAudioData(ab.slice(0));
          sampleBuffers[name + "-" + note] = audioBuf;
        }
        loaded++;
        status.textContent = `Seating chairs… ${loaded}/${total}`;
      } catch (e) {
        status.textContent = `Missing: ${name} ${note}`;
        console.error(e);
        return false;
      }
    }
  }
  status.textContent = "Chairs seated. Tap to start.";
  return true;
}

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.65;
  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 6;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.18;
  masterGain.connect(compressor);
  compressor.connect(audioCtx.destination);

  Object.keys(instruments).forEach(name => {
    const g = audioCtx.createGain();
    g.gain.value = 0.5;
    g.connect(masterGain);
    chairGains[name] = g;
  });
}

function getChordNotes(bar) {
  const map = noteMap[state.key] || noteMap["A minor"];
  return {
    root: map.roots[1],
    third: map.thirds[1],
    fifth: map.fifths[1],
    low: map.roots[0]
  };
}

function scheduleStep(stepIdx, time) {
  const stepDur = 60 / state.bpm / 4;
  const bar = Math.floor(stepIdx / 16) % state.bars;
  const notes = getChordNotes(bar);
  const recipe = state.recipe;

  // Main pocket
  if (stepIdx % 16 === 0) {
    playNote("piano", notes.root, time, stepDur * 12, 0.4);
    playNote("upright", notes.low, time, stepDur * 14, 0.45);
  }
  if (stepIdx % 8 === 4) {
    playNote("kitSnare", "C3", time, stepDur * 0.3, 0.4);
  }
  if (stepIdx % 4 === 0) {
    playNote("kitKick", "C3", time, stepDur * 0.35, 0.5);
  }

  // Ghost notes — quiet anticipations and fills
  if (recipe === "nylon" && (stepIdx % 16 === 15 || stepIdx % 16 === 7)) {
    playNote("nylon", notes.third, time, stepDur * 0.6, 0.18);
  }
  if (recipe === "piano" && stepIdx % 16 === 14) {
    playNote("piano", notes.fifth, time, stepDur * 0.8, 0.15);
  }
  if (recipe === "trumpet" && stepIdx % 16 === 15) {
    playNote("trumpet", notes.fifth, time, stepDur * 1.0, 0.2);
  }
  if (recipe === "kit" && (stepIdx % 16 === 14 || stepIdx % 16 === 15)) {
    playNote("kitSnare", "C3", time, stepDur * 0.2, 0.12);
  }
  // Always a light nylon ghost on the and-of-4
  if (stepIdx % 16 === 15) {
    playNote("nylon", notes.fifth, time, stepDur * 0.4, 0.12);
  }
}

function playNote(instr, note, time, duration, vel = 0.7) {
  const buf = sampleBuffers[instr + "-" + note];
  if (!buf || !audioCtx) return;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const g = audioCtx.createGain();
  const attack = 0.008;
  const release = Math.max(0.012, Math.min(0.06, duration * 0.2));
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vel, time + attack);
  g.gain.setValueAtTime(vel, time + Math.max(0, duration - release));
  g.gain.linearRampToValueAtTime(0, time + duration);
  const chair = chairGains[instr] || masterGain;
  src.connect(g);
  g.connect(chair);
  src.start(time);
  src.stop(time + duration + 0.02);
  activeSources.push(src);
  src.onended = () => {
    const i = activeSources.indexOf(src);
    if (i >= 0) activeSources.splice(i, 1);
  };
}

function scheduler() {
  if (!audioCtx) return;
  while (nextStepTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime);
    const stepDur = 60 / state.bpm / 4;
    nextStepTime += stepDur;
    step = (step + 1) % (state.bars * 16);
  }
}

function start() {
  if (!audioCtx) initAudio();
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (state.playing) return;
  state.playing = true;
  nextStepTime = audioCtx.currentTime + 0.1;
  step = 0;
  timerId = setInterval(scheduler, LOOKAHEAD_MS);
  document.getElementById("status").textContent = "Playing ghosts…";
  updatePlayhead();
}

function stop() {
  state.playing = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  activeSources.forEach(s => { try { s.stop(0); } catch(e){} });
  activeSources.length = 0;
  if (playheadRaf) cancelAnimationFrame(playheadRaf);
  document.getElementById("status").textContent = "Stopped.";
}

function updatePlayhead() {
  if (!state.playing || !audioCtx) return;
  const progress = ((audioCtx.currentTime - nextStepTime + (state.bars * 16 * 60 / state.bpm / 4)) % (state.bars * 4 * 60 / state.bpm)) / (state.bars * 4 * 60 / state.bpm);
  const el = document.querySelector(".playhead");
  if (el) el.style.setProperty("--w", Math.min(100, progress * 100) + "%");
  playheadRaf = requestAnimationFrame(updatePlayhead);
}

async function exportWAV() {
  document.getElementById("status").textContent = "Rendering exact-length WAV…";
  if (!audioCtx) initAudio();
  for (const key of Object.keys(rawBuffers)) {
    if (!sampleBuffers[key]) {
      sampleBuffers[key] = await audioCtx.decodeAudioData(rawBuffers[key].slice(0));
    }
  }
  const sampleRate = 48000;
  const bars = state.bars;
  const bpm = state.bpm;
  const lengthSamples = Math.round(bars * 4 * 60 / bpm * sampleRate);
  const offline = new OfflineAudioContext(2, lengthSamples + Math.round(sampleRate * 0.4), sampleRate);

  const offlineGains = {};
  Object.keys(instruments).forEach(name => {
    const g = offline.createGain();
    g.gain.value = 0.5;
    g.connect(offline.destination);
    offlineGains[name] = g;
  });

  let t = 0;
  for (let s = 0; s < bars * 16; s++) {
    const stepDur = 60 / bpm / 4;
    scheduleOfflineStep(offline, offlineGains, s, t, stepDur);
    t += stepDur;
  }

  const rendered = await offline.startRendering();
  let peak = 0;
  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    const data = rendered.getChannelData(ch);
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  }
  const gain = peak > 0 ? Math.min(1, Math.pow(10, -1 / 20) / peak) : 1;
  for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
    const data = rendered.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
  const tailSamples = Math.round(sampleRate * 0.25);
  const outLen = lengthSamples;
  const out = new AudioBuffer({ length: outLen, numberOfChannels: 2, sampleRate });
  for (let ch = 0; ch < 2; ch++) {
    const src = rendered.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < outLen; i++) dst[i] = src[i];
    for (let i = 0; i < tailSamples && i < outLen; i++) {
      dst[i] += src[outLen + i] * 0.4;
    }
  }
  const wav = audioBufferToWav(out, 24);
  const name = `ghostfour-recipe-${bpm}bpm-${state.key.replace(/ /g, "")}.wav`;
  downloadBlob(wav, name);
  document.getElementById("status").textContent = `Exported ${name} (${outLen} samples).`;
}

function scheduleOfflineStep(ctx, gains, stepIdx, time, stepDur) {
  const bar = Math.floor(stepIdx / 16) % state.bars;
  const notes = getChordNotes(bar);
  const recipe = state.recipe;
  if (stepIdx % 16 === 0) {
    scheduleOfflineNote(ctx, gains, "piano", notes.root, time, stepDur * 12, 0.4);
    scheduleOfflineNote(ctx, gains, "upright", notes.low, time, stepDur * 14, 0.45);
  }
  if (stepIdx % 8 === 4) {
    scheduleOfflineNote(ctx, gains, "kitSnare", "C3", time, stepDur * 0.3, 0.4);
  }
  if (stepIdx % 4 === 0) {
    scheduleOfflineNote(ctx, gains, "kitKick", "C3", time, stepDur * 0.35, 0.5);
  }
  if (recipe === "nylon" && (stepIdx % 16 === 15 || stepIdx % 16 === 7)) {
    scheduleOfflineNote(ctx, gains, "nylon", notes.third, time, stepDur * 0.6, 0.18);
  }
  if (recipe === "piano" && stepIdx % 16 === 14) {
    scheduleOfflineNote(ctx, gains, "piano", notes.fifth, time, stepDur * 0.8, 0.15);
  }
  if (recipe === "trumpet" && stepIdx % 16 === 15) {
    scheduleOfflineNote(ctx, gains, "trumpet", notes.fifth, time, stepDur * 1.0, 0.2);
  }
  if (recipe === "kit" && (stepIdx % 16 === 14 || stepIdx % 16 === 15)) {
    scheduleOfflineNote(ctx, gains, "kitSnare", "C3", time, stepDur * 0.2, 0.12);
  }
  if (stepIdx % 16 === 15) {
    scheduleOfflineNote(ctx, gains, "nylon", notes.fifth, time, stepDur * 0.4, 0.12);
  }
}

function scheduleOfflineNote(ctx, gains, instr, note, time, duration, vel) {
  const buf = sampleBuffers[instr + "-" + note];
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  const attack = 0.008;
  const release = Math.max(0.012, Math.min(0.06, duration * 0.2));
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vel, time + attack);
  g.gain.setValueAtTime(vel, time + Math.max(0, duration - release));
  g.gain.linearRampToValueAtTime(0, time + duration);
  src.connect(g);
  g.connect(gains[instr] || ctx.destination);
  src.start(time);
  src.stop(time + duration + 0.02);
}

function audioBufferToWav(buffer, bitDepth = 24) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  const writeString = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      if (bitDepth === 24) {
        const intSample = Math.round(sample * 0x7FFFFF);
        view.setUint8(offset, intSample & 0xFF);
        view.setUint8(offset + 1, (intSample >> 8) & 0xFF);
        view.setUint8(offset + 2, (intSample >> 16) & 0xFF);
        offset += 3;
      } else {
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportMIDI() {
  const name = `ghostfour-recipe-${state.bpm}bpm-${state.key.replace(/ /g, "")}.mid`;
  // Minimal MIDI with tempo
  const header = new Uint8Array([0x4D,0x54,0x68,0x64,0x00,0x00,0x00,0x06,0x00,0x01,0x00,0x01,0x01,0xE0]);
  const track = new Uint8Array([0x4D,0x54,0x72,0x6B,0x00,0x00,0x00,0x0B,0x00,0xFF,0x51,0x03,0x07,0xA1,0x20,0x00,0xFF,0x2F,0x00]);
  const mid = new Blob([header, track], { type: "audio/midi" });
  downloadBlob(mid, name);
  document.getElementById("status").textContent = "MIDI exported (tempo set).";
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});

document.body.addEventListener("pointerdown", async () => {
  initAudio();
  if (Object.keys(sampleBuffers).length === 0) {
    await preloadSamples();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}, { once: false });

document.getElementById("play").addEventListener("click", start);
document.getElementById("stop").addEventListener("click", stop);
document.getElementById("exportWav").addEventListener("click", exportWAV);
document.getElementById("exportMid").addEventListener("click", exportMIDI);

document.getElementById("bpm").addEventListener("change", e => {
  state.bpm = Math.max(60, Math.min(180, +e.target.value || 98));
  localStorage.setItem("ghostfour-bpm", state.bpm);
});
document.getElementById("key").addEventListener("change", e => {
  state.key = e.target.value;
  localStorage.setItem("ghostfour-key", state.key);
});
document.getElementById("recipe").addEventListener("change", e => {
  state.recipe = e.target.value;
  localStorage.setItem("ghostfour-recipe", state.recipe);
});

// Persist
const savedBpm = localStorage.getItem("ghostfour-bpm");
if (savedBpm) { state.bpm = +savedBpm; document.getElementById("bpm").value = savedBpm; }
const savedKey = localStorage.getItem("ghostfour-key");
if (savedKey) { state.key = savedKey; document.getElementById("key").value = savedKey; }
const savedRecipe = localStorage.getItem("ghostfour-recipe");
if (savedRecipe) { state.recipe = savedRecipe; document.getElementById("recipe").value = savedRecipe; }

document.getElementById("punch").textContent = `GhostFour punch list
Four bars of live ghost notes so the loop breathes.
Quiet anticipations on the and-of-4, light fills, no volume bump.
Export drops on grid at sample 0, exact length, tail folded.
Live changes apply next step. Stop silences immediately.
On iOS, silent switch mutes Web Audio.

Distinct from SpaceFour (air for slam), ArcEight (energy arc), RoomFour (room), PunchFour (hits).
GhostFour is the quiet notes that make the pocket finish.`;