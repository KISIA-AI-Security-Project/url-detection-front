import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleHelp,
  ListChecks,
  ScanSearch,
  X,
} from "lucide-react";
import {
  defaultLayer,
  layers,
  rankEvidence,
  resultFor,
  verdicts,
} from "../data/results";
import { analysisService, demoJob } from "../lib/mock-service";
import { reportFor } from "../data/report";
import type { AnalysisJob, Evidence, Layer } from "../lib/types";
import { displayHost, formatDuration, formatTime } from "../lib/url";
import {
  Button,
  Footer,
  Header,
  Spinner,
  StatusIcon,
  TechnicalValue,
} from "../components/ui";

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const LAYER_TRANSITION_MS = 300;

function keepExpandedItemInView(target: HTMLElement | null) {
  if (!target) return;
  const bounds = target.getBoundingClientRect();
  if (bounds.top >= 0 && bounds.bottom <= window.innerHeight) return;
  target.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: bounds.height > window.innerHeight ? "start" : "nearest",
  });
}

function EvidenceItem({
  evidence,
  open,
  onToggle,
}: {
  evidence: Evidence;
  open: boolean;
  onToggle: () => void;
}) {
  useEffect(() => {
    if (!open || !prefersReducedMotion()) return;
    const frame = window.requestAnimationFrame(() =>
      keepExpandedItemInView(
        document.getElementById(`evidence-${evidence.id}`),
      ),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [evidence.id, open]);
  return (
    <article
      id={`evidence-${evidence.id}`}
      className={`evidence-detail ${open ? "is-open" : ""}`}
      tabIndex={-1}
    >
      <button
        className="evidence-trigger"
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`detail-${evidence.id}`}
      >
        <span className="evidence-title-group">
          <span className="evidence-title">{evidence.title}</span>
          <span className="technical-label">{evidence.label}</span>
        </span>
        <span className="evidence-trigger-meta">
          <span className={`evidence-status ${evidence.severity}`}>
            {verdicts[evidence.severity].text}
          </span>
          <ChevronDown className={open ? "rotated" : ""} size={18} />
        </span>
      </button>
      <div
        className={`evidence-panel ${open ? "is-open" : ""}`}
        id={`detail-${evidence.id}`}
        aria-hidden={!open}
        inert={!open}
        onTransitionEnd={(event) => {
          if (
            open &&
            event.target === event.currentTarget &&
            event.propertyName === "grid-template-rows"
          ) {
            keepExpandedItemInView(
              document.getElementById(`evidence-${evidence.id}`),
            );
          }
        }}
      >
        <div className="evidence-panel-inner">
          <div className="evidence-expanded">
            <p className="evidence-description">{evidence.description}</p>
            <div className="raw-values" id={`raw-${evidence.id}`}>
              {evidence.values.map((item) => (
                <TechnicalValue
                  key={item.key}
                  label={item.key}
                  value={item.value}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
export function AnalysisResult({
  job,
  preview = false,
}: {
  job: AnalysisJob;
  preview?: boolean;
}) {
  const result = resultFor(job);
  const report = reportFor(job, result);
  const hasDetailData = !["unknown", "stub", "blocked"].includes(job.scenario);
  const [expanded, setExpanded] = useState<Set<Layer>>(
    () => new Set([defaultLayer(result.evidence)]),
  );
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(
    () => new Set(),
  );
  const keyEvidence = rankEvidence(result.evidence, 5);
  const toggle = (id: Layer) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleEvidence = (id: string) =>
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const collapseLayerEvidence = (layer: Layer) =>
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      result.evidence
        .filter((evidence) => evidence.layer === layer)
        .forEach((evidence) => next.delete(evidence.id));
      return next.size === prev.size ? prev : next;
    });
  const jump = (evidence: Evidence) => {
    setExpanded((prev) => new Set([...prev, evidence.layer]));
    window.setTimeout(() => {
      const target = document.getElementById(`evidence-${evidence.id}`);
      target?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "center",
      });
      target?.focus({ preventScroll: true });
    }, LAYER_TRANSITION_MS + 10);
  };
  return (
    <>
      <Header />
      <main className="report-main fade-in">
        <div className="report-heading">
          <h1 id="report-title">분석 결과</h1>
        </div>
        <article
          id="final-verdict"
          className={`report-card report-tone-${report.tone}`}
          aria-labelledby="verdict-title"
        >
          {report.notice && (
            <p className="report-notice" role="note">
              {report.notice}
            </p>
          )}
          <div className="verdict-intro">
            <div className="verdict-copy">
              <span className="section-label">최종 판정</span>
              <div className="verdict-heading">
                <span className="verdict-emblem" aria-hidden="true">
                  {report.tone === "unknown" ? (
                    <CircleHelp size={24} />
                  ) : (
                    <StatusIcon verdict={report.tone} size={24} />
                  )}
                </span>
                <h2 id="verdict-title">{report.label}</h2>
              </div>
              <p className="verdict-description">
                {hasDetailData ? result.summary : report.reasons[0]}
              </p>
            </div>
          </div>
          <div className="report-url" aria-label="분석 대상 URL">
            <TechnicalValue value={job.url} />
          </div>
          <div className="report-facts">
            <section
              className="report-fact"
              aria-labelledby="report-completed-title"
            >
              <h3 id="report-completed-title">분석 완료</h3>
              <p className="report-fact-value">
                <time dateTime={new Date(job.completesAt).toISOString()}>
                  {formatTime(job.completesAt)}
                </time>
              </p>
              <p className="report-fact-note">심층 분석이 완료된 시각</p>
            </section>
            <section
              className="report-fact"
              aria-labelledby="report-duration-title"
            >
              <h3 id="report-duration-title">소요 시간</h3>
              <p className="report-fact-value">
                {formatDuration(job.completesAt - job.createdAt)}
              </p>
              <p className="report-fact-note">
                분석 시작부터 완료까지 걸린 시간
              </p>
            </section>
            <section
              className="report-fact"
              aria-labelledby="report-confidence-title"
            >
              <h3 id="report-confidence-title">판정 신뢰도</h3>
              <p
                className={`report-fact-value report-confidence ${report.confidence === null ? "is-unavailable" : ""}`}
              >
                {report.confidence ??
                  (report.tone === "unknown" ? "산정 불가" : "정보 없음")}
              </p>
              <p className="report-fact-note">
                {report.confidence !== null
                  ? "판정 결과에 대한 신뢰도"
                  : report.tone === "unknown"
                    ? "확보된 정보로 신뢰도를 산정할 수 없습니다."
                    : "제공된 신뢰도 값이 없습니다."}
              </p>
            </section>
            <section
              className="report-fact"
              aria-labelledby="report-coverage-title"
            >
              <h3 id="report-coverage-title">분석 범위</h3>
              {report.coverage ? (
                <>
                  <div className="report-layer-tags">
                    {report.coverage.layerIds.map((layer) => (
                      <span key={layer}>{layer}</span>
                    ))}
                  </div>
                  <p className="report-fact-note">
                    {report.coverage.checked.join(" · ") || "확인된 영역 없음"}
                  </p>
                </>
              ) : (
                <p className="report-fact-note">범위 정보 없음</p>
              )}
              {!!report.coverage?.skipped.length && (
                <p className="report-fact-note">
                  <strong>미실행 영역</strong>
                  <br />
                  {report.coverage.skipped.join(" · ")}
                </p>
              )}
              {!!report.coverage?.stubbed.length && (
                <p className="report-fact-note">
                  <strong>시험용 데이터 사용</strong>
                  <br />
                  {report.coverage.stubbed.join(" · ")}
                </p>
              )}
            </section>
          </div>
          {!!report.limitations.length && (
            <section
              className="report-limitations"
              aria-labelledby="report-limitations-title"
            >
              <h3 id="report-limitations-title">분석 한계</h3>
              <ul className="report-reasons">
                {report.limitations.map((limitation, index) => (
                  <li key={index}>{limitation}</li>
                ))}
              </ul>
            </section>
          )}
        </article>
        <section className="key-section" aria-labelledby="key-title">
          <div className="section-heading">
            <div className="section-heading-copy">
              <div className="section-title-row">
                <span className="section-title-icon" aria-hidden="true">
                  <ListChecks size={18} />
                </span>
                <h2 id="key-title">
                  핵심 근거{" "}
                  <span className="finding-count">{keyEvidence.length}</span>
                </h2>
              </div>
              <p>최종 판정에 주요하게 반영된 신호입니다.</p>
            </div>
            <span className="section-hint">선택하여 상세 확인</span>
          </div>
          <div className="key-card">
            {keyEvidence.length ? (
              keyEvidence.map((e) => (
                <button
                  className="key-evidence"
                  key={e.id}
                  onClick={() => jump(e)}
                >
                  <span className="key-evidence-copy">
                    <span className="key-evidence-title">{e.title}</span>
                    <span className="key-evidence-description">
                      {e.keySummary}
                    </span>
                  </span>
                  <span className="key-evidence-layer">{e.layer}</span>
                </button>
              ))
            ) : (
              <div className="empty-evidence">
                {hasDetailData
                  ? "특이사항이 확인되지 않았습니다."
                  : "제공된 핵심 근거가 없습니다."}
              </div>
            )}
          </div>
        </section>
        <section className="analysis-sections" aria-labelledby="analysis-title">
          <div className="section-heading">
            <div className="section-heading-copy">
              <div className="section-title-row">
                <span className="section-title-icon" aria-hidden="true">
                  <ScanSearch size={18} />
                </span>
                <h2 id="analysis-title">상세 분석</h2>
              </div>
              <p>
                {hasDetailData
                  ? "세 가지 관점에서 링크의 안전성을 살펴봤습니다."
                  : "현재 응답에는 영역별 상세 근거가 포함되어 있지 않습니다."}
              </p>
            </div>
          </div>
          {layers.map((layer) => {
            const findings = result.evidence.filter(
              (e) => e.layer === layer.id,
            );
            const open = expanded.has(layer.id);
            return (
              <section
                id={`analysis-layer-${layer.id}`}
                className={`analysis-layer ${open ? "is-open" : ""}`}
                key={layer.id}
              >
                <h3>
                  <button
                    className="accordion-trigger"
                    onClick={() => {
                      toggle(layer.id);
                      if (open && prefersReducedMotion()) {
                        collapseLayerEvidence(layer.id);
                      }
                      if (!open && prefersReducedMotion()) {
                        window.requestAnimationFrame(() =>
                          keepExpandedItemInView(
                            document.getElementById(
                              `analysis-layer-${layer.id}`,
                            ),
                          ),
                        );
                      }
                    }}
                    aria-expanded={open}
                    aria-controls={`layer-${layer.id}`}
                  >
                    <span className="layer-heading">
                      <span>
                        <span className="layer-name">{layer.title}</span>
                        <span className="count-badge">{findings.length}</span>
                      </span>
                      <span className="layer-subtitle">{layer.subtitle}</span>
                    </span>
                    <span className="layer-id">{layer.id}</span>
                    <ChevronDown className={open ? "rotated" : ""} size={18} />
                  </button>
                </h3>
                <div
                  className={`layer-panel ${open ? "is-open" : ""}`}
                  id={`layer-${layer.id}`}
                  aria-hidden={!open}
                  inert={!open}
                  onTransitionEnd={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      event.propertyName === "grid-template-rows"
                    ) {
                      if (open) {
                        keepExpandedItemInView(
                          document.getElementById(`analysis-layer-${layer.id}`),
                        );
                      } else {
                        collapseLayerEvidence(layer.id);
                      }
                    }
                  }}
                >
                  <div className="layer-panel-inner">
                    <div className="layer-content">
                      <p className="layer-summary">
                        {hasDetailData ? (
                          <>
                            검사된 항목 {layer.checked}개<span>·</span>의미 있는
                            근거 {findings.length}개
                          </>
                        ) : (
                          "상세 분석 데이터가 제공되지 않았습니다."
                        )}
                      </p>
                      {findings.length ? (
                        findings.map((e) => (
                          <EvidenceItem
                            key={e.id}
                            evidence={e}
                            open={expandedEvidence.has(e.id)}
                            onToggle={() => toggleEvidence(e.id)}
                          />
                        ))
                      ) : (
                        <div className="empty-layer">
                          {hasDetailData
                            ? "특이사항이 확인되지 않았습니다."
                            : "이 영역의 상세 근거를 확인할 수 없습니다."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </section>
        <div className="report-disclaimer">
          <p>
            이 결과는 분석 시점에 확인한 신호를 바탕으로 합니다. 사이트의
            안전성을 보장하지 않으며, 이후 콘텐츠나 동작이 달라질 수 있습니다.
            <br />
            <span>
              현재 화면은 실제 보안 검사 없이 제공되는 목업 데이터입니다.
            </span>
          </p>
        </div>
        <Footer preview={preview} />
      </main>
    </>
  );
}
type ViewState =
  | "loading_job"
  | "scanning"
  | "reconnecting"
  | "status_fetch_error"
  | "completed"
  | "cancelled"
  | "failed"
  | "missing";
export function AnalysisPage({ id }: { id?: string }) {
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [state, setState] = useState<ViewState>("loading_job");
  const [settled, setSettled] = useState(false);
  const [retry, setRetry] = useState(0);
  const previousStatus = useRef<ViewState>("loading_job");
  useEffect(() => {
    if (!id) return;
    let failures = 0;
    const tick = () => {
      const next = analysisService.getJob(id);
      if (!next) {
        setState("missing");
        return;
      }
      setJob(next);
      const age = Date.now() - next.createdAt;
      // Deterministic mock transport failures, independent of the job's own status.
      if (
        next.status !== "cancelled" &&
        ((next.scenario === "reconnecting" && age < 3000) ||
          (next.scenario === "status-error" && retry === 0))
      ) {
        failures += 1;
        setState(failures > 5 ? "status_fetch_error" : "reconnecting");
        return;
      }
      failures = 0;
      setState(next.status);
    };
    tick();
    const interval = window.setInterval(tick, 600);
    return () => window.clearInterval(interval);
  }, [id, retry]);
  useEffect(() => {
    if (state === "completed") {
      const shouldScroll = ["scanning", "reconnecting"].includes(
        previousStatus.current,
      );
      const timeout = window.setTimeout(() => {
        setSettled(true);
        if (shouldScroll)
          window.setTimeout(
            () =>
              document
                .getElementById("final-verdict")
                ?.scrollIntoView({ block: "start" }),
            0,
          );
      }, 350);
      return () => window.clearTimeout(timeout);
    }
    previousStatus.current = state;
  }, [state]);
  if (!id) return <AnalysisResult job={demoJob()} preview />;
  if (state === "completed" && settled && job)
    return <AnalysisResult job={job} />;
  const cancel = () => {
    if (job) {
      const updated = analysisService.cancel(job.id);
      setJob(updated);
      setState(updated?.status || "missing");
    }
  };
  return (
    <>
      <Header />
      <main className="state-main">
        <div className="state-meta">
          <span className="eyebrow">DEEP ANALYSIS</span>
          {job && <span className="state-domain">{displayHost(job.url)}</span>}
        </div>
        <div className="state-content" role="status" aria-live="polite">
          {["loading_job", "scanning", "reconnecting"].includes(state) ? (
            <>
              <div className="state-icon blue">
                <Spinner size={32} />
              </div>
              <h1>
                {state === "reconnecting"
                  ? "연결을 다시 확인하는 중입니다..."
                  : state === "loading_job"
                    ? "분석 상태를 불러오는 중..."
                    : "스캔 중..."}
              </h1>
              <p>
                페이지를 닫거나 새로고침해도
                <br />
                분석 상태는 유지됩니다.
              </p>
              {state !== "loading_job" && (
                <Button variant="secondary" onClick={cancel}>
                  분석 취소
                </Button>
              )}
            </>
          ) : state === "completed" ? (
            <>
              <div className="state-icon safe">
                <Check size={30} />
              </div>
              <h1>완료</h1>
            </>
          ) : state === "cancelled" ? (
            <>
              <div className="state-icon">
                <X size={28} />
              </div>
              <h1>분석이 취소되었습니다.</h1>
              <p>요청한 심층 분석이 중단되었습니다.</p>
              <CloseButton />
            </>
          ) : state === "status_fetch_error" ? (
            <>
              <div className="state-icon">
                <CircleHelp size={30} />
              </div>
              <h1>상태를 불러오지 못했습니다.</h1>
              <p>
                연결 상태를 확인한 뒤 다시 시도해주세요.
                <br />
                진행 중인 분석은 유지됩니다.
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setState("loading_job");
                  setRetry((v) => v + 1);
                }}
              >
                다시 시도
              </Button>
            </>
          ) : (
            <>
              <div className="state-icon">
                <CircleHelp size={30} />
              </div>
              <h1>
                {state === "missing"
                  ? "분석 결과를 찾을 수 없습니다."
                  : "심층 분석을 완료하지 못했습니다."}
              </h1>
              <p>
                {state === "missing" ? (
                  "이 브라우저에 저장된 분석이 없거나 올바르지 않은 분석 주소입니다."
                ) : (
                  <>
                    분석 과정에서 오류가 발생했습니다.
                    <br />
                    잠시 후 다시 시도해주세요.
                  </>
                )}
              </p>
              <CloseButton />
            </>
          )}
        </div>
        <Footer />
      </main>
    </>
  );
}
// A regular browser tab may refuse window.close(); keep the fallback on this job.
function CloseButton() {
  const [hint, setHint] = useState(false);
  const close = () => {
    window.close();
    window.setTimeout(() => setHint(true), 100);
  };
  return (
    <>
      <Button variant="secondary" onClick={close}>
        닫기
      </Button>
      {hint && (
        <p className="close-hint" role="status">
          브라우저의 탭 닫기 버튼으로 닫을 수 있습니다.
        </p>
      )}
    </>
  );
}
