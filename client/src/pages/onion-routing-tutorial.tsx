import { Link, Route, Switch, useLocation } from "wouter";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
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
import CodeExercise from "../components/CodeExercise";
import Scratchpad from "../components/Scratchpad";
import { CollapsibleItem, CollapsibleGroup } from "../components/CollapsibleSection";
import { useIsMobile } from "../hooks/use-mobile";
import { PanelStateContext, usePanelStateProvider } from "../hooks/use-panel-state";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { ONION_ROUTING_EXERCISES_DRAFT as ONION_ROUTING_EXERCISES } from "../data/onion-routing-exercises-draft";
import { getOnionRoutingDraftExerciseGroupContext as getOnionRoutingExerciseGroupContext } from "../lib/onion-routing-exercise-groups-draft";
import { PayItForward } from "./noise-tutorial";
import { Tok as MathTok } from "../components/onion-routing-draft/mathTokens";
import { GlossaryTerm } from "../components/onion-routing-draft/GlossaryTerm";
import { resolveGlossary } from "../components/onion-routing-draft/glossary";
import { KdfPipelineDiagram } from "../components/onion-routing-draft/KdfPipelineDiagram";
import { FillerTraceDiagram } from "../components/onion-routing-draft/FillerTraceDiagram";
import { ForwarderPeelDiagram } from "../components/onion-routing-draft/ForwarderPeelDiagram";
import { HmacChainDiagram } from "../components/onion-routing-draft/HmacChainDiagram";
import { WrapTraceDiagram } from "../components/onion-routing-draft/WrapTraceDiagram";
import { PeelTraceDiagram } from "../components/onion-routing-draft/PeelTraceDiagram";
import { ValidationFlowDiagram } from "../components/onion-routing-draft/ValidationFlowDiagram";
import { ErrorBoomerangDiagram } from "../components/onion-routing-draft/ErrorBoomerangDiagram";
import { ErrorUnwrapDiagram } from "../components/onion-routing-draft/ErrorUnwrapDiagram";
import { ResolutionMessagesDiagram } from "../components/onion-routing-draft/ResolutionMessagesDiagram";
import { FailureReasonsDiagram } from "../components/onion-routing-draft/FailureReasonsDiagram";
import { OnionCapstoneLab } from "../components/onion-routing-draft/OnionCapstoneLab";
import { LightningNetworkDiagram } from "../components/onion-routing-draft/LightningNetworkDiagram";
import { PlaintextMessageTear } from "../components/onion-routing-draft/PlaintextMessageTear";
import { EncryptedSliceReveal } from "../components/onion-routing-draft/EncryptedSliceReveal";
import { KnowledgeMatrix } from "../components/onion-routing-draft/KnowledgeMatrix";
import { HtlcPropagationDiagram } from "../components/onion-routing-draft/HtlcPropagationDiagram";
import { EcdhRecapDiagram } from "../components/onion-routing-draft/EcdhRecapDiagram";
import { BlindingFactorDiagram } from "../components/onion-routing-draft/BlindingFactorDiagram";
import { NaivePacketDiagram } from "../components/onion-routing-draft/NaivePacketDiagram";
import { NodeKeyAttemptDiagram } from "../components/onion-routing-draft/NodeKeyAttemptDiagram";
import { OperationsLifecycleDiagram } from "../components/onion-routing-draft/OperationsLifecycleDiagram";
import { PythonSnippet } from "../components/onion-routing-draft/PythonSnippet";
import { SpecFormula } from "../components/onion-routing-draft/SpecFormula";
import { PayloadShrinkDiagram } from "../components/onion-routing-draft/PayloadShrinkDiagram";
import { PaddingStrategyDiagram } from "../components/onion-routing-draft/PaddingStrategyDiagram";
import { XorEncryptionDemo } from "../components/onion-routing-draft/XorEncryptionDemo";
import { WrapPrimerDiagram } from "../components/onion-routing-draft/WrapPrimerDiagram";
import { PeelPrimerDiagram } from "../components/onion-routing-draft/PeelPrimerDiagram";
import { OnionPacketAnatomyDiagram, AnatomyHighlightProvider, AnatomyTerm } from "../components/onion-routing-draft/OnionPacketAnatomyDiagram";
import { RouteComparisonDiagram } from "../components/onion-routing-draft/RouteComparisonDiagram";
import { ROUTE_CALC_EXERCISE_ID } from "../components/onion-routing-draft/RouteCalcExercise";
import { CltvSafetyLab } from "../components/onion-routing-draft/CltvSafetyLab";
import { ForwarderPolicyMap } from "../components/onion-routing-draft/ForwarderPolicyMap";

