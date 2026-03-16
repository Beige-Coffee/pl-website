/**
 * CapstonePanel — Live Connection Lab
 *
 * Three-panel layout for the Noise Protocol capstone:
 *   1. Top: Handshake Visualizer (two nodes + animated arrows)
 *   2. Middle: Byte Inspector (one per completed act)
 *   3. Bottom: Encrypted Terminal (send/receive messages)
 *
 * Wired to NoiseOrchestrator which coordinates Pyodide + WebSocket.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import SegmentedFieldBar from "@/components/SegmentedFieldBar";
import InlineByteGrid from "@/components/InlineByteGrid";
import CipherStateInspector from "@/components/CipherStateInspector";
import BurstSendControl from "@/components/BurstSendControl";
import { type CapturedPacket } from "@/components/WireInspector";
import {
  NoiseOrchestrator,
  type OrchestratorState,
  type OrchestratorEvent,
  type CipherStateSnapshot,
  type BurstProgressInfo,
} from "@/lib/noise-orchestrator";
import { CODE_EXERCISES } from "@/data/code-exercises";

// Sans-serif override — the site's font-mono maps to VT323 (retro terminal),
// but the capstone lab should use a clean sans-serif for readability.
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// ── Types ──────────────────────────────────────────────────────────────────

interface CapstonePanelProps {
  getProgress: (key: string) => string | null;
  theme: "light" | "dark";
}

interface PreflightStatus {
  exerciseId: string;
  title: string;
  passed: boolean | null; // null = not yet checked
  chapter: string;
}

interface ActData {
  act: 1 | 2 | 3;
  bytes: Uint8Array;
  timestamp: Date;
}

interface TerminalMessage {
  id: number;
  direction: "sent" | "received" | "system";
  plaintext: string;
  ciphertext?: Uint8Array;
  timestamp: Date;
}

type Phase = "preflight" | "handshake" | "transport";

// ── Exercise metadata (mirrors orchestrator) ────────────────────────────────

const EXERCISE_IDS = [
  "exercise-generate-keypair",
  "exercise-ecdh",
  "exercise-hkdf",
  "exercise-init-state",
  "exercise-act1-initiator",
  "exercise-act1-responder",
  "exercise-act2-responder",
  "exercise-act2-initiator",
  "exercise-act3-initiator",
  "exercise-encrypt",
  "exercise-decrypt",
  "exercise-key-rotation",
] as const;

const EXERCISE_CHAPTER_MAP: Record<string, string> = {
  "exercise-generate-keypair": "crypto-primitives",
  "exercise-ecdh": "crypto-primitives",
  "exercise-hkdf": "crypto-primitives",
  "exercise-init-state": "handshake-setup",
  "exercise-act1-initiator": "act-1",
  "exercise-act1-responder": "act-1",
  "exercise-act2-responder": "act-2",
  "exercise-act2-initiator": "act-2",
  "exercise-act3-initiator": "act-3",
  "exercise-encrypt": "sending-messages",
  "exercise-decrypt": "receiving-messages",
  "exercise-key-rotation": "key-rotation",
};

// Real Lightning BOLT message types as quick commands
const QUICK_COMMANDS = [
  { cmd: "init", label: "init", desc: "BOLT 1 · type 16" },
  { cmd: "ping", label: "ping", desc: "BOLT 1 · type 18" },
  { cmd: "node_announcement", label: "node_ann", desc: "BOLT 7 · type 257" },
] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

// ── Component ───────────────────────────────────────────────────────────────

export default function CapstonePanel({ getProgress, theme }: CapstonePanelProps) {
  const isDark = theme === "dark";

  // ── Orchestrator ──
  const orchestratorRef = useRef<NoiseOrchestrator | null>(null);
  const msgIdRef = useRef(0);

  // ── State ──
  const [phase, setPhase] = useState<Phase>("preflight");
  const [orchState, setOrchState] = useState<OrchestratorState>("idle");
  const [preflight, setPreflight] = useState<PreflightStatus[]>(() =>
    EXERCISE_IDS.map((id) => ({
      exerciseId: id,
      title: CODE_EXERCISES[id]?.title ?? id,
      passed: null,
      chapter: EXERCISE_CHAPTER_MAP[id] ?? "",
    }))
  );
  const [preflightRunning, setPreflightRunning] = useState(false);
  const [allPreflightPassed, setAllPreflightPassed] = useState(false);
  const [handshakeInProgress, setHandshakeInProgress] = useState(false);
  const [actData, setActData] = useState<ActData[]>([]);
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [terminalInput, setTerminalInput] = useState("");
  const [error, setError] = useState<{ message: string; exerciseLink?: string } | null>(null);
  const [selectedAct, setSelectedAct] = useState<(1 | 2 | 3) | null>(null);
  const [selectedTransportId, setSelectedTransportId] = useState<number | null>(null);
  const [celebrated, setCelebrated] = useState(false);
  const [hasSentMessage, setHasSentMessage] = useState(false);
  const [studentPubkey, setStudentPubkey] = useState<string | null>(null);

  // ── Cipher State ──
  const [sendCipherState, setSendCipherState] = useState<CipherStateSnapshot | null>(null);
  const [recvCipherState, setRecvCipherState] = useState<CipherStateSnapshot | null>(null);
  const [rotatedSide, setRotatedSide] = useState<"send" | "recv" | null>(null);

  // ── Burst Mode ──
  const [burstRunning, setBurstRunning] = useState(false);
  const [burstProgress, setBurstProgress] = useState<{
    phase: "send" | "drain";
    sent: number;
    total: number;
    sendNonce: number;
  } | null>(null);

  // ── Wire Inspector (packet capture) ──
  const [packets, setPackets] = useState<CapturedPacket[]>([]);
  const packetIdRef = useRef(0);

  const addPacket = useCallback((packet: Omit<CapturedPacket, "id">) => {
    setPackets((prev) => [...prev, { ...packet, id: ++packetIdRef.current }]);
  }, []);

  // Terminal auto-scroll
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Transport packet auto-scroll
  const transportEndRef = useRef<HTMLDivElement>(null);
  const transportPrevCountRef = useRef(0);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      replayAbortRef.current = true;
      orchestratorRef.current?.destroy();
    };
  }, []);

  const preflightRanRef = useRef(false);

  // ── Visual replay ──
  //
  // The orchestrator runs the full handshake at network speed (~1s).
  // To give the student time to observe each act, we buffer handshake
  // events and replay them with visual delays in the UI.

  const handshakeBufferRef = useRef<OrchestratorEvent[]>([]);
  const bufferingRef = useRef(false);
  const replayAbortRef = useRef(false);

  // Delays during visual replay (ms)
  const ACT_START_DELAY = 800; // show "in-progress" animation
  const ACT_COMPLETE_DELAY = 1500; // observe completed act + byte data

  const ACT_START_STATES = useMemo(
    () => new Set(["act1_send", "act2_process", "act3_send"]),
    []
  );

  // Process a single orchestrator event (updates React state)
  const processEvent = useCallback(
    (event: OrchestratorEvent) => {
      switch (event.type) {
        case "preflight_progress":
          setPreflight((prev) =>
            prev.map((p) =>
              p.exerciseId === event.exercise
                ? { ...p, passed: event.passed }
                : p
            )
          );
          break;

        case "state_change":
          setOrchState(event.to);
          if (event.to === "transport_ready") {
            setPhase("transport");
            setHandshakeInProgress(false);
            setCelebrated(true);

            // Fire confetti (respect prefers-reduced-motion)
            const prefersReducedMotion = window.matchMedia(
              "(prefers-reduced-motion: reduce)"
            ).matches;
            if (!prefersReducedMotion) {
              confetti({
                particleCount: 25,
                spread: 60,
                origin: { y: 0.6 },
                colors: ["#FFD700", "#22c55e", "#3b82f6"],
                disableForReducedMotion: true,
              });
            }

            // Add hint message to terminal
            setMessages((prev) => [
              ...prev,
              {
                id: ++msgIdRef.current,
                direction: "system" as const,
                plaintext:
                  'Secure channel established. Try typing "ping" and pressing Enter.',
                timestamp: new Date(),
              },
            ]);
          }
          break;

        case "act_complete":
          setActData((prev) => [
            ...prev,
            { act: event.act, bytes: event.bytes, timestamp: new Date() },
          ]);
          setSelectedAct(event.act);
          setSelectedTransportId(null);
          // Capture packet for Wire Inspector
          addPacket({
            timestamp: new Date(),
            direction: event.act === 2 ? "received" : "sent",
            phase: "handshake",
            rawBytes: event.bytes,
            label: `Act ${event.act}`,
            act: event.act,
          });
          break;

        case "message_sent":
          setMessages((prev) => [
            ...prev,
            {
              id: ++msgIdRef.current,
              direction: "sent",
              plaintext: event.plaintext,
              ciphertext: event.ciphertext,
              timestamp: new Date(),
            },
          ]);
          // Capture packet for Wire Inspector
          addPacket({
            timestamp: new Date(),
            direction: "sent",
            phase: "transport",
            rawBytes: event.ciphertext,
            label: `"${event.plaintext}"`,
            decryptedText: event.plaintext,
          });
          // Track first successful message
          setHasSentMessage((prev) => {
            if (!prev) {
              const pubkey =
                orchestratorRef.current?.studentPubkey ?? null;
              setStudentPubkey(pubkey);
            }
            return true;
          });
          break;

        case "message_received":
          // Silently consume the completion token — don't show raw JSON in terminal
          if (event.plaintext.startsWith("__completion_token__:")) {
            // Record lab completion on the server (best-effort, don't block UX)
            const tokenPayload = event.plaintext.slice("__completion_token__:".length);
            fetch("/api/noise/lab-complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: tokenPayload }),
              credentials: "include",
            }).catch(() => { /* ignore — user may not be logged in */ });
            break;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: ++msgIdRef.current,
              direction: "received",
              plaintext: event.plaintext,
              ciphertext: event.ciphertext,
              timestamp: new Date(),
            },
          ]);
          // Capture packet for Wire Inspector
          addPacket({
            timestamp: new Date(),
            direction: "received",
            phase: "transport",
            rawBytes: event.ciphertext,
            label: `"${event.plaintext}"`,
            decryptedText: event.plaintext,
          });
          break;

        case "cipher_state_update":
          setSendCipherState(event.send);
          setRecvCipherState(event.recv);
          if (event.rotated) {
            setRotatedSide(event.rotated);
            // Clear rotation flag after animation completes
            setTimeout(() => setRotatedSide(null), 1600);

            // Add rotation message to terminal
            setMessages((prev) => [
              ...prev,
              {
                id: ++msgIdRef.current,
                direction: "system" as const,
                plaintext: `[KEY ROTATION] ${event.rotated === "send" ? "Send" : "Receive"} key rotated at nonce 1000. Your _maybe_rotate() derived new keys via HKDF.`,
                timestamp: new Date(),
              },
            ]);
          }
          break;

        case "error":
          setError({
            message: event.message,
            exerciseLink: event.exerciseLink,
          });
          setPreflightRunning(false);
          setHandshakeInProgress(false);
          break;
      }
    },
    [addPacket]
  );

  // Replay buffered handshake events with visual pacing.
  // If immediate=true (error case), flush everything with no delays.
  const replayHandshake = useCallback(
    async (immediate: boolean) => {
      const events = [...handshakeBufferRef.current];
      handshakeBufferRef.current = [];

      for (const event of events) {
        if (replayAbortRef.current) break;

        processEvent(event);

        if (immediate) continue;

        // Brief pause when an act enters "in-progress" so the student
        // sees the animation before it completes
        if (
          event.type === "state_change" &&
          ACT_START_STATES.has(event.to)
        ) {
          await new Promise((r) => setTimeout(r, ACT_START_DELAY));
        }
        // Longer pause after an act completes so the student can
        // observe the byte data and wire inspector update
        else if (event.type === "act_complete") {
          await new Promise((r) => setTimeout(r, ACT_COMPLETE_DELAY));
        }
      }
    },
    [processEvent, ACT_START_STATES, ACT_START_DELAY, ACT_COMPLETE_DELAY]
  );

  // Event handler — buffers handshake events, processes others immediately
  const handleEvent = useCallback(
    (event: OrchestratorEvent) => {
      // During the handshake, buffer events for visual replay
      if (bufferingRef.current) {
        handshakeBufferRef.current.push(event);

        // On error: stop buffering, flush immediately
        if (event.type === "error") {
          bufferingRef.current = false;
          replayHandshake(true);
        }
        // On handshake complete: stop buffering, replay with delays
        else if (
          event.type === "state_change" &&
          event.to === "transport_ready"
        ) {
          bufferingRef.current = false;
          replayHandshake(false);
        }
        return;
      }

      // Outside handshake phase: process immediately
      processEvent(event);
    },
    [processEvent, replayHandshake]
  );

  // ── Actions ──
  const startPreflight = useCallback(async () => {
    setError(null);
    setPreflightRunning(true);
    setAllPreflightPassed(false);
    setPreflight((prev) => prev.map((p) => ({ ...p, passed: null })));

    // Create a fresh orchestrator
    orchestratorRef.current?.destroy();
    const orch = new NoiseOrchestrator(getProgress);
    orchestratorRef.current = orch;
    const unsub = orch.subscribe(handleEvent);

    const passed = await orch.startPreflight();

    if (passed) {
      // Mark all as passed since events fire before this resolves
      setPreflight((prev) => prev.map((p) => ({ ...p, passed: true })));
      setAllPreflightPassed(true);
    }

    setPreflightRunning(false);
    // Don't unsub -- keep listening for handshake events
  }, [getProgress, handleEvent]);

  // ── Auto-run preflight on mount and after retry ──
  useEffect(() => {
    if (phase === "preflight" && !preflightRanRef.current) {
      preflightRanRef.current = true;
      startPreflight();
    }
  }, [phase, startPreflight]);

  const startHandshake = useCallback(async () => {
    if (!orchestratorRef.current) return;
    setError(null);
    setPhase("handshake");
    setHandshakeInProgress(true);
    setActData([]);
    setMessages([]);

    // Enable event buffering — the orchestrator runs at full speed
    // and we replay the events visually with delays afterward
    handshakeBufferRef.current = [];
    bufferingRef.current = true;
    replayAbortRef.current = false;

    await orchestratorRef.current.startHandshake();
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!orchestratorRef.current || !text.trim()) return;
    try {
      await orchestratorRef.current.sendMessage(text.trim());
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: ++msgIdRef.current,
          direction: "system",
          plaintext: `Error: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  const handleBurst = useCallback(async (count: number) => {
    if (!orchestratorRef.current) return;
    setBurstRunning(true);
    setBurstProgress(null);

    // Add burst start message to terminal
    setMessages((prev) => [
      ...prev,
      {
        id: ++msgIdRef.current,
        direction: "system" as const,
        plaintext: `[BURST] Sending ${count} pings to trigger key rotation... (server responds with pong to each)`,
        timestamp: new Date(),
      },
    ]);

    try {
      let lastReportedHundred = 0;
      await orchestratorRef.current.sendBurst(count, (info: BurstProgressInfo) => {
        setBurstProgress({
          phase: info.phase,
          sent: info.sent,
          total: info.total,
          sendNonce: info.sendNonce,
        });

        // Add progress to terminal every 100 messages
        if (info.phase === "send") {
          const currentHundred = Math.floor(info.sent / 100);
          if (currentHundred > lastReportedHundred || info.sent === info.total) {
            lastReportedHundred = currentHundred;
            setMessages((prev) => [
              ...prev,
              {
                id: ++msgIdRef.current,
                direction: "system" as const,
                plaintext: `[BURST] ${info.sent}/${info.total} sent (send nonce: ${info.sendNonce})`,
                timestamp: new Date(),
              },
            ]);
          }
        } else if (info.phase === "drain") {
          setMessages((prev) => [
            ...prev,
            {
              id: ++msgIdRef.current,
              direction: "system" as const,
              plaintext: `[BURST] Decrypting ${count} pong responses... (this updates your receive nonce)`,
              timestamp: new Date(),
            },
          ]);
        }
      });

      setMessages((prev) => [
        ...prev,
        {
          id: ++msgIdRef.current,
          direction: "system" as const,
          plaintext: `[BURST] Complete. ${count} pings sent + ${count} pongs decrypted.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: ++msgIdRef.current,
          direction: "system" as const,
          plaintext: `[BURST] Error: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setBurstRunning(false);
      setBurstProgress(null);
    }
  }, []);

  const handleTerminalSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (terminalInput.trim()) {
        sendMessage(terminalInput.trim());
        setTerminalInput("");
      }
    },
    [terminalInput, sendMessage]
  );

  const retry = useCallback(() => {
    replayAbortRef.current = true;
    bufferingRef.current = false;
    handshakeBufferRef.current = [];
    setError(null);
    setPhase("preflight");
    setOrchState("idle");
    setActData([]);
    setSelectedAct(null);
    setSelectedTransportId(null);
    setMessages([]);
    setPackets([]);
    setAllPreflightPassed(false);
    setPreflight((prev) => prev.map((p) => ({ ...p, passed: null })));
    orchestratorRef.current?.destroy();
    orchestratorRef.current = null;
    preflightRanRef.current = false; // re-trigger auto-run
  }, []);


  // ── Act status for visualizer ──
  const actStatus = useMemo(() => {
    const completed = new Set(actData.map((a) => a.act));
    const stateToAct: Partial<Record<OrchestratorState, 1 | 2 | 3>> = {
      act1_send: 1,
      act1_wait: 1,
      act2_process: 2,
      act3_send: 3,
      act3_wait: 3,
    };
    const inProgressAct = stateToAct[orchState] ?? null;

    return [1, 2, 3].map((act) => ({
      act: act as 1 | 2 | 3,
      status: completed.has(act as 1 | 2 | 3)
        ? ("complete" as const)
        : inProgressAct === act
          ? ("in-progress" as const)
          : ("pending" as const),
    }));
  }, [actData, orchState]);

  // ── Transport packets (non-system messages for display) ──
  const transportMessages = useMemo(
    () => messages.filter((m) => m.direction !== "system"),
    [messages]
  );

  const selectedTransportMsg = useMemo(
    () => transportMessages.find((m) => m.id === selectedTransportId) ?? null,
    [transportMessages, selectedTransportId]
  );

  const handleTransportClick = useCallback((msgId: number) => {
    setSelectedTransportId((prev) => (prev === msgId ? null : msgId));
    setSelectedAct(null);
  }, []);

  // Auto-scroll transport list when new messages arrive
  useEffect(() => {
    if (transportMessages.length > transportPrevCountRef.current) {
      transportEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    transportPrevCountRef.current = transportMessages.length;
  }, [transportMessages.length]);

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }

  // ── Theme colors (bitcoin.design sketch style) ──
  // Light: B&W with thin borders, inverted headers, minimal accent color
  // Dark: preserved for backward compat but rarely used
  const colors = isDark
    ? {
        cardBg: "bg-[#0f1930]",
        cardBorder: "border-[#2a3552]",
        headerBg: "bg-white/10",
        headerText: "text-white",
        sectionBg: "bg-[#0b1220]",
        text: "text-slate-200",
        textMuted: "text-slate-400",
        textDim: "text-slate-600",
        accent: "text-[#FFD700]",
        accentBg: "bg-[#FFD700]",
        accentBorder: "border-[#FFD700]",
        green: "text-[#8cb369]",
        greenBg: "bg-[#5a7a2f]/20",
        greenBorder: "border-[#5a7a2f]/40",
        red: "text-[#c97a5a]",
        redBg: "bg-[#a0522d]/20",
        redBorder: "border-[#a0522d]/40",
        blue: "text-blue-400",
        blueBg: "bg-blue-500/20",
        blueBorder: "border-blue-500",
        orange: "text-amber-400",
        orangeBg: "bg-amber-500/20",
        orangeBorder: "border-amber-500",
        terminalBg: "bg-[#0a0e1a]",
        terminalBorder: "border-[#1a2540]",
        inputBg: "bg-[#0f1525]",
        inputBorder: "border-[#2a3552]",
      }
    : {
        cardBg: "bg-white",
        cardBorder: "border-black",
        headerBg: "bg-black",
        headerText: "text-white",
        sectionBg: "bg-[#fefdfb]",
        text: "text-[#2a1f0d]",
        textMuted: "text-[#6b5d4f]",
        textDim: "text-[#9a8b78]",
        accent: "text-[#b8860b]",
        accentBg: "bg-[#b8860b]",
        accentBorder: "border-[#b8860b]",
        green: "text-[#5a7a2f]",
        greenBg: "bg-[#5a7a2f]/8",
        greenBorder: "border-[#5a7a2f]/25",
        red: "text-[#a0522d]",
        redBg: "bg-[#a0522d]/8",
        redBorder: "border-[#a0522d]/25",
        blue: "text-[#2563eb]",
        blueBg: "bg-[#2563eb]/5",
        blueBorder: "border-[#2563eb]",
        orange: "text-[#ea580c]",
        orangeBg: "bg-[#ea580c]/5",
        orangeBorder: "border-[#ea580c]",
        terminalBg: "bg-black",
        terminalBorder: "border-black",
        inputBg: "bg-[#111]",
        inputBorder: "border-[#333]",
      };

  return (
    <div className="mt-8 space-y-6" style={{ fontFamily: SANS }}>
      {/* ── Error Banner ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "border-[1.5px] p-4",
              colors.redBg,
              colors.redBorder
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm font-bold mb-1", colors.red)}>
                  ERROR
                </div>
                <div className={cn("text-sm", colors.text)}>
                  {error.message}
                </div>
                {error.exerciseLink && (
                  <a
                    href={error.exerciseLink}
                    className={cn(
                      "inline-block mt-2 text-xs underline underline-offset-4",
                      colors.accent
                    )}
                  >
                    Go to exercise
                  </a>
                )}
              </div>
              <button
                onClick={retry}
                className={cn(
                  "shrink-0 px-3 py-1.5 text-sm font-bold uppercase tracking-[0.05em] border-[1.5px] transition-colors",
                  isDark
                    ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#132043] text-slate-200"
                    : "border-black bg-white hover:bg-black hover:text-white text-black"
                )}
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section 1: Handshake Visualizer ── */}
      <div
        className={cn(
          "border-[1.5px] overflow-hidden",
          colors.cardBorder,
          colors.cardBg
        )}
      >
        {/* Inverted header */}
        <div
          className={cn(
            "px-4 py-2 flex items-center gap-2",
            colors.headerBg
          )}
        >
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              orchState === "transport_ready"
                ? "bg-[#8cb369]"
                : handshakeInProgress
                  ? "bg-amber-400 animate-pulse"
                  : "bg-white/40"
            )}
          />
          <span className={cn("text-sm font-bold tracking-[0.08em] uppercase", colors.headerText)}>
            Noise XK Handshake
          </span>
        </div>

        {/* Visualizer body */}
        <div className="p-4 sm:p-6">
          {/* Nodes + arrows */}
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* "You" node — inverted box */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={cn(
                  "w-16 h-10 sm:w-20 sm:h-11 flex items-center justify-center border-[1.5px] transition-all duration-700",
                  celebrated
                    ? "border-[#b8860b] bg-[#b8860b] text-white"
                    : "border-black bg-black text-white"
                )}
              >
                <span className="text-sm font-bold tracking-[0.05em] uppercase">
                  You
                </span>
              </div>
              <span className={cn("text-xs tracking-wide", colors.textDim)}>
                initiator
              </span>
            </div>

            {/* Act arrows */}
            <div className="flex-1 flex flex-col gap-2 sm:gap-3 min-w-0 px-1 sm:px-4">
              {actStatus.map(({ act, status }) => {
                const isAct1or3 = act === 1 || act === 3;
                const label = `Act ${act}`;
                const ecdh = act === 1 ? "es" : act === 2 ? "ee" : "se";
                const completedActData = actData.find((a) => a.act === act);

                return (
                  <div
                    key={act}
                    className={cn(
                      "flex items-center gap-1.5 sm:gap-2 transition-all duration-200",
                      selectedAct !== null && selectedAct !== act && actData.length > 0 && "opacity-50"
                    )}
                  >
                    {/* Status indicator — square, not circle */}
                    <div
                      className={cn(
                        "w-5 h-5 flex items-center justify-center shrink-0 text-xs font-bold border-[1.5px] transition-colors duration-500",
                        status === "complete"
                          ? celebrated
                            ? "bg-[#b8860b] border-[#b8860b] text-white"
                            : selectedAct === act
                              ? "bg-[#b8860b] border-[#b8860b] text-white"
                              : "bg-black border-black text-white"
                          : status === "in-progress"
                            ? "bg-white border-black text-black animate-pulse"
                            : isDark
                              ? "bg-slate-800 border-slate-700 text-slate-600"
                              : "bg-white border-[#9a8b78] text-[#9a8b78]"
                      )}
                    >
                      {status === "complete" ? "\u2713" : act}
                    </div>

                    {/* Arrow: segmented field bar when complete, line when pending */}
                    <div className="flex-1 relative flex items-center min-h-[20px]">
                      <AnimatePresence mode="wait">
                        {status === "complete" && completedActData ? (
                          <motion.div
                            key={`bar-${act}`}
                            initial={{ scaleX: 0, opacity: 0 }}
                            animate={{ scaleX: 1, opacity: 1 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="w-full"
                            style={{ originX: isAct1or3 ? 0 : 1 }}
                          >
                            <SegmentedFieldBar
                              actNumber={act}
                              bytes={completedActData.bytes}
                              messageType={`act${act}` as "act1" | "act2" | "act3"}
                              isSelected={selectedAct === act}
                              onClick={() => { setSelectedAct((prev) => prev === act ? null : act); setSelectedTransportId(null); }}
                              theme={theme}
                              direction={isAct1or3 ? "ltr" : "rtl"}
                            />
                          </motion.div>
                        ) : status === "complete" ? (
                          <motion.div
                            key={`line-${act}`}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="absolute inset-y-0 flex items-center w-full"
                            style={{ originX: isAct1or3 ? 0 : 1 }}
                          >
                            <div className={cn("h-[1.5px] w-full", celebrated ? "bg-[#b8860b]" : "bg-black")} />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      {status !== "complete" && (
                        <div
                          className={cn(
                            "h-px w-full",
                            status === "in-progress"
                              ? "bg-black/30"
                              : isDark ? "bg-slate-700" : "bg-[#e8dcc8]"
                          )}
                        />
                      )}
                    </div>

                    {/* Arrowhead */}
                    {status === "complete" && (
                      <div
                        className={cn(
                          "w-0 h-0 shrink-0",
                          isAct1or3
                            ? "border-l-[5px] border-y-[3px] border-y-transparent"
                            : "border-r-[5px] border-y-[3px] border-y-transparent",
                          celebrated || selectedAct === act
                            ? isAct1or3 ? "border-l-[#b8860b]" : "border-r-[#b8860b]"
                            : isAct1or3 ? "border-l-black" : "border-r-black"
                        )}
                      />
                    )}

                    {/* Label + timestamp */}
                    <div className="shrink-0 w-16 sm:w-20 text-right">
                      <span
                        className={cn(
                          "text-sm font-semibold tracking-wide",
                          status === "complete"
                            ? celebrated || selectedAct === act ? "text-[#b8860b]" : colors.text
                            : status === "in-progress"
                              ? colors.text
                              : colors.textDim
                        )}
                      >
                        {label} ({ecdh})
                      </span>
                      {status === "complete" && completedActData?.timestamp && (
                        <div className={cn("text-[10px]", isDark ? "text-slate-600" : "text-[#9a8b78]")}
                          style={{ fontFamily: '"JetBrains Mono", monospace' }}
                        >
                          {formatTime(completedActData.timestamp)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* "Server" node — always black */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className="w-16 h-10 sm:w-20 sm:h-11 flex items-center justify-center border-[1.5px] border-black bg-black text-white"
              >
                <span className="text-sm font-bold tracking-[0.05em] uppercase">
                  Server
                </span>
              </div>
              <span className={cn("text-xs tracking-wide", colors.textDim)}>
                responder
              </span>
            </div>
          </div>

          {/* Inline byte grid for selected act */}
          <AnimatePresence>
            {selectedAct && actData.find((a) => a.act === selectedAct) && (
              <motion.div
                key={`byte-grid-${selectedAct}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden mt-3"
              >
                <InlineByteGrid
                  act={selectedAct}
                  bytes={actData.find((a) => a.act === selectedAct)!.bytes}
                  messageType={`act${selectedAct}` as "act1" | "act2" | "act3"}
                  theme={theme}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transport messages — visual arrows between nodes */}
          <AnimatePresence>
            {phase === "transport" && transportMessages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                {/* Divider */}
                <div
                  className={cn(
                    "mt-2 mb-1 py-1 text-center text-xs tracking-widest font-bold border-t",
                    isDark ? "text-slate-600 border-white/5" : "text-[#9a8b78] border-black/5"
                  )}
                >
                  {"\u2500\u2500\u2500"} encrypted transport {"\u2500\u2500\u2500"}
                </div>

                {/* Scrollable transport rows — message bubble style */}
                <div className="max-h-[200px] overflow-y-auto space-y-1.5 px-1">
                  {transportMessages.map((msg) => {
                    const isSent = msg.direction === "sent";
                    const isSelected = selectedTransportId === msg.id;
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn("flex", isSent ? "justify-start" : "justify-end")}
                      >
                        <button
                          onClick={() => handleTransportClick(msg.id)}
                          className={cn(
                            "max-w-[85%] px-3 py-1.5 border-[1.5px] text-left transition-all cursor-pointer",
                            isSelected
                              ? "border-[#b8860b] ring-1 ring-[#b8860b]/30"
                              : isSent
                                ? isDark ? "border-slate-700 hover:border-slate-500" : "border-black/15 hover:border-black/30"
                                : isDark ? "border-slate-700 hover:border-slate-500" : "border-black/80 hover:border-black",
                            isSent
                              ? isDark ? "bg-[#0f1930]" : "bg-white"
                              : isDark ? "bg-slate-800" : "bg-black text-white"
                          )}
                        >
                          {/* Plaintext */}
                          <div className={cn(
                            "text-xs sm:text-sm",
                            isSent
                              ? isDark ? "text-slate-200" : "text-[#2a1f0d]"
                              : isDark ? "text-slate-200" : "text-white"
                          )}>
                            {msg.plaintext}
                          </div>
                          {/* Meta line: byte count + timestamp */}
                          <div className={cn(
                            "flex items-center gap-2 mt-0.5 text-[10px]",
                            isSent
                              ? isDark ? "text-slate-600" : "text-[#9a8b78]"
                              : isDark ? "text-slate-500" : "text-white/50"
                          )} style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                            <span>{isSent ? "\u2192 sent" : "\u2190 received"}</span>
                            <span>{msg.ciphertext?.length ?? 0}B encrypted</span>
                            <span>{formatTime(msg.timestamp)}</span>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                  <div ref={transportEndRef} />
                </div>

                {/* Inline byte grid for selected transport packet */}
                <AnimatePresence>
                  {selectedTransportMsg && selectedTransportMsg.ciphertext && (
                    <motion.div
                      key={`transport-grid-${selectedTransportMsg.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <InlineByteGrid
                        bytes={selectedTransportMsg.ciphertext}
                        messageType="transport"
                        theme={theme}
                        label={`Transport (${selectedTransportMsg.ciphertext.length} bytes) ${selectedTransportMsg.direction === "sent" ? "\u2192 sent" : "\u2190 received"}`}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Begin Handshake button — sketch style */}
          <div className="mt-6 flex flex-col items-center gap-2">
            {phase === "preflight" && (
              <button
                onClick={startHandshake}
                disabled={!allPreflightPassed || preflightRunning}
                className={cn(
                  "px-6 py-2.5 text-sm font-bold uppercase tracking-[0.05em] border-[1.5px] transition-all",
                  !allPreflightPassed || preflightRunning
                    ? "opacity-50 cursor-not-allowed border-[#9a8b78] text-[#9a8b78]"
                    : "border-black bg-black text-white hover:bg-white hover:text-black"
                )}
              >
                {preflightRunning ? "Verifying exercises..." : "Begin Handshake"}
              </button>
            )}
            {phase === "handshake" && (
              <div className={cn("text-sm", "text-amber-400")}>
                Handshake in progress...
              </div>
            )}
            {phase === "transport" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="text-center"
              >
                <div className={cn("text-sm font-bold uppercase tracking-[0.08em]", celebrated ? "text-[#b8860b]" : colors.text)}>
                  Secure Channel Established
                </div>
                <div className={cn("text-sm mt-1", colors.textMuted)}>
                  Every byte was encrypted by YOUR code.
                </div>
              </motion.div>
            )}
          </div>

        </div>
      </div>

      {/* ── Incomplete exercises notification ── */}
      <AnimatePresence>
        {phase === "preflight" && !preflightRunning && !allPreflightPassed && preflight.some((p) => p.passed === false) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "border-[1.5px] p-3 sm:p-4",
                colors.cardBorder,
                colors.cardBg
              )}
            >
              <div className={cn("text-sm font-bold mb-2", colors.text)}>
                Complete these exercises to unlock the handshake:
              </div>
              <div className="space-y-1">
                {preflight
                  .filter((p) => p.passed === false)
                  .map((p) => (
                    <div key={p.exerciseId} className="flex items-center gap-2 text-sm">
                      <span className={cn("shrink-0", colors.red)}>{"\u2717"}</span>
                      <span className={cn("flex-1 min-w-0 truncate", colors.textMuted)}>
                        {p.title}
                      </span>
                      {p.chapter && (
                        <a
                          href={`/noise-tutorial/${p.chapter}`}
                          className={cn(
                            "shrink-0 text-xs underline underline-offset-2",
                            colors.accent
                          )}
                        >
                          review
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cipher State Inspector ── */}
      <AnimatePresence>
        {phase === "transport" && (sendCipherState || recvCipherState) && (
          <CipherStateInspector
            sendState={sendCipherState}
            recvState={recvCipherState}
            rotatedSide={rotatedSide}
            theme={theme}
          />
        )}
      </AnimatePresence>

      {/* ── Section 2: Encrypted Terminal ── */}
      <AnimatePresence>
        {(phase === "transport" || messages.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className={cn(
                "border-[1.5px] overflow-hidden",
                colors.terminalBorder,
                colors.terminalBg
              )}
            >
              {/* Terminal header */}
              <div className="px-4 py-2 flex items-center justify-between bg-black">
                <span className="text-sm font-bold tracking-[0.08em] uppercase text-white">
                  Encrypted Terminal
                </span>
                <span className={cn("text-xs uppercase tracking-wider", orchState === "transport_ready" ? "text-[#8cb369]" : "text-white/30")}>
                  {orchState === "transport_ready" ? "connected" : "disconnected"}
                </span>
              </div>

              {/* Message log */}
              <div
                ref={terminalContainerRef}
                className="p-3 sm:p-4 h-[200px] sm:h-[240px] overflow-y-auto text-xs sm:text-sm"
                style={{ fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace' }}
              >
                {messages.length === 0 && (
                  <div className="text-slate-600 italic">
                    Waiting for transport connection...
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "py-1.5 border-b last:border-b-0",
                      isDark ? "border-[#1a2540]/50" : "border-gray-700/30"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "shrink-0 font-bold w-4 text-center",
                          msg.direction === "sent"
                            ? "text-[#d4a574]"
                            : msg.direction === "received"
                              ? "text-[#c9985f]"
                              : "text-slate-500"
                        )}
                      >
                        {msg.direction === "sent"
                          ? "\u2191"
                          : msg.direction === "received"
                            ? "\u2193"
                            : "\u2022"}
                      </span>
                      <span
                        className={cn(
                          "flex-1 min-w-0",
                          msg.direction === "system"
                            ? msg.plaintext.startsWith("[KEY ROTATION]")
                              ? "text-[#FFD700] font-bold"
                              : msg.plaintext.startsWith("[BURST]")
                                ? "text-[#b8860b] italic"
                                : "text-[#c97a5a] italic"
                            : "text-green-300"
                        )}
                      >
                        {msg.plaintext}
                      </span>
                      <span className="shrink-0 text-xs text-slate-700">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              {/* Input area */}
              <div className={cn("border-t border-[#333] px-3 sm:px-4 py-3")}>
                {/* Quick commands */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2.5">
                  <span className="text-sm text-white/90 uppercase tracking-wider shrink-0 font-semibold">BOLT msgs:</span>
                  {QUICK_COMMANDS.map(({ cmd, label, desc }) => (
                    <button
                      key={cmd}
                      onClick={() => sendMessage(cmd)}
                      disabled={orchState !== "transport_ready"}
                      title={desc}
                      className={cn(
                        "px-2.5 sm:px-3 py-1 text-xs sm:text-sm border-[1.5px] transition-colors",
                        orchState === "transport_ready"
                          ? "border-white/40 text-white hover:border-white/60 hover:text-white"
                          : "border-white/10 text-white/25 cursor-not-allowed"
                      )}
                      style={{ borderRadius: 999 }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Burst send control */}
                <div className="mb-2.5">
                  <BurstSendControl
                    currentSendNonce={sendCipherState?.nonce ?? 0}
                    isReady={orchState === "transport_ready" && !burstRunning}
                    isBurstRunning={burstRunning}
                    burstProgress={burstProgress}
                    onBurst={handleBurst}
                    theme="dark"
                  />
                </div>

                {/* Input field */}
                <form onSubmit={handleTerminalSubmit} className="flex gap-2 items-center">
                  <span className="text-sm text-green-500 shrink-0">
                    {"\u276F"}
                  </span>
                  <input
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    disabled={orchState !== "transport_ready"}
                    placeholder={
                      orchState === "transport_ready"
                        ? "Type a message..."
                        : "Complete handshake first"
                    }
                    className={cn(
                      "flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600",
                      orchState === "transport_ready"
                        ? "text-green-300"
                        : "text-slate-600 cursor-not-allowed"
                    )}
                  />
                  <button
                    type="submit"
                    disabled={orchState !== "transport_ready" || !terminalInput.trim()}
                    className={cn(
                      "px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border-[1.5px] transition-colors",
                      orchState === "transport_ready" && terminalInput.trim()
                        ? "border-white/40 text-white hover:bg-white/10"
                        : "border-white/10 text-white/25 cursor-not-allowed"
                    )}
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
