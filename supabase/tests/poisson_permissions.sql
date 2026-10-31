-- Synthetic evidence is restricted to this rolled-back transaction.
begin;
set local role service_role;
do $$
declare f public.market_baseline_records; e jsonb; t timestamptz:=clock_timestamp(); n integer;
begin
  select * into f from public.market_baseline_records b where not exists(select 1 from public.model_predictions m where m.fixture_id=b.fixture_id) and kickoff_at>clock_timestamp()+interval '1 day' and settled_at is null and excluded_reason is null order by kickoff_at limit 1;
  if not found then raise exception 'NO_TEST_TARGET'; end if;
  select jsonb_build_object('observedAt',t,'homeMatches',6,'awayMatches',6,'history',jsonb_agg(jsonb_build_object('id',-i,'kickoff',t-interval '10 days','home',1,'away',2,'hg',2,'ag',1))) into e from generate_series(1,30) i;
  insert into public.model_predictions(fixture_id,model_version,kickoff_at,observed_at,odds_observed_at,bookmaker,odds_home,odds_draw,odds_away,p_home,p_draw,p_away,lambda_home,lambda_away,evidence)
  values(f.fixture_id,'poisson-venue-v1',f.kickoff_at,t,t,'TEST_ROLLBACK',2,4,4,.5,.25,.25,2,1,e);
  select count(*) into n from public.model_predictions where fixture_id=f.fixture_id;
  if n<>1 then raise exception 'INSERT_READ_FAILED'; end if;
  begin
    update public.model_predictions set p_home=.6 where fixture_id=f.fixture_id;
    raise exception 'UPDATE_NOT_BLOCKED';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.model_predictions where fixture_id=f.fixture_id;
    raise exception 'DELETE_NOT_BLOCKED';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.model_predictions select * from public.model_predictions where fixture_id=f.fixture_id;
    raise exception 'DUPLICATE_NOT_BLOCKED';
  exception when unique_violation then null; end;
  begin
    insert into public.model_predictions(fixture_id,model_version,kickoff_at,observed_at,odds_observed_at,bookmaker,odds_home,odds_draw,odds_away,p_home,p_draw,p_away,lambda_home,lambda_away,evidence)
    values(f.fixture_id,'poisson-venue-v1',f.kickoff_at,t-interval '16 minutes',t,'TEST_ROLLBACK',2,4,4,.5,.25,.25,2,1,e);
    raise exception 'STALE_DATA_ACCEPTED';
  exception when raise_exception then if SQLERRM<>'MODEL_REQUIRES_FRESH_PREMATCH_DATA' then raise;end if;end;
  begin
    insert into public.model_predictions(fixture_id,model_version,kickoff_at,observed_at,odds_observed_at,bookmaker,odds_home,odds_draw,odds_away,p_home,p_draw,p_away,lambda_home,lambda_away,evidence)
    values(f.fixture_id,'poisson-venue-v1',f.kickoff_at,t,t,'TEST_ROLLBACK',2,4,4,.5,.25,.25,2,1,jsonb_set(e,'{history,0,kickoff}',to_jsonb(t)));
    raise exception 'FUTURE_HISTORY_ACCEPTED';
  exception when raise_exception then if SQLERRM<>'MODEL_HISTORY_LEAKAGE' then raise;end if;end;
  begin
    insert into public.model_predictions(fixture_id,model_version,kickoff_at,observed_at,odds_observed_at,bookmaker,odds_home,odds_draw,odds_away,p_home,p_draw,p_away,lambda_home,lambda_away,evidence)
    values(f.fixture_id,'poisson-venue-v1',t-interval '1 minute',t,t,'TEST_ROLLBACK',2,4,4,.5,.25,.25,2,1,e);
    raise exception 'PAST_KICKOFF_ACCEPTED';
  exception when raise_exception then if SQLERRM<>'MODEL_BASELINE_MISMATCH' then raise;end if;end;
end;
$$;
set local role anon;
do $$
declare n integer;
begin
  select count(*) into n from public.model_predictions;
  if n<1 then raise exception 'PUBLIC_READ_FAILED';end if;
  begin
    insert into public.model_predictions select * from public.model_predictions limit 1;
    raise exception 'PUBLIC_WRITE_NOT_BLOCKED';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select 'PASS: server insert/read; duplicate, update, delete and anonymous insert blocked; public read allowed' as test_result;

rollback;
