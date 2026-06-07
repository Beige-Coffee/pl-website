import { useEffect, useMemo, useRef, useState } from "react";
import { StepCaption } from "./StepCaption";

// ────────────────────────────────────────────────────────────────────────────
// XorEncryptionDemo, two-tab interactive (rebuild 2026-05-08)
//
// ALICE tab: edit Bob's TLV hop payload, click Encrypt; ciphertext bytes appear
// left-to-right in a gold wave. Final state shows a copyable hex string of
// the 23-byte ciphertext.
//
// BOB tab: paste hex (from Alice or anywhere). The bytes parse into the
// ciphertext row as you type. Click Decrypt; same XOR runs against the
// keystream and plaintext bytes appear left-to-right. Once complete, the
// recovered bytes are decoded back into Bob's TLV record (amt_to_forward,
// outgoing_cltv, short_channel_id) so the round-trip is concrete.
//
// Same keystream both ways. Same XOR. The copy/paste literally simulates
// the wire transmission.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type Tab = "alice" | "bob";
type Direction = "forward" | null;

const KEYSTREAM = [
  0x8c, 0x5f, 0xa3, 0x19, 0xed, 0x24, 0x7b, 0xce, 0x02, 0x91, 0x47, 0x6a, 0xed,
  0x2c, 0x88, 0x71, 0x4a, 0xfc, 0x19, 0xa3, 0x5d, 0x71, 0xc4,
];
const TOTAL_BYTES = KEYSTREAM.length;

const SCID_BYTES = [0x00, 0x0a, 0xae, 0x60, 0x00, 0x00, 0x01, 0x00];
const DEFAULT_SCID = "700000:1:0";

// BOLT 7 short_channel_id: "block:tx:output", encoded as 8 bytes
//   3 bytes block_height || 3 bytes tx_index || 2 bytes output_index
function parseSCID(input: string): { bytes: number[] | null; valid: boolean } {
  const parts = input.split(":").map((s) => s.trim());
  if (parts.length !== 3) return { bytes: null, valid: false };
  const block = parseInt(parts[0], 10);
  const tx = parseInt(parts[1], 10);
  const out = parseInt(parts[2], 10);
  if (
    !Number.isFinite(block) ||
    !Number.isFinite(tx) ||
    !Number.isFinite(out)
  )
    return { bytes: null, valid: false };
  if (block < 0 || block > 0xffffff) return { bytes: null, valid: false };
  if (tx < 0 || tx > 0xffffff) return { bytes: null, valid: false };
  if (out < 0 || out > 0xffff) return { bytes: null, valid: false };
  return {
    bytes: [
      (block >> 16) & 0xff,
      (block >> 8) & 0xff,
      block & 0xff,
      (tx >> 16) & 0xff,
      (tx >> 8) & 0xff,
      tx & 0xff,
      (out >> 8) & 0xff,
      out & 0xff,
    ],
    valid: true,
  };
}
const MAX_AMT = 1099511627775;
const MAX_CLTV = 16777215;

const PLAIN_FILL = "#dbeafe";
const PLAIN_STROKE = "#3b6aa0";
const KEY_FILL = "#fef3c7";
const KEY_STROKE = "#b8860b";
const CIPHER_FILL = "#fde7e7";
const CIPHER_STROKE = "#a13a3a";
const ACTIVE_GOLD = "#b8860b";
const ALICE_HOP = "#b8860b";
const BOB_HOP = "#3b6aa0";

const FORWARD_MS = 70;

// ── helpers ─────────────────────────────────────────────────────────────────

function uintToBytes(n: number, byteLen: number): number[] {
  const out: number[] = [];
  for (let i = byteLen - 1; i >= 0; i--) {
    out.push(Math.floor(n / Math.pow(256, i)) & 0xff);
  }
  return out;
}

function bytesToUint(bytes: number[]): number {
  return bytes.reduce((acc, b) => acc * 256 + b, 0);
}

function computePlaintextBytes(
  amt: number,
  cltv: number,
  scidBytes: number[],
): number[] {
  const amtBytes = uintToBytes(amt, 5);
  const cltvBytes = uintToBytes(cltv, 3);
  return [
    0x16,
    0x02, 0x05, ...amtBytes,
    0x04, 0x03, ...cltvBytes,
    0x06, 0x08, ...scidBytes,
  ];
}

function bytesToHex(bytes: number[], grouped = false): string {
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0"));
  return grouped ? hex.join(" ") : hex.join("");
}

type ParseStatus =
  | "empty"
  | "valid"
  | "too_few"
  | "too_many"
  | "non_hex"
  | "odd";

type ParseResult = {
  bytes: number[];
  status: ParseStatus;
  message: string;
};

