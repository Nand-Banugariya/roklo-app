import type {
  ApiError,
  createApiClient,
} from "../../../services/api/create-client";
import type {
  CallOptions,
  CompleteOnboardingResult,
  OnboardingFailure,
  OnboardingOptions,
  RequestEmailCodeResult,
  SetupAnswers,
  VerifyEmailCodeResult,
} from "../types/onboarding.types";
import { emptyAnswers, logoError, stripEmailAlias } from "../utils/validation";

const failure = (error: ApiError): OnboardingFailure => ({
  ok: false,
  reason:
    error.status === 401 || error.status === 403
      ? "unauthorized"
      : error.reason,
  ...(error.retryAfter && { retryAfter: error.retryAfter }),
});

export function createOnboardingApi(
  apiRequest: ReturnType<typeof createApiClient>,
  createForm = () => new FormData(),
) {
  async function completeOnboarding(
    answers: SetupAnswers,
    options: OnboardingOptions,
    call: CallOptions = {},
  ): Promise<CompleteOnboardingResult> {
    const includeWorkspace = options.includeWorkspace && !options.inviteToken;
    if (includeWorkspace && logoError(options.logo))
      return { ok: false, reason: "invalid_logo" };
    const onboardingDto = Object.fromEntries(
      Object.entries({
        name: answers.name.trim(),
        email: answers.emailVerified ? stripEmailAlias(answers.email) : "",
        occupation: answers.industry,
        companySize: answers.teamSize,
        whatsappMessageVolume: answers.volume,
        referralSource: answers.source,
      }).filter(([, value]) => value !== ""),
    );
    const form = createForm();
    form.append("onboardingDto", JSON.stringify(onboardingDto));
    if (options.inviteToken) form.append("inviteToken", options.inviteToken);
    if (includeWorkspace) {
      form.append("workspaceName", answers.workspaceName.trim());
      const logo = options.logo;
      if (logo?.kind === "web")
        form.append("workspaceLogo", logo.file, logo.name);
      // React Native FormData accepts URI parts; no Blob/File conversion is needed.
      if (logo?.kind === "native")
        form.append("workspaceLogo", {
          uri: logo.uri,
          name: logo.name,
          type: logo.type,
        } as unknown as Blob);
    }
    const result = await apiRequest("/auth/onboarding", {
      ...call,
      method: "POST",
      body: form,
    });
    if (result.ok) return { ok: true };
    if (result.message === "User already onboarded")
      return { ok: false, reason: "already_onboarded" };
    if (result.message === "A user with this email already exists.")
      return { ok: false, reason: "email_taken" };
    return failure(result);
  }

  async function requestEmailCode(
    email: string,
    call: CallOptions = {},
  ): Promise<RequestEmailCodeResult> {
    const result = await apiRequest<{ otpRef?: string }>(
      "/settings/profile/email-verification/request",
      { ...call, method: "POST", body: { email: stripEmailAlias(email) } },
    );
    if (result.ok)
      return result.data?.otpRef
        ? { ok: true, otpRef: result.data.otpRef }
        : { ok: false, reason: "failed" };
    if (result.message === "This email is already verified")
      return { ok: true, alreadyVerified: true };
    if (result.message === "Email already exists")
      return { ok: false, reason: "email_taken" };
    return failure(result);
  }

  async function verifyEmailCode(
    otpRef: string,
    otp: string,
    call: CallOptions = {},
  ): Promise<VerifyEmailCodeResult> {
    const result = await apiRequest(
      "/settings/profile/email-verification/verify",
      { ...call, method: "POST", body: { otpRef, otp } },
    );
    if (result.ok) return { ok: true };
    if (result.message === "Invalid or expired verification code")
      return { ok: false, reason: "invalid_code" };
    if (result.message === "Email already exists")
      return { ok: false, reason: "email_taken" };
    return failure(result);
  }

  async function finishInviteeSetup(
    about: Pick<SetupAnswers, "name" | "email" | "emailVerified">,
    call: CallOptions = {},
  ) {
    const result = await completeOnboarding(
      { ...emptyAnswers(), ...about },
      { includeWorkspace: false },
      call,
    );
    return !result.ok && result.reason === "already_onboarded"
      ? { ok: true as const }
      : result;
  }
  return {
    completeOnboarding,
    requestEmailCode,
    verifyEmailCode,
    finishInviteeSetup,
  };
}
