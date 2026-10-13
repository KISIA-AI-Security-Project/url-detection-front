import { expect, test, type Page } from "@playwright/test";
import { previewFast, previewUrl } from "../src/service/preview-fixtures";

const origin = "http://127.0.0.1:5173";
const scanId = "d".repeat(32);
const catalog = {
  default_model_choice: "claude-sonnet",
  models: [
    {
      id: "claude-sonnet",
      label: "Claude Sonnet 5.5",
      efforts: ["low", "medium", "high"],
      default_effort: "high",
    },
    {
      id: "claude-opus",
      label: "Claude Opus 5.5",
      efforts: ["medium", "high"],
      default_effort: "medium",
    },
  ],
};

async function prepare(page: Page) {
  const posts: Record<string, unknown>[] = [];
  const deepPosts: Record<string, unknown>[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (data: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.pathname === "/config.json")
      return json({
        api_base: "/api",
        auth: {
          domain: origin,
          client_id: "popup-test",
          redirect_uri: origin,
          scope: "openid",
        },
      });
    if (["/api/auth/callback", "/api/auth/session"].includes(url.pathname))
      return json({
        authenticated: true,
        session_ref: "A".repeat(43),
        access_token: "popup-test-token",
        expires_at: Date.now() + 3_600_000,
      });
    if (url.pathname === "/api/analysis-models") return json(catalog);
    if (url.pathname === "/api/analyses" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      posts.push(body);
      return json({
        scanId,
        pollUrl: `/api/analyses/${scanId}`,
        model_choice: body.model_choice,
        reasoning_effort: body.reasoning_effort,
      });
    }
    if (url.pathname === `/api/analyses/${scanId}/events`)
      return route.fulfill({
        contentType: "text/event-stream",
        body: `event: fast\ndata: ${JSON.stringify({ ...previewFast, job_id: scanId })}\n\n`,
      });
    if (
      url.pathname === `/api/analyses/${scanId}/deep` &&
      request.method() === "POST"
    ) {
      deepPosts.push(request.postDataJSON() as Record<string, unknown>);
      return json({
        run_id: "popup-deep-run",
        events_url: "/api/deep/popup-deep-run/events",
      });
    }
    return route.continue();
  });
  await page.goto("/popup.html?code=popup-test&state=popup-test");
  return { posts, deepPosts };
}

test.use({ viewport: { width: 340, height: 540 } });

