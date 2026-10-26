import type { AuthUser } from "../../auth/types/auth.types";
import type { ApiResult } from "../../../services/api/create-client";
import type { SetupStepId, UseCaseId } from "../constants";
import type { createOnboardingApi } from "../services/onboarding-api";

export interface SetupAnswers {
  workspaceName: string;
  name: string;
  email: string;
  emailVerified: boolean;
  industry: string;
  teamSize: string;
  useCases: UseCaseId[];
  volume: string;
  source: string;
}

export type WorkspaceLogo =
  | { kind: "native"; uri: string; name: string; type: string; size: number }
  | { kind: "web"; file: Blob; name: string; type: string; size: number };
export interface OnboardingOptions {
  logo?: WorkspaceLogo | null;
  includeWorkspace: boolean;
  inviteToken?: string;
}
export interface CallOptions {
  token?: string;
  signal?: AbortSignal;
}
export type OnboardingFailure = {
  ok: false;
  reason: "failed" | "network" | "cancelled" | "unauthorized" | "rate_limited";
  retryAfter?: number;
};
export type CompleteOnboardingResult =
  | { ok: true }
  | OnboardingFailure
  | { ok: false; reason: "already_onboarded" | "email_taken" | "invalid_logo" };
export type RequestEmailCodeResult =
  | { ok: true; otpRef: string }
  | { ok: true; alreadyVerified: true }
  | OnboardingFailure
  | { ok: false; reason: "email_taken" };
export type VerifyEmailCodeResult =
  | { ok: true }
  | OnboardingFailure
  | { ok: false; reason: "invalid_code" | "email_taken" };

export interface SavedSetup {
  version: 1;
  userId: string;
  answers: SetupAnswers;
  stepId: SetupStepId;
}
export interface DraftStorage {
  read(userId: string): Promise<SavedSetup | null>;
  save(draft: SavedSetup): Promise<unknown>;
  clear(userId: string): Promise<unknown>;
}
export interface OnboardingServices {
  api: ReturnType<typeof createOnboardingApi>;
  getMe(options: CallOptions): Promise<ApiResult<AuthUser>>;
  getToken(): string | null;
  drafts: DraftStorage;
  now(): number;
}
