import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Modal,
  Animated,
  Easing,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Mapbox, {
  MapView,
  Camera,
  MarkerView,
  CircleLayer,
  LineLayer,
  ShapeSource,
  UserLocation,
} from '@rnmapbox/maps';
import { useAuth } from '@shadowfield/shared/src/context/AuthContext';
import { supabase } from '@shadowfield/shared/src/lib/supabase';
import { useNotificationPreferences } from '@shadowfield/shared/src/hooks/useNotificationPreferences';
import { shouldFireLocalNotification } from '@shadowfield/shared/src/lib/notificationGating';
import {
  useIncidents,
  SEVERITY_LEVELS,
  INCIDENT_TYPES,
  type Incident,
} from '@shadowfield/shared/src/hooks/useIncidents';
import {
  fetchDirections,
  formatDistance,
  formatDuration,
  extractSteps,
  type DirectionsRoute,
  type RouteStep,
} from '@shadowfield/shared/src/lib/directions';
import { geocodeForward, type GeocodeResult } from '@shadowfield/shared/src/lib/geocoding';
import { distanceMeters } from '@shadowfield/shared/src/lib/geo';
import { useMap, ZONE_TYPES, type TeamLocation, type MapZone } from '../hooks/useMap';
import { useGeofenceAlerts } from '../hooks/useGeofenceAlerts';
import { colors, spacing, radius, shadow, typography } from '../theme';

// Set Mapbox access token
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
console.log('[Map] Mapbox token', MAPBOX_TOKEN ? `${MAPBOX_TOKEN.slice(0, 10)}…(${MAPBOX_TOKEN.length} chars)` : 'MISSING');
Mapbox.setAccessToken(MAPBOX_TOKEN);
// Start native location manager so UserLocation blue dot works
Mapbox.locationManager.start();

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// Pulsing incident pin — single root view (rnmapbox PointAnnotation requires
// max 1 subview). For critical/high severity, the pin throbs via scale.
function IncidentPinMarker({ color, pulse }: { color: string; pulse: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(1);
    };
  }, [pulse, scale]);

  return (
    <Animated.View
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 3,
        borderColor: '#fff',
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        transform: [{ scale }],
      }}
    >
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>⚠</Text>
    </Animated.View>
  );
}

// Zone pin marker — wraps View+Text so PointAnnotation has a single component
// child (required by rnmapbox/maps under New Architecture).
function ZonePinMarker({ color, icon }: { color: string; icon: string }) {
  return (
    <View style={[styles.zonePin, { backgroundColor: color }]}>
      <Text style={styles.zoneEmoji}>{icon}</Text>
    </View>
  );
}

// Member pin marker — same single-component-child requirement.
function MemberPinMarker({
  initials,
  isMe,
  isMoving,
}: {
  initials: string;
  isMe: boolean;
  isMoving: boolean;
}) {
  return (
    <View
      style={[
        styles.memberPin,
        {
          backgroundColor: isMe ? colors.primary : colors.text,
          borderColor: isMoving ? colors.success : colors.surface,
        },
      ]}
    >
      <Text style={styles.memberInitials}>{initials}</Text>
    </View>
  );
}

