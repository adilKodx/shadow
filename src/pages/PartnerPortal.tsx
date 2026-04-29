import { useState, useEffect, type ChangeEvent } from 'react';
import {
  Briefcase, Lock, RefreshCw, Save, Upload, Image as ImageIcon, X,
  LayoutDashboard, Palette, DollarSign, Building2, Banknote,
  Users, TrendingUp, Wallet, Clock, Copy, ExternalLink, Star, Check,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { usePartner } from '../hooks/usePartner';

type Tab = 'overview' | 'branding' | 'pricing' | 'tenants' | 'payouts';

export default function PartnerPortal() {
  const { user, loading: authLoading, partnerMembership, partnerMemberships, selectPartner } = useAuth();
  const partner = usePartner();
  const [tab, setTab] = useState<Tab>('overview');
  const [switcherOpen, setSwitcherOpen] = useState(false);

  // ─── ACCESS GUARD ───
  if (authLoading) {
    return (
      <div className="p-12 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!user || !partnerMembership) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Partner access only</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            This area is for white-label partners who resell ShadowField. If you
            should have access, ask the platform owner to grant your account a
            partner_user record.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {partner.partner?.logo_url ? (
            <img src={partner.partner.logo_url} className="w-10 h-10 rounded-lg object-contain bg-white border border-gray-200 p-1" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${partner.partner?.primary_color || '#1e40af'}, ${partner.partner?.secondary_color || '#0ea5e9'})` }}>
              <Briefcase className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="relative">
            {partnerMemberships.length > 1 ? (
              <button
                onClick={() => setSwitcherOpen(o => !o)}
                className="flex items-center gap-2 group"
                title="Switch partner"
              >
                <div className="text-left">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-1.5 group-hover:text-blue-600 transition-colors">
                    {partner.partner?.company_name || partnerMembership.partner_name}
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${switcherOpen ? 'rotate-180' : ''}`} />
                  </h2>
                  <p className="text-sm text-gray-500">
                    Partner portal · {partnerMembership.role} · {partner.partner?.commission_pct ?? '—'}% commission
                    <span className="ml-2 text-[10px] uppercase font-semibold text-blue-500">{partnerMemberships.length} partners</span>
                  </p>
                </div>
              </button>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-gray-900">{partner.partner?.company_name || partnerMembership.partner_name}</h2>
                <p className="text-sm text-gray-500">
                  Partner portal · {partnerMembership.role} · {partner.partner?.commission_pct ?? '—'}% commission
                </p>
              </div>
            )}

            {switcherOpen && partnerMemberships.length > 1 && (
              <>
                {/* Backdrop to dismiss on outside click */}
                <div className="fixed inset-0 z-30" onClick={() => setSwitcherOpen(false)} />
                <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl border border-gray-200 shadow-xl z-40 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                    <p className="text-[10px] font-semibold uppercase text-gray-500 tracking-wider">Switch partner</p>
                  </div>
                  {partnerMemberships.map(m => {
                    const active = m.partner_id === partnerMembership.partner_id;
                    return (
                      <button
                        key={m.partner_id}
                        onClick={() => {
                          selectPartner(m.partner_id);
                          setSwitcherOpen(false);
                          // usePartner reacts to context change — also kick a refresh in case
                          setTimeout(() => partner.refresh(), 0);
                        }}
                        className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left transition-colors ${
                          active ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">{m.partner_name}</div>
                          <div className="text-xs text-gray-500 truncate">/{m.partner_slug} · {m.role}</div>
                        </div>
                        {active && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => partner.refresh()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${partner.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {partner.lastError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-xl">
          {partner.lastError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
        {([
          { key: 'overview', label: 'Overview', icon: LayoutDashboard },
          { key: 'branding', label: 'Branding', icon: Palette },
          { key: 'pricing', label: 'Pricing', icon: DollarSign },
          { key: 'tenants', label: `Tenants (${partner.tenants.length})`, icon: Building2 },
          { key: 'payouts', label: `Payouts (${partner.payouts.length})`, icon: Banknote },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab partner={partner} />}
      {tab === 'branding' && <BrandingTab partner={partner} />}
      {tab === 'pricing' && <PricingTab partner={partner} />}
      {tab === 'tenants' && <TenantsTab partner={partner} />}
      {tab === 'payouts' && <PayoutsTab partner={partner} />}
    </div>
  );
}

// ═══ OVERVIEW ═══
function OverviewTab({ partner }: { partner: ReturnType<typeof usePartner> }) {
  const k = partner.kpis;
  const cards = [
    { label: 'Tenants', value: k.tenant_count, icon: Building2, color: 'blue' },
    { label: 'Active Subs', value: k.active_subscription_count, icon: Users, color: 'emerald' },
    { label: 'Trialing', value: k.trialing_count, icon: Clock, color: 'amber' },
    { label: 'MRR', value: `$${k.mrr.toFixed(2)}`, icon: TrendingUp, color: 'purple' },
    { label: 'Unpaid Commission', value: `$${k.unpaid_commission_amount.toFixed(2)}`, icon: Wallet, color: 'orange' },
    { label: 'Paid Out', value: `$${k.paid_commission_amount.toFixed(2)}`, icon: Banknote, color: 'green' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
              <c.icon className="w-3.5 h-3.5" />
              {c.label}
            </div>
            <div className="text-xl font-bold text-gray-900">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Recent commission events */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">Recent commission activity</h3>
          <p className="text-xs text-gray-500">Last 90 days. Auto-calculated when tenants pay.</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase">
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Event</th>
              <th className="text-right px-4 py-2">Amount</th>
              <th className="text-right px-4 py-2">Commission</th>
              <th className="text-left px-4 py-2">Paid?</th>
            </tr>
          </thead>
          <tbody>
            {partner.billingEvents.slice(0, 25).map(ev => (
              <tr key={ev.id} className="border-b border-gray-50">
                <td className="px-4 py-2 text-gray-600 text-xs">{format(new Date(ev.created_at), 'MMM d, yyyy')}</td>
                <td className="px-4 py-2 text-gray-700">{ev.event_type}</td>
                <td className="px-4 py-2 text-right">${Number(ev.amount || 0).toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-medium text-emerald-700">${Number(ev.commission_amount || 0).toFixed(2)}</td>
                <td className="px-4 py-2">
                  {(ev as any).commission_paid
                    ? <span className="px-2 py-0.5 text-[10px] bg-green-50 text-green-700 rounded-full font-medium">PAID</span>
                    : <span className="px-2 py-0.5 text-[10px] bg-amber-50 text-amber-700 rounded-full font-medium">PENDING</span>}
                </td>
              </tr>
            ))}
            {partner.billingEvents.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No commission activity yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══ BRANDING ═══
function BrandingTab({ partner }: { partner: ReturnType<typeof usePartner> }) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (partner.partner) {
      const p = partner.partner;
      setForm({
        company_name: p.company_name,
        tagline: p.tagline,
        primary_color: p.primary_color,
        secondary_color: p.secondary_color,
        accent_color: p.accent_color,
        contact_name: p.contact_name || '',
        contact_email: p.contact_email || '',
        contact_phone: p.contact_phone || '',
        website_url: p.website_url || '',
        hero_headline: p.hero_headline || '',
        hero_subheadline: p.hero_subheadline || '',
      });
    }
  }, [partner.partner]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const { error } = await partner.updatePartner(form);
    if (error) setError((error as any).message || 'Failed to save');
    setSaving(false);
  };

  const handleLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const { error } = await partner.uploadPartnerLogo(file);
    if (error) setError((error as any).message || 'Upload failed');
    setUploading(false);
  };

  if (!partner.partner) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        Loading partner record…
      </div>
    );
  }

  const p = partner.partner;
  const signupUrl = `${window.location.origin}/signup/${p.slug}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${form.primary_color || p.primary_color}10, ${form.secondary_color || p.secondary_color}10)` }}>
        <div>
          <h3 className="font-semibold text-gray-900">Brand & Marketing</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{signupUrl}</span>
            <button onClick={() => navigator.clipboard.writeText(signupUrl)} className="p-0.5 hover:bg-gray-200 rounded" title="Copy">
              <Copy className="w-3 h-3 text-gray-400" />
            </button>
            <a href={`/signup/${p.slug}`} target="_blank" rel="noopener" className="p-0.5 hover:bg-gray-200 rounded" title="Preview">
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </a>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <X className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-700">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
            <input type="text" value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Slug (locked)</label>
            <input type="text" value={p.slug} disabled
              className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm font-mono text-gray-500" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Tagline</label>
            <input type="text" value={form.tagline || ''} onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Logo */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Logo</h4>
          <div className="flex items-center gap-4">
            {p.logo_url ? (
              <img src={p.logo_url} alt="Logo" className="w-20 h-20 rounded-xl border border-gray-200 object-contain bg-white p-1" />
            ) : (
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <ImageIcon className="w-6 h-6 text-gray-300" />
              </div>
            )}
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium cursor-pointer transition-colors w-fit">
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading…' : 'Upload Logo'}
              <input type="file" accept="image/*" onChange={handleLogo} className="hidden" disabled={uploading} />
            </label>
          </div>
        </div>

        {/* Colors */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Brand colors</h4>
          <div className="grid grid-cols-3 gap-4">
            {(['primary_color', 'secondary_color', 'accent_color'] as const).map(key => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">{key.replace('_', ' ')}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form[key] || '#1e40af'}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
                  <input type="text" value={form[key] || ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Contact info</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact name</label>
              <input type="text" value={form.contact_name || ''} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.contact_email || ''} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={form.contact_phone || ''} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
              <input type="url" value={form.website_url || ''} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Marketing */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Signup page copy</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hero headline</label>
              <input type="text" value={form.hero_headline || ''} onChange={e => setForm(f => ({ ...f, hero_headline: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Hero subheadline</label>
              <textarea value={form.hero_subheadline || ''} onChange={e => setForm(f => ({ ...f, hero_subheadline: e.target.value }))}
                rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Locked admin-controlled fields */}
        <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-3 h-3" />
            <span className="font-semibold text-gray-700">Locked by platform owner</span>
          </div>
          Commission rate ({p.commission_pct}%), URL slug, active status, and pricing self-management are
          controlled by ShadowField staff. Reach out to your account contact to change these.
        </div>
      </div>
    </div>
  );
}

// ═══ PRICING ═══
function PricingTab({ partner }: { partner: ReturnType<typeof usePartner> }) {
  const [drafts, setDrafts] = useState<Record<string, { monthly_price: number; annual_discount_pct: number }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const overrideMap = new Map(partner.partnerPricing.map(o => [o.tier_key, o]));

  if (!partner.pricingSelfManaged) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Pricing is locked</h3>
            <p className="text-sm text-gray-600 mt-1">
              The platform owner has not enabled self-managed pricing for your partner account. Tenants signing
              up under your slug will see ShadowField's default tiers below.
            </p>
            <p className="text-xs text-gray-500 mt-3">Contact ShadowField staff to request pricing self-management.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {partner.defaultPricing.map(tier => (
            <div key={tier.tier_key} className="bg-white rounded-xl border-2 border-gray-200 p-5">
              {tier.is_popular && (
                <div className="flex items-center gap-1 text-blue-600 text-xs font-bold mb-2">
                  <Star className="w-3 h-3" /> POPULAR
                </div>
              )}
              <h3 className="text-lg font-bold text-gray-900">{tier.tier_name}</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4">{tier.description}</p>
              <div className="mb-2">
                <span className="text-3xl font-extrabold text-gray-900">${tier.monthly_price}</span>
                <span className="text-gray-500 text-sm">/mo</span>
              </div>
              <p className="text-xs text-gray-500">Up to {tier.max_members} members</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleSave = async (tierKey: string, defaults: { monthly_price: number; annual_discount_pct: number }) => {
    const draft = drafts[tierKey];
    if (!draft) return;
    setSaving(tierKey);
    setError('');
    const { error } = await partner.upsertPartnerPricing(tierKey, {
      monthly_price: draft.monthly_price,
      annual_discount_pct: draft.annual_discount_pct,
    });
    if (error) setError((error as any).message || 'Failed to save');
    else setDrafts(d => { const copy = { ...d }; delete copy[tierKey]; return copy; });
    setSaving(null);
  };

  const handleReset = async (tierKey: string) => {
    setSaving(tierKey);
    setError('');
    const { error } = await partner.deletePartnerPricing(tierKey);
    if (error) setError((error as any).message || 'Failed to reset');
    setSaving(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
        <strong>Self-managed pricing is enabled.</strong> Set custom monthly prices and annual discounts for each tier.
        Leave a tier untouched to use the platform default. Tenants signing up under your slug see your prices.
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <X className="w-4 h-4 text-red-500" />
          <span className="text-xs text-red-700">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {partner.defaultPricing.map(tier => {
          const override = overrideMap.get(tier.tier_key);
          const draft = drafts[tier.tier_key];
          const currentPrice = draft?.monthly_price ?? override?.monthly_price ?? tier.monthly_price;
          const currentDiscount = draft?.annual_discount_pct ?? override?.annual_discount_pct ?? tier.annual_discount_pct;
          const isOverridden = !!override && Number(override.monthly_price) !== Number(tier.monthly_price);
          const isDirty = !!draft;

          return (
            <div key={tier.tier_key} className={`bg-white rounded-xl border-2 p-5 transition-all ${
              isDirty ? 'border-blue-400 shadow-lg' : isOverridden ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
            }`}>
              {tier.is_popular && (
                <div className="flex items-center gap-1 text-blue-600 text-xs font-bold mb-2">
                  <Star className="w-3 h-3" /> POPULAR
                </div>
              )}
              <h3 className="text-lg font-bold text-gray-900">{tier.tier_name}</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4">{tier.description}</p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-600">Monthly price ($)</label>
                  <input type="number" min={0} step={1} value={currentPrice}
                    onChange={e => setDrafts(d => ({
                      ...d,
                      [tier.tier_key]: {
                        monthly_price: parseFloat(e.target.value) || 0,
                        annual_discount_pct: currentDiscount,
                      },
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-[10px] text-gray-400 mt-1">Default: ${tier.monthly_price}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Annual discount (%)</label>
                  <input type="number" min={0} max={100} step={1} value={currentDiscount}
                    onChange={e => setDrafts(d => ({
                      ...d,
                      [tier.tier_key]: {
                        monthly_price: currentPrice,
                        annual_discount_pct: parseFloat(e.target.value) || 0,
                      },
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <p className="text-xs text-gray-500">Up to {tier.max_members} members</p>

                {isOverridden && !isDirty && (
                  <div className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold">
                    <Check className="w-3 h-3" /> CUSTOM
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave(tier.tier_key, { monthly_price: tier.monthly_price, annual_discount_pct: tier.annual_discount_pct })}
                    disabled={!isDirty || saving === tier.tier_key}
                    className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {saving === tier.tier_key ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                  {isOverridden && (
                    <button
                      onClick={() => handleReset(tier.tier_key)}
                      disabled={saving === tier.tier_key}
                      className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs"
                      title="Reset to default"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══ TENANTS ═══
function TenantsTab({ partner }: { partner: ReturnType<typeof usePartner> }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">Your tenants</h3>
        <p className="text-xs text-gray-500">Organizations that signed up under your slug.</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase">
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-left px-4 py-2">Owner</th>
            <th className="text-left px-4 py-2">Slug</th>
            <th className="text-left px-4 py-2">Tier</th>
            <th className="text-left px-4 py-2">Status</th>
            <th className="text-right px-4 py-2">Price</th>
            <th className="text-left px-4 py-2">Period ends</th>
            <th className="text-left px-4 py-2">Joined</th>
          </tr>
        </thead>
        <tbody>
          {partner.tenants.map(t => (
            <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-2 font-medium text-gray-900">{t.name}</td>
              <td className="px-4 py-2">
                {t.owner_email ? (
                  <div className="flex flex-col">
                    {t.owner_name && (
                      <span className="text-gray-900">{t.owner_name}</span>
                    )}
                    <a
                      href={`mailto:${t.owner_email}`}
                      className="text-xs text-blue-600 hover:underline break-all"
                    >
                      {t.owner_email}
                    </a>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-xs font-mono text-gray-500">{t.slug}</td>
              <td className="px-4 py-2">
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium capitalize">{t.subscription_tier}</span>
              </td>
              <td className="px-4 py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  t.status === 'active' ? 'bg-green-50 text-green-700' :
                  t.status === 'trialing' ? 'bg-blue-50 text-blue-700' :
                  t.status === 'past_due' ? 'bg-amber-50 text-amber-700' :
                  t.status === 'canceled' ? 'bg-red-50 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{t.status || '—'}</span>
              </td>
              <td className="px-4 py-2 text-right">
                {t.effective_price != null ? `$${Number(t.effective_price).toFixed(2)}/${t.billing_cycle === 'annual' ? 'yr' : 'mo'}` : '—'}
              </td>
              <td className="px-4 py-2 text-xs text-gray-600">
                {t.current_period_end ? format(new Date(t.current_period_end), 'MMM d, yyyy') : '—'}
              </td>
              <td className="px-4 py-2 text-xs text-gray-600">
                {format(new Date(t.created_at), 'MMM d, yyyy')}
              </td>
            </tr>
          ))}
          {partner.tenants.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No tenants yet. Share your signup link to get started.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ═══ PAYOUTS ═══
function PayoutsTab({ partner }: { partner: ReturnType<typeof usePartner> }) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        Payouts are aggregated weekly from your unpaid commission events. ShadowField processes ACH within 30 days
        of period end. Read-only — only platform staff can mark a payout paid.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase">
              <th className="text-left px-4 py-2">Period</th>
              <th className="text-right px-4 py-2">Revenue</th>
              <th className="text-right px-4 py-2">Commission</th>
              <th className="text-right px-4 py-2">Net Payout</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">ACH ref</th>
              <th className="text-left px-4 py-2">Paid</th>
            </tr>
          </thead>
          <tbody>
            {partner.payouts.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-600">
                  {format(new Date(p.period_start), 'MMM d')} — {format(new Date(p.period_end), 'MMM d, yyyy')}
                </td>
                <td className="px-4 py-2 text-right">${Number(p.gross_revenue).toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-gray-600">
                  ${Number(p.commission_amount).toFixed(2)} ({p.commission_pct}%)
                </td>
                <td className="px-4 py-2 text-right font-semibold text-emerald-700">${Number(p.net_payout).toFixed(2)}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.status === 'paid' ? 'bg-green-50 text-green-700' :
                    p.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                    p.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{p.status}</span>
                </td>
                <td className="px-4 py-2 text-xs font-mono text-gray-600">{p.ach_tracking_number || '—'}</td>
                <td className="px-4 py-2 text-xs text-gray-600">
                  {p.payment_date ? format(new Date(p.payment_date), 'MMM d, yyyy') : '—'}
                </td>
              </tr>
            ))}
            {partner.payouts.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                <Banknote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No payouts yet. Aggregation runs after commission accrues.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
