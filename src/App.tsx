import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  FileJson,
  Fingerprint,
  FlaskConical,
  GitBranch,
  Layers3,
  LockKeyhole,
  Menu,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
  Copy,
  Search,
  AlertCircle,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import {
  analyze,
  defaults,
  RULE_VERSION,
  simulate,
  type Analysis,
  type Finding,
  type Parameters,
} from "./core/analyze";
import {
  MAX_FILE_BYTES,
  parseDataset,
  short,
  zec,
  type Dataset,
  type Transaction,
} from "./core/schema";
import { sample, sampleLabels, type SampleKey } from "./core/samples";
import { FlowGraph } from "./components/FlowGraph";

type View = "overview" | "transactions" | "scenario" | "methodology";
const views = [
  { id: "overview", title: "Overview", icon: ScanLine },
  { id: "transactions", title: "Transactions", icon: GitBranch },
  { id: "scenario", title: "Scenario lab", icon: FlaskConical },
  { id: "methodology", title: "Methodology", icon: BookOpen },
] as const;
const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
const titles: Record<View, [string, string]> = {
  overview: ["Privacy,", "in plain sight."],
  transactions: ["Follow the facts.", "Keep the context."],
  scenario: ["Change a variable.", "Question the result."],
  methodology: ["Evidence first.", "Always."],
};

