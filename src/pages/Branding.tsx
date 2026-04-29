import { useState, useEffect } from 'react';
import { Palette, Upload, Save, Eye, RefreshCw, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { supabase } from '../lib/supabase';
import PlacesAutocomplete, { type PlaceResult } from '../components/PlacesAutocomplete';

export default function BrandingPage() {
  const { tenant, refreshTenant } = useAuth();
  const branding = useBranding();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    app_name: '',
    tagline: '',
    primary_color: '#1e40af',
    secondary_color: '#0ea5e9',
    accent_color: '#f59e0b',
    custom_domain: '',
    home_lat: '' as string | number,
    home_lng: '' as string | number,
    home_zoom: 18,
    home_address: '',
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        app_name: tenant.app_name || 'ShadowField',
        tagline: tenant.tagline || '',
        primary_color: tenant.primary_color || '#1e40af',
        secondary_color: tenant.secondary_color || '#0ea5e9',
        accent_color: tenant.accent_color || '#f59e0b',
        custom_domain: (tenant as any).custom_domain || '',
        home_lat: tenant.home_lat ?? '',
        home_lng: tenant.home_lng ?? '',
        home_zoom: tenant.home_zoom ?? 18,
        home_address: tenant.home_address ?? '',
      });
    }
  }, [tenant]);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    const payload = {
      ...form,
      home_lat: form.home_lat === '' ? null : Number(form.home_lat),
      home_lng: form.home_lng === '' ? null : Number(form.home_lng),
      home_zoom: Number(form.home_zoom) || 18,
    };
    await supabase.from('tenants').update(payload).eq('id', tenant.id);
    await refreshTenant();
    setSaving(false);
  };

  const handleLogoUpload = async (file: File) => {
    if (!tenant) return;
    const path = `${tenant.id}/logo-${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('tenant-branding').upload(path, file);
    if (error) return;
    const { data: { publicUrl } } = supabase.storage.from('tenant-branding').getPublicUrl(path);
    await supabase.from('tenants').update({ logo_url: publicUrl }).eq('id', tenant.id);
    await refreshTenant();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Branding & White Label</h2>
          <p className="text-sm text-gray-500">Customize the look and feel for your organization</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Preview card */}
      <div className="rounded-xl overflow-hidden border border-gray-200">
        <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})` }}>
          <div className="flex items-center gap-3">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="" className="w-10 h-10 rounded-lg" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center"><Palette className="w-5 h-5" /></div>
            )}
            <div>
              <h3 className="font-bold text-lg">{form.app_name}</h3>
              <p className="text-sm text-white/80">{form.tagline}</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white flex items-center gap-3">
          <div className="w-6 h-6 rounded" style={{ backgroundColor: form.primary_color }} title="Primary" />
          <div className="w-6 h-6 rounded" style={{ backgroundColor: form.secondary_color }} title="Secondary" />
          <div className="w-6 h-6 rounded" style={{ backgroundColor: form.accent_color }} title="Accent" />
          <span className="text-xs text-gray-400 ml-auto">Live preview</span>
        </div>
      </div>

      {/* Logo upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Logo</h3>
        <div className="flex items-center gap-4">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center">
              <Palette className="w-6 h-6 text-gray-400" />
            </div>
          )}
          <div>
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm cursor-pointer transition-colors">
              <Upload className="w-4 h-4" /> Upload Logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }} />
            </label>
            <p className="text-xs text-gray-400 mt-1">Recommended: 512x512px, PNG or SVG</p>
          </div>
        </div>
      </div>

      {/* App identity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">App Identity</h3>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">App Name</label>
          <input type="text" value={form.app_name} onChange={(e) => setForm({...form, app_name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tagline</label>
          <input type="text" value={form.tagline} onChange={(e) => setForm({...form, tagline: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Custom Domain (optional)</label>
          <input type="text" value={form.custom_domain} onChange={(e) => setForm({...form, custom_domain: e.target.value})} placeholder="security.yourchurch.org" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Brand Colors</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'primary_color', label: 'Primary' },
            { key: 'secondary_color', label: 'Secondary' },
            { key: 'accent_color', label: 'Accent' },
          ].map(c => (
            <div key={c.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{c.label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={(form as any)[c.key]} onChange={(e) => setForm({...form, [c.key]: e.target.value})} className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
                <input type="text" value={(form as any)[c.key]} onChange={(e) => setForm({...form, [c.key]: e.target.value})} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Home Location */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-red-500" />
          <h3 className="font-semibold text-gray-900">Home Location (Church Building)</h3>
        </div>
        <p className="text-xs text-gray-500">
          Search for your church address below. The campus map will center here by default and all
          zones will be placed relative to this location.
        </p>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Search Address</label>
          <PlacesAutocomplete
            value={form.home_address}
            placeholder="Start typing your church address…"
            onSelect={(place: PlaceResult) => {
              setForm((prev) => ({
                ...prev,
                home_address: place.address,
                home_lat: place.lat,
                home_lng: place.lng,
              }));
            }}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Powered by Google Places. Picking a result auto-fills address + coordinates.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Latitude</label>
            <input
              type="number"
              step="any"
              value={form.home_lat}
              onChange={(e) => setForm({ ...form, home_lat: e.target.value })}
              placeholder="33.9519"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Longitude</label>
            <input
              type="number"
              step="any"
              value={form.home_lng}
              onChange={(e) => setForm({ ...form, home_lng: e.target.value })}
              placeholder="-84.5472"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Default Zoom</label>
            <input
              type="number"
              min={10}
              max={22}
              value={form.home_zoom}
              onChange={(e) => setForm({ ...form, home_zoom: parseInt(e.target.value) || 18 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10px] text-gray-400 mt-1">18=building · 16=campus · 14=area</p>
          </div>
        </div>

        {form.home_lat && form.home_lng && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-900">
              <div className="font-medium">{form.home_address || 'Saved location'}</div>
              <div className="text-blue-700">
                {Number(form.home_lat).toFixed(6)}, {Number(form.home_lng).toFixed(6)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
