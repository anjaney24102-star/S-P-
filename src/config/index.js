const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const allowedSources = (process.env.ALLOWED_SOURCES || 'news,social,manual')
  .split(',')
  .map((source) => source.trim().toLowerCase())
  .filter(Boolean);

module.exports = {
  port: Number(process.env.PORT || 3000),
  allowedSources,
  storagePath: process.env.EVENT_STORAGE_PATH || path.join(process.cwd(), 'data', 'events.json'),
  analysisStoragePath: process.env.ANALYSIS_STORAGE_PATH || path.join(process.cwd(), 'data', 'analyses.json'),
  riskStoragePath: process.env.RISK_STORAGE_PATH || path.join(process.cwd(), 'data', 'risk_signals.json'),
  alertStoragePath: process.env.ALERT_STORAGE_PATH || path.join(process.cwd(), 'data', 'alerts.json'),
  alertConfigPath: process.env.ALERT_CONFIG_PATH || path.join(process.cwd(), 'data', 'alert-config.json'),
  logLevel: process.env.LOG_LEVEL || 'info',
  nlpModelName: process.env.NLP_MODEL_NAME || 'baseline-rule-based',
  nlpModelVersion: process.env.NLP_MODEL_VERSION || '1.0.0',
};
