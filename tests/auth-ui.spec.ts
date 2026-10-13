import { test, expect, type Page, type Route } from "@playwright/test";
import { previewFast, previewDeep } from "../src/service/preview-fixtures";
const base = "http://127.0.0.1:5194";
const evidence =
  "../../../evaluation/remediation-20261008/auth-ui-7/front/screenshots";
const domain = "https://local-test.auth.ap-northeast-2.amazoncognito.com";
const scan = "c".repeat(32);
const json = (route: Route, value: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(value),
  });
async function setup(
  page: Page,
  handler: (route: Route, url: URL) => Promise<unknown>,
  authenticated = false,
) {
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === "/config.json")
      return json(route, {
        api_base: base + "/api",
        auth: {
          domain,
          client_id: "local-client",
          redirect_uri: base,
          scope: "openid team5-web/analysis",
        },
      });
    if (url.pathname === "/api/auth/session" && !authenticated)
      return json(route, { authenticated: false });
    if (url.pathname.startsWith("/api/")) return handler(route, url);
    return route.continue();
  });
  await page.goto("/");
}
function verification(
  intent: string,
  email: string,
  status = "code_sent",
  seconds = 60,
) {
  return {
    intent_id: intent,
    status,
    email: email.trim().toLowerCase(),
    expires_at: Date.now() + 600000,
    retry_after_seconds: seconds,
    masked_destination: "t***@example.test",
  };
}

async function openLogin(page: Page) {
  const headerLogin = page
    .getByRole("banner")
    .getByRole("button", { name: "로그인", exact: true });
  if (await headerLogin.count()) await headerLogin.click();
  else
    await page
      .locator(".service-auth")
      .getByRole("button", { name: "로그인", exact: true })
      .click();
  await expect(page.locator(".service-auth")).toBeVisible();
  await expect(page.locator(".auth-brand")).toContainText("LinkGuard");
  await expect(page.getByRole("banner")).toHaveCount(0);
}
async function fillLogin(
  page: Page,
  email = "test@example.test",
  password = "legacy",
) {
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
}
const signin = (page: Page) =>
  page
    .locator(".auth-form")
    .getByRole("button", { name: "로그인", exact: true });
const activeSession = () => ({
  authenticated: true,
  session_ref: "B".repeat(43),
  access_token: "local-token",
  expires_at: Date.now() + 3600000,
});
const catalog = {
  default_model_choice: "claude-sonnet",
  models: ["Haiku", "Sonnet", "Opus"].map((model) => ({
    id: "claude-" + model.toLowerCase(),
    label: "Claude " + model + " 5.5",
    efforts: ["low", "medium", "high", "xhigh", "max"],
    default_effort: "high",
  })),
};

