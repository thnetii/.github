import type { IncomingHttpHeaders } from 'node:http';
import type { HttpCodes } from '@actions/http-client';

export type AzAcsMetadataDocument = {
  keys: {
    usage: string;
    keyValue: {
      type: string;
      value: string;
      keyInfo: {
        x5t: string;
      };
    };
  }[];
  endpoints: ((
    | {
        usage: 'issuance';
        protocol: 'OAuth2';
      }
    | {
        usage: 'issuance';
        protocol: 'DelegationIssuance1.0';
      }
    | {
        usage: 'management';
        protocol: 'DelegationManagement1.0';
      }
  ) & {
    location: string;
  })[];
  name: string;
  version: string;
  realm: string;
  issuer: string;
  allowedAudiences: string[];
};

export type AzAcsOAuthErrorResponse = {
  error: string;
  error_description: string;
  error_uri: string;
};

export type AzAcsOAuthTokenResponse = {
  access_token: string;
  scope: string;
  token_type: string;
};

export type AzAcsOAuthEndpointHttpResponse = (
  | {
      statusCode: HttpCodes.OK;
      result: AzAcsOAuthTokenResponse;
    }
  | {
      statusCode: Exclude<HttpCodes, HttpCodes.OK>;
      result: AzAcsOAuthErrorResponse;
    }
) & {
  headers: IncomingHttpHeaders;
};
