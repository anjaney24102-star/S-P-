const { v4: uuidv4 } = require('uuid');
const { AlertRepository } = require('../repositories/alertRepository');

const defaultAlertConfig = {
  risk_score_threshold: 80,
  increase_threshold: 0.25,
  rapid_deterioration_threshold: 25,
  activity_spike_min_events: 5,
  activity_spike_multiplier: 2.5,
  cooldown_ms: 60 * 60 * 1000,
};

class AlertService {
  constructor({ riskRepository, alertRepository, config = {} } = {}) {
    this.riskRepository = riskRepository;
    this.alertRepository = alertRepository || new AlertRepository();
    this.config = { ...defaultAlertConfig, ...this.alertRepository.getConfig(), ...config };
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(updates = {}) {
    const nextConfig = { ...this.config, ...updates };
    this.config = nextConfig;
    if (this.alertRepository) {
      this.alertRepository.setConfig(nextConfig);
    }
    return { ...this.config };
  }

  getAlerts(options = {}) {
    if (this.riskRepository && typeof this.riskRepository.findAll === 'function') {
      this.riskRepository.findAll().forEach((signal) => {
        if (signal && signal.entity) {
          this.generateAlertsForSignal(signal);
        }
      });
    }

    const alerts = this.alertRepository ? this.alertRepository.findAll() : [];
    const { entity, acknowledged, riskLevel, source, eventType, since, limit = 50 } = options;

    return alerts
      .filter((alert) => {
        if (entity && String(alert.entity).toLowerCase() !== String(entity).toLowerCase()) {
          return false;
        }

        if (acknowledged !== undefined && Boolean(alert.acknowledged) !== Boolean(acknowledged)) {
          return false;
        }

        if (riskLevel && String(alert.severity).toLowerCase() !== String(riskLevel).toLowerCase()) {
          return false;
        }

        if (source && String(alert.metadata?.source || '').toLowerCase() !== String(source).toLowerCase()) {
          return false;
        }

        if (eventType && String(alert.metadata?.event_type || '').toLowerCase() !== String(eventType).toLowerCase()) {
          return false;
        }

        if (since) {
          const startTime = new Date(since).getTime();
          if (Number.isNaN(startTime)) {
            return false;
          }

          return new Date(alert.triggered_at).getTime() >= startTime;
        }

        return true;
      })
      .slice(0, Number(limit) || 50);
  }

  isDuplicateAlert(alert, signal) {
    const dedupeKey = [signal.entity || 'unknown', alert.alert_type, signal.event_id || signal.id].join('::');
    const cooldownMs = Number(this.config.cooldown_ms || 0);

    return (this.alertRepository?.findAll() || []).some((existing) => {
      const existingKey = [existing.entity, existing.alert_type, existing.metadata?.event_id || existing.metadata?.signal_id || existing.id].join('::');
      const tooRecent = Date.now() - new Date(existing.triggered_at).getTime() < cooldownMs;
      return existingKey === dedupeKey && tooRecent;
    });
  }

  getPreviousRiskScore(signal) {
    if (!this.riskRepository || typeof this.riskRepository.findByEntity !== 'function') {
      return null;
    }

    const entitySignals = this.riskRepository.findByEntity(signal.entity || 'Unknown entity');
    const currentTime = new Date(signal.created_at || Date.now()).getTime();
    const candidateSignals = entitySignals
      .filter((item) => item.id !== signal.id && item.event_id !== signal.event_id)
      .filter((item) => new Date(item.created_at || Date.now()).getTime() < currentTime)
      .sort((a, b) => new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now()));

    return candidateSignals.length ? Number(candidateSignals[0].risk_score || 0) : null;
  }

  isRapidDeterioration(signal) {
    const previousScore = this.getPreviousRiskScore(signal);
    if (previousScore === null) {
      return false;
    }

    return Number(signal.risk_score || 0) >= previousScore && (Number(signal.risk_score || 0) - previousScore) >= Number(this.config.rapid_deterioration_threshold || 25);
  }

