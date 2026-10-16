import recordedMainnet from "../data/mainnet-3520054.json";
import { datasetSchema, type Dataset } from "./schema";
import { sample, type SampleKey } from "./samples";

export type DatasetKey = SampleKey | "mainnet-3520054";
export const recordedLabel = "Mainnet · 7 records · 16 Oct 2026";

export function builtInDataset(key: DatasetKey): Dataset {
  // Parse a fresh copy so scenarios and imports cannot mutate the bundled record.
  return key === "mainnet-3520054"
    ? datasetSchema.parse(recordedMainnet)
    : sample(key);
}
