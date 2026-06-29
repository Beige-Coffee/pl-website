import { useEffect, useState } from "react";
import { Tok, mathLineToSvgTspans } from "./mathTokens";
import { renderCaption } from "./captionMarkup";

// ────────────────────────────────────────────────────────────────────────────
// KdfPipelineDiagram (DRAFT)
//
// Flow chart: source → HMAC formula box → key box (with role description
// embedded). Each row reads cleanly horizontally and the formulas are
// properly contained in their own boxes instead of floating along
// connector lines.
//
// Clicking any key chip opens a popover that shows how that key is used on
// a small Sphinx packet (HEADER / PAYLOAD AREA / HMAC), reusing the same
// packet visualization as the operations-lifecycle and slice-in-packet
// diagrams. The popover is the chapter-closing "bring it all home" moment
// where the kdf and the packet operations finally connect.
//
// Visual style follows the locked onion-routing format spec.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';

type KeyName = "rho" | "mu" | "um" | "ammag" | "pad";
type KdfSource = "perhop" | "session";

interface KeySpec {
  name: KeyName;
  color: string;
  use: string;
  source: KdfSource;
  detail: string;
}

const KEYS: KeySpec[] = [
  {
    name: "rho",
    color: "#b8860b",
    use: "Stream cipher key (forward)",
    source: "perhop",
    detail:
      "This is the one that actually encrypts. It becomes a 1,300-byte `ChaCha20` keystream, XORed across the hop payload area every time a layer gets wrapped or peeled.",
  },
  {
    name: "mu",
    color: "#3b6aa0",
    use: "Packet HMAC key (forward)",
    source: "perhop",
    detail:
      "Stamps the next layer's contents with a 32-byte HMAC tag. A forwarder checks this *first*, before it decrypts anything. If the tag doesn't match, the packet gets tossed (no point decrypting bytes someone tampered with).",
  },
  {
    name: "um",
    color: "#2d7a7a",
    use: "Error HMAC key (return)",
    source: "perhop",
    detail:
      "If this hop has to fail the payment, it signs the error packet with um. On the way back, Alice checks these HMACs to figure out *which* hop failed and read the failure code.",
  },
  {
    name: "ammag",
    color: "#5a7a2f",
    use: "Stream cipher key (return)",
    source: "perhop",
    detail:
      "The return-path cipher key. Each hop wraps the error in one more layer of ammag keystream on the way back, and Alice peels them off in order.",
  },
  {
    name: "pad",
    color: "#5b6b8a",
    use: "Buffer init (sender-only)",
    source: "session",
    detail:
      "The odd one out. Alice derives it once from her session key (not from any per-hop secret) and uses it to pre-fill the 1,300-byte buffer with random-looking bytes before any layer goes on. Forwarders never touch it.",
  },
];

const ERROR_COLOR = "#a13a3a";

// Canonical hop palette used inside the demo packet (HEADER tint, layered
// payload hatches). Matches the forward packet's encryption layers shown in
// SliceInPacketDiagram and OperationsLifecycleDiagram.
// Encryption hatch styling pinned to the shared spec (encryptionHatch.tsx)
// so this visual stays in lockstep with WrapPrimer/PeelPrimer.
import {
  LAYER_ANGLES as SHARED_LAYER_ANGLES,
  LAYER_COLORS as SHARED_LAYER_COLORS,
  singleHatchBackground,
} from "./encryptionHatch";
const LAYER_COLORS = SHARED_LAYER_COLORS;
const LAYER_ANGLES = SHARED_LAYER_ANGLES;
type ForwarderId = keyof typeof LAYER_COLORS;

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────

