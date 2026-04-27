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
import { Section1Diagram } from "../components/onion-routing/Section1Diagram";
import { Section2Diagram } from "../components/onion-routing/Section2Diagram";
import { Section3Diagram } from "../components/onion-routing/Section3Diagram";
import { Section4Diagram } from "../components/onion-routing/Section4Diagram";
import { PacketBuilderPuzzle } from "../components/onion-routing/PacketBuilderPuzzle";
import { Section5Diagram } from "../components/onion-routing/Section5Diagram";
import { Section6Diagram } from "../components/onion-routing/Section6Diagram";
import { Section7Diagram } from "../components/onion-routing/Section7Diagram";
import { Section8Diagram } from "../components/onion-routing/Section8Diagram";
import { IllustratedOnionPacket } from "../components/onion-routing/IllustratedOnionPacket";
import { PerspectiveProvider } from "../components/onion-routing/PerspectiveContext";
import { PerspectiveToggle } from "../components/onion-routing/PerspectiveToggle";
import { NetworkTopologyDiagram } from "../components/onion-routing/NetworkTopologyDiagram";
import { TlvPayloadDiagram } from "../components/onion-routing/TlvPayloadDiagram";
import { SharedSecretsDiagram } from "../components/onion-routing/SharedSecretsDiagram";
import { PerspectiveFlipDiagram } from "../components/onion-routing/PerspectiveFlipDiagram";
import { ValidationFlowDiagram } from "../components/onion-routing/ValidationFlowDiagram";
import { PreimageFlowDiagram } from "../components/onion-routing/PreimageFlowDiagram";
import { FailureCodesDiagram } from "../components/onion-routing/FailureCodesDiagram";
import { KeyDerivationTreeDiagram } from "../components/onion-routing/KeyDerivationTreeDiagram";
import { NaiveVsFixedDiagram } from "../components/onion-routing/NaiveVsFixedDiagram";
import { FillerVisualizationDiagram } from "../components/onion-routing/FillerVisualizationDiagram";
import { FinalPacketDiagram } from "../components/onion-routing/FinalPacketDiagram";
import { RouteBlindingDiagram } from "../components/onion-routing/RouteBlindingDiagram";
import { KeysendDiagram } from "../components/onion-routing/KeysendDiagram";
import { MppDiagram } from "../components/onion-routing/MppDiagram";
import { Bolt8BridgeDiagram } from "../components/onion-routing/Bolt8BridgeDiagram";
import { CourseOverviewDiagram } from "../components/onion-routing/CourseOverviewDiagram";
import { LayerCakeDiagram } from "../components/onion-routing/LayerCakeDiagram";
import { TlvByteBreakdownDiagram } from "../components/onion-routing/TlvByteBreakdownDiagram";
import { NaivePacketDiagram } from "../components/onion-routing/NaivePacketDiagram";
import { FillerAlgorithmDiagram } from "../components/onion-routing/FillerAlgorithmDiagram";
import { ErrorUnwrapDiagram } from "../components/onion-routing/ErrorUnwrapDiagram";
import { FeeCalcDiagram } from "../components/onion-routing/FeeCalcDiagram";
import { CltvCalcDiagram } from "../components/onion-routing/CltvCalcDiagram";
import { EcdhFormulaDiagram } from "../components/onion-routing/EcdhFormulaDiagram";
import { KeyDerivationFormulaDiagram } from "../components/onion-routing/KeyDerivationFormulaDiagram";
import { BlindingFormulaDiagram } from "../components/onion-routing/BlindingFormulaDiagram";
import { WrappingTraceDiagram } from "../components/onion-routing/WrappingTraceDiagram";
import { ValidationChecksDiagram } from "../components/onion-routing/ValidationChecksDiagram";

