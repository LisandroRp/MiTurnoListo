export type WorkspaceLoadMode = "idle" | "initial" | "refresh";

export function shouldShowWorkspaceLoading({
  hasLoadError,
  isLoading,
  isSnapshotScopePending
}: {
  hasLoadError: boolean;
  isLoading: boolean;
  isSnapshotScopePending: boolean;
}) {
  return !hasLoadError && (isLoading || isSnapshotScopePending);
}

export async function withWorkspaceLoadTimeout<T>(operation: Promise<T>, timeoutMs = 20000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("La carga está demorando demasiado. Refrescá la página para intentarlo de nuevo.")), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function getWorkspaceLoadMode({
  authStatus,
  cachedScopes,
  currentUserId,
  requestedScope,
  cachedUserId
}: {
  authStatus: string;
  cachedScopes: string[];
  currentUserId: string | null;
  requestedScope: string;
  cachedUserId: string | null;
}): WorkspaceLoadMode {
  if (authStatus !== "authenticated" || !currentUserId) {
    return "idle";
  }

  if (cachedUserId !== currentUserId) {
    return "initial";
  }

  return cachedScopes.includes(requestedScope) ? "refresh" : "initial";
}
