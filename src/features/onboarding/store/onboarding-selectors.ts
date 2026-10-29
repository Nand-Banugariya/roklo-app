import type { OnboardingRootState } from "./onboarding-thunks";
import { setupSteps, validationError } from "../utils/validation";

export const selectOnboarding = (state: OnboardingRootState) => state.onboarding;
/** Keep fresh setup mounted for its success screen after auth becomes onboarded. */
export const selectShowOnboarding = (state: OnboardingRootState) =>
  !!state.auth.user &&
  (!state.auth.user.isOnboarded ||
    (state.onboarding.ownerId === state.auth.user.id &&
      state.onboarding.status === "completed" &&
      state.onboarding.completion === "created"));
export const selectSetupSteps = (state: OnboardingRootState) =>
  setupSteps(state.onboarding.includeWorkspace);
export const selectCanContinue = (state: OnboardingRootState) =>
  state.onboarding.status === "ready" &&
  !validationError(state.onboarding.stepId, state.onboarding.answers);
export const selectIsLastStep = (state: OnboardingRootState) =>
  selectSetupSteps(state).at(-1) === state.onboarding.stepId;
export const selectResendSeconds = (state: OnboardingRootState, now: number) =>
  Math.max(0, Math.ceil((state.onboarding.email.retryAvailableAt - now) / 1000));
