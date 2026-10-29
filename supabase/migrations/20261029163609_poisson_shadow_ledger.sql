-- Prospective research predictions. Results remain in the existing settlement ledger.
create table public.model_predictions (
  fixture_id bigint not null references public.market_baseline_records(fixture_id),
  model_version text not null check (model_version='poisson-venue-v1'),
  kickoff_at timestamptz not null,
  observed_at timestamptz not null,
  odds_observed_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  bookmaker text not null check(length(bookmaker)>0),
  odds_home float8 not null check(odds_home>1 and odds_home<'Infinity'::float8),
  odds_draw float8 not null check(odds_draw>1 and odds_draw<'Infinity'::float8),
  odds_away float8 not null check(odds_away>1 and odds_away<'Infinity'::float8),
  p_home float8 not null check(p_home>=0 and p_home<=1),
  p_draw float8 not null check(p_draw>=0 and p_draw<=1),
  p_away float8 not null check(p_away>=0 and p_away<=1),
  lambda_home float8 not null check(lambda_home>=0.15 and lambda_home<=5),
  lambda_away float8 not null check(lambda_away>=0.15 and lambda_away<=5),
  evidence jsonb not null check(jsonb_typeof(evidence)='object'),
  primary key(fixture_id,model_version),
  check(abs(p_home+p_draw+p_away-1)<1e-8),
  check(observed_at<=recorded_at and odds_observed_at<=recorded_at and recorded_at<kickoff_at)
);
alter table public.model_predictions enable row level security;
revoke all on public.model_predictions from public,anon,authenticated,service_role;
grant select on public.model_predictions to anon,authenticated;
grant select,insert on public.model_predictions to service_role;
create policy model_predictions_public_read on public.model_predictions for select to anon,authenticated using(true);
create index model_predictions_recorded on public.model_predictions(recorded_at desc,fixture_id);
create function public.guard_model_prediction() returns trigger language plpgsql security invoker set search_path='' as $$
declare baseline public.market_baseline_records; h jsonb;
begin
  if TG_OP <> 'INSERT' then raise exception 'MODEL_PREDICTION_IMMUTABLE'; end if;
  NEW.recorded_at:=clock_timestamp();
  select * into baseline from public.market_baseline_records where fixture_id=NEW.fixture_id;
  if not found or baseline.kickoff_at<>NEW.kickoff_at or baseline.settled_at is not null or baseline.excluded_reason is not null then
    raise exception 'MODEL_BASELINE_MISMATCH';
  end if;
  if NEW.kickoff_at<=NEW.recorded_at+interval '5 minutes' or
    NEW.observed_at>NEW.recorded_at or NEW.observed_at<NEW.recorded_at-interval '15 minutes' or
    NEW.odds_observed_at>NEW.recorded_at or NEW.odds_observed_at<NEW.recorded_at-interval '15 minutes' then
    raise exception 'MODEL_REQUIRES_FRESH_PREMATCH_DATA';
  end if;
  if jsonb_typeof(NEW.evidence->'history') is distinct from 'array' or
     jsonb_array_length(NEW.evidence->'history')<30 or
     (NEW.evidence->>'homeMatches')::int<5 or (NEW.evidence->>'awayMatches')::int<5 or
     NEW.evidence->>'homeMatches' is null or NEW.evidence->>'awayMatches' is null or
     (NEW.evidence->>'observedAt')::timestamptz is distinct from NEW.observed_at then
    raise exception 'MODEL_HISTORY_REQUIRED';
  end if;
  for h in select value from jsonb_array_elements(NEW.evidence->'history') loop
    if h->>'kickoff' is null or h->>'id' is null or (h->>'id')::bigint=NEW.fixture_id or
       (h->>'kickoff')::timestamptz>NEW.observed_at-interval '3 hours' then
      raise exception 'MODEL_HISTORY_LEAKAGE';
    end if;
  end loop;
  return NEW;
end;
$$;
revoke all on function public.guard_model_prediction() from public,anon,authenticated;
create trigger guard_model_prediction before insert or update or delete on public.model_predictions
for each row execute function public.guard_model_prediction();
