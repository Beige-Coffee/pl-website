/**
 * Onion Capstone — scene timeline.
 *
 * Turns a capstone trace (line steps + semantic events) into:
 *   - `frames`: the stepping timeline (real line steps, plus synthetic frames
 *     for repeat invocations that the first-invocation tracer skipped), and
 *   - `scenes`: visual-stage states that quote the chapter 7-10 diagram
 *     grammar (buffer bar + hop-payload subcells + hatch layers + byte strip).
 *
 * Scenes advance on SEMANTIC EVENTS (function/helper boundaries emitted by the
 * instrumented harness), never on line numbers, so the mapping is robust to
 * any student's naming and code style. Line stepping moves within a scene.
 */
import {
  CAPSTONE_FILES,
  type CapstoneTraceResult,
  type CapstoneTraceStep,
  type HopId,
  type SemanticEvent,
  type SerializedValue,
} from "./onion-capstone-trace";
import type { ForwarderId } from "../components/onion-routing-draft/encryptionHatch";

export type StageView = "chain" | "buffer" | "packet" | "policy" | "deliver";

export interface BufferSegment {
  key: string;
  kind: "payload" | "pad" | "filler" | "ext";
  hop?: ForwarderId;
  /** Encryption layers currently on this region (hatch overlays). */
  layers: ForwarderId[];
  plaintext?: boolean;
  widthPct: number;
  byteLabel: string;
  emphasis?: boolean;
}

export interface StageState {
  packetAt: HopId;
  transitTo?: HopId;
  view: StageView;
  segments?: BufferSegment[];
  bufferLabel?: string;
  keystream?: { label: string; hop: ForwarderId | null; bytes: number; note?: string };
  hmac?: { label: string; state: "computing" | "ok" | "fail" };
  byteField?: "version" | "ephemeral" | "hop_payloads" | "hmac" | "all" | null;
  ephemeralLabel?: string;
  outerHmacLabel?: string;
  chain?: Array<{ hop: ForwarderId; state: "done" | "active" | "todo" }>;
  policy?: {
    hop: ForwarderId;
    incomingAmt: number;
    amt: number;
    requiredFee: number;
    incomingCltv: number;
    cltv: number;
    delta: number;
  };
  deliverAmt?: number;
}

export interface SceneFrame {
  actor: HopId;
  depth: number;
  file?: string;
  line?: number;
  fn?: string;
  locals?: Record<string, SerializedValue>;
  globals?: Record<string, SerializedValue>;
  ret?: SerializedValue;
  synthetic?: boolean;
  note?: string;
}

export interface Scene {
  key: string;
  title: string;
  caption: string;
  start: number;
  end: number;
  stage: StageState;
  /** Event-derived facts pinned above the variables tree. */
  pinned: Array<{ name: string; value: string }>;
  /** Well-known local names to surface in the pinned section when present. */
  pinLocals: string[];
}

export interface SceneTimeline {
  frames: SceneFrame[];
  scenes: Scene[];
  /** frame index -> scene index */
  sceneOfFrame: number[];
}

const FWD: ForwarderId[] = ["bob", "charlie", "dave"];
const WRAPS: ForwarderId[] = ["dave", "charlie", "bob"];
const NAME: Record<HopId, string> = { alice: "Alice", bob: "Bob", charlie: "Charlie", dave: "Dave" };
const E_LABEL: Record<ForwarderId, string> = { bob: "E_AB", charlie: "E_AC", dave: "E_AD" };
const INNER_OF: Record<ForwarderId, ForwarderId | null> = { dave: null, charlie: "dave", bob: "charlie" };

const PIN_LOCALS: Record<string, string[]> = {
  chain: ["e", "E", "ss", "b", "hop_pubkey", "self"],
  filler: ["filler", "stream", "chunk", "stream_len", "payload_sizes", "rho_keys", "i"],
  build: ["buffer", "next_hmac", "filler", "pad_key", "sizes", "payloads", "i"],
  wrap: ["buffer", "payload", "next_hmac", "hop_size", "shifted", "stream", "encrypted", "tag", "rho", "mu"],
  verify: ["packet", "mu", "associated_data", "hop_payloads", "inbound_hmac", "expected"],
  peel: ["packet", "E_i", "hop_payloads", "ss", "rho", "work", "stream", "length", "header_len", "payload", "hop_size", "next_hmac", "next_hop_payloads", "b", "E_next", "next_packet"],
  policy: ["incoming_amount_msat", "incoming_cltv_expiry", "amt_to_forward", "outgoing_cltv_value", "required_fee", "policy"],
};

const fmt = (n: number) => n.toLocaleString("en-US");

