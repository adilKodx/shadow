import { useState } from 'react';
import { Bell, Plus, X, Check, AlertTriangle, Shield, Clock, Users, Send } from 'lucide-react';
import { useAlerts, ALERT_TYPES, type Alert } from '../hooks/useAlerts';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { format } from 'date-fns';

export default function AlertsPage() {
  const { member } = useAuth();
  const { primaryColor } = useBranding();
  const { alerts, activeAlerts, unacknowledgedAlerts, loading, createAlert, acknowledgeAlert, deactivateAlert } = useAlerts();
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'active' | 'all'>('active');
  const [form, setForm] = useState<Partial<Alert>>({
    alert_type: 'info', priority: 'normal', target_all: true,
  });

  const isAdmin = member?.role === 'owner' || member?.role === 'admin' || member?.role === 'supervisor';
  const displayAlerts = tab === 'active' ? activeAlerts : alerts;

  const handleSend = async () => {
    if (!form.title || !form.message) return;
    await createAlert(form);
    setShowForm(false);
    setForm({ alert_type: 'info', priority: 'normal', target_all: true });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Alerts</h2>
          <p className="text-sm text-gray-500">{unacknowledgedAlerts.length} unacknowledged</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
            <Plus className="w-4 h-4" /> Send Alert
          </button>
        )}
      </div>

      {/* Create Alert Form */}
      {showForm && (
        <div className="bg-white rounded-xl border-2 border-red-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-red-500" /> New Alert
            </h3>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Alert Type</label>
              <select value={form.alert_type || 'info'} onChange={(e) => setForm({...form, alert_type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                {ALERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority || 'normal'} onChange={(e) => setForm({...form, priority: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                {['low','normal','high','critical'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" value={form.title || ''} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="Alert title" required />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Message *</label>
            <textarea value={form.message || ''} onChange={(e) => setForm({...form, message: e.target.value})} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500" placeholder="Alert message details..." required />
          </div>

          <div className="flex gap-3">
            <button onClick={handleSend} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2">
              <Send className="w-4 h-4" /> Send Alert
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('active')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'active' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
          Active ({activeAlerts.length})
        </button>
        <button onClick={() => setTab('all')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
          All ({alerts.length})
        </button>
      </div>

      {/* Alert cards */}
      <div className="space-y-3">
        {displayAlerts.map(alert => {
          const at = ALERT_TYPES.find(t => t.value === alert.alert_type);
          return (
            <div key={alert.id} className={`bg-white rounded-xl border ${alert.priority === 'critical' ? 'border-red-300 shadow-red-100 shadow-md' : 'border-gray-200'} overflow-hidden`}>
              <div className={`px-4 py-2 flex items-center gap-2 ${at?.color || 'bg-gray-500 text-white'}`}>
                <Bell className="w-4 h-4" />
                <span className="text-sm font-semibold">{at?.label || alert.alert_type}</span>
                <span className="text-xs opacity-80 ml-auto">{format(new Date(alert.created_at), 'MMM d, h:mm a')}</span>
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-gray-900">{alert.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>By {alert.created_by_name}</span>
                    <span className="flex items-center gap-1"><Check className="w-3 h-3" /> {alert.acknowledged_count} acknowledged</span>
                    {!alert.is_active && <span className="text-red-500 font-medium">Deactivated</span>}
                  </div>
                  <div className="flex gap-2">
                    {alert.is_active && !alert.is_acknowledged && (
                      <button onClick={() => acknowledgeAlert(alert.id)} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Acknowledge
                      </button>
                    )}
                    {alert.is_acknowledged && (
                      <span className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Acknowledged
                      </span>
                    )}
                    {isAdmin && alert.is_active && (
                      <button onClick={() => deactivateAlert(alert.id)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200">
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {displayAlerts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No {tab === 'active' ? 'active ' : ''}alerts</p>
          </div>
        )}
      </div>
    </div>
  );
}
