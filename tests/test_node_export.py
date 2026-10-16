"""Offline exporter tests. RPC transcripts below are synthetic unless stated."""

from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, HTTPServer
from io import BytesIO
from email.message import Message
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from scripts.export_node import (
    ExportError,
    RpcClient,
    RpcError,
    amount,
    decode_json,
    export_snapshot,
    normalize_transaction,
    output_io,
    write_snapshot,
)


def h(number):
    return f"{number:064x}"


def output(value, address="synthetic-address", script_type="pubkeyhash"):
    return {
        "n": 0,
        "valueZat": value,
        "scriptPubKey": {"type": script_type, "addresses": [address]},
    }


def tx(number, inputs=None, outputs=None, sapling=0, orchard=0, ironwood=0):
    return {
        "txid": h(number),
        "version": 6 if ironwood else 5,
        "vin": inputs or [],
        "vout": outputs or [],
        "vjoinsplit": [],
        "vShieldedSpend": [],
        "vShieldedOutput": [],
        "valueBalanceZat": sapling,
        "orchard": {"actions": [{}] if orchard else [], "valueBalanceZat": orchard},
        "ironwood": {"actions": [{}] if ironwood else [], "valueBalanceZat": ironwood},
    }


def block(height, transactions):
    return {
        "hash": h(height),
        "previousblockhash": h(height - 1),
        "height": height,
        "time": 1_792_150_000 + height * 75,
        "confirmations": 20 - height + 1,
        "tx": transactions,
        "nTx": len(transactions),
    }


def coinbase(height):
    return tx(1000 + height, [{"coinbase": "00"}], [output(100_000_000)])


class SyntheticNode:
    def __init__(self):
        entry = tx(101, [{"txid": h(90), "vout": 0}], orchard=-100_000_000)
        exit_tx = tx(102, outputs=[output(99_990_000)], orchard=100_000_000)
        self.blocks = {
            10: block(10, [coinbase(10), entry]),
            11: block(11, [coinbase(11), exit_tx]),
        }
        self.parents = {h(90): {"txid": h(90), "vout": [output(100_010_000)]}}
        self.calls = []
        self.changed_height = None
        self.missing = False

    def __call__(self, method, params):
        self.calls.append((method, params))
        if method == "getblockchaininfo":
            return {
                "chain": "main",
                "blocks": 20,
                "bestblockhash": h(20),
                "initialblockdownload": False,
            }
        if method == "getblock":
            return deepcopy(self.blocks[int(params[0])])
        if method == "getblockhash":
            return h(999) if params[0] == self.changed_height else h(params[0])
        if method == "getrawtransaction":
            if self.missing:
                raise RpcError(method, -5)
            return deepcopy(self.parents[params[0]])
        raise AssertionError(f"Unexpected method: {method}")


class ExactAmounts(unittest.TestCase):
    def test_integer_fields_are_authoritative(self):
        self.assertEqual(
            amount(
                {"valueZat": 2_099_999_999_999_999, "value": 1.0},
                ("valueZat",),
                "value",
            ),
            2_099_999_999_999_999,
        )
        with self.assertRaises(ExportError):
            amount({"valueZat": 1, "valueSat": 2}, ("valueZat", "valueSat"), "value")

    def test_decimal_fallback_is_exact(self):
        for text, expected in [
            ("0.00000001", 1),
            ("1e-8", 1),
            ("1.2300000000", 123_000_000),
            ("20999999.99999999", 2_099_999_999_999_999),
            ("-1.00000001", -100_000_001),
        ]:
            self.assertEqual(
                amount(decode_json('{"value":' + text + "}"), (), "value", signed=True),
                expected,
            )
        for value in (
            Decimal("0.000000001"),
            Decimal("1e-9999999"),
            Decimal("1e9999999"),
            True,
            0.1,
        ):
            with self.assertRaises(ExportError):
                amount({"value": value}, (), "value")

    def test_nonfinite_and_duplicate_json_is_rejected(self):
        for text in ('{"value":NaN}', '{"value":Infinity}', '{"value":1,"value":2}'):
            with self.assertRaises(ExportError):
                decode_json(text)


