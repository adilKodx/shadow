import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield, Eye, EyeOff, UserPlus, Building2, KeyRound, Check, ArrowRight,
  MapPin, Radio, MessageSquare, AlertTriangle, Camera, Users, Lock, Zap,
  ChevronDown, Star, XCircle, Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWhiteLabel, type PricingTier } from '../hooks/useWhiteLabel';

// Pricing is now loaded from the database via useWhiteLabel hook

const FEATURES_GRID = [
  { icon: MapPin, title: 'Live Team Map', desc: 'See every member\'s location in real-time on your church campus map' },
  { icon: AlertTriangle, title: 'Instant Alerts', desc: 'Lockdown, evacuation, BOLO — one tap reaches your entire team' },
  { icon: MessageSquare, title: 'Secure Chat', desc: 'Encrypted team channels — general, command, direct, alert' },
  { icon: Camera, title: 'Video Feeds', desc: 'Monitor all your security cameras from one dashboard' },
  { icon: Users, title: 'POI Database', desc: 'Track persons of interest with photos, threat levels, and AI risk scores' },
  { icon: Lock, title: 'PIN Lock Security', desc: 'Biometric + PIN re-authentication keeps data secure on shared devices' },
];

const TESTIMONIALS = [
  { name: 'Pastor Michael T.', church: 'Grace Community Church', text: 'ShadowField transformed how our security team communicates. The live map alone has been a game-changer during Sunday services.', rating: 5 },
  { name: 'David R.', church: 'First Baptist Security Lead', text: 'We went from walkie-talkies and paper logs to a fully digital operation. Incident response time dropped by 60%.', rating: 5 },
  { name: 'Sarah K.', church: 'Crossroads Church', text: 'The alert system is incredible. During a lockdown drill, we had every team member notified and acknowledged in under 30 seconds.', rating: 5 },
];

