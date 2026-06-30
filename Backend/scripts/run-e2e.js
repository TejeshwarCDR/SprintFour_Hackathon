import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_ONTOLOGY_RULES } from '../src/services/detection/ontologyRules.js';

dotenv.config();

const TEST_PREFIX = 'conseal-e2e';
const TEST_RULE_DESCRIPTION = 'Integration test temporary type-conflict rule';
const TEST_RULE = {
  type: 'EMAIL',
  pattern: String.raw`\bconflict John Smith\b`,
  description: TEST_RULE_DESCRIPTION,
};

const TEST_DOCUMENT = [
  'John Smith filed this review.',
  'The corroborated email is john.smith@example.com.',
  'The address is 742 Maple Rd.',
  'Use SSN 123-45-6789 for the high risk block.',
  'The type conflict marker is conflict John Smith.',
  'For boundary review, later, John Smith Account should stay visible.',
].join('\n');

const parseArgs = () => {
  const options = {
    useMockLlm: true,
    strictReconciliation: true,
    port: Number(process.env.E2E_PORT || 3101),
    keepData: process.env.KEEP_INTEGRATION_DATA === 'true',
  };

  for (const arg of process.argv.slice(2)) {
    const [name, value] = arg.split('=');
    if (name === '--use-mock-llm') options.useMockLlm = value !== 'false';
    if (name === '--strict-reconciliation') options.strictReconciliation = value !== 'false';
    if (name === '--port') options.port = Number(value);
    if (name === '--keep-data') options.keepData = value !== 'false';
  }

  return options;
};

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const createSupabase = () => createClient(
  requireEnv('SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const throwIfError = (error, context) => {
  if (error) throw new Error(`${context}: ${error.message}`);
};

const cleanupTestData = async (supabase) => {
  let response = await supabase
    .from('documents')
    .delete()
    .like('original_filename', `${TEST_PREFIX}-%`);
  throwIfError(response.error, 'cleanup documents');

  response = await supabase
    .from('ontology_rules')
    .delete()
    .eq('description', TEST_RULE_DESCRIPTION);
  throwIfError(response.error, 'cleanup temporary ontology rule');
};

const ensureOntologyRules = async (supabase) => {
  const { data: existingRules, error: listError } = await supabase
    .from('ontology_rules')
    .select('type, pattern, description');
  throwIfError(listError, 'list ontology rules');

  const existingKeys = new Set(existingRules.map((rule) => `${rule.type}::${rule.description}`));
  const missingDefaults = DEFAULT_ONTOLOGY_RULES.filter((rule) => !existingKeys.has(`${rule.type}::${rule.description}`));

  if (missingDefaults.length > 0) {
    const { error } = await supabase.from('ontology_rules').insert(missingDefaults);
    throwIfError(error, 'insert missing default ontology rules');
  }

  const { error } = await supabase.from('ontology_rules').insert(TEST_RULE);
  throwIfError(error, 'insert temporary type-conflict ontology rule');
};

const startServer = async ({ port, useMockLlm }) => {
  const child = spawn('node', ['src/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      USE_MOCK_LLM: String(useMockLlm),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let logs = '';
  child.stdout.on('data', (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    logs += chunk.toString();
  });

  const baseUrl = `http://localhost:${port}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`server exited before health check passed:\n${logs}`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return { child, baseUrl, getLogs: () => logs };
    } catch {
      await delay(250);
    }
  }

  child.kill('SIGTERM');
  throw new Error(`server did not become healthy:\n${logs}`);
};

const stopServer = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await delay(250);
  if (child.exitCode === null) child.kill('SIGKILL');
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
};

const assertOk = ({ response, body }, expectedStatus, label) => {
  assert.equal(response.status, expectedStatus, `${label}: expected ${expectedStatus}, got ${response.status} ${JSON.stringify(body)}`);
  return body;
};

const uploadDocument = async (baseUrl, filename) => {
  const form = new FormData();
  form.append('file', new Blob([TEST_DOCUMENT], { type: 'text/plain' }), filename);

  const result = await requestJson(`${baseUrl}/documents`, {
    method: 'POST',
    body: form,
  });
  return assertOk(result, 201, 'upload document');
};

const overlaps = (span, start, end) => span.startOffset < end && start < span.endOffset;

const assertCase = (checks, key, passed, details) => {
  checks[key] = { passed, details };
  if (!passed) {
    throw new Error(`Reconciliation case failed: ${key}. ${details}`);
  }
};

const analyzeReconciliationCases = (spans, { strict }) => {
  const checks = {};
  const offset = (needle) => {
    const start = TEST_DOCUMENT.indexOf(needle);
    assert.notEqual(start, -1, `test document missing ${needle}`);
    return { start, end: start + needle.length };
  };

  const agreedEmail = spans.find((span) => (
    span.text === 'john.smith@example.com' &&
    span.type === 'EMAIL' &&
    span.source === 'BOTH' &&
    span.conflict === false
  ));
  checks.agreed = {
    passed: Boolean(agreedEmail),
    details: agreedEmail ? agreedEmail.id : 'missing non-conflict BOTH EMAIL span for john.smith@example.com',
  };

  const ontologyAddress = spans.find((span) => (
    span.text.includes('742 Maple Rd') &&
    span.type === 'ADDRESS' &&
    span.source === 'ONTOLOGY' &&
    span.conflict === false
  ));
  checks.ontologyOnly = {
    passed: Boolean(ontologyAddress),
    details: ontologyAddress ? ontologyAddress.id : 'missing ONTOLOGY-only ADDRESS span for 742 Maple Rd',
  };

  const llmOnly = spans.find((span) => (
    span.text === 'John Smith' &&
    span.startOffset === 0 &&
    span.type === 'NAME' &&
    span.source === 'LLM' &&
    span.conflict === false
  ));
  checks.llmOnly = {
    passed: Boolean(llmOnly),
    details: llmOnly ? llmOnly.id : 'missing LLM-only opening John Smith span',
  };

  const typeConflictRange = offset('conflict John Smith');
  const typeConflictRows = spans.filter((span) => (
    span.source === 'BOTH' &&
    span.conflict === true &&
    overlaps(span, typeConflictRange.start, typeConflictRange.end)
  ));
  const hasTypeConflict = typeConflictRows.some((span) => span.type === 'NAME') &&
    typeConflictRows.some((span) => span.type === 'EMAIL');
  checks.typeConflict = {
    passed: hasTypeConflict,
    details: hasTypeConflict
      ? typeConflictRows.map((span) => `${span.type}:${span.text}`).join(' | ')
      : `missing conflicting NAME and EMAIL rows near "conflict John Smith"; saw ${typeConflictRows.map((span) => `${span.type}:${span.text}`).join(' | ')}`,
  };

  const boundaryRange = offset('John Smith Account');
  const boundaryRows = spans.filter((span) => (
    span.source === 'BOTH' &&
    span.conflict === true &&
    span.type === 'NAME' &&
    overlaps(span, boundaryRange.start, boundaryRange.end)
  ));
  const hasBoundaryConflict = boundaryRows.some((span) => span.text === 'John Smith') &&
    boundaryRows.some((span) => span.text === 'John Smith Account');
  checks.boundaryConflict = {
    passed: hasBoundaryConflict,
    details: hasBoundaryConflict
      ? boundaryRows.map((span) => `${span.startOffset}-${span.endOffset}:${span.text}`).join(' | ')
      : `missing John Smith and John Smith Account conflict rows; saw ${boundaryRows.map((span) => span.text).join(' | ')}`,
  };

  if (strict) {
    for (const [key, check] of Object.entries(checks)) {
      assertCase(checks, key, check.passed, check.details);
    }
  }

  return checks;
};

const getDocument = async (baseUrl, documentId) => {
  const result = await requestJson(`${baseUrl}/documents/${documentId}`);
  return assertOk(result, 200, 'fetch document');
};

const patchSpan = async (baseUrl, documentId, spanId, body, expectedStatus = 200) => {
  const result = await requestJson(`${baseUrl}/documents/${documentId}/spans/${spanId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return assertOk(result, expectedStatus, `patch span ${spanId}`);
};

const bulkSpans = async (baseUrl, documentId, body, expectedStatus = 200) => {
  const result = await requestJson(`${baseUrl}/documents/${documentId}/spans/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return assertOk(result, expectedStatus, 'bulk spans');
};

const commitDocument = async (baseUrl, documentId, expectedStatus = 200) => {
  const result = await requestJson(`${baseUrl}/documents/${documentId}/commit`, {
    method: 'POST',
  });
  return assertOk(result, expectedStatus, 'commit document');
};

const runLifecycle = async ({ baseUrl, useMockLlm, strictReconciliation }) => {
  const filename = `${TEST_PREFIX}-${useMockLlm ? 'mock' : 'live'}-${Date.now()}.txt`;
  const upload = await uploadDocument(baseUrl, filename);
  assert.equal(upload.status, 'pending', 'upload response should match specified pending status');

  let document = await getDocument(baseUrl, upload.id);
  assert.ok(Array.isArray(document.spans), 'document response includes spans array');
  assert.ok(document.spans.length > 0, 'document has detected spans');

  const reconciliationChecks = analyzeReconciliationCases(document.spans, { strict: strictReconciliation });

  const summary = assertOk(
    await requestJson(`${baseUrl}/documents/${upload.id}/summary`),
    200,
    'fetch summary',
  );
  assert.equal(summary.totalSpans, document.spans.length, 'summary totalSpans should match fetched spans');
  assert.ok(summary.byRiskTier.high > 0, 'summary should include at least one high-risk span');

  const patchTarget = document.spans.find((span) => span.riskTier !== 'high' && span.status === 'pending');
  assert.ok(patchTarget, 'need a non-high pending span for single PATCH');
  await patchSpan(baseUrl, upload.id, patchTarget.id, { action: 'accept', actor: 'integration-test' });

  // ── Persistence check: single PATCH accept ─────────────────────────────
  // Re-fetch the document and assert the accepted status actually persisted
  // server-side (a UI-only check would have passed even when the API was
  // silently returning 400).
  document = await getDocument(baseUrl, upload.id);
  assert.equal(
    document.spans.find((s) => s.id === patchTarget.id)?.status,
    'accepted',
    `single PATCH accept: span ${patchTarget.id} should have status "accepted" after re-fetch`,
  );

  const bulkTargets = document.spans
    .filter((span) => span.riskTier !== 'high' && span.status === 'pending')
    .slice(0, 2);
  assert.ok(bulkTargets.length > 0, 'need at least one non-high pending span for bulk flow');

  const dryRunIds = bulkTargets.map((span) => span.id);
  const dryRunResult = await bulkSpans(baseUrl, upload.id, { spanIds: dryRunIds, action: 'reject' });
  assert.deepEqual(new Set(dryRunResult.map((span) => span.id)), new Set(dryRunIds), 'bulk dry-run returns affected spans');

  document = await getDocument(baseUrl, upload.id);
  for (const spanId of dryRunIds) {
    assert.equal(document.spans.find((span) => span.id === spanId).status, 'pending', 'bulk dry-run must not mutate');
  }

  await bulkSpans(baseUrl, upload.id, {
    spanIds: dryRunIds,
    action: 'reject',
    dryRun: false,
    actor: 'integration-test',
  });

  // ── Persistence check: bulk reject ────────────────────────────────────
  // Re-fetch and assert every span in dryRunIds is now "rejected".
  document = await getDocument(baseUrl, upload.id);
  for (const spanId of dryRunIds) {
    assert.equal(
      document.spans.find((s) => s.id === spanId)?.status,
      'rejected',
      `bulk reject: span ${spanId} should have status "rejected" after re-fetch`,
    );
  }

  const blockedCommit = await commitDocument(baseUrl, upload.id, 422);
  assert.ok(Array.isArray(blockedCommit.error.details.unresolvedHighRiskSpanIds), 'blocked commit returns unresolved high-risk IDs');
  assert.ok(blockedCommit.error.details.unresolvedHighRiskSpanIds.length > 0, 'blocked commit has unresolved high-risk spans');

  document = await getDocument(baseUrl, upload.id);
  const highRiskPendingIds = document.spans
    .filter((span) => span.riskTier === 'high' && span.status === 'pending')
    .map((span) => span.id);
  assert.ok(highRiskPendingIds.length > 0, 'need high-risk pending spans to resolve before commit');

  await bulkSpans(baseUrl, upload.id, {
    spanIds: highRiskPendingIds,
    action: 'accept',
    dryRun: false,
    actor: 'integration-test',
  });

  // ── Persistence check: bulk accept (high-risk resolution) ─────────────
  document = await getDocument(baseUrl, upload.id);
  for (const spanId of highRiskPendingIds) {
    assert.equal(
      document.spans.find((s) => s.id === spanId)?.status,
      'accepted',
      `bulk accept: high-risk span ${spanId} should have status "accepted" after re-fetch`,
    );
  }

  const committed = await commitDocument(baseUrl, upload.id, 200);
  assert.equal(committed.status, 'committed', 'commit returns committed status');
  assert.equal(typeof committed.outputText, 'string', 'commit returns inline outputText');

  const postCommitEdit = await patchSpan(
    baseUrl,
    upload.id,
    patchTarget.id,
    { action: 'reject', actor: 'integration-test' },
    409,
  );
  assert.equal(postCommitEdit.error.code, 'CONFLICT', 'post-commit edit returns conflict error');

  const audit = assertOk(
    await requestJson(`${baseUrl}/documents/${upload.id}/audit`),
    200,
    'fetch audit',
  );
  assert.ok(Array.isArray(audit), 'audit response is an array');
  assert.ok(audit.length >= 2 + highRiskPendingIds.length, 'audit includes single patch, bulk apply, and high-risk resolution entries');

  return {
    documentId: upload.id,
    filename,
    spanCount: document.spans.length,
    summary,
    reconciliationChecks,
    blockedHighRiskCount: blockedCommit.error.details.unresolvedHighRiskSpanIds.length,
    auditCount: audit.length,
  };
};

const main = async () => {
  const options = parseArgs();
  const supabase = createSupabase();
  let server;

  try {
    await cleanupTestData(supabase);
    await ensureOntologyRules(supabase);
    server = await startServer(options);
    const result = await runLifecycle({
      baseUrl: server.baseUrl,
      useMockLlm: options.useMockLlm,
      strictReconciliation: options.strictReconciliation,
    });

    console.log(JSON.stringify({
      mode: options.useMockLlm ? 'mock' : 'live',
      strictReconciliation: options.strictReconciliation,
      llmFallbackObserved: server.getLogs().includes('LLM detection failed; using mock fallback.'),
      ...result,
    }, null, 2));
  } finally {
    await stopServer(server?.child);
    if (!options.keepData) {
      await cleanupTestData(supabase).catch((error) => {
        console.warn(`cleanup failed: ${error.message}`);
      });
    }
  }
};

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
