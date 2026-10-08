const fs = require('fs');
const path = require('path');

class RiskRepository {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.signals = [];
    this.byEventId = new Map();
    this.byEntity = new Map();
    this.initialize();
  }

  initialize() {
    const directory = path.dirname(this.storagePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify({ signals: [] }, null, 2));
    }

    const raw = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
    this.signals = Array.isArray(raw.signals) ? raw.signals : [];
    this.rebuildIndex();
  }

  rebuildIndex() {
    this.byEventId.clear();
    this.byEntity.clear();
    this.signals.forEach((signal) => {
      const eventId = signal.event_id;
      if (!this.byEventId.has(eventId)) this.byEventId.set(eventId, []);
      this.byEventId.get(eventId).push(signal);

      const key = String(signal.entity).toLowerCase();
      if (!this.byEntity.has(key)) this.byEntity.set(key, []);
      this.byEntity.get(key).push(signal);
    });
  }

  persist() {
    fs.writeFileSync(this.storagePath, JSON.stringify({ signals: this.signals }, null, 2));
  }

  save(signal) {
    this.signals.push(signal);
    this.rebuildIndex();
    this.persist();
    return signal;
  }

  findAll() {
    return [...this.signals];
  }

  findByEventId(eventId) {
    return this.byEventId.get(eventId) || [];
  }

  findByEntity(entityName) {
    const key = String(entityName).toLowerCase();
    return this.byEntity.get(key) || [];
  }

  findSignalsByEntity(entityName) {
    return this.findByEntity(entityName);
  }

  findBySector(sectorName) {
    const sector = String(sectorName || '').toLowerCase();
    return this.signals.filter((signal) => String(signal.sector || '').toLowerCase() === sector);
  }

  findByTimeRange(start, end) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();

    return this.signals.filter((signal) => {
      const value = new Date(signal.created_at).getTime();
      return value >= startMs && value <= endMs;
    });
  }

  findRecent(limit = 20) {
    return [...this.signals]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, Number(limit) || 20);
  }

  reset() {
    this.signals = [];
    this.byEventId.clear();
    this.byEntity.clear();
    this.persist();
  }
}

module.exports = { RiskRepository };
