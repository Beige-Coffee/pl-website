/**
 * Transaction Generator Registry
 *
 * Defines configs for in-browser transaction generators that bridge the gap
 * between completing Python exercises and having signed Bitcoin transactions
 * to broadcast and inspect via the Bitcoin Node terminal.
 *
 * Each generator's Python code is self-contained with the exercise solutions
 * baked in, using the same hardcoded seeds (bytes([0x01]*32), bytes([0x02]*32))
 * as the exercises. This makes generators work regardless of exercise completion.
 */

export interface TxGeneratorConfig {
  id: string;
  title: string;
  description: string;
  type: "transaction" | "utility";
  buttonLabel: string;
  inputs: Array<{
    key: string;            // Python variable name injected into code
    label: string;
    placeholder: string;
    autoFillFrom?: string;  // TxNotebook localStorage key to pre-populate
  }>;
  pythonCode?: string;      // Self-contained Python; inputs injected as variables
  /** Custom async execution function that replaces pure-Python flow.
   *  Used when the generator needs server interaction (e.g., Bitcoin node RPC). */
  execute?: (ctx: {
    inputs: Record<string, string>;
    nodeRpc: (method: string, params: unknown[]) => Promise<{ result?: any; error?: string }>;
    runPython: (code: string) => Promise<{ output: string; error?: string | null }>;
  }) => Promise<Record<string, string>>;
  notebookSaves?: Array<{
    key: string;            // pl-txnotebook-{key}
    parseLabel: string;     // Label in stdout to extract, e.g. "TXID"
  }>;
  /** Notebook keys to clear when this generator produces a new transaction. */
  invalidatesNotebookKeys?: string[];
  /** Exercise IDs that must be completed before this generator is unlocked. */
  requiredExercises?: string[];
}

// ─── Shared Python preamble ──────────────────────────────────────────────────
// All solution functions needed by the transaction generators, inlined so each
// generator is fully self-contained when executed in Pyodide.

