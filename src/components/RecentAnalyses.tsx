import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AnalysisHistory } from "../service/contracts";
import "../service/entry.css";

export function RecentAnalyses({
  analyses,
  onOpenAnalysis,
}: {
  analyses: readonly AnalysisHistory[];
  onOpenAnalysis: (row: AnalysisHistory) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  return (
    <section className="entry-history" aria-labelledby={`${listId}-title`}>
      <div className="entry-history-heading">
        <h2 id={`${listId}-title`}>최근 분석</h2>
        {analyses.length > 0 && analyses.length <= 3 ? (
          <span>결과 다시 열기</span>
        ) : analyses.length > 3 ? (
          <button
            type="button"
            className="text-button entry-history-toggle"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "접기" : "전체 보기"}
            <ChevronDown
              size={14}
              className={expanded ? "rotated" : ""}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>
      <ul id={listId}>
        {analyses.map((row, index) => (
          <li
            key={row.scanId}
            className={
              index >= 3
                ? `entry-history-collapsible${expanded ? " is-expanded" : ""}`
                : undefined
            }
            aria-hidden={index >= 3 && !expanded}
          >
            <button
              type="button"
              className="entry-history-item"
              tabIndex={index >= 3 && !expanded ? -1 : undefined}
              onClick={() => onOpenAnalysis(row)}
            >
              <span>{row.url}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {!analyses.length && (
        <p className="entry-history-empty">
          분석한 링크가 여기에 표시됩니다. 결과를 다시 열어볼 수 있어요.
        </p>
      )}
    </section>
  );
}