interface RouteInfo {
  sizes: number[];
  amts: number[];
  cltvs: number[];
  incomingAmt: number;
  incomingCltv: number;
  feeBase: number;
  feePpm: number;
  cltvDelta: number;
}

function readRoute(sem: SemanticEvent[]): RouteInfo {
  const ev = sem.find((e) => e.kind === "route");
  const hops = (ev?.hops as Array<{ amt: number; cltv: number; size: number }> | undefined) ?? [
    { amt: 1_002_000, cltv: 700_040, size: 59 },
    { amt: 1_000_000, cltv: 700_000, size: 59 },
    { amt: 1_000_000, cltv: 700_000, size: 83 },
  ];
  return {
    sizes: hops.map((h) => h.size),
    amts: hops.map((h) => h.amt),
    cltvs: hops.map((h) => h.cltv),
    incomingAmt: (ev?.incomingAmt as number) ?? 1_004_002,
    incomingCltv: (ev?.incomingCltv as number) ?? 700_080,
    feeBase: (ev?.feeBase as number) ?? 1000,
    feePpm: (ev?.feePpm as number) ?? 1000,
    cltvDelta: (ev?.cltvDelta as number) ?? 40,
  };
}

export function buildSceneTimeline(trace: CapstoneTraceResult): SceneTimeline {
  const steps = trace.steps;
  const sem = trace.sem ?? [];
  const route = readRoute(sem);

  // Schematic widths: real hop payloads are tiny next to 1,300 bytes, so the
  // bar uses readable proportions (same convention as the chapter diagrams)
  // with true byte counts in the labels.
  const wOf = (n: number) => Math.max(12, Math.min(18, Math.round(8 + n / 11)));
  const W: Record<ForwarderId, number> = { bob: wOf(route.sizes[0]), charlie: wOf(route.sizes[1]), dave: wOf(route.sizes[2]) };
  const B: Record<ForwarderId, number> = { bob: route.sizes[0], charlie: route.sizes[1], dave: route.sizes[2] };
  const FILLER_W = W.bob + W.charlie;
  const FILLER_B = B.bob + B.charlie;
  const PAD_AFTER_D = 100 - W.dave;
  const PAD_CORE = PAD_AFTER_D - FILLER_W;

  const segPayload = (hop: ForwarderId, layers: ForwarderId[], opts: Partial<BufferSegment> = {}): BufferSegment =>
    ({ key: `p-${hop}`, kind: "payload", hop, layers: [...layers], widthPct: W[hop], byteLabel: `${B[hop]} B`, ...opts });
  const segPad = (widthPct: number, layers: ForwarderId[]): BufferSegment =>
    ({ key: "pad", kind: "pad", layers: [...layers], widthPct, byteLabel: "pad noise" });
  const segFiller = (widthPct: number, bytes: number, layers: ForwarderId[] = [], opts: Partial<BufferSegment> = {}): BufferSegment =>
    ({ key: "filler", kind: "filler", layers: [...layers], widthPct, byteLabel: `${bytes} B`, ...opts });
  const segExt = (): BufferSegment =>
    ({ key: "ext", kind: "ext", layers: [], widthPct: 26, byteLabel: "1,300 zero bytes" });

  // Build-phase buffer states (chapter 8 grammar).
  const stWrite: Array<() => BufferSegment[]> = [
    () => [segPayload("dave", [], { plaintext: true, emphasis: true }), segPad(PAD_AFTER_D, [])],
    () => [segPayload("charlie", [], { plaintext: true, emphasis: true }), segPayload("dave", ["dave"]), segPad(PAD_CORE, ["dave"]), segFiller(W.bob, B.bob)],
    () => [segPayload("bob", [], { plaintext: true, emphasis: true }), segPayload("charlie", ["charlie"]), segPayload("dave", ["dave", "charlie"]), segPad(PAD_CORE, ["dave", "charlie"])],
  ];
  const stXor: Array<() => BufferSegment[]> = [
    () => [segPayload("dave", ["dave"]), segPad(PAD_AFTER_D, ["dave"])],
    () => [segPayload("charlie", ["charlie"]), segPayload("dave", ["dave", "charlie"]), segPad(PAD_CORE, ["dave", "charlie"]), segFiller(W.bob, B.bob, ["charlie"])],
    () => [segPayload("bob", ["bob"]), segPayload("charlie", ["charlie", "bob"]), segPayload("dave", ["dave", "charlie", "bob"]), segPad(PAD_CORE, ["dave", "charlie", "bob"])],
  ];
  const stFillerOverlay = (): BufferSegment[] =>
    [segPayload("dave", ["dave"]), segPad(PAD_CORE, ["dave"]), segFiller(FILLER_W, FILLER_B, [], { emphasis: true })];

  // Forward-phase inbound states per forwarder index (chapter 9 grammar).
  const inboundFor = (i: number): BufferSegment[] => {
    if (i === 0) return stXor[2]();
    if (i === 1) return [segPayload("charlie", ["charlie"]), segPayload("dave", ["dave", "charlie"]), segPad(PAD_CORE, ["dave", "charlie"]), segFiller(W.bob, B.bob)];
    return [segPayload("dave", ["dave"]), segPad(PAD_CORE, ["dave"]), segFiller(FILLER_W, FILLER_B)];
  };
  const peeledFor = (i: number): BufferSegment[] => {
    const hop = FWD[i];
    return inboundFor(i).map((s) => ({
      ...s,
      layers: s.layers.filter((l) => l !== hop),
      plaintext: s.hop === hop ? true : s.plaintext,
      emphasis: s.hop === hop,
    }));
  };

  const frames: SceneFrame[] = [];
  const scenes: Scene[] = [];
  let cur: Scene | null = null;

  const bldSrc = trace.files[CAPSTONE_FILES.builder] ?? "";
  const fwdSrc = trace.files[CAPSTONE_FILES.forwarder] ?? "";
  const defLine = (src: string, fn: string) => {
    const i = src.split("\n").findIndex((l) => l.includes("def " + fn));
    return i >= 0 ? i + 1 : 1;
  };

  function open(s: { key: string; title: string; caption: string; stage: StageState; pinned?: Array<{ name: string; value: string }>; pinLocals?: string[] }) {
    if (cur) {
      cur.end = frames.length - 1;
      if (cur.end >= cur.start) scenes.push(cur);
    }
    cur = { ...s, pinned: s.pinned ?? [], pinLocals: s.pinLocals ?? [], start: frames.length, end: -1 };
  }
  function pushSyn(actor: HopId, fn: string, which: "builder" | "forwarder", note: string) {
    const file = which === "builder" ? CAPSTONE_FILES.builder : CAPSTONE_FILES.forwarder;
    frames.push({ actor, depth: 0, fn, file, line: defLine(which === "builder" ? bldSrc : fwdSrc, fn), synthetic: true, note });
  }
  const frameFromStep = (s: CapstoneTraceStep): SceneFrame => ({
    actor: s.actor, depth: s.depth ?? 0, file: s.file, line: s.line, fn: s.fn,
    locals: s.locals, globals: s.globals, ret: s.event === "return" ? s.ret : undefined,
  });

  // Fallback for traces without semantic events (older injected traces).
  if (!sem.length) {
    steps.forEach((s) => frames.push(frameFromStep(s)));
    const only: Scene = {
      key: "run", title: "Step through your code",
      caption: "Step through the run; the packet below is the one your build produced.",
      start: 0, end: Math.max(0, frames.length - 1),
      stage: { packetAt: "alice", view: "packet", byteField: "all", ephemeralLabel: "E_AB", outerHmacLabel: "bob_hmac" },
      pinned: [], pinLocals: [],
    };
    return { frames, scenes: [only], sceneOfFrame: frames.map(() => 0) };
  }

  const regionCoarse = (k: number): boolean => {
    const name = sem[k].kind.replace(/:call$/, "");
    for (let j = k + 1; j < sem.length; j++) if (sem[j].kind === name + ":return") return sem[j].step === sem[k].step;
    return true;
  };

  // Walker state.
  let mode: "idle" | "derive" | "filler" | "build" | "peelFine" | "peelCoarse" = "idle";
  let chainIdx = 0;
  let fillerIdx = 0;
  let wrapIdx = -1;
  let wrapCoarse = false;
  let wrapInProgress = false;
  let fwdIdx = -1;
  const reuseNote = (fn: string, hop: ForwarderId) =>
    `${NAME[hop]} runs the same ${fn} you wrote. Its values were shown the first time it ran.`;

  const chainState = (active: number): StageState => ({
    packetAt: "alice", view: "chain",
    chain: FWD.map((hop, i) => ({ hop, state: i < active ? "done" : i === active ? "active" : "todo" })),
  });

  function handle(ev: SemanticEvent, k: number) {
    const kind = ev.kind;
    if (kind === "route") return;

    if (kind === "build:call") {
      mode = "build";
      open({
        key: "begin", title: "Alice starts the build",
        caption: "Your build() runs first. Alice holds the session key and the route's node public keys, and everything else gets derived from them.",
        stage: chainState(-1), pinLocals: PIN_LOCALS.build,
      });
      return;
    }
    if (kind === "derive_shared_secrets:call") {
      mode = "derive"; chainIdx = 0;
      open({
        key: "chain-bob", title: "Shared secret · Bob",
        caption: "Alice runs ECDH between her ephemeral key and Bob's node public key. SHA256 of the shared point gives ss_AB.",
        stage: chainState(0), pinned: [{ name: "ephemeral", value: "E_AB = session_key · G" }], pinLocals: PIN_LOCALS.chain,
      });
      return;
    }
    if (kind === "ecdh" && mode === "derive") {
      chainIdx++;
      if (chainIdx === 1) {
        open({
          key: "chain-charlie", title: "Shared secret · Charlie",
          caption: "A blinding factor advances the chain: e_AC = bf_AB · e_AB. ECDH with Charlie's node key gives ss_AC.",
          stage: chainState(1), pinned: [{ name: "blinding", value: "bf_AB = SHA256(E_AB ‖ ss_AB)" }], pinLocals: PIN_LOCALS.chain,
        });
      } else if (chainIdx === 2) {
        open({
          key: "chain-dave", title: "Shared secret · Dave",
          caption: "One more advance gives e_AD, and ECDH with Dave's node key gives ss_AD. The final hop needs no blinding factor.",
          stage: chainState(2), pinLocals: PIN_LOCALS.chain,
        });
      }
      return;
    }
    if (kind === "derive_shared_secrets:return") {
      mode = "build";
      open({
        key: "chain-done", title: "Chain complete",
        caption: "Three shared secrets from one session key. Each forwarder will re-derive its own secret from the single ephemeral key in the packet header.",
        stage: { ...chainState(3), chain: FWD.map((hop) => ({ hop, state: "done" as const })) },
        pinned: [{ name: "secrets", value: "ss_AB · ss_AC · ss_AD" }], pinLocals: PIN_LOCALS.chain,
      });
      return;
    }
    if (kind === "generate_filler:call") {
      mode = "filler"; fillerIdx = 0;
      open({
        key: "filler-begin", title: "Filler · setup",
        caption: "Filler is precomputed before any wrapping. It pre-bakes the keystream bytes each forwarder's peel will manufacture past the end of the buffer.",
        stage: {
          packetAt: "alice", view: "buffer", bufferLabel: "filler (precomputed)",
          segments: [{ key: "filler", kind: "ext", layers: [], widthPct: 100, byteLabel: "0 B" }],
        },
        pinLocals: PIN_LOCALS.filler,
      });
      return;
    }
    if (kind === "keystream" && mode === "filler") {
      const hop = FWD[Math.min(fillerIdx, 1)];
      fillerIdx++;
      const grown = fillerIdx === 1 ? B.bob : FILLER_B;
      open({
        key: `filler-${hop}`, title: `Filler · ${NAME[hop]}'s slice`,
        caption: fillerIdx === 1
          ? `Append ${B.bob} zero bytes, then XOR in the trailing slice of Bob's extended keystream (1,300 + ${B.bob} bytes long).`
          : `Charlie's slice reaches back into his regular keystream region, stacking his layer onto Bob's bytes. Filler is now ${FILLER_B} bytes.`,
        stage: {
          packetAt: "alice", view: "buffer", bufferLabel: "filler (precomputed)",
          segments: [
            segFiller(fillerIdx === 1 ? 50 : 100, grown, [hop], { emphasis: true }),
            ...(fillerIdx === 1 ? [{ key: "rest", kind: "ext" as const, layers: [], widthPct: 50, byteLabel: "" }] : []),
          ],
          keystream: { label: `rho_${hop} keystream`, hop, bytes: (ev.length as number) ?? 1300 + B[hop], note: "extended past 1,300" },
        },
        pinned: [{ name: "keystream", value: `${fmt((ev.length as number) ?? 0)} B` }, { name: "filler", value: `${grown} B` }],
        pinLocals: PIN_LOCALS.filler,
      });
      return;
    }
    if (kind === "generate_filler:return") {
      mode = "build";
      open({
        key: "filler-done", title: "Filler ready",
        caption: `${(ev.fillerLen as number) ?? FILLER_B} bytes of filler, set aside until the innermost wrap.`,
        stage: {
          packetAt: "alice", view: "buffer", bufferLabel: "filler (precomputed)",
          segments: [segFiller(100, (ev.fillerLen as number) ?? FILLER_B)],
        },
        pinned: [{ name: "filler", value: `${(ev.fillerLen as number) ?? FILLER_B} B` }], pinLocals: PIN_LOCALS.filler,
      });
      return;
    }
    if (kind === "keystream" && ev.key === "pad") {
      open({
        key: "pad-init", title: "Buffer init · pad noise",
        caption: "The 1,300-byte buffer starts as ChaCha20 noise from the pad key, never zeros. Unused space must not reveal how long the route is.",
        stage: {
          packetAt: "alice", view: "buffer", bufferLabel: "hop_payloads · 1,300 B",
          segments: [segPad(100, [])], keystream: { label: "pad keystream", hop: null, bytes: 1300 },
          byteField: "hop_payloads",
        },
        pinned: [{ name: "pad_key", value: "HMAC('pad', session_key)" }], pinLocals: PIN_LOCALS.build,
      });
      return;
    }
    if (kind === "wrap_hop:call") {
      wrapIdx++;
      wrapInProgress = true;
      wrapCoarse = regionCoarse(k);
      const hop = (typeof ev.hop === "string" && (FWD as string[]).includes(ev.hop) ? ev.hop : WRAPS[Math.min(wrapIdx, 2)]) as ForwarderId;
      const idx = WRAPS.indexOf(hop);
      const inner = INNER_OF[hop];
      open({
        key: `wrap-${hop}-write`, title: `Wrap ${NAME[hop]} · shift + write`,
        caption: inner === null
          ? `Right-shift the buffer by ${B[hop]} bytes and write Dave's hop payload at the front: a bigsize LEN, the TLV records, and 32 zero bytes in the HMAC field, the destination signal.`
          : `Right-shift by ${B[hop]} bytes, dropping the trailing ${B[hop]} bytes, and write ${NAME[hop]}'s hop payload at the front. Its HMAC field carries ${inner}_hmac, committing to the layer beneath.`,
        stage: {
          packetAt: "alice", view: "buffer", bufferLabel: "hop_payloads · 1,300 B",
          segments: stWrite[idx](), byteField: "hop_payloads",
        },
        pinned: [
          { name: "payload", value: `${(ev.payloadLen as number) ?? B[hop] - 32} B + 32 B HMAC` },
          { name: "next_hmac", value: inner === null ? "32 zero bytes" : `${inner}_hmac` },
        ],
        pinLocals: PIN_LOCALS.wrap,
      });
      if (wrapCoarse) pushSyn("alice", "wrap_hop", "builder", reuseNote("wrap_hop", "dave"));
      return;
    }
    if (kind === "keystream" && wrapInProgress) {
      const hop = WRAPS[Math.min(wrapIdx, 2)];
      const idx = WRAPS.indexOf(hop);
      open({
        key: `wrap-${hop}-xor`, title: `Wrap ${NAME[hop]} · XOR`,
        caption: `XOR the entire 1,300-byte buffer with ${NAME[hop]}'s rho keystream. Every byte gains ${NAME[hop]}'s layer, including everything written on earlier iterations.`,
        stage: {
          packetAt: "alice", view: "buffer", bufferLabel: "hop_payloads · 1,300 B",
          segments: stXor[idx](), byteField: "hop_payloads",
          keystream: { label: `rho_${hop} keystream`, hop, bytes: 1300 },
        },
        pinned: [{ name: "keystream", value: `rho_${hop} · 1,300 B` }], pinLocals: PIN_LOCALS.wrap,
      });
      if (wrapCoarse) pushSyn("alice", "wrap_hop", "builder", reuseNote("wrap_hop", "dave"));
      return;
    }
    if (kind === "xor" && wrapInProgress && !wrapCoarse) {
      const hop = WRAPS[Math.min(wrapIdx, 2)];
      const idx = WRAPS.indexOf(hop);
      open({
        key: `wrap-${hop}-hmac`, title: `Wrap ${NAME[hop]} · HMAC`,
        caption: `Compute ${hop}_hmac with mu_${hop} over the encrypted buffer concatenated with the payment hash. It becomes the next iteration's next_hmac.`,
        stage: {
          packetAt: "alice", view: "buffer", bufferLabel: "hop_payloads · 1,300 B",
          segments: stXor[idx](), byteField: "hop_payloads",
          hmac: { label: `${hop}_hmac`, state: "computing" },
        },
        pinLocals: PIN_LOCALS.wrap,
      });
      return;
    }
    if (kind === "wrap_hop:return") {
      wrapInProgress = false;
      const hop = (typeof ev.hop === "string" && (FWD as string[]).includes(ev.hop) ? ev.hop : WRAPS[Math.min(wrapIdx, 2)]) as ForwarderId;
      const idx = WRAPS.indexOf(hop);
      if (wrapCoarse) {
        open({
          key: `wrap-${hop}-hmac`, title: `Wrap ${NAME[hop]} · HMAC`,
          caption: `Compute ${hop}_hmac with mu_${hop} over the encrypted buffer and the payment hash. ${NAME[hop]}'s layer is sealed.`,
          stage: {
            packetAt: "alice", view: "buffer", bufferLabel: "hop_payloads · 1,300 B",
            segments: stXor[idx](), byteField: "hop_payloads",
            hmac: { label: `${hop}_hmac`, state: "ok" },
          },
          pinned: typeof ev.tag === "string" ? [{ name: "tag", value: `${ev.tag}…` }] : [],
          pinLocals: PIN_LOCALS.wrap,
        });
        pushSyn("alice", "wrap_hop", "builder", reuseNote("wrap_hop", "dave"));
      } else {
        if (cur && typeof ev.tag === "string") cur.pinned.push({ name: "tag", value: `${ev.tag}…` });
        if (idx === 0) {
          open({
            key: "filler-overlay", title: "Filler overlay",
            caption: `Overwrite the trailing ${FILLER_B} bytes with the precomputed filler, then recompute dave_hmac over the corrected buffer. This happens only on the innermost wrap.`,
            stage: {
              packetAt: "alice", view: "buffer", bufferLabel: "hop_payloads · 1,300 B",
              segments: stFillerOverlay(), byteField: "hop_payloads",
              hmac: { label: "dave_hmac (recomputed)", state: "computing" },
            },
            pinned: [{ name: "filler", value: `${FILLER_B} B` }], pinLocals: PIN_LOCALS.build,
          });
        }
      }
      return;
    }
    if (kind === "build:return") {
      mode = "idle";
      open({
        key: "assemble", title: "Assemble the packet",
        caption: "The packet ships as version 0x00, ephemeral key E_AB, the 1,300-byte hop_payloads, and bob_hmac as the outer tag. 1,366 bytes exactly.",
        stage: {
          packetAt: "alice", view: "packet", byteField: "all",
          ephemeralLabel: "E_AB", outerHmacLabel: "bob_hmac",
        },
        pinned: [{ name: "packet", value: `${fmt((ev.packetLen as number) ?? 1366)} B` }],
        pinLocals: PIN_LOCALS.build,
      });
      pushSyn("alice", "build", "builder", "Alice's build is complete. The 1,366-byte packet heads to Bob.");
      return;
    }
    if (kind === "received") {
      fwdIdx++;
      const hop = FWD[Math.min(fwdIdx, 2)];
      const from: HopId = fwdIdx === 0 ? "alice" : FWD[fwdIdx - 1];
      open({
        key: `transit-${hop}`, title: `To ${NAME[hop]}`,
        caption: `${NAME[hop]} receives the 1,366-byte packet. Every packet on the wire is the same size, no matter how many hops remain.`,
        stage: {
          packetAt: from, transitTo: hop, view: "packet", byteField: "all",
          ephemeralLabel: E_LABEL[hop], outerHmacLabel: `${hop}_hmac`,
        },
      });
      pushSyn(hop, "verify_hmac", "forwarder", `The packet arrives at ${NAME[hop]}.`);
      return;
    }
    if (kind === "verify_hmac:call") {
      const hop = FWD[Math.min(fwdIdx, 2)];
      const coarse = regionCoarse(k);
      open({
        key: `verify-${hop}`, title: `${NAME[hop]} · verify HMAC`,
        caption: `${NAME[hop]} recomputes HMAC-SHA256 with mu_${hop} over hop_payloads and the payment hash, then compares it to the packet's outer tag before touching anything else.`,
        stage: {
          packetAt: hop, view: "packet", byteField: "hmac",
          ephemeralLabel: E_LABEL[hop], outerHmacLabel: `${hop}_hmac`,
          hmac: { label: `${hop}_hmac`, state: "computing" },
        },
        pinned: typeof ev.mu === "string" ? [{ name: "mu", value: ev.mu }] : [],
        pinLocals: PIN_LOCALS.verify,
      });
      if (coarse) pushSyn(hop, "verify_hmac", "forwarder", reuseNote("verify_hmac", hop));
      return;
    }
    if (kind === "verify_hmac:return") {
      if (cur && cur.stage.hmac) {
        cur.stage = { ...cur.stage, hmac: { ...cur.stage.hmac, state: ev.ok === false ? "fail" : "ok" } };
        cur.pinned.push({ name: "result", value: ev.ok === false ? "HMAC mismatch" : "valid" });
      }
      return;
    }
    if (kind === "peel_layer:call") {
      const hop = FWD[Math.min(fwdIdx, 2)];
      const i = Math.min(fwdIdx, 2);
      const coarse = regionCoarse(k);
      mode = coarse ? "peelCoarse" : "peelFine";
      if (coarse) {
        open({
          key: `peel-${hop}-xor`, title: `${NAME[hop]} · peel`,
          caption: `${NAME[hop]} peels with the same peel_layer you wrote. One XOR strips ${NAME[hop]}'s layer from every byte, and ${hop === "dave" ? "his" : "his own"} hop payload turns plaintext at the front.`,
          stage: {
            packetAt: hop, view: "buffer", bufferLabel: "working buffer",
            segments: peeledFor(i), byteField: "hop_payloads",
            keystream: { label: `rho_${hop} keystream`, hop, bytes: 2600, note: "2 × 1,300" },
          },
          pinLocals: PIN_LOCALS.peel,
        });
        pushSyn(hop, "peel_layer", "forwarder", reuseNote("peel_layer", hop));
      } else {
        open({
          key: `peel-${hop}-parse`, title: `${NAME[hop]} · parse`,
          caption: `${NAME[hop]} splits the packet into its four fields: version, ${E_LABEL[hop]}, the 1,300-byte hop_payloads, and the outer HMAC.`,
          stage: {
            packetAt: hop, view: "packet", byteField: "ephemeral",
            ephemeralLabel: E_LABEL[hop], outerHmacLabel: `${hop}_hmac`,
          },
          pinLocals: PIN_LOCALS.peel,
        });
      }
      return;
    }
    if (kind === "ecdh" && mode === "peelFine") {
      const hop = FWD[Math.min(fwdIdx, 2)];
      const i = Math.min(fwdIdx, 2);
      open({
        key: `peel-${hop}-derive`, title: `${NAME[hop]} · derive keys`,
        caption: `ECDH with ${NAME[hop]}'s node private key recovers the same shared secret Alice derived. From it, rho_${hop}.`,
        stage: {
          packetAt: hop, view: "buffer", bufferLabel: "hop_payloads · 1,300 B",
          segments: inboundFor(i), byteField: "hop_payloads",
        },
        pinned: [{ name: "ss", value: `ECDH(${hop}_priv, ${E_LABEL[hop]})` }],
        pinLocals: PIN_LOCALS.peel,
      });
      return;
    }
    if (kind === "keystream" && mode === "peelFine") {
      const hop = FWD[Math.min(fwdIdx, 2)];
      const i = Math.min(fwdIdx, 2);
      open({
        key: `peel-${hop}-extend`, title: `${NAME[hop]} · extend + XOR`,
        caption: "Append 1,300 zero bytes, then XOR the whole 2,600-byte working buffer with the extended rho keystream. The tail past 1,300 becomes the regenerated filler bytes.",
        stage: {
          packetAt: hop, view: "buffer", bufferLabel: "working buffer · 2,600 B",
          segments: [...inboundFor(i), segExt()], byteField: "hop_payloads",
          keystream: { label: `rho_${hop} keystream`, hop, bytes: (ev.length as number) ?? 2600, note: "2 × 1,300" },
        },
        pinned: [{ name: "keystream", value: `${fmt((ev.length as number) ?? 2600)} B` }],
        pinLocals: PIN_LOCALS.peel,
      });
      return;
    }
    if (kind === "xor" && mode === "peelFine") {
      const hop = FWD[Math.min(fwdIdx, 2)];
      const i = Math.min(fwdIdx, 2);
      const next = INNER_OF[hop] === null ? null : FWD[i + 1];
      open({
        key: `peel-${hop}-read`, title: `${NAME[hop]} · read + lift`,
        caption: next
          ? `${NAME[hop]}'s hop payload is plaintext at the front. He reads his TLV records, lifts ${next}_hmac from the HMAC field, and slides the next 1,300 bytes forward.`
          : "Dave's hop payload is plaintext at the front, with a type-8 payment_data record and an all-zero HMAC field.",
        stage: {
          packetAt: hop, view: "buffer", bufferLabel: "working buffer · 2,600 B",
          segments: [...peeledFor(i), { ...segExt(), byteLabel: "keystream tail", kind: "filler" as const }],
          byteField: "hop_payloads",
          hmac: next ? { label: `${next}_hmac (lifted)`, state: "ok" } : undefined,
        },
        pinLocals: PIN_LOCALS.peel,
      });
      return;
    }
    if (kind === "peel_layer:return") {
      const hop = FWD[Math.min(fwdIdx, 2)];
      const i = Math.min(fwdIdx, 2);
      const fine = mode === "peelFine";
      mode = "idle";
      if (hop === "dave") {
        open({
          key: "peel-dave-read", title: "Dave · destination",
          caption: "No short_channel_id record, a payment_data record instead: Dave is the destination. There is nothing left to forward.",
          stage: {
            packetAt: "dave", view: "buffer", bufferLabel: "Dave's view",
            segments: peeledFor(2), byteField: "hop_payloads",
          },
          pinned: [{ name: "payload", value: `${(ev.payloadLen as number) ?? B.dave - 32} B (type 8 inside)` }],
          pinLocals: PIN_LOCALS.peel,
        });
        pushSyn("dave", "peel_layer", "forwarder", "Dave reads payment_data from his hop payload.");
        return;
      }
      const next = FWD[i + 1];
      open({
        key: `peel-${hop}-out`, title: `${NAME[hop]} · forward packet`,
        caption: `${NAME[hop]} assembles the outgoing packet: ${E_LABEL[next]} in the header, the lifted 1,300 bytes as hop_payloads, ${next}_hmac as the outer tag. Still 1,366 bytes.`,
        stage: {
          packetAt: hop, view: "packet", byteField: "all",
          ephemeralLabel: E_LABEL[next], outerHmacLabel: `${next}_hmac`,
        },
        pinLocals: PIN_LOCALS.peel,
      });
      pushSyn(
        hop, "peel_layer", "forwarder",
        fine
          ? `${NAME[hop]} assembles the outgoing 1,366-byte packet from the pieces peel_layer returned.`
          : reuseNote("peel_layer", hop),
      );
      return;
    }
    if (kind === "check_forward:call") {
      const hop = FWD[Math.min(fwdIdx, 2)] as ForwarderId;
      const coarse = regionCoarse(k);
      const amt = (ev.amt as number) ?? route.amts[fwdIdx];
      const cltv = (ev.cltv as number) ?? route.cltvs[fwdIdx];
      const incomingAmt = (ev.incomingAmt as number) ?? route.incomingAmt;
      const incomingCltv = (ev.incomingCltv as number) ?? route.incomingCltv;
      const requiredFee = route.feeBase + Math.floor((amt * route.feePpm) / 1_000_000);
      open({
        key: `policy-${hop}`, title: `${NAME[hop]} · policy check`,
        caption: `${NAME[hop]} re-checks chapter 2's math in the forward direction: the incoming HTLC must cover his advertised fee, and the CLTV gap must leave his ${route.cltvDelta}-block cushion. Both pass.`,
        stage: {
          packetAt: hop, view: "policy",
          policy: { hop, incomingAmt, amt, requiredFee, incomingCltv, cltv, delta: route.cltvDelta },
        },
        pinned: [
          { name: "fee", value: `${fmt(incomingAmt - amt)} ≥ ${fmt(requiredFee)} msat` },
          { name: "cltv", value: `${fmt(incomingCltv - cltv)} ≥ ${route.cltvDelta} blocks` },
        ],
        pinLocals: PIN_LOCALS.policy,
      });
      if (coarse) pushSyn(hop, "check_forward", "forwarder", reuseNote("check_forward", hop));
      return;
    }
    if (kind === "delivered") {
      open({
        key: "delivered", title: "Payment delivered",
        caption: `Dave received ${fmt((ev.amt as number) ?? route.amts[2])} msat. Every byte that carried it there, the chain, the filler, the wraps, the peels, came from functions you wrote.`,
        stage: { packetAt: "dave", view: "deliver", deliverAmt: (ev.amt as number) ?? route.amts[2] },
        pinned: [{ name: "amount", value: `${fmt((ev.amt as number) ?? route.amts[2])} msat` }],
      });
      pushSyn("dave", "check_forward", "forwarder", "Dave claims the payment against his invoice. The route settles backward from here.");
      return;
    }
    // check_forward:return, forwarded, stray xor/keystream/ecdh: no scene change.
  }

  // Events are monotonic by step (the harness stamps them with len(_steps)),
  // so fire everything scheduled at index i before appending step i.
  let evIdx = 0;
  for (let i = 0; i <= steps.length; i++) {
    while (evIdx < sem.length && sem[evIdx].step === i) {
      handle(sem[evIdx], evIdx);
      evIdx++;
    }
    if (i < steps.length) frames.push(frameFromStep(steps[i]));
  }
  while (evIdx < sem.length) {
    handle(sem[evIdx], evIdx);
    evIdx++;
  }
  if (cur) {
    const last = cur as Scene;
    last.end = frames.length - 1;
    if (last.end >= last.start) scenes.push(last);
  }

  const sceneOfFrame = frames.map(() => 0);
  scenes.forEach((s, si) => {
    for (let f = s.start; f <= s.end && f < frames.length; f++) sceneOfFrame[f] = si;
  });

  return { frames, scenes, sceneOfFrame };
}
