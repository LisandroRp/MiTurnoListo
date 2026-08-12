import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldBootstrapWorkspaceForSession,
  shouldShowBootstrapLoading
} from "./auth-bootstrap.ts";

test("shouldBootstrapWorkspaceForSession skips bootstrapping during password recovery", () => {
  assert.equal(
    shouldBootstrapWorkspaceForSession({
      bootstrappedUserId: null,
      hasPasswordRecoverySession: true,
      sessionUserId: "user-1"
    }),
    false
  );
});

test("shouldBootstrapWorkspaceForSession runs once per user session", () => {
  assert.equal(
    shouldBootstrapWorkspaceForSession({
      bootstrappedUserId: null,
      hasPasswordRecoverySession: false,
      sessionUserId: "user-1"
    }),
    true
  );
  assert.equal(
    shouldBootstrapWorkspaceForSession({
      bootstrappedUserId: "user-1",
      hasPasswordRecoverySession: false,
      sessionUserId: "user-1"
    }),
    false
  );
  assert.equal(
    shouldBootstrapWorkspaceForSession({
      bootstrappedUserId: "user-1",
      hasPasswordRecoverySession: false,
      sessionUserId: "user-2"
    }),
    true
  );
});

test("shouldShowBootstrapLoading keeps the dashboard visible for the current authenticated user", () => {
  assert.equal(
    shouldShowBootstrapLoading({
      currentStatus: "authenticated",
      currentUserId: "user-1",
      sessionUserId: "user-1"
    }),
    false
  );
  assert.equal(
    shouldShowBootstrapLoading({
      currentStatus: "loading",
      currentUserId: null,
      sessionUserId: "user-1"
    }),
    true
  );
  assert.equal(
    shouldShowBootstrapLoading({
      currentStatus: "authenticated",
      currentUserId: "user-1",
      sessionUserId: "user-2"
    }),
    true
  );
});
