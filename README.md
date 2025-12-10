# Example: Generative Music

Reference implementation demonstrating audience-controlled generative music synthesis.

## Validated Performance

| Metric | Target | Actual |
|--------|--------|--------|
| P95 Latency | <100ms | **2ms** |
| Message Delivery | >95% | **100%** |
| Error Rate | <1% | **0%** |

## Quick Start

```bash
npm install
npm start

# Open in browser:
# Audience:   http://localhost:3000
# Performer:  http://localhost:3000/performer.html
```

## Architecture

```
┌──────────────────┐     WebSocket      ┌─────────────────┐
│  Audience (N)    │ ─────────────────► │   CAL Server    │
│  (smartphones)   │ ◄───────────────── │  (consensus)    │
└──────────────────┘     State Updates  └────────┬────────┘
                                                 │
┌──────────────────┐     WebSocket              │
│    Performer     │ ◄──────────────────────────┘
│   (dashboard)    │ ──────► Override
└──────────────────┘
```

## Parameters

| Parameter | Range | Effect |
|-----------|-------|--------|
| Mood | 0-1 | Dark ↔ Bright (filter, reverb) |
| Tempo | 0-1 | Slow ↔ Fast (BPM mapping) |
| Intensity | 0-1 | Calm ↔ Chaotic (dynamics, density) |
| Density | 0-1 | Sparse ↔ Dense (note count) |

## Consensus Algorithm

Uses weighted temporal-proximity consensus:

```
weight = temporal_decay × consensus_proximity
       = e^(-age/window × β) × (1 - distance × γ)
```

- `β` (temporal): 0.6 — Recent inputs weighted higher
- `γ` (consensus): 0.4 — Inputs near current state weighted higher

## Files

```
src/
├── server/
│   └── index.js          # CAL server + consensus
└── public/
    ├── index.html        # Audience interface
    ├── performer.html    # Performer dashboard
    ├── style.css         # Shared styles
    └── client.js         # Client-side audio (Tone.js)
```

## Benchmarking

```bash
npm run benchmark
```

Outputs latency percentiles (P50, P95, P99) under simulated load.

## License

MIT © Anthony Padavano
