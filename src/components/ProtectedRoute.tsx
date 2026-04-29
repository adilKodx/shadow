import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Routes that are available without any tenant context (work for platform
// admins, partner-only users, or anyone tenant-less).
const TENANT_LESS_ALLOWED = new Set<string>([
  '/white-label',
  '/partner',
  '/settings',
  '/changelog',
]);

// Routes partner-only users (no tenant, has partnerMembership) are allowed to visit.
const PARTNER_ONLY_ALLOWED = new Set<string>([
  '/partner',
  '/settings',
  '/changelog',
]);

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, tenant, partnerMembership, isPlatformAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Full tenant users can visit anything.
  if (tenant) return <>{children}</>;

  // Platform admins without a tenant: only allow the tenant-less routes.
  // Everything else (tenant-scoped pages) redirects to /white-label.
  if (isPlatformAdmin) {
    if (TENANT_LESS_ALLOWED.has(location.pathname)) return <>{children}</>;
    return <Navigate to="/white-label" replace />;
  }

  // Partner-only users (no tenant, no platform admin): narrow set of routes.
  if (partnerMembership) {
    if (PARTNER_ONLY_ALLOWED.has(location.pathname)) return <>{children}</>;
    return <Navigate to="/partner" replace />;
  }

  // Fully unaffiliated user (shouldn't normally happen) → back to login.
  return <Navigate to="/login" replace />;
}
