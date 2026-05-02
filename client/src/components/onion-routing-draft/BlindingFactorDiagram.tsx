import { useState, useEffect, useRef } from "react";

// ────────────────────────────────────────────────────────────────────────────
// BlindingFactorDiagram (DRAFT)
//
// A focused close-up on ONE step of the Sphinx blinding cascade. Given hop i's
// ephemeral pubkey E_i and shared secret ss_i, we derive the blinding factor
// b_i = SHA256(E_i || ss_i) and use it to advance the chain to the next hop's
// ephemeral key: E_{i+1} = E_i · b_i.
//
// Auto-plays once on mount with a single Replay button below the stage.
//
// Visual style follows the locked onion-routing course format:
//   - Black header bar with white pixel-letter-spaced uppercase title.
//   - Cream body, ink borders, gold accents.
//   - Body sans-serif; protocol values in JetBrains Mono.
// ────────────────────────────────────────────────────────────────────────────

const MONO_FONT = '"JetBrains Mono", "Fira Code", monospace';

const PIXEL_BLUE = "#3b6aa0";
const PIXEL_TEAL = "#2d7a7a";
const PIXEL_VIOLET = "#7b4b8a";
const GOLD = "#b8860b";
const INK = "#0f172a";

// Beat plan (ms offsets from the start of a run):
// 0    : reset all to hidden
// 50   : inputs row fades in (300ms)
// 450  : down arrow #1 draws (200ms)
// 750  : hash row fades in + gold pulse (400ms)
// 1300 : down arrow #2 draws (200ms)
// 1600 : output row fades in + violet pulse (400ms)
const BEATS = {
  inputs: 50,
  arrow1: 450,
  hash: 750,
  arrow2: 1300,
  output: 1600,
} as const;

interface AnimState {
  inputs: boolean;
  arrow1: boolean;
  hash: boolean;
  hashPulse: boolean;
  arrow2: boolean;
  output: boolean;
  outputPulse: boolean;
}

const INITIAL_STATE: AnimState = {
  inputs: false,
  arrow1: false,
  hash: false,
  hashPulse: false,
  arrow2: false,
  output: false,
  outputPulse: false,
};

// A small downward arrow drawn with an absolutely-positioned line + triangle.
// Animates by sweeping its height from 0 to full when `drawn` flips true.
function DownArrow({ drawn }: { drawn: boolean }) {
  const FULL_HEIGHT = 32;
  return (
    <div
      className="relative mx-auto"
      style={{ width: 12, height: FULL_HEIGHT }}
      aria-hidden
    >
      <div
        className="absolute left-1/2"
        style={{
          top: 0,
          width: 0,
          height: drawn ? FULL_HEIGHT - 6 : 0,
          borderLeft: `1.5px solid ${INK}`,
          transform: "translateX(-50%)",
          transition: "height 200ms ease-out",
        }}
      />
      <div
        className="absolute left-1/2"
        style={{
          top: FULL_HEIGHT - 7,
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `7px solid ${INK}`,
          opacity: drawn ? 1 : 0,
          transition: "opacity 150ms ease-out 150ms",
        }}
      />
    </div>
  );
}

