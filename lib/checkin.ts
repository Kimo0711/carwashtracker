// Cookie holding the linked phone's secret token (see /api/clock/enroll)
export const CLOCK_COOKIE = 'cw_clock';

// How close to the shop a phone's GPS position must be
export const SHOP_RADIUS_METERS = 300;

export interface ShopLocation {
  lat: number | null;
  lng: number | null;
  wifiNetworks: string[];
}

// Shop settings saved from the dashboard, falling back to the SHOP_LAT / SHOP_LNG env vars
export function shopLocation(row: ShopLocation | null): ShopLocation {
  const envLat = parseFloat(process.env.SHOP_LAT || '0');
  const envLng = parseFloat(process.env.SHOP_LNG || '0');
  const hasEnv = envLat !== 0 && envLng !== 0 && !isNaN(envLat) && !isNaN(envLng);
  return {
    lat: row?.lat ?? (hasEnv ? envLat : null),
    lng: row?.lng ?? (hasEnv ? envLng : null),
    wifiNetworks: row?.wifiNetworks ?? [],
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

// Public IP the request came from, as reported by the hosting proxy
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = (forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip'))?.trim();
  return ip || null;
}

// A browser can't read the Wi-Fi name, so "on the shop Wi-Fi" means "same public network":
// every device behind the shop router shares one public IPv4, or one IPv6 /64 prefix.
export function networkKey(ip: string): string {
  const v4 = ip.replace(/^::ffff:/i, '');
  if (!v4.includes(':')) return v4;

  const [head, tail = ''] = ip.toLowerCase().split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? [...headParts, ...Array(8 - headParts.length - tailParts.length).fill('0'), ...tailParts]
    : headParts;
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

// Decides whether a clock in/out request comes from the shop: shop Wi-Fi first, GPS otherwise.
export function verifyPresence(
  shop: ShopLocation,
  ip: string | null,
  lat: unknown,
  lng: unknown
): { via: string } | { error: string; needsLocation?: boolean } {
  const hasLocation = shop.lat !== null && shop.lng !== null;

  if (!hasLocation && shop.wifiNetworks.length === 0) {
    return { error: 'Clock-in is not set up yet. Ask the owner to set the shop location or Wi-Fi.' };
  }

  if (ip && shop.wifiNetworks.includes(networkKey(ip))) {
    return { via: 'wifi' };
  }

  if (!hasLocation) {
    return { error: 'You must be connected to the shop Wi-Fi to clock in/out.' };
  }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return {
      error: 'Could not confirm you are at the shop. Connect to the shop Wi-Fi or allow location access, then try again.',
      needsLocation: true,
    };
  }

  const dist = Math.round(distanceMeters(lat, lng, shop.lat!, shop.lng!));
  if (dist > SHOP_RADIUS_METERS) {
    return { error: `You must be at the shop to clock in/out. (${dist}m away)` };
  }
  return { via: `gps ${dist}m` };
}
