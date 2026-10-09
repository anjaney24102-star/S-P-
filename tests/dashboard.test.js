const request = require('supertest');
const { app, resetIngestionForTests, riskService } = require('../src/app');
const { buildRiskSignal } = require('../src/domain/RiskSignal');

describe('Real-Time Financial Risk Dashboard & Alerting', () => {
  beforeEach(() => {
    resetIngestionForTests();
  });

  test('dashboard page and stress-test assets are served with the API', async () => {
    const page = await request(app).get('/');
    expect(page.status).toBe(200);
    expect(page.text).toContain('Portfolio stress test');
    expect((await request(app).get('/stress-testing.js')).status).toBe(200);
    expect((await request(app).get('/stress-testing.css')).status).toBe(200);
    const stressScript = await request(app).get('/stress-testing.js');
    expect(stressScript.text).toContain('Event-to-portfolio contagion');
    expect((await request(app).get('/contagion-graph.css')).status).toBe(200);
    expect((await request(app).get('/scenario-analysis.css')).status).toBe(200);
  });

  test('dashboard summary returns market overview and risky entities', async () => {
    const signals = [
      buildRiskSignal({
        entity: 'Acme Corp',
        eventId: 'evt-acme-1',
        riskScore: 92,
        riskLevel: 'CRITICAL',
        confidence: 0.94,
        riskFactors: ['regulatory', 'legal'],
        explanation: { factor_scores: { sentiment: -0.7, event_severity: 0.95, financial_relevance: 0.9 } },
        source: 'news',
        eventType: 'regulatory_action',
        sector: 'technology',
        createdAt: new Date().toISOString(),
      }),
      buildRiskSignal({
        entity: 'Beta Systems',
        eventId: 'evt-beta-1',
        riskScore: 72,
        riskLevel: 'HIGH',
        confidence: 0.8,
        riskFactors: ['cybersecurity'],
        explanation: { factor_scores: { sentiment: -0.5, event_severity: 0.8, financial_relevance: 0.7 } },
        source: 'social',
        eventType: 'cybersecurity_incident',
        sector: 'technology',
        createdAt: new Date().toISOString(),
      }),
    ];

    signals.forEach((signal) => riskService.riskRepository.save(signal));

    const res = await request(app).get('/api/v1/dashboard/summary?window=24h');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.market_summary).toBeDefined();
    expect(res.body.data.top_risky_entities.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.risk_distribution).toBeDefined();
    expect(res.body.data.recent_risk_events).toBeDefined();
  });

  test('entity dashboard returns explainability and risk history', async () => {
    riskService.riskRepository.save(buildRiskSignal({
      entity: 'Acme Corp',
      eventId: 'evt-acme-2',
      riskScore: 88,
      riskLevel: 'HIGH',
      confidence: 0.9,
      riskFactors: ['regulatory', 'litigation'],
      explanation: {
        factor_scores: {
          sentiment: -0.8,
          event_severity: 0.95,
          financial_relevance: 0.87,
          source_reliability: 0.76,
        },
      },
      source: 'news',
      eventType: 'lawsuit',
      sector: 'technology',
      createdAt: new Date().toISOString(),
    }));

    const res = await request(app).get('/api/v1/dashboard/entity/Acme%20Corp?window=24h');

    expect(res.status).toBe(200);
    expect(res.body.data.current_risk_score).toBeGreaterThan(0);
    expect(res.body.data.risk_history).toBeDefined();
    expect(res.body.data.source_breakdown).toBeDefined();
    expect(res.body.data.explainable_scoring_breakdown).toBeDefined();
    expect(res.body.data.why_is_this_company_risky).toContain('regulatory');
  });

  test('alerts are generated and can be acknowledged', async () => {
    riskService.riskRepository.save(buildRiskSignal({
      entity: 'Acme Corp',
      eventId: 'evt-acme-3',
      riskScore: 90,
      riskLevel: 'CRITICAL',
      confidence: 0.9,
      riskFactors: ['regulatory'],
      explanation: { factor_scores: { sentiment: -0.7, event_severity: 0.95, financial_relevance: 0.9 } },
      source: 'news',
      eventType: 'regulatory_action',
      sector: 'technology',
      createdAt: new Date().toISOString(),
    }));

    const alertRes = await request(app).get('/api/v1/alerts');
    expect(alertRes.status).toBe(200);
    expect(alertRes.body.data.length).toBeGreaterThan(0);

    const alertId = alertRes.body.data[0].id;
    const acknowledgeRes = await request(app).post(`/api/v1/alerts/${alertId}/acknowledge`);
    expect(acknowledgeRes.status).toBe(200);
    expect(acknowledgeRes.body.data.acknowledged).toBe(true);
  });

  test('alert cooldown prevents spam for the same event', async () => {
    const signal = buildRiskSignal({
      entity: 'Acme Corp',
      eventId: 'evt-acme-4',
      riskScore: 90,
      riskLevel: 'CRITICAL',
      confidence: 0.9,
      riskFactors: ['regulatory'],
      explanation: { factor_scores: { sentiment: -0.7, event_severity: 0.95, financial_relevance: 0.9 } },
      source: 'news',
      eventType: 'regulatory_action',
      sector: 'technology',
      createdAt: new Date().toISOString(),
    });

    riskService.riskRepository.save(signal);
    const firstAlerts = await request(app).get('/api/v1/alerts');
    riskService.riskRepository.save({ ...signal, id: 'duplicate-alert-signal', event_id: 'evt-acme-4', created_at: new Date().toISOString() });
    const secondAlerts = await request(app).get('/api/v1/alerts');

    expect(firstAlerts.body.data.length).toBeGreaterThan(0);
    expect(secondAlerts.body.data.filter((alert) => alert.entity === 'Acme Corp').length).toBe(firstAlerts.body.data.filter((alert) => alert.entity === 'Acme Corp').length);
  });

  test('alert config supports threshold tuning', async () => {
    const res = await request(app)
      .put('/api/v1/alerts/config')
      .send({
        risk_score_threshold: 85,
        increase_threshold: 0.2,
        cooldown_ms: 600000,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.risk_score_threshold).toBe(85);
  });
});
