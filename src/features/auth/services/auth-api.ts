import type { ApiError, RequestOptions, createApiClient } from "@/services/api/create-client";

import type {
  AuthFailure,
  AuthUser,
  OtpRequest,
  SendOtpResult,
  VerifyOtpResult,
} from "../types/auth.types";

export function createAuthApi(apiRequest: ReturnType<typeof createApiClient>) {
  const USER_FACING = new Set([
    "This account has been deleted.",
    "This account has been banned. Please contact support.",
    "Access has been blocked by an administrator. Please contact support.",
    "Captcha verification failed. Please try again.",
  ]);
  function toFailure(error: ApiError): AuthFailure {
    return {
      ok: false,
      reason: error.reason,
      retryAfter: error.retryAfter,
      message:
        error.reason === "network" || error.status === 0 || USER_FACING.has(error.message)
          ? error.message || undefined
          : undefined,
    };
  }
  const mobileNumber = ({ dial, phone }: OtpRequest) => `${dial}${phone}`;
  interface SendResponse {
    otpRef?: string;
    emailRequired?: boolean;
    email?: string;
    emailVerificationStep?: boolean;
  }
  function sent(data: SendResponse | null | undefined): SendOtpResult {
    if (data?.emailRequired) return { ok: true, channel: "email_required" };
    if (!data?.otpRef) return { ok: false, reason: "failed" };
    if (data.emailVerificationStep)
      return data.email
        ? { ok: true, channel: "email", otpRef: data.otpRef, email: data.email }
        : { ok: false, reason: "failed" };
    return { ok: true, channel: "sms", otpRef: data.otpRef };
  }

  async function sendOtp(
    request: OtpRequest & { email?: string; captchaToken?: string },
    signal?: AbortSignal,
  ): Promise<SendOtpResult> {
    const result = await apiRequest<SendResponse>("/auth/login", {
      method: "POST",
      auth: false,
      signal,
      body: {
        mobileNumber: mobileNumber(request),
        country: request.countryCode.toUpperCase(),
        ...(request.email && { email: request.email.trim().toLowerCase() }),
        ...(request.captchaToken && { captchaToken: request.captchaToken }),
      },
    });
    return result.ok ? sent(result.data) : toFailure(result);
  }
  async function resendOtp(
    request: OtpRequest & { email?: string },
    signal?: AbortSignal,
  ): Promise<SendOtpResult> {
    const result = await apiRequest<SendResponse>("/auth/resend-otp", {
      method: "POST",
      auth: false,
      signal,
      body: {
        mobileNumber: mobileNumber(request),
        ...(request.email && { email: request.email }),
      },
    });
    return result.ok ? sent(result.data) : toFailure(result);
  }
  async function verifyOtp(
    request: OtpRequest & { code: string; otpRef: string },
    signal?: AbortSignal,
  ): Promise<VerifyOtpResult> {
    const result = await apiRequest<{
      accessToken?: string;
      user?: AuthUser;
      mobileVerificationRequired?: boolean;
      otpRef?: string;
    }>("/auth/verify-otp", {
      method: "POST",
      auth: false,
      signal,
      body: {
        mobileNumber: mobileNumber(request),
        otp: request.code,
        otpRef: request.otpRef,
      },
    });
    if (!result.ok) {
      if (result.message === "Invalid OTP.") return { ok: false, reason: "invalid_code" };
      if (["OTP has expired.", "Invalid OTP reference."].includes(result.message))
        return { ok: false, reason: "expired" };
      return toFailure(result);
    }
    if (result.data?.mobileVerificationRequired && result.data.otpRef)
      return { ok: true, next: "mobile_code", otpRef: result.data.otpRef };
    if (!result.data?.accessToken || !result.data.user?.id) return { ok: false, reason: "failed" };
    return {
      ok: true,
      next: "signed_in",
      accessToken: result.data.accessToken,
      user: result.data.user,
    };
  }
  const getMe = (options?: Pick<RequestOptions, "signal" | "token">) =>
    apiRequest<AuthUser>("/auth/me", options);
  const revokeSession = (token?: string) =>
    apiRequest<void>("/auth/logout", { method: "POST", token });

  return { sendOtp, resendOtp, verifyOtp, getMe, revokeSession };
}
