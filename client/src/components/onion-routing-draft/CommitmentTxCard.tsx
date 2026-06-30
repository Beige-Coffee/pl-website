import { useEffect, useRef, useState } from "react";
import { Tooltip } from "./Tooltip";

// ────────────────────────────────────────────────────────────────────────────
// CommitmentTxCard (DRAFT)
//
// A dual-mode card for rendering one side of a Lightning channel's commitment
// transaction. Used by HtlcPropagationDiagram in two ways:
//   - "thumbnail" mode: compact card placed inline beneath each pair of nodes
//   - "full" mode: zoomed BOLT-3-flavored render shown in a hover/pin popover
//
// Visual style follows the Noise capstone:
//   - Cream body (#fffdf5), dark borders.
//   - JetBrains Mono for hex/protocol values; sans-serif elsewhere.
//   - IMMEDIATE outputs tinted green (#5a7a2f), DELAYED tinted amber (#b8860b).
//   - HTLC outputs use amber + dashed border to indicate "in-flight" state.
//   - Highlighted card (gold border + slight scale) marks the active channel.
// ────────────────────────────────────────────────────────────────────────────

export type OutputRole = "to_local" | "to_remote" | "htlc";

export interface CommitmentOutput {
  label: string;
  role: OutputRole;
  valueSats: number;
  immediate: boolean;
  htlc?: {
    paymentHash: string;
    cltv: number;
    inFlight: boolean;
  };
  /** Witness script lines (BOLT 3). When present, hovering this output in
   *  full mode reveals a side panel showing the script and a SHA256 indicator
   *  pointing to the <script_hash> placeholder in scriptPubKey. P2WPKH
   *  outputs (to_remote) typically omit this since they're pubkey-hash, not
   *  script-hash. */
  witnessScript?: string[];
  /** Accent color (hex stroke) for this output row's marker dot and border.
   *  Set to the canonical color of the party whose balance this output holds
   *  (e.g., Charlie's to_local row gets Charlie's teal stroke). When omitted,
   *  falls back to the IMMEDIATE/DELAYED defaults. */
  accentColor?: string;
}

export interface CommitmentTxCardProps {
  mode: "thumbnail" | "full";
  ownerLabel: string;
  subtitle?: string;
  fundingTxid?: string;
  /** The funding 2-of-2's two signers (this channel's partners), e.g. ["<bob_sig>", "<charlie_sig>"]. Defaults to Alice/Bob. */
  witnessSigs?: [string, string];
  outputs: CommitmentOutput[];
  highlight?: boolean;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onClick?: (e: React.MouseEvent) => void;
}

const GREEN = "#5a7a2f";
const AMBER = "#b8860b";
const SLATE = "#475569";
const INK = "#0f172a";

function fmtSats(n: number): string {
  return n.toLocaleString("en-US");
}

// Animated integer that interpolates from previous to next value over 400ms
// when the target changes. Used so to_local row "counts up" after settlement.
function AnimatedSats({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (display === value) return;
    fromRef.current = display;
    startRef.current = null;
    const duration = 400;
    let raf = 0;
    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / duration);
      const next = Math.round(fromRef.current + (value - fromRef.current) * t);
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>{fmtSats(display)}</span>;
}

function RoleTag({ immediate }: { immediate: boolean }) {
  const color = immediate ? GREEN : AMBER;
  return (
    <span
      className="inline-block px-1 text-[8px] font-bold tracking-[0.08em] uppercase border-[1.5px]"
      style={{ color, borderColor: color, background: "#fffdf5" }}
    >
      {immediate ? "IMMEDIATE" : "DELAYED"}
    </span>
  );
}

function OutputRowThumbnail({ o }: { o: CommitmentOutput }) {
  const isHtlc = o.role === "htlc";
  const inFlight = o.htlc?.inFlight ?? false;
  // Accent color for the marker dot + row border. HTLC rows always use AMBER
  // to signal "in-flight". Other rows prefer the per-party accent (so each
  // balance row matches the canonical color of the party whose to_local /
  // to_remote it represents) and fall back to IMMEDIATE/DELAYED defaults.
  const color = isHtlc
    ? AMBER
    : o.accentColor ?? (o.immediate ? GREEN : AMBER);
  return (
    <div
      className="border-[1.5px] px-1.5 py-1 flex items-center gap-1.5"
      style={{
        borderColor: color,
        borderStyle: isHtlc && inFlight ? "dashed" : "solid",
        background: "#fffdf5",
      }}
    >
      <span
        className="w-1.5 h-1.5 shrink-0"
        style={{ background: color }}
      />
      <span
        className="text-[9px] uppercase tracking-[0.04em] font-bold truncate"
        style={{ color: INK }}
      >
        {o.label}
      </span>
      <span
        className="ml-auto text-[10px] font-bold tabular-nums"
        style={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          color: INK,
        }}
      >
        <AnimatedSats value={o.valueSats} />
      </span>
    </div>
  );
}

