// Public responses only. The frontend never derives a URL verdict from facts.
export type FastVerdict =
  | "BENIGN"
  | "LIKELY_BENIGN"
  | "LIKELY_MALICIOUS"
  | "MALICIOUS"
  | "UNKNOWN"
  | "SUSPICIOUS";
export type JudgmentStatus =
  "pending" | "accepted" | "not_requested" | "failed" | "invalid";
export interface PublicFact {
  fact_id: string;
  title: string;
  text: string;
  plain?: { title: string; text: string };
  condition_fact_ids?: string[];
}
export interface FastReason {
  text: string;
  related_fact_ids: string[];
}
export interface FastResult {
  schema_version: "fast-result-1";
  job_id: string;
  attempt: number;
  context_revision: string | null;
  result_revision: string;
  judgment_status: JudgmentStatus;
  judgment: {
    verdict: FastVerdict;
    summary: string;
    reasons: FastReason[];
  } | null;
  details: { facts: PublicFact[]; sections: unknown[] };
  deep_analysis: { available: boolean };
}
export interface DeepIdentity {
  job_id: string;
  attempt: number;
  context_revision: string;
  result_revision: string;
  request_text?: string;
}
export interface AnalysisModels {
  default_model_choice: string;
  models: {
    id: string;
    label: string;
    efforts: string[];
    default_effort: string | null;
  }[];
}
export interface Report {
  summary: string;
  findings?: { statement: string; refs?: string[] }[];
  limits?: string[];
}
export interface DeepWork {
  id: string;
  title?: string;
  question: string;
  reason?: string;
  status: string;
  answer?: string;
  answered_at?: string;
}
export interface DeepTask {
  id: string;
  work_id: string;
  title?: string;
  status: string;
  result_ref?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}
export interface ManagerSummary {
  id: string;
  status: string;
  summary?: string | null;
  situation?: string;
  review_work_ids?: string[];
  decision_summary?: {
    new_work_ids?: string[];
    answered_work_ids?: string[];
    finish?: boolean;
  } | null;
}
export interface CapturedFile {
  file_ref: string;
  content_type: string;
  url?: string;
  source_metadata?: {
    action_id?: string;
    context?: { scenario_id?: string };
    purpose?: string;
    role?: string;
    captured_at?: string;
    [key: string]: unknown;
  };
}
export interface DeepSnapshot {
  run_id: string;
  scan_id: string;
  status: string;
  updated_at?: string;
  publish_seq?: number;
  input?: DeepIdentity;
  works: DeepWork[];
  tasks: DeepTask[];
  managers: ManagerSummary[];
  results?: { result_ref: string; kind: string; data: unknown }[];
  files: CapturedFile[];
  result: Report | null;
}
export interface AnalysisHistory {
  scanId: string;
  url: string;
  virustotal_requested?: boolean;
}
export interface ServiceConfig {
  api_base: string;
  auth: {
    domain: string;
    client_id: string;
    redirect_uri: string;
    scope: string;
  };
}
export interface VtResult {
  schema_version: string;
  status: string;
  report_at?: string;
  checked_at?: string;
  report_url?: string;
  stats?: {
    malicious?: number;
    suspicious?: number;
    harmless?: number;
    undetected?: number;
  };
  engines?: { name: string; category: string; result?: string }[];
}
