import { mapReport } from "../src/data/report";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeUrl } from "../src/lib/url";
import {
  analysisService,
  FAST_DURATION,
  DEEP_DURATION,
  demoJob,
} from "../src/lib/mock-service";
import { defaultLayer, rankEvidence, resultFor } from "../src/data/results";
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.useRealTimers();
});
describe("URL normalization", () => {
  it.each([
    ["example.com/path?a=b#verify", "https://example.com/path?a=b#verify"],
    [
      "HTTP://Example.COM/login?return=/account#verify",
      "http://example.com/login?return=/account#verify",
    ],
    [" https://example.com ", "https://example.com/"],
    ["example.com:8080/path", "https://example.com:8080/path"],
    ["localhost:5173", "https://localhost:5173/"],
    ["chrome://extensions", null],
    ["chrome-extension://id", null],
    ["file:///etc/passwd", null],
    ["about:blank", null],
    ["javascript:alert(1)", null],
    ["ftp://example.com", null],
    ["", null],
    ["not a url", null],
    ["https://", null],
    ["https://user:pass@example.com", null],
  ])("%s → %s", (input, expected) =>
    expect(normalizeUrl(input)).toBe(expected),
  );
});
describe("persistent mock jobs", () => {
  it("restores completed fast jobs after time passes without a mounted UI", () => {
    vi.useFakeTimers();
    const job = analysisService.startFast("https://example.com");
    vi.advanceTimersByTime(FAST_DURATION + 10);
    expect(analysisService.getFast()).toMatchObject({
      id: job.id,
      status: "completed",
    });
  });
  it("prevents a second concurrent fast analysis and preserves the target", () => {
    const first = analysisService.startFast("https://one.example");
    const second = analysisService.startFast("https://two.example");
    expect(second).toEqual(first);
  });
  it("keeps cancellation after the completion deadline and reuses the same deep job", () => {
    vi.useFakeTimers();
    const fast = analysisService.startFast("https://example.com");
    const deep = analysisService.startDeep(fast);
    analysisService.cancel(deep.id);
    vi.advanceTimersByTime(DEEP_DURATION + 1);
    expect(analysisService.getJob(deep.id)?.status).toBe("cancelled");
    expect(analysisService.startDeep(fast).id).toBe(deep.id);
  });
  it("does not change an already completed job into cancelled", () => {
    vi.useFakeTimers();
    const fast = analysisService.startFast("https://example.com");
    const deep = analysisService.startDeep(fast);
    vi.advanceTimersByTime(DEEP_DURATION + 1);
    expect(analysisService.cancel(deep.id)?.status).toBe("completed");
  });
  it("returns no result for missing/corrupt storage", () => {
    localStorage.setItem("linkguard.v1.corrupt", "{broken");
    expect(analysisService.getJob("corrupt")).toBeNull();
    expect(analysisService.getJob("missing")).toBeNull();
  });
});
describe("evidence presentation", () => {
  it("selects the highest count, with L4 > L3 > L2 on ties", () => {
    const evidence = resultFor(demoJob()).evidence;
    expect(defaultLayer(evidence)).toBe("L3");
    expect(
      defaultLayer(
        evidence.filter((e) =>
          ["redirect", "form-action", "cloaking"].includes(e.id),
        ),
      ),
    ).toBe("L4");
    expect(defaultLayer([])).toBe("L4");
  });
  it("ranks severity before confidence and caps the visible results", () => {
    const evidence = resultFor(demoJob()).evidence;
    expect(rankEvidence(evidence, 3).map((e) => e.id)).toEqual([
      "form-action",
      "cloaking",
      "brand",
    ]);
    expect(rankEvidence(evidence, 5)).toHaveLength(5);
  });
  it("retains results after partial collection or explanation failure", () => {
    expect(resultFor(demoJob("partial")).partial).toBe(true);
    expect(resultFor(demoJob("summary-fallback")).final).toBe("danger");
    expect(resultFor(demoJob("safe")).evidence).toHaveLength(0);
  });
});

// A missing or untrustworthy verdict must never acquire a safe appearance.
describe("guide report presentation", () => {
  it.each([
    ["MALICIOUS", "위험"],
    ["SUSPICIOUS", "주의"],
    ["LIKELY_BENIGN", "위험 징후 없음"],
    ["UNKNOWN", "판단 불가"],
    ["unexpected", "판단 불가"],
  ])("maps %s to %s", (verdict, label) => {
    expect(mapReport({ status: "COMPLETED", verdict }).label).toBe(label);
  });
  it("does not show blocked or stubbed benign results as safe", () => {
    const data = { status: "COMPLETED" as const, verdict: "LIKELY_BENIGN" };
    expect(mapReport({ ...data, route: "BLOCKED" }).tone).toBe("unknown");
    expect(mapReport({ ...data, stub: { any: true, layers: [] } }).tone).toBe(
      "unknown",
    );
    const result = mapReport({
      ...data,
      coverage: {
        layers_run: ["l2", "l3"],
        layers_skipped: ["l4"],
        layers_stubbed: ["l3"],
      },
    });
    expect(result.tone).toBe("unknown");
    expect(result.coverage).toEqual({
      checked: ["네트워크"],
      layerIds: ["L2"],
      skipped: ["클로킹·행동"],
      stubbed: ["콘텐츠"],
    });
    expect(result.notice).toContain("시험용 데이터");
  });
  it("keeps absent coverage distinct from a completed empty analysis", () => {
    const result = mapReport({ status: "COMPLETED", verdict: "UNKNOWN" });
    expect(result.coverage).toBeNull();
    expect(result.reasons).toEqual(["제공된 판단 사유가 없습니다."]);
    expect(result.limitations).not.toHaveLength(0);
  });
});

describe("report confidence", () => {
  it.each([undefined, -0.1, 1.2, NaN, Infinity])(
    "does not fabricate confidence from %s",
    (confidence) => {
      expect(
        mapReport({
          status: "COMPLETED",
          verdict: "MALICIOUS",
          judgment: { confidence },
        }).confidence,
      ).toBeNull();
    },
  );
  it("preserves provided percentages, including zero, but suppresses an unknown verdict's score", () => {
    for (const [confidence, label] of [
      [0, "0%"],
      [0.92, "92%"],
      [1, "100%"],
    ] as const) {
      expect(
        mapReport({
          status: "COMPLETED",
          verdict: "SUSPICIOUS",
          judgment: { confidence },
        }).confidence,
      ).toBe(label);
    }
    expect(
      mapReport({
        status: "COMPLETED",
        verdict: "UNKNOWN",
        judgment: { confidence: 0.92 },
      }).confidence,
    ).toBeNull();
  });
});