function parseHex(input: string): ParseResult {
  const cleaned = input
    .replace(/\s/g, "")
    .replace(/0x/gi, "")
    .replace(/[,;:]/g, "")
    .toLowerCase();
  if (cleaned.length === 0) {
    return {
      bytes: [],
      status: "empty",
      message: "paste 46 hex characters above to load Alice's ciphertext",
    };
  }
  if (!/^[0-9a-f]*$/.test(cleaned)) {
    return {
      bytes: [],
      status: "non_hex",
      message: "input contains non-hex characters",
    };
  }
  if (cleaned.length % 2 !== 0) {
    const evenLen = cleaned.length - 1;
    const bytes: number[] = [];
    for (let i = 0; i < evenLen; i += 2) {
      bytes.push(parseInt(cleaned.substr(i, 2), 16));
    }
    return {
      bytes,
      status: "odd",
      message: `last hex char is unpaired (${cleaned.length} chars total)`,
    };
  }
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes.push(parseInt(cleaned.substr(i, 2), 16));
  }
  if (bytes.length < TOTAL_BYTES) {
    return {
      bytes,
      status: "too_few",
      message: `need ${TOTAL_BYTES * 2 - cleaned.length} more hex chars (${bytes.length}/${TOTAL_BYTES} bytes)`,
    };
  }
  if (bytes.length > TOTAL_BYTES) {
    return {
      bytes: bytes.slice(0, TOTAL_BYTES),
      status: "too_many",
      message: `trimmed to first ${TOTAL_BYTES} bytes (input had ${bytes.length})`,
    };
  }
  return { bytes, status: "valid", message: `✓ ${TOTAL_BYTES} bytes parsed` };
}

type DecodedTlv = {
  amt: number | null;
  cltv: number | null;
  scid: string | null;
  valid: boolean;
};

function decodeTLV(bytes: number[]): DecodedTlv {
  const fail: DecodedTlv = { amt: null, cltv: null, scid: null, valid: false };
  if (bytes.length !== TOTAL_BYTES) return fail;
  if (bytes[0] !== 0x16) return fail;
  if (bytes[1] !== 0x02 || bytes[2] !== 0x05) return fail;
  if (bytes[8] !== 0x04 || bytes[9] !== 0x03) return fail;
  if (bytes[13] !== 0x06 || bytes[14] !== 0x08) return fail;
  const amt = bytesToUint(bytes.slice(3, 8));
  const cltv = bytesToUint(bytes.slice(10, 13));
  const scid = bytes.slice(15, 23);
  const block = (scid[0] << 16) | (scid[1] << 8) | scid[2];
  const tx = (scid[3] << 16) | (scid[4] << 8) | scid[5];
  const out = (scid[6] << 8) | scid[7];
  return { amt, cltv, scid: `${block}:${tx}:${out}`, valid: true };
}

type ByteRegion = "lenPrefix" | "amtTlv" | "cltvTlv" | "scidTlv";
const BYTE_REGIONS: ByteRegion[] = [
  "lenPrefix",
  "amtTlv", "amtTlv", "amtTlv", "amtTlv", "amtTlv", "amtTlv", "amtTlv",
  "cltvTlv", "cltvTlv", "cltvTlv", "cltvTlv", "cltvTlv",
  "scidTlv", "scidTlv", "scidTlv", "scidTlv", "scidTlv", "scidTlv", "scidTlv", "scidTlv", "scidTlv", "scidTlv",
];
const REGION_TINT: Record<ByteRegion, string> = {
  lenPrefix: "#fef3c7",
  amtTlv: "#dbeafe",
  cltvTlv: "#ccece8",
  scidTlv: "#ede1f3",
};
const REGION_BORDER: Record<ByteRegion, string> = {
  lenPrefix: "#b8860b",
  amtTlv: "#3b6aa0",
  cltvTlv: "#2d7a7a",
  scidTlv: "#7b4b8a",
};

// ── main component ──────────────────────────────────────────────────────────

