import { Link, Route, Switch, useLocation } from "wouter";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { useAuth } from "../hooks/use-auth";
import { useProgress } from "../hooks/use-progress";
import LoginModal from "../components/LoginModal";
import { QRCodeSVG } from "qrcode.react";
import CheckpointQuestion from "../components/CheckpointQuestion";
import CheckpointGroup from "../components/CheckpointGroup";
import CodeExercise from "../components/CodeExercise";
import Scratchpad from "../components/Scratchpad";
import { CollapsibleItem, CollapsibleGroup } from "../components/CollapsibleSection";
import { CODE_EXERCISES } from "../data/code-exercises";
import { getNoiseExerciseGroupContext } from "../lib/noise-exercise-groups";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import FeedbackWidget from "../components/FeedbackWidget";
import ProfileDropdown from "../components/ProfileDropdown";
import HandshakeDiagram from "../components/HandshakeDiagram";
import CapstonePanel from "../components/CapstonePanel";
import ServerProbe from "../components/ServerProbe";
import NonceReuseLab from "../components/NonceReuseLab";
import { PanelStateContext, usePanelStateProvider } from "../hooks/use-panel-state";
import { useIsMobile } from "../hooks/use-mobile";

// Whitelist of custom course tag names that should never be wrapped in <p>.
// CommonMark wraps custom HTML element names (which are not in the block-level
// whitelist) in <p> tags. The custom tag handlers below render React components
// that contain <div> and <form> descendants, which would produce invalid
// <p><div>...</div></p> nesting and React validateDOMNesting warnings.
// Keep this list in sync with the components map below in ReactMarkdown.
const CUSTOM_BLOCK_TAGS = new Set([
  "server-probe",
  "capstone-panel",
  "nonce-reuse-lab",
  "code-intro",
  "code-outro",
  "checkpoint",
  "checkpoint-group",
  "handshake-diagram",
  "byte-inspector",
]);

function rehypeUnwrapCustomBlockTags() {
  return (tree: any) => {
    const visit = (node: any) => {
      if (!node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        // Recurse first so deeper paragraphs are unwrapped before we look at this level.
        visit(child);
        if (
          child.type === "element" &&
          child.tagName === "p" &&
          child.children?.length === 1 &&
          child.children[0].type === "element" &&
          CUSTOM_BLOCK_TAGS.has(child.children[0].tagName)
        ) {
          node.children[i] = child.children[0];
        }
      }
    };
    visit(tree);
  };
}

// --- Checkpoint questions embedded inline in tutorial chapters ---
export const CHECKPOINT_QUESTIONS: Record<string, {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}> = {
  "pubkey-compression": {
    question: "A compressed secp256k1 public key starts with 02. What does this tell you?",
    options: [
      "The public key was generated using the second variant of the secp256k1 generator point",
      "The y-coordinate of the public key point is even",
      "The public key is 2 of 2 in a multisignature scheme",
      "The x-coordinate is in the lower half of the finite field",
    ],
    answer: 1,
    explanation: "In compressed public key format, the first byte is a parity byte that indicates whether the y-coordinate is even (02) or odd (03). Since the secp256k1 curve is symmetrical around the x-axis, there are exactly two possible y-values for each x-coordinate: one even, one odd. By encoding just the parity byte and the x-coordinate, the full point can be reconstructed, saving roughly 50% of space compared to the uncompressed format.",
  },
  "hash-preimage": {
    question: "An attacker has the SHA256 hash of Alice's public key. Which of the following is true?",
    options: [
      "The attacker can efficiently reverse SHA256 to recover Alice's public key, since SHA256 is a deterministic function",
      "The attacker can easily find a different public key that produces the same hash and use it to impersonate Alice",
      "The attacker can verify whether a given public key matches the hash, but cannot feasibly work backwards from the hash to discover the key",
      "The attacker can determine the length of Alice's public key from the hash output, since SHA256 preserves input length information",
    ],
    answer: 2,
    explanation: "SHA256 is a one-way function (preimage resistant), meaning it is computationally infeasible to recover the input from the output. It is also collision resistant, so finding a different input that produces the same hash is not practically achievable. However, since SHA256 is deterministic, anyone who has (or guesses) the original public key can hash it and check whether the result matches. SHA256 always produces a fixed 256-bit output regardless of input length, so no length information is leaked.",
  },
  "ecdh-security": {
    question: "During ECDH, Alice and Bob exchange public keys over an insecure channel. Why can't an eavesdropper who captures both public keys compute the shared secret?",
    options: [
      "The public keys are encrypted with a pre-shared symmetric key before being sent over the channel",
      "The eavesdropper would need to solve the Elliptic Curve Discrete Logarithm Problem to recover a private key from a public key, which is computationally infeasible",
      "The shared secret includes a random salt that is never transmitted, making it impossible to reproduce without the salt",
      "The public keys are only valid for a short time window, so the eavesdropper cannot use them after they expire",
    ],
    answer: 1,
    explanation: "The security of ECDH relies on the Elliptic Curve Discrete Logarithm Problem (ECDLP). While it's easy to compute a public key from a private key (multiply the private key by the generator point G), reversing this (finding the private key from the public key) is computationally infeasible. An eavesdropper who captures both A = a × G and B = b × G would need to extract either 'a' or 'b' to compute the shared secret a × b × G, but doing so requires solving the ECDLP.",
  },
  "hkdf-purpose": {
    question: "In Lightning's Noise Protocol, HKDF is used to expand one ECDH shared secret into two 32-byte keys. Why not simply use the shared secret directly as a single encryption key?",
    options: [
      "The protocol needs multiple independent keys for different cryptographic operations, and reusing the same key for multiple purposes can create subtle security vulnerabilities",
      "HKDF adds entropy from the system's random number generator, making the derived keys more secure than the original shared secret",
      "The ECDH shared secret is only 16 bytes, which is too short for ChaCha20-Poly1305, so HKDF expands it to the required length",
      "Using the shared secret directly would allow an attacker to brute-force it, since ECDH outputs are not resistant to offline attacks without HKDF",
    ],
    answer: 0,
    explanation: "The Noise Protocol needs multiple independent keys from each ECDH shared secret for different cryptographic operations, such as encryption and authentication. Using the same key for multiple purposes can create subtle vulnerabilities. HKDF's two-phase design (extract then expand) takes a single input and produces multiple cryptographically independent keys, ensuring that compromising one derived key doesn't compromise the others. As a bonus, HKDF's extract phase also ensures the derived keys are uniformly random, removing any structural bias that may be present in the raw ECDH output.",
  },
  "nonce-reuse": {
    question: "If Alice encrypts two different messages using ChaCha20 (not AEAD) with the same key and nonce, what can an attacker who intercepts both ciphertexts do?",
    options: [
      "Derive the original ChaCha20 key by brute-forcing the nonce space, since the same nonce was used twice",
      "Decrypt both messages directly, because reusing a nonce causes ChaCha20 to output the plaintext in the clear",
      "XOR the two ciphertexts together to cancel the keystream and reveal the relationship between both plaintexts, which can then be exploited to recover the original messages",
      "Determine which of the two messages is longer, but learn nothing about their actual contents",
    ],
    answer: 2,
    explanation: "ChaCha20 generates a pseudorandom keystream from the key and nonce, then XORs it with the plaintext. If the same key and nonce are reused, the identical keystream is produced. An attacker who XORs the two ciphertexts together cancels the keystream out, leaving the XOR of the two plaintexts. With known or guessable structure in either message (like protocol headers), the attacker can progressively recover both messages. Even worse, once a plaintext is known, XORing it with its ciphertext reveals the keystream itself, compromising all future messages encrypted with the same key and nonce.",
  },
  "setup-wrong-key": {
    question: "During the handshake setup, Alice mixes the responder's (Bob's) static public key into the handshake hash. What would happen if Alice accidentally used the wrong public key?",
    options: [
      "The handshake would succeed, but Alice and Bob would derive different encryption keys, causing all messages after the handshake to be unreadable",
      "Alice's handshake hash would diverge from Bob's immediately, so the MAC she creates in Act 1 would fail verification and Bob would abort the connection",
      "The ECDH operation in Act 1 would produce an error because secp256k1 rejects invalid public keys",
      "The handshake would complete normally, but Alice and Bob would have different handshake hashes, which they would only discover when the first encrypted message fails to decrypt",
    ],
    answer: 1,
    explanation: "In the handshake setup, both Alice and Bob independently mix Bob's static public key into their handshake hash. If Alice uses the wrong key, her hash diverges from Bob's from the very start. When she computes the `es` ECDH shared secret using the wrong key in Act 1, she derives a different `temp_k1` than Bob would. The MAC she creates with this wrong key and her divergent handshake hash (used as associated data) will fail verification on Bob's side, and he will immediately terminate the connection. This is exactly why the setup phase exists: it catches identity mismatches before any real data is exchanged.",
  },
  "act2-both-ephemeral": {
    question: "In Act 2, Bob generates his own ephemeral key pair and performs an `ee` ECDH with Alice's ephemeral key. Why can't they just reuse the `es` shared secret from Act 1 for the rest of the connection?",
    options: [
      "The `es` shared secret from Act 1 is only 16 bytes, which is too short for ChaCha20-Poly1305's 32-byte key requirement",
      "Reusing `es` would cause nonce collisions because both Act 1 and Act 2 start their nonces at 0",
      "The Noise Protocol specification explicitly forbids reusing shared secrets across acts, though it would be cryptographically safe to do so",
      "The `es` secret depends on Bob's static private key, so if that key were ever compromised, an attacker could derive `es` from Act 1's plaintext ephemeral key and decrypt all past sessions. The `ee` ECDH fixes this by adding entropy that is destroyed after the handshake",
    ],
    answer: 3,
    explanation: "The `es` shared secret from Act 1 is computed from Alice's ephemeral key and Bob's static key. Since Bob's static key is long-lived, if it were ever compromised in the future, an attacker who recorded the Act 1 message (which contains Alice's ephemeral public key in plaintext) could recompute `es` and decrypt the session. The `ee` ECDH in Act 2 introduces a shared secret that depends on both parties' ephemeral private keys, keys that are generated fresh for this session and destroyed afterward. Without at least one of these ephemeral private keys, an attacker cannot compute `ee`, even if they obtain both static keys later. This is what provides forward secrecy.",
  },
  "act3-nonce-one": {
    question: "In Act 3, Alice encrypts her static public key using `temp_k2` with nonce = 1. Why doesn't she use nonce = 0?",
    options: [
      "Nonce 0 is reserved for the HKDF extract phase. ChaCha20 uses counter 0 to derive the Poly1305 authentication keys, so nonce 0 refers to this internal counter, not an external nonce",
      "The Noise Protocol always starts nonces at 1 to distinguish handshake messages from transport messages, which start at 0",
      "Bob already used `temp_k2` with nonce = 0 in Act 2 to create his authentication MAC, so reusing the same key and nonce would produce identical Poly1305 authentication keys, breaking both confidentiality and authentication",
      "Alice's nonce counter was already incremented to 1 during the HKDF derivation of `temp_k2`, since HKDF internally calls ChaCha20 with nonce 0",
    ],
    answer: 2,
    explanation: "In Act 2, Bob used `temp_k2` with nonce = 0 to encrypt a zero-length plaintext and produce his authentication MAC. Now in Act 3, Alice needs to use the same `temp_k2` to encrypt her static public key. If she also used nonce = 0, ChaCha20 would generate the same internal state, producing identical Poly1305 authentication keys (r, s). With two message-tag pairs under the same Poly1305 key, an attacker can forge valid MACs for arbitrary messages, completely breaking authentication. The identical keystream would also be used to encrypt Alice's static key, potentially exposing it. By using nonce = 1, Alice ensures completely different Poly1305 keys and a fresh keystream, keeping her encrypted static public key secure.",
  },
  "message-length-limit": {
    question: "What happens if a Lightning node needs to send a message that is 70,000 bytes long?",
    options: [
      "It cannot. BOLT 8 specifies that Lightning messages must not exceed 65,535 bytes, since the length prefix is a 2-byte integer and the protocol was designed this way intentionally to simplify testing and prevent memory-exhaustion attacks",
      "The message is automatically split into two frames: one of 65,535 bytes and one of 4,465 bytes, each with its own encrypted length prefix and MAC",
      "The sending node uses a 4-byte extended length prefix instead of the standard 2-byte prefix, signaled by setting the first bit of the length field to 1",
      "The message is compressed using zlib before encryption to bring it under the 65,535-byte limit, as required by BOLT 1's message compression extension",
    ],
    answer: 0,
    explanation: "This is a design constraint, not a limitation to work around. BOLT 8 explicitly states: 'The maximum size of any Lightning message MUST NOT exceed 65535 bytes.' The 2-byte length prefix can represent values from 0 to 65,535 (the maximum for an unsigned 16-bit integer), and the protocol was intentionally designed with this ceiling. The motivation is practical: a hard maximum simplifies testing, makes memory management predictable, and prevents a malicious peer from exhausting a node's memory by advertising enormous messages. No splitting, compression, or extended headers exist in the protocol.",
  },
};

type Chapter = {
  id: string;
  title: string;
  section: "Introduction" | "Foundations" | "The Handshake" | "Encrypted Messaging" | "Capstone" | "Quiz" | "Pay It Forward";
  kind: "intro" | "md";
  file?: string;
};

