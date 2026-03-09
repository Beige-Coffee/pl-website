import { describe, expect, it } from "vitest";
import { VL_SECTIONS } from "../../client/src/visual-lightning/data/vl-sections";
import { SIMPLE_TX } from "../../client/src/visual-lightning/data/vl-diagram-data";

describe("Visual Lightning content contracts", () => {
  it("describes HTLC forwarding only after the HTLC is irrevocably committed", () => {
    const section = VL_SECTIONS.find((entry) => entry.id === "10");
    expect(section).toBeDefined();
    const body = JSON.stringify(section?.content);

    expect(body).toContain("irrevocably committed");
    expect(body).not.toContain("Once Bob sends revoke_and_ack, his old state is revoked and it's safe to forward");
    expect(body).not.toContain("until after sending revoke_and_ack");
  });

  it("describes txids as double-SHA256 values", () => {
    expect(SIMPLE_TX.tooltips.txid.description).toContain("double-SHA256");
  });

  it("does not describe cooperative closes as instant finality", () => {
    const section = VL_SECTIONS.find((entry) => entry.id === "12");
    expect(section).toBeDefined();
    const body = JSON.stringify(section?.content);

    expect(body).not.toContain("instant finality");
    expect(body).toContain("once the closing transaction confirms");
  });
});