class Normalization(unittest.TestCase):
    def test_pool_sign_and_fee_for_all_supported_pools(self):
        for pool in ("sapling", "orchard", "ironwood"):
            entry = tx(1, [{"txid": h(90), "vout": 0}], **{pool: -100_000_000})
            result, missing = normalize_transaction(
                entry,
                block(10, []),
                20,
                lambda _: {"vout": [output(100_010_000)]},
                False,
            )
            self.assertEqual(
                result["poolDeltas"], [{"pool": pool, "valueZat": "100000000"}]
            )
            self.assertEqual(result["feeZat"], "10000")
            self.assertEqual(missing, 0)
            exit_tx = tx(2, outputs=[output(99_990_000)], **{pool: 100_000_000})
            result, _ = normalize_transaction(exit_tx, block(11, []), 20, None, False)
            self.assertEqual(result["poolDeltas"][0]["valueZat"], "-100000000")
            self.assertEqual(result["feeZat"], "10000")

    def test_non_address_scripts_keep_the_value(self):
        self.assertEqual(
            output_io(output(1, script_type="pubkey")),
            {"address": None, "valueZat": "1"},
        )
        item = output(2)
        item["scriptPubKey"]["addresses"] = ["a", "b"]
        self.assertIsNone(output_io(item)["address"])

    def test_sprout_unknown_versions_and_broken_accounting_fail(self):
        for change in (
            {"vjoinsplit": [{}]},
            {"version": 7},
            {"vout": [output(999_999_999)]},
        ):
            data = tx(1, outputs=[output(99_990_000)], orchard=100_000_000)
            data.update(change)
            with self.assertRaises(ExportError):
                normalize_transaction(data, block(10, []), 20, None, False)


class SnapshotTests(unittest.TestCase):
    def test_export_all_records_and_recheck_hashes(self):
        node = SyntheticNode()
        result = export_snapshot(
            node, 10, 11, "mainnet", now=datetime(2026, 10, 16, tzinfo=timezone.utc)
        )
        self.assertEqual(len(result["transactions"]), 4)
        self.assertTrue(result["coverage"]["complete"])
        self.assertEqual(result["transactions"][1]["confirmations"], 11)
        self.assertEqual(
            node.calls[-3:],
            [("getblockhash", [10]), ("getblockhash", [11]), ("getblockhash", [20])],
        )
        self.assertIn(h(20), result["coverage"]["note"])
        self.assertLessEqual(len(result["coverage"]["note"]), 500)

    def test_reorg_or_inconsistent_linkage_aborts(self):
        for height in (10, 11, 20):
            node = SyntheticNode()
            node.changed_height = height
            with self.assertRaisesRegex(ExportError, "Chain changed"):
                export_snapshot(node, 10, 11, "mainnet")
        node = SyntheticNode()
        node.blocks[11]["previousblockhash"] = h(998)
        with self.assertRaisesRegex(ExportError, "linkage"):
            export_snapshot(node, 10, 11, "mainnet")

    def test_missing_previous_outputs_require_explicit_opt_in(self):
        node = SyntheticNode()
        node.missing = True
        with self.assertRaises(RpcError):
            export_snapshot(node, 10, 11, "mainnet")
        data = export_snapshot(node, 10, 11, "mainnet", allow_unresolved=True)
        self.assertFalse(data["coverage"]["complete"])
        self.assertIsNone(data["transactions"][1]["feeZat"])
        self.assertEqual(
            data["transactions"][1]["inputs"], [{"address": None, "valueZat": None}]
        )

    def test_network_range_confirmation_and_truncation_guards(self):
        for start, end, network in (
            (11, 10, "mainnet"),
            (0, 20, "mainnet"),
            (10, 20, "mainnet"),
            (10, 11, "testnet"),
        ):
            with self.assertRaises(ExportError):
                export_snapshot(SyntheticNode(), start, end, network)
        node = SyntheticNode()
        node.blocks[10]["nTx"] = 99
        with self.assertRaisesRegex(ExportError, "incomplete"):
            export_snapshot(node, 10, 11, "mainnet")
        node = SyntheticNode()
        node.blocks[10]["tx"] = [coinbase(10)] * 201
        with self.assertRaisesRegex(ExportError, "1–200"):
            export_snapshot(node, 10, 11, "mainnet")

    def test_parent_is_fetched_once(self):
        node = SyntheticNode()
        node.parents[h(90)]["vout"].append({**output(1), "n": 1})
        node.blocks[10]["tx"][1]["vin"].append({"txid": h(90), "vout": 1})
        export_snapshot(node, 10, 11, "mainnet")
        self.assertEqual(
            sum(method == "getrawtransaction" for method, _ in node.calls), 1
        )

    def test_existing_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.json"
            path.write_text("existing")
            with self.assertRaises(ExportError):
                write_snapshot({}, path)
            self.assertEqual(path.read_text(), "existing")
            path.unlink()
            write_snapshot({"schemaVersion": 1}, path)
            self.assertEqual(json.loads(path.read_text()), {"schemaVersion": 1})
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)