const PREAMBLE = `
import hmac
import hashlib
import struct
from ecdsa import SECP256k1, SigningKey
from ecdsa.util import sigencode_der_canonize

ORDER = SECP256k1.order

def privkey_to_pubkey(secret: bytes) -> bytes:
    sk = SigningKey.from_string(secret, curve=SECP256k1)
    vk = sk.get_verifying_key()
    point = vk.pubkey.point
    prefix = b'\\x02' if point.y() % 2 == 0 else b'\\x03'
    return prefix + point.x().to_bytes(32, 'big')

def _ripemd160(data: bytes) -> bytes:
    try:
        return hashlib.new('ripemd160',usedforsecurity=False,data=data).digest()
    except (ValueError, TypeError):
        # Pure-Python RIPEMD-160 fallback for Pyodide/WASM
        import struct as _st
        def _f(j,x,y,z):
            if j<16: return x^y^z
            if j<32: return (x&y)|(~x&z)
            if j<48: return (x|~y)^z
            if j<64: return (x&z)|(y&~z)
            return x^(y|~z)
        def _rl(n,s): return((n<<s)|(n>>(32-s)))&0xffffffff
        _K1=(0,0x5a827999,0x6ed9eba1,0x8f1bbcdc,0xa953fd4e)
        _K2=(0x50a28be6,0x5c4dd124,0x6d703ef3,0x7a6d76e9,0)
        _R1=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13]
        _R2=[5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11]
        _S1=[11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6]
        _S2=[8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11]
        msg=bytearray(data)
        l=len(msg)*8
        msg.append(0x80)
        while len(msg)%64!=56: msg.append(0)
        msg+=_st.pack('<Q',l)
        h0,h1,h2,h3,h4=0x67452301,0xefcdab89,0x98badcfe,0x10325476,0xc3d2e1f0
        for i in range(0,len(msg),64):
            w=list(_st.unpack_from('<16I',msg,i))
            a1,b1,c1,d1,e1=h0,h1,h2,h3,h4
            a2,b2,c2,d2,e2=h0,h1,h2,h3,h4
            for j in range(80):
                rnd=j//16
                t=(_rl((a1+_f(j,b1,c1,d1)+w[_R1[j]]+_K1[rnd])&0xffffffff,_S1[j])+e1)&0xffffffff
                a1=e1;e1=d1;d1=_rl(c1,10);c1=b1;b1=t
                t=(_rl((a2+_f(79-j,b2,c2,d2)+w[_R2[j]]+_K2[rnd])&0xffffffff,_S2[j])+e2)&0xffffffff
                a2=e2;e2=d2;d2=_rl(c2,10);c2=b2;b2=t
            t=(h1+c1+d2)&0xffffffff
            h1=(h2+d1+e2)&0xffffffff
            h2=(h3+e1+a2)&0xffffffff
            h3=(h4+a1+b2)&0xffffffff
            h4=(h0+b1+c2)&0xffffffff
            h0=t
        return _st.pack('<5I',h0,h1,h2,h3,h4)

def hash160(data: bytes) -> bytes:
    return _ripemd160(hashlib.sha256(data).digest())

def dsha256(d: bytes) -> bytes:
    return hashlib.sha256(hashlib.sha256(d).digest()).digest()

# ── BIP32 / Key Derivation ──

def create_keys_manager(seed: bytes) -> dict:
    I = hmac.new(b"Bitcoin seed", seed, hashlib.sha512).digest()
    return {'master_key': I[:32], 'chain_code': I[32:]}

def bip32_ckd_priv(key: bytes, chaincode: bytes, index: int):
    if index >= 0x80000000:
        data = b'\\x00' + key + struct.pack('>I', index)
    else:
        pubkey = privkey_to_pubkey(key)
        data = pubkey + struct.pack('>I', index)
    I = hmac.new(chaincode, data, hashlib.sha512).digest()
    child_key_int = (int.from_bytes(I[:32], 'big') + int.from_bytes(key, 'big')) % ORDER
    child_key = child_key_int.to_bytes(32, 'big')
    return child_key, I[32:]

def derive_ln_key(seed: bytes, family: int, index: int) -> bytes:
    km = create_keys_manager(seed)
    key, cc = km['master_key'], km['chain_code']
    for idx in [1017 + 0x80000000, 0 + 0x80000000, family + 0x80000000, 0, index]:
        key, cc = bip32_ckd_priv(key, cc, idx)
    return key

def derive_channel_keys(seed: bytes, index: int = 0) -> dict:
    families = {
        'funding': 0, 'revocation_base': 1, 'htlc_base': 2,
        'payment_base': 3, 'delayed_payment_base': 4, 'per_commitment': 5,
    }
    result = {}
    for name, fam in families.items():
        priv = derive_ln_key(seed, fam, index)
        pub = privkey_to_pubkey(priv)
        result[name] = {'privkey': priv, 'pubkey': pub}
    return result

# ── Per-Commitment Key Derivation ──

def build_commitment_secret(seed, per_commitment_index):
    commitment_seed = derive_ln_key(seed, 5, 0)
    value = bytearray(commitment_seed)
    for i in range(47, -1, -1):
        if (per_commitment_index >> i) & 1:
            value[i // 8] ^= (1 << (i % 8))
            value = bytearray(hashlib.sha256(value).digest())
    return bytes(value)

def derive_per_commitment_point(seed, commitment_number):
    per_commitment_index = ((1 << 48) - 1) - commitment_number
    per_commitment_secret = build_commitment_secret(seed, per_commitment_index)
    return privkey_to_pubkey(per_commitment_secret)

def derive_pubkey(basepoint, per_commitment_point):
    tweak = hashlib.sha256(per_commitment_point + basepoint).digest()
    from ecdsa import VerifyingKey
    bp_point = VerifyingKey.from_string(basepoint, curve=SECP256k1).pubkey.point
    G = SECP256k1.generator
    tweak_int = int.from_bytes(tweak, 'big') % ORDER
    result_point = bp_point + G * tweak_int
    prefix = b'\\x02' if result_point.y() % 2 == 0 else b'\\x03'
    return prefix + result_point.x().to_bytes(32, 'big')

def derive_privkey(basepoint_secret, per_commitment_point):
    basepoint = privkey_to_pubkey(basepoint_secret)
    tweak = hashlib.sha256(per_commitment_point + basepoint).digest()
    tweak_int = int.from_bytes(tweak, 'big')
    key_int = int.from_bytes(basepoint_secret, 'big')
    derived = (key_int + tweak_int) % ORDER
    return derived.to_bytes(32, 'big')

def derive_revocation_pubkey(revocation_basepoint, per_commitment_point):
    rev_tweak = hashlib.sha256(revocation_basepoint + per_commitment_point).digest()
    pcp_tweak = hashlib.sha256(per_commitment_point + revocation_basepoint).digest()
    from ecdsa import VerifyingKey
    rb_point = VerifyingKey.from_string(revocation_basepoint, curve=SECP256k1).pubkey.point
    pc_point = VerifyingKey.from_string(per_commitment_point, curve=SECP256k1).pubkey.point
    G = SECP256k1.generator
    rev_int = int.from_bytes(rev_tweak, 'big') % ORDER
    pcp_int = int.from_bytes(pcp_tweak, 'big') % ORDER
    result_point = rb_point * rev_int + pc_point * pcp_int
    prefix = b'\\x02' if result_point.y() % 2 == 0 else b'\\x03'
    return prefix + result_point.x().to_bytes(32, 'big')

# ── Scripts ──

def create_funding_script(pubkey1: bytes, pubkey2: bytes) -> bytes:
    keys = sorted([pubkey1, pubkey2])
    return b'\\x52\\x21' + keys[0] + b'\\x21' + keys[1] + b'\\x52\\xae'

def create_to_remote_script(remote_pubkey):
    return b'\\x00\\x14' + hash160(remote_pubkey)

def create_to_local_script(revocation_pubkey, local_delayed_pubkey, to_self_delay):
    if to_self_delay <= 0x7f:
        delay_bytes = bytes([to_self_delay])
    elif to_self_delay <= 0x7fff:
        delay_bytes = to_self_delay.to_bytes(2, 'little')
    else:
        delay_bytes = to_self_delay.to_bytes(3, 'little')
    s = b'\\x63\\x21' + revocation_pubkey + b'\\xac\\x67'
    s += bytes([len(delay_bytes)]) + delay_bytes
    s += b'\\xb2\\x75\\x21' + local_delayed_pubkey + b'\\xac\\x68'
    return s

def get_obscure_factor(opener_payment_basepoint, accepter_payment_basepoint):
    data = opener_payment_basepoint + accepter_payment_basepoint
    h = hashlib.sha256(data).digest()
    return int.from_bytes(h[26:32], 'big')

def create_offered_htlc_script(revocation_pubkey, local_htlc_pubkey, remote_htlc_pubkey, payment_hash):
    rev_hash = hash160(revocation_pubkey)
    payment_ripemd = _ripemd160(payment_hash)
    s = b''
    s += b'\\x76\\xa9\\x14' + rev_hash + b'\\x87\\x63\\xac'
    s += b'\\x67\\x21' + remote_htlc_pubkey + b'\\x7c\\x82\\x01\\x20\\x87'
    s += b'\\x64\\x75\\x52\\x7c\\x21' + local_htlc_pubkey + b'\\x52\\xae'
    s += b'\\x67\\xa9\\x14' + payment_ripemd + b'\\x88\\xac\\x68\\x68'
    return s

# ── Transaction Builders ──

def create_funding_tx(input_txid_hex, input_vout, funding_amount, pubkey1, pubkey2):
    tx = b''
    tx += struct.pack('<I', 2)
    tx += b'\\x01'
    tx += bytes.fromhex(input_txid_hex)[::-1]
    tx += struct.pack('<I', input_vout)
    tx += b'\\x00'
    tx += b'\\xff\\xff\\xff\\xff'
    tx += b'\\x01'
    tx += struct.pack('<q', funding_amount)
    funding_script = create_funding_script(pubkey1, pubkey2)
    script_hash = hashlib.sha256(funding_script).digest()
    spk = b'\\x00\\x20' + script_hash
    tx += bytes([len(spk)]) + spk
    tx += b'\\x00\\x00\\x00\\x00'
    return tx.hex()

def create_commitment_tx(funding_txid_hex, funding_vout, to_local_sat, to_remote_sat,
                          revocation_pubkey, local_delayed_pubkey, remote_payment_pubkey,
                          opener_bp, accepter_bp, commitment_number, to_self_delay,
                          dust_limit, feerate_per_kw, htlc_outputs=None):
    fee = 724 * feerate_per_kw // 1000
    if htlc_outputs:
        fee = (724 + 172 * len(htlc_outputs)) * feerate_per_kw // 1000
    outputs = []
    to_local_value = to_local_sat - fee
    if to_local_value >= dust_limit:
        ws = create_to_local_script(revocation_pubkey, local_delayed_pubkey, to_self_delay)
        p2wsh = b'\\x00\\x20' + hashlib.sha256(ws).digest()
        outputs.append({'value': to_local_value, 'script': p2wsh})
    if to_remote_sat >= dust_limit:
        p2wpkh = create_to_remote_script(remote_payment_pubkey)
        outputs.append({'value': to_remote_sat, 'script': p2wpkh})
    if htlc_outputs:
        for htlc in htlc_outputs:
            p2wsh = b'\\x00\\x20' + hashlib.sha256(htlc['script']).digest()
            outputs.append({'value': htlc['amount'], 'script': p2wsh})
    outputs.sort(key=lambda o: (o['value'], o['script']))

    obscured = commitment_number ^ get_obscure_factor(opener_bp, accepter_bp)
    locktime = (0x20 << 24) | (obscured & 0xFFFFFF)
    sequence = (0x80 << 24) | ((obscured >> 24) & 0xFFFFFF)

    tx = struct.pack('<I', 2)
    tx += b'\\x01'
    tx += bytes.fromhex(funding_txid_hex)[::-1]
    tx += struct.pack('<I', funding_vout)
    tx += b'\\x00'
    tx += struct.pack('<I', sequence)
    tx += bytes([len(outputs)])
    for o in outputs:
        tx += struct.pack('<q', o['value'])
        tx += bytes([len(o['script'])]) + o['script']
    tx += struct.pack('<I', locktime)
    return tx.hex()

def finalize_commitment_tx(unsigned_tx_hex, funding_script, funding_amount,
                            local_funding_privkey, remote_signature, local_sig_first):
    tx = bytes.fromhex(unsigned_tx_hex)
    version = tx[0:4]
    prevhash = tx[5:37]
    previndex = tx[37:41]
    sequence = tx[42:46]
    out_start = 47
    locktime = tx[-4:]
    outputs = tx[out_start:-4]

    hp = dsha256(prevhash + previndex)
    hs = dsha256(sequence)
    ho = dsha256(outputs[1:])
    sc = bytes([len(funding_script)]) + funding_script
    preimage = (version + hp + hs + prevhash + previndex + sc
                + struct.pack('<q', funding_amount) + sequence + ho
                + locktime + struct.pack('<I', 1))
    sighash = dsha256(preimage)

    sk = SigningKey.from_string(local_funding_privkey, curve=SECP256k1)
    local_sig = sk.sign_digest_deterministic(
        sighash,
        hashfunc=hashlib.sha256,
        sigencode=sigencode_der_canonize,
    ) + b'\\x01'

    if local_sig_first:
        sig1, sig2 = local_sig, remote_signature
    else:
        sig1, sig2 = remote_signature, local_sig

    result = version
    result += b'\\x00\\x01'
    result += tx[4:out_start]
    result += outputs
    result += b'\\x04'
    result += b'\\x00'
    result += bytes([len(sig1)]) + sig1
    result += bytes([len(sig2)]) + sig2
    result += bytes([len(funding_script)]) + funding_script
    result += locktime
    return result.hex()

def create_htlc_timeout_tx(commitment_txid_hex, htlc_output_index, htlc_amount_sat,
                            cltv_expiry, revocation_pubkey, local_delayed_pubkey,
                            to_self_delay, feerate_per_kw):
    fee = 663 * feerate_per_kw // 1000
    output_value = htlc_amount_sat - fee
    ws = create_to_local_script(revocation_pubkey, local_delayed_pubkey, to_self_delay)
    p2wsh = b'\\x00\\x20' + hashlib.sha256(ws).digest()
    tx = struct.pack('<I', 2)
    tx += b'\\x01'
    tx += bytes.fromhex(commitment_txid_hex)[::-1]
    tx += struct.pack('<I', htlc_output_index)
    tx += b'\\x00'
    tx += struct.pack('<I', 0)
    tx += b'\\x01'
    tx += struct.pack('<q', output_value)
    tx += bytes([len(p2wsh)]) + p2wsh
    tx += struct.pack('<I', cltv_expiry)
    return tx.hex()

def finalize_htlc_timeout(unsigned_tx_hex, htlc_script, htlc_amount,
                          local_htlc_privkey, remote_htlc_signature):
    tx = bytes.fromhex(unsigned_tx_hex)
    version = tx[0:4]
    prevhash = tx[5:37]
    previndex = tx[37:41]
    sequence = tx[42:46]
    out_start = 47
    locktime = tx[-4:]
    outputs = tx[out_start:-4]

    hp = dsha256(prevhash + previndex)
    hs = dsha256(sequence)
    ho = dsha256(outputs[1:])
    sc = bytes([len(htlc_script)]) + htlc_script
    preimage = (version + hp + hs + prevhash + previndex + sc
                + struct.pack('<q', htlc_amount) + sequence + ho
                + locktime + struct.pack('<I', 1))
    sighash = dsha256(preimage)

    sk = SigningKey.from_string(local_htlc_privkey, curve=SECP256k1)
    local_sig = sk.sign_digest_deterministic(
        sighash,
        hashfunc=hashlib.sha256,
        sigencode=sigencode_der_canonize,
    ) + b'\\x01'

    result = version
    result += b'\\x00\\x01'
    result += tx[4:out_start]
    result += outputs
    result += b'\\x05'
    result += b'\\x00'
    result += bytes([len(remote_htlc_signature)]) + remote_htlc_signature
    result += bytes([len(local_sig)]) + local_sig
    result += b'\\x00'
    result += bytes([len(htlc_script)]) + htlc_script
    result += locktime
    return result.hex()
`;