  isActivitySpike(signal) {
    if (!this.riskRepository || typeof this.riskRepository.findByEntity !== 'function') {
      return false;
    }

    const entitySignals = this.riskRepository.findByEntity(signal.entity || 'Unknown entity');
    const recent = entitySignals.filter((item) => {
      const timestamp = new Date(item.created_at || Date.now()).getTime();
      return timestamp >= Date.now() - (6 * 60 * 60 * 1000);
    });

    return recent.length >= Number(this.config.activity_spike_min_events || 5)
      && Number(signal.risk_score || 0) >= Number(this.config.risk_score_threshold || 80);
  }

  buildAlert(signal, alertType, severity, message, metadata = {}) {
    const dedupeKey = [signal.entity || 'unknown', alertType, signal.event_id || signal.id].join('::');

    return {
      id: uuidv4(),
      entity: signal.entity || 'Unknown entity',
      alert_type: alertType,
      severity,
      message,
      triggered_at: new Date().toISOString(),
      risk_score: Number(signal.risk_score || 0),
      acknowledged: false,
      metadata: {
        ...metadata,
        event_id: signal.event_id || null,
        event_type: signal.event_type || null,
        source: signal.source || null,
        sector: signal.sector || null,
        dedupe_key: dedupeKey,
      },
    };
  }

  generateAlertsForSignal(signal) {
    if (!signal || !signal.entity) {
      return [];
    }

    const candidates = [];
    const currentRiskScore = Number(signal.risk_score || 0);
    const previousRiskScore = this.getPreviousRiskScore(signal);

    if (currentRiskScore >= Number(this.config.risk_score_threshold || 80)) {
      candidates.push(this.buildAlert(
        signal,
        'HIGH_RISK_SCORE',
        'CRITICAL',
        `${signal.entity} has exceeded the ${this.config.risk_score_threshold} risk threshold.`,
        { trigger: 'score_threshold' },
      ));
    }

    if (previousRiskScore !== null && currentRiskScore >= previousRiskScore && ((currentRiskScore - previousRiskScore) / Math.max(previousRiskScore, 1)) >= Number(this.config.increase_threshold || 0.25)) {
      candidates.push(this.buildAlert(
        signal,
        'RISK_SCORE_INCREASE',
        'HIGH',
        `${signal.entity} risk score increased by ${((currentRiskScore - previousRiskScore) / Math.max(previousRiskScore, 1) * 100).toFixed(1)}%.`,
        { trigger: 'score_increase', previous_risk_score: previousRiskScore },
      ));
    }

    if (this.isRapidDeterioration(signal)) {
      candidates.push(this.buildAlert(
        signal,
        'RAPID_DETERIORATION',
        'HIGH',
        `${signal.entity} is rapidly deteriorating after recent risk events.`,
        { trigger: 'rapid_deterioration', previous_risk_score: previousRiskScore },
      ));
    }

    if (this.isActivitySpike(signal)) {
      candidates.push(this.buildAlert(
        signal,
        'UNUSUAL_ACTIVITY_SPIKE',
        'HIGH',
        `${signal.entity} shows unusual risk activity compared with its recent baseline.`,
        { trigger: 'activity_spike' },
      ));
    }

    const severeEventTypes = ['regulatory_action', 'lawsuit', 'bankruptcy_risk', 'cybersecurity_incident', 'fraud_allegation'];
    if (severeEventTypes.includes(String(signal.event_type || '').toLowerCase())) {
      candidates.push(this.buildAlert(
        signal,
        'SEVERE_EVENT_TYPE',
        'HIGH',
        `${signal.entity} triggered a high-severity event type: ${signal.event_type}.`,
        { trigger: 'event_type' },
      ));
    }

    const createdAlerts = [];
    candidates.forEach((candidate) => {
      if (this.isDuplicateAlert(candidate, signal)) {
        return;
      }

      this.alertRepository.save(candidate);
      createdAlerts.push(candidate);
    });

    return createdAlerts;
  }

  acknowledgeAlert(alertId) {
    if (!this.alertRepository || typeof this.alertRepository.update !== 'function') {
      return null;
    }

    return this.alertRepository.update(alertId, (alert) => ({
      ...alert,
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    }));
  }

  reset() {
    if (this.alertRepository && typeof this.alertRepository.reset === 'function') {
      this.alertRepository.reset();
    }
  }
}

module.exports = { AlertService, defaultAlertConfig };
