/**
 * Consensus Module — Weighted Audience Input Aggregation
 *
 * Implements a temporal-decay + consensus-proximity algorithm:
 *   - Recent inputs carry exponentially more weight (temporal decay)
 *   - Inputs closer to the current consensus carry more weight (proximity bonus)
 *   - Performer overrides bypass consensus entirely for targeted parameters
 *
 * Designed as a standalone, testable module extracted from the server.
 *
 * @module consensus
 */

'use strict';

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG = {
  INPUT_DECAY_WINDOW_MS: 5000,
  CONSENSUS_SMOOTHING: 0.15,
  BETA_TEMPORAL: 0.6,
  GAMMA_CONSENSUS: 0.4,
  PARAMETERS: ['mood', 'tempo', 'intensity', 'density'],
};

// =============================================================================
// CONSENSUS ENGINE CLASS
// =============================================================================

class ConsensusEngine {
  /**
   * @param {object} [config] - Override default configuration values
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.inputs = new Map();
    this.state = {};
    this.config.PARAMETERS.forEach((p) => {
      this.state[p] = 0.5;
    });
    this.overrides = { active: false };
    this.config.PARAMETERS.forEach((p) => {
      this.overrides[p] = null;
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Record an audience member's input.
   * @param {string} userId - Unique identifier for the audience member
   * @param {object} values - Parameter values, e.g. { mood: 0.7, tempo: 0.3 }
   * @param {number} [timestamp] - Optional timestamp; defaults to Date.now()
   */
  recordInput(userId, values, timestamp) {
    if (!userId || typeof values !== 'object') return;
    this.inputs.set(userId, {
      timestamp: timestamp || Date.now(),
      values,
    });
  }

  /**
   * Remove an audience member's input (e.g. on disconnect).
   * @param {string} userId
   */
  removeInput(userId) {
    this.inputs.delete(userId);
  }

  /**
   * Calculate the weighted consensus across all current inputs.
   * Returns null when no valid inputs exist.
   * @param {number} [now] - Current timestamp; defaults to Date.now()
   * @returns {object|null} Consensus values per parameter, or null
   */
  calculateConsensus(now) {
    now = now || Date.now();
    const inputList = Array.from(this.inputs.values());

    if (inputList.length === 0) return null;

    const result = {};
    let anyResult = false;

    this.config.PARAMETERS.forEach((param) => {
      let weightedSum = 0;
      let totalWeight = 0;

      inputList.forEach((input) => {
        if (input.values[param] === undefined) return;

        const age = now - input.timestamp;
        if (age > this.config.INPUT_DECAY_WINDOW_MS) return;

        // Temporal decay — exponential falloff
        const temporalWeight = Math.exp(
          (-age / this.config.INPUT_DECAY_WINDOW_MS) * this.config.BETA_TEMPORAL
        );

        // Consensus proximity — inputs near current state get a bonus
        const currentValue = this.state[param];
        const inputValue = input.values[param];
        const distance = Math.abs(inputValue - currentValue);
        const consensusWeight = 1 - distance * this.config.GAMMA_CONSENSUS;

        const finalWeight = temporalWeight * Math.max(0.1, consensusWeight);

        weightedSum += inputValue * finalWeight;
        totalWeight += finalWeight;
      });

      if (totalWeight > 0) {
        result[param] = weightedSum / totalWeight;
        anyResult = true;
      }
    });

    return anyResult ? result : null;
  }

  /**
   * Apply a consensus result to the internal state with smoothing.
   * Respects active performer overrides.
   * @param {object|null} consensus - Output from calculateConsensus()
   * @returns {object} The updated state
   */
  applyConsensus(consensus) {
    if (!consensus) return { ...this.state };

    Object.entries(consensus).forEach(([param, value]) => {
      // Skip if performer has an active override for this parameter
      if (this.overrides.active && this.overrides[param] !== null) {
        return;
      }

      const current = this.state[param];
      this.state[param] =
        current + (value - current) * this.config.CONSENSUS_SMOOTHING;
    });

    return { ...this.state };
  }

  /**
   * Set a performer override for a specific parameter.
   * @param {string} param - Parameter name
   * @param {number|null} value - Override value, or null to clear
   */
  setOverride(param, value) {
    if (!this.config.PARAMETERS.includes(param)) return;
    this.overrides[param] = value;
    if (value !== null) {
      this.overrides.active = true;
      this.state[param] = value;
    }
  }

  /**
   * Clear all performer overrides.
   */
  clearOverrides() {
    this.overrides.active = false;
    this.config.PARAMETERS.forEach((p) => {
      this.overrides[p] = null;
    });
  }

  /**
   * Remove inputs older than the decay window.
   * @param {number} [now] - Current timestamp; defaults to Date.now()
   * @returns {number} Number of pruned entries
   */
  pruneOldInputs(now) {
    now = now || Date.now();
    let pruned = 0;
    for (const [userId, input] of this.inputs.entries()) {
      if (now - input.timestamp > this.config.INPUT_DECAY_WINDOW_MS * 2) {
        this.inputs.delete(userId);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Get a snapshot of the current state.
   * @returns {object}
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get the number of active inputs.
   * @returns {number}
   */
  getInputCount() {
    return this.inputs.size;
  }

  /**
   * Reset engine to initial state.
   */
  reset() {
    this.inputs.clear();
    this.config.PARAMETERS.forEach((p) => {
      this.state[p] = 0.5;
    });
    this.clearOverrides();
  }
}

module.exports = { ConsensusEngine, DEFAULT_CONFIG };