// ─── Shared channel parameters ──────────────────────────────────────────────
// These match the hardcoded values used by the exercises.

const CHANNEL_PARAMS = `
# ── Channel parameters (same as exercises) ──
ALICE_SEED = bytes([0x01] * 32)
BOB_SEED   = bytes([0x02] * 32)

alice_keys = derive_channel_keys(ALICE_SEED)
bob_keys   = derive_channel_keys(BOB_SEED)

FUNDING_AMOUNT   = 5_000_000  # 0.05 BTC
TO_LOCAL_AMOUNT  = 4_998_500 + 1_000   # Alice's balance (includes fee budget)
TO_REMOTE_AMOUNT = 500   # Bob's balance
TO_SELF_DELAY    = 144
DUST_LIMIT       = 355
FEERATE_PER_KW   = 1_382
COMMITMENT_NUMBER = 1

# Derive per-commitment keys
per_commitment_point = derive_per_commitment_point(ALICE_SEED, COMMITMENT_NUMBER)

revocation_pubkey = derive_revocation_pubkey(
    bob_keys['revocation_base']['pubkey'],
    per_commitment_point
)
local_delayed_pubkey = derive_pubkey(
    alice_keys['delayed_payment_base']['pubkey'],
    per_commitment_point
)
remote_payment_pubkey = bob_keys['payment_base']['pubkey']
local_htlc_pubkey = derive_pubkey(
    alice_keys['htlc_base']['pubkey'],
    per_commitment_point
)
remote_htlc_pubkey = derive_pubkey(
    bob_keys['htlc_base']['pubkey'],
    per_commitment_point
)
local_htlc_privkey = derive_privkey(
    alice_keys['htlc_base']['privkey'],
    per_commitment_point
)
`;

