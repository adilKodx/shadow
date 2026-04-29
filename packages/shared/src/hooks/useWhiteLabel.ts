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
      const { error } = await supabase.from('partner_pricing').insert({ partner_id: partnerId, tier_key: tierKey, ...updates }).select().single();
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
    updateDefaultTier,
    upsertPartnerPricing, deletePartnerPricing,
    fetchAllSubscriptions,
    fetchPayouts, createPayout, updatePayout, confirmPayout,
  };
}
