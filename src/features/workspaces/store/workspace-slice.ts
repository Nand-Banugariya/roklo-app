import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { setUser, signedOut } from "../../auth/store/auth-slice";
import type { Workspace, WorkspaceState } from "../types/workspace.types";

export const initialWorkspaceState = (): WorkspaceState => ({
  ownerId: null,
  items: [],
  activeId: null,
  status: "idle",
  error: null,
  detailError: null,
  switchingId: null,
  switchError: null,
  requests: { load: null, detail: null, switch: null },
});
const slice = createSlice({
  name: "workspace",
  initialState: initialWorkspaceState(),
  reducers: {
    loadStarted(state, { payload }: PayloadAction<{ userId: string; requestId: string }>) {
      if (state.ownerId !== payload.userId) Object.assign(state, initialWorkspaceState());
      state.ownerId = payload.userId;
      state.status = "loading";
      state.error = null;
      state.requests.load = payload.requestId;
    },
    loaded(
      state,
      {
        payload,
      }: PayloadAction<{
        requestId: string;
        items: Workspace[];
        preferredIds: (string | null | undefined)[];
      }>,
    ) {
      if (state.requests.load !== payload.requestId) return;
      state.items = payload.items;
      const ids = [state.activeId, ...payload.preferredIds];
      state.activeId =
        ids.find((id) => id && payload.items.some((item) => item.id === id)) ??
        payload.items.find((item) => item.isDefault)?.id ??
        payload.items.find((item) => item.status !== "DISABLED")?.id ??
        payload.items[0]?.id ??
        null;
      state.status = "ready";
      state.requests.load = null;
      state.detailError = null;
    },
    loadFailed(state, { payload }: PayloadAction<{ requestId: string; message: string }>) {
      if (state.requests.load !== payload.requestId) return;
      state.requests.load = null;
      state.status = "error";
      state.error = payload.message;
    },
    detailStarted(state, { payload }: PayloadAction<{ id: string; requestId: string }>) {
      if (state.activeId !== payload.id) return;
      state.requests.detail = payload.requestId;
      state.detailError = null;
    },
    detailReceived(state, { payload }: PayloadAction<{ requestId: string; workspace: Workspace }>) {
      if (state.requests.detail !== payload.requestId || state.activeId !== payload.workspace.id)
        return;
      const index = state.items.findIndex((item) => item.id === payload.workspace.id);
      if (index >= 0) state.items[index] = { ...state.items[index], ...payload.workspace };
      state.requests.detail = null;
    },
    detailFailed(state, { payload }: PayloadAction<{ requestId: string }>) {
      if (state.requests.detail !== payload.requestId) return;
      state.requests.detail = null;
      state.detailError = "We couldn't refresh workspace details. Please try again.";
    },
    switchStarted(state, { payload }: PayloadAction<{ id: string; requestId: string }>) {
      state.switchingId = payload.id;
      state.requests.switch = payload.requestId;
      state.switchError = null;
      state.requests.detail = null;
    },
    switched(state, { payload }: PayloadAction<{ id: string; requestId: string }>) {
      if (state.requests.switch !== payload.requestId) return;
      state.activeId = payload.id;
      state.switchingId = null;
      state.requests.switch = null;
      state.detailError = null;
      state.items.forEach((item) => {
        item.isDefault = item.id === payload.id;
      });
    },
    switchFailed(state, { payload }: PayloadAction<{ requestId: string }>) {
      if (state.requests.switch !== payload.requestId) return;
      state.switchingId = null;
      state.requests.switch = null;
      state.switchError = "We couldn't switch workspaces. Please try again.";
    },
  },
  extraReducers: (builder) => {
    builder.addCase(signedOut, () => initialWorkspaceState());
    builder.addCase(setUser, (state, action) => {
      if (state.ownerId && state.ownerId !== action.payload.id) return initialWorkspaceState();
    });
  },
});
export const workspaceActions = slice.actions;
export default slice.reducer;
