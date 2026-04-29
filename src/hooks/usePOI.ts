import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface POIRecord {
  id: string;
  tenant_id: string;
  first_name: string | null;
  last_name: string | null;
  alias: string | null;
  description: string | null;
  date_of_birth: string | null;
  gender: string | null;
  height: string | null;
  weight: string | null;
  hair_color: string | null;
  eye_color: string | null;
  distinguishing_marks: string | null;
  threat_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'inactive' | 'resolved' | 'banned' | 'watch';
  category: string | null;
  known_address: string | null;
  known_vehicle: string | null;
  known_associates: string | null;
  ai_risk_score: number | null;
  ai_assessment: string | null;
  ai_assessed_at: string | null;
  reported_by: string | null;
  reported_by_name: string | null;
  last_seen_at: string | null;
  last_seen_location: string | null;
  notes: string | null;
  tags: string[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  photos?: POIPhoto[];
}

export interface POIPhoto {
  id: string;
  poi_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  is_primary: boolean;
  caption: string | null;
  sort_order: number;
}

export interface POISighting {
  id: string;
  poi_id: string;
  reported_by: string | null;
  reported_by_name: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  photo_url: string | null;
  sighted_at: string;
}

export const THREAT_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
] as const;

export const POI_STATUSES = [
  { value: 'active', label: 'Active', color: 'bg-red-100 text-red-800' },
  { value: 'watch', label: 'Watch', color: 'bg-amber-100 text-amber-800' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-100 text-gray-800' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-100 text-green-800' },
  { value: 'banned', label: 'Banned', color: 'bg-purple-100 text-purple-800' },
] as const;

export const POI_CATEGORIES = [
  { value: 'trespass', label: 'Trespass' },
  { value: 'theft', label: 'Theft' },
  { value: 'assault', label: 'Assault' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'suspicious', label: 'Suspicious Activity' },
  { value: 'banned', label: 'Banned Individual' },
  { value: 'known_offender', label: 'Known Offender' },
  { value: 'missing', label: 'Missing Person' },
  { value: 'other', label: 'Other' },
] as const;

export function usePOI() {
  const { tenant, user, member } = useAuth();
  const [records, setRecords] = useState<POIRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from('poi_records')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  }, [tenant]);

  const createRecord = useCallback(async (record: Partial<POIRecord>) => {
    if (!tenant || !user || !member) return;
    const { data, error } = await supabase
      .from('poi_records')
      .insert({
        ...record,
        tenant_id: tenant.id,
        reported_by: user.id,
        reported_by_name: member.display_name,
      })
      .select()
      .single();
    if (data) await fetchRecords();
    return { data, error };
  }, [tenant, user, member, fetchRecords]);

  const updateRecord = useCallback(async (id: string, updates: Partial<POIRecord>) => {
    const { error } = await supabase
      .from('poi_records')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) await fetchRecords();
    return { error };
  }, [fetchRecords]);

  const deleteRecord = useCallback(async (id: string) => {
    await supabase.from('poi_records').update({ is_archived: true }).eq('id', id);
    await fetchRecords();
  }, [fetchRecords]);

  // Photos
  const fetchPhotos = useCallback(async (poiId: string) => {
    const { data } = await supabase
      .from('poi_photos')
      .select('*')
      .eq('poi_id', poiId)
      .order('sort_order');
    return data || [];
  }, []);

  const uploadPhoto = useCallback(async (poiId: string, file: File) => {
    const path = `${tenant?.id}/${poiId}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('poi-photos').upload(path, file);
    if (uploadErr) return { error: uploadErr };

    const { data: { publicUrl } } = supabase.storage.from('poi-photos').getPublicUrl(path);
    const { error } = await supabase.from('poi_photos').insert({
      poi_id: poiId,
      file_name: file.name,
      file_path: publicUrl,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: user?.id,
    });
    return { error };
  }, [tenant, user]);

  // Sightings
  const fetchSightings = useCallback(async (poiId: string) => {
    const { data } = await supabase
      .from('poi_sightings')
      .select('*')
      .eq('poi_id', poiId)
      .order('sighted_at', { ascending: false });
    return data || [];
  }, []);

  const addSighting = useCallback(async (poiId: string, sighting: Partial<POISighting>) => {
    if (!user || !member) return;
    const { error } = await supabase.from('poi_sightings').insert({
      ...sighting,
      poi_id: poiId,
      reported_by: user.id,
      reported_by_name: member.display_name,
    });
    return { error };
  }, [user, member]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  return {
    records,
    loading,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    fetchPhotos,
    uploadPhoto,
    fetchSightings,
    addSighting,
  };
}
