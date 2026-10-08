const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { app, resetIngestionForTests, entityResolutionService } = require('../src/app');
const { EntityRepository } = require('../src/repositories/entityRepository');
const { EntityResolutionService } = require('../src/services/entityResolutionService');
const { RiskAggregationService } = require('../src/services/riskAggregationService');

describe('Financial entity resolution', () => {
  let directory;
  let repository;
  let service;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'financial-entities-'));
    repository = new EntityRepository(path.join(directory, 'entities.json'), [
      { id: 'apple', canonical_name: 'Apple Inc.', ticker: 'AAPL', entity_type: 'company', sector: 'Technology', industry: 'Consumer Electronics', country: 'United States', aliases: ['Apple', 'Cupertino tech giant'] },
      { id: 'apple-fund', canonical_name: 'Apple Income Fund', ticker: 'APIF', entity_type: 'financial_instrument', aliases: ['Apple fund'] },
      { id: 'amazon', canonical_name: 'Amazon.com, Inc.', ticker: 'AMZN', entity_type: 'company', aliases: ['Amazon'] },
    ]);
    service = new EntityResolutionService({ entityRepository: repository });
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('resolves exact canonical names and normalizes legal suffixes', () => {
    expect(service.resolve('Apple Inc.').resolved_entity.id).toBe('apple');
    expect(service.resolve('Apple shares').resolved_entity.canonical_name).toBe('Apple Inc.');
  });

  test('resolves configured aliases and contextual aliases', () => {
    expect(service.resolve('Apple').resolved_entity.id).toBe('apple');
    expect(service.resolve('the Cupertino tech giant').resolved_entity.id).toBe('apple');
  });

  test('resolves ticker matches', () => {
    expect(service.resolve('AAPL').resolved_entity.canonical_name).toBe('Apple Inc.');
    expect(service.resolve('$AAPL').resolved_entity.id).toBe('apple');
  });

  test('uses fuzzy matching for high similarity names', () => {
    const result = service.resolve('Microsft');
    const otherRepository = new EntityRepository(path.join(directory, 'fuzzy.json'), [
      { id: 'microsoft', canonical_name: 'Microsoft Corporation', ticker: 'MSFT', entity_type: 'company', aliases: ['Microsoft'] },
    ]);
    const otherService = new EntityResolutionService({ entityRepository: otherRepository });
    expect(otherService.resolve('Microsft').resolved_entity.id).toBe('microsoft');
    expect(otherService.resolveText('Microsft warns about earnings.').some((item) => item.entity_id === 'microsoft')).toBe(true);
    expect(result.resolved_entity).toBeNull();
  });

  test('returns alternatives rather than choosing an ambiguous alias', () => {
    const ambiguousRepository = new EntityRepository(path.join(directory, 'ambiguous.json'), [
      { id: 'company', canonical_name: 'Apple Inc.', ticker: 'AAPL', entity_type: 'company', aliases: ['Apple'] },
      { id: 'fund', canonical_name: 'Apple Income Fund', ticker: 'APIF', entity_type: 'financial_instrument', aliases: ['Apple'] },
    ]);
    const result = new EntityResolutionService({ entityRepository: ambiguousRepository }).resolve('Apple');
    expect(result.resolved_entity).toBeNull();
    expect(result.ambiguous).toBe(true);
    expect(result.possible_alternatives).toHaveLength(2);
  });

  test('rejects unrelated and short fuzzy candidates', () => {
    expect(service.resolve('Orange').resolved_entity).toBeNull();
    expect(service.resolve('Aap').resolved_entity).toBeNull();
  });

  test('enforces configurable confidence thresholds', () => {
    const strictService = new EntityResolutionService({ entityRepository: repository, confidenceThreshold: 0.98 });
    expect(strictService.resolve('the Cupertino tech giant').resolved_entity).toBeNull();
    expect(strictService.resolve('AAPL').resolved_entity.id).toBe('apple');
  });

  test('returns normalized entity model fields and timestamps', () => {
    const entity = repository.findById('apple');
    expect(entity).toEqual(expect.objectContaining({ id: 'apple', canonical_name: 'Apple Inc.', ticker: 'AAPL', entity_type: 'company', sector: 'Technology', industry: 'Consumer Electronics', country: 'United States', aliases: expect.arrayContaining(['Apple']), metadata: expect.any(Object), created_at: expect.any(String), updated_at: expect.any(String) }));
  });
});

