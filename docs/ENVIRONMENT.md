# Environment Configuration Guide

Complete guide to configuring environment variables for JGA Enterprise OS.

## Overview

JGA Enterprise OS uses environment variables for configuration across development, testing, and production environments. Never commit `.env` files to version control.

## Quick Start

### 1. Copy Template

```bash
cp .env.example .env
```

### 2. Configure Variables

Edit `.env` with your specific values (see sections below).

### 3. Verify Configuration

```bash
npm run verify-env  # Validates all required variables are set
```

## .env.example Template

An example `.env.example` file should be committed to git:

```bash
# See complete template below in "Template Files"
```

## Environment Variables by Category

### Application Environment

```bash
# Node environment: development, staging, production, test
NODE_ENV=development

# Application port
PORT=3000

# Hostname for server
HOSTNAME=0.0.0.0

# Application domain
DOMAIN=localhost:3000

# Application URL (for redirects, CORS, etc.)
APP_URL=http://localhost:3000

# Log level: error, warn, info, debug, trace
LOG_LEVEL=info

# Enable debug mode
DEBUG=false
```

### Database Configuration

```bash
# PostgreSQL Connection (Primary)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=jga_enterprise
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password_here

# Full DATABASE_URL (alternative to individual params)
DATABASE_URL=postgresql://postgres:password@localhost:5432/jga_enterprise

# Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000

# SSL Connection (set to 'require' in production)
DB_SSL_MODE=disable  # disable, allow, prefer, require
```

### Redis Cache

```bash
# Redis Connection String
REDIS_URL=redis://localhost:6379

# With authentication
REDIS_URL=redis://:password@localhost:6379

# Redis DB number
REDIS_DB=0

# Redis password (if using separate REDIS_HOST)
REDIS_PASSWORD=your_redis_password

# Cache TTL (time to live in seconds)
CACHE_TTL=3600
CACHE_MAX_SIZE=100

# Enable Redis
REDIS_ENABLED=true
```

### Supabase Configuration

```bash
# Supabase Project URL
SUPABASE_URL=https://your-instance.supabase.co

# Supabase Anonymous Key (public)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1N...

# Supabase Service Role Key (server-side only, never expose)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1N...

# Supabase JWT Secret
SUPABASE_JWT_SECRET=your_jwt_secret_here

# Supabase Connection String (for migrations)
SUPABASE_DB_CONNECTION_STRING=postgresql://postgres:password@db.supabase.co:5432/postgres
```

### Authentication & Security

```bash
# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_generate_with_openssl_rand_-hex_32
JWT_EXPIRATION=24h
JWT_REFRESH_EXPIRATION=7d

# Session Configuration
SESSION_SECRET=your_session_secret_key_here
SESSION_DURATION=86400  # 24 hours in seconds

# CORS Settings
CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
CORS_CREDENTIALS=true

# CSRF Protection
CSRF_PROTECTION_ENABLED=true

# Security Headers
SECURITY_HEADERS_ENABLED=true
```

### Email Configuration

```bash
# Email Service (sendgrid, mailgun, smtp)
EMAIL_PROVIDER=sendgrid

# SendGrid API Key
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# Or SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@yourdomain.com

# Email Templates
EMAIL_VERIFICATION_ENABLED=true
PASSWORD_RESET_ENABLED=true
```

### File Storage

```bash
# Storage type: local, s3, gcs
STORAGE_TYPE=local

# Local storage path
STORAGE_LOCAL_PATH=./uploads

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=jga-enterprise-bucket
S3_ENDPOINT=https://s3.amazonaws.com

# Google Cloud Storage
GCS_PROJECT_ID=your-gcs-project
GCS_BUCKET=jga-enterprise-bucket
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcs-keyfile.json

# File size limits (bytes)
MAX_FILE_SIZE=10485760  # 10 MB
```

### Payment Processing

```bash
# Stripe API Keys
STRIPE_PUBLIC_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Or PayPal
PAYPAL_CLIENT_ID=xxxxx
PAYPAL_CLIENT_SECRET=xxxxx

# Currency
CURRENCY=USD
```

### Monitoring & Analytics

```bash
# Sentry Error Tracking
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0

# Datadog APM (optional)
DD_ENABLED=false
DD_API_KEY=xxxxx
DD_SITE=datadoghq.com

# Google Analytics
NEXT_PUBLIC_GA_ID=UA-xxxxxx-x

# Prometheus Metrics
PROMETHEUS_ENABLED=false
PROMETHEUS_PORT=9090
```

### Feature Flags

```bash
# Feature Toggles
FEATURE_A/B_TESTING=true
FEATURE_DARK_MODE=true
FEATURE_BETA_FEATURES=false
```

### External Services

```bash
# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx

# GitHub Integration
GITHUB_APP_ID=xxxxx
GITHUB_PRIVATE_KEY=xxxxx

# Webhook Scaling
WEBHOOK_SIGNING_SECRET=your_secret_here
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_RETRY_INTERVAL=60
```

### Development-Only Variables

