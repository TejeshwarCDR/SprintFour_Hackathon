import { extractTextFromUpload } from '../utils/textExtraction.js';
import { notFound } from '../errors/AppError.js';
import { BatchesRepository } from '../repositories/batchesRepository.js';
import { DocumentsRepository } from '../repositories/documentsRepository.js';
import { SpansRepository } from '../repositories/spansRepository.js';
import { DocumentService } from './documentService.js';

export class BatchService {
  constructor({
    batchesRepository = new BatchesRepository(),
    documentsRepository = new DocumentsRepository(),
    spansRepository = new SpansRepository(),
    documentService = new DocumentService(),
  } = {}) {
    this.batchesRepository = batchesRepository;
    this.documentsRepository = documentsRepository;
    this.spansRepository = spansRepository;
    this.documentService = documentService;
  }

  async createBatch(files) {
    const batch = await this.batchesRepository.create({ totalDocuments: files.length });

    const succeeded = [];
    const failed = [];

    for (const file of files) {
      try {
        const rawText = await extractTextFromUpload(file);
        await this.documentService.ingest({
          originalFilename: file.originalname,
          rawText,
          batchId: batch.id,
        });
        succeeded.push(file.originalname);
      } catch (e) {
        failed.push({
          filename: file.originalname,
          reason: e.code ?? e.message ?? 'extraction_failed',
        });
      }
    }

    const newStatus = failed.length === 0 ? 'ready' : 'partial_failure';
    await this.batchesRepository.updateStatus(batch.id, newStatus);

    return {
      batchId: batch.id,
      totalDocuments: files.length,
      succeeded: succeeded.length,
      failed,
    };
  }

  async getBatch(batchId) {
    const batch = await this.batchesRepository.findById(batchId);
    if (!batch) throw notFound('batch not found', { batchId });

    const documents = await this.documentsRepository.listByBatchId(batchId);
    const documentIds = documents.map((d) => d.id);
    const allSpans = await this.spansRepository.listByDocumentIds(documentIds);

    // Group spans by document_id for O(n) aggregation.
    const spansByDoc = {};
    for (const span of allSpans) {
      (spansByDoc[span.document_id] ??= []).push(span);
    }

    const docsWithScores = documents.map((doc) => {
      const spans = spansByDoc[doc.id] ?? [];
      const pending = spans.filter((s) => s.status === 'pending');
      const unresolvedHighRiskCount = pending.filter((s) => s.risk_tier === 'high').length;
      const conflictCount = pending.filter((s) => s.conflict).length;
      const pendingPrioritySum = pending.reduce((sum, s) => sum + Number(s.priority_score), 0);

      const docPriorityScore =
        unresolvedHighRiskCount * 10 + conflictCount * 5 + pendingPrioritySum;

      return {
        id: doc.id,
        originalFilename: doc.original_filename,
        status: doc.status,
        totalSpans: spans.length,
        pendingCount: pending.length,
        unresolvedHighRiskCount,
        conflictCount,
        docPriorityScore,
      };
    });

    // Highest-priority documents first; server-side sort so the client never needs to.
    docsWithScores.sort((a, b) => b.docPriorityScore - a.docPriorityScore);

    return {
      batchId: batch.id,
      status: batch.status,
      totalDocuments: batch.total_documents,
      documents: docsWithScores,
    };
  }
}
