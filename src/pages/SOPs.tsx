import { useState, useEffect } from 'react';
import {
  FileText, Plus, Play, CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronRight, ChevronDown, Trash2, Edit3, Save, X, Shield,
  Users, Zap, RefreshCw, ArrowLeft, SkipForward, UserCheck,
  CircleDot, Radio, BookOpen, Rocket, Archive,
} from 'lucide-react';
import {
  useSOPs, SOP_CATEGORIES, PRIORITY_OPTIONS,
  type SOP, type SOPStep, type ActionPlan, type ActionPlanStep,
} from '../hooks/useSOPs';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const STEP_STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600', icon: CircleDot },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Radio },
  completed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  skipped: { bg: 'bg-gray-100', text: 'text-gray-400', icon: SkipForward },
};

export default function SOPsPage() {
  const { member, user } = useAuth();
  const {
    sops, actionPlans, activePlans, completedPlans, loading,
    fetchSOPs, fetchSOPSteps, fetchActionPlans, fetchActionPlanSteps,
    createSOP, updateSOP, deleteSOP,
    createSOPStep, updateSOPStep, deleteSOPStep,
    activateSOP, completeActionPlan, cancelActionPlan,
    completeStep, startStep, skipStep,
    seedDefaults,
  } = useSOPs();

  const [view, setView] = useState<'library' | 'plans' | 'plan-detail' | 'sop-detail'>('library');
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);
  const [sopSteps, setSOPSteps] = useState<SOPStep[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);
  const [planSteps, setPlanSteps] = useState<ActionPlanStep[]>([]);
  const [seeding, setSeeding] = useState(false);

  // SOP editor
  const [editingSOP, setEditingSOP] = useState(false);
  const [sopForm, setSOPForm] = useState<Partial<SOP>>({});

  // Step editor
  const [addingStep, setAddingStep] = useState(false);
  const [stepForm, setStepForm] = useState<Partial<SOPStep>>({ title: '', description: '', responsible_role: '', is_critical: false, requires_confirmation: false });

  const isAdmin = member?.role === 'owner' || member?.role === 'admin' || member?.role === 'supervisor';

  // Load SOP steps when selected
  useEffect(() => {
    if (selectedSOP) {
      fetchSOPSteps(selectedSOP.id).then(setSOPSteps);
    }
  }, [selectedSOP, fetchSOPSteps]);

  // Load plan steps when selected
  useEffect(() => {
    if (selectedPlan) {
      fetchActionPlanSteps(selectedPlan.id).then(setPlanSteps);
    }
  }, [selectedPlan, fetchActionPlanSteps]);

  const handleSeedDefaults = async () => {
    setSeeding(true);
    await seedDefaults();
    setSeeding(false);
  };

  const handleActivateSOP = async (sopId: string) => {
    const { data } = await activateSOP(sopId);
    if (data) {
      setSelectedPlan(data);
      fetchActionPlanSteps(data.id).then(setPlanSteps);
      setView('plan-detail');
    }
  };

  const handleCreateSOP = async () => {
    const cat = SOP_CATEGORIES.find(c => c.value === sopForm.category);
    const { data } = await createSOP({
      ...sopForm,
      color: cat?.color || '#3B82F6',
      icon: cat?.icon || '📋',
    });
    if (data) {
      setSelectedSOP(data as SOP);
      setSOPSteps([]);
      setEditingSOP(false);
      setView('sop-detail');
    }
  };

  const handleAddStep = async () => {
    if (!selectedSOP || !stepForm.title) return;
    const nextNum = sopSteps.length + 1;
    const { data } = await createSOPStep({
      sop_id: selectedSOP.id,
      step_number: nextNum,
      sort_order: nextNum,
      ...stepForm,
    });
    if (data) {
      setSOPSteps(prev => [...prev, data as SOPStep]);
      setStepForm({ title: '', description: '', responsible_role: '', is_critical: false, requires_confirmation: false });
      setAddingStep(false);
    }
  };

  const handleDeleteSOPStep = async (stepId: string) => {
    await deleteSOPStep(stepId);
    setSOPSteps(prev => prev.filter(s => s.id !== stepId));
  };

  const handleStepAction = async (step: ActionPlanStep, action: 'start' | 'complete' | 'skip') => {
    if (action === 'start') await startStep(step.id);
    else if (action === 'complete') await completeStep(step.id);
    else if (action === 'skip') await skipStep(step.id);
    // Refresh
    if (selectedPlan) fetchActionPlanSteps(selectedPlan.id).then(setPlanSteps);
  };

  const handleCompletePlan = async () => {
    if (!selectedPlan) return;
    await completeActionPlan(selectedPlan.id);
    await fetchActionPlans();
    setView('plans');
  };

  const handleCancelPlan = async () => {
    if (!selectedPlan) return;
    await cancelActionPlan(selectedPlan.id);
    await fetchActionPlans();
    setView('plans');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // PLAN DETAIL VIEW
  // ═══════════════════════════════════════════════════
  if (view === 'plan-detail' && selectedPlan) {
    const totalSteps = planSteps.length;
    const doneSteps = planSteps.filter(s => s.status === 'completed').length;
    const progressPct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
    const cat = SOP_CATEGORIES.find(c => c.value === selectedPlan.category);
    const isActive = selectedPlan.status === 'active';

    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <button onClick={() => setView('plans')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to Plans
        </button>

        {/* Plan header */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6" style={{ background: `linear-gradient(135deg, ${cat?.color || '#3B82F6'}15, ${cat?.color || '#3B82F6'}05)` }}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: (cat?.color || '#3B82F6') + '20' }}>
                  {cat?.icon || '📋'}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive ? 'bg-green-100 text-green-700 animate-pulse' : selectedPlan.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {selectedPlan.status.toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold`} style={{ backgroundColor: (PRIORITY_OPTIONS.find(p => p.value === selectedPlan.priority)?.color || '#6B7280') + '20', color: PRIORITY_OPTIONS.find(p => p.value === selectedPlan.priority)?.color }}>
                      {selectedPlan.priority}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedPlan.title}</h2>
                  {selectedPlan.description && <p className="text-sm text-gray-600 mt-1">{selectedPlan.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {selectedPlan.triggered_by_name && <span>By {selectedPlan.triggered_by_name}</span>}
                    {selectedPlan.triggered_at && <span>{format(new Date(selectedPlan.triggered_at), 'MMM d, h:mm a')}</span>}
                  </div>
                </div>
              </div>
              {isActive && (
                <div className="flex gap-2">
                  <button onClick={handleCompletePlan} className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                    <CheckCircle className="w-4 h-4" /> Complete
                  </button>
                  <button onClick={handleCancelPlan} className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">
                    <XCircle className="w-4 h-4" /> Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-gray-700">{doneSteps} of {totalSteps} steps complete</span>
                <span className="font-bold" style={{ color: cat?.color || '#3B82F6' }}>{progressPct}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, backgroundColor: cat?.color || '#3B82F6' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {planSteps.map((step, idx) => {
            const style = STEP_STATUS_STYLES[step.status] || STEP_STATUS_STYLES.pending;
            const StepIcon = style.icon;
            const isNext = isActive && step.status === 'pending' && (idx === 0 || planSteps[idx - 1]?.status === 'completed' || planSteps[idx - 1]?.status === 'skipped');

            return (
              <div
                key={step.id}
                className={`bg-white rounded-xl border-2 p-4 transition-all ${
                  isNext ? 'border-blue-400 shadow-md shadow-blue-100' :
                  step.status === 'completed' ? 'border-green-200' :
                  step.status === 'in_progress' ? 'border-blue-300 shadow-sm' :
                  step.status === 'skipped' ? 'border-gray-200 opacity-60' :
                  'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                    <StepIcon className={`w-4 h-4 ${style.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">#{step.step_number}</span>
                      <h4 className={`font-semibold text-sm ${step.status === 'skipped' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{step.title}</h4>
                      {step.is_critical && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">CRITICAL</span>}
                    </div>
                    {step.description && <p className="text-xs text-gray-500 mt-1">{step.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                      {step.responsible_role && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {step.responsible_role}</span>}
                      {step.assigned_name && <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> {step.assigned_name}</span>}
                      {step.completed_by_name && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" /> {step.completed_by_name}</span>}
                      {step.completed_at && <span>{format(new Date(step.completed_at), 'h:mm a')}</span>}
                    </div>
                  </div>

                  {/* Action buttons */}
                  {isActive && step.status !== 'completed' && step.status !== 'skipped' && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {step.status === 'pending' && (
                        <button onClick={() => handleStepAction(step, 'start')} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                          Start
                        </button>
                      )}
                      {step.status === 'in_progress' && (
                        <button onClick={() => handleStepAction(step, 'complete')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                          Done
                        </button>
                      )}
                      <button onClick={() => handleStepAction(step, 'skip')} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Skip">
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // SOP DETAIL VIEW (template editor)
  // ═══════════════════════════════════════════════════
  if (view === 'sop-detail' && selectedSOP) {
    const cat = SOP_CATEGORIES.find(c => c.value === selectedSOP.category);

    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <button onClick={() => { setView('library'); setSelectedSOP(null); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </button>

        {/* SOP Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: (selectedSOP.color || '#3B82F6') + '20' }}>
                {selectedSOP.icon || cat?.icon || '📋'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedSOP.title}</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedSOP.description}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: (cat?.color || '#3B82F6') + '15', color: cat?.color }}>{cat?.label || selectedSOP.category}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: (PRIORITY_OPTIONS.find(p => p.value === selectedSOP.priority)?.color || '#6B7280') + '15', color: PRIORITY_OPTIONS.find(p => p.value === selectedSOP.priority)?.color }}>{selectedSOP.priority}</span>
                  {selectedSOP.estimated_minutes && <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> ~{selectedSOP.estimated_minutes} min</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleActivateSOP(selectedSOP.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 shadow-lg shadow-red-200"
              >
                <Rocket className="w-4 h-4" /> ACTIVATE
              </button>
              {isAdmin && (
                <button onClick={() => { if (confirm('Delete this SOP?')) { deleteSOP(selectedSOP.id); setView('library'); setSelectedSOP(null); } }}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100" title="Delete SOP">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Steps ({sopSteps.length})</h3>
            {isAdmin && (
              <button onClick={() => setAddingStep(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100">
                <Plus className="w-4 h-4" /> Add Step
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {sopSteps.map(step => (
              <div key={step.id} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
                  {step.step_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 text-sm">{step.title}</h4>
                    {step.is_critical && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">CRITICAL</span>}
                    {step.requires_confirmation && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">CONFIRM</span>}
                  </div>
                  {step.description && <p className="text-xs text-gray-500 mt-1">{step.description}</p>}
                  {step.responsible_role && <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1"><Users className="w-3 h-3" /> {step.responsible_role}</p>}
                </div>
                {isAdmin && (
                  <button onClick={() => handleDeleteSOPStep(step.id)} className="p-1 text-gray-400 hover:text-red-500" title="Delete step">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {sopSteps.length === 0 && !addingStep && (
              <div className="px-6 py-12 text-center text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No steps yet. Add steps to define the procedure.</p>
              </div>
            )}

            {/* Add step form */}
            {addingStep && (
              <div className="px-6 py-4 bg-blue-50 space-y-3">
                <p className="text-xs font-semibold text-blue-700 uppercase">New Step</p>
                <input type="text" placeholder="Step title *" value={stepForm.title || ''}
                  onChange={e => setStepForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <textarea placeholder="Description (optional)" value={stepForm.description || ''} rows={2}
                  onChange={e => setStepForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="text" placeholder="Responsible role (e.g. Team Lead)" value={stepForm.responsible_role || ''}
                  onChange={e => setStepForm(f => ({ ...f, responsible_role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={stepForm.is_critical || false} onChange={e => setStepForm(f => ({ ...f, is_critical: e.target.checked }))} className="rounded" />
                    Critical step
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={stepForm.requires_confirmation || false} onChange={e => setStepForm(f => ({ ...f, requires_confirmation: e.target.checked }))} className="rounded" />
                    Requires confirmation
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddStep} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Add Step</button>
                  <button onClick={() => setAddingStep(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // MAIN VIEW (Library + Plans tabs)
  // ═══════════════════════════════════════════════════
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">SOPs & Action Plans</h2>
          <p className="text-sm text-gray-500">Standard Operating Procedures and live action plans</p>
        </div>
        <div className="flex items-center gap-2">
          {activePlans.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold text-red-700">{activePlans.length} Active</span>
            </div>
          )}
          <button onClick={() => { fetchSOPs(); fetchActionPlans(); }} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setView('library')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'library' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          <BookOpen className="w-4 h-4" /> SOP Library ({sops.length})
        </button>
        <button onClick={() => setView('plans')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'plans' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          <Zap className="w-4 h-4" /> Action Plans ({actionPlans.length})
          {activePlans.length > 0 && <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{activePlans.length}</span>}
        </button>
      </div>

      {/* ── SOP LIBRARY ── */}
      {view === 'library' && (
        <div>
          {/* Empty state / seed button */}
          {sops.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">No SOPs Yet</h3>
              <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                Start by loading our pre-built church security SOPs, or create your own from scratch.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={handleSeedDefaults} disabled={seeding} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200">
                  {seeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  Load Default SOPs
                </button>
                <button onClick={() => { setSOPForm({ category: 'custom', priority: 'high' }); setEditingSOP(true); }} className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200">
                  <Plus className="w-4 h-4" /> Create Custom
                </button>
              </div>
            </div>
          )}

          {/* SOP grid */}
          {sops.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">{sops.length} procedures ready</p>
                <div className="flex gap-2">
                  <button onClick={handleSeedDefaults} disabled={seeding} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">
                    {seeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />} Seed Defaults
                  </button>
                  {isAdmin && (
                    <button onClick={() => { setSOPForm({ category: 'custom', priority: 'high' }); setEditingSOP(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                      <Plus className="w-3.5 h-3.5" /> New SOP
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sops.map(sop => {
                  const cat = SOP_CATEGORIES.find(c => c.value === sop.category);
                  return (
                    <div
                      key={sop.id}
                      onClick={() => { setSelectedSOP(sop); setView('sop-detail'); }}
                      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-gray-300 cursor-pointer transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: (sop.color || '#3B82F6') + '15' }}>
                          {sop.icon || cat?.icon || '📋'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-700 transition-colors">{sop.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: (cat?.color || '#3B82F6') + '15', color: cat?.color }}>{cat?.label}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: (PRIORITY_OPTIONS.find(p => p.value === sop.priority)?.color || '#6B7280') + '15', color: PRIORITY_OPTIONS.find(p => p.value === sop.priority)?.color }}>{sop.priority}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 mt-1" />
                      </div>
                      {sop.description && <p className="text-xs text-gray-500 line-clamp-2">{sop.description}</p>}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        {sop.estimated_minutes && <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> ~{sop.estimated_minutes} min</span>}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleActivateSOP(sop.id); }}
                          className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                        >
                          <Play className="w-3 h-3" /> Activate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Create SOP modal */}
          {editingSOP && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4">
                <h3 className="font-bold text-gray-900 text-lg">Create New SOP</h3>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                  <input type="text" value={sopForm.title || ''} onChange={e => setSOPForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Bomb Threat Response" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={sopForm.description || ''} onChange={e => setSOPForm(f => ({ ...f, description: e.target.value }))} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                    <select value={sopForm.category || 'custom'} onChange={e => setSOPForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      {SOP_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                    <select value={sopForm.priority || 'high'} onChange={e => setSOPForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Estimated Time (minutes)</label>
                  <input type="number" min={1} value={sopForm.estimated_minutes || ''} onChange={e => setSOPForm(f => ({ ...f, estimated_minutes: parseInt(e.target.value) || undefined }))}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setEditingSOP(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
                  <button onClick={handleCreateSOP} disabled={!sopForm.title} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Create SOP</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ACTION PLANS ── */}
      {view === 'plans' && (
        <div className="space-y-6">
          {/* Active plans */}
          {activePlans.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-700 uppercase mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Active Plans
              </h3>
              <div className="space-y-3">
                {activePlans.map(plan => {
                  const cat = SOP_CATEGORIES.find(c => c.value === plan.category);
                  return (
                    <button
                      key={plan.id}
                      onClick={() => { setSelectedPlan(plan); setView('plan-detail'); }}
                      className="w-full text-left bg-white rounded-xl border-2 border-red-200 p-5 hover:shadow-lg hover:border-red-300 transition-all flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl animate-pulse" style={{ backgroundColor: (cat?.color || '#DC2626') + '20' }}>
                        {cat?.icon || '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900">{plan.title}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>By {plan.triggered_by_name}</span>
                          {plan.triggered_at && <span>{format(new Date(plan.triggered_at), 'MMM d, h:mm a')}</span>}
                        </div>
                      </div>
                      <div className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold">
                        IN PROGRESS
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed / cancelled */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
              <Archive className="w-4 h-4" /> Past Plans ({actionPlans.filter(p => p.status !== 'active').length})
            </h3>
            {actionPlans.filter(p => p.status !== 'active').length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No past action plans. Activate an SOP to create one.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {actionPlans.filter(p => p.status !== 'active').map(plan => {
                  const cat = SOP_CATEGORIES.find(c => c.value === plan.category);
                  return (
                    <button
                      key={plan.id}
                      onClick={() => { setSelectedPlan(plan); setView('plan-detail'); }}
                      className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition-all flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: (cat?.color || '#6B7280') + '10' }}>
                        {cat?.icon || '📋'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm">{plan.title}</h4>
                        <p className="text-xs text-gray-500">{plan.triggered_by_name} · {plan.triggered_at && format(new Date(plan.triggered_at), 'MMM d, yyyy')}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        plan.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>{plan.status}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
