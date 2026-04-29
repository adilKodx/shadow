# Helcim Integration — Resume Guide

**Status:** deferred until production Helcim API token is available.
**Last touched:** Apr 29 2026.

## What works *without* a Helcim key (no action needed)

These are pure-database flows, no external API calls:

| Feature | How |
|---|---|
| Direct + partner-attributed signups | `/signup` and `/signup/{slug}` create tenant + subscription rows |
| Tier switching | `/settings` → Billing → Switch button → `upgrade_subscription_tier` RPC |
| Commission accrual | `stamp_billing_event_commission` trigger on `billing_events` insert |
| Payout aggregation | "Generate Pending Payouts" button on `/white-label` → Payouts tab |
| Payout confirmation | Manual ACH-out-of-band, then click Confirm Payment in UI |
| Test payment simulation | `scripts/simulate-payment.sql` — fakes a `payment` billing event |

You can test the entire partner commission lifecycle today using the simulate-payment script.

## What's blocked on the Helcim key

| Feature | Where |
|---|---|
| Saving a tenant's card | `/settings` → Billing → "Add Payment Method" button |
| Auto-charging on renewal | (not yet wired — would be a cron / scheduled function calling Helcim's payment API) |
| Card last4 / payment method display | `subscriptions.helcim_card_token` and `payment_method_last4` are populated by the helcim-billing Edge Function |

## Current state of the integration

- **Edge Function deployed:** `supabase/functions/helcim-billing/index.ts` is live on Supabase (verify with `supabase functions list`)
- **Token lookup order in the function:**
  1. `marketing_settings` table — row where `key = 'helcim_api_token'`, returns `value` column
  2. Falls back to `HELCIM_API_TOKEN` env var on the Edge Function
- **Caveat:** the `marketing_settings` table is **not created by any migration**. It's a phantom reference. So path #1 will always 404 until that table is added. Path #2 (env var) is the only working route today.

## When you get the Helcim API token (production OR sandbox)

### Option A — Quick path (recommended for first setup)

Set the env var on the Edge Function:

```bash
supabase secrets set HELCIM_API_TOKEN=<your-token-here>
```

That's it. The Edge Function will pick it up on the next invocation (no redeploy needed; secrets are read at runtime).

Then test:

1. Sign in as a tenant member
2. `/settings` → Billing → click **Add Payment Method**
3. Enter a Helcim test card (Helcim provides several — see https://devdocs.helcim.com/reference/test-cards)
4. Confirm the modal closes without errors and the Payment Method card now shows last4
5. Verify in Supabase: `SELECT helcim_card_token, payment_method_last4 FROM subscriptions WHERE tenant_id = '...'` — both should be populated

### Option B — Database-backed config (if you want platform admins to manage it via UI)

Create a migration to add the `marketing_settings` key/value table, then store the token there. Worth doing later if you build a "Platform Settings" admin UI.

```sql
-- Sketch — add as a new migration when ready
CREATE TABLE marketing_settings (
  key   TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only platform admins can read/write
ALTER TABLE marketing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_admin_only ON marketing_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid()));

-- Then insert via UI or SQL
INSERT INTO marketing_settings (key, value) VALUES ('helcim_api_token', '<token>');
```

The Edge Function already prefers this path over the env var, so once the row exists it takes over.

## Files to revisit when resuming

- `supabase/functions/helcim-billing/index.ts` — the integration
- `src/pages/Settings.tsx` line ~189 — where the frontend calls `helcim-billing`
- `src/hooks/useWhiteLabel.ts` — `getSubscription` and `getBillingHistory`
- `scripts/simulate-payment.sql` — keep using this for tests that don't require a real charge

## Test cards (for when you have the token)

Helcim sandbox supports several. Common ones:

| Card | What it does |
|---|---|
| `4111 1111 1111 1111` | Approved transaction |
| `4012 0000 0000 0099` | Declined |
| `4012 0000 0000 0123` | Insufficient funds |

Full list: https://devdocs.helcim.com/reference/test-cards

## Don't forget

- Remove any `subscriptions.helcim_card_token` values from test data before going to production
- Production token grants access to *real* charges — store it via `supabase secrets set`, never commit it
- Confirm Helcim webhook setup if you want auto-renewal events to come back into `billing_events`
