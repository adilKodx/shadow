// Mapbox Directions API helper — works on both web and mobile
// Docs: https://docs.mapbox.com/api/navigation/directions/

export type RouteProfile = 'driving' | 'walking' | 'cycling' | 'driving-traffic';

export interface RouteStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
  maneuverType: string;
  modifier?: string;
  location: [number, number]; // [lng, lat]
}

export interface RouteLeg {
  distance: number;
  duration: number;
  steps: RouteStep[];
}

export interface DirectionsRoute {
  distance: number; // total meters
  duration: number; // total seconds
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat][]
  };
  legs: RouteLeg[];
}

export interface DirectionsResponse {
  routes: DirectionsRoute[];
  code: string;
  message?: string;
}

// NOTE: never reference `import.meta` here — Metro (React Native) does not parse it.
// The caller is responsible for passing the token, or we read it from `process.env` only.
function resolveToken(explicit?: string): string {
  if (explicit) return explicit;
  // process.env is safe on both web (Vite exposes it for `VITE_*`) and RN/Expo (EXPO_PUBLIC_*)
  try {
    const env: any = (typeof process !== 'undefined' && process.env) || {};
    return (
      env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
      env.VITE_MAPBOX_ACCESS_TOKEN ||
      env.MAPBOX_ACCESS_TOKEN ||
      ''
    );
  } catch {
    return '';
  }
}

export async function fetchDirections(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  profile: RouteProfile = 'driving',
  accessToken?: string
): Promise<DirectionsRoute | null> {
  const token = resolveToken(accessToken);

  if (!token) {
    console.warn('[directions] No Mapbox token found — pass accessToken explicitly or set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN / VITE_MAPBOX_ACCESS_TOKEN');
    return null;
  }

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?geometries=geojson&steps=true&overview=full&access_token=${token}`;

  console.log('[directions] GET', url.replace(token, token.slice(0, 8) + '…'));

  // 15s timeout so the UI never hangs forever
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    let data: DirectionsResponse;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[directions] Non-JSON response', res.status, text.slice(0, 200));
      return null;
    }
    if (!res.ok || data.code !== 'Ok' || !data.routes?.length) {
      console.warn('[directions] Mapbox error', res.status, data.code, data.message);
      return null;
    }
    console.log('[directions] OK', {
      distance: data.routes[0].distance,
      duration: data.routes[0].duration,
      steps: data.routes[0].legs?.reduce((n, l: any) => n + (l.steps?.length || 0), 0),
    });
    return data.routes[0];
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.error('[directions] Fetch timed out after 15s');
    } else {
      console.error('[directions] Fetch failed', err?.message || err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Human-friendly distance formatter
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Human-friendly duration formatter
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

// Icon name for maneuver type (Ionicons-compatible)
export function maneuverIcon(type: string, modifier?: string): string {
  if (type === 'arrive') return 'flag';
  if (type === 'depart') return 'navigate';
  if (type === 'turn' || type === 'end of road' || type === 'on ramp' || type === 'off ramp' || type === 'fork') {
    if (modifier?.includes('left')) return 'arrow-back';
    if (modifier?.includes('right')) return 'arrow-forward';
    if (modifier === 'straight') return 'arrow-up';
    return 'arrow-up';
  }
  if (type === 'continue' || type === 'merge') return 'arrow-up';
  if (type === 'roundabout' || type === 'rotary') return 'refresh-circle';
  return 'navigate';
}

// Parse Mapbox steps into our simpler RouteStep array
export function extractSteps(route: DirectionsRoute): RouteStep[] {
  const steps: RouteStep[] = [];
  for (const leg of route.legs || []) {
    for (const s of (leg as any).steps || []) {
      steps.push({
        instruction: s.maneuver?.instruction || 'Continue',
        distance: s.distance || 0,
        duration: s.duration || 0,
        maneuverType: s.maneuver?.type || 'continue',
        modifier: s.maneuver?.modifier,
        location: s.maneuver?.location || [0, 0],
      });
    }
  }
  return steps;
}