class TransportTests(unittest.TestCase):
    def test_request_pacing_waits_without_real_sleep(self):
        rpc = RpcClient("http://127.0.0.1:8232", request_interval=13)
        rpc.deadline = 280
        rpc.last_request_started = 100
        with patch("scripts.export_node.time.monotonic", side_effect=[100, 100, 113]):
            with patch("scripts.export_node.time.sleep") as sleep:
                with patch.object(
                    rpc.opener, "open", return_value=BytesIO(b'{"id":1,"result":"ok"}')
                ):
                    self.assertEqual(rpc("getblockhash", [1]), "ok")
                sleep.assert_called_once_with(13)

    def test_pacing_respects_interval_and_operation_limits(self):
        for interval in (-1, 61, float("nan"), float("inf"), True, "13"):
            with self.assertRaises(ExportError):
                RpcClient("http://127.0.0.1:8232", request_interval=interval)
        rpc = RpcClient("http://127.0.0.1:8232", request_interval=13)
        rpc.deadline = 110
        rpc.last_request_started = 100
        with patch("scripts.export_node.time.monotonic", return_value=100):
            with patch("scripts.export_node.time.sleep") as sleep:
                with self.assertRaisesRegex(ExportError, "time budget"):
                    rpc("getblockhash", [1])
                sleep.assert_not_called()

    def test_rate_limit_hints_do_not_echo_arbitrary_headers(self):
        for header, expected in (
            ("30", "Wait at least 30 seconds"),
            ("sensitive", "Retry later"),
        ):
            rpc = RpcClient("http://127.0.0.1:8232")
            headers = Message()
            headers["Retry-After"] = header
            error = HTTPError(
                rpc.endpoint, 429, "sensitive", headers, BytesIO(b"sensitive")
            )
            with patch.object(rpc.opener, "open", side_effect=error):
                with self.assertRaisesRegex(ExportError, expected) as caught:
                    rpc("getblockhash", [1])
                self.assertNotIn("sensitive", str(caught.exception))

    def test_endpoint_and_method_guards(self):
        for url in (
            "http://example.com",
            "https://user:password@example.com",
            "https://example.com/?token=secret",
            "file:///tmp/test",
            "https://example.com/#secret",
        ):
            with self.assertRaises(ExportError):
                RpcClient(url)
        with self.assertRaises(ExportError):
            RpcClient("http://127.0.0.1:8232", "user", None)
        with self.assertRaises(ExportError):
            RpcClient("http://127.0.0.1:8232")("sendrawtransaction", [])

    def test_http_transport_and_rpc_errors_do_not_echo_secrets(self):
        seen = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                request = json.loads(
                    self.rfile.read(int(self.headers["Content-Length"]))
                )
                seen.append((request, self.headers.get("Authorization")))
                if request["method"] == "getblockchaininfo":
                    body = '{"id":1,"error":null,"result":{"value":0.00000001}}'
                else:
                    body = json.dumps(
                        {
                            "id": request["id"],
                            "result": None,
                            "error": {"code": -5, "message": "sensitive-node-message"},
                        }
                    )
                self.send_response(
                    200 if request["method"] == "getblockchaininfo" else 500
                )
                self.end_headers()
                self.wfile.write(body.encode())

            def log_message(self, *args):
                pass

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            rpc = RpcClient(
                f"http://127.0.0.1:{server.server_port}", "operator", "secret"
            )
            self.assertEqual(
                rpc("getblockchaininfo", [])["value"], Decimal("0.00000001")
            )
            with self.assertRaises(RpcError) as caught:
                rpc("getrawtransaction", [h(1), 1])
            self.assertNotIn("sensitive", str(caught.exception))
            self.assertNotIn("secret", str(caught.exception))
            self.assertTrue(seen[0][1].startswith("Basic "))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_bounds_and_response_ids(self):
        rpc = RpcClient("http://127.0.0.1:8232")
        rpc.calls = 1000
        with self.assertRaisesRegex(ExportError, "limit"):
            rpc("getblockhash", [1])
        rpc = RpcClient("http://127.0.0.1:8232")
        rpc.deadline = 0
        with self.assertRaisesRegex(ExportError, "limit"):
            rpc("getblockhash", [1])
        with patch("scripts.export_node.MAX_OUTPUT", 2):
            with self.assertRaisesRegex(ExportError, "2 MB"):
                write_snapshot({"key": "value"}, "must-not-exist.json")

    def test_response_size_and_id_are_checked(self):
        rpc = RpcClient("http://127.0.0.1:8232")
        with patch.object(
            rpc.opener, "open", return_value=BytesIO(b'{"id":2,"result":1}')
        ):
            with self.assertRaisesRegex(ExportError, "response ID"):
                rpc("getblockhash", [1])
        rpc = RpcClient("http://127.0.0.1:8232")
        with patch("scripts.export_node.MAX_RESPONSE", 2):
            with patch.object(rpc.opener, "open", return_value=BytesIO(b"too large")):
                with self.assertRaisesRegex(ExportError, "size limit"):
                    rpc("getblockhash", [1])

    def test_redirects_are_not_followed(self):
        seen = []

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                seen.append(self.path)
                self.send_response(302)
                self.send_header(
                    "Location", f"http://127.0.0.1:{self.server.server_port}/target"
                )
                self.end_headers()

            def log_message(self, *args):
                pass

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            rpc = RpcClient(
                f"http://127.0.0.1:{server.server_port}", "operator", "secret"
            )
            with self.assertRaisesRegex(ExportError, "302"):
                rpc("getblockchaininfo", [])
            self.assertEqual(seen, ["/"])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
