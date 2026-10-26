import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { setUser, signedOut } from "../../auth/store/auth-slice";
import type { DraftStorage } from "../types/onboarding.types";
import type { OnboardingRootState } from "./onboarding-thunks";
import { onboardingActions as actions } from "./onboarding-slice";

export function createDraftListener(drafts: DraftStorage) {
  const listener = createListenerMiddleware<OnboardingRootState>();
  listener.startListening({
    matcher: isAnyOf(
      actions.answersChanged,
      actions.useCaseToggled,
      actions.nextStep,
      actions.previousStep,
      actions.stepSkipped,
      actions.emailVerified,
      actions.emailRequested,
      actions.completed,
      actions.resetOnboarding,
      signedOut,
      setUser,
    ),
    effect: async (action, api) => {
      // getOriginalState must be read synchronously, before awaiting storage.
      const previous = api.getOriginalState().onboarding;
      const current = api.getState().onboarding;
      try {
        if (
          previous.ownerId &&
          (signedOut.match(action) ||
            actions.resetOnboarding.match(action) ||
            actions.completed.match(action) ||
            (setUser.match(action) && previous.ownerId !== action.payload.id))
        ) {
          await drafts.clear(previous.ownerId);
        } else if (current.ownerId && current.status === "ready") {
          await drafts.save({
            version: 1,
            userId: current.ownerId,
            answers: current.answers,
            stepId: current.stepId,
          });
        }
      } catch {
        /* Draft storage is optional; the current in-memory flow still works. */
      }
    },
  });
  return listener;
}
