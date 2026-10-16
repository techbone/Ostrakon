import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  FileJson,
  List,
  Search,
} from "lucide-react";
import type { Analysis } from "../core/analyze";
import { exclusionReasons, type ExclusionCode } from "../core/exclusions";
import { short, zec, type Dataset, type Transaction } from "../core/schema";

type Scope = "all" | "eligible" | "excluded";
const blockTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });
function movement(tx: Transaction) {
  if (tx.coinbase) return "Mining reward · public record";
  if (!tx.poolDeltas.length) return "No net shielded pool movement recorded";
  if (tx.poolDeltas.length > 1) return "Multiple net pool movements";
  const delta = tx.poolDeltas[0];
  return `${zec(BigInt(delta.valueZat) < 0n ? -BigInt(delta.valueZat) : BigInt(delta.valueZat))} ZEC net ${BigInt(delta.valueZat) > 0n ? "into" : "out of"} ${delta.pool}`;
}

export function TransactionExplorer({
  data,
  analysis,
  onInspect,
}: {
  data: Dataset;
  analysis: Analysis | null;
  onInspect: (tx: Transaction) => void;
}) {
  const [mode, setMode] = useState<"timeline" | "table">("timeline");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [reason, setReason] = useState<ExclusionCode | null>(null);
  const ordered = useMemo(
    () =>
      [...data.transactions].sort(
        (a, b) => a.blockHeight - b.blockHeight || a.txid.localeCompare(b.txid),
      ),
    [data],
  );
  const excluded = new Map(
    analysis?.excluded.map((item) => [item.txid, item]) ?? [],
  );
  const eligible = new Set(analysis?.flows.map((flow) => flow.txid) ?? []);
  const counts = new Map<ExclusionCode, number>();
  for (const item of analysis?.excluded ?? [])
    counts.set(item.code, (counts.get(item.code) ?? 0) + 1);
  // Pending runs show all records, never classifications from a retired result.
  const activeScope = analysis ? scope : "all";
  const activeReason = analysis ? reason : null;
  const term = query.trim().toLowerCase();
  const visible = ordered.filter(
    (tx) =>
      (activeScope === "all" ||
        (activeScope === "eligible"
          ? eligible.has(tx.txid)
          : excluded.has(tx.txid))) &&
      (!activeReason || excluded.get(tx.txid)?.code === activeReason) &&
      (!term ||
        tx.txid.includes(term) ||
        [...tx.inputs, ...tx.outputs].some((io) =>
          io.address?.toLowerCase().includes(term),
        )),
  );
  const groups = new Map<number, Transaction[]>();
  const totals = new Map<number, number>();
  for (const tx of ordered)
    totals.set(tx.blockHeight, (totals.get(tx.blockHeight) ?? 0) + 1);
  for (const tx of visible)
    groups.set(tx.blockHeight, [...(groups.get(tx.blockHeight) ?? []), tx]);
  const filtered = Boolean(term || activeScope !== "all" || activeReason);
  const reset = () => {
    setQuery("");
    setScope("all");
    setReason(null);
  };
  const eligibility = (tx: Transaction) =>
    analysis ? (eligible.has(tx.txid) ? "Eligible" : "Excluded") : "Pending";

  return (
    <section
      className="panel transaction-panel"
      aria-label="Transaction explorer"
    >
      <div className="panel-header">
        <div>
          <h2>
            The transaction notebook{" "}
            <span className="count">{data.transactions.length}</span>
          </h2>
          <p>Follow the block record. Understand the rule’s boundaries.</p>
        </div>
        <div
          className="record-view-toggle"
          role="group"
          aria-label="Record view"
        >
          <button
            aria-pressed={mode === "timeline"}
            onClick={() => setMode("timeline")}
          >
            <Clock3 size={15} /> Timeline
          </button>
          <button
            aria-pressed={mode === "table"}
            onClick={() => setMode("table")}
          >
            <List size={15} /> Table
          </button>
        </div>
      </div>
      <div className="rule-coverage" aria-label="Amount and time rule coverage">
        <div className="rule-coverage-heading">
          <strong>Which records can this rule compare?</strong>
          <span>
            {analysis
              ? `${eligible.size} eligible · ${excluded.size} excluded · ${data.transactions.length} loaded`
              : "Waiting for the current analysis"}
          </span>
        </div>
        {analysis && (
          <div
            className="reason-filters"
            role="group"
            aria-label="Filter exclusion reason"
          >
            {[...counts]
              .sort(([a], [b]) =>
                exclusionReasons[a].label.localeCompare(
                  exclusionReasons[b].label,
                ),
              )
              .map(([code, count]) => (
                <button
                  key={code}
                  aria-pressed={reason === code}
                  onClick={() => {
                    setReason(reason === code ? null : code);
                    setScope(reason === code ? "all" : "excluded");
                  }}
                >
                  {exclusionReasons[code].label} <span>{count}</span>
                </button>
              ))}
          </div>
        )}
        <p>
          First exclusion reason per record. Excluded records can still
          contribute to other findings; exclusion is not a privacy verdict.
        </p>
      </div>
      <div className="record-filters">
        <label className="search-field">
          <Search size={16} />
          <input
            placeholder="Filter ID or address"
            aria-label="Filter transactions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="record-scope">
          Rule eligibility
          <select
            aria-label="Filter rule eligibility"
            value={activeScope}
            disabled={!analysis}
            onChange={(e) => {
              setScope(e.target.value as Scope);
              setReason(null);
            }}
          >
            <option value="all">All records</option>
            <option value="eligible">Eligible</option>
            <option value="excluded">Excluded</option>
          </select>
        </label>
        {filtered && (
          <button className="text-link" onClick={reset}>
            Clear filters
          </button>
        )}
      </div>
      <div className="record-results" role="status" aria-live="polite">
        Showing {visible.length} of {data.transactions.length} records
        {activeReason ? ` · ${exclusionReasons[activeReason].label}` : ""}
      </div>
      {mode === "timeline" && (
        <div className="block-timeline">
          <p className="timeline-note">
            Ordered by block height, not elapsed time. Block timestamps can move
            backwards. Records within a block share its approximate timestamp
            and are listed by ID, not execution or payment order.
          </p>
          {[...groups].map(([height, records]) => (
            <section
              className="block-group"
              key={height}
              aria-label={`Block ${height}`}
            >
              <div className="block-marker">
                <span className="block-dot" />
                <div>
                  <h3>Block {height.toLocaleString()}</h3>
                  <time dateTime={records[0].timestamp}>
                    {blockTime(records[0].timestamp)} UTC
                  </time>
                </div>
                <span>
                  {records.length} of {totals.get(height)} records
                </span>
              </div>
              <div className="block-records">
                {records.map((tx) => (
                  <button
                    key={tx.txid}
                    className={`timeline-record ${eligible.has(tx.txid) ? "eligible" : ""}`}
                    aria-label={`Inspect timeline transaction ${tx.txid}`}
                    onClick={() => onInspect(tx)}
                  >
                    <span className="timeline-record-icon">
                      {analysis?.flows.find((f) => f.txid === tx.txid)
                        ?.direction === "shield" ? (
                        <ArrowDownLeft size={17} />
                      ) : eligible.has(tx.txid) ? (
                        <ArrowUpRight size={17} />
                      ) : (
                        <FileJson size={17} />
                      )}
                    </span>
                    <span className="timeline-record-body">
                      <span className="timeline-record-heading">
                        <code>{short(tx.txid)}</code>
                        <span
                          className={`tag ${eligible.has(tx.txid) ? "green" : "neutral"}`}
                        >
                          {eligibility(tx)}
                        </span>
                      </span>
                      <strong>{movement(tx)}</strong>
                      <span>
                        {excluded.get(tx.txid)?.reason ??
                          (analysis
                            ? "Available for amount/time comparisons. Eligibility does not establish a relationship."
                            : "Analysis pending; these are supplied snapshot fields.")}
                      </span>
                    </span>
                    <ArrowUpRight size={16} className="timeline-open" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {mode === "table" && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Block</th>
                <th>Block time · UTC</th>
                <th>Net pool movement</th>
                <th>Rule eligibility</th>
                <th>First exclusion reason</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((tx) => (
                <tr key={tx.txid}>
                  <td>
                    <button
                      className="tx-link"
                      aria-label={`Inspect table transaction ${tx.txid}`}
                      onClick={() => onInspect(tx)}
                    >
                      <FileJson size={15} />
                      <code>{short(tx.txid)}</code>
                    </button>
                  </td>
                  <td>{tx.blockHeight.toLocaleString()}</td>
                  <td>
                    <time dateTime={tx.timestamp}>
                      {blockTime(tx.timestamp)}
                    </time>
                  </td>
                  <td>{movement(tx)}</td>
                  <td>
                    <span
                      className={`tag ${eligible.has(tx.txid) ? "green" : "neutral"}`}
                    >
                      {eligibility(tx)}
                    </span>
                  </td>
                  <td>
                    {excluded.has(tx.txid)
                      ? exclusionReasons[excluded.get(tx.txid)!.code].label
                      : analysis
                        ? "—"
                        : "Pending"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!visible.length && (
        <div className="empty-state">
          <Search size={28} />
          <h3>No matching records</h3>
          <p>Try another ID, address or rule filter.</p>
          <button className="button secondary" onClick={reset}>
            Show all records
          </button>
        </div>
      )}
    </section>
  );
}
