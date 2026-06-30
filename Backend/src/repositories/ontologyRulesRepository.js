import { memoryDb } from '../db/memoryStore.js';
import { DEFAULT_ONTOLOGY_RULES } from '../services/detection/ontologyRules.js';

export class OntologyRulesRepository {
  async list() {
    return memoryDb.ontology_rules.list();
  }

  async ensureDefaultRules() {
    const existing = await this.list();
    if (existing.length > 0) return existing;
    return memoryDb.ontology_rules.insertMany(DEFAULT_ONTOLOGY_RULES);
  }
}
