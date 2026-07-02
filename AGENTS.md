# Delivery Framework - Front-End

## 1. Purpose

Define how the `front-end` stack is planned, implemented, validated, and handed off with the `back-end` stack.

This framework ensures delivery of high-quality, secure, and maintainable UI code under `SOLID`, `Clean Code`, and `Security by Design` principles.

## 2. Scope

- Main stack: `front-end`.
- Upstream dependency: `back-end`.
- Baseline stack: Next.js (App Router), React, TypeScript, Tailwind CSS, Zod.

### 2.1 Technological Limits

- Allowed implementation stack is limited to Next.js, React, TypeScript, Tailwind CSS, Zod, and React Hook Form.
- Icons in application code must come from `react-icons` (no inline SVG icons unless explicitly approved by a human).
- Introducing new libraries, patterns, or tools requires explicit human approval.
- UI primitives must be built as reusable first-party components under `src/components/ui`.
- UI colors must consume semantic design tokens.
- In `src/app/**`, `src/features/**`, and `src/components/composed/**`, direct hex values, named colors, and utility colors like `text-white`, `bg-black`, or `border-red-500` are not allowed.
- Dynamic `backgroundImage` usage is allowed when the use case requires it, but color values must still come from semantic tokens whenever color is involved.
- Exceptions are limited to third-party rendering APIs or asset-driven cases that cannot consume the token system directly.

### 2.2 Operational Limits

The agent may:

- Read and modify code under `src/`.
- Update TypeScript types and form schemas.
- Modify repository documentation (`AGENTS.md`, `README.md`, and docs if present).
- Execute validation commands (`lint`, `tsc`, tests, e2e tests).

The agent may not:

- Modify build or deployment configuration.
- Alter API contracts.
- Introduce a new styling system outside the approved stack (Tailwind CSS + shadcn/ui).
- Change architectural decisions.

### 2.3 Decisional Limits

- The agent does not redefine architecture.
- The agent does not decide validation or styling strategy.
- The agent does not override documented rules.
- Any ambiguity requires escalation.

## 3. Architecture

### 3.1 Runtime Context

- `front-end` is the presentation and interaction layer.
- `back-end` is the source of truth for data and permissions.

### 3.2 Structure

- App shell handles routing, bootstrapping, and global providers.
- Feature modules compose screens and interaction flows.
- Domain UI components keep reusable interaction behavior.
- Infrastructure handles HTTP clients, mappers, and error normalization.

### 3.3 State Model

- Local UI state remains component or feature scoped.
- Server state follows loading, success, and error lifecycle.
- Form strategy:
- Use Server Actions + FormData for simple forms.
- Use React Hook Form + Zod for complex client-side forms (multi-step, dynamic fields, rich validation).

### 3.4 Integration Boundaries

- API access goes through centralized HTTP abstractions.
- Response mapping happens before rendering.
- Raw API payloads are not consumed directly in view components.

### 3.5 Component Composition Model (Atomic Pragmatic)

- Objective: enforce predictable UI composition without adopting Atomic Design as rigid doctrine.
- Layering is mandatory:
- `src/components/ui/*`: primitive reusable UI only.
- `src/components/composed/*`: reusable composed components (cross-feature, domain-agnostic).
- `src/features/<feature>/components/*`: feature-specific components.
- `src/app/**/page.tsx` and route segments: final screen composition only.
- Dependency direction is mandatory:
- `app -> features -> components/composed -> components/ui`.
- Upward imports are forbidden (for example, `components/ui` importing from `features/*`).
- Extraction rule:
- If equivalent JSX/interaction structure appears in 2+ screens, extract into `components/composed` or `features/<feature>/components` based on reuse scope.
- Placement decision rule:
- Visual primitive only -> `components/ui`.
- Reusable composition without feature coupling -> `components/composed`.
- Feature-coupled composition -> `features/<feature>/components`.

## 4. Delivery Modes

