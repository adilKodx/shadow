import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface TenantMember {
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

interface Tenant {
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

interface PartnerMembership {
  partner_id: string;
  partner_slug: string;
  partner_name: string;
  role: 'owner' | 'staff';
  pricing_self_managed: boolean;
}

const PARTNER_SELECTION_KEY = 'shadowfield:selected_partner_id';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  tenant: Tenant | null;
  member: TenantMember | null;
  loading: boolean;
  isPlatformAdmin: boolean;
  /** All active partner_users grants for the signed-in user */
  partnerMemberships: PartnerMembership[];
  /** The currently-selected partner context (from localStorage, falls back to first) */
  partnerMembership: PartnerMembership | null;
  /** Switch the active partner context (persists to localStorage) */
  selectPartner: (partnerId: string) => void;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, displayName: string, orgName?: string, inviteCode?: string, partnerSlug?: string, tierKey?: string, billingCycle?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  tenant: null,
  member: null,
  loading: true,
  isPlatformAdmin: false,
  partnerMemberships: [],
  partnerMembership: null,
  selectPartner: () => {},
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshTenant: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [member, setMember] = useState<TenantMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [partnerMemberships, setPartnerMemberships] = useState<PartnerMembership[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(PARTNER_SELECTION_KEY);
  });

  // The currently-active partner context. Prefer the explicitly-selected one;
  // otherwise fall back to the first active grant.
  const partnerMembership: PartnerMembership | null = (() => {
    if (partnerMemberships.length === 0) return null;
    if (selectedPartnerId) {
      const found = partnerMemberships.find(m => m.partner_id === selectedPartnerId);
      if (found) return found;
    }
    return partnerMemberships[0];
  })();

  const selectPartner = (partnerId: string) => {
    if (!partnerMemberships.some(m => m.partner_id === partnerId)) return;
    setSelectedPartnerId(partnerId);
    try { window.localStorage.setItem(PARTNER_SELECTION_KEY, partnerId); } catch { /* ignore */ }
  };

  const loadTenantData = async (uid: string) => {
    try {
      // Get user's tenant membership
      const { data: memberData } = await supabase
        .from('tenant_members')
        .select('*')
        .eq('user_id', uid)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (memberData) {
        setMember(memberData as TenantMember);

        // Load tenant
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', memberData.tenant_id)
          .single();

        if (tenantData) {
          setTenant(tenantData as Tenant);
        }

        // Update last_seen
        await supabase
          .from('tenant_members')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', memberData.id);
      }

      // Check platform admin status (gracefully handle pre-migration DBs)
      try {
        const { data: adminFlag } = await supabase.rpc('is_platform_admin');
        setIsPlatformAdmin(!!adminFlag);
      } catch {
        setIsPlatformAdmin(false);
      }

      // Load ALL active partner memberships (gracefully handle pre-migration DBs)
      try {
        const { data: pus } = await supabase
          .from('partner_users')
          .select('partner_id, role, partner:white_label_partners(id, slug, company_name, pricing_self_managed)')
          .eq('user_id', uid)
          .eq('is_active', true)
          .order('granted_at', { ascending: true });
        const memberships: PartnerMembership[] = (pus || [])
          .map((pu: any) => {
            const p = Array.isArray(pu.partner) ? pu.partner[0] : pu.partner;
            if (!p) return null;
            return {
              partner_id: p.id,
              partner_slug: p.slug,
              partner_name: p.company_name,
              role: pu.role as 'owner' | 'staff',
              pricing_self_managed: !!p.pricing_self_managed,
            };
          })
          .filter((m: PartnerMembership | null): m is PartnerMembership => m !== null);
        setPartnerMemberships(memberships);
      } catch {
        setPartnerMemberships([]);
      }
    } catch (err) {
      console.error('Error loading tenant data:', err);
    }
  };

  useEffect(() => {
    // onAuthStateChange fires an `INITIAL_SESSION` event on mount with the
    // cached session (if any), then SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED for
    // subsequent changes. We rely on it as the single source of truth so we
    // don't double-fetch role data on mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Re-enter loading while we fetch tenant/admin/partner role flags so
        // route guards (ProtectedRoute, DefaultLanding) show a spinner instead
        // of bouncing to /login when role data is briefly null.
        setLoading(true);
        loadTenantData(s.user.id).finally(() => setLoading(false));
      } else {
        setTenant(null);
        setMember(null);
        setIsPlatformAdmin(false);
        setPartnerMemberships([]);
        setSelectedPartnerId(null);
        try { window.localStorage.removeItem(PARTNER_SELECTION_KEY); } catch { /* ignore */ }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName: string, orgName?: string, inviteCode?: string, partnerSlug?: string, tierKey?: string, billingCycle?: string) => {
    // ATOMIC SIGNUP — see migration 00025.
    // We pack all signup metadata into options.data so it lands in
    // auth.users.raw_user_meta_data. A DB trigger (handle_new_auth_user)
    // then provisions the tenant in the SAME transaction as the auth user
    // creation. If anything fails, the auth user creation also rolls back —
    // no orphaned auth users possible.
    const finalOrgName = orgName || `${displayName}'s Organization`;
    const userMetadata: Record<string, string> = {
      display_name: displayName,
      signup_type: inviteCode ? 'invite' : 'new_tenant',
    };
    if (inviteCode) {
      userMetadata.invite_code = inviteCode;
    } else {
      userMetadata.org_name      = finalOrgName;
      userMetadata.tier_key      = tierKey || 'starter';
      userMetadata.billing_cycle = billingCycle || 'monthly';
      if (partnerSlug) userMetadata.partner_slug = partnerSlug;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: userMetadata },
    });
    // If the trigger raised, supabase.auth.signUp will return that error here
    // (the user's auth row was rolled back). The user gets a clear failure
    // instead of being silently stranded with no tenant.
    if (authError) return { error: authError };
    if (!authData.user?.id) return { error: { message: 'Failed to create user' } };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setTenant(null);
    setMember(null);
    setIsPlatformAdmin(false);
    setPartnerMemberships([]);
    setSelectedPartnerId(null);
    try { window.localStorage.removeItem(PARTNER_SELECTION_KEY); } catch { /* ignore */ }
  };

  const refreshTenant = async () => {
    if (user) await loadTenantData(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, tenant, member, loading, isPlatformAdmin, partnerMemberships, partnerMembership, selectPartner, signIn, signUp, signOut, refreshTenant }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export type { Tenant, TenantMember, PartnerMembership };
