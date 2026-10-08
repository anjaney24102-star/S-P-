const fs = require('fs');
const path = require('path');
const { normalizeSourceName } = require('../domain/SourceProfile');

class SourceProfileRepository {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.profiles = [];
    this.bySourceName = new Map();
    this.initialize();
  }

  initialize() {
    const directory = path.dirname(this.storagePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify({ sourceProfiles: [] }, null, 2));
    }

    const raw = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
    this.profiles = Array.isArray(raw.sourceProfiles) ? raw.sourceProfiles : [];
    this.rebuildIndex();
  }

  rebuildIndex() {
    this.bySourceName.clear();
    this.profiles.forEach((profile) => {
      const key = normalizeSourceName(profile.source_name);
      this.bySourceName.set(key, profile);
    });
  }

  persist() {
    fs.writeFileSync(this.storagePath, JSON.stringify({ sourceProfiles: this.profiles }, null, 2));
  }

  save(profile) {
    const key = normalizeSourceName(profile.source_name);
    const existingIndex = this.profiles.findIndex((item) => normalizeSourceName(item.source_name) === key);

    if (existingIndex >= 0) {
      this.profiles[existingIndex] = {
        ...this.profiles[existingIndex],
        ...profile,
        source_name: key,
        updated_at: profile.updated_at || new Date().toISOString(),
      };
    } else {
      this.profiles.push({
        ...profile,
        source_name: key,
        created_at: profile.created_at || new Date().toISOString(),
        updated_at: profile.updated_at || profile.created_at || new Date().toISOString(),
      });
    }

    this.rebuildIndex();
    this.persist();
    return this.bySourceName.get(key) || profile;
  }

  findAll() {
    return [...this.profiles].sort((a, b) => (b.credibility_score || 0) - (a.credibility_score || 0));
  }

  findBySource(sourceName) {
    return this.bySourceName.get(normalizeSourceName(sourceName)) || null;
  }

  reset() {
    this.profiles = [];
    this.bySourceName.clear();
    this.persist();
  }
}

module.exports = { SourceProfileRepository };
