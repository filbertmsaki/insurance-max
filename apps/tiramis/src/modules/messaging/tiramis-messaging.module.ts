import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TiramisHttpClientService } from './services/tiramis-http-client.service';
import { TiramisRequestLogService } from './services/tiramis-request-log.service';
import { TiramisSignatureService } from './services/tiramis-signature.service';
import { TiramisXmlBuilderService } from './services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from './services/tiramis-xml-parser.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        timeout: configService.getOrThrow<number>(
          'tiramisService.requestTimeoutMs',
        ),

        maxRedirects: 0,

        headers: {
          Accept: 'application/xml,text/xml',
        },
      }),
    }),
  ],

  providers: [
    TiramisXmlBuilderService,
    TiramisXmlParserService,
    TiramisSignatureService,
    TiramisHttpClientService,
    TiramisRequestLogService,
  ],

  exports: [
    TiramisXmlBuilderService,
    TiramisXmlParserService,
    TiramisSignatureService,
    TiramisHttpClientService,
    TiramisRequestLogService,
  ],
})
export class TiramisMessagingModule {}
