// Geographic helpers shared between web and mobile.

/**
 * Haversine distance between two lat/lng points in metres.
 * Accurate to ~0.5% — fine for radius checks under a few km.
 */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * True if `point` is within `radiusMeters` of `center`.
 */
export function isWithinRadius(
  point: { lat: number; lng: number },
  center: { lat: number; lng: number },
  radiusMeters: number,
): boolean {
  return distanceMeters(point, center) <= radiusMeters;
}