function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={close}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function App() {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<Dataset>(() => sample("roundtrip"));
  const [sampleKey, setSampleKey] = useState<SampleKey>("roundtrip");
  const [builtIn, setBuiltIn] = useState(true);
  const [parameters, setParameters] = useState<Parameters>(defaults);
  const [completed, setCompleted] = useState<{
    dataset: Dataset;
    parameters: Parameters;
    run: number;
    result: Analysis;
  } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [modal, setModal] = useState<
    "import" | "rules" | "export" | "dataset" | null
  >(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [run, setRun] = useState(0);
  const [delay, setDelay] = useState(12);
  const [filter, setFilter] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isSample = data.source.kind === "sample";
  // Effects run after rendering. Hide old evidence immediately when inputs change.
  const analysis =
    completed?.dataset === data &&
    completed.parameters === parameters &&
    completed.run === run
      ? completed.result
      : null;

  useEffect(() => {
    setCompleted(null);
    setBusy(true);
    setCancelled(false);
    setError("");
    const worker = new Worker(
      new URL("./core/analysis.worker.ts", import.meta.url),
      { type: "module" },
    );
    let active = true;
    workerRef.current = worker;
    worker.onmessage = (event) => {
      if (!active || event.data.id !== run) return;
      setBusy(false);
      if (event.data.error) setError(event.data.error);
      else {
        setCompleted({
          dataset: data,
          parameters,
          run,
          result: event.data.result,
        });
        setSelectedId(event.data.result.findings[0]?.id ?? "");
      }
    };
    worker.onerror = () => {
      if (!active) return;
      setBusy(false);
      setError(
        "The analysis worker could not start. Reload the page to try again.",
      );
    };
    worker.postMessage({ id: run, dataset: data, parameters });
    return () => {
      active = false;
      worker.terminate();
    };
  }, [data, parameters, run]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const selected =
    analysis?.findings.find((f) => f.id === selectedId) ??
    analysis?.findings[0];
  const candidateCount =
    analysis?.findings
      .filter((f) => f.kind === "candidate")
      .reduce((n, f) => n + f.evidence.length - 1, 0) ?? 0;
  const observedCount =
    analysis?.findings.filter((f) => f.kind === "reuse").length ?? 0;
  const compared = useMemo(
    () =>
      view === "scenario" ? analyze(simulate(data, delay), parameters) : null,
    [data, delay, parameters, view],
  );
  const compareCount =
    compared?.findings
      .filter((f) => f.kind === "candidate")
      .reduce((n, f) => n + f.evidence.length - 1, 0) ?? 0;
  const filtered = data.transactions.filter(
    (tx) =>
      tx.txid.includes(filter.toLowerCase()) ||
      [...tx.inputs, ...tx.outputs].some((io) =>
        io.address?.toLowerCase().includes(filter.toLowerCase()),
      ),
  );
  const openTransaction = (id: string) =>
    setTransaction(data.transactions.find((tx) => tx.txid === id) ?? null);
  const changeView = (next: View) => {
    setView(next);
    setMobileNav(false);
  };
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_FILE_BYTES)
        throw new Error("File is too large. Maximum size is 2 MB.");
      const next = parseDataset(await file.text());
      setData(next);
      setTransaction(null);
      setSelectedId("");
      setBuiltIn(false);
      setFilter("");
      setView("overview");
      setModal(null);
      setError("");
      setNotice("Dataset loaded locally. No file contents were uploaded.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to read this file.",
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  function chooseSample(key: SampleKey) {
    setSampleKey(key);
    setBuiltIn(true);
    setData(sample(key));
    setTransaction(null);
    setSelectedId("");
    setFilter("");
    setError("");
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Transaction ID copied.");
    } catch {
      setNotice(
        "Clipboard unavailable. Select and copy the transaction ID manually.",
      );
    }
  }
  const findingIcon = (f: Finding) =>
    f.kind === "candidate" ? (
      <GitBranch size={17} />
    ) : f.kind === "reuse" ? (
      <Fingerprint size={17} />
    ) : (
      <Layers3 size={17} />
    );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeView("overview");
          }}
          aria-label="Ostrakon home"
        >
          <img src="/favicon.svg" alt="" />
          <span>
            ostrakon<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">
          WORKSPACE <span>01</span>
        </div>
        <nav aria-label="Workspace">
          {views.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => changeView(id)}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{title}</span>
              {view === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="sidebar-note-icon">
            <ShieldCheck size={21} />
          </div>
          <strong>Your data stays yours.</strong>
          <p>
            Local analysis. No accounts.
            <br />
            No keys. No uploads.
          </p>
          <button onClick={() => changeView("methodology")}>
            How it works <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="status-dot" /> LOCAL WORKSPACE{" "}
          <span className="version">v0.1</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>Privacy X-ray</strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <LockKeyhole size={12} /> Browser-local analysis
            </span>
            <button
              className="icon-button"
              aria-label="Read methodology"
              onClick={() => changeView("methodology")}
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main id="main" className="content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> ZCASH PRIVACY WORKBENCH
              </div>
              <h1>
                {titles[view][0]} <em>{titles[view][1]}</em>
              </h1>
              <p>
                {view === "overview"
                  ? "See what is visible. Understand what is only a possibility."
                  : view === "transactions"
                    ? "Every conclusion starts with a record. Inspect the details behind yours."
                    : view === "scenario"
                      ? "Explore a timing heuristic. A different result is not a privacy guarantee."
                      : "Transparent rules. Explicit boundaries. No invented anonymity score."}
              </p>
            </div>
            <span className="edition">
              FIELDNOTES
              <br />
              <b>001 / ZCASH</b>
            </span>
          </section>
          {notice && (
            <div className="toast" role="status">
              <Check size={16} />
              {notice}
            </div>
          )}
          {error && modal !== "import" && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {view !== "methodology" && (
            <section className="dataset-bar" aria-label="Dataset controls">
              <div className="dataset-info">
                <div className="dataset-icon">
                  <FileJson size={21} />
                </div>
                <div>
                  <span className="small-label">
                    {isSample
                      ? "LEARNING EXAMPLE · SYNTHETIC DATA"
                      : "LOCAL IMPORT · UNVERIFIED SNAPSHOT"}
                  </span>
                  {isSample && builtIn ? (
                    <div className="select-wrap">
                      <select
                        aria-label="Choose learning example"
                        value={sampleKey}
                        onChange={(e) =>
                          chooseSample(e.target.value as SampleKey)
                        }
                      >
                        {Object.entries(sampleLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  ) : (
                    <strong className="dataset-name">{data.name}</strong>
                  )}
                </div>
              </div>
              <div className="dataset-actions">
                <button
                  className="button secondary"
                  onClick={() => {
                    setError("");
                    setModal("import");
                  }}
                >
                  <Upload size={15} />
                  Import dataset
                </button>
                <button
                  className="button icon-only"
                  title="Export analysis report"
                  aria-label="Export analysis report"
                  disabled={!analysis}
                  onClick={() => setModal("export")}
                >
                  <Download size={17} />
                </button>
              </div>
            </section>
          )}
          {busy && (
            <div className="busy" role="status">
              <Activity size={16} />
              Analyzing records locally…{" "}
              <button
                onClick={() => {
                  const worker = workerRef.current;
                  if (worker) {
                    worker.onmessage = null;
                    worker.onerror = null;
                    worker.terminate();
                    workerRef.current = null;
                  }
                  setBusy(false);
                  setCancelled(true);
                }}
              >
                Cancel
              </button>
            </div>
          )}
          {cancelled && (
            <div className="busy">
              Analysis cancelled.{" "}
              <button onClick={() => setRun(run + 1)}>Run again</button>
            </div>
          )}
          {view === "overview" && analysis && (
            <>
              <section className="metrics" aria-label="Analysis summary">
                <div className="metric">
                  <div className="metric-title">
                    Observed patterns <Fingerprint size={16} />
                  </div>
                  <div className="metric-number">
                    {observedCount.toString().padStart(2, "0")}{" "}
                    <span className="tag green">IN THE DATA</span>
                  </div>
                  <p>Repeated transparent address appearances</p>
                </div>
                <div className="metric">
                  <div className="metric-title">
                    Possible correlations <GitBranch size={16} />
                  </div>
                  <div className="metric-number">
                    {candidateCount.toString().padStart(2, "0")}{" "}
                    <span className="tag amber">HEURISTIC</span>
                  </div>
                  <p>Amount & timing matches, not proven links</p>
                </div>
                <button
                  className="metric metric-coverage"
                  aria-label="Inspect dataset provenance and coverage"
                  onClick={() => setModal("dataset")}
                >
                  <div className="metric-title">
                    Dataset coverage <Layers3 size={16} />
                  </div>
                  <div className="metric-number word">
                    {data.coverage.complete ? "Declared complete" : "Partial"}
                    <span className="coverage-dots">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                  <p>
                    {data.transactions.length} records · no live-chain
                    verification
                  </p>
                </button>
              </section>
              <div className="workbench-grid">
                <section className="panel flow-panel">
                  <div className="panel-header">
                    <div>
                      <h2>The visible trail</h2>
                      <p>What the records show. What they leave unsaid.</p>
                    </div>
                    <button
                      className="icon-button outlined"
                      aria-label="Adjust analysis rules"
                      onClick={() => setModal("rules")}
                    >
                      <SlidersHorizontal size={17} />
                    </button>
                  </div>
                  <FlowGraph
                    analysis={analysis}
                    selected={selected}
                    onTransaction={openTransaction}
                  />
                  <div className="graph-legend">
                    <span>
                      <i className="line-solid" />
                      Recorded pool movement
                    </span>
                    <span>
                      <i className="line-dashed" />
                      Possible correlation
                    </span>
                    <button
                      onClick={() => changeView("methodology")}
                      aria-label="Explain graph"
                    >
                      <CircleHelp size={15} />
                    </button>
                  </div>
                </section>
                <section className="panel findings-panel">
                  <div className="panel-header">
                    <div>
                      <h2>
                        Read the signals{" "}
                        <span className="count">
                          {analysis.findings.length}
                        </span>
                      </h2>
                      <p>Select a finding to see its evidence.</p>
                    </div>
                  </div>
                  <div className="finding-list">
                    {analysis.findings.slice(0, 100).map((f) => (
                      <button
                        key={f.id}
                        className={`finding-item ${selected?.id === f.id ? "selected" : ""}`}
                        onClick={() => setSelectedId(f.id)}
                      >
                        <span className={`finding-icon ${f.kind}`}>
                          {findingIcon(f)}
                        </span>
                        <span>
                          <small>
                            {f.kind === "candidate"
                              ? "POSSIBLE CORRELATION"
                              : f.kind === "reuse"
                                ? "OBSERVED PATTERN"
                                : "COVERAGE LIMIT"}
                          </small>
                          <strong>{f.title}</strong>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                    {analysis.findings.length > 100 && (
                      <p className="muted">
                        Showing 100 findings. Export the report for all results.
                      </p>
                    )}
                  </div>
                  {selected && (
                    <div className="finding-detail">
                      <span className="small-label">WHY THIS APPEARED</span>
                      <p>{selected.description}</p>
                      {selected.address && (
                        <code className="address-detail">
                          {selected.address}
                        </code>
                      )}
                      <div className="caution">
                        <AlertCircle size={15} />
                        <p>{selected.limitation}</p>
                      </div>
                      <button
                        className="text-link"
                        onClick={() => {
                          document
                            .getElementById("evidence")
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Inspect the evidence <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </section>
              </div>
              <section id="evidence" className="panel evidence-panel">
                <div className="panel-header">
                  <div>
                    <div className="small-label">
                      FROM SIGNAL TO UNDERSTANDING
                    </div>
                    <h2>
                      {selected?.kind === "coverage"
                        ? "Know the boundary of this analysis"
                        : "A little context changes the story."}
                    </h2>
                  </div>
                  <span className="step-mark">↳</span>
                </div>
                <div className="evidence-grid">
                  <div>
                    <span className="small-label">WHAT YOU CAN DO</span>
                    <p>{selected?.guidance}</p>
                    <button
                      className="text-link"
                      onClick={() => changeView("scenario")}
                    >
                      Explore a different scenario <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="evidence-records">
                    <span className="small-label">SUPPORTING RECORDS</span>
                    {selected?.evidence.length ? (
                      selected.evidence.slice(0, 8).map((id) => (
                        <button key={id} onClick={() => openTransaction(id)}>
                          <FileJson size={14} />
                          <code>{short(id)}</code>
                          <span>
                            {fmtTime(
                              data.transactions.find((tx) => tx.txid === id)!
                                .timestamp,
                            )}{" "}
                            UTC
                          </span>
                          <ArrowUpRight size={14} />
                        </button>
                      ))
                    ) : (
                      <p>
                        No individual transaction establishes dataset
                        completeness.
                      </p>
                    )}
                    {selected && selected.evidence.length > 8 && (
                      <p>
                        + {selected.evidence.length - 8} records in the exported
                        report.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
          {view === "transactions" && (
            <section className="panel transaction-panel">
              <div className="panel-header">
                <div>
                  <h2>
                    The transaction notebook{" "}
                    <span className="count">{filtered.length}</span>
                  </h2>
                  <p>
                    Block times are approximate. Amounts are exact zatoshi
                    conversions.
                  </p>
                </div>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    placeholder="Filter ID or address"
                    aria-label="Filter transactions"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Transaction</th>
                      <th>Block</th>
                      <th>Time · UTC</th>
                      <th>Pool movement</th>
                      <th>Rule eligibility</th>
                      <th>
                        <span className="sr-only">Inspect</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tx) => (
                      <tr key={tx.txid}>
                        <td>
                          <button
                            className="tx-link"
                            onClick={() => setTransaction(tx)}
                          >
                            <FileJson size={15} />
                            <code>{short(tx.txid)}</code>
                          </button>
                        </td>
                        <td>{tx.blockHeight.toLocaleString()}</td>
                        <td>{fmtTime(tx.timestamp)}</td>
                        <td>
                          {tx.poolDeltas.length === 1 ? (
                            <span className="movement">
                              {BigInt(tx.poolDeltas[0].valueZat) > 0n ? (
                                <ArrowDownLeft size={14} />
                              ) : (
                                <ArrowUpRight size={14} />
                              )}
                              {zec(tx.poolDeltas[0].valueZat)} ZEC
                              <span>{tx.poolDeltas[0].pool}</span>
                            </span>
                          ) : tx.poolDeltas.length ? (
                            "Multiple pools"
                          ) : (
                            "Transparent"
                          )}
                        </td>
                        <td>
                          <span
                            className={`tag ${analysis?.flows.some((f) => f.txid === tx.txid) ? "green" : "neutral"}`}
                          >
                            {analysis
                              ? analysis.flows.some((f) => f.txid === tx.txid)
                                ? "ELIGIBLE"
                                : "EXCLUDED"
                              : "PENDING"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Inspect transaction ${tx.txid.slice(-6)}`}
                            onClick={() => setTransaction(tx)}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="empty-state">
                    <Search size={28} />
                    <h3>No matching records</h3>
                    <p>Try a shorter transaction ID or address.</p>
                    <button
                      className="button secondary"
                      onClick={() => setFilter("")}
                    >
                      Clear filter
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
          {view === "scenario" && analysis && compared && (
            <section className="scenario-layout">
              <div className="panel scenario-controls">
                <span className="tag amber">
                  <FlaskConical size={12} /> HYPOTHETICAL ONLY
                </span>
                <h2>
                  What if the exits
                  <br />
                  happened later?
                </h2>
                <p>
                  Shift eligible pool-exit timestamps in a copy of this dataset.
                  Everything else stays fixed.
                </p>
                <label className="slider-label" htmlFor="delay">
                  Additional delay <strong>{delay} hours</strong>
                </label>
                <input
                  id="delay"
                  type="range"
                  min="0"
                  max="48"
                  step="1"
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                />
                <div className="slider-ends">
                  <span>0 hours</span>
                  <span>48 hours</span>
                </div>
                <button className="text-link" onClick={() => setDelay(0)}>
                  <RotateCcw size={14} />
                  Reset to original timing
                </button>
                <hr />
                <span className="small-label">FIXED RULE</span>
                <p>
                  {parameters.windowHours}-hour window,{" "}
                  {zec(parameters.toleranceZat)} ZEC amount tolerance.
                </p>
                <button
                  className="button secondary"
                  onClick={() => setModal("rules")}
                >
                  <SlidersHorizontal size={15} />
                  Adjust rule
                </button>
              </div>
              <div className="panel scenario-result">
                <div className="panel-header">
                  <div>
                    <h2>Same data. One changed assumption.</h2>
                    <p>This model only evaluates the amount/time rule.</p>
                  </div>
                </div>
                <div className="comparison">
                  <div>
                    <span>Original snapshot</span>
                    <strong>{candidateCount}</strong>
                    <small>
                      candidate match{candidateCount === 1 ? "" : "es"}
                    </small>
                  </div>
                  <ArrowRight size={27} />
                  <div>
                    <span>Hypothetical timing</span>
                    <strong>{compareCount}</strong>
                    <small>
                      candidate match{compareCount === 1 ? "" : "es"}
                    </small>
                  </div>
                </div>
                <div className="scenario-timeline">
                  <div>
                    <span className="timeline-pin" />
                    <b>Pool entry</b>
                    <span>Original timestamp</span>
                  </div>
                  <div className="timeline-track" />
                  <div>
                    <span className="timeline-pin terracotta" />
                    <b>Pool exit</b>
                    <span>Shifted by {delay}h</span>
                  </div>
                </div>
                <div className="scenario-explainer">
                  <h3>
                    {compareCount < candidateCount
                      ? "Fewer matches. Not proof of privacy."
                      : "A heuristic has a limited view."}
                  </h3>
                  <p>
                    Changing a timestamp can move a transaction outside this
                    rule’s window. An observer can use a wider window, other
                    records, or other heuristics. Public addresses remain
                    public. This is an educational comparison, not a payment
                    recommendation.
                  </p>
                  <span>
                    <LockKeyhole size={14} />
                    Your original dataset has not changed.
                  </span>
                </div>
              </div>
            </section>
          )}
          {view === "methodology" && (
            <section className="methodology">
              <div className="panel method-intro">
                <ShieldCheck size={30} />
                <h2>
                  Useful insight starts
                  <br />
                  with honest limits.
                </h2>
                <p>
                  Ostrakon analyzes records you supply. It doesn’t decrypt
                  shielded activity, identify people, or certify anonymity.
                </p>
                <span className="tag green">
                  RULE ENGINE · {analysis?.ruleVersion ?? RULE_VERSION}
                </span>
              </div>
              <div className="method-cards">
                {[
                  [
                    "01",
                    "Observed is not inferred",
                    "Repeated transparent address appearances are facts within the supplied records. Similar pool amounts and close timestamps suggest a possible relationship. They cannot establish shared ownership.",
                  ],
                  [
                    "02",
                    "Small rules, explicit exclusions",
                    "The round-trip rule compares balanced, single-pool entries without transparent change to exits with one transparent output. It excludes unresolved inputs, migrations, batched payouts, unsupported versions and low-confirmation records. Fees are included in net pool movements.",
                  ],
                  [
                    "03",
                    "A local snapshot has boundaries",
                    "No live provider is connected. Imported data, block hashes and confirmation counts are not independently verified. A completeness claim comes from the file, not a chain scan. Reported findings can change after a reorg or when more records are included.",
                  ],
                  [
                    "04",
                    "No invisible data collection",
                    "Analysis runs in a browser worker. Files remain in memory and disappear on refresh. There are no analytics, accounts, remote fonts or viewing-key inputs. Exports contain transaction and address data; share them deliberately.",
                  ],
                ].map(([n, title, body]) => (
                  <article key={n} className="panel method-card">
                    <span>{n}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="panel sources">
                <h3>Research & format</h3>
                <p>
                  The historical research motivates the heuristic; it does not
                  measure today’s Ironwood privacy or validate this
                  implementation.
                </p>
                <a
                  href="https://arxiv.org/abs/1712.01210"
                  target="_blank"
                  rel="noreferrer"
                >
                  On the linkability of Zcash transactions · 2017{" "}
                  <ExternalLink size={14} />
                </a>
                <a href="/DATA_FORMAT.md" target="_blank" rel="noreferrer">
                  Ostrakon dataset format · v1 <ExternalLink size={14} />
                </a>
                <a
                  href="https://github.com/techbone/Ostrakon/blob/main/docs/NODE_EXPORT.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Export a snapshot from your node <ExternalLink size={14} />
                </a>
                <button
                  className="text-link"
                  onClick={() => {
                    download(sample("roundtrip"), "ostrakon-example.json");
                  }}
                >
                  Download a synthetic example <Download size={14} />
                </button>
              </div>
            </section>
          )}
          <footer className="footer">
            <span>
              <img src="/favicon.svg" alt="" /> Made for privacy. Built on
              evidence.
            </span>
            <span>
              {view === "methodology"
                ? "No keys. No accounts."
                : `${isSample ? "Synthetic example" : "Unverified local import"} · ${data.network} format`}{" "}
              <i /> All analysis stays local
            </span>
          </footer>
        </main>
      </div>
      {modal === "dataset" && (
        <Modal title="Know your source" close={() => setModal(null)}>
          <p className="modal-intro">{data.coverage.note}</p>
          <dl className="provenance">
            <dt>Dataset</dt>
            <dd>{data.name}</dd>
            <dt>Source label</dt>
            <dd>{data.source.label}</dd>
            <dt>Origin</dt>
            <dd>
              {builtIn ? "Built-in synthetic example" : "File imported locally"}
            </dd>
            <dt>Network format</dt>
            <dd>{data.network}</dd>
            <dt>Declared block interval</dt>
            <dd>
              {data.coverage.fromHeight.toLocaleString()} –{" "}
              {data.coverage.toHeight.toLocaleString()}
            </dd>
            <dt>Declared retrieval time</dt>
            <dd>{new Date(data.source.retrievedAt).toISOString()}</dd>
            <dt>Coverage claim</dt>
            <dd>
              {data.coverage.complete
                ? "File author declares complete"
                : "Partial"}
            </dd>
            <dt>Verification</dt>
            <dd>
              None. No chain inclusion, live confirmations, or reorg checks.
            </dd>
          </dl>
          <div className="caution">
            <AlertCircle size={16} />
            <p>
              {isSample
                ? "Synthetic identifiers and amounts are for education only."
                : "These metadata and transaction records are supplied by the file author. They are not independent evidence of authenticity."}
            </p>
          </div>
        </Modal>
      )}
      {modal === "import" && (
        <Modal
          title="Bring your own dataset"
          close={() => {
            setModal(null);
            setError("");
          }}
        >
          <p className="modal-intro">
            Analyze an Ostrakon v1 JSON file locally. Do not import a wallet
            backup, seed phrase, or viewing key.
          </p>
          <div className="node-import-guide">
            <FileJson size={19} />
            <div>
              <strong>Start with a snapshot from your node</strong>
              <p>
                The optional exporter reads a small block range into a local
                JSON file. Your node connection stays outside this tab.
              </p>
              <a
                href="https://github.com/techbone/Ostrakon/blob/main/docs/NODE_EXPORT.md"
                target="_blank"
                rel="noreferrer"
              >
                Read the export guide <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
          <button
            className="dropzone"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void importFile(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={28} />
            <strong>Choose a file or drop it here</strong>
            <span>JSON · up to 2 MB · 200 transactions</span>
          </button>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept=".json,application/json"
            aria-label="Choose dataset file"
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <div className="import-options">
            <a href="/DATA_FORMAT.md" target="_blank" rel="noreferrer">
              Read the format <ArrowUpRight size={14} />
            </a>
            <button
              onClick={() =>
                download(sample("roundtrip"), "ostrakon-example.json")
              }
            >
              Download example <Download size={14} />
            </button>
          </div>
          <div className="caution">
            <LockKeyhole size={16} />
            <p>
              The file stays in this tab. Imported records are not proof of
              chain inclusion. Live address lookup is not available in this
              release.
            </p>
          </div>
          {!builtIn && (
            <button
              className="text-link"
              onClick={() => {
                chooseSample("roundtrip");
                setModal(null);
              }}
            >
              Return to learning examples <ArrowRight size={14} />
            </button>
          )}
        </Modal>
      )}
      {modal === "rules" && (
        <Modal
          title="Make the assumptions visible"
          close={() => setModal(null)}
        >
          <p className="modal-intro">
            These thresholds define candidate matches. They are not confidence
            levels or validated anonymity measures.
          </p>
          <label className="form-label">
            Time window
            <select
              value={parameters.windowHours}
              onChange={(e) =>
                setParameters({
                  ...parameters,
                  windowHours: Number(e.target.value),
                })
              }
            >
              {[1, 3, 6, 12, 24, 48, 168].map((n) => (
                <option key={n} value={n}>
                  {n} hours
                </option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Net pool amount tolerance
            <select
              value={parameters.toleranceZat}
              onChange={(e) =>
                setParameters({ ...parameters, toleranceZat: e.target.value })
              }
            >
              {["0", "1000", "10000", "100000", "1000000"].map((n) => (
                <option key={n} value={n}>
                  {zec(n)} ZEC{n === "0" ? " · exact match" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="caution">
            <AlertCircle size={16} />
            <p>
              Wider thresholds can produce more false positives. Matching net
              pool movement does not reveal a hidden note’s value.
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setParameters(defaults)}
            >
              Reset defaults
            </button>
            <button className="button primary" onClick={() => setModal(null)}>
              Done <Check size={15} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "export" && (
        <Modal title="Take the evidence with you" close={() => setModal(null)}>
          <p className="modal-intro">
            Your JSON report includes the original dataset, analysis parameters,
            findings, exclusions, and limitations. It may contain financial
            activity and addresses.
          </p>
          <div className="caution">
            <LockKeyhole size={16} />
            <p>
              The download is local. Anyone you share the file with can read its
              contents.
            </p>
          </div>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              onClick={() => {
                download(
                  {
                    reportVersion: 1,
                    generatedAt: new Date().toISOString(),
                    verification:
                      "Unverified snapshot; no live chain or reorg validation",
                    dataset: data,
                    analysis,
                  },
                  "ostrakon-report.json",
                );
                setModal(null);
                setNotice(
                  "Report downloaded. It includes the underlying transaction data.",
                );
              }}
            >
              <Download size={16} />
              Download report
            </button>
          </div>
        </Modal>
      )}
      {transaction && (
        <Modal title="Inspect the record" close={() => setTransaction(null)}>
          <div className="tx-id">
            <span className="small-label">TRANSACTION ID</span>
            <code>{transaction.txid}</code>
            <button
              className="icon-button"
              aria-label="Copy transaction ID"
              onClick={() => void copy(transaction.txid)}
            >
              <Copy size={16} />
            </button>
          </div>
          <div className="tx-meta">
            <div>
              <span>Block</span>
              <strong>{transaction.blockHeight.toLocaleString()}</strong>
            </div>
            <div>
              <span>Timestamp</span>
              <strong>
                {new Date(transaction.timestamp)
                  .toISOString()
                  .slice(0, 16)
                  .replace("T", " ")}{" "}
                UTC
              </strong>
            </div>
            <div>
              <span>Version</span>
              <strong>v{transaction.version}</strong>
            </div>
            <div>
              <span>Fee</span>
              <strong>
                {transaction.feeZat === null
                  ? "Unknown"
                  : `${zec(transaction.feeZat)} ZEC`}
              </strong>
            </div>
          </div>
          <div className="tx-io">
            {(["inputs", "outputs"] as const).map((kind) => (
              <div key={kind}>
                <span className="small-label">
                  TRANSPARENT {kind.toUpperCase()}
                </span>
                {transaction[kind].length ? (
                  transaction[kind].map((io, i) => (
                    <div className="io-row" key={i}>
                      <code>{io.address ?? "No single decoded address"}</code>
                      <strong>
                        {io.valueZat === null
                          ? "Unknown"
                          : `${zec(io.valueZat)} ZEC`}
                      </strong>
                    </div>
                  ))
                ) : (
                  <p>None in this record.</p>
                )}
              </div>
            ))}
          </div>
          <div className="caution">
            <AlertCircle size={16} />
            <p>
              {analysis?.excluded.find((x) => x.txid === transaction.txid)
                ?.reason ??
                "Eligible for the simple pool amount/time rule. Eligibility is not a statement about ownership."}{" "}
              All fields come from the loaded snapshot.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              download(transaction, "ostrakon-transaction.json");
            }}
          >
            <Download size={15} />
            Export this record
          </button>
        </Modal>
      )}
    </div>
  );
}
