#!/usr/bin/env bash
#
# Build and deploy to Cloudflare using credentials from .dev.vars.
#
# This machine has multiple Cloudflare accounts, so the deploy target is pinned
# explicitly rather than inherited from `wrangler login` state. Reads:
#
#   CLOUDFLARE_ACCOUNT_ID   which account to deploy into
#   CLOUDFLARE_API_TOKEN    token with Workers Scripts:Edit on that account
#
# Any extra arguments are forwarded to `wrangler deploy`.
#
#   ./scripts/deploy.sh
#   ./scripts/deploy.sh --dry-run
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.dev.vars"

die() {
  printf '\033[31merror:\033[0m %s\n' "$1" >&2
  exit 1
}

# Read one key from a dotenv-style file. Parsed rather than sourced so that
# values containing spaces, quotes, or shell metacharacters cannot execute.
read_dev_var() {
  local key="$1" line value
  line="$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" | tail -n1 || true)"
  [ -n "$line" ] || return 0

  value="${line#*=}"
  value="${value%$'\r'}"                            # strip CRLF line ending
  value="${value#"${value%%[![:space:]]*}"}"        # trim leading whitespace
  value="${value%"${value##*[![:space:]]}"}"        # trim trailing whitespace

  case "$value" in                                  # strip matched quotes
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac

  printf '%s' "$value"
}

[ -f "$ENV_FILE" ] || die ".dev.vars not found at $ENV_FILE — copy .dev.vars-example and fill it in."

CLOUDFLARE_ACCOUNT_ID="$(read_dev_var CLOUDFLARE_ACCOUNT_ID)"
CLOUDFLARE_API_TOKEN="$(read_dev_var CLOUDFLARE_API_TOKEN)"

[ -n "$CLOUDFLARE_ACCOUNT_ID" ] || die "CLOUDFLARE_ACCOUNT_ID is missing or empty in .dev.vars"
[ -n "$CLOUDFLARE_API_TOKEN" ] || die "CLOUDFLARE_API_TOKEN is missing or empty in .dev.vars"

# Wrangler reads both of these from the environment and skips the OAuth login
# state entirely, so the account cannot be inherited from a previous session.
export CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN

printf '\033[36m→\033[0m deploying to account \033[1m%s\033[0m (token ••••%s)\n' \
  "$CLOUDFLARE_ACCOUNT_ID" "${CLOUDFLARE_API_TOKEN: -4}"

cd "$REPO_ROOT"
npm run build
npx wrangler deploy "$@"
