import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PublicServiceEndpoint } from '@insurance-max/shared-kernel';

@Controller()
@PublicServiceEndpoint()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  serviceInformation() {
    return {
      service: this.configService.get<string>('app.name') || 'TIRAMIS Service',
      status: 'UP',
      documentation: '/api/docs',
      health: '/api/health',
    };
  }
}
