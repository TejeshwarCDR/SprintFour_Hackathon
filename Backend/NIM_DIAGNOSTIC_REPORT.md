# NIM Diagnostic Report

**Generated:** 2026-06-30  
**Purpose:** Read-only factual snapshot for external review. No fixes or new requests were attempted.

---

## 1. Environment

| Property | Value |
|---|---|
| Execution context | macOS, Claude Code VSCode extension (interactive assistant session) |
| OS | macOS 26.5.1 (Darwin 25.5.0 / BuildVersion 25F80) |
| Node.js version | v24.8.0 |
| Shell | zsh |
| Outbound network | No restriction documented in any config file, CLAUDE.md, or project README. Network access from this execution context (the assistant process itself) is not the same as network access from `node scripts/diagnose-nim.js`. No network-restriction policy is recorded anywhere in this project. |

---

## 2. Current Configuration

Sourced from `Backend/.env` and `Backend/src/config/env.js`. Values in `.env` override `env.js` defaults.

| Variable | Value |
|---|---|
| `NVIDIA_NIM_BASE_URL` | `https://integrate.api.nvidia.com/v1` (set in `.env`) |
| `NVIDIA_NIM_MODEL` | **not set in `.env`** → defaults to `meta/llama-3.1-8b-instruct` (env.js line 15) |
| `NVIDIA_NIM_TIMEOUT_MS` | **not set in `.env`** → defaults to `45000` ms (env.js line 16) |
| `NVIDIA_NIM_MAX_RETRIES` | **not set in `.env`** → defaults to `2` (env.js line 17) |
| `USE_MOCK_LLM` | `false` (set in `.env`) |
| `ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE` | **not set in `.env`** → defaults to `true` (env.js line 21) |
| `NVIDIA_NIM_API_KEY` | present in `.env`, begins with `nvapi-` — **redacted** |
| `max_tokens` | `16384` (hardcoded in `requestDetection`, llmDetector.js line 176) |
| `temperature` | `0.1` (hardcoded in `requestDetection`, llmDetector.js line 175) |
| `extra_body` | `{ "chat_template_kwargs": { "thinking": false } }` (hardcoded, llmDetector.js line 177) |

**Note on model mismatch:** `scripts/diagnose-nim.js` does **not** read `NVIDIA_NIM_MODEL` from the environment. It hardcodes `"deepseek-ai/deepseek-v4-pro"` in every test request (lines 169, 183, 196, 207, 221, 236). The live application (llmDetector.js) uses `env.nvidiaNimModel`, which currently resolves to `meta/llama-3.1-8b-instruct`. These are different models.

---

## 3. LLM Call Code Path — `llmDetector.js` (verbatim)

File: `Backend/src/services/detection/llmDetector.js`

