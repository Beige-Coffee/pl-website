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
import { ONION_ROUTING_EXERCISES_DRAFT as ONION_ROUTING_EXERCISES } from "../data/onion-routing-exercises-draft";
import { getOnionRoutingDraftExerciseGroupContext as getOnionRoutingExerciseGroupContext } from "../lib/onion-routing-exercise-groups-draft";
import { NetworkTopologyDiagram } from "../components/onion-routing-draft/NetworkTopologyDiagram";
import { NaiveVsOnionDiagram } from "../components/onion-routing-draft/NaiveVsOnionDiagram";
import { EcdhChainDiagram } from "../components/onion-routing-draft/EcdhChainDiagram";
import { KdfPipelineDiagram } from "../components/onion-routing-draft/KdfPipelineDiagram";
import { ShrinkingVsFixedDiagram } from "../components/onion-routing-draft/ShrinkingVsFixedDiagram";
import { OnionPacketLayoutDiagram } from "../components/onion-routing-draft/OnionPacketLayoutDiagram";
import { FillerTraceDiagram } from "../components/onion-routing-draft/FillerTraceDiagram";
import { HmacChainDiagram } from "../components/onion-routing-draft/HmacChainDiagram";
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
import { HmacRecapDiagram } from "../components/onion-routing-draft/HmacRecapDiagram";
import { FiveKeysJobsDiagram } from "../components/onion-routing-draft/FiveKeysJobsDiagram";
import { PerHopKeyMatrixDiagram } from "../components/onion-routing-draft/PerHopKeyMatrixDiagram";
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
  "shrinking-vs-fixed",
  "onion-packet-layout",
  "filler-trace",
  "hmac-chain",
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
  "cltv-safety-lab",
  "forwarder-policy-map",
  "knowledge-matrix",
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
  // ── Chapter 10: The Error Onion ──────────────────────────────────────────
  "cp-error-trial-decrypt-draft": {
    question: "Alice receives a wrapped error from a 3-hop route Bob → Carol → Dave. She tries hop 0's keys (Bob), the HMAC doesn't verify, then tries hop 1's keys (Carol), the HMAC verifies. What does Alice's algorithm do if Carol's keys hadn't matched either?",
    options: [
      "Restart from i=0 with a different decryption mode (CBC instead of CTR), since BOLT 4 allows fallback ciphers",
      "Continue to i=2 (Dave's keys). If still no match after every layer, conclude the error packet was tampered with by some upstream hop and disconnect that peer",
      "Send the wrapped bytes back through the route asking each hop to peel its own layer cooperatively until one says 'this is mine'",
      "Use the failure code from a default mapping based on the wrapped bytes' length, since BOLT 4 defines a canonical fallback for unknown hops",
    ],
    answer: 1,
    explanation: "Alice's algorithm is a strict trial-decrypt loop: peel one layer per iteration with the next hop's ammag, then check the corresponding um's HMAC. If she walks through every hop in the route without a match, no valid error exists in the bytes she received. This means a peer along the return path tampered with the error (or generated random bytes). Alice can disconnect that peer or downgrade their reliability score, because no attacker without one of the um keys can produce bytes that pass any layer's HMAC check.",
  },
  // ── Chapter 9: Forwarding & Validation ───────────────────────────────────
  "cp-validate-before-decrypt-draft": {
    question: "Why does a forwarder verify the packet's HMAC tag *before* decrypting the hop_payloads with its rho keystream?",
    options: [
      "Decryption is irreversible, so if the HMAC fails after decryption the forwarder can't undo the rho XOR to retry verification",
      "Verifying first keeps untrusted bytes out of the parser and saves the CPU cost of generating an extended keystream for packets that will be rejected anyway",
      "BOLT 4 mandates HMAC-first ordering for compatibility with HSM-based signing flows used by routing nodes",
      "ChaCha20 doesn't initialize correctly until an HMAC has been computed over its input, so the order is forced by the cryptographic library",
    ],
    answer: 1,
    explanation: "Verify-then-decrypt (encrypt-then-MAC) is a standard secure-construction pattern. Two reasons: (1) Defensive coding — never feed a tampered or malformed packet's bytes to your parser. If the HMAC is wrong, we don't know what's in the packet, so we shouldn't process it. (2) CPU efficiency — generating a 2,600-byte ChaCha20 keystream isn't free, and discarding the work because the packet was bogus is wasted effort. Verifying the 32-byte HMAC tag first costs much less than the keystream generation it gates.",
  },
  "cp-tlv-final-vs-forward-draft": {
    question: "After peeling, the forwarder parses the bigsize-prefixed TLV records and finds types 2 (amt_to_forward), 4 (outgoing_cltv_value), and 8 (payment_data). No type 6 record is present. What should the forwarder do?",
    options: [
      "Forward the payment using a default short_channel_id of all zeros, since type 6 is optional in BOLT 4",
      "Treat itself as the destination and attempt to claim the HTLC against an invoice matching the payment_data (assuming this hop has such a pending invoice). If no matching invoice exists, fail the HTLC",
      "Reject with invalid_onion_payload because every BOLT 4 payload must include type 6",
      "Forward the packet to the next hop in its peer list at random, since the absence of short_channel_id signals 'best-effort delivery'",
    ],
    answer: 1,
    explanation: "Type 6 (short_channel_id) tells a forwarder which channel to forward over. Type 8 (payment_data) carries the payment_secret + total_msat that the destination uses to validate against an invoice. The presence of type 8 without type 6 is BOLT 4's way of signaling 'you are the destination.' The hop should look up its pending invoices to find one matching the payment_data and either settle (revealing the preimage) or fail if no matching invoice is found. Defaulting to all-zero scid (option 1) would forward into a non-existent channel; rejecting (option 3) would break the protocol's intentional final-hop signaling; option 4 is fictional and dangerous.",
  },
  // ── Chapter 8: Peeling a Layer ───────────────────────────────────────────
  "cp-peel-extended-stream-draft": {
    question: "When Bob peels his layer, he generates a 2,600-byte ChaCha20 keystream from his rho key (twice the routing-info size) and XORs it onto a working buffer that's the inbound 1,300-byte hop_payloads followed by 1,300 zero bytes. Why does the keystream extend past 1,300 bytes?",
    options: [
      "The extra keystream is used to derive a backup mu key in case the primary HMAC verification fails",
      "ChaCha20 requires a minimum of 2,600 bytes per call to operate efficiently; a smaller call would silently fall back to AES",
      "The trailing portion of the keystream becomes the bytes that fill the gap when Bob shifts the inner contents forward. Those bytes have to match what Alice precomputed in the filler so Carol's HMAC verification works",
      "The first 1,300 bytes decrypt the inbound packet; the next 1,300 bytes encrypt Bob's outgoing packet by XOR-ing his keystream onto the next ephemeral pubkey field",
    ],
    answer: 2,
    explanation: "When Bob shifts the inner contents forward (to remove his slot from the front of the buffer), a gap opens up at the end. Those gap bytes have to be the bytes that Alice's chapter-6 filler computation arranged for. The filler was constructed to match the trailing portion of each hop's rho keystream extended past 1,300 bytes. By generating 2,600 bytes of keystream and XOR-ing it across a 2,600-byte working buffer, Bob applies that exact extension naturally: the front 1,300 decrypts his inbound bytes, the trailing 1,300 produces the bytes-of-keystream-XORed-with-zeros that match what Alice baked in.",
  },
  // ── Chapter 7: Wrapping Layer-by-Layer ───────────────────────────────────
  "cp-build-reverse-order-draft": {
    question: "Why must Alice build the onion in reverse order, starting with the destination's layer (Dave) and working outward to the first hop (Bob)?",
    options: [
      "BOLT 4 mandates reverse order to ensure consistent hashing across implementations, but other orders would also produce a valid packet",
      "Each hop's HMAC is computed over the contents of the next inner layer, so the inner layer must already be built before the outer layer can compute its HMAC. Reverse order is the only build order that respects this dependency",
      "Reverse order minimizes the number of ChaCha20 invocations, since the keystreams can be reused across iterations when computed back-to-front",
      "Forward order would leak the hop count to a passive observer because intermediate buffers would be visible at known sizes",
    ],
    answer: 1,
    explanation: "The HMAC chain has a strict direction: Bob's HMAC commits to Carol's layer, Carol's HMAC commits to Dave's layer. To compute Bob's HMAC, Carol's layer must already be built. To compute Carol's HMAC, Dave's must already be built. So we have to build the innermost layer first, then wrap it, then wrap again, and so on. Forward order is impossible because the outer hop's HMAC needs bytes that don't yet exist. The reverse order isn't an arbitrary spec choice; it's forced by the data dependencies in the construction.",
  },
  // ── Chapter 6: Filler Construction ───────────────────────────────────────
  "cp-filler-purpose-draft": {
    question: "Bob peels his layer of the onion. He decrypts, reads his TLV payload, shifts the inner contents forward, and needs to fill the trailing 65 bytes that the shift opened up. Why can't he just pad those 65 bytes with zeros?",
    options: [
      "Zeros are reserved by BOLT 4 as a sentinel for 'final hop reached', so padding with zeros would mislead Carol into thinking she's the destination",
      "When Carol peels her layer, she XORs her rho keystream over the entire 1,300-byte hop_payloads field. Zero-padded trailing bytes XORed with her keystream would produce structured keystream output, which isn't what Alice baked Carol's HMAC over, so verification fails",
      "ChaCha20 produces undefined output when applied to runs of zero bytes longer than 32, so Carol's stream cipher would crash before she could verify the HMAC",
      "Zeros at the end of the payload area would be visible to a passive observer as a quantity-of-trailing-zeros side channel, leaking the route length",
    ],
    answer: 1,
    explanation: "The forwarder XORs the entire 1,300-byte hop_payloads field with its rho keystream before reading anything. If Bob shifted in zeros and Carol XORed those zeros with her keystream, she'd get her rho keystream values at those positions — which is a deterministic value, but isn't what Alice computed Carol's HMAC over. Carol's HMAC verification would fail and the payment would be rejected. The filler is precomputed by Alice exactly so that the trailing positions, after each peel, contain bytes that match what the next hop's HMAC expected.",
  },
  "cp-filler-final-hop-draft": {
    question: "In a 3-hop route Bob → Carol → Dave, Alice generates filler covering Bob's and Carol's hop sizes but does not generate any filler for Dave. Why?",
    options: [
      "Dave's filler would have to be 1,300 bytes long, which exceeds the maximum keystream length of ChaCha20 with a 32-byte key",
      "Dave is the destination and doesn't shift any bytes forward. His HMAC is computed over a buffer Alice fully controls, so there are no 'trailing positions' that need to match a future hop's keystream",
      "Dave's payload always has type 8 (payment_data), which BOLT 4 mandates must be the only TLV record in the final hop's slot, leaving no room for filler",
      "The final hop's filler is generated client-side by Dave's wallet using the payment_secret and is not Alice's responsibility",
    ],
    answer: 1,
    explanation: "Filler exists to make sure that after a hop shifts the inner packet forward, the trailing bytes that get exposed match what the next hop's HMAC was computed over. Dave is the final hop. He doesn't forward, doesn't shift, and there's no 'next hop' whose HMAC has to verify. Alice still pads the bytes after Dave's TLV during construction (typically with zeros, since there's no further structure), but those bytes don't have to align with any keystream because no further peeling happens.",
  },
  // ── Chapter 5: The Fixed-Size Packet ─────────────────────────────────────
  "cp-fixed-size-reason-draft": {
    question: "An onion-routed packet at every hop is encrypted, with each forwarder only able to decrypt its own slice. So why does the packet *also* need to be the same size at every hop? Isn't encryption enough?",
    options: [
      "Because the BOLT 4 spec mandates it for backwards compatibility with older onion versions",
      "Because a packet whose size shrinks (or grows) at each hop lets observers and forwarders infer position from byte count alone, even though the contents are encrypted",
      "Because all 1,300 bytes must be decrypted before the HMAC can be computed, and ChaCha20 requires fixed-size inputs to operate correctly",
      "Because the spec requires Alice's wallet to allocate the same buffer size for every payment, regardless of route length",
    ],
    answer: 1,
    explanation: "Encryption hides the contents but not the metadata. A passive eavesdropper or a curious forwarder can measure the packet's size in bytes and use that to estimate how many hops remain. A 4-hop packet that's 1,500 bytes at hop 1 and 750 bytes at hop 3 advertises its position regardless of how strong the encryption is. Fixing the size to 1,366 bytes at every hop removes this side channel entirely. Every forwarder sees the same byte count, so position can no longer be inferred from packet length. This is exactly the privacy property we wrote down in Chapter 1, and it's what motivates the filler construction we'll meet in Chapter 6.",
  },
  // ── Chapter 4: Key Derivation ────────────────────────────────────────────
  "cp-key-domain-separation-draft": {
    question: "Imagine an attacker recovers Bob's rho key (the ChaCha20 stream cipher key for the forward path). What does this let them do, and why doesn't it cascade to the other four keys?",
    options: [
      "They can derive Bob's mu, um, pad, and ammag because all five keys are computed from a single shared seed; recovering one breaks all of them",
      "They can decrypt Bob's hop payload area, but they cannot derive mu, um, pad, or ammag without also obtaining ss_bob, since each key is HMAC-SHA256 with a different label and inverting HMAC is computationally infeasible",
      "They cannot do anything: rho is only used by Alice during construction, so a forwarder never possesses it",
      "They can forge the packet HMAC because rho is XORed with mu inside the protocol, making the two functionally equivalent",
    ],
    answer: 1,
    explanation: "Each per-hop key is HMAC-SHA256(label, shared_secret) for a different ASCII label. HMAC's pseudorandom-function property means that knowing one output (rho_i) gives an attacker no usable information about the other four outputs unless they also know the shared secret ss_i. Recovering rho only lets them attack the forward stream cipher, which is bad enough on its own (they can read Bob's hop payload) but doesn't extend to forging HMACs (mu) or attacking the return path (um, ammag). That's the entire point of domain separation: a leak in one key stays contained to its own role.",
  },
  // ── Chapter 3: Shared Secrets per Hop ────────────────────────────────────
  "cp-blinding-public-draft": {
    question: "Bob receives an onion packet, derives ss₀ via ECDH, and needs to compute the next ephemeral pubkey E₁ = E₀ · b₀ before forwarding. The blinding factor b₀ is defined as SHA256(E₀ ‖ ss₀). Why is it safe for Bob to compute b₀ himself, even though he never sees Alice's session_key?",
    options: [
      "Because Alice signs b₀ with her session_key and sends the signature in the packet, so Bob can verify it before using it",
      "Because b₀ is derived from public information Bob already has: E₀ is in the packet header, and ss₀ is the shared secret Bob just computed via his own private key",
      "Because Bob downloads b₀ from a precomputed table that Alice publishes via gossip alongside her session_key",
      "Because the chain is initialized with a random b₀ and only Alice can compute later blinding factors, so Bob can use any value here without affecting Carol",
    ],
    answer: 1,
    explanation: "The whole point of the blinding chain is that each forwarder can advance it on its own using only information available to it. b₀ depends on two values: E₀ (the ephemeral public key in the inbound packet, public to Bob) and ss₀ (the shared secret Bob just derived from bob_privkey · E₀). Both are knowable by Bob without ever seeing Alice's session_key. Alice independently computes the same b₀ using session_key · bob_pubkey to get the same ss₀, then hashing with the same E₀. The two parties reach the same b₀ from completely different starting information, which is exactly what makes the chain work without any out-of-band coordination.",
  },
  // ── Chapter 2: Pathfinding 101 ───────────────────────────────────────────
  "cp-fees-backward-draft": {
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
      "Every slice in the message: his own forwarding instructions, Charlie's, and that Dave is the final destination receiving 10,000 sat at block 140 with payment hash 0xa3f1...e9c4",
      "Nothing useful, since the bytes are signed by Alice and only the final hop can verify the signature",
    ],
    answer: 2,
    explanation: "This is the privacy issue with the naive plaintext design. Because every hop's instructions are sitting in the message in the clear, Bob (and anyone watching the wire between Alice and Bob) can read the entire route end-to-end. Bob now knows Alice initiated the payment, Dave is the final recipient, exactly how much each hop forwards, and even the payment hash. We want a design where Bob learns ONLY what he needs to do his job (next hop is Charlie, forward this amount with this CLTV) and nothing more. That's what the rest of the course builds.",
  },
  // ── Chapter 1: The Privacy Problem ───────────────────────────────────────
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
    id: "key-derivation",
    title: "Key Derivation",
    section: "Cryptography",
    kind: "md",
    file: "/onion_routing_tutorial/5.0-key-derivation.md",
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
  "shared-secrets": { checkpoints: ["cp-blinding-public-draft"], exercises: ["exercise-derive-shared-secrets-draft"] },
  "key-derivation": { checkpoints: ["cp-key-domain-separation-draft"], exercises: ["exercise-derive-keys-draft"] },
  "fixed-size-packet": { checkpoints: ["cp-fixed-size-reason-draft"], exercises: [] },
  "filler-construction": { checkpoints: ["cp-filler-purpose-draft", "cp-filler-final-hop-draft"], exercises: ["exercise-generate-filler-draft"] },
  "wrapping-layer-by-layer": { checkpoints: ["cp-build-reverse-order-draft"], exercises: ["exercise-wrap-hop-draft", "exercise-build-packet-draft"] },
  "peeling-a-layer": { checkpoints: ["cp-peel-extended-stream-draft"], exercises: ["exercise-peel-layer-draft"] },
  "forwarding-validation": { checkpoints: ["cp-validate-before-decrypt-draft", "cp-tlv-final-vs-forward-draft"], exercises: ["exercise-process-onion-draft"] },
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
            // Filter out any multi-select questions — CheckpointGroup's
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
          "shrinking-vs-fixed": () => {
            return <ShrinkingVsFixedDiagram />;
          },
          "onion-packet-layout": () => {
            return <OnionPacketLayoutDiagram />;
          },
          "filler-trace": () => {
            return <FillerTraceDiagram />;
          },
          "hmac-chain": () => {
            return <HmacChainDiagram />;
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
          "hmac-recap": () => {
            return <HmacRecapDiagram />;
          },
          "five-keys-jobs": () => {
            return <FiveKeysJobsDiagram />;
          },
          "per-hop-key-matrix": () => {
            return <PerHopKeyMatrixDiagram />;
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
