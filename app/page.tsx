'use client';

import React, { useState } from 'react';
import AssignmentOfferToast, { Offer } from '@/components-page/home/AssignmentOfferToast';

function makeDummyOffer(partial?: Partial<Offer>): Offer {
  return {
    requestId: Math.floor(100 + Math.random() * 900), // random id to simulate new offers
    vehicleId: 1,
    location: 'Teaching Hospital, Jaffna',
    latitude: 9.6615,
    longitude: 80.0255,
    offerTtlSeconds: partial?.offerTtlSeconds ?? 15,
    offeredAt: new Date().toISOString(), // important: new timestamp so the toast restarts
    ...partial,
  };
}

export default function Page() {
  const [offer, setOffer] = useState<Offer | null>(null);

  const onRespond = async (accepted: boolean) => {
    console.log('Driver responded:', { accepted, offer });
    setOffer(null); // hide after responding
  };

  return (
    <div className="p-4 space-x-2">
      <button
        onClick={() => setOffer(makeDummyOffer())}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Send 15s Offer
      </button>

      <button
        onClick={() => setOffer(makeDummyOffer({ offerTtlSeconds: 5 }))}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
      >
        Send 5s Offer
      </button>

      <button
        onClick={() => setOffer(makeDummyOffer({ requestId: 777 }))}
        className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
      >
        Send Another Offer (new id)
      </button>

      <button
        onClick={() => setOffer(null)}
        className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
      >
        Clear
      </button>

      {/* The toast itself (UI-only) */}
      <AssignmentOfferToast offer={offer} onRespond={onRespond} />
    </div>
  );
}
