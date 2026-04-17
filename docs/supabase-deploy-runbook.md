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

## 4) Common failures and fixes

- `relation "public.sessions" does not exist` at `002_...`
  - Cause: baseline schema not bootstrapped.
  - Fix: run `supabase/bootstrap.sql` once, then `db push`.

- `duplicate key value ... schema_migrations_pkey` for a version
  - Cause: duplicate migration version prefix.
  - Fix: ensure each migration filename prefix is unique.

- `DROP FUNCTION ... does not exist, skipping` notices
  - Expected when guarded by `DROP FUNCTION IF EXISTS`.
