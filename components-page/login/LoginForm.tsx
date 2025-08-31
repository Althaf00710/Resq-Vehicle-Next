'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Car, Hash, Lock } from 'lucide-react';

type LoginResult =
  | void
  | boolean
  | { success: boolean; message?: string };

type Props = {
  onLogin?: (v: { numberPlate: string; password: string }) => LoginResult | Promise<LoginResult>;
  imageSrc?: string; // left illustration
  title?: string;
};

export default function VehicleLogin({
  onLogin,
  imageSrc = '/images/App_Logo.png', // replace with your asset
  title = 'Vehicle Login',
}: Props) {
  const [numberPlate, setNumberPlate] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = numberPlate.trim().length > 0 && password.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await onLogin?.({ numberPlate: numberPlate.trim(), password });

      // Interpret result
      let success = true;
      let message: string | undefined;

      if (typeof res === 'boolean') {
        success = res;
      } else if (typeof res === 'object' && res !== null) {
        success = (res as any).success !== false;
        message = (res as any).message;
      } // undefined/void => assume success

      if (!success) {
        setError(message || 'Wrong credentials');
      }
    } catch (err: any) {
      setError(err?.message || 'Wrong credentials');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="p-16 w-3/4 grid md:grid-cols-2 bg-white/65 backdrop-blur-lg rounded-lg shadow-lg overflow-hidden">
      {/* Left: illustration with floating shapes */}
      <section className="relative hidden md:grid place-items-center">
        <div className="relative w-[380px] h-[380px]">
          {/* Image */}
          <div className="absolute inset-10 grid place-items-center">
            <Image
              src={imageSrc}
              alt="Illustration"
              fill
              priority
              className="object-contain p-8"
            />
          </div>

          {/* Floating shapes */}
          <span className="shape circle" style={{ left: '-14px', top: '24%' }} />
          <span className="shape square" style={{ left: '12%', top: '8%' }} />
          <span className="shape triangle" style={{ left: '84%', top: '16%' }} />
          <span className="shape circle small" style={{ left: '92%', top: '58%' }} />
          <span className="shape square small" style={{ left: '6%', top: '72%' }} />
          <span className="shape triangle small" style={{ left: '78%', top: '84%' }} />
        </div>
      </section>

      {/* Right: form */}
      <section className="flex items-center justify-center p-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm space-y-6"
          aria-label="Vehicle Login Form"
          autoComplete="off"
        >
          <h1 className="text-2xl font-semibold text-center">{title}</h1>

          {/* Number Plate */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Hash className="h-4 w-4 text-neutral-500" />
            </div>
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Number Plate Number"
              className="w-full rounded-full bg-neutral-100 px-10 py-3 text-sm outline-none ring-1 ring-transparent focus:bg-neutral-50 focus:ring-neutral-300"
              value={numberPlate}
              onChange={(e) => setNumberPlate(e.target.value.toUpperCase())}
              aria-label="Number Plate Number"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Lock className="h-4 w-4 text-neutral-500" />
            </div>
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-full bg-neutral-100 px-10 py-3 text-sm outline-none ring-1 ring-transparent focus:bg-neutral-50 focus:ring-neutral-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password"
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            <Car className="h-4 w-4" />
            {submitting ? 'Logging in…' : 'LOGIN'}
          </button>
        </form>
      </section>

      {/* Styles for shapes & motion */}
      <style jsx>{`
        .shape {
          position: absolute;
          opacity: 0.9;
          animation: float 6s ease-in-out infinite;
          filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.08));
        }
        .shape.small {
          transform: scale(0.75);
          animation-duration: 7.5s;
        }
        .circle {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #3b82f6;
        }
        .square {
          width: 14px;
          height: 14px;
          background: #22c55e;
          transform: rotate(12deg);
          animation-name: float, spin-slow;
          animation-duration: 6.5s, 12s;
          animation-iteration-count: infinite, infinite;
          animation-timing-function: ease-in-out, linear;
        }
        .triangle {
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-bottom: 18px solid #a855f7;
          animation-name: float, spin-slow;
          animation-duration: 7s, 10s;
          animation-iteration-count: infinite, infinite;
          animation-timing-function: ease-in-out, linear;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .shape { animation: none !important; }
        }
      `}</style>
    </main>
  );
}
