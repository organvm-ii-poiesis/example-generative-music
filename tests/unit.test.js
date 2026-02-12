/**
 * Unit Tests — Omni-Dromenon Engine
 *
 * Tests for: consensus.js, osc-bridge.js, generator.js, scheduler.js
 *
 * Uses Node.js built-in test runner (node:test) — zero external dependencies.
 * Run with: node --test tests/unit.test.js
 */

'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { ConsensusEngine, DEFAULT_CONFIG } = require('../src/server/consensus.js');
const { OSCBridge, BridgeState, formatMessage, formatBundle } = require('../src/server/osc-bridge.js');
const {
  SCALES,
  getScaleNames,
  getScale,
  generateSequence,
  applyRecursion,
  transpose,
  clampMidi,
  midiToNoteName,
  seededRandom,
} = require('../src/server/generator.js');
const { Scheduler, SUBDIVISIONS } = require('../src/server/scheduler.js');

// =============================================================================
// CONSENSUS ENGINE TESTS
// =============================================================================

describe('ConsensusEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new ConsensusEngine();
  });

  it('should initialize with default state values of 0.5', () => {
    const state = engine.getState();
    assert.equal(state.mood, 0.5);
    assert.equal(state.tempo, 0.5);
    assert.equal(state.intensity, 0.5);
    assert.equal(state.density, 0.5);
  });

  it('should accept custom configuration', () => {
    const custom = new ConsensusEngine({ CONSENSUS_SMOOTHING: 0.5 });
    assert.equal(custom.config.CONSENSUS_SMOOTHING, 0.5);
    // Defaults preserved for unspecified keys
    assert.equal(custom.config.BETA_TEMPORAL, DEFAULT_CONFIG.BETA_TEMPORAL);
  });

  it('should record and count inputs', () => {
    assert.equal(engine.getInputCount(), 0);
    engine.recordInput('user1', { mood: 0.8 });
    assert.equal(engine.getInputCount(), 1);
    engine.recordInput('user2', { mood: 0.3 });
    assert.equal(engine.getInputCount(), 2);
  });

  it('should overwrite input from the same user', () => {
    engine.recordInput('user1', { mood: 0.2 });
    engine.recordInput('user1', { mood: 0.9 });
    assert.equal(engine.getInputCount(), 1);
  });

  it('should reject invalid inputs gracefully', () => {
    engine.recordInput(null, { mood: 0.5 });
    engine.recordInput('user1', 'not-an-object');
    assert.equal(engine.getInputCount(), 0);
  });

  it('should remove a specific user input', () => {
    engine.recordInput('user1', { mood: 0.5 });
    engine.recordInput('user2', { mood: 0.5 });
    engine.removeInput('user1');
    assert.equal(engine.getInputCount(), 1);
  });

  it('should return null consensus with no inputs', () => {
    assert.equal(engine.calculateConsensus(), null);
  });

  it('should calculate consensus from a single input', () => {
    const now = Date.now();
    engine.recordInput('user1', { mood: 0.8, tempo: 0.3 }, now);
    const consensus = engine.calculateConsensus(now);
    assert.notEqual(consensus, null);
    assert.ok(consensus.mood > 0.5); // Should be pulled toward 0.8
    assert.ok(consensus.tempo < 0.5); // Should be pulled toward 0.3
  });

  it('should calculate consensus from multiple inputs', () => {
    const now = Date.now();
    engine.recordInput('user1', { mood: 0.9 }, now);
    engine.recordInput('user2', { mood: 0.1 }, now);
    const consensus = engine.calculateConsensus(now);
    assert.notEqual(consensus, null);
    // With equal timestamps and default config, result should be near midpoint
    assert.ok(consensus.mood > 0.2);
    assert.ok(consensus.mood < 0.8);
  });

  it('should apply temporal decay — recent inputs have more weight', () => {
    const now = Date.now();
    // Old input far from current state
    engine.recordInput('user_old', { mood: 0.0 }, now - 4000);
    // Recent input
    engine.recordInput('user_new', { mood: 1.0 }, now);
    const consensus = engine.calculateConsensus(now);
    // Recent input should dominate
    assert.ok(consensus.mood > 0.5);
  });

  it('should ignore inputs older than the decay window', () => {
    const now = Date.now();
    engine.recordInput('user1', { mood: 0.0 }, now - 6000); // Older than 5s window
    const consensus = engine.calculateConsensus(now);
    assert.equal(consensus, null);
  });

  it('should apply consensus with smoothing', () => {
    const now = Date.now();
    engine.recordInput('user1', { mood: 1.0 }, now);
    const consensus = engine.calculateConsensus(now);
    const updatedState = engine.applyConsensus(consensus);
    // With 0.15 smoothing from 0.5 toward ~1.0, should move slightly
    assert.ok(updatedState.mood > 0.5);
    assert.ok(updatedState.mood < 1.0);
  });

  it('should not modify state when consensus is null', () => {
    const before = engine.getState();
    engine.applyConsensus(null);
    const after = engine.getState();
    assert.deepEqual(before, after);
  });

  it('should respect performer overrides', () => {
    const now = Date.now();
    engine.setOverride('mood', 0.2);
    engine.recordInput('user1', { mood: 0.9 }, now);
    const consensus = engine.calculateConsensus(now);
    engine.applyConsensus(consensus);
    // Mood should stay at override value
    assert.equal(engine.getState().mood, 0.2);
  });

  it('should clear all overrides', () => {
    engine.setOverride('mood', 0.1);
    engine.setOverride('tempo', 0.9);
    engine.clearOverrides();
    assert.equal(engine.overrides.active, false);
    assert.equal(engine.overrides.mood, null);
    assert.equal(engine.overrides.tempo, null);
  });

  it('should ignore override for unknown parameter', () => {
    engine.setOverride('nonexistent', 0.5);
    assert.equal(engine.overrides.active, false);
  });

  it('should prune old inputs', () => {
    const now = Date.now();
    engine.recordInput('old_user', { mood: 0.5 }, now - 20000);
    engine.recordInput('new_user', { mood: 0.5 }, now);
    const pruned = engine.pruneOldInputs(now);
    assert.equal(pruned, 1);
    assert.equal(engine.getInputCount(), 1);
  });

  it('should fully reset', () => {
    engine.recordInput('user1', { mood: 0.9 });
    engine.setOverride('tempo', 0.1);
    engine.reset();
    assert.equal(engine.getInputCount(), 0);
    assert.equal(engine.getState().mood, 0.5);
    assert.equal(engine.overrides.active, false);
  });
});

