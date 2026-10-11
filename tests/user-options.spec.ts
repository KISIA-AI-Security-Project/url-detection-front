import { test, expect } from "@playwright/test";
import { previewFast, previewDeep } from "../src/service/preview-fixtures";

test("actual service page: registered model, optional deep request, retry and separate request runs", async ({
  page,
}) => {
  const base = "http://127.0.0.1:5194";
  const posts: Record<string, unknown>[] = [];
  const deepPosts: Record<string, unknown>[] = [];
  const remoteRequests: string[] = [];
  const scan = "a".repeat(32);
  let catalogs = 0;
  let releaseModels!: () => void;
  const modelsGate = new Promise<void>((resolve) => {
    releaseModels = resolve;
  });
  let releaseDeep!: () => void;
  const deepGate = new Promise<void>((resolve) => {
    releaseDeep = resolve;
  });
  const runs = new Map<string, string>();
  const questions = new Map<string, string>();
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      remoteRequests.push(request.url());
      return route.abort();
    }
    const json = (value: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    if (url.pathname === "/config.json")
      return json({
        api_base: base + "/api",
        auth: {
          domain: base,
          client_id: "test-client",
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
    if (url.pathname.startsWith("/api/")) {
      expect(request.headers().authorization).toBe("Bearer local-test-only");
      if (url.pathname === "/api/analysis-models") {
        catalogs += 1;
        if (catalogs === 1) {
          await modelsGate;
          return json(
            { message: "모델 목록 조회 실패", error: "test_failure" },
            503,
          );
        }
        return json({
          default_model_choice: "claude-first",
          models: [
            {
              id: "claude-first",
              label: "Claude 기본 모델",
              efforts: ["low", "medium", "high"],
              default_effort: "medium",
            },
            {
              id: "claude-second",
              label: "Claude 추가 모델",
              efforts: ["low", "high", "xhigh", "max"],
              default_effort: "high",
            },
            {
              id: "claude-plain",
              label: "Claude effort 미지원 예시",
              efforts: [],
              default_effort: null,
            },
          ],
        });
      }
      if (url.pathname === "/api/analyses" && request.method() === "GET")
        return json({ analyses: [] });
      if (url.pathname === "/api/analyses" && request.method() === "POST") {
        posts.push(request.postDataJSON());
        return json({
          scanId: scan,
          pollUrl: `/api/analyses/${scan}`,
          model_choice: posts.at(-1)!.model_choice,
          reasoning_effort: posts.at(-1)!.reasoning_effort,
        });
      }
      if (url.pathname === `/api/analyses/${scan}/events`)
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: fast\ndata: ${JSON.stringify({ ...previewFast, job_id: scan })}\n\n`,
        });
      if (url.pathname === `/api/analyses/${scan}/deep`) {
        const data = request.postDataJSON();
        deepPosts.push(data);
        if (deepPosts.length === 1) await deepGate;
        const text = data.request_text || "";
        if (!runs.has(text)) runs.set(text, `question-${runs.size + 1}`);
        const run = runs.get(text)!;
        questions.set(run, text);
        return json({ run_id: run, events_url: `/api/deep/${run}/events` });
      }
      const deepMatch = url.pathname.match(
        /^\/api\/deep\/(question-\d+)\/events$/,
      );
      if (deepMatch) {
        const run = deepMatch[1];
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: deep\ndata: ${JSON.stringify({ ...previewDeep("completed"), scan_id: scan, run_id: run, input: { job_id: scan, attempt: previewFast.attempt, context_revision: previewFast.context_revision, result_revision: previewFast.result_revision, request_text: questions.get(run) }, result: { summary: `로컬 확인 요청: ${questions.get(run) || "기본 심층 분석"}`, findings: [], limits: [] } })}\n\n`,
        });
      }
      throw new Error(
        `Unexpected test API ${request.method()} ${url.pathname}`,
      );
    }
    return route.continue();
  });
  await page.goto("/?code=test-code&state=test-state");
  await page
    .getByLabel("분석할 URL", { exact: true })
    .fill("https://example.test/login");
  const model = page.getByLabel("빠른 분석 모델", { exact: true });
  await expect(model).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("사용 가능한 모델");
  await expect(
    page.getByRole("button", { name: "분석 시작", exact: true }),
  ).toBeDisabled();
  releaseModels();
  await expect(page.getByRole("alert")).toContainText("모델 목록 조회 실패");
  await page.getByRole("button", { name: "모델 목록 다시 불러오기" }).click();
  await expect(model).toHaveValue("claude-first");
  const effort = page.getByLabel("추론 노력 (effort)", { exact: true });
  await expect(effort).toHaveValue("medium");
  await effort.selectOption("low");
  await model.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(model).toHaveValue("claude-second");
  await expect(effort).toHaveValue("low");
  await page.keyboard.press("Escape");
  await effort.selectOption("max");
  await model.selectOption("claude-first");
  await expect(effort).toHaveValue("medium");
  await model.selectOption("claude-plain");
  await expect(effort).toBeDisabled();
  await expect(
    page.getByText("이 모델은 effort 설정을 지원하지 않습니다."),
  ).toBeVisible();
  await model.selectOption("claude-second");
  await expect(effort).toHaveValue("high");
  await effort.selectOption("xhigh");
  await page.setViewportSize({ width: 1024, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: "test-results/options-model-entry.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "분석 시작", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "빠른 분석 결과", exact: true }),
  ).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({
    url: "https://example.test/login",
    virustotal: false,
    model_choice: "claude-second",
    reasoning_effort: "xhigh",
  });
  await expect(model).toHaveCount(0);
  await expect(effort).toHaveCount(0);
  const field = page.getByRole("textbox", {
    name: "구체적으로 확인하고 싶은 내용이 있나요? (선택)",
  });
  const deepButton = page.getByRole("button", {
    name: "심층분석 요청",
    exact: true,
  });
  await expect(deepButton).toBeEnabled();
  await field.fill("가".repeat(2001));
  await expect(deepButton).toBeDisabled();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await field.fill("😀".repeat(2000));
  await expect(deepButton).toBeEnabled();
  await expect(page.locator("#deep-request-count")).toHaveText(
    "2,000 / 2,000자",
  );
  await field.fill("  로그인 정보가 어디로 전송되는지 확인해 주세요.  ");
  await page.setViewportSize({ width: 1024, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: "test-results/options-deep-request.png",
    fullPage: true,
  });
  await deepButton.click();
  await expect(field).toBeDisabled();
  releaseDeep();
  await expect(
    page.getByText(
      "로컬 확인 요청: 로그인 정보가 어디로 전송되는지 확인해 주세요.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(deepPosts[0]).toEqual({
    job_id: scan,
    attempt: previewFast.attempt,
    context_revision: previewFast.context_revision,
    result_revision: previewFast.result_revision,
    request_text: "로그인 정보가 어디로 전송되는지 확인해 주세요.",
  });
  await page
    .getByRole("button", { name: "빠른 분석 결과", exact: true })
    .click();
  await field.fill("자동으로 다른 사이트로 이동하는지 확인해 주세요.");
  await deepButton.click();
  await expect(
    page.getByText(
      "로컬 확인 요청: 자동으로 다른 사이트로 이동하는지 확인해 주세요.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(deepPosts).toHaveLength(2);
  expect(new URL(page.url()).searchParams.get("deep")).toBe("question-2");
  await page
    .getByRole("button", { name: "빠른 분석 결과", exact: true })
    .click();
  await deepButton.click();
  await expect(
    page.getByRole("heading", { name: "심층 분석 결과", exact: true }),
  ).toBeVisible();
  expect(deepPosts).toHaveLength(3);
  expect(new URL(page.url()).searchParams.get("deep")).toBe("question-2");
  await page.goto("/?code=test-code&state=test-state");
  await expect(
    page.getByRole("heading", { name: "심층 분석 결과", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "빠른 분석 결과", exact: true })
    .click();
  await expect(field).toHaveValue(
    "자동으로 다른 사이트로 이동하는지 확인해 주세요.",
  );
  await field.fill(" \n\t ");
  await deepButton.click();
  await expect(
    page.getByText("로컬 확인 요청: 기본 심층 분석", { exact: true }),
  ).toBeVisible();
  expect(deepPosts[3]).not.toHaveProperty("request_text");
  expect(remoteRequests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

for (const editedText of ["이번에는 로그인 정보 전송을 확인해 주세요.", ""]) {
  test(`a late restored Deep snapshot cannot overwrite a ${editedText ? "newly edited" : "cleared"} question`, async ({
    page,
  }) => {
    const base = "http://127.0.0.1:5194";
    const scan = "b".repeat(32);
    const oldText = "이전 실행에서 확인한 질문";
    const newText = editedText;
    const posts: Record<string, unknown>[] = [];
    let releaseDeep!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseDeep = resolve;
    });
    await page.addInitScript(
      ({ scan }) => {
        sessionStorage.setItem("web.activeScan", scan);
        sessionStorage.setItem("web.activeDeep", "old-run");
        sessionStorage.setItem("web.activeUrl", "https://example.test/login");
      },
      { scan },
    );
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== base)
        throw new Error(`Unexpected remote request ${url.origin}`);
      const json = (value: unknown) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(value),
        });
      if (url.pathname === "/config.json")
        return json({
          api_base: base + "/api",
          auth: {
            domain: base,
            client_id: "test-client",
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
      if (url.pathname === "/api/analysis-models")
        return json({
          default_model_choice: "claude-test",
          models: [
            {
              id: "claude-test",
              label: "Claude 테스트",
              efforts: ["low", "high"],
              default_effort: "high",
            },
          ],
        });
      if (url.pathname === "/api/analyses")
        return json({
          analyses: [{ scanId: scan, url: "https://example.test/login" }],
        });
      if (url.pathname === `/api/analyses/${scan}/events`)
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: fast\ndata: ${JSON.stringify({ ...previewFast, job_id: scan })}\n\n`,
        });
      if (url.pathname === "/api/deep/old-run/events") {
        await gate;
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: deep\ndata: ${JSON.stringify({ ...previewDeep("completed"), run_id: "old-run", scan_id: scan, input: { job_id: scan, attempt: previewFast.attempt, context_revision: previewFast.context_revision, result_revision: previewFast.result_revision, request_text: oldText } })}\n\n`,
        });
      }
      if (url.pathname === `/api/analyses/${scan}/deep`) {
        posts.push(route.request().postDataJSON());
        return json({
          run_id: "new-run",
          events_url: "/api/deep/new-run/events",
        });
      }
      if (url.pathname === "/api/deep/new-run/events")
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: deep\ndata: ${JSON.stringify({ ...previewDeep("completed"), run_id: "new-run", scan_id: scan })}\n\n`,
        });
      if (url.pathname.startsWith("/api/"))
        throw new Error(`Unexpected test API ${url.pathname}`);
      return route.continue();
    });
    const oldRequest = page.waitForRequest((request) =>
      request.url().endsWith("/api/deep/old-run/events"),
    );
    await page.goto(
      `/?code=test-code&state=race-state&analysis=${scan}&deep=old-run`,
    );
    await oldRequest;
    const oldAborted = page.waitForEvent("requestfailed", (request) =>
      request.url().endsWith("/api/deep/old-run/events"),
    );
    await page
      .getByRole("button", { name: "빠른 분석 결과", exact: true })
      .click();
    const field = page.getByRole("textbox", {
      name: "구체적으로 확인하고 싶은 내용이 있나요? (선택)",
    });
    await field.fill("작성 중인 질문");
    await field.fill(newText);
    // Returning through history starts a new task and cancels the old Deep subscription.
    // A cancelled response must not be required to arrive; preserve both draft variants.
    releaseDeep();
    expect((await oldAborted).failure()?.errorText).toContain("ERR_ABORTED");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.screenshot({
      path: `test-results/restored-deep-${newText ? "edited" : "cleared"}.png`,
      fullPage: true,
    });
    await expect(field).toHaveValue(newText);
    await page
      .getByRole("button", { name: "심층분석 요청", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "심층 분석 결과", exact: true }),
    ).toBeVisible();
    expect(posts).toHaveLength(1);
    if (newText) expect(posts[0].request_text).toBe(newText);
    else expect(posts[0]).not.toHaveProperty("request_text");
  });
}
