import { gql } from "@apollo/client";

export const ASSIGNMENT_SUBSCRIPTION = gql`
subscription AssignmentOffered($vehicleId: Int!) {
  onVehicleAssignmentOffered(vehicleId: $vehicleId) {
    request {
      address
      createdAt
      description
      emergencySubCategoryId
      id
      latitude
      longitude
      proofImageURL
      emergencySubCategory {
        name
      }
      civilianId
      civilian {
        name
        phoneNumber
      }
    }
    isCancelled
    offeredAt
    offerTtlSeconds
  }
}
`;