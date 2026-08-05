import { SetMetadata } from '@nestjs/common';

import {
  PUBLIC_SERVICE_ENDPOINT,
  SERVICE_SCOPES,
} from './service-auth.constants';

export const PublicServiceEndpoint = () =>
  SetMetadata(PUBLIC_SERVICE_ENDPOINT, true);

export const ServiceScopes = (...scopes: string[]) =>
  SetMetadata(SERVICE_SCOPES, scopes);
