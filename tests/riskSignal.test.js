const request = require('supertest');
const { app, resetIngestionForTests, riskSignalService } = require('../src/app');
const { NlpAnalysisSentimentAnalyzer, NlpEventClassifier } = require('../src/risk/signalAnalyzers');
const { WeightedImpactScorer } = require('../src/risk/impactScorer');
const { buildFinancialRiskSignal } = require('../src/domain/RiskSignal');

describe('Feature 3 risk signal prediction engine', () => {
  beforeEach(() => resetIngestionForTests());

  const createAnalyzedEvent = async ({ title, content, source = 'news', event_type = 'financial' }) => {
    const created = await request(app).post('/api/v1/events').send({
      source, title, content, published_at: '2026-10-08T12:00:00.000Z', language: 'en', event_type,
    }).expect(201);
    await request(app).post(`/api/v1/events/${created.body.data.id}/analyze`).expect(201);
    return created.body.data;
  };

  test.each([
    ['strongly positive', 'Tesla profit surges as strong demand drives record growth and upgraded guidance.', 'positive'],
    ['strongly negative', 'Tesla faces fraud allegations, severe losses, bankruptcy risk, and a major lawsuit.', 'negative'],
    ['neutral', 'Tesla held its regular investor meeting on Tuesday.', 'neutral'],
  ])('sentiment analyzer handles %s text', async (_name, text, expected) => {
    const event = await createAnalyzedEvent({ title: text, content: text });
    const signal = (await request(app).post(`/api/v1/events/${event.id}/signal`).expect(201)).body.data.signal;
    expect(signal.sentiment_label).toBe(expected);
    expect(signal.sentiment_score).toBeGreaterThanOrEqual(-1);
    expect(signal.sentiment_score).toBeLessThanOrEqual(1);
  });

  test.each([
    ['Geopolitical', ['geopolitical_event']], ['Macroeconomic', ['macroeconomic_event']],
    ['Credit Event', ['bankruptcy_risk']], ['Merger/Acquisition', ['acquisition']],
    ['Product Launch', ['product_launch']],
  ])('classifies %s events', (expected, event_types) => {
    const result = new NlpEventClassifier().classify({ event_types, financial_relevance: 0.8, evidence: ['support'] });
    expect(result.event_classification).toBe(expected);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test.each([
    ['Geopolitical', 'war and sanctions disrupt markets'], ['Macroeconomic', 'inflation and interest rates accelerate'],
    ['Credit Event', 'bankruptcy risk follows a debt default'], ['Merger/Acquisition', 'company announces an acquisition'],
    ['Product Launch', 'Apple unveils a new product'], ['Regulatory', 'regulators open an antitrust investigation'],
    ['Legal', 'company faces a class action lawsuit'], ['Earnings', 'quarterly earnings beat expectations'],
    ['Supply Chain', 'supply chain delays affect output'], ['Cybersecurity', 'ransomware data breach exposed users'],
  ])('recognizes the %s category from NLP evidence', (expected, text) => {
    expect(new NlpEventClassifier().classify({ event_types: ['general_financial_event'], financial_relevance: 0.7, evidence: [text] }, { title: text }).event_classification).toBe(expected);
  });

  test('configurable impact score distinguishes low and high impact and explains factors', () => {
    const scorer = new WeightedImpactScorer();
    const low = scorer.score({ analysis: { financial_relevance: 0.1 }, classification: { event_classification: 'Product Launch', confidence: 0.4 }, sentiment: { sentiment_score: 0, sentiment_label: 'neutral' }, event: { source: 'social' }, entity: null });
    const high = scorer.score({ analysis: { financial_relevance: 1 }, classification: { event_classification: 'Credit Event', confidence: 0.95 }, sentiment: { sentiment_score: -0.95, sentiment_label: 'negative' }, event: { source: 'news' }, entity: { canonical_name: 'Tesla', confidence: 0.99 } });
    expect(low.impact_score).toBeLessThan(high.impact_score);
    expect(high.impact_score).toBeGreaterThanOrEqual(8);
    expect(high.impact_score).toBeLessThanOrEqual(10);
    expect(high.reasoning.length).toBeGreaterThanOrEqual(4);
  });

  test('prevents invalid signal scores and clamps confidence boundaries', () => {
    const analyzer = new NlpAnalysisSentimentAnalyzer();
    expect(analyzer.analyze({ sentiment_score: -9, financial_relevance: 8 }).sentiment_score).toBe(-1);
    expect(analyzer.analyze({ sentiment_score: 9, financial_relevance: -8 }).sentiment_score).toBe(1);
    const scorer = new WeightedImpactScorer();
    const result = scorer.score({ analysis: { financial_relevance: 99 }, classification: { event_classification: 'Other', confidence: 99 }, sentiment: { sentiment_score: 0, sentiment_label: 'neutral' }, event: { source: 'unknown' }, entity: null });
    expect(result.impact_score).toBeGreaterThanOrEqual(1);
    expect(result.impact_score).toBeLessThanOrEqual(10);
    expect(result.impact_confidence).toBeGreaterThanOrEqual(0);
    expect(result.impact_confidence).toBeLessThanOrEqual(1);
    const bounded = buildFinancialRiskSignal({
      event: { id: 'evt-bounds', source: 'news' }, analysis: {}, entity: 'Example Co',
      sentiment: { sentiment_score: -8 }, classification: { event_classification: 'Other', confidence: 8 },
      impact: { impact_score: 99, impact_confidence: -3, reasoning: [], components: {} },
    });
    expect(bounded.sentiment_score).toBe(-1);
    expect(bounded.impact_score).toBe(10);
    expect(bounded.event_confidence).toBe(1);
    expect(bounded.impact_confidence).toBe(0);
    expect(bounded.overall_confidence).toBeGreaterThanOrEqual(0);
    expect(bounded.overall_confidence).toBeLessThanOrEqual(1);
  });

  test('signals persist, are deterministic per event, and expose all filters', async () => {
    const event = await createAnalyzedEvent({
      title: 'Tesla warns of major supply chain disruption after sanctions.',
      content: 'Tesla and Nvidia warn of supply chain risk after geopolitical sanctions cause delays and financial loss for key suppliers.',
    });
    const first = (await request(app).post(`/api/v1/events/${event.id}/signal`).expect(201)).body.data.signal;
    const second = (await request(app).post(`/api/v1/events/${event.id}/signal`).expect(200)).body.data.signal;
    expect(first.signal_id).toBe(second.signal_id);
    expect(first.sentiment_score).toBe(second.sentiment_score);
    expect(first.event_classification).toBe(second.event_classification);
    expect(first.impact_score).toBe(second.impact_score);
    const forEvent = (await request(app).get(`/api/v1/events/${event.id}/signal`).expect(200)).body.data;
    expect(forEvent.signal.signal_id).toBe(first.signal_id);
    expect(forEvent.signals).toHaveLength(2);
    expect((await request(app).get('/api/v1/signals').query({ entity: 'tesla', min_impact_score: 1, sentiment_label: 'negative' }).expect(200)).body.data).toHaveLength(1);
    expect((await request(app).get('/api/v1/signals').query({ event_classification: 'Geopolitical' }).expect(200)).body.data).toHaveLength(2);
    expect(first.overall_confidence).toBeGreaterThanOrEqual(0);
    expect(first.overall_confidence).toBeLessThanOrEqual(1);
    expect(first.explanation.reasoning.length).toBeGreaterThan(0);
  });

  test('requires Feature 2 analysis before creating a signal', async () => {
    const event = await createAnalyzedEvent({ title: 'Apple meets investors', content: 'Apple held its annual investor meeting.' });
    riskSignalService.riskRepository.reset();
    riskSignalService.analysisRepository.reset();
    await request(app).post(`/api/v1/events/${event.id}/signal`).expect(409);
  });
});
