import test from "node:test";
import assert from "node:assert/strict";

import { getWorkspaceLoadMode, shouldShowWorkspaceLoading, withWorkspaceLoadTimeout } from "./scheduling-workspace-cache.ts";

test("getWorkspaceLoadMode blocks loading for guests", () => {
  assert.equal(
    getWorkspaceLoadMode({
      authStatus: "guest",
      cachedScopes: ["profile"],
      cachedUserId: "user-1",
      currentUserId: null,
      requestedScope: "profile"
    }),
    "idle"
  );
});

test("getWorkspaceLoadMode treats another user's cache as empty", () => {
  assert.equal(
    getWorkspaceLoadMode({
      authStatus: "authenticated",
      cachedScopes: ["profile"],
      cachedUserId: "user-1",
      currentUserId: "user-2",
      requestedScope: "profile"
    }),
    "initial"
  );
});

test("getWorkspaceLoadMode refreshes cached scopes without initial loading", () => {
  assert.equal(
    getWorkspaceLoadMode({
      authStatus: "authenticated",
      cachedScopes: ["profile"],
      cachedUserId: "user-1",
      currentUserId: "user-1",
      requestedScope: "profile"
    }),
    "refresh"
  );
});

test("a workspace load error replaces the initial loading state", () => {
  assert.equal(shouldShowWorkspaceLoading({ hasLoadError: true, isLoading: false, isSnapshotScopePending: true }), false);
  assert.equal(shouldShowWorkspaceLoading({ hasLoadError: false, isLoading: false, isSnapshotScopePending: true }), true);
});

test("a stalled workspace request stops loading with a retryable error", async () => {
  await assert.rejects(
    withWorkspaceLoadTimeout(new Promise(() => {}), 1),
    /Refrescá la página/
  );
  assert.equal(await withWorkspaceLoadTimeout(Promise.resolve("loaded"), 100), "loaded");
});
