export interface TxDiagramData {
  txid: string;
  label: string;
  version: number;
  locktime: number;
  inputs: Array<{
    id: string;
    prevTxid: string;
    prevIndex: number;
    sequence: number;
    label?: string;
    highlightGroup?: string;
  }>;
  outputs: Array<{
    id: string;
    valueSats: number;
    scriptType: string;
    scriptDisplay: string;
    label: string;
    highlightGroup?: string;
  }>;
  witness?: Array<{
    id: string;
    elements: string[];
    highlightGroup?: string;
  }>;
  tooltips: Record<string, { title: string; description: string }>;
}

export const SIMPLE_TX: TxDiagramData = {
  txid: "a1b2c3...f4e5d6",
  label: "Simple Bitcoin Transaction",
  version: 2,
  locktime: 0,
  inputs: [
    {
      id: "input-0",
      prevTxid: "7d8e9f...abc123",
      prevIndex: 0,
      sequence: 0xffffffff,
      label: "Alice's previous output",
    },
  ],
  outputs: [
    {
      id: "output-0",
      valueSats: 50_000_000,
      scriptType: "P2WPKH",
      scriptDisplay: "OP_0 <pubkey_hash>",
      label: "Payment to Bob",
    },
    {
      id: "output-1",
      valueSats: 49_000_000,
      scriptType: "P2WPKH",
      scriptDisplay: "OP_0 <pubkey_hash>",
      label: "Change back to Alice",
    },
  ],
  witness: [
    {
      id: "witness-0",
      elements: ["<signature>", "<public_key>"],
    },
  ],
  tooltips: {
    "input-0": {
      title: "Transaction Input",
      description:
        "Points to a previous transaction output (UTXO) that Alice owns. This is where the funds come from.",
    },
    "output-0": {
      title: "Payment Output",
      description:
        "Creates a new UTXO locked to Bob's public key hash. Bob can spend this with his private key.",
    },
    "output-1": {
      title: "Change Output",
      description:
        "Sends the remaining funds back to Alice. The difference between input and outputs is the mining fee.",
    },
    "witness-0": {
      title: "Witness Data",
      description:
        "Contains Alice's signature proving she owns the input, plus her public key for verification.",
    },
    txid: {
      title: "Transaction ID (txid)",
      description:
        "A double-SHA256 of the serialized transaction data. For segwit transactions, the txid excludes witness data. It uniquely identifies this transaction on the blockchain.",
    },
    version: {
      title: "Transaction Version",
      description:
        "Version 2 enables OP_CHECKSEQUENCEVERIFY (CSV), which is essential for Lightning's relative timelocks. Commitment transactions use CSV to enforce the revocation delay.",
    },
    locktime: {
      title: "Locktime (nLockTime)",
      description:
        "When non-zero, prevents the transaction from being mined before a certain block height or time. In Lightning commitment transactions, the locktime field encodes part of the obscured commitment number.",
    },
    sequence: {
      title: "Input Sequence (nSequence)",
      description:
        "Controls relative timelocks (via CSV) and signals Replace-By-Fee. In Lightning, the sequence field on commitment transaction inputs encodes the other half of the obscured commitment number. 0xFFFFFFFF disables both RBF and relative timelock.",
    },
  },
};

export const FUNDING_TX: TxDiagramData = {
  txid: "AliceBobFunding1",
  label: "Funding Transaction",
  version: 2,
  locktime: 0,
  inputs: [
    {
      id: "input-0",
      prevTxid: "AliceTx1",
      prevIndex: 0,
      sequence: 0xffffffff,
      label: "Alice's UTXO",
    },
  ],
  outputs: [
    {
      id: "output-0",
      valueSats: 5_000_000,
      scriptType: "P2WSH",
      scriptDisplay: "OP_0 <script_hash>",
      label: "2-of-2 Multisig",
      highlightGroup: "funding-output",
    },
  ],
  witness: [
    {
      id: "witness-0",
      elements: ["(added when signed)"],
    },
  ],
  tooltips: {
    "input-0": {
      title: "Funding Input",
      description:
        "Alice contributes her funds to the channel. In practice, both parties can contribute inputs.",
    },
    "output-0": {
      title: "Channel Funding Output",
      description:
        "A P2WSH output that locks 5,000,000 sats (0.05 BTC) into a 2-of-2 multisig. Neither party can spend alone.",
    },
    "witness-0": {
      title: "Witness",
      description:
        "Alice's signature will be added here when the funding transaction is broadcast.",
    },
    txid: {
      title: "Funding TXID",
      description:
        "This transaction ID will be referenced by all future commitment transactions in this channel.",
    },
    version: {
      title: "Transaction Version",
      description:
        "Version 2 enables OP_CHECKSEQUENCEVERIFY (CSV), which is essential for Lightning's relative timelocks. Commitment transactions use CSV to enforce the revocation delay.",
    },
    locktime: {
      title: "Locktime (nLockTime)",
      description:
        "Set to 0 for the funding transaction. In later commitment transactions, this field will encode part of the obscured commitment number.",
    },
    sequence: {
      title: "Input Sequence (nSequence)",
      description:
        "0xFFFFFFFF disables both RBF and relative timelock. In commitment transactions, this field will encode the other half of the obscured commitment number.",
    },
  },
};