// ─── Generator: Funding Transaction ─────────────────────────────────────────

// Python code to derive the two funding pubkeys from hardcoded seeds.
const FUNDING_PUBKEY_CODE = `${PREAMBLE}
alice_keys = derive_channel_keys(bytes([0x01] * 32))
bob_keys   = derive_channel_keys(bytes([0x02] * 32))
print(f"ALICE_FUNDING_PUB: {alice_keys['funding']['pubkey'].hex()}")
print(f"BOB_FUNDING_PUB: {bob_keys['funding']['pubkey'].hex()}")
`;

/** Parse stdout lines in format "LABEL: value" */
function parsePythonOutput(stdout: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+):\s*(.+)$/);
    if (match) result[match[1]!] = match[2]!.trim();
  }
  return result;
}

const FUNDING_AMOUNT_BTC = 0.05; // 5,000,000 sats
const FUNDING_TX_FEE_BTC = 0.0000025; // 250 sats, fixed for the generator's simple 1-in/2-out tx

interface WalletUtxo {
  txid: string;
  vout: number;
  amount: number;
  spendable?: boolean;
  safe?: boolean;
}

function selectFundingUtxo(unspent: WalletUtxo[]): WalletUtxo | null {
  const minAmount = FUNDING_AMOUNT_BTC + FUNDING_TX_FEE_BTC;
  return [...unspent]
    .filter((utxo) =>
      typeof utxo.txid === "string" &&
      Number.isInteger(utxo.vout) &&
      typeof utxo.amount === "number" &&
      utxo.amount >= minAmount &&
      utxo.spendable !== false &&
      utxo.safe !== false
    )
    .sort((a, b) => a.amount - b.amount)[0] ?? null;
}

/**
 * Funding transaction execute function.
 * Uses the student's regtest Bitcoin node to create a real, broadcastable funding tx:
 * 1. Derive Alice + Bob funding pubkeys via Python
 * 2. createmultisig("bech32") → native P2WSH address for the 2-of-2 multisig
 * 3. listunspent → choose a spendable wallet UTXO explicitly
 * 4. getrawchangeaddress → reserve a change output
 * 5. createrawtransaction → build 1-in/2-out tx (funding output first, change second)
 * 6. signrawtransactionwithwallet → sign with the wallet's keys
 * 7. decoderawtransaction → extract txid
 */
async function executeFundingGenerator(ctx: {
  inputs: Record<string, string>;
  nodeRpc: (method: string, params: unknown[]) => Promise<{ result?: any; error?: string }>;
  runPython: (code: string) => Promise<{ output: string; error?: string | null }>;
}): Promise<Record<string, string>> {
  const { nodeRpc, runPython } = ctx;

  // Step 1: Derive funding pubkeys
  const pyResult = await runPython(FUNDING_PUBKEY_CODE);
  if (pyResult.error) throw new Error(`Key derivation failed: ${pyResult.error}`);
  const pyOut = parsePythonOutput(pyResult.output);
  const alicePub = pyOut["ALICE_FUNDING_PUB"];
  const bobPub = pyOut["BOB_FUNDING_PUB"];
  if (!alicePub || !bobPub) throw new Error("Failed to derive funding pubkeys");

  // Step 2: Create a native segwit multisig address so later witness-based
  // commitment transactions spend the same output type the course teaches.
  const msResult = await nodeRpc("createmultisig", [2, [alicePub, bobPub], "bech32"]);
  if (msResult.error) throw new Error(`createmultisig failed: ${msResult.error}`);
  const msAddress = msResult.result.address as string;

  // Step 3: Pick a confirmed wallet UTXO ourselves instead of relying on
  // fundrawtransaction. This avoids slow wallet coin selection on production.
  const unspentResult = await nodeRpc("listunspent", []);
  if (unspentResult.error) throw new Error(`listunspent failed: ${unspentResult.error}`);
  const utxo = selectFundingUtxo(unspentResult.result as WalletUtxo[]);
  if (!utxo) {
    throw new Error("No spendable UTXO is available. Mine a block in the Bitcoin Node, then try again.");
  }

  const changeAddressResult = await nodeRpc("getrawchangeaddress", ["bech32"]);
  if (changeAddressResult.error) throw new Error(`getrawchangeaddress failed: ${changeAddressResult.error}`);
  const changeAddress = changeAddressResult.result as string;
  const changeAmount = Number((utxo.amount - FUNDING_AMOUNT_BTC - FUNDING_TX_FEE_BTC).toFixed(8));
  if (changeAmount <= 0) {
    throw new Error("Selected UTXO is too small to fund the channel output and fee.");
  }

  // Step 4: Build a deterministic tx with the funding output at vout 0.
  const createResult = await nodeRpc("createrawtransaction", [
    [{ txid: utxo.txid, vout: utxo.vout }],
    [
      { [msAddress]: FUNDING_AMOUNT_BTC },
      { [changeAddress]: changeAmount },
    ],
  ]);
  if (createResult.error) throw new Error(`createrawtransaction failed: ${createResult.error}`);
  const unsignedHex = createResult.result as string;

  // Step 5: Sign with the wallet's keys
  const signResult = await nodeRpc("signrawtransactionwithwallet", [unsignedHex]);
  if (signResult.error) throw new Error(`signrawtransactionwithwallet failed: ${signResult.error}`);
  if (!signResult.result.complete) throw new Error("Transaction signing incomplete");
  const signedHex = signResult.result.hex as string;

  // Step 6: Decode to get the txid
  const decodeResult = await nodeRpc("decoderawtransaction", [signedHex]);
  if (decodeResult.error) throw new Error(`decoderawtransaction failed: ${decodeResult.error}`);
  const txid = decodeResult.result.txid as string;

  return { TXID: txid, HEX: signedHex };
}

