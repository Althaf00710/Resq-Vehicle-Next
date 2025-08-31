import { gql } from "@apollo/client";

export const RESPOND_TO_ASSIGNMENT_OFFER = gql`
    mutation RespondToAssignment($input: VehicleAssignmentResponseInput!) {
        respondToAssignment(input: $input) {
            success
            message
        }
    }
`