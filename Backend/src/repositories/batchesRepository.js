import { getSupabase } from '../db/supabaseClient.js';
import { throwIfSupabaseError } from './baseRepository.js';

export class BatchesRepository {
  constructor(supabase = null) {
    this.supabase = supabase;
  }

  get client() {
    return this.supabase || getSupabase();
  }

  async create({ totalDocuments }) {
    const { data, error } = await this.client
      .from('batches')
      .insert({ total_documents: totalDocuments, status: 'processing' })
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  async findById(id) {
    const { data, error } = await this.client
      .from('batches')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(error);
    return data;
  }

  async updateStatus(id, status) {
    const { data, error } = await this.client
      .from('batches')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }
}
