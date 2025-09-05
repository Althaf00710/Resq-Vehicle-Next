// app/(whatever)/vehicle/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useMutation, useSubscription, useQuery } from '@apollo/client';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { ScanLine, ScanBarcode, Ambulance as AmbulanceIcon, CarFront } from 'lucide-react';

import { ASSIGNMENT_SUBSCRIPTION } from '@/graphql/subscriptions/AssignmentSubscription';
import {
  RESPOND_TO_ASSIGNMENT_OFFER,
  UPDATE_RESCUE_VEHICLE_ASSIGNMENT,
} from '@/graphql/mutations/AssignmentMutations';
import { VEHICLE_ASSIGNMENT_QUERY } from '@/graphql/queries/vehicleAssignment';

import AssignmentOfferToast from '@/components-page/home/AssignmentOfferToast';
import AssignmentActiveCard from '@/components-page/home/AssignmentActiveCard';
import type { Offer } from '@/graphql/types/assignment';

// Load Maps client-side only
const LiveLocationMap = dynamic(() => import('@/components-page/home/LiveLocationMap'), { ssr: false });

/* -------------------- LocalStorage helpers -------------------- */

const RV_INFO_KEY = 'resq.rv.info';
type StoredRV = {
  id?: number | string;
  rescueVehicleId?: number | string;
  vehicleId?: number | string;
  code?: string;
  plateNumber?: string;
  rescueVehicleCategory?: { name?: string | null } | null;
};

