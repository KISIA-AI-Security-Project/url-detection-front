import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { AnalysisModels } from "../service/contracts";

export interface AnalysisModelSelection {
  models: AnalysisModels["models"];
  value: string;
  effort: string | null;
  loading: boolean;
  error: string;
  onChange: (value: string) => void;
  onEffortChange: (value: string) => void;
  onRetry: () => void;
}

const effortLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
};

type ModelCombination = {
  model: AnalysisModels["models"][number];
  effort: string | null;
};

export function AnalysisModelPicker({
  authenticated,
  selection,
}: {
  authenticated: boolean;
  selection: AnalysisModelSelection;
}) {
  const [open, setOpen] = useState(false);
  const pickerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const model = selection.models.find((item) => item.id === selection.value);
  const effortLabel = selection.effort
    ? effortLabels[selection.effort] || selection.effort
    : null;
  const combinations = selection.models.reduce<ModelCombination[]>(
    (items, item) => {
      if (item.efforts.length) {
        item.efforts.forEach((effort) => items.push({ model: item, effort }));
      } else {
        items.push({ model: item, effort: null });
      }
      return items;
    },
    [],
  );
  const disabled = !authenticated || selection.loading || !!selection.error;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const choose = (modelId: string, effort: string | null) => {
    selection.onChange(modelId);
    if (effort) selection.onEffortChange(effort);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const selectedLabel =
    model?.label ||
    (selection.loading ? "모델 확인 중" : "모델을 선택해 주세요");

  return (
    <div className="entry-model-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="entry-model-trigger"
        aria-label="모델 및 추론 설정"
        aria-expanded={open}
        aria-controls={`${pickerId}-panel`}
        aria-haspopup="dialog"
        aria-describedby={
          selection.loading || selection.error
            ? `${pickerId}-status`
            : undefined
        }
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="entry-model-trigger-value">{selectedLabel}</span>
        {effortLabel && (
          <span className="entry-model-trigger-effort">{effortLabel}</span>
        )}
        <ChevronDown
          size={16}
          className={open ? "rotated" : ""}
          aria-hidden="true"
        />
      </button>

      {(selection.loading || selection.error) && (
        <div className="entry-model-feedback">
          <p
            id={`${pickerId}-status`}
            role={selection.error ? "alert" : "status"}
          >
            {selection.error || "사용 가능한 모델을 불러오고 있습니다."}
          </p>
          {selection.error && (
            <button
              className="text-button entry-model-retry"
              type="button"
              onClick={selection.onRetry}
            >
              모델 목록 다시 불러오기
            </button>
          )}
        </div>
      )}

      {open && model && (
        <div
          className="entry-model-panel"
          id={`${pickerId}-panel`}
          role="dialog"
          aria-label="모델 및 추론 설정"
        >
          <div className="entry-model-list">
            {combinations.map(({ model: item, effort }) => {
              const selected =
                item.id === selection.value && effort === selection.effort;
              const optionEffort = effort
                ? effortLabels[effort] || effort
                : null;
              return (
                <button
                  type="button"
                  className="entry-model-option"
                  key={`${item.id}-${effort || "none"}`}
                  aria-pressed={selected}
                  onClick={() => choose(item.id, effort)}
                >
                  <span className="entry-model-option-copy">
                    <span>{item.label}</span>
                    {optionEffort && <span>{optionEffort}</span>}
                  </span>
                  {selected && <Check size={15} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className="entry-model-panel-note">
            높을수록 처리 시간이 늘 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
