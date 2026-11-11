# Professional hourly blocks

The calendar's Exceptions menu opens separate business and professional block dialogs. Each dialog lists only its own blocks. Business blocks and professional full-day blocks retain the existing date-range behavior. Professional hourly blocks use one date, a start time, and a duration in whole hours and minutes.

Hourly blocks cannot extend beyond the selected date. An end time of 24:00 represents midnight at the end of that date. Adjacent appointments remain available; any partial overlap makes the slot unavailable for the selected professional. The same checks apply to weekly schedules, exceptional openings, public booking, dashboard booking, and rescheduling. Creating a block rejects existing active appointments overlapping its interval, using the business time zone.

## Database prerequisite

Apply `docs/employee-hour-blocks.sql` in Supabase after the earlier `docs/employee-day-blocks.sql` migration and before running the updated application against that database. The new migration has not been applied by this delivery. It adds nullable time columns and a database constraint limiting timed blocks to one date and one professional. Existing rows remain full-day blocks.

The updated reads and writes require these columns. Running the updated application against an unmigrated database will fail block loading and saving. Existing authorization and row-level policies remain in place.

## Validation

- TypeScript: `./node_modules/.bin/tsc --noEmit --incremental false`.
- Lint: `npm run lint` (zero warnings).
- Automated suite: `node --test $(rg --files src -g '*.test.mjs')`.
- Automated coverage includes scoped modal routing and lists, full-day compatibility, hourly payloads, invalid/zero/overnight durations, loading and failure states, deletion, minute precision and midnight mapping, partial overlaps and adjacent slots, professional isolation, exceptional openings, authenticated roles, business ownership, appointment conflicts in the business time zone, booking and rescheduling enforcement, and public reason sanitization.
- Browser interaction used the actual components in an isolated temporary fixture with fictitious in-memory data because the dashboard browser session required login. Checked separate menu actions, professional mode switching, hourly save/loading/list/delete states, invalid duration feedback, and the business-only form. At a 390 px mobile viewport the dialogs had no horizontal overflow. No warnings or errors appeared in the fixture console.
- Live database persistence and the authenticated end-to-end flow remain unverified until the migration is applied and an authenticated session is available.

## Approved tooling exception

On 2026-11-10 the user explicitly approved proceeding without the missing `feature-flow` skill, the placeholder Semgrep runner, and the absent `verify:full` package script. TypeScript, ESLint, automated behavior tests, browser interaction, and manual diff review were used for this delivery. No automated security scan is claimed. Follow up by restoring those repository tools and running the normal security and full-verification gates before deployment.
