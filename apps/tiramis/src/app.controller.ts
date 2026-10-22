import { Controller, Get, Header } from '@nestjs/common';

import {
  PublicServiceEndpoint,
  RawResponse,
} from '@insurance-max/shared-kernel';

@Controller()
@PublicServiceEndpoint()
export class AppController {
  @Get()
  @RawResponse()
  @Header('Content-Type', 'text/html; charset=utf-8')
  serviceInformation(): string {
    return `One does not simply walk into Zion - ${new Date().toISOString()}`;
  }
}
