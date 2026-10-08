const createEntityController = ({ entityResolutionService, eventRepository, riskRepository, riskAggregationService, earlyWarningService }) => ({
  list: (req, res) => {
    const query = String(req.query.q || '').toLowerCase();
    const type = String(req.query.type || '').toLowerCase();
    const entities = entityResolutionService.getEntities().filter((entity) =>
      (!type || entity.entity_type === type)
      && (!query || [entity.canonical_name, entity.ticker, ...entity.aliases].some((value) => String(value || '').toLowerCase().includes(query))));
    res.status(200).json({ success: true, data: entities });
  },
  get: (req, res) => {
    const entity = entityResolutionService.getEntity(req.params.id);
    if (!entity) return res.status(404).json({ success: false, error: { code: 'ENTITY_NOT_FOUND', message: `Entity not found: ${req.params.id}` } });
    return res.status(200).json({ success: true, data: entity });
  },
  events: (req, res) => {
    const entity = entityResolutionService.getEntity(req.params.id);
    if (!entity) return res.status(404).json({ success: false, error: { code: 'ENTITY_NOT_FOUND', message: `Entity not found: ${req.params.id}` } });
    return res.status(200).json({ success: true, data: entityResolutionService.getEventsForEntity(entity.id, eventRepository) });
  },
  risk: (req, res) => {
    const entity = entityResolutionService.getEntity(req.params.id);
    if (!entity) return res.status(404).json({ success: false, error: { code: 'ENTITY_NOT_FOUND', message: `Entity not found: ${req.params.id}` } });
    const signals = riskRepository.findByEntityId ? riskRepository.findByEntityId(entity.id) : [];
    const summary = riskAggregationService.getEntityRiskSummary(entity.canonical_name, { window: req.query.window || '24h' });
    return res.status(200).json({ success: true, data: { entity, summary, signals } });
  },
  warnings: (req, res) => {
    const entity = entityResolutionService.getEntity(req.params.id);
    if (!entity) return res.status(404).json({ success: false, error: { code: 'ENTITY_NOT_FOUND', message: `Entity not found: ${req.params.id}` } });
    return res.status(200).json({ success: true, data: earlyWarningService.getWarningsForEntity(entity.id, { window: req.query.window || '6h' }) });
  },
  baseline: (req, res) => {
    const entity = entityResolutionService.getEntity(req.params.id);
    if (!entity) return res.status(404).json({ success: false, error: { code: 'ENTITY_NOT_FOUND', message: `Entity not found: ${req.params.id}` } });
    return res.status(200).json({ success: true, data: earlyWarningService.getBaseline(entity.id, { window: req.query.window || '6h' }) });
  },
});

module.exports = { createEntityController };
