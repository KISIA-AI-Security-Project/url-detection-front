import { ChevronDown } from "lucide-react";
import type { VtResult } from "../service/contracts";
import { Spinner } from "./ui";

const title = "VirusTotal 조회 결과";

const statusMessages: Record<string, string> = {
  queued: "검사 결과를 조회하고 있습니다.",
  not_requested: "VirusTotal 조회를 선택하지 않았습니다.",
  not_found: "등록된 검사 결과가 없습니다.",
  quota_exhausted: "조회 한도에 도달해 결과를 확인하지 못했습니다.",
  failed: "검사 결과를 불러오지 못했습니다.",
};
export function VirusTotalResult({ result }: { result?: VtResult | null }) {
  if (!result || result.status === "not_requested") return null;
  const malicious = result.stats?.malicious;
  const suspicious = result.stats?.suspicious;
  const hasCounts =
    typeof malicious === "number" &&
    Number.isInteger(malicious) &&
    malicious >= 0 &&
    typeof suspicious === "number" &&
    Number.isInteger(suspicious) &&
    suspicious >= 0;
  const completed = result.status === "completed" && hasCounts;
  const engines = Array.isArray(result.engines)
    ? result.engines
        .filter(
          (engine) =>
            engine &&
            typeof engine.name === "string" &&
            (engine.category === "malicious" ||
              engine.category === "suspicious"),
        )
        .sort(
          (a, b) =>
            Number(a.category === "suspicious") -
              Number(b.category === "suspicious") ||
            a.name.localeCompare(b.name, "ko"),
        )
    : [];
  const description = (
    <p className="vt-description">
      보안 검사 업체의 결과이며, 우리 서비스의 판정과 별도입니다.
    </p>
  );
  const counts = (
    <span className="vt-counts">
      <span className="vt-danger">위험 {malicious}개</span>
      <span className="vt-count-divider" aria-hidden="true">
        {" "}
        ·{" "}
      </span>
      <span className="vt-suspicious">의심 {suspicious}개</span>
    </span>
  );
  return (
    <section className="vt-summary" aria-label={title}>
      {completed ? (
        <details className="vt-details">
          <summary>
            <span className="vt-title">{title}</span>
            {counts}
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <div className="vt-details-body">
            {description}
            <FlaggedEngineResults
              engines={engines}
              emptyText={
                malicious === 0 && suspicious === 0
                  ? "위험·의심으로 표시한 검사 업체가 없습니다."
                  : "검사 업체별 상세 결과가 제공되지 않았습니다."
              }
            />
          </div>
        </details>
      ) : (
        <div className="vt-status-summary">
          <h2 className="vt-title">{title}</h2>
          <p className="vt-status" role="status">
            {result.status === "queued" && <Spinner size={16} />}
            {statusMessages[result.status] ||
              "검사 결과 값을 확인하지 못했습니다."}
          </p>
        </div>
      )}
    </section>
  );
}

function FlaggedEngineResults({
  engines,
  emptyText,
}: {
  engines: NonNullable<VtResult["engines"]>;
  emptyText: string;
}) {
  if (!engines.length) return <p className="vt-empty">{emptyText}</p>;
  return (
    <ul
      className={`vt-engines${engines.length > 4 ? " is-scrollable" : ""}`}
      aria-label="검사 업체별 결과"
      tabIndex={engines.length > 4 ? 0 : undefined}
    >
      {engines.map((engine, index) => (
        <li key={`${engine.category}:${engine.name}:${index}`}>
          <div className="vt-engine-heading">
            <strong>{engine.name}</strong>
            <span
              className={
                engine.category === "malicious" ? "vt-danger" : "vt-suspicious"
              }
            >
              {engine.category === "malicious" ? "위험" : "의심"}
            </span>
          </div>
          {typeof engine.result === "string" && engine.result && (
            <p>{engine.result}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
