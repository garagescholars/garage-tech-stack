import * as Location from "expo-location";
import { GEOFENCE_RADIUS_METERS } from "../constants/urgency";

/**
 * Calculate distance between two coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Request location permissions and get current position.
 */
export async function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

/**
 * Validate that the user is within the geofence radius of the job site.
 */
export function validateGeofence(
  userLat: number,
  userLng: number,
  jobLat: number,
  jobLng: number,
  radiusMeters: number = GEOFENCE_RADIUS_METERS
): { valid: boolean; distanceMeters: number } {
  const distance = haversineDistance(userLat, userLng, jobLat, jobLng);
  return {
    valid: distance <= radiusMeters,
    distanceMeters: Math.round(distance),
  };
}
