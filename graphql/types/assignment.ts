export type respondToAssignment = {
    input : {
        requestId: number,
        vehicleId: number,
        accepted: boolean
    };
}

export type Offer = {
  request: {
    id: number | string;
    address: string;
    createdAt: string;
    description?: string | null;
    emergencySubCategoryId: number;
    latitude: number;
    longitude: number;
    proofImageURL?: string | null;
    emergencySubCategory?: { name?: string | null } | null;
  };
  isCancelled: boolean;
  offeredAt: string;         // ISO string from server
  offerTtlSeconds: number;   // TTL in seconds
};