// Whitelist of custom course tag names that should never be wrapped in <p>.
// CommonMark wraps custom HTML element names (which are not in the block-level
// whitelist) in <p> tags. The custom tag handlers below render React components
// that contain <div>/<svg>/etc descendants, which would produce invalid
// <p><div>...</div></p> nesting and React validateDOMNesting warnings.
const CUSTOM_BLOCK_TAGS = new Set([
  "code-intro",
  "code-outro",
  "checkpoint",
  "route-comparison",
  "kdf-pipeline",
  "payload-shrink",
  "padding-strategy",
  "forwarder-peel",
  "xor-encryption",
  "wrap-primer",
  "peel-primer",
  "onion-packet-anatomy",
  "filler-trace",
  "hmac-chain",
  "wrap-trace",
  "peel-trace",
  "validation-flow",
  "error-boomerang",
  "error-unwrap",
  "resolution-messages",
  "failure-reasons",
  "onion-capstone-lab",
  "lightning-network",
  "message-tear",
  "encrypted-slice-reveal",
  "htlc-propagation",
  "ecdh-recap",
  "blinding-factor",
  "operations-lifecycle",
  "operations-lifecycle-keyed",
  "python-snippet",
  "spec-formula",
  "cltv-safety-lab",
  "forwarder-policy-map",
  "knowledge-matrix",
  "naive-packet",
  "node-key-attempt",
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
  answer: number | number[];
  explanation: string;
}> = {
  // ── Chapter 5: Onion Routing 101 ─────────────────────────────────────────
  "cp-101-keystream-shared-draft": {
    question:
      "Why don't Alice and Bob need to send the keystream over the wire?",
    options: [
      "It's short enough to memorize and ride along in the channel handshake",
      "Each side regenerates the same keystream deterministically from the shared secret",
      "The keystream is broadcast publicly so every forwarder has a copy",
      "Alice sends it once at channel-open, then reuses it for every payment",
    ],
    answer: 1,
    explanation:
      "ChaCha20 is deterministic: same key in, same bytes out. Alice derives her keystream from the ECDH shared secret, and Bob derives his from the same secret on his end, so they land on identical bytes without ever putting them on the wire. That's what makes XOR-with-keystream work as encryption from a single shared secret.",
  },
  "cp-101-encrypt-buffer-scope-draft": {
    question:
      "When Alice encrypts a single hop's layer during onion construction, which bytes get XOR'd with that hop's keystream?",
    options: [
      "Only this hop's own slice (the hop payload Alice just wrote)",
      "All the hop-payload slices written so far, but not the leftover padding",
      "The entire 1,300-byte payload buffer (every hop payload plus all the padding)",
      "Only the packet header (version + ephemeral pubkey), not the payload",
    ],
    answer: 2,
    explanation:
      "The whole 1,300-byte buffer, every time. Each iteration XORs all of it with that hop's keystream, the payloads already written and the padding alike. That's why the layers stack: by the end, Dave's hop payload has been through three keystreams and Bob's through one, and it's why every peeling hop has to XOR the entire buffer to strip its own layer.",
  },
  "cp-101-dave-layer-count-draft": {
    question:
      "After Alice finishes building the onion, how many encryption layers cover Dave's hop payload?",
    options: [
      "1, only Dave's encryption",
      "2, Dave's and Charlie's",
      "3, Dave's, Charlie's, and Bob's",
      "0, the destination's hop payload is left in plaintext for Dave to read",
    ],
    answer: 2,
    explanation:
      "Three. Dave's hop payload is written first, so it's sitting there for every pass that follows. Alice encrypts in the order Dave → Charlie → Bob, each pass XORing the whole buffer, so Dave's payload picks up all three keystreams while Bob's, written last, gets just one. That asymmetry is what makes peeling work: Bob's single XOR strips his layer and reveals his payload, leaving the inner ones still wrapped.",
  },
  "cp-101-decrypt-buffer-scope-draft": {
    question:
      "When Bob receives the onion and XORs the buffer with his keystream during peeling, which bytes lose an encryption layer?",
    options: [
      "Only Bob's hop payload at the front",
      "Bob's hop payload and the trailing padding",
      "Every byte in the 1,300-byte buffer",
      "Only the bytes that Bob's HMAC committed to",
    ],
    answer: 2,
    explanation:
      "Every byte. Peeling mirrors building: Alice ran Bob's keystream over the whole buffer, so Bob runs the same keystream over the whole buffer to undo it. His own hop payload had just one layer, so it comes off clean and lands in plaintext; Charlie's and Dave's had two and three, so each drops to one fewer and stays encrypted. It's the exact operation Alice did on her Bob iteration, run in reverse.",
  },
  "cp-101-tamper-detection-draft": {
    question:
      "Suppose Charlie is malicious and modifies a few bytes in Dave's encrypted layer before forwarding the packet. What happens?",
    options: [
      "Dave can't decrypt his hop payload at all",
      "Dave's HMAC verification fails: dave_hmac was computed over specific bytes, and those bytes have now changed",
      "Nothing, the per-hop HMACs only protect against modifications by hostile peers, not by forwarders themselves",
      "The packet succeeds; only the on-chain settlement would catch the tampering",
    ],
    answer: 1,
    explanation:
      "Dave's HMAC verification fails. Each per-hop HMAC commits to everything beneath that hop, so `dave_hmac` was computed over Dave's encrypted layer exactly as Alice built it. Change any of those bytes and the buffer no longer matches the tag. Dave verifies before he decrypts, the check fails, and he drops the packet. That's the whole reason onion routing survives malicious forwarders: tampering anywhere below a hop is caught at that hop, before anything gets processed.",
  },
  // ── Chapter 11: The Error Onion ──────────────────────────────────────────
  "cp-error-trial-decrypt-draft": {
    question: "Alice receives a wrapped error from a 3-hop route Bob → Charlie → Dave. She tries hop 0's keys (Bob), the HMAC doesn't verify, then tries hop 1's keys (Charlie), the HMAC verifies. What does Alice's algorithm do if Charlie's keys hadn't matched either?",
    options: [
      "Restart from i=0 with a different decryption mode (CBC instead of CTR), since BOLT 4 allows fallback ciphers",
      "Continue to i=2 (Dave's keys). If no layer matches, conclude the error was tampered with and disconnect the peer",
      "Send the bytes back through the route asking each hop to peel its own layer cooperatively until one says 'this is mine'",
      "Use the failure code from a default mapping based on the wrapped bytes' length, since BOLT 4 defines a canonical fallback for unknown hops",
    ],
    answer: 1,
    explanation: "She keeps going. The algorithm is a strict trial-decrypt loop: peel with the next hop's `ammag`, check that hop's `um` HMAC, repeat. If she runs through every hop and nothing verifies, the error is garbage, some peer on the return path tampered with it or made it up. Since no one without a `um` key can forge bytes that pass any layer's HMAC, Alice can safely disconnect that peer or dock its reliability.",
  },
  // ── Chapter 10: Forwarding & Validation ──────────────────────────────────
  "cp-validate-before-decrypt-draft": {
    question: "Why does a forwarder verify the packet's HMAC tag *before* decrypting the hop_payloads with its rho keystream?",
    options: [
      "Decryption is irreversible, so if the HMAC fails after decryption the forwarder can't undo the rho XOR to retry verification",
      "Verifying first keeps untrusted bytes out of the parser and avoids generating a keystream for packets we'd reject anyway",
      "BOLT 4 mandates HMAC-first ordering for compatibility with HSM-based signing flows used by routing nodes",
      "ChaCha20 doesn't initialize correctly until an HMAC has been computed over its input, so the order is forced by the cryptographic library",
    ],
    answer: 1,
    explanation: "It's the encrypt-then-MAC discipline. Two reasons: you never want to hand tampered or malformed bytes to your parser, so if the HMAC is wrong you stop before decrypting anything; and generating a 2,600-byte ChaCha20 keystream isn't free, so there's no point spending it on a packet you're going to reject. The 32-byte tag check is cheap and gates the expensive work.",
  },
  "cp-tlv-final-vs-forward-draft": {
    question: "After peeling, the forwarder parses the bigsize-prefixed TLV records and finds types 2 (amt_to_forward), 4 (outgoing_cltv_value), and 8 (payment_data). No type 6 record is present. What should the forwarder do?",
    options: [
      "Forward the payment using a default short_channel_id of all zeros, since type 6 is optional under BOLT 4",
      "Treat itself as the destination and try to claim the HTLC against an invoice matching the payment_data",
      "Reject with invalid_onion_payload because every BOLT 4 hop payload must include a type-6 record",
      "Forward to the next hop in its peer list at random, since the absent short_channel_id signals 'best-effort delivery'",
    ],
    answer: 1,
    explanation: "Type 8 without type 6 is BOLT 4's way of telling a hop it's the destination. `short_channel_id` (type 6) is what a forwarder needs to pick an outgoing channel; with no type 6 but a `payment_data` (type 8) carrying the `payment_secret` and `total_msat`, there's nowhere to forward, so the hop matches the `payment_data` against its pending invoices and settles or fails. Defaulting to an all-zero channel would forward into nothing, and rejecting would break the protocol's own final-hop signal.",
  },
  // ── Chapter 9: Peeling a Layer ───────────────────────────────────────────
  "cp-peel-extended-stream-draft": {
    question: "When Bob peels his layer, he generates a 2,600-byte ChaCha20 keystream from his rho key (twice the routing-info size) and XORs it onto a working buffer that's the inbound 1,300-byte hop_payloads followed by 1,300 zero bytes. Why does the keystream extend past 1,300 bytes?",
    options: [
      "The extra keystream derives a backup mu key in case the primary HMAC verification fails on first attempt",
      "ChaCha20 requires a minimum of 2,600 bytes per call to operate efficiently; a smaller call falls back to AES",
      "Bob XORs the whole buffer in one pass before he reads his own payload, so he can't yet know how big it is; he sizes the keystream for the largest possible payload (twice the routing-info size) to be safe",
      "The first 1,300 bytes decrypt the inbound packet; the next 1,300 bytes encrypt Bob's outgoing packet by XOR-ing onto the next ephemeral pubkey",
    ],
    answer: 2,
    explanation: "Bob XORs the whole buffer in one pass before he's even parsed his own payload's length, so at that moment he doesn't know how big his slice is. He sizes the keystream for the largest a payload could be, twice the routing-info size, or 2,600 bytes, to stay safe. The elegant payoff: those extra bytes regenerate the exact filler Alice precomputed in chapter 7, so the next hop's HMAC still verifies. (There's no backup `mu` key, and ChaCha20 has no minimum call size.)",
  },
  "cp-peel-next-hmac-draft": {
    question: "After Bob XORs his `rho_B` keystream over the extended buffer, he parses the bigsize-prefixed TLV records at the front, then reads the 32 bytes that come right after the TLVs. What's in those 32 bytes, and where do they go in the packet Bob forwards to Charlie?",
    options: [
      "It's `bob_hmac`, the same tag Bob just verified, kept as a checksum for Bob's audit log of forwarded packets",
      "It's `charlie_hmac`, the HMAC tag Bob writes into the outer HMAC field of the packet he forwards",
      "It's an encrypted next_hmac placeholder that Bob first decrypts with `um_B` before writing it into the outgoing packet",
      "It's `E_AC`, the advanced ephemeral pubkey, derived from those bytes and placed in the next packet's header",
    ],
    answer: 1,
    explanation: "It's `charlie_hmac`. Each hop payload is laid out as `bigsize length || TLV records || next_hmac`, and during construction Alice filled that `next_hmac` field with the HMAC from her previous (inner) iteration. So the 32 bytes after Bob's TLVs are the HMAC of Charlie's layer, and Bob just lifts them straight into the outer HMAC field of the packet he forwards. That's how the chain advances one hop: Alice committed to it, Bob copies it across, and Charlie recomputes it from his own `mu` to check. No `um` involved, that's the return path.",
  },
  // ── Chapter 8: Wrapping Layer-by-Layer ───────────────────────────────────
  "cp-build-reverse-order-draft": {
    question: "Why must Alice build the onion in reverse order, starting with the destination's layer (Dave) and working outward to the first hop (Bob)?",
    options: [
      "BOLT 4 mandates reverse order for consistent hashing across implementations, but other orders would also produce a valid packet",
      "Each hop's HMAC commits to the encrypted layer beneath it, so the inner layer has to exist before the outer HMAC can be computed",
      "Reverse order minimizes ChaCha20 invocations, since each keystream can be reused across iterations when computed back-to-front",
      "Forward order would leak the hop count to a passive observer because intermediate buffers would be visible at known sizes",
    ],
    answer: 1,
    explanation: "Each hop's HMAC commits to the encrypted layer beneath it: Bob's covers Charlie's layer, Charlie's covers Dave's. To compute Bob's HMAC, Charlie's layer has to exist already; to compute Charlie's, Dave's does. So Alice builds the innermost layer first and wraps outward. Forward order is simply impossible, the outer HMAC would need bytes that haven't been created yet. It's not a spec preference, it's forced by the data dependencies.",
  },
  "cp-hmac-commits-to-draft": {
    question: "When Alice computes a per-hop HMAC during the wrap iteration, what bytes does she actually authenticate with the `mu` key?",
    options: [
      "The plaintext TLV records for this hop, before the `rho` XOR runs. The forwarder will undo the XOR first, recompute the HMAC over the plaintext, and compare.",
      "The encrypted 1,300-byte `hop_payloads` buffer at the end of this iteration, concatenated with the 32-byte `associated_data` (`payment_hash`).",
      "The encrypted `hop_payloads` buffer alone, without any associated data. Tying the HMAC to the `payment_hash` would couple the onion to a specific HTLC and prevent legitimate retries.",
      "The shared secret <m>ss_i</m> between Alice and this hop, plus the encrypted buffer. The shared secret acts as both the HMAC key and the associated data.",
    ],
    answer: 1,
    explanation: "The encrypted 1,300-byte `hop_payloads` buffer, plus the 32-byte `associated_data` (the `payment_hash`). Two things matter here. First, the HMAC covers the encrypted bytes, not the plaintext, that's encrypt-then-MAC, so a forwarder checks integrity before decrypting anything. Second, mixing in the `payment_hash` binds the onion to one specific HTLC: capture an in-flight onion and you can't re-attach it to a different payment, since the new `payment_hash` would change the HMAC and the first hop would reject it. Legitimate retries are unaffected, Alice just builds a fresh onion.",
  },
  // ── Chapter 7: Filler Construction ───────────────────────────────────────
  "cp-filler-shared-keystream-draft": {
    question: "Alice's filler is just bytes she precomputes herself, before the payment is ever sent, that turn out to be <em>exactly</em> what Bob's peel produces at the back of his forwarded packet. How is this possible?",
    options: [
      "Alice runs Bob's exact code on her side, simulating every byte he will touch in advance",
      "Alice and Bob derive the same <code>rho_B</code> keystream from <code>ss_AB</code>, so same key + same zeros + same XOR = same result",
      "The filler bytes are always zeros, so any forwarder would produce identical bytes at the back",
      "Bob uses a deterministic random number generator with a public seed that Alice can replicate",
    ],
    answer: 1,
    explanation: "Alice and Bob share the ECDH secret <code>ss_AB</code>, so they derive the same <code>rho_B</code> key and generate the same ChaCha20 keystream. The filler isn't Alice hiding anything, it's Alice recreating the exact bytes Bob will produce when he XORs his keystream over his extended buffer. Same key, same zeros, same XOR, same result. Without the shared secret she'd have to literally run Bob's code; with it, she just runs the same primitive locally.",
  },
  "cp-filler-reach-back-draft": {
    question: "In step 3 of the filler algorithm, Alice XORs the <strong>last <code>s_B + s_C</code> bytes</strong> of Charlie's <code>rho</code> keystream into the filler, not just the last <code>s_C</code>. The <code>s_B + s_C</code>-byte slice overlaps Charlie's regular 1,300-byte keystream region by <code>s_B</code> bytes. Why is this overlap necessary?",
    options: [
      "Without it, Charlie's keystream wouldn't cover the full 1,300-byte <code>hop_payloads</code> field plus the trailing extension",
      "The overlap compensates for an off-by-one error in Python's negative slice indexing that would otherwise misalign by one byte",
      "Bob's filler bytes sit at those <code>s_B</code> positions when Charlie peels, so Charlie's XOR has to stack his layer onto Bob's bytes too",
      "The overlap is what authenticates Charlie's HMAC; without it, HMAC verification would fail at Charlie",
    ],
    answer: 2,
    explanation: "When Charlie peels, he XORs his <code>rho_C</code> keystream over the <em>entire</em> extended buffer, including the spots where Bob's filler bytes already sit. So Alice has to bake Charlie's keystream into those same positions ahead of time, otherwise Charlie's XOR scrambles Bob's bytes and the forwarded buffer no longer matches the HMAC Alice computed. The overlap doesn't lengthen the keystream, it just changes where Alice slices, so her filler accounts for Charlie's layer landing on top of Bob's.",
  },
  // ── Chapter 7: The Fixed-Size Packet & Filler ────────────────────────────
  "cp-payload-shrink-leak-draft": {
    question: "Charlie is a middle forwarder in this 3-hop route. He receives a 246-byte packet, smaller than the 306 bytes Alice originally constructed but larger than what Dave will eventually see. From the byte count alone, what is Charlie able to infer that he shouldn't? Select all that apply.",
    options: [
      "The number of hops remaining downstream of him, based on how much buffer is left",
      "The number of hops upstream of him (how many forwarders have already peeled the packet)",
      "The total amount being forwarded across the route, from the smaller buffer he received",
      "The sender's identity, recovered from the packet header's leading public key bytes",
    ],
    answer: [0],
    explanation: "Only the first one. A shrinking onion forwards whatever's left after each peel, so Charlie's leftover bytes are his own payload plus everything still bound for hops after him. The more route that remains, the bigger that leftover, so he can count the hops downstream. He can't count the hops behind him, though: the bytes Bob already peeled are simply gone, with no length field to subtract from. A 246-byte packet is byte-for-byte identical whether one forwarder came before Charlie or Alice built him a two-hop route directly, so size can't reveal which. The amount and Alice's identity both ride encrypted inside the hop payloads, so neither shifts the byte count. The rule: leftover size leaks how far you are from the destination, never from the sender, and Sphinx kills the leak by padding every packet to a fixed 1,366 bytes.",
  },
  // ── Chapter 6: Key Derivation ────────────────────────────────────────────
  "cp-key-separation-draft": {
    question: "Imagine BOLT 4 used each hop's shared secret directly as the key for all five operations, instead of deriving five separate keys from it. Which of the following are real problems with that approach? Select all that apply.",
    options: [
      "Encryption (stream cipher) and authentication (MAC) are different cryptographic primitives. The standard security proofs (e.g., Bellare and Namprempre's Encrypt-then-MAC analysis) assume their keys are independent; reusing one key for both falls outside the proven envelope.",
      "Both forward and backward encryption use ChaCha20 with an all-zero nonce. If they shared a key, both directions would produce ciphertexts under the same keystream, and an attacker observing both could XOR them together to recover plaintext (the classic two-time-pad break).",
      "A forwarder who legitimately verified the forward HMAC would already hold the key needed to author a fake error packet that Alice would accept as authentic, since forward and backward authentication would use the same key.",
      "With one shared key, the packet's compression ratio would push the buffer below the BOLT 4 minimum of 1,300 bytes, letting passive observers infer route length from the byte count and de-anonymizing the sender across payments.",
    ],
    answer: [0, 1, 2],
    explanation: "The first three are all real, and together they're why BOLT 4 derives five separate keys per shared secret. Reusing one key for both encryption and authentication falls outside the security proofs, which assume the keys are independent. Worse, both encryption directions use ChaCha20 with an all-zero nonce, so one shared key means the same keystream both ways, and an attacker can XOR the two ciphertexts to recover plaintext (a two-time pad). And a forwarder that legitimately learned the forward HMAC key could reuse it to forge return errors Alice would trust. The fourth is the distractor: the 1,300-byte size comes from the packet format, not the keying.",
  },
  "cp-key-domain-separation-draft": {
    question: "Imagine an attacker recovers Bob's `rho` key (the ChaCha20 stream cipher key for the forward path). What does this let them do, and why doesn't it cascade to Bob's other per-hop keys?",
    options: [
      "They can derive Bob's `mu`, `um`, and `ammag` because all four per-hop keys share a single seed; recovering one breaks them all",
      "They can decrypt Bob's hop payload area, but they can't derive `mu`, `um`, or `ammag` without also obtaining <m>ss_AB</m>",
      "They cannot do anything: `rho` is only used by Alice during construction, so a forwarder never possesses it",
      "They can forge the packet HMAC because `rho` is XORed with `mu` inside the protocol, making the two functionally equivalent",
    ],
    answer: 1,
    explanation: "They can decrypt Bob's hop payload, but it stops there. Each key is `HMAC-SHA256(label, shared_secret)` under a different label, and HMAC is a pseudorandom function, so one output tells you nothing about the others unless you also hold the shared secret <m>ss_AB</m>. Recovering `rho` only breaks the forward stream cipher, bad enough on its own, but it doesn't let them forge HMACs (`mu`) or touch the return path (`um`, `ammag`). That's the point of domain separation: a leak stays boxed into its own role. (The fifth key, `pad`, comes from Alice's session key, not a per-hop secret, so a forwarder couldn't recover it anyway.)",
  },
  // ── Chapter 4: Shared Secrets per Hop ────────────────────────────────────
  "cp-naive-shared-secrets-draft": {
    question: "The fresh-keypair-per-hop design fixes the sender-identity leak (there's no node-identity key sitting in the packet anymore), but it pays a price elsewhere that scales with the route length. Select all the real costs of this design.",
    options: [
      "The packet has to carry one ephemeral pubkey per hop, consuming bytes that would otherwise be available for the hop payloads.",
      "Each shared secret is statistically predictable because Alice can only generate a limited amount of randomness per payment.",
      "Alice has to keep one private key per hop in memory, since errors come back encrypted with those same shared secrets.",
      "Any forwarder that learns its own ephemeral pubkey can use it to recover Alice's other ephemeral private keys from the packet.",
    ],
    answer: [0, 2],
    explanation:
      "The first and third options, and both costs grow with the route. In this naive design Alice ships one ephemeral pubkey per hop in the packet (33 bytes apiece), so the longer the route, the more packet space goes to keys instead of the actual hop payloads. On top of that, Alice has to keep one private key per hop in memory for the whole payment, since errors come back encrypted under those same shared secrets and she needs the keys to read them. The other two are distractors: ECDH shared secrets are uniformly random, not predictable, and the discrete log problem keeps each ephemeral private key safe even though its pubkey is public. Both real costs collapse to one in the next section, where a single key chain replaces the whole pile.",
  },
  "cp-blinding-public-draft": {
    question: "Bob has derived <m>ss_AB</m> and computed <m>bf_AB</m>. He's about to forward the onion to Charlie. Which of the following best describes what Bob does to the ephemeral key field in the outgoing packet, and why Charlie ends up deriving the same <m>ss_AC</m> Alice precomputed?",
    options: [
      "Bob appends <m>E_AC</m> after <m>E_AB</m>, so Charlie can scan for his own key. It works because Charlie tries each pubkey until ECDH yields a value that decrypts his slice.",
      "Bob replaces <m>E_AB</m> with <m>E_AC</m> (computed as <m>bf_AB</m> · <m>E_AB</m>). Charlie ECDHs against <m>E_AC</m> and lands on the same <m>ss_AC</m> Alice precomputed.",
      "Bob signs <m>E_AC</m> with his node private key and embeds the signature in the packet. Charlie verifies it against `bob_pubkey` before trusting <m>E_AC</m>.",
      "Bob leaves <m>E_AB</m> in the field; Charlie derives <m>E_AC</m> himself by recomputing the chain from his own position in the route using gossip data.",
    ],
    answer: 1,
    explanation:
      "Bob replaces the ephemeral key in the header with <m>E_AC</m> = <m>bf_AB</m> · <m>E_AB</m>. Alice's chain produced that same <m>E_AC</m> (she advanced her scalar <m>e_AB</m> by <m>bf_AB</m>, and <m>e_AC</m> · <m>G</m> equals <m>bf_AB</m> · <m>E_AB</m>), so the two sides reach the same point from opposite directions. Charlie then ECDHs his node private key against <m>E_AC</m> and recovers the same <m>ss_AC</m> Alice precomputed, because scalar multiplication commutes. Appending keys instead would bloat the packet and bring back the size leak; there's no signature involved; and Charlie can't recompute the chain himself, since that needs <m>bf_AB</m>, hence <m>ss_AB</m>, hence Bob's private key.",
  },
  // ── Chapter 2: Pathfinding 101 ───────────────────────────────────────────
  "cp-channel-update-direction-draft": {
    question: "At any given moment, a single payment channel between two nodes can have up to two `channel_update`s live on the gossip network at once. Why does a single channel produce two separate `channel_update`s?",
    options: [
      "Both sides cosign one shared `channel_update` at channel open, then re-sign it together whenever policy changes, producing two versions over the channel's lifetime.",
      "Each direction of the channel has its own forwarding policy, and each side publishes the `channel_update` for the direction it owns.",
      "One advertises the channel's existence, the other advertises its capacity. Both are required for the channel to be valid on the gossip network.",
      "The protocol mandates a redundant second update so peers can verify the channel is online, and each node publishes one to confirm its presence.",
    ],
    answer: 1,
    explanation: "Forwarding policy is per-direction: the Alice to Bob direction can charge different fees and set a different `cltv_expiry_delta` than Bob to Alice, so each direction needs its own `channel_update`. Each node publishes the update for the direction it forwards in, and can refresh it anytime with a newer timestamp (latest wins). A node that never forwards a given direction, like a pure receiver, publishes nothing for it, which is why hovering a receiver on the graph above shows no outgoing `channel_update`.",
  },
  "cp-cheapest-route-draft": {
    question: "You've now computed all three routes. Alice wants the lowest fee, but her wallet enforces `max_total_cltv_expiry_delta = 200`. Which route should she send through?",
    options: [
      "Route A: direct via Hazel. It's the cheapest on fees, and a single forwarder is the simplest path.",
      "Route B: through Frank and Greg. The most expensive route, but well within the CLTV ceiling.",
      "Route C: through Bob and Charlie. The cheapest route that also fits under the CLTV ceiling.",
      "Either Route B or Route C. Once Route A is filtered out, picking between the survivors is a judgment call.",
    ],
    answer: 2,
    explanation: "Route C. The trick is filter first, then minimize. Route A looks cheapest at 900 sats, but Hazel's `cltv_expiry_delta` of 1,000 pushes the total CLTV to 1,018 blocks, way past Alice's 200-block ceiling, so her wallet won't lock funds that long and Route A is out before fees matter. That leaves Route B (60 blocks, 2,002 sats) and Route C (73 blocks, 1,225 sats), both under the ceiling, so the cheaper one wins. That's what real pathfinders do: apply the hard constraints, then optimize over what survives. And Route C is the same path from chapter 1: Alice → Bob → Charlie → Dave.",
  },
  // ── Intro: Naive plaintext routing leak (Draft) ──────────────────────────
  "cp-naive-plaintext-leak-draft": {
    question: "Look at the animation above. Alice's first `update_add_htlc` to Bob carries every hop's instructions in plaintext. When the message reaches Bob, which of the following does Bob learn?",
    options: [
      "Just his own slice: he should forward 10,002 sat to Charlie with outgoing CLTV at block 220",
      "His slice plus the next hop's slice (Charlie's), but nothing about Dave's portion of the route",
      "Every slice: his own forwarding instructions, Charlie's, and Dave's, including the final payment hash",
      "Nothing useful, since the bytes are signed by Alice and only the final hop can verify the signature",
    ],
    answer: 2,
    explanation: "Every slice. With the whole route sitting in plaintext, Bob, and anyone watching the wire into Bob, can read it end to end: that Alice is the sender, Dave is the final recipient, what each hop forwards, even the payment hash. What we want is for Bob to learn only his own job (forward this amount to Charlie at this CLTV) and nothing else. That's what the rest of the course builds toward.",
  },
  // ── Chapter 3: The Privacy Problem ───────────────────────────────────────
  "cp-still-vulnerable-draft": {
    question: "Per-hop encryption hides the contents of each slice, but the route still isn't fully private. What can an eavesdropper still figure out?",
    options: [
      "The encrypted slices look identical from the outside, so Bob can't tell which slice is his to decrypt.",
      "The packet shrinks at each hop as forwarders peel their slices off, so anyone watching can count the slices in the message at each step and figure out which hop is at which position in the route.",
      "Public-key encryption is too computationally expensive for low-power wallets to perform per-hop, so the design doesn't scale.",
    ],
    answer: 1,
    explanation: "The **packet still shrinks**. Each forwarder peels its slice and passes a smaller message on, so the size at each hop leaks position: a 3-slice message tells Bob at least two hops are still ahead of him, and a 2-slice message tells Charlie he's the last forwarder before the destination. That alone breaks the property that a forwarder shouldn't know where it sits in the route. Sphinx fixes it with a **fixed-size packet** that never changes length. (Identical-looking ciphertext is good encryption, not a leak, and per-hop public-key cost isn't the real issue.)",
  },
};

type Chapter = {
  id: string;
  title: string;
  section:
    | "Foundations"
    | "Cryptography"
    | "Building the Packet"
    | "Forwarding"
    | "Failures"
    | "Capstone"
    | "Pay It Forward";
  kind: "intro" | "md";
  file?: string;
};

export const chapters: Chapter[] = [
  {
    id: "a-lightning-payment",
    title: "Lightning Payments Overview",
    section: "Foundations",
    kind: "md",
    file: "/onion_routing_tutorial/1.0-a-lightning-payment.md",
  },
  {
    id: "pathfinding-101",
    title: "Pathfinding 101",
    section: "Foundations",
    kind: "md",
    file: "/onion_routing_tutorial/2.0-pathfinding-101.md",
  },
  {
    id: "privacy-problem",
    title: "The Privacy Problem",
    section: "Foundations",
    kind: "md",
    file: "/onion_routing_tutorial/3.0-the-privacy-problem.md",
  },
  {
    id: "shared-secrets",
    title: "Shared Secrets per Hop",
    section: "Cryptography",
    kind: "md",
    file: "/onion_routing_tutorial/4.0-shared-secrets.md",
  },
  {
    id: "onion-routing-101",
    title: "Onion Routing 101",
    section: "Cryptography",
    kind: "md",
    file: "/onion_routing_tutorial/5.0-onion-routing-101.md",
  },
  {
    id: "key-derivation",
    title: "Key Derivation",
    section: "Cryptography",
    kind: "md",
    file: "/onion_routing_tutorial/6.0-key-derivation.md",
  },
  {
    id: "fixed-size-and-filler",
    title: "The Fixed-Size Packet",
    section: "Building the Packet",
    kind: "md",
    file: "/onion_routing_tutorial/7.0-fixed-size-and-filler.md",
  },
  {
    id: "wrapping-layer-by-layer",
    title: "Wrapping Layer by Layer",
    section: "Building the Packet",
    kind: "md",
    file: "/onion_routing_tutorial/8.0-wrapping.md",
  },
  {
    id: "peeling-a-layer",
    title: "Peeling a Layer",
    section: "Forwarding",
    kind: "md",
    file: "/onion_routing_tutorial/9.0-peeling.md",
  },
  {
    id: "forwarding-validation",
    title: "Forwarding & Validation",
    section: "Forwarding",
    kind: "md",
    file: "/onion_routing_tutorial/10.0-forwarding-validation.md",
  },
  {
    id: "error-onion",
    title: "The Error Onion",
    section: "Failures",
    kind: "md",
    file: "/onion_routing_tutorial/11.0-error-onion.md",
  },
  {
    id: "capstone-success",
    title: "Capstone: Successful Payment",
    section: "Capstone",
    kind: "md",
    file: "/onion_routing_tutorial/12.0-capstone-success.md",
  },
  {
    id: "pay-it-forward",
    title: "Pay It Forward",
    section: "Pay It Forward",
    kind: "md",
    file: "/onion_routing_tutorial/15.0-pay-it-forward.md",
  },
];

// Global chapter number (1-based) keyed by id, matching the file order
// (1.0 … 15.0). Rendered as a muted prefix on each sidebar title.
const chapterNumber: Record<string, number> = Object.fromEntries(
  chapters.map((c, i) => [c.id, i + 1]),
);

export const sectionOrder: Chapter["section"][] = [
  "Foundations",
  "Cryptography",
  "Building the Packet",
  "Forwarding",
  "Failures",
  "Capstone",
  "Pay It Forward",
];

export const CHAPTER_REQUIREMENTS: Record<string, {
  checkpoints: string[];
  exercises: string[];
}> = {
  "a-lightning-payment": { checkpoints: [], exercises: [] },
  "pathfinding-101": { checkpoints: ["cp-channel-update-direction-draft", "cp-cheapest-route-draft"], exercises: ["exercise-route-calc-draft"] },
  "privacy-problem": { checkpoints: ["cp-naive-plaintext-leak-draft", "km-privacy-rubric-draft", "cp-still-vulnerable-draft"], exercises: [] },
  "shared-secrets": { checkpoints: ["cp-naive-shared-secrets-draft", "cp-blinding-public-draft"], exercises: ["exercise-derive-shared-secrets-draft"] },
  "onion-routing-101": {
    checkpoints: [
      "cp-101-keystream-shared-draft",
      "cp-101-encrypt-buffer-scope-draft",
      "cp-101-dave-layer-count-draft",
      "cp-101-decrypt-buffer-scope-draft",
      "cp-101-tamper-detection-draft",
    ],
    exercises: [],
  },
  "key-derivation": { checkpoints: ["cp-key-separation-draft", "cp-key-domain-separation-draft"], exercises: ["exercise-derive-keys-draft"] },
  "fixed-size-and-filler": { checkpoints: ["cp-payload-shrink-leak-draft", "cp-filler-shared-keystream-draft", "cp-filler-reach-back-draft"], exercises: ["exercise-generate-filler-draft"] },
  "wrapping-layer-by-layer": { checkpoints: ["cp-build-reverse-order-draft", "cp-hmac-commits-to-draft"], exercises: ["exercise-wrap-hop-draft", "exercise-build-packet-draft"] },
  "peeling-a-layer": { checkpoints: ["cp-peel-extended-stream-draft", "cp-peel-next-hmac-draft"], exercises: ["exercise-peel-layer-draft"] },
  "forwarding-validation": { checkpoints: ["cp-validate-before-decrypt-draft", "cp-tlv-final-vs-forward-draft"], exercises: ["exercise-verify-hmac-draft", "exercise-check-forward-draft"] },
  "error-onion": { checkpoints: ["cp-error-trial-decrypt-draft"], exercises: ["exercise-decrypt-error-onion-draft"] },
  "capstone-success": { checkpoints: [], exercises: [] },
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
        result[chapter.id] = getProgress(`onion-chapter-read-draft:${chapter.id}`) === "1"
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

// Per-exercise reference diagrams, surfaced via the popup icon next to "SEND
// TO SANDBOX" so students can consult the relevant visual while coding.
const EXERCISE_REFERENCE_DIAGRAMS: Record<string, ReactNode> = {
  "exercise-derive-shared-secrets-draft": <BlindingFactorDiagram />,
};

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
      <AnatomyHighlightProvider>
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
          code: ({ className, children, ...props }: any) => {
            // Auto-link backticked glossary terms (pad_key, rho_i, ss_AX, ...).
            // Pills that open a definition get a gold wash so "hoverable" is
            // visible at a glance; plain pills keep the neutral background.
            const text = String(
              Array.isArray(children) ? children.join("") : children ?? ""
            );
            const hit = resolveGlossary(text) !== null;
            const codeEl = (
              <code
                className={`${className ?? ""} rounded px-1 py-0.5 ${hit ? "" : theme === "dark" ? "bg-white/10" : "bg-black/[0.03]"}`}
                style={
                  hit
                    ? {
                        background:
                          theme === "dark"
                            ? "rgba(255,215,0,0.13)"
                            : "rgba(184,134,11,0.11)",
                      }
                    : undefined
                }
                {...props}
              >
                {children}
              </code>
            );
            return hit ? (
              <GlossaryTerm term={text}>{codeEl}</GlossaryTerm>
            ) : (
              codeEl
            );
          },
          // Inline math token: <m>e_AB</m> renders e<sub>AB</sub> with proper
          // math typography (italic single-letter base + true subscripts).
          // Multi-letter bases (ss, bf) stay upright per math convention.
          // Used for math expressions in chapter prose.
          m: ({ children }: any) => {
            const tok = String(
              Array.isArray(children) ? children.join("") : children ?? ""
            );
            // weight 500 (not the default 700): prose math reads lighter and
            // the subscripts (ss_AB, E_AC) are easier to make out.
            const mathEl = <MathTok token={tok} weight={500} />;
            // Make subscripted math symbols glossary-aware too (ss_AB, E_AC, rho_B).
            // `wash` adds the gold tint here (math tokens have no pill of their own).
            return resolveGlossary(tok) ? (
              <GlossaryTerm term={tok} wash>
                {mathEl}
              </GlossaryTerm>
            ) : (
              mathEl
            );
          },
          // Inline term that cross-highlights the onion-packet-anatomy diagram
          // on hover: <anatomy-term region="header|payload|hmac">…</anatomy-term>
          "anatomy-term": ({ region, children }: any) => (
            <AnatomyTerm region={region}>{children}</AnatomyTerm>
          ),
          // Inline glossary term for prose words that aren't backticked:
          // <g>filler</g>, <g>HMAC</g>, <g>session key</g>. Hover shows the
          // definition; non-glossary text renders untouched.
          g: ({ children }: any) => {
            const text = String(
              Array.isArray(children) ? children.join("") : children ?? ""
            );
            return (
              <GlossaryTerm term={text} wash>
                {children}
              </GlossaryTerm>
            );
          },
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
                storageKey={`pl-collapse-cp-draft-${cpId}`}
                anchorId={`item-${cpId}`}
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
                    storageKey={`pl-collapse-ex-draft-${ex.id}`}
                    anchorId={`item-${ex.id}`}
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
                      referenceDiagram={EXERCISE_REFERENCE_DIAGRAMS[ex.id]}
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
                  storageKey={`pl-collapse-group-draft-${ids.join("-")}`}
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
                        storageKey={`pl-collapse-ex-draft-${ex.id}`}
                        anchorId={`item-${ex.id}`}
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
                          referenceDiagram={EXERCISE_REFERENCE_DIAGRAMS[ex.id]}
                        />
                      </CollapsibleItem>
                    );
                  })}
                </CollapsibleGroup>
              </div>
            );
          },
          "route-comparison": () => {
            const ex =
              completedCheckpoints.find(
                (c) => c.checkpointId === ROUTE_CALC_EXERCISE_ID,
              ) || null;
            return (
              <div
                id={`item-${ROUTE_CALC_EXERCISE_ID}`}
                style={{ scrollMarginTop: 90 }}
              >
                <RouteComparisonDiagram
                  reward={{
                    theme,
                    authenticated,
                    sessionToken,
                    lightningAddress,
                    emailVerified,
                    pubkey,
                    alreadyCompleted: !!ex,
                    claimInfo: ex,
                    onLoginRequest,
                    onCompleted: onCheckpointCompleted,
                  }}
                />
              </div>
            );
          },
          "kdf-pipeline": () => {
            return <KdfPipelineDiagram />;
          },
          "payload-shrink": () => {
            return <PayloadShrinkDiagram />;
          },
          "padding-strategy": () => {
            return <PaddingStrategyDiagram />;
          },
          "forwarder-peel": () => {
            return <ForwarderPeelDiagram />;
          },
          "xor-encryption": () => {
            return <XorEncryptionDemo />;
          },
          "wrap-primer": () => {
            return <WrapPrimerDiagram />;
          },
          "peel-primer": () => {
            return <PeelPrimerDiagram />;
          },
          "onion-packet-anatomy": () => {
            return <OnionPacketAnatomyDiagram />;
          },
          "filler-trace": () => {
            return <FillerTraceDiagram />;
          },
          "hmac-chain": () => {
            return <HmacChainDiagram />;
          },
          "wrap-trace": () => {
            return <WrapTraceDiagram />;
          },
          "peel-trace": () => {
            return <PeelTraceDiagram />;
          },
          "validation-flow": () => {
            return <ValidationFlowDiagram />;
          },
          "error-boomerang": () => {
            return <ErrorBoomerangDiagram />;
          },
          "error-unwrap": () => {
            return <ErrorUnwrapDiagram />;
          },
          "resolution-messages": () => {
            return <ResolutionMessagesDiagram />;
          },
          "failure-reasons": () => {
            return <FailureReasonsDiagram />;
          },
          "onion-capstone-lab": ({ demo }: any) => {
            return <OnionCapstoneLab demo={demo !== undefined} dark={theme === "dark"} />;
          },
          "lightning-network": () => {
            return <LightningNetworkDiagram />;
          },
          "message-tear": () => {
            return <PlaintextMessageTear />;
          },
          "encrypted-slice-reveal": () => {
            return <EncryptedSliceReveal />;
          },
          "htlc-propagation": () => {
            return <HtlcPropagationDiagram />;
          },
          "ecdh-recap": () => {
            return <EcdhRecapDiagram />;
          },
          "blinding-factor": () => {
            return <BlindingFactorDiagram />;
          },
          "naive-packet": () => {
            return <NaivePacketDiagram />;
          },
          "node-key-attempt": () => {
            return <NodeKeyAttemptDiagram />;
          },
          "operations-lifecycle": () => {
            return <OperationsLifecycleDiagram />;
          },
          "operations-lifecycle-keyed": () => {
            return <OperationsLifecycleDiagram showKeys />;
          },
          "python-snippet": ({ id }: any) => {
            return <PythonSnippet id={id} dark={theme === "dark"} />;
          },
          "spec-formula": ({ source, children }: any) => {
            return <SpecFormula source={source}>{children}</SpecFormula>;
          },
          "cltv-safety-lab": () => {
            return <CltvSafetyLab />;
          },
          "forwarder-policy-map": () => {
            return <ForwarderPolicyMap />;
          },
          "knowledge-matrix": () => {
            const kmId = "km-privacy-rubric-draft";
            const isCompleted = completedCheckpoints.some(c => c.checkpointId === kmId);
            return (
              <div id={`item-${kmId}`} style={{ scrollMarginTop: 90 }}>
              <KnowledgeMatrix
                checkpointId={kmId}
                theme={theme}
                authenticated={authenticated}
                sessionToken={sessionToken}
                lightningAddress={lightningAddress}
                emailVerified={emailVerified}
                pubkey={pubkey}
                alreadyCompleted={isCompleted}
                claimInfo={completedCheckpoints.find(c => c.checkpointId === kmId) || null}
                onLoginRequest={onLoginRequest}
                onCompleted={onCheckpointCompleted}
              />
              </div>
            );
          },
          "code-outro": ({ text }: any) => {
            return <p className="mt-4 opacity-80">{text}</p>;
          },
        } as any}
      >
        {rewriteTutorialImagePaths(md)}
      </ReactMarkdown>
      </AnatomyHighlightProvider>

      {(() => {
        const reqs = CHAPTER_REQUIREMENTS[chapter.id];
        const isReadOnly = reqs && reqs.checkpoints.length === 0 && reqs.exercises.length === 0;
        if (!isReadOnly || chapter.id === "quiz" || chapter.id === "pay-it-forward") return null;
        const isMarkedRead = getProgress(`onion-chapter-read-draft:${chapter.id}`) === "1";

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
              saveProgress(`onion-chapter-read-draft:${chapter.id}`, "1", true);
              onCheckpointCompleted(`onion-chapter-read-draft:${chapter.id}`);
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

function OnionRoutingDraftTutorialShell({ activeId }: { activeId: string }) {
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

  // ── Deep-link from the sidebar's checkpoint/exercise badges ──────────────────
  // Clicking a "?" or "</>" badge jumps to that specific item, opening it and
  // scrolling it into view, even when it lives in a different chapter.
  const pendingScrollRef = useRef<string | null>(null);

  const scrollToAnchor = useCallback((anchorId: string) => {
    // The target renders asynchronously (markdown fetch + collapsible mount), so
    // poll until it exists, then scroll. setTimeout (not requestAnimationFrame)
    // so it keeps firing even if the tab is briefly backgrounded.
    let tries = 0;
    const tick = () => {
      const el = document.getElementById(anchorId);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      if (tries++ < 60) setTimeout(tick, 50);
    };
    tick();
  }, []);

  const goToItem = useCallback((chapterId: string, itemId: string, kind: "checkpoint" | "exercise") => {
    // Pre-open the target collapsible: write its storage key (so it mounts open
    // after a cross-chapter navigation) AND fire an event (so an already-mounted
    // item on the current chapter opens immediately).
    const openKey = (key: string) => {
      try { localStorage.setItem(key, "1"); } catch {}
      window.dispatchEvent(new CustomEvent("collapse-open", { detail: key }));
    };
    if (kind === "checkpoint") {
      openKey(`pl-collapse-cp-draft-${itemId}`);
    } else {
      openKey(`pl-collapse-ex-draft-${itemId}`);
      const exs = CHAPTER_REQUIREMENTS[chapterId]?.exercises ?? [];
      if (exs.length > 1) openKey(`pl-collapse-group-draft-${exs.join("-")}`);
    }
    setMobileNavOpen(false);
    const anchorId = `item-${itemId}`;
    if (chapterId === activeId) {
      scrollToAnchor(anchorId);
    } else {
      pendingScrollRef.current = anchorId;
      setLocation(chapterId === "intro" ? "/onion-routing-tutorial" : `/onion-routing-tutorial/${chapterId}`);
    }
  }, [activeId, setLocation, scrollToAnchor]);

  // Resolve a pending cross-chapter jump once the new chapter's content mounts.
  useEffect(() => {
    if (pendingScrollRef.current) {
      const anchorId = pendingScrollRef.current;
      pendingScrollRef.current = null;
      scrollToAnchor(anchorId);
    }
  }, [activeId, scrollToAnchor]);

  // Save current chapter for "Continue Where You Left Off" on home page
  useEffect(() => {
    try { localStorage.setItem("pl-onion-last-chapter-draft", activeId); } catch {}
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

  // Scratchpad / side-panel state. Mirrors noise-tutorial wiring so the
  // "Send to Sandbox" button on each exercise opens the scratchpad with
  // the exercise's sample code (CodeExercise dispatches a custom event the
  // Scratchpad listens for).
  const panelState = usePanelStateProvider();
  const panelPadding = isMobile
    ? 0
    : panelState.activePanel
      ? panelState.panelWidth
      : 0;
  const panelTransition = panelState.isDragging
    ? "none"
    : "padding-right 300ms cubic-bezier(0.4, 0, 0.2, 1)";

  // Seed the scratchpad with code relevant to the current chapter's exercises,
  // so opening the sandbox on a given chapter pre-populates chapter-specific
  // content (the first exercise's sampleCode) instead of the generic example.
  const chapterSampleCode = useMemo(() => {
    const ids = CHAPTER_REQUIREMENTS[active.id]?.exercises ?? [];
    for (const id of ids) {
      const s = ONION_ROUTING_EXERCISES[id]?.sampleCode;
      if (s) return s;
    }
    return undefined;
  }, [active.id]);

  return (
    <PanelStateContext.Provider value={panelState}>
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

      <div style={{ paddingRight: panelPadding, transition: panelTransition }}>
      <div
        className="mx-auto w-full max-w-7xl grid gap-0"
        style={{
          gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : (sidebarCollapsed ? `60px minmax(0, 1fr)` : `360px minmax(0, 1fr)`),
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
          } md:relative md:block md:sticky md:top-[68px] md:w-auto md:z-auto md:shadow-none md:h-[calc(100vh_-_68px)] md:overflow-y-auto md:overscroll-contain ${theme === "dark" ? "bg-[#0b1220]" : "bg-card"}`}
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
                      <span className={`text-[11px] font-pixel ${completedInSection === totalInSection ? (theme === "dark" ? "text-[#FFD700]" : "text-[#b8860b]") : "opacity-50"}`}>
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
                        // Per-chapter badges: one "?" per quiz question, one
                        // "</>" per coding exercise (matches the Noise course).
                        const reqs = CHAPTER_REQUIREMENTS[c.id];
                        const hasBadges =
                          !!reqs && (reqs.checkpoints.length > 0 || reqs.exercises.length > 0);
                        const badgeCompleted = new Set(
                          auth.completedCheckpoints.map((cp) => cp.checkpointId),
                        );
                        const badgeDim = theme === "dark" ? "text-slate-600" : "text-foreground/25";
                        const badgeLit = theme === "dark" ? "text-[#FFD700]" : "text-[#b8860b]";
                        const badgeTooltipClass = `font-pixel text-sm px-3 py-1.5 border-2 rounded-none ${
                          theme === "dark"
                            ? "bg-[#0f1930] text-slate-200 border-[#2a3552]"
                            : "bg-card text-foreground border-border pixel-shadow"
                        }`;
                        return (
                          <div
                            key={c.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setLocation(href)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLocation(href); } }}
                            className={`${
                              isActive ? t.chapterActive : t.chapterInactive
                            } w-full text-left border-2 px-3 py-1.5 transition-colors cursor-pointer`}
                            data-testid={`button-chapter-${c.id}`}
                          >
                            <div className="flex items-center gap-2">
                              {showIcon && (
                                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-base font-extrabold leading-none ${
                                  isComplete
                                    ? theme === "dark"
                                      ? "bg-[#FFD700] text-white"
                                      : "bg-[#b8860b] text-white"
                                    : theme === "dark" ? "border-2 border-[#2a3552]" : "border-2 border-border"
                                }`}>
                                  {isComplete && "\u2713"}
                                </span>
                              )}
                              <div className="flex-1 min-w-0 text-[16px] leading-snug" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', paddingLeft: "2.4em", textIndent: "-2.4em" }}>
                                <span
                                  style={{ display: "inline-block", minWidth: "1.4em", textAlign: "right", opacity: 0.45, fontVariantNumeric: "tabular-nums" }}
                                >
                                  {chapterNumber[c.id]}
                                </span>
                                <span style={{ opacity: 0.3, margin: "0 0.4em" }}>·</span>
                                {c.title}
                              </div>
                            </div>
                            {hasBadges && (
                              <div className="flex items-center justify-end gap-1.5" style={{ marginTop: "3px" }}>
                                {reqs!.checkpoints.map((cpId) => (
                                    <Tooltip key={cpId} delayDuration={200}>
                                      <TooltipTrigger asChild>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); goToItem(c.id, cpId, "checkpoint"); }} className={`font-pixel text-[13px] leading-none cursor-pointer ${badgeCompleted.has(cpId) ? badgeLit : badgeDim}`}>?</button>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className={badgeTooltipClass}>
                                        {badgeCompleted.has(cpId) ? "Jump to quiz (complete)" : "Jump to quiz"}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                  {reqs!.exercises.map((exId) => (
                                    <Tooltip key={exId} delayDuration={200}>
                                      <TooltipTrigger asChild>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); goToItem(c.id, exId, "exercise"); }} className={`font-mono leading-none font-bold cursor-pointer ${exId === ROUTE_CALC_EXERCISE_ID ? "text-[15px]" : "text-[13px]"} ${badgeCompleted.has(exId) ? badgeLit : badgeDim}`}>{exId === ROUTE_CALC_EXERCISE_ID ? "Σ" : "</>"}</button>
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom" className={badgeTooltipClass}>
                                        {badgeCompleted.has(exId) ? "Jump to exercise (complete)" : "Jump to exercise"}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              )}
                          </div>
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
            {active.section === "Pay It Forward" ? (
              <PayItForward theme={theme} />
            ) : (
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
            )}

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
      </div>

      {/* Scratchpad button: floating on the right edge of the header,
          slides with the panel padding so it never hides behind the open
          panel. Hidden on small screens where the panel doesn't fit. */}
      <div
        className={`fixed top-[78px] z-40 hidden lg:block border-2 rounded ${
          theme === "dark"
            ? "bg-[#0b1220] border-[#2a3552]"
            : "bg-[#fdf9f2] border-[#d4c9a8]"
        }`}
        style={{
          right: panelPadding + 16,
          transition: panelTransition,
          padding: "8px 10px",
        }}
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
            style={{
              boxShadow:
                theme === "dark"
                  ? "3px 3px 0 rgba(255,215,0,0.15)"
                  : "3px 3px 0 rgba(0,0,0,0.08)",
            }}
          >
            Open the Python scratchpad to experiment with code and test inputs from exercises
          </TooltipContent>
        </Tooltip>
      </div>

      <Scratchpad theme={theme} courseKey="onion-routing" chapterKey={active.id} chapterDefaultCode={chapterSampleCode} />

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

export default function OnionRoutingTutorialDraftPage() {
  return (
    <Switch>
      <Route path="/onion-routing-tutorial">
        <OnionRoutingDraftTutorialShell activeId="intro" />
      </Route>
      <Route path="/onion-routing-tutorial/:chapterId">
        {(params) => {
          const id = params?.chapterId ?? "intro";
          const exists = chapters.some((c) => c.id === id);
          return <OnionRoutingDraftTutorialShell activeId={exists ? id : "intro"} />;
        }}
      </Route>
    </Switch>
  );
}
