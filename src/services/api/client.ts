import { env } from "@/config/env";
import { session } from "@/services/storage/session";

import { createApiClient } from "./create-client";

export const apiRequest = createApiClient({
  baseUrl: env.apiBaseUrl,
  getToken: session.getToken,
  onUnauthorized: session.invalidate,
});
