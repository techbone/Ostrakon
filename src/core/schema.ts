import { z } from "zod";

export const MAX_FILE_BYTES = 2_000_000;
const hash = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "Expected a lowercase 64-character hash");
const maxZat = 2_100_000_000_000_000n;
const amount = z
  .string()
  .regex(/^(0|[1-9]\d{0,15})$/)
  .pipe(
    z
      .string()
      .refine((v) => BigInt(v) <= maxZat, "Amount exceeds Zcash supply"),
  );
const signedAmount = z
  .string()
  .regex(/^-?[1-9]\d{0,15}$/)
  .pipe(
    z.string().refine((v) => {
      const n = BigInt(v);
      return n >= -maxZat && n <= maxZat;
    }),
  );
const timestamp = z
  .string()
  .max(64)
  .datetime({ offset: true })
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid timestamp");
const io = z
  .object({
    address: z.string().min(1).max(128).nullable(),
    valueZat: amount.nullable(),
  })
  .strict();
export const transactionSchema = z
  .object({
    txid: hash,
    blockHeight: z.number().int().nonnegative().max(100_000_000),
    blockHash: hash,
    timestamp,
    version: z.number().int().min(1).max(100),
    confirmations: z.number().int().nonnegative(),
    coinbase: z.boolean(),
    feeZat: amount.nullable(),
    inputs: z.array(io).max(16),
    outputs: z.array(io).max(16),
    poolDeltas: z
      .array(
        z
          .object({
            pool: z.enum(["sapling", "orchard", "ironwood"]),
            valueZat: signedAmount,
          })
          .strict(),
      )
      .max(3),
  })
  .strict()
  .superRefine((tx, ctx) => {
    if (new Set(tx.poolDeltas.map((p) => p.pool)).size !== tx.poolDeltas.length)
      ctx.addIssue({
        code: "custom",
        message: "Each pool may appear only once",
        path: ["poolDeltas"],
      });
  });

export const datasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().min(1).max(100),
    network: z.enum(["mainnet", "testnet"]),
    source: z
      .object({
        kind: z.enum(["sample", "import"]),
        label: z.string().min(1).max(100),
        retrievedAt: timestamp,
      })
      .strict(),
    coverage: z
      .object({
        fromHeight: z.number().int().nonnegative(),
        toHeight: z.number().int().nonnegative(),
        complete: z.boolean(),
        note: z.string().min(1).max(500),
      })
      .strict(),
    transactions: z.array(transactionSchema).min(1).max(200),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.coverage.fromHeight > data.coverage.toHeight)
      ctx.addIssue({
        code: "custom",
        message: "Invalid coverage interval",
        path: ["coverage"],
      });
    if (
      new Set(data.transactions.map((t) => t.txid)).size !==
      data.transactions.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate transaction IDs",
        path: ["transactions"],
      });
    const blocks = new Map<number, { hash: string; time: number }>();
    const heights = new Map<string, number>();
    data.transactions.forEach((tx, i) => {
      if (
        tx.blockHeight < data.coverage.fromHeight ||
        tx.blockHeight > data.coverage.toHeight
      )
        ctx.addIssue({
          code: "custom",
          message: "Transaction outside declared block interval",
          path: ["transactions", i, "blockHeight"],
        });
      const previous = blocks.get(tx.blockHeight);
      if (
        previous &&
        (previous.hash !== tx.blockHash ||
          previous.time !== Date.parse(tx.timestamp))
      )
        ctx.addIssue({
          code: "custom",
          message: "Conflicting hash or timestamp for one block height",
          path: ["transactions", i, "blockHash"],
        });
      if (
        heights.has(tx.blockHash) &&
        heights.get(tx.blockHash) !== tx.blockHeight
      )
        ctx.addIssue({
          code: "custom",
          message: "Block hash is reused at different heights",
          path: ["transactions", i, "blockHash"],
        });
      blocks.set(tx.blockHeight, {
        hash: tx.blockHash,
        time: Date.parse(tx.timestamp),
      });
      heights.set(tx.blockHash, tx.blockHeight);
    });
  });

export type Transaction = z.infer<typeof transactionSchema>;
export type Dataset = z.infer<typeof datasetSchema>;
export type Pool = Transaction["poolDeltas"][number]["pool"];

export function parseDataset(text: string): Dataset {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error("File is too large. Maximum size is 2 MB.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(
      "This file is not valid JSON. Download the example to see the expected format.",
    );
  }
  // A report is only a carrier for a dataset. Never trust its saved findings.
  if (raw && typeof raw === "object" && "reportVersion" in raw) {
    const report = z
      .object({
        reportVersion: z.literal(1),
        generatedAt: timestamp,
        verification: z.string().max(1000),
        dataset: z.unknown(),
        analysis: z.unknown(),
      })
      .strict()
      .safeParse(raw);
    if (!report.success)
      throw new Error(
        "Invalid Ostrakon report envelope. Expected report version 1.",
      );
    raw = report.data.dataset;
  }
  const result = datasetSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(
      `Invalid dataset at ${first.path.join(".") || "root"}: ${first.message}. Use the documented Ostrakon v1 format.`,
    );
  }
  return result.data;
}

export function zec(value: string | bigint, digits = 8): string {
  const n = BigInt(value);
  const abs = n < 0n ? -n : n;
  const fraction = (abs % 100_000_000n)
    .toString()
    .padStart(8, "0")
    .slice(0, digits)
    .replace(/0+$/, "");
  return `${n < 0n ? "−" : ""}${(abs / 100_000_000n).toLocaleString("en-US")}${fraction ? "." + fraction : ""}`;
}
export const short = (s: string) =>
  s.length > 18 ? `${s.slice(0, 7)}…${s.slice(-5)}` : s;
