import type { Analysis, Finding, Flow } from "../core/analyze";
import { zec } from "../core/schema";

export function FlowGraph({
  analysis,
  selected,
  onTransaction,
}: {
  analysis: Analysis;
  selected?: Finding;
  onTransaction: (id: string) => void;
}) {
  const entries = analysis.flows
    .filter((f) => f.direction === "shield")
    .slice(0, 4);
  const exits = analysis.flows
    .filter((f) => f.direction === "deshield")
    .slice(0, 4);
  const y = (i: number, total: number) =>
    total === 1 ? 220 : 100 + (i * 240) / Math.max(1, total - 1);
  const highlighted = (id: string) => selected?.evidence.includes(id) ?? false;
  const node = (flow: Flow, i: number, count: number, left: boolean) => {
    const px = left ? 24 : 526,
      py = y(i, count);
    return (
      <g
        key={flow.txid}
        className={`flow-node ${highlighted(flow.txid) ? "highlighted" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`Inspect ${flow.direction} transaction ${flow.txid.slice(-6)}, ${zec(flow.valueZat)} ZEC net pool amount`}
        onClick={() => onTransaction(flow.txid)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTransaction(flow.txid);
          }
        }}
      >
        <rect x={px} y={py - 32} width="150" height="72" rx="10" />
        <text x={px + 15} y={py - 9} className="node-label">
          TX · {flow.txid.slice(-6).toUpperCase()}
        </text>
        <text x={px + 15} y={py + 17} className="node-value">
          {zec(flow.valueZat)} <tspan className="node-unit">ZEC</tspan>
        </text>
        <circle
          cx={left ? px + 150 : px}
          cy={py + 4}
          r="4"
          className="node-port"
        />
      </g>
    );
  };
  return (
    <div className="graph-canvas">
      <div className="graph-labels">
        <span>PUBLIC POOL ENTRIES</span>
        <span>PUBLIC POOL EXITS</span>
      </div>
      <svg
        className="flow-svg"
        viewBox="0 0 700 440"
        role="group"
        aria-label="Net pool movements from supplied records. Dashed connections are possible correlations, not traced shielded funds."
      >
        <defs>
          <pattern
            id="dots"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.7" fill="#c9cec5" />
          </pattern>
        </defs>
        <rect width="700" height="440" fill="url(#dots)" />
        {[...entries, ...exits].map((flow) => {
          const left = flow.direction === "shield",
            items = left ? entries : exits,
            i = items.indexOf(flow),
            py = y(i, items.length) + 4;
          return (
            <path
              key={flow.txid}
              className={`observed-path ${highlighted(flow.txid) ? "active-path" : ""}`}
              d={
                left
                  ? `M174 ${py} C240 ${py} 235 224 278 224`
                  : `M422 224 C470 224 460 ${py} 526 ${py}`
              }
            />
          );
        })}
        {selected?.kind === "candidate" &&
          entries
            .filter((f) => f.txid === selected.evidence[0])
            .flatMap((entry) =>
              exits
                .filter((f) => selected.evidence.includes(f.txid))
                .map((exit) => (
                  <path
                    key={exit.txid}
                    className="inferred-path"
                    d={`M174 ${y(entries.indexOf(entry), entries.length) - 15} C265 -14 445 -14 526 ${y(exits.indexOf(exit), exits.length) - 15}`}
                  />
                )),
            )}
        <circle cx="350" cy="224" r="91" className="pool-orbit" />
        <circle cx="350" cy="224" r="74" className="pool-core" />
        <path
          d="m350 181 17 7v12c0 13-17 20-17 20s-17-7-17-20v-12z"
          className="pool-shield"
        />
        <path d="m343 199 5 5 10-12" className="pool-check" />
        <text x="350" y="244" textAnchor="middle" className="pool-title">
          Shielded pools
        </text>
        <text x="350" y="265" textAnchor="middle" className="pool-subtitle">
          INTERNAL FLOWS HIDDEN
        </text>
        {entries.map((f, i) => node(f, i, entries.length, true))}
        {exits.map((f, i) => node(f, i, exits.length, false))}
      </svg>
      <div className="graph-footnote">
        {entries.length + exits.length} of {analysis.flows.length} eligible pool
        movements shown · pools grouped for display
      </div>
    </div>
  );
}
