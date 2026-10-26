import { apiRequest } from "@/services/api/client";

import { createAuthApi } from "./auth-api";

export const { sendOtp, resendOtp, verifyOtp, getMe, revokeSession } =
  createAuthApi(apiRequest);
