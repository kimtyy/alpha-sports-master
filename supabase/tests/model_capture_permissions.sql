begin;
set local role service_role;
do $$
declare r uuid:=gen_random_uuid(); n integer;
begin
  insert into public.model_capture_events(run_id,model_version,status,reason)
  values(r,'poisson-venue-v1','run','RUN_STARTED');
  select count(*) into n from public.model_capture_events where run_id=r;
  if n<>1 then raise exception 'AUDIT_READ_FAILED';end if;
  begin
    update public.model_capture_events set reason='RUN_COMPLETED' where run_id=r;
    raise exception 'UPDATE_NOT_BLOCKED';
  exception when insufficient_privilege then null;end;
  begin
    delete from public.model_capture_events where run_id=r;
    raise exception 'DELETE_NOT_BLOCKED';
  exception when insufficient_privilege then null;end;
  begin
    insert into public.model_capture_events(run_id,model_version,status,reason)
    values(r,'poisson-venue-v1','failed','raw secret error');
    raise exception 'UNKNOWN_REASON_ACCEPTED';
  exception when check_violation then null;end;
end;
$$;
set local role anon;
do $$ begin
  begin perform * from public.model_capture_events;raise exception 'ANON_READ_ALLOWED';
  exception when insufficient_privilege then null;end;
  begin
    insert into public.model_capture_events(run_id,model_version,status,reason)
    values(gen_random_uuid(),'poisson-venue-v1','run','RUN_STARTED');
    raise exception 'ANON_WRITE_ALLOWED';
  exception when insufficient_privilege then null;end;
end;$$;
set local role authenticated;
do $$ begin
  begin perform * from public.model_capture_events;raise exception 'AUTH_READ_ALLOWED';
  exception when insufficient_privilege then null;end;
  begin
    insert into public.model_capture_events(run_id,model_version,status,reason)
    values(gen_random_uuid(),'poisson-venue-v1','run','RUN_STARTED');
    raise exception 'AUTH_WRITE_ALLOWED';
  exception when insufficient_privilege then null;end;
end;$$;
reset role;
select 'PASS: audit server insert/select only, browser read/write and arbitrary reasons blocked' as test_result;
rollback;
