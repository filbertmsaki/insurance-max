import { SetMetadata } from '@nestjs/common';

export const API_CLIENT_SCOPES_KEY = 'api-client-scopes';

export const RequireApiClientScopes = (...scopes: string[]) =>
  SetMetadata(API_CLIENT_SCOPES_KEY, scopes);
