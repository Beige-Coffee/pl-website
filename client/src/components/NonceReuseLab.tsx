/**
 * NonceReuseLab — Interactive diagram matching the reference image layout:
 *   Left:  Two stacked encryption flows (Message 1, Message 2)
 *   Right: XOR attack panel with pixel skull
 *
 * Students type two messages, both encrypted with the same nonce,
 * then see Eve's attack unfold on the right.
 */

import { useState, useRef, useCallback, useEffect } from "react";

interface NonceReuseLabProps {
  theme: "light" | "dark";
}

// ─── Crypto helpers ─────────────────────────────────────────────────────────

function deriveKeystream(key: Uint8Array, nonce: number, length: number): Uint8Array {
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
  for (let i = 0; i < key.length; i++) {
    const target = i % 4;
    if (target === 0) s0 = (s0 * 31 + key[i]) >>> 0;
    else if (target === 1) s1 = (s1 * 31 + key[i]) >>> 0;
    else if (target === 2) s2 = (s2 * 31 + key[i]) >>> 0;
    else s3 = (s3 * 31 + key[i]) >>> 0;
  }
  s0 = (s0 ^ (nonce * 2654435761)) >>> 0;
  s1 = (s1 ^ (nonce * 2246822519)) >>> 0;
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;

  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    let t = s3;
    const s = s0;
    s3 = s2; s2 = s1; s1 = s;
    t ^= (t << 11) >>> 0;
    t ^= (t >>> 8);
    t ^= (s ^ (s >>> 19));
    s0 = t >>> 0;
    out[i] = t & 0xff;
  }
  return out;
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const len = Math.min(a.length, b.length);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = a[i] ^ b[i];
  return out;
}

function hexByte(b: number): string {
  return b.toString(16).padStart(2, "0").toUpperCase();
}

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

const MONO = '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace';
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';


// ─── ByteCells — row of hex/char cells like the reference image ─────────────

function ByteCells({ bytes, charMode, highlight, dark }: {
  bytes: Uint8Array;
  charMode?: boolean;
  highlight?: boolean[];
  dark: boolean;
}) {
  const border = dark ? "#3a4a6a" : "#bbb";
  const bg = dark ? "#1e293b" : "#fff";
  const fg = dark ? "#e2e8f0" : "#333";
  const hlBg = dark ? "#7f1d1d" : "#fecaca";
  const hlFg = dark ? "#fca5a5" : "#991b1b";

  return (
    <div className="flex flex-wrap">
      {Array.from(bytes).map((b, i) => {
        const isHl = highlight?.[i];
        const displayChar = charMode && b >= 32 && b < 127;
        return (
          <div
            key={i}
            className="flex items-center justify-center -ml-px first:ml-0"
            style={{
              width: 28, height: 24,
              border: `1px solid ${border}`,
              backgroundColor: isHl ? hlBg : bg,
              color: isHl ? hlFg : fg,
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: isHl ? 700 : 400,
            }}
          >
            {displayChar ? String.fromCharCode(b) : hexByte(b)}
          </div>
        );
      })}
    </div>
  );
}

// ─── LabeledRow — "Keystream  [cells]" ──────────────────────────────────────

function LabeledRow({ label, bytes, charMode, highlight, dark }: {
  label: string;
  bytes: Uint8Array | null;
  charMode?: boolean;
  highlight?: boolean[];
  dark: boolean;
}) {
  const fg = dark ? "#cbd5e1" : "#333";
  return (
    <div className="flex items-center gap-2 min-h-[26px]">
      <div className="w-[85px] text-right text-[13px] font-semibold shrink-0" style={{ color: fg, fontFamily: SANS }}>
        {label}
      </div>
      {bytes ? (
        <ByteCells bytes={bytes} charMode={charMode} highlight={highlight} dark={dark} />
      ) : (
        <span className="text-xs italic" style={{ color: dark ? "#475569" : "#aaa" }}>...</span>
      )}
    </div>
  );
}

// ─── EncryptionFlow — one "Message N" block with Nonce+Key → ChaCha20 → rows

