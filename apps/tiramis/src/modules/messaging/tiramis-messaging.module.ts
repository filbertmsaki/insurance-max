import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { TiramisHttpClientService } from './services/tiramis-http-client.service';
import { TiramisSignatureService } from './services/tiramis-signature.service';
import { TiramisXmlBuilderService } from './services/tiramis-xml-builder.service';
import { TiramisXmlParserService } from './services/tiramis-xml-parser.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 0,
    }),
  ],
  providers: [
    TiramisXmlBuilderService,
    TiramisXmlParserService,
    TiramisSignatureService,
    TiramisHttpClientService,
  ],
  exports: [
    TiramisXmlBuilderService,
    TiramisXmlParserService,
    TiramisSignatureService,
    TiramisHttpClientService,
  ],
})
export class TiramisMessagingModule {}
