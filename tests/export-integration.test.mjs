import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import { parseDataset } from "../src/core/schema";
import { analyze } from "../src/core/analyze";

const python = (code) =>
  execFileSync("python3", ["-c", code], { encoding: "utf8", timeout: 10_000 });

describe("node export to workbench", () => {
  it("analyzes an exact synthetic RPC export through the browser schema", () => {
    const exported = python(`
import json, sys
sys.path.insert(0, "tests")
from test_node_export import SyntheticNode
from scripts.export_node import export_snapshot
print(json.dumps(export_snapshot(SyntheticNode(), 10, 11, "mainnet")))
`);
    const data = parseDataset(exported);
    const result = analyze(data);
    const candidates = result.findings.filter((f) => f.kind === "candidate");
    expect(data.transactions).toHaveLength(4);
    expect(data.coverage.complete).toBe(true);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].evidence).toHaveLength(2);
    expect(result.flows.map((f) => f.direction)).toEqual([
      "shield",
      "deshield",
    ]);
    expect(data.transactions[1].feeZat).toBe("10000");
  });

  it("normalizes the archived mainnet block without inventing payment evidence", () => {
    const exported = python(`
import json
from pathlib import Path
from scripts.export_node import decode_json, normalize_transaction
block = decode_json(Path("tests/fixtures/zebra-mainnet-1.json").read_text())
tx, _ = normalize_transaction(block["tx"][0], block, 10, None, False)
print(json.dumps({
    "schemaVersion": 1, "name": "Archived Zebra mainnet block 1", "network": "mainnet",
    "source": {"kind": "import", "label": "Archived upstream test fixture, not a live export", "retrievedAt": "2026-10-16T00:00:00Z"},
    "coverage": {"fromHeight": 1, "toHeight": 1, "complete": False, "note": "Archived mainnet coinbase fixture. Historical tip claims only."},
    "transactions": [tx]
}))
`);
    const data = parseDataset(exported);
    expect(data.transactions[0].coinbase).toBe(true);
    expect(data.transactions[0].outputs[0]).toEqual({
      address: null,
      valueZat: "50000",
    });
    expect(data.transactions[0].outputs[1].valueZat).toBe("12500");
    const result = analyze(data);
    expect(result.flows).toEqual([]);
    expect(result.findings.map((f) => f.kind)).toEqual(["coverage"]);
    expect(result.excluded[0].reason).toContain("Coinbase");
  });
});
