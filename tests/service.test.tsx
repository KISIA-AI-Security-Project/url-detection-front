import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FastResultView,
  DeepResultView,
} from "../src/components/ServiceResults";
import {
  deepPhase,
  captureFor,
  fastPhase,
  imageUrl,
  managerForWork,
  reasonFacts,
  taskReport,
  taskPresentation,
  workState,
} from "../src/service/presentation";
import {
  previewDeep,
  previewFast,
  previewModels,
  previewUrl,
  previewVt,
} from "../src/service/preview-fixtures";
import { ServiceClient, validateFast } from "../src/service/service-client.js";
import { popupReasons, popupVerdicts } from "../src/service/popup-model";
import type { FastResult, FastVerdict } from "../src/service/contracts";
import { VirusTotalResult } from "../src/components/VirusTotalResult";

afterEach(() => vi.unstubAllGlobals());
describe("authoritative fast results", () => {
  it.each<[FastVerdict, string]>([
    ["BENIGN", "정상"],
    ["LIKELY_BENIGN", "정상 가능성 높음"],
    ["LIKELY_MALICIOUS", "악성 가능성 높음"],
    ["MALICIOUS", "악성"],
    ["UNKNOWN", "판단불가"],
    ["SUSPICIOUS", "의심"],
  ])(
    "accepts and displays the server verdict %s without reclassification",
    (verdict, label) => {
      const result: FastResult = {
        ...previewFast,
        judgment: { ...previewFast.judgment!, verdict },
      };
      expect(validateFast(result, result.job_id, result.attempt)).toBe(result);
      const html = renderToStaticMarkup(
        <FastResultView result={result} url={previewUrl} onDeep={() => {}} />,
      );
      expect(html).toMatch(new RegExp(`${label}</h2>`));
      expect(html).toContain(`data-verdict="${verdict}"`);
      expect(html).toContain(result.judgment!.summary);
    },
  );
  it("distinguishes collecting material from model judgment by the context revision", () => {
    const pending: FastResult = {
      ...previewFast,
      judgment_status: "pending",
      judgment: null,
    };
    expect(fastPhase(null)).toBe("collect");
    expect(fastPhase({ ...pending, context_revision: null })).toBe("collect");
    expect(
      fastPhase({ ...pending, details: { facts: [], sections: [] } }),
    ).toBe("judge");
    expect(fastPhase(previewFast)).toBe("done");
  });
  it("keeps the result-shaped loading preview decorative and exposes only the current fast phase", () => {
    const pending: FastResult = {
      ...previewFast,
      judgment_status: "pending",
      judgment: null,
      context_revision: null,
    };
    const collecting = renderToStaticMarkup(
      <FastResultView
        result={pending}
        url={previewUrl}
        onDeep={() => {}}
        virustotal={previewVt}
      />,
    );
    expect(collecting).toContain(
      'class="fast-pending-preview" aria-hidden="true"',
    );
    expect(collecting).toContain('class="fast-progress-card" role="status"');
    expect(collecting).toContain("빠른 분석 진행 중");
    expect(collecting).toContain('class="fast-progress-steps"');
    expect(collecting).toContain("자료 수집");
    expect(collecting).toContain("모델 판단");
    expect(collecting).toContain("대기 중");
    expect(collecting.match(/fast-pending-section/g)).toHaveLength(3);
    expect(collecting).toContain("fast-skeleton-request");
    expect(collecting).not.toContain(previewUrl);
    expect(collecting).not.toContain("VirusTotal 조회 결과");

    const judging = renderToStaticMarkup(
      <FastResultView
        result={{ ...pending, context_revision: previewFast.context_revision }}
        url={previewUrl}
        onDeep={() => {}}
      />,
    );
    expect(judging).toContain(">모델 판단 중</strong><span>진행 중</span>");
    expect(judging).toContain(
      "수집한 자료를 바탕으로 결과를 생성하고 있습니다.",
    );
    expect(judging).toContain("완료");
  });
  it("shows only facts linked to a reason, including the facts needed to qualify that observation", () => {
    expect(
      reasonFacts(previewFast.judgment!.reasons[1], previewFast).map(
        (fact) => fact.fact_id,
      ),
    ).toEqual(["F2", "F6", "F4"]);
  });
  it("keeps the verdict first and combines each reason with its linked details", () => {
    const html = renderToStaticMarkup(
      <FastResultView
        result={previewFast}
        url={previewUrl}
        onDeep={() => {}}
        virustotal={previewVt}
        deepModelSelection={{
          models: previewModels,
          value: previewModels[0].id,
          effort: previewModels[0].default_effort,
          loading: false,
          error: "",
          onChange: () => {},
          onEffortChange: () => {},
          onRetry: () => {},
        }}
      />,
    );
    expect(html.indexOf('class="fast-verdict-card')).toBeLessThan(
      html.indexOf('id="fast-reasons"'),
    );
    expect(html).toContain('class="text-button fast-result-back" href="/"');
    expect(html).toContain("다른 URL 검사");
    expect(html.indexOf('id="fast-reasons"')).toBeLessThan(
      html.indexOf("fast-vt-section"),
    );
    expect(html).not.toContain("근거 상세 보기");
    expect(html).not.toContain("판정 이유 보기");
    expect(html).not.toContain("fast-verdict-label");
    expect(html).toContain("기술정보 표시");
    expect(html).toContain('class="entry-options deep-request-actions"');
    expect(html).toContain("GPT-6 Astra");
  });
  it("uses one GPT preview catalog for the main and additional-analysis pickers", () => {
    expect(previewModels.map(({ id }) => id)).toEqual([
      "gpt-6-astra",
      "gpt-6.1-sol",
      "gpt-6-luna",
    ]);
    expect(previewModels.every(({ efforts }) => efforts.length === 5)).toBe(
      true,
    );
  });
  it("keeps section numbering consecutive when VirusTotal was not selected", () => {
    const html = renderToStaticMarkup(
      <FastResultView
        result={previewFast}
        url={previewUrl}
        onDeep={() => {}}
        virustotal={null}
      />,
    );
    expect(html).toContain(
      'aria-hidden="true">02</span><h2 id="deep-request-title">추가 분석</h2>',
    );
    expect(html).not.toContain("fast-vt-section");
  });
  it("handles cyclic conditions, repeated IDs and missing IDs without adding unrelated facts", () => {
    const result: FastResult = {
      ...previewFast,
      details: {
        sections: [],
        facts: [
          { fact_id: "A", title: "A", text: "A", condition_fact_ids: ["B"] },
          { fact_id: "B", title: "B", text: "B", condition_fact_ids: ["A"] },
          { fact_id: "C", title: "C", text: "unrelated" },
        ],
      },
    };
    expect(
      reasonFacts(
        { text: "reason", related_fact_ids: ["A", "A", "missing"] },
        result,
      ).map((fact) => fact.fact_id),
    ).toEqual(["A", "B"]);
  });
  it("keeps UNKNOWN with no reasons separate from a failed model request", () => {
    const unknown: FastResult = {
      ...previewFast,
      judgment: {
        verdict: "UNKNOWN",
        summary: "판단하기 어렵습니다.",
        reasons: [],
      },
    };
    expect(validateFast(unknown, unknown.job_id, 1)).toBe(unknown);
    const html = renderToStaticMarkup(
      <FastResultView result={unknown} url={previewUrl} onDeep={() => {}} />,
    );
    expect(html).toContain("판단불가");
    expect(html).not.toContain("판정 이유");
    const failed = renderToStaticMarkup(
      <FastResultView
        result={{ ...unknown, judgment: null, judgment_status: "failed" }}
        url={previewUrl}
        onDeep={() => {}}
      />,
    );
    expect(failed).toContain("분석을 완료하지 못했습니다");
    expect(failed).not.toContain("판단불가");
  });
  it("rejects results for another analysis, ignores old attempts and rejects a newer attempt", () => {
    expect(() => validateFast(previewFast, "d".repeat(32), 1)).toThrow();
    expect(validateFast(previewFast, previewFast.job_id, 2)).toBeNull();
    expect(() =>
      validateFast({ ...previewFast, attempt: 3 }, previewFast.job_id, 2),
    ).toThrow();
  });
});

