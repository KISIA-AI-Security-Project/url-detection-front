import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { Brand, Button, Spinner } from "./ui";
import { signupPasswordRules } from "../service/auth.js";
import { WebAuth, type EmailVerification } from "../service/session-auth.js";
import "../service/auth.css";

type AuthStep =
  "login" | "signup" | "legacy-email" | "legacy-code" | "complete";
type EmailState = "idle" | "code" | "verified" | "expired" | "recovery";
// Keep first binding-cookie responses ordered, including when the form remounts.
const emailRequests = new WeakMap<WebAuth, Promise<void>>();

export function ServiceAuth({
  auth,
  onBack,
  initialError = "",
  initialStep = "login",
  onLoginPendingChange,
  previewState,
}: {
  auth: WebAuth;
  onBack: () => void;
  initialError?: string;
  initialStep?: "login" | "signup";
  onLoginPendingChange?: (pending: boolean) => void;
  previewState?: "signup-code";
}) {
  const [step, setStep] = useState<AuthStep>(initialStep);
  const [email, setEmail] = useState(
    previewState === "signup-code" ? "test@example.com" : "",
  );
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [recoveryHelp, setRecoveryHelp] = useState(false);
  const [code, setCode] = useState("");
  const [emailState, setEmailState] = useState<EmailState>(
    previewState === "signup-code" ? "code" : "idle",
  );
  const [expiresAt, setExpiresAt] = useState(
    previewState === "signup-code" ? Date.now() + 10 * 60 * 1000 : 0,
  );
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState(initialError);
  const [emailError, setEmailError] = useState("");
  const [busy, setBusy] = useState("");
  const [emailRequestPending, setEmailRequestPending] = useState(() =>
    emailRequests.has(auth),
  );
  const [existingAccount, setExistingAccount] = useState(false);
  const [legacyComplete, setLegacyComplete] = useState(false);
  const live = useRef(true);
  const revision = useRef(0);
  const pending = useRef(false);
  const intent = useRef<string | null>(null);
  if (!intent.current) intent.current = WebAuth.random();
  const heading = useRef<HTMLHeadingElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const rules = signupPasswordRules(password);
  const mismatch = !!repeat && password !== repeat;
  const cooldown = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const verified = emailState === "verified" && expiresAt > now;

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      revision.current++;
    };
  }, []);
  useEffect(() => {
    if (["login", "signup", "legacy-email"].includes(step))
      emailInput.current?.focus();
    else if (step === "legacy-code") codeInput.current?.focus();
    else heading.current?.focus();
  }, [step]);
  useEffect(() => {
    onLoginPendingChange?.(busy === "login");
    return () => onLoginPendingChange?.(false);
  }, [busy, onLoginPendingChange]);
  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);
  useEffect(() => {
    let observing = true;
    const request = emailRequests.get(auth);
    if (request) {
      setEmailRequestPending(true);
      void request.finally(() => {
        if (observing) setEmailRequestPending(false);
      });
    }
    return () => {
      observing = false;
    };
  }, [auth]);
  useEffect(() => {
    if (!retryAt && !expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt, expiresAt]);
  useEffect(() => {
    if (
      step === "signup" &&
      emailState === "verified" &&
      expiresAt &&
      now >= expiresAt
    ) {
      setEmailState("expired");
      setPassword("");
      setRepeat("");
      setEmailError(
        "이메일 인증 시간이 만료됐습니다. 인증 상태를 다시 확인해 주세요.",
      );
    }
  }, [now, expiresAt, emailState, step]);

  function clearSecrets() {
    setPassword("");
    setRepeat("");
    setCode("");
    setPasswordVisible(false);
  }
  function move(next: AuthStep) {
    if (pending.current) return;
    revision.current++;
    clearSecrets();
    setError("");
    setEmailError("");
    setRecoveryHelp(false);
    setStep(next);
  }
  function editEmail(value: string) {
    revision.current++;
    pending.current = false;
    setBusy("");
    intent.current = WebAuth.random();
    setEmail(value);
    setEmailState("idle");
    setExpiresAt(0);
    setRetryAt(0);
    setError("");
    setEmailError("");
    setExistingAccount(false);
    clearSecrets();
  }
  function applyTiming(result: EmailVerification) {
    setNow(Date.now());
    setExpiresAt(result.expires_at ?? 0);
    setRetryAt(Date.now() + (result.retry_after_seconds ?? 0) * 1000);
    if (result.email) setEmail(result.email);
  }
  async function perform(
    label: string,
    action: (current: () => boolean, requestIntent: string) => Promise<void>,
    emailAction = false,
  ) {
    if (pending.current) return;
    const version = revision.current,
      requestIntent = intent.current!;
    const current = () =>
      live.current &&
      version === revision.current &&
      requestIntent === intent.current;
    pending.current = true;
    setBusy(label);
    setError("");
    if (emailAction) setEmailError("");
    try {
      await action(current, requestIntent);
    } catch (value) {
      if (!current()) return;
      const message =
        value instanceof Error
          ? value.message
          : "요청을 완료하지 못했습니다. 다시 시도해 주세요.";
      if (emailAction) setEmailError(message);
      else setError(message);
      const detail = value as { code?: string; retry_after_seconds?: number };
      if (typeof detail.retry_after_seconds === "number") {
        setNow(Date.now());
        setRetryAt(Date.now() + detail.retry_after_seconds * 1000);
      }
      if (detail.code === "account_exists") setExistingAccount(true);
      if (detail.code === "code_expired") setExpiresAt(Date.now());
      if (
        [
          "verification_unknown",
          "completion_unknown",
          "flow_conflict",
        ].includes(detail.code ?? "") ||
        (detail.code === "request_failed" &&
          (label === "verify" || label === "complete"))
      ) {
        setEmailState("recovery");
        setExpiresAt(0);
        clearSecrets();
      }
      if (detail.code === "flow_expired") {
        setEmailState("expired");
        setExpiresAt(0);
        clearSecrets();
      }
    } finally {
      if (current()) {
        pending.current = false;
        setBusy("");
      }
    }
  }
  function trackEmailRequest(request: Promise<void>) {
    emailRequests.set(auth, request);
    setEmailRequestPending(true);
    void request.finally(() => {
      if (emailRequests.get(auth) !== request) return;
      emailRequests.delete(auth);
      if (live.current) setEmailRequestPending(false);
    });
  }
  function sendCode() {
    if (
      pending.current ||
      emailRequests.has(auth) ||
      cooldown ||
      existingAccount ||
      emailState === "expired" ||
      emailState === "recovery" ||
      !emailInput.current?.reportValidity()
    )
      return;
    const request = perform(
      "send",
      async (current, requestIntent) => {
        const result =
          emailState === "code"
            ? await auth.resendEmailVerification(requestIntent)
            : await auth.startEmailVerification(email, requestIntent);
        if (!current()) return;
        applyTiming(result);
        setEmailState(result.status === "verified" ? "verified" : "code");
        setCode("");
        window.requestAnimationFrame(() => {
          if (current())
            (result.status === "verified"
              ? passwordInput.current
              : codeInput.current
            )?.focus();
        });
      },
      true,
    );
    trackEmailRequest(request);
  }
  function confirmCode() {
    if (
      pending.current ||
      emailRequests.has(auth) ||
      emailState !== "code" ||
      expiresAt <= Date.now() ||
      !/^\d{6}$/.test(code)
    )
      return;
    const request = perform(
      "verify",
      async (current, requestIntent) => {
        const result = await auth.confirmEmailVerification(requestIntent, code);
        if (!current()) return;
        applyTiming(result);
        setEmailState("verified");
        setCode("");
        window.requestAnimationFrame(() => {
          if (current()) passwordInput.current?.focus();
        });
      },
      true,
    );
    trackEmailRequest(request);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (step === "signup") {
      if (emailRequests.has(auth)) return;
      if (!verified || expiresAt <= Date.now()) {
        if (emailState === "code") confirmCode();
        else sendCode();
        return;
      }
      if (!rules.valid || !repeat || password !== repeat) return;
      const request = perform("complete", async (current, requestIntent) => {
        try {
          await auth.completeRegistration(requestIntent, password);
          if (!current()) return;
          setLegacyComplete(false);
          setStep("complete");
        } finally {
          if (current()) clearSecrets();
        }
      });
      trackEmailRequest(request);
    } else if (step === "legacy-email") {
      if (cooldown || !emailInput.current?.reportValidity()) return;
      void perform("legacy-send", async (current) => {
        await auth.resendSignUpCode(email.trim());
        if (!current()) return;
        setCode("");
        setNow(Date.now());
        setRetryAt(Date.now() + 60000);
        setStep("legacy-code");
      });
    } else if (step === "legacy-code") {
      void perform("legacy-confirm", async (current) => {
        await auth.confirmSignUp(email, code);
        if (current()) {
          clearSecrets();
          setLegacyComplete(true);
          setStep("complete");
        }
      });
    } else if (step === "complete") {
      move("login");
    } else {
      if (!email.trim() || !password) return;
      void perform("login", async (current) => {
        try {
          await auth.login(email.trim(), password);
        } finally {
          if (current()) clearSecrets();
        }
      });
    }
  }
  const title = {
    login: "로그인",
    signup: "회원가입",
    "legacy-email": "기존 계정 이메일 인증",
    "legacy-code": "기존 계정 이메일 인증",
    complete: legacyComplete ? "이메일 인증 완료" : "가입 완료",
  }[step];
  const codeExpired = emailState === "code" && !!expiresAt && now >= expiresAt;
  const compact = step !== "complete";
  const compactForm = compact || (step === "complete" && legacyComplete);
  return (
    <div className="auth-layout">
      <button
        className="text-button auth-home-link"
        type="button"
        onClick={onBack}
      >
        <ArrowLeft size={15} aria-hidden="true" />
        메인 페이지 이동
      </button>
      <section className="service-auth" aria-labelledby="auth-title">
        <div className="auth-brand">
          <Brand onHome={onBack} />
        </div>
        <header
          className={`auth-intro${compact ? " sr-only" : ""}${step === "complete" && legacyComplete ? " auth-intro-compact" : ""}`}
        >
          <h1 id="auth-title" ref={heading} tabIndex={-1}>
            {title}
          </h1>
          <p>
            {step === "signup"
              ? "이메일을 먼저 인증한 뒤 비밀번호를 설정하세요."
              : step === "login"
                ? "로그인하고 링크의 근거와 분석 기록을 확인하세요."
                : step === "legacy-email"
                  ? "이미 가입한 이메일의 인증을 이어가세요."
                  : step === "legacy-code"
                    ? "인증 코드가 전송되었습니다."
                    : "로그인하면 분석을 시작할 수 있어요."}
          </p>
        </header>
        <form
          className={`auth-form${compactForm ? " auth-compact-form" : ""}${step === "signup" ? " auth-signup-form" : ""}`}
          onSubmit={submit}
          aria-busy={!!busy}
        >
          {(step === "signup" ||
            step === "login" ||
            step === "legacy-email") && (
            <div className="auth-field">
              <label
                className={compact ? "sr-only" : undefined}
                htmlFor="auth-email"
              >
                이메일
              </label>
              <div
                className={
                  step === "signup" ? "auth-inline-control" : undefined
                }
              >
                <input
                  ref={emailInput}
                  id="auth-email"
                  type="email"
                  autoComplete={step === "login" ? "username" : "email"}
                  inputMode="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => editEmail(event.target.value)}
                  required
                  disabled={!!busy && busy !== "send" && busy !== "verify"}
                  placeholder={compact ? "이메일" : "name@example.com"}
                  aria-describedby={
                    step === "signup" ? "auth-email-status" : undefined
                  }
                />
                {step === "signup" &&
                  (verified ? (
                    <span className="auth-verified">
                      <Check size={15} /> 인증 완료
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={sendCode}
                      disabled={
                        !!busy ||
                        emailRequestPending ||
                        cooldown > 0 ||
                        !email.trim() ||
                        existingAccount ||
                        emailState === "expired" ||
                        emailState === "recovery"
                      }
                    >
                      {emailRequestPending
                        ? "처리 중"
                        : cooldown
                          ? `${cooldown}초`
                          : emailState === "code"
                            ? "다시 받기"
                            : "인증하기"}
                    </Button>
                  ))}
              </div>
              {step === "signup" && (
                <p className="auth-note" id="auth-email-status" role="status">
                  {emailRequestPending
                    ? "인증 요청을 처리하고 있습니다. 잠시만 기다려 주세요."
                    : verified
                      ? "이메일을 변경하면 다시 인증해야 합니다."
                      : emailState === "code"
                        ? "인증 코드가 전송되었습니다."
                        : emailState === "recovery"
                          ? "인증 결과를 확인하지 못했습니다. 기존 계정 인증 또는 로그인에서 확인하세요."
                          : emailState === "expired"
                            ? "인증이 만료됐습니다. 기존 계정 인증 또는 로그인으로 이어가세요."
                            : "이메일 인증으로 가입을 시작합니다."}
                </p>
              )}
              {step === "signup" && emailState === "code" && (
                <div className="auth-inline-code auth-field">
                  <label className="sr-only" htmlFor="auth-code">
                    이메일 인증 코드
                  </label>
                  <div className="auth-inline-control">
                    <input
                      ref={codeInput}
                      id="auth-code"
                      className="auth-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      disabled={!!busy}
                      placeholder="이메일 인증 코드"
                    />
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={confirmCode}
                      disabled={!!busy || !/^\d{6}$/.test(code) || codeExpired}
                    >
                      {busy === "verify" ? "확인 중" : "확인"}
                    </Button>
                  </div>
                  {codeExpired && (
                    <p className="auth-error" role="alert">
                      코드가 만료됐습니다. 새 코드를 받아 주세요.
                    </p>
                  )}
                </div>
              )}
              {step === "signup" && emailError && (
                <p className="auth-error" role="alert">
                  {emailError}
                </p>
              )}
            </div>
          )}
          {step === "login" && (
            <div className="auth-field">
              <label className="sr-only" htmlFor="auth-password">
                비밀번호
              </label>
              <div className="auth-password-control">
                <input
                  ref={passwordInput}
                  id="auth-password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={!!busy}
                  placeholder="비밀번호"
                />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={
                    passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"
                  }
                  aria-pressed={passwordVisible}
                  aria-controls="auth-password"
                  disabled={!!busy}
                  onClick={() => setPasswordVisible((value) => !value)}
                >
                  {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}
          {step === "signup" && (
            <>
              <div className="auth-field">
                <label className="sr-only" htmlFor="auth-password">
                  비밀번호
                </label>
                <input
                  ref={passwordInput}
                  id="auth-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={!verified || !!busy}
                  placeholder="비밀번호"
                  aria-describedby="auth-password-rules auth-password-note"
                />
                <ul id="auth-password-rules" className="auth-rules">
                  <li data-valid={rules.length}>
                    <Check size={14} aria-hidden="true" /> 8자 이상
                  </li>
                  <li data-valid={rules.symbol}>
                    <Check size={14} aria-hidden="true" /> 특수문자 1개 이상
                  </li>
                </ul>
                <p className="auth-note" id="auth-password-note">
                  {verified
                    ? "최대 256자이며, 공백을 넣을 수 없어요."
                    : "이메일 인증 후 입력할 수 있어요."}
                </p>
              </div>
              <div className="auth-field">
                <label className="sr-only" htmlFor="auth-repeat">
                  비밀번호 확인
                </label>
                <input
                  id="auth-repeat"
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(event) => setRepeat(event.target.value)}
                  required
                  disabled={!verified || !!busy}
                  placeholder="비밀번호 확인"
                  aria-invalid={mismatch}
                  aria-describedby={mismatch ? "auth-mismatch" : undefined}
                />
                {mismatch && (
                  <p className="auth-error" id="auth-mismatch">
                    비밀번호가 일치하지 않습니다.
                  </p>
                )}
              </div>
            </>
          )}
          {step === "legacy-code" && (
            <div className="auth-field">
              <label className="sr-only" htmlFor="auth-code">
                이메일 인증 코드
              </label>
              <input
                ref={codeInput}
                id="auth-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                disabled={!!busy}
                placeholder="이메일 인증 코드"
              />
            </div>
          )}
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <Button
            className="auth-submit"
            type="submit"
            disabled={
              !!busy ||
              (step === "login" && (!email.trim() || !password)) ||
              (step === "signup" &&
                (!verified ||
                  !rules.valid ||
                  !repeat ||
                  password !== repeat)) ||
              (step === "legacy-code" && !/^\d{6}$/.test(code)) ||
              (step === "legacy-email" && cooldown > 0)
            }
          >
            {busy ? (
              <>
                <Spinner /> {busy === "login" ? "로그인 중" : "처리 중"}
              </>
            ) : (
              <>
                {step === "signup"
                  ? "회원가입 완료"
                  : step === "login"
                    ? "로그인"
                    : step === "legacy-email"
                      ? cooldown
                        ? `${cooldown}초 후 코드 받기`
                        : "인증 코드 받기"
                      : step === "legacy-code"
                        ? "인증 완료하기"
                        : "로그인으로 이동"}
                <ArrowRight size={16} />
              </>
            )}
          </Button>
        </form>
        {step === "login" ? (
          <div className="auth-links auth-login-links">
            <button
              className="text-button"
              type="button"
              disabled={!!busy}
              onClick={() => move("signup")}
            >
              회원가입
            </button>
            <div className="auth-login-links-secondary">
              <button
                className="text-button"
                type="button"
                disabled={!!busy}
                onClick={() => move("legacy-email")}
              >
                기존 이메일 인증
              </button>
              <button
                className="text-button"
                type="button"
                disabled={!!busy}
                aria-expanded={recoveryHelp}
                aria-controls={recoveryHelp ? "auth-recovery-help" : undefined}
                onClick={() => setRecoveryHelp((value) => !value)}
              >
                비밀번호 찾기
              </button>
            </div>
            {recoveryHelp && (
              <p
                className="auth-note auth-recovery"
                id="auth-recovery-help"
                role="status"
              >
                비밀번호 재설정은 현재 이 화면에서 지원하지 않아요.
              </p>
            )}
          </div>
        ) : (
          <div className="auth-links auth-compact-links">
            {step === "signup" && (
              <button
                className="text-button"
                type="button"
                disabled={!!busy}
                onClick={() => move("legacy-email")}
              >
                기존 이메일 인증
              </button>
            )}
            {step === "legacy-code" && (
              <button
                className="text-button"
                type="button"
                disabled={!!busy}
                onClick={() => move("legacy-email")}
              >
                코드 다시 받기
              </button>
            )}
            {step === "legacy-email" && (
              <button
                className="text-button"
                type="button"
                disabled={!!busy}
                onClick={() => {
                  if (emailInput.current?.reportValidity()) {
                    move("legacy-code");
                  }
                }}
              >
                이미 받은 코드 입력하기
              </button>
            )}
            {step !== "complete" && (
              <p>
                이미 계정이 있나요?{" "}
                <button
                  className="text-button"
                  type="button"
                  disabled={!!busy}
                  onClick={() => move("login")}
                >
                  로그인
                </button>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
