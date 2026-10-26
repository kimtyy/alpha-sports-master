-- Public sports data only. No user records or betting transactions.
create table public.market_baseline_records (
  fixture_id bigint primary key check (fixture_id > 0),
  model_version text not null default 'market-implied-v1' check (model_version = 'market-implied-v1'),
  home_team text not null,
  away_team text not null,
  league text not null,
  kickoff_at timestamptz not null,
  observed_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  bookmaker text not null,
  odds_home double precision not null check (odds_home > 1 and odds_home < 'Infinity'::float8),
  odds_draw double precision not null check (odds_draw > 1 and odds_draw < 'Infinity'::float8),
  odds_away double precision not null check (odds_away > 1 and odds_away < 'Infinity'::float8),
  last_checked_at timestamptz,
  settled_at timestamptz,
  result_home integer check (result_home >= 0),
  result_away integer check (result_away >= 0),
  excluded_reason text check (excluded_reason in ('CANC','ABD','AWD','WO','AET','PEN','KICKOFF_CHANGED')),
  check (observed_at <= recorded_at and recorded_at < kickoff_at),
  check ((result_home is null and result_away is null and settled_at is null) or
         (result_home is not null and result_away is not null and settled_at is not null and excluded_reason is null))
);
alter table public.market_baseline_records enable row level security;
revoke all on public.market_baseline_records from anon, authenticated, service_role;
grant select on public.market_baseline_records to anon, authenticated;
grant select, insert on public.market_baseline_records to service_role;
grant update (last_checked_at, settled_at, result_home, result_away, excluded_reason) on public.market_baseline_records to service_role;
create policy market_baseline_public_read on public.market_baseline_records for select to anon, authenticated using (true);
create index market_baseline_pending on public.market_baseline_records (last_checked_at nulls first, fixture_id) where settled_at is null and excluded_reason is null;

create function public.guard_market_baseline() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    NEW.recorded_at := clock_timestamp();
    if NEW.kickoff_at <= NEW.recorded_at or NEW.observed_at > NEW.recorded_at or
       NEW.observed_at < NEW.recorded_at - interval '15 minutes' or
       NEW.settled_at is not null or NEW.result_home is not null or NEW.result_away is not null or NEW.excluded_reason is not null then
      raise exception 'BASELINE_REQUIRES_FRESH_PREMATCH_DATA';
    end if;
  else
    if (to_jsonb(NEW) - array['last_checked_at','settled_at','result_home','result_away','excluded_reason']) is distinct from
       (to_jsonb(OLD) - array['last_checked_at','settled_at','result_home','result_away','excluded_reason']) then
      raise exception 'BASELINE_SNAPSHOT_IMMUTABLE';
    end if;
    if OLD.settled_at is not null or OLD.excluded_reason is not null then
      raise exception 'BASELINE_ALREADY_FINAL';
    end if;
    if NEW.settled_at is not null then
      if clock_timestamp() <= NEW.kickoff_at then raise exception 'BASELINE_NOT_STARTED'; end if;
      NEW.settled_at := clock_timestamp();
    end if;
    NEW.last_checked_at := clock_timestamp();
  end if;
  return NEW;
end;
$$;
revoke all on function public.guard_market_baseline() from public, anon, authenticated;
create trigger guard_market_baseline before insert or update on public.market_baseline_records for each row execute function public.guard_market_baseline();
