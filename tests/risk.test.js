const request = require('supertest');
const { app, resetIngestionForTests } = require('../src/app');
const { RiskScorer } = require('../src/risk/riskScorer');

describe('Financial Risk Scoring Engine', () => {
  beforeEach(() => {
    resetIngestionForTests();
  });

  test('low-risk event', () => {
    const scorer = new RiskScorer();
    const result = scorer.computeRisk({
      analysis: {
        sentiment_score: 0.2,
        event_types: ['earnings_growth'],
        financial_relevance: 0.3,
        evidence: ['Revenue grew modestly.'],
      },
      source: 'news',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 0,
      entityName: 'Alpha Retail',
    });

    expect(result.risk_score).toBeGreaterThanOrEqual(0);
    expect(result.risk_score).toBeLessThanOrEqual(100);
    expect(['LOW', 'MEDIUM']).toContain(result.risk_level);
  });

  test('high-risk event', () => {
    const scorer = new RiskScorer();
    const result = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.8,
        event_types: ['fraud_allegation'],
        financial_relevance: 0.95,
        evidence: ['Fraud allegations and regulatory investigation may affect valuation.'],
      },
      source: 'news',
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 0,
      entityName: 'Northgate Bank',
    });

    expect(result.risk_score).toBeGreaterThan(60);
    expect(result.risk_level).toBe('HIGH');
  });

  test('critical event', () => {
    const scorer = new RiskScorer();
    const result = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.9,
        event_types: ['bankruptcy_risk'],
        financial_relevance: 0.99,
        evidence: ['The company faces severe liquidity stress and a potential bankruptcy filing.'],
      },
      source: 'manual',
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 0,
      entityName: 'Summit Capital',
    });

    expect(result.risk_score).toBeGreaterThanOrEqual(85);
    expect(result.risk_level).toBe('CRITICAL');
  });

  test('negative sentiment', () => {
    const scorer = new RiskScorer();
    const result = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.7,
        event_types: ['lawsuit'],
        financial_relevance: 0.8,
        evidence: ['Lawsuit pressures results.'],
      },
      source: 'social',
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 0,
      entityName: 'Veridian Labs',
    });

    expect(result.risk_factors.some((factor) => factor.factor === 'negative_sentiment')).toBe(true);
  });

  test('positive sentiment reducing risk', () => {
    const scorer = new RiskScorer();
    const result = scorer.computeRisk({
      analysis: {
        sentiment_score: 0.7,
        event_types: ['earnings_growth'],
        financial_relevance: 0.7,
        evidence: ['Strong earnings and positive guidance.'],
      },
      source: 'news',
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 0,
      entityName: 'Pulse Systems',
    });

    expect(result.risk_score).toBeLessThan(60);
  });

  test('recency decay', () => {
    const scorer = new RiskScorer();
    const stale = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.5,
        event_types: ['regulatory_action'],
        financial_relevance: 0.8,
        evidence: ['Regulatory action surfaced.'],
      },
      source: 'news',
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 0,
      entityName: 'Mercury Energy',
    });

    const fresh = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.5,
        event_types: ['regulatory_action'],
        financial_relevance: 0.8,
        evidence: ['Regulatory action surfaced.'],
      },
      source: 'news',
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 0,
      entityName: 'Mercury Energy',
    });

    expect(fresh.risk_score).toBeGreaterThan(stale.risk_score);
  });

  test('duplicate reports', () => {
    const scorer = new RiskScorer();
    const result = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.5,
        event_types: ['lawsuit'],
        financial_relevance: 0.9,
        evidence: ['Multiple reports of legal action.'],
      },
      source: 'news',
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 2,
      independentSignalCount: 1,
      entityName: 'Cobalt Space',
    });

    expect(result.risk_score).toBeGreaterThan(50);
    expect(result.explanation.factor_scores.repeated_signals).toBeGreaterThanOrEqual(0);
  });

  test('multiple independent reports', () => {
    const scorer = new RiskScorer();
    const result = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.6,
        event_types: ['supply_chain_disruption'],
        financial_relevance: 0.9,
        evidence: ['Supplier disruptions intensify.'],
      },
      source: 'news',
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 0,
      independentSignalCount: 3,
      entityName: 'Vertex Logistics',
    });

    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test('score remains between 0 and 100', () => {
    const scorer = new RiskScorer();
    const result = scorer.computeRisk({
      analysis: {
        sentiment_score: -1,
        event_types: ['bankruptcy_risk'],
        financial_relevance: 1,
        evidence: ['A severe risk signal.'],
      },
      source: 'manual',
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 5,
      independentSignalCount: 5,
      entityName: 'Sigma Grid',
    });

    expect(result.risk_score).toBeGreaterThanOrEqual(0);
    expect(result.risk_score).toBeLessThanOrEqual(100);
  });

  test('explainability output', () => {
    const scorer = new RiskScorer();
    const result = scorer.computeRisk({
      analysis: {
        sentiment_score: -0.4,
        event_types: ['regulatory_action'],
        financial_relevance: 0.8,
        evidence: ['Regulatory review increases risks.'],
      },
      source: 'news',
      publishedAt: new Date().toISOString(),
      repeatedSignalCount: 1,
      independentSignalCount: 1,
      entityName: 'Lattice Bank',
    });

    expect(result.explanation.contributing_factors.length).toBeGreaterThan(0);
    expect(result.explanation.final_calculation).toContain('=');
    expect(result.explanation.model_name).toBe('baseline-risk-scoring');
  });

  test('risk API analyze endpoint', async () => {
    const eventPayload = {
      source: 'news',
      source_event_id: 'risk-event-01',
      title: 'FTC opens antitrust review into cloud marketplace',
      content: 'The FTC opened an antitrust review into cloud platforms as regulators raised concerns about market concentration and compliance risk.',
      published_at: '2026-10-08T14:00:00Z',
      language: 'en',
      event_type: 'macro',
    };

    const created = await request(app)
      .post('/api/v1/events')
      .send(eventPayload)
      .expect(201);

    await request(app)
      .post(`/api/v1/events/${created.body.data.id}/analyze`)
      .expect(201);

    const riskResponse = await request(app)
      .post(`/api/v1/risk/analyze/${created.body.data.id}`)
      .expect(201);

    expect(riskResponse.body.success).toBe(true);
    expect(riskResponse.body.data.signal.risk_score).toBeGreaterThanOrEqual(0);
    expect(riskResponse.body.data.signal.risk_level).toBeDefined();
  });
});