test("fixes Opus 5.5 High and replaces the completed input with the analyzed link", async ({
  page,
}) => {
  const { posts, deepPosts } = await prepare(page);
  await expect(
    page.getByRole("button", { name: "모델 및 추론 설정" }),
  ).toHaveCount(0);
  const submittedUrl = `example.com/${"account-check/".repeat(5)}login`;
  const normalizedUrl = `https://${submittedUrl}`;
  await page.getByLabel("분석할 URL").fill(submittedUrl);
  const inputBox = await page.locator(".popup-url-control").boundingBox();
  const inputStyle = await page.getByLabel("분석할 URL").evaluate((node) => ({
    overflow: getComputedStyle(node).overflow,
    textOverflow: getComputedStyle(node).textOverflow,
    whiteSpace: getComputedStyle(node).whiteSpace,
  }));
  const inputSurface = await page
    .locator(".popup-url-control")
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(["hidden", "clip"]).toContain(inputStyle.overflow);
  expect(inputStyle.textOverflow).toBe("ellipsis");
  expect(inputStyle.whiteSpace).toBe("nowrap");
  const buttonBox = await page.locator(".popup-submit").boundingBox();
  expect(buttonBox?.width).toBe(inputBox?.width);
  expect(buttonBox?.height).toBe(inputBox?.height);
  expect(buttonBox?.height).toBe(38);
  expect(buttonBox?.y).toBeGreaterThan(inputBox?.y ?? 0);
  await page.getByRole("button", { name: "분석 시작" }).click();

  await expect(page.getByRole("heading", { name: "위험" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "위험" })).toHaveCSS(
    "font-size",
    "32px",
  );
  await expect(page.getByLabel("분석할 URL")).toHaveCount(0);
  await expect(page.getByText("분석 링크", { exact: true })).toBeVisible();
  await expect(page.locator(".popup-summary")).toHaveText(
    previewFast.judgment?.summary ?? "",
  );
  await expect(page.locator(".popup-target code")).toHaveText(normalizedUrl);
  await expect(page.getByText("판정 근거", { exact: true })).toHaveCount(0);
  const resultBoxStyle = await page
    .locator(".popup-result")
    .evaluate((node) => ({
      backgroundColor: getComputedStyle(node).backgroundColor,
      borderStyle: getComputedStyle(node).borderStyle,
    }));
  expect(resultBoxStyle.backgroundColor).toBe(inputSurface);
  expect(resultBoxStyle.borderStyle).toBe("solid");
  const targetWrap = await page
    .locator(".popup-target code")
    .evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      height: node.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(node).lineHeight),
      whiteSpace: getComputedStyle(node).whiteSpace,
    }));
  expect(targetWrap.scrollWidth).toBeLessThanOrEqual(targetWrap.clientWidth);
  expect(targetWrap.height).toBeGreaterThan(targetWrap.lineHeight);
  expect(targetWrap.whiteSpace).toBe("normal");
  const detailButton = page.getByRole("button", {
    name: "판정 원인 보기",
  });
  const deepButton = page.getByRole("button", { name: "심층분석 진행" });
  await expect(detailButton).toBeVisible();
  await expect(deepButton).toBeVisible();
  const detailBox = await detailButton.boundingBox();
  const deepBox = await deepButton.boundingBox();
  const resetBox = await page
    .getByRole("button", { name: "다른 링크 분석" })
    .boundingBox();
  expect(detailBox?.width).toBe(deepBox?.width);
  expect(detailBox?.height).toBe(deepBox?.height);
  expect(detailBox?.height).toBe(buttonBox?.height);
  expect(resetBox?.height).toBe(detailBox?.height);
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({
    url: normalizedUrl,
    model_choice: "claude-opus",
    reasoning_effort: "high",
  });

  const deepPagePromise = page.waitForEvent("popup");
  await deepButton.click();
  const deepPage = await deepPagePromise;
  await expect(deepPage).toHaveURL(
    new RegExp(`/analysis/${scanId}\\?deep=popup-deep-run$`),
  );
  expect(deepPosts).toHaveLength(1);
  expect(deepPosts[0]).toMatchObject({
    job_id: scanId,
    attempt: previewFast.attempt,
    context_revision: previewFast.context_revision,
    result_revision: previewFast.result_revision,
    model_choice: "claude-opus",
    reasoning_effort: "high",
  });
});

test("shows local popup states without authentication or API setup", async ({
  page,
}) => {
  await page.goto("/popup.html?preview=signed-out");
  await expect(
    page.getByRole("heading", { name: "로그인이 필요합니다." }),
  ).toBeVisible();

  await page.goto("/popup.html?preview=scanning");
  await expect(page.getByText("스캔 중...", { exact: true })).toBeVisible();
  const scanningStyle = await page
    .locator(".popup-scanning")
    .evaluate((node) => ({
      borderTopWidth: getComputedStyle(node).borderTopWidth,
      spinnerAnimation: getComputedStyle(node.querySelector(".spinner")!)
        .animationName,
    }));
  expect(scanningStyle.borderTopWidth).toBe("0px");
  expect(scanningStyle.spinnerAnimation).toContain("spin");

  await page.goto("/popup.html?preview=result");
  await expect(page.getByRole("heading", { name: "위험" })).toBeVisible();
  await expect(page.locator(".popup-summary")).toHaveText(
    previewFast.judgment?.summary ?? "",
  );
  await expect(page.getByLabel("분석할 URL")).toHaveCount(0);
  await expect(page.locator(".popup-target code")).toHaveText(previewUrl);
  await expect(page.getByText("판정 근거", { exact: true })).toHaveCount(0);
  const detailPagePromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "판정 원인 보기" }).click();
  const detailPage = await detailPagePromise;
  await expect(detailPage).toHaveURL(/\/design-preview\?screen=fast$/);

  const deepPagePromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "심층분석 진행" }).click();
  const deepPage = await deepPagePromise;
  await expect(deepPage).toHaveURL(/\/design-preview\?screen=deep-progress$/);
});

test("directs the signed-out preview to the real login view", async ({
  page,
}) => {
  await page.route("**/config.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        api_base: "/api",
        auth: {
          domain: origin,
          client_id: "popup-test",
          redirect_uri: `${origin}/`,
          scope: "openid",
        },
      }),
    }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthorized" }),
    }),
  );

  await page.goto("/popup.html?preview=signed-out");
  await page.getByRole("button", { name: "메인 페이지에서 로그인" }).click();
  await expect(page.getByRole("heading", { name: "로그인" })).toBeAttached();
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeVisible();
});
