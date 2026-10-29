import type { DraftStorage, SavedSetup } from "../types/onboarding.types";

export function createSetupDrafts(storage: {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<unknown>;
  remove(key: string): Promise<unknown>;
}): DraftStorage {
  let queue: Promise<unknown> = Promise.resolve();
  const key = (userId: string) =>
    `roklo.setup.${Array.from(userId, (char) => char.codePointAt(0)!.toString(16).padStart(6, "0")).join("")}`;
  function mutate(action: () => Promise<unknown>) {
    const task = queue.catch(() => undefined).then(action);
    queue = task;
    return task;
  }
  return {
    async read(userId) {
      await queue.catch(() => undefined);
      try {
        const raw = await storage.read(key(userId));
        const saved: unknown = raw ? JSON.parse(raw) : null;
        if (!saved || typeof saved !== "object") return null;
        const draft = saved as Partial<SavedSetup>;
        return draft.version === 1 &&
          draft.userId === userId &&
          draft.answers &&
          typeof draft.answers === "object" &&
          typeof draft.stepId === "string"
          ? (draft as SavedSetup)
          : null;
      } catch {
        return null;
      }
    },
    save: (draft) => mutate(() => storage.write(key(draft.userId), JSON.stringify(draft))),
    clear: (userId) => mutate(() => storage.remove(key(userId))),
  };
}
