import { Link, Route, Switch, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";

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

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100">
      <div className="w-full border-b-4 border-[#1f2a44] bg-[#0b1220] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden font-pixel text-xs border-2 border-[#2a3552] px-3 py-2 bg-[#0f1930] hover:bg-[#132043] transition-colors"
            onClick={() => setMobileNavOpen((v) => !v)}
            data-testid="button-sidebar-toggle"
          >
            MENU
          </button>
          <Link
            href="/blog"
            className="font-pixel text-xs md:text-sm hover:text-[hsl(48_100%_50%)] transition-colors"
            data-testid="link-back-blog"
          >
            &lt; BACK TO BLOG
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="font-pixel text-xs text-slate-300" data-testid="text-tutorial-breadcrumb">
            Noise Tutorial
          </div>
          <div className="h-4 w-[2px] bg-[#2a3552]" />
          <div className="font-mono text-sm text-slate-200" data-testid="text-chapter-title">
            {active.title}
          </div>
        </div>

        <Link
          href="/"
          className="font-pixel text-xs md:text-sm hover:text-[hsl(48_100%_50%)] transition-colors"
          data-testid="link-home"
        >
          HOME
        </Link>
      </div>

      <div className="mx-auto w-full max-w-7xl grid md:grid-cols-[320px_1fr] gap-0">
        <aside
          className={`${
            mobileNavOpen ? "block" : "hidden"
          } md:block md:sticky md:top-[68px] h-fit border-r-4 border-[#1f2a44] bg-[#0b1220]`}
        >
          <div className="p-4">
            <div className="font-pixel text-sm mb-3" data-testid="text-sidebar-title">
              Chapters
            </div>

            {sectionOrder.map((section) => {
              const items = grouped.get(section) ?? [];
              if (!items.length) return null;
              return (
                <div key={section} className="mb-4">
                  <div
                    className="font-pixel text-[11px] tracking-wide text-slate-300 mb-2"
                    data-testid={`text-section-${section.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {section.toUpperCase()}
                  </div>
                  <div className="h-[2px] bg-[#1f2a44] mb-2" />

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
                            isActive
                              ? "bg-[#132043] border-[#ffd700] text-[#ffd700]"
                              : "bg-[#0f1930] border-[#2a3552] text-slate-100 hover:bg-[#132043]"
                          } w-full text-left border-2 px-3 py-2 transition-colors`}
                          data-testid={`button-chapter-${c.id}`}
                        >
                          <div className="font-mono text-sm leading-snug">{c.title}</div>
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
          <article
            className="noise-article mx-auto w-full max-w-[800px]"
            data-testid="container-article"
          >
            <ChapterContent chapter={active} />

            <div className="mt-10 pt-6 border-t border-[#1f2a44] flex items-center justify-between gap-3">
              {prev ? (
                <Link
                  href={prev.id === "intro" ? "/noise-tutorial" : `/noise-tutorial/${prev.id}`}
                  className="inline-flex items-center gap-2 bg-[#0f1930] border-2 border-[#2a3552] px-4 py-3 hover:bg-[#132043] transition-colors"
                  data-testid="link-prev"
                >
                  <span className="font-pixel text-[10px] text-slate-300">PREV</span>
                  <span className="font-mono text-sm">{prev.title}</span>
                </Link>
              ) : (
                <div />
              )}

              {next ? (
                <Link
                  href={next.id === "intro" ? "/noise-tutorial" : `/noise-tutorial/${next.id}`}
                  className="inline-flex items-center gap-2 bg-[#ffd700] text-[#0b1220] border-2 border-[#0b1220] px-4 py-3 hover:brightness-110 transition-all"
                  data-testid="link-next"
                >
                  <span className="font-pixel text-[10px]">NEXT</span>
                  <span className="font-mono text-sm">{next.title}</span>
                </Link>
              ) : (
                <div />
              )}
            </div>
          </article>
        </main>
      </div>
    </div>
  );
}

function ChapterContent({ chapter }: { chapter: Chapter }) {
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
    <div className="noise-md" data-testid="container-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          img: ({ ...props }) => (
            <img
              {...props}
              style={{ maxWidth: "100%", height: "auto" }}
              data-testid="img-tutorial"
            />
          ),
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
        {md}
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
