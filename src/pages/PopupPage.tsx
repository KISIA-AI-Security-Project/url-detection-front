import { useEffect, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Brand, Button, Spinner, StatusIcon } from "../components/ui";
import "./popup.css";
import { rankEvidence, resultFor, verdicts } from "../data/results";
import { analysisService } from "../lib/mock-service";
import {
  activeTabUrl,
  analysisHref,
  isExtension,
  openAnalysis,
} from "../lib/platform";
import type { AnalysisJob, Scenario } from "../lib/types";
import { normalizeUrl } from "../lib/url";
export function PopupPage() {
  const [job, setJob] = useState<AnalysisJob | null>(() =>
    analysisService.getFast(),
  );
  const [url, setUrl] = useState(() => analysisService.getFast()?.url || "");
  const [error, setError] = useState("");
  const [deepHref, setDeepHref] = useState("");
  const params = new URLSearchParams(window.location.search);
  const requestedScenario = params.get("scenario");
  const scenario: Scenario = [
    "safe",
    "caution",
    "danger",
    "fast-danger",
    "partial",
    "failed",
    "summary-fallback",
  ].includes(requestedScenario || "")
    ? (requestedScenario as Scenario)
    : "danger";
  const scanning = job?.status === "scanning";
  const complete = job?.status === "completed";
  const result = job ? resultFor(job) : null;
  const syncTab = async () => {
    const current = await activeTabUrl();
    if (!analysisService.getFast()) setUrl(current);
  };
  useEffect(() => {
    void syncTab();
    if (!isExtension()) return;
    const sync = () => {
      void syncTab();
    };
    const updated = (
      _tabId: number,
      change: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (tab.active && change.url) sync();
    };
    chrome.tabs.onActivated.addListener(sync);
    chrome.tabs.onUpdated.addListener(updated);
    return () => {
      chrome.tabs.onActivated.removeListener(sync);
      chrome.tabs.onUpdated.removeListener(updated);
    };
  }, []);
  useEffect(() => {
    const interval = window.setInterval(() => {
      setJob(analysisService.getFast());
    }, 250);
    return () => window.clearInterval(interval);
  }, []);
  const start = (event?: FormEvent) => {
    event?.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError("올바른 HTTP 또는 HTTPS URL을 입력해주세요.");
      return;
    }
    if (scanning) return;
    try {
      const created = analysisService.startFast(normalized, scenario);
      setUrl(created.url);
      setError("");
      setJob(created);
    } catch {
      setError(
        "분석 상태를 저장할 수 없습니다. 브라우저의 저장 공간 설정을 확인해주세요.",
      );
    }
  };
  const reset = () => {
    analysisService.clearFast();
    setJob(null);
    setUrl("");
    setError("");
    setDeepHref("");
    void syncTab();
  };
  const deep = () => {
    if (!job) return;
    try {
      const created = analysisService.startDeep(job);
      if (!openAnalysis(created.id)) setDeepHref(analysisHref(created.id));
    } catch {
      setError("분석 상태를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  };
  const fastEvidence = result
    ? rankEvidence(
        result.evidence.filter((e) => e.layer !== "L4"),
        3,
      )
    : [];
  return (
    <div
      className={`popup-shell ${isExtension() ? "extension" : "web-preview"}`}
    >
      <div className="popup-frame">
        <main className="popup" aria-label="URL 분석 팝업">
          <header className="popup-header">
            <Brand />
          </header>
          <div className="popup-content">
            <form onSubmit={start} noValidate>
              <label htmlFor="url-input">분석할 URL</label>
              <div className={`url-input-wrap ${error ? "invalid" : ""}`}>
                <input
                  id="url-input"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError("");
                  }}
                  onBlur={() => {
                    if (url.trim() && !normalizeUrl(url))
                      setError("올바른 HTTP 또는 HTTPS URL을 입력해주세요.");
                  }}
                  disabled={!!job}
                  placeholder="https://example.com"
                  aria-invalid={!!error}
                  aria-describedby={error ? "url-error" : "url-help"}
                />
              </div>
              <p id="url-help" className="sr-only">
                확인하고 싶은 링크를 입력해주세요.
              </p>
              {error && (
                <p className="input-error" id="url-error" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="full-width"
                disabled={!!job || !normalizeUrl(url)}
              >
                분석 시작
              </Button>
            </form>
            {scanning && (
              <section
                className="fast-loading popup-section"
                aria-label="고속 분석 진행 상태"
                role="status"
              >
                <Spinner size={20} />
                <h2>스캔 중...</h2>
              </section>
            )}
            {complete && result && (
              <section
                className="fast-result popup-section fade-in"
                aria-label="고속 분석 결과"
              >
                <div role="status">
                  <h1 className={`popup-status-row ${result.initial}`}>
                    <span className={`popup-status-icon ${result.initial}`}>
                      <StatusIcon verdict={result.initial} size={24} />
                    </span>
                    {verdicts[result.initial].text}
                  </h1>
                  <p className="popup-summary">{result.fastSummary}</p>
                </div>
                <div className="popup-evidence">
                  <h2>핵심 근거</h2>
                  {fastEvidence.length ? (
                    <ul>
                      {fastEvidence.map((e) => (
                        <li key={e.id}>
                          <span
                            className="evidence-bullet"
                            aria-hidden="true"
                          />
                          <span>{e.title}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      <Check size={15} />
                      특이사항이 확인되지 않았습니다.
                    </p>
                  )}
                </div>
                {result.partial && (
                  <div className="popup-partial">
                    일부 콘텐츠 분석을 완료하지 못했습니다.
                  </div>
                )}
                <p className="deep-prompt">더 자세한 분석을 진행할까요?</p>
                <div className="popup-actions">
                  <Button variant="secondary" onClick={reset}>
                    종료
                  </Button>
                  <Button onClick={deep}>심층 분석</Button>
                </div>
                {deepHref && (
                  <p className="popup-blocked" role="status">
                    새 탭이 차단되었습니다.{" "}
                    <a
                      href={deepHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      분석 페이지 열기
                    </a>
                  </p>
                )}
              </section>
            )}
            {job?.status === "failed" && (
              <section className="popup-error popup-section" role="alert">
                <h2>분석을 완료하지 못했습니다.</h2>
                <p>잠시 후 다시 시도해주세요.</p>
                <Button
                  className="full-width"
                  onClick={() => {
                    analysisService.clearFast();
                    start();
                  }}
                >
                  다시 시도
                </Button>
              </section>
            )}
            <footer className="popup-footer">
              목업 데이터 · 실제 네트워크 요청 없음
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