// ─── Generator: Commitment (Refund) Transaction ─────────────────────────────

const GEN_COMMITMENT_CODE = `${PREAMBLE}
${CHANNEL_PARAMS}

# The funding txid is required — paste from the Transactions notebook
if not funding_txid_input or not funding_txid_input.strip():
    raise ValueError("Funding Transaction ID is required. Open TOOLS > Transactions to find it.")
funding_txid = funding_txid_input.strip()

# Build unsigned commitment tx
unsigned_hex = create_commitment_tx(
    funding_txid, 0,
    TO_LOCAL_AMOUNT, TO_REMOTE_AMOUNT,
    revocation_pubkey, local_delayed_pubkey, remote_payment_pubkey,
    alice_keys['payment_base']['pubkey'], bob_keys['payment_base']['pubkey'],
    COMMITMENT_NUMBER, TO_SELF_DELAY, DUST_LIMIT, FEERATE_PER_KW
)

# Sign with both parties
funding_script = create_funding_script(
    alice_keys['funding']['pubkey'], bob_keys['funding']['pubkey']
)

# Bob signs first (remote signature for Alice's commitment)
bob_funding_privkey = bob_keys['funding']['privkey']
tx = bytes.fromhex(unsigned_hex)
version = tx[0:4]
prevhash = tx[5:37]
previndex = tx[37:41]
sequence = tx[42:46]
out_start = 47
locktime = tx[-4:]
outputs = tx[out_start:-4]

hp = dsha256(prevhash + previndex)
hs = dsha256(sequence)
ho = dsha256(outputs[1:])
sc = bytes([len(funding_script)]) + funding_script
preimage_data = (version + hp + hs + prevhash + previndex + sc
            + struct.pack('<q', FUNDING_AMOUNT) + sequence + ho
            + locktime + struct.pack('<I', 1))
sighash = dsha256(preimage_data)

bob_sk = SigningKey.from_string(bob_funding_privkey, curve=SECP256k1)
bob_sig = bob_sk.sign_digest_deterministic(
    sighash,
    hashfunc=hashlib.sha256,
    sigencode=sigencode_der_canonize,
) + b'\\x01'

# Determine signature order
alice_funding_pub = alice_keys['funding']['pubkey']
bob_funding_pub = bob_keys['funding']['pubkey']
local_sig_first = alice_funding_pub < bob_funding_pub

# Finalize with Alice's signature
signed_hex = finalize_commitment_tx(
    unsigned_hex, funding_script, FUNDING_AMOUNT,
    alice_keys['funding']['privkey'], bob_sig, local_sig_first
)

# Compute txid from unsigned tx (non-witness serialization)
txid = dsha256(bytes.fromhex(unsigned_hex))[::-1].hex()

print(f"TXID: {txid}")
print(f"HEX: {signed_hex}")
`;

// ─── Generator: HTLC Commitment Transaction ─────────────────────────────────

const GEN_HTLC_COMMITMENT_CODE = `${PREAMBLE}
${CHANNEL_PARAMS}

# HTLC parameters
HTLC_AMOUNT = 405_000
CLTV_EXPIRY = 200
payment_hash = hashlib.sha256(bytes(32)).digest()

# Override channel params for HTLC commitment
FEERATE_PER_KW = 1_117
COMMITMENT_NUMBER = 2
TO_LOCAL_AMOUNT = 4_593_500 + 1_000

# The funding txid is required
if not funding_txid_input or not funding_txid_input.strip():
    raise ValueError("Funding Transaction ID is required. Open TOOLS > Transactions to find it.")
funding_txid = funding_txid_input.strip()

# Build offered HTLC script
htlc_script = create_offered_htlc_script(
    revocation_pubkey, local_htlc_pubkey, remote_htlc_pubkey, payment_hash
)

# Build unsigned commitment tx with HTLC
htlc_outputs = [{'amount': HTLC_AMOUNT, 'script': htlc_script}]
unsigned_hex = create_commitment_tx(
    funding_txid, 0,
    TO_LOCAL_AMOUNT, TO_REMOTE_AMOUNT,
    revocation_pubkey, local_delayed_pubkey, remote_payment_pubkey,
    alice_keys['payment_base']['pubkey'], bob_keys['payment_base']['pubkey'],
    COMMITMENT_NUMBER, TO_SELF_DELAY, DUST_LIMIT, FEERATE_PER_KW,
    htlc_outputs=htlc_outputs
)

# Sign with both parties
funding_script = create_funding_script(
    alice_keys['funding']['pubkey'], bob_keys['funding']['pubkey']
)

bob_funding_privkey = bob_keys['funding']['privkey']
tx = bytes.fromhex(unsigned_hex)
version = tx[0:4]
prevhash = tx[5:37]
previndex = tx[37:41]
sequence_val = tx[42:46]
out_start = 47
locktime = tx[-4:]
outputs = tx[out_start:-4]

hp = dsha256(prevhash + previndex)
hs = dsha256(sequence_val)
ho = dsha256(outputs[1:])
sc = bytes([len(funding_script)]) + funding_script
preimage_data = (version + hp + hs + prevhash + previndex + sc
            + struct.pack('<q', FUNDING_AMOUNT) + sequence_val + ho
            + locktime + struct.pack('<I', 1))
sighash = dsha256(preimage_data)

bob_sk = SigningKey.from_string(bob_funding_privkey, curve=SECP256k1)
bob_sig = bob_sk.sign_digest_deterministic(
    sighash,
    hashfunc=hashlib.sha256,
    sigencode=sigencode_der_canonize,
) + b'\\x01'

alice_funding_pub = alice_keys['funding']['pubkey']
bob_funding_pub = bob_keys['funding']['pubkey']
local_sig_first = alice_funding_pub < bob_funding_pub

signed_hex = finalize_commitment_tx(
    unsigned_hex, funding_script, FUNDING_AMOUNT,
    alice_keys['funding']['privkey'], bob_sig, local_sig_first
)

txid = dsha256(bytes.fromhex(unsigned_hex))[::-1].hex()

print(f"TXID: {txid}")
print(f"HEX: {signed_hex}")
`;