// A pill-shaped value box with a small uppercase label on top and a monospace
// value beneath. Tinted by the caller via the `tint` color.
function Pill({
  label,
  value,
  tint,
  visible,
}: {
  label: string;
  value: string;
  tint: string;
  visible: boolean;
}) {
  return (
    <div
      className="border-[1.5px] px-3 py-2 flex flex-col items-center gap-0.5"
      style={{
        background: "#fffdf5",
        borderColor: tint,
        borderRadius: 999,
        minWidth: 180,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 300ms ease-out, transform 300ms ease-out",
      }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-wider"
        style={{ color: tint }}
      >
        {label}
      </span>
      <span
        className="text-[11px] font-bold"
        style={{ fontFamily: MONO_FONT, color: INK }}
      >
        {value}
      </span>
    </div>
  );
}

export function BlindingFactorDiagram() {
  const [state, setState] = useState<AnimState>(INITIAL_STATE);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  function clearTimers() {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }

  function play() {
    clearTimers();
    setState(INITIAL_STATE);

    const schedule = (delay: number, patch: Partial<AnimState>) => {
      timersRef.current.push(
        setTimeout(() => {
          setState((s) => ({ ...s, ...patch }));
        }, delay)
      );
    };

    schedule(BEATS.inputs, { inputs: true });
    schedule(BEATS.arrow1, { arrow1: true });
    schedule(BEATS.hash, { hash: true, hashPulse: true });
    schedule(BEATS.hash + 400, { hashPulse: false });
    schedule(BEATS.arrow2, { arrow2: true });
    schedule(BEATS.output, { output: true, outputPulse: true });
    schedule(BEATS.output + 400, { outputPulse: false });
  }

  // Auto-play once on mount.
  useEffect(() => {
    play();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="my-8 border-[1.5px] border-foreground/40 bg-card overflow-hidden"
      data-testid="blinding-factor-diagram"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Black section header */}
      <div className="bg-black text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#b8860b]" />
          <span className="text-sm font-bold tracking-[0.08em] uppercase">
            One blinding step
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#fefdfb] dark:bg-[#0b1220] px-4 py-6 flex flex-col items-center"
        style={{ minHeight: 440 }}
      >
        {/* ROW 1 — INPUTS */}
        <div className="w-full max-w-md flex flex-col items-center">
          <div
            className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
            style={{ color: INK, opacity: 0.6 }}
          >
            Inputs
          </div>
          <div
            className="w-full border-[1.5px] p-3 flex items-center justify-center gap-3"
            style={{
              background: "#fffdf5",
              borderColor: INK,
              opacity: state.inputs ? 1 : 0,
              transform: state.inputs ? "translateY(0)" : "translateY(6px)",
              transition: "opacity 300ms ease-out, transform 300ms ease-out",
            }}
          >
            <Pill
              label="E_i"
              value="0x02 9a 3c..."
              tint={PIXEL_BLUE}
              visible={state.inputs}
            />
            <Pill
              label="ss_i"
              value="0x7e 1b f4 c8..."
              tint={PIXEL_TEAL}
              visible={state.inputs}
            />
          </div>
        </div>

        {/* Connector arrow #1 */}
        <div className="my-1.5">
          <DownArrow drawn={state.arrow1} />
        </div>

        {/* ROW 2 — HASH FUNCTION */}
        <div className="w-full max-w-md flex flex-col items-center">
          <div
            className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
            style={{ color: INK, opacity: 0.6 }}
          >
            Hash function
          </div>
          <div
            className="w-full p-3 flex flex-col items-center justify-center gap-1"
            style={{
              background: "#fffdf5",
              borderStyle: "dashed",
              borderWidth: "1.5px",
              borderColor: GOLD,
              opacity: state.hash ? 1 : 0,
              transform: state.hash ? "translateY(0)" : "translateY(6px)",
              boxShadow: state.hashPulse
                ? `0 0 0 3px ${GOLD}33`
                : "0 0 0 0 transparent",
              transition:
                "opacity 400ms ease-out, transform 400ms ease-out, box-shadow 400ms ease-out",
            }}
          >
            <div
              className="text-[12px] font-bold text-center"
              style={{ fontFamily: MONO_FONT, color: INK }}
            >
              b_i &nbsp;=&nbsp; SHA256( &nbsp;E_i &nbsp;‖&nbsp; ss_i &nbsp;)
            </div>
            <div
              className="text-[11px] mt-0.5"
              style={{ fontFamily: MONO_FONT, color: GOLD }}
            >
              = 0xaf 24 9c 3b ...
            </div>
          </div>
        </div>

        {/* Connector arrow #2 */}
        <div className="my-1.5">
          <DownArrow drawn={state.arrow2} />
        </div>

        {/* ROW 3 — OUTPUT */}
        <div className="w-full max-w-md flex flex-col items-center">
          <div
            className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
            style={{ color: INK, opacity: 0.6 }}
          >
            Next ephemeral key
          </div>
          <div
            className="w-full border-[1.5px] p-3 flex flex-col items-center justify-center gap-1"
            style={{
              background: "#fffdf5",
              borderColor: PIXEL_VIOLET,
              borderRadius: 999,
              opacity: state.output ? 1 : 0,
              transform: state.output ? "translateY(0)" : "translateY(6px)",
              boxShadow: state.outputPulse
                ? `0 0 0 3px ${PIXEL_VIOLET}33`
                : "0 0 0 0 transparent",
              transition:
                "opacity 400ms ease-out, transform 400ms ease-out, box-shadow 400ms ease-out",
            }}
          >
            <div
              className="text-[12px] font-bold text-center"
              style={{ fontFamily: MONO_FONT, color: INK }}
            >
              E_<span style={{ fontSize: 10 }}>i+1</span>
              &nbsp;=&nbsp; E_i &nbsp;·&nbsp; b_i
            </div>
            <div
              className="text-[11px] mt-0.5"
              style={{ fontFamily: MONO_FONT, color: PIXEL_VIOLET }}
            >
              → 0x03 b8 4f 60 ...
            </div>
          </div>
        </div>
      </div>

      {/* Replay control */}
      <div className="px-4 py-3 border-t-[1.5px] border-foreground/30 bg-card flex items-center justify-between gap-4">
        <div className="text-sm leading-relaxed flex-1 max-w-2xl">
          One step of the blinding cascade: hash the current ephemeral key with
          the hop's shared secret to get a blinding factor, then multiply E_i by
          that factor to advance to the next hop's ephemeral key.
        </div>
        <button
          onClick={play}
          className="px-3 py-1.5 border-[1.5px] border-black bg-black text-white font-bold text-xs tracking-[0.05em] uppercase hover:bg-[#b8860b] hover:border-[#b8860b] transition-colors shrink-0"
          data-testid="blinding-factor-diagram-replay"
        >
          ↻ Replay
        </button>
      </div>
    </div>
  );
}

export default BlindingFactorDiagram;
