import { createContext, useContext } from "react";

export type ShellPanel = "menu" | "workspaces" | "account" | "logout";
export const AppShellContext = createContext<{
  openPanel: (panel: ShellPanel) => void;
} | null>(null);
export function useAppShell() {
  const value = useContext(AppShellContext);
  if (!value) throw new Error("useAppShell requires AppShell.");
  return value;
}
