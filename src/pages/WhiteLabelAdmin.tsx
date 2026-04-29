import { useState, useEffect } from 'react';
import {
  Building2, Plus, Trash2, Save, ExternalLink, DollarSign, Percent, Upload, Image,
  Users, Globe, Palette, RefreshCw, ChevronRight, Copy, Eye, EyeOff,
  Check, X, Edit3, Tag, Star, Settings, Banknote, CheckCircle2, UserPlus,
} from 'lucide-react';
import { useWhiteLabel, type WhiteLabelPartner, type PricingTier, type Subscription, type PartnerPayout, type PartnerUser } from '../hooks/useWhiteLabel';
import { useAuth } from '../context/AuthContext';
import { format, addDays } from 'date-fns';
import { Lock } from 'lucide-react';

const EMPTY_PARTNER: Partial<WhiteLabelPartner> = {
  slug: '', company_name: '', tagline: '',
  primary_color: '#1e40af', secondary_color: '#0ea5e9', accent_color: '#f59e0b',
  commission_pct: 15, commission_type: 'recurring',
  hero_headline: '', hero_subheadline: '',
  contact_name: '', contact_email: '', contact_phone: '', website_url: '',
  features_json: [], testimonials_json: [], faq_json: [],
  is_active: true,
};

export default function WhiteLabelAdmin() {
  const { user, isPlatformAdmin, loading: authLoading } = useAuth();
  const {
    partners, defaultPricing, loading,
    fetchPartners, fetchDefaultPricing,
    createPartner, updatePartner, deletePartner,
    setPricingSelfManaged,
    fetchPartnerUsers, invitePartnerUserByEmail, revokePartnerUser, setPartnerUserActive,
    updateDefaultTier, getPartnerPricing,
    upsertPartnerPricing, deletePartnerPricing, uploadPartnerLogo,
    fetchAllSubscriptions,
    fetchPayouts, createPayout, updatePayout, confirmPayout, aggregatePartnerPayouts,
  } = useWhiteLabel();

  const [tab, setTab] = useState<'partners' | 'pricing' | 'subscriptions' | 'payouts'>('partners');
  const [selectedPartner, setSelectedPartner] = useState<WhiteLabelPartner | null>(null);
  const [partnerForm, setPartnerForm] = useState<Partial<WhiteLabelPartner>>(EMPTY_PARTNER);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Pricing editor
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [tierForm, setTierForm] = useState<Partial<PricingTier>>({});

  // Partner pricing
  const [partnerPricing, setPartnerPricing] = useState<PricingTier[]>([]);
  const [partnerPricingOverrides, setPartnerPricingOverrides] = useState<Record<string, { monthly_price: number; annual_discount_pct: number }>>({});

  // Partner users
  const [partnerUsers, setPartnerUsers] = useState<PartnerUser[]>([]);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantPassword, setGrantPassword] = useState('');
  const [grantPasswordVisible, setGrantPasswordVisible] = useState(false);
  const [grantRole, setGrantRole] = useState<'owner' | 'staff'>('owner');
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState('');
  const [grantSuccess, setGrantSuccess] = useState('');

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // Payouts
  const [payouts, setPayouts] = useState<PartnerPayout[]>([]);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutForm, setPayoutForm] = useState<Partial<PartnerPayout>>({ status: 'pending', payment_method: 'ach', commission_pct: 15 });
  const [confirmingPayout, setConfirmingPayout] = useState<PartnerPayout | null>(null);
  const [confirmForm, setConfirmForm] = useState({ ach_tracking: '', payment_date: format(new Date(), 'yyyy-MM-dd'), amount: 0 });
  const [aggregating, setAggregating] = useState(false);
  const [aggregateResult, setAggregateResult] = useState<string | null>(null);

  // Load partner pricing + portal users when selected
  useEffect(() => {
    if (selectedPartner) {
      getPartnerPricing(selectedPartner.id).then(setPartnerPricing);
      fetchPartnerUsers(selectedPartner.id).then(setPartnerUsers);
    } else {
      setPartnerUsers([]);
    }
  }, [selectedPartner, getPartnerPricing, fetchPartnerUsers]);

  const refreshPartnerUsers = async () => {
    if (!selectedPartner) return;
    const fresh = await fetchPartnerUsers(selectedPartner.id);
    setPartnerUsers(fresh);
  };

  // Load subscriptions/payouts when tab changes
  useEffect(() => {
    if (tab === 'subscriptions') {
      fetchAllSubscriptions().then(setSubscriptions);
    }
    if (tab === 'payouts') {
      fetchPayouts().then(setPayouts);
    }
  }, [tab, fetchAllSubscriptions, fetchPayouts]);

  const handleSelectPartner = (p: WhiteLabelPartner) => {
    setSelectedPartner(p);
    setPartnerForm(p);
    setIsCreating(false);
    setPartnerPricingOverrides({});
  };

  const handleNewPartner = () => {
    setSelectedPartner(null);
    setPartnerForm({ ...EMPTY_PARTNER });
    setIsCreating(true);
  };

  const handleSavePartner = async () => {
    setSaving(true);
    setSaveError('');
    if (isCreating) {
      const { data, error } = await createPartner(partnerForm);
      if (error) { setSaveError(typeof error === 'string' ? error : (error as any).message || 'Failed to create partner'); setSaving(false); return; }
      if (data) {
        setSelectedPartner(data as WhiteLabelPartner);
        setIsCreating(false);
      }
    } else if (selectedPartner) {
      const { error } = await updatePartner(selectedPartner.id, partnerForm);
      if (error) { setSaveError(typeof error === 'string' ? error : (error as any).message || 'Failed to save changes'); setSaving(false); return; }
      // Refresh selected partner with latest data
      const fresh = partners.find(p => p.id === selectedPartner.id);
      if (fresh) setSelectedPartner(fresh);
      // Save any pricing overrides
      for (const [tierKey, override] of Object.entries(partnerPricingOverrides)) {
        await upsertPartnerPricing(selectedPartner.id, tierKey, override);
      }
      setPartnerPricingOverrides({});
      getPartnerPricing(selectedPartner.id).then(setPartnerPricing);
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPartner) return;
    setUploadingLogo(true);
    const { url, error } = await uploadPartnerLogo(selectedPartner.id, file);
    if (url) setPartnerForm(f => ({ ...f, logo_url: url }));
    if (error) setSaveError('Failed to upload logo');
    setUploadingLogo(false);
  };

  const handleDeletePartner = async () => {
    if (!selectedPartner) return;
    if (!confirm(`Delete partner "${selectedPartner.company_name}"? This cannot be undone.`)) return;
    await deletePartner(selectedPartner.id);
    setSelectedPartner(null);
    setPartnerForm({ ...EMPTY_PARTNER });
  };

  const handleSaveTier = async () => {
    if (!editingTier) return;
    setSaving(true);
    await updateDefaultTier(editingTier, tierForm);
    setEditingTier(null);
    setTierForm({});
    setSaving(false);
  };

  const copySignupUrl = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/signup/${slug}`);
  };

  // ─── ACCESS GUARD ───
  // /white-label is for ShadowField staff (platform admins) only.
  // RLS will reject writes anyway, but we render a clean denial here so
  // tenant owners don't see a broken UI full of save errors.
  if (authLoading) {
    return (
      <div className="p-12 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!user || !isPlatformAdmin) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Platform admins only</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            This area is restricted to ShadowField staff who manage white-label partners,
            pricing, and partner payouts. Tenant owners do not have access.
          </p>
          <p className="text-xs text-gray-400 mt-4">
            If you believe you should have access, contact your platform administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">White-Label & Pricing</h2>
          <p className="text-sm text-gray-500">Manage partners, pricing tiers, and subscriptions</p>
        </div>
        <button onClick={() => { fetchPartners(); fetchDefaultPricing(); }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: 'partners', label: `Partners (${partners.length})`, icon: Building2 },
          { key: 'pricing', label: `Pricing (${defaultPricing.length})`, icon: DollarSign },
          { key: 'subscriptions', label: 'Subscriptions', icon: Users },
          { key: 'payouts', label: 'Payouts', icon: Banknote },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ PARTNERS TAB ═══ */}
      {tab === 'partners' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Partner list */}
          <div className="col-span-4 space-y-3">
            <button
              onClick={handleNewPartner}
              className="w-full flex items-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium border border-blue-200 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add New Partner
            </button>

            {partners.map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectPartner(p)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  selectedPartner?.id === p.id
                    ? 'border-blue-300 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: p.primary_color }}>
                    {p.company_name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{p.company_name}</p>
                    <p className="text-xs text-gray-500">/{p.slug} · {p.commission_pct}% commission</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${p.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                </div>
              </button>
            ))}

            {partners.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-400 text-sm">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No partners yet
              </div>
            )}
          </div>

          {/* Partner detail */}
          <div className="col-span-8">
            {(selectedPartner || isCreating) ? (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Detail header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${partnerForm.primary_color}10, ${partnerForm.secondary_color}10)` }}>
                  <div>
                    <h3 className="font-semibold text-gray-900">{isCreating ? 'New Partner' : partnerForm.company_name}</h3>
                    {!isCreating && selectedPartner && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{window.location.origin}/signup/{selectedPartner.slug}</span>
                        <button onClick={() => copySignupUrl(selectedPartner.slug)} className="p-0.5 hover:bg-gray-200 rounded" title="Copy URL">
                          <Copy className="w-3 h-3 text-gray-400" />
                        </button>
                        <a href={`/signup/${selectedPartner.slug}`} target="_blank" rel="noopener" className="p-0.5 hover:bg-gray-200 rounded" title="Preview">
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isCreating && (
                      <button onClick={handleDeletePartner} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={handleSavePartner} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {isCreating ? 'Create' : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
                  {saveError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-xs text-red-700">{saveError}</span>
                    </div>
                  )}
                  {/* Identity */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Identity</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Company Name *</label>
                        <input type="text" value={partnerForm.company_name || ''} onChange={e => setPartnerForm(f => ({ ...f, company_name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">URL Slug *</label>
                        <div className="flex items-center">
                          <span className="text-xs text-gray-400 mr-1">/signup/</span>
                          <input type="text" value={partnerForm.slug || ''} onChange={e => setPartnerForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Tagline</label>
                        <input type="text" value={partnerForm.tagline || ''} onChange={e => setPartnerForm(f => ({ ...f, tagline: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>

                  {/* Logo */}
                  {!isCreating && selectedPartner && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Logo</h4>
                      <div className="flex items-center gap-4">
                        {partnerForm.logo_url ? (
                          <img src={partnerForm.logo_url} alt="Partner logo" className="w-20 h-20 rounded-xl border border-gray-200 object-contain bg-white p-1" />
                        ) : (
                          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                            <Image className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1">
                          <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium cursor-pointer transition-colors w-fit">
                            {uploadingLogo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploadingLogo} />
                          </label>
                          <p className="text-[10px] text-gray-400 mt-1.5">PNG or SVG recommended. Used on signup pages and branding.</p>
                          {partnerForm.logo_url && (
                            <button onClick={() => setPartnerForm(f => ({ ...f, logo_url: null }))} className="text-[10px] text-red-500 hover:underline mt-1">Remove logo</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Commission */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Commission</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Commission %</label>
                        <div className="flex items-center gap-2">
                          <input type="number" min={0} max={100} step={0.5} value={partnerForm.commission_pct ?? 15}
                            onChange={e => setPartnerForm(f => ({ ...f, commission_pct: parseFloat(e.target.value) || 0 }))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                          <Percent className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-500">of each subscription payment</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Commission Type</label>
                        <select value={partnerForm.commission_type || 'recurring'} onChange={e => setPartnerForm(f => ({ ...f, commission_type: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="recurring">Recurring (every billing cycle)</option>
                          <option value="one_time">One-time (first payment only)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Branding */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Branding</h4>
                    <div className="grid grid-cols-3 gap-4">
                      {['primary_color', 'secondary_color', 'accent_color'].map(key => (
                        <div key={key}>
                          <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">{key.replace('_', ' ')}</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={(partnerForm as any)[key] || '#1e40af'}
                              onChange={e => setPartnerForm(f => ({ ...f, [key]: e.target.value }))}
                              className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
                            <input type="text" value={(partnerForm as any)[key] || ''}
                              onChange={e => setPartnerForm(f => ({ ...f, [key]: e.target.value }))}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Contact */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Contact Info</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Contact Name</label>
                        <input type="text" value={partnerForm.contact_name || ''} onChange={e => setPartnerForm(f => ({ ...f, contact_name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" value={partnerForm.contact_email || ''} onChange={e => setPartnerForm(f => ({ ...f, contact_email: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                        <input type="tel" value={partnerForm.contact_phone || ''} onChange={e => setPartnerForm(f => ({ ...f, contact_phone: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
                        <input type="url" value={partnerForm.website_url || ''} onChange={e => setPartnerForm(f => ({ ...f, website_url: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>

                  {/* Marketing content */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Marketing Page</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Hero Headline</label>
                        <input type="text" value={partnerForm.hero_headline || ''} onChange={e => setPartnerForm(f => ({ ...f, hero_headline: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Protect Your Congregation with..." />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Hero Subheadline</label>
                        <textarea value={partnerForm.hero_subheadline || ''} onChange={e => setPartnerForm(f => ({ ...f, hero_subheadline: e.target.value }))}
                          rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>

                  {/* Partner pricing overrides */}
                  {!isCreating && selectedPartner && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Pricing Overrides</h4>
                      <p className="text-xs text-gray-400 mb-3">Leave blank to use default pricing. Set custom prices for this partner's signup page.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {defaultPricing.map(tier => {
                          const partnerTier = partnerPricing.find(p => p.tier_key === tier.tier_key);
                          const override = partnerPricingOverrides[tier.tier_key];
                          const currentPrice = override?.monthly_price ?? partnerTier?.monthly_price ?? tier.monthly_price;
                          const isOverridden = partnerTier && partnerTier.monthly_price !== tier.monthly_price;
                          return (
                            <div key={tier.tier_key} className={`p-3 rounded-lg border ${isOverridden ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-900">{tier.tier_name}</span>
                                {isOverridden && <span className="text-[10px] text-blue-600 font-semibold">CUSTOM</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">$</span>
                                <input
                                  type="number" min={0} step={1}
                                  value={currentPrice}
                                  onChange={e => setPartnerPricingOverrides(prev => ({
                                    ...prev,
                                    [tier.tier_key]: {
                                      monthly_price: parseFloat(e.target.value) || 0,
                                      annual_discount_pct: override?.annual_discount_pct ?? tier.annual_discount_pct,
                                    },
                                  }))}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-500">/mo</span>
                                <span className="text-[10px] text-gray-400 ml-auto">Default: ${tier.monthly_price}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Self-managed pricing toggle (platform-owner control) */}
                  {!isCreating && selectedPartner && (
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-medium text-gray-900">Pricing self-management</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          When ON, this partner can edit their own pricing tiers in the Partner Portal.
                          When OFF, only platform admins can edit. Defaults to OFF.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const next = !selectedPartner.pricing_self_managed;
                          const { error } = await setPricingSelfManaged(selectedPartner.id, next);
                          if (error) setSaveError((error as any).message || 'Failed to toggle');
                          else {
                            setSelectedPartner({ ...selectedPartner, pricing_self_managed: next });
                          }
                        }}
                        className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${selectedPartner.pricing_self_managed ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${selectedPartner.pricing_self_managed ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  )}

                  {/* Partner Portal access (grant / revoke partner_users) */}
                  {!isCreating && selectedPartner && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Partner Portal Access</h4>
                      <p className="text-xs text-gray-400 mb-3">
                        Create a login for an external partner staff member. Enter their email
                        and a temporary password — we'll create the account instantly (no email
                        sent). Share the credentials with them manually and they sign in at{' '}
                        <code className="font-mono">/login</code>. If the email already has a
                        ShadowField account, the password is ignored and we just grant access.
                      </p>

                      {grantError && (
                        <div className="flex items-center gap-2 p-2 mb-3 bg-red-50 border border-red-200 rounded-lg">
                          <X className="w-3 h-3 text-red-500" />
                          <span className="text-xs text-red-700">{grantError}</span>
                        </div>
                      )}
                      {grantSuccess && (
                        <div className="flex items-center gap-2 p-2 mb-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span className="text-xs text-emerald-700">{grantSuccess}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-12 gap-2 items-end mb-3">
                        <div className="col-span-5">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            value={grantEmail}
                            onChange={e => setGrantEmail(e.target.value)}
                            placeholder="stephen@sheperly.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-4">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Temporary password</label>
                          <div className="relative">
                            <input
                              type={grantPasswordVisible ? 'text' : 'password'}
                              value={grantPassword}
                              onChange={e => setGrantPassword(e.target.value)}
                              placeholder="type or generate"
                              className="w-full pr-20 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="absolute inset-y-0 right-1 flex items-center gap-1">
                              <button
                                type="button"
                                title="Generate random password"
                                onClick={() => {
                                  // Crypto-strong 12-char password, URL-safe chars only
                                  const bytes = new Uint8Array(12);
                                  crypto.getRandomValues(bytes);
                                  const charset = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
                                  let pw = '';
                                  for (const b of bytes) pw += charset[b % charset.length];
                                  setGrantPassword(pw);
                                  setGrantPasswordVisible(true);
                                }}
                                className="p-1 text-gray-500 hover:text-gray-800"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title={grantPasswordVisible ? 'Hide' : 'Show'}
                                onClick={() => setGrantPasswordVisible(v => !v)}
                                className="p-1 text-gray-500 hover:text-gray-800"
                              >
                                {grantPasswordVisible
                                  ? <EyeOff className="w-3.5 h-3.5" />
                                  : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              {grantPassword && (
                                <button
                                  type="button"
                                  title="Copy password"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(grantPassword).catch(() => {});
                                  }}
                                  className="p-1 text-gray-500 hover:text-gray-800"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                          <select
                            value={grantRole}
                            onChange={e => setGrantRole(e.target.value as 'owner' | 'staff')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                          >
                            <option value="owner">Owner</option>
                            <option value="staff">Staff</option>
                          </select>
                        </div>
                        <button
                          onClick={async () => {
                            if (!grantEmail) return;
                            setGrantBusy(true);
                            setGrantError('');
                            setGrantSuccess('');
                            const { error, created, message } = await invitePartnerUserByEmail(
                              selectedPartner.id, grantEmail, grantPassword, grantRole,
                            );
                            if (error) {
                              setGrantError(error.message || 'Failed to create login');
                            } else {
                              setGrantSuccess(message ?? (created
                                ? `Login created for ${grantEmail}. Share the credentials with them.`
                                : `${grantEmail} already had an account — partner access granted.`));
                              // If we created a new account keep the password visible for a moment
                              // so the admin can copy it before it clears.
                              setGrantEmail('');
                              if (created) {
                                // keep password briefly so admin can copy
                                setTimeout(() => setGrantPassword(''), 10_000);
                              } else {
                                setGrantPassword('');
                              }
                              await refreshPartnerUsers();
                            }
                            setGrantBusy(false);
                          }}
                          disabled={grantBusy || !grantEmail}
                          className="col-span-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                          title="Create the login account or grant access if it already exists."
                        >
                          {grantBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        </button>
                      </div>

                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600 uppercase">
                              <th className="text-left px-3 py-2">User</th>
                              <th className="text-left px-3 py-2">Role</th>
                              <th className="text-left px-3 py-2">Granted</th>
                              <th className="text-left px-3 py-2">Status</th>
                              <th className="px-3 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {partnerUsers.map(pu => (
                              <tr key={pu.id} className="border-b border-gray-50">
                                <td className="px-3 py-2">
                                  <div className="text-gray-900">{pu.display_name || pu.email || pu.user_id.slice(0, 8) + '…'}</div>
                                  {pu.email && <div className="text-xs text-gray-500">{pu.email}</div>}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium capitalize">{pu.role}</span>
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-500">{format(new Date(pu.granted_at), 'MMM d, yyyy')}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pu.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {pu.is_active ? 'Active' : 'Disabled'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={async () => {
                                      await setPartnerUserActive(pu.id, !pu.is_active);
                                      await refreshPartnerUsers();
                                    }}
                                    className="text-xs text-gray-600 hover:text-gray-900 mr-3"
                                  >
                                    {pu.is_active ? 'Disable' : 'Enable'}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm('Revoke partner portal access for this user?')) return;
                                      await revokePartnerUser(pu.id);
                                      await refreshPartnerUsers();
                                    }}
                                    className="text-xs text-red-600 hover:text-red-800"
                                  >
                                    Revoke
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {partnerUsers.length === 0 && (
                              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-xs">
                                No users yet. Grant access by email above.
                              </td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Active toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Active</p>
                      <p className="text-xs text-gray-500">Partner signup page is live and accepting signups</p>
                    </div>
                    <button
                      onClick={() => setPartnerForm(f => ({ ...f, is_active: !f.is_active }))}
                      className={`w-12 h-6 rounded-full transition-colors ${partnerForm.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${partnerForm.is_active ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a partner or create a new one</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ PRICING TAB ═══ */}
      {tab === 'pricing' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">These are the default pricing tiers shown on the main signup page. Partners can have custom overrides.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {defaultPricing.map(tier => {
              const isEditing = editingTier === tier.tier_key;
              return (
                <div key={tier.tier_key} className={`bg-white rounded-xl border-2 p-5 transition-all ${
                  isEditing ? 'border-blue-400 shadow-lg' : 'border-gray-200'
                } ${tier.is_popular ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                  {tier.is_popular && (
                    <div className="flex items-center gap-1 text-blue-600 text-xs font-bold mb-2">
                      <Star className="w-3 h-3" /> MOST POPULAR
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-gray-900">{tier.tier_name}</h3>
                  <p className="text-xs text-gray-500 mt-1 mb-4">{tier.description}</p>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600">Monthly Price ($)</label>
                        <input type="number" min={0} step={1} value={tierForm.monthly_price ?? tier.monthly_price}
                          onChange={e => setTierForm(f => ({ ...f, monthly_price: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Annual Discount %</label>
                        <input type="number" min={0} max={100} step={1} value={tierForm.annual_discount_pct ?? tier.annual_discount_pct}
                          onChange={e => setTierForm(f => ({ ...f, annual_discount_pct: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Max Members</label>
                        <input type="number" min={1} value={tierForm.max_members ?? tier.max_members}
                          onChange={e => setTierForm(f => ({ ...f, max_members: parseInt(e.target.value) || 1 }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveTier} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                          <Check className="w-4 h-4 inline mr-1" /> Save
                        </button>
                        <button onClick={() => { setEditingTier(null); setTierForm({}); }} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4">
                        <span className="text-3xl font-extrabold text-gray-900">${tier.monthly_price}</span>
                        <span className="text-gray-500 text-sm">/mo</span>
                        <p className="text-xs text-green-600 font-medium mt-1">{tier.annual_discount_pct}% annual discount</p>
                        <p className="text-xs text-gray-500">Up to {tier.max_members} members</p>
                      </div>
                      <ul className="space-y-1.5 mb-4">
                        {(Array.isArray(tier.features_json) ? tier.features_json : []).slice(0, 5).map((f: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                            <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => { setEditingTier(tier.tier_key); setTierForm(tier); }}
                        className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" /> Edit Tier
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ SUBSCRIPTIONS TAB ═══ */}
      {tab === 'subscriptions' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Tenant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Billing</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Price</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Partner</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map(sub => (
                <tr key={sub.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{sub.tenant_id.slice(0, 8)}...</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium capitalize">{sub.tier_key}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{sub.billing_cycle}</td>
                  <td className="px-4 py-3 font-medium">${sub.effective_price}/mo</td>
                  <td className="px-4 py-3">
                    {sub.partner_id ? (
                      <span className="text-xs text-purple-600 font-medium">{sub.partner_commission_pct}% comm</span>
                    ) : (
                      <span className="text-xs text-gray-400">Direct</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sub.status === 'active' ? 'bg-green-50 text-green-700' :
                      sub.status === 'trial' ? 'bg-blue-50 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{sub.status}</span>
                  </td>
                </tr>
              ))}
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No subscriptions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* ═══ PAYOUTS TAB ═══ */}
      {tab === 'payouts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Partner/referrer payouts processed via QuickBooks. Paid 30 days from receipt of customer payment.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setAggregating(true);
                  setAggregateResult(null);
                  // Default period: last 30 days → today.
                  const end = new Date();
                  const start = new Date();
                  start.setDate(start.getDate() - 30);
                  const fmt = (d: Date) => d.toISOString().slice(0, 10);
                  const { data, error } = await aggregatePartnerPayouts(fmt(start), fmt(end));
                  setAggregating(false);
                  if (error) {
                    setAggregateResult(`Error: ${error.message || error.toString()}`);
                  } else if (!data || data.length === 0) {
                    setAggregateResult('No new commission events to aggregate. (All unpaid events are already in a payout.)');
                  } else {
                    const total = data.reduce((s: number, r: any) => s + Number(r.commission_amount || 0), 0);
                    setAggregateResult(
                      `Generated ${data.length} payout${data.length > 1 ? 's' : ''} totaling $${total.toFixed(2)} commission.`,
                    );
                    fetchPayouts().then(setPayouts);
                  }
                }}
                disabled={aggregating}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                title="Roll up all unpaid commission billing_events from the last 30 days into pending payouts. Idempotent."
              >
                {aggregating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                {aggregating ? 'Aggregating...' : 'Generate Pending Payouts'}
              </button>
              <button onClick={() => { setShowPayoutForm(true); setPayoutForm({ status: 'pending', payment_method: 'ach', commission_pct: 15 }); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                <Plus className="w-4 h-4" /> New Payout
              </button>
            </div>
          </div>

          {aggregateResult && (
            <div className={`px-4 py-3 rounded-lg text-sm flex items-start justify-between gap-4 ${
              aggregateResult.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-800' :
              aggregateResult.startsWith('No new') ? 'bg-amber-50 border border-amber-200 text-amber-800' :
              'bg-emerald-50 border border-emerald-200 text-emerald-800'
            }`}>
              <span>{aggregateResult}</span>
              <button onClick={() => setAggregateResult(null)} className="opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Payout creation form */}
          {showPayoutForm && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Create Payout Record</h3>
                <button onClick={() => setShowPayoutForm(false)}><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Partner *</label>
                  <select value={payoutForm.partner_id || ''} onChange={e => setPayoutForm(f => ({ ...f, partner_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    <option value="">Select partner...</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.company_name} ({p.commission_pct}%)</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Commission %</label>
                  <input type="number" min={0} max={100} step={0.5} value={payoutForm.commission_pct ?? 15}
                    onChange={e => setPayoutForm(f => ({ ...f, commission_pct: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Period Start *</label>
                  <input type="date" value={payoutForm.period_start || ''} onChange={e => setPayoutForm(f => ({ ...f, period_start: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Period End *</label>
                  <input type="date" value={payoutForm.period_end || ''} onChange={e => setPayoutForm(f => ({ ...f, period_end: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Gross Revenue ($)</label>
                  <input type="number" min={0} step={0.01} value={payoutForm.gross_revenue ?? 0}
                    onChange={e => {
                      const gross = parseFloat(e.target.value) || 0;
                      const comm = gross * ((payoutForm.commission_pct ?? 15) / 100);
                      setPayoutForm(f => ({ ...f, gross_revenue: gross, commission_amount: comm, net_payout: comm + (f.adjustments || 0) }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Commission Amount ($)</label>
                  <input type="number" value={(payoutForm.commission_amount ?? 0).toFixed(2)} disabled
                    className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Adjustments ($)</label>
                  <input type="number" step={0.01} value={payoutForm.adjustments ?? 0}
                    onChange={e => {
                      const adj = parseFloat(e.target.value) || 0;
                      setPayoutForm(f => ({ ...f, adjustments: adj, net_payout: (f.commission_amount || 0) + adj }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Net Payout ($)</label>
                  <input type="number" value={(payoutForm.net_payout ?? 0).toFixed(2)} disabled
                    className="w-full px-3 py-2 border border-gray-200 bg-emerald-50 rounded-lg text-sm font-semibold text-emerald-700" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={payoutForm.notes || ''} onChange={e => setPayoutForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={async () => {
                  if (!payoutForm.partner_id || !payoutForm.period_start || !payoutForm.period_end) return;
                  await createPayout(payoutForm);
                  setShowPayoutForm(false);
                  fetchPayouts().then(setPayouts);
                }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Create Payout</button>
                <button onClick={() => setShowPayoutForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {/* Confirm payment modal */}
          {confirmingPayout && (
            <div className="bg-white rounded-xl border-2 border-green-300 p-6 space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Confirm ACH Payment — ${confirmingPayout.net_payout.toFixed(2)}
              </h3>
              <p className="text-sm text-gray-500">Partner: {partners.find(p => p.id === confirmingPayout.partner_id)?.company_name}</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ACH Tracking # *</label>
                  <input type="text" value={confirmForm.ach_tracking} onChange={e => setConfirmForm(f => ({ ...f, ach_tracking: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none font-mono" placeholder="TXN123456" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date *</label>
                  <input type="date" value={confirmForm.payment_date} onChange={e => setConfirmForm(f => ({ ...f, payment_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Amount ($)</label>
                  <input type="number" step={0.01} value={confirmForm.amount}
                    onChange={e => setConfirmForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={async () => {
                  if (!confirmForm.ach_tracking || !confirmForm.payment_date) return;
                  await confirmPayout(confirmingPayout.id, user?.id || '', confirmForm.ach_tracking, confirmForm.payment_date, confirmForm.amount);
                  setConfirmingPayout(null);
                  fetchPayouts().then(setPayouts);
                }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Confirm Payment
                </button>
                <button onClick={() => setConfirmingPayout(null)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          )}

          {/* Payouts table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Partner</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Period</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Commission</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Net Payout</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">ACH / Tracking</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Due / Paid</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {payouts.map(p => {
                  const partner = partners.find(pp => pp.id === p.partner_id);
                  const dueDate = addDays(new Date(p.period_end), 30);
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{partner?.company_name || p.partner_id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {format(new Date(p.period_start), 'MMM d')} — {format(new Date(p.period_end), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3 text-right">${Number(p.gross_revenue).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">${Number(p.commission_amount).toFixed(2)} ({p.commission_pct}%)</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">${Number(p.net_payout).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          p.status === 'paid' ? 'bg-green-50 text-green-700' :
                          p.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          p.status === 'processing' ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-600">
                        {p.ach_tracking_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {p.status === 'paid' && p.payment_date
                          ? <span className="text-green-700">Paid {format(new Date(p.payment_date), 'MMM d, yyyy')}</span>
                          : <span>Due {format(dueDate, 'MMM d, yyyy')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {p.status !== 'paid' && (
                          <button onClick={() => {
                            setConfirmingPayout(p);
                            setConfirmForm({ ach_tracking: '', payment_date: format(new Date(), 'yyyy-MM-dd'), amount: Number(p.net_payout) });
                          }} className="text-xs text-green-600 hover:text-green-800 font-medium">Mark Paid</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {payouts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      <Banknote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No payout records yet. Create one when a partner payment is due.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