export const chapters: Chapter[] = [
  {
    id: "intro",
    title: "Lightning's Noise Protocol: A Deep Dive",
    section: "Introduction",
    kind: "intro",
  },
  {
    id: "crypto-primitives",
    title: "Cryptographic Primitives",
    section: "Foundations",
    kind: "md",
    file: "/noise_tutorial/1.4-crypto-review.md",
  },
  {
    id: "noise-framework",
    title: "The Noise Framework",
    section: "Foundations",
    kind: "md",
    file: "/noise_tutorial/1.5-noise-overview.md",
  },
  {
    id: "handshake-setup",
    title: "Handshake Setup",
    section: "The Handshake",
    kind: "md",
    file: "/noise_tutorial/1.6-noise-setup.md",
  },
  {
    id: "act-1",
    title: "Act 1: Proving Knowledge of Identity",
    section: "The Handshake",
    kind: "md",
    file: "/noise_tutorial/1.7-noise-act-1.md",
  },
  {
    id: "act-2",
    title: "Act 2: Ephemeral Key Exchange",
    section: "The Handshake",
    kind: "md",
    file: "/noise_tutorial/1.8-noise-act-2.md",
  },
  {
    id: "act-3",
    title: "Act 3: Identity Reveal",
    section: "The Handshake",
    kind: "md",
    file: "/noise_tutorial/1.9-noise-act-3.md",
  },
  {
    id: "sending-messages",
    title: "Sending Encrypted Messages",
    section: "Encrypted Messaging",
    kind: "md",
    file: "/noise_tutorial/1.10-sending-messages.md",
  },
  {
    id: "receiving-messages",
    title: "Receiving & Decrypting Messages",
    section: "Encrypted Messaging",
    kind: "md",
    file: "/noise_tutorial/1.11-receiving-messages.md",
  },
  {
    id: "key-rotation",
    title: "Key Rotation",
    section: "Encrypted Messaging",
    kind: "md",
    file: "/noise_tutorial/1.12-rotating-keys.md",
  },
  {
    id: "live-connection",
    title: "Live Connection Lab",
    section: "Capstone",
    kind: "md",
    file: "/noise_tutorial/1.15-live-connection.md",
  },
  {
    id: "quiz",
    title: "Test Your Knowledge",
    section: "Quiz",
    kind: "md",
    file: "/noise_tutorial/1.13-quiz.md",
  },
  {
    id: "pay-it-forward",
    title: "Donate Sats",
    section: "Pay It Forward",
    kind: "md",
  },
];

export const sectionOrder: Chapter["section"][] = [
  "Introduction",
  "Foundations",
  "The Handshake",
  "Encrypted Messaging",
  "Capstone",
  "Quiz",
  "Pay It Forward",
];

export const CHAPTER_REQUIREMENTS: Record<string, {
  checkpoints: string[];
  exercises: string[];
}> = {
  "intro": { checkpoints: [], exercises: [] },
  "crypto-primitives": { checkpoints: ["pubkey-compression", "hash-preimage", "ecdh-security", "hkdf-purpose", "nonce-reuse"], exercises: ["exercise-generate-keypair", "exercise-ecdh", "exercise-hkdf"] },
  "noise-framework": { checkpoints: [], exercises: [] },
  "handshake-setup": { checkpoints: ["setup-wrong-key"], exercises: ["exercise-init-state"] },
  "act-1": { checkpoints: [], exercises: ["exercise-act1-initiator", "exercise-act1-responder"] },
  "act-2": { checkpoints: ["act2-both-ephemeral"], exercises: ["exercise-act2-responder", "exercise-act2-initiator"] },
  "act-3": { checkpoints: ["act3-nonce-one"], exercises: ["exercise-act3-initiator", "exercise-act3-responder"] },
  "sending-messages": { checkpoints: ["message-length-limit"], exercises: ["exercise-encrypt"] },
  "receiving-messages": { checkpoints: [], exercises: ["exercise-decrypt"] },
  "key-rotation": { checkpoints: [], exercises: ["exercise-key-rotation"] },
  "live-connection": { checkpoints: [], exercises: [] },
  "quiz": { checkpoints: [], exercises: [] },
  "pay-it-forward": { checkpoints: [], exercises: [] },
};

function useChapterCompletion(
  completedCheckpoints: { checkpointId: string }[],
  getProgress: (key: string) => string | null,
  tutorialMode: "read" | "code",
  rewardClaimed: boolean,
): Record<string, "complete" | "incomplete"> {
  return useMemo(() => {
    const result: Record<string, "complete" | "incomplete"> = {};
    const completedIds = new Set(completedCheckpoints.map(c => c.checkpointId));

    for (const chapter of chapters) {
      const reqs = CHAPTER_REQUIREMENTS[chapter.id];
      if (!reqs) { result[chapter.id] = "incomplete"; continue; }

      const checkpoints = reqs.checkpoints;
      const exercises = tutorialMode === "code" ? reqs.exercises : [];
      const isReadOnly = checkpoints.length === 0 && exercises.length === 0;

      if (chapter.id === "quiz") {
        result[chapter.id] = rewardClaimed ? "complete" : "incomplete";
      } else if (chapter.id === "pay-it-forward") {
        result[chapter.id] = "incomplete";
      } else if (isReadOnly) {
        result[chapter.id] = getProgress(`noise-chapter-read:${chapter.id}`) === "1"
          ? "complete" : "incomplete";
      } else {
        const allCheckpointsDone = checkpoints.every(id => completedIds.has(id));
        const allExercisesDone = exercises.every(id => completedIds.has(id));
        result[chapter.id] = (allCheckpointsDone && allExercisesDone)
          ? "complete" : "incomplete";
      }
    }
    return result;
  }, [completedCheckpoints, getProgress, tutorialMode, rewardClaimed]);
}

function idxOf(id: string) {
  return Math.max(0, chapters.findIndex((c) => c.id === id));
}

function introMarkdown() {
  return `# Lightning's Noise Protocol: A Deep Dive

The Lightning Network helps bring the Bitcoin whitepaper's original vision to life: peer-to-peer electronic cash.

To do this successfully, the Lightning Network must adopt the same features that make peer-to-peer cash so great. Cash transactions are private (nobody has to know who you pay), authenticated (you know who you're paying because they're right there in front of you), and *kinda* tamper-proof (you can verify a bill is real and hasn't been altered... probably).

To bring these same properties (encrypted communication, authentication, and integrity checking) to the Lightning Network, the creators of the Lightning protocol chose the **Noise Protocol Framework**: a lean, secure channel protocol for encrypted peer-to-peer communication. Lightning is in good company here. WhatsApp leverages the Noise Framework as part of its end-to-end encryption for over 2 billion users, and WireGuard, one of the most widely adopted modern VPN protocols, uses Noise to secure its tunnels.

In this tutorial, we'll dig deep into Lightning's implementation of Noise, starting with the cryptographic building blocks, then working through the three-act handshake, and finishing with encrypted message transport and key rotation.

Let's get started.

> ### ⚡ Earn sats as you learn! ⚡
>
> This tutorial rewards you with real bitcoin for successfully completing checkpoint quizzes throughout the course. You can redeem your earnings using any wallet that supports LNURL withdrawal, or link a Lightning Address to your account for automatic payouts. Sign in first, then click the [profile icon](#open-profile) in the top-right corner to set it up!`;
}