- Ticket-driven delivery for acceptance-criteria work.
- Design-driven delivery for visual and UX parity work.
- User-input-driven delivery when scope or acceptance criteria are unclear.

### 4.1 Planning And Approval Gate (Mandatory)

Before any write action (file edits, code generation, implementation command execution):

- Build a concise plan (scope, ordered actions, validation) or ask only blocking clarification questions.
- Pause and wait for explicit user confirmation.
- Keep this phase read-only until confirmation (discovery and analysis commands are allowed).

### 4.2 Execution Gate

- Start implementation only after explicit confirmation of the proposed plan.
- Implement changes in small, reviewable increments.
- Re-run relevant checks after each meaningful increment when feasible.

### 4.3 Flow Resolution (Mandatory)

- Use `feature-flow` for feature delivery.
- Use `bug-fix-flow` for defect resolution.
- Use `testing-flow` for test-focused work.
- Use `documentation-flow` for docs-only or docs-first work.
- Every selected flow must apply Section 4.1 before execution.

### 4.4 Safe Write Mode (User-Controlled)

- This repository supports a user-controlled write safety flag named `SAFE_WRITE`.
- `SAFE_WRITE=ON`:
- Before any file write action (create/edit/delete), the agent must present a concise plan and proposed changes, then wait for explicit user confirmation.
- Read-only discovery and analysis commands remain allowed without extra confirmation.
- `SAFE_WRITE=OFF`:
- The agent may execute approved implementation changes directly and then report outcomes.
- Control commands accepted in chat:
- `safe on` -> sets `SAFE_WRITE=ON`.
- `safe off` -> sets `SAFE_WRITE=OFF`.
- `safe status` -> reports current mode.
- Unless explicitly set otherwise by the user, prefer `SAFE_WRITE=ON`.
- Current repository mode: `SAFE_WRITE=ON`.

## 5. Rulebook Authority

Primary rule sources are this file and the installed skills under `.agents/`.

Mandatory skill sources:

- `.agents/vendor/vercel-agent-skills/skills/composition-patterns/SKILL.md`
- `.agents/vendor/vercel-agent-skills/skills/react-best-practices/SKILL.md`
- `.agents/vendor/vercel-agent-skills/skills/web-design-guidelines/SKILL.md`
- `.agents/skills/security-semgrep/SKILL.md`

Contextual skill sources (use only when applicable):

- `.agents/skills/frontend-networking-layer/SKILL.md` (frontend networking layer, DTO/model/mappers/endpoints work)

If `docs/rules/` exists in the target project, those rules become mandatory for that project as well.

Project-specific mandatory rule:

- `docs/rules/exercise-catalog-governance.md` (exercise catalog normalization, dedupe protocol, routine SQL safety, muscle-group mapping)

Violation of any applicable rule is a framework breach even if the code compiles.

## 6. Skills and Tooling Router

- Current stack-local skills: `vercel-composition-patterns`, `vercel-react-best-practices`, `web-design-guidelines`.
- Common skills: `security-semgrep`, `frontend-networking-layer`.
- Delivery flows: `feature-flow`, `bug-fix-flow`, `testing-flow`, `documentation-flow`, `design-flow`.
- Runtime validation tooling: Chrome DevTools MCP and Playwright when available.
- MCP policy and setup templates are defined in `.agents/mcp/USAGE.md` (mandatory for `playwright` and `chrome-devtools` workflows).

## 7. Standard Workflow

- Intake ticket or requirement and define testable UI states.
- Define the automated test strategy before implementation (unit/integration/e2e scope).
- Align with design and contract references.
- For UI primitive work, reuse or extend first-party components before coding feature logic.
- Before implementing new JSX blocks, classify target component layer (`ui`, `composed`, `feature`) using Section 3.5 rules.
- Implement with existing component and style conventions.
- Validate static checks, tests, runtime behavior, and accessibility.
- Capture evidence and residual risk notes.
- Mandatory pre-delivery gate:
- If behavior changes in `src/**`, the delivery must provide effective automated coverage for the changed behavior.
- Coverage may be satisfied by existing tests (with execution evidence) or by adding/updating tests in `src/**/*.test.*`, `src/**/*.spec.*`, and/or `e2e/**`.
- If coverage is missing or insufficient, the agent must stop and request an explicit human exception before completion.

