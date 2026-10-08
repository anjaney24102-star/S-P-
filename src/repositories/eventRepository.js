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

      if (event.source_event_id) {
        this.bySourceEventId.set(`${event.source}:${event.source_event_id}`, event);
      }

      if (event.content_hash) {
        this.byContentHash.set(event.content_hash, event);
      }
    });
  }

  persist() {
    const payload = { events: this.events };
    fs.writeFileSync(this.storagePath, JSON.stringify(payload, null, 2));
  }

  save(event) {
    if (event && event.id && this.byId.has(event.id)) {
      const index = this.events.findIndex((item) => item.id === event.id);
      this.events[index] = event;
      this.buildIndexes();
      this.persist();
      return { duplicate: false, event };
    }

    const duplicateBySourceId = event.source_event_id
      ? this.bySourceEventId.get(`${event.source}:${event.source_event_id}`)
      : null;

    const duplicateByHash = event.content_hash ? this.byContentHash.get(event.content_hash) : null;

    if (duplicateBySourceId || duplicateByHash) {
      return {
        duplicate: true,
        event: duplicateBySourceId || duplicateByHash,
      };
    }

    this.events.push(event);
    this.buildIndexes();
    this.persist();

    return { duplicate: false, event };
  }

  findById(eventId) {
    return this.byId.get(eventId) || null;
  }

  findRecent(limit = 20) {
    return [...this.events]
      .sort((a, b) => new Date(b.ingested_at) - new Date(a.ingested_at))
      .slice(0, limit);
  }

  findBySourceEventId(source, sourceEventId) {
    return this.bySourceEventId.get(`${String(source).toLowerCase()}:${String(sourceEventId).trim()}`) || null;
  }

  findByContentHash(contentHash) {
    return this.byContentHash.get(contentHash) || null;
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
