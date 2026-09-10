# Production Notes

What changed to make the platform production-ready, and what to know when running it.

## Event pipeline (new)

Every important action now emits an in-process event (`apps/api/src/common/events`), and one
listener module fans it out. Nothing in the request path waits for the fan-out, so a burst of leads
never slows down the widget or the dashboard.

| Event | Emitted by | Fan-out |
|---|---|---|
| `lead.created` | LeadService (manual, widget, AI `capture_lead` tool, CSV import) | auto-score, in-app/email/Slack/Teams alerts, webhook, follow-up trigger `lead_created`, socket `new_lead` |
| `lead.updated` | LeadService, follow-up actions, AI `update_lead_status` | webhook, "assigned to you" alert, re-score, follow-up trigger `status_changed` |
| `lead.scored` | LeadScoreService (only when the score changed) | webhook, hot-lead alert, follow-up trigger `score_changed` |
| `lead.deleted` | LeadService | webhook |
| `conversation.created` / `conversation.ended` | ConversationService, HandoffService | webhook, socket, follow-up trigger `conversation_ended` |
| `message.created` | ConversationService (visitor, bot, agent) | socket `new_message` to the open dashboard conversation |
| `handoff.created` / `accepted` / `rejected` / `completed` | ConversationService, HandoffService | alerts, webhook, socket `handoff_request`, follow-up trigger `handoff_completed` |
| `appointment.created` / `updated` | AppointmentService | alert, webhook |

Listener: `apps/api/src/modules/events/events-listener.service.ts`. Heavy work (scoring, webhooks)
runs through a 5-wide work queue, so a 5,000-row CSV import trickles through instead of opening
5,000 parallel DB/HTTP operations. Leads with `source` = `import` / `csv` / `bulk` are scored and
sent to webhooks but never produce per-lead human alerts.

## Notifications

- Recipients: the assigned salesperson if any, otherwise every active user whose role is in the
  tenant's `notificationSettings.notifyRoles` (default ADMIN + SALES_MANAGER).
- Email on new lead / hot lead / handoff is a per-tenant toggle. Slack and Teams webhook URLs are
  per tenant. All of this is in **Dashboard > Settings > Notifications** (`PATCH /tenant`).
- In-app notifications are pushed live over the `/notifications` Socket.IO namespace
  (`notification:new`, `notification:unread-count`). The header bell shows the unread count.
- Follow-up `send_email` / `send_sms` / `send_whatsapp` go to the **lead** by default
  (`actionConfig.recipient: "salesperson"` targets the team instead). Message templates support
  `{{firstName}}`, `{{lastName}}`, `{{email}}`, `{{company}}` and any custom field name.

## Follow-up scheduler

`FollowUpService` writes one `FollowUpLog` row per workflow step with a `scheduledAt`. Immediate
steps run at once; delayed steps are claimed atomically (`pending` -> `processing`) by a poller that
runs inside the API process every `FOLLOW_UP_POLL_INTERVAL_MS` (default 60s). Rows stuck in
`processing` for 10 minutes are retried. Running several API replicas is safe; set
`FOLLOW_UP_SCHEDULER_ENABLED=false` on all but one to avoid redundant polling.

## Widget

- Resumes the previous conversation on the same device, shows "chat ended, start a new chat" when
  the conversation was closed from the dashboard, and sends page URL, referrer, device and UTM
  parameters with every conversation and lead.
- Polls only while open and visible, with exponential back-off on errors, and always renders the
  latest messages (the API now returns the most recent page).
- Lead form validates required fields and email format and can be dismissed.
- Full-screen on phones. Built file: `apps/widget/dist/widget.js`, served by the API at `/widget.js`.

Embed:

```html
<script src="https://YOUR-API-HOST/widget.js" data-agent-id="AGENT_ID" data-api-url="https://YOUR-API-HOST/api/v1"></script>
```

## Security / robustness

- CORS: widget routes (`/api/v1/widget/*`, `/widget.js`, `/api/v1/health`) accept any origin without
  credentials; every other route only accepts `CORS_ALLOWED_ORIGINS`.
- Dashboard routes are protected server-side by the Next.js middleware (marker cookie `la_auth`);
  tokens never leave localStorage. Hard refresh on a dashboard page no longer logs you out.
- AI calls time out after 30s (OpenAI and Anthropic). Message counters use atomic `$inc`.
- Mongo pool size and server-selection timeouts are configured; `trust proxy` is on for real client
  IPs behind a load balancer; shutdown hooks stop the scheduler cleanly on SIGTERM.

## Running

```bash
cp apps/api/.env.example apps/api/.env   # fill in secrets
docker compose up -d mongodb redis minio
npm install
npm run seed                              # admin@demo.com / Admin@123 / tenant "demo"
start.bat                                 # builds API, dashboard, widget and starts everything
```

Tests: `cd apps/api && npx jest` (8 suites, 66 tests).

## Owner console / super admin (new)

- `npm run seed` always ensures the owner workspace (slug `owner`, `isPlatformOwner: true`) and the
  `SUPER_ADMIN` user exist, using `SUPER_ADMIN_*` from `.env` (defaults: `superadmin@lead.ai` /
  `SuperAdmin@Lead.AI`). Change these in production before seeding.
- All owner routes live under `/api/v1/admin/*` (`apps/api/src/modules/super-admin`) and are guarded by
  `@SuperAdminOnly()`; no other role, including VIEWER's read-only bypass, can reach them.
- `PlatformSettings` (collection `platform_settings`, single doc `key: global`) holds maintenance mode,
  signup toggle, announcement banner, global feature flags, per-plan limits and reserved slugs. It is cached
  in memory and refreshed every 30s (`PlatformSettingsService`), so several API replicas converge quickly.
- Maintenance mode returns 503 for every non-owner login, refresh and authenticated request. Public widget
  endpoints keep working.
- Impersonation issues a 1h session flagged `impersonatedBy`; the claim survives token refresh. Suspending a
  tenant, resetting a password or force-logout revokes refresh tokens immediately (access tokens expire in 15m).
- Purging a tenant deletes every tenant-scoped collection except `AuditLog`, so the trail stays.
- The owner workspace cannot be suspended or deleted, the last active SUPER_ADMIN cannot be demoted or
  deactivated, and owners cannot deactivate themselves.

## Not covered here

Billing (payment gateway, invoice webhook verification) is untouched.
