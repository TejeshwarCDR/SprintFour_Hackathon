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

// Returns { spans, usedFallback } — usedFallback=true means the mock detector
// ran because the live NIM call failed and ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE=true.
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
    return { spans: await fallback(documentText), usedFallback: true };
  }

  try {
    const firstContent = await requestDetection(documentText, SYSTEM_PROMPT);
    return { spans: parseLlmResponse(firstContent, documentText), usedFallback: false };
  } catch (firstError) {
    if (firstError instanceof LlmProviderError) {
      const fallback = fallbackOrThrow(firstError);
      return { spans: await fallback(documentText), usedFallback: true };
    }

    try {
      const strictPrompt = `${SYSTEM_PROMPT} The previous response was invalid. Return a raw JSON array only. No explanation, no markdown, no surrounding text.`;
      const retryContent = await requestDetection(documentText, strictPrompt);
      return { spans: parseLlmResponse(retryContent, documentText), usedFallback: false };
    } catch (secondError) {
      if (secondError instanceof LlmProviderError) {
        const fallback = fallbackOrThrow(secondError);
        return { spans: await fallback(documentText), usedFallback: true };
      }

      const outputError = new AppError(502, 'LLM_OUTPUT_ERROR', 'NVIDIA NIM returned malformed span JSON', {
        category: 'malformed_output',
        model: env.nvidiaNimModel,
        developerAction: 'Inspect the model output and prompt. The backend retried once with a stricter JSON-only prompt.',
      });
      const fallback = fallbackOrThrow(outputError);
      return { spans: await fallback(documentText), usedFallback: true };
    }
  }
};

// Returns { spans, detectionSource: 'live' | 'fallback' | 'mock_mode' }.
export const detectWithLLM = async (documentText) => {
  if (env.useMockLlm) {
    return { spans: await detectWithMockLlm(documentText), detectionSource: 'mock_mode' };
  }

  const { spans, usedFallback } = await detectWithLiveLlm(documentText);
  return { spans, detectionSource: usedFallback ? 'fallback' : 'live' };
};

// Returns a human-readable label for the active LLM detector, for display in the UI.
export const getActiveLlmName = () =>
  env.useMockLlm ? 'Mock LLM' : `NVIDIA NIM (${env.nvidiaNimModel})`;
