#!/usr/bin/env bash
# Re-fetch the BOLT primary sources + test vectors this audit cited.
# Usage: ./fetch-specs.sh [dest_dir]   (default: /tmp/onion-audit)
set -euo pipefail
DEST="${1:-/tmp/onion-audit}"
mkdir -p "$DEST"
BASE="https://raw.githubusercontent.com/lightning/bolts/master"
declare -A F=(
  [bolt04.md]="$BASE/04-onion-routing.md"
  [bolt07.md]="$BASE/07-routing-gossip.md"
  [01-messaging.md]="$BASE/01-messaging.md"
  [02-peer-protocol.md]="$BASE/02-peer-protocol.md"
  [03-transactions.md]="$BASE/03-transactions.md"
  [onion-test.json]="$BASE/bolt04/onion-test.json"
  [onion-error-test.json]="$BASE/bolt04/onion-error-test.json"
)
for name in "${!F[@]}"; do
  curl -sSL --max-time 30 -o "$DEST/$name" "${F[$name]}" && echo "✓ $DEST/$name"
done
echo "Done. NOTE: 'master' moves; citations were made 2026-06-21."
