/**
 * Scheduler — Temporal Event Management for Musical Sequences
 *
 * Manages BPM-locked timing for note events with quantization and subdivision
 * support. Designed for both real-time server-side scheduling and offline
 * sequence pre-computation.
 *
 * @module scheduler
 */

'use strict';

// =============================================================================
// SUBDIVISION CONSTANTS
// =============================================================================

/**
 * Subdivision multipliers relative to a single beat.
 * A beat at 120 BPM = 500ms. A sixteenth note = 500 / 4 = 125ms.
 */
const SUBDIVISIONS = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
  triplet_quarter: 2 / 3,
  triplet_eighth: 1 / 3,
  dotted_quarter: 1.5,
  dotted_eighth: 0.75,
};

// =============================================================================
// SCHEDULER CLASS
// =============================================================================

class Scheduler {
  /**
   * @param {number} [bpm=120] - Initial beats per minute
   */
  constructor(bpm) {
    this._bpm = 120;
    this._beatDurationMs = 500;
    this._scheduledNotes = [];
    this._nextBeatIndex = 0;
    this._startTime = null;

    if (bpm !== undefined) {
      this.setBPM(bpm);
    }
  }

  // ---------------------------------------------------------------------------
  // BPM Control
  // ---------------------------------------------------------------------------

  /**
   * Set the tempo in beats per minute.
   * @param {number} bpm - Beats per minute (20–300)
   * @throws {Error} If BPM is out of valid range
   */
  setBPM(bpm) {
    if (typeof bpm !== 'number' || bpm < 20 || bpm > 300) {
      throw new Error(`BPM must be between 20 and 300, got ${bpm}`);
    }
    this._bpm = bpm;
    this._beatDurationMs = (60 / bpm) * 1000;
  }

  /**
   * Get the current BPM.
   * @returns {number}
   */
  getBPM() {
    return this._bpm;
  }

  /**
   * Get the duration of a single beat in milliseconds.
   * @returns {number}
   */
  getBeatDuration() {
    return this._beatDurationMs;
  }

  /**
   * Get the duration of a specific subdivision in milliseconds.
   * @param {string} subdivision - One of the SUBDIVISIONS keys
   * @returns {number}
   */
  getSubdivisionDuration(subdivision) {
    const multiplier = SUBDIVISIONS[subdivision];
    if (multiplier === undefined) {
      throw new Error(
        `Unknown subdivision: "${subdivision}". Available: ${Object.keys(SUBDIVISIONS).join(', ')}`
      );
    }
    return this._beatDurationMs * multiplier;
  }

  // ---------------------------------------------------------------------------
  // Note Scheduling
  // ---------------------------------------------------------------------------

  /**
   * Schedule a note to be played at a specific time offset (in ms from start).
   * @param {number} note - MIDI note number
   * @param {number} time - Time in milliseconds from the start of the sequence
   * @param {number} [duration] - Note duration in ms; defaults to one beat
   * @param {number} [velocity=100] - MIDI velocity (0–127)
   * @returns {object} The scheduled note event
   */
  scheduleNote(note, time, duration, velocity) {
    if (typeof note !== 'number' || note < 0 || note > 127) {
      throw new Error(`Invalid MIDI note: ${note}`);
    }
    if (typeof time !== 'number' || time < 0) {
      throw new Error(`Time must be a non-negative number, got ${time}`);
    }

    const event = {
      note,
      time,
      duration: duration !== undefined ? duration : this._beatDurationMs,
      velocity: velocity !== undefined ? velocity : 100,
    };

    this._scheduledNotes.push(event);
    // Keep sorted by time
    this._scheduledNotes.sort((a, b) => a.time - b.time);

    return event;
  }

  /**
   * Schedule a note at a specific beat number (1-indexed).
   * @param {number} note - MIDI note number
   * @param {number} beat - Beat number (1-indexed)
   * @param {string} [subdivision="quarter"] - Subdivision for duration
   * @param {number} [velocity=100]
   * @returns {object} The scheduled note event
   */
  scheduleAtBeat(note, beat, subdivision, velocity) {
    const time = (beat - 1) * this._beatDurationMs;
    const sub = subdivision || 'quarter';
    const duration = this.getSubdivisionDuration(sub);
    return this.scheduleNote(note, time, duration, velocity);
  }

  // ---------------------------------------------------------------------------
  // Beat Navigation
  // ---------------------------------------------------------------------------

  /**
   * Get the time of the next beat relative to the start.
   * @returns {number} Time in ms
   */
  getNextBeat() {
    const time = this._nextBeatIndex * this._beatDurationMs;
    this._nextBeatIndex++;
    return time;
  }

  /**
   * Reset the beat counter.
   */
  resetBeatCounter() {
    this._nextBeatIndex = 0;
  }

  /**
   * Get the beat number for a given time offset.
   * @param {number} timeMs - Time in milliseconds
   * @returns {number} Beat number (0-indexed)
   */
  getBeatAt(timeMs) {
    return Math.floor(timeMs / this._beatDurationMs);
  }

  // ---------------------------------------------------------------------------
  // Quantization
  // ---------------------------------------------------------------------------

  /**
   * Quantize a time value to the nearest subdivision grid line.
   * @param {number} time - Time in milliseconds to quantize
   * @param {string} [subdivision="quarter"] - Grid resolution
   * @returns {number} Quantized time in milliseconds
   */
  quantize(time, subdivision) {
    const sub = subdivision || 'quarter';
    const gridSize = this.getSubdivisionDuration(sub);
    return Math.round(time / gridSize) * gridSize;
  }

  /**
   * Quantize all scheduled notes to a grid.
   * @param {string} [subdivision="quarter"]
   * @returns {object[]} The quantized schedule
   */
  quantizeAll(subdivision) {
    this._scheduledNotes = this._scheduledNotes.map((event) => ({
      ...event,
      time: this.quantize(event.time, subdivision),
    }));
    this._scheduledNotes.sort((a, b) => a.time - b.time);
    return this.getSchedule();
  }

  // ---------------------------------------------------------------------------
  // Schedule Access
  // ---------------------------------------------------------------------------

  /**
   * Get all scheduled notes.
   * @returns {object[]}
   */
  getSchedule() {
    return [...this._scheduledNotes];
  }

  /**
   * Get notes within a time window.
   * @param {number} startMs - Window start
   * @param {number} endMs - Window end
   * @returns {object[]}
   */
  getNotesInRange(startMs, endMs) {
    return this._scheduledNotes.filter(
      (e) => e.time >= startMs && e.time < endMs
    );
  }

  /**
   * Get the total duration of the scheduled sequence.
   * @returns {number} Duration in ms
   */
  getTotalDuration() {
    if (this._scheduledNotes.length === 0) return 0;
    const last = this._scheduledNotes[this._scheduledNotes.length - 1];
    return last.time + last.duration;
  }

  /**
   * Clear all scheduled notes.
   */
  clear() {
    this._scheduledNotes = [];
    this._nextBeatIndex = 0;
  }
}

module.exports = { Scheduler, SUBDIVISIONS };
