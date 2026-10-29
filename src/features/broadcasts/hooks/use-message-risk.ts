import { useCallback, useEffect, useRef, useState } from "react";
import { useMessaging } from "@/features/messaging/providers/messaging-context";
import type { MessageRiskScore } from "@/features/messaging/types";

interface Analysis {
  content: string;
  controller: AbortController;
  loading: boolean;
  result: MessageRiskScore | null;
  error: string | null;
}

/**
 * "Analyze with AI", as the web's message risk: only `reanalyze` starts a request, and an edit makes the
 * result stale (and cancels a request still running for the old text).
 */
export function useMessageRisk(content: string, enabled: boolean) {
  const { api } = useMessaging();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const request = useRef<{ content: string; controller: AbortController } | null>(null);

  const reanalyze = useCallback(async () => {
    if (!enabled || request.current?.content === content) return;
    request.current?.controller.abort();
    const controller = new AbortController();
    request.current = { content, controller };
    setAnalysis({ content, controller, loading: true, result: null, error: null });
    try {
      const result = await api.scoreMessage(content, controller.signal);
      if (!controller.signal.aborted)
        setAnalysis({
          content,
          controller,
          loading: false,
          result: result.ok ? result.data : null,
          error: result.ok ? null : result.message || "Couldn't analyze this message. Try again.",
        });
    } catch {
      if (!controller.signal.aborted)
        setAnalysis({
          content,
          controller,
          loading: false,
          result: null,
          error: "Couldn't analyze this message. Try again.",
        });
    } finally {
      if (request.current?.controller === controller) request.current = null;
    }
  }, [api, content, enabled]);

  useEffect(
    () => () => {
      request.current?.controller.abort();
      request.current = null;
    },
    [content, enabled],
  );

  const current =
    enabled && analysis?.content === content && !analysis.controller.signal.aborted
      ? analysis
      : null;
  return {
    analyzing: current?.loading ?? false,
    stale: enabled && analysis !== null && current === null,
    result: current?.result ?? null,
    error: current?.error ?? null,
    reanalyze,
  };
}