function NoiseTutorialShell({ activeId }: { activeId: string }) {
  const [location, setLocation] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const auth = useAuth();
  const { authenticated, loading: authLoading, logout, loginWithToken, setLightningAddress } = auth;
  const progress = useProgress(auth.sessionToken);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Tutorial mode: "read" (checkpoints only) or "code" (coding exercises)
  // URL param takes priority (set from blog page), then falls back to localStorage
  const [tutorialMode] = useState<"read" | "code">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      if (mode === "code") {
        localStorage.setItem("pl-noise-tutorial-mode", "code");
        return "code";
      }
      if (mode === "read") {
        localStorage.removeItem("pl-noise-tutorial-mode");
        return "read";
      }
      const stored = localStorage.getItem("pl-noise-tutorial-mode");
      if (stored === "code") return "code";
    }
    return "read";
  });

  const chapterCompletion = useChapterCompletion(
    auth.completedCheckpoints,
    progress.getProgress,
    tutorialMode,
    auth.rewardClaimed,
  );

  const activeIndex = idxOf(activeId);
  const active = chapters[activeIndex] ?? chapters[0];
  const prev = chapters[activeIndex - 1];
  const next = chapters[activeIndex + 1];

  // Save current chapter for "Continue Where You Left Off" on home page
  useEffect(() => {
    try { localStorage.setItem("pl-noise-last-chapter", activeId); } catch {}
  }, [activeId]);

  const grouped = useMemo(() => {
    const bySection = new Map<Chapter["section"], Chapter[]>();
    for (const s of sectionOrder) bySection.set(s, []);
    for (const c of chapters) bySection.get(c.section)?.push(c);
    return bySection;
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location, setMobileNavOpen]);

  // Disable browser scroll anchoring so DOM changes don't cause scroll jumps.
  useLayoutEffect(() => {
    document.documentElement.style.overflowAnchor = "none";
    return () => { document.documentElement.style.overflowAnchor = ""; };
  }, []);

  // Wrap markCheckpointCompleted to preserve scroll position.
  const stableMarkCompleted = useCallback((id: string, amountSats?: number) => {
    const scrollY = window.scrollY;
    auth.markCheckpointCompleted(id, amountSats);
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  }, [auth.markCheckpointCompleted]);

  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("pl-theme") : null;
    if (stored === "dark" || stored === "light") setTheme(stored);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pl-theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const t = theme === "dark"
    ? {
        pageBg: "bg-[#0b1220]",
        pageText: "text-slate-100",
        headerBg: "bg-[#0b1220]",
        headerBorder: "border-[#1f2a44]",
        sidebarBg: "bg-[#0b1220]",
        sidebarBorder: "border-[#1f2a44]",
        sectionText: "text-slate-300",
        dividerBg: "bg-[#1f2a44]",
        chapterInactive: "bg-[#0f1930] border-[#2a3552] text-slate-100 hover:bg-[#132043]",
        chapterActive: "bg-[#132043] border-[hsl(48_100%_50%)] text-[hsl(48_100%_50%)]",
        navPrev: "bg-[#0f1930] border-[#2a3552] hover:bg-[#132043]",
        navNext: "bg-[hsl(48_100%_50%)] text-[#0b1220] border-[#0b1220] hover:brightness-110",
        crumbText: "text-slate-200",
      }
    : {
        pageBg: "bg-background",
        pageText: "text-foreground",
        headerBg: "bg-card",
        headerBorder: "border-border",
        sidebarBg: "bg-card",
        sidebarBorder: "border-border",
        sectionText: "text-foreground/70",
        dividerBg: "bg-border",
        chapterInactive: "bg-card border-border text-foreground hover:bg-secondary",
        chapterActive: "bg-secondary border-border text-foreground",
        navPrev: "bg-card border-border hover:bg-secondary",
        navNext: "bg-primary text-foreground border-border hover:bg-primary/90",
        crumbText: "text-foreground",
      };

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const storedCollapsed = typeof window !== "undefined" ? localStorage.getItem("pl-sidebar-collapsed") : null;
    if (storedCollapsed === "1") setSidebarCollapsed(true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("pl-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  // Panel state for scratchpad side panel
  const panelState = usePanelStateProvider();
  const panelPadding = isMobile ? 0 : (panelState.activePanel ? panelState.panelWidth : 0);
  const panelTransition = panelState.isDragging ? "none" : "padding-right 300ms cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <PanelStateContext.Provider value={panelState}>
    <div
      className={`min-h-screen ${t.pageBg} ${t.pageText}`}
      data-theme={theme}
      style={{ paddingRight: panelPadding, transition: panelTransition }}
    >
      <div className={`w-full border-b-4 ${t.headerBorder} ${t.headerBg} px-2 py-2 md:px-4 md:py-3 flex items-center justify-between fixed top-0 left-0 z-50`}>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            className={`md:hidden font-pixel text-xs border-2 ${theme === "dark" ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#132043]" : "border-border bg-card hover:bg-secondary"} px-2 py-2 transition-colors`}
            onClick={() => setMobileNavOpen((v) => !v)}
            data-testid="button-sidebar-toggle"
          >
            MENU
          </button>
          <Link
            href="/"
            className="hidden md:inline font-pixel text-xs md:text-sm hover:text-primary transition-colors"
            data-testid="link-back-home"
          >
            &lt; BACK TO HOME
          </Link>
          <Link
            href="/"
            className={`md:hidden p-1 transition-colors ${theme === "dark" ? "text-slate-300 hover:text-slate-100" : "text-foreground/70 hover:text-foreground"}`}
            data-testid="link-back-home-mobile"
            aria-label="Back to Home"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className={`font-pixel text-xs md:text-sm ${theme === "dark" ? "text-slate-300" : "text-foreground/70"}`} data-testid="text-tutorial-breadcrumb">
            Noise Tutorial
          </div>
          <div className={`h-4 w-[2px] ${theme === "dark" ? "bg-[#2a3552]" : "bg-border"}`} />
          <div className={`font-mono text-lg md:text-xl ${t.crumbText}`} data-testid="text-chapter-title">
            {active.title}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-feedback"))}
            className={`md:hidden p-2 transition-colors ${theme === "dark" ? "text-slate-300 hover:text-slate-100" : "text-foreground/70 hover:text-foreground"}`}
            aria-label="Send feedback"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
            className={`p-2 transition-colors ${theme === "dark" ? "text-slate-300 hover:text-slate-100" : "text-foreground/70 hover:text-foreground"}`}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          {authenticated ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileDropdown((v) => !v)}
                data-profile-toggle
                className={`p-2 transition-colors ${
                  theme === "dark"
                    ? "text-slate-300 hover:text-slate-100"
                    : "text-foreground/70 hover:text-foreground"
                }`}
                title={auth.email || auth.pubkey ? `Logged in as ${auth.email || (auth.pubkey?.slice(0, 8) + "...")}` : "Logged in"}
                data-testid="button-profile"
                aria-label="Toggle profile menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              {showProfileDropdown && (
                <ProfileDropdown
                  theme={theme}
                  email={auth.email}
                  pubkey={auth.pubkey}
                  lightningAddress={auth.lightningAddress}
                  sessionToken={auth.sessionToken}
                  emailVerified={auth.emailVerified}
                  onSetLightningAddress={setLightningAddress}
                  onLogout={logout}
                  onClose={() => setShowProfileDropdown(false)}
                />
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className={`p-1 md:p-2 font-pixel text-[10px] md:text-sm transition-colors ${
                theme === "dark"
                  ? "text-slate-200 hover:text-white"
                  : "text-foreground hover:text-foreground/80"
              }`}
              data-testid="button-login"
            >
              LOGIN
            </button>
          )}
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-7xl grid gap-0 pt-[68px]"
        style={{
          gridTemplateColumns: isMobile ? '1fr' : (sidebarCollapsed ? `60px minmax(0, 1fr)` : `360px minmax(0, 1fr)`),
        }}
      >
        {mobileNavOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileNavOpen(false)}
          />
        )}
        <aside
          className={`${
            mobileNavOpen ? "fixed inset-y-0 left-0 w-[300px] z-50 overflow-y-auto shadow-xl" : "hidden"
          } md:relative md:block md:sticky md:top-[68px] md:w-auto md:z-auto md:shadow-none md:max-h-[calc(100vh-68px)] md:overflow-y-auto ${theme === "dark" ? "bg-[#0b1220]" : "bg-card"}`}
        >
          <div className="md:hidden flex items-center justify-between px-4 pt-4 pb-2">
            <div className={`font-pixel text-sm ${theme === "dark" ? "text-slate-200" : "text-foreground"}`}>
              Chapters
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className={`border-2 px-2 py-1 font-pixel text-xs transition-colors ${
                theme === "dark"
                  ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#132043]"
                  : "border-border bg-card hover:bg-secondary"
              }`}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>
          <div className="hidden md:flex items-center justify-between px-4 pt-4">
            <div
              className={`font-pixel text-sm ${theme === "dark" ? "text-slate-200" : "text-foreground"} ${
                sidebarCollapsed ? "sr-only" : ""
              }`}
              data-testid="text-sidebar-title"
            >
              Chapters
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className={`border-2 px-2 py-1 font-pixel text-xs transition-colors ${
                theme === "dark"
                  ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#132043]"
                  : "border-border bg-card hover:bg-secondary"
              } ${sidebarCollapsed ? "mx-auto" : ""}`}
              data-testid="button-sidebar-collapse"
              aria-label={sidebarCollapsed ? "Expand chapters panel" : "Collapse chapters panel"}
            >
              {sidebarCollapsed ? ">" : "<"}
            </button>
          </div>

          <div className={`p-4 ${sidebarCollapsed ? "hidden" : ""}`}
            aria-hidden={sidebarCollapsed}
          >

            {sectionOrder.map((section) => {
              if (section === "Capstone" && tutorialMode !== "code") return null;
              const items = grouped.get(section) ?? [];
              if (!items.length) return null;
              const trackableItems = items.filter(c => c.id !== "pay-it-forward");
              const completedInSection = trackableItems.filter(c => chapterCompletion[c.id] === "complete").length;
              const totalInSection = trackableItems.length;
              const isSectionCollapsed = collapsedSections.has(section);
              return (
                <div key={section} className="mb-4">
                  <button
                    type="button"
                    onClick={() => setCollapsedSections((prev) => {
                      const next = new Set(prev);
                      if (next.has(section)) next.delete(section);
                      else next.add(section);
                      return next;
                    })}
                    className={`flex items-center justify-between w-full font-pixel text-[14px] tracking-wide mb-2 cursor-pointer ${theme === "dark" ? "text-slate-300 hover:text-slate-100" : "text-foreground/70 hover:text-foreground"}`}
                    data-testid={`text-section-${section.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <span className="flex items-center gap-2">
                      {section.toUpperCase()}
                      {totalInSection > 0 && (
                        <span className={`text-[11px] font-pixel ${completedInSection === totalInSection ? (theme === "dark" ? "text-[#FFD700]" : "text-[#b8860b]") : "opacity-50"}`}>
                          {completedInSection}/{totalInSection}
                        </span>
                      )}
                    </span>
                    <span className={`text-[10px] transition-transform ${isSectionCollapsed ? "-rotate-90" : ""}`}>&#9660;</span>
                  </button>
                  <div className={`h-[2px] ${theme === "dark" ? "bg-[#1f2a44]" : "bg-border"} mb-2`} />

                  {!isSectionCollapsed && (
                  <nav className="grid gap-1">
                    {items.map((c) => {
                      const href = c.id === "intro" ? "/noise-tutorial" : `/noise-tutorial/${c.id}`;
                      const isActive = c.id === activeId;
                      const isComplete = chapterCompletion[c.id] === "complete";
                      const showIcon = c.id !== "pay-it-forward";
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setLocation(href)}
                          className={`${
                            isActive ? t.chapterActive : t.chapterInactive
                          } w-full text-left border-2 px-3 py-1.5 transition-colors`}
                          data-testid={`button-chapter-${c.id}`}
                        >
                          <div className="flex items-center gap-2">
                            {showIcon && (
                              <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-lg font-extrabold leading-none ${
                                isComplete
                                  ? theme === "dark"
                                    ? "bg-[#FFD700] text-white"
                                    : "bg-[#b8860b] text-white"
                                  : theme === "dark" ? "border-2 border-[#2a3552]" : "border-2 border-border"
                              }`}>
                                {isComplete && "\u2713"}
                              </span>
                            )}
                            <div className="flex-1 min-w-0 text-[16px] leading-snug" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>{c.title}</div>
                            {(() => {
                              const reqs = CHAPTER_REQUIREMENTS[c.id];
                              if (!reqs) return null;
                              const showExercises = tutorialMode === "code" && reqs.exercises.length > 0;
                              const showQuizzes = reqs.checkpoints.length > 0;
                              if (!showExercises && !showQuizzes) return null;
                              const completedIds = new Set(auth.completedCheckpoints.map(cp => cp.checkpointId));
                              const dim = theme === "dark" ? "text-slate-600" : "text-foreground/25";
                              const lit = theme === "dark" ? "text-[#FFD700]" : "text-[#b8860b]";
                              const tooltipClass = `font-pixel text-sm px-3 py-1.5 border-2 rounded-none ${
                                theme === "dark"
                                  ? "bg-[#0f1930] text-slate-200 border-[#2a3552]"
                                  : "bg-card text-foreground border-border pixel-shadow"
                              }`;
                              return (
                                <span className="flex items-center gap-1.5 shrink-0 ml-1">
                                  {showQuizzes && reqs.checkpoints.map((cpId) => (
                                    <Tooltip key={cpId} delayDuration={200}>
                                      <TooltipTrigger asChild>
                                        <span className={`font-pixel text-[13px] leading-none cursor-default ${completedIds.has(cpId) ? lit : dim}`}>?</span>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className={tooltipClass}>
                                        {completedIds.has(cpId) ? "Quiz complete" : "Quiz"}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                  {showExercises && reqs.exercises.map((exId) => (
                                    <Tooltip key={exId} delayDuration={200}>
                                      <TooltipTrigger asChild>
                                        <span className={`font-mono text-[13px] leading-none font-bold cursor-default ${completedIds.has(exId) ? lit : dim}`}>&lt;/&gt;</span>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className={tooltipClass}>
                                        {completedIds.has(exId) ? "Exercise complete" : "Coding exercise"}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </span>
                              );
                            })()}
                          </div>
                        </button>
                      );
                    })}
                  </nav>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <main className="p-3 sm:p-5 md:p-10">
          <div className="mx-auto w-full max-w-[1200px]">
          <article
            className="noise-article mx-auto w-full max-w-[1100px]"
            data-testid="container-article"
          >
            {active.section === "Pay It Forward" ? (
              <PayItForward theme={theme} />
            ) : active.section === "Quiz" ? (
              <InteractiveQuiz
                theme={theme}
                authenticated={authenticated}
                rewardClaimed={auth.rewardClaimed}
                sessionToken={auth.sessionToken}
                emailVerified={auth.emailVerified}
                pubkey={auth.pubkey}
                lightningAddress={auth.lightningAddress}
                onLoginRequest={() => setShowLoginModal(true)}
                getProgress={progress.getProgress}
                saveProgress={progress.saveProgress}
              />
            ) : (
              <ChapterContent
                chapter={active}
                theme={theme}
                tutorialMode={tutorialMode}
                authenticated={authenticated}
                sessionToken={auth.sessionToken}
                completedCheckpoints={auth.completedCheckpoints}
                lightningAddress={auth.lightningAddress}
                emailVerified={auth.emailVerified}
                pubkey={auth.pubkey}
                onLoginRequest={() => setShowLoginModal(true)}
                onCheckpointCompleted={stableMarkCompleted}
                onOpenProfile={() => setShowProfileDropdown(true)}
                getProgress={progress.getProgress}
                saveProgress={progress.saveProgress}
              />
            )}

            <div className={`mt-10 pt-6 border-t ${theme === "dark" ? "border-[#1f2a44]" : "border-border"} flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3`}>
              {prev ? (
                <Link
                  href={prev.id === "intro" ? "/noise-tutorial" : `/noise-tutorial/${prev.id}`}
                  className={`inline-flex items-center gap-2 border-2 px-3 py-2 md:px-4 transition-colors w-full md:w-auto ${t.navPrev}`}
                  data-testid="link-prev"
                >
                  <span className={`font-pixel text-sm md:text-base shrink-0 ${theme === "dark" ? "text-slate-300" : "text-foreground/70"}`}>PREV</span>
                  <span className="font-mono text-base md:text-lg truncate hidden sm:inline">{prev.title}</span>
                </Link>
              ) : (
                <div />
              )}

              {next ? (
                <Link
                  href={next.id === "intro" ? "/noise-tutorial" : `/noise-tutorial/${next.id}`}
                  className={`inline-flex items-center gap-2 border-2 px-3 py-2 md:px-4 transition-all w-full md:w-auto ${t.navNext}`}
                  data-testid="link-next"
                >
                  <span className="font-pixel text-sm md:text-base shrink-0">NEXT</span>
                  <span className="font-mono text-base md:text-lg truncate hidden sm:inline">{next.title}</span>
                </Link>
              ) : (
                <div />
              )}
            </div>
          </article>
          </div>
        </main>
      </div>

      {tutorialMode === "code" && (
        <>
          {/* Scratchpad button */}
          <div
            className={`fixed top-[78px] z-40 hidden lg:block border-2 rounded ${
              theme === "dark"
                ? "bg-[#0b1220] border-[#2a3552]"
                : "bg-[#fdf9f2] border-[#d4c9a8]"
            }`}
            style={{ right: panelPadding + 16, transition: panelTransition, padding: "8px 10px" }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => panelState.switchPanel("scratchpad")}
                  className={`flex items-center gap-2 font-pixel text-[14px] tracking-wide cursor-pointer ${
                    theme === "dark"
                      ? "text-slate-300 hover:text-slate-100"
                      : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  <span>SCRATCHPAD</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                className={`max-w-[220px] text-sm leading-snug ${
                  theme === "dark"
                    ? "bg-[#1a2332] border-[#FFD700]/30 text-slate-200"
                    : "bg-white border-[#b8860b]/30 text-foreground/80"
                }`}
                style={{ boxShadow: theme === "dark" ? "3px 3px 0 rgba(255,215,0,0.15)" : "3px 3px 0 rgba(0,0,0,0.08)" }}
              >
                Open the Python scratchpad to experiment with code and test inputs from exercises
              </TooltipContent>
            </Tooltip>
          </div>

          <Scratchpad theme={theme} />
        </>
      )}

      <FeedbackWidget
        theme={theme}
        chapterTitle={active.title}
        sessionToken={auth.sessionToken}
      />

      {showLoginModal && (
        <LoginModal
          theme={theme}
          onSuccess={(token, data) => {
            loginWithToken(token, data);
            setShowLoginModal(false);
          }}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
    </PanelStateContext.Provider>
  );
}

function ImageBlock({
  stableKey,
  rawSrc,
  style,
  height,
  props,
  theme,
  srcKey,
}: {
  stableKey: string;
  rawSrc: string;
  style: React.CSSProperties | undefined;
  height: any;
  props: any;
  theme: "light" | "dark";
  srcKey: string;
}) {
  const storageKey = `pl-img-zoom:${srcKey}`;

  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<number>(0.75);
  const [hasManualZoom, setHasManualZoom] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHasManualZoom(false);
    setImgNatural(null);
  }, [open, rawSrc]);

  const zoomBodyRef = useRef<HTMLSpanElement | null>(null);
  const zoomImgRef = useRef<HTMLImageElement | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);


  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const bodyEl = zoomBodyRef.current;
    const imgEl = zoomImgRef.current;
    if (!bodyEl || !imgEl) return;

    // If user touched the slider, don't keep overriding their choice.
    if (hasManualZoom) return;

    let raf = 0;

    const computeFit = () => {
      // Use the real scroll viewport dimensions.
      const availableW = Math.max(1, bodyEl.clientWidth);
      const availableH = Math.max(1, bodyEl.clientHeight);

      const naturalW = imgEl.naturalWidth || 1;
      const naturalH = imgEl.naturalHeight || 1;

      // Fit INSIDE, leaving some breathing room.
      const pad = 16;
      const fit = Math.min((availableW - pad) / naturalW, (availableH - pad) / naturalH);
      const clamped = Math.min(2.5, Math.max(0.1, fit));

      setZoom(Number(clamped.toFixed(2)));
      bodyEl.scrollTop = 0;
      bodyEl.scrollLeft = 0;
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Wait until the overlay is actually laid out.
        if (bodyEl.clientWidth < 10 || bodyEl.clientHeight < 10) {
          raf = requestAnimationFrame(computeFit);
          return;
        }
        computeFit();
      });
    };

    if (imgEl.complete && imgEl.naturalWidth > 0) schedule();
    else imgEl.addEventListener("load", schedule, { once: true });

    const onResize = () => schedule();
    window.addEventListener("resize", onResize);

    // Also refit once after mount; fonts/layout can shift the first frame.
    const t = window.setTimeout(schedule, 50);

    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [open, rawSrc, hasManualZoom]);

  return (
    <span className="block my-5" data-testid={`img-block-${srcKey}`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative block w-full border-2 transition-colors ${
          theme === "dark"
            ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#132043]"
            : "border-border bg-card hover:bg-secondary"
        }`}
        data-testid={`button-img-zoom-${srcKey}`}
        aria-label="Open diagram zoom"
      >
        <img
          {...props}
          src={rawSrc}
          width={undefined}
          height={height}
          style={{
            ...(style ?? {}),
            width: "100%",
            height: "auto",
            display: "block",
            margin: "0 auto",
            imageRendering: "auto",
          }}
          data-testid={`img-tutorial-${srcKey}`}
        />

        <span
          className={`pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 ${
            theme === "dark" ? "bg-black/35" : "bg-black/20"
          }`}
          data-testid={`overlay-img-hover-${srcKey}`}
        >
          <span
            className={`flex items-center gap-2 border-2 px-3 py-2 ${
              theme === "dark"
                ? "border-[#2a3552] bg-[#0b1220]"
                : "border-border bg-background"
            }`}
            data-testid={`badge-img-zoom-${srcKey}`}
          >
            <span className="text-[14px] leading-none" aria-hidden="true">⌕</span>
            <span className="font-pixel text-xs">CLICK TO ZOOM</span>
          </span>
        </span>
      </button>

      <span
        className={`mt-2 flex items-center justify-center gap-2 ${
          theme === "dark" ? "text-slate-300" : "text-foreground/70"
        } opacity-80`}
        data-testid={`text-img-zoomhint-${srcKey}`}
      >
        <span className="font-pixel text-[10px] tracking-wide">HOVER + CLICK TO ZOOM</span>
        <span className="font-mono text-xs">(Esc to close)</span>
      </span>

      {open ? (
        <span
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Diagram zoom"
          data-testid={`overlay-img-${srcKey}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <span className="absolute inset-0 bg-black/70" />

          <span
            className={`relative w-full max-w-6xl border-4 ${
              theme === "dark" ? "border-[#2a3552] bg-[#0b1220]" : "border-border bg-background"
            }`}
          >
            <span
              className={`flex items-center justify-between gap-3 border-b-4 px-4 py-3 ${
                theme === "dark" ? "border-[#2a3552]" : "border-border"
              }`}
            >
              <div className="font-pixel text-xs" data-testid={`text-zoom-title-${srcKey}`}>
                DIAGRAM ZOOM
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`border-2 px-3 py-2 font-pixel text-xs transition-colors ${
                  theme === "dark"
                    ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#132043]"
                    : "border-border bg-card hover:bg-secondary"
                }`}
                data-testid={`button-zoom-close-${srcKey}`}
              >
                CLOSE
              </button>
            </span>

            <span className="block p-4">
              <div className="flex items-center justify-center gap-3 mb-3">
                <span className={`font-pixel text-[10px] tracking-wide ${theme === "dark" ? "text-slate-300" : "text-foreground/70"}`}>
                  ZOOM
                </span>
                <input
                  type="range"
                  min={0.1}
                  max={2.5}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => {
                    setHasManualZoom(true);
                    setZoom(Number((e.target as HTMLInputElement).value));
                  }}
                  className="w-56 accent-[hsl(48_100%_50%)]"
                  data-testid={`slider-zoom-${srcKey}`}
                />
                <span className={`font-mono text-xs ${theme === "dark" ? "text-slate-200" : "text-foreground"}`} data-testid={`text-zoom-value-${srcKey}`}>
                  {zoom.toFixed(2)}x
                </span>
              </div>

              <span
                ref={zoomBodyRef}
                className={`block max-h-[70vh] overflow-auto border-2 ${
                  theme === "dark" ? "border-[#2a3552] bg-[#0f1930]" : "border-border bg-card"
                }`}
                data-testid={`container-zoom-body-${srcKey}`}
              >
                <span style={{
                  display: "block",
                  width: imgNatural ? `${imgNatural.w * zoom}px` : "auto",
                  height: imgNatural ? `${imgNatural.h * zoom}px` : "auto",
                }}>
                  <img
                    ref={zoomImgRef}
                    {...props}
                    src={rawSrc}
                    width={undefined}
                    height={height}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && img.naturalHeight) {
                        setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
                      }
                    }}
                    style={{
                      ...(style ?? {}),
                      display: "block",
                      maxWidth: "none",
                      width: imgNatural ? `${imgNatural.w * zoom}px` : "auto",
                      height: imgNatural ? `${imgNatural.h * zoom}px` : "auto",
                      imageRendering: "auto",
                    }}
                    data-testid={`img-zoomed-${srcKey}`}
                  />
                </span>
              </span>

              <span className={`mt-3 block text-center font-mono text-xs ${theme === "dark" ? "text-slate-300" : "text-foreground/70"}`}>
                Tip: scroll inside the frame to pan.
              </span>
            </span>
          </span>
        </span>
      ) : null}
    </span>
  );
}

interface DonationEntry {
  id: string;
  amountSats: number;
  donorName: string;
  message: string | null;
  createdAt: string;
}

function DonationWall({ theme }: { theme: "light" | "dark" }) {
  const dark = theme === "dark";
  const [donations, setDonations] = useState<DonationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const textColor = dark ? "text-slate-100" : "text-black";
  const textMuted = dark ? "text-slate-300" : "text-black/70";
  const sansFont = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  const fetchDonations = useCallback(async () => {
    try {
      const res = await fetch("/api/donate/wall");
      if (res.ok) {
        const data = await res.json();
        setDonations(data.donations || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchDonations(); }, [fetchDonations]);

  if (loading) return null;
  if (donations.length === 0) return null;

  const totalSats = donations.reduce((sum, d) => sum + d.amountSats, 0);

  return (
    <div className="mt-10">
      <div className={`font-pixel text-sm ${goldText} mb-4 tracking-wider`}>DONOR WALL</div>
      <div className={`border-2 ${goldBorder} ${cardBg} p-4 md:p-6 mb-4`}>
        <div className="flex justify-between items-center mb-4">
          <div className={`text-sm ${textMuted}`} style={{ fontFamily: sansFont }}>
            {donations.length} donation{donations.length !== 1 ? "s" : ""}
          </div>
          <div className={`font-pixel text-sm ${goldText}`}>
            {totalSats.toLocaleString()} SATS TOTAL
          </div>
        </div>
        <div className="space-y-3">
          {donations.map((d) => (
            <div key={d.id} className={`border ${cardBorder} ${dark ? "bg-[#0b1220]" : "bg-gray-50"} p-3`}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-pixel text-xs ${goldText}`}>{d.donorName}</span>
                    <span className={`font-pixel text-xs ${dark ? "text-green-400" : "text-green-700"}`}>
                      {d.amountSats.toLocaleString()} sats
                    </span>
                  </div>
                  {d.message && (
                    <div className={`text-sm ${textColor} leading-relaxed`} style={{ fontFamily: sansFont }}>
                      {d.message}
                    </div>
                  )}
                </div>
                <div className={`text-xs ${textMuted} whitespace-nowrap`} style={{ fontFamily: sansFont }}>
                  {new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PayItForward({ theme }: { theme: "light" | "dark" }) {
  const dark = theme === "dark";
  const [amount, setAmount] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [invoice, setInvoice] = useState<string | null>(null);
  const [paymentIndex, setPaymentIndex] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "waiting" | "paid" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [donorName, setDonorName] = useState("");
  const [donorMessage, setDonorMessage] = useState("");
  const [moderationError, setModerationError] = useState("");
  const [donationSaved, setDonationSaved] = useState(false);
  const [wallKey, setWallKey] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presetAmounts = [
    { label: "21", value: 21, desc: "A classic" },
    { label: "100", value: 100, desc: "Round number" },
    { label: "1,000", value: 1000, desc: "Generous" },
    { label: "2,100", value: 2100, desc: "21 × 100" },
    { label: "10k", value: 10000, desc: "Big impact" },
    { label: "21k", value: 21000, desc: "Legendary" },
  ];

  const goldText = dark ? "text-[#FFD700]" : "text-[#9a7200]";
  const goldBorder = dark ? "border-[#FFD700]" : "border-[#b8860b]";
  const cardBg = dark ? "bg-[#0f1930]" : "bg-card";
  const cardBorder = dark ? "border-[#2a3552]" : "border-border";
  const textColor = dark ? "text-slate-100" : "text-black";
  const textMuted = dark ? "text-slate-300" : "text-black/70";
  const greenText = dark ? "text-green-400" : "text-green-700";
  const sansFont = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (expiryRef.current) clearTimeout(expiryRef.current);
    };
  }, []);

  const saveDonation = useCallback(async (pIdx: string, sats: number) => {
    try {
      const res = await fetch("/api/donate/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_index: pIdx,
          amount_sats: sats,
          donor_name: donorName.trim() || "Anon",
          message: donorMessage.trim() || null,
        }),
      });
      if (res.ok) {
        setDonationSaved(true);
        setWallKey(k => k + 1);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("[saveDonation] Server error:", res.status, errData);
      }
    } catch (err) {
      console.error("[saveDonation] Network error:", err);
    }
  }, [donorName, donorMessage]);

  const createInvoice = useCallback(async (sats: number) => {
    // Run moderation check before creating invoice
    if (donorName.trim() || donorMessage.trim()) {
      try {
        const modRes = await fetch("/api/donate/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: donorName.trim(), message: donorMessage.trim() }),
        });
        if (modRes.ok) {
          const modData = await modRes.json();
          if (!modData.clean) {
            setModerationError("Your " + modData.issues.join(" and ") + " contains language that isn't allowed. Please revise and try again.");
            return;
          }
        }
      } catch {}
    }
    setModerationError("");

    setStatus("creating");
    setErrorMsg("");
    setInvoice(null);
    setPaymentIndex(null);
    setDonationSaved(false);

    try {
      const res = await fetch("/api/donate/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_sats: sats }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || "Failed to create invoice");
      }

      const data = await res.json();
      setInvoice(data.invoice);
      setPaymentIndex(data.payment_index);
      setStatus("waiting");

      const expiry = data.expires_at || (Date.now() + 600_000);
      setExpiresAt(expiry);
      if (expiryRef.current) clearTimeout(expiryRef.current);
      const timeUntilExpiry = Math.max(0, expiry - Date.now());
      expiryRef.current = setTimeout(() => {
        setStatus("error");
        setErrorMsg("Invoice expired. Please try again.");
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      }, timeUntilExpiry);

      if (pollingRef.current) clearInterval(pollingRef.current);
      const capturedPaymentIndex = data.payment_index;
      const capturedSats = sats;
      pollingRef.current = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/donate/check-payment?index=${encodeURIComponent(capturedPaymentIndex)}`);
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.status === "paid") {
              setStatus("paid");
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              if (expiryRef.current) {
                clearTimeout(expiryRef.current);
                expiryRef.current = null;
              }
              // Auto-save donation to the wall
              saveDonation(capturedPaymentIndex, capturedSats);
            }
          }
        } catch {}
      }, 2000);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong");
    }
  }, [donorName, donorMessage, saveDonation]);

  const handlePresetClick = useCallback((value: number) => {
    setAmount(String(value));
    setCustomAmount("");
    setShowCustom(false);
    setErrorMsg("");
  }, []);

  const handleCustomConfirm = useCallback(() => {
    const sats = parseInt(customAmount, 10);
    if (!sats || sats < 1 || sats > 1000000) {
      setErrorMsg("Enter a number between 1 and 1,000,000");
      return;
    }
    setAmount(String(sats));
    setErrorMsg("");
  }, [customAmount]);

  const handleDonate = useCallback(() => {
    const sats = parseInt(amount, 10);
    if (!sats || sats < 1) {
      setErrorMsg("Please select an amount first");
      return;
    }
    createInvoice(sats);
  }, [amount, createInvoice]);

  const resetDonation = useCallback(() => {
    setStatus("idle");
    setInvoice(null);
    setPaymentIndex(null);
    setAmount("");
    setCustomAmount("");
    setShowCustom(false);
    setErrorMsg("");
    setModerationError("");
    setExpiresAt(null);
    setDonationSaved(false);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
  }, []);

  return (
    <div className="py-4" data-testid="container-pay-it-forward">
      <h1 className={`font-pixel text-2xl md:text-3xl mb-2 ${dark ? "text-slate-100" : "text-black"}`}>
        PAY IT FORWARD
      </h1>
      <div className={`h-[3px] ${dark ? "bg-[#FFD700]" : "bg-[#b8860b]"} mb-6`} />

      <div className="mb-8">
        <div className={`font-pixel text-xs ${goldText} mb-4 tracking-wider`}>SUPPORT THE MISSION</div>

        <div className={`text-[17px] md:text-[19px] leading-relaxed ${textColor} mb-4`} style={{ fontFamily: sansFont }}>
          The goal of this tutorial (and more to come!) is to create an immersive learning experience where you don't just <em>read</em> about Lightning, you <em>use</em> it! Every checkpoint reward, every quiz payout, every sat earned in this course is a real Lightning transaction. By donating, you directly fund that experience for the next wave of students. More tutorials are coming, and your contribution helps make them just as hands-on.
        </div>

        <div className={`text-[17px] md:text-[19px] leading-relaxed ${textColor}`} style={{ fontFamily: sansFont }}>
          Every sat counts. Thanks for paying it forward!
        </div>
      </div>

      {status === "idle" && (
        <div className={`border-2 ${goldBorder} ${cardBg} p-5 md:p-8`}>
          {/* Amount selection */}
          <div className={`font-pixel text-sm ${goldText} mb-4 tracking-wider`}>CHOOSE AN AMOUNT (SATS)</div>

          <div className="grid grid-cols-3 gap-2 md:gap-3 mb-5">
            {presetAmounts.map((p) => {
              const isSelected = amount === String(p.value) && !customAmount;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => handlePresetClick(p.value)}
                  className={`border-2 p-2 md:p-4 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    isSelected
                      ? `${goldBorder} ${dark ? "bg-[#FFD700]/15" : "bg-[#FFD700]/20"} ring-2 ring-[#FFD700]/50`
                      : `${goldBorder} ${dark ? "bg-[#0b1220]" : "bg-white"}`
                  }`}
                  style={{ cursor: "pointer" }}
                  data-testid={`button-donate-${p.value}`}
                >
                  <div className={`font-pixel text-sm md:text-2xl ${goldText} text-center`}>{p.label}</div>
                  <div className={`text-xs md:text-lg ${textMuted} mt-1 text-center`} style={{ fontFamily: sansFont }}>{p.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowCustom(v => !v)}
              className={`w-full border-2 ${cardBorder} ${dark ? "bg-[#0b1220]" : "bg-white"} px-4 py-3 flex items-center justify-between transition-colors ${dark ? "hover:bg-[#111d38]" : "hover:bg-gray-50"}`}
              style={{ cursor: "pointer" }}
            >
              <span className={`font-pixel text-xs ${textMuted} tracking-wider`}>CUSTOM AMOUNT</span>
              <span className={`font-pixel text-xs ${textMuted} transition-transform ${showCustom ? "rotate-180" : ""}`}>▼</span>
            </button>
            {showCustom && (
              <div className={`border-2 border-t-0 ${cardBorder} ${dark ? "bg-[#0b1220]" : "bg-white"} p-4`}>
                <div className="flex gap-3">
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    placeholder="Enter sats..."
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setErrorMsg("");
                      // Auto-set amount as they type
                      const v = parseInt(e.target.value, 10);
                      if (v && v >= 1 && v <= 1000000) setAmount(String(v));
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCustomConfirm(); }}
                    className={`flex-1 border-2 ${goldBorder} ${dark ? "bg-[#0b1220] text-slate-100" : "bg-white text-black"} px-4 py-3 text-xl md:text-2xl outline-none focus:ring-2 focus:ring-[#FFD700]/50`}
                    style={{ fontFamily: sansFont }}
                    data-testid="input-custom-donate"
                  />
                </div>
                {errorMsg && status === "idle" && (
                  <div className="text-red-500 font-mono text-sm mt-2">{errorMsg}</div>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className={`h-px ${dark ? "bg-[#2a3552]" : "bg-border"} mb-6`} />

          {/* Name & Message — optional */}
          <div className={`font-pixel text-xs ${goldText} mb-3 tracking-wider`}>NAME & MESSAGE <span className={textMuted}>(OPTIONAL)</span></div>
          <div className={`text-[16px] md:text-[18px] leading-relaxed ${textMuted} mb-4`} style={{ fontFamily: sansFont }}>
            Want to leave your name and a message? They'll appear on the donor wall below. Leave the name blank and it'll just say "Anon".
          </div>
          <div className="space-y-3 mb-5">
            <div>
              <label className={`font-pixel text-xs ${textMuted} block mb-1`}>NAME</label>
              <input
                type="text"
                maxLength={50}
                placeholder="Anon"
                value={donorName}
                onChange={(e) => { setDonorName(e.target.value); setModerationError(""); }}
                className={`w-full border-2 ${cardBorder} ${dark ? "bg-[#0b1220] text-slate-100" : "bg-white text-black"} px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-[#FFD700]/50`}
                style={{ fontFamily: sansFont }}
              />
            </div>
            <div>
              <label className={`font-pixel text-xs ${textMuted} block mb-1`}>MESSAGE</label>
              <textarea
                maxLength={280}
                rows={2}
                placeholder="Say something nice..."
                value={donorMessage}
                onChange={(e) => { setDonorMessage(e.target.value); setModerationError(""); }}
                className={`w-full border-2 ${cardBorder} ${dark ? "bg-[#0b1220] text-slate-100" : "bg-white text-black"} px-4 py-2.5 text-base outline-none focus:ring-2 focus:ring-[#FFD700]/50 resize-none`}
                style={{ fontFamily: sansFont }}
              />
              <div className={`text-xs ${textMuted} mt-1 text-right`} style={{ fontFamily: sansFont }}>
                {donorMessage.length}/280
              </div>
            </div>
          </div>
          <div className={`text-[15px] md:text-[17px] ${textMuted} italic leading-relaxed`} style={{ fontFamily: sansFont }}>
            While bitcoin is censorship-resistant, this website is not. Any offensive or abusive comments will be removed!
          </div>
          {moderationError && (
            <div className="text-red-500 text-sm mt-3" style={{ fontFamily: sansFont }}>{moderationError}</div>
          )}
          {errorMsg && status === "idle" && (
            <div className="text-red-500 font-mono text-sm mt-3">{errorMsg}</div>
          )}

          {/* Donate button */}
          <button
            type="button"
            onClick={handleDonate}
            className={`w-full mt-6 border-2 ${goldBorder} bg-[#FFD700] text-black font-pixel text-lg md:text-xl py-4 transition-all hover:brightness-110 active:scale-[0.98] ${
              amount ? "" : "opacity-50"
            }`}
            style={{ cursor: "pointer" }}
            data-testid="button-donate-submit"
          >
            {amount ? `DONATE ${Number(amount).toLocaleString()} SATS` : "SELECT AN AMOUNT TO DONATE"}
          </button>
        </div>
      )}

      {status === "creating" && (
        <div className={`border-2 ${goldBorder} ${cardBg} p-8 text-center`}>
          <div className={`font-pixel text-sm ${goldText} mb-3 animate-pulse`}>CREATING INVOICE...</div>
          <div className={`text-sm ${textMuted}`} style={{ fontFamily: sansFont }}>
            Generating a Lightning invoice for {Number(amount).toLocaleString()} sats
          </div>
        </div>
      )}

      {status === "waiting" && invoice && (
        <div className={`border-2 ${goldBorder} ${cardBg} p-6 md:p-8`}>
          <div className={`font-pixel text-sm ${goldText} mb-1 tracking-wider text-center`}>SCAN TO DONATE</div>
          <div className={`font-pixel text-xs ${textMuted} mb-6 text-center`}>{Number(amount).toLocaleString()} SATS</div>

          <div className="flex justify-center mb-6">
            <div className={`border-4 ${goldBorder} p-3 ${dark ? "bg-white" : "bg-white"}`}>
              <QRCodeSVG
                value={`lightning:${invoice}`}
                size={240}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
              />
            </div>
          </div>

          <div className={`border-2 ${cardBorder} ${dark ? "bg-[#0b1220]" : "bg-gray-50"} p-3 mb-4`}>
            <div className={`font-pixel text-xs ${textMuted} mb-1`}>BOLT11 INVOICE</div>
            <div className="flex items-center gap-2">
              <div
                className={`font-mono text-xs ${textMuted} truncate flex-1 leading-relaxed`}
                data-testid="text-invoice"
              >
                {invoice.slice(0, 30)}...
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(invoice); }}
                className={`shrink-0 border-2 ${goldBorder} bg-[#FFD700] text-black font-pixel text-xs px-3 py-1.5 transition-all hover:brightness-110 active:scale-[0.98]`}
                data-testid="button-copy-invoice-inline"
              >
                COPY
              </button>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(invoice); }}
              className={`flex-1 border-2 ${goldBorder} bg-[#FFD700] text-black font-pixel text-sm px-4 py-3 transition-all hover:brightness-110 active:scale-[0.98]`}
              data-testid="button-copy-invoice"
            >
              COPY INVOICE
            </button>
            <button
              type="button"
              onClick={resetDonation}
              className={`border-2 ${cardBorder} ${cardBg} ${textColor} font-pixel text-sm px-4 py-3 transition-all hover:brightness-110`}
              data-testid="button-cancel-donate"
            >
              CANCEL
            </button>
          </div>

          <div className={`text-center font-pixel text-xs ${goldText} animate-pulse`}>
            WAITING FOR PAYMENT...
          </div>
        </div>
      )}

      {status === "paid" && (
        <div className={`border-2 ${goldBorder} ${cardBg} p-8 text-center`}>
          <div className={`font-pixel text-2xl ${greenText} mb-3`}>PAYMENT RECEIVED!</div>
          <div className={`font-pixel text-lg ${goldText} mb-4`}>{Number(amount).toLocaleString()} SATS</div>
          <div className={`text-[17px] ${textColor} mb-6`} style={{ fontFamily: sansFont }}>
            Thank you for supporting open-source Bitcoin education. Your donation will fund hands-on Lightning experiences for future students.
            {donationSaved && " Your name and message have been added to the donor wall below!"}
          </div>
          <button
            type="button"
            onClick={resetDonation}
            className={`border-2 ${goldBorder} bg-[#FFD700] text-black font-pixel text-sm px-6 py-3 transition-all hover:brightness-110 active:scale-[0.98]`}
            data-testid="button-donate-again"
          >
            DONATE AGAIN
          </button>
        </div>
      )}

      {(status === "idle" || status === "paid") && <DonationWall key={wallKey} theme={theme} />}

      {status === "error" && (
        <div className={`border-2 border-red-500/50 ${cardBg} p-6 text-center`}>
          <div className="font-pixel text-sm text-red-500 mb-3">ERROR</div>
          <div className={`text-sm ${textMuted} mb-4`} style={{ fontFamily: sansFont }}>{errorMsg}</div>
          <button
            type="button"
            onClick={resetDonation}
            className={`border-2 ${goldBorder} ${cardBg} ${textColor} font-pixel text-sm px-6 py-3 transition-all hover:brightness-110`}
            data-testid="button-retry-donate"
          >
            TRY AGAIN
          </button>
        </div>
      )}

    </div>
  );
}

