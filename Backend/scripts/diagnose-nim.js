import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

// Import env AFTER dotenv.config so all variables are populated.
import { env } from '../src/config/env.js';
import { DEFAULT_ONTOLOGY_RULES } from '../src/services/detection/ontologyRules.js';
import { detectWithOntology } from '../src/services/detection/ontologyDetector.js';
import { reconcileSpans } from '../src/services/reconciliation.js';
import { stripMarkdownCodeFences } from '../src/utils/json.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIAGNOSTICS_DIR = path.resolve(__dirname, '..', 'diagnostics');

const SYSTEM_PROMPT =
  "You are a PII detection system. Given a document's text, identify every span of text that is personally identifying information. Return ONLY a JSON array, no prose, no markdown code fences. Each item: {\"text\": string, \"start\": number, \"end\": number, \"type\": string, \"confidence\": number between 0 and 1, \"rationale\": string}. Offsets are character indices into the provided text. Types should be one of: NAME, EMAIL, PHONE, ADDRESS, SSN, FINANCIAL_ACCOUNT, GOVERNMENT_ID, DATE_OF_BIRTH, OTHER.";

const E2E_SAMPLE_DOCUMENT = [
  'John Smith filed this review.',
  'The corroborated email is john.smith@example.com.',
  'The address is 742 Maple Rd.',
  'Use SSN 123-45-6789 for the high risk block.',
  'The type conflict marker is conflict John Smith.',
  'For boundary review, later, John Smith Account should stay visible.',
].join('\n');

const timeoutMs = Number(process.env.NIM_DIAGNOSTIC_TIMEOUT_MS || 60000);
const baseUrl = env.nvidiaNimBaseUrl.replace(/\/$/, '');
const apiKey = env.nvidiaNimApiKey;
const model = env.nvidiaNimModel;

// ── Helpers ────────────────────────────────────────────────────────────────

const ts = () => new Date().toISOString();

const probe = async (label, fn) => {
  const startedAt = ts();
  const wallStart = performance.now();
  let result;
  try {
    const value = await fn();
    const elapsedMs = Math.round(performance.now() - wallStart);
    result = { label, ok: true, elapsedMs, startedAt, finishedAt: ts(), ...value };
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - wallStart);
    result = {
      label,
      ok: false,
      elapsedMs,
      startedAt,
      finishedAt: ts(),
      error: {
        name: error.name,
        message: error.message,
        code: error.code ?? undefined,
        cause: error.cause
          ? { name: error.cause.name, code: error.cause.code, message: error.cause.message }
          : undefined,
      },
    };
  }
  console.log(`[${result.ok ? 'OK ' : 'ERR'}] ${label} — ${result.elapsedMs}ms`);
  if (!result.ok) console.log('       ', result.error.message);
  return result;
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const fetchJson = async (url, options = {}) => {
  const res = await fetchWithTimeout(url, options);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, statusText: res.statusText, ok: res.ok, body };
};

// ── Probes ─────────────────────────────────────────────────────────────────

const probeDns = () =>
  probe('dns.resolve integrate.api.nvidia.com', async () => {
    const hostname = new URL(baseUrl).hostname;
    const addresses = await dns.resolve4(hostname);
    return { hostname, addresses };
  });

