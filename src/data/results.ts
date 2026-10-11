import type {
  AnalysisJob,
  AnalysisResult,
  Evidence,
  Reason,
  RedirectHop,
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
const FINAL_URL =
  "https://account-verify.example/auth/session?source=redirect&continue=%2Faccount%2Fverification%2Fconfirm";
// Mock hops matching the "Redirect Chain" evidence (3 moves, 4 pages).
function mockRedirectChain(url: string): RedirectHop[] {
  return [
    { url, domain: displayHost(url), status: 302 },
    {
      url: "https://track.link-redirect.example/r?id=8f2a91c4&utm_source=mail",
      domain: "track.link-redirect.example",
      status: 302,
    },
    {
      url: "https://cdn-login-service.example/gateway?next=%2Fauth%2Fsession",
      domain: "cdn-login-service.example",
      status: 301,
    },
    { url: FINAL_URL, domain: "account-verify.example", status: 200 },
  ];
}
// Mock reasons in the order a judgment would present them. Each reason is
// kept only when at least one of its facts was confirmed for the scenario.
const reasonTemplates: Reason[] = [
  {
    id: "credential-exfil",
    text: "로그인 정보가 현재 사이트가 아닌 외부 도메인으로 전송되도록 구성돼 있습니다.",
    factIds: ["form-action", "hidden-form"],
  },
  {
    id: "impersonation",
    text: "공식 서비스와 유사한 로그인 화면이 다른 도메인에서 제공됩니다.",
    factIds: ["brand"],
  },
  {
    id: "redirect",
    text: "여러 도메인을 거쳐 최종 페이지로 이동합니다.",
    factIds: ["redirect"],
  },
  {
    id: "certificate",
    text: "연결 인증서가 실제 접속 도메인과 일치하지 않습니다.",
    factIds: ["certificate"],
  },
];
function reasonsFor(found: Evidence[]): Reason[] {
  const ids = new Set(found.map((e) => e.id));
  return reasonTemplates
    .map((reason) => ({
      ...reason,
      factIds: reason.factIds.filter((id) => ids.has(id)),
    }))
    .filter((reason) => reason.factIds.length > 0);
}
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
      keyword: "다중 리다이렉트",
      keySummary: "최종 페이지까지 서로 다른 도메인을 거쳐 3회 이동했습니다.",
      description:
        "최종 페이지에 도달하기까지 서로 다른 도메인을 거쳐 3회 이동했습니다. 분석 대상과 다른 사이트로 연결되는 경로가 확인되었습니다.",
      values: [
        { key: "Initial URL", value: job.url },
        { key: "Redirect count", value: "3" },
        {
          key: "Final URL",
          value: FINAL_URL,
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
      keyword: "인증서 불일치",
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
      keyword: "로그인 정보 외부 전송",
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
      keyword: "공식 서비스 모방",
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
      keyword: "숨겨진 입력 수집",
      keySummary:
        "화면에 보이지 않는 입력 요소가 외부 전송 폼에 포함되어 있습니다.",
      description:
        "화면에 표시되지 않는 입력 요소가 외부 전송 폼에 포함되어 있습니다. 사용자 입력 외의 정보가 함께 전송될 가능성이 있습니다.",
      values: [
        { key: "Element type", value: 'input[type="hidden"]' },
        { key: "Target Domain", value: "collect-account.example" },
      ],
    },
  ];
  const isSafe = job.scenario === "safe";
  const isCaution = job.scenario === "caution";
  const found =
    isSafe || ["unknown", "stub", "blocked"].includes(job.scenario)
      ? []
      : isCaution
        ? evidence.slice(0, 2)
        : job.scenario === "partial"
          ? evidence.filter((e) => e.id !== "hidden-form")
          : evidence;
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
    evidence: found,
    reasons: reasonsFor(found),
    redirectChain: found.some((e) => e.id === "redirect")
      ? mockRedirectChain(job.url)
      : [],
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
