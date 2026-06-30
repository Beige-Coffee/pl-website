import { useState } from "react";
import { StepCaption } from "./StepCaption";

// ────────────────────────────────────────────────────────────────────────────
// HmacChainDiagram  ("How the per-hop HMACs hold it together", ch.5)
//
// Nesting view (SVG, coordinate-exact connectors):
//   • Each OUTER HMAC arrows to a BRACKET spanning the exact payload bytes it
//     commits to, callout beside it.
//   • Each INNER HMAC (charlie_hmac inside Bob, dave_hmac inside Charlie) arrows
//     to the NEXT packet's outer HMAC, because it is literally that tag.
//   • Hovering a packet fades everything except that packet, its commit bracket,
//     its outgoing arrow, and the next packet's outer HMAC (the arrow's target),
//     so you can focus on one HMAC relationship at a time.
//   • Header + LEN/TLV faded; encrypted remainder ghosted behind a hatch.
//
// Tamper mode = editable bytes for Charlie's packet + live (illustrative) HMAC
// recompute.
// ────────────────────────────────────────────────────────────────────────────

const MONO = '"JetBrains Mono", "Fira Code", monospace';
const SANS = "ui-sans-serif, system-ui, sans-serif";
const INK = "#0f172a";
const SLATE = "#475569";
const FADE = 0.12;

type HopId = "bob" | "charlie" | "dave";
const HOP_FILL: Record<HopId, string> = { bob: "#dbeafe", charlie: "#ccece8", dave: "#ede1f3" };
const HOP_STROKE: Record<HopId, string> = { bob: "#3b6aa0", charlie: "#2d7a7a", dave: "#7b4b8a" };

const VB_W = 900;
const VB_H = 470;
const X0 = 24;
const C = { lenR: 150, tlvR: 270, hmacR: 330, encR: 762, outerR: 876 };
const HEADER_R = 118;
const PAY_L = HEADER_R;
const PAY_R = C.encR;
const HMAC_CX = (C.tlvR + C.hmacR) / 2;
const OUTER_CX = (C.encR + C.outerR) / 2;
const PKT_H = 54;
const TOPS = [56, 212, 368];

interface GhostSeg { label: string; hop: HopId | null; w: number }
interface PacketSpec {
  hop: HopId; viewer: string; ephemeral: string; lenHex: string; payloadName: string; payloadBytes: string;
  innerHmac: string; innerHmacHop: HopId | null; outerHmac: string; ghost: GhostSeg[];
}
const PACKETS: PacketSpec[] = [
  { hop: "bob", viewer: "What Bob receives", ephemeral: "E_AB", lenHex: "0x1B", payloadName: "Bob", payloadBytes: "60 B",
    innerHmac: "charlie_hmac", innerHmacHop: "charlie", outerHmac: "bob_hmac",
    ghost: [{ label: "Charlie payload", hop: "charlie", w: 24 }, { label: "Dave payload", hop: "dave", w: 28 }, { label: "padding", hop: null, w: 48 }] },
  { hop: "charlie", viewer: "What Charlie receives", ephemeral: "E_AC", lenHex: "0x2F", payloadName: "Charlie", payloadBytes: "80 B",
    innerHmac: "dave_hmac", innerHmacHop: "dave", outerHmac: "charlie_hmac",
    ghost: [{ label: "Dave payload", hop: "dave", w: 32 }, { label: "padding", hop: null, w: 68 }] },
  { hop: "dave", viewer: "What Dave receives", ephemeral: "E_AD", lenHex: "0x43", payloadName: "Dave", payloadBytes: "100 B",
    innerHmac: "0x00…", innerHmacHop: null, outerHmac: "dave_hmac",
    ghost: [{ label: "padding", hop: null, w: 100 }] },
];


