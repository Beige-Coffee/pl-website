import { useState, useMemo } from "react";
import { usePerspective, type NodeName } from "./PerspectiveContext";
import { CANONICAL_TRACE, SESSION_KEY_PUBLIC } from "@/data/onion-routing-constants";
import { cn } from "@/lib/utils";
import { Lock, Eye, EyeOff } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IllustratedOnionPacketProps {
  className?: string;
}

interface Segment {
  id: string;
  label: string;
  bytes: number;
  /** Starting byte offset within the packet */
  offset: number;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  barClass: string;
  hex: string;
  explanation: string;
  /** If true, this segment has a nested breakdown (Level 2) */
  nested?: NestedSegment[];
}

interface NestedSegment {
  id: string;
  label: string;
  bytes: number | string; // string for approximate values like "~24"
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  barClass: string;
  hex: string;
  explanation: string;
  /** Level 3 nesting (TLV fields) */
  nested?: TlvField[];
}

interface TlvField {
  id: string;
  label: string;
  bytes: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  barClass: string;
  hex: string;
  explanation: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate hex to a readable preview */
function truncHex(hex: string, maxChars = 32): string {
  if (hex.length <= maxChars) return hex;
  const half = Math.floor((maxChars - 3) / 2);
  return hex.slice(0, half) + "..." + hex.slice(-half);
}

function formatByteRange(offset: number, bytes: number): string {
  return `bytes ${offset}\u2013${offset + bytes - 1}`;
}

// ---------------------------------------------------------------------------
// Packet data
// ---------------------------------------------------------------------------

const EPHEMERAL_KEY_HEX = SESSION_KEY_PUBLIC;

// Simulated HMAC (in reality computed from routing info + mu key)
const HMAC_HEX = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6";

// Bob's decrypted payload (TLV-encoded forwarding instructions)
const BOB_HOP = CANONICAL_TRACE.route[0];
// short_channel_id for Bob: "700000x2x0"
// We'll show representative hex for the TLV fields
const BOB_AMT_HEX = "0206" + "0000000002faf080"; // type=2, len=6, 50,003,000 in hex (rough)
const BOB_CLTV_HEX = "0404" + "000aae30"; // type=4, len=4, 700,048 in hex (rough)
const BOB_SCID_HEX = "0608" + "000ab350000200000000"; // type=6, len=8, 700000x2x0 encoded

const SEGMENTS: Segment[] = [
  {
    id: "version",
    label: "Version",
    bytes: 1,
    offset: 0,
    color: "gray",
    bgClass: "bg-zinc-500/10 dark:bg-zinc-400/10",
    borderClass: "border-zinc-400/40",
    textClass: "text-zinc-600 dark:text-zinc-300",
    barClass: "bg-zinc-400 dark:bg-zinc-500",
    hex: "00",
    explanation:
      "Protocol version byte. Currently always 0x00, indicating the Sphinx packet format defined in BOLT 4. If a node receives an unrecognized version, it must reject the packet with an invalid_onion_version error.",
  },
  {
    id: "ephemeral-key",
    label: "Ephemeral Key",
    bytes: 33,
    offset: 1,
    color: "blue",
    bgClass: "bg-blue-500/10 dark:bg-blue-500/15",
    borderClass: "border-blue-500/40",
    textClass: "text-blue-700 dark:text-blue-300",
    barClass: "bg-blue-500 dark:bg-blue-600",
    hex: EPHEMERAL_KEY_HEX,
    explanation:
      "Alice's ephemeral public key for this packet (33-byte compressed secp256k1 point). Each hop uses this key with its own private key to compute the shared secret via ECDH. After processing, the hop re-blinds this key before passing it to the next node, so each hop sees a different ephemeral key derived from the same session key.",
  },
  {
    id: "routing-info",
    label: "Routing Info",
    bytes: 1300,
    offset: 34,
    color: "gradient",
    bgClass: "bg-emerald-500/10 dark:bg-emerald-500/15",
    borderClass: "border-emerald-500/40",
    textClass: "text-emerald-700 dark:text-emerald-300",
    barClass: "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500",
    hex: "e3a1...encrypted...7f2b",
    explanation:
      "1,300 bytes of layered, encrypted routing data. Each hop decrypts this with ChaCha20 using its rho key, peels off its own TLV-encoded payload from the front, and shifts the remainder forward. Filler bytes maintain the fixed 1,300-byte size so every hop sees an identically-sized blob, preventing position inference.",
    nested: [
      {
        id: "bob-payload",
        label: "Bob's Payload",
        bytes: "~24",
        color: "green",
        bgClass: "bg-green-500/10 dark:bg-green-500/15",
        borderClass: "border-green-500/40",
        textClass: "text-green-700 dark:text-green-300",
        barClass: "bg-green-500 dark:bg-green-600",
        hex: "17" + BOB_AMT_HEX + BOB_CLTV_HEX + BOB_SCID_HEX,
        explanation: `Bob's TLV-encoded forwarding instructions: forward ${BOB_HOP.amtToForwardMsat.toLocaleString()} msat to Carol via channel ${BOB_HOP.shortChannelId} with outgoing CLTV ${BOB_HOP.outgoingCltvValue.toLocaleString()}. The first byte is the length prefix indicating how many bytes follow.`,
        nested: [
          {
            id: "tlv-length",
            label: "Length Prefix",
            bytes: "1",
            bgClass: "bg-slate-500/10 dark:bg-slate-400/10",
            borderClass: "border-slate-400/40",
            textClass: "text-slate-600 dark:text-slate-300",
            barClass: "bg-slate-400 dark:bg-slate-500",
            hex: "17",
            explanation:
              "BigSize-encoded length of the payload body that follows. Value 0x17 = 23 bytes. This tells the processing node exactly how many bytes to consume as its hop payload.",
          },
          {
            id: "tlv-amt",
            label: "Type 2: amt_to_forward",
            bytes: "~6",
            bgClass: "bg-sky-500/10 dark:bg-sky-500/15",
            borderClass: "border-sky-500/40",
            textClass: "text-sky-700 dark:text-sky-300",
            barClass: "bg-sky-500 dark:bg-sky-600",
            hex: BOB_AMT_HEX,
            explanation: `Amount Bob should forward to the next hop: ${BOB_HOP.amtToForwardMsat.toLocaleString()} msat (${(BOB_HOP.amtToForwardMsat / 1000).toLocaleString()} sats). Encoded as TLV type 2 with a variable-length integer value.`,
          },
          {
            id: "tlv-cltv",
            label: "Type 4: outgoing_cltv",
            bytes: "~5",
            bgClass: "bg-violet-500/10 dark:bg-violet-500/15",
            borderClass: "border-violet-500/40",
            textClass: "text-violet-700 dark:text-violet-300",
            barClass: "bg-violet-500 dark:bg-violet-600",
            hex: BOB_CLTV_HEX,
            explanation: `Outgoing CLTV expiry Bob should set on the HTLC to Carol: block ${BOB_HOP.outgoingCltvValue.toLocaleString()}. Encoded as TLV type 4.`,
          },
          {
            id: "tlv-scid",
            label: "Type 6: short_channel_id",
            bytes: "10",
            bgClass: "bg-rose-500/10 dark:bg-rose-500/15",
            borderClass: "border-rose-500/40",
            textClass: "text-rose-700 dark:text-rose-300",
            barClass: "bg-rose-500 dark:bg-rose-600",
            hex: BOB_SCID_HEX,
            explanation: `The channel Bob should use to forward the payment: ${BOB_HOP.shortChannelId}. This 8-byte value encodes block height, transaction index, and output index. Only present for intermediate hops (absent for the final recipient).`,
          },
        ],
      },
      {
        id: "next-hmac",
        label: "Next HMAC",
        bytes: 32,
        color: "amber",
        bgClass: "bg-amber-500/10 dark:bg-amber-500/15",
        borderClass: "border-amber-500/40",
        textClass: "text-amber-700 dark:text-amber-300",
        barClass: "bg-amber-500 dark:bg-amber-600",
        hex: "b7c8d9...next_hmac...3e4f5a",
        explanation:
          "The HMAC that Bob places in the reconstructed packet for Carol. Carol will verify this HMAC using her own mu key. If it matches, she knows the packet is authentic and unmodified. For the final hop (Dave), this is 32 zero bytes, signaling end of route.",
      },
      {
        id: "encrypted-remaining",
        label: "Encrypted Remaining",
        bytes: "~1,244",
        color: "teal",
        bgClass: "bg-teal-500/10 dark:bg-teal-500/15",
        borderClass: "border-teal-500/40",
        textClass: "text-teal-700 dark:text-teal-300",
        barClass: "bg-teal-500/60 dark:bg-teal-600/60",
        hex: "c4d5e6...encrypted_layers...8a9b0c",
        explanation:
          "The rest of the encrypted routing data. Bob cannot decrypt these inner layers because they are encrypted with Carol's and Dave's shared secrets. When Bob reconstructs the packet for Carol, this data is shifted forward and padded with pseudorandom filler bytes at the end.",
      },
    ],
  },
  {
    id: "hmac",
    label: "HMAC",
    bytes: 32,
    offset: 1334,
    color: "orange",
    bgClass: "bg-orange-500/10 dark:bg-orange-500/15",
    borderClass: "border-orange-500/40",
    textClass: "text-orange-700 dark:text-orange-300",
    barClass: "bg-orange-500 dark:bg-orange-600",
    hex: HMAC_HEX,
    explanation:
      "32-byte HMAC-SHA256 over the routing info, keyed with the current hop's mu key. The receiving node recomputes this HMAC from the decrypted routing info. If it does not match, the packet has been tampered with and the node returns an invalid_onion_hmac error. This provides authentication without revealing the sender.",
  },
];

// Proportional widths for the top-level bar (logarithmic scale for visual clarity)
// Version: 1 byte, Ephemeral: 33 bytes, Routing: 1300 bytes, HMAC: 32 bytes
// Use min-width for tiny segments, proportional for the rest
const BAR_WIDTHS: Record<string, string> = {
  version: "2.5%",
  "ephemeral-key": "8%",
  "routing-info": "80%",
  hmac: "9.5%",
};

// Nested bar widths within routing info
const NESTED_BAR_WIDTHS: Record<string, string> = {
  "bob-payload": "6%",
  "next-hmac": "8%",
  "encrypted-remaining": "86%",
};

// TLV bar widths within Bob's payload
const TLV_BAR_WIDTHS: Record<string, string> = {
  "tlv-length": "10%",
  "tlv-amt": "28%",
  "tlv-cltv": "24%",
  "tlv-scid": "38%",
};

// ---------------------------------------------------------------------------
// Perspective visibility logic
// ---------------------------------------------------------------------------

type VisibilityLevel = "visible" | "encrypted" | "hidden";

function getSegmentVisibility(
  segmentId: string,
  perspective: NodeName | "omniscient",
): VisibilityLevel {
  // Omniscient and Alice can see everything
  if (perspective === "omniscient" || perspective === "alice") return "visible";

  // Version and ephemeral key are in the clear for everyone
  if (segmentId === "version" || segmentId === "ephemeral-key") return "visible";

  // HMAC is in the clear (it's the outer HMAC the receiving hop checks)
  if (segmentId === "hmac") return "visible";

  // Routing info visibility depends on who you are
  if (perspective === "bob") {
    // Bob can decrypt his layer
    if (
      segmentId === "routing-info" ||
      segmentId === "bob-payload" ||
      segmentId === "next-hmac" ||
      segmentId === "tlv-length" ||
      segmentId === "tlv-amt" ||
      segmentId === "tlv-cltv" ||
      segmentId === "tlv-scid"
    ) {
      return "visible";
    }
    // Bob cannot see the encrypted remaining (inner layers)
    if (segmentId === "encrypted-remaining") return "encrypted";
    return "visible";
  }

  // Carol and Dave see the entire routing info as encrypted
  if (perspective === "carol" || perspective === "dave") {
    if (segmentId === "routing-info") return "encrypted";
    // Nested segments within routing info are hidden
    return "encrypted";
  }

  return "visible";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Clickable segment in the horizontal bar */
function SegmentBar({
  segment,
  width,
  isExpanded,
  onClick,
  isEncrypted,
}: {
  segment: { id: string; label: string; barClass: string; textClass: string };
  width: string;
  isExpanded: boolean;
  onClick: () => void;
  isEncrypted: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative h-10 transition-all duration-200 cursor-pointer group",
        "border border-foreground/10 hover:border-foreground/30",
        "flex items-center justify-center overflow-hidden",
        isExpanded && "ring-2 ring-foreground/20",
        isEncrypted && "opacity-60",
      )}
      style={{ width }}
      title={
        isEncrypted
          ? `${segment.label} (encrypted)`
          : `${segment.label} - click to inspect`
      }
    >
      <div
        className={cn("absolute inset-0", segment.barClass, isEncrypted && "opacity-40")}
      />
      {isEncrypted && (
        <Lock className="relative z-10 h-3.5 w-3.5 text-white/80 drop-shadow-sm" />
      )}
      <span
        className={cn(
          "relative z-10 text-[10px] font-sans font-bold tracking-tight text-white drop-shadow-sm",
          "truncate px-1",
          isEncrypted && "hidden",
        )}
      >
        {segment.label}
      </span>
    </button>
  );
}

