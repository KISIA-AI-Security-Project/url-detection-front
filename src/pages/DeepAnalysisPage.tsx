import { useEffect, useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import { Footer, Header, Spinner, TechnicalValue } from "../components/ui";
import { investigationService } from "../lib/mock-investigation";
import type {
  ActionKind,
  InvestigationAction,
  InvestigationSnapshot,
  InvestigationTask,
  InvestigationWork,
  StepState,
} from "../lib/types";
import { formatTime } from "../lib/url";

const ACTION_LABELS: Record<ActionKind, string> = {
  open: "페이지 열기",
  navigate: "이동 결과",
  observe: "화면 관찰",
  tool: "Tool 결과",
  report: "Agent 보고",
};

const STATE_LABELS: Record<StepState, string> = {
  pending: "대기",
  running: "진행 중",
  done: "완료",
  stopped: "중단",
};

// done = check, running = spinner, pending = hollow ring, stopped = dash.
function StateIcon({ state }: { state: StepState }) {
  return (
    <span className={`state-mark is-${state}`} aria-hidden="true">
      {state === "done" ? (
        <Check size={12} strokeWidth={3} />
      ) : state === "running" ? (
        <Spinner size={16} />
      ) : state === "stopped" ? (
        <Minus size={12} strokeWidth={3} />
      ) : null}
    </span>
  );
}

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function ActionRow({
  action,
  live,
}: {
  action: InvestigationAction;
  live: boolean;
}) {
  return (
    <li className={`action-row ${live ? "is-live" : ""}`}>
      <StateIcon state={live ? "running" : "done"} />
      <div className="action-body">
        <p className="action-head">
          <span className="action-kind">{ACTION_LABELS[action.kind]}</span>
          {action.tool && <span className="action-tool">{action.tool}</span>}
          <time className="action-time">+{clock(action.at)}</time>
        </p>
        <p className="action-summary">{action.summary}</p>
        {action.value && <code className="action-value">{action.value}</code>}
      </div>
    </li>
  );
}

function TaskBlock({
  task,
  workRunning,
}: {
  task: InvestigationTask;
  workRunning: boolean;
}) {
  const lastIndex = task.actions.length - 1;
  return (
    <div className="task-block">
      <p className="task-head">
        <span className="task-title">{task.title}</span>
        <span className="task-agent">{task.agent ?? "실행 Agent 없음"}</span>
        <span className={`task-state is-${task.state}`}>
          {STATE_LABELS[task.state]}
        </span>
      </p>
      {task.actions.length ? (
        <ol className="action-list">
          {task.actions.map((action, index) => (
            <ActionRow
              key={action.id}
              action={action}
              live={
                workRunning && task.state === "running" && index === lastIndex
              }
            />
          ))}
        </ol>
      ) : (
        <p className="task-empty">
          {task.state === "stopped"
            ? "실행하기 전에 업무가 종료됐습니다."
            : "아직 실행한 행동이 없습니다."}
        </p>
      )}
    </div>
  );
}

function WorkItem({ work }: { work: InvestigationWork }) {
  const [open, setOpen] = useState(false);
  const panelId = `work-${work.id}`;
  return (
    <li className={`work-item is-${work.state} ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="work-row"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <StateIcon state={work.state} />
        <span className="work-title">{work.title}</span>
        <span className="work-status">{work.statusText}</span>
        <ChevronDown size={16} className={open ? "rotated" : ""} />
      </button>
      {open && (
        <div className="work-detail fade-in" id={panelId}>
          <dl className="work-meta">
            <div>
              <dt>확인할 질문</dt>
              <dd>{work.question}</dd>
            </div>
            <div>
              <dt>배정 이유</dt>
              <dd>{work.reason}</dd>
            </div>
          </dl>
          {work.tasks.map((task) => (
            <TaskBlock
              key={task.id}
              task={task}
              workRunning={work.state === "running"}
            />
          ))}
          {work.answer && (
            <p className="work-answer">
              <span>업무 결과</span>
              {work.answer}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function DeepAnalysisPage({ id }: { id: string }) {
  const [snapshot, setSnapshot] = useState<
    InvestigationSnapshot | null | undefined
  >(undefined);
  useEffect(() => investigationService.subscribe(id, setSnapshot), [id]);

  if (snapshot === null)
    return (
      <>
        <Header />
        <main className="state-main">
          <div className="state-content">
            <h1>심층 분석 기록을 찾을 수 없습니다.</h1>
            <p>이 브라우저에 저장된 기록이 없거나 올바르지 않은 주소입니다.</p>
          </div>
          <Footer />
        </main>
      </>
    );

  return (
    <>
      <Header />
      <main className="report-main deep-main">
        <h1 className="report-title">심층 분석</h1>
        {snapshot && (
          <>
            <div className="deep-target">
              <p className="fact-label">분석 URL</p>
              <TechnicalValue value={snapshot.url} label="분석 URL" hideLabel />
              <p className="deep-meta">
                시작 {formatTime(snapshot.startedAt)} · 경과{" "}
                {clock(snapshot.elapsed)}
              </p>
            </div>

            <section className="deep-progress" aria-labelledby="progress-title">
              <h2 id="progress-title" className="fact-label">
                진행 상황
              </h2>
              {/* Visually redundant with the steps below; kept for screen readers. */}
              <p className="sr-only" role="status" aria-live="polite">
                {snapshot.overallText}
              </p>
              <ol className="overall-steps">
                {snapshot.overall.map((step) => (
                  <li
                    key={step.key}
                    className={`overall-step is-${step.state}`}
                  >
                    <StateIcon state={step.state} />
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="works-section" aria-labelledby="works-title">
              <div className="section-heading">
                <div className="section-heading-copy">
                  <h2 id="works-title">
                    업무{" "}
                    <span className="finding-count">
                      {snapshot.works.length}
                    </span>
                  </h2>
                  <p>
                    업무를 누르면 지금까지 수행한 작업과 실제 행동을 볼 수
                    있습니다.
                  </p>
                </div>
              </div>
              {snapshot.works.length ? (
                <ol className="work-list">
                  {snapshot.works.map((work) => (
                    <WorkItem key={work.id} work={work} />
                  ))}
                </ol>
              ) : (
                <p className="works-empty">
                  <Spinner size={16} />
                  앞선 분석 자료와 이전 판단을 확인하고 있습니다.
                </p>
              )}
            </section>

            {(snapshot.final ||
              snapshot.overall.find((s) => s.key === "finalize")?.state ===
                "running") && (
              <section className="final-section" aria-labelledby="final-title">
                <div className="section-heading">
                  <div className="section-heading-copy">
                    <h2 id="final-title">L4 최종 결과</h2>
                  </div>
                </div>
                {snapshot.final ? (
                  <div
                    className={`final-body report-tone-${snapshot.final.tone} fade-in`}
                  >
                    <p className="final-headline">{snapshot.final.headline}</p>
                    <p className="final-summary">{snapshot.final.summary}</p>
                    <ul className="final-points">
                      {snapshot.final.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="works-empty">
                    <Spinner size={16} />
                    업무 결과를 모아 최종 결과를 정리하고 있습니다.
                  </p>
                )}
              </section>
            )}
          </>
        )}
        <Footer />
      </main>
    </>
  );
}