const QUIZ_QUESTIONS = [
  {
    question: "Why does the Noise Protocol use ECDH rather than digital signatures for authentication?",
    options: [
      "The secp256k1 curve doesn't support signature operations, only key agreement",
      "Signatures would require a certificate authority, which contradicts Bitcoin's decentralized design",
      "ECDH is more resistant to quantum computing attacks than signatures",
      "ECDH is more computationally efficient, and the resulting shared secrets can be directly used to derive encryption keys, simplifying the protocol",
    ],
    answer: 3,
    explanation: "Digital signatures prove identity but produce a standalone proof that anyone can verify. They don't create shared secrets. ECDH, on the other hand, produces a shared secret known only to both parties, which can be immediately fed into HKDF to derive encryption keys. This means a single ECDH operation simultaneously authenticates both parties AND establishes keying material, whereas signatures would require a separate key exchange step on top. The Noise framework leverages this dual purpose throughout the handshake.",
  },
  {
    question: "In Act 1, Alice encrypts a zero-length plaintext with ChaCha20-Poly1305. Why doesn't she encrypt any actual data?",
    options: [
      "Alice's goal is only to prove she knows Bob's public key, so the MAC alone, created with a key derived from their ECDH shared secret, is sufficient to prove this",
      "The Act 1 message must be exactly 50 bytes, and there's no room for additional plaintext after the version byte and Ephemeral Public Key",
      "The plaintext is encrypted in a separate step that happens between Act 1 and Act 2",
      "ChaCha20-Poly1305 requires an empty plaintext for the initial use of any new key",
    ],
    answer: 0,
    explanation: "The purpose of Act 1 is not to transmit data. It's to prove that Alice knows Bob's static public key. She does this by performing an ECDH between her ephemeral key and Bob's static key, deriving a temporary key, and using it to produce a 16-byte Poly1305 MAC over an empty plaintext. If Alice didn't know Bob's real public key, the ECDH would produce the wrong shared secret, the derived key would be wrong, and the MAC wouldn't verify. The MAC itself is the proof; no plaintext is needed.",
  },
  {
    question: "At what point during the Noise handshake does Bob authenticate Alice's identity?",
    options: [
      "Act 1, when Alice proves she knows Bob's Static Public Key via the es ECDH shared secret",
      "Act 3, when Bob decrypts Alice's Static Public Key using temp_k2, since only Alice could have encrypted it correctly",
      "Act 3, only after Bob verifies the final MAC with temp_k3, which proves Alice knows the private key for the Static Public Key she sent",
      "After the handshake, when Alice successfully decrypts Bob's first encrypted message",
    ],
    answer: 2,
    explanation: "Bob first learns Alice's claimed identity in Act 3 when he decrypts her Static Public Key using temp_k2. However, decryption alone doesn't prove Alice is who she claims to be, since temp_k2 was derived from the es and ee ECDH operations, neither of which involved Alice's static private key. Authentication happens when Alice performs the se ECDH (using her static private key and Bob's ephemeral public key) and creates a MAC with temp_k3 derived from that result. Only someone who possesses Alice's static private key can compute the correct se shared secret and produce a valid MAC. When Bob verifies this MAC in Act 3 Step 7, that's the moment he knows Alice's identity is authentic.",
  },
  {
    question: "Why does Alice use her Ephemeral Public Key, rather than her Static Public Key, for the ECDH in Act 1?",
    options: [
      "The Noise Protocol requires all Act 1 ECDH operations to use ephemeral keys for both parties",
      "Her Static Public Key is too large to fit in the 50-byte Act 1 message",
      "Sending her Static Public Key in plaintext would reveal her Lightning node identity to eavesdroppers",
      "Her Static Public Key uses a different curve than Bob's Ephemeral Key, making ECDH impossible",
    ],
    answer: 2,
    explanation: "Alice's static public key is her Lightning node identity (the public key in her node's connection address). If she sent it in plaintext in Act 1, any passive eavesdropper monitoring the network could see exactly which node is initiating the connection. By using a freshly generated ephemeral key instead, Alice reveals nothing about her identity to observers. Her static key is only transmitted later in Act 3, encrypted under keys derived from the ee ECDH, which an eavesdropper cannot compute.",
  },
  {
    question: "Why is forward secrecy NOT established until Act 2?",
    options: [
      "Act 1 doesn't encrypt any data, so there's nothing that forward secrecy would protect",
      "The es ECDH in Act 1 involves Bob's Static Key, so if Bob's static private key were compromised, an attacker could recompute the shared secret using Alice's Ephemeral Public Key (which was sent in plaintext)",
      "Forward secrecy requires at least three ECDH operations, and only two are complete after Act 1",
      "Act 1 only uses hash functions, and the first ECDH doesn't happen until Act 2",
    ],
    answer: 1,
    explanation: "Forward secrecy means that compromising long-term (static) keys doesn't compromise past session keys. In Act 1, the es ECDH combines Alice's ephemeral key with Bob's static key. If an attacker later steals Bob's static private key, they can recompute this shared secret using Alice's ephemeral public key (which was sent unencrypted in Act 1). It's not until Act 2, when Bob introduces his own ephemeral key and the ee ECDH occurs, that the session keys depend on secrets that are destroyed after the handshake, achieving forward secrecy.",
  },
  {
    question: "What would happen if Alice reused the same nonce with the same key for two different ChaCha20 encryptions?",
    options: [
      "An attacker could XOR the two ciphertexts together to learn information about both plaintexts, potentially recovering them entirely",
      "The MACs would be identical, but the ciphertexts would remain secure",
      "The decryption would fail because ChaCha20 detects nonce reuse automatically",
      "Both messages would decrypt to the same plaintext regardless of the original content",
    ],
    answer: 0,
    explanation: "ChaCha20 is a stream cipher: it generates a pseudorandom keystream from the key and nonce, then XORs it with the plaintext. If the same key and nonce produce the same keystream twice, an attacker can XOR the two ciphertexts together. The keystreams cancel out, leaving the XOR of the two plaintexts. With known or guessable structure in either message, the attacker can progressively recover both. This is why Noise increments the nonce after every encryption and rotates keys after 1000 messages. Nonce reuse must never occur.",
  },
  {
    question: "What is the primary purpose of the handshake hash throughout the Noise handshake?",
    options: [
      "It is used as the encryption key for each act's ChaCha20-Poly1305 operation",
      "It serves as a checksum that Alice and Bob compare directly at the end of the handshake to verify success",
      "It stores a compressed version of all messages sent between Alice and Bob so they can be replayed if the connection drops",
      "It acts as a running transcript of the handshake, and is included as associated data in each MAC so that both parties can verify they are progressing through the protocol in sync",
    ],
    answer: 3,
    explanation: "The handshake hash (h) is a cumulative SHA-256 digest that absorbs every piece of data exchanged during the handshake: public keys, ECDH outputs, and ciphertexts. Each time a MAC is computed with ChaCha20-Poly1305, the current handshake hash is passed as the Associated Data (AD). This binds the MAC to the entire transcript up to that point. If an attacker tried to replay, reorder, or tamper with any handshake message, the hash would diverge between Alice and Bob, and the MAC verification would fail.",
  },
  {
    question: "During key rotation, what serves as the Input Key Material (IKM) for the HKDF function?",
    options: [
      "The current encryption key (sk or rk)",
      "A freshly computed ephemeral ECDH shared secret between Alice and Bob",
      "A zero-length input, similar to Act 3's final key derivation",
      "The original ECDH shared secret from the handshake phase",
    ],
    answer: 0,
    explanation: "Key rotation uses HKDF with the current encryption key (sk or rk) as the Input Key Material. HKDF(ck, current_key) produces two outputs: a new chaining key and a new encryption key that replaces the old one. The old key is immediately discarded. This is what provides forward secrecy for the message transport phase: even if an attacker compromises a current key, they cannot derive any previous keys because HKDF is a one-way function. Rotation happens every 1,000 messages (when the nonce counter hits 1000).",
  },
  {
    question: "Why does Lightning encrypt the 2-byte message length prefix before transmission?",
    options: [
      "The encrypted length doubles as a session identifier that Bob uses to match messages to the correct connection",
      "The length field contains a checksum that must be protected from tampering",
      "ChaCha20-Poly1305 requires all inputs, including metadata, to be encrypted before the algorithm can produce a valid MAC",
      "Without length encryption, an attacker could perform traffic analysis to learn message types and potentially track payments across the network",
    ],
    answer: 3,
    explanation: "Lightning messages are framed as [2-byte encrypted length][encrypted payload]. If the length were sent in plaintext, an eavesdropper could see the exact size of every message without decrypting anything. Since different Lightning message types (channel opens, payments, routing updates) have characteristic sizes, an attacker could infer what operations a node is performing and correlate payment flows across the network. Encrypting the length prefix ensures that even message boundaries are hidden from observers.",
  },
  {
    question: 'After the handshake, Alice computes sk, rk = HKDF(ck, "") and Bob computes rk, sk = HKDF(ck, ""). Why are the variable assignments reversed?',
    options: [
      "Bob reverses the assignment to account for the different nonce ordering between sender and receiver",
      "The reversal ensures that Alice's Sending Key is the same key as Bob's Receiving Key (and vice versa), so messages encrypted by one party can be decrypted by the other",
      "Alice and Bob use different Chaining Keys at this point, so the HKDF outputs are different and must be assigned accordingly",
      "The HKDF function produces outputs in a different order depending on which party calls it",
    ],
    answer: 1,
    explanation: "HKDF(ck, \"\") always produces the same two keys in the same order. Call them K1 and K2. Alice assigns K1 as her sending key (sk) and K2 as her receiving key (rk). Bob must do the opposite: K1 becomes his receiving key (rk) and K2 becomes his sending key (sk). This way, when Alice encrypts with her sk (K1), Bob decrypts with his rk (also K1). And when Bob encrypts with his sk (K2), Alice decrypts with her rk (also K2). Without this reversal, both sides would encrypt and decrypt with the same key assignments, and communication would fail.",
  },
];