/** Detail panel shown below an expanded segment */
function DetailPanel({
  label,
  byteRange,
  bytes,
  hex,
  explanation,
  bgClass,
  borderClass,
  textClass,
  isEncrypted,
  children,
}: {
  label: string;
  byteRange?: string;
  bytes: number | string;
  hex: string;
  explanation: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  isEncrypted: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-2 px-4 py-3 space-y-2 transition-all duration-200 animate-in fade-in slide-in-from-top-1",
        bgClass,
        borderClass,
      )}
    >
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div className="flex items-center gap-2">
          <span className={cn("font-sans font-bold text-sm", textClass)}>
            {label}
          </span>
          <span className="text-xs font-sans text-muted-foreground">
            ({typeof bytes === "number" ? `${bytes} bytes` : `${bytes} bytes`})
          </span>
        </div>
        {byteRange && (
          <span className="text-xs font-sans text-muted-foreground">
            {byteRange}
          </span>
        )}
      </div>

      {isEncrypted ? (
        <div className="flex items-center gap-2 py-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground italic font-sans">
            Encrypted (cannot read from this perspective)
          </span>
        </div>
      ) : (
        <>
          {/* Hex preview */}
          <div className="bg-black/5 dark:bg-white/5 px-3 py-1.5 font-sans text-xs text-muted-foreground overflow-x-auto">
            <span className="opacity-60">0x</span>
            {truncHex(hex, 64)}
          </div>

          {/* Explanation */}
          <p className="text-sm text-foreground/80 leading-relaxed">
            {explanation}
          </p>

          {/* Nested content */}
          {children}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IllustratedOnionPacket({ className }: IllustratedOnionPacketProps) {
  const { view } = usePerspective();

  const perspective: NodeName | "omniscient" =
    view.type === "omniscient" ? "omniscient" : view.node;

  // Track which segments are expanded at each level
  const [expandedL1, setExpandedL1] = useState<string | null>(null);
  const [expandedL2, setExpandedL2] = useState<string | null>(null);
  const [expandedL3, setExpandedL3] = useState<string | null>(null);

  const toggleL1 = (id: string) => {
    if (expandedL1 === id) {
      setExpandedL1(null);
      setExpandedL2(null);
      setExpandedL3(null);
    } else {
      setExpandedL1(id);
      setExpandedL2(null);
      setExpandedL3(null);
    }
  };

  const toggleL2 = (id: string) => {
    if (expandedL2 === id) {
      setExpandedL2(null);
      setExpandedL3(null);
    } else {
      setExpandedL2(id);
      setExpandedL3(null);
    }
  };

  const toggleL3 = (id: string) => {
    setExpandedL3(expandedL3 === id ? null : id);
  };

  // Perspective label
  const perspectiveLabel = useMemo(() => {
    if (perspective === "omniscient") return "All details visible";
    const name = perspective.charAt(0).toUpperCase() + perspective.slice(1);
    if (perspective === "alice")
      return `${name}'s view (sender, can see everything)`;
    if (perspective === "bob")
      return `${name}'s view (can decrypt his payload)`;
    return `${name}'s view (encrypted, cannot read routing info)`;
  }, [perspective]);

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Title + total size */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h4 className="font-sans font-bold text-sm">
            Onion Packet Structure
          </h4>
          <p className="text-xs text-muted-foreground font-sans">
            1,366 bytes total
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground">
          {perspective === "omniscient" || perspective === "alice" ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          <span>{perspectiveLabel}</span>
        </div>
      </div>

      {/* Level 1: Top-level horizontal bar */}
      <div className="flex w-full gap-0.5 overflow-hidden rounded-sm">
        {SEGMENTS.map((seg) => {
          const vis = getSegmentVisibility(seg.id, perspective);
          return (
            <SegmentBar
              key={seg.id}
              segment={seg}
              width={BAR_WIDTHS[seg.id] || "10%"}
              isExpanded={expandedL1 === seg.id}
              onClick={() => toggleL1(seg.id)}
              isEncrypted={vis === "encrypted"}
            />
          );
        })}
      </div>

      {/* Byte scale labels */}
      <div className="flex w-full justify-between text-[10px] font-sans text-muted-foreground px-0.5">
        <span>0</span>
        <span>34</span>
        <span className="flex-1 text-center">1,334</span>
        <span>1,366</span>
      </div>

      {/* Level 1: Expanded detail panel */}
      {expandedL1 && (() => {
        const seg = SEGMENTS.find((s) => s.id === expandedL1);
        if (!seg) return null;
        const vis = getSegmentVisibility(seg.id, perspective);
        const isEnc = vis === "encrypted";

        return (
          <DetailPanel
            label={seg.label}
            byteRange={formatByteRange(seg.offset, seg.bytes)}
            bytes={seg.bytes}
            hex={seg.hex}
            explanation={seg.explanation}
            bgClass={seg.bgClass}
            borderClass={seg.borderClass}
            textClass={seg.textClass}
            isEncrypted={isEnc}
          >
            {/* Level 2: Nested breakdown for routing info */}
            {seg.nested && !isEnc && (
              <div className="mt-3 space-y-3">
                <p className="text-xs font-sans font-bold text-muted-foreground uppercase tracking-wider">
                  After Bob decrypts with his rho key:
                </p>

                {/* Nested horizontal bar */}
                <div className="flex w-full gap-0.5 overflow-hidden rounded-sm">
                  {seg.nested.map((nested) => {
                    const nVis = getSegmentVisibility(nested.id, perspective);
                    return (
                      <SegmentBar
                        key={nested.id}
                        segment={nested}
                        width={NESTED_BAR_WIDTHS[nested.id] || "33%"}
                        isExpanded={expandedL2 === nested.id}
                        onClick={() => toggleL2(nested.id)}
                        isEncrypted={nVis === "encrypted"}
                      />
                    );
                  })}
                </div>

                {/* Level 2: Expanded detail panel */}
                {expandedL2 && (() => {
                  const nested = seg.nested!.find((n) => n.id === expandedL2);
                  if (!nested) return null;
                  const nVis = getSegmentVisibility(nested.id, perspective);
                  const nEnc = nVis === "encrypted";

                  return (
                    <DetailPanel
                      label={nested.label}
                      bytes={nested.bytes}
                      hex={nested.hex}
                      explanation={nested.explanation}
                      bgClass={nested.bgClass}
                      borderClass={nested.borderClass}
                      textClass={nested.textClass}
                      isEncrypted={nEnc}
                    >
                      {/* Level 3: TLV fields */}
                      {nested.nested && !nEnc && (
                        <div className="mt-3 space-y-3">
                          <p className="text-xs font-sans font-bold text-muted-foreground uppercase tracking-wider">
                            TLV Fields:
                          </p>

                          {/* TLV horizontal bar */}
                          <div className="flex w-full gap-0.5 overflow-hidden rounded-sm">
                            {nested.nested.map((tlv) => (
                              <SegmentBar
                                key={tlv.id}
                                segment={tlv}
                                width={TLV_BAR_WIDTHS[tlv.id] || "25%"}
                                isExpanded={expandedL3 === tlv.id}
                                onClick={() => toggleL3(tlv.id)}
                                isEncrypted={false}
                              />
                            ))}
                          </div>

                          {/* Level 3: Expanded detail panel */}
                          {expandedL3 && (() => {
                            const tlv = nested.nested!.find(
                              (t) => t.id === expandedL3,
                            );
                            if (!tlv) return null;

                            return (
                              <DetailPanel
                                label={tlv.label}
                                bytes={tlv.bytes}
                                hex={tlv.hex}
                                explanation={tlv.explanation}
                                bgClass={tlv.bgClass}
                                borderClass={tlv.borderClass}
                                textClass={tlv.textClass}
                                isEncrypted={false}
                              />
                            );
                          })()}
                        </div>
                      )}
                    </DetailPanel>
                  );
                })()}
              </div>
            )}
          </DetailPanel>
        );
      })()}

      {/* Click hint */}
      {!expandedL1 && (
        <p className="text-xs text-muted-foreground text-center italic animate-in fade-in">
          Click any segment to inspect its contents
        </p>
      )}
    </div>
  );
}
