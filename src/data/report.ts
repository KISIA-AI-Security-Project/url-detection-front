import type { AnalysisJob, AnalysisResult, Verdict } from "../lib/types";
import { rankEvidence } from "./results";

// Completed-result fields from the supplied extension guide. No transport here.
export interface CompletedReport {
  status: "COMPLETED";
  verdict: string;
  route?: string;
  judgment?: {
    reasons?: string[];
    limitations?: string[];
    confidence?: number;
    recommended_actions?: string[];
  };
  coverage?: {
    layers_run: string[];
    layers_skipped: string[];
    layers_stubbed: string[];
  };
  stub?: { any: boolean; layers: string[] };
}

export type ReportTone = Verdict | "unknown";
export const reportVerdicts: Record<ReportTone, string> = {
  safe: "위험 징후 없음",
  caution: "주의",
  danger: "위험",
  unknown: "판단 불가",
};
const fallbackActions: Record<ReportTone, string[]> = {
  danger: [
    "외부 정보 전송 신호가 확인되어 개인정보 입력과 사이트 이용에 주의가 필요합니다.",
  ],
  caution: [
    "개인정보 입력 전 사이트 주소와 운영 주체를 추가로 확인하는 것이 좋습니다.",
  ],
  safe: [
    "분석 시점의 결과이며, 이후 사이트의 콘텐츠나 동작은 달라질 수 있습니다.",
  ],
  unknown: [
    "안전 여부를 확인할 정보가 부족합니다. 개인정보 입력과 파일 다운로드에 주의가 필요합니다.",
  ],
};

const layerLabels: Record<string, string> = {
  l0: "URL 구조",
  l1: "도메인·평판",
  l2: "네트워크",
  l3: "콘텐츠",
  l4: "클로킹·행동",
};
const describeLayers = (layers: string[]) =>
  [...new Set(layers)].map((layer) => layerLabels[layer] || layer);

export function mapReport(data: CompletedReport) {
  const tones: Record<string, ReportTone> = {
    MALICIOUS: "danger",
    SUSPICIOUS: "caution",
    LIKELY_BENIGN: "safe",
    UNKNOWN: "unknown",
  };
  const stubbed = new Set([
    ...(data.coverage?.layers_stubbed || []),
    ...(data.stub?.layers || []),
  ]);
  const isStub = data.stub?.any === true || stubbed.size > 0;
  const blocked = data.route === "BLOCKED";
  const reportedTone = tones[data.verdict] || "unknown";
  const tone: ReportTone =
    isStub || (blocked && reportedTone === "safe") ? "unknown" : reportedTone;
  const reasons =
    data.judgment?.reasons?.filter((reason) => reason.trim()) || [];
  const limitations = (data.judgment?.limitations || [])
    .filter((item) => item.trim())
    .map((item) =>
      item.startsWith("gateway_error:")
        ? "판정 서비스의 응답을 확인하지 못해 최종 판단에 제한이 있습니다."
        : item,
    );
  if (blocked)
    limitations.push(
      "대상 사이트에 접근이 제한되어 분석 범위가 제한되었습니다.",
    );
  if (tone === "unknown" && !limitations.length) {
    limitations.push("확보된 정보만으로는 위험 수준을 판단하기 어렵습니다.");
  }
  const confidence = data.judgment?.confidence;
  const validConfidence =
    tone !== "unknown" &&
    typeof confidence === "number" &&
    Number.isFinite(confidence) &&
    confidence >= 0 &&
    confidence <= 1;
  const actions =
    data.judgment?.recommended_actions?.filter((action) => action.trim()) || [];
  return {
    tone,
    label: reportVerdicts[tone],
    confidence: validConfidence ? `${Math.round(confidence * 100)}%` : null,
    actions: isStub
      ? ["실제 분석 데이터가 확보된 뒤 결과를 확인하세요."]
      : actions.length
        ? actions
        : fallbackActions[tone],
    reasons: reasons.length ? reasons : ["제공된 판단 사유가 없습니다."],
    limitations: [...new Set(limitations)],
    coverage: data.coverage
      ? {
          checked: describeLayers(
            data.coverage.layers_run.filter((layer) => !stubbed.has(layer)),
          ),
          layerIds: [
            ...new Set(
              data.coverage.layers_run.filter((layer) => !stubbed.has(layer)),
            ),
          ].map((layer) => layer.toUpperCase()),
          skipped: describeLayers(data.coverage.layers_skipped),
          stubbed: describeLayers([...stubbed]),
        }
      : null,
    notice: isStub
      ? "시험용 데이터가 포함된 결과입니다. 실제 보안 판정으로 사용할 수 없습니다."
      : null,
  };
}

// Existing screens still use local mock jobs; these fixtures exercise the guide's
// display states without making requests or implying that the API is connected.
export function reportFor(job: AnalysisJob, result: AnalysisResult) {
  if (job.scenario === "unknown") {
    return mapReport({
      status: "COMPLETED",
      verdict: "UNKNOWN",
      coverage: {
        layers_run: ["l0", "l1", "l2", "l3"],
        layers_skipped: [],
        layers_stubbed: [],
      },
      judgment: {
        reasons: ["판정 서비스의 응답을 확인하지 못했습니다."],
        limitations: ["gateway_error:GatewayError"],
      },
    });
  }
  if (job.scenario === "stub" || job.scenario === "blocked") {
    const isStub = job.scenario === "stub";
    return mapReport({
      status: "COMPLETED",
      verdict: "UNKNOWN",
      route: isStub ? "ACTIVE" : "BLOCKED",
      stub: { any: isStub, layers: isStub ? ["l2", "l3"] : [] },
      coverage: {
        layers_run: ["l0", "l1"],
        layers_skipped: isStub ? ["l4"] : ["l2", "l3", "l4"],
        layers_stubbed: isStub ? ["l2", "l3"] : [],
      },
      judgment: {
        reasons: [
          isStub
            ? "일부 분석 영역에 시험용 데이터가 사용되었습니다."
            : "대상 사이트의 콘텐츠를 확인하지 못했습니다.",
        ],
      },
    });
  }
  const verdictCodes: Record<Verdict, string> = {
    safe: "LIKELY_BENIGN",
    caution: "SUSPICIOUS",
    danger: "MALICIOUS",
  };
  return mapReport({
    status: "COMPLETED",
    verdict: verdictCodes[result.final],
    judgment: {
      reasons: result.evidence.length
        ? rankEvidence(result.evidence, 3).map((evidence) => evidence.title)
        : [result.summary],
      // The supplied visual reference uses 92%; this is an explicit mock value,
      // never an average of individual evidence confidence scores.
      confidence:
        result.final === "danger" && job.scenario !== "summary-fallback"
          ? 0.92
          : undefined,
      limitations: result.partial
        ? ["일부 콘텐츠 분석을 완료하지 못했습니다."]
        : [],
    },
    coverage: {
      layers_run: ["l2", "l3", "l4"],
      layers_skipped: [],
      layers_stubbed: [],
    },
  });
}
