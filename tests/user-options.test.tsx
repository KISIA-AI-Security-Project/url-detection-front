import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ServiceClient,
  normalizeDeepRequest,
} from "../src/service/service-client.js";
import { ServiceEntry } from "../src/components/ServiceEntry";
import { FastResultView } from "../src/components/ServiceResults";
import { Header } from "../src/components/ui";
import { previewFast, previewUrl } from "../src/service/preview-fixtures";

afterEach(() => vi.unstubAllGlobals());
const catalog = {
  default_model_choice: "claude-default",
  models: [
    {
      id: "claude-default",
      label: "Claude 기본",
      efforts: ["low", "medium", "high"],
      default_effort: "medium",
    },
    {
      id: "claude-other",
      label: "Claude 다른 모델",
      efforts: ["low", "high", "max"],
      default_effort: "high",
    },
  ],
};
function client() {
  return new ServiceClient("/api", {
    accessToken: async () => "test-token",
  } as ConstructorParameters<typeof ServiceClient>[1]);
}
describe("server registered fast models", () => {
  it("loads the authenticated catalog and sends the selected model without replacing the URL or VT choice", async () => {
    const fetch = vi.fn(async (url: string) =>
      Response.json(
        url.endsWith("analysis-models")
          ? catalog
          : {
              scanId: "a".repeat(32),
              pollUrl: `/api/analyses/${"a".repeat(32)}`,
              model_choice: "claude-other",
              reasoning_effort: "max",
            },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const service = client();
    expect(await service.models()).toEqual(catalog);
    await service.start("https://example.test/a?b=c#d", true, service.begin(), {
      modelChoice: "claude-other",
      reasoningEffort: "max",
    });
    const calls = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toBe("/api/analysis-models");
    expect(calls[0][1].headers).toMatchObject({
      Authorization: "Bearer test-token",
    });
    expect(JSON.parse(calls[1][1].body as string)).toMatchObject({
      model_choice: "claude-other",
      reasoning_effort: "max",
      url: "https://example.test/a?b=c#d",
      virustotal: true,
    });
  });
  it.each([
    { default_model_choice: "missing", models: catalog.models },
    { default_model_choice: "claude-default", models: [] },
    { ...catalog, models: [catalog.models[0], catalog.models[0]] },
    { ...catalog, models: [{ ...catalog.models[0], efforts: ["low", "low"] }] },
    { ...catalog, models: [{ ...catalog.models[0], default_effort: "max" }] },
    {
      ...catalog,
      models: [{ ...catalog.models[0], efforts: [], default_effort: "low" }],
    },
    {
      ...catalog,
      models: [{ id: "claude-default", label: "Missing effort contract" }],
    },
  ])(
    "rejects an unusable model catalog instead of inventing a default",
    async (value) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json(value)),
      );
      await expect(client().models()).rejects.toThrow("모델 목록");
    },
  );
  it.each(["low", null, undefined])(
    "rejects changed or omitted effort acceptance: %s",
    async (reasoning_effort) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            scanId: "a".repeat(32),
            pollUrl: `/api/analyses/${"a".repeat(32)}`,
            model_choice: "claude-other",
            reasoning_effort,
          }),
        ),
      );
      const service = client();
      await expect(
        service.start(previewUrl, false, service.begin(), {
          modelChoice: "claude-other",
          reasoningEffort: "max",
        }),
      ).rejects.toThrow("선택한 추론 노력");
    },
  );
  it("omits effort for a model with no effort setting and accepts its optional metadata", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        scanId: "a".repeat(32),
        pollUrl: `/api/analyses/${"a".repeat(32)}`,
        model_choice: "claude-other",
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const service = client();
    await service.start(previewUrl, false, service.begin(), {
      modelChoice: "claude-other",
      reasoningEffort: null,
    });
    const calls = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(JSON.parse(calls[0][1].body as string)).not.toHaveProperty(
      "reasoning_effort",
    );
  });
  it("keeps legacy client requests compatible when no choice is supplied", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        scanId: "a".repeat(32),
        pollUrl: `/api/analyses/${"a".repeat(32)}`,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const service = client();
    await service.start(previewUrl, false, service.begin());
    const calls = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(JSON.parse(calls[0][1].body as string)).not.toHaveProperty(
      "model_choice",
    );
  });
  it.each(["different-model", undefined])(
    "rejects an acceptance that does not confirm the selected model: %s",
    async (model_choice) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            scanId: "a".repeat(32),
            pollUrl: `/api/analyses/${"a".repeat(32)}`,
            model_choice,
          }),
        ),
      );
      const service = client();
      await expect(
        service.start(previewUrl, false, service.begin(), {
          modelChoice: "claude-other",
        }),
      ).rejects.toThrow("선택한 모델");
    },
  );
});
describe("optional deep request", () => {
  it("links the default header brand to the main page", () => {
    const html = renderToStaticMarkup(<Header />);
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-label="LinkGuard 메인 화면으로"');
  });
  it("preserves all four identity fields and trims only the optional request boundary", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ run_id: "r1", events_url: "/api/deep/r1/events" }),
    );
    vi.stubGlobal("fetch", fetch);
    const service = client();
    const identity = {
      job_id: previewFast.job_id,
      attempt: 1,
      context_revision: "c1",
      result_revision: "r1",
    };
    await service.deep(
      {
        ...identity,
        request_text: "  로그인 흐름\n확인해 주세요.  ",
        model_choice: "claude-other",
        reasoning_effort: "max",
      },
      service.begin(),
    );
    await service.deep(
      { ...identity, request_text: " \n\t " },
      service.begin(),
    );
    const calls = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(JSON.parse(calls[0][1].body as string)).toEqual({
      ...identity,
      request_text: "로그인 흐름\n확인해 주세요.",
      model_choice: "claude-other",
      reasoning_effort: "max",
    });
    expect(JSON.parse(calls[1][1].body as string)).toEqual(identity);
  });
  it("uses Unicode codepoints, accepts exactly 2000 emoji and rejects overflow before POST", () => {
    expect(normalizeDeepRequest("😀".repeat(2000))).toHaveLength(4000);
    expect(() => normalizeDeepRequest("😀".repeat(2001))).toThrow("2,000자");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const service = client();
    expect(() =>
      service.deep(
        {
          job_id: previewFast.job_id,
          attempt: 1,
          context_revision: "c",
          result_revision: "r",
          request_text: "가".repeat(2001),
        },
        service.begin(),
      ),
    ).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("provides a labeled optional field and disables pending submission and invalid input", () => {
    const html = renderToStaticMarkup(
      <FastResultView
        result={previewFast}
        url={previewUrl}
        onDeep={() => {}}
        deepPending
        deepRequest={{ value: "확인 요청", onChange: () => {} }}
      />,
    );
    expect(html).toContain('aria-label="심층 분석 요청 사항"');
    expect(html).toContain(
      "확인하고 싶은 내용을 작성해주세요. (예: 로그인 정보가 어디로 전송되는지 확인해 주세요.)",
    );
    expect(html).toMatch(/<textarea[^>]+disabled=""/);
    expect(html).not.toContain("비워 두면 기본 심층 분석을 진행합니다.");
  });
});
describe("model selection entry states", () => {
  it("announces catalog failure, offers retry, and prevents starting with an unavailable choice", () => {
    const html = renderToStaticMarkup(
      <ServiceEntry
        ready
        authenticated
        input={previewUrl}
        onInput={() => {}}
        onSubmit={() => {}}
        vtSelected={false}
        onVtSelected={() => {}}
        analyses={[]}
        onOpenAnalysis={() => {}}
        onLogin={() => {}}
        modelSelection={{
          models: [],
          value: "",
          effort: null,
          loading: false,
          error: "목록 조회 실패",
          onChange: () => {},
          onEffortChange: () => {},
          onRetry: () => {},
        }}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("모델 목록 다시 불러오기");
    expect(html).toMatch(/<button[^>]+type="submit"[^>]+disabled=""/);
  });
});
