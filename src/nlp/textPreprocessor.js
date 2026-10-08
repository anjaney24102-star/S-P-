const { normalizeText } = require('../utils/text');
const { BaseNLPComponent } = require('./baseComponent');

class TextPreprocessor extends BaseNLPComponent {
  process(event) {
    const title = normalizeText(event.title || '');
    const content = normalizeText(event.content || '');
    const combined = [title, content].filter(Boolean).join(' ');
    const sentences = combined.split(/(?<=[.!?])\s+/).map((sentence) => normalizeText(sentence)).filter(Boolean);

    return {
      title,
      content,
      combinedText: combined,
      normalizedText: combined.toLowerCase(),
      sentences,
      tokens: combined.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
    };
  }
}

module.exports = { TextPreprocessor };
