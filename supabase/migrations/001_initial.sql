-- =============================================================================
-- 001_initial.sql — dbt-contracts initial schema
-- =============================================================================
-- Supabase (Postgres 15) migration.
-- Run via: supabase db push
-- Or apply manually: psql $DATABASE_URL -f supabase/migrations/001_initial.sql
-- =============================================================================

-- Enable UUID generation. Supabase includes this by default, but being explicit
-- prevents surprises when running against a plain Postgres instance.
create extension if not exists "uuid-ossp";

-- =============================================================================
-- sessions
-- Represents a single upload session. We track sessions rather than users
-- because the app is deliberately anonymous — no login required.
-- =============================================================================
create table if not exists sessions (
    id              uuid primary key default uuid_generate_v4(),
    created_at      timestamptz not null default now(),
    -- SHA-256 of the manifest JSON lets us detect repeat uploads without storing the file
    manifest_hash   varchar(64) not null,
    model_count     integer not null default 0,
    -- We store the IP hash (not the raw IP) for rate limiting lookups
    ip_hash         varchar(64),
    -- e.g. "1.7.4" — helps us understand which dbt versions are in the wild
    dbt_version     varchar(20)
);

-- Index for rate limiting: find recent sessions by IP hash quickly
create index if not exists sessions_ip_hash_created_at_idx
    on sessions (ip_hash, created_at desc);

-- =============================================================================
-- contracts
-- Individual model contracts generated within a session.
-- We persist these so users can return to the download page and re-export.
-- =============================================================================
create table if not exists contracts (
    id              uuid primary key default uuid_generate_v4(),
    session_id      uuid not null references sessions(id) on delete cascade,
    model_name      varchar(255) not null,
    -- Raw YAML string as returned by Claude + parsed/validated
    contract_yaml   text not null,
    -- Track whether the contract has been validated after generation
    is_valid        boolean not null default false,
    -- Validation errors as a JSON array of {line, message} objects
    validation_errors jsonb,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- Querying all contracts for a session is the hot path (export endpoint)
create index if not exists contracts_session_id_idx
    on contracts (session_id, model_name);

-- Auto-update updated_at — cleaner than doing it in application code
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger contracts_updated_at
    before update on contracts
    for each row execute procedure update_updated_at_column();

-- =============================================================================
-- waitlist
-- Simple email capture. Supabase row-level security will restrict writes
-- to the anon role so only the API can insert.
-- =============================================================================
create table if not exists waitlist (
    id          uuid primary key default uuid_generate_v4(),
    email       varchar(255) not null,
    created_at  timestamptz not null default now(),
    -- Optional: where did they come from? landing page, product hunt, etc.
    source      varchar(100) default 'landing',
    -- Store the referrer URL so we can see which marketing channels convert
    referrer    text,
    constraint waitlist_email_unique unique (email)
);

-- =============================================================================
-- stats (materialised, not a live table)
-- We use a single-row table updated by a Postgres function rather than
-- running count(*) on every /api/stats request, which would be expensive
-- at scale.
-- =============================================================================
create table if not exists stats (
    id                  integer primary key default 1,
    total_manifests     bigint not null default 0,
    total_contracts     bigint not null default 0,
    total_waitlist      bigint not null default 0,
    last_updated_at     timestamptz not null default now(),
    -- Enforce single-row constraint
    constraint stats_single_row check (id = 1)
);

-- Seed the stats row so UPDATE works without INSERT logic in the app
insert into stats (id, total_manifests, total_contracts, total_waitlist)
values (1, 0, 0, 0)
on conflict (id) do nothing;

-- Increment stats atomically when a session is created
create or replace function increment_manifest_stat()
returns trigger language plpgsql as $$
begin
    update stats set
        total_manifests = total_manifests + 1,
        last_updated_at = now()
    where id = 1;
    return new;
end;
$$;

create trigger sessions_increment_stats
    after insert on sessions
    for each row execute procedure increment_manifest_stat();

-- Increment stats when a contract is created
create or replace function increment_contract_stat()
returns trigger language plpgsql as $$
begin
    update stats set
        total_contracts = total_contracts + 1,
        last_updated_at = now()
    where id = 1;
    return new;
end;
$$;

create trigger contracts_increment_stats
    after insert on contracts
    for each row execute procedure increment_contract_stat();

-- Increment stats when a waitlist entry is added
create or replace function increment_waitlist_stat()
returns trigger language plpgsql as $$
begin
    update stats set
        total_waitlist = total_waitlist + 1,
        last_updated_at = now()
    where id = 1;
    return new;
end;
$$;

create trigger waitlist_increment_stats
    after insert on waitlist
    for each row execute procedure increment_waitlist_stat();

-- =============================================================================
-- Row Level Security
-- The anon key (used by the backend service) should only be able to INSERT
-- into waitlist and SELECT stats. The service role key bypasses RLS entirely.
-- =============================================================================
alter table sessions enable row level security;
alter table contracts enable row level security;
alter table waitlist enable row level security;
alter table stats enable row level security;

-- Service role (backend) can do everything — RLS is bypassed for service role
-- by Supabase by default. These policies govern the anon role.

-- Public can read stats (for the landing page counter)
create policy "stats_public_read" on stats
    for select using (true);

-- Public cannot write stats directly (only via triggers)
create policy "stats_no_direct_write" on stats
    for insert with check (false);

-- Sessions, contracts: service role only (anon blocked)
create policy "sessions_service_only" on sessions
    for all using (auth.role() = 'service_role');

create policy "contracts_service_only" on contracts
    for all using (auth.role() = 'service_role');

-- Waitlist: anon can insert their own email, service role can read all
create policy "waitlist_insert_anon" on waitlist
    for insert with check (true);

create policy "waitlist_service_read" on waitlist
    for select using (auth.role() = 'service_role');