export function XorEncryptionDemo() {
  const [tab, setTab] = useState<Tab>("alice");

  // Alice state
  const [amt, setAmt] = useState(10001000);
  const [cltv, setCltv] = useState(220);
  const [scidStr, setScidStr] = useState(DEFAULT_SCID);
  const scidParsed = useMemo(() => parseSCID(scidStr), [scidStr]);
  // If the user types something invalid, freeze the encoded bytes at the
  // last good value so the byte row doesn't churn, but still flag the
  // input as invalid in the card.
  const lastGoodScidRef = useRef<number[]>(SCID_BYTES);
  if (scidParsed.bytes) lastGoodScidRef.current = scidParsed.bytes;
  const scidBytes = lastGoodScidRef.current;
  const [aliceEncrypted, setAliceEncrypted] = useState(false);
  const [aliceRevealed, setAliceRevealed] = useState(0);
  const [aliceDir, setAliceDir] = useState<Direction>(null);
  const [copied, setCopied] = useState(false);

  // Bob state
  const [pastedHex, setPastedHex] = useState("");
  const [bobDecrypted, setBobDecrypted] = useState(false);
  const [bobRevealed, setBobRevealed] = useState(0);
  const [bobDir, setBobDir] = useState<Direction>(null);

  const aliceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bobTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const plaintext = useMemo(
    () => computePlaintextBytes(amt, cltv, scidBytes),
    [amt, cltv, scidBytes],
  );
  const aliceCiphertext = useMemo(
    () => plaintext.map((b, i) => b ^ KEYSTREAM[i]),
    [plaintext],
  );
  const aliceCipherHex = useMemo(
    () => bytesToHex(aliceCiphertext),
    [aliceCiphertext],
  );

  const parsed = useMemo(() => parseHex(pastedHex), [pastedHex]);
  const cipherValid = parsed.bytes.length === TOTAL_BYTES;
  const bobPlaintext = useMemo(() => {
    if (!cipherValid) return new Array(TOTAL_BYTES).fill(0);
    return parsed.bytes.map((b, i) => b ^ KEYSTREAM[i]);
  }, [parsed, cipherValid]);
  const bobDecoded = useMemo(() => decodeTLV(bobPlaintext), [bobPlaintext]);

  // Alice animation: encrypt sweep
  useEffect(() => {
    if (aliceDir !== "forward") return;
    if (aliceRevealed >= TOTAL_BYTES) {
      setAliceEncrypted(true);
      setAliceDir(null);
      return;
    }
    aliceTimerRef.current = setTimeout(
      () => setAliceRevealed((c) => c + 1),
      FORWARD_MS,
    );
    return () => {
      if (aliceTimerRef.current) clearTimeout(aliceTimerRef.current);
    };
  }, [aliceDir, aliceRevealed]);

  // Bob animation: decrypt sweep
  useEffect(() => {
    if (bobDir !== "forward") return;
    if (bobRevealed >= TOTAL_BYTES) {
      setBobDecrypted(true);
      setBobDir(null);
      return;
    }
    bobTimerRef.current = setTimeout(
      () => setBobRevealed((c) => c + 1),
      FORWARD_MS,
    );
    return () => {
      if (bobTimerRef.current) clearTimeout(bobTimerRef.current);
    };
  }, [bobDir, bobRevealed]);

  useEffect(() => {
    return () => {
      if (aliceTimerRef.current) clearTimeout(aliceTimerRef.current);
      if (bobTimerRef.current) clearTimeout(bobTimerRef.current);
    };
  }, []);

  // Alice actions
  const startEncrypt = () => {
    if (aliceDir !== null) return;
    setAliceRevealed(0);
    setAliceEncrypted(false);
    setCopied(false);
    setAliceDir("forward");
  };
  const resetAlice = () => {
    if (aliceTimerRef.current) clearTimeout(aliceTimerRef.current);
    setAliceRevealed(0);
    setAliceEncrypted(false);
    setAliceDir(null);
    setCopied(false);
  };
  const copyCipher = async () => {
    try {
      await navigator.clipboard.writeText(aliceCipherHex);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = aliceCipherHex;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // give up silently; the hex is still selectable on screen
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Bob actions
  const startDecrypt = () => {
    if (bobDir !== null || !cipherValid) return;
    setBobRevealed(0);
    setBobDecrypted(false);
    setBobDir("forward");
  };
  const resetBob = () => {
    if (bobTimerRef.current) clearTimeout(bobTimerRef.current);
    setBobRevealed(0);
    setBobDecrypted(false);
    setBobDir(null);
    setPastedHex("");
  };

  const aliceAnimating = aliceDir !== null;
  const aliceActiveCol = aliceDir === "forward" ? aliceRevealed - 1 : null;
  const bobAnimating = bobDir !== null;
  const bobActiveCol = bobDir === "forward" ? bobRevealed - 1 : null;

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="xor-encryption"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">
          XOR encryption, try it
        </span>
      </div>

      {/* Tab bar */}
      <div
        className="flex flex-wrap items-center border-b-[1.5px]"
        style={{
          background: "#f8f5ec",
          borderColor: "rgba(15,23,42,0.15)",
        }}
      >
        <TabButton
          active={tab === "alice"}
          color={ALICE_HOP}
          onClick={() => setTab("alice")}
          label="Alice, encrypt"
          letter="A"
          ready={aliceEncrypted}
        />
        <TabButton
          active={tab === "bob"}
          color={BOB_HOP}
          onClick={() => setTab("bob")}
          label="Bob, decrypt"
          letter="B"
          ready={bobDecrypted}
        />
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-5"
        style={{ minHeight: 420 }}
      >
        {tab === "alice" ? (
          <AliceTab
            amt={amt}
            setAmt={setAmt}
            cltv={cltv}
            setCltv={setCltv}
            scidStr={scidStr}
            setScidStr={setScidStr}
            scidValid={scidParsed.valid}
            plaintext={plaintext}
            ciphertext={aliceCiphertext}
            encrypted={aliceEncrypted}
            revealed={aliceRevealed}
            isAnimating={aliceAnimating}
            activeColumn={aliceActiveCol}
            copied={copied}
            onEncrypt={startEncrypt}
            onReset={resetAlice}
            onCopy={copyCipher}
            onSwitchToBob={() => setTab("bob")}
          />
        ) : (
          <BobTab
            pastedHex={pastedHex}
            setPastedHex={setPastedHex}
            parsed={parsed}
            cipherValid={cipherValid}
            plaintext={bobPlaintext}
            decoded={bobDecoded}
            decrypted={bobDecrypted}
            revealed={bobRevealed}
            isAnimating={bobAnimating}
            activeColumn={bobActiveCol}
            onDecrypt={startDecrypt}
            onReset={resetBob}
          />
        )}
      </div>

      <style>{`
        @keyframes byte-pop {
          0% { transform: scale(0.2); }
          60% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        @keyframes panel-slide {
          0% { transform: translateY(-6px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes byte-edit-pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(184,134,11,0); }
          40% { transform: scale(1.18); box-shadow: 0 0 0 3px rgba(184,134,11,0.55), 0 0 12px rgba(184,134,11,0.55); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(184,134,11,0); }
        }
      `}</style>
    </div>
  );
}

// ── Alice tab ───────────────────────────────────────────────────────────────

function AliceTab(props: {
  amt: number;
  setAmt: (n: number) => void;
  cltv: number;
  setCltv: (n: number) => void;
  scidStr: string;
  setScidStr: (s: string) => void;
  scidValid: boolean;
  plaintext: number[];
  ciphertext: number[];
  encrypted: boolean;
  revealed: number;
  isAnimating: boolean;
  activeColumn: number | null;
  copied: boolean;
  onEncrypt: () => void;
  onReset: () => void;
  onCopy: () => void;
  onSwitchToBob: () => void;
}) {
  const {
    amt,
    setAmt,
    cltv,
    setCltv,
    scidStr,
    setScidStr,
    scidValid,
    plaintext,
    ciphertext,
    encrypted,
    revealed,
    isAnimating,
    activeColumn,
    copied,
    onEncrypt,
    onReset,
    onCopy,
    onSwitchToBob,
  } = props;

  const showCipherRow = encrypted || isAnimating;

  // Track which bytes just changed so we can pulse them when the user
  // edits a value. Compares the current plaintext to the previous render.
  const prevPlaintextRef = useRef<number[]>(plaintext);
  const [pulseIndices, setPulseIndices] = useState<Set<number>>(new Set());
  useEffect(() => {
    const prev = prevPlaintextRef.current;
    const changed = new Set<number>();
    for (let i = 0; i < plaintext.length; i++) {
      if (prev[i] !== plaintext[i]) changed.add(i);
    }
    if (changed.size > 0) {
      setPulseIndices(changed);
      const t = setTimeout(() => setPulseIndices(new Set()), 450);
      prevPlaintextRef.current = plaintext;
      return () => clearTimeout(t);
    }
    prevPlaintextRef.current = plaintext;
  }, [plaintext]);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 760 }}>
        {/* Protocol-message card. The values look like fields in a wire
            protocol message (think update_add_htlc or similar): each row
            is color-coded to match the bytes it produces in the plaintext
            row directly below. Editing a value pulses the corresponding
            bytes so you can see the encoding in flight. */}
        <ProtocolMessageCard
          amt={amt}
          setAmt={setAmt}
          cltv={cltv}
          setCltv={setCltv}
          scidStr={scidStr}
          setScidStr={setScidStr}
          scidValid={scidValid}
          isAnimating={isAnimating}
        />

        {/* Connector arrow into the plaintext row */}
        <div
          className="flex items-center justify-center"
          style={{ marginTop: 6, marginBottom: 8 }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 700,
              color: "#475569",
              letterSpacing: "0.05em",
              padding: "3px 12px",
              border: "1.5px solid rgba(15,23,42,0.35)",
              background: "#fffdf5",
              textTransform: "uppercase",
            }}
          >
            ↓ encoded as TLV bytes ↓
          </div>
        </div>

        {/* PLAINTEXT row, region-tinted so each section maps back to a
            field in the protocol message above. */}
        <ByteRow
          label="PLAINTEXT"
          bytes={plaintext}
          fill={PLAIN_FILL}
          stroke={PLAIN_STROKE}
          regionColors
          activeColumn={activeColumn}
          pulseIndices={pulseIndices}
        />

        <OperatorRow op="⊕" />

        {/* KEYSTREAM row */}
        <ByteRow
          label="KEYSTREAM"
          bytes={KEYSTREAM}
          fill={KEY_FILL}
          stroke={KEY_STROKE}
          activeColumn={activeColumn}
        />

        {/* CIPHERTEXT row, slides in */}
        <div
          style={{
            overflow: "visible",
            maxHeight: showCipherRow ? 90 : 0,
            opacity: showCipherRow ? 1 : 0,
            transition:
              "max-height 400ms ease-out, opacity 300ms ease-out, margin-top 400ms ease-out",
            marginTop: showCipherRow ? 6 : 0,
            pointerEvents: showCipherRow ? "auto" : "none",
          }}
        >
          <OperatorRow op="=" />
          <ByteRow
            label="CIPHERTEXT"
            bytes={ciphertext}
            fill={CIPHER_FILL}
            stroke={CIPHER_STROKE}
            revealedCount={revealed}
            totalCount={TOTAL_BYTES}
            activeColumn={activeColumn}
            popOnReveal
          />
        </div>

        {/* Buttons */}
        <div className="mt-5 flex flex-col items-center gap-2.5">
          <div className="flex flex-wrap gap-2 items-center justify-center">
            <button
              type="button"
              onClick={onEncrypt}
              disabled={isAnimating}
              className="px-5 py-2 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.08em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: MONO }}
              data-testid="xor-encrypt"
            >
              {encrypted ? "↻ Re-encrypt" : "▶ Encrypt"}
            </button>
            {encrypted && !isAnimating && (
              <>
                <button
                  type="button"
                  onClick={onCopy}
                  className="border-[1.5px] px-3 py-2 transition-colors"
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    background: copied ? "#10b981" : "#fff",
                    borderColor: copied ? "#10b981" : ALICE_HOP,
                    color: copied ? "#fff" : ALICE_HOP,
                    cursor: "pointer",
                    animation: "panel-slide 300ms ease-out",
                  }}
                  data-testid="xor-copy"
                >
                  {copied ? "✓ Copied" : "📋 Copy ciphertext"}
                </button>
                <button
                  type="button"
                  onClick={onSwitchToBob}
                  className="border-[1.5px] px-3 py-2 transition-colors hover:bg-card"
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    background: "transparent",
                    borderColor: BOB_HOP,
                    color: BOB_HOP,
                    cursor: "pointer",
                    animation: "panel-slide 300ms ease-out",
                  }}
                >
                  → Bob tab
                </button>
              </>
            )}
          </div>
        </div>

        <StepCaption
          label={
            isAnimating
              ? "Alice · encrypting"
              : encrypted
                ? "Alice · on the wire"
                : "Alice · plaintext"
          }
          accentColor={ALICE_HOP}
          caption={
            isAnimating ? (
              <>
                <strong style={{ color: ACTIVE_GOLD }}>Encrypting…</strong>{" "}
                a wave sweeps left to right, XORing each plaintext byte with the keystream byte to produce the ciphertext byte below.
              </>
            ) : encrypted ? (
              <>
                The ciphertext is on the wire; bytes look random and would be unrecoverable without the keystream. Copy and paste into the <strong style={{ color: BOB_HOP }}>Bob</strong> tab to decrypt.
              </>
            ) : (
              <>
                You're looking at <strong style={{ color: "#0f172a" }}>plaintext</strong>: the values are readable and the bytes encode the TLV records directly. Click <strong style={{ color: "#0f172a" }}>Encrypt</strong> to XOR each byte with the rho keystream.
              </>
            )
          }
        />
      </div>
    </div>
  );
}