// --- Checkpoint questions embedded inline in tutorial chapters ---
export const CHECKPOINT_QUESTIONS: Record<string, {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}> = {
  "predict-destination": {
    question: "Before we reveal the answer, think about this: in a payment from Alice to Dave through Bob and Carol, which nodes can learn the final destination (Dave)?",
    options: [
      "Only Alice (the sender)",
      "Alice and Dave",
      "Alice, Carol, and Dave",
      "All four nodes",
    ],
    answer: 0,
    explanation: "In onion routing, only the sender knows the full route. Carol forwards to Dave, but she doesn't know whether Dave is the final destination or just another hop. Dave knows he's the destination (because the onion tells him), but he doesn't know it came from Alice. Only Alice, who constructed the entire route, knows the payment destination.",
  },
  "predict-bob-info": {
    question: "If Bob is forwarding a payment to Carol, what information does Bob definitely need to know?",
    options: [
      "The full route from Alice to Dave",
      "Only that the next hop is Carol, plus the amount to forward and timelock",
      "The payment hash, the destination, and the amount",
      "Carol's private key, so he can encrypt the forwarded packet",
    ],
    answer: 1,
    explanation: "Bob only needs three pieces of information to forward the payment: which channel to forward on (to Carol), how much to forward, and the outgoing timelock value. He doesn't need to know the final destination, the full route, or anyone's private keys.",
  },
  "fixed-size-reason": {
    question: "In onion routing, what prevents an intermediate node from determining its position in the route?",
    options: [
      "Each node's payload is encrypted with a different key",
      "The onion packet is always the same fixed size (1,366 bytes), regardless of how many hops remain",
      "The payment hash changes at each hop",
      "Nodes are not allowed to inspect the packet headers",
    ],
    answer: 1,
    explanation: "If the packet shrank at each hop (losing one layer of encryption), an intermediate node could estimate how many layers remain and thus its position. By keeping the packet fixed at 1,366 bytes, every hop sees a packet that looks identical in size, making it impossible to infer position.",
  },
  "gossip-purpose": {
    question: "What is the primary purpose of the gossip protocol in the Lightning Network?",
    options: [
      "To broadcast payment details to all nodes",
      "To share channel existence and routing policies so senders can find paths",
      "To encrypt messages between nodes",
      "To verify that payments were received",
    ],
    answer: 1,
    explanation: "The gossip protocol lets nodes broadcast channel_announcement and channel_update messages, which tell other nodes about channels that exist and the fee/timelock policies for routing through them. Senders like Alice use this information to build a network graph and find paths to the recipient.",
  },
  "fee-backward-reason": {
    question: "Why must Alice calculate fees and timelocks backward from the final hop, rather than forward from herself?",
    options: [
      "Because the Lightning protocol requires reverse order",
      "Because each hop's fee depends on the amount it forwards, and forward amounts depend on downstream fees",
      "Because timelocks must decrease at each hop",
      "Because the payment hash is derived from the final amount",
    ],
    answer: 1,
    explanation: "Each forwarding node's fee depends on the amount it forwards. That forwarded amount includes all downstream fees. So to calculate Bob's fee, Alice first needs Carol's fee. To calculate Carol's fee, she needs Dave's amount. The only way to resolve this chain of dependencies is to start at the end (Dave) and work backward.",
  },
  "final-hop-difference": {
    question: "Which TLV field is present in an intermediate hop's payload but absent from the final hop's payload?",
    options: [
      "Type 2: amt_to_forward",
      "Type 4: outgoing_cltv_value",
      "Type 6: short_channel_id",
      "Type 8: payment_data",
    ],
    answer: 2,
    explanation: "An intermediate hop needs short_channel_id (type 6) to know which channel to forward the payment on. The final hop doesn't forward anywhere, so this field is absent. Instead, the final hop receives payment_data (type 8) containing the payment_secret and total_msat, which it uses to verify the payment matches the invoice.",
  },
  "session-key-reason": {
    question: "Why does Alice use a temporary session key instead of her Lightning node public key?",
    options: [
      "Her node key is too long to fit in the onion packet",
      "Using her real key would reveal her identity to every hop",
      "The session key provides stronger encryption than her node key",
      "Her node key can only be used for channel operations",
    ],
    answer: 1,
    explanation: "If Alice used her real node public key in the onion packet, every hop would see it and could identify her as the sender. A fresh session key (ephemeral key) is unlinkable to Alice's node identity, preserving sender privacy.",
  },
  "key-derivation-count": {
    question: "From each shared secret, how many distinct keys does Alice derive for each hop?",
    options: [
      "1 (just an encryption key)",
      "2 (encryption and authentication)",
      "5 (rho, mu, um, pad, ammag)",
      "It depends on the number of hops",
    ],
    answer: 2,
    explanation: "Alice derives exactly 5 keys from each shared secret: rho (encryption stream), mu (outgoing HMAC), um (error HMAC), pad (filler generation), and ammag (error encryption). Each key serves a specific purpose, ensuring domain separation.",
  },
  "replay-attack": {
    question: "If an intermediate node stores every ephemeral key it receives, what attack does this enable?",
    options: [
      "The node can decrypt all future payments",
      "The node can detect if the same onion packet is routed through it twice (replay detection)",
      "The node can determine the sender's identity",
      "The node can steal funds from the payment",
    ],
    answer: 1,
    explanation: "If a node sees the same ephemeral key twice, it knows the same onion packet is being replayed. This is actually a DEFENSE mechanism! Nodes are supposed to store seen ephemeral keys and reject duplicates to prevent replay attacks. An attacker who captures an onion packet and re-sends it would be detected this way.",
  },
  "naive-position-leak": {
    question: "In the naive approach (plain encryption without padding), what allows an intermediate node to determine its position in the route?",
    options: [
      "The packet header contains position information",
      "The packet shrinks at each hop as layers are removed",
      "The HMAC reveals the hop count",
      "The node can read all downstream payloads",
    ],
    answer: 1,
    explanation: "In the naive approach, each hop strips its payload and forwards a smaller packet. An intermediate node can measure the packet size and estimate how many hops remain, revealing its position in the route. Fixed-size packets (always 1,366 bytes) prevent this.",
  },
  "filler-purpose": {
    question: "What would happen if the filler bytes were all zeros instead of the correctly computed values?",
    options: [
      "The payment would succeed but take longer",
      "The final hop's HMAC verification would fail because the decrypted trailing bytes would be wrong",
      "The packet would be too small",
      "Nothing, zeros work fine",
    ],
    answer: 1,
    explanation: "The filler bytes compensate for data lost during the rightward shifts in onion construction. If they were all zeros, the final hop (Dave) would decrypt incorrect trailing bytes, causing the HMAC to not match. The filler is carefully computed so that after all layers of encryption and decryption cancel out, the trailing positions contain valid data.",
  },
  "innermost-hop-first": {
    question: "Why is the onion constructed starting from the innermost hop (Dave) and working outward?",
    options: [
      "Dave's layer must be encrypted first for security",
      "Because each outer layer wraps around the inner ones, so inner layers must exist first",
      "The protocol requires alphabetical order",
      "It's arbitrary and could be done in any order",
    ],
    answer: 1,
    explanation: "Onion routing uses nested encryption: each layer wraps all the layers inside it. Bob's layer encrypts everything inside (Carol's and Dave's layers). For Bob's layer to wrap Carol's, Carol's must already exist. For Carol's to wrap Dave's, Dave's must already exist. So construction must start from the inside out.",
  },
  "max-hops": {
    question: "If the onion payload is always 1,300 bytes and each hop's payload uses about 65 bytes, what is the approximate maximum number of hops?",
    options: [
      "10 hops",
      "20 hops (1300 / 65 = 20)",
      "27 hops",
      "There is no limit",
    ],
    answer: 1,
    explanation: "With 1,300 bytes of payload space and each hop using roughly 65 bytes (TLV payload plus the 32-byte per-hop HMAC), the maximum is approximately 20 hops. In practice, most Lightning payments use 3-6 hops, so 20 is more than sufficient.",
  },
  "peel-packet-size": {
    question: "After Bob peels one layer from the onion, how many bytes is the packet he forwards to Carol?",
    options: [
      "1,300 bytes (just the routing info)",
      "1,366 bytes (same size as what he received)",
      "About 1,300 bytes minus Bob's payload size",
      "It varies based on the route length",
    ],
    answer: 1,
    explanation: "The packet is always exactly 1,366 bytes: 1 byte version + 33 bytes ephemeral public key + 1,300 bytes routing info + 32 bytes HMAC. Bob removes his payload from the front, shifts the remaining data left, and pads with zeros to maintain the fixed 1,300-byte routing info size. The packet Carol receives is indistinguishable in size from the one Bob received.",
  },
  "extend-zeros": {
    question: "Why does Bob pad the right side of the routing info with zeros after removing his payload?",
    options: [
      "To add random noise for privacy",
      "To maintain the fixed 1,300-byte size so Carol can't determine her position",
      "The zeros serve as Carol's HMAC",
      "It's a protocol requirement with no practical purpose",
    ],
    answer: 1,
    explanation: "If the routing info shrank after each hop, Carol could measure its size and estimate how many hops came before her, revealing her position in the route. By padding with zeros to maintain exactly 1,300 bytes, every hop sees the same size. After Carol applies her own decryption, the zeros are indistinguishable from encrypted padding.",
  },
  "forward-validation": {
    question: "What happens if Bob tries to forward a smaller amount than specified in his hop payload's amt_to_forward field?",
    options: [
      "The payment succeeds but Bob keeps the difference",
      "Carol will reject the HTLC because her incoming amount won't cover her fee requirements",
      "The onion packet becomes invalid",
      "Dave won't be able to verify the payment hash",
    ],
    answer: 1,
    explanation: "Each hop validates that its incoming amount covers the forwarded amount plus its own fee. If Bob forwards less than his payload specifies, Carol's incoming amount will be too low to cover the amount she needs to forward plus her fee. Carol will reject the HTLC with an error that propagates back through the onion.",
  },
  // Section 7: Success & Failure
  "preimage-direction": {
    question: "In which direction does the preimage propagate?",
    options: [
      "Forward (Alice \u2192 Bob \u2192 Carol \u2192 Dave)",
      "Backward (Dave \u2192 Carol \u2192 Bob \u2192 Alice)",
      "Both directions simultaneously",
      "Only between Dave and Alice directly",
    ],
    answer: 1,
    explanation: "The preimage propagates backward from the final recipient (Dave) to the sender (Alice). Dave reveals the preimage to Carol via update_fulfill_htlc, Carol reveals it to Bob, and Bob reveals it to Alice. Each hop uses the preimage to claim the funds locked in the incoming HTLC.",
  },
  "error-encryption": {
    question: "Why must error messages be encrypted rather than sent in plaintext?",
    options: [
      "To compress the error data",
      "Plaintext errors would reveal the route structure and failing hop to intermediate nodes",
      "The protocol specification requires it",
      "To prevent the sender from reading the error",
    ],
    answer: 1,
    explanation: "If error messages were sent in plaintext, every intermediate hop could read them, learning which downstream hop failed and why. This leaks route structure information. Encryption also provides integrity: the HMAC (using the um key) prevents malicious hops from forging errors to blame innocent nodes.",
  },
  "stuck-payment": {
    question: "What is a 'stuck payment' and why can't Alice cancel it unilaterally?",
    options: [
      "A payment where Alice sent the wrong amount",
      "A payment where an intermediate hop went offline, leaving the HTLC uncommitted",
      "A payment where a hop holds the HTLC without forwarding or failing, and Alice must wait for the CLTV timeout",
      "A payment where the preimage was lost",
    ],
    answer: 2,
    explanation: "A stuck payment occurs when an intermediate hop holds an HTLC without forwarding or sending back an error. Alice can't cancel it because the HTLC is part of a signed commitment transaction. She must wait for the CLTV timeout to expire, at which point the HTLC can be resolved on-chain. This can lock funds for hours or days.",
  },
  "update-flag": {
    question: "What does the UPDATE flag in a failure code tell Alice?",
    options: [
      "Alice should update her node software",
      "The failure includes a channel_update message that Alice should use to refresh her routing graph",
      "Alice should retry with updated fees",
      "The channel has been closed",
    ],
    answer: 1,
    explanation: "The UPDATE flag (bit 12, 0x1000) indicates that the error message contains a channel_update message. Alice should parse this update and refresh her local routing graph with the new fee policies or channel parameters. This helps her build better routes for future payment attempts.",
  },
  // Section 6: The Commitment Dance
  "commit-before-revoke": {
    question: "Why must commitment_signed be sent BEFORE revoke_and_ack?",
    options: [
      "It's alphabetical order",
      "You must sign the new commitment before revoking the old one, otherwise you'd have no valid state",
      "The protocol requires this for backwards compatibility",
      "revoke_and_ack contains the commitment signature",
    ],
    answer: 1,
    explanation: "If a node revoked its old commitment before receiving a signed new one, it would have no valid commitment transaction at all. By sending commitment_signed first, the recipient always holds a new signed commitment before they revoke the old one. At every point in the sequence, both sides have at least one valid state they could broadcast.",
  },
  "forward-without-commit": {
    question: "What risk does Bob face if he forwards the HTLC to Carol without first committing it with Alice?",
    options: [
      "No risk, HTLCs are trustless",
      "Bob could lose funds: he's committed to Carol but has no committed claim on Alice's funds",
      "Carol would reject the forwarded HTLC",
      "The payment hash would be invalid",
    ],
    answer: 1,
    explanation: "If Bob forwards to Carol and that HTLC gets committed, Bob owes Carol. But if the incoming HTLC from Alice was never committed, Alice can disappear and Bob has no on-chain claim. He'd lose the amount he committed to Carol. The commitment dance ensures Bob has an irrevocable claim on Alice's funds before he takes on any obligation to Carol.",
  },
  "message-count": {
    question: "How many messages total are exchanged between Alice and Bob to irrevocably add a single HTLC?",
    options: [
      "2 (update_add_htlc + commitment_signed)",
      "3 (add + commit + revoke)",
      "5 (add + commit + revoke + commit + revoke)",
      "7",
    ],
    answer: 2,
    explanation: "Five messages are exchanged: (1) update_add_htlc, (2) commitment_signed from Alice, (3) revoke_and_ack from Bob, (4) commitment_signed from Bob, (5) revoke_and_ack from Alice. Both sides need to sign the new state and revoke the old one, plus the initial HTLC proposal.",
  },
  // --- Section 9: Advanced Topics ---
  "blinded-introduction-point": {
    question: "In a blinded path, what does the introduction point (the node where the blinded section starts) know?",
    options: [
      "The full route including the receiver's identity",
      "Only that it should forward to a blinded node ID, not the real identity of the next hop",
      "The payment amount and destination",
      "Nothing at all; it forwards blindly",
    ],
    answer: 1,
    explanation: "The introduction point knows it should forward to a blinded node ID, but it cannot determine the real identity of the next hop or the final receiver. The blinded node IDs are derived from the real node IDs using a blinding key, making them unlinkable without the blinding secret.",
  },
  "keysend-tradeoff": {
    question: "What is the main security tradeoff of keysend (spontaneous payments) compared to invoice-based payments?",
    options: [
      "Keysend payments are slower",
      "The receiver has no proof that they requested the payment, and the sender generates the preimage",
      "Keysend only works for small amounts",
      "Intermediate nodes can steal keysend payments",
    ],
    answer: 1,
    explanation: "With keysend, Alice generates the preimage and sends it to Dave in a custom TLV record. Dave never created an invoice, so there's no proof of payment intent. The sender knows the preimage before the payment settles, which changes the trust model compared to invoice-based payments where only the receiver knows the preimage initially.",
  },
  "mpp-payment-secret": {
    question: "Why does multi-part payment (MPP) require a payment_secret in the invoice?",
    options: [
      "To encrypt the payment parts",
      "To prevent intermediate nodes from probing or claiming partial payments before all parts arrive",
      "To compress the payment data",
      "It's optional; MPP works without it",
    ],
    answer: 1,
    explanation: "Without a payment_secret, an intermediate node could probe the final hop with a small payment using the same payment_hash. If the final hop revealed the preimage for the probe, the intermediate node could steal the real payment. The payment_secret ensures only the intended sender (who received the invoice) can construct valid payment parts.",
  },
  // --- Section 10: Quiz ---
  "quiz-privacy-goal": {
    question: "What is the primary privacy goal of onion routing in Lightning?",
    options: [
      "Hide the payment amount from all nodes",
      "Ensure no single intermediate node learns both the sender and the receiver",
      "Encrypt the payment hash so nodes can't correlate payments",
      "Prevent nodes from knowing they are forwarding a payment",
    ],
    answer: 1,
    explanation: "Onion routing ensures that intermediate nodes only learn their immediate predecessor and successor. No single hop can determine both the original sender and the final receiver, preserving payment privacy.",
  },
  "quiz-fee-direction": {
    question: "In which direction does Alice calculate fees and timelocks when constructing a route?",
    options: [
      "Forward (from Alice to Dave)",
      "Backward (from Dave to Alice)",
      "Both directions simultaneously",
      "Fees are calculated by each hop independently",
    ],
    answer: 1,
    explanation: "Alice calculates backward from Dave because each hop's fee depends on the amount it forwards, which includes all downstream fees. The only way to resolve this dependency chain is to start at the final destination and work backward.",
  },
  "quiz-tlv-field": {
    question: "Which TLV type is present in intermediate hop payloads but absent from the final hop?",
    options: [
      "Type 2 (amt_to_forward)",
      "Type 4 (outgoing_cltv_value)",
      "Type 6 (short_channel_id)",
      "Type 8 (payment_data)",
    ],
    answer: 2,
    explanation: "Intermediate hops need short_channel_id (type 6) to know which channel to forward on. The final hop doesn't forward, so it doesn't include this field. Instead, the final hop has payment_data (type 8).",
  },
  "quiz-session-key": {
    question: "What would happen if Alice reused the same session key for two different payments?",
    options: [
      "The payments would fail",
      "Forwarding nodes could link the two payments as coming from the same sender",
      "The second payment would overwrite the first",
      "Nothing; session key reuse is safe",
    ],
    answer: 1,
    explanation: "If a forwarding node sees the same ephemeral public key in two different onion packets, it knows both came from the same sender. This correlation breaks sender privacy. Fresh session keys per payment ensure each payment looks completely independent.",
  },
  "quiz-key-count": {
    question: "For a 3-hop route, how many total cryptographic keys does Alice derive?",
    options: [
      "3 (one per hop)",
      "6 (two per hop)",
      "15 (five per hop: rho, mu, um, pad, ammag)",
      "It depends on the payload sizes",
    ],
    answer: 2,
    explanation: "Alice derives 5 keys per hop (rho, mu, um, pad, ammag), and for a 3-hop route that's 5 x 3 = 15 keys total. Each key serves a specific cryptographic purpose, ensuring domain separation.",
  },
  "quiz-packet-size": {
    question: "What is the total size of a Lightning onion packet?",
    options: [
      "1,300 bytes",
      "1,333 bytes (1,300 + 33)",
      "1,366 bytes (1 + 33 + 1,300 + 32)",
      "Variable, depending on route length",
    ],
    answer: 2,
    explanation: "The onion packet is always exactly 1,366 bytes: 1 byte version + 33 bytes ephemeral public key + 1,300 bytes routing info + 32 bytes HMAC. The fixed size prevents information leakage about route length.",
  },
  "quiz-filler-purpose": {
    question: "What role does the filler play in onion packet construction?",
    options: [
      "It adds random noise for privacy",
      "It ensures that after all layers of encryption and decryption, the trailing bytes are valid",
      "It compresses the payload",
      "It's a checksum for error detection",
    ],
    answer: 1,
    explanation: "During construction, each layer shifts the payload right, and bytes 'fall off' the end. The filler pre-computes what those trailing bytes should be so that after the final hop decrypts, the HMAC verification succeeds. Without correct filler, the last hop would see corrupted data.",
  },
  "quiz-peel-order": {
    question: "What is the FIRST thing Bob does when he receives an onion packet?",
    options: [
      "Decrypt the routing info with his rho key",
      "Verify the HMAC using his mu key",
      "Extract his hop payload",
      "Compute the blinding factor for the next hop",
    ],
    answer: 1,
    explanation: "Bob's first step is to verify the HMAC. This authenticates the packet and proves it hasn't been tampered with. Only after HMAC verification does Bob proceed to decrypt. Decrypting before verifying could process malicious data.",
  },
  "quiz-error-keys": {
    question: "Which two keys are used for error message handling (backward direction)?",
    options: [
      "rho and mu",
      "um and ammag",
      "pad and rho",
      "mu and pad",
    ],
    answer: 1,
    explanation: "The 'um' key (mu backward) computes the HMAC for error messages, and the 'ammag' key (gamma backward) encrypts error messages. These backward-direction keys are the mirrors of mu and rho used in the forward direction.",
  },
  "quiz-blinding-chain": {
    question: "In the Sphinx blinding chain, what information does Bob need to compute the next ephemeral public key for Carol?",
    options: [
      "Alice's session private key",
      "The current ephemeral public key and the shared secret (which together produce the blinding factor)",
      "Carol's public key",
      "The payment hash",
    ],
    answer: 1,
    explanation: "Bob computes the blinding factor as SHA256(ephemeral_pubkey || shared_secret), then multiplies the ephemeral public key by this factor. He doesn't need Alice's private key or Carol's key. This is the key insight of Sphinx: the chain advances using only public information available to each hop.",
  },
};

