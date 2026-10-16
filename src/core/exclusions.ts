export const exclusionReasons = {
  coinbase: {
    label: "Mining reward",
    reason: "Coinbase is excluded from payment correlations.",
    nextStep:
      "Inspect it as a mining reward, not an ordinary payment. Its public pool movement stays in the record.",
  },
  unsupported_version: {
    label: "Unsupported version",
    reason: "Unsupported transaction version.",
    nextStep:
      "Use an adapter and rule version that explicitly support this transaction format. Keep it outside this rule until then.",
  },
  low_confirmations: {
    label: "Low snapshot confirmations",
    reason: "Fewer than two confirmations in this snapshot.",
    nextStep:
      "Collect a fresh confirmed snapshot. The browser does not refresh confirmation counts.",
  },
  multiple_pools: {
    label: "Multiple pools",
    reason: "Multiple pools: migration or mixed flow.",
    nextStep:
      "Inspect each net balance separately. This simple rule cannot attribute a multi-pool movement to one hidden payment.",
  },
  no_pool_movement: {
    label: "No net shielded movement",
    reason: "No nonzero net shielded pool movement is recorded.",
    nextStep:
      "Inspect the transparent inputs and outputs. This rule needs a nonzero net shielded pool movement; a zero net balance does not establish an absence of shielded activity.",
  },
  incompatible_pool: {
    label: "Pool/version mismatch",
    reason: "Pool is incompatible with this transaction version.",
    nextStep:
      "Check the export adapter's pool and version fields against the source. Ostrakon does not repair or validate consensus data.",
  },
  unresolved_amounts: {
    label: "Unresolved amounts",
    reason: "Missing fee or unresolved transparent amount.",
    nextStep:
      "Resolve spent previous outputs through the exporter and collect a new snapshot. Unknown values must remain unknown.",
  },
  unbalanced_accounting: {
    label: "Accounting mismatch",
    reason: "Input, output, fee and pool accounting do not balance.",
    nextStep:
      "Check units, previous outputs and pool-balance signs in the source adapter. This flags inconsistent supplied fields, not a consensus verdict.",
  },
  transparent_change: {
    label: "Mixed entry or change",
    reason: "Mixed transparent flow or change; excluded from the simple rule.",
    nextStep:
      "Inspect the public change and net pool amount. This rule does not infer individual shielded note values from a mixed entry.",
  },
  no_transparent_payout: {
    label: "No public payout",
    reason:
      "No transparent payout; public net outflow covers only the fee. Internal shielded payments remain hidden.",
    nextStep:
      "Read the public outflow as the fee contribution. Hidden payments may still occur; no transparent recipient or payment amount can be inferred here.",
  },
  mixed_payout: {
    label: "Mixed or batched payout",
    reason: "Mixed flow or batched payout; excluded from the simple rule.",
    nextStep:
      "Inspect all transparent outputs and inputs. A net pool outflow cannot be assigned to a single recipient by this rule.",
  },
} as const;

export type ExclusionCode = keyof typeof exclusionReasons;
export interface ExcludedTransaction {
  txid: string;
  code: ExclusionCode;
  reason: string;
}
export const exclude = (
  txid: string,
  code: ExclusionCode,
): ExcludedTransaction => ({
  txid,
  code,
  reason: exclusionReasons[code].reason,
});
