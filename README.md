# Financial AI Risk Engine

## Feature 1: Real-Time Data Ingestion Engine

This project implements the ingestion foundation for a financial AI risk platform.

### Architecture

- Express API layer for HTTP ingestion endpoints
- Validation module for payload checks and normalization
- Source adapters for `news`, `social`, and `manual` sources
- Repository service with indexed duplicate detection and file-backed persistence
- Structured logging and configuration via environment variables

### Feature 2: NLP Intelligence Engine

The NLP layer is intentionally rule-based and deterministic by default so it runs fully locally without paid APIs or external model downloads.

Model behavior:
- Entity extraction uses keyword dictionaries for companies, organizations, people, countries, sectors, and financial instruments.
- Topic and event classification rely on deterministic financial keyword rules.
- Sentiment scoring is based on weighted positive and negative financial language.
- Relevance scoring measures whether the text meaningfully contains financial content.
- This is designed to be replaced later by an LLM or transformer-based model without changing the surrounding ingestion and API contracts.

Limitations:
- The baseline model is best for obvious financial language and keyword-heavy events.
- It may miss nuanced phrasing, sarcasm, or cross-domain context.
- Domain-specific entity recognition remains rule-driven and can be improved with a stronger model later.

### Run locally

```bash
npm install
cp .env.example .env
npm start
```

The service listens on port `3000` by default.

### API endpoints

- `POST /api/v1/events`
- `POST /api/v1/events/batch`
- `GET /api/v1/events/recent?limit=20`
- `GET /health`

### Example requests

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{
    "source": "news",
    "source_event_id": "news-1001",
    "title": "Fed signals caution on rate cuts",
    "content": "The Federal Reserve signaled caution about near-term rate cuts amid sticky inflation.",
    "url": "https://example.com/news/1001",
    "author": "Jane Doe",
    "published_at": "2026-10-08T09:30:00Z",
    "language": "en",
    "event_type": "macro"
  }'
```

```bash
curl -X POST http://localhost:3000/api/v1/events/REPLACE_WITH_EVENT_ID/analyze
```

```bash
curl "http://localhost:3000/api/v1/events/REPLACE_WITH_EVENT_ID/analysis"
```

```bash
curl "http://localhost:3000/api/v1/analyses/recent?limit=10"
```

### Tests

```bash
npm test
```
