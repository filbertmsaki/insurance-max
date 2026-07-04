import { Module } from '@nestjs/common';

import { TiramisPayloadValidationService } from './services/tiramis-payload-validation.service';

@Module({
  providers: [TiramisPayloadValidationService],
  exports: [TiramisPayloadValidationService],
})
export class TiramisSharedModule {}
