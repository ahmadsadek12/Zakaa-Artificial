// Geo Utilities
// Functions for geographic calculations and validation

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a location is within delivery radius
 * @param {number} customerLat - Customer latitude
 * @param {number} customerLon - Customer longitude
 * @param {number} businessLat - Business latitude
 * @param {number} businessLon - Business longitude
 * @param {number} maxRadiusKm - Maximum delivery radius in kilometers
 * @returns {Object} { withinRadius: boolean, distance: number }
 */
function isWithinDeliveryRadius(customerLat, customerLon, businessLat, businessLon, maxRadiusKm = 10) {
  const distance = calculateDistance(customerLat, customerLon, businessLat, businessLon);
  
  return {
    withinRadius: distance <= maxRadiusKm,
    distance: Math.round(distance * 10) / 10 // Round to 1 decimal place
  };
}

/**
 * Validate GPS coordinates
 * @param {number} latitude
 * @param {number} longitude
 * @returns {boolean} True if valid
 */
function validateCoordinates(latitude, longitude) {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !isNaN(latitude) &&
    !isNaN(longitude)
  );
}

/**
 * Get approximate city/area from coordinates (placeholder for reverse geocoding)
 * In production, integrate with Google Maps Geocoding API or similar
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<Object>} { city: string, area: string, country: string }
 */
async function reverseGeocode(latitude, longitude) {
  // TODO: Integrate with actual geocoding service (Google Maps, OpenStreetMap, etc.)
  // For now, return placeholder
  
  // Example: If you have Google Maps API key
  // const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${API_KEY}`;
  // const response = await fetch(url);
  // const data = await response.json();
  // Parse data.results[0].address_components
  
  return {
    city: 'Unknown City',
    area: 'Unknown Area',
    country: 'Lebanon', // Default for now
    formatted_address: `${latitude}, ${longitude}`
  };
}

module.exports = {
  calculateDistance,
  isWithinDeliveryRadius,
  validateCoordinates,
  reverseGeocode
};
