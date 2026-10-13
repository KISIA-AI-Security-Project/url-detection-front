import { useEffect, useState } from "react";
import { Button, Header } from "../components/ui";
import { DeepResultView, FastResultView } from "../components/ServiceResults";
import {
  previewDeep,
  previewFast,
  previewModels,
  previewUrl,
  previewVirusTotal,
} from "../service/preview-fixtures";
import type { FastResult, FastVerdict } from "../service/contracts";

const screens = [
  ["fast", "빠른 결과"],
  ["fast-progress", "빠른 진행"],
  ["deep-progress", "심층 진행"],
  ["deep", "심층 결과"],
  ["unknown", "판단불가"],
  ["failed", "분석 중단"],
] as const;
type Screen = (typeof screens)[number][0];
const vtChoices = [
  ["flow", "예시 흐름"],
  ["completed", "결과 있음"],
  ["many", "검사 업체가 많은 결과"],
  ["queued", "조회 중"],
  ["clean", "위험·의심 0개"],
  ["not_found", "등록 결과 없음"],
  ["failed", "조회 실패"],
  ["quota_exhausted", "조회 한도 도달"],
  ["off", "조회 미선택"],
] as const;
type VtChoice = (typeof vtChoices)[number][0];
const verdictChoices: ReadonlyArray<readonly [FastVerdict, string]> = [
  ["BENIGN", "정상"],
  ["LIKELY_BENIGN", "정상 가능성 높음"],
  ["SUSPICIOUS", "의심"],
  ["LIKELY_MALICIOUS", "악성 가능성 높음"],
  ["MALICIOUS", "악성"],
  ["UNKNOWN", "판단불가"],
];
const verdictExamples: Record<
  FastVerdict,
  { summary: string; reasonCount: number }
