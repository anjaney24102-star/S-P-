const { SourceProfileRepository } = require('../repositories/sourceProfileRepository');
const { buildSourceProfile } = require('../domain/SourceProfile');
const { credibility: credibilityConfig } = require('../config/credibilityConfig');
const { sourceProfileStoragePath } = require('../config');

class CredibilityService {
  constructor({ repository, config = credibilityConfig } = {}) {
    this.repository = repository || new SourceProfileRepository(sourceProfileStoragePath);
    this.config = config;
  }

  normalizeSource(sourceName) {
    return String(sourceName || '').trim().toLowerCase();
  }

  classifySource(sourceName, sourceTypeHint) {
    const value = this.normalizeSource(sourceName);
    if (sourceTypeHint && this.config.sourceTypes.includes(sourceTypeHint)) {
      return sourceTypeHint;
    }

    if (!value) {
      return 'unknown';
    }

    const rules = [
      ['official_filing', ['sec', 'edgar', 'filing', 'regulator', 'regulatory', 'quarterly', 'annual report', 'filings']],
      ['company_announcement', ['company announcement', 'announcement', 'press release', 'investor relations', 'earnings release', 'corporate update']],
      ['major_news', ['reuters', 'apnews', 'associated press', 'bloomberg', 'wsj', 'ft', 'financial times', 'cnn business', 'politico']],
      ['financial_news', ['marketwatch', 'investing.com', 'tradingview', 'the street', 'financial news', 'finance', 'stock market', 'equity']],
      ['local_news', ['local', 'city', 'regional', 'gazette', 'tribune', 'chronicle', 'daily', 'newsroom']],
      ['social_media', ['twitter', 'x.com', 'x', 'reddit', 'social', 'tweet', 'forum', 'tiktok', 'linkedin', 'blog']],
    ];

    for (const [type, keywords] of rules) {
      if (keywords.some((keyword) => value.includes(keyword))) {
        return type;
      }
    }

    return 'unknown';
  }

  getBaselineScore(sourceType) {
    return Number(this.config.baselineScores[sourceType] ?? this.config.baselineScores.unknown ?? 0.35);
  }

  getVerificationConfidence(verificationStatus) {
    const status = String(verificationStatus || 'unverified').trim().toLowerCase();
    return Number(this.config.verificationStatus[status] ?? this.config.verificationStatus.unknown ?? 0.35);
  }

  resolveVerificationStatus(sourceType) {
    if (sourceType === 'official_filing') return 'verified';
    if (sourceType === 'company_announcement') return 'verified';
    if (sourceType === 'major_news' || sourceType === 'financial_news') return 'partially_verified';
    if (sourceType === 'local_news' || sourceType === 'social_media') return 'unverified';
    return 'unverified';
  }

  calculateSourceCredibility(sourceName, { sourceType, historicalAccuracy, verificationStatus } = {}) {
    const resolvedType = this.classifySource(sourceName, sourceType);
    const baseline = this.getBaselineScore(resolvedType);
    const resolvedVerificationStatus = verificationStatus || this.resolveVerificationStatus(resolvedType);
    const verificationConfidence = this.getVerificationConfidence(resolvedVerificationStatus);

    const historical = typeof historicalAccuracy === 'number'
      ? Number(historicalAccuracy)
      : null;

    const baseScore = baseline * 0.7 + verificationConfidence * 0.3;
    const adjustedScore = historical !== null
      ? Math.min(1, Math.max(0, baseScore * 0.7 + historical * 0.3))
      : baseScore;

    return {
      source_name: this.normalizeSource(sourceName) || 'unknown',
      source_type: resolvedType,
      credibility_score: Number(Math.min(1, Math.max(0, adjustedScore)).toFixed(4)),
      historical_accuracy: historical !== null ? Number(Math.min(1, Math.max(0, historical)).toFixed(4)) : null,
      verification_status: resolvedVerificationStatus,
      verification_confidence: Number(Math.min(1, Math.max(0, verificationConfidence)).toFixed(4)),
    };
  }

  getSourceProfile(sourceName) {
    return this.repository.findBySource(sourceName);
  }

  getAllSources() {
    return this.repository.findAll();
  }

  upsertSourceProfile(profileInput = {}) {
    const sourceName = profileInput.source_name || profileInput.sourceName || 'unknown';
    const computed = this.calculateSourceCredibility(sourceName, {
      sourceType: profileInput.source_type || profileInput.sourceType,
      historicalAccuracy: profileInput.historical_accuracy ?? profileInput.historicalAccuracy,
      verificationStatus: profileInput.verification_status || profileInput.verificationStatus,
    });

    const existing = this.repository.findBySource(sourceName);
    const current = buildSourceProfile({
      sourceName: computed.source_name,
      sourceType: computed.source_type,
      credibilityScore: computed.credibility_score,
      historicalAccuracy: computed.historical_accuracy,
      verificationStatus: computed.verification_status,
      createdAt: existing ? existing.created_at : undefined,
      updatedAt: new Date().toISOString(),
    });

    return this.repository.save(current);
  }

  getOrCreateProfile(sourceName, sourceTypeHint = null) {
    const normalized = this.normalizeSource(sourceName);
    const existing = this.repository.findBySource(normalized);
    if (existing) {
      return existing;
    }

    return this.upsertSourceProfile({
      source_name: normalized,
      source_type: this.classifySource(normalized, sourceTypeHint),
    });
  }

  reset() {
    if (this.repository && typeof this.repository.reset === 'function') {
      this.repository.reset();
    }
  }
}

module.exports = { CredibilityService };
