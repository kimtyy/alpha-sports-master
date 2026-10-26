# Latest-production reliability patch — 2026-10-26 KST

Base: review/latest-production, 1334e34a359d3c0980b7af5f86cf29fe2f6c72eb.
This replaces the proposed direction of PR #1; do not merge the old-master patch into production.

## Behavior

- Retains the production 24-league, eight-Korean-calendar-day fixture scope, raw provider IDs, existing account/profile/bookmark interfaces and scheduled result route.
- Starts with an empty fixture list, distinguishes loading/error/empty states, and never substitutes mock fixtures for missing credentials.
- Fails fixture collection on HTTP errors or provider errors inside HTTP 200. Odds page failure marks odds unavailable; all odds pages are read, with finite decimal prices >1 required.
- Temporarily disables infer/chat, legacy cached predictions and simulation paths. No default probability, confidence, score, fabricated xG narrative, BET recommendation or allocation is shown. This is containment, not a newly validated predictive model.
- Cron requires CRON_SECRET and a server-only SUPABASE_SERVICE_ROLE_KEY. Missing configuration returns 503; wrong authorization returns 401. Public anon credentials are never used for cross-user settlement.
- Pending bookmarks are paginated, restricted to kickoff at least three hours ago, grouped by fixture, and settled only from numeric FT scores with matching fixture ID and recognized picks. AET/PEN/cancelled/postponed fixtures remain pending until explicit market rules are implemented.
- Conditional updates require the original pick and a still-unsettled row. Save errors are reported as failures; retries do not resettle already completed records. Concurrent manual edits are not overwritten by cron.
- Elo writes are PAUSED, not rebuilt. Existing ratings may already be contaminated by repeated bookmark-based updates. A fixture ledger and chronological replay from authoritative results must precede resuming Elo.
- User-edited/bookmarked hit rates are labeled user records, not validated model performance.
- Dependencies carry the patches from PR #1; Prisma packages were unused and removed, schema retained as reference.

## Validation

Node regression tests cover provider failure, Korean date rollover, eight-day retrieval, odds pagination and invalid odds, simulation rejection, repeated settlement, duplicate bookmarks, failed writes, unsupported results and pending-row pagination. Next production build/typecheck also run. No production provider key or DB writes used for tests.

## Deployment prerequisites and remaining work

1. Rotate/revoke historically committed credentials; deleting files from HEAD does not remove Git history. Do not share replacement values in chat or commit them.
2. Configure CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY in the target environment. Never use a NEXT_PUBLIC prefix for the service key. Verify bookmarks RLS policies and user/device ownership before production rollout; this repo does not include the actual policies.
3. Verify settlement in an isolated database first, including a failed write and a retry. Large backlogs (10,000+) fail explicitly; provider request throughput/function duration must be measured before scaling.
4. Define 90-minute market rules for AET/PEN/abandoned/refunded fixtures. Add source/version/time metadata and separate immutable model predictions from mutable user records.
5. Introduce a unique fixture settlement ledger and transactionally update Elo once per fixture, with chronological replay and handling of corrected scores. Existing name-keyed ratings need stable provider team IDs.
6. Implement numerical probability models and chronological holdout evaluation (Brier/log loss/calibration), compare against margin-adjusted bookmaker baselines, then restore recommendations only after validation. LLM roles are not trained Poisson/ML models.
7. Review and test this branch before promotion. No merge, deployment, credential rotation or DB migration was performed by this patch.

## Live schema inspection, 2026-10-26 KST

Supabase project zowkcuccvdlwqcckwkpm was accessed through the connected plugin. Exact counts: bookmarks=0, profiles=0, match_analyses=0, elo_ratings=0. All four tables have RLS enabled and NO policies, with broad default anon/authenticated grants. This blocks normal row access; it is not evidence that user isolation works. No production schema or records were changed by this inspection.

- bookmarks has no updated_at column. Removed that field from settlement writes and added a regression assertion.
- elo_ratings uses elo_score, team_id, league_id; legacy code uses rating and team_name-only upserts. Elo remains disabled pending a schema-aligned implementation.
- match_analyses uses analyzed_at, not created_at. Legacy analysis remains disabled.
- Login-only ownership policies are needed for profiles (id=auth.uid()) and bookmarks (device_id=auth.uid()::text), together with least-privilege grants. Guest device IDs must not be treated as authorization. UI guest saving/migration and false optimistic success need coordinated revision before these policies are enabled.
- Provider service key setup and actual DB write tests remain outstanding.

## Ownership repair and release

Applied authenticated_record_ownership to the connected production DB: owner-scoped policies for profiles/bookmarks, minimal browser grants, no browser access to global analyses/ratings, unique bookmark per owner/fixture. UI now requires sign-in for saving, removes untrusted device-ID migration, waits for successful DB writes, reports errors, and uses Korean date for bet_date. Build and 14 regression tests pass. Live rollback-only SQL verification: owner bookmark insert/read/update succeeds, foreign-owner read/insert and anonymous read are denied; grade escalation denied. Synthetic data rolled back. No real login account was created or modified. Service-role key remains an external configuration prerequisite for cron; prediction and Elo remain paused.
