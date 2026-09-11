import type { AnalysisJob, AnalysisService, Scenario } from "./types";
const PREFIX = "linkguard.v1.";
const FAST_KEY = `${PREFIX}active-fast`;
export const FAST_DURATION = 4000;
export const DEEP_DURATION = 6500;
function read(id: string): AnalysisJob | null {
  try {
    const data: unknown = JSON.parse(
      localStorage.getItem(`${PREFIX}${id}`) || "null",
    );
    if (!data || typeof data !== "object") return null;
    const j = data as AnalysisJob;
    if (
      j.id !== id ||
      typeof j.url !== "string" ||
      !Number.isFinite(j.completesAt) ||
      !Number.isFinite(j.createdAt) ||
      !["fast", "deep"].includes(j.kind) ||
      !["scanning", "completed", "failed", "cancelled"].includes(j.status)
    )
      return null;
    return j;
  } catch {
    return null;
  }
}
function save(job: AnalysisJob): AnalysisJob {
  localStorage.setItem(`${PREFIX}${job.id}`, JSON.stringify(job));
  return job;
}
function create(
  url: string,
  kind: AnalysisJob["kind"],
  scenario: Scenario,
): AnalysisJob {
  const now = Date.now();
  return save({
    id: crypto.randomUUID(),
    url,
    kind,
    scenario,
    status: "scanning",
    createdAt: now,
    completesAt: now + (kind === "fast" ? FAST_DURATION : DEEP_DURATION),
  });
}
/** Replace this adapter with an API client when the backend contract is ready.
 * Mock jobs advance by stored timestamps, so closing a popup never restarts a job.
 * No target URL is fetched or visited by this service.
 */
export const analysisService: AnalysisService = {
  startFast(url, scenario = "danger") {
    const existing = this.getFast();
    if (existing?.status === "scanning") return existing;
    const job = create(url, "fast", scenario);
    localStorage.setItem(FAST_KEY, job.id);
    return job;
  },
  startDeep(fast) {
    const existing = localStorage.getItem(`${PREFIX}deep-for-${fast.id}`);
    const previous = existing ? this.getJob(existing) : null;
    if (previous) return previous;
    const deep = create(fast.url, "deep", fast.scenario);
    localStorage.setItem(`${PREFIX}deep-for-${fast.id}`, deep.id);
    return deep;
  },
  getJob(id) {
    const job = read(id);
    if (job?.status === "scanning" && Date.now() >= job.completesAt) {
      return save({
        ...job,
        status: job.scenario === "failed" ? "failed" : "completed",
      });
    }
    return job;
  },
  getFast() {
    const id = localStorage.getItem(FAST_KEY);
    return id ? this.getJob(id) : null;
  },
  clearFast() {
    localStorage.removeItem(FAST_KEY);
  },
  cancel(id) {
    const job = this.getJob(id);
    return job && job.status === "scanning"
      ? save({ ...job, status: "cancelled" })
      : job;
  },
};
export function demoJob(scenario: Scenario = "danger"): AnalysisJob {
  return {
    id: `demo-${scenario}`,
    url:
      scenario === "safe"
        ? "https://example.com/"
        : "https://account-secure.example/login/verify",
    kind: "deep",
    scenario,
    status: "completed",
    createdAt: new Date(2026, 8, 8, 13, 42).getTime() - DEEP_DURATION,
    completesAt: new Date(2026, 8, 8, 13, 42).getTime(),
  };
}
export function seedDemo(scenario: Scenario, running = false): AnalysisJob {
  const job = create(demoJob(scenario).url, "deep", scenario);
  return running
    ? job
    : save({ ...job, status: scenario === "failed" ? "failed" : "completed" });
}
