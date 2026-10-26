import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { useRokloTheme } from "@/hooks/use-roklo-theme";
import { session } from "@/services/storage/session";
import { useAppDispatch } from "@/store/hooks";

import { getMe, revokeSession } from "../services/auth-service";
import {
  restorationFailed,
  restoring,
  setUser,
  signedOut,
} from "../store/auth-slice";
import type { AuthUser } from "../types/auth.types";

const Context = createContext<{
  completeSignIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  retryRestore: () => void;
} | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const dispatch = useAppDispatch();
  const { setColorScheme } = useRokloTheme();
  const [attempt, setAttempt] = useState(0);
  const applyTheme = useRef(setColorScheme);
  useEffect(() => {
    applyTheme.current = setColorScheme;
  }, [setColorScheme]);

  function adoptTheme(user: AuthUser) {
    const theme = user.preferences?.theme;
    if (theme === "light" || theme === "dark" || theme === "system")
      applyTheme.current(theme);
  }

  useEffect(() => session.subscribe(() => dispatch(signedOut())), [dispatch]);
  useEffect(() => {
    const controller = new AbortController();
    dispatch(restoring());
    void (async () => {
      try {
        const token = await session.restore();
        if (controller.signal.aborted) return;
        if (!token) {
          dispatch(signedOut());
          return;
        }
        const result = await getMe({ signal: controller.signal, token });
        if (controller.signal.aborted || session.getToken() !== token) return;
        if (result.ok && result.data?.id) {
          const theme = result.data.preferences?.theme;
          if (theme === "light" || theme === "dark" || theme === "system")
            applyTheme.current(theme);
          dispatch(setUser(result.data));
        } else if (
          !result.ok &&
          (result.status === 401 || result.status === 403)
        ) {
          await session.clear();
        } else dispatch(restorationFailed());
      } catch {
        if (!controller.signal.aborted) dispatch(restorationFailed());
      }
    })();
    return () => controller.abort();
  }, [attempt, dispatch]);

  async function completeSignIn(token: string, user: AuthUser) {
    try {
      await session.save(token);
    } catch (error) {
      void revokeSession(token);
      throw error;
    }
    adoptTheme(user);
    dispatch(setUser(user));
    // The verify response is enough to enter the app; fetch the full profile as on web.
    void getMe({ token }).then((result) => {
      if (result.ok && result.data?.id && session.getToken() === token)
        dispatch(setUser(result.data));
    });
  }

  async function signOut() {
    const token = session.getToken();
    dispatch(signedOut());
    applyTheme.current("system");
    await Promise.allSettled([
      session.clear(),
      ...(token ? [revokeSession(token)] : []),
    ]);
  }

  return (
    <Context.Provider
      value={{
        completeSignIn,
        signOut,
        retryRestore: () => setAttempt((value) => value + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(Context);
  if (!context) throw new Error("useAuthSession requires SessionProvider.");
  return context;
}
