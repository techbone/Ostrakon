import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { builtInDataset } from "./datasets";

describe("recorded mainnet snapshot", () => {
  it("loads real Ironwood movement without manufacturing a round trip", () => {
    const data = builtInDataset("mainnet-3520054");
    const result = analyze(data);
    expect(data.source.kind).toBe("import");
    expect(data.transactions).toHaveLength(7);
    expect(data.coverage.fromHeight).toBe(3520054);
    expect(result.flows).toHaveLength(1);
    expect(result.flows[0]).toMatchObject({
      direction: "deshield",
      pool: "ironwood",
      valueZat: "25015000",
    });
    expect(result.findings.filter((f) => f.kind === "candidate")).toEqual([]);
    expect(result.findings.some((f) => f.kind === "coverage")).toBe(true);
    expect(
      result.excluded.filter((e) =>
        e.reason.startsWith("No transparent payout"),
      ),
    ).toHaveLength(2);
    data.transactions[0].outputs[0].valueZat = "1";
    expect(
      builtInDataset("mainnet-3520054").transactions[0].outputs[0].valueZat,
    ).not.toBe("1");
  });
});
