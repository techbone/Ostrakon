#!/usr/bin/env python3
"""Export a bounded, read-only Zcash node snapshot to Ostrakon v1 JSON."""

import argparse
import base64
from datetime import datetime, timezone
from decimal import Decimal
from http.client import HTTPException
import json
import math
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

MAX_ZAT = 2_100_000_000_000_000
MAX_RESPONSE = 16_000_000
MAX_TOTAL_BYTES = 64_000_000
MAX_OUTPUT = 2_000_000
MAX_CALLS = 1000
METHODS = {"getblockchaininfo", "getblock", "getblockhash", "getrawtransaction"}
VERSION = "0.1.0"


class ExportError(Exception):
    """An error safe to display without exposing the RPC endpoint or credentials."""


class RpcError(ExportError):
    def __init__(self, method, code):
        self.code = code
        super().__init__(f"Node rejected {method} (RPC code {code}).")


def reject_constant(_):
    raise ExportError("RPC JSON contains a non-finite number.")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ExportError("RPC JSON contains duplicate keys.")
        result[key] = value
    return result


def decode_json(text):
    try:
        return json.loads(
            text,
            parse_float=Decimal,
            parse_constant=reject_constant,
            object_pairs_hook=unique_object,
        )
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise ExportError("Node returned invalid JSON.") from exc


def integer(value, label, minimum=0, maximum=100_000_000):
    if type(value) is not int or not minimum <= value <= maximum:
        raise ExportError(f"Invalid {label} in node response.")
    return value


