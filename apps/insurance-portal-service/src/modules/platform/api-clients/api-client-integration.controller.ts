import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Public } from '@insurance-max/portal-shared/decorators/public.decorator';
import type { Request } from 'express';

import { RequireApiClientScopes } from './decorators/require-api-client-scopes.decorator';
import { ApiKeyGuard } from './guards/api-key.guard';

@Public()
@UseGuards(ApiKeyGuard)
@Controller({ path: 'integration/api', version: '1' })
export class ApiClientIntegrationController {
  @Get('health')
  @RequireApiClientScopes('integrations:health')
  health(@Req() request: Request) {
    return {
      ok: true,
      authenticated_at: new Date().toISOString(),
      api_client: request.apiClient
        ? {
            client_id: request.apiClient.client_id,
            company_id: request.apiClient.company_id,
            client_type: request.apiClient.client_type,
            environment: request.apiClient.environment,
            scopes: request.apiClient.scopes,
            status: request.apiClient.status,
          }
        : null,
    };
  }
}
