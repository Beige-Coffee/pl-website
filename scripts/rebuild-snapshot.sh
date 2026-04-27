#!/usr/bin/env bash
#
# rebuild-snapshot.sh
#
# Rebuilds the bitcoin-snapshot used by student regtest nodes.
# Splits a single 50 BTC coinbase UTXO into 100 × 0.05 BTC outputs
# so the funding transaction generator produces a clean 1-in/1-out tx
# (matching the tutorial content which says "no change output").
#
# Prerequisites: bitcoind must be in $PATH (or at .local/bin/bitcoind).
#                python3 must be in $PATH.
# Usage:        ./scripts/rebuild-snapshot.sh
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Constants (must match tx-generators.ts and bitcoin-node.ts) ──────────────
SNAPSHOT_DIR="$PROJECT_ROOT/docker/lightning-regtest/bitcoin-snapshot"
RPC_USER="pl"
RPC_PASS="pldevpass"
RPC_PORT=18553  # unusual port to avoid collisions with running nodes

SNAPSHOT_WIF="cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA"
SNAPSHOT_SCRIPTPUBKEY="0014751e76e8199196d454941c45d1b3a323f1433bd6"
SNAPSHOT_DESCRIPTOR="wpkh(0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798)"
THROWAWAY_ADDR="bcrt1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdku202"

# ── Locate bitcoind ──────────────────────────────────────────────────────────
BITCOIND=""
if [ -x "$PROJECT_ROOT/.local/bin/bitcoind" ]; then
  BITCOIND="$PROJECT_ROOT/.local/bin/bitcoind"
elif command -v bitcoind >/dev/null 2>&1; then
  BITCOIND="$(command -v bitcoind)"
else
  echo "ERROR: bitcoind not found (checked .local/bin/bitcoind and PATH)"
  exit 1
fi
echo "Using bitcoind: $BITCOIND"

# ── Preflight checks ────────────────────────────────────────────────────────
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 not found in PATH"; exit 1; }

if [ ! -d "$SNAPSHOT_DIR" ]; then
  echo "ERROR: Snapshot directory not found at $SNAPSHOT_DIR"
  exit 1
fi

# ── Set up temp data directory ───────────────────────────────────────────────
TMPDIR_BASE=$(mktemp -d)
DATADIR="$TMPDIR_BASE/bitcoin-data"
REGTEST_DIR="$DATADIR/regtest"
mkdir -p "$REGTEST_DIR"

