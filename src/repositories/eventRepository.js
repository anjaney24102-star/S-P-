const fs = require('fs');
const path = require('path');

class EventRepository {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.events = [];
    this.byId = new Map();
    this.bySourceEventId = new Map();
    this.byContentHash = new Map();
    this.initialize();
  }

  initialize() {
    const directory = path.dirname(this.storagePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify({ events: [] }, null, 2));
    }

    const raw = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
    this.events = Array.isArray(raw.events) ? raw.events : [];
    this.buildIndexes();
  }

  buildIndexes() {
    this.byId.clear();
    this.bySourceEventId.clear();
    this.byContentHash.clear();

    this.events.forEach((event) => {
      this.byId.set(event.id, event);

      const sourceKeys = [];
      const sourceNormalized = String(event.source || '').trim().toLowerCase();
      const sourceId = event.source_id ?? event.source_event_id;

      if (sourceNormalized && sourceId) {
        sourceKeys.push(`${sourceNormalized}:${String(sourceId).trim()}`);
      }

      if (event.source_event_id) {
        sourceKeys.push(`${sourceNormalized}:${String(event.source_event_id).trim()}`);
      }

      if (event.source_id) {
        sourceKeys.push(`${sourceNormalized}:${String(event.source_id).trim()}`);
      }

      sourceKeys.forEach((key) => this.bySourceEventId.set(key, event));

      const hash = event.content_hash || event.metadata?.content_hash;
      if (hash) {
        this.byContentHash.set(hash, event);
      }
    });
  }

  persist() {
    const payload = { events: this.events };
    fs.writeFileSync(this.storagePath, JSON.stringify(payload, null, 2));
  }

  save(event) {
    const normalizedEvent = { ...event };
    if (!normalizedEvent.source_id && normalizedEvent.source_event_id) {
      normalizedEvent.source_id = normalizedEvent.source_event_id;
    }
    if (!normalizedEvent.source_event_id && normalizedEvent.source_id) {
      normalizedEvent.source_event_id = normalizedEvent.source_id;
    }
    if (!normalizedEvent.content_hash && normalizedEvent.metadata && normalizedEvent.metadata.content_hash) {
      normalizedEvent.content_hash = normalizedEvent.metadata.content_hash;
    }

    if (normalizedEvent && normalizedEvent.id && this.byId.has(normalizedEvent.id)) {
      const index = this.events.findIndex((item) => item.id === normalizedEvent.id);
      this.events[index] = normalizedEvent;
      this.buildIndexes();
      this.persist();
      return { duplicate: false, event: normalizedEvent };
    }

    const duplicateBySourceId = normalizedEvent.source_id
      ? this.bySourceEventId.get(`${String(normalizedEvent.source || '').toLowerCase()}:${String(normalizedEvent.source_id).trim()}`)
      : null;

    const duplicateByHash = normalizedEvent.content_hash ? this.byContentHash.get(normalizedEvent.content_hash) : null;

    if (duplicateBySourceId || duplicateByHash) {
      return {
        duplicate: true,
        event: duplicateBySourceId || duplicateByHash,
      };
    }

    this.events.push(normalizedEvent);
    this.buildIndexes();
    this.persist();

    return { duplicate: false, event: normalizedEvent };
  }

  findById(eventId) {
    return this.byId.get(eventId) || null;
  }

  findRecent(limit = 20) {
    return [...this.events]
      .sort((a, b) => new Date(b.ingested_at) - new Date(a.ingested_at))
      .slice(0, limit);
  }

  findAll({ source = null, page = 1, limit = 20 } = {}) {
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.max(1, Number(limit) || 20);

    let items = [...this.events].sort((a, b) => new Date(b.ingested_at) - new Date(a.ingested_at));

    if (source) {
      items = items.filter((item) => String(item.source || '').toLowerCase() === String(source).trim().toLowerCase());
    }

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNumber));
    const start = (pageNumber - 1) * limitNumber;

    return {
      items: items.slice(start, start + limitNumber),
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages,
      source: source ? String(source).trim().toLowerCase() : null,
    };
  }

  findBySourceEventId(source, sourceEventId) {
    const sourceKey = `${String(source || '').toLowerCase()}:${String(sourceEventId || '').trim()}`;
    return this.bySourceEventId.get(sourceKey) || null;
  }

  findByContentHash(contentHashValue) {
    return this.byContentHash.get(contentHashValue) || null;
  }

  reset() {
    this.events = [];
    this.byId.clear();
    this.bySourceEventId.clear();
    this.byContentHash.clear();
    this.persist();
  }
}

module.exports = { EventRepository };
