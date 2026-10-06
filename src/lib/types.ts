export type Verdict = "safe" | "caution" | "danger";
// Fast analysis covers L0–L3 only; L4 belongs to deep analysis.
export type Layer = "L0" | "L1" | "L2" | "L3";
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
  // Short noun phrase shown in the verdict keyword line.
  keyword: string;
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
// One-sentence verdict reason, linked to the confirmed facts (evidence ids)
// it rests on. Facts are rendered once, under the reason that cites them.
export interface Reason {
  id: string;
  text: string;
  factIds: string[];
}
// One page visited on the way from the analyzed URL to the final page.
export interface RedirectHop {
  url: string;
  domain: string;
  status: number;
}
export interface AnalysisResult {
  initial: Verdict;
  final: Verdict;
  summary: string;
  fastSummary: string;
  evidence: Evidence[];
  reasons: Reason[];
  // Empty when the page did not redirect; the path section is then hidden.
  redirectChain: RedirectHop[];
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

// ── L4 deep investigation ────────────────────────────────────────────────
// Work = a question to answer, Task = an execution delegated for it,
// Action = one tool-run attempt inside a task.
export type StepState = "pending" | "running" | "done" | "stopped";
export type ActionKind = "open" | "navigate" | "observe" | "tool" | "report";
export interface InvestigationAction {
  id: string;
  kind: ActionKind;
  /** ms since the investigation started */
  at: number;
  summary: string;
  value?: string;
  tool?: string;
}
export interface InvestigationTask {
  id: string;
  title: string;
  /** Not every task has an execution agent. */
  agent: string | null;
  state: StepState;
  actions: InvestigationAction[];
}
export interface InvestigationWork {
  id: string;
  title: string;
  question: string;
  reason: string;
  state: StepState;
  /** Short user-facing progress phrase, e.g. "화면 살펴보는 중". */
  statusText: string;
  tasks: InvestigationTask[];
  answer?: string;
}
export type OverallStepKey = "collect" | "work" | "finalize" | "saved";
export interface OverallStep {
  key: OverallStepKey;
  label: string;
  state: StepState;
}
export interface InvestigationSnapshot {
  id: string;
  url: string;
  startedAt: number;
  elapsed: number;
  overall: OverallStep[];
  /** Phrase for the whole run, e.g. "자료 확인 중". */
  overallText: string;
  works: InvestigationWork[];
  /** L4 conclusion: a one-line call to action in the verdict tone, then the
   * supporting summary and per-work findings. */
  final: {
    tone: Verdict;
    headline: string;
    summary: string;
    points: string[];
  } | null;
  done: boolean;
}