// ── Bob tab ─────────────────────────────────────────────────────────────────

function BobTab(props: {
  pastedHex: string;
  setPastedHex: (s: string) => void;
  parsed: ParseResult;
  cipherValid: boolean;
  plaintext: number[];
  decoded: DecodedTlv;
  decrypted: boolean;
  revealed: number;
  isAnimating: boolean;
  activeColumn: number | null;
  onDecrypt: () => void;
  onReset: () => void;
}) {
  const {
    pastedHex,
    setPastedHex,
    parsed,
    cipherValid,
    plaintext,
    decoded,
    decrypted,
    revealed,
    isAnimating,
    activeColumn,
    onDecrypt,
    onReset,
  } = props;

  const statusColor =
    parsed.status === "valid"
      ? "#10b981"
      : parsed.status === "empty"
        ? "#94a3b8"
        : parsed.status === "too_many"
          ? "#d97706"
          : "#dc2626";

  const showPlaintextRow = cipherValid && (decrypted || isAnimating);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 760 }}>
        {/* Paste textarea */}
        <div
          className="border-[1.5px] mb-4 px-3 py-2.5"
          style={{
            background: "#fffdf5",
            borderColor: cipherValid ? BOB_HOP : "rgba(15,23,42,0.25)",
            opacity: isAnimating ? 0.6 : 1,
            transition: "opacity 200ms ease-out, border-color 200ms ease-out",
            pointerEvents: isAnimating ? "none" : "auto",
          }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.06em] mb-1.5 font-bold flex items-center justify-between gap-2"
            style={{ color: "#475569", fontFamily: MONO }}
          >
            <span>▾ Paste ciphertext from Alice (hex):</span>
            {pastedHex.length > 0 && (
              <button
                type="button"
                onClick={() => setPastedHex("")}
                className="hover:underline"
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: "#94a3b8",
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                }}
              >
                clear
              </button>
            )}
          </div>
          <textarea
            value={pastedHex}
            onChange={(e) => setPastedHex(e.target.value)}
            disabled={isAnimating}
            placeholder="e.g. 8a 5d 01 7a... (46 hex chars total)"
            spellCheck={false}
            className="w-full px-2 py-1.5 border-[1.5px]"
            style={{
              fontFamily: MONO,
              fontSize: 12,
              background: "#fff",
              borderColor: "rgba(15,23,42,0.25)",
              color: "#0f172a",
              resize: "vertical",
              minHeight: 56,
              letterSpacing: "0.03em",
            }}
            rows={2}
            data-testid="xor-paste"
          />
          <div
            className="mt-1.5"
            style={{ fontFamily: MONO, fontSize: 10 }}
          >
            <span style={{ color: statusColor, fontWeight: 700 }}>
              {parsed.message}
            </span>
          </div>
        </div>

        {/* CIPHERTEXT row (parsed bytes from paste) */}
        <ByteRow
          label="CIPHERTEXT"
          bytes={parsed.bytes}
          fill={CIPHER_FILL}
          stroke={CIPHER_STROKE}
          totalCount={TOTAL_BYTES}
          activeColumn={cipherValid ? activeColumn : null}
        />

        <OperatorRow op="⊕" />

        {/* KEYSTREAM row */}
        <ByteRow
          label="KEYSTREAM"
          bytes={KEYSTREAM}
          fill={KEY_FILL}
          stroke={KEY_STROKE}
          activeColumn={cipherValid ? activeColumn : null}
        />

        {/* PLAINTEXT row, slides in during decrypt */}
        <div
          style={{
            overflow: "visible",
            maxHeight: showPlaintextRow ? 90 : 0,
            opacity: showPlaintextRow ? 1 : 0,
            transition:
              "max-height 400ms ease-out, opacity 300ms ease-out, margin-top 400ms ease-out",
            marginTop: showPlaintextRow ? 6 : 0,
            pointerEvents: showPlaintextRow ? "auto" : "none",
          }}
        >
          <OperatorRow op="=" />
          <ByteRow
            label="PLAINTEXT"
            bytes={plaintext}
            fill={PLAIN_FILL}
            stroke={PLAIN_STROKE}
            revealedCount={revealed}
            totalCount={TOTAL_BYTES}
            activeColumn={activeColumn}
            popOnReveal
          />
        </div>

        {/* Buttons */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={onDecrypt}
              disabled={!cipherValid || isAnimating}
              className="px-5 py-2 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.08em] uppercase hover:bg-[#3b6aa0] hover:border-[#3b6aa0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: MONO }}
              data-testid="xor-decrypt"
            >
              {decrypted ? "↻ Re-decrypt" : "▶ Decrypt"}
            </button>
          </div>
        </div>

        <StepCaption
          label={
            isAnimating
              ? "Bob · decrypting"
              : decrypted
                ? "Bob · recovered"
                : !cipherValid
                  ? "Bob · awaiting ciphertext"
                  : "Bob · ready to decrypt"
          }
          accentColor={BOB_HOP}
          caption={
            isAnimating ? (
              <>
                <strong style={{ color: ACTIVE_GOLD }}>Decrypting…</strong>{" "}
                same XOR, applied to the ciphertext. The keystream cancels itself out and the plaintext re-emerges.
              </>
            ) : decrypted ? (
              decoded.valid ? (
                <>
                  The keystream cancelled, and Bob has the original TLV bytes back. The decoded record is below.
                </>
              ) : (
                <>
                  Bytes decrypted, but they don't decode as a valid TLV record. (The XOR worked; the source bytes weren't a real onion hop payload.)
                </>
              )
            ) : !cipherValid ? (
              <>
                Paste 46 hex characters above to populate the ciphertext row, then click <strong style={{ color: BOB_HOP }}>Decrypt</strong>.
              </>
            ) : (
              <>
                Ciphertext loaded. Click <strong style={{ color: BOB_HOP }}>Decrypt</strong> to apply the same XOR, XOR is its own inverse, so the plaintext will fall right back out.
              </>
            )
          }
        />

        {/* Decoded TLV panel, appears after decryption */}
        {decrypted && !isAnimating && (
          <div
            className="mt-5 border-[1.5px] px-4 py-3"
            style={{
              background: decoded.valid ? "#f0f7ff" : "#fff5f5",
              borderColor: decoded.valid ? BOB_HOP : "#dc2626",
              animation: "panel-slide 350ms ease-out",
            }}
            data-testid="xor-decoded"
          >
            {decoded.valid ? (
              <>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: BOB_HOP,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  ▶ Decoded TLV records, Bob's hop payload
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto auto 1fr",
                    rowGap: 6,
                    columnGap: 12,
                    fontFamily: MONO,
                    fontSize: 12,
                    alignItems: "center",
                  }}
                >
                  <DecodedRow
                    typeByte="02"
                    name="amt_to_forward"
                    value={`${decoded.amt!.toLocaleString()} msat`}
                    tint={REGION_TINT.amtTlv}
                    border={REGION_BORDER.amtTlv}
                  />
                  <DecodedRow
                    typeByte="04"
                    name="outgoing_cltv"
                    value={`${decoded.cltv!.toLocaleString()} block`}
                    tint={REGION_TINT.cltvTlv}
                    border={REGION_BORDER.cltvTlv}
                  />
                  <DecodedRow
                    typeByte="06"
                    name="short_channel_id"
                    value={decoded.scid!}
                    tint={REGION_TINT.scidTlv}
                    border={REGION_BORDER.scidTlv}
                  />
                </div>
              </>
            ) : (
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 11,
                  color: "#9b1c1c",
                  letterSpacing: "0.02em",
                }}
              >
                ✗ Decrypted bytes don't decode as a valid TLV record. The XOR ran fine; the source bytes just weren't a real Sphinx hop payload. Try Alice's ciphertext.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DecodedRow({
  typeByte,
  name,
  value,
  tint,
  border,
}: {
  typeByte: string;
  name: string;
  value: string;
  tint: string;
  border: string;
}) {
  return (
    <>
      <div
        style={{
          background: tint,
          border: `1.5px solid ${border}`,
          padding: "1.5px 6px",
          fontWeight: 700,
          color: "#0f172a",
          textAlign: "center",
          minWidth: 28,
        }}
      >
        {typeByte}
      </div>
      <div style={{ color: "#475569" }}>{name}</div>
      <div
        style={{ color: "#0f172a", fontWeight: 700, letterSpacing: "0.02em" }}
      >
        {value}
      </div>
    </>
  );
}