function OutputRowFull({
  o,
  onHover,
  onLeave,
  isHovered,
}: {
  o: CommitmentOutput;
  onHover?: () => void;
  onLeave?: () => void;
  isHovered?: boolean;
}) {
  const isHtlc = o.role === "htlc";
  const inFlight = o.htlc?.inFlight ?? false;
  // Same accent rule as the thumbnail row: HTLC stays AMBER, other rows pick
  // up the per-party accent when provided.
  const color = isHtlc
    ? AMBER
    : o.accentColor ?? (o.immediate ? GREEN : AMBER);
  const hasWitness = !!o.witnessScript && o.witnessScript.length > 0;
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="border-[1.5px] px-2 py-1.5"
      style={{
        borderColor: isHovered ? AMBER : color,
        borderStyle: isHtlc && inFlight ? "dashed" : "solid",
        background: "#fffdf5",
        boxShadow: isHovered ? `0 0 0 2px rgba(184,134,11,0.35)` : undefined,
        cursor: hasWitness ? "help" : undefined,
        transition: "border-color 200ms ease-out, box-shadow 200ms ease-out",
      }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className="text-[10px] uppercase tracking-[0.05em] font-bold"
          style={{ color: INK }}
        >
          {o.label}
        </span>
        <RoleTag immediate={o.immediate} />
        <span
          className="ml-auto text-[12px] font-bold tabular-nums"
          style={{
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            color: INK,
          }}
        >
          <AnimatedSats value={o.valueSats} /> sat
        </span>
      </div>
      <div
        className="text-[9px]"
        style={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          opacity: isHovered ? 1 : 0.7,
          transition: "opacity 200ms ease-out",
        }}
      >
        <span>scriptPubKey: </span>
        {o.immediate ? (
          <span>OP_0 &lt;pubkey_hash&gt;</span>
        ) : (
          <span>
            OP_0{" "}
            <span
              style={{
                background: isHovered ? "#fef3c7" : "transparent",
                borderBottom: isHovered ? `1px dashed ${AMBER}` : "none",
                padding: isHovered ? "0 2px" : 0,
                fontWeight: isHovered ? 700 : 400,
                color: isHovered ? AMBER : undefined,
                transition: "background 200ms ease-out, padding 200ms ease-out",
              }}
            >
              &lt;script_hash&gt;
            </span>
          </span>
        )}
      </div>
      {o.htlc && (
        <div
          className="text-[9px] mt-0.5 flex flex-wrap gap-x-2"
          style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
        >
          <span>
            <span className="opacity-60">payment_hash:</span>{" "}
            <span className="font-bold">{o.htlc.paymentHash}</span>
          </span>
          <span>
            <span className="opacity-60">cltv:</span>{" "}
            <span className="font-bold">block {o.htlc.cltv}</span>
          </span>
          {o.htlc.inFlight && (
            <span
              className="ml-auto px-1 text-[8px] font-bold tracking-[0.08em] uppercase border-[1.5px]"
              style={{ color: AMBER, borderColor: AMBER, background: "#fef3c7" }}
            >
              IN-FLIGHT
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function CommitmentTxCard(props: CommitmentTxCardProps) {
  const {
    mode,
    ownerLabel,
    subtitle,
    fundingTxid,
    witnessSigs,
    outputs,
    highlight,
    onMouseEnter,
    onMouseLeave,
    onClick,
  } = props;

  const isFull = mode === "full";
  const baseStyle: React.CSSProperties = {
    transition: "transform 300ms ease-out, border-color 300ms ease-out, box-shadow 300ms ease-out, opacity 300ms ease-out",
    transform: highlight && !isFull ? "scale(1.02)" : "scale(1)",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    background: "#fffdf5",
  };

  if (mode === "thumbnail") {
    return (
      <div
        className="border-[1.5px] cursor-pointer"
        style={{
          ...baseStyle,
          borderColor: highlight ? AMBER : INK,
          boxShadow: highlight ? `0 0 0 2px ${AMBER}33` : "none",
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        {/* Title strip */}
        <div
          className="px-2 py-1 border-b-[1.5px] flex items-center gap-1.5"
          style={{ borderColor: highlight ? AMBER : INK, background: highlight ? "#fef3c7" : "#fffdf5" }}
        >
          <div className="w-1 h-1 shrink-0" style={{ background: AMBER }} />
          <span
            className="text-[9px] font-bold tracking-[0.06em] uppercase truncate"
            style={{ color: INK }}
          >
            {ownerLabel}
          </span>
        </div>
        {/* Brief transaction frame. version / locktime / the single funding
            input are shown faint so the OUTPUTS section is the clear focus;
            hover the card for the full transaction (inputs, witness, scripts). */}
        <div
          className="px-2 pt-1.5 pb-1 text-[8.5px] leading-tight"
          style={{
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            color: SLATE,
          }}
        >
          <div className="flex gap-2.5">
            <span>
              version <span style={{ color: INK, fontWeight: 700 }}>2</span>
            </span>
            <span>
              locktime <span style={{ color: INK, fontWeight: 700 }}>0x20…</span>
            </span>
          </div>
          <div className="mt-0.5">
            inputs <span style={{ color: INK, fontWeight: 700 }}>1</span>
            <span className="opacity-70"> · funding 2-of-2</span>
          </div>
        </div>

        {/* OUTPUTS, the detailed part of the transaction. */}
        <div className="px-2">
          <div
            className="text-[8px] uppercase tracking-[0.08em] font-bold"
            style={{ color: INK, opacity: 0.55 }}
          >
            outputs
          </div>
        </div>
        <div className="px-1.5 pt-1 pb-1.5 space-y-1">
          {outputs.slice(0, 3).map((o, i) => (
            <div
              key={`${o.role}-${i}`}
              className="overflow-hidden"
              style={{
                transition:
                  "max-height 700ms ease-in-out, opacity 700ms ease-in-out, margin 700ms ease-in-out",
                maxHeight: 200,
                opacity: 1,
              }}
            >
              <OutputRowThumbnail o={o} />
            </div>
          ))}
        </div>

        {/* Hover affordance */}
        <div
          className="px-2 pb-1.5 text-[8px] italic text-center"
          style={{ color: SLATE, opacity: 0.85 }}
        >
          hover for the full transaction
        </div>
      </div>
    );
  }

  // Full mode, BOLT-3-flavored card with version/locktime/inputs/witness.
  // Hovering an output row reveals a side panel showing that output's witness
  // script and a SHA256 indicator pointing back to the <script_hash>
  // placeholder in scriptPubKey. State lives at the card level so the side
  // panel renders adjacent to the card.
  return (
    <CommitmentTxCardFullView
      ownerLabel={ownerLabel}
      subtitle={subtitle}
      fundingTxid={fundingTxid}
      witnessSigs={witnessSigs}
      outputs={outputs}
      baseStyle={baseStyle}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Full-mode view: the BOLT-3-flavored card plus an optional side panel that
// appears when an output with a witnessScript is hovered.
// ────────────────────────────────────────────────────────────────────────────

function CommitmentTxCardFullView({
  ownerLabel,
  subtitle,
  fundingTxid,
  witnessSigs,
  outputs,
  baseStyle,
}: {
  ownerLabel: string;
  subtitle?: string;
  fundingTxid?: string;
  witnessSigs?: [string, string];
  outputs: CommitmentOutput[];
  baseStyle: React.CSSProperties;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hoveredOutput = hoveredIdx !== null ? outputs[hoveredIdx] : null;
  const showWitness =
    !!hoveredOutput?.witnessScript && hoveredOutput.witnessScript.length > 0;

  return (
    <div className="flex items-start" style={{ position: "relative" }}>
    <div
      className="border-[1.5px] p-3"
      style={{
        ...baseStyle,
        borderColor: AMBER,
        borderStyle: "dashed",
        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        minWidth: 320,
        maxWidth: 380,
      }}
    >
      {/* Title */}
      <div className="border-b-[1.5px] pb-2 mb-2" style={{ borderColor: INK }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5" style={{ background: AMBER }} />
          <span
            className="text-xs font-bold tracking-[0.06em] uppercase"
            style={{ color: INK }}
          >
            {ownerLabel}
          </span>
        </div>
        {subtitle && (
          <div className="text-[10px] italic mt-0.5" style={{ color: SLATE }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* version / locktime */}
      <div
        className="text-[10px] grid grid-cols-2 gap-x-3 mb-2"
        style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
      >
        <Tooltip label="Bitcoin transaction version. Version 2 enables BIP 68 (relative locktimes via sequence), which Lightning channels rely on for the to_local timeout.">
          <div>
            <span className="opacity-60">version:</span>{" "}
            <span className="font-bold">2</span>
          </div>
        </Tooltip>
        <Tooltip label="Not a real timelock here. A Lightning commitment tx hides its commitment number across locktime and sequence: the upper 8 bits are 0x20 and the lower 24 bits carry the lower half of the obscured commitment number, the 48-bit count XORed with the lower 48 bits of SHA256(payment_basepoint_open || payment_basepoint_accept). That lets a node recognize which state was broadcast without leaking the channel's payment count to outside observers.">
          <div>
            <span className="opacity-60">locktime:</span>{" "}
            <span className="font-bold">0x20</span>
            <span style={{ color: "#7b4b8a", fontWeight: 700 }}>‖&lt;commit_lo&gt;</span>
          </div>
        </Tooltip>
      </div>

      {/* Inputs */}
      <div className="mb-2">
        <Tooltip label="The previous outputs this transaction spends. A commitment tx always has exactly one input: the channel's funding output (a 2-of-2 multisig).">
          <div
            className="text-[9px] uppercase tracking-[0.08em] font-bold opacity-60 mb-1"
            style={{ color: INK }}
          >
            inputs
          </div>
        </Tooltip>
        <div
          className="border-[1.5px] px-2 py-1.5 text-[10px] leading-tight"
          style={{
            borderColor: SLATE,
            background: "#fffdf5",
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          }}
        >
          <Tooltip label="Transaction ID of the previous output being spent. For a commitment tx, this is the funding transaction's txid, the on-chain anchor of the channel.">
            <div>
              <span className="opacity-60">txid:</span>{" "}
              <span className="font-bold">{fundingTxid ?? "-"}</span>
            </div>
          </Tooltip>
          <Tooltip label="Output index within the funding transaction. The funding output is at index 0 in our model.">
            <div>
              <span className="opacity-60">index:</span>{" "}
              <span className="font-bold">0</span>
            </div>
          </Tooltip>
          <Tooltip label="Legacy script-signature field. SegWit moved authentication into the witness, so this stays empty. Both signatures live in the witness section below.">
            <div>
              <span className="opacity-60">scriptSig:</span>{" "}
              <span className="font-bold">(empty)</span>
            </div>
          </Tooltip>
          <Tooltip label="The other half of the hidden commitment number: the upper 8 bits are 0x80 and the lower 24 bits carry the upper half of the obscured commitment number (locktime holds the lower half). The 0x80 high byte also leaves BIP 68 relative-timelock disabled on this input; the per-output to_self_delay lives in the output scripts instead.">
            <div>
              <span className="opacity-60">sequence:</span>{" "}
              <span className="font-bold">0x80</span>
              <span style={{ color: "#7b4b8a", fontWeight: 700 }}>‖&lt;commit_hi&gt;</span>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* Outputs */}
      <div className="mb-2">
        <Tooltip label="The new outputs created by this transaction. A typical commitment tx has two outputs (to_local and to_remote) plus an extra HTLC output for each in-flight payment.">
          <div
            className="text-[9px] uppercase tracking-[0.08em] font-bold opacity-60 mb-1"
            style={{ color: INK }}
          >
            outputs
          </div>
        </Tooltip>
        <div className="space-y-1.5">
          {outputs.map((o, i) => (
            <div
              key={`${o.role}-${i}`}
              className="overflow-hidden"
              style={{
                transition:
                  "max-height 700ms ease-in-out, opacity 700ms ease-in-out, margin 700ms ease-in-out",
                maxHeight: 200,
                opacity: 1,
              }}
            >
              <OutputRowFull
                o={o}
                onHover={() => setHoveredIdx(i)}
                onLeave={() => setHoveredIdx(null)}
                isHovered={hoveredIdx === i}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Witness */}
      <div>
        <Tooltip label="The SegWit witness: the script and signatures that authorize spending the input. The funding output is a 2-of-2 multisig, so its witness contains both channel partners' signatures.">
          <div
            className="text-[9px] uppercase tracking-[0.08em] font-bold opacity-60 mb-1"
            style={{ color: INK }}
          >
            witness
          </div>
        </Tooltip>
        <Tooltip label="Both signatures are required to spend the funding output. Each side signs the other's commitment tx so they can broadcast it unilaterally if the channel goes uncooperative.">
          <div
            className="border-[1.5px] px-2 py-1.5 text-[10px]"
            style={{
              borderColor: SLATE,
              background: "#fffdf5",
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            }}
          >
            <span className="font-bold">{witnessSigs?.[0] ?? "<alice_sig>"}</span>{" "}
            <span className="font-bold">{witnessSigs?.[1] ?? "<bob_sig>"}</span>
          </div>
        </Tooltip>
      </div>
    </div>

    {/* Witness-script side panel, appears when an output with a
        witnessScript is hovered. Shows the script, a SHA256 indicator, and
        an arrow back to the <script_hash> placeholder in the main card. */}
    {showWitness && hoveredOutput?.witnessScript && (
      <WitnessScriptPanel
        script={hoveredOutput.witnessScript}
        outputLabel={hoveredOutput.label}
      />
    )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// WitnessScriptPanel, side panel rendered next to the full-mode card when an
// output is hovered. Echoes the BOLT 3 layout: the witness script lines on
// top, a SHA256 diamond beneath, and a callout indicating the resulting hash
// fills the <script_hash> placeholder in the parent output's scriptPubKey.
// ────────────────────────────────────────────────────────────────────────────

function WitnessScriptPanel({
  script,
  outputLabel,
}: {
  script: string[];
  outputLabel: string;
}) {
  return (
    <div
      className="border-[1.5px] flex flex-col"
      style={{
        borderColor: AMBER,
        borderStyle: "dashed",
        background: "#fffdf5",
        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        width: 280,
        marginLeft: 12,
        flexShrink: 0,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Header strip */}
      <div
        className="border-b-[1.5px] px-3 py-2 flex items-center gap-2"
        style={{ borderColor: INK }}
      >
        <div className="w-1.5 h-1.5" style={{ background: AMBER }} />
        <span
          className="text-[10px] font-bold tracking-[0.06em] uppercase"
          style={{ color: INK }}
        >
          Witness Script
        </span>
        <span
          className="ml-auto text-[9px] italic opacity-70"
          style={{ color: SLATE }}
        >
          for {outputLabel}
        </span>
      </div>

      {/* Script body */}
      <div
        className="px-3 py-2 text-[10px] leading-snug"
        style={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          color: INK,
        }}
      >
        {script.map((line, i) => {
          const trimmed = line.trim();
          const isOpcode =
            trimmed.startsWith("OP_") || /^\d+$/.test(trimmed);
          const isPlaceholder =
            trimmed.startsWith("<") && trimmed.endsWith(">");
          return (
            <div
              key={i}
              style={{
                color: isOpcode
                  ? AMBER
                  : isPlaceholder
                    ? "#7b4b8a"
                    : INK,
                fontWeight: isOpcode ? 700 : 500,
                whiteSpace: "pre",
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* Down-arrow + SHA256 diamond. SVG approach keeps the text upright
          inside a rotated diamond fill, avoiding the double-rotation trick
          (which mangled the glyphs). */}
      <div className="flex flex-col items-center pb-1">
        <div
          className="text-[14px] leading-none"
          style={{ color: AMBER, marginTop: -2 }}
        >
          ↓
        </div>
        <svg
          width="110"
          height="56"
          viewBox="0 0 110 56"
          aria-hidden
          style={{ marginTop: 4, marginBottom: 4 }}
        >
          <polygon
            points="55,4 106,28 55,52 4,28"
            fill={AMBER}
            stroke={AMBER}
            strokeWidth={1.5}
          />
          <text
            x={55}
            y={32}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill="#fffdf5"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            style={{ letterSpacing: "0.08em" }}
          >
            SHA256
          </text>
        </svg>
        <div
          className="text-[14px] leading-none"
          style={{ color: AMBER }}
        >
          ↓
        </div>
      </div>

      {/* Result callout */}
      <div className="px-3 pb-3 pt-1">
        <div
          className="border-[1.5px] px-2 py-1.5 text-[10px] leading-snug"
          style={{
            borderColor: AMBER,
            borderStyle: "dashed",
            background: "#fef3c7",
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            color: INK,
          }}
        >
          <span style={{ fontWeight: 700, color: AMBER }}>
            &lt;script_hash&gt;
          </span>{" "}
          <span style={{ opacity: 0.8 }}>
            fills the placeholder in scriptPubKey above ↰
          </span>
        </div>
      </div>
    </div>
  );
}

export default CommitmentTxCard;
