const { v4: uuidv4 } = require('uuid');

const buildEarlyWarningSignal = (input = {}) => ({
  id: input.id || uuidv4(),
  entity_id: input.entity_id || null,
  entity: input.entity || 'Unknown entity',
  warning_type: String(input.warning_type || 'UNUSUAL_RISK_ACTIVITY'),
  severity: String(input.severity || 'WATCH').toUpperCase(),
  baseline_value: Number(input.baseline_value || 0),
  current_value: Number(input.current_value || 0),
  deviation: Number(input.deviation || 0),
  confidence: Number(input.confidence || 0),
  detected_at: input.detected_at || new Date().toISOString(),
  explanation: String(input.explanation || ''),
  window: input.window || '6h',
  metadata: { ...(input.metadata || {}) },
});

module.exports = { buildEarlyWarningSignal };