type Chapter = {
  id: string;
  title: string;
  section:
    | "What Each Hop Knows"
    | "Routing Fundamentals"
    | "Cryptographic Primitives"
    | "Building the Onion"
    | "Peeling the Onion"
    | "The Commitment Dance"
    | "Success & Failure"
    | "Payment Trace Lab"
    | "Advanced Topics"
    | "Quiz"
    | "Pay It Forward";
  kind: "intro" | "md";
  file?: string;
};

export const chapters: Chapter[] = [
  {
    id: "intro",
    title: "Onion Routing & Lightning Payments",
    section: "What Each Hop Knows",
    kind: "intro",
  },
  {
    id: "what-each-hop-knows",
    title: "What Each Hop Knows",
    section: "What Each Hop Knows",
    kind: "md",
    file: "/onion_routing_tutorial/1.0-what-each-hop-knows.md",
  },
  {
    id: "finding-a-path",
    title: "Finding a Path",
    section: "Routing Fundamentals",
    kind: "md",
    file: "/onion_routing_tutorial/2.0-finding-a-path.md",
  },
  {
    id: "fees-and-timelocks",
    title: "Fees and Timelocks",
    section: "Routing Fundamentals",
    kind: "md",
    file: "/onion_routing_tutorial/2.1-fees-and-timelocks.md",
  },
  {
    id: "hop-payloads",
    title: "Hop Payloads & TLV Encoding",
    section: "Routing Fundamentals",
    kind: "md",
    file: "/onion_routing_tutorial/2.2-hop-payloads.md",
  },
  {
    id: "shared-secrets",
    title: "Shared Secrets",
    section: "Cryptographic Primitives",
    kind: "md",
    file: "/onion_routing_tutorial/3.0-shared-secrets.md",
  },
  {
    id: "key-derivation",
    title: "Key Derivation",
    section: "Cryptographic Primitives",
    kind: "md",
    file: "/onion_routing_tutorial/3.1-key-derivation.md",
  },
  {
    id: "session-key-blinding",
    title: "Session Key Blinding",
    section: "Cryptographic Primitives",
    kind: "md",
    file: "/onion_routing_tutorial/3.2-session-key-blinding.md",
  },
  {
    id: "naive-approach",
    title: "A First (Broken) Attempt",
    section: "Building the Onion",
    kind: "md",
    file: "/onion_routing_tutorial/4.0-naive-approach.md",
  },
  {
    id: "the-filler",
    title: "The Filler",
    section: "Building the Onion",
    kind: "md",
    file: "/onion_routing_tutorial/4.1-the-filler.md",
  },
  {
    id: "wrapping-layer-by-layer",
    title: "Wrapping Layer by Layer",
    section: "Building the Onion",
    kind: "md",
    file: "/onion_routing_tutorial/4.2-wrapping-layer-by-layer.md",
  },
  {
    id: "the-final-packet",
    title: "The Final Packet",
    section: "Building the Onion",
    kind: "md",
    file: "/onion_routing_tutorial/4.3-the-final-packet.md",
  },
  {
    id: "perspective-flip",
    title: "The Receiver's Perspective",
    section: "Peeling the Onion",
    kind: "md",
    file: "/onion_routing_tutorial/5.0-perspective-flip.md",
  },
  {
    id: "peeling-a-layer",
    title: "Peeling a Layer",
    section: "Peeling the Onion",
    kind: "md",
    file: "/onion_routing_tutorial/5.1-peeling-a-layer.md",
  },
  {
    id: "forwarding-and-validation",
    title: "Forwarding & Validation",
    section: "Peeling the Onion",
    kind: "md",
    file: "/onion_routing_tutorial/5.2-forwarding-and-validation.md",
  },
  {
    id: "commitment-dance",
    title: "The Commitment Dance",
    section: "The Commitment Dance",
    kind: "md",
    file: "/onion_routing_tutorial/6.0-commitment-dance.md",
  },
  {
    id: "fulfilling-the-payment",
    title: "Fulfilling the Payment",
    section: "Success & Failure",
    kind: "md",
    file: "/onion_routing_tutorial/7.0-fulfilling-the-payment.md",
  },
  {
    id: "failure-handling",
    title: "Failure Handling",
    section: "Success & Failure",
    kind: "md",
    file: "/onion_routing_tutorial/7.1-failure-handling.md",
  },
  {
    id: "failure-codes",
    title: "Failure Codes",
    section: "Success & Failure",
    kind: "md",
    file: "/onion_routing_tutorial/7.2-failure-codes.md",
  },
  {
    id: "payment-trace-lab",
    title: "Payment Trace Lab",
    section: "Payment Trace Lab",
    kind: "md",
    file: "/onion_routing_tutorial/8.0-payment-trace-lab.md",
  },
  {
    id: "route-blinding",
    title: "Route Blinding",
    section: "Advanced Topics",
    kind: "md",
    file: "/onion_routing_tutorial/9.0-route-blinding.md",
  },
  {
    id: "keysend",
    title: "Keysend",
    section: "Advanced Topics",
    kind: "md",
    file: "/onion_routing_tutorial/9.1-keysend.md",
  },
  {
    id: "multi-part-payments",
    title: "Multi-Part Payments",
    section: "Advanced Topics",
    kind: "md",
    file: "/onion_routing_tutorial/9.2-multi-part-payments.md",
  },
  {
    id: "bolt8-bridge",
    title: "BOLT 8 Bridge",
    section: "Advanced Topics",
    kind: "md",
    file: "/onion_routing_tutorial/9.3-bolt8-bridge.md",
  },
  {
    id: "quiz",
    title: "Test Your Knowledge",
    section: "Quiz",
    kind: "md",
    file: "/onion_routing_tutorial/10.0-quiz.md",
  },
  {
    id: "pay-it-forward",
    title: "Pay It Forward",
    section: "Pay It Forward",
    kind: "md",
    file: "/onion_routing_tutorial/10.1-pay-it-forward.md",
  },
];

