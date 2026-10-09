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

  test('news ingestion via normalized text endpoint', async () => {
    const payload = {
      source_id: 'news-8801',
      title: '  Bank shares rise after earnings beat   ',
      text: '  Bank shares rose after a strong earnings report and improved guidance.\n\nAnalysts praised the quarter.  ',
      author: '  Nina Hart  ',
      url: 'https://example.com/news/8801',
      published_at: '2026-10-08T09:00:00Z',
      language: 'en',
    };

    const response = await request(app)
      .post('/api/v1/ingest/news')
      .send(payload)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.source).toBe('news');
    expect(response.body.data.source_id).toBe('news-8801');
    expect(response.body.data.text).toBe('Bank shares rose after a strong earnings report and improved guidance. Analysts praised the quarter.');
    expect(response.body.data.content).toBe(response.body.data.text);
    expect(response.body.data.metadata.content_hash).toBeDefined();
  });

  test('social ingestion via normalized text endpoint', async () => {
    const payload = {
      source_id: 'tweet-2201',
      text: '  @trader123 says the market is stabilizing after yesterday\'s selloff.  ',
      author: 'trader123',
      url: 'https://x.com/trader123/status/2201',
      published_at: '2026-10-08T10:30:00Z',
      language: 'en',
    };

    const response = await request(app)
      .post('/api/v1/ingest/social')
      .send(payload)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.source).toBe('social');
    expect(response.body.data.text).toContain('market is stabilizing');
    expect(response.body.data.author).toBe('trader123');
  });

  test('invalid normalized payload is rejected', async () => {
    const response = await request(app)
      .post('/api/v1/ingest/news')
      .send({
        source_id: 'invalid-1',
        title: 'Missing text',
        published_at: 'not-a-date',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(/text|timestamp|published_at/i);
  });

  test('empty text is rejected', async () => {
    const response = await request(app)
      .post('/api/v1/ingest/social')
      .send({
        source_id: 'empty-1',
        text: '   \n  \t  ',
        published_at: '2026-10-08T11:00:00Z',
        language: 'en',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });

  test('duplicate news article is rejected', async () => {
    const payload = {
      source_id: 'news-dup-9',
      title: 'Earnings beat boosts sentiment',
      text: '  Company shares gained after a strong earnings release.  ',
      published_at: '2026-10-08T11:45:00Z',
      language: 'en',
    };

    await request(app).post('/api/v1/ingest/news').send(payload).expect(201);
    const duplicate = await request(app).post('/api/v1/ingest/news').send(payload).expect(409);

    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.error.code).toBe('DUPLICATE_EVENT');
  });

  test('duplicate social post is rejected', async () => {
    const payload = {
      source_id: 'post-dup-7',
      text: '  Volatility is easing as traders return to the market.  ',
      published_at: '2026-10-08T12:15:00Z',
      language: 'en',
    };

    await request(app).post('/api/v1/ingest/social').send(payload).expect(201);
    const duplicate = await request(app).post('/api/v1/ingest/social').send(payload).expect(409);

    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.error.code).toBe('DUPLICATE_EVENT');
  });

  test('pagination works for event listing', async () => {
    const events = [
      { source_id: 'page-1', source: 'news', title: 'A', text: 'Alpha', published_at: '2026-10-08T00:00:00Z', language: 'en' },
      { source_id: 'page-2', source: 'news', title: 'B', text: 'Bravo', published_at: '2026-10-08T00:01:00Z', language: 'en' },
      { source_id: 'page-3', source: 'social', title: 'C', text: 'Charlie', published_at: '2026-10-08T00:02:00Z', language: 'en' },
      { source_id: 'page-4', source: 'social', title: 'D', text: 'Delta', published_at: '2026-10-08T00:03:00Z', language: 'en' },
    ];

    for (const event of events) {
      await request(app)
        .post(event.source === 'news' ? '/api/v1/ingest/news' : '/api/v1/ingest/social')
        .send(event)
        .expect(201);
    }

    const pageOne = await request(app).get('/api/v1/events?page=1&limit=2').expect(200);
    const pageTwo = await request(app).get('/api/v1/events?page=2&limit=2').expect(200);

    expect(pageOne.body.success).toBe(true);
    expect(pageOne.body.data.items).toHaveLength(2);
    expect(pageTwo.body.data.items).toHaveLength(2);
    expect(pageOne.body.data.total).toBe(4);
    expect(pageTwo.body.data.page).toBe(2);
  });

  test('source filtering works for event listing', async () => {
    await request(app).post('/api/v1/ingest/news').send({ source_id: 'filter-news-1', title: 'News story', text: 'Market optimism improves.', published_at: '2026-10-08T00:00:00Z', language: 'en' }).expect(201);
    await request(app).post('/api/v1/ingest/social').send({ source_id: 'filter-social-1', text: 'Strong buying sentiment remains.', published_at: '2026-10-08T00:05:00Z', language: 'en' }).expect(201);

    const response = await request(app).get('/api/v1/events?source=news').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.items.every((item) => item.source === 'news')).toBe(true);
    expect(response.body.data.total).toBe(1);
  });
});
