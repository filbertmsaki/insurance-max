import { Controller, Get } from '@nestjs/common';
import { Public } from '@insurance-max/portal-shared';

import { AppService } from './app.service';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
