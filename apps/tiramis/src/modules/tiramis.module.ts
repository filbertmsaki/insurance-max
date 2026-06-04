import { Module } from '@nestjs/common';

import { TiramisConfigModule } from './config/tiramis-config.module';
import { TiramisCoverNotesModule } from './cover-notes/tiramis-cover-notes.module';
import { TiramisMessagingModule } from './messaging/tiramis-messaging.module';
import { TiramisMotorModule } from './motor/tiramis-motor.module';
import { TiramisSubmissionsModule } from './submissions/tiramis-submissions.module';

@Module({
  imports: [
    TiramisConfigModule,
    TiramisSubmissionsModule,
    TiramisMessagingModule,
    TiramisCoverNotesModule,
    TiramisMotorModule,
  ],
  exports: [TiramisCoverNotesModule, TiramisMotorModule],
})
export class TiramisModule {}
