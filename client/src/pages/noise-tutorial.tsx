import { Link, Route, Switch, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { useLnAuth } from "../hooks/use-lnauth";
import LnAuthLogin from "../components/LnAuthLogin";

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

The Lightning Network enables instant, low-fee Bitcoin payments through a network of bidirectional payment channels. But for a payment protocol handling real money, secure communication isn't optional — it's essential.

Lightning needs **encrypted, authenticated channels** between nodes, ensuring that payment data stays private, messages can't be tampered with, and both parties can verify who they're talking to. Rather than using TLS (which relies on certificate authorities that don't fit Bitcoin's decentralized design), the Lightning developers chose the **Noise Protocol Framework** — the same framework used by WhatsApp, Slack, and WireGuard.

This tutorial walks through Lightning's Noise Protocol implementation from the ground up: starting with the cryptographic building blocks, working through the three-act handshake, and finishing with encrypted message transport and key rotation. Along the way, we'll cross-reference everything against BOLT 8 (the Lightning specification for transport encryption) and real implementations.

Let's get started.`;
}

function NoiseTutorialShell({ activeId }: { activeId: string }) {
  const [location, setLocation] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { authenticated, pubkey, loading: authLoading, login, logout } = useLnAuth();

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
    <div className={`min-h-screen ${t.pageBg} ${t.pageText} overflow-x-hidden`} data-theme={theme}>
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
            &lt; BACK TO BLOG
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className={`font-pixel text-xs ${theme === "dark" ? "text-slate-300" : "text-foreground/70"}`} data-testid="text-tutorial-breadcrumb">
            Noise Tutorial
          </div>
          <div className={`h-4 w-[2px] ${theme === "dark" ? "bg-[#2a3552]" : "bg-border"}`} />
          <div className={`font-mono text-sm ${t.crumbText}`} data-testid="text-chapter-title">
            {active.title}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {authenticated && pubkey && (
            <div className="hidden md:flex items-center gap-2" data-testid="container-auth-status">
              <span className={`font-pixel text-[10px] ${theme === "dark" ? "text-slate-400" : "text-foreground/60"}`}>
                {pubkey.slice(0, 8)}...
              </span>
              <button
                type="button"
                onClick={logout}
                className={`border px-2 py-1 font-pixel text-[10px] transition-colors ${
                  theme === "dark"
                    ? "border-[#2a3552] text-slate-400 hover:text-slate-200"
                    : "border-border text-foreground/60 hover:text-foreground"
                }`}
                data-testid="button-logout"
              >
                LOGOUT
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
            className={`border-2 px-3 py-2 font-pixel text-xs transition-colors ${theme === "dark" ? "border-[#2a3552] bg-[#0f1930] hover:bg-[#132043]" : "border-border bg-card hover:bg-secondary"}`}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
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
                    className={`font-pixel text-[12px] tracking-wide mb-2 ${theme === "dark" ? "text-slate-300" : "text-foreground/70"}`}
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
                          } w-full text-left border-2 px-3 py-3 transition-colors`}
                          data-testid={`button-chapter-${c.id}`}
                        >
                          <div className="font-mono text-[18px] leading-snug">{c.title}</div>
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
            {active.section === "Quiz" && !authenticated ? (
              <QuizAuthGate theme={theme} onSuccess={login} />
            ) : active.section === "Quiz" ? (
              <InteractiveQuiz theme={theme} />
            ) : (
              <ChapterContent chapter={active} theme={theme} />
            )}

            <div className={`mt-10 pt-6 border-t ${theme === "dark" ? "border-[#1f2a44]" : "border-border"} flex items-center justify-between gap-3`}>
              {prev ? (
                <Link
                  href={prev.id === "intro" ? "/noise-tutorial" : `/noise-tutorial/${prev.id}`}
                  className={`inline-flex items-center gap-2 border-2 px-4 py-3 transition-colors ${t.navPrev}`}
                  data-testid="link-prev"
                >
                  <span className={`font-pixel text-sm ${theme === "dark" ? "text-slate-300" : "text-foreground/70"}`}>PREV</span>
                  <span className="font-mono text-[16px]">{prev.title}</span>
                </Link>
              ) : (
                <div />
              )}

              {next ? (
                <Link
                  href={next.id === "intro" ? "/noise-tutorial" : `/noise-tutorial/${next.id}`}
                  className={`inline-flex items-center gap-2 border-2 px-4 py-3 transition-all ${t.navNext}`}
                  data-testid="link-next"
                >
                  <span className="font-pixel text-sm">NEXT</span>
                  <span className="font-mono text-[16px]">{next.title}</span>
                </Link>
              ) : (
                <div />
              )}
            </div>
          </article>
          </div>
        </main>
      </div>
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
      "ECDH is more resistant to quantum computing attacks than signatures",
      "ECDH is more computationally efficient, and the resulting shared secrets can be directly used to derive encryption keys, simplifying the protocol",
      "The secp256k1 curve doesn't support signature operations, only key agreement",
      "Signatures would require a certificate authority, which contradicts Bitcoin's decentralized design",
    ],
    answer: 1,
  },
  {
    question: "In Act 1, Alice encrypts a zero-length plaintext with ChaCha20-Poly1305. Why doesn't she encrypt any actual data?",
    options: [
      "The Act 1 message must be exactly 50 bytes, and there's no room for additional plaintext after the version byte and Ephemeral Public Key",
      "ChaCha20-Poly1305 requires an empty plaintext for the initial use of any new key",
      "Alice's goal is only to prove she knows Bob's public key — the MAC alone, created with a key derived from their ECDH shared secret, is sufficient to prove this",
      "The plaintext is encrypted in a separate step that happens between Act 1 and Act 2",
    ],
    answer: 2,
  },
  {
    question: "At what point during the Noise handshake does Bob first learn Alice's identity?",
    options: [
      "Act 1 — when Alice proves she knows Bob's Static Public Key",
      "Act 2 — after the ephemeral-ephemeral (ee) ECDH exchange",
      "Act 3 — when Bob decrypts Alice's encrypted Static Public Key, but before he has verified the final MAC",
      "Act 3 — only after Bob successfully verifies the final MAC with temp_k3",
    ],
    answer: 2,
  },
  {
    question: "Why does Alice use her Ephemeral Public Key — rather than her Static Public Key — for the ECDH in Act 1?",
    options: [
      "Her Static Public Key uses a different curve than Bob's Ephemeral Key, making ECDH impossible",
      "Sending her Static Public Key in plaintext would reveal her Lightning node identity to eavesdroppers",
      "The Noise Protocol requires all Act 1 ECDH operations to use ephemeral keys for both parties",
      "Her Static Public Key is too large to fit in the 50-byte Act 1 message",
    ],
    answer: 1,
  },
  {
    question: "Why is forward secrecy NOT established until Act 2?",
    options: [
      "Forward secrecy requires at least three ECDH operations, and only two are complete after Act 1",
      "Act 1 only uses hash functions — the first ECDH doesn't happen until Act 2",
      "The es ECDH in Act 1 involves Bob's Static Key, so if Bob's static private key were compromised, an attacker could recompute the shared secret using Alice's Ephemeral Public Key (which was sent in plaintext)",
      "Act 1 doesn't encrypt any data, so there's nothing that forward secrecy would protect",
    ],
    answer: 2,
  },
  {
    question: "What would happen if Alice reused the same nonce with the same key for two different ChaCha20 encryptions?",
    options: [
      "The decryption would fail because ChaCha20 detects nonce reuse automatically",
      "Both messages would decrypt to the same plaintext regardless of the original content",
      "An attacker could XOR the two ciphertexts together to learn information about both plaintexts, potentially recovering them entirely",
      "The MACs would be identical, but the ciphertexts would remain secure",
    ],
    answer: 2,
  },
  {
    question: "What is the primary purpose of the handshake hash throughout the Noise handshake?",
    options: [
      "It stores a compressed version of all messages sent between Alice and Bob so they can be replayed if the connection drops",
      "It acts as a running transcript of the handshake, and is included as associated data in each MAC so that both parties can verify they are progressing through the protocol in sync",
      "It is used as the encryption key for each act's ChaCha20-Poly1305 operation",
      "It serves as a checksum that Alice and Bob compare directly at the end of the handshake to verify success",
    ],
    answer: 1,
  },
  {
    question: "During key rotation, what serves as the Input Key Material (IKM) for the HKDF function?",
    options: [
      "A zero-length input, similar to Act 3's final key derivation",
      "The original ECDH shared secret from the handshake phase",
      "The current encryption key (sk or rk)",
      "A freshly computed ephemeral ECDH shared secret between Alice and Bob",
    ],
    answer: 2,
  },
  {
    question: "Why does Lightning encrypt the 2-byte message length prefix before transmission?",
    options: [
      "The length field contains a checksum that must be protected from tampering",
      "ChaCha20-Poly1305 requires all inputs — including metadata — to be encrypted before the algorithm can produce a valid MAC",
      "Without length encryption, an attacker could perform traffic analysis to learn message types and potentially track payments across the network",
      "The encrypted length doubles as a session identifier that Bob uses to match messages to the correct connection",
    ],
    answer: 2,
  },
  {
    question: 'After the handshake, Alice computes sk, rk = HKDF(ck, "") and Bob computes rk, sk = HKDF(ck, ""). Why are the variable assignments reversed?',
    options: [
      "Alice and Bob use different Chaining Keys at this point, so the HKDF outputs are different and must be assigned accordingly",
      "The HKDF function produces outputs in a different order depending on which party calls it",
      "The reversal ensures that Alice's Sending Key is the same key as Bob's Receiving Key (and vice versa), so messages encrypted by one party can be decrypted by the other",
      "Bob reverses the assignment to account for the different nonce ordering between sender and receiver",
    ],
    answer: 2,
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

function InteractiveQuiz({ theme }: { theme: "light" | "dark" }) {
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const dark = theme === "dark";
  const border = dark ? "border-[#2a3552]" : "border-border";
  const bg = dark ? "bg-[#0f1930]" : "bg-card";
  const textColor = dark ? "text-slate-200" : "text-foreground";
  const textMuted = dark ? "text-slate-400" : "text-foreground/60";

  const handleSelect = (qIndex: number, optIndex: number) => {
    if (submitted) return;
    setSelections((prev) => ({ ...prev, [qIndex]: optIndex }));
  };

  const handleSubmit = () => {
    let correct = 0;
    QUIZ_QUESTIONS.forEach((q, i) => {
      if (selections[i] === q.answer) correct++;
    });
    setScore(correct);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReset = () => {
    setSelections({});
    setSubmitted(false);
    setScore(0);
  };

  const percentage = Math.round((score / QUIZ_QUESTIONS.length) * 100);
  const passed = percentage >= 90;
  const allAnswered = Object.keys(selections).length === QUIZ_QUESTIONS.length;

  return (
    <div className="py-6" data-testid="container-interactive-quiz">
      <h1 className={`font-pixel text-2xl md:text-3xl mb-2 ${dark ? "text-slate-100" : "text-foreground"}`} data-testid="text-quiz-title">
        Quiz: Lightning's Noise Protocol
      </h1>
      <p className={`text-lg mb-8 ${textMuted}`}>
        {submitted
          ? `You scored ${score}/${QUIZ_QUESTIONS.length} (${percentage}%)`
          : `Select one answer per question, then submit. You need 90% to pass.`}
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
            className={`font-pixel text-xl mb-2 ${passed ? "text-[#FFD700]" : dark ? "text-red-400" : "text-red-600"}`}
            data-testid="text-quiz-result-title"
          >
            {passed ? "CONGRATULATIONS!" : "NOT QUITE..."}
          </div>
          <div className={`text-lg ${textColor}`} data-testid="text-quiz-result-score">
            {passed
              ? `You passed with ${percentage}%! You've mastered Lightning's Noise Protocol.`
              : `You scored ${percentage}%. You need 90% to pass. Review the incorrect answers below and try again!`}
          </div>
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

      <div className="space-y-8">
        {QUIZ_QUESTIONS.map((q, qIndex) => {
          const selected = selections[qIndex];
          const isCorrect = submitted && selected === q.answer;
          const isWrong = submitted && selected !== undefined && selected !== q.answer;

          return (
            <div
              key={qIndex}
              className={`border-4 p-6 ${bg} ${
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
              <div className={`font-pixel text-sm mb-1 ${textMuted}`}>
                QUESTION {qIndex + 1} OF {QUIZ_QUESTIONS.length}
              </div>
              <div className={`text-lg font-semibold mb-5 ${textColor}`} data-testid={`text-quiz-question-${qIndex}`}>
                {q.question}
              </div>

              <div className="space-y-3">
                {q.options.map((opt, optIndex) => {
                  const isSelected = selected === optIndex;
                  const isAnswer = q.answer === optIndex;
                  const letter = String.fromCharCode(65 + optIndex);

                  let optionStyle = "";
                  if (submitted) {
                    if (isAnswer) {
                      optionStyle = "border-green-500 bg-green-500/15 text-green-300";
                      if (!dark) optionStyle = "border-green-600 bg-green-50 text-green-800";
                    } else if (isSelected && !isAnswer) {
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
                      className={`w-full text-left border-2 p-4 flex items-start gap-3 transition-colors ${optionStyle} ${
                        submitted ? "" : "active:scale-[0.99]"
                      }`}
                      data-testid={`button-quiz-option-${qIndex}-${optIndex}`}
                    >
                      <span
                        className={`font-pixel text-sm mt-0.5 shrink-0 w-7 h-7 flex items-center justify-center border ${
                          submitted && isAnswer
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
                        {submitted && isAnswer ? "✓" : submitted && isSelected && !isAnswer ? "✗" : letter}
                      </span>
                      <span className={`text-[15px] leading-relaxed ${!submitted ? (dark ? "text-slate-200" : "text-foreground") : ""}`}>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
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
            SUBMIT ANSWERS
          </button>
          {!allAnswered && (
            <div className={`mt-3 font-pixel text-xs ${textMuted}`} data-testid="text-quiz-progress">
              {Object.keys(selections).length}/{QUIZ_QUESTIONS.length} ANSWERED
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuizAuthGate({
  theme,
  onSuccess,
}: {
  theme: "light" | "dark";
  onSuccess: (token: string, pubkey: string) => void;
}) {
  const dark = theme === "dark";
  const border = dark ? "border-[#2a3552]" : "border-border";
  const bg = dark ? "bg-[#0f1930]" : "bg-card";
  const textColor = dark ? "text-slate-200" : "text-foreground";
  const textMuted = dark ? "text-slate-400" : "text-foreground/60";

  return (
    <div className="py-8" data-testid="container-quiz-auth-gate">
      <div className={`border-4 ${border} ${bg} p-8 max-w-2xl mx-auto text-center`}>
        <div className="font-pixel text-xl mb-4" style={{ color: "#ffd700" }} data-testid="text-quiz-locked-title">
          QUIZ LOCKED
        </div>

        <div className={`text-lg ${textColor} mb-2`}>
          You need to log in with a Lightning wallet to take the quiz.
        </div>

        <div className={`text-sm ${textMuted} mb-8`}>
          This helps verify you're a real human and connects your score to your Lightning identity.
        </div>

        <LnAuthLogin theme={theme} onSuccess={onSuccess} />
      </div>
    </div>
  );
}

function ChapterContent({ chapter, theme }: { chapter: Chapter; theme: "light" | "dark" }) {
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
          img: ({ style, width, height, ...props }) => {
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
              className="text-[#ffd700] underline underline-offset-4 hover:opacity-90"
              target={props.href?.startsWith("http") ? "_blank" : undefined}
              rel={props.href?.startsWith("http") ? "noreferrer" : undefined}
              data-testid="link-markdown"
            />
          ),
          code: ({ className, children, ...props }) => (
            <code
              className={`${className ?? ""} rounded px-1 py-0.5 bg-white/10`}
              {...props}
            >
              {children}
            </code>
          ),
        }}
      >
        {rewriteTutorialImagePaths(md)}
      </ReactMarkdown>

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
