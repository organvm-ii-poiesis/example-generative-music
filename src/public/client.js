/**
 * Omni-Dromenon Engine — Audience Client
 * 
 * Real-time audience participation interface with:
 * - Socket.io WebSocket connection
 * - Touch/gesture-based parameter control
 * - Tone.js audio synthesis responding to collective state
 * - Latency measurement and display
 * - Canvas-based audio visualization
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Connection
  SERVER_URL: window.location.origin,
  RECONNECT_DELAY: 1000,
  MAX_RECONNECT_ATTEMPTS: 10,
  
  // Input handling
  INPUT_THROTTLE_MS: 50,        // 20Hz max input rate
  INPUT_SMOOTHING: 0.3,         // Local smoothing factor
  
  // Audio
  DEFAULT_VOLUME: -12,          // dB
  AUDIO_ENABLED: true,
  
  // Visuals
  VISUALIZER_FPS: 30,
};

// =============================================================================
// STATE
// =============================================================================

const state = {
  connected: false,
  audioStarted: false,
  socket: null,
  
  // Local input values
  localValues: {
    mood: 0.5,
    tempo: 0.5,
    intensity: 0.5,
    density: 0.5,
  },
  
  // Collective state from server
  collectiveState: {
    mood: 0.5,
    tempo: 0.5,
    intensity: 0.5,
    density: 0.5,
    audienceCount: 0,
  },
  
  // Latency tracking
  latency: {
    samples: [],
    average: 0,
    p95: 0,
  },
};

// =============================================================================
// DOM ELEMENTS
// =============================================================================

const dom = {
  connectOverlay: document.getElementById('connection-overlay'),
  connectBtn: document.getElementById('connect-btn'),
  interface: document.getElementById('interface'),
  audienceCount: document.getElementById('audience-count'),
  latencyValue: document.getElementById('latency-value'),
  visualizer: document.getElementById('visualizer'),
  
  // Value displays
  moodValue: document.getElementById('mood-value'),
  tempoValue: document.getElementById('tempo-value'),
  intensityValue: document.getElementById('intensity-value'),
  densityValue: document.getElementById('density-value'),
  
  // Indicators
  moodIndicator: document.getElementById('mood-indicator'),
  tempoIndicator: document.getElementById('tempo-indicator'),
  intensityIndicator: document.getElementById('intensity-indicator'),
  densityIndicator: document.getElementById('density-indicator'),
  
  // Collective state bars
  collectiveMood: document.getElementById('collective-mood'),
  collectiveTempo: document.getElementById('collective-tempo'),
  collectiveIntensity: document.getElementById('collective-intensity'),
  collectiveDensity: document.getElementById('collective-density'),
};


// =============================================================================
// AUDIO ENGINE (Tone.js)
// =============================================================================

let synth = null;
let analyser = null;
let visualizerCtx = null;

async function initAudio() {
  await Tone.start();
  
  // Create polyphonic synth with effects
  synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle8' },
    envelope: {
      attack: 0.1,
      decay: 0.3,
      sustain: 0.4,
      release: 1.2,
    },
  }).toDestination();
  
  synth.volume.value = CONFIG.DEFAULT_VOLUME;
  
  // Create analyser for visualization
  analyser = new Tone.Analyser('waveform', 128);
  synth.connect(analyser);
  
  // Start generative sequence
  startGenerativeLoop();
  
  state.audioStarted = true;
  console.log('[Audio] Tone.js initialized');
}

// Generative music loop responding to collective state
let loopInterval = null;

function startGenerativeLoop() {
  // Scale definitions (mood affects scale selection)
  const scales = {
    dark: ['C3', 'Eb3', 'F3', 'G3', 'Bb3', 'C4', 'Eb4'],
    neutral: ['C3', 'D3', 'E3', 'G3', 'A3', 'C4', 'D4'],
    bright: ['C3', 'D3', 'E3', 'F#3', 'G3', 'A3', 'B3', 'C4'],
  };
  
  function getScale() {
    const mood = state.collectiveState.mood;
    if (mood < 0.33) return scales.dark;
    if (mood < 0.66) return scales.neutral;
    return scales.bright;
  }
  
  function playNote() {
    if (!synth || !state.audioStarted) return;
    
    const { tempo, intensity, density } = state.collectiveState;
    const scale = getScale();
    
    // Density determines how many notes to play
    const noteCount = Math.floor(1 + density * 3);
    
    // Play notes
    for (let i = 0; i < noteCount; i++) {
      const note = scale[Math.floor(Math.random() * scale.length)];
      const velocity = 0.3 + intensity * 0.5;
      const duration = 0.1 + (1 - tempo) * 0.4;
      
      synth.triggerAttackRelease(note, duration, undefined, velocity);
    }
    
    // Schedule next note based on tempo
    const interval = 150 + (1 - tempo) * 450; // 150-600ms
    clearTimeout(loopInterval);
    loopInterval = setTimeout(playNote, interval);
  }
  
  playNote();
}


// =============================================================================
// SOCKET.IO CONNECTION
// =============================================================================

function connectSocket() {
  state.socket = io(CONFIG.SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: CONFIG.RECONNECT_DELAY,
    reconnectionAttempts: CONFIG.MAX_RECONNECT_ATTEMPTS,
  });
  
  state.socket.on('connect', () => {
    console.log('[Socket] Connected:', state.socket.id);
    state.connected = true;
    updateConnectionUI(true);
  });
  
  state.socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    state.connected = false;
    updateConnectionUI(false);
  });
  
  // Handle state updates from server
  state.socket.on('state:update', (data) => {
    state.collectiveState = {
      mood: data.mood,
      tempo: data.tempo,
      intensity: data.intensity,
      density: data.density,
      audienceCount: data.audienceCount,
    };
    
    updateCollectiveDisplay();
  });
  
  // Handle input acknowledgment (for latency measurement)
  state.socket.on('input:ack', (data) => {
    if (data.timestamp) {
      const latency = Date.now() - data.timestamp;
      recordLatency(latency);
    }
  });
  
  state.socket.on('error', (err) => {
    console.error('[Socket] Error:', err);
  });
}

function recordLatency(ms) {
  state.latency.samples.push(ms);
  if (state.latency.samples.length > 100) {
    state.latency.samples.shift();
  }
  
  // Calculate average and P95
  const sorted = [...state.latency.samples].sort((a, b) => a - b);
  state.latency.average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  state.latency.p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  
  dom.latencyValue.textContent = Math.round(state.latency.average);
}

function sendInput(param, value) {
  if (!state.socket || !state.connected) return;
  
  const timestamp = Date.now();
  
  state.socket.emit('audience:input', {
    values: { [param]: value },
    timestamp,
  });
}


// =============================================================================
// TOUCH/GESTURE HANDLING
// =============================================================================

let inputThrottle = {};

function setupTouchControls() {
  const touchAreas = document.querySelectorAll('.touch-area');
  
  touchAreas.forEach(area => {
    const param = area.dataset.param;
    
    // Touch events
    area.addEventListener('touchstart', (e) => handleTouch(e, param), { passive: false });
    area.addEventListener('touchmove', (e) => handleTouch(e, param), { passive: false });
    
    // Mouse events (for desktop testing)
    area.addEventListener('mousedown', (e) => handleMouse(e, param));
    area.addEventListener('mousemove', (e) => {
      if (e.buttons === 1) handleMouse(e, param);
    });
  });
}

function handleTouch(e, param) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = e.target.getBoundingClientRect();
  const value = clamp((touch.clientX - rect.left) / rect.width, 0, 1);
  
  updateLocalValue(param, value);
}

function handleMouse(e, param) {
  const rect = e.target.getBoundingClientRect();
  const value = clamp((e.clientX - rect.left) / rect.width, 0, 1);
  
  updateLocalValue(param, value);
}

function updateLocalValue(param, value) {
  // Smooth local value
  state.localValues[param] = state.localValues[param] + 
    (value - state.localValues[param]) * CONFIG.INPUT_SMOOTHING;
  
  // Update UI immediately (responsive feedback)
  updateLocalDisplay(param);
  
  // Throttle network sends
  const now = Date.now();
  if (!inputThrottle[param] || now - inputThrottle[param] > CONFIG.INPUT_THROTTLE_MS) {
    inputThrottle[param] = now;
    sendInput(param, state.localValues[param]);
  }
}

// =============================================================================
// UI UPDATES
// =============================================================================

function updateLocalDisplay(param) {
  const value = state.localValues[param];
  const percent = Math.round(value * 100);
  
  // Update value text
  const valueEl = dom[`${param}Value`];
  if (valueEl) valueEl.textContent = `${percent}%`;
  
  // Update indicator position
  const indicator = dom[`${param}Indicator`];
  if (indicator) indicator.style.left = `${percent}%`;
}

function updateCollectiveDisplay() {
  // Update audience count
  dom.audienceCount.textContent = state.collectiveState.audienceCount;
  
  // Update collective state bars
  ['mood', 'tempo', 'intensity', 'density'].forEach(param => {
    const value = state.collectiveState[param];
    const bar = dom[`collective${capitalize(param)}`];
    if (bar) bar.style.height = `${value * 100}%`;
  });
}

function updateConnectionUI(connected) {
  const statusDot = document.querySelector('.status-dot');
  if (statusDot) {
    statusDot.classList.toggle('connected', connected);
    statusDot.classList.toggle('disconnected', !connected);
  }
}


// =============================================================================
// VISUALIZER
// =============================================================================

function initVisualizer() {
  visualizerCtx = dom.visualizer.getContext('2d');
  dom.visualizer.width = dom.visualizer.offsetWidth * 2;
  dom.visualizer.height = dom.visualizer.offsetHeight * 2;
  visualizerCtx.scale(2, 2);
  
  requestAnimationFrame(drawVisualizer);
}

function drawVisualizer() {
  if (!visualizerCtx || !analyser) {
    requestAnimationFrame(drawVisualizer);
    return;
  }
  
  const width = dom.visualizer.width / 2;
  const height = dom.visualizer.height / 2;
  
  // Clear canvas
  visualizerCtx.fillStyle = 'rgba(10, 10, 15, 0.3)';
  visualizerCtx.fillRect(0, 0, width, height);
  
  // Get waveform data
  const waveform = analyser.getValue();
  
  // Draw waveform
  visualizerCtx.beginPath();
  visualizerCtx.strokeStyle = getVisualizerColor();
  visualizerCtx.lineWidth = 2;
  
  const sliceWidth = width / waveform.length;
  let x = 0;
  
  for (let i = 0; i < waveform.length; i++) {
    const v = waveform[i] * 0.5 + 0.5;
    const y = v * height;
    
    if (i === 0) {
      visualizerCtx.moveTo(x, y);
    } else {
      visualizerCtx.lineTo(x, y);
    }
    
    x += sliceWidth;
  }
  
  visualizerCtx.stroke();
  
  requestAnimationFrame(drawVisualizer);
}

function getVisualizerColor() {
  const mood = state.collectiveState.mood;
  const intensity = state.collectiveState.intensity;
  
  // Mood affects hue (purple → blue → cyan → green → yellow)
  const hue = 270 + mood * 90;
  // Intensity affects saturation and lightness
  const sat = 50 + intensity * 30;
  const light = 50 + intensity * 20;
  
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

// =============================================================================
// UTILITIES
// =============================================================================

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function init() {
  console.log('[App] Initializing Omni-Dromenon Audience Interface');
  
  // Setup connect button
  dom.connectBtn.addEventListener('click', async () => {
    dom.connectBtn.querySelector('.btn-text').classList.add('hidden');
    dom.connectBtn.querySelector('.btn-loading').classList.remove('hidden');
    
    try {
      await initAudio();
      connectSocket();
      
      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        state.socket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      // Show interface
      dom.connectOverlay.classList.add('hidden');
      dom.interface.classList.remove('hidden');
      
      // Initialize UI
      setupTouchControls();
      initVisualizer();
      
      // Set initial values
      ['mood', 'tempo', 'intensity', 'density'].forEach(updateLocalDisplay);
      
    } catch (err) {
      console.error('[App] Connection failed:', err);
      dom.connectBtn.querySelector('.btn-text').textContent = 'Retry';
      dom.connectBtn.querySelector('.btn-text').classList.remove('hidden');
      dom.connectBtn.querySelector('.btn-loading').classList.add('hidden');
    }
  });
}

// Start on load
document.addEventListener('DOMContentLoaded', init);