function EncryptionFlow({ num, nonce, keyLabel, keystream, plaintext, ciphertext, dark }: {
  num: number;
  nonce: number;
  keyLabel: string;
  keystream: Uint8Array | null;
  plaintext: Uint8Array | null;
  ciphertext: Uint8Array | null;
  dark: boolean;
}) {
  const border = dark ? "#3a4a6a" : "#999";
  const pillDarkBg = dark ? "#2a3a5a" : "#333";
  const pillDarkFg = dark ? "#e2e8f0" : "#fff";
  const pillLightBg = dark ? "#1a2744" : "#fff";
  const pillLightFg = dark ? "#e2e8f0" : "#333";
  const arrowColor = dark ? "#64748b" : "#666";
  const labelColor = dark ? "#94a3b8" : "#555";

  return (
    <div className="flex flex-col items-center">
      {/* Title */}
      <div className="text-sm font-bold mb-2" style={{ color: labelColor, fontFamily: SANS }}>
        Message {num}
      </div>

      {/* Nonce + Key pills */}
      <div className="flex items-center gap-2 mb-1">
        <div className="px-3 py-1 text-[11px] font-bold" style={{ backgroundColor: pillDarkBg, color: pillDarkFg, border: `1.5px solid ${border}`, fontFamily: SANS }}>
          Nonce = {nonce}
        </div>
        <div className="px-3 py-1 text-[11px] font-bold" style={{ backgroundColor: pillLightBg, color: pillLightFg, border: `1.5px solid ${border}`, fontFamily: MONO }}>
          {keyLabel}
        </div>
      </div>

      {/* Arrows down into ChaCha20 */}
      <svg width="120" height="20" className="shrink-0">
        <defs>
          <marker id={`arrNR${num}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={arrowColor} />
          </marker>
        </defs>
        <line x1="35" y1="0" x2="35" y2="14" stroke={arrowColor} strokeWidth="1.5" markerEnd={`url(#arrNR${num})`} />
        <line x1="85" y1="0" x2="85" y2="14" stroke={arrowColor} strokeWidth="1.5" markerEnd={`url(#arrNR${num})`} />
      </svg>

      {/* ChaCha20 box */}
      <div className="px-4 py-1 text-sm font-bold mb-1" style={{ backgroundColor: pillLightBg, color: pillLightFg, border: `1.5px solid ${border}`, fontFamily: SANS }}>
        ChaCha20
      </div>

      {/* Arrow down */}
      <svg width="12" height="18" className="shrink-0">
        <line x1="6" y1="0" x2="6" y2="13" stroke={arrowColor} strokeWidth="1.5" markerEnd={`url(#arrNR${num})`} />
      </svg>

      {/* Keystream / XOR / Plaintext / = / Ciphertext */}
      <div className="flex flex-col gap-0.5">
        <LabeledRow label="Keystream" bytes={keystream} dark={dark} />
        <div className="flex items-center gap-2">
          <div className="w-[85px] text-right text-xs font-bold shrink-0" style={{ color: dark ? "#64748b" : "#999", fontFamily: SANS }}>
            &#8853;
          </div>
        </div>
        <LabeledRow label={`Plaintext (${num})`} bytes={plaintext} charMode dark={dark} />
        <div className="flex items-center gap-2">
          <div className="w-[85px] text-right text-sm font-bold shrink-0" style={{ color: dark ? "#64748b" : "#999" }}>=</div>
        </div>
        <LabeledRow label={`Ciphertext (${num})`} bytes={ciphertext} dark={dark} />
      </div>
    </div>
  );
}

// ─── AttackPanel — right side with spy icon, XOR, recovered plaintexts ──────

function AttackPanel({ c1, c2, p1, p2, p1Text, recoveredText, attackStep, dark }: {
  c1: Uint8Array | null;
  c2: Uint8Array | null;
  p1: Uint8Array | null;
  p2: Uint8Array | null;
  p1Text: string;
  recoveredText: string;
  attackStep: number;
  dark: boolean;
}) {
  const labelColor = dark ? "#94a3b8" : "#555";
  const arrowColor = dark ? "#64748b" : "#666";
  const dangerColor = dark ? "#ef4444" : "#dc2626";
  const mutedColor = dark ? "#64748b" : "#999";
  const fgColor = dark ? "#e2e8f0" : "#333";
  const c1XorC2 = c1 && c2 ? xorBytes(c1, c2) : null;

  // Highlight bytes in recovered plaintext that differ from zero
  const p2Highlight = c1XorC2 ? Array.from(c1XorC2).map(b => b !== 0) : undefined;

  // Pick the first byte position for the per-byte walkthrough
  const exampleIdx = 0;
  const exC1 = c1 ? c1[exampleIdx] : 0;
  const exC2 = c2 ? c2[exampleIdx] : 0;
  const exXor = c1XorC2 ? c1XorC2[exampleIdx] : 0;
  const exP1 = p1 ? p1[exampleIdx] : 0;
  const exP1Char = p1 && exP1 >= 32 && exP1 < 127 ? String.fromCharCode(exP1) : "?";
  const exP2 = exXor ^ exP1;
  const exP2Char = exP2 >= 32 && exP2 < 127 ? String.fromCharCode(exP2) : "?";

  return (
    <div className="flex flex-col items-center">
      {/* Pixel eye — Eve is watching */}
      <svg width="40" height="28" viewBox="0 0 20 14" className="mb-2" style={{ imageRendering: "pixelated" }}>
        {/* Upper lid */}
        <rect x="6" y="0" width="8" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="4" y="1" width="2" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="14" y="1" width="2" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="3" y="2" width="1" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="16" y="2" width="1" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="2" y="3" width="1" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="17" y="3" width="1" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="1" y="4" width="1" height="2" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="18" y="4" width="1" height="2" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        {/* White of eye */}
        <rect x="4" y="2" width="12" height="1" fill={dark ? "#94a3b8" : "#e5e5e5"} />
        <rect x="3" y="3" width="14" height="1" fill={dark ? "#94a3b8" : "#e5e5e5"} />
        <rect x="2" y="4" width="16" height="2" fill={dark ? "#94a3b8" : "#e5e5e5"} />
        <rect x="3" y="6" width="14" height="1" fill={dark ? "#94a3b8" : "#e5e5e5"} />
        <rect x="4" y="7" width="12" height="1" fill={dark ? "#94a3b8" : "#e5e5e5"} />
        {/* Iris */}
        <rect x="8" y="3" width="4" height="1" fill={dark ? "#475569" : "#555"} />
        <rect x="7" y="4" width="6" height="2" fill={dark ? "#475569" : "#555"} />
        <rect x="8" y="6" width="4" height="1" fill={dark ? "#475569" : "#555"} />
        {/* Pupil */}
        <rect x="9" y="4" width="2" height="2" fill={dark ? "#0f172a" : "#000"} />
        {/* Highlight */}
        <rect x="11" y="3" width="1" height="1" fill="#fff" />
        {/* Lower lid */}
        <rect x="2" y="6" width="1" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="17" y="6" width="1" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="1" y="6" width="1" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="18" y="6" width="1" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="3" y="7" width="1" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="16" y="7" width="1" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="4" y="8" width="2" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="14" y="8" width="2" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
        <rect x="6" y="9" width="8" height="1" fill={dark ? "#e2e8f0" : "#1a1a1a"} />
      </svg>

      {attackStep >= 1 && (
        <div className="flex flex-col gap-0.5 items-center" style={{ animation: "nrlFadeIn 0.3s ease-out" }}>
          <LabeledRow label="Ciphertext (1)" bytes={c1} dark={dark} />
          <div className="flex items-center gap-2">
            <div className="w-[85px] text-right text-xs font-bold shrink-0" style={{ color: mutedColor }}>&#8853;</div>
          </div>
          <LabeledRow label="Ciphertext (2)" bytes={c2} dark={dark} />
          <div className="flex items-center gap-2">
            <div className="w-[85px] text-right text-sm font-bold shrink-0" style={{ color: mutedColor }}>=</div>
          </div>
        </div>
      )}

      {attackStep >= 2 && c1XorC2 && (
        <div className="flex flex-col gap-0.5 items-center" style={{ animation: "nrlFadeIn 0.3s ease-out" }}>
          <LabeledRow label="C1 XOR C2" bytes={c1XorC2} highlight={p2Highlight} dark={dark} />
          <div className="mt-1.5 text-[11px] text-center leading-relaxed" style={{ color: labelColor, fontFamily: SANS, maxWidth: 280 }}>
            The keystream cancels out! This equals P1 &#8853; P2.
          </div>
        </div>
      )}

      {/* Per-byte walkthrough — shows exactly how one known plaintext byte recovers the other */}
      {attackStep >= 3 && c1XorC2 && p1 && (
        <div className="mt-3 px-4 py-3.5 w-full" style={{
          animation: "nrlFadeIn 0.4s ease-out",
          border: `1.5px solid ${dark ? "#334155" : "#ddd"}`,
          backgroundColor: dark ? "#0f172a" : "#fafaf8",
        }}>
          <div className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: fgColor, fontFamily: SANS }}>
            Byte-by-byte recovery
          </div>
          <div className="text-sm leading-[2]" style={{ color: fgColor, fontFamily: SANS }}>
            <div style={{ color: labelColor }}>
              Eve knows Plaintext (1), so for each byte:
            </div>
            <div className="mt-2 py-2 px-3" style={{ fontFamily: MONO, fontSize: 13, backgroundColor: dark ? "#1e293b" : "#f5f3ee", borderLeft: `3px solid ${dark ? "#475569" : "#ccc"}` }}>
              <div>
                <span style={{ color: mutedColor }}>C1[0] XOR C2[0]</span>{" "}
                <span style={{ color: fgColor }}>=</span>{" "}
                <span style={{ color: dark ? "#fbbf24" : "#92400e", fontWeight: 700 }}>{hexByte(exC1)}</span>{" "}
                <span style={{ color: mutedColor }}>&#8853;</span>{" "}
                <span style={{ color: dark ? "#fbbf24" : "#92400e", fontWeight: 700 }}>{hexByte(exC2)}</span>{" "}
                <span style={{ color: fgColor }}>=</span>{" "}
                <span style={{ color: dark ? "#f87171" : "#dc2626", fontWeight: 700 }}>{hexByte(exXor)}</span>
              </div>
              <div className="mt-1">
                <span style={{ color: mutedColor }}>(P1 &#8853; P2)[0] XOR P1[0]</span>{" "}
                <span style={{ color: fgColor }}>=</span>{" "}
                <span style={{ color: dark ? "#f87171" : "#dc2626", fontWeight: 700 }}>{hexByte(exXor)}</span>{" "}
                <span style={{ color: mutedColor }}>&#8853;</span>{" "}
                <span style={{ fontWeight: 700 }}>{hexByte(exP1)}</span>{" "}
                <span style={{ color: mutedColor }}>("{exP1Char}")</span>{" "}
                <span style={{ color: fgColor }}>=</span>{" "}
                <span style={{ color: dark ? "#f87171" : "#dc2626", fontWeight: 700, fontSize: 15 }}>{hexByte(exP2)}</span>{" "}
                <span style={{ color: dark ? "#f87171" : "#dc2626", fontWeight: 700, fontSize: 15 }}>("{exP2Char}")</span>
              </div>
            </div>
            <div className="mt-2" style={{ color: labelColor }}>
              Repeat for every byte position to recover the full message.
            </div>
          </div>
        </div>
      )}

      {/* Down arrow to recovered plaintexts */}
      {attackStep >= 3 && (
        <svg width="12" height="22" className="shrink-0 my-1" style={{ animation: "nrlFadeIn 0.3s ease-out" }}>
          <defs>
            <marker id="arrAtk" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={arrowColor} />
            </marker>
          </defs>
          <line x1="6" y1="0" x2="6" y2="16" stroke={arrowColor} strokeWidth="1.5" markerEnd="url(#arrAtk)" />
        </svg>
      )}

      {attackStep >= 4 && p1 && (
        <div className="flex flex-col gap-0.5 items-center" style={{ animation: "nrlFadeIn 0.3s ease-out" }}>
          <LabeledRow label="Plaintext (1)" bytes={p1} charMode highlight={p2Highlight} dark={dark} />
        </div>
      )}

      {attackStep >= 5 && p2 && (
        <div className="flex flex-col gap-0.5 items-center mt-2" style={{ animation: "nrlFadeIn 0.4s ease-out" }}>
          <LabeledRow label="Plaintext (2)" bytes={p2} charMode highlight={p2Highlight} dark={dark} />
          <div className="mt-2 px-3 py-1.5 text-sm font-bold" style={{ color: dangerColor, border: `2px solid ${dangerColor}`, fontFamily: SANS, animation: "nrlFadeIn 0.4s ease-out" }}>
            Recovered: <span style={{ fontFamily: MONO }}>"{recoveredText}"</span>
          </div>
        </div>
      )}

      {attackStep === 0 && (
        <div className="text-xs text-center max-w-[180px]" style={{ color: labelColor, fontFamily: SANS }}>
          Eve is watching...<br />Encrypt two messages with the same nonce.
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function NonceReuseLab({ theme }: NonceReuseLabProps) {
  const dark = theme === "dark";

  const sessionKey = useRef<Uint8Array>(
    (() => { const k = new Uint8Array(32); crypto.getRandomValues(k); return k; })()
  );
  const keyLabel = "Shared Secret";

  const [msg1Text, setMsg1Text] = useState("RESISTANCE");
  const [msg2Text, setMsg2Text] = useState("MEETATSUNUP");
  const [nonce] = useState(0);
  const [phase, setPhase] = useState<"input1" | "input2" | "attack">("input1");
  const [attackStep, setAttackStep] = useState(0);
  const attackTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Computed encryption data — each message encrypted at its real length
  const plain1 = msg1Text ? textToBytes(msg1Text) : null;
  const plain2 = msg2Text ? textToBytes(msg2Text) : null;

  const keystream1 = plain1 ? deriveKeystream(sessionKey.current, nonce, plain1.length) : null;
  const cipher1 = plain1 && keystream1 ? xorBytes(plain1, keystream1) : null;
  const keystream2 = plain2 ? deriveKeystream(sessionKey.current, nonce, plain2.length) : null;
  const cipher2 = plain2 && keystream2 ? xorBytes(plain2, keystream2) : null;

  // Eve can only XOR the overlapping bytes of the two ciphertexts
  const overlapLen = Math.min(cipher1?.length ?? 0, cipher2?.length ?? 0);
  const recoveredText = cipher1 && cipher2 && plain1
    ? bytesToText(xorBytes(xorBytes(cipher1.slice(0, overlapLen), cipher2.slice(0, overlapLen)), plain1.slice(0, overlapLen)))
    : "";

  const handleEncryptMsg1 = useCallback(() => {
    if (!msg1Text.trim()) return;
    setPhase("input2");
  }, [msg1Text]);

  const handleEncryptMsg2 = useCallback(() => {
    if (!msg2Text.trim()) return;
    setPhase("attack");
    setAttackStep(0);
    // Animate attack steps
    for (const t of attackTimers.current) clearTimeout(t);
    attackTimers.current = [];
    attackTimers.current.push(setTimeout(() => setAttackStep(1), 300));
    attackTimers.current.push(setTimeout(() => setAttackStep(2), 900));
    attackTimers.current.push(setTimeout(() => setAttackStep(3), 1800));
    attackTimers.current.push(setTimeout(() => setAttackStep(4), 3000));
    attackTimers.current.push(setTimeout(() => setAttackStep(5), 3800));
  }, [msg2Text]);

  const handleReset = useCallback(() => {
    for (const t of attackTimers.current) clearTimeout(t);
    attackTimers.current = [];
    setMsg1Text("");
    setMsg2Text("");
    setPhase("input1");
    setAttackStep(0);
    crypto.getRandomValues(sessionKey.current);
  }, []);

  useEffect(() => {
    return () => { for (const t of attackTimers.current) clearTimeout(t); };
  }, []);

  // Colors
  const cardBg = dark ? "#0f1930" : "#fdf9f2";
  const cardBorder = dark ? "#2a3552" : "#d4c9a8";
  const inputBg = dark ? "#0b1220" : "#fff";
  const inputFg = dark ? "#e2e8f0" : "#333";
  const inputBorderColor = dark ? "#3a4a6a" : "#ccc";
  const mutedColor = dark ? "#64748b" : "#999";
  const accentColor = dark ? "#FFD700" : "#9a7200";

  return (
    <div className="my-8 overflow-hidden" style={{ fontFamily: SANS, border: `2px solid ${cardBorder}`, backgroundColor: cardBg }}>
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `2px solid ${cardBorder}` }}>
        <span className="text-sm font-bold tracking-[0.08em] uppercase" style={{ color: accentColor }}>
          Nonce Reuse Lab
        </span>
        <button
          type="button"
          onClick={handleReset}
          className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-opacity hover:opacity-70"
          style={{ color: mutedColor, border: `1px solid ${cardBorder}` }}
        >
          Reset
        </button>
      </div>

      {/* Input bar */}
      <div className="px-4 py-3" style={{ borderBottom: `2px solid ${cardBorder}` }}>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Message 1 input */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: inputFg }}>Message 1</span>
              {phase !== "input1" && <span className="text-[10px]" style={{ color: dark ? "#22c55e" : "#16a34a" }}>&#10003;</span>}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={msg1Text}
                readOnly
                disabled={phase !== "input1"}
                className="flex-1 min-w-0 px-2.5 py-1 text-sm outline-none transition-colors"
                style={{
                  fontFamily: MONO,
                  backgroundColor: inputBg,
                  color: inputFg,
                  border: `1px solid ${inputBorderColor}`,
                  opacity: phase !== "input1" ? 0.5 : 1,
                }}
                maxLength={14}
              />
              {phase === "input1" && (
                <button
                  type="button"
                  onClick={handleEncryptMsg1}
                  disabled={!msg1Text.trim()}
                  className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-all shrink-0"
                  style={{
                    color: msg1Text.trim() ? accentColor : mutedColor,
                    border: `1.5px solid ${msg1Text.trim() ? accentColor : cardBorder}`,
                    opacity: msg1Text.trim() ? 1 : 0.5,
                  }}
                >
                  Encrypt
                </button>
              )}
            </div>
          </div>

          {/* Message 2 input */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: inputFg }}>Message 2</span>
              <span className="text-[10px] px-1.5 py-0.5 font-bold" style={{
                color: dark ? "#fbbf24" : "#92400e",
                backgroundColor: dark ? "#78350f33" : "#fef3c733",
                border: `1px solid ${dark ? "#92400e" : "#fbbf24"}`,
              }}>
                Same nonce!
              </span>
              {phase === "attack" && <span className="text-[10px]" style={{ color: dark ? "#22c55e" : "#16a34a" }}>&#10003;</span>}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={msg2Text}
                readOnly
                disabled={phase !== "input2"}
                className="flex-1 min-w-0 px-2.5 py-1 text-sm outline-none transition-colors"
                style={{
                  fontFamily: MONO,
                  backgroundColor: inputBg,
                  color: inputFg,
                  border: `1px solid ${inputBorderColor}`,
                  opacity: phase !== "input2" ? 0.5 : 1,
                }}
                maxLength={14}
              />
              {phase === "input2" && (
                <button
                  type="button"
                  onClick={handleEncryptMsg2}
                  disabled={!msg2Text.trim()}
                  className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide cursor-pointer transition-all shrink-0"
                  style={{
                    color: msg2Text.trim() ? accentColor : mutedColor,
                    border: `1.5px solid ${msg2Text.trim() ? accentColor : cardBorder}`,
                    opacity: msg2Text.trim() ? 1 : 0.5,
                  }}
                >
                  Encrypt
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Diagram area — two-panel layout on desktop, stacked on mobile */}
      <div className="flex flex-col lg:flex-row">
        {/* Left: Encryption flows */}
        <div className="flex-1 min-w-0 px-4 py-5 overflow-x-auto" style={{ borderRight: `2px solid ${cardBorder}` }}>
          {/* Message 1 flow */}
          <div style={{ opacity: msg1Text ? 1 : 0.3, transition: "opacity 0.3s" }}>
            <EncryptionFlow
              num={1} nonce={nonce} keyLabel={keyLabel}
              keystream={msg1Text && phase !== "input1" ? keystream1 : null}
              plaintext={msg1Text ? plain1 : null}
              ciphertext={msg1Text && phase !== "input1" ? cipher1 : null}
              dark={dark}
            />
          </div>

          {/* Divider */}
          <div className="my-4" style={{ borderTop: `1px dashed ${cardBorder}` }} />

          {/* Message 2 flow */}
          <div style={{ opacity: msg2Text && phase !== "input1" ? 1 : 0.15, transition: "opacity 0.3s" }}>
            <EncryptionFlow
              num={2} nonce={nonce} keyLabel={keyLabel}
              keystream={msg2Text && phase === "attack" ? keystream2 : null}
              plaintext={msg2Text && phase !== "input1" ? plain2 : null}
              ciphertext={msg2Text && phase === "attack" ? cipher2 : null}
              dark={dark}
            />
          </div>
        </div>

        {/* Right: Attack panel */}
        <div className="lg:w-[340px] shrink-0 px-4 py-5 flex flex-col items-center justify-center overflow-x-auto" style={{ borderTop: `2px solid ${cardBorder}`, borderTopStyle: "solid" }}>
          <AttackPanel
            c1={phase === "attack" ? cipher1! : null}
            c2={phase === "attack" ? cipher2! : null}
            p1={phase === "attack" ? plain1! : null}
            p2={phase === "attack" ? (() => {
              const ol = Math.min(cipher1!.length, cipher2!.length);
              return xorBytes(xorBytes(cipher1!.slice(0, ol), cipher2!.slice(0, ol)), plain1!.slice(0, ol));
            })() : null}
            p1Text={msg1Text}
            recoveredText={recoveredText}
            attackStep={phase === "attack" ? attackStep : 0}
            dark={dark}
          />
        </div>
      </div>

      <style>{`
        @keyframes nrlFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