export default function Signup() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { defaultPricing, calculatePrice } = useWhiteLabel();
  const [step, setStep] = useState<'landing' | 'create' | 'join'>('landing');
  const [selectedPlan, setSelectedPlan] = useState('professional');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeOwnership, setAgreeOwnership] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const selectedTier = defaultPricing.find(p => p.tier_key === selectedPlan);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (step === 'create' && (!agreeTerms || !agreeOwnership)) {
      setError('You must agree to the terms and platform ownership clause');
      return;
    }

    setLoading(true);
    const { error: err } = await signUp(
      email,
      password,
      displayName,
      step === 'create' ? orgName : undefined,
      step === 'join' ? inviteCode : undefined,
      undefined, // no partner slug for direct signup
      step === 'create' ? selectedPlan : undefined,
      step === 'create' ? billingCycle : undefined,
    );

    if (err) {
      setError(err.message || 'Signup failed');
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  // ─── SIGNUP FORM (create or join) ───
  if (step === 'create' || step === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              {step === 'create' ? 'Create Your Organization' : 'Join a Team'}
            </h1>
            <p className="text-blue-200 mt-1 text-sm">
              {step === 'create'
                ? `${selectedTier?.tier_name || 'Professional'} Plan`
                : 'Enter your invite code to join'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="you@church.org"
                  required
                />
              </div>

              {step === 'create' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Church / Organization Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="First Baptist Church"
                    required
                  />
                </div>
              )}

              {step === 'join' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invite Code</label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="abc123def456"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-10"
                    placeholder="Min 6 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Confirm password"
                  required
                />
              </div>

              {step === 'create' && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} className="mt-1 w-4 h-4 rounded" />
                    <span className="text-xs text-gray-600">I agree to the <span className="font-medium text-blue-600">Terms of Service</span> and <span className="font-medium text-blue-600">Privacy Policy</span></span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={agreeOwnership} onChange={e => setAgreeOwnership(e.target.checked)} className="mt-1 w-4 h-4 rounded" />
                    <span className="text-xs text-gray-600">I understand that my account and data are owned by <strong>ShadowField Inc.</strong></span>
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (step === 'create' && (!agreeTerms || !agreeOwnership))}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    {step === 'create' ? 'Create Account & Pay' : 'Join Team'}
                  </>
                )}
              </button>

              {step === 'create' && (
                <p className="text-center text-xs text-gray-500">Payment processed securely via Helcim. Cancel anytime.</p>
              )}
            </form>
          </div>

          <div className="flex justify-center gap-4 mt-6 text-sm">
            <button onClick={() => setStep('landing')} className="text-blue-200 hover:text-white">
              Back
            </button>
            <Link to="/login" className="text-blue-200 hover:text-white">
              Sign in instead
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── LANDING / SALES PAGE ───
  const faqs = [
    { q: 'How does billing work?', a: 'Payment is collected at the time of signup via our secure payment processor, Helcim. You can cancel anytime and your access continues through the end of your billing period.' },
    { q: 'Can I change plans later?', a: 'Absolutely. Upgrade or downgrade anytime. If you upgrade mid-cycle, we prorate the difference. If you downgrade, the change takes effect at the next billing period.' },
    { q: 'How does the member limit work?', a: 'Member limits count active security team members. The team lead / admin who manages the account counts as one member. You can deactivate members without losing their data.' },
    { q: 'Is our data secure?', a: 'ShadowField uses enterprise-grade encryption, row-level security isolation, and optional PIN/biometric re-authentication. Each organization\'s data is completely isolated — no other team can ever see your information.' },
    { q: 'What about the invite code system?', a: 'Team leads generate invite codes from the Team Management page. Share the code with your members — they enter it during signup and are automatically added to your organization with the role you specify.' },
    { q: 'Do you support multiple campuses?', a: 'The Ministry and Enterprise plans support multi-building and multi-campus setups with separate map overlays and zone configurations for each location.' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">ShadowField</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-gray-900 transition-colors">Testimonials</a>
            <a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Sign In
            </Link>
            <button
              onClick={() => setStep('create')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full blur-[120px]" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-cyan-400 rounded-full blur-[150px]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-blue-200 text-sm mb-6">
              <Zap className="w-4 h-4 text-yellow-400" />
              Trusted by 500+ churches nationwide
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
              Protect Your Congregation.<br />
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Empower Your Team.
              </span>
            </h1>
            <p className="mt-6 text-lg text-blue-100 max-w-2xl mx-auto leading-relaxed">
              ShadowField is the all-in-one safety and communications platform built specifically for church security teams. 
              Real-time location tracking, instant alerts, secure chat, incident reporting — everything your team needs in one place.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setStep('create')}
                className="px-8 py-3.5 rounded-full bg-white text-blue-900 font-bold text-lg hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/30"
              >
                Get Started Now <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setStep('join')}
                className="px-8 py-3.5 rounded-full border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-colors flex items-center gap-2"
              >
                <KeyRound className="w-5 h-5" /> Join with Invite Code
              </button>
            </div>
            <p className="mt-4 text-sm text-blue-300">Secure payments via Helcim &bull; Setup in under 2 minutes</p>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
              <Radio className="w-4 h-4" /> Platform Features
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Everything Your Security Team Needs</h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">Purpose-built for houses of worship. No bloated enterprise features — just what matters.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES_GRID.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100 group">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
                  <f.icon className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg">{f.title}</h3>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium mb-4">
              <Award className="w-4 h-4" /> Simple Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Plans That Scale With Your Ministry</h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">Pay at signup. Cancel anytime. Upgrade or downgrade as your team grows.</p>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-gray-900' : 'text-gray-400'}`}>Monthly</span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
                className={`relative w-14 h-7 rounded-full transition-colors ${billingCycle === 'annual' ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${billingCycle === 'annual' ? 'translate-x-7' : 'translate-x-0.5'}`} />
              </button>
              <span className={`text-sm font-medium ${billingCycle === 'annual' ? 'text-gray-900' : 'text-gray-400'}`}>
                Annual <span className="text-green-600 font-semibold">(Save 20%)</span>
              </span>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {defaultPricing.map((tier) => {
              const isEnterprise = tier.tier_key === 'enterprise';
              const price = calculatePrice(tier.monthly_price, billingCycle, tier.annual_discount_pct);
              const isSelected = selectedPlan === tier.tier_key;
              const feats: string[] = Array.isArray(tier.features_json) ? tier.features_json : [];

              return (
                <div
                  key={tier.tier_key}
                  className={`rounded-2xl p-6 border-2 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'border-blue-600 shadow-lg shadow-blue-100 scale-[1.02]'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${tier.is_popular ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}
                  onClick={() => setSelectedPlan(tier.tier_key)}
                >
                  {tier.is_popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                      MOST POPULAR
                    </div>
                  )}
                  <div className="mb-4">
                    <h3 className="font-bold text-gray-900 text-lg">{tier.tier_name}</h3>
                    <p className="text-gray-500 text-xs mt-1">{tier.description}</p>
                  </div>
                  <div className="mb-6">
                    {isEnterprise ? (
                      <div className="text-2xl font-bold text-gray-900">Custom</div>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold text-gray-900">${price.perMonth.toFixed(0)}</span>
                          <span className="text-gray-500 text-sm">/mo</span>
                        </div>
                        {billingCycle === 'annual' && (
                          <p className="text-xs text-green-600 font-medium mt-1">
                            ${price.total.toFixed(0)}/year — save ${price.savings.toFixed(0)}
                          </p>
                        )}
                      </>
                    )}
                    <p className="text-sm text-gray-500 mt-1">Up to {tier.max_members} members</p>
                  </div>
                  <ul className="space-y-2.5 mb-6">
                    {feats.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlan(tier.tier_key);
                      if (isEnterprise) {
                        window.location.href = 'mailto:sales@shadowfield.app?subject=Enterprise%20Inquiry';
                      } else {
                        setStep('create');
                      }
                    }}
                    className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                      tier.is_popular || isSelected
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {isEnterprise ? 'Contact Sales' : 'Get Started'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium mb-4">
              <Star className="w-4 h-4" /> Testimonials
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Trusted By Security Teams</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-gray-500 text-xs">{t.church}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${faqOpen === i ? 'rotate-180' : ''}`} />
                </button>
                {faqOpen === i && (
                  <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to Secure Your Church?</h2>
          <p className="text-blue-200 mb-8 text-lg">Join hundreds of churches using ShadowField to protect their congregations.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setStep('create')}
              className="px-8 py-3.5 rounded-full bg-white text-blue-900 font-bold text-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setStep('join')}
              className="px-8 py-3.5 rounded-full border-2 border-white/30 text-white font-semibold hover:bg-white/10 transition-colors"
            >
              Join with Invite Code
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 bg-gray-900 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} ShadowField. All rights reserved.</p>
      </footer>
    </div>
  );
}
