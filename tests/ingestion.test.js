const request = require('supertest');
const { app, resetIngestionForTests } = require('../src/app');

describe('Financial Event Ingestion', () => {
  beforeEach(() => {
    resetIngestionForTests();
  });

  test('valid ingestion', async () => {
    const payload = {
      source: 'news',
      source_event_id: 'news-1001',
      title: 'Fed signals caution on rate cuts',
      content: 'The Federal Reserve signaled caution about near-term rate cuts amid sticky inflation.',
      url: 'https://example.com/news/1001',
      author: 'Jane Doe',
      published_at: '2026-10-08T09:30:00Z',
      language: 'en',
      event_type: 'macro'
    };

    const response = await request(app)
      .post('/api/v1/events')
      .send(payload)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.source).toBe('news');
    expect(response.body.data.title).toBe('Fed signals caution on rate cuts');
    expect(response.body.data.content).toContain('Federal Reserve');
  });

  test('invalid payload', async () => {
    const response = await request(app)
      .post('/api/v1/events')
      .send({
        source: 'news',
        title: 'Missing content'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });

  test('duplicate event', async () => {
    const payload = {
      source: 'social',
      source_event_id: 'social-dup-1',
      title: 'Bank turmoil concerns grow',
      content: 'Investors are increasingly worried about broader banking stress after fresh volatility.',
      published_at: '2026-10-08T10:00:00Z',
      language: 'en',
      event_type: 'market'
    };

    await request(app).post('/api/v1/events').send(payload).expect(201);
    const duplicate = await request(app).post('/api/v1/events').send(payload).expect(409);

    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.error.code).toBe('DUPLICATE_EVENT');
  });

  test('batch ingestion', async () => {
    const response = await request(app)
      .post('/api/v1/events/batch')
      .send({
        events: [
          {
            source: 'news',
            source_event_id: 'batch-1',
            title: 'Chip maker warns of slower shipping',
            content: 'A major chipmaker warned that shipping schedules are slipping as demand cools.',
            published_at: '2026-10-08T11:00:00Z',
            language: 'en',
            event_type: 'supply'
          },
          {
            source: 'manual',
            source_event_id: 'batch-2',
            title: 'Analyst alert: export restrictions',
            content: 'Analysts flagged export restrictions as a risk factor for the industrial sector.',
            published_at: '2026-10-08T11:15:00Z',
            language: 'en',
            event_type: 'policy'
          }
        ]
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.inserted).toBe(2);
    expect(response.body.data.skipped).toBe(0);
  });

  test('missing required fields', async () => {
    const response = await request(app)
      .post('/api/v1/events')
      .send({
        source: 'news',
        published_at: '2026-10-08T12:00:00Z'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(/title|content|event_type/i);
  });

  test('text normalization', async () => {
    const payload = {
      source: 'manual',
      source_event_id: 'manual-1',
      title: '  DATA CENTER  ALERT   ',
      content: '   Major   cyber  incident detected   across  supplier network.  ',
      published_at: '2026-10-08T08:45:00Z',
      language: 'en',
      event_type: 'cyber'
    };

    const response = await request(app)
      .post('/api/v1/events')
      .send(payload)
      .expect(201);

    expect(response.body.data.title).toBe('DATA CENTER ALERT');
    expect(response.body.data.content).toBe('Major cyber incident detected across supplier network.');
  });
});
