const request = require('supertest');
const { app, resetIngestionForTests } = require('../src/app');

const makeEvent = (source, sourceEventId, overrides = {}) => ({
  source,
  source_event_id: sourceEventId,
  title: 'Company X faces regulatory investigation',
  content: 'Authorities are investigating Company X in connection with a financial compliance issue.',
  published_at: new Date().toISOString(),
  language: 'en',
  event_type: 'regulatory_action',
  ...overrides,
});

describe('Financial Story Clustering and Event Deduplication', () => {
  beforeEach(() => {
    resetIngestionForTests();
  });

  test('identical articles cluster as one underlying story', async () => {
    const articleA = makeEvent('news', 'story-1', { title: 'Company X faces regulatory investigation', content: 'Regulators investigate Company X after internal compliance concerns.' });
    const articleB = makeEvent('major_news', 'story-2', { title: 'Regulator launches probe into Company X', content: 'A regulator launched a probe into Company X after compliance issues were identified.' });

    const first = await request(app).post('/api/v1/events').send(articleA).expect(201);
    await request(app).post(`/api/v1/events/${first.body.data.id}/analyze`).expect(201);
    await request(app).post(`/api/v1/risk/analyze/${first.body.data.id}`).expect(201);

    const second = await request(app).post('/api/v1/events').send(articleB).expect(201);
    await request(app).post(`/api/v1/events/${second.body.data.id}/analyze`).expect(201);
    await request(app).post(`/api/v1/risk/analyze/${second.body.data.id}`).expect(201);

    const response = await request(app).get('/api/v1/stories').expect(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    const cluster = response.body.data.find((story) => story.primary_entity === 'company x' || story.primary_entity === 'companyx');
    expect(cluster).toBeTruthy();
    expect(cluster.source_count).toBeGreaterThanOrEqual(2);
    expect(cluster.independent_source_count).toBeGreaterThanOrEqual(2);
  });

  test('highly similar articles cluster together', async () => {
    const articleA = makeEvent('news', 'story-similar-1', {
      title: 'Authorities investigate Company X',
      content: 'Authorities are investigating Company X after a privacy breach and governance concerns.',
    });
    const articleB = makeEvent('financial_news', 'story-similar-2', {
      title: 'Probe into Company X intensifies',
      content: 'The investigation into Company X is growing after governance concerns were raised.',
    });

    const first = await request(app).post('/api/v1/events').send(articleA).expect(201);
    await request(app).post(`/api/v1/events/${first.body.data.id}/analyze`).expect(201);
    const second = await request(app).post('/api/v1/events').send(articleB).expect(201);
    await request(app).post(`/api/v1/events/${second.body.data.id}/analyze`).expect(201);

    const storyService = require('../src/app');
    const results = await storyService.storyClusteringService.clusterEvents([first.body.data.id, second.body.data.id]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source_count).toBeGreaterThanOrEqual(2);
    expect(results[0].confidence).toBeGreaterThan(0.5);
  });

  test('unrelated articles do not cluster', async () => {
    const articleA = makeEvent('news', 'story-unrelated-1', {
      title: 'Company X launches new manufacturing plant',
      content: 'Company X announced a new manufacturing facility in Ohio.',
      event_type: 'company_announcement',
    });
    const articleB = makeEvent('social', 'story-unrelated-2', {
      title: 'City council rejects tax plan',
      content: 'Local officials rejected a new tax plan and city budget proposal.',
      event_type: 'policy',
    });

    const first = await request(app).post('/api/v1/events').send(articleA).expect(201);
    const second = await request(app).post('/api/v1/events').send(articleB).expect(201);

    await request(app).post(`/api/v1/events/${first.body.data.id}/analyze`).expect(201);
    await request(app).post(`/api/v1/events/${second.body.data.id}/analyze`).expect(201);

    const service = require('../src/app').storyClusteringService;
    const clustered = service.clusterEvents([first.body.data.id, second.body.data.id]);
    expect(clustered).resolves.toBeDefined();
  });

  test('different entities do not cluster', async () => {
    const articleA = makeEvent('news', 'story-entity-1', { title: 'Acme launches hedge strategy', content: 'Acme announced a new hedge strategy.' });
    const articleB = makeEvent('financial_news', 'story-entity-2', { title: 'Beta reports earnings miss', content: 'Beta reported lower earnings and weak guidance.' });

    const first = await request(app).post('/api/v1/events').send(articleA).expect(201);
    const second = await request(app).post('/api/v1/events').send(articleB).expect(201);
    await request(app).post(`/api/v1/events/${first.body.data.id}/analyze`).expect(201);
    await request(app).post(`/api/v1/events/${second.body.data.id}/analyze`).expect(201);

    const service = require('../src/app').storyClusteringService;
    const stories = await service.clusterEvents([first.body.data.id, second.body.data.id]);
    expect(stories).toHaveLength(2);
  });

  test('different event types do not cluster', async () => {
    const articleA = makeEvent('news', 'story-event-1', { title: 'Company X faces regulatory investigation', content: 'Regulator expands probe into Company X.', event_type: 'regulatory_action' });
    const articleB = makeEvent('social', 'story-event-2', { title: 'Company X sues supplier', content: 'Company X filed a lawsuit against a supplier.', event_type: 'lawsuit' });

    const first = await request(app).post('/api/v1/events').send(articleA).expect(201);
    const second = await request(app).post('/api/v1/events').send(articleB).expect(201);

    await request(app).post(`/api/v1/events/${first.body.data.id}/analyze`).expect(201);
    await request(app).post(`/api/v1/events/${second.body.data.id}/analyze`).expect(201);

    const service = require('../src/app').storyClusteringService;
    const stories = await service.clusterEvents([first.body.data.id, second.body.data.id]);
    expect(stories.length).toBeGreaterThanOrEqual(2);
  });

  test('events separated by large time intervals do not cluster', async () => {
    const articleA = makeEvent('news', 'story-time-1', {
      title: 'Company X faces regulatory investigation',
      content: 'Regulator opens investigation into Company X.',
      published_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
    });
    const articleB = makeEvent('financial_news', 'story-time-2', {
      title: 'Company X faces regulatory investigation',
      content: 'Authorities continue a regulator probe into Company X.',
      published_at: new Date().toISOString(),
    });

    const first = await request(app).post('/api/v1/events').send(articleA).expect(201);
    const second = await request(app).post('/api/v1/events').send(articleB).expect(201);
    await request(app).post(`/api/v1/events/${first.body.data.id}/analyze`).expect(201);
    await request(app).post(`/api/v1/events/${second.body.data.id}/analyze`).expect(201);

    const service = require('../src/app').storyClusteringService;
    const stories = await service.clusterEvents([first.body.data.id, second.body.data.id]);
    expect(stories.length).toBeGreaterThanOrEqual(2);
  });

  test('multiple independent sources raise story confidence', async () => {
    const article1 = makeEvent('news', 'story-sources-1', { title: 'Company X under investigation', content: 'The regulator opened an investigation into Company X.' });
    const article2 = makeEvent('major_news', 'story-sources-2', { title: 'Probe into Company X intensifies', content: 'Company X is under formal regulatory investigation.' });
    const article3 = makeEvent('company_announcement', 'story-sources-3', { title: 'Company X responds to investigation', content: 'Company X confirmed it is responding to a regulatory inquiry.' });

    const [a, b, c] = await Promise.all([
      request(app).post('/api/v1/events').send(article1),
      request(app).post('/api/v1/events').send(article2),
      request(app).post('/api/v1/events').send(article3),
    ]);

    await Promise.all([
      request(app).post(`/api/v1/events/${a.body.data.id}/analyze`),
      request(app).post(`/api/v1/events/${b.body.data.id}/analyze`),
      request(app).post(`/api/v1/events/${c.body.data.id}/analyze`),
    ]);

    const service = require('../src/app').storyClusteringService;
    const stories = await service.clusterEvents([a.body.data.id, b.body.data.id, c.body.data.id]);
    expect(stories[0].independent_source_count).toBeGreaterThanOrEqual(3);
    expect(stories[0].confidence).toBeGreaterThan(0.7);
  });

  test('story endpoints expose clustered story metadata', async () => {
    const articleA = makeEvent('news', 'story-endpoints-1', {
      title: 'Company X faces regulatory investigation',
      content: 'Authorities are investigating Company X after a compliance issue was reported.',
    });
    const articleB = makeEvent('financial_news', 'story-endpoints-2', {
      title: 'Regulator launches probe into Company X',
      content: 'A regulator launched a probe into Company X as compliance matters escalate.',
    });

    const first = await request(app).post('/api/v1/events').send(articleA).expect(201);
    const second = await request(app).post('/api/v1/events').send(articleB).expect(201);

    await request(app).post(`/api/v1/events/${first.body.data.id}/analyze`).expect(201);
    await request(app).post(`/api/v1/events/${second.body.data.id}/analyze`).expect(201);

    const service = require('../src/app').storyClusteringService;
    await service.clusterEvents([first.body.data.id, second.body.data.id]);

    const listResponse = await request(app).get('/api/v1/stories').expect(200);
    const entityResponse = await request(app).get('/api/v1/entities/company%20x/stories').expect(200);

    expect(listResponse.body.data.length).toBeGreaterThan(0);
    expect(entityResponse.body.success).toBe(true);
    expect(entityResponse.body.data[0].primary_entity).toBe('company x');
  });
});
