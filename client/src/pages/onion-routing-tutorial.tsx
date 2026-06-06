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
import Scratchpad from "../components/Scratchpad";
import { CollapsibleItem, CollapsibleGroup } from "../components/CollapsibleSection";
import { useIsMobile } from "../hooks/use-mobile";
import { PanelStateContext, usePanelStateProvider } from "../hooks/use-panel-state";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { ONION_ROUTING_EXERCISES_DRAFT as ONION_ROUTING_EXERCISES } from "../data/onion-routing-exercises-draft";
import { getOnionRoutingDraftExerciseGroupContext as getOnionRoutingExerciseGroupContext } from "../lib/onion-routing-exercise-groups-draft";
import { Tok as MathTok } from "../components/onion-routing-draft/mathTokens";
import { NetworkTopologyDiagram } from "../components/onion-routing-draft/NetworkTopologyDiagram";
import { NaiveVsOnionDiagram } from "../components/onion-routing-draft/NaiveVsOnionDiagram";
import { EcdhChainDiagram } from "../components/onion-routing-draft/EcdhChainDiagram";
import { KdfPipelineDiagram } from "../components/onion-routing-draft/KdfPipelineDiagram";
import { FillerTraceDiagram } from "../components/onion-routing-draft/FillerTraceDiagram";
import { ForwarderPeelDiagram } from "../components/onion-routing-draft/ForwarderPeelDiagram";
import { HmacChainDiagram } from "../components/onion-routing-draft/HmacChainDiagram";
import { WrapTraceDiagram } from "../components/onion-routing-draft/WrapTraceDiagram";
import { PeelTraceDiagram } from "../components/onion-routing-draft/PeelTraceDiagram";
import { OnionPeelDiagram } from "../components/onion-routing-draft/OnionPeelDiagram";
import { ValidationFlowDiagram } from "../components/onion-routing-draft/ValidationFlowDiagram";
import { ErrorBoomerangDiagram } from "../components/onion-routing-draft/ErrorBoomerangDiagram";
import { ErrorUnwrapDiagram } from "../components/onion-routing-draft/ErrorUnwrapDiagram";
import { OnionCapstonePanel } from "../components/onion-routing-draft/OnionCapstonePanel";
import { LightningNetworkDiagram } from "../components/onion-routing-draft/LightningNetworkDiagram";
import { PlaintextMessageTear } from "../components/onion-routing-draft/PlaintextMessageTear";
import { EncryptedSliceReveal } from "../components/onion-routing-draft/EncryptedSliceReveal";
import { KnowledgeMatrix } from "../components/onion-routing-draft/KnowledgeMatrix";
import { HtlcPropagationDiagram } from "../components/onion-routing-draft/HtlcPropagationDiagram";
import { EcdhRecapDiagram } from "../components/onion-routing-draft/EcdhRecapDiagram";
import { BlindingFactorDiagram } from "../components/onion-routing-draft/BlindingFactorDiagram";
import { SharedSecretSymmetryDiagram } from "../components/onion-routing-draft/SharedSecretSymmetryDiagram";
import { NaivePacketDiagram } from "../components/onion-routing-draft/NaivePacketDiagram";
import { SharedSecretsRecapDiagram } from "../components/onion-routing-draft/SharedSecretsRecapDiagram";
import { NodeKeyAttemptDiagram } from "../components/onion-routing-draft/NodeKeyAttemptDiagram";
import { HmacRecapDiagram } from "../components/onion-routing-draft/HmacRecapDiagram";
import { FiveKeysJobsDiagram } from "../components/onion-routing-draft/FiveKeysJobsDiagram";
import { PerHopKeyMatrixDiagram } from "../components/onion-routing-draft/PerHopKeyMatrixDiagram";
import { PacketJobsPreviewDiagram } from "../components/onion-routing-draft/PacketJobsPreviewDiagram";
import { SlicesRecapDiagram } from "../components/onion-routing-draft/SlicesRecapDiagram";
import { SliceInPacketDiagram } from "../components/onion-routing-draft/SliceInPacketDiagram";
import { KeyOperationsDiagram } from "../components/onion-routing-draft/KeyOperationsDiagram";
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
  "checkpoint-group",
  "network-topology",
  "route-comparison",
  "naive-vs-onion",
  "ecdh-chain",
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
  "onion-peel",
  "validation-flow",
  "error-boomerang",
  "error-unwrap",
  "onion-capstone",
  "lightning-network",
  "message-tear",
  "encrypted-slice-reveal",
  "htlc-propagation",
  "ecdh-recap",
  "blinding-factor",
  "shared-secret-symmetry",
  "hmac-recap",
  "five-keys-jobs",
  "per-hop-key-matrix",
  "packet-jobs-preview",
  "slices-recap",
  "slice-in-packet",
  "key-operations",
  "operations-lifecycle",
  "operations-lifecycle-keyed",
  "python-snippet",
  "spec-formula",
  "cltv-safety-lab",
  "forwarder-policy-map",
  "knowledge-matrix",
  "naive-packet",
  "shared-secrets-recap",
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
      "ChaCha20 is a deterministic stream cipher: feed it the same key and you get the same output every time. Alice derives her keystream from the shared secret she computed via ECDH; Bob derives his from the same shared secret on his end. They produce the exact same bytes without ever having to transmit them. That's the whole reason XOR-with-keystream works as bidirectional encryption from a single shared secret.",
  },
  "cp-101-encrypt-buffer-scope-draft": {
    question:
      "When Alice encrypts a single hop's layer during onion construction, which bytes get XOR'd with that hop's keystream?",
    options: [
      "Only the hop payload Alice just wrote for that hop",
      "Only the hop payloads, not the surrounding padding",
      "The entire 1,300-byte payload buffer",
      "Just the packet header (version + ephemeral pubkey)",
    ],
    answer: 2,
    explanation:
      "Each iteration's encryption XORs the WHOLE 1,300-byte buffer with the hop's keystream, hop payloads that were already written, the hop payload Alice just wrote, and the padding alike. That's why the layers stack: by the end of construction, Dave's hop payload has been XOR'd by Dave's, then Charlie's, then Bob's keystream (3 layers); Bob's hop payload has only been XOR'd by Bob's keystream (1 layer). It also explains why each peel hop has to XOR the entire buffer to remove their layer.",
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
      "Dave's hop payload is written first (innermost), so it's present for every subsequent encryption pass. Alice's iteration order is Dave → Charlie → Bob, and each iteration XORs the entire buffer with that hop's keystream. So Dave's hop payload picks up rho_dave, then rho_charlie, then rho_bob, three layers. Bob's hop payload, written last, only gets one layer. That asymmetry is what makes peeling work: Bob's XOR removes one layer from everything, leaving Bob's hop payload in plaintext and the inner hop payloads still encrypted by 2 and 1 layers respectively.",
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
      "Decryption mirrors encryption exactly. Alice applied Bob's keystream to the whole buffer during construction; Bob has to apply the same keystream to the whole buffer to undo it. Bob's hop payload had only one encryption layer (Bob's), so it comes off completely and his hop payload is now plaintext. Charlie's and Dave's hop payloads had two and three layers respectively; each loses one, leaving them still encrypted. The padding loses one layer too. This symmetry is what makes Sphinx work: every hop runs the exact same operation Alice did during their iteration of the build.",
  },
  "cp-101-destination-signal-draft": {
    question:
      "How does each forwarder know whether they're a relay (forward the packet) or the destination (claim the payment)?",
    options: [
      "They check a 'destination' flag bit in the packet header",
      "They count the remaining payload bytes and compare to a known route length",
      "After decrypting their hop payload, they check whether the hop payload's HMAC field is 32 zero bytes",
      "They look themselves up in the network gossip graph and see if any further channels exist on the route",
    ],
    answer: 2,
    explanation:
      "Every hop payload ends with a 32-byte HMAC field. For relay hops, this field contains the next hop's HMAC (charlie_hmac in Bob's hop payload, dave_hmac in Charlie's). For the destination, Alice fills the field with all zeros, there is no next hop to commit to. So each hop's algorithm is: decrypt my hop payload, read the HMAC field; if it's all zeros, I'm the destination and I claim the payment. Otherwise the field is the outer HMAC for the next forwarder, so I shift the buffer left by my hop payload size and forward it.",
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
      "Each per-hop HMAC commits to everything beneath it in the onion: the hop payload, the inner-hop HMAC field, and all the encrypted layers underneath. dave_hmac was computed by Alice over Dave's encrypted layer at construction time. If Charlie tampers with any of those bytes, the modified buffer no longer matches dave_hmac. When Charlie forwards the packet to Dave, Dave runs HMAC verification first, and it fails. Dave drops the packet. This is exactly why the per-hop HMACs make onion routing safe even when intermediate hops are malicious: any tampering anywhere below a hop's hop payload is detected at that hop and the packet never gets processed.",
  },
  // ── Chapter 11: The Error Onion ──────────────────────────────────────────
  "cp-error-trial-decrypt-draft": {
    question: "Alice receives a wrapped error from a 3-hop route Bob → Carol → Dave. She tries hop 0's keys (Bob), the HMAC doesn't verify, then tries hop 1's keys (Carol), the HMAC verifies. What does Alice's algorithm do if Carol's keys hadn't matched either?",
    options: [
      "Restart from i=0 with a different decryption mode (CBC instead of CTR), since BOLT 4 allows fallback ciphers",
      "Continue to i=2 (Dave's keys). If no layer matches, conclude the error was tampered with and disconnect the peer",
      "Send the bytes back through the route asking each hop to peel its own layer cooperatively until one says 'this is mine'",
      "Use the failure code from a default mapping based on the wrapped bytes' length, since BOLT 4 defines a canonical fallback for unknown hops",
    ],
    answer: 1,
    explanation: "Alice's algorithm is a strict trial-decrypt loop: peel one layer per iteration with the next hop's ammag, then check the corresponding um's HMAC. If she walks through every hop in the route without a match, no valid error exists in the bytes she received. This means a peer along the return path tampered with the error (or generated random bytes). Alice can disconnect that peer or downgrade their reliability score, because no attacker without one of the um keys can produce bytes that pass any layer's HMAC check.",
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
    explanation: "Verify-then-decrypt (encrypt-then-MAC) is a standard secure-construction pattern. Two reasons: (1) Defensive coding, never feed a tampered or malformed packet's bytes to your parser. If the HMAC is wrong, we don't know what's in the packet, so we shouldn't process it. (2) CPU efficiency, generating a 2,600-byte ChaCha20 keystream isn't free, and discarding the work because the packet was bogus is wasted effort. Verifying the 32-byte HMAC tag first costs much less than the keystream generation it gates.",
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
    explanation: "Type 6 (short_channel_id) tells a forwarder which channel to forward over. Type 8 (payment_data) carries the payment_secret + total_msat that the destination uses to validate against an invoice. The presence of type 8 without type 6 is BOLT 4's way of signaling 'you are the destination.' The hop should look up its pending invoices to find one matching the payment_data and either settle (revealing the preimage) or fail if no matching invoice is found. Defaulting to all-zero scid (option 1) would forward into a non-existent channel; rejecting (option 3) would break the protocol's intentional final-hop signaling; option 4 is fictional and dangerous.",
  },
  // ── Chapter 9: Peeling a Layer ───────────────────────────────────────────
  "cp-peel-extended-stream-draft": {
    question: "When Bob peels his layer, he generates a 2,600-byte ChaCha20 keystream from his rho key (twice the routing-info size) and XORs it onto a working buffer that's the inbound 1,300-byte hop_payloads followed by 1,300 zero bytes. Why does the keystream extend past 1,300 bytes?",
    options: [
      "The extra keystream derives a backup mu key in case the primary HMAC verification fails on first attempt",
      "ChaCha20 requires a minimum of 2,600 bytes per call to operate efficiently; a smaller call falls back to AES",
      "The trailing portion fills the gap when Bob shifts inner contents forward, matching what Alice baked into the filler",
      "The first 1,300 bytes decrypt the inbound packet; the next 1,300 bytes encrypt Bob's outgoing packet by XOR-ing onto the next ephemeral pubkey",
    ],
    answer: 2,
    explanation: "When Bob shifts the inner contents forward (to remove his hop payload from the front of the buffer), a gap opens up at the end. Those gap bytes have to be the bytes that Alice's chapter-7 filler computation arranged for. The filler was constructed to match the trailing portion of each hop's rho keystream extended past 1,300 bytes. By generating 2,600 bytes of keystream and XOR-ing it across a 2,600-byte working buffer, Bob applies that exact extension naturally: the front 1,300 decrypts his inbound bytes, the trailing 1,300 produces the bytes-of-keystream-XORed-with-zeros that match what Alice baked in.",
  },
  "cp-peel-next-hmac-draft": {
    question: "After Bob XORs his `rho_B` keystream over the extended buffer, he parses the bigsize-prefixed TLV records at the front, then reads the 32 bytes that come right after the TLVs. What's in those 32 bytes, and where do they go in the packet Bob forwards to Charlie?",
    options: [
      "It's `bob_hmac` — the same tag Bob just verified, kept as a checksum for Bob's audit log of forwarded packets",
      "It's `charlie_hmac` — the HMAC tag Bob writes into the outer HMAC field of the packet he forwards",
      "It's an encrypted next_hmac placeholder that Bob first decrypts with `um_B` before writing it into the outgoing packet",
      "It's `E_AC` — the advanced ephemeral pubkey, derived from those bytes and placed in the next packet's header",
    ],
    answer: 1,
    explanation: "Each hop payload is laid out as `bigsize_LEN || TLV records || next_hmac (32 B)`. During wrap, Alice wrote each hop's `next_hmac` field from the HMAC her loop computed on the *prior* (inner) iteration. So in Bob's hop payload, the 32 bytes after the TLVs are exactly `charlie_hmac` — the HMAC of Charlie's encrypted layer, computed during Alice's Charlie iteration.\n\nWhen Bob assembles his outgoing packet, those 32 bytes are written verbatim into the outer HMAC field. That's how the HMAC chain advances by one hop: Alice committed to `charlie_hmac` inside Bob's hop payload, Bob just lifts it into the wire field, and Charlie will compare it against the HMAC he recomputes from `mu_C` over his own hop_payloads. No `um` key is involved — `um` is used in the return-error path, not for forwarding (option 3). Option 4 confuses fields: the new ephemeral pubkey is derived from `E_AB` and `ss_AB`, not from a 32-byte region inside the buffer.",
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
    explanation: "The per-hop HMACs commit in a strict direction: Bob's HMAC commits to Charlie's layer, Charlie's HMAC commits to Dave's layer. To compute Bob's HMAC, Charlie's layer must already be built. To compute Charlie's HMAC, Dave's must already be built. So we have to build the innermost layer first, then wrap it, then wrap again, and so on. Forward order is impossible because the outer hop's HMAC needs bytes that don't yet exist. The reverse order isn't an arbitrary spec choice; it's forced by the data dependencies in the construction.",
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
    explanation: "Two BOLT 4 specifics combine in every wrap iteration's HMAC.\n\n(1) The HMAC is computed over the **encrypted** buffer, not the decrypted contents. This is the encrypt-then-MAC pattern from the Noise course's primitives chapter: the forwarder verifies integrity *first*, before any decryption, so tampered bytes never reach the parser.\n\n(2) The 32-byte `associated_data` (the `payment_hash` for an HTLC) is concatenated with the buffer before hashing. This binds the onion to a specific payment. An attacker who captures an in-flight onion can't re-attach it to a different HTLC: the new HTLC's `payment_hash` would produce a different HMAC at the first hop, and the packet would be rejected. Retries don't need the same onion: Alice builds a fresh one, so coupling to the `payment_hash` doesn't break anything legitimate, and it shuts the re-attachment attack down.\n\nOption 4 confuses key with message: `mu` is HMAC-derived from <m>ss_i</m> (different value, same function family), and only `mu` serves as the HMAC key.",
  },
  // ── Chapter 7: Filler Construction ───────────────────────────────────────
  "cp-filler-shared-keystream-draft": {
    question: "Alice's filler is just bytes she precomputes ahead of time, in her own kitchen, that turn out to be <em>exactly</em> what Bob's peel produces at the back of his forwarded packet. How is this possible?",
    options: [
      "Alice runs Bob's exact code on her side, simulating every byte he will touch in advance",
      "Alice and Bob derive the same <code>rho_B</code> keystream from <code>ss_AB</code>, so same key + same zeros + same XOR = same result",
      "The filler bytes are always zeros, so any forwarder would produce identical bytes at the back",
      "Bob uses a deterministic random number generator with a public seed that Alice can replicate",
    ],
    answer: 1,
    explanation: "This is the whole reason the filler trick works. Filler isn't a trick for hiding values from Bob; it's Alice <em>recreating</em> bytes Bob will produce. Because Alice and Bob share an ECDH secret <code>ss_AB</code>, they both derive the same <code>rho_B</code> key, and thus generate the same ChaCha20 keystream. Alice can take that keystream, XOR it into zeros (or her growing filler), and produce the exact byte pattern Bob will later create when he XORs his keystream over his extended buffer. Without the shared secret, this would require Alice to literally run Bob's code; with it, she just runs the same primitive locally.",
  },
  "cp-filler-reach-back-draft": {
    question: "In step 3 of the filler algorithm, Alice XORs the <strong>last <code>s_B + s_C</code> bytes</strong> of Charlie's <code>rho</code> keystream into the filler, not just the last <code>s_C</code>. The <code>s_B + s_C</code>-byte slice reaches <em>back</em> into Charlie's regular 1,300-byte keystream region by <code>s_B</code> bytes. Why is the reach-back necessary?",
    options: [
      "Without it, Charlie's keystream wouldn't cover the full 1,300-byte <code>hop_payloads</code> field plus the trailing extension",
      "The reach-back compensates for an off-by-one error in Python's negative slice indexing that would otherwise misalign by one byte",
      "Bob's filler bytes sit at those <code>s_B</code> positions when Charlie peels, so Charlie's XOR has to stack his layer onto Bob's bytes too",
      "The reach-back is what authenticates Charlie's HMAC; without it, HMAC verification would fail at Charlie",
    ],
    answer: 2,
    explanation: "When Charlie peels, he XORs his <code>rho_C</code> keystream over the <em>entire</em> 1,300 + <code>s_C</code> extended buffer, including the positions where Bob's filler bytes are already sitting. So Alice has to pre-bake Charlie's keystream into those positions too, otherwise Charlie's XOR will scramble Bob's bytes and the next hop's HMAC over the forwarded buffer won't match what Alice computed during construction. The reach-back doesn't extend the keystream's length (it's the same <code>1300 + s_C</code> stream as always); it's about where Alice slices from so that her precomputed filler accounts for Charlie's encryption layer landing on top of Bob's bytes.",
  },
  // ── Chapter 7: The Fixed-Size Packet & Filler ────────────────────────────
  "cp-payload-shrink-leak-draft": {
    question: "Charlie is a middle forwarder in this 3-hop route. He receives a packet that's ~936 bytes, smaller than the 1,366 bytes Alice originally constructed but larger than what Dave will eventually see. From the byte count alone, what is Charlie able to infer that he shouldn't? Select all that apply.",
    options: [
      "The number of hops remaining downstream of him, based on how much buffer is left",
      "The number of hops upstream of him (how many forwarders have already peeled the packet)",
      "The total amount being forwarded across the route, from the smaller buffer he received",
      "The sender's identity, recovered from the packet header's leading public key bytes",
    ],
    answer: [0, 1],
    explanation: "Charlie can read both leaks at once. (1) He sees ~936 bytes still on the wire and knows hop payloads are roughly equal-sized, so he counts how many remain inside the packet (himself plus one downstream hop). (2) He compares 936 against the maximum unpeeled packet size (1,366 bytes) and works out that exactly one forwarder has already peeled, putting him at position 2 in the route. Either reading lands him in the same spot. Encryption hides the *contents* of each hop payload, not the byte count on the wire, which is exactly the privacy property from chapter 3 falling apart. The other options aren't size-derivable: amount, sender identity, and payment hash all live encrypted inside hop payloads and don't shift the byte count. Sphinx fixes both leaks by padding every packet to exactly 1,366 bytes regardless of route length, and the filler construction in this chapter is what makes that padding work without breaking each hop's HMAC verification.",
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
    explanation: "All three of the first reasons are real cryptographic problems with reusing one key for everything, and together they're the reason BOLT 4 derives five separate keys from each shared secret. (1) is the standard generic-composition argument: encryption and authentication are different primitives whose security proofs assume independent keys. (2) is the two-time-pad attack: with the same key driving both directions of an all-zero-nonce ChaCha20, the keystream collides and ciphertexts can be XORed together to recover plaintext. (3) is the forwarder-forging-error attack: a hop legitimately learns the forward HMAC key during routing, and could repurpose it to author fake errors if it were the same as the backward HMAC key. The fourth option is the wrong reason: BOLT 4's 1,300-byte size comes from the packet format itself (and the filler construction we'll meet in chapter 7), not from the keying scheme.",
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
    explanation: "Each per-hop key is HMAC-SHA256(label, shared_secret) for a different ASCII label. HMAC's pseudorandom-function property means that knowing one output (<m>rho_i</m>) gives an attacker no usable information about the other three per-hop outputs unless they also know the shared secret <m>ss_i</m>. Recovering `rho` only lets them attack the forward stream cipher, which is bad enough on its own (they can read Bob's hop payload) but doesn't extend to forging HMACs (`mu`) or attacking the return path (`um`, `ammag`). That's the entire point of domain separation: a leak in one key stays contained to its own role. (The fifth key, `pad`, is derived from Alice's session key rather than any per-hop secret, so a forwarder couldn't recover it from <m>ss_AB</m> anyway.)",
  },
  // ── Chapter 4: Shared Secrets per Hop ────────────────────────────────────
  "cp-node-key-ecdh-draft": {
    question: "Reusing Alice's node-identity key as the ECDH input has multiple consequences. Some are visible in the animation above, others fall out of the design when you think it through. Select all the real problems with this approach.",
    options: [
      "Every forwarder can match the pubkey in the packet against the public gossip graph and identify Alice as the sender.",
      "Two of Alice's payments would carry the same pubkey, letting an observer link them to the same sender.",
      "Every payment Alice routes through the same forwarder would derive the same shared secret with that forwarder, since both ECDH inputs are static keys.",
      "A forwarder receiving Alice's onion could decrypt the slices intended for hops further downstream, since Alice's key is reused across all of them.",
    ],
    answer: [0, 1, 2],
    explanation:
      "Three real consequences fall out of one design choice, plus a tempting distractor.\n\n**Option 1 (correct).** The pubkey rides at the top of the packet because every forwarder needs it for ECDH. If it's Alice's published node-identity key, any forwarder can match it against the gossip graph and learn who sent the payment. That's exactly the gossip-lookup callout you saw fire at Bob, Charlie, and Dave in the visual.\n\n**Option 2 (correct).** Linkability across payments. Every onion Alice sends would carry the same pubkey, so an observer sitting between her and her first hop, or two colluding forwarders comparing notes, could correlate every one of her payments. The visual only animated one payment, but think about what an observer would see if she sent two.\n\n**Option 3 (correct).** ECDH with both inputs static is deterministic: same inputs always produce the same output. Every payment Alice routes through Bob would derive the *same* shared secret with Bob. That removes per-payment cryptographic separation, so a single shared-secret compromise retroactively breaks every payment Alice ever routed through that forwarder.\n\n**Option 4 (wrong, distractor).** Reusing Alice's side of the ECDH doesn't collapse the per-hop shared secrets. Each forwarder still derives a *different* shared secret because each has a *different* node privkey on its side of the ECDH. Bob computes `bob_priv` · <m>A</m>; Charlie computes `charlie_priv` · <m>A</m>; `bob_priv` ≠ `charlie_priv`, so the shared secrets differ. Bob cannot decrypt Charlie's slice.",
  },
  "cp-naive-shared-secrets-draft": {
    question: "The fresh-keypair-per-hop design fixes the identity leak from the first attempt, but it pays a price elsewhere that scales with the route length. Select all the real costs of this design.",
    options: [
      "The packet has to carry one ephemeral pubkey per hop, consuming bytes that would otherwise be available for the hop payloads.",
      "Each shared secret is statistically predictable because Alice can only generate a limited amount of randomness per payment.",
      "Alice has to keep one private key per hop in memory, since errors come back encrypted with those same shared secrets.",
      "Any forwarder that learns its own ephemeral pubkey can use it to recover Alice's other ephemeral private keys from the packet.",
    ],
    answer: [0, 2],
    explanation:
      "Two real costs scale with the route length, and a single insight (the ephemeral key chain) is going to collapse both to one in the next section.\n\n**Option 1 (correct).** Each hop needs its own ephemeral pubkey in plaintext at the front of the packet to run ECDH against. Each pubkey is 33 bytes, so a 3-hop route ships 3 pubkeys (about 100 bytes), a 10-hop route ships 10. The BOLT 4 onion packet is fixed at 1300 bytes total, so every ephemeral pubkey is bytes we can't spend on the actual hop payloads.\n\n**Option 3 (correct).** Alice generates a fresh ephemeral keypair for every hop and has to keep them all in memory until the payment finishes. She can't discard them after sending, because failures come back encrypted with those same shared secrets and she needs the keys to decrypt the error onion. That means an N-hop in-flight payment requires Alice to maintain N keypairs of state for the entire payment lifecycle.\n\nBoth costs scale linearly with route length: the longer the route, the worse it gets. The math works, but the design is wasteful in a way Sphinx wouldn't accept, which is exactly what the ephemeral key chain construction in the next section fixes.\n\n**Option 2 (wrong, distractor).** Shared secrets from fresh ECDH are uniformly random. The elliptic curve discrete log problem rules out predicting them from public information.\n\n**Option 4 (wrong, distractor).** The discrete log problem also keeps each ephemeral private key safe even when the corresponding pubkey is public. A forwarder seeing <m>E_Bob</m> can't recover <m>e_Bob</m>, and the keypairs for other hops are completely independent.",
  },
  "cp-blinding-public-draft": {
    question: "Bob has derived <m>ss_AB</m> and computed <m>bf_AB</m>. He's about to forward the onion to Charlie. Which of the following best describes what Bob does to the ephemeral key field in the outgoing packet, and why Charlie ends up deriving the same <m>ss_AC</m> Alice precomputed?",
    options: [
      "Bob appends <m>E_AC</m> after <m>E_AB</m>, so Charlie can scan for his own key. It works because Charlie tries each pubkey until ECDH yields a value that decrypts his slice.",
      "Bob *replaces* <m>E_AB</m> with <m>E_AC</m> (computed as <m>bf_AB</m> · <m>E_AB</m>). Charlie ECDHs against <m>E_AC</m> and lands on the same <m>ss_AC</m> Alice precomputed.",
      "Bob signs <m>E_AC</m> with his node private key and embeds the signature in the packet. Charlie verifies it against `bob_pubkey` before trusting <m>E_AC</m>.",
      "Bob leaves <m>E_AB</m> in the field; Charlie derives <m>E_AC</m> himself by recomputing the chain from his own position in the route using gossip data.",
    ],
    answer: 1,
    explanation:
      "The chain advances by **replacing** the ephemeral key field at each hop, and the construction works because Alice and Bob independently arrive at the same <m>E_AC</m>.\n\n**Option 2 (correct).** Alice's chain produces <m>E_AC</m> as <m>bf_AB</m> · <m>E_AB</m> (since she advances her scalar <m>e_AB</m> by <m>bf_AB</m> to get <m>e_AC</m>, and <m>e_AC</m> · <m>G</m> = <m>bf_AB</m> · <m>E_AB</m>). Bob computes the same <m>E_AC</m> directly via <m>bf_AB</m> · <m>E_AB</m> on the public side. Once both sides agree on <m>E_AC</m>, ECDH between Charlie's node privkey and <m>E_AC</m> produces the same <m>ss_AC</m> Alice computed via <m>e_AC</m> · <m>C</m>, because scalar multiplication commutes.\n\n**Option 1 (wrong).** Appending defeats the fixed-size packet design and reintroduces both flaws we worked to eliminate (the size leak and Alice's key-management burden). The chain-and-replace mechanism is what keeps the packet compact.\n\n**Option 3 (wrong).** There is no signature on the ephemeral key in BOLT 4. Bob is kept honest economically (he loses his fee if he tampers) and via the HMAC we'll add in chapter 7. A signature would also expose Bob's identity to Charlie.\n\n**Option 4 (wrong).** Charlie can't derive <m>E_AC</m> without <m>bf_AB</m>, which requires <m>ss_AB</m>, which requires *Bob's* private key. Charlie has none of those. Each hop derives its own shared secret using the ephemeral key it sees in the packet header, not by recomputing the chain from scratch.",
  },
  // ── Chapter 2: Pathfinding 101 ───────────────────────────────────────────
  "cp-fees-backward-draft": {
    question: "In our worked example, Carol's incoming amount is 10,002 sats and Bob's incoming amount is 10,003 sats. Why must Alice work backward from Dave's amount when she computes each hop's input?",
    options: [
      "The Lightning spec defines a strict reverse processing order, and Alice's calculation has to follow that ordering to be valid",
      "Each hop's required input depends on its output, and the only fixed point is the final amount Dave receives",
      "Timelocks can only be subtracted, not added, so the calculation has to start from the highest CLTV and work down",
      "Each hop only knows what it forwards, not what it receives, so Alice has to reconstruct the input direction from the destination",
    ],
    answer: 1,
    explanation: "Bob's required incoming amount = his outgoing amount + his fee. His outgoing amount is whatever Carol receives. Carol's incoming amount = her outgoing amount + her fee. Her outgoing amount is whatever Dave receives. So the chain depends on Dave's amount being known first, then propagating backward. If Alice tried to start from her own number (say, 'I have 10,003 sats to spend'), she'd have no way to determine how much each hop should keep as a fee without already knowing the downstream amounts. The same applies to CLTVs: each hop's incoming CLTV must outlast its outgoing one by the hop's CLTV delta, and the only fixed CLTV is the one Dave specifies in his invoice.",
  },
  "cp-channel-update-direction-draft": {
    question: "A single payment channel between two nodes can have up to two `channel_update`s on the gossip network. Why?",
    options: [
      "Both sides cosign one shared `channel_update` at channel open, then re-sign it together whenever policy changes, producing two versions over the channel's lifetime.",
      "Each direction of the channel has its own forwarding policy, and each side publishes the `channel_update` for the direction it owns.",
      "One advertises the channel's existence, the other advertises its capacity. Both are required for the channel to be valid on the gossip network.",
      "The protocol mandates a redundant second update so peers can verify the channel is online, and each node publishes one to confirm its presence.",
    ],
    answer: 1,
    explanation: "Forwarding policies are direction-specific. The Alice to Bob direction can charge different fees and require a different `cltv_expiry_delta` than the Bob to Alice direction, so each direction needs its own `channel_update`. Each side publishes the `channel_update` for their own outgoing direction: Alice publishes the Alice to Bob policy if she forwards that way, and Bob publishes the Bob to Alice policy if he forwards that way. Either side can update its own policy at any time by broadcasting a fresh `channel_update` with a newer timestamp, and the latest timestamp wins. If a node never forwards in a particular direction (for example, a pure receiver like Dave), no `channel_update` for that direction gets published, which is why hovering a receiver on the forwarder graph above shows no outgoing `channel_update`s.",
  },
  "cp-cheapest-route-draft": {
    question: "You've now computed all three routes. Alice wants the lowest fee, but her wallet enforces `max_total_cltv_expiry_delta = 200`. Which route should she send through?",
    options: [
      "Route A: direct via Hazel (1,300 sats fee). It's the cheapest on fees, and a single forwarder is the simplest path.",
      "Route B: through Frank and Greg (2,002 sats fee). The most expensive route, but well within the CLTV ceiling.",
      "Route C: through Bob and Charlie (1,226 sats fee). The cheapest route that also fits under the CLTV ceiling.",
      "Either Route B or Route C. Once Route A is filtered out, picking between the survivors is a judgment call.",
    ],
    answer: 2,
    explanation: "The right move is **filter, then minimize**. Route A looks tempting at 1,300 sats, but Hazel's `cltv_expiry_delta = 1000` pushes the total accumulated CLTV to 1,018 blocks, which blows past Alice's 200-block ceiling, so her wallet refuses to lock her funds for that long. Route A drops out before fees are even compared. Among the survivors, Route B totals 60 blocks of CLTV at 2,002 sats, and Route C totals 53 blocks of CLTV at 1,226 sats. Route C is both cheaper *and* lower CLTV, so it wins on every axis that matters. This filter-then-optimize pattern is what real Lightning pathfinders do: they apply hard constraints (CLTV ceiling, HTLC min/max amounts, channel capacity) up front, then minimize a cost function over what's left. Route C is also the same path Alice picked back in chapter 1: Alice → Bob → Charlie → Dave.",
  },
  "cp-intermediate-vs-final-draft": {
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
    explanation: "This is the privacy issue with the naive plaintext design. Because every hop's instructions are sitting in the message in the clear, Bob (and anyone watching the wire between Alice and Bob) can read the entire route end-to-end. Bob now knows Alice initiated the payment, Dave is the final recipient, exactly how much each hop forwards, and even the payment hash. We want a design where Bob learns ONLY what he needs to do his job (next hop is Charlie, forward this amount with this CLTV) and nothing more. That's what the rest of the course builds.",
  },
  // ── Chapter 3: The Privacy Problem ───────────────────────────────────────
  "cp-still-vulnerable-draft": {
    question: "Per-hop encryption hides the contents of each slice, but the message still leaks privacy in more than one way. Select all that apply.",
    options: [
      "The encrypted slices look identical from the outside, so Bob can't tell which slice is his to decrypt.",
      "The packet shrinks at each hop as forwarders peel their slices off, so anyone watching can count the slices in the message at each step and figure out which hop is at which position in the route.",
      "Each slice has to be encrypted to a known forwarder's published node-identity public key. Anyone watching can correlate the public keys Alice used against the gossip graph and identify every forwarder in the route.",
      "Public-key encryption is too computationally expensive for low-power wallets to perform per-hop, so the design doesn't scale.",
    ],
    answer: [1, 2],
    explanation: "Two real privacy problems remain even with per-hop encryption. **First, the packet shrinks.** Each forwarder peels its own slice off the wire before forwarding the rest, so the message gets smaller at each hop. If Bob receives a 3-slice message, he immediately knows there are at least two hops downstream of him; when Charlie sees a 2-slice message, he knows he's the second-to-last forwarder. Size alone reveals each forwarder's position, which directly violates the property 'Bob shouldn't be able to tell whether he's the first hop, the last forwarder, or somewhere in between.' Sphinx fixes this with a **fixed-size packet** that doesn't shrink. **Second, every forwarder's identity is exposed by the keys themselves.** To encrypt a slice for Bob, Alice has to look up Bob's node-identity public key on the gossip network. The very act of using Bob's public key in the packet (or any tag that lets Bob find his slice) signals 'Bob is in this route' to anyone watching. Sphinx fixes this with **shared-secret derivation via ephemeral keys** so Alice never directly references each hop's static identity key. The two distractors are wrong: identical-looking ciphertext is a feature of encryption, not a bug, and public-key crypto cost isn't the central problem here.",
  },
  "cp-privacy-property-draft": {
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
    id: "capstone-failure",
    title: "Capstone: Failure Path",
    section: "Capstone",
    kind: "md",
    file: "/onion_routing_tutorial/13.0-capstone-failure.md",
  },
  {
    id: "beyond-sphinx",
    title: "Beyond Sphinx",
    section: "Beyond",
    kind: "md",
    file: "/onion_routing_tutorial/14.0-beyond-sphinx.md",
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
  "Beyond",
  "Pay It Forward",
];

