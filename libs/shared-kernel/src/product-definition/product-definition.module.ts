import { Global, Module } from '@nestjs/common';
import { ProductDefinitionHashService } from './product-definition-hash.service';

@Global()
@Module({
  providers: [ProductDefinitionHashService],
  exports: [ProductDefinitionHashService],
})
export class ProductDefinitionModule {}
