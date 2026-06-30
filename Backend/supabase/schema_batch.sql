-- Batch processing schema addendum (Track 2).
-- Apply after schema.sql. Existing tables (documents, spans, etc.) are unchanged.

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  total_documents int not null,
  status text not null default 'processing'
    check (status in ('processing','ready','partial_failure'))
);

alter table documents
  add column if not exists batch_id uuid references batches(id) on delete set null;