def hash_value(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
        raise ExportError("Invalid hash in node response.")
    return value


def array(value, label):
    if not isinstance(value, list):
        raise ExportError(f"Missing or invalid {label} in node response.")
    return value


def object_value(value, label):
    if not isinstance(value, dict):
        raise ExportError(f"Missing or invalid {label} in node response.")
    return value


def amount(data, zat_keys, decimal_key, signed=False):
    """Prefer node integer fields; exact decimal parsing is a legacy fallback."""
    values = [
        integer(data[key], key, -MAX_ZAT if signed else 0, MAX_ZAT)
        for key in zat_keys
        if key in data
    ]
    if values:
        if len(set(values)) != 1:
            raise ExportError("Conflicting integer amount fields in node response.")
        return values[0]
    value = data.get(decimal_key)
    if isinstance(value, bool) or not isinstance(value, (int, Decimal)):
        raise ExportError(f"Missing exact {decimal_key} amount in node response.")
    # Never accept Python float values: RPC JSON must pass through decode_json.
    value = Decimal(value)
    if not value.is_finite():
        raise ExportError("Node amount is outside the supported range.")
    sign, digits, exponent = value.as_tuple()
    digits = list(digits)
    if not any(digits):
        return 0
    while digits[-1] == 0:
        digits.pop()
        exponent += 1
    shift = exponent + 8
    if shift < 0 or len(digits) + shift > 16 or (sign and not signed):
        raise ExportError("Node amount is not an exact supported zatoshi value.")
    zats = int("".join(map(str, digits))) * 10**shift
    return integer(
        -zats if sign else zats, decimal_key, -MAX_ZAT if signed else 0, MAX_ZAT
    )


def output_io(output):
    output = object_value(output, "transparent output")
    value = amount(output, ("valueZat", "valueSat"), "value")
    script = object_value(output.get("scriptPubKey"), "scriptPubKey")
    addresses = script.get("addresses", [])
    array(addresses, "script addresses")
    address = addresses[0] if len(addresses) == 1 else None
    if address is not None and (
        not isinstance(address, str) or not 1 <= len(address) <= 128
    ):
        raise ExportError("Invalid transparent address in node response.")
    # A multisig participant list does not denote a single payment address.
    if script.get("type") not in ("pubkeyhash", "scripthash"):
        address = None
    return {"address": address, "valueZat": str(value)}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class RpcClient:
    def __init__(self, endpoint, username=None, password=None, request_interval=0):
        try:
            url = urlsplit(endpoint)
            local = url.hostname in ("localhost", "127.0.0.1", "::1")
            valid = url.scheme == "https" or (url.scheme == "http" and local)
            valid = (
                valid
                and bool(url.hostname)
                and not (url.username or url.password or url.query or url.fragment)
                and all(ord(char) > 32 and ord(char) != 127 for char in endpoint)
            )
            _ = url.port
        except ValueError:
            valid = False
        if not valid:
            raise ExportError(
                "RPC URL must use HTTPS, or loopback HTTP, with no credentials, query or fragment."
            )
        if bool(username) != bool(password):
            raise ExportError(
                "Set both OSTRAKON_RPC_USER and OSTRAKON_RPC_PASSWORD, or neither."
            )
        if (
            type(request_interval) not in (int, float)
            or not math.isfinite(request_interval)
            or not 0 <= request_interval <= 60
        ):
            raise ExportError("Request interval must be between 0 and 60 seconds.")
        self.endpoint = endpoint
        self.headers = {"Content-Type": "application/json"}
        if username:
            token = base64.b64encode(f"{username}:{password}".encode()).decode()
            self.headers["Authorization"] = f"Basic {token}"
        # Do not silently route node queries through inherited environment proxies.
        self.opener = build_opener(ProxyHandler({}), NoRedirect())
        self.calls = 0
        self.total_bytes = 0
        self.deadline = time.monotonic() + 180
        self.request_interval = request_interval
        self.last_request_started = None

    def __call__(self, method, params):
        if method not in METHODS:
            raise ExportError("Exporter attempted a disallowed RPC method.")
        self.calls += 1
        remaining = self.deadline - time.monotonic()
        if self.calls > MAX_CALLS or remaining <= 0:
            raise ExportError(
                "Export request or time limit exceeded; choose a smaller range."
            )
        if self.last_request_started is not None:
            wait = max(
                0, self.last_request_started + self.request_interval - time.monotonic()
            )
            if wait >= remaining:
                raise ExportError(
                    "Request pacing exceeds the export time budget; choose a smaller range."
                )
            if wait:
                time.sleep(wait)
        self.last_request_started = time.monotonic()
        remaining = self.deadline - self.last_request_started
        if remaining <= 0:
            raise ExportError("Export time budget expired before the next request.")
        payload = json.dumps(
            {"jsonrpc": "1.0", "id": self.calls, "method": method, "params": params}
        ).encode()
        request = Request(
            self.endpoint, data=payload, headers=self.headers, method="POST"
        )
        try:
            with self.opener.open(request, timeout=min(20, remaining)) as response:
                body = response.read(MAX_RESPONSE + 1)
        except HTTPError as exc:
            if exc.code == 429:
                retry = exc.headers.get("Retry-After", "")
                hint = (
                    f" Wait at least {int(retry)} seconds before retrying."
                    if re.fullmatch(r"\d{1,6}", retry)
                    else " Retry later."
                )
                exc.close()
                raise ExportError(f"Node rate limit reached (HTTP 429).{hint}") from exc
            # zcashd uses HTTP 500 for JSON-RPC errors, including absent txindex data.
            if exc.code != 500:
                raise ExportError(
                    f"Node HTTP request failed (status {exc.code})."
                ) from exc
            try:
                body = exc.read(MAX_RESPONSE + 1)
            except (HTTPException, OSError) as read_error:
                raise ExportError(
                    "Node error response was interrupted."
                ) from read_error
            finally:
                exc.close()
        except (HTTPException, URLError, OSError, TimeoutError) as exc:
            raise ExportError(
                "Node connection failed or timed out. Check the endpoint and node availability."
            ) from exc
        self.total_bytes += len(body)
        if len(body) > MAX_RESPONSE or self.total_bytes > MAX_TOTAL_BYTES:
            raise ExportError(
                "Node response size limit exceeded; choose a smaller range."
            )
        envelope = object_value(decode_json(body), "JSON-RPC envelope")
        if type(envelope.get("id")) is not int or envelope["id"] != self.calls:
            raise ExportError("Node returned an unexpected JSON-RPC response ID.")
        if envelope.get("error") is not None:
            error = object_value(envelope["error"], "RPC error")
            code = integer(error.get("code"), "RPC error code", -100_000, 100_000)
            raise RpcError(method, code)
        if "result" not in envelope:
            raise ExportError("Node response has no result.")
        return envelope["result"]


def normalize_transaction(tx, block, tip_height, resolve, allow_unresolved):
    tx = object_value(tx, "transaction")
    txid = hash_value(tx.get("txid"))
    version = integer(tx.get("version"), "transaction version", 1, 6)
    if tx.get("in_active_chain") is False:
        raise ExportError("Node returned a transaction outside the active chain.")
    if "blockhash" in tx and tx["blockhash"] != block["hash"]:
        raise ExportError("Transaction block hash disagrees with its block.")
    if "height" in tx and tx["height"] != block["height"]:
        raise ExportError("Transaction height disagrees with its block.")
    if array(tx.get("vjoinsplit", []), "Sprout JoinSplits"):
        raise ExportError(
            "Sprout JoinSplits are unsupported; choose a different block range."
        )
    vin = array(tx.get("vin"), "transparent inputs")
    vout = array(tx.get("vout"), "transparent outputs")
    if len(vin) > 16 or len(vout) > 16:
        raise ExportError(
            "A transaction exceeds the workbench's 16 input/output limit."
        )
    for index, output in enumerate(vout):
        if object_value(output, "transparent output").get("n") != index:
            raise ExportError("Invalid transparent output ordering.")
    coinbase = len(vin) == 1 and "coinbase" in object_value(vin[0], "transparent input")
    inputs = []
    unresolved = 0
    if not coinbase:
        spent = set()
        for item in vin:
            item = object_value(item, "transparent input")
            parent = hash_value(item.get("txid"))
            index = integer(item.get("vout"), "previous output index", 0, 1_000_000)
            if (parent, index) in spent:
                raise ExportError("Duplicate spent output in node transaction.")
            spent.add((parent, index))
            try:
                previous = resolve(parent)
            except RpcError as exc:
                if not allow_unresolved or exc.code != -5:
                    raise
                inputs.append({"address": None, "valueZat": None})
                unresolved += 1
                continue
            outputs = array(previous.get("vout"), "previous transaction outputs")
            if (
                index >= len(outputs)
                or object_value(outputs[index], "previous output").get("n") != index
            ):
                raise ExportError(
                    "Previous output is absent or has an unexpected index."
                )
            inputs.append(output_io(outputs[index]))
    outputs = [output_io(output) for output in vout]
    balances = []
    if version >= 4:
        array(tx.get("vShieldedSpend"), "Sapling spends")
        array(tx.get("vShieldedOutput"), "Sapling outputs")
        value = amount(tx, ("valueBalanceZat",), "valueBalance", signed=True)
        if value:
            balances.append({"pool": "sapling", "valueZat": str(-value)})
    for pool, minimum_version in (("orchard", 5), ("ironwood", 6)):
        bundle = tx.get(pool)
        if bundle is None:
            continue
        bundle = object_value(bundle, pool)
        actions = array(bundle.get("actions"), f"{pool} actions")
        value = amount(bundle, ("valueBalanceZat",), "valueBalance", signed=True)
        if (actions or value) and version < minimum_version:
            raise ExportError("Shielded pool is incompatible with transaction version.")
        if value and not actions:
            raise ExportError("Nonzero pool balance has no shielded actions.")
        if value:
            balances.append({"pool": pool, "valueZat": str(-value)})
    fee = None
    if not coinbase and not unresolved:
        fee = sum(int(io["valueZat"]) for io in inputs) - sum(
            int(io["valueZat"]) for io in outputs
        )
        fee -= sum(int(delta["valueZat"]) for delta in balances)
        integer(fee, "calculated transaction fee", 0, MAX_ZAT)
        fee = str(fee)
    timestamp = (
        datetime.fromtimestamp(block["time"], timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )
    return {
        "txid": txid,
        "blockHeight": block["height"],
        "blockHash": block["hash"],
        "timestamp": timestamp,
        "version": version,
        "confirmations": tip_height - block["height"] + 1,
        "coinbase": coinbase,
        "feeZat": fee,
        "inputs": inputs,
        "outputs": outputs,
        "poolDeltas": balances,
    }, unresolved


def export_snapshot(rpc, start, end, network, allow_unresolved=False, now=None):
    integer(start, "start height")
    integer(end, "end height")
    if end < start or end - start >= 20:
        raise ExportError("Choose a range of 1–20 blocks in ascending order.")
    if network not in ("mainnet", "testnet"):
        raise ExportError("Only mainnet and testnet exports are supported.")
    info = object_value(rpc("getblockchaininfo", []), "chain information")
    if info.get("chain") != {"mainnet": "main", "testnet": "test"}[network]:
        raise ExportError("Requested network does not match the node.")
    if info.get("initialblockdownload") is True:
        raise ExportError("Node is still synchronizing; wait for it to finish.")
    tip_height = integer(info.get("blocks"), "tip height")
    tip_hash = hash_value(info.get("bestblockhash"))
    if end >= tip_height:
        raise ExportError("Requested range needs at least two snapshot confirmations.")
    blocks, transactions, parents, hashes = [], [], {}, set()
    unresolved = 0

    def resolve(txid):
        if txid not in parents:
            parent = object_value(
                rpc("getrawtransaction", [txid, 1]), "previous transaction"
            )
            if hash_value(parent.get("txid")) != txid:
                raise ExportError("Node returned the wrong previous transaction.")
            parents[txid] = parent
        return parents[txid]

    for height in range(start, end + 1):
        block = object_value(rpc("getblock", [str(height), 2]), "block")
        if integer(block.get("height"), "block height") != height:
            raise ExportError("Node returned the wrong block height.")
        hash_value(block.get("hash"))
        integer(block.get("time"), "block timestamp", 0, 253_402_300_799)
        if integer(block.get("confirmations"), "block confirmations", 1) < 1:
            raise ExportError("Block is outside the active chain.")
        if blocks and block.get("previousblockhash") != blocks[-1]["hash"]:
            raise ExportError(
                "Block linkage changed or is inconsistent; retry after a stable tip."
            )
        txs = array(block.get("tx"), "block transactions")
        if not txs or len(transactions) + len(txs) > 200:
            raise ExportError(
                "Range must contain 1–200 transactions; choose a smaller range."
            )
        if "nTx" in block and block["nTx"] != len(txs):
            raise ExportError("Block transaction count is incomplete.")
        blocks.append(block)
        for index, tx in enumerate(txs):
            record, missing = normalize_transaction(
                tx, block, tip_height, resolve, allow_unresolved
            )
            if record["coinbase"] != (index == 0):
                raise ExportError(
                    "Expected exactly one coinbase at the start of each block."
                )
            if record["txid"] in hashes:
                raise ExportError("Duplicate transaction in requested block range.")
            hashes.add(record["txid"])
            transactions.append(record)
            unresolved += missing
            parents[record["txid"]] = tx
    # Compare every exported block and the original tip, even if the chain advances.
    for height, expected in [(b["height"], b["hash"]) for b in blocks] + [
        (tip_height, tip_hash)
    ]:
        if hash_value(rpc("getblockhash", [height])) != expected:
            raise ExportError(
                "Chain changed during export; discard this attempt and retry."
            )
    retrieved = (now or datetime.now(timezone.utc)).isoformat().replace("+00:00", "Z")
    note = (
        f"All {len(transactions)} transactions from {len(blocks)} consecutive blocks. "
        f"Snapshot tip {tip_height} ({tip_hash}). Block linkage and hashes rechecked against node. "
        f"{unresolved} unresolved previous outputs. Node claims only; no independent consensus verification."
    )
    return {
        "schemaVersion": 1,
        "name": f"Node snapshot · {start}–{end}",
        "network": network,
        "source": {
            "kind": "import",
            "label": f"Node JSON-RPC export · exporter {VERSION}",
            "retrievedAt": retrieved,
        },
        "coverage": {
            "fromHeight": start,
            "toHeight": end,
            "complete": unresolved == 0,
            "note": note,
        },
        "transactions": transactions,
    }


def write_snapshot(dataset, output):
    payload = (json.dumps(dataset, indent=2, ensure_ascii=False) + "\n").encode()
    if len(payload) > MAX_OUTPUT:
        raise ExportError(
            "Export exceeds the workbench's 2 MB limit; choose a smaller range."
        )
    path = Path(output)
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise ExportError("Output file already exists; choose another path.") from exc
    except OSError as exc:
        raise ExportError(
            "Cannot create output file. Check its parent directory and permissions."
        ) from exc
    try:
        with os.fdopen(fd, "wb") as file:
            file.write(payload)
            file.flush()
            os.fsync(file.fileno())
    except BaseException:
        path.unlink(missing_ok=True)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-height", type=int, required=True)
    parser.add_argument("--to-height", type=int, required=True)
    parser.add_argument("--network", choices=("mainnet", "testnet"), required=True)
    parser.add_argument(
        "--output",
        required=True,
        help="New output file; existing files are never overwritten",
    )
    parser.add_argument(
        "--request-interval",
        type=float,
        default=0,
        help="Minimum seconds between requests (0–60); use 13 for a five-per-minute provider",
    )
    parser.add_argument(
        "--allow-unresolved",
        action="store_true",
        help="Retain missing previous outputs as unknown; mark coverage partial",
    )
    args = parser.parse_args(argv)
    try:
        rpc = RpcClient(
            os.environ.get("OSTRAKON_RPC_URL", "http://127.0.0.1:8232"),
            os.environ.get("OSTRAKON_RPC_USER"),
            os.environ.get("OSTRAKON_RPC_PASSWORD"),
            request_interval=args.request_interval,
        )
        dataset = export_snapshot(
            rpc, args.from_height, args.to_height, args.network, args.allow_unresolved
        )
        write_snapshot(dataset, args.output)
    except ExportError as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        return 1
    except (OSError, OverflowError, ValueError) as exc:
        # Do not echo exception bodies that could contain a credential-bearing URL.
        print(
            f"Export failed: local I/O or data error ({type(exc).__name__}).",
            file=sys.stderr,
        )
        return 1
    print(
        f"Exported {len(dataset['transactions'])} transactions. Import {args.output} into Ostrakon."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
