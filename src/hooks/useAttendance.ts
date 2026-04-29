import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface AttendanceEvent {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  event_type: string;
  location: string | null;
  start_time: string;
  end_time: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  recurrence_day: number | null;
  color: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSchedule {
  id: string;
  event_id: string;
  member_id: string;
  role_assignment: string | null;
  is_required: boolean;
  notes: string | null;
  created_at: string;
  // Joined fields
  member_name?: string;
  member_email?: string;
  member_role?: string;
  member_avatar_url?: string | null;
}

export interface AttendanceCheckin {
  id: string;
  event_id: string;
  member_id: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  checked_in_by: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  member_name?: string;
  member_role?: string;
}

export const EVENT_TYPES = [
  { value: 'sunday_service', label: 'Sunday Service', icon: '⛪', color: '#3B82F6' },
  { value: 'wednesday_service', label: 'Wednesday Service', icon: '📖', color: '#8B5CF6' },
  { value: 'special_event', label: 'Special Event', icon: '🌟', color: '#F59E0B' },
  { value: 'rehearsal', label: 'Rehearsal', icon: '🎵', color: '#EC4899' },
  { value: 'meeting', label: 'Meeting', icon: '🤝', color: '#10B981' },
  { value: 'training', label: 'Training', icon: '📋', color: '#6366F1' },
  { value: 'outreach', label: 'Outreach', icon: '🌍', color: '#14B8A6' },
  { value: 'other', label: 'Other', icon: '📌', color: '#6B7280' },
] as const;

export const CHECKIN_STATUSES = [
  { value: 'checked_in', label: 'Checked In', color: 'bg-green-100 text-green-800', dot: 'bg-green-500', icon: '✅' },
  { value: 'checked_out', label: 'Checked Out', color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-400', icon: '🚪' },
  { value: 'late', label: 'Late', color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', icon: '⏰' },
  { value: 'sick', label: 'Sick', color: 'bg-red-100 text-red-800', dot: 'bg-red-500', icon: '🤒' },
  { value: 'excused', label: 'Excused', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', icon: '📝' },
  { value: 'no_show', label: 'No Show', color: 'bg-red-100 text-red-800', dot: 'bg-red-600', icon: '❌' },
  { value: 'on_break', label: 'On Break', color: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', icon: '☕' },
  { value: 'standby', label: 'Standby', color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500', icon: '📡' },
] as const;

export const RECURRENCE_OPTIONS = [
  { value: 'weekly', label: 'Every Week' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
] as const;

export function useAttendance() {
  const { tenant, user, member } = useAuth();
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [schedules, setSchedules] = useState<AttendanceSchedule[]>([]);
  const [checkins, setCheckins] = useState<AttendanceCheckin[]>([]);
  const [loading, setLoading] = useState(false);

  // ─── Events ───

  const fetchEvents = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from('attendance_events')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('start_time', { ascending: false });
    if (fetchErr) console.error('[Attendance] fetchEvents error:', fetchErr);
    if (data) setEvents(data);
    setLoading(false);
  }, [tenant]);

  const createEvent = useCallback(async (event: Partial<AttendanceEvent>) => {
    if (!tenant || !user) return;
    const { data, error } = await supabase
      .from('attendance_events')
      .insert({ ...event, tenant_id: tenant.id, created_by: user.id })
      .select()
      .single();
    if (error) console.error('[Attendance] createEvent error:', error);
    await fetchEvents();
    return { data, error };
  }, [tenant, user, fetchEvents]);

  const updateEvent = useCallback(async (id: string, updates: Partial<AttendanceEvent>) => {
    const { error } = await supabase
      .from('attendance_events')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) await fetchEvents();
    return { error };
  }, [fetchEvents]);

  const deleteEvent = useCallback(async (id: string) => {
    await supabase.from('attendance_events').update({ is_active: false }).eq('id', id);
    await fetchEvents();
  }, [fetchEvents]);

  // ─── Schedules (roster) ───

  const fetchSchedule = useCallback(async (eventId: string) => {
    const { data } = await supabase
      .from('attendance_schedules')
      .select('*, tenant_members!inner(display_name, email, role, avatar_url)')
      .eq('event_id', eventId)
      .order('created_at');
    const mapped = (data || []).map((s: any) => ({
      ...s,
      member_name: s.tenant_members?.display_name,
      member_email: s.tenant_members?.email,
      member_role: s.tenant_members?.role,
      member_avatar_url: s.tenant_members?.avatar_url,
    }));
    setSchedules(mapped);
    return mapped;
  }, []);

  const addToSchedule = useCallback(async (eventId: string, memberId: string, roleAssignment?: string) => {
    const { data, error } = await supabase
      .from('attendance_schedules')
      .insert({ event_id: eventId, member_id: memberId, role_assignment: roleAssignment || null })
      .select()
      .single();
    if (data) await fetchSchedule(eventId);
    return { data, error };
  }, [fetchSchedule]);

  const updateScheduleEntry = useCallback(async (id: string, updates: Partial<AttendanceSchedule>, eventId: string) => {
    const { error } = await supabase
      .from('attendance_schedules')
      .update(updates)
      .eq('id', id);
    if (!error) await fetchSchedule(eventId);
    return { error };
  }, [fetchSchedule]);

  const removeFromSchedule = useCallback(async (id: string, eventId: string) => {
    await supabase.from('attendance_schedules').delete().eq('id', id);
    await fetchSchedule(eventId);
  }, [fetchSchedule]);

  // ─── Check-ins ───

  const fetchCheckins = useCallback(async (eventId: string) => {
    const { data } = await supabase
      .from('attendance_checkins')
      .select('*, tenant_members!inner(display_name, role)')
      .eq('event_id', eventId)
      .order('checked_in_at', { ascending: false });
    const mapped = (data || []).map((c: any) => ({
      ...c,
      member_name: c.tenant_members?.display_name,
      member_role: c.tenant_members?.role,
    }));
    setCheckins(mapped);
    return mapped;
  }, []);

  const checkIn = useCallback(async (eventId: string, memberId: string, status: string = 'checked_in', notes?: string) => {
    if (!user) return;
    // Upsert — if they already have a record for this event, update it
    const { data: existing } = await supabase
      .from('attendance_checkins')
      .select('id')
      .eq('event_id', eventId)
      .eq('member_id', memberId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'checked_in' || status === 'late') updates.checked_in_at = new Date().toISOString();
      if (status === 'checked_out') updates.checked_out_at = new Date().toISOString();
      if (notes !== undefined) updates.notes = notes;
      await supabase.from('attendance_checkins').update(updates).eq('id', existing.id);
    } else {
      await supabase.from('attendance_checkins').insert({
        event_id: eventId,
        member_id: memberId,
        status,
        checked_in_at: ['checked_in', 'late'].includes(status) ? new Date().toISOString() : null,
        checked_in_by: user.id,
        notes: notes || null,
      });
    }
    await fetchCheckins(eventId);
  }, [user, fetchCheckins]);

  const updateCheckin = useCallback(async (id: string, updates: Partial<AttendanceCheckin>, eventId: string) => {
    await supabase.from('attendance_checkins')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    await fetchCheckins(eventId);
  }, [fetchCheckins]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Computed
  const upcomingEvents = events.filter(e => new Date(e.start_time) >= new Date(new Date().toDateString()));
  const pastEvents = events.filter(e => new Date(e.start_time) < new Date(new Date().toDateString()));

  return {
    events, upcomingEvents, pastEvents,
    schedules, checkins, loading,
    fetchEvents, createEvent, updateEvent, deleteEvent,
    fetchSchedule, addToSchedule, updateScheduleEntry, removeFromSchedule,
    fetchCheckins, checkIn, updateCheckin,
  };
}