describe('Entity resolution integration', () => {
  beforeEach(() => resetIngestionForTests());

  test('resolves event text into canonical NLP entities and persists mentions', async () => {
    const created = await request(app).post('/api/v1/events').send({
      source: 'manual', source_event_id: 'entity-resolution-event', title: 'AAPL shares fall after Apple warns of supply delays',
      content: 'The Cupertino tech giant reported disruption.', published_at: '2026-10-08T12:00:00Z', language: 'en', event_type: 'market_news',
    }).expect(201);
    const analyzed = await request(app).post(`/api/v1/events/${created.body.data.id}/analyze`).expect(201);
    const resolved = analyzed.body.data.analysis.resolved_entities;
    expect(resolved.some((entity) => entity.entity_id === 'entity-apple' && entity.canonical_name === 'Apple Inc.')).toBe(true);
    const events = await request(app).get('/api/v1/entities/entity-apple/events').expect(200);
    expect(events.body.data.map((event) => event.id)).toContain(created.body.data.id);
  });

  test('exposes entity catalog, details and entity risk APIs', async () => {
    const entities = await request(app).get('/api/v1/entities?type=company').expect(200);
    expect(entities.body.data.some((entity) => entity.id === 'entity-apple')).toBe(true);
    const entity = await request(app).get('/api/v1/entities/entity-apple').expect(200);
    expect(entity.body.data.ticker).toBe('AAPL');
    const risk = await request(app).get('/api/v1/entities/entity-apple/risk').expect(200);
    expect(risk.body.data.summary.entity).toBe('Apple Inc.');
  });

  test('scores and aggregates Apple alias signals under its canonical entity id', async () => {
    for (const [sourceEventId, title] of [
      ['apple-name-signal', 'Apple shares fall after supply warning'],
      ['apple-legal-name-signal', 'Apple Inc. faces regulatory scrutiny'],
      ['apple-ticker-signal', 'AAPL declines as investors weigh new risks'],
    ]) {
      const created = await request(app).post('/api/v1/events').send({
        source: 'manual', source_event_id: sourceEventId, title, content: title,
        published_at: new Date().toISOString(), language: 'en', event_type: 'market_news',
      }).expect(201);
      await request(app).post(`/api/v1/events/${created.body.data.id}/analyze`).expect(201);
      const scored = await request(app).post(`/api/v1/risk/analyze/${created.body.data.id}`).expect(201);
      expect(scored.body.data.signal.entity).toBe('Apple Inc.');
      expect(scored.body.data.signal.entity_id).toBe('entity-apple');
    }
    const result = await request(app).get('/api/v1/entities/entity-apple/risk').expect(200);
    expect(result.body.data.signals).toHaveLength(3);
    expect(result.body.data.summary.number_of_risk_events).toBe(3);
  });

  test('aggregates risk signals across canonical name, alias and ticker by entity id', () => {
    const signals = [
      { id: 'one', entity: 'Apple Inc.', entity_id: 'entity-apple', created_at: new Date().toISOString(), risk_score: 61, source: 'news', risk_factors: ['supply'] },
      { id: 'two', entity: 'AAPL', entity_id: 'entity-apple', created_at: new Date().toISOString(), risk_score: 75, source: 'social', risk_factors: ['sentiment'] },
      { id: 'three', entity: 'Apple', entity_id: 'entity-apple', created_at: new Date().toISOString(), risk_score: 69, source: 'manual', risk_factors: ['supply'] },
    ];
    const aggregation = new RiskAggregationService({
      riskRepository: { findByEntityId: () => signals, findSignalsByEntity: (name) => signals.filter((signal) => signal.entity === name) },
      entityResolutionService,
    });
    const summary = aggregation.getEntityRiskSummary('AAPL');
    expect(summary.number_of_risk_events).toBe(3);
    expect(summary.entity).toBe('Apple Inc.');
  });
});