// ─── Generator: HTLC Timeout Transaction ────────────────────────────────────

const GEN_HTLC_TIMEOUT_CODE = `${PREAMBLE}
${CHANNEL_PARAMS}

# HTLC parameters
HTLC_AMOUNT = 405_000         # HTLC output value on commitment tx (for signing)
HTLC_TIMEOUT_AMOUNT = 404_000 # input to timeout tx builder
CLTV_EXPIRY = 200
payment_hash = hashlib.sha256(bytes(32)).digest()

# Override feerate for HTLC timeout
FEERATE_PER_KW = 1_117

# Build offered HTLC script
htlc_script = create_offered_htlc_script(
    revocation_pubkey, local_htlc_pubkey, remote_htlc_pubkey, payment_hash
)

# The commitment txid is required
if not commitment_txid_input or not commitment_txid_input.strip():
    raise ValueError("HTLC Commitment Transaction ID is required. Open TOOLS > Transactions to find it.")
commitment_txid = commitment_txid_input.strip()

# Find HTLC output index
# Sorted by value: to_remote(500) < HTLC(405,000) < to_local(4,593,500) → index 1
htlc_output_index = 1

# Build unsigned HTLC timeout tx
unsigned_htlc_timeout = create_htlc_timeout_tx(
    commitment_txid, htlc_output_index, HTLC_TIMEOUT_AMOUNT, CLTV_EXPIRY,
    revocation_pubkey, local_delayed_pubkey, TO_SELF_DELAY, FEERATE_PER_KW
)

# Bob pre-signs the HTLC timeout (remote HTLC signature)
tx = bytes.fromhex(unsigned_htlc_timeout)
version = tx[0:4]
prevhash = tx[5:37]
previndex = tx[37:41]
sequence_val = tx[42:46]
out_start = 47
locktime = tx[-4:]
outputs = tx[out_start:-4]

hp = dsha256(prevhash + previndex)
hs = dsha256(sequence_val)
ho = dsha256(outputs[1:])
sc = bytes([len(htlc_script)]) + htlc_script
preimage_data = (version + hp + hs + prevhash + previndex + sc
            + struct.pack('<q', HTLC_AMOUNT) + sequence_val + ho
            + locktime + struct.pack('<I', 1))
sighash = dsha256(preimage_data)

# Bob signs with his HTLC key
bob_htlc_privkey = derive_privkey(
    bob_keys['htlc_base']['privkey'],
    per_commitment_point
)
bob_sk = SigningKey.from_string(bob_htlc_privkey, curve=SECP256k1)
bob_htlc_sig = bob_sk.sign_digest_deterministic(
    sighash,
    hashfunc=hashlib.sha256,
    sigencode=sigencode_der_canonize,
) + b'\\x01'

# Finalize with Alice's HTLC signature
signed_hex = finalize_htlc_timeout(
    unsigned_htlc_timeout, htlc_script, HTLC_AMOUNT,
    local_htlc_privkey, bob_htlc_sig
)

txid = dsha256(bytes.fromhex(unsigned_htlc_timeout))[::-1].hex()

print(f"TXID: {txid}")
print(f"HEX: {signed_hex}")
`;

// ─── Generator: Simple HTLC (on-chain, from 6.3) ───────────────────────────

const GEN_SIMPLE_HTLC_CODE = `
import hashlib

def dsha256(d):
    return hashlib.sha256(hashlib.sha256(d).digest()).digest()

def strip_witness_for_txid(raw):
    """Strip segwit witness data to compute txid from non-witness serialization."""
    version = raw[0:4]
    # Check for segwit marker (0x00 0x01 after version)
    has_witness = raw[4] == 0x00 and raw[5] == 0x01
    if not has_witness:
        return raw
    # Parse past inputs
    pos = 6  # skip version + marker
    input_count = raw[pos]; pos += 1
    for _ in range(input_count):
        pos += 32 + 4  # txid + vout
        scriptsig_len = raw[pos]; pos += 1
        pos += scriptsig_len + 4  # scriptSig + sequence
    # Parse past outputs
    output_count = raw[pos]; pos += 1
    for _ in range(output_count):
        pos += 8  # value
        spk_len = raw[pos]; pos += 1
        pos += spk_len
    # Non-witness = version + (inputs + outputs from after marker) + locktime
    locktime = raw[-4:]
    return version + raw[6:pos] + locktime

htlc_tx_hex = "02000000000101a7a015aebdeba2205db63d17c7975ec0e7df930ca28e00fbfeadd1f0266bee080000000000ffffffff01082e0600000000002200208d3ae22e8fb32079a95497ee254f215500ecb1276ab3f46376b9fba4c4b788dd02473044022018f471487aa1fe83d1b9cc646c504de1a914480422c6dd0573684d9d6a2a0f1c0220757feb4134b18caf87fa8947f942a4a5cedffe86e3fa4679eaeedd63fa9dd3750121029141a3333093051ea2ea71445f651d413dd4a75369c887a46bf9f0f036e6ef5600000000"

raw = bytes.fromhex(htlc_tx_hex)
non_witness = strip_witness_for_txid(raw)
txid = dsha256(non_witness)[::-1].hex()

print(f"TXID: {txid}")
print(f"HEX: {htlc_tx_hex}")
`;

