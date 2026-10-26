import { useCallback, useEffect, useRef, useState } from "react";
import { useMessaging } from "../providers/messaging-context";
import type { RephraseTone } from "../utils/ai-rephrase";

/** Keeps edits, sends, mode changes and navigation safe from a late AI response. */
export function useAiRephrase({ value, onValue, enabled, contextKey, maxLength, transform }: {
  value: string;
  onValue: (text: string) => void;
  enabled: boolean;
  contextKey: string;
  maxLength: number;
  transform: (text: string) => string;
}) {
  const { api } = useMessaging();
  const request = useRef<AbortController | null>(null);
  const latest = useRef(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ original: string; next: string } | null>(null);
  const cancel = useCallback(() => {
    request.current?.abort();
    request.current = null;
    setBusy(false);
  }, []);
  const reset = useCallback(() => {
    cancel();
    setLast(null);
    setError(null);
  }, [cancel]);

  useEffect(() => {
    if (latest.current !== value) {
      latest.current = value;
      cancel();
      setError(null);
      setLast((previous) => previous?.next === value ? previous : null);
    }
  }, [value, cancel]);
  // Leaving this reply context cancels its request and discards its Undo history.
  useEffect(() => reset, [api, contextKey, enabled, reset]);

  const canRephrase = enabled && !!value.trim() && value.length <= maxLength;
  async function rephrase(tone?: RephraseTone) {
    if (!canRephrase || request.current) return;
    const original = value;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      const result = await api.rephrase(original.trim(), controller.signal, tone);
      if (request.current !== controller || controller.signal.aborted) return;
      request.current = null;
      setBusy(false);
      if (latest.current !== original) return;
      if (!result.ok) {
        setError(result.message || "Couldn't rephrase this message. Try again.");
        return;
      }
      const next = transform(result.data);
      if (next.length > maxLength) {
        setError("The rephrased message is too long. Shorten your draft and try again.");
        return;
      }
      onValue(next);
      setLast({ original, next });
    } catch {
      if (request.current !== controller) return;
      request.current = null;
      setBusy(false);
      setError("Couldn't rephrase this message. Try again.");
    }
  }
  function undo() {
    if (!last || value !== last.next) return;
    cancel();
    onValue(last.original);
    setLast(null);
    setError(null);
  }
  return { busy, error, canRephrase, rephrase, cancel, reset, rephrased: last !== null && value === last.next, undo, keep: () => setLast(null) };
}
