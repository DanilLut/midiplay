import * as Tone from "tone";
import { Midi } from "@tonejs/midi";
import "/src/style.css";

// Declare external libraries for clarity (loaded from index.html)
const { htmlToImage } = window;
const { JSZip } = window;

let highlightColor = "#ff4dac";
let currentMidi = null;
let isPlaying = false;
let synth = null;

// White & Black notes
const whiteNotesLetters = ["C","D","E","F","G","A","B"];
const blackNotesMap = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };

function generateWhiteNotes(startOctave, octavesAmount) {
  const notes = [];
  for (let o = startOctave; o < startOctave + octavesAmount; o++) {
    whiteNotesLetters.forEach(letter => notes.push(letter + o));
  }
  return notes;
}

// Default ratios for linked sizes
let widthRatio, heightRatio;

// === Build Keyboard with optional labels ===
function buildKeyboard(whiteW, whiteH, blackW, blackH, showLabels=false, showCOnly=false, fontSize=12, startOctave=3, octavesAmount=5) {
  const whiteNotes = generateWhiteNotes(startOctave, octavesAmount);
  const svg = document.getElementById("keyboard");
  svg.innerHTML = "";

  let x = 0;
  const whitePositions = [];

  // Draw white keys
  whiteNotes.forEach(note => {
    const white = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    white.setAttribute("id", note);
    white.setAttribute("x", x);
    white.setAttribute("y", 0);
    white.setAttribute("width", whiteW);
    white.setAttribute("height", whiteH);
    white.setAttribute("fill", "#D9D9D9");
    svg.appendChild(white);
    whitePositions.push({ note, x });

    if (showLabels) {
      if (!showCOnly || (showCOnly && note.startsWith("C"))) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x + whiteW/2);
        text.setAttribute("y", whiteH - 7);
        text.setAttribute("fill", "#111111");
        text.setAttribute("font-size", fontSize);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("alignment-baseline", "middle");
        text.textContent = note;
        text.setAttribute("id", "label-" + note);
        svg.appendChild(text);
      }
    }
    x += whiteW + 2;
  });

  // Draw black keys on top
  whitePositions.forEach(({ note, x }) => {
    const letter = note[0];
    const octave = note[note.length - 1];
    if (blackNotesMap[letter]) {
      const blackId = blackNotesMap[letter] + octave;
      const black = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      black.setAttribute("id", blackId);
      black.setAttribute("x", x + whiteW - blackW/2);
      black.setAttribute("y", 0);
      black.setAttribute("width", blackW);
      black.setAttribute("height", blackH);
      black.setAttribute("fill", "#111111");
      svg.appendChild(black);

      if (showLabels && !showCOnly) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", x + whiteW - blackW/2 + blackW/2);
        text.setAttribute("y", blackH - 5);
        text.setAttribute("fill", "#D9D9D9");
        text.setAttribute("font-size", fontSize);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("alignment-baseline", "middle");
        text.textContent = blackNotesMap[letter] + octave;
        text.setAttribute("id", "label-" + blackId);
        svg.appendChild(text);
      }
    }
  });

  svg.setAttribute("width", x);
  svg.setAttribute("height", whiteH);
  svg.setAttribute("viewBox", `0 0 ${x} ${whiteH}`);
}

// === MIDI Loading and playback ===
async function loadMIDIFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  return new Midi(arrayBuffer);
}

async function playMIDI(midi) {
  await Tone.start();
  
  synth = new Tone.Sampler({
    urls: {
      A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", A1: "A1.mp3",
      C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", A2: "A2.mp3", C3: "C3.mp3",
      "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3",
      "F#4": "Fs4.mp3", A4: "A4.mp3", C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
      A5: "A5.mp3", C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3", A6: "A6.mp3",
      C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3", A7: "A7.mp3", C8: "C8.mp3"
    },
    baseUrl: "https://tonejs.github.io/audio/salamander/",
    release: 1,
  }).toDestination();

  await Tone.loaded();

  const activeNotes = new Set();
  const noteDisplay = document.getElementById("currentNote");
  function updateDisplay() {
    noteDisplay.textContent = activeNotes.size === 0 ? "None" : [...activeNotes].join(", ");
  }

  midi.tracks.forEach(track => {
    track.notes.forEach(note => {
      Tone.Transport.schedule(time => {
        synth.triggerAttack(note.name, time, note.velocity);
        activeNotes.add(note.name);
        updateDisplay();
        highlightKey(note.name);
      }, note.time);

      Tone.Transport.schedule(time => {
        synth.triggerRelease(note.name, time);
        activeNotes.delete(note.name);
        updateDisplay();
        resetKey(note.name);
      }, note.time + note.duration);
    });
  });

  Tone.Transport.start();
}

