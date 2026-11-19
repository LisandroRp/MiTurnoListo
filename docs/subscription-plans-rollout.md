# Subscription plans rollout

Status: prepared locally, not applied to Supabase or Mercado Pago. No customer plans or payment authorizations were changed. Do not deploy the new server before applying its schema prerequisites.

## Reviewed state

The Supabase REST schema was inspected read-only on 2026-11-19. `businesses.subscription_tier` uses `public.subscription_tier`, currently containing `free` and `pro`. `business_subscriptions.subscription_tier` is text. Subscription records already have a provider plan code, subscription ID and status, so separate Mercado Pago plan templates are unnecessary for the current unassociated-plan integration.

The selected manual customer is **MEDICINA INTEGRAL CANNING**, UUID `90593413-c118-449d-9752-7ee3f5de6daf`. Its supplied owner email matched, its effective tier was `pro`, and no authorized provider subscription was found in the application's subscription records. Recheck at release; this is a snapshot, not a permanent guarantee.

The user supplied the production read-only preflight JSON on 2026-11-19. The supplied metadata is compatible with the prepared migrations:

- The enum contains only `free` and `pro`, confirming file 01 is required.
- Neither `business_subscriptions.subscription_tier` nor `admin_audit_logs.action` has a reported check constraint. File 02 can add its three-tier check without replacing an existing check, and `activateUnlimited` does not conflict with a reported action check.
- The unique provider subscription ID constraint and the existing primary/foreign keys are retained. Manual audit writes use the verified administrator's existing auth UUID, preserving the actor foreign key.
- Existing business RLS policies authorize member reads and manager updates. They are retained; the additional field-protection trigger prevents direct client changes to entitlement fields. The deny policy on direct client audit access is retained; the service-role-only RPC writes its audit atomically.
- Existing trigger names (`trg_*_updated_at` and `record_appointment_payment_confirmation`) differ from the new trigger names, so the migration does not drop or replace them. The payment-confirmation trigger implementation in `appointment-payment-activity.sql` only maintains `payment_confirmed_at`, independently of the new quota fields.
- The reviewed customer is Pro, has `latest_manual_action = activatePro`, and has no authorized provider subscription. File 02 therefore preserves its manual Pro grant before deployment; file 03 changes it to manual Unlimited only when explicitly executed later.

No additional replacement of existing policies, keys or tables is required by the supplied metadata. This review does not constitute execution against production or a provider integration test. Re-run the read-only preflight if the schema or customer state changes before release. The query returns all metadata in one JSON cell named `preflight`. File 02 still aborts if it encounters an unfamiliar tier check in a later schema version.

## Product rules

| Plan | Monthly ARS price | Active staff | Services | Monthly appointments |
| --- | ---: | ---: | --- | ---: |
| Free | 0 | 1 | 2 public services | 15 |
| Pro | 25,000 | 3 | 10 active services, including private services | 150 |
| Unlimited | 55,000 | Unlimited | Unlimited | Unlimited |

Customer-facing plan names are FREE / PRO / INFINITY; the persisted IDs remain `free` / `pro` / `unlimited`. Both paid plans retain online payments, public booking and statistics. Pro appointments are counted by their scheduled month in the business timezone. Canceled and rescheduled source records do not consume quota. A party-size booking is one appointment. Editing existing records, canceling and marking attendance remain available at the cap. Existing records are never deleted to satisfy a quota.

A paid plan change updates the same monthly authorization. Access changes when Mercado Pago confirms the change, and the new recurring amount applies to future billing; the application does not issue a separate immediate payment or create another authorization. Confirm the next billing date and amount in a test provider account before enabling this flow in production.

Manual assignments do not create provider subscriptions, payment records or revenue. Active provider subscriptions must be managed before changing a manual grant. Referral rewards now grant 30 days of INFINITY (stored tier `unlimited`) and must not erase an independent manual or paid grant when they expire. See `referral-infinity-update.md` for the current reward and naming rules.

## Environment variables

Keep the existing server credential `MERCADO_PAGO_SUBSCRIPTION_ACCESS_TOKEN` and the existing Pro frequency configuration (one month).

```dotenv
MERCADO_PAGO_PRO_PRICE_ARS=25000
MERCADO_PAGO_UNLIMITED_PRICE_ARS=55000
NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED=true
```

`MP_WEBHOOK_TOKEN` must be configured with the same existing secret used by subscription notification URLs. The subscription webhook now fails closed when it is missing. Do not publish credential values or copy them into this document. `MERCADO_PAGO_TEST_PAYER_EMAIL` is only for an intentional test setup; ensure it is not overriding real payers at release.

The release flag is public by design and contains no secret. It gates new Unlimited checkout and the corresponding purchase/manual-selection UI. It must be set before the Next.js build; changing it requires rebuilding/redeploying. It does not activate Pro quotas.

Pro quota enforcement uses the internal `businesses.pro_limits_enabled` field. The full-release activation script (`subscription-plans-04-activate-limits.sql`) enables it for all existing businesses and secures the default for future businesses. Free and Unlimited behavior stays unchanged because the quota trigger only applies to Pro. The user does not need to manage this field for individual customers during the full release.

## Deployment order: one full release

