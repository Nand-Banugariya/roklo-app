export interface AuthUser {
  id: string;
  name: string | null;
  mobileNumber: string;
  email: string | null;
  isVerified: boolean;
  isEmailVerified: boolean;
  isOnboarded: boolean;
  workspaceId: string | null;
  defaultWorkspaceId?: string | null;
  hasOwnWorkspace?: boolean;
  occupation?: string | null;
  companySize?: string | null;
  whatsappMessageVolume?: string | null;
  referralSource?: string | null;
  role?: string | null;
  image?: string | null;
  preferences?: { theme?: string | null };
}
export interface OtpRequest {
  dial: string;
  phone: string;
  countryCode: string;
}
export type AuthFailure = {
  ok: false;
  reason: "failed" | "network" | "rate_limited" | "cancelled";
  retryAfter?: number;
  message?: string;
};
export type SendOtpResult =
  | { ok: true; channel: "sms"; otpRef: string }
  | { ok: true; channel: "email"; otpRef: string; email: string }
  | { ok: true; channel: "email_required" }
  | AuthFailure;
export type VerifyOtpResult =
  | { ok: true; next: "signed_in"; accessToken: string; user: AuthUser }
  | { ok: true; next: "mobile_code"; otpRef: string }
  | { ok: false; reason: "invalid_code"; message?: string; retryAfter?: never }
  | { ok: false; reason: "expired"; message?: string; retryAfter?: never }
  | AuthFailure;