const probeGetModels = () =>
  probe(`GET ${baseUrl}/models (authorized)`, async () => {
    const r = await fetchJson(`${baseUrl}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    const modelIds = Array.isArray(r.body?.data)
      ? r.body.data.map((m) => m.id)
      : undefined;
    return { status: r.status, statusText: r.statusText, modelIds };
  });

const probeUnauthPost = () =>
  probe('POST /chat/completions (no auth header)', async () => {
    const r = await fetchJson(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
      }),
    });
    return { status: r.status, statusText: r.statusText, body: r.body };
  });

const probeInvalidAuthPost = () =>
  probe('POST /chat/completions (invalid auth)', async () => {
    const r = await fetchJson(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer nvapi-INVALID-KEY-FOR-DIAGNOSTIC',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        stream: false,
      }),
    });
    return { status: r.status, statusText: r.statusText, body: r.body };
  });

const probeOptions = () =>
  probe(`OPTIONS ${baseUrl}/chat/completions`, async () => {
    const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
      method: 'OPTIONS',
    });
    const headers = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    return { status: res.status, statusText: res.statusText, headers };
  });

const probeAuthorizedCompletion = () =>
  probe(`POST /chat/completions (authorized, model=${model})`, async () => {
    const body = {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: E2E_SAMPLE_DOCUMENT },
      ],
      temperature: 0.1,
      max_tokens: 16384,
      extra_body: { chat_template_kwargs: { thinking: false } },
      stream: false,
    };
    const r = await fetchJson(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    let parsedSpans = null;
    let parseError = null;
    if (r.ok) {
      const content = r.body?.choices?.[0]?.message?.content ?? '';
      try {
        const raw = JSON.parse(stripMarkdownCodeFences(content));
        parsedSpans = Array.isArray(raw) ? raw : null;
      } catch (e) {
        parseError = e.message;
      }
    }

    return {
      status: r.status,
      statusText: r.statusText,
      requestBody: { ...body, extra_body: body.extra_body },
      responseBody: r.body,
      parsedSpanCount: parsedSpans?.length ?? null,
      parseError,
    };
  });

// ── Reconciliation report (runs only if completion succeeded) ──────────────

const reportReconciliation = async (completionResult) => {
  if (!completionResult.ok) return null;
  try {
    const rules = DEFAULT_ONTOLOGY_RULES.map((rule, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      ...rule,
    }));
    const content = completionResult.responseBody?.choices?.[0]?.message?.content ?? '';
    const raw = JSON.parse(stripMarkdownCodeFences(content));
    const llmSpans = Array.isArray(raw)
      ? raw
          .map((span) => ({
            text: E2E_SAMPLE_DOCUMENT.slice(span.start, span.end) || span.text,
            start: Number(span.start),
            end: Number(span.end),
            type: span.type,
            confidence: Number(span.confidence ?? 0),
            rationale: String(span.rationale || ''),
          }))
          .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
      : [];

    const ontologySpans = await detectWithOntology(E2E_SAMPLE_DOCUMENT, rules);
    const reconciled = reconcileSpans({
      documentId: '11111111-1111-4111-8111-111111111111',
      llmSpans,
      ontologySpans,
    });
    const conflicts = reconciled.filter((s) => s.conflict);
    return {
      llmSpanCount: llmSpans.length,
      ontologySpanCount: ontologySpans.length,
      reconciledSpanCount: reconciled.length,
      conflictCount: conflicts.length,
      conflicts: conflicts.map((s) => ({
        text: s.text,
        type: s.type,
        source: s.source,
        startOffset: s.start_offset,
        endOffset: s.end_offset,
        riskTier: s.risk_tier,
      })),
    };
  } catch (e) {
    return { error: e.message };
  }
};

// ── Main ───────────────────────────────────────────────────────────────────

const main = async () => {
  const runStartedAt = ts();
  const runLabel = runStartedAt.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);

  console.log(`\n=== NIM Diagnostic Run ${runStartedAt} ===`);
  console.log(`model : ${model}`);
  console.log(`baseUrl: ${baseUrl}`);
  console.log(`apiKeyPresent: ${Boolean(apiKey)}`);
  console.log(`timeoutMs: ${timeoutMs}\n`);

  const dns_ = await probeDns();
  const getModels = await probeGetModels();
  const unauthPost = await probeUnauthPost();
  const invalidAuth = await probeInvalidAuthPost();
  const options_ = await probeOptions();
  const completion = await probeAuthorizedCompletion();
  const reconciliation = await reportReconciliation(completion);

  const artifact = {
    schemaVersion: 1,
    runStartedAt,
    runFinishedAt: ts(),
    config: {
      baseUrl,
      model,
      timeoutMs,
      apiKeyPresent: Boolean(apiKey),
      apiKeyPrefix: apiKey ? apiKey.slice(0, 10) + '...' : null,
    },
    probes: {
      dns: dns_,
      getModels,
      unauthPost,
      invalidAuth,
      options: options_,
      authorizedCompletion: completion,
    },
    reconciliation,
  };

  await fs.mkdir(DIAGNOSTICS_DIR, { recursive: true });
  const outPath = path.join(DIAGNOSTICS_DIR, `nim_run_${runLabel}.json`);
  await fs.writeFile(outPath, JSON.stringify(artifact, null, 2), 'utf8');

  console.log(`\nArtifact written: ${outPath}`);
  console.log(`Completion ok: ${completion.ok}`);
  if (!completion.ok) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
