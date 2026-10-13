import { ArrowRight, Link2, LogIn } from "lucide-react";
import type { FormEvent } from "react";
import type { AnalysisHistory } from "../service/contracts";
import {
  AnalysisModelPicker,
  type AnalysisModelSelection,
} from "./AnalysisModelPicker";
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
  modelSelection?: AnalysisModelSelection;
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
  const hasEmptyHistory = analyses.length === 0;
  return (
    <section
      className={`entry-design${hasEmptyHistory ? " has-empty-history" : ""}${authenticated ? " is-authenticated" : ""}`}
      aria-labelledby="entry-title"
    >
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
          <div className="entry-url-row">
            <Link2 size={20} aria-hidden="true" />
            <input
              id="entry-url"
              type="text"
              inputMode="url"
              autoComplete="off"
              maxLength={2048}
              placeholder="분석하고 싶은 URL을 입력해 주세요 (예: https://example.com)"
              value={input}
              onChange={(event) => onInput(event.target.value)}
              disabled={!authenticated}
              required
              aria-invalid={!!error}
              aria-describedby={
                error ? "entry-error entry-guide" : "entry-guide"
              }
            />
          </div>
          <div className="entry-options">
            <label className="entry-vt-option">
              <input
                type="checkbox"
                checked={vtSelected}
                onChange={(event) => onVtSelected(event.target.checked)}
                disabled={!authenticated}
              />
              VirusTotal 조회 결과 함께 보기
            </label>
            {modelSelection && (
              <AnalysisModelPicker
                authenticated={authenticated}
                selection={modelSelection}
              />
            )}
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
        </div>
        {error && (
          <p className="entry-error" id="entry-error" role="alert">
            {error}
          </p>
        )}
      </form>

      {authenticated && (
        <RecentAnalyses analyses={analyses} onOpenAnalysis={onOpenAnalysis} />
      )}
    </section>
  );
}
