import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface TeamLocation {
  user_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  battery_level: number | null;
  is_moving: boolean;
  recorded_at: string;
}

export interface MapZone {
  id: string;
  tenant_id: string;
  name: string;
  zone_type: string;
  description: string | null;
  color: string;
  icon: string | null;
  shape_type: string;
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  polygon_coords: any;
  floor_level: number;
  floor_name: string;
  is_active: boolean;
  sort_order: number;
}

export interface MapOverlay {
  id: string;
  tenant_id: string;
  name: string;
  image_url: string;
  north_lat: number | null;
  south_lat: number | null;
  east_lng: number | null;
  west_lng: number | null;
  opacity: number;
  floor_level: number;
  is_active: boolean;
}

export const ZONE_TYPES = [
  { value: 'exit', label: 'Exit', color: '#EF4444', icon: '🚪' },
  { value: 'entrance', label: 'Entrance', color: '#22C55E', icon: '🚶' },
  { value: 'building', label: 'Building', color: '#3B82F6', icon: '🏢' },
  { value: 'parking', label: 'Parking', color: '#6B7280', icon: '🅿️' },
  { value: 'restricted', label: 'Restricted', color: '#DC2626', icon: '⛔' },
  { value: 'safe_room', label: 'Safe Room', color: '#059669', icon: '🛡️' },
  { value: 'stage', label: 'Stage / Sanctuary', color: '#8B5CF6', icon: '⛪' },
  { value: 'nursery', label: 'Nursery / Kids', color: '#F59E0B', icon: '👶' },
  { value: 'playground', label: 'Playground', color: '#10B981', icon: '🎪' },
  { value: 'custom', label: 'Custom', color: '#6366F1', icon: '📍' },
];

export function useMap() {
  const { tenant, member, user } = useAuth();
  const [teamLocations, setTeamLocations] = useState<TeamLocation[]>([]);
  const [zones, setZones] = useState<MapZone[]>([]);
  const [overlays, setOverlays] = useState<MapOverlay[]>([]);
  const [loading, setLoading] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTeamLocations = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase.rpc('get_team_locations', { p_tenant_id: tenant.id });
    if (data) setTeamLocations(data as TeamLocation[]);
  }, [tenant]);

  const fetchZones = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('map_zones')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order');
    if (data) setZones(data as MapZone[]);
  }, [tenant]);

  const fetchOverlays = useCallback(async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('map_overlays')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order');
    if (data) setOverlays(data as MapOverlay[]);
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    Promise.all([fetchTeamLocations(), fetchZones(), fetchOverlays()]).finally(() => setLoading(false));

    // Poll team locations every 10s
    intervalRef.current = setInterval(fetchTeamLocations, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tenant, fetchTeamLocations, fetchZones, fetchOverlays]);

  // Report own location
  const reportLocation = useCallback(async () => {
    if (!tenant || !user || !member) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await supabase.rpc('report_member_location', {
          p_tenant_id: tenant.id,
          p_user_id: user.id,
          p_display_name: member.display_name,
          p_latitude: pos.coords.latitude,
          p_longitude: pos.coords.longitude,
          p_accuracy: pos.coords.accuracy,
          p_altitude: pos.coords.altitude,
          p_heading: pos.coords.heading,
          p_speed: pos.coords.speed,
          p_battery_level: null,
        });
      },
      (err) => console.error('Geolocation error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [tenant, user, member]);

  // Start continuous location tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;
    // Report immediately
    reportLocation();
    // Then watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        if (!tenant || !user || !member) return;
        await supabase.rpc('report_member_location', {
          p_tenant_id: tenant.id,
          p_user_id: user.id,
          p_display_name: member.display_name,
          p_latitude: pos.coords.latitude,
          p_longitude: pos.coords.longitude,
          p_accuracy: pos.coords.accuracy,
          p_altitude: pos.coords.altitude,
          p_heading: pos.coords.heading,
          p_speed: pos.coords.speed,
          p_battery_level: null,
        });
      },
      (err) => console.error('Watch error:', err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }, [tenant, user, member, reportLocation]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Zone CRUD
  const createZone = async (zone: Partial<MapZone>) => {
    if (!tenant) return null;
    const { data, error } = await supabase
      .from('map_zones')
      .insert({ ...zone, tenant_id: tenant.id, created_by: user?.id })
      .select()
      .single();
    if (!error && data) {
      setZones(prev => [...prev, data as MapZone]);
    }
    return { data, error };
  };

  const updateZone = async (id: string, updates: Partial<MapZone>) => {
    const { error } = await supabase.from('map_zones').update(updates).eq('id', id);
    if (!error) setZones(prev => prev.map(z => z.id === id ? { ...z, ...updates } : z));
    return { error };
  };

  const deleteZone = async (id: string) => {
    const { error } = await supabase.from('map_zones').delete().eq('id', id);
    if (!error) setZones(prev => prev.filter(z => z.id !== id));
    return { error };
  };

  // Overlay CRUD
  const createOverlay = async (overlay: Partial<MapOverlay>) => {
    if (!tenant) return null;
    const { data, error } = await supabase
      .from('map_overlays')
      .insert({ ...overlay, tenant_id: tenant.id, created_by: user?.id })
      .select()
      .single();
    if (!error && data) setOverlays(prev => [...prev, data as MapOverlay]);
    return { data, error };
  };

  const deleteOverlay = async (id: string) => {
    const { error } = await supabase.from('map_overlays').delete().eq('id', id);
    if (!error) setOverlays(prev => prev.filter(o => o.id !== id));
    return { error };
  };

  const isTracking = watchIdRef.current !== null;
  const onlineMembers = teamLocations.filter(l => {
    const age = Date.now() - new Date(l.recorded_at).getTime();
    return age < 15 * 60 * 1000; // 15 min
  });
  const movingMembers = onlineMembers.filter(l => l.is_moving);
  const exitZones = zones.filter(z => z.zone_type === 'exit');
  const entranceZones = zones.filter(z => z.zone_type === 'entrance');

  return {
    teamLocations, onlineMembers, movingMembers,
    zones, exitZones, entranceZones, overlays,
    loading, isTracking,
    fetchTeamLocations, fetchZones, fetchOverlays,
    reportLocation, startTracking, stopTracking,
    createZone, updateZone, deleteZone,
    createOverlay, deleteOverlay,
  };
}
