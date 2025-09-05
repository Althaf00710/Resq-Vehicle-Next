// app/(whatever)/vehicle/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useMutation, useSubscription, useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import { ASSIGNMENT_SUBSCRIPTION } from '@/graphql/subscriptions/AssignmentSubscription';
import { RESPOND_TO_ASSIGNMENT_OFFER, UPDATE_RESCUE_VEHICLE_ASSIGNMENT } from '@/graphql/mutations/AssignmentMutations';
import { VEHICLE_ASSIGNMENT_QUERY } from '@/graphql/queries/vehicleAssignment';

import AssignmentOfferToast from '@/components-page/home/AssignmentOfferToast';
import AssignmentActiveCard from '@/components-page/home/AssignmentActiveCard';
import type { Offer } from '@/graphql/types/assignment';

// Load Maps client-side only
const LiveLocationMap = dynamic(() => import('@/components-page/home/LiveLocationMap'), { ssr: false });

const RV_INFO_KEY = 'resq.rv.info';
type StoredRV = { id?: number | string; rescueVehicleId?: number | string; vehicleId?: number | string };

function getVehicleIdFromStorage(): number | null {
  try {
    const raw = localStorage.getItem(RV_INFO_KEY);
    if (!raw) return null;
    const obj: StoredRV = JSON.parse(raw);
    const idRaw = obj.id ?? obj.rescueVehicleId ?? obj.vehicleId;
    if (idRaw == null) return null;
    const n = typeof idRaw === 'string' ? parseInt(idRaw, 10) : Number(idRaw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function toInt(v: unknown): number | null {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  return Number.isFinite(n) ? n : null;
}

type RequestLike = {
  id: string | number;
  address?: string | null;
  latitude: number;
  longitude: number;
  description?: string | null;
  proofImageURL?: string | null;
  emergencySubCategory?: { name?: string | null } | null;
  status?: string | null;
};

export default function VehicleHomePage() {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);

  // Persist after accept
  const [acceptedDest, setAcceptedDest] = useState<{ lat: number; lng: number } | null>(null);
  const [acceptedRequest, setAcceptedRequest] = useState<RequestLike | null>(null);
  const [acceptedAssignmentId, setAcceptedAssignmentId] = useState<number | null>(null);

  const expiryTimerRef = useRef<number | null>(null);

  // Init vehicle id or redirect
  useEffect(() => {
    const id = getVehicleIdFromStorage();
    if (id == null) {
      router.replace('/vehicle/login');
      return;
    }
    setVehicleId(id);
  }, [router]);

  // Live assignment offers
  const { data: subData } = useSubscription(ASSIGNMENT_SUBSCRIPTION, {
    variables: vehicleId == null ? undefined : { vehicleId },
    skip: vehicleId == null,
    shouldResubscribe: true,
  });

  useEffect(() => {
    const incoming = subData?.onVehicleAssignmentOffered as Offer | undefined;
    if (!incoming) return;

    if (expiryTimerRef.current) window.clearTimeout(expiryTimerRef.current);

    if (incoming.isCancelled) {
      setOffer(null);
      return;
    }
    setOffer(incoming);

    const offeredAtMs = new Date(incoming.offeredAt).getTime();
    const endAtMs = offeredAtMs + (incoming.offerTtlSeconds || 15) * 1000;
    expiryTimerRef.current = window.setTimeout(() => setOffer(null), Math.max(0, endAtMs - Date.now()));
  }, [subData]);

  // Query latest assignment (keep card/route after accept)
  const {
    data: assignData,
    refetch: refetchAssignments,
    startPolling,
    stopPolling,
  } = useQuery(VEHICLE_ASSIGNMENT_QUERY, {
    variables: vehicleId == null ? undefined : { rescueVehicleId: vehicleId },
    skip: vehicleId == null,
    fetchPolicy: 'network-only',
  });

  // Sync accepted state from latest assignment (ignore cancelled/completed)
  useEffect(() => {
    const list = assignData?.assignments as
      | Array<{
          id: string | number; // assignment id
          rescueVehicleRequest?: {
            id: string | number;
            status?: string | null;
            latitude?: number | null;
            longitude?: number | null;
            address?: string | null;
            description?: string | null;
            proofImageURL?: string | null;
            emergencySubCategory?: { name?: string | null } | null;
          } | null;
        }>
      | undefined;

    if (!list?.length) return;

    const firstRow = list[0];
    const first = firstRow?.rescueVehicleRequest;
    if (!first || first.latitude == null || first.longitude == null) return;

    const st = (first.status || '').toLowerCase();
    if (st.includes('cancel') || st.includes('complete')) {
      // It's done — clear local state and stop directions
      setAcceptedAssignmentId(null);
      setAcceptedDest(null);
      setAcceptedRequest(null);
      return;
    }

    setAcceptedAssignmentId(Number(firstRow.id));
    setAcceptedDest({ lat: Number(first.latitude), lng: Number(first.longitude) });
    setAcceptedRequest({
      id: first.id,
      status: first.status ?? null,
      latitude: Number(first.latitude),
      longitude: Number(first.longitude),
      address: first.address ?? null,
      description: first.description ?? null,
      proofImageURL: first.proofImageURL ?? null,
      emergencySubCategory: first.emergencySubCategory ?? null,
    });
  }, [assignData]);

  // Poll while an assignment is active
  useEffect(() => {
    if (acceptedDest) startPolling?.(10_000);
    else stopPolling?.();
    return () => stopPolling?.();
  }, [acceptedDest, startPolling, stopPolling]);

  // Accept / Decline
  const [respond] = useMutation(RESPOND_TO_ASSIGNMENT_OFFER);
  const handleRespond = useCallback(
    async (accepted: boolean) => {
      if (!offer || vehicleId == null) return;

      const requestId = toInt(offer.request.id);
      const rvId = toInt(vehicleId);
      if (requestId == null || rvId == null) return;

      try {
        await respond({ variables: { input: { requestId, vehicleId: rvId, accepted } } });

        if (accepted) {
          // Show immediately (prevents flicker before refetch)
          setAcceptedDest({ lat: offer.request.latitude, lng: offer.request.longitude });
          setAcceptedRequest({
            id: offer.request.id,
            status: 'Dispatched',
            latitude: offer.request.latitude,
            longitude: offer.request.longitude,
            address: offer.request.address ?? null,
            description: offer.request.description ?? null,
            proofImageURL: offer.request.proofImageURL ?? null,
            emergencySubCategory: { name: offer.request.emergencySubCategory?.name ?? null },
          });
          setAcceptedAssignmentId(null);
        } else {
          setAcceptedDest(null);
          setAcceptedRequest(null);
          setAcceptedAssignmentId(null);
        }

        setOffer(null);

        if (accepted) {
          const res = await refetchAssignments();
          const firstRow = res?.data?.assignments?.[0];
          const first = firstRow?.rescueVehicleRequest;
          if (first && first.latitude != null && first.longitude != null) {
            const st = String(first.status || '').toLowerCase();
            if (!st.includes('cancel') && !st.includes('complete')) {
              setAcceptedDest({ lat: Number(first.latitude), lng: Number(first.longitude) });
              setAcceptedRequest({
                id: first.id,
                status: first.status ?? null,
                latitude: Number(first.latitude),
                longitude: Number(first.longitude),
                address: first.address ?? null,
                description: first.description ?? null,
                proofImageURL: first.proofImageURL ?? null,
                emergencySubCategory: first.emergencySubCategory ?? null,
              });
              if (firstRow?.id != null) setAcceptedAssignmentId(Number(firstRow.id));
            }
          }
        }
      } catch (e) {
        console.error('respondToAssignment failed', e);
      }
    },
    [offer, vehicleId, respond, refetchAssignments]
  );

  // Destination for the map
  const destination = useMemo(() => {
    if (offer) return { lat: offer.request.latitude, lng: offer.request.longitude };
    if (acceptedDest) return acceptedDest;
    return null;
  }, [offer, acceptedDest]);

  // Whether directions should be shown
  const isDone = useMemo(() => {
    const st = (acceptedRequest?.status ?? '').toLowerCase();
    return st.includes('complete') || st.includes('cancel');
  }, [acceptedRequest?.status]);
  const directionsActive = !!destination && !isDone;

  // Mutations: Arrived / Completed
  const [updateAssignment] = useMutation(UPDATE_RESCUE_VEHICLE_ASSIGNMENT);

  const markArrived = useCallback(async (): Promise<boolean> => {
    if (acceptedAssignmentId == null || !acceptedRequest) return false;

    try {
      await updateAssignment({
        variables: { id: acceptedAssignmentId, status: 'Arrived' },
        optimisticResponse: {
          updateRescueVehicleAssignment: {
            __typename: 'RescueVehicleAssignmentPayload',
            success: true,
            message: 'OK',
            rescueVehicleAssignment: {
              __typename: 'RescueVehicleAssignment',
              id: acceptedAssignmentId,
              status: 'Arrived',
              arrivalTime: new Date().toISOString(),
              departureTime: null,
              durationMinutes: null,
              rescueVehicleRequest: {
                __typename: 'RescueVehicleRequest',
                id: acceptedRequest.id,
                status: 'Arrived',
                createdAt: new Date().toISOString(),
              },
            },
          },
        },
      });

      // reflect locally
      setAcceptedRequest((prev) => (prev ? { ...prev, status: 'Arrived' } : prev));
      return true;
    } catch (e) {
      console.error('Update to Arrived failed', e);
      return false;
    }
  }, [acceptedAssignmentId, acceptedRequest, updateAssignment]);

  const markCompleted = useCallback(async (): Promise<boolean> => {
    if (acceptedAssignmentId == null || !acceptedRequest) return false;

    try {
      await updateAssignment({
        variables: { id: acceptedAssignmentId, status: 'Completed' },
        optimisticResponse: {
          updateRescueVehicleAssignment: {
            __typename: 'RescueVehicleAssignmentPayload',
            success: true,
            message: 'OK',
            rescueVehicleAssignment: {
              __typename: 'RescueVehicleAssignment',
              id: acceptedAssignmentId,
              status: 'Completed',
              arrivalTime: null,
              departureTime: new Date().toISOString(),
              durationMinutes: null,
              rescueVehicleRequest: {
                __typename: 'RescueVehicleRequest',
                id: acceptedRequest.id,
                status: 'Completed',
                createdAt: new Date().toISOString(),
              },
            },
          },
        },
      });

      // reflect locally and stop directions
      setAcceptedRequest((prev) => (prev ? { ...prev, status: 'Completed' } : prev));
      setAcceptedDest(null); // ensure directions hide immediately
      // Optionally, clear everything after a short delay:
      // setTimeout(() => { setAcceptedRequest(null); setAcceptedAssignmentId(null); }, 1500);
      return true;
    } catch (e) {
      console.error('Update to Completed failed', e);
      return false;
    }
  }, [acceptedAssignmentId, acceptedRequest, updateAssignment]);

  const offerKey = useMemo(
    () => (offer ? `${String(offer.request.id)}-${offer.offeredAt}` : 'none'),
    [offer]
  );

  return (
    <div className="relative min-h-[100dvh]">
      {vehicleId != null && (
        <LiveLocationMap
          rescueVehicleId={vehicleId}
          offer={destination}
          active={directionsActive} // ← hide directions when completed/cancelled
        />
      )}

      {/* Offer toast (accept/decline) */}
      <AssignmentOfferToast
        key={offerKey}
        offer={offer}
        onRespond={handleRespond}
        soundUrl="/alert.mp3"
      />

      {/* Accepted card: shows "Completed" after Arrived succeeds */}
      {acceptedRequest && (
        <AssignmentActiveCard
          request={acceptedRequest}
          onArrived={markArrived}
          onCompleted={markCompleted}
        />
      )}
    </div>
  );
}
