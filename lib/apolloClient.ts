import { ApolloClient, InMemoryCache, split, ApolloLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import { setContext } from '@apollo/client/link/context';

const RV_JWT_KEY = 'resq.rv.jwt';

// Upload-capable HTTP link
const uploadLink = createUploadLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_API_URL,
  headers: { 'GraphQL-Preflight': '1' },
}) as unknown as ApolloLink;

// Add Authorization header (client-side only)
const authLink = setContext((_, { headers }) => {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem(RV_JWT_KEY) : null;

  return {
    headers: {
      ...headers,
      // Use standard header casing
      Authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// HTTP link with auth
const httpLink = authLink.concat(uploadLink);

// WS link with auth (only in browser)
const wsLink =
  typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: process.env.NEXT_PUBLIC_GRAPHQL_WS_URL!,
          lazy: true, // connect only when a subscription starts
          connectionParams: () => {
            const token = localStorage.getItem(RV_JWT_KEY);
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        })
      )
    : null;

// Split subscriptions vs. queries/mutations
const link =
  typeof window !== 'undefined' && wsLink
    ? split(
        ({ query }) => {
          const def = getMainDefinition(query);
          return def.kind === 'OperationDefinition' && def.operation === 'subscription';
        },
        wsLink,
        httpLink
      )
    : httpLink;

const client = new ApolloClient({
  link,
  cache: new InMemoryCache(),
});

export default client;
