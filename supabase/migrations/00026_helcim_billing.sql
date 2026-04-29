-- Add Helcim payment processing fields to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS helcim_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS helcim_card_token TEXT,
  ADD COLUMN IF NOT EXISTS helcim_card_f6l4 TEXT,        -- first6/last4 for display
  ADD COLUMN IF NOT EXISTS helcim_card_expiry TEXT,       -- MM/YY
  ADD COLUMN IF NOT EXISTS helcim_card_type TEXT,         -- Visa, Mastercard, etc.
  ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS next_charge_at TIMESTAMPTZ;

-- Index for Helcim customer lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_helcim_customer
  ON subscriptions(helcim_customer_id) WHERE helcim_customer_id IS NOT NULL;

-- Add Helcim transaction reference to billing_events
ALTER TABLE billing_events
  ADD COLUMN IF NOT EXISTS helcim_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS helcim_card_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT;
