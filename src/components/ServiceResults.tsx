import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
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
import {
  AnalysisModelPicker,
  type AnalysisModelSelection,
} from "./AnalysisModelPicker";
import type {
  DeepSnapshot,
  DeepWork,
  FastResult,
  FastVerdict,
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
import { formatTime } from "../lib/url";

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

const verdicts: Record<
  FastVerdict,
  {
    label: string;
    tone: "safe" | "caution" | "danger" | "unknown";
    icon: typeof ShieldCheck;
  }
> = {
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
  deepModelSelection,
  completedAt,
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
  deepModelSelection?: AnalysisModelSelection;
  completedAt?: number | null;
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
  const sawPendingPhase = useRef(phase !== "done");
  const [revealedCompletionKey, setRevealedCompletionKey] = useState<
    string | null
  >(null);
  const completionTime = useRef<{ key: string | null; value: number }>({
    key: null,
    value: Date.now(),
  });
  const completionKey =
    result && phase === "done" ? `${result.job_id}:${result.attempt}` : null;
  if (phase !== "done") sawPendingPhase.current = true;
  const showCompletionBridge =
    !!completionKey &&
    result?.judgment_status === "accepted" &&
    sawPendingPhase.current &&
    revealedCompletionKey !== completionKey;
  const progressPhase = showCompletionBridge ? "complete" : phase;
  if (completionKey && completionTime.current.key !== completionKey) {
    completionTime.current = {
      key: completionKey,
      value: completedAt ?? Date.now(),
    };
  }
  useEffect(() => {
    if (!showCompletionBridge || !completionKey) return;
    const timer = window.setTimeout(() => {
      sawPendingPhase.current = false;
      setRevealedCompletionKey(completionKey);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [completionKey, showCompletionBridge]);
  useLayoutEffect(() => {
    if (
      !completionKey ||
      showCompletionBridge ||
      shownCompletion.current === completionKey
    )
      return;
    shownCompletion.current = completionKey;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    completionHeading.current?.focus({ preventScroll: true });
  }, [completionKey, showCompletionBridge]);
  // Detail state is scoped to one immutable result; stale fact IDs never carry over.
  if (previousResult.current !== resultKey) {
    previousResult.current = resultKey;
    if (openReason !== null) setOpenReason(null);
    if (more) setMore(false);
  }
  if (phase !== "done" || showCompletionBridge)
    return (
      <section
        className="service-fast fast-result-page fast-pending"
        aria-labelledby="fast-title"
      >
        <h1 className="sr-only" id="fast-title">
          {progressPhase === "complete"
            ? "빠른 분석 완료"
            : "빠른 분석 진행 중"}
        </h1>
        <div className="fast-pending-preview" aria-hidden="true">
          <header className="fast-result-heading fast-pending-heading fast-pending-component">
            <div className="fast-result-heading-copy">
              <span className="fast-skeleton-line is-eyebrow" />
              <span className="fast-skeleton-line is-title" />
              <span className="fast-skeleton-line is-intro" />
            </div>
          </header>
          <div className="fast-verdict-card fast-pending-verdict">
            <span className="fast-skeleton-icon" />
            <div className="fast-pending-verdict-copy">
              <span className="fast-skeleton-line is-verdict" />
              <span className="fast-skeleton-line is-summary" />
            </div>
          </div>
          <div className="fast-meta-strip fast-pending-meta fast-pending-component">
            <div className="fast-meta-item">
              <span className="fast-skeleton-line is-label" />
              <span className="fast-skeleton-line is-meta" />
            </div>
            <div className="fast-meta-item fast-meta-kind">
              <span className="fast-skeleton-line is-label" />
              <span className="fast-skeleton-line is-time" />
            </div>
          </div>
          <section className="fast-result-section fast-pending-section fast-pending-component">
            <div className="fast-result-section-heading">
              <div className="fast-result-section-title">
                <span className="fast-skeleton-line is-number" />
                <span className="fast-skeleton-line is-section-title" />
              </div>
              <span className="fast-skeleton-line is-section-copy" />
            </div>
            <div className="fast-pending-rows">
              <span className="fast-skeleton-row" />
              <span className="fast-skeleton-row" />
              <span className="fast-skeleton-row" />
            </div>
          </section>
          <section className="fast-result-section fast-pending-section fast-pending-component">
            <div className="fast-result-section-heading">
              <div className="fast-result-section-title">
                <span className="fast-skeleton-line is-number" />
                <span className="fast-skeleton-line is-section-title" />
              </div>
              <span className="fast-skeleton-line is-section-copy" />
            </div>
            <span className="fast-skeleton-row is-external" />
          </section>
          <section className="fast-result-section fast-pending-section fast-pending-component">
            <div className="fast-result-section-heading">
              <div className="fast-result-section-title">
                <span className="fast-skeleton-line is-number" />
                <span className="fast-skeleton-line is-section-title" />
              </div>
              <span className="fast-skeleton-line is-section-copy" />
            </div>
            <div className="fast-pending-request-placeholder">
              <span className="fast-skeleton-request" />
              <div className="fast-pending-request-actions">
                <span className="fast-skeleton-line is-request-option" />
                <span className="fast-skeleton-line is-request-button" />
              </div>
            </div>
          </section>
        </div>
        <div className="fast-progress-layer">
          <div
            className="fast-progress-card"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <header className="fast-progress-card-heading">
              <span className="fast-progress-eyebrow">FAST ANALYSIS</span>
              <h2>
                {progressPhase === "complete"
                  ? "분석 완료"
                  : "빠른 분석 진행 중"}
              </h2>
              <p>
                {progressPhase === "collect"
                  ? "분석에 필요한 자료를 수집하고 있습니다."
                  : progressPhase === "judge"
                    ? "수집한 자료를 바탕으로 결과를 생성하고 있습니다."
                    : "완료된 분석 결과를 화면에 표시하고 있습니다."}
              </p>
            </header>
            <ol className="fast-progress-steps" aria-label="분석 진행 단계">
              <li
                className={`fast-progress-step is-${progressPhase === "collect" ? "running" : "done"}`}
              >
                <StateMark
                  state={progressPhase === "collect" ? "running" : "done"}
                />
                <span className="fast-progress-step-copy">
                  <strong>자료 수집 중</strong>
                  <span>
                    {progressPhase === "collect" ? "진행 중" : "완료"}
                  </span>
                </span>
              </li>
              <li
                className={`fast-progress-step is-${
                  progressPhase === "collect"
                    ? "pending"
                    : progressPhase === "judge"
                      ? "running"
                      : "done"
                }`}
              >
                <StateMark
                  state={
                    progressPhase === "collect"
                      ? "pending"
                      : progressPhase === "judge"
                        ? "running"
                        : "done"
                  }
                />
                <span className="fast-progress-step-copy">
                  <strong>모델 판단 중</strong>
                  <span>
                    {progressPhase === "collect"
                      ? "대기 중"
                      : progressPhase === "judge"
                        ? "진행 중"
                        : "완료"}
                  </span>
                </span>
              </li>
            </ol>
          </div>
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
  const verdict = verdicts[judgment.verdict] ?? verdicts.UNKNOWN;
  const Icon = verdict.icon;
  const showVirusTotal = !!virustotal && virustotal.status !== "not_requested";
  const deepSectionNumber =
    1 + (judgment.reasons.length ? 1 : 0) + (showVirusTotal ? 1 : 0);
  const selectedDeepModel = deepModelSelection?.models.find(
    (model) => model.id === deepModelSelection.value,
  );
  const deepModelReady =
    !deepModelSelection ||
    (!deepModelSelection.loading &&
      !deepModelSelection.error &&
      !!selectedDeepModel &&
      (selectedDeepModel.efforts.length
        ? selectedDeepModel.efforts.includes(deepModelSelection.effort ?? "")
        : deepModelSelection.effort === null));
  return (
    <section
      className={`service-fast fast-result-page${
        revealedCompletionKey === completionKey ? " fast-result-reveal" : ""
      }`}
      aria-labelledby="fast-title"
      data-verdict-tone={verdict.tone}
      data-verdict={judgment.verdict}
    >
      <a className="text-button fast-result-back" href="/">
        <ArrowLeft size={15} aria-hidden="true" />
        다른 URL 검사
      </a>
      <header className="fast-result-heading">
        <div className="fast-result-heading-copy">
          <p className="fast-result-eyebrow">URL Security Report</p>
          <h1 className="report-title" id="fast-title">
            빠른 분석 결과
          </h1>
          <p className="fast-result-intro">
            확인된 주요 신호를 바탕으로 URL의 위험 여부를 정리했습니다.
          </p>
        </div>
        {!!judgment.reasons.length && (
          <label className="technical-option">
            <span>기술정보 표시</span>
            <input
              type="checkbox"
              role="switch"
              checked={showTechnical}
              onChange={(event) => setShowTechnical(event.target.checked)}
            />
            <span className="technical-switch" aria-hidden="true">
              <span />
            </span>
          </label>
        )}
      </header>
      <div
        className={`fast-verdict-card report-tone-${verdict.tone}`}
        aria-labelledby="verdict-title"
      >
        <div className="fast-verdict-icon-box" aria-hidden="true">
          <Icon className="verdict-icon" aria-hidden="true" />
        </div>
        <div className="fast-verdict-copy">
          <h2
            className="verdict-title"
            id="verdict-title"
            tabIndex={-1}
            ref={completionHeading}
          >
            {verdict.label}
          </h2>
          <p className="verdict-description">{judgment.summary}</p>
        </div>
      </div>
      {url && (
        <div className="fast-meta-strip" aria-label="분석 기본 정보">
          <div className="fast-meta-item">
            <span className="fast-meta-label">분석 URL</span>
            <code className="fast-meta-value">{url}</code>
          </div>
          <div className="fast-meta-item fast-meta-kind">
            <span className="fast-meta-label">분석 시간</span>
            <time
              className="fast-meta-value"
              dateTime={new Date(completionTime.current.value).toISOString()}
            >
              {formatTime(completionTime.current.value)}
            </time>
          </div>
        </div>
      )}
      {!!judgment.reasons.length && (
        <section
          className="reasons-section fast-result-section"
          id="fast-reasons"
          aria-labelledby="reasons-title"
        >
          <div className="fast-result-section-heading">
            <div className="fast-result-section-title">
              <span className="fast-result-section-number" aria-hidden="true">
                01
              </span>
              <h2 id="reasons-title">판정 이유</h2>
            </div>
            <p>확인된 주요 판단 신호입니다.</p>
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
                      <span className="reason-index" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
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
      {showVirusTotal && (
        <section
          className="fast-result-section fast-vt-section"
          aria-labelledby="fast-vt-title"
        >
          <div className="fast-result-section-heading">
            <div className="fast-result-section-title">
              <span className="fast-result-section-number" aria-hidden="true">
                {judgment.reasons.length ? "02" : "01"}
              </span>
              <h2 id="fast-vt-title">외부 판단</h2>
            </div>
            <p>외부 검사 결과이며 LinkGuard 판정과는 별도입니다.</p>
          </div>
          <VirusTotalResult result={virustotal} />
        </section>
      )}
      {result.deep_analysis.available && (
        <section
          className="fast-result-section fast-deep-analysis-section"
          aria-labelledby="deep-request-title"
        >
          <div className="fast-result-section-heading">
            <div className="fast-result-section-title">
              <span className="fast-result-section-number" aria-hidden="true">
                {String(deepSectionNumber).padStart(2, "0")}
              </span>
              <h2 id="deep-request-title">추가 분석</h2>
            </div>
            <p>필요한 내용을 입력하고 모델을 선택해 심층 분석을 시작합니다.</p>
          </div>
          <div className={`result-bottom${deepRequest ? " has-request" : ""}`}>
            <div className="service-deep-request">
              <div className="deep-request-control">
                {deepRequest && (
                  <div className="deep-request-field">
                    <textarea
                      id="deep-request-text"
                      rows={3}
                      value={deepRequest.value}
                      onChange={(event) =>
                        deepRequest.onChange(event.target.value)
                      }
                      disabled={deepPending}
                      aria-label="심층 분석 요청 사항"
                      aria-invalid={!!deepRequest.error}
                      aria-describedby={
                        deepRequest.error
                          ? "deep-request-error deep-request-count"
                          : "deep-request-count"
                      }
                      placeholder="확인하고 싶은 내용을 작성해주세요. (예: 로그인 정보가 어디로 전송되는지 확인해 주세요.)"
                    />
                    <div className="deep-request-help">
                      {deepRequest.error && (
                        <p id="deep-request-error" role="alert">
                          {deepRequest.error}
                        </p>
                      )}
                      <span id="deep-request-count">
                        {Array.from(
                          deepRequest.value.trim(),
                        ).length.toLocaleString()}{" "}
                        / 2,000자
                      </span>
                    </div>
                  </div>
                )}
                <div className="entry-options deep-request-actions">
                  {deepModelSelection && (
                    <AnalysisModelPicker
                      authenticated
                      selection={deepModelSelection}
                    />
                  )}
                  <Button
                    onClick={onDeep}
                    disabled={
                      deepPending || !!deepRequest?.error || !deepModelReady
                    }
                  >
                    {deepPending ? (
                      <>
                        <Spinner size={16} />
                        심층 분석 시작 중
                      </>
                    ) : (
                      <>
                        심층 분석 시작
                        <ChevronRight size={16} aria-hidden="true" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
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

function CapturePreview({
  snapshot,
  onExpand,
}: {
  snapshot: DeepSnapshot;
  onExpand?: (url: string) => void;
}) {
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
            onClick={() =>
              onExpand ? onExpand(url) : dialog.current?.showModal()
            }
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
          {!onExpand && (
            <dialog
              className="capture-dialog"
              ref={dialog}
              aria-labelledby="capture-dialog-title"
              onClick={(event) => {
                if (event.target === event.currentTarget)
                  dialog.current?.close();
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
          )}
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
const deepStepStatusLabels = {
  pending: "대기",
  running: "진행 중",
  done: "완료",
  stopped: "중단",
};
export function DeepResultView({
  snapshot,
  url,
  onClose,
}: {
  snapshot: DeepSnapshot;
  url: string;
  onClose?: () => void;
}) {
  const shownCompletion = useRef<string | null>(null);
  const conclusionHeading = useRef<HTMLHeadingElement>(null);
  const sawRunningPhase = useRef(
    snapshot.status !== "completed" && snapshot.status !== "failed",
  );
  const [openRunningWork, setOpenRunningWork] = useState<string | null>(null);
  const [expandedCaptureUrl, setExpandedCaptureUrl] = useState<string | null>(
    null,
  );
  const [revealedCompletionKey, setRevealedCompletionKey] = useState<
    string | null
  >(null);
  const phase = deepPhase(snapshot);
  const final = snapshot.result;
  const failed = snapshot.status === "failed";
  const cancelled = snapshot.status === "cancelled";
  const ended = failed || cancelled || snapshot.status === "completed";
  const noExtraWork = snapshot.status === "completed" && !snapshot.works.length;
  const completionKey =
    final && snapshot.status === "completed" && !failed
      ? snapshot.run_id
      : null;
  if (snapshot.status !== "completed" && !failed && !cancelled)
    sawRunningPhase.current = true;
  const showCompletionBridge =
    !!completionKey &&
    sawRunningPhase.current &&
    revealedCompletionKey !== completionKey;
  const visiblePhase = showCompletionBridge ? 4 : phase;
  useEffect(() => {
    if (!showCompletionBridge || !completionKey) return;
    setExpandedCaptureUrl(null);
    const timer = window.setTimeout(() => {
      sawRunningPhase.current = false;
      setRevealedCompletionKey(completionKey);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [completionKey, showCompletionBridge]);
  useLayoutEffect(() => {
    if (
      !ended ||
      showCompletionBridge ||
      shownCompletion.current === snapshot.run_id
    )
      return;
    shownCompletion.current = snapshot.run_id;
    // One immediate jump per run. Stream updates never pull the reader back.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    conclusionHeading.current?.focus({ preventScroll: true });
  }, [!!final, failed, showCompletionBridge, snapshot.run_id]);
  const current = [...snapshot.managers]
    .reverse()
    .find((manager) => manager.summary);
  const runningManager = snapshot.managers.find(
    (manager) => manager.status === "running",
  );
  const managerText = current?.summary;
  const stateForStep = (index: number) =>
    noExtraWork && index === 2
      ? ("stopped" as const)
      : index < visiblePhase || (index === 4 && visiblePhase === 4)
        ? ("done" as const)
        : index === visiblePhase
          ? failed
            ? ("stopped" as const)
            : ("running" as const)
          : ("pending" as const);
  if (!ended || showCompletionBridge || cancelled)
    return (
      <section
        className="service-deep deep-running-page"
        aria-labelledby="deep-title"
        data-lg-role="stage"
        data-publish-seq={snapshot.publish_seq}
      >
        <div className="deep-running-preview" aria-hidden="true">
          <header className="deep-running-preview-heading deep-running-preview-component">
            <span className="fast-skeleton-line is-eyebrow" />
            <span className="fast-skeleton-line is-title" />
          </header>
          <section className="deep-running-preview-summary deep-running-preview-component">
            <span className="fast-skeleton-line is-section-title" />
            <span className="fast-skeleton-line is-summary" />
            <span className="fast-skeleton-line is-intro" />
          </section>
          <div className="deep-running-preview-columns">
            <div className="deep-running-preview-primary">
              <section className="deep-running-preview-component">
                <span className="fast-skeleton-line is-label" />
                <div className="deep-running-preview-stage-row">
                  {stepLabels.map((label) => (
                    <span className="fast-skeleton-line is-stage" key={label} />
                  ))}
                </div>
              </section>
              <section className="deep-running-preview-component">
                <span className="fast-skeleton-line is-section-title" />
                <div className="deep-running-preview-rows">
                  {Array.from({ length: 4 }, (_, index) => (
                    <span className="fast-skeleton-row" key={index} />
                  ))}
                </div>
              </section>
              <section className="deep-running-preview-component">
                <span className="fast-skeleton-line is-label" />
                <span className="fast-skeleton-line is-meta" />
              </section>
            </div>
            <aside className="deep-running-preview-rail">
              <section className="deep-running-preview-component">
                <span className="fast-skeleton-line is-section-title" />
                <span className="fast-skeleton-request" />
              </section>
              <section className="deep-running-preview-component">
                <span className="fast-skeleton-line is-section-title" />
                <span className="fast-skeleton-row is-external" />
              </section>
            </aside>
          </div>
          <div className="deep-running-preview-lower">
            <section className="deep-running-preview-component">
              <span className="fast-skeleton-line is-section-title" />
              <div className="deep-running-preview-rows">
                {Array.from({ length: 3 }, (_, index) => (
                  <span className="fast-skeleton-row" key={index} />
                ))}
              </div>
            </section>
            <section className="deep-running-preview-component">
              <span className="fast-skeleton-line is-section-title" />
              <div className="deep-running-preview-rows">
                {Array.from({ length: 2 }, (_, index) => (
                  <span className="fast-skeleton-row is-external" key={index} />
                ))}
              </div>
            </section>
          </div>
        </div>
        <div
          className={`deep-running-card${expandedCaptureUrl ? " is-capture-expanded" : ""}`}
        >
          {cancelled ? (
            <div
              className="deep-running-cancelled"
              role="status"
              aria-live="polite"
            >
              <StateMark state="stopped" />
              <span className="deep-running-eyebrow">DEEP ANALYSIS</span>
              <h1 id="deep-title" ref={conclusionHeading} tabIndex={-1}>
                분석이 취소되었습니다.
              </h1>
              <p>요청한 심층 분석이 중단되었습니다.</p>
              {onClose && (
                <Button variant="secondary" onClick={onClose}>
                  닫기
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="sr-only" role="status" aria-live="polite">
                {showCompletionBridge
                  ? "심층 분석 완료. 분석 결과를 준비하고 있습니다."
                  : `${stepLabels[visiblePhase]} 단계 진행 중`}
              </p>
              <div className="deep-running-overview">
                <div className="deep-running-progress-panel">
                  <header className="deep-running-heading">
                    <span className="deep-running-eyebrow">DEEP ANALYSIS</span>
                    <h1 id="deep-title" ref={conclusionHeading} tabIndex={-1}>
                      {showCompletionBridge
                        ? "심층 분석 완료"
                        : "심층 분석 진행 중"}
                    </h1>
                    <p>
                      {showCompletionBridge
                        ? "분석 결과를 준비했습니다."
                        : `${stepLabels[visiblePhase]} 단계입니다.`}
                    </p>
                  </header>
                  <div className="deep-running-steps-scroll">
                    <ol
                      className="deep-running-steps"
                      aria-label="심층 분석 진행 단계"
                    >
                      {stepLabels.map((label, index) => {
                        const state = stateForStep(index);
                        return (
                          <li
                            className={`deep-running-step is-${state}`}
                            key={label}
                          >
                            <StateMark state={state} />
                            <strong>{label}</strong>
                            <span>{deepStepStatusLabels[state]}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>
                <aside className="deep-running-capture">
                  <CapturePreview
                    snapshot={snapshot}
                    onExpand={setExpandedCaptureUrl}
                  />
                </aside>
              </div>
              <section
                className="deep-running-works"
                aria-labelledby="deep-running-works-title"
              >
                <div className="deep-running-works-heading">
                  <h2 id="deep-running-works-title">업무 목록</h2>
                  {!!snapshot.works.length && (
                    <span className="finding-count">
                      {snapshot.works.length}
                    </span>
                  )}
                </div>
                {snapshot.works.length ? (
                  <ol className="deep-running-work-list">
                    {snapshot.works.map((work, workIndex) => {
                      const workStatus = workState(work, snapshot);
                      const tasks = snapshot.tasks.filter(
                        (task) => task.work_id === work.id,
                      );
                      const detailId = `deep-running-work-${workIndex}`;
                      const open = openRunningWork === work.id;
                      return (
                        <li className="deep-running-work" key={work.id}>
                          <button
                            className="deep-running-work-toggle"
                            type="button"
                            aria-expanded={open}
                            aria-controls={detailId}
                            onClick={() =>
                              setOpenRunningWork(open ? null : work.id)
                            }
                          >
                            <StateMark state={workStatus.state} />
                            <span className="deep-running-work-title">
                              {work.title || work.question}
                            </span>
                            <span className="deep-running-work-status">
                              {workStatus.label}
                            </span>
                            <ChevronDown
                              size={16}
                              className={open ? "rotated" : ""}
                              aria-hidden="true"
                            />
                          </button>
                          <div
                            className="deep-running-work-findings"
                            id={detailId}
                            hidden={!open}
                          >
                            {tasks.length ? (
                              <ol>
                                {tasks.map((task) => {
                                  const taskStatus = taskPresentation(
                                    task,
                                    snapshot.status,
                                  );
                                  const report = taskReport(task, snapshot);
                                  return (
                                    <li key={task.id}>
                                      <StateMark state={taskStatus.state} />
                                      <div>
                                        <strong>
                                          {task.title || "확인 작업"}
                                        </strong>
                                        {report && <p>{report.summary}</p>}
                                      </div>
                                      <span>{taskStatus.label}</span>
                                    </li>
                                  );
                                })}
                              </ol>
                            ) : (
                              <p>확인 항목을 준비하고 있습니다.</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="deep-running-works-empty">
                    <Spinner size={16} />
                    확인할 업무를 구성하고 있습니다.
                  </p>
                )}
              </section>
              {expandedCaptureUrl && (
                <div
                  className="deep-running-capture-expanded"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="deep-running-capture-expanded-title"
                  onClick={(event) => {
                    if (event.target === event.currentTarget)
                      setExpandedCaptureUrl(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setExpandedCaptureUrl(null);
                  }}
                >
                  <div className="deep-running-capture-expanded-header">
                    <h2 id="deep-running-capture-expanded-title">
                      브라우저 캡쳐화면
                    </h2>
                    <button
                      className="copy-button"
                      type="button"
                      aria-label="캡처 화면 닫기"
                      autoFocus
                      onClick={() => setExpandedCaptureUrl(null)}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <img
                    src={expandedCaptureUrl}
                    alt="심층 분석 중 확보한 웹페이지 화면 확대"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>
    );
  return (
    <section
      className="service-deep"
      data-result-reveal={
        revealedCompletionKey === completionKey ? "true" : undefined
      }
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
                const state = stateForStep(index);
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
