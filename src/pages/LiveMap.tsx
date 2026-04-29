import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MapPin, Navigation, Users, Radio, Battery, Clock, Plus, Trash2,
  Eye, EyeOff, Layers, DoorOpen, Shield, AlertTriangle, ChevronRight,
  Locate, ZoomIn, ZoomOut, RefreshCw, Circle, ChevronDown, Edit3, Save, X, GripVertical, Move
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle as LeafletCircle, useMapEvents, useMap as useLeafletMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMap, ZONE_TYPES } from '../hooks/useMap';
import { useIncidents, SEVERITY_LEVELS, INCIDENT_TYPES, type Incident } from '../hooks/useIncidents';
import { fetchDirections, formatDistance, formatDuration, extractSteps, type DirectionsRoute, type RouteStep } from '../lib/directions';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import PlacesAutocomplete, { type PlaceResult } from '../components/PlacesAutocomplete';

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function timeSince(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function batteryIcon(level: number | null) {
  if (level === null) return null;
  const color = level > 50 ? 'text-green-500' : level > 20 ? 'text-yellow-500' : 'text-red-500';
  return <span className={`text-xs ${color}`}>{level}%</span>;
}

// Custom avatar marker icon
function createAvatarIcon(initials: string, isMe: boolean, isMoving: boolean) {
  const bg = isMe ? '#2563EB' : '#475569';
  const ring = isMoving ? '#22c55e' : '#3b82f6';
  return L.divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
    html: `
      <div style="position:relative;width:40px;height:40px;">
        ${isMoving ? '<div style="position:absolute;inset:-4px;border-radius:50%;background:rgba(59,130,246,0.3);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>' : ''}
        <div style="width:40px;height:40px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;border:3px solid ${isMe ? '#93c5fd' : 'rgba(255,255,255,0.5)'};box-shadow:0 4px 12px rgba(0,0,0,0.3);">
          ${initials}
        </div>
        <div style="position:absolute;bottom:-1px;right:-1px;width:12px;height:12px;border-radius:50%;background:${ring};border:2px solid #0f172a;"></div>
      </div>
    `,
  });
}

// Custom zone marker icon
function createZoneIcon(emoji: string, color: string) {
  return L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
    html: `
      <div style="width:32px;height:32px;border-radius:8px;background:${color};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.3);">${emoji}</div>
    `,
  });
}

// Custom incident marker icon (pulsing for critical)
function createIncidentIcon(severity: string, isCritical: boolean) {
  const severityColors: Record<string, string> = {
    low: '#10B981',
    medium: '#F59E0B',
    high: '#F97316',
    critical: '#DC2626',
  };
  const color = severityColors[severity] || '#DC2626';
  const pulseHtml = isCritical
    ? `<div style="position:absolute;inset:-4px;border-radius:50%;background:${color};opacity:0.4;animation:sfPulse 1.5s ease-out infinite;"></div>`
    : '';
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
    html: `
      <style>@keyframes sfPulse {0%{transform:scale(1);opacity:0.4;}100%{transform:scale(2.2);opacity:0;}}</style>
      <div style="position:relative;width:36px;height:36px;">
        ${pulseHtml}
        <div style="position:relative;width:36px;height:36px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 14px rgba(220,38,38,0.5);border:3px solid white;color:white;font-weight:900;">⚠</div>
      </div>
    `,
  });
}

