alter table public.model_capture_events
  add column failure_code text,
  add column failure_date date,
  add column failure_page integer,
  add column failure_http_status integer,
  add constraint model_capture_failure_diagnostics check (
    (failure_code is null and failure_date is null and failure_page is null and failure_http_status is null)
    or
    (reason='ODDS_FETCH_FAILED' and failure_code is not null and
      failure_code in ('HTTP_ERROR','RATE_LIMIT','PROVIDER_ERROR','INVALID_RESPONSE','TIMEOUT','NETWORK_ERROR','PAGE_LIMIT','INVALID_PAGINATION') and
      failure_date is not null and failure_page is not null and failure_page between 1 and 50 and
      (failure_http_status is null or failure_http_status between 400 and 599))
  );
comment on column public.model_capture_events.failure_code is 'Allowlisted diagnosis only. Older events have NULL; never infer old causes from a later retry.';
