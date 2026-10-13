import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CircleHelp,
  ExternalLink,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
} from "lucide-react";
import { Brand, Button, Spinner } from "../components/ui";
import { activeTabUrl, isExtension } from "../lib/platform";
import { normalizeUrl } from "../lib/url";
import type { FastResult, ServiceConfig } from "../service/contracts";
import {
  fixedPopupModel,
  popupVerdicts,
  type FixedPopupModel,
} from "../service/popup-model";
import { previewFast, previewUrl } from "../service/preview-fixtures";
import { WebAuth } from "../service/session-auth.js";
import {
  ApiFailure,
  ServiceClient,
  type RequestTask,
} from "../service/service-client.js";
import "./popup.css";

const ACTIVE_ANALYSIS_KEY = "linkguard.popup.active-analysis.v1";

type PopupPhase =
  "booting" | "signed_out" | "idle" | "scanning" | "result" | "error";

type PopupPreviewState =
  "signed-out" | "idle" | "scanning" | "result" | "error";

function readPreviewState(): PopupPreviewState | null {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(window.location.search).get("preview");
  return ["signed-out", "idle", "scanning", "result", "error"].includes(
    value ?? "",
  )
    ? (value as PopupPreviewState)
    : null;
}

function previewPhase(value: PopupPreviewState | null): PopupPhase {
  if (value === "signed-out") return "signed_out";
  return value ?? "booting";
}

interface StoredAnalysis {
  scanId: string;
  url: string;
  attempt: number;
}

interface PopupRuntime {
  client: ServiceClient;
  serviceOrigin: string;
}

function isStoredAnalysis(value: unknown): value is StoredAnalysis {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<StoredAnalysis>;
  return (
    typeof row.scanId === "string" &&
    /^[0-9a-f]{32}$/.test(row.scanId) &&
    typeof row.url === "string" &&
    normalizeUrl(row.url) === row.url &&
    Number.isInteger(row.attempt) &&
    (row.attempt ?? 0) > 0
  );
}

async function readStoredAnalysis(): Promise<StoredAnalysis | null> {
  let value: unknown;
  if (isExtension()) {
    value = (await chrome.storage.local.get(ACTIVE_ANALYSIS_KEY))[
      ACTIVE_ANALYSIS_KEY
    ];
  } else {
    const raw = localStorage.getItem(ACTIVE_ANALYSIS_KEY);
    if (!raw) return null;
    try {
      value = JSON.parse(raw);
    } catch {
      localStorage.removeItem(ACTIVE_ANALYSIS_KEY);
      return null;
    }
  }
  if (isStoredAnalysis(value)) return value;
  await clearStoredAnalysis();
  return null;
}

async function writeStoredAnalysis(value: StoredAnalysis): Promise<void> {
  if (isExtension()) {
    await chrome.storage.local.set({ [ACTIVE_ANALYSIS_KEY]: value });
  } else {
    localStorage.setItem(ACTIVE_ANALYSIS_KEY, JSON.stringify(value));
  }
}

async function clearStoredAnalysis(): Promise<void> {
  if (isExtension()) {
    await chrome.storage.local.remove(ACTIVE_ANALYSIS_KEY);
  } else {
    localStorage.removeItem(ACTIVE_ANALYSIS_KEY);
  }
}

function failureMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return error instanceof Error
    ? error.message
    : "분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function resultFailure(result: FastResult): string {
  if (result.judgment_status === "not_requested")
    return "판정 요청이 수행되지 않았습니다.";
  if (result.judgment_status === "invalid")
    return "판정 결과를 확인하지 못했습니다.";
  return "분석을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

