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
      service: this.configService.getOrThrow<string>('app.name'),
      port: this.configService.getOrThrow<number>('app.port'),
      time: new Date().toISOString(),
    };
  }
}