// ─── Generator: Simple HTLC Claim ───────────────────────────────────────────

const GEN_SIMPLE_HTLC_CLAIM_CODE = `
import hashlib

def dsha256(d):
    return hashlib.sha256(hashlib.sha256(d).digest()).digest()

def strip_witness_for_txid(raw):
    """Strip segwit witness data to compute txid from non-witness serialization."""
    version = raw[0:4]
    has_witness = raw[4] == 0x00 and raw[5] == 0x01
    if not has_witness:
        return raw
    pos = 6
    input_count = raw[pos]; pos += 1
    for _ in range(input_count):
        pos += 32 + 4
        scriptsig_len = raw[pos]; pos += 1
        pos += scriptsig_len + 4
    output_count = raw[pos]; pos += 1
    for _ in range(output_count):
        pos += 8
        spk_len = raw[pos]; pos += 1
        pos += spk_len
    return version + raw[6:pos] + raw[-4:]

claim_tx_hex = "020000000001015a69f41bdf1ec310c6aef64902236a56f8810f0336fb5762a96df363eca664200000000000ffffffff01082e0600000000002200208d3ae22e8fb32079a95497ee254f215500ecb1276ab3f46376b9fba4c4b788dd0448304502210083759ddf9f02594cf191f052db565fe2e8fc141044ad9177b16a903c448ae98c022078266e29026228d01d0130a466014b91c5e058b75a4058b7f99cb533d2ab7935011450726f6772616d6d696e674c696768746e696e6701016563a9148e0290d1ea6eca43cbcb422dca5b6e0ce847696d882103cfa114ffa28b97884a028322665093af66bb19b0cf91c81eae46e6bb7fff799aac6702c800b1752102744c609aeee71a07136482b71244a6217b3368431603e1e3994d0c2d226403afac6800000000"

raw = bytes.fromhex(claim_tx_hex)
non_witness = strip_witness_for_txid(raw)
txid = dsha256(non_witness)[::-1].hex()

print(f"TXID: {txid}")
print(f"HEX: {claim_tx_hex}")
`;

// ─── Utility Generators ─────────────────────────────────────────────────────

const GEN_SHA256_CODE = `
import hashlib
cleaned = hex_input.strip()
if not cleaned:
    raise ValueError("Please enter a hex string")
try:
    data = bytes.fromhex(cleaned)
except ValueError:
    raise ValueError(f"Invalid hex string. Make sure your input contains only hex characters (0-9, a-f).")
result = hashlib.sha256(data).hexdigest()
print(f"RESULT: {result}")
`;

const GEN_RIPEMD_SHA_CODE = `
import hashlib, struct as _st

def _ripemd160(data):
    try:
        return hashlib.new('ripemd160',usedforsecurity=False,data=data).digest()
    except (ValueError, TypeError):
        try:
            return hashlib.new('ripemd160',data=data).digest()
        except ValueError:
            pass
    # Pure-Python RIPEMD-160 fallback for Pyodide/WASM
    def _f(j,x,y,z):
        if j<16: return x^y^z
        if j<32: return (x&y)|(~x&z)
        if j<48: return (x|~y)^z
        if j<64: return (x&z)|(y&~z)
        return x^(y|~z)
    def _rl(n,s): return((n<<s)|(n>>(32-s)))&0xffffffff
    _K1=(0,0x5a827999,0x6ed9eba1,0x8f1bbcdc,0xa953fd4e)
    _K2=(0x50a28be6,0x5c4dd124,0x6d703ef3,0x7a6d76e9,0)
    _R1=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13]
    _R2=[5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11]
    _S1=[11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6]
    _S2=[8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11]
    msg=bytearray(data)
    l=len(msg)*8
    msg.append(0x80)
    while len(msg)%64!=56: msg.append(0)
    msg+=_st.pack('<Q',l)
    h0,h1,h2,h3,h4=0x67452301,0xefcdab89,0x98badcfe,0x10325476,0xc3d2e1f0
    for i in range(0,len(msg),64):
        w=list(_st.unpack_from('<16I',msg,i))
        a1,b1,c1,d1,e1=h0,h1,h2,h3,h4
        a2,b2,c2,d2,e2=h0,h1,h2,h3,h4
        for j in range(80):
            rnd=j//16
            t=(_rl((a1+_f(j,b1,c1,d1)+w[_R1[j]]+_K1[rnd])&0xffffffff,_S1[j])+e1)&0xffffffff
            a1=e1;e1=d1;d1=_rl(c1,10);c1=b1;b1=t
            t=(_rl((a2+_f(79-j,b2,c2,d2)+w[_R2[j]]+_K2[rnd])&0xffffffff,_S2[j])+e2)&0xffffffff
            a2=e2;e2=d2;d2=_rl(c2,10);c2=b2;b2=t
        t=(h1+c1+d2)&0xffffffff
        h1=(h2+d1+e2)&0xffffffff
        h2=(h3+e1+a2)&0xffffffff
        h3=(h4+a1+b2)&0xffffffff
        h4=(h0+b1+c2)&0xffffffff
        h0=t
    return _st.pack('<5I',h0,h1,h2,h3,h4)

if not input_string:
    raise ValueError("Please enter a string")
sha = hashlib.sha256(input_string.encode('utf-8')).digest()
result = _ripemd160(sha).hex()
print(f"RESULT: {result}")
`;

const GEN_TO_HEX_CODE = `
if not input_string:
    raise ValueError("Please enter a string")
result = input_string.encode('utf-8').hex()
print(f"RESULT: {result}")
`;

// ─── Registry ───────────────────────────────────────────────────────────────

