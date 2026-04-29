// ─── Core Tenant Types ───

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  app_name: string;
  tagline: string;
  favicon_url: string | null;
  login_bg_url: string | null;
  custom_domain: string | null;
  features_enabled: Record<string, boolean>;
  subscription_tier: string;
  billing_cycle: string;
  max_members: number;
  partner_id: string | null;
  home_lat: number | null;
  home_lng: number | null;
  home_zoom: number | null;
  home_address: string | null;
}

export interface TenantMember {
  id: string;
  tenant_id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: 'owner' | 'admin' | 'supervisor' | 'member' | 'viewer';
  title: string | null;
  badge_number: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  pin_enabled: boolean;
  biometric_enabled: boolean;
  lock_timeout_minutes: number;
}
