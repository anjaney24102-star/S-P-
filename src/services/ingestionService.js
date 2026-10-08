const { EventRepository } = require('../repositories/eventRepository');
const { SourceAdapterRegistry } = require('../adapters/sourceRegistry');
const { buildFinancialEvent } = require('../domain/FinancialEvent');
const { validateFinancialEventInput } = require('../validation/eventValidator');
const { contentHash } = require('../utils/text');
const { logger } = require('../utils/logger');

class DuplicateEventError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'DuplicateEventError';
    this.code = 'DUPLICATE_EVENT';
    this.statusCode = 409;
    this.details = details;
  }
}

class IngestionService {
  constructor({ repository, sourceRegistry } = {}) {
    this.repository = repository || new EventRepository();
    this.sourceRegistry = sourceRegistry || new SourceAdapterRegistry();
  }

  ingestOne(rawEvent) {
    const adapter = this.sourceRegistry.getAdapter(rawEvent.source);
    const adaptedPayload = adapter.normalize(rawEvent);
    const validation = validateFinancialEventInput(adaptedPayload);

    if (!validation.valid) {
      const error = new Error(`Event validation failed: ${validation.errors.join(', ')}`);
      error.statusCode = 400;
      error.details = validation.errors;
      throw error;
    }

    const event = buildFinancialEvent(validation.normalized);
    const duplicate = this.detectDuplicate(event);

    if (duplicate) {
      logger.warn('Duplicate event rejected', {
        source: event.source,
        source_event_id: event.source_event_id,
        content_hash: event.content_hash,
      });
      throw new DuplicateEventError('Duplicate event detected.', {
        source: event.source,
        source_event_id: event.source_event_id,
        content_hash: event.content_hash,
      });
    }

    const saved = this.repository.save(event);

    if (saved.duplicate) {
      throw new DuplicateEventError('Duplicate event detected.', saved.event);
    }

    logger.info('Financial event ingested', {
      eventId: event.id,
      source: event.source,
      eventType: event.event_type,
    });

    return event;
  }

  ingestBatch(rawEvents = []) {
    if (!Array.isArray(rawEvents)) {
      const error = new Error('Batch payload must include an array of events');
      error.statusCode = 400;
      throw error;
    }

    const inserted = [];
    let skipped = 0;

    rawEvents.forEach((event) => {
      try {
        inserted.push(this.ingestOne(event));
      } catch (error) {
        if (error.code === 'DUPLICATE_EVENT') {
          skipped += 1;
          return;
        }

        throw error;
      }
    });

    return {
      inserted: inserted.length,
      skipped,
      total: rawEvents.length,
      events: inserted,
    };
  }

  getRecent(limit = 20) {
    return this.repository.findRecent(Number(limit) || 20);
  }

  detectDuplicate(event) {
    if (event.source_event_id) {
      const duplicateBySourceId = this.repository.findBySourceEventId(event.source, event.source_event_id);
      if (duplicateBySourceId) {
        return duplicateBySourceId;
      }
    }

    return this.repository.findByContentHash(event.content_hash || contentHash(event.content));
  }

  reset() {
    this.repository.reset();
  }
}

module.exports = {
  IngestionService,
  DuplicateEventError,
};
