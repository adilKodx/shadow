import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface SOP {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  estimated_minutes: number | null;
  icon: string | null;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SOPStep {
  id: string;
  sop_id: string;
  step_number: number;
  title: string;
  description: string | null;
  responsible_role: string | null;
  estimated_minutes: number | null;
  is_critical: boolean;
  requires_confirmation: boolean;
  sort_order: number;
}

export interface ActionPlan {
  id: string;
  tenant_id: string;
  sop_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  triggered_by: string | null;
  triggered_by_name: string | null;
  triggered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionPlanStep {
  id: string;
  plan_id: string;
  sop_step_id: string | null;
  step_number: number;
  title: string;
  description: string | null;
  status: string;
  responsible_role: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  is_critical: boolean;
  requires_confirmation: boolean;
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  notes: string | null;
  sort_order: number;
}

export const SOP_CATEGORIES = [
  { value: 'active_shooter', label: 'Active Shooter', icon: '🔫', color: '#DC2626' },
  { value: 'medical', label: 'Medical Emergency', icon: '🏥', color: '#EC4899' },
  { value: 'fire', label: 'Fire', icon: '🔥', color: '#F97316' },
  { value: 'evacuation', label: 'Evacuation', icon: '🚪', color: '#EAB308' },
  { value: 'suspicious_person', label: 'Suspicious Person', icon: '👤', color: '#8B5CF6' },
  { value: 'bomb_threat', label: 'Bomb Threat', icon: '💣', color: '#EF4444' },
  { value: 'weather', label: 'Severe Weather', icon: '⛈️', color: '#6366F1' },
  { value: 'power_outage', label: 'Power Outage', icon: '💡', color: '#64748B' },
  { value: 'lockdown', label: 'Lockdown', icon: '🔒', color: '#991B1B' },
  { value: 'intruder', label: 'Intruder', icon: '🚨', color: '#B91C1C' },
  { value: 'missing_child', label: 'Missing Child', icon: '👶', color: '#F59E0B' },
  { value: 'domestic_violence', label: 'Domestic Violence', icon: '⚠️', color: '#9333EA' },
  { value: 'trespassing', label: 'Trespassing', icon: '🚫', color: '#78716C' },
  { value: 'custom', label: 'Custom', icon: '📋', color: '#3B82F6' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#6B7280' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#F97316' },
  { value: 'critical', label: 'Critical', color: '#DC2626' },
];

export function useSOPs() {
  const { tenant, user, member } = useAuth();
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Fetch SOPs ───
  const fetchSOPs = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('sops')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order');
    if (data) setSOPs(data as SOP[]);
  }, [tenant]);

  // ─── Fetch SOP Steps ───
  const fetchSOPSteps = useCallback(async (sopId: string) => {
    const { data } = await supabase
      .from('sop_steps')
      .select('*')
      .eq('sop_id', sopId)
      .order('sort_order');
    return (data || []) as SOPStep[];
  }, []);

  // ─── Fetch Action Plans ───
  const fetchActionPlans = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('action_plans')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    if (data) setActionPlans(data as ActionPlan[]);
  }, [tenant]);

  // ─── Fetch Action Plan Steps ───
  const fetchActionPlanSteps = useCallback(async (planId: string) => {
    const { data } = await supabase
      .from('action_plan_steps')
      .select('*')
      .eq('plan_id', planId)
      .order('sort_order');
    return (data || []) as ActionPlanStep[];
  }, []);

  // ─── SOP CRUD ───
  const createSOP = useCallback(async (sop: Partial<SOP>) => {
    if (!tenant) return { data: null, error: new Error('No tenant') };
    const { data, error } = await supabase
      .from('sops')
      .insert({ ...sop, tenant_id: tenant.id, created_by: user?.id })
      .select()
      .single();
    if (!error) await fetchSOPs();
    return { data, error };
  }, [tenant, user, fetchSOPs]);

  const updateSOP = useCallback(async (id: string, updates: Partial<SOP>) => {
    const { error } = await supabase.from('sops').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) await fetchSOPs();
    return { error };
  }, [fetchSOPs]);

  const deleteSOP = useCallback(async (id: string) => {
    const { error } = await supabase.from('sops').delete().eq('id', id);
    if (!error) await fetchSOPs();
    return { error };
  }, [fetchSOPs]);

  // ─── SOP Step CRUD ───
  const createSOPStep = useCallback(async (step: Partial<SOPStep>) => {
    const { data, error } = await supabase.from('sop_steps').insert(step).select().single();
    return { data, error };
  }, []);

  const updateSOPStep = useCallback(async (id: string, updates: Partial<SOPStep>) => {
    const { error } = await supabase.from('sop_steps').update(updates).eq('id', id);
    return { error };
  }, []);

  const deleteSOPStep = useCallback(async (id: string) => {
    const { error } = await supabase.from('sop_steps').delete().eq('id', id);
    return { error };
  }, []);

  // ─── Activate SOP → Create Action Plan ───
  const activateSOP = useCallback(async (sopId: string) => {
    if (!tenant || !user || !member) return { data: null, error: new Error('Not authenticated') };

    // Get the SOP
    const sop = sops.find(s => s.id === sopId);
    if (!sop) return { data: null, error: new Error('SOP not found') };

    // Get steps
    const steps = await fetchSOPSteps(sopId);

    // Create action plan
    const { data: plan, error: planError } = await supabase
      .from('action_plans')
      .insert({
        tenant_id: tenant.id,
        sop_id: sopId,
        title: sop.title,
        description: sop.description,
        status: 'active',
        priority: sop.priority,
        category: sop.category,
        triggered_by: user.id,
        triggered_by_name: member.display_name,
        triggered_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (planError || !plan) return { data: null, error: planError };

    // Create steps from template
    if (steps.length > 0) {
      const planSteps = steps.map(s => ({
        plan_id: plan.id,
        sop_step_id: s.id,
        step_number: s.step_number,
        title: s.title,
        description: s.description,
        status: 'pending',
        responsible_role: s.responsible_role,
        is_critical: s.is_critical,
        requires_confirmation: s.requires_confirmation,
        sort_order: s.sort_order,
      }));
      await supabase.from('action_plan_steps').insert(planSteps);
    }

    await fetchActionPlans();
    return { data: plan as ActionPlan, error: null };
  }, [tenant, user, member, sops, fetchSOPSteps, fetchActionPlans]);

  // ─── Action Plan Updates ───
  const updateActionPlan = useCallback(async (id: string, updates: Partial<ActionPlan>) => {
    const { error } = await supabase.from('action_plans').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (!error) await fetchActionPlans();
    return { error };
  }, [fetchActionPlans]);

  const completeActionPlan = useCallback(async (id: string) => {
    return updateActionPlan(id, { status: 'completed', completed_at: new Date().toISOString() });
  }, [updateActionPlan]);

  const cancelActionPlan = useCallback(async (id: string) => {
    return updateActionPlan(id, { status: 'cancelled', cancelled_at: new Date().toISOString() });
  }, [updateActionPlan]);

  // ─── Action Plan Step Updates ───
  const updateActionPlanStep = useCallback(async (id: string, updates: Partial<ActionPlanStep>) => {
    const { error } = await supabase.from('action_plan_steps').update(updates).eq('id', id);
    return { error };
  }, []);

  const completeStep = useCallback(async (stepId: string) => {
    if (!user || !member) return { error: new Error('Not authenticated') };
    return updateActionPlanStep(stepId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: user.id,
      completed_by_name: member.display_name,
    });
  }, [user, member, updateActionPlanStep]);

  const startStep = useCallback(async (stepId: string) => {
    return updateActionPlanStep(stepId, {
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });
  }, [updateActionPlanStep]);

  const skipStep = useCallback(async (stepId: string, notes?: string) => {
    return updateActionPlanStep(stepId, {
      status: 'skipped',
      notes: notes || 'Skipped',
    });
  }, [updateActionPlanStep]);

  const assignStep = useCallback(async (stepId: string, userId: string | null, name: string | null) => {
    return updateActionPlanStep(stepId, {
      assigned_to: userId,
      assigned_name: name,
    });
  }, [updateActionPlanStep]);

  // ─── Seed Defaults ───
  const seedDefaults = useCallback(async () => {
    if (!tenant || !user) return;
    const { error } = await supabase.rpc('seed_default_sops', {
      p_tenant_id: tenant.id,
      p_created_by: user.id,
    });
    if (!error) await fetchSOPs();
    return { error };
  }, [tenant, user, fetchSOPs]);

  // ─── Init ───
  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    Promise.all([fetchSOPs(), fetchActionPlans()]).finally(() => setLoading(false));
  }, [tenant, fetchSOPs, fetchActionPlans]);

  // Computed
  const activePlans = actionPlans.filter(p => p.status === 'active');
  const completedPlans = actionPlans.filter(p => p.status === 'completed');

  return {
    sops, actionPlans, activePlans, completedPlans, loading,
    fetchSOPs, fetchSOPSteps, fetchActionPlans, fetchActionPlanSteps,
    createSOP, updateSOP, deleteSOP,
    createSOPStep, updateSOPStep, deleteSOPStep,
    activateSOP, updateActionPlan, completeActionPlan, cancelActionPlan,
    updateActionPlanStep, completeStep, startStep, skipStep, assignStep,
    seedDefaults,
  };
}
