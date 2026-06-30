import { getRiskTier, getRiskWeight } from '../constants/pii.js';
import { boundariesDifferBeyondTolerance, rangesOverlap } from '../utils/offsets.js';

const toDbSpan = ({
  documentId,
  text,
  start,
  end,
  type,
  llmConfidence = null,
  llmRationale = null,
  ontologyRuleId = null,
  source,
  conflict = false,
}) => {
  const riskTier = getRiskTier(type);
  const confidence = typeof llmConfidence === 'number' ? llmConfidence : 1;
  const priorityScore = (getRiskWeight(riskTier) * 3) + (conflict ? 2 : 0) + ((1 - confidence) * 2);

  return {
    document_id: documentId,
    text,
    start_offset: start,
    end_offset: end,
    type,
    llm_confidence: llmConfidence,
    llm_rationale: llmRationale,
    ontology_rule_id: ontologyRuleId,
    source,
    conflict,
    risk_tier: riskTier,
    priority_score: Number(priorityScore.toFixed(4)),
    status: 'pending',
  };
};

const llmCandidate = (documentId, llmSpan, ontologySpan, conflict) => toDbSpan({
  documentId,
  text: llmSpan.text,
  start: llmSpan.start,
  end: llmSpan.end,
  type: llmSpan.type,
  llmConfidence: llmSpan.confidence,
  llmRationale: llmSpan.rationale,
  ontologyRuleId: ontologySpan.ontologyRuleId,
  source: 'BOTH',
  conflict,
});

const ontologyCandidate = (documentId, ontologySpan, llmSpan, conflict, source = 'BOTH') => toDbSpan({
  documentId,
  text: ontologySpan.text,
  start: ontologySpan.start,
  end: ontologySpan.end,
  type: ontologySpan.type,
  llmConfidence: llmSpan?.confidence ?? null,
  llmRationale: llmSpan?.rationale ?? null,
  ontologyRuleId: ontologySpan.ontologyRuleId,
  source,
  conflict,
});

export const reconcileSpans = ({ documentId, llmSpans, ontologySpans, boundaryTolerance = 2 }) => {
  const reconciled = [];
  const matchedLlmIndexes = new Set();

  for (const ontologySpan of ontologySpans) {
    const overlaps = llmSpans
      .map((llmSpan, index) => ({ llmSpan, index }))
      .filter(({ llmSpan }) => rangesOverlap(
        ontologySpan.start,
        ontologySpan.end,
        llmSpan.start,
        llmSpan.end,
      ));

    if (overlaps.length === 0) {
      reconciled.push(ontologyCandidate(documentId, ontologySpan, null, false, 'ONTOLOGY'));
      continue;
    }

    for (const { llmSpan, index } of overlaps) {
      matchedLlmIndexes.add(index);
      const sameType = ontologySpan.type === llmSpan.type;
      const boundaryConflict = boundariesDifferBeyondTolerance(ontologySpan, llmSpan, boundaryTolerance);
      const conflict = !sameType || boundaryConflict;

      if (!conflict) {
        reconciled.push(toDbSpan({
          documentId,
          text: ontologySpan.text,
          start: ontologySpan.start,
          end: ontologySpan.end,
          type: ontologySpan.type,
          llmConfidence: llmSpan.confidence,
          llmRationale: llmSpan.rationale,
          ontologyRuleId: ontologySpan.ontologyRuleId,
          source: 'BOTH',
          conflict: false,
        }));
        continue;
      }

      reconciled.push(llmCandidate(documentId, llmSpan, ontologySpan, true));
      reconciled.push(ontologyCandidate(documentId, ontologySpan, llmSpan, true));
    }
  }

  llmSpans.forEach((llmSpan, index) => {
    if (matchedLlmIndexes.has(index)) return;
    reconciled.push(toDbSpan({
      documentId,
      text: llmSpan.text,
      start: llmSpan.start,
      end: llmSpan.end,
      type: llmSpan.type,
      llmConfidence: llmSpan.confidence,
      llmRationale: llmSpan.rationale,
      ontologyRuleId: null,
      source: 'LLM',
      conflict: false,
    }));
  });

  return reconciled.sort((a, b) => (
    b.priority_score - a.priority_score ||
    a.start_offset - b.start_offset ||
    a.end_offset - b.end_offset
  ));
};