function timeSince(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export default function MapScreen({ route, navigation }: any) {
  const { tenant, user } = useAuth();
  const { prefs: notificationPrefs } = useNotificationPreferences();
  // If we were deep-linked here from a push-notification tap, this param
  // holds the incident id we should fly to and select.
  const focusIncidentId: string | undefined = route?.params?.focusIncidentId;
  // Bumped on every push tap by App.tsx so we can detect repeat taps
  // and same-screen navigations even when the incident id is unchanged.
  const focusNonce: number | undefined = route?.params?.focusNonce;
  const {
    onlineMembers,
    movingMembers,
    zones,
    loading,
    isTracking,
    startTracking,
    stopTracking,
    reportLocation,
    fetchTeamLocations,
    createZone,
    updateZone,
    deleteZone,
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

  const cameraRef = useRef<Camera>(null);
  const [selectedMember, setSelectedMember] = useState<TeamLocation | null>(null);
  const [selectedZone, setSelectedZone] = useState<MapZone | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [zoneListOpen, setZoneListOpen] = useState(false);
  const [incidentListOpen, setIncidentListOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [newIncident, setNewIncident] = useState({
    title: '',
    incident_type: 'suspicious_activity',
    severity: 'medium' as Incident['severity'],
  });

  // When true, the next map tap drops an incident at that location
  const [pickingIncidentLocation, setPickingIncidentLocation] = useState(false);

  // Address-search-to-drop-incident state
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [geocoding, setGeocoding] = useState(false);

  // Zone CRUD state
  const [pickingZoneLocation, setPickingZoneLocation] = useState(false);
  const [newZone, setNewZone] = useState({ name: '', zone_type: 'exit' });
  const [editingZone, setEditingZone] = useState<MapZone | null>(null);
  const [editZoneForm, setEditZoneForm] = useState({ name: '', zone_type: 'exit' });

  // Turn-by-turn routing state
  const [activeRoute, setActiveRoute] = useState<{ incidentId: string; route: DirectionsRoute; steps: RouteStep[] } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeProfile, setRouteProfile] = useState<'driving' | 'walking'>('driving');
  const [navPanelExpanded, setNavPanelExpanded] = useState(true);

  // Center camera on tenant home
  const centerLng = tenant?.home_lng ?? -84.549333;
  const centerLat = tenant?.home_lat ?? 33.952778;
  const zoom = tenant?.home_zoom ?? 17;

  // My current GPS reading from the team_locations stream — drives geofencing
  const myLocation = useMemo(() => {
    const me = onlineMembers.find((l) => l.user_id === user?.id);
    return me ? { lat: Number(me.latitude), lng: Number(me.longitude) } : null;
  }, [onlineMembers, user?.id]);

  // Foreground zone enter/exit + off-campus perimeter alerts (local notifications)
  useGeofenceAlerts(myLocation, zones);

  // Auto-start tracking when screen loads
  useEffect(() => {
    if (!user) return;
    startTracking();
    return () => stopTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const exitCount = zones.filter((z) => z.zone_type === 'exit').length;
  const zonesWithCoords = zones.filter((z) => z.center_lat && z.center_lng).length;
  const zonesMissingCoords = zones.length - zonesWithCoords;

  useEffect(() => {
    if (zones.length > 0) {
      console.log(`[Map] ${zones.length} zones loaded, ${zonesWithCoords} with coords, ${zonesMissingCoords} missing coords`);
      zones.forEach((z) => console.log(`[Zone] ${z.name} (${z.zone_type}) lat=${z.center_lat} lng=${z.center_lng}`));
    }
  }, [zones, zonesWithCoords, zonesMissingCoords]);

  const handleRecenter = () => {
    cameraRef.current?.setCamera({
      centerCoordinate: [centerLng, centerLat],
      zoomLevel: zoom,
      animationDuration: 600,
    });
  };

  const handleLocateMe = async () => {
    // Prefer native Mapbox location manager (matches the blue dot); fall back to team marker
    try {
      const loc = await Mapbox.locationManager.getLastKnownLocation();
      if (loc?.coords) {
        cameraRef.current?.setCamera({
          centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
          zoomLevel: 18,
          animationDuration: 700,
        });
        return;
      }
    } catch {}
    const me = onlineMembers.find((m) => m.user_id === user?.id);
    if (me) {
      cameraRef.current?.setCamera({
        centerCoordinate: [me.longitude, me.latitude],
        zoomLevel: 18,
        animationDuration: 700,
      });
    } else {
      Alert.alert('Locating…', 'Waiting for your first GPS update. Make sure tracking is on.');
    }
  };

  // Fit camera to show every online team member at once. The "people" button
  // is meant to answer "where is my team right now" — so we deliberately skip
  // zones and incidents (which can be far from the team and yank the camera
  // off-screen). If nobody is online, fall back to the user's own GPS so the
  // button doesn't appear to do nothing.
  const handleFitAll = () => {
    const points: [number, number][] = [];
    onlineMembers.forEach((m) => {
      if (m.latitude != null && m.longitude != null) {
        points.push([Number(m.longitude), Number(m.latitude)]);
      }
    });
    if (points.length === 0) {
      // Nobody online — fall back to last-known GPS for self
      handleLocateMe();
      return;
    }
    if (points.length === 1) {
      cameraRef.current?.setCamera({ centerCoordinate: points[0], zoomLevel: 17, animationDuration: 600 });
      return;
    }
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    cameraRef.current?.setCamera({
      bounds: {
        ne: [Math.max(...lngs), Math.max(...lats)],
        sw: [Math.min(...lngs), Math.min(...lats)],
        paddingLeft: 60,
        paddingRight: 60,
        paddingTop: 120,
        paddingBottom: 200,
      },
      animationDuration: 800,
    });
  };

  const flyToZone = (zone: MapZone) => {
    if (!zone.center_lat || !zone.center_lng) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [zone.center_lng, zone.center_lat],
      zoomLevel: 18,
      animationDuration: 800,
    });
    setZoneListOpen(false);
    setSelectedZone(zone);
  };

  const flyToIncident = (inc: Incident) => {
    if (inc.latitude == null || inc.longitude == null) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [Number(inc.longitude), Number(inc.latitude)],
      zoomLevel: 18,
      animationDuration: 800,
    });
    setIncidentListOpen(false);
    setSelectedIncident(inc);
  };

  const handleNavigateToIncident = (inc: Incident) => {
    if (inc.latitude == null || inc.longitude == null) return;
    const label = encodeURIComponent(inc.title);
    const url = Platform.select({
      ios: `maps://?daddr=${inc.latitude},${inc.longitude}&q=${label}`,
      android: `google.navigation:q=${inc.latitude},${inc.longitude}&mode=w`,
    });
    if (url) Linking.openURL(url).catch(() => Alert.alert('Navigation failed'));
  };

  // Start in-app routing — fetches Mapbox Directions and draws polyline on map
  const computeRoute = async (inc: Incident, profile: 'driving' | 'walking' = routeProfile) => {
    console.log('[Route] computeRoute start', { incident: inc.id, profile });
    if (inc.latitude == null || inc.longitude == null) {
      console.warn('[Route] incident has no lat/lng');
      return;
    }
    setRouteLoading(true);
    try {
      // Get my live GPS (try Mapbox → expo-location fallback)
      let myLat: number | null = null;
      let myLng: number | null = null;
      try {
        const loc = await Mapbox.locationManager.getLastKnownLocation();
        myLat = loc?.coords?.latitude ?? null;
        myLng = loc?.coords?.longitude ?? null;
        console.log('[Route] mapbox last known', myLat, myLng);
      } catch (e) {
        console.warn('[Route] mapbox getLastKnownLocation failed', e);
      }
      if (myLat == null || myLng == null) {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          myLat = pos.coords.latitude;
          myLng = pos.coords.longitude;
          console.log('[Route] expo location', myLat, myLng);
        } catch (e) {
          console.warn('[Route] expo getCurrentPositionAsync failed', e);
        }
      }
      if (myLat == null || myLng == null) {
        Alert.alert('No GPS fix', 'Turn on tracking to compute a route.');
        return;
      }

      console.log('[Route] fetching directions', { from: [myLat, myLng], to: [inc.latitude, inc.longitude] });
      const route = await fetchDirections(
        { lat: myLat, lng: myLng },
        { lat: Number(inc.latitude), lng: Number(inc.longitude) },
        profile,
        MAPBOX_TOKEN, // pass explicit token — do NOT rely on process.env lookup
      );
      if (!route) {
        console.warn('[Route] fetchDirections returned null');
        Alert.alert('Route failed', 'Could not compute a route. Check the debugger for [directions] logs.');
        return;
      }
      console.log('[Route] got route', { distance: route.distance, duration: route.duration });
      setActiveRoute({ incidentId: inc.id, route, steps: extractSteps(route) });
      setNavPanelExpanded(true);
      setSelectedIncident(null); // close popup to show the route
      // Fit camera to route bounds
      const coords = route.geometry.coordinates;
      if (coords.length > 1) {
        const lngs = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        cameraRef.current?.setCamera({
          bounds: {
            ne: [maxLng, maxLat],
            sw: [minLng, minLat],
            paddingLeft: 40,
            paddingRight: 40,
            paddingTop: 80,
            paddingBottom: 280,
          },
          animationDuration: 800,
        });
      }
    } catch (err: any) {
      console.error('[Route] unexpected error', err?.message || err);
      Alert.alert('Route failed', err?.message || 'Unknown error');
    } finally {
      setRouteLoading(false);
      console.log('[Route] computeRoute done');
    }
  };

  const clearRoute = () => {
    setActiveRoute(null);
  };

  // Auto-refresh route every 30s so it adapts as user moves
  useEffect(() => {
    if (!activeRoute) return;
    const inc = mapIncidents.find((i) => i.id === activeRoute.incidentId);
    if (!inc) { clearRoute(); return; }
    const id = setInterval(() => computeRoute(inc, routeProfile), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoute?.incidentId, routeProfile]);

  // Clear route if user cancels their response.
  //
  // IMPORTANT: when the user first taps "Respond", `setActiveRoute` may fire
  // *before* `incident_responders` round-trips from the DB (realtime or
  // fetchResponders). During that window `isResponding()` is still false,
  // which used to cause this effect to immediately clear the polyline the
  // user just asked for. We now require the route to have existed for a
  // couple of seconds before we trust an `isResponding=false` reading.
  const routeSetAtRef = useRef<number>(0);
  useEffect(() => {
    routeSetAtRef.current = activeRoute ? Date.now() : 0;
  }, [activeRoute?.incidentId]);
  useEffect(() => {
    if (!activeRoute) return;
    const age = Date.now() - routeSetAtRef.current;
    if (age < 2000) return; // grace period for responders upsert to settle
    if (!isResponding(activeRoute.incidentId)) clearRoute();
  }, [activeRoute, isResponding]);

  // ──────────────────────────────────────────────────────────────────────────
  // Push-notification deep-link
  // When the user taps a push that contains an incident_id, App.tsx navigates
  // to LiveMap with `focusIncidentId`. Fly the camera there and pop the popup.
  // ──────────────────────────────────────────────────────────────────────────
  // Track the last nonce we processed so repeat taps for the SAME incident
  // still re-trigger the camera fly (focusIncidentId alone wouldn't change).
  const lastFocusNonceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!focusIncidentId) return;
    // If the nonce is unchanged, this is a re-render not a fresh tap.
    if (focusNonce != null && lastFocusNonceRef.current === focusNonce) return;

    let cancelled = false;
    const flyTo = (inc: Incident) => {
      if (cancelled) return;
      if (inc.latitude == null || inc.longitude == null) return;
      console.log('[Map] focusing incident from push', inc.id);
      cameraRef.current?.setCamera({
        centerCoordinate: [Number(inc.longitude), Number(inc.latitude)],
        zoomLevel: 18,
        animationDuration: 700,
      });
      setSelectedIncident(inc);
      lastFocusNonceRef.current = focusNonce ?? Date.now();
      // Clear the params after handling so the back stack doesn't keep
      // re-applying them on subsequent screen visits.
      navigation?.setParams?.({ focusIncidentId: undefined, focusNonce: undefined });
    };

    const local = mapIncidents.find((i) => i.id === focusIncidentId);
    if (local) {
      flyTo(local);
      return;
    }

    // Not in the live list yet (realtime lag) — fetch it directly so the
    // user doesn't see "nothing happens" after tapping the notification.
    console.log('[Map] incident not in local list, fetching', focusIncidentId);
    supabase
      .from('incidents')
      .select('*')
      .eq('id', focusIncidentId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.warn('[Map] focus fetch error', error.message);
          return;
        }
        if (data) flyTo(data as Incident);
      });

    return () => {
      cancelled = true;
    };
  }, [focusIncidentId, focusNonce, mapIncidents, navigation]);

  // ──────────────────────────────────────────────────────────────────────────
  // Auto-arrival detection
  // For every active incident I'm currently responding to (status `enroute`),
  // poll my GPS every 10s; when I'm within 30m of the incident, auto-flip my
  // responder status to `onscene` and fire a local notification.
  // ──────────────────────────────────────────────────────────────────────────
  const arrivalNotifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const enrouteIncidents = mapIncidents.filter((i) => {
      if (i.latitude == null || i.longitude == null) return false;
      const me = (respondersFor(i.id) || []).find((r) => r.user_id === user?.id);
      return me?.status === 'enroute';
    });
    if (enrouteIncidents.length === 0) return;

    const interval = setInterval(async () => {
      try {
        const loc = await Mapbox.locationManager.getLastKnownLocation();
        const myLat = loc?.coords?.latitude;
        const myLng = loc?.coords?.longitude;
        if (myLat == null || myLng == null) return;
        for (const inc of enrouteIncidents) {
          if (arrivalNotifiedRef.current.has(inc.id)) continue;
          const meters = distanceMeters(
            { lat: myLat, lng: myLng },
            { lat: Number(inc.latitude), lng: Number(inc.longitude) },
          );
          if (meters <= 30) {
            console.log('[Arrival] within 30m of', inc.id, '— flipping to onscene');
            arrivalNotifiedRef.current.add(inc.id);
            await updateResponderStatus(inc.id, 'onscene');
            // Honor the user's `notify_arrived_at_incident` toggle and quiet
            // hours — the auto status update still happens above either way.
            if (shouldFireLocalNotification(notificationPrefs, 'arrived_at_incident')) {
              try {
                const Notifications = await import('expo-notifications');
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: 'On scene',
                    body: `You arrived at "${inc.title}".`,
                    data: { incident_id: inc.id, type: 'arrival' },
                    sound: 'default',
                  },
                  trigger: null,
                });
              } catch (e) {
                console.warn('[Arrival] local notification failed', e);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Arrival] check failed', err);
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [mapIncidents, respondersFor, user?.id, updateResponderStatus, notificationPrefs]);

  // Clear arrival memo when responder is no longer enroute (e.g. cancelled or resolved)
  useEffect(() => {
    arrivalNotifiedRef.current.forEach((id) => {
      const inc = mapIncidents.find((i) => i.id === id);
      const me = inc ? (respondersFor(id) || []).find((r) => r.user_id === user?.id) : null;
      if (!me || me.status !== 'onscene') {
        // status went back to enroute or was cleared; allow re-arrival detection
        if (!me || me.status !== 'onscene') arrivalNotifiedRef.current.delete(id);
      }
    });
  }, [mapIncidents, respondersFor, user?.id]);

  // Build GeoJSON FeatureCollection from active route — memoized so ShapeSource only
  // updates when the route actually changes, otherwise Mapbox re-diffs every render.
  const routeShape = useMemo(() => {
    if (!activeRoute) return null;
    const geom = activeRoute.route.geometry;
    console.log('[Route] building shape', {
      type: geom?.type,
      coordCount: geom?.coordinates?.length,
      firstCoord: geom?.coordinates?.[0],
      lastCoord: geom?.coordinates?.[geom.coordinates.length - 1],
    });
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: geom,
          properties: { id: activeRoute.incidentId },
        },
      ],
    };
  }, [activeRoute]);

  // When in "pick on map" mode, a map tap drops an incident OR a zone
  const handleMapPress = async (e: any) => {
    const coords = e?.geometry?.coordinates as [number, number] | undefined;
    if (!coords) return;
    const [lng, lat] = coords;

    // Zone picking takes priority if both modes were ever set
    if (pickingZoneLocation && tenant) {
      console.log('[Map] tap to drop zone', { lat, lng });
      const zt = ZONE_TYPES.find((t) => t.value === newZone.zone_type) || ZONE_TYPES[0];
      const res = await createZone({
        name: newZone.name || `${zt.label} ${zones.length + 1}`,
        zone_type: newZone.zone_type,
        color: zt.color,
        shape_type: 'marker',
        center_lat: lat,
        center_lng: lng,
      });
      if (res?.error) {
        Alert.alert('Failed', (res.error as any)?.message || 'Could not create zone');
        return;
      }
      setPickingZoneLocation(false);
      setNewZone({ name: '', zone_type: 'exit' });
      cameraRef.current?.setCamera({ centerCoordinate: [lng, lat], zoomLevel: 18, animationDuration: 500 });
      return;
    }

    if (!pickingIncidentLocation || !tenant) return;
    console.log('[Map] tap to drop incident', { lat, lng });
    const res = await createIncident({
      tenant_id: tenant.id,
      title: newIncident.title || `${INCIDENT_TYPES.find((t) => t.value === newIncident.incident_type)?.label || 'Incident'}`,
      incident_type: newIncident.incident_type,
      severity: newIncident.severity,
      status: 'reported',
      priority: newIncident.severity === 'critical' ? 'urgent' : 'normal',
      latitude: lat,
      longitude: lng,
      occurred_at: new Date().toISOString(),
    });
    if (res?.error) {
      console.warn('[Map] createIncident error', res.error);
      Alert.alert('Failed', res.error.message || 'Could not create incident');
      return;
    }
    setPickingIncidentLocation(false);
    setNewIncident({ title: '', incident_type: 'suspicious_activity', severity: 'medium' });
    cameraRef.current?.setCamera({ centerCoordinate: [lng, lat], zoomLevel: 17, animationDuration: 500 });
  };

  // Search addresses via Mapbox Geocoding (debounced by user typing)
  const runAddressSearch = async (query: string) => {
    setAddressQuery(query);
    if (query.trim().length < 3) {
      setAddressResults([]);
      return;
    }
    setGeocoding(true);
    const results = await geocodeForward(query, MAPBOX_TOKEN, {
      limit: 5,
      proximity: { lat: centerLat, lng: centerLng },
    });
    setAddressResults(results);
    setGeocoding(false);
  };

  // Drop an incident at the chosen geocoded place
  const handleDropAtGeocoded = async (place: GeocodeResult) => {
    if (!tenant) return;
    const typeLabel = INCIDENT_TYPES.find((t) => t.value === newIncident.incident_type)?.label || 'Incident';
    const res = await createIncident({
      tenant_id: tenant.id,
      title: newIncident.title || `${typeLabel} at ${place.shortName}`,
      incident_type: newIncident.incident_type,
      severity: newIncident.severity,
      status: 'reported',
      priority: newIncident.severity === 'critical' ? 'urgent' : 'normal',
      latitude: place.lat,
      longitude: place.lng,
      location: place.placeName,
      occurred_at: new Date().toISOString(),
    });
    if (res?.error) {
      Alert.alert('Failed', res.error.message || 'Could not create incident');
      return;
    }
    setReportModalOpen(false);
    setAddressQuery('');
    setAddressResults([]);
    setNewIncident({ title: '', incident_type: 'suspicious_activity', severity: 'medium' });
    cameraRef.current?.setCamera({ centerCoordinate: [place.lng, place.lat], zoomLevel: 17, animationDuration: 600 });
  };

  const handleReportAtCurrent = async () => {
    if (!tenant) return;
    try {
      const loc = await Mapbox.locationManager.getLastKnownLocation();
      let lat = loc?.coords?.latitude;
      let lng = loc?.coords?.longitude;
      if (lat == null || lng == null) {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
      if (lat == null || lng == null) {
        Alert.alert('No GPS fix', 'Could not get your current location. Make sure tracking is on.');
        return;
      }
      const typeLabel = INCIDENT_TYPES.find((t) => t.value === newIncident.incident_type)?.label || 'Incident';
      await createIncident({
        title: newIncident.title || `${typeLabel} at my location`,
        incident_type: newIncident.incident_type,
        severity: newIncident.severity,
        status: 'reported',
        priority: newIncident.severity === 'critical' ? 'urgent' : 'normal',
        latitude: lat,
        longitude: lng,
        occurred_at: new Date().toISOString(),
      });
      cameraRef.current?.setCamera({ centerCoordinate: [lng, lat], zoomLevel: 18, animationDuration: 600 });
      setReportModalOpen(false);
      setNewIncident({ title: '', incident_type: 'suspicious_activity', severity: 'medium' });
    } catch (e: any) {
      Alert.alert('Report failed', e?.message || 'Unknown error');
    }
  };

  const handleNavigateToZone = (zone: MapZone) => {
    if (!zone.center_lat || !zone.center_lng) return;
    const label = encodeURIComponent(zone.name);
    const url = Platform.select({
      ios: `maps://?daddr=${zone.center_lat},${zone.center_lng}&q=${label}`,
      android: `google.navigation:q=${zone.center_lat},${zone.center_lng}&mode=w`,
    });
    if (url) Linking.openURL(url).catch(() => Alert.alert('Navigation failed'));
  };

  const handleNavigateToMember = (m: TeamLocation) => {
    const label = encodeURIComponent(m.display_name);
    const url = Platform.select({
      ios: `maps://?daddr=${m.latitude},${m.longitude}&q=${label}`,
      android: `google.navigation:q=${m.latitude},${m.longitude}`,
    });
    if (url) Linking.openURL(url).catch(() => Alert.alert('Navigation failed'));
  };

  if (!MAPBOX_TOKEN) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="warning" size={48} color={colors.error} />
          <Text style={styles.errorText}>Mapbox token missing</Text>
          <Text style={styles.errorHint}>Add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to .env</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        onPress={handleMapPress}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [centerLng, centerLat],
            zoomLevel: zoom,
          }}
        />

        {/* Native Mapbox pulsing blue dot — real-time OS GPS */}
        <UserLocation
          visible={true}
          showsUserHeadingIndicator
          androidRenderMode="normal"
          animated
          minDisplacement={1}
        />

        {/* Zones (circles + point markers) */}
        {zones.map((zone) => {
          if (!zone.center_lat || !zone.center_lng) return null;
          const zoneType = ZONE_TYPES.find((zt) => zt.value === zone.zone_type) || ZONE_TYPES[9];

          // Circle zone (geofence radius)
          if (zone.shape_type === 'circle' && zone.radius_meters) {
            const geojson = {
              type: 'FeatureCollection' as const,
              features: [
                {
                  type: 'Feature' as const,
                  geometry: {
                    type: 'Point' as const,
                    coordinates: [zone.center_lng, zone.center_lat],
                  },
                  properties: { radius: zone.radius_meters, color: zoneType.color },
                },
              ],
            };
            return (
              <ShapeSource key={`z-${zone.id}`} id={`z-${zone.id}`} shape={geojson}>
                <CircleLayer
                  id={`zc-${zone.id}`}
                  style={{
                    circleRadius: zone.radius_meters / 2,
                    circleColor: zoneType.color,
                    circleOpacity: 0.2,
                    circleStrokeColor: zoneType.color,
                    circleStrokeWidth: 2,
                  }}
                />
              </ShapeSource>
            );
          }

          // Point zone (pin)
          return (
            <MarkerView
              key={`p-${zone.id}`}
              coordinate={[zone.center_lng, zone.center_lat]}
              anchor={{ x: 0.5, y: 0.5 }}
              allowOverlap
            >
              <Pressable onPress={() => setSelectedZone(zone)} hitSlop={8}>
                <ZonePinMarker color={zoneType.color} icon={zoneType.icon} />
              </Pressable>
            </MarkerView>
          );
        })}

        {/* Active route polyline — halo underneath + blue line on top */}
        {routeShape && activeRoute && (
          <ShapeSource
            id={`route-src-${activeRoute.incidentId}`}
            shape={routeShape as any}
          >
            <LineLayer
              id={`route-halo-${activeRoute.incidentId}`}
              style={{
                lineColor: '#ffffff',
                lineWidth: 12,
                lineOpacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <LineLayer
              id={`route-line-${activeRoute.incidentId}`}
              style={{
                lineColor: '#1d4ed8',
                lineWidth: 7,
                lineOpacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}

        {/* Incident pins */}
        {mapIncidents.map((inc) => {
          if (inc.latitude == null || inc.longitude == null) return null;
          const sevColor =
            inc.severity === 'critical' ? '#DC2626' :
            inc.severity === 'high' ? '#F97316' :
            inc.severity === 'medium' ? '#F59E0B' : '#10B981';
          const pulse = inc.severity === 'critical' || inc.severity === 'high';
          return (
            <MarkerView
              key={`inc-${inc.id}-${pulse ? 'p' : 'n'}`}
              coordinate={[Number(inc.longitude), Number(inc.latitude)]}
              anchor={{ x: 0.5, y: 0.5 }}
              allowOverlap
            >
              <Pressable onPress={() => setSelectedIncident(inc)} hitSlop={8}>
                <IncidentPinMarker color={sevColor} pulse={pulse} />
              </Pressable>
            </MarkerView>
          );
        })}

        {/* Team member markers */}
        {onlineMembers.map((m) => {
          const isMe = m.user_id === user?.id;
          return (
            <MarkerView
              key={`m-${m.user_id}`}
              coordinate={[m.longitude, m.latitude]}
              anchor={{ x: 0.5, y: 0.5 }}
              allowOverlap
            >
              <Pressable onPress={() => setSelectedMember(m)} hitSlop={8}>
                <MemberPinMarker
                  initials={getInitials(m.display_name)}
                  isMe={isMe}
                  isMoving={m.is_moving}
                />
              </Pressable>
            </MarkerView>
          );
        })}
      </MapView>

      {/* Top stats bar */}
      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (navigation?.canGoBack?.()) {
                navigation.goBack();
              } else if (navigation?.openDrawer) {
                navigation.openDrawer();
              } else {
                navigation?.navigate?.('MainTabs');
              }
            }}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.statPill}>
            <View style={styles.onlineDot} />
            <Text style={styles.statText}>{onlineMembers.length} Online</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="walk" size={14} color={colors.info} />
            <Text style={styles.statText}>{movingMembers.length} Moving</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="exit" size={14} color={colors.error} />
            <Text style={styles.statText}>{exitCount} Exits</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Right-side controls */}
      <View style={styles.controlsColumn} pointerEvents="box-none">
        <TouchableOpacity style={styles.ctrlBtn} onPress={handleLocateMe}>
          <Ionicons name="locate" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrlBtn} onPress={handleRecenter}>
          <Ionicons name="home" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrlBtn} onPress={fetchTeamLocations}>
          <Ionicons name="refresh" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrlBtn} onPress={handleFitAll}>
          <Ionicons name="people" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrlBtn} onPress={() => setZoneListOpen(true)}>
          <Ionicons name="list" size={20} color={colors.text} />
          {zones.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{zones.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrlBtn} onPress={() => setIncidentListOpen(true)}>
          <Ionicons
            name="warning"
            size={20}
            color={mapIncidents.length > 0 ? '#DC2626' : colors.text}
          />
          {mapIncidents.length > 0 && (
            <View style={[styles.badge, { backgroundColor: '#DC2626' }]}>
              <Text style={styles.badgeText}>{mapIncidents.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctrlBtnReport}
          onPress={() => setReportModalOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="alert" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctrlBtn, isTracking && styles.ctrlBtnActive]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Ionicons
            name={isTracking ? 'radio' : 'radio-outline'}
            size={20}
            color={isTracking ? colors.surface : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Tracking status pill */}
      {isTracking && (
        <View style={styles.trackingPill}>
          <View style={styles.trackingDot} />
          <Text style={styles.trackingText}>Tracking Active</Text>
        </View>
      )}

      {/* Selected member popup */}
      {selectedMember && (
        <View style={styles.popup}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>{selectedMember.display_name}</Text>
            <TouchableOpacity onPress={() => setSelectedMember(null)}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.popupRow}>
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.popupMeta}>{timeSince(selectedMember.recorded_at)}</Text>
            {selectedMember.battery_level != null && (
              <>
                <Ionicons name="battery-half" size={14} color={colors.textSecondary} style={{ marginLeft: spacing.md }} />
                <Text style={styles.popupMeta}>{selectedMember.battery_level}%</Text>
              </>
            )}
          </View>
          <TouchableOpacity style={styles.popupAction} onPress={() => handleNavigateToMember(selectedMember)}>
            <Ionicons name="navigate" size={16} color={colors.surface} />
            <Text style={styles.popupActionText}>Navigate</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selected zone popup */}
      {selectedZone && (
        <View style={styles.popup}>
          <View style={styles.popupHeader}>
            <Text style={styles.popupTitle}>{selectedZone.name}</Text>
            <TouchableOpacity onPress={() => setSelectedZone(null)}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.popupMeta}>
            {ZONE_TYPES.find((zt) => zt.value === selectedZone.zone_type)?.label ?? selectedZone.zone_type}
          </Text>
          <TouchableOpacity style={styles.popupAction} onPress={() => handleNavigateToZone(selectedZone)}>
            <Ionicons name="navigate" size={16} color={colors.surface} />
            <Text style={styles.popupActionText}>Navigate</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Selected incident popup */}
      {selectedIncident && (() => {
        const sev = SEVERITY_LEVELS.find((s) => s.value === selectedIncident.severity);
        const type = INCIDENT_TYPES.find((t) => t.value === selectedIncident.incident_type);
        const responding = isResponding(selectedIncident.id);
        const resp = respondersFor(selectedIncident.id);
        const sevColor =
          selectedIncident.severity === 'critical' ? '#DC2626' :
          selectedIncident.severity === 'high' ? '#F97316' :
          selectedIncident.severity === 'medium' ? '#F59E0B' : '#10B981';
        return (
          <View style={[styles.popup, { borderLeftWidth: 4, borderLeftColor: sevColor }]}>
            <View style={styles.popupHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupTitle} numberOfLines={2}>{selectedIncident.title}</Text>
                <Text style={styles.popupMeta}>
                  {type?.label || selectedIncident.incident_type} · {sev?.label || selectedIncident.severity}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedIncident(null)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.popupMeta}>
              🕒 {timeSince(selectedIncident.occurred_at)} · 🧑 {resp.length} responding
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }}>
              {responding ? (
                <>
                  <TouchableOpacity
                    style={[styles.popupAction, { flex: 1, backgroundColor: '#F59E0B' }]}
                    onPress={() => updateResponderStatus(selectedIncident.id, 'onscene')}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.popupActionText}>On Scene</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.popupAction, { backgroundColor: colors.border, paddingHorizontal: spacing.md }]}
                    onPress={() => cancelResponse(selectedIncident.id)}
                  >
                    <Ionicons name="close" size={16} color={colors.text} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.popupAction, { flex: 1, backgroundColor: '#DC2626' }]}
                  onPress={async () => {
                    await respondToIncident(selectedIncident.id);
                    computeRoute(selectedIncident, routeProfile);
                  }}
                >
                  <Ionicons name="shield" size={16} color="#fff" />
                  <Text style={styles.popupActionText}>Respond</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.popupAction, { backgroundColor: '#1d4ed8', paddingHorizontal: spacing.md }]}
                onPress={() => computeRoute(selectedIncident, routeProfile)}
                disabled={routeLoading}
              >
                <Ionicons name="git-network" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.popupAction, { backgroundColor: colors.primary, paddingHorizontal: spacing.md }]}
                onPress={() => handleNavigateToIncident(selectedIncident)}
              >
                <Ionicons name="navigate" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            {/* Mark Resolved — quick action separate from the main row */}
            <TouchableOpacity
              style={[styles.popupAction, { backgroundColor: '#16A34A', marginTop: spacing.xs }]}
              onPress={() => {
                Alert.alert(
                  'Mark Resolved?',
                  'This closes the incident for everyone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Mark Resolved',
                      style: 'destructive',
                      onPress: async () => {
                        await updateIncident(selectedIncident.id, {
                          status: 'resolved',
                          resolved_at: new Date().toISOString(),
                        });
                        clearRoute();
                        setSelectedIncident(null);
                      },
                    },
                  ],
                );
              }}
            >
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={styles.popupActionText}>Mark Resolved</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Pick-on-map banner — incident */}
      {pickingIncidentLocation && (
        <View style={styles.pickBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pickBannerTitle}>Tap anywhere to drop incident</Text>
            <Text style={styles.pickBannerSub}>
              {INCIDENT_TYPES.find((t) => t.value === newIncident.incident_type)?.label} · {newIncident.severity}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setPickingIncidentLocation(false)}
            style={styles.pickBannerCancel}
          >
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Pick-on-map banner — zone */}
      {pickingZoneLocation && (
        <View style={[styles.pickBanner, { backgroundColor: '#16A34A' }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pickBannerTitle}>Tap anywhere to drop zone</Text>
            <Text style={styles.pickBannerSub}>
              {newZone.name || ZONE_TYPES.find((t) => t.value === newZone.zone_type)?.label}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setPickingZoneLocation(false)}
            style={styles.pickBannerCancel}
          >
            <Ionicons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Turn-by-turn navigation panel */}
      {activeRoute && (() => {
        const inc = mapIncidents.find((i) => i.id === activeRoute.incidentId);
        return (
          <View style={styles.navPanel}>
            <View style={styles.navHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.navTitle} numberOfLines={1}>
                  {inc?.title || 'Route'}
                </Text>
                <Text style={styles.navMeta}>
                  {formatDistance(activeRoute.route.distance)} · {formatDuration(activeRoute.route.duration)} · {activeRoute.steps.length} steps
                </Text>
              </View>
              <View style={styles.navProfileToggle}>
                <TouchableOpacity
                  onPress={() => {
                    setRouteProfile('driving');
                    if (inc) computeRoute(inc, 'driving');
                  }}
                  style={[styles.navProfileBtn, routeProfile === 'driving' && styles.navProfileBtnActive]}
                >
                  <Ionicons name="car" size={14} color={routeProfile === 'driving' ? '#1d4ed8' : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setRouteProfile('walking');
                    if (inc) computeRoute(inc, 'walking');
                  }}
                  style={[styles.navProfileBtn, routeProfile === 'walking' && styles.navProfileBtnActive]}
                >
                  <Ionicons name="walk" size={14} color={routeProfile === 'walking' ? '#1d4ed8' : '#fff'} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setNavPanelExpanded((e) => !e)}
                style={styles.navIconBtn}
              >
                <Ionicons name={navPanelExpanded ? 'chevron-down' : 'chevron-up'} size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={clearRoute} style={styles.navIconBtn}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            {navPanelExpanded && (
              <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ paddingBottom: spacing.md }}>
                {activeRoute.steps.length === 0 ? (
                  <Text style={styles.navEmpty}>No step-by-step instructions</Text>
                ) : (
                  activeRoute.steps.map((s, i) => (
                    <View key={i} style={styles.navStep}>
                      <View style={styles.navStepBadge}>
                        <Text style={styles.navStepBadgeText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.navStepInstruction}>{s.instruction}</Text>
                        <Text style={styles.navStepMeta}>
                          {formatDistance(s.distance)}
                          {s.duration > 5 ? ` · ${formatDuration(s.duration)}` : ''}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        );
      })()}

      {routeLoading && !activeRoute && (
        <View style={styles.routeLoadingPill}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.routeLoadingText}>Calculating route…</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Zones list modal — tap a zone to fly the map to it */}
      <Modal
        visible={zoneListOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setZoneListOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Zones ({zones.length})</Text>
              <TouchableOpacity onPress={() => setZoneListOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 540 }} contentContainerStyle={{ paddingBottom: spacing.lg }}>
              {/* Add Zone form */}
              <View style={styles.zoneAddBox}>
                <Text style={styles.zoneAddTitle}>Add a zone</Text>
                <TextInput
                  style={[styles.addressInput, styles.zoneAddInput]}
                  value={newZone.name}
                  onChangeText={(t) => setNewZone((p) => ({ ...p, name: t }))}
                  placeholder="Name (optional)"
                  placeholderTextColor={colors.textSecondary}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.xs, paddingVertical: spacing.xs }}
                >
                  {ZONE_TYPES.map((zt) => {
                    const active = newZone.zone_type === zt.value;
                    return (
                      <TouchableOpacity
                        key={zt.value}
                        style={[
                          styles.chip,
                          { borderColor: zt.color },
                          active && { backgroundColor: zt.color, borderColor: zt.color },
                        ]}
                        onPress={() => setNewZone((p) => ({ ...p, zone_type: zt.value }))}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {zt.icon} {zt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.reportSubmit, { backgroundColor: '#16A34A', marginTop: spacing.sm }]}
                  onPress={() => {
                    setZoneListOpen(false);
                    setPickingZoneLocation(true);
                  }}
                >
                  <Ionicons name="location" size={18} color="#fff" />
                  <Text style={styles.reportSubmitText}>Tap on Map to Place</Text>
                </TouchableOpacity>
              </View>

              {zones.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <Ionicons name="map-outline" size={40} color={colors.textTertiary} />
                  <Text style={styles.modalEmptyText}>No zones yet</Text>
                  <Text style={styles.modalEmptyHint}>Add a zone using the form above.</Text>
                </View>
              ) : (
                zones.map((z) => {
                  const zt = ZONE_TYPES.find((t) => t.value === z.zone_type) || ZONE_TYPES[9];
                  const hasCoords = !!(z.center_lat && z.center_lng);
                  return (
                    <View key={z.id} style={styles.zoneRow}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md }}
                        onPress={() => flyToZone(z)}
                        disabled={!hasCoords}
                      >
                        <View style={[styles.zoneRowIcon, { backgroundColor: zt.color + '22' }]}>
                          <Text style={styles.zoneRowEmoji}>{zt.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.zoneRowName}>{z.name}</Text>
                          <Text style={styles.zoneRowType}>{zt.label}</Text>
                        </View>
                        {hasCoords ? null : <Text style={styles.zoneRowWarn}>No coords</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.zoneRowAction}
                        onPress={() => {
                          setEditZoneForm({ name: z.name, zone_type: z.zone_type });
                          setEditingZone(z);
                        }}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.zoneRowAction}
                        onPress={() => {
                          Alert.alert(
                            'Delete Zone?',
                            `"${z.name}" will be removed for everyone.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: async () => {
                                  const r = await deleteZone(z.id);
                                  if ((r as any)?.error) Alert.alert('Failed', (r as any).error.message || 'Could not delete');
                                },
                              },
                            ],
                          );
                        }}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit zone modal */}
      <Modal
        visible={!!editingZone}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingZone(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Zone</Text>
              <TouchableOpacity onPress={() => setEditingZone(null)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {editingZone && (
              <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
                <Text style={styles.fieldLabel}>Name</Text>
                <View style={styles.addressInputWrap}>
                  <Ionicons name="text-outline" size={16} color={colors.textSecondary} />
                  <TextInput
                    style={styles.addressInput}
                    value={editZoneForm.name}
                    onChangeText={(t) => setEditZoneForm((p) => ({ ...p, name: t }))}
                    placeholder="Zone name"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Type</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.xs, paddingVertical: spacing.xs }}
                >
                  {ZONE_TYPES.map((zt) => {
                    const active = editZoneForm.zone_type === zt.value;
                    return (
                      <TouchableOpacity
                        key={zt.value}
                        style={[
                          styles.chip,
                          { borderColor: zt.color },
                          active && { backgroundColor: zt.color, borderColor: zt.color },
                        ]}
                        onPress={() => setEditZoneForm((p) => ({ ...p, zone_type: zt.value }))}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {zt.icon} {zt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.reportSubmit, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    const ztype = ZONE_TYPES.find((t) => t.value === editZoneForm.zone_type) || ZONE_TYPES[0];
                    const r = await updateZone(editingZone.id, {
                      name: editZoneForm.name || editingZone.name,
                      zone_type: editZoneForm.zone_type,
                      color: ztype.color,
                    });
                    if ((r as any)?.error) {
                      Alert.alert('Failed', (r as any).error.message || 'Could not update');
                      return;
                    }
                    setEditingZone(null);
                  }}
                >
                  <Ionicons name="save" size={18} color="#fff" />
                  <Text style={styles.reportSubmitText}>Save changes</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Incidents list modal */}
      <Modal
        visible={incidentListOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIncidentListOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Active Incidents ({mapIncidents.length})</Text>
              <TouchableOpacity onPress={() => setIncidentListOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {mapIncidents.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="shield-checkmark-outline" size={40} color={colors.textTertiary} />
                <Text style={styles.modalEmptyText}>All clear</Text>
                <Text style={styles.modalEmptyHint}>No active incidents on the map.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: spacing.lg }}>
                {mapIncidents.map((inc) => {
                  const sev = SEVERITY_LEVELS.find((s) => s.value === inc.severity);
                  const resp = respondersFor(inc.id);
                  const responding = isResponding(inc.id);
                  const sevColor =
                    inc.severity === 'critical' ? '#DC2626' :
                    inc.severity === 'high' ? '#F97316' :
                    inc.severity === 'medium' ? '#F59E0B' : '#10B981';
                  return (
                    <TouchableOpacity
                      key={inc.id}
                      style={styles.zoneRow}
                      onPress={() => flyToIncident(inc)}
                    >
                      <View style={[styles.zoneRowIcon, { backgroundColor: sevColor + '22' }]}>
                        <Text style={[styles.zoneRowEmoji, { color: sevColor }]}>⚠</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.zoneRowName} numberOfLines={1}>{inc.title}</Text>
                        <Text style={styles.zoneRowType}>
                          {sev?.label} · {timeSince(inc.occurred_at)} · {resp.length} responding
                        </Text>
                      </View>
                      {responding ? (
                        <View style={[styles.respBadge, { backgroundColor: '#F59E0B' }]}>
                          <Text style={styles.respBadgeText}>ENROUTE</Text>
                        </View>
                      ) : (
                        <Ionicons name="navigate" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Report Incident modal */}
      <Modal
        visible={reportModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setReportModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report Incident</Text>
              <TouchableOpacity onPress={() => setReportModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
              <Text style={styles.reportHint}>
                Incident will be reported at your current GPS location. Make sure tracking is on.
              </Text>

              <Text style={styles.fieldLabel}>Title</Text>
              <View style={styles.inputWrap}>
                <Text
                  onPress={() => {}}
                  style={styles.inputText}
                >
                  {newIncident.title || `${INCIDENT_TYPES.find(t=>t.value===newIncident.incident_type)?.label} (auto)`}
                </Text>
              </View>

              <Text style={styles.fieldLabel}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
                {INCIDENT_TYPES.slice(0, 10).map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setNewIncident(p => ({ ...p, incident_type: t.value }))}
                    style={[
                      styles.chip,
                      newIncident.incident_type === t.value && styles.chipActive,
                    ]}
                  >
                    <Text style={[styles.chipText, newIncident.incident_type === t.value && styles.chipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Severity</Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {SEVERITY_LEVELS.map((s) => {
                  const color =
                    s.value === 'critical' ? '#DC2626' :
                    s.value === 'high' ? '#F97316' :
                    s.value === 'medium' ? '#F59E0B' : '#10B981';
                  const active = newIncident.severity === s.value;
                  return (
                    <TouchableOpacity
                      key={s.value}
                      onPress={() => setNewIncident(p => ({ ...p, severity: s.value as Incident['severity'] }))}
                      style={[
                        styles.sevChip,
                        { borderColor: color },
                        active && { backgroundColor: color },
                      ]}
                    >
                      <Text style={[styles.sevChipText, active && { color: '#fff' }]}>{s.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.reportSubmit} onPress={handleReportAtCurrent}>
                <Ionicons name="alert-circle" size={18} color="#fff" />
                <Text style={styles.reportSubmitText}>Report at My Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reportSubmit, { backgroundColor: '#1d4ed8', marginTop: spacing.sm }]}
                onPress={() => {
                  setReportModalOpen(false);
                  setPickingIncidentLocation(true);
                }}
              >
                <Ionicons name="location" size={18} color="#fff" />
                <Text style={styles.reportSubmitText}>Tap on Map to Place</Text>
              </TouchableOpacity>

              {/* Address search → drop at geocoded place */}
              <View style={{ marginTop: spacing.lg }}>
                <Text style={styles.fieldLabel}>Or search an address</Text>
                <View style={styles.addressInputWrap}>
                  <Ionicons name="search" size={16} color={colors.textSecondary} />
                  <TextInput
                    style={styles.addressInput}
                    value={addressQuery}
                    onChangeText={runAddressSearch}
                    placeholder="Type a place or address…"
                    placeholderTextColor={colors.textSecondary}
                    autoCorrect={false}
                  />
                  {geocoding && <ActivityIndicator size="small" color={colors.primary} />}
                </View>
                {addressResults.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.addressResult}
                    onPress={() => handleDropAtGeocoded(r)}
                  >
                    <Ionicons name="location-outline" size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addressResultTitle} numberOfLines={1}>{r.shortName}</Text>
                      <Text style={styles.addressResultSub} numberOfLines={1}>{r.placeName}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorText: { ...typography.h3, color: colors.error, marginTop: spacing.md },
  errorHint: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    ...shadow.sm,
  },
  statText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },

  controlsColumn: {
    position: 'absolute',
    right: spacing.lg,
    top: 90,
    gap: spacing.sm,
  },
  ctrlBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  ctrlBtnActive: { backgroundColor: colors.primary },
  ctrlBtnReport: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },

  trackingPill: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    ...shadow.md,
  },
  trackingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface },
  trackingText: { ...typography.caption, color: colors.surface, fontWeight: '700' },

  zonePin: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    ...shadow.md,
  },
  zoneEmoji: { fontSize: 16 },

  memberPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    ...shadow.md,
  },
  memberInitials: { ...typography.caption, color: colors.surface, fontWeight: '700' },

  popup: {
    position: 'absolute',
    bottom: 110,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.lg,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  popupTitle: { ...typography.h3, color: colors.text },
  popupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  popupMeta: { ...typography.bodySmall, color: colors.textSecondary },
  popupAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  popupActionText: { ...typography.label, color: colors.surface },

  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.surface },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: { ...typography.h3, color: colors.text },
  modalEmpty: {
    padding: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalEmptyText: { ...typography.h3, color: colors.textSecondary },
  modalEmptyHint: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center' },

  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  zoneRowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneRowEmoji: { fontSize: 20 },
  zoneRowName: { ...typography.body, color: colors.text, fontWeight: '600' },
  zoneRowType: { ...typography.bodySmall, color: colors.textSecondary },
  zoneRowWarn: { ...typography.caption, color: colors.warning },
  zoneRowAction: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.borderLight,
    marginLeft: spacing.xs,
  },

  // Add-zone form (inside zones modal)
  zoneAddBox: {
    backgroundColor: colors.borderLight,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  zoneAddTitle: { ...typography.label, color: colors.text, marginBottom: spacing.xs, fontWeight: '700' },
  zoneAddInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Incident pins + report button
  incidentPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
  },
  incidentPinText: { fontSize: 16, fontWeight: '900', color: '#fff' },

  reportBtn: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#DC2626',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    ...shadow.lg,
  },
  reportBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  respBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  respBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  // Report modal fields
  reportHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  inputText: { ...typography.body, color: colors.textSecondary },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmall, color: colors.text },
  chipTextActive: { color: colors.surface, fontWeight: '600' },
  sevChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  sevChipText: { ...typography.label, color: colors.text },
  reportSubmit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#DC2626',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  reportSubmitText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Address search
  addressInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  addressInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  addressResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressResultTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  addressResultSub: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },

  // Pick-on-map banner
  pickBanner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d4ed8',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    gap: spacing.sm,
    ...shadow.lg,
  },
  pickBannerTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  pickBannerSub: { color: '#fff', opacity: 0.85, fontSize: 11, marginTop: 2 },
  pickBannerCancel: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.md,
  },

  // Turn-by-turn navigation panel
  navPanel: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.lg,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  navTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  navMeta: { color: '#fff', opacity: 0.85, fontSize: 11, marginTop: 2 },
  navProfileToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  navProfileBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  navProfileBtnActive: { backgroundColor: '#fff' },
  navIconBtn: {
    padding: 6,
  },
  navEmpty: {
    textAlign: 'center',
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  navStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navStepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navStepBadgeText: { color: '#1d4ed8', fontSize: 11, fontWeight: '700' },
  navStepInstruction: { ...typography.body, color: colors.text },
  navStepMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  routeLoadingPill: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    ...shadow.lg,
  },
  routeLoadingText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
