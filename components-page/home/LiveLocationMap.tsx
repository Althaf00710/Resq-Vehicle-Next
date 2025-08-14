'use client'
import { useRef, useState, useCallback } from 'react'
import Script from 'next/script'
import { useMutation } from '@apollo/client'
import { HANDLE_RESCUE_VEHICLE_LOCATION } from '@/graphql/mutations/rescueVehicleMutations'

interface LiveLocationMapProps {
  rescueVehicleId: number;
}

export default function LiveLocationMap({ rescueVehicleId }: LiveLocationMapProps) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)

  // track live
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [sendLocation] = useMutation(HANDLE_RESCUE_VEHICLE_LOCATION);

  const initMap = useCallback(() => {
    if (!mapEl.current || !window.google?.maps) return

    // initialize
    mapInstance.current = new window.google.maps.Map(mapEl.current, {
      center: { lat: 0, lng: 0 },
      zoom: 15,
    })

    // add marker
    markerRef.current = new window.google.maps.Marker({
      map: mapInstance.current,
      position: { lat: 0, lng: 0 },
      icon: {
        url: '/marker.png',            
        scaledSize: new window.google.maps.Size(42, 42),
      },
    })

    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    // get initial position and watch updates
    const handleGeo = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const latlng = { lat: latitude, lng: longitude };

      setPosition(latlng);
      if (mapInstance.current) {
        mapInstance.current.setCenter(latlng);
      }
      if (markerRef.current) {
        markerRef.current.setPosition(latlng);
      }

      // send to server
      sendLocation({
        variables: {
          input: {
            rescueVehicleId,
            latitude,
            longitude,
            address: ''  // or reverse‐geocode here
          }
        }
      }).catch(err => {
        console.error('Error sending location:', err);
      });
    };

    // initial
    navigator.geolocation.getCurrentPosition(handleGeo, console.error, {
      enableHighAccuracy: true
    });

    // live updates
    navigator.geolocation.watchPosition(handleGeo, console.error, {
      enableHighAccuracy: true
    });
  }, [rescueVehicleId, sendLocation]);

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}`}
        strategy="afterInteractive"
        onLoad={initMap}
        onError={() => console.error('Google Maps script failed to load')}
      />

      {/* Fullscreen map */}
      <div
        ref={mapEl}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
        }}
      />
    </>
  )
}
