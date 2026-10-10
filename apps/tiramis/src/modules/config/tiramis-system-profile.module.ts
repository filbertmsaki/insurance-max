import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiramisSecurityModule } from '../security/tiramis-security.module';
import { TiramisSystemProfileEntity } from './entities/tiramis-system-profile.entity';
import { TiramisSystemProfileService } from './services/tiramis-system-profile.service';

/** Platform TIRA profiles, shared by configuration, delivery and callbacks. */
@Module({
  imports: [
    TypeOrmModule.forFeature([TiramisSystemProfileEntity]),
    TiramisSecurityModule,
  ],
  providers: [TiramisSystemProfileService],
  exports: [TiramisSystemProfileService],
})
export class TiramisSystemProfileModule {}
