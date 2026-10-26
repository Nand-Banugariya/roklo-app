export type ApiError = {
  ok: false;
  reason: "failed" | "network" | "rate_limited" | "cancelled";
  status: number;
  message: string;
  retryAfter?: number;
};
export type ApiResult<T> = { ok: true; data: T; message: string } | ApiError;
export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Plain objects are JSON; FormData is passed through with its multipart boundary. */
  body?: object | FormData;
  auth?: boolean;
  signal?: AbortSignal;
  token?: string;
  /** Inbox endpoints return a bare body instead of the standard envelope. */
  envelope?: boolean;
}

export function createApiClient(options: {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: (token: string) => void;
  fetch?: typeof fetch;
  timeoutMs?: number;
}) {
  return async function request<T>(
    path: string,
    { method = "GET", body, auth = true, signal, token, envelope: unwrap = true }: RequestOptions = {},
  ): Promise<ApiResult<T>> {
    if (!options.baseUrl)
      return {
        ok: false,
        reason: "failed",
        status: 0,
        message: "Sign-in is unavailable right now. Please try again later.",
      };
    const usedToken = auth ? (token ?? options.getToken()) : null;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (usedToken) headers.Authorization = `Bearer ${usedToken}`;
    const multipart =
      typeof FormData !== "undefined" && body instanceof FormData;
    if (body && !multipart) headers["Content-Type"] = "application/json";
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, options.timeoutMs ?? 20000);
    try {
      const response = await (options.fetch ?? fetch)(
        `${options.baseUrl}${path}`,
        {
          method,
          headers,
          signal: controller.signal,
          ...(body && {
            body: multipart ? (body as FormData) : JSON.stringify(body),
          }),
        },
      );
      const json: unknown = await response.json().catch(() => null);
      const envelope =
        json && typeof json === "object"
          ? (json as Record<string, unknown>)
          : null;
      const rawMessage = envelope?.message;
      const message =
        typeof rawMessage === "string"
          ? rawMessage
          : Array.isArray(rawMessage) && typeof rawMessage[0] === "string"
            ? rawMessage[0]
            : "";
      if (response.ok && !unwrap) {
        return { ok: true, data: json as T, message };
      }
      if (response.ok && envelope?.success === true && "data" in envelope) {
        return { ok: true, data: envelope.data as T, message };
      }
      if (response.ok && envelope?.success === true && response.status < 300) {
        return { ok: true, data: undefined as T, message };
      }
      if (response.status === 401 && usedToken)
        options.onUnauthorized?.(usedToken);
      const wait = message.match(/(?:wait|try again in)\s+(\d+)\s*s/i);
      if (response.status === 429 || wait) {
        const rawRetry = Number(
          wait?.[1] ?? response.headers.get("retry-after"),
        );
        return {
          ok: false,
          reason: "rate_limited",
          status: response.status,
          message,
          retryAfter: rawRetry > 0 ? Math.ceil(rawRetry) : 60,
        };
      }
      return { ok: false, reason: "failed", status: response.status, message };
    } catch {
      return signal?.aborted
        ? { ok: false, reason: "cancelled", status: 0, message: "" }
        : {
            ok: false,
            reason: "network",
            status: 0,
            message:
              "We couldn’t connect. Check your internet connection and try again.",
          };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
}
