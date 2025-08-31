'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const RV_JWT_KEY = 'resq.rv.jwt';

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(RV_JWT_KEY);
    if (!token) router.replace('/auth/login');
    else setOk(true);
  }, [router]);

  if (!ok) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-gray-500">
        Redirecting…
      </div>
    );
  }
  return <>{children}</>;
}
