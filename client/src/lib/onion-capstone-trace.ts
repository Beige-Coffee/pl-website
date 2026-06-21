/**
 * Onion Capstone - step-through trace engine.
 *
 * Runs the student's OWN solutions (assembled from their saved exercise code)
 * through a fixed Alice -> Bob -> Charlie -> Dave payment, capturing a
 * VS-Code-style per-line trace of the functions they wrote via Python's
 * `sys.settrace`. First-invocation-only: each student function is stepped
 * through once (Alice's build + the first forwarder's verify/peel/check), while
 * the coarse `events` list drives the full-route onion animation.
 *
 * The whole thing runs client-side in the existing Pyodide Web Worker; no
 * server is involved. Proven against the live draft solutions (see the
 * capstone spec memory + /tmp/draft_trace.mts).
 */
import { ONION_ROUTING_DRAFT_EXERCISE_GROUPS as GROUPS } from "./onion-routing-exercise-groups-draft";
import { runPythonTrace } from "./pyodide-runner";

export type HopId = "alice" | "bob" | "charlie" | "dave";

/** A serialized Python value, shaped for compact display in the variables pane. */
export type SerializedValue =
  | { t: "bytes"; len: number; hex: string }
  | { t: "int"; v: string }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "none" }
  | { t: "list" | "tuple"; len: number; items: SerializedValue[] }
  | { t: "dict"; len: number; items: Record<string, SerializedValue> }
  | { t: "more"; n: number }
  | { t: string; fields: Record<string, SerializedValue> }
  | { t: string; repr: string };

/** One step in the step-through (a `line` event, or a `return`). */
export interface CapstoneTraceStep {
  fn: string; // student function name, e.g. "wrap_hop"
  file: string; // file label, key into CapstoneTraceResult.files
  line: number; // 1-based line into that file's source
  actor: HopId; // who is executing (drives the synced onion animation)
  depth?: number; // call-stack depth of traced student frames (powers step over/into/out)
  event?: "return";
  ret?: SerializedValue;
  locals?: Record<string, SerializedValue>;
  globals?: Record<string, SerializedValue>; // curated module-level values ("Globals" scope)
}

/** A coarse beat for the onion animation (one per hop action). */
export interface CapstoneEvent {
  actor: HopId;
  kind:
    | "built"
    | "received"
    | "verified"
    | "forwarded"
    | "delivered"
    | "rejected";
  text: string;
}

/**
 * A semantic event emitted by the instrumented harness (wrapped student
 * methods + provided helpers). `step` is the index into `steps` BEFORE which
 * the event fired, so events interleave deterministically with line steps.
 * These drive the visual stage's scene timeline (see onion-capstone-scenes.ts).
 */
export interface SemanticEvent {
  kind: string;
  step: number;
  actor: HopId;
  [k: string]: unknown;
}

export interface CapstoneTraceResult {
  ok: boolean;
  steps: CapstoneTraceStep[];
  events: CapstoneEvent[];
  sem?: SemanticEvent[];
  packetHex: string;
  /** file label -> full source, for the code pane. */
  files: Record<string, string>;
}

export const CAPSTONE_FILES = {
  builder: "<student:sphinx/builder.py>",
  forwarder: "<student:sphinx/forwarder.py>",
} as const;

// Provided (untraced) scaffolding the student code leans on. ForwardingPolicy +
// a TLV parser are glue the orchestrator owns (not student-written), so they
// live here rather than in a student file.
const PROVIDED_EXTRA = `
ROUTING_INFO_SIZE = 1300
from dataclasses import dataclass

@dataclass
class ForwardingPolicy:
    fee_base_msat: int
    fee_proportional_millionths: int
    cltv_expiry_delta: int

def _parse_tlv(payload_bytes):
    total_len, hl = parse_bigsize(payload_bytes, 0)
    recs = {}
    pos = hl
    end = hl + total_len
    while pos < end:
        t, tl = parse_bigsize(payload_bytes, pos); pos += tl
        l, ll = parse_bigsize(payload_bytes, pos); pos += ll
        recs[t] = bytes(payload_bytes[pos:pos + l]); pos += l
    return recs
`;

