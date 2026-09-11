export type Verdict = "safe" | "caution" | "danger";
export type Layer = "L2" | "L3" | "L4";
export type Scenario =
  | "danger"
  | "fast-danger"
  | "caution"
  | "safe"
  | "partial"
  | "failed"
  | "reconnecting"
  | "status-error"
  | "unknown"
  | "stub"
  | "blocked"
  | "summary-fallback";
export type JobStatus = "scanning" | "completed" | "cancelled" | "failed";
export interface Evidence {
  id: string;
  layer: Layer;
  severity: "caution" | "danger";
  confidence: number;
  order: number;
  title: string;
  label: string;
  keySummary: string;
  description: string;
  values: { key: string; value: string }[];
}
export interface AnalysisJob {
  id: string;
  url: string;
  kind: "fast" | "deep";
  scenario: Scenario;
  status: JobStatus;
  createdAt: number;
  completesAt: number;
}
export interface AnalysisResult {
  initial: Verdict;
  final: Verdict;
  summary: string;
  fastSummary: string;
  evidence: Evidence[];
  partial: boolean;
}
export interface AnalysisService {
  startFast(url: string, scenario?: Scenario): AnalysisJob;
  startDeep(fast: AnalysisJob): AnalysisJob;
  getJob(id: string): AnalysisJob | null;
  getFast(): AnalysisJob | null;
  clearFast(): void;
  cancel(id: string): AnalysisJob | null;
}
