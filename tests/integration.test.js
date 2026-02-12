/**
 * Integration Tests — Omni-Dromenon Engine
 *
 * Tests cross-module integration: consensus + generator + scheduler working together.
 * Uses Node.js built-in test runner (node:test).
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { ConsensusEngine } = require('../src/server/consensus.js');
const { OSCBridge } = require('../src/server/osc-bridge.js');
const { generateSequence, applyRecursion, transpose, midiToNoteName } = require('../src/server/generator.js');
const { Scheduler } = require('../src/server/scheduler.js');

describe('Integration: Generator + Scheduler', () => {
  it('should generate a sequence and schedule it at tempo', () => {
    const sequence = generateSequence(8, 'pentatonic', 42);
    const scheduler = new Scheduler(120);

    sequence.forEach((note, i) => {
      scheduler.scheduleAtBeat(note, i + 1, 'eighth');
    });

    const schedule = scheduler.getSchedule();
    assert.equal(schedule.length, 8);
    assert.ok(scheduler.getTotalDuration() > 0);
  });

  it('should apply recursion then schedule the expanded sequence', () => {
    const base = generateSequence(4, 'minor', 7);
    const expanded = applyRecursion(base, 1);
    const scheduler = new Scheduler(140);

    expanded.forEach((note, i) => {
      scheduler.scheduleAtBeat(note, i + 1, 'sixteenth');
    });

    assert.equal(scheduler.getSchedule().length, 12); // 4 * 3
  });
});

describe('Integration: Consensus + OSC Bridge', () => {
  it('should pipe consensus state to OSC bridge', () => {
    const engine = new ConsensusEngine();
    const bridge = new OSCBridge({ port: 9999 });

    const now = Date.now();
    engine.recordInput('u1', { mood: 0.8, tempo: 0.3 }, now);
    engine.recordInput('u2', { mood: 0.6, tempo: 0.7 }, now);

    const consensus = engine.calculateConsensus(now);
    engine.applyConsensus(consensus);
    const state = engine.getState();

    bridge.connect();
    const bundle = bridge.sendBundle(state);

    assert.ok(bundle !== null);
    assert.ok(bundle.messages.length >= 4); // mood, tempo, intensity, density
  });
});

describe('Integration: Full pipeline', () => {
  it('should go from consensus to scheduled sequence to OSC output', () => {
    // 1. Consensus determines parameters
    const engine = new ConsensusEngine();
    const now = Date.now();
    engine.recordInput('u1', { mood: 0.9, tempo: 0.8, intensity: 0.7, density: 0.6 }, now);
    const consensus = engine.calculateConsensus(now);
    engine.applyConsensus(consensus);
    const state = engine.getState();

    // 2. Generator creates a sequence based on mood-derived scale choice
    const scaleName = state.mood > 0.5 ? 'major' : 'minor';
    const length = Math.floor(4 + state.density * 12);
    const sequence = generateSequence(length, scaleName, 123);

    // 3. Scheduler places notes in time based on tempo
    const bpm = Math.floor(60 + state.tempo * 120);
    const scheduler = new Scheduler(bpm);
    sequence.forEach((note, i) => {
      scheduler.scheduleAtBeat(note, i + 1, 'eighth');
    });

    // 4. OSC bridge formats output
    const bridge = new OSCBridge();
    bridge.connect();
    const schedule = scheduler.getSchedule();
    schedule.forEach((evt) => {
      bridge.send('note', evt.note);
    });

    assert.ok(bridge.messageCount > 0);
    assert.equal(bridge.messageCount, schedule.length);
  });
});
