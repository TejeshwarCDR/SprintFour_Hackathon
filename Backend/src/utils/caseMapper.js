export const mapSpanFromDb = (span) => ({
  id: span.id,
  documentId: span.document_id,
  text: span.text,
  startOffset: span.start_offset,
  endOffset: span.end_offset,
  type: span.type,
  llmConfidence: span.llm_confidence === null ? null : Number(span.llm_confidence),
  llmRationale: span.llm_rationale,
  ontologyRuleId: span.ontology_rule_id,
  // Joined from ontology_rules via FK — present when listByDocumentId fetches with select('*, ontology_rules(...)').
  ontologyRuleDescription: span.ontology_rules?.description ?? null,
  ontologyRulePattern: span.ontology_rules?.pattern ?? null,
  source: span.source,
  conflict: span.conflict,
  riskTier: span.risk_tier,
  priorityScore: Number(span.priority_score),
  status: span.status,
  reviewedAt: span.reviewed_at,
  reviewedBy: span.reviewed_by,
});

export const mapDocumentFromDb = (document) => ({
  id: document.id,
  originalFilename: document.original_filename,
  rawText: document.raw_text,
  status: document.status,
  uploadedAt: document.uploaded_at,
  detectionSource: document.detection_source ?? null,
});

export const mapAuditFromDb = (entry) => ({
  id: entry.id,
  spanId: entry.span_id,
  action: entry.action,
  actor: entry.actor,
  timestamp: entry.timestamp,
  previousState: entry.previous_state,
  newState: entry.new_state,
  span: entry.spans ? mapSpanFromDb(entry.spans) : undefined,
});
