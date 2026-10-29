import { configureStore } from "@reduxjs/toolkit";

import auth from "@/features/auth/store/auth-slice";
import broadcasts from "@/features/broadcasts/store/broadcasts-slice";
import messaging from "@/features/messaging/store/messaging-slice";
import onboarding from "@/features/onboarding/store/onboarding-slice";
import workspace from "@/features/workspaces/store/workspace-slice";
import { createDraftListener } from "@/features/onboarding/store/draft-listener";
import { onboardingServices } from "@/features/onboarding/services/onboarding-service";
import type { OnboardingServices } from "@/features/onboarding/types/onboarding.types";

export const makeStore = (services: OnboardingServices = onboardingServices) => {
  const listener = createDraftListener(services.drafts);
  return configureStore({
    reducer: { auth, onboarding, workspace, broadcasts, messaging },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: services },
        // Kept chats hold up to 20 × 100 messages (plain JSON, replaced whole); the development-only
        // checks walking them on every action slowed the app, so they skip that part.
        serializableCheck: {
          ignoredPaths: ["messaging.threads"],
          ignoredActionPaths: ["payload.thread"],
        },
        immutableCheck: { ignoredPaths: ["messaging.threads"] },
      }).prepend(listener.middleware),
  });
};
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
