# BUILD ORDER

## Phase 1 - Foundation
- initialize Next.js app
- add TypeScript, Tailwind, linting, formatting
- connect Supabase
- add env handling
- create auth model
- implement role utilities
- create base layout and navigation

## Phase 2 - Database
- apply `supabase/schema.sql`
- apply `supabase/seed.sql`
- add row-level security
- add helper DB types

## Phase 3 - Public site
- homepage
- services page
- legal/disclaimer page
- intake form
- pricing request page

## Phase 4 - Business Engine
- clients list
- projects list and detail
- intake processing
- service catalog
- status management rules

## Phase 5 - Intelligence Engine
- pricing endpoint
- system load snapshots
- admin settings for multipliers
- quote cards in public and admin views

## Phase 6 - Revenue Engine
- transaction views
- allocations
- deposit/final payment tracking
- Stripe webhook scaffold
- delivery gate enforcement

## Phase 7 - Compliance
- contracts table UI
- policy notices
- ledger feed
- state-tag filters
- immutable event writes

## Phase 8 - Contractor portal
- onboarding UI
- docs/rules page
- leads list
- call logs
- earnings dashboard
- escrow visibility

## Phase 9 - Stability layer
- private admin forms
- simple tracking pages
- export-friendly tables

## Phase 10 - Tests
- unit tests for guards and pricing
- integration tests for core flows
- Playwright critical path tests

## Phase 11 - Deployment
- production env setup
- Supabase project config
- Vercel or Netlify deploy
- smoke tests
- post-deploy checklist
