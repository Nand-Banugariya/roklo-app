import { createMessagingApi } from "@/features/messaging/services/messaging-api";
import { apiRequest } from "@/services/api/client";
import { createBroadcastsThunks } from "../store/broadcasts-thunks";
import { createBroadcastsApi } from "./broadcasts-api";

// The app's broadcast thunks, on the shared API client, as the workspace service makes its own.
export const {
  loadBroadcasts,
  setBroadcastsQuery,
  loadBroadcast,
  loadOlderRuns,
  loadRun,
  pauseBroadcast,
  resumeBroadcast,
  sendBroadcastNow,
  duplicateBroadcast,
  updateBroadcastTags,
  updateBroadcastMessage,
  loadBroadcastMessage,
  removeBroadcast,
  createBroadcast,
  updateBroadcast,
  loadDraft,
  loadTags,
  createTag,
  searchAudience,
  loadMoreContacts,
  postableGroups,
  loadAccessTargets,
} = createBroadcastsThunks({
  api: (workspaceId) => createBroadcastsApi(apiRequest, workspaceId),
  messaging: (workspaceId) => createMessagingApi(apiRequest, workspaceId),
});
