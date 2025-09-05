'use client';

import { useState, useEffect, useMemo  } from 'react';
import Image from 'next/image';
import {
  HeartPulse,
  MapPin,
  Navigation,
  FileImage,
  User as UserIcon,
  Phone as PhoneIcon,
  Route,
  BadgeCheck,
} from 'lucide-react';

type RequestLike = {
  id: string | number;
  address?: string | null;
  latitude: number;
  longitude: number;
  description?: string | null;
  proofImageURL?: string | null;
  emergencySubCategory?: { name?: string | null } | null;
  status?: string | null;

  // NEW (optional) – shown if present
  civilianId?: number | string | null;
  civilian?: { name?: string | null; phoneNumber?: string | null } | null;
};

type Props = {
  request: RequestLike | null;
  /** Return true if status was updated to Arrived successfully */
  onArrived: () => boolean | Promise<boolean>;
  /** Called when user taps "Completed" after Arrived */
  onCompleted?: () => void | Promise<void>;
  className?: string;
};

function resolveImageUrl(u?: string | null) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const base = (process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '');
  const path = u.replace(/^\/+/, '');
  return `${base}/${path}`;
}

function Row({
  icon,
  children,
  className = '',
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2 text-sm ${className}`}>
      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function AssignmentActiveCard({
  request,
  onArrived,
  onCompleted,
  className = '',
}: Props) {
  if (!request) return null;

  const [arrived, setArrived] = useState<boolean>(() =>
    /arriv/i.test(request.status ?? '')
  );
  const [arriving, setArriving] = useState(false);
  const [completing, setCompleting] = useState(false);

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

  const civilianName = request.civilian?.name ?? null;
  const phoneNumber = request.civilian?.phoneNumber ?? null;

  const idText = useMemo(() => `#${String(request.id)}`, [request.id]);

  const handleArrivedClick = async () => {
    if (arriving || arrived) return;
    setArriving(true);
    try {
      const ok = await Promise.resolve(onArrived());
      if (ok) setArrived(true);
    } catch {
      /* parent can toast error */
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
      <div className="overflow-hidden rounded-2xl bg-white text-gray-900 shadow-lg ring-1 ring-black/10 dark:bg-neutral-900 dark:text-white dark:ring-white/10">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500/90 to-cyan-500/90 px-5 pt-4 pb-3 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Active Assignment</h3>
            <span className="text-xs font-semibold opacity-95">{idText}</span>
          </div>
          {request.status && (
            <div className="mt-1 text-[11px] opacity-90">
              Status: <span className="font-semibold">{request.status}</span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-2 px-5 py-4">
          {catName && (
            <Row icon={<HeartPulse className="h-4 w-4" />}>
              <span className="font-medium">Emergency:</span> <span className="ml-1">{catName}</span>
            </Row>
          )}
          {!!address && (
            <Row icon={<MapPin className="h-4 w-4" />}>
              <span className="font-medium">Location:</span>{' '}
              <span className="ml-1 line-clamp-2">{address}</span>
            </Row>
          )}
          <Row icon={<Navigation className="h-4 w-4" />}>
            <span className="font-medium">Coords:</span>{' '}
            <span className="ml-1">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
          </Row>
          {!!desc && (
            <Row icon={<FileImage className="invisible h-4 w-4" />}>
              <span className="font-medium">Details:</span> <span className="ml-1">{desc}</span>
            </Row>
          )}

          {/* Civilian (optional) */}
          {civilianName && (
            <Row icon={<UserIcon className="h-4 w-4" />}>
              <span className="font-medium">Civilian:</span> <span className="ml-1">{civilianName}</span>
            </Row>
          )}
          {phoneNumber && (
            <Row icon={<PhoneIcon className="h-4 w-4" />}>
              <span className="font-medium">Phone:</span>{' '}
              <a className="ml-1 underline decoration-dotted" href={`tel:${phoneNumber}`}>{phoneNumber}</a>
            </Row>
          )}

          {!!imgSrc && (
            <div className="pt-1">
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <FileImage className="h-4 w-4" />
                Proof
              </div>
              <Image
                src={imgSrc}
                alt="Proof"
                width={640}
                height={480}
                unoptimized
                className="max-h-40 w-auto rounded-lg border border-black/10 object-contain dark:border-white/10"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-5 pb-4">
          {/* If not arrived yet, show ONLY the Arrived button */}
          {!arrived && (
            <button
              onClick={handleArrivedClick}
              disabled={arriving}
              className={[
                'flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold text-white transition-colors',
                'bg-orange-500 hover:bg-orange-600',
                arriving ? 'opacity-70' : '',
              ].join(' ')}
            >
              <Route className="h-5 w-5" />
              {arriving ? 'Marking…' : 'Destination Arrived'}
            </button>
          )}

          {/* After Arrived succeeds, hide Arrived button and show ONLY Completed */}
          {arrived && (
            <button
              onClick={handleCompletedClick}
              disabled={!onCompleted || completing}
              className={[
                'flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold text-white transition-colors',
                onCompleted ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-400 cursor-not-allowed',
                completing ? 'opacity-70' : '',
              ].join(' ')}
              title={onCompleted ? '' : 'Missing onCompleted handler'}
            >
              <BadgeCheck className="h-5 w-5" />
              {completing ? 'Completing…' : 'Completed'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
