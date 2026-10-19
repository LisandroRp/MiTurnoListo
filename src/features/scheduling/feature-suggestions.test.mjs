import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const projectRoot = process.cwd();

function readProjectFile(path) {
  return readFileSync(new URL(path, `file://${projectRoot}/`), "utf8");
}

test("feature suggestions enforce one private submission per user and day", () => {
  const migration = readProjectFile("docs/feature-suggestions.sql");

  assert.equal(migration.includes("unique (user_id, submission_date)"), true);
  assert.equal(migration.includes("status in ('pending', 'done', 'rejected')"), true);
  assert.equal(migration.includes("enable row level security"), true);
  assert.equal(migration.includes("revoke all on table public.feature_suggestions from anon, authenticated"), true);
});

test("feature suggestion administration requires a server-side super admin check", () => {
  const route = readProjectFile("src/app/api/feature-suggestions/route.ts");
  const allSuggestionsHandler = route.slice(route.indexOf("async function loadAllSuggestions"));

  assert.equal(allSuggestionsHandler.includes('.from("super_admins")'), true);
  assert.equal(allSuggestionsHandler.includes('apiError("SUPER_ADMIN_FORBIDDEN"'), true);
  assert.equal(route.includes('error?.code === "23505"'), true);
  assert.equal(route.includes("export async function PATCH"), true);
  assert.equal(route.includes("await authorizeSuperAdmin(authResult.userId)"), true);
});

test("suggestions navigation is app-owned and the admin control stays permission gated", () => {
  const appShell = readProjectFile("src/features/scheduling/components/AppShell.tsx");
  const suggestionsView = readProjectFile("src/features/scheduling/components/SuggestionsView.tsx");
  const slugs = readProjectFile("src/lib/slugs.ts");

  assert.equal(appShell.includes('href: "/sugerencias"'), true);
  assert.equal(slugs.includes('"sugerencias"'), true);
  assert.equal(suggestionsView.includes("actions={isSuperAdmin ? ("), true);
  assert.equal(suggestionsView.includes("void getSuperAdminStatus()"), true);
});