// ── shared subcomponents ────────────────────────────────────────────────────

function TabButton({
  active,
  color,
  onClick,
  label,
  letter,
  ready,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  label: string;
  letter: string;
  ready: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 border-r-[1.5px] transition-colors"
      style={{
        borderColor: "rgba(15,23,42,0.15)",
        background: active ? "#fff" : "transparent",
        borderBottom: active
          ? `2.5px solid ${color}`
          : "2.5px solid transparent",
        marginBottom: "-1.5px",
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        color: active ? "#0f172a" : "#64748b",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          background: color,
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
        }}
      >
        {letter}
      </span>
      {label}
      {ready && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 14,
            height: 14,
            borderRadius: 999,
            background: "#10b981",
            color: "#fff",
            fontSize: 9,
            fontWeight: 900,
          }}
          aria-label="completed"
        >
          ✓
        </span>
      )}
    </button>
  );
}

// Renders the editable values as a wire-protocol-style message card:
// black header with the type name, body with one row per field. Each row's
// background tint matches the byte regions in the plaintext row so the
// reader can see which slice of bytes encodes which field.
function ProtocolMessageCard({
  amt,
  setAmt,
  cltv,
  setCltv,
  scidStr,
  setScidStr,
  scidValid,
  isAnimating,
}: {
  amt: number;
  setAmt: (n: number) => void;
  cltv: number;
  setCltv: (n: number) => void;
  scidStr: string;
  setScidStr: (s: string) => void;
  scidValid: boolean;
  isAnimating: boolean;
}) {
  return (
    <div
      className="border-[1.5px] mb-2"
      style={{
        background: "#fffdf5",
        borderColor: "#0f172a",
        opacity: isAnimating ? 0.55 : 1,
        transition: "opacity 200ms ease-out",
        pointerEvents: isAnimating ? "none" : "auto",
      }}
    >
      {/* Black header, protocol message style */}
      <div
        className="bg-black text-white px-3 py-1.5 flex items-center gap-2"
        style={{ fontFamily: MONO }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: "#b8860b",
            display: "inline-block",
          }}
        />
        <span className="text-[11px] uppercase tracking-[0.08em] font-bold">
          bob's TLV record
        </span>
      </div>

      {/* Field rows */}
      <ProtocolFieldNumber
        name="amt_to_forward"
        unit="msat"
        value={amt}
        setValue={setAmt}
        min={0}
        max={MAX_AMT}
        tint={REGION_TINT.amtTlv}
        border={REGION_BORDER.amtTlv}
      />
      <ProtocolFieldNumber
        name="outgoing_cltv_value"
        unit="block"
        value={cltv}
        setValue={setCltv}
        min={0}
        max={MAX_CLTV}
        tint={REGION_TINT.cltvTlv}
        border={REGION_BORDER.cltvTlv}
      />
      <ProtocolFieldText
        name="short_channel_id"
        unit="block:tx:out"
        value={scidStr}
        setValue={setScidStr}
        valid={scidValid}
        tint={REGION_TINT.scidTlv}
        border={REGION_BORDER.scidTlv}
      />
    </div>
  );
}

