import { randomUUID } from 'crypto';

const store = {
  documents: new Map(),
  spans: new Map(),
  audit_entries: new Map(),
  ontology_rules: new Map(),
  batches: new Map(),
};

const now = () => new Date().toISOString();

export const memoryDb = {
  documents: {
    insert(row) {
      const record = { uploaded_at: now(), status: 'pending', batch_id: null, detection_source: null, ...row, id: randomUUID() };
      store.documents.set(record.id, record);
      return record;
    },
    findById(id) {
      return store.documents.get(id) ?? null;
    },
    update(id, patch) {
      const record = store.documents.get(id);
      if (!record) return null;
      Object.assign(record, patch);
      return record;
    },
    listByBatchId(batchId) {
      return [...store.documents.values()]
        .filter(d => d.batch_id === batchId)
        .sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at));
    },
  },

  spans: {
    insertMany(rows) {
      return rows.map(row => {
        const record = { ...row, id: row.id ?? randomUUID() };
        store.spans.set(record.id, record);
        return record;
      });
    },
    findById(id) {
      return store.spans.get(id) ?? null;
    },
    listByDocumentId(documentId) {
      return [...store.spans.values()]
        .filter(s => s.document_id === documentId)
        .sort((a, b) => b.priority_score - a.priority_score || a.start_offset - b.start_offset)
        .map(s => {
          const rule = s.ontology_rule_id ? store.ontology_rules.get(s.ontology_rule_id) : null;
          return { ...s, ontology_rules: rule ? { pattern: rule.pattern, description: rule.description } : null };
        });
    },
    findInDocument(documentId, spanId) {
      const span = store.spans.get(spanId);
      if (!span || span.document_id !== documentId) return null;
      return span;
    },
    listByIdsInDocument(documentId, spanIds) {
      return spanIds.map(id => store.spans.get(id)).filter(s => s && s.document_id === documentId);
    },
    update(spanId, values) {
      const record = store.spans.get(spanId);
      if (!record) return null;
      Object.assign(record, values);
      return record;
    },
    listByDocumentIds(documentIds) {
      const set = new Set(documentIds);
      return [...store.spans.values()]
        .filter(s => set.has(s.document_id))
        .map(({ id, document_id, risk_tier, conflict, status, priority_score }) =>
          ({ id, document_id, risk_tier, conflict, status, priority_score }));
    },
    listPendingHighRisk(documentId) {
      return [...store.spans.values()]
        .filter(s => s.document_id === documentId && s.risk_tier === 'high' && s.status === 'pending')
        .map(({ id }) => ({ id }));
    },
  },

  audit_entries: {
    insert(row) {
      const record = { timestamp: now(), ...row, id: randomUUID() };
      store.audit_entries.set(record.id, record);
      return record;
    },
    listForDocument(documentId) {
      return [...store.audit_entries.values()]
        .filter(e => {
          const span = store.spans.get(e.span_id);
          return span && span.document_id === documentId;
        })
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map(e => ({ ...e, spans: store.spans.get(e.span_id) ?? null }));
    },
  },

  ontology_rules: {
    list() {
      return [...store.ontology_rules.values()].sort((a, b) => a.type.localeCompare(b.type));
    },
    insertMany(rows) {
      return rows.map(row => {
        const record = { ...row, id: row.id ?? randomUUID() };
        store.ontology_rules.set(record.id, record);
        return record;
      });
    },
  },

  batches: {
    insert(row) {
      const record = { created_at: now(), status: 'processing', ...row, id: randomUUID() };
      store.batches.set(record.id, record);
      return record;
    },
    findById(id) {
      return store.batches.get(id) ?? null;
    },
    update(id, patch) {
      const record = store.batches.get(id);
      if (!record) return null;
      Object.assign(record, patch);
      return record;
    },
  },
};
