import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenceDataController } from './reference-data.controller';
import { ReferenceDataService } from './reference-data.service';
import { ReferenceCountry } from './entities/reference-country.entity';
import { ReferenceCurrency } from './entities/reference-currency.entity';
import { ReferenceDistrict } from './entities/reference-district.entity';
import { ReferenceRegion } from './entities/reference-region.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReferenceCountry,
      ReferenceRegion,
      ReferenceDistrict,
      ReferenceCurrency,
    ]),
  ],
  controllers: [ReferenceDataController],
  providers: [ReferenceDataService],
  exports: [ReferenceDataService],
})
export class ReferenceDataModule {}
