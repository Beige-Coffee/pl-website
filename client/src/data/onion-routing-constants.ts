/**
 * Onion Routing Course -- Canonical Payment Trace Constants
 *
 * This file defines the deterministic node identities, channels, fee policies,
 * and pre-computed payment trace used across all onion routing exercises.
 *
 * All keypairs are derived deterministically:
 *   private_key = SHA256("<name>_onion_routing_node")
 *   public_key  = compressed secp256k1 point derived from private_key
 *
 * The canonical route is: Alice -> Bob -> Carol -> Dave
 * Dave is the payment recipient. Alice is the sender.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NodeIdentity {
  name: string;
  privateKey: string; // 32-byte hex (64 chars)
  publicKey: string;  // 33-byte compressed hex (66 chars, starts with 02 or 03)
}

export interface ChannelPolicy {
  feeBaseMsat: number;
  feeProportionalMillionths: number;
  cltvExpiryDelta: number;
}

export interface Channel {
  shortChannelId: string;
  node1: string; // public key hex
  node2: string; // public key hex
  policy1to2: ChannelPolicy; // node1 -> node2 direction
  policy2to1: ChannelPolicy; // node2 -> node1 direction (can differ)
}

export interface HopData {
  nodeName: string;
  nodePublicKey: string;
  shortChannelId: string; // channel to forward on (empty string for final hop)
  amtToForwardMsat: number;
  outgoingCltvValue: number;
}

export interface CanonicalTrace {
  paymentAmountMsat: number;
  paymentHash: string;
  paymentSecret: string;
  paymentPreimage: string;
  minFinalCltvExpiryDelta: number;
  referenceBlockHeight: number;
  route: HopData[]; // [bob_hop, carol_hop, dave_hop]
  totalFeeMsat: number;
  aliceSendAmountMsat: number; // total Alice pays (payment + all fees)
  aliceSendCltvExpiry: number; // CLTV Alice puts on the HTLC to Bob
}

// ---------------------------------------------------------------------------
// Node Identities
// ---------------------------------------------------------------------------
// Each private key = SHA256("<name>_onion_routing_node")
// Each public key = compressed secp256k1 point derived from that private key
// Generated using Python's `ecdsa` library (SECP256k1 curve).

export const NODES: Record<string, NodeIdentity> = {
  alice: {
    name: "alice",
    // SHA256("alice_onion_routing_node")
    privateKey: "236b193a3cebbae1f5b67a9d3846168a78cb2757e5d251dd2dd57b27738f3a54",
    publicKey:  "02e060e2986fdcef987a8d693a59464577891512d804fe370f49e8bd346d1ae164",
  },
  bob: {
    name: "bob",
    // SHA256("bob_onion_routing_node")
    privateKey: "46e90b3c64ff145e2791b96203e05aae7c3cfd4c75a0cbe8104e17668d7e2605",
    publicKey:  "0346c83518a2b87d87ab22b039eea904e9dfa5436ec4519568611cefc02f35959f",
  },
  carol: {
    name: "carol",
    // SHA256("carol_onion_routing_node")
    privateKey: "caa2f1e519c111866ad8e2ecef71c905388910c34812e985087c9b31aefbaa50",
    publicKey:  "02bdbf18cdee4c85e766152ad003bb19e7b3c4abab93c53c99ddbe127a0908fb0a",
  },
  dave: {
    name: "dave",
    // SHA256("dave_onion_routing_node")
    privateKey: "684e3530de471cc01690ec0d5d0829fc444fa67786b6e6fea51962a0e665377e",
    publicKey:  "0222868167a8d7083bb75ddda74b07fc059d7e64b494925cdb8d4a40186a844738",
  },
};

// ---------------------------------------------------------------------------
// Session Key (Alice's ephemeral key for onion construction)
// ---------------------------------------------------------------------------
// private_key = SHA256("alice_onion_session_key_v1")
// Used as the ephemeral private key in Sphinx onion packet construction.

export const SESSION_KEY =
  "6fec05b35954e11498064c2888c8cba87e128d69ac814730978330d557e7e5d6";

// The corresponding compressed public key (included for reference/exercises):
export const SESSION_KEY_PUBLIC =
  "02b53fafe4de8761038ee61ef641dd76cb390c495a0bf87fa684adc7e0e96c4348";

// ---------------------------------------------------------------------------
// Fee Policies
// ---------------------------------------------------------------------------
// Bob's forwarding policy (Alice -> Bob -> Carol direction):
//   fee_base_msat = 1000, fee_proportional_millionths = 100, cltv_expiry_delta = 40
//
// Carol's forwarding policy (Bob -> Carol -> Dave direction):
//   fee_base_msat = 500, fee_proportional_millionths = 50, cltv_expiry_delta = 30

const BOB_POLICY: ChannelPolicy = {
  feeBaseMsat: 1000,
  feeProportionalMillionths: 100,
  cltvExpiryDelta: 40,
};

const CAROL_POLICY: ChannelPolicy = {
  feeBaseMsat: 500,
  feeProportionalMillionths: 50,
  cltvExpiryDelta: 30,
};

// Reverse-direction policies (not used in canonical trace but included for
// completeness -- these would apply to payments flowing the other way).
const BOB_REVERSE_POLICY: ChannelPolicy = {
  feeBaseMsat: 1200,
  feeProportionalMillionths: 150,
  cltvExpiryDelta: 40,
};

const CAROL_REVERSE_POLICY: ChannelPolicy = {
  feeBaseMsat: 700,
  feeProportionalMillionths: 75,
  cltvExpiryDelta: 30,
};

// Alice and Dave don't forward in the canonical trace, but we give them
// symmetric policies for completeness.
const ALICE_POLICY: ChannelPolicy = {
  feeBaseMsat: 1000,
  feeProportionalMillionths: 100,
  cltvExpiryDelta: 40,
};

const DAVE_POLICY: ChannelPolicy = {
  feeBaseMsat: 500,
  feeProportionalMillionths: 50,
  cltvExpiryDelta: 30,
};

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------
// Route: Alice -> Bob -> Carol -> Dave
// Three channels forming the payment path.

export const CHANNELS: Channel[] = [
  {
    // Alice <-> Bob
    shortChannelId: "700000x1x0",
    node1: NODES.alice.publicKey,
    node2: NODES.bob.publicKey,
    policy1to2: ALICE_POLICY,  // Alice -> Bob (Alice's outbound policy)
    policy2to1: BOB_POLICY,    // Bob -> Alice (Bob's policy back toward Alice)
  },
  {
    // Bob <-> Carol
    shortChannelId: "700000x2x0",
    node1: NODES.bob.publicKey,
    node2: NODES.carol.publicKey,
    policy1to2: BOB_POLICY,          // Bob -> Carol (Bob's forwarding policy)
    policy2to1: CAROL_REVERSE_POLICY, // Carol -> Bob
  },
  {
    // Carol <-> Dave
    shortChannelId: "700000x3x0",
    node1: NODES.carol.publicKey,
    node2: NODES.dave.publicKey,
    policy1to2: CAROL_POLICY,        // Carol -> Dave (Carol's forwarding policy)
    policy2to1: DAVE_POLICY,         // Dave -> Carol
  },
];

// ---------------------------------------------------------------------------
// Canonical Payment Trace
// ---------------------------------------------------------------------------
//
// Payment: Alice pays Dave 50,000 sats (50,000,000 msat)
// Route:   Alice -> Bob -> Carol -> Dave
// Reference block height: 700,000
//
// --- Fee calculation (working backward from Dave) ---
//
// Step 1: Dave (final recipient)
//   amount_received  = 50,000,000 msat
//   cltv_expiry      = 700,000 + 18 (min_final_cltv_expiry_delta) = 700,018
//
// Step 2: Carol forwards to Dave
//   Carol's outgoing: amt = 50,000,000, cltv = 700,018
//   Carol's fee = fee_base + floor(amt_forwarded * fee_proportional / 1,000,000)
//               = 500 + floor(50,000,000 * 50 / 1,000,000)
//               = 500 + 2,500
//               = 3,000 msat
//   Carol needs incoming: amt >= 50,000,000 + 3,000 = 50,003,000 msat
//                         cltv >= 700,018 + 30       = 700,048
//
// Step 3: Bob forwards to Carol
//   Bob's outgoing: amt = 50,003,000, cltv = 700,048
//   Bob's fee = fee_base + floor(amt_forwarded * fee_proportional / 1,000,000)
//             = 1,000 + floor(50,003,000 * 100 / 1,000,000)
//             = 1,000 + 5,000    (floor(5,000,300,000 / 1,000,000) = 5,000)
//             = 6,000 msat
//   Bob needs incoming: amt >= 50,003,000 + 6,000 = 50,009,000 msat
//                       cltv >= 700,048 + 40       = 700,088
//
// Step 4: Alice sends to Bob
//   Alice sends: 50,009,000 msat with CLTV expiry 700,088
//
// Total routing fees: 6,000 + 3,000 = 9,000 msat (9 sats)
//
// --- Payment identifiers ---
//
// Preimage:       "ProgrammingLightning_OnionRouting"
// payment_hash:   SHA256(preimage) = 27f3379eae3890e8b422758ca15cdd8004f10fb9078f28a74e711fc3d0808bf8
// payment_secret: SHA256("ProgrammingLightning_OnionRouting_payment_secret")
//               = febcc66da33b748908674f0780506b9a1835e1c738ad8821c244d5023423bbcc

export const CANONICAL_TRACE: CanonicalTrace = {
  paymentAmountMsat: 50_000_000,
  paymentPreimage: "ProgrammingLightning_OnionRouting",
  paymentHash: "27f3379eae3890e8b422758ca15cdd8004f10fb9078f28a74e711fc3d0808bf8",
  paymentSecret: "febcc66da33b748908674f0780506b9a1835e1c738ad8821c244d5023423bbcc",
  minFinalCltvExpiryDelta: 18,
  referenceBlockHeight: 700_000,

  // What Alice encodes in each onion hop payload:
  //
  // Hop 1 (for Bob): "forward 50,003,000 msat to Carol via channel 700000x2x0,
  //                   with outgoing CLTV 700,048"
  // Hop 2 (for Carol): "forward 50,000,000 msat to Dave via channel 700000x3x0,
  //                     with outgoing CLTV 700,018"
  // Hop 3 (for Dave): "you are the final recipient, amount = 50,000,000 msat,
  //                    CLTV 700,018" (no forwarding channel)
  route: [
    {
      // Hop 1: Bob (intermediate)
      nodeName: "bob",
      nodePublicKey: NODES.bob.publicKey,
      shortChannelId: "700000x2x0", // channel Bob uses to forward to Carol
      amtToForwardMsat: 50_003_000,  // what Bob sends onward to Carol
      outgoingCltvValue: 700_048,    // CLTV on Bob's outgoing HTLC to Carol
    },
    {
      // Hop 2: Carol (intermediate)
      nodeName: "carol",
      nodePublicKey: NODES.carol.publicKey,
      shortChannelId: "700000x3x0", // channel Carol uses to forward to Dave
      amtToForwardMsat: 50_000_000,  // what Carol sends onward to Dave
      outgoingCltvValue: 700_018,    // CLTV on Carol's outgoing HTLC to Dave
    },
    {
      // Hop 3: Dave (final recipient)
      nodeName: "dave",
      nodePublicKey: NODES.dave.publicKey,
      shortChannelId: "",            // empty -- Dave is the final hop
      amtToForwardMsat: 50_000_000,  // amount Dave receives
      outgoingCltvValue: 700_018,    // min CLTV expiry for Dave's incoming HTLC
    },
  ],

  // Summary
  totalFeeMsat: 9_000,          // bob_fee (6,000) + carol_fee (3,000)
  aliceSendAmountMsat: 50_009_000, // payment (50,000,000) + total fees (9,000)
  aliceSendCltvExpiry: 700_088,    // 700,000 + 18 + 30 + 40
};
