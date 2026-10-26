import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { onboardingActions } from "../store/onboarding-slice";
import {
  loadOnboarding,
  sendOnboardingEmailCode,
  submitOnboarding,
  verifyOnboardingEmailCode,
} from "../store/onboarding-thunks";
import {
  selectCanContinue,
  selectIsLastStep,
  selectOnboarding,
} from "../store/onboarding-selectors";
import { setupSteps } from "../utils/validation";
import type { SetupAnswers, WorkspaceLogo } from "../types/onboarding.types";
import type { UseCaseId } from "../constants";

/** Shared controller for the setup screens. Navigation stays in the screen. */
export function useOnboarding() {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectOnboarding);
  const canContinue = useAppSelector(selectCanContinue);
  const isLastStep = useAppSelector(selectIsLastStep);
  return {
    ...state,
    steps: setupSteps(state.includeWorkspace),
    canContinue,
    isLastStep,
    initialize: (force = false) => dispatch(loadOnboarding({ force })),
    updateAnswers: (patch: Partial<Omit<SetupAnswers, "emailVerified">>) =>
      dispatch(onboardingActions.answersChanged(patch)),
    toggleUseCase: (value: UseCaseId) =>
      dispatch(onboardingActions.useCaseToggled(value)),
    next: () => dispatch(onboardingActions.nextStep()),
    back: () => dispatch(onboardingActions.previousStep()),
    skip: () => dispatch(onboardingActions.stepSkipped()),
    requestEmailCode: () => dispatch(sendOnboardingEmailCode()),
    clearEmailError: () => dispatch(onboardingActions.emailErrorSet(null)),
    verifyEmailCode: (otp: string) => dispatch(verifyOnboardingEmailCode(otp)),
    submit: (
      options: { logo?: WorkspaceLogo | null; inviteToken?: string } = {},
    ) => dispatch(submitOnboarding(options)),
  };
}
