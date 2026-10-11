import { ArrowRight, Link2, LogIn } from "lucide-react";
import type { FormEvent } from "react";
import type { AnalysisHistory, AnalysisModels } from "../service/contracts";
import { Button } from "./ui";
import { RecentAnalyses } from "./RecentAnalyses";
import "../service/entry.css";

export interface ServiceEntryProps {
  ready: boolean;
  authenticated: boolean;
  input: string;
  onInput: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  vtSelected: boolean;
  onVtSelected: (value: boolean) => void;
  analyses: readonly AnalysisHistory[];
  onOpenAnalysis: (row: AnalysisHistory) => void;
  onLogin: () => void;
  error?: string;
  modelSelection?: {
    models: AnalysisModels["models"];
    value: string;
    effort: string | null;
    loading: boolean;
    error: string;
    onChange: (value: string) => void;
    onEffortChange: (value: string) => void;
    onRetry: () => void;
  };
}

/** Desktop entry. Its owner supplies auth, history and request behavior. */
export function ServiceEntry({
  ready,
  authenticated,
  input,
  onInput,
  onSubmit,
  vtSelected,
  onVtSelected,
  analyses,
  onOpenAnalysis,
  onLogin,
  error,
  modelSelection,
}: ServiceEntryProps) {
  const model = modelSelection?.models.find(
    (row) => row.id === modelSelection.value,
  );
  const modelReady =
    !modelSelection ||
    (!modelSelection.loading && !modelSelection.error && !!model);
  const effortReady =
    !modelSelection ||
    (!!model &&
      (model.efforts.length
        ? model.efforts.includes(modelSelection.effort ?? "")
        : modelSelection.effort === null));
  const effortLabels: Record<string, string> = {
    low: "낮음",
    medium: "보통",
    high: "높음",
    xhigh: "매우 높음",
    max: "최대",
  };
  return (
    <section className="entry-design" aria-labelledby="entry-title">
      <div className="entry-intro">
        <h1 id="entry-title">이 링크, 열어도 괜찮을까요?</h1>
        <p id="entry-guide">
          빠른 분석으로 먼저 확인하고, 필요하면 심층 분석으로 이어가세요.
        </p>
      </div>

      <form className="entry-analysis-form" onSubmit={onSubmit}>
        <label className="entry-url-label" htmlFor="entry-url">
          분석할 URL
        </label>
        <div className={`entry-url-control${error ? " has-error" : ""}`}>
          <Link2 size={20} aria-hidden="true" />
          <input
            id="entry-url"
            type="text"
            inputMode="url"
            autoComplete="off"
            maxLength={2048}
            placeholder="확인할 링크를 붙여넣으세요"
            value={input}
            onChange={(event) => onInput(event.target.value)}
            disabled={!authenticated}
            required
            aria-invalid={!!error}
            aria-describedby={error ? "entry-error entry-guide" : "entry-guide"}
          />
          {authenticated ? (
            <Button
              type="submit"
              className="entry-submit"
              disabled={!input.trim() || !modelReady || !effortReady}
            >
              분석 시작
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              className="entry-submit"
              onClick={(event) => {
                event.preventDefault();
                onLogin();
              }}
              disabled={!ready}
            >
              <LogIn size={16} aria-hidden="true" />
              {ready ? "로그인 후 분석" : "서비스 준비 중"}
            </Button>
          )}
        </div>
        {error && (
          <p className="entry-error" id="entry-error" role="alert">
            {error}
          </p>
        )}
        <div className="entry-options">
          {modelSelection && (
            <fieldset
              className="entry-model-option"
              aria-label="빠른 분석 설정"
            >
              <div className="entry-setting-fields">
                <div className="entry-setting-field">
                  <label htmlFor="entry-model">빠른 분석 모델</label>
                  <select
                    id="entry-model"
                    value={modelSelection.value}
                    onChange={(event) =>
                      modelSelection.onChange(event.target.value)
                    }
                    disabled={
                      !authenticated ||
                      modelSelection.loading ||
                      !!modelSelection.error
                    }
                    aria-describedby={
                      authenticated &&
                      (modelSelection.error || modelSelection.loading)
                        ? "entry-model-status"
                        : undefined
                    }
                  >
                    {!modelReady && (
                      <option value="">
                        {!authenticated
                          ? "로그인 후 선택"
                          : "모델 목록 확인 중"}
                      </option>
                    )}
                    {modelSelection.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="entry-setting-field">
                  <label htmlFor="entry-effort">추론 노력 (effort)</label>
                  <select
                    id="entry-effort"
                    value={modelSelection.effort ?? ""}
                    onChange={(event) =>
                      modelSelection.onEffortChange(event.target.value)
                    }
                    disabled={
                      !authenticated || !modelReady || !model?.efforts.length
                    }
                    aria-describedby={
                      authenticated && modelReady
                        ? "entry-effort-status"
                        : undefined
                    }
                  >
                    {!model?.efforts.length && (
                      <option value="">
                        {modelReady ? "설정 미지원" : "모델 선택 후 확인"}
                      </option>
                    )}
                    {model?.efforts.map((effort) => (
                      <option key={effort} value={effort}>
                        {effortLabels[effort]
                          ? `${effortLabels[effort]} (${effort})`
                          : effort}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {authenticated &&
                (modelSelection.error || modelSelection.loading) && (
                  <p
                    className="entry-setting-note"
                    id="entry-model-status"
                    role={modelSelection.error ? "alert" : "status"}
                  >
                    {modelSelection.error ||
                      "사용 가능한 모델을 불러오고 있습니다."}
                  </p>
                )}
              {authenticated && modelSelection.error && (
                <button
                  className="text-button entry-model-retry"
                  type="button"
                  onClick={modelSelection.onRetry}
                >
                  모델 목록 다시 불러오기
                </button>
              )}
              {authenticated && modelReady && (
                <p
                  className="entry-setting-note"
                  id="entry-effort-status"
                  role="status"
                >
                  {model?.efforts.length
                    ? "추론 노력을 높이면 처리 시간과 비용이 늘 수 있습니다."
                    : "이 모델은 effort 설정을 지원하지 않습니다."}
                </p>
              )}
            </fieldset>
          )}
          <label className="entry-vt-option">
            <input
              type="checkbox"
              checked={vtSelected}
              onChange={(event) => onVtSelected(event.target.checked)}
              disabled={!authenticated}
            />
            VirusTotal 조회 결과 함께 보기
          </label>
        </div>
      </form>

      {authenticated && (
        <RecentAnalyses analyses={analyses} onOpenAnalysis={onOpenAnalysis} />
      )}
    </section>
  );
}
