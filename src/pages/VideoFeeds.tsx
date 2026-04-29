import { useState, useCallback } from 'react';
import { Camera, Plus, X, Maximize2, Grid3X3, List, Settings, Wifi, WifiOff, Play, MonitorPlay, RefreshCw, Download } from 'lucide-react';
import { useVideoFeeds, FEED_TYPES, FEED_STATUSES, type VideoFeed } from '../hooks/useVideoFeeds';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Convert any YouTube URL to embeddable format
function toYouTubeEmbed(url: string): string {
  try {
    const u = new URL(url);
    // Already an embed URL
    if (u.pathname.startsWith('/embed/')) return url;
    // youtube.com/watch?v=ID
    const vid = u.searchParams.get('v');
    if (vid) return `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1`;
    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1`;
    }
    // youtube.com/live/ID
    const liveMatch = u.pathname.match(/\/live\/([^/?]+)/);
    if (liveMatch) return `https://www.youtube.com/embed/${liveMatch[1]}?autoplay=1&mute=1`;
  } catch { /* not a valid URL */ }
  return url;
}

function getEmbedUrl(feed: VideoFeed): string {
  if (feed.feed_type === 'youtube') return toYouTubeEmbed(feed.feed_url);
  return feed.feed_url;
}

// Demo feeds — public live streams for testing
const DEMO_FEEDS: Partial<VideoFeed>[] = [
  { name: 'Front Entrance', feed_url: 'https://www.youtube.com/embed/ydYDqZQpim8?autoplay=1&mute=1', feed_type: 'youtube', location: 'Main Lobby', status: 'online', is_active: true, grid_position: 1 },
  { name: 'Parking Lot A', feed_url: 'https://www.youtube.com/embed/1EiC9bvVGnk?autoplay=1&mute=1', feed_type: 'youtube', location: 'North Parking', status: 'online', is_active: true, grid_position: 2 },
  { name: 'Sanctuary Interior', feed_url: 'https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1&mute=1', feed_type: 'youtube', location: 'Main Hall', status: 'online', is_active: true, grid_position: 3 },
  { name: "Children's Wing", feed_url: 'https://www.youtube.com/embed/bUJhEo_gPfE?autoplay=1&mute=1', feed_type: 'youtube', location: 'East Building', status: 'online', is_active: true, grid_position: 4 },
  { name: 'Rear Exit', feed_url: 'https://www.youtube.com/embed/YLkEWEmd2QI?autoplay=1&mute=1', feed_type: 'youtube', location: 'Back Door', status: 'online', is_active: true, grid_position: 5 },
  { name: 'Fellowship Hall', feed_url: 'https://www.youtube.com/embed/sFHzqJSg79M?autoplay=1&mute=1', feed_type: 'youtube', location: 'Community Center', status: 'online', is_active: true, grid_position: 6 },
];

