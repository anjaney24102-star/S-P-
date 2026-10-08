const { v4: uuidv4 } = require('uuid');

const buildEntityMention = ({ event_id, entity_id, original_text, confidence, resolution_method, id } = {}) => ({
  id: id || uuidv4(),
  event_id: String(event_id),
  entity_id: String(entity_id),
  original_text: String(original_text || ''),
  confidence: Number(confidence),
  resolution_method: String(resolution_method || 'unknown'),
  created_at: new Date().toISOString(),
});

module.exports = { buildEntityMention };
