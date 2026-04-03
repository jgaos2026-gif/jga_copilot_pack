#!/usr/bin/env bash
# scripts/supabase-dev.sh
# Convenience wrapper for common Supabase local-dev operations.
# Usage: bash scripts/supabase-dev.sh <start|stop|reset|status|migration>

set -euo pipefail

COMMAND="${1:-help}"

check_supabase_cli() {
  if ! command -v supabase &>/dev/null; then
    echo "❌  Supabase CLI not found."
    echo "    Install it with: brew install supabase/tap/supabase"
    exit 1
  fi
}

case "$COMMAND" in
  start)
    check_supabase_cli
    echo "🟢  Starting local Supabase stack…"
    supabase start
    echo ""
    echo "📋  Local URLs:"
    supabase status
    ;;

  stop)
    check_supabase_cli
    echo "🔴  Stopping local Supabase stack…"
    supabase stop
    ;;

  reset)
    check_supabase_cli
    echo "♻️   Resetting local DB and replaying all migrations…"
    supabase db reset
    echo "✅  DB reset complete."
    ;;

  status)
    check_supabase_cli
    supabase status
    ;;

  migration)
    check_supabase_cli
    NAME="${2:-}"
    if [[ -z "$NAME" ]]; then
      echo "Usage: bash scripts/supabase-dev.sh migration <migration_name>"
      exit 1
    fi
    supabase migration new "$NAME"
    echo "✅  Migration file created in supabase/migrations/"
    ;;

  help|*)
    echo ""
    echo "Usage: bash scripts/supabase-dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  start              Start local Supabase stack (Docker required)"
    echo "  stop               Stop local Supabase stack"
    echo "  reset              Reset local DB and replay all migrations"
    echo "  status             Print local service URLs and keys"
    echo "  migration <name>   Create a new timestamped migration file"
    echo ""
    echo "Prerequisites:"
    echo "  brew install supabase/tap/supabase"
    echo "  supabase login"
    echo "  supabase link  (run once per machine, picks your remote project)"
    echo ""
    ;;
esac