```bash
# Mock Data
USE_MOCK_DATA=false
MOCK_DATA_SEED=12345

# Hot Reload
NEXT_PUBLIC_HOT_RELOAD=true

# Dev Tools
ENABLE_DEV_TOOLS=true
ENABLE_MOCK_API=false
```

## Template Files

### .env.example (Commit to Git)

```bash
# Copy this file to .env and fill in your values
# NEVER commit .env to git

# APPLICATION
NODE_ENV=development
PORT=3000
HOSTNAME=0.0.0.0
DOMAIN=localhost:3000
APP_URL=http://localhost:3000
LOG_LEVEL=info

# DATABASE
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=jga_enterprise
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change_me_in_production
DATABASE_URL=

# REDIS
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_ENABLED=true

# SUPABASE
SUPABASE_URL=https://your-instance.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# SECURITY
JWT_SECRET=generate_with_openssl_rand_-hex_32
SESSION_SECRET=generate_with_openssl_rand_-base64_32
CORS_ORIGIN=http://localhost:3000

# EMAIL
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=

# STORAGE
STORAGE_TYPE=local
MAX_FILE_SIZE=10485760

# MONITORING
SENTRY_DSN=
SENTRY_ENVIRONMENT=development

# ANALYTICS
NEXT_PUBLIC_GA_ID=

# FEATURE FLAGS
FEATURE_A/B_TESTING=true
FEATURE_DARK_MODE=true
```

### .env.development

```bash
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=true
REDIS_ENABLED=false  # Use memory cache locally
SENTRY_DSN=  # Disable in development
FEATURE_DEV_TOOLS=true
```

### .env.production

```bash
NODE_ENV=production
LOG_LEVEL=warn
DEBUG=false
REDIS_ENABLED=true
DB_SSL_MODE=require
SENTRY_ENVIRONMENT=production
FEATURE_DEV_TOOLS=false
```

### .env.test

```bash
NODE_ENV=test
LOG_LEVEL=error
DATABASE_URL=postgresql://postgres:password@localhost:5432/jga_enterprise_test
REDIS_ENABLED=false
SENTRY_DSN=
FEATURE_DEV_TOOLS=true
```

## Security Best Practices

### ✅ DO

- ✅ Use strong, unique values for secrets
- ✅ Rotate secrets regularly
- ✅ Use `.env.example` with placeholder values
- ✅ Store `.env` in `.gitignore`
- ✅ Use environment variable vaults (AWS Secrets Manager, HashiCorp Vault, etc.) in production
- ✅ Use HTTPS for all external connections
- ✅ Validate configuration on startup

### ❌ DON'T

- ❌ Commit `.env` files to version control
- ❌ Share `.env` files via email or Slack
- ❌ Hardcode secrets in code
- ❌ Log sensitive values
- ❌ Use weak or simple secrets
- ❌ Use default credentials in production

## Generating Secure Values

### Generate Random Secrets

```bash
# 32-character hex string (for JWT)
openssl rand -hex 32

# 32-character base64 string (for sessions)
openssl rand -base64 32

# UUID
uuidgen
```

### Node.js

```javascript
const crypto = require('crypto');
const secret = crypto.randomBytes(32).toString('hex');
console.log(secret);
```

## Validation

### Create validateEnv.ts

```typescript
// lib/validate-env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  JWT_SECRET: z.string().min(32),
});

export function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('Invalid environment configuration:', error);
    process.exit(1);
  }
}

export const env = validateEnv();
```

### Validate on Startup

```typescript
// app.ts or main entry
import { validateEnv } from './lib/validate-env';

const env = validateEnv();
console.log('✅ Environment validated');
```

## Docker Environment

### Pass Environment Variables to Docker

```bash
# Via .env file
docker-compose --env-file .env up

# Via command line
docker run -e DATABASE_URL=postgresql://... app:latest

# Via docker-compose.yml
services:
  app:
    environment:
      DATABASE_URL: ${DATABASE_URL}
      NODE_ENV: ${NODE_ENV}
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/ci.yml
env:
  NODE_ENV: test
  DATABASE_URL: postgresql://postgres:password@localhost:5432/test

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: password
```

## Troubleshooting

### Variable Not Loading

```bash
# Verify .env file exists
ls -la .env

# Check file permissions
chmod 600 .env

# Verify format (no spaces around =)
cat .env | head -5

# Debug environment
npm run show-env  # Custom script to safely display config
```

### Sensitive Values Exposed

```bash
# Search git history
git log -S "SECRET_VALUE" --oneline

# View what's in .gitignore
cat .gitignore | grep env

# Rotate compromised secrets immediately
```

## References

- [Node.js Environment Variables](https://nodejs.org/en/knowledge/file-system/how-to-use-the-os-module-in-nodejs/)
- [12 Factor App - Configuration](https://12factor.net/config)
- [Docker Environment Reference](https://docs.docker.com/compose/environment-variables/)
- [Zod Validation](https://zod.dev/)

---

**Last Updated:** March 2026
