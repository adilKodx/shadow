import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface WhiteLabelPartner {
  id: string;
  slug: string;
  company_name: string;
  tagline: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  hero_image_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  commission_pct: number;
  commission_type: string;
  hero_headline: string;
  hero_subheadline: string;
  features_json: any[];
  testimonials_json: any[];
  faq_json: any[];
  terms_override: string | null;
  privacy_override: string | null;
  is_active: boolean;
  pricing_self_managed?: boolean;
}

export interface PricingTier {
  tier_key: string;
  tier_name: string;
  monthly_price: number;
  annual_discount_pct: number;
  max_members: number;
  description: string;
  features_json: any[];
  is_popular: boolean;
  sort_order: number;
}

export interface PartnerPricing {
  id: string;
  partner_id: string;
  tier_key: string;
  monthly_price: number;
  annual_discount_pct: number;
  max_members: number;
  features_json: any[];
}

export interface Subscription {
  id: string;
  tenant_id: string;
  tier_key: string;
  billing_cycle: string;
  base_price: number;
  discount_pct: number;
  effective_price: number;
  partner_id: string | null;
  partner_commission_pct: number;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string | null;
  canceled_at: string | null;
  payment_method_last4: string | null;
  payment_method_brand: string | null;
}

export interface BillingEvent {
  id: string;
  subscription_id: string;
  tenant_id: string;
  event_type: string;
  amount: number | null;
  currency: string;
  partner_id: string | null;
  commission_amount: number | null;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

export interface PartnerUser {
  id: string;
  partner_id: string;
  user_id: string;
  role: 'owner' | 'staff';
  granted_at: string;
  granted_by: string | null;
  is_active: boolean;
  // joined display fields (populated by fetchPartnerUsers)
  email?: string | null;
  display_name?: string | null;
}

export interface PartnerPayout {
  id: string;
  partner_id: string;
  period_start: string;
  period_end: string;
  gross_revenue: number;
  commission_pct: number;
  commission_amount: number;
  adjustments: number;
  net_payout: number;
  status: string;
  payment_method: string;
  ach_tracking_number: string | null;
  ach_reference: string | null;
  payment_date: string | null;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  qb_bill_id: string | null;
  qb_payment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TermsVersion {
  id: string;
  version: string;
  title: string;
  content: string;
  privacy_content: string | null;
  effective_date: string;
  is_current: boolean;
}

export function useWhiteLabel() {
  const [partners, setPartners] = useState<WhiteLabelPartner[]>([]);
  const [defaultPricing, setDefaultPricing] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPartners = useCallback(async () => {
    const { data } = await supabase
      .from('white_label_partners')
      .select('*')
      .eq('is_active', true)
      .order('company_name');
    if (data) setPartners(data as WhiteLabelPartner[]);
  }, []);

  const fetchDefaultPricing = useCallback(async () => {
    const { data } = await supabase
      .from('default_pricing')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (data) setDefaultPricing(data as PricingTier[]);
  }, []);

  // Load partner by slug (for signup pages)
  const getPartnerBySlug = useCallback(async (slug: string) => {
    const { data } = await supabase
      .from('white_label_partners')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    return data as WhiteLabelPartner | null;
  }, []);

  // Load pricing for a partner (falls back to default)
  const getPartnerPricing = useCallback(async (partnerId: string | null): Promise<PricingTier[]> => {
    // Always load default first
    const { data: defaults } = await supabase
      .from('default_pricing')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (!partnerId || !defaults) return (defaults || []) as PricingTier[];

    // Load partner overrides
    const { data: overrides } = await supabase
      .from('partner_pricing')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('is_active', true);

    if (!overrides || overrides.length === 0) return defaults as PricingTier[];

    // Merge: use partner price where available, default otherwise
    const overrideMap = new Map(overrides.map(o => [o.tier_key, o]));
    return (defaults as PricingTier[]).map(tier => {
      const override = overrideMap.get(tier.tier_key);
      if (override) {
        return {
          ...tier,
          monthly_price: override.monthly_price,
          annual_discount_pct: override.annual_discount_pct,
          max_members: override.max_members,
          features_json: override.features_json?.length ? override.features_json : tier.features_json,
        };
      }
      return tier;
    });
  }, []);

  // Get current terms
  const getCurrentTerms = useCallback(async () => {
    const { data } = await supabase
      .from('terms_versions')
      .select('*')
      .eq('is_current', true)
      .maybeSingle();
    return data as TermsVersion | null;
  }, []);

  // Check if user has accepted current terms
  const hasAcceptedCurrentTerms = useCallback(async (userId: string) => {
    const terms = await getCurrentTerms();
    if (!terms) return true; // no terms = accepted
    const { data } = await supabase
      .from('terms_acceptances')
      .select('id')
      .eq('user_id', userId)
      .eq('terms_version_id', terms.id)
      .maybeSingle();
    return !!data;
  }, [getCurrentTerms]);

  // Accept terms
  const acceptTerms = useCallback(async (userId: string, tenantId: string | null) => {
    const terms = await getCurrentTerms();
    if (!terms) return { error: null };
    const { error } = await supabase.from('terms_acceptances').insert({
      user_id: userId,
      terms_version_id: terms.id,
      tenant_id: tenantId,
      ip_address: null, // could capture via API
      user_agent: navigator.userAgent,
    });
    return { error };
  }, [getCurrentTerms]);

  // Get subscription for a tenant
  const getSubscription = useCallback(async (tenantId: string) => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as Subscription | null;
  }, []);