// =============================================================================
// OSC BRIDGE TESTS
// =============================================================================

describe('OSC Bridge — formatMessage', () => {
  it('should format a float message', () => {
    const msg = formatMessage('/omni/mood', 0.75);
    assert.equal(msg.address, '/omni/mood');
    assert.equal(msg.typeTag, 'f');
    assert.equal(msg.value, 0.75);
    assert.ok(typeof msg.timestamp === 'number');
  });

  it('should format an integer message', () => {
    const msg = formatMessage('/omni/note', 60);
    assert.equal(msg.typeTag, 'i');
    assert.equal(msg.value, 60);
  });

  it('should format a string message', () => {
    const msg = formatMessage('/omni/scale', 'pentatonic');
    assert.equal(msg.typeTag, 's');
    assert.equal(msg.value, 'pentatonic');
  });

  it('should format a boolean true message', () => {
    const msg = formatMessage('/omni/active', true);
    assert.equal(msg.typeTag, 'T');
    assert.equal(msg.value, 1);
  });

  it('should format a boolean false message', () => {
    const msg = formatMessage('/omni/active', false);
    assert.equal(msg.typeTag, 'F');
    assert.equal(msg.value, 0);
  });

  it('should reject invalid OSC address', () => {
    assert.throws(() => formatMessage('no-slash', 1), /Invalid OSC address/);
  });

  it('should reject unsupported value types', () => {
    assert.throws(() => formatMessage('/test', [1, 2]), /Unsupported OSC value type/);
  });
});

describe('OSC Bridge — formatBundle', () => {
  it('should create a bundle from state', () => {
    const bundle = formatBundle({ mood: 0.5, tempo: 0.7 });
    assert.equal(bundle.messages.length, 2);
    assert.ok(bundle.timetag > 0);
  });

  it('should use custom prefix', () => {
    const bundle = formatBundle({ mood: 0.5 }, '/custom');
    assert.equal(bundle.messages[0].address, '/custom/mood');
  });

  it('should skip non-numeric values', () => {
    const bundle = formatBundle({ mood: 0.5, name: 'test' });
    assert.equal(bundle.messages.length, 1);
  });
});

