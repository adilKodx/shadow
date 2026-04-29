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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  tenant: Tenant | null;
  member: TenantMember | null;
  loading: boolean;
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
    } catch (err) {
      console.error('Error loading tenant data:', err);
    }
  };

  useEffect(() => {
    let initialLoad = true;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadTenantData(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Error getting session:', err);
      setLoading(false);
    }).finally(() => {
      // Allow auth state change listener to process after initial load
      setTimeout(() => { initialLoad = false; }, 1000);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      // Skip the initial fire — getSession already handled it
      if (initialLoad) return;
      try {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          loadTenantData(s.user.id).catch(err => console.error('Auth change load error:', err));
        } else {
          setTenant(null);
          setMember(null);
        }
      } catch (err) {
        console.error('Auth state change error:', err);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, displayName: string, orgName?: string, inviteCode?: string, partnerSlug?: string, tierKey?: string, billingCycle?: string) => {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (authError) return { error: authError };

    const uid = authData.user?.id;
    if (!uid) return { error: { message: 'Failed to create user' } };

    // 2. If invite code, join that tenant via RPC (bypasses RLS)
    if (inviteCode) {
      const { data: joinResult, error: joinError } = await supabase.rpc('join_tenant_with_invite', {
        p_user_id: uid,
        p_display_name: displayName,
        p_email: email,
        p_invite_code: inviteCode,
      });

      if (joinError) return { error: joinError };
      if (joinResult?.error) return { error: { message: joinResult.error } };
      return { error: null };
    }

    // 3. Create new tenant via RPC (bypasses RLS for fresh signup)
    const finalOrgName = orgName || `${displayName}'s Organization`;
    const { data: createResult, error: createError } = await supabase.rpc('create_tenant_and_owner', {
      p_user_id: uid,
      p_display_name: displayName,
      p_email: email,
      p_org_name: finalOrgName,
      p_partner_slug: partnerSlug || null,
      p_tier_key: tierKey || 'starter',
      p_billing_cycle: billingCycle || 'monthly',
    });

    if (createError) return { error: createError };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setTenant(null);
    setMember(null);
  };

  const refreshTenant = async () => {
    if (user) await loadTenantData(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, tenant, member, loading, signIn, signUp, signOut, refreshTenant }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export type { Tenant, TenantMember };
