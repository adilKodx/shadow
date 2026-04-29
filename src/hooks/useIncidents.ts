import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface Incident {
  id: string;
  tenant_id: string;
  incident_number: string | null;
  title: string;
  description: string | null;
  incident_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'investigating' | 'contained' | 'resolved' | 'closed' | 'escalated';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  location: string | null;
  location_detail: string | null;
  latitude: number | null;
  longitude: number | null;
  occurred_at: string;
  resolved_at: string | null;
  reported_by: string | null;
  reported_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  poi_id: string | null;
  injuries_reported: boolean;
  police_notified: boolean;
  police_report_number: string | null;
  evidence_collected: string | null;
  witness_info: string | null;
  resolution_notes: string | null;
  ai_severity_score: number | null;
  ai_analysis: string | null;
  ai_recommendations: string | null;
  ai_analyzed_at: string | null;
  tags: string[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncidentUpdate {
  id: string;
  incident_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  update_type: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface IncidentResponder {
  id: string;
  incident_id: string;
  user_id: string;
  display_name: string | null;
  status: 'enroute' | 'onscene' | 'cleared';
  responded_at: string;
  arrived_at: string | null;
  cleared_at: string | null;
}

export const INCIDENT_TYPES = [
  { value: 'security_breach', label: 'Security Breach', icon: 'ShieldAlert' },
  { value: 'theft', label: 'Theft', icon: 'PackageX' },
  { value: 'assault', label: 'Assault', icon: 'Swords' },
  { value: 'trespass', label: 'Trespass', icon: 'DoorOpen' },
  { value: 'vandalism', label: 'Vandalism', icon: 'Hammer' },
  { value: 'medical', label: 'Medical Emergency', icon: 'Heart' },
  { value: 'fire', label: 'Fire', icon: 'Flame' },
  { value: 'suspicious_activity', label: 'Suspicious Activity', icon: 'Eye' },
  { value: 'disturbance', label: 'Disturbance', icon: 'Volume2' },
  { value: 'vehicle', label: 'Vehicle Incident', icon: 'Car' },
  { value: 'weather', label: 'Weather Emergency', icon: 'CloudLightning' },
  { value: 'evacuation', label: 'Evacuation', icon: 'LogOut' },
  { value: 'lockdown', label: 'Lockdown', icon: 'Lock' },
  { value: 'equipment_failure', label: 'Equipment Failure', icon: 'Wrench' },
  { value: 'policy_violation', label: 'Policy Violation', icon: 'FileWarning' },
  { value: 'other', label: 'Other', icon: 'HelpCircle' },
] as const;

export const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
] as const;

export const INCIDENT_STATUSES = [
  { value: 'reported', label: 'Reported', color: 'bg-blue-100 text-blue-800' },
  { value: 'investigating', label: 'Investigating', color: 'bg-amber-100 text-amber-800' },
  { value: 'contained', label: 'Contained', color: 'bg-purple-100 text-purple-800' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-800' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-800' },
  { value: 'escalated', label: 'Escalated', color: 'bg-red-100 text-red-800' },
] as const;

export function useIncidents() {
  const { tenant, user, member } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchIncidents = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from('incidents')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_archived', false)
      .order('occurred_at', { ascending: false });
    if (data) setIncidents(data);
    setLoading(false);
  }, [tenant]);

  const createIncident = useCallback(async (incident: Partial<Incident>) => {
    if (!tenant || !user || !member) return;
    const { data, error } = await supabase
      .from('incidents')
      .insert({
        ...incident,
        tenant_id: tenant.id,
        reported_by: user.id,
        reported_by_name: member.display_name,
      })
      .select()
      .single();
    if (data) await fetchIncidents();
    return { data, error };
  }, [tenant, user, member, fetchIncidents]);

  const updateIncident = useCallback(async (id: string, updates: Partial<Incident>) => {
    const { error } = await supabase
      .from('incidents')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) await fetchIncidents();
    return { error };
  }, [fetchIncidents]);

  const deleteIncident = useCallback(async (id: string) => {
    await supabase.from('incidents').update({ is_archived: true }).eq('id', id);
    await fetchIncidents();
  }, [fetchIncidents]);

  // Updates / Timeline
  const fetchUpdates = useCallback(async (incidentId: string) => {
    const { data } = await supabase
      .from('incident_updates')
      .select('*')
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: false });
    return data || [];
  }, []);

  const addUpdate = useCallback(async (incidentId: string, content: string, updateType: string = 'note') => {
    if (!user || !member) return;
    const { error } = await supabase.from('incident_updates').insert({
      incident_id: incidentId,
      author_id: user.id,
      author_name: member.display_name,
      content,
      update_type: updateType,
    });
    return { error };
  }, [user, member]);

  // Photos
  const uploadPhoto = useCallback(async (incidentId: string, file: File) => {
    const path = `${tenant?.id}/${incidentId}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('incident-photos').upload(path, file);
    if (uploadErr) return { error: uploadErr };

    const { data: { publicUrl } } = supabase.storage.from('incident-photos').getPublicUrl(path);
    const { error } = await supabase.from('incident_photos').insert({
      incident_id: incidentId,
      file_name: file.name,
      file_path: publicUrl,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user?.id,
    });
    return { error };
  }, [tenant, user]);

  const fetchPhotos = useCallback(async (incidentId: string) => {
    const { data } = await supabase
      .from('incident_photos')
      .select('*')
      .eq('incident_id', incidentId)
      .order('sort_order');
    return data || [];
  }, []);

  // ─── Responders (Phase 2) ───
  const [responders, setResponders] = useState<IncidentResponder[]>([]);

  const fetchResponders = useCallback(async () => {
    if (!tenant) return [];
    const incidentIds = incidents.map(i => i.id);
    if (incidentIds.length === 0) {
      setResponders([]);
      return [];
    }
    const { data } = await supabase
      .from('incident_responders')
      .select('*')
      .in('incident_id', incidentIds);
    setResponders(data || []);
    return data || [];
  }, [tenant, incidents]);

  const respondToIncident = useCallback(async (incidentId: string) => {
    if (!user || !member) return { error: new Error('Not authenticated') };
    const { error } = await supabase.from('incident_responders').upsert({
      incident_id: incidentId,
      user_id: user.id,
      display_name: member.display_name,
      status: 'enroute',
      responded_at: new Date().toISOString(),
    }, { onConflict: 'incident_id,user_id' });
    if (!error) {
      await addUpdate(incidentId, `${member.display_name} is responding`, 'status_change');
      await fetchResponders();
    }
    return { error };
  }, [user, member, addUpdate, fetchResponders]);

  const updateResponderStatus = useCallback(async (incidentId: string, status: 'enroute' | 'onscene' | 'cleared') => {
    if (!user) return { error: new Error('Not authenticated') };
    const updates: Record<string, any> = { status };
    if (status === 'onscene') updates.arrived_at = new Date().toISOString();
    if (status === 'cleared') updates.cleared_at = new Date().toISOString();
    const { error } = await supabase
      .from('incident_responders')
      .update(updates)
      .eq('incident_id', incidentId)
      .eq('user_id', user.id);
    if (!error) await fetchResponders();
    return { error };
  }, [user, fetchResponders]);

  const cancelResponse = useCallback(async (incidentId: string) => {
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase
      .from('incident_responders')
      .delete()
      .eq('incident_id', incidentId)
      .eq('user_id', user.id);
    if (!error) await fetchResponders();
    return { error };
  }, [user, fetchResponders]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);
  useEffect(() => { fetchResponders(); }, [fetchResponders]);

  const activeIncidents = incidents.filter(i => !['closed', 'resolved'].includes(i.status));
  const criticalIncidents = incidents.filter(i => i.severity === 'critical' && !['closed', 'resolved'].includes(i.status));
  // Incidents with coordinates that should appear on the map
  const mapIncidents = activeIncidents.filter(i => i.latitude != null && i.longitude != null);

  const myResponses = responders.filter(r => r.user_id === user?.id);
  const isResponding = (incidentId: string) =>
    myResponses.some(r => r.incident_id === incidentId && r.status !== 'cleared');
  const respondersFor = (incidentId: string) =>
    responders.filter(r => r.incident_id === incidentId);

  return {
    incidents,
    activeIncidents,
    criticalIncidents,
    mapIncidents,
    loading,
    fetchIncidents,
    createIncident,
    updateIncident,
    deleteIncident,
    fetchUpdates,
    addUpdate,
    uploadPhoto,
    fetchPhotos,
    // responders
    responders,
    fetchResponders,
    respondToIncident,
    updateResponderStatus,
    cancelResponse,
    isResponding,
    respondersFor,
  };
}
