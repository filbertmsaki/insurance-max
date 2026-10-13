import { Controller, Get, Req } from '@nestjs/common';
import { ServiceScopes } from '@insurance-max/shared-kernel';
import type { Request } from 'express';

@Controller('tiramis/platform')
export class TiramisPlatformConnectionController {
  @Get('connection-test')
  @ServiceScopes('tiramis:read')
  test(
    @Req()
    request: Request & {
      tiramisContext?: { serviceName?: string; environment?: string };
    },
  ) {
    return {
      success: true,
      authenticated: true,
      serviceName: request.tiramisContext?.serviceName ?? null,
      environment: request.tiramisContext?.environment ?? null,
      checkedAt: new Date().toISOString(),
    };
  }
}
