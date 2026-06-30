# Conseal Backend

Node.js + Express backend for Conseal, a document redaction review tool with a two-layer PII pipeline:

- LLM detection through NVIDIA NIM DeepSeek V4 Pro, or a mock detector when `USE_MOCK_LLM=true`
- Deterministic ontology/rule detection with persisted rule provenance
- Reconciliation that preserves source, conflict, risk tier, and priority metadata
- Review, bulk review, commit, summary, and audit APIs

## Setup

1. Install dependencies:

```sh
npm install
```

2. Create `.env` from `.env.example` and fill in Supabase credentials:

```sh
cp .env.example .env
```

`USE_MOCK_LLM=true` is the default so the pipeline can be tested before wiring a live NVIDIA key.

3. Run `supabase/schema.sql` in Supabase SQL editor.

For hackathon scope, this is a single-user, no-auth demo. Disable RLS for these tables or apply a permissive policy. The backend uses the Supabase service role key server-side only; the frontend should never talk to Supabase directly.

4. Start the API:

```sh
npm run dev
```

Health check:

```sh
curl http://localhost:3001/health
```

LLM configuration check, available in development only:

```sh
curl http://localhost:3001/health/llm
```

## API

- `POST /documents` multipart upload with field `file`; accepts `.txt`, `.pdf`, `.docx`, max 5MB
- `GET /documents/:id`
- `GET /documents/:id/summary`
- `PATCH /documents/:id/spans/:spanId`
- `POST /documents/:id/spans/bulk`
- `POST /documents/:id/commit`
- `GET /documents/:id/download` downloads the committed redacted `.txt` file
- `GET /documents/:id/audit`

Errors always use:

```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```

## Tests

```sh
npm test
```

## LLM Troubleshooting

Use mock mode while validating Supabase, upload handling, reconciliation, and review APIs:

```env
USE_MOCK_LLM=true
ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE=true
```

Switch to live NVIDIA NIM mode:

```env
USE_MOCK_LLM=false
NVIDIA_NIM_API_KEY=your-key
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_NIM_MODEL=meta/llama-3.1-8b-instruct
```

`NVIDIA_NIM_MODEL` is intentionally configurable. The default is a smaller general chat model. If your key has access to `deepseek-ai/deepseek-v4-pro` and you want the spec model, set `NVIDIA_NIM_MODEL=deepseek-ai/deepseek-v4-pro` in `.env` without editing source code.

HTTP `429` usually means rate limit, quota, entitlement, or model-capacity pressure. The backend retries retryable `429` responses with exponential backoff and jitter, and respects `Retry-After` when NVIDIA supplies it. If the response indicates invalid credentials, unavailable model, exhausted quota, or insufficient permissions, the backend does not blindly retry; with `ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE=false`, it returns a structured JSON error telling you what to check.

For demos, keep:

```env
ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE=true
```

For integration debugging, set:

```env
ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE=false
```

Then upload a document and inspect the structured error response if live detection fails.

Verify safe LLM configuration without exposing secrets:

```sh
curl http://localhost:3001/health/llm
```

The response includes mock mode, base URL, configured model, whether an API key is present, and the last safe LLM error category. It never returns the API key.
