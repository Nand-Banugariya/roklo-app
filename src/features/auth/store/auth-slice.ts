import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AuthUser } from "../types/auth.types";

interface AuthState {
  user: AuthUser | null;
  status: "restoring" | "signedOut" | "signedIn" | "restoreError";
}
const initialState: AuthState = { user: null, status: "restoring" };
const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      const completed = state.user?.id === action.payload.id && state.user.isOnboarded;
      state.user = {
        ...action.payload,
        isOnboarded: !!completed || action.payload.isOnboarded,
      };
      state.status = "signedIn";
    },
    onboardingCompleted(state, action: PayloadAction<{ userId: string; profile?: AuthUser }>) {
      if (state.user?.id !== action.payload.userId) return;
      state.user = {
        ...state.user,
        ...action.payload.profile,
        isOnboarded: true,
      };
    },
    profileEmailVerified(state, action: PayloadAction<{ userId: string; email: string }>) {
      if (state.user?.id !== action.payload.userId) return;
      state.user.email = action.payload.email;
      state.user.isEmailVerified = true;
    },
    defaultWorkspaceChanged(state, action: PayloadAction<{ userId: string; workspaceId: string }>) {
      if (state.user?.id === action.payload.userId)
        state.user.defaultWorkspaceId = action.payload.workspaceId;
    },
    signedOut(state) {
      state.user = null;
      state.status = "signedOut";
    },
    restorationFailed(state) {
      state.status = "restoreError";
    },
    restoring(state) {
      state.status = "restoring";
    },
  },
});
export const {
  setUser,
  signedOut,
  restorationFailed,
  restoring,
  onboardingCompleted,
  profileEmailVerified,
  defaultWorkspaceChanged,
} = slice.actions;
export default slice.reducer;
