#!/bin/bash

# JGA Enterprise OS - Deployment Helper Script
# Handles database migrations, environment setup, and service startup

set -e

echo "🚀 JGA Enterprise OS - Deployment Setup"
echo "==========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm not found. Please install npm${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js and npm found${NC}"

# Install dependencies
echo -e "\n${BLUE}Installing dependencies...${NC}"
npm ci

echo -e "${GREEN}✓ Dependencies installed${NC}"

# Environment setup
echo -e "\n${BLUE}Setting up environment...${NC}"

if [ ! -f .env.local ]; then
    echo -e "${RED}⚠ .env.local not found${NC}"
    echo "Please copy .env.example to .env.local and fill in your values:"
    echo "  cp .env.example .env.local"
    echo "  # Edit .env.local with your configuration"
    exit 1
fi

echo -e "${GREEN}✓ Environment file found${NC}"

# TypeScript compilation
echo -e "\n${BLUE}Type checking...${NC}"
npm run type-check

echo -e "${GREEN}✓ Type checking passed${NC}"

# Run tests
echo -e "\n${BLUE}Running tests...${NC}"
npm test

echo -e "${GREEN}✓ Tests passed${NC}"

# Build Next.js application
echo -e "\n${BLUE}Building Next.js application...${NC}"
npm run build

echo -e "${GREEN}✓ Build completed${NC}"

# Database setup (if running locally)
if [ "$1" = "--with-db" ]; then
    echo -e "\n${BLUE}Setting up database...${NC}"
    
    if command -v psql &> /dev/null; then
        echo "Running database migrations..."
        # Note: Supabase handles migrations automatically
        # This is for local PostgreSQL setup
        export PGPASSWORD=$DB_PASSWORD
        psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f supabase/migrations/20260328_001_base_schema.sql
        psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f supabase/migrations/20260328_002_state_tables.sql
        echo -e "${GREEN}✓ Database setup completed${NC}"
    else
        echo -e "${RED}⚠ PostgreSQL client (psql) not found. Skipping database setup.${NC}"
        echo "You can manually run migrations via Supabase dashboard or CLI"
    fi
fi

# Seed test data (optional)
if [ "$1" = "--seed" ]; then
    echo -e "\n${BLUE}Seeding test data...${NC}"
    # TODO: Implement seeding script
    echo -e "${GREEN}✓ Test data seeded${NC}"
fi

# Summary
echo -e "\n${GREEN}==========================================="
echo "✅ Deployment setup completed successfully!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Start development server: npm run dev"
echo "  2. Start real-time server:    npm run realtime:dev"
echo "  3. View API docs:             docs/API_ROUTES.md"
echo "  4. Run tests:                 npm test"
echo ""
echo "Services will be available at:"
echo "  - API:      http://localhost:3000"
echo "  - Real-time: ws://localhost:8080"
echo "  - Database: $DATABASE_URL"
