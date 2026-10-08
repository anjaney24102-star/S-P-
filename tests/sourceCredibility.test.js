const request = require('supertest');
const { app, resetIngestionForTests } = require('../src/app');
const { CredibilityService } = require('../src/services/credibilityService');
const { RiskScorer } = require('../src/risk/riskScorer');

describe('Source Credibility Engine', () => {
  beforeEach(() => {
    resetIngestionForTests();
  });

  test('source classification', () => {
    const service = new CredibilityService();

    expect(service.classifySource('SEC EDGAR filing')).toBe('official_filing');
    expect(service.classifySource('company announcement')).toBe('company_announcement');
    expect(service.classifySource('Reuters market update')).toBe('major_news');
    expect(service.classifySource('X / social media rumor')).toBe('social_media');
    expect(service.classifySource('mystery telemetry feed')).toBe('unknown');
  });

  test('credibility calculation', () => {
    const service = new CredibilityService();
    const profile = service.calculateSourceCredibility('sec', {
      sourceType: 'official_filing',
      historicalAccuracy: 0.97,
      verificationStatus: 'verified',
    });

    expect(profile.source_type).toBe('official_filing');
    expect(profile.credibility_score).toBeGreaterThan(0.8);
    expect(profile.verification_status).toBe('verified');
  });

  test('unknown sources default to low confidence', () => {
    const service = new CredibilityService();
    const profile = service.calculateSourceCredibility('mystery-telegram-post');

    expect(profile.source_type).toBe('unknown');
    expect(profile.credibility_score).toBeLessThan(0.6);
  });

  test('multiple independent sources increase confidence', () => {
    const scorer = new RiskScorer();

    const highCredibility = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.7,
        event_types: ['regulatory_action'],
        financial_relevance: 0.9,
        evidence: ['Regulator confirms investigation.'],
      },
      source: 'regulator',
      sourceProfile: {
        source_name: 'regulator',
        source_type: 'official_filing',
        credibility_score: 0.96,
        verification_status: 'verified',
      },
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 3,
      entityName: 'Apex Holdings',
    });

    const lowCredibility = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.7,
        event_types: ['regulatory_action'],
        financial_relevance: 0.9,
        evidence: ['Company might be investigated.'],
      },
      source: 'anonymous-social-account',
      sourceProfile: {
        source_name: 'anonymous-social-account',
        source_type: 'social_media',
        credibility_score: 0.38,
        verification_status: 'unverified',
      },
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 0,
      entityName: 'Apex Holdings',
    });

    expect(highCredibility.confidence).toBeGreaterThan(lowCredibility.confidence);
  });

  test('duplicate sources do not increase confidence artificially', () => {
    const scorer = new RiskScorer();

    const duplicateOnly = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.6,
        event_types: ['lawsuit'],
        financial_relevance: 0.85,
        evidence: ['Repeated posts from one source.'],
      },
      source: 'social',
      sourceProfile: {
        source_name: 'social',
        source_type: 'social_media',
        credibility_score: 0.42,
        verification_status: 'unverified',
      },
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 4,
      independentSignalCount: 0,
      entityName: 'Blue Harbor',
    });

    const independentSources = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.6,
        event_types: ['lawsuit'],
        financial_relevance: 0.85,
        evidence: ['Confirmed by regulator and financial press.'],
      },
      source: 'major_news',
      sourceProfile: {
        source_name: 'major_news',
        source_type: 'major_news',
        credibility_score: 0.8,
        verification_status: 'verified',
      },
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 3,
      entityName: 'Blue Harbor',
    });

    expect(independentSources.confidence).toBeGreaterThan(duplicateOnly.confidence);
  });

  test('source credibility integration into risk scoring', async () => {
    const eventPayload = {
      source: 'news',
      source_event_id: 'risk-source-cred-1',
      title: 'Regulator confirms investigation',
      content: 'Regulators confirmed an investigation into the company and warned of wider credit concerns.',
      published_at: new Date().toISOString(),
      language: 'en',
      event_type: 'regulatory_action',
    };

    const createdEvent = await request(app)
      .post('/api/v1/events')
      .send(eventPayload)
      .expect(201);

    await request(app)
      .post(`/api/v1/events/${createdEvent.body.data.id}/analyze`)
      .expect(201);

    const riskResult = await request(app)
      .post(`/api/v1/risk/analyze/${createdEvent.body.data.id}`)
      .expect(201);

    expect(riskResult.body.success).toBe(true);
    expect(riskResult.body.data.signal.explanation.source_credibility).toBeDefined();
    expect(riskResult.body.data.signal.explanation.source_credibility.credibility_score).toBeGreaterThan(0);
  });

  test('source management endpoints', async () => {
    const createResponse = await request(app)
      .post('/api/v1/sources')
      .send({
        source_name: 'SEC',
        source_type: 'official_filing',
        historical_accuracy: 0.97,
        verification_status: 'verified',
      })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.source_name).toBe('sec');

    const listResponse = await request(app)
      .get('/api/v1/sources')
      .expect(200);

    expect(listResponse.body.success).toBe(true);
    expect(Array.isArray(listResponse.body.data)).toBe(true);

    const sourceResponse = await request(app)
      .get('/api/v1/sources/sec')
      .expect(200);

    expect(sourceResponse.body.data.source_name).toBe('sec');
  });
});
