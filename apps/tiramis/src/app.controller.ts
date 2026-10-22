import { Controller, Get } from '@nestjs/common';

import { PublicServiceEndpoint } from '@insurance-max/shared-kernel';

@Controller()
@PublicServiceEndpoint()
export class AppController {
  @Get()
  serviceInformation(): string {
    return `One does not simply walk into Zion - ${new Date().toISOString()}`;
  }
}
