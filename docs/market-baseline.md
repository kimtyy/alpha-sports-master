# Market baseline v1

This is a comparison baseline, not AI inference or a betting recommendation. For each valid pre-match fixture, normalize the three inverse decimal prices to sum to one. Record the first available snapshot, bookmaker, provider observation time, scheduled kickoff and database recording time. Lead time varies by fixture; these are not closing odds. Provider observation time is collection time, not a guarantee that the bookmaker updated its price then.

A separate public sports-data ledger prevents user bookmarks/manual outcomes from entering evaluation. Server inserts only; snapshots are immutable, duplicate fixture IDs cannot replace them, and the database rejects retrospective/stale inserts. No client writes are granted. The initial 108 eligible fixtures were collected from the production API on 2026-10-26 before their scheduled starts; no historical predictions were fabricated.

The existing daily cron first settles user bookmarks, then checks up to 60 baseline records with a 100-second lookup budget, rotating checked/failed records. It captures new pre-match snapshots afterwards. FT scores only are scored; changed kickoff, AET/PEN, cancellations, abandoned/awarded games are explicitly excluded. Pending records are never scored as losses. The current schedule is daily 00:00 UTC (09:00 KST hour on Hobby); results are not real-time.

/api/evaluation returns a 90-day rolling recording cohort with complete pagination (fails explicitly above 10,000 rows), full-cohort totals and the latest 20 snapshots. Top-probability accuracy excludes ties; multiclass Brier uses sum of squared errors over all three outcomes (range 0–2). No ROI or validated-performance claim. Future candidate models need their own versioned snapshots on the same fixtures to compare fairly.

Validation: 24 tests plus production build/type checks. Live DB rollback tests verified service inserts, read-only public access, immutable odds, retrospective insert rejection and premature settlement rejection; test rows were removed by rollback. Live FT provider-to-database settlement is still awaiting an actual recorded fixture result. The existing legacy Elo write path remains disabled.
