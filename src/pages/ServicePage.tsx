import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, LogIn } from "lucide-react";
import { Button, Header, Spinner } from "../components/ui";
import { DeepResultView, FastResultView } from "../components/ServiceResults";
import { VirusTotalResult } from "../components/VirusTotalResult";
import { ServiceEntry } from "../components/ServiceEntry";
import { ServiceAuth } from "../components/ServiceAuth";
import {
  anchorRoute,
  hasPreviousRoute,
  readRoute,
  writeRoute,
  type ServiceRoute,
} from "../service/navigation";
import { WebAuth } from "../service/session-auth.js";
import {
  ApiFailure,
  ServiceClient,
  normalizeDeepRequest,
  type RequestTask,
} from "../service/service-client.js";
import type {
  AnalysisHistory,
  AnalysisModels,
  DeepSnapshot,
  FastResult,
  ServiceConfig,
  VtResult,
} from "../service/contracts";
import { normalizeUrl } from "../lib/url";

interface Session {
  auth: WebAuth;
  client: ServiceClient;
  authenticated: boolean;
  initializationError?: string;
}
let initialization: Promise<Session> | undefined;
function initialize(): Promise<Session> {
  // StrictMode's mount replay must not consume the OAuth callback twice.
  initialization ??= (async () => {
    const response = await fetch("/config.json", { cache: "no-store" });
    if (!response.ok)
      throw new Error("서비스 설정을 불러오지 못했습니다. 새로고침해 주세요.");
    const config: ServiceConfig = await response.json();
    if (!config.auth || !config.api_base)
      throw new Error("서비스 설정을 확인하지 못했습니다.");
    const auth = new WebAuth(config.auth);
    try {
      const authenticated = await auth.initialize();
      return {
        auth,
        client: new ServiceClient(config.api_base, auth),
        authenticated,
      };
    } catch (error) {
      return {
        auth,
        client: new ServiceClient(config.api_base, auth),
        authenticated: false,
        initializationError: failureMessage(error),
      };
    }
  })();
  return initialization;
}

function failureMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return error instanceof Error
    ? error.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}
function rememberedUrl(scan: string): string {
  return sessionStorage.getItem("web.activeScan") === scan
    ? sessionStorage.getItem("web.activeUrl") || ""
    : "";
}
function remember(scan: string, url: string, run?: string) {
  sessionStorage.setItem("web.activeScan", scan);
  sessionStorage.setItem("web.activeUrl", url);
  if (run) sessionStorage.setItem("web.activeDeep", run);
  else sessionStorage.removeItem("web.activeDeep");
}