export const sectionOrder: Chapter["section"][] = [
  "What Each Hop Knows",
  "Routing Fundamentals",
  "Cryptographic Primitives",
  "Building the Onion",
  "Peeling the Onion",
  "The Commitment Dance",
  "Success & Failure",
  "Payment Trace Lab",
  "Advanced Topics",
  "Quiz",
  "Pay It Forward",
];

export const CHAPTER_REQUIREMENTS: Record<string, {
  checkpoints: string[];
  exercises: string[];
}> = {
  "intro": { checkpoints: [], exercises: [] },
  "what-each-hop-knows": { checkpoints: ["predict-destination", "predict-bob-info", "fixed-size-reason"], exercises: [] },
  "finding-a-path": { checkpoints: ["gossip-purpose"], exercises: [] },
  "fees-and-timelocks": { checkpoints: ["fee-backward-reason"], exercises: ["exercise-fee-cltv-calculation"] },
  "hop-payloads": { checkpoints: ["final-hop-difference"], exercises: ["exercise-build-tlv-payload"] },
  "shared-secrets": { checkpoints: ["session-key-reason"], exercises: ["exercise-sphinx-init-shared-secrets"] },
  "key-derivation": { checkpoints: ["key-derivation-count"], exercises: ["exercise-derive-hop-keys"] },
  "session-key-blinding": { checkpoints: ["replay-attack"], exercises: ["exercise-ephemeral-key-chain"] },
  "naive-approach": { checkpoints: ["naive-position-leak"], exercises: ["exercise-build-hop-payload"] },
  "the-filler": { checkpoints: ["filler-purpose"], exercises: ["exercise-generate-filler"] },
  "wrapping-layer-by-layer": { checkpoints: ["innermost-hop-first"], exercises: ["exercise-wrap-construct-packet"] },
  "the-final-packet": { checkpoints: ["max-hops"], exercises: [] },
  "perspective-flip": { checkpoints: [], exercises: [] },
  "peeling-a-layer": { checkpoints: ["peel-packet-size", "extend-zeros"], exercises: ["exercise-peel-layer"] },
  "forwarding-and-validation": { checkpoints: ["forward-validation"], exercises: ["exercise-validate-forward", "exercise-end-to-end-verify"] },
  "commitment-dance": { checkpoints: ["commit-before-revoke", "forward-without-commit", "message-count"], exercises: [] },
  "fulfilling-the-payment": { checkpoints: ["preimage-direction"], exercises: [] },
  "failure-handling": { checkpoints: ["error-encryption"], exercises: ["exercise-construct-error"] },
  "failure-codes": { checkpoints: ["stuck-payment", "update-flag"], exercises: ["exercise-unwrap-error"] },
  "payment-trace-lab": { checkpoints: [], exercises: ["exercise-payment-trace"] },
  "route-blinding": { checkpoints: ["blinded-introduction-point"], exercises: [] },
  "keysend": { checkpoints: ["keysend-tradeoff"], exercises: [] },
  "multi-part-payments": { checkpoints: ["mpp-payment-secret"], exercises: [] },
  "bolt8-bridge": { checkpoints: [], exercises: [] },
  "quiz": { checkpoints: ["quiz-privacy-goal", "quiz-fee-direction", "quiz-tlv-field", "quiz-session-key", "quiz-key-count", "quiz-packet-size", "quiz-filler-purpose", "quiz-peel-order", "quiz-error-keys", "quiz-blinding-chain"], exercises: [] },
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

Welcome to **Onion Routing & Lightning Payments**, a deep dive into how the Lightning Network routes payments across multiple hops without any single node learning the full payment path.

In this course, we'll explore how Lightning uses layered encryption (inspired by Tor's onion routing) to build payment packets that protect sender and receiver privacy. We'll walk through the cryptographic primitives, construct onion packets from scratch, peel them layer by layer, and trace how HTLCs propagate across a multi-hop route.

