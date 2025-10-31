/**
 * Minimal structured JSON logger for PowerPulse.
 * Exports: info, warn, error, metric
 * Uses console.log to keep dependencies minimal and compatible with CloudWatch.
 */
'use strict';

/**
 * Safely stringify objects for logging
 * @param {any} v
 */
function safeStringify(v) {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch (e) {
    return String(v);
  }
}

function buildRecord(level, payload) {
  const base = {
    timestamp: new Date().toISOString(),
    level,
  };
  if (typeof payload === 'string') base.message = payload;
  else if (payload && typeof payload === 'object') Object.assign(base, payload);
  else base.message = safeStringify(payload);
  return base;
}

module.exports = {
  /**
   * Log an info-level structured message
   * @param {Object|string} obj
   */
  info: (obj) => console.log(safeStringify(buildRecord('info', obj))),

  /**
   * Log a warning-level structured message
   * @param {Object|string} obj
   */
  warn: (obj) => console.warn(safeStringify(buildRecord('warn', obj))),

  /**
   * Log an error-level structured message
   * @param {Object|string} obj
   */
  error: (obj) => console.error(safeStringify(buildRecord('error', obj))),

  /**
   * Emit a metric-like structured log (name, value, attributes)
   * @param {string} name
   * @param {number} value
   * @param {Object} attrs
   */
  metric: (name, value, attrs = {}) => {
    const rec = buildRecord('metric', { metric: name, value, ...attrs });
    console.log(safeStringify(rec));
  }
};
