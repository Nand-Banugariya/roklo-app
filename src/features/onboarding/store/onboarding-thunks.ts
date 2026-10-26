import { nanoid, type ThunkAction, type UnknownAction } from "@reduxjs/toolkit";
import {
  setUser,
  onboardingCompleted,
  profileEmailVerified,
} from "../../auth/store/auth-slice";
import type { AuthUser } from "../../auth/types/auth.types";
import {
  onboardingActions as actions,
  type OnboardingState,
} from "./onboarding-slice";
import type {
  OnboardingServices,
  WorkspaceLogo,
} from "../types/onboarding.types";
import {
  emailIdentity,
  isValidEmail,
  logoError,
  setupSteps,
  stripEmailAlias,
  validationError,
} from "../utils/validation";

export interface OnboardingRootState {
  auth: { user: AuthUser | null };
  onboarding: OnboardingState;
}
export type OnboardingThunk<R = void> = ThunkAction<
  R,
  OnboardingRootState,
  OnboardingServices,
  UnknownAction
>;
const EMAIL_TAKEN = "This email is already in use on another account.";

export function loadOnboarding(
  options: { force?: boolean; signal?: AbortSignal } = {},
): OnboardingThunk<Promise<void>> {
  return async (dispatch, getState, services) => {
    const { user } = getState().auth;
    const token = services.getToken();
    const existing = getState().onboarding;
    if (
      !user ||
      !token ||
      existing.status === "loading" ||
      existing.status === "submitting"
    )
      return;
    if (
      !options.force &&
      existing.ownerId === user.id &&
      ["ready", "completed"].includes(existing.status)
    )
      return;
    const requestId = nanoid();
    dispatch(actions.loadStarted({ userId: user.id, requestId }));
    const [result, saved] = await Promise.all([
      services.getMe({ token, signal: options.signal }),
      services.drafts.read(user.id).catch(() => null),
    ]);
    if (
      services.getToken() !== token ||
      getState().auth.user?.id !== user.id ||
      getState().onboarding.requests.load !== requestId
    )
      return;
    if (result.ok && result.data?.id === user.id) {
      dispatch(setUser(result.data));
      dispatch(actions.initialized({ requestId, user: result.data, saved }));
      if (result.data.isOnboarded)
        void services.drafts.clear(user.id).catch(() => undefined);
    } else
      dispatch(
        actions.loadFailed({
          requestId,
          message: "We couldn’t load your account. Please try again.",
        }),
      );
  };
}

export function sendOnboardingEmailCode(
  signal?: AbortSignal,
): OnboardingThunk<Promise<void>> {
  return async (dispatch, getState, services) => {
    const { user } = getState().auth;
    const token = services.getToken();
    const setup = getState().onboarding;
    if (
      !user ||
      !token ||
      setup.ownerId !== user.id ||
      setup.status !== "ready" ||
      ["sending", "verifying"].includes(setup.email.status)
    )
      return;
    if (!isValidEmail(setup.answers.email)) {
      dispatch(actions.emailErrorSet("Enter a valid email address."));
      return;
    }
    if (services.now() < setup.email.retryAvailableAt) {
      dispatch(
        actions.emailErrorSet("Please wait before requesting another code."),
      );
      return;
    }
    const email = stripEmailAlias(setup.answers.email);
    const requestId = nanoid();
    dispatch(actions.emailRequestStarted({ requestId, email }));
    const result = await services.api.requestEmailCode(email, {
      token,
      signal,
    });
    if (
      services.getToken() !== token ||
      getState().auth.user?.id !== user.id ||
      getState().onboarding.email.requestId !== requestId
    )
      return;
    if (result.ok) {
      const verified = "alreadyVerified" in result;
      dispatch(
        actions.emailRequested({
          requestId,
          ...(verified ? { verified: true } : { otpRef: result.otpRef }),
          retryAvailableAt: services.now() + 60000,
        }),
      );
      if (verified) dispatch(profileEmailVerified({ userId: user.id, email }));
    } else
      dispatch(
        actions.emailRequestFailed({
          requestId,
          message:
            result.reason === "email_taken"
              ? EMAIL_TAKEN
              : result.reason === "rate_limited"
                ? "Please wait before requesting another code."
                : "We couldn’t send the code. Please try again.",
          retryAvailableAt:
            result.reason === "rate_limited"
              ? services.now() + (result.retryAfter ?? 60) * 1000
              : setup.email.retryAvailableAt,
        }),
      );
  };
}