describe("extension popup result summary", () => {
  it.each<[FastVerdict, string]>([
    ["BENIGN", "안전"],
    ["LIKELY_BENIGN", "안전"],
    ["LIKELY_MALICIOUS", "주의"],
    ["MALICIOUS", "위험"],
    ["UNKNOWN", "주의"],
    ["SUSPICIOUS", "주의"],
  ])("maps the API verdict %s to the popup label %s", (verdict, label) => {
    expect(popupVerdicts[verdict].label).toBe(label);
  });

  it("keeps server reason order and limits the popup to three items", () => {
    const result: FastResult = {
      ...previewFast,
      judgment: {
        ...previewFast.judgment!,
        reasons: [
          ...previewFast.judgment!.reasons,
          { text: "네 번째 근거", related_fact_ids: [] },
        ],
      },
    };
    expect(popupReasons(result)).toEqual(
      result.judgment!.reasons.slice(0, 3).map((reason) => reason.text),
    );
  });

  it("does not derive reasons when the API judgment was not accepted", () => {
    expect(
      popupReasons({
        ...previewFast,
        judgment_status: "failed",
        judgment: null,
      }),
    ).toEqual([]);
  });
});

describe("independent VirusTotal results", () => {
  it("preserves provider counts while listing only flagged engines and omitting external links", () => {
    const html = renderToStaticMarkup(
      <VirusTotalResult
        result={{
          ...previewVt,
          stats: { ...previewVt.stats, malicious: 17 },
          report_url: "https://www.virustotal.com/gui/url/example/detection",
        }}
      />,
    );
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toContain("위험 17개");
    expect(text).toContain("의심 1개");
    expect(html).toContain("예시 검사 업체 A");
    expect(html).toContain("예시 검사 업체 C");
    expect(html).not.toContain("예시 검사 업체 D");
    expect(html).not.toContain("예시 검사 업체 E");
    expect(html).not.toContain("개 검사 중");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("virustotal.com");
    expect(html).not.toContain("검사 자료 시각");
    expect(html).not.toContain("조회 시각");
  });
  it.each(["queued", "not_found", "quota_exhausted", "failed"])(
    "does not turn %s into zero detections",
    (status) => {
      const html = renderToStaticMarkup(
        <VirusTotalResult
          result={{ schema_version: previewVt.schema_version, status }}
        />,
      );
      expect(html).not.toContain("vt-counts");
      expect(html).not.toContain("0개");
      expect(html).not.toContain("<details");
    },
  );
  it("renders every flagged vendor in a four-row scroll area without changing report totals", () => {
    const html = renderToStaticMarkup(
      <VirusTotalResult
        result={{
          ...previewVt,
          stats: { malicious: 17, suspicious: 2 },
          engines: [
            { name: "업체 A", category: "malicious" },
            { name: "업체 B", category: "malicious" },
            { name: "업체 C", category: "malicious" },
            { name: "업체 D", category: "suspicious" },
            { name: "업체 E", category: "suspicious" },
          ],
        }}
      />,
    );
    expect(html.match(/class="vt-engine-heading"/g)).toHaveLength(5);
    expect(html).toContain("업체 D");
    expect(html).toContain("업체 E");
    expect(html).toContain('class="vt-engines is-scrollable"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain("검사 업체 모두 보기");
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toContain("위험 17개");
    expect(text).toContain("의심 2개");
  });
  it("distinguishes missing counts and missing engine details from explicit zero results", () => {
    const missingCounts = renderToStaticMarkup(
      <VirusTotalResult result={{ ...previewVt, stats: undefined }} />,
    );
    expect(missingCounts).toContain("결과 값을 확인하지 못했습니다");
    expect(missingCounts).not.toContain("0개");
    const missingDetails = renderToStaticMarkup(
      <VirusTotalResult result={{ ...previewVt, engines: undefined }} />,
    );
    expect(missingDetails).toContain(
      "검사 업체별 상세 결과가 제공되지 않았습니다",
    );
    expect(missingDetails).not.toContain("검사 업체가 없습니다");
    const zero = renderToStaticMarkup(
      <VirusTotalResult
        result={{
          ...previewVt,
          stats: { malicious: 0, suspicious: 0 },
          engines: [],
        }}
      />,
    );
    expect(zero.replace(/<[^>]+>/g, "")).toContain("위험 0개");
    expect(zero).toContain("위험·의심으로 표시한 검사 업체가 없습니다");
    expect(zero).not.toContain("안전");
  });
  it("remains absent when not selected and does not replace our UNKNOWN result", () => {
    expect(renderToStaticMarkup(<VirusTotalResult result={null} />)).toBe("");
    expect(
      renderToStaticMarkup(
        <VirusTotalResult
          result={{
            schema_version: previewVt.schema_version,
            status: "not_requested",
          }}
        />,
      ),
    ).toBe("");
    const html = renderToStaticMarkup(
      <FastResultView
        result={{
          ...previewFast,
          judgment: {
            verdict: "UNKNOWN",
            summary: "판단하기 어렵습니다.",
            reasons: [],
          },
        }}
        url={previewUrl}
        onDeep={() => {}}
        virustotal={previewVt}
      />,
    );
    expect(html).toContain("판단불가");
    expect(html).toContain("VirusTotal 조회 결과");
  });
});

describe("bounded public deep presentation", () => {
  it("shows the boxed progress, capture and work details only while deep analysis is running", () => {
    const running = renderToStaticMarkup(
      <DeepResultView snapshot={previewDeep("collect")} url={previewUrl} />,
    );
    expect(running).toContain('class="deep-running-card"');
    expect(running).toContain('class="deep-running-preview-lower"');
    expect(running.match(/class="state-mark/g)).toHaveLength(5);
    expect(running).not.toContain('class="works-section"');
    expect(running).toContain('class="capture-section"');
    expect(running).not.toContain('class="manager-section"');

    const checking = renderToStaticMarkup(
      <DeepResultView snapshot={previewDeep("work")} url={previewUrl} />,
    );
    expect(checking).toContain('class="deep-running-preview"');
    expect(checking).toContain('class="deep-running-overview"');
    expect(checking).toContain('class="deep-running-capture"');
    expect(checking).not.toContain('class="capture-dialog"');
    expect(checking).toContain('class="deep-running-work-list"');
    expect(checking.match(/aria-expanded="false"/g)).toHaveLength(4);
    expect(checking).toContain('aria-controls="deep-running-work-0"');
    expect(checking).not.toContain("핵심 확인 내용");
    expect(checking).toContain("로그인 유도 화면 확인");
    expect(checking).toContain("이메일 주소와 비밀번호");

    const completed = renderToStaticMarkup(
      <DeepResultView snapshot={previewDeep("completed")} url={previewUrl} />,
    );
    expect(completed).not.toContain('class="deep-running-card"');
    expect(completed).toContain('class="deep-columns"');
    expect(completed).toContain('class="capture-section"');

    const cancelled = renderToStaticMarkup(
      <DeepResultView
        snapshot={previewDeep("cancelled")}
        url={previewUrl}
        onClose={() => {}}
      />,
    );
    expect(cancelled).toContain('class="deep-running-cancelled"');
    expect(cancelled).toContain("분석이 취소되었습니다.");
    expect(cancelled).toContain("요청한 심층 분석이 중단되었습니다.");
    expect(cancelled).toContain(">닫기</button>");
    expect(cancelled).not.toContain('class="deep-columns"');
  });
  it("changes the page title on completion and retains the partial-report label on failure", () => {
    vi.stubGlobal("window", { location: { origin: "https://example.com" } });
    for (const phase of [
      "collect",
      "work",
      "completed",
      "finalizing",
      "cancelled",
      "failed",
    ] as const) {
      const html = renderToStaticMarkup(
        <DeepResultView snapshot={previewDeep(phase)} url={previewUrl} />,
      );
      expect(html).not.toContain("VirusTotal");
      expect(html.includes("심층 분석 결과")).toBe(phase === "completed");
      if (phase === "failed")
        expect(html).toContain("심층 분석을 완료하지 못했습니다");
      if (phase === "cancelled") {
        expect(html).toContain("분석이 취소되었습니다.");
        expect(html).not.toContain("심층 분석을 완료하지 못했습니다");
      }
    }
    const partial = renderToStaticMarkup(
      <DeepResultView
        snapshot={{
          ...previewDeep("failed"),
          result: previewDeep("completed").result,
        }}
        url={previewUrl}
      />,
    );
    expect(partial).toContain("현재까지 확인한 내용");
    expect(partial).not.toContain("심층 분석 결과");
  });
  it("finds the initial capture by actual L4 metadata even if a later capture is first in the response", () => {
    const snapshot = previewDeep("completed");
    const initial = snapshot.files[0];
    snapshot.files = [
      {
        ...initial,
        file_ref: "later",
        source_metadata: { action_id: "ACT7", context: { scenario_id: "T3" } },
      },
      initial,
    ];
    expect(captureFor(snapshot)?.file_ref).toBe(initial.file_ref);
  });
  it("distinguishes tasks ended before starting from a started task ended by the manager", () => {
    const task = {
      id: "T1",
      work_id: "W1",
      status: "ended_by_manager",
      started_at: null,
    };
    expect(taskPresentation(task, "completed")).toEqual({
      state: "stopped",
      label: "미수행",
    });
    expect(
      taskPresentation(
        { ...task, started_at: "2026-10-06T09:00:00Z" },
        "completed",
      ),
    ).toEqual({ state: "stopped", label: "종료" });
    expect(
      taskPresentation({ ...task, status: "failed" }, "failed").label,
    ).toBe("확인 실패");
    expect(
      taskPresentation({ ...task, status: "returned" }, "completed").label,
    ).toBe("완료");
    expect(
      taskPresentation({ ...task, status: "running" }, "cancelled"),
    ).toEqual({ state: "stopped", label: "종료" });
  });
  it("does not mark a work complete just because its tasks returned", () => {
    const snapshot = previewDeep("work");
    const work = { ...snapshot.works[0], status: "open", answer: undefined };
    snapshot.managers = [];
    expect(workState(work, snapshot)).toEqual({
      state: "running",
      label: "결과 검토 대기",
    });
    expect(workState({ ...work, status: "answered" }, snapshot)).toEqual({
      state: "done",
      label: "확인 완료",
    });
  });
  it("ends unanswered work without manufacturing a successful answer", () => {
    const snapshot = previewDeep("failed");
    const unanswered = {
      ...snapshot.works[1],
      status: "open",
      answer: undefined,
    };
    expect(workState(unanswered, snapshot)).toEqual({
      state: "stopped",
      label: "조사 종료",
    });
    expect(workState(snapshot.works[0], snapshot)).toEqual({
      state: "done",
      label: "확인 완료",
    });
  });
  it("includes the planning stage and leaves finalization distinct from completion", () => {
    expect(
      ["collect", "plan", "work", "finalizing", "completed"].map((phase) =>
        deepPhase(previewDeep(phase as Parameters<typeof previewDeep>[0])),
      ),
    ).toEqual([0, 1, 2, 3, 4]);
  });
  it("selects a published manager summary associated with the work", () => {
    const snapshot = previewDeep("completed");
    expect(managerForWork(snapshot.works[0], snapshot)).toBe(
      snapshot.managers[1].summary,
    );
    snapshot.managers[1].review_work_ids = ["W2"];
    snapshot.managers[1].decision_summary = { answered_work_ids: ["W2"] };
    expect(managerForWork(snapshot.works[0], snapshot)).toBeNull();
  });
  it("shows the agent report summary rather than a tool result or raw action dump", () => {
    const snapshot = previewDeep("completed");
    expect(taskReport(snapshot.tasks[0], snapshot)?.summary).toContain(
      "이메일 주소와 비밀번호",
    );
    snapshot.results![0].kind = "tool_result";
    expect(taskReport(snapshot.tasks[0], snapshot)).toBeNull();
  });
  it("does not invent a categorical risk label for the free-text final report", () => {
    vi.stubGlobal("window", { location: { origin: "https://example.com" } });
    const snapshot = previewDeep("completed");
    snapshot.result = {
      summary: "확인 가능한 범위의 조사 결과입니다.",
      findings: [],
      limits: [],
    };
    const html = renderToStaticMarkup(
      <DeepResultView snapshot={snapshot} url={previewUrl} />,
    );
    expect(html).toContain(snapshot.result.summary);
    expect(html).not.toContain("verdict-title");
    expect(html).not.toContain("해당 기록 보기");
    expect(html).not.toContain("export_page");
  });
  it("does not imply ongoing work when a run ends without additional work or leaves a stale running manager", () => {
    const snapshot = previewDeep("completed");
    snapshot.works = [];
    snapshot.tasks = [];
    snapshot.files = [];
    snapshot.managers = [];
    const html = renderToStaticMarkup(
      <DeepResultView snapshot={snapshot} url={previewUrl} />,
    );
    expect(html).toContain(snapshot.result!.summary);
    expect(html).toContain("추가 업무 없음");
    expect(html).toContain("추가로 수행한 확인 업무가 없습니다.");
    expect(html).toContain("총괄 판단 요약이 없습니다.");
    expect(html).not.toContain("확인할 업무를 구성하고 있습니다");
    expect(html).not.toContain("확인할 업무를 정리하고 있습니다");
    snapshot.status = "failed";
    snapshot.managers = [
      { id: "M1", status: "running", summary: "확인된 자료를 검토했습니다." },
    ];
    const stopped = renderToStaticMarkup(
      <DeepResultView snapshot={snapshot} url={previewUrl} />,
    );
    expect(stopped).toContain("확인된 자료를 검토했습니다.");
    expect(stopped).not.toContain("추가 검토 중");
  });
  it("accepts signed HTTPS image URLs and local preview images while rejecting executable or remote HTTP URLs", () => {
    vi.stubGlobal("window", { location: { origin: "http://127.0.0.1:5190" } });
    const file = previewDeep("plan").files[0];
    expect(imageUrl(file)).toMatch(
      /^http:\/\/127\.0\.0\.1:5190\/.+preview-capture.*\.jpg$/,
    );
    expect(
      imageUrl({
        ...file,
        url: "https://example.com/capture.png?signature=test",
      }),
    ).toContain("signature=test");
    expect(imageUrl({ ...file, url: "javascript:alert(1)" })).toBeNull();
    expect(
      imageUrl({ ...file, url: "http://other.example/capture.png" }),
    ).toBeNull();
  });
});

describe("asynchronous request ownership", () => {
  it("aborts all old streams when another analysis starts and never accepts the stale task again", () => {
    const service = new ServiceClient(
      "/api",
      {} as ConstructorParameters<typeof ServiceClient>[1],
    );
    const first = service.begin(),
      second = service.begin();
    expect(first.signal.aborted).toBe(true);
    expect(service.current(first)).toBe(false);
    expect(service.current(second)).toBe(true);
    service.stop();
    expect(second.signal.aborted).toBe(true);
    expect(service.current(second)).toBe(false);
  });

  function streamed(type: string, values: unknown[]) {
    const bytes = new TextEncoder().encode(
      values
        .map((value) => `event: ${type}\ndata: ${JSON.stringify(value)}\n\n`)
        .join(""),
    );
    // Small chunks deliberately split Korean text, JSON and SSE frame boundaries.
    let offset = 0;
    return new Response(
      new ReadableStream({
        pull(controller) {
          if (offset >= bytes.length) {
            controller.close();
            return;
          }
          controller.enqueue(bytes.slice(offset, offset + 13));
          offset += 13;
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    );
  }
  function clientWithStream(type: string, values: unknown[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamed(type, values)),
    );
    return new ServiceClient("/api", {
      accessToken: async () => "test-access",
    } as ConstructorParameters<typeof ServiceClient>[1]);
  }
  it("receives collecting, judging and accepted updates through the actual SSE client", async () => {
    const pending = {
      ...previewFast,
      judgment: null,
      judgment_status: "pending" as const,
    };
    const service = clientWithStream("fast", [
      { ...pending, context_revision: null },
      pending,
      previewFast,
    ]);
    const phases: string[] = [];
    await service.streamFast(previewFast.job_id, 1, service.begin(), (value) =>
      phases.push(fastPhase(value)),
    );
    expect(phases).toEqual(["collect", "judge", "done"]);
  });
  it("locks the first attempt when reopening a result so later stale stream frames cannot replace it", async () => {
    const current = {
      ...previewFast,
      attempt: 2,
      judgment: null,
      judgment_status: "pending" as const,
    };
    const service = clientWithStream("fast", [
      current,
      previewFast,
      { ...previewFast, attempt: 2 },
    ]);
    const attempts: number[] = [];
    await service.streamFast(
      previewFast.job_id,
      undefined,
      service.begin(),
      (value) => attempts.push(value.attempt),
    );
    expect(attempts).toEqual([2, 2]);
  });
  it("receives a published final before store completion without substituting another run", async () => {
    const service = clientWithStream("deep", [
      previewDeep("work"),
      previewDeep("finalizing"),
      previewDeep("completed"),
    ]);
    const statuses: string[] = [];
    await service.streamDeep(
      {
        run_id: "design-preview",
        events_url: "/api/deep/design-preview/events",
      },
      service.begin(),
      (value) => statuses.push(value.status),
    );
    expect(statuses).toEqual(["running", "finalizing", "completed"]);
    const wrong = clientWithStream("deep", [
      { ...previewDeep("completed"), run_id: "other-run" },
    ]);
    await expect(
      wrong.streamDeep(
        {
          run_id: "design-preview",
          events_url: "/api/deep/design-preview/events",
        },
        wrong.begin(),
        () => {},
      ),
    ).rejects.toThrow();
  });
  it("finishes the deep stream when the server publishes cancellation", async () => {
    const service = clientWithStream("deep", [
      previewDeep("work"),
      previewDeep("cancelled"),
    ]);
    const statuses: string[] = [];
    await service.streamDeep(
      {
        run_id: "design-preview",
        events_url: "/api/deep/design-preview/events",
      },
      service.begin(),
      (value) => statuses.push(value.status),
    );
    expect(statuses).toEqual(["running", "cancelled"]);
  });
});