// Component to handle map click for adding zones
function MapClickHandler({ addingZone, onMapClick }: { addingZone: boolean; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (addingZone) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Component to fly to a specific location
function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useLeafletMap();
  useEffect(() => {
    map.flyTo([lat, lng], 17, { duration: 1 });
  }, [lat, lng, map]);
  return null;
}

// Component to fit the map to a set of points
function FitBounds({ points, trigger }: { points: { lat: number; lng: number }[]; trigger: number }) {
  const map = useLeafletMap();
  useEffect(() => {
    if (trigger === 0 || points.length === 0) return;
    if (points.length === 1) {
      map.flyTo([points[0].lat, points[0].lng], 17, { duration: 0.8 });
    } else {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      map.flyToBounds(bounds, { padding: [50, 50], duration: 0.8, maxZoom: 18 });
    }
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function LiveMap() {
  const { tenant, member, user } = useAuth();
  const {
    teamLocations, onlineMembers, movingMembers,
    zones, exitZones, overlays, loading,
    isTracking, startTracking, stopTracking,
    fetchTeamLocations, createZone, updateZone, deleteZone,
  } = useMap();

  const {
    mapIncidents,
    respondToIncident,
    cancelResponse,
    updateResponderStatus,
    isResponding,
    respondersFor,
    createIncident,
    updateIncident,
  } = useIncidents();

  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'team' | 'zones' | 'incidents' | 'settings'>('team');
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [showZones, setShowZones] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showOverlays, setShowOverlays] = useState(true);
  const [addingZone, setAddingZone] = useState(false);
  const [addingIncident, setAddingIncident] = useState(false);
  const [newIncident, setNewIncident] = useState({ title: '', incident_type: 'suspicious_activity', severity: 'medium' as Incident['severity'] });

  // Turn-by-turn routing state — one active route per user, tied to the incident they're responding to
  const [activeRoute, setActiveRoute] = useState<{ incidentId: string; route: DirectionsRoute; steps: RouteStep[] } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeProfile, setRouteProfile] = useState<'driving' | 'walking'>('driving');
  const [navPanelOpen, setNavPanelOpen] = useState(false);
  const [newZone, setNewZone] = useState({ name: '', zone_type: 'exit', color: '#EF4444' });
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0); // bump to refit bounds
  const [mapStyle, setMapStyle] = useState<'street' | 'satellite'>('street');
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; zone_type: string; color: string }>({ name: '', zone_type: '', color: '' });
  const [relocatingZone, setRelocatingZone] = useState<string | null>(null);

  // Start tracking on mount
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  // Calculate map center from all locations + zones
  const allPoints = useMemo(() => [
    ...onlineMembers.map(l => ({ lat: Number(l.latitude), lng: Number(l.longitude) })),
    ...zones.filter(z => z.center_lat && z.center_lng).map(z => ({ lat: Number(z.center_lat!), lng: Number(z.center_lng!) })),
  ], [onlineMembers, zones]);

  const defaultCenter: [number, number] = tenant?.home_lat && tenant?.home_lng
    ? [tenant.home_lat, tenant.home_lng]
    : [33.9519, -84.5472];
  const center: [number, number] = allPoints.length > 0
    ? [allPoints.reduce((s, p) => s + p.lat, 0) / allPoints.length, allPoints.reduce((s, p) => s + p.lng, 0) / allPoints.length]
    : defaultCenter;

  const handleIncidentMapClick = useCallback(async (lat: number, lng: number) => {
    if (!addingIncident || !tenant) return;
    await createIncident({
      title: newIncident.title || `${INCIDENT_TYPES.find(t => t.value === newIncident.incident_type)?.label || 'Incident'} on map`,
      incident_type: newIncident.incident_type,
      severity: newIncident.severity,
      status: 'reported',
      priority: newIncident.severity === 'critical' ? 'urgent' : 'normal',
      latitude: lat,
      longitude: lng,
      occurred_at: new Date().toISOString(),
    });
    setAddingIncident(false);
    setNewIncident({ title: '', incident_type: 'suspicious_activity', severity: 'medium' });
    setFlyTarget({ lat, lng });
  }, [addingIncident, tenant, newIncident, createIncident]);

  // My current live GPS (from the team location stream)
  const myLocation = useMemo(() => {
    const me = onlineMembers.find(l => l.user_id === user?.id);
    return me ? { lat: Number(me.latitude), lng: Number(me.longitude) } : null;
  }, [onlineMembers, user]);

  // Fetch / refresh route
  const computeRoute = useCallback(async (incident: Incident, profile: 'driving' | 'walking' = routeProfile) => {
    if (!myLocation || incident.latitude == null || incident.longitude == null) return;
    setRouteLoading(true);
    const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
    const route = await fetchDirections(
      myLocation,
      { lat: Number(incident.latitude), lng: Number(incident.longitude) },
      profile,
      token,
    );
    setRouteLoading(false);
    if (route) {
      setActiveRoute({ incidentId: incident.id, route, steps: extractSteps(route) });
      setNavPanelOpen(true);
    } else {
      alert('Could not compute a route. Check your Mapbox token or try again.');
    }
  }, [myLocation, routeProfile]);

  const clearRoute = useCallback(() => {
    setActiveRoute(null);
    setNavPanelOpen(false);
  }, []);

  // Auto-refresh route every 30s while active so it adapts as the user moves
  useEffect(() => {
    if (!activeRoute || !myLocation) return;
    const incident = mapIncidents.find(i => i.id === activeRoute.incidentId);
    if (!incident) { clearRoute(); return; }
    const interval = setInterval(() => computeRoute(incident, routeProfile), 30000);
    return () => clearInterval(interval);
  }, [activeRoute, myLocation, mapIncidents, computeRoute, routeProfile, clearRoute]);

  // If the user cancels their response, clear the route
  useEffect(() => {
    if (activeRoute && !isResponding(activeRoute.incidentId)) clearRoute();
  }, [activeRoute, isResponding, clearRoute]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!addingZone || !tenant) return;
    await createZone({
      name: newZone.name || `${ZONE_TYPES.find(z => z.value === newZone.zone_type)?.label || 'Zone'} ${zones.length + 1}`,
      zone_type: newZone.zone_type,
      color: newZone.color,
      shape_type: 'marker',
      center_lat: lat,
      center_lng: lng,
    });
    setAddingZone(false);
    setNewZone({ name: '', zone_type: 'exit', color: '#EF4444' });
  }, [addingZone, tenant, newZone, zones.length, createZone]);

  const tileUrl = mapStyle === 'satellite'
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const tileAttribution = mapStyle === 'satellite'
    ? '&copy; Esri'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* ── Map ── */}
      <div className="flex-1 relative">
        {/* Top bar */}
        <div className="absolute top-4 left-4 right-4 z-[1000] flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="bg-white rounded-xl shadow-lg px-4 py-2 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-gray-900">{onlineMembers.length} Online</span>
              </div>
              <div className="w-px h-4 bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-sm text-gray-600">{movingMembers.length} Moving</span>
              </div>
              <div className="w-px h-4 bg-gray-200" />
              <div className="flex items-center gap-1.5">
                <DoorOpen className="w-3.5 h-3.5 text-red-500" />
                <span className="text-sm text-gray-600">{exitZones.length} Exits</span>
              </div>
              {mapIncidents.length > 0 && (
                <>
                  <div className="w-px h-4 bg-gray-200" />
                  <button
                    onClick={() => setSidebarTab('incidents')}
                    className="flex items-center gap-1.5 text-sm text-red-600 font-semibold hover:underline"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                    <span>{mapIncidents.length} Active</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search bar — flies to any location */}
          <div className="flex-1 max-w-md mx-4 pointer-events-auto">
            <PlacesAutocomplete
              placeholder="Search a place to jump to…"
              onSelect={(place: PlaceResult) => {
                setFlyTarget({ lat: place.lat, lng: place.lng });
              }}
            />
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setMapStyle(mapStyle === 'street' ? 'satellite' : 'street')}
              className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
              title={mapStyle === 'street' ? 'Switch to Satellite' : 'Switch to Street'}
            >
              <Eye className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => fetchTeamLocations()}
              className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => setFitTrigger(t => t + 1)}
              className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
              title="Fit all team + zones + incidents in view"
            >
              <Users className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="bg-white rounded-lg shadow-lg p-2 hover:bg-gray-50 transition-colors"
            >
              <Layers className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Tracking status */}
        <div className="absolute bottom-4 left-4 z-[1000]">
          <button
            onClick={isTracking ? stopTracking : startTracking}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-sm font-medium transition-colors ${
              isTracking
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Locate className="w-4 h-4" />
            {isTracking ? 'Tracking Active' : 'Start Tracking'}
          </button>
        </div>

        {/* Add zone overlay instruction */}
        {addingZone && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl px-6 py-4 text-center shadow-lg">
            <p className="font-semibold text-gray-900">Click on the map to place the zone</p>
            <p className="text-sm text-gray-500 mt-1">{newZone.name || ZONE_TYPES.find(z => z.value === newZone.zone_type)?.label}</p>
            <button
              onClick={() => setAddingZone(false)}
              className="mt-2 text-sm text-red-600 hover:text-red-700"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Add incident overlay instruction */}
        {addingIncident && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] bg-red-600 text-white rounded-xl px-6 py-4 text-center shadow-lg">
            <p className="font-semibold flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Click the map to drop the incident
            </p>
            <p className="text-sm opacity-90 mt-1">
              {newIncident.title || INCIDENT_TYPES.find(t => t.value === newIncident.incident_type)?.label} · {SEVERITY_LEVELS.find(s => s.value === newIncident.severity)?.label}
            </p>
            <button
              onClick={() => setAddingIncident(false)}
              className="mt-2 text-sm underline hover:no-underline"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Leaflet Map */}
        <MapContainer
          center={center}
          zoom={16}
          maxZoom={22}
          className="h-full w-full"
          style={{ cursor: (addingZone || addingIncident || relocatingZone) ? 'crosshair' : '' }}
          zoomControl={false}
        >
          <TileLayer url={tileUrl} attribution={tileAttribution} maxZoom={22} maxNativeZoom={mapStyle === 'satellite' ? 18 : 19} />
          <MapClickHandler addingZone={addingZone || addingIncident || !!relocatingZone} onMapClick={(lat, lng) => {
            if (relocatingZone) {
              updateZone(relocatingZone, { center_lat: lat, center_lng: lng });
              setRelocatingZone(null);
            } else if (addingIncident) {
              handleIncidentMapClick(lat, lng);
            } else {
              handleMapClick(lat, lng);
            }
          }} />
          {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} />}
          <FitBounds
            points={[
              ...onlineMembers.map(l => ({ lat: Number(l.latitude), lng: Number(l.longitude) })),
              ...zones.filter(z => z.center_lat && z.center_lng).map(z => ({ lat: Number(z.center_lat!), lng: Number(z.center_lng!) })),
              ...mapIncidents.filter(i => i.latitude != null && i.longitude != null).map(i => ({ lat: Number(i.latitude), lng: Number(i.longitude) })),
            ]}
            trigger={fitTrigger}
          />

          {/* Zone markers — draggable for repositioning */}
          {showZones && zones.map(zone => {
            if (!zone.center_lat || !zone.center_lng) return null;
            const zt = ZONE_TYPES.find(z => z.value === zone.zone_type);
            return (
              <Marker
                key={zone.id}
                position={[Number(zone.center_lat), Number(zone.center_lng)]}
                icon={createZoneIcon(zt?.icon || '📍', zone.color)}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const pos = marker.getLatLng();
                    updateZone(zone.id, { center_lat: pos.lat, center_lng: pos.lng });
                  },
                }}
              >
                <Popup>
                  <div className="text-center min-w-[140px]">
                    <p className="font-semibold">{zone.name}</p>
                    <p className="text-xs text-gray-500 mb-1">{zt?.label || zone.zone_type}</p>
                    <p className="text-[10px] text-gray-400">Drag to relocate</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Incident markers — pulsing red for critical */}
          {showIncidents && mapIncidents.map(inc => {
            if (inc.latitude == null || inc.longitude == null) return null;
            const responding = isResponding(inc.id);
            const resp = respondersFor(inc.id);
            const sev = SEVERITY_LEVELS.find(s => s.value === inc.severity);
            const typeLabel = INCIDENT_TYPES.find(t => t.value === inc.incident_type)?.label || inc.incident_type;
            return (
              <Marker
                key={`inc-${inc.id}`}
                position={[Number(inc.latitude), Number(inc.longitude)]}
                icon={createIncidentIcon(inc.severity, inc.severity === 'critical')}
              >
                <Popup>
                  <div className="min-w-[220px]">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">{inc.title}</p>
                        <p className="text-[11px] text-gray-500">{typeLabel}</p>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sev?.color || 'bg-gray-100 text-gray-800'}`}>
                        {sev?.label || inc.severity}
                      </span>
                    </div>
                    {inc.description && (
                      <p className="text-xs text-gray-600 mb-2 line-clamp-3">{inc.description}</p>
                    )}
                    <div className="text-[11px] text-gray-500 mb-2 space-y-0.5">
                      <div>📍 {inc.location || `${Number(inc.latitude).toFixed(5)}, ${Number(inc.longitude).toFixed(5)}`}</div>
                      <div>🕒 {timeSince(inc.occurred_at)}</div>
                      <div>🧑 {resp.length} responding</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {responding ? (
                        <>
                          <button
                            onClick={() => updateResponderStatus(inc.id, 'onscene')}
                            className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-medium"
                          >
                            On Scene
                          </button>
                          <button
                            onClick={() => cancelResponse(inc.id)}
                            className="px-2 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium"
                            title="Cancel response"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={async () => {
                            await respondToIncident(inc.id);
                            computeRoute(inc, routeProfile);
                          }}
                          className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium flex items-center justify-center gap-1"
                        >
                          <Shield className="w-3 h-3" /> Respond
                        </button>
                      )}
                      {activeRoute?.incidentId === inc.id ? (
                        <button
                          onClick={clearRoute}
                          className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center"
                          title="Clear route"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => computeRoute(inc, routeProfile)}
                          disabled={!myLocation || routeLoading}
                          className="px-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1"
                          title={myLocation ? 'Draw route on map' : 'Enable tracking to compute route'}
                        >
                          <Navigation className="w-3 h-3" /> Route
                        </button>
                      )}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${inc.latitude},${inc.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded text-xs font-medium flex items-center"
                        title="Open in Google Maps"
                      >
                        G
                      </a>
                    </div>
                    {inc.status !== 'resolved' && (
                      <button
                        onClick={() => updateIncident(inc.id, { status: 'resolved', resolved_at: new Date().toISOString() })}
                        className="mt-1.5 w-full text-[10px] text-gray-500 hover:text-green-700"
                      >
                        Mark resolved
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Active route polyline (white halo + blue line) */}
          {activeRoute && (() => {
            const positions = activeRoute.route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
            return (
              <>
                <Polyline positions={positions} pathOptions={{ color: '#ffffff', weight: 10, opacity: 0.7 }} />
                <Polyline positions={positions} pathOptions={{ color: '#1d4ed8', weight: 6, opacity: 0.95 }} />
              </>
            );
          })()}

          {/* Team member markers */}
          {onlineMembers.map(loc => {
            const isMe = loc.user_id === user?.id;
            const initials = getInitials(loc.display_name || 'U');
            return (
              <Marker
                key={loc.user_id}
                position={[Number(loc.latitude), Number(loc.longitude)]}
                icon={createAvatarIcon(initials, isMe, loc.is_moving)}
                eventHandlers={{
                  click: () => setSelectedMember(selectedMember === loc.user_id ? null : loc.user_id),
                }}
              >
                <Popup>
                  <div className="min-w-[180px]">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${isMe ? 'bg-blue-600' : 'bg-slate-600'}`}>
                        {initials}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{loc.display_name}</p>
                        <p className="text-xs text-gray-500">{loc.is_moving ? '🟢 Moving' : '🔵 Stationary'}</p>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Speed</span>
                        <span className="font-medium">{loc.speed ? `${(Number(loc.speed) * 2.237).toFixed(1)} mph` : 'Idle'}</span>
                      </div>
                      {loc.battery_level !== null && (
                        <div className="flex justify-between">
                          <span>Battery</span>
                          <span className={`font-medium ${Number(loc.battery_level) > 50 ? 'text-green-600' : Number(loc.battery_level) > 20 ? 'text-yellow-600' : 'text-red-600'}`}>{loc.battery_level}%</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Updated</span>
                        <span className="font-medium">{timeSince(loc.recorded_at)}</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Accuracy circles for members */}
          {onlineMembers.filter(l => l.accuracy && Number(l.accuracy) < 100).map(loc => (
            <LeafletCircle
              key={`acc-${loc.user_id}`}
              center={[Number(loc.latitude), Number(loc.longitude)]}
              radius={Number(loc.accuracy)}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1 }}
            />
          ))}
        </MapContainer>

        {/* Turn-by-turn navigation panel */}
        {activeRoute && (() => {
          const inc = mapIncidents.find(i => i.id === activeRoute.incidentId);
          const distance = formatDistance(activeRoute.route.distance);
          const duration = formatDuration(activeRoute.route.duration);
          return (
            <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-white rounded-xl shadow-2xl overflow-hidden pointer-events-auto">
              {/* Header with summary */}
              <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
                <div className="flex items-center gap-3">
                  <Navigation className="w-5 h-5" />
                  <div>
                    <p className="font-semibold text-sm">{inc?.title || 'Route'}</p>
                    <p className="text-xs opacity-90">{distance} · {duration} · {activeRoute.steps.length} steps</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-md overflow-hidden text-xs">
                    <button
                      onClick={() => {
                        setRouteProfile('driving');
                        if (inc) computeRoute(inc, 'driving');
                      }}
                      className={`px-2 py-1 ${routeProfile === 'driving' ? 'bg-white text-blue-600' : 'bg-blue-700 text-white'}`}
                    >
                      Drive
                    </button>
                    <button
                      onClick={() => {
                        setRouteProfile('walking');
                        if (inc) computeRoute(inc, 'walking');
                      }}
                      className={`px-2 py-1 ${routeProfile === 'walking' ? 'bg-white text-blue-600' : 'bg-blue-700 text-white'}`}
                    >
                      Walk
                    </button>
                  </div>
                  <button
                    onClick={() => setNavPanelOpen(o => !o)}
                    className="p-1 hover:bg-white/20 rounded"
                    title={navPanelOpen ? 'Collapse' : 'Expand'}
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${navPanelOpen ? '' : 'rotate-180'}`} />
                  </button>
                  <button
                    onClick={clearRoute}
                    className="p-1 hover:bg-white/20 rounded"
                    title="Clear route"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Steps list (collapsible) */}
              {navPanelOpen && (
                <div className="max-h-64 overflow-y-auto">
                  {activeRoute.steps.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-6">No step-by-step instructions</p>
                  ) : (
                    activeRoute.steps.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{s.instruction}</p>
                          <p className="text-xs text-gray-500">
                            {formatDistance(s.distance)}{s.duration > 5 && ` · ${formatDuration(s.duration)}`}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {routeLoading && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
            Calculating route…
          </div>
        )}
      </div>

      {/* ── Sidebar ── */}
      {showSidebar && (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {(['team', 'zones', 'incidents', 'settings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                  sidebarTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'team'
                  ? `Team (${onlineMembers.length})`
                  : tab === 'zones'
                  ? `Zones (${zones.length})`
                  : tab === 'incidents'
                  ? <span className={mapIncidents.length > 0 ? 'text-red-600' : ''}>Incidents ({mapIncidents.length})</span>
                  : 'Settings'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Team tab */}
            {sidebarTab === 'team' && (
              <div className="p-3 space-y-2">
                {onlineMembers.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No members online</p>
                ) : (
                  onlineMembers.map(loc => (
                    <button
                      key={loc.user_id}
                      onClick={() => {
                        setSelectedMember(selectedMember === loc.user_id ? null : loc.user_id);
                        setFlyTarget({ lat: Number(loc.latitude), lng: Number(loc.longitude) });
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                        selectedMember === loc.user_id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                          loc.user_id === user?.id ? 'bg-blue-600' : 'bg-slate-500'
                        }`}>
                          {getInitials(loc.display_name || 'U')}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          loc.is_moving ? 'bg-green-500' : 'bg-blue-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {loc.display_name}{loc.user_id === user?.id && ' (You)'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {loc.is_moving ? 'Moving' : 'Stationary'} · {timeSince(loc.recorded_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        {loc.speed && Number(loc.speed) > 0.5 ? (
                          <p className="text-xs font-medium text-blue-600">{(Number(loc.speed) * 2.237).toFixed(0)} mph</p>
                        ) : null}
                        {batteryIcon(loc.battery_level)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Zones tab */}
            {sidebarTab === 'zones' && (
              <div className="p-3 space-y-3">
                {/* Add zone form */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase">Add Zone</p>
                  <input
                    type="text"
                    value={newZone.name}
                    onChange={e => setNewZone(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Zone name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <select
                    value={newZone.zone_type}
                    onChange={e => {
                      const zt = ZONE_TYPES.find(z => z.value === e.target.value);
                      setNewZone(prev => ({ ...prev, zone_type: e.target.value, color: zt?.color || prev.color }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {ZONE_TYPES.map(zt => (
                      <option key={zt.value} value={zt.value}>{zt.icon} {zt.label}</option>
                    ))}
                  </select>

                  {/* Search a place → drops the zone there directly */}
                  <PlacesAutocomplete
                    placeholder="Search an address to place zone…"
                    onSelect={async (place: PlaceResult) => {
                      if (!tenant) return;
                      const zt = ZONE_TYPES.find(z => z.value === newZone.zone_type);
                      await createZone({
                        name: newZone.name || place.name || `${zt?.label || 'Zone'} ${zones.length + 1}`,
                        zone_type: newZone.zone_type,
                        color: newZone.color,
                        shape_type: 'marker',
                        center_lat: place.lat,
                        center_lng: place.lng,
                      });
                      setFlyTarget({ lat: place.lat, lng: place.lng });
                      setNewZone({ name: '', zone_type: 'exit', color: '#EF4444' });
                    }}
                  />

                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <div className="flex-1 border-t border-gray-200" />
                    <span>or</span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>

                  <button
                    onClick={() => setAddingZone(true)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Click on Map
                  </button>
                </div>

                {/* Zone list */}
                {zones.map(zone => {
                  const zt = ZONE_TYPES.find(z => z.value === zone.zone_type);
                  const isEditing = editingZone === zone.id;
                  const isRelocating = relocatingZone === zone.id;

                  if (isEditing) {
                    return (
                      <div key={zone.id} className="p-3 rounded-xl border-2 border-blue-300 bg-blue-50 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-blue-700 uppercase">Edit Zone</p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={async () => {
                                await updateZone(zone.id, {
                                  name: editForm.name,
                                  zone_type: editForm.zone_type,
                                  color: editForm.color,
                                });
                                setEditingZone(null);
                              }}
                              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700" title="Save"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditingZone(null)} className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300" title="Cancel">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <input
                          type="text" value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Zone name"
                        />
                        <select
                          value={editForm.zone_type}
                          onChange={e => {
                            const z = ZONE_TYPES.find(t => t.value === e.target.value);
                            setEditForm(f => ({ ...f, zone_type: e.target.value, color: z?.color || f.color }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          {ZONE_TYPES.map(z => <option key={z.value} value={z.value}>{z.icon} {z.label}</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                          <input type="color" value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))} className="w-8 h-8 rounded border cursor-pointer" />
                          <span className="text-xs text-gray-500 font-mono">{editForm.color}</span>
                        </div>
                        <button
                          onClick={() => {
                            setRelocatingZone(zone.id);
                            setEditingZone(null);
                          }}
                          className="w-full py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <Move className="w-3.5 h-3.5" /> Click Map to Relocate
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={zone.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        isRelocating ? 'border-orange-300 bg-orange-50' : 'border-gray-100 hover:bg-gray-50'
                      }`}
                      onClick={() => zone.center_lat && zone.center_lng && setFlyTarget({ lat: Number(zone.center_lat), lng: Number(zone.center_lng) })}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: zone.color + '20' }}>
                        {zt?.icon || '📍'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{zone.name}</p>
                        <p className="text-xs text-gray-500">
                          {isRelocating ? <span className="text-orange-600 font-medium">Click map to place...</span> : (zt?.label || zone.zone_type)}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingZone(zone.id);
                            setEditForm({ name: zone.name, zone_type: zone.zone_type, color: zone.color });
                            setRelocatingZone(null);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm('Delete this zone?')) deleteZone(zone.id); }}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {zones.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">No zones configured yet</p>
                )}
              </div>
            )}

            {/* Incidents tab */}
            {sidebarTab === 'incidents' && (
              <div className="p-3 space-y-3">
                {/* Report incident form */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-red-700 uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Report Incident on Map
                  </p>
                  <input
                    type="text"
                    value={newIncident.title}
                    onChange={e => setNewIncident(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Short description"
                    className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newIncident.incident_type}
                      onChange={e => setNewIncident(prev => ({ ...prev, incident_type: e.target.value }))}
                      className="px-2 py-2 border border-red-200 rounded-lg text-xs focus:ring-2 focus:ring-red-500 outline-none"
                    >
                      {INCIDENT_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <select
                      value={newIncident.severity}
                      onChange={e => setNewIncident(prev => ({ ...prev, severity: e.target.value as Incident['severity'] }))}
                      className="px-2 py-2 border border-red-200 rounded-lg text-xs focus:ring-2 focus:ring-red-500 outline-none"
                    >
                      {SEVERITY_LEVELS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Places search — drops incident at address */}
                  <PlacesAutocomplete
                    placeholder="Search address to drop incident…"
                    onSelect={async (place: PlaceResult) => {
                      if (!tenant) return;
                      await createIncident({
                        title: newIncident.title || `${INCIDENT_TYPES.find(t => t.value === newIncident.incident_type)?.label} at ${place.name || 'location'}`,
                        incident_type: newIncident.incident_type,
                        severity: newIncident.severity,
                        status: 'reported',
                        priority: newIncident.severity === 'critical' ? 'urgent' : 'normal',
                        latitude: place.lat,
                        longitude: place.lng,
                        location: place.address,
                        occurred_at: new Date().toISOString(),
                      });
                      setFlyTarget({ lat: place.lat, lng: place.lng });
                      setNewIncident({ title: '', incident_type: 'suspicious_activity', severity: 'medium' });
                    }}
                  />

                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <div className="flex-1 border-t border-gray-200" />
                    <span>or</span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>

                  <button
                    onClick={() => setAddingIncident(true)}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" /> Click on Map
                  </button>

                  <button
                    onClick={async () => {
                      if (!tenant) return;
                      if (!myLocation) {
                        alert('No GPS fix yet — make sure tracking is enabled.');
                        return;
                      }
                      const typeLabel = INCIDENT_TYPES.find(t => t.value === newIncident.incident_type)?.label || 'Incident';
                      await createIncident({
                        title: newIncident.title || `${typeLabel} at my location`,
                        incident_type: newIncident.incident_type,
                        severity: newIncident.severity,
                        status: 'reported',
                        priority: newIncident.severity === 'critical' ? 'urgent' : 'normal',
                        latitude: myLocation.lat,
                        longitude: myLocation.lng,
                        occurred_at: new Date().toISOString(),
                      });
                      setNewIncident({ title: '', incident_type: 'suspicious_activity', severity: 'medium' });
                      setFlyTarget({ lat: myLocation.lat, lng: myLocation.lng });
                    }}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Locate className="w-4 h-4" /> Report at My Location
                  </button>
                </div>

                {/* Active incidents list */}
                {mapIncidents.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No active incidents on map</p>
                ) : (
                  mapIncidents.map(inc => {
                    const sev = SEVERITY_LEVELS.find(s => s.value === inc.severity);
                    const resp = respondersFor(inc.id);
                    const responding = isResponding(inc.id);
                    return (
                      <div
                        key={inc.id}
                        className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5 hover:border-red-300 cursor-pointer"
                        onClick={() => inc.latitude && inc.longitude && setFlyTarget({ lat: Number(inc.latitude), lng: Number(inc.longitude) })}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-gray-900">{inc.title}</p>
                            <p className="text-[11px] text-gray-500">
                              {INCIDENT_TYPES.find(t => t.value === inc.incident_type)?.label} · {timeSince(inc.occurred_at)}
                            </p>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sev?.color}`}>
                            {sev?.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>🧑 {resp.length} responding</span>
                          <span>📍 {Number(inc.latitude).toFixed(4)}, {Number(inc.longitude).toFixed(4)}</span>
                        </div>
                        <div className="flex gap-1.5 pt-1">
                          {!responding ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); respondToIncident(inc.id); }}
                              className="flex-1 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                            >
                              Respond
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); cancelResponse(inc.id); }}
                              className="flex-1 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium"
                            >
                              Cancel Response
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); updateIncident(inc.id, { status: 'resolved', resolved_at: new Date().toISOString() }); }}
                            className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded text-xs font-medium"
                            title="Mark resolved"
                          >
                            ✓
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Settings tab */}
            {sidebarTab === 'settings' && (
              <div className="p-3 space-y-4">
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase">Display</p>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Show zones</span>
                    <button
                      onClick={() => setShowZones(!showZones)}
                      className={`w-10 h-5 rounded-full transition-colors ${showZones ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${showZones ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Satellite view</span>
                    <button
                      onClick={() => setMapStyle(mapStyle === 'street' ? 'satellite' : 'street')}
                      className={`w-10 h-5 rounded-full transition-colors ${mapStyle === 'satellite' ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${mapStyle === 'satellite' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase">Location Tracking</p>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-700">{isTracking ? 'Tracking active' : 'Tracking paused'}</span>
                    </div>
                    <p className="text-xs text-gray-500">Your location is shared with your team while tracking is active. Other members appear on the map when they have the app open.</p>
                    <button
                      onClick={isTracking ? stopTracking : startTracking}
                      className={`mt-2 w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                        isTracking ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {isTracking ? 'Stop Tracking' : 'Start Tracking'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
