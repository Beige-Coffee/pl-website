import { useState, useMemo } from "react";
import { usePerspective, type NodeName } from "./PerspectiveContext";
import { NODES, SESSION_KEY_PUBLIC } from "@/data/onion-routing-constants";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyDerivationPipelineDiagramProps {
  className?: string;
  /** If true, show step-through buttons; if false, show all at once. */
  interactive?: boolean;
}

interface DerivedKeys {
  rho: string;
  mu: string;
  um: string;
  pad: string;
  ammag: string;
}

interface HopData {
  /** Which node this hop targets. */
  node: NodeName;
  label: string;
  /** The ephemeral public key seen by this hop. */
  ephemeralKey: string;
  /** ECDH shared secret with this hop's node. */
  sharedSecret: string;
  /** Blinding factor derived after this hop (undefined for the last hop). */
  blindingFactor: string | null;
  /** The 5 derived keys from the shared secret. */
  keys: DerivedKeys;
  /** Color classes */
  dotClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
}

// ---------------------------------------------------------------------------
// Pre-computed Sphinx key derivation values
// ---------------------------------------------------------------------------
// These are deterministically derived from the canonical session key and
// node public keys. See onion-routing-constants.ts for the source keys.
//
// Chain: session_key -> ECDH(Bob) -> blind -> ECDH(Carol) -> blind -> ECDH(Dave)

const HOP_DATA: HopData[] = [
  {
    node: "bob",
    label: "Bob",
    ephemeralKey: SESSION_KEY_PUBLIC,
    sharedSecret: "651437aee467d7e0488fec1680034417e5aa3f8eb9fbac85d0e387b9f034d4ad",
    blindingFactor: "b0b4a66ae310d9c4fc21d23d0a9cf54ab076cbd0d5bc45ffafd73acd0584b9ac",
    keys: {
      rho: "2661b7bc98c346d4d3089e1d98fa825999d4229737f74b963ef22e8ba22c1bca",
      mu: "6036edcb0a8d14301d9f3ca3919cb6c3f86576b0e5f5eeea38e24a714bf1b3c2",
      um: "c1f53f80d3fecaf078cb7ce84443b0466f620410759b092a1e62ce04fedbda27",
      pad: "51874568332e85deaae3238b80168301a73dfea040755ac4335edf22a80113f5",
      ammag: "72bb566344ce407d5dcd72f876505f5add8bd6ed7219700fb0ff2bc00c2fb715",
    },
    dotClass: "bg-green-500",
    borderClass: "border-green-500/40",
    bgClass: "bg-green-500/5 dark:bg-green-500/10",
    textClass: "text-green-700 dark:text-green-300",
  },
  {
    node: "carol",
    label: "Carol",
    ephemeralKey: "03d33de644e1b1fbc59473648c836544ede1f36766d6cbf23bfa311d75ba6a5405",
    sharedSecret: "02a1c676d2d22d2926fa713666259a91ec70ccaa92d940495a6a9fa917c3abc2",
    blindingFactor: "109e9480c5b68f514e2447de3ac0bd5b4ab6858be18a7ea04e87c071e01c569d",
    keys: {
      rho: "b1476af7cf4554affcebcb1a3217ae22c69f80de946cd9b549f43292a5c7302d",
      mu: "61fbe445b09c8af0bf82e1a790740521587a2cd3c8f39f73bdd95282c76c2872",
      um: "d2ffaa855076f34e455d41b8d16a7842d4287720d07a63eb2a855d12115a35fc",
      pad: "760df0c7f59c28052ba5a1fd0c6f526e0c77c2c0c03963d1e2e9c7a5174aa5c9",
      ammag: "f7fea90e467248bc8136768e5e1c8f77f952e52362d122900d8bdd4e04670b7d",
    },
    dotClass: "bg-amber-500",
    borderClass: "border-amber-500/40",
    bgClass: "bg-amber-500/5 dark:bg-amber-500/10",
    textClass: "text-amber-700 dark:text-amber-300",
  },
  {
    node: "dave",
    label: "Dave",
    ephemeralKey: "02ca807ae31aa764f3750f3dc21fe28a4d33884bdcef381e2f40efec214bac710f",
    sharedSecret: "4ed7b01dfe2ec244b4e5dae60134c4241ea8e6cd310bd0165cf5e75dce484db2",
    blindingFactor: null, // Last hop, no further blinding
    keys: {
      rho: "581ac9d544f823db962c65e4c2d0ddd57259647956ff283f5ec974a3774b0676",
      mu: "67e19ad97e9f46faed38d4e3c57a1df516f36d1558a91fe802ebed546cbc5faf",
      um: "dbb046f3bc36af5db98e1d5c6d4413308ad18f2569e5ecf7277a6cab570ac782",
      pad: "2a66a4692f05ad4a1b0ae1464ee73d1528a75c2d5dca6392196c595afce9a792",
      ammag: "4b87dfdb236f764f51d347cbb663f1b0638ef781a264222b9046c5d979eeac32",
    },
    dotClass: "bg-purple-500",
    borderClass: "border-purple-500/40",
    bgClass: "bg-purple-500/5 dark:bg-purple-500/10",
    textClass: "text-purple-700 dark:text-purple-300",
  },
];

