const fs = require('fs');
const path = require('path');

class StoryRepository {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.stories = [];
    this.byId = new Map();
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
      fs.writeFileSync(this.storagePath, JSON.stringify({ stories: [] }, null, 2));
    }

    const raw = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
    this.stories = Array.isArray(raw.stories) ? raw.stories : [];
    this.rebuildIndex();
  }

  rebuildIndex() {
    this.byId.clear();
    this.byEventId.clear();
    this.byEntity.clear();

    this.stories.forEach((story) => {
      this.byId.set(story.id, story);

      (story.supporting_event_ids || []).forEach((eventId) => {
        this.byEventId.set(String(eventId), story);
      });

      if (story.primary_entity) {
        const key = String(story.primary_entity).toLowerCase();
        if (!this.byEntity.has(key)) {
          this.byEntity.set(key, []);
        }
        this.byEntity.get(key).push(story);
      }
    });
  }

  persist() {
    fs.writeFileSync(this.storagePath, JSON.stringify({ stories: this.stories }, null, 2));
  }

  save(story) {
    if (!story || !story.id) {
      throw new Error('Story requires an id.');
    }

    const index = this.stories.findIndex((item) => item.id === story.id);
    if (index >= 0) {
      this.stories[index] = story;
    } else {
      this.stories.push(story);
    }

    this.rebuildIndex();
    this.persist();
    return story;
  }

  findAll() {
    return [...this.stories];
  }

  findById(storyId) {
    return this.byId.get(storyId) || null;
  }

  findByEventId(eventId) {
    const story = this.byEventId.get(String(eventId));
    return story || null;
  }

  findByEntity(entityName) {
    const key = String(entityName || '').trim().toLowerCase();
    return key ? (this.byEntity.get(key) || []) : [];
  }

  findRecent(limit = 20) {
    return [...this.stories]
      .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at))
      .slice(0, Number(limit) || 20);
  }

  reset() {
    this.stories = [];
    this.byId.clear();
    this.byEventId.clear();
    this.byEntity.clear();
    this.persist();
  }
}

module.exports = { StoryRepository };
