const { RiskAggregationService } = require('../src/services/riskAggregationService');

const buildSignal = ({
  entity,
  source,
  riskScore,
  riskLevel,
  eventType = 'regulatory_action',
  sector = 'technology',
  riskFactors = ['regulatory'],
  createdAt,
  sentimentScore = -0.7,
}) => ({
  id: `${entity}-${source}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  entity,
  sector,
  event_id: `${entity}-${source}-${Math.random().toString(16).slice(2)}`,
  risk_score: riskScore,
  risk_level: riskLevel,
  confidence: 0.85,
  source,
  risk_factors: riskFactors,
  explanation: {
    factor_scores: {
      sentiment: sentimentScore,
      event_severity: 0.9,
      financial_relevance: 0.8,
    },
  },
  created_at: createdAt,
  event_type: eventType,
});

describe('Risk Aggregation & Correlation Engine', () => {
  const now = Date.now();

  test('calculates entity trend and delta for current and previous windows', () => {
    const service = new RiskAggregationService({
      riskRepository: {
        findSignalsByEntity: () => [
          buildSignal({ entity: 'Company X', source: 'news', riskScore: 72, riskLevel: 'HIGH', createdAt: new Date(now - 1000 * 60 * 60 * 2).toISOString() }),
          buildSignal({ entity: 'Company X', source: 'manual', riskScore: 68, riskLevel: 'HIGH', createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString() }),
          buildSignal({ entity: 'Company X', source: 'social', riskScore: 45, riskLevel: 'MEDIUM', createdAt: new Date(now - 1000 * 60 * 60 * 26).toISOString() }),
        ],
      },
    });

    const summary = service.getEntityRiskSummary('Company X', { window: '24h' });
    expect(summary.current_risk_score).toBeGreaterThan(0);
    expect(summary.previous_risk_score).toBeGreaterThanOrEqual(0);
    expect(summary.risk_delta).toBeDefined();
    expect(['IMPROVING', 'STABLE', 'DETERIORATING', 'RAPIDLY_DETERIORATING']).toContain(summary.risk_trend);
  });

  test('supports all configured time windows', () => {
    const service = new RiskAggregationService({
      riskRepository: {
        findSignalsByEntity: () => [
          buildSignal({ entity: 'Company Y', source: 'news', riskScore: 60, createdAt: new Date(now - 1000 * 60 * 30).toISOString() }),
        ],
      },
    });

    const windows = ['1h', '6h', '24h', '7d', '30d'];
    windows.forEach((window) => {
      const summary = service.getEntityRiskSummary('Company Y', { window });
      expect(summary.window).toBe(window);
    });
  });

  test('clusters duplicate and related events for the same entity', () => {
    const service = new RiskAggregationService({
      riskRepository: {
        findSignalsByEntity: () => [
          buildSignal({ entity: 'Company Z', source: 'news', eventType: 'regulatory_action', riskFactors: ['regulatory'], riskScore: 88, createdAt: new Date(now - 1000 * 60 * 11).toISOString() }),
          buildSignal({ entity: 'Company Z', source: 'manual', eventType: 'regulatory_action', riskFactors: ['regulatory', 'legal'], riskScore: 84, createdAt: new Date(now - 1000 * 60 * 15).toISOString() }),
          buildSignal({ entity: 'Company Z', source: 'social', eventType: 'regulatory_action', riskFactors: ['negative_sentiment'], riskScore: 47, createdAt: new Date(now - 1000 * 60 * 40).toISOString() }),
        ],
      },
    });

    const clusters = service.correlateSignals('Company Z');
    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters[0].signals.length).toBeGreaterThanOrEqual(2);
  });

  test('counts independent sources and risk event volumes', () => {
    const service = new RiskAggregationService({
      riskRepository: {
        findSignalsByEntity: () => [
          buildSignal({ entity: 'Company A', source: 'news', riskScore: 70, riskLevel: 'HIGH', createdAt: new Date(now - 1000 * 60).toISOString() }),
          buildSignal({ entity: 'Company A', source: 'manual', riskScore: 65, riskLevel: 'HIGH', createdAt: new Date(now - 1000 * 60 * 5).toISOString() }),
          buildSignal({ entity: 'Company A', source: 'social', riskScore: 40, riskLevel: 'MEDIUM', createdAt: new Date(now - 1000 * 60 * 10).toISOString() }),
          buildSignal({ entity: 'Company A', source: 'news', riskScore: 30, riskLevel: 'LOW', createdAt: new Date(now - 1000 * 60 * 20).toISOString() }),
        ],
      },
    });

    const summary = service.getEntityRiskSummary('Company A', { window: '6h' });
    expect(summary.number_of_risk_events).toBe(4);
    expect(summary.number_of_independent_sources).toBe(3);
  });

  test('flags a risk activity spike against baseline', () => {
    const service = new RiskAggregationService({
      riskRepository: {
        findSignalsByEntity: () => [
          ...Array.from({ length: 17 }, (_, index) => buildSignal({
            entity: 'Company B',
            source: index % 3 === 0 ? 'news' : 'manual',
            riskScore: 70 + (index % 5),
            createdAt: new Date(now - (index % 6) * 1000 * 60 * 60).toISOString(),
          })),
          ...Array.from({ length: 12 }, (_, index) => buildSignal({
            entity: 'Company B',
            source: 'social',
            riskScore: 25,
            createdAt: new Date(now - (index + 8) * 1000 * 60 * 60 * 24).toISOString(),
          })),
        ],
      },
    });

    const spikes = service.getRiskActivitySpikes({ window: '6h' });
    expect(spikes.some((spike) => spike.alert_type === 'RISK_ACTIVITY_SPIKE')).toBe(true);
  });

  test('aggregates sector risk summary', () => {
    const service = new RiskAggregationService({
      riskRepository: {
        findSignalsByEntity: () => [
          buildSignal({ entity: 'Alpha', source: 'news', sector: 'technology', riskScore: 72, createdAt: new Date(now - 1000 * 60 * 60).toISOString() }),
          buildSignal({ entity: 'Beta', source: 'manual', sector: 'technology', riskScore: 56, createdAt: new Date(now - 1000 * 60 * 50).toISOString() }),
          buildSignal({ entity: 'Gamma', source: 'social', sector: 'finance', riskScore: 81, createdAt: new Date(now - 1000 * 60 * 119).toISOString() }),
        ],
      },
    });

    const summary = service.getSectorRiskSummary('technology', { window: '24h' });
    expect(summary.sector).toBe('technology');
    expect(summary.affected_companies).toBeGreaterThanOrEqual(2);
    expect(summary.sector_risk_score).toBeGreaterThan(0);
  });

  test('returns empty results for no signals', () => {
    const service = new RiskAggregationService({
      riskRepository: {
        findSignalsByEntity: () => [],
        findAll: () => [],
      },
    });

    const summary = service.getEntityRiskSummary('Unknown', { window: '24h' });
    const risks = service.getEmergingRisks({ window: '24h' });
    const spikes = service.getRiskActivitySpikes({ window: '6h' });

    expect(summary.current_risk_score).toBe(0);
    expect(risks).toEqual([]);
    expect(spikes).toEqual([]);
  });

  test('handles large volumes of signals without failure', () => {
    const largeSet = Array.from({ length: 500 }, (_, index) => buildSignal({
      entity: `Company ${index % 10}`,
      source: ['news', 'manual', 'social'][index % 3],
      riskScore: 40 + (index % 50),
      createdAt: new Date(now - index * 1000 * 60).toISOString(),
      sector: index % 2 === 0 ? 'technology' : 'finance',
    }));

    const service = new RiskAggregationService({
      riskRepository: {
        findSignalsByEntity: (entity) => largeSet.filter((signal) => signal.entity === entity),
        findAll: () => largeSet,
      },
    });

    expect(() => service.getEmergingRisks({ window: '24h' })).not.toThrow();
    expect(service.getEmergingRisks({ window: '24h' }).length).toBeGreaterThan(0);
  });
});
