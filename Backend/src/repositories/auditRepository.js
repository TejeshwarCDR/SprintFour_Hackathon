import { memoryDb } from '../db/memoryStore.js';

export class AuditRepository {
  async create({ spanId, action, actor, previousState, newState }) {
    return memoryDb.audit_entries.insert({ span_id: spanId, action, actor, previous_state: previousState, new_state: newState });
  }

  async listForDocument(documentId) {
    return memoryDb.audit_entries.listForDocument(documentId);
  }
}
