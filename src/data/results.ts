import type {
  AnalysisJob,
  AnalysisResult,
  Evidence,
  Layer,
  Verdict,
} from "../lib/types";
import { displayHost } from "../lib/url";
export const verdicts: Record<Verdict, { text: string; description: string }> =
  {
    safe: {
      text: "안전",
      description: "분석 범위 내에서 특이한 위험 신호가 확인되지 않았습니다.",
    },
    caution: {
      text: "주의",
      description: "주의가 필요한 신호가 확인되었습니다.",
    },
    danger: {
      text: "위험",
      description:
        "로그인 정보 전송과 의심스러운 페이지 동작이 확인되었습니다.",
    },
  };
export const layers: {
  id: Layer;
  title: string;
  subtitle: string;
  checked: number;
}[] = [
  {
    id: "L2",
    title: "네트워크 분석",
    subtitle: "연결 경로와 네트워크 환경을 살펴봅니다.",
    checked: 8,
  },
  {
    id: "L3",
    title: "콘텐츠 분석",
    subtitle: "페이지의 콘텐츠와 정보 전송 방식을 살펴봅니다.",
    checked: 9,
  },
  {
    id: "L4",
    title: "클로킹 / 행동 분석",
    subtitle: "접속 환경에 따른 변화와 실제 동작을 살펴봅니다.",
    checked: 6,
  },
];
export function resultFor(job: AnalysisJob): AnalysisResult {
  const host = displayHost(job.url);
  const evidence: Evidence[] = [
    {
      id: "redirect",
      layer: "L2",
      severity: "caution",
      confidence: 0.94,
      order: 0,
      title: "여러 도메인을 거치는 페이지 이동",
      label: "Redirect Chain",
      keySummary: "최종 페이지까지 서로 다른 도메인을 거쳐 3회 이동했습니다.",
      description:
        "최종 페이지에 도달하기까지 서로 다른 도메인을 거쳐 3회 이동했습니다. 분석 대상과 다른 사이트로 연결되는 경로가 확인되었습니다.",
      values: [
        { key: "Initial URL", value: job.url },
        { key: "Redirect count", value: "3" },
        {
          key: "Final URL",
          value:
            "https://account-verify.example/auth/session?source=redirect&continue=%2Faccount%2Fverification%2Fconfirm",
        },
      ],
    },
    {
      id: "certificate",
      layer: "L2",
      severity: "caution",
      confidence: 0.86,
      order: 1,
      title: "인증서와 접속 도메인 불일치",
      label: "TLS Certificate",
      keySummary:
        "연결 인증서의 도메인이 실제 접속 도메인과 일치하지 않습니다.",
      description:
        "연결에 사용된 인증서의 도메인이 실제 접속 도메인과 일치하지 않습니다. 연결의 신뢰성을 추가로 확인할 필요가 있습니다.",
      values: [
        { key: "Current Domain", value: host },
        { key: "Certificate Domain", value: "*.account-service.example" },
        {
          key: "Certificate Fingerprint",
          value:
            "A3:8F:91:20:BC:4D:67:E0:19:82:AC:F5:35:78:DD:1E:C7:36:10:AD:F2:64:93:7A:BE:55:6C:0F:28:90:AA:34",
        },
      ],
    },
    {
      id: "form-action",
      layer: "L3",
      severity: "danger",
      confidence: 0.99,
      order: 2,
      title: "외부 도메인으로 로그인 정보 전송",
      label: "Form Action Domain",
      keySummary: "로그인 정보의 전송 대상이 현재 사이트와 다른 도메인입니다.",
      description:
        "로그인 폼의 전송 대상이 현재 사이트와 다른 도메인으로 확인되었습니다. 입력한 정보가 외부 서버로 전달될 수 있습니다.",
      values: [
        {
          key: "Target URL",
          value: "https://collect-account.example/api/auth/verify",
        },
        { key: "Current Domain", value: host },
        { key: "Target Domain", value: "collect-account.example" },
        { key: "Method", value: "POST" },
      ],
    },
    {
      id: "brand",
      layer: "L3",
      severity: "danger",
      confidence: 0.91,
      order: 3,
      title: "공식 서비스를 모방한 로그인 화면",
      label: "Brand Impersonation",
      keySummary: "공식 서비스와 유사한 화면이 다른 도메인에서 제공됩니다.",
      description:
        "공식 서비스의 로그인 화면과 유사한 콘텐츠가 발견되었지만, 해당 서비스의 공식 도메인에서 제공되는 페이지는 아닙니다.",
      values: [
        { key: "Page title", value: "계정 확인 · 로그인" },
        { key: "Current Domain", value: host },
      ],
    },
    {
      id: "hidden-form",
      layer: "L3",
      severity: "caution",
      confidence: 0.8,
      order: 4,
      title: "숨겨진 외부 입력 수집 요소",
      label: "Hidden Input Collector",
      keySummary:
        "화면에 보이지 않는 입력 요소가 외부 전송 폼에 포함되어 있습니다.",
      description:
        "화면에 표시되지 않는 입력 요소가 외부 전송 폼에 포함되어 있습니다. 사용자 입력 외의 정보가 함께 전송될 가능성이 있습니다.",
      values: [
        { key: "Element type", value: 'input[type="hidden"]' },
        { key: "Target Domain", value: "collect-account.example" },
      ],
    },
    {
      id: "cloaking",
      layer: "L4",
      severity: "danger",
      confidence: 0.95,
      order: 5,
      title: "접속 환경에 따라 달라지는 콘텐츠",
      label: "User-Agent Cloaking",
      keySummary:
        "일반 브라우저와 자동 분석 환경에 서로 다른 페이지가 표시됩니다.",
      description:
        "일반 브라우저와 자동 분석 환경에서 서로 다른 페이지가 표시되었습니다. 분석을 회피하려는 동작일 가능성이 있습니다.",
      values: [
        { key: "Browser response", value: "로그인 정보 입력 화면" },
        { key: "Automated response", value: "서비스 점검 안내 화면" },
      ],
    },
  ];
  const isSafe = job.scenario === "safe";
  const isCaution = job.scenario === "caution";
  const final: Verdict = isSafe ? "safe" : isCaution ? "caution" : "danger";
  return {
    initial: isSafe
      ? "safe"
      : job.scenario === "fast-danger"
        ? "danger"
        : "caution",
    final,
    fastSummary: isSafe
      ? verdicts.safe.description
      : verdicts.caution.description,
    summary:
      job.scenario === "summary-fallback"
        ? "위험 신호가 여러 개 확인되었습니다. 아래 상세 근거를 확인해주세요."
        : isSafe
          ? "네트워크, 콘텐츠, 페이지 동작에서 의미 있는 위험 신호가 확인되지 않았습니다. 분석 시점과 범위에 따른 결과입니다."
          : isCaution
            ? "여러 도메인을 거치는 페이지 이동과 인증서 불일치가 확인되었습니다. 개인정보를 입력하기 전에 사이트 주소를 확인하는 것이 좋습니다."
            : "로그인 정보를 외부 도메인으로 전송하는 동작과 공식 서비스를 모방한 화면이 확인되었습니다. 여러 분석 근거를 종합했을 때 피싱 위험이 높은 것으로 판단됩니다.",
    evidence:
      isSafe || ["unknown", "stub", "blocked"].includes(job.scenario)
        ? []
        : isCaution
          ? evidence.slice(0, 2)
          : job.scenario === "partial"
            ? evidence.filter((e) => e.id !== "hidden-form")
            : evidence,
    partial: job.scenario === "partial",
  };
}
export function rankEvidence(evidence: Evidence[], limit: number): Evidence[] {
  return [...evidence]
    .sort(
      (a, b) =>
        Number(b.severity === "danger") - Number(a.severity === "danger") ||
        b.confidence - a.confidence ||
        a.order - b.order,
    )
    .slice(0, limit);
}
export function defaultLayer(evidence: Evidence[]): Layer {
  return (["L4", "L3", "L2"] as Layer[]).sort(
    (a, b) =>
      evidence.filter((e) => e.layer === b).length -
      evidence.filter((e) => e.layer === a).length,
  )[0];
}
