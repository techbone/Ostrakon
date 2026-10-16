// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TransactionExplorer } from "./TransactionExplorer";
import { analyze } from "../core/analyze";
import { builtInDataset } from "../core/datasets";
import { sample } from "../core/samples";
import type { Dataset } from "../core/schema";

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(
  data = builtInDataset("mainnet-3520054"),
  pending = false,
) {
  const inspect = vi.fn();
  await act(async () =>
    root.render(
      <TransactionExplorer
        data={data}
        analysis={pending ? null : analyze(data)}
        onInspect={inspect}
      />,
    ),
  );
  return inspect;
}
function findButton(text: string) {
  const target = [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  );
  if (!target) throw new Error(`Missing button: ${text}`);
  return target;
}

it("groups a real block without implying a transaction execution order", async () => {
  const data = builtInDataset("mainnet-3520054");
  data.transactions.reverse();
  await render(data);
  expect(container.querySelectorAll(".block-group")).toHaveLength(1);
  expect(container.querySelectorAll(".timeline-record")).toHaveLength(7);
  expect(container.textContent).toContain("not execution or payment order");
  const ids = [...container.querySelectorAll(".timeline-record")].map((row) =>
    row
      .getAttribute("aria-label")!
      .replace("Inspect timeline transaction ", ""),
  );
  expect(ids).toEqual([...ids].sort());
  expect(container.textContent).toContain("1 eligible · 6 excluded · 7 loaded");
});

it("uses block height when the reported clock moves backwards", async () => {
  const data: Dataset = sample("roundtrip");
  data.transactions = data.transactions.slice(0, 2);
  data.transactions[1].timestamp = "2026-10-15T08:00:00Z";
  data.transactions.reverse();
  await render(data);
  expect(
    [...container.querySelectorAll(".block-group")].map((group) =>
      group.getAttribute("aria-label"),
    ),
  ).toEqual(["Block 3500000", "Block 3500012"]);
});

it("combines reason and address filters across views and clears them together", async () => {
  const inspect = await render();
  await act(async () => findButton("No public payout 2").click());
  expect(container.querySelectorAll(".timeline-record")).toHaveLength(2);
  await act(async () =>
    (container.querySelector(".timeline-record") as HTMLButtonElement).click(),
  );
  expect(inspect.mock.calls[0][0].outputs).toEqual([]);
  await act(async () => findButton("Table").click());
  expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "not-in-this-snapshot");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
  expect(container.textContent).toContain("Showing 0 of 7 records");
  await act(async () => findButton("Clear filters").click());
  expect(container.querySelectorAll("tbody tr")).toHaveLength(7);
  expect(input.value).toBe("");
});

it("never labels pending records as eligible or excluded", async () => {
  await render(undefined, true);
  expect(
    [...container.querySelectorAll(".timeline-record .tag")].every(
      (tag) => tag.textContent === "Pending",
    ),
  ).toBe(true);
  expect(
    (
      container.querySelector(
        'select[aria-label="Filter rule eligibility"]',
      ) as HTMLSelectElement
    ).disabled,
  ).toBe(true);
  expect(container.textContent).toContain("Waiting for the current analysis");
});
