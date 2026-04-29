import { useState } from 'react';
import {
  AlertTriangle, Plus, Search, X, MapPin, Clock, User, FileText,
  ChevronRight, Filter,
} from 'lucide-react';
import { useIncidents, INCIDENT_TYPES, SEVERITY_LEVELS, INCIDENT_STATUSES, type Incident } from '../hooks/useIncidents';
import { useBranding } from '../context/BrandingContext';
import { format } from 'date-fns';

export default function IncidentsPage() {
  const { primaryColor } = useBranding();
  const { incidents, loading, createIncident, updateIncident, deleteIncident, addUpdate } = useIncidents();
  const [selected, setSelected] = useState<Incident | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [updateText, setUpdateText] = useState('');
  const [form, setForm] = useState<Partial<Incident>>({
    incident_type: 'other', severity: 'medium', status: 'reported', priority: 'normal',
  });

  const filtered = incidents.filter(inc => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || inc.title.toLowerCase().includes(q) || inc.incident_number?.includes(q);
    const matchesStatus = !filterStatus || inc.status === filterStatus;
    const matchesSeverity = !filterSeverity || inc.severity === filterSeverity;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const handleSave = async () => {
    if (selected) {
      await updateIncident(selected.id, form);
    } else {
      await createIncident(form);
    }
    setShowForm(false);
    setSelected(null);
    setForm({ incident_type: 'other', severity: 'medium', status: 'reported', priority: 'normal' });
  };

  const openEdit = (inc: Incident) => {
    setSelected(inc);
    setForm(inc);
    setShowForm(true);
  };

  const openNew = () => {
    setSelected(null);
    setForm({ incident_type: 'other', severity: 'medium', status: 'reported', priority: 'normal' });
    setShowForm(true);
  };

  const handleAddUpdate = async () => {
    if (!selected || !updateText.trim()) return;
    await addUpdate(selected.id, updateText.trim());
    setUpdateText('');
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* List panel */}
      <div className="w-[400px] border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Incidents</h2>
            <button onClick={openNew} className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search incidents..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setFilterStatus('')} className={`px-2 py-1 rounded text-xs ${!filterStatus ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>All</button>
            {INCIDENT_STATUSES.slice(0, 4).map(s => (
              <button key={s.value} onClick={() => setFilterStatus(s.value)} className={`px-2 py-1 rounded text-xs ${filterStatus === s.value ? 'bg-gray-900 text-white' : s.color}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.map(inc => {
            const sev = SEVERITY_LEVELS.find(s => s.value === inc.severity);
            const st = INCIDENT_STATUSES.find(s => s.value === inc.status);
            return (
              <button key={inc.id} onClick={() => openEdit(inc)} className={`w-full text-left p-4 hover:bg-gray-50 ${selected?.id === inc.id ? 'bg-blue-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sev?.dot}`} />
                  <p className="text-sm font-medium text-gray-900 truncate flex-1">{inc.title}</p>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                  <span className="font-mono">{inc.incident_number}</span>
                  <span className={`px-1.5 py-0.5 rounded ${st?.color}`}>{st?.label}</span>
                  <span>{format(new Date(inc.occurred_at), 'MMM d, h:mm a')}</span>
                </div>
                {inc.location && <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{inc.location}</p>}
              </button>
            );
          })}
          {filtered.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No incidents found</div>}
        </div>
      </div>

      {/* Detail / Form */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {showForm ? (
          <div className="max-w-2xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">{selected ? `Edit ${selected.incident_number || 'Incident'}` : 'Report New Incident'}</h2>
              <button onClick={() => { setShowForm(false); setSelected(null); }} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={form.title || ''} onChange={(e) => setForm({...form, title: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="Brief description of the incident" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.incident_type || 'other'} onChange={(e) => setForm({...form, incident_type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    {INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Severity</label>
                  <select value={form.severity || 'medium'} onChange={(e) => setForm({...form, severity: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    {SEVERITY_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status || 'reported'} onChange={(e) => setForm({...form, status: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    {INCIDENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                  <select value={form.priority || 'normal'} onChange={(e) => setForm({...form, priority: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    {['low','normal','high','urgent'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description || ''} onChange={(e) => setForm({...form, description: e.target.value})} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                  <input type="text" value={form.location || ''} onChange={(e) => setForm({...form, location: e.target.value})} placeholder="Building, area, zone" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Location Detail</label>
                  <input type="text" value={form.location_detail || ''} onChange={(e) => setForm({...form, location_detail: e.target.value})} placeholder="Room, floor, entrance" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.injuries_reported || false} onChange={(e) => setForm({...form, injuries_reported: e.target.checked})} className="rounded" />
                  Injuries Reported
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.police_notified || false} onChange={(e) => setForm({...form, police_notified: e.target.checked})} className="rounded" />
                  Police Notified
                </label>
              </div>

              {form.police_notified && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Police Report #</label>
                  <input type="text" value={form.police_report_number || ''} onChange={(e) => setForm({...form, police_report_number: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Witness Information</label>
                <textarea value={form.witness_info || ''} onChange={(e) => setForm({...form, witness_info: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>

              {selected && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Resolution Notes</label>
                  <textarea value={form.resolution_notes || ''} onChange={(e) => setForm({...form, resolution_notes: e.target.value})} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  {selected ? 'Update Incident' : 'Report Incident'}
                </button>
                {selected && (
                  <button onClick={() => { deleteIncident(selected.id); setShowForm(false); setSelected(null); }} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100">
                    Archive
                  </button>
                )}
                <button onClick={() => { setShowForm(false); setSelected(null); }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Incident Management</p>
              <p className="text-sm">Select an incident or report a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
