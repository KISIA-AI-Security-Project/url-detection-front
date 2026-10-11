import type { ServiceConfig } from "./contracts";
export class AuthenticationRequired extends Error {
  status: number;
}
export class SignupFailure extends Error {
  code: string;
  retry_after_seconds?: number;
}
export function signupPasswordRules(password: string): { length: boolean; symbol: boolean; valid: boolean };
export class WebAuth {
  static random(): string;
  constructor(config: ServiceConfig["auth"]);
  tokens: { access_token: string; expires_at: number } | null;
  login(email?: string, password?: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ confirmed: boolean; destination?: string }>;
  confirmSignUp(email: string, code: string): Promise<void>;
  resendSignUpCode(email: string): Promise<{ destination?: string }>;
  initialize(): Promise<boolean>;
  accessToken(): Promise<string>;
  logout(): void;
}
