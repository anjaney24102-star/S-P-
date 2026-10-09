const request = require('supertest');
const { app, resetIngestionForTests } = require('../src/app');
const { toJsonLines } = require('../src/utils/signalExport');

describe('Feature 4 structured risk signal output API', () => {
  beforeEach(() => resetIngestionForTests());

  const ingestAnalyzeSignal = async ({ source, source_event_id, title, content, event_type = 'financial' }) => {
    const response = await request(app).post('/api/v1/events').send({
      source, source_event_id, title, content,
      published_at: '2026-10-08T12:00:00.000Z', language: 'en', event_type,
    }).expect(201);
    const event = response.body.data;
    await request(app).post(`/api/v1/events/${event.id}/analyze`).expect(201);
    const generated = await request(app).post(`/api/v1/events/${event.id}/signal`).expect(201);
    return { event, signals: generated.body.data.signals };
  };

  const fixtures = async () => {
    const news = await ingestAnalyzeSignal({
      source: 'news', source_event_id: 'output-news-1',
      title: 'Tesla faces geopolitical supply risk after sanctions',
      content: 'Geopolitical sanctions disrupt Tesla supply chain, creating production delays and financial risk.',
    });
    const social = await ingestAnalyzeSignal({
      source: 'social', source_event_id: 'output-social-1',
      title: 'Apple reports strong demand',
      content: 'Apple profit grows as strong demand lifts revenue and investors welcome the earnings beat.',
    });
    return { news, social };
  };

  test('news and social pipelines produce the same typed schema', async () => {
    const { news, social } = await fixtures();
    const response = await request(app).get('/api/v1/signals?limit=10').expect(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta', { page: 1, limit: 10, total: 2 });
    const newsSignal = response.body.data.find((item) => item.event_id === news.event.id);
    const socialSignal = response.body.data.find((item) => item.event_id === social.event.id);
    expect(newsSignal.source).toBe('news');
    expect(socialSignal.source).toBe('social');
    [newsSignal, socialSignal].forEach((signal) => {
      expect(Object.keys(signal)).toEqual(['signal_id', 'event_id', 'timestamp', 'source', 'company', 'sentiment', 'event', 'impact', 'overall_confidence', 'explanation']);
      expect(typeof signal.sentiment.score).toBe('number');
      expect(['positive', 'neutral', 'negative']).toContain(signal.sentiment.label);
      expect(Number.isInteger(signal.impact.score)).toBe(true);
      expect(signal.impact.score).toBeGreaterThanOrEqual(1);
      expect(signal.impact.score).toBeLessThanOrEqual(10);
      expect(signal.timestamp).toBe(new Date(signal.timestamp).toISOString());
      expect(signal.explanation.every((line) => typeof line === 'string')).toBe(true);
    });
  });

  test('retrieves one signal and recent signals with pagination metadata', async () => {
    await fixtures();
    const page = await request(app).get('/api/v1/signals/recent?page=2&limit=1').expect(200);
    expect(page.body.meta).toEqual({ page: 2, limit: 1, total: 2 });
    expect(page.body.data).toHaveLength(1);
    const { signal_id } = page.body.data[0];
    const individual = await request(app).get(`/api/v1/signals/${signal_id}`).expect(200);
    expect(individual.body.data.signal_id).toBe(signal_id);
    expect(individual.body.meta).toEqual({ page: 1, limit: 1, total: 1 });
  });

  test('filters signals by company, source, event, sentiment, impact, and date range', async () => {
    const { news } = await fixtures();
    const base = '/api/v1/signals';
    expect((await request(app).get(base).query({ company: 'Tesla' })).body.data).toHaveLength(1);
    expect((await request(app).get(base).query({ source: 'social' })).body.data).toHaveLength(1);
    expect((await request(app).get(base).query({ event_classification: 'Geopolitical' })).body.data).toHaveLength(1);
    expect((await request(app).get(base).query({ sentiment: 'negative' })).body.data).toHaveLength(1);
    const impactFiltered = (await request(app).get(base).query({ min_impact_score: 7 })).body.data;
    expect(impactFiltered).toHaveLength(2);
    expect(impactFiltered.every((signal) => signal.impact.score >= 7)).toBe(true);
    expect((await request(app).get(base).query({ from: '2026-10-08T00:00:00Z', to: '2026-10-08T23:59:59Z' })).body.data).toHaveLength(2);
    expect((await request(app).get(`/api/v1/entities/Tesla/signals`)).body.meta.total).toBe(1);
    expect((await request(app).get(base).query({ from: '2026-10-09T00:00:00Z' })).body.data).toHaveLength(0);
    expect(news.signals[0].event_id).toBe(news.event.id);
  });

  test('validates query parameters and returns structured errors without internals', async () => {
    for (const query of [
      { page: '0' }, { limit: 'many' }, { min_impact_score: '11' },
      { sentiment: 'bullish' }, { from: 'not-a-date' },
      { from: '2026-10-09T00:00:00Z', to: '2026-10-08T00:00:00Z' },
    ]) {
      const response = await request(app).get('/api/v1/signals').query(query).expect(400);
      expect(response.body.error.code).toBe('INVALID_PARAMETER');
      expect(response.body.error.message).toBeDefined();
      expect(response.body).not.toHaveProperty('stack');
    }
  });

  test('returns consistent empty list metadata and structured not-found errors', async () => {
    const empty = await request(app).get('/api/v1/signals').expect(200);
    expect(empty.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
    const missing = await request(app).get('/api/v1/signals/sig_missing').expect(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    expect(missing.body).not.toHaveProperty('stack');
  });

  test('exports complete signals as one JSON object per line', async () => {
    await fixtures();
    const { data } = await request(app).get('/api/v1/signals').expect(200).then((response) => response.body);
    const jsonl = toJsonLines(data);
    const lines = jsonl.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => JSON.parse(line))).toEqual(data);
    expect(toJsonLines([])).toBe('');
    expect(() => toJsonLines({})).toThrow('signals must be an array');
  });
});
