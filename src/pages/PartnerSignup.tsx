import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Shield, Camera, Map, AlertTriangle, Users, FileText, Check, Star,
  ChevronDown, ChevronUp, ArrowRight, Phone, Mail, Clock, Zap, Lock,
  Award, Heart, Building2, Eye, CheckCircle2, XCircle,
} from 'lucide-react';
import { useWhiteLabel, type WhiteLabelPartner, type PricingTier } from '../hooks/useWhiteLabel';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const ICON_MAP: Record<string, any> = {
  Shield, Camera, Map, AlertTriangle, Users, FileText, Check, Star,
  Phone, Mail, Clock, Zap, Lock, Award, Heart, Building2, Eye,
};

function FeatureIcon({ name, color }: { name: string; color: string }) {
  const Icon = ICON_MAP[name] || Shield;
  return (
    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
      <Icon className="w-6 h-6" style={{ color }} />
    </div>
  );
}

export default function PartnerSignup() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { getPartnerBySlug, getPartnerPricing, getCurrentTerms, calculatePrice } = useWhiteLabel();

  const [partner, setPartner] = useState<WhiteLabelPartner | null>(null);
  const [pricing, setPricing] = useState<PricingTier[]>([]);
  const [terms, setTerms] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  // Signup state
  const [step, setStep] = useState<'landing' | 'signup'>('landing');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [selectedTier, setSelectedTier] = useState<string>('professional');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Form state
  const [form, setForm] = useState({
    orgName: '', fullName: '', email: '', password: '',
    agreeTerms: false, agreePlatformOwnership: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load partner data
  useEffect(() => {
    async function load() {
      if (!slug) { setNotFound(true); setLoading(false); return; }
      const p = await getPartnerBySlug(slug);
      if (!p) { setNotFound(true); setLoading(false); return; }
      setPartner(p);
      const pr = await getPartnerPricing(p.id);
      setPricing(pr);
      const t = await getCurrentTerms();
      setTerms(t);
      setLoading(false);
      // Set favicon
      if (p.favicon_url) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) link.href = p.favicon_url;
      }
      document.title = `${p.company_name} — Church Security Platform`;
    }
    load();
  }, [slug, getPartnerBySlug, getPartnerPricing, getCurrentTerms]);

  const handleSignup = async () => {
    if (!form.orgName || !form.fullName || !form.email || !form.password) {
      setError('Please fill in all fields'); return;
    }
    if (!form.agreeTerms || !form.agreePlatformOwnership) {
      setError('You must agree to the terms and platform ownership clause'); return;
    }
    setSubmitting(true);
    setError('');
    try {
      await signUp(form.email, form.password, form.fullName, form.orgName, undefined, slug || undefined, selectedTier, billingCycle);
      navigate('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Signup failed');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (notFound || !partner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900">Partner Not Found</h1>
          <p className="text-gray-500 mt-2">This partner page doesn't exist or is no longer active.</p>
          <Link to="/signup" className="inline-block mt-4 text-blue-600 hover:underline">Go to ShadowField Signup →</Link>
        </div>
      </div>
    );
  }

  const pc = partner.primary_color;
  const sc = partner.secondary_color;
  const features = partner.features_json || [];
  const testimonials = partner.testimonials_json || [];
  const faqs = partner.faq_json || [];

  // ─── SIGNUP FORM STEP ───
  if (step === 'signup') {
    const tier = pricing.find(p => p.tier_key === selectedTier);
    const price = tier ? calculatePrice(tier.monthly_price, billingCycle, tier.annual_discount_pct) : null;

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {partner.logo_url ? (
                <img src={partner.logo_url} alt={partner.company_name} className="h-8 rounded" />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}>
                  <Shield className="w-5 h-5 text-white" />
                </div>
              )}
              <span className="font-bold text-gray-900">{partner.company_name}</span>
            </div>
            <button onClick={() => setStep('landing')} className="text-sm text-gray-500 hover:text-gray-700">← Back to plans</button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Plan summary */}
          {tier && price && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{tier.tier_name} Plan</h3>
                  <p className="text-sm text-gray-500">Up to {tier.max_members} security members</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: pc }}>
                    ${price.perMonth.toFixed(0)}<span className="text-sm font-normal text-gray-500">/mo</span>
                  </p>
                  {billingCycle === 'annual' && (
                    <p className="text-xs text-green-600 font-medium">Save ${price.savings.toFixed(0)}/year</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                  style={billingCycle === 'monthly' ? { backgroundColor: pc } : {}}
                >Monthly</button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${billingCycle === 'annual' ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                  style={billingCycle === 'annual' ? { backgroundColor: pc } : {}}
                >Annual (Save {tier.annual_discount_pct}%)</button>
              </div>
            </div>
          )}

          {/* Signup form */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Create Your Account</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Church / Organization Name *</label>
              <input type="text" value={form.orgName} onChange={e => setForm({ ...form, orgName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 outline-none" style={{ '--tw-ring-color': pc } as any}
                placeholder="Grace Community Church" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name *</label>
              <input type="text" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 outline-none"
                placeholder="John Smith" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 outline-none"
                placeholder="john@gracechurch.org" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 outline-none"
                placeholder="Minimum 8 characters" />
            </div>

            {/* Terms checkboxes */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.agreeTerms}
                  onChange={e => setForm({ ...form, agreeTerms: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded" />
                <span className="text-sm text-gray-600">
                  I agree to the <button onClick={() => window.open('#terms', '_blank')} className="underline font-medium" style={{ color: pc }}>Terms of Service</button> and <button className="underline font-medium" style={{ color: pc }}>Privacy Policy</button>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.agreePlatformOwnership}
                  onChange={e => setForm({ ...form, agreePlatformOwnership: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded" />
                <span className="text-sm text-gray-600">
                  I understand that my account, data, and customer relationship are owned and managed by <strong>ShadowField Inc.</strong>, and that <strong>{partner.company_name}</strong> provides administrative and management services as an authorized partner.
                </span>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl">
                <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <button
              onClick={handleSignup}
              disabled={submitting || !form.agreeTerms || !form.agreePlatformOwnership}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-base disabled:opacity-50 transition-all hover:shadow-lg"
              style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}
            >
              {submitting ? 'Creating Account...' : 'Create Account & Pay'}
            </button>

            <p className="text-center text-xs text-gray-400">Payment processed securely via Helcim • Cancel anytime</p>
          </div>

          {/* Powered by */}
          <div className="text-center mt-8">
            <p className="text-xs text-gray-400">
              Powered by <span className="font-semibold text-gray-500">ShadowField</span> — Church Security Platform
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── LANDING PAGE ───
  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${pc}, ${sc})` }} />
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {partner.logo_url ? (
              <img src={partner.logo_url} alt={partner.company_name} className="h-9 rounded" />
            ) : (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}>
                <Shield className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <span className="font-bold text-gray-900 text-lg">{partner.company_name}</span>
              <p className="text-[10px] text-gray-400 -mt-0.5">Powered by ShadowField</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign In</Link>
            <button
              onClick={() => { setStep('signup'); window.scrollTo(0, 0); }}
              className="px-5 py-2.5 rounded-full text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all"
              style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${pc}08, ${sc}05)` }} />
        <div className="absolute top-20 right-10 w-96 h-96 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${pc}, transparent)` }} />
        <div className="absolute bottom-10 left-10 w-64 h-64 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${sc}, transparent)` }} />

        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: pc + '15', color: pc }}>
              <Shield className="w-4 h-4" /> Trusted by 500+ Churches
            </div>
            <h1 className="text-4xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
              {partner.hero_headline}
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl">
              {partner.hero_subheadline}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => { setStep('signup'); window.scrollTo(0, 0); }}
                className="px-8 py-4 rounded-full text-white text-lg font-semibold shadow-xl hover:shadow-2xl transition-all flex items-center gap-2"
                style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}
              >
                Get Started Now <ArrowRight className="w-5 h-5" />
              </button>
              <a href="#pricing" className="px-8 py-4 rounded-full text-gray-700 text-lg font-semibold bg-white border border-gray-200 hover:border-gray-300 transition-colors">
                View Pricing
              </a>
            </div>
            <div className="flex items-center gap-6 mt-8 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Secure payments via Helcim</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Setup in 5 minutes</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" /> Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      {features.length > 0 && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: pc + '15', color: pc }}>
                <Zap className="w-4 h-4" /> Features
              </div>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">Everything Your Security Team Needs</h2>
              <p className="text-lg text-gray-500 mt-3 max-w-2xl mx-auto">One platform to coordinate, communicate, and protect your congregation</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feat: any, i: number) => (
                <div key={i} className="bg-white rounded-2xl p-6 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 border border-gray-100">
                  <FeatureIcon name={feat.icon} color={pc} />
                  <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">{feat.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: pc + '15', color: pc }}>
              <Award className="w-4 h-4" /> Pricing
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">Simple, Transparent Pricing</h2>
            <p className="text-lg text-gray-500 mt-3">Pay at signup. Cancel anytime. Upgrade as your team grows.</p>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className="relative w-14 h-7 rounded-full transition-colors"
                style={{ backgroundColor: billingCycle === 'annual' ? pc : '#D1D5DB' }}
              >
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${billingCycle === 'annual' ? 'translate-x-7' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-sm font-medium ${billingCycle === 'annual' ? 'text-gray-900' : 'text-gray-400'}`}>
                Annual <span className="text-green-600 font-semibold">(Save 20%)</span>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricing.map(tier => {
              const price = calculatePrice(tier.monthly_price, billingCycle, tier.annual_discount_pct);
              const isEnterprise = tier.tier_key === 'enterprise';
              const isSelected = selectedTier === tier.tier_key;
              const feats: string[] = Array.isArray(tier.features_json) ? tier.features_json : [];

              return (
                <div
                  key={tier.tier_key}
                  className={`relative bg-white rounded-2xl border-2 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    tier.is_popular ? 'border-current shadow-lg' : isSelected ? 'border-current' : 'border-gray-100'
                  }`}
                  style={tier.is_popular || isSelected ? { borderColor: pc } : {}}
                >
                  {tier.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}>
                      MOST POPULAR
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-gray-900">{tier.tier_name}</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-4">{tier.description}</p>

                  <div className="mb-6">
                    {isEnterprise ? (
                      <p className="text-3xl font-extrabold text-gray-900">Custom</p>
                    ) : (
                      <>
                        <p className="text-4xl font-extrabold" style={{ color: pc }}>
                          ${price.perMonth.toFixed(0)}
                          <span className="text-base font-normal text-gray-400">/mo</span>
                        </p>
                        {billingCycle === 'annual' && (
                          <p className="text-xs text-green-600 font-medium mt-1">
                            ${price.total.toFixed(0)}/year — save ${price.savings.toFixed(0)}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6">
                    {feats.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: pc }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => {
                      setSelectedTier(tier.tier_key);
                      if (!isEnterprise) { setStep('signup'); window.scrollTo(0, 0); }
                    }}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                      tier.is_popular
                        ? 'text-white shadow-lg hover:shadow-xl'
                        : 'border-2 hover:shadow-md'
                    }`}
                    style={
                      tier.is_popular
                        ? { background: `linear-gradient(135deg, ${pc}, ${sc})` }
                        : { borderColor: pc, color: pc }
                    }
                  >
                    {isEnterprise ? 'Contact Us' : 'Get Started'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      {testimonials.length > 0 && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: pc + '15', color: pc }}>
                <Heart className="w-4 h-4" /> Testimonials
              </div>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">Trusted by Churches Everywhere</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t: any, i: number) => (
                <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-all">
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: t.rating || 5 }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}>
                      {t.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      {faqs.length > 0 && (
        <section className="py-20">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ backgroundColor: pc + '15', color: pc }}>
                <FileText className="w-4 h-4" /> FAQ
              </div>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq: any, i: number) => (
                <div key={i} className={`bg-white rounded-xl border transition-all ${openFaq === i ? 'border-current shadow-md' : 'border-gray-100'}`}
                  style={openFaq === i ? { borderColor: pc } : {}}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <span className="font-semibold text-gray-900">{faq.q}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: pc + '10' }}>
                      {openFaq === i ? <ChevronUp className="w-4 h-4" style={{ color: pc }} /> : <ChevronDown className="w-4 h-4" style={{ color: pc }} />}
                    </div>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5">
                      <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="rounded-3xl p-12 text-center text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <h2 className="text-3xl lg:text-4xl font-extrabold mb-4">Ready to Protect Your Congregation?</h2>
              <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
                Get started today. Setup takes less than 5 minutes. Cancel anytime.
              </p>
              <button
                onClick={() => { setStep('signup'); window.scrollTo(0, 0); }}
                className="px-10 py-4 rounded-full bg-white font-bold text-lg shadow-xl hover:shadow-2xl transition-all flex items-center gap-2 mx-auto"
                style={{ color: pc }}
              >
                Get Started Now <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {partner.logo_url ? (
                <img src={partner.logo_url} alt={partner.company_name} className="h-7 rounded" />
              ) : (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}>
                  <Shield className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="font-bold text-gray-700">{partner.company_name}</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>Terms</span>
              <span>Privacy</span>
              {partner.contact_email && (
                <a href={`mailto:${partner.contact_email}`} className="hover:text-gray-600">{partner.contact_email}</a>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Powered by <span className="font-semibold text-gray-500">ShadowField</span> © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
