# Leaderboard day-splitting (session time by calendar day)

Sessions that span midnight (Toronto) are **prorated** by calendar day: only the portion of the session that falls on each day counts for that day’s leaderboard and medals.

## Invariants (must hold or medal/history break)

1. **One row per profile**  
   `get_leaderboard_for_date` and `get_leaderboard_for_week` must return **exactly one row per verified, non-hidden profile**.  
   - Use `FROM public.profiles p LEFT JOIN session_stats s ON s.user_id = p.id` (never inner join or filter that drops profiles).
   - Medals iterate over days/weeks and expect every profile in the result set.

2. **total_seconds never null, always ≥ 0**  
   - Use `COALESCE(s.seconds, 0)::bigint AS total_seconds` in the final SELECT.
   - In `session_stats`, use `COALESCE(c.sec, 0) + COALESCE(l.sec, 0)` so missing side of the FULL OUTER JOIN is 0.
   - Medal logic uses `WHERE lb.total_seconds > 0`; if everyone is null or negative, no rows pass and the UI shows “no data”.

3. **Completed proration: no nulls, no division by zero**  
   - Include only sessions that can be prorated: `ended_at IS NOT NULL`, `started_at IS NOT NULL`, `ended_at > started_at`.
   - Overlap: `LEAST(ended_at, end_time) - GREATEST(started_at, start_time)`. Wall: `ended_at - started_at`.
   - Term: `duration_seconds * overlap_sec / NULLIF(wall_sec, 0)`. Wrap each term in `COALESCE(..., 0)` so one bad row doesn’t null the sum.
   - Use `COALESCE(SUM(...), 0)` so a user with no matching sessions still gets 0, not null.

4. **Live (active/paused) proration: safe denominator**  
   - Only use proration when `wall_sec IS NOT NULL AND wall_sec > 0` (otherwise contribute 0).
   - Use `COALESCE(overlap_sec, 0)` so null overlap doesn’t break the expression.
   - Cap at period length: `LEAST(prorated_sec, EXTRACT(EPOCH FROM (end_time - start_time)))`.

5. **Same return shape as before**  
   - Keep the same `RETURNS TABLE (...)` and column names so `get_leaderboard_medal_counts`, `get_leaderboard_timeline`, and `get_user_medal_history` keep working (they use `get_leaderboard_for_date` / `get_leaderboard_for_week` in LATERAL joins and expect `user_id`, `username`, `total_seconds`, etc.).

## Proration formula

- **Completed**: for each session overlapping the period,  
  `assigned_seconds = duration_seconds * (overlap_seconds / wall_seconds)`  
  where overlap is the intersection of `[started_at, ended_at]` with `[start_time, end_time]` (Toronto).
- **Active/paused**: same idea with “session so far” as `[started_at, now]`, then prorate `(accumulated_seconds + current_run)` by overlap/wall, capped by period length.

## How to verify after a change

1. **Manual SQL (Supabase SQL editor or psql)**  
   - Yesterday:  
     `SELECT * FROM get_leaderboard_for_date((now() AT TIME ZONE 'America/Toronto')::date - 1) LIMIT 10;`  
   - You should see one row per profile, `total_seconds` non-null and ≥ 0; some rows should have `total_seconds > 0` if there was activity.

2. **Medal page**  
   - Open Leaderboard → History. It should show “past 6 weeks” data (or “no medals” only when there really are none), not “NO MEDAL DATA FOR THE PAST 6 WEEKS”.

3. **Edge case**  
   - Create a session that starts before midnight and ends after (or pause/resume across midnight), then run the date function for both days and confirm time is split (e.g. ~30 min on first day, rest on second).

## Migrations involved

- **053**: Heatmap uses `duration_seconds` (and heatmap-only day-splitting in 055).
- **055**: Heatmap proration by day; **057** reverted leaderboard date/week to start-date-only to fix medals.
- **058**: Leaderboard date/week use proration again with the safeguards above.
