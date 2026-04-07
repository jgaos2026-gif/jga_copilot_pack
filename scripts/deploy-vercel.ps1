# JGA Enterprise OS — One-shot Vercel deployment
# Run this once you have your Supabase keys and Vercel account ready.
#
# USAGE:
#   .\scripts\deploy-vercel.ps1 `
#     -SupabaseUrl "https://xxxx.supabase.co" `
#     -SupabaseAnonKey "eyJ..." `
#     -SupabaseServiceRoleKey "eyJ..." `
#     -AppUrl "https://your-app.vercel.app"

param(
    [Parameter(Mandatory=$true)]  [string] $SupabaseUrl,
    [Parameter(Mandatory=$true)]  [string] $SupabaseAnonKey,
    [Parameter(Mandatory=$true)]  [string] $SupabaseServiceRoleKey,
    [Parameter(Mandatory=$false)] [string] $AppUrl = "",
    [Parameter(Mandatory=$false)] [string] $StripeSecretKey = "",
    [Parameter(Mandatory=$false)] [string] $StripeWebhookSecret = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host "=== JGA Enterprise OS — Vercel Deploy ===" -ForegroundColor Cyan

# 1. Pre-flight: confirm tests pass
Write-Host "`n[1/5] Running demo tests..." -ForegroundColor Yellow
npm run test:demo
if ($LASTEXITCODE -ne 0) { Write-Error "Tests failed — aborting deploy."; exit 1 }
Write-Host "  Tests passed." -ForegroundColor Green

# 2. Type-check
Write-Host "`n[2/5] Type-checking..." -ForegroundColor Yellow
npm run type-check
if ($LASTEXITCODE -ne 0) { Write-Error "Type errors — aborting deploy."; exit 1 }
Write-Host "  Type-check passed." -ForegroundColor Green

# 3. Set Vercel env vars (idempotent — overwrites if they already exist)
Write-Host "`n[3/5] Setting Vercel environment variables..." -ForegroundColor Yellow

function Set-VercelEnv([string]$name, [string]$value, [string]$scope = "production") {
    # Remove existing, then add fresh (vercel env rm is idempotent-ish)
    $value | npx vercel env add $name $scope --force 2>&1 | Out-Null
    Write-Host "  Set $name" -ForegroundColor Gray
}

$SupabaseUrl           | npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
$SupabaseAnonKey       | npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
$SupabaseServiceRoleKey| npx vercel env add SUPABASE_SERVICE_ROLE_KEY production

if ($AppUrl)              { $AppUrl              | npx vercel env add NEXT_PUBLIC_APP_URL production }
if ($StripeSecretKey)     { $StripeSecretKey     | npx vercel env add STRIPE_SECRET_KEY production }
if ($StripeWebhookSecret) { $StripeWebhookSecret | npx vercel env add STRIPE_WEBHOOK_SECRET production }

Write-Host "  All env vars set." -ForegroundColor Green

# 4. Deploy to production
Write-Host "`n[4/5] Deploying to Vercel production..." -ForegroundColor Yellow
npx vercel --prod --yes
if ($LASTEXITCODE -ne 0) { Write-Error "Vercel deploy failed."; exit 1 }

# 5. Done
Write-Host "`n[5/5] Deploy complete!" -ForegroundColor Green
Write-Host @"

Next steps:
  1. Visit your Vercel dashboard to get the production URL
  2. Set NEXT_PUBLIC_APP_URL to that URL if you haven't already
  3. Add Stripe webhook endpoint in Stripe dashboard → Webhooks:
       URL: https://<your-vercel-url>/api/webhooks/stripe
  4. Run: supabase db push  (to apply schema to your Supabase project)
     Or manually run supabase/schema.sql then supabase/seed.sql in SQL editor

"@ -ForegroundColor Cyan
