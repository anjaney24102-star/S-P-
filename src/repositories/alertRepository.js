const fs = require('fs');
const path = require('path');

class AlertRepository {
  constructor(storagePath, configStoragePath) {
    this.storagePath = storagePath || path.join(process.cwd(), 'data', 'alerts.json');
    this.configStoragePath = configStoragePath || path.join(process.cwd(), 'data', 'alert-config.json');
    this.alerts = [];
    this.config = {};
    this.initialize();
  }

  initialize() {
    const directory = path.dirname(this.storagePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (!fs.existsSync(this.storagePath)) {
      fs.writeFileSync(this.storagePath, JSON.stringify({ alerts: [] }, null, 2));
    }

    if (!fs.existsSync(this.configStoragePath)) {
      fs.writeFileSync(this.configStoragePath, JSON.stringify({
        risk_score_threshold: 80,
        increase_threshold: 0.25,
        rapid_deterioration_threshold: 25,
        activity_spike_min_events: 5,
        activity_spike_multiplier: 2.5,
        cooldown_ms: 60 * 60 * 1000,
      }, null, 2));
    }

    const alertsRaw = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
    this.alerts = Array.isArray(alertsRaw.alerts) ? alertsRaw.alerts : [];

    const configRaw = JSON.parse(fs.readFileSync(this.configStoragePath, 'utf8'));
    this.config = configRaw || {};
  }

  persist() {
    fs.writeFileSync(this.storagePath, JSON.stringify({ alerts: this.alerts }, null, 2));
  }

  persistConfig() {
    fs.writeFileSync(this.configStoragePath, JSON.stringify(this.config, null, 2));
  }

  save(alert) {
    this.alerts.push(alert);
    this.persist();
    return alert;
  }

  findAll() {
    return [...this.alerts].sort((a, b) => new Date(b.triggered_at) - new Date(a.triggered_at));
  }

  findById(alertId) {
    return this.alerts.find((alert) => String(alert.id) === String(alertId)) || null;
  }

  update(alertId, updater) {
    const index = this.alerts.findIndex((alert) => String(alert.id) === String(alertId));
    if (index === -1) {
      return null;
    }

    this.alerts[index] = { ...this.alerts[index], ...updater(this.alerts[index]) };
    this.persist();
    return this.alerts[index];
  }

  setConfig(nextConfig) {
    this.config = { ...this.config, ...nextConfig };
    this.persistConfig();
    return { ...this.config };
  }

  getConfig() {
    return { ...this.config };
  }

  reset() {
    this.alerts = [];
    this.persist();
  }
}

module.exports = { AlertRepository };
