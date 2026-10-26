import { nanoid, type ThunkAction, type UnknownAction } from "@reduxjs/toolkit";
import { defaultWorkspaceChanged } from "../../auth/store/auth-slice";
import type { AuthUser } from "../../auth/types/auth.types";
import type { createWorkspaceApi } from "../services/workspace-api";
import type { WorkspaceState } from "../types/workspace.types";
import { workspaceActions as actions } from "./workspace-slice";

export interface WorkspaceRootState {
  auth: { user: AuthUser | null };
  workspace: WorkspaceState;
}
type WorkspaceThunk<R> = ThunkAction<
  R,
  WorkspaceRootState,
  unknown,
  UnknownAction
>;

export function createWorkspaceThunks(services: {
  api: ReturnType<typeof createWorkspaceApi>;
  getToken: () => string | null;
}) {
  function refreshWorkspace(id: string): WorkspaceThunk<Promise<void>> {
    return async (dispatch, getState) => {
      const userId = getState().auth.user?.id;
      const token = services.getToken();
      if (!userId || !token || getState().workspace.activeId !== id) return;
      const requestId = nanoid();
      dispatch(actions.detailStarted({ id, requestId }));
      const result = await services.api.detail(id, { token });
      if (getState().auth.user?.id !== userId || services.getToken() !== token)
        return;
      if (result.ok)
        dispatch(actions.detailReceived({ requestId, workspace: result.data }));
      else dispatch(actions.detailFailed({ requestId }));
    };
  }
  function loadWorkspaces(force = false): WorkspaceThunk<Promise<void>> {
    return async (dispatch, getState) => {
      const user = getState().auth.user;
      const token = services.getToken();
      const state = getState().workspace;
      if (!user || !token || state.requests.load || state.switchingId) return;
      if (!force && state.ownerId === user.id && state.status === "ready")
        return;
      const requestId = nanoid();
      dispatch(actions.loadStarted({ userId: user.id, requestId }));
      const result = await services.api.list({ token });
      if (
        getState().auth.user?.id !== user.id ||
        services.getToken() !== token ||
        getState().workspace.requests.load !== requestId
      )
        return;
      if (!result.ok) {
        dispatch(
          actions.loadFailed({
            requestId,
            message:
              "We couldn't load your workspaces. Check your connection and try again.",
          }),
        );
        return;
      }
      dispatch(
        actions.loaded({
          requestId,
          items: result.data,
          preferredIds: [user.defaultWorkspaceId, user.workspaceId],
        }),
      );
      const id = getState().workspace.activeId;
      if (id) await dispatch(refreshWorkspace(id));
    };
  }
  function switchWorkspace(id: string): WorkspaceThunk<Promise<boolean>> {
    return async (dispatch, getState) => {
      const user = getState().auth.user;
      const token = services.getToken();
      const state = getState().workspace;
      const target = state.items.find((item) => item.id === id);
      if (
        !user ||
        !token ||
        state.ownerId !== user.id ||
        state.switchingId ||
        state.requests.load ||
        !target ||
        target.status === "DISABLED"
      )
        return false;
      if (state.activeId === id) return true;
      const requestId = nanoid();
      dispatch(actions.switchStarted({ id, requestId }));
      const result = await services.api.setDefault(id, { token });
      if (
        getState().auth.user?.id !== user.id ||
        services.getToken() !== token ||
        getState().workspace.requests.switch !== requestId
      )
        return false;
      if (!result.ok) {
        dispatch(actions.switchFailed({ requestId }));
        return false;
      }
      dispatch(actions.switched({ id, requestId }));
      dispatch(defaultWorkspaceChanged({ userId: user.id, workspaceId: id }));
      await dispatch(refreshWorkspace(id));
      return (
        getState().auth.user?.id === user.id &&
        services.getToken() === token &&
        getState().workspace.activeId === id
      );
    };
  }
  return { loadWorkspaces, switchWorkspace, refreshWorkspace };
}
