'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import VantaCloudsBackground from '@/components-page/login/LoginBG';
import VehicleLogin from '@/components-page/login/LoginForm';
import { LOGIN_RESCUE_VEHICLE } from '@/graphql/mutations/rescueVehicleMutations';

const RV_JWT_KEY  = 'resq.rv.jwt';
const RV_INFO_KEY = 'resq.rv.info';

type LoginArgs = { numberPlate: string; password: string };

type LoginRescueVehicleResp = {
  loginRescueVehicle: {
    success: boolean;
    message: string; // contains JWT on success
    rescueVehicle?: {
      id: string;
      code: string;
      plateNumber: string;
      rescueVehicleCategory?: { name: string } | null;
    } | null;
  };
};

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem(RV_JWT_KEY);
    if (token) router.replace('/vehicle'); // or /home
  }, [router]);
  
  const [doLogin] = useMutation<LoginRescueVehicleResp>(LOGIN_RESCUE_VEHICLE);

  const handleLogin = async ({ numberPlate, password }: LoginArgs) => {
    const { data } = await doLogin({
      variables: { plateNumber: numberPlate, password },
    });

    const payload = data?.loginRescueVehicle;
    if (!payload) throw new Error('No response from server.');
    if (!payload.success) throw new Error(payload.message || 'Login failed.');

    const jwt = payload.message; // backend sends JWT in `message`
    const rv  = payload.rescueVehicle;

    if (!jwt || !rv) throw new Error('Malformed login response.');

    // Persist
    localStorage.setItem(RV_JWT_KEY, jwt);
    localStorage.setItem(RV_INFO_KEY, JSON.stringify(rv));

    // Go to your vehicle area (change path as needed)
    router.push('/vehicle');
  };

  return (
    <div>
      <VantaCloudsBackground
        className="fixed inset-0 -z-10"
        options={{ skyColor: 0x87ceeb, cloudColor: 0xffffff }}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <VehicleLogin
          title="Vehicle Login"
          onLogin={handleLogin}
          imageSrc="/images/App_Logo.png"
        />
      </div>
    </div>
  );
}
