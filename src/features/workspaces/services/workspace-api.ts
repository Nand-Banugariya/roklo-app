import type {
  ApiResult,
  createApiClient,
  RequestOptions,
} from "@/services/api/create-client";
import type { Workspace } from "../types/workspace.types";

const invalid = (): ApiResult<never> => ({
  ok: false,
  reason: "failed",
  status: 0,
  message: "Invalid workspace response.",
});
const isWorkspace = (value: unknown): value is Workspace => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Workspace>;
  return (
    typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.name === "string"
  );
};

export function createWorkspaceApi(
  request: ReturnType<typeof createApiClient>,
) {
  return {
    async list(options: RequestOptions = {}): Promise<ApiResult<Workspace[]>> {
      const result = await request<unknown>("/workspaces", options);
      if (!result.ok) return result;
      if (!Array.isArray(result.data) || !result.data.every(isWorkspace))
        return invalid();
      return { ...result, data: result.data.filter((item) => !item.isDeleted) };
    },
    async detail(
      id: string,
      options: RequestOptions = {},
    ): Promise<ApiResult<Workspace>> {
      const result = await request<unknown>(
        `/workspaces/${encodeURIComponent(id)}`,
        options,
      );
      if (!result.ok) return result;
      return isWorkspace(result.data) &&
        result.data.id === id &&
        !result.data.isDeleted
        ? { ...result, data: result.data }
        : invalid();
    },
    setDefault: (id: string, options: RequestOptions = {}) =>
      request(`/workspaces/${encodeURIComponent(id)}/set-default`, {
        ...options,
        method: "PUT",
      }),
  };
}
