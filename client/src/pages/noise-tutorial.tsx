import { Link, Route, Switch, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { useAuth } from "../hooks/use-auth";
import LoginModal from "../components/LoginModal";
import { QRCodeSVG } from "qrcode.react";
import CheckpointQuestion from "../components/CheckpointQuestion";

// --- Checkpoint questions embedded inline in tutorial chapters ---
const CHECKPOINT_QUESTIONS: Record<string, {
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
    explanation: "In compressed public key format, the first byte is a parity byte that indicates whether the y-coordinate is even (02) or odd (03). Since the secp256k1 curve is symmetrical around the x-axis, there are exactly two possible y-values for each x-coordinate — one even, one odd. By encoding just the parity byte and the x-coordinate, the full point can be reconstructed, saving roughly 50% of space compared to the uncompressed format.",
  },
  "hash-preimage": {
    question: "An attacker has the SHA256 hash of Alice's public key. Which of the following is true?",
    options: [
      "The attacker can recover Alice's public key by reversing SHA256 with enough computational power, since SHA256 is a deterministic function",
      "The attacker can find a different public key that produces the same hash, enabling them to impersonate Alice",
      "The attacker can verify whether a given public key matches the hash, but cannot work backwards from the hash to discover the key",
      "The attacker can determine the length of Alice's public key from the hash output, since SHA256 preserves input length information",
    ],
    answer: 2,
    explanation: "SHA256 is a one-way function (pre-image resistant), meaning it's computationally infeasible to recover the input from the output. It's also collision resistant, so finding a different input that produces the same hash is practically impossible. However, since SHA256 is deterministic, anyone who has (or guesses) the original public key can hash it and check whether the result matches. SHA256 always produces a fixed 256-bit output regardless of input length, so no length information is leaked.",
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
    explanation: "The security of ECDH relies on the Elliptic Curve Discrete Logarithm Problem (ECDLP). While it's easy to compute a public key from a private key (multiply the private key by the generator point G), reversing this — finding the private key from the public key — is computationally infeasible. An eavesdropper who captures both A = a × G and B = b × G would need to extract either 'a' or 'b' to compute the shared secret a × b × G, but doing so requires solving the ECDLP.",
  },
  "hkdf-purpose": {
    question: "In Lightning's Noise Protocol, HKDF is used to expand one ECDH shared secret into two 32-byte keys. Why not simply use the shared secret directly as a single encryption key?",
    options: [
      "The ECDH shared secret is a point on the curve (64 bytes), which is too large for ChaCha20's 32-byte key requirement, so HKDF compresses it",
      "The protocol needs multiple independent keys for different purposes (e.g., a chaining key and a temporary encryption key), and reusing the same key for multiple cryptographic operations can compromise security",
      "HKDF adds entropy from the system's random number generator, making the derived keys more secure than the original shared secret",
      "The ECDH output is biased toward certain byte patterns due to the structure of secp256k1, so HKDF is needed to produce uniformly random bytes",
    ],
    answer: 1,
    explanation: "The Noise Protocol needs multiple independent keys for different purposes at each stage of the handshake: a chaining key (which accumulates entropy across ECDH operations) and a temporary encryption key (used for the current act's encryption). Using the same key for different cryptographic operations — such as both a MAC and an encryption — can create subtle vulnerabilities. HKDF's two-phase design (extract then expand) takes a single input and produces multiple cryptographically independent keys, ensuring that compromising one derived key doesn't compromise the others.",
  },
  "nonce-reuse": {
    question: "If Alice encrypts two different messages using the same ChaCha20 key and nonce, what can an attacker who intercepts both ciphertexts do?",
    options: [
      "Derive the original ChaCha20 key by brute-forcing the nonce space, since the same nonce was used twice",
      "Forge valid Poly1305 MACs for arbitrary messages, because the authentication keys are also repeated",
      "XOR the two ciphertexts together to cancel the keystream, then use frequency analysis and known plaintext structure to recover both messages",
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
      "Alice would unknowingly connect to a different node whose public key she used, creating a man-in-the-middle opportunity",
    ],
    answer: 1,
    explanation: "In the handshake setup, both Alice and Bob independently mix Bob's static public key into their handshake hash. If Alice uses the wrong key, her hash diverges from Bob's from the very start. When she computes the es ECDH shared secret using the wrong key in Act 1, she derives a different temp_k1 than Bob would. The MAC she creates with this wrong key and her divergent handshake hash (used as associated data) will fail verification on Bob's side, and he will immediately terminate the connection. This is exactly why the setup phase exists — it catches identity mismatches before any real data is exchanged.",
  },
  "act2-both-ephemeral": {
    question: "In Act 2, Bob generates his own ephemeral key pair and performs an ee ECDH with Alice's ephemeral key. Why can't they just reuse the es shared secret from Act 1 for the rest of the connection?",
    options: [
      "The es shared secret from Act 1 is only 16 bytes, which is too short for ChaCha20-Poly1305's 32-byte key requirement",
      "Reusing es would cause nonce collisions because both Act 1 and Act 2 start their nonces at 0",
      "The Noise Protocol specification explicitly forbids reusing shared secrets across acts, though it would be cryptographically safe to do so",
      "The es secret depends on Bob's static private key, so if that key were ever compromised, an attacker could derive es from Act 1's plaintext ephemeral key and decrypt all past sessions — the ee ECDH fixes this by adding entropy that is destroyed after the handshake",
    ],
    answer: 3,
    explanation: "The es shared secret from Act 1 is computed from Alice's ephemeral key and Bob's static key. Since Bob's static key is long-lived, if it were ever compromised in the future, an attacker who recorded the Act 1 message (which contains Alice's ephemeral public key in plaintext) could recompute es and decrypt the session. The ee ECDH in Act 2 introduces a shared secret that depends on both parties' ephemeral private keys — keys that are generated fresh for this session and destroyed afterward. Without at least one of these ephemeral private keys, an attacker cannot compute ee, even if they obtain both static keys later. This is what provides forward secrecy.",
  },
  "act3-nonce-one": {
    question: "In Act 3, Alice encrypts her static public key using temp_k2 with nonce = 1. Why doesn't she use nonce = 0?",
    options: [
      "Nonce 0 is reserved for the HKDF extract phase — ChaCha20 uses counter 0 to derive the Poly1305 authentication keys, so nonce 0 refers to this internal counter, not an external nonce",
      "The Noise Protocol always starts nonces at 1 to distinguish handshake messages from transport messages, which start at 0",
      "Bob already used temp_k2 with nonce = 0 in Act 2 to create his authentication MAC — reusing the same key with the same nonce would produce an identical keystream, leaking information about both plaintexts",
      "Alice's nonce counter was already incremented to 1 during the HKDF derivation of temp_k2, since HKDF internally calls ChaCha20 with nonce 0",
    ],
    answer: 2,
    explanation: "In Act 2, Bob used temp_k2 with nonce = 0 to encrypt a zero-length plaintext and produce his authentication MAC. Now in Act 3, Alice needs to use the same temp_k2 to encrypt her static public key. If she also used nonce = 0, the ChaCha20 keystream would be identical to what Bob generated, and an attacker who XORed the two ciphertexts could learn information about Alice's static key. By using nonce = 1, Alice ensures a completely different keystream is generated, keeping her encrypted static public key secure.",
  },
  "message-length-limit": {
    question: "What happens if a Lightning node needs to send a message that is 70,000 bytes long?",
    options: [
      "It cannot — BOLT 8 specifies that Lightning messages must not exceed 65,535 bytes, since the length prefix is a 2-byte integer and the protocol was designed this way intentionally to simplify testing and prevent memory-exhaustion attacks",
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
  section: "Introduction" | "Foundations" | "The Handshake" | "Encrypted Messaging" | "Quiz";
  kind: "intro" | "md";
  file?: string;
};

const chapters: Chapter[] = [
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
    id: "quiz",
    title: "Test Your Knowledge",
    section: "Quiz",
    kind: "md",
    file: "/noise_tutorial/1.13-quiz.md",
  },
];

const sectionOrder: Chapter["section"][] = [
  "Introduction",
  "Foundations",
  "The Handshake",
  "Encrypted Messaging",
  "Quiz",
];

function idxOf(id: string) {
  return Math.max(0, chapters.findIndex((c) => c.id === id));
}

function introMarkdown() {
  return `# Lightning's Noise Protocol: A Deep Dive

The Lightning Network helps bring the Bitcoin whitepaper's original vision to life: peer-to-peer electronic cash.

To do this successfully, the Lightning Network must adopt the same features that make peer-to-peer cash so great. Cash transactions are private (nobody has to know who you pay), authenticated (you know who you're paying because they're right there in front of you), and *kinda* tamper-proof (you can verify a bill is real and hasn't been altered... probably).

To bring these same properties (encrypted communication, authentication, and integrity checking) to the Lightning Network, the creators of the Lightning protocol chose the **Noise Protocol Framework**: a lean, secure channel protocol for encrypted peer-to-peer communication. Lightning is in good company here. WhatsApp leverages the Noise Framework as part of its end-to-end encryption for over 2 billion users, and WireGuard, one of the most widely adopted modern VPN protocols, uses Noise to secure its tunnels.

In this tutorial, we'll dig deep into Lightning's implementation of Noise, starting with the cryptographic building blocks, then working through the three-act handshake, and finishing with encrypted message transport and key rotation.

Let's get started.`;
}

function NoiseTutorialShell({ activeId }: { activeId: string }) {
  const [location, setLocation] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const auth = useAuth();
  const { authenticated, loading: authLoading, logout, loginWithToken } = auth;
  const [showLoginModal, setShowLoginModal] = useState(false);

  const activeIndex = idxOf(activeId);
  const active = chapters[activeIndex] ?? chapters[0];
  const prev = chapters[activeIndex - 1];
  const next = chapters[activeIndex + 1];

  const grouped = useMemo(() => {
    const bySection = new Map<Chapter["section"], Chapter[]>();
    for (const s of sectionOrder) bySection.set(s, []);
    for (const c of chapters) bySection.get(c.section)?.push(c);
    return bySection;
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location, setMobileNavOpen]);

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

  return (
    <div className={`min-h-screen ${t.pageBg} ${t.pageText}`} data-theme={theme}>
      <div className={`w-full border-b-4 ${t.headerBorder} ${t.headerBg} px-4 py-3 flex items-center justify-between sticky top-0 z-50`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`md:hidden font-pixel text-xs border-2 ${theme === "dark" ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#132043]" : "border-border bg-card hover:bg-secondary"} px-3 py-2 transition-colors`}
            onClick={() => setMobileNavOpen((v) => !v)}
            data-testid="button-sidebar-toggle"
          >
            MENU
          </button>
          <Link
            href="/blog"
            className="font-pixel text-xs md:text-sm hover:text-primary transition-colors"
            data-testid="link-back-blog"
          >
            &lt; BACK TO LEARN
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
            <button
              type="button"
              onClick={logout}
              className={`p-2 font-pixel text-xs md:text-sm transition-colors ${
                theme === "dark"
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-foreground/60 hover:text-foreground"
              }`}
              title={auth.email || auth.pubkey ? `Logged in as ${auth.email || (auth.pubkey?.slice(0, 8) + "...")}` : "Logged in"}
              data-testid="button-logout"
            >
              LOGOUT
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className={`p-2 font-pixel text-xs md:text-sm transition-colors ${
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
        className="mx-auto w-full max-w-7xl grid gap-0"
        style={{
          gridTemplateColumns: sidebarCollapsed ? `60px minmax(0, 1fr)` : `360px minmax(0, 1fr)`,
        }}
      >
        <aside
          className={`${
            mobileNavOpen ? "block" : "hidden"
          } md:block md:sticky md:top-[68px] h-fit ${theme === "dark" ? "bg-[#0b1220]" : "bg-card"}`}
        >
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
              const items = grouped.get(section) ?? [];
              if (!items.length) return null;
              return (
                <div key={section} className="mb-4">
                  <div
                    className={`font-pixel text-[14px] tracking-wide mb-2 ${theme === "dark" ? "text-slate-300" : "text-foreground/70"}`}
                    data-testid={`text-section-${section.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {section.toUpperCase()}
                  </div>
                  <div className={`h-[2px] ${theme === "dark" ? "bg-[#1f2a44]" : "bg-border"} mb-2`} />

                  <nav className="grid gap-1">
                    {items.map((c) => {
                      const href = c.id === "intro" ? "/noise-tutorial" : `/noise-tutorial/${c.id}`;
                      const isActive = c.id === activeId;
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
                          <div className="font-mono text-[20px] leading-tight">{c.title}</div>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              );
            })}
          </div>
        </aside>

        <main className="p-5 md:p-10">
          <div className="mx-auto w-full max-w-[1200px]">
          <article
            className="noise-article mx-auto w-full max-w-[1100px]"
            data-testid="container-article"
          >
            {active.section === "Quiz" ? (
              <InteractiveQuiz
                theme={theme}
                authenticated={authenticated}
                rewardClaimed={auth.rewardClaimed}
                sessionToken={auth.sessionToken}
                onLoginRequest={() => setShowLoginModal(true)}
              />
            ) : (
              <ChapterContent
                chapter={active}
                theme={theme}
                authenticated={authenticated}
                sessionToken={auth.sessionToken}
                completedCheckpoints={auth.completedCheckpoints}
                onLoginRequest={() => setShowLoginModal(true)}
                onCheckpointCompleted={auth.markCheckpointCompleted}
              />
            )}

            <div className={`mt-10 pt-6 border-t ${theme === "dark" ? "border-[#1f2a44]" : "border-border"} flex items-center justify-between gap-3`}>
              {prev ? (
                <Link
                  href={prev.id === "intro" ? "/noise-tutorial" : `/noise-tutorial/${prev.id}`}
                  className={`inline-flex items-center gap-2 border-2 px-4 py-2 transition-colors ${t.navPrev}`}
                  data-testid="link-prev"
                >
                  <span className={`font-pixel text-base ${theme === "dark" ? "text-slate-300" : "text-foreground/70"}`}>PREV</span>
                  <span className="font-mono text-lg">{prev.title}</span>
                </Link>
              ) : (
                <div />
              )}

              {next ? (
                <Link
                  href={next.id === "intro" ? "/noise-tutorial" : `/noise-tutorial/${next.id}`}
                  className={`inline-flex items-center gap-2 border-2 px-4 py-2 transition-all ${t.navNext}`}
                  data-testid="link-next"
                >
                  <span className="font-pixel text-base">NEXT</span>
                  <span className="font-mono text-lg">{next.title}</span>
                </Link>
              ) : (
                <div />
              )}
            </div>
          </article>
          </div>
        </main>
      </div>

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
  }, [open, rawSrc]);

  const zoomBodyRef = useRef<HTMLSpanElement | null>(null);
  const zoomImgRef = useRef<HTMLImageElement | null>(null);


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
      const clamped = Math.min(2.5, Math.max(0.5, fit));

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
                  min={0.5}
                  max={2.5}
                  step={0.25}
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
                <span style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
                  <img
                    ref={zoomImgRef}
                    {...props}
                    src={rawSrc}
                    width={undefined}
                    height={height}
                    style={{
                      ...(style ?? {}),
                      display: "block",
                      maxWidth: "none",
                      width: "auto",
                      height: "auto",
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
    explanation: "Digital signatures prove identity but produce a standalone proof that anyone can verify — they don't create shared secrets. ECDH, on the other hand, produces a shared secret known only to both parties, which can be immediately fed into HKDF to derive encryption keys. This means a single ECDH operation simultaneously authenticates both parties AND establishes keying material, whereas signatures would require a separate key exchange step on top. The Noise framework leverages this dual purpose throughout the handshake.",
  },
  {
    question: "In Act 1, Alice encrypts a zero-length plaintext with ChaCha20-Poly1305. Why doesn't she encrypt any actual data?",
    options: [
      "Alice's goal is only to prove she knows Bob's public key — the MAC alone, created with a key derived from their ECDH shared secret, is sufficient to prove this",
      "The Act 1 message must be exactly 50 bytes, and there's no room for additional plaintext after the version byte and Ephemeral Public Key",
      "The plaintext is encrypted in a separate step that happens between Act 1 and Act 2",
      "ChaCha20-Poly1305 requires an empty plaintext for the initial use of any new key",
    ],
    answer: 0,
    explanation: "The purpose of Act 1 is not to transmit data — it's to prove that Alice knows Bob's static public key. She does this by performing an ECDH between her ephemeral key and Bob's static key, deriving a temporary key, and using it to produce a 16-byte Poly1305 MAC over an empty plaintext. If Alice didn't know Bob's real public key, the ECDH would produce the wrong shared secret, the derived key would be wrong, and the MAC wouldn't verify. The MAC itself is the proof — no plaintext is needed.",
  },
  {
    question: "At what point during the Noise handshake does Bob first learn Alice's identity?",
    options: [
      "Act 3 — when Bob decrypts Alice's encrypted Static Public Key, but before he has verified the final MAC",
      "Act 1 — when Alice proves she knows Bob's Static Public Key",
      "Act 2 — after the ephemeral-ephemeral (ee) ECDH exchange",
      "Act 3 — only after Bob successfully verifies the final MAC with temp_k3",
    ],
    answer: 0,
    explanation: "In Act 3, Alice sends her static public key encrypted with temp_k2. When Bob decrypts it, he immediately learns her Lightning node identity — this happens before he verifies the final MAC with temp_k3. The MAC verification in Act 3 confirms that the handshake transcript hasn't been tampered with, but Bob already has Alice's decrypted identity at that point. Acts 1 and 2 don't reveal Alice's identity at all: Act 1 only proves Alice knows Bob's key, and Act 2 only involves ephemeral keys.",
  },
  {
    question: "Why does Alice use her Ephemeral Public Key — rather than her Static Public Key — for the ECDH in Act 1?",
    options: [
      "The Noise Protocol requires all Act 1 ECDH operations to use ephemeral keys for both parties",
      "Her Static Public Key is too large to fit in the 50-byte Act 1 message",
      "Sending her Static Public Key in plaintext would reveal her Lightning node identity to eavesdroppers",
      "Her Static Public Key uses a different curve than Bob's Ephemeral Key, making ECDH impossible",
    ],
    answer: 2,
    explanation: "Alice's static public key is her Lightning node identity (the public key in her node's connection address). If she sent it in plaintext in Act 1, any passive eavesdropper monitoring the network could see exactly which node is initiating the connection. By using a freshly generated ephemeral key instead, Alice reveals nothing about her identity to observers. Her static key is only transmitted later in Act 3, encrypted under keys derived from the ee ECDH — which an eavesdropper cannot compute.",
  },
  {
    question: "Why is forward secrecy NOT established until Act 2?",
    options: [
      "Act 1 doesn't encrypt any data, so there's nothing that forward secrecy would protect",
      "The es ECDH in Act 1 involves Bob's Static Key, so if Bob's static private key were compromised, an attacker could recompute the shared secret using Alice's Ephemeral Public Key (which was sent in plaintext)",
      "Forward secrecy requires at least three ECDH operations, and only two are complete after Act 1",
      "Act 1 only uses hash functions — the first ECDH doesn't happen until Act 2",
    ],
    answer: 1,
    explanation: "Forward secrecy means that compromising long-term (static) keys doesn't compromise past session keys. In Act 1, the es ECDH combines Alice's ephemeral key with Bob's static key. If an attacker later steals Bob's static private key, they can recompute this shared secret using Alice's ephemeral public key (which was sent unencrypted in Act 1). It's not until Act 2, when Bob introduces his own ephemeral key and the ee ECDH occurs, that the session keys depend on secrets that are destroyed after the handshake — achieving forward secrecy.",
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
    explanation: "ChaCha20 is a stream cipher — it generates a pseudorandom keystream from the key and nonce, then XORs it with the plaintext. If the same key and nonce produce the same keystream twice, an attacker can XOR the two ciphertexts together. The keystreams cancel out, leaving the XOR of the two plaintexts. With known or guessable structure in either message, the attacker can progressively recover both. This is why Noise increments the nonce after every encryption and rotates keys after 1000 messages — nonce reuse must never occur.",
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
    explanation: "The handshake hash (h) is a cumulative SHA-256 digest that absorbs every piece of data exchanged during the handshake — public keys, ECDH outputs, and ciphertexts. Each time a MAC is computed with ChaCha20-Poly1305, the current handshake hash is passed as the Associated Data (AD). This binds the MAC to the entire transcript up to that point. If an attacker tried to replay, reorder, or tamper with any handshake message, the hash would diverge between Alice and Bob, and the MAC verification would fail.",
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
    explanation: "Key rotation uses HKDF with the current encryption key (sk or rk) as the Input Key Material. HKDF(ck, current_key) produces two outputs: a new chaining key and a new encryption key that replaces the old one. The old key is immediately discarded. This is what provides forward secrecy for the message transport phase — even if an attacker compromises a current key, they cannot derive any previous keys because HKDF is a one-way function. Rotation happens every 1000 messages (when the nonce counter hits 1000).",
  },
  {
    question: "Why does Lightning encrypt the 2-byte message length prefix before transmission?",
    options: [
      "The encrypted length doubles as a session identifier that Bob uses to match messages to the correct connection",
      "The length field contains a checksum that must be protected from tampering",
      "ChaCha20-Poly1305 requires all inputs — including metadata — to be encrypted before the algorithm can produce a valid MAC",
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
    explanation: "HKDF(ck, \"\") always produces the same two keys in the same order — call them K1 and K2. Alice assigns K1 as her sending key (sk) and K2 as her receiving key (rk). Bob must do the opposite: K1 becomes his receiving key (rk) and K2 becomes his sending key (sk). This way, when Alice encrypts with her sk (K1), Bob decrypts with his rk (also K1). And when Bob encrypts with his sk (K2), Alice decrypts with her rk (also K2). Without this reversal, both sides would encrypt and decrypt with the same key assignments, and communication would fail.",
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
  onLoginRequest,
}: {
  theme: "light" | "dark";
  authenticated: boolean;
  rewardClaimed: boolean;
  sessionToken: string | null;
  onLoginRequest: () => void;
}) {
  const [selections, setSelections] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem("pl-quiz-selections");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
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

  const dark = theme === "dark";
  const border = dark ? "border-[#2a3552]" : "border-border";
  const bg = dark ? "bg-[#0f1930]" : "bg-card";
  const textColor = dark ? "text-slate-200" : "text-foreground";
  const textMuted = dark ? "text-slate-400" : "text-foreground/60";

  const handleSelect = (qIndex: number, optIndex: number) => {
    if (submitted) return;
    setSelections((prev) => {
      const next = { ...prev, [qIndex]: optIndex };
      try { localStorage.setItem("pl-quiz-selections", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleSubmit = () => {
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
        body: JSON.stringify({ answers: selections }),
      });
      const data = await res.json();
      if (!res.ok) {
        setClaimError(data.error || "Failed to claim reward");
        setClaimingReward(false);
        return;
      }
      setRewardK1(data.k1);
      setRewardLnurl(data.lnurl);
      setRewardAmountSats(data.amountSats);
      setRewardCreatedAt(Date.now());
      setWithdrawalStatus("pending");
      setShowReward(true);
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
    try { localStorage.removeItem("pl-quiz-selections"); } catch {}
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
              <button
                type="button"
                onClick={handleClaimReward}
                disabled={claimingReward}
                className={`mt-4 font-pixel text-sm border-2 px-6 py-3 transition-all border-[#FFD700] bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 ${
                  claimingReward ? "opacity-60 cursor-wait" : ""
                }`}
                data-testid="button-claim-reward"
              >
                {claimingReward ? "GENERATING QR..." : "CLAIM BITCOIN REWARD"}
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

          {passed && showReward && rewardLnurl && (
            <div className="mt-6" data-testid="container-reward-qr">
              {withdrawalStatus === "paid" ? (
                <div>
                  <div className="font-pixel text-lg mb-2" style={{ color: "#FFD700" }}>
                    {rewardAmountSats} SATS SENT!
                  </div>
                  <div className={`text-lg ${textColor}`}>
                    Payment complete. Enjoy your sats!
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
              <div className={`text-[19px] md:text-[22px] font-semibold mb-4 leading-snug ${textColor}`} data-testid={`text-quiz-question-${qIndex}`}>
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
                      // They selected it and it's correct — show green
                      optionStyle = "border-green-500 bg-green-500/15 text-green-300";
                      if (!dark) optionStyle = "border-green-600 bg-green-50 text-green-800";
                    } else if (isSelected && !isAnswer) {
                      // They selected it and it's wrong — show red
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
                        {submitted && isSelected && isAnswer ? "✓" : submitted && passed && isAnswer ? "✓" : submitted && isSelected && !isAnswer ? "✗" : letter}
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
                    {isCorrect ? "CORRECT" : isWrong ? "INCORRECT" : "NOT ANSWERED"} — EXPLANATION
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
  authenticated,
  sessionToken,
  completedCheckpoints,
  onLoginRequest,
  onCheckpointCompleted,
}: {
  chapter: Chapter;
  theme: "light" | "dark";
  authenticated: boolean;
  sessionToken: string | null;
  completedCheckpoints: string[];
  onLoginRequest: () => void;
  onCheckpointCompleted: (id: string) => void;
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
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
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
          a: ({ ...props }) => (
            <a
              {...props}
              className={`underline underline-offset-4 hover:opacity-80 ${
                theme === "dark" ? "text-[#ffd700]" : "text-[#b8860b]"
              }`}
              target={props.href?.startsWith("http") ? "_blank" : undefined}
              rel={props.href?.startsWith("http") ? "noreferrer" : undefined}
              data-testid="link-markdown"
            />
          ),
          code: ({ className, children, ...props }: any) => (
            <code
              className={`${className ?? ""} rounded px-1 py-0.5 bg-white/10`}
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
            return (
              <CheckpointQuestion
                checkpointId={cpId}
                question={cpData.question}
                options={cpData.options}
                answer={cpData.answer}
                explanation={cpData.explanation}
                theme={theme}
                authenticated={authenticated}
                sessionToken={sessionToken}
                alreadyCompleted={completedCheckpoints.includes(cpId)}
                onLoginRequest={onLoginRequest}
                onCompleted={onCheckpointCompleted}
              />
            );
          },
        } as any}
      >
        {rewriteTutorialImagePaths(md)}
      </ReactMarkdown>

    </div>
  );
}

export default function NoiseTutorialPage() {
  const hasAccess = sessionStorage.getItem("pl-course-access") === "granted";

  if (!hasAccess) {
    window.location.href = "/blog";
    return null;
  }

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
