import { getSupabase } from '../db/supabaseClient.js';
import { throwIfSupabaseError } from './baseRepository.js';

export class DocumentsRepository {
  constructor(supabase = null) {
    this.supabase = supabase;
  }

  get client() {
    return this.supabase || getSupabase();
  }

  async create({ originalFilename, rawText, batchId = null }) {
    const { data, error } = await this.client
      .from('documents')
      .insert({ original_filename: originalFilename, raw_text: rawText, status: 'pending', batch_id: batchId })
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  async listByBatchId(batchId) {
    const { data, error } = await this.client
      .from('documents')
      .select('*')
      .eq('batch_id', batchId)
      .order('uploaded_at', { ascending: true });
    throwIfSupabaseError(error);
    return data;
  }

  async findById(id) {
    const { data, error } = await this.client
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(error);
    return data;
  }

  async updateStatus(id, status, detectionSource = null) {
    const patch = { status };
    if (detectionSource !== null) patch.detection_source = detectionSource;
    const { data, error } = await this.client
      .from('documents')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }
}
