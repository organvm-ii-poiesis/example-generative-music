/**
 * Music Generator — Scale Definitions & Recursive Sequence Generation
 *
 * Core generative engine for the Omni-Dromenon system. Converts abstract
 * consensus parameters into concrete MIDI note sequences using recursive
 * self-similar algorithms inspired by L-system grammars.
 *
 * All note values are expressed as MIDI note numbers (0–127).
 *
 * @module generator
 */

'use strict';

// =============================================================================
// SCALE DEFINITIONS (root at MIDI note 60 = Middle C)
// =============================================================================

/**
 * Scale interval maps. Each array contains semitone offsets from the root.
 */
const SCALES = {
  pentatonic:    [0, 2, 4, 7, 9],
  minor_pentatonic: [0, 3, 5, 7, 10],
  chromatic:     [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  whole_tone:    [0, 2, 4, 6, 8, 10],
  major:         [0, 2, 4, 5, 7, 9, 11],
  minor:         [0, 2, 3, 5, 7, 8, 10],
  dorian:        [0, 2, 3, 5, 7, 9, 10],
  mixolydian:    [0, 2, 4, 5, 7, 9, 10],
  blues:         [0, 3, 5, 6, 7, 10],
  harmonic_minor:[0, 2, 3, 5, 7, 8, 11],
};

/**
 * Get the list of available scale names.
 * @returns {string[]}
 */
function getScaleNames() {
  return Object.keys(SCALES);
}

/**
 * Look up a scale's intervals. Throws if the scale name is unknown.
 * @param {string} scaleName
 * @returns {number[]} Array of semitone offsets
 */
function getScale(scaleName) {
  const intervals = SCALES[scaleName];
  if (!intervals) {
    throw new Error(`Unknown scale: "${scaleName}". Available: ${getScaleNames().join(', ')}`);
  }
  return [...intervals];
}

// =============================================================================
// SEEDED PSEUDO-RANDOM NUMBER GENERATOR
// =============================================================================

/**
 * Simple seeded PRNG (mulberry32) for deterministic sequence generation.
 * @param {number} seed
 * @returns {function} A function that returns a float in [0, 1)
 */
function seededRandom(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// =============================================================================
// SEQUENCE GENERATION
// =============================================================================

/**
 * Generate a note sequence from a given scale.
 *
 * @param {number} length - Number of notes to generate (1–256)
 * @param {string} scaleName - Name of the scale (from SCALES)
 * @param {number} [seed=42] - PRNG seed for deterministic output
 * @param {number} [rootNote=60] - MIDI root note (default: Middle C)
 * @param {number} [octaveRange=2] - How many octaves to span above root
 * @returns {number[]} Array of MIDI note numbers
 */
function generateSequence(length, scaleName, seed, rootNote, octaveRange) {
  if (length < 1 || length > 256) {
    throw new Error(`Length must be 1–256, got ${length}`);
  }

  seed = seed !== undefined ? seed : 42;
  rootNote = rootNote !== undefined ? rootNote : 60;
  octaveRange = octaveRange !== undefined ? octaveRange : 2;

  const intervals = getScale(scaleName);
  const rand = seededRandom(seed);

  // Build the full note pool across the requested octave range
  const notePool = [];
  for (let octave = 0; octave < octaveRange; octave++) {
    for (const interval of intervals) {
      const note = rootNote + octave * 12 + interval;
      if (note >= 0 && note <= 127) {
        notePool.push(note);
      }
    }
  }

  if (notePool.length === 0) {
    throw new Error('No valid MIDI notes in range for given parameters');
  }

  const sequence = [];
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(rand() * notePool.length);
    sequence.push(notePool[idx]);
  }

  return sequence;
}

// =============================================================================
// RECURSIVE TRANSFORMATION
// =============================================================================

/**
 * Apply recursive self-similar expansion to a sequence.
 *
 * At each recursion level, every note in the sequence spawns a micro-motif
 * derived from the note's own interval relationships, then the motif replaces
 * the original note. The final sequence is flattened.
 *
 * @param {number[]} sequence - Input MIDI note sequence
 * @param {number} depth - Recursion depth (0 = identity, 1–4 recommended)
 * @returns {number[]} Expanded sequence
 */
function applyRecursion(sequence, depth) {
  if (depth < 0) throw new Error('Recursion depth must be >= 0');
  if (depth === 0) return [...sequence];

  let current = [...sequence];

  for (let d = 0; d < depth; d++) {
    const expanded = [];
    for (let i = 0; i < current.length; i++) {
      const note = current[i];
      // Derive a micro-motif: [note, note+interval_to_next, note]
      const next = current[(i + 1) % current.length];
      const interval = next - note;
      const midNote = clampMidi(note + Math.floor(interval / 2));
      expanded.push(note, midNote, note);
    }
    current = expanded;
  }

  return current;
}

// =============================================================================
// TRANSPOSITION
// =============================================================================

/**
 * Transpose a sequence by a number of semitones.
 * Notes that would fall outside MIDI range 0–127 are clamped.
 *
 * @param {number[]} sequence - Input MIDI note sequence
 * @param {number} semitones - Semitones to transpose (positive = up, negative = down)
 * @returns {number[]} Transposed sequence
 */
function transpose(sequence, semitones) {
  return sequence.map((note) => clampMidi(note + semitones));
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Clamp a value to valid MIDI note range (0–127).
 * @param {number} note
 * @returns {number}
 */
function clampMidi(note) {
  return Math.max(0, Math.min(127, Math.round(note)));
}

/**
 * Convert a MIDI note number to its note name (e.g. 60 → "C4").
 * @param {number} midi - MIDI note number
 * @returns {string}
 */
function midiToNoteName(midi) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const name = noteNames[midi % 12];
  return `${name}${octave}`;
}

module.exports = {
  SCALES,
  getScaleNames,
  getScale,
  generateSequence,
  applyRecursion,
  transpose,
  clampMidi,
  midiToNoteName,
  seededRandom,
};
