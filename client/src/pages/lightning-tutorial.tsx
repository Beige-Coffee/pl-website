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
import DragDropExercise from "../components/DragDropExercise";
import CodeExercise from "../components/CodeExercise";
import Scratchpad from "../components/Scratchpad";
import NodeTerminal from "../components/NodeTerminal";
import ExerciseFileBrowser from "../components/ExerciseFileBrowser";
import TxNotebook from "../components/TxNotebook";
import { CollapsibleItem, CollapsibleGroup } from "../components/CollapsibleSection";
import { LIGHTNING_EXERCISES } from "../data/lightning-exercises";
import { getExerciseGroupContext } from "../lib/exercise-groups";
import TxGenerator from "../components/TxGenerator";
import FundingTxDiagram from "../components/FundingTxDiagram";
import ScriptDebugger from "../components/ScriptDebugger/ScriptDebugger";
import FeedbackWidget from "../components/FeedbackWidget";
import ProfileDropdown from "../components/ProfileDropdown";
import AnnotatedTransaction from "../components/AnnotatedTransaction";
import NotebookRef from "../components/NotebookRef";
import { TX_GENERATORS } from "../data/tx-generators";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { preloadWorker } from "../lib/pyodide-runner";
import { PanelStateContext, usePanelStateProvider, usePanelState } from "../hooks/use-panel-state";
import { useIsMobile } from "../hooks/use-mobile";

