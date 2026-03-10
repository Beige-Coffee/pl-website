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
      "To allow either party to unilaterally spend the channel funds at any time",
      "To ensure both parties must cooperate to move funds, enabling trustless off-chain updates",
      "To reduce the transaction fee by using a simpler script type",
      "To make the channel compatible with on-chain Bitcoin wallets",
    ],
    answer: 1,
    explanation: "A 2-of-2 multisig requires both parties' signatures to spend the funds. This is the foundation of a Lightning channel: since neither party can move funds alone, they can safely negotiate off-chain transactions. Each commitment transaction represents a new state of the channel, and both parties must agree (sign) before any state change takes effect.",
  },
  "pubkey-sorting": {
    question: "Why does BOLT 3 require pubkeys in the funding script to be sorted lexicographically?",
    options: [
      "Sorted keys are faster to verify in Bitcoin Script because the interpreter checks them in order",
      "It ensures both parties independently produce the exact same funding script, which is critical because the script determines the P2WSH address",
      "Lexicographic sorting makes it harder for an attacker to determine which key belongs to the channel opener",
      "Bitcoin consensus rules require multisig pubkeys to be sorted; unsorted scripts are invalid",
    ],
    answer: 1,
    explanation: "Both parties must independently construct the same funding script because its SHA256 hash determines the P2WSH output address. If they used different key orderings, they'd compute different script hashes and disagree on which output to watch. Lexicographic sorting is a simple, deterministic rule that both parties can follow independently without any communication, ensuring they always produce identical scripts.",
  },
  "revocation-purpose": {
    question: "What does the revocation key enable in a Lightning channel?",
    options: [
      "It allows the channel funder to reclaim their funds if the counterparty goes offline permanently",
      "It enables either party to close the channel cooperatively without broadcasting to the blockchain",
      "It gives the counterparty the ability to claim ALL channel funds if an old (revoked) commitment transaction is broadcast",
      "It allows a third-party watchtower to open new channels on behalf of the original parties",
    ],
    answer: 2,
    explanation: "The revocation key is the enforcement mechanism behind Lightning's fairness protocol. When a channel state is updated, the old state is 'revoked' by sharing the per-commitment secret. If a party tries to cheat by broadcasting an old commitment transaction, the counterparty can use the revocation key (derived from the shared secret) to claim ALL funds in the channel as a penalty. This makes cheating economically irrational.",
  },
  "revocation-key-construction": {
    question: "Why can't Alice calculate the private key to the Revocation Public Key in her own `to_local` output?",
    options: [
      "Because the revocation public key is generated randomly by the Bitcoin network",
      "Because it is derived from Bob's Revocation Basepoint, and Bob will never reveal his Revocation Basepoint Secret to Alice",
      "Because the revocation private key is destroyed after the commitment transaction is signed",
      "Because Alice uses a different elliptic curve than Bob for her keys",
    ],
    answer: 1,
    explanation: "Alice's Revocation Public Key is created by combining Bob's Revocation Basepoint with Alice's Per-Commitment Point. Since Bob never reveals his Revocation Basepoint Secret, Alice can never compute the corresponding private key. Only Bob can derive it, and only after Alice reveals her Per-Commitment Secret when they advance to a new state. This is what makes the penalty mechanism trustless.",
  },
  "revocation-secret-exchange": {
    question: "When Alice and Bob advance from Channel State 1 to Channel State 2, what does Alice send to Bob?",
    options: [
      "Her Revocation Basepoint Secret and her new Per-Commitment Point",
      "Her Per-Commitment Secret for State 1 and her new Per-Commitment Point for the next channel state",
      "Bob's Revocation Private Key from State 1",
      "Her funding private key and a signed revocation transaction",
    ],
    answer: 1,
    explanation: "When advancing states, Alice sends Bob two things: (1) her Per-Commitment Secret from the old state (State 1), which allows Bob to derive the Revocation Private Key for Alice's old commitment transaction, and (2) her new Per-Commitment Point for the next state (State 2), so Bob can construct the new Revocation Public Key. The Revocation Basepoint never changes and was already exchanged during channel opening.",
  },
  "csv-purpose": {
    question: "Why does BOLT 3 use OP_CHECKSEQUENCEVERIFY (CSV) in the to_local output?",
    options: [
      "CSV adds a time-based expiration to the channel, automatically closing it after a set period",
      "CSV enforces a delay before the local party can spend their own balance, giving the counterparty time to detect and punish cheating",
      "CSV is required by Bitcoin consensus for all SegWit transactions",
      "CSV prevents the transaction from being included in a block until a specific block height is reached",
    ],
    answer: 1,
    explanation: "The CSV delay in the to_local output creates a window of time during which the counterparty can check if this is an old (revoked) commitment transaction. If it is, they can use the revocation key to claim the funds before the delay expires. Without this delay, a cheating party could broadcast an old state and immediately sweep their to_local output before anyone could react. The delay is measured in blocks (typically 144 = ~1 day) and only applies to the broadcaster's own output.",
  },
  "obscured-commitment": {
    question: "What is the purpose of the obscured commitment number encoded in the locktime and sequence fields?",
    options: [
      "It prevents miners from censoring commitment transactions by hiding which channel they belong to",
      "It allows nodes to determine how many state updates a channel has undergone by examining only on-chain data, which is needed for revocation",
      "It encrypts the commitment number so that only the channel parties can decode it, but the number itself is visible to anyone who knows the payment basepoints",
      "It ensures each commitment transaction has a unique txid, preventing accidental double-spends",
    ],
    answer: 2,
    explanation: "The obscured commitment number XORs the actual commitment number with a value derived from both parties' payment basepoints. This means the number is 'encrypted' in the sense that a random observer cannot determine the commitment number. However, either channel party (who knows both payment basepoints) can decode it. This is useful for identifying which commitment was broadcast and recovering the corresponding per-commitment secret for revocation.",
  },
  "bip32-derivation": {
    question: "Why does the Lightning key derivation scheme use hardened BIP32 derivation (indicated by h or ') for the key family level?",
    options: [
      "Hardened derivation is faster because it skips the public key computation step",
      "Hardened derivation prevents a leaked child key from being used to derive sibling keys or the parent key, isolating key families from each other",
      "Hardened derivation produces longer keys (64 bytes vs 32 bytes), providing more security",
      "Bitcoin Core only supports hardened derivation paths, so non-hardened paths would be incompatible",
    ],
    answer: 1,
    explanation: "In non-hardened BIP32 derivation, knowing a child private key and the parent public key allows computing the parent private key (and thus all sibling keys). This is disastrous for Lightning: if an attacker compromises one channel key, they could derive keys for all other channels. Hardened derivation breaks this chain by using the parent private key directly in the derivation, ensuring that a compromised child key reveals nothing about its siblings or parent.",
  },
  "commitment-secret-algorithm": {
    question: "The BOLT 3 per-commitment secret generation uses a bit-flipping and hashing algorithm. What is the key advantage of this scheme?",
    options: [
      "It produces cryptographically stronger secrets than simple sequential hashing",
      "It allows compact storage of all previous secrets using O(log n) space instead of O(n), through a structure called a shachain",
      "It makes the secrets deterministic, so they can be regenerated from the seed without any additional storage",
      "It ensures that each secret is exactly 32 bytes, matching the size of a SHA256 hash",
    ],
    answer: 1,
    explanation: "The bit-flipping algorithm used in BOLT 3 is designed so that the receiver of revealed secrets can store them in a compact 'shachain' structure that uses only O(log n) space while being able to derive any previously revealed secret. This is critical for Lightning because a long-lived channel could have millions of state updates, and storing every individual per-commitment secret would be prohibitively expensive. The shachain allows a node to verify and store secrets efficiently.",
  },
  "p2wsh-wrapping": {
    question: "Why are HTLC outputs and the to_local output wrapped in P2WSH (Pay-to-Witness-Script-Hash)?",
    options: [
      "P2WSH is required for all SegWit transactions; there is no alternative",
      "P2WSH hides the spending conditions until the output is spent, reducing the on-chain footprint and providing privacy about the channel's HTLC structure",
      "P2WSH allows the scripts to be larger than the 520-byte limit imposed on P2SH scripts",
      "P2WSH enables the use of Schnorr signatures, which are more efficient than ECDSA",
    ],
    answer: 1,
    explanation: "P2WSH commits to a script hash rather than the full script in the output. The actual script (witness script) is only revealed when the output is spent. This means that on-chain observers cannot see the complex HTLC conditions or revocation paths until a close occurs, providing some privacy. Additionally, the witness data doesn't count toward the traditional block size limit (it gets a 75% discount in weight), reducing fees for these complex scripts.",
  },
  "htlc-dust": {
    question: "What makes an HTLC 'dust' (trimmed) in the context of commitment transactions?",
    options: [
      "An HTLC is dust if its payment hash has already been revealed (preimage is known)",
      "An HTLC is always dust if its value is below 546 satoshis, regardless of the channel type or fee structure",
      "For non-anchor channels, an HTLC is trimmed if its value minus the second-stage transaction fee falls below the dust limit. For anchor/zero-fee channels, only the dust limit itself matters",
      "An HTLC is dust only if both channel parties explicitly agree to trim it during the commitment_signed exchange",
    ],
    answer: 2,
    explanation: "An HTLC output requires a second-stage transaction (HTLC-timeout or HTLC-success) to be claimed. For non-anchor channels, this second-stage transaction has its own fee cost deducted from the HTLC amount. If the resulting value falls below the dust limit (e.g., 330 sats for P2WSH), the HTLC is 'trimmed' and its value is added to the commitment transaction fee instead. For anchor/zero-fee channels, the second-stage fee is zero (fees are handled later via CPFP), so an HTLC is trimmed only if its raw value is below the dust limit. BOLT 3 specifies these rules in the 'Trimmed Outputs' section.",
  },
  "htlc-timeout-vs-success": {
    question: "What is the key difference between an HTLC-timeout transaction and an HTLC-success transaction?",
    options: [
      "HTLC-timeout uses SIGHASH_SINGLE while HTLC-success uses SIGHASH_ALL",
      "HTLC-timeout has a locktime set to the CLTV expiry and uses an empty preimage (timeout path), while HTLC-success has locktime 0 and includes the payment preimage (claim path)",
      "HTLC-timeout can only be broadcast by the remote party, while HTLC-success can only be broadcast by the local party",
      "HTLC-timeout creates a P2PKH output while HTLC-success creates a P2WSH output",
    ],
    answer: 1,
    explanation: "Both HTLC-timeout and HTLC-success are second-stage transactions that spend HTLC outputs from commitment transactions. The HTLC-timeout transaction is used when the HTLC expires without being claimed: it has a locktime equal to the CLTV expiry and passes an empty byte string as the witness (choosing the timeout branch in the script). The HTLC-success transaction is used to claim the HTLC with the preimage: it has locktime 0 (can be broadcast immediately) and includes the 32-byte payment preimage in the witness.",
  },
  "htlc-preimage-purpose": {
    question: "In a multi-hop Lightning payment, why does the payment preimage flow backward (from receiver to sender)?",
    options: [
      "It doesn't — the preimage flows forward from sender to receiver along with the payment",
      "The receiver generates the preimage, so only they can reveal it. Each hop reveals it to claim their funds, propagating it back to the sender as proof of payment.",
      "The preimage flows backward to allow each node to verify the payment hash before forwarding",
      "The preimage is split into pieces, with each hop holding one piece for security",
    ],
    answer: 1,
    explanation: "The receiver (Dianne) generates a random preimage and includes its hash in the invoice. The sender (Alice) locks funds along each hop using this hash. Payments settle in reverse: Dianne reveals the preimage to Bob to claim her funds, then Bob uses that same preimage to claim funds from Alice. This backward flow is what makes the payment atomic — either every hop gets the preimage and settles, or none do.",
  },
  "htlc-atomicity": {
    question: "In a multi-hop payment (Alice \u2192 Bob \u2192 Dianne), why must the same payment hash be used in every hop's HTLC?",
    options: [
      "It reduces the number of public keys that need to be exchanged between parties",
      "It ensures atomicity: when Dianne reveals the preimage to Bob, Bob can immediately use it to claim from Alice",
      "It allows Lightning nodes to route payments without knowing the preimage in advance",
      "It makes the transaction smaller by reducing witness data size",
    ],
    answer: 1,
    explanation: "Using the same payment hash at every hop is what makes Lightning payments atomic. When Dianne reveals the preimage to claim from Bob, Bob can immediately use that same preimage to claim from Alice, because Alice's HTLC uses the same hash. If different hashes were used, Bob would need a different preimage for Alice's HTLC, which Dianne wouldn't provide. The shared hash creates a chain reaction: once the preimage is revealed anywhere, it can unlock every HTLC along the route.",
  },
  "offered-vs-received": {
    question: "From the commitment transaction holder's perspective, what distinguishes an 'offered' HTLC from a 'received' HTLC?",
    options: [
      "An offered HTLC uses OP_CHECKLOCKTIMEVERIFY while a received HTLC uses OP_CHECKSEQUENCEVERIFY",
      "An offered HTLC is one where the holder is the payer (forwarding the payment), while a received HTLC is one where the holder is the payee (receiving the payment)",
      "An offered HTLC is always larger in value than a received HTLC",
      "An offered HTLC can be revoked but a received HTLC cannot",
    ],
    answer: 1,
    explanation: "In a commitment transaction, 'offered' and 'received' are relative to the holder. An offered HTLC means the holder has offered to pay (the payment is going out), while a received HTLC means the holder is receiving a payment. The scripts differ because the timeout/claim paths are reversed: for an offered HTLC, the holder reclaims via timeout while the counterparty claims with the preimage; for a received HTLC, the holder claims with the preimage while the counterparty reclaims via timeout.",
  },
  "witness-structure": {
    question: "In a finalized commitment transaction, the witness contains [empty, sig1, sig2, funding_script]. Why is the first element empty?",
    options: [
      "It's a placeholder for a future Taproot upgrade path",
      "It signals to the network that this is a SegWit transaction rather than a legacy transaction",
      "It works around a historical Bitcoin bug in OP_CHECKMULTISIG that pops one extra item off the stack",
      "It's padding to ensure the witness data is aligned to 4-byte boundaries",
    ],
    answer: 2,
    explanation: "OP_CHECKMULTISIG has a well-known off-by-one bug from Bitcoin's early days: it pops one more item off the stack than the number of signatures specified. This extra item is consumed but never used. By convention, this item must be an empty byte string (OP_0). If it were any other value, modern Bitcoin nodes would reject the transaction as non-standard. This bug was never fixed because changing it would require a hard fork.",
  },
  "fee-deduction": {
    question: "In BOLT 3 commitment transactions, who pays the transaction fee and how is it deducted?",
    options: [
      "The fee is split equally between both parties' outputs",
      "The fee is paid by the channel funder (initiator) by deducting it from the to_local output",
      "The fee is paid from a separate fee output that both parties contribute to",
      "The fee is paid by whoever broadcasts the transaction, using an additional input",
    ],
    answer: 1,
    explanation: "BOLT 2 specifies that the channel funder (the party who initiated the channel open) is responsible for paying the commitment transaction fee. This fee is deducted from the funder's output (to_local when the funder is the local party). The counterparty's output remains unaffected by fee changes. This simplifies fee negotiation since only one party's balance changes when the feerate is updated.",
  },
  "static-remotekey": {
    question: "The to_remote output uses the payment_basepoint directly (P2WPKH) rather than a per-commitment derived key. Why?",
    options: [
      "Per-commitment derivation would make the output incompatible with standard Bitcoin wallets",
      "The payment_basepoint is more secure because it uses a longer key derivation path",
      "With `option_static_remotekey` (now mandatory), the remote party can always sweep their funds with a single key, simplifying recovery if they lose channel state",
      "Using the basepoint directly reduces the transaction size by avoiding an extra hash operation",
    ],
    answer: 2,
    explanation: "Before `option_static_remotekey`, the to_remote output used a per-commitment derived key. This meant that if the remote party lost their channel state data, they couldn't spend their output because they wouldn't know which per-commitment point was used. With static remotekey (now mandatory in the spec), the to_remote output uses the payment_basepoint directly. This means the remote party can always recover their funds using their base private key alone, even without channel state. It's a major reliability improvement.",
  },
  "channel-fairness": {
    question: "In the \"cut and choose\" fairness protocol, why is the cutter incentivized to split the cake evenly?",
    options: [
      "Because Mom is watching and will punish them if they cheat",
      "Because the chooser picks first, so an uneven cut lets the chooser take the larger piece",
      "Because the protocol randomly assigns pieces after cutting",
      "Because both pieces are weighed on a scale and must be equal",
    ],
    answer: 1,
    explanation: "In \"cut and choose,\" the cutter's best strategy is to split evenly because the chooser gets to pick first. If the cutter makes one piece bigger, the chooser simply takes the larger piece, leaving the cutter with less. This is a fairness protocol: the rules themselves make cheating a losing strategy, with no need for a trusted third party to enforce fairness.",
  },
  "payment-channels-scaling": {
    question: "How do payment channels help Bitcoin scale?",
    options: [
      "They increase the Bitcoin block size limit, allowing more transactions per block",
      "They allow unlimited transactions between two parties using only two on-chain transactions (open and close), keeping the blockchain small while supporting high throughput",
      "They replace proof-of-work mining with a more efficient consensus mechanism",
      "They compress multiple transactions into a single on-chain transaction using Merkle trees",
    ],
    answer: 1,
    explanation: "Payment channels allow two parties to transact an unlimited number of times off-chain, with only the opening funding transaction and the final closing transaction appearing on the blockchain. This means thousands or millions of payments can occur with just two on-chain transactions, dramatically reducing blockchain load. The security comes from the fact that either party can always enforce the latest state on-chain if needed.",
  },
  "asymmetric-commits": {
    question: "Why do Lightning channels use asymmetric commitment transactions (each party holds a different version)?",
    options: [
      "Asymmetric transactions reduce the total data that needs to be stored by each party",
      "Each party's version makes their own output revocable (with a delay), ensuring the broadcaster takes on the risk while the counterparty can spend immediately",
      "It allows both parties to use different fee rates for their transactions",
      "Asymmetric transactions are required by the Bitcoin consensus rules for multisig spending",
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
  "htlc-fees-dust": { checkpoints: ["htlc-dust", "p2wsh-wrapping"], exercises: ["ln-exercise-htlc-outputs", "ln-exercise-commitment-tx-htlc"] },
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

function ProfileDropdown({
  theme,
  email,
  pubkey,
  lightningAddress,
  sessionToken,
  emailVerified,
  onSetLightningAddress,
  onLogout,
  onClose,
}: {
  theme: "light" | "dark";
  email: string | null;
  pubkey: string | null;
  lightningAddress: string | null;
  sessionToken: string | null;
  emailVerified: boolean;
  onSetLightningAddress: (address: string | null) => Promise<void>;
  onLogout: () => void;
  onClose: () => void;
}) {
  const dark = theme === "dark";
  const [addressInput, setAddressInput] = useState(lightningAddress || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [showVerificationSection, setShowVerificationSection] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isLightningUser = !!pubkey;
  const needsVerification = !!email && !emailVerified && !isLightningUser;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Ignore clicks on the profile toggle button (it handles its own toggle)
      if (target.closest("[data-profile-toggle]")) return;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleResendVerification = async () => {
    if (!sessionToken) return;
    setResending(true);
    setResendMsg(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setResendMsg("Verification email sent! Check your inbox.");
      } else {
        setResendMsg(data.error || "Failed to send");
      }
    } catch {
      setResendMsg("Failed to send");
    } finally {
      setResending(false);
    }
  };

  const handleSave = async (): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const trimmed = addressInput.trim();
      await onSetLightningAddress(trimmed || null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return true;
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const identity = email || (pubkey ? pubkey.slice(0, 12) + "..." : "User");

  return (
    <div
      ref={dropdownRef}
      className={`absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] border-4 z-50 ${
        dark ? "border-[#2a3552] bg-[#0f1930]" : "border-border bg-card"
      }`}
      style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
      data-testid="container-profile-dropdown"
    >
      <div className={`px-5 py-4 border-b-2 ${dark ? "border-[#1f2a44]" : "border-border"}`}>
        <div className={`font-pixel text-xs mb-1 ${dark ? "text-slate-400" : "text-foreground/60"}`}>
          LOGGED IN AS
        </div>
        <div className={`text-base truncate ${dark ? "text-slate-200" : "text-foreground"}`}>
          {identity}
        </div>
        {email && (
          <div className="mt-2 flex items-center gap-2">
            {emailVerified ? (
              <span className={`text-xs font-pixel ${dark ? "text-green-400" : "text-green-700"}`}>VERIFIED</span>
            ) : (
              <button
                type="button"
                onClick={() => setShowVerificationSection(v => !v)}
                className={`font-pixel text-xs border-2 px-3 py-1.5 transition-all cursor-pointer ${
                  dark
                    ? "border-[#FFD700] text-[#FFD700] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
                    : "border-[#b8860b] text-[#9a7200] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
                }`}
              >
                NOT VERIFIED
              </button>
            )}
          </div>
        )}
        {isLightningUser && !email && (
          <div className="mt-2">
            <span className={`text-xs font-pixel ${dark ? "text-green-400" : "text-green-700"}`}>LIGHTNING AUTH</span>
          </div>
        )}
      </div>

      {needsVerification && showVerificationSection && (
        <div className={`px-5 py-4 border-b-2 ${dark ? "border-[#1f2a44]" : "border-border"}`}>
          <p className={`text-base leading-relaxed mb-3 ${dark ? "text-slate-300" : "text-foreground/70"}`}>
            Verify your email to claim bitcoin rewards from checkpoints. You can also log in with LNURL-Auth instead.
          </p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending}
            className={`font-pixel text-sm border-2 px-5 py-3 transition-all ${
              dark
                ? "border-[#FFD700] text-[#FFD700] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
                : "border-[#b8860b] text-[#9a7200] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
            } ${resending ? "opacity-60 cursor-wait" : ""}`}
            data-testid="button-resend-verification"
          >
            {resending ? "SENDING..." : "RESEND VERIFICATION EMAIL"}
          </button>
          {resendMsg && (
            <p className={`mt-2 text-base font-bold ${resendMsg.includes("sent") ? (dark ? "text-green-400" : "text-green-800") : "text-red-400"}`}>
              {resendMsg}
            </p>
          )}
        </div>
      )}

      <div className={`px-5 py-4 border-b-2 ${dark ? "border-[#1f2a44]" : "border-border"}`}>
        <div className={`font-pixel text-xs mb-2 ${dark ? "text-[#FFD700]" : "text-[#9a7200]"}`}>
          LIGHTNING ADDRESS
        </div>
        {lightningAddress ? (
          <div>
            <div className="flex items-center gap-3">
              <div className={`text-lg font-bold truncate flex-1 px-3 py-1 rounded-full ${dark ? "text-slate-200 bg-[#FFD700]/10" : "text-foreground bg-[#b8860b]/10"}`}>
                {lightningAddress}
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddressInput(lightningAddress || "");
                  setSaveError(null);
                  setSaveSuccess(false);
                  setShowAddressForm(true);
                }}
                className={`font-pixel text-xs border-2 px-3 py-1.5 transition-all shrink-0 ${
                  dark
                    ? "border-[#FFD700] text-[#FFD700] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
                    : "border-[#b8860b] text-[#9a7200] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
                }`}
                data-testid="button-edit-lightning-address"
              >
                EDIT
              </button>
            </div>
            <p className={`mt-2 text-base leading-relaxed ${dark ? "text-slate-400" : "text-foreground/60"}`}>
              Rewards auto-send to this address.
            </p>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => {
                setAddressInput("");
                setSaveError(null);
                setSaveSuccess(false);
                setShowAddressForm(true);
              }}
              className={`w-full font-pixel text-sm border-2 px-4 py-3 transition-all ${
                dark
                  ? "border-[#FFD700] text-[#FFD700] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
                  : "border-[#b8860b] text-[#9a7200] bg-[#FFD700]/10 hover:bg-[#FFD700]/20"
              }`}
              data-testid="button-add-lightning-address"
            >
              ADD LIGHTNING ADDRESS
            </button>
            <p className={`mt-3 text-base font-medium leading-relaxed ${dark ? "text-slate-300" : "text-foreground/70"}`}>
              Adding a Lightning address makes for a much more seamless experience. Complete checkpoints and receive sats automatically without having to scan a QR code.
            </p>
          </div>
        )}
      </div>

      {showAddressForm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddressForm(false); }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div className={`relative w-[90vw] max-w-[400px] border-4 p-5 ${
            dark ? "border-[#2a3552] bg-[#0f1930]" : "border-border bg-card"
          }`}>
            <div className={`font-pixel text-xs mb-3 ${dark ? "text-[#FFD700]" : "text-[#9a7200]"}`}>
              {lightningAddress ? "EDIT LIGHTNING ADDRESS" : "ADD LIGHTNING ADDRESS"}
            </div>
            <input
              type="text"
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
                setSaveError(null);
                setSaveSuccess(false);
              }}
              placeholder="you@wallet.com"
              className={`w-full px-4 py-3 text-lg border-2 outline-none transition-colors ${
                dark
                  ? "border-[#2a3552] bg-[#0b1220] text-slate-200 placeholder:text-slate-600 focus:border-[#FFD700]"
                  : "border-border bg-background text-foreground placeholder:text-foreground/30 focus:border-[#b8860b]"
              }`}
              data-testid="input-lightning-address"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setShowAddressForm(false);
              }}
            />
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={async () => {
                  const ok = await handleSave();
                  if (ok) setShowAddressForm(false);
                }}
                disabled={saving}
                className={`font-pixel text-xs border-2 px-4 py-2 transition-all border-[#FFD700] bg-[#FFD700] text-black hover:bg-[#FFC800] active:scale-95 ${
                  saving ? "opacity-60 cursor-wait" : ""
                }`}
                data-testid="button-save-lightning-address"
              >
                {saving ? "SAVING..." : "SAVE"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddressForm(false)}
                className={`font-pixel text-xs border-2 px-4 py-2 transition-all ${
                  dark
                    ? "border-[#2a3552] text-slate-400 hover:text-slate-200"
                    : "border-border text-foreground/60 hover:text-foreground"
                }`}
              >
                CANCEL
              </button>
              {saveSuccess && (
                <span className="font-pixel text-xs text-green-400">SAVED!</span>
              )}
              {saveError && (
                <span className="font-pixel text-xs text-red-400">{saveError}</span>
              )}
            </div>
            <p className={`mt-3 text-base font-semibold leading-relaxed ${dark ? "text-slate-300" : "text-foreground/80"}`}>
              Rewards will auto-send to this address, so you can complete checkpoints and receive sats without scanning a QR code.
            </p>
          </div>
        </div>
      )}

      <div className="px-5 py-5">
        <button
          type="button"
          onClick={() => {
            onLogout();
            onClose();
          }}
          className={`w-full font-pixel text-base border-2 px-4 py-3 transition-colors ${
            dark
              ? "border-[#2a3552] bg-[#0b1220] text-slate-400 hover:text-slate-200 hover:bg-[#132043]"
              : "border-border bg-background text-foreground/60 hover:text-foreground hover:bg-secondary"
          }`}
          data-testid="button-logout"
        >
          LOGOUT
        </button>
      </div>
    </div>
  );
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

  // Close tools dropdown on click outside
  useEffect(() => {
    if (!toolsOpen) return;
    const handler = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [toolsOpen]);

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
                    { label: "Scratchpad", panelId: "scratchpad" as const },
                    { label: "Bitcoin Node", panelId: "node" as const },
                    { label: "Files", panelId: null },
                    { label: "Transactions", panelId: "notebook" as const },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (item.panelId) {
                          panelState.switchPanel(item.panelId);
                        } else {
                          setFileBrowserOpen(true);
                        }
                        setToolsOpen(false);
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
            <div className="fixed bottom-4 right-4 z-50">
              {mobileToolsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMobileToolsOpen(false)} />
                  <div className={`absolute bottom-14 right-0 z-50 border-2 rounded shadow-xl min-w-[180px] ${
                    theme === "dark"
                      ? "bg-[#0b1220] border-[#2a3552]"
                      : "bg-[#fdf9f2] border-[#d4c9a8]"
                  }`} data-testid="container-mobile-tools-menu">
                    <div className="grid gap-1 p-2">
                      {[
                        { label: "Scratchpad", panelId: "scratchpad" as const, testId: "button-mobile-tool-scratchpad" },
                        { label: "Bitcoin Node", panelId: "node" as const, testId: "button-mobile-tool-node" },
                        { label: "Files", panelId: null, testId: "button-mobile-tool-files" },
                        { label: "Transactions", panelId: "notebook" as const, testId: "button-mobile-tool-notebook" },
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
                          className={`w-full text-left border-2 px-3 py-3 min-h-[44px] transition-colors cursor-pointer ${
                            theme === "dark"
                              ? "bg-[#0f1930] border-[#2a3552] text-slate-100 hover:bg-[#132043]"
                              : "bg-card border-[#d4c9a8] text-foreground hover:bg-secondary"
                          }`}
                        >
                          <div className="text-[16px] leading-snug" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>{item.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <button
                onClick={() => setMobileToolsOpen((o) => !o)}
                className={`w-12 h-12 rounded-full border-2 shadow-lg flex items-center justify-center font-pixel text-[10px] ${
                  theme === "dark"
                    ? "bg-[#0f1930] border-[#FFD700] text-[#FFD700]"
                    : "bg-[#fdf9f2] border-[#b8860b] text-[#9a7200]"
                }`}
                data-testid="button-mobile-tools-toggle"
              >
                {mobileToolsOpen ? "X" : "\u2699"}
              </button>
            </div>
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
    question: "What is the fundamental purpose of a 2-of-2 multisig in a Lightning funding transaction?",
    options: [
      "To allow either party to unilaterally spend the channel funds",
      "To ensure both parties must cooperate to move funds, enabling trustless off-chain updates",
      "To split the transaction fee equally between both parties",
      "To comply with Bitcoin Core's standardness rules for SegWit transactions",
    ],
    answer: 1,
    explanation: "A 2-of-2 multisig requires both parties' signatures to spend the funds. This is the foundation of a Lightning channel: since neither party can move funds alone, they can safely negotiate off-chain transactions. Each commitment transaction represents a new state, and both parties must agree (sign) before any state change takes effect.",
  },
  {
    question: "Why does BOLT 3 use hardened BIP32 derivation for Lightning key families?",
    options: [
      "Hardened derivation is faster because it uses simpler math",
      "Hardened derivation prevents a leaked child key from being used to derive sibling keys, isolating key families from each other",
      "Non-hardened derivation produces shorter keys that are less secure",
      "Bitcoin Core only supports hardened paths",
    ],
    answer: 1,
    explanation: "In non-hardened BIP32 derivation, knowing a child private key and the parent public key allows computing the parent private key (and all sibling keys). For Lightning, if an attacker compromised one channel key, they could derive keys for all other channels. Hardened derivation breaks this chain by using the parent private key directly, ensuring a compromised child key reveals nothing about siblings or parents.",
  },
  {
    question: "What happens when Alice broadcasts a revoked commitment transaction?",
    options: [
      "The Bitcoin network rejects the transaction because it has been revoked",
      "Bob has a limited time window (the CSV delay) to use the revocation key to claim ALL channel funds as a penalty",
      "Alice's output is permanently locked and can never be spent",
      "Both outputs are burned as punishment",
    ],
    answer: 1,
    explanation: "Bitcoin doesn't know about Lightning revocation. An old commitment is perfectly valid on-chain. When Alice revoked the old state, she shared her per-commitment secret with Bob. Bob can derive the revocation private key from this secret. Alice's to_local output has a CSV delay before she can spend it. During this delay, Bob can use the revocation key to sweep Alice's entire balance as a penalty.",
  },
  {
    question: "Why are Lightning commitment transactions asymmetric (each party holds a different version)?",
    options: [
      "Asymmetric transactions reduce total storage requirements",
      "Each party's version makes their OWN output revocable with a delay, ensuring the broadcaster takes on the risk",
      "It allows different fee rates for each party",
      "Bitcoin consensus requires multisig to use asymmetric transactions",
    ],
    answer: 1,
    explanation: "In an asymmetric commitment scheme, Alice's version makes HER output delayed and revocable, while Bob's output is immediately spendable (and vice versa for Bob's version). The broadcaster takes on the risk: they must wait through the CSV delay (during which they can be punished if revoked), while the other party gets their funds immediately. This asymmetry is fundamental to the Lightning penalty mechanism.",
  },
  {
    question: "What is the key advantage of the BOLT 3 per-commitment secret generation algorithm (shachain)?",
    options: [
      "It produces cryptographically stronger secrets than sequential hashing",
      "It allows compact O(log n) storage of all previous secrets instead of O(n)",
      "It makes the secrets deterministic so they never need to be stored",
      "It ensures each secret is exactly 32 bytes",
    ],
    answer: 1,
    explanation: "The bit-flipping algorithm produces secrets that can be stored in a compact 'shachain' structure using only O(log n) space while still being able to derive any previously revealed secret. A long-lived channel could have millions of state updates, and storing every individual per-commitment secret would be prohibitively expensive. The shachain allows efficient verification and storage.",
  },
  {
    question: "Why does the to_local output use OP_CHECKSEQUENCEVERIFY (CSV)?",
    options: [
      "CSV adds a time-based expiration to the channel",
      "CSV enforces a delay before the local party can spend their balance, giving the counterparty time to detect and punish cheating",
      "CSV is required by Bitcoin consensus for SegWit transactions",
      "CSV prevents inclusion in a block until a specific block height",
    ],
    answer: 1,
    explanation: "The CSV delay creates a window during which the counterparty can check if this is a revoked commitment. If it is, they can use the revocation key to claim the funds before the delay expires. Without this delay, a cheater could broadcast an old state and immediately sweep their to_local output before anyone could react.",
  },
  {
    question: "What makes an HTLC 'dust' (trimmed) in a commitment transaction?",
    options: [
      "Its payment hash has already been revealed",
      "It has been pending for more than 2016 blocks",
      "Its value is less than the dust limit plus the fee cost of the second-stage transaction needed to claim it",
      "It routes through more than 20 hops",
    ],
    answer: 2,
    explanation: "An HTLC output requires a second-stage transaction (HTLC-timeout or HTLC-success) to be claimed. If the HTLC amount is less than the dust limit plus that transaction's fee, the output costs more to spend than it's worth. BOLT 3 calls these 'trimmed' HTLCs: tracked off-chain but excluded from the commitment transaction. Their value is added to the transaction fee instead.",
  },
  {
    question: "What is the key difference between an HTLC-timeout and an HTLC-success transaction?",
    options: [
      "HTLC-timeout uses SIGHASH_SINGLE while HTLC-success uses SIGHASH_ALL",
      "HTLC-timeout has locktime set to the CLTV expiry (timeout path), while HTLC-success has locktime 0 and includes the payment preimage (claim path)",
      "HTLC-timeout can only be broadcast by the remote party",
      "HTLC-timeout creates P2PKH while HTLC-success creates P2WSH",
    ],
    answer: 1,
    explanation: "Both are second-stage transactions that spend HTLC outputs. HTLC-timeout is used when the HTLC expires unclaimed: locktime equals the CLTV expiry and an empty witness selects the timeout branch. HTLC-success claims with the preimage: locktime is 0 and the 32-byte payment preimage is included in the witness.",
  },
  {
    question: "Why is the commitment transaction's witness structured as [empty, sig1, sig2, funding_script]?",
    options: [
      "It's a placeholder for a future Taproot upgrade",
      "It signals this is a SegWit transaction",
      "The empty element works around a historical bug in OP_CHECKMULTISIG that pops one extra item",
      "It's padding for 4-byte alignment",
    ],
    answer: 2,
    explanation: "OP_CHECKMULTISIG has a well-known off-by-one bug from Bitcoin's early days: it pops one more item than the number of signatures. This extra item is consumed but never used. By convention, it must be empty (OP_0). If it were any other value, modern Bitcoin nodes would reject the transaction as non-standard. This bug was never fixed because changing it would require a hard fork.",
  },
  {
    question: "Why does `option_static_remotekey` make the to_remote output use the payment_basepoint directly?",
    options: [
      "Per-commitment derivation is incompatible with standard Bitcoin wallets",
      "The payment_basepoint uses a longer, more secure key derivation path",
      "It allows the remote party to always sweep their funds with a single key, even if they lose channel state",
      "Direct basepoint usage reduces transaction size",
    ],
    answer: 2,
    explanation: "Before static remotekey, the to_remote output used a per-commitment derived key. If the remote party lost their channel state data, they couldn't spend their output because they wouldn't know which per-commitment point was used. With static remotekey (now mandatory), the to_remote output uses the payment_basepoint directly, meaning the remote party can always recover their funds using just their base private key.",
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
