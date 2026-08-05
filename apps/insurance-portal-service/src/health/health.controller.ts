import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { ServiceHealthResponse } from '@insurance-max/contracts';
import { Public } from '@insurance-max/portal-shared';

import { HealthService } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async health(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ServiceHealthResponse> {
    return this.readiness(response);
  }

  @Get('live')
  liveness(): ServiceHealthResponse {
    return this.healthService.live();
  }

  @Get('ready')
  async readiness(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ServiceHealthResponse> {
    const result = await this.healthService.ready();

    response.status(
      result.status === 'DOWN' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK,
    );

    return result;
  }
}