export function HmacChainDiagram() {
  const [focus, setFocus] = useState<number | null>(null);

  return (
    <div className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden" data-testid="onion-hmac-chain" style={{ fontFamily: SANS }}>
      <div className="bg-black text-white px-4 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
        <span className="text-sm font-bold tracking-[0.08em] uppercase">
          How the per-hop HMACs nest
        </span>
      </div>

      <div className="relative bg-[#fefdfb] px-4 py-6">
        <div className="overflow-x-auto"><div className="mx-auto" style={{ minWidth: 720, maxWidth: 900 }}>
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block" }} fontFamily={MONO}>
            <defs>
              <pattern id="hmacEnc" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#64748b" strokeWidth="1.4" opacity="0.5" />
              </pattern>
            </defs>
            {PACKETS.map((p, i) => <PacketGroup key={p.hop} spec={p} top={TOPS[i]} idx={i} focus={focus} onFocus={setFocus} />)}
            {PACKETS.map((p, i) => <CommitBracket key={`b${p.hop}`} spec={p} top={TOPS[i]} dim={focus !== null && focus !== i} />)}
            {PACKETS.slice(0, 2).map((p, i) => (
              <NestingArrow key={`n${p.hop}`} fromTop={TOPS[i]} toTop={TOPS[i + 1]} tag={p.innerHmac}
                color={HOP_STROKE[p.innerHmacHop as HopId]} next={shortName(PACKETS[i + 1].viewer)} dim={focus !== null && focus !== i} />
            ))}
          </svg>
          <div className="text-center text-[11px] italic mt-1" style={{ color: SLATE }}>Hover a packet to isolate its HMAC relationships.</div>
          <StepCaption
            label="HMAC NESTING"
            title="Each HMAC commits to its own payload and everything beneath it"
            caption="Each outer HMAC brackets the exact bytes it commits to, and the tag inside one packet is the next packet's outer HMAC, since they're the same value. That nesting is what keeps a malicious hop honest: if a forwarder alters any byte beneath its own layer, the next hop's recomputed HMAC won't match what's in the packet, so the packet gets dropped."
            accentColor="#b8860b"
          />
        </div></div>
      </div>
    </div>
  );
}

function shortName(viewer: string): string { return viewer.replace("What ", "").replace(" receives", ""); }

