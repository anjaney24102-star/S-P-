const { v4: uuidv4 } = require('uuid');

const ENTITY_TYPES = new Set(['company', 'organization', 'government', 'person', 'country', 'financial_instrument']);

const buildFinancialEntity = (input = {}) => {
  const now = new Date().toISOString();
  const entityType = String(input.entity_type || 'company').toLowerCase();
  if (!ENTITY_TYPES.has(entityType)) throw new Error(`Unsupported entity_type: ${entityType}`);
  const canonicalName = String(input.canonical_name || '').trim();
  if (!canonicalName) throw new Error('canonical_name is required.');
  return {
    id: input.id || uuidv4(),
    canonical_name: canonicalName,
    ticker: input.ticker ? String(input.ticker).trim().toUpperCase() : null,
    entity_type: entityType,
    sector: input.sector || null,
    industry: input.industry || null,
    country: input.country || null,
    aliases: [...new Set((input.aliases || []).map((alias) => String(alias).trim()).filter(Boolean))],
    metadata: { ...(input.metadata || {}) },
    created_at: input.created_at || now,
    updated_at: input.updated_at || now,
  };
};

module.exports = { buildFinancialEntity, ENTITY_TYPES };
