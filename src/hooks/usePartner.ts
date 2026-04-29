import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type {
  WhiteLabelPartner,
  PricingTier,
  PartnerPricing,
  Subscription,
  BillingEvent,
  PartnerPayout,
} from './useWhiteLabel';

export interface PartnerTenantSummary {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  billing_cycle: string;
  is_active: boolean;
  created_at: string;
  // joined from subscriptions
  status: string | null;
  effective_price: number | null;
  current_period_end: string | null;
  // joined from tenant_members where role = 'owner'
  owner_email: string | null;
  owner_name: string | null;
}

export interface PartnerKpis {
  tenant_count: number;
  active_subscription_count: number;
  trialing_count: number;
  mrr: number;
  // commissions
  unpaid_commission_amount: number;
  paid_commission_amount: number;
  pending_payout_count: number;
}

/**
 * Partner-scoped data hook. Reads/writes are RLS-gated by `is_partner_user_for(partner_id)`
 * (see migration 00022). Pricing writes additionally require the platform owner
 * to flip `white_label_partners.pricing_self_managed` to true.
 *
 * Caller should branch on `partnerMembership` from AuthContext to decide whether
 * to mount this hook at all — calling it without an active membership returns
 * empty data and disables mutations.
 */
export function usePartner() {
  const { partnerMembership } = useAuth();
  const partnerId = partnerMembership?.partner_id ?? null;
  const selfManaged = !!partnerMembership?.pricing_self_managed;

  const [partner, setPartner] = useState<WhiteLabelPartner | null>(null);
  const [defaultPricing, setDefaultPricing] = useState<PricingTier[]>([]);
  const [partnerPricing, setPartnerPricing] = useState<PartnerPricing[]>([]);
  const [tenants, setTenants] = useState<PartnerTenantSummary[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [billingEvents, setBillingEvents] = useState<BillingEvent[]>([]);
  const [payouts, setPayouts] = useState<PartnerPayout[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // ─── Fetchers ───
  const fetchPartner = useCallback(async () => {
    if (!partnerId) { setPartner(null); return; }
    const { data, error } = await supabase
      .from('white_label_partners')
      .select('*')
      .eq('id', partnerId)
      .maybeSingle();
    if (error) console.error('[usePartner] fetchPartner', error);
    setPartner((data as WhiteLabelPartner) || null);
  }, [partnerId]);

  const fetchDefaultPricing = useCallback(async () => {
    const { data } = await supabase
      .from('default_pricing')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setDefaultPricing((data || []) as PricingTier[]);
  }, []);

  const fetchPartnerPricing = useCallback(async () => {
    if (!partnerId) { setPartnerPricing([]); return; }
    const { data } = await supabase
      .from('partner_pricing')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('is_active', true);
    setPartnerPricing((data || []) as PartnerPricing[]);
  }, [partnerId]);

  const fetchTenants = useCallback(async () => {
    if (!partnerId) { setTenants([]); return; }
    const { data: tenantRows } = await supabase
      .from('tenants')
      .select('id, name, slug, subscription_tier, billing_cycle, is_active, created_at')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });

    if (!tenantRows || tenantRows.length === 0) { setTenants([]); return; }

    const tenantIds = (tenantRows as any[]).map(t => t.id);

    // Latest subscription per tenant
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('tenant_id, status, effective_price, current_period_end, created_at')
      .in('tenant_id', tenantIds)
      .order('created_at', { ascending: false });

    const subByTenant = new Map<string, any>();
    (subs || []).forEach((s: any) => {
      if (!subByTenant.has(s.tenant_id)) subByTenant.set(s.tenant_id, s);
    });

    // Owner contact per tenant — needs the partner SELECT policy on
    // tenant_members from migration 00029. If the user is not yet on a DB
    // with that migration the query simply returns nothing and we fall back
    // to nulls (no error surfaced to the partner).
    const { data: owners } = await supabase
      .from('tenant_members')
      .select('tenant_id, email, display_name, role, joined_at')
      .in('tenant_id', tenantIds)
      .eq('role', 'owner')
      .order('joined_at', { ascending: true });

    const ownerByTenant = new Map<string, { email: string | null; display_name: string | null }>();
    (owners || []).forEach((o: any) => {
      // First (oldest) owner row wins — that's the original signup user.
      if (!ownerByTenant.has(o.tenant_id)) {
        ownerByTenant.set(o.tenant_id, {
          email: o.email ?? null,
          display_name: o.display_name ?? null,
        });
      }
    });

    setTenants(
      (tenantRows as any[]).map(t => {
        const s = subByTenant.get(t.id);
        const o = ownerByTenant.get(t.id);
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          subscription_tier: t.subscription_tier,
          billing_cycle: t.billing_cycle,
          is_active: t.is_active,
          created_at: t.created_at,
          status: s?.status ?? null,
          effective_price: s?.effective_price ?? null,
          current_period_end: s?.current_period_end ?? null,
          owner_email: o?.email ?? null,
          owner_name: o?.display_name ?? null,
        } as PartnerTenantSummary;
      })
    );
  }, [partnerId]);

  const fetchSubscriptions = useCallback(async () => {
    if (!partnerId) { setSubscriptions([]); return; }
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });
    setSubscriptions((data || []) as Subscription[]);
  }, [partnerId]);

  const fetchBillingEvents = useCallback(async (sinceDays = 90) => {
    if (!partnerId) { setBillingEvents([]); return; }
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const { data } = await supabase
      .from('billing_events')
      .select('*')
      .eq('partner_id', partnerId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });
    setBillingEvents((data || []) as BillingEvent[]);
  }, [partnerId]);

  const fetchPayouts = useCallback(async () => {
    if (!partnerId) { setPayouts([]); return; }
    const { data } = await supabase
      .from('partner_payouts')
      .select('*')
      .eq('partner_id', partnerId)
      .order('period_end', { ascending: false });
    setPayouts((data || []) as PartnerPayout[]);
  }, [partnerId]);

  const fetchAll = useCallback(async () => {
    if (!partnerId) return;
    setLoading(true);
    setLastError(null);
    try {
      await Promise.all([
        fetchPartner(),
        fetchDefaultPricing(),
        fetchPartnerPricing(),
        fetchTenants(),
        fetchSubscriptions(),
        fetchBillingEvents(),
        fetchPayouts(),
      ]);
    } catch (err: any) {
      setLastError(err?.message || 'Failed to load partner data');
    } finally {
      setLoading(false);
    }
  }, [
    partnerId,
    fetchPartner,
    fetchDefaultPricing,
    fetchPartnerPricing,
    fetchTenants,
    fetchSubscriptions,
    fetchBillingEvents,
    fetchPayouts,
  ]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Mutations ───

  /**
   * Update fields on the partner's own white_label_partners row.
   * RLS strips this to scope; we ALSO strip platform-owner-only fields
   * here to avoid the partner trying to edit their own commission_pct or
   * pricing_self_managed flag. The DB doesn't enforce this column-level
   * — the UI is the gate.
   */
  const updatePartner = useCallback(async (updates: Partial<WhiteLabelPartner>) => {
    if (!partnerId) return { error: { message: 'No active partner' } };
    const {
      id: _id,
      slug: _slug,
      commission_pct: _commission_pct,
      commission_type: _commission_type,
      is_active: _is_active,
      // @ts-ignore — server-managed
      pricing_self_managed: _psm,
      // @ts-ignore — server-managed
      created_at, updated_at, approved_at, approved_by,
      ...payload
    } = updates as any;
    const { error } = await supabase
      .from('white_label_partners')
      .update(payload)
      .eq('id', partnerId);
    if (!error) await fetchPartner();
    return { error };
  }, [partnerId, fetchPartner]);

  const uploadPartnerLogo = useCallback(async (file: File) => {
    if (!partnerId) return { error: { message: 'No active partner' }, url: null as string | null };
    const ext = file.name.split('.').pop();
    const path = `logos/${partnerId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('tenant-branding')
      .upload(path, file, { upsert: true });
    if (upErr) return { error: upErr, url: null };
    const { data: { publicUrl } } = supabase.storage.from('tenant-branding').getPublicUrl(path);
    const { error } = await supabase
      .from('white_label_partners')
      .update({ logo_url: publicUrl })
      .eq('id', partnerId);
    if (!error) await fetchPartner();
    return { error, url: publicUrl };
  }, [partnerId, fetchPartner]);

  /**
   * Upsert a partner_pricing row. RLS will reject this unless
   * `pricing_self_managed` is true on the partner row, so we surface the
   * gate clearly here too.
   */
  const upsertPartnerPricing = useCallback(async (
    tierKey: string,
    updates: Partial<PartnerPricing>,
  ) => {
    if (!partnerId) return { error: { message: 'No active partner' } };
    if (!selfManaged) {
      return { error: { message: 'Pricing is locked by the platform owner. Ask your contact at ShadowField to enable self-managed pricing.' } };
    }
    const { data: existing } = await supabase
      .from('partner_pricing')
      .select('id')
      .eq('partner_id', partnerId)
      .eq('tier_key', tierKey)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('partner_pricing')
        .update(updates)
        .eq('id', existing.id);
      if (!error) await fetchPartnerPricing();
      return { error };
    }

    // Inherit max_members + features_json from default_pricing on insert
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
      });
    if (!error) await fetchPartnerPricing();
    return { error };
  }, [partnerId, selfManaged, fetchPartnerPricing]);

  const deletePartnerPricing = useCallback(async (tierKey: string) => {
    if (!partnerId) return { error: { message: 'No active partner' } };
    if (!selfManaged) return { error: { message: 'Pricing is locked by the platform owner.' } };
    const { error } = await supabase
      .from('partner_pricing')
      .delete()
      .eq('partner_id', partnerId)
      .eq('tier_key', tierKey);
    if (!error) await fetchPartnerPricing();
    return { error };
  }, [partnerId, selfManaged, fetchPartnerPricing]);

  // ─── KPIs ───
  const kpis: PartnerKpis = (() => {
    const tenant_count = tenants.length;
    const active_subscription_count = subscriptions.filter(s => s.status === 'active').length;
    const trialing_count = subscriptions.filter(s => s.status === 'trialing').length;
    const mrr = subscriptions
      .filter(s => s.status === 'active')
      .reduce((sum, s) => {
        const monthly = s.billing_cycle === 'annual'
          ? Number(s.effective_price) / 12
          : Number(s.effective_price);
        return sum + (Number.isFinite(monthly) ? monthly : 0);
      }, 0);

    const unpaid_commission_amount = billingEvents
      .filter(e => e.commission_amount && !(e as any).commission_paid)
      .reduce((sum, e) => sum + Number(e.commission_amount || 0), 0);
    const paid_commission_amount = payouts
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + Number(p.net_payout || 0), 0);
    const pending_payout_count = payouts.filter(p => p.status !== 'paid').length;

    return {
      tenant_count,
      active_subscription_count,
      trialing_count,
      mrr,
      unpaid_commission_amount,
      paid_commission_amount,
      pending_payout_count,
    };
  })();

  return {
    // identity
    partnerId,
    partner,
    isPartnerUser: !!partnerId,
    pricingSelfManaged: selfManaged,
    // data
    defaultPricing,
    partnerPricing,
    tenants,
    subscriptions,
    billingEvents,
    payouts,
    kpis,
    loading,
    lastError,
    // refresh
    refresh: fetchAll,
    fetchPartner,
    fetchPartnerPricing,
    fetchTenants,
    fetchSubscriptions,
    fetchBillingEvents,
    fetchPayouts,
    // mutations
    updatePartner,
    uploadPartnerLogo,
    upsertPartnerPricing,
    deletePartnerPricing,
  };
}
