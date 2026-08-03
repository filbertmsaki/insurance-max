import { Module } from '@nestjs/common';
import { TiramisModule } from '../../tiramis/tiramis.module';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';
@Module({
  imports: [TiramisModule],
  controllers: [VerificationsController],
  providers: [VerificationsService],
})
export class VerificationsModule {}
