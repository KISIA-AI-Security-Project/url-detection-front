import type {
  CapturedFile,
  DeepSnapshot,
  DeepTask,
  DeepWork,
  FastReason,
  FastResult,
  PublicFact,
  Report,
} from "./contracts";

export function fastPhase(result: FastResult | null) {
  if (
    !result ||
    (result.judgment_status === "pending" && !result.context_revision)
  )
    return "collect";
  return result.judgment_status === "pending" ? "judge" : "done";
}

// Context publishes pending.json after collection/Builder finish. Its revision,
// rather than a timer or the number of facts, is the collection boundary.
export function reasonFacts(
  reason: FastReason,
  result: FastResult,
): PublicFact[] {
  const byId = new Map(
    result.details.facts.map((fact) => [fact.fact_id, fact]),
  );
  const selected = new Set<string>();
  const add = (id: string) => {
    if (selected.has(id) || !byId.has(id)) return;
    selected.add(id);
    byId.get(id)?.condition_fact_ids?.forEach(add);
  };
  reason.related_fact_ids.forEach(add);
  return result.details.facts.filter((fact) => selected.has(fact.fact_id));
}

export function taskState(
  task: DeepTask,
): "pending" | "running" | "done" | "stopped" {
  if (["success", "returned"].includes(task.status)) return "done";
  if (["failed", "error", "skipped", "ended_by_manager"].includes(task.status))
    return "stopped";
  return task.status === "running" ? "running" : "pending";
}

export function workState(work: DeepWork, snapshot: DeepSnapshot) {
  if (work.status === "answered")
    return { state: "done" as const, label: "확인 완료" };
  if (["completed", "failed", "cancelled"].includes(snapshot.status))
    return { state: "stopped" as const, label: "조사 종료" };
  if (
    snapshot.managers.some(
      (manager) =>
        manager.status === "running" &&
        manager.review_work_ids?.includes(work.id),
    )
  )
    return { state: "running" as const, label: "결과 검토 중" };
  const tasks = snapshot.tasks.filter((task) => task.work_id === work.id);
  if (tasks.some((task) => task.status === "running"))
    return { state: "running" as const, label: "확인 중" };
  if (tasks.some((task) => task.status === "waiting"))
    return { state: "pending" as const, label: "대기 중" };
  if (
    tasks.length &&
    tasks.every(
      (task) => taskState(task) === "done" || taskState(task) === "stopped",
    )
  )
    return { state: "running" as const, label: "결과 검토 대기" };
  return { state: "pending" as const, label: "준비 중" };
}

export function taskPresentation(task: DeepTask, runStatus: string) {
  const observed = taskState(task);
  const ended = ["completed", "failed", "cancelled"].includes(runStatus);
  const state =
    ended && ["pending", "running"].includes(observed)
      ? ("stopped" as const)
      : observed;
  const unperformed =
    (ended && observed === "pending") ||
    task.status === "skipped" ||
    (task.status === "ended_by_manager" && !task.started_at);
  const label = unperformed
    ? "미수행"
    : state === "done"
      ? "완료"
      : state === "running"
        ? "확인 중"
        : state === "stopped"
          ? ["failed", "error"].includes(task.status)
            ? "확인 실패"
            : "종료"
          : "대기";
  return { state, label };
}

export function deepPhase(snapshot: DeepSnapshot): number {
  if (snapshot.status === "completed") return 4;
  if (snapshot.result || snapshot.status === "finalizing") return 3;
  if (snapshot.works.length) return 2;
  // Store opens the first manager call after the initial input/capture is ready.
  if (snapshot.managers.length) return 1;
  return 0;
}

export function captureFor(snapshot: DeepSnapshot): CapturedFile | undefined {
  const images = snapshot.files.filter(
    (file) =>
      file.content_type === "image/png" || file.content_type === "image/jpeg",
  );
  return (
    images.find(
      (file) =>
        file.source_metadata?.action_id === "initial-screen" ||
        file.source_metadata?.context?.scenario_id === "initial-input" ||
        file.source_metadata?.purpose === "initial_screenshot" ||
        file.source_metadata?.role === "initial",
    ) ?? images[0]
  );
}
export function imageUrl(file: CapturedFile | undefined): string | null {
  if (!file?.url) return null;
  try {
    const parsed = new URL(file.url, window.location.origin);
    // Same-origin fixtures are used only in the explicitly labelled preview.
    return parsed.protocol === "https:" ||
      parsed.origin === window.location.origin
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}
export function taskReport(
  task: DeepTask,
  snapshot: DeepSnapshot,
): Report | null {
  const stored = snapshot.results?.find(
    (result) =>
      result.kind === "agent_report" && result.result_ref === task.result_ref,
  );
  if (!stored || typeof stored.data !== "object" || stored.data === null)
    return null;
  const report = stored.data as Partial<Report>;
  return typeof report.summary === "string" ? (report as Report) : null;
}
export function managerForWork(
  work: DeepWork,
  snapshot: DeepSnapshot,
): string | null {
  return (
    [...snapshot.managers]
      .reverse()
      .find(
        (manager) =>
          manager.summary &&
          (manager.review_work_ids?.includes(work.id) ||
            manager.decision_summary?.answered_work_ids?.includes(work.id)),
      )?.summary ?? null
  );
}