export function PopupPage() {
  const previewState = useRef(readPreviewState()).current;
  const [phase, setPhase] = useState<PopupPhase>(() =>
    previewPhase(previewState),
  );
  const [url, setUrl] = useState(() => (previewState ? previewUrl : ""));
  const [error, setError] = useState(() =>
    previewState === "error"
      ? "임시 분석 오류 화면입니다. 잠시 후 다시 시도해주세요."
      : "",
  );
  const [result, setResult] = useState<FastResult | null>(() =>
    previewState === "result" ? previewFast : null,
  );
  const [runtime, setRuntime] = useState<PopupRuntime | null>(null);
  const [fixedModel, setFixedModel] = useState<FixedPopupModel | null>(() =>
    previewState
      ? { modelChoice: "preview-opus-5-5", reasoningEffort: "high" }
      : null,
  );
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [deepPending, setDeepPending] = useState(false);
  const [deepError, setDeepError] = useState("");
  const runtimeRef = useRef<PopupRuntime | null>(null);
  const taskRef = useRef<RequestTask | null>(null);
  const modelsController = useRef<AbortController | null>(null);

  const syncTab = useCallback(async () => {
    const current = await activeTabUrl();
    setUrl(current);
  }, []);

  const fail = useCallback((value: unknown) => {
    const message = failureMessage(value);
    if (!message) return;
    if (value instanceof ApiFailure && value.status === 401) {
      setPhase("signed_out");
      setError("");
      return;
    }
    setError(message);
    setPhase("error");
  }, []);

  const monitor = useCallback(
    async (
      current: PopupRuntime,
      stored: StoredAnalysis,
      task: RequestTask,
    ) => {
      setUrl(stored.url);
      setResult(null);
      setError("");
      setPhase("scanning");
      try {
        await current.client.streamFast(
          stored.scanId,
          stored.attempt,
          task,
          (next) => {
            if (!current.client.current(task)) return;
            if (next.judgment_status === "pending") {
              setPhase("scanning");
              return;
            }
            if (next.judgment_status === "accepted" && next.judgment) {
              setResult(next);
              setDeepError("");
              setPhase("result");
              return;
            }
            setResult(null);
            setError(resultFailure(next));
            setPhase("error");
          },
        );
      } catch (value) {
        if (current.client.current(task)) fail(value);
      }
    },
    [fail],
  );

  const loadModels = useCallback(
    async (current: PopupRuntime) => {
      modelsController.current?.abort();
      const controller = new AbortController();
      modelsController.current = controller;
      setModelsLoading(true);
      setModelsError("");
      try {
        const catalog = await current.client.models(controller.signal);
        if (controller.signal.aborted) return;
        const resolved = fixedPopupModel(catalog);
        if (!resolved)
          throw new Error("Opus 5.5 High 모델을 사용할 수 없습니다.");
        setFixedModel(resolved);
      } catch (value) {
        if (controller.signal.aborted) return;
        setFixedModel(null);
        setModelsError(failureMessage(value));
        if (value instanceof ApiFailure && value.status === 401) fail(value);
      } finally {
        if (!controller.signal.aborted) setModelsLoading(false);
      }
    },
    [fail],
  );

  const initialize = useCallback(async () => {
    setPhase("booting");
    setError("");
    runtimeRef.current?.client.stop();
    try {
      const configUrl = isExtension()
        ? chrome.runtime.getURL("config.json")
        : "/config.json";
      const response = await fetch(configUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("서비스 설정을 불러오지 못했습니다.");
      const config: ServiceConfig = await response.json();
      if (!config.auth || !config.api_base)
        throw new Error("서비스 설정을 확인하지 못했습니다.");
      const serviceOrigin = new URL(config.auth.redirect_uri).origin;
      const requestBase = isExtension() ? serviceOrigin : "";
      const apiBase = isExtension()
        ? new URL(config.api_base, serviceOrigin).href
        : config.api_base;
      const auth = new WebAuth(config.auth, requestBase);
      const authenticated = await auth.initialize();
      const current = {
        client: new ServiceClient(apiBase, auth),
        serviceOrigin,
      };
      runtimeRef.current = current;
      setRuntime(current);
      if (!authenticated) {
        setPhase("signed_out");
        return;
      }
      void loadModels(current);
      const stored = await readStoredAnalysis();
      if (stored) {
        const task = current.client.begin();
        taskRef.current = task;
        await monitor(current, stored, task);
        return;
      }
      setPhase("idle");
      await syncTab();
    } catch (value) {
      fail(value);
    }
  }, [fail, loadModels, monitor, syncTab]);

  useEffect(() => {
    if (previewState) return;
    void initialize();
    return () => {
      runtimeRef.current?.client.stop();
      modelsController.current?.abort();
    };
  }, [initialize, previewState]);

  useEffect(() => {
    if (!isExtension() || phase !== "idle") return;
    const activated = () => void syncTab();
    const updated = (
      _tabId: number,
      change: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (tab.active && change.url) void syncTab();
    };
    chrome.tabs.onActivated.addListener(activated);
    chrome.tabs.onUpdated.addListener(updated);
    return () => {
      chrome.tabs.onActivated.removeListener(activated);
      chrome.tabs.onUpdated.removeListener(updated);
    };
  }, [phase, syncTab]);

  async function start(event?: FormEvent) {
    event?.preventDefault();
    if (phase === "scanning") return;
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError("올바른 HTTP 또는 HTTPS URL을 입력해주세요.");
      return;
    }
    if (previewState) {
      setUrl(normalized);
      setResult({ ...previewFast, job_id: previewFast.job_id });
      setError("");
      setPhase("result");
      return;
    }
    if (!runtime || modelsLoading || modelsError || !fixedModel) return;
    const task = runtime.client.begin();
    taskRef.current = task;
    setUrl(normalized);
    setResult(null);
    setDeepError("");
    setError("");
    setPhase("scanning");
    try {
      const accepted = await runtime.client.start(normalized, false, task, {
        modelChoice: fixedModel.modelChoice,
        reasoningEffort: fixedModel.reasoningEffort,
      });
      if (!runtime.client.current(task)) return;
      const stored = {
        scanId: accepted.scanId,
        url: normalized,
        attempt: accepted.expectedAttempt,
      };
      await writeStoredAnalysis(stored);
      if (runtime.client.current(task)) await monitor(runtime, stored, task);
    } catch (value) {
      if (runtime.client.current(task)) fail(value);
    }
  }

  async function reset() {
    if (previewState) {
      setResult(null);
      setDeepError("");
      setError("");
      setUrl(previewUrl);
      setPhase("idle");
      return;
    }
    runtime?.client.stop();
    taskRef.current = null;
    await clearStoredAnalysis();
    setResult(null);
    setDeepError("");
    setError("");
    setPhase("idle");
    await syncTab();
  }

  async function openLogin() {
    try {
      let serviceOrigin = runtime?.serviceOrigin;
      if (!serviceOrigin) {
        const response = await fetch("/config.json", { cache: "no-store" });
        if (!response.ok)
          throw new Error("로그인 페이지 정보를 불러오지 못했습니다.");
        const config: ServiceConfig = await response.json();
        if (!config.auth?.redirect_uri)
          throw new Error("로그인 페이지 정보를 확인하지 못했습니다.");
        serviceOrigin = new URL(config.auth.redirect_uri).origin;
      }
      const loginUrl = new URL("/?auth=login", serviceOrigin).href;
      if (isExtension()) void chrome.tabs.create({ url: loginUrl });
      else window.location.assign(loginUrl);
    } catch (value) {
      fail(value);
    }
  }

  function openDetailPage() {
    if (!result) return;
    if (previewState) {
      window.open(
        "/design-preview?screen=fast",
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    const path = `/analysis/${encodeURIComponent(result.job_id)}`;
    if (isExtension() && runtime) {
      void chrome.tabs.create({
        url: new URL(path, runtime.serviceOrigin).href,
      });
      return;
    }
    window.open(path, "_blank", "noopener,noreferrer");
  }

  async function startDeepAnalysis() {
    if (!result || deepPending) return;
    if (previewState) {
      window.open(
        "/design-preview?screen=deep-progress",
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (!runtime || !fixedModel || !result.context_revision) {
      setDeepError("심층분석을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    const task = runtime.client.begin();
    taskRef.current = task;
    setDeepPending(true);
    setDeepError("");
    try {
      const run = await runtime.client.deep(
        {
          job_id: result.job_id,
          attempt: result.attempt,
          context_revision: result.context_revision,
          result_revision: result.result_revision,
          model_choice: fixedModel.modelChoice,
          reasoning_effort: fixedModel.reasoningEffort,
        },
        task,
      );
      if (!runtime.client.current(task)) return;
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(run.run_id))
        throw new Error("심층분석 접수 결과를 확인하지 못했습니다.");
      const params = new URLSearchParams({ deep: run.run_id });
      const path = `/analysis/${encodeURIComponent(result.job_id)}?${params}`;
      if (isExtension()) {
        void chrome.tabs.create({
          url: new URL(path, runtime.serviceOrigin).href,
        });
      } else {
        window.open(path, "_blank", "noopener,noreferrer");
      }
    } catch (value) {
      if (runtime.client.current(task)) setDeepError(failureMessage(value));
    } finally {
      if (runtime.client.current(task)) setDeepPending(false);
    }
  }

  const presentation = result?.judgment
    ? popupVerdicts[result.judgment.verdict]
    : null;
  const VerdictIcon = presentation
    ? presentation.tone === "safe"
      ? ShieldCheck
      : presentation.tone === "danger"
        ? ShieldX
        : presentation.tone === "caution"
          ? TriangleAlert
          : CircleHelp
    : CircleHelp;
  const locked = phase === "scanning" || phase === "result";
  const modelReady =
    !modelsLoading && !modelsError && !!fixedModel && phase === "idle";

  return (
    <div
      className={`popup-shell ${isExtension() ? "extension" : "web-preview"}`}
    >
      <main className="popup" aria-label="URL 분석 팝업">
        <header className="popup-header">
          <Brand />
          <span className="popup-header-caption">빠른 분석</span>
        </header>

        {phase === "signed_out" ? (
          <section className="popup-auth" aria-labelledby="popup-auth-title">
            <div className="popup-auth-icon" aria-hidden="true">
              <ShieldCheck size={22} />
            </div>
            <h1 id="popup-auth-title">로그인이 필요합니다.</h1>
            <p>메인 페이지에서 로그인한 뒤 분석을 시작해주세요.</p>
            <Button className="full-width" onClick={openLogin}>
              메인 페이지에서 로그인
            </Button>
            {!previewState && (
              <button
                className="popup-text-button"
                onClick={() => void initialize()}
              >
                로그인 상태 다시 확인
              </button>
            )}
          </section>
        ) : (
          <>
            {phase !== "result" && (
              <>
                <form
                  className="popup-analysis-form"
                  onSubmit={start}
                  noValidate
                >
                  <label htmlFor="url-input">분석할 URL</label>
                  <div
                    className={`popup-url-control ${error && phase === "idle" ? "has-error" : ""}`}
                  >
                    <div className="popup-url-row">
                      <Link2 size={17} aria-hidden="true" />
                      <input
                        id="url-input"
                        type="url"
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        value={url}
                        onChange={(event) => {
                          setUrl(event.target.value.replace(/[\r\n]+/g, ""));
                          setError("");
                        }}
                        onBlur={() => {
                          if (url.trim() && !normalizeUrl(url))
                            setError(
                              "올바른 HTTP 또는 HTTPS URL을 입력해주세요.",
                            );
                        }}
                        disabled={locked || phase === "booting"}
                        placeholder="링크를 입력해주세요. 예: https://example.com"
                        aria-invalid={!!error && phase === "idle"}
                        aria-describedby={error ? "popup-error" : undefined}
                      />
                    </div>
                  </div>
                  <Button
                    className="popup-submit"
                    type="submit"
                    disabled={
                      phase !== "idle" ||
                      (!previewState && !runtime) ||
                      !normalizeUrl(url) ||
                      !modelReady
                    }
                  >
                    분석 시작
                  </Button>
                  {phase === "idle" && modelsError && (
                    <div className="popup-model-error" role="alert">
                      <span>{modelsError}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (runtime) void loadModels(runtime);
                        }}
                      >
                        다시 시도
                      </button>
                    </div>
                  )}
                </form>
                {phase === "idle" && error && (
                  <p
                    className="popup-input-error"
                    id="popup-error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
              </>
            )}

            {phase === "booting" && (
              <section className="popup-state" role="status">
                <Spinner size={18} />
                <span>서비스를 준비하고 있습니다.</span>
              </section>
            )}

            {phase === "scanning" && (
              <section className="popup-state popup-scanning" role="status">
                <Spinner size={18} />
                <span>스캔 중...</span>
              </section>
            )}

            {phase === "result" && presentation && result && (
              <section
                className="popup-result"
                aria-labelledby="popup-verdict"
                aria-live="polite"
              >
                <div className={`popup-verdict is-${presentation.tone}`}>
                  <div className="popup-verdict-icon" aria-hidden="true">
                    <VerdictIcon size={23} strokeWidth={2} />
                  </div>
                  <div>
                    <span>판정 결과</span>
                    <h1 id="popup-verdict">{presentation.label}</h1>
                  </div>
                </div>

                <p className="popup-summary">{result.judgment?.summary}</p>

                <div className="popup-target">
                  <span>분석 링크</span>
                  <code title={url}>{url}</code>
                </div>

                <div className="popup-result-actions">
                  <Button variant="secondary" onClick={openDetailPage}>
                    <ExternalLink size={14} aria-hidden="true" />
                    판정 원인 보기
                  </Button>
                  <Button onClick={startDeepAnalysis} disabled={deepPending}>
                    {deepPending ? (
                      <Spinner size={14} />
                    ) : (
                      <Search size={14} aria-hidden="true" />
                    )}
                    {deepPending ? "시작 중..." : "심층분석 진행"}
                  </Button>
                </div>

                {deepError && (
                  <p className="popup-deep-error" role="alert">
                    {deepError}
                  </p>
                )}

                <Button
                  variant="secondary"
                  className="full-width"
                  onClick={reset}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  다른 링크 분석
                </Button>
              </section>
            )}

            {phase === "error" && (
              <section className="popup-error" role="alert">
                <h1>분석을 완료하지 못했습니다.</h1>
                <p id="popup-error">{error}</p>
                <Button
                  variant="secondary"
                  className="full-width"
                  onClick={reset}
                >
                  다시 시도
                </Button>
              </section>
            )}
          </>
        )}

        <footer className="popup-footer">LinkGuard</footer>
      </main>
    </div>
  );
}
