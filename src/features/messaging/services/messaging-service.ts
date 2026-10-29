import { apiRequest } from "@/services/api/client";
import { createMessagingThunks } from "../store/messaging-thunks";
import { createMessagingApi } from "./messaging-api";

// The app's inbox thunks, on the shared API client, as the broadcasts service makes its own.
export const { loadConversations, loadNumbers } = createMessagingThunks({
  api: (workspaceId) => createMessagingApi(apiRequest, workspaceId),
});
