import { apiRequest } from "@/services/api/client";
import { session } from "@/services/storage/session";
import { createWorkspaceThunks } from "../store/create-workspace-thunks";
import { createWorkspaceApi } from "./workspace-api";

export const workspaceApi = createWorkspaceApi(apiRequest);
export const { loadWorkspaces, switchWorkspace, refreshWorkspace } = createWorkspaceThunks({
  api: workspaceApi,
  getToken: session.getToken,
});