function stopMIDI() {
  Tone.Transport.stop();
  Tone.Transport.cancel();
  if (synth) {
    synth.releaseAll();
    synth.dispose();
    synth = null;
  }
  document.getElementById("currentNote").textContent = "None";
  resetAllKeys();
}

function highlightKey(noteName) {
  const key = document.getElementById(noteName);
  if (key) key.setAttribute("fill", highlightColor);
}

function resetKey(noteName) {
  const key = document.getElementById(noteName);
  if (!key) return;
  key.setAttribute("fill", key.id.includes("#") ? "#111111" : "#D9D9D9");
}

function resetAllKeys() {
  const startOctave = parseInt(document.getElementById("startingOctave").value);
  const octavesAmount = parseInt(document.getElementById("octavesAmount").value);

  const whiteNotesLetters = ["C","D","E","F","G","A","B"];
  const blackNotesMap = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };

  const currentWhiteNotes = [];
  for (let o = startOctave; o < startOctave + octavesAmount; o++) {
    whiteNotesLetters.forEach(letter => currentWhiteNotes.push(letter + o));
  }

  currentWhiteNotes.forEach(n => resetKey(n));

  currentWhiteNotes.forEach(note => {
    const letter = note[0];
    const octave = note[note.length - 1];
    if (blackNotesMap[letter]) {
      resetKey(blackNotesMap[letter] + octave);
    }
  });
}


// === Frame Generation Function ===
async function generateFrames(midi) {
  // **MODIFIED**: No longer need to select a specific container
  // const keyboardContainer = document.querySelector('.keyboard-container');
  const generateBtn = document.getElementById("generateBtn");
  const progressIndicator = document.getElementById("progressIndicator");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  // --- UI Setup ---
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";
  progressIndicator.style.display = 'block';
  progressBar.value = 0;
  progressText.textContent = '0%';

  const fps = parseInt(document.getElementById("frameRate").value);
  const frameInterval = 1 / fps;
  const totalDuration = midi.duration;
  const totalFrames = Math.ceil(totalDuration * fps);
  
  const zip = new JSZip();
  let frameCount = 0;

  stopMIDI();

  const visualEvents = [];
  midi.tracks.forEach(track => {
    track.notes.forEach(note => {
      visualEvents.push({ time: note.time, type: 'on', note: note.name });
      visualEvents.push({ time: note.time + note.duration, type: 'off', note: note.name });
    });
  });
  visualEvents.sort((a, b) => a.time - b.time);

  let eventIndex = 0;

  for (let i = 0; i < totalFrames; i++) {
    const currentTime = i * frameInterval;

    while (eventIndex < visualEvents.length && visualEvents[eventIndex].time <= currentTime) {
      const event = visualEvents[eventIndex];
      if (event.type === 'on') {
        highlightKey(event.note);
      } else {
        resetKey(event.note);
      }
      eventIndex++;
    }

    try {
      // **MODIFIED**: Capture the entire document (`<html>` element)
      // The options object with specific styles has been removed as it's not needed
      // for capturing the whole page.
      const dataUrl = await htmlToImage.toPng(document.documentElement);
      
      const frameNumber = String(i).padStart(5, '0');
      zip.file(`frame_${frameNumber}.png`, dataUrl.split(',')[1], { base64: true });

    } catch (error) {
      console.error('Failed to capture frame:', error);
      alert('An error occurred during frame generation. Check the console.');
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate Frames";
      progressIndicator.style.display = 'none';
      return;
    }
    
    frameCount++;
    const progress = (frameCount / totalFrames) * 100;
    progressBar.value = progress;
    progressText.textContent = `${Math.round(progress)}%`;
  }

  // --- Finalize and Download ---
  progressText.textContent = 'Zipping...';
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "midi-frames.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  // --- UI Cleanup ---
  generateBtn.disabled = false;
  generateBtn.textContent = "Generate Frames";
  progressIndicator.style.display = 'none';
  resetAllKeys();
}


// === UI Elements ===
const whiteWidthInput = document.getElementById("whiteWidth");
const whiteHeightInput = document.getElementById("whiteHeight");
const blackWidthInput = document.getElementById("blackWidth");
const blackHeightInput = document.getElementById("blackHeight");
const whiteWidthRange = document.getElementById("whiteWidthRange");
const whiteHeightRange = document.getElementById("whiteHeightRange");
const blackWidthRange = document.getElementById("blackWidthRange");
const blackHeightRange = document.getElementById("blackHeightRange");
const linkCheckbox = document.getElementById("linkSizes");
const showLabelsCheckbox = document.getElementById("showLabels");
const showCOnlyCheckbox = document.getElementById("showCOnlyLabels");
const labelFontSizeInput = document.getElementById("labelFontSize");

