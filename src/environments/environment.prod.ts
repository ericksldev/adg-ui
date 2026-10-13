/**
 * Production API base URL, including the `/api` prefix mounted by the backend.
 * Replace REPLACE_WITH_PRODUCTION_API_URL with the public host before deploying.
 * The production workflow refuses to publish while this placeholder is still present.
 */
export const PRODUCTION_API_URL = 'https://vrete-api.r0aqny57fas5a.us-east-1.cs.amazonlightsail.com/api';

export const environment = {
  production: true,
  urlApi: PRODUCTION_API_URL
};