export function KdfPipelineDiagram() {
  const [activeKey, setActiveKey] = useState<KeyName | null>(null);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="onion-kdf-pipeline"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            Five keys from one secret
          </span>
        </div>
      </div>

      {/* Cream stage. Default content is the flow chart; when a key is
          clicked, the same stage swaps in the demo for that key with an X
          to close back to the flow chart. */}
      <div
        className="relative bg-[#fefdfb] px-4 py-6"
        style={{ minHeight: 380 }}
      >
        {activeKey ? (
          <KeyDemoInline
            keyName={activeKey}
            onClose={() => setActiveKey(null)}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <svg
                viewBox="0 0 700 360"
                className="w-full max-w-5xl mx-auto"
                style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
              >
                {renderSources()}
                {renderConnectorsToFormulas()}
                {renderFormulaBoxes()}
                {renderConnectorsFormulaToKey()}
                {renderKeyBoxes(activeKey, setActiveKey)}
              </svg>
            </div>

            {/* Hint */}
            <div
              className="text-center text-xs italic mt-3"
              style={{ color: "#475569" }}
            >
              Click any key to see how it's used.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SVG layout helpers : coordinate constants
// ────────────────────────────────────────────────────────────────────────────

const ROWS_TOP = 18;
const KEY_BOX_H = 56;
const FORMULA_BOX_H = 36;
const ROW_GAP = 12;
const ROW_OUTER_H = KEY_BOX_H + ROW_GAP;

function rowCenterY(i: number): number {
  return ROWS_TOP + i * ROW_OUTER_H + KEY_BOX_H / 2;
}

const SRC_X = 20;
const SRC_W = 150;
const SRC_RIGHT = SRC_X + SRC_W;

const FORMULA_X = 200;
const FORMULA_W = 200;
const FORMULA_RIGHT = FORMULA_X + FORMULA_W;

const KEY_X = 430;
const KEY_W = 250;
const KEY_RIGHT = KEY_X + KEY_W;

// shared_secret feeds rows 0-3 (rho/mu/um/ammag); session_key feeds row 4 (pad)
const SHARED_SRC_H = 60;
const SHARED_SRC_CENTER_Y =
  (rowCenterY(0) + rowCenterY(3)) / 2;
const SHARED_SRC_Y = SHARED_SRC_CENTER_Y - SHARED_SRC_H / 2;

const SESSION_SRC_H = 60;
const SESSION_SRC_CENTER_Y = rowCenterY(4);
const SESSION_SRC_Y = SESSION_SRC_CENTER_Y - SESSION_SRC_H / 2;

// ────────────────────────────────────────────────────────────────────────────
// renderSources : the two source boxes on the left
// ────────────────────────────────────────────────────────────────────────────

function renderSources() {
  return (
    <g>
      <rect
        x={SRC_X}
        y={SHARED_SRC_Y}
        width={SRC_W}
        height={SHARED_SRC_H}
        rx={2}
        fill="#fffdf5"
        stroke="#b8860b"
        strokeWidth={1.5}
      />
      <text
        x={SRC_X + SRC_W / 2}
        y={SHARED_SRC_Y + 26}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill="#0f172a"
      >
        shared_secret
      </text>
      <text
        x={SRC_X + SRC_W / 2}
        y={SHARED_SRC_Y + 44}
        textAnchor="middle"
        fontSize={9}
        fill="#475569"
        style={{ fontFamily: MONO }}
      >
        ssᵢ (per hop, 32 bytes)
      </text>

      <rect
        x={SRC_X}
        y={SESSION_SRC_Y}
        width={SRC_W}
        height={SESSION_SRC_H}
        rx={2}
        fill="#fffdf5"
        stroke="#5b6b8a"
        strokeWidth={1.5}
      />
      <text
        x={SRC_X + SRC_W / 2}
        y={SESSION_SRC_Y + 26}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fill="#0f172a"
      >
        session_key
      </text>
      <text
        x={SRC_X + SRC_W / 2}
        y={SESSION_SRC_Y + 44}
        textAnchor="middle"
        fontSize={9}
        fill="#475569"
        style={{ fontFamily: MONO }}
      >
        per payment, 32 bytes
      </text>
    </g>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// renderConnectorsToFormulas : bezier curves source.right → formula.left
// ────────────────────────────────────────────────────────────────────────────

function renderConnectorsToFormulas() {
  return (
    <g>
      {KEYS.map((k, i) => {
        const isSession = k.source === "session";
        const sourceY = isSession
          ? SESSION_SRC_CENTER_Y
          : SHARED_SRC_CENTER_Y;
        const targetY = rowCenterY(i);
        const cx1 = SRC_RIGHT + 50;
        const cx2 = FORMULA_X - 50;
        return (
          <path
            key={`src-conn-${k.name}`}
            d={`M${SRC_RIGHT},${sourceY} C${cx1},${sourceY} ${cx2},${targetY} ${FORMULA_X},${targetY}`}
            fill="none"
            stroke={k.color}
            strokeWidth={1.5}
            opacity={0.85}
          />
        );
      })}
    </g>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// renderFormulaBoxes : a clean rectangle per row containing the HMAC formula
// ────────────────────────────────────────────────────────────────────────────

function renderFormulaBoxes() {
  return (
    <g>
      {KEYS.map((k, i) => {
        const cy = rowCenterY(i);
        const y = cy - FORMULA_BOX_H / 2;
        const sourceLabel = k.source === "session" ? "session_key" : "ssᵢ";
        return (
          <g key={`formula-${k.name}`}>
            <rect
              x={FORMULA_X}
              y={y}
              width={FORMULA_W}
              height={FORMULA_BOX_H}
              rx={2}
              fill="#fffdf5"
              stroke={k.color}
              strokeWidth={1.5}
            />
            <text
              x={FORMULA_X + FORMULA_W / 2}
              y={cy + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill={k.color}
              style={{ fontFamily: MONO }}
            >
              {mathLineToSvgTspans(`HMAC('${k.name}', ${sourceLabel})`)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// renderConnectorsFormulaToKey : straight arrow formula.right → key.left
// ────────────────────────────────────────────────────────────────────────────

function renderConnectorsFormulaToKey() {
  return (
    <g>
      {KEYS.map((k, i) => {
        const y = rowCenterY(i);
        const arrowEnd = KEY_X - 4;
        return (
          <g key={`mid-conn-${k.name}`}>
            <line
              x1={FORMULA_RIGHT}
              y1={y}
              x2={arrowEnd - 6}
              y2={y}
              stroke={k.color}
              strokeWidth={1.5}
            />
            <polygon
              points={`${arrowEnd},${y} ${arrowEnd - 8},${y - 4} ${
                arrowEnd - 8
              },${y + 4}`}
              fill={k.color}
            />
          </g>
        );
      })}
    </g>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// renderKeyBoxes : larger clickable cards with the key name + description
// embedded inside the box (no separate use-label column)
// ────────────────────────────────────────────────────────────────────────────

function renderKeyBoxes(
  activeKey: KeyName | null,
  setActiveKey: (k: KeyName | null) => void,
) {
  return (
    <g>
      {KEYS.map((k, i) => {
        const isActive = activeKey === k.name;
        const cy = rowCenterY(i);
        const y = cy - KEY_BOX_H / 2;
        return (
          <g
            key={`key-${k.name}`}
            onClick={() => setActiveKey(isActive ? null : k.name)}
            style={{ cursor: "pointer" }}
            data-testid={`onion-kdf-key-${k.name}`}
          >
            <rect
              x={KEY_X}
              y={y}
              width={KEY_W}
              height={KEY_BOX_H}
              rx={3}
              fill={hexToRgba(k.color, 0.16)}
              stroke={k.color}
              strokeWidth={isActive ? 2.5 : 1.5}
            />
            {/* Key name (large, top-left) */}
            <text
              x={KEY_X + 14}
              y={y + 24}
              fontSize={20}
              fontWeight={700}
              fill={k.color}
              style={{ fontFamily: MONO, pointerEvents: "none" }}
            >
              {k.name}
            </text>
            {/* "32 bytes" tag (small, bottom-left, italic) */}
            <text
              x={KEY_X + 14}
              y={y + 42}
              fontSize={10}
              fill={k.color}
              style={{
                fontFamily: MONO,
                fontStyle: "italic",
                opacity: 0.75,
                pointerEvents: "none",
              }}
            >
              32 bytes
            </text>
            {/* Description (right side, two lines fit comfortably) */}
            <text
              x={KEY_X + KEY_W - 14}
              y={y + 24}
              textAnchor="end"
              fontSize={11}
              fontWeight={700}
              fill="#0f172a"
              style={{ pointerEvents: "none" }}
            >
              {k.use.split("(")[0].trim()}
            </text>
            <text
              x={KEY_X + KEY_W - 14}
              y={y + 42}
              textAnchor="end"
              fontSize={10}
              fill="#475569"
              style={{ fontStyle: "italic", pointerEvents: "none" }}
            >
              ({k.use.split("(")[1]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// KeyDemoInline : renders the demo for the active key inside the same cream
// stage, replacing the flow chart. A small × button at the top-right closes
// it and brings the flow chart back.
// ────────────────────────────────────────────────────────────────────────────

function KeyDemoInline({
  keyName,
  onClose,
}: {
  keyName: KeyName;
  onClose: () => void;
}) {
  const spec = KEYS.find((k) => k.name === keyName)!;
  const [replayCounter, setReplayCounter] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="relative"
      data-testid={`onion-kdf-demo-${keyName}`}
    >
      {/* Top bar with key label + replay/close controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 12,
              height: 12,
              background: spec.color,
              border: "1.5px solid #0f172a",
            }}
          />
          <span
            className="text-base font-bold tracking-[0.05em] uppercase"
            style={{ fontFamily: MONO, color: spec.color }}
          >
            {spec.name}
          </span>
          <span
            className="text-[11px] uppercase tracking-[0.08em]"
            style={{ color: "#475569" }}
          >
            {spec.use}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReplayCounter((n) => n + 1)}
            className="text-[10px] uppercase tracking-[0.08em] font-bold border-[1.5px] border-foreground/40 px-2 py-1 hover:bg-foreground/5"
            data-testid="onion-kdf-demo-replay"
          >
            ↻ Replay
          </button>
          <button
            onClick={onClose}
            className="text-lg leading-none px-2 border-[1.5px] border-foreground/40 hover:bg-foreground/5"
            style={{ color: "#0f172a", height: 28, width: 28 }}
            aria-label="Close"
            data-testid="onion-kdf-demo-close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Demo packet + legend */}
      <OnionPacketDemo keyName={keyName} replayCounter={replayCounter} />

      {/* Detail caption below the demo */}
      <div
        className="border-[1.5px] mt-3 px-3 py-2 text-sm leading-relaxed"
        style={{
          borderColor: hexToRgba(spec.color, 0.3),
          background: "#fffdf5",
          color: "#0f172a",
        }}
      >
        {renderCaption(spec.detail)}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// OnionPacketDemo : mini Sphinx packet (HEADER / PAYLOAD / HMAC) animated
// to show how the active key transforms the packet. Reuses the same visual
// language as SliceInPacketDiagram and OperationsLifecycleDiagram.
// ────────────────────────────────────────────────────────────────────────────

function OnionPacketDemo({
  keyName,
  replayCounter,
}: {
  keyName: KeyName;
  replayCounter: number;
}) {
  const spec = KEYS.find((k) => k.name === keyName)!;
  const isError = keyName === "um" || keyName === "ammag";
  const isPad = keyName === "pad";
  const focus: "payload" | "hmac" =
    keyName === "mu" || keyName === "um" ? "hmac" : "payload";

  // Animation key forces re-render and replays CSS animations.
  const animKey = `${keyName}-${replayCounter}`;

  // What state does the packet start/end in for each key?
  // - rho: bytes already in payload (from pad). Hatches sweep in. HMAC empty.
  // - mu: bytes + 3 hatches already there. HMAC tag fills in.
  // - um: error packet bytes appear (no red hatch yet). HMAC tag fills in over
  //   the un-encrypted error (MAC-then-encrypt: um runs before ammag).
  // - ammag: error bytes + tag already there. Red hatch sweeps in over them.
  // - pad: empty payload. Bytes fill in left to right. HMAC absent.

  return (
    <div className="flex flex-col items-stretch gap-4" key={animKey}>
      <style>{`
        @keyframes demo-bytes-fill {
          0% { opacity: 0; clip-path: inset(0 100% 0 0); }
          10% { opacity: 1; }
          100% { opacity: 1; clip-path: inset(0 0 0 0); }
        }
        @keyframes demo-hatch-sweep {
          0% { opacity: 0; clip-path: inset(0 100% 0 0); }
          100% { opacity: 1; clip-path: inset(0 0 0 0); }
        }
        @keyframes demo-tag-byte {
          0% { opacity: 0; transform: translateY(-2px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes demo-region-glow {
          0%, 100% { box-shadow: inset 0 0 0 2px transparent; }
          50% { box-shadow: inset 0 0 0 2px ${hexToRgba(spec.color, 0.7)}; }
        }
        @keyframes demo-bytes-fade {
          0% { opacity: 0; }
          15% { opacity: 1; }
          100% { opacity: 1; }
        }
      `}</style>

      <DemoPacket
        keyName={keyName}
        spec={spec}
        focus={focus}
        isError={isError}
        isPad={isPad}
      />

      {/* Operation legend */}
      <DemoLegend keyName={keyName} spec={spec} />
    </div>
  );
}

function DemoPacket({
  keyName,
  spec,
  focus,
  isError,
  isPad,
}: {
  keyName: KeyName;
  spec: KeySpec;
  focus: "payload" | "hmac";
  isError: boolean;
  isPad: boolean;
}) {
  // 32 bytes for the HMAC tag display
  const tagBytes = Array.from({ length: 32 }, (_, i) =>
    ((i * 53 + 17) % 256).toString(16).padStart(2, "0"),
  );

  // Bytes for the payload area (display)
  const payloadBytes = Array.from({ length: 60 }, (_, i) =>
    ((i * 37 + 9) % 256).toString(16).padStart(2, "0"),
  );

  const accentColor = spec.color;

  // Hatches state per key (MAC-then-encrypt: um runs before ammag)
  // - rho: 3 hatches sweep in
  // - mu: 3 hatches already visible at start (rho's done)
  // - um: no red hatch yet (HMAC is taken over the un-encrypted error)
  // - ammag: 1 red hatch sweeps in (over the already-tagged error)
  // - pad: no hatches at all
  const hatchSweep = keyName === "rho" || keyName === "ammag";
  const hatchesVisible =
    keyName === "rho" ||
    keyName === "mu" ||
    keyName === "ammag";

  // Bytes state
  // - rho/mu: bytes visible immediately
  // - ammag/um: bytes visible immediately
  // - pad: bytes fill in over time
  const bytesAnimateIn = isPad;

  // HMAC tag visibility
  // - mu/um: tag fills in byte-by-byte
  // - rho/ammag: tag empty (HMAC region dim, "(not yet)")
  // - pad: HMAC region absent (or shown empty)
  const hmacRegionVisible = !isPad; // pad doesn't interact with HMAC
  const tagFillsIn = keyName === "mu" || keyName === "um";
  const tagAlreadyThere = false; // never start with the tag visible

  const headerColor = isError ? ERROR_COLOR : "#0f172a";
  const headerTint = isError
    ? hexToRgba(ERROR_COLOR, 0.14)
    : hexToRgba(LAYER_COLORS.bob, 0.18);

  return (
    <div
      className="border-[1.5px]"
      style={{
        background: "#fffdf5",
        borderColor: headerColor,
      }}
    >
      {/* Black mini header */}
      <div
        className="px-3 py-1.5 flex items-center gap-2"
        style={{
          background: isError ? ERROR_COLOR : "#000",
          color: "#fffdf5",
          fontFamily: MONO,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            background: isError ? "#fffdf5" : "#b8860b",
            display: "inline-block",
          }}
        />
        <span className="text-[10px] uppercase tracking-[0.1em] font-bold">
          {isError ? "error_packet" : "onion_routing_packet"}
        </span>
      </div>

      <div className="p-3">
        <div
          className="border-[1.5px] flex"
          style={{
            background: "#fffdf5",
            borderColor: headerColor,
          }}
        >
          {/* HEADER region (forward only, dim) */}
          {!isError && (
            <div
              className="flex flex-col items-center justify-center text-center border-r-[1.5px]"
              style={{
                flexBasis: "16%",
                borderColor: headerColor,
                color: "#0f172a",
                padding: "8px 6px",
                minWidth: 0,
                background: headerTint,
                opacity: 0.45,
                filter: "saturate(0.7)",
              }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-[0.06em] leading-tight"
                style={{ fontFamily: MONO }}
              >
                HEADER
              </span>
              <span
                className="text-[8px] uppercase tracking-[0.05em] opacity-70 leading-tight mt-1"
                style={{ fontFamily: MONO }}
              >
                version
              </span>
              <span
                className="text-[10px] font-bold leading-tight"
                style={{ fontFamily: MONO, color: "#0f172a" }}
              >
                0x00
              </span>
              <span
                className="text-[8px] uppercase tracking-[0.05em] opacity-70 leading-tight mt-1"
                style={{ fontFamily: MONO }}
              >
                ephemeral pubkey
              </span>
              <span
                className="font-bold leading-tight"
                style={{
                  fontFamily: MONO,
                  color: LAYER_COLORS.bob,
                  fontSize: 14,
                }}
              >
                <Tok token="E_AB" color={LAYER_COLORS.bob} />
              </span>
            </div>
          )}

          {/* PAYLOAD AREA */}
          <div
            className="flex flex-col"
            style={{
              flex: 1,
              borderRight: hmacRegionVisible
                ? `1.5px solid ${headerColor}`
                : "none",
              padding: "8px 8px",
              minWidth: 0,
              background:
                focus === "payload"
                  ? hexToRgba(accentColor, 0.12)
                  : "transparent",
              boxShadow:
                focus === "payload"
                  ? `inset 0 0 0 2px ${accentColor}`
                  : "none",
              transition: "background 400ms, box-shadow 400ms",
            }}
          >
            <div className="text-center mb-1.5">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.08em] leading-tight"
                style={{ fontFamily: MONO, color: "#0f172a" }}
              >
                {isError ? "ERROR PAYLOAD" : "PAYLOAD AREA"}
              </span>
            </div>
            <div
              className="relative border-[1.5px]"
              style={{
                background: "#fffdf5",
                borderColor:
                  focus === "payload" ? accentColor : headerColor,
                height: 96,
                overflow: "hidden",
              }}
            >
              {/* Random bytes layer */}
              <div
                className="absolute inset-0 flex flex-wrap content-start"
                style={{
                  padding: "8px 6px",
                  gap: 3,
                  opacity: 1,
                  animation: bytesAnimateIn
                    ? `demo-bytes-fill 1800ms ease-out forwards`
                    : `demo-bytes-fade 700ms ease-out forwards`,
                }}
              >
                {payloadBytes.map((b, i) => (
                  <span
                    key={i}
                    className="text-[8px] leading-none"
                    style={{
                      fontFamily: MONO,
                      color: isError ? ERROR_COLOR : "#0f172a",
                      opacity: 0.55,
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>

              {/* Encryption hatches: shared-spec angles + stripe density,
                  with a tiny solid wash underneath each layer. Animation
                  sweep stays the same; only the density / angles changed
                  to match the locked HatchOverlay vocabulary. */}
              {hatchesVisible && !isError &&
                (["dave", "charlie", "bob"] as ForwarderId[]).map((hop) => {
                  const c = LAYER_COLORS[hop];
                  const delay =
                    ["dave", "charlie", "bob"].indexOf(hop) * 200;
                  const animation = hatchSweep
                    ? `demo-hatch-sweep 1800ms ease-out ${delay}ms forwards`
                    : undefined;
                  return (
                    <div key={hop} className="absolute inset-0">
                      <div
                        className="absolute inset-0"
                        style={{
                          background: c,
                          opacity: 0.08,
                          animation,
                        }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: singleHatchBackground(hop),
                          opacity: 0.6,
                          animation,
                        }}
                      />
                    </div>
                  );
                })}
              {/* Single red hatch for error packet */}
              {hatchesVisible && isError && (
                <div className="absolute inset-0">
                  <div
                    className="absolute inset-0"
                    style={{
                      background: ERROR_COLOR,
                      opacity: 0.08,
                      animation: hatchSweep
                        ? `demo-hatch-sweep 1800ms ease-out forwards`
                        : undefined,
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `repeating-linear-gradient(135deg, ${ERROR_COLOR} 0px, ${ERROR_COLOR} 2.5px, transparent 2.5px, transparent 11px)`,
                      opacity: 0.6,
                      animation: hatchSweep
                        ? `demo-hatch-sweep 1800ms ease-out forwards`
                        : undefined,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* HMAC region */}
          {hmacRegionVisible && (
            <div
              className="flex flex-col items-center justify-center text-center"
              style={{
                flexBasis: "22%",
                color: "#0f172a",
                padding: "8px 4px",
                minWidth: 0,
                background:
                  focus === "hmac"
                    ? hexToRgba(accentColor, 0.12)
                    : "transparent",
                boxShadow:
                  focus === "hmac"
                    ? `inset 0 0 0 2px ${accentColor}`
                    : "none",
                transition: "background 400ms, box-shadow 400ms",
              }}
            >
              <span
                className="text-[11px] font-bold uppercase tracking-[0.06em] leading-tight"
                style={{ fontFamily: MONO, color: isError ? ERROR_COLOR : "#0f172a" }}
              >
                HMAC
              </span>
              <span
                className="text-[8px] font-normal opacity-60 leading-tight mt-0.5"
                style={{ fontFamily: MONO }}
              >
                32-byte tag
              </span>
              {tagFillsIn ? (
                <div
                  className="mt-2 grid w-full"
                  style={{
                    gridTemplateColumns: "repeat(8, 1fr)",
                    gap: 1,
                    fontFamily: MONO,
                    fontSize: 7,
                    color: accentColor,
                    fontWeight: 700,
                    padding: "0 4px",
                  }}
                >
                  {tagBytes.map((b, i) => (
                    <span
                      key={i}
                      style={{
                        textAlign: "center",
                        opacity: 0,
                        animation: `demo-tag-byte 250ms ease-out ${
                          400 + i * 30
                        }ms forwards`,
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              ) : (
                <div
                  className="mt-2 text-[10px] italic opacity-50 leading-tight"
                  style={{ fontFamily: MONO }}
                >
                  (not yet)
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DemoLegend : a one-line operation summary below the packet
// ────────────────────────────────────────────────────────────────────────────

function DemoLegend({ keyName, spec }: { keyName: KeyName; spec: KeySpec }) {
  let text: string;
  switch (keyName) {
    case "rho":
      text = "Each forwarder XORs the entire 1,300-byte payload with a `ChaCha20` keystream derived from `rho`. Watch the encryption layers sweep in.";
      break;
    case "mu":
      text = "Alice runs `HMAC-SHA256` with `mu` over the encrypted payload to produce the 32-byte tag at the back of the packet. Watch the tag fill in.";
      break;
    case "ammag":
      text = "Bob (or any failing hop) wraps the error message with a `ChaCha20` keystream derived from `ammag`. Watch the red encryption layer sweep in.";
      break;
    case "um":
      text = "Bob runs `HMAC-SHA256` with `um` over the error message (before the `ammag` layer is applied) to produce the return-trip tag. Watch the tag fill in.";
      break;
    case "pad":
      text = "Before any onion layers are applied, Alice pre-fills the 1,300-byte payload area with a `ChaCha20` keystream derived from her session key. Watch the buffer fill from the left.";
      break;
  }

  return (
    <div
      className="border-[1.5px] px-3 py-2 text-[12px] leading-relaxed"
      style={{
        borderColor: spec.color,
        background: hexToRgba(spec.color, 0.08),
        color: "#0f172a",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <span
        className="font-bold mr-1"
        style={{ color: spec.color, fontFamily: MONO }}
      >
        {keyName}
      </span>
      <span style={{ opacity: 0.85 }}>·</span>
      <span style={{ marginLeft: 6 }}>{renderCaption(text)}</span>
    </div>
  );
}

export default KdfPipelineDiagram;