echo "==> Copying snapshot to temp dir: $DATADIR"
cp -r "$SNAPSHOT_DIR"/* "$REGTEST_DIR"/

rpc() {
  curl -s -u "$RPC_USER:$RPC_PASS" \
    --data-binary "{\"jsonrpc\":\"1.0\",\"id\":\"r\",\"method\":\"$1\",\"params\":$2}" \
    -H 'content-type:application/json' \
    "http://127.0.0.1:$RPC_PORT/"
}

cleanup() {
  echo "==> Stopping bitcoind..."
  rpc "stop" "[]" >/dev/null 2>&1 || true
  sleep 2
  rm -rf "$TMPDIR_BASE"
  echo "==> Cleaned up temp dir"
}
trap cleanup EXIT

# ── Start bitcoind ───────────────────────────────────────────────────────────
echo "==> Starting bitcoind on RPC port $RPC_PORT..."
sh -c "ulimit -n 4096 2>/dev/null; exec \"$BITCOIND\" \
  -datadir=\"$DATADIR\" \
  -regtest \
  -server \
  -rpcport=$RPC_PORT \
  -rpcuser=$RPC_USER \
  -rpcpassword=$RPC_PASS \
  -rpcallowip=127.0.0.1 \
  -rpcbind=127.0.0.1 \
  -disablewallet \
  -minrelaytxfee=0 \
  -maxconnections=0 \
  -daemon"

# Wait for RPC readiness
echo "==> Waiting for RPC..."
for i in $(seq 1 30); do
  if rpc "getblockchaininfo" "[]" 2>/dev/null | grep -q '"blocks"'; then
    echo "    RPC ready after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: bitcoind failed to start within 30s"
    exit 1
  fi
  sleep 1
done

# ── Exit IBD mode if needed (same pattern as bitcoin-node.ts) ────────────────
IBD=$(rpc "getblockchaininfo" "[]" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['initialblockdownload'])")
if [ "$IBD" = "True" ]; then
  echo "==> Node in IBD mode, mining a block with mocktime to exit..."
  NOW=$(date +%s)
  rpc "setmocktime" "[$NOW]" >/dev/null
  rpc "generateblock" "[\"$THROWAWAY_ADDR\", []]" >/dev/null
  rpc "setmocktime" "[0]" >/dev/null
fi

# ── Build, sign, broadcast the split tx via Python ───────────────────────────
# Bitcoin Core's createrawtransaction rejects duplicate addresses, so we
# construct the raw transaction bytes directly in Python.
echo "==> Building and broadcasting split transaction..."
SPLIT_TXID=$(python3 << 'PYEOF'
import json, urllib.request, base64, struct, sys

RPC_PORT = 18553
auth = base64.b64encode(b"pl:pldevpass").decode()
SNAPSHOT_WIF = "cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA"
SNAPSHOT_SCRIPTPUBKEY = "0014751e76e8199196d454941c45d1b3a323f1433bd6"
SNAPSHOT_DESCRIPTOR = "wpkh(0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798)"

def rpc(method, params):
    data = json.dumps({"jsonrpc":"1.0","id":"r","method":method,"params":params}).encode()
    req = urllib.request.Request(
        f"http://127.0.0.1:{RPC_PORT}/",
        data=data,
        headers={"Content-Type":"application/json", "Authorization": f"Basic {auth}"}
    )
    try:
        resp = urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        raise Exception(f"RPC {method} error: {body.get('error')}")
    return json.loads(resp.read())["result"]

def varint(n):
    if n < 0xfd:
        return bytes([n])
    elif n <= 0xffff:
        return b'\xfd' + struct.pack('<H', n)
    else:
        return b'\xfe' + struct.pack('<I', n)

def build_raw_tx(txid_hex, vout, outputs):
    tx = struct.pack('<I', 2)  # version
    tx += varint(1)  # 1 input
    tx += bytes.fromhex(txid_hex)[::-1]  # txid LE
    tx += struct.pack('<I', vout)
    tx += varint(0)  # empty scriptSig
    tx += struct.pack('<I', 0xfffffffd)  # sequence
    tx += varint(len(outputs))
    for (sats, script_hex) in outputs:
        tx += struct.pack('<q', sats)
        script_bytes = bytes.fromhex(script_hex)
        tx += varint(len(script_bytes))
        tx += script_bytes
    tx += struct.pack('<I', 0)  # locktime
    return tx.hex()

height = rpc("getblockcount", [])
scan = rpc("scantxoutset", ["start", [{"desc": SNAPSHOT_DESCRIPTOR, "range": 1000}]])

utxo = None
for u in scan["unspents"]:
    if u["amount"] >= 50.0 and (height - u["height"]) >= 100:
        utxo = u
        break

if not utxo:
    print("ERROR: No mature >= 50 BTC UTXO found", file=sys.stderr)
    sys.exit(1)

print(f"  Selected UTXO: {utxo['txid']}:{utxo['vout']} ({utxo['amount']} BTC)", file=sys.stderr)

# 100 x 0.05 BTC (5M sats) + 1 x remaining
sats_per_split = 5_000_000
remaining_sats = int(utxo["amount"] * 100_000_000) - (100 * sats_per_split)
outputs = [(sats_per_split, SNAPSHOT_SCRIPTPUBKEY)] * 100 + [(remaining_sats, SNAPSHOT_SCRIPTPUBKEY)]

unsigned_hex = build_raw_tx(utxo["txid"], utxo["vout"], outputs)

# Verify it decodes
decoded = rpc("decoderawtransaction", [unsigned_hex])
print(f"  Raw tx: {len(decoded['vin'])} in, {len(decoded['vout'])} out", file=sys.stderr)

# Sign
prevout = [{"txid": utxo["txid"], "vout": utxo["vout"],
            "scriptPubKey": utxo["scriptPubKey"], "amount": utxo["amount"]}]
signed = rpc("signrawtransactionwithkey", [unsigned_hex, [SNAPSHOT_WIF], prevout])
if not signed["complete"]:
    print(f"ERROR: signing incomplete: {signed}", file=sys.stderr)
    sys.exit(1)

# Broadcast
txid = rpc("sendrawtransaction", [signed["hex"]])
print(f"  Split txid: {txid}", file=sys.stderr)

# Print txid to stdout for the shell script to capture
print(txid)
PYEOF
)

if [ -z "$SPLIT_TXID" ]; then
  echo "ERROR: Split transaction failed"
  exit 1
fi

echo "    Split txid: $SPLIT_TXID"

# ── Mine 101 blocks ─────────────────────────────────────────────────────────
echo "==> Mining 101 blocks (1 to confirm + 100 for coinbase maturity)..."
rpc "generateblock" "[\"$THROWAWAY_ADDR\", [\"$SPLIT_TXID\"]]" >/dev/null

for i in $(seq 1 100); do
  rpc "generateblock" "[\"$THROWAWAY_ADDR\", []]" >/dev/null
  if [ $((i % 25)) -eq 0 ]; then
    echo "    Mined $i / 100 blocks..."
  fi
done

# ── Verify ───────────────────────────────────────────────────────────────────
echo "==> Verifying split UTXOs..."
VERIFY=$(python3 << 'PYEOF'
import json, urllib.request, base64

auth = base64.b64encode(b"pl:pldevpass").decode()
def rpc(method, params):
    data = json.dumps({"jsonrpc":"1.0","id":"r","method":method,"params":params}).encode()
    req = urllib.request.Request("http://127.0.0.1:18553/", data=data,
        headers={"Content-Type":"application/json","Authorization":f"Basic {auth}"})
    return json.loads(urllib.request.urlopen(req).read())["result"]

height = rpc("getblockcount", [])
desc = "wpkh(0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798)"
scan = rpc("scantxoutset", ["start", [{"desc": desc, "range": 1000}]])
exact = [u for u in scan["unspents"] if u["amount"] == 0.05 and (height - u["height"]) >= 100]
print(f"{height} {len(exact)} {len(scan['unspents'])}")
PYEOF
)

NEW_HEIGHT=$(echo "$VERIFY" | awk '{print $1}')
EXACT_COUNT=$(echo "$VERIFY" | awk '{print $2}')
TOTAL_COUNT=$(echo "$VERIFY" | awk '{print $3}')

echo "    New height: $NEW_HEIGHT"
echo "    Total UTXOs: $TOTAL_COUNT"
echo "    Mature 0.05 BTC UTXOs: $EXACT_COUNT"

if [ "$EXACT_COUNT" -lt 100 ]; then
  echo "ERROR: Expected >= 100 mature 0.05 BTC UTXOs, got $EXACT_COUNT"
  exit 1
fi

# ── Stop and copy back ──────────────────────────────────────────────────────
echo "==> Stopping bitcoind..."
rpc "stop" "[]" >/dev/null
sleep 3
trap - EXIT  # disable cleanup trap since we're handling it manually

echo "==> Copying rebuilt snapshot back to $SNAPSHOT_DIR..."
rm -rf "$SNAPSHOT_DIR"/*
# Copy only essential data (skip runtime artifacts like debug.log, peers.dat)
for item in blocks chainstate indexes settings.json; do
  if [ -e "$REGTEST_DIR/$item" ]; then
    cp -r "$REGTEST_DIR/$item" "$SNAPSHOT_DIR/"
  fi
done
rm -rf "$TMPDIR_BASE"

echo ""
echo "=== Snapshot rebuild complete ==="
echo "    Location: $SNAPSHOT_DIR"
echo "    Mature 0.05 BTC UTXOs: $EXACT_COUNT"
echo "    Tip height: $NEW_HEIGHT"
echo ""
echo "Next steps:"
echo "  1. Start the dev server and verify the funding generator creates a 1-output tx"
echo "  2. Commit the updated snapshot: git add docker/lightning-regtest/bitcoin-snapshot/"
