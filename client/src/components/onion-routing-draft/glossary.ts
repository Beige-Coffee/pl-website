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
  | "operation";

export interface GlossaryEntry {
  /** How the term renders in the popover header: math (subscripts) / code (mono) / text. */
  render: "math" | "code" | "text";
  category: GlossaryCategory;
  /** 1-2 sentence definition. Backtick code/vars and use *italics*; rendered via renderCaption. */
  definition: string;
  /** Optional derivation, rendered as math. Mostly the key / secret / ephemeral families. */
  formula?: string;
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
      "The per-hop scalar `bf_AB` that advances the ephemeral key chain, so every hop sees a different ephemeral pubkey. (In chapter 14 the same idea is reused on node identities for *blinded paths*.)",
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
  update_add_htlc: {
    render: "code",
    category: "protocol field",
    definition:
      "The channel message that offers an HTLC to a peer. It carries the `payment_hash`, the amount, the `cltv_expiry`, and the 1,366-byte onion.",
    chapter: "9",
  },
  channel_update: {
    render: "code",
    category: "protocol field",
    definition:
      "The gossip message a node broadcasts to advertise a channel's forwarding policy: its base fee, fee rate, and `cltv_expiry_delta`.",
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
      "A failure code a forwarder returns when the onion's HMAC does not verify, meaning the bytes were tampered with or the onion was re-attached to a different HTLC.",
    chapter: "7",
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

  // Subscripted family: base_SUFFIX  (rho_B, ss_AD, E_AC, mu_i, bf_AB, s_B, ...)
  const m = t.match(/^([A-Za-z]+)_[A-Za-z0-9]+$/);
  if (m && FAMILY.has(m[1]) && ENTRIES[m[1]]) {
    return { term: t, entry: ENTRIES[m[1]] };
  }

  // Per-hop HMAC values: bob_hmac / charlie_hmac / dave_hmac
  if (/^(?:bob|charlie|dave)_hmac$/.test(t)) {
    return { term: t, entry: ENTRIES.hop_hmac };
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
};
