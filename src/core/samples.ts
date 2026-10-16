import type { Dataset, Transaction } from "./schema";

const hash = (n: number) => n.toString(16).padStart(64, "0");
const addrA = "example:transparent-address-A";
const addrB = "example:transparent-address-B";
function tx(
  n: number,
  minutes: number,
  direction: "shield" | "deshield" | "transparent",
  amount: string,
  address: string,
): Transaction {
  const value = BigInt(amount),
    fee = 10000n;
  return {
    txid: hash(n),
    blockHeight: 3_500_000 + minutes,
    blockHash: hash(1000 + minutes),
    timestamp: new Date(Date.UTC(2026, 9, 15, 9, minutes)).toISOString(),
    version: 6,
    confirmations: 100,
    coinbase: false,
    feeZat: fee.toString(),
    inputs:
      direction === "deshield"
        ? []
        : [{ address, valueZat: (value + fee).toString() }],
    outputs:
      direction === "shield"
        ? []
        : [
            {
              address: direction === "transparent" ? addrB : address,
              valueZat: (direction === "deshield"
                ? value - fee
                : value
              ).toString(),
            },
          ],
    poolDeltas:
      direction === "transparent"
        ? []
        : [
            {
              pool: "ironwood",
              valueZat: (direction === "shield" ? value : -value).toString(),
            },
          ],
  };
}
export type SampleKey = "roundtrip" | "ambiguous" | "quiet";
export const sampleLabels: Record<SampleKey, string> = {
  roundtrip: "The familiar round trip",
  ambiguous: "One amount, several stories",
  quiet: "No match is not a guarantee",
};
export function sample(key: SampleKey): Dataset {
  const transactions = [
    tx(1, 0, "shield", "1250000000", addrA),
    tx(2, 12, "shield", "340000000", "example:transparent-address-C"),
    tx(3, 38, "deshield", key === "quiet" ? "790000000" : "1250000000", addrB),
    tx(4, 85, "transparent", "250000000", addrA),
    tx(5, 130, "deshield", "180000000", "example:transparent-address-D"),
    tx(6, 210, "shield", "620000000", "example:transparent-address-E"),
  ];
  if (key === "ambiguous")
    transactions.push(
      tx(7, 65, "deshield", "1250000000", "example:transparent-address-F"),
    );
  if (key === "quiet")
    transactions[3] = tx(
      4,
      85,
      "transparent",
      "250000000",
      "example:transparent-address-G",
    );
  return {
    schemaVersion: 1,
    name: sampleLabels[key],
    network: "mainnet",
    source: {
      kind: "sample",
      label: "Ostrakon learning examples",
      retrievedAt: "2026-10-16T09:00:00Z",
    },
    coverage: {
      fromHeight: 3_500_000,
      toHeight: 3_500_250,
      complete: false,
      note: "A small synthetic dataset showing selected transactions. It does not represent real users or real chain activity.",
    },
    transactions,
  };
}
