const fs = require('fs');
const path = require('path');

class AnalysisRepository {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.analyses = [];
    this.byEventId = new Map();
    this.initialize();
  }

  initialize() {
    const directory = path.dirname(this.storagePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify({ analyses: [] }, null, 2));
    }

    const raw = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
    this.analyses = Array.isArray(raw.analyses) ? raw.analyses : [];
    this.rebuildIndex();
  }

  rebuildIndex() {
    this.byEventId.clear();
    this.analyses.forEach((analysis) => {
      this.byEventId.set(analysis.event_id, analysis);
    });
  }

  persist() {
    fs.writeFileSync(this.storagePath, JSON.stringify({ analyses: this.analyses }, null, 2));
  }

  save(analysis) {
    const existing = this.byEventId.get(analysis.event_id);

    if (existing) {
      const index = this.analyses.findIndex((item) => item.event_id === analysis.event_id);
      this.analyses[index] = analysis;
    } else {
      this.analyses.push(analysis);
    }

    this.rebuildIndex();
    this.persist();
    return analysis;
  }

  findByEventId(eventId) {
    return this.byEventId.get(eventId) || null;
  }

  findRecent(limit = 20) {
    return [...this.analyses]
      .sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at))
      .slice(0, Number(limit) || 20);
  }

  reset() {
    this.analyses = [];
    this.byEventId.clear();
    this.persist();
  }
}

module.exports = { AnalysisRepository };
