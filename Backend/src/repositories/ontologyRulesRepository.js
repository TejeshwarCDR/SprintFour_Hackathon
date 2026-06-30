import { getSupabase } from '../db/supabaseClient.js';
import { DEFAULT_ONTOLOGY_RULES } from '../services/detection/ontologyRules.js';
import { throwIfSupabaseError } from './baseRepository.js';

export class OntologyRulesRepository {
  constructor(supabase = null) {
    this.supabase = supabase;
  }

  get client() {
    return this.supabase || getSupabase();
  }

  async list() {
    const { data, error } = await this.client
      .from('ontology_rules')
      .select('*')
      .order('type', { ascending: true });
    throwIfSupabaseError(error);
    return data;
  }

  async ensureDefaultRules() {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    const { data, error } = await this.client
      .from('ontology_rules')
      .insert(DEFAULT_ONTOLOGY_RULES)
      .select('*');
    throwIfSupabaseError(error);
    return data;
  }
}
