import { test, expect } from "@playwright/test";
test("report: ranking, accordion navigation, raw values and clipboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByRole("heading", {
      name: "위험",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator('.accordion-trigger[aria-expanded="true"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('.accordion-trigger[aria-expanded="true"]'),
  ).toContainText("콘텐츠 분석");
  await expect(page.getByText("주요 판정 근거", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("권장 행동", { exact: true })).toHaveCount(0);
  await expect(page.locator(".report-facts")).toContainText("분석 완료");
  await expect(page.locator(".report-facts")).toContainText("소요 시간");
  await expect(page.locator(".report-facts")).toContainText(
    "심층 분석이 완료된 시각",
  );
  await expect(page.locator(".report-facts")).toContainText(
    "분석 시작부터 완료까지 걸린 시간",
  );
  await expect(page.locator(".report-card")).toHaveCSS(
    "border-color",
    "rgb(228, 228, 231)",
  );
  await expect(page.locator(".evidence-detail").first()).toHaveCSS(
    "border-color",
    "rgb(228, 228, 231)",
  );
  await expect(page.locator(".evidence-status.caution").first()).toHaveCSS(
    "background-color",
    "rgb(255, 251, 235)",
  );
  await expect(page.locator(".evidence-status.danger").first()).toHaveCSS(
    "background-color",
    "rgb(254, 242, 242)",
  );
  await expect(page.locator(".analysis-layer")).toHaveCount(3);
  await expect(page.locator(".section-title-icon")).toHaveCount(2);
  await expect(page.locator(".key-section")).toContainText(
    "최종 판정에 주요하게 반영된 신호입니다.",
  );
  await expect(page.locator(".report-card")).toHaveCSS(
    "animation-name",
    "detail-result-item-in",
  );
  await expect(page.locator(".verdict-emblem")).toHaveCSS(
    "animation-name",
    "detail-verdict-icon-in",
  );
  const contentLayer = page
    .locator(".accordion-trigger")
    .filter({ hasText: "콘텐츠 분석" });
  expect(
    await page
      .locator("#layer-L3")
      .evaluate((element) =>
        Number.parseFloat(
          getComputedStyle(element).transitionDuration.split(",")[0],
        ),
      ),
  ).toBeGreaterThanOrEqual(0.3);
  const nestedEvidence = page.locator(
    "#evidence-form-action .evidence-trigger",
  );
  await nestedEvidence.click();
  await expect(nestedEvidence).toHaveAttribute("aria-expanded", "true");
  await contentLayer.click();
  await expect(contentLayer).toHaveAttribute("aria-expanded", "false");
  await expect(nestedEvidence).toHaveAttribute("aria-expanded", "false");
  await contentLayer.click();
  await expect(contentLayer).toHaveAttribute("aria-expanded", "true");
  await expect(nestedEvidence).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('a[href^="https:"]')).toHaveCount(0);
  await page.screenshot({ path: "test-results/report-overview.png" });
  await page
    .getByRole("button", { name: /접속 환경에 따라 달라지는 콘텐츠/ })
    .click();
  await expect(page.locator("#evidence-cloaking")).toBeInViewport();
  await expect(page.locator("#evidence-cloaking")).toBeFocused();
  await expect(page.locator("#layer-L4")).toBeVisible();
  await expect(page.locator("#layer-L4")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await page
    .locator("#evidence-cloaking")
    .getByRole("button", { name: /접속 환경에 따라 달라지는 콘텐츠/ })
    .click();
  await expect(page.locator("#detail-cloaking")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(page.locator("#evidence-cloaking")).toContainText(
    "일반 브라우저와 자동 분석 환경에서 서로 다른 페이지가 표시되었습니다.",
  );
  await expect(
    page.getByText("Browser response", { exact: true }),
  ).toBeVisible();
  await page
    .locator("#evidence-cloaking")
    .getByRole("button", { name: "Browser response 복사" })
    .click();
  await expect(page.getByText("복사됨", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "로그인 정보 입력 화면",
  );
  await page.screenshot({
    path: "test-results/report-desktop.png",
    fullPage: true,
  });
});
test("popup: validation, progress survives reopen, deep analysis completes and restores", async ({
  page,
  context,
}) => {
  await page.goto("/popup.html?scenario=safe");
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator(".popup")
    .screenshot({ path: "test-results/popup-idle.png" });
  const input = page.getByLabel("분석할 URL");
  await expect(page.getByRole("button", { name: "분석 시작" })).toBeDisabled();
  await input.fill("chrome://extensions");
  await input.blur();
  await expect(page.getByRole("alert")).toBeVisible();
  await input.fill("example.com/path?a=b#verify");
  await page.getByRole("button", { name: "분석 시작" }).click();
  await expect(input).toHaveValue("https://example.com/path?a=b#verify");
  await expect(input).toBeDisabled();
  await page
    .locator(".popup")
    .screenshot({ path: "test-results/popup-progress.png" });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "안전", exact: true }),
  ).toBeVisible({ timeout: 7000 });
  await page.screenshot({
    path: "test-results/popup-result.png",
    fullPage: true,
  });
  const next = context.waitForEvent("page");
  await page.getByRole("button", { name: "심층 분석", exact: true }).click();
  const deep = await next;
  await expect(deep).toHaveURL(/\/analysis\/[a-f\d-]+$/);
  await expect(deep.getByRole("heading", { name: "스캔 중..." })).toBeVisible();
  await deep.reload();
  await expect(
    deep.getByRole("heading", {
      name: "위험 징후 없음",
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(deep.locator(".analysis-layer")).toHaveCount(3);
  await deep.reload();
  await expect(
    deep.getByRole("heading", {
      name: "위험 징후 없음",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "종료", exact: true }).click();
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue("");
});
test("deep cancellation is persistent and no rerun is offered", async ({
  page,
}) => {
  await page.goto("/preview");
  await page.getByRole("button", { name: "스캔 중 · 취소 가능" }).click();
  await page.getByRole("button", { name: "분석 취소" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "분석이 취소되었습니다." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /다시 분석|새 분석/ }),
  ).toHaveCount(0);
});
test("transport errors retry without discarding the job", async ({ page }) => {
  await page.goto("/preview");
  await page
    .getByRole("button", { name: "상태 조회 오류 · 다시 시도" })
    .click();
  await expect(
    page.getByRole("heading", { name: "연결을 다시 확인하는 중입니다..." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "상태를 불러오지 못했습니다." }),
  ).toBeVisible({ timeout: 8000 });
  const url = page.url();
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(
    page.getByRole("heading", {
      name: "위험",
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 });
  expect(page.url()).toBe(url);
});
test("mobile: no horizontal overflow and accordion is keyboard operable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile-overview.png" });
  const network = page
    .locator(".accordion-trigger")
    .filter({ hasText: "네트워크 분석" });
  await network.focus();
  await page.keyboard.press("Enter");
  await expect(network).toHaveAttribute("aria-expanded", "true");
  await page
    .locator("#evidence-certificate")
    .getByRole("button", { name: /인증서와 접속 도메인 불일치/ })
    .click();
  await page
    .locator("#raw-certificate")
    .getByRole("button", { name: "전체 보기" })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/report-mobile.png",
    fullPage: true,
  });
});