describe('OSC Bridge — OSCBridge class', () => {
  let bridge;

  beforeEach(() => {
    bridge = new OSCBridge({ port: 9000 });
  });

  it('should start in DISCONNECTED state', () => {
    assert.equal(bridge.state, BridgeState.DISCONNECTED);
  });

  it('should connect successfully', () => {
    assert.ok(bridge.connect());
    assert.equal(bridge.state, BridgeState.CONNECTED);
  });

  it('should fail to connect with invalid port', () => {
    const bad = new OSCBridge({ port: -1 });
    assert.equal(bad.connect(), false);
    assert.equal(bad.state, BridgeState.ERROR);
  });

  it('should not send when disconnected', () => {
    const result = bridge.send('mood', 0.5);
    assert.equal(result, null);
  });

  it('should send messages when connected', () => {
    bridge.connect();
    const msg = bridge.send('mood', 0.5);
    assert.notEqual(msg, null);
    assert.equal(msg.address, '/omni/mood');
    assert.equal(bridge.messageCount, 1);
  });

  it('should send bundles when connected', () => {
    bridge.connect();
    const bundle = bridge.sendBundle({ mood: 0.5, tempo: 0.7 });
    assert.notEqual(bundle, null);
    assert.equal(bundle.messages.length, 2);
    assert.equal(bridge.messageCount, 2);
  });

  it('should invoke onSend callback', () => {
    const sent = [];
    const tracked = new OSCBridge({ onSend: (msg) => sent.push(msg) });
    tracked.connect();
    tracked.send('mood', 0.5);
    assert.equal(sent.length, 1);
  });

  it('should track recent messages', () => {
    bridge.connect();
    bridge.send('mood', 0.1);
    bridge.send('tempo', 0.9);
    const recent = bridge.getRecentMessages(5);
    assert.equal(recent.length, 2);
  });

  it('should report status correctly', () => {
    bridge.connect();
    const status = bridge.getStatus();
    assert.equal(status.state, 'CONNECTED');
    assert.equal(status.port, 9000);
    assert.equal(status.messageCount, 0);
  });

  it('should disconnect and clear log', () => {
    bridge.connect();
    bridge.send('mood', 0.5);
    bridge.disconnect();
    assert.equal(bridge.state, BridgeState.DISCONNECTED);
    assert.equal(bridge.getRecentMessages().length, 0);
  });
});

// =============================================================================
// GENERATOR TESTS
// =============================================================================

describe('Generator — Scales', () => {
  it('should list all available scales', () => {
    const names = getScaleNames();
    assert.ok(names.length >= 10);
    assert.ok(names.includes('pentatonic'));
    assert.ok(names.includes('chromatic'));
    assert.ok(names.includes('whole_tone'));
  });

  it('should return correct intervals for pentatonic', () => {
    const intervals = getScale('pentatonic');
    assert.deepEqual(intervals, [0, 2, 4, 7, 9]);
  });

  it('should throw for unknown scale', () => {
    assert.throws(() => getScale('nonexistent'), /Unknown scale/);
  });

  it('should return a copy, not the original array', () => {
    const a = getScale('major');
    a.push(999);
    const b = getScale('major');
    assert.ok(!b.includes(999));
  });
});

describe('Generator — generateSequence', () => {
  it('should generate a sequence of the requested length', () => {
    const seq = generateSequence(16, 'pentatonic');
    assert.equal(seq.length, 16);
  });

  it('should produce valid MIDI notes (0–127)', () => {
    const seq = generateSequence(100, 'chromatic', 1, 20, 3);
    seq.forEach((note) => {
      assert.ok(note >= 0 && note <= 127, `Note ${note} out of MIDI range`);
    });
  });

  it('should be deterministic with the same seed', () => {
    const a = generateSequence(10, 'major', 123);
    const b = generateSequence(10, 'major', 123);
    assert.deepEqual(a, b);
  });

  it('should produce different results with different seeds', () => {
    const a = generateSequence(10, 'major', 1);
    const b = generateSequence(10, 'major', 2);
    assert.notDeepEqual(a, b);
  });

  it('should throw for length < 1', () => {
    assert.throws(() => generateSequence(0, 'major'), /Length must be/);
  });

  it('should throw for length > 256', () => {
    assert.throws(() => generateSequence(300, 'major'), /Length must be/);
  });

  it('should respect custom root note', () => {
    const seq = generateSequence(20, 'pentatonic', 42, 48, 1);
    const minNote = Math.min(...seq);
    assert.ok(minNote >= 48);
  });
});

