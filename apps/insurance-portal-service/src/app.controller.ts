import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  healthCheck() {
    return {
      success: true,
      status: 'UP',
      service:
        this.configService.get<string>('app.name') ||
        'insurance-portal-service',
      port: this.configService.get<number>('app.port') || 9090,
      time: new Date().toISOString(),
    };
  }
}