```javascript
import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { PII_TYPES } from '../../constants/pii.js';
import { AppError } from '../../errors/AppError.js';
import { stripMarkdownCodeFences } from '../../utils/json.js';
import { normalizeEndOffset } from '../../utils/offsets.js';
import { clearLlmError, recordLlmError } from './llmDiagnostics.js';
import { detectWithMockLlm } from './mockLlmDetector.js';

const SYSTEM_PROMPT = 'You are a PII detection system. Given a document\'s text, identify every span of text that is personally identifying information. Return ONLY a JSON array, no prose, no markdown code fences. Each item: {"text": string, "start": number, "end": number, "type": string, "confidence": number between 0 and 1, "rationale": string}. Offsets are character indices into the provided text. Types should be one of: NAME, EMAIL, PHONE, ADDRESS, SSN, FINANCIAL_ACCOUNT, GOVERNMENT_ID, DATE_OF_BIRTH, OTHER.';

const createClient = () => new OpenAI({
  apiKey: env.nvidiaNimApiKey,
  baseURL: env.nvidiaNimBaseUrl,
  timeout: env.nvidiaNimTimeoutMs,
  maxRetries: 0,
});

class LlmProviderError extends AppError {
  constructor(metadata) {
    const statusCode = metadata.status === 429 ? 429 : 502;
    super(statusCode, 'LLM_PROVIDER_ERROR', metadata.message, {
      category: metadata.category,
      status: metadata.status ?? null,
      requestId: metadata.requestId ?? null,
      retryAfter: metadata.retryAfter ?? null,
      model: metadata.model,
      developerAction: metadata.developerAction,
    });
    this.metadata = metadata;
  }
}

class LlmOutputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LlmOutputError';
  }
}

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const getHeader = (headers, name) => {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const lowerName = name.toLowerCase();
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName);
  return match?.[1] ?? null;
};

const parseRetryAfterMs = (retryAfter) => {
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
};

const isQuotaOrPermissionMessage = (message) => (
  /quota|exhausted|insufficient|permission|not authorized|not allowed|billing|entitlement/i.test(message || '')
);

const isModelUnavailableMessage = (message) => (
  /model.*not.*found|not.*available|unknown model|does not exist|not supported/i.test(message || '')
);

const classifyProviderError = (error) => {
  const status = error.status ?? error.response?.status ?? null;
  const headers = error.headers ?? error.response?.headers ?? null;
  const retryAfter = getHeader(headers, 'retry-after');
  const requestId = (
    getHeader(headers, 'x-request-id') ||
    getHeader(headers, 'x-nvidia-request-id') ||
    getHeader(headers, 'nvcf-reqid') ||
    error.request_id ||
    null
  );
  const message = error.message || 'NVIDIA NIM request failed';
  let category = 'provider_error';
  let retryable = false;
  let developerAction = 'Check NVIDIA NIM service status, model access, and request configuration.';

  if (status === 401) {
    category = 'invalid_credentials';
    developerAction = 'Check NVIDIA_NIM_API_KEY.';
  } else if (status === 403 || isQuotaOrPermissionMessage(message)) {
    category = /quota|exhausted|billing/i.test(message) ? 'quota_exhausted' : 'insufficient_permissions';
    developerAction = 'Check NVIDIA account permissions, quota, billing, and model entitlement.';
  } else if (status === 400 || status === 404 || isModelUnavailableMessage(message)) {
    category = 'model_unavailable';
    developerAction = 'Check NVIDIA_NIM_MODEL and confirm the model is available for this API key.';
  } else if (status === 429) {
    category = 'rate_limited';
    retryable = !isQuotaOrPermissionMessage(message);
    developerAction = 'Wait for rate limit reset, lower request frequency, or choose a model/quota tier available to this key.';
  } else if (status >= 500 || error.name === 'APIConnectionError' || error.name === 'APIConnectionTimeoutError') {
    category = 'transient_provider_error';
    retryable = true;
  } else if (error.name === 'AbortError' || /timed out|timeout/i.test(message)) {
    category = 'timeout';
    retryable = true;
  }

  return {
    category,
    retryable,
    status,
    requestId,
    retryAfter,
    model: env.nvidiaNimModel,
    message,
    developerAction,
  };
};

const retryDelayMs = (attempt, retryAfter) => {
  const retryAfterMs = parseRetryAfterMs(retryAfter);
  if (retryAfterMs !== null) return retryAfterMs;

  const base = 500 * (2 ** attempt);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(10_000, base + jitter);
};

const logSafeLlmEvent = (message, metadata) => {
  console.warn(message, {
    category: metadata.category,
    status: metadata.status,
    requestId: metadata.requestId,
    retryAfter: metadata.retryAfter,
    model: metadata.model,
    attempt: metadata.attempt,
    maxRetries: metadata.maxRetries,
  });
};

const parseLlmResponse = (content, documentText) => {
  const parsed = JSON.parse(stripMarkdownCodeFences(content));
  if (!Array.isArray(parsed)) {
    throw new LlmOutputError('LLM response was not a JSON array');
  }

  return parsed
    .map((item) => {
      const { start, end } = normalizeEndOffset(documentText, item.start, item.end);
      const type = PII_TYPES.includes(item.type) ? item.type : 'OTHER';
      return {
        text: documentText.slice(start, end) || String(item.text || ''),
        start,
        end,
        type,
        confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0))),
        rationale: String(item.rationale || ''),
      };
    })
    .filter((span) => span.end > span.start);
};

const requestDetection = async (documentText, systemPrompt) => {
  const client = createClient();
  let lastMetadata = null;

  for (let attempt = 0; attempt <= env.nvidiaNimMaxRetries; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model: env.nvidiaNimModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: documentText },
        ],
        temperature: 0.1,
        max_tokens: 16384,
        extra_body: { chat_template_kwargs: { thinking: false } },
        stream: false,
      });

      clearLlmError();
      return response.choices?.[0]?.message?.content || '[]';
    } catch (error) {
      const metadata = classifyProviderError(error);
      lastMetadata = metadata;
      recordLlmError(metadata);

      if (!metadata.retryable || attempt >= env.nvidiaNimMaxRetries) {
        throw new LlmProviderError(metadata);
      }

      logSafeLlmEvent('NVIDIA NIM request retrying after provider error.', {
        ...metadata,
        attempt: attempt + 1,
        maxRetries: env.nvidiaNimMaxRetries,
      });
      await delay(retryDelayMs(attempt, metadata.retryAfter));
    }
  }

  throw new LlmProviderError(lastMetadata);
};

const fallbackOrThrow = (error) => {
  const metadata = error.metadata || {
    category: error.details?.category || (error.name === 'LlmOutputError' ? 'malformed_output' : 'unknown'),
    status: error.details?.status ?? null,
    requestId: error.details?.requestId ?? null,
    retryAfter: error.details?.retryAfter ?? null,
    message: error.message,
    model: error.details?.model || env.nvidiaNimModel,
  };
  recordLlmError(metadata);

  if (env.allowMockFallbackOnLlmFailure) {
    console.warn('LLM detection failed; using mock fallback because ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE=true.', {
      category: metadata.category,
      status: metadata.status,
      requestId: metadata.requestId,
      retryAfter: metadata.retryAfter,
      model: metadata.model,
    });
    return detectWithMockLlm;
  }

  throw error;
};

export const detectWithLiveLlm = async (documentText) => {
  if (!env.nvidiaNimApiKey) {
    const error = new LlmProviderError({
      category: 'missing_api_key',
      status: null,
      requestId: null,
      retryAfter: null,
      model: env.nvidiaNimModel,
      message: 'NVIDIA_NIM_API_KEY is required when USE_MOCK_LLM=false',
      developerAction: 'Set NVIDIA_NIM_API_KEY or enable USE_MOCK_LLM=true.',
    });
    const fallback = fallbackOrThrow(error);
    return fallback(documentText);
  }

  try {
    const firstContent = await requestDetection(documentText, SYSTEM_PROMPT);
    return parseLlmResponse(firstContent, documentText);
  } catch (firstError) {
    if (firstError instanceof LlmProviderError) {
      const fallback = fallbackOrThrow(firstError);
      return fallback(documentText);
    }

    try {
      const strictPrompt = `${SYSTEM_PROMPT} The previous response was invalid. Return a raw JSON array only. No explanation, no markdown, no surrounding text.`;
      const retryContent = await requestDetection(documentText, strictPrompt);
      return parseLlmResponse(retryContent, documentText);
    } catch (secondError) {
      if (secondError instanceof LlmProviderError) {
        const fallback = fallbackOrThrow(secondError);
        return fallback(documentText);
      }

      const outputError = new AppError(502, 'LLM_OUTPUT_ERROR', 'NVIDIA NIM returned malformed span JSON', {
        category: 'malformed_output',
        model: env.nvidiaNimModel,
        developerAction: 'Inspect the model output and prompt. The backend retried once with a stricter JSON-only prompt.',
      });
      const fallback = fallbackOrThrow(outputError);
      return fallback(outputError);
    }
  }
};

export const detectWithLLM = async (documentText) => {
  if (env.useMockLlm) {
    return detectWithMockLlm(documentText);
  }

  return detectWithLiveLlm(documentText);
};

// Returns a human-readable label for the active LLM detector, for display in the UI.
export const getActiveLlmName = () =>
  env.useMockLlm ? 'Mock LLM' : `NVIDIA NIM (${env.nvidiaNimModel})`;
```

