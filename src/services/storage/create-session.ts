export interface SessionStorage {
  read: () => Promise<string | null>;
  write: (token: string) => Promise<unknown>;
  remove: () => Promise<unknown>;
}

export function createSession(sessionStorage: SessionStorage) {
  let accessToken: string | null = null;
  let revision = 0;
  const listeners = new Set<() => void>();
  // Serialize writes/deletes so a slow save cannot restore a signed-out session.
  let storageQueue: Promise<unknown> = Promise.resolve();
  function persist(action: () => Promise<unknown>) {
    const task = storageQueue.catch(() => undefined).then(action);
    storageQueue = task;
    return task;
  }

  async function clear() {
    revision++;
    accessToken = null;
    for (const listener of listeners) listener();
    await persist(() => sessionStorage.remove());
  }

  return {
    getToken: () => accessToken,
    async restore() {
      const current = ++revision;
      const saved = await sessionStorage.read();
      if (current === revision) accessToken = saved;
      return accessToken;
    },
    async save(token: string) {
      const current = ++revision;
      await persist(() => sessionStorage.write(token));
      if (current !== revision) throw new Error("Session changed.");
      accessToken = token;
    },
    clear,
    invalidate(token: string) {
      if (token === accessToken) void clear().catch(() => undefined);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