## 8. Quality Gates

- Static quality checks pass.
- Type checks pass.
- Relevant automated tests pass.
- New or changed behavior has matching automated test coverage (or an explicit approved exception).
- When changed behavior in `src/**` is covered by existing tests, test-file modifications are not mandatory.
- When any file under `src/` is changed, run `security-semgrep` in changed-files mode and pass the scan.
- No critical runtime console errors in validated flows.
- No sensitive data exposure in UI, logs, or browser storage.
- All applicable `AGENTS.md` and skill constraints are satisfied.
- UI primitives under `src/components/ui` remain reusable, typed, and styling-token based.

### 8.1 Definition of Done (Minimum)

A task is complete only when all are true:

- `tsc` passes with no errors.
- `lint` passes with no warnings.
- `verify:full` passes (`npm run verify:full`).
- If `src/` changed, `security-semgrep` changed-files scan passes (`./.agents/skills/security-semgrep/scripts/run_semgrep_scan.sh . --changed-only --base-ref origin/main`).
- Every new/changed functional behavior is covered by automated tests (or has an explicit approved exception).
- If no test files were changed, the delivery must include explicit evidence that existing tests cover the changed behavior.
- UI behavior was validated via interaction.
- Relevant states (loading, success, error, empty, permission/edge states when applicable) were exercised.
- No console/runtime errors remain in validated flows.
- No security or data-exposure risks were identified.
- Any new/updated UI primitive is reused consistently and validated in runtime flow.
- Component placement and dependency direction comply with Section 3.5.

## 9. Security

Security by Design is non-negotiable.

- No client-side secret, token, or credential exposure.
- No insecure storage for sensitive data (`localStorage`/`sessionStorage` for tokens is forbidden).
- No sensitive data in logs.
- No PII leakage.
- Security scanning is required for every change touching `src/` (run `./.agents/skills/security-semgrep/scripts/run_semgrep_scan.sh . --changed-only --base-ref origin/main`), and is mandatory for auth, payments, uploads, or PII paths.

Any potential security issue must trigger escalation.

## 10. Language Policy

- Conversation language may follow user preference.
- All code-level artifacts must be written in English regardless of conversation language.
- This includes source code, code comments, identifiers, commit messages, pull request text, technical documentation, and test descriptions.
- User-facing UI copy should remain in the product language defined by scope or requirements; if undefined, escalate instead of guessing.

### 10.1 File Naming Convention

- Component files use PascalCase (example: `LoginForm.tsx`).
- Hook files use camelCase (example: `useFirebaseAuth.tsx`).
- General non-component assets/files use kebab-case when applicable (example: `auth-background.png`).
- Follow framework-required exceptions where naming is fixed by convention (for example: `page.tsx`, `layout.tsx`, `route.ts`).

## 11. Escalation Rules

Escalate immediately when:

- Security risk is detected.
- API data types are ambiguous/inconsistent.
- Design conflicts with accessibility or system rules.
- Required UI states are missing.
- Rules conflict or cannot be satisfied simultaneously.

Escalation must include:

- Affected files/components.
- Issue description.
- Rule reference.
- Proposed resolution options.

## 12. Deliverables

- Implementation aligned with scope.
- Validation evidence available.
- Concise risk log available.

## 13. Test Exception Protocol

- Test exceptions are rare and must be explicitly approved by a human reviewer.
- Required exception record must include:
- Scope of changed behavior.
- Reason tests cannot be added/updated in this delivery.
- Risk statement and follow-up plan.
- In PR workflows, true coverage exceptions (coverage not provided) must be represented by the label `test-exception-approved`.
