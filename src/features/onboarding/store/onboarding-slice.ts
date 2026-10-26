import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { setUser, signedOut } from "../../auth/store/auth-slice";
import type { AuthUser } from "../../auth/types/auth.types";
import type { SetupStepId, UseCaseId } from "../constants";
import type { SavedSetup, SetupAnswers } from "../types/onboarding.types";
import {
  emailIdentity,
  emptyAnswers,
  prefillAnswers,
  setupSteps,
  validationError,
} from "../utils/validation";

export interface OnboardingState {
  ownerId: string | null;
  status: "idle" | "loading" | "ready" | "submitting" | "completed" | "error";
  includeWorkspace: boolean;
  answers: SetupAnswers;
  stepId: SetupStepId;
  error: string | null;
  completion: "created" | "already_onboarded" | null;
  profileRefreshFailed: boolean;
  requests: { load: string | null; submit: string | null };
  email: {
    status: "idle" | "sending" | "sent" | "verifying" | "verified" | "error";
    target: string | null;
    otpRef: string | null;
    requestId: string | null;
    verifyId: string | null;
    retryAvailableAt: number;
    error: string | null;
  };
}
const emptyEmail = (): OnboardingState["email"] => ({
  status: "idle",
  target: null,
  otpRef: null,
  requestId: null,
  verifyId: null,
  retryAvailableAt: 0,
  error: null,
});
export const initialOnboardingState = (): OnboardingState => ({
  ownerId: null,
  status: "idle",
  includeWorkspace: true,
  answers: emptyAnswers(),
  stepId: "workspace",
  error: null,
  completion: null,
  profileRefreshFailed: false,
  requests: { load: null, submit: null },
  email: emptyEmail(),
});
const slice = createSlice({
  name: "onboarding",
  initialState: initialOnboardingState(),
  reducers: {
    loadStarted(
      state,
      action: PayloadAction<{ userId: string; requestId: string }>,
    ) {
      if (state.ownerId !== action.payload.userId)
        Object.assign(state, initialOnboardingState());
      state.ownerId = action.payload.userId;
      state.status = "loading";
      state.error = null;
      state.requests.load = action.payload.requestId;
    },
    initialized(
      state,
      action: PayloadAction<{
        requestId: string;
        user: AuthUser;
        saved: SavedSetup | null;
      }>,
    ) {
      if (
        state.requests.load !== action.payload.requestId ||
        state.ownerId !== action.payload.user.id
      )
        return;
      const { user, saved } = action.payload;
      state.requests.load = null;
      state.status = user.isOnboarded ? "completed" : "ready";
      state.includeWorkspace = user.hasOwnWorkspace !== false;
      state.answers = prefillAnswers(user, saved);
      const steps = setupSteps(state.includeWorkspace);
      state.stepId =
        saved?.userId === user.id && steps.includes(saved.stepId)
          ? saved.stepId
          : steps[0];
      state.email = emptyEmail();
      if (state.answers.emailVerified) state.email.status = "verified";
    },
    loadFailed(
      state,
      action: PayloadAction<{ requestId: string; message: string }>,
    ) {
      if (state.requests.load !== action.payload.requestId) return;
      state.requests.load = null;
      state.status = "error";
      state.error = action.payload.message;
    },
    answersChanged(
      state,
      action: PayloadAction<Partial<Omit<SetupAnswers, "emailVerified">>>,
    ) {
      if (state.status !== "ready") return;
      const patch = action.payload;
      if (patch.email !== undefined && patch.email !== state.answers.email) {
        state.email = emptyEmail();
        state.answers.emailVerified = false;
      }
      // Explicit fields prevent callers or restored data from setting a verified flag.
      for (const key of [
        "workspaceName",
        "name",
        "email",
        "industry",
        "teamSize",
        "volume",
        "source",
      ] as const) {
        if (typeof patch[key] === "string") state.answers[key] = patch[key];
      }
      if (patch.useCases) state.answers.useCases = [...new Set(patch.useCases)];
      state.error = null;
    },
    useCaseToggled(state, action: PayloadAction<UseCaseId>) {
      if (state.status !== "ready") return;
      const cases = state.answers.useCases;
      state.answers.useCases = cases.includes(action.payload)
        ? cases.filter((value) => value !== action.payload)
        : [...cases, action.payload];
    },
    nextStep(state) {
      if (state.status !== "ready") return;
      state.error = validationError(state.stepId, state.answers);
      if (state.error) return;
      const steps = setupSteps(state.includeWorkspace);
      state.stepId =
        steps[Math.min(steps.indexOf(state.stepId) + 1, steps.length - 1)];
    },
    previousStep(state) {
      if (state.status !== "ready") return;
      const steps = setupSteps(state.includeWorkspace);
      state.stepId = steps[Math.max(0, steps.indexOf(state.stepId) - 1)];
      state.error = null;
    },
    stepSkipped(state) {
      if (state.status !== "ready") return;
      if (state.stepId === "business") {
        state.answers.industry = "";
        state.answers.teamSize = "";
      } else if (state.stepId === "usage") {
        state.answers.useCases = [];
        state.answers.volume = "";
      } else if (state.stepId === "source") state.answers.source = "";
      else return;
      const steps = setupSteps(state.includeWorkspace);
      state.stepId =
        steps[Math.min(steps.indexOf(state.stepId) + 1, steps.length - 1)];
      state.error = null;
    },
    emailRequestStarted(
      state,
      action: PayloadAction<{ requestId: string; email: string }>,
    ) {
      state.email = {
        ...emptyEmail(),
        status: "sending",
        target: action.payload.email,
        requestId: action.payload.requestId,
        retryAvailableAt: state.email.retryAvailableAt,
      };
      state.answers.emailVerified = false;
    },
    emailRequested(
      state,
      action: PayloadAction<{
        requestId: string;
        otpRef?: string;
        verified?: boolean;
        retryAvailableAt: number;
      }>,
    ) {
      if (state.email.requestId !== action.payload.requestId) return;
      state.email.requestId = null;
      state.email.status = action.payload.verified ? "verified" : "sent";
      state.email.otpRef = action.payload.otpRef ?? null;
      state.email.retryAvailableAt = action.payload.retryAvailableAt;
      state.answers.emailVerified = !!action.payload.verified;
    },
    emailRequestFailed(
      state,
      action: PayloadAction<{
        requestId: string;
        message: string;
        retryAvailableAt: number;
      }>,
    ) {
      if (state.email.requestId !== action.payload.requestId) return;
      state.email.requestId = null;
      state.email.status = "error";
      state.email.error = action.payload.message;
      state.email.retryAvailableAt = action.payload.retryAvailableAt;
    },
    emailErrorSet(state, action: PayloadAction<string | null>) {
      state.email.error = action.payload;
    },
    emailVerificationStarted(state, action: PayloadAction<string>) {
      state.email.verifyId = action.payload;
      state.email.status = "verifying";
      state.email.error = null;
    },
    emailVerified(
      state,
      action: PayloadAction<{ requestId: string; email: string }>,
    ) {
      if (
        state.email.verifyId !== action.payload.requestId ||
        emailIdentity(state.answers.email) !==
          emailIdentity(action.payload.email)
      )
        return;
      state.answers.emailVerified = true;
      state.email = { ...emptyEmail(), status: "verified" };
    },
    emailVerificationFailed(
      state,
      action: PayloadAction<{
        requestId: string;
        message: string;
        emailTaken?: boolean;
      }>,
    ) {
      if (state.email.verifyId !== action.payload.requestId) return;
      state.email.verifyId = null;
      state.email.status = "error";
      state.email.error = action.payload.message;
      if (action.payload.emailTaken) state.email.otpRef = null;
    },
    submitStarted(state, action: PayloadAction<string>) {
      state.requests.submit = action.payload;
      state.status = "submitting";
      state.error = null;
    },
    submitFailed(
      state,
      action: PayloadAction<{
        requestId: string;
        message: string;
        emailTaken?: boolean;
      }>,
    ) {
      if (state.requests.submit !== action.payload.requestId) return;
      state.requests.submit = null;
      state.status = "ready";
      state.error = action.payload.message;
      if (action.payload.emailTaken) {
        state.stepId = "you";
        state.answers.emailVerified = false;
        state.email = { ...emptyEmail(), error: action.payload.message };
      }
    },
    validationFailed(
      state,
      action: PayloadAction<{ step: SetupStepId; message: string }>,
    ) {
      if (state.status !== "ready") return;
      state.stepId = action.payload.step;
      state.error = action.payload.message;
    },
    completed(
      state,
      action: PayloadAction<{
        requestId: string;
        alreadyOnboarded: boolean;
        profileRefreshFailed: boolean;
      }>,
    ) {
      if (state.requests.submit !== action.payload.requestId) return;
      state.requests.submit = null;
      state.status = "completed";
      state.completion = action.payload.alreadyOnboarded
        ? "already_onboarded"
        : "created";
      state.profileRefreshFailed = action.payload.profileRefreshFailed;
      state.email = emptyEmail();
    },
    completionDismissed(state) {
      if (state.status === "completed") state.completion = null;
    },
    resetOnboarding: () => initialOnboardingState(),
  },
  extraReducers: (builder) => {
    builder.addCase(signedOut, () => initialOnboardingState());
    builder.addCase(setUser, (state, action) => {
      if (state.ownerId && state.ownerId !== action.payload.id)
        return initialOnboardingState();
    });
  },
});
export const onboardingActions = slice.actions;
export default slice.reducer;
