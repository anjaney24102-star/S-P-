const fs = require('fs');
const path = require('path');
const { buildEntityRiskBaseline } = require('../domain/EntityRiskBaseline');

class EntityRiskBaselineRepository {
  constructor(storagePath) {
    this.storagePath = storagePath;
    const directory = path.dirname(storagePath);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
    if (!fs.existsSync(storagePath)) fs.writeFileSync(storagePath, JSON.stringify({ baselines: [] }, null, 2));
    const raw = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    this.baselines = Array.isArray(raw.baselines) ? raw.baselines : [];
  }
  persist() { fs.writeFileSync(this.storagePath, JSON.stringify({ baselines: this.baselines }, null, 2)); }
  findByEntityId(entityId) { return this.baselines.find((item) => String(item.entity_id) === String(entityId)) || null; }
  findAll() { return [...this.baselines]; }
  save(input) {
    const baseline = buildEntityRiskBaseline(input);
    const index = this.baselines.findIndex((item) => String(item.entity_id) === baseline.entity_id);
    if (index >= 0) this.baselines[index] = baseline; else this.baselines.push(baseline);
    this.persist(); return baseline;
  }
  reset() { this.baselines = []; this.persist(); }
}

module.exports = { EntityRiskBaselineRepository };
