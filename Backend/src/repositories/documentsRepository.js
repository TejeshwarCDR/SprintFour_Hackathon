import { memoryDb } from '../db/memoryStore.js';

export class DocumentsRepository {
  async create({ originalFilename, rawText, batchId = null }) {
    return memoryDb.documents.insert({ original_filename: originalFilename, raw_text: rawText, status: 'pending', batch_id: batchId });
  }

  async listByBatchId(batchId) {
    return memoryDb.documents.listByBatchId(batchId);
  }

  async findById(id) {
    return memoryDb.documents.findById(id);
  }

  async updateStatus(id, status, detectionSource = null) {
    const patch = { status };
    if (detectionSource !== null) patch.detection_source = detectionSource;
    return memoryDb.documents.update(id, patch);
  }
}
