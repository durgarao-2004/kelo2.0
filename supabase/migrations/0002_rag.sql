-- =============================================================================
-- KELO — 0002 RAG (retrieval-augmented generation)
--
-- Lecture transcripts/summaries are chunked into `lecture_chunks`. Retrieval is
-- HYBRID:
--   * Full-text search (tsvector) — always available, no extension needed.
--   * Vector similarity (pgvector) — optional; used when embeddings are present.
-- If the `vector` extension is unavailable on your plan, you may skip the
-- embedding column + index and rely on full-text search alone.
-- =============================================================================

create extension if not exists vector;

create table if not exists public.lecture_chunks (
  id          uuid primary key default gen_random_uuid(),
  lecture_id  uuid not null references public.lectures(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  subject_id  uuid references public.subjects(id) on delete set null,
  source      text not null default 'transcript' check (source in ('transcript','summary')),
  chunk_index integer not null,
  content     text not null,
  tsv         tsvector generated always as (to_tsvector('english', content)) stored,
  embedding   vector(768),
  created_at  timestamptz not null default now()
);
create index if not exists lecture_chunks_user_idx on public.lecture_chunks(user_id);
create index if not exists lecture_chunks_lecture_idx on public.lecture_chunks(lecture_id);
create index if not exists lecture_chunks_tsv_idx on public.lecture_chunks using gin(tsv);
-- Cosine-distance ANN index for semantic search (safe to skip if unsupported).
create index if not exists lecture_chunks_embedding_idx
  on public.lecture_chunks using hnsw (embedding vector_cosine_ops);

alter table public.lecture_chunks enable row level security;
alter table public.lecture_chunks force row level security;
revoke all on table public.lecture_chunks from anon, authenticated;

-- ---------- Full-text retrieval (always works) ----------
create or replace function public.search_lecture_chunks(
  p_user_id uuid,
  p_query   text,
  p_limit   integer default 8
)
returns table (
  chunk_id   uuid,
  lecture_id uuid,
  subject_id uuid,
  source     text,
  content    text,
  rank       real
)
language sql
stable
as $$
  select
    c.id,
    c.lecture_id,
    c.subject_id,
    c.source,
    c.content,
    ts_rank(c.tsv, websearch_to_tsquery('english', p_query)) as rank
  from public.lecture_chunks c
  where c.user_id = p_user_id
    and c.tsv @@ websearch_to_tsquery('english', p_query)
  order by rank desc
  limit greatest(1, least(p_limit, 50));
$$;

-- ---------- Semantic retrieval (requires embeddings) ----------
create or replace function public.match_lecture_chunks(
  p_user_id   uuid,
  p_embedding vector(768),
  p_limit     integer default 8
)
returns table (
  chunk_id   uuid,
  lecture_id uuid,
  subject_id uuid,
  source     text,
  content    text,
  similarity real
)
language sql
stable
as $$
  select
    c.id,
    c.lecture_id,
    c.subject_id,
    c.source,
    c.content,
    (1 - (c.embedding <=> p_embedding))::real as similarity
  from public.lecture_chunks c
  where c.user_id = p_user_id
    and c.embedding is not null
  order by c.embedding <=> p_embedding
  limit greatest(1, least(p_limit, 50));
$$;

-- These functions are executed by the server (service role) with an explicit
-- p_user_id filter; do not expose them to anon/authenticated.
revoke all on function public.search_lecture_chunks(uuid, text, integer) from anon, authenticated;
revoke all on function public.match_lecture_chunks(uuid, vector, integer) from anon, authenticated;