// --- Checkpoint questions embedded inline in tutorial chapters ---
export const CHECKPOINT_QUESTIONS: Record<string, {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}> = {
  "funding-multisig": {
    question: "Why does the Lightning Network use a 2-of-2 multisig for the funding transaction?",
    options: [
      "To let either party reclaim the funding output alone if the other disappears",
      "To ensure both parties must cooperate to move funds, enabling trustless off-chain updates",
      "To keep the funding transaction off-chain until both parties decide to close the channel",
      "To reduce fees by using a smaller witness than a normal single-signature output",
    ],
    answer: 1,
    explanation: "A 2-of-2 multisig requires both parties' signatures to spend the funds. This is the foundation of a Lightning channel: since neither party can move funds alone, they can safely negotiate off-chain transactions. Each commitment transaction represents a new state of the channel, and both parties must agree (sign) before any state change takes effect.",
  },
  "pubkey-sorting": {
    question: "Why does BOLT 3 require pubkeys in the funding script to be sorted lexicographically?",
    options: [
      "So both parties independently produce the same script, since the script hash determines the P2WSH address",
      "Sorted keys let Bitcoin Script verify signatures faster, since the interpreter processes them in lexicographic order",
      "Lexicographic sorting makes it harder for an attacker to determine which key belongs to the channel opener",
      "Bitcoin consensus rules require all multisig pubkeys to be lexicographically sorted; unsorted scripts are rejected",
    ],
    answer: 0,
    explanation: "Both parties must independently construct the same funding script because its SHA256 hash determines the P2WSH output address. If they used different key orderings, they'd compute different script hashes and disagree on which output to watch. Lexicographic sorting is a simple, deterministic rule that both parties can follow independently without any communication, ensuring they always produce identical scripts.",
  },
  "revocation-purpose": {
    question: "What does the revocation key enable in a Lightning channel?",
    options: [
      "It allows the channel funder to reclaim their entire balance if the counterparty goes offline for an extended period",
      "It enables either party to close the channel cooperatively without needing to broadcast any transaction to the blockchain",
      "It allows a third-party watchtower to open new payment channels on behalf of the original channel parties",
      "It gives the counterparty the ability to claim ALL channel funds if an old, revoked commitment transaction is broadcast",
    ],
    answer: 3,
    explanation: "The revocation key is the enforcement mechanism behind Lightning's fairness protocol. When a channel state is updated, the old state is 'revoked' by sharing the per-commitment secret. If a party tries to cheat by broadcasting an old commitment transaction, the counterparty can use the revocation key (derived from the shared secret) to claim ALL funds in the channel as a penalty. This makes cheating economically irrational.",
  },
  "revocation-key-construction": {
    question: "Why can't Alice calculate the private key to the Revocation Public Key in her own `to_local` output?",
    options: [
      "Because the revocation public key is generated randomly by the Bitcoin network each time a new commitment is created",
      "Because Alice and Bob use different elliptic curves for their key derivation, making cross-computation impossible",
      "Because it is derived from Bob's Revocation Basepoint, and Bob never reveals the corresponding basepoint secret",
      "Because the revocation private key is destroyed by both parties after the commitment transaction is signed and exchanged",
    ],
    answer: 2,
    explanation: "Alice's Revocation Public Key is created by combining Bob's Revocation Basepoint with Alice's Per-Commitment Point. Since Bob never reveals his Revocation Basepoint Secret, Alice can never compute the corresponding private key. Only Bob can derive it, and only after Alice reveals her Per-Commitment Secret when they advance to a new state. This is what makes the penalty mechanism trustless.",
  },
  "revocation-secret-exchange": {
    question: "When Alice and Bob advance from Channel State 1 to Channel State 2, what does Alice send to Bob?",
    options: [
      "Her Revocation Basepoint Secret along with her newly generated Per-Commitment Point for State 2",
      "Her Per-Commitment Secret for State 1 and her new Per-Commitment Point for the next state",
      "Bob's Revocation Private Key that was used in the State 1 commitment transaction outputs",
      "Her funding private key along with a pre-signed revocation transaction for the old state",
    ],
    answer: 1,
    explanation: "When advancing states, Alice sends Bob two things: (1) her Per-Commitment Secret from the old state (State 1), which allows Bob to derive the Revocation Private Key for Alice's old commitment transaction, and (2) her new Per-Commitment Point for the next state (State 2), so Bob can construct the new Revocation Public Key. The Revocation Basepoint never changes and was already exchanged during channel opening.",
  },
  "csv-purpose": {
    question: "Why does BOLT 3 use OP_CHECKSEQUENCEVERIFY (CSV) in the to_local output?",
    options: [
      "CSV sets a time-based expiration on the channel, automatically closing it and returning funds after a set number of blocks",
      "CSV is required by Bitcoin consensus for all SegWit transactions that spend from P2WSH multisig outputs",
      "CSV enforces a delay before the broadcaster can spend, giving the counterparty time to detect and penalize cheating",
      "CSV prevents the commitment transaction from being included in a block until a specified absolute block height is reached",
    ],
    answer: 2,
    explanation: "The CSV delay in the to_local output creates a window of time during which the counterparty can check if this is an old (revoked) commitment transaction. If it is, they can use the revocation key to claim the funds before the delay expires. Without this delay, a cheating party could broadcast an old state and immediately sweep their to_local output before anyone could react. The delay is measured in blocks (typically 144 = ~1 day) and only applies to the broadcaster's own output.",
  },
  "obscured-commitment": {
    question: "What is the purpose of the obscured commitment number encoded in the locktime and sequence fields?",
    options: [
      "It encrypts the commitment number so that only the channel parties can decode it, but the number itself is visible to anyone who knows the payment basepoints",
      "It prevents miners from censoring commitment transactions by hiding which channel they belong to",
      "It allows nodes to determine how many state updates a channel has undergone by examining only on-chain data, which is needed for revocation",
      "It ensures each commitment transaction has a unique txid, preventing accidental double-spends",
    ],
    answer: 0,
    explanation: "The obscured commitment number XORs the actual commitment number with a value derived from both parties' payment basepoints. This means the number is 'encrypted' in the sense that a random observer cannot determine the commitment number. However, either channel party (who knows both payment basepoints) can decode it. This is useful for identifying which commitment was broadcast and recovering the corresponding per-commitment secret for revocation.",
  },
  "bip32-derivation": {
    question: "Why does our Lightning key derivation scheme use hardened BIP32 derivation (indicated by h or ') for the key family level?",
    options: [
      "Hardened derivation is computationally faster because it skips the elliptic curve multiplication step during child key generation",
      "Hardened derivation produces longer keys (64 bytes instead of 32), providing an additional layer of cryptographic security",
      "Bitcoin Core's wallet only supports hardened derivation paths internally, so non-hardened paths would be incompatible",
      "Hardened derivation prevents a leaked child key from being used to derive sibling keys or the parent key, isolating key families",
    ],
    answer: 3,
    explanation: "In non-hardened BIP32 derivation, knowing a child private key and the parent public key allows computing the parent private key (and thus all sibling keys). This is disastrous for Lightning: if an attacker compromises one channel key, they could derive keys for all other channels. Hardened derivation breaks this chain by using the parent private key directly in the derivation, ensuring that a compromised child key reveals nothing about its siblings or parent.",
  },
  "commitment-secret-algorithm": {
    question: "The BOLT 3 per-commitment secret generation uses a bit-flipping and hashing algorithm. What is the key advantage of this scheme?",
    options: [
      "It allows compact storage of all previous secrets in O(log n) space instead of O(n), using a structure called a shachain",
      "It makes the secrets fully deterministic, so both channel parties can independently regenerate any secret from the shared seed",
      "It ensures that each generated secret is exactly 32 bytes, matching the output size of SHA256 and fitting standard key formats",
      "It produces cryptographically stronger secrets than sequential hashing by incorporating additional entropy at each derivation step",
    ],
    answer: 0,
    explanation: "The bit-flipping algorithm used in BOLT 3 is designed so that the receiver of revealed secrets can store them in a compact 'shachain' structure that uses only O(log n) space while being able to derive any previously revealed secret. This is critical for Lightning because a long-lived channel could have millions of state updates, and storing every individual per-commitment secret would be prohibitively expensive. The shachain allows a node to verify and store secrets efficiently.",
  },
  "htlc-dust": {
    question: "What makes an HTLC 'dust' (trimmed) in the context of commitment transactions?",
    options: [
      "An HTLC is dust if its payment hash has already been revealed, since the preimage is known and the timeout path is void",
      "An HTLC is always classified as dust whenever its value falls below 546 satoshis, regardless of the channel type or fee parameters",
      "An HTLC is only trimmed if both channel parties explicitly negotiate and agree to trim it during the commitment_signed exchange",
      "An HTLC is trimmed when its value minus the second-stage transaction fee drops below the dust limit (anchor channels exclude the fee)",
    ],
    answer: 3,
    explanation: "An HTLC output requires a second-stage transaction (HTLC-timeout or HTLC-success) to be claimed. For non-anchor channels, this second-stage transaction has its own fee cost deducted from the HTLC amount. If the resulting value falls below the dust limit (e.g., 330 sats for P2WSH), the HTLC is 'trimmed' and its value is added to the commitment transaction fee instead. For anchor/zero-fee channels, the second-stage fee is zero (fees are handled later via CPFP), so an HTLC is trimmed only if its raw value is below the dust limit. BOLT 3 specifies these rules in the 'Trimmed Outputs' section.",
  },
  "htlc-timeout-vs-success": {
    question: "What is the key difference between an HTLC-timeout transaction and an HTLC-success transaction?",
    options: [
      "HTLC-timeout uses SIGHASH_SINGLE to allow fee bumping, while HTLC-success uses SIGHASH_ALL to lock all inputs and outputs",
      "HTLC-timeout can only be broadcast by the remote party after channel close, while HTLC-success can only be broadcast by the local party",
      "HTLC-timeout uses locktime=cltv_expiry with an empty witness (timeout path), while HTLC-success uses locktime=0 with the preimage",
      "HTLC-timeout creates a P2PKH output for the claiming party, while HTLC-success creates a P2WSH output requiring a revocation check",
    ],
    answer: 2,
    explanation: "Both HTLC-timeout and HTLC-success are second-stage transactions that spend HTLC outputs from commitment transactions. The HTLC-timeout transaction is used when the HTLC expires without being claimed: it has a locktime equal to the CLTV expiry and passes an empty byte string as the witness (choosing the timeout branch in the script). The HTLC-success transaction is used to claim the HTLC with the preimage: it has locktime 0 (can be broadcast immediately) and includes the 32-byte payment preimage in the witness.",
  },
  "htlc-preimage-purpose": {
    question: "In a multi-hop Lightning payment, why does the payment preimage flow backward (from receiver to sender)?",
    options: [
      "It doesn't flow backward — the preimage travels forward from sender to receiver alongside the payment, unlocking each hop in sequence",
      "Only the receiver knows the preimage. Each hop reveals it to claim funds, creating a chain of settlements back to the sender",
      "The backward flow lets each routing node verify the payment hash against their local records before committing to forward the payment",
      "The preimage is split into cryptographic shares, with each hop holding one piece that must be combined at the destination for security",
    ],
    answer: 1,
    explanation: "The receiver (Dianne) generates a random preimage and includes its hash in the invoice. The sender (Alice) locks funds along each hop using this hash. Payments settle in reverse: Dianne reveals the preimage to Bob to claim her funds, then Bob uses that same preimage to claim funds from Alice. This backward flow is what makes the payment atomic — either every hop gets the preimage and settles, or none do.",
  },
  "htlc-atomicity": {
    question: "In a multi-hop payment (Alice \u2192 Bob \u2192 Dianne), why must the same payment hash be used in every hop's HTLC?",
    options: [
      "It ensures atomicity: when Dianne reveals the preimage to Bob, Bob can immediately use it to claim from Alice",
      "It reduces the total number of public keys that need to be exchanged between routing nodes during channel setup",
      "It allows intermediate Lightning nodes to route payments correctly without needing to know the preimage in advance",
      "It makes each hop's HTLC transaction smaller by allowing witness data to be shared and deduplicated across the route",
    ],
    answer: 0,
    explanation: "Using the same payment hash at every hop is what makes Lightning payments atomic. When Dianne reveals the preimage to claim from Bob, Bob can immediately use that same preimage to claim from Alice, because Alice's HTLC uses the same hash. If different hashes were used, Bob would need a different preimage for Alice's HTLC, which Dianne wouldn't provide. The shared hash creates a chain reaction: once the preimage is revealed anywhere, it can unlock every HTLC along the route.",
  },
  "offered-vs-received": {
    question: "From the commitment transaction holder's perspective, what distinguishes an 'offered' HTLC from a 'received' HTLC?",
    options: [
      "An offered HTLC always uses OP_CHECKLOCKTIMEVERIFY in its script, while a received HTLC always uses OP_CHECKSEQUENCEVERIFY instead",
      "An offered HTLC is one where the holder is paying (forwarding out), while a received HTLC is one where the holder is being paid",
      "An offered HTLC must always be larger in value than a received HTLC, because the routing fee is deducted from the offered amount",
      "An offered HTLC can be revoked using the revocation key if the state updates, but a received HTLC cannot be revoked by either party",
    ],
    answer: 1,
    explanation: "In a commitment transaction, 'offered' and 'received' are relative to the holder. An offered HTLC means the holder has offered to pay (the payment is going out), while a received HTLC means the holder is receiving a payment. The scripts differ because the timeout/claim paths are reversed: for an offered HTLC, the holder reclaims via timeout while the counterparty claims with the preimage; for a received HTLC, the holder claims with the preimage while the counterparty reclaims via timeout.",
  },
  "witness-structure": {
    question: "In a finalized commitment transaction, the witness contains [empty, sig1, sig2, funding_script]. Why is the first element empty?",
    options: [
      "It's a placeholder for a future Taproot upgrade path",
      "It signals to the network that this is a SegWit transaction rather than a legacy transaction",
      "It's padding to ensure the witness data is aligned to 4-byte boundaries",
      "It works around a historical Bitcoin bug in OP_CHECKMULTISIG that pops one extra item off the stack",
    ],
    answer: 3,
    explanation: "OP_CHECKMULTISIG has a well-known off-by-one bug from Bitcoin's early days: it pops one more item off the stack than the number of signatures specified. This extra item is consumed but never used. By convention, this item must be an empty byte string (OP_0). If it were any other value, modern Bitcoin nodes would reject the transaction as non-standard. This bug was never fixed because changing it would require a hard fork.",
  },
  "fee-deduction": {
    question: "In our Alice-opener walkthrough, which output is reduced when Alice constructs her own commitment transaction at a higher feerate?",
    options: [
      "Both `to_local` and `to_remote` are reduced proportionally based on each party's share of the channel balance",
      "Alice's `to_local`, because the channel opener pays the base commitment fee on their own commitment transaction",
      "Bob's `to_remote`, because the non-opening party is always responsible for prepaying the commitment transaction fee",
      "A dedicated fee output is added to the transaction, because commitment fees are tracked separately from channel balances",
    ],
    answer: 1,
    explanation: "In BOLT 3, the channel opener pays the base commitment fee. In our walkthrough Alice is the opener, so on Alice's own commitment transaction the fee comes out of her `to_local` balance. On Bob's commitment transaction, the same rule would reduce Alice's balance on the `to_remote` side instead.",
  },
  "static-remotekey": {
    question: "The to_remote output uses the payment_basepoint directly (P2WPKH) rather than a per-commitment derived key. Why?",
    options: [
      "Per-commitment derivation makes each output unique to a specific state, making it incompatible with standard Bitcoin wallet recovery tools",
      "The payment_basepoint provides stronger security because it is derived through a longer, more complex key derivation path than per-commitment keys",
      "Using the basepoint directly produces a smaller witness and lower fees by skipping the hash operations needed for per-commitment key derivation",
      "With `option_static_remotekey`, the remote party can always sweep their balance with one key, even if they lose channel state data",
    ],
    answer: 3,
    explanation: "Before `option_static_remotekey`, the to_remote output used a per-commitment derived key. This meant that if the remote party lost their channel state data, they couldn't spend their output because they wouldn't know which per-commitment point was used. With static remotekey (now mandatory in the spec), the to_remote output uses the payment_basepoint directly. This means the remote party can always recover their funds using their base private key alone, even without channel state. It's a major reliability improvement.",
  },
  "channel-fairness": {
    question: "In the \"cut and choose\" fairness protocol, why is the cutter incentivized to split the cake evenly?",
    options: [
      "Because the chooser picks first, so an uneven cut guarantees the chooser takes the bigger piece",
      "Because a neutral referee observes the cut and redistributes pieces if the split is judged to be unfair",
      "Because the protocol assigns pieces randomly after the cut, so the cutter gains no advantage from cutting unevenly",
      "Because external rules require the cutter to produce pieces identical by weight, with penalties for any deviation",
    ],
    answer: 0,
    explanation: "In \"cut and choose,\" the cutter's best strategy is to split evenly because the chooser gets to pick first. If the cutter makes one piece bigger, the chooser simply takes the larger piece, leaving the cutter with less. This is a fairness protocol: the rules themselves make cheating a losing strategy, with no need for a trusted third party to enforce fairness.",
  },
  "payment-channels-scaling": {
    question: "How do payment channels help Bitcoin scale?",
    options: [
      "Every payment still settles on-chain, but payment channels let miners validate them in optimized batches for higher throughput",
      "Multiple unrelated channel pairs can merge their balances into one shared UTXO that updates globally, reducing total outputs",
      "Two parties can transact nearly unlimited times off-chain, needing only two on-chain transactions (open and close) for the entire lifetime",
      "They remove the need for on-chain enforcement entirely, since the latest channel state is maintained only in memory by both parties",
    ],
    answer: 2,
    explanation: "Payment channels allow two parties to transact an essentially unlimited number of times off-chain, with only the opening funding transaction and the final closing transaction appearing on the blockchain. This means thousands or millions of payments can occur with just two on-chain transactions, dramatically reducing blockchain load. The security comes from the fact that either party can always enforce the latest state on-chain if needed.",
  },
  "asymmetric-commits": {
    question: "Why do Lightning channels use asymmetric commitment transactions (each party holds a different version)?",
    options: [
      "Asymmetric transactions reduce each party's storage requirements, since they only keep track of their own version of the state",
      "The broadcaster's output is revocable and delayed, while the counterparty can spend immediately, putting the risk on whoever broadcasts",
      "Asymmetry allows each party to independently set a different fee rate when constructing their own version of the commitment transaction",
      "Bitcoin consensus rules for multisig spending require each signer to have a uniquely structured transaction to prevent double-spend conflicts",
    ],
    answer: 1,
    explanation: "In an asymmetric commitment scheme, Alice's version makes HER output delayed and revocable, while Bob's output is immediately spendable (and vice versa for Bob's version). This means the party who broadcasts takes on the risk: they must wait through the CSV delay (during which they can be punished if the state was revoked), while the other party gets their funds immediately. This asymmetry is fundamental to the Lightning penalty mechanism.",
  },
  "course-tools-match": {
    question: "Match each tool or feature to its description.",
    options: [],
    answer: 0,
    explanation: "",
  },
};

