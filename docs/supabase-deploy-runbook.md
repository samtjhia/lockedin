# Supabase Deploy Runbook

This runbook keeps staging/prod rollout deterministic for this repo.

## 1) Fresh project bootstrap (one-time)

For a brand-new Supabase project, run:

1. Open SQL editor for that project.
2. Run `supabase/bootstrap.sql` once.
3. From repo root: `npx supabase link --project-ref <project-ref>`
4. Push migrations: `npx supabase db push`

Why: migrations start at `002_...` and expect baseline `profiles` + `sessions` to already exist.

## 2) Normal staging rollout

1. `npx supabase link --project-ref <staging-ref>`
2. `npx supabase migration list` (confirm local/remote alignment)
3. `npx supabase db push`
4. Run SQL smoke tests from `supabase/smoke/health_domain_smoke.sql`
5. Run UI smoke:
   - Leaderboard: All/Study/Health
   - Dashboard: charts/heatmap/log for each mode
   - Profile: stats/heatmap/tasks for each mode

## 3) Production rollout

Only after staging passes:

1. Take Supabase backup/snapshot.
2. `npx supabase link --project-ref <prod-ref>`
3. `npx supabase migration list` (ensure no unexpected drift)
4. `npx supabase db push`
5. Re-run smoke checks quickly on prod.

## 4) Strava setup (staging first)

### Required environment variables

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_WEBHOOK_VERIFY_TOKEN`
- `APP_BASE_URL` (example: `https://your-app.vercel.app` or local tunnel URL)

### Routes added for Strava

- `GET /api/integrations/strava/connect`
- `GET /api/integrations/strava/callback`
- `POST /api/integrations/strava/sync`
- `POST /api/integrations/strava/disconnect`
- `POST /api/integrations/strava/activity-types`
- `GET/POST /api/integrations/strava/webhook`
- `POST /api/cron/strava-sync`

### Webhook registration

1. Deploy staging app with env vars above.
2. Register webhook callback URL in Strava app settings:
   - `<APP_BASE_URL>/api/integrations/strava/webhook`
3. Use `STRAVA_WEBHOOK_VERIFY_TOKEN` value when configuring callback verification.
4. Confirm verification succeeds (GET challenge).

### Cron fallback

- Invoke `POST /api/cron/strava-sync` on a schedule (recommended every 10-30 minutes).

## 5) Validation matrix

Use SQL smoke scripts:
- `supabase/smoke/health_domain_smoke.sql`
- `supabase/smoke/strava_integration_smoke.sql`

Manual staging verification:
1. Connect Strava in `/profile/edit`.
2. Confirm callback returns to profile edit with connected state.
3. Click `Sync now` and verify imported sessions appear with health domain views.
4. Trigger webhook (or wait for new activity) and verify near-real-time sync.
5. Call cron sync route and verify stale accounts are backfilled.
6. Confirm repeated sync does not create duplicates.

## 6) Common failures and fixes

- `relation "public.sessions" does not exist` at `002_...`
  - Cause: baseline schema not bootstrapped.
  - Fix: run `supabase/bootstrap.sql` once, then `db push`.

- `duplicate key value ... schema_migrations_pkey` for a version
  - Cause: duplicate migration version prefix.
  - Fix: ensure each migration filename prefix is unique.

- `DROP FUNCTION ... does not exist, skipping` notices
  - Expected when guarded by `DROP FUNCTION IF EXISTS`.

- Strava callback returns config error
  - Cause: missing `STRAVA_CLIENT_ID` or `STRAVA_CLIENT_SECRET`.
  - Fix: set env vars and redeploy.

- Webhook verification fails
  - Cause: verify token mismatch or wrong callback URL.
  - Fix: ensure `STRAVA_WEBHOOK_VERIFY_TOKEN` matches Strava app config and callback points to `/api/integrations/strava/webhook`.
