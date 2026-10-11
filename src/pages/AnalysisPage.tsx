import { Fragment, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
} from "lucide-react";
import { rankEvidence, resultFor, verdicts } from "../data/results";
import { analysisService, demoJob } from "../lib/mock-service";
import { investigationService } from "../lib/mock-investigation";
import { deepHref } from "../lib/platform";
import { reportFor, type ReportTone } from "../data/report";
import type { AnalysisJob, Evidence, Reason, RedirectHop } from "../lib/types";
import { formatDuration, formatTime } from "../lib/url";
import {
  Button,
  Footer,
  Header,
  Spinner,
  TechnicalValue,
} from "../components/ui";

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Keeps each item whole when a list wraps, so "클로킹·행동" never splits.
function InlineList({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, index) => (
        <Fragment key={item}>
          {index > 0 && " "}
          <span className="inline-list-item">
            {item}
            {index < items.length - 1 && " ·"}
          </span>
        </Fragment>
      ))}
    </>
  );
}

function keepExpandedItemInView(target: HTMLElement | null) {
  if (!target) return;
  const bounds = target.getBoundingClientRect();
  if (bounds.top >= 0 && bounds.bottom <= window.innerHeight) return;
  target.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: bounds.height > window.innerHeight ? "start" : "nearest",
  });
}

