"""Replay recorded public-node results; no external requests during tests."""

from copy import deepcopy
from datetime import datetime
import hashlib
import json
from pathlib import Path
import unittest

from scripts.export_node import decode_json, export_snapshot

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests/fixtures/mainnet-3520054"


class RecordedMainnetTests(unittest.TestCase):
    def test_exact_export_replays_from_the_recorded_rpc_results(self):
        records = iter(decode_json((FIXTURE / "rpc.json").read_text()))
        expected = json.loads((FIXTURE / "export.json").read_text())
        calls = []

        def replay(method, params):
            item = next(records)
            self.assertEqual((method, params), (item["method"], item["params"]))
            calls.append(method)
            return deepcopy(item["result"])

        result = export_snapshot(
            replay,
            3520054,
            3520054,
            "mainnet",
            now=datetime.fromisoformat(
                expected["source"]["retrievedAt"].replace("Z", "+00:00")
            ),
        )
        self.assertEqual(result, expected)
        self.assertEqual(len(calls), 9)
        self.assertIsNone(next(records, None))
        bundled = json.loads((ROOT / "src/data/mainnet-3520054.json").read_text())
        self.assertEqual(bundled["transactions"], result["transactions"])
        self.assertEqual(bundled["coverage"], result["coverage"])
        self.assertEqual(
            bundled["source"]["retrievedAt"], result["source"]["retrievedAt"]
        )

    def test_second_source_agrees_on_public_fields(self):
        data = json.loads((FIXTURE / "export.json").read_text())
        other = decode_json((FIXTURE / "cipherscan.json").read_text())
        self.assertFalse(other["isOrphaned"])
        self.assertEqual(len(data["transactions"]), other["transaction_count"])
        self.assertEqual(
            [t["txid"] for t in data["transactions"]],
            [t["txid"] for t in other["transactions"]],
        )
        for tx, independent in zip(data["transactions"], other["transactions"]):
            self.assertEqual(tx["blockHash"], other["hash"])
            self.assertEqual(tx["blockHeight"], int(other["height"]))
            self.assertEqual(tx["version"], independent["version"])
            self.assertEqual(len(tx["outputs"]), independent["vout_count"])
            self.assertEqual(
                sum(int(io["valueZat"]) for io in tx["outputs"]),
                int(independent["total_output"]),
            )
            for output, expected in zip(tx["outputs"], independent["outputs"]):
                self.assertEqual(output["address"], expected["address"])
                self.assertEqual(int(output["valueZat"]), int(expected["value"]))
            if not tx["coinbase"]:
                self.assertEqual(tx["feeZat"], independent["fee"])
                self.assertEqual(len(tx["inputs"]), independent["vin_count"])
                self.assertEqual(
                    sum(int(io["valueZat"]) for io in tx["inputs"]),
                    int(independent["total_input"]),
                )
                for item, expected in zip(tx["inputs"], independent["inputs"]):
                    self.assertEqual(item["address"], expected["address"])
                    self.assertEqual(int(item["valueZat"]), int(expected["value"]))
            for pool in ("sapling", "orchard", "ironwood"):
                delta = next(
                    (int(p["valueZat"]) for p in tx["poolDeltas"] if p["pool"] == pool),
                    0,
                )
                self.assertEqual(delta, -int(independent[f"value_balance_{pool}"]))

    def test_recorded_files_match_the_provenance_checksums(self):
        manifest = json.loads((FIXTURE / "provenance.json").read_text())
        self.assertFalse(manifest["consensusVerified"])
        for path, expected in manifest["sha256"].items():
            self.assertEqual(
                hashlib.sha256((ROOT / path).read_bytes()).hexdigest(), expected, path
            )


if __name__ == "__main__":
    unittest.main()
