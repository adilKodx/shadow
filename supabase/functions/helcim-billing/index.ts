import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HELCIM_API = 'https://api.helcim.com/v2';

async function getHelcimApiToken(supabase: any): Promise<string> {
  // Try vault first, then fallback to env
  const { data } = await supabase.from('marketing_settings').select('value').eq('key', 'helcim_api_token').single();
  if (data?.value) return data.value;
  const envToken = Deno.env.get('HELCIM_API_TOKEN');
  if (envToken) return envToken;
  throw new Error('Helcim API token not configured. Set it in marketing_settings or HELCIM_API_TOKEN env var.');
}

async function helcimRequest(apiToken: string, endpoint: string, method: string, body?: any) {
  const res = await fetch(`${HELCIM_API}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'api-token': apiToken,
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(json.errors?.[0]?.message || json.message || `Helcim API ${res.status}: ${text}`);
  return json;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { action, ...params } = await req.json();
    const apiToken = await getHelcimApiToken(supabase);

    // --- INITIALIZE HELCIM PAY CHECKOUT ---
    if (action === 'initialize_checkout') {
      const { amount, currency = 'CAD', paymentType = 'purchase', customerCode } = params;
      const body: any = { paymentType, amount, currency };
      if (customerCode) body.customerCode = customerCode;
      const result = await helcimRequest(apiToken, '/helcim-pay/initialize', 'POST', body);
      return new Response(JSON.stringify({ checkoutToken: result.checkoutToken, secretToken: result.secretToken }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- INITIALIZE CARD VERIFICATION ($0 auth) ---
    if (action === 'initialize_verify') {
      const { customerCode } = params;
      const body: any = { paymentType: 'verify', amount: 0, currency: 'USD' };
      if (customerCode) body.customerCode = customerCode;
      const result = await helcimRequest(apiToken, '/helcim-pay/initialize', 'POST', body);
      return new Response(JSON.stringify({ checkoutToken: result.checkoutToken, secretToken: result.secretToken }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- SAVE CARD FROM HELCIM PAY RESPONSE ---
    if (action === 'save_card') {
      const { subscriptionId, cardToken, cardF6L4, cardExpiry, cardType, helcimCustomerId, transactionId } = params;
      // Update subscription with card info
      const updates: any = {
        helcim_card_token: cardToken,
        helcim_card_f6l4: cardF6L4,
        helcim_card_expiry: cardExpiry,
        helcim_card_type: cardType,
        payment_method_brand: cardType,
        payment_method_last4: cardF6L4 ? cardF6L4.slice(-4) : null,
      };
      if (helcimCustomerId) updates.helcim_customer_id = helcimCustomerId;

      const { error } = await supabase.from('subscriptions').update(updates).eq('id', subscriptionId);
      if (error) throw new Error(`Failed to save card: ${error.message}`);

      // Log billing event
      const { data: sub } = await supabase.from('subscriptions').select('tenant_id').eq('id', subscriptionId).single();
      if (sub) {
        await supabase.from('billing_events').insert({
          subscription_id: subscriptionId,
          tenant_id: sub.tenant_id,
          event_type: 'card_updated',
          description: `Payment method updated: ${cardType} ••••${cardF6L4?.slice(-4) || '****'}`,
          helcim_transaction_id: transactionId,
          payment_method: cardType,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- PROCESS SUBSCRIPTION PAYMENT ---
    if (action === 'charge_subscription') {
      const { subscriptionId } = params;
      const { data: sub, error: subErr } = await supabase.from('subscriptions').select('*').eq('id', subscriptionId).single();
      if (subErr || !sub) throw new Error('Subscription not found');
      if (!sub.helcim_card_token) throw new Error('No card on file. Please add a payment method first.');
      if (sub.effective_price <= 0) throw new Error('Nothing to charge — plan is free or custom.');

      // Process payment via Helcim
      const payment = await helcimRequest(apiToken, '/payment/purchase', 'POST', {
        amount: sub.effective_price,
        currency: 'USD',
        cardToken: sub.helcim_card_token,
        customerCode: sub.helcim_customer_id,
        comments: `${sub.tier_key} plan — ${sub.billing_cycle} subscription`,
      });

      // Update subscription
      const now = new Date();
      const nextCharge = new Date(now);
      if (sub.billing_cycle === 'annual') nextCharge.setFullYear(nextCharge.getFullYear() + 1);
      else nextCharge.setMonth(nextCharge.getMonth() + 1);

      await supabase.from('subscriptions').update({
        status: 'active',
        last_payment_at: now.toISOString(),
        last_payment_amount: sub.effective_price,
        current_period_start: now.toISOString(),
        current_period_end: nextCharge.toISOString(),
        next_charge_at: nextCharge.toISOString(),
      }).eq('id', subscriptionId);

      // Log billing event
      await supabase.from('billing_events').insert({
        subscription_id: subscriptionId,
        tenant_id: sub.tenant_id,
        event_type: 'payment',
        amount: sub.effective_price,
        currency: 'USD',
        description: `${sub.tier_key} plan — ${sub.billing_cycle} payment`,
        period_start: now.toISOString(),
        period_end: nextCharge.toISOString(),
        helcim_transaction_id: payment.transactionId?.toString(),
        helcim_card_batch_id: payment.cardBatchId?.toString(),
        payment_method: sub.helcim_card_type || 'card',
      });

      return new Response(JSON.stringify({ success: true, transactionId: payment.transactionId, nextChargeAt: nextCharge.toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- REMOVE CARD ---
    if (action === 'remove_card') {
      const { subscriptionId } = params;
      await supabase.from('subscriptions').update({
        helcim_card_token: null,
        helcim_card_f6l4: null,
        helcim_card_expiry: null,
        helcim_card_type: null,
        payment_method_brand: null,
        payment_method_last4: null,
      }).eq('id', subscriptionId);

      const { data: sub } = await supabase.from('subscriptions').select('tenant_id').eq('id', subscriptionId).single();
      if (sub) {
        await supabase.from('billing_events').insert({
          subscription_id: subscriptionId,
          tenant_id: sub.tenant_id,
          event_type: 'card_removed',
          description: 'Payment method removed',
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
