import type { DeepSnapshot, FastResult, VtResult } from "./contracts";

// Fictional examples. These are reachable only through the labelled design preview.
export const previewUrl = "https://parcel-verify.example/delivery";
export const previewVt: VtResult = {
  schema_version: "virustotal-url-report-1",
  status: "completed",
  stats: { malicious: 2, suspicious: 1, harmless: 30, undetected: 12 },
  report_at: "2026-10-06T09:30:00Z",
  checked_at: "2026-10-06T10:00:00Z",
  engines: [
    { name: "예시 검사 업체 A", category: "malicious", result: "phishing" },
    { name: "예시 검사 업체 B", category: "malicious", result: "malicious" },
    { name: "예시 검사 업체 C", category: "suspicious", result: "suspicious" },
    { name: "예시 검사 업체 D", category: "harmless", result: "clean" },
    { name: "예시 검사 업체 E", category: "undetected", result: "" },
  ],
};
export function previewVirusTotal(status: string): VtResult | null {
  if (status === "off") return null;
  if (status === "completed") return previewVt;
  if (status === "many")
    return {
      ...previewVt,
      stats: { ...previewVt.stats, malicious: 6, suspicious: 2 },
      engines: Array.from({ length: 8 }, (_, index) => ({
        name: `예시 검사 업체 ${String.fromCharCode(65 + index)}`,
        category: index < 6 ? "malicious" : "suspicious",
        result: index < 6 ? "malicious" : "suspicious",
      })),
    };
  if (status === "clean")
    return {
      ...previewVt,
      stats: { malicious: 0, suspicious: 0, harmless: 31, undetected: 12 },
      engines: previewVt.engines?.filter(
        (engine) =>
          engine.category === "harmless" || engine.category === "undetected",
      ),
    };
  return { schema_version: "virustotal-url-report-1", status };
}
export const previewFast: FastResult = {
  schema_version: "fast-result-1",
  job_id: "a".repeat(32),
  attempt: 1,
  context_revision: "b".repeat(64),
  result_revision: "c".repeat(64),
  judgment_status: "accepted",
  judgment: {
    verdict: "MALICIOUS",
    summary:
      "배송 확인을 빌미로 계정 정보 입력을 유도하는 정황이 확인되었습니다.",
    reasons: [
      {
        text: "배송 조회와 관계없는 계정 비밀번호를 요구합니다.",
        related_fact_ids: ["F1"],
      },
      {
        text: "입력한 정보를 페이지와 다른 주소로 전송합니다.",
        related_fact_ids: ["F2", "F6"],
      },
      {
        text: "공식 서비스를 연상시키는 화면을 별개의 도메인에서 제공합니다.",
        related_fact_ids: ["F3"],
      },
    ],
  },
  details: {
    sections: [],
    facts: [
      {
        fact_id: "F1",
        title: "로그인 입력 항목",
        plain: {
          title: "로그인 입력 항목",
          text: "배송 정보를 확인하려면 이메일 주소와 계정 비밀번호를 입력하라는 화면이 표시됩니다. ‘배송 조회 계속하기’ 버튼 위에 두 입력란이 함께 배치되어 있습니다.",
        },
        text: "페이지: https://parcel-verify.example/delivery\n폼 이름: delivery-login\n이메일 입력란: name=email, type=email\n비밀번호 입력란: name=password, type=password\n버튼 문구: 배송 조회 계속하기",
      },
      {
        fact_id: "F2",
        title: "입력 정보의 전송 대상",
        plain: {
          title: "입력 정보의 전송 대상",
          text: "이메일 주소와 비밀번호를 보내도록 설정된 주소는 collect.parcel-support.example입니다. 화면을 제공하는 parcel-verify.example과 다른 도메인입니다.",
        },
        text: "페이지 호스트: parcel-verify.example\n전송 대상: https://collect.parcel-support.example/session\n폼 전송 방식: POST\n전송 항목: email, password\n등록 도메인 비교: parcel-verify.example ≠ parcel-support.example",
        condition_fact_ids: ["F4"],
      },
      {
        fact_id: "F6",
        title: "전송하도록 구성된 입력 항목",
        plain: {
          title: "함께 보내도록 설정된 정보",
          text: "전송 항목에 이메일 주소와 비밀번호가 함께 포함되어 있습니다. 화면에 표시된 비밀번호 입력란의 값도 같은 요청에 담도록 구성되어 있습니다.",
        },
        text: "폼 이름: delivery-login\n이메일 입력값 연결: email\n비밀번호 입력값 연결: password\n전송 요청의 항목: email, password",
      },
      {
        fact_id: "F3",
        title: "화면과 주소의 관계",
        plain: {
          title: "화면과 주소의 관계",
          text: "화면에는 Parcel Delivery의 이름과 로고가 표시됩니다. 대조한 공식 주소는 parcel-delivery.example이며, 현재 접속 주소인 parcel-verify.example과 일치하지 않습니다.",
        },
        text: "화면에 표시된 서비스: Parcel Delivery\n페이지 호스트: parcel-verify.example\n대조한 공식 호스트: parcel-delivery.example\n등록 도메인 비교: 서로 다름",
      },
      {
        fact_id: "F4",
        title: "확인 범위",
        text: "페이지 코드에 기재된 전송 주소를 확인했습니다. 실제 계정 정보는 입력하지 않았습니다.",
      },
      {
        fact_id: "F5",
        title: "응답 상태",
        text: "페이지가 응답했습니다. 이 사실은 판정 이유와 연결되지 않아 화면에 나열하지 않습니다.",
      },
    ],
  },
  deep_analysis: { available: true },
};

