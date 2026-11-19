# INFINITY referral rewards and plan labels

This release keeps the stored tiers `free`, `pro` and `unlimited` unchanged. Customer-facing names are FREE, PRO and INFINITY, including new Mercado Pago subscription descriptions. Existing provider authorizations are not modified by this code change alone; new or explicitly changed subscriptions receive the new description.

A referred account's first approved subscription payment, for either PRO or INFINITY, grants one saved 30-day INFINITY reward. Replayed notifications and renewals do not grant additional rewards for the same referral. Rewards still require individual activation while the account is on FREE, and the existing maximum of three saved rewards remains unchanged.

Existing available and active rewards retain their remaining days, timestamps and expiry dates. When an active legacy PRO reward is next reconciled by the new application, it grants INFINITY instead. The application does not reset its duration or activate the next saved reward when it expires.

The referral summary response now includes the authoritative business subscription tier. Older responses remain supported. Profile rendering and reward activation use this tier rather than converting every non-Free access source to Pro. This prevents delayed referral loading from relabeling a manual or paid INFINITY account.

When a reward expires or activation fails, the existing `reconcile_business_subscription` RPC restores the independent paid/manual entitlement. An expired referral therefore returns an otherwise Free account to FREE while preserving a manual PRO/INFINITY grant or an authorized paid subscription.

No new database migration or environment variable is needed after the previous subscription rollout. The existing enum must already include `unlimited`, and the existing reconciliation RPC must be installed. Deploy this release's frontend and API code together. No production rows, existing billing amounts or provider subscriptions are changed during local implementation.
