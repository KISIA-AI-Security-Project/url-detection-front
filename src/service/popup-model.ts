import type { AnalysisModels, FastResult, FastVerdict } from "./contracts";

export interface FixedPopupModel {
  modelChoice: string;
  reasoningEffort: "high";
}

export function fixedPopupModel(
  catalog: AnalysisModels,
): FixedPopupModel | null {
  const model = catalog.models.find(
    (row) =>
      /opus/i.test(row.label) &&
      /5(?:\.|\s*)5/.test(row.label) &&
      row.efforts.includes("high"),
  );
  return model ? { modelChoice: model.id, reasoningEffort: "high" } : null;
}

export const popupVerdicts: Record<
  FastVerdict,
  { label: string; tone: "safe" | "caution" | "danger" | "unknown" }
> = {
  BENIGN: { label: "안전", tone: "safe" },
  LIKELY_BENIGN: { label: "안전", tone: "safe" },
  LIKELY_MALICIOUS: { label: "주의", tone: "caution" },
  MALICIOUS: { label: "위험", tone: "danger" },
  SUSPICIOUS: { label: "주의", tone: "caution" },
  UNKNOWN: { label: "주의", tone: "unknown" },
};

export function popupReasons(result: FastResult, limit = 3): string[] {
  if (result.judgment_status !== "accepted" || !result.judgment) return [];
  return result.judgment.reasons
    .map((reason) => reason.text.trim())
    .filter(Boolean)
    .slice(0, limit);
}