// tolerant parse (handles numbers/strings)
function toInt(v: unknown): number | null {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function readRVInfo(): { id: number | null; code?: string; plate?: string; category?: string } {
  try {
    const raw = localStorage.getItem(RV_INFO_KEY);
    if (!raw) return { id: null };
    const obj: StoredRV = JSON.parse(raw);

    const idRaw = obj.id ?? obj.rescueVehicleId ?? obj.vehicleId;
    const id = toInt(idRaw);

    return {
      id,
      code: obj.code ?? undefined,
      plate: obj.plateNumber ?? undefined,
      category: obj.rescueVehicleCategory?.name ?? undefined,
    };
  } catch {
    return { id: null };
  }
}

function getVehicleIdFromStorage(): number | null {
  return readRVInfo().id;
}

/* -------------------- Page -------------------- */

type RequestLike = {
  id: string | number;
  address?: string | null;
  latitude: number;
  longitude: number;
  description?: string | null;
  proofImageURL?: string | null;
  emergencySubCategory?: { name?: string | null } | null;
  status?: string | null;
  civilianId?: number | string | null;
  civilian?: { name?: string | null; phoneNumber?: string | null } | null;
};

export default function VehicleHomePage() {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState<number | null>(null);

  // Top-left overlay info from LS
  const [rvCode, setRvCode] = useState<string | undefined>(undefined);
  const [rvPlate, setRvPlate] = useState<string | undefined>(undefined);
  const [rvCategory, setRvCategory] = useState<string | undefined>(undefined);

  // Live offer + accepted assignment state
  const [offer, setOffer] = useState<Offer | null>(null);
  const [acceptedDest, setAcceptedDest] = useState<{ lat: number; lng: number } | null>(null);
  const [acceptedRequest, setAcceptedRequest] = useState<RequestLike | null>(null);
  const [acceptedAssignmentId, setAcceptedAssignmentId] = useState<number | null>(null);

  const expiryTimerRef = useRef<number | null>(null);

  /* ------------ Bootstrap from localStorage (id + overlay fields) ------------ */

  useEffect(() => {
    const { id, code, plate, category } = readRVInfo();
    if (id == null) {
      router.replace('/vehicle/login');
      return;
    }
    setVehicleId(id);
    setRvCode(code);
    setRvPlate(plate);
    setRvCategory(category);

    // keep overlay in sync if LS changes (e.g., different login)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== RV_INFO_KEY) return;
      const next = readRVInfo();
      setVehicleId(next.id);
      setRvCode(next.code);
      setRvPlate(next.plate);
      setRvCategory(next.category);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [router]);

  /* -------------------- Live assignment offers -------------------- */

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
    expiryTimerRef.current = window.setTimeout(
      () => setOffer(null),
      Math.max(0, endAtMs - Date.now())
    );
  }, [subData]);

  /* -------------------- Query current assignment -------------------- */

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

  useEffect(() => {
    const list = assignData?.assignments as
      | Array<{
          id: string | number;
          rescueVehicleRequest?: {
            id: string | number;
            status?: string | null;
            latitude?: number | null;
            longitude?: number | null;
            address?: string | null;
            description?: string | null;
            proofImageURL?: string | null;
            emergencySubCategory?: { name?: string | null } | null;
            civilianId?: number | string | null;
            civilian?: { name?: string | null; phoneNumber?: string | null } | null;
          } | null;
        }>
      | undefined;

    if (!list?.length) return;

    const firstRow = list[0];
    const first = firstRow?.rescueVehicleRequest;
    if (!first || first.latitude == null || first.longitude == null) return;

    const st = (first.status || '').toLowerCase();
    if (st.includes('cancel') || st.includes('complete')) {
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
      civilianId: (first as any)?.civilianId ?? null,
      civilian: (first as any)?.civilian ?? null,
    });
  }, [assignData]);

  useEffect(() => {
    if (acceptedDest) startPolling?.(10_000);
    else stopPolling?.();
    return () => stopPolling?.();
  }, [acceptedDest, startPolling, stopPolling]);

  /* -------------------- Accept / Decline -------------------- */

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
          // prefill using subscription (now includes civilian fields)
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
            civilianId: offer.request.civilianId ?? null,
            civilian: offer.request.civilian ?? null,
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
                civilianId: (first as any)?.civilianId ?? null,
                civilian: (first as any)?.civilian ?? null,
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

  /* -------------------- Map destination & state -------------------- */

  const destination = useMemo(() => {
    if (offer) return { lat: offer.request.latitude, lng: offer.request.longitude };
    if (acceptedDest) return acceptedDest;
    return null;
  }, [offer, acceptedDest]);

  const isDone = useMemo(() => {
    const st = (acceptedRequest?.status ?? '').toLowerCase();
    return st.includes('complete') || st.includes('cancel');
  }, [acceptedRequest?.status]);

  const directionsActive = !!destination && !isDone;

  /* -------------------- Mutations: Arrived / Completed -------------------- */

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

      setAcceptedRequest((prev) => (prev ? { ...prev, status: 'Completed' } : prev));
      setAcceptedDest(null); // hide directions immediately
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

  /* -------------------- UI -------------------- */

  const CategoryIcon = (rvCategory || '').toLowerCase().includes('ambulance')
    ? AmbulanceIcon
    : CarFront;

  return (
    <div className="relative min-h-[100dvh]">
      {/* Top-left overlay: App logo + vehicle details */}
      <div className="pointer-events-none fixed left-4 top-4 z-[101] flex flex-col items-start gap-3">
        <div className="pointer-events-auto p-2">
          <Image
            src="/images/App_Logo.png"
            alt="ResQ"
            width={120}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </div>

        <div className="pointer-events-auto rounded-2xl bg-white/85 p-3 text-sm shadow ring-1 ring-black/10 backdrop-blur-md dark:bg-slate-900/80 dark:text-slate-100 dark:ring-white/10">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            {/* <span className="font-medium">Code:</span> */}
            <span className="ml-1">{rvCode ?? '—'}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <ScanBarcode className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            {/* <span className="font-medium">Plate:</span> */}
            <span className="ml-1">{rvPlate ?? '—'}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <CategoryIcon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            {/* <span className="font-medium">Category:</span> */}
            <span className="ml-1 text-blue-500">{rvCategory ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Map */}
      {vehicleId != null && (
        <LiveLocationMap rescueVehicleId={vehicleId} offer={destination} active={directionsActive} />
      )}

      {/* Offer toast */}
      <AssignmentOfferToast key={offerKey} offer={offer} onRespond={handleRespond} soundUrl="/alert.mp3" />

      {/* Active assignment card */}
      {acceptedRequest && (
        <AssignmentActiveCard request={acceptedRequest} onArrived={markArrived} onCompleted={markCompleted} />
      )}
    </div>
  );
}