export const TX_GENERATORS: Record<string, TxGeneratorConfig> = {
  "gen-funding": {
    id: "gen-funding",
    title: "Generate Funding Transaction",
    description: "This generator creates two sets of channel keys (one for Alice and one for Bob) using the functions we built earlier. It then uses your regtest Bitcoin node to fetch a UTXO, create a 2-of-2 multisig Funding Transaction, and sign it via Bitcoin Core's <code>signrawtransactionwithwallet</code> RPC command. The resulting signed transaction is ready to be broadcast!<br/><br/><strong>NOTE:</strong> Future transactions will be signed using code we write ourselves, so don't feel bad if you wanted to get in the weeds and sign transactions - we'll do this shortly!<br/><br/><strong>IMPORTANT:</strong> Make sure your Bitcoin Node is running (open it via <strong>TOOLS</strong> in the top-right corner) before generating.",
    type: "transaction",
    buttonLabel: "Generate Transaction",
    inputs: [],
    execute: executeFundingGenerator,
    invalidatesNotebookKeys: [
      "commitment-refund-txid",
      "commitment-refund-txhex",
      "commitment-htlc-txid",
      "commitment-htlc-txhex",
      "htlc-timeout-txid",
      "htlc-timeout-txhex",
    ],
    notebookSaves: [
      { key: "funding-txid", parseLabel: "TXID" },
      { key: "funding-txhex", parseLabel: "HEX" },
    ],
  },

  "gen-commitment": {
    id: "gen-commitment",
    title: "Generate Commitment (Refund) Transaction",
    description: "Generates a signed commitment transaction that spends the funding output. This is Alice's first commitment transaction (commitment #1) with a to_local and to_remote output.",
    type: "transaction",
    buttonLabel: "Generate Transaction",
    inputs: [
      {
        key: "funding_txid_input",
        label: "Funding Transaction ID",
        placeholder: "Paste your Funding TxID here",
        autoFillFrom: "funding-txid",
      },
    ],
    pythonCode: GEN_COMMITMENT_CODE,
    notebookSaves: [
      { key: "commitment-refund-txid", parseLabel: "TXID" },
      { key: "commitment-refund-txhex", parseLabel: "HEX" },
    ],
  },

  "gen-simple-htlc": {
    id: "gen-simple-htlc",
    title: "Simple HTLC Transaction",
    description: "The pre-built on-chain HTLC transaction from the tutorial. Alice locks 405,000 sats in an HTLC output that Bob can claim with the preimage.",
    type: "transaction",
    buttonLabel: "Get Transaction",
    inputs: [],
    pythonCode: GEN_SIMPLE_HTLC_CODE,
  },

  "gen-simple-htlc-claim": {
    id: "gen-simple-htlc-claim",
    title: "Bob's HTLC Claim Transaction",
    description: "The pre-built transaction where Bob claims the HTLC using the preimage 'ProgrammingLightning'.",
    type: "transaction",
    buttonLabel: "Get Transaction",
    inputs: [],
    pythonCode: GEN_SIMPLE_HTLC_CLAIM_CODE,
  },

  "gen-htlc-commitment": {
    id: "gen-htlc-commitment",
    title: "Generate HTLC Commitment Transaction",
    description: "Generates a signed commitment transaction that includes an offered HTLC output (405,000 sats). This commitment has three outputs: to_remote, HTLC, and to_local.",
    type: "transaction",
    buttonLabel: "Generate Transaction",
    inputs: [
      {
        key: "funding_txid_input",
        label: "Funding Transaction ID",
        placeholder: "Paste your Funding TxID here",
        autoFillFrom: "funding-txid",
      },
    ],
    pythonCode: GEN_HTLC_COMMITMENT_CODE,
    notebookSaves: [
      { key: "commitment-htlc-txid", parseLabel: "TXID" },
      { key: "commitment-htlc-txhex", parseLabel: "HEX" },
    ],
    requiredExercises: [
      "ln-exercise-commitment-tx",
      "ln-exercise-htlc-outputs",
      "ln-exercise-finalize-commitment",
    ],
  },

  "gen-htlc-timeout": {
    id: "gen-htlc-timeout",
    title: "Generate HTLC Timeout Transaction",
    description: "Generates a signed HTLC timeout transaction that spends the offered HTLC output from the commitment transaction. Alice can broadcast this after the CLTV expiry (block 200) to reclaim the HTLC funds.",
    type: "transaction",
    buttonLabel: "Generate Transaction",
    inputs: [
      {
        key: "commitment_txid_input",
        label: "HTLC Commitment Transaction ID",
        placeholder: "Paste your HTLC Commitment TxID here",
        autoFillFrom: "commitment-htlc-txid",
      },
    ],
    pythonCode: GEN_HTLC_TIMEOUT_CODE,
    notebookSaves: [
      { key: "htlc-timeout-txid", parseLabel: "TXID" },
      { key: "htlc-timeout-txhex", parseLabel: "HEX" },
    ],
    requiredExercises: [
      "ln-exercise-htlc-timeout-tx",
      "ln-exercise-finalize-htlc-timeout",
    ],
  },

  "gen-sha256": {
    id: "gen-sha256",
    title: "SHA256 Hash",
    description: "Compute the SHA256 hash of a hex string.",
    type: "utility",
    buttonLabel: "Calculate",
    inputs: [
      {
        key: "hex_input",
        label: "Hex String",
        placeholder: "Enter hex bytes to hash...",
      },
    ],
    pythonCode: GEN_SHA256_CODE,
  },

  "gen-ripemd-sha": {
    id: "gen-ripemd-sha",
    title: "RIPEMD160(SHA256()) / HASH160",
    description: "Compute RIPEMD160(SHA256(input)) of a UTF-8 string.",
    type: "utility",
    buttonLabel: "Calculate",
    inputs: [
      {
        key: "input_string",
        label: "Input String",
        placeholder: "Enter a string...",
      },
    ],
    pythonCode: GEN_RIPEMD_SHA_CODE,
  },

  "gen-to-hex": {
    id: "gen-to-hex",
    title: "String to Hex",
    description: "Convert a UTF-8 string to its hexadecimal representation.",
    type: "utility",
    buttonLabel: "Calculate",
    inputs: [
      {
        key: "input_string",
        label: "Input String",
        placeholder: "Enter a string to convert...",
      },
    ],
    pythonCode: GEN_TO_HEX_CODE,
  },
};
