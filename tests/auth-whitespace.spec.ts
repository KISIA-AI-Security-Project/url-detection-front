import { test, expect } from "@playwright/test";

test("signup blocks retained whitespace before any Cognito request", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:5194") {
      requests += 1;
      return route.abort();
    }
    if (url.pathname === "/config.json")
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          api_base: url.origin + "/api",
          auth: {
            domain: "https://local-test.auth.ap-northeast-2.amazoncognito.com",
            client_id: "local-client",
            redirect_uri: url.origin,
            scope: "openid",
          },
        }),
      });
    if (url.pathname === "/api/auth/session")
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ authenticated: false }),
      });
    if (
      url.pathname === "/api/auth/signup/start" ||
      url.pathname === "/api/auth/signup/confirm"
    ) {
      const body = route.request().postDataJSON();
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          intent_id: body.intent_id,
          status: url.pathname.endsWith("/start") ? "code_sent" : "verified",
          email: "test@example.test",
          expires_at: Date.now() + 600000,
          retry_after_seconds: 0,
        }),
      });
    }
    return route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill("test@example.test");
  await page.getByRole("button", { name: "인증하기", exact: true }).click();
  await page.getByLabel("이메일 인증 코드").fill("123456");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  const password = page.getByLabel("비밀번호", { exact: true });
  const repeat = page.getByLabel("비밀번호 확인", { exact: true });
  const submit = page.getByRole("button", { name: "회원가입 완료" });
  await expect(
    page.getByText("최대 256자이며, 공백을 넣을 수 없어요.", { exact: true }),
  ).toBeVisible();
  for (const value of [
    "Local !234",
    "Local\t!234",
    "Local\u00a0!234",
    "Local\u3000!234",
  ]) {
    await password.fill(value);
    await repeat.fill(value);
    await expect(password).toHaveValue(value);
    await expect(submit).toBeDisabled();
    await repeat.press("Enter");
    await expect(submit).toBeDisabled();
  }
  // Native password controls strip CR/LF. Confirm the actual displayed value;
  // raw embedded CR/LF rejection belongs to the auth helper unit test.
  await password.fill("\n\r");
  await repeat.fill("\n\r");
  await expect(password).toHaveValue("");
  await expect(submit).toBeDisabled();
  await password.fill("Local!234");
  await repeat.fill("Local!234");
  await expect(submit).toBeEnabled();
  expect(requests).toBe(0);
  await page.getByRole("heading", { name: "회원가입", exact: true }).click();
  await page.screenshot({
    path: "../../../evaluation/remediation-20261008/auth-ui-6/whitespace-regression/signup-policy.png",
    fullPage: true,
  });
});