1. In Supabase SQL Editor, run `subscription-plans-01-enum.sql` by itself. Wait for success. Do not combine it with file 02 in the same transaction.
2. In a separate query, run all of `subscription-plans-02-support.sql`. This prepares the schema and preserves the reviewed customer's manual Pro grant. Existing Pro limits remain disabled at this point. The compatible backend must not be deployed before these two migrations succeed.
3. In the deployment platform, set `MERCADO_PAGO_PRO_PRICE_ARS=25000`, `MERCADO_PAGO_UNLIMITED_PRICE_ARS=55000` and `NEXT_PUBLIC_SUBSCRIPTION_PLANS_V2_ENABLED=true`. Keep the existing subscription access token and `MP_WEBHOOK_TOKEN`. Set variables before the build; if editing them triggers an automatic deploy of old code, the subsequent code push must still build the new release.
4. Commit and push the complete application changes (`src/` and prepared documentation/scripts). This is a single Next.js application: the UI and `src/app/api/` backend deploy together from the same repository. Pushing files does not execute SQL in Supabase. Do not commit local credential files. Wait until the new deployment is live.
5. In the new application's super admin panel, find **MEDICINA INTEGRAL CANNING**, choose **Unlimited**, and apply the plan. This is a manual grant with an atomic audit and no Mercado Pago subscription or charge. The alternate file `subscription-plans-03-manual-client.sql` is unnecessary when using the panel; do not run its unfilled administrator placeholders.
6. In Supabase SQL Editor, run `subscription-plans-04-activate-limits.sql`. It enables Pro quotas for current and future businesses while allowing legitimate authenticated Free signup and preventing a client from opting out of quotas. Run this after the reviewed manual customer has Unlimited access.
7. Verify that the customer still shows Unlimited after reload, that the three plan cards are active, and that Pro advertises 3 staff / 10 active services / 150 monthly bookings. Complete the provider release checks using the chosen test setup; do not run real charges without explicit authorization.

The full release needs one code deployment, not two staged deployments. No SQL file in this repository is automatically applied by a push. The prepared migrations and activation script remain unexecuted against production until the user explicitly runs them.

## Release matrix

- Free remains unchanged.
- New Pro uses ARS 25,000 and persists `miturnolisto-pro`.
- New Unlimited uses ARS 55,000 and persists `miturnolisto-unlimited`.
- Pending, rejected and abandoned checkout do not unlock a new paid plan.
- Authorized Unlimited remains Unlimited on refresh, referral reconciliation and repeated webhook events.
- An existing subscription can change price without a second subscription or an immediate payment request.
- Canceling a paid subscription preserves any independently granted manual access.
- A business cannot synchronize another business's subscription ID.
- Staff 4, active service 11 and appointment 151 are rejected for a quota-enabled Pro business.
- Cancellation frees capacity; same-month rescheduling consumes one appointment; a full destination month rejects cross-month moves without modifying the original appointment.
- Concurrent requests cannot claim the same last quota slot. Exercise this against the isolated SQL fixture before production.
- Existing over-limit records remain readable/editable. Unlimited and legacy Pro with quotas off remain unrestricted.
- The manual customer remains Unlimited after reload and status synchronization, with no provider subscription, payment or billed revenue created.
- Missing/invalid webhook tokens are rejected; synchronization failures return a retryable failure.

## Local database verification

The fixture and SQL tests are deliberately separate from production scripts. Never apply the test fixture to Supabase. Tests used the already-installed `postgres:16-alpine` Docker image in a container with no network or published ports. No additional project dependencies were installed.

Apply these files in order to a new isolated test database:

1. `subscription-plans-test-fixture.sql`
2. `subscription-plans-01-enum.sql` (separate committed statement)
3. `subscription-plans-02-support.sql`
4. `subscription-plans.test.sql` (transaction rolled back)
5. `subscription-plans-04-activate-limits.sql`
6. `subscription-plans-activation.test.sql` (transaction rolled back)

The fixture models the relevant inspected column types; it is not a full production schema dump. The supplied production constraint/trigger/policy metadata has now been reviewed as described above; production execution and the release matrix remain separate steps.

## Recovery

First disable new purchasing via the release flag and redeploy the compatible build. Disable `pro_limits_enabled` for affected reviewed business IDs if quota behavior is the issue. Retain the enum, manual grant fields, audit records and provider IDs. Do not roll back to code that only understands Free/Pro after any business receives Unlimited.

A database rollback does not reverse a provider price change. If a recurring amount must be restored, use the same authorized provider subscription after reviewing its actual billing state; do not create a replacement automatically. Preserve recorded paid amounts for revenue reporting.


## Validation evidence

- `npx tsc --noEmit --incremental false`: passed.
- `npm run lint`: passed with no warnings.
- Full `src/**/*.test.mjs` suite: 452 tests passed, including the Unlimited revenue regression and the service-header button styling change. Manual grants do not count as billed revenue.
- Both migrations applied successfully to isolated PostgreSQL 16, including a repeated application of file 02.
- `subscription-plans.test.sql`: passed, including manual grant persistence, atomic audit rollback, Pro caps, month boundaries, rescheduling and authenticated-client write protection.
- `subscription-plans-concurrency.test.mjs`: all three last-slot concurrency tests passed, both before and after the full-release activation SQL.
- `subscription-plans-04-activate-limits.sql` and `subscription-plans-activation.test.sql`: passed on isolated PostgreSQL, including future-business defaults, explicit false override, authenticated Free signup, paid-field write protection and server rollback of a quota flag.
- Explicit changed-file Semgrep scan: 38 source/test files scanned with zero findings; subsequent changed subscription code and the additional revenue test were scanned separately with zero findings.
- The final one-cell JSON preflight executed successfully against the isolated fixture.
- The repository's Semgrep wrapper is a placeholder and not executable; the actual Semgrep CLI was used. The baseline mode selected zero files, so it was replaced by an explicit changed-file scan. `verify:full` is not declared in package.json; no build or deployment configuration was changed to add it.
- No browser automation was performed; visual interaction validation remains with the user.
- No migrations, customer changes, provider subscriptions, provider price updates or charges were executed against production. The user-supplied production preflight JSON was reviewed with no migration conflicts identified in its reported constraints, trigger definitions and policies. Production execution and real provider tests remain unperformed.
