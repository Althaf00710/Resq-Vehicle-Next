// components-page/home/LiveLocationMap.tsx
'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import Script from 'next/script';
import { useMutation } from '@apollo/client';
import { HANDLE_RESCUE_VEHICLE_LOCATION } from '@/graphql/mutations/rescueVehicleMutations';

interface LiveLocationMapProps {
  rescueVehicleId: number;
  offer?: { lat: number; lng: number } | null; // destination
  active?: boolean;                             // whether to show route/destination
}

type GLL = google.maps.LatLngLiteral;

export default function LiveLocationMap({ rescueVehicleId, offer = null, active = false }: LiveLocationMapProps) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);

  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const latestPosRef = useRef<GLL | null>(null);

  const [sendLocation] = useMutation(HANDLE_RESCUE_VEHICLE_LOCATION);

  const clearRoute = useCallback(() => {
    directionsRendererRef.current?.setMap(null);
    directionsRendererRef.current = null;
    destMarkerRef.current?.setMap(null);
    destMarkerRef.current = null;
  }, []);

  const renderRoute = useCallback((origin: GLL, destination: GLL) => {
    if (!mapInstance.current || !window.google?.maps) return;

    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new window.google.maps.DirectionsService();
    }
    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({ suppressMarkers: true });
      directionsRendererRef.current.setMap(mapInstance.current);
    }

    if (!destMarkerRef.current) {
      destMarkerRef.current = new window.google.maps.Marker({
        map: mapInstance.current,
        position: destination,
        icon: { url: '/destination.png', scaledSize: new window.google.maps.Size(36, 36) },
        title: 'Request location',
      });
    } else {
      destMarkerRef.current.setPosition(destination);
    }

    directionsServiceRef.current.route(
      { origin, destination, travelMode: window.google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRendererRef.current!.setDirections(result);
          const b = new window.google.maps.LatLngBounds();
          b.extend(origin);
          b.extend(destination);
          mapInstance.current!.fitBounds(b, 64);
        } else {
          const b = new window.google.maps.LatLngBounds();
          b.extend(origin);
          b.extend(destination);
          mapInstance.current!.fitBounds(b, 64);
        }
      }
    );
  }, []);

  const transmit = useCallback(
    (lat: number, lng: number) => {
      const pos = { lat, lng };
      latestPosRef.current = pos;
      mapInstance.current?.setCenter(pos);
      markerRef.current?.setPosition(pos);

      if (active && offer && latestPosRef.current) {
        renderRoute(latestPosRef.current, offer);
      }

      // fire-and-forget
      sendLocation({
        variables: { input: { rescueVehicleId, latitude: lat, longitude: lng, address: '' } },
      }).catch(() => {});
    },
    [rescueVehicleId, sendLocation, active, offer, renderRoute]
  );

  const initMap = useCallback(() => {
    // guard: only once and only when Google is available
    if (mapInstance.current || !mapEl.current || !window.google?.maps) return;

    mapInstance.current = new window.google.maps.Map(mapEl.current, {
      center: { lat: 0, lng: 0 },
      zoom: 15,
      streetViewControl: false,
      mapTypeControl: false,
      gestureHandling: 'greedy',
    });

    markerRef.current = new window.google.maps.Marker({
      map: mapInstance.current,
      position: { lat: 0, lng: 0 },
      icon: { url: '/marker.png', scaledSize: new window.google.maps.Size(42, 42) },
      title: 'Your vehicle',
    });

    if (!navigator.geolocation) return;

    const handleGeo = (pos: GeolocationPosition) => {
      transmit(pos.coords.latitude, pos.coords.longitude);
    };
    const handleError = () => {
      const p = latestPosRef.current;
      if (p) transmit(p.lat, p.lng);
    };

    navigator.geolocation.getCurrentPosition(handleGeo, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(handleGeo, handleError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    });

    intervalIdRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(handleGeo, handleError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      });
    }, 9000);
  }, [transmit]);

  // ✅ Also init if the script was already loaded earlier (Next.js dedupes scripts)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).google?.maps) {
      initMap();
    }
  }, [initMap]);

  // React to offer / active changes
  useEffect(() => {
    if (!mapInstance.current) return;
    if (active && offer && latestPosRef.current) {
      renderRoute(latestPosRef.current, offer);
    } else {
      clearRoute();
    }
  }, [active, offer, renderRoute, clearRoute]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalIdRef.current !== null) clearInterval(intervalIdRef.current);
      clearRoute();
    };
  }, [clearRoute]);

  return (
    <>
      {/* If the script is already present, onLoad may not fire; the effect above covers that case */}
      <Script
        id="google-maps-js"
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}`}
        strategy="afterInteractive"
        onLoad={initMap}
        onError={() => console.error('Google Maps script failed to load')}
      />
      <div ref={mapEl} className="fixed inset-0 z-0 w-screen h-[100dvh]" />
    </>
  );
}
