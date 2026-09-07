import test from "node:test";
import assert from "node:assert/strict";

import { getWorkspaceLoadMode } from "./scheduling-workspace-cache.ts";

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
