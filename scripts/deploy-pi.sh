#!/usr/bin/env bash
# Build the frontend with current env vars and sync it to the Raspberry Pi.
# Then restart the nginx container so the new bundle is served.
#
# Secrets (VITE_GOOGLE_CLIENT_ID) are read from the shell or .env.production.local.
# This script never prints them and never writes them to /tmp.

set -euo pipefail

PI_HOST="${PI_HOST:-admin@10.10.60.47}"
PI_DIST="/mayordomia/dist"
SSH="${SSH:-ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PreferredAuthentications=password -o PubkeyAuthentication=no}"

# Load override file if it exists. .env.production.local is gitignored.
if [[ -f .env.production.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production.local
  set +a
fi

# Sanity check: refuse to push a build with an empty Client ID unless forced.
if [[ -z "${VITE_GOOGLE_CLIENT_ID:-}" && "${ALLOW_EMPTY_CLIENT:-0}" != "1" ]]; then
  echo "VITE_GOOGLE_CLIENT_ID is empty. Refusing to deploy." >&2
  echo "Set it in .env.production.local or pass VITE_GOOGLE_CLIENT_ID=... to override." >&2
  echo "Or set ALLOW_EMPTY_CLIENT=1 to push a build without login." >&2
  exit 1
fi

# 1. Build with the active env. VITE_BASE_PATH defaults to "/" here for the
#    own-domain deploy (mayordomia.fewlines.com.ar).
echo "▶ Building frontend (VITE_BASE_PATH=${VITE_BASE_PATH:-/})…"
VITE_BASE_PATH="${VITE_BASE_PATH:-/}" \
VITE_GOOGLE_CLIENT_ID="${VITE_GOOGLE_CLIENT_ID:-}" \
VITE_APPS_SCRIPT_URL="${VITE_APPS_SCRIPT_URL:-/api}" \
VITE_USE_MOCK_PUBLIC="${VITE_USE_MOCK_PUBLIC:-false}" \
npm run build

# 2. Rsync dist/ → Pi.
echo "▶ Syncing dist/ to ${PI_HOST}:${PI_DIST}…"
SSHPASS="${SSHPASS:-}" rsync -avz --exclude='node_modules' \
  -e "sshpass ${SSHPASS:+-p $SSHPASS} ${SSH}" \
  dist/ "${PI_HOST}:${PI_DIST}/"

# 3. Restart the nginx container so it serves the new bundle.
echo "▶ Restarting mayordomia-web-1 on the Pi…"
sshpass ${SSHPASS:+-p $SSHPASS} ${SSH} "${PI_HOST}" \
  'cd /mayordomia && docker compose restart web'

echo "✓ Deploy complete."
echo "  Visit: https://mayordomia.fewlines.com.ar/"
echo "  (hard reload: Cmd+Shift+R to bypass the service worker)"
