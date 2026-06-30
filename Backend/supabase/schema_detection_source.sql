-- Adds per-document detection_source so the UI can surface when a document
-- was processed by the mock detector (either because USE_MOCK_LLM=true or
-- because the live NIM call failed and ALLOW_MOCK_FALLBACK_ON_LLM_FAILURE=true).
-- Apply after schema.sql and schema_batch.sql.

alter table documents
  add column if not exists detection_source text
    check (detection_source in ('live', 'fallback', 'mock_mode'));
