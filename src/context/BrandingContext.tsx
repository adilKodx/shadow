import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface BrandingContextType {
  appName: string;
  tagline: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  faviconUrl: string | null;
  loginBgUrl: string | null;
  customDomainSlug: string | null;
}

const defaults: BrandingContextType = {
  appName: 'ShadowField',
  tagline: 'Safety & Communication Platform',
  logoUrl: null,
  primaryColor: '#1e40af',
  secondaryColor: '#0ea5e9',
  accentColor: '#f59e0b',
  faviconUrl: null,
  loginBgUrl: null,
  customDomainSlug: null,
};

const BrandingContext = createContext<BrandingContextType>(defaults);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { tenant } = useAuth();
  const [domainBranding, setDomainBranding] = useState<BrandingContextType | null>(null);

  // On mount, check if the current hostname matches a tenant's custom_domain.
  // This allows white-label partners to show their branding on the login page
  // before the user is authenticated.
  useEffect(() => {
    async function detectCustomDomain() {
      const hostname = window.location.hostname;
      // Skip for localhost, shadowfield.app itself, and IP addresses
      if (
        hostname === 'localhost' ||
        hostname === 'shadowfield.app' ||
        hostname === 'www.shadowfield.app' ||
        hostname.endsWith('.netlify.app') ||
        hostname.endsWith('.vercel.app') ||
        /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
      ) return;

      // Look up the tenant by custom_domain
      const { data } = await supabase
        .from('tenants')
        .select('app_name, tagline, logo_url, primary_color, secondary_color, accent_color, favicon_url, login_bg_url, slug')
        .eq('custom_domain', hostname)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (data) {
        setDomainBranding({
          appName: data.app_name || defaults.appName,
          tagline: data.tagline || defaults.tagline,
          logoUrl: data.logo_url,
          primaryColor: data.primary_color || defaults.primaryColor,
          secondaryColor: data.secondary_color || defaults.secondaryColor,
          accentColor: data.accent_color || defaults.accentColor,
          faviconUrl: data.favicon_url,
          loginBgUrl: data.login_bg_url,
          customDomainSlug: data.slug,
        });
      }
    }
    detectCustomDomain();
  }, []);

  const branding = useMemo<BrandingContextType>(() => {
    // Priority: logged-in tenant > custom domain detection > defaults
    if (tenant) {
      return {
        appName: tenant.app_name || defaults.appName,
        tagline: tenant.tagline || defaults.tagline,
        logoUrl: tenant.logo_url,
        primaryColor: tenant.primary_color || defaults.primaryColor,
        secondaryColor: tenant.secondary_color || defaults.secondaryColor,
        accentColor: tenant.accent_color || defaults.accentColor,
        faviconUrl: tenant.favicon_url,
        loginBgUrl: tenant.login_bg_url,
        customDomainSlug: null,
      };
    }
    if (domainBranding) return domainBranding;
    return defaults;
  }, [tenant, domainBranding]);

  // Update favicon dynamically
  useEffect(() => {
    if (branding.faviconUrl) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
        || document.createElement('link');
      link.rel = 'icon';
      link.href = branding.faviconUrl;
      document.head.appendChild(link);
    }
    document.title = branding.appName;
  }, [branding.faviconUrl, branding.appName]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => useContext(BrandingContext);
