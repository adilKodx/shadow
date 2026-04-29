import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { supabase } from '@shadowfield/shared/src/lib/supabase';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';

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
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTeamLocations = useCallback(async () => {
    if (!tenant) return;
    const { data, error } = await supabase.rpc('get_team_locations', { p_tenant_id: tenant.id });
    if (!error && data) setTeamLocations(data as TeamLocation[]);
  }, [tenant]);

  const fetchZones = useCallback(async () => {
    if (!tenant) return;
    const { data, error } = await supabase
      .from('map_zones')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('sort_order');
    if (!error && data) setZones(data as MapZone[]);
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    Promise.all([fetchTeamLocations(), fetchZones()]).finally(() => setLoading(false));

    // Realtime: update team locations and zones the moment anything changes
    // anywhere in the tenant. The 30s poll below is a safety net in case a
    // realtime event is ever dropped (e.g. socket reconnect).
    const channel = supabase
      .channel(`map:${tenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'member_locations', filter: `tenant_id=eq.${tenant.id}` },
        () => { fetchTeamLocations(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'map_zones', filter: `tenant_id=eq.${tenant.id}` },
        () => { fetchZones(); },
      )
      .subscribe();

    // Safety-net poll (much less frequent now that realtime is primary)
    pollIntervalRef.current = setInterval(fetchTeamLocations, 30000);
    return () => {
      supabase.removeChannel(channel);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [tenant, fetchTeamLocations, fetchZones]);

  const requestPermissions = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(status);
    return status === 'granted';
  }, []);

  const reportLocation = useCallback(async () => {
    if (!tenant || !user || !member) return;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const batteryLevel = await Battery.getBatteryLevelAsync().catch(() => null);
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
        p_battery_level: batteryLevel !== null ? Math.round(batteryLevel * 100) : null,
      });
    } catch (err) {
      console.warn('reportLocation failed:', err);
    }
  }, [tenant, user, member]);

  const startTracking = useCallback(async () => {
    if (watchSubRef.current) return;
    const granted = await requestPermissions();
    if (!granted) return;

    // Report immediately
    await reportLocation();

    // Watch continuously — every 5m of movement
    watchSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5,
        timeInterval: 10000,
      },
      async (pos) => {
        if (!tenant || !user || !member) return;
        const batteryLevel = await Battery.getBatteryLevelAsync().catch(() => null);
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
          p_battery_level: batteryLevel !== null ? Math.round(batteryLevel * 100) : null,
        });
      }
    );
    setIsTracking(true);
  }, [tenant, user, member, requestPermissions, reportLocation]);

  const stopTracking = useCallback(() => {
    if (watchSubRef.current) {
      watchSubRef.current.remove();
      watchSubRef.current = null;
    }
    setIsTracking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchSubRef.current) watchSubRef.current.remove();
    };
  }, []);

  const createZone = async (zone: Partial<MapZone>) => {
    if (!tenant) return { error: 'No tenant' };
    const { data, error } = await supabase
      .from('map_zones')
      .insert({ ...zone, tenant_id: tenant.id, created_by: user?.id })
      .select()
      .single();
    if (!error && data) setZones((prev) => [...prev, data as MapZone]);
    return { data, error };
  };

  const updateZone = async (id: string, updates: Partial<MapZone>) => {
    const { data, error } = await supabase
      .from('map_zones')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      setZones((prev) => prev.map((z) => (z.id === id ? (data as MapZone) : z)));
    }
    return { data, error };
  };

  const deleteZone = async (id: string) => {
    const { error } = await supabase.from('map_zones').delete().eq('id', id);
    if (!error) setZones((prev) => prev.filter((z) => z.id !== id));
    return { error };
  };

  const onlineMembers = teamLocations.filter((l) => {
    const age = Date.now() - new Date(l.recorded_at).getTime();
    return age < 15 * 60 * 1000;
  });
  const movingMembers = onlineMembers.filter((l) => l.is_moving);

  return {
    teamLocations,
    onlineMembers,
    movingMembers,
    zones,
    loading,
    isTracking,
    permissionStatus,
    fetchTeamLocations,
    fetchZones,
    reportLocation,
    startTracking,
    stopTracking,
    requestPermissions,
    createZone,
    updateZone,
    deleteZone,
  };
}
