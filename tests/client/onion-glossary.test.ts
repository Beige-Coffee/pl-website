import { describe, expect, it } from "vitest";
import { resolveGlossary } from "../../client/src/components/onion-routing-draft/glossary";

// Layer-1 guard for the hover-glossary resolver: subscripted tokens name
// SPECIFIC parties (ss_AB is Alice and Bob's shared secret, rho_C is
// Charlie's key), so their popovers must say so. Generic subscripts
// (mu_i, ss_AX) keep the family definition.

const def = (t: string) => resolveGlossary(t)?.entry.definition ?? "";
const formula = (t: string) => resolveGlossary(t)?.entry.formula ?? "";

describe("glossary subscript specialization", () => {
  it("ss_AB names Alice and Bob specifically", () => {
    expect(def("ss_AB")).toContain("between Alice and Bob");
    expect(formula("ss_AB")).toBe("ss_AB = SHA256(e_AB · B)");
  });

  it("ss_AC / ss_AD name Charlie and Dave", () => {
    expect(def("ss_AC")).toContain("between Alice and Charlie");
    expect(formula("ss_AC")).toBe("ss_AC = SHA256(e_AC · C)");
    expect(def("ss_AD")).toContain("between Alice and Dave");
    expect(formula("ss_AD")).toBe("ss_AD = SHA256(e_AD · D)");
  });

  it("per-hop keys name their hop (rho_B, mu_C, um_charlie, ammag_D)", () => {
    expect(def("rho_B")).toMatch(/^Bob's forward-encryption key/);
    expect(formula("rho_B")).toBe("rho_B = HMAC('rho', ss_AB)");
    expect(def("mu_C")).toMatch(/^Charlie's forward-authentication key/);
    expect(def("um_charlie")).toMatch(/^Charlie's return-authentication key/);
    expect(formula("um_charlie")).toBe("um_C = HMAC('um', ss_AC)");
    expect(def("ammag_D")).toMatch(/^Dave's return-encryption key/);
  });

  it("ephemeral chain entries show per-hop derivations", () => {
    expect(formula("E_AB")).toBe("E_AB = e_AB · G");
    expect(formula("E_AC")).toBe("E_AC = bf_AB · E_AB");
    expect(def("E_AC")).toContain("Bob derives it from `E_AB`");
    expect(formula("e_AB")).toBe("e_AB = sessionkey");
    expect(formula("e_AD")).toBe("e_AD = bf_AC · e_AC");
    expect(def("bf_AB")).toContain("taking `E_AB` to `E_AC`");
  });

  it("bf for the final hop falls back to the generic entry (Dave has none)", () => {
    expect(def("bf_AD")).toContain("advances the ephemeral key chain");
    expect(def("bf_AD")).not.toContain("taking `E_AD`");
  });

  it("s_B / s_C name the hop's payload size", () => {
    expect(def("s_B")).toMatch(/^Bob's hop-payload size/);
    expect(def("s_C")).toMatch(/^Charlie's hop-payload size/);
  });

  it("hop HMACs say where each tag lives", () => {
    expect(def("bob_hmac")).toContain("outer tag on the 1,366-byte packet Alice ships");
    expect(def("charlie_hmac")).toContain("inside Bob's hop payload");
    expect(def("dave_hmac")).toContain("inside Charlie's hop payload");
  });

  it("generic subscripts keep the family definition", () => {
    expect(def("mu_i")).toContain("A hop's forward-authentication key");
    expect(def("ss_AX")).toContain("between Alice and one hop");
    expect(def("rho_i")).toContain("A hop's forward-encryption key");
  });

  it("error-payload, fee, and packet-field terms resolve", () => {
    expect(def("failure_len")).toContain("2-byte length prefix");
    expect(def("failure_message")).toContain("2-byte failure code");
    expect(def("pad_len")).toContain("zero padding");
    expect(def("outer_hmac")).toContain("trailing 32-byte tag");
    expect(def("fee_base_msat")).toContain("flat part");
    expect(def("fee_proportional_millionths")).toContain("millionths");
    expect(def("pad")).toContain("KDF label");
    expect(formula("pad")).toBe("pad_key = HMAC('pad', sessionkey)");
  });

  it("exercise functions resolve with signatures", () => {
    const sig = (t: string) => resolveGlossary(t)?.entry.signature ?? "";
    expect(sig("wrap_hop")).toBe(
      "def wrap_hop(self, buffer, payload, next_hmac, rho, mu, associated_data):",
    );
    expect(def("wrap_hop")).toContain("Returns `(encrypted, tag)`");
    expect(sig("build")).toBe("def build(self, payloads, associated_data):");
    expect(def("build")).toContain("1,366-byte packet");
    expect(def("peel_layer")).toContain("(next_packet, payload_bytes, shared_secret)");
    expect(def("check_forward")).toContain("failure-code string");
    expect(def("decrypt_error_onion")).toContain("(failing_hop_index, failure_message)");
    for (const t of ["derive_shared_secrets", "derive_keys", "generate_filler", "verify_hmac"]) {
      expect(resolveGlossary(t)?.entry.category).toBe("your function");
    }
  });

  it("gossip-message fields resolve", () => {
    expect(def("channel_announcement")).toContain("announces a new channel");
    expect(def("chain_hash")).toContain("which chain");
    expect(def("timestamp")).toContain("newest update");
    expect(def("channel_flags")).toContain("disable flag");
    expect(def("htlc_minimum_msat")).toContain("smallest HTLC");
    expect(def("htlc_maximum_msat")).toContain("largest single HTLC");
    expect(def("base_fee")).toContain("fee_base_msat");
    expect(def("ppm")).toContain("fee_proportional_millionths");
    expect(def("fee_rate")).toContain("fee_proportional_millionths");
  });

  it("specialized definitions never use em dashes", () => {
    for (const t of ["ss_AB", "ss_AC", "rho_B", "mu_C", "um_D", "ammag_B", "E_AC", "e_AD", "bf_AB", "s_B", "bob_hmac", "charlie_hmac", "dave_hmac", "failure_len", "failure_message", "pad_len", "outer_hmac", "fee_base_msat", "fee_proportional_millionths", "pad"]) {
      expect(def(t)).not.toContain("—");
    }
  });
});
