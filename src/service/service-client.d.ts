import type { WebAuth } from "./auth";
import type {
  AnalysisModels,
  DeepIdentity,
  DeepSnapshot,
  FastResult,
  VtResult,
} from "./contracts";
export interface RequestTask {
  sequence: number;
  signal: AbortSignal;
}
export interface AcceptedDeep {
  run_id: string;
  events_url: string;
  scan_id?: string;
}
export class ApiFailure extends Error {
  constructor(message: string, status: number, code: string);
  status: number;
  code: string;
}
export function validateFast(
  value: unknown,
  scan: string,
  expectedAttempt?: number,
): FastResult | null;
export function normalizeDeepRequest(value?: string): string;
export class ServiceClient {
  constructor(base: string, auth: WebAuth);
  begin(): RequestTask;
  current(task: RequestTask): boolean;
  stop(): void;
  request<T>(
    path: string,
    options?: { method?: string; body?: unknown; signal?: AbortSignal },
  ): Promise<T>;
  models(signal?: AbortSignal): Promise<AnalysisModels>;
  start(
    url: string,
    vt: boolean,
    task: RequestTask,
    options?: {
      scanId?: string;
      previousAttempt?: number;
      modelChoice?: string;
      reasoningEffort?: string | null;
    },
  ): Promise<{
    scanId: string;
    expectedAttempt: number;
    virustotal: boolean;
    model_choice?: string;
    reasoning_effort?: string | null;
  }>;
  streamFast(
    scan: string,
    attempt: number | undefined,
    task: RequestTask,
    onFast: (value: FastResult) => void,
  ): Promise<void>;
  deep(identity: DeepIdentity, task: RequestTask): Promise<AcceptedDeep>;
  streamDeep(
    run: AcceptedDeep,
    task: RequestTask,
    onDeep: (value: DeepSnapshot) => void,
  ): Promise<void>;
  startVt(scan: string, task: RequestTask): Promise<unknown>;
  streamVt(
    scan: string,
    task: RequestTask,
    onVt: (value: VtResult) => void,
  ): Promise<void>;
}
