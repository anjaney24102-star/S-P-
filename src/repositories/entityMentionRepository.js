const fs = require('fs');
const path = require('path');
const { buildEntityMention } = require('../domain/EntityMention');

class EntityMentionRepository {
  constructor(storagePath) {
    this.storagePath = storagePath; this.mentions = [];
    const directory = path.dirname(storagePath);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
    if (!fs.existsSync(storagePath)) fs.writeFileSync(storagePath, JSON.stringify({ mentions: [] }, null, 2));
    const raw = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    this.mentions = Array.isArray(raw.mentions) ? raw.mentions : [];
  }
  persist() { fs.writeFileSync(this.storagePath, JSON.stringify({ mentions: this.mentions }, null, 2)); }
  saveMany(mentions = []) {
    const eventIds = new Set(mentions.map((mention) => String(mention.event_id)));
    this.mentions = this.mentions.filter((mention) => !eventIds.has(String(mention.event_id)));
    this.mentions.push(...mentions.map(buildEntityMention)); this.persist(); return mentions;
  }
  findByEventId(eventId) { return this.mentions.filter((mention) => String(mention.event_id) === String(eventId)); }
  findByEntityId(entityId) { return this.mentions.filter((mention) => String(mention.entity_id) === String(entityId)); }
  reset() { this.mentions = []; this.persist(); }
}

module.exports = { EntityMentionRepository };
