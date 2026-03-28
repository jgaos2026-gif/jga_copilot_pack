# DEPLOYMENT RUNBOOK

## Honest boundary

This runbook gets the app deployable.
Real production launch still requires:
- Supabase project
- Stripe account
- domain DNS
- real secrets
- legal template review
- human QA

## Environment variables

Create:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`

Optional:
- `SENTRY_DSN`
- `RESEND_API_KEY`
- `TWILIO_*`
- `ZOHO_*`

## Supabase steps

1. Create new Supabase project
2. Run `supabase/schema.sql`
3. Run `supabase/seed.sql`
4. Configure auth providers
5. Create storage buckets
6. Review RLS policies
7. Set service role in deployment platform

## Deployment platform

Recommended:
- Vercel for app hosting
- Supabase for backend

Alternative:
- Netlify

## Production checklist

- HTTPS enabled
- custom domain connected
- auth email templates configured
- Stripe webhook endpoint registered
- storage buckets secured
- RLS tested with contractor and client accounts
- seeded demo data removed or isolated in non-production
- smoke test all gated flows
- verify logs for webhook events
- verify pricing endpoint is live
- verify delivery is blocked before final payment
- verify contractor cannot access admin data

## Three-pass test standard

Run these three times in staging before production:
1. Intake -> contract -> deposit -> production
2. QC -> final invoice -> final payment -> delivery
3. Contractor lead -> deposit cleared -> escrow -> release

## Post-launch checks

- open homepage
- submit intake
- generate quote
- owner login
- contractor login
- view projects dashboard
- trigger payment webhook test
- confirm ledger entry exists
