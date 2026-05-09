import { useEffect, useState } from "react";
import { Tok } from "./mathTokens";

// ────────────────────────────────────────────────────────────────────────────
// SharedSecretsRecapDiagram (DRAFT)
//
// Three-panel "what we achieved" recap that closes the chapter. Each panel
// addresses one strawman concern and shows how the blinding chain resolves
// it:
//   Panel 1 , ALICE STORES: a single key icon labeled session_key (e).
//   Panel 2 , PACKET CARRIES: a fixed-size strip with a single E_AB hop payload
//             plus a generic payload band, regardless of route length.
//   Panel 3 , EVERY HOP HAS: three colored shared-secret tiles (Bob/Charlie/
//             Dave), one per hop, all derived from the chain.
// Below the panels: a strikethrough summary of the two strawman flaws,
// crossed off to confirm both are resolved.
// ────────────────────────────────────────────────────────────────────────────

const INK = "#0f172a";
const SLATE = "#475569";
const CREAM_STAGE = "#fefdfb";
const CREAM_CARD = "#fffdf5";
const GOLD = "#b8860b";
const MONO = '"JetBrains Mono", "Fira Code", monospace';

const HOP_COLORS = {
  bob: { stroke: "#3b6aa0", fill: "#dbeafe" },
  charlie: { stroke: "#2d7a7a", fill: "#ccece8" },
  dave: { stroke: "#7b4b8a", fill: "#ede1f3" },
};

function KeyIcon({ tint }: { tint: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 12 12" aria-hidden>
      <rect x="3" y="2" width="1" height="3" fill={tint} />
      <rect x="8" y="2" width="1" height="3" fill={tint} />
      <rect x="4" y="1" width="4" height="1" fill={tint} />
      <rect x="2" y="5" width="8" height="6" fill={tint} />
      <rect x="5" y="7" width="2" height="2" fill={CREAM_CARD} />
    </svg>
  );
}

interface PanelProps {
  number: string;
  title: string;
  visible: boolean;
  children: React.ReactNode;
}

