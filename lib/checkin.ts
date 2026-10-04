// Cookie holding the linked phone's secret token (see /api/clock/enroll)
export const CLOCK_COOKIE = 'cw_clock';

// How close to the shop a phone's position must be
export const SHOP_RADIUS_METERS = 300;

export interface ShopLocation {
  lat: number | null;
  lng: number | null;
}

// Shop location saved from the dashboard, falling back to the SHOP_LAT / SHOP_LNG env vars
export function shopLocation(row: ShopLocation | null): ShopLocation {
  const envLat = parseFloat(process.env.SHOP_LAT || '0');
  const envLng = parseFloat(process.env.SHOP_LNG || '0');
  const hasEnv = envLat !== 0 && envLng !== 0 && !isNaN(envLat) && !isNaN(envLng);
  return {
    lat: row?.lat ?? (hasEnv ? envLat : null),
    lng: row?.lng ?? (hasEnv ? envLng : null),
  };
}

// Haversine distance in meters between two GPS coordinates
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Decides whether a clock in/out request comes from the shop, based on the phone's position
export function verifyPresence(shop: ShopLocation, lat: unknown, lng: unknown): { via: string } | { error: string } {
  if (shop.lat === null || shop.lng === null) {
    return { error: 'Clock-in is not set up yet. Ask the owner to set the shop location.' };
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { error: 'Location access is required to clock in/out. Allow location, then try again.' };
  }

  const dist = Math.round(distanceMeters(lat, lng, shop.lat, shop.lng));
  if (dist > SHOP_RADIUS_METERS) {
    return { error: `You must be at the shop to clock in/out. (${dist}m away)` };
  }
  return { via: `gps ${dist}m` };
}