// Trace machinery + fixed cinematic route + driver. Ends by setting
// `_trace_result` to a JSON string (the worker reads that variable back).
const HARNESS = `
# ---- trace machinery (first-invocation-only, whitelisted student fns) ----
TRACE_FNS = {"build", "derive_shared_secrets", "generate_filler", "wrap_hop",
             "peel_layer", "verify_hmac", "check_forward"}
_seen = set()
_stack = []
_steps = []
_actor = ["alice"]
# Semantic events: fired by the wrapped student methods + provided helpers.
# step = len(_steps) at emission, i.e. the event sits between step-1 and step.
_sem = []
_quiet = [False]
def _ev(kind, **kw):
    if _quiet[0]:
        return
    kw["kind"] = kind
    kw["step"] = len(_steps)
    kw.setdefault("actor", _actor[0])
    _sem.append(kw)
# The module-level values worth showing as "Globals" (route inputs + evolving state).
_GLOB_KEEP = {"ROUTING_INFO_SIZE", "SESSION_KEY", "PAYMENT_HASH", "PAYLOADS", "POLICY",
              "BOB_INCOMING_AMT", "BOB_INCOMING_CLTV", "packet", "builder", "fwd"}

def _ser(v, d=0):
    if isinstance(v, (bytes, bytearray)):
        h = bytes(v).hex()
        return {"t": "bytes", "len": len(v), "hex": h if len(h) <= 64 else h[:64] + "…"}
    if isinstance(v, bool):
        return {"t": "bool", "v": v}
    if isinstance(v, int):
        s = str(v)
        return {"t": "int", "v": s if len(s) <= 48 else s[:48] + "…"}
    if v is None:
        return {"t": "none"}
    if isinstance(v, str):
        return {"t": "str", "v": v if len(v) <= 64 else v[:64] + "…"}
    if isinstance(v, (list, tuple)):
        items = [_ser(x, d + 1) for x in list(v)[:4]]
        if len(v) > 4:
            items.append({"t": "more", "n": len(v) - 4})
        return {"t": type(v).__name__, "len": len(v), "items": items}
    if isinstance(v, dict):
        return {"t": "dict", "len": len(v), "items": {str(k): _ser(val, d + 1) for k, val in list(v.items())[:6]}}
    if hasattr(v, "__dict__") and d < 3:
        return {"t": type(v).__name__, "fields": {k: _ser(val, d + 1) for k, val in vars(v).items()}}
    return {"t": type(v).__name__, "repr": repr(v)[:64]}

def _skip(v):
    return isinstance(v, (types.ModuleType, types.FunctionType, types.BuiltinFunctionType, type))

def _glob_snapshot(frame):
    g = frame.f_globals
    out = {}
    for k in _GLOB_KEEP:
        if k in g and not _skip(g[k]):
            out[k] = _ser(g[k])
    return out

def _local(frame, event, arg):
    code = frame.f_code
    depth = len(_stack)
    if event == "line":
        _steps.append({"fn": code.co_name, "file": code.co_filename, "line": frame.f_lineno,
                       "actor": _actor[0], "depth": depth,
                       "locals": {k: _ser(v) for k, v in frame.f_locals.items() if not _skip(v)},
                       "globals": _glob_snapshot(frame)})
    elif event == "return":
        _steps.append({"fn": code.co_name, "file": code.co_filename, "line": frame.f_lineno,
                       "actor": _actor[0], "depth": depth, "event": "return", "ret": _ser(arg)})
        if _stack:
            _stack.pop()
    return _local

def _global(frame, event, arg):
    if event != "call":
        return None
    c = frame.f_code
    if c.co_name not in TRACE_FNS:
        return None
    if not c.co_filename.startswith("<student:"):
        return None
    if c in _seen:
        return None
    _seen.add(c)
    _stack.append(c)
    return _local

# ---- fixed cinematic route (Alice -> Bob -> Charlie -> Dave) ----
def _enc(t, val):
    return encode_bigsize(t) + encode_bigsize(len(val)) + val

def _tlv_fwd(amt, cltv, scid):
    inner = _enc(2, amt.to_bytes(8, "big")) + _enc(4, cltv.to_bytes(4, "big")) + _enc(6, scid)
    return encode_bigsize(len(inner)) + inner

def _tlv_final(amt, cltv, pd):
    inner = _enc(2, amt.to_bytes(8, "big")) + _enc(4, cltv.to_bytes(4, "big")) + _enc(8, pd)
    return encode_bigsize(len(inner)) + inner

SESSION_KEY = bytes.fromhex("41" * 32)
BOB_PRIV = bytes.fromhex("42" * 32)
CHARLIE_PRIV = bytes.fromhex("43" * 32)
DAVE_PRIV = bytes.fromhex("44" * 32)
PAYMENT_HASH = bytes.fromhex("42" * 32)
BOB_PUB = privkey_to_pubkey(BOB_PRIV)
CHARLIE_PUB = privkey_to_pubkey(CHARLIE_PRIV)
DAVE_PUB = privkey_to_pubkey(DAVE_PRIV)
POLICY = ForwardingPolicy(fee_base_msat=1000, fee_proportional_millionths=1000, cltv_expiry_delta=40)

PAYLOADS = [
    _tlv_fwd(1_002_000, 700_040, bytes.fromhex("0102030405060708")),
    _tlv_fwd(1_000_000, 700_000, bytes.fromhex("1112131415161718")),
    _tlv_final(1_000_000, 700_000, bytes.fromhex("aa" * 32)),
]
BOB_INCOMING_AMT = 1_004_002
BOB_INCOMING_CLTV = 700_080

# ---- semantic-event instrumentation (drives the visual stage scenes) ----
# Label every expected key by value so keystream calls can be tagged rho_bob /
# mu_charlie / pad regardless of how the student named things. The chain below
# uses the ORIGINAL helpers (rebinding happens after).
_PUB_HOP = {BOB_PUB: "bob", CHARLIE_PUB: "charlie", DAVE_PUB: "dave"}
_PRIV_HOP = {BOB_PRIV: "bob", CHARLIE_PRIV: "charlie", DAVE_PRIV: "dave"}
_KEY_LABEL = {}
_e_tmp = SESSION_KEY
for _pub_tmp in (BOB_PUB, CHARLIE_PUB, DAVE_PUB):
    _E_tmp = privkey_to_pubkey(_e_tmp)
    _ss_tmp = ecdh(_e_tmp, _pub_tmp)
    for _lbl_tmp in ("rho", "mu", "um", "ammag"):
        _KEY_LABEL[hmac.new(_lbl_tmp.encode(), _ss_tmp, hashlib.sha256).digest()] = _lbl_tmp + "_" + _PUB_HOP[_pub_tmp]
    _e_tmp = scalar_mul(_e_tmp, hashlib.sha256(_E_tmp + _ss_tmp).digest())
_KEY_LABEL[hmac.new(b"pad", SESSION_KEY, hashlib.sha256).digest()] = "pad"

_orig_keystream = chacha20_keystream
def chacha20_keystream(key, length):
    _ev("keystream", key=_KEY_LABEL.get(bytes(key), "key"), length=length)
    return _orig_keystream(key, length)

_orig_xor = xor_bytes
def xor_bytes(a, b):
    _ev("xor", length=min(len(a), len(b)))
    return _orig_xor(a, b)

_orig_ecdh = ecdh
def ecdh(privkey_bytes, pubkey_bytes):
    _hop_e = _PRIV_HOP.get(bytes(privkey_bytes)) or _PUB_HOP.get(bytes(pubkey_bytes))
    _ev("ecdh", hop=_hop_e)
    return _orig_ecdh(privkey_bytes, pubkey_bytes)

def _wrap_fn(orig, name, info_call, info_ret):
    def _w(*a, **kw):
        try:
            _d = info_call(a)
        except Exception:
            _d = {}
        _ev(name + ":call", **_d)
        _r = orig(*a, **kw)
        try:
            _d = info_ret(a, _r)
        except Exception:
            _d = {}
        _ev(name + ":return", **_d)
        return _r
    return _w

def _rho_hop(k):
    return _KEY_LABEL.get(bytes(k), "_").split("_")[-1]

OnionPacketBuilder.derive_shared_secrets = _wrap_fn(
    OnionPacketBuilder.derive_shared_secrets, "derive_shared_secrets",
    lambda a: {}, lambda a, r: {"hops": len(a[0].shared_secrets)})
OnionPacketBuilder.generate_filler = _wrap_fn(
    OnionPacketBuilder.generate_filler, "generate_filler",
    lambda a: {"sizes": list(a[2])}, lambda a, r: {"fillerLen": len(r)})
OnionPacketBuilder.wrap_hop = _wrap_fn(
    OnionPacketBuilder.wrap_hop, "wrap_hop",
    lambda a: {"hop": _rho_hop(a[4]), "payloadLen": len(a[2]), "destination": bytes(a[3]) == b"\\x00" * 32},
    lambda a, r: {"hop": _rho_hop(a[4]), "tag": bytes(r[1]).hex()[:16]})
OnionPacketBuilder.build = _wrap_fn(
    OnionPacketBuilder.build, "build",
    lambda a: {"payloadSizes": [len(_p) for _p in a[1]]},
    lambda a, r: {"packetLen": len(r)})
OnionForwarder.peel_layer = _wrap_fn(
    OnionForwarder.peel_layer, "peel_layer",
    lambda a: {"hop": _PRIV_HOP.get(bytes(a[2]), "?")},
    lambda a, r: {"hop": _PRIV_HOP.get(bytes(a[2]), "?"), "payloadLen": len(r[1])})
verify_hmac = _wrap_fn(verify_hmac, "verify_hmac",
    lambda a: {"mu": _KEY_LABEL.get(bytes(a[1]), "mu")},
    lambda a, r: {"ok": bool(r)})
check_forward = _wrap_fn(check_forward, "check_forward",
    lambda a: {"incomingAmt": a[0], "incomingCltv": a[1], "amt": a[2], "cltv": a[3]},
    lambda a, r: {"verdict": r})

_route_hops = []
for _p_tmp in PAYLOADS:
    _r_tmp = _parse_tlv(_p_tmp)
    _route_hops.append({"amt": int.from_bytes(_r_tmp[2], "big"), "cltv": int.from_bytes(_r_tmp[4], "big"), "size": len(_p_tmp) + 32})
_ev("route", hops=_route_hops, incomingAmt=BOB_INCOMING_AMT, incomingCltv=BOB_INCOMING_CLTV,
    feeBase=POLICY.fee_base_msat, feePpm=POLICY.fee_proportional_millionths, cltvDelta=POLICY.cltv_expiry_delta)

_events = []
def _beat(actor, kind, text):
    _events.append({"actor": actor, "kind": kind, "text": text})

builder = OnionPacketBuilder(SESSION_KEY, [BOB_PUB, CHARLIE_PUB, DAVE_PUB])
_actor[0] = "alice"
sys.settrace(_global)
builder.derive_shared_secrets()
packet = builder.build(PAYLOADS, PAYMENT_HASH)
_beat("alice", "built", "Alice built the 1,366-byte onion packet")

fwd = OnionForwarder()
_hops = [("bob", BOB_PRIV), ("charlie", CHARLIE_PRIV), ("dave", DAVE_PRIV)]
_incoming_amt, _incoming_cltv = BOB_INCOMING_AMT, BOB_INCOMING_CLTV
_cur = packet
_ok = True
for _i, (_name, _priv) in enumerate(_hops):
    _actor[0] = _name
    _beat(_name, "received", _name.capitalize() + " received the 1,366-byte packet")
    _ev("received")
    _quiet[0] = True
    _ss = ecdh(_priv, _cur[1:34])
    _quiet[0] = False
    _mu = hmac.new(b"mu", _ss, hashlib.sha256).digest()
    _valid = verify_hmac(_cur, _mu, PAYMENT_HASH)
    if not _valid:
        _ok = False
    _beat(_name, "verified", "HMAC valid" if _valid else "HMAC FAILED")
    _nxt, _payload_bytes, _ss2 = fwd.peel_layer(_cur, _priv)
    _recs = _parse_tlv(_payload_bytes)
    _amt = int.from_bytes(_recs[2], "big")
    _cltv = int.from_bytes(_recs[4], "big")
    if 6 in _recs:
        _verdict = check_forward(_incoming_amt, _incoming_cltv, _amt, _cltv, POLICY)
        if _verdict is None:
            _beat(_name, "forwarded", _name.capitalize() + " forwards " + str(_amt) + " sats to the next hop")
            _ev("forwarded", amt=_amt)
        else:
            _ok = False
            _beat(_name, "rejected", _name.capitalize() + " rejects: " + str(_verdict))
            break
        _cur = _nxt
        _incoming_amt, _incoming_cltv = _amt, _cltv
    elif 8 in _recs:
        _beat(_name, "delivered", _name.capitalize() + " is the destination and received " + str(_amt) + " sats")
        _ev("delivered", amt=_amt)
        break
sys.settrace(None)

_trace_result = json.dumps({
    "ok": _ok,
    "steps": _steps,
    "events": _events,
    "sem": _sem,
    "packetHex": packet.hex(),
})
`;

