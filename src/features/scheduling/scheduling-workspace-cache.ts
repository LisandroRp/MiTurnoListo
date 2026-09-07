export type WorkspaceLoadMode = "idle" | "initial" | "refresh";

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