function Panel({ number, title, visible, children }: PanelProps) {
  return (
    <div
      className="flex flex-col border-[1.5px] p-4"
      style={{
        background: CREAM_CARD,
        borderColor: INK,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 500ms ease-out, transform 500ms ease-out",
        minHeight: 200,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 flex items-center justify-center"
          style={{
            background: GOLD,
            color: "#fffdf5",
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {number}
        </div>
        <div
          className="text-[11px] font-bold tracking-[0.08em] uppercase"
          style={{ color: INK }}
        >
          {title}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function SharedSecretsRecapDiagram() {
  const [animKey, setAnimKey] = useState(0);
  const [v1, setV1] = useState(false);
  const [v2, setV2] = useState(false);
  const [v3, setV3] = useState(false);
  const [vCheck, setVCheck] = useState(false);

  useEffect(() => {
    setV1(false);
    setV2(false);
    setV3(false);
    setVCheck(false);

    const t1 = setTimeout(() => setV1(true), 100);
    const t2 = setTimeout(() => setV2(true), 500);
    const t3 = setTimeout(() => setV3(true), 900);
    const t4 = setTimeout(() => setVCheck(true), 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [animKey]);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="shared-secrets-recap-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            What we achieved
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          className="relative px-4 py-6"
          style={{ background: CREAM_STAGE, minHeight: 360, minWidth: 800 }}
        >
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <Panel number="1" title="Alice stores" visible={v1}>
              <div className="flex flex-col items-center gap-2">
                <div
                  className="border-[1.5px] px-4 py-3 flex flex-col items-center gap-2"
                  style={{ borderColor: GOLD, background: "#fef3c7" }}
                >
                  <KeyIcon tint={GOLD} />
                  <div
                    className="text-[11px] font-bold"
                    style={{ fontFamily: MONO, color: INK }}
                  >
                    session_key (e)
                  </div>
                </div>
                <div
                  className="text-[11px] text-center"
                  style={{ color: SLATE, maxWidth: 200 }}
                >
                  one secret, regardless of route length
                </div>
              </div>
            </Panel>

            <Panel number="2" title="Packet carries" visible={v2}>
              <div className="flex flex-col items-center gap-3 w-full">
                <div className="flex items-center gap-1 w-full">
                  <div
                    className="border-[1.5px] flex items-center justify-center"
                    style={{
                      width: 70,
                      height: 36,
                      background: "#fef3c7",
                      borderColor: GOLD,
                      color: INK,
                      fontFamily: MONO,
                      fontWeight: 700,
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                  >
                    <Tok token="E_AB" />
                  </div>
                  <div
                    className="border-[1.5px] flex-1 flex items-center justify-center"
                    style={{
                      height: 36,
                      background: CREAM_CARD,
                      borderColor: INK,
                      color: SLATE,
                      fontFamily: "ui-sans-serif, system-ui, sans-serif",
                      fontSize: 10,
                      letterSpacing: "0.05em",
                    }}
                  >
                    PAYLOAD AREA (FIXED)
                  </div>
                </div>
                <div
                  className="text-[11px] text-center"
                  style={{ color: SLATE, maxWidth: 240 }}
                >
                  one ephemeral pubkey, no per-hop hop payload count
                </div>
              </div>
            </Panel>

            <Panel number="3" title="Every hop has" visible={v3}>
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  {(["bob", "charlie", "dave"] as const).map((hop, i) => {
                    const c = HOP_COLORS[hop];
                    const label = hop[0].toUpperCase() + hop.slice(1);
                    return (
                      <div
                        key={hop}
                        className="border-[1.5px] flex flex-col items-center gap-1 px-2 py-1.5"
                        style={{
                          background: c.fill,
                          borderColor: c.stroke,
                          width: 70,
                        }}
                      >
                        <KeyIcon tint={c.stroke} />
                        <div
                          className="text-[10px] font-bold"
                          style={{ fontFamily: MONO, color: INK }}
                        >
                          ss_A{label[0]}
                        </div>
                        <div
                          className="text-[9px] uppercase tracking-wider"
                          style={{ color: c.stroke }}
                        >
                          {label}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div
                  className="text-[11px] text-center"
                  style={{ color: SLATE, maxWidth: 240 }}
                >
                  one shared secret per hop, all derived from e
                </div>
              </div>
            </Panel>
          </div>

          <div
            className="mt-6 border-[1.5px] p-4 flex flex-col gap-2"
            style={{
              background: CREAM_CARD,
              borderColor: INK,
              opacity: vCheck ? 1 : 0,
              transform: vCheck ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 500ms ease-out, transform 500ms ease-out",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{ color: SLATE }}
            >
              Strawman flaws , both resolved
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 flex items-center justify-center font-bold text-[14px]"
                style={{ color: "#5a7a2f" }}
              >
                ✓
              </div>
              <div
                className="text-[12px]"
                style={{
                  color: SLATE,
                  textDecoration: "line-through",
                  textDecorationColor: "#5a7a2f",
                  textDecorationThickness: 1.5,
                }}
              >
                Packet size scales with N, leaking hop position
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 flex items-center justify-center font-bold text-[14px]"
                style={{ color: "#5a7a2f" }}
              >
                ✓
              </div>
              <div
                className="text-[12px]"
                style={{
                  color: SLATE,
                  textDecoration: "line-through",
                  textDecorationColor: "#5a7a2f",
                  textDecorationThickness: 1.5,
                }}
              >
                Alice persists N private keys for the payment's lifetime
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs leading-relaxed flex-1 max-w-2xl" style={{ color: INK }}>
            From a single session key, Alice derives shared secrets with every hop on the route,
            without persisting per-hop private keys and without making the packet's shape
            depend on route length. That's the foundation the next chapters build on.
          </div>
          <button
            onClick={() => setAnimKey((k) => k + 1)}
            className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors shrink-0"
            data-testid="shared-secrets-recap-diagram-replay"
          >
            ↻ Replay
          </button>
        </div>
      </div>
    </div>
  );
}

export default SharedSecretsRecapDiagram;
