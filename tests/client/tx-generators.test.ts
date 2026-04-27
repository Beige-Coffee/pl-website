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

  it("clears downstream notebook transactions when funding is regenerated", () => {
    expect(TX_GENERATORS["gen-funding"].invalidatesNotebookKeys).toEqual([
      "commitment-refund-txid",
      "commitment-refund-txhex",
      "commitment-htlc-txid",
      "commitment-htlc-txhex",
      "htlc-timeout-txid",
      "htlc-timeout-txhex",
    ]);
  });
});

describe("Funding transaction generator", () => {
  it("builds a 1-output funding tx when an exact 0.05 BTC UTXO is available", async () => {
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
        case "getblockcount":
          return { result: 200 };
        case "scantxoutset":
          return {
            result: {
              unspents: [
                { txid: "large-utxo", vout: 1, amount: 1.25, coinbase: false, scriptPubKey: "0014abc", height: 10 },
                { txid: "exact-utxo", vout: 0, amount: 0.05, coinbase: false, scriptPubKey: "0014abc", height: 5 },
              ],
            },
          };
        case "createrawtransaction":
          expect(params).toEqual([
            [{ txid: "exact-utxo", vout: 0 }],
            [
              { bcrt1qfundingoutput: 0.05 },
            ],
          ]);
          return { result: "unsigned-funding-hex" };
        case "signrawtransactionwithkey":
          expect(params[0]).toBe("unsigned-funding-hex");
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
      "getblockcount",
      "scantxoutset",
      "createrawtransaction",
      "signrawtransactionwithkey",
      "decoderawtransaction",
    ]);
  });

  it("falls back to 2-output tx with change when no exact UTXO exists", async () => {
    const generator = TX_GENERATORS["gen-funding"];
    const nodeRpc = vi.fn(async (method: string, params: unknown[]) => {
      switch (method) {
        case "createmultisig":
          return { result: { address: "bcrt1qfundingoutput" } };
        case "getblockcount":
          return { result: 200 };
        case "scantxoutset":
          return {
            result: {
              unspents: [
                { txid: "large-utxo", vout: 1, amount: 0.1, coinbase: true, scriptPubKey: "0014abc", height: 10 },
              ],
            },
          };
        case "createrawtransaction":
          expect(params).toEqual([
            [{ txid: "large-utxo", vout: 1 }],
            [
              { bcrt1qfundingoutput: 0.05 },
              { "bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080": 0.0499975 },
            ],
          ]);
          return { result: "unsigned-legacy-hex" };
        case "signrawtransactionwithkey":
          return { result: { complete: true, hex: "signed-legacy-hex" } };
        case "decoderawtransaction":
          return { result: { txid: "legacy-funding-txid" } };
        default:
          throw new Error(`Unexpected RPC method: ${method}`);
      }
    });

    const runPython = vi.fn().mockResolvedValue({
      output: "ALICE_FUNDING_PUB: 02alicefundingpub\nBOB_FUNDING_PUB: 03bobfundingpub",
      error: null,
    });

    const result = await generator.execute!({
      inputs: {},
      nodeRpc,
      runPython,
    });

    expect(result).toEqual({
      TXID: "legacy-funding-txid",
      HEX: "signed-legacy-hex",
    });
  });

  it("surfaces a useful error when no spendable UTXO can fund the channel output", async () => {
    const generator = TX_GENERATORS["gen-funding"];
    const nodeRpc = vi.fn(async (method: string) => {
      switch (method) {
        case "createmultisig":
          return { result: { address: "bcrt1qfundingoutput" } };
        case "getblockcount":
          return { result: 200 };
        case "scantxoutset":
          return { result: { unspents: [{ txid: "tiny", vout: 0, amount: 0.01, coinbase: false, scriptPubKey: "0014abc", height: 1 }] } };
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
