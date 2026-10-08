const normalizeEntityText = (value = '') => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
  .replace(/\b(the|shares?|stock|common stock|incorporated|inc|corporation|corp|company|co|limited|ltd|plc|llc|holdings?)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

const editSimilarity = (left, right) => {
  if (!left || !right) return 0;
  const a = [...left]; const b = [...right];
  let previous = [0, ...b.map((_, index) => index + 1)];
  for (let i = 0; i < a.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < b.length; j += 1) current[j + 1] = Math.min(current[j] + 1, previous[j + 1] + 1, previous[j] + (a[i] === b[j] ? 0 : 1));
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
};

class ExactAliasStrategy {
  constructor(repository) { this.repository = repository; }
  resolve(mention) {
    const raw = String(mention || '').trim(); const normalized = normalizeEntityText(raw);
    const ticker = raw.replace(/^\$/, '').toUpperCase();
    const candidates = [];
    this.repository.findAll().forEach((entity) => {
      const canonical = normalizeEntityText(entity.canonical_name);
      const aliases = entity.aliases.map(normalizeEntityText);
      const directTicker = entity.ticker && ticker === entity.ticker;
      const directCanonical = normalized && normalized === canonical;
      const directAlias = normalized && aliases.includes(normalized);
      if (directTicker) candidates.push({ entity, confidence: 0.995, method: 'ticker' });
      else if (directCanonical) candidates.push({ entity, confidence: 0.99, method: 'exact_name' });
      else if (directAlias) candidates.push({ entity, confidence: 0.97, method: 'alias' });
      else {
        const matchedAlias = [entity.canonical_name, ...entity.aliases].filter(Boolean)
          .sort((a, b) => b.length - a.length)
          .find((alias) => {
            const phrase = normalizeEntityText(alias);
            if (!phrase || phrase.length < 4) return false;
            const source = ` ${normalizeEntityText(raw)} `;
            return source.includes(` ${phrase} `);
          });
        if (matchedAlias) candidates.push({ entity, confidence: 0.94, method: 'contextual_alias' });
      }
    });
    return candidates;
  }
}

class FuzzyMatchStrategy {
  constructor(repository, { threshold = 0.86 } = {}) { this.repository = repository; this.threshold = threshold; }
  resolve(mention) {
    const normalized = normalizeEntityText(mention);
    if (normalized.length < 5) return [];
    return this.repository.findAll().flatMap((entity) => [entity.canonical_name, ...entity.aliases]
      .map((alias) => ({ entity, alias, score: editSimilarity(normalized, normalizeEntityText(alias)) }))
      .filter((candidate) => candidate.score >= this.threshold)
      .map((candidate) => ({ entity, confidence: Number((candidate.score * 0.94).toFixed(3)), method: 'fuzzy' })));
  }
}

class EntityResolutionService {
  constructor({ entityRepository, mentionRepository, strategies, confidenceThreshold = 0.82, ambiguityMargin = 0.06 } = {}) {
    if (!entityRepository) throw new Error('Entity repository is required.');
    this.entityRepository = entityRepository;
    this.mentionRepository = mentionRepository;
    this.confidenceThreshold = confidenceThreshold;
    this.ambiguityMargin = ambiguityMargin;
    this.strategies = strategies || [new ExactAliasStrategy(entityRepository), new FuzzyMatchStrategy(entityRepository)];
  }

  resolve(mention, options = {}) {
    const original = String(mention || '').trim();
    if (!original) return { resolved_entity: null, confidence: 0, possible_alternatives: [], resolution_method: 'no_match' };
    const candidates = this.strategies.flatMap((strategy) => strategy.resolve(original, options) || []);
    const unique = new Map();
    candidates.forEach((candidate) => {
      const existing = unique.get(candidate.entity.id);
      if (!existing || candidate.confidence > existing.confidence) unique.set(candidate.entity.id, candidate);
    });
    const ranked = [...unique.values()].sort((a, b) => b.confidence - a.confidence);
    const top = ranked[0]; const second = ranked[1];
    const ambiguous = Boolean(top && second && top.confidence - second.confidence < this.ambiguityMargin);
    const contextual = String(options.context || '').toLowerCase();
    let adjusted = top ? top.confidence : 0;
    if (top && options.extractedEntities && Array.isArray(options.extractedEntities)) {
      const extracted = options.extractedEntities.some((item) => normalizeEntityText(typeof item === 'string' ? item : item.value) === normalizeEntityText(original));
      if (extracted) adjusted = Math.min(0.999, adjusted + 0.02);
    }
    if (top && contextual && top.entity.sector && contextual.includes(String(top.entity.sector).toLowerCase())) adjusted = Math.min(0.999, adjusted + 0.01);
    const resolved = top && !ambiguous && adjusted >= this.confidenceThreshold ? top.entity : null;
    return {
      resolved_entity: resolved,
      confidence: resolved ? Number(adjusted.toFixed(3)) : Number((top?.confidence || 0).toFixed(3)),
      possible_alternatives: ranked.slice(resolved ? 1 : 0, 5).map(({ entity, confidence, method }) => ({ entity, confidence, resolution_method: method })),
      resolution_method: resolved ? top.method : ambiguous ? 'ambiguous' : 'below_threshold',
      ambiguous,
    };
  }

  resolveText(text, options = {}) {
    const source = String(text || ''); const found = [];
    this.entityRepository.findAll().forEach((entity) => {
      [entity.canonical_name, entity.ticker, ...entity.aliases].filter(Boolean).sort((a, b) => b.length - a.length).forEach((alias) => {
        const escaped = String(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matches = source.match(new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, 'ig')) || [];
        matches.forEach((match) => {
          const original = match.replace(/^[^A-Za-z0-9]+/, '').trim();
          const result = this.resolve(original, options);
          if (result.resolved_entity && !found.some((item) => item.entity_id === result.resolved_entity.id && item.original_text.toLowerCase() === original.toLowerCase())) {
            found.push({ entity_id: result.resolved_entity.id, canonical_name: result.resolved_entity.canonical_name, ticker: result.resolved_entity.ticker, entity_type: result.resolved_entity.entity_type, confidence: result.confidence, resolution_method: result.resolution_method, original_text: original });
          }
        });
      });
    });
    const tokens = source.slice(0, 5000).match(/[A-Za-z0-9$]+/g) || [];
    const maxWords = Math.max(1, ...this.entityRepository.findAll().flatMap((entity) => [entity.canonical_name, ...entity.aliases]).map((value) => normalizeEntityText(value).split(' ').length));
    for (let size = 1; size <= maxWords; size += 1) {
      for (let start = 0; start + size <= tokens.length; start += 1) {
        const original = tokens.slice(start, start + size).join(' ');
        if (normalizeEntityText(original).length < 5) continue;
        const result = this.resolve(original, options);
        if (result.resolved_entity && result.resolution_method === 'fuzzy'
          && !found.some((item) => item.entity_id === result.resolved_entity.id && item.original_text.toLowerCase() === original.toLowerCase())) {
          found.push({ entity_id: result.resolved_entity.id, canonical_name: result.resolved_entity.canonical_name, ticker: result.resolved_entity.ticker, entity_type: result.resolved_entity.entity_type, confidence: result.confidence, resolution_method: result.resolution_method, original_text: original });
        }
      }
    }
    return found;
  }

  resolveEvent(event, extractedEntities = []) {
    const text = [event.title, event.content, event.entity].filter(Boolean).join(' ');
    const resolved = this.resolveText(text, { context: text, extractedEntities });
    if (this.mentionRepository && resolved.length) this.mentionRepository.saveMany(resolved.map((item) => ({ event_id: event.id, entity_id: item.entity_id, original_text: item.original_text, confidence: item.confidence, resolution_method: item.resolution_method })));
    return resolved;
  }

  getEntities() { return this.entityRepository.findAll(); }
  getEntity(id) { return this.entityRepository.findById(id); }
  getEventsForEntity(id, eventRepository) {
    const eventIds = new Set((this.mentionRepository?.findByEntityId(id) || []).map((mention) => mention.event_id));
    return [...eventIds].map((eventId) => eventRepository.findById(eventId)).filter(Boolean);
  }
}

module.exports = { EntityResolutionService, ExactAliasStrategy, FuzzyMatchStrategy, normalizeEntityText, editSimilarity };
