import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { ServiceEntry } from "../components/ServiceEntry";
import { Button, Header } from "../components/ui";
import type { AnalysisHistory } from "../service/contracts";
import { previewUrl } from "../service/preview-fixtures";
import { normalizeUrl } from "../lib/url";

const examples: AnalysisHistory[] = [
  { scanId: "example-delivery", url: previewUrl },
  { scanId: "example-account", url: "https://account-notice.example/login" },
  {
    scanId: "example-document",
    url: "https://document-view.example/shared/file",
  },
  {
    scanId: "example-support",
    url: "https://help-center.example/support/request",
  },
  { scanId: "example-payment", url: "https://payment-notice.example/verify" },
  { scanId: "example-signin", url: "https://signin-alert.example/account" },
];
const modes = [
  ["history", "로그인 후 · 최근 분석 있음"],
  ["new", "로그인 후 · 첫 사용"],
  ["guest", "로그인 전"],
  ["preparing", "서비스 준비 중"],
] as const;
type Mode = (typeof modes)[number][0];

export function MainPreviewPage() {
  const [mode, setMode] = useState<Mode>(
    () =>
      modes.find(
        ([key]) => key === new URLSearchParams(location.search).get("entry"),
      )?.[0] ?? "history",
  );
  const [input, setInput] = useState("");
  const [vtSelected, setVtSelected] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const authenticated = mode === "history" || mode === "new";
  const ready = mode !== "preparing";

  function selectMode(value: Mode) {
    setMode(value);
    setError("");
    setNotice("");
    setVtSelected(false);
    const params = new URLSearchParams({ screen: "home", entry: value });
    history.replaceState(null, "", "/design-preview?" + params);
  }
  function login() {
    selectMode("new");
    setNotice(
      "로그인 후 화면 예시로 전환했습니다. 실제 로그인은 하지 않았습니다.",
    );
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authenticated) return;
    const normalized = normalizeUrl(input);
    if (!normalized) {
      setError("http 또는 https 주소를 입력해 주세요.");
      setNotice("");
      return;
    }
    setInput(normalized);
    setError("");
    setNotice(
      "분석 시작 동작 확인 · 이 미리보기는 실제 분석 요청을 보내지 않습니다.",
    );
  }

  return (
    <>
      <Header
        actions={
          authenticated ? (
            <button className="text-button" onClick={() => selectMode("guest")}>
              로그아웃
            </button>
          ) : (
            <Button variant="secondary" onClick={login} disabled={!ready}>
              <LogIn size={15} aria-hidden="true" />
              로그인
            </Button>
          )
        }
      />
      <main className="report-main service-main">
        <div className="entry-preview-toolbar">
          <nav aria-label="디자인 확인 화면">
            <span aria-current="page">메인 화면</span>
            <a href="/design-preview?screen=fast">빠른 결과</a>
            <a href="/design-preview?screen=deep">심층 결과</a>
          </nav>
          <label className="entry-preview-mode">
            화면 상태
            <select
              value={mode}
              onChange={(event) => selectMode(event.target.value as Mode)}
            >
              {modes.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="preview-label entry-preview-label">
          메인 디자인 미리보기 · 가상 기록과 로그인 상태 · 실제 요청 없음
        </p>
        {notice && (
          <p className="entry-preview-status" role="status">
            {notice}
          </p>
        )}
        <ServiceEntry
          key={mode}
          ready={ready}
          authenticated={authenticated}
          input={input}
          onInput={(value) => {
            setInput(value);
            setError("");
            setNotice("");
          }}
          onSubmit={submit}
          vtSelected={vtSelected}
          onVtSelected={setVtSelected}
          analyses={mode === "history" ? examples : []}
          onOpenAnalysis={(row) =>
            setNotice(
              `최근 분석 선택 확인 · ${row.url} · 실제 결과 조회는 하지 않습니다.`,
            )
          }
          onLogin={login}
          error={error}
        />
        <footer className="page-footer">
          <span>LinkGuard · 디자인 미리보기</span>
        </footer>
      </main>
    </>
  );
}
