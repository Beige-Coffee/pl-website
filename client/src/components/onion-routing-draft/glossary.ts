// ────────────────────────────────────────────────────────────────────────────
// glossary.ts
//
// Single source of truth for the hover-glossary feature: the course's recurring
// technical terms -> a short definition, category, optional derivation formula,
// and the chapter where the term is introduced.
//
// Resolution: snake_case identifiers (pad_key, next_hmac, hop_payloads, ...) are
// exact entries. Subscripted families (rho_B, ss_AD, E_AC, mu_i, bf_AB, s_B, ...)
// all resolve to ONE family entry (rho, ss, E, mu, bf, s, ...), so a single
// definition covers every subscript variant. bob_hmac / charlie_hmac / dave_hmac
// map to one "hop HMAC" entry.
//
// Because the tutorial page's code / <m> / <g> handlers resolve against this
// table, a term lights up wherever it appears, in every chapter. To extend
// coverage, add an entry here (and optionally <g>-tag a prose-only occurrence).
//
// Definitions are reminders, not re-teaches: short, ending with the chapter that
// teaches the term. Backtick code/vars and use *italics*; no em-dashes (style rule).
// ────────────────────────────────────────────────────────────────────────────

export type GlossaryCategory =
  | "per-hop key"
  | "session key"
  | "shared secret"
  | "ephemeral key"
  | "protocol field"
  | "concept"
  | "operation"
  | "your function";

export interface GlossaryEntry {
  /** How the term renders in the popover header: math (subscripts) / code (mono) / text. */
  render: "math" | "code" | "text";
  category: GlossaryCategory;
  /** 1-2 sentence definition. Backtick code/vars and use *italics*; rendered via renderCaption. */
  definition: string;
  /** Optional derivation, rendered as math. Mostly the key / secret / ephemeral families. */
  formula?: string;
  /** Optional Python def line, rendered verbatim in mono (used by the
   * "your function" entries; NOT math-tokenized, so rho_key stays rho_key). */
  signature?: string;
  /** Chapter where the term is introduced, e.g. "6". */
  chapter?: string;
}

