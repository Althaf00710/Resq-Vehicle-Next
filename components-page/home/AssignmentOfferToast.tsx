'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import type { Offer } from '@/graphql/types/assignment';

type Props = {
  offer: Offer | null;
  onRespond: (accepted: boolean) => void | Promise<void>;
  soundUrl?: string;
};

function resolveImageUrl(u?: string | null) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u; // already absolute
  const base = (process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '');
  const path = u.replace(/^\/+/, '');
  return `${base}/${path}`;
}

export default function AssignmentOfferToast({ offer, onRespond, soundUrl }: Props) {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const hideTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);
  const lastSoundKeyRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = async () => {
    if (!offer || offer.isCancelled) return; // no sound on cancel
    if (soundUrl && audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        return;
      } catch {
        // ignore autoplay block
      }
    }
  };

  // Re-show + restart countdown when offer changes
  useEffect(() => {
    if (!offer || offer.isCancelled) {
      // hide immediately if no offer OR cancelled
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

  const address = offer.request.address;
  const lat = offer.request.latitude;
  const lng = offer.request.longitude;
  const desc = offer.request.description;
  const imgSrc = resolveImageUrl(offer.request.proofImageURL);
  const catName = offer.request.emergencySubCategory?.name ?? null;

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

      <div className="rounded-2xl shadow-lg bg-white text-gray-900 dark:bg-neutral-900 dark:text-white overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">ResQ Request</h3>
            <span className="text-sm tabular-nums">{secondsLeft}s</span>
          </div>
          <div className="mt-3 h-1 w-full bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-1 bg-blue-600 dark:bg-blue-500 transition-all duration-250"
              style={{ width: `${percentLeft}%` }}
            />
          </div>
        </div>

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
          <div className="text-xs text-gray-500 mt-1">Offer valid {offer.offerTtlSeconds}s from server time.</div>
        </div>

        <div className="px-5 pb-4 flex items-center gap-3">
          <button
            onClick={() => onRespond(true)}
            className="flex-1 rounded-xl px-4 py-2 font-medium bg-green-500 text-white hover:bg-green-700"
          >
            Accept
          </button>
          <button
            onClick={() => onRespond(false)}
            className="flex-1 rounded-xl px-4 py-2 font-medium bg-red-600 text-white hover:bg-red-700"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
