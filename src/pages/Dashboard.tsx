import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, AlertTriangle, Bell, MessageSquare, Camera, Users,
  ShieldAlert, TrendingUp, Clock, ChevronRight, Flame, Map, Maximize2, MonitorPlay,
  CalendarCheck, UserCheck, UserX, CheckCircle2, XCircle,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useIncidents, SEVERITY_LEVELS, INCIDENT_STATUSES } from '../hooks/useIncidents';
import { useAlerts, ALERT_TYPES } from '../hooks/useAlerts';
import { usePOI, THREAT_LEVELS } from '../hooks/usePOI';
import { useMap, ZONE_TYPES } from '../hooks/useMap';
import { useVideoFeeds, FEED_STATUSES } from '../hooks/useVideoFeeds';
import { useAttendance, CHECKIN_STATUSES, EVENT_TYPES } from '../hooks/useAttendance';
import { useTeam } from '../hooks/useTeam';
import { format, formatDistanceToNow, isToday } from 'date-fns';

function miniAvatarIcon(initials: string, isMoving: boolean) {
  const bg = '#475569';
  const ring = isMoving ? '#22c55e' : '#3b82f6';
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700;border:2px solid ${ring};box-shadow:0 1px 4px rgba(0,0,0,.3)">${initials}</div>`,
  });
}

function miniZoneIcon(emoji: string, color: string) {
  return L.divIcon({
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:6px;background:${color};display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 1px 3px rgba(0,0,0,.2)">${emoji}</div>`,
  });
}

