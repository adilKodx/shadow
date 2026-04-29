import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface VideoFeed {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  feed_url: string;
  feed_type: 'rtsp' | 'hls' | 'mjpeg' | 'embed' | 'youtube' | 'ip_camera';
  location: string | null;
  is_active: boolean;
  is_recording: boolean;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  grid_position: number | null;
  thumbnail_url: string | null;
  camera_model: string | null;
  resolution: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export const FEED_TYPES = [
  { value: 'embed', label: 'Embed/iframe', description: 'Web-based camera viewer URL' },
  { value: 'hls', label: 'HLS Stream', description: 'HTTP Live Streaming (.m3u8)' },
  { value: 'mjpeg', label: 'MJPEG', description: 'Motion JPEG stream' },
  { value: 'youtube', label: 'YouTube Live', description: 'YouTube live stream URL' },
  { value: 'rtsp', label: 'RTSP', description: 'Real Time Streaming Protocol' },
  { value: 'ip_camera', label: 'IP Camera', description: 'Direct IP camera URL' },
] as const;

export const FEED_STATUSES = [
  { value: 'online', label: 'Online', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  { value: 'offline', label: 'Offline', color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-400' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  { value: 'error', label: 'Error', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
] as const;

export function useVideoFeeds() {
  const { tenant } = useAuth();
  const [feeds, setFeeds] = useState<VideoFeed[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFeeds = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase
      .from('video_feeds')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('grid_position', { ascending: true, nullsFirst: false })
      .order('name');
    if (data) setFeeds(data);
    setLoading(false);
  }, [tenant]);

  const createFeed = useCallback(async (feed: Partial<VideoFeed>) => {
    if (!tenant) return;
    const { data, error } = await supabase
      .from('video_feeds')
      .insert({ ...feed, tenant_id: tenant.id })
      .select()
      .single();
    if (data) await fetchFeeds();
    return { data, error };
  }, [tenant, fetchFeeds]);

  const updateFeed = useCallback(async (id: string, updates: Partial<VideoFeed>) => {
    const { error } = await supabase
      .from('video_feeds')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) await fetchFeeds();
    return { error };
  }, [fetchFeeds]);

  const deleteFeed = useCallback(async (id: string) => {
    await supabase.from('video_feeds').delete().eq('id', id);
    await fetchFeeds();
  }, [fetchFeeds]);

  useEffect(() => { fetchFeeds(); }, [fetchFeeds]);

  const activeFeeds = feeds.filter(f => f.is_active);
  const onlineFeeds = feeds.filter(f => f.status === 'online');

  return {
    feeds,
    activeFeeds,
    onlineFeeds,
    loading,
    fetchFeeds,
    createFeed,
    updateFeed,
    deleteFeed,
  };
}