export const CHAPTER_REQUIREMENTS: Record<string, {
  checkpoints: string[];
  exercises: string[];
}> = {
  "a-lightning-payment": { checkpoints: [], exercises: [] },
  "pathfinding-101": { checkpoints: ["cp-channel-update-direction-draft", "cp-cheapest-route-draft"], exercises: [] },
  "privacy-problem": { checkpoints: ["cp-naive-plaintext-leak-draft", "cp-still-vulnerable-draft"], exercises: [] },
  "shared-secrets": { checkpoints: ["cp-node-key-ecdh-draft", "cp-naive-shared-secrets-draft", "cp-blinding-public-draft"], exercises: ["exercise-derive-shared-secrets-draft"] },
  "onion-routing-101": {
    checkpoints: [
      "cp-101-keystream-shared-draft",
      "cp-101-encrypt-buffer-scope-draft",
      "cp-101-dave-layer-count-draft",
      "cp-101-decrypt-buffer-scope-draft",
      "cp-101-destination-signal-draft",
      "cp-101-tamper-detection-draft",
    ],
    exercises: [],
  },
  "key-derivation": { checkpoints: ["cp-key-separation-draft", "cp-key-domain-separation-draft"], exercises: ["exercise-derive-keys-draft"] },
  "fixed-size-and-filler": { checkpoints: ["cp-payload-shrink-leak-draft", "cp-filler-shared-keystream-draft", "cp-filler-reach-back-draft"], exercises: ["exercise-generate-filler-draft"] },
  "wrapping-layer-by-layer": { checkpoints: ["cp-build-reverse-order-draft", "cp-hmac-commits-to-draft"], exercises: ["exercise-wrap-hop-draft", "exercise-build-packet-draft"] },
  "peeling-a-layer": { checkpoints: ["cp-peel-extended-stream-draft", "cp-peel-next-hmac-draft"], exercises: ["exercise-peel-layer-draft"] },
  "forwarding-validation": { checkpoints: ["cp-validate-before-decrypt-draft", "cp-tlv-final-vs-forward-draft"], exercises: ["exercise-verify-hmac-draft", "exercise-process-onion-draft"] },
  "error-onion": { checkpoints: ["cp-error-trial-decrypt-draft"], exercises: ["exercise-build-error-onion-draft", "exercise-decrypt-error-onion-draft"] },
  "capstone-success": { checkpoints: [], exercises: [] },
  "capstone-failure": { checkpoints: [], exercises: [] },
  "beyond-sphinx": { checkpoints: [], exercises: [] }, // tail chapter, no checkpoint or exercise
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
          code: ({ className, children, ...props }: any) => (
            <code
              className={`${className ?? ""} rounded px-1 py-0.5 ${theme === "dark" ? "bg-white/10" : "bg-black/[0.03]"}`}
              {...props}
            >
              {children}
            </code>
          ),
          // Inline math token: <m>e_AB</m> renders e<sub>AB</sub> with proper
          // math typography (italic single-letter base + true subscripts).
          // Multi-letter bases (ss, bf) stay upright per math convention.
          // Used for math expressions in chapter prose.
          m: ({ children }: any) => {
            const tok = String(
              Array.isArray(children) ? children.join("") : children ?? ""
            );
            return <MathTok token={tok} />;
          },
          // Inline term that cross-highlights the onion-packet-anatomy diagram
          // on hover: <anatomy-term region="header|payload|hmac">…</anatomy-term>
          "anatomy-term": ({ region, children }: any) => (
            <AnatomyTerm region={region}>{children}</AnatomyTerm>
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
                storageKey={`pl-collapse-cp-draft-${cpId}`}
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
            // Filter out any multi-select questions, CheckpointGroup's
            // grouped reward UI only supports single-answer questions today.
            const groupQuestions = questionIds
              .map((qid: string) => {
                const cpData = CHECKPOINT_QUESTIONS[qid];
                if (!cpData) return null;
                if (Array.isArray(cpData.answer)) return null;
                return { id: qid, ...cpData, answer: cpData.answer as number };
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
                storageKey={`pl-collapse-cpg-draft-${groupId}`}
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
                    storageKey={`pl-collapse-ex-draft-${ex.id}`}
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
          "route-comparison": () => {
            return <RouteComparisonDiagram />;
          },
          "naive-vs-onion": () => {
            return <NaiveVsOnionDiagram />;
          },
          "ecdh-chain": () => {
            return <EcdhChainDiagram />;
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
          "onion-peel": () => {
            return <OnionPeelDiagram />;
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
          "onion-capstone": ({ mode }: any) => {
            const m = mode === "failure" ? "failure" : "success";
            return <OnionCapstonePanel mode={m} />;
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
          "shared-secret-symmetry": () => {
            return <SharedSecretSymmetryDiagram />;
          },
          "naive-packet": () => {
            return <NaivePacketDiagram />;
          },
          "shared-secrets-recap": () => {
            return <SharedSecretsRecapDiagram />;
          },
          "node-key-attempt": () => {
            return <NodeKeyAttemptDiagram />;
          },
          "hmac-recap": () => {
            return <HmacRecapDiagram />;
          },
          "five-keys-jobs": () => {
            return <FiveKeysJobsDiagram />;
          },
          "per-hop-key-matrix": () => {
            return <PerHopKeyMatrixDiagram />;
          },
          "packet-jobs-preview": () => {
            return <PacketJobsPreviewDiagram />;
          },
          "slices-recap": () => {
            return <SlicesRecapDiagram />;
          },
          "slice-in-packet": () => {
            return <SliceInPacketDiagram />;
          },
          "key-operations": () => {
            return <KeyOperationsDiagram />;
          },
          "operations-lifecycle": () => {
            return <OperationsLifecycleDiagram />;
          },
          "operations-lifecycle-keyed": () => {
            return <OperationsLifecycleDiagram showKeys />;
          },
          "python-snippet": ({ id }: any) => {
            return <PythonSnippet id={id} />;
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
            return <KnowledgeMatrix />;
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

  return (
    <PanelStateContext.Provider value={panelState}>
    <div
      className={`min-h-screen ${t.pageBg} ${t.pageText}`}
      data-theme={theme}
      style={{ paddingRight: panelPadding, transition: panelTransition }}
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
                              <div className="flex-1 min-w-0 text-[16px] leading-snug" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                                <span
                                  style={{ display: "inline-block", minWidth: "1.4em", textAlign: "right", opacity: 0.45, fontVariantNumeric: "tabular-nums" }}
                                >
                                  {chapterNumber[c.id]}
                                </span>
                                <span style={{ opacity: 0.3, margin: "0 0.4em" }}>·</span>
                                {c.title}
                              </div>
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

      <Scratchpad theme={theme} courseKey="onion-routing" />

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
