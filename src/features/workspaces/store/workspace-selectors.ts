import type { WorkspaceRootState } from "./create-workspace-thunks";

export const selectActiveWorkspace = (state: WorkspaceRootState) =>
  state.workspace.items.find((item) => item.id === state.workspace.activeId) ?? null;
