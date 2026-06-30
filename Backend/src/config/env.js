import dotenv from 'dotenv';

dotenv.config();

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return String(value).toLowerCase() === 'true';
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  nvidiaNimApiKey: process.env.NVIDIA_NIM_API_KEY || '',
  nvidiaNimBaseUrl: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  nvidiaNimModel: process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.1-8b-instruct',
  nvidiaNimTimeoutMs: Number(process.env.NVIDIA_NIM_TIMEOUT_MS || 45000),
  nvidiaNimMaxRetries: Number(process.env.NVIDIA_NIM_MAX_RETRIES || 2),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
  useMockLlm: parseBoolean(process.env.USE_MOCK_LLM, true),
  allowMockFallbackOnLlmFailure: parseBoolean(process.env.ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE, true),
};

export const assertSupabaseEnv = () => {
  const missing = [];
  if (!env.supabaseUrl) missing.push('SUPABASE_URL');
  if (!env.supabaseServiceKey) missing.push('SUPABASE_SERVICE_KEY');
  if (missing.length > 0) {
    throw new Error(`Missing required Supabase environment variables: ${missing.join(', ')}`);
  }
};