test("Chrome adapter: URL synchronization preserves manual input and active jobs", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let activeUrl = "https://initial.example/";
    let onUpdated:
      | ((
          id: number,
          change: { url?: string },
          tab: { active: boolean },
        ) => void)
      | undefined;
    const noOp = () => {};
    Object.defineProperty(window, "chrome", {
      configurable: true,
      value: {
        runtime: { id: "mock-extension" },
        tabs: {
          query: async () => [{ url: activeUrl, active: true }],
          onActivated: { addListener: noOp, removeListener: noOp },
          onUpdated: {
            addListener: (fn: typeof onUpdated) => {
              onUpdated = fn;
            },
            removeListener: noOp,
          },
        },
      },
    });
    window.addEventListener("mock-tab-update", (event) => {
      const detail = (event as CustomEvent<{ url?: string; active: boolean }>)
        .detail;
      if (detail.active && detail.url) activeUrl = detail.url;
      onUpdated?.(1, detail.url ? { url: detail.url } : {}, {
        active: detail.active,
      });
    });
  });
  await page.goto("/popup.html?scenario=fast-danger");
  const input = page.getByLabel("분석할 URL");
  await expect(input).toHaveValue("https://initial.example/");
  await input.fill("https://manual.example/");
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("mock-tab-update", { detail: { active: true } }),
    ),
  );
  await expect(input).toHaveValue("https://manual.example/");
  await page.getByRole("button", { name: "분석 시작" }).click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("mock-tab-update", {
        detail: { active: true, url: "https://next.example/" },
      }),
    ),
  );
  await expect(input).toHaveValue("https://manual.example/");
  await expect(
    page.getByRole("heading", { name: "위험", exact: true }),
  ).toBeVisible({ timeout: 7000 });
  await page.getByRole("button", { name: "종료", exact: true }).click();
  await expect(input).toHaveValue("https://next.example/");
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("mock-tab-update", {
        detail: { active: true, url: "chrome://extensions/" },
      }),
    ),
  );
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "분석 시작" })).toBeDisabled();
});

