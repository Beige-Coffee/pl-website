import { describe, expect, it, vi } from "vitest";

import { TX_GENERATORS } from "../../client/src/data/tx-generators.ts";

describe("Signed Lightning transaction generators", () => {
  it("use deterministic low-S DER signatures in their embedded Python", () => {
    for (const id of ["gen-commitment", "gen-htlc-commitment", "gen-htlc-timeout"] as const) {
      const pythonCode = TX_GENERATORS[id].pythonCode || "";
      expect(pythonCode).toContain("sign_digest_deterministic(");
      expect(pythonCode).toContain("sigencode_der_canonize");
      expect(pythonCode).not.toContain("sign_digest(sighash, sigencode=sigencode_der)");
    }
  });
});

describe("Funding transaction generator", () => {
  it("builds a native P2WSH funding tx from an explicit wallet UTXO", async () => {
    const generator = TX_GENERATORS["gen-funding"];
    const nodeRpc = vi.fn(async (method: string, params: unknown[]) => {
      switch (method) {
        case "createmultisig":
          expect(params).toEqual([
            2,
            ["02alicefundingpub", "03bobfundingpub"],
            "bech32",
          ]);
          return {
            result: {
              address: "bcrt1qfundingoutput",
            },
          };
        case "listunspent":
          return {
            result: [
              { txid: "large-utxo", vout: 1, amount: 1.25, spendable: true, safe: true },
              { txid: "selected-utxo", vout: 0, amount: 0.051, spendable: true, safe: true },
            ],
          };
        case "getrawchangeaddress":
          expect(params).toEqual(["bech32"]);
          return { result: "bcrt1qchangeoutput" };
        case "createrawtransaction":
          expect(params).toEqual([
            [{ txid: "selected-utxo", vout: 0 }],
            [
              { bcrt1qfundingoutput: 0.05 },
              { bcrt1qchangeoutput: 0.0009975 },
            ],
          ]);
          return { result: "unsigned-funding-hex" };
        case "signrawtransactionwithwallet":
          expect(params).toEqual(["unsigned-funding-hex"]);
          return {
            result: {
              complete: true,
              hex: "signed-funding-hex",
            },
          };
        case "decoderawtransaction":
          expect(params).toEqual(["signed-funding-hex"]);
          return {
            result: {
              txid: "funding-txid",
            },
          };
        default:
          throw new Error(`Unexpected RPC method: ${method}`);
      }
    });

    const runPython = vi.fn().mockResolvedValue({
      output: [
        "ALICE_FUNDING_PUB: 02alicefundingpub",
        "BOB_FUNDING_PUB: 03bobfundingpub",
      ].join("\n"),
      error: null,
    });

    const result = await generator.execute!({
      inputs: {},
      nodeRpc,
      runPython,
    });

    expect(result).toEqual({
      TXID: "funding-txid",
      HEX: "signed-funding-hex",
    });
    expect(nodeRpc.mock.calls.map(([method]) => method)).toEqual([
      "createmultisig",
      "listunspent",
      "getrawchangeaddress",
      "createrawtransaction",
      "signrawtransactionwithwallet",
      "decoderawtransaction",
    ]);
    expect(nodeRpc.mock.calls.some(([method]) => method === "fundrawtransaction")).toBe(false);
  });

  it("surfaces a useful error when no spendable UTXO can fund the channel output", async () => {
    const generator = TX_GENERATORS["gen-funding"];
    const nodeRpc = vi.fn(async (method: string) => {
      switch (method) {
        case "createmultisig":
          return { result: { address: "bcrt1qfundingoutput" } };
        case "listunspent":
          return { result: [{ txid: "tiny", vout: 0, amount: 0.01, spendable: true, safe: true }] };
        default:
          throw new Error(`Unexpected RPC method: ${method}`);
      }
    });

    const runPython = vi.fn().mockResolvedValue({
      output: [
        "ALICE_FUNDING_PUB: 02alicefundingpub",
        "BOB_FUNDING_PUB: 03bobfundingpub",
      ].join("\n"),
      error: null,
    });

    await expect(generator.execute!({
      inputs: {},
      nodeRpc,
      runPython,
    })).rejects.toThrow("No spendable UTXO is available");
  });
});
