import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const builderFixture = resolve(
  "../../../evaluation/remediation-20261008/purpose-and-user-options-1/builder-replay/roblox/fixed-response-public-result.json",
);
test("actual Builder candidate: direct reason fact preserves click, selector, document.write and static scope", async ({
  page,
}) => {
  test.skip(
    !existsSync(builderFixture),
    "Local same-input Builder evidence is required for this integration replay.",
  );
  const candidate = JSON.parse(readFileSync(builderFixture, "utf8"));
  const linkedIds = candidate.judgment.reasons.flatMap(
    (reason) => reason.related_fact_ids,
  );
  const fact = candidate.details.facts.find(
    (value) =>
      linkedIds.includes(value.fact_id) &&
      value.text.includes("document.write"),
  );
  expect(fact).toBeTruthy();
  expect(candidate.judgment?.verdict).toBe("UNKNOWN");
  const base = "http://127.0.0.1:5194";
  const remoteRequests = [];
  await page.addInitScript(
    ({ scan }) => {
      sessionStorage.setItem("web.activeScan", scan);
      sessionStorage.setItem(
        "web.activeUrl",
        "https://www.roblox.ly/users/2201766045/profile",
      );
    },
    { scan: candidate.job_id },
  );
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base) {
      remoteRequests.push(request.url());
      return route.abort();
    }
    const json = (value) =>
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
            label: "Claude 로컬 확인용",
            efforts: ["high"],
            default_effort: "high",
          },
        ],
      });
    if (url.pathname === "/api/analyses")
      return json({
        analyses: [
          {
            scanId: candidate.job_id,
            url: "https://www.roblox.ly/users/2201766045/profile",
          },
        ],
      });
    if (url.pathname === `/api/analyses/${candidate.job_id}/events`)
      return route.fulfill({
        contentType: "text/event-stream",
        body: `event: fast\ndata: ${JSON.stringify(candidate)}\n\n`,
      });
    if (url.pathname.startsWith("/api/"))
      throw new Error(`Unexpected replay API: ${url.pathname}`);
    return route.continue();
  });
  await page.goto("/?code=test-code&state=test-state");
  await expect(
    page.getByRole("heading", { name: "판단불가", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("오프라인 전달 검사 전용 고정 응답입니다.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "1번째 판정 이유 상세정보", exact: true })
    .click();
  await expect(page.locator(".service-fact")).toHaveCount(1);
  await expect(page.locator(".fact-description")).toHaveText(fact.plain.text);
  await expect(page.locator(".fact-description")).toContainText("click 이벤트");
  await expect(page.locator(".fact-description")).toContainText("선택자");
  await expect(page.locator(".fact-description")).toContainText(
    "document.write",
  );
  await expect(page.locator(".fact-description")).toContainText(
    "실행 결과가 아닌 정적 코드 분석",
  );
  await expect(page.locator(".fact-description")).toContainText(
    "문서 변경 성공을 확인한 결과는 아닙니다",
  );
  await expect(page.locator(".fact-technical")).toHaveCount(0);
  await page.getByRole("switch", { name: "기술정보 표시" }).check();
  await page.getByText("기술정보 보기", { exact: true }).click();
  expect(await page.locator(".fact-technical pre").textContent()).toBe(
    fact.text,
  );
  await page.setViewportSize({ width: 1024, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: "test-results/builder-direct-fact.png",
    fullPage: true,
  });
  expect(remoteRequests).toEqual([]);
});
