import { useState, useEffect } from 'react';
import {
  CalendarCheck, Plus, X, Users, Clock, CheckCircle2, AlertTriangle,
  ChevronRight, Search, UserCheck, UserX, Coffee, Radio, Edit3, Trash2,
  ClipboardList, RefreshCw,
} from 'lucide-react';
import {
  useAttendance, EVENT_TYPES, CHECKIN_STATUSES, RECURRENCE_OPTIONS,
  type AttendanceEvent, type AttendanceSchedule, type AttendanceCheckin,
} from '../hooks/useAttendance';
import { useTeam } from '../hooks/useTeam';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { format } from 'date-fns';

export default function AttendancePage() {
  const { member, user } = useAuth();
  const { primaryColor } = useBranding();
  const {
    events, upcomingEvents, pastEvents, schedules, checkins, loading,
    fetchEvents, createEvent, updateEvent, deleteEvent,
    fetchSchedule, addToSchedule, updateScheduleEntry, removeFromSchedule,
    fetchCheckins, checkIn, updateCheckin,
  } = useAttendance();
  const { members } = useTeam();

  const isAdmin = member?.role === 'owner' || member?.role === 'admin' || member?.role === 'supervisor';

  const [view, setView] = useState<'events' | 'checkin'>('events');
  const [selectedEvent, setSelectedEvent] = useState<AttendanceEvent | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AttendanceEvent | null>(null);
  const [eventForm, setEventForm] = useState<Partial<AttendanceEvent>>({
    event_type: 'sunday_service', color: '#3B82F6', is_recurring: false,
  });
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [addMemberRole, setAddMemberRole] = useState('');
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [checkinNotes, setCheckinNotes] = useState<Record<string, string>>({});

  // Load schedule + checkins when event selected
  useEffect(() => {
    if (selectedEvent) {
      fetchSchedule(selectedEvent.id);
      fetchCheckins(selectedEvent.id);
    }
  }, [selectedEvent, fetchSchedule, fetchCheckins]);

  const [saveError, setSaveError] = useState('');

  const handleSaveEvent = async () => {
    if (!eventForm.title || !eventForm.start_time) return;
    setSaveError('');
    let result;
    if (editingEvent) {
      result = await updateEvent(editingEvent.id, eventForm);
    } else {
      result = await createEvent(eventForm);
    }
    if (result?.error) {
      console.error('[Attendance] save error:', result.error);
      setSaveError(typeof result.error === 'string' ? result.error : result.error.message || 'Failed to save event. Check if migration 00010 has been applied.');
      return;
    }
    setShowEventForm(false);
    setEditingEvent(null);
    setEventForm({ event_type: 'sunday_service', color: '#3B82F6', is_recurring: false });
  };

  const openEditEvent = (e: AttendanceEvent) => {
    setEditingEvent(e);
    setEventForm(e);
    setShowEventForm(true);
  };

  const handleSelectEvent = (e: AttendanceEvent) => {
    setSelectedEvent(e);
    setView('checkin');
  };

  // Get checkin status for a member in current event
  const getMemberCheckin = (memberId: string) => checkins.find(c => c.member_id === memberId);

  // Quick status change
  const handleStatusChange = async (memberId: string, status: string) => {
    if (!selectedEvent) return;
    await checkIn(selectedEvent.id, memberId, status, checkinNotes[memberId] || undefined);
  };

  // Members available to add (not already scheduled)
  const scheduledMemberIds = new Set(schedules.map(s => s.member_id));
  const availableMembers = members
    .filter(m => m.is_active && !scheduledMemberIds.has(m.id))
    .filter(m => !addMemberSearch || m.display_name.toLowerCase().includes(addMemberSearch.toLowerCase()));

  // Stats for current event
  const checkedInCount = checkins.filter(c => c.status === 'checked_in' || c.status === 'late').length;
  const sickCount = checkins.filter(c => c.status === 'sick').length;
  const noShowCount = checkins.filter(c => c.status === 'no_show').length;
  const excusedCount = checkins.filter(c => c.status === 'excused').length;

  const displayEvents = tab === 'upcoming' ? upcomingEvents : pastEvents;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* ─── Left: Events List ─── */}
      <div className="w-[360px] border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-blue-600" />
              Attendance
            </h2>
            {isAdmin && (
              <button onClick={() => { setEditingEvent(null); setEventForm({ event_type: 'sunday_service', color: '#3B82F6', is_recurring: false }); setShowEventForm(true); }}
                className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setTab('upcoming')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium ${tab === 'upcoming' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              Upcoming ({upcomingEvents.length})
            </button>
            <button onClick={() => setTab('past')} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium ${tab === 'past' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
              Past ({pastEvents.length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {displayEvents.map(evt => {
            const et = EVENT_TYPES.find(t => t.value === evt.event_type);
            const isSelected = selectedEvent?.id === evt.id;
            return (
              <button key={evt.id} onClick={() => handleSelectEvent(evt)}
                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{et?.icon || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{evt.title}</p>
                    <p className="text-xs text-gray-500">{et?.label}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(evt.start_time), 'MMM d, h:mm a')}
                  </span>
                  {evt.location && <span>{evt.location}</span>}
                  {evt.is_recurring && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-medium">Recurring</span>}
                </div>
              </button>
            );
          })}
          {displayEvents.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No {tab} events
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Detail / Check-in Panel ─── */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* Event Form */}
        {showEventForm && (
          <div className="max-w-2xl mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">{editingEvent ? 'Edit Event' : 'New Event / Service'}</h2>
              <button onClick={() => setShowEventForm(false)} className="p-1 hover:bg-gray-200 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              {saveError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span className="text-sm text-red-800">{saveError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={eventForm.title || ''} onChange={e => setEventForm({...eventForm, title: e.target.value})}
                  placeholder="Sunday Morning Service" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Event Type</label>
                  <select value={eventForm.event_type || 'sunday_service'} onChange={e => {
                    const et = EVENT_TYPES.find(t => t.value === e.target.value);
                    setEventForm({...eventForm, event_type: e.target.value, color: et?.color || '#3B82F6'});
                  }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                    {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                  <input type="text" value={eventForm.location || ''} onChange={e => setEventForm({...eventForm, location: e.target.value})}
                    placeholder="Main Sanctuary" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Time *</label>
                  <input type="datetime-local" value={eventForm.start_time ? eventForm.start_time.slice(0, 16) : ''}
                    onChange={e => setEventForm({...eventForm, start_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                  <input type="datetime-local" value={eventForm.end_time ? eventForm.end_time.slice(0, 16) : ''}
                    onChange={e => setEventForm({...eventForm, end_time: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea value={eventForm.description || ''} onChange={e => setEventForm({...eventForm, description: e.target.value})}
                  rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={eventForm.is_recurring || false}
                    onChange={e => setEventForm({...eventForm, is_recurring: e.target.checked})} className="rounded" />
                  Recurring Event
                </label>
                {eventForm.is_recurring && (
                  <select value={eventForm.recurrence_rule || 'weekly'} onChange={e => setEventForm({...eventForm, recurrence_rule: e.target.value})}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none">
                    {RECURRENCE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveEvent} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
                {editingEvent && isAdmin && (
                  <button onClick={() => { deleteEvent(editingEvent.id); setShowEventForm(false); setSelectedEvent(null); }}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100">Delete</button>
                )}
                <button onClick={() => setShowEventForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Check-in View */}
        {selectedEvent && !showEventForm && (
          <div className="p-6 space-y-6">
            {/* Event header */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{EVENT_TYPES.find(t => t.value === selectedEvent.event_type)?.icon}</span>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedEvent.title}</h2>
                    <p className="text-sm text-gray-500">
                      {format(new Date(selectedEvent.start_time), 'EEEE, MMMM d, yyyy — h:mm a')}
                      {selectedEvent.location && ` · ${selectedEvent.location}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { fetchSchedule(selectedEvent.id); fetchCheckins(selectedEvent.id); }}
                    className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh">
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                  </button>
                  {isAdmin && (
                    <button onClick={() => openEditEvent(selectedEvent)}
                      className="p-2 hover:bg-gray-100 rounded-lg" title="Edit event">
                      <Edit3 className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-5 gap-3 mt-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{schedules.length}</p>
                  <p className="text-[10px] text-blue-600 font-medium uppercase">Scheduled</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{checkedInCount}</p>
                  <p className="text-[10px] text-green-600 font-medium uppercase">Checked In</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{sickCount}</p>
                  <p className="text-[10px] text-red-600 font-medium uppercase">Sick</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{excusedCount}</p>
                  <p className="text-[10px] text-amber-600 font-medium uppercase">Excused</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700">{noShowCount}</p>
                  <p className="text-[10px] text-gray-600 font-medium uppercase">No Show</p>
                </div>
              </div>
            </div>

            {/* Roster + Check-in Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-600" />
                  Roster & Check-In
                </h3>
                {isAdmin && (
                  <button onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100">
                    <Plus className="w-3.5 h-3.5" /> Add to Roster
                  </button>
                )}
              </div>

              {/* Add member panel */}
              {showAddMember && (
                <div className="p-4 bg-blue-50 border-b border-blue-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" value={addMemberSearch} onChange={e => setAddMemberSearch(e.target.value)}
                        placeholder="Search team members..." className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                    </div>
                    <input type="text" value={addMemberRole} onChange={e => setAddMemberRole(e.target.value)}
                      placeholder="Role (e.g. Entrance A)" className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                    <button onClick={() => { setShowAddMember(false); setAddMemberSearch(''); setAddMemberRole(''); }}
                      className="p-2 hover:bg-blue-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {availableMembers.map(m => (
                      <button key={m.id} onClick={async () => {
                        await addToSchedule(selectedEvent.id, m.id, addMemberRole || undefined);
                        setAddMemberRole('');
                      }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-100 rounded-lg text-left">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${primaryColor}, #0ea5e9)` }}>
                          {m.display_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{m.display_name}</p>
                          <p className="text-xs text-gray-500 capitalize">{m.role}</p>
                        </div>
                        <Plus className="w-4 h-4 text-blue-500 ml-auto" />
                      </button>
                    ))}
                    {availableMembers.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-2">All active members are already on the roster</p>
                    )}
                  </div>
                </div>
              )}

              {/* Roster table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Member</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Assignment</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Time</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase">Notes</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(sched => {
                    const ci = getMemberCheckin(sched.member_id);
                    const st = CHECKIN_STATUSES.find(s => s.value === ci?.status);
                    return (
                      <tr key={sched.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: `linear-gradient(135deg, ${primaryColor}, #0ea5e9)` }}>
                              {sched.member_name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{sched.member_name}</p>
                              <p className="text-xs text-gray-500 capitalize">{sched.member_role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {sched.role_assignment || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {ci ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${st?.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st?.dot}`} />
                              {st?.label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Not checked in</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {ci?.checked_in_at && format(new Date(ci.checked_in_at), 'h:mm a')}
                          {ci?.checked_out_at && <span className="text-gray-400"> → {format(new Date(ci.checked_out_at), 'h:mm a')}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={checkinNotes[sched.member_id] ?? ci?.notes ?? ''}
                            onChange={e => setCheckinNotes(prev => ({...prev, [sched.member_id]: e.target.value}))}
                            placeholder="Notes..."
                            className="w-full px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded text-xs outline-none" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* Quick status buttons */}
                            <button onClick={() => handleStatusChange(sched.member_id, 'checked_in')}
                              title="Check In" className={`p-1.5 rounded-lg transition-colors ${ci?.status === 'checked_in' ? 'bg-green-100' : 'hover:bg-green-50'}`}>
                              <UserCheck className="w-4 h-4 text-green-600" />
                            </button>
                            <button onClick={() => handleStatusChange(sched.member_id, 'checked_out')}
                              title="Check Out" className={`p-1.5 rounded-lg transition-colors ${ci?.status === 'checked_out' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
                              <UserX className="w-4 h-4 text-gray-500" />
                            </button>
                            <button onClick={() => handleStatusChange(sched.member_id, 'late')}
                              title="Late" className={`p-1.5 rounded-lg transition-colors ${ci?.status === 'late' ? 'bg-amber-100' : 'hover:bg-amber-50'}`}>
                              <Clock className="w-4 h-4 text-amber-600" />
                            </button>
                            <button onClick={() => handleStatusChange(sched.member_id, 'sick')}
                              title="Sick" className={`p-1.5 rounded-lg transition-colors ${ci?.status === 'sick' ? 'bg-red-100' : 'hover:bg-red-50'}`}>
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                            </button>
                            <button onClick={() => handleStatusChange(sched.member_id, 'excused')}
                              title="Excused" className={`p-1.5 rounded-lg transition-colors ${ci?.status === 'excused' ? 'bg-blue-100' : 'hover:bg-blue-50'}`}>
                              <ClipboardList className="w-4 h-4 text-blue-500" />
                            </button>
                            {/* More statuses in a select */}
                            <select value={ci?.status || ''}
                              onChange={e => { if (e.target.value) handleStatusChange(sched.member_id, e.target.value); }}
                              className="px-1 py-1 border border-gray-200 rounded text-[10px] outline-none w-16">
                              <option value="">More</option>
                              {CHECKIN_STATUSES.map(s => <option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                            </select>
                            {/* Remove from roster */}
                            {isAdmin && (
                              <button onClick={() => removeFromSchedule(sched.id, selectedEvent.id)}
                                title="Remove from roster" className="p-1.5 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {schedules.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">No one on the roster yet</p>
                        <p className="text-xs mt-1">Add team members to this event's roster to start tracking attendance</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedEvent && !showEventForm && (
          <div className="flex-1 flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Attendance & Check-In</p>
              <p className="text-sm">Select an event or create a new one to manage attendance</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