const ENTRIES: Record<string, GlossaryEntry> = {
  // ── Per-hop keys ──
  rho: {
    render: "math",
    category: "per-hop key",
    definition:
      "A hop's forward-encryption key: the ChaCha20 stream-cipher key that encrypts the `hop_payloads` buffer. One per hop, derived from that hop's shared secret.",
    formula: "rho_i = HMAC('rho', ss_i)",
    chapter: "6",
  },
  mu: {
    render: "math",
    category: "per-hop key",
    definition:
      "A hop's forward-authentication key: the HMAC key that produces the integrity tag over the buffer.",
    formula: "mu_i = HMAC('mu', ss_i)",
    chapter: "6",
  },
  um: {
    render: "math",
    category: "per-hop key",
    definition:
      "A hop's return-authentication key (it is `mu` spelled backwards). Authenticates error packets on the way back.",
    formula: "um_i = HMAC('um', ss_i)",
    chapter: "6",
  },
  ammag: {
    render: "math",
    category: "per-hop key",
    definition:
      "A hop's return-encryption key (it is `gamma` spelled backwards). The ChaCha20 key that obfuscates error packets on the return path.",
    formula: "ammag_i = HMAC('ammag', ss_i)",
    chapter: "6",
  },
  ammagext: {
    render: "math",
    category: "per-hop key",
    definition:
      "An optional fifth per-hop key for *attribution data* (added to BOLT 4 in 2025), which lets the sender pin down *which* hop failed on the return path. Derived just like the other four; this course scopes to the original four.",
    formula: "ammagext_i = HMAC('ammagext', ss_i)",
    chapter: "6",
  },
  gamma: {
    render: "text",
    category: "per-hop key",
    definition:
      "The original Sphinx name for the return-path encryption key. Lightning calls it `ammag` (gamma reversed) and derives it the same way; you will meet `gamma` in the Sphinx paper and older write-ups.",
    chapter: "6",
  },

  // ── Session / buffer key ──
  pad_key: {
    render: "code",
    category: "session key",
    definition:
      "The buffer-setup key. Alice derives it from her session key and uses it as a ChaCha20 key to fill the 1,300-byte payload area with pseudorandom noise before any hop payloads are written.",
    chapter: "6",
  },
  "session key": {
    render: "text",
    category: "session key",
    definition:
      "The single ephemeral keypair Alice generates for one payment. It seeds the ephemeral key chain (`E_AB`, `E_AC`, ...) and the `pad_key`.",
    chapter: "4",
  },
  pad: {
    render: "code",
    category: "session key",
    definition:
      "The KDF label for the buffer-setup key. The only one of the five labels used with Alice's session key instead of a hop's shared secret, so the resulting `pad_key` is unique to the payment, not to a hop.",
    formula: "pad_key = HMAC('pad', sessionkey)",
    chapter: "6",
  },

  // ── Shared secret + ephemeral key chain ──
  ss: {
    render: "math",
    category: "shared secret",
    definition:
      "The 32-byte ECDH shared secret between Alice and one hop. Every one of that hop's per-hop keys (`rho`, `mu`, `um`, `ammag`) derives from it.",
    formula: "ss_AB = SHA256(e_AB · B)",
    chapter: "4",
  },
  E: {
    render: "math",
    category: "ephemeral key",
    definition:
      "Alice's ephemeral *public* key for the ECDH with one hop (uppercase = public point). It advances down the route by a blinding factor at each step, so every hop sees a different key.",
    formula: "E_AB = e_AB · G",
    chapter: "4",
  },
  e: {
    render: "math",
    category: "ephemeral key",
    definition:
      "Alice's ephemeral *private* key for one hop (lowercase = private scalar; uppercase `E` is its public point). Advanced by a blinding factor at each hop.",
    formula: "e_AC = bf_AB · e_AB",
    chapter: "4",
  },
  bf: {
    render: "math",
    category: "ephemeral key",
    definition:
      "The blinding factor: the per-hop scalar that advances the ephemeral key chain so every hop sees a different ephemeral pubkey. Both Alice and the forwarder can compute it.",
    formula: "bf_AB = SHA256(E_AB ‖ ss_AB)",
    chapter: "4",
  },
  "blinding factor": {
    render: "text",
    category: "ephemeral key",
    definition:
      "The per-hop scalar `bf_AB` that advances the ephemeral key chain, so every hop sees a different ephemeral pubkey. Both Alice and the forwarder can compute it.",
    formula: "bf_AB = SHA256(E_AB ‖ ss_AB)",
    chapter: "4",
  },

  // ── Protocol fields ──
  next_hmac: {
    render: "code",
    category: "protocol field",
    definition:
      "*Not* this hop's own HMAC. It is the 32-byte tag of the layer *inside* this hop, which this hop's payload commits to. Each iteration's HMAC becomes the next iteration's `next_hmac`, forming the HMAC chain.",
    chapter: "5",
  },
  associated_data: {
    render: "code",
    category: "protocol field",
    definition:
      "The 32-byte `payment_hash`, concatenated with the buffer before the HMAC is computed. It binds the onion to one specific HTLC, so a captured onion cannot be re-attached to a different payment.",
    chapter: "8",
  },
  payment_hash: {
    render: "code",
    category: "protocol field",
    definition:
      "The hash of the payment preimage. It identifies the HTLC and serves as the onion's `associated_data`.",
    chapter: "1",
  },
  payment_secret: {
    render: "code",
    category: "protocol field",
    definition:
      "A per-invoice secret that binds every part of a payment to one invoice, which prevents probing and stray partial payments.",
    chapter: "3",
  },
  payment_data: {
    render: "code",
    category: "protocol field",
    definition:
      "The destination's TLV (`payment_secret` plus the total amount). It proves to the final hop that the payment is complete and bound to its invoice.",
    chapter: "10",
  },
  hop_payloads: {
    render: "code",
    category: "protocol field",
    definition:
      "The 1,300-byte routing-info area of the packet. It holds every hop's encrypted hop payload plus padding and filler, and stays the same size whatever the route length.",
    chapter: "7",
  },
  hop_size: {
    render: "code",
    category: "protocol field",
    definition:
      "How many bytes one hop occupies in the buffer: `len(payload) + 32` (the bigsize-prefixed TLV records plus the 32-byte HMAC field).",
    chapter: "8",
  },
  s: {
    render: "math",
    category: "protocol field",
    definition:
      "A hop's hop-payload size in bytes (`s_B` is Bob's, `s_C` is Charlie's). It sets how far the buffer shifts when that hop's payload is added or removed.",
    chapter: "7",
  },
  bigsize: {
    render: "code",
    category: "protocol field",
    definition:
      "BOLT 1's variable-length integer encoding, used here for the TLV-section length prefix. For lengths under 253 bytes it is a single byte.",
    chapter: "9",
  },
  TLV: {
    render: "text",
    category: "protocol field",
    definition:
      "Type-Length-Value records: the routing instructions inside a hop payload (`amt_to_forward`, `outgoing_cltv_value`, `short_channel_id`, or `payment_data` for the destination).",
    chapter: "5",
  },
  amt_to_forward: {
    render: "code",
    category: "protocol field",
    definition:
      "A routing TLV: how many millisatoshis this hop should forward to the next one.",
    chapter: "9",
  },
  outgoing_cltv_value: {
    render: "code",
    category: "protocol field",
    definition:
      "A routing TLV: the timelock this hop must set on its outgoing HTLC.",
    chapter: "9",
  },
  short_channel_id: {
    render: "code",
    category: "protocol field",
    definition:
      "Identifies the channel a forwarder should send the payment out on, encoded as block height, transaction index, and output index.",
    chapter: "2",
  },
  cltv_expiry_delta: {
    render: "code",
    category: "protocol field",
    definition:
      "The block-count safety margin a forwarder requires between the timelock on its incoming HTLC and the one on its outgoing HTLC.",
    chapter: "2",
  },
  total_msat: {
    render: "code",
    category: "protocol field",
    definition:
      "Part of the destination's `payment_data` TLV: the full amount the invoice expects, so the final hop knows when a (possibly multi-part) payment is complete.",
    chapter: "10",
  },
  min_final_cltv_expiry_delta: {
    render: "code",
    category: "protocol field",
    definition:
      "The invoice field setting how many blocks the *final* hop's HTLC must stay valid. Route timelocks are computed backward from this floor.",
    chapter: "2",
  },
  ephemeral_pubkey: {
    render: "code",
    category: "protocol field",
    definition:
      "The 33-byte public key in the packet header (the `E_AB` for Bob). Each hop performs ECDH against it to recover its shared secret, then blinds it forward for the next hop.",
    chapter: "9",
  },
  version: {
    render: "code",
    category: "protocol field",
    definition:
      "The packet's leading byte. The only currently valid value is `0x00`; any other value is rejected at the structure gate.",
    chapter: "7",
  },
  bigsize_LEN: {
    render: "code",
    category: "protocol field",
    definition:
      "The `bigsize` length prefix at the front of a hop payload. It says how many TLV bytes follow before the 32-byte HMAC.",
    chapter: "9",
  },
  LEN: {
    render: "code",
    category: "protocol field",
    definition:
      "The byte length of a hop payload's TLV section, carried at the front of the payload as the `bigsize_LEN` prefix.",
    chapter: "9",
  },
  payload: {
    render: "code",
    category: "protocol field",
    definition:
      "One hop's instructions: the `bigsize_LEN` prefix plus its TLV records (not the trailing HMAC). Distinct from `hop_payloads`, which is the whole 1,300-byte buffer.",
    chapter: "8",
  },
  payload_bytes: {
    render: "code",
    category: "protocol field",
    definition:
      "The decrypted bytes of this hop's `payload` that `peel_layer` returns, ready to parse into TLV records.",
    chapter: "10",
  },
  next_packet: {
    render: "code",
    category: "protocol field",
    definition:
      "The reassembled 1,366-byte onion a forwarder sends to the next hop: a fresh version byte, the blinded `ephemeral_pubkey`, the shifted `hop_payloads`, and the lifted `next_hmac`.",
    chapter: "9",
  },
  hmac: {
    render: "code",
    category: "protocol field",
    definition:
      "Shorthand for the packet's 32-byte authentication tag (`outer_hmac` on the wire). A hop recomputes it with `mu` and compares before trusting any bytes.",
    chapter: "9",
  },
  bob_privkey: {
    render: "code",
    category: "concept",
    definition:
      "Bob's long-lived node private key. He performs ECDH between it and the packet's `ephemeral_pubkey` to recover his shared secret with Alice.",
    chapter: "9",
  },
  update_add_htlc: {
    render: "code",
    category: "protocol field",
    definition:
      "The channel message that offers an HTLC to a peer. It carries the `payment_hash`, the amount, the `cltv_expiry`, and the 1,366-byte onion.",
    chapter: "9",
  },
  update_fulfill_htlc: {
    render: "code",
    category: "protocol field",
    definition:
      "The channel message that settles an HTLC successfully. It carries the `preimage`, which unlocks the funds hop by hop back along the route.",
    chapter: "11",
  },
  update_fail_htlc: {
    render: "code",
    category: "protocol field",
    definition:
      "The channel message that fails an HTLC. Its `reason` field carries the error onion, passed hop by hop back toward the sender, the mirror of `update_add_htlc` on the way out.",
    chapter: "11",
  },
  update_fail_malformed_htlc: {
    render: "code",
    category: "protocol field",
    definition:
      "A special failure message for an onion a hop couldn't decrypt. With no shared secret to build a return onion, the hop returns a bare `failure_code` (a `BADONION` code) plus the onion's hash; its upstream neighbor turns that into a normal `update_fail_htlc`.",
    chapter: "11",
  },
  reason: {
    render: "code",
    category: "protocol field",
    definition:
      "The field of `update_fail_htlc` that holds the error onion: an opaque, `ammag`-obfuscated blob only the sender can peel back to read the failure.",
    chapter: "11",
  },
  failure_code: {
    render: "code",
    category: "protocol field",
    definition:
      "The two-byte code that says why a payment failed. Its top byte is a set of flags (`BADONION`, `PERM`, `NODE`, `UPDATE`) that combine; the low byte names the specific failure.",
    chapter: "11",
  },
  channel_update: {
    render: "code",
    category: "protocol field",
    definition:
      "The gossip message a node broadcasts to advertise a channel's forwarding policy: its base fee, fee rate, and `cltv_expiry_delta`.",
    chapter: "2",
  },
  channel_announcement: {
    render: "code",
    category: "protocol field",
    definition:
      "The gossip message that announces a new channel to the whole network. It carries the `short_channel_id` plus both owners' node and bitcoin keys and signatures, proving the two nodes really control the on-chain funding output.",
    chapter: "2",
  },
  chain_hash: {
    render: "code",
    category: "protocol field",
    definition:
      "A 32-byte hash identifying which chain a channel lives on (for example, Bitcoin mainnet versus testnet), so gossip from one network can't be mistaken for another.",
    chapter: "2",
  },
  timestamp: {
    render: "code",
    category: "protocol field",
    definition:
      "When a `channel_update` was issued. Peers keep only the newest update per channel direction, so a higher timestamp wins.",
    chapter: "2",
  },
  channel_flags: {
    render: "code",
    category: "protocol field",
    definition:
      "A bitfield on a `channel_update`: bit 0 says which side of the channel is publishing (node 1 or node 2), and bit 1 is the disable flag that marks the channel temporarily unusable.",
    chapter: "2",
  },
  htlc_minimum_msat: {
    render: "code",
    category: "protocol field",
    definition:
      "The smallest HTLC (in millisatoshis) a forwarder will relay over this channel. Offer less and it won't forward.",
    chapter: "2",
  },
  htlc_maximum_msat: {
    render: "code",
    category: "protocol field",
    definition:
      "The largest single HTLC (in millisatoshis) a forwarder will relay over this channel, bounded by its capacity and its own limit.",
    chapter: "2",
  },
  base_fee: {
    render: "code",
    category: "protocol field",
    definition:
      "Shorthand for `fee_base_msat`: the flat per-HTLC fee a forwarder charges, advertised in its `channel_update`.",
    chapter: "2",
  },
  ppm: {
    render: "code",
    category: "protocol field",
    definition:
      "Shorthand for `fee_proportional_millionths`: the rate fee, in millionths of the forwarded amount.",
    chapter: "2",
  },
  fee_rate: {
    render: "code",
    category: "protocol field",
    definition:
      "Shorthand for `fee_proportional_millionths`: the rate fee, in millionths of the forwarded amount.",
    chapter: "2",
  },
  ROUTING_INFO_SIZE: {
    render: "code",
    category: "protocol field",
    definition:
      "The size of the `hop_payloads` field: 1,300 bytes. Every onion packet carries exactly this many bytes of routing info, whatever the route length.",
    chapter: "7",
  },
  hop_hmac: {
    render: "code",
    category: "protocol field",
    definition:
      "One hop's HMAC tag, computed over that hop's encrypted layer. It is carried up to the next outer layer as its `next_hmac`.",
    chapter: "8",
  },
  outer_hmac: {
    render: "code",
    category: "protocol field",
    definition:
      "The packet's trailing 32-byte tag: `HMAC(mu, hop_payloads ‖ associated_data)` for the current hop. It is the first thing a forwarder verifies, before any decryption.",
    chapter: "9",
  },
  failure_len: {
    render: "code",
    category: "protocol field",
    definition:
      "The 2-byte length prefix inside an error payload: how many bytes of real `failure_message` follow. Always read it from the packet rather than assuming a size.",
    chapter: "11",
  },
  failure_message: {
    render: "code",
    category: "protocol field",
    definition:
      "The plaintext failure content carried inside the error onion: a 2-byte `failure_code` plus any data specific to that code (for example, a `channel_update` for an `UPDATE` failure, or the onion's hash for a `BADONION` one). Many codes carry no extra data at all.",
    chapter: "11",
  },
  pad_len: {
    render: "code",
    category: "protocol field",
    definition:
      "The 2-byte length of the zero padding after the `failure_message`, sized so error payloads don't leak which failure they carry.",
    chapter: "11",
  },
  fee_base_msat: {
    render: "code",
    category: "protocol field",
    definition:
      "The flat part of a forwarder's fee: a fixed number of millisatoshis charged per forwarded HTLC, advertised in its `channel_update`.",
    chapter: "2",
  },
  fee_proportional_millionths: {
    render: "code",
    category: "protocol field",
    definition:
      "The rate part of a forwarder's fee: this many millionths of the forwarded amount, advertised in its `channel_update`.",
    chapter: "2",
  },
  temporary_channel_failure: {
    render: "code",
    category: "protocol field",
    definition:
      "A failure code a forwarder returns when it cannot forward right now (for example, not enough outbound balance). The sender can retry another route.",
    chapter: "10",
  },
  invalid_onion_hmac: {
    render: "code",
    category: "protocol field",
    definition:
      "A failure code a forwarder returns when the onion's HMAC does not verify (the bytes were tampered with, or the onion was re-attached to a different HTLC). It is a BADONION + PERM code: a corrupted onion can't be wrapped in a normal error onion, so it comes back as an `update_fail_malformed_htlc`, which the upstream neighbor turns into a normal failure for the rest of the trip.",
    chapter: "7",
  },
  invalid_onion_version: {
    render: "code",
    category: "protocol field",
    definition:
      "A `BADONION` failure (`BADONION` + `PERM`): the onion's version byte wasn't `0x00`. Reported via `update_fail_malformed_htlc`.",
    chapter: "11",
  },
  invalid_onion_key: {
    render: "code",
    category: "protocol field",
    definition:
      "A `BADONION` failure (`BADONION` + `PERM`): the onion's ephemeral public key was unusable, so the hop couldn't perform ECDH. Reported via `update_fail_malformed_htlc`.",
    chapter: "11",
  },
  temporary_node_failure: {
    render: "code",
    category: "protocol field",
    definition:
      "A `NODE` failure: the node can't forward right now, but the problem is transient, so the sender may try it again later.",
    chapter: "11",
  },
  permanent_node_failure: {
    render: "code",
    category: "protocol field",
    definition:
      "A `PERM` + `NODE` failure: the node is permanently unable to forward, not just on this channel. The sender should drop the whole node from its route map.",
    chapter: "11",
  },
  permanent_channel_failure: {
    render: "code",
    category: "protocol field",
    definition:
      "A `PERM` failure: this channel can no longer forward (for example, it is closing). The sender should stop routing through it.",
    chapter: "11",
  },
  unknown_next_peer: {
    render: "code",
    category: "protocol field",
    definition:
      "A `PERM` failure a forwarder returns when it has no channel to the next hop the onion names (a stale route). The sender should pick a different path.",
    chapter: "11",
  },
  fee_insufficient: {
    render: "code",
    category: "protocol field",
    definition:
      "Returned by a forwarder when the fee paid (incoming amount minus outgoing amount) is below what its `channel_update` advertises; the HTLC is failed back.",
    chapter: "10",
  },
  incorrect_cltv_expiry: {
    render: "code",
    category: "protocol field",
    definition:
      "Returned by a forwarder when the outgoing `cltv_expiry` does not satisfy its required `cltv_expiry_delta` cushion; the HTLC is failed back.",
    chapter: "10",
  },
  amount_below_minimum: {
    render: "code",
    category: "protocol field",
    definition:
      "A failure code a forwarder returns when `amt_to_forward` is below the outgoing channel's `htlc_minimum_msat`; the HTLC is failed back.",
    chapter: "10",
  },
  expiry_too_soon: {
    render: "code",
    category: "protocol field",
    definition:
      "A failure code a forwarder returns when the outgoing timelock is too close to the current block height to forward safely; the HTLC is failed back.",
    chapter: "10",
  },
  expiry_too_far: {
    render: "code",
    category: "protocol field",
    definition:
      "A failure code a forwarder MAY return when the requested timelock reaches unreasonably far into the future (more than `max_htlc_cltv` out); the HTLC is failed back.",
    chapter: "10",
  },
  incorrect_or_unknown_payment_details: {
    render: "code",
    category: "protocol field",
    definition:
      "The failure code the *destination* returns when the `payment_hash`, `payment_secret`, or amount does not match a payment it expects. Deliberately vague, so a prober cannot tell which detail was wrong.",
    chapter: "10",
  },
  max_htlc_cltv: {
    render: "code",
    category: "concept",
    definition:
      "BOLT 4's cap on how far out an HTLC's total timelock may reach, fixed at 2,016 blocks (about two weeks). A CLTV beyond it draws an `expiry_too_far` failure.",
    chapter: "10",
  },
  UPDATE: {
    render: "text",
    category: "concept",
    definition:
      "A failure-code flag (`0x1000`): a channel *forwarding parameter* (the amount, fee, or timelock) was violated. The error may carry an optional `channel_update`, though nodes no longer apply that automatically.",
    chapter: "10",
  },
  BADONION: {
    render: "text",
    category: "concept",
    definition:
      "A failure-code flag (`0x8000`): the onion itself was unreadable, so the hop couldn't process it. With no shared secret to build a return onion, these come back as `update_fail_malformed_htlc`. Every `BADONION` code also sets `PERM`.",
    chapter: "11",
  },
  PERM: {
    render: "text",
    category: "concept",
    definition:
      "A failure-code flag (`0x4000`): a *permanent* failure. The sender should stop retrying this hop rather than treat it as a transient hiccup.",
    chapter: "11",
  },
  NODE: {
    render: "text",
    category: "concept",
    definition:
      "A failure-code flag (`0x2000`): the whole *node* is the problem, not one specific channel. The sender should set aside all of that node's channels, not just the one the payment used.",
    chapter: "11",
  },

  // ── Concepts ──
  HTLC: {
    render: "text",
    category: "concept",
    definition:
      "Hash Time-Locked Contract: the conditional payment Lightning routes hop by hop. It settles when the preimage of its `payment_hash` is revealed.",
    chapter: "1",
  },
  preimage: {
    render: "text",
    category: "concept",
    definition:
      "The secret whose SHA256 hash is the `payment_hash`. Revealing it claims the HTLC, and it propagates back along the route to settle each hop.",
    chapter: "1",
  },
  to_local: {
    render: "code",
    category: "concept",
    definition:
      "A channel's balance output that pays its own owner. When a routed payment settles, sats shift from the payer's `to_local` toward the payee's along each hop.",
    chapter: "1",
  },
  OnionPacketBuilder: {
    render: "code",
    category: "concept",
    definition:
      "The class on Alice's (the sender's) side that assembles the onion: derive the shared secrets, build the filler, then wrap each hop's payload inside-out into the 1,366-byte packet.",
    chapter: "4",
  },
  wrapped: {
    render: "code",
    category: "concept",
    definition:
      "The obfuscated error packet on the return path. Each hop XORs it with its `ammag` keystream; the sender peels those layers off to read the failure.",
    chapter: "11",
  },
  filler: {
    render: "text",
    category: "concept",
    definition:
      "Bytes Alice precomputes in chapter 7 so that, after each forwarder peels its layer and shifts the buffer, the trailing positions land exactly on what every downstream HMAC was computed over. Placed once, on the innermost iteration.",
    chapter: "7",
  },
  Sphinx: {
    render: "text",
    category: "concept",
    definition:
      "The onion-routing construction Lightning uses. It fixes every packet at 1,366 bytes and derives distinct named keys per hop, closing the route-length leak and Alice's key-management burden.",
    chapter: "5",
  },
  keystream: {
    render: "text",
    category: "concept",
    definition:
      "The pseudorandom byte stream a stream cipher (ChaCha20) produces from a key. XOR data with it to encrypt, and XOR again with the same keystream to decrypt.",
    chapter: "5",
  },
  CLTV: {
    render: "text",
    category: "concept",
    definition:
      "CheckLockTimeVerify: an absolute block-height timelock on an HTLC. A hop is only safe to forward if its incoming timelock clears its outgoing one by `cltv_expiry_delta`.",
    chapter: "2",
  },
  "error onion": {
    render: "text",
    category: "concept",
    definition:
      "The encrypted packet a failing hop builds and sends *backward* to the sender, obfuscated with `ammag` at each return hop. The mirror image of the forward onion.",
    chapter: "11",
  },

  // ── The functions you build (exercise functions; popover shows the def
  //    line + contract so a prose mention is always one hover from its shape) ──
  derive_shared_secrets: {
    render: "code",
    category: "your function",
    signature: "def derive_shared_secrets(self):",
    definition:
      "Your `OnionPacketBuilder` method. Walks the blinding chain from the session key: for each hop it computes the ephemeral pubkey and the ECDH shared secret, then advances the key by the blinding factor. Populates `self.shared_secrets` and `self.ephemeral_pubkeys`, one entry per hop in route order.",
    chapter: "4",
  },
  derive_keys: {
    render: "code",
    category: "your function",
    signature: "def derive_keys(shared_secret):",
    definition:
      "Your standalone KDF. Takes one 32-byte secret and returns a `KeyMaterial` bundle with one key per label (`rho`, `mu`, `um`, `ammag`, `pad`), each computed as `HMAC-SHA256(label, secret)`.",
    chapter: "6",
  },
  generate_filler: {
    render: "code",
    category: "your function",
    signature: "def generate_filler(self, rho_keys, payload_sizes):",
    definition:
      "Your `OnionPacketBuilder` method. Precomputes the filler: for each forwarder it extends the filler with zeros and XORs in the tail of that hop's `rho` keystream, reproducing the bytes every downstream HMAC will be computed over. Returns the filler bytes that get overlaid on the innermost wrap.",
    chapter: "7",
  },
  wrap_hop: {
    render: "code",
    category: "your function",
    signature:
      "def wrap_hop(self, buffer, payload, next_hmac, rho, mu, associated_data):",
    definition:
      "Your `OnionPacketBuilder` method: one iteration of the build loop. Right-shifts the buffer, writes `payload ‖ next_hmac` at the front, XORs the whole buffer with the `rho` keystream, then computes this hop's HMAC with `mu` over the buffer plus `associated_data`. Returns `(encrypted, tag)`.",
    chapter: "8",
  },
  build: {
    render: "code",
    category: "your function",
    signature: "def build(self, payloads, associated_data):",
    definition:
      "Your `OnionPacketBuilder` method: the full builder. Derives the shared secrets, precomputes the filler, runs `wrap_hop` for every hop in reverse order (overlaying the filler on the innermost pass), then assembles version ‖ ephemeral pubkey ‖ `hop_payloads` ‖ HMAC. Returns the finished 1,366-byte packet.",
    chapter: "8",
  },
  peel_layer: {
    render: "code",
    category: "your function",
    signature: "def peel_layer(self, packet, node_privkey):",
    definition:
      "Your `OnionForwarder` method: the full peel. ECDH against the packet's ephemeral pubkey, extend-and-XOR with `rho`, lift the next 1,300 bytes, advance the ephemeral. (`verify_hmac` handles HMAC verification.) Returns `(next_packet, payload_bytes, shared_secret)`.",
    chapter: "9",
  },
  verify_hmac: {
    render: "code",
    category: "your function",
    signature: "def verify_hmac(packet, mu, associated_data):",
    definition:
      "Your integrity check. Recomputes HMAC-SHA256 over the packet's `hop_payloads ‖ associated_data` with the `mu` key and compares it to the packet's `hmac` field. Returns `True` on a match, `False` otherwise.",
    chapter: "10",
  },
  check_forward: {
    render: "code",
    category: "your function",
    signature:
      "def check_forward(incoming_amount_msat, incoming_cltv_expiry, amt_to_forward, outgoing_cltv_value, policy):",
    definition:
      "Your policy check. Confirms the incoming HTLC covers `amt_to_forward` plus the fee advertised in `policy`, and that the incoming CLTV clears `outgoing_cltv_value` by at least the policy's delta. Returns a BOLT 4 failure-code string, or `None` when it is safe to forward.",
    chapter: "10",
  },
  decrypt_error_onion: {
    render: "code",
    category: "your function",
    signature: "def decrypt_error_onion(wrapped_error, hop_keys):",
    definition:
      "Your error decoder: Alice's trial decrypt. Tries each hop in order: XORs off its `ammag` keystream and checks the `um` HMAC after each pass. Returns `(failing_hop_index, failure_message)` when a layer verifies, or `(None, None)` if nothing matches.",
    chapter: "11",
  },

  // ── Operations ──
  HMAC: {
    render: "text",
    category: "operation",
    definition:
      "Hash-based Message Authentication Code: combines a secret key with the message bytes to produce a fixed-size tag that only a holder of the key can generate or verify.",
    chapter: "5",
  },
  ECDH: {
    render: "text",
    category: "operation",
    definition:
      "Elliptic-Curve Diffie-Hellman: Alice and a hop each combine their own private key with the other's public key and land on the *same* shared secret, because scalar multiplication commutes.",
    chapter: "4",
  },
  ChaCha20: {
    render: "text",
    category: "operation",
    definition:
      "The stream cipher Lightning uses. It turns a key (like `rho` or `pad_key`) into a long keystream that gets XORed with the buffer.",
    chapter: "5",
  },
  XOR: {
    render: "text",
    category: "operation",
    definition:
      "Bitwise exclusive-or. XOR-ing data with a keystream encrypts it; XOR-ing the result with the same keystream recovers the original, because the keystream cancels itself.",
    chapter: "5",
  },
};