/** The OTP stays in this closure; it never enters Redux actions, state or draft storage. */
export function verifyOnboardingEmailCode(
  otp: string,
  signal?: AbortSignal,
): OnboardingThunk<Promise<void>> {
  return async (dispatch, getState, services) => {
    const { user } = getState().auth;
    const token = services.getToken();
    const setup = getState().onboarding;
    if (
      !user ||
      !token ||
      setup.ownerId !== user.id ||
      setup.status !== "ready" ||
      !setup.email.otpRef ||
      ["sending", "verifying"].includes(setup.email.status)
    )
      return;
    if (!/^\d{6}$/.test(otp)) {
      dispatch(actions.emailErrorSet("Enter the 6-digit verification code."));
      return;
    }
    const email = stripEmailAlias(setup.answers.email);
    if (emailIdentity(email) !== emailIdentity(setup.email.target ?? ""))
      return;
    const requestId = nanoid();
    dispatch(actions.emailVerificationStarted(requestId));
    const result = await services.api.verifyEmailCode(setup.email.otpRef, otp, {
      token,
      signal,
    });
    if (
      services.getToken() !== token ||
      getState().auth.user?.id !== user.id ||
      getState().onboarding.email.verifyId !== requestId
    )
      return;
    if (result.ok) {
      dispatch(actions.emailVerified({ requestId, email }));
      dispatch(profileEmailVerified({ userId: user.id, email }));
    } else
      dispatch(
        actions.emailVerificationFailed({
          requestId,
          emailTaken: result.reason === "email_taken",
          message:
            result.reason === "email_taken"
              ? EMAIL_TAKEN
              : result.reason === "invalid_code"
                ? "That code didn’t match or has expired."
                : "We couldn’t verify the code. Please try again.",
        }),
      );
  };
}

export function submitOnboarding(
  options: {
    logo?: WorkspaceLogo | null;
    inviteToken?: string;
    signal?: AbortSignal;
  } = {},
): OnboardingThunk<Promise<void>> {
  return async (dispatch, getState, services) => {
    const { user } = getState().auth;
    const token = services.getToken();
    const setup = getState().onboarding;
    if (
      !user ||
      !token ||
      setup.ownerId !== user.id ||
      setup.status !== "ready" ||
      ["sending", "verifying"].includes(setup.email.status)
    )
      return;
    const includeWorkspace = setup.includeWorkspace && !options.inviteToken;
    for (const step of setupSteps(includeWorkspace)) {
      const error = validationError(step, setup.answers);
      if (error) {
        dispatch(actions.validationFailed({ step, message: error }));
        return;
      }
    }
    const error = includeWorkspace ? logoError(options.logo) : null;
    if (error) {
      dispatch(actions.validationFailed({ step: "workspace", message: error }));
      return;
    }
    const requestId = nanoid();
    dispatch(actions.submitStarted(requestId));
    const current = () =>
      services.getToken() === token &&
      getState().auth.user?.id === user.id &&
      getState().onboarding.requests.submit === requestId;
    const result = await services.api.completeOnboarding(
      setup.answers,
      {
        logo: options.logo,
        includeWorkspace,
        inviteToken: options.inviteToken,
      },
      { token, signal: options.signal },
    );
    if (!current()) return;
    if (result.ok || result.reason === "already_onboarded") {
      const alreadyOnboarded = !result.ok;
      const profile = await services.getMe({ token, signal: options.signal });
      if (!current()) return;
      const refreshed = profile.ok && profile.data?.id === user.id;
      // A successful POST must not be resubmitted just because GET /auth/me fails.
      dispatch(
        actions.completed({
          requestId,
          alreadyOnboarded,
          profileRefreshFailed: !refreshed,
        }),
      );
      dispatch(
        onboardingCompleted({
          userId: user.id,
          profile: refreshed
            ? profile.data
            : alreadyOnboarded
              ? undefined
              : {
                  ...user,
                  name: setup.answers.name.trim(),
                  ...(setup.answers.emailVerified && {
                    email: stripEmailAlias(setup.answers.email),
                    isEmailVerified: true,
                  }),
                },
        }),
      );
    } else
      dispatch(
        actions.submitFailed({
          requestId,
          emailTaken: result.reason === "email_taken",
          message:
            result.reason === "email_taken"
              ? EMAIL_TAKEN
              : "We couldn’t finish setup. Your answers are saved; please try again.",
        }),
      );
  };
}
