import { gql } from '@apollo/client';

export const HANDLE_RESCUE_VEHICLE_LOCATION = gql`
  mutation HandleRescueVehicleLocation($input: RescueVehicleLocationInput!) {
    handleRescueVehicleLocation(input: $input) {
      success
      message
    }
  }
`;
