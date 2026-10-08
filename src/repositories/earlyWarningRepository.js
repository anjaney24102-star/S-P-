const fs = require('fs');
const path = require('path');
const { buildEarlyWarningSignal } = require('../domain/EarlyWarningSignal');

class EarlyWarningRepository {
  constructor(storagePath) {
    this.storagePath = storagePath;
    const directory = path.dirname(storagePath);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
    if (!fs.existsSync(storagePath)) fs.writeFileSync(storagePath, JSON.stringify({ warnings: [] }, null, 2));
    const raw = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    this.warnings = Array.isArray(raw.warnings) ? raw.warnings : [];
  }
  persist() { fs.writeFileSync(this.storagePath, JSON.stringify({ warnings: this.warnings }, null, 2)); }
  findAll() { return [...this.warnings].sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at)); }
  findByEntityId(entityId) { return this.findAll().filter((warning) => String(warning.entity_id) === String(entityId)); }
  save(input, { cooldownMs = 0 } = {}) {
    const warning = buildEarlyWarningSignal(input);
    const recent = this.warnings.find((item) => item.entity_id === warning.entity_id
      && item.warning_type === warning.warning_type && item.window === warning.window
      && Date.now() - new Date(item.detected_at).getTime() < cooldownMs);
    if (recent) return { warning: recent, created: false };
    this.warnings.push(warning); this.persist(); return { warning, created: true };
  }
  reset() { this.warnings = []; this.persist(); }
}

module.exports = { EarlyWarningRepository };