// A confirmed fact, shown in full under the reason that cites it.
function FactItem({ fact }: { fact: Evidence }) {
  return (
    <article
      id={`fact-${fact.id}`}
      className={`fact-item severity-${fact.severity}`}
    >
      <div className="fact-head">
        <h4 className="fact-title">{fact.title}</h4>
        <span className={`severity-chip ${fact.severity}`}>
          {verdicts[fact.severity].text}
        </span>
      </div>
      <p className="technical-label">
        {fact.label} · {fact.layer}
      </p>
      <p className="fact-description">{fact.description}</p>
      <div className="raw-values">
        {fact.values.map((item) => (
          <TechnicalValue key={item.key} label={item.key} value={item.value} />
        ))}
      </div>
    </article>
  );
}
function ReasonItem({ reason, facts }: { reason: Reason; facts: Evidence[] }) {
  const [open, setOpen] = useState(false);
  const panelId = `reason-facts-${reason.id}`;
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() =>
      keepExpandedItemInView(document.getElementById(panelId)),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [open, panelId]);
  return (
    <li className={`reason-item ${open ? "is-open" : ""}`}>
      <div className="reason-row">
        <p className="reason-text">{reason.text}</p>
        {facts.length > 0 && (
          <button
            type="button"
            className="text-button reason-toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
          >
            {open ? "관련 사실 접기" : `관련 사실 보기 (${facts.length})`}
            <ChevronDown size={14} className={open ? "rotated" : ""} />
          </button>
        )}
      </div>
      {open && (
        <div className="reason-facts fade-in" id={panelId}>
          {facts.map((fact) => (
            <FactItem key={fact.id} fact={fact} />
          ))}
        </div>
      )}
    </li>
  );
}
const verdictIcons: Record<ReportTone, typeof ShieldX> = {
  danger: ShieldX,
  caution: TriangleAlert,
  safe: ShieldCheck,
  unknown: CircleHelp,
};
function VerdictIcon({ tone }: { tone: ReportTone }) {
  const Icon = verdictIcons[tone];
  return <Icon className="verdict-icon" aria-hidden="true" strokeWidth={2.2} />;
}
const statusLabels: Record<number, string> = {
  301: "영구 이동",
  302: "임시 이동",
  303: "다른 주소로 이동",
  307: "임시 이동",
  308: "영구 이동",
};
// Compact "start → final" line under the analyzed URL. Intermediate hops stay
// folded so the path never competes with the verdict for attention.
function RedirectSummary({ chain }: { chain: RedirectHop[] }) {
  const [open, setOpen] = useState(false);
  const final = chain[chain.length - 1];
  const hops = chain.slice(1, -1);
  return (
    <div className="redirect-summary" id="redirect-path">
      <p className="redirect-meta">
        <span className="redirect-arrow" aria-hidden="true">
          →
        </span>
        <span className="fact-label">최종 도착</span>
        <span className="redirect-count">{chain.length - 1}회 이동</span>
      </p>
      <TechnicalValue value={final.url} label="최종 도착 URL" hideLabel />
      {hops.length > 0 && (
        <>
          <button
            type="button"
            className="text-button redirect-toggle"
            aria-expanded={open}
            aria-controls="redirect-hops"
            onClick={() => setOpen(!open)}
          >
            경유지 {hops.length}곳 {open ? "접기" : "보기"}
            <ChevronDown size={14} className={open ? "rotated" : ""} />
          </button>
          {open && (
            <ol className="redirect-hops" id="redirect-hops">
              {chain.slice(0, -1).map((hop, index) => (
                <li key={`${index}-${hop.url}`}>
                  <span className="hop-step">
                    {index === 0 ? "출발" : `경유 ${index}`} · {hop.status}
                    {statusLabels[hop.status] && ` ${statusLabels[hop.status]}`}
                  </span>
                  <code>{hop.url}</code>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
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
  const keyEvidence = rankEvidence(result.evidence, 5);
  const verdictKeywords = [...new Set(keyEvidence.map((e) => e.keyword))];
  const factsById = new Map(result.evidence.map((e) => [e.id, e]));
  // Without structured facts (unknown / stub / blocked), the gateway's own
  // reasons are listed as plain sentences.
  const reasons: Reason[] = hasDetailData
    ? result.reasons
    : report.reasons.map((text, index) => ({
        id: `report-${index}`,
        text,
        factIds: [],
      }));
  return (
    <>
      <Header />
      <main className="report-main fade-in">
        <h1 id="report-title" className="report-title">
          분석 결과
        </h1>
        <article
          id="final-verdict"
          className={`report-verdict report-tone-${report.tone}`}
          aria-labelledby="verdict-title"
        >
          {report.notice && (
            <p className="report-notice" role="note">
              {report.notice}
            </p>
          )}
          <span className="section-label">최종 판정</span>
          <h2 id="verdict-title" className="verdict-title">
            <VerdictIcon tone={report.tone} />
            {report.label}
          </h2>
          {verdictKeywords.length ? (
            <ul className="verdict-keywords" aria-label="주요 판정 요인">
              {verdictKeywords.map((keyword) => (
                <li key={keyword}>{keyword}</li>
              ))}
            </ul>
          ) : (
            <p className="verdict-description">
              {hasDetailData
                ? "확인된 위험 신호가 없습니다."
                : report.reasons[0]}
            </p>
          )}
          <div className="report-url">
            <p className="fact-label">분석 URL</p>
            <TechnicalValue value={job.url} label="분석 URL" hideLabel />
            {result.redirectChain.length > 1 && (
              <RedirectSummary chain={result.redirectChain} />
            )}
          </div>
          <dl className="report-facts">
            <div className="report-fact">
              <dt className="fact-label">분석 완료</dt>
              <dd className="fact-value">
                <time dateTime={new Date(job.completesAt).toISOString()}>
                  {formatTime(job.completesAt)}
                </time>
              </dd>
            </div>
            <div className="report-fact">
              <dt className="fact-label">소요 시간</dt>
              <dd className="fact-value">
                {formatDuration(job.completesAt - job.createdAt)}
              </dd>
            </div>
            <div className="report-fact">
              <dt className="fact-label">판정 신뢰도</dt>
              <dd
                className={`fact-value report-confidence ${report.confidence === null ? "is-unavailable" : ""}`}
              >
                {report.confidence ??
                  (report.tone === "unknown" ? "산정 불가" : "정보 없음")}
              </dd>
            </div>
            <div className="report-fact">
              <dt className="fact-label">분석 범위</dt>
              <dd className="fact-value">
                {report.coverage && report.coverage.layerIds.length ? (
                  <span className="report-layer-tags">
                    {report.coverage.layerIds.join(" · ")}
                  </span>
                ) : (
                  <span className="is-unavailable">정보 없음</span>
                )}
              </dd>
              {!!report.coverage?.checked.length && (
                <dd className="fact-note">
                  <InlineList items={report.coverage.checked} />
                </dd>
              )}
              {!!report.coverage?.skipped.length && (
                <dd className="fact-note">
                  미실행 · <InlineList items={report.coverage.skipped} />
                </dd>
              )}
              {!!report.coverage?.stubbed.length && (
                <dd className="fact-note">
                  시험용 데이터 · <InlineList items={report.coverage.stubbed} />
                </dd>
              )}
            </div>
          </dl>
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
        <section className="reasons-section" aria-labelledby="reasons-title">
          <div className="section-heading">
            <div className="section-heading-copy">
              <h2 id="reasons-title">판정 이유</h2>
              <p>각 이유와 연결된 확인된 사실을 펼쳐 볼 수 있습니다.</p>
            </div>
          </div>
          {reasons.length ? (
            <ol className="reason-list">
              {reasons.map((reason) => (
                <ReasonItem
                  key={reason.id}
                  reason={reason}
                  facts={reason.factIds
                    .map((id) => factsById.get(id))
                    .filter((fact): fact is Evidence => !!fact)}
                />
              ))}
            </ol>
          ) : (
            <p className="empty-evidence">
              구체적인 위해와 연결된 사실이 확인되지 않았습니다.
            </p>
          )}
        </section>
        <div className="deep-request">
          <Button
            onClick={() =>
              window.location.assign(
                deepHref(investigationService.start(job.url).id),
              )
            }
          >
            심층분석 요청
          </Button>
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
          {job && <span className="state-domain">{job.url}</span>}
        </div>
        <div className="state-content" role="status" aria-live="polite">
          {["loading_job", "scanning", "reconnecting"].includes(state) ? (
            <>
              <div className="state-icon">
                <Spinner size={28} />
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
            <h1>완료</h1>
          ) : state === "cancelled" ? (
            <>
              <h1>분석이 취소되었습니다.</h1>
              <p>요청한 심층 분석이 중단되었습니다.</p>
              <CloseButton />
            </>
          ) : state === "status_fetch_error" ? (
            <>
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