---

## 4. Most Recent `diagnose:nim` Run Results

**No saved output exists.**

The script `scripts/diagnose-nim.js` exists and is registered as `npm run diagnose:nim`. Searching the entire project tree (excluding `node_modules`) for any `.log`, `.txt`, or other output file containing the script's characteristic output markers (`elapsedMs`, `=== 1.`, `NVIDIA`, `deepseek`) returned zero results. The git log contains only three initial commits with no saved run artifacts. No output from any previous execution of `npm run diagnose:nim` is available anywhere in this repository or in the session's accessible file system.

Raw timing and raw error output: **not available — script has not been run in this environment or output was not captured to a file.**

---

## 5. Connectivity / Auth / Completion Test History

No actual test run outputs exist in this project's file system or git history. The table below records what tests the `diagnose-nim.js` script is **designed** to run (derived by reading the script source), not the results of any execution of those tests.

| # | Test description | Script label (diagnose-nim.js) | Model used by script | Result | Latency |
|---|---|---|---|---|---|
| 1 | Minimal POST — single user message, no extra_body, no max_tokens | `1. minimal direct request, no extra_body, no max_tokens` | `deepseek-ai/deepseek-v4-pro` | **NOT RUN** | — |
| 2 | Full system prompt, short document, no extra_body, default max_tokens | `2. full system prompt, short document, no extra_body, default max_tokens` | `deepseek-ai/deepseek-v4-pro` | **NOT RUN** | — |
| 3 | Add `extra_body: { chat_template_kwargs: { thinking: false } }` | `3. add extra_body thinking:false` | `deepseek-ai/deepseek-v4-pro` | **NOT RUN** | — |
| 4 | Add `max_tokens: 16384` | `4. add max_tokens 16384` | `deepseek-ai/deepseek-v4-pro` | **NOT RUN** | — |
| 5 | Full integration: e2e sample document | `5. integration:e2e sample document` | `deepseek-ai/deepseek-v4-pro` | **NOT RUN** | — |
| 6 | Hackathon-sized document (8× repeat of e2e sample) | `6. hackathon-sized document` | `deepseek-ai/deepseek-v4-pro` | **NOT RUN** | — |