  // Get billing history
  const getBillingHistory = useCallback(async (tenantId: string) => {
    const { data } = await supabase
      .from('billing_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    return (data || []) as BillingEvent[];
  }, []);

  // ─── CRUD: Partners ───

  const createPartner = useCallback(async (partner: Partial<WhiteLabelPartner>) => {
    const { data, error } = await supabase.from('white_label_partners').insert(partner).select().single();
    if (data) await fetchPartners();
    return { data, error };
  }, [fetchPartners]);

  const updatePartner = useCallback(async (id: string, updates: Partial<WhiteLabelPartner>) => {
    // Strip read-only / server-managed fields before sending update
    const { id: _id, created_at, updated_at, approved_at, approved_by, ...payload } = updates as any;
    const { error } = await supabase.from('white_label_partners').update(payload).eq('id', id);
    if (error) console.error('[WhiteLabel] updatePartner error:', error);
    else await fetchPartners();
    return { error };
  }, [fetchPartners]);

  const uploadPartnerLogo = useCallback(async (partnerId: string, file: File) => {
    const ext = file.name.split('.').pop();
    const path = `logos/${partnerId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('tenant-branding').upload(path, file, { upsert: true });
    if (upErr) { console.error('[WhiteLabel] logo upload error:', upErr); return { error: upErr, url: null }; }
    const { data: { publicUrl } } = supabase.storage.from('tenant-branding').getPublicUrl(path);
    // Update the partner record with the new logo URL
    const { error } = await supabase.from('white_label_partners').update({ logo_url: publicUrl }).eq('id', partnerId);
    if (!error) await fetchPartners();
    return { error, url: publicUrl };
  }, [fetchPartners]);

  const deletePartner = useCallback(async (id: string) => {
    const { error } = await supabase.from('white_label_partners').delete().eq('id', id);
    if (!error) await fetchPartners();
    return { error };
  }, [fetchPartners]);

  // ─── Toggle pricing_self_managed (platform-admin-only) ───
  const setPricingSelfManaged = useCallback(async (partnerId: string, enabled: boolean) => {
    const { error } = await supabase
      .from('white_label_partners')
      .update({ pricing_self_managed: enabled })
      .eq('id', partnerId);
    if (!error) await fetchPartners();
    return { error };
  }, [fetchPartners]);

  // ─── CRUD: Partner Users (grant/revoke portal access) ───
  // RLS: only platform admins can insert/update/delete these rows.
  const fetchPartnerUsers = useCallback(async (partnerId: string): Promise<PartnerUser[]> => {
    const { data: rows } = await supabase
      .from('partner_users')
      .select('*')
      .eq('partner_id', partnerId)
      .order('granted_at', { ascending: true });
    if (!rows || rows.length === 0) return [];

    const userIds = rows.map((r: any) => r.user_id);

    // Primary: SECURITY DEFINER RPC that reads auth.users (platform-admin only).
    // See migration 00030. This is the only reliable source for partner staff
    // who don't have a tenant_members row.
    const { data: authUsers } = await supabase.rpc('get_user_emails_for_admin', {
      p_user_ids: userIds,
    });
    const authMap = new Map<string, { email?: string; display_name?: string }>();
    ((authUsers as any[]) || []).forEach((u: any) => {
      authMap.set(u.user_id, { email: u.email, display_name: u.display_name });
    });

    // Fallback: tenant_members display_name (sometimes more user-friendly than
    // the raw auth metadata).
    const { data: members } = await supabase
      .from('tenant_members')
      .select('user_id, email, display_name')
      .in('user_id', userIds);
    const memberMap = new Map<string, { email?: string; display_name?: string }>();
    (members || []).forEach((m: any) => {
      if (!memberMap.has(m.user_id)) memberMap.set(m.user_id, m);
    });

    return rows.map((r: any) => ({
      ...r,
      email: authMap.get(r.user_id)?.email ?? memberMap.get(r.user_id)?.email ?? null,
      display_name: memberMap.get(r.user_id)?.display_name ?? authMap.get(r.user_id)?.display_name ?? null,
    })) as PartnerUser[];
  }, []);

  /**
   * Grant a user partner_user access by email. Looks up their auth user_id
   * via tenant_members (they must already exist in our system to be granted).
   */
  const grantPartnerUserByEmail = useCallback(async (
    partnerId: string,
    email: string,
    role: 'owner' | 'staff' = 'owner',
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { error: { message: 'Email required' } };

    // Find an existing user via tenant_members (any tenant)
    const { data: m } = await supabase
      .from('tenant_members')
      .select('user_id')
      .ilike('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    if (!m?.user_id) {
      return { error: { message: `No existing user found for ${cleanEmail}. They must sign up first.` } };
    }

    const { error } = await supabase
      .from('partner_users')
      .insert({ partner_id: partnerId, user_id: m.user_id, role, is_active: true });
    return { error };
  }, []);

  const revokePartnerUser = useCallback(async (partnerUserId: string) => {
    const { error } = await supabase.from('partner_users').delete().eq('id', partnerUserId);
    return { error };
  }, []);

  /**
   * Create a partner-portal login for an external partner staff member.
   * Calls the `invite-partner-user` Edge Function which:
   *   - if the email already exists in auth.users → upserts the partner_users
   *     row (password is ignored — we don't overwrite existing passwords)
   *   - otherwise creates a brand-new auth user with the given password,
   *     email_confirm = true (no emails sent), and upserts partner_users
   *
   * The platform admin shares the credentials with the partner out-of-band
   * (Slack / SMS / phone). Partner then logs in at /login.
   */
  const invitePartnerUserByEmail = useCallback(async (
    partnerId: string,
    email: string,
    password: string,
    role: 'owner' | 'staff' = 'owner',
  ): Promise<{ error: { message: string } | null; created?: boolean; message?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { error: { message: 'Email required' } };

    const { data, error } = await supabase.functions.invoke('invite-partner-user', {
      body: { partner_id: partnerId, email: cleanEmail, password, role },
    });
    if (error) {
      // Surface the function's response body if we got one (FunctionsHttpError).
      const ctx: any = (error as any).context;
      let detail = error.message;
      try {
        if (ctx?.body) {
          const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
          if (parsed?.error) detail = parsed.error;
        }
      } catch { /* ignore */ }
      return { error: { message: detail } };
    }
    if ((data as any)?.error) return { error: { message: (data as any).error } };
    return {
      error: null,
      created: !!(data as any)?.created,
      message: (data as any)?.message,
    };
  }, []);

  const setPartnerUserActive = useCallback(async (partnerUserId: string, active: boolean) => {
    const { error } = await supabase
      .from('partner_users')
      .update({ is_active: active })
      .eq('id', partnerUserId);
    return { error };
  }, []);

  // ─── CRUD: Default Pricing ───

  const updateDefaultTier = useCallback(async (tierKey: string, updates: Partial<PricingTier>) => {
    const { error } = await supabase.from('default_pricing').update(updates).eq('tier_key', tierKey);
    if (!error) await fetchDefaultPricing();
    return { error };
  }, [fetchDefaultPricing]);

  // ─── CRUD: Partner Pricing Overrides ───

  const upsertPartnerPricing = useCallback(async (partnerId: string, tierKey: string, updates: Partial<PartnerPricing>) => {
    const { data: existing } = await supabase
      .from('partner_pricing')
      .select('id')
      .eq('partner_id', partnerId)
      .eq('tier_key', tierKey)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from('partner_pricing').update(updates).eq('id', existing.id);
      return { error };
    } else {
      // partner_pricing.max_members is NOT NULL but the override UI only edits price.
      // Inherit max_members (and features_json) from default_pricing for the same tier
      // so the insert satisfies the schema without forcing the caller to know defaults.
      let maxMembers = updates.max_members;
      let featuresJson = updates.features_json;
      if (maxMembers == null || featuresJson == null) {
        const { data: def } = await supabase
          .from('default_pricing')
          .select('max_members, features_json')
          .eq('tier_key', tierKey)
          .maybeSingle();
        if (maxMembers == null) maxMembers = def?.max_members ?? 3;
        if (featuresJson == null) featuresJson = def?.features_json ?? [];
      }
      const { error } = await supabase
        .from('partner_pricing')
        .insert({
          partner_id: partnerId,
          tier_key: tierKey,
          max_members: maxMembers,
          features_json: featuresJson,
          ...updates,
        })
        .select()
        .single();
      return { error };
    }
  }, []);

  const deletePartnerPricing = useCallback(async (partnerId: string, tierKey: string) => {
    const { error } = await supabase.from('partner_pricing').delete().eq('partner_id', partnerId).eq('tier_key', tierKey);
    return { error };
  }, []);

  // ─── Subscriptions list ───

  const fetchAllSubscriptions = useCallback(async () => {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });
    return (data || []) as Subscription[];
  }, []);

  // ─── Payout tracking ───

  const fetchPayouts = useCallback(async (partnerId?: string) => {
    let q = supabase.from('partner_payouts').select('*').order('period_end', { ascending: false });
    if (partnerId) q = q.eq('partner_id', partnerId);
    const { data } = await q;
    return (data || []) as PartnerPayout[];
  }, []);

  const createPayout = useCallback(async (payout: Partial<PartnerPayout>) => {
    const { data, error } = await supabase.from('partner_payouts').insert(payout).select().single();
    return { data, error };
  }, []);

  const updatePayout = useCallback(async (id: string, updates: Partial<PartnerPayout>) => {
    const { error } = await supabase.from('partner_payouts').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    return { error };
  }, []);

  /**
   * Aggregate all unpaid commission billing_events into pending payouts.
   * Calls the `aggregate_partner_payouts(period_start, period_end)` RPC
   * (see migration 00023). Idempotent — events get linked to the new payout
   * via `billing_events.payout_id` so subsequent runs don't double-count.
   *
   * Defaults to "events from last 30 days that aren't already in a payout".
   */
  const aggregatePartnerPayouts = useCallback(async (
    periodStart?: string,
    periodEnd?: string,
  ): Promise<{ data: any[] | null; error: any }> => {
    const params: Record<string, any> = {};
    if (periodStart) params.p_period_start = periodStart;
    if (periodEnd) params.p_period_end = periodEnd;
    const { data, error } = await supabase.rpc('aggregate_partner_payouts', params);
    return { data: (data as any[]) || null, error };
  }, []);

  const confirmPayout = useCallback(async (id: string, userId: string, achTracking: string, paymentDate: string, amount: number) => {
    const { error } = await supabase.from('partner_payouts').update({
      status: 'paid',
      ach_tracking_number: achTracking,
      payment_date: paymentDate,
      net_payout: amount,
      payment_confirmed_at: new Date().toISOString(),
      payment_confirmed_by: userId,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    return { error };
  }, []);

  // Calculate price helper
  const calculatePrice = (monthlyPrice: number, billingCycle: 'monthly' | 'annual', discountPct: number = 20) => {
    if (billingCycle === 'annual') {
      const annual = monthlyPrice * 12 * (1 - discountPct / 100);
      return { total: annual, perMonth: annual / 12, savings: monthlyPrice * 12 - annual };
    }
    return { total: monthlyPrice, perMonth: monthlyPrice, savings: 0 };
  };

  useEffect(() => {
    fetchPartners();
    fetchDefaultPricing();
  }, [fetchPartners, fetchDefaultPricing]);

  return {
    partners, defaultPricing, loading,
    fetchPartners, fetchDefaultPricing,
    getPartnerBySlug, getPartnerPricing,
    getCurrentTerms, hasAcceptedCurrentTerms, acceptTerms,
    getSubscription, getBillingHistory,
    calculatePrice,
    createPartner, updatePartner, deletePartner, uploadPartnerLogo,
    setPricingSelfManaged,
    fetchPartnerUsers, grantPartnerUserByEmail, invitePartnerUserByEmail, revokePartnerUser, setPartnerUserActive,
    updateDefaultTier,
    upsertPartnerPricing, deletePartnerPricing,
    fetchAllSubscriptions,
    fetchPayouts, createPayout, updatePayout, confirmPayout, aggregatePartnerPayouts,
  };
}