function ProtocolFieldNumber({
  name,
  unit,
  value,
  setValue,
  min,
  max,
  tint,
  border,
}: {
  name: string;
  unit: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  tint: string;
  border: string;
}) {
  return (
    <div
      className="grid items-center px-3 py-1.5 border-t-[1.5px]"
      style={{
        gridTemplateColumns: "minmax(160px, 200px) 1fr auto",
        gap: 12,
        background: tint,
        borderColor: "rgba(15,23,42,0.12)",
      }}
    >
      <span
        className="font-bold"
        style={{
          fontFamily: MONO,
          fontSize: 12,
          color: border,
          letterSpacing: "0.02em",
        }}
      >
        {name}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isFinite(v) || v < min) return;
          setValue(Math.min(v, max));
        }}
        className="border-[1.5px] px-1.5 py-0.5"
        style={{
          background: "#fff",
          borderColor: border,
          fontFamily: MONO,
          fontSize: 12,
          fontWeight: 700,
          color: "#0f172a",
          letterSpacing: "0.02em",
          width: "100%",
        }}
      />
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10,
          color: "#475569",
          minWidth: 70,
          textAlign: "left",
        }}
      >
        {unit}
      </span>
    </div>
  );
}

function ProtocolFieldText({
  name,
  unit,
  value,
  setValue,
  valid,
  tint,
  border,
}: {
  name: string;
  unit: string;
  value: string;
  setValue: (s: string) => void;
  valid: boolean;
  tint: string;
  border: string;
}) {
  return (
    <div
      className="grid items-center px-3 py-1.5 border-t-[1.5px]"
      style={{
        gridTemplateColumns: "minmax(160px, 200px) 1fr auto",
        gap: 12,
        background: tint,
        borderColor: "rgba(15,23,42,0.12)",
      }}
    >
      <span
        className="font-bold"
        style={{
          fontFamily: MONO,
          fontSize: 12,
          color: border,
          letterSpacing: "0.02em",
        }}
      >
        {name}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        className="border-[1.5px] px-1.5 py-0.5"
        style={{
          background: "#fff",
          borderColor: valid ? border : "#dc2626",
          fontFamily: MONO,
          fontSize: 12,
          fontWeight: 700,
          color: valid ? "#0f172a" : "#9b1c1c",
          letterSpacing: "0.02em",
          width: "100%",
        }}
      />
      <span
        style={{
          fontFamily: MONO,
          fontSize: 10,
          color: valid ? "#475569" : "#9b1c1c",
          minWidth: 70,
          textAlign: "left",
        }}
      >
        {valid ? unit : "invalid"}
      </span>
    </div>
  );
}