/** Bases that take a subscript, so `rho_B` / `ss_AD` / `E_AC` / `bf_AB` / `s_B` resolve to one entry. */
const FAMILY = new Set(["rho", "mu", "um", "ammag", "ss", "E", "e", "bf", "s"]);

// ── Subscript specialization ────────────────────────────────────────────────
// A subscripted token names specific parties: `ss_AB` is THE shared secret
// between Alice and Bob, `rho_C` is Charlie's forward-encryption key. When the
// suffix names a concrete hop (B/C/D, AB/AC/AD, or a spelled-out bob/charlie/
// dave), the popover shows a definition and formula for that exact hop instead
// of the generic family text. Unknown suffixes (`mu_i`, `ss_AX`, ...) keep the
// generic entry.

type HopLetter = "B" | "C" | "D";
const HOP_NAME: Record<HopLetter, string> = { B: "Bob", C: "Charlie", D: "Dave" };
/** The hop after this one on the fixed route (for chain-advance formulas). */
const NEXT_HOP: Partial<Record<HopLetter, HopLetter>> = { B: "C", C: "D" };
/** The hop before this one (whose blinding factor produced this hop's key). */
const PREV_HOP: Partial<Record<HopLetter, HopLetter>> = { C: "B", D: "C" };

/** Map a subscript to the hop it names, or null when it is generic (i, X, ...). */
function hopFromSuffix(suffix: string): HopLetter | null {
  const s = suffix.toLowerCase();
  if (s === "bob") return "B";
  if (s === "charlie") return "C";
  if (s === "dave") return "D";
  if (/^[bcd]$/.test(s)) return s.toUpperCase() as HopLetter;
  if (/^a[bcd]$/.test(s)) return s[1].toUpperCase() as HopLetter;
  return null;
}