function LightningBoltCelebration({ theme }: { theme: "light" | "dark" }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 animate-bounce-in" data-testid="container-celebration">
      <svg
        width="120"
        height="160"
        viewBox="0 0 120 160"
        className="mb-6 drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]"
        data-testid="img-lightning-bolt"
      >
        <polygon
          points="70,0 30,70 55,70 20,160 100,60 70,60"
          fill="#FFD700"
          stroke="#B8860B"
          strokeWidth="3"
          style={{ filter: "drop-shadow(0 0 15px rgba(255, 215, 0, 0.9))" }}
        />
        <polygon
          points="70,0 30,70 55,70 20,160 100,60 70,60"
          fill="url(#bolt-gradient)"
        />
        <defs>
          <linearGradient id="bolt-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF8DC" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#FFD700" stopOpacity="0" />
            <stop offset="100%" stopColor="#FF8C00" stopOpacity="0.3" />
          </linearGradient>
        </defs>
      </svg>
      <style>{`
        @keyframes bounce-in {
          0% { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          50% { transform: scale(1.1) rotate(3deg); opacity: 1; }
          70% { transform: scale(0.95) rotate(-1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .animate-bounce-in { animation: bounce-in 0.8s ease-out forwards; }
      `}</style>
    </div>
  );
}

