const toJsonLines = (signals = []) => {
  if (!Array.isArray(signals)) throw new TypeError('signals must be an array.');
  return signals.map((signal) => JSON.stringify(signal)).join('\n');
};

module.exports = { toJsonLines };
