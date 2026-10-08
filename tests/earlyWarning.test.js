const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { app, resetIngestionForTests } = require('../src/app');
const { EarlyWarningService } = require('../src/services/earlyWarningService');
const { EntityRiskBaselineRepository } = require('../src/repositories/entityRiskBaselineRepository');
const { EarlyWarningRepository } = require('../src/repositories/earlyWarningRepository');
const { ZScoreAlgorithm, EWMAMeanShiftAlgorithm } = require('../src/risk/anomalyAlgorithms');

const DAY = 24 * 60 * 60 * 1000;

describe('Financial risk early warning engine', () => {
  let directory;
  let now;
  let signals;
  let events;
  let analyses;
  let service;
  let alertRecords;

  const addStory = ({ key, timestamp, count = 1, negative = false, risk = 40, sourcePrefix = 'source', legal = false }) => {
    for (let index = 0; index < count; index += 1) {
      const eventId = `${key}-${index}`;
      const source = `${sourcePrefix}-${index % 3}`;
      signals.push({ id: `signal-${eventId}`, entity: 'Acme Corporation', entity_id: 'entity-acme', story_id: key, event_id: eventId, source, event_type: legal ? 'regulatory_action' : 'market_news', risk_score: risk, risk_factors: negative ? ['negative_sentiment'] : [], created_at: new Date(timestamp).toISOString() });
      events.set(eventId, { id: eventId, story_id: key, event_type: legal ? 'regulatory_action' : 'market_news' });
      analyses.set(eventId, { event_id: eventId, sentiment_label: negative ? 'negative' : 'positive', sentiment_score: negative ? -0.7 : 0.5, event_types: legal ? ['regulatory_action'] : [] });
    }
  };

  const addBaseline = ({ counts = Array(30).fill(2), negativeCounts = counts, risk = 40, sourcePrefix = 'history' } = {}) => {
    counts.forEach((count, day) => {
      const timestamp = now - (6 * 60 * 60 * 1000) - ((day + 1) * DAY) + 1000;
      addStory({ key: `baseline-${day}`, timestamp, count, negative: negativeCounts[day] > 0, risk, sourcePrefix: `${sourcePrefix}-${day}` });
      // Make the negative rate reflect the requested number of negative story records.
      const dayStories = signals.filter((signal) => signal.story_id === `baseline-${day}`);
      dayStories.forEach((signal, index) => {
        const isNegative = index < (negativeCounts[day] || 0);
        analyses.set(signal.event_id, { event_id: signal.event_id, sentiment_label: isNegative ? 'negative' : 'positive', sentiment_score: isNegative ? -0.7 : 0.5, event_types: [] });
        if (isNegative) signal.risk_factors = ['negative_sentiment']; else signal.risk_factors = [];
      });
    });
  };

  const createService = (config = {}) => {
    const riskRepository = { findByEntityId: (id) => signals.filter((signal) => signal.entity_id === id), findAll: () => signals };
    const eventRepository = { findById: (id) => events.get(id) || null };
    const analysisRepository = { findByEventId: (id) => analyses.get(id) || null };
    const entityRepository = { findById: (id) => id === 'entity-acme' ? { id, canonical_name: 'Acme Corporation' } : null, findAll: () => [{ id: 'entity-acme', canonical_name: 'Acme Corporation' }] };
    const baselineRepository = new EntityRiskBaselineRepository(path.join(directory, 'baselines.json'));
    const warningRepository = new EarlyWarningRepository(path.join(directory, 'warnings.json'));
    alertRecords = [];
    service = new EarlyWarningService({
      riskRepository, eventRepository, analysisRepository, entityRepository, baselineRepository, warningRepository,
      alertService: { recordEarlyWarning: (warning) => alertRecords.push(warning) },
      now: () => now,
      config: { minimumBaselineSignals: 5, minimumBaselineActiveDays: 3, minimumIndependentSources: 2, minimumStoriesForSpike: 2, cooldownMs: 0, ...config },
    });
  };

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'risk-warning-'));
    now = Date.UTC(2026, 9, 8, 12, 0, 0);
    signals = [];
    events = new Map();
    analyses = new Map();
    alertRecords = [];
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  test('does not alert on normal activity', () => {
    addBaseline();
    createService();
    expect(service.detectEntity('entity-acme', { window: '6h' })).toEqual([]);
  });

  test('detects a sudden increase in negative events and records an alert', () => {
    addBaseline({ counts: Array(30).fill(2), negativeCounts: Array(30).fill(2) });
    for (let index = 0; index < 12; index += 1) addStory({ key: `spike-${index}`, timestamp: now - (index * 20 * 60 * 1000), negative: true, risk: 72, sourcePrefix: `wire-${index % 3}` });
    createService();
    const warnings = service.detectEntity('entity-acme', { window: '6h' });
    const negative = warnings.find((warning) => warning.warning_type === 'NEGATIVE_SENTIMENT_SPIKE');
    expect(negative.severity).toBe('CRITICAL');
    expect(negative.explanation).toMatch(/increased from/);
    expect(negative.explanation).toMatch(/independent sources/);
    expect(alertRecords.some((warning) => warning.id === negative.id)).toBe(true);
  });

  test('treats gradual increases as less severe than abrupt spikes', () => {
    const counts = [...Array(25).fill(2), 2, 3, 4, 5, 6].reverse();
    addBaseline({ counts, negativeCounts: Array(30).fill(0) });
    for (let index = 0; index < 4; index += 1) addStory({ key: `gradual-${index}`, timestamp: now - (index * 5 * 60 * 60 * 1000), sourcePrefix: `current-${index}` });
    createService({ minimumZScore: 1.5, severityThresholds: { WATCH: 1.5, ELEVATED: 3, HIGH: 4, CRITICAL: 6 } });
    const warnings = service.detectEntity('entity-acme', { window: '24h' });
    const frequency = warnings.find((warning) => warning.warning_type === 'EVENT_FREQUENCY_SPIKE');
    expect(frequency).toBeDefined();
    expect(['WATCH', 'ELEVATED']).toContain(frequency.severity);
  });

  test('collapses duplicate articles clustered to one story', () => {
    addBaseline();
    addStory({ key: 'one-breaking-story', timestamp: now - 30 * 60 * 1000, count: 12, negative: true, sourcePrefix: 'publisher' });
    createService();
    expect(service.detectEntity('entity-acme', { window: '6h' })).toEqual([]);
  });

  test('suppresses statistical warnings without sufficient history', () => {
    for (let index = 0; index < 10; index += 1) addStory({ key: `new-entity-${index}`, timestamp: now - index * 1000, negative: true, sourcePrefix: `new-source-${index % 3}` });
    createService();
    expect(service.detectEntity('entity-acme', { window: '6h' })).toEqual([]);
    expect(service.getBaseline('entity-acme').sufficient_history).toBe(false);
  });

  test('handles a zero-negative-event baseline without division errors', () => {
    addBaseline({ counts: Array(30).fill(2), negativeCounts: Array(30).fill(0) });
    for (let index = 0; index < 3; index += 1) addStory({ key: `new-negative-${index}`, timestamp: now - index * 30 * 60 * 1000, negative: true, sourcePrefix: `publisher-${index}` });
    createService();
    const warning = service.detectEntity('entity-acme', { window: '6h' }).find((item) => item.warning_type === 'NEGATIVE_SENTIMENT_SPIKE');
    expect(warning.baseline_value).toBe(0);
    expect(warning.severity).toBeDefined();
    expect(Number.isFinite(warning.deviation)).toBe(true);
  });

  test('requires independent sources before calling an increase meaningful', () => {
    addBaseline();
    for (let index = 0; index < 10; index += 1) addStory({ key: `single-source-${index}`, timestamp: now - index * 15 * 60 * 1000, negative: true, sourcePrefix: 'one-publisher' });
    createService();
    expect(service.detectEntity('entity-acme', { window: '6h' })).toEqual([]);
  });

  test('detects an unusual regulatory and legal event burst', () => {
    addBaseline({ counts: Array(30).fill(2), negativeCounts: Array(30).fill(0) });
    for (let index = 0; index < 8; index += 1) addStory({ key: `legal-${index}`, timestamp: now - index * 30 * 60 * 1000, legal: true, negative: true, sourcePrefix: `legal-source-${index % 3}` });
    createService();
    const warnings = service.detectEntity('entity-acme', { window: '6h' });
    expect(warnings.some((warning) => warning.warning_type === 'REGULATORY_LEGAL_SPIKE')).toBe(true);
  });

  test('classifies exact warning threshold boundaries', () => {
    createService();
    expect(service.severityFor(1.999)).toBeNull();
    expect(service.severityFor(2)).toBe('WATCH');
    expect(service.severityFor(2.5)).toBe('ELEVATED');
    expect(service.severityFor(3.5)).toBe('HIGH');
    expect(service.severityFor(5)).toBe('CRITICAL');
  });

  test('ships z-score and EWMA strategies behind the modular algorithm interface', () => {
    expect(new ZScoreAlgorithm().score(8, [2, 2, 2, 2])).toBeGreaterThan(0);
    expect(new EWMAMeanShiftAlgorithm().score(8, [2, 2, 2, 2])).toBeGreaterThan(0);
  });
});

describe('Early warning API', () => {
  beforeEach(() => resetIngestionForTests());

  test('exposes global warnings and entity warnings/baseline', async () => {
    const global = await request(app).get('/api/v1/warnings?window=6h').expect(200);
    expect(global.body.success).toBe(true);
    const warnings = await request(app).get('/api/v1/entities/entity-apple/warnings?window=1h').expect(200);
    expect(warnings.body.data).toEqual([]);
    const baseline = await request(app).get('/api/v1/entities/entity-apple/baseline?window=7d').expect(200);
    expect(baseline.body.data).toEqual(expect.objectContaining({ entity_id: 'entity-apple', baseline_risk: expect.any(Number), average_event_rate: expect.any(Number), average_negative_event_rate: expect.any(Number), standard_deviation: expect.any(Number), calculated_at: expect.any(String) }));
  });
});
