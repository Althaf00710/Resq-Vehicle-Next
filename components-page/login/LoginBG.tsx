// components/VantaCloudsBackground.tsx
'use client';

import React, { useEffect, useRef, useState, PropsWithChildren } from 'react';
import * as THREE from 'three';

type VantaOptions = Partial<{
  el: HTMLElement | null;
  THREE: typeof THREE;
  mouseControls: boolean;
  touchControls: boolean;
  gyroControls: boolean;
  minHeight: number;
  minWidth: number;
  skyColor: number;
  cloudColor: number;
  cloudShadowColor: number;
  sunColor: number;
  sunGlareColor: number;
  sunlightColor: number;
}>;

type Props = PropsWithChildren<{
  className?: string;
  options?: VantaOptions;
}>;

export default function VantaCloudsBackground({ className, options, children }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [effect, setEffect] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const CLOUDS = (await import('vanta/dist/vanta.clouds.min')).default;
      if (cancelled || effect || !containerRef.current) return;

      const instance = CLOUDS({
        el: containerRef.current,
        THREE,
        // sensible defaults (from your snippet)
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        ...(options || {}),
      });

      if (!cancelled) setEffect(instance);
    })();

    return () => {
      cancelled = true;
      try { effect?.destroy?.(); } catch {}
    };
    // Re-init if options object identity changes
  }, [options, effect]);

  return (
    <div
      ref={containerRef}
      className={className ?? 'fixed inset-0 -z-10'}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Anything you render as children sits above the background */}
      {children}
    </div>
  );
}
