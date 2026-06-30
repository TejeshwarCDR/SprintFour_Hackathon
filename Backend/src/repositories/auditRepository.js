import { getSupabase } from '../db/supabaseClient.js';
import { throwIfSupabaseError } from './baseRepository.js';

export class AuditRepository {
  constructor(supabase = null) {
    this.supabase = supabase;
  }

  get client() {
    return this.supabase || getSupabase();
  }

  async create({ spanId, action, actor, previousState, newState }) {
    const { data, error } = await this.client
      .from('audit_entries')
      .insert({
        span_id: spanId,
        action,
        actor,
        previous_state: previousState,
        new_state: newState,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  async listForDocument(documentId) {
    const { data, error } = await this.client
      .from('audit_entries')
      .select('*, spans!inner(*)')
      .eq('spans.document_id', documentId)
      .order('timestamp', { ascending: true });
    throwIfSupabaseError(error);
    return data;
  }
}
