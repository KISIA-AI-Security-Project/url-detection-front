import { useLayoutEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleHelp,
  Image as ImageIcon,
  Minus,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button, Spinner, TechnicalValue } from "./ui";
import { VirusTotalResult } from "./VirusTotalResult";
import type {
  DeepSnapshot,
  DeepWork,
  FastResult,
  PublicFact,
  VtResult,
} from "../service/contracts";
import {
  captureFor,
  deepPhase,
  fastPhase,
  imageUrl,
  managerForWork,
  reasonFacts,
  taskReport,
  taskPresentation,
  workState,
} from "../service/presentation";

function StateMark({
  state,
}: {
  state: "pending" | "running" | "done" | "stopped";
}) {
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

function DetailFact({
  fact,
  showTechnical,
}: {
  fact: PublicFact;
  showTechnical: boolean;
}) {
  const hasExtraText =
    fact.plain && fact.text.trim() !== fact.plain.text.trim();
  return (
    <article className="service-fact">
      <h3 className="fact-title">{fact.plain?.title ?? fact.title}</h3>
      <p className="fact-description">{fact.plain?.text ?? fact.text}</p>
      {showTechnical && hasExtraText && (
        <details className="fact-technical">
          <summary>
            기술정보 보기
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <pre>{fact.text}</pre>
        </details>
      )}
    </article>
  );
}

const verdicts = {
  BENIGN: { label: "정상", tone: "safe", icon: ShieldCheck },
  MALICIOUS: { label: "악성", tone: "danger", icon: ShieldX },
  LIKELY_MALICIOUS: {
    label: "악성 가능성 높음",
    tone: "caution",
    icon: TriangleAlert,
  },
  SUSPICIOUS: { label: "의심", tone: "caution", icon: TriangleAlert },
  LIKELY_BENIGN: { label: "정상 가능성 높음", tone: "safe", icon: ShieldCheck },
  UNKNOWN: { label: "판단불가", tone: "unknown", icon: CircleHelp },
};

export function FastResultView({
  result,
  url,
  onDeep,
  deepPending = false,
  deepRequest,
  virustotal,
}: {
  result: FastResult | null;
  url: string;
  onDeep: () => void;
  deepPending?: boolean;
  deepRequest?: {
    value: string;
    onChange: (value: string) => void;
    error?: string;
  };
  virustotal?: VtResult | null;
}) {
  const [openReason, setOpenReason] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const phase = fastPhase(result);
  const resultKey = result
    ? `${result.job_id}:${result.attempt}:${result.context_revision}:${result.result_revision}`
    : "";
  const previousResult = useRef(resultKey);
  const shownCompletion = useRef<string | null>(null);
  const completionHeading = useRef<HTMLHeadingElement>(null);
  const completionKey =
    result && phase === "done" ? `${result.job_id}:${result.attempt}` : null;
  useLayoutEffect(() => {
    if (!completionKey || shownCompletion.current === completionKey) return;
    shownCompletion.current = completionKey;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    completionHeading.current?.focus({ preventScroll: true });
  }, [completionKey]);
  // Detail state is scoped to one immutable result; stale fact IDs never carry over.
  if (previousResult.current !== resultKey) {
    previousResult.current = resultKey;
    if (openReason !== null) setOpenReason(null);
    if (more) setMore(false);
  }
  if (phase !== "done")
    return (
      <section
        className="service-fast fast-pending"
        aria-labelledby="fast-title"
      >
        <h1 className="report-title" id="fast-title">
          빠른 분석
        </h1>
        <div className="fast-progress-copy" role="status" aria-live="polite">
          <Spinner size={24} />
          <div>
            <h2>{phase === "collect" ? "자료 수집 중" : "모델 판단 중"}</h2>
            <p>
              {phase === "collect"
                ? "분석에 필요한 자료를 수집하고 있습니다."
                : "자료 수집이 완료되었습니다."}
            </p>
          </div>
        </div>
        <VirusTotalResult result={virustotal} />
        <div className="analysis-address">
          <TechnicalValue value={url} label="분석 URL" copyable={false} />
        </div>
      </section>
    );
  if (!result || result.judgment_status !== "accepted" || !result.judgment) {
    const notRequested = result?.judgment_status === "not_requested";
    return (
      <section className="service-fast" role="status">
        <h1 className="report-title" tabIndex={-1} ref={completionHeading}>
          {notRequested ? "판정 전" : "분석을 완료하지 못했습니다"}
        </h1>
        <p>
          {notRequested
            ? "이번 요청에서는 판정을 수행하지 않았습니다."
            : "분석 요청으로 돌아가 다시 시도해 주세요."}
        </p>
        <VirusTotalResult result={virustotal} />
        {url && (
          <div className="analysis-address">
            <TechnicalValue value={url} label="분석 URL" copyable={false} />
          </div>
        )}
      </section>
    );
  }
  const judgment = result.judgment;
  const verdict = verdicts[judgment.verdict];
  const Icon = verdict.icon;
  return (
    <section
      className="service-fast"
      aria-labelledby="fast-title"
      data-verdict-tone={verdict.tone}
    >
      <div className="fast-heading">
        <h1 className="report-title" id="fast-title">
          빠른 분석 결과
        </h1>
        {!!judgment.reasons.length && (
          <label className="technical-option">
            <input
              type="checkbox"
              checked={showTechnical}
              onChange={(event) => setShowTechnical(event.target.checked)}
            />
            기술정보 표시
          </label>
        )}
      </div>
      <div
        className={`report-verdict report-tone-${verdict.tone}`}
        aria-labelledby="verdict-title"
      >
        <h2
          className="verdict-title"
          id="verdict-title"
          tabIndex={-1}
          ref={completionHeading}
        >
          <Icon className="verdict-icon" aria-hidden="true" />
          {verdict.label}
        </h2>
        <p className="verdict-description">{judgment.summary}</p>
      </div>
      {!!judgment.reasons.length && (
        <section className="reasons-section" aria-labelledby="reasons-title">
          <div className="section-heading">
            <h2 id="reasons-title">판정 이유</h2>
          </div>
          <ol className="reason-list">
            {(more ? judgment.reasons : judgment.reasons.slice(0, 3)).map(
              (reason, index) => {
                // The readable layer contains the facts selected by this reason.
                // The user excluded additional condition/limit items from this
                // surface. Preserve the supplied text of the directly linked facts.
                const directIds = new Set(reason.related_fact_ids);
                const facts = reasonFacts(reason, result).filter((fact) =>
                  directIds.has(fact.fact_id),
                );
                const open = openReason === index;
                return (
                  <li className="reason-item" key={`${index}:${reason.text}`}>
                    <div className="reason-row">
                      <p className="reason-text">{reason.text}</p>
                      {!!facts.length && (
                        <button
                          type="button"
                          className="text-button reason-toggle"
                          aria-expanded={open}
                          aria-controls={`reason-detail-${index}`}
                          aria-label={`${index + 1}번째 판정 이유 상세정보${open ? " 접기" : ""}`}
                          onClick={() => setOpenReason(open ? null : index)}
                        >
                          상세정보
                          <ChevronDown
                            size={14}
                            className={open ? "rotated" : ""}
                          />
                        </button>
                      )}
                    </div>
                    {open && (
                      <div
                        className="reason-facts"
                        id={`reason-detail-${index}`}
                      >
                        {facts.map((fact) => (
                          <DetailFact
                            key={fact.fact_id}
                            fact={fact}
                            showTechnical={showTechnical}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              },
            )}
          </ol>
          {judgment.reasons.length > 3 && (
            <button
              className="text-button reason-more"
              aria-expanded={more}
              onClick={() => {
                setMore(!more);
                setOpenReason(null);
              }}
            >
              {more
                ? "판정 이유 접기"
                : `판정 이유 더 보기 (${judgment.reasons.length - 3})`}
              <ChevronDown size={14} className={more ? "rotated" : ""} />
            </button>
          )}
        </section>
      )}
      <VirusTotalResult result={virustotal} />
      <div className={`result-bottom${deepRequest ? " has-request" : ""}`}>
        {url && (
          <div className="analysis-address">
            <TechnicalValue value={url} label="분석 URL" copyable={false} />
          </div>
        )}
        {result.deep_analysis.available && (
          <div className="service-deep-request">
            {deepRequest && (
              <div className="deep-request-field">
                <label htmlFor="deep-request-text">
                  구체적으로 확인하고 싶은 내용이 있나요? (선택)
                </label>
                <textarea
                  id="deep-request-text"
                  rows={3}
                  value={deepRequest.value}
                  onChange={(event) => deepRequest.onChange(event.target.value)}
                  disabled={deepPending}
                  aria-invalid={!!deepRequest.error}
                  aria-describedby="deep-request-help deep-request-count"
                  placeholder="예: 로그인 화면에서 입력한 정보가 어디로 전송되는지 확인해 주세요."
                />
                <div className="deep-request-help">
                  <p
                    id="deep-request-help"
                    role={deepRequest.error ? "alert" : undefined}
                  >
                    {deepRequest.error ||
                      "입력한 내용은 심층 분석의 확인 요청으로 전달됩니다. 비워 두어도 분석할 수 있습니다."}
                  </p>
                  <span id="deep-request-count">
                    {Array.from(
                      deepRequest.value.trim(),
                    ).length.toLocaleString()}{" "}
                    / 2,000자
                  </span>
                </div>
              </div>
            )}
            <Button
              onClick={onDeep}
              disabled={deepPending || !!deepRequest?.error}
            >
              {deepPending ? (
                <>
                  <Spinner size={16} />
                  심층분석 요청 중
                </>
              ) : (
                "심층분석 요청"
              )}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function WorkItem({
  work,
  snapshot,
}: {
  work: DeepWork;
  snapshot: DeepSnapshot;
}) {
  const [open, setOpen] = useState(false);
  const status = workState(work, snapshot);
  const tasks = snapshot.tasks.filter((task) => task.work_id === work.id);
  const review = managerForWork(work, snapshot);
  return (
    <li className={`work-item is-${status.state}`}>
      <button
        className="work-row"
        type="button"
        aria-expanded={open}
        aria-controls={`work-${work.id}`}
        onClick={() => setOpen(!open)}
      >
        <StateMark state={status.state} />
        <span className="work-title">{work.title || work.question}</span>
        <span className="work-status">{status.label}</span>
        <ChevronDown size={16} className={open ? "rotated" : ""} />
      </button>
      {open && (
        <div className="work-detail" id={`work-${work.id}`}>
          <dl className="work-meta">
            {work.question && work.question !== work.title && (
              <div>
                <dt>확인 목적</dt>
                <dd>{work.question}</dd>
              </div>
            )}
            {work.reason && (
              <div>
                <dt>배정 이유</dt>
                <dd>{work.reason}</dd>
              </div>
            )}
          </dl>
          {!!tasks.length && (
            <div className="work-findings">
              <h3>핵심 확인 내용</h3>
              <ol className="compact-task-list">
                {tasks.map((task) => {
                  const status = taskPresentation(task, snapshot.status);
                  const report = taskReport(task, snapshot);
                  return (
                    <li key={task.id} className="compact-task">
                      <div className="compact-task-heading">
                        <StateMark state={status.state} />
                        <span className="task-title">
                          {task.title || "확인 작업"}
                        </span>
                        <span className="task-state">{status.label}</span>
                      </div>
                      {report && (
                        <p className="compact-task-result">{report.summary}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
          {work.answer && (
            <p className="work-answer">
              <span>업무 결론</span>
              {work.answer}
            </p>
          )}
          {review && review !== work.answer && (
            <details className="work-review">
              <summary>총괄 검토</summary>
              <p>{review}</p>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

function CapturePreview({ snapshot }: { snapshot: DeepSnapshot }) {
  const capture = captureFor(snapshot);
  const url = imageUrl(capture);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <section className="capture-section" aria-labelledby="capture-title">
      <h2 id="capture-title">브라우저 캡쳐화면</h2>
      {url && failedUrl !== url ? (
        <>
          <button
            className="capture-button"
            onClick={() => dialog.current?.showModal()}
            aria-label="캡처 화면 확대"
          >
            <img
              src={url}
              alt="심층 분석 중 확보한 웹페이지 화면"
              onError={() => setFailedUrl(url)}
            />
            <span>
              <ImageIcon size={14} />
              크게 보기
            </span>
          </button>
          <dialog
            className="capture-dialog"
            ref={dialog}
            aria-labelledby="capture-dialog-title"
            onClick={(event) => {
              if (event.target === event.currentTarget) dialog.current?.close();
            }}
          >
            <div className="capture-dialog-header">
              <h2 id="capture-dialog-title">브라우저 캡쳐화면</h2>
              <button
                className="copy-button"
                aria-label="캡처 화면 닫기"
                onClick={() => dialog.current?.close()}
              >
                <X size={20} />
              </button>
            </div>
            <img src={url} alt="심층 분석 중 확보한 웹페이지 화면 확대" />
          </dialog>
        </>
      ) : (
        <div className="capture-empty">
          <ImageIcon size={24} />
          <p>
            {url
              ? "캡처 화면을 불러오지 못했습니다."
              : snapshot.status === "completed" || snapshot.status === "failed"
                ? "확보한 캡처 화면이 없습니다."
                : "자료를 확인하면 캡처 화면이 표시됩니다."}
          </p>
        </div>
      )}
    </section>
  );
}

const stepLabels = [
  "자료 확인",
  "업무 구성",
  "업무 수행",
  "최종 결과 정리",
  "분석 완료",
];
export function DeepResultView({
  snapshot,
  url,
}: {
  snapshot: DeepSnapshot;
  url: string;
}) {
  const shownCompletion = useRef<string | null>(null);
  const conclusionHeading = useRef<HTMLHeadingElement>(null);
  const phase = deepPhase(snapshot);
  const final = snapshot.result;
  const failed = snapshot.status === "failed";
  const ended = failed || snapshot.status === "completed";
  const noExtraWork = snapshot.status === "completed" && !snapshot.works.length;
  useLayoutEffect(() => {
    if ((!final && !failed) || shownCompletion.current === snapshot.run_id)
      return;
    shownCompletion.current = snapshot.run_id;
    // One immediate jump per run. Stream updates never pull the reader back.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    conclusionHeading.current?.focus({ preventScroll: true });
  }, [!!final, failed, snapshot.run_id]);
  const current = [...snapshot.managers]
    .reverse()
    .find((manager) => manager.summary);
  const runningManager = snapshot.managers.find(
    (manager) => manager.status === "running",
  );
  const managerText = current?.summary;
  return (
    <section
      className="service-deep"
      aria-labelledby="deep-title"
      data-lg-role="stage"
      data-publish-seq={snapshot.publish_seq}
    >
      <h1
        className="report-title"
        id="deep-title"
        tabIndex={-1}
        ref={conclusionHeading}
      >
        {final && !failed ? "심층 분석 결과" : "심층 분석"}
      </h1>
      {final && (
        <section
          className="service-conclusion"
          aria-label={failed ? "현재까지 확인한 내용" : "최종 결론"}
        >
          {failed && <h2 className="conclusion-title">현재까지 확인한 내용</h2>}
          <p className="conclusion-summary">{final.summary}</p>
          {!!final.findings?.length && (
            <div className="conclusion-reasons">
              <h2>판정 이유</h2>
              <ul>
                {final.findings.map((finding, index) => (
                  <li key={index}>{finding.statement}</li>
                ))}
              </ul>
            </div>
          )}
          {!!final.limits?.length && (
            <p className="conclusion-limit">{final.limits.join(" ")}</p>
          )}
        </section>
      )}
      {failed && (
        <p className="inline-error" role="status">
          심층 분석을 완료하지 못했습니다. 지금까지 확인한 내용은 아래에 남아
          있습니다.
        </p>
      )}
      <div className="deep-columns">
        <div className="deep-primary" data-lg-role="focus">
          <section className="deep-progress" aria-labelledby="progress-title">
            <h2 className="fact-label" id="progress-title">
              진행 상황
            </h2>
            <p className="sr-only" role="status" aria-live="polite">
              {failed
                ? "심층 분석을 완료하지 못했습니다"
                : stepLabels[phase] + (phase < 4 ? " 중" : "")}
            </p>
            <ol className="overall-steps">
              {stepLabels.map((label, index) => {
                const state =
                  noExtraWork && index === 2
                    ? "stopped"
                    : index < phase || (index === 4 && phase === 4)
                      ? "done"
                      : index === phase
                        ? failed
                          ? "stopped"
                          : "running"
                        : "pending";
                return (
                  <li className={`overall-step is-${state}`} key={label}>
                    <StateMark state={state} />
                    <span>
                      {noExtraWork && index === 2 ? "추가 업무 없음" : label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
          <section className="works-section" aria-labelledby="works-title">
            <div className="section-heading">
              <h2 id="works-title">
                업무 확인{" "}
                <span className="finding-count">
                  {snapshot.works.length || ""}
                </span>
              </h2>
            </div>
            {snapshot.works.length ? (
              <ol className="work-list">
                {snapshot.works.map((work) => (
                  <WorkItem key={work.id} work={work} snapshot={snapshot} />
                ))}
              </ol>
            ) : (
              <p className="works-empty">
                {!ended && <Spinner size={16} />}
                {failed
                  ? "수행한 확인 업무가 없습니다."
                  : snapshot.status === "completed"
                    ? "추가로 수행한 확인 업무가 없습니다."
                    : phase === 0
                      ? "앞선 분석 자료를 확인하고 있습니다."
                      : "확인할 업무를 구성하고 있습니다."}
              </p>
            )}
          </section>
          {url && (
            <div className="analysis-address">
              <TechnicalValue value={url} label="분석 URL" copyable={false} />
            </div>
          )}
        </div>
        <aside
          className="deep-rail"
          data-lg-role="rail"
          aria-label="캡처 화면과 조사 방향"
        >
          <CapturePreview snapshot={snapshot} />
          <section className="manager-section" aria-labelledby="manager-title">
            <h2 id="manager-title">
              {phase === 4 ? "조사 판단 요약" : "현재 조사 방향"}
            </h2>
            {managerText ? (
              <p>{managerText}</p>
            ) : (
              <p className="muted">
                {ended
                  ? "총괄 판단 요약이 없습니다."
                  : phase === 0
                    ? "자료를 확인한 뒤 조사 방향을 정리합니다."
                    : "확인할 업무를 정리하고 있습니다."}
              </p>
            )}
            {runningManager && managerText && !ended && (
              <p className="manager-state">
                <Spinner size={14} />
                추가 검토 중
              </p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
