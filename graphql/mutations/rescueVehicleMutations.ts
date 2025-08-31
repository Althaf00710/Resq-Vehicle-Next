import { gql } from '@apollo/client';

export const HANDLE_RESCUE_VEHICLE_LOCATION = gql`
  mutation HandleRescueVehicleLocation($input: RescueVehicleLocationInput!) {
    handleRescueVehicleLocation(input: $input) {
      success
      message
    }
  }
`;

export const LOGIN_RESCUE_VEHICLE = gql`
  mutation LoginRescueVehicle($plateNumber: String!, $password: String!) {
    loginRescueVehicle(plateNumber: $plateNumber, password: $password) {
      success
      message
      rescueVehicle {
        id
        code
        plateNumber
        rescueVehicleCategory { name }
      }
    }
  }
`;
