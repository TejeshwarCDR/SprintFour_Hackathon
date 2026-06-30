create extension if not exists "pgcrypto";

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  raw_text text not null,
  status text not null default 'pending'
    check (status in ('pending','in_review','committed')),
  uploaded_at timestamptz not null default now()
);

create table if not exists ontology_rules (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  pattern text,
  description text
);

create table if not exists spans (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  text text not null,
  start_offset int not null,
  end_offset int not null,
  type text not null,
  llm_confidence numeric,
  llm_rationale text,
  ontology_rule_id uuid references ontology_rules(id),
  source text not null check (source in ('LLM','ONTOLOGY','BOTH')),
  conflict boolean not null default false,
  risk_tier text not null check (risk_tier in ('high','medium','low')),
  priority_score numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','overridden')),
  reviewed_at timestamptz,
  reviewed_by text
);

create table if not exists audit_entries (
  id uuid primary key default gen_random_uuid(),
  span_id uuid not null references spans(id) on delete cascade,
  action text not null,
  actor text,
  "timestamp" timestamptz not null default now(),
  previous_state jsonb,
  new_state jsonb
);