test("Korean native login validates, handles failure, preserves dynamic models and restores after reload without windows", async ({
  page,
  context,
}) => {
  let authenticated = false,
    signins = 0,
    analysisPosts = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const popups: Page[] = [];
  context.on("page", (opened) => popups.push(opened));
  const providerRequests: string[] = [];
  context.on("request", (request) => {
    if (new URL(request.url()).origin !== base)
      providerRequests.push(request.url());
  });
  await setup(
    page,
    async (route, url) => {
      if (url.pathname === "/api/auth/session")
        return json(
          route,
          authenticated ? activeSession() : { authenticated: false },
        );
      if (url.pathname === "/api/auth/signin") {
        signins++;
        expect(route.request().postDataJSON()).toEqual({
          email: "test@example.test",
          password: "legacy",
        });
        if (signins === 1) {
          await gate;
          return json(
            route,
            {
              code: "invalid_credentials",
              message: "이메일 또는 비밀번호를 확인해 주세요.",
            },
            401,
          );
        }
        if (signins === 2)
          return json(
            route,
            {
              code: "signin_binding_required",
              message: "브라우저 연결을 확인합니다.",
            },
            409,
          );
        authenticated = true;
        return json(route, activeSession());
      }
      if (url.pathname === "/api/analysis-models") return json(route, catalog);
      if (url.pathname === "/api/analyses") {
        if (route.request().method() === "POST") analysisPosts++;
        return json(route, { analyses: [] });
      }
      throw new Error("Unexpected native auth request " + url.pathname);
    },
    true,
  );
  await openLogin(page);
  const email = page.getByLabel("이메일", { exact: true }),
    password = page.getByLabel("비밀번호", { exact: true });
  await expect(email).toHaveAttribute("autocomplete", "username");
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await expect(signin(page)).toBeDisabled();
  await page.screenshot({
    path: evidence + "/login-desktop.png",
    fullPage: true,
  });
  await fillLogin(page);
  const show = page.getByRole("button", { name: "비밀번호 보기", exact: true });
  await show.focus();
  await show.press("Space");
  await expect(password).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "비밀번호 숨기기", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const control of await page
      .locator(".auth-field input,.auth-password-toggle,.auth-submit")
      .all()) {
      const box = await control.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.screenshot({
    path: evidence + "/login-mobile-390.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await password.press("Enter");
  await expect.poll(() => signins).toBe(1);
  await expect(
    page.locator(".auth-form").getByRole("button", { name: "로그인 중" }),
  ).toBeDisabled();
  await expect(
    page
      .locator(".service-auth")
      .getByRole("button", { name: "회원가입", exact: true }),
  ).toBeDisabled();
  await page
    .locator(".auth-form")
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
  expect(signins).toBe(1);
  release();
  await expect(page.getByRole("alert")).toContainText(
    "이메일 또는 비밀번호를 확인해 주세요.",
  );
  await expect(email).toHaveValue("test@example.test");
  await expect(password).toHaveValue("");
  await page.screenshot({
    path: evidence + "/login-error-desktop.png",
    fullPage: true,
  });
  await password.fill("legacy");
  await signin(page).click();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  const picker = page.getByRole("button", {
    name: "모델 및 추론 설정",
    exact: true,
  });
  await expect(picker).toBeEnabled();
  await picker.click();
  const pickerDialog = page.getByRole("dialog", {
    name: "모델 및 추론 설정",
  });
  await expect(pickerDialog.locator(".entry-model-option")).toHaveCount(15);
  await pickerDialog
    .getByRole("button", { name: "Claude Opus 5.5 Max", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  authenticated = false;
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect(page.getByLabel("분석할 URL", { exact: true })).toBeDisabled();
  expect([signins, analysisPosts, popups.length]).toEqual([3, 0, 0]);
  expect(context.pages()).toHaveLength(1);
  expect(providerRequests).toEqual([]);
  await expect(page).toHaveURL(base + "/");
});

test("native Web Locks block sign-in and signup in another tab until the first signup settles", async ({
  page,
  context,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let starts = 0,
    signins = 0;
  await setup(page, async (route, url) => {
    if (url.pathname === "/api/auth/signup/start") {
      const body = route.request().postDataJSON();
      starts++;
      if (starts === 1) await gate;
      return json(route, verification(body.intent_id, body.email));
    }
    if (url.pathname === "/api/auth/signin") {
      signins++;
      return json(route, activeSession());
    }
    if (url.pathname === "/api/analysis-models") return json(route, catalog);
    if (url.pathname === "/api/analyses") return json(route, { analyses: [] });
    throw new Error("Unexpected cross-tab native API");
  });
  expect(await page.evaluate(() => typeof navigator.locks?.request)).toBe(
    "function",
  );
  const second = await context.newPage();
  await second.goto("/");
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill("first@example.test");
  await page.getByRole("button", { name: "인증하기", exact: true }).click();
  await expect.poll(() => starts).toBe(1);
  await openLogin(second);
  await fillLogin(second);
  await signin(second).click();
  await expect(second.getByRole("alert")).toContainText(
    "다른 탭에서 인증을 처리 중입니다.",
  );
  expect(signins).toBe(0);
  await second
    .locator(".service-auth")
    .getByRole("button", { name: "회원가입", exact: true })
    .click();
  await second
    .getByLabel("이메일", { exact: true })
    .fill("second@example.test");
  await second.getByRole("button", { name: "인증하기", exact: true }).click();
  await expect(second.getByRole("alert")).toContainText(
    "다른 탭에서 인증을 처리 중입니다.",
  );
  expect(starts).toBe(1);
  release();
  await expect(page.getByLabel("이메일 인증 코드")).toBeVisible();
  await openLogin(second);
  await fillLogin(second);
  await signin(second).click();
  await expect(
    second.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  expect(signins).toBe(1);
  expect(context.pages()).toHaveLength(2);
});

test("native pending login blocks another tab signup and logout stays in the page with visible progress", async ({
  page,
  context,
}) => {
  let release!: () => void, releaseLogout!: () => void;
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    logoutGate = new Promise<void>((resolve) => {
      releaseLogout = resolve;
    });
  let signins = 0,
    starts = 0,
    logouts = 0;
  await setup(page, async (route, url) => {
    if (url.pathname === "/api/auth/signin") {
      signins++;
      await gate;
      return json(route, activeSession());
    }
    if (url.pathname === "/api/auth/signup/start") {
      starts++;
      const body = route.request().postDataJSON();
      return json(route, verification(body.intent_id, body.email));
    }
    if (url.pathname === "/api/auth/logout") {
      logouts++;
      await logoutGate;
      return json(route, { logged_out: true });
    }
    if (url.pathname === "/api/analysis-models") return json(route, catalog);
    if (url.pathname === "/api/analyses") return json(route, { analyses: [] });
    throw new Error("Unexpected native pending API");
  });
  const second = await context.newPage();
  await second.goto("/");
  await openLogin(page);
  await fillLogin(page);
  await signin(page).click();
  await expect.poll(() => signins).toBe(1);
  await second.getByRole("button", { name: "회원가입", exact: true }).click();
  await second
    .getByLabel("이메일", { exact: true })
    .fill("second@example.test");
  await second.getByRole("button", { name: "인증하기", exact: true }).click();
  await expect(second.getByRole("alert")).toContainText(
    "다른 탭에서 인증을 처리 중입니다.",
  );
  expect(starts).toBe(0);
  release();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  await second.getByRole("button", { name: "인증하기", exact: true }).click();
  await expect(second.getByLabel("이메일 인증 코드")).toBeVisible();
  expect(starts).toBe(1);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect.poll(() => logouts).toBe(1);
  await expect(
    page.getByRole("status").filter({ hasText: "로그아웃 중" }),
  ).toBeVisible();
  await expect(page.getByLabel("분석할 URL", { exact: true })).toBeDisabled();
  releaseLogout();
  await expect(
    page
      .getByRole("banner")
      .getByRole("button", { name: "로그인", exact: true }),
  ).toBeEnabled();
  expect(context.pages()).toHaveLength(2);
  await expect(page).toHaveURL(base + "/");
  expect(logouts).toBe(1);
});

test("wrong credentials after explicit logout keep the native form and Korean error visible", async ({
  page,
  context,
}) => {
  let authenticated = true,
    signins = 0;
  await setup(
    page,
    async (route, url) => {
      if (url.pathname === "/api/auth/session")
        return json(
          route,
          authenticated ? activeSession() : { authenticated: false },
        );
      if (url.pathname === "/api/auth/logout") {
        authenticated = false;
        return json(route, { logged_out: true });
      }
      if (url.pathname === "/api/auth/signin") {
        signins++;
        return json(
          route,
          {
            code: "invalid_credentials",
            message: "이메일 또는 비밀번호를 확인해 주세요.",
          },
          401,
        );
      }
      if (url.pathname === "/api/analysis-models") return json(route, catalog);
      if (url.pathname === "/api/analyses")
        return json(route, { analyses: [] });
      throw new Error("Unexpected signed-out sign-in API");
    },
    true,
  );
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await openLogin(page);
  await fillLogin(page);
  await signin(page).click();
  await expect(page.locator(".service-auth")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "이메일 또는 비밀번호를 확인해 주세요.",
  );
  await expect(page.getByLabel("이메일", { exact: true })).toHaveValue(
    "test@example.test",
  );
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveValue("");
  expect(signins).toBe(1);
  expect(context.pages()).toHaveLength(1);
  await expect(page).toHaveURL(base + "/");
});

test("another tab logout cancels a late native sign-in without reviving protected UI", async ({
  page,
  context,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let signins = 0,
    logouts = 0,
    parentProtected = 0;
  const createdPages: Page[] = [];
  context.on("page", (opened) => createdPages.push(opened));
  await setup(
    page,
    async (route, url) => {
      const fromParent = route.request().frame().page() === page;
      if (url.pathname === "/api/auth/session")
        return json(
          route,
          fromParent ? { authenticated: false } : activeSession(),
        );
      if (url.pathname === "/api/auth/signin") {
        signins++;
        await gate;
        return json(route, activeSession());
      }
      if (url.pathname === "/api/auth/logout") {
        logouts++;
        return json(route, { logged_out: true });
      }
      if (url.pathname === "/api/analysis-models") {
        if (fromParent) parentProtected++;
        return json(route, catalog);
      }
      if (url.pathname === "/api/analyses") {
        if (fromParent) parentProtected++;
        return json(route, { analyses: [] });
      }
      throw new Error("Unexpected late sign-in API");
    },
    true,
  );
  const second = await context.newPage();
  await second.goto("/");
  await expect(
    second.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  await openLogin(page);
  await fillLogin(page);
  await signin(page).click();
  await expect.poll(() => signins).toBe(1);
  await second.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "로그인", exact: true }),
  ).toHaveCount(0);
  await expect(
    second.getByRole("status").filter({ hasText: "로그아웃 중" }),
  ).toBeVisible();
  expect(logouts).toBe(0);
  const response = page.waitForResponse((value) =>
    value.url().endsWith("/auth/signin"),
  );
  release();
  await (await response).finished();
  await expect.poll(() => logouts).toBe(1);
  await expect(
    second
      .getByRole("banner")
      .getByRole("button", { name: "로그인", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("분석할 URL", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toHaveCount(0);
  expect(parentProtected).toBe(0);
  expect(createdPages).toEqual([second]);
  expect(context.pages()).toHaveLength(2);
});

test("email first signup stays in one form and sends password only after verified", async ({
  page,
}) => {
  const calls: { path: string; body: Record<string, string> }[] = [];
  let email = "",
    confirms = 0;
  await setup(page, async (route, url) => {
    const body = route.request().postDataJSON();
    calls.push({ path: url.pathname, body });
    expect(route.request().headers()["x-linkguard-request"]).toBe("v1");
    if (url.pathname.endsWith("/start")) {
      email = body.email;
      return json(route, verification(body.intent_id, email));
    }
    if (url.pathname.endsWith("/confirm")) {
      confirms += 1;
      if (confirms === 1)
        return json(
          route,
          { code: "code_mismatch", message: "코드가 일치하지 않습니다." },
          400,
        );
      return json(route, verification(body.intent_id, email, "verified", 0));
    }
    if (url.pathname.endsWith("/complete"))
      return json(route, {
        intent_id: body.intent_id,
        status: "complete",
        login_required: true,
      });
    throw new Error("Unexpected signup request");
  });
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  const password = page.getByLabel("비밀번호", { exact: true }),
    repeat = page.getByLabel("비밀번호 확인", { exact: true });
  await expect(password).toBeDisabled();
  await expect(repeat).toBeDisabled();
  await page.getByLabel("이메일", { exact: true }).fill("Test@Example.test");
  await page.screenshot({
    path: evidence + "/signup-email-first-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "인증하기", exact: true }).click();
  const code = page.getByLabel("이메일 인증 코드");
  await expect(code).toBeVisible();
  await expect(password).toBeDisabled();
  expect(calls[0].body).not.toHaveProperty("password");
  expect(calls[0].body.intent_id).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await page.setViewportSize({ width: 320, height: 1000 });
  for (const control of await page
    .locator(".auth-field input,.auth-inline-control button,.auth-submit")
    .all()) {
    const box = await control.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.screenshot({
    path: evidence + "/signup-inline-code-mobile-390.png",
    fullPage: true,
  });
  await code.fill("111111");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("일치하지");
  await expect(password).toBeDisabled();
  await code.fill("222222");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByText("인증 완료", { exact: true })).toBeVisible();
  await expect(password).toBeEnabled();
  await expect(code).toHaveCount(0);
  await expect(password).toBeFocused();
  for (const invalid of [
    "abcdefg😀",
    "Local !234",
    "Local\t!234",
    "Local\u00a0!234",
  ]) {
    await password.fill(invalid);
    await repeat.fill(invalid);
    await expect(
      page.getByRole("button", { name: "회원가입 완료", exact: true }),
    ).toBeDisabled();
  }
  await password.fill("Local!234");
  await repeat.fill("Different!234");
  await expect(page.getByText("비밀번호가 일치하지 않습니다.")).toBeVisible();
  await repeat.fill("Local!234");
  await page.screenshot({
    path: evidence + "/signup-verified-mobile-390.png",
    fullPage: true,
  });
  await repeat.press("Enter");
  await expect(
    page.getByRole("heading", { name: "가입 완료", exact: true }),
  ).toBeVisible();
  expect(calls.map((c) => c.path.split("/").at(-1))).toEqual([
    "start",
    "confirm",
    "confirm",
    "complete",
  ]);
  expect(calls[3].body.password).toBe("Local!234");
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
        history: history.state,
      }),
    ),
  ).not.toMatch(/Local!234|111111|222222|intent_id/);
  await page
    .getByRole("button", { name: "로그인으로 이동", exact: true })
    .click();
  await expect(page.locator(".service-auth")).toBeVisible();
  await expect(page.getByLabel("이메일", { exact: true })).toHaveValue(
    "test@example.test",
  );
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  expect(calls).toHaveLength(4);
});

test("editing email invalidates an in-flight confirmation and ignores its late success", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const bodies: Record<string, string>[] = [];
  await setup(page, async (route, url) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    if (url.pathname.endsWith("/start"))
      return json(route, verification(body.intent_id, body.email));
    if (url.pathname.endsWith("/confirm")) {
      await gate;
      return json(
        route,
        verification(body.intent_id, "old@example.test", "verified", 0),
      );
    }
    throw new Error("Unexpected mutation");
  });
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  const email = page.getByLabel("이메일", { exact: true });
  await email.fill("old@example.test");
  await page.getByRole("button", { name: "인증하기", exact: true }).click();
  await page.getByLabel("이메일 인증 코드").fill("123456");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "확인 중", exact: true }),
  ).toBeDisabled();
  await email.fill("new@example.test");
  await expect(
    page.getByRole("button", { name: "처리 중", exact: true }),
  ).toBeDisabled();
  expect(bodies).toHaveLength(2);
  release();
  await expect(
    page.getByRole("button", { name: "인증하기", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "인증하기", exact: true }).click();
  await expect(page.getByLabel("이메일 인증 코드")).toHaveValue("");
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeDisabled();
  await expect(email).toHaveValue("new@example.test");
  await expect(page.getByText("인증 완료", { exact: true })).toHaveCount(0);
  expect(bodies[0].intent_id).not.toBe(bodies[2].intent_id);
});

test("server cooldown, code expiry, resend and verified expiry are enforced", async ({
  page,
}) => {
  await page.clock.install();
  let starts = 0,
    resends = 0;
  await setup(page, async (route, url) => {
    const body = route.request().postDataJSON();
    if (url.pathname.endsWith("/start")) {
      starts++;
      if (starts === 1)
        return json(
          route,
          {
            code: "rate_limited",
            message: "잠시 후 다시 받아 주세요.",
            retry_after_seconds: 5,
          },
          429,
        );
      return json(route, {
        ...verification(body.intent_id, body.email, "code_sent", 2),
        expires_at: await page.evaluate(() => Date.now() + 3000),
      });
    }
    if (url.pathname.endsWith("/resend")) {
      resends++;
      return json(
        route,
        verification(body.intent_id, "test@example.test", "code_sent", 2),
      );
    }
    if (url.pathname.endsWith("/confirm"))
      return json(route, {
        ...verification(body.intent_id, "test@example.test", "verified", 0),
        expires_at: await page.evaluate(() => Date.now() + 2000),
      });
    throw new Error("Unexpected expiry mutation");
  });
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill("test@example.test");
  await page.getByRole("button", { name: "인증하기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "5초", exact: true }),
  ).toBeDisabled();
  await page.clock.fastForward(5100);
  await page.getByRole("button", { name: "인증하기", exact: true }).click();
  await page.getByLabel("이메일 인증 코드").fill("123456");
  await page.clock.fastForward(3100);
  await expect(
    page.getByRole("button", { name: "확인", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "다시 받기", exact: true }).click();
  await expect(page.getByLabel("이메일 인증 코드")).toHaveValue("");
  await page.getByLabel("이메일 인증 코드").fill("123456");
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await page.getByLabel("비밀번호", { exact: true }).fill("Local!234");
  await page.getByLabel("비밀번호 확인", { exact: true }).fill("Local!234");
  await page.clock.fastForward(2100);
  await expect(page.getByLabel("비밀번호", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "회원가입 완료", exact: true }),
  ).toBeDisabled();
  expect([starts, resends]).toEqual([2, 1]);
});

for (const failure of [
  "account_exists",
  "verification_unknown",
  "completion_unknown",
]) {
  test(`uncertain or existing account result ${failure} does not become a successful signup`, async ({
    page,
  }) => {
    let complete = 0;
    await setup(page, async (route, url) => {
      const body = route.request().postDataJSON();
      const error = () =>
        json(
          route,
          {
            code: failure,
            message: "기존 계정 확인 또는 로그인으로 확인해 주세요.",
          },
          409,
        );
      if (url.pathname.endsWith("/start"))
        return failure === "account_exists"
          ? error()
          : json(route, verification(body.intent_id, body.email));
      if (url.pathname.endsWith("/confirm"))
        return failure === "verification_unknown"
          ? error()
          : json(
              route,
              verification(body.intent_id, "test@example.test", "verified", 0),
            );
      if (url.pathname.endsWith("/complete")) {
        complete++;
        return error();
      }
      throw new Error("Unexpected recovery mutation");
    });
    await page.getByRole("button", { name: "회원가입", exact: true }).click();
    await page.getByLabel("이메일", { exact: true }).fill("test@example.test");
    await page.getByRole("button", { name: "인증하기", exact: true }).click();
    if (failure !== "account_exists") {
      await page.getByLabel("이메일 인증 코드").fill("123456");
      await page.getByRole("button", { name: "확인", exact: true }).click();
    }
    if (failure === "completion_unknown") {
      await page.getByLabel("비밀번호", { exact: true }).fill("Local!234");
      await page.getByLabel("비밀번호 확인", { exact: true }).fill("Local!234");
      await page
        .getByRole("button", { name: "회원가입 완료", exact: true })
        .click();
    }
    await expect(page.getByRole("alert")).toContainText("기존 계정");
    await expect(
      page.getByRole("button", { name: "회원가입 완료", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "기존 이메일 인증", exact: true })
      .click();
    await expect(page.locator(".service-auth")).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    expect(complete).toBe(failure === "completion_unknown" ? 1 : 0);
  });
}

test("Back and Forward preserve login and restore existing Fast/Deep without POST; bfcache resumes streams", async ({
  page,
}) => {
  let fastPosts = 0,
    deepPosts = 0,
    tokens = 0,
    streams = 0;
  await setup(
    page,
    async (route, url) => {
      if (url.pathname === "/api/auth/session") {
        tokens += 1;
        return json(route, {
          authenticated: true,
          session_ref: "A".repeat(43),
          access_token: "local-token",
          expires_at: Date.now() + 3600000,
        });
      }
      if (url.pathname === "/api/analysis-models")
        return json(route, {
          default_model_choice: "claude-test",
          models: [
            {
              id: "claude-test",
              label: "Claude Sonnet 5.5",
              efforts: ["high"],
              default_effort: "high",
            },
          ],
        });
      if (url.pathname === "/api/analyses") {
        if (route.request().method() === "GET")
          return json(route, {
            analyses: fastPosts
              ? [{ scanId: scan, url: "https://example.test/" }]
              : [],
          });
        fastPosts += 1;
        return json(route, {
          scanId: scan,
          pollUrl: `/api/analyses/${scan}`,
          model_choice: "claude-test",
          reasoning_effort: "high",
        });
      }
      if (url.pathname === `/api/analyses/${scan}/events`) {
        streams += 1;
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: fast\ndata: ${JSON.stringify({ ...previewFast, job_id: scan })}\n\n`,
        });
      }
      if (url.pathname.endsWith("/deep")) {
        deepPosts += 1;
        return json(route, {
          run_id: "local-run",
          events_url: "/api/deep/local-run/events",
        });
      }
      if (url.pathname === "/api/deep/local-run/events")
        return route.fulfill({
          contentType: "text/event-stream",
          body: `event: deep\ndata: ${JSON.stringify({ ...previewDeep("completed"), scan_id: scan, run_id: "local-run" })}\n\n`,
        });
      throw new Error("Unexpected history request");
    },
    true,
  );
  await page
    .getByLabel("분석할 URL", { exact: true })
    .fill("https://example.test/");
  await page.getByRole("button", { name: "분석 시작", exact: true }).click();
  await page
    .getByRole("button", { name: "심층 분석 시작", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "심층 분석 결과", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "심층 분석 시작", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("분석할 URL", { exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("button", { name: "심층 분석 시작", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "심층 분석 결과", exact: true }),
  ).toBeVisible();
  const before = streams;
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await expect.poll(() => streams).toBeGreaterThan(before);
  expect([fastPosts, deepPosts]).toEqual([1, 1]);
  expect(tokens).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => JSON.stringify(history.state))).toBe(
    JSON.stringify({
      linkguard: 1,
      route: { view: "deep", scan, run: "local-run" },
      previous: { view: "fast", scan },
    }),
  );
});

test("Back during pending acceptance ignores late response; Forward does not resubmit", async ({
  page,
}) => {
  let posts = 0,
    streams = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await setup(
    page,
    async (route, url) => {
      if (url.pathname === "/api/auth/session")
        return json(route, {
          authenticated: true,
          session_ref: "A".repeat(43),
          access_token: "local-token",
          expires_at: Date.now() + 3600000,
        });
      if (url.pathname === "/api/analysis-models")
        return json(route, {
          default_model_choice: "claude-test",
          models: [
            {
              id: "claude-test",
              label: "Claude Sonnet 5.5",
              efforts: ["high"],
              default_effort: "high",
            },
          ],
        });
      if (
        url.pathname === "/api/analyses" &&
        route.request().method() === "GET"
      )
        return json(route, { analyses: [] });
      if (url.pathname === "/api/analyses") {
        posts += 1;
        await gate;
        return json(route, {
          scanId: scan,
          pollUrl: `/api/analyses/${scan}`,
          model_choice: "claude-test",
          reasoning_effort: "high",
        });
      }
      streams += 1;
      throw new Error("Stale acceptance started a stream");
    },
    true,
  );
  await page
    .getByLabel("분석할 URL", { exact: true })
    .fill("https://example.test/");
  await page.getByRole("button", { name: "분석 시작", exact: true }).click();
  await expect.poll(() => posts).toBe(1);
  await page.goBack();
  release();
  await expect(page.getByLabel("분석할 URL", { exact: true })).toBeEnabled();
  await page.goForward();
  await expect(page.getByRole("alert")).toContainText("다시 보내지 않았습니다");
  expect([posts, streams]).toEqual([1, 0]);
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
});

test("bfcache during catalog loading reconnects instead of leaving submit blocked", async ({
  page,
}) => {
  let catalogs = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await setup(
    page,
    async (route, url) => {
      if (url.pathname === "/api/auth/session")
        return json(route, {
          authenticated: true,
          session_ref: "A".repeat(43),
          access_token: "local-token",
          expires_at: Date.now() + 3600000,
        });
      if (url.pathname === "/api/analyses")
        return json(route, { analyses: [] });
      if (url.pathname === "/api/analysis-models") {
        catalogs += 1;
        if (catalogs === 1) await gate;
        return json(route, {
          default_model_choice: "claude-test",
          models: [
            {
              id: "claude-test",
              label: "Claude Sonnet 5.5",
              efforts: ["high"],
              default_effort: "high",
            },
          ],
        });
      }
      throw new Error("Unexpected catalog request");
    },
    true,
  );
  await page
    .getByLabel("분석할 URL", { exact: true })
    .fill("https://example.test/");
  await expect(
    page.getByRole("button", { name: "분석 시작", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    );
  });
  await expect(
    page.getByRole("button", { name: "분석 시작", exact: true }),
  ).toBeEnabled();
  release();
  expect(catalogs).toBe(2);
});

test("explicit logout followed by a persisted page show does not restore protected requests", async ({
  page,
}) => {
  let protectedRequests = 0;
  await setup(
    page,
    async (route, url) => {
      if (url.pathname === "/api/auth/session")
        return json(route, {
          authenticated: true,
          session_ref: "A".repeat(43),
          access_token: "local-token",
          expires_at: Date.now() + 3600000,
        });
      if (url.pathname === "/api/auth/logout")
        return json(route, {
          logged_out: true,
          logout_url:
            domain +
            "/logout?client_id=local-client&logout_uri=" +
            encodeURIComponent(base),
        });
      protectedRequests += 1;
      if (url.pathname === "/api/analyses")
        return json(route, { analyses: [] });
      if (url.pathname === "/api/analysis-models")
        return json(route, {
          default_model_choice: "claude-test",
          models: [
            {
              id: "claude-test",
              label: "Claude Sonnet 5.5",
              efforts: ["high"],
              default_effort: "high",
            },
          ],
        });
      throw new Error("Unexpected logout request");
    },
    true,
  );
  await expect(
    page.getByRole("button", {
      name: "모델 및 추론 설정",
      exact: true,
    }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(
    page.getByRole("button", { name: "로그인", exact: true }),
  ).toBeVisible();
  const before = protectedRequests;
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await expect(page.getByLabel("분석할 URL", { exact: true })).toBeDisabled();
  expect(protectedRequests).toBe(before);
});

for (const source of ["start", "resend"]) {
  test(`${source} can restore server-verified state and email edits clear it`, async ({
    page,
  }) => {
    let requests = 0;
    await setup(page, async (route, url) => {
      requests++;
      const body = route.request().postDataJSON();
      const status =
        source === "start" || url.pathname.endsWith("/resend")
          ? "verified"
          : "code_sent";
      return json(
        route,
        verification(
          body.intent_id,
          body.email || "test@example.test",
          status,
          0,
        ),
      );
    });
    await page.getByRole("button", { name: "회원가입", exact: true }).click();
    const email = page.getByLabel("이메일", { exact: true });
    await email.fill("test@example.test");
    await page.getByRole("button", { name: "인증하기", exact: true }).click();
    if (source === "resend") {
      await expect(page.getByLabel("이메일 인증 코드")).toBeVisible();
      await page
        .getByRole("button", { name: "다시 받기", exact: true })
        .click();
    }
    await expect(page.getByText("인증 완료", { exact: true })).toBeVisible();
    const password = page.getByLabel("비밀번호", { exact: true });
    await expect(password).toBeFocused();
    await password.fill("Local!234");
    await page.getByLabel("비밀번호 확인", { exact: true }).fill("Local!234");
    await email.fill("different@example.test");
    await expect(password).toHaveValue("");
    await expect(password).toBeDisabled();
    await expect(page.getByLabel("비밀번호 확인", { exact: true })).toHaveValue(
      "",
    );
    await expect(page.getByText("인증 완료", { exact: true })).toHaveCount(0);
    expect(requests).toBe(source === "start" ? 1 : 2);
  });
}

test("failed logout is visible and reload cannot revive the local signed-out view", async ({
  page,
}) => {
  let protectedRequests = 0,
    logoutRequests = 0;
  await setup(
    page,
    async (route, url) => {
      if (url.pathname === "/api/auth/session")
        return json(route, {
          authenticated: true,
          session_ref: "A".repeat(43),
          access_token: "local-token",
          expires_at: Date.now() + 3600000,
        });
      if (url.pathname === "/api/auth/logout") {
        logoutRequests++;
        return json(
          route,
          {
            code: "service_unavailable",
            message: "로그아웃 서버 요청을 완료하지 못했습니다.",
          },
          503,
        );
      }
      protectedRequests++;
      if (url.pathname === "/api/analyses")
        return json(route, { analyses: [] });
      if (url.pathname === "/api/analysis-models")
        return json(route, {
          default_model_choice: "test",
          models: [
            {
              id: "test",
              label: "Claude Sonnet 5.5",
              efforts: ["high"],
              default_effort: "high",
            },
          ],
        });
      throw new Error("Unexpected logout failure API");
    },
    true,
  );
  await expect(
    page.getByRole("button", {
      name: "모델 및 추론 설정",
      exact: true,
    }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "로그아웃 서버 요청을 완료하지 못했습니다.",
  );
  await expect(page.getByLabel("분석할 URL", { exact: true })).toBeDisabled();
  const before = protectedRequests;
  await page.reload();
  await expect(
    page.getByRole("button", { name: "로그인", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("분석할 URL", { exact: true })).toBeDisabled();
  expect(protectedRequests).toBe(before);
  expect(logoutRequests).toBe(1);
});

for (const remount of [false, true]) {
  test(`a delayed first start blocks a new send until HTTP settles${remount ? " across form remount" : " after email edit"}`, async ({
    page,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sent: Record<string, string>[] = [];
    await setup(page, async (route, url) => {
      if (!url.pathname.endsWith("/start"))
        throw new Error("Unexpected delayed start API");
      const body = route.request().postDataJSON();
      sent.push(body);
      if (sent.length === 1) await gate;
      return json(route, verification(body.intent_id, body.email));
    });
    await page.getByRole("button", { name: "회원가입", exact: true }).click();
    await page.getByLabel("이메일", { exact: true }).fill("first@example.test");
    await page.getByRole("button", { name: "인증하기", exact: true }).click();
    await expect.poll(() => sent.length).toBe(1);
    if (remount) {
      await page
        .getByRole("button", { name: "LinkGuard 메인 화면으로", exact: true })
        .click();
      await page.getByRole("button", { name: "회원가입", exact: true }).click();
    }
    await page
      .getByLabel("이메일", { exact: true })
      .fill("second@example.test");
    await expect(
      page.getByRole("button", { name: "처리 중", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("인증 요청을 처리하고 있습니다. 잠시만 기다려 주세요."),
    ).toBeVisible();
    await page.getByLabel("이메일", { exact: true }).press("Enter");
    expect(sent).toHaveLength(1);
    const settled = page.waitForResponse((response) =>
      response.url().endsWith("/signup/start"),
    );
    release();
    await (await settled).finished();
    await expect(
      page.getByRole("button", { name: "인증하기", exact: true }),
    ).toBeEnabled();
    await expect(page.getByLabel("이메일", { exact: true })).toHaveValue(
      "second@example.test",
    );
    await expect(page.getByLabel("이메일 인증 코드")).toHaveCount(0);
    await page.getByRole("button", { name: "인증하기", exact: true }).click();
    await expect(page.getByLabel("이메일 인증 코드")).toBeVisible();
    expect(sent).toHaveLength(2);
    expect(sent[1].email).toBe("second@example.test");
    expect(sent[0].intent_id).not.toBe(sent[1].intent_id);
  });
}
