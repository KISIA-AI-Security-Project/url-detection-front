import { ServiceAuth } from "../components/ServiceAuth";
import { WebAuth, type EmailVerification } from "../service/session-auth.js";

const previewResult = (
  intent: string,
  status: EmailVerification["status"],
): EmailVerification => ({
  intent_id: intent,
  status,
  email: "test@example.com",
  expires_at: Date.now() + 10 * 60 * 1000,
  retry_after_seconds: 0,
  masked_destination: "t***@example.com",
  login_required: status === "complete",
});

const previewAuth = {
  login: async () => undefined,
  startEmailVerification: async (_email: string, intent: string) =>
    previewResult(intent, "code_sent"),
  resendEmailVerification: async (intent: string) =>
    previewResult(intent, "code_sent"),
  confirmEmailVerification: async (intent: string) =>
    previewResult(intent, "verified"),
  completeRegistration: async (intent: string) =>
    previewResult(intent, "complete"),
  resendSignUpCode: async (email: string) => ({ destination: email }),
  confirmSignUp: async () => undefined,
} as unknown as WebAuth;

export function AuthPreviewPage() {
  return (
    <main className="service-main auth-page-main">
      <ServiceAuth
        auth={previewAuth}
        initialStep="signup"
        previewState="signup-code"
        onBack={() => location.assign("/design-preview?screen=home")}
      />
    </main>
  );
}