> = {
  BENIGN: {
    summary: "현재 확인된 정보에서 위험 신호가 확인되지 않았습니다.",
    reasonCount: 0,
  },
  LIKELY_BENIGN: {
    summary: "현재 확인된 정보에서는 위험 가능성이 낮습니다.",
    reasonCount: 0,
  },
  SUSPICIOUS: {
    summary: "주의가 필요한 신호가 확인되었습니다.",
    reasonCount: 1,
  },
  LIKELY_MALICIOUS: {
    summary: "악성 가능성이 높은 신호가 여러 개 확인되었습니다.",
    reasonCount: 2,
  },
  MALICIOUS: {
    summary:
      "배송 확인을 빌미로 계정 정보 입력을 유도하는 정황이 확인되었습니다.",
    reasonCount: 3,
  },
  UNKNOWN: {
    summary: "현재 확인한 정보만으로는 이 URL을 판단하기 어렵습니다.",
    reasonCount: 0,
  },
};
function initialScreen(): Screen {
  const value = new URLSearchParams(location.search).get("screen");
  return screens.find(([key]) => key === value)?.[0] ?? "fast";
}
export function DesignPreviewPage() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [vtChoice, setVtChoice] = useState<VtChoice>(
    () =>
      vtChoices.find(
        ([key]) => key === new URLSearchParams(location.search).get("vt"),
      )?.[0] ?? "flow",
  );
  const [elapsed, setElapsed] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [deepRequest, setDeepRequest] = useState("");
  const [verdictChoice, setVerdictChoice] = useState<FastVerdict>(() => {
    if (initialScreen() === "unknown") return "UNKNOWN";
    const value = new URLSearchParams(location.search).get("verdict");
    return verdictChoices.some(([key]) => key === value)
      ? (value as FastVerdict)
      : "MALICIOUS";
  });
  const [modelChoice, setModelChoice] = useState(previewModels[0].id);
  const [reasoningEffort, setReasoningEffort] = useState<string | null>(
    previewModels[0].default_effort,
  );
  useEffect(() => {
    if (!screen.endsWith("progress")) return;
    const start = performance.now();
    const timer = window.setInterval(
      () => setElapsed((performance.now() - start) / 1000),
      500,
    );
    return () => window.clearInterval(timer);
  }, [screen, generation]);
  function select(value: Screen) {
    const nextVerdict = value === "unknown" ? "UNKNOWN" : verdictChoice;
    setElapsed(0);
    setScreen(value);
    setVerdictChoice(nextVerdict);
    setGeneration((value) => value + 1);
    setReceivedAt(null);
    updateAddress(value, vtChoice, nextVerdict);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function updateAddress(screen: Screen, vt: VtChoice, verdict: FastVerdict) {
    const params = new URLSearchParams({ screen, vt, verdict });
    history.replaceState(null, "", "/design-preview?" + params.toString());
  }
  const deep =
    screen === "deep" || screen === "deep-progress" || screen === "failed";
  const vt = previewVirusTotal(
    vtChoice === "flow"
      ? screen === "fast-progress" && elapsed < 6
        ? "queued"
        : "completed"
      : vtChoice,
  );
  const activeVerdict = screen === "unknown" ? "UNKNOWN" : verdictChoice;
  const verdictExample = verdictExamples[activeVerdict];
  let fast: FastResult | null = {
    ...previewFast,
    judgment: {
      ...previewFast.judgment!,
      verdict: activeVerdict,
      summary: verdictExample.summary,
      reasons: previewFast.judgment!.reasons.slice(
        0,
        verdictExample.reasonCount,
      ),
    },
  };
  if (screen === "fast-progress" && elapsed < 9)
    fast = {
      ...previewFast,
      judgment: null,
      judgment_status: "pending",
      context_revision: elapsed < 4 ? null : previewFast.context_revision,
      deep_analysis: { available: false },
    };
  const phase =
    screen === "failed"
      ? "cancelled"
      : screen === "deep" || (receivedAt !== null && elapsed >= receivedAt + 2)
        ? "completed"
        : receivedAt !== null
          ? "finalizing"
          : elapsed >= 5
            ? "work"
            : elapsed >= 2
              ? "plan"
              : "collect";
  return (
    <>
      <Header wide={deep} />
      <main
        className={`report-main service-main${deep ? " service-wide" : ""}`}
      >
        <nav className="preview-toolbar" aria-label="디자인 확인 화면">
          <a className="text-button" href="/design-preview?screen=home">
            메인 화면
          </a>
          {screens.map(([key, label]) => (
            <button
              key={key}
              className="text-button"
              aria-pressed={screen === key}
              onClick={() => select(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <p className="preview-label">
          디자인 미리보기 · 가상 URL과 예시 분석 데이터
        </p>
        {!deep && (
          <div className="preview-design-options">
            <label>
              VirusTotal 예시
              <select
                value={vtChoice}
                onChange={(event) => {
                  const next = event.target.value as VtChoice;
                  setVtChoice(next);
                  updateAddress(screen, next, verdictChoice);
                }}
              >
                {vtChoices.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              LinkGuard 판정 예시
              <select
                value={activeVerdict}
                onChange={(event) => {
                  const next = event.target.value as FastVerdict;
                  const nextScreen = screen === "unknown" ? "fast" : screen;
                  setVerdictChoice(next);
                  setScreen(nextScreen);
                  updateAddress(nextScreen, vtChoice, next);
                }}
              >
                {verdictChoices.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {deep ? (
          <DeepResultView
            key={screen}
            snapshot={previewDeep(phase, Math.floor(elapsed * 2) + 1)}
            url={previewUrl}
            onClose={() => select("fast")}
          />
        ) : (
          <FastResultView
            key={screen}
            result={fast}
            url={previewUrl}
            onDeep={() => select("deep-progress")}
            deepRequest={{ value: deepRequest, onChange: setDeepRequest }}
            deepModelSelection={{
              models: previewModels,
              value: modelChoice,
              effort: reasoningEffort,
              loading: false,
              error: "",
              onChange: (value) => {
                const model = previewModels.find((item) => item.id === value);
                if (!model) return;
                setModelChoice(value);
                if (!model.efforts.includes(reasoningEffort ?? ""))
                  setReasoningEffort(model.default_effort);
              },
              onEffortChange: setReasoningEffort,
              onRetry: () => {},
            }}
            completedAt={Date.parse("2026-10-12T13:42:00+09:00")}
            virustotal={vt}
          />
        )}
        {screen === "deep-progress" && elapsed >= 5 && receivedAt === null && (
          <div className="preview-receive">
            <Button variant="secondary" onClick={() => setReceivedAt(elapsed)}>
              최종 결과 수신 확인
            </Button>
          </div>
        )}
        <footer className="page-footer">
          <span>LinkGuard · 디자인 미리보기</span>
        </footer>
      </main>
    </>
  );
}
