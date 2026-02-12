/**
 * OSC Bridge — Open Sound Control Message Formatting & Lifecycle
 *
 * Provides an abstraction layer between the consensus engine and external
 * music hardware/software that speaks OSC (SuperCollider, Max/MSP, Ableton, etc.).
 *
 * In this reference implementation the bridge formats messages and maintains
 * a connection lifecycle, but does not open a real UDP socket — allowing the
 * module to be tested and used in environments without network access.
 *
 * @module osc-bridge
 */

'use strict';

// =============================================================================
// OSC MESSAGE FORMATTING
// =============================================================================

/**
 * Format a value into an OSC-compatible message object.
 * @param {string} address - OSC address pattern, e.g. "/omni/mood"
 * @param {number|string|boolean} value - The value to send
 * @returns {object} Formatted OSC message
 */
function formatMessage(address, value) {
  if (typeof address !== 'string' || !address.startsWith('/')) {
    throw new Error(`Invalid OSC address: "${address}" — must start with "/"`);
  }

  let typeTag;
  let oscValue = value;

  if (typeof value === 'number') {
    typeTag = Number.isInteger(value) ? 'i' : 'f';
  } else if (typeof value === 'string') {
    typeTag = 's';
  } else if (typeof value === 'boolean') {
    typeTag = value ? 'T' : 'F';
    oscValue = value ? 1 : 0;
  } else {
    throw new Error(`Unsupported OSC value type: ${typeof value}`);
  }

  return {
    address,
    typeTag,
    value: oscValue,
    timestamp: Date.now(),
  };
}

/**
 * Format a performance state object into a bundle of OSC messages.
 * @param {object} state - The current performance state (mood, tempo, etc.)
 * @param {string} [prefix="/omni"] - OSC address prefix
 * @returns {object} OSC bundle with timetag and messages array
 */
function formatBundle(state, prefix) {
  prefix = prefix || '/omni';
  const messages = [];

  for (const [param, value] of Object.entries(state)) {
    if (typeof value === 'number') {
      messages.push(formatMessage(`${prefix}/${param}`, value));
    }
  }

  return {
    timetag: Date.now(),
    messages,
  };
}

// =============================================================================
// OSC BRIDGE CLASS
// =============================================================================

/**
 * Lifecycle states for the bridge.
 */
const BridgeState = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  ERROR: 'ERROR',
};

class OSCBridge {
  /**
   * @param {object} [options]
   * @param {string} [options.host="127.0.0.1"] - Target host
   * @param {number} [options.port=57120] - Target port (SuperCollider default)
   * @param {string} [options.prefix="/omni"] - OSC address prefix
   * @param {function} [options.onSend] - Callback invoked with each formatted message
   */
  constructor(options = {}) {
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 57120;
    this.prefix = options.prefix || '/omni';
    this.onSend = options.onSend || null;

    this.state = BridgeState.DISCONNECTED;
    this.messageCount = 0;
    this.lastError = null;
    this.messageLog = [];
  }

  /**
   * Open the bridge connection. In this reference implementation, this is a
   * simulated lifecycle transition — no actual UDP socket is opened.
   * @returns {boolean} true if connection succeeds
   */
  connect() {
    if (this.state === BridgeState.CONNECTED) return true;

    this.state = BridgeState.CONNECTING;

    // Simulate connection validation
    if (!this.host || !this.port || this.port < 1 || this.port > 65535) {
      this.state = BridgeState.ERROR;
      this.lastError = new Error(`Invalid target: ${this.host}:${this.port}`);
      return false;
    }

    this.state = BridgeState.CONNECTED;
    return true;
  }

  /**
   * Close the bridge connection.
   */
  disconnect() {
    this.state = BridgeState.DISCONNECTED;
    this.messageLog = [];
  }

  /**
   * Send a single parameter update.
   * @param {string} param - Parameter name (e.g. "mood")
   * @param {number} value - Normalized value 0–1
   * @returns {object|null} The formatted message, or null if not connected
   */
  send(param, value) {
    if (this.state !== BridgeState.CONNECTED) return null;

    const msg = formatMessage(`${this.prefix}/${param}`, value);
    this.messageCount++;
    this.messageLog.push(msg);

    if (this.onSend) {
      this.onSend(msg);
    }

    return msg;
  }

  /**
   * Send a full state update as an OSC bundle.
   * @param {object} perfState - Performance state object
   * @returns {object|null} The formatted bundle, or null if not connected
   */
  sendBundle(perfState) {
    if (this.state !== BridgeState.CONNECTED) return null;

    const bundle = formatBundle(perfState, this.prefix);
    this.messageCount += bundle.messages.length;
    this.messageLog.push(...bundle.messages);

    if (this.onSend) {
      bundle.messages.forEach((msg) => this.onSend(msg));
    }

    return bundle;
  }

  /**
   * Get bridge status information.
   * @returns {object}
   */
  getStatus() {
    return {
      state: this.state,
      host: this.host,
      port: this.port,
      prefix: this.prefix,
      messageCount: this.messageCount,
      lastError: this.lastError ? this.lastError.message : null,
    };
  }

  /**
   * Get recent message log (last N messages).
   * @param {number} [count=10]
   * @returns {Array}
   */
  getRecentMessages(count) {
    count = count || 10;
    return this.messageLog.slice(-count);
  }
}

module.exports = { OSCBridge, BridgeState, formatMessage, formatBundle };
