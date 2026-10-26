import { useEffect, useState } from "react";
import { AppState } from "react-native";

// Absolute deadlines survive app backgrounding, unlike decrementing a counter.
export function useCountdown(deadline: number) {
  const [now, setNow] = useState(Date.now);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      subscription.remove();
    };
  }, [deadline]);
  return seconds;
}
