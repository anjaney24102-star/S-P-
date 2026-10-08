const request = require('supertest');
const { app, resetIngestionForTests } = require('../src/app');
const { EventRepository } = require('../src/repositories/eventRepository');
const { AnalysisRepository } = require('../src/repositories/analysisRepository');
const { FinancialNLPipeline } = require('../src/nlp/nlpPipeline');
const { AnalysisService } = require('../src/services/analysisService');
const { storagePath, analysisStoragePath } = require('../src/config');

describe('Financial NLP Intelligence Engine', () => {
  beforeEach(() => {
    resetIngestionForTests();
  });

  test('entity extraction', () => {
    const pipeline = new FinancialNLPipeline();
    const event = {
      id: 'evt-entity-1',
      title: 'Microsoft earnings beat expectations as Azure demand strengthens',
      content: 'Microsoft reported strong quarterly earnings and renewed cloud growth momentum.',
    };

    const result = pipeline.process(event);
    expect(result.entities.some((entity) => entity.value.toLowerCase() === 'microsoft')).toBe(true);
    expect(result.entities.some((entity) => entity.type === 'company')).toBe(true);
  });

  test('sentiment classification', () => {
    const pipeline = new FinancialNLPipeline();
    const event = {
      id: 'evt-sentiment-1',
      title: 'Consumer spending rebounds',
      content: 'Retail revenue jumped sharply and profit guidance was upgraded after strong demand.',
    };

    const result = pipeline.process(event);
    expect(result.sentiment_label).toBe('positive');
    expect(result.sentiment_score).toBeGreaterThan(0);
  });

  test('topic classification', () => {
    const pipeline = new FinancialNLPipeline();
    const event = {
      id: 'evt-topic-1',
      title: 'Supply chain disruption delays semiconductor shipments',
      content: 'Chip suppliers reported extended lead times and shipping delays across the semiconductor supply chain.',
    };

    const result = pipeline.process(event);
    expect(result.topics.some((topic) => topic.topic === 'supply chain')).toBe(true);
  });

  test('financial relevance', () => {
    const pipeline = new FinancialNLPipeline();
    const event = {
      id: 'evt-relevance-1',
      title: 'Treasury yields rise as rates pressure lenders',
      content: 'Treasury yields climbed as inflation and higher rates pressured bank margins and debt costs.',
    };

    const result = pipeline.process(event);
    expect(result.financial_relevance).toBeGreaterThan(0.5);
  });

  test('event classification', () => {
    const pipeline = new FinancialNLPipeline();
    const event = {
      id: 'evt-classifier-1',
      title: 'Federal Reserve opens antitrust review on cloud market',
      content: 'The FTC and regulators opened a scrutiny process that could affect valuation and compliance.',
    };

    const result = pipeline.process(event);
    expect(result.event_types).toContain('regulatory_action');
  });

  test('duplicate processing prevention', async () => {
    const repository = new EventRepository(storagePath);
    const analysisRepository = new AnalysisRepository(analysisStoragePath);
    const pipeline = new FinancialNLPipeline();
    const service = new AnalysisService({ eventRepository: repository, analysisRepository, nlpPipeline: pipeline });

    const event = {
      id: 'evt-duplicate-1',
      source: 'news',
      source_event_id: 'news-dup-1',
      title: 'Bank warns of higher funding costs',
      content: 'The bank said higher borrowing costs and lower margins will pressure earnings.',
      published_at: '2026-10-08T12:00:00Z',
      ingested_at: '2026-10-08T12:01:00Z',
      language: 'en',
      event_type: 'finance',
      metadata: {},
    };

    repository.save(event);

    const first = service.analyzeEvent(event.id);
    const second = service.analyzeEvent(event.id);

    expect(first.created).toBe(true);
    expect(second.reused).toBe(true);
  });

  test('nlp failure handling', () => {
    const repository = new EventRepository(storagePath);
    const analysisRepository = new AnalysisRepository(analysisStoragePath);
    const service = new AnalysisService({
      eventRepository: repository,
      analysisRepository,
      nlpPipeline: {
        modelName: 'failing-model',
        modelVersion: '0.0.0',
        process: () => {
          throw new Error('Model failed unexpectedly');
        },
      },
    });

    const event = {
      id: 'evt-fail-1',
      source: 'manual',
      source_event_id: 'manual-fail-1',
      title: 'Cyber incident at vendor',
      content: 'A supplier reported a cyber incident affecting production capacity and shipments.',
      published_at: '2026-10-08T13:00:00Z',
      ingested_at: '2026-10-08T13:05:00Z',
      language: 'en',
      event_type: 'cyber',
      metadata: {},
    };

    repository.save(event);

    expect(() => service.analyzeEvent(event.id)).toThrow();

    const saved = analysisRepository.findByEventId(event.id);
    expect(saved.status).toBe('failed');
  });

  test('analyze event endpoint', async () => {
    const eventPayload = {
      source: 'news',
      source_event_id: 'news-analysis-1',
      title: 'Retail earnings slip after weaker outlook',
      content: 'Retail chains reported weaker earnings and a softer outlook as consumer demand cooled.',
      published_at: '2026-10-08T14:00:00Z',
      language: 'en',
      event_type: 'earnings',
    };

    const created = await request(app)
      .post('/api/v1/events')
      .send(eventPayload)
      .expect(201);

    const analysisResponse = await request(app)
      .post(`/api/v1/events/${created.body.data.id}/analyze`)
      .expect(201);

    expect(analysisResponse.body.success).toBe(true);
    expect(analysisResponse.body.data.analysis.event_id).toBe(created.body.data.id);
    expect(analysisResponse.body.data.analysis.sentiment_label).toBeDefined();
  });
});
