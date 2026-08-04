import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        baseURL: configService.getOrThrow<string>('tiramisClient.baseUrl'),

        timeout: configService.getOrThrow<number>('tiramisClient.timeoutMs'),

        maxRedirects:
          configService.get<number>('tiramisClient.maxRedirects') ?? 0,

        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }),
    }),
  ],

  exports: [HttpModule],
})
export class TiramisHttpModule {}