const KEY_TYPE_LABELS: { key: keyof DerivedKeys; label: string; description: string }[] = [
  { key: "rho", label: "rho", description: "encryption stream" },
  { key: "mu", label: "mu", description: "outgoing HMAC" },
  { key: "um", label: "um", description: "error HMAC" },
  { key: "pad", label: "pad", description: "filler generation" },
  { key: "ammag", label: "ammag", description: "error encryption" },
];

// Steps: 1 = session key only, 2 = Bob hop, 3 = Carol hop, 4 = Dave hop
const MAX_STEP = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate a hex string: first 8 chars + "..." + last 4 chars */
function truncHex(hex: string): string {
  if (hex.length <= 16) return hex;
  return hex.slice(0, 8) + "..." + hex.slice(-4);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Small hex box for a derived key */
function KeyPill({
  label,
  description,
  hex,
  obscured,
  textClass,
}: {
  label: string;
  description: string;
  hex: string;
  obscured: boolean;
  textClass: string;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={cn("text-[10px] font-sans font-bold uppercase tracking-wider", textClass)}>
        {label}
      </span>
      <span
        className={cn(
          "text-[10px] font-sans px-1.5 py-0.5 border bg-card transition-all duration-200",
          obscured ? "opacity-40 border-muted" : "border-foreground/20",
        )}
        title={obscured ? `${description} key (hidden)` : `${description} key: ${hex}`}
      >
        {obscured ? "???" : truncHex(hex)}
      </span>
    </div>
  );
}

/** Downward arrow connector between hops showing the blinding operation */
function BlindingConnector({
  blindingFactor,
  nextEphemeralKey,
  visible,
  obscured,
  textClass,
}: {
  blindingFactor: string;
  nextEphemeralKey: string;
  visible: boolean;
  obscured: boolean;
  textClass: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 py-3 transition-all duration-200",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
      )}
    >
      {/* Downward arrow */}
      <div className="flex flex-col items-center text-muted-foreground">
        <div className="w-px h-3 bg-current opacity-40" />
        <svg width="12" height="8" viewBox="0 0 12 8" className="opacity-40">
          <path d="M6 8L0 0h12z" fill="currentColor" />
        </svg>
      </div>

      {/* Blinding operation label */}
      <div className="text-center space-y-1">
        <p className="text-xs font-sans text-muted-foreground">
          <span className="font-semibold">Blind:</span>{" "}
          {obscured ? (
            <span className="opacity-40">SHA256(ephemeral_pubkey || shared_secret) = ???</span>
          ) : (
            <span className="opacity-80">
              blinding_factor ={" "}
              <span className={cn("font-semibold", textClass)}>{truncHex(blindingFactor)}</span>
            </span>
          )}
        </p>
        <p className="text-xs font-sans text-muted-foreground">
          {obscured ? (
            <span className="opacity-40">next ephemeral key = ???</span>
          ) : (
            <>
              <span className="opacity-80">next ephemeral key = </span>
              <span className="font-semibold">{truncHex(nextEphemeralKey)}</span>
            </>
          )}
        </p>
      </div>

      {/* Downward arrow (continuation) */}
      <div className="flex flex-col items-center text-muted-foreground">
        <div className="w-px h-3 bg-current opacity-40" />
        <svg width="12" height="8" viewBox="0 0 12 8" className="opacity-40">
          <path d="M6 8L0 0h12z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

/** A single hop row: ephemeral key, ECDH, shared secret, and 5 derived keys */
function HopRow({
  hop,
  hopIndex,
  visible,
  opacity,
  highlighted,
  obscured,
}: {
  hop: HopData;
  hopIndex: number;
  visible: boolean;
  opacity: number;
  highlighted: boolean;
  obscured: boolean;
}) {
  return (
    <div
      className={cn(
        "border-2 px-4 py-3 transition-all duration-200",
        hop.bgClass,
        highlighted ? cn(hop.borderClass, "border-2") : "border-transparent",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2 pointer-events-none h-0 py-0 overflow-hidden",
      )}
      style={{ opacity: visible ? opacity : 0 }}
    >
      {/* Header: node identity + ephemeral key */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block h-3 w-3 shrink-0 border border-foreground/30",
              hop.dotClass,
            )}
          />
          <span className={cn("font-sans font-bold text-sm", hop.textClass)}>
            Hop {hopIndex + 1}: {hop.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-sans text-xs">
          <span className="text-muted-foreground uppercase tracking-wider">Ephemeral key:</span>
          <span className={cn("font-semibold", obscured && "opacity-40")}>
            {obscured ? "???" : truncHex(hop.ephemeralKey)}
          </span>
        </div>
      </div>

      {/* ECDH operation + shared secret */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 font-sans text-xs">
          <span className="text-muted-foreground">ECDH(session_key,</span>
          <span className={cn("font-semibold", hop.textClass)}>{hop.label}_pubkey</span>
          <span className="text-muted-foreground">)</span>
          <span className="text-muted-foreground mx-1">=</span>
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 border font-sans text-xs transition-all duration-200",
            obscured ? "border-muted opacity-40" : cn("border-foreground/30", hop.bgClass),
          )}
        >
          <span className="text-muted-foreground uppercase tracking-wider text-[10px]">
            shared_secret:
          </span>
          <span className="font-semibold">
            {obscured ? "???" : truncHex(hop.sharedSecret)}
          </span>
        </div>
      </div>

      {/* Derived keys fan-out */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-sans text-muted-foreground uppercase tracking-wider">
          Derived keys (HMAC-SHA256):
        </p>
        <div className="flex flex-wrap gap-2">
          {KEY_TYPE_LABELS.map(({ key, label, description }) => (
            <KeyPill
              key={key}
              label={label}
              description={description}
              hex={hop.keys[key]}
              obscured={obscured}
              textClass={hop.textClass}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** The starting session key box (step 1) */
function SessionKeyBox({
  visible,
  obscured,
}: {
  visible: boolean;
  obscured: boolean;
}) {
  return (
    <div
      className={cn(
        "border-2 px-4 py-3 transition-all duration-200",
        "bg-blue-500/5 dark:bg-blue-500/10",
        visible
          ? "opacity-100 translate-y-0 border-blue-500/40"
          : "opacity-0 -translate-y-2 pointer-events-none h-0 py-0 overflow-hidden border-transparent",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 shrink-0 border border-foreground/30 bg-blue-500" />
          <span className="font-sans font-bold text-sm text-blue-700 dark:text-blue-300">
            Alice&apos;s Session Key
          </span>
          <span className="text-xs text-muted-foreground font-sans">(starting point)</span>
        </div>

        <div className="flex items-center gap-1.5 font-sans text-xs">
          <span className="text-muted-foreground uppercase tracking-wider">Session pubkey:</span>
          <span className={cn("font-semibold", obscured && "opacity-40")}>
            {obscured ? "???" : truncHex(SESSION_KEY_PUBLIC)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function KeyDerivationPipelineDiagram({
  className,
  interactive = false,
}: KeyDerivationPipelineDiagramProps) {
  const { view } = usePerspective();
  const isOmniscient = view.type === "omniscient";
  const currentNode: NodeName | null =
    view.type === "node-local" ? view.node : null;

  // Step state: 1 = session key, 2 = Bob, 3 = Carol, 4 = Dave
  const [step, setStep] = useState(MAX_STEP);
  const visibleCount = interactive ? step : MAX_STEP;

  // Compute per-hop visibility based on perspective
  // Alice can see everything (she computed it all). Each intermediate node
  // can only see its own row.
  const hopVisibility = useMemo(() => {
    return HOP_DATA.map((hop) => {
      if (isOmniscient) {
        return { opacity: 1, highlighted: false, obscured: false };
      }
      if (!currentNode) {
        return { opacity: 0.15, highlighted: false, obscured: true };
      }

      // Alice can see everything
      if (currentNode === "alice") {
        return { opacity: 1, highlighted: false, obscured: false };
      }

      const isSelf = hop.node === currentNode;

      if (isSelf) {
        return { opacity: 1, highlighted: true, obscured: false };
      }

      // Non-self nodes are obscured for intermediate hops
      return { opacity: 0.15, highlighted: false, obscured: true };
    });
  }, [isOmniscient, currentNode]);

  // Session key box visibility: always visible in omniscient or as Alice,
  // obscured for other nodes
  const sessionKeyObscured = useMemo(() => {
    if (isOmniscient) return false;
    if (currentNode === "alice") return false;
    return true;
  }, [isOmniscient, currentNode]);

  const stepLabels = [
    "Session key",
    "Hop 1: Bob",
    "Hop 2: Carol",
    "Hop 3: Dave",
  ];

  return (
    <div className={cn("w-full", className)}>
      {/* Step-through controls */}
      {interactive && (
        <div className="flex items-center justify-between mb-4 px-1">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step <= 1}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-sans border-2 transition-colors duration-150",
              step <= 1
                ? "border-muted text-muted-foreground cursor-not-allowed opacity-50"
                : "border-foreground text-foreground hover:bg-muted cursor-pointer",
            )}
            aria-label="Previous step"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          <div className="flex items-center gap-1.5">
            {stepLabels.map((label, i) => (
              <button
                key={label}
                onClick={() => setStep(i + 1)}
                className={cn(
                  "h-2.5 w-2.5 border transition-all duration-200 cursor-pointer",
                  i < step
                    ? "bg-foreground border-foreground"
                    : "bg-transparent border-foreground/30",
                )}
                aria-label={`Step ${i + 1}: ${label}`}
                title={label}
              />
            ))}
            <span className="ml-2 text-xs font-sans text-muted-foreground">
              {step}/{MAX_STEP}
            </span>
          </div>

          <button
            onClick={() => setStep((s) => Math.min(MAX_STEP, s + 1))}
            disabled={step >= MAX_STEP}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 text-sm font-sans border-2 transition-colors duration-150",
              step >= MAX_STEP
                ? "border-muted text-muted-foreground cursor-not-allowed opacity-50"
                : "border-foreground text-foreground hover:bg-muted cursor-pointer",
            )}
            aria-label="Next step"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pipeline */}
      <div className="space-y-0">
        {/* Session key (always step 1) */}
        <SessionKeyBox
          visible={visibleCount >= 1}
          obscured={sessionKeyObscured}
        />

        {/* Hop rows with blinding connectors between them */}
        {HOP_DATA.map((hop, i) => {
          // Hop i is visible at step i+2 (step 1 = session key, step 2 = Bob, etc.)
          const isVisible = visibleCount >= i + 2;
          const vis = hopVisibility[i];

          return (
            <div key={hop.node}>
              {/* Connector: either initial arrow (from session key to hop 1) or blinding connector */}
              {i === 0 ? (
                // Simple arrow from session key to first hop
                <div
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 transition-all duration-200",
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2",
                  )}
                >
                  <div className="flex flex-col items-center text-muted-foreground">
                    <div className="w-px h-3 bg-current opacity-40" />
                    <svg width="12" height="8" viewBox="0 0 12 8" className="opacity-40">
                      <path d="M6 8L0 0h12z" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-xs font-sans text-muted-foreground">
                    ECDH with {hop.label}&apos;s public key (
                    <span className={cn("font-semibold", hop.textClass)}>
                      {truncHex(NODES[hop.node].publicKey)}
                    </span>
                    )
                  </p>
                </div>
              ) : (
                // Blinding connector between hops
                <BlindingConnector
                  blindingFactor={HOP_DATA[i - 1].blindingFactor!}
                  nextEphemeralKey={hop.ephemeralKey}
                  visible={isVisible}
                  obscured={vis.obscured && hopVisibility[i - 1].obscured}
                  textClass={HOP_DATA[i - 1].textClass}
                />
              )}

              <HopRow
                hop={hop}
                hopIndex={i}
                visible={isVisible}
                opacity={vis.opacity}
                highlighted={vis.highlighted}
                obscured={vis.obscured}
              />
            </div>
          );
        })}
      </div>

      {/* Summary (visible when all steps shown) */}
      <div
        className={cn(
          "mt-4 text-center font-sans text-sm transition-all duration-200",
          visibleCount >= MAX_STEP
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-2",
        )}
      >
        <span className="text-muted-foreground">
          3 shared secrets, 15 derived keys, all from 1 session key
        </span>
      </div>
    </div>
  );
}
