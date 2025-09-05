import { gql } from "@apollo/client";

export const VEHICLE_ASSIGNMENT_QUERY = gql`
query OngoingByVehicle($rescueVehicleId: Int!) {
  assignments(where: { rescueVehicleId: { eq: $rescueVehicleId } }, order: { id: DESC }) {
    id
    rescueVehicleRequest {
      id
      status
      latitude
      longitude
      address
      description
      createdAt
      emergencySubCategory {
        name
      }
      proofImageURL
    }
  }
}
`;