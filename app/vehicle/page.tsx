// app/(whatever)/vehicle/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useSubscription } from '@apollo/client';
import { useRouter } from 'next/navigation';

import { ASSIGNMENT_SUBSCRIPTION } from '@/graphql/subscriptions/AssignmentSubscription';
import { RESPOND_TO_ASSIGNMENT_OFFER } from '@/graphql/mutations/AssignmentMutations';
import AssignmentOfferToast from '@/components-page/home/AssignmentOfferToast';
import LiveLocationMap from '@/components-page/home/LiveLocationMap';
import type { Offer } from '@/graphql/types/assignment';

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

export default function VehicleHomePage() {
  const router = useRouter();
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const expiryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const id = getVehicleIdFromStorage();
    if (id == null) {
      router.replace('/vehicle/login');
      return;
    }
    setVehicleId(id);
  }, [router]);

  const { data } = useSubscription(ASSIGNMENT_SUBSCRIPTION, {
    variables: vehicleId == null ? undefined : { vehicleId },
    skip: vehicleId == null,
    shouldResubscribe: true,
  });

  useEffect(() => {
    const incoming = data?.onVehicleAssignmentOffered as Offer | undefined;
    if (!incoming) return;

    if (expiryTimerRef.current) window.clearTimeout(expiryTimerRef.current);

    if (incoming.isCancelled) {
      setOffer(null);
      return;
    }

    setOffer(incoming);

    const offeredAtMs = new Date(incoming.offeredAt).getTime();
    const endAtMs = offeredAtMs + (incoming.offerTtlSeconds || 15) * 1000;

    expiryTimerRef.current = window.setTimeout(() => {
      setOffer(null);
    }, Math.max(0, endAtMs - Date.now()));
  }, [data]);

  const [respond] = useMutation(RESPOND_TO_ASSIGNMENT_OFFER);
  const handleRespond = async (accepted: boolean) => {
    if (!offer || vehicleId == null) return;

    const requestId = toInt(offer.request.id);
    const rvId = toInt(vehicleId);

    if (requestId == null || rvId == null) {
      console.error('Invalid ids for respondToAssignment', { requestId: offer.request.id, vehicleId });
      return;
    }

    try {
      await respond({
        variables: { input: { requestId, vehicleId: rvId, accepted } },
      });
      setOffer(null);
    } catch (e) {
      console.error('respondToAssignment failed', e);
    }
  };

  const offerKey = useMemo(
    () => (offer ? `${String(offer.request.id)}-${offer.offeredAt}` : 'none'),
    [offer]
  );

  return (
    <div>
      {vehicleId != null && (
        <LiveLocationMap
          rescueVehicleId={vehicleId}
          offer={offer ? { lat: offer.request.latitude, lng: offer.request.longitude } : null}
          active={!!offer}
        />
      )}
      <AssignmentOfferToast
        key={offerKey}
        offer={offer}
        onRespond={handleRespond}
        soundUrl="/alert.mp3"
      />
    </div>
  );
}