// ── One packet drawn in SVG, with focus-aware opacity ────────────────────────
function PacketGroup({ spec, top, idx, focus, onFocus }: { spec: PacketSpec; top: number; idx: number; focus: number | null; onFocus: (i: number | null) => void }) {
  const stroke = HOP_STROKE[spec.hop];
  const fill = HOP_FILL[spec.hop];
  const innerColor = spec.innerHmacHop ? HOP_STROKE[spec.innerHmacHop] : SLATE;
  const cy = top + PKT_H / 2;
  // body lit when no focus or this packet is focused; outer HMAC also lit when
  // this packet is the *target* of the focused packet's arrow (focus === idx-1).
  const body = focus === null || focus === idx ? 1 : FADE;
  const outer = focus === null || focus === idx || focus === idx - 1 ? 1 : FADE;

  const encL = C.hmacR, encR = C.encR, encW = encR - encL;
  let acc = encL;
  const segs = spec.ghost.map((g) => { const x = acc; const w = (g.w / 100) * encW; acc += w; return { ...g, x, w }; });

  return (
    <g>
      {/* body group (everything except outer HMAC) */}
      <g opacity={body} style={{ transition: "opacity 200ms" }}>
        <text x={X0} y={top - 9} fontSize="11" fontWeight="700" fill={stroke} letterSpacing="0.06em">{spec.viewer.toUpperCase()}</text>
        <text x={C.outerR} y={top - 9} fontSize="10" fill={SLATE} textAnchor="end">1,366 bytes</text>

        <g opacity="0.4">
          <rect x={X0} y={top} width={HEADER_R - X0} height={PKT_H} fill="#f1f5f9" stroke={INK} strokeWidth="1.5" />
          <text x={(X0 + HEADER_R) / 2} y={cy - 4} fontSize="8" fontWeight="700" fill={SLATE} textAnchor="middle">HEADER</text>
          <text x={(X0 + HEADER_R) / 2} y={cy + 11} fontSize="12" fontWeight="700" fill={stroke} textAnchor="middle">{spec.ephemeral}</text>
        </g>
        <g opacity="0.4">
          <rect x={HEADER_R} y={top} width={C.lenR - HEADER_R} height={PKT_H} fill={fill} stroke={`${stroke}80`} strokeWidth="1" />
          <text x={(HEADER_R + C.lenR) / 2} y={cy - 3} fontSize="7" fontWeight="700" fill={SLATE} textAnchor="middle">LEN</text>
          <text x={(HEADER_R + C.lenR) / 2} y={cy + 9} fontSize="8.5" fontWeight="700" fill={stroke} textAnchor="middle">{spec.lenHex}</text>
          <rect x={C.lenR} y={top} width={C.tlvR - C.lenR} height={PKT_H} fill={fill} stroke={`${stroke}80`} strokeWidth="1" />
          <text x={(C.lenR + C.tlvR) / 2} y={cy - 2} fontSize="10" fontWeight="700" fill={stroke} textAnchor="middle">{spec.payloadName}</text>
          <text x={(C.lenR + C.tlvR) / 2} y={cy + 11} fontSize="8" fontStyle="italic" fill={SLATE} textAnchor="middle">{spec.payloadBytes}</text>
        </g>

        {/* INNER HMAC (the arrow source) */}
        <rect x={C.tlvR} y={top} width={C.hmacR - C.tlvR} height={PKT_H} fill={spec.innerHmacHop ? `${innerColor}22` : "#fff"} stroke={innerColor} strokeWidth="1.5" />
        <text x={HMAC_CX} y={cy - 4} fontSize="7" fontWeight="700" fill={SLATE} textAnchor="middle">HMAC</text>
        <text x={HMAC_CX} y={cy + 10} fontSize="8" fontWeight="700" fill={innerColor} textAnchor="middle">{spec.innerHmac}</text>

        {/* encrypted remainder: ghosts + hatch */}
        {segs.map((s, i) => (
          <g key={i} opacity="0.4">
            <rect x={s.x} y={top} width={s.w} height={PKT_H} fill={s.hop ? HOP_FILL[s.hop] : "#e2e8f0"} stroke={`${INK}25`} strokeWidth="1" />
            <text x={s.x + s.w / 2} y={cy + 3} fontSize="8" fontStyle="italic" fill={s.hop ? HOP_STROKE[s.hop] : SLATE} textAnchor="middle">{s.label}</text>
          </g>
        ))}
        <rect x={encL} y={top} width={encW} height={PKT_H} fill="url(#hmacEnc)" />
        <rect x={encL} y={top} width={encW} height={PKT_H} fill="none" stroke={INK} strokeWidth="1" strokeDasharray="2 2" />
        <text x={(encL + encR) / 2} y={cy - 14} fontSize="8" fill={SLATE} textAnchor="middle">encrypted (hidden behind {spec.hop[0].toUpperCase() + spec.hop.slice(1)}'s layer)</text>

        {/* packet border */}
        <rect x={X0} y={top} width={C.outerR - X0} height={PKT_H} fill="none" stroke={INK} strokeWidth="1.5" />
      </g>

      {/* OUTER HMAC (own opacity so it can stay lit as an arrow target) */}
      <g opacity={outer} style={{ transition: "opacity 200ms" }}>
        <rect x={C.encR} y={top} width={C.outerR - C.encR} height={PKT_H} fill={`${stroke}1f`} stroke={INK} strokeWidth="1.5" />
        <text x={OUTER_CX} y={cy - 6} fontSize="8" fontWeight="700" fill={SLATE} textAnchor="middle">OUTER HMAC</text>
        <text x={OUTER_CX} y={cy + 9} fontSize="11" fontWeight="700" fill={stroke} textAnchor="middle">{spec.outerHmac}</text>
      </g>

      {/* transparent hover target over the whole packet bar */}
      <rect x={X0} y={top} width={C.outerR - X0} height={PKT_H} fill="transparent" style={{ cursor: "pointer" }}
        onMouseEnter={() => onFocus(idx)} onMouseLeave={() => onFocus(null)} />
    </g>
  );
}

function CommitBracket({ spec, top, dim }: { spec: PacketSpec; top: number; dim: boolean }) {
  const stroke = HOP_STROKE[spec.hop];
  const bot = top + PKT_H;
  const by = bot + 12;
  const midX = (PAY_L + PAY_R) / 2;
  return (
    <g opacity={dim ? FADE : 1} style={{ transition: "opacity 200ms" }}>
      <path d={`M ${PAY_L} ${bot + 3} L ${PAY_L} ${by} L ${PAY_R} ${by} L ${PAY_R} ${bot + 3}`} fill="none" stroke={stroke} strokeWidth="1.5" />
      <path d={`M ${OUTER_CX} ${bot + 1} L ${OUTER_CX} ${by} L ${PAY_R + 6} ${by}`} fill="none" stroke={stroke} strokeWidth="1.5" />
      <path d={`M ${PAY_R + 12} ${by} l 7 -3.5 l 0 7 z`} fill={stroke} transform={`rotate(180 ${PAY_R + 8} ${by})`} />
      <text x={midX} y={by + 13} fontSize="10.5" fontWeight="700" fill={stroke} textAnchor="middle">{spec.outerHmac} commits to all of this</text>
    </g>
  );
}

function NestingArrow({ fromTop, toTop, tag, color, next, dim }: { fromTop: number; toTop: number; tag: string; color: string; next: string; dim: boolean }) {
  const startY = fromTop + PKT_H;
  const endY = toTop;
  const midY = (startY + toTop) / 2 + 16;
  return (
    <g opacity={dim ? FADE : 1} style={{ transition: "opacity 200ms" }}>
      <path d={`M ${HMAC_CX} ${startY} L ${HMAC_CX} ${midY} L ${OUTER_CX} ${midY} L ${OUTER_CX} ${endY}`} fill="none" stroke={color} strokeWidth="1.8" />
      <path d={`M ${OUTER_CX} ${endY} l -4 7 l 8 0 z`} fill={color} />
      <circle cx={HMAC_CX} cy={startY} r="2.5" fill={color} />
      <text x={(HMAC_CX + OUTER_CX) / 2} y={midY - 6} fontSize="10.5" fontWeight="700" fill={color} textAnchor="middle">{tag} is {next}'s outer HMAC</text>
    </g>
  );
}

export default HmacChainDiagram;