function InteractiveQuiz({
  theme,
  authenticated,
  rewardClaimed,
  sessionToken,
  emailVerified,
  pubkey,
  lightningAddress,
  onLoginRequest,
  getProgress,
  saveProgress,
}: {
  theme: "light" | "dark";
  authenticated: boolean;
  rewardClaimed: boolean;
  sessionToken: string | null;
  emailVerified: boolean;
  pubkey: string | null;
  lightningAddress: string | null;
  onLoginRequest: () => void;
  getProgress: (key: string) => string | null;
  saveProgress: (key: string, value: string, immediate?: boolean) => void;
}) {
  const canClaimRewards = !!pubkey || emailVerified;
  const quizUserSuffix = sessionToken ? `-${sessionToken.slice(0, 8)}` : "";
  const quizStorageKey = `pl-quiz-selections${quizUserSuffix}`;
  const [selections, setSelections] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem(quizStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [hydratedFromServer, setHydratedFromServer] = useState(false);

  useEffect(() => {
    if (hydratedFromServer) return;
    const serverData = getProgress("quiz-selections");
    if (serverData) {
      try {
        const parsed = JSON.parse(serverData);
        if (Object.keys(parsed).length > 0) {
          setSelections(parsed);
          setHydratedFromServer(true);
        }
      } catch {}
    }
  }, [getProgress, hydratedFromServer]);

  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [claimingReward, setClaimingReward] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [rewardK1, setRewardK1] = useState<string | null>(null);
  const [rewardLnurl, setRewardLnurl] = useState<string | null>(null);
  const [rewardAmountSats, setRewardAmountSats] = useState(21);
  const [withdrawalStatus, setWithdrawalStatus] = useState<string>("pending");
  const [rewardCreatedAt, setRewardCreatedAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(300);
  const [autoPaid, setAutoPaid] = useState(false);

  const dark = theme === "dark";
  const border = dark ? "border-[#2a3552]" : "border-border";
  const bg = dark ? "bg-[#0f1930]" : "bg-card";
  const textColor = dark ? "text-slate-200" : "text-foreground";
  const textMuted = dark ? "text-slate-400" : "text-foreground/60";

  const handleSelect = (qIndex: number, optIndex: number) => {
    if (submitted) return;
    setSelections((prev) => {
      const next = { ...prev, [qIndex]: optIndex };
      const json = JSON.stringify(next);
      try { localStorage.setItem(quizStorageKey, json); } catch {}
      saveProgress("quiz-selections", json);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!authenticated) {
      onLoginRequest();
      return;
    }
    let correct = 0;
    QUIZ_QUESTIONS.forEach((q, i) => {
      if (selections[i] === q.answer) correct++;
    });
    setScore(correct);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Auto-claim if passed and user has a lightning address
    const pct = Math.round((correct / QUIZ_QUESTIONS.length) * 100);
    if (pct >= 90 && lightningAddress && canClaimRewards && !rewardClaimed) {
      setTimeout(() => handleClaimReward(), 500);
    }
  };

  const handleClaimReward = async () => {
    if (!sessionToken) return;
    setClaimingReward(true);
    setClaimError(null);
    try {
      const res = await fetch("/api/quiz/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ answers: selections, quizId: "noise" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error || "Failed to claim reward");
        setClaimingReward(false);
        return;
      }
      if (data.autoPaid) {
        setAutoPaid(true);
        setRewardAmountSats(data.amountSats);
        setWithdrawalStatus("paid");
        setShowReward(true);
      } else {
        setRewardK1(data.k1);
        setRewardLnurl(data.lnurl);
        setRewardAmountSats(data.amountSats);
        setRewardCreatedAt(Date.now());
        setWithdrawalStatus("pending");
        setShowReward(true);
      }
    } catch {
      setClaimError("Network error. Please try again.");
    }
    setClaimingReward(false);
  };

  useEffect(() => {
    if (!rewardK1 || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/lnurl/status/${rewardK1}`);
        const data = await res.json();
        setWithdrawalStatus(data.status);
        if (data.status === "paid" || data.status === "expired" || data.status === "failed") {
          clearInterval(interval);
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [rewardK1, withdrawalStatus]);

  useEffect(() => {
    if (!rewardCreatedAt || withdrawalStatus === "paid" || withdrawalStatus === "expired" || withdrawalStatus === "failed") return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - rewardCreatedAt) / 1000);
      const remaining = Math.max(0, 300 - elapsed);
      setCountdown(remaining);
      if (remaining <= 0) {
        setWithdrawalStatus("expired");
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [rewardCreatedAt, withdrawalStatus]);

  const handleNewQR = () => {
    setShowReward(false);
    setRewardK1(null);
    setRewardLnurl(null);
    setWithdrawalStatus("pending");
    setRewardCreatedAt(null);
    setCountdown(300);
    setClaimError(null);
  };

  const handleReset = () => {
    setSelections({});
    try { localStorage.removeItem(quizStorageKey); } catch {}
    setSubmitted(false);
    setScore(0);
    setShowReward(false);
    setRewardK1(null);
    setRewardLnurl(null);
    setWithdrawalStatus("pending");
    setRewardCreatedAt(null);
    setCountdown(300);
    setClaimError(null);
  };

  const percentage = Math.round((score / QUIZ_QUESTIONS.length) * 100);
  const passed = percentage >= 90;
  const allAnswered = Object.keys(selections).length === QUIZ_QUESTIONS.length;

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="py-4" data-testid="container-interactive-quiz">
      <h1 className={`font-pixel text-2xl md:text-3xl mb-2 ${dark ? "text-slate-100" : "text-foreground"}`} data-testid="text-quiz-title">
        Quiz: Lightning's Noise Protocol
      </h1>
      <p className={`text-xl md:text-2xl mb-4 ${textMuted}`}>
        {submitted
          ? `You scored ${score}/${QUIZ_QUESTIONS.length} (${percentage}%)`
          : `Select one answer per question, then submit. You need 90% to pass. Your answers are saved automatically.`}
      </p>

      {submitted && passed && <LightningBoltCelebration theme={theme} />}

      {submitted && (
        <div
          className={`border-4 p-6 mb-8 text-center ${
            passed
              ? "border-[#FFD700] bg-[#FFD700]/10"
              : dark
              ? "border-red-500/50 bg-red-500/10"
              : "border-red-400/50 bg-red-50"
          }`}
          data-testid="container-quiz-result"
        >
          <div
            className={`font-pixel text-2xl md:text-3xl mb-3 ${passed ? "text-[#FFD700]" : dark ? "text-red-400" : "text-red-600"}`}
            data-testid="text-quiz-result-title"
          >
            {passed ? "CONGRATULATIONS!" : "NOT QUITE..."}
          </div>
          <div className={`text-xl md:text-2xl ${textColor}`} data-testid="text-quiz-result-score">
            {passed
              ? `You passed with ${percentage}%! You've mastered Lightning's Noise Protocol.`
              : `You scored ${percentage}%. You need 90% to pass. Review the incorrect answers below and try again!`}
          </div>

          {passed && !showReward && !rewardClaimed && (
            <div>
              {authenticated && !canClaimRewards && (
                <div className={`mt-4 border-2 ${border} ${bg} p-4 mb-3`} data-testid="container-verify-warning">
                  <div className={`font-pixel text-sm ${dark ? "text-[#FFD700]" : "text-[#9a7200]"} mb-2`}>EMAIL NOT VERIFIED</div>
                  <p className={`text-base leading-relaxed ${textMuted} mb-3`} style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Throughout the educational material, there are checkpoints that offer real bitcoin rewards when completed successfully. To mitigate spam, users must either verify their email or log in with LNURL-Auth to claim these rewards. Check your inbox for the verification link.
                  </p>
                  <ResendVerificationButton sessionToken={sessionToken} theme={theme} />
                </div>
              )}
              <button
                type="button"
                onClick={handleClaimReward}
                disabled={claimingReward || (authenticated && !canClaimRewards)}
                className={`mt-4 font-pixel text-sm border-2 px-6 py-3 transition-all border-[#FFD700] bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 ${
                  claimingReward || (authenticated && !canClaimRewards) ? "opacity-60 cursor-wait" : ""
                }`}
                data-testid="button-claim-reward"
              >
                {claimingReward ? (lightningAddress ? "SENDING SATS..." : "GENERATING QR...") : "CLAIM BITCOIN REWARD"}
              </button>
              {claimError && (
                <div className="mt-2 text-sm text-red-400" data-testid="text-claim-error">
                  {claimError}
                </div>
              )}
            </div>
          )}

          {passed && rewardClaimed && !showReward && (
            <div className="mt-4 font-pixel text-sm" style={{ color: "#FFD700" }} data-testid="text-reward-already-claimed">
              REWARD ALREADY CLAIMED
            </div>
          )}

          {passed && showReward && (rewardLnurl || autoPaid) && (
            <div className="mt-6" data-testid="container-reward-qr">
              {autoPaid || withdrawalStatus === "paid" ? (
                <div>
                  <div className="font-pixel text-lg mb-2" style={{ color: "#FFD700" }}>
                    {rewardAmountSats} SATS SENT!
                  </div>
                  <div className={`text-lg ${textColor}`}>
                    {autoPaid ? `Sent to your lightning address. Enjoy your sats!` : `Payment complete. Enjoy your sats!`}
                  </div>
                </div>
              ) : withdrawalStatus === "expired" ? (
                <div>
                  <div className="font-pixel text-sm mb-2 text-red-400">QR EXPIRED</div>
                  <button
                    type="button"
                    onClick={handleNewQR}
                    className="font-pixel text-sm border-2 px-4 py-2 border-[#FFD700] bg-[#FFD700] text-black hover:bg-[#FFC800]"
                    data-testid="button-new-qr"
                  >
                    GENERATE NEW QR
                  </button>
                </div>
              ) : withdrawalStatus === "failed" ? (
                <div>
                  <div className="font-pixel text-sm mb-2 text-red-400">PAYMENT FAILED</div>
                  <button
                    type="button"
                    onClick={handleNewQR}
                    className="font-pixel text-sm border-2 px-4 py-2 border-[#FFD700] bg-[#FFD700] text-black hover:bg-[#FFC800]"
                    data-testid="button-try-again"
                  >
                    TRY AGAIN
                  </button>
                </div>
              ) : (
                <div>
                  <div className="font-pixel text-sm mb-3" style={{ color: "#FFD700" }}>
                    SCAN TO CLAIM {rewardAmountSats} SATS
                  </div>
                  <div className={`inline-block border-4 ${border} ${bg} p-4`}>
                    <QRCodeSVG
                      value={rewardLnurl}
                      size={220}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                      data-testid="img-reward-qr"
                    />
                  </div>
                  <div className={`mt-3 font-pixel text-xs ${textMuted}`}>
                    {withdrawalStatus === "claimed" ? "PROCESSING PAYMENT..." : "WAITING FOR SCAN..."}
                  </div>
                  <div className={`mt-1 font-mono text-sm ${countdown <= 60 ? "text-red-400" : textMuted}`}>
                    Expires in {formatCountdown(countdown)}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleReset}
            className={`mt-4 font-pixel text-sm border-2 px-6 py-3 transition-colors ${
              dark
                ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#132043] text-slate-200"
                : "border-border bg-card hover:bg-secondary text-foreground"
            }`}
            data-testid="button-quiz-retry"
          >
            {passed ? "TAKE AGAIN" : "TRY AGAIN"}
          </button>
        </div>
      )}

      <div className="space-y-6">
        {QUIZ_QUESTIONS.map((q, qIndex) => {
          const selected = selections[qIndex];
          const isCorrect = submitted && selected === q.answer;
          const isWrong = submitted && selected !== undefined && selected !== q.answer;

          return (
            <div
              key={qIndex}
              className={`border-2 p-4 md:p-5 ${bg} ${
                submitted
                  ? isCorrect
                    ? "border-green-500/60"
                    : isWrong
                    ? "border-red-500/60"
                    : border
                  : border
              }`}
              data-testid={`container-quiz-question-${qIndex}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className={`font-pixel text-xs ${textMuted}`}>
                  Q{qIndex + 1}/{QUIZ_QUESTIONS.length}
                </div>
                {submitted && (
                  <div className={`font-pixel text-xs ${
                    isCorrect ? "text-green-400" : isWrong ? "text-red-400" : dark ? "text-slate-500" : "text-foreground/40"
                  }`}>
                    {isCorrect ? "CORRECT" : isWrong ? "WRONG" : "SKIPPED"}
                  </div>
                )}
              </div>
              <div className={`text-[19px] md:text-[22px] font-semibold mb-4 leading-snug ${textColor}`} style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }} data-testid={`text-quiz-question-${qIndex}`}>
                {q.question}
              </div>

              <div className="space-y-2">
                {q.options.map((opt, optIndex) => {
                  const isSelected = selected === optIndex;
                  const isAnswer = q.answer === optIndex;
                  const letter = String.fromCharCode(65 + optIndex);

                  let optionStyle = "";
                  if (submitted) {
                    if (passed && isAnswer) {
                      // Only reveal the correct answer when they passed
                      optionStyle = "border-green-500 bg-green-500/15 text-green-300";
                      if (!dark) optionStyle = "border-green-600 bg-green-50 text-green-800";
                    } else if (!passed && isSelected && isAnswer) {
                      // They selected it and it's correct - show green
                      optionStyle = "border-green-500 bg-green-500/15 text-green-300";
                      if (!dark) optionStyle = "border-green-600 bg-green-50 text-green-800";
                    } else if (isSelected && !isAnswer) {
                      // They selected it and it's wrong - show red
                      optionStyle = "border-red-500 bg-red-500/15 text-red-300";
                      if (!dark) optionStyle = "border-red-500 bg-red-50 text-red-800";
                    } else {
                      optionStyle = dark
                        ? "border-[#1f2a44] text-slate-500 opacity-60"
                        : "border-border/50 text-foreground/40 opacity-60";
                    }
                  } else if (isSelected) {
                    optionStyle = "border-[#FFD700] bg-[#FFD700]/15";
                    if (!dark) optionStyle = "border-[#FFD700] bg-[#FFD700]/10";
                  } else {
                    optionStyle = dark
                      ? "border-[#1f2a44] hover:border-[#2a3552] hover:bg-[#132043] cursor-pointer"
                      : "border-border hover:border-foreground/30 hover:bg-secondary cursor-pointer";
                  }

                  return (
                    <button
                      key={optIndex}
                      type="button"
                      onClick={() => handleSelect(qIndex, optIndex)}
                      disabled={submitted}
                      className={`w-full text-left border px-3 py-2.5 flex items-start gap-2.5 transition-colors ${optionStyle} ${
                        submitted ? "" : "active:scale-[0.99]"
                      }`}
                      style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                      data-testid={`button-quiz-option-${qIndex}-${optIndex}`}
                    >
                      <span
                        className={`font-pixel text-xs mt-0.5 shrink-0 w-6 h-6 flex items-center justify-center border ${
                          submitted && isSelected && isAnswer
                            ? "border-green-500 text-green-400"
                            : submitted && passed && isAnswer
                            ? "border-green-500 text-green-400"
                            : submitted && isSelected && !isAnswer
                            ? "border-red-500 text-red-400"
                            : isSelected
                            ? "border-[#FFD700] text-[#FFD700]"
                            : dark
                            ? "border-[#2a3552] text-slate-400"
                            : "border-border text-foreground/60"
                        }`}
                      >
                        {submitted && isSelected && isAnswer ? "\u2713" : submitted && passed && isAnswer ? "\u2713" : submitted && isSelected && !isAnswer ? "\u2717" : letter}
                      </span>
                      <span className={`text-[18px] md:text-[20px] leading-snug ${!submitted ? (dark ? "text-slate-200" : "text-foreground") : ""}`}>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>

              {submitted && passed && q.explanation && (
                <div
                  className={`mt-4 pt-4 border-t ${
                    dark ? "border-[#1f2a44]" : "border-border"
                  }`}
                  data-testid={`container-quiz-explanation-${qIndex}`}
                >
                  <div className={`font-pixel text-sm mb-2 ${
                    isCorrect
                      ? "text-green-400"
                      : isWrong
                      ? "text-red-400"
                      : dark ? "text-slate-400" : "text-foreground/60"
                  }`}>
                    {isCorrect ? "CORRECT" : isWrong ? "INCORRECT" : "NOT ANSWERED"} - EXPLANATION
                  </div>
                  <div className={`text-[17px] md:text-[19px] leading-relaxed ${
                    dark ? "text-slate-300" : "text-foreground/80"
                  }`}>
                    {q.explanation}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!submitted && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered}
            className={`font-pixel text-lg border-4 px-10 py-4 transition-all ${
              allAnswered
                ? "border-[#FFD700] bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95"
                : dark
                ? "border-[#1f2a44] bg-[#0f1930] text-slate-600 cursor-not-allowed"
                : "border-border bg-secondary text-foreground/40 cursor-not-allowed"
            }`}
            data-testid="button-quiz-submit"
          >
            {allAnswered && !authenticated ? "LOGIN & SUBMIT" : "SUBMIT ANSWERS"}
          </button>
          {!allAnswered && (
            <div className={`mt-3 font-pixel text-xs ${textMuted}`} data-testid="text-quiz-progress">
              {Object.keys(selections).length}/{QUIZ_QUESTIONS.length} ANSWERED
            </div>
          )}
          {allAnswered && !authenticated && (
            <div className={`mt-3 font-pixel text-xs ${textMuted}`}>
              LOGIN REQUIRED TO SUBMIT
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChapterContent({
  chapter,
  theme,
  tutorialMode,
  authenticated,
  sessionToken,
  completedCheckpoints,
  lightningAddress,
  emailVerified,
  pubkey,
  onLoginRequest,
  onCheckpointCompleted,
  onOpenProfile,
  getProgress,
  saveProgress,
}: {
  chapter: Chapter;
  theme: "light" | "dark";
  tutorialMode: "read" | "code";
  authenticated: boolean;
  sessionToken: string | null;
  completedCheckpoints: { checkpointId: string; amountSats: number; paidAt: string }[];
  lightningAddress: string | null;
  emailVerified: boolean;
  pubkey: string | null;
  onLoginRequest: () => void;
  onCheckpointCompleted: (id: string, amountSats?: number) => void;
  onOpenProfile: () => void;
  getProgress: (key: string) => string | null;
  saveProgress: (key: string, value: string, immediate?: boolean) => void;
}) {
  const [md, setMd] = useState<string>("Loading…");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setErr(null);
      if (chapter.kind === "intro") {
        setMd(introMarkdown());
        return;
      }

      try {
        const res = await fetch(chapter.file!);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cancelled) setMd(text);
      } catch (e) {
        if (!cancelled) {
          setErr(
            "Couldn't load this chapter. If you're on a deployed URL, make sure the markdown files are included under client/public/noise_tutorial/."
          );
          setMd("");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [chapter]);

  const rewriteTutorialImagePaths = (raw: string) => {
    return raw
      .replaceAll('src="./tutorial_images/', 'src="/noise_tutorial/tutorial_images/')
      .replaceAll("src='./tutorial_images/", "src='/noise_tutorial/tutorial_images/");
  };

  if (err) {
    return (
      <div
        className="bg-[#0f1930] border-2 border-[#2a3552] p-4"
        data-testid="status-chapter-error"
      >
        <div className="font-pixel text-sm text-[#ffd700] mb-2">LOAD ERROR</div>
        <div className="font-mono text-sm text-slate-200">{err}</div>
      </div>
    );
  }

  return (
    <div className={`noise-md noise-md-${theme}`} data-testid="container-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeUnwrapCustomBlockTags, rehypeHighlight]}
        components={{
          img: ({ style, width, height, ...props }: any) => {
            const rawSrc = String(props.src ?? "");
            const stableKey = rawSrc.replace(/\W+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "img";
            return (
              <ImageBlock
                stableKey={stableKey}
                rawSrc={rawSrc}
                style={style}
                height={height}
                props={props}
                theme={theme}
                srcKey={stableKey}
              />
            );
          },
          a: ({ ...props }) => {
            if (props.href === "#open-profile") {
              return (
                <a
                  {...props}
                  href="#"
                  onClick={(e: React.MouseEvent) => { e.preventDefault(); onOpenProfile(); }}
                  className={`underline underline-offset-4 hover:opacity-80 cursor-pointer ${
                    theme === "dark" ? "text-[#ffd700]" : "text-[#b8860b]"
                  }`}
                  data-testid="link-open-profile"
                />
              );
            }
            return (
              <a
                {...props}
                className={`underline underline-offset-4 hover:opacity-80 ${
                  theme === "dark" ? "text-[#ffd700]" : "text-[#b8860b]"
                }`}
                target={props.href?.startsWith("http") ? "_blank" : undefined}
                rel={props.href?.startsWith("http") ? "noreferrer" : undefined}
                data-testid="link-markdown"
              />
            );
          },
          code: ({ className, children, ...props }: any) => (
            <code
              className={`${className ?? ""} rounded px-1 py-0.5 ${theme === "dark" ? "bg-white/10" : "bg-black/[0.03]"}`}
              {...props}
            >
              {children}
            </code>
          ),
          // Handle <checkpoint id="..." /> tags in markdown (custom HTML element)
          checkpoint: ({ id }: any) => {
            const cpId = String(id || "");
            const cpData = CHECKPOINT_QUESTIONS[cpId];
            if (!cpData) return null;
            const isCompleted = completedCheckpoints.some(c => c.checkpointId === cpId);
            return (
              <CollapsibleItem
                title="Checkpoint Quiz"
                completed={isCompleted}
                theme={theme}
                label="CHECKPOINT"
                storageKey={`pl-collapse-cp-${cpId}`}
              >
                <CheckpointQuestion
                  checkpointId={cpId}
                  question={cpData.question}
                  options={cpData.options}
                  answer={cpData.answer}
                  explanation={cpData.explanation}
                  theme={theme}
                  authenticated={authenticated}
                  sessionToken={sessionToken}
                  lightningAddress={lightningAddress}
                  emailVerified={emailVerified}
                  pubkey={pubkey}
                  alreadyCompleted={isCompleted}
                  claimInfo={completedCheckpoints.find(c => c.checkpointId === cpId) || null}
                  onLoginRequest={onLoginRequest}
                  onCompleted={onCheckpointCompleted}
                />
              </CollapsibleItem>
            );
          },
          "code-intro": ({ heading, description, exercises: exerciseIds }: any) => {
            if (tutorialMode !== "code") return null;
            const ids = String(exerciseIds || "").split(",").map((s: string) => s.trim()).filter(Boolean);
            const exerciseList = ids
              .map((exId: string) => ({ id: exId, data: CODE_EXERCISES[exId] }))
              .filter((e: any) => e.data);
            if (exerciseList.length === 0) return null;

            const completedCount = exerciseList.filter((e: any) =>
              completedCheckpoints.some(c => c.checkpointId === e.id)
            ).length;

            const allDone = completedCount === exerciseList.length;
            const isDark = theme === "dark";
            const accentBg = allDone
              ? (isDark ? "bg-green-500" : "bg-green-600")
              : (isDark ? "bg-[#FFD700]" : "bg-[#b8860b]");

            // Single exercise: render as a single CollapsibleItem with accent bar
            if (exerciseList.length === 1) {
              const ex = exerciseList[0];
              const isCompleted = completedCheckpoints.some(c => c.checkpointId === ex.id);
              const ctx = getNoiseExerciseGroupContext(ex.id);
              return (
                <div className="my-8 relative exercise-accent-card">
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBg} z-10`} />
                  <style>{`.exercise-accent-card > div { margin: 0 !important; }`}</style>
                  <CollapsibleItem
                    title={ex.data.title}
                    completed={isCompleted}
                    theme={theme}
                    label="EXERCISE"
                    storageKey={`pl-collapse-ex-${ex.id}`}
                  >
                    <CodeExercise
                      exerciseId={ex.id}
                      data={ex.data}
                      theme={theme}
                      authenticated={authenticated}
                      sessionToken={sessionToken}
                      lightningAddress={lightningAddress}
                      alreadyCompleted={isCompleted}
                      claimInfo={completedCheckpoints.find(c => c.checkpointId === ex.id) || null}
                      onLoginRequest={onLoginRequest}
                      onCompleted={onCheckpointCompleted}
                      getProgress={getProgress}
                      saveProgress={saveProgress}
                      fileLabel={ctx?.fileLabel}
                      preamble={ctx?.preamble}
                      setupCode={ctx?.setupCode}
                      crossGroupExercises={ctx?.crossGroupExercises.map(cg => ({
                        id: cg.id,
                        starterCode: CODE_EXERCISES[cg.id]?.starterCode ?? "",
                      }))}
                      classMethodExercises={ctx?.classMethodExercises.map(cm => ({
                        id: cm.id,
                        starterCode: CODE_EXERCISES[cm.id]?.starterCode ?? "",
                      }))}
                      priorInGroupExercises={ctx?.priorInGroupExercises.map(pe => ({
                        id: pe.id,
                        starterCode: CODE_EXERCISES[pe.id]?.starterCode ?? "",
                      }))}
                      futureExercises={ctx?.futureExercises.map(fe => ({
                        id: fe.id,
                        starterCode: CODE_EXERCISES[fe.id]?.starterCode ?? "",
                      }))}
                      tutorialType="noise"
                    />
                  </CollapsibleItem>
                </div>
              );
            }

            // Multiple exercises: render as CollapsibleGroup with accent bar
            return (
              <div className="my-8 relative exercise-accent-card">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBg} z-10`} />
                <style>{`.exercise-accent-card > div { margin: 0 !important; }`}</style>
                <CollapsibleGroup
                  heading={heading}
                  description={description}
                  completedCount={completedCount}
                  totalCount={exerciseList.length}
                  theme={theme}
                  storageKey={`pl-collapse-group-${ids.join("-")}`}
                >
                  {exerciseList.map((ex: any) => {
                    const isCompleted = completedCheckpoints.some(c => c.checkpointId === ex.id);
                    const ctx = getNoiseExerciseGroupContext(ex.id);
                    return (
                      <CollapsibleItem
                        key={ex.id}
                        title={ex.data.title}
                        completed={isCompleted}
                        theme={theme}
                        label="EXERCISE"
                        storageKey={`pl-collapse-ex-${ex.id}`}
                      >
                        <CodeExercise
                          exerciseId={ex.id}
                          data={ex.data}
                          theme={theme}
                          authenticated={authenticated}
                          sessionToken={sessionToken}
                          lightningAddress={lightningAddress}
                          alreadyCompleted={isCompleted}
                          claimInfo={completedCheckpoints.find(c => c.checkpointId === ex.id) || null}
                          onLoginRequest={onLoginRequest}
                          onCompleted={onCheckpointCompleted}
                          getProgress={getProgress}
                          saveProgress={saveProgress}
                          fileLabel={ctx?.fileLabel}
                          preamble={ctx?.preamble}
                          setupCode={ctx?.setupCode}
                          crossGroupExercises={ctx?.crossGroupExercises.map(cg => ({
                            id: cg.id,
                            starterCode: CODE_EXERCISES[cg.id]?.starterCode ?? "",
                          }))}
                          classMethodExercises={ctx?.classMethodExercises.map(cm => ({
                            id: cm.id,
                            starterCode: CODE_EXERCISES[cm.id]?.starterCode ?? "",
                          }))}
                          priorInGroupExercises={ctx?.priorInGroupExercises.map(pe => ({
                            id: pe.id,
                            starterCode: CODE_EXERCISES[pe.id]?.starterCode ?? "",
                          }))}
                          futureExercises={ctx?.futureExercises.map(fe => ({
                            id: fe.id,
                            starterCode: CODE_EXERCISES[fe.id]?.starterCode ?? "",
                          }))}
                          tutorialType="noise"
                        />
                      </CollapsibleItem>
                    );
                  })}
                </CollapsibleGroup>
              </div>
            );
          },
          "code-outro": ({ text }: any) => {
            if (tutorialMode !== "code") return null;
            return <p className="mt-4 opacity-80">{text}</p>;
          },
          "code-exercise": () => {
            // Individual code-exercise tags are now handled by code-intro
            return null;
          },
          "handshake-diagram": ({ act }: any) => (
            <HandshakeDiagram theme={theme} act={act || undefined} />
          ),
          "nonce-reuse-lab": () => (
            <NonceReuseLab theme={theme} />
          ),
          "server-probe": () => {
            if (tutorialMode !== "code") return null;
            return (
              <ServerProbe
                theme={theme}
                onPacketCaptured={() => {}}
              />
            );
          },
          "capstone-panel": () => {
            if (tutorialMode !== "code") return null;
            return (
              <CapstonePanel
                getProgress={getProgress}
                theme={theme}
              />
            );
          },
          "checkpoint-group": ({ id, ids }: any) => {
            const groupId = String(id || "");
            const questionIds = String(ids || "").split(",").map((s: string) => s.trim()).filter(Boolean);
            const groupQuestions = questionIds
              .map((qid: string) => {
                const cpData = CHECKPOINT_QUESTIONS[qid];
                if (!cpData) return null;
                return { id: qid, ...cpData };
              })
              .filter(Boolean) as Array<{ id: string; question: string; options: string[]; answer: number; explanation: string }>;
            if (groupQuestions.length === 0) return null;
            const isGroupCompleted = completedCheckpoints.some(c => c.checkpointId === groupId);
            return (
              <CollapsibleItem
                title="Checkpoint Quiz"
                completed={isGroupCompleted}
                theme={theme}
                subtitleLabel={isGroupCompleted ? undefined : "EARN 21 SATS"}
                subtitle={isGroupCompleted ? undefined : `Answer all ${groupQuestions.length} questions correctly to claim your reward.`}
                storageKey={`pl-collapse-cpg-${groupId}`}
              >
                <CheckpointGroup
                  groupId={groupId}
                  questions={groupQuestions}
                  rewardSats={21}
                  theme={theme}
                  authenticated={authenticated}
                  sessionToken={sessionToken}
                  lightningAddress={lightningAddress}
                  emailVerified={emailVerified}
                  pubkey={pubkey}
                  alreadyCompleted={isGroupCompleted}
                  claimInfo={completedCheckpoints.find(c => c.checkpointId === groupId) || null}
                  onLoginRequest={onLoginRequest}
                  onCompleted={onCheckpointCompleted}
                />
              </CollapsibleItem>
            );
          },
        } as any}
      >
        {rewriteTutorialImagePaths(md)}
      </ReactMarkdown>

      {(() => {
        const reqs = CHAPTER_REQUIREMENTS[chapter.id];
        const isReadOnly = reqs && reqs.checkpoints.length === 0 &&
          (tutorialMode === "read" || reqs.exercises.length === 0);
        if (!isReadOnly || chapter.id === "quiz" || chapter.id === "pay-it-forward") return null;
        const isMarkedRead = getProgress(`noise-chapter-read:${chapter.id}`) === "1";

        if (!authenticated) {
          return (
            <button
              onClick={onLoginRequest}
              className={`mt-8 w-full border-2 px-4 py-3 font-pixel text-sm tracking-wide transition-colors cursor-pointer ${
                theme === "dark"
                  ? "border-[#2a3552] text-[#ffd700] hover:bg-[#132043]"
                  : "border-border text-foreground hover:bg-secondary"
              }`}
            >
              LOG IN TO TRACK PROGRESS
            </button>
          );
        }

        if (isMarkedRead) {
          return (
            <div className={`mt-8 text-center font-pixel text-sm ${
              theme === "dark" ? "text-green-400" : "text-green-600"
            }`}>
              &#10003; COMPLETED
            </div>
          );
        }

        return (
          <button
            onClick={() => {
              saveProgress(`noise-chapter-read:${chapter.id}`, "1", true);
              onCheckpointCompleted(`noise-chapter-read:${chapter.id}`);
            }}
            className={`mt-8 w-full border-2 px-4 py-3 font-pixel text-sm tracking-wide transition-colors cursor-pointer ${
              theme === "dark"
                ? "border-[#2a3552] text-[#ffd700] hover:bg-[#132043]"
                : "border-border text-foreground hover:bg-secondary"
            }`}
          >
            MARK AS READ
          </button>
        );
      })()}

    </div>
  );
}

function ResendVerificationButton({ sessionToken, theme }: { sessionToken: string | null; theme: "light" | "dark" }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dark = theme === "dark";
  const border = dark ? "border-[#2a3552]" : "border-gray-400";

  const handleResend = async () => {
    if (!sessionToken) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || "Failed to resend");
      }
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return <div className="font-pixel text-xs text-green-400" data-testid="text-verification-sent">VERIFICATION EMAIL SENT</div>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleResend}
        disabled={sending}
        className={`font-pixel text-xs border-2 ${border} px-4 py-2 ${dark ? "text-slate-300 hover:text-[#FFD700]" : "text-gray-700 hover:text-gray-900"} transition-colors ${sending ? "opacity-60" : ""}`}
        data-testid="button-resend-verification"
      >
        {sending ? "SENDING..." : "RESEND VERIFICATION EMAIL"}
      </button>
      {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
    </div>
  );
}

export default function NoiseTutorialPage() {
  return (
    <Switch>
      <Route path="/noise-tutorial">
        <NoiseTutorialShell activeId="intro" />
      </Route>
      <Route path="/noise-tutorial/:chapterId">
        {(params) => {
          const id = params?.chapterId ?? "intro";
          const exists = chapters.some((c) => c.id === id);
          return <NoiseTutorialShell activeId={exists ? id : "intro"} />;
        }}
      </Route>
    </Switch>
  );
}
