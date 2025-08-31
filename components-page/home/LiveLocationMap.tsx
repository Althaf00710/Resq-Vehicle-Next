'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import Script from 'next/script'
import { useMutation } from '@apollo/client'
import { HANDLE_RESCUE_VEHICLE_LOCATION } from '@/graphql/mutations/rescueVehicleMutations'

interface LiveLocationMapProps {
  rescueVehicleId: number
  offer?: { lat: number; lng: number } | null  // destination (when offer active)
  active?: boolean                              // whether to show route/destination
}

export default function LiveLocationMap({ rescueVehicleId, offer = null, active = false }: LiveLocationMapProps) {
  const mapEl = useRef<HTMLDivElement | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const destMarkerRef = useRef<google.maps.Marker | null>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)

  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)

  // keep refs for cleanup
  const watchIdRef = useRef<number | null>(null)
  const intervalIdRef = useRef<number | null>(null)

  // latest known coords (for keep-alive pings and routing)
  const latestPosRef = useRef<{ lat: number; lng: number } | null>(null)

  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [sendLocation] = useMutation(HANDLE_RESCUE_VEHICLE_LOCATION)

  const clearRoute = useCallback(() => {
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
      directionsRendererRef.current = null
    }
    if (destMarkerRef.current) {
      destMarkerRef.current.setMap(null)
      destMarkerRef.current = null
    }
  }, [])

  const renderRoute = useCallback((origin: google.maps.LatLngLiteral, destination: google.maps.LatLngLiteral) => {
    if (!mapInstance.current || !window.google?.maps) return

    // init services once
    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new window.google.maps.DirectionsService()
    }
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({ suppressMarkers: true })
      directionsRendererRef.current.setMap(mapInstance.current)
    }

    // destination marker
    if (!destMarkerRef.current) {
      destMarkerRef.current = new window.google.maps.Marker({
        map: mapInstance.current,
        position: destination,
        icon: {
          url: '/destination.png', // optional custom icon
          scaledSize: new window.google.maps.Size(36, 36),
        },
        title: 'Request location',
      })
    } else {
      destMarkerRef.current.setPosition(destination)
    }

    directionsServiceRef.current.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRendererRef.current!.setDirections(result)

          // fit bounds
          const bounds = new window.google.maps.LatLngBounds()
          bounds.extend(origin)
          bounds.extend(destination)
          mapInstance.current!.fitBounds(bounds, 64)
        } else {
          // If routing fails, still ensure the destination marker is visible
          console.warn('Directions request failed:', status)
          const bounds = new window.google.maps.LatLngBounds()
          bounds.extend(origin)
          bounds.extend(destination)
          mapInstance.current!.fitBounds(bounds, 64)
        }
      }
    )
  }, [])

  const transmit = useCallback((lat: number, lng: number) => {
    setPosition({ lat, lng })
    latestPosRef.current = { lat, lng }

    if (mapInstance.current) mapInstance.current.setCenter({ lat, lng })
    if (markerRef.current) markerRef.current.setPosition({ lat, lng })

    // If an offer is active, recompute route from the new origin
    if (active && offer && latestPosRef.current) {
      renderRoute(latestPosRef.current, offer)
    }

    // fire-and-forget mutation
    sendLocation({
      variables: {
        input: {
          rescueVehicleId,
          latitude: lat,
          longitude: lng,
          address: '' // optional reverse-geocode
        }
      }
    }).catch(err => console.error('Error sending location:', err))
  }, [rescueVehicleId, sendLocation, active, offer, renderRoute])

  const initMap = useCallback(() => {
    if (!mapEl.current || !window.google?.maps) return

    // init map + marker
    mapInstance.current = new window.google.maps.Map(mapEl.current, {
      center: { lat: 0, lng: 0 },
      zoom: 15,
      streetViewControl: false,
      mapTypeControl: false,
    })

    markerRef.current = new window.google.maps.Marker({
      map: mapInstance.current,
      position: { lat: 0, lng: 0 },
      icon: {
        url: '/marker.png',
        scaledSize: new window.google.maps.Size(42, 42),
      },
      title: 'Your vehicle',
    })

    if (!navigator.geolocation) {
      console.warn('Geolocation not supported')
      return
    }

    const handleGeo = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords
      transmit(latitude, longitude)
    }

    const handleError = (err: GeolocationPositionError) => {
      console.warn('Geolocation error:', err)
      const p = latestPosRef.current
      if (p) transmit(p.lat, p.lng)
    }

    // initial
    navigator.geolocation.getCurrentPosition(handleGeo, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    })

    // continuous updates
    watchIdRef.current = navigator.geolocation.watchPosition(handleGeo, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    })

    // periodic keep-alive reads
    intervalIdRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(handleGeo, handleError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      })
    }, 9000)
  }, [transmit])

  // react to offer / active changes
  useEffect(() => {
    if (!mapInstance.current) return

    if (active && offer && latestPosRef.current) {
      // draw route
      renderRoute(latestPosRef.current, offer)
    } else {
      // hide destination + route
      clearRoute()
    }
  }, [active, offer, clearRoute, renderRoute])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (intervalIdRef.current !== null) clearInterval(intervalIdRef.current)
      clearRoute()
    }
  }, [clearRoute])

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}`}
        strategy="afterInteractive"
        onLoad={initMap}
        onError={() => console.error('Google Maps script failed to load')}
      />
      <div ref={mapEl} style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh' }} />
    </>
  )
}
