import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Shield, AlertTriangle, Bell,
  Newspaper, Camera, Users, Settings, ChevronLeft, ChevronRight,
  ShieldAlert, Palette, Map, Lock, Building2, FileText, CalendarCheck,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

// Every tenant-scoped nav item is flagged `tenantOnly` so we can hide them
// from partner-only staff (users with no tenant context).
const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, tenantOnly: true },
  { path: '/map', label: 'Live Map', icon: Map, tenantOnly: true },
  { path: '/chat', label: 'Team Chat', icon: MessageSquare, tenantOnly: true },
  { path: '/alerts', label: 'Alerts', icon: Bell, tenantOnly: true },
  { path: '/incidents', label: 'Incidents', icon: AlertTriangle, tenantOnly: true },
  { path: '/sops', label: 'SOPs & Action Plans', icon: FileText, tenantOnly: true },
  { path: '/poi', label: 'Persons of Interest', icon: ShieldAlert, tenantOnly: true },
  { path: '/news', label: 'News & Updates', icon: Newspaper, tenantOnly: true },
  { path: '/video-feeds', label: 'Video Feeds', icon: Camera, tenantOnly: true },
  { path: '/attendance', label: 'Attendance', icon: CalendarCheck, tenantOnly: true },
  { path: '/team', label: 'Team', icon: Users, tenantOnly: true },
  { path: '/branding', label: 'Branding', icon: Palette, tenantOnly: true, adminOnly: true },
  { path: '/partner', label: 'Partner Portal', icon: Briefcase, partnerOnly: true },
  { path: '/white-label', label: 'White-Label & Pricing', icon: Building2, platformAdminOnly: true },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { tenant, member, isPlatformAdmin, partnerMembership } = useAuth();
  const { appName, logoUrl, primaryColor } = useBranding();
  const location = useLocation();

  const isAdmin = member?.role === 'owner' || member?.role === 'admin';
  const isPartner = !!partnerMembership;

  const filteredItems = NAV_ITEMS.filter(item => {
    // Tenant-scoped items require an active tenant. Hides them from
    // platform-admin-only accounts (like Leith) and partner-only accounts.
    if ((item as any).tenantOnly && !tenant) return false;

    // Role-gated items
    if ((item as any).platformAdminOnly) return isPlatformAdmin;
    if ((item as any).partnerOnly) return isPartner;
    if ((item as any).adminOnly) return isAdmin;
    return true;
  });

  return (
    <aside
      className={`${collapsed ? 'w-16' : 'w-60'} transition-all duration-200 bg-slate-900 text-white flex flex-col h-screen sticky top-0 z-30`}
    >
      {/* Logo / App name */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700/50">
        {logoUrl ? (
          <img src={logoUrl} alt={appName} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, #0ea5e9)` }}
          >
            <Shield className="w-5 h-5 text-white" />
          </div>
        )}
        {!collapsed && (
          <span className="text-sm font-bold truncate">{appName}</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {filteredItems.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-3 border-t border-slate-700/50 text-slate-400 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
