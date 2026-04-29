// Mapbox Geocoding API — forward geocoding (text → lat/lng + place name)
// Used by mobile to let users search an address and drop an incident there.
// Reference: https://docs.mapbox.com/api/search/geocoding/

export interface GeocodeResult {
  id: string;
  placeName: string;       // e.g. "1600 Pennsylvania Ave NW, Washington, DC 20500"
  shortName: string;       // e.g. "1600 Pennsylvania Ave NW"
  lat: number;
  lng: number;
}

interface MapboxFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

/**
 * Forward geocode `query` and return up to `limit` candidate places.
 * Pass an explicit `accessToken` from the caller — the helper does NOT read
 * env so it works identically on web (Vite) and mobile (Metro).
 */
export async function geocodeForward(
  query: string,
  accessToken: string,
  opts: { limit?: number; proximity?: { lat: number; lng: number } } = {},
): Promise<GeocodeResult[]> {
  if (!query.trim() || !accessToken) return [];
  const { limit = 5, proximity } = opts;
  const params = new URLSearchParams({
    access_token: accessToken,
    autocomplete: 'true',
    limit: String(limit),
  });
  if (proximity) params.set('proximity', `${proximity.lng},${proximity.lat}`);

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
  console.log('[geocode] GET', url.replace(accessToken, accessToken.slice(0, 10) + '…'));

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      console.warn('[geocode] HTTP', res.status, await res.text().catch(() => ''));
      return [];
    }
    const json = (await res.json()) as { features?: MapboxFeature[] };
    return (json.features || []).map((f) => ({
      id: f.id,
      placeName: f.place_name,
      shortName: f.text,
      lng: f.center[0],
      lat: f.center[1],
    }));
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[geocode] error', err?.message || err);
    return [];
  }
}
