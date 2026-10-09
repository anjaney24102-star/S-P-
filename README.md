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

News and social posts are accepted through `POST /api/v1/events` (or the batch endpoint), then analyzed with `POST /api/v1/events/{eventId}/analyze`. The analysis response and `GET /api/v1/analyses/recent` provide machine-readable `sentiment_score` (-1 to 1), `event_classification`, `impact_score` (1 to 10), and supporting `event_types`, entities, and evidence. The impact score is a deterministic severity estimate based on event type, sentiment magnitude, and financial relevance; it is not a market-price forecast. The local baseline uses keyword rules and should be calibrated against labeled examples before production decisions.

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

### Feature 3: Financial Risk Signal Prediction

After Feature 2 analysis completes, generate explainable signals with `POST /api/v1/events/{id}/signal`, retrieve them with `GET /api/v1/events/{id}/signal`, and list/filter signals with `GET /api/v1/signals?entity=Tesla&event_classification=Geopolitical&min_impact_score=6&sentiment_label=negative`. Each distinct company identified by NLP receives a signal; events without a company match receive an event-level signal. Generation is idempotent per event and company. The modular sentiment, event-classification, and impact-scoring interfaces consume the persisted NLP analysis; impact weights, category severities, and source reliability are configurable in `src/risk/impactScorer.js`. Scores estimate potential event impact and do not predict stock prices.

### Feature 4: Structured Risk Signal Output API

The downstream API exposes a stable nested signal schema with ISO-8601 timestamps, numeric sentiment and confidence, and integer impact scores. List endpoints use `{ data, meta }`; errors use `{ error: { code, message } }`. Filters include company, source, event classification, sentiment, minimum impact, and `from`/`to` timestamps. Pagination uses `page` and `limit` (maximum 100).

Endpoints: `GET /api/v1/signals`, `GET /api/v1/signals/:id`, `GET /api/v1/entities/:entity/signals`, and `GET /api/v1/signals/recent`.

Run `node scripts/example-client.js` to fetch recent signals and print the five highest impact results. Add `--export` to write the API schema as JSON Lines to `signals.jsonl`. Set `RISK_API_URL` to override the default API base URL.

### Run locally

```bash
npm install
cp .env.example .env
npm start
```

The service listens on port `3000` by default.

### Feature 8: Financial Entity Resolution

Canonical financial entities are stored in `data/entities.json`; resolved event mentions are persisted in `data/entity-mentions.json`. Each entity includes a stable ID, canonical name, ticker, entity type, sector, industry, country, aliases, metadata, and timestamps. Supported types are company, organization, government, person, country, and financial instrument.

The resolver applies exact ticker, canonical-name, alias, normalized-name, contextual alias, and conservative fuzzy strategies. Confidence thresholds and ambiguity margins are configurable in `EntityResolutionService`. Ambiguous or low-confidence matches remain unresolved and include alternatives. The strategy list is injectable so a trained NER/entity-linking provider can be added without changing persistence or API contracts.

NLP analyses include `resolved_entities`; risk signals include `entity_id` and use the canonical name when resolution meets the confidence threshold. Story clustering uses those canonical names. Signals for `Apple`, `Apple Inc.`, and `AAPL` therefore share `entity-apple` when resolved.

Entity endpoints:
- `GET /api/v1/entities?q=apple&type=company`
- `GET /api/v1/entities/:id`
- `GET /api/v1/entities/:id/events`
- `GET /api/v1/entities/:id/risk?window=24h`

### Feature 9: Risk Early Warning and Anomaly Detection

The early-warning service compares entity-linked risk activity in a selected window with a rolling 30-day baseline. It tracks event and negative-event rates, average risk scores, regulatory/legal activity, and source volume. Z-score and EWMA algorithms are modular strategies; insufficient history, too few distinct stories, and too few independent sources suppress a warning. Duplicate articles clustered into one story count as one event.

Warnings use `WATCH`, `ELEVATED`, `HIGH`, or `CRITICAL` severity, explain the baseline/current values and deviation, and are recorded in the existing alert engine. These signals detect unusual risk activity; they do not predict stock prices.

Early-warning endpoints:
- `GET /api/v1/warnings?window=6h&severity=HIGH`
- `GET /api/v1/entities/:id/warnings?window=24h`
- `GET /api/v1/entities/:id/baseline?window=24h`

Supported windows are `1h`, `6h`, `24h`, `7d`, and `30d`.

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
