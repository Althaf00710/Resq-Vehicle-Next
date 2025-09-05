// components-page/home/AssignmentActiveCard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';

type RequestLike = {
  id: string | number;
  address?: string | null;
  latitude: number;
  longitude: number;
  description?: string | null;
  proofImageURL?: string | null;
  emergencySubCategory?: { name?: string | null } | null;
  status?: string | null; // optional: if provided, we reflect it
};

type Props = {
  request: RequestLike | null;
  /** Return true if status was updated to Arrived successfully */
  onArrived: () => boolean | Promise<boolean>;
  /** Optional: called when user taps "Completed" after Arrived */
  onCompleted?: () => void | Promise<void>;
  className?: string;
};

function resolveImageUrl(u?: string | null) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u; // absolute already
  const base = (process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '');
  const path = u.replace(/^\/+/, '');
  return `${base}/${path}`;
}

export default function AssignmentActiveCard({
  request,
  onArrived,
  onCompleted,
  className = '',
}: Props) {
  if (!request) return null;

  // Reflect "Arrived" either from the incoming status prop or from a successful click
  const [arrived, setArrived] = useState<boolean>(() =>
    /arriv/i.test(request.status ?? '')
  );
  const [arriving, setArriving] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Keep local "arrived" in sync if parent updates status later
  useEffect(() => {
    const isArrived = /arriv/i.test(request.status ?? '');
    setArrived(isArrived);
  }, [request.status]);

  const address = request.address ?? '';
  const lat = Number(request.latitude);
  const lng = Number(request.longitude);
  const desc = request.description ?? '';
  const imgSrc = resolveImageUrl(request.proofImageURL);
  const catName = request.emergencySubCategory?.name ?? null;

  const idText = useMemo(() => `#${String(request.id)}`, [request.id]);

  const handleArrivedClick = async () => {
    if (arriving || arrived) return;
    setArriving(true);
    try {
      const ok = await Promise.resolve(onArrived());
      if (ok) setArrived(true);
    } catch {
      // ignore — parent can show a toast/snackbar
    } finally {
      setArriving(false);
    }
  };

  const handleCompletedClick = async () => {
    if (!onCompleted || completing) return;
    setCompleting(true);
    try {
      await Promise.resolve(onCompleted());
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div
      className={[
        'fixed right-4 bottom-1/3 z-50 w-full max-w-md transform transition-all',
        'translate-x-0 opacity-100',
        className,
      ].join(' ')}
      aria-live="polite"
    >
      <div className="rounded-2xl shadow-lg bg-white text-gray-900 dark:bg-neutral-900 dark:text-white overflow-hidden ring-1 ring-black/10 dark:ring-white/10">
        {/* Header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">ResQ Assignment</h3>
            <span className="text-xs text-gray-500 dark:text-neutral-400">{idText}</span>
          </div>
          {request.status && (
            <div className="mt-1 text-xs text-gray-500 dark:text-neutral-400">
              Status: <span className="font-medium">{request.status}</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="px-5 pb-4 text-sm space-y-1">
          {catName && (
            <div className="truncate">
              <span className="font-medium">Emergency:</span> {catName}
            </div>
          )}
          {!!address && (
            <div className="truncate">
              <span className="font-medium">Location:</span> {address}
            </div>
          )}
          <div>
            <span className="font-medium">Coords:</span> {lat.toFixed(5)}, {lng.toFixed(5)}
          </div>
          {!!desc && (
            <div className="mt-1">
              <span className="font-medium">Details:</span> {desc}
            </div>
          )}
          {!!imgSrc && (
            <div className="mt-2">
              <span className="font-medium">Proof:</span>
              <div className="mt-1">
                <Image
                  src={imgSrc}
                  alt="Proof"
                  width={640}
                  height={480}
                  unoptimized
                  className="rounded-lg max-h-40 w-auto object-contain border border-black/10 dark:border-white/10"
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 flex items-center gap-3">
          <button
            onClick={handleArrivedClick}
            disabled={arriving || arrived}
            className={[
              'flex-1 rounded-xl px-4 py-2 font-medium text-white transition-colors',
              arrived
                ? 'bg-green-600 cursor-default'
                : 'bg-orange-500 hover:bg-orange-700',
              arriving ? 'opacity-70' : '',
            ].join(' ')}
          >
            {arrived ? 'Arrived' : arriving ? 'Marking…' : 'Destination Arrived'}
          </button>

          {/* Show "Completed" ONLY after Arrived succeeds */}
          {arrived && (
            <button
              onClick={handleCompletedClick}
              disabled={!onCompleted || completing}
              className={[
                'flex-1 rounded-xl px-4 py-2 font-medium text-white transition-colors',
                onCompleted ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400 cursor-not-allowed',
                completing ? 'opacity-70' : '',
              ].join(' ')}
              title={onCompleted ? '' : 'Missing onCompleted handler'}
            >
              {completing ? 'Completing…' : 'Completed'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
