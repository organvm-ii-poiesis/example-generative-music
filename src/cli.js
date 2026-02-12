#!/usr/bin/env node

/**
 * Omni-Dromenon Engine — CLI Entry Point
 *
 * Commands:
 *   start     Start the Express/Socket.io server
 *   generate  Generate a note sequence and print it
 *   demo      Generate a demo MIDI-like output to console
 *
 * Usage:
 *   npx example-generative-music start
 *   npx example-generative-music generate --scale pentatonic --length 16
 *   npx example-generative-music demo
 */

'use strict';

const path = require('path');

// =============================================================================
// ARGUMENT PARSING
// =============================================================================

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name, defaultValue) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return defaultValue;
  return args[idx + 1];
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

// =============================================================================
// COMMANDS
// =============================================================================

/**
 * start — Launch the server.
 */
function cmdStart() {
  const port = getFlag('port', process.env.PORT || '3000');
  process.env.PORT = port;
  console.log(`Starting server on port ${port}...`);
  require(path.join(__dirname, 'server', 'index.js'));
}

/**
 * generate — Generate a note sequence and print it.
 */
function cmdGenerate() {
  const { generateSequence, midiToNoteName, getScaleNames } = require(
    path.join(__dirname, 'server', 'generator.js')
  );

  const scale = getFlag('scale', 'pentatonic');
  const length = parseInt(getFlag('length', '16'), 10);
  const seed = parseInt(getFlag('seed', '42'), 10);
  const root = parseInt(getFlag('root', '60'), 10);

  if (hasFlag('list-scales')) {
    console.log('Available scales:');
    getScaleNames().forEach((s) => console.log(`  ${s}`));
    process.exit(0);
  }

  console.log(`Generating ${length} notes in ${scale} (seed=${seed}, root=${root})`);
  console.log('');

  const sequence = generateSequence(length, scale, seed, root);

  const lines = sequence.map((midi, i) => {
    const name = midiToNoteName(midi);
    const bar = '\u2588'.repeat(Math.round(midi / 4));
    return `  ${String(i + 1).padStart(3)}. MIDI ${String(midi).padStart(3)}  ${name.padStart(4)}  ${bar}`;
  });

  console.log(lines.join('\n'));
  console.log('');
  console.log(`Total notes: ${sequence.length}`);
}

/**
 * demo — Generate a demo MIDI-like output with recursion and scheduling.
 */
function cmdDemo() {
  const { generateSequence, applyRecursion, transpose, midiToNoteName } = require(
    path.join(__dirname, 'server', 'generator.js')
  );
  const { Scheduler } = require(path.join(__dirname, 'server', 'scheduler.js'));

  console.log('=== Omni-Dromenon Engine — Demo Output ===');
  console.log('');

  // Generate base sequence
  const base = generateSequence(8, 'pentatonic', 42, 60, 2);
  console.log('1. Base sequence (pentatonic, 8 notes):');
  console.log('   ' + base.map(midiToNoteName).join(' '));
  console.log('');

  // Apply recursion
  const recursive = applyRecursion(base, 1);
  console.log(`2. After recursion depth=1 (${recursive.length} notes):`);
  console.log('   ' + recursive.map(midiToNoteName).join(' '));
  console.log('');

  // Transpose up a fifth
  const transposed = transpose(base, 7);
  console.log('3. Base transposed up a fifth (+7 semitones):');
  console.log('   ' + transposed.map(midiToNoteName).join(' '));
  console.log('');

  // Schedule into a timeline
  const scheduler = new Scheduler(120);
  base.forEach((note, i) => {
    scheduler.scheduleAtBeat(note, i + 1, 'eighth');
  });

  const schedule = scheduler.getSchedule();
  console.log(`4. Scheduled at 120 BPM (eighth notes):`);
  schedule.forEach((evt) => {
    const name = midiToNoteName(evt.note);
    const beatNum = (evt.time / scheduler.getBeatDuration() + 1).toFixed(2);
    console.log(
      `   Beat ${beatNum.padStart(5)}: ${name.padStart(4)} (MIDI ${evt.note}, dur=${evt.duration.toFixed(0)}ms)`
    );
  });

  console.log('');
  console.log(`Total sequence duration: ${scheduler.getTotalDuration().toFixed(0)}ms`);
  console.log('');
  console.log('Demo complete.');
}

// =============================================================================
// HELP
// =============================================================================

function showHelp() {
  console.log(`
Omni-Dromenon Engine — Generative Music CLI

Usage:
  example-generative-music <command> [options]

Commands:
  start                 Start the server
    --port <n>          Port number (default: 3000)

  generate              Generate a note sequence
    --scale <name>      Scale name (default: pentatonic)
    --length <n>        Number of notes (default: 16)
    --seed <n>          PRNG seed (default: 42)
    --root <n>          Root MIDI note (default: 60)
    --list-scales       List available scales

  demo                  Run a demo showing generation, recursion, scheduling

  help                  Show this help message
`);
}

// =============================================================================
// DISPATCH
// =============================================================================

switch (command) {
  case 'start':
    cmdStart();
    break;
  case 'generate':
    cmdGenerate();
    break;
  case 'demo':
    cmdDemo();
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    showHelp();
    break;
  default:
    console.error(`Unknown command: "${command}". Run with --help for usage.`);
    process.exit(1);
}