export default function VideoFeedsPage() {
  const { member, tenant } = useAuth();
  const { feeds, activeFeeds, loading, createFeed, updateFeed, deleteFeed, fetchFeeds } = useVideoFeeds();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showForm, setShowForm] = useState(false);
  const [editingFeed, setEditingFeed] = useState<VideoFeed | null>(null);
  const [fullscreen, setFullscreen] = useState<VideoFeed | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState<Partial<VideoFeed>>({
    feed_type: 'youtube', status: 'online', is_active: true,
  });

  const isAdmin = member?.role === 'owner' || member?.role === 'admin';

  const handleSave = async () => {
    if (!form.name || !form.feed_url) return;
    if (editingFeed) {
      await updateFeed(editingFeed.id, form);
    } else {
      await createFeed(form);
    }
    setShowForm(false);
    setEditingFeed(null);
    setForm({ feed_type: 'youtube', status: 'online', is_active: true });
  };

  const openEdit = (feed: VideoFeed) => {
    setEditingFeed(feed);
    setForm(feed);
    setShowForm(true);
  };

  const loadDemoFeeds = async () => {
    if (!tenant) return;
    setSeeding(true);
    for (const demo of DEMO_FEEDS) {
      await createFeed(demo);
    }
    setSeeding(false);
  };

  const renderFeedEmbed = (feed: VideoFeed, size: 'normal' | 'fullscreen' = 'normal') => {
    const embedUrl = getEmbedUrl(feed);

    if (feed.feed_type === 'embed' || feed.feed_type === 'youtube') {
      return (
        <div className="relative w-full h-full bg-black">
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            title={feed.name}
            loading="lazy"
          />
        </div>
      );
    }
    if (feed.feed_type === 'mjpeg') {
      return <img src={feed.feed_url} alt={feed.name} className="w-full h-full object-cover bg-black" />;
    }
    if (feed.feed_type === 'hls') {
      return <video src={feed.feed_url} autoPlay muted playsInline className="w-full h-full object-cover bg-black" />;
    }
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <MonitorPlay className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs font-medium">{feed.feed_type.toUpperCase()} Stream</p>
          <p className="text-[10px] mt-1 text-gray-500 break-all px-4 max-w-[200px]">{feed.feed_url}</p>
          <a href={feed.feed_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300">
            <Play className="w-3 h-3" /> Open in player
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Video Feeds</h2>
          <p className="text-sm text-gray-500">{activeFeeds.length} active cameras</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView('grid')} className={`p-1.5 rounded ${view === 'grid' ? 'bg-white shadow-sm' : ''}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setView('list')} className={`p-1.5 rounded ${view === 'list' ? 'bg-white shadow-sm' : ''}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
          {isAdmin && (
            <button onClick={() => { setEditingFeed(null); setForm({ feed_type: 'embed', status: 'online', is_active: true }); setShowForm(true); }}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Camera
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingFeed ? 'Edit Feed' : 'Add Video Feed'}</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={form.name || ''} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" placeholder="Front Entrance Camera" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Feed Type</label>
              <select value={form.feed_type || 'embed'} onChange={(e) => setForm({...form, feed_type: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                {FEED_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Feed URL *</label>
            <input type="url" value={form.feed_url || ''} onChange={(e) => setForm({...form, feed_url: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
              <input type="text" value={form.location || ''} onChange={(e) => setForm({...form, location: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status || 'online'} onChange={(e) => setForm({...form, status: e.target.value as any})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
                {FEED_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{editingFeed ? 'Update' : 'Add Feed'}</button>
            {editingFeed && <button onClick={() => { deleteFeed(editingFeed.id); setShowForm(false); }} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100">Delete</button>}
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Grid view */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeFeeds.map(feed => {
            const st = FEED_STATUSES.find(s => s.value === feed.status);
            return (
              <div key={feed.id} className="bg-black rounded-xl overflow-hidden group relative">
                <div className="aspect-video">{renderFeedEmbed(feed)}</div>
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${st?.dot} ${feed.status === 'online' ? 'animate-pulse' : ''}`} />
                  <span className="text-white text-xs bg-black/60 px-1.5 py-0.5 rounded">{feed.name}</span>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button onClick={() => setFullscreen(feed)} className="p-1 bg-black/60 rounded text-white hover:bg-black/80"><Maximize2 className="w-3 h-3" /></button>
                  {isAdmin && <button onClick={() => openEdit(feed)} className="p-1 bg-black/60 rounded text-white hover:bg-black/80"><Settings className="w-3 h-3" /></button>}
                </div>
                {feed.location && <div className="absolute bottom-2 left-2 text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded">{feed.location}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {activeFeeds.map(feed => {
            const st = FEED_STATUSES.find(s => s.value === feed.status);
            return (
              <div key={feed.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                <div className={`w-3 h-3 rounded-full ${st?.dot}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{feed.name}</p>
                  <p className="text-xs text-gray-500">{feed.location} &mdash; {feed.feed_type.toUpperCase()}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${st?.color}`}>{st?.label}</span>
                <button onClick={() => setFullscreen(feed)} className="p-1.5 hover:bg-gray-200 rounded"><Maximize2 className="w-4 h-4 text-gray-400" /></button>
                {isAdmin && <button onClick={() => openEdit(feed)} className="p-1.5 hover:bg-gray-200 rounded"><Settings className="w-4 h-4 text-gray-400" /></button>}
              </div>
            );
          })}
        </div>
      )}

      {activeFeeds.length === 0 && !showForm && (
        <div className="text-center py-16 text-gray-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
            <Camera className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-lg font-medium text-gray-600">No video feeds configured</p>
          <p className="text-sm text-gray-400 mt-1">Add your security cameras or load demo feeds to get started</p>
          {isAdmin && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={loadDemoFeeds}
                disabled={seeding}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                {seeding ? 'Loading...' : 'Load Demo Feeds (6 cameras)'}
              </button>
              <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                <Plus className="w-4 h-4" /> Add Camera Manually
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen modal */}
      {fullscreen && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col" onClick={() => setFullscreen(null)}>
          <div className="flex items-center justify-between px-4 py-2 bg-black/80 z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-white font-medium">{fullscreen.name}</span>
              {fullscreen.location && <span className="text-gray-400 text-sm">— {fullscreen.location}</span>}
            </div>
            <button onClick={() => setFullscreen(null)} className="text-white p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1" onClick={(e) => e.stopPropagation()}>{renderFeedEmbed(fullscreen, 'fullscreen')}</div>
        </div>
      )}
    </div>
  );
}