// Initialize ratios
widthRatio = blackWidthInput.value / whiteWidthInput.value;
heightRatio = blackHeightInput.value / whiteHeightInput.value;

// --- Sync inputs and ranges ---
function syncInputAndRange(input, range) {
  input.addEventListener("input", () => { range.value = input.value; updateKeyboard(); });
  range.addEventListener("input", () => { input.value = range.value; updateKeyboard(); });
}

// Apply sync
syncInputAndRange(whiteWidthInput, whiteWidthRange);
syncInputAndRange(whiteHeightInput, whiteHeightRange);
syncInputAndRange(blackWidthInput, blackWidthRange);
syncInputAndRange(blackHeightInput, blackHeightRange);

// Update highlight color in real time
const highlightColorInput = document.getElementById("highlightColor");

highlightColorInput.addEventListener("input", (e) => {
  highlightColor = e.target.value;
  const svg = document.getElementById("keyboard");
  svg.querySelectorAll("rect").forEach(key => {
    const isWhite = !key.id.includes("#");
    const defaultColor = isWhite ? "#D9D9D9" : "#111111";
    if (key.getAttribute("fill") !== defaultColor) {
      key.setAttribute("fill", highlightColor);
    }
  });
});

// --- Proportional linking ---
function updateLinkedSizes() {
  if (linkCheckbox.checked) {
    blackWidthInput.value = Math.round(whiteWidthInput.value * widthRatio);
    blackWidthRange.value = blackWidthInput.value;
    blackHeightInput.value = Math.round(whiteHeightInput.value * heightRatio);
    blackHeightRange.value = blackHeightInput.value;
  } else {
    widthRatio = blackWidthInput.value / whiteWidthInput.value;
    heightRatio = blackHeightInput.value / whiteHeightInput.value;
  }
}

// --- Update Keyboard layout live ---
function updateKeyboard() {
  updateLinkedSizes();
  buildKeyboard(
    parseInt(whiteWidthInput.value),
    parseInt(whiteHeightInput.value),
    parseInt(blackWidthInput.value),
    parseInt(blackHeightInput.value),
    showLabelsCheckbox.checked,
    showCOnlyCheckbox.checked,
    parseInt(labelFontSizeInput.value),
    parseInt(document.getElementById("startingOctave").value),
    parseInt(document.getElementById("octavesAmount").value)
  );
}

// Event listeners for UI updates
linkCheckbox.addEventListener("change", updateKeyboard);
labelFontSizeInput.addEventListener("input", updateKeyboard);
document.getElementById("startingOctave").addEventListener("input", updateKeyboard);
document.getElementById("octavesAmount").addEventListener("input", updateKeyboard);

showCOnlyCheckbox.disabled = !showLabelsCheckbox.checked;

showLabelsCheckbox.addEventListener("change", () => {
  showCOnlyCheckbox.disabled = !showLabelsCheckbox.checked;
  if (!showLabelsCheckbox.checked) {
    showCOnlyCheckbox.checked = false;
  }
  updateKeyboard();
});
showCOnlyCheckbox.addEventListener("change", updateKeyboard);

// --- MIDI play/stop ---
document.getElementById("playBtn").addEventListener("click", async () => {
  const playBtn = document.getElementById("playBtn");
  if (!currentMidi) {
    alert("Select a MIDI file first.");
    return;
  }

  if (isPlaying) {
    stopMIDI();
    isPlaying = false;
    playBtn.textContent = "Play MIDI";
  } else {
    stopMIDI(); 
    playBtn.textContent = "Loading...";
    playBtn.disabled = true;
    
    await playMIDI(currentMidi);
    
    isPlaying = true;
    playBtn.textContent = "Stop MIDI";
    playBtn.disabled = false;
  }
});

// --- Event listener for Generate Frames button ---
document.getElementById("generateBtn").addEventListener("click", () => {
  if (!currentMidi) {
    alert("Select a MIDI file first.");
    return;
  }
  generateFrames(currentMidi);
});


document.getElementById("midiFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) {
    if (isPlaying) stopMIDI();
    currentMidi = await loadMIDIFromFile(file);
    isPlaying = false;
    document.getElementById("playBtn").textContent = "Play MIDI";
  }
});

// --- Initial keyboard ---
updateKeyboard();