const works = [
  {
    id: "W1",
    title: "로그인 유도 화면 확인",
    question: "배송 조회에 필요한 입력만 요구하는가?",
    reason: "계정 정보 입력을 요구하는 이유를 확인합니다.",
    status: "answered",
    answer: "배송 조회 화면에서 계정 비밀번호까지 요구하는 것을 확인했습니다.",
  },
  {
    id: "W2",
    title: "입력 정보 전송 대상 확인",
    question: "입력한 정보는 어디로 전송되는가?",
    reason: "페이지가 입력 정보를 처리하는 방식을 확인합니다.",
    status: "answered",
    answer: "로그인 정보가 별도의 도메인으로 전달되도록 구성되어 있습니다.",
  },
  {
    id: "W3",
    title: "서비스 이름과 주소 비교",
    question: "화면의 서비스와 현재 도메인이 일치하는가?",
    reason: "서비스를 사칭하는 정황이 있는지 확인합니다.",
    status: "answered",
    answer:
      "화면에서 표시한 서비스와 현재 도메인 사이의 공식 관계를 확인하지 못했습니다.",
  },
  {
    id: "W4",
    title: "페이지 전환 후 변화 확인",
    question: "다음 화면에서 어떤 정보를 추가로 요구하는가?",
    reason: "처음 화면 이후의 동작을 확인합니다.",
    status: "answered",
    answer: "조회 버튼 이후에도 배송 조회 결과 대신 계정 입력을 요구했습니다.",
  },
];
const taskData = [
  [
    "T1",
    "W1",
    "화면의 입력 항목 확인",
    "이메일 주소와 비밀번호 입력란이 함께 표시됩니다.",
  ],
  [
    "T2",
    "W1",
    "로그인 요청 문구 확인",
    "배송 확인을 위해 로그인이 필요하다는 문구를 표시합니다.",
  ],
  [
    "T3",
    "W2",
    "전송 주소 확인",
    "입력값을 전송하는 주소가 현재 페이지의 도메인과 다릅니다.",
  ],
  [
    "T4",
    "W2",
    "입력 정보 처리 방식 확인",
    "비밀번호 입력값을 요청 본문에 포함하도록 구성되어 있습니다.",
  ],
  [
    "T5",
    "W3",
    "표시된 서비스와 도메인 비교",
    "서비스 이름은 표시되지만 공식 도메인에서는 제공되지 않습니다.",
  ],
  [
    "T6",
    "W4",
    "조회 버튼 이후 화면 확인",
    "배송 결과 화면으로 전환되지 않고 계정 입력 화면으로 이어집니다.",
  ],
];
export function previewDeep(
  phase: "collect" | "plan" | "work" | "finalizing" | "completed" | "failed",
  sequence = 1,
): DeepSnapshot {
  const started = !["collect", "plan"].includes(phase);
  const finished = ["finalizing", "completed"].includes(phase);
  return {
    run_id: "design-preview",
    scan_id: previewFast.job_id,
    status:
      phase === "collect"
        ? "starting"
        : phase === "plan" || phase === "work"
          ? "running"
          : phase,
    input: {
      job_id: previewFast.job_id,
      attempt: 1,
      context_revision: previewFast.context_revision!,
      result_revision: previewFast.result_revision,
    },
    publish_seq: sequence,
    works: started
      ? works.map((work, index) => ({
          ...work,
          status: finished || index === 0 ? "answered" : "open",
          answer: finished || index === 0 ? work.answer : undefined,
        }))
      : [],
    tasks: started
      ? taskData.map(([id, work_id, title], index) => ({
          id,
          work_id,
          title,
          status:
            finished || index < 2
              ? "returned"
              : index === 2
                ? phase === "failed"
                  ? "failed"
                  : "running"
                : "waiting",
          result_ref: finished || index < 2 ? `report:${id}` : null,
        }))
      : [],
    results: taskData.map(([id, , , summary]) => ({
      result_ref: `report:${id}`,
      kind: "agent_report",
      data: { summary, findings: [], limits: [] },
    })),
    managers:
      phase === "collect"
        ? []
        : [
            {
              id: "M1",
              status: phase === "plan" ? "running" : "returned",
              summary:
                phase === "plan"
                  ? null
                  : "로그인 화면과 입력 정보의 전송 대상을 먼저 확인합니다. 서비스 이름과 주소의 관계도 함께 비교합니다.",
              situation: "업무 구성 중",
              review_work_ids: [],
              decision_summary: { new_work_ids: ["W1", "W2", "W3", "W4"] },
            },
            ...(started
              ? [
                  {
                    id: "M2",
                    status:
                      finished || phase === "failed" ? "returned" : "running",
                    summary: finished
                      ? "여러 업무에서 확인한 내용이 같은 로그인 유도 흐름으로 이어집니다. 입력 요구와 전송 대상의 관계를 종합해 최종 결론을 정리했습니다."
                      : phase === "failed"
                        ? "로그인 요구 화면을 확인했습니다. 나머지 확인 업무는 완료하지 못했습니다."
                        : null,
                    situation: "확인 결과 검토 중",
                    review_work_ids: finished
                      ? ["W1", "W2", "W3", "W4"]
                      : ["W1"],
                    decision_summary: finished
                      ? {
                          answered_work_ids: ["W1", "W2", "W3", "W4"],
                          finish: true,
                        }
                      : null,
                  },
                ]
              : []),
          ],
    files:
      phase === "collect"
        ? []
        : [
            {
              file_ref: "capture:example",
              content_type: "image/jpeg",
              url: "/preview-capture.jpg",
              source_metadata: {
                action_id: "initial-screen",
                context: { scenario_id: "initial-input" },
              },
            },
          ],
    result:
      phase === "finalizing" || phase === "completed"
        ? {
            summary:
              "배송 조회를 가장해 계정 정보를 수집하는 페이지로 판단됩니다.",
            findings: [
              {
                statement: "배송 조회와 관계없는 계정 비밀번호를 요구합니다.",
                refs: [],
              },
              {
                statement:
                  "입력 정보가 별개의 도메인으로 전송되는 흐름을 확인했습니다.",
                refs: [],
              },
              {
                statement:
                  "공식 서비스처럼 보이는 화면과 실제 주소가 일치하지 않습니다.",
                refs: [],
              },
            ],
            limits: ["실제 계정 정보는 입력하지 않았습니다."],
          }
        : null,
  };
}
