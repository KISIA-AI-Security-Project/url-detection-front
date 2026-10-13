import { test, expect, type Page } from "@playwright/test";
import { previewFast } from "../src/service/preview-fixtures";

const base = "http://127.0.0.1:5194";
const evidence =
  "../../../evaluation/remediation-20261008/auth-ui-6/screenshots/input-regression";
const efforts = ["low", "medium", "high", "xhigh", "max"];
const catalog = {
  default_model_choice: "claude-sonnet",
  models: [
    {
      id: "claude-haiku",
      label: "Claude Haiku 5.5",
      efforts,
      default_effort: "medium",
    },
    {
      id: "claude-opus",
      label: "Claude Opus 5.5",
      efforts,
      default_effort: "medium",
    },
    {
      id: "claude-sonnet",
      label: "Claude Sonnet 5.5",
      efforts,
      default_effort: "high",
    },
  ],
};

async function prepare(page: Page, unusual = false) {
  const posts: unknown[] = [];
  const remote: string[] = [];
  let reads = 0;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      remote.push(url.origin);
      return route.abort();
    }
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.pathname === "/config.json")
      return json({
        api_base: `${base}/api`,
        auth: {
          domain: base,
          client_id: "local-test",
          redirect_uri: base,
          scope: "openid",
        },
      });
    if (["/api/auth/callback", "/api/auth/session"].includes(url.pathname))
      return json({
        authenticated: true,
        session_ref: "A".repeat(43),
        access_token: "local-test-only",
        expires_at: Date.now() + 3600000,
      });
    if (url.pathname === "/api/analysis-models") {
      reads++;
      if (unusual && reads === 1)
        return json(
          {
            message:
              "사용 가능한 분석 모델 목록을 불러오지 못했습니다. 잠시 후 다시 불러오기를 눌러 주세요. temporary-catalog-unavailable-" +
              "x".repeat(100),
          },
          503,
        );
      if (unusual)
        return json({
          default_model_choice: "long",
          models: [
            {
              id: "long",
              label:
                "아주 긴 서버 제공 분석 모델 이름 " +
                "LongClaudeModel".repeat(12),
              efforts: [],
              default_effort: null,
            },
          ],
        });
      return json(catalog);
    }
    if (url.pathname === "/api/analyses" && request.method() === "GET")
      return json({ analyses: [] });
    if (url.pathname === "/api/analyses" && request.method() === "POST") {
      const data = request.postDataJSON();
      posts.push(data);
      return json({
        scanId: "d".repeat(32),
        pollUrl: `/api/analyses/${"d".repeat(32)}`,
        model_choice: data.model_choice,
        reasoning_effort: data.reasoning_effort,
      });
    }
    if (url.pathname.endsWith("/events"))
      return route.fulfill({
        contentType: "text/event-stream",
        body: `event: fast\ndata: ${JSON.stringify({ ...previewFast, job_id: "d".repeat(32) })}\n\n`,
      });
    if (url.pathname.startsWith("/api/"))
      throw new Error(`Unexpected local API ${url.pathname}`);
    return route.continue();
  });
  await page.goto("/?code=local-test-code&state=design-state");
  return { posts, remote };
}

async function visibleBounds(page: Page) {
  const measurements = await page
    .locator(
      "#entry-url, .entry-submit, .entry-model-trigger, .entry-vt-option, .entry-model-retry",
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const r = element.getBoundingClientRect();
        return {
          tag: element.id || element.className,
          x: r.x,
          right: r.right,
          width: r.width,
          height: r.height,
          viewport: innerWidth,
        };
      }),
    );
  for (const r of measurements) {
    expect(r.x, r.tag).toBeGreaterThanOrEqual(5);
    expect(r.right, r.tag).toBeLessThanOrEqual(r.viewport - 5);
    expect(r.width, r.tag).toBeGreaterThan(0);
    expect(r.height, r.tag).toBeGreaterThanOrEqual(44);
  }
  return measurements;
}

