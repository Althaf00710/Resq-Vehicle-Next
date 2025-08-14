'use client'
import LiveLocationMap from "@/components-page/home/LiveLocationMap"

export default function Home() {
  const myVehicleId = 1;
  return (
    <div>
      <LiveLocationMap rescueVehicleId={myVehicleId}/>
    </div>
  )
}