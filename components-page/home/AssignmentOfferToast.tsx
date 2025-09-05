'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  HeartPulse,
  MapPin,
  Navigation,
  FileImage,
  User as UserIcon,
  Phone as PhoneIcon,
  CheckCircle2,
  XCircle,
  AlarmClock,
} from 'lucide-react';
import type { Offer } from '@/graphql/types/assignment';

type Props = {
  offer: Offer | null;
  onRespond: (accepted: boolean) => void | Promise<void>;
  soundUrl?: string;
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
    <div className={`flex items-start gap-2 text-[13px] ${className}`}>
      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function AssignmentOfferToast({ offer, onRespond, soundUrl }: Props) {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const hideTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);
  const lastSoundKeyRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = async () => {
    if (!offer || offer.isCancelled) return;
    if (soundUrl && audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      } catch {
        /* autoplay blocked, ignore */
      }
    }
  };

  useEffect(() => {
    if (!offer || offer.isCancelled) {
      setVisible(false);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (tickTimer.current) window.clearInterval(tickTimer.current);
      return;
    }

    const key = `${offer.request.id}-${offer.offeredAt}`;
    if (lastSoundKeyRef.current !== key) {
      lastSoundKeyRef.current = key;
      void playSound();
    }

    const ttl = Number(offer.offerTtlSeconds || 15);
    const offeredAtMs = new Date(offer.offeredAt).getTime();
    const endAtMs = offeredAtMs + ttl * 1000;

    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (tickTimer.current) window.clearInterval(tickTimer.current);

    setVisible(true);

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((endAtMs - now) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        setVisible(false);
        if (tickTimer.current) window.clearInterval(tickTimer.current);
      }
    };
    tick();
    tickTimer.current = window.setInterval(tick, 250);
    hideTimer.current = window.setTimeout(() => setVisible(false), Math.max(0, endAtMs - Date.now()));

    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (tickTimer.current) window.clearInterval(tickTimer.current);
    };
  }, [offer, soundUrl]);

  const percentLeft = useMemo(() => {
    if (!offer?.offerTtlSeconds) return 0;
    return Math.max(0, Math.min(100, (secondsLeft / offer.offerTtlSeconds) * 100));
  }, [secondsLeft, offer?.offerTtlSeconds]);

  const slideClass = visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0';
  if (!offer || offer.isCancelled) return null;

  const { request } = offer;
  const address = request.address;
  const lat = request.latitude;
  const lng = request.longitude;
  const desc = request.description;
  const imgSrc = resolveImageUrl(request.proofImageURL);
  const catName = request.emergencySubCategory?.name ?? null;

  const civilianName = request.civilian?.name ?? null;
  const phoneNumber = request.civilian?.phoneNumber ?? null;

  return (
    <div
      className={`fixed right-4 bottom-1/3 z-50 w-full max-w-md transform transition-all duration-300 ${slideClass}`}
      aria-live="polite"
    >
      {/* Hidden audio element for custom sound */}
      {soundUrl && (
        <audio ref={audioRef} preload="auto">
          <source src={soundUrl} type="audio/mpeg" />
        </audio>
      )}

      <div className="overflow-hidden rounded-2xl bg-white text-gray-900 shadow-lg ring-1 ring-black/10 dark:bg-neutral-900 dark:text-white dark:ring-white/10">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500/90 to-amber-400/90 px-5 pt-4 pb-3 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-wide">Emergency Offer</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
              <AlarmClock className="h-4 w-4" />
              {secondsLeft}s
            </span>
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/30">
            <div
              className="h-1 rounded-full bg-white transition-all duration-250"
              style={{ width: `${percentLeft}%` }}
            />
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 px-5 py-4 text-sm">
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
            <div className="mt-2">
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

          <div className="pt-1 text-xs text-slate-500 dark:text-neutral-400">
            Offer valid {offer.offerTtlSeconds}s from server time.
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 px-5 pb-4">
          <button
            onClick={() => onRespond(true)}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-5 w-5" />
            Accept
          </button>
          <button
            onClick={() => onRespond(false)}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            <XCircle className="h-5 w-5" />
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
