import { useState, useCallback, useRef } from 'react'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { MapPin } from 'lucide-react'

const libraries = ['places']

const containerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '8px'
}

export default function MapPicker({ latitude, longitude, onLocationChange }) {
  const [map, setMap] = useState(null)
  const [markerPosition, setMarkerPosition] = useState(
    latitude && longitude
      ? { lat: parseFloat(latitude), lng: parseFloat(longitude) }
      : { lat: 33.8938, lng: 35.5018 } // Default to Beirut
  )
  const mapRef = useRef(null)

  // Get API key from environment variable
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries
  })

  const onMapLoad = useCallback((map) => {
    mapRef.current = map
    setMap(map)
    
    // Set initial center if coordinates are provided
    if (latitude && longitude) {
      const center = {
        lat: parseFloat(latitude),
        lng: parseFloat(longitude)
      }
      map.setCenter(center)
      setMarkerPosition(center)
    }
  }, [latitude, longitude])

  const onMapClick = useCallback((event) => {
    const newPosition = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    }
    setMarkerPosition(newPosition)
    onLocationChange(newPosition.lat, newPosition.lng)
  }, [onLocationChange])

  const handleSearch = useCallback((e) => {
    e.preventDefault()
    const input = e.target.querySelector('input')
    const query = input.value.trim()
    
    if (!query || !map) return

    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ address: query }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location
        const newPosition = {
          lat: location.lat(),
          lng: location.lng()
        }
        setMarkerPosition(newPosition)
        map.setCenter(newPosition)
        map.setZoom(15)
        onLocationChange(newPosition.lat, newPosition.lng)
        input.value = ''
      } else {
        alert('Location not found. Please try a different search term.')
      }
    })
  }, [map, onLocationChange])

  if (loadError) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-center">
        <p className="text-red-800 font-medium">Error loading Google Maps</p>
        <p className="text-red-600 text-sm mt-2">
          {GOOGLE_MAPS_API_KEY 
            ? 'Please check your Google Maps API key configuration.'
            : 'Please configure VITE_GOOGLE_MAPS_API_KEY in your environment variables.'}
        </p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Loading map...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search for a location (e.g., 'Beirut, Lebanon')"
          className="input flex-1"
        />
        <button
          type="submit"
          className="btn btn-primary whitespace-nowrap"
        >
          Search
        </button>
      </form>

      {/* Map */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={markerPosition}
          zoom={latitude && longitude ? 15 : 12}
          onLoad={onMapLoad}
          onClick={onMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: true,
            zoomControl: true
          }}
        >
          <Marker position={markerPosition} />
        </GoogleMap>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <MapPin size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How to set your location:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click anywhere on the map to place a marker</li>
              <li>Or search for an address using the search bar above</li>
              <li>The latitude and longitude will be automatically updated</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
