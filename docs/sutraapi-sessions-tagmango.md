# SutraAPI Sessions + TagMango

## Feature model

Sessions, TagMango and session reminders are per-account entitlements. New accounts have no optional entitlement until the SutraAPI team grants it from `/admin/features`.

The client-facing Settings → Features page is read-only. Server-side APIs also enforce the entitlement, so hiding the UI is not the security boundary.

## Admin setup

1. Add `SUTRAAPI_FEATURE_ADMIN_PASSWORD` to the server environment.
2. Log into SutraAPI.
3. Open `/admin/features`.
4. Unlock the feature controls.
5. Enable `sessions` for the client account that should use it.
6. Enable `tagmango` for accounts that should connect TagMango.
7. Enable `session_reminders` when the reminder workflow is ready.

## TagMango setup

TagMango's external API uses a Bearer API key and requires the `x-whitelabel-host` header. The API key is encrypted before it is stored in `tagmango_configs`.

In Settings → TagMango, enter the client's TagMango whitelabel host and API key. Keep Dry-run enabled while testing.

The session sync reads the next 14 days from `GET /api/v1/external/workshops/video-calls` and stores the canonical records in `tagmango_sessions`. It also attempts to bridge them into the existing `sessions` table for the attendance/personalized-link flow.

## Participant eligibility

Automated reminders are CRM-first. A TagMango attendee is only eligible if a matching phone number already exists in the SutraAPI account's `participants` table. SutraAPI never creates a recipient just because TagMango knows about them.

TagMango's `webinar.created.single` webhook is supported at `/api/tagmango/webhook`. Register that webhook for the client's TagMango account so participant registration data can be stored in `tagmango_session_registrations`.

If the TagMango account uses a webhook secret, set `TAGMANGO_WEBHOOK_SECRET` and configure the sender to provide `x-tagmango-webhook-secret`.

## Reminder scheduler

Call `POST /api/tagmango/cron` from a scheduler at least every 5 minutes with:

`x-tagmango-cron-secret: <TAGMANGO_CRON_SECRET>`

The reminder worker checks a 55–65 minute window before each session. It is idempotent through `session_reminder_logs`.

Dry-run is the default. A dry-run records what would have been sent without calling Meta.

## WhatsApp requirements

The client account must have:

- a configured WhatsApp connection;
- the approved `sutra_session_invitation` template in `en_US`;
- a matching SutraAPI participant;
- a personalized participant/session link.

## Important TagMango note

The current TagMango API reference exposes workshop calls with their associated Mango/service. The legacy subscriber-by-creator endpoint is marked deprecated, so the integration does not make it a long-term dependency. Registration webhooks are used for participant capture instead.
