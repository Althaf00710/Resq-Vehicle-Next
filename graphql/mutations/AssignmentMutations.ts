import { gql } from "@apollo/client";

export const RESPOND_TO_ASSIGNMENT_OFFER = gql`
    mutation RespondToAssignment($input: VehicleAssignmentResponseInput!) {
        respondToAssignment(input: $input) {
            success
            message
        }
    }
`;

export const UPDATE_RESCUE_VEHICLE_ASSIGNMENT = gql`
  mutation UpdateRescueVehicleAssignment($id: Int!, $status: String!) {
    updateRescueVehicleAssignment(id: $id, input: { status: $status }) {
      success
      message
      rescueVehicleAssignment {
        id
        arrivalTime
        departureTime
        durationMinutes
        rescueVehicleRequest {
          id
          status
          createdAt
        }
      }
    }
  }
`;