test("input hierarchy: real service mock, responsive controls, visible keyboard focus and unchanged POST", async ({
  page,
}, testInfo) => {
  const { posts, remote } = await prepare(page);
  const picker = page.getByRole("button", {
    name: "모델 및 추론 설정",
    exact: true,
  });
  const url = page.getByLabel("분석할 URL", { exact: true });
  await expect(url).toHaveAttribute(
    "placeholder",
    "분석하고 싶은 URL을 입력해 주세요 (예: https://example.com)",
  );
  await expect(picker).toContainText("Claude Sonnet 5.5");
  await expect(picker).toContainText("High");
  await expect(
    page.getByText("선택한 모델로 빠른 분석을 진행합니다."),
  ).toHaveCount(0);
  await url.fill("https://www.iana.org/domains/reserved");
  const inputBorderBeforeFocus = await page
    .locator(".entry-url-control")
    .evaluate((element) => getComputedStyle(element).borderColor);
  await url.focus();
  await expect
    .poll(() =>
      page
        .locator(".entry-url-control")
        .evaluate((element) => getComputedStyle(element).borderColor),
    )
    .toBe(inputBorderBeforeFocus);
  await page
    .getByRole("heading", { name: "이 링크, 열어도 괜찮을까요?" })
    .click();
  const bounds = [];
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    bounds.push({ width, controls: await visibleBounds(page) });
    if ([320, 390, 1440].includes(width))
      await page.screenshot({
        path: `${evidence}/entry-${width}.png`,
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await url.focus();
  for (const selector of [
    ".entry-vt-option input",
    ".entry-model-trigger",
    ".entry-submit",
  ]) {
    const locator = page.locator(selector);
    const unfocusedShadow = await locator.evaluate(
      (element) => getComputedStyle(element).boxShadow,
    );
    await page.keyboard.press("Tab");
    await expect(locator).toBeFocused();
    const focus = await locator.evaluate((element) => {
      const r = element.getBoundingClientRect();
      const header = document.querySelector("header")?.getBoundingClientRect();
      return {
        outline: getComputedStyle(element).outlineStyle,
        shadow: getComputedStyle(element).boxShadow,
        x: r.x,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        viewport: innerWidth,
        height: innerHeight,
        headerBottom: header?.bottom ?? 0,
      };
    });
    expect(focus.outline !== "none" || focus.shadow !== unfocusedShadow).toBe(
      true,
    );
    expect(focus.x).toBeGreaterThanOrEqual(5);
    expect(focus.right).toBeLessThanOrEqual(focus.viewport - 5);
    expect(focus.top).toBeGreaterThanOrEqual(focus.headerBottom);
    expect(focus.bottom).toBeLessThanOrEqual(focus.height);
    if (selector === ".entry-model-trigger")
      await page.screenshot({
        path: `${evidence}/entry-keyboard-model-390.png`,
        fullPage: true,
      });
  }
  const vt = page.getByRole("checkbox", {
    name: "VirusTotal 조회 결과 함께 보기",
  });
  await vt.focus();
  await page.keyboard.press("Space");
  await expect(vt).toBeChecked();
  await page.keyboard.press("Space");
  await picker.click();
  const pickerDialog = page.getByRole("dialog", {
    name: "모델 및 추론 설정",
  });
  await expect(pickerDialog.locator(".entry-model-option")).toHaveCount(15);
  const pickerLayout = await pickerDialog.evaluate((panel) => {
    const list = panel.querySelector(".entry-model-list");
    const style = getComputedStyle(panel);
    return {
      width: panel.getBoundingClientRect().width,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      listClientHeight: list?.clientHeight ?? 0,
      listScrollHeight: list?.scrollHeight ?? 0,
    };
  });
  expect(pickerLayout.width).toBeLessThanOrEqual(221);
  expect(pickerLayout.paddingLeft).toBe("0px");
  expect(pickerLayout.paddingRight).toBe("0px");
  expect(pickerLayout.listClientHeight).toBeLessThanOrEqual(200);
  expect(pickerLayout.listScrollHeight).toBeGreaterThan(
    pickerLayout.listClientHeight,
  );
  await pickerDialog
    .getByRole("button", { name: "Claude Opus 5.5 High", exact: true })
    .click();
  await expect(picker).toContainText("Claude Opus 5.5");
  await expect(picker).toContainText("High");
  await url.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "빠른 분석 결과", exact: true }),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({
    url: "https://www.iana.org/domains/reserved",
    model_choice: "claude-opus",
    reasoning_effort: "high",
    virustotal: false,
  });
  expect(remote).toEqual([]);
  await testInfo.attach("control-bounds", {
    body: JSON.stringify(bounds, null, 2),
    contentType: "application/json",
  });
});

test("long catalog errors and unsupported model stay visible at narrow widths", async ({
  page,
}) => {
  const { posts, remote } = await prepare(page, true);
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page.getByRole("alert")).toContainText("모델");
  await page
    .getByLabel("분석할 URL", { exact: true })
    .fill("https://example.test/");
  await expect(
    page.getByRole("button", { name: "분석 시작", exact: true }),
  ).toBeDisabled();
  await visibleBounds(page);
  await page.screenshot({
    path: `${evidence}/entry-catalog-error-320.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "모델 목록 다시 불러오기" }).click();
  const picker = page.getByRole("button", {
    name: "모델 및 추론 설정",
    exact: true,
  });
  await expect(picker).toContainText("LongClaudeModel");
  await expect(picker).not.toContainText("설정 없음");
  for (const width of [320, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await visibleBounds(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${evidence}/entry-long-model-390.png`,
    fullPage: true,
  });
  const missingDescriptions = await page
    .locator("[aria-describedby]")
    .evaluateAll((elements) =>
      elements.flatMap((element) =>
        (element.getAttribute("aria-describedby") || "")
          .split(/\s+/)
          .filter((id) => id && !document.getElementById(id)),
      ),
    );
  expect(missingDescriptions).toEqual([]);
  await page.getByRole("button", { name: "분석 시작", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "빠른 분석 결과", exact: true }),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0]).not.toHaveProperty("reasoning_effort");
  expect(remote).toEqual([]);
});
