import type { VLQuizQuestion } from "../components/VLQuiz";

export type VLContentBlock =
  | { type: "heading"; text: string; subtitle?: string }
  | { type: "text"; content: string }
  | { type: "callout"; title: string; body: string; variant: "info" | "key-concept" | "warning" }
  | { type: "quiz"; questions: VLQuizQuestion[] };

export interface VLVisualDef {
  component: string;
  data?: string;
}

export interface VLSectionDef {
  id: string;
  title: string;
  subtitle: string;
  visual: VLVisualDef;
  content: VLContentBlock[];
}

export const VL_SECTIONS: VLSectionDef[] = [
  // ===== Section 0: Bitcoin TX Refresher =====
  {
    id: "0",
    title: "Bitcoin TX Refresher",
    subtitle: "The visual vocabulary of Bitcoin transactions",
    visual: { component: "TransactionDiagram", data: "SIMPLE_TX" },
    content: [
      {
        type: "heading",
        text: "Anatomy of a Bitcoin Transaction",
        subtitle:
          "Every Lightning transaction builds on this structure. Let's make sure you know each part.",
      },
      {
        type: "text",
        content:
          "Bitcoin transactions have three core parts: <strong>inputs</strong> (where funds come from), <strong>outputs</strong> (where funds go), and <strong>witness data</strong> (the signatures that prove you're allowed to spend). Every Lightning construction, no matter how complex, is just a specially-crafted Bitcoin transaction. Hover over each part of the diagram on the left to learn what it does.",
      },
      {
        type: "callout",
        title: "The Key Insight",
        body: "A Bitcoin transaction is just a message that says \"move these coins from here to there, and here's proof I'm allowed to.\" Lightning constructs these messages off-chain.",
        variant: "key-concept",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s0-q1",
            question: "What does a transaction input reference?",
            options: [
              "A previous transaction's output",
              "A wallet address",
              "A block number",
              "A mining reward",
            ],
            correctIndex: 0,
            explanation:
              "Transaction inputs point to unspent outputs (UTXOs) from previous transactions. This is how Bitcoin tracks ownership: you don't have a balance, you have a collection of unspent outputs you can reference as inputs.",
          },
          {
            id: "s0-q2",
            question: "What is the witness field used for in SegWit transactions?",
            options: [
              "Storing the recipient's address",
              "Holding signature and proof data",
              "Recording the transaction fee",
              "Linking to the next block",
            ],
            correctIndex: 1,
            explanation:
              "The witness field holds the signature and public key data needed to prove the spender is authorized. SegWit moved this data out of the main transaction body, fixing transaction malleability.",
          },
        ],
      },
    ],
  },

  // ===== Section 1: The Scaling Problem =====
  {
    id: "1",
    title: "The Scaling Problem",
    subtitle: "Why can't we just use Bitcoin for everything?",
    visual: { component: "ScalingDiagram" },
    content: [
      {
        type: "heading",
        text: "The Scaling Problem",
        subtitle: "Why can't we just use Bitcoin for everything?",
      },
      {
        type: "text",
        content:
          "Bitcoin processes roughly <strong>7 transactions per second</strong>. A block is mined every ~10 minutes. Each transaction costs fees that fluctuate with demand. For a $3 coffee, you might pay $5 in fees and wait 30 minutes for confirmation. This doesn't scale to billions of daily transactions.",
      },
      {
        type: "text",
        content:
          "Visa processes around 1,700 transactions per second on average, with the capacity for much more. The Bitcoin base layer was never designed to match this throughput. Increasing block size has its own tradeoffs: larger blocks mean fewer people can run full nodes, which threatens decentralization.",
      },
      {
        type: "callout",
        title: "The Core Idea",
        body: "What if two people could exchange thousands of transactions between themselves, and only settle the final result on-chain? That's the core idea behind payment channels.",
        variant: "key-concept",
      },
      {
        type: "text",
        content:
          "A <strong>payment channel</strong> lets Alice and Bob lock funds together on-chain once, transact unlimited times off-chain (instantly, for free), and settle the final balance on-chain when they're done. The question is: how do you do this without trusting each other?",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s1-q1",
            question:
              "What is the main limitation of on-chain Bitcoin transactions for everyday payments?",
            options: [
              "They're slow and expensive relative to the payment size",
              "They require both parties to be online",
              "They can only send whole bitcoins",
              "They expire after 24 hours",
            ],
            correctIndex: 0,
            explanation:
              "Bitcoin's ~10-minute block times and variable fees make it impractical for small, everyday payments. A $3 purchase shouldn't require a $5 fee and a 30-minute wait.",
          },
        ],
      },
    ],
  },

  // ===== Section 2: The First Attempt =====
  {
    id: "2",
    title: "The First Attempt",
    subtitle: "Naive off-chain payments and why they fail",
    visual: { component: "NaivePaymentDiagram" },
    content: [
      {
        type: "heading",
        text: "The First Attempt",
        subtitle: "What if we just signed transactions back and forth?",
      },
      {
        type: "text",
        content:
          "The simplest payment channel: Alice locks funds on-chain, then signs transactions to Bob off-chain. Each new transaction replaces the last. Bob holds the latest signed transaction as proof of his balance. Simple, right?",
      },
      {
        type: "text",
        content:
          "The problem: nothing stops Alice from spending the same funding UTXO on-chain. She can broadcast a transaction that sends everything back to herself. Bob's off-chain transaction becomes invalid because the UTXO it references has already been spent. Bob trusted Alice, and Alice betrayed that trust.",
      },
      {
        type: "callout",
        title: "The Fundamental Problem",
        body: "Off-chain transactions have no enforcement mechanism. The person holding a signed transaction has to trust that the other party won't spend the on-chain funds out from under them.",
        variant: "warning",
      },
      {
        type: "text",
        content:
          "We need a structure where BOTH parties hold a signed transaction at all times, and neither party can unilaterally steal from the other. Enter: commitment transactions.",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s2-q1",
            question: "Why can Alice steal funds in the naive payment channel?",
            options: [
              "She can spend the funding UTXO on-chain before Bob broadcasts his TX",
              "Bob's TX has a higher fee",
              "Alice has more Bitcoin",
              "The timelock expired",
            ],
            correctIndex: 0,
            explanation:
              "Alice controls the funding UTXO and can broadcast a conflicting on-chain transaction at any time. Once that TX is mined, Bob's off-chain TX becomes invalid because its input has already been spent.",
          },
          {
            id: "s2-q2",
            question: "What does this reveal about naive off-chain payments?",
            options: [
              "They require trust in your counterparty not to double-spend",
              "They're slower than on-chain",
              "They cost more in fees",
              "They only work with small amounts",
            ],
            correctIndex: 0,
            explanation:
              "Without an enforcement mechanism, off-chain payments are just promises. The receiver has to trust that the sender won't spend the on-chain funds elsewhere. This defeats the purpose of a trustless system.",
          },
        ],
      },
    ],
  },

  // ===== Section 3: Opening a Channel =====
  {
    id: "3",
    title: "Opening a Channel",
    subtitle: "Alice and Bob open a shared tab",
    visual: { component: "FundingChannelDiagram" },
    content: [
      {
        type: "heading",
        text: "Opening a Channel",
        subtitle: "Alice and Bob open a shared tab",
      },
      {
        type: "text",
        content:
          "To open a payment channel, Alice and Bob create a special Bitcoin transaction called a <strong>funding transaction</strong>. It locks their combined funds into a <strong>2-of-2 multisig</strong> output, meaning BOTH of them must sign to move the money. Think of it like a joint bank account that requires both signatures on every check.",
      },
      {
        type: "text",
        content:
          "The funding output uses <strong>P2WSH</strong> (Pay to Witness Script Hash). The actual spending conditions (the 2-of-2 multisig script) are hashed and placed in the output. To spend it later, both Alice and Bob must reveal the original script and provide their signatures.",
      },
      {
        type: "callout",
        title: "Foundation of Lightning",
        body: "Neither Alice nor Bob can spend the channel funds alone. Every state change requires cooperation, or a pre-signed transaction. This is the foundation of Lightning.",
        variant: "key-concept",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s3-q1",
            question: "Why does the funding transaction use a 2-of-2 multisig?",
            options: [
              "To allow either party to spend unilaterally",
              "To ensure both parties must cooperate to move funds",
              "To reduce transaction fees",
              "To make the channel invisible on-chain",
            ],
            correctIndex: 1,
            explanation:
              "A 2-of-2 multisig ensures neither party can move funds alone. Both Alice and Bob must sign any transaction that spends from the channel, which is the basis for trustless off-chain updates.",
          },
          {
            id: "s3-q2",
            question: "What happens to the funds after the funding transaction is confirmed?",
            options: [
              "They're split equally between Alice and Bob",
              "They're locked until both parties sign a spending transaction",
              "They're held by a third-party escrow",
              "They can be spent by whichever party acts first",
            ],
            correctIndex: 1,
            explanation:
              "The funds sit in the 2-of-2 multisig output on-chain. They can only be moved when both parties cooperate to sign a new transaction. This is what makes off-chain state updates trustless.",
          },
        ],
      },
    ],
  },

  // ===== Section 4: The Cheating Problem =====
  {
    id: "4",
    title: "The Cheating Problem",
    subtitle: "What happens when Alice broadcasts an old state",
    visual: { component: "CheatingDiagram" },
    content: [
      {
        type: "heading",
        text: "The Cheating Problem",
        subtitle: "Why can't we just update balances?",
      },
      {
        type: "text",
        content:
          "After Alice and Bob lock funds in the 2-of-2 multisig, they create off-chain transactions to update their balances. Alice pays Bob by creating a new transaction that spends the funding output with different amounts. But here's the problem: every transaction they create is a <strong>valid Bitcoin transaction</strong>. Old ones don't disappear.",
      },
      {
        type: "text",
        content:
          "Alice and Bob might create three transactions over time: first Alice has 0.8 BTC and Bob has 0.2, then 0.5 and 0.5, then 0.3 and 0.7. Each one spends the same funding output. Only one can ever get mined (since after one is mined, the funding output is spent), but Alice gets to choose which one she broadcasts.",
      },
      {
        type: "text",
        content:
          "Nothing on the Bitcoin blockchain marks a transaction as \"current\" or \"old.\" Miners don't know about channel state. They just see valid transactions with valid signatures. If Alice broadcasts the first transaction (where she had 0.8 BTC), she effectively steals 0.5 BTC from Bob.",
      },
      {
        type: "callout",
        title: "The Core Problem",
        body: "Old transactions are still valid Bitcoin transactions. We need to make cheating economically irrational: if you broadcast an old state, your counterparty can take ALL the funds in the channel.",
        variant: "warning",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s4-q1",
            question: "Why can Alice cheat by broadcasting an old transaction?",
            options: [
              "Old transactions are still valid Bitcoin transactions that can be mined",
              "Bob's node was offline",
              "The funding transaction expired",
              "Alice controls more hashpower",
            ],
            correctIndex: 0,
            explanation:
              "Old transactions are perfectly valid Bitcoin transactions. The blockchain has no concept of 'channel state'. Any transaction with valid signatures that spends an unspent output will be accepted by miners.",
          },
          {
            id: "s4-q2",
            question: "What property must the penalty mechanism have to prevent cheating?",
            options: [
              "The cheater must lose MORE than they would gain",
              "The penalty must be exactly equal to the stolen amount",
              "The penalty must be approved by a third party",
              "The penalty must happen within one block",
            ],
            correctIndex: 0,
            explanation:
              "For cheating to be irrational, the expected cost must exceed the potential gain. In Lightning, the penalty is total: the cheater loses their ENTIRE channel balance, not just the amount they tried to steal.",
          },
        ],
      },
    ],
  },

  // ===== Section 5: Commitment Transactions =====
  {
    id: "5",
    title: "Commitment Transactions",
    subtitle: "Asymmetric views of the channel balance",
    visual: { component: "CommitmentPairDiagram" },
    content: [
      {
        type: "heading",
        text: "Commitment Transactions",
        subtitle: "Each party gets their own version",
      },
      {
        type: "text",
        content:
          "We saw that old transactions remain valid, so Alice can cheat by broadcasting a stale state. The solution is <strong>asymmetric commitment transactions</strong> with built-in delays that create a window for punishment.",
      },
      {
        type: "text",
        content:
          "Instead of one shared transaction, each party holds their OWN version of the current channel state. Alice's commitment TX and Bob's commitment TX both spend the same funding output, but they're structured differently. This asymmetry is the key to making cheating detectable and punishable.",
      },
      {
        type: "text",
        content:
          "On each party's own commitment TX, their own balance is subject to a <strong>delay</strong> (called <code>to_self_delay</code>). The counterparty's balance can be claimed immediately. Why? Because the delay creates a window for the counterparty to react if this is an old (revoked) state.",
      },
      {
        type: "text",
        content:
          "Each party holds the other's signature on their own commitment TX. Alice can broadcast her version at any time (she has Bob's signature), and Bob can broadcast his version (he has Alice's signature). Neither party needs the other's cooperation to go on-chain.",
      },
      {
        type: "callout",
        title: "The Key Insight",
        body: "The asymmetry is intentional. Your own output is delayed. Your counterparty's output is immediate. This delay is the window that makes the revocation penalty possible.",
        variant: "key-concept",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s5-q1",
            question: "Why does each party have their own version of the commitment transaction?",
            options: [
              "So they can broadcast without the other party's cooperation",
              "To reduce on-chain fees",
              "Because Bitcoin doesn't allow shared transactions",
              "To make transactions faster",
            ],
            correctIndex: 0,
            explanation:
              "Each party holds the other's signature on their own commitment TX. This means either party can go on-chain unilaterally if the other becomes unresponsive or tries to cheat.",
          },
          {
            id: "s5-q2",
            question: "Why is the broadcaster's own output delayed?",
            options: [
              "To give their counterparty time to check if this is an old, revoked state",
              "To reduce network congestion",
              "Because Bitcoin requires a waiting period",
              "To earn interest on the locked funds",
            ],
            correctIndex: 0,
            explanation:
              "The delay (to_self_delay) creates a window during which the counterparty can check the blockchain. If the broadcast commitment is an old, revoked state, the counterparty can use the revocation key to claim everything before the delay expires.",
          },
        ],
      },
    ],
  },

  // ===== Section 6: Revocation Keys =====
  {
    id: "6",
    title: "Revocation Keys",
    subtitle: "Constructing the penalty mechanism",
    visual: { component: "RevocationDiagram" },
    content: [
      {
        type: "heading",
        text: "Revocation Keys",
        subtitle: "The penalty that makes cheating irrational",
      },
      {
        type: "text",
        content:
          "Every commitment transaction has a built-in trap. The broadcaster's own output (<code>to_local</code>) has TWO spending paths. The first is a <strong>delayed path</strong>: the broadcaster can spend their own funds, but only after waiting N blocks. The second is the <strong>revocation path</strong>: the counterparty can spend these funds immediately, but only if they have the revocation key.",
      },
      {
        type: "text",
        content:
          "When Alice and Bob move from State 1 to State 2, Alice gives Bob her <strong>per-commitment secret</strong> for State 1. This allows Bob to derive the <strong>revocation private key</strong> for Alice's old commitment transaction. If Alice ever broadcasts that old TX, Bob can use the revocation key to claim Alice's output immediately, before Alice's delay expires.",
      },
      {
        type: "text",
        content:
          "The result: Alice loses EVERYTHING. Not just the amount she tried to steal, but her entire channel balance. This makes cheating a losing proposition. You'd have to be willing to lose all your funds for the chance of stealing some of your counterparty's.",
      },
      {
        type: "callout",
        title: "The Heart of Lightning Security",
        body: "The revocation key is the heart of Lightning's security. Neither party ever knows their OWN revocation key. Only your counterparty can derive it, and only after you reveal your per-commitment secret when advancing states.",
        variant: "key-concept",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s6-q1",
            question: "What does Alice reveal to Bob when they advance from State 1 to State 2?",
            options: [
              "Her per-commitment secret for State 1, allowing Bob to derive the revocation key",
              "Her private key",
              "The funding transaction signature",
              "Bob's share of the channel balance",
            ],
            correctIndex: 0,
            explanation:
              "When advancing states, Alice reveals her per-commitment secret for the OLD state. This gives Bob the ability to derive the revocation key, making Alice's old commitment transaction dangerous for her to broadcast.",
          },
          {
            id: "s6-q2",
            question: "What happens if Alice broadcasts an old commitment transaction after revealing her per-commitment secret?",
            options: [
              "Bob can use the revocation key to claim ALL channel funds before Alice's delay expires",
              "Bob can only claim his original share",
              "The transaction is automatically rejected by miners",
              "Alice gets a warning but keeps her funds",
            ],
            correctIndex: 0,
            explanation:
              "Bob uses the revocation key to spend Alice's to_local output via the revocation path (immediate, no delay). He claims ALL channel funds as a penalty. Alice gets nothing.",
          },
        ],
      },
    ],
  },
  // ===== Section 7: Updating Channel State =====
  {
    id: "7",
    title: "Updating Channel State",
    subtitle: "The careful dance of commit and revoke",
    visual: { component: "StateUpdateDiagram" },
    content: [
      {
        type: "heading",
        text: "Updating Channel State",
        subtitle: "The careful dance of commit and revoke",
      },
      {
        type: "callout",
        title: "Simplified View",
        body: "This diagram shows a simple balance update without HTLCs. In practice, payments route through HTLCs (Hash Time-Locked Contracts), which add outputs to commitment transactions and extra signature fields to protocol messages. We'll cover HTLCs later.",
        variant: "info",
      },
      {
        type: "text",
        content:
          "Every payment in a Lightning channel follows a precise four-message protocol. The order matters: you must commit to the new state BEFORE revoking the old one, ensuring you always have at least one valid signed commitment TX.",
      },
      {
        type: "text",
        content:
          "The flow begins when Alice wants to pay Bob. Since each party can independently construct the other's commitment TX from the shared channel state, Alice builds Bob's new commitment TX and sends him her <strong>funding signature</strong> via <code>commitment_signed</code>. Bob now has a signed new TX, but hasn't revoked the old one yet.",
      },
      {
        type: "text",
        content:
          "Bob responds with <code>revoke_and_ack</code>, which contains two critical fields: the <strong>per_commitment_secret</strong> for State 1 (enabling Alice to derive the revocation key for Bob's old TX) and the <strong>next_per_commitment_point</strong> for future states. He then sends his own <code>commitment_signed</code> with his funding signature on Alice's new TX.",
      },
      {
        type: "text",
        content:
          "Alice completes the cycle by sending her own <code>revoke_and_ack</code>, revealing her State 1 per-commitment secret. Both old states are now revoked, and both parties hold valid new commitment TXs for State 2.",
      },
      {
        type: "callout",
        title: "Safety During Updates",
        body: "There is a brief moment during the update where both old and new commitments are valid. This is safe because the party who moved first (the payer) already committed to giving the receiver more money. They have no incentive to broadcast the old state.",
        variant: "key-concept",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s7-q1",
            question:
              "In what order do the parties update the channel state?",
            options: [
              "Sign new commitments first, then revoke old state",
              "Revoke old state first, then sign new",
              "Sign and revoke simultaneously",
              "Ask a third party to mediate",
            ],
            correctIndex: 0,
            explanation:
              "You commit to the new state before revoking the old one. This ensures you always have at least one valid signed commitment TX. Revoking first would leave you with no valid TX to broadcast if the other party disappears.",
          },
          {
            id: "s7-q2",
            question:
              "What message reveals the per-commitment secret for the old state?",
            options: [
              "revoke_and_ack",
              "commitment_signed",
              "funding_locked",
              "channel_update",
            ],
            correctIndex: 0,
            explanation:
              "revoke_and_ack serves two purposes: it reveals the old per-commitment secret (revoking the old state) and acknowledges receipt of the counterparty's new commitment signature.",
          },
        ],
      },
    ],
  },
  // ===== Section 8: The Lightning Network =====
  {
    id: "8",
    title: "The Lightning Network",
    subtitle: "From channels to a global payment network",
    visual: { component: "NetworkDiagram" },
    content: [
      {
        type: "heading",
        text: "The Lightning Network",
        subtitle: "From channels to a global payment network",
      },
      {
        type: "text",
        content:
          "So far, everything we've covered works between two parties: Alice and Bob open a channel, update their balances, and can close it at any time. But the real power of Lightning isn't a single channel. It's a <strong>mesh of payment channels</strong> connecting thousands of nodes.",
      },
      {
        type: "text",
        content:
          "Here's a concrete example: Alice wants to pay Dianne 400,000 sats. Alice doesn't have a channel with Dianne, but she does have one with Bob, and Bob has one with Dianne. Can Alice route her payment <strong>through Bob</strong> to reach Dianne?",
      },
      {
        type: "text",
        content:
          "Routing nodes like Bob earn fees for forwarding payments. The more channels a node has (and the more capacity those channels have), the more useful it is to the network. This creates an economic incentive for nodes to be well-connected and reliable.",
      },
      {
        type: "text",
        content:
          "But this raises a critical question: how do you route payments through <strong>untrusted intermediaries</strong>? If Alice gives Bob 405,000 sats to forward 400,000 to Dianne, what stops Bob from keeping the money? We need a mechanism that makes the payment <strong>conditional</strong>: Bob only gets paid if he can prove he forwarded the payment.",
      },
      {
        type: "callout",
        title: "The Routing Problem",
        body: "Alice wants to pay Dianne through Bob. She needs a guarantee: \"I'll pay you 405,000 sats, but ONLY if you can prove you forwarded 400,000 to Dianne.\" The answer is Hash Time-Locked Contracts (HTLCs).",
        variant: "key-concept",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s8-q1",
            question:
              "Why can't Alice simply send a payment to someone she doesn't share a channel with?",
            options: [
              "She needs a chain of payment channels connecting her to the recipient",
              "She needs to open a direct channel first",
              "The Lightning protocol only works between two parties",
              "She has to wait for an on-chain confirmation",
            ],
            correctIndex: 0,
            explanation:
              "Lightning payments travel through existing channels. Alice doesn't need a direct channel with the recipient, but she does need a path of channels connecting them through intermediate nodes.",
          },
          {
            id: "s8-q2",
            question:
              "What is the key problem with routing payments through untrusted nodes?",
            options: [
              "Intermediate nodes could steal the funds instead of forwarding them",
              "The payment takes too long to route",
              "Routing fees are too expensive",
              "The channel capacity is too limited",
            ],
            correctIndex: 0,
            explanation:
              "Without a mechanism to enforce forwarding, an intermediate node could simply take the payment and never pass it along. We need conditional payments that guarantee atomicity: either the full route settles, or nothing does.",
          },
        ],
      },
    ],
  },

  // ===== Section 9: HTLCs: Conditional Payments =====
  {
    id: "9",
    title: "HTLCs: Conditional Payments",
    subtitle: "Hash locks and time locks working together",
    visual: { component: "HTLCDiagram" },
    content: [
      {
        type: "heading",
        text: "HTLCs: Conditional Payments",
        subtitle: "Hash locks and time locks working together",
      },
      {
        type: "text",
        content:
          "Let's solve the routing problem from the previous section. Dianne generates a random secret called a <strong>preimage</strong> (R) and computes its hash: H = SHA256(R). She puts H in her invoice and sends it to Alice. Now Dianne is the only person who knows R.",
      },
      {
        type: "text",
        content:
          "Alice creates a <strong>Hash Time-Locked Contract</strong> (HTLC) with Bob: \"I'll pay you 405,000 sats IF you reveal preimage R where SHA256(R) = H. Otherwise, if block 200 passes, I get my money back.\" Bob then creates his own HTLC with Dianne using the same hash H: \"I'll pay you 400,000 sats IF you reveal R. Otherwise, if block 180 passes, I get my money back.\"",
      },
      {
        type: "text",
        content:
          "Each HTLC has two paths enforced by Bitcoin Script. The <strong>hash lock</strong>: claim funds by revealing preimage R. The <strong>time lock</strong>: reclaim funds after a timeout block. Notice that Bob's timeout with Dianne (block 180) is shorter than Alice's with Bob (block 200). This gives Bob time to learn R from Dianne and still claim from Alice.",
      },
      {
        type: "text",
        content:
          "When Dianne reveals R to Bob, she claims her 400,000 sats. Now Bob knows R, so he reveals it to Alice and claims his 405,000 sats (keeping the 5,000 sat difference as a <strong>routing fee</strong>). The preimage propagates backward along the route, settling each HTLC in sequence.",
      },
      {
        type: "callout",
        title: "Atomic Guarantees",
        body: "The payment is atomic: either every HTLC along the route settles (preimage revealed) or none of them do (timeout). No intermediate node can steal funds because they can only claim incoming funds by revealing R, which simultaneously lets the previous node claim theirs. Funds are never lost or stuck.",
        variant: "key-concept",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s9-q1",
            question: "What must the recipient reveal to claim an HTLC?",
            options: [
              "The preimage R such that SHA256(R) equals the payment hash H",
              "Their private key",
              "The funding transaction signature",
              "The sender's per-commitment secret",
            ],
            correctIndex: 0,
            explanation:
              "The recipient must reveal the original preimage R. The hash lock verifies that SHA256(R) matches H. This proves the recipient knows the secret and is the intended payee.",
          },
          {
            id: "s9-q2",
            question:
              "What happens if the recipient never reveals the preimage?",
            options: [
              "After the timeout expires, the sender reclaims the locked funds",
              "The funds are permanently locked",
              "A third party arbitrates the dispute",
              "The channel is force-closed",
            ],
            correctIndex: 0,
            explanation:
              "The time lock ensures the sender can always recover their funds after block N. This prevents funds from being held hostage. The payment simply fails and the sender gets their money back.",
          },
        ],
      },
    ],
  },

  // ===== Section 10: HTLCs & Channel Updates =====
  {
    id: "10",
    title: "HTLCs & Channel Updates",
    subtitle: "Adding an HTLC with the commit/revoke protocol",
    visual: { component: "HTLCUpdateDiagram" },
    content: [
      {
        type: "heading",
        text: "HTLCs & Channel Updates",
        subtitle: "Adding an HTLC with the commit/revoke protocol",
      },
      {
        type: "text",
        content:
          "We've seen how the commit/revoke protocol updates simple balances, and how HTLCs create conditional payments using hash locks and time locks. Now let's put them together: how does Alice actually <strong>add an HTLC</strong> to the channel?",
      },
      {
        type: "text",
        content:
          "The process starts with a new message: <code>update_add_htlc</code>. Alice sends this to Bob to propose the HTLC. It contains the payment hash H, the amount (405,000 sats), the CLTV expiry (block 200), and an onion-encrypted routing packet. Bob stages the HTLC locally but does NOT forward it yet. The old commitment transactions are still the current valid state.",
      },
      {
        type: "text",
        content:
          "Then the familiar commit/revoke dance begins, but now the new commitment transactions include an extra output: the <strong>HTLC output</strong>. On Alice's TX, this is an <strong>offered HTLC</strong> (she's offering to pay). On Bob's TX, it's a <strong>received HTLC</strong> (he's receiving the payment). Each has three spending paths: revocation, hash-lock success, and timeout.",
      },
      {
        type: "callout",
        title: "When Can Bob Forward?",
        body: "Bob must NOT forward the HTLC to Dianne until his old state is revoked. If he forwarded early and Alice broadcast her old commitment TX (without the HTLC), Bob would lose money. Once Bob sends revoke_and_ack, his old state is revoked and it's safe to forward.",
        variant: "warning",
      },
      {
        type: "text",
        content:
          "Step through the diagram to watch the five-message flow: <code>update_add_htlc</code>, two <code>commitment_signed</code> messages, and two <code>revoke_and_ack</code> messages. Hover over the HTLC output on each party's commitment TX to see the full witnessScript with its three spending paths.",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s10-q1",
            question:
              "Why must Bob wait to forward the HTLC until after sending revoke_and_ack?",
            options: [
              "Because Alice could broadcast her old commitment TX (without the HTLC) and Bob would lose funds",
              "Because the payment hash hasn't been verified yet",
              "Because Bob needs more channel capacity",
              "Because the CLTV expiry hasn't been set",
            ],
            correctIndex: 0,
            explanation:
              "If Bob forwards the HTLC before his old state is revoked, Alice could broadcast her old commitment TX that doesn't include the HTLC. Bob would have paid Dianne but have no way to claim from Alice. After revoking, Alice's old TX becomes dangerous for her to broadcast.",
          },
          {
            id: "s10-q2",
            question:
              "What are the three spending paths in an HTLC output's witnessScript?",
            options: [
              "Revocation (penalty), hash-lock success (preimage), and timeout (CLTV expiry)",
              "Multisig, timelock, and hashlock",
              "Immediate spend, delayed spend, and penalty",
              "Alice's key, Bob's key, and a shared key",
            ],
            correctIndex: 0,
            explanation:
              "Each HTLC output has three paths: (1) Revocation, so cheating is penalized, (2) Hash-lock success, so the recipient can claim by revealing the preimage, and (3) Timeout, so the offerer can reclaim after the CLTV expiry if the preimage is never revealed.",
          },
        ],
      },
    ],
  },

  // ===== Section 11: Settling HTLCs =====
  {
    id: "11",
    title: "Settling HTLCs",
    subtitle: "Fulfilling and failing off-chain payments",
    visual: { component: "HTLCSettleDiagram" },
    content: [
      {
        type: "heading",
        text: "Settling HTLCs",
        subtitle: "Fulfilling and failing off-chain payments",
      },
      {
        type: "callout",
        title: "Simplified HTLC View",
        body: "The HTLC visual from the previous section was simplified. In reality, there's an HTLC output with a more complicated spending script on both Alice and Bob's commitment TX. There are also additional protocol messages involved (per-commitment secrets for revocation). Here we focus on how HTLCs are resolved off-chain.",
        variant: "info",
      },
      {
        type: "text",
        content:
          "The recipient who knows the preimage could claim on-chain by publishing their commitment TX and sweeping the HTLC output. But that closes the channel. Instead, they send <code>update_fulfill_htlc</code> containing the <strong>channel_id</strong>, <strong>htlc_id</strong>, and <strong>payment_preimage</strong> to prove they <em>could</em> claim on-chain. Both parties then remove the HTLC output and add the funds to the recipient's balance in the next commitment state.",
      },
      {
        type: "callout",
        title: "Atomicity Guarantee",
        body: "If Dianne claims the HTLC on-chain from Bob instead of sending update_fulfill_htlc, Bob still learns the preimage R from the on-chain transaction. He can use R to claim from Alice. The payment is still atomic.",
        variant: "key-concept",
      },
      {
        type: "text",
        content:
          "When things don't work out (e.g., Dianne goes offline or the next hop can't forward), a peer sends <code>update_fail_htlc</code> or <code>update_fail_malformed_htlc</code> back along the route. <code>update_fail_htlc</code> contains an encrypted <strong>reason</strong> that only the original sender can read. <code>update_fail_malformed_htlc</code> is for BADONION errors where the onion packet was corrupted.",
      },
      {
        type: "text",
        content:
          "BOLT 4 defines four failure reason categories, combined as bitmask flags. <strong>BADONION</strong> (0x8000): invalid onion version, HMAC, or key. <strong>PERM</strong> (0x4000): permanent failures that won't resolve on retry. <strong>NODE</strong> (0x2000): node-level failures. <strong>UPDATE</strong> (0x1000): payment parameter errors like insufficient fee, HTLC amount too small, or incorrect CLTV expiry. These can be combined (e.g., PERM | NODE = permanent node failure).",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s11-q1",
            question:
              "Why does the recipient send update_fulfill_htlc instead of claiming the HTLC on-chain?",
            options: [
              "To keep the channel open \u2014 both parties remove the HTLC and update balances off-chain",
              "Because on-chain claims are invalid",
              "Because the preimage can only be used off-chain",
              "To avoid paying mining fees to themselves",
            ],
            correctIndex: 0,
            explanation:
              "Claiming on-chain would force-close the channel. By sending update_fulfill_htlc, both parties simply update their commitment transactions to reflect the new balances. The channel stays open for future payments.",
          },
          {
            id: "s11-q2",
            question:
              "What happens if an intermediate node fails to forward an HTLC?",
            options: [
              "They send update_fail_htlc back along the route with an encrypted failure reason",
              "The payment is automatically retried",
              "The channel is force-closed",
              "The funds are permanently locked",
            ],
            correctIndex: 0,
            explanation:
              "The failing node sends update_fail_htlc back toward the sender. The failure reason is onion-encrypted so only the original sender can read it. Each hop along the return path removes the HTLC and restores the sender's balance.",
          },
        ],
      },
    ],
  },

  // ===== Section 12: Closing Channels =====
  {
    id: "12",
    title: "Closing Channels",
    subtitle: "Cooperative and force close",
    visual: { component: "ClosingDiagram" },
    content: [
      {
        type: "heading",
        text: "Closing Channels",
        subtitle: "Cooperative and force close",
      },
      {
        type: "text",
        content:
          "There are two ways to close a Lightning channel. A <strong>cooperative close</strong> happens when both parties agree on the final balances. They create a simple closing transaction together: no delays, no revocation paths, just a clean split. This is the best case: low fees, instant finality.",
      },
      {
        type: "text",
        content:
          "A <strong>force close</strong> happens when one party broadcasts their latest commitment transaction unilaterally. Maybe the other party is unreachable, or maybe they're being uncooperative. The broadcaster's own output is delayed (the usual <code>to_self_delay</code>). Any pending HTLCs must be resolved on-chain with separate transactions.",
      },
      {
        type: "text",
        content:
          "Force closes are more expensive (higher fees due to the complex commitment scripts) and slower (the delay must expire before the broadcaster can spend). They're the \"break glass in case of emergency\" option. The protocol incentivizes cooperative closes: both parties save on fees and get their funds faster.",
      },
      {
        type: "callout",
        title: "Always Prefer Cooperative",
        body: "A cooperative close is always preferred: lower fees, instant settlement, simpler transaction. Force close is the safety net that ensures you can always recover your funds, even if your counterparty disappears.",
        variant: "key-concept",
      },
      {
        type: "quiz",
        questions: [
          {
            id: "s12-q1",
            question:
              "What is the key advantage of a cooperative close over a force close?",
            options: [
              "No delays, lower fees, and immediate access to funds for both parties",
              "It doesn't require an on-chain transaction",
              "It can close multiple channels at once",
              "It preserves the channel for future use",
            ],
            correctIndex: 0,
            explanation:
              "A cooperative close is a single simple transaction with no delays. Both parties get their funds immediately. Force closes are complex, expensive, and the broadcaster must wait for the to_self_delay.",
          },
          {
            id: "s12-q2",
            question: "When would a force close be necessary?",
            options: [
              "When the counterparty is unreachable or uncooperative",
              "When the channel balance is too small",
              "When you want to earn routing fees",
              "When the funding TX has too many confirmations",
            ],
            correctIndex: 0,
            explanation:
              "Force close is the unilateral option: you can always go on-chain without your counterparty's cooperation. It's designed for the case where negotiation has failed or your peer has gone offline.",
          },
        ],
      },
    ],
  },
];