/**
 * Build the self-contained Python program that produces the capstone trace.
 * `builderSrc` / `forwarderSrc` are the assembled student "files" (the full
 * OnionPacketBuilder class and the OnionForwarder class + verify_hmac +
 * check_forward), compiled under `<student:...>` filenames so the trace can map
 * each frame back to its source.
 */
export function buildCapstoneTraceProgram(builderSrc: string, forwarderSrc: string): string {
  const provided = GROUPS["sphinx/builder"].setupCode + PROVIDED_EXTRA;
  const filesLiteral =
    "{" +
    [
      JSON.stringify(CAPSTONE_FILES.builder) + ": " + JSON.stringify(builderSrc),
      JSON.stringify(CAPSTONE_FILES.forwarder) + ": " + JSON.stringify(forwarderSrc),
    ].join(", ") +
    "}";
  return [
    "import sys, json, hashlib, hmac, types",
    provided,
    "_FILES = " + filesLiteral,
    "_G = globals()",
    "for _fname, _src in _FILES.items():",
    "    exec(compile(_src, _fname, 'exec'), _G)",
    HARNESS,
  ].join("\n");
}

/**
 * Run the capstone trace against the given assembled student files and return
 * the parsed result with the file sources attached (for the code pane).
 */
export async function runCapstoneTrace(
  builderSrc: string,
  forwarderSrc: string,
): Promise<CapstoneTraceResult> {
  const program = buildCapstoneTraceProgram(builderSrc, forwarderSrc);
  const json = await runPythonTrace(program);
  const parsed = JSON.parse(json) as Omit<CapstoneTraceResult, "files">;
  return {
    ...parsed,
    files: {
      [CAPSTONE_FILES.builder]: builderSrc,
      [CAPSTONE_FILES.forwarder]: forwarderSrc,
    },
  };
}