test("popup partial result keeps actions accessible and failure can retry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 340, height: 600 });
  await page.goto("/popup.html?scenario=partial");
  await page
    .getByLabel("분석할 URL")
    .fill("https://account-check.example/login");
  await page.getByRole("button", { name: "분석 시작" }).click();
  await expect(
    page.getByRole("heading", { name: "주의", exact: true }),
  ).toBeVisible({ timeout: 7000 });
  await expect(page.locator(".popup-partial")).toContainText(
    "일부 콘텐츠 분석을 완료하지 못했습니다.",
  );
  await expect(page.locator(".popup-evidence li")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "분석 시작" })).toBeDisabled();
  // Result blocks enter with a short animation; check their settled bounds.
  await expect
    .poll(async () => {
      const popupBox = await page.locator(".popup").boundingBox();
      const actionBox = await page.locator(".popup-actions").boundingBox();
      if (!popupBox || !actionBox) return Infinity;
      return actionBox.y + actionBox.height - popupBox.y - popupBox.height;
    })
    .toBeLessThanOrEqual(0);
  await page
    .locator(".popup")
    .screenshot({ path: "test-results/popup-partial.png" });
  await page.getByRole("button", { name: "종료", exact: true }).click();
  await page.goto("/popup.html?scenario=failed");
  await page.getByLabel("분석할 URL").fill("example.com");
  await page.getByRole("button", { name: "분석 시작" }).click();
  await expect(
    page.getByRole("heading", { name: "분석을 완료하지 못했습니다." }),
  ).toBeVisible({ timeout: 7000 });
  await page
    .locator(".popup")
    .screenshot({ path: "test-results/popup-failed.png" });
  await page.getByRole("button", { name: "다시 시도", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "스캔 중...", exact: true }),
  ).toBeVisible();
});

test("report guide: unknown, skipped layers and test data stay distinct", async ({
  page,
}) => {
  for (const [label, expected] of [
    [
      "판단 불가 · 가이드 응답 예시",
      "판정 서비스의 응답을 확인하지 못해 최종 판단에 제한이 있습니다.",
    ],
    ["시험용 데이터 · 판정 제한", "시험용 데이터가 포함된 결과입니다."],
    [
      "접근 제한 · 미실행 영역",
      "대상 사이트에 접근이 제한되어 분석 범위가 제한되었습니다.",
    ],
  ]) {
    await page.goto("/preview");
    await page.getByRole("button", { name: label, exact: true }).click();
    const card = page.locator(".report-card");
    await expect(
      card.getByRole("heading", {
        name: "판단 불가",
        exact: true,
      }),
    ).toBeVisible();
    await expect(card).toContainText(expected);
    await expect(card).not.toHaveClass(/report-tone-safe/);
    await expect(card.locator(".report-confidence")).toHaveText("산정 불가");
    await expect(card.locator(".key-section, .analysis-sections")).toHaveCount(
      0,
    );
    await expect(page.locator(".key-section")).toContainText(
      "제공된 핵심 근거가 없습니다.",
    );
    if (label.startsWith("시험용") || label.startsWith("접근")) {
      await expect(card).toContainText("미실행 영역");
    }
    await page.screenshot({
      path: `test-results/report-${label.startsWith("시험용") ? "stub" : label.startsWith("접근") ? "blocked" : "unknown"}.png`,
    });
  }
});
