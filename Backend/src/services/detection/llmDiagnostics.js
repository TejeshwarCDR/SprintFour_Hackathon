import { env } from '../../config/env.js';

let lastLlmError = null;

export const recordLlmError = (metadata) => {
  lastLlmError = {
    category: metadata.category,
    status: metadata.status ?? null,
    requestId: metadata.requestId ?? null,
    retryAfter: metadata.retryAfter ?? null,
    model: metadata.model ?? env.nvidiaNimModel,
    message: metadata.message ?? null,
    timestamp: new Date().toISOString(),
  };
};

export const clearLlmError = () => {
  lastLlmError = null;
};

export const getLlmHealth = () => ({
  mockModeEnabled: env.useMockLlm,
  allowMockFallbackOnLlmFailure: env.allowMockFallbackOnLlmFailure,
  baseUrl: env.nvidiaNimBaseUrl,
  model: env.nvidiaNimModel,
  apiKeyPresent: Boolean(env.nvidiaNimApiKey),
  timeoutMs: env.nvidiaNimTimeoutMs,
  maxRetries: env.nvidiaNimMaxRetries,
  lastError: lastLlmError,
});
