-- Operational audit only: never used as prediction evidence or performance results.
create table public.model_capture_events (
  event_id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  model_version text not null check(model_version='poisson-venue-v1'),
  fixture_id bigint check(fixture_id>0),
  league_id bigint,
  recorded_at timestamptz not null default clock_timestamp(),
  status text not null,
  reason text not null,
  check (
    (status='run' and fixture_id is null and league_id is null and reason in ('RUN_STARTED','RUN_COMPLETED','MATCHES_UNAVAILABLE')) or
    (status='inserted' and reason='PREDICTION_SAVED') or
    (status='duplicate' and reason in ('ALREADY_RECORDED','CONCURRENT_DUPLICATE')) or
    (status='skipped' and reason in ('UNSUPPORTED_LEAGUE','INVALID_KICKOFF','OUTSIDE_HORIZON','ODDS_FETCH_FAILED','ODDS_UNAVAILABLE','STALE_OR_STARTED','INVALID_IDS','INSUFFICIENT_HISTORY','INVALID_LEAGUE_AVERAGE')) or
    (status='failed' and reason in ('MODEL_LEDGER_UNAVAILABLE','HISTORY_UNAVAILABLE','PREDICTION_WRITE_FAILED','CAPTURE_FAILED')) or
    (status='deferred' and reason in ('ATTEMPT_LIMIT','TIME_BUDGET'))
  )
);
alter table public.model_capture_events enable row level security;
revoke all on public.model_capture_events from public,anon,authenticated,service_role;
grant select,insert on public.model_capture_events to service_role;
create index model_capture_events_fixture on public.model_capture_events(fixture_id,recorded_at desc);
create index model_capture_events_run on public.model_capture_events(run_id,recorded_at);
create unique index model_capture_events_run_marker on public.model_capture_events(run_id,reason) where status='run';
comment on table public.model_capture_events is 'Server-only append-only collection audit. No raw provider errors, keys, personal data, or performance evidence. RUN_STARTED without RUN_COMPLETED means incomplete capture audit.';
