import { detectWithLLM, getActiveLlmName } from './detection/llmDetector.js';
import { detectWithOntology } from './detection/ontologyDetector.js';
import { reconcileSpans } from './reconciliation.js';
import { buildRedactedText } from '../utils/redaction.js';
import { toRedactedTxtFilename } from '../utils/filename.js';
import { conflict, notFound, unprocessable } from '../errors/AppError.js';
import { mapAuditFromDb, mapDocumentFromDb, mapSpanFromDb } from '../utils/caseMapper.js';
import { DocumentsRepository } from '../repositories/documentsRepository.js';
import { SpansRepository } from '../repositories/spansRepository.js';
import { AuditRepository } from '../repositories/auditRepository.js';
import { OntologyRulesRepository } from '../repositories/ontologyRulesRepository.js';

const toSpanUpdateForAction = ({ action, overrideType, actor }) => {
  const now = new Date().toISOString();
  if (action === 'accept') {
    return { status: 'accepted', reviewed_at: now, reviewed_by: actor };
  }
  // auto_accept_suggested: pre-checked fast-path accepted at commit time without individual review.
  // Produces identical span status to 'accept' but audit_entries.actor is always 'system:pre_check',
  // making it distinguishable from a human reviewer decision in any audit query.
  if (action === 'auto_accept_suggested') {
    return { status: 'accepted', reviewed_at: now, reviewed_by: 'system:pre_check' };
  }
  if (action === 'reject') {
    return { status: 'rejected', reviewed_at: now, reviewed_by: actor };
  }
  return { status: 'overridden', type: overrideType, reviewed_at: now, reviewed_by: actor };
};

export class DocumentService {
  constructor({
    documentsRepository = new DocumentsRepository(),
    spansRepository = new SpansRepository(),
    auditRepository = new AuditRepository(),
    ontologyRulesRepository = new OntologyRulesRepository(),
  } = {}) {
    this.documentsRepository = documentsRepository;
    this.spansRepository = spansRepository;
    this.auditRepository = auditRepository;
    this.ontologyRulesRepository = ontologyRulesRepository;
  }

  async ingest({ originalFilename, rawText, batchId = null }) {
    const document = await this.documentsRepository.create({ originalFilename, rawText, batchId });
    const rules = await this.ontologyRulesRepository.ensureDefaultRules();

    const [{ spans: llmSpans, detectionSource }, ontologySpans] = await Promise.all([
      detectWithLLM(rawText),
      detectWithOntology(rawText, rules),
    ]);

    const reconciled = reconcileSpans({
      documentId: document.id,
      llmSpans,
      ontologySpans,
    });

    await this.spansRepository.insertMany(reconciled);
    await this.documentsRepository.updateStatus(document.id, 'in_review', detectionSource);

    return mapDocumentFromDb(document);
  }

  async getDocumentOrThrow(documentId) {
    const document = await this.documentsRepository.findById(documentId);
    if (!document) {
      throw notFound('document not found', { documentId });
    }
    return document;
  }

  async getDocument(documentId) {
    const document = await this.getDocumentOrThrow(documentId);
    const spans = await this.spansRepository.listByDocumentId(documentId);
    return {
      ...mapDocumentFromDb(document),
      spans: spans.map(mapSpanFromDb),
      llmDetector: getActiveLlmName(),
    };
  }

  async getSummary(documentId) {
    await this.getDocumentOrThrow(documentId);
    const spans = await this.spansRepository.listByDocumentId(documentId);
    const summary = {
      totalSpans: spans.length,
      byType: {},
      byRiskTier: {},
      conflicts: 0,
    };

    for (const span of spans) {
      summary.byType[span.type] = (summary.byType[span.type] || 0) + 1;
      summary.byRiskTier[span.risk_tier] = (summary.byRiskTier[span.risk_tier] || 0) + 1;
      if (span.conflict) summary.conflicts += 1;
    }

    return summary;
  }

  async assertDocumentEditable(document) {
    if (document.status === 'committed') {
      throw conflict('document is already committed; edits are not permitted', { documentId: document.id });
    }
  }

  async updateSpan(documentId, spanId, actionPayload) {
    const document = await this.getDocumentOrThrow(documentId);
    await this.assertDocumentEditable(document);

    const previous = await this.spansRepository.findInDocument(documentId, spanId);
    if (!previous) {
      throw notFound('span not found for document', { documentId, spanId });
    }

    const update = toSpanUpdateForAction(actionPayload);
    const updated = await this.spansRepository.update(spanId, update);
    await this.auditRepository.create({
      spanId,
      action: actionPayload.action,
      actor: actionPayload.actor,
      previousState: previous,
      newState: updated,
    });

    return mapSpanFromDb(updated);
  }

  async bulkUpdateSpans(documentId, { spanIds, action, dryRun, actor }) {
    const document = await this.getDocumentOrThrow(documentId);
    await this.assertDocumentEditable(document);

    const spans = await this.spansRepository.listByIdsInDocument(documentId, spanIds);
    if (spans.length !== spanIds.length) {
      throw notFound('one or more spans were not found for document', {
        documentId,
        requestedSpanIds: spanIds,
        foundSpanIds: spans.map((span) => span.id),
      });
    }

    if (dryRun) {
      return spans.map(mapSpanFromDb);
    }

    const updatedSpans = [];
    for (const span of spans) {
      const updated = await this.spansRepository.update(span.id, toSpanUpdateForAction({ action, actor }));
      await this.auditRepository.create({
        spanId: span.id,
        action,
        actor,
        previousState: span,
        newState: updated,
      });
      updatedSpans.push(updated);
    }

    return updatedSpans.map(mapSpanFromDb);
  }

  async commit(documentId) {
    const document = await this.getDocumentOrThrow(documentId);
    if (document.status === 'committed') {
      return { status: 'committed', outputText: buildRedactedText(document.raw_text, await this.spansRepository.listByDocumentId(documentId)) };
    }

    const unresolvedHighRisk = await this.spansRepository.listPendingHighRisk(documentId);
    if (unresolvedHighRisk.length > 0) {
      throw unprocessable('cannot commit while high-risk spans are unresolved', {
        unresolvedHighRiskSpanIds: unresolvedHighRisk.map((span) => span.id),
      });
    }

    const spans = await this.spansRepository.listByDocumentId(documentId);
    const outputText = buildRedactedText(document.raw_text, spans);
    await this.documentsRepository.updateStatus(documentId, 'committed');

    return { status: 'committed', outputText };
  }

  async getRedactedDownload(documentId) {
    const document = await this.getDocumentOrThrow(documentId);
    if (document.status !== 'committed') {
      throw conflict('document must be committed before downloading final redacted output', { documentId });
    }

    const spans = await this.spansRepository.listByDocumentId(documentId);
    return {
      filename: toRedactedTxtFilename(document.original_filename),
      text: buildRedactedText(document.raw_text, spans),
    };
  }

  async getAudit(documentId) {
    await this.getDocumentOrThrow(documentId);
    const entries = await this.auditRepository.listForDocument(documentId);
    return entries.map(mapAuditFromDb);
  }
}
