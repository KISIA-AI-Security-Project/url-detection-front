import {WebAuth as PublicSignupAuth} from './auth.js';
export class WebAuth extends PublicSignupAuth {
  login(email: string, password: string): Promise<void>;
  subscribe(listener: () => void): () => void;
  restoreSession(): Promise<boolean>;
  logout(): Promise<void>;
  startEmailVerification(email: string, intent: string): Promise<EmailVerification>;
  confirmEmailVerification(intent: string, code: string): Promise<EmailVerification>;
  resendEmailVerification(intent: string): Promise<EmailVerification>;
  completeRegistration(intent: string, password: string): Promise<EmailVerification>;
}
export interface EmailVerification {
  intent_id: string;
  status: 'code_sent' | 'verified' | 'complete';
  email?: string;
  expires_at?: number;
  retry_after_seconds?: number;
  masked_destination?: string;
  login_required?: boolean;
}
