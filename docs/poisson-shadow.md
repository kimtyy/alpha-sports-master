# Prospective Poisson model v1

Version: `poisson-venue-v1`. Research only; match-card recommendations and Elo updates remain disabled.

## Frozen model

- API-Football final (FT) fixtures from the target's domestic league and season; last 365 days.
- Each source fixture must have kicked off at least 3 hours before the source response was observed. A fixture whose result was not yet available cannot be used. Current target, other seasons, cups, AET/PEN and invalid scores are excluded/rejected.
- At least 30 league fixtures, 5 home appearances for the home team, and 5 away appearances for the away team.
- Shrink each venue-specific goals-for/against mean toward its corresponding league home/away mean using 5 prior matches.
- Expected home goals = home team's shrunk home goals-for × away team's shrunk away goals-against / league home mean; reverse for away goals. Rates clipped to [0.15, 5].
- Independent Poisson goal distributions, 0–40 goals; reject retained mass below 1−1e−9, then normalize to home/draw/away.
- No odds input, no optimization against the 25 existing settled results. No injury, lineup, opponent-strength or dependence adjustment. This is an initial statistical benchmark, not a trained AI or validated edge.

## Prospective collection and fair comparison

Daily authenticated cron first runs existing settlement and market collection, then a bounded research capture (60 seconds, subject to the route's remaining time budget). Only fixtures in the next 48 hours with fresh valid odds and >5 minutes before kickoff are eligible; at most 30 previously unrecorded candidates are attempted per run, earliest first. League-season histories are fetched once per run. Skips/errors/deferred counts go to the authenticated cron response and runtime log. These limits mean the sample is not comprehensive or random.

A prediction links to a baseline fixture for shared result/exclusion handling, but records its own contemporaneous price snapshot. It must not use the older first-captured baseline odds for the paired comparison. History and odds can be observed at slightly different times, both no more than 15 minutes before database insertion. This is approximately contemporaneous, not a guaranteed identical market tick.

The ledger freezes probabilities, model version, inputs (compact full training fixtures), timestamps, bookmaker and prices. DB validates kickoff against the existing baseline, server-generated insertion time, freshness, pre-kickoff buffer, probability sum, history cutoff and minimum sample fields. Public clients can read, never insert/update/delete. Server role can insert/read only. Unique fixture/version key prevents duplicate recording; no backfill for completed games and no upsert.

## Evaluation

`/api/model-evaluation`: 90-day model records joined to the existing result ledger. Same settled fixtures for both sides. Multi-class Brier is the sum of squared errors (0–2, lower is better). Max-probability ties are omitted separately from each accuracy denominator and disclosed. Pending/excluded fixtures do not count as losses. Empty samples return null metrics. Model and market Brier difference is paired, but no significance claim is made. The UI warns below 200 settled matches; 200 is an informational milestone, not a sufficient evidence or launch threshold.

## Validation

`npm test`, `npm run build`, `npx tsc --noEmit`.
`supabase/tests/poisson_permissions.sql` is a transaction-scoped probe: run after schema; the script wraps its checks in BEGIN/ROLLBACK. It uses a future baseline fixture and synthetic evidence which must never be committed.

Live collection remains unverified until a scheduled authenticated cron run creates records. Check history provider access and skipped reasons on that run. Do not describe a deployed empty ledger as a successful real prediction capture. No historical test fixture is inserted into production performance data.
