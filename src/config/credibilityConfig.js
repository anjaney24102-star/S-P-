module.exports = {
  credibility: {
    sourceTypes: [
      'official_filing',
      'company_announcement',
      'major_news',
      'financial_news',
      'local_news',
      'social_media',
      'unknown',
    ],
    baselineScores: {
      official_filing: 0.96,
      company_announcement: 0.88,
      major_news: 0.82,
      financial_news: 0.84,
      local_news: 0.62,
      social_media: 0.41,
      unknown: 0.35,
    },
    verificationStatus: {
      verified: 0.95,
      partially_verified: 0.72,
      unverified: 0.48,
      unknown: 0.35,
    },
    historicalAccuracyFloor: 0.5,
    maxHistoricalWindow: 365,
    defaultVerificationStatus: 'unverified',
  },
};