export function ServicePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [authView, setAuthView] = useState<"login" | "signup" | null>(null);
  const showAuth = authView !== null;
  const [loginPending, setLoginPending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const logoutActive = useRef(false);
  const [view, setView] = useState<"entry" | "fast" | "deep">("entry");
  const [input, setInput] = useState("");
  const [url, setUrl] = useState("");
  const [fast, setFast] = useState<FastResult | null>(null);
  const [deep, setDeep] = useState<DeepSnapshot | null>(null);
  const [deepPending, setDeepPending] = useState(false);
  const [error, setError] = useState("");
  const [vtSelected, setVtSelected] = useState(false);
  const [vt, setVt] = useState<VtResult | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisHistory[]>([]);
  const [modelCatalog, setModelCatalog] = useState<AnalysisModels | null>(null);
  const [{ modelChoice, reasoningEffort }, setModelSelection] = useState<{
    modelChoice: string;
    reasoningEffort: string | null;
  }>({ modelChoice: "", reasoningEffort: null });
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [deepRequestText, setDeepRequestText] = useState("");
  const clientRef = useRef<ServiceClient | null>(null);
  const taskRef = useRef<RequestTask | null>(null);
  const activeScan = useRef<string | null>(null);
  const runRef = useRef<string | null>(null);
  const modelsController = useRef<AbortController | null>(null);
  const deepController = useRef<AbortController | null>(null);
  const deepRequestEdited = useRef(false);
  const navigationRef = useRef<() => void>(() => {});
  const sessionRef = useRef<Session | null>(null);
  const sessionChangeRef = useRef<
    (current: Session, changed?: boolean) => void
  >(() => {});
  const resumeRef = useRef<() => void>(() => {});
  const authEvents = useRef(0);

  function changeDeepRequest(value: string) {
    deepRequestEdited.current = true;
    setDeepRequestText(value);
  }
  function resetDeepRequest() {
    deepRequestEdited.current = false;
    setDeepRequestText("");
  }

  const fail = (value: unknown) => {
    const message = failureMessage(value);
    if (!message) return;
    setError(message);
    if (value instanceof Error && "status" in value && value.status === 401) {
      const current = sessionRef.current;
      if (current) clearAuthenticated(current);
    }
  };
  function clearAuthenticated(current: Session) {
    current.authenticated = false;
    current.client.stop();
    modelsController.current?.abort();
    deepController.current?.abort();
    taskRef.current = null;
    activeScan.current = null;
    runRef.current = null;
    setAuthenticated(false);
    setAuthView(null);
    setView("entry");
    setFast(null);
    setDeep(null);
    setVt(null);
    setDeepPending(false);
    setAnalyses([]);
    setModelCatalog(null);
    setModelsLoading(false);
    setModelsError("");
    resetDeepRequest();
  }
  sessionChangeRef.current = (current, changed = false) => {
    const authenticatedNow = !!current.auth.tokens;
    const wasAuthenticated = current.authenticated;
    if (!authenticatedNow) {
      clearAuthenticated(current);
      return;
    }
    current.authenticated = true;
    setAuthenticated(true);
    if (!wasAuthenticated || changed) {
      setError("");
      setAuthView(null);
      void loadModels(current);
      void restoreRoute(current, readRoute());
    }
  };
  function login() {
    if (!session || loginPending || logoutActive.current) return;
    setAuthView("login");
    setError("");
  }
  async function logout() {
    if (!session || logoutActive.current) return;
    logoutActive.current = true;
    setLogoutPending(true);
    setError("");
    try {
      await session.auth.logout();
    } catch (value) {
      fail(value);
    } finally {
      logoutActive.current = false;
      setLogoutPending(false);
    }
  }
  async function loadModels(current: Session) {
    modelsController.current?.abort();
    const controller = new AbortController();
    modelsController.current = controller;
    setModelsLoading(true);
    setModelsError("");
    try {
      const catalog = await current.client.models(controller.signal);
      if (controller.signal.aborted) return;
      setModelCatalog(catalog);
      setModelSelection((previous) => {
        const model =
          catalog.models.find((row) => row.id === previous.modelChoice) ??
          catalog.models.find(
            (row) => row.id === catalog.default_model_choice,
          )!;
        return {
          modelChoice: model.id,
          reasoningEffort: model.efforts.includes(
            previous.reasoningEffort ?? "",
          )
            ? previous.reasoningEffort
            : model.default_effort,
        };
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setModelCatalog(null);
      setModelSelection({ modelChoice: "", reasoningEffort: null });
      setModelsError(failureMessage(error));
      if (error instanceof Error && "status" in error && error.status === 401)
        fail(error);
    } finally {
      if (!controller.signal.aborted) setModelsLoading(false);
    }
  }
  function changeModel(value: string) {
    const model = modelCatalog?.models.find((row) => row.id === value);
    if (!model) return;
    setModelSelection((previous) => ({
      modelChoice: model.id,
      reasoningEffort: model.efforts.includes(previous.reasoningEffort ?? "")
        ? previous.reasoningEffort
        : model.default_effort,
    }));
  }
  async function monitorFast(
    current: Session,
    scan: string,
    task: RequestTask,
    attempt?: number,
  ) {
    try {
      await current.client.streamFast(scan, attempt, task, (value) => {
        if (current.client.current(task)) setFast(value);
      });
    } catch (error) {
      if (current.client.current(task)) fail(error);
    }
  }
  async function monitorDeep(
    current: Session,
    run: string,
    task: RequestTask,
    restoreRequest = false,
  ) {
    deepController.current?.abort();
    const controller = new AbortController();
    deepController.current = controller;
    const abort = () => controller.abort();
    task.signal.addEventListener("abort", abort, { once: true });
    if (task.signal.aborted) controller.abort();
    const streamTask = { ...task, signal: controller.signal };
    let requestRestored = false;
    try {
      await current.client.streamDeep(
        { run_id: run, events_url: `/api/deep/${run}/events` },
        streamTask,
        (value) => {
          if (!current.client.current(streamTask) || runRef.current !== run)
            return;
          if (
            value.scan_id !== activeScan.current ||
            !Array.isArray(value.works) ||
            !Array.isArray(value.tasks) ||
            !Array.isArray(value.managers) ||
            !Array.isArray(value.files)
          )
            throw new ApiFailure(
              "심층 분석 결과를 확인하지 못했습니다. 다시 열어 주세요.",
              502,
              "unexpected_deep",
            );
          if (restoreRequest && !requestRestored) {
            requestRestored = true;
            // The restored run may arrive after the user has returned to Fast
            // and started another question, including an intentionally empty one.
            if (!deepRequestEdited.current)
              setDeepRequestText(value.input?.request_text ?? "");
          }
          setDeep(value);
        },
      );
    } catch (error) {
      if (current.client.current(streamTask) && runRef.current === run)
        fail(error);
    } finally {
      task.signal.removeEventListener("abort", abort);
    }
  }

  async function restoreRoute(current: Session, route: ServiceRoute) {
    const previousScan = activeScan.current;
    const task = current.client.begin();
    taskRef.current = task;
    deepController.current?.abort();
    setAuthView(null);
    setError("");
    setFast(null);
    setDeep(null);
    setVt(null);
    setDeepPending(false);
    activeScan.current = "scan" in route ? route.scan : null;
    runRef.current = route.view === "deep" ? route.run : null;
    if (!("scan" in route) || previousScan !== route.scan) resetDeepRequest();
    setView(
      route.view === "deep" ? "deep" : route.view === "fast" ? "fast" : "entry",
    );
    if (!("scan" in route)) {
      sessionStorage.removeItem("web.activeScan");
      sessionStorage.removeItem("web.activeDeep");
      sessionStorage.removeItem("web.activeUrl");
      if (route.view === "pending")
        setError(
          "이전 요청은 다시 보내지 않았습니다. 최근 분석 기록에서 접수 여부를 확인해 주세요.",
        );
    }
    let target = "scan" in route ? rememberedUrl(route.scan) : "";
    let savedRow: AnalysisHistory | undefined;
    try {
      const saved = await current.client.request<{
        analyses: AnalysisHistory[];
      }>("/analyses", { signal: task.signal });
      if (!current.client.current(task)) return;
      setAnalyses(saved.analyses);
      if ("scan" in route)
        savedRow = saved.analyses.find((row) => row.scanId === route.scan);
      target = savedRow?.url || target;
    } catch (value) {
      if (current.client.current(task) && !target) fail(value);
    }
    if (!current.client.current(task) || !("scan" in route)) return;
    setUrl(target);
    setInput(target);
    remember(route.scan, target, route.view === "deep" ? route.run : undefined);
    void monitorFast(current, route.scan, task);
    if (savedRow?.virustotal_requested) {
      setVt({ schema_version: "virustotal-url-report-1", status: "queued" });
      void current.client
        .streamVt(route.scan, task, (value) => {
          if (current.client.current(task)) setVt(value);
        })
        .catch((value) => {
          if (!current.client.current(task)) return;
          setVt({
            schema_version: "virustotal-url-report-1",
            status: "failed",
          });
          if (
            value instanceof Error &&
            "status" in value &&
            value.status === 401
          )
            fail(value);
        });
    }
    if (route.view === "deep") void monitorDeep(current, route.run, task, true);
  }
  navigationRef.current = () => {
    if (session && authenticated && session.auth.tokens) {
      if (modelsLoading || !modelCatalog) void loadModels(session);
      void restoreRoute(session, readRoute());
    } else if (session) clearAuthenticated(session);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  resumeRef.current = () => {
    if (!session) return;
    const current = session;
    const wasAuthenticated = current.authenticated;
    const eventVersion = authEvents.current;
    void current.auth
      .restoreSession()
      .then((restored) => {
        if (sessionRef.current !== current) return;
        sessionChangeRef.current(current);
        // A newly restored session already starts these via its subscriber.
        if (
          restored &&
          wasAuthenticated &&
          current.authenticated &&
          eventVersion === authEvents.current
        ) {
          if (modelsLoading || !modelCatalog) void loadModels(current);
          void restoreRoute(current, readRoute());
        }
      })
      .catch(fail);
  };
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    initialize()
      .then((current) => {
        if (disposed) return;
        clientRef.current = current.client;
        sessionRef.current = current;
        unsubscribe = current.auth.subscribe(() => {
          if (!disposed) {
            authEvents.current++;
            sessionChangeRef.current(current, true);
          }
        });
        setSession(current);
        setAuthenticated(current.authenticated);
        if (current.initializationError) setError(current.initializationError);
        let route = readRoute();
        if (route.view === "entry" && history.state?.linkguard !== 1) {
          const scan = sessionStorage.getItem("web.activeScan");
          const run = sessionStorage.getItem("web.activeDeep");
          if (scan && /^[0-9a-f]{32}$/.test(scan))
            route =
              run && /^[A-Za-z0-9_-]{1,128}$/.test(run)
                ? { view: "deep", scan, run }
                : { view: "fast", scan };
        }
        anchorRoute(route);
        if (!current.authenticated) return;
        void loadModels(current);
        void restoreRoute(current, route);
      })
      .catch((value) => {
        if (!disposed) fail(value);
      });
    const onPageHide = () => {
      clientRef.current?.stop();
      deepController.current?.abort();
      modelsController.current?.abort();
    };
    const onPopState = () => navigationRef.current();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) resumeRef.current();
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      disposed = true;
      unsubscribe?.();
      sessionRef.current = null;
      onPageHide();
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selectedModel = modelCatalog?.models.find(
      (model) => model.id === modelChoice,
    );
    if (
      !session ||
      !authenticated ||
      modelsLoading ||
      modelsError ||
      !selectedModel ||
      (selectedModel.efforts.length
        ? !selectedModel.efforts.includes(reasoningEffort ?? "")
        : reasoningEffort !== null)
    )
      return;
    const normalized = normalizeUrl(input);
    if (!normalized) {
      setError("http 또는 https 주소를 입력해 주세요.");
      return;
    }
    const submittedOptions = { modelChoice, reasoningEffort };
    const task = session.client.begin();
    taskRef.current = task;
    setError("");
    setFast(null);
    setDeep(null);
    setVt(null);
    setDeepPending(false);
    resetDeepRequest();
    activeScan.current = null;
    runRef.current = null;
    setInput(normalized);
    setUrl(normalized);
    setView("fast");
    writeRoute({ view: "pending" });
    try {
      const accepted = await session.client.start(
        normalized,
        vtSelected,
        task,
        submittedOptions,
      );
      if (!session.client.current(task)) return;
      activeScan.current = accepted.scanId;
      remember(accepted.scanId, normalized);
      writeRoute({ view: "fast", scan: accepted.scanId }, true);
      setAnalyses((previous) => [
        {
          scanId: accepted.scanId,
          url: normalized,
          virustotal_requested: vtSelected,
        },
        ...previous.filter((row) => row.scanId !== accepted.scanId),
      ]);
      void monitorFast(
        session,
        accepted.scanId,
        task,
        accepted.expectedAttempt,
      );
      if (vtSelected) {
        setVt({ schema_version: "virustotal-url-report-1", status: "queued" });
        void (async () => {
          await session.client.startVt(accepted.scanId, task);
          if (session.client.current(task))
            await session.client.streamVt(accepted.scanId, task, setVt);
        })().catch(() => {
          if (session.client.current(task))
            setVt({
              schema_version: "virustotal-url-report-1",
              status: "failed",
            });
        });
      }
    } catch (error) {
      if (session.client.current(task)) fail(error);
    }
  }

  function openAnalysis(row: AnalysisHistory) {
    if (!session || !authenticated) return;
    remember(row.scanId, row.url);
    writeRoute({ view: "fast", scan: row.scanId });
    void restoreRoute(session, { view: "fast", scan: row.scanId });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function requestDeep() {
    if (
      !session ||
      !fast ||
      !taskRef.current ||
      deepPending ||
      fast.judgment_status !== "accepted" ||
      !fast.context_revision
    )
      return;
    const task = taskRef.current;
    setDeepPending(true);
    setError("");
    try {
      const run = await session.client.deep(
        {
          job_id: fast.job_id,
          attempt: fast.attempt,
          context_revision: fast.context_revision,
          result_revision: fast.result_revision,
          request_text: deepRequestText,
        },
        task,
      );
      if (!session.client.current(task)) return;
      runRef.current = run.run_id;
      deepRequestEdited.current = false;
      setDeep(null);
      remember(fast.job_id, url, run.run_id);
      writeRoute({ view: "deep", scan: fast.job_id, run: run.run_id });
      setView("deep");
      window.scrollTo({ top: 0, behavior: "instant" });
      void monitorDeep(session, run.run_id, task);
    } catch (error) {
      if (session.client.current(task)) fail(error);
    } finally {
      if (session.client.current(task)) setDeepPending(false);
    }
  }

  function navigateBack(route: ServiceRoute) {
    if (hasPreviousRoute(route)) history.back();
    else {
      writeRoute(route);
      if (session && authenticated) void restoreRoute(session, route);
      else {
        setAuthView(null);
        setView("entry");
        setError("");
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }
  function backToEntry() {
    if (loginPending || logoutActive.current) return;
    if (showAuth) {
      setAuthView(null);
      setError("");
      return;
    }
    if (view === "entry") return;
    navigateBack({ view: "entry" });
  }
  function backToFast() {
    if (activeScan.current)
      navigateBack({ view: "fast", scan: activeScan.current });
  }
  const wide = view === "deep" && !showAuth;
  let deepRequestError = "";
  try {
    normalizeDeepRequest(deepRequestText);
  } catch (error) {
    deepRequestError = failureMessage(error);
  }
  return (
    <>
      <Header
        wide={wide}
        onHome={backToEntry}
        actions={
          logoutPending ? (
            <span className="auth-header-status" role="status">
              <Spinner /> 로그아웃 중
            </span>
          ) : authenticated ? (
            <button className="text-button" onClick={() => void logout()}>
              로그아웃
            </button>
          ) : (
            <>
              <button
                className="text-button"
                disabled={!session || loginPending || logoutPending}
                onClick={() => {
                  setAuthView("signup");
                  setError("");
                }}
              >
                회원가입
              </button>
              <Button
                variant="secondary"
                disabled={!session || loginPending || logoutPending}
                onClick={login}
              >
                <LogIn size={15} />
                로그인
              </Button>
            </>
          )
        }
      />
      <main
        className={`report-main service-main${wide ? " service-wide" : ""}`}
      >
        {!showAuth && view !== "entry" && (
          <div className="service-back">
            <button
              className="text-button"
              onClick={view === "deep" ? backToFast : backToEntry}
            >
              <ArrowLeft size={15} />
              {view === "deep" ? "빠른 분석 결과" : "분석 요청"}
            </button>
          </div>
        )}
        {!showAuth && !!error && view !== "entry" && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {showAuth && session ? (
          <ServiceAuth
            key={authView}
            auth={session.auth}
            initialStep={authView!}
            onLoginPendingChange={setLoginPending}
            onBack={() => setAuthView(null)}
            initialError={error}
          />
        ) : view === "entry" ? (
          <>
            <ServiceEntry
              ready={!!session}
              authenticated={authenticated}
              input={input}
              onInput={setInput}
              onSubmit={submit}
              vtSelected={vtSelected}
              onVtSelected={setVtSelected}
              analyses={analyses}
              onOpenAnalysis={openAnalysis}
              onLogin={login}
              error={error}
              modelSelection={{
                models: modelCatalog?.models ?? [],
                value: modelChoice,
                loading: modelsLoading,
                error: modelsError,
                onChange: changeModel,
                effort: reasoningEffort,
                onEffortChange: (value) =>
                  setModelSelection((previous) => ({
                    ...previous,
                    reasoningEffort: value,
                  })),
                onRetry: () => {
                  if (session && authenticated) void loadModels(session);
                },
              }}
            />
            {!session && error && (
              <Button variant="secondary" onClick={() => location.reload()}>
                다시 시도
              </Button>
            )}
          </>
        ) : view === "fast" ? (
          <>
            {error && (!fast || fast.judgment_status === "pending") ? (
              <>
                <Button variant="secondary" onClick={backToEntry}>
                  분석 요청으로 돌아가기
                </Button>
                <VirusTotalResult result={vt} />
              </>
            ) : (
              <FastResultView
                result={fast}
                url={url}
                onDeep={requestDeep}
                deepPending={deepPending}
                deepRequest={{
                  value: deepRequestText,
                  onChange: changeDeepRequest,
                  error: deepRequestError,
                }}
                virustotal={vt}
              />
            )}
          </>
        ) : deep ? (
          <DeepResultView snapshot={deep} url={url} />
        ) : error ? (
          <Button variant="secondary" onClick={backToFast}>
            빠른 분석 결과로 돌아가기
          </Button>
        ) : (
          <section className="deep-loading" role="status">
            <Spinner />
            심층 분석 자료를 불러오고 있습니다.
          </section>
        )}
        <footer className="page-footer">
          <span>LinkGuard</span>
        </footer>
      </main>
    </>
  );
}
