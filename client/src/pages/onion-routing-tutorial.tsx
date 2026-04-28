import { Link, Route, Switch, useLocation } from "wouter";
import { useEffect, useLayoutEffect, useMemo, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { useAuth } from "../hooks/use-auth";
import { useProgress } from "../hooks/use-progress";
import LoginModal from "../components/LoginModal";
import ProfileDropdown from "../components/ProfileDropdown";
import FeedbackWidget from "../components/FeedbackWidget";
import CheckpointQuestion from "../components/CheckpointQuestion";
import CheckpointGroup from "../components/CheckpointGroup";
import CodeExercise from "../components/CodeExercise";
import { CollapsibleItem, CollapsibleGroup } from "../components/CollapsibleSection";
import { useIsMobile } from "../hooks/use-mobile";
import { ONION_ROUTING_EXERCISES } from "../data/onion-routing-exercises";
import { getOnionRoutingExerciseGroupContext } from "../lib/onion-routing-exercise-groups";
import { NetworkTopologyDiagram } from "../components/onion-routing/NetworkTopologyDiagram";

// Whitelist of custom course tag names that should never be wrapped in <p>.
// CommonMark wraps custom HTML element names (which are not in the block-level
// whitelist) in <p> tags. The custom tag handlers below render React components
// that contain <div>/<svg>/etc descendants, which would produce invalid
// <p><div>...</div></p> nesting and React validateDOMNesting warnings.
const CUSTOM_BLOCK_TAGS = new Set([
  "code-intro",
  "code-outro",
  "checkpoint",
  "checkpoint-group",
  "network-topology",
]);

function rehypeUnwrapCustomBlockTags() {
  return (tree: any) => {
    const visit = (node: any) => {
      if (!node.children) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
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
// Each chapter that has checkpoints adds entries here as it's built.
export const CHECKPOINT_QUESTIONS: Record<string, {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}> = {
  // ── Chapter 2: Anatomy of a Route ────────────────────────────────────────
  "cp-fees-backward": {
    question: "In our worked example, Carol's incoming amount is 10,002 sats and Bob's incoming amount is 10,003 sats. Why must Alice work backward from Dave's amount when she computes each hop's input?",
    options: [
      "The Lightning spec defines a strict reverse processing order, and Alice's calculation has to follow that ordering to be valid",
      "Each hop's required input depends on its output, and the only fixed point in the chain is the final amount Dave receives. Working forward would leave the math undefined",
      "Timelocks can only be subtracted, not added, so the calculation has to start from the highest CLTV and work down",
      "Each hop only knows what it forwards, not what it receives, so Alice has to reconstruct the input direction by simulating from the destination",
    ],
    answer: 1,
    explanation: "Bob's required incoming amount = his outgoing amount + his fee. His outgoing amount is whatever Carol receives. Carol's incoming amount = her outgoing amount + her fee. Her outgoing amount is whatever Dave receives. So the chain depends on Dave's amount being known first, then propagating backward. If Alice tried to start from her own number (say, 'I have 10,003 sats to spend'), she'd have no way to determine how much each hop should keep as a fee without already knowing the downstream amounts. The same applies to CLTVs: each hop's incoming CLTV must outlast its outgoing one by the hop's CLTV delta, and the only fixed CLTV is the one Dave specifies in his invoice.",
  },
  "cp-intermediate-vs-final": {
    question: "Dave receives a hop payload that's missing one specific TLV field that Bob and Carol's payloads contain. Which field, and what does its absence tell Dave?",
    options: [
      "outgoing_cltv_value (type 4) is missing, signaling that the HTLC has already been settled",
      "amt_to_forward (type 2) is missing, signaling that there is nothing left to forward",
      "short_channel_id (type 6) is missing, signaling that there is no next hop and Dave is the final destination",
      "payment_data (type 8) is missing from intermediate hops because they aren't allowed to read invoice metadata",
    ],
    answer: 2,
    explanation: "An intermediate hop's payload contains a type-6 short_channel_id record telling it which channel to forward over. The final hop has no next hop to forward to, so Alice doesn't include type 6 in its payload. When Dave parses his payload and sees no type 6, he knows immediately that the payment terminates with him. Conversely, type 8 (payment_data) appears only in the final hop's payload, since only the final hop validates against the invoice. The structure of the TLV does the work of signaling 'you're the destination' without any explicit flag.",
  },
  // ── Chapter 1: The Privacy Problem ───────────────────────────────────────
  "cp-privacy-property": {
    question: "Bob is forwarding a Lightning payment from Alice → Bob → Carol → Dave. Which of the following does Bob learn as part of forwarding the payment?",
    options: [
      "That Alice is the original sender, since the packet had to come from somewhere",
      "That the next hop is Carol, plus the amount and timelock he should forward to her",
      "That Dave is the final destination, because the inner payload tells him the payment terminates",
      "The total number of hops in the route, because a fixed-size packet implies a known maximum",
    ],
    answer: 1,
    explanation: "Bob only learns what he needs to do his job: the next hop is Carol, the amount to forward, and the outgoing timelock. He has no way to tell whether the packet originated with Alice or was forwarded to him from someone before her, and he has no way to tell whether Carol forwards onward or terminates the payment. The 'sender' Bob sees is just whichever node delivered the bytes to him on the wire (Alice in this case), not the payment originator. Likewise, the 'destination' from Bob's perspective is Carol, not Dave. The packet's fixed size hides the total hop count entirely.",
  },
};

type Chapter = {
  id: string;
  title: string;
  section:
    | "Introduction"
    | "Foundations"
    | "Cryptography"
    | "Building the Packet"
    | "Forwarding"
    | "Failures"
    | "Capstone"
    | "Beyond"
    | "Pay It Forward";
  kind: "intro" | "md";
  file?: string;
};

export const chapters: Chapter[] = [
  {
    id: "intro",
    title: "Onion Routing & Lightning Payments",
    section: "Introduction",
    kind: "intro",
  },
  {
    id: "privacy-problem",
    title: "The Privacy Problem",
    section: "Foundations",
    kind: "md",
    file: "/onion_routing_tutorial/1.0-privacy-problem.md",
  },
  {
    id: "anatomy-of-a-route",
    title: "Anatomy of a Route",
    section: "Foundations",
    kind: "md",
    file: "/onion_routing_tutorial/2.0-anatomy-of-a-route.md",
  },
  {
    id: "shared-secrets",
    title: "Shared Secrets per Hop",
    section: "Cryptography",
    kind: "md",
    file: "/onion_routing_tutorial/3.0-shared-secrets.md",
  },
  {
    id: "key-derivation",
    title: "Key Derivation",
    section: "Cryptography",
    kind: "md",
    file: "/onion_routing_tutorial/4.0-key-derivation.md",
  },
  {
    id: "fixed-size-packet",
    title: "The Fixed-Size Packet",
    section: "Building the Packet",
    kind: "md",
    file: "/onion_routing_tutorial/5.0-fixed-size-packet.md",
  },
  {
    id: "filler-construction",
    title: "Filler Construction",
    section: "Building the Packet",
    kind: "md",
    file: "/onion_routing_tutorial/6.0-filler-construction.md",
  },
  {
    id: "wrapping-layer-by-layer",
    title: "Wrapping Layer by Layer",
    section: "Building the Packet",
    kind: "md",
    file: "/onion_routing_tutorial/7.0-wrapping.md",
  },
  {
    id: "peeling-a-layer",
    title: "Peeling a Layer",
    section: "Forwarding",
    kind: "md",
    file: "/onion_routing_tutorial/8.0-peeling.md",
  },
  {
    id: "forwarding-validation",
    title: "Forwarding & Validation",
    section: "Forwarding",
    kind: "md",
    file: "/onion_routing_tutorial/9.0-forwarding-validation.md",
  },
  {
    id: "error-onion",
    title: "The Error Onion",
    section: "Failures",
    kind: "md",
    file: "/onion_routing_tutorial/10.0-error-onion.md",
  },
  {
    id: "capstone-success",
    title: "Capstone: Successful Payment",
    section: "Capstone",
    kind: "md",
    file: "/onion_routing_tutorial/11.0-capstone-success.md",
  },
  {
    id: "capstone-failure",
    title: "Capstone: Failure Path",
    section: "Capstone",
    kind: "md",
    file: "/onion_routing_tutorial/12.0-capstone-failure.md",
  },
  {
    id: "beyond-sphinx",
    title: "Beyond Sphinx",
    section: "Beyond",
    kind: "md",
    file: "/onion_routing_tutorial/13.0-beyond-sphinx.md",
  },
  {
    id: "pay-it-forward",
    title: "Pay It Forward",
    section: "Pay It Forward",
    kind: "md",
    file: "/onion_routing_tutorial/14.0-pay-it-forward.md",
  },
];

export const sectionOrder: Chapter["section"][] = [
  "Introduction",
  "Foundations",
  "Cryptography",
  "Building the Packet",
  "Forwarding",
  "Failures",
  "Capstone",
  "Beyond",
  "Pay It Forward",
];

export const CHAPTER_REQUIREMENTS: Record<string, {
  checkpoints: string[];
  exercises: string[];
}> = {
  "intro": { checkpoints: [], exercises: [] },
  "privacy-problem": { checkpoints: ["cp-privacy-property"], exercises: [] },
  "anatomy-of-a-route": { checkpoints: ["cp-fees-backward", "cp-intermediate-vs-final"], exercises: [] },
  "shared-secrets": { checkpoints: [], exercises: [] },
  "key-derivation": { checkpoints: [], exercises: [] },
  "fixed-size-packet": { checkpoints: [], exercises: [] },
  "filler-construction": { checkpoints: [], exercises: [] },
  "wrapping-layer-by-layer": { checkpoints: [], exercises: [] },
  "peeling-a-layer": { checkpoints: [], exercises: [] },
  "forwarding-validation": { checkpoints: [], exercises: [] },
  "error-onion": { checkpoints: [], exercises: [] },
  "capstone-success": { checkpoints: [], exercises: [] },
  "capstone-failure": { checkpoints: [], exercises: [] },
  "beyond-sphinx": { checkpoints: [], exercises: [] },
  "pay-it-forward": { checkpoints: [], exercises: [] },
};

function useChapterCompletion(
  completedCheckpoints: { checkpointId: string }[],
  getProgress: (key: string) => string | null,
  rewardClaimed: boolean,
): Record<string, "complete" | "incomplete"> {
  return useMemo(() => {
    const result: Record<string, "complete" | "incomplete"> = {};
    const completedIds = new Set(completedCheckpoints.map(c => c.checkpointId));

    for (const chapter of chapters) {
      const reqs = CHAPTER_REQUIREMENTS[chapter.id];
      if (!reqs) { result[chapter.id] = "incomplete"; continue; }

      const checkpoints = reqs.checkpoints;
      const exercises = reqs.exercises;
      const isReadOnly = checkpoints.length === 0 && exercises.length === 0;

      if (chapter.id === "quiz") {
        result[chapter.id] = rewardClaimed ? "complete" : "incomplete";
      } else if (chapter.id === "pay-it-forward") {
        result[chapter.id] = "incomplete";
      } else if (isReadOnly) {
        result[chapter.id] = getProgress(`onion-chapter-read:${chapter.id}`) === "1"
          ? "complete" : "incomplete";
      } else {
        const allCheckpointsDone = checkpoints.every(id => completedIds.has(id));
        const allExercisesDone = exercises.every(id => completedIds.has(id));
        result[chapter.id] = (allCheckpointsDone && allExercisesDone)
          ? "complete" : "incomplete";
      }
    }
    return result;
  }, [completedCheckpoints, getProgress, rewardClaimed]);
}

function idxOf(id: string) {
  return Math.max(0, chapters.findIndex((c) => c.id === id));
}

function introMarkdown() {
  return `# Onion Routing & Lightning Payments

Lightning lets you send a payment to anyone on the network, even when you don't share a channel with them. The payment hops across other people's channels to get there.

That sounds straightforward until you ask the privacy question. If your payment travels through three other nodes on the way to its destination, what does each of those nodes learn? Do they see who you're paying? How much? Whether they're the first hop, the last hop, or somewhere in the middle?

The answer is: surprisingly little. Each forwarder learns just enough to do its job (which channel to forward on, how much to forward, when the timelock expires) and nothing more. They don't see who started the payment. They don't know who finishes it. They can't even tell where they sit in the route.

That trick is called **onion routing**. It's the same family of techniques Tor uses to hide who's browsing what, adapted for Lightning payments. Each hop's instructions are wrapped inside an encrypted layer that only that hop can open, and each layer hides everything behind it.

In this course, we'll build the whole thing from scratch. We'll start with the privacy properties we want, then work through the cryptography that delivers them, construct a real BOLT 4 onion packet byte-by-byte, peel it from a forwarder's perspective, handle errors when something goes wrong, and finally send a real onion through a live test network where you'll watch each hop unwrap your work in real time.

By the end, you'll have written a Sphinx packet builder and a forwarder that the Lightning spec authors would recognize. Let's get started.

> ### ⚡ Earn sats as you learn! ⚡
>
> This tutorial rewards you with real bitcoin for completing checkpoint quizzes and coding exercises. Sign in first, then click the profile icon in the top-right to set up a Lightning Address for automatic payouts.`;
}

function ChapterContent({
  chapter,
  theme,
  authenticated,
  sessionToken,
  completedCheckpoints,
  lightningAddress,
  emailVerified,
  pubkey,
  onLoginRequest,
  onCheckpointCompleted,
  getProgress,
  saveProgress,
}: {
  chapter: Chapter;
  theme: "light" | "dark";
  authenticated: boolean;
  sessionToken: string | null;
  completedCheckpoints: { checkpointId: string; amountSats: number; paidAt: string }[];
  lightningAddress: string | null;
  emailVerified: boolean;
  pubkey: string | null;
  onLoginRequest: () => void;
  onCheckpointCompleted: (id: string, amountSats?: number) => void;
  getProgress: (key: string) => string | null;
  saveProgress: (key: string, value: string, immediate?: boolean) => void;
}) {
  const [md, setMd] = useState<string>("Loading\u2026");
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
            "Couldn't load this chapter. If you're on a deployed URL, make sure the markdown files are included under client/public/onion_routing_tutorial/."
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
      .replaceAll('src="./tutorial_images/', 'src="/onion_routing_tutorial/tutorial_images/')
      .replaceAll("src='./tutorial_images/", "src='/onion_routing_tutorial/tutorial_images/");
  };

  if (err) {
    return (
      <div
        className={`border-2 p-4 ${theme === "dark" ? "bg-[#0f1930] border-[#2a3552]" : "bg-card border-border"}`}
        data-testid="status-chapter-error"
      >
        <div className={`font-pixel text-sm mb-2 ${theme === "dark" ? "text-[#ffd700]" : "text-foreground"}`}>LOAD ERROR</div>
        <div className={`font-mono text-sm ${theme === "dark" ? "text-slate-200" : "text-foreground"}`}>{err}</div>
      </div>
    );
  }

  // Intro pages use the simple inline markdownToHtml renderer.
  // Use the same noise-md CSS class as markdown chapters so headings, paragraphs,
  // and blockquotes render with the project's tutorial typography (the project
  // does not include @tailwindcss/typography, so `prose` would be a no-op).
  if (chapter.kind === "intro") {
    return (
      <div
        className={`noise-md noise-md-${theme}`}
        dangerouslySetInnerHTML={{ __html: markdownToHtml(md) }}
      />
    );
  }

  // Markdown chapters use the full ReactMarkdown pipeline
  return (
    <div className={`noise-md noise-md-${theme}`} data-testid="container-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeUnwrapCustomBlockTags, rehypeHighlight]}
        components={{
          img: ({ style, width, height, ...props }: any) => {
            const rawSrc = String(props.src ?? "");
            return (
              <img
                {...props}
                src={rawSrc}
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  ...style,
                }}
                loading="lazy"
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
          "code-intro": ({ heading, description, exercises: exerciseIds }: any) => {
            const ids = String(exerciseIds || "").split(",").map((s: string) => s.trim()).filter(Boolean);
            const exerciseList = ids
              .map((exId: string) => ({ id: exId, data: ONION_ROUTING_EXERCISES[exId] }))
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

            // Single exercise
            if (exerciseList.length === 1) {
              const ex = exerciseList[0];
              const isCompleted = completedCheckpoints.some(c => c.checkpointId === ex.id);
              const ctx = getOnionRoutingExerciseGroupContext(ex.id);
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
                        starterCode: ONION_ROUTING_EXERCISES[cg.id]?.starterCode ?? "",
                      }))}
                      classMethodExercises={ctx?.classMethodExercises.map(cm => ({
                        id: cm.id,
                        starterCode: ONION_ROUTING_EXERCISES[cm.id]?.starterCode ?? "",
                      }))}
                      priorInGroupExercises={ctx?.priorInGroupExercises.map(pe => ({
                        id: pe.id,
                        starterCode: ONION_ROUTING_EXERCISES[pe.id]?.starterCode ?? "",
                      }))}
                      futureExercises={ctx?.futureExercises.map(fe => ({
                        id: fe.id,
                        starterCode: ONION_ROUTING_EXERCISES[fe.id]?.starterCode ?? "",
                      }))}
                      tutorialType="onion-routing"
                    />
                  </CollapsibleItem>
                </div>
              );
            }

            // Multiple exercises
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
                    const ctx = getOnionRoutingExerciseGroupContext(ex.id);
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
                            starterCode: ONION_ROUTING_EXERCISES[cg.id]?.starterCode ?? "",
                          }))}
                          classMethodExercises={ctx?.classMethodExercises.map(cm => ({
                            id: cm.id,
                            starterCode: ONION_ROUTING_EXERCISES[cm.id]?.starterCode ?? "",
                          }))}
                          priorInGroupExercises={ctx?.priorInGroupExercises.map(pe => ({
                            id: pe.id,
                            starterCode: ONION_ROUTING_EXERCISES[pe.id]?.starterCode ?? "",
                          }))}
                          futureExercises={ctx?.futureExercises.map(fe => ({
                            id: fe.id,
                            starterCode: ONION_ROUTING_EXERCISES[fe.id]?.starterCode ?? "",
                          }))}
                          tutorialType="onion-routing"
                        />
                      </CollapsibleItem>
                    );
                  })}
                </CollapsibleGroup>
              </div>
            );
          },
          "network-topology": () => {
            return <NetworkTopologyDiagram />;
          },
          "code-outro": ({ text }: any) => {
            return <p className="mt-4 opacity-80">{text}</p>;
          },
          "code-exercise": () => {
            // Individual code-exercise tags are handled by code-intro
            return null;
          },
        } as any}
      >
        {rewriteTutorialImagePaths(md)}
      </ReactMarkdown>

      {(() => {
        const reqs = CHAPTER_REQUIREMENTS[chapter.id];
        const isReadOnly = reqs && reqs.checkpoints.length === 0 && reqs.exercises.length === 0;
        if (!isReadOnly || chapter.id === "quiz" || chapter.id === "pay-it-forward") return null;
        const isMarkedRead = getProgress(`onion-chapter-read:${chapter.id}`) === "1";

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
              saveProgress(`onion-chapter-read:${chapter.id}`, "1", true);
              onCheckpointCompleted(`onion-chapter-read:${chapter.id}`);
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

function OnionRoutingTutorialShell({ activeId }: { activeId: string }) {
  const [location, setLocation] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const auth = useAuth();
  const { authenticated, loading: authLoading, logout, loginWithToken, setLightningAddress } = auth;
  const progress = useProgress(auth.sessionToken);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const chapterCompletion = useChapterCompletion(
    auth.completedCheckpoints,
    progress.getProgress,
    auth.rewardClaimed,
  );

  const activeIndex = idxOf(activeId);
  const active = chapters[activeIndex] ?? chapters[0];
  const prev = chapters[activeIndex - 1];
  const next = chapters[activeIndex + 1];

  // Save current chapter for "Continue Where You Left Off" on home page
  useEffect(() => {
    try { localStorage.setItem("pl-onion-last-chapter", activeId); } catch {}
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

  return (
    <div
      className={`min-h-screen ${t.pageBg} ${t.pageText}`}
      data-theme={theme}
    >
      <div className={`w-full border-b-4 ${t.headerBorder} ${t.headerBg} px-2 py-2 md:px-4 md:py-3 flex items-center justify-between sticky top-0 z-50`}>
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
            Onion Routing Tutorial
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
        className="mx-auto w-full max-w-7xl grid gap-0"
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
          } md:relative md:block md:sticky md:top-[68px] md:w-auto md:z-auto md:shadow-none md:h-fit ${theme === "dark" ? "bg-[#0b1220]" : "bg-card"}`}
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
              const items = grouped.get(section) ?? [];
              const trackableItems = items.filter(c => c.id !== "pay-it-forward");
              const completedInSection = trackableItems.filter(c => chapterCompletion[c.id] === "complete").length;
              const totalInSection = trackableItems.length;
              return (
                <div key={section} className="mb-4">
                  <div
                    className={`font-pixel text-[14px] tracking-wide mb-2 flex items-center gap-2 ${theme === "dark" ? "text-slate-300" : "text-foreground/70"}`}
                    data-testid={`text-section-${section.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {section.toUpperCase()}
                    {totalInSection > 0 && (
                      <span className={`text-[11px] font-pixel ${completedInSection === totalInSection ? (theme === "dark" ? "text-green-400" : "text-green-600") : "opacity-50"}`}>
                        {completedInSection}/{totalInSection}
                      </span>
                    )}
                  </div>
                  <div className={`h-[2px] ${theme === "dark" ? "bg-[#1f2a44]" : "bg-border"} mb-2`} />

                  {items.length > 0 ? (
                    <nav className="grid gap-1">
                      {items.map((c) => {
                        const href = c.id === "intro" ? "/onion-routing-tutorial" : `/onion-routing-tutorial/${c.id}`;
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
                                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-base font-extrabold leading-none ${
                                  isComplete
                                    ? theme === "dark"
                                      ? "bg-green-500 text-white"
                                      : "bg-green-600 text-white"
                                    : theme === "dark" ? "border-2 border-[#2a3552]" : "border-2 border-border"
                                }`}>
                                  {isComplete && "\u2713"}
                                </span>
                              )}
                              <div className="flex-1 min-w-0 text-[16px] leading-snug" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>{c.title}</div>
                            </div>
                          </button>
                        );
                      })}
                    </nav>
                  ) : (
                    <div className={`text-[13px] italic px-1 ${theme === "dark" ? "text-slate-500" : "text-foreground/40"}`}
                      style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                    >
                      Coming soon
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <main className="p-3 sm:p-5 md:p-10">
          <div className="mx-auto w-full max-w-[1200px]">
          <article
            className="onion-article mx-auto w-full max-w-[1100px]"
            data-testid="container-article"
          >
            <ChapterContent
              chapter={active}
              theme={theme}
              authenticated={authenticated}
              sessionToken={auth.sessionToken}
              completedCheckpoints={auth.completedCheckpoints}
              lightningAddress={auth.lightningAddress}
              emailVerified={auth.emailVerified}
              pubkey={auth.pubkey}
              onLoginRequest={() => setShowLoginModal(true)}
              onCheckpointCompleted={stableMarkCompleted}
              getProgress={progress.getProgress}
              saveProgress={progress.saveProgress}
            />

            <div className={`mt-10 pt-6 border-t ${theme === "dark" ? "border-[#1f2a44]" : "border-border"} flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3`}>
              {prev ? (
                <Link
                  href={prev.id === "intro" ? "/onion-routing-tutorial" : `/onion-routing-tutorial/${prev.id}`}
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
                  href={next.id === "intro" ? "/onion-routing-tutorial" : `/onion-routing-tutorial/${next.id}`}
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
  );
}

/**
 * Minimal markdown-to-HTML for the intro placeholder.
 * Handles headings, bold, paragraphs, blockquotes, and line breaks.
 */
function markdownToHtml(md: string): string {
  return md
    .split("\n\n")
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      // Headings
      if (block.startsWith("# ")) return `<h1>${inline(block.slice(2))}</h1>`;
      if (block.startsWith("## ")) return `<h2>${inline(block.slice(3))}</h2>`;
      if (block.startsWith("### ")) return `<h3>${inline(block.slice(4))}</h3>`;
      // Blockquote
      if (block.startsWith(">")) {
        const lines = block.split("\n").map((l) => l.replace(/^>\s?/, "")).join("\n");
        return `<blockquote>${markdownToHtml(lines)}</blockquote>`;
      }
      return `<p>${inline(block)}</p>`;
    })
    .join("\n");
}

function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export default function OnionRoutingTutorialPage() {
  return (
    <Switch>
      <Route path="/onion-routing-tutorial">
        <OnionRoutingTutorialShell activeId="intro" />
      </Route>
      <Route path="/onion-routing-tutorial/:chapterId">
        {(params) => {
          const id = params?.chapterId ?? "intro";
          const exists = chapters.some((c) => c.id === id);
          return <OnionRoutingTutorialShell activeId={exists ? id : "intro"} />;
        }}
      </Route>
    </Switch>
  );
}
