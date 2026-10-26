import { apiRequest } from "@/services/api/client";
import { onboardingStorage } from "@/services/storage/onboarding-storage";
import { session } from "@/services/storage/session";
import { getMe } from "@/features/auth/services/auth-service";
import type { OnboardingServices } from "../types/onboarding.types";
import { createOnboardingApi } from "./onboarding-api";
import { createSetupDrafts } from "./draft-persistence";

export const onboardingApi = createOnboardingApi(apiRequest);
export const onboardingServices: OnboardingServices = {
  api: onboardingApi,
  getMe,
  getToken: session.getToken,
  drafts: createSetupDrafts(onboardingStorage),
  now: () => Date.now(),
};
