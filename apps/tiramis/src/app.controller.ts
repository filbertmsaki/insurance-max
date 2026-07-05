import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get('health')
  healthCheck() {
    return {
      success: true,
      status: 'UP',
      service: this.configService.get<string>('app.name') || 'tiramis',
      port: this.configService.get<number>('app.port') || 9091,
      time: new Date().toISOString(),
    };
  }
}
