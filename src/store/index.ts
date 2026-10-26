import { configureStore } from "@reduxjs/toolkit";

import auth from "@/features/auth/store/auth-slice";
import onboarding from "@/features/onboarding/store/onboarding-slice";
import workspace from "@/features/workspaces/store/workspace-slice";
import { createDraftListener } from "@/features/onboarding/store/draft-listener";
import { onboardingServices } from "@/features/onboarding/services/onboarding-service";
import type { OnboardingServices } from "@/features/onboarding/types/onboarding.types";

export const makeStore = (
  services: OnboardingServices = onboardingServices,
) => {
  const listener = createDraftListener(services.drafts);
  return configureStore({
    reducer: { auth, onboarding, workspace },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: services } }).prepend(
        listener.middleware,
      ),
  });
};
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
