import { memoryDb } from '../db/memoryStore.js';

export class BatchesRepository {
  async create({ totalDocuments }) {
    return memoryDb.batches.insert({ total_documents: totalDocuments, status: 'processing' });
  }

  async findById(id) {
    return memoryDb.batches.findById(id);
  }

  async updateStatus(id, status) {
    return memoryDb.batches.update(id, { status });
  }
}
