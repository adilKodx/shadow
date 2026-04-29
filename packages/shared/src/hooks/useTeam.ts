import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { TenantMember } from '../context/AuthContext';

export interface TenantInvite {
  id: string;
  tenant_id: string;
  code: string;
  role: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  invited_email: string | null;
  invited_name: string | null;
}

export const MEMBER_ROLES = [
  { value: 'owner', label: 'Owner', color: 'bg-amber-100 text-amber-800', description: 'Full control over organization' },
  { value: 'admin', label: 'Admin', color: 'bg-red-100 text-red-800', description: 'Manage team, settings, and all content' },
  { value: 'supervisor', label: 'Supervisor', color: 'bg-blue-100 text-blue-800', description: 'Manage incidents, POI, and team operations' },
  { value: 'member', label: 'Member', color: 'bg-green-100 text-green-800', description: 'Report incidents, view feeds, chat' },
  { value: 'viewer', label: 'Viewer', color: 'bg-gray-100 text-gray-800', description: 'View-only access' },
] as const;

export const PLAN_TIERS = [
  { key: 'starter', name: 'Starter', members: 3, price: 25 },
  { key: 'professional', name: 'Professional', members: 8, price: 50 },
  { key: 'ministry', name: 'Ministry', members: 15, price: 150 },
  { key: 'enterprise', name: 'Enterprise', members: 999, price: 0 },
] as const;

export function useTeam() {
  const { tenant, user } = useAuth();
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [invites, setInvites] = useState<TenantInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [memberLimit, setMemberLimit] = useState<number>(3);

  // Active member count
  const activeMembers = useMemo(() => members.filter(m => m.is_active), [members]);
  const memberCount = activeMembers.length;
  const seatsRemaining = Math.max(0, memberLimit - memberCount);
  const canInvite = memberCount < memberLimit;
  const usagePercent = memberLimit > 0 ? Math.min(100, (memberCount / memberLimit) * 100) : 0;
  const currentTier = tenant?.subscription_tier || 'starter';
  const nextTier = PLAN_TIERS.find(t => t.members > memberLimit) || null;

  const fetchMembers = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from('tenant_members')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('role')
      .order('display_name');
    if (data) setMembers(data);
    setLoading(false);
  }, [tenant]);

  // Fetch the actual member limit from the pricing tables
  const fetchMemberLimit = useCallback(async () => {
    if (!tenant) return;
    const tier = tenant.subscription_tier || 'starter';

    // Check partner pricing first
    if (tenant.partner_id) {
      const { data: pp } = await supabase
        .from('partner_pricing')
        .select('max_members')
        .eq('partner_id', tenant.partner_id)
        .eq('tier_key', tier)
        .eq('is_active', true)
        .maybeSingle();
      if (pp?.max_members) { setMemberLimit(pp.max_members); return; }
    }

    // Fallback to default pricing
    const { data: dp } = await supabase
      .from('default_pricing')
      .select('max_members')
      .eq('tier_key', tier)
      .eq('is_active', true)
      .maybeSingle();
    if (dp?.max_members) setMemberLimit(dp.max_members);
    else setMemberLimit(tenant.max_members || 3);
  }, [tenant]);

  const updateMember = useCallback(async (id: string, updates: Partial<TenantMember>) => {
    const { error } = await supabase
      .from('tenant_members')
      .update(updates)
      .eq('id', id);
    if (!error) await fetchMembers();
    return { error };
  }, [fetchMembers]);

  const removeMember = useCallback(async (id: string) => {
    await supabase.from('tenant_members').update({ is_active: false }).eq('id', id);
    await fetchMembers();
  }, [fetchMembers]);

  const fetchInvites = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('tenant_invites')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (data) setInvites(data);
  }, [tenant]);

  const createInvite = useCallback(async (role: string, maxUses: number = 1, email?: string, name?: string) => {
    if (!tenant || !user) return { data: null, error: 'Not authenticated' };

    // Client-side cap check (server RPC also enforces this)
    if (!canInvite) {
      return { data: null, error: `Member limit reached (${memberLimit}). Upgrade your plan to add more members.` };
    }

    const { data, error } = await supabase
      .from('tenant_invites')
      .insert({
        tenant_id: tenant.id,
        role,
        max_uses: maxUses,
        created_by: user.id,
        invited_email: email || null,
        invited_name: name || null,
      })
      .select()
      .single();
    if (data) await fetchInvites();
    return { data, error };
  }, [tenant, user, fetchInvites, canInvite, memberLimit]);

  const revokeInvite = useCallback(async (id: string) => {
    await supabase.from('tenant_invites').update({ is_active: false }).eq('id', id);
    await fetchInvites();
  }, [fetchInvites]);

  // Upgrade subscription tier
  const upgradeTier = useCallback(async (newTier: string) => {
    if (!tenant) return { error: 'No tenant' };
    const { data, error } = await supabase.rpc('upgrade_subscription_tier', {
      p_tenant_id: tenant.id,
      p_new_tier: newTier,
    });
    if (!error && data) {
      // Refresh member limit after upgrade
      await fetchMemberLimit();
    }
    return { data, error };
  }, [tenant, fetchMemberLimit]);

  useEffect(() => {
    fetchMembers();
    fetchInvites();
    fetchMemberLimit();
  }, [fetchMembers, fetchInvites, fetchMemberLimit]);

  return {
    members, activeMembers, invites, loading,
    memberCount, memberLimit, seatsRemaining, canInvite, usagePercent,
    currentTier, nextTier,
    fetchMembers, updateMember, removeMember,
    fetchInvites, createInvite, revokeInvite,
    upgradeTier,
  };
}
