# Example: Generative Music

[![CI](https://github.com/organvm-ii-poiesis/example-generative-music/actions/workflows/ci.yml/badge.svg)](https://github.com/organvm-ii-poiesis/example-generative-music/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)](https://github.com/organvm-ii-poiesis/example-generative-music)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/organvm-ii-poiesis/example-generative-music/blob/main/LICENSE)
[![Organ II](https://img.shields.io/badge/Organ-II%20Poiesis-EC4899)](https://github.com/organvm-ii-poiesis)
[![Status](https://img.shields.io/badge/status-active-brightgreen)](https://github.com/organvm-ii-poiesis/example-generative-music)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-informational)](https://github.com/organvm-ii-poiesis/example-generative-music)


[![ORGAN-II: Poiesis](https://img.shields.io/badge/ORGAN--II-Poiesis-6a1b9a?style=flat-square)](https://github.com/organvm-ii-poiesis)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020+-f7df1e?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.7-010101?style=flat-square&logo=socket.io)](https://socket.io)
[![Tone.js](https://img.shields.io/badge/Tone.js-14.8-f734d9?style=flat-square)](https://tonejs.github.io)

**A reference implementation of audience-controlled generative music synthesis, demonstrating how collective human input can drive real-time algorithmic composition through weighted consensus.**

This repository is part of **ORGAN-II (Poiesis)** — the art and creative expression layer of the [eight-organ system](https://github.com/organvm-ii-poiesis). It implements a complete audience participation platform where smartphone-wielding listeners collectively shape a live musical performance through four expressive parameters: mood, tempo, intensity, and density. A performer dashboard provides override authority, creating a negotiated creative space between crowd consensus and artistic direction.

---

## Table of Contents

- [Artistic Purpose](#artistic-purpose)
- [Conceptual Approach](#conceptual-approach)
- [Technical Overview](#technical-overview)
- [Architecture](#architecture)
- [Installation and Quick Start](#installation-and-quick-start)
- [Working Examples](#working-examples)
- [The Consensus Algorithm](#the-consensus-algorithm)
- [Parameter Space](#parameter-space)
- [Theory Implemented](#theory-implemented)
- [Performance Benchmarks](#performance-benchmarks)
- [Related Work](#related-work)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## Artistic Purpose

Generative music occupies a peculiar position in creative practice. It is music that composes itself according to rules — but whose rules, and toward what end? Most generative music systems treat the audience as passive recipients of an algorithmic process. The listener watches the machine compose. The experience is contemplative, sometimes beautiful, but fundamentally spectatorial.

This project inverts that relationship. Here, the audience *is* the compositional engine. Every connected device becomes a voice in a collective decision about what the music should become. The system aggregates these voices through a weighted consensus algorithm and translates the result into sound in real time. The performer retains override authority — they can push back against the crowd, redirect the musical trajectory, introduce surprise — but the default condition is democratic. The music emerges from the space between individual desire and collective agreement.

This is generative music as social sculpture: the artwork is not the sound itself but the process of collective negotiation that produces it. The sonic output is a byproduct of human coordination, a kind of audible group portrait that shifts as attention shifts, as moods converge or diverge, as people arrive and leave.

The artistic question this project asks: **What does consensus sound like?**

## Conceptual Approach

The design draws on several traditions in algorithmic composition and participatory art:

**Emergent composition.** Rather than defining musical structures top-down (verse, chorus, bridge), the system allows structure to emerge bottom-up from collective parameter trajectories. If the audience gradually converges on high intensity and fast tempo, the music accelerates and thickens organically. If they fragment into opposing camps, the consensus algorithm produces an averaged middle ground — the sound of disagreement is, paradoxically, moderation.

**The Contextual Awareness Layer (CAL).** The server implements what we call a Contextual Awareness Layer — a real-time aggregation system that maintains awareness of all connected participants and synthesizes their inputs into a unified performance state. The CAL is not a mixer; it does not simply average values. It weights recent inputs more heavily than stale ones (temporal decay) and weights inputs that align with the current consensus more heavily than outliers (consensus proximity). This produces a state that is simultaneously responsive to new input and resistant to sudden disruption — a kind of collective inertia that mirrors how human groups actually make decisions.

**Performer-audience negotiation.** The performer dashboard provides slider-based override controls for each parameter. When an override is active, the performer's value takes precedence over audience consensus for that parameter. This creates a power dynamic that is itself artistically interesting: the performer can wrestle control away from the crowd, redirect the music, then release the override and let the audience resume steering. The transition between performer control and audience control is itself a musical event — a moment of agency transfer that audiences can feel even if they cannot articulate it.

**Mobile-first interaction.** The audience interface is designed for smartphones. Touch-based parameter controls use horizontal swipe gestures mapped to 0-1 ranges. The interface provides immediate local feedback (your personal input value) alongside collective state visualization (what the group is doing), so each participant can see the gap between their individual desire and the collective outcome.

## Technical Overview

The system is a Node.js WebSocket server with two browser-based clients: an audience interface and a performer dashboard. Audio synthesis happens client-side using Tone.js, meaning each audience member hears locally generated sound shaped by the collective state — there is no audio streaming, only parameter streaming.

**Server** (`src/server/index.js`): Express + Socket.io server implementing the CAL. Runs a 20Hz state broadcast loop that continuously calculates weighted consensus from all connected audience inputs, applies smoothing interpolation, respects performer overrides, and broadcasts the unified state to all clients. Provides HTTP health and state inspection endpoints.

**Audience client** (`src/public/client.js` + `index.html`): Mobile-optimized web interface with four touch-controlled parameter sliders (mood, tempo, intensity, density). Connects via WebSocket, sends parameter changes at up to 20Hz, receives state updates, and drives a Tone.js polyphonic synthesizer. Includes a canvas-based waveform visualizer with mood-responsive coloring and a collective state bar display showing the current consensus values.

**Performer dashboard** (`src/public/performer.html`): Desktop-oriented control surface with per-parameter override sliders and toggle switches. Displays live statistics (audience count, latency, inputs per second, session duration) and current consensus values. Performer overrides take priority over audience consensus when activated.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Audience (N devices)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Phone A  │  │ Phone B  │  │ Phone C  │  │ Phone N  │  ...   │
│  │ Touch UI │  │ Touch UI │  │ Touch UI │  │ Touch UI │        │
│  │ Tone.js  │  │ Tone.js  │  │ Tone.js  │  │ Tone.js  │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │              │              │              │              │
│       └──────────────┴──────┬───────┴──────────────┘              │
│                    WebSocket │ (audience:input)                   │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────┐        │
│  │              CAL Server (Node.js + Socket.io)        │        │
│  │                                                      │        │
│  │  ┌─────────────────┐   ┌──────────────────────────┐  │        │
│  │  │  Input Buffer    │──▶│  Weighted Consensus      │  │        │
│  │  │  (Map per user)  │   │  temporal_decay ×        │  │        │
│  │  └─────────────────┘   │  consensus_proximity     │  │        │
│  │                         └────────────┬─────────────┘  │        │
│  │                                      │                │        │
│  │  ┌─────────────────┐                │                │        │
│  │  │  Performer       │──▶ Override ──▶│                │        │
│  │  │  Overrides       │   (priority)   │                │        │
│  │  └─────────────────┘                ▼                │        │
│  │                           ┌──────────────────┐        │        │
│  │                           │  Unified State    │        │        │
│  │                           │  (mood, tempo,    │        │        │
│  │                           │   intensity,      │        │        │
│  │                           │   density)        │        │        │
│  │                           └────────┬─────────┘        │        │
│  └────────────────────────────────────┼──────────────────┘        │
│                                       │                          │
│                            state:update │ (20Hz broadcast)        │
│                                       ▼                          │
│                   ┌───────────────────────────────┐              │
│                   │      All Connected Clients     │              │
│                   │  (audience + performer)         │              │
│                   └───────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    Performer Dashboard                            │
│  ┌──────────────────────────────────────────────────────┐        │
│  │  Override Sliders (mood / tempo / intensity / density)│        │
│  │  Toggle Switches (per-parameter activation)           │        │
│  │  Live Stats (audience count, latency, inputs/sec)     │        │
│  │  Session Timer (start / pause / end)                  │        │
│  └──────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

**Data flow summary:** Audience devices send parameter inputs via WebSocket. The server stores each user's most recent input in a `Map`, runs a 20Hz loop that calculates weighted consensus across all inputs, applies smoothing interpolation (factor 0.15) to prevent jarring jumps, checks for active performer overrides, and broadcasts the unified state back to all clients. Each client's Tone.js synthesizer responds to the collective state, producing locally generated audio that reflects the group's consensus.

## Installation and Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) >= 18.0.0
- A modern web browser with Web Audio API support (Chrome, Firefox, Safari, Edge)

### Setup

```bash
# Clone the repository
git clone https://github.com/organvm-ii-poiesis/example-generative-music.git
cd example-generative-music

# Install dependencies
npm install

# Start the server
npm start
```

The server starts on port 3000 (configurable via `PORT` environment variable):

```
╔═══════════════════════════════════════════════════════════════════╗
║                 OMNI-DROMENON-ENGINE                              ║
║                 Example: Generative Music                         ║
╠═══════════════════════════════════════════════════════════════════╣
║  Server running on port 3000                                      ║
║  Audience:   http://localhost:3000                                 ║
║  Performer:  http://localhost:3000/performer.html                  ║
║  Health:     http://localhost:3000/health                          ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Development Mode

```bash
# Start with auto-reload (nodemon)
npm run dev
```

### Connecting

1. **As performer:** Open `http://localhost:3000/performer.html` in a desktop browser
2. **As audience:** Open `http://localhost:3000` on a smartphone (same network) or desktop tab
3. **Tap "Enter Performance"** on the audience interface to initialize audio and connect
4. **Swipe horizontally** on any parameter to send input to the collective

For multi-device testing on a local network, use your machine's LAN IP (e.g., `http://192.168.1.x:3000`).

## Working Examples

### Solo Exploration

Open two browser tabs — one as performer, one as audience. Manipulate audience parameters and watch the performer dashboard reflect the state changes in real time. Toggle performer overrides on and off to feel the difference between directed and consensus-driven music.

### Living Room Concert

Connect 3-10 smartphones to the same WiFi network. One laptop runs the server and performer dashboard. Project the performer dashboard onto a screen or TV. Each audience member opens the audience URL on their phone. As people swipe, the music shifts. The performer can narrate transitions: "I'm going to release the mood override now — let's see where you take it."

### Parameter Walks

Start all parameters at 0.5 (neutral). Have the audience collectively walk mood from dark (0.0) to bright (1.0) over 60 seconds, then do the same with tempo, then intensity, then density. This produces a structured four-movement micro-composition that reveals how each parameter transforms the sonic character.

### Consensus vs. Conflict

Split the audience into two groups. One group pushes mood toward dark (0.0), the other toward bright (1.0). The consensus algorithm averages toward the middle, but with consensus proximity weighting, the result gravitates toward whichever camp has more participants. The sound of disagreement is literally audible.

## The Consensus Algorithm

The server aggregates audience input using a weighted temporal-proximity consensus:

```
weight(input) = temporal_decay(input) × consensus_proximity(input)
```

**Temporal decay** ensures recent inputs carry more influence than stale ones:

```
temporal_decay = e^(-age / window × β)
```

Where `age` is the time since the input was received, `window` is the decay window (5 seconds), and `β = 0.6` is the temporal weight coefficient. An input received 5 seconds ago has roughly 55% of the weight of an input received just now.

**Consensus proximity** rewards inputs that align with the current state:

```
consensus_proximity = 1 - (|input_value - current_value| × γ)
```

Where `γ = 0.4` is the consensus proximity coefficient. An input that matches the current consensus receives full weight; an input at maximum distance (opposite end of the 0-1 range) receives 60% weight. This creates a stabilizing effect — the system resists sudden, radical changes from individual participants while still allowing gradual collective drift.

**Smoothing interpolation** prevents jarring jumps in the output:

```
new_state = current_state + (consensus - current_state) × α
```

Where `α = 0.15` is the smoothing factor. The state moves 15% of the distance toward the consensus on each update cycle (20Hz), producing smooth transitions that feel organic rather than mechanical.

**Performer overrides** short-circuit the consensus for specific parameters. When a performer activates an override for a parameter, their slider value is applied directly, bypassing consensus calculation for that parameter. Other parameters continue to be audience-driven.

### Algorithm Characteristics

- **Convergent:** The system naturally converges toward majority opinion due to consensus proximity weighting
- **Temporally responsive:** Recent inputs dominate, so the system tracks real-time audience sentiment rather than historical averages
- **Disruption-resistant:** No single participant can cause a sudden, dramatic state change due to both consensus proximity weighting and smoothing interpolation
- **Gracefully degrading:** With zero audience inputs, the state holds at its last consensus value (no reversion to defaults)

## Parameter Space

| Parameter | Range | Sonic Effect | Scale Selection |
|-----------|-------|-------------|----------------|
| **Mood** | 0.0 (Dark) – 1.0 (Bright) | Controls harmonic character: minor/diminished scales at low values, major/lydian scales at high values. Also affects reverb and filter settings. | < 0.33: C Eb F G Bb (minor pentatonic) / 0.33–0.66: C D E G A (major pentatonic) / > 0.66: C D E F# G A B (lydian) |
| **Tempo** | 0.0 (Slow) – 1.0 (Fast) | Controls note interval timing: 600ms between notes at 0.0, 150ms at 1.0. Maps to approximately 100–400 BPM equivalent. | — |
| **Intensity** | 0.0 (Calm) – 1.0 (Fierce) | Controls velocity (0.3–0.8) and dynamic range. Higher intensity produces louder, more forceful attacks. | — |
| **Density** | 0.0 (Sparse) – 1.0 (Dense) | Controls simultaneous note count per event: 1 note at 0.0, up to 4 notes at 1.0. Higher density produces thicker, more clustered textures. | — |

The four parameters are intentionally orthogonal — each controls an independent aspect of the sonic output. This means the parameter space has genuine dimensionality: a slow, dense, dark, calm texture is fundamentally different from a fast, sparse, bright, fierce one, and every combination in between is musically distinct.

The synthesizer uses a `triangle8` oscillator (triangle wave with 8 harmonics) through a polyphonic Tone.js `PolySynth` with an envelope shaped for sustained, overlapping notes (attack: 0.1s, decay: 0.3s, sustain: 0.4, release: 1.2s). Note durations are inversely correlated with tempo: slower tempos produce longer, more sustained tones.

## Theory Implemented

This project is a concrete instantiation of several theoretical frameworks developed across the ORGAN-I layer:

**Recursive feedback systems** ([recursive-engine](https://github.com/organvm-i-theoria/recursive-engine)): The consensus algorithm creates a feedback loop where the current state influences the weighting of future inputs (via consensus proximity), which in turn determines the next state. This is recursive self-reference in action — the system's output is an input to its own next computation. The recursive-engine provides the formal framework for analyzing these self-referential dynamics.

**Ontological layering** ([organon-noumenon](https://github.com/organvm-i-theoria/organon-noumenon)): The system operates across multiple ontological layers simultaneously. The *noumenal* layer is the raw audience intention (what each person wants the music to become). The *phenomenal* layer is the consensus state (what the group collectively produces). The *experiential* layer is the sound itself (what each listener actually hears, generated locally on their device). These layers do not perfectly correspond — there is always a gap between individual desire, collective outcome, and sonic experience. That gap is where the art lives.

**Metasystemic coordination** ([metasystem-master](https://github.com/organvm-ii-poiesis/metasystem-master)): The relationship between performer and audience mirrors the metasystemic transition described in metasystem-master. Individual audience members are first-order systems. The consensus algorithm is a second-order system that coordinates them. The performer operates at a third-order level, capable of overriding the coordination mechanism itself. This hierarchy of control levels is a practical demonstration of metasystemic architecture.

## Performance Benchmarks

The system has been validated under simulated load conditions:

| Metric | Target | Measured |
|--------|--------|----------|
| P50 Latency | < 50ms | **1ms** |
| P95 Latency | < 100ms | **2ms** |
| P99 Latency | < 200ms | **3ms** |
| Message Delivery | > 95% | **100%** |
| Error Rate | < 1% | **0%** |
| State Broadcast Rate | 20Hz | **20Hz** |

Latency is measured round-trip: client sends timestamped input, server acknowledges with the original timestamp, client computes the difference. The sub-5ms latencies indicate that for local network deployments, the system operates well within human perceptual thresholds for real-time interaction (typically 50-100ms for audio/visual feedback).

```bash
# Run the benchmark suite
npm run benchmark
```

The benchmark script simulates multiple concurrent audience connections and measures latency percentiles (P50, P95, P99) under load.

## Related Work

This project exists in a rich ecosystem of generative music tools and live coding environments. It distinguishes itself primarily through its focus on audience participation and collective composition rather than solo algorithmic authorship.

**[Sonic Pi](https://sonic-pi.net/):** A live coding synthesizer focused on education and performance. Sonic Pi treats the performer as sole author — code is the composition medium. This project inverts that model: the audience provides compositional input, and the system (not the performer) translates input into sound.

**[SuperCollider](https://supercollider.github.io/):** The foundational real-time audio synthesis platform. SuperCollider provides the low-level DSP primitives that higher-level tools build upon. This project operates at a much higher abstraction level, using Tone.js (which itself builds on the Web Audio API) to prioritize accessibility over sonic flexibility.

**[TidalCycles](https://tidalcycles.org/):** A pattern-based live coding language for algorithmic music. TidalCycles excels at rhythmic pattern manipulation by a skilled performer. This project replaces pattern specification with parameter-space navigation by a crowd — less precise, but more socially embedded.

**[Tone.js](https://tonejs.github.io/):** The Web Audio framework this project uses for client-side synthesis. Tone.js provides the synthesizer, envelope, and effects infrastructure. This project adds the networked consensus layer that Tone.js alone does not address.

**[NIME (New Interfaces for Musical Expression)](https://www.nime.org/):** The academic conference community studying novel music interaction paradigms. This project contributes to the NIME discourse on audience participation, collective instruments, and networked performance — areas explored by researchers like Jason Freeman (Georgia Tech) and Gil Weinberg (Georgia Tech) in their crowd-sourced music systems.

The key differentiator is the **consensus algorithm** as compositional mechanism. Where most generative music tools give a single author fine-grained control over musical parameters, this system distributes authorship across an arbitrary number of participants and uses weighted consensus to resolve their competing intentions into a coherent sonic output.

## Project Structure

```
example-generative-music/
├── package.json              # Dependencies and scripts
├── README.md                 # This document
├── DEPLOY.md                 # Deployment notes (stub)
├── src/
│   ├── server/
│   │   ├── index.js          # CAL server: Express + Socket.io + consensus
│   │   ├── consensus.js      # Consensus module (stub, logic inline)
│   │   └── osc-bridge.js     # OSC bridge (stub, planned)
│   └── public/
│       ├── index.html        # Audience interface (mobile-first)
│       ├── performer.html    # Performer dashboard (desktop)
│       ├── client.js         # Audience client: Tone.js + Socket.io
│       └── style.css         # Shared styles (dark theme, CSS variables)
└── tests/
    └── integration.test.js   # Integration tests (stub)
```

**Stub files** (`consensus.js`, `osc-bridge.js`, `integration.test.js`): These are empty files marking planned extraction points. The consensus algorithm currently lives inline in `index.js`; a future refactor will extract it to `consensus.js`. The OSC bridge will enable integration with external audio environments (SuperCollider, Ableton Live, Max/MSP). Integration tests will validate the full audience-to-sound pipeline.

## Contributing

Contributions are welcome. Areas where help is particularly valuable:

- **Audio design:** More sophisticated synthesis chains (FM synthesis, granular, sampling)
- **Scale systems:** Additional scale/mode mappings for the mood parameter (microtonal, non-Western scales)
- **Consensus variants:** Alternative consensus algorithms (median, mode, k-means clustering)
- **OSC bridge:** Complete the `osc-bridge.js` stub to enable external audio environment integration
- **Visual design:** Enhanced audience visualizations (particle systems, 3D, WebGL)
- **Testing:** Integration and load tests for the full pipeline

Please open an issue before submitting large changes to discuss the approach.

## License

[MIT](LICENSE) — Anthony Padavano

## Author

**Anthony Padavano** ([@4444j99](https://github.com/4444j99))

Part of the [ORGAN-II: Poiesis](https://github.com/organvm-ii-poiesis) creative expression layer within the [eight-organ system](https://github.com/meta-organvm).