function FormField({
  label,
  unit,
  value,
  setValue,
  min,
  max,
}: {
  label: string;
  unit: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <label
      className="flex items-center gap-1.5"
      style={{ fontFamily: MONO, fontSize: 11 }}
    >
      <span style={{ color: "#475569" }}>{label}:</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isFinite(v) || v < min) return;
          setValue(Math.min(v, max));
        }}
        className="border-[1.5px] px-1.5 py-0.5"
        style={{
          width: 110,
          background: "#fffdf5",
          borderColor: "rgba(15,23,42,0.3)",
          fontFamily: MONO,
          fontSize: 12,
          fontWeight: 700,
          color: "#0f172a",
          letterSpacing: "0.02em",
        }}
      />
      <span style={{ color: "#94a3b8", fontSize: 10 }}>{unit}</span>
    </label>
  );
}

function ByteRow({
  label,
  sublabel,
  bytes,
  fill,
  stroke,
  regionColors,
  revealedCount,
  totalCount,
  activeColumn,
  popOnReveal,
  pulseIndices,
}: {
  label: string;
  sublabel?: string;
  bytes: number[];
  fill: string;
  stroke: string;
  regionColors?: boolean;
  revealedCount?: number;
  totalCount?: number;
  activeColumn?: number | null;
  popOnReveal?: boolean;
  pulseIndices?: Set<number>;
}) {
  const total = totalCount ?? bytes.length;
  const revealed = revealedCount ?? bytes.length;

  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div
        className="shrink-0"
        style={{
          width: 110,
          textAlign: "right",
          fontFamily: MONO,
          fontSize: 11,
          color: "#0f172a",
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        <div>{label}</div>
        {sublabel && (
          <div
            style={{
              fontSize: 9,
              fontWeight: 400,
              color: "#475569",
              letterSpacing: "0.02em",
            }}
          >
            {sublabel}
          </div>
        )}
      </div>

      <div className="flex gap-0.5">
        {Array.from({ length: total }).map((_, i) => {
          const hasByte = i < bytes.length;
          const byte = hasByte ? bytes[i] : 0;
          const isHidden = i >= revealed || !hasByte;
          const isActive = activeColumn === i && !isHidden;
          const isPulsing = pulseIndices?.has(i) ?? false;
          const region = BYTE_REGIONS[i];
          const cellFill = regionColors ? REGION_TINT[region] : fill;
          const cellStroke = regionColors ? REGION_BORDER[region] : stroke;

          let animation: string | undefined;
          if (popOnReveal && isActive) {
            animation = `byte-pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
          } else if (isPulsing && !isHidden) {
            animation = `byte-edit-pulse 450ms ease-out`;
          }

          return (
            <div
              key={i}
              className="flex items-center justify-center relative"
              style={{
                width: 26,
                height: 28,
                background: isHidden ? "transparent" : cellFill,
                border: isHidden
                  ? "1.5px dashed rgba(15,23,42,0.15)"
                  : `1.5px solid ${isActive ? ACTIVE_GOLD : cellStroke}`,
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 700,
                color: isHidden ? "transparent" : "#0f172a",
                transition: isActive
                  ? "border-color 120ms ease-out, box-shadow 120ms ease-out"
                  : "background 200ms ease-out, border-color 300ms ease-out",
                boxShadow: isActive
                  ? `0 0 0 2px ${ACTIVE_GOLD}55, 0 0 14px ${ACTIVE_GOLD}88`
                  : "none",
                animation,
                zIndex: isActive ? 5 : isPulsing ? 4 : 1,
              }}
            >
              {!isHidden && byte.toString(16).padStart(2, "0")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OperatorRow({ op, sublabel }: { op: string; sublabel?: string }) {
  return (
    <div
      className="flex items-center gap-2 my-1"
      style={{ fontFamily: MONO, color: "#475569" }}
    >
      <div
        className="shrink-0 text-right"
        style={{
          width: 110,
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {op}
      </div>
      {sublabel && (
        <div
          style={{ fontSize: 10, fontStyle: "italic", letterSpacing: "0.04em" }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}

export default XorEncryptionDemo;