**This course is currently under construction.** Check back soon for chapters, exercises, and interactive content.

> ### Coming Soon
>
> Section structure is visible in the sidebar. Content is being developed and will be released incrementally.`;
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

  // Intro pages use the simple inline markdownToHtml renderer
  if (chapter.kind === "intro") {
    return (
      <div
        className="prose prose-lg max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(md) }}
      />
    );
  }

  // Markdown chapters use the full ReactMarkdown pipeline
  return (
    <div className={`noise-md noise-md-${theme}`} data-testid="container-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
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
          "tlv-payload": () => {
            return <TlvPayloadDiagram />;
          },
          "tlv-byte-breakdown": () => {
            return <TlvByteBreakdownDiagram />;
          },
          "shared-secrets": () => {
            return <SharedSecretsDiagram />;
          },
          "perspective-flip": () => {
            return <PerspectiveFlipDiagram />;
          },
          "validation-flow": () => {
            return <ValidationFlowDiagram />;
          },
          "preimage-flow": () => {
            return <PreimageFlowDiagram />;
          },
          "failure-codes": () => {
            return <FailureCodesDiagram />;
          },
          "route-diagram": () => {
            return <Section1Diagram />;
          },
          "backward-calc": () => {
            return <Section2Diagram />;
          },
          "key-pipeline": () => {
            return <Section3Diagram />;
          },
          "onion-wrapping": () => {
            return <Section4Diagram />;
          },
          "packet-puzzle": () => {
            return <PacketBuilderPuzzle />;
          },
          "onion-peeling": () => {
            return <Section5Diagram />;
          },
          "message-sequence": () => {
            return <Section6Diagram />;
          },
          "error-boomerang": () => {
            return <Section7Diagram />;
          },
          "trace-lab": () => {
            return <Section8Diagram />;
          },
          "illustrated-packet": () => {
            return (
              <PerspectiveProvider>
                <div className="my-8 space-y-4">
                  <div className="flex justify-center">
                    <PerspectiveToggle />
                  </div>
                  <IllustratedOnionPacket />
                  <p className="text-sm text-muted-foreground text-center italic">
                    Click any segment to inspect its byte-level contents. Toggle perspectives
                    to see what each node can (or cannot) decrypt.
                  </p>
                </div>
              </PerspectiveProvider>
            );
          },
          "key-tree": () => {
            return (
              <div className="my-8">
                <KeyDerivationTreeDiagram />
              </div>
            );
          },
          "naive-vs-fixed": () => {
            return (
              <div className="my-8">
                <NaiveVsFixedDiagram />
              </div>
            );
          },
          "filler-visual": () => {
            return (
              <div className="my-8">
                <FillerVisualizationDiagram />
              </div>
            );
          },
          "final-packet": () => {
            return (
              <div className="my-8">
                <FinalPacketDiagram />
              </div>
            );
          },
          "route-blinding-diagram": () => {
            return <RouteBlindingDiagram />;
          },
          "keysend-diagram": () => {
            return <KeysendDiagram />;
          },
          "mpp-diagram": () => {
            return <MppDiagram />;
          },
          "bolt8-bridge-diagram": () => {
            return <Bolt8BridgeDiagram />;
          },
          "course-overview": () => {
            return <CourseOverviewDiagram />;
          },
          "layer-cake": () => {
            return <LayerCakeDiagram />;
          },
          "naive-packet": () => {
            return (
              <div className="my-8">
                <NaivePacketDiagram />
              </div>
            );
          },
          "filler-algorithm": () => {
            return (
              <div className="my-8">
                <FillerAlgorithmDiagram />
              </div>
            );
          },
          "error-unwrap": () => {
            return (
              <div className="my-8">
                <ErrorUnwrapDiagram />
              </div>
            );
          },
          "fee-calc": () => {
            return <FeeCalcDiagram />;
          },
          "cltv-calc": () => {
            return <CltvCalcDiagram />;
          },
          "ecdh-formula": () => {
            return <EcdhFormulaDiagram />;
          },
          "key-derivation-formula": () => {
            return <KeyDerivationFormulaDiagram />;
          },
          "blinding-formula": () => {
            return <BlindingFormulaDiagram />;
          },
          "wrapping-trace": () => {
            return <WrappingTraceDiagram />;
          },
          "validation-checks": () => {
            return <ValidationChecksDiagram />;
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
