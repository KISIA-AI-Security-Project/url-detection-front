import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationRequired, WebAuth, signupPasswordRules } from "../src/service/auth.js";

const config = {
  domain: "https://example.auth.ap-northeast-2.amazoncognito.com",
  client_id: "public-client",
  redirect_uri: "https://service.example/",
  scope: "openid email team5-web/analysis",
};
let stored: Map<string, string>;
let assign: ReturnType<typeof vi.fn>;
beforeEach(() => {
  stored = new Map();
  assign = vi.fn();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  vi.stubGlobal("location", { search: "", pathname: "/", assign });
  vi.stubGlobal("history", { replaceState: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("email signup and confirmation", () => {
  it.each([
    ["abcdef!", false], ["abcdefgh", false], ["abcdefg!", true],
    ["1234567!", true], ["한글비밀번호일곱!", true], ["abcdefg🙂", false],
    [" abcdefg!", false], ["abcdefg! ", false], ["a".repeat(256) + "!", false],
    ["abc defg!", false], ["abc\tdefg!", false], ["abc\ndefg!", false], ["abc\u00a0defg!", false],
  ])("validates the requested policy and Cognito limits: %s", (value, valid) => {
    expect(signupPasswordRules(value).valid).toBe(valid);
  });
  it("sends signup, code confirmation and resend directly to the existing public Cognito client", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ UserConfirmed: false, CodeDeliveryDetails: { DeliveryMedium: "EMAIL", Destination: "t***@example.test" } }))
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({ CodeDeliveryDetails: { DeliveryMedium: "EMAIL", Destination: "t***@example.test" } }));
    vi.stubGlobal("fetch", fetchMock);
    const auth = new WebAuth(config);
    expect(await auth.signUp(" test@example.test ", "abcdefg!")).toEqual({ confirmed: false, destination: "t***@example.test" });
    await auth.confirmSignUp("test@example.test", " 012345 ");
    await auth.resendSignUpCode("test@example.test");
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual(Array(3).fill("https://cognito-idp.ap-northeast-2.amazonaws.com/"));
    expect(calls.map(([, init]) => JSON.parse(init.body as string))).toEqual([
      { ClientId: config.client_id, Username: "test@example.test", Password: "abcdefg!", UserAttributes: [{ Name: "email", Value: "test@example.test" }] },
      { ClientId: config.client_id, Username: "test@example.test", ConfirmationCode: "012345", ForceAliasCreation: false },
      { ClientId: config.client_id, Username: "test@example.test" },
    ]);
    expect(calls.map(([, init]) => (init.headers as Record<string, string>)["x-amz-target"])).toEqual([
      "AWSCognitoIdentityProviderService.SignUp", "AWSCognitoIdentityProviderService.ConfirmSignUp", "AWSCognitoIdentityProviderService.ResendConfirmationCode",
    ]);
    for (const [, init] of calls) expect(init).toMatchObject({ credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
    expect(auth.tokens).toBeNull();
    expect(stored.size).toBe(0);
  });
  it("rejects invalid input before any request", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const auth = new WebAuth(config);
    await expect(auth.signUp("invalid", "abcdefg!")).rejects.toThrow("이메일");
    await expect(auth.signUp("test@example.test", "abcdefgh")).rejects.toThrow("특수문자");
    for (const value of ["abc defg!", "abc\tdefg!", "abc\ndefg!", "abc\u00a0defg!"])
      await expect(auth.signUp("test@example.test", value)).rejects.toMatchObject({ code: "invalid_password" });
    await expect(auth.confirmSignUp("test@example.test", "12345a")).rejects.toThrow("6자리");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["CodeMismatchException", "ExpiredCodeException", "UsernameExistsException", "LimitExceededException"])("retains a recoverable error code without exposing raw server details: %s", async (code) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ __type: `namespace#${code}`, message: "private server detail" }, { status: 400 })));
    await expect(new WebAuth(config).confirmSignUp("test@example.test", "012345")).rejects.toMatchObject({ code });
    await expect(new WebAuth(config).confirmSignUp("test@example.test", "012345")).rejects.not.toThrow("private server detail");
  });
  it("does not invent successful signup from a malformed response or retry a timed-out signup", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({})));
    await expect(new WebAuth(config).signUp("test@example.test", "abcdefg!")).rejects.toMatchObject({ code: "unexpected_signup" });
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")))));
    vi.stubGlobal("fetch", fetchMock);
    const pending = new WebAuth(config).signUp("test@example.test", "abcdefg!");
    const assertion = expect(pending).rejects.toMatchObject({ code: "connection_failed" });
    await vi.advanceTimersByTimeAsync(20000); await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("OAuth session boundary", () => {
  it("retains OAuth analysis scope and S256 PKCE when a newly verified user logs in", async () => {
    await new WebAuth(config).login("test@example.test");
    const url = assign.mock.calls[0][0] as URL;
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("scope")).toBe(config.scope);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("login_hint")).toBe("test@example.test");
    const pending = JSON.parse(stored.get("web.oauth")!);
    expect(pending.state).toBe(url.searchParams.get("state"));
    expect(pending.verifier.length).toBeGreaterThanOrEqual(43);
    expect(JSON.stringify([...stored])).not.toContain("test@example.test");
  });
  it("rejects invalid callback state before exchanging a code", async () => {
    vi.stubGlobal("fetch", vi.fn());
    location.search = "?code=callback-code&state=wrong";
    stored.set("web.oauth", JSON.stringify({ verifier: "test-verifier", state: "right", created: Date.now() }));
    await expect(new WebAuth(config).initialize()).rejects.toThrow("만료");
    expect(fetch).not.toHaveBeenCalled();
    expect(stored.has("web.oauth")).toBe(false);
  });
  it("cannot revive a logged-out session with an in-flight refresh response", async () => {
    let resolveRefresh!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => { resolveRefresh = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const auth = new WebAuth(config);
    // Test-only token fixture; no real user token is captured or stored.
    Object.assign(auth, { tokens: { access_token: "expired-fixture", expires_at: 0, refresh_token: "refresh-fixture" } });
    const pending = auth.accessToken();
    auth.logout();
    resolveRefresh(Response.json({ access_token: "late-fixture", expires_in: 3600 }));
    await expect(pending).rejects.toBeInstanceOf(AuthenticationRequired);
    expect(auth.tokens).toBeNull();
    expect(stored.size).toBe(0);
  });
});
