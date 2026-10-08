const buildEntityRiskBaseline = ({
  entity_id, baseline_risk = 0, average_event_rate = 0, average_negative_event_rate = 0,
  standard_deviation = 0, calculated_at = new Date().toISOString(), ...metrics
} = {}) => ({
  entity_id: String(entity_id),
  baseline_risk: Number(baseline_risk || 0),
  average_event_rate: Number(average_event_rate || 0),
  average_negative_event_rate: Number(average_negative_event_rate || 0),
  standard_deviation: Number(standard_deviation || 0),
  calculated_at,
  ...metrics,
});

module.exports = { buildEntityRiskBaseline };
