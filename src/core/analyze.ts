import type { Dataset, Pool, Transaction } from "./schema";
import { exclude, type ExcludedTransaction } from "./exclusions";

export const RULE_VERSION = "ostrakon/0.1.3";
export interface Parameters {
  windowHours: number;
  toleranceZat: string;
}
export const defaults: Parameters = { windowHours: 6, toleranceZat: "10000" };
export interface Flow {
  txid: string;
  direction: "shield" | "deshield";
  pool: Pool;
  valueZat: string;
  timestamp: string;
  blockHeight: number;
}
export interface Finding {
  id: string;
  kind: "candidate" | "reuse" | "coverage";
  title: string;
  description: string;
  evidence: string[];
  limitation: string;
  guidance: string;
  address?: string;
}
export interface Analysis {
  findings: Finding[];
  flows: Flow[];
  excluded: ExcludedTransaction[];
  parameters: Parameters;
  ruleVersion: string;
}

function flowOf(tx: Transaction): Flow | ExcludedTransaction {
  if (tx.coinbase) return exclude(tx.txid, "coinbase");
  if (![4, 5, 6].includes(tx.version))
    return exclude(tx.txid, "unsupported_version");
  if (tx.confirmations < 2) return exclude(tx.txid, "low_confirmations");
  if (tx.poolDeltas.length !== 1)
    return exclude(
      tx.txid,
      tx.poolDeltas.length ? "multiple_pools" : "no_pool_movement",
    );
  const { pool, valueZat } = tx.poolDeltas[0];
  if (
    (tx.version === 4 && pool !== "sapling") ||
    (tx.version === 5 && pool === "ironwood")
  )
    return exclude(tx.txid, "incompatible_pool");
  if (
    tx.feeZat === null ||
    [...tx.inputs, ...tx.outputs].some((io) => io.valueZat === null)
  )
    return exclude(tx.txid, "unresolved_amounts");
  const delta = BigInt(valueZat),
    fee = BigInt(tx.feeZat);
  const sum = (ios: Transaction["inputs"]) =>
    ios.reduce((n, io) => n + BigInt(io.valueZat!), 0n);
  if (sum(tx.inputs) - sum(tx.outputs) !== delta + fee)
    return exclude(tx.txid, "unbalanced_accounting");
  if (delta > 0n && (!tx.inputs.length || tx.outputs.length))
    return exclude(tx.txid, "transparent_change");
  if (delta < 0n && !tx.inputs.length && !tx.outputs.length)
    return exclude(tx.txid, "no_transparent_payout");
  if (delta < 0n && (tx.inputs.length || tx.outputs.length !== 1))
    return exclude(tx.txid, "mixed_payout");
  return {
    txid: tx.txid,
    direction: delta > 0n ? "shield" : "deshield",
    pool,
    valueZat: (delta > 0n ? delta : -delta).toString(),
    timestamp: tx.timestamp,
    blockHeight: tx.blockHeight,
  };
}

export function analyze(
  data: Dataset,
  parameters: Parameters = defaults,
): Analysis {
  if (
    !Number.isFinite(parameters.windowHours) ||
    parameters.windowHours < 0 ||
    parameters.windowHours > 168 ||
    !/^\d{1,9}$/.test(parameters.toleranceZat)
  )
    throw new Error("Invalid rule parameters.");
  const findings: Finding[] = [],
    flows: Flow[] = [],
    excluded: Analysis["excluded"] = [];
  const transactions = [...data.transactions].sort(
    (a, b) => a.blockHeight - b.blockHeight || a.txid.localeCompare(b.txid),
  );
  for (const tx of transactions) {
    const flow = flowOf(tx);
    if ("code" in flow) excluded.push(flow);
    else flows.push(flow);
  }
  for (const entry of flows.filter((f) => f.direction === "shield")) {
    const matches = flows.filter((exit) => {
      const elapsed = Date.parse(exit.timestamp) - Date.parse(entry.timestamp);
      const delta = BigInt(exit.valueZat) - BigInt(entry.valueZat);
      return (
        exit.direction === "deshield" &&
        exit.pool === entry.pool &&
        exit.blockHeight >= entry.blockHeight &&
        elapsed >= 0 &&
        elapsed <= parameters.windowHours * 3_600_000 &&
        (delta < 0n ? -delta : delta) <= BigInt(parameters.toleranceZat)
      );
    });
    if (matches.length)
      findings.push({
        id: `candidate:${entry.txid}`,
        kind: "candidate",
        title:
          matches.length > 1
            ? `${matches.length} possible round-trip matches`
            : "A possible round-trip pattern",
        description: `${matches.length} pool exit${matches.length === 1 ? "" : "s"} in the loaded dataset ${matches.length === 1 ? "has" : "have"} a similar net amount within ${parameters.windowHours} hours of this pool entry.`,
        evidence: [entry.txid, ...matches.map((m) => m.txid)],
        limitation:
          "Amount and timing are heuristics, not proof of shared ownership. Other matches can exist outside this dataset. Net pool amounts are not individual note values.",
        guidance:
          "Understand what becomes public when funds leave a shielded pool. Keeping activity shielded avoids publishing transparent payout details; delaying a payment alone does not guarantee privacy.",
      });
  }
  const addresses = new Map<string, Set<string>>();
  for (const tx of transactions) {
    if (tx.confirmations < 2 || tx.coinbase || ![4, 5, 6].includes(tx.version))
      continue;
    for (const io of [...tx.inputs, ...tx.outputs]) {
      if (io.address === null) continue;
      const ids = addresses.get(io.address) ?? new Set<string>();
      ids.add(tx.txid);
      addresses.set(io.address, ids);
    }
  }
  for (const [address, ids] of [...addresses].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (ids.size > 1)
      findings.push({
        id: `reuse:${address}`,
        kind: "reuse",
        title: "A transparent address appears again",
        description: `The same address appears in ${ids.size} transactions in this dataset. Those public appearances can be grouped together.`,
        evidence: [...ids],
        address,
        limitation:
          "Repeated appearances do not identify a person. A normal spend of an earlier output also causes an address to appear again. Dataset contents have not been independently verified against consensus.",
        guidance:
          "Avoid publishing a reusable transparent address for unrelated payments. Use supported shielded receivers where appropriate; a fresh transparent address alone cannot erase existing links.",
      });
  }
  findings.push({
    id: "coverage",
    kind: "coverage",
    title: data.coverage.complete
      ? "A snapshot, not a full-chain verdict"
      : "The wider picture is incomplete",
    description: data.coverage.note,
    evidence: [],
    limitation: `${data.source.kind === "sample" ? "This is synthetic example data." : "Imported records and completeness claims are supplied by the file author."} The browser has not independently checked the live chain, transaction authenticity, current confirmations or reorgs.`,
    guidance:
      "Interpret findings within the declared block interval. No matches means only that these rules found none in the supplied records.",
  });
  return { findings, flows, excluded, parameters, ruleVersion: RULE_VERSION };
}

export function simulate(data: Dataset, delayHours: number): Dataset {
  const eligibleExits = new Set(
    analyze(data)
      .flows.filter((f) => f.direction === "deshield")
      .map((f) => f.txid),
  );
  return {
    ...data,
    transactions: data.transactions.map((tx) =>
      eligibleExits.has(tx.txid)
        ? {
            ...tx,
            timestamp: new Date(
              Date.parse(tx.timestamp) + delayHours * 3_600_000,
            ).toISOString(),
          }
        : tx,
    ),
  };
}