DNS resolution, GET /models, unauthenticated POST, invalid-auth POST, and OPTIONS probes are **not part of the `diagnose-nim.js` script**. No other connectivity test scripts exist in this project. No external test output files were found.

---

## 6. JSON Parsing and Retry Logic (verbatim)

### `stripMarkdownCodeFences` — `Backend/src/utils/json.js`

```javascript
export const stripMarkdownCodeFences = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('```')) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
};
```

### `parseLlmResponse` — `Backend/src/services/detection/llmDetector.js` (lines 141–161)

```javascript
const parseLlmResponse = (content, documentText) => {
  const parsed = JSON.parse(stripMarkdownCodeFences(content));
  if (!Array.isArray(parsed)) {
    throw new LlmOutputError('LLM response was not a JSON array');
  }

  return parsed
    .map((item) => {
      const { start, end } = normalizeEndOffset(documentText, item.start, item.end);
      const type = PII_TYPES.includes(item.type) ? item.type : 'OTHER';
      return {
        text: documentText.slice(start, end) || String(item.text || ''),
        start,
        end,
        type,
        confidence: Math.max(0, Math.min(1, Number(item.confidence ?? 0))),
        rationale: String(item.rationale || ''),
      };
    })
    .filter((span) => span.end > span.start);
};
```

### Retry loop — `requestDetection` (lines 163–202)

- Outer loop: `for (let attempt = 0; attempt <= env.nvidiaNimMaxRetries; attempt += 1)` — currently `nvidiaNimMaxRetries = 2`, so up to 3 total attempts.
- Retry is only attempted when `metadata.retryable === true` **and** `attempt < nvidiaNimMaxRetries`.
- Non-retryable categories: `invalid_credentials` (401), `insufficient_permissions` / `quota_exhausted` (403 or matching message), `model_unavailable` (400/404), `rate_limited` where the body also matches the quota/permission pattern.
- Retryable categories: `transient_provider_error` (5xx, `APIConnectionError`, `APIConnectionTimeoutError`), `timeout`, `rate_limited` when message does not match the quota pattern.
- Delay formula: `Math.min(10_000, 500 * 2^attempt + jitter(0–249ms))`. If `Retry-After` header is present, its value (in seconds or HTTP-date) is used instead.
- `OpenAI` client is created with `maxRetries: 0` — the openai SDK itself does not retry; all retry logic is in `requestDetection`.

### Output-error retry — `detectWithLiveLlm` (lines 229–272)

If `parseLlmResponse` throws `LlmOutputError` (invalid JSON or non-array), `detectWithLiveLlm` makes one additional call to `requestDetection` with a stricter prompt appended. If that also fails with `LlmOutputError`, a `502 LLM_OUTPUT_ERROR` is produced and passed to `fallbackOrThrow`.

---

## 7. Fallback Behavior

### Conditions for switching to mock

**Path A — `USE_MOCK_LLM=true` (not current):**  
`detectWithLLM` calls `detectWithMockLlm` directly before any network call. No NIM request is ever made.

**Path B — `USE_MOCK_LLM=false` + `ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE=true` (current configuration):**  
`detectWithLiveLlm` calls `requestDetection`. On any `LlmProviderError` (auth failure, 4xx, 5xx, timeout, missing API key, or after exhausting retries), `fallbackOrThrow` is called. Because `env.allowMockFallbackOnLlmFailure` is `true`, it logs a warning to `console.warn` and returns `detectWithMockLlm`. The live call is silently replaced by the mock detector for that document. Subsequent documents each attempt live detection again independently.

On `LlmOutputError` after both the first and retry attempts, the same `fallbackOrThrow` path applies.

**Path C — `ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE=false` (not current):**  
The `LlmProviderError` or `LlmOutputError` is re-thrown and reaches the route error handler, returning a structured JSON error to the caller.

### Visibility of the switch in the UI

The `MockBanner` component in `Frontend/src/App.jsx` activates only when the **frontend cannot reach the backend server at all** (a `TypeError` / network error on `fetch`). Its message is: `"DEMO MODE — backend unreachable, showing static mock data."` This condition is entirely separate from the backend-internal NIM fallback.

When the backend silently falls back from NIM to `detectWithMockLlm` via `ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE=true`, the frontend receives a normal 200 response with detection results. There is **no UI indicator** that detection came from the mock path rather than NIM. The switch is only visible in:
- The backend server process's `console.warn` stream.
- The `GET /health/llm` endpoint (available in non-production environments), which returns `lastError` from `llmDiagnostics.js` state.

---

## 8. What Has Not Been Verified

**Has a live authorized chat completion ever succeeded and returned actual content from outside this execution environment?**

**Unknown.**

No evidence exists in this repository — no saved output files, no log artifacts, no git commits referencing a successful NIM response — that `npm run diagnose:nim` or any live NIM call has ever been executed and produced a response. The git history contains three initial setup commits. The `diagnose-nim.js` script is present and syntactically correct but its output has never been captured in any persistent form that is accessible in this environment.

The API key in `.env` is present and syntactically valid (begins with `nvapi-`), but whether it is authorized, quota-enabled, and able to reach either `meta/llama-3.1-8b-instruct` (the model the app uses) or `deepseek-ai/deepseek-v4-pro` (the model the diagnostic script uses) has not been verified by any run whose output is available here.
