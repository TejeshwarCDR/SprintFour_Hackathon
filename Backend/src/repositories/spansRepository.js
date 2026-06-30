import { getSupabase } from '../db/supabaseClient.js';
import { throwIfSupabaseError } from './baseRepository.js';

export class SpansRepository {
  constructor(supabase = null) {
    this.supabase = supabase;
  }

  get client() {
    return this.supabase || getSupabase();
  }

  async insertMany(spans) {
    if (spans.length === 0) return [];
    const { data, error } = await this.client
      .from('spans')
      .insert(spans)
      .select('*');
    throwIfSupabaseError(error);
    return data;
  }

  async listByDocumentId(documentId) {
    const { data, error } = await this.client
      .from('spans')
      .select('*, ontology_rules(pattern, description)')
      .eq('document_id', documentId)
      .order('priority_score', { ascending: false })
      .order('start_offset', { ascending: true });
    throwIfSupabaseError(error);
    return data;
  }

  async findInDocument(documentId, spanId) {
    const { data, error } = await this.client
      .from('spans')
      .select('*')
      .eq('document_id', documentId)
      .eq('id', spanId)
      .maybeSingle();
    throwIfSupabaseError(error);
    return data;
  }

  async listByIdsInDocument(documentId, spanIds) {
    const { data, error } = await this.client
      .from('spans')
      .select('*')
      .eq('document_id', documentId)
      .in('id', spanIds);
    throwIfSupabaseError(error);
    return data;
  }

  async update(spanId, values) {
    const { data, error } = await this.client
      .from('spans')
      .update(values)
      .eq('id', spanId)
      .select('*')
      .single();
    throwIfSupabaseError(error);
    return data;
  }

  async listByDocumentIds(documentIds) {
    if (documentIds.length === 0) return [];
    const { data, error } = await this.client
      .from('spans')
      .select('id, document_id, risk_tier, conflict, status, priority_score')
      .in('document_id', documentIds);
    throwIfSupabaseError(error);
    return data;
  }

  async listPendingHighRisk(documentId) {
    const { data, error } = await this.client
      .from('spans')
      .select('id')
      .eq('document_id', documentId)
      .eq('risk_tier', 'high')
      .eq('status', 'pending');
    throwIfSupabaseError(error);
    return data;
  }
}