type Chapter = {
  id: string;
  title: string;
  section: "Introduction" | "Keys & Derivation" | "Payment Channels" | "Commitment Keys" | "Commitment Txs" | "HTLCs" | "Closing Channels" | "Quiz" | "Pay It Forward";
  kind: "intro" | "md";
  file?: string;
};

export const chapters: Chapter[] = [
  {
    id: "intro",
    title: "Intro to Payment Channels",
    section: "Introduction",
    kind: "intro",
  },
  {
    id: "bitcoin-cli",
    title: "Course Guide",
    section: "Introduction",
    kind: "md",
    file: "/lightning_tutorial/3.4-bitcoin-cli.md",
  },
  {
    id: "protocols-fairness",
    title: "Protocols & Fairness",
    section: "Introduction",
    kind: "md",
    file: "/lightning_tutorial/1.1-protocols-fairness.md",
  },
  {
    id: "keys-manager",
    title: "Key Management",
    section: "Keys & Derivation",
    kind: "md",
    file: "/lightning_tutorial/2.1-keys-manager.md",
  },
  {
    id: "bip32-derivation",
    title: "BIP32 Key Derivation",
    section: "Keys & Derivation",
    kind: "md",
    file: "/lightning_tutorial/2.2-bip32-derivation.md",
  },
  {
    id: "channel-keys",
    title: "Channel Keys & Public Keys",
    section: "Keys & Derivation",
    kind: "md",
    file: "/lightning_tutorial/2.3-channel-keys.md",
  },
  {
    id: "payment-channels-overview",
    title: "Off-Chain Scaling",
    section: "Payment Channels",
    kind: "md",
    file: "/lightning_tutorial/1.2-payment-channels.md",
  },
  {
    id: "funding-script",
    title: "Funding Script",
    section: "Payment Channels",
    kind: "md",
    file: "/lightning_tutorial/3.1-funding-script.md",
  },
  {
    id: "funding-transaction",
    title: "Funding Transaction",
    section: "Payment Channels",
    kind: "md",
    file: "/lightning_tutorial/3.2-funding-transaction.md",
  },
  {
    id: "refund-transactions",
    title: "Refund & Timelocks",
    section: "Payment Channels",
    kind: "md",
    file: "/lightning_tutorial/1.3-refund-transactions.md",
  },
  {
    id: "revocable-transactions",
    title: "Revocable Transactions",
    section: "Payment Channels",
    kind: "md",
    file: "/lightning_tutorial/1.4-revocable-transactions.md",
  },
  {
    id: "signing",
    title: "Transaction Signing",
    section: "Payment Channels",
    kind: "md",
    file: "/lightning_tutorial/3.3-signing.md",
  },
  {
    id: "revocation-keys",
    title: "Revocation Keys",
    section: "Commitment Keys",
    kind: "md",
    file: "/lightning_tutorial/4.1-revocation-keys.md",
  },
  {
    id: "deriving-revocation-keys",
    title: "Deriving Revocation Keys",
    section: "Commitment Keys",
    kind: "md",
    file: "/lightning_tutorial/4.1b-deriving-revocation-keys.md",
  },
  {
    id: "commitment-secrets",
    title: "Commitment Secrets & Per-Commitment Points",
    section: "Commitment Keys",
    kind: "md",
    file: "/lightning_tutorial/4.2-commitment-secrets.md",
  },
  {
    id: "key-derivation",
    title: "Per-Commitment Key Derivation",
    section: "Commitment Keys",
    kind: "md",
    file: "/lightning_tutorial/4.3-key-derivation.md",
  },
  {
    id: "commitment-scripts",
    title: "Commitment Scripts",
    section: "Commitment Txs",
    kind: "md",
    file: "/lightning_tutorial/5.1-commitment-scripts.md",
  },
  {
    id: "obscured-commitment",
    title: "Obscured Commitment Numbers",
    section: "Commitment Txs",
    kind: "md",
    file: "/lightning_tutorial/5.2-obscured-commitment.md",
  },
  {
    id: "commitment-assembly",
    title: "Commitment Transaction Assembly",
    section: "Commitment Txs",
    kind: "md",
    file: "/lightning_tutorial/5.3-commitment-assembly.md",
  },
  {
    id: "commitment-finalization",
    title: "Signing the Commitment Transaction",
    section: "Commitment Txs",
    kind: "md",
    file: "/lightning_tutorial/5.4-commitment-finalization.md",
  },
  {
    id: "get-commitment-tx",
    title: "Inspect Commitment Transaction",
    section: "Commitment Txs",
    kind: "md",
    file: "/lightning_tutorial/5.5-get-commitment-tx.md",
  },
  {
    id: "open-channel",
    title: "Channel Open",
    section: "Commitment Txs",
    kind: "md",
    file: "/lightning_tutorial/5.6-open-channel.md",
  },
  {
    id: "routing-payments",
    title: "Routing Payments",
    section: "HTLCs",
    kind: "md",
    file: "/lightning_tutorial/6.1-routing-payments.md",
  },
  {
    id: "htlc-introduction",
    title: "Introduction to HTLCs",
    section: "HTLCs",
    kind: "md",
    file: "/lightning_tutorial/6.2-htlc-introduction.md",
  },
  {
    id: "simple-htlc",
    title: "Simple HTLC Example",
    section: "HTLCs",
    kind: "md",
    file: "/lightning_tutorial/6.3-simple-htlc.md",
  },
  {
    id: "htlcs-on-lightning",
    title: "HTLCs on Lightning",
    section: "HTLCs",
    kind: "md",
    file: "/lightning_tutorial/6.4-htlcs-on-lightning.md",
  },
  {
    id: "channel-state-updates",
    title: "Channel State Updates",
    section: "HTLCs",
    kind: "md",
    file: "/lightning_tutorial/6.5-channel-state-updates.md",
  },
  {
    id: "offered-htlcs",
    title: "Offered HTLCs",
    section: "HTLCs",
    kind: "md",
    file: "/lightning_tutorial/6.6-offered-htlcs.md",
  },
  {
    id: "received-htlcs",
    title: "Received HTLCs",
    section: "HTLCs",
    kind: "md",
    file: "/lightning_tutorial/6.7-received-htlcs.md",
  },
  {
    id: "htlc-fees-dust",
    title: "HTLC Commitment Outputs",
    section: "HTLCs",
    kind: "md",
    file: "/lightning_tutorial/6.8-htlc-fees-dust.md",
  },
  {
    id: "get-htlc-commitment",
    title: "Inspect HTLC Commitment",
    section: "HTLCs",
    kind: "md",
    file: "/lightning_tutorial/6.9-get-htlc-commitment.md",
  },
  {
    id: "get-htlc-timeout",
    title: "Inspect HTLC Timeout",
    section: "HTLCs",
    kind: "md",
    file: "/lightning_tutorial/6.10-get-htlc-timeout.md",
  },
  {
    id: "closing-channels",
    title: "Closing Channels",
    section: "Closing Channels",
    kind: "md",
    file: "/lightning_tutorial/7.1-closing-channels.md",
  },
  {
    id: "quiz",
    title: "Test Your Knowledge",
    section: "Quiz",
    kind: "md",
    file: "/lightning_tutorial/8.1-quiz.md",
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
  "Keys & Derivation",
  "Payment Channels",
  "Commitment Keys",
  "Commitment Txs",
  "HTLCs",
  "Closing Channels",
  "Quiz",
  "Pay It Forward",
];

export const CHAPTER_REQUIREMENTS: Record<string, {
  checkpoints: string[];
  exercises: string[];
}> = {
  "intro": { checkpoints: [], exercises: [] },
  "bitcoin-cli": { checkpoints: ["course-tools-match"], exercises: [] },
  "protocols-fairness": { checkpoints: ["channel-fairness"], exercises: [] },
  "keys-manager": { checkpoints: [], exercises: [] },
  "bip32-derivation": { checkpoints: ["bip32-derivation"], exercises: [] },
  "channel-keys": { checkpoints: [], exercises: ["ln-exercise-channel-key-manager"] },
  "payment-channels-overview": { checkpoints: ["payment-channels-scaling"], exercises: [] },
  "funding-script": { checkpoints: ["funding-multisig", "pubkey-sorting"], exercises: ["ln-exercise-funding-script"] },
  "funding-transaction": { checkpoints: [], exercises: ["ln-exercise-funding-tx", "gen-funding"] },
  "refund-transactions": { checkpoints: [], exercises: [] },
  "revocable-transactions": { checkpoints: ["asymmetric-commits"], exercises: [] },
  "signing": { checkpoints: [], exercises: ["ln-exercise-sign-input"] },
  "open-channel": { checkpoints: [], exercises: [] },
  "revocation-keys": { checkpoints: ["revocation-purpose", "revocation-key-construction", "revocation-secret-exchange"], exercises: [] },
  "deriving-revocation-keys": { checkpoints: [], exercises: ["ln-exercise-revocation-pubkey", "ln-exercise-revocation-privkey"] },
  "commitment-secrets": { checkpoints: ["commitment-secret-algorithm"], exercises: ["ln-exercise-commitment-secret", "ln-exercise-per-commitment-point"] },
  "key-derivation": { checkpoints: [], exercises: ["ln-exercise-derive-pubkey", "ln-exercise-derive-privkey", "ln-exercise-get-commitment-keys"] },
  "commitment-scripts": { checkpoints: ["static-remotekey", "csv-purpose"], exercises: ["ln-exercise-to-remote-script", "ln-exercise-to-local-script"] },
  "obscured-commitment": { checkpoints: ["obscured-commitment"], exercises: ["ln-exercise-obscure-factor", "ln-exercise-obscured-commitment"] },
  "commitment-assembly": { checkpoints: ["fee-deduction"], exercises: ["ln-exercise-commitment-outputs", "ln-exercise-sort-outputs", "ln-exercise-commitment-tx"] },
  "commitment-finalization": { checkpoints: ["witness-structure"], exercises: ["ln-exercise-finalize-commitment"] },
  "get-commitment-tx": { checkpoints: [], exercises: ["gen-commitment"] },
  "routing-payments": { checkpoints: [], exercises: [] },
  "htlc-introduction": { checkpoints: ["htlc-preimage-purpose"], exercises: [] },
  "simple-htlc": { checkpoints: [], exercises: [] },
  "htlcs-on-lightning": { checkpoints: ["htlc-atomicity"], exercises: [] },
  "channel-state-updates": { checkpoints: [], exercises: [] },
  "offered-htlcs": { checkpoints: ["offered-vs-received"], exercises: ["ln-exercise-offered-htlc-script", "ln-exercise-htlc-timeout-tx", "ln-exercise-finalize-htlc-timeout"] },
  "get-htlc-commitment": { checkpoints: [], exercises: ["gen-htlc-commitment"] },
  "get-htlc-timeout": { checkpoints: [], exercises: ["gen-htlc-timeout"] },
  "received-htlcs": { checkpoints: ["htlc-timeout-vs-success"], exercises: ["ln-exercise-received-htlc-script", "ln-exercise-htlc-success-tx", "ln-exercise-finalize-htlc-success"] },
  "htlc-fees-dust": { checkpoints: ["htlc-dust"], exercises: ["ln-exercise-htlc-outputs", "ln-exercise-commitment-tx-htlc"] },
  "closing-channels": { checkpoints: [], exercises: [] },
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
        result[chapter.id] = getProgress(`chapter-read:${chapter.id}`) === "1"
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
  return `# Programming Lightning: Intro to Payment Channels

Welcome to **Programming Lightning**, a comprehensive course that teaches you how to program a Lightning payment channel from scratch! By the end of this course, your implementation will pass some of the major [BOLT 3 Test Vectors](https://github.com/lightning/bolts/blob/master/03-transactions.md#appendix-b-funding-transaction-test-vectors). Test Vectors are pre-defined inputs and expected outputs that verify your code correctly implements the protocol. Passing these tests means your implementation is on its way to being interoperable with production Lightning implementations like LND, LDK, Eclair, and Core Lightning, and you'll be on your way to becoming a Lightning Zen Master 😎

In this course, we'll build payment channels from the ground up, starting with our Lightning wallet. Once we have that foundation, we'll explore the simplest possible payment channel and examine its limitations. Then, step by step, we'll address each weakness and build toward a full, BOLT-compliant Lightning channel in all its glory.

## Prerequisites

This course assumes you have already read or understand the information contained in **Mastering Bitcoin** and/or **Programming Bitcoin**. To get the most out of this course, you should have a working understanding of Bitcoin transactions and script. If you'd like to brush up beforehand, here are a few excellent resources:
- [Learn Me a Bitcoin: Script](https://learnmeabitcoin.com/technical/script/)
- [Learn Me a Bitcoin: Transactions](https://learnmeabitcoin.com/technical/transaction/)
- [Base58: Bitcoin Transactions](https://www.udemy.com/course/base58-bitcoin-transactions-one/)

> ### ⚡ Earn sats as you learn! ⚡
>
> This tutorial rewards you with real bitcoin for successfully completing checkpoint quizzes and coding exercises. You can redeem your earnings using any wallet that supports LNURL withdrawal, or link a Lightning Address to your account for automatic payouts. Sign in first, then click the [profile icon](#open-profile) in the top-right corner to set it up!`;
}

function LightningTutorialShell({ activeId }: { activeId: string }) {
  // ?fresh=1 clears all tutorial caches and reloads with a clean slate
  useState(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("fresh") === "1") {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("pl-checkpoint-") || key.startsWith("pl-exercise-") || key === "pl-auth-cache" || key === "pl-progress-cache")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      params.delete("fresh");
      const clean = params.toString();
      window.location.replace(window.location.pathname + (clean ? `?${clean}` : ""));
    }
  });

  const [location, setLocation] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useIsMobile();
  const auth = useAuth();
  const { authenticated, loading: authLoading, logout, loginWithToken, setLightningAddress } = auth;
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Tutorial mode: "read" (checkpoints only) or "code" (coding exercises)
  // URL param takes priority (set from blog page), then falls back to localStorage
  const [tutorialMode] = useState<"read" | "code">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("mode");
      if (mode === "code") {
        localStorage.setItem("pl-ln-tutorial-mode", "code");
        return "code";
      }
      if (mode === "read") {
        localStorage.removeItem("pl-ln-tutorial-mode");
        return "read";
      }
      const stored = localStorage.getItem("pl-ln-tutorial-mode");
      if (stored === "code") return "code";
    }
    return "read";
  });

  const progress = useProgress(auth.sessionToken);
  const chapterCompletion = useChapterCompletion(
    auth.completedCheckpoints,
    progress.getProgress,
    tutorialMode,
    auth.rewardClaimed,
  );

  // Pre-warm Pyodide worker as soon as the tutorial page loads
  // (downloading + installing packages takes ~10-15s on first visit)
  useEffect(() => { preloadWorker(); }, []);

  // Save current chapter for "Continue Where You Left Off" on home page
  useEffect(() => {
    try { localStorage.setItem("pl-lightning-last-chapter", activeId); } catch {}
  }, [activeId]);

  // On mount: sync localStorage DragDrop completions to server + local state
  // so sidebar checkmarks appear immediately without navigating to each page
  const localSyncDone = useRef(false);
  useEffect(() => {
    if (!auth.sessionToken || auth.loading || localSyncDone.current) return;
    localSyncDone.current = true;

    const userSuffix = `-${auth.sessionToken.slice(0, 8)}`;
    const completedSet = new Set(auth.completedCheckpoints.map(c => c.checkpointId));

    // Collect all checkpoint IDs across chapters
    const allCheckpointIds = new Set<string>();
    for (const reqs of Object.values(CHAPTER_REQUIREMENTS)) {
      for (const cpId of reqs.checkpoints) allCheckpointIds.add(cpId);
    }

    for (const cpId of allCheckpointIds) {
      if (completedSet.has(cpId)) continue;
      try {
        const raw = localStorage.getItem(`pl-dragdrop-${cpId}${userSuffix}`);
        if (!raw) continue;
        const state = JSON.parse(raw);
        if (!state.submitted || !state.correct) continue;

        // Update local state so sidebar shows checkmark immediately
        auth.markCheckpointCompleted(cpId);
        // Persist to server
        fetch("/api/checkpoint/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.sessionToken}`,
          },
          body: JSON.stringify({ checkpointId: cpId, answer: 0 }),
        }).catch(() => {});
      } catch {}
    }
  }, [auth.sessionToken, auth.loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);
  const toolPanelActiveRef = useRef(false);

  // One-time tooltip for TOOLS button
  const [toolsTooltipVisible, setToolsTooltipVisible] = useState(false);
  useEffect(() => {
    if (tutorialMode !== "code") return;
    try {
      if (localStorage.getItem("pl-tools-tooltip-shown")) return;
    } catch { return; }
    const timer = setTimeout(() => {
      setToolsTooltipVisible(true);
      const dismiss = setTimeout(() => {
        setToolsTooltipVisible(false);
        try { localStorage.setItem("pl-tools-tooltip-shown", "true"); } catch {}
      }, 8000);
      return () => clearTimeout(dismiss);
    }, 3000);
    return () => clearTimeout(timer);
  }, [tutorialMode]);

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

  // Always start at the top on page load / refresh.
  // useLayoutEffect runs before paint to prevent visible scroll jumps.
  useLayoutEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    // Disable browser scroll anchoring — it causes unexpected jumps when
    // exercises/checkpoints change state and DOM heights shift.
    document.documentElement.style.overflowAnchor = "none";
    window.scrollTo(0, 0);
    return () => { document.documentElement.style.overflowAnchor = ""; };
  }, []);

  // Track chapter switches: save scroll position of outgoing chapter,
  // scroll to top for the new chapter. Scroll restore only happens
  // for in-session chapter navigation, NOT on page refresh.
  const prevChapterRef = useRef(activeId);
  const programmaticScrollRef = useRef(false);
  const visitedChaptersRef = useRef(new Set<string>());
  useEffect(() => {
    if (prevChapterRef.current !== activeId) {
      // Save outgoing chapter's scroll position
      try {
        sessionStorage.setItem(
          `pl-scroll-${prevChapterRef.current}`,
          String(window.scrollY),
        );
      } catch {}
      // Mark the outgoing chapter as visited this session
      visitedChaptersRef.current.add(prevChapterRef.current);
      prevChapterRef.current = activeId;

      // Save last chapter for "Continue Where You Left Off"
      try { localStorage.setItem("pl-lightning-last-chapter", activeId); } catch {}

      // Restore scroll if we visited this chapter earlier in the session
      const saved = visitedChaptersRef.current.has(activeId)
        ? sessionStorage.getItem(`pl-scroll-${activeId}`)
        : null;
      const y = saved ? parseInt(saved, 10) : 0;

      programmaticScrollRef.current = true;
      window.scrollTo(0, isNaN(y) ? 0 : y);
      setTimeout(() => { programmaticScrollRef.current = false; }, 100);
    }
  }, [activeId]);

  // Save scroll position when navigating between chapters (user-initiated only).
  // Restored in the activeId-change effect above, NOT on page refresh.
  useEffect(() => {
    const onScroll = () => {
      if (programmaticScrollRef.current) return;
      try {
        sessionStorage.setItem(`pl-scroll-${activeId}`, String(window.scrollY));
      } catch {}
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [activeId]);

  // Wrap markCheckpointCompleted to preserve scroll position.
  // Completing a checkpoint triggers a state update that re-renders the page,
  // which can cause the browser to jump to a different scroll position.
  const stableMarkCompleted = useCallback((id: string, amountSats?: number) => {
    const scrollY = window.scrollY;
    auth.markCheckpointCompleted(id, amountSats);
    // Restore scroll position after React re-renders
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  }, [auth.markCheckpointCompleted]);

  // Close tools dropdown on click outside (only when no tool panel is open)
  useEffect(() => {
    if (!toolsOpen) return;
    const handler = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node) && !toolPanelActiveRef.current) {
        setToolsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [toolsOpen]);

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
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

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

  // Panel state for content-compressing side panels
  const panelState = usePanelStateProvider();
  const panelPadding = isMobile ? 0 : (panelState.activePanel ? panelState.panelWidth : 0);
  const panelTransition = panelState.isDragging ? "none" : "padding-right 300ms cubic-bezier(0.4, 0, 0.2, 1)";

  // Keep ref in sync for the click-outside handler (which runs before panelState is available)
  useEffect(() => {
    toolPanelActiveRef.current = !!panelState.activePanel;
  }, [panelState.activePanel]);

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
            Payment Channels Tutorial
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
            className={`p-2 md:p-2 transition-colors ${theme === "dark" ? "text-slate-300 hover:text-slate-100" : "text-foreground/70 hover:text-foreground"}`}
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
          gridTemplateColumns: isMobile ? '1fr' : (sidebarCollapsed ? `60px minmax(0, 1fr)` : `360px minmax(0, 1fr)`),
        }}
      >
        {mobileNavOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileNavOpen(false)}
            data-testid="overlay-mobile-nav"
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
              const items = grouped.get(section) ?? [];
              if (!items.length) return null;
              const isSectionCollapsed = collapsedSections.has(section);
              const trackableItems = items.filter(c => c.id !== "pay-it-forward");
              const completedInSection = trackableItems.filter(c => chapterCompletion[c.id] === "complete").length;
              const totalInSection = trackableItems.length;
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
                        <span className={`text-[11px] font-pixel ${completedInSection === totalInSection ? (theme === "dark" ? "text-green-400" : "text-green-600") : "opacity-50"}`}>
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
                      const href = c.id === "intro" ? "/lightning-tutorial" : `/lightning-tutorial/${c.id}`;
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
                                  {showExercises && reqs.exercises.map((exId) => {
                                    const isGen = exId.startsWith("gen-");
                                    return (
                                      <Tooltip key={exId} delayDuration={200}>
                                        <TooltipTrigger asChild>
                                          <span className={`font-mono text-[13px] leading-none font-bold cursor-default ${completedIds.has(exId) ? lit : dim}`}>{isGen ? ">_" : "</>"}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className={tooltipClass}>
                                          {completedIds.has(exId)
                                            ? (isGen ? "Generator complete" : "Exercise complete")
                                            : (isGen ? "TX Generator" : "Coding exercise")}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })}
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
                progress={progress}
              />
            )}

            <div className={`mt-10 pt-6 border-t ${theme === "dark" ? "border-[#1f2a44]" : "border-border"} flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3`}>
              {prev ? (
                <Link
                  href={prev.id === "intro" ? "/lightning-tutorial" : `/lightning-tutorial/${prev.id}`}
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
                  href={next.id === "intro" ? "/lightning-tutorial" : `/lightning-tutorial/${next.id}`}
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

      {tutorialMode === "code" && (
        <>
          {/* Tools dropdown */}
          <div
            ref={toolsRef}
            className={`fixed top-[78px] z-40 hidden lg:block border-2 rounded ${
              theme === "dark"
                ? "bg-[#0b1220] border-[#2a3552]"
                : "bg-[#fdf9f2] border-[#d4c9a8]"
            }`}
            style={{ right: panelPadding + 16, transition: panelTransition, padding: "8px 10px" }}
          >
            <button
              data-testid="button-desktop-tools-toggle"
              onClick={() => {
                setToolsOpen((o) => !o);
                if (toolsTooltipVisible) {
                  setToolsTooltipVisible(false);
                  try { localStorage.setItem("pl-tools-tooltip-shown", "true"); } catch {}
                }
              }}
              className={`flex items-center gap-2 font-pixel text-[14px] tracking-wide cursor-pointer ${
                theme === "dark"
                  ? "text-slate-300 hover:text-slate-100"
                  : "text-foreground/70 hover:text-foreground"
              }`}
            >
              <span>TOOLS</span>
              <span className={`text-[10px] transition-transform ${toolsOpen ? "" : "-rotate-90"}`}>&#9660;</span>
            </button>
            {toolsTooltipVisible && (
              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 text-sm rounded border-2 shadow-lg whitespace-nowrap z-50 animate-in fade-in duration-300 ${
                  theme === "dark"
                    ? "bg-[#0f1930] border-[#FFD700] text-slate-200"
                    : "bg-card border-[#b8860b] text-foreground"
                }`}
                style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                onClick={() => {
                  setToolsTooltipVisible(false);
                  try { localStorage.setItem("pl-tools-tooltip-shown", "true"); } catch {}
                }}
              >
                Use TOOLS to access your Scratchpad, Bitcoin Node, and Transactions
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent ${
                  theme === "dark" ? "border-b-[#FFD700]" : "border-b-[#b8860b]"
                }`} />
              </div>
            )}
            {toolsOpen && (
              <>
                <div className={`h-[2px] mt-2 mb-2 ${theme === "dark" ? "bg-[#2a3552]" : "bg-[#d4c9a8]"}`} />
                <div className="grid gap-1">
                  {[
                    { label: "Scratchpad", panelId: "scratchpad" as const, testId: "button-desktop-tool-scratchpad" },
                    { label: "Bitcoin Node", panelId: "node" as const, testId: "button-desktop-tool-node" },
                    { label: "Transactions", panelId: "notebook" as const, testId: "button-desktop-tool-notebook" },
                    { label: "Files", panelId: null, testId: "button-desktop-tool-files" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      data-testid={item.testId}
                      onClick={() => {
                        if (item.panelId) {
                          panelState.switchPanel(item.panelId);
                        } else {
                          setFileBrowserOpen(true);
                        }
                      }}
                      className={`w-full text-left border-2 px-3 py-1.5 transition-colors cursor-pointer ${
                        theme === "dark"
                          ? "bg-[#0f1930] border-[#2a3552] text-slate-100 hover:bg-[#132043]"
                          : "bg-card border-[#d4c9a8] text-foreground hover:bg-secondary"
                      }`}
                    >
                      <div className="text-[16px] leading-snug" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>{item.label}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Mobile TOOLS FAB */}
          {isMobile && (
            <>
              {mobileToolsOpen && (
                <div className="fixed inset-0 z-50" onClick={() => setMobileToolsOpen(false)}>
                  <div className="absolute inset-0 bg-black/40" />
                  <div className={`absolute bottom-0 inset-x-0 z-50 border-t-2 ${
                    theme === "dark"
                      ? "bg-[#0b1220] border-[#2a3552]"
                      : "bg-[#fdf9f2] border-[#d4c9a8]"
                  }`} data-testid="container-mobile-tools-menu" onClick={(e) => e.stopPropagation()}>
                    <div className={`font-pixel text-[10px] px-4 pt-3 pb-1 ${theme === "dark" ? "text-[#FFD700]" : "text-[#9a7200]"}`}>TOOLS</div>
                    <div className="grid grid-cols-2 gap-2 p-3">
                      {[
                        { label: "Scratchpad", icon: "\u270F", panelId: "scratchpad" as const, testId: "button-mobile-tool-scratchpad" },
                        { label: "Bitcoin Node", icon: "\u26A1", panelId: "node" as const, testId: "button-mobile-tool-node" },
                        { label: "Transactions", icon: "\u2B1A", panelId: "notebook" as const, testId: "button-mobile-tool-notebook" },
                        { label: "Files", icon: "\u{1F4C1}", panelId: null, testId: "button-mobile-tool-files" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          data-testid={item.testId}
                          onClick={() => {
                            if (item.panelId) {
                              panelState.switchPanel(item.panelId);
                            } else {
                              setFileBrowserOpen(true);
                            }
                            setMobileToolsOpen(false);
                          }}
                          className={`w-full text-left border-2 px-3 py-3 min-h-[52px] transition-colors cursor-pointer ${
                            theme === "dark"
                              ? "bg-[#0f1930] border-[#2a3552] text-slate-100 hover:bg-[#132043] active:bg-[#1a2a50]"
                              : "bg-card border-[#d4c9a8] text-foreground hover:bg-secondary active:bg-secondary/80"
                          }`}
                        >
                          <div className="text-lg mb-0.5">{item.icon}</div>
                          <div className="text-sm leading-snug" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>{item.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => setMobileToolsOpen((o) => !o)}
                className={`fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full border-2 shadow-lg flex items-center justify-center ${
                  theme === "dark"
                    ? "bg-[#0f1930] border-[#FFD700] text-[#FFD700]"
                    : "bg-[#fdf9f2] border-[#b8860b] text-[#9a7200]"
                }`}
                data-testid="button-mobile-tools-toggle"
              >
                {mobileToolsOpen ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                )}
              </button>
            </>
          )}

          <Scratchpad theme={theme} />
          <NodeTerminal theme={theme} sessionToken={auth.sessionToken} authenticated={authenticated} />
          {fileBrowserOpen && (
            <ExerciseFileBrowser
              currentExerciseId=""
              theme={theme}
              onClose={() => setFileBrowserOpen(false)}
            />
          )}
          <TxNotebook theme={theme} />
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

          {/* Name & Message - optional */}
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

export const QUIZ_QUESTIONS = [
  {
    question: "Alice funds a Lightning channel but the funding output only requires her signature (1-of-2 instead of 2-of-2). What can go wrong?",
    options: [
      "Alice can steal funds by publishing any state she wants, since Bob's signature is not needed to spend",
      "Bob cannot verify the funding transaction because Alice's public key is hidden from him",
      "The channel is rejected by Bitcoin nodes because 1-of-2 multisig outputs are non-standard",
      "Nothing changes because the commitment transactions still require both signatures to update",
    ],
    answer: 0,
    explanation: "The entire Lightning penalty mechanism depends on both parties needing to cooperate (2-of-2 multisig) to move funds. If only Alice's signature were required, she could broadcast any commitment transaction she wants without Bob's agreement. The 2-of-2 multisig is the foundational constraint that forces both parties to negotiate honestly, because neither can move funds alone.",
  },
  {
    question: "An attacker compromises one channel key derived with non-hardened BIP32 and also knows the parent extended public key. What can they do?",
    options: [
      "Nothing beyond spending from the single compromised channel",
      "They can identify the node's IP address from the key material",
      "They can force-close the compromised channel but not access others",
      "They can compute the parent private key and derive every sibling key",
    ],
    answer: 3,
    explanation: "In non-hardened BIP32 derivation, knowing a child private key plus the parent extended public key lets an attacker compute the parent private key using simple subtraction. From there, they can derive every sibling key. Hardened derivation prevents this by using the parent private key in the HMAC input, breaking the mathematical relationship that enables this attack.",
  },
  {
    question: "Alice and Bob want to advance from state 3 to state 4, but Alice refuses to reveal her per-commitment secret for state 3. What is the consequence?",
    options: [
      "Bob can still derive the revocation key using only his own basepoint secret",
      "The channel is automatically force-closed by the Bitcoin network after a timeout",
      "Bob cannot penalize Alice if she later broadcasts state 3, so he should refuse to sign state 4",
      "Alice's state 3 commitment becomes permanently unspendable on-chain",
    ],
    answer: 2,
    explanation: "The per-commitment secret is what allows Bob to derive the revocation private key for Alice's old commitment. Without it, Bob has no way to penalize Alice if she broadcasts state 3. In practice, Bob should refuse to sign the new state until Alice reveals the old secret. This exchange is a critical step in the BOLT commitment update protocol.",
  },
  {
    question: "Alice broadcasts her own commitment transaction. Which output has a CSV delay and why?",
    options: [
      "Alice's to_local output is delayed, giving Bob time to check for revocation and claim a penalty",
      "Bob's to_remote output is delayed, giving Alice time to verify the payment amounts are correct",
      "Both outputs are delayed equally so miners cannot front-run either party's spend attempt",
      "Neither output is delayed because CSV only applies to HTLC second-stage transactions",
    ],
    answer: 0,
    explanation: "When Alice broadcasts, she is the 'local' party. Her to_local output has a CSV delay (e.g. 144 blocks) during which Bob can check whether this is a revoked state. If it is, Bob uses the revocation key to sweep all funds before Alice's delay expires. Bob's to_remote output pays out immediately with no delay, because Bob is the non-broadcasting party and bears no risk of being penalized.",
  },
  {
    question: "Why might a routing node negotiate a longer CSV delay (e.g. 2016 blocks) for channels with a new, unknown peer?",
    options: [
      "Longer delays reduce the on-chain transaction fee when a commitment is broadcast",
      "A longer delay gives the node more time to detect and respond to a cheating attempt",
      "Longer CSV values compress the script and make the commitment transaction smaller",
      "A longer delay prevents the peer from opening additional channels until the first closes",
    ],
    answer: 1,
    explanation: "The CSV delay is the window during which the non-broadcasting party can detect a revoked commitment and submit a penalty transaction. A longer delay means more time to react, which is important if a node might be offline for extended periods or if the peer is untrusted. The tradeoff is that legitimate force-closes also take longer to settle.",
  },
  {
    question: "A 500-sat HTLC is trimmed from a commitment transaction because it falls below the dust threshold. Where does that 500 sats go?",
    options: [
      "It is returned to the sender's on-chain wallet as a separate refund output",
      "It is permanently destroyed and removed from the channel's total balance",
      "It remains locked in the funding output until the channel is cooperatively closed",
      "It is folded into the commitment transaction fee, collected by the miner who confirms it",
    ],
    answer: 3,
    explanation: "When an HTLC is trimmed (dust), it is excluded from the commitment transaction as an output but still tracked off-chain. The trimmed HTLC's value is effectively added to the transaction fee, since the outputs sum to less than the input. If the commitment is broadcast, a miner collects that value. This is acceptable because the amount is so small that creating a spendable output for it would cost more in fees than it is worth.",
  },
  {
    question: "You are inspecting a second-stage HTLC transaction's witness and see a 32-byte preimage. What type of transaction is this?",
    options: [
      "An HTLC-success transaction, because only the claim path includes the payment preimage",
      "An HTLC-timeout transaction, because the preimage proves the payment window expired",
      "A penalty transaction, because the 32-byte value is a per-commitment secret for revocation",
      "A cooperative close transaction, because the preimage serves as mutual agreement to settle",
    ],
    answer: 0,
    explanation: "The HTLC-success transaction claims an HTLC by revealing the payment preimage in its witness, satisfying the hash check in the HTLC script. The HTLC-timeout transaction uses the timeout path instead, passing an empty byte string where the preimage would go, with its locktime set to the CLTV expiry to enforce the timeout condition.",
  },
  {
    question: "A developer builds a commitment witness as [sig_alice, sig_bob, funding_script] without the leading empty element. What happens?",
    options: [
      "The transaction is valid but pays a higher fee due to the missing witness discount",
      "The signatures are checked in reverse order, causing multisig verification to fail silently",
      "OP_CHECKMULTISIG consumes sig_alice as the dummy element, leaving only one signature, so it fails",
      "The transaction confirms normally because modern SegWit rules removed the dummy requirement",
    ],
    answer: 2,
    explanation: "OP_CHECKMULTISIG has a historical off-by-one bug: it pops one extra item beyond the specified number of signatures. Without the leading empty element (OP_0), it consumes the first real signature as the dummy, leaving only one valid signature for a 2-of-2 check. The verification fails. This bug was never fixed because doing so would require a hard fork.",
  },
  {
    question: "Bob's node suffers a catastrophic failure and he loses all channel state data. Alice force-closes the channel. Can Bob recover his funds?",
    options: [
      "No, Bob needs the per-commitment point to derive the key for his to_remote output",
      "Yes, if the channel used option_static_remotekey, his output uses his base payment key directly",
      "Yes, but only if a watchtower had a backup of his latest commitment transaction",
      "No, the to_remote output requires both Bob's signature and a CSV delay to have passed",
    ],
    answer: 1,
    explanation: "With option_static_remotekey (now mandatory in the spec), the to_remote output uses Bob's payment_basepoint directly as a P2WPKH output. Bob can sweep it using just his base private key, without any channel state. Before static remotekey, the output used a per-commitment derived key, meaning Bob would need to know which commitment was broadcast to derive the correct spending key.",
  },
  {
    question: "A channel has been open for a year with 500,000 state updates. How many per-commitment secrets must Bob store to penalize any revoked state?",
    options: [
      "All 500,000, since each revoked state requires its own unique stored secret",
      "Only the most recent one, since all older secrets can be derived from it by hashing",
      "None, because secrets are regenerated on demand from the channel seed by both parties",
      "About 19, because the shachain stores O(log n) secrets and log2(500,000) is roughly 19",
    ],
    answer: 3,
    explanation: "The BOLT 3 per-commitment secret scheme uses a binary tree structure (shachain) where each revealed secret can derive certain other secrets through hashing. The receiver only needs to store O(log n) secrets to reconstruct any of the n revealed secrets. For 500,000 updates, log2(500,000) is approximately 19, so Bob stores about 19 secrets instead of half a million.",
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
}: {
  theme: "light" | "dark";
  authenticated: boolean;
  rewardClaimed: boolean;
  sessionToken: string | null;
  emailVerified: boolean;
  pubkey: string | null;
  lightningAddress: string | null;
  onLoginRequest: () => void;
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
      try { localStorage.setItem(quizStorageKey, JSON.stringify(next)); } catch {}
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
      // Small delay so the UI renders the congrats first
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
        body: JSON.stringify({ answers: selections, quizId: "lightning" }),
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
        Quiz: Lightning Payment Channels
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
              ? `You passed with ${percentage}%! You've mastered Lightning Payment Channels.`
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

function CopyButton({ text, theme }: { text: string; theme: "light" | "dark" }) {
  const [copied, setCopied] = useState(false);
  const dark = theme === "dark";
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`absolute top-2 right-2 text-xs px-2 py-1 rounded border transition-all cursor-pointer
        opacity-0 group-hover:opacity-100
        ${dark
          ? "bg-white/10 border-white/20 text-slate-300 hover:bg-white/20"
          : "bg-white/80 border-black/10 text-black/50 hover:bg-white hover:text-black/70"
        }`}
      style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
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
  progress,
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
  progress: ReturnType<typeof useProgress>;
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
            "Couldn't load this chapter. If you're on a deployed URL, make sure the markdown files are included under client/public/lightning_tutorial/."
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
      .replaceAll('src="./tutorial_images/', 'src="/lightning_tutorial/tutorial_images/')
      .replaceAll("src='./tutorial_images/", "src='/lightning_tutorial/tutorial_images/");
  };

  // Move exercise intro text (heading + prose immediately before <code-intro>) into the card.
  // Uses a callback to find the last heading before each <code-intro>, capturing only
  // the content from that final heading to the tag (not earlier headings).
  const extractExerciseIntros = (raw: string) => {
    return raw.replace(
      /(#{2,3}\s+⚡️?\s*[^\n]*\n)((?:(?!#{2,3}\s)[\s\S])*?)(<code-intro\s)/g,
      (_match, _heading, content, tag) => {
        const trimmed = content.trim();
        if (!trimmed) return tag;
        const encoded = btoa(unescape(encodeURIComponent(trimmed)));
        return `${tag}intro-md="${encoded}" `;
      }
    );
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
            if (props.href === "#open-bitcoin-node") {
              return (
                <a
                  {...props}
                  href="#"
                  onClick={(e: React.MouseEvent) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("node-terminal-open")); }}
                  className={`underline underline-offset-4 hover:opacity-80 cursor-pointer ${
                    theme === "dark" ? "text-[#ffd700]" : "text-[#b8860b]"
                  }`}
                  data-testid="link-open-bitcoin-node"
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
          pre: ({ children, ...props }: any) => {
            const textContent = (() => {
              try {
                const extract = (node: any): string => {
                  if (typeof node === "string") return node;
                  if (Array.isArray(node)) return node.map(extract).join("");
                  if (node?.props?.children) return extract(node.props.children);
                  return "";
                };
                return extract(children);
              } catch { return ""; }
            })();
            return (
              <div className="relative group">
                <pre {...props}>{children}</pre>
                {textContent && (
                  <CopyButton text={textContent} theme={theme} />
                )}
              </div>
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
                title="Knowledge Check"
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
                  emailVerified={emailVerified}
                  pubkey={pubkey}
                  sessionToken={sessionToken}
                  lightningAddress={lightningAddress}
                  alreadyCompleted={isCompleted}
                  claimInfo={completedCheckpoints.find(c => c.checkpointId === cpId) || null}
                  onLoginRequest={onLoginRequest}
                  onCompleted={onCheckpointCompleted}
                />
              </CollapsibleItem>
            );
          },
          "drag-drop": ({ id }: any) => {
            const ddId = String(id || "");
            if (!ddId) return null;
            const isCompleted = completedCheckpoints.some(c => c.checkpointId === ddId);
            return (
              <DragDropExercise
                checkpointId={ddId}
                theme={theme}
                authenticated={authenticated}
                sessionToken={sessionToken}
                lightningAddress={lightningAddress}
                emailVerified={emailVerified}
                pubkey={pubkey}
                alreadyCompleted={isCompleted}
                claimInfo={completedCheckpoints.find(c => c.checkpointId === ddId) || null}
                onLoginRequest={onLoginRequest}
                onCompleted={onCheckpointCompleted}
                onOpenProfile={onOpenProfile}
              />
            );
          },
          "code-intro": ({ heading, description, exercises: exerciseIds, "intro-md": introMdEncoded }: any) => {
            if (tutorialMode !== "code") return null;
            const ids = String(exerciseIds || "").split(",").map((s: string) => s.trim()).filter(Boolean);
            const exerciseList = ids
              .map((exId: string) => ({ id: exId, data: LIGHTNING_EXERCISES[exId] }))
              .filter((e: any) => e.data);
            if (exerciseList.length === 0) return null;

            const completedCount = exerciseList.filter((e: any) =>
              completedCheckpoints.some(c => c.checkpointId === e.id)
            ).length;
            const allDone = completedCount === exerciseList.length;

            const isDark = theme === "dark";
            const cardBorder = isDark
              ? (allDone ? "border-green-500/60" : "border-[#FFD700]/60")
              : (allDone ? "border-green-600/50" : "border-[#b8860b]/50");
            const cardBg = isDark ? "bg-[#0b1220]/50" : "bg-[#fffdf5]";
            const accentBg = allDone
              ? (isDark ? "bg-green-500" : "bg-green-600")
              : (isDark ? "bg-[#FFD700]" : "bg-[#b8860b]");
            const headerText = isDark
              ? (allDone ? "text-green-400" : "text-[#FFD700]")
              : (allDone ? "text-green-700" : "text-[#9a7200]");

            // Decode intro prose if present
            let introMdContent: string | null = null;
            if (introMdEncoded) {
              try {
                introMdContent = decodeURIComponent(escape(atob(introMdEncoded)));
              } catch {}
            }

            const renderExercise = (ex: { id: string; data: any }) => {
              const isCompleted = completedCheckpoints.some(c => c.checkpointId === ex.id);
              const ctx = getExerciseGroupContext(ex.id);
              return (
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
                  getProgress={progress.getProgress}
                  saveProgress={progress.saveProgress}
                  fileLabel={ctx?.fileLabel}
                  preamble={ctx?.preamble}
                  setupCode={ctx?.setupCode}
                  crossGroupExercises={ctx?.crossGroupExercises.map(cg => ({
                    id: cg.id,
                    starterCode: LIGHTNING_EXERCISES[cg.id]?.starterCode ?? "",
                  }))}
                  classMethodExercises={ctx?.classMethodExercises.map(cm => ({
                    id: cm.id,
                    starterCode: LIGHTNING_EXERCISES[cm.id]?.starterCode ?? "",
                  }))}
                  priorInGroupExercises={ctx?.priorInGroupExercises.map(pe => ({
                    id: pe.id,
                    starterCode: LIGHTNING_EXERCISES[pe.id]?.starterCode ?? "",
                  }))}
                  futureExercises={ctx?.futureExercises.map(fe => ({
                    id: fe.id,
                    starterCode: LIGHTNING_EXERCISES[fe.id]?.starterCode ?? "",
                  }))}
                />
              );
            };

            if (exerciseList.length === 1) {
              const ex = exerciseList[0];
              const isCompleted = completedCheckpoints.some(c => c.checkpointId === ex.id);
              return (
                <div className="my-8 relative exercise-accent-card">
                  {/* Gold/green left accent bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentBg} z-10`} />
                  <style>{`.exercise-accent-card > div { margin: 0 !important; }`}</style>

                  {/* Collapsible exercise header */}
                  <CollapsibleItem
                    title={ex.data.title}
                    completed={isCompleted}
                    theme={theme}
                    label="EXERCISE"
                    storageKey={`pl-collapse-ex-${ex.id}`}
                  >
                    {/* Intro prose */}
                    {introMdContent && (
                      <div className={`px-5 pl-6 pt-4 pb-2 noise-md noise-md-${theme}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                          {rewriteTutorialImagePaths(introMdContent)}
                        </ReactMarkdown>
                      </div>
                    )}
                    {renderExercise(ex)}
                  </CollapsibleItem>
                </div>
              );
            }

            return (
              <div className="my-8 relative exercise-accent-card">
                {/* Gold/green left accent bar */}
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
                  {/* Intro prose */}
                  {introMdContent && (
                    <div className={`px-5 pl-6 pt-2 pb-2 noise-md noise-md-${theme}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {rewriteTutorialImagePaths(introMdContent)}
                      </ReactMarkdown>
                    </div>
                  )}
                  {exerciseList.map((ex: any) => {
                    const isCompleted = completedCheckpoints.some(c => c.checkpointId === ex.id);
                    return (
                      <CollapsibleItem
                        key={ex.id}
                        title={ex.data.title}
                        completed={isCompleted}
                        theme={theme}
                        label="EXERCISE"
                        storageKey={`pl-collapse-ex-${ex.id}`}
                      >
                        {renderExercise(ex)}
                      </CollapsibleItem>
                    );
                  })}
                </CollapsibleGroup>
              </div>
            );
          },
          "tx-generator": ({ id }: any) => {
            const genId = String(id || "");
            const genConfig = TX_GENERATORS[genId];
            if (!genConfig) return null;
            const isTracked = genConfig.type === "transaction";
            const genCompleted = isTracked && completedCheckpoints.some(
              (c) => c.checkpointId === genId
            );
            const completedIds = new Set(completedCheckpoints.map(c => c.checkpointId));
            const getExerciseProgress = (exerciseId: string) => {
              if (completedIds.has(exerciseId)) return { completed: true };
              return undefined;
            };
            return (
              <TxGenerator
                config={genConfig}
                theme={theme}
                sessionToken={isTracked ? sessionToken : undefined}
                isCompleted={genCompleted}
                onCompleted={isTracked ? onCheckpointCompleted : undefined}
                getProgress={getExerciseProgress}
              />
            );
          },
          "funding-diagram": () => {
            return <FundingTxDiagram theme={theme} />;
          },
          "script-debugger": ({ path }: any) => {
            const validPath = path === "preimage" ? "preimage" : "timeout";
            return <ScriptDebugger path={validPath} theme={theme} />;
          },
          "notebook-ref": ({ storagekey, label }: any) => {
            return <NotebookRef storageKey={String(storagekey)} label={String(label || storagekey)} theme={theme} />;
          },
          "code-outro": ({ text }: any) => {
            if (tutorialMode !== "code") return null;
            return <p className="mt-4 opacity-80">{text}</p>;
          },
          "code-exercise": () => {
            // Individual code-exercise tags are now handled by code-intro
            return null;
          },
          "annotated-tx": () => {
            return <AnnotatedTransaction theme={theme} />;
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
                subtitleLabel={isGroupCompleted ? undefined : "EARN 210 SATS"}
                subtitle={isGroupCompleted ? undefined : `Answer all ${groupQuestions.length} questions correctly to claim your reward.`}
                storageKey={`pl-collapse-cpg-${groupId}`}
              >
                <CheckpointGroup
                  groupId={groupId}
                  questions={groupQuestions}
                  rewardSats={210}
                  theme={theme}
                  authenticated={authenticated}
                  emailVerified={emailVerified}
                  pubkey={pubkey}
                  sessionToken={sessionToken}
                  lightningAddress={lightningAddress}
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
        {extractExerciseIntros(rewriteTutorialImagePaths(md))}
      </ReactMarkdown>

      {(() => {
        const reqs = CHAPTER_REQUIREMENTS[chapter.id];
        const isReadOnly = reqs && reqs.checkpoints.length === 0 &&
          (tutorialMode === "read" || reqs.exercises.length === 0);
        if (!isReadOnly || chapter.id === "quiz" || chapter.id === "pay-it-forward") return null;
        const isMarkedRead = progress.getProgress(`chapter-read:${chapter.id}`) === "1";

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
              progress.saveProgress(`chapter-read:${chapter.id}`, "1", true);
              onCheckpointCompleted(`chapter-read:${chapter.id}`);
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

export default function LightningTutorialPage() {
  return (
    <Switch>
      <Route path="/lightning-tutorial">
        <LightningTutorialShell activeId="intro" />
      </Route>
      <Route path="/lightning-tutorial/:chapterId">
        {(params) => {
          const id = params?.chapterId ?? "intro";
          const exists = chapters.some((c) => c.id === id);
          return <LightningTutorialShell activeId={exists ? id : "intro"} />;
        }}
      </Route>
    </Switch>
  );
}
