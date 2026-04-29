import { useState, useEffect, useCallback, useRef } from 'react';
import {
  User, Key, CreditCard, Database, ExternalLink, Check, Zap, Star,
  ArrowUpCircle, RefreshCw, Calendar, Receipt, AlertTriangle, Shield,
  ChevronRight, XCircle, Plus, Trash2, DollarSign, Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useWhiteLabel, type Subscription, type BillingEvent } from '../hooks/useWhiteLabel';
import { useTeam, PLAN_TIERS } from '../hooks/useTeam';
import { supabase } from '../lib/supabase';
import { format, isPast, differenceInDays } from 'date-fns';

// Extend Subscription type for Helcim fields
interface ExtendedSubscription extends Subscription {
  helcim_customer_id?: string | null;
  helcim_card_token?: string | null;
  helcim_card_f6l4?: string | null;
  helcim_card_expiry?: string | null;
  helcim_card_type?: string | null;
  last_payment_at?: string | null;
  last_payment_amount?: number | null;
  next_charge_at?: string | null;
}

declare global {
  interface Window {
    appendHelcimPayIframe?: (token: string, config?: any) => void;
  }
}

export default function SettingsPage() {
  const { user, member, tenant, refreshTenant } = useAuth();
  const { primaryColor } = useBranding();
  const [tab, setTab] = useState('profile');
  const [displayName, setDisplayName] = useState(member?.display_name || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const { getSubscription, getBillingHistory, defaultPricing, calculatePrice } = useWhiteLabel();
  const { memberCount, memberLimit, currentTier, upgradeTier } = useTeam();
  const [subscription, setSubscription] = useState<ExtendedSubscription | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingEvent[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Helcim payment state
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState('');
  const [cardSuccess, setCardSuccess] = useState('');
  const [showRemoveCard, setShowRemoveCard] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const helcimScriptLoaded = useRef(false);

  const isAdmin = member?.role === 'owner' || member?.role === 'admin';

  // Load HelcimPay.js script
  useEffect(() => {
    if (helcimScriptLoaded.current) return;
    const existing = document.querySelector('script[src*="helcim-pay"]');
    if (existing) { helcimScriptLoaded.current = true; return; }
    const script = document.createElement('script');
    script.src = 'https://myposcdn.helcim.com/helcim-pay/services/start.js';
    script.async = true;
    script.onload = () => { helcimScriptLoaded.current = true; };
    document.head.appendChild(script);
  }, []);

  // Listen for HelcimPay.js postMessage callback
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      // HelcimPay sends transaction result via postMessage
      if (!e.data || typeof e.data !== 'object') return;
      const data = e.data;
      // Helcim response contains these fields on success
      if (data.eventName === 'helcim-pay-success' || data.response?.transactionId) {
        const resp = data.response || data;
        try {
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token;
          if (!token || !subscription) return;

          const res = await supabase.functions.invoke('helcim-billing', {
            body: {
              action: 'save_card',
              subscriptionId: subscription.id,
              cardToken: resp.cardToken || resp.token,
              cardF6L4: resp.cardF6L4 || resp.f6l4 || `${resp.cardFirst6 || ''}${resp.cardLast4 || ''}`,
              cardExpiry: resp.cardExpiry || resp.expiryDate || `${resp.expiryMonth}/${resp.expiryYear}`,
              cardType: resp.cardType || resp.type || 'Card',
              helcimCustomerId: resp.customerCode || resp.customerId,
              transactionId: resp.transactionId,
            },
          });
          if (res.error) throw new Error(res.error.message);

          setCardSuccess('Payment method saved successfully!');
          setCardError('');
          // Reload subscription to reflect new card
          if (tenant) {
            const sub = await getSubscription(tenant.id);
            setSubscription(sub as ExtendedSubscription);
            const events = await getBillingHistory(tenant.id);
            setBillingHistory(events);
          }
        } catch (err: any) {
          setCardError(err.message || 'Failed to save card');
        }
        setCardLoading(false);
        setTimeout(() => setCardSuccess(''), 5000);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [subscription, tenant, getSubscription, getBillingHistory]);

  // If a tenant-less user (platform admin / partner staff) somehow lands on
  // the billing tab, bounce them back to profile — there's nothing to show.
  useEffect(() => {
    if (tab === 'billing' && !tenant) {
      setTab('profile');
    }
  }, [tab, tenant]);

  // Auto-load billing when tab switches to billing
  useEffect(() => {
    if (tab === 'billing' && !billingLoaded && tenant) {
      (async () => {
        setBillingLoading(true);
        const sub = await getSubscription(tenant.id);
        setSubscription(sub as ExtendedSubscription);
        if (sub?.billing_cycle) setBillingCycle(sub.billing_cycle as any);
        const events = await getBillingHistory(tenant.id);
        setBillingHistory(events);
        setBillingLoading(false);
        setBillingLoaded(true);
      })();
    }
  }, [tab, billingLoaded, tenant, getSubscription, getBillingHistory]);

  const handleProfileSave = async () => {
    if (!member) return;
    setSaving(true);
    setSaveMsg('');
    const { error } = await supabase.from('tenant_members').update({ display_name: displayName, phone }).eq('id', member.id);
    if (error) { setSaveMsg('Failed to save'); } else { setSaveMsg('Saved!'); await refreshTenant(); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) { setPasswordMsg('Min 6 characters'); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMsg(error ? error.message : 'Password updated!');
    setNewPassword('');
  };

  const handleUpgrade = async (tierKey: string) => {
    setUpgrading(true);
    await upgradeTier(tierKey);
    await refreshTenant();
    if (tenant) {
      const sub = await getSubscription(tenant.id);
      setSubscription(sub as ExtendedSubscription);
    }
    setUpgrading(false);
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    await supabase.from('subscriptions').update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', subscription.id);
    setSubscription({ ...subscription, status: 'canceled', canceled_at: new Date().toISOString() });
    setShowCancelConfirm(false);
  };

  // --- HELCIM PAYMENT FUNCTIONS ---

  const handleAddPaymentMethod = useCallback(async () => {
    if (!subscription) { setCardError('No active subscription found'); return; }
    setCardLoading(true);
    setCardError('');
    setCardSuccess('');
    try {
      const res = await supabase.functions.invoke('helcim-billing', {
        body: {
          action: 'initialize_verify',
          customerCode: subscription.helcim_customer_id,
        },
      });
      if (res.error) throw new Error(res.error.message);
      const { checkoutToken } = res.data;
      if (!checkoutToken) throw new Error('Failed to get checkout token from Helcim');

      // Open HelcimPay.js modal
      if (window.appendHelcimPayIframe) {
        window.appendHelcimPayIframe(checkoutToken, { type: 'modal' });
      } else {
        throw new Error('HelcimPay.js not loaded. Please refresh and try again.');
      }
    } catch (err: any) {
      setCardError(err.message || 'Failed to initialize payment');
      setCardLoading(false);
    }
  }, [subscription]);

  const handleRemoveCard = useCallback(async () => {
    if (!subscription) return;
    setCardLoading(true);
    try {
      const res = await supabase.functions.invoke('helcim-billing', {
        body: { action: 'remove_card', subscriptionId: subscription.id },
      });
      if (res.error) throw new Error(res.error.message);
      setSubscription({
        ...subscription,
        helcim_card_token: null, helcim_card_f6l4: null, helcim_card_expiry: null,
        helcim_card_type: null, payment_method_brand: null, payment_method_last4: null,
      });
      setShowRemoveCard(false);
      setCardSuccess('Payment method removed');
      if (tenant) {
        const events = await getBillingHistory(tenant.id);
        setBillingHistory(events);
      }
    } catch (err: any) {
      setCardError(err.message);
    }
    setCardLoading(false);
    setTimeout(() => setCardSuccess(''), 5000);
  }, [subscription, tenant, getBillingHistory]);

  const handleProcessPayment = useCallback(async () => {
    if (!subscription) return;
    setProcessingPayment(true);
    setCardError('');
    try {
      const res = await supabase.functions.invoke('helcim-billing', {
        body: { action: 'charge_subscription', subscriptionId: subscription.id },
      });
      if (res.error) throw new Error(res.error.message);
      setCardSuccess(`Payment processed! Next charge: ${format(new Date(res.data.nextChargeAt), 'MMM d, yyyy')}`);
      // Reload
      if (tenant) {
        const sub = await getSubscription(tenant.id);
        setSubscription(sub as ExtendedSubscription);
        const events = await getBillingHistory(tenant.id);
        setBillingHistory(events);
      }
    } catch (err: any) {
      setCardError(err.message);
    }
    setProcessingPayment(false);
    setTimeout(() => setCardSuccess(''), 5000);
  }, [subscription, tenant, getSubscription, getBillingHistory]);

  // Trial info
  const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  const isOnTrial = trialEndsAt && !isPast(trialEndsAt);
  const trialDaysLeft = trialEndsAt ? Math.max(0, differenceInDays(trialEndsAt, new Date())) : 0;
  const periodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const hasCard = !!(subscription?.helcim_card_token || subscription?.payment_method_last4);

  // Billing tab only makes sense for users who own/belong to a tenant.
  // Platform admins and partner-portal-only users don't have a subscription.
  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    ...(tenant ? [{ id: 'billing', label: 'Billing', icon: CreditCard }] : []),
    { id: 'security', label: 'Security', icon: Key },
    { id: 'about', label: 'About', icon: Database },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Settings</h2>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* PROFILE TAB */}
      {tab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h3 className="font-semibold text-gray-900">Your Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={user?.email || ''} disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
              <input type="text" value={member?.role || ''} disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 capitalize" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleProfileSave} disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Changes
            </button>
            {saveMsg && <span className={`text-sm ${saveMsg === 'Saved!' ? 'text-green-600' : 'text-red-600'}`}>{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* BILLING TAB */}
      {tab === 'billing' && (
        <div className="space-y-6">
          {billingLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading billing information...</p>
            </div>
          ) : (
            <>
              {/* Status Messages */}
              {cardError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700 flex-1">{cardError}</p>
                  <button onClick={() => setCardError('')} className="text-red-400 hover:text-red-600"><XCircle className="w-4 h-4" /></button>
                </div>
              )}
              {cardSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-700 flex-1">{cardSuccess}</p>
                </div>
              )}

              {/* Trial Banner */}
              {isOnTrial && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900">Free Trial {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} remaining</p>
                    <p className="text-sm text-amber-700">Your trial ends {format(trialEndsAt!, 'MMMM d, yyyy')}. Add a payment method to continue after trial.</p>
                  </div>
                  {!hasCard && (
                    <button onClick={handleAddPaymentMethod} disabled={cardLoading}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap">
                      Add Card
                    </button>
                  )}
                </div>
              )}

              {/* Current Plan Card */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor + '15' }}>
                        <CreditCard className="w-5 h-5" style={{ color: primaryColor }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Current Plan</h3>
                        <p className="text-xs text-gray-500">Manage your subscription and billing</p>
                      </div>
                    </div>
                    {subscription && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        subscription.status === 'active' ? 'bg-green-100 text-green-700' :
                        subscription.status === 'trialing' ? 'bg-amber-100 text-amber-700' :
                        subscription.status === 'canceled' ? 'bg-red-100 text-red-700' :
                        subscription.status === 'past_due' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{subscription.status === 'trialing' ? 'Trial' : subscription.status}</span>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Plan</p>
                      <p className="font-bold text-gray-900 capitalize text-lg">{subscription?.tier_key || tenant?.subscription_tier || 'Starter'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Billing</p>
                      <p className="font-bold text-gray-900 capitalize text-lg">{subscription?.billing_cycle || 'Monthly'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Amount</p>
                      <p className="font-bold text-gray-900 text-lg">
                        {subscription?.effective_price != null ? `$${subscription.effective_price}` : '\u2014'}
                        <span className="text-xs text-gray-400 font-normal">/mo</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Members</p>
                      <p className="font-bold text-gray-900 text-lg">{memberCount} <span className="text-xs text-gray-400 font-normal">/ {memberLimit === 999 ? '\u221E' : memberLimit}</span></p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    {periodEnd && (
                      <div>
                        <p className="text-xs text-gray-400">Next Billing Date</p>
                        <p className="font-medium text-gray-700">{format(periodEnd, 'MMM d, yyyy')}</p>
                      </div>
                    )}
                    {subscription?.last_payment_at && (
                      <div>
                        <p className="text-xs text-gray-400">Last Payment</p>
                        <p className="font-medium text-gray-700">${subscription.last_payment_amount} on {format(new Date(subscription.last_payment_at), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                    {subscription?.canceled_at && (
                      <div>
                        <p className="text-xs text-gray-400">Canceled</p>
                        <p className="font-medium text-red-600">{format(new Date(subscription.canceled_at), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Method Card */}
              {isAdmin && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-gray-900">Payment Method</h3>
                    <span className="ml-auto text-[10px] text-gray-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Secured by Helcim
                    </span>
                  </div>
                  <div className="p-5">
                    {hasCard ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-9 bg-gradient-to-br from-gray-700 to-gray-900 rounded-md flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {subscription?.helcim_card_type || subscription?.payment_method_brand || 'Card'}{' '}
                              <span className="text-gray-500 font-normal">
                                {'\u2022\u2022\u2022\u2022'} {subscription?.payment_method_last4 || subscription?.helcim_card_f6l4?.slice(-4) || '****'}
                              </span>
                            </p>
                            {subscription?.helcim_card_expiry && (
                              <p className="text-xs text-gray-500">Expires {subscription.helcim_card_expiry}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={handleAddPaymentMethod} disabled={cardLoading}
                            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50">
                            {cardLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Update'}
                          </button>
                          {!showRemoveCard ? (
                            <button onClick={() => setShowRemoveCard(true)}
                              className="px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              Remove
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button onClick={handleRemoveCard} disabled={cardLoading}
                                className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                                Confirm
                              </button>
                              <button onClick={() => setShowRemoveCard(false)}
                                className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg">
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                          <CreditCard className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-600 mb-1">No payment method on file</p>
                        <p className="text-xs text-gray-400 mb-4">Add a credit or debit card to enable automatic billing</p>
                        <button onClick={handleAddPaymentMethod} disabled={cardLoading}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {cardLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Add Payment Method
                        </button>
                      </div>
                    )}

                    {/* Manual Pay Now button */}
                    {hasCard && subscription && subscription.effective_price > 0 && subscription.status !== 'canceled' && (
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Process a payment manually</p>
                          <p className="text-xs text-gray-400">Charge ${subscription.effective_price} to your card on file</p>
                        </div>
                        <button onClick={handleProcessPayment} disabled={processingPayment}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
                          {processingPayment ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                          Pay Now
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Plan Selection */}
              {isAdmin && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <h3 className="font-semibold text-gray-900">Change Plan</h3>
                    </div>
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                      <button onClick={() => setBillingCycle('monthly')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${billingCycle === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                        Monthly
                      </button>
                      <button onClick={() => setBillingCycle('annual')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${billingCycle === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                        Annual <span className="text-green-600 text-[10px]">Save 20%</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      {(defaultPricing.length > 0 ? defaultPricing : PLAN_TIERS.map(t => ({
                        tier_key: t.key, tier_name: t.name, monthly_price: t.price,
                        annual_discount_pct: 20, max_members: t.members,
                        description: '', features_json: [], is_popular: t.key === 'professional', sort_order: 0,
                      }))).map(tier => {
                        const isCurrent = (subscription?.tier_key || currentTier) === tier.tier_key;
                        const price = calculatePrice(tier.monthly_price, billingCycle, tier.annual_discount_pct);
                        const feats: string[] = Array.isArray(tier.features_json) ? tier.features_json : [];
                        return (
                          <div key={tier.tier_key}
                            className={`relative rounded-xl border-2 p-5 transition-all duration-200 flex flex-col ${
                              isCurrent ? 'border-blue-500 bg-blue-50/30 shadow-sm' :
                              'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                            } ${tier.is_popular && !isCurrent ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
                            {isCurrent && (
                              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-full whitespace-nowrap">
                                Current
                              </div>
                            )}
                            {tier.is_popular && !isCurrent && (
                              <div className="flex items-center gap-1 text-blue-600 text-xs font-bold mb-2">
                                <Star className="w-3 h-3" /> MOST POPULAR
                              </div>
                            )}
                            <h3 className="text-lg font-bold text-gray-900">{tier.tier_name}</h3>
                            {tier.description && (
                              <p className="text-xs text-gray-500 mt-1 mb-3">{tier.description}</p>
                            )}
                            <div className="mb-4 mt-2">
                              <span className="text-3xl font-extrabold text-gray-900">
                                {tier.monthly_price > 0 ? `$${Math.round(price.perMonth)}` : 'Custom'}
                              </span>
                              {tier.monthly_price > 0 && (
                                <span className="text-gray-500 text-sm">/mo</span>
                              )}
                              {tier.monthly_price > 0 && tier.annual_discount_pct > 0 && (
                                <p className="text-xs text-green-600 font-medium mt-1">
                                  {tier.annual_discount_pct}% annual discount
                                </p>
                              )}
                              <p className="text-xs text-gray-500">
                                {tier.max_members === 999 ? 'Unlimited' : `Up to ${tier.max_members}`} member{tier.max_members !== 1 ? 's' : ''}
                              </p>
                            </div>
                            {feats.length > 0 && (
                              <ul className="space-y-1.5 mb-4 flex-1">
                                {feats.slice(0, 6).map((f, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                                    <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {isCurrent ? (
                              <div className="flex items-center justify-center gap-1 text-sm text-blue-600 font-semibold py-2 border-t border-blue-100 pt-3 mt-auto">
                                <Check className="w-4 h-4" /> Active
                              </div>
                            ) : tier.monthly_price === 0 ? (
                              <a href="mailto:sales@shadowfield.app?subject=Enterprise%20Plan%20Inquiry"
                                className="block w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-lg hover:from-purple-500 hover:to-indigo-500 transition-colors text-center mt-auto">
                                Contact Sales
                              </a>
                            ) : (
                              <button onClick={() => handleUpgrade(tier.tier_key)} disabled={upgrading}
                                className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors mt-auto">
                                {upgrading ? 'Processing...' : tier.max_members > memberLimit ? 'Upgrade' : 'Switch'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {billingCycle === 'annual' && (
                      <p className="text-xs text-center text-green-600 mt-3 font-medium">
                        Annual billing saves you 20% billed once per year
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Billing History */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Billing History</h3>
                </div>
                {billingHistory.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                        <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingHistory.slice(0, 15).map(e => (
                        <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{format(new Date(e.created_at), 'MMM d, yyyy')}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              e.event_type === 'payment' ? 'bg-green-100 text-green-700' :
                              e.event_type === 'refund' ? 'bg-red-100 text-red-700' :
                              e.event_type === 'upgrade' ? 'bg-blue-100 text-blue-700' :
                              e.event_type === 'card_updated' ? 'bg-indigo-100 text-indigo-700' :
                              e.event_type === 'card_removed' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{e.event_type.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="px-5 py-3 text-gray-600">{e.description || '\u2014'}</td>
                          <td className="px-5 py-3 text-right font-medium text-gray-900">{e.amount ? `$${e.amount.toFixed(2)}` : '\u2014'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-8 text-center text-gray-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No billing events yet</p>
                  </div>
                )}
              </div>

              {/* Cancel Subscription */}
              {isAdmin && subscription && subscription.status === 'active' && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">Cancel Subscription</p>
                      <p className="text-xs text-gray-500 mt-0.5">Your account will remain active until the end of the current billing period.</p>
                    </div>
                    {!showCancelConfirm ? (
                      <button onClick={() => setShowCancelConfirm(true)}
                        className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
                        Cancel Plan
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600 font-medium">Are you sure?</span>
                        <button onClick={handleCancelSubscription}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                          Yes, Cancel
                        </button>
                        <button onClick={() => setShowCancelConfirm(false)}
                          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
                          Never mind
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* SECURITY TAB */}
      {tab === 'security' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h3 className="font-semibold text-gray-900">Change Password</h3>
          <div className="max-w-sm">
            <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
          </div>
          {passwordMsg && <p className={`text-sm ${passwordMsg.includes('updated') ? 'text-green-600' : 'text-red-600'}`}>{passwordMsg}</p>}
          <button onClick={handlePasswordChange}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Update Password
          </button>
        </div>
      )}

      {/* ABOUT TAB */}
      {tab === 'about' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">About</h3>
          <div className="space-y-3">
            {[
              { label: 'Organization', value: tenant?.name },
              { label: 'Plan', value: (subscription?.tier_key || tenant?.subscription_tier || 'N/A'), capitalize: true },
              { label: 'Members', value: `${memberCount} / ${memberLimit === 999 ? '\u221E' : memberLimit}` },
              { label: 'Your Role', value: member?.role, capitalize: true },
              { label: 'App Version', value: '1.0.0' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{row.label}</span>
                <span className={`text-sm font-medium text-gray-900 ${row.capitalize ? 'capitalize' : ''}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