describe('Generator — applyRecursion', () => {
  it('should return identity at depth 0', () => {
    const seq = [60, 64, 67];
    assert.deepEqual(applyRecursion(seq, 0), seq);
  });

  it('should expand sequence at depth 1 (3x per note)', () => {
    const seq = [60, 64, 67];
    const result = applyRecursion(seq, 1);
    assert.equal(result.length, seq.length * 3);
  });

  it('should expand exponentially with depth', () => {
    const seq = [60, 64];
    const d1 = applyRecursion(seq, 1);
    const d2 = applyRecursion(seq, 2);
    assert.equal(d1.length, 6);   // 2 * 3
    assert.equal(d2.length, 18);  // 6 * 3
  });

  it('should produce valid MIDI notes', () => {
    const seq = [60, 72, 48];
    const result = applyRecursion(seq, 2);
    result.forEach((note) => {
      assert.ok(note >= 0 && note <= 127, `Note ${note} out of range`);
    });
  });

  it('should throw for negative depth', () => {
    assert.throws(() => applyRecursion([60], -1), /depth must be >= 0/);
  });
});

describe('Generator — transpose', () => {
  it('should transpose up by semitones', () => {
    const seq = [60, 64, 67];
    assert.deepEqual(transpose(seq, 7), [67, 71, 74]);
  });

  it('should transpose down by semitones', () => {
    assert.deepEqual(transpose([60, 64], -12), [48, 52]);
  });

  it('should clamp to MIDI range', () => {
    assert.deepEqual(transpose([125, 126, 127], 5), [127, 127, 127]);
    assert.deepEqual(transpose([2, 1, 0], -5), [0, 0, 0]);
  });
});

describe('Generator — utilities', () => {
  it('clampMidi should clamp values to 0–127', () => {
    assert.equal(clampMidi(-10), 0);
    assert.equal(clampMidi(200), 127);
    assert.equal(clampMidi(60), 60);
    assert.equal(clampMidi(60.7), 61);
  });

  it('midiToNoteName should convert correctly', () => {
    assert.equal(midiToNoteName(60), 'C4');
    assert.equal(midiToNoteName(69), 'A4');
    assert.equal(midiToNoteName(0), 'C-1');
    assert.equal(midiToNoteName(127), 'G9');
  });

  it('seededRandom should produce values in [0, 1)', () => {
    const rand = seededRandom(42);
    for (let i = 0; i < 100; i++) {
      const v = rand();
      assert.ok(v >= 0 && v < 1, `Value ${v} out of range`);
    }
  });

  it('seededRandom should be deterministic', () => {
    const a = seededRandom(99);
    const b = seededRandom(99);
    for (let i = 0; i < 10; i++) {
      assert.equal(a(), b());
    }
  });
});

// =============================================================================
// SCHEDULER TESTS
// =============================================================================

describe('Scheduler — BPM control', () => {
  it('should default to 120 BPM', () => {
    const s = new Scheduler();
    assert.equal(s.getBPM(), 120);
  });

  it('should accept custom BPM in constructor', () => {
    const s = new Scheduler(140);
    assert.equal(s.getBPM(), 140);
  });

  it('should calculate correct beat duration at 120 BPM', () => {
    const s = new Scheduler(120);
    assert.equal(s.getBeatDuration(), 500); // 60000/120 = 500ms
  });

  it('should calculate correct beat duration at 60 BPM', () => {
    const s = new Scheduler(60);
    assert.equal(s.getBeatDuration(), 1000);
  });

  it('should reject BPM below 20', () => {
    assert.throws(() => new Scheduler(10), /BPM must be between/);
  });

  it('should reject BPM above 300', () => {
    assert.throws(() => new Scheduler(400), /BPM must be between/);
  });

  it('should update BPM dynamically', () => {
    const s = new Scheduler(120);
    s.setBPM(90);
    assert.equal(s.getBPM(), 90);
    // 60000/90 = 666.67ms
    assert.ok(Math.abs(s.getBeatDuration() - 666.67) < 0.01);
  });
});

describe('Scheduler — subdivisions', () => {
  it('should calculate subdivision durations correctly at 120 BPM', () => {
    const s = new Scheduler(120);
    const beat = 500;
    assert.equal(s.getSubdivisionDuration('quarter'), beat);
    assert.equal(s.getSubdivisionDuration('eighth'), beat * 0.5);
    assert.equal(s.getSubdivisionDuration('sixteenth'), beat * 0.25);
    assert.equal(s.getSubdivisionDuration('whole'), beat * 4);
    assert.equal(s.getSubdivisionDuration('half'), beat * 2);
  });

  it('should throw for unknown subdivision', () => {
    const s = new Scheduler();
    assert.throws(() => s.getSubdivisionDuration('thirty_second'), /Unknown subdivision/);
  });

  it('should handle triplet subdivisions', () => {
    const s = new Scheduler(120);
    const triplet = s.getSubdivisionDuration('triplet_quarter');
    assert.ok(Math.abs(triplet - 500 * (2 / 3)) < 0.01);
  });
});