function homeIcon() {
  return L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    html: `<div style="width:32px;height:32px;border-radius:50%;background:#3b82f6;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(59,130,246,.4);border:3px solid #fff">?</div>`,
  });
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { member, tenant } = useAuth();
  const { primaryColor } = useBranding();
  const { incidents, activeIncidents, criticalIncidents } = useIncidents();
  const { activeAlerts, unacknowledgedAlerts } = useAlerts();
  const { records: poiRecords } = usePOI();
  const activePOI = poiRecords.filter(p => p.status === 'active' || p.status === 'watch');
  const { onlineMembers, zones, movingMembers, fetchTeamLocations } = useMap();
  const { activeFeeds, fetchFeeds } = useVideoFeeds();
  const { events, upcomingEvents, fetchSchedule, fetchCheckins, checkins, schedules } = useAttendance();
  const { activeMembers } = useTeam();

  // Load checkins for today's first event
  const todaysEvents = useMemo(() =>
    events.filter(e => isToday(new Date(e.start_time))),
  [events]);

  const nextEvent = todaysEvents[0] || upcomingEvents[0] || null;

  useEffect(() => {
    if (nextEvent) {
      fetchSchedule(nextEvent.id);
      fetchCheckins(nextEvent.id);
    }
  }, [nextEvent?.id, fetchSchedule, fetchCheckins]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTeamLocations();
      fetchFeeds();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchTeamLocations, fetchFeeds]);

  // ALWAYS center on home location for the campus map
  const homeLocation: [number, number] = tenant?.home_lat && tenant?.home_lng
    ? [tenant.home_lat, tenant.home_lng]
    : [33.9519, -84.5472];
  const homeZoom = tenant?.home_zoom || 18;

  // Attendance stats for current/next event
  const checkedInCount = checkins.filter(c => c.status === 'checked_in' || c.status === 'late').length;
  const totalRostered = schedules.length;
  const sickCount = checkins.filter(c => c.status === 'sick').length;
  const excusedCount = checkins.filter(c => c.status === 'excused').length;
  const noShowCount = checkins.filter(c => c.status === 'no_show').length;
  const notCheckedIn = totalRostered - checkins.length;

  const stats = [
    { label: 'Active Incidents', value: activeIncidents.length, icon: AlertTriangle, color: 'bg-red-500', onClick: () => navigate('/incidents') },
    { label: 'Active Alerts', value: activeAlerts.length, icon: Bell, color: 'bg-amber-500', onClick: () => navigate('/alerts') },
    { label: 'Active POI', value: activePOI.length, icon: ShieldAlert, color: 'bg-purple-500', onClick: () => navigate('/poi') },
    { label: 'Team Online', value: onlineMembers.length, icon: Users, color: 'bg-emerald-500', onClick: () => navigate('/map') },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Welcome header */}
      <div
        className="rounded-2xl p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, #0ea5e9)` }}
      >
        <h2 className="text-2xl font-bold">Welcome back, {member?.display_name?.split(' ')[0]}</h2>
        <p className="text-white/80 mt-1">{tenant?.name} &mdash; {format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      {/* Critical alerts banner */}
      {criticalIncidents.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3 animate-pulse-slow">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Flame className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-red-800">{criticalIncidents.length} Critical Incident{criticalIncidents.length > 1 ? 's' : ''} Active</p>
            <p className="text-sm text-red-600">{criticalIncidents[0].title}</p>
          </div>
          <button onClick={() => navigate('/incidents')} className="text-red-600 hover:text-red-800">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button key={stat.label} onClick={stat.onClick}
              className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow text-left">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
              </div>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </button>
          );
        })}
      </div>

      {/* --- Attendance + Schedule Row --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Status Card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:col-span-1">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-600" />
              Attendance
            </h3>
            <button onClick={() => navigate('/attendance')} className="text-sm text-blue-600 hover:text-blue-700">Manage</button>
          </div>
          {nextEvent ? (
            <div className="p-4 space-y-4">
              {/* Current/Next Event */}
              <div className="flex items-center gap-3">
                <span className="text-2xl">{EVENT_TYPES.find(t => t.value === nextEvent.event_type)?.icon || '??'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{nextEvent.title}</p>
                  <p className="text-xs text-gray-500">
                    {isToday(new Date(nextEvent.start_time))
                      ? `Today at ${format(new Date(nextEvent.start_time), 'h:mm a')}`
                      : format(new Date(nextEvent.start_time), 'EEE, MMM d · h:mm a')}
                    {nextEvent.location && ` · ${nextEvent.location}`}
                  </p>
                </div>
              </div>

              {/* Check-in donut */}
              {totalRostered > 0 && (
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${(checkedInCount / totalRostered) * 88} 88`} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold text-gray-900 leading-none">{checkedInCount}</span>
                      <span className="text-[9px] text-gray-400">/ {totalRostered}</span>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-y-1.5 gap-x-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-gray-600">Checked in: {checkedInCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-300" />
                      <span className="text-xs text-gray-600">Not in: {notCheckedIn}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs text-gray-600">Sick: {sickCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs text-gray-600">Excused: {excusedCount}</span>
                    </div>
                  </div>
                </div>
              )}

              {totalRostered === 0 && (
                <p className="text-xs text-gray-400 italic">No roster set for this event</p>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <CalendarCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No upcoming events</p>
            </div>
          )}
        </div>

        {/* Team Check-in Status */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:col-span-1">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Team Status
            </h3>
            <span className="text-xs text-gray-400">{activeMembers.length} total</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {nextEvent && schedules.length > 0 ? schedules.slice(0, 8).map(sched => {
              const ci = checkins.find(c => c.member_id === sched.member_id);
              const st = ci ? CHECKIN_STATUSES.find(s => s.value === ci.status) : null;
              return (
                <div key={sched.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                      {sched.member_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                      ci?.status === 'checked_in' ? 'bg-green-500' :
                      ci?.status === 'late' ? 'bg-amber-500' :
                      ci?.status === 'sick' ? 'bg-red-500' :
                      ci?.status === 'excused' ? 'bg-blue-500' :
                      ci?.status === 'checked_out' ? 'bg-gray-400' :
                      'bg-gray-200'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{sched.member_name}</p>
                    <p className="text-[10px] text-gray-400">{sched.role_assignment || sched.member_role}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st?.color || 'bg-gray-100 text-gray-500'}`}>
                    {st?.label || 'Pending'}
                  </span>
                </div>
              );
            }) : (
              <div className="p-8 text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No roster data</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Schedule */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden lg:col-span-1">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              Upcoming Schedule
            </h3>
            <button onClick={() => navigate('/attendance')} className="text-sm text-blue-600 hover:text-blue-700">View All</button>
          </div>
          <div className="divide-y divide-gray-50">
            {upcomingEvents.slice(0, 5).map(ev => {
              const et = EVENT_TYPES.find(t => t.value === ev.event_type);
              const today = isToday(new Date(ev.start_time));
              return (
                <div key={ev.id} className="px-4 py-3 hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/attendance')}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{et?.icon || '??'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{ev.title}</p>
                      <p className="text-[11px] text-gray-500">
                        {today
                          ? <span className="text-blue-600 font-semibold">Today</span>
                          : format(new Date(ev.start_time), 'EEE, MMM d')}
                        {' · '}{format(new Date(ev.start_time), 'h:mm a')}
                        {ev.location && ` · ${ev.location}`}
                      </p>
                    </div>
                    {ev.is_recurring && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">Recurring</span>
                    )}
                  </div>
                </div>
              );
            })}
            {upcomingEvents.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No upcoming events scheduled</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Incidents */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Recent Incidents
            </h3>
            <button onClick={() => navigate('/incidents')} className="text-sm text-blue-600 hover:text-blue-700">View All</button>
          </div>
          <div className="divide-y divide-gray-50">
            {incidents.slice(0, 5).map(inc => {
              const sev = SEVERITY_LEVELS.find(s => s.value === inc.severity);
              const st = INCIDENT_STATUSES.find(s => s.value === inc.status);
              return (
                <div key={inc.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/incidents')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sev?.dot}`} />
                      <p className="text-sm font-medium text-gray-900 truncate">{inc.title}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st?.color}`}>{st?.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{inc.incident_number}</span>
                    <span>{inc.location}</span>
                    <span>{format(new Date(inc.occurred_at), 'MMM d, h:mm a')}</span>
                  </div>
                </div>
              );
            })}
            {incidents.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No incidents reported yet</div>
            )}
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" />
              Active Alerts
            </h3>
            <button onClick={() => navigate('/alerts')} className="text-sm text-blue-600 hover:text-blue-700">View All</button>
          </div>
          <div className="divide-y divide-gray-50">
            {activeAlerts.slice(0, 5).map(alert => {
              const at = ALERT_TYPES.find(a => a.value === alert.alert_type);
              return (
                <div key={alert.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/alerts')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{at?.icon}</span>
                      <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                    </div>
                    {!alert.acknowledged_at && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">Unread</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{format(new Date(alert.created_at), 'MMM d, h:mm a')}</p>
                </div>
              );
            })}
            {activeAlerts.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">All clear — no active alerts</div>
            )}
          </div>
        </div>

        {/* Active POI */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-500" />
              Active POI
            </h3>
            <button onClick={() => navigate('/poi')} className="text-sm text-blue-600 hover:text-blue-700">View All</button>
          </div>
          <div className="divide-y divide-gray-50">
            {activePOI.slice(0, 5).map(poi => {
              const tl = THREAT_LEVELS.find(t => t.value === poi.threat_level);
              return (
                <div key={poi.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => navigate('/poi')}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{poi.first_name} {poi.last_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${tl?.color}`}>{tl?.label}</span>
                  </div>
                  {poi.last_seen_location && <p className="text-xs text-gray-500 mt-1">{poi.last_seen_location}</p>}
                </div>
              );
            })}
            {activePOI.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">No active persons of interest</div>
            )}
          </div>
        </div>

        {/* Campus Map — ALWAYS centered on home location */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Map className="w-4 h-4 text-green-600" />
              Campus Map
              <span className="text-xs font-normal text-gray-500 ml-1">{onlineMembers.length} online · {zones.length} zones</span>
            </h3>
            <button onClick={() => navigate('/map')} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <Maximize2 className="w-3.5 h-3.5" /> Full Map
            </button>
          </div>
          <div className="h-72 relative">
            <MapContainer center={homeLocation} zoom={homeZoom} maxZoom={22} className="h-full w-full" zoomControl={false} scrollWheelZoom={false} dragging={true}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={22} maxNativeZoom={19} />
              {/* Home marker */}
              <Marker position={homeLocation} icon={homeIcon()} />
              {/* Zones */}
              {zones.map(zone => {
                if (!zone.center_lat || !zone.center_lng) return null;
                const zt = ZONE_TYPES.find(z => z.value === zone.zone_type);
                return <Marker key={zone.id} position={[Number(zone.center_lat), Number(zone.center_lng)]} icon={miniZoneIcon(zt?.icon || '??', zone.color)} />;
              })}
              {/* Online team members */}
              {onlineMembers.map(loc => {
                const initials = (loc.display_name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                return <Marker key={loc.user_id} position={[Number(loc.latitude), Number(loc.longitude)]} icon={miniAvatarIcon(initials, loc.is_moving)} />;
              })}
            </MapContainer>
            <div onClick={() => navigate('/map')} className="absolute inset-0 z-[500] cursor-pointer" style={{ pointerEvents: 'auto' }} />
          </div>
        </div>
      </div>

      {/* Video Feeds */}
      {activeFeeds.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <MonitorPlay className="w-4 h-4 text-emerald-600" />
              Video Feeds
              <span className="text-xs font-normal text-gray-500 ml-1">{activeFeeds.length} cameras</span>
            </h3>
            <button onClick={() => navigate('/video-feeds')} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <Maximize2 className="w-3.5 h-3.5" /> All Cameras
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-0.5 bg-gray-200">
            {activeFeeds.slice(0, 6).map(feed => {
              const st = FEED_STATUSES.find(s => s.value === feed.status);
              const embedUrl = feed.feed_type === 'youtube'
                ? (() => { try { const u = new URL(feed.feed_url); const v = u.searchParams.get('v'); if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&mute=1&controls=0`; return feed.feed_url; } catch { return feed.feed_url; } })()
                : feed.feed_url;
              return (
                <div key={feed.id} className="relative bg-black aspect-video cursor-pointer" onClick={() => navigate('/video-feeds')}>
                  {(feed.feed_type === 'embed' || feed.feed_type === 'youtube') ? (
                    <iframe src={embedUrl} className="w-full h-full border-0" allow="autoplay; encrypted-media" title={feed.name} loading="lazy" />
                  ) : feed.feed_type === 'mjpeg' ? (
                    <img src={feed.feed_url} alt={feed.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <MonitorPlay className="w-6 h-6" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${st?.dot} ${feed.status === 'online' ? 'animate-pulse' : ''}`} />
                      <span className="text-white text-[10px] font-medium truncate">{feed.name}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Report Incident', icon: AlertTriangle, color: 'bg-red-50 text-red-600 hover:bg-red-100', path: '/incidents' },
            { label: 'Send Alert', icon: Bell, color: 'bg-amber-50 text-amber-600 hover:bg-amber-100', path: '/alerts' },
            { label: 'Team Chat', icon: MessageSquare, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100', path: '/chat' },
            { label: 'Attendance', icon: CalendarCheck, color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100', path: '/attendance' },
            { label: 'Add POI', icon: ShieldAlert, color: 'bg-purple-50 text-purple-600 hover:bg-purple-100', path: '/poi' },
            { label: 'Team', icon: Users, color: 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100', path: '/team' },
          ].map(action => {
            const Icon = action.icon;
            return (
              <button key={action.label} onClick={() => navigate(action.path)}
                className={`${action.color} rounded-xl p-4 flex flex-col items-center gap-2 transition-colors`}>
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
