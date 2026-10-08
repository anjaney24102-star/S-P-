class BaseNLPComponent {
  process(input) {
    throw new Error('NLP component process() must be implemented by subclass');
  }
}

module.exports = { BaseNLPComponent };
