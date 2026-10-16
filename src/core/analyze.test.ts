import { describe, it, expect } from "vitest";
import { analyze, defaults, simulate } from "./analyze";
import { datasetSchema, parseDataset, zec } from "./schema";
import { sample } from "./samples";

const candidates = (data = sample("roundtrip")) =>
  analyze(data).findings.filter((f) => f.kind === "candidate");
describe("evidence and uncertainty", () => {
  it("finds the known round trip without asserting ownership", () => {
    const result = candidates();
    expect(result).toHaveLength(1);
    expect(result[0].evidence).toHaveLength(2);
    expect(result[0].limitation).toContain("not proof");
  });
  it("retains every matching candidate instead of choosing an owner", () =>
    expect(candidates(sample("ambiguous"))[0].evidence).toHaveLength(3));
  it("retains coverage uncertainty when no correlation is found", () => {
    const result = analyze(sample("quiet"));
    expect(result.findings.filter((f) => f.kind === "candidate")).toHaveLength(
      0,
    );
    expect(result.findings.some((f) => f.kind === "coverage")).toBe(true);
  });
  it("does not compare unrelated pools", () => {
    const data = sample("roundtrip");
    data.transactions[2].poolDeltas[0].pool = "sapling";
    expect(candidates(data)).toHaveLength(0);
  });
  it("excludes migration, mixed change, and broken accounting", () => {
    for (const variant of ["migration", "change", "accounting"]) {
      const data = sample("roundtrip");
      if (variant === "migration")
        data.transactions[0].poolDeltas.push({
          pool: "orchard",
          valueZat: "-1250000000",
        });
      if (variant === "change")
        data.transactions[0].outputs.push({ address: "change", valueZat: "1" });
      if (variant === "accounting") data.transactions[0].feeZat = "20000";
      expect(candidates(data)).toHaveLength(0);
    }
  });
  it("excludes unknown versions, unconfirmed entries, and missing values", () => {
    for (const variant of ["version", "confirmation", "value"]) {
      const data = sample("roundtrip");
      if (variant === "version") data.transactions[0].version = 99;
      if (variant === "confirmation") data.transactions[0].confirmations = 0;
      if (variant === "value") data.transactions[0].inputs[0].valueZat = null;
      expect(candidates(data)).toHaveLength(0);
    }
  });
  it("requires chronological order and applies an exact window", () => {
    const data = sample("roundtrip");
    expect(
      analyze(data, { ...defaults, windowHours: 0.5 }).findings.filter(
        (f) => f.kind === "candidate",
      ),
    ).toHaveLength(0);
    data.transactions[2].timestamp = "2026-10-15T08:59:00Z";
    expect(candidates(data)).toHaveLength(0);
  });
  it("counts address appearances across distinct transactions", () => {
    const data = sample("roundtrip");
    data.transactions = [data.transactions[3]];
    data.transactions[0].outputs[0].address =
      data.transactions[0].inputs[0].address;
    expect(
      analyze(data).findings.filter((f) => f.kind === "reuse"),
    ).toHaveLength(0);
  });
  it("simulation never mutates evidence and can remove only heuristic matches", () => {
    const data = sample("roundtrip"),
      original = JSON.stringify(data);
    expect(candidates(simulate(data, 24))).toHaveLength(0);
    expect(JSON.stringify(data)).toBe(original);
    expect(candidates(data)).toHaveLength(1);
  });
  it("is deterministic regardless of record order", () => {
    const data = sample("roundtrip");
    const expected = analyze(data);
    data.transactions.reverse();
    expect(analyze(data)).toEqual(expected);
  });
});
describe("bounded, exact input", () => {
  it("returns validation errors instead of throwing during numeric coercion", () => {
    for (const value of ["abc", "0.1", "1e100", "--1"]) {
      const data = sample("roundtrip");
      data.transactions[0].feeZat = value;
      expect(datasetSchema.safeParse(data).success).toBe(false);
      expect(() => parseDataset(JSON.stringify(data))).toThrow(
        "Invalid dataset",
      );
    }
  });
  it("validates all shipped examples", () => {
    for (const key of ["roundtrip", "ambiguous", "quiet"] as const)
      expect(datasetSchema.safeParse(sample(key)).success).toBe(true);
  });
  it("rejects duplicate transactions, noninteger amounts and extra keys", () => {
    const data = sample("roundtrip");
    data.transactions.push(data.transactions[0]);
    expect(() => parseDataset(JSON.stringify(data))).toThrow("Duplicate");
    expect(() =>
      parseDataset(
        JSON.stringify({
          ...sample("roundtrip"),
          seed: "never accept a secret",
        }),
      ),
    ).toThrow();
    const broken = sample("roundtrip");
    broken.transactions[0].feeZat = "0.1";
    expect(() => parseDataset(JSON.stringify(broken))).toThrow();
  });
  it("rejects inconsistent coverage and oversize imports", () => {
    const data = sample("roundtrip");
    data.coverage.toHeight = 1;
    expect(() => parseDataset(JSON.stringify(data))).toThrow();
    expect(() => parseDataset(" ".repeat(2_000_001))).toThrow("too large");
  });
  it("keeps every zatoshi without floating point rounding", () => {
    expect(zec("100000001")).toBe("1.00000001");
    expect(zec("2099999999999999")).toBe("20,999,999.99999999");
  });
  it("re-imports reports as datasets, discarding untrusted saved findings", () => {
    const data = sample("roundtrip");
    const loaded = parseDataset(
      JSON.stringify({
        reportVersion: 1,
        generatedAt: "2026-10-16T10:00:00Z",
        verification: "unverified",
        dataset: data,
        analysis: { findings: ["fabricated result"] },
      }),
    );
    expect(loaded).toEqual(data);
    expect(
      analyze(loaded).findings.some((f) => f.title === "fabricated result"),
    ).toBe(false);
  });
  it("applies zatoshi tolerance at the exact boundary", () => {
    const data = sample("roundtrip");
    data.transactions[2].poolDeltas[0].valueZat = "-1250010000";
    data.transactions[2].outputs[0].valueZat = "1250000000";
    expect(candidates(data)).toHaveLength(1);
    expect(
      analyze(data, { ...defaults, toleranceZat: "9999" }).findings.filter(
        (f) => f.kind === "candidate",
      ),
    ).toHaveLength(0);
  });
});
