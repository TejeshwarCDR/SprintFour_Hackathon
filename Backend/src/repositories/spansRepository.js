import { memoryDb } from '../db/memoryStore.js';

export class SpansRepository {
  async insertMany(spans) {
    return memoryDb.spans.insertMany(spans);
  }

  async listByDocumentId(documentId) {
    return memoryDb.spans.listByDocumentId(documentId);
  }

  async findInDocument(documentId, spanId) {
    return memoryDb.spans.findInDocument(documentId, spanId);
  }

  async listByIdsInDocument(documentId, spanIds) {
    return memoryDb.spans.listByIdsInDocument(documentId, spanIds);
  }

  async update(spanId, values) {
    return memoryDb.spans.update(spanId, values);
  }

  async listByDocumentIds(documentIds) {
    return memoryDb.spans.listByDocumentIds(documentIds);
  }

  async listPendingHighRisk(documentId) {
    return memoryDb.spans.listPendingHighRisk(documentId);
  }
}
