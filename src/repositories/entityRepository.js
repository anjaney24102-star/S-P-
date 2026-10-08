const fs = require('fs');
const path = require('path');
const { buildFinancialEntity } = require('../domain/FinancialEntity');

class EntityRepository {
  constructor(storagePath, initialEntities = []) {
    this.storagePath = storagePath;
    this.entities = [];
    this.byId = new Map();
    this.initialize(initialEntities);
  }

  initialize(initialEntities) {
    const directory = path.dirname(this.storagePath);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
    if (!fs.existsSync(this.storagePath)) {
      this.entities = initialEntities.map(buildFinancialEntity);
      this.persist();
    } else {
      const raw = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
      this.entities = (Array.isArray(raw.entities) ? raw.entities : []).map((entity) => buildFinancialEntity(entity));
    }
    this.rebuildIndex();
  }

  rebuildIndex() { this.byId = new Map(this.entities.map((entity) => [entity.id, entity])); }
  persist() { fs.writeFileSync(this.storagePath, JSON.stringify({ entities: this.entities }, null, 2)); }
  findAll() { return [...this.entities]; }
  findById(id) { return this.byId.get(String(id)) || null; }
  save(input) {
    const entity = buildFinancialEntity(input);
    const index = this.entities.findIndex((item) => item.id === entity.id);
    if (index >= 0) { entity.created_at = this.entities[index].created_at; entity.updated_at = new Date().toISOString(); this.entities[index] = entity; }
    else this.entities.push(entity);
    this.rebuildIndex(); this.persist(); return entity;
  }
}

module.exports = { EntityRepository };