const SPECIALIZE: Record<
  string,
  (h: HopLetter) => Partial<GlossaryEntry> | null
> = {
  ss: (h) => ({
    definition: `The 32-byte ECDH shared secret between Alice and ${HOP_NAME[h]}. Every one of ${HOP_NAME[h]}'s per-hop keys (\`rho\`, \`mu\`, \`um\`, \`ammag\`) derives from it.`,
    formula: `ss_A${h} = SHA256(e_A${h} · ${h})`,
  }),
  rho: (h) => ({
    definition: `${HOP_NAME[h]}'s forward-encryption key: the ChaCha20 stream-cipher key that encrypts ${HOP_NAME[h]}'s layer of the \`hop_payloads\` buffer. Derived from his shared secret with Alice.`,
    formula: `rho_${h} = HMAC('rho', ss_A${h})`,
  }),
  mu: (h) => ({
    definition: `${HOP_NAME[h]}'s forward-authentication key: the HMAC key behind the integrity tag ${HOP_NAME[h]} verifies over the buffer.`,
    formula: `mu_${h} = HMAC('mu', ss_A${h})`,
  }),
  um: (h) => ({
    definition: `${HOP_NAME[h]}'s return-authentication key (it is \`mu\` spelled backwards). If ${HOP_NAME[h]} fails the payment, this key authenticates the error packet he builds.`,
    formula: `um_${h} = HMAC('um', ss_A${h})`,
  }),
  ammag: (h) => ({
    definition: `${HOP_NAME[h]}'s return-encryption key (it is \`gamma\` spelled backwards). The ChaCha20 key ${HOP_NAME[h]} uses to wrap error packets on the return path.`,
    formula: `ammag_${h} = HMAC('ammag', ss_A${h})`,
  }),
  E: (h) => {
    const prev = PREV_HOP[h];
    return {
      definition:
        `Alice's ephemeral *public* key for the ECDH with ${HOP_NAME[h]} (uppercase = public point). ` +
        (prev
          ? `${HOP_NAME[prev]} derives it from \`E_A${prev}\` with his blinding factor before forwarding, landing on the same value Alice precomputed.`
          : `It is the one key that ships in the packet header; every later hop's key is derived from it.`),
      formula: prev ? `E_A${h} = bf_A${prev} · E_A${prev}` : `E_A${h} = e_A${h} · G`,
    };
  },
  e: (h) => {
    const prev = PREV_HOP[h];
    return {
      definition:
        `Alice's ephemeral *private* key for ${HOP_NAME[h]} (lowercase = private scalar; uppercase \`E\` is its public point). ` +
        (prev
          ? `Advanced from \`e_A${prev}\` by the blinding factor.`
          : `For the first hop, it is simply the session key.`),
      formula: prev ? `e_A${h} = bf_A${prev} · e_A${prev}` : `e_A${h} = sessionkey`,
    };
  },
  bf: (h) => {
    const next = NEXT_HOP[h];
    if (!next) return null; // the final hop has no blinding factor
    return {
      definition: `The blinding factor that advances the ephemeral key chain past ${HOP_NAME[h]}, taking \`E_A${h}\` to \`E_A${next}\`. Alice precomputes it and ${HOP_NAME[h]} re-derives it, so both land on the same next key.`,
      formula: `bf_A${h} = SHA256(E_A${h} ‖ ss_A${h})`,
    };
  },
  s: (h) => ({
    definition: `${HOP_NAME[h]}'s hop-payload size in bytes. It sets how far the buffer shifts when ${HOP_NAME[h]}'s payload is added or removed.`,
  }),
};

