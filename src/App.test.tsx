// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { analyze, type Parameters } from "./core/analyze";
import { sample } from "./core/samples";
import type { Dataset } from "./core/schema";

class PendingWorker {
  static instances: PendingWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  request!: { id: number; dataset: Dataset; parameters: Parameters };
  terminated = false;
  constructor() {
    PendingWorker.instances.push(this);
  }
  postMessage(request: PendingWorker["request"]) {
    this.request = request;
  }
  terminate() {
    this.terminated = true;
  }
  complete() {
    this.onmessage?.({
      data: {
        id: this.request.id,
        result: analyze(this.request.dataset, this.request.parameters),
      },
    });
  }
}

let container: HTMLDivElement;
let root: Root;

function button(name: string) {
  const found = [...container.querySelectorAll("button")].find(
    (element) =>
      element.getAttribute("aria-label") === name ||
      element.textContent?.trim() === name,
  );
  if (!found) throw new Error(`Missing button: ${name}`);
  return found;
}

async function importNewDataset() {
  const data = sample("quiet");
  data.name = "Imported edge case";
  data.source.kind = "import";
  data.transactions = [data.transactions[0]];
  data.transactions[0].txid = "e".repeat(64);
  data.transactions[0].inputs[0].address = null;
  await act(async () => button("Import dataset").click());
  const file = new File([JSON.stringify(data)], "snapshot.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", {
    value: async () => JSON.stringify(data),
  });
  const input = container.querySelector('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () =>
    input.dispatchEvent(new Event("change", { bubbles: true })),
  );
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("Worker", PendingWorker);
  PendingWorker.instances = [];
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<App />));
  await act(async () => PendingWorker.instances[0].complete());
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("analysis belongs to its dataset", () => {
  it("labels the recorded chain snapshot separately from synthetic examples", async () => {
    const select = container.querySelector(
      'select[aria-label="Choose dataset"]',
    ) as HTMLSelectElement;
    await act(async () => {
      select.value = "mainnet-3520054";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => PendingWorker.instances.at(-1)!.complete());
    expect(
      container.querySelector(".dataset-info .small-label")?.textContent,
    ).toBe("RECORDED MAINNET · 16 OCT 2026");
    expect(container.textContent).toContain("Recorded public snapshot");
    expect(container.textContent).not.toContain(
      "A possible round-trip pattern",
    );
    await act(async () =>
      button("Inspect dataset provenance and coverage").click(),
    );
    expect(container.querySelector("dialog")?.textContent).toContain(
      "Bundled public-chain recording · not a live lookup",
    );
    expect(container.querySelector("dialog")?.textContent).toContain(
      "2026-10-16T18:25:03.884Z",
    );
  });

  it("imports disjoint transaction IDs without rendering stale evidence", async () => {
    expect(container.textContent).toContain("A possible round-trip pattern");
    await importNewDataset();
    expect(container.textContent).toContain("Imported edge case");
    expect(container.textContent).not.toContain(
      "A possible round-trip pattern",
    );
    expect(button("Export analysis report").disabled).toBe(true);
    await act(async () => PendingWorker.instances.at(-1)!.complete());
    expect(button("Export analysis report").disabled).toBe(false);
    expect(container.textContent).toContain("The wider picture is incomplete");
  });

  it("ignores a retired worker response after another dataset loads", async () => {
    const retired = PendingWorker.instances[0];
    await importNewDataset();
    expect(retired.terminated).toBe(true);
    await act(async () => retired.complete());
    expect(button("Export analysis report").disabled).toBe(true);
    expect(container.textContent).not.toContain(
      "A possible round-trip pattern",
    );
    await act(async () => PendingWorker.instances.at(-1)!.complete());
    expect(button("Export analysis report").disabled).toBe(false);
  });

  it("disables report export until the current rule settings finish", async () => {
    await act(async () => button("Adjust analysis rules").click());
    const select = container.querySelector(
      "dialog select",
    ) as HTMLSelectElement;
    await act(async () => {
      select.value = "12";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(button("Export analysis report").disabled).toBe(true);
    expect(container.textContent).not.toContain(
      "A possible round-trip pattern",
    );
    await act(async () => PendingWorker.instances.at(-1)!.complete());
    expect(button("Export analysis report").disabled).toBe(false);
    expect(container.textContent).toContain("within 12 hours");
  });

  it("keeps a cancelled worker from publishing a late result", async () => {
    await importNewDataset();
    const pending = PendingWorker.instances.at(-1)!;
    await act(async () => button("Cancel").click());
    await act(async () => pending.complete());
    expect(container.textContent).toContain("Analysis cancelled.");
    expect(button("Export analysis report").disabled).toBe(true);
    expect(pending.terminated).toBe(true);
  });
});