describe('Scheduler — note scheduling', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new Scheduler(120);
  });

  it('should schedule a note and retrieve it', () => {
    const evt = scheduler.scheduleNote(60, 0);
    assert.equal(evt.note, 60);
    assert.equal(evt.time, 0);
    assert.equal(evt.velocity, 100); // default
    assert.equal(scheduler.getSchedule().length, 1);
  });

  it('should keep schedule sorted by time', () => {
    scheduler.scheduleNote(60, 1000);
    scheduler.scheduleNote(64, 500);
    scheduler.scheduleNote(67, 0);
    const sched = scheduler.getSchedule();
    assert.equal(sched[0].time, 0);
    assert.equal(sched[1].time, 500);
    assert.equal(sched[2].time, 1000);
  });

  it('should schedule at a specific beat', () => {
    scheduler.scheduleAtBeat(60, 3); // Beat 3 = 1000ms at 120 BPM
    const sched = scheduler.getSchedule();
    assert.equal(sched[0].time, 1000);
  });

  it('should reject invalid MIDI note', () => {
    assert.throws(() => scheduler.scheduleNote(200, 0), /Invalid MIDI note/);
  });

  it('should reject negative time', () => {
    assert.throws(() => scheduler.scheduleNote(60, -100), /non-negative/);
  });
});

describe('Scheduler — beat navigation', () => {
  it('should return sequential beat times', () => {
    const s = new Scheduler(120);
    assert.equal(s.getNextBeat(), 0);
    assert.equal(s.getNextBeat(), 500);
    assert.equal(s.getNextBeat(), 1000);
  });

  it('should reset beat counter', () => {
    const s = new Scheduler(120);
    s.getNextBeat();
    s.getNextBeat();
    s.resetBeatCounter();
    assert.equal(s.getNextBeat(), 0);
  });

  it('should calculate beat number at a given time', () => {
    const s = new Scheduler(120);
    assert.equal(s.getBeatAt(0), 0);
    assert.equal(s.getBeatAt(500), 1);
    assert.equal(s.getBeatAt(750), 1);
    assert.equal(s.getBeatAt(1000), 2);
  });
});

describe('Scheduler — quantization', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new Scheduler(120);
  });

  it('should quantize to nearest quarter note', () => {
    // At 120 BPM, quarter = 500ms
    assert.equal(scheduler.quantize(230), 0);
    assert.equal(scheduler.quantize(260), 500);
    assert.equal(scheduler.quantize(510), 500);
    assert.equal(scheduler.quantize(740), 500);
    assert.equal(scheduler.quantize(760), 1000);
  });

  it('should quantize to eighth notes', () => {
    // Eighth = 250ms
    assert.equal(scheduler.quantize(120, 'eighth'), 0);
    assert.equal(scheduler.quantize(130, 'eighth'), 250);
    assert.equal(scheduler.quantize(375, 'eighth'), 500);
  });

  it('should quantize all scheduled notes', () => {
    scheduler.scheduleNote(60, 110);
    scheduler.scheduleNote(64, 510);
    scheduler.quantizeAll('quarter');
    const sched = scheduler.getSchedule();
    assert.equal(sched[0].time, 0);
    assert.equal(sched[1].time, 500);
  });
});

describe('Scheduler — schedule queries', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new Scheduler(120);
    scheduler.scheduleNote(60, 0);
    scheduler.scheduleNote(64, 500);
    scheduler.scheduleNote(67, 1000);
    scheduler.scheduleNote(72, 1500);
  });

  it('should get notes in a time range', () => {
    const notes = scheduler.getNotesInRange(400, 1100);
    assert.equal(notes.length, 2); // 500 and 1000
  });

  it('should calculate total duration', () => {
    // Last note at 1500 + default duration (500ms) = 2000
    assert.equal(scheduler.getTotalDuration(), 2000);
  });

  it('should clear all notes', () => {
    scheduler.clear();
    assert.equal(scheduler.getSchedule().length, 0);
    assert.equal(scheduler.getTotalDuration(), 0);
  });
});
