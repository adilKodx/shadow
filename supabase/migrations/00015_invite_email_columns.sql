-- Add email tracking columns to tenant_invites
ALTER TABLE tenant_invites ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE tenant_invites ADD COLUMN IF NOT EXISTS invited_name TEXT;

CREATE INDEX IF NOT EXISTS idx_invites_email ON tenant_invites(invited_email);