/** Specialized text for bob_hmac / charlie_hmac / dave_hmac. */
function specializeHopHmac(h: HopLetter): Partial<GlossaryEntry> {
  const prev = PREV_HOP[h];
  return {
    definition:
      `${HOP_NAME[h]}'s HMAC tag, computed over ${HOP_NAME[h]}'s encrypted layer. ` +
      (prev
        ? `Alice tucks it inside ${HOP_NAME[prev]}'s hop payload, and ${HOP_NAME[prev]} lifts it to the packet's outer tag when he forwards.`
        : `It rides as the outer tag on the 1,366-byte packet Alice ships, the first thing ${HOP_NAME[h]} verifies.`),
  };
}

export interface GlossaryHit {
  /** The raw token as hovered (e.g. `rho_B`, `pad_key`). */
  term: string;
  entry: GlossaryEntry;
}

/** Resolve a raw token to a glossary entry, or null if it is not a glossary term. */
export function resolveGlossary(raw: string): GlossaryHit | null {
  const t = (raw ?? "").trim();
  if (!t) return null;

  const exact = ENTRIES[t];
  if (exact) return { term: t, entry: exact };

  // Plural of a multi-word base term: "blinding factors" -> "blinding factor".
  // Only multi-word entries (those with a space) take this path, so single-token
  // identifiers like `hop_payloads` are unaffected (they already match exactly).
  if (t.endsWith("s") && t.includes(" ")) {
    const singular = ENTRIES[t.slice(0, -1)];
    if (singular) return { term: t, entry: singular };
  }

  // Subscripted family: base_SUFFIX  (rho_B, ss_AD, E_AC, mu_i, bf_AB, s_B, ...)
  const m = t.match(/^([A-Za-z]+)_[A-Za-z0-9]+$/);
  if (m && FAMILY.has(m[1]) && ENTRIES[m[1]]) {
    const base = ENTRIES[m[1]];
    const hop = hopFromSuffix(t.slice(m[1].length + 1));
    const special = hop ? SPECIALIZE[m[1]]?.(hop) : null;
    return { term: t, entry: special ? { ...base, ...special } : base };
  }

  // Per-hop HMAC values: bob_hmac / charlie_hmac / dave_hmac
  const hm = t.match(/^(bob|charlie|dave)_hmac$/);
  if (hm) {
    const hop = hopFromSuffix(hm[1])!;
    return { term: t, entry: { ...ENTRIES.hop_hmac, ...specializeHopHmac(hop) } };
  }

  return null;
}

export const GLOSSARY_CATEGORY_COLOR: Record<GlossaryCategory, string> = {
  "per-hop key": "#b8860b",
  "session key": "#b8860b",
  "shared secret": "#7b4b8a",
  "ephemeral key": "#3b6aa0",
  "protocol field": "#475569",
  concept: "#2d7a7a",
  operation: "#5a7a2f",
  "your function": "#a05a2c",
